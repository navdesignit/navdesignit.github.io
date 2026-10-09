// Alquida Landu — the rules. Pure functions only (no DOM, no network), so the
// exact same code runs on every phone, inside Firebase transactions, and in tests.
//
// A token's position is counted in steps from its own start square:
//   -1 = in the yard, 0–50 = on the shared track, 51–55 = own home lane, 56 = home.
// That's the classic 4-arm board (52 squares). A 5-player game uses a 5-arm
// board (65 squares), so the track runs 0–63 and home is 69. setArms() switches.

import { CHARACTERS, CHAR_IDS, charForName, pickLine, areBesties } from './characters.js';

export const COLORS = ['red', 'green', 'yellow', 'blue', 'pink'];
export const SEATS = { 2: ['red', 'yellow'], 3: ['red', 'green', 'yellow'], 4: ['red', 'green', 'yellow', 'blue'], 5: COLORS };
export const YARD = -1;
export let ARMS = 4;
export let RING = 52;
export let LAST_TRACK = 50;
export let HOME = 56;
export const START = {};
export let SAFE = [];
// shortcut: board size is module state, fine because a page shows one game at a time.
export function setArms(n) {
  ARMS = n; RING = 13 * n; LAST_TRACK = RING - 2; HOME = RING + 4;
  COLORS.forEach((c, i) => { START[c] = 13 * i; });
  SAFE = COLORS.slice(0, n).flatMap((c, i) => [13 * i, 13 * i + 8]);
}
setArms(4);
export const armsOf = s => (s && s.tokens && s.tokens.pink ? 5 : 4);
export const BLAST = 2;
export const MAX_KABOOMS = 3;
export const BOX_COUNT = 3;
export const MAX_PLAYERS = 5;
export const NAME_MAX = 14;
export const TIMERS = [0, 15, 30, 60];

export const BOX_EFFECTS = {
  rocket: { w: 3, icon: '🚀', text: 'Rocket! +5 squares' },
  banana: { w: 3, icon: '🍌', text: 'Banana peel! Slipped back 3' },
  swap: { w: 2, icon: '🌀', text: 'Teleport! Swapped places' },
  shield: { w: 2, icon: '🛡️', text: 'Shield! Untouchable for a round' },
  bonus: { w: 2, icon: '🎲', text: 'Free roll!' },
  sleepy: { w: 2, icon: '💤', text: 'Sleeping pill… skips next turn' },
  recharge: { w: 1, icon: '💣', text: 'Extra KABOOM charge!' },
};

export const square = (color, p) => (START[color] + p) % RING;
export const onTrack = p => p >= 0 && p <= LAST_TRACK;
export const isSafe = sq => SAFE.includes(sq);
const rel = (color, sq) => (sq - START[color] + RING) % RING;
const ring = (a, b) => { const d = Math.abs(a - b) % RING; return Math.min(d, RING - d); };
const key = (c, t) => `${c}:${t}`;
const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

export function createRoom(code, at = 0) {
  return {
    v: 1, code, phase: 'lobby', host: null, seq: 0, createdAt: at,
    settings: { boxes: true, finish: 'first', timer: 30 },
    players: [], tokens: {}, turn: 0, turnNo: 0, dice: null, sixes: 0, movable: [],
    boxes: [], shields: {}, ranks: [], deadline: null, fx: null, log: [],
  };
}

function newPlayer(uid, name, bot) {
  return { uid, name, bot: !!bot, char: null, color: null, kabooms: 1, kills: 0, deaths: 0, boomKills: 0, booms: 0, skip: 0, afk: 0, done: false };
}

export const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
export const current = s => s.players[s.turn];
export const playerByColor = (s, c) => s.players.find(p => p.color === c);
export const isTurn = (s, uid) => (s.phase === 'roll' || s.phase === 'move') && current(s) && current(s).uid === uid;
export const progress = (s, p) => (s.tokens[p.color] || []).reduce((n, x) => n + (x === YARD ? 0 : x + 1), 0);
export const shielded = (s, c, t) => !!s.shields[key(c, t)];

