// Rules tests. Run with:  node --test ludo/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoom, reduce, botAction, blastTargets, kaboomTokens, square, current,
  YARD, HOME, SAFE,
} from '../js/engine.js';
import { charForName } from '../js/characters.js';

// Deterministic dice: feeds the given values (1–6) to the engine, then 0.5 forever.
const dice = (...vals) => {
  const q = vals.map(v => (v - 1) / 6 + 0.01);
  return () => (q.length ? q.shift() : 0.5);
};

function lobby(names, settings = {}) {
  let s = createRoom('TEST', 1);
  names.forEach((name, i) => { s = reduce(s, { type: 'join', uid: `u${i}`, name }); });
  s = reduce(s, { type: 'settings', uid: 'u0', settings: { boxes: false, timer: 0, ...settings } });
  return s;
}

function started(names, settings) {
  return reduce(lobby(names, settings), { type: 'start', uid: 'u0', at: 1 }, () => 0); // u0 goes first
}

// Put the game in a hand-made position.
function setup(s, tokens, turnColor = 'red') {
  const t = JSON.parse(JSON.stringify(s));
  Object.assign(t.tokens, tokens);
  t.turn = t.players.findIndex(p => p.color === turnColor);
  t.phase = 'roll'; t.dice = null; t.sixes = 0;
  return t;
}

test('names pick characters, impostors get bumped', () => {
  assert.equal(charForName('Ajay'), 'ajay');
  assert.equal(charForName('  ajay kumar '), 'ajay');
  assert.equal(charForName('NAV!!'), 'nav');
  assert.equal(charForName('Naveen'), null);
  assert.equal(charForName('Chechi'), 'chechu');

  let s = createRoom('TEST', 1);
  s = reduce(s, { type: 'join', uid: 'a', name: 'Rahul', char: 'nav' });
  assert.equal(s.players[0].char, 'nav');
  s = reduce(s, { type: 'join', uid: 'b', name: 'Nav' });
  assert.equal(s.players[1].char, 'nav', 'the real Nav gets Nav');
  assert.notEqual(s.players[0].char, 'nav', 'impostor moved to another character');
  assert.equal(reduce(s, { type: 'pick', uid: 'b', char: 'liu' }), null, 'Nav is locked to Nav');
  assert.equal(s.host, 'a');
});

test('2 players sit opposite each other, 4 fill the board', () => {
  const two = started(['Ajay', 'Nav']);
  assert.deepEqual(two.players.map(p => p.color), ['red', 'yellow']);
  const four = started(['Ajay', 'Nav', 'Liu', 'Chechu']);
  assert.deepEqual(four.players.map(p => p.color), ['red', 'green', 'yellow', 'blue']);
  assert.equal(four.phase, 'roll');
  assert.equal(current(four).uid, 'u0');
});

test('need a 6 to leave the yard, and a 6 gives another roll', () => {
  let s = started(['Ajay', 'Nav']);
  let n = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(n.fx.items.some(f => f.k === 'nomove'), true);
  assert.equal(current(n).uid, 'u1', 'turn passed');

  n = reduce(s, { type: 'roll', uid: 'u0' }, dice(6));
  assert.equal(n.tokens.red[0], 0, 'single choice moves automatically');
  assert.equal(current(n).uid, 'u0', 'six = roll again');
  assert.equal(n.phase, 'roll');
});

test('only the current player can roll', () => {
  const s = started(['Ajay', 'Nav']);
  assert.equal(reduce(s, { type: 'roll', uid: 'u1' }), null);
});

test('three sixes in a row loses the turn', () => {
  let s = setup(started(['Ajay', 'Nav']), { red: [5, 20, YARD, YARD] });
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(6));
  s = reduce(s, { type: 'move', uid: 'u0', token: 0 });
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(6));
  s = reduce(s, { type: 'move', uid: 'u0', token: 0 });
  const before = s.tokens.red.slice();
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(6));
  assert.ok(s.fx.items.some(f => f.k === 'greedy'));
  assert.deepEqual(s.tokens.red, before);
  assert.equal(current(s).uid, 'u1');
});

