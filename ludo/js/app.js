// Alquida Landu — screens, controls and effects. Game rules live in engine.js.

import {
  createRoom, reduce, current, canKaboom, kaboomTokens, blastTargets, botAction, cleanName, moveVictims, playerByColor,
  BOX_EFFECTS, TIMERS, MAX_PLAYERS, square, isTurn,
} from './engine.js';
import { CHARACTERS, CHAR_IDS, charForName, avatar, areBesties } from './characters.js';
import { Board, TEAM, squareCenter } from './board.js';
import { LocalRoom, OnlineRoom, onlineReady, validCode } from './net.js';
import { sfx, buzz, unlock, isMuted, setMuted } from './sound.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const params = new URLSearchParams(location.search);
const SPEED = Math.max(1, Number(params.get('speed')) || 1); // tests play fast
const sleep = ms => new Promise(r => setTimeout(r, ms / SPEED));

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

const S = {
  me: store.get('al_uid', null),
  mode: null,          // 'local' | 'online'
  room: null,
  state: null,         // newest state received
  shown: null,         // state currently on screen
  queue: [],
  pumping: false,
  aiming: false,
  sentSeq: -1,
  seenSeq: -1,
  seenAt: 0,
  idleAt: 0,
  online: new Set(),
  profileMode: null,   // 'create' | 'join'
  pickChar: null,
  seats: null,
};
if (!S.me) { S.me = 'u' + Math.random().toString(36).slice(2, 10); store.set('al_uid', S.me); }

const board = new Board($('#board'), { onTap: onTokenTap });
board.speed = SPEED;

// ---------------------------------------------------------------- helpers

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  S.screen = id;
  document.body.dataset.screen = id;
}

function player(st, uid) { return (st && st.players.find(p => p.uid === uid)) || null; }
function nameOf(uid, st = S.shown || S.state) { const p = player(st, uid); return p ? esc(p.name) : '?'; }
function face(p, size) { return avatar(p.char, { bg: p.color ? TEAM[p.color] : undefined, size }); }

// Whose buttons are live on this phone? Online: only mine. Local: any human's turn.
function controls(st) {
  if (!st || (st.phase !== 'roll' && st.phase !== 'move')) return null;
  const cur = current(st);
  if (!cur || cur.bot) return null;
  if (S.mode === 'online' && cur.uid !== S.me) return null;
  return cur;
}

function toast(html, ms = 2300) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

function sayBubble(uid, text) {
  const p = player(S.state, uid);
  if (!p) return;
  const el = document.createElement('div');
  el.className = 'say';
  el.style.setProperty('--c', TEAM[p.color] || '#8A4FFF');
  el.innerHTML = `${face(p)}<div><b>${esc(p.name)}</b><span>${esc(text)}</span></div>`;
  const box = $('#says');
  box.appendChild(el);
  while (box.children.length > 2) box.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

let bannerTimer = 0;
async function banner(html, cls = '', ms = 1300) {
  const el = $('#banner');
  el.className = `banner on ${cls}`;
  el.innerHTML = html;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.className = 'banner'; }, ms / SPEED);
  await sleep(Math.min(ms, 900));
}

function info(html) {
  $('#info-body').innerHTML = html;
  openModal('modal-info');
}

function openModal(id) { $(`#${id}`).hidden = false; }
function closeModal(id) { $(`#${id}`).hidden = true; }

function loading(text) {
  $('#loading').hidden = !text;
  if (text) $('#loading-text').textContent = text;
}

function shareUrl(code) { return `${location.origin}${location.pathname}?room=${code}`; }

function setUrl(code) {
  const url = code ? `${location.pathname}?room=${code}${params.get('emulator') ? `&emulator=${params.get('emulator')}` : ''}` : location.pathname + (params.get('emulator') ? `?emulator=${params.get('emulator')}` : '');
  history.replaceState(null, '', url);
}

// Keep the screen awake during a game (supported on Android + iOS 16.4+).
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (S.screen === 'game') keepAwake(true); });

// ---------------------------------------------------------------- home

function renderParade() {
  $('#parade').innerHTML = CHAR_IDS.map((id, i) =>
    `<div class="parade-item" style="--i:${i}">${avatar(id)}<span>${CHARACTERS[id].name}</span></div>`).join('');
}

function refreshHome() {
  const saved = store.get('al_local', null);
  $('#btn-resume').hidden = !(saved && saved.phase !== 'over' && saved.phase !== 'lobby');
  $('#code-input').value = '';
}

function goHome() {
  if (S.room) S.room.close();
  Object.assign(S, { room: null, mode: null, state: null, shown: null, queue: [], aiming: false });
  closeModal('modal-results');
  keepAwake(false);
  setUrl(null);
  refreshHome();
  show('home');
}

// ---------------------------------------------------------------- profile (online)

function openProfile(mode) {
  S.profileMode = mode;
  $('#profile-title').textContent = mode === 'create' ? 'Create a room' : `Join room ${S.room ? S.room.code : ''}`;
  $('#name-input').value = store.get('al_name', '');
  S.pickChar = store.get('al_char', null);
  renderProfile();
  show('profile');
}

