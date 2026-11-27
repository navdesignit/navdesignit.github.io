// Pon Pon Prix — screens, rooms and the main loop. The race itself is in race.js,
// physics in sim.js, the 3D world in render.js and scenery.js.

import { Renderer } from './render.js';
import { Hud, itemIcon, ordinal } from './hud.js';
import { Input } from './input.js';
import { Race } from './race.js';
import { LocalRoom, OnlineRoom, onlineReady, validCode, emulatorPort } from './net.js';
import { createRoom, results, MAX_PLAYERS, raceKarts } from './room.js';
import { CHARACTERS, CHAR_IDS, avatar, charForName, RIDES } from './riders.js';
import { TRACKS, TRACK_IDS } from './track.js';
import { ITEM_INFO } from './lines.js';
import * as A from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const params = new URLSearchParams(location.search);

// Same keys as the Ludo game, so your name and character come with you.
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};

// A clock the tests can drive frame by frame (?step=1); normally just the real time.
const clock = { manual: params.has('step'), t: Date.now(), now() { return this.manual ? this.t : Date.now(); } };

const S = {
  me: store.get('al_uid', null),
  mode: null,          // 'online' | 'practice'
  room: null,
  state: null,
  race: null,
  podiumFor: null,
  present: new Set(),
  profileMode: null,
  pickChar: null,
  joinCode: null,
  screen: 'home',
};
if (!S.me) { S.me = 'u' + Math.random().toString(36).slice(2, 10); store.set('al_uid', S.me); }

let R = null;
const hud = new Hud($('#race'));
const input = new Input($('#race'), {
  stick: $('#stick'), knob: $('#stick-knob'), drift: $('#btn-drift'), item: $('#btn-item'), horn: $('#btn-horn'),
  onHorn: () => { if (S.race) S.race.honk(); },
});
const app = {
  get R() { return R; },
  hud, input,
  get room() { return S.room; },
  me: S.me,
  auto: params.has('autopilot'),
  get present() { return S.mode === 'online' ? S.present : null; },
  root: $('#race'),
  now: () => (clock.manual ? clock.t : performance.now()),
  // test only: ?lag=120&jitter=60 pretends every position update took that long to arrive
  lag: params.has('lag') ? { ms: Number(params.get('lag')) || 0, jitter: Number(params.get('jitter')) || 0 } : null,
};

// ---------------------------------------------------------------- helpers

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  S.screen = id;
  document.body.dataset.screen = id;
}