// The real Ajay "owns" Ajay; anyone else holding that character gets bumped.
const owns = (p, id) => !p.bot && charForName(p.name) === id;
function freeChar(s, me) {
  const taken = new Set(s.players.filter(p => p !== me).map(p => p.char));
  return CHAR_IDS.find(id => !taken.has(id));
}
function assignChar(s, me, pref, fx) {
  const holder = id => s.players.find(p => p !== me && p.char === id);
  const own = charForName(me.name);
  if (own && !me.bot) {
    const h = holder(own);
    if (!h) { me.char = own; return; }
    if (!owns(h, own)) {
      me.char = own;
      h.char = freeChar(s, h);
      if (h.bot) h.name = `${CHARACTERS[h.char].name} 🤖`;
      fx.push({ k: 'bumped', uid: h.uid, by: me.uid });
      return;
    }
  }
  if (pref && CHAR_IDS.includes(pref) && !holder(pref)) { me.char = pref; return; }
  if (me.char && !holder(me.char)) return;
  me.char = freeChar(s, me);
}

export function tokensOnTrack(s) {
  const out = [];
  for (const c of Object.keys(s.tokens)) {
    s.tokens[c].forEach((p, t) => { if (onTrack(p)) out.push({ c, t, p, sq: square(c, p) }); });
  }
  return out;
}

export function movable(s, c, dice) {
  const out = [];
  (s.tokens[c] || []).forEach((p, t) => {
    if (p === YARD) { if (dice === 6) out.push(t); } else if (p + dice <= HOME) out.push(t);
  });
  return out;
}

// Tokens sitting on the same spot are the same move — keep one of each.
export function distinctMoves(s, c, opts) {
  const seen = new Set();
  return opts.filter(t => { const p = s.tokens[c][t]; if (seen.has(p)) return false; seen.add(p); return true; });
}

// Enemy tokens a kaboom from token t would take out (shields block, safe squares don't).
export function blastTargets(s, c, t) {
  const pos = s.tokens[c] && s.tokens[c][t];
  if (pos == null || !onTrack(pos)) return [];
  const sq = square(c, pos);
  return tokensOnTrack(s).filter(h => h.c !== c && ring(h.sq, sq) <= BLAST && !shielded(s, h.c, h.t) && !besties(s, c, h.c))
    .map(h => ({ c: h.c, t: h.t, from: h.p }));
}

export function kaboomTokens(s, c) {
  return (s.tokens[c] || []).map((_, t) => t).filter(t => blastTargets(s, c, t).length > 0);
}

export function canKaboom(s, uid) {
  if (s.phase !== 'roll' || !isTurn(s, uid)) return false;
  const p = current(s);
  return p.kabooms > 0 && kaboomTokens(s, p.color).length > 0;
}

function log(s, text) {
  s.log.push(text);
  if (s.log.length > 20) s.log.splice(0, s.log.length - 20);
}

// Player p says a `kind` line, aimed at player `to` when given.
function say(s, fx, p, kind, rng, to, vars) {
  const text = pickLine(p.char, kind, to && to.char, rng, vars);
  if (text) fx.push({ k: 'say', uid: p.uid, text });
}

const besties = (s, c1, c2) => {
  const a = playerByColor(s, c1);
  const b = playerByColor(s, c2);
  return !!(a && b && areBesties(a.char, b.char));
};

// Enemy tokens that token t would knock out by moving to step `to`.
export function victimsAt(s, c, to) {
  if (!onTrack(to)) return [];
  const sq = square(c, to);
  if (isSafe(sq)) return [];
  return tokensOnTrack(s).filter(h => h.sq === sq && h.c !== c && !shielded(s, h.c, h.t));
}

// Who the current player's token t would kill with the dice they just rolled.
export function moveVictims(s, t) {
  const p = current(s);
  if (!p || s.dice == null) return [];
  const from = s.tokens[p.color][t];
  return victimsAt(s, p.color, from === YARD ? 0 : from + s.dice);
}

// At the start of a turn, a player who is one exact roll away from being
// killed taunts the hunter ("4 ni ayega 😌").
function threatTalk(s, fx, rng) {
  const hunter = current(s);
  if (!hunter || !hunter.color) return;
  let best = null;
  for (const h of tokensOnTrack(s)) {
    if (h.c === hunter.color || isSafe(h.sq) || shielded(s, h.c, h.t)) continue;
    const at = rel(hunter.color, h.sq);
    if (at > LAST_TRACK) continue;
    for (const mine of s.tokens[hunter.color]) {
      if (!onTrack(mine) || at <= mine || at - mine > 6) continue;
      if (!best || at - mine < best.n) best = { n: at - mine, victim: playerByColor(s, h.c) };
    }
  }
  if (best) say(s, fx, best.victim, 'threat', rng, hunter, { n: best.n });
}