function takenChars() {
  const st = S.profileMode === 'join' ? S.state : null;
  const out = {};
  if (st) for (const p of st.players) if (p.uid !== S.me) out[p.char] = p;
  return out;
}

function renderProfile() {
  const name = cleanName($('#name-input').value);
  const own = charForName(name);
  const taken = takenChars();
  const ownerHere = own && taken[own] && charForName(taken[own].name) === own && !taken[own].bot;
  let chosen = S.pickChar;
  if (own && !ownerHere) chosen = own;
  if (!chosen || (taken[chosen] && chosen !== own)) chosen = CHAR_IDS.find(id => !taken[id]);
  S.resolvedChar = chosen;
  $('#char-grid').innerHTML = CHAR_IDS.map(id => {
    const c = CHARACTERS[id];
    const t = taken[id];
    const lock = own && !ownerHere && id !== own;
    return `<button class="char-card ${id === chosen ? 'sel' : ''} ${t ? 'taken' : ''} ${lock ? 'locked' : ''}" data-char="${id}" style="--a:${c.accent}" ${t || lock ? 'disabled' : ''}>
      ${avatar(id)}<b>${c.name}</b><small>${t ? `taken by ${esc(t.name)}` : `${c.emoji} ${c.title}`}</small></button>`;
  }).join('');
  const hint = $('#char-hint');
  if (own && !ownerHere) hint.innerHTML = `${CHARACTERS[own].emoji} That's you! You're <b>${CHARACTERS[own].name}</b>.`;
  else if (own && ownerHere) hint.innerHTML = `🤔 ${esc(taken[own].name)} is already ${CHARACTERS[own].name}. Pick someone else!`;
  else hint.innerHTML = 'Type <b>Ajay</b>, <b>Nav</b>, <b>Chechu</b>, <b>Vanshika</b> or <b>Liu</b> to become that character, or pick one below.';
  hint.classList.toggle('yay', !!(own && !ownerHere));
  $('#btn-profile-go').disabled = !name;
}

async function profileGo() {
  const name = cleanName($('#name-input').value);
  if (!name) return;
  store.set('al_name', name);
  store.set('al_char', S.resolvedChar);
  if (S.profileMode === 'create') {
    loading('Creating room…');
    try {
      const room = await withTimeout(OnlineRoom.create(S.me, name, S.resolvedChar));
      setUrl(room.code);
      attachRoom(room, 'online');
    } catch (e) {
      info(explain(e, "Couldn't create a room"));
    }
    loading(null);
  } else {
    loading('Joining…');
    const ok = await S.room.act({ type: 'join', uid: S.me, name, char: S.resolvedChar });
    loading(null);
    if (!ok) toast('😕 Could not join — the room may be full or already playing.');
  }
}

// ---------------------------------------------------------------- local setup

function seatDefaults() {
  const last = store.get('al_name', '');
  return [{ name: last || '', bot: false }, { name: '', bot: false }];
}

// Run the seats through the real rules so the screen shows who gets which face.
function previewLocal() {
  let st = createRoom('LOCAL');
  S.seats.forEach((seat, i) => {
    if (seat.bot) return;
    st = reduce(st, { type: 'join', uid: `p${i}`, name: seat.name || `Player ${i + 1}`, char: seat.char }) || st;
  });
  S.seats.forEach((seat, i) => {
    if (seat.bot) st = reduce(st, { type: 'bot', uid: st.host, botId: `p${i}` }) || st;
  });
  return st;
}

function renderLocal() {
  const st = previewLocal();
  $('#seats').innerHTML = S.seats.map((seat, i) => {
    const p = player(st, `p${i}`);
    const id = p ? p.char : 'nav';
    const locked = !seat.bot && charForName(seat.name) === id;
    return `<div class="seat" data-i="${i}">
      <button class="seat-face" data-cycle="${i}" ${locked || seat.bot ? 'disabled' : ''} aria-label="Change character">${avatar(id)}${locked ? '<i>🔒</i>' : ''}</button>
      ${seat.bot ? `<div class="seat-name bot">${esc(p ? p.name : 'Bot')}</div>` :
        `<input class="seat-name" data-name="${i}" maxlength="14" placeholder="Player ${i + 1} name" value="${esc(seat.name)}">`}
      ${S.seats.length > 2 ? `<button class="icon-btn small" data-remove="${i}" aria-label="Remove">✕</button>` : ''}
    </div>`;
  }).join('');
  $('#btn-add-human').disabled = $('#btn-add-bot').disabled = S.seats.length >= MAX_PLAYERS;
  $('#btn-local-start').disabled = !S.seats.some(s => !s.bot);
  renderSettings($('#local-settings'), S.localSettings, true, false, v => { Object.assign(S.localSettings, v); renderLocal(); });
}

function startLocal(saved) {
  let st = saved;
  if (!st) {
    st = previewLocal();
    st = reduce(st, { type: 'settings', uid: st.host, settings: { ...S.localSettings, timer: 0 } });
    st = reduce(st, { type: 'start', uid: st.host, at: Date.now() });
    store.set('al_name', cleanName(S.seats[0].name) || store.get('al_name', ''));
  }
  const room = new LocalRoom(st, s => store.set('al_local', s));
  store.set('al_local', st);
  attachRoom(room, 'local');
}

