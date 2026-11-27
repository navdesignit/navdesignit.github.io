// The room: who's in, which track, and the race timetable. A pure reducer, like the
// Ludo engine, so online it runs inside a Firebase transaction and two phones can't clash.
// Positions don't live here (they stream separately, many times a second).

import { CHAR_IDS, CHARACTERS } from './riders.js';
import { TRACKS } from './track.js';

export const MAX_PLAYERS = 6;
export const COUNTDOWN_MS = 5200; // from tapping Start to the lights going green

const cleanName = n => String(n || '').replace(/[<>]/g, '').trim().slice(0, 14);

export function createRoom(code, now) {
  return { v: 1, code, created: now, host: null, phase: 'lobby', players: [], settings: { track: 'rajwada', laps: 3, bots: true }, race: null };
}

function isFree(st, ch, uid) {
  return CHAR_IDS.includes(ch) && !st.players.some(p => p.char === ch && p.uid !== uid);
}
function firstFree(st) { return CHAR_IDS.find(c => isFree(st, c, null)) || CHAR_IDS[0]; }

// Everyone racing: the humans, plus bots for the rest of the gang.
export function raceKarts(st, seed = 0.5) {
  const humans = st.players.map(p => ({ id: p.uid, char: p.char, name: p.name, bot: false }));
  const bots = st.settings.bots
    ? CHAR_IDS.filter(c => !st.players.some(p => p.char === c)).map(c => ({ id: `bot-${c}`, char: c, name: CHARACTERS[c].name, bot: true }))
    : [];
  // Bots line up in front, humans at the back: you start by chasing the gang.
  const shuffle = (arr, s) => {
    const a = [...arr];
    let x = Math.floor(s * 1e9) || 1;
    for (let i = a.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) % 2147483648; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  return [...shuffle(bots, seed), ...shuffle(humans, seed + 0.37)];
}

export function reduce(prev, a) {
  if (!prev || !a || !a.type) return null;
  const st = JSON.parse(JSON.stringify(prev));
  const me = st.players.find(p => p.uid === a.uid);
  switch (a.type) {
    case 'join': {
      if (me) {
        me.name = cleanName(a.name) || me.name;
        if (a.char && st.phase !== 'race' && isFree(st, a.char, a.uid)) me.char = a.char;
        return st;
      }
      if (st.players.length >= MAX_PLAYERS) return null;
      const char = a.char && isFree(st, a.char, a.uid) ? a.char : firstFree(st);
      st.players.push({ uid: a.uid, name: cleanName(a.name) || 'Player', char });
      if (!st.host) st.host = a.uid;
      return st;
    }
    case 'leave': {
      if (!me) return null;
      st.players = st.players.filter(p => p.uid !== a.uid);
      if (st.host === a.uid) st.host = st.players[0] ? st.players[0].uid : null;
      return st;
    }
    case 'pick': {
      if (!me || st.phase === 'race' || !isFree(st, a.char, a.uid)) return null;
      me.char = a.char;
      return st;
    }
    case 'settings': {
      if (!me || st.host !== a.uid || st.phase === 'race') return null;
      const s = a.settings || {};
      if (s.track && TRACKS[s.track]) st.settings.track = s.track;
      if ([1, 2, 3, 5].includes(s.laps)) st.settings.laps = s.laps;
      if (typeof s.bots === 'boolean') st.settings.bots = s.bots;
      return st;
    }
    case 'start': {
      if (!me || st.host !== a.uid || st.phase === 'race') return null;
      const karts = raceKarts(st, a.seed == null ? 0.5 : a.seed);
      if (karts.length < 1) return null;
      st.race = {
        id: (st.race ? st.race.id : 0) + 1,
        track: st.settings.track,
        laps: st.settings.laps,
        startAt: (a.at || 0) + COUNTDOWN_MS,
        karts,
        fin: {},
        stats: {},
      };
      st.phase = 'race';
      return st;
    }
    case 'fin': {
      const r = st.race;
      if (st.phase !== 'race' || !r || r.id !== a.race) return null;
      const kart = r.karts.find(k => k.id === a.id);
      if (!kart || r.fin[a.id] != null) return null;
      if (!kart.bot && kart.id !== a.uid) return null; // only you can finish your own race
      r.fin[a.id] = Math.round(Number(a.t) * 1000) / 1000;
      if (a.st && typeof a.st === 'object') {
        const s = {};
        for (const key of ['hits', 'hitBy', 'cows', 'holes', 'turbos', 'items', 'walls']) s[key] = Math.max(0, Math.min(999, Number(a.st[key]) || 0));
        r.stats[a.id] = s;
      }
      if (r.karts.every(k => r.fin[k.id] != null)) st.phase = 'podium';
      return st;
    }
    case 'end': {
      // Everyone human is home (or time's up): place the stragglers by how far they got.
      const r = st.race;
      if (st.phase !== 'race' || !r || r.id !== a.race) return null;
      const est = a.est || {};
      let last = Math.max(0, ...Object.values(r.fin));
      const left = r.karts.filter(k => r.fin[k.id] == null).sort((x, y) => (Number(est[y.id]) || 0) - (Number(est[x.id]) || 0));
      for (const k of left) {
        last += 1 + Math.random();
        r.fin[k.id] = Math.round(last * 1000) / 1000;
        k.dnf = true;
      }
      st.phase = 'podium';
      return st;
    }
    case 'again': {
      if (!me || st.host !== a.uid || st.phase === 'race') return null;
      st.phase = 'lobby';
      return st;
    }
    default:
      return null;
  }
}

// Final order: finishing times, then DNFs.
export function results(st) {
  const r = st && st.race;
  if (!r) return [];
  return r.karts
    .map(k => ({ ...k, t: r.fin[k.id], stats: r.stats[k.id] || {} }))
    .sort((a, b) => (a.dnf === b.dnf ? (a.t ?? 1e9) - (b.t ?? 1e9) : a.dnf ? 1 : -1));
}
