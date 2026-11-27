// How phones talk. The room (who's in, which track, finishing times) is one JSON string
// changed only through transactions running room.js, exactly like the Ludo rooms.
// During a race each phone also streams its kart about 12 times a second to
// race/CODE/k/<id>, and announces items and hits as events under race/CODE/ev.
// Same Firebase database as the Ludo game (ludo/js/firebase-config.js).

import { reduce, createRoom } from './room.js';
import { firebaseConfig } from '../../ludo/js/firebase-config.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const validCode = c => /^[A-Z0-9]{4}$/.test(c || '');

// For local testing against the Firebase emulator: ?emulator=9000 (localhost only).
export function emulatorPort() {
  const port = new URLSearchParams(location.search).get('emulator');
  return port && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? Number(port) : 0;
}
export const onlineReady = () => !!(firebaseConfig && firebaseConfig.databaseURL) || !!emulatorPort();

let fbPromise = null;
function firebase() {
  if (!fbPromise) {
    fbPromise = (async () => {
      const appMod = await import('../../ludo/vendor/firebase-app.js');
      const db = await import('../../ludo/vendor/firebase-database.js');
      const port = emulatorPort();
      const app = appMod.initializeApp(port ? { databaseURL: 'https://demo-alquida-default-rtdb.firebaseio.com', projectId: 'demo-alquida' } : firebaseConfig);
      const database = db.getDatabase(app);
      if (port) db.connectDatabaseEmulator(database, location.hostname, port);
      let offset = 0;
      db.onValue(db.ref(database, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
      return { db, database, now: () => Date.now() + offset };
    })();
    fbPromise.catch(() => { fbPromise = null; });
  }
  return fbPromise;
}

// Everyone on one phone (practice against the bots).
export class LocalRoom {
  constructor(state) {
    this.state = state;
    this.code = state.code;
    this.online = false;
    this.subs = [];
    this.evSubs = [];
  }
  get now() { return Date.now(); }
  subscribe(cb) { this.subs.push(cb); cb(this.state); }
  act(a) {
    const next = reduce(this.state, { ...a, at: Date.now() });
    if (!next) return Promise.resolve(false);
    this.state = next;
    this.subs.forEach(cb => cb(next));
    return Promise.resolve(true);
  }
  sendKart() {}
  onKarts() {}
  sendEvent(ev) { if (ev.k === 'meme') this.evSubs.forEach(cb => cb(ev)); }
  onEvents(cb) { this.evSubs.push(cb); }
  clearRace() { return Promise.resolve(); }
  presence() {}
  close() { this.subs = []; this.evSubs = []; }
}

export class OnlineRoom {
  constructor(fb, code, uid) {
    this.fb = fb;
    this.code = code;
    this.uid = uid;
    this.online = true;
    this.base = `race/${code}`;
    this.stateRef = fb.db.ref(fb.database, `${this.base}/state`);
    this.offs = [];
    this.kartRefs = {};
  }
  get now() { return this.fb.now(); }
  ref(path) { return this.fb.db.ref(this.fb.database, `${this.base}/${path}`); }

  static async create(uid, name, char) {
    const fb = await firebase();
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const room = new OnlineRoom(fb, code, uid);
      const first = reduce(createRoom(code, fb.now()), { type: 'join', uid, name, char });
      const res = await fb.db.runTransaction(room.stateRef, cur => (cur === null ? JSON.stringify(first) : undefined), { applyLocally: false });
      if (res.committed) return room;
    }
    throw new Error('Could not create a room, try again');
  }

  static async open(code, uid) {
    const fb = await firebase();
    const room = new OnlineRoom(fb, code, uid);
    const snap = await fb.db.get(room.stateRef);
    return snap.exists() ? room : null;
  }

  subscribe(cb) {
    this.offs.push(this.fb.db.onValue(this.stateRef, snap => {
      const v = snap.val();
      if (typeof v === 'string') { try { cb(JSON.parse(v)); } catch (e) { /* ignore */ } }
    }));
  }

  async act(a) {
    const action = { ...a, at: this.now };
    let accepted = false;
    try {
      const res = await this.fb.db.runTransaction(this.stateRef, cur => {
        if (cur === null) return cur;
        const next = reduce(JSON.parse(cur), action);
        accepted = !!next;
        return next ? JSON.stringify(next) : undefined;
      }, { applyLocally: false });
      return res.committed && accepted;
    } catch (e) {
      console.warn('action failed', e);
      return false;
    }
  }

  // Positions: a short comma-separated string per kart, overwritten each time.
  sendKart(id, str) {
    const r = this.kartRefs[id] || (this.kartRefs[id] = this.ref(`k/${id}`));
    this.fb.db.set(r, str).catch(() => {});
  }
  onKarts(cb) {
    const { db } = this.fb;
    const k = this.ref('k');
    const fn = snap => { const v = snap.val(); if (typeof v === 'string') cb(snap.key, v); };
    this.offs.push(db.onChildAdded(k, fn), db.onChildChanged(k, fn));
  }

  sendEvent(ev) { this.fb.db.push(this.ref('ev'), ev).catch(() => {}); }
  onEvents(cb) {
    const { db } = this.fb;
    this.offs.push(db.onChildAdded(this.ref('ev'), snap => { const v = snap.val(); if (v) cb(v); }));
  }

  // The host wipes the last race's positions and events before a new one starts.
  clearRace() {
    const { db } = this.fb;
    return Promise.all([db.remove(this.ref('k')), db.remove(this.ref('ev'))]).catch(() => {});
  }

  presence(onChange) {
    const { db, database } = this.fb;
    this.meRef = this.ref(`presence/${this.uid}`);
    this.offs.push(db.onValue(db.ref(database, '.info/connected'), s => {
      if (s.val() === true) {
        db.onDisconnect(this.meRef).remove();
        db.set(this.meRef, true);
      }
    }));
    this.offs.push(db.onValue(this.ref('presence'), s => onChange(Object.keys(s.val() || {}))));
  }

  close() {
    this.offs.forEach(off => off());
    this.offs = [];
    if (this.meRef) this.fb.db.remove(this.meRef).catch(() => {});
  }
}

// ---------------------------------------------------------------- kart snapshots

// [race, senderMs, x, z, y, h, v, P, flags, steer, yaw] packed as a string.
export function packKart(race, t, k, flags) {
  return [race, Math.round(t), k.x.toFixed(2), k.z.toFixed(2), k.y.toFixed(2), k.h.toFixed(3), k.v.toFixed(1), k.P.toFixed(1), flags, k.steer.toFixed(2), k.visYaw.toFixed(2)].join(',');
}
export function unpackKart(str) {
  const a = str.split(',').map(Number);
  if (a.length < 11 || a.some(n => !Number.isFinite(n))) return null;
  return { r: a[0], t: a[1], x: a[2], z: a[3], y: a[4], h: a[5], v: a[6], P: a[7], f: a[8], steer: a[9], yaw: a[10] };
}

const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

// Smooth playback of someone else's kart: buffer the snapshots, draw them a little
// in the past and interpolate along their velocity (Hermite), and predict ahead
// from the last one if a packet is late. Clock differences between phones are
// learned from how quickly snapshots arrive, so no clock sync is needed.
export class RemoteKart {
  constructor() {
    this.buf = [];
    this.off = null;
    this.jit = 25;
    this.gap = 80;
    this.delay = 120;
    this.pose = null;
    this.lastRecv = 0;
    this.stats = { n: 0, extrap: 0 };
  }
  push(s, recv) {
    const o = recv - s.t;
    if (this.off === null || o < this.off) this.off = o;
    else this.off += (o - this.off) * 0.003;
    const lag = o - this.off;
    this.jit += (lag - this.jit) * 0.08;
    const prev = this.buf[this.buf.length - 1];
    if (prev && s.t <= prev.t) return; // old or duplicate
    if (prev && s.t - prev.t < 1000) this.gap += (s.t - prev.t - this.gap) * 0.1;
    // draw far enough in the past that the next snapshot has usually arrived
    this.delay = Math.max(95, Math.min(380, this.gap + 1.6 * this.jit + 20));
    s.mh = s.h - (s.f & 1 ? -1 : s.f & 2 ? 1 : 0) * 0.2;
    this.buf.push(s);
    if (this.buf.length > 40) this.buf.shift();
    this.lastRecv = recv;
    this.stats.n++;
  }
  // Pose at local time `now` (ms), smoothed into `out`.
  sample(now, dt, out) {
    const B = this.buf;
    if (!B.length) return null;
    const tr = now - this.off - this.delay;
    let p;
    if (tr <= B[0].t) p = { ...B[0] };
    else if (tr >= B[B.length - 1].t) {
      const a = B[B.length - 1], prev = B[B.length - 2];
      const e = Math.min(tr - a.t, 350) / 1000;
      let w = 0;
      if (prev && a.t > prev.t) w = wrapPi(a.h - prev.h) / ((a.t - prev.t) / 1000);
      w = Math.max(-3, Math.min(3, w));
      const hm = a.mh + w * e * 0.5;
      p = { ...a, x: a.x + Math.cos(hm) * a.v * e, z: a.z + Math.sin(hm) * a.v * e, h: a.h + w * e };
      if (tr - a.t > 30) this.stats.extrap++;
    } else {
      let i = B.length - 2;
      while (i > 0 && B[i].t > tr) i--;
      const a = B[i], b = B[i + 1];
      const span = (b.t - a.t) / 1000;
      const u = (tr - a.t) / (b.t - a.t);
      const u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      const vax = Math.cos(a.mh) * a.v * span, vaz = Math.sin(a.mh) * a.v * span;
      const vbx = Math.cos(b.mh) * b.v * span, vbz = Math.sin(b.mh) * b.v * span;
      const big = Math.hypot(b.x - a.x, b.z - a.z) > a.v * span * 2 + 3; // a teleport or a bounce: don't curve
      p = {
        ...(u < 0.5 ? a : b),
        x: big ? a.x + (b.x - a.x) * u : h00 * a.x + h10 * vax + h01 * b.x + h11 * vbx,
        z: big ? a.z + (b.z - a.z) * u : h00 * a.z + h10 * vaz + h01 * b.z + h11 * vbz,
        y: a.y + (b.y - a.y) * u,
        h: a.h + wrapPi(b.h - a.h) * u,
        v: a.v + (b.v - a.v) * u,
        P: a.P + (b.P - a.P) * u,
        steer: a.steer + (b.steer - a.steer) * u,
        yaw: a.yaw + (b.yaw - a.yaw) * u,
      };
    }
    if (!this.pose) this.pose = { ...p };
    else {
      const k = 1 - Math.exp(-dt * 28);
      const q = this.pose;
      if (Math.hypot(p.x - q.x, p.z - q.z) > 12) { Object.assign(q, p); }
      else {
        q.x += (p.x - q.x) * k; q.z += (p.z - q.z) * k; q.y += (p.y - q.y) * k;
        q.h += wrapPi(p.h - q.h) * k;
        q.v = p.v; q.P = p.P; q.f = p.f; q.steer = p.steer; q.yaw = p.yaw; q.mh = p.mh; q.r = p.r;
      }
    }
    return Object.assign(out || {}, this.pose);
  }
}