function setDeadline(s, at) {
  s.deadline = s.settings.timer && at ? at + s.settings.timer * 1000 : null;
}

function spawnBox(s, rng) {
  const busy = new Set(tokensOnTrack(s).map(h => h.sq).concat(s.boxes));
  const free = [];
  for (let sq = 0; sq < RING; sq++) if (!isSafe(sq) && !busy.has(sq)) free.push(sq);
  if (free.length) s.boxes.push(pick(free, rng));
}

function pickEffect(rng) {
  const all = Object.entries(BOX_EFFECTS);
  let r = rng() * all.reduce((n, [, e]) => n + e.w, 0);
  for (const [id, e] of all) { if ((r -= e.w) < 0) return id; }
  return all[0][0];
}

function startTurn(s, i, at) {
  const q = s.players[i];
  s.turn = i; s.turnNo += 1; s.phase = 'roll'; s.dice = null; s.sixes = 0; s.movable = [];
  for (const k of Object.keys(s.shields)) if (k.startsWith(q.color + ':')) delete s.shields[k];
  setDeadline(s, at);
}

function passTurn(s, fx, at) {
  const n = s.players.length;
  let i = s.turn;
  for (let guard = 0; guard < 200; guard++) {
    i = (i + 1) % n;
    const q = s.players[i];
    if (q.done) continue;
    if (q.skip > 0) {
      q.skip -= 1;
      fx.push({ k: 'sleep', uid: q.uid });
      log(s, `💤 ${q.name} is sleeping — turn skipped`);
      continue;
    }
    break;
  }
  if (s.players[i].done) i = s.players.findIndex(q => !q.done);
  startTurn(s, i, at);
}

function extraTurn(s, at) {
  s.phase = 'roll'; s.dice = null; s.movable = [];
  setDeadline(s, at);
}

function finishPlayer(s, p, fx) {
  p.done = true;
  s.ranks.push(p.uid);
  fx.push({ k: 'finish', uid: p.uid, place: s.ranks.length });
  log(s, `🏆 ${p.name} got all tokens home!`);
  const left = s.players.filter(q => !q.done);
  if (s.settings.finish === 'first' || left.length <= 1) {
    left.sort((x, y) => progress(s, y) - progress(s, x)).forEach(q => s.ranks.push(q.uid));
    s.phase = 'over'; s.dice = null; s.movable = []; s.deadline = null;
    fx.push({ k: 'over' });
  }
}

// Token t of player p just arrived somewhere: home check, captures, mystery box.
function land(s, p, t, fx, rng, allowBox) {
  const c = p.color;
  const pos = s.tokens[c][t];
  if (pos === HOME) {
    fx.push({ k: 'home', c, t });
    say(s, fx, p, 'home', rng);
    if (s.tokens[c].every(x => x === HOME)) { finishPlayer(s, p, fx); return { finished: true }; }
    return { extra: true };
  }
  if (!onTrack(pos)) return {};
  const sq = square(c, pos);
  let extra = false;
  if (!isSafe(sq)) {
    let firstVictim = null;
    for (const h of tokensOnTrack(s).filter(h => h.sq === sq && h.c !== c)) {
      if (shielded(s, h.c, h.t)) { fx.push({ k: 'shielded', c: h.c, t: h.t }); continue; }
      s.tokens[h.c][h.t] = YARD;
      const victim = playerByColor(s, h.c);
      victim.deaths += 1; p.kills += 1;
      fx.push({ k: 'kill', c: h.c, t: h.t, from: h.p, by: c, sq });
      log(s, `⚔️ ${p.name} sent ${victim.name} home`);
      if (areBesties(p.char, victim.char)) {
        p.betrayals = (p.betrayals || 0) + 1;
        fx.push({ k: 'betrayal', uid: p.uid, victim: victim.uid });
      }
      firstVictim = firstVictim || victim;
      extra = true;
    }
    if (firstVictim) { say(s, fx, p, 'kill', rng, firstVictim); say(s, fx, firstVictim, 'die', rng, p); }
  }
  if (allowBox && s.boxes.includes(sq)) {
    s.boxes = s.boxes.filter(b => b !== sq);
    const e = pickEffect(rng);
    fx.push({ k: 'box', c, t, e, sq, uid: p.uid });
    log(s, `${BOX_EFFECTS[e].icon} ${p.name}: ${BOX_EFFECTS[e].text}`);
    const r = openBox(s, p, t, e, fx, rng);
    if (s.phase !== 'over') spawnBox(s, rng);
    if (r.finished) return r;
    extra = extra || !!r.extra;
  }
  return { extra };
}