// ---------------------------------------------------------------- settings widget

function renderSettings(el, settings, editable, showTimer, onChange) {
  const opt = (key, val, label) => `<button class="seg ${settings[key] === val ? 'on' : ''}" data-k="${key}" data-v='${JSON.stringify(val)}' ${editable ? '' : 'disabled'}>${label}</button>`;
  el.innerHTML = `
    <div class="setting"><span>❓ Mystery boxes</span><div class="segs">${opt('boxes', true, 'On')}${opt('boxes', false, 'Off')}</div></div>
    <div class="setting"><span>🏁 Game ends</span><div class="segs">${opt('finish', 'first', 'First home wins')}${opt('finish', 'all', 'Play till the last')}</div></div>
    ${showTimer ? `<div class="setting"><span>⏱️ Turn timer</span><div class="segs">${TIMERS.map(t => opt('timer', t, t ? `${t}s` : 'Off')).join('')}</div></div>` : ''}`;
  el.onclick = e => {
    const b = e.target.closest('.seg');
    if (!b || b.disabled) return;
    onChange({ [b.dataset.k]: JSON.parse(b.dataset.v) });
  };
}

// ---------------------------------------------------------------- lobby

function renderLobby(st) {
  const code = st.code;
  const url = shareUrl(code);
  $('#lobby-code').textContent = code;
  $('#share-link').textContent = url.replace(/^https?:\/\//, '');
  $('#btn-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`💣 Join my Alquida Landu game! ${url}`)}`;
  const host = st.host === S.me;
  const slots = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const p = st.players[i];
    if (!p) { slots.push('<div class="lp empty"><div class="lp-face">?</div><div><b>Waiting…</b><small>Share the link!</small></div></div>'); continue; }
    const online = p.bot || S.online.has(p.uid);
    const canPick = p.uid === S.me && !(charForName(p.name) === p.char);
    slots.push(`<div class="lp ${p.uid === S.me ? 'me' : ''}" style="--a:${CHARACTERS[p.char].accent}">
      <button class="lp-face" ${canPick ? 'data-repick' : 'disabled'} aria-label="Change character">${avatar(p.char)}</button>
      <div><b>${esc(p.name)}${p.uid === S.me ? ' (you)' : ''}</b><small>${CHARACTERS[p.char].emoji} ${CHARACTERS[p.char].title}${st.host === p.uid ? ' · 👑 host' : ''}</small></div>
      <span class="dot ${online ? 'on' : ''}"></span>
      ${host && p.bot ? `<button class="icon-btn small" data-kick="${esc(p.uid)}" aria-label="Remove bot">✕</button>` : ''}
    </div>`);
  }
  $('#lobby-players').innerHTML = slots.join('');
  $('#lobby-host-tools').hidden = !host || st.players.length >= MAX_PLAYERS;
  renderSettings($('#lobby-settings'), st.settings, host, true, v => S.room.act({ type: 'settings', uid: S.me, settings: v }));
  $('#btn-lobby-start').hidden = !host;
  $('#btn-lobby-start').disabled = st.players.length < 2;
  $('#btn-lobby-start').textContent = st.players.length < 2 ? 'Need at least 2 players' : `Start game (${st.players.length} players) 🎲`;
  $('#lobby-wait').hidden = host;
}

async function share() {
  const url = shareUrl(S.room.code);
  const data = { title: 'Alquida Landu 💣', text: `Join my Alquida Landu game! Room ${S.room.code}`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  copyLink();
}

async function copyLink() {
  const url = shareUrl(S.room.code);
  try { await navigator.clipboard.writeText(url); toast('📋 Link copied!'); } catch (e) { info(`<p>Copy this link:</p><p class="share-link">${esc(url)}</p>`); }
}

// ---------------------------------------------------------------- room plumbing

function attachRoom(room, mode) {
  if (S.room && S.room !== room) S.room.close();
  Object.assign(S, { room, mode, state: null, shown: null, queue: [], aiming: false, sentSeq: -1 });
  S.presenceReady = false;
  room.presence(list => { S.online = new Set(list); S.presenceReady = true; if (S.state) refreshPlayers(S.state); });
  room.onReaction(r => floatEmoji(r.e, r.u));
  room.subscribe(st => {
    S.state = st;
    if (st.seq !== S.seenSeq) { S.seenSeq = st.seq; S.seenAt = Date.now(); }
    S.queue.push(st);
    pump();
  });
}

function refreshPlayers(st) {
  if (S.screen === 'lobby' && st.phase === 'lobby') renderLobby(st);
  if (S.screen === 'game' && S.shown) renderChips(S.shown);
}

async function pump() {
  if (S.pumping) return;
  S.pumping = true;
  try {
    while (S.queue.length) {
      const st = S.queue.shift();
      const fast = S.queue.length > 2 || document.hidden;
      await present(st, fast);
    }
  } finally {
    S.pumping = false;
    S.idleAt = Date.now();
  }
}

async function present(st, fast) {
  const prev = S.shown;
  if (st.phase === 'lobby') {
    S.shown = st;
    closeModal('modal-results');
    const mine = player(st, S.me);
    if (S.mode === 'online' && !mine) {
      if (S.screen !== 'profile') openProfile('join');
      else renderProfile();
      return;
    }
    if (S.mode === 'local') return;
    show('lobby');
    renderLobby(st);
    return;
  }

  if (S.screen !== 'game') {
    show('game');
    keepAwake(true);
    if (S.mode === 'online' && !player(st, S.me)) toast('👀 Game in progress — you are watching');
  }
  board.setPlayers(st.players);
  const animate = !fast && prev && prev.phase !== 'lobby' && st.fx && st.fx.seq === prev.seq + 1;
  if (prev && prev.phase === 'lobby' && st.fx) await playFx(st, prev, true);
  else if (animate) { renderControls(st, true); await playFx(st, prev, false); }
  S.shown = st;
  board.layout(st);
  renderChips(st);
  renderControls(st);
  const turnChanged = !prev || prev.phase === 'lobby' || (current(prev) && current(prev).uid) !== (current(st) && current(st).uid);
  if (S.mode === 'online' && turnChanged && controls(st)) { sfx('turn'); buzz(60); }
  if (st.phase === 'over' && (!prev || prev.phase !== 'over')) showResults(st);
}

// ---------------------------------------------------------------- effects

async function playFx(st, prev, intro) {
  if (intro) { board.layout(st); renderChips(st); }
  for (const f of st.fx.items) {
    switch (f.k) {
      case 'first':
        await banner(`🎲 <b>${nameOf(f.uid, st)}</b> goes first!`, '', 1500);
        sfx('turn');
        break;
      case 'dice':
        await rollDice(f.d, f.c);
        if (f.d === 6) { sfx('six'); }
        break;
      case 'move':
        await board.walk(f.c, f.t, f.from, f.to, { fast: f.fast, onStep: () => sfx('step') });
        break;
      case 'kill':
        sfx('kill'); buzz(90);
        board.pop(f.sq, '💥');
        await board.flyHome(f.c, f.t);
        break;
      case 'shielded':
        toast('🛡️ Shield blocked the attack!');
        break;
      case 'box': {
        const e = BOX_EFFECTS[f.e];
        sfx('box');
        board.pop(f.sq, '🎁');
        await banner(`<span class="big-emoji">${e.icon}</span><b>${e.text}</b><small>${nameOf(f.uid, st)} opened a mystery box</small>`, 'box', 1500);
        break;
      }
      case 'swap':
        sfx('pop');
        await Promise.all([board.walkFly(f.c, f.t, f.to), board.walkFly(f.c2, f.t2, f.to2)]);
        break;
      case 'betrayal':
        sfx('sad'); buzz([60, 40, 60]);
        await banner(`<span class="big-emoji">💔</span><b>BETRAYAL!</b><small>${nameOf(f.uid, st)} killed bestie ${nameOf(f.victim, st)}</small>`, 'box', 1600);
        break;
      case 'fizzle':
        toast('💨 …but nothing happened');
        break;
      case 'home':
        sfx('home'); buzz(40);
        confetti(14);
        break;
      case 'kaboom':
        await kaboomFx(f, st);
        break;
      case 'say':
        sayBubble(f.uid, f.text);
        break;
      case 'greedy':
        sfx('sad');
        await banner(`<span class="big-emoji">🐷</span><b>Three 6s!</b><small>${nameOf(f.uid, st)} got too greedy — turn over</small>`, 'box', 1500);
        break;
      case 'nomove':
        toast(`😅 No moves for ${nameOf(f.uid, st)}`);
        await sleep(450);
        break;
      case 'sleep':
        toast(`💤 ${nameOf(f.uid, st)} is asleep — turn skipped`);
        await sleep(400);
        break;
      case 'afk':
        toast(`😴 ${nameOf(f.uid, st)} fell asleep… auto-playing`);
        break;
      case 'finish':
        sfx('win');
        confetti(40);
        await banner(`<span class="big-emoji">🏆</span><b>${nameOf(f.uid, st)} is home!</b><small>${ordinal(f.place)} place</small>`, 'box', 1800);
        break;
      default:
        break;
    }
  }
}

async function kaboomFx(f, st) {
  const k = `${f.c}:${f.t}`;
  const el = board.els.get(k);
  if (el) el.classList.add('fuse');
  sfx('pop');
  await sleep(550);
  if (el) el.classList.remove('fuse');
  sfx('kaboom'); buzz([120, 60, 250]);
  const game = $('#game');
  game.classList.remove('shake'); void game.offsetWidth; game.classList.add('shake');
  banner(`<span class="kaboom-text">KABOOM!</span><small>${nameOf(f.uid, st)} took ${f.victims.length} with them 💀</small>`, 'kaboom', 1700);
  await board.boom(f.sq, true);
  await Promise.all([board.flyHome(f.c, f.t, 650), ...f.victims.map(v => board.flyHome(v.c, v.t, 650))]);
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function setDice(d, color) {
  const dice = $('#dice');
  dice.style.setProperty('--c', color ? TEAM[color] : '#8A4FFF');
  dice.classList.toggle('blank', !d);
  $$('.pips i', dice).forEach((pip, i) => pip.classList.toggle('on', !!d && PIPS[d].includes(i)));
}

async function rollDice(d, c) {
  const dice = $('#dice');
  sfx('roll');
  dice.classList.add('rolling');
  const t0 = Date.now();
  while (Date.now() - t0 < 520 / SPEED) {
    setDice(1 + Math.floor(Math.random() * 6), c);
    await sleep(70);
  }
  dice.classList.remove('rolling');
  setDice(d, c);
  dice.classList.add('landed');
  setTimeout(() => dice.classList.remove('landed'), 300);
  await sleep(320);
}

function confetti(n) {
  const box = $('#floaters');
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = ['#FFC93C', '#FF4FA3', '#4DA3FF', '#33CA7F', '#FF6B35'][i % 5];
    el.style.animationDelay = `${Math.random() * 0.3}s`;
    el.style.setProperty('--x', `${(Math.random() - 0.5) * 120}px`);
    box.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}

const EMOJIS = ['😂', '😭', '🔥', '💀', '🤡', '🙏', '😡', '👋', '🐢', '😈'];
function floatEmoji(e, uid) {
  if (!EMOJIS.includes(e)) return;
  const p = player(S.state, uid);
  const el = document.createElement('div');
  el.className = 'floater';
  el.style.left = `${10 + Math.random() * 75}%`;
  el.innerHTML = `<span>${e}</span>${p ? `<em>${face(p)}</em>` : ''}`;
  $('#floaters').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function ordinal(n) { return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th'); }

// ---------------------------------------------------------------- game HUD

function landuUid(st) {
  let best = null, max = 1;
  for (const p of st.players) {
    if (p.deaths > max) { max = p.deaths; best = p.uid; } else if (p.deaths === max) best = best && best !== p.uid ? null : best;
  }
  return best;
}

// Each player's card sits next to their own corner of the board.
function renderChips(st) {
  const cur = current(st);
  const landu = landuUid(st);
  $$('#game .slot').forEach(slot => {
    const p = st.players.find(q => q.color === slot.dataset.color);
    if (!p) { slot.innerHTML = ''; return; }
    const turn = cur && cur.uid === p.uid && st.phase !== 'over';
    const offline = S.mode === 'online' && !p.bot && !S.online.has(p.uid);
    const badges = (landu === p.uid ? '<i title="Biggest Landu">🤡</i>' : '') + (p.skip ? '<i title="Asleep">💤</i>' : '') +
      (p.done ? '<i>🏆</i>' : '') + (p.bot ? '<i>🤖</i>' : '') + (offline ? '<i title="Offline">📵</i>' : '');
    slot.innerHTML = `<div class="chip ${turn ? 'turn' : ''} ${p.uid === S.me && S.mode === 'online' ? 'me' : ''}" style="--c:${TEAM[p.color]}">
      <div class="chip-face">${face(p)}</div>
      <div class="chip-body"><b>${esc(p.name.replace(' 🤖', ''))}</b>
      <small><span title="Kabooms left">💣${p.kabooms}</span> <span title="Kills">⚔️${p.kills}</span> <span title="Times killed">💀${p.deaths}</span></small></div>
      <div class="badges">${badges}</div>${turn && st.deadline ? '<span class="timer"><i></i></span>' : ''}</div>`;
  });
}

function renderControls(st, busy = false) {
  const cur = current(st);
  const me = controls(st);
  const dice = $('#dice');
  if (!busy) setDice(st.dice, cur && cur.color);
  dice.style.setProperty('--c', cur ? TEAM[cur.color] : '#8A4FFF');
  const canRoll = !busy && me && st.phase === 'roll' && !S.aiming && S.sentSeq !== st.seq;
  dice.disabled = !canRoll;
  dice.classList.toggle('ready', !!canRoll);

  const kb = $('#btn-kaboom');
  const kbPlayer = me || (S.mode === 'online' ? player(st, S.me) : cur);
  const kbReady = !busy && me && canKaboom(st, me.uid) && S.sentSeq !== st.seq;
  kb.disabled = !kbReady;
  kb.classList.toggle('ready', !!kbReady);
  kb.classList.toggle('aiming', S.aiming);
  $('#kb-count').textContent = kbPlayer && kbPlayer.color ? `×${kbPlayer.kabooms}` : '';
  if (!kbReady && S.aiming) S.aiming = false;

  if (!busy && me && S.aiming) {
    const list = kaboomTokens(st, me.color).map(t => ({ c: me.color, t }));
    const zone = [];
    for (const o of list) {
      const sq = square(me.color, st.tokens[me.color][o.t]);
      for (let d = -2; d <= 2; d++) zone.push({ sq: (sq + d + 52) % 52 });
    }
    board.highlight(list, 'kaboom', zone);
  } else if (!busy && me && st.phase === 'move' && S.sentSeq !== st.seq) {
    board.highlight(st.movable.map(t => ({ c: me.color, t })), 'move');
  } else {
    board.highlight([]);
  }

  if (busy) return;
  const status = $('#status');
  let text = '';
  if (st.phase === 'over') text = '🏁 Game over!';
  else if (me && S.aiming) {
    const n = new Set(kaboomTokens(st, me.color).flatMap(t => blastTargets(st, me.color, t).map(v => `${v.c}${v.t}`))).size;
    text = `💣 Tap your shaking token to blow it up — ${n} enem${n === 1 ? 'y' : 'ies'} in range. Tap 💣 again to cancel.`;
  }
  else if (me && st.phase === 'roll') {
    const who = S.mode === 'local' ? `<b style="color:${TEAM[me.color]}">${esc(me.name)}</b>, ` : '';
    text = `${who}tap the dice! 🎲${kbReady ? ' <span class="hot">💣 KABOOM is ready!</span>' : ''}`;
  } else if (me && st.phase === 'move') text = `You rolled ${st.dice} — tap a token to move`;
  else if (cur) text = cur.bot ? `🤖 ${esc(cur.name.replace(' 🤖', ''))} is thinking…` : `Waiting for <b style="color:${TEAM[cur.color]}">${esc(cur.name)}</b>…`;
  status.innerHTML = text;
}

async function act(a) {
  unlock();
  const st = S.state;
  S.sentSeq = st.seq;
  S.aiming = false;
  renderControls(st);
  const ok = await S.room.act({ ...a, seq: st.seq });
  if (!ok) { S.sentSeq = -1; if (S.state) renderControls(S.shown || S.state); }
}

function onDice() {
  const st = S.state;
  const me = controls(st);
  if (!me || st.phase !== 'roll' || S.pumping) return;
  act({ type: 'roll', uid: me.uid });
}

function onKaboomBtn() {
  const st = S.state;
  const me = controls(st);
  if (!me || !canKaboom(st, me.uid)) return;
  S.aiming = !S.aiming;
  sfx('pop');
  renderControls(st);
}

async function onTokenTap({ t }) {
  const st = S.state;
  const me = controls(st);
  if (!me || S.pumping) return;
  if (S.aiming) return act({ type: 'kaboom', uid: me.uid, token: t });
  if (st.phase !== 'move' || !st.movable.includes(t)) return;
  const bestie = moveVictims(st, t).map(v => playerByColor(st, v.c)).find(v => v && areBesties(me.char, v.char));
  if (bestie && !(await confirmBox(
    `<div class="confirm-face">${face(bestie, 72)}</div><h3>Kill your bestie ${esc(bestie.name)}? 🥺</h3><p>Besties don't kill each other…</p>`,
    'Yes, betray 😈', 'No, spare 🥺'))) return;
  act({ type: 'move', uid: me.uid, token: t });
}

function confirmBox(html, yes, no) {
  return new Promise(resolve => {
    $('#confirm-body').innerHTML = html;
    $('#confirm-yes').textContent = yes;
    $('#confirm-no').textContent = no;
    const done = v => { closeModal('modal-confirm'); $('#confirm-yes').onclick = $('#confirm-no').onclick = null; resolve(v); };
    $('#confirm-yes').onclick = () => done(true);
    $('#confirm-no').onclick = () => done(false);
    openModal('modal-confirm');
  });
}

// Bots, and the turn timer for people who wander off.
function drive() {
  const st = S.state;
  const bar = S.screen === 'game' && S.shown && S.shown.deadline && $('#game .chip.turn .timer i');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, ((S.shown.deadline - S.room.now) / (S.shown.settings.timer * 1000)) * 100))}%`;
  if (!S.room || !st || (st.phase !== 'roll' && st.phase !== 'move') || S.pumping || S.queue.length) return;
  const cur = current(st);
  if (cur.bot) {
    // The host's phone plays the bots; anyone else steps in if the host goes quiet.
    const driver = S.mode === 'local' || st.host === S.me || !S.online.has(st.host);
    const waited = driver ? Date.now() - S.idleAt >= 600 / SPEED : Date.now() - S.seenAt >= 8000 / SPEED;
    if (waited && S.sentSeq !== st.seq) {
      S.sentSeq = st.seq;
      S.room.act(botAction(st)).then(ok => { if (!ok) S.sentSeq = -1; });
    }
    return;
  }
  // Auto-play when the turn timer runs out, or ~10s after the player's phone goes offline.
  const gone = S.mode === 'online' && S.presenceReady && !S.online.has(cur.uid) && Date.now() - S.seenAt > 10000 / SPEED;
  if (((st.deadline && S.room.now > st.deadline + 800) || gone) && S.sentSeq !== st.seq) {
    S.sentSeq = st.seq;
    S.room.act({ type: 'timeout', turnNo: st.turnNo, phase: st.phase, seq: st.seq }).then(ok => { if (!ok) S.sentSeq = -1; });
  }
}
setInterval(drive, 200);

// ---------------------------------------------------------------- results

function showResults(st) {
  const ranks = st.ranks.map(uid => player(st, uid)).filter(Boolean);
  const winner = ranks[0];
  const top = (key, min = 1) => {
    let best = null;
    for (const p of st.players) if (p[key] >= min && (!best || p[key] > best[key])) best = p;
    return best;
  };
  const awards = [
    ['🔪', 'Assassin', 'most kills', top('kills')],
    ['🤡', 'Biggest Landu', 'killed the most', top('deaths')],
    ['💣', 'Kaboom King', 'most bomb kills', top('boomKills')],
    ['😴', 'Sleepyhead', 'fell asleep the most', top('afk')],
    ['💔', 'Backstabber', 'killed their bestie', top('betrayals')],
  ].filter(a => a[3]);
  const host = S.mode === 'local' || st.host === S.me;
  $('#results').innerHTML = `
    <div class="winner" style="--c:${TEAM[winner.color]}">${face(winner)}<h2>${esc(winner.name)} wins!</h2><p>Alquida Champion 🏆</p></div>
    <ol class="ranking">${ranks.map((p, i) => `<li style="--c:${TEAM[p.color]}"><span>${['🥇', '🥈', '🥉', '4️⃣'][i]}</span>${face(p)}<b>${esc(p.name)}</b><small>⚔️${p.kills} 💀${p.deaths}</small></li>`).join('')}</ol>
    ${awards.length ? `<div class="awards">${awards.map(([i, t, d, p]) => `<div class="award"><span>${i}</span><div><b>${t}</b><small>${esc(p.name)} · ${d}</small></div></div>`).join('')}</div>` : ''}
    <div class="stack">
      ${host ? '<button class="btn big primary" id="btn-again">🔁 Play again</button>' : '<p class="waiting">Waiting for the host to start a rematch…</p>'}
      <button class="btn" id="btn-results-home">🏠 Home</button>
    </div>`;
  openModal('modal-results');
  sfx('win');
  confetti(60);
  if (S.mode === 'local') store.del('al_local');
}

async function playAgain() {
  closeModal('modal-results');
  const st = S.state;
  if (S.mode === 'local') {
    await S.room.act({ type: 'rematch', uid: st.host });
    await S.room.act({ type: 'start', uid: st.host });
  } else {
    await S.room.act({ type: 'rematch', uid: S.me });
  }
}

// ---------------------------------------------------------------- online entry

async function openRoom(code) {
  if (!onlineReady()) {
    info(setupNeeded());
    return goHome();
  }
  loading(`Opening room ${code}…`);
  try {
    const room = await withTimeout(OnlineRoom.open(code, S.me));
    if (!room) { loading(null); toast(`😕 Room ${esc(code)} not found`); return goHome(); }
    setUrl(code);
    attachRoom(room, 'online');
  } catch (e) {
    info(explain(e, `Couldn't open room ${esc(code)}`));
    goHome();
  }
  loading(null);
}

function withTimeout(promise, ms = 15000) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// Turn Firebase errors into something a player can act on.
function explain(e, title) {
  const msg = String((e && (e.code || e.message)) || e);
  let help = `<p>Something went wrong: <code>${esc(msg)}</code></p><p>Try again in a moment. If it keeps happening, send a screenshot of this to whoever set up the game.</p>`;
  if (/permission[_ ]denied/i.test(msg)) {
    help = `<p>🔒 The game's database is still <b>locked</b>.</p>
      <p>Whoever set up the game needs to open <b>Firebase → Realtime Database → Rules</b>, paste the Alquida Landu rules (from <code>ludo/database.rules.json</code>) and tap <b>Publish</b>.</p>`;
  } else if (/timeout|network|disconnect|offline/i.test(msg)) {
    help = '<p>📶 Couldn\'t reach the game server. Check your internet (or turn off any VPN / data saver) and try again.</p>';
  }
  return `<h3>😕 ${title}</h3>${help}`;
}

function setupNeeded() {
  return `<h3>🔌 Online play isn't switched on yet</h3>
    <p>The game owner needs to connect a free Firebase database (5 minutes, see <code>ludo/README.md</code>).</p>
    <p>Meanwhile you can play <b>Pass &amp; play</b> on one phone, with bots too!</p>`;
}

// ---------------------------------------------------------------- wiring

document.addEventListener('pointerdown', unlock, { passive: true });

$('#btn-online').onclick = () => {
  if (!onlineReady()) return info(setupNeeded());
  openProfile('create');
};
$('#btn-local').onclick = () => {
  S.seats = seatDefaults();
  S.localSettings = { boxes: true, finish: 'first' };
  renderLocal();
  show('local');
};
$('#btn-resume').onclick = () => {
  const saved = store.get('al_local', null);
  if (saved) startLocal(saved);
};
$('#form-code').onsubmit = e => {
  e.preventDefault();
  const code = $('#code-input').value.trim().toUpperCase();
  if (!validCode(code)) return toast('Room codes are 4 letters/numbers');
  openRoom(code);
};
$('#btn-rules').onclick = $('#btn-menu-rules').onclick = () => { closeModal('modal-menu'); openModal('modal-rules'); };
$$('[data-home]').forEach(b => { b.onclick = goHome; });
$$('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m && m.id !== 'modal-results' && m.id !== 'modal-confirm') m.hidden = true;
  if (e.target.closest('[data-close]')) m.hidden = true;
}));

