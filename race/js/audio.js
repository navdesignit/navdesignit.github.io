// Sound: engines, horns and tyre squeal synthesised with WebAudio, and the meme packs
// from the Ludo game (ludo/sounds/fx.mp3 and memes.mp3, clip times in ludo/js/sound.js).
// iPhones only allow audio after a tap, so unlock() runs on the first touch.

import { FX, MEMES } from '../../ludo/js/sound.js';

export { MEMES };

let ctx = null, out = null, fxBuf = null, memeBuf = null, noiseBuf = null;
let voiceSrc = null, boomSrc = null, voiceAt = 0;
let muted = false;
try { muted = localStorage.getItem('pp_muted') === '1'; } catch (e) { /* private mode */ }

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('pp_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
  if (out) out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
  if (music) music.bus.gain.setTargetAtTime(!m && musicOn ? music.level : 0, ctx.currentTime, 0.05);
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 1;
    out.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const load = (file, set) => fetch(new URL(`../../ludo/sounds/${file}`, import.meta.url))
      .then(r => r.arrayBuffer())
      .then(b => new Promise(res => ctx.decodeAudioData(b, buf => { set(buf); res(); }, res)))
      .catch(() => { /* the synth sounds still play */ });
    load('fx.mp3', b => { fxBuf = b; });
    load('memes.mp3', b => { memeBuf = b; });
  }
  if (ctx.state === 'suspended') ctx.resume();
}
export const ready = () => !!ctx;

function tone(freq, dur, { type = 'sine', vol = 0.18, to = null, at = 0, dest = out } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur, { vol = 0.3, at = 0, cutoff = 1200, type = 'lowpass', q = 1, sweep = null } = {}) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(cutoff, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

// Each ride's horn.
const HORNS = {
  bullet(v) { for (const at of [0, 0.32]) { tone(330, 0.28, { type: 'square', vol: 0.09 * v, at }); tone(415, 0.28, { type: 'square', vol: 0.07 * v, at }); } },
  nano(v) { for (const at of [0, 0.18]) { tone(620, 0.13, { type: 'triangle', vol: 0.16 * v, at }); tone(780, 0.13, { type: 'triangle', vol: 0.1 * v, at }); } },
  auto(v) { for (const at of [0, 0.22]) { tone(460, 0.18, { type: 'square', vol: 0.12 * v, to: 300, at }); noise(0.08, { vol: 0.15 * v, at, cutoff: 2500 }); } },
  scooter(v) { for (const at of [0, 0.15]) { tone(900, 0.1, { type: 'square', vol: 0.08 * v, at }); tone(1120, 0.1, { type: 'square', vol: 0.06 * v, at }); } },
  moped(v) { [523, 659, 784, 659].forEach((f, i) => tone(f, 0.11, { type: 'sawtooth', vol: 0.07 * v, at: i * 0.11 })); },
  // the tonga bell, ting ting, and a happy whinny
  tonga(v) {
    for (const at of [0, 0.16]) { tone(2093, 0.35, { vol: 0.12 * v, at }); tone(3136, 0.25, { vol: 0.05 * v, at }); }
    const t = ctx.currentTime + 0.35;
    const o = ctx.createOscillator(), gg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(950, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.7);
    lfo.frequency.value = 22; lg.gain.value = 60; lfo.connect(lg).connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 2;
    gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.12 * v, t + 0.05); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(bp).connect(gg).connect(out);
    o.start(t); lfo.start(t); o.stop(t + 0.8); lfo.stop(t + 0.8);
  },
};

HORNS.rickshaw = v => {
  // a cycle bell, tring-tring
  for (const at of [0, 0.3]) for (let i = 0; i < 7; i++) {
    tone(2350, 0.09, { vol: 0.07 * v, at: at + i * 0.028 });
    tone(3290, 0.07, { vol: 0.035 * v, at: at + i * 0.028 });
  }
};