function openBox(s, p, t, e, fx, rng) {
  const c = p.color;
  const from = s.tokens[c][t];
  switch (e) {
    case 'rocket': {
      const to = from + 5;
      if (to > HOME) { fx.push({ k: 'fizzle', uid: p.uid }); return {}; }
      s.tokens[c][t] = to;
      fx.push({ k: 'move', c, t, from, to, fast: true });
      return land(s, p, t, fx, rng, false);
    }
    case 'banana': {
      const to = Math.max(0, from - 3);
      if (to === from) return {};
      s.tokens[c][t] = to;
      fx.push({ k: 'move', c, t, from, to });
      return land(s, p, t, fx, rng, false);
    }
    case 'swap': {
      const mySq = square(c, from);
      const options = tokensOnTrack(s).filter(h => h.c !== c && h.sq !== mySq && !shielded(s, h.c, h.t) &&
        rel(c, h.sq) <= LAST_TRACK && rel(h.c, mySq) <= LAST_TRACK);
      if (!options.length) { fx.push({ k: 'fizzle', uid: p.uid }); return {}; }
      const h = pick(options, rng);
      const to = rel(c, h.sq);
      const to2 = rel(h.c, mySq);
      s.tokens[c][t] = to;
      s.tokens[h.c][h.t] = to2;
      fx.push({ k: 'swap', c, t, from, to, c2: h.c, t2: h.t, from2: h.p, to2 });
      return {};
    }
    case 'shield': s.shields[key(c, t)] = 1; return {};
    case 'bonus': return { extra: true };
    case 'sleepy': p.skip += 1; return {};
    case 'recharge': p.kabooms = Math.min(MAX_KABOOMS, p.kabooms + 1); return {};
    default: return {};
  }
}

function doMove(s, p, t, fx, rng, at) {
  const c = p.color;
  const from = s.tokens[c][t];
  const d = s.dice;
  const to = from === YARD ? 0 : from + d;
  s.tokens[c][t] = to;
  s.movable = [];
  fx.push({ k: 'move', c, t, from, to });
  const r = land(s, p, t, fx, rng, true);
  if (s.phase === 'over') return;
  if (r.finished) return passTurn(s, fx, at);
  if (d === 6 || r.extra) { fx.push({ k: 'extra', uid: p.uid }); return extraTurn(s, at); }
  passTurn(s, fx, at);
}

function doRoll(s, fx, rng, at) {
  const p = current(s);
  const d = 1 + Math.floor(rng() * 6);
  s.dice = d;
  s.sixes = d === 6 ? s.sixes + 1 : 0;
  fx.push({ k: 'dice', c: p.color, d, uid: p.uid });
  if (s.sixes >= 3) {
    fx.push({ k: 'greedy', uid: p.uid });
    log(s, `🐷 ${p.name} rolled three 6s — too greedy!`);
    return passTurn(s, fx, at);
  }
  const opts = movable(s, p.color, d);
  if (!opts.length) {
    fx.push({ k: 'nomove', uid: p.uid });
    if (d === 6) { fx.push({ k: 'extra', uid: p.uid }); return extraTurn(s, at); }
    return passTurn(s, fx, at);
  }
  const uniq = distinctMoves(s, p.color, opts);
  if (uniq.length === 1) return doMove(s, p, uniq[0], fx, rng, at);
  s.phase = 'move';
  s.movable = opts;
  setDeadline(s, at);
}