// profile
$('#name-input').addEventListener('input', renderProfile);
$('#char-grid').onclick = e => {
  const b = e.target.closest('.char-card');
  if (!b || b.disabled) return;
  S.pickChar = b.dataset.char;
  sfx('pop');
  renderProfile();
};
$('#btn-profile-go').onclick = profileGo;
$('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') profileGo(); });

// local setup
$('#seats').addEventListener('input', e => {
  const i = e.target.dataset.name;
  if (i == null) return;
  S.seats[i].name = e.target.value;
  const st = previewLocal();
  // refresh faces without losing the keyboard
  S.seats.forEach((seat, j) => {
    const p = player(st, `p${j}`);
    const btn = $(`[data-cycle="${j}"]`);
    if (!p || !btn) return;
    const locked = !seat.bot && charForName(seat.name) === p.char;
    btn.innerHTML = avatar(p.char) + (locked ? '<i>🔒</i>' : '');
    btn.disabled = locked || seat.bot;
  });
});
$('#seats').addEventListener('click', e => {
  const cyc = e.target.closest('[data-cycle]');
  const rem = e.target.closest('[data-remove]');
  if (cyc && !cyc.disabled) {
    const i = Number(cyc.dataset.cycle);
    const st = previewLocal();
    const used = new Set(st.players.filter(p => p.uid !== `p${i}`).map(p => p.char));
    const curId = player(st, `p${i}`).char;
    let k = CHAR_IDS.indexOf(curId);
    do { k = (k + 1) % CHAR_IDS.length; } while (used.has(CHAR_IDS[k]));
    S.seats[i].char = CHAR_IDS[k];
    sfx('pop');
    renderLocal();
  }
  if (rem) { S.seats.splice(Number(rem.dataset.remove), 1); renderLocal(); }
});
$('#btn-add-human').onclick = () => { S.seats.push({ name: '', bot: false }); renderLocal(); };
$('#btn-add-bot').onclick = () => { S.seats.push({ name: '', bot: true }); renderLocal(); };
$('#btn-local-start').onclick = () => startLocal(null);

