// Tiny synthesised sound effects (no audio files to download) + haptics.
// iPhones only allow audio after a tap, so unlock() runs on the first touch.

let ctx = null;
let muted = false;
try { muted = localStorage.getItem('al_muted') === '1'; } catch (e) { /* private mode */ }

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('al_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, { type = 'sine', vol = 0.18, to = null, at = 0 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.3, at = 0, cutoff = 1200 } = {}) {
  const t = ctx.currentTime + at;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

const SOUNDS = {
  roll() { for (let i = 0; i < 7; i++) noise(0.04, { vol: 0.25, at: i * 0.06, cutoff: 3000 }); },
  step() { tone(520 + Math.random() * 80, 0.06, { type: 'triangle', vol: 0.12 }); },
  six() { tone(880, 0.12, { type: 'square', vol: 0.08 }); tone(1320, 0.2, { type: 'square', vol: 0.08, at: 0.1 }); },
  kill() { tone(420, 0.25, { type: 'square', vol: 0.15, to: 70 }); noise(0.15, { vol: 0.25, cutoff: 800 }); },
  kaboom() { noise(1.3, { vol: 0.9, cutoff: 500 }); tone(90, 0.9, { vol: 0.5, to: 30 }); tone(160, 0.3, { type: 'sawtooth', vol: 0.2, to: 40 }); },
  box() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.12, at: i * 0.07 })); },
  home() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { vol: 0.14, at: i * 0.09 })); },
  sad() { [392, 370, 349, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, at: i * 0.22 })); },
  turn() { tone(660, 0.1, { vol: 0.12 }); tone(990, 0.16, { vol: 0.12, at: 0.1 }); },
  pop() { tone(700, 0.08, { vol: 0.1, to: 1100 }); },
  win() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.08, at: i * 0.13 })); },
};

export function sfx(name) {
  if (muted || !ctx || !SOUNDS[name]) return;
  try { SOUNDS[name](); } catch (e) { /* never let sound break the game */ }
}

// Android only — iPhones ignore vibration from web pages.
export function buzz(pattern) {
  if (!muted && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
}