test('landing on an enemy sends it home and gives an extra roll', () => {
  // red token at step 10 (square 10). yellow token sits on square 13? no: yellow start is 26.
  // Yellow step 36 = square (26+36)%52 = 10. Red at step 7 rolls 3 → square 10.
  let s = setup(started(['Ajay', 'Nav']), { red: [7, YARD, YARD, YARD], yellow: [36, YARD, YARD, YARD] });
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(s.tokens.red[0], 10);
  assert.equal(s.tokens.yellow[0], YARD);
  assert.equal(current(s).uid, 'u0', 'kill = extra roll');
  assert.equal(s.players[0].kills, 1);
  assert.equal(s.players[1].deaths, 1);
  assert.ok(s.fx.items.some(f => f.k === 'say'));
});

test('safe squares protect', () => {
  // Square 8 is a star. Yellow step 34 = (26+34)%52 = 8.
  let s = setup(started(['Ajay', 'Nav']), { red: [5, YARD, YARD, YARD], yellow: [34, YARD, YARD, YARD] });
  assert.ok(SAFE.includes(8));
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(s.tokens.red[0], 8);
  assert.equal(s.tokens.yellow[0], 34);
});

test('exact roll needed to get home, home gives extra roll', () => {
  let s = setup(started(['Ajay', 'Nav']), { red: [53, HOME, HOME, HOME] });
  let n = reduce(s, { type: 'roll', uid: 'u0' }, dice(5));
  assert.equal(n.tokens.red[0], 53, 'overshoot not allowed');
  s = setup(started(['Ajay', 'Nav']), { red: [53, 10, HOME, HOME] });
  n = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(n.phase, 'move');
  n = reduce(n, { type: 'move', uid: 'u0', token: 0 });
  assert.equal(n.tokens.red[0], HOME);
  assert.equal(current(n).uid, 'u0');
});

test('first player home wins (default) and ranks everyone', () => {
  let s = setup(started(['Ajay', 'Nav', 'Liu']), { red: [53, HOME, HOME, HOME], green: [4, YARD, YARD, YARD] });
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.ranks, ['u0', 'u1', 'u2']);
});

test('"play till the last" keeps going after the first winner', () => {
  let s = setup(started(['Ajay', 'Nav', 'Liu'], { finish: 'all' }), { red: [53, HOME, HOME, HOME] });
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(s.phase, 'roll');
  assert.equal(s.players[0].done, true);
  assert.equal(current(s).uid, 'u1');
});

test('KABOOM: once per game, takes nearby enemies (even on safe squares) and the bomber', () => {
  // Red at step 9 (square 9). Yellow at square 8 (safe star, step 34) and square 11 (step 37).
  // Yellow at square 12 (step 38) is 3 away: out of range.
  let s = setup(started(['Ajay', 'Nav']), { red: [9, 30, YARD, YARD], yellow: [34, 37, 38, YARD] });
  assert.deepEqual(kaboomTokens(s, 'red'), [0]);
  assert.equal(blastTargets(s, 'red', 0).length, 2);
  assert.equal(reduce(s, { type: 'kaboom', uid: 'u0', token: 1 }), null, 'nobody near token 1');
  s = reduce(s, { type: 'kaboom', uid: 'u0', token: 0 });
  assert.deepEqual(s.tokens.red, [YARD, 30, YARD, YARD]);
  assert.deepEqual(s.tokens.yellow, [YARD, YARD, 38, YARD]);
  assert.equal(s.players[0].kabooms, 0);
  assert.equal(s.players[0].boomKills, 2);
  assert.equal(current(s).uid, 'u1', 'kaboom ends your turn');
  // Next time it's red's turn: no charges left.
  s = setup(s, { red: [9, 30, YARD, YARD], yellow: [34, 37, 38, YARD] });
  assert.equal(reduce(s, { type: 'kaboom', uid: 'u0', token: 0 }), null);
});