const HANDLERS = {
  join(s, a, fx) {
    if (s.phase !== 'lobby' || !a.uid) return false;
    const name = cleanName(a.name);
    if (!name) return false;
    let me = s.players.find(p => p.uid === a.uid);
    if (!me) {
      if (s.players.length >= MAX_PLAYERS) return false;
      me = newPlayer(a.uid, name, a.bot);
      s.players.push(me);
      if (!s.host && !me.bot) s.host = me.uid;
      log(s, `👋 ${name} joined`);
    }
    me.name = name;
    assignChar(s, me, a.char, fx);
    fx.push({ k: 'join', uid: me.uid });
  },
  bot(s, a, fx) {
    if (s.phase !== 'lobby' || a.uid !== s.host || s.players.length >= MAX_PLAYERS) return false;
    const me = newPlayer(a.botId || `bot-${s.seq}-${s.players.length}`, 'bot', true);
    s.players.push(me);
    me.char = freeChar(s, me);
    me.name = `${CHARACTERS[me.char].name} 🤖`;
    fx.push({ k: 'join', uid: me.uid });
  },
  pick(s, a) {
    if (s.phase !== 'lobby') return false;
    const me = s.players.find(p => p.uid === a.uid);
    if (!me || !CHAR_IDS.includes(a.char)) return false;
    if (owns(me, me.char)) return false; // your name decides your character
    if (s.players.some(p => p !== me && p.char === a.char)) return false;
    me.char = a.char;
  },
  leave(s, a) {
    if (s.phase !== 'lobby') return false;
    const target = a.target || a.uid;
    if (target !== a.uid && a.uid !== s.host) return false;
    const i = s.players.findIndex(p => p.uid === target);
    if (i < 0) return false;
    s.players.splice(i, 1);
    if (s.host === target) s.host = (s.players.find(p => !p.bot) || {}).uid || null;
  },
  settings(s, a) {
    if (s.phase !== 'lobby' || a.uid !== s.host || !a.settings) return false;
    const n = a.settings;
    if ('boxes' in n) s.settings.boxes = !!n.boxes;
    if (n.finish === 'first' || n.finish === 'all') s.settings.finish = n.finish;
    if (TIMERS.includes(n.timer)) s.settings.timer = n.timer;
  },
  start(s, a, fx, rng) {
    if (s.phase !== 'lobby' || a.uid !== s.host) return false;
    const n = s.players.length;
    if (n < 2) return false;
    s.players.forEach((p, i) => Object.assign(p, newPlayer(p.uid, p.name, p.bot), { char: p.char, color: SEATS[n][i] }));
    setArms(n === 5 ? 5 : 4);
    s.tokens = {};
    s.players.forEach(p => { s.tokens[p.color] = [YARD, YARD, YARD, YARD]; });
    s.ranks = []; s.shields = {}; s.boxes = []; s.turnNo = 0; s.log = [];
    if (s.settings.boxes) for (let i = 0; i < BOX_COUNT; i++) spawnBox(s, rng);
    const first = Math.floor(rng() * n) % n;
    fx.push({ k: 'first', uid: s.players[first].uid });
    log(s, `🎲 ${s.players[first].name} goes first!`);
    startTurn(s, first, a.at);
  },
  roll(s, a, fx, rng) {
    if (s.phase !== 'roll' || !isTurn(s, a.uid)) return false;
    doRoll(s, fx, rng, a.at);
  },
  move(s, a, fx, rng) {
    if (s.phase !== 'move' || !isTurn(s, a.uid) || !s.movable.includes(a.token)) return false;
    doMove(s, current(s), a.token, fx, rng, a.at);
  },
  kaboom(s, a, fx, rng) {
    if (!canKaboom(s, a.uid)) return false;
    const p = current(s);
    const c = p.color;
    const victims = blastTargets(s, c, a.token);
    if (!victims.length) return false;
    const from = s.tokens[c][a.token];
    p.kabooms -= 1; p.booms += 1;
    s.tokens[c][a.token] = YARD;
    for (const v of victims) { s.tokens[v.c][v.t] = YARD; playerByColor(s, v.c).deaths += 1; }
    p.kills += victims.length; p.boomKills += victims.length;
    fx.push({ k: 'kaboom', c, t: a.token, from, sq: square(c, from), victims, uid: p.uid });
    say(s, fx, p, 'kaboom', rng);
    log(s, `💣 KABOOM! ${p.name} blew up and took ${victims.length} with them`);
    passTurn(s, fx, a.at);
  },
  timeout(s, a, fx, rng) {
    if (a.turnNo !== s.turnNo || a.phase !== s.phase || (s.phase !== 'roll' && s.phase !== 'move')) return false;
    const p = current(s);
    p.afk += 1;
    fx.push({ k: 'afk', uid: p.uid });
    log(s, `😴 ${p.name} fell asleep — auto-played`);
    if (s.phase === 'roll') doRoll(s, fx, rng, a.at);
    if (s.phase === 'move' && current(s) === p) doMove(s, p, bestMove(s), fx, rng, a.at);
  },
  rematch(s, a, fx) {
    if (s.phase !== 'over' || a.uid !== s.host) return false;
    Object.assign(s, { phase: 'lobby', tokens: {}, turn: 0, turnNo: 0, dice: null, sixes: 0, movable: [], boxes: [], shields: {}, ranks: [], deadline: null });
    s.players.forEach(p => { p.color = null; p.done = false; });
    fx.push({ k: 'rematch' });
  },
};