// lobby
$('#btn-share').onclick = share;
$('#btn-menu-share').onclick = () => { closeModal('modal-menu'); share(); };
$('#btn-copy').onclick = copyLink;
$('#btn-lobby-bot').onclick = () => S.room.act({ type: 'bot', uid: S.me });
$('#btn-lobby-start').onclick = () => S.room.act({ type: 'start', uid: S.me });
$('#btn-lobby-leave').onclick = async () => {
  if (S.room && S.state && S.state.phase === 'lobby') await S.room.act({ type: 'leave', uid: S.me });
  goHome();
};
$('#lobby-players').onclick = e => {
  const kick = e.target.closest('[data-kick]');
  if (kick) return S.room.act({ type: 'leave', uid: S.me, target: kick.dataset.kick });
  if (e.target.closest('[data-repick]')) {
    const st = S.state;
    const used = new Set(st.players.map(p => p.char));
    const mine = player(st, S.me);
    let k = CHAR_IDS.indexOf(mine.char);
    for (let n = 0; n < CHAR_IDS.length; n++) {
      k = (k + 1) % CHAR_IDS.length;
      if (!used.has(CHAR_IDS[k])) { store.set('al_char', CHAR_IDS[k]); return S.room.act({ type: 'pick', uid: S.me, char: CHAR_IDS[k] }); }
    }
  }
};

