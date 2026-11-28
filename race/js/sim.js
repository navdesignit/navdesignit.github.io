// The race itself: kart physics, drifting, items, road hazards and the bot drivers.
// Pure JS with no DOM or three.js, so the same code runs on every phone and in Node tests.
//
// Each phone simulates only the karts it owns (its player, plus the bots on the host's
// phone). Everyone else's karts arrive over the network and are just drawn where they
// say they are. Items are announced as events, and whoever gets hit decides it on
// their own phone, so nobody ever argues with lag.

import { locate, bumpAt, cowAt, lapDelta, HALF_W, SHOULDER, KERB, COW_REACH } from './track.js';

export const DT = 1 / 60;
export const BASE_V = 27;          // m/s, about 97 km/h
const ACC = 12.5;
const G = 26;                      // arcade gravity: short, punchy jumps
export const KART_R = 1.25;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

export const ITEM_IDS = ['chappal', 'cooker', 'nimbu', 'chai', 'horn', 'paan', 'rocket', 'cow'];
// Odds by race position: leaders get defensive junk, the back of the pack gets rockets.
//            chappal cooker nimbu chai horn paan rocket cow
const ODDS = [[22, 20, 20, 0, 10, 23, 0, 5],
  [24, 12, 12, 18, 12, 10, 2, 10],
  [20, 6, 8, 25, 15, 0, 20, 6]];

export function rollItem(frac, rng = Math.random) {
  const row = frac < 0.3 ? ODDS[0] : frac > 0.7 ? ODDS[2] : ODDS[1];
  let r = rng() * row.reduce((a, b) => a + b, 0);
  for (let i = 0; i < row.length; i++) { r -= row[i]; if (r < 0) return ITEM_IDS[i]; }
  return 'chappal';
}

// Network flags packed into one number.
export const F = { DL: 1, DR: 2, BOOST: 4, SPIN: 8, SHIELD: 16, ROCKET: 32, AIR: 64, DONE: 128, LV1: 256, LV2: 512, WOBBLE: 1024, OFF: 2048, WRONG: 4096 };

export function flagsOf(k) {
  let f = 0;
  if (k.drift < 0) f |= F.DL;
  if (k.drift > 0) f |= F.DR;
  if (k.boostT > 0) f |= F.BOOST;
  if (k.spinT > 0) f |= F.SPIN;
  if (k.shieldT > 0) f |= F.SHIELD;
  if (k.rocketT > 0) f |= F.ROCKET;
  if (k.air) f |= F.AIR;
  if (k.done) f |= F.DONE;
  if (k.level & 1) f |= F.LV1;
  if (k.level & 2) f |= F.LV2;
  if (k.wobbleT > 0) f |= F.WOBBLE;
  if (k.offroad) f |= F.OFF;
  if (k.wrongT > 1) f |= F.WRONG;
  return f;
}

// A kart on the starting grid. Slot 0 is pole position.
export function makeKart(id, char, stats, T, slot, extra = {}) {
  const row = Math.floor(slot / 2);
  const s = T.L - 7 - row * 7 - (slot % 2) * 3.5;
  const d = (slot % 2 ? -1 : 1) * 3.4;
  const i = T.at(s);
  const k = {
    id, char, stats, slot,
    x: T.X[i] + T.NX[i] * d, z: T.Z[i] + T.NZ[i] * d, y: T.Y[i], vy: 0, gvy: 0,
    h: T.ANG[i], v: 0, steer: 0, kx: 0, kz: 0,
    drift: 0, charge: 0, level: 0, hopT: 0, dHeld: false,
    boostT: 0, boostP: 1, spinT: 0, shieldT: 0, rocketT: 0, wobbleT: 0,
    air: false, offroad: false, wrongT: 0,
    idx: i, s: i * T.step, lastS: i * T.step, d, P: i * T.step - T.L, lapMax: -1,
    done: false, finishT: 0,
    item: null, itemN: 0, rollT: 0, pending: null, pendingN: 0,
    cool: { wall: 0, hole: 0, cow: 0, bump: 0, strip: 0 },
    visYaw: 0, remote: false, bot: false, rubber: 1, skill: 1,
    stats2: { hits: 0, hitBy: 0, cows: 0, holes: 0, turbos: 0, items: 0, walls: 0 },
    ...extra,
  };
  return k;
}