const SOUNDS = {
  horn(veh = 'nano', v = 1) { (HORNS[veh] || HORNS.nano)(v); },
  // the horn item: a truck horn chord, PON PON
  ponpon(v = 1) {
    for (const at of [0, 0.45]) [196, 247, 294, 392].forEach(f => tone(f, 0.38, { type: 'sawtooth', vol: 0.06 * v, at }));
    noise(0.8, { vol: 0.12 * v, cutoff: 600 });
  },
  count(i) { tone([392, 392, 392][i] || 392, 0.22, { type: 'square', vol: 0.12 }); tone(196, 0.22, { type: 'square', vol: 0.08 }); },
  go() { [392, 494, 587, 784].forEach(f => tone(f, 0.7, { type: 'sawtooth', vol: 0.06 })); noise(0.5, { vol: 0.2, cutoff: 3000 }); },
  roll() { for (let i = 0; i < 9; i++) tone(900 + (i % 3) * 200, 0.04, { type: 'square', vol: 0.05, at: i * 0.11 }); },
  got() { [784, 988, 1319].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.12, at: i * 0.06 })); },
  box() { tone(1200, 0.08, { type: 'triangle', vol: 0.1 }); noise(0.12, { vol: 0.15, cutoff: 6000 }); },
  throw() { noise(0.3, { vol: 0.25, cutoff: 1500, type: 'bandpass', q: 2, sweep: 6000 }); },
  thwack(v = 1) { noise(0.12, { vol: 0.9 * v, cutoff: 3500 }); tone(140, 0.18, { vol: 0.5 * v, to: 60 }); },
  seeti(v = 1) { tone(1500, 0.6, { vol: 0.08 * v, to: 2600 }); noise(0.65, { vol: 0.3 * v, cutoff: 7500 }); },
  boom(v = 1) { noise(1.2, { vol: 0.9 * v, cutoff: 500 }); tone(90, 0.9, { vol: 0.5 * v, to: 30 }); tone(160, 0.3, { type: 'sawtooth', vol: 0.2 * v, to: 40 }); },
  ptoo(v = 1) { tone(320, 0.25, { vol: 0.25 * v, to: 110 }); noise(0.15, { vol: 0.35 * v, cutoff: 2500, at: 0.05 }); },
  splat(v = 1) { noise(0.2, { vol: 0.6 * v, cutoff: 900 }); tone(180, 0.2, { vol: 0.25 * v, to: 70 }); },
  shield() { [1319, 1568, 2093].forEach((f, i) => tone(f, 0.5, { vol: 0.08, at: i * 0.07 })); },
  block() { tone(2093, 0.4, { vol: 0.12 }); tone(2637, 0.35, { vol: 0.08, at: 0.05 }); noise(0.1, { vol: 0.3, cutoff: 8000, type: 'highpass' }); },
  slurp() { noise(0.6, { vol: 0.25, cutoff: 400, type: 'bandpass', q: 6, sweep: 2400 }); tone(300, 0.5, { vol: 0.05, to: 700 }); },
  rocket() { noise(1.2, { vol: 0.35, cutoff: 800, sweep: 5000 }); for (let i = 0; i < 12; i++) noise(0.03, { vol: 0.4, cutoff: 8000, at: 0.2 + i * 0.09 + Math.random() * 0.04, type: 'highpass' }); },
  moo(v = 1) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(120, t + 1.1);
    lfo.frequency.value = 5; lg.gain.value = 4; lfo.connect(lg).connect(o.frequency);
    f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(700, t + 0.5); f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * v, t + 0.15); g.gain.linearRampToValueAtTime(0.35 * v, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(f).connect(g).connect(out);
    o.start(t); lfo.start(t); o.stop(t + 1.25); lfo.stop(t + 1.25);
  },
  pothole() { noise(0.25, { vol: 0.8, cutoff: 250 }); tone(70, 0.25, { vol: 0.45, to: 35 }); },
  breaker() { noise(0.15, { vol: 0.6, cutoff: 400 }); tone(110, 0.2, { vol: 0.35, to: 60 }); },
  land(v = 1) { noise(0.2, { vol: 0.5 * v, cutoff: 300 }); tone(80, 0.2, { vol: 0.3 * v, to: 45 }); },
  wall(v = 1) { noise(0.25, { vol: 0.6 * v, cutoff: 1800 }); tone(120, 0.2, { type: 'square', vol: 0.08 * v, to: 60 }); },
  bump() { noise(0.12, { vol: 0.4, cutoff: 900 }); tone(160, 0.12, { vol: 0.2, to: 90 }); },
  spark(lv) { tone([0, 880, 1175, 1568][lv] || 1568, 0.12, { type: 'square', vol: 0.06 }); },
  turbo(lv = 1) { noise(0.5 + lv * 0.15, { vol: 0.35, cutoff: 700, sweep: 4500 }); tone(220, 0.4, { type: 'sawtooth', vol: 0.06, to: 660 }); },
  strip() { noise(0.4, { vol: 0.25, cutoff: 900, sweep: 5000 }); tone(660, 0.25, { type: 'triangle', vol: 0.08, to: 1320 }); },
  hop() { tone(300, 0.08, { vol: 0.12, to: 500 }); },
  lap() { [880, 1109, 1319].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.12, at: i * 0.09 })); },
  // last lap: a quick shehnai-ish tune
  final() { [587, 659, 784, 659, 784, 880, 988, 880].forEach((f, i) => { tone(f, 0.16, { type: 'sawtooth', vol: 0.06, at: i * 0.12 }); tone(f * 2, 0.16, { type: 'square', vol: 0.015, at: i * 0.12 }); }); },
  wrong() { for (let i = 0; i < 3; i++) tone(440, 0.12, { type: 'square', vol: 0.08, at: i * 0.18 }); },
  finish() { [523, 659, 784, 1046, 784, 1046, 1319].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.07, at: i * 0.12 })); noise(1.5, { vol: 0.2, cutoff: 2500, at: 0.3 }); },
  sad() { [392, 370, 349, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.12, at: i * 0.25 })); },
  pop() { tone(700, 0.08, { vol: 0.1, to: 1100 }); },
  tick() { tone(1500, 0.03, { type: 'square', vol: 0.05 }); },
  crowd() { noise(2, { vol: 0.3, cutoff: 1800 }); noise(1.6, { vol: 0.18, cutoff: 3500, at: 0.15 }); },
};

