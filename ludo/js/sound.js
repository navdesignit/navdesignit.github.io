// Tiny synthesised sound effects + haptics, plus meme voice clips: on a kill, on a
// close call, and whenever someone taps one on the soundboard.
// iPhones only allow audio after a tap, so unlock() runs on the first touch.

// Meme clips packed into one file: [start, end] seconds and the soundboard label.
export const MEMES = [
  [0.0, 2.65, "Main lad raha hoon aapke liye"],
  [2.95, 5.6, "Mazaa nahi aa raha hai"],
  [5.9, 7.9, "Mister Donald Trump"],
  [8.2, 11.0, "Wah Modi ji wah"],
  [11.3, 15.25, "Wah kya scene hai"],
  [15.55, 17.55, "Ye PUBG wala hai kya?"],
  [17.85, 22.05, "Hum to fakir aadmi hain"],
  [22.35, 25.8, "Hypocrisy ki bhi seema"],
  [26.1, 28.35, "Is sajjan ko kya takleef hai"],
  [28.65, 32.75, "Moorkh samajhna band karo"],
  [33.05, 38.45, "Bachkana baatein"],
  [38.75, 43.05, "Jhooth bolo, baar baar"],
  [43.35, 48.64, "Kitne tejasvi log hain"],
  [48.94, 55.84, "Wahi baat… garib aadmi"],
  [56.14, 61.04, "Depression mein ho?"],
  [61.34, 66.49, "Alag hi level ka banda"],
  [66.79, 69.59, "🤔 Mystery meme"],
  [69.89, 75.79, "Sanitizer ka nasha band karo"],
  [76.09, 81.04, "Bade deshon mein… Senorita"],
  [81.34, 85.14, "System phaad denge"],
];
let memeBuf = null;
let memeSrc = null;

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
    fetch(new URL('../sounds/memes.mp3', import.meta.url))
      .then(r => r.arrayBuffer())
      .then(b => ctx.decodeAudioData(b, buf => { memeBuf = buf; }))
      .catch(() => { /* no clips: the synth kill sound still plays */ });
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

function memeClip(i = Math.floor(Math.random() * MEMES.length)) {
  if (!memeBuf || !MEMES[i]) return;
  const [from, to] = MEMES[i];
  if (memeSrc) memeSrc.stop(); // a new clip cuts off the last one instead of talking over it
  memeSrc = ctx.createBufferSource();
  memeSrc.buffer = memeBuf;
  memeSrc.connect(ctx.destination);
  memeSrc.start(0, from, to - from);
}

let stepN = 0;