export function lapOf(k, T, laps) { return clamp(Math.floor(k.P / T.L) + 1, 1, laps); }

// Order karts by race position: finished ones by time, then by distance covered.
export function standings(karts) {
  return [...karts].sort((a, b) => {
    if (a.done && b.done) return a.finishT - b.finishT;
    if (a.done !== b.done) return a.done ? -1 : 1;
    return b.P - a.P;
  });
}

export class World {
  constructor(track, { laps = 3, rng = Math.random } = {}) {
    this.track = track;
    this.laps = laps;
    this.rng = rng;
    this.karts = [];
    this.byId = {};
    this.objs = [];
    this.time = -4;
    this.seq = 0;
    this.boxT = new Float32Array(track.boxes.length).fill(-99);
    this.outQ = [];   // events for the other phones
    this.fxQ = [];    // things to show and play on this phone
    this.gone = new Set(); // objects already used up
    this._loc = {};
    this._loc2 = {};
  }

  add(k) { this.karts.push(k); this.byId[k.id] = k; return k; }
  remove(id) { this.karts = this.karts.filter(k => k.id !== id); delete this.byId[id]; }
  out(ev) { this.outQ.push(ev); }
  fx(k, type, a, b) { this.fxQ.push({ k, type, a, b }); }

  rankFrac(k) {
    const order = standings(this.karts);
    const n = order.length;
    return n > 1 ? order.indexOf(k) / (n - 1) : 0;
  }

  // One fixed physics step. `inputs` maps kart id → { steer, drift, use }.
  step(dt, inputs) {
    this.time += dt;
    const racing = this.time >= 0;
    for (const k of this.karts) {
      if (k.remote) continue;
      const inp = inputs[k.id] || NO_INPUT;
      if (!racing) { this.grid(k, inp); continue; }
      stepKart(k, inp, this, dt);
      if (inp.use && (k.item && k.rollT <= 0)) this.use(k);
    }
    if (!racing) return;
    this.collide();
    this.pickups();
    this.hazards();
    this.stepObjs(dt);
  }

  // Before the lights: hold still, and remember a well-timed tap for a rocket start.
  grid(k, inp) {
    if (inp.drift && !k.dHeld) k.tapAt = this.time;
    k.dHeld = !!inp.drift;
    if (this.time + DT >= 0 && k.tapAt != null && k.tapAt > -0.45) {
      k.boostT = 1.3; k.boostP = 1.4; k.v = 12;
      this.fx(k, 'rocketstart');
      k.tapAt = null;
    }
  }