export function sfx(name, ...args) {
  if (muted || !ctx || !SOUNDS[name]) return;
  try { SOUNDS[name](...args); } catch (e) { /* never let sound break the game */ }
}

// A clip from the Ludo meme pack (vine boom, "Fatality!", "A few moments later", huh, oh man…).
export function fx(name) {
  if (muted || !ctx || !fxBuf || !FX[name]) return;
  try {
    const list = FX[name];
    const [from, to] = list[Math.floor(Math.random() * list.length)];
    const src = ctx.createBufferSource();
    src.buffer = fxBuf;
    src.connect(out);
    if (name === 'boom') { if (boomSrc) boomSrc.stop(); boomSrc = src; } else { if (voiceSrc) voiceSrc.stop(); voiceSrc = src; }
    src.start(0, from, to - from);
  } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- music
// Background music, synthesised: a dhol, a bassline and a tune on a tumbi, shehnai, synth or a
// baraat brass band depending on the track. Notes are scheduled a little ahead on the audio
// clock so the beat never stutters even if a frame is late.
let musicOn = true;
try { musicOn = localStorage.getItem('pp_music') !== '0'; } catch (e) { /* ignore */ }
export const isMusicOn = () => musicOn;
export function setMusicOn(on) {
  musicOn = on;
  try { localStorage.setItem('pp_music', on ? '1' : '0'); } catch (e) { /* ignore */ }
  if (music) music.bus.gain.setTargetAtTime(on ? music.level : 0, ctx.currentTime, 0.1);
}

const SCALES = { kafi: [0, 2, 3, 5, 7, 9, 10], bhairav: [0, 1, 4, 5, 7, 8, 11], major: [0, 2, 4, 5, 7, 9, 11] };
const STYLES = {
  day: { bpm: 112, scale: 'kafi', root: 57, lead: 'tumbi' },
  sunset: { bpm: 110, scale: 'kafi', root: 55, lead: 'tumbi' },
  dusk: { bpm: 104, scale: 'kafi', root: 60, lead: 'tumbi' },
  night: { bpm: 96, scale: 'bhairav', root: 55, lead: 'shehnai' },
  city: { bpm: 122, scale: 'kafi', root: 52, lead: 'synth', four: true },
  delhi: { bpm: 108, scale: 'major', root: 58, lead: 'brass' },
  podium: { bpm: 120, scale: 'major', root: 60, lead: 'brass' },
  lobby: { bpm: 100, scale: 'kafi', root: 57, lead: 'tumbi', soft: true },
};
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let music = null;

function seededRng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

class Music {
  constructor(style, seed) {
    this.st = STYLES[style] || STYLES.day;
    this.level = this.st.soft ? 0.16 : 0.24;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.setTargetAtTime(musicOn && !muted ? this.level : 0, ctx.currentTime, 0.4);
    this.bus.connect(out);
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    this.tempo = 1;
    this.intense = 0;
    // a four-bar tune that wanders up and down the scale
    const rng = seededRng(seed);
    const sc = SCALES[this.st.scale];
    let deg = 7;
    this.tune = [];
    for (let i = 0; i < 64; i++) {
      const play = i % 4 === 0 || (i % 2 === 0 && rng() < 0.55) || rng() < 0.12;
      if (play) deg = Math.max(3, Math.min(13, deg + Math.round((rng() - 0.5) * 4)));
      this.tune.push(play ? this.st.root + 12 + Math.floor(deg / 7) * 12 + sc[deg % 7] - 12 : null);
    }
    this.timer = setInterval(() => this.pump(), 30);
  }
  pump() {
    if (!ctx) return;
    const spb = 60 / (this.st.bpm * this.tempo) / 4; // seconds per 16th note
    while (this.next < ctx.currentTime + 0.15) { this.play(this.step, this.next, spb); this.step = (this.step + 1) % 64; this.next += spb; }
  }
  note(f, t, dur, type, vol, { to = null, filt = null, q = 1, vib = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    let node = o;
    if (filt) { const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = filt; fl.Q.value = q; o.connect(fl); node = fl; }
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  hit(t, dur, vol, cutoff, type = 'lowpass') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  play(i, t, spb) {
    const s = i % 16, st = this.st;
    // dhol: the big "dha" on the bass side, the slap on the treble side, chimta in between
    if (st.four ? s % 4 === 0 : [0, 6, 10].includes(s)) this.note(st.four ? 60 : 85, t, 0.28, 'sine', 0.9, { to: 40 });
    if ([4, 12].includes(s) || (this.intense && s === 14)) this.hit(t, 0.12, 0.55, 1800, 'bandpass');
    if (s % 2 === 1) this.hit(t, 0.04, this.intense ? 0.22 : 0.14, 7000, 'highpass');
    // bass
    if (s === 0 || s === 8 || (s === 11 && i % 32 > 16)) this.note(hz(st.root - 24 + (s === 8 ? 7 : 0)), t, spb * 3, 'triangle', 0.32);
    // the tune
    const m = this.tune[i];
    if (m) {
      const f = hz(m);
      switch (st.lead) {
        case 'tumbi': this.note(f * 2, t, 0.16, 'square', 0.07, { to: f * 1.98, filt: 2400, q: 2 }); break;
        case 'shehnai': this.note(f, t, spb * 2.2, 'sawtooth', 0.08, { filt: 1300, q: 3, vib: 0.012 }); break;
        case 'synth': this.note(f, t, spb * 0.9, 'square', 0.05, { filt: 1800, q: 1 }); break;
        case 'brass': for (const k of [0, 4, 7]) this.note(f * Math.pow(2, k / 12) * (1 + (k ? 0.003 : 0)), t, spb * 1.6, 'sawtooth', 0.035, { filt: 1500, q: 1 }); break;
        default: break;
      }
    }
  }
  setIntensity(x) { this.intense = x; this.tempo = 1 + x * 0.06; }
  duck(sec) { const t = ctx.currentTime; this.bus.gain.setTargetAtTime(musicOn && !muted ? this.level * 0.35 : 0, t, 0.05); this.bus.gain.setTargetAtTime(musicOn && !muted ? this.level : 0, t + sec, 0.3); }
  stop() { clearInterval(this.timer); const t = ctx.currentTime; this.bus.gain.setTargetAtTime(0, t, 0.2); setTimeout(() => { try { this.bus.disconnect(); } catch (e) { /* ignore */ } }, 1500); }
}

export function playMusic(style, seed = 7) {
  if (!ctx) return;
  if (music && music.style === style) return;
  stopMusic();
  music = new Music(style, seed);
  music.style = style;
}
export function stopMusic() { if (music) { music.stop(); music = null; } }
export function musicIntensity(x) { if (music) music.setIntensity(x); }

// A Modi meme clip. `force` plays it even if another voice played recently.
export function meme(i, force = false) {
  if (muted || !ctx || !memeBuf || !MEMES[i]) return false;
  const now = ctx.currentTime;
  if (!force && now - voiceAt < 7) return false;
  voiceAt = now;
  try {
    const [from, to] = MEMES[i];
    if (voiceSrc) voiceSrc.stop();
    voiceSrc = ctx.createBufferSource();
    voiceSrc.buffer = memeBuf;
    voiceSrc.connect(out);
    voiceSrc.start(0, from, to - from);
    if (music) music.duck(to - from);
    return true;
  } catch (e) { return false; }
}
export const memeIndex = label => MEMES.findIndex(m => m[2].toLowerCase().includes(label.toLowerCase()));

// The engine note of your own ride, from idle to full chat.
const ENGINES = {
  bullet: { type: 'sawtooth', f0: 34, f1: 62, sub: 'square', lp: [380, 900], am: [5, 13], depth: 0.75, vol: 0.2 },
  nano: { type: 'triangle', f0: 62, f1: 170, sub: 'sawtooth', lp: [700, 1900], am: [0, 0], depth: 0, vol: 0.2 },
  auto: { type: 'square', f0: 70, f1: 160, sub: 'square', lp: [900, 1700], am: [16, 34], depth: 0.5, vol: 0.13 },
  scooter: { type: 'sawtooth', f0: 95, f1: 250, sub: 'triangle', lp: [1200, 2600], am: [28, 40], depth: 0.2, vol: 0.12 },
  moped: { type: 'square', f0: 120, f1: 300, sub: 'sawtooth', lp: [1500, 3200], am: [35, 50], depth: 0.25, vol: 0.09 },
  // Jihye's rickshaw: the secret battery's electric whine, with the chain ticking along
  rickshaw: { type: 'sine', f0: 150, f1: 560, sub: 'triangle', lp: [1800, 4200], am: [5, 18], depth: 0.18, vol: 0.12 },
};

// Lisa's horse has no engine: hooves clip-clop faster as it speeds up, with bells.
class Hooves {
  constructor() { this.ok = !!ctx; this.next = 0; this.n = 0; }
  set(s, boost, drift, off, on = true) {
    if (!this.ok || !on || muted) return;
    const t = ctx.currentTime;
    if (s < 0.05) { this.next = t; return; }
    if (t < this.next) return;
    const rate = 3 + Math.min(1.3, s) * 7 * (boost ? 1.25 : 1);
    this.n++;
    noise(0.05, { vol: 0.32, cutoff: this.n % 2 ? 1500 : 900, type: 'bandpass', q: 4 });
    tone(this.n % 2 ? 420 : 300, 0.05, { type: 'triangle', vol: 0.08 });
    if (this.n % 8 === 0) tone(2600 + Math.random() * 400, 0.12, { vol: 0.025 });
    if (drift && this.n % 3 === 0) noise(0.15, { vol: 0.08, cutoff: 3000, type: 'bandpass', q: 3 });
    this.next = Math.max(this.next + 1 / rate, t);
  }
  stop() { this.ok = false; }
}

export class Engine {
  constructor(veh) {
    this.ok = !!ctx;
    if (veh === 'tonga') return new Hooves();
    if (!this.ok) return;
    const E = ENGINES[veh] || ENGINES.nano;
    this.E = E;
    const t = ctx.currentTime;
    this.o1 = ctx.createOscillator(); this.o1.type = E.type;
    this.o2 = ctx.createOscillator(); this.o2.type = E.sub;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 2;
    this.amp = ctx.createGain(); this.amp.gain.value = 1 - E.depth / 2;
    this.lfo = ctx.createOscillator(); this.lfo.type = 'square';
    this.lfoG = ctx.createGain(); this.lfoG.gain.value = E.depth / 2;
    this.lfo.connect(this.lfoG).connect(this.amp.gain);
    this.vol = ctx.createGain(); this.vol.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.o1.connect(this.lp);
    this.o2.connect(g2).connect(this.lp);
    this.lp.connect(this.amp).connect(this.vol).connect(out);
    // tyre squeal and dirt rumble
    this.sq = ctx.createBufferSource(); this.sq.buffer = noiseBuf; this.sq.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 5;
    this.sqG = ctx.createGain(); this.sqG.gain.value = 0;
    this.sq.connect(bp).connect(this.sqG).connect(out);
    this.rm = ctx.createBufferSource(); this.rm.buffer = noiseBuf; this.rm.loop = true;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 260;
    this.rmG = ctx.createGain(); this.rmG.gain.value = 0;
    this.rm.connect(lp2).connect(this.rmG).connect(out);
    for (const n of [this.o1, this.o2, this.lfo, this.sq, this.rm]) n.start(t);
    this.set(0, false, false, false);
  }
  // s: 0..1 of top speed
  set(s, boost, drift, off, on = true) {
    if (!this.ok) return;
    const E = this.E, t = ctx.currentTime, k = 0.06;
    const x = Math.max(0, Math.min(1.4, s)) * (boost ? 1.12 : 1);
    const f = E.f0 + (E.f1 - E.f0) * x;
    this.o1.frequency.setTargetAtTime(f, t, k);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, k);
    this.lp.frequency.setTargetAtTime(E.lp[0] + (E.lp[1] - E.lp[0]) * x, t, k);
    if (E.am[1]) this.lfo.frequency.setTargetAtTime(E.am[0] + (E.am[1] - E.am[0]) * x, t, k);
    this.vol.gain.setTargetAtTime(on && !muted ? E.vol * (0.55 + 0.45 * Math.min(1, x)) : 0, t, 0.08);
    this.sqG.gain.setTargetAtTime(on && drift && !muted ? 0.05 + Math.random() * 0.02 : 0, t, 0.05);
    this.rmG.gain.setTargetAtTime(on && off && !muted ? 0.35 * Math.min(1, x) : 0, t, 0.08);
  }
  stop() {
    if (!this.ok) return;
    const t = ctx.currentTime;
    this.vol.gain.setTargetAtTime(0, t, 0.05);
    this.sqG.gain.setTargetAtTime(0, t, 0.05);
    this.rmG.gain.setTargetAtTime(0, t, 0.05);
    for (const n of [this.o1, this.o2, this.lfo, this.sq, this.rm]) { try { n.stop(t + 0.3); } catch (e) { /* ignore */ } }
    this.ok = false;
  }
}

// Android only — iPhones ignore vibration from web pages.
export function buzz(pattern) {
  if (!muted && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
}