// game
$('#dice').onclick = onDice;
$('#btn-kaboom').onclick = onKaboomBtn;
$('#btn-emoji').onclick = () => { $('#emoji-tray').hidden = !$('#emoji-tray').hidden; };
$('#emoji-tray').innerHTML = EMOJIS.map(e => `<button data-e="${e}">${e}</button>`).join('');
$('#emoji-tray').onclick = e => {
  const b = e.target.closest('[data-e]');
  if (!b || !S.room) return;
  const uid = S.mode === 'online' ? S.me : (controls(S.state) || current(S.state) || {}).uid;
  S.room.react(b.dataset.e, uid);
  $('#emoji-tray').hidden = true;
};
$('#btn-menu').onclick = () => {
  $('#btn-sound').textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on';
  $('#btn-menu-share').hidden = S.mode !== 'online';
  openModal('modal-menu');
};
$('#btn-sound').onclick = () => { setMuted(!isMuted()); $('#btn-sound').textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on'; };
$('#btn-quit').onclick = () => { closeModal('modal-menu'); goHome(); };
$('#results').onclick = e => {
  if (e.target.closest('#btn-again')) playAgain();
  if (e.target.closest('#btn-results-home')) goHome();
};

// ---------------------------------------------------------------- boot

renderParade();
refreshHome();
const startCode = (params.get('room') || '').toUpperCase();
if (validCode(startCode)) openRoom(startCode);

// for tests / debugging in the console
window.alquida = { S, board, squareCenter, isTurn };
