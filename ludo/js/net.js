// How phones talk to each other. Both room types have the same shape:
//   subscribe(cb)  – called with every new game state
//   act(action)    – run an action through the rules (engine.reduce)
//   react(emoji)   – throw an emoji at everyone
// LocalRoom = everybody on one phone. OnlineRoom = Firebase Realtime Database,
// where every action runs inside a transaction so two phones can't clash.

import { reduce, createRoom } from './engine.js';
import { firebaseConfig } from './firebase-config.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const validCode = c => /^[A-Z0-9]{4}$/.test(c || '');

// For local testing against the Firebase emulator: ?emulator=9000 (localhost only).
function emulatorPort() {
  const port = new URLSearchParams(location.search).get('emulator');
  return port && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? Number(port) : 0;
}

export const onlineReady = () => !!(firebaseConfig && firebaseConfig.databaseURL) || !!emulatorPort();

let fbPromise = null;
function firebase() {
  if (!fbPromise) {
    fbPromise = (async () => {
      const appMod = await import('../vendor/firebase-app.js');
      const db = await import('../vendor/firebase-database.js');
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

export class LocalRoom {
  constructor(state, onSave) {
    this.state = state;
    this.code = state.code;
    this.online = false;
    this.subs = [];
    this.rsubs = [];
    this.onSave = onSave;
  }
  get now() { return Date.now(); }
  subscribe(cb) { this.subs.push(cb); cb(this.state); }
  act(a) {
    const next = reduce(this.state, { ...a, at: Date.now() });
    if (!next) return Promise.resolve(false);
    this.state = next;
    if (this.onSave) this.onSave(next);
    this.subs.forEach(cb => cb(next));
    return Promise.resolve(true);
  }
  react(e, uid) { this.rsubs.forEach(cb => cb({ u: uid, e })); }
  onReaction(cb) { this.rsubs.push(cb); }
  presence() {}
  close() { this.subs = []; this.rsubs = []; }
}

export class OnlineRoom {
  constructor(fb, code, uid) {
    this.fb = fb;
    this.code = code;
    this.uid = uid;
    this.online = true;
    this.base = `rooms/${code}`;
    this.stateRef = fb.db.ref(fb.database, `${this.base}/state`);
    this.offs = [];
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
      if (typeof v === 'string') cb(JSON.parse(v));
    }));
  }

  async act(a) {
    const action = { ...a, at: this.now };
    let accepted = false;
    try {
      const res = await this.fb.db.runTransaction(this.stateRef, cur => {
        if (cur === null) return cur; // not loaded yet: Firebase retries with the real value
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

  react(e) {
    const { db } = this.fb;
    db.push(this.ref('reactions'), { u: this.uid, e, t: db.serverTimestamp() }).catch(() => {});
  }

  onReaction(cb) {
    const { db } = this.fb;
    const since = this.now - 1000;
    const q = db.query(this.ref('reactions'), db.orderByChild('t'), db.startAt(since));
    this.offs.push(db.onChildAdded(q, snap => { const v = snap.val(); if (v && v.t >= since) cb(v); }));
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