// Apply one action. Returns the new state, or null if the action isn't allowed.
// `a.seq` (optional) must match the state the sender was looking at, which stops
// double taps and two phones both auto-playing the same bot turn.
export function reduce(state, a, rng = Math.random) {
  if (!state || !a || !HANDLERS[a.type]) return null;
  if (a.seq != null && a.seq !== state.seq) return null;
  setArms(armsOf(state));
  const s = JSON.parse(JSON.stringify(state));
  s.shields = s.shields || {};
  s.boxes = s.boxes || [];
  s.log = s.log || [];
  const fx = [];
  if (HANDLERS[a.type](s, a, fx, rng) === false) return null;
  if (s.phase === 'roll' && s.turnNo !== state.turnNo && rng() < 0.7) threatTalk(s, fx, rng);
  s.seq += 1;
  s.fx = { seq: s.seq, type: a.type, by: a.uid || null, items: fx };
  return s;
}

// ---- Bot brain (also auto-plays for anyone who falls asleep on the timer) ----

function danger(s, c, sq) {
  if (isSafe(sq)) return false;
  return tokensOnTrack(s).some(h => h.c !== c && rel(h.c, sq) > h.p && rel(h.c, sq) - h.p <= 6);
}

export function bestMove(s) {
  const p = current(s);
  const c = p.color;
  let best = s.movable[0];
  let bestScore = -Infinity;
  for (const t of distinctMoves(s, c, s.movable)) {
    const from = s.tokens[c][t];
    const to = from === YARD ? 0 : from + s.dice;
    let score = to / 20;
    if (to === HOME) score += 60;
    else if (to > LAST_TRACK && from <= LAST_TRACK) score += 30;
    if (from === YARD) score += 45;
    if (onTrack(to)) {
      const sq = square(c, to);
      const victims = victimsAt(s, c, to);
      if (victims.length) score += 80 + victims.reduce((n, h) => n + h.p, 0);
      if (victims.some(h => besties(s, c, h.c))) score -= 200; // besties don't kill each other
      if (isSafe(sq)) score += 12;
      if (s.boxes.includes(sq)) score += 8;
      if (!victims.length && danger(s, c, sq)) score -= 25 + to / 4;
    }
    if (onTrack(from) && danger(s, c, square(c, from))) score += 20 + from / 4;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

export function botAction(s) {
  const p = current(s);
  if (!p) return null;
  if (s.phase === 'roll') {
    if (p.kabooms > 0) {
      for (const t of kaboomTokens(s, p.color)) {
        const victims = blastTargets(s, p.color, t);
        const gain = victims.reduce((n, v) => n + v.from + 8, 0) - s.tokens[p.color][t];
        if (gain >= 25) return { type: 'kaboom', uid: p.uid, token: t, seq: s.seq };
      }
    }
    return { type: 'roll', uid: p.uid, seq: s.seq };
  }
  if (s.phase === 'move') return { type: 'move', uid: p.uid, token: bestMove(s), seq: s.seq };
  return null;
}