test('kaboom only before rolling', () => {
  let s = setup(started(['Ajay', 'Nav']), { red: [9, 30, YARD, YARD], yellow: [37, YARD, YARD, YARD] });
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(2));
  assert.equal(s.phase, 'move');
  assert.equal(reduce(s, { type: 'kaboom', uid: 'u0', token: 0 }), null);
});

test('shield blocks kills and kabooms until the owner plays again', () => {
  let s = setup(started(['Ajay', 'Nav']), { red: [7, YARD, YARD, YARD], yellow: [36, YARD, YARD, YARD] });
  s.shields = { 'yellow:0': 1 };
  assert.equal(blastTargets(s, 'red', 0).length, 0);
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(s.tokens.yellow[0], 36, 'shielded token survives');
  assert.equal(s.shields['yellow:0'], undefined, 'shield wears off when yellow’s turn starts');
});

// Effect weights: rocket 3, banana 3, swap 2, shield 2, bonus 2, sleepy 2, recharge 1 (of 15).
// After the dice, the next random number picks the effect, e.g. 0.01 → rocket.
function openBoxWith(effectRoll) {
  let s = setup(started(['Ajay', 'Nav']), { red: [10, YARD, YARD, YARD] });
  s.boxes = [square('red', 12)];
  const seq = [1 / 6 + 0.01, effectRoll];
  return reduce(s, { type: 'roll', uid: 'u0' }, () => (seq.length ? seq.shift() : 0.5));
}

test('mystery boxes', () => {
  assert.equal(started(['Ajay', 'Nav'], { boxes: true }).boxes.length, 3);
  let s = openBoxWith(0.01);
  assert.equal(s.tokens.red[0], 17, 'rocket: 12 + 5');
  assert.equal(s.boxes.length, 1, 'box respawned somewhere else');
  assert.notEqual(s.boxes[0], square('red', 12));
  assert.equal(openBoxWith(4 / 15 + 0.01).tokens.red[0], 9, 'banana: 12 - 3');
  s = openBoxWith(9 / 15);
  assert.equal(s.shields['red:0'], 1, 'shield');
  s = openBoxWith(11 / 15);
  assert.equal(current(s).uid, 'u0', 'bonus roll');
  assert.equal(openBoxWith(14.5 / 15).players[0].kabooms, 2, 'recharge');
});

test('sleepy box skips the next turn', () => {
  let s = openBoxWith(12.5 / 15);
  assert.equal(s.players[0].skip, 1);
  assert.equal(current(s).uid, 'u1');
  s = reduce(s, { type: 'roll', uid: 'u1' }, dice(2));
  assert.equal(current(s).uid, 'u1', 'red slept, yellow again');
  assert.ok(s.fx.items.some(f => f.k === 'sleep'));
});

test('stale seq is rejected (double taps, duplicate bot moves)', () => {
  const s = started(['Ajay', 'Nav']);
  assert.ok(reduce(s, { type: 'roll', uid: 'u0', seq: s.seq }, dice(2)));
  assert.equal(reduce(s, { type: 'roll', uid: 'u0', seq: s.seq - 1 }), null);
});

test('timer auto-plays a sleeping player', () => {
  let s = setup(started(['Ajay', 'Nav']), { red: [10, 20, YARD, YARD] });
  s = reduce(s, { type: 'timeout', turnNo: s.turnNo, phase: 'roll' }, dice(3));
  assert.notEqual(current(s).uid, 'u0');
  assert.equal(s.players[0].afk, 1);
  assert.equal(reduce(s, { type: 'timeout', turnNo: s.turnNo - 1, phase: 'roll' }), null, 'old timeout ignored');
});