function toast(html, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function info(html) { $('#info-body').innerHTML = html; $('#modal-info').hidden = false; }
function loading(text) { $('#loading').hidden = !text; if (text) $('#loading-text').textContent = text; }

function shareUrl(code) {
  const emu = emulatorPort() ? `&emulator=${emulatorPort()}` : '';
  return `${location.origin}${location.pathname}?room=${code}${emu}`;
}
function setUrl(code) {
  const emu = emulatorPort() ? `emulator=${emulatorPort()}` : '';
  const q = [code ? `room=${code}` : '', emu].filter(Boolean).join('&');
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
}

async function ensureRenderer() {
  if (R) return R;
  try { await Promise.race([document.fonts.load('30px Bungee'), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* fonts are optional */ }
  R = new Renderer($('#gl'));
  resize();
  return R;
}
function resize() {
  if (!R) return;
  R.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not allowed: fine */ }
}

// ---------------------------------------------------------------- home

function renderParade() {
  $('#parade').innerHTML = CHAR_IDS.map(id => `<div class="pr">${avatar(id, { weapon: false })}<i>${RIDES[id].icon}</i></div>`).join('');
}

function goHome() {
  leaveRoom();
  setUrl(null);
  show('home');
}

function leaveRoom() {
  if (S.race) { S.race.destroy(); S.race = null; }
  if (R) R.clearPodium();
  if (S.room) {
    if (S.mode === 'online' && S.state && S.state.phase !== 'race') S.room.act({ type: 'leave', uid: S.me });
    S.room.close();
  }
  S.room = null; S.state = null; S.mode = null; S.podiumFor = null;
  keepAwake(false);
}

// ---------------------------------------------------------------- profile

function openProfile(mode, code = null) {
  S.profileMode = mode;
  S.joinCode = code;
  $('#name-input').value = store.get('al_name', '');
  S.pickChar = store.get('al_char', null);
  renderProfile();
  show('profile');
}

function takenChars() {
  const st = S.state;
  const out = {};
  if (st && S.mode === 'online') for (const p of st.players) if (p.uid !== S.me) out[p.char] = p;
  return out;
}

function riderCard(id, { on, taken }) {
  const r = RIDES[id], c = CHARACTERS[id];
  const bars = [['Speed', r.bars.speed], ['Accel', r.bars.accel], ['Steer', r.bars.turn], ['Weight', r.bars.weight]];
  return `<button class="rider ${on ? 'on' : ''}" data-char="${id}" style="--a:${c.accent}" ${taken ? 'disabled' : ''}>
    ${avatar(id)}
    <span><b>${c.name} ${r.icon}</b><span class="ride">${r.ride}${taken ? ` · taken by ${esc(taken.name)}` : ''}</span>
    <span class="stats">${bars.map(([l, v]) => `<span>${l}</span><i style="--v:${v}"></i>`).join('')}</span>
    <span class="perk">★ ${r.perk}</span></span></button>`;
}

function resolvedChar() {
  const taken = takenChars();
  const named = charForName($('#name-input').value);
  if (named && !taken[named]) return named;
  if (S.pickChar && !taken[S.pickChar]) return S.pickChar;
  return CHAR_IDS.find(c => !taken[c]) || CHAR_IDS[0];
}

function renderProfile() {
  const taken = takenChars();
  const ch = resolvedChar();
  $('#rider-grid').innerHTML = CHAR_IDS.map(id => riderCard(id, { on: id === ch, taken: taken[id] })).join('');
}

async function profileGo() {
  A.unlock();
  const name = $('#name-input').value.trim().slice(0, 14) || CHARACTERS[resolvedChar()].name;
  const char = resolvedChar();
  store.set('al_name', name);
  store.set('al_char', char);
  if (S.profileMode === 'practice') return startPractice(name, char);
  if (S.profileMode === 'pick') {
    await S.room.act({ type: 'join', uid: S.me, name, char });
    return show('lobby');
  }
  if (!onlineReady()) return info(setupNeeded());
  if (S.profileMode === 'create') {
    loading('Making a room…');
    try {
      const room = await withTimeout(OnlineRoom.create(S.me, name, char));
      attachRoom(room, 'online');
      setUrl(room.code);
    } catch (e) { info(explain(e, 'Couldn\'t make a room')); }
    loading(null);
  } else if (S.profileMode === 'join') {
    loading(`Joining ${S.joinCode}…`);
    try {
      const room = await withTimeout(OnlineRoom.open(S.joinCode, S.me));
      if (!room) { loading(null); toast(`😕 Room ${esc(S.joinCode)} not found`); return goHome(); }
      attachRoom(room, 'online');
      const ok = await room.act({ type: 'join', uid: S.me, name, char });
      if (!ok && !(S.state && S.state.players.some(p => p.uid === S.me))) toast('😕 That room is full (5 riders max)');
      setUrl(room.code);
    } catch (e) { info(explain(e, `Couldn't join ${esc(S.joinCode)}`)); }
    loading(null);
  }
}

// ---------------------------------------------------------------- rooms

function startPractice(name, char) {
  leaveRoom();
  let st = createRoom('SOLO', Date.now());
  const room = new LocalRoom(st);
  room.act({ type: 'join', uid: S.me, name, char });
  if (params.get('track') && TRACKS[params.get('track')]) room.act({ type: 'settings', uid: S.me, settings: { track: params.get('track') } });
  if (params.get('laps')) room.act({ type: 'settings', uid: S.me, settings: { laps: Number(params.get('laps')) } });
  Object.defineProperty(room, 'now', { get: () => clock.now() });
  attachRoom(room, 'practice');
  if (params.has('go')) startRaceAction();
}

function attachRoom(room, mode) {
  if (clock.manual && mode === 'online') Object.defineProperty(room, 'now', { get: () => clock.now() });
  S.room = room;
  S.mode = mode;
  S.state = null;
  room.subscribe(onState);
  room.onKarts((id, str) => { if (S.race) S.race.onKart(id, str); });
  room.onEvents(ev => {
    if (ev.k === 'meme') { if (ev.c !== S.me) { A.meme(ev.i, true); toast(`${avatar(ev.ch || 'nav', { weapon: false, size: 22 })} 🔊 ${esc(A.MEMES[ev.i] ? A.MEMES[ev.i][2] : '')}`, 1800); } return; }
    if (S.race) S.race.onEvent(ev);
  });
  if (mode === 'online') {
    room.presence(list => {
      S.present = new Set(list);
      if (S.screen === 'lobby' && S.state) renderLobby(S.state);
      if (S.race && S.state) S.race.setRunner(isRunner(S.state));
    });
  }
}

// One phone drives the bots: the host, or if the host's phone has gone, the next one.
function isRunner(st) {
  if (S.mode !== 'online') return true;
  const humans = st.race ? st.race.karts.filter(k => !k.bot).map(k => k.id) : st.players.map(p => p.uid);
  const order = [st.host, ...humans.filter(id => id !== st.host)];
  if (!S.present.size) return st.host === S.me;
  const runner = order.find(id => S.present.has(id)) || st.host;
  return runner === S.me;
}

async function onState(st) {
  const prev = S.state;
  S.state = st;
  const meIn = st.players.some(p => p.uid === S.me);
  if (st.phase === 'lobby') {
    if (S.race) { S.race.destroy(); S.race = null; }
    if (R) R.clearPodium();
    S.podiumFor = null;
    if (S.screen !== 'profile' || S.profileMode !== 'pick') {
      if (meIn || S.mode === 'practice') { renderLobby(st); if (S.screen !== 'lobby') show('lobby'); }
    }
  } else if (st.phase === 'race') {
    const inRace = st.race.karts.some(k => k.id === S.me);
    if (!S.race || S.race.info.id !== st.race.id) {
      if (!inRace && !meIn) return;
      await startRace(st);
    } else S.race.onState(st);
  } else if (st.phase === 'podium') {
    if (S.race && S.race.info.id === st.race.id) S.race.onState(st);
    if (S.podiumFor !== st.race.id) showPodium(st);
    else renderResults(st);
  }
  if (prev && prev.host !== st.host && st.host === S.me && S.mode === 'online') toast('👑 You are the host now');
}

async function startRace(st) {
  await ensureRenderer();
  if (S.race) S.race.destroy();
  R.clearPodium();
  S.podiumFor = null;
  input.reset();
  input.enabled = false;
  S.race = new Race(app, st.race, { runner: isRunner(st) });
  S.race.onState(st);
  $('#race').classList.remove('racing', 'finished');
  $('#race').classList.toggle('rotate-hint', window.innerHeight > window.innerWidth);
  hud.later(() => $('#race').classList.remove('rotate-hint'), 4500);
  show('race');
  resize();
  keepAwake(true);
  window.__pp.race = S.race;
}

async function startRaceAction() {
  const st = S.state;
  if (!st || st.host !== S.me) return;
  A.unlock();
  $('#btn-start').disabled = true;
  if (S.mode === 'online') await S.room.clearRace();
  await S.room.act({ type: 'start', uid: S.me, seed: Math.random() });
  $('#btn-start').disabled = false;
}

// ---------------------------------------------------------------- lobby

const SOUNDBOARD = ['Wah Modi ji wah', 'Mazaa nahi aa raha', 'Alag hi level', 'System phaad', 'Moorkh samajhna', 'Ye PUBG wala', 'Hum to fakir', 'Depression mein'];

function renderSoundboard(el) {
  el.innerHTML = `<h4>😂 Soundboard (plays on everyone's phone)</h4>` + SOUNDBOARD.map(l => {
    const i = A.memeIndex(l);
    return i >= 0 ? `<button data-meme="${i}">🔊 ${esc(A.MEMES[i][2])}</button>` : '';
  }).join('');
}

function renderLobby(st) {
  const online = S.mode === 'online';
  const host = st.host === S.me;
  $('#lobby-title').innerHTML = online ? `Room <span class="code">${esc(st.code)}</span>` : '🤖 Practice';
  $('#share-card').hidden = !online;
  if (online) {
    const url = shareUrl(st.code);
    $('#share-link').textContent = url.replace(/^https?:\/\//, '');
    $('#btn-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`🛺💨 Race me in Pon Pon Prix! Tap to join: ${url}`)}`;
  }
  const karts = raceKarts(st).sort((a, b) => a.bot - b.bot); // people first, then the bots
  $('#lobby-players').innerHTML = karts.map(k => {
    const c = CHARACTERS[k.char], r = RIDES[k.char];
    const me = k.id === S.me;
    const here = k.bot || !online || S.present.has(k.id);
    return `<div class="lp ${me ? 'me' : ''}" style="--a:${c.accent}">${avatar(k.char)}
      <div><b>${esc(k.name)}${me ? ' (you)' : ''}${st.host === k.id && online ? ' 👑' : ''}</b><small>${r.icon} ${r.ride}${k.bot ? ' · bot' : ''}</small></div>
      ${me ? '<button class="btn small" id="btn-change">Change</button>' : k.bot ? '<span class="bot">🤖</span>' : `<span class="dot ${here ? '' : 'off'}"></span>`}</div>`;
  }).join('') + (online && st.players.length < 2 ? '<p class="hint">Waiting for your friend… send them the link! 👆</p>' : '');
  const chg = $('#btn-change');
  if (chg) chg.onclick = () => openProfile(online ? 'pick' : 'practice-pick');
  $('#tracks').innerHTML = TRACK_IDS.map(id => {
    const t = TRACKS[id];
    return `<button class="trk ${st.settings.track === id ? 'on' : ''}" data-track="${id}" ${host ? '' : 'disabled'}><span class="e">${t.emoji}</span><b>${t.name}</b><small>${t.blurb}</small></button>`;
  }).join('');
  $('#settings').innerHTML = `
    <div class="set"><span>Laps</span><div class="seg">${[1, 2, 3, 5].map(n => `<button data-laps="${n}" class="${st.settings.laps === n ? 'on' : ''}" ${host ? '' : 'disabled'}>${n}</button>`).join('')}</div></div>
    ${online ? `<div class="set"><span>Fill with bots 🤖</span><div class="seg"><button data-bots="1" class="${st.settings.bots ? 'on' : ''}" ${host ? '' : 'disabled'}>On</button><button data-bots="0" class="${st.settings.bots ? '' : 'on'}" ${host ? '' : 'disabled'}>Off</button></div></div>` : ''}`;
  $('#btn-start').hidden = !host;
  $('#lobby-wait').hidden = host;
  renderSoundboard($('#soundboard-lobby'));
}

// ---------------------------------------------------------------- podium

function showPodium(st) {
  S.podiumFor = st.race.id;
  const res = results(st);
  if (S.race) { S.race.engine && S.race.engine.stop(); }
  if (R) {
    for (const [id, v] of R.karts) if (!res.some(r => r.id === id)) R.removeKart(id);
    R.clearObjs();
    R.podium(res.map(r => r.id));
  }
  A.sfx('crowd');
  renderResults(st);
  show('podium');
  keepAwake(false);
}

const fmt = t => (t == null ? '—' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);

function renderResults(st) {
  const res = results(st);
  const host = st.host === S.me;
  const online = S.mode === 'online';
  const awards = [];
  const best = (key, title, emo, fmtv) => {
    let top = null;
    for (const r of res) if ((r.stats[key] || 0) > 0 && (!top || r.stats[key] > top.stats[key])) top = r;
    if (top) awards.push(`<div class="award"><b>${emo} ${title}</b>${esc(top.name)} · ${fmtv(top.stats[key])}</div>`);
  };
  best('hits', 'Chappal Champion', '🩴', n => `${n} hits`);
  best('turbos', 'Drift King', '🔥', n => `${n} boosts`);
  best('hitBy', 'Sabse Zyada Pitaa', '🤕', n => `hit ${n} times`);
  best('cows', 'Gaay Bhakt', '🐄', n => `${n} cows`);
  best('holes', 'Pothole Inspector', '🕳️', n => `${n} potholes`);
  best('walls', 'Dukaan Tod', '🧱', n => `${n} shop fronts`);
  const winner = res[0];
  $('#results').innerHTML = `<h2>🏆 ${esc(winner ? winner.name : '')} wins!</h2>` +
    res.map((r, i) => {
      const c = CHARACTERS[r.char];
      return `<div class="res ${r.id === S.me ? 'me' : ''}" style="--a:${c.accent}"><span class="pl">${['🥇', '🥈', '🥉'][i] || ordinal(i + 1)}</span>${avatar(r.char)}
        <div><b>${esc(r.name)}${r.bot ? ' 🤖' : ''}</b><small>${RIDES[r.char].icon} ${RIDES[r.char].ride}</small></div><span class="tm">${r.dnf ? 'DNF' : fmt(r.t)}</span></div>`;
    }).join('') +
    (awards.length ? `<div class="awards">${awards.join('')}</div>` : '') +
    `<div class="row gap">${host ? '<button class="btn primary" id="btn-again">🔁 Race again</button>' : '<p class="waiting">Waiting for the host…</p>'}<button class="btn" id="btn-home2">🏠 Home</button></div>` +
    '<div class="soundboard" id="soundboard-podium"></div>';
  renderSoundboard($('#soundboard-podium'));
  const again = $('#btn-again');
  if (again) again.onclick = () => S.room.act({ type: 'again', uid: S.me });
  $('#btn-home2').onclick = goHome;
}

// ---------------------------------------------------------------- errors

function withTimeout(promise, ms = 15000) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

function explain(e, title) {
  const msg = String((e && (e.code || e.message)) || e);
  let help = `<p>Something went wrong: <code>${esc(msg)}</code></p><p>Try again in a moment.</p>`;
  if (/permission[_ ]denied/i.test(msg)) {
    help = `<p>🔒 The game's database doesn't allow race rooms yet.</p>
      <p>Whoever set up the game needs to open <b>Firebase → Realtime Database → Rules</b>, paste everything from <code>ludo/database.rules.json</code> (it now has a <code>race</code> section too) and tap <b>Publish</b>.</p>`;
  } else if (/timeout|network|disconnect|offline/i.test(msg)) {
    help = '<p>📶 Couldn\'t reach the game server. Check your internet (or turn off any VPN / data saver) and try again.</p>';
  }
  return `<h3>😕 ${title}</h3>${help}`;
}

function setupNeeded() {
  return `<h3>🔌 Online races aren't switched on yet</h3><p>Meanwhile, practise against the gang on your own phone!</p>`;
}

// ---------------------------------------------------------------- wiring

document.addEventListener('pointerdown', () => A.unlock(), { passive: true });

$('#btn-online').onclick = () => { if (!onlineReady()) return info(setupNeeded()); openProfile('create'); };
$('#btn-practice').onclick = () => openProfile('practice');
$('#form-code').onsubmit = e => {
  e.preventDefault();
  const code = $('#code-input').value.trim().toUpperCase();
  if (!validCode(code)) return toast('Room codes are 4 letters/numbers');
  openProfile('join', code);
};
$$('[data-home]').forEach(b => { b.onclick = () => (S.room ? show('lobby') : goHome()); });
$('#name-input').addEventListener('input', renderProfile);
$('#rider-grid').onclick = e => {
  const b = e.target.closest('.rider');
  if (!b || b.disabled) return;
  S.pickChar = b.dataset.char;
  const named = charForName($('#name-input').value);
  if (named && named !== S.pickChar) $('#name-input').value = '';
  A.unlock();
  A.sfx('pop');
  renderProfile();
};
$('#btn-profile-go').onclick = () => {
  if (S.profileMode === 'practice-pick') {
    const name = $('#name-input').value.trim().slice(0, 14) || CHARACTERS[resolvedChar()].name;
    store.set('al_name', name); store.set('al_char', resolvedChar());
    S.room.act({ type: 'join', uid: S.me, name, char: resolvedChar() });
    return show('lobby');
  }
  profileGo();
};
$('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-profile-go').click(); });

$('#btn-lobby-leave').onclick = goHome;
$('#btn-start').onclick = startRaceAction;
$('#tracks').onclick = e => {
  const b = e.target.closest('[data-track]');
  if (b && !b.disabled) { A.sfx('pop'); S.room.act({ type: 'settings', uid: S.me, settings: { track: b.dataset.track } }); }
};
$('#settings').onclick = e => {
  const l = e.target.closest('[data-laps]'), b = e.target.closest('[data-bots]');
  if (l && !l.disabled) S.room.act({ type: 'settings', uid: S.me, settings: { laps: Number(l.dataset.laps) } });
  if (b && !b.disabled) S.room.act({ type: 'settings', uid: S.me, settings: { bots: b.dataset.bots === '1' } });
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-meme]');
  if (!b) return;
  const i = Number(b.dataset.meme);
  A.unlock();
  A.meme(i, true);
  if (S.room) {
    const me = S.state && S.state.players.find(p => p.uid === S.me);
    S.room.sendEvent({ k: 'meme', i, c: S.me, r: 0, u: S.me, ch: me ? me.char : 'nav' });
  }
});
async function share() {
  const url = shareUrl(S.room.code);
  if (navigator.share) {
    try { await navigator.share({ title: 'Pon Pon Prix 🛺💨', text: `Race me in Pon Pon Prix! Room ${S.room.code}`, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  copy();
}
async function copy() {
  const url = shareUrl(S.room.code);
  try { await navigator.clipboard.writeText(url); toast('📋 Link copied!'); } catch (e) { info(`<p>Copy this link:</p><p class="share-link">${esc(url)}</p>`); }
}
$('#btn-share').onclick = share;
$('#btn-copy').onclick = copy;

// menu
$('#btn-pause').onclick = () => { renderMenu(); $('#modal-menu').hidden = false; };
function renderMenu() {
  $('#btn-sound').textContent = A.isMuted() ? '🔇 Sound: off' : '🔊 Sound: on';
}
$('#btn-sound').onclick = () => { A.setMuted(!A.isMuted()); renderMenu(); };
$('#btn-menu-rules').onclick = () => { $('#modal-menu').hidden = true; openRules(); };
$('#btn-quit').onclick = () => { $('#modal-menu').hidden = true; goHome(); };
$('#btn-rules').onclick = openRules;
function openRules() {
  $('#rules-items').innerHTML = Object.entries(ITEM_INFO).map(([id, it]) => `<li><span class="ic">${itemIcon(id)}</span><span><b>${it.name}</b>: ${it.tip}</span></li>`).join('');
  $('#rules-riders').innerHTML = CHAR_IDS.map(id => `<li>${RIDES[id].icon} <b>${CHARACTERS[id].name}</b> rides the <b>${RIDES[id].ride}</b>. ${RIDES[id].blurb} <i>${RIDES[id].perk}.</i></li>`).join('');
  $('#modal-rules').hidden = false;
}
$$('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m || e.target.closest('[data-close]')) m.hidden = true;
}));

const raceEl = $('#race');

// ---------------------------------------------------------------- main loop

let last = performance.now();
function frame(dtMs) {
  if (S.screen === 'race' && S.race) {
    S.race.frame(dtMs);
    if (S.race.W.time > 0 && !raceEl.classList.contains('racing')) raceEl.classList.add('racing');
  } else if (S.screen === 'podium' && R) {
    hud.frame(app.now());
    R.podiumFrame(dtMs / 1000);
    if (!app.noRender) R.render(dtMs / 1000);
  }
}
const perf = params.has('perf') ? [] : null; // ?perf=1: record how long each frame's work takes
function loop(now) {
  requestAnimationFrame(loop);
  const dt = now - last;
  last = now;
  const t0 = perf ? performance.now() : 0;
  frame(dt);
  if (perf && S.screen === 'race') perf.push([dt, performance.now() - t0]);
}
if (!clock.manual) requestAnimationFrame(loop);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.race) keepAwake(true);
});

// Test hooks: window.__pp lets the Playwright scripts drive and inspect the game.
window.__pp = {
  S, app, clock,
  step(ms = 1000 / 30) {
    clock.t += ms;
    // CSS animations follow the stepped clock too, so recorded videos play at true speed
    for (const a of document.getAnimations()) { try { if (a.playState === 'running') a.pause(); a.currentTime = (a.currentTime || 0) + ms; } catch (e) { /* ignore */ } }
    frame(ms);
  },
  get R() { return R; },
  perf: () => perf,
};

// ---------------------------------------------------------------- start up

renderParade();
const code = (params.get('room') || '').toUpperCase();
if (params.has('practice')) {
  const name = params.get('name') || store.get('al_name', 'Nav');
  const char = params.get('char') || charForName(name) || 'nav';
  store.set('al_name', name);
  startPractice(name, char);
} else if (validCode(code)) {
  if (!onlineReady()) info(setupNeeded());
  else openProfile('join', code);
}