  collide() {
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        if (a.remote && b.remote) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 4 * KART_R * KART_R || d2 < 1e-6 || Math.abs(a.y - b.y) > 2) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
        const over = 2 * KART_R - d;
        const wa = a.stats.weight, wb = b.stats.weight;
        const fa = b.remote ? 0.9 : wb / (wa + wb), fb = a.remote ? 0.9 : wa / (wa + wb);
        if (!a.remote) { a.x -= nx * over * fa; a.z -= nz * over * fa; a.kx -= nx * 5 * fa; a.kz -= nz * 5 * fa; }
        if (!b.remote) { b.x += nx * over * fb; b.z += nz * over * fb; b.kx += nx * 5 * fb; b.kz += nz * 5 * fb; }
        for (const [k, o] of [[a, b], [b, a]]) {
          if (k.remote) continue;
          if (o.rocketT > 0 && k.rocketT <= 0) this.hit(k, 'bump', o.id, null);
          else if (k.cool.bump <= 0) { this.fx(k, 'bump', o.id); k.cool.bump = 0.6; }
        }
      }
    }
  }

  // Mithai boxes: drive through one to get an item. Boxes vanish for everyone's
  // karts (so they look right on every phone) but only your own kart gets the item.
  pickups() {
    const B = this.track.boxes;
    for (let i = 0; i < B.length; i++) {
      if (this.time < this.boxT[i]) continue;
      const b = B[i];
      for (const k of this.karts) {
        const dx = k.x - b.x, dz = k.z - b.z;
        if (dx * dx + dz * dz > 5 || Math.abs(k.y - b.y) > 2.5) continue;
        this.boxT[i] = this.time + 3.5;
        this.fx(k, 'boxpop', i);
        if (!k.remote && !k.item && k.rollT <= 0 && !k.done) {
          k.pending = rollItem(this.rankFrac(k), this.rng);
          k.pendingN = k.stats.jugaad && this.rng() < 0.3 ? 2 : 1;
          k.rollT = 1.1;
          this.fx(k, 'box', k.pending);
        }
        break;
      }
    }
  }

  // Cows that wander across the road, and the ones asleep in the middle of it.
  hazards() {
    const T = this.track;
    for (const k of this.karts) {
      if (k.remote || k.air || k.cool.cow > 0) continue;
      for (const c of T.cows) {
        const p = cowAt(c, this.time);
        const cx = c.x + T.NX[c.i] * p.d, cz = c.z + T.NZ[c.i] * p.d;
        this.cowCheck(k, cx, cz, 2.0, 'cow');
      }
      for (const c of T.sleepers) this.cowCheck(k, c.x, c.z, 1.9, 'sleeper');
    }
  }

  cowCheck(k, cx, cz, r, kind) {
    const dx = k.x - cx, dz = k.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > (r + KART_R) ** 2) return false;
    if (k.rocketT > 0) { this.fx(k, 'moo', kind); k.cool.cow = 1; return false; } // the rocket jumps the cow
    const d = Math.sqrt(d2) || 1;
    const over = r + KART_R - d;
    k.x += (dx / d) * over; k.z += (dz / d) * over;
    k.kx += (dx / d) * 5; k.kz += (dz / d) * 5;
    k.v *= 0.35;
    k.drift = 0; k.charge = 0; k.level = 0;
    k.cool.cow = 1.2;
    k.stats2.cows++;
    this.fx(k, 'cow', kind);
    return true;
  }

  // Use the item you're holding.
  use(k) {
    const it = k.item;
    if (!it) return;
    k.itemN -= 1;
    if (k.itemN <= 0) { k.item = null; k.itemN = 0; }
    k.stats2.items++;
    const id = `${k.id}.${++this.seq}`;
    const fx = Math.cos(k.h), fz = Math.sin(k.h);
    const ev = { k: 'use', it, u: k.id, id, x: k.x, y: k.y, z: k.z, h: k.h, t: this.time };
    switch (it) {
      case 'chappal': {
        const tg = this.targetAhead(k);
        ev.tg = tg ? tg.id : null;
        ev.x = k.x + fx * 2; ev.z = k.z + fz * 2;
        break;
      }
      case 'cooker': case 'paan': ev.x = k.x - fx * 2.8; ev.z = k.z - fz * 2.8; break;
      case 'cow': ev.x = k.x - fx * 6; ev.z = k.z - fz * 6; break;
      case 'nimbu': k.shieldT = k.stats.shield || 12; break;
      case 'chai': k.boostT = 1.8; k.boostP = 1.45; k.stats2.turbos++; break;
      case 'rocket': k.rocketT = 3.2; k.drift = 0; k.spinT = 0; break;
      default: break;
    }
    this.spawn(ev, true);
    this.out(ev);
    this.fx(k, 'use', it);
  }

  // The nearest kart in front, within chappal range.
  targetAhead(k) {
    let best = null, bd = 140;
    for (const o of this.karts) {
      if (o === k || o.done) continue;
      const d = o.P - k.P;
      if (d > 0.5 && d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // Create the thing an item event describes (ours, or one from another phone).
  spawn(ev, mine = false) {
    if (this.gone.has(ev.id) || this.objs.some(o => o.id === ev.id)) return;
    const age = mine ? 0 : Math.max(0, this.time - ev.t);
    const base = { id: ev.id, type: ev.it, owner: ev.u, x: ev.x, y: ev.y, z: ev.z, h: ev.h, t0: ev.t };
    switch (ev.it) {
      case 'chappal': {
        const o = { ...base, y: ev.y + 1.5, v: 60, tg: ev.tg, idx: -1, life: 4.5 };
        o.idx = locate(this.track, o.x, o.z, this.byId[ev.u] ? this.byId[ev.u].idx : -1, this._loc2).idx;
        this.objs.push(o);
        if (age > 0) this.moveObj(o, Math.min(age, 0.5));
        break;
      }
      case 'cooker': this.objs.push(this.onRoad({ ...base, boomAt: ev.t + 3, seeti: 0 })); break;
      case 'paan': this.objs.push(this.onRoad({ ...base, r: 1.9, life: 30 })); break;
      case 'cow': this.objs.push(this.onRoad({ ...base, h: ev.h + Math.PI / 2, r: 1.8, life: 12 })); break;
      case 'horn': this.horn(ev); break;
      default: break;
    }
  }

  // Where a dropped trap sits on the road (bots use it to steer round).
  onRoad(o) {
    const l = locate(this.track, o.x, o.z, this.byId[o.owner] ? this.byId[o.owner].idx : -1, this._loc2);
    o.s = l.s; o.d = l.d; o.y = l.y;
    return o;
  }

  // Pon pon! Everyone nearby wobbles, and traps and chappals nearby get blown away.
  horn(ev) {
    for (const k of this.karts) {
      if (k.remote || k.id === ev.u) continue;
      const dx = k.x - ev.x, dz = k.z - ev.z;
      const d = Math.hypot(dx, dz);
      if (d < 12 && Math.abs(k.y - ev.y) < 4) {
        if (this.hit(k, 'horn', ev.u, ev.id)) { k.kx += (dx / (d || 1)) * 8; k.kz += (dz / (d || 1)) * 8; }
      }
    }
    this.objs = this.objs.filter(o => {
      if (o.owner === ev.u && o.type !== 'chappal') return true;
      const near = Math.hypot(o.x - ev.x, o.z - ev.z) < 12;
      if (near) { this.gone.add(o.id); this.fx(null, 'poof', o); }
      return !near;
    });
  }

  // Something hits one of our karts. Returns true if it landed (false if the rocket
  // made us immune). A nimbu-mirchi soaks up one hit.
  hit(k, w, by, oid) {
    if (k.rocketT > 0 || k.done) return false;
    if (k.shieldT > 0) {
      k.shieldT = 0;
      this.out({ k: 'block', u: k.id, by, w, o: oid, t: this.time });
      this.fx(k, 'block', w, by);
      return false;
    }
    k.drift = 0; k.charge = 0; k.level = 0; k.boostT = 0;
    switch (w) {
      case 'chappal': k.spinT = 1.15; k.v *= 0.4; break;
      case 'paan': k.spinT = 1.0; k.v *= 0.5; break;
      case 'cooker': k.spinT = 1.5; k.v *= 0.3; k.air = true; k.vy = 9.5; break;
      case 'bump': k.spinT = 0.7; k.v *= 0.6; break;
      case 'horn': k.wobbleT = 0.9; k.v *= 0.72; break;
      default: k.spinT = 1; break;
    }
    k.stats2.hitBy++;
    this.out({ k: 'hit', u: k.id, by, w, o: oid, t: this.time });
    this.fx(k, 'hit', w, by);
    return true;
  }

  // An event from another phone.
  remote(ev) {
    if (ev.k === 'use') this.spawn(ev);
    else if (ev.k === 'hit' || ev.k === 'block') {
      if (ev.o && ev.w !== 'horn' && ev.w !== 'cooker') this.drop(ev.o);
    } else if (ev.k === 'boom') {
      const o = this.objs.find(x => x.id === ev.o);
      if (o) this.explode(o, false);
    }
  }

  drop(id) {
    this.gone.add(id);
    this.objs = this.objs.filter(o => o.id !== id);
  }

  explode(o, announce) {
    this.drop(o.id);
    this.fx(null, 'boom', o);
    if (announce) this.out({ k: 'boom', o: o.id, t: this.time });
    let n = 0;
    for (const k of this.karts) {
      if (k.remote) continue;
      if (Math.hypot(k.x - o.x, k.z - o.z) < 7.5 && Math.abs(k.y - o.y) < 4 && this.hit(k, 'cooker', o.owner, o.id)) n++;
    }
    return n;
  }

  moveObj(o, dt) {
    const T = this.track;
    const tg = o.tg && this.byId[o.tg];
    let ax, az, ay;
    if (tg && !tg.done) { ax = tg.x; az = tg.z; ay = tg.y + 1; }
    else {
      const ti = (o.idx + 9) % T.N;
      ax = T.X[ti]; az = T.Z[ti]; ay = T.Y[ti] + 1.4;
    }
    const want = Math.atan2(az - o.z, ax - o.x);
    const dist = Math.hypot(ax - o.x, az - o.z);
    const rate = dist < 25 ? 9 : 4;
    o.h += clamp(wrapPi(want - o.h), -rate * dt, rate * dt);
    o.x += Math.cos(o.h) * o.v * dt;
    o.z += Math.sin(o.h) * o.v * dt;
    o.y += (ay - o.y) * Math.min(1, dt * 4);
    o.idx = locate(T, o.x, o.z, o.idx, this._loc2).idx;
  }

  stepObjs(dt) {
    const now = this.time;
    const keep = [];
    for (const o of this.objs) {
      let alive = true;
      if (o.type === 'chappal') {
        this.moveObj(o, dt);
        o.life -= dt;
        if (o.life <= 0) alive = false;
        for (const k of this.karts) {
          if (!alive) break;
          if (k.id === o.owner) continue; // Mummy's chappal never comes back for you
          const dx = k.x - o.x, dz = k.z - o.z, dy = k.y + 1 - o.y;
          if (dx * dx + dz * dz + dy * dy > 3.2) continue;
          alive = false;
          if (!k.remote) this.hit(k, 'chappal', o.owner, o.id);
          else this.fx(k, 'thwack', o);
        }
      } else if (o.type === 'cooker') {
        const age = now - o.t0;
        while (o.seeti < 2 && age >= o.seeti + 1) { o.seeti++; this.fx(null, 'seeti', o, o.seeti); }
        if (age >= 3) { this.explode(o, false); alive = false; } else {
          for (const k of this.karts) {
            if (k.remote || (k.id === o.owner && age < 0.6)) continue;
            if (Math.hypot(k.x - o.x, k.z - o.z) < 1.7 && Math.abs(k.y - o.y) < 2) { this.explode(o, true); alive = false; break; }
          }
        }
      } else if (o.type === 'paan') {
        o.life -= dt;
        if (o.life <= 0) alive = false;
        for (const k of this.karts) {
          if (!alive) break;
          if (k.remote || k.air || (k.id === o.owner && now - o.t0 < 0.8)) continue;
          if (Math.hypot(k.x - o.x, k.z - o.z) < o.r + 0.5 && Math.abs(k.y - o.y) < 1.5) { alive = false; this.hit(k, 'paan', o.owner, o.id); }
        }
      } else if (o.type === 'cow') {
        o.life -= dt;
        if (o.life <= 0) alive = false;
        o.x += Math.cos(o.h) * 0.5 * dt; o.z += Math.sin(o.h) * 0.5 * dt;
        for (const k of this.karts) {
          if (k.remote || k.cool.cow > 0 || (k.id === o.owner && now - o.t0 < 1)) continue;
          if (this.cowCheck(k, o.x, o.z, o.r, 'gaay')) this.fx(k, 'gaayhit', o.owner);
        }
      }
      if (alive) keep.push(o); else { this.gone.add(o.id); if (o.type !== 'cooker') this.fx(null, 'gone', o); }
    }
    this.objs = keep;
  }
}

const NO_INPUT = { steer: 0, drift: false, use: false };

// Physics for one kart we own.
export function stepKart(k, inp, W, dt) {
  const T = W.track, st = k.stats, loc = W._loc;
  for (const c in k.cool) if (k.cool[c] > 0) k.cool[c] -= dt;
  k.boostT = Math.max(0, k.boostT - dt / (st.ppali || 1)); // Jihye's boosts run down slower
  if (k.boostT === 0) k.boostP = 1;
  k.spinT = Math.max(0, k.spinT - dt);
  k.shieldT = Math.max(0, k.shieldT - dt);
  k.rocketT = Math.max(0, k.rocketT - dt);
  k.wobbleT = Math.max(0, k.wobbleT - dt);
  k.hopT = Math.max(0, k.hopT - dt);
  if (k.rollT > 0) {
    k.rollT -= dt;
    if (k.rollT <= 0) { k.item = k.pending; k.itemN = k.pendingN; k.pending = null; W.fx(k, 'gotitem', k.item); }
  }
  const ctl = k.spinT <= 0;

  let steerIn = ctl ? clamp(inp.steer || 0, -1, 1) : 0;
  if (k.wobbleT > 0) steerIn = clamp(steerIn + Math.sin(W.time * 21) * 0.8, -1, 1);
  k.steer += (steerIn - k.steer) * Math.min(1, dt * (k.drift ? 9 : 13));

  // Drifting: tap DRIFT to hop; land while steering and you slide, charging sparks.
  const press = inp.drift && !k.dHeld;
  k.dHeld = !!inp.drift;
  if (press && ctl && !k.air && k.v > 9 && k.rocketT <= 0) {
    k.air = true; k.vy = 3.4; k.hopT = 0.35;
    if (Math.abs(inp.steer) > 0.2) k.drift = Math.sign(inp.steer);
    W.fx(k, 'hop');
  }
  if (inp.drift && !k.drift && k.hopT > 0 && Math.abs(inp.steer) > 0.2 && ctl) k.drift = Math.sign(inp.steer);
  if (k.drift && (!inp.drift || !ctl || k.v < 7 || k.rocketT > 0)) {
    if (!inp.drift && ctl && k.level > 0) {
      const dur = [0, 0.55, 0.95, 1.4][k.level];
      k.boostP = Math.max(k.boostP, 1.3);
      k.boostT = Math.max(k.boostT, dur);
      k.stats2.turbos++;
      W.fx(k, 'turbo', k.level);
    }
    k.drift = 0; k.charge = 0; k.level = 0;
  }

  // Turning
  const speedK = Math.min(1, k.v / 6);
  let turn;
  if (k.drift) {
    const into = k.drift * k.steer; // +1 = tight, -1 = wide
    turn = k.drift * (1.3 + 0.75 * into) * st.turn;
  } else {
    turn = k.steer * 2.05 * st.turn * speedK * (1 - 0.28 * Math.min(1, k.v / BASE_V));
  }
  if (k.air) turn *= 0.75;
  if (!ctl) turn = 0;
  k.h = wrapPi(k.h + turn * dt);

  if (k.drift && !k.air) {
    k.charge += dt * (0.75 + 0.45 * Math.max(0, k.drift * k.steer)) * (st.charge || 1);
    const lv = k.charge > 2.3 ? 3 : k.charge > 1.4 ? 2 : k.charge > 0.7 ? 1 : 0;
    if (lv > k.level) { k.level = lv; W.fx(k, 'spark', lv); }
  }

  // Speed: always on the gas (phones only have two thumbs).
  let vmax = BASE_V * st.speed * k.rubber;
  if (k.offroad && k.boostT <= 0 && k.rocketT <= 0) vmax *= st.offroad;
  if (k.boostT > 0) vmax *= k.boostP;
  if (k.rocketT > 0) vmax *= 1.55;
  if (k.done) vmax *= 0.6;
  if (!ctl) k.v *= Math.pow(0.18, dt);
  else if (k.v < vmax) {
    const a = k.boostT > 0 || k.rocketT > 0 ? 34 : ACC * st.accel * (1 - 0.55 * (k.v / vmax));
    k.v = Math.min(vmax, k.v + a * dt);
  } else k.v = Math.max(vmax, k.v - (k.offroad ? 30 : 12) * dt);

  const dir = k.h - k.drift * 0.2;
  k.x += (Math.cos(dir) * k.v + k.kx) * dt;
  k.z += (Math.sin(dir) * k.v + k.kz) * dt;
  const damp = Math.pow(0.04, dt);
  k.kx *= damp; k.kz *= damp;

  // Stay inside the street: shop fronts and flyover railings are walls.
  locate(T, k.x, k.z, k.idx, loc);
  k.idx = loc.idx;
  const lim = loc.lim;
  if (Math.abs(loc.d) > lim) {
    const side = Math.sign(loc.d), over = Math.abs(loc.d) - lim;
    k.x -= loc.nx * side * over; k.z -= loc.nz * side * over;
    const kn = k.kx * loc.nx + k.kz * loc.nz;
    if (kn * side > 0) { k.kx -= kn * loc.nx; k.kz -= kn * loc.nz; }
    const rel = wrapPi(k.h - loc.ang);
    if (rel * side < 0) {
      // pointing into the wall: glance off it, losing a bit of speed once per knock
      const hit = Math.min(1, Math.abs(Math.sin(rel)) * 1.8);
      k.h = wrapPi(k.h - rel * 0.5);
      if (k.cool.wall <= 0) {
        k.v *= 1 - 0.3 * hit;
        k.kx -= loc.nx * side * 2.5 * hit; k.kz -= loc.nz * side * 2.5 * hit;
        if (hit > 0.3) { W.fx(k, 'wall', hit); k.stats2.walls++; }
        k.cool.wall = 0.35;
      }
    }
    k.v *= 1 - 0.8 * dt; // scraping along it
    loc.d = side * lim;
  }
  k.d = loc.d;
  k.offroad = Math.abs(loc.d) > HALF_W + KERB * 0.6;

  // Up and down: speed breakers throw you in the air, so does the end of a ramp.
  const gy = loc.y + bumpAt(T, loc.s);
  if (k.air) {
    k.vy -= G * dt;
    k.y += k.vy * dt;
    if (k.y <= gy) {
      if (k.vy < -6) W.fx(k, 'land', -k.vy);
      k.y = gy; k.air = false; k.vy = 0; k.gvy = 0;
    }
  } else {
    const gv = (gy - k.y) / dt;
    if (k.gvy > 1.5 && gv < k.gvy - G * dt) {
      k.air = true; k.vy = Math.min(k.gvy, 5.5); k.y += k.vy * dt; k.gvy = 0;
    } else { k.y = gy; k.gvy = gv; }
  }

  // Speed breakers (the bump does the flying, this is the jolt and the commentary)
  for (const b of T.breakers) {
    if (lapDelta(T, k.lastS, b) > 0 && lapDelta(T, b, loc.s) >= 0 && Math.abs(lapDelta(T, k.lastS, loc.s)) < 10) {
      if (k.boostT <= 0 && k.rocketT <= 0) k.v *= 0.9;
      W.fx(k, 'breaker');
    }
  }
  // Potholes
  if (!k.air && k.cool.hole <= 0) {
    for (const p of T.potholes) {
      const dx = k.x - p.x, dz = k.z - p.z;
      if (dx * dx + dz * dz < (p.r + 0.7) ** 2) {
        if (st.hooves) { k.cool.hole = 0.6; break; } // Lisa's horse just steps over
        if (k.rocketT <= 0) k.v *= 0.72;
        k.cool.hole = 0.6; k.stats2.holes++;
        W.fx(k, 'pothole');
        break;
      }
    }
  }
  // Masala boost strips
  for (const b of T.boosts) {
    const ds = lapDelta(T, b.s, loc.s);
    if (ds >= 0 && ds < b.len && Math.abs(loc.d - b.d) < b.half && !k.air) {
      if (k.cool.strip <= 0) W.fx(k, 'strip');
      k.cool.strip = 0.3;
      k.boostT = Math.max(k.boostT, 1.0); k.boostP = Math.max(k.boostP, 1.32);
    }
  }

  // Progress along the lap (unwrapped, so driving backwards undoes it)
  const ds = lapDelta(T, k.lastS, loc.s);
  k.lastS = loc.s; k.s = loc.s;
  k.P += ds;
  const lap = Math.floor(k.P / T.L);
  if (lap > k.lapMax) {
    k.lapMax = lap;
    if (lap > 0 && lap < W.laps && !k.done) W.fx(k, 'lap', lap + 1);
  }
  if (!k.done && k.P >= W.laps * T.L) {
    k.done = true;
    k.finishT = W.time;
    W.out({ k: 'fin', u: k.id, t: W.time, st: k.stats2 });
    W.fx(k, 'finish');
  }
  const fwd = Math.cos(k.h - loc.ang);
  k.wrongT = fwd < -0.35 && k.v > 3 && !k.done ? k.wrongT + dt : 0;
  k.visYaw += ((k.drift ? k.drift * 0.45 : 0) - k.visYaw) * Math.min(1, dt * 9);
}

// ---------------------------------------------------------------- bots

// The bot driver. Also drives your own kart while the Diwali rocket is lit, after you
// finish, and in the autopilot test mode.
export function botInput(k, W, out = {}) {
  const T = W.track, dt = DT;
  const ai = k.ai || (k.ai = { lane: k.d || 0, goal: 0, next: 0, itemAt: 0, gotAt: 0, drifting: false, hadItem: null, rs: W.rng() < 0.45 });
  if (W.time < 0) { out.steer = 0; out.use = false; out.drift = ai.rs && W.time > -0.32; return out; }
  if (W.time > ai.next) {
    ai.goal = (W.rng() - 0.5) * 2 * (HALF_W - 2.6);
    ai.next = W.time + 2.5 + W.rng() * 3.5;
  }
  // Look ahead along the road
  let curv = 0;
  for (let j = 4; j < 22; j++) curv += T.CURV[(k.idx + j) % T.N];
  curv /= 18;
  let goal = ai.goal - Math.sign(curv) * Math.min(3.5, Math.abs(curv) * 160);
  // Dodge potholes, cows and traps ahead
  const dodge = (s, d, r) => {
    const ahead = lapDelta(T, k.s, s);
    if (ahead > 2 && ahead < 32 && Math.abs(d - goal) < r) goal = d + (d > 0 ? -r - 0.8 : r + 0.8);
  };
  for (const p of T.potholes) dodge(p.s, p.d, 2.4);
  for (const c of T.sleepers) dodge(c.s, c.d, 3.2);
  for (const c of T.cows) { const p = cowAt(c, W.time + 1); if (Math.abs(p.d) < COW_REACH - 1) dodge(c.s, p.d, 3.4); }
  for (const o of W.objs) if (o.type !== 'chappal') dodge(o.s, o.d, o.type === 'cow' ? 3.4 : 2.6);
  // keep well off the flyover railings
  const narrow = T.lim[(k.idx + 10) % T.N] < HALF_W + 1 || T.lim[k.idx] < HALF_W + 1;
  const room = narrow ? 1.2 : HALF_W - 1.8;
  goal = clamp(goal, -room, room);
  ai.lane += (goal - ai.lane) * Math.min(1, dt * 2.2);

  const la = narrow ? 6 + k.v * 0.3 : 7 + k.v * 0.42;
  const ti = (k.idx + Math.round(la / T.step)) % T.N;
  const tx = T.X[ti] + T.NX[ti] * ai.lane, tz = T.Z[ti] + T.NZ[ti] * ai.lane;
  const want = Math.atan2(tz - k.z, tx - k.x);
  const diff = wrapPi(want - (k.h - k.drift * 0.2));
  out.steer = clamp(diff * 2.6, -1, 1);

  // Drift through the long bends for sparks
  const bend = Math.abs(curv);
  if (!ai.drifting && bend > 0.022 && k.v > 17 && !k.air && k.rocketT <= 0 && W.rng() < 0.05 * k.skill) {
    ai.drifting = true; ai.dir = Math.sign(curv);
  }
  if (ai.drifting) {
    out.drift = true;
    if (!k.drift && k.hopT <= 0 && !k.air) out.steer = ai.dir;
    if ((bend < 0.008 && k.level >= 1) || (k.drift && diff * k.drift < -0.35) || k.v < 9) { ai.drifting = false; out.drift = false; }
  } else out.drift = false;

  // Items
  out.use = false;
  if (k.item !== ai.hadItem) { ai.hadItem = k.item; ai.gotAt = W.time; ai.itemAt = W.time + 0.6 + W.rng() * 1.2; }
  if (k.item && k.rollT <= 0 && W.time > ai.itemAt && !k.done) {
    ai.itemAt = W.time + 0.4 + W.rng() * 0.6;
    const held = W.time - ai.gotAt;
    const near = (lo, hi) => W.karts.some(o => o !== k && !o.done && o.P - k.P > lo && o.P - k.P < hi);
    switch (k.item) {
      case 'chappal': out.use = near(2, 80) || held > 10; break;
      case 'cooker': case 'paan': case 'cow': out.use = near(-30, -3) || held > 7; break;
      case 'horn': out.use = W.karts.some(o => o !== k && Math.hypot(o.x - k.x, o.z - k.z) < 9) || held > 9; break;
      case 'chai': case 'rocket': out.use = bend < 0.012; break;
      default: out.use = true;
    }
  }
  return out;
}

// Keep bot races close: bots far ahead of every human ease off, bots far behind push.
export function rubberBand(W) {
  const humans = W.karts.filter(k => !k.bot);
  if (!humans.length) return;
  let lo = Infinity, hi = -Infinity;
  for (const h of humans) { lo = Math.min(lo, h.P); hi = Math.max(hi, h.P); }
  for (const k of W.karts) {
    if (!k.bot || k.remote) continue;
    const ahead = k.P - hi, behind = lo - k.P;
    let r = k.skill;
    if (ahead > 40) r *= 0.9 - Math.min(0.06, (ahead - 40) / 2000);
    else if (behind > 50) r *= 1.06 + Math.min(0.04, (behind - 50) / 2000);
    k.rubber += (r - k.rubber) * 0.05;
  }
}