test('bots join and give way to the real person', () => {
  let s = lobby(['Nav']);
  s = reduce(s, { type: 'bot', uid: 'u0' });
  s = reduce(s, { type: 'bot', uid: 'u0' });
  assert.equal(s.players.length, 3);
  assert.equal(new Set(s.players.map(p => p.char)).size, 3);
  const botChar = s.players[1].char;
  s = reduce(s, { type: 'join', uid: 'z', name: s.players[1].name.replace(' 🤖', '') });
  assert.equal(s.players[3].char, botChar, 'the real person takes the bot’s face');
  assert.notEqual(s.players[1].char, botChar);
  assert.ok(s.players[1].name.endsWith('🤖'));
  for (let i = 0; i < 3; i++) assert.equal(charForName(s.players[1].name.replace(' 🤖', '')), s.players[1].char);
});

test('rematch goes back to the lobby with the same crew', () => {
  let s = setup(started(['Ajay', 'Nav']), { red: [53, HOME, HOME, HOME] });
  s = reduce(s, { type: 'roll', uid: 'u0' }, dice(3));
  assert.equal(s.phase, 'over');
  assert.equal(reduce(s, { type: 'rematch', uid: 'u1' }), null, 'only the host');
  s = reduce(s, { type: 'rematch', uid: 'u0' });
  assert.equal(s.phase, 'lobby');
  assert.deepEqual(s.players.map(p => p.char), ['ajay', 'nav']);
  s = reduce(s, { type: 'start', uid: 'u0', at: 1 }, () => 0);
  assert.deepEqual(s.tokens.red, [YARD, YARD, YARD, YARD]);
  assert.equal(s.players[0].kills, 0);
});

// Plays thousands of full bot games and checks nothing ever breaks.
test('simulation: 600 random games always finish cleanly', () => {
  let seed = 42;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const stats = { kabooms: 0, boxes: 0, kills: 0, greedy: 0, actions: 0 };
  for (let g = 0; g < 600; g++) {
    const n = 2 + (g % 3);
    let s = createRoom('SIM', 1);
    for (let i = 0; i < n; i++) s = reduce(s, { type: 'join', uid: `p${i}`, name: ['Ajay', 'Nav', 'Chechu', 'Liu'][i] });
    s = reduce(s, { type: 'settings', uid: 'p0', settings: { boxes: g % 2 === 0, finish: g % 4 < 2 ? 'first' : 'all', timer: 0 } });
    s = reduce(s, { type: 'start', uid: 'p0', at: 1 }, rng);
    let steps = 0;
    while (s.phase !== 'over') {
      const a = g % 7 === 0 && s.phase === 'roll' ? { type: 'timeout', turnNo: s.turnNo, phase: 'roll' } : botAction(s);
      const next = reduce(s, a, rng);
      assert.ok(next, `bot action rejected: ${JSON.stringify(a)} in phase ${s.phase}`);
      s = next;
      for (const f of s.fx.items) {
        if (f.k === 'kaboom') stats.kabooms++;
        if (f.k === 'box') stats.boxes++;
        if (f.k === 'kill') stats.kills++;
        if (f.k === 'greedy') stats.greedy++;
      }
      for (const c of Object.keys(s.tokens)) for (const p of s.tokens[c]) assert.ok(p >= YARD && p <= HOME && Number.isInteger(p));
      if (s.phase === 'move') assert.ok(s.movable.length > 0);
      if (s.phase === 'roll' || s.phase === 'move') assert.ok(!current(s).done, 'finished player got a turn');
      assert.ok(++steps < 5000, 'game never ended');
    }
    stats.actions += steps;
    assert.equal(s.ranks.length, n);
    assert.equal(new Set(s.ranks).size, n);
  }
  assert.ok(stats.kabooms > 50, `kabooms happen (${stats.kabooms})`);
  assert.ok(stats.boxes > 200 && stats.kills > 500 && stats.greedy > 0);
});