const SOUNDS = {
  roll() { for (let i = 0; i < 7; i++) noise(0.04, { vol: 0.25, at: i * 0.06, cutoff: 3000 }); },
  // Footsteps, one per square: everyone sounds like their shoes.
  step(ch) {
    stepN += 1;
    switch (ch) {
      case 'ajay': tone(92, 0.16, { vol: 0.4, to: 48 }); noise(0.03, { vol: 0.15, cutoff: 3000 }); break; // dhol thump: the boss walks in
      case 'nav': tone([392, 330, 392, 262][stepN % 4], 0.08, { type: 'triangle', vol: 0.15 }); break; // sneaky tiptoe pizzicato
      case 'chechu': noise(0.06, { vol: 0.55, cutoff: 5200 }); tone(170, 0.05, { type: 'square', vol: 0.05, to: 110 }); break; // hawai chappal: chapak
      case 'vanshika': tone(2200, 0.03, { type: 'square', vol: 0.06 }); noise(0.025, { vol: 0.3, cutoff: 9000 }); break; // heels: tak
      case 'liu': tone(stepN % 2 ? 800 : 1150, 0.1, { vol: 0.13, to: stepN % 2 ? 1500 : 620 }); break; // squeaky clown shoes
      default: tone(520 + Math.random() * 80, 0.06, { type: 'triangle', vol: 0.12 });
    }
  },
  // A meme sting when someone lands.
  land(ch) {
    switch (ch) {
      case 'ajay': tone(68, 1, { vol: 0.65, to: 36 }); tone(136, 0.35, { type: 'triangle', vol: 0.18, to: 68 }); noise(0.3, { vol: 0.45, cutoff: 260 }); break; // vine boom
      case 'nav': [[196, 0, 0.18], [185, 0.22, 0.18], [147, 0.44, 1]].forEach(([f, at, d]) => { tone(f, d, { type: 'sawtooth', vol: 0.09, at }); tone(f / 2, d, { type: 'sawtooth', vol: 0.07, at }); }); break; // dun dun DUNNN
      case 'chechu': tone(1500, 0.8, { vol: 0.07, to: 2500 }); noise(0.85, { vol: 0.28, cutoff: 7500 }); break; // pressure cooker whistle
      case 'vanshika': [0, 0.17].forEach(at => { tone(330, 0.09, { type: 'square', vol: 0.12, to: 210, at }); noise(0.05, { vol: 0.45, cutoff: 2200, at }); }); break; // gavel: order, order
      case 'liu': tone(170, 0.28, { vol: 0.28, to: 720 }); tone(720, 0.32, { vol: 0.22, to: 230, at: 0.27 }); break; // boing
      default: break;
    }
  },
  six() { tone(880, 0.12, { type: 'square', vol: 0.08 }); tone(1320, 0.2, { type: 'square', vol: 0.08, at: 0.1 }); },
  kill() { tone(420, 0.25, { type: 'square', vol: 0.15, to: 70 }); noise(0.15, { vol: 0.25, cutoff: 800 }); memeClip(); },
  danger() { memeClip(); },
  kaboom() { noise(1.3, { vol: 0.9, cutoff: 500 }); tone(90, 0.9, { vol: 0.5, to: 30 }); tone(160, 0.3, { type: 'sawtooth', vol: 0.2, to: 40 }); },
  // Ramayana kill show: Ravana's laugh, heads popping, the three booms, and the death props.
  ravana() { [220, 196, 175, 147].forEach((f, i) => tone(f, 0.22, { type: 'sawtooth', vol: 0.16, to: f * 0.8, at: i * 0.21 })); },
  head() { tone(400 + Math.random() * 500, 0.1, { type: 'square', vol: 0.09, to: 1400 }); },
  boom() { noise(0.3, { vol: 0.55, cutoff: 600 }); tone(130, 0.3, { vol: 0.35, to: 40 }); },
  thud() { noise(0.3, { vol: 0.8, cutoff: 300 }); tone(75, 0.4, { vol: 0.45, to: 25 }); },
  whoosh() { noise(0.45, { vol: 0.35, cutoff: 4500 }); tone(1000, 0.4, { vol: 0.07, to: 180 }); },
  fire() { for (let i = 0; i < 7; i++) noise(0.12, { vol: 0.28, at: i * 0.08, cutoff: 1600 }); },
  // Cinematic kill: slow-mo dive, brass stab + cymbal + sub boom. Spare: a warm chord. Tense: a drone and a heartbeat.
  slowmo() { tone(600, 0.9, { vol: 0.1, to: 80 }); noise(0.9, { vol: 0.2, cutoff: 900 }); },
  hero() { [110, 165, 220, 277, 330].forEach(f => tone(f, 1.1, { type: 'sawtooth', vol: 0.07 })); noise(1.4, { vol: 0.4, cutoff: 7000 }); tone(55, 1.2, { vol: 0.5, to: 30 }); },
  spare() { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.9, { type: 'triangle', vol: 0.09, at: i * 0.12 })); },
  // TV serial sting: three tom hits with a tense chord, each a bit higher. Whistle: the loser slides home.
  dhan(i = 0) { const f = [72, 80, 92][i] || 92; noise(0.25, { vol: 0.9, cutoff: 420 }); tone(f, 0.7, { vol: 0.6, to: f * 0.5 }); [220, 262, 311].forEach(h => tone(h * (1 + i * 0.06), i === 2 ? 0.9 : 0.45, { type: 'sawtooth', vol: 0.06 })); },
  unlock() { [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.1, at: i * 0.08 })); },
  // Royal fanfare that turns sour: the Landu throne changes hands.
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: 'sawtooth', vol: 0.09, at: i * 0.14 })); [392, 370, 349, 330].forEach((f, i) => tone(f, 0.5, { type: 'sawtooth', vol: 0.09, to: f * 0.96, at: 0.8 + i * 0.3 })); },
  beep(i = 0) { tone([600, 800, 1200][i] || 1200, 0.14, { type: 'square', vol: 0.12 }); },
  whistle() { tone(300, 0.7, { vol: 0.12, to: 1400 }); tone(220, 0.1, { vol: 0.15, to: 60, at: 0.72 }); },
  tense() { tone(55, 1.6, { type: 'sawtooth', vol: 0.12 }); tone(58, 1.6, { type: 'sawtooth', vol: 0.1 }); [0, 0.25, 0.9, 1.15].forEach(at => tone(50, 0.18, { vol: 0.5, to: 30, at })); },
  box() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.12, at: i * 0.07 })); },
  home() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { vol: 0.14, at: i * 0.09 })); },
  sad() { [392, 370, 349, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, at: i * 0.22 })); },
  turn() { tone(660, 0.1, { vol: 0.12 }); tone(990, 0.16, { vol: 0.12, at: 0.1 }); },
  pop() { tone(700, 0.08, { vol: 0.1, to: 1100 }); },
  // Signature moves (js/finishers.js)
  gong() { tone(55, 1.8, { vol: 0.55, to: 44 }); [110, 166, 221, 279, 333].forEach((f, i) => tone(f, 1.6 - i * 0.2, { type: 'triangle', vol: 0.06 })); noise(0.5, { vol: 0.35, cutoff: 700 }); },
  crack() { noise(0.06, { vol: 0.9, cutoff: 9000 }); tone(950, 0.07, { type: 'square', vol: 0.12, to: 380 }); tone(150, 0.25, { vol: 0.45, to: 55 }); },
  crowd() { noise(2, { vol: 0.32, cutoff: 1800 }); noise(1.6, { vol: 0.18, cutoff: 3500, at: 0.15 }); [0.2, 0.7].forEach(at => tone(1900, 0.35, { vol: 0.05, to: 2600, at })); },
  ding() { tone(1320, 0.6, { vol: 0.16 }); tone(1980, 0.5, { vol: 0.07, at: 0.06 }); },
  keys() { for (let i = 0; i < 9; i++) noise(0.025, { vol: 0.3, cutoff: 6500, at: i * 0.065 + Math.random() * 0.02 }); },
  click() { tone(1700, 0.035, { type: 'square', vol: 0.1 }); noise(0.025, { vol: 0.35, cutoff: 7000 }); },
  glitch() { for (let i = 0; i < 12; i++) tone(180 + Math.random() * 2000, 0.045, { type: 'square', vol: 0.06, at: i * 0.06 }); },
  zap() { tone(1300, 0.4, { type: 'sawtooth', vol: 0.12, to: 50 }); noise(0.1, { vol: 0.3, cutoff: 5000 }); },
  clang() { [523, 1311, 2087, 2950].forEach((f, i) => tone(f, 1.3 - i * 0.25, { vol: 0.14 - i * 0.025 })); noise(0.08, { vol: 0.7, cutoff: 6000 }); tone(120, 0.3, { vol: 0.4, to: 50 }); },
  sizzle() { noise(1.3, { vol: 0.22, cutoff: 9000 }); noise(0.9, { vol: 0.12, cutoff: 4000, at: 0.3 }); },
  gavel() { tone(330, 0.09, { type: 'square', vol: 0.13, to: 210 }); noise(0.05, { vol: 0.5, cutoff: 2200 }); },
  bars() { tone(220, 0.7, { type: 'sawtooth', vol: 0.12, to: 170 }); tone(447, 0.6, { type: 'square', vol: 0.05 }); noise(0.18, { vol: 0.7, cutoff: 3200 }); },
  brush() { noise(0.22, { vol: 0.4, cutoff: 5200 }); tone(280, 0.2, { vol: 0.05, to: 900 }); },
  splat() { noise(0.12, { vol: 0.6, cutoff: 900 }); tone(170, 0.15, { vol: 0.22, to: 70 }); },
  tada() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.11, at: i * 0.07 })); },
  stamp() { noise(0.14, { vol: 0.85, cutoff: 500 }); tone(95, 0.28, { vol: 0.45, to: 48 }); },
  cooker() { tone(1500, 0.6, { vol: 0.08, to: 2600 }); noise(0.65, { vol: 0.3, cutoff: 7500 }); },
  alarm() { for (let i = 0; i < 5; i++) tone(i % 2 ? 660 : 880, 0.18, { type: 'square', vol: 0.08, at: i * 0.19 }); },
  win() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.08, at: i * 0.13 })); },
};

export function sfx(name, ...args) {
  if (muted || !ctx || !SOUNDS[name]) return;
  try { SOUNDS[name](...args); } catch (e) { /* never let sound break the game */ }
}

// Soundboard: play meme clip i.
export function playMeme(i) {
  if (muted || !ctx) return;
  try { memeClip(i); } catch (e) { /* never let sound break the game */ }
}

// Android only — iPhones ignore vibration from web pages.
export function buzz(pattern) {
  if (!muted && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
}
