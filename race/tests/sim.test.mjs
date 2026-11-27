// node --test race/tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, TRACK_IDS, locate, cowAt, HALF_W } from '../js/track.js';
import { World, makeKart, botInput, rubberBand, standings, DT, rollItem, ITEM_IDS } from '../js/sim.js';
import { RIDES, CHAR_IDS } from '../js/riders.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function botRace(trackId, seed, laps = 3, maxT = 400) {
  const T = buildTrack(trackId);
  const rng = seeded(seed);
  const W = new World(T, { laps, rng });
  CHAR_IDS.forEach((c, i) => W.add(makeKart(c, c, RIDES[c].stats, T, i, { bot: true, skill: 0.93 + rng() * 0.07 })));
  const inputs = {};
  W.time = 0;
  let t = 0, events = { hit: 0, use: 0, cow: 0, turbo: 0, pothole: 0, breaker: 0, wall: 0 };
  while (t < maxT && !W.karts.every(k => k.done)) {
    for (const k of W.karts) inputs[k.id] = botInput(k, W, inputs[k.id] || {});
    if (Math.round(t / DT) % 60 === 0) rubberBand(W);
    W.step(DT, inputs);
    for (const e of W.outQ) if (e.k === 'hit') events.hit++; else if (e.k === 'use') events.use++;
    for (const f of W.fxQ) if (f.type in events) events[f.type]++;
    W.outQ.length = 0; W.fxQ.length = 0;
    t += DT;
    for (const k of W.karts) {
      assert.ok(Number.isFinite(k.x) && Number.isFinite(k.z) && Number.isFinite(k.y) && Number.isFinite(k.P), `${k.id} went NaN`);
    }
  }
  return { W, T, t, events };
}

for (const id of TRACK_IDS) {
  test(`bots finish 3 laps of ${id}`, () => {
    const { W, T, t, events } = botRace(id, 7);
    const order = standings(W.karts);
    const times = order.map(k => k.finishT.toFixed(1));
    console.log(id, 'L', T.L.toFixed(0), 'finished in', t.toFixed(1), 's', times.join(' '), JSON.stringify(events));
    assert.ok(W.karts.every(k => k.done), 'everyone finishes');
    assert.ok(order[0].finishT > 20 * 3 && order[0].finishT < 3 * 75, 'lap times are sensible');
    assert.ok(events.use > 5, 'bots use items');
  });
}

test('locate finds the right side and distance', () => {
  const T = buildTrack('rajwada');
  const i = 100;
  const x = T.X[i] + T.NX[i] * 3, z = T.Z[i] + T.NZ[i] * 3;
  const l = locate(T, x, z, i - 5);
  assert.ok(Math.abs(l.d - 3) < 0.05, `d=${l.d}`);
  assert.ok(Math.abs(l.s - i * T.step) < 0.5);
});

test('flyover branches never get mixed up at the crossing', () => {
  const T = buildTrack('flyover');
  const rng = seeded(3);
  const W = new World(T, { laps: 2, rng });
  const k = W.add(makeKart('nav', 'nav', RIDES.nav.stats, T, 0, { bot: true }));
  W.time = 0;
  let prevP = k.P, maxDrop = 0;
  for (let t = 0; t < 140 && !k.done; t += DT) {
    W.step(DT, { nav: botInput(k, W) });
    maxDrop = Math.max(maxDrop, prevP - k.P);
    prevP = k.P;
  }
  assert.ok(k.done, 'finishes the figure of eight');
  assert.ok(maxDrop < 1, 'progress never jumps backwards');
});

test('cows keep to their timetable', () => {
  const T = buildTrack('rajwada');
  const c = T.cows[0];
  const a = cowAt(c, 0), b = cowAt(c, 36);
  assert.equal(a.d, b.d);
  assert.ok(Math.abs(cowAt(c, 5).d) <= HALF_W + 3);
});

test('item odds: leaders never get rockets, last place never gets paan', () => {
  const rng = seeded(1);
  for (let i = 0; i < 2000; i++) {
    assert.notEqual(rollItem(0, rng), 'rocket');
    assert.notEqual(rollItem(1, rng), 'paan');
    assert.ok(ITEM_IDS.includes(rollItem(0.5, rng)));
  }
});

test('a chappal finds the kart ahead', () => {
  const T = buildTrack('rajwada');
  const W = new World(T, { laps: 3, rng: seeded(2) });
  const a = W.add(makeKart('ajay', 'ajay', RIDES.ajay.stats, T, 3));
  const b = W.add(makeKart('liu', 'liu', RIDES.liu.stats, T, 0));
  W.time = 0;
  a.item = 'chappal'; a.itemN = 1;
  let hit = null;
  for (let t = 0; t < 5 && !hit; t += DT) {
    W.step(DT, { ajay: { steer: 0, use: t === 0 }, liu: { steer: 0 } });
    hit = W.outQ.find(e => e.k === 'hit');
  }
  assert.ok(hit, 'chappal lands');
  assert.equal(hit.u, 'liu');
  assert.equal(hit.by, 'ajay');
  assert.ok(b.spinT > 0);
});

test('nimbu-mirchi blocks one hit', () => {
  const T = buildTrack('rajwada');
  const W = new World(T, { laps: 3 });
  const k = W.add(makeKart('vanshika', 'vanshika', RIDES.vanshika.stats, T, 0));
  W.time = 0;
  k.item = 'nimbu'; k.itemN = 1;
  W.use(k);
  assert.ok(k.shieldT > 15);
  assert.equal(W.hit(k, 'chappal', 'x', 'o1'), false);
  assert.equal(k.shieldT, 0);
  assert.equal(W.hit(k, 'chappal', 'x', 'o2'), true);
});

test('a well-timed tap at the lights gives a rocket start', () => {
  const T = buildTrack('rajwada');
  const W = new World(T, { laps: 3 });
  const k = W.add(makeKart('nav', 'nav', RIDES.nav.stats, T, 0));
  W.time = -1;
  for (let t = -1; t < 0.05; t += DT) W.step(DT, { nav: { steer: 0, drift: W.time > -0.3 && W.time < -0.2 } });
  assert.ok(k.boostT > 0, 'boosting off the line');
});
