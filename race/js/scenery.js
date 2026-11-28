// Builds a track's world: the road, kerbs and dusty shoulders, footpaths, shops with
// Hinglish signboards, poha and chai stalls, wires, trees, cows, the landmarks, and the
// mithai boxes. Static things are merged into a few chunked meshes (so the phone can
// skip what's behind the camera), and text lives in one atlas texture.

import { THREE, Batch, MAT, canvas, texture, noiseFill, seeded, hashStr, FONT, FONT2, Particles, radialTexture, textSprite } from './gfx.js';
import { HALF_W, KERB, SHOULDER } from './track.js';
import { buildRealBuildings } from './realcity.js';

// Real-street tracks load their buildings, side streets and gardens (from OpenStreetMap)
// just before the race; see tools/build-tracks.mjs.
const DATA = {};
export async function loadTrackData(id) {
  if (DATA[id] !== undefined) return DATA[id];
  try {
    const r = await fetch(new URL(`../tracks/${id}.json`, import.meta.url));
    DATA[id] = r.ok ? await r.json() : null;
  } catch (e) { DATA[id] = null; }
  return DATA[id];
}

const PI = Math.PI;
const FP0 = HALF_W + SHOULDER - 0.3;  // footpath starts here (the kart's wall)
const FP1 = FP0 + 2.2;                 // and ends here; buildings start beyond

export const THEMES = {
  day: { skyTop: '#3f95f0', skyBot: '#fde3bd', fog: '#f1d9b8', fogNear: 110, fogFar: 420, ground: '#b6935f', hemi: ['#ffffff', '#9a7a52', 1.35], sun: ['#fff3dc', 1.7], sunDir: [0.4, 1, 0.25], night: false },
  sunset: { skyTop: '#3b3d9e', skyBot: '#ff9752', fog: '#f59a6c', fogNear: 90, fogFar: 380, ground: '#9c7553', hemi: ['#ffd9b8', '#6b4a52', 1.25], sun: ['#ffb070', 1.5], sunDir: [-0.8, 0.45, 0.3], night: false },
  night: { skyTop: '#070822', skyBot: '#3a1f5e', fog: '#21173a', fogNear: 60, fogFar: 300, ground: '#463c4c', hemi: ['#9a92d8', '#2c2236', 1.0], sun: ['#a8b8ff', 0.55], sunDir: [0.3, 1, -0.4], night: true, lights: true },
  // golden hour going purple, with the stall lights already on
  dusk: { skyTop: '#2c2a72', skyBot: '#ff8a5c', fog: '#c27a74', fogNear: 85, fogFar: 360, ground: '#8a6a55', hemi: ['#ffd0b0', '#4a3550', 1.2], sun: ['#ff9a6a', 1.25], sunDir: [-0.7, 0.35, 0.4], night: false, lights: true },
  // Lutyens' Delhi on a hazy afternoon
  delhi: { skyTop: '#8fb0d6', skyBot: '#efe3cf', fog: '#d9ccb6', fogNear: 85, fogFar: 380, ground: '#7f9a4c', hemi: ['#fff6e6', '#8a7a5a', 1.35], sun: ['#fff0d0', 1.5], sunDir: [0.5, 1, 0.2], night: false },
  // the new city at night: glass towers, lit windows, no fairy lights
  city: { skyTop: '#060b26', skyBot: '#2a3274', fog: '#1d2250', fogNear: 70, fogFar: 340, ground: '#3c4054', hemi: ['#a9b8ff', '#2a2a3a', 1.1], sun: ['#b0c4ff', 0.65], sunDir: [0.3, 1, -0.4], night: true, lights: false },
};

const PASTELS = ['#f6a6b2', '#ffd27a', '#9fd3ff', '#b5e48c', '#ffb385', '#d0b3ff', '#f7f0d6', '#7fd1c7', '#ffe066', '#e8a87c', '#c9e4ff', '#ff9f9f'];
const NIGHT_PASTELS = ['#9a6e8a', '#a8926a', '#6a86a8', '#7d9a6a', '#a87d6a', '#8a7aa8', '#a8a090', '#5f938c'];

const SHOPS = [
  ['Sharma Poha Center', '#ffd23f', '#7a1f00'], ['Jai Ambe Chai', '#e63946', '#fff'], ['Guddu Mobile Repair', '#1d70d6', '#fff'],
  ['Pappu Paan Bhandar', '#2a9d3f', '#fff'], ['Raju Xerox', '#ffffff', '#c1121f'], ['Bittu Sweets', '#ff7b00', '#fff'],
  ['Sanju Tent House', '#6a00f4', '#ffe066'], ['Indori Namkeen', '#ffbe0b', '#3a0ca3'], ['Lucky Hair Saloon', '#ff4fa3', '#fff'],
  ['Mama Ji Dhaba', '#9d0208', '#ffd166'], ['Pinky Beauty Parlour', '#ff99c8', '#5a189a'], ['Golu Garage', '#212529', '#ffd60a'],
  ['Rinku Tailors', '#0077b6', '#fff'], ['Maa Durga Electricals', '#d00000', '#ffea00'], ['Bablu Bhutte Wala', '#ffea00', '#2b2d42'],
  ['Shubh Laabh Kirana', '#2a9d8f', '#fff'], ['Royal Mens Wear', '#14213d', '#fca311'], ['Om Sai Medical', '#06d6a0', '#073b4c'],
  ['Kanha Dairy', '#ffffff', '#1d3557'], ['Annapurna Bhojnalaya', '#f77f00', '#fff'], ['Tinku Tea Stall', '#8338ec', '#fff'],
  ['Lal Baba Kulfi', '#e5383b', '#fff'], ['Chhappan Bhog', '#ffb703', '#023047'], ['Sweet Home Jalebi', '#fb8500', '#fff'],
];
const BOARDS = [
  ['🏁 PON PON PRIX 🏁', '#1b0f33', '#ffd23f'],
  ['SAWDHANI HATI, DURGHATNA GHATI', '#ffd60a', '#000'], ['HORN OK PLEASE', '#e63946', '#ffe066'], ['INDORE: SWACHH NO.1 🏆', '#2a9d3f', '#fff'],
  ['GAAY CROSSING 🐄 DHEERE CHALO', '#ffffff', '#c1121f'], ['AAGE GADDHA HAI 🕳️', '#ff7b00', '#000'],
  ['DER SE PAHUCHNA, KABHI NA PAHUCHNE SE BEHTAR', '#1d70d6', '#fff'], ['BHIYA, POHA KHA LO 🍛', '#ff4fa3', '#fff'],
];

// Chhappan Dukan: Indore's food street.
const FOOD56 = [
  ['Khopra Patties', '#ffd23f', '#7a1f00'], ['Garadu', '#ff7b00', '#fff'], ['Shikanji', '#2a9d3f', '#fff'], ['Mawa Bati', '#9d0208', '#ffd166'],
  ['Bhutte ka Kees', '#ffea00', '#2b2d42'], ['Hot Dog 🌭', '#e63946', '#fff'], ['Dahi Vada', '#ffffff', '#1d70d6'], ['Sabudana Khichdi', '#f77f00', '#fff'],
  ['Egg Benjo 🍳', '#212529', '#ffd60a'], ['Pani Puri', '#8338ec', '#fff'], ['Coconut Crush', '#06d6a0', '#073b4c'], ['Kulfi Faluda', '#ff4fa3', '#fff'],
];
// Vijay Nagar and Scheme 114: the new city.
const MODERN = [
  ['SCHEME NO. 114 · SWAGAT HAI', '#0b3d91', '#ffffff'], ['VIJAY NAGAR', '#ffffff', '#0b3d91'], ['BOMBAY HOSPITAL', '#ffffff', '#c1121f'], ['H', '#1d70d6', '#ffffff'],
  ['MEGA MALL · SALE 50%', '#ff4fa3', '#ffffff'], ['IT PARK', '#14213d', '#7bdff2'], ['Cafe Coffee ☕', '#6f4518', '#fff8ec'], ['IIT-JEE COACHING · 100% RESULT', '#ffd60a', '#c1121f'],
  ['Pizza 🍕', '#e63946', '#fff'], ['Gym 💪 Fitness', '#212529', '#ff7b00'], ['BANK · ATM', '#023e8a', '#fff'], ['RING ROAD', '#2a9d3f', '#fff'],
  ['A.B. ROAD ➜', '#2a9d3f', '#fff'], ['56 DUKAN', '#ff7b00', '#ffffff'],
];

const DELHI = [
  ['SANSAD MARG', '#2a9d3f', '#fff'], ['SUPREME COURT ⚖️', '#ffffff', '#1d3557'], ['INDIA GATE', '#2a9d3f', '#fff'], ['Chole Bhature', '#ffb703', '#7a1f00'],
  ['DILLI POLICE · AAPKE LIYE SADAIV', '#1d3557', '#ffffff'], ['AQI 999 😷 MASK PEHNO', '#6c757d', '#ffffff'], ['Rajma Chawal', '#9d0208', '#fff'], ['VIP MOVEMENT · DHEERE CHALO', '#c1121f', '#fff'],
];
const COLONY = [
  ['RAJIV AWAS VIHAR · SWAGAT HAI', '#0b3d91', '#ffffff'], ['Mobile Zone 📱', '#212529', '#ffd60a'], ['Kirti Boutique', '#ff99c8', '#5a189a'], ['Jain Kirana Store', '#2a9d8f', '#fff'],
  ['Doodh Dairy 🥛', '#1d70d6', '#fff'], ['Xerox · Lamination', '#ffffff', '#c1121f'], ['TOPPER CLASSES · MP BOARD', '#ffd60a', '#c1121f'], ['Balaji Provision Store', '#ff7b00', '#fff'],
];

// One texture holds every signboard: 4 columns × 24 rows of 2:1 cells.
let atlas = null;
const ALL_SIGNS = [...SHOPS, ...BOARDS, ...FOOD56, ...MODERN, ...DELHI, ...COLONY];
const SIGN_ROWS = 24;
const cellOf = text => ALL_SIGNS.findIndex(e => e[0] === text);
const FOOD_CELLS = FOOD56.map(e => cellOf(e[0]));
const DELHI_CELLS = ['Chole Bhature', 'Rajma Chawal', 'Cafe Coffee ☕', 'BANK · ATM'].map(t => ALL_SIGNS.findIndex(e => e[0] === t));
const COLONY_CELLS = COLONY.slice(1).map(e => e[0]).map(t => ALL_SIGNS.findIndex(e => e[0] === t));
const MODERN_SHOP_CELLS = ['Cafe Coffee ☕', 'Pizza 🍕', 'Gym 💪 Fitness', 'BANK · ATM', 'IIT-JEE COACHING · 100% RESULT', 'MEGA MALL · SALE 50%', 'IT PARK'].map(cellOf);
function signAtlas() {
  if (atlas) return atlas;
  const W = 1024, H = 128 * SIGN_ROWS, cw = 256, ch = 128;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const all = ALL_SIGNS;
  all.forEach(([text, bg, fg], i) => {
    const x = (i % 4) * cw, y = Math.floor(i / 4) * ch;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 7, y + 7, cw - 14, ch - 14);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    const lines = [];
    let line = '';
    ctx.font = `30px ${FONT}`;
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > cw - 34 && line) { lines.push(line); line = w; } else line = t;
    }
    lines.push(line);
    const size = lines.length > 2 ? 22 : lines.length > 1 ? 28 : 34;
    ctx.font = `${size}px ${FONT}`;
    lines.forEach((l, k) => {
      let s = size;
      while (ctx.measureText(l).width > cw - 30 && s > 12) { s -= 2; ctx.font = `${s}px ${FONT}`; }
      ctx.fillText(l, x + cw / 2, y + ch / 2 + (k - (lines.length - 1) / 2) * size * 1.12 + 2);
      ctx.font = `${size}px ${FONT}`;
    });
  });
  atlas = { tex: texture(c), cells: all.length, shops: SHOPS.length };
  return atlas;
}

// Textured quads that all share the sign atlas.
class Signs {
  constructor() { this.p = []; this.uv = []; }
  // centre (x,y,z), facing angle `ang` (the quad faces direction (cos, sin)), width, cell
  add(x, y, z, ang, w, cell, h = w / 2) {
    const fx = Math.cos(ang), fz = Math.sin(ang);
    const rx = -fz, rz = fx; // right-hand side when facing the sign
    const hw = w / 2, hh = h / 2;
    const P = [[x - rx * hw, y - hh, z - rz * hw], [x + rx * hw, y - hh, z + rz * hw], [x + rx * hw, y + hh, z + rz * hw], [x - rx * hw, y + hh, z - rz * hw]];
    const u0 = (cell % 4) / 4, v1 = 1 - Math.floor(cell / 4) / SIGN_ROWS, u1 = u0 + 0.25, v0 = v1 - 1 / SIGN_ROWS;
    const UV = [[u1, v0], [u0, v0], [u0, v1], [u1, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { this.p.push(...P[k]); this.uv.push(...UV[k]); }
  }
  mesh() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: signAtlas().tex, side: THREE.DoubleSide }));
  }
}

// ---------------------------------------------------------------- textures

function roadTexture(night) {
  const c = canvas(256, 512);
  const x = c.getContext('2d');
  const rng = seeded(11);
  noiseFill(x, 256, 512, night ? '#3c3c44' : '#57585f', 60, 9000, 2, rng);
  for (let i = 0; i < 6; i++) { // repair patches and oil stains
    x.fillStyle = rng() < 0.5 ? 'rgba(20,20,26,0.35)' : 'rgba(120,120,130,0.18)';
    x.beginPath();
    x.ellipse(rng() * 256, rng() * 512, 10 + rng() * 30, 14 + rng() * 40, rng() * 3, 0, PI * 2);
    x.fill();
  }
  x.fillStyle = '#f4f1e6';
  x.fillRect(7, 0, 5, 512);
  x.fillRect(244, 0, 5, 512);
  for (const y of [0, 256]) x.fillRect(125, y + 40, 6, 128);
  return texture(c, { repeat: true });
}

function kerbTexture() {
  const c = canvas(16, 64);
  const x = c.getContext('2d');
  x.fillStyle = '#ffcd00'; x.fillRect(0, 0, 16, 32);
  x.fillStyle = '#1c1c1c'; x.fillRect(0, 32, 16, 32);
  return texture(c, { repeat: true });
}

function dirtTexture(base) {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  const rng = seeded(5);
  noiseFill(x, 256, 256, base, 50, 6000, 3, rng);
  for (let i = 0; i < 140; i++) {
    x.fillStyle = `rgba(${rng() < 0.5 ? '90,70,50' : '240,225,200'},${0.25 + rng() * 0.3})`;
    x.fillRect(rng() * 256, rng() * 256, 2 + rng() * 4, 2 + rng() * 3);
  }
  return texture(c, { repeat: true });
}

function groundTexture(base, night) {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  const rng = seeded(9);
  noiseFill(x, 256, 256, base, 40, 5000, 3, rng);
  for (let i = 0; i < 18; i++) {
    x.fillStyle = night ? 'rgba(60,80,60,0.35)' : `rgba(110,150,70,${0.25 + rng() * 0.3})`;
    x.beginPath();
    x.ellipse(rng() * 256, rng() * 256, 10 + rng() * 30, 8 + rng() * 26, rng() * 3, 0, PI * 2);
    x.fill();
  }
  return texture(c, { repeat: true });
}

function tileTexture(night) {
  const c = canvas(64, 64);
  const x = c.getContext('2d');
  x.fillStyle = night ? '#6a6070' : '#b9aaa0';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = night ? '#7d5a5a' : '#c46d5e';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14);
  return texture(c, { repeat: true });
}

function chevronTexture() {
  const c = canvas(64, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#ff6a00';
  x.fillRect(0, 0, 64, 128);
  x.fillStyle = '#ffe14d';
  for (const y of [0, 64]) {
    x.beginPath();
    x.moveTo(0, y + 40); x.lineTo(32, y + 8); x.lineTo(64, y + 40); x.lineTo(64, y + 60); x.lineTo(32, y + 28); x.lineTo(0, y + 60);
    x.fill();
  }
  return texture(c, { repeat: true });
}

function checkerTexture() {
  const c = canvas(128, 32);
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); }
  const t = texture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

function mithaiTexture() {
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, '#ff5fa2'); g.addColorStop(1, '#ff8a3d');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#ffd23f'; x.lineWidth = 10; x.strokeRect(5, 5, 118, 118);
  x.fillStyle = '#ffd23f'; x.fillRect(56, 0, 16, 128); x.fillRect(0, 56, 128, 16);
  x.font = `bold 70px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 8; x.strokeStyle = '#7a1f3d'; x.strokeText('?', 64, 68);
  x.fillStyle = '#fff'; x.fillText('?', 64, 68);
  return texture(c);
}

function skyTexture(th) {
  const c = canvas(2, 256);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, th.skyTop); g.addColorStop(0.75, th.skyBot); g.addColorStop(1, th.fog);
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  if (th.night) {
    // stars
    const t = texture(c, { aniso: false });
    return t;
  }
  return texture(c, { aniso: false });
}

// ---------------------------------------------------------------- road geometry

// A strip along the track between lateral offsets a(i) and b(i) (left is positive).
function ribbon(T, a, b, yOff, vLen, { uScale = null } = {}) {
  const { N, X, Y, Z, NX, NZ, step } = T;
  const reps = Math.max(1, Math.round(T.L / vLen));
  const vs = reps / T.L;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const j = i % N;
    const da = a(j), db = b(j);
    const y = Y[j] + (typeof yOff === 'function' ? yOff(j) : yOff);
    pos.push(X[j] + NX[j] * da, y, Z[j] + NZ[j] * da, X[j] + NX[j] * db, y, Z[j] + NZ[j] * db);
    const v = i * step * vs;
    const ua = uScale ? da / uScale : 0, ub = uScale ? db / uScale : 1;
    uv.push(ua, v, ub, v);
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// A vertical strip (walls, kerb faces, railings) at lateral d(i) from y0(i) to y1(i).
function wall(T, d, y0, y1, color, keep = () => true) {
  const { N, X, Y, Z, NX, NZ } = T;
  const pos = [], col = [], idx = [];
  const c = new THREE.Color(color);
  let n = 0;
  for (let i = 0; i <= N; i++) {
    const j = i % N, jn = (i + 1) % N;
    const dd = d(j);
    pos.push(X[j] + NX[j] * dd, Y[j] + y0(j), Z[j] + NZ[j] * dd, X[j] + NX[j] * dd, Y[j] + y1(j), Z[j] + NZ[j] * dd);
    col.push(c.r, c.g, c.b, c.r * 1.08, c.g * 1.08, c.b * 1.08);
    if (i < N && keep(j) && keep(jn)) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); n++; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return n ? g : null;
}

// ---------------------------------------------------------------- props

function cow(b, lying = false) {
  const white = '#f4f1ea', grey = '#d8d2c6', dark = '#3a2f2a';
  const y = lying ? -0.45 : 0;
  b.box([0, 1.05 + y, 0], [1.7, 0.75, 0.75], white);
  b.box([0.35, 1.5 + y, 0], [0.45, 0.25, 0.5], grey); // hump
  b.box([1.0, 1.35 + y * 0.6, 0], [0.5, 0.42, 0.4], white);
  b.box([1.3, 1.25 + y * 0.6, 0], [0.22, 0.26, 0.32], '#f0c4b4');
  for (const s of [-1, 1]) {
    b.shape('cone', [0.95, 1.65 + y * 0.6, 0.16 * s], [0.06, 0.32, 0.06], s > 0 ? '#ff7a1a' : '#1d70d6', [0.6 * s, 0, 0]);
    b.box([0.92, 1.42 + y * 0.6, 0.27 * s], [0.12, 0.08, 0.16], grey);
  }
  b.shape('sph6', [0.78, 1.0 + y * 0.6, 0], [0.12, 0.12, 0.12], '#ffcc1a'); // bell
  for (let i = 0; i < 8; i++) { const a = (i / 7) * PI; b.shape('sph6', [0.8, 1.15 + y * 0.6 - Math.sin(a) * 0.25, Math.cos(a) * 0.3], [0.07, 0.07, 0.07], i % 2 ? '#ff9f1c' : '#ffd23f'); }
  if (!lying) for (const [x, z] of [[-0.6, -0.25], [-0.6, 0.25], [0.6, -0.25], [0.6, 0.25]]) b.box([x, 0.35, z], [0.16, 0.7, 0.16], grey);
  else for (const [x, z] of [[-0.5, 0.42], [0.5, 0.42]]) b.box([x, 0.15, z], [0.6, 0.14, 0.14], grey, [0, 0.3, 0]);
  b.rod([-0.85, 1.3 + y, 0], [-1.05, 0.6 + y * 0.5, 0], 0.04, grey);
  b.shape('sph6', [-0.4, 1.2 + y, 0.38], [0.28, 0.2, 0.02], dark);
}

function person(b, x, z, ang, rng, y = 0) {
  const shirts = ['#e63946', '#1d70d6', '#ffd23f', '#2a9d3f', '#ff7b00', '#f1faee', '#8338ec', '#ff4fa3'];
  const shirt = shirts[Math.floor(rng() * shirts.length)];
  b.shape('cyl8', [x, y + 0.45, z], [0.18, 0.9, 0.18], rng() < 0.5 ? '#2b2d42' : '#6b4f3a');
  b.shape('cyl8', [x, y + 1.15, z], [0.24, 0.6, 0.2], shirt, [0, ang, 0]);
  b.shape('sph6', [x, y + 1.62, z], [0.17, 0.2, 0.17], '#8d5524');
  b.shape('sph6', [x, y + 1.72, z], [0.17, 0.1, 0.17], '#1b1b1b');
}

function tree(b, x, z, rng, kind = rng() < 0.75 ? 'neem' : 'palm') {
  if (kind === 'palm') {
    const h = 7 + rng() * 4;
    b.rod([x, 0, z], [x + 0.6, h, z + 0.3], 0.22, '#8b6b4a');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      b.box([x + 0.6 + Math.cos(a) * 1.6, h - 0.3, z + 0.3 + Math.sin(a) * 1.6], [3.4, 0.08, 0.7], '#3f8f3a', [0, -a, -0.35]);
    }
    for (let i = 0; i < 3; i++) b.shape('sph6', [x + 0.6 + (i - 1) * 0.3, h - 0.5, z + 0.3], [0.25, 0.25, 0.25], '#5a7a2a');
    return;
  }
  const h = 3 + rng() * 2.5, r = 2.4 + rng() * 1.6;
  b.rod([x, 0, z], [x, h + 0.8, z], 0.28, '#6b4f3a');
  const greens = ['#3f8f3a', '#4ea345', '#2f7a2f', '#5fae4a'];
  for (let i = 0; i < 3; i++) b.shape('ico', [x + (rng() - 0.5) * r, h + 1 + rng() * 1.6, z + (rng() - 0.5) * r], [r * (0.7 + rng() * 0.3), r * 0.65, r * (0.7 + rng() * 0.3)], greens[Math.floor(rng() * 4)], [0, rng() * 3, 0]);
}

// Stalls sit on the footpath's outer edge, facing the road (local +x faces the road).
const STALLS = {
  poha(b, rng) {
    b.box([0, 0.85, 0], [1.4, 0.12, 2.4], '#8b5a2b');
    b.box([0, 0.45, 0], [1.3, 0.7, 2.3], '#3f6fb5');
    for (const [x, z] of [[-0.5, -1], [-0.5, 1], [0.5, -1], [0.5, 1]]) b.shape('cyl', [x, 0.18, z], [0.18, 0.08, 0.18], '#222', [PI / 2, 0, 0]);
    b.shape('cyl', [0.1, 1.0, -0.5], [0.55, 0.18, 0.55], '#c0c4ca');
    b.shape('sph', [0.1, 1.1, -0.5], [0.5, 0.22, 0.5], '#ffd43c');
    b.shape('cyl', [0.1, 0.98, 0.6], [0.45, 0.14, 0.45], '#c0c4ca');
    b.shape('sph6', [0.1, 1.06, 0.6], [0.4, 0.12, 0.4], '#ff8c1a');
    b.rod([-0.6, 0.9, 0], [-0.6, 3.0, 0], 0.05, '#555');
    b.shape('cone', [-0.6, 3.1, 0], [2.0, 0.6, 2.0], rng() < 0.5 ? '#e63946' : '#2a9d3f');
  },
  chai(b, rng) {
    b.box([-0.4, 1.3, 0], [1.8, 2.6, 2.6], '#d9a066');
    b.box([-0.2, 2.75, 0], [2.4, 0.12, 3.0], '#8a9199', [0, 0, 0.12]);
    b.box([0.55, 1.0, 0], [0.4, 0.1, 2.4], '#6b4f3a');
    b.box([0.55, 0.5, 0], [0.4, 1.0, 2.4], '#a0522d');
    b.shape('cyl', [0.55, 1.15, -0.6], [0.22, 0.12, 0.22], '#222');
    b.shape('cyl', [0.55, 1.32, -0.6], [0.2, 0.26, 0.2], '#c0c4ca');
    for (let i = 0; i < 5; i++) b.shape('cyl8', [0.6, 1.12, 0.1 + i * 0.18], [0.05, 0.12, 0.05], '#f4e4c1');
    b.box([1.6, 0.4, 0], [0.5, 0.08, 2.2], '#6b4f3a');
    for (const z of [-0.9, 0.9]) b.box([1.6, 0.2, z], [0.4, 0.4, 0.08], '#6b4f3a');
  },
  jalebi(b, rng) {
    b.box([0, 0.5, 0], [1.6, 1.0, 2.6], '#ffb703');
    b.shape('cyl', [0.2, 1.08, -0.4], [0.7, 0.16, 0.7], '#333');
    for (let i = 0; i < 6; i++) b.shape('tor', [0.2 + (i % 3 - 1) * 0.35, 1.2, -0.4 + (i > 2 ? 0.3 : -0.2)], [0.13, 0.13, 0.13], '#ff8c1a', [PI / 2, 0, 0]);
    b.box([0.2, 1.08, 0.7], [0.9, 0.1, 0.9], '#c0c4ca');
    for (let i = 0; i < 6; i++) b.shape('tor', [0.0 + (i % 3) * 0.25, 1.18, 0.5 + Math.floor(i / 3) * 0.3], [0.1, 0.1, 0.1], '#ffa62b', [PI / 2, 0, 0]);
    for (const z of [-1.2, 1.2]) b.rod([-0.7, 1.0, z], [-0.7, 2.8, z], 0.05, '#555');
    b.box([-0.2, 2.85, 0], [2.0, 0.08, 2.8], '#ff4fa3');
  },
  bhutta(b, rng) {
    b.box([0, 0.55, 0], [1.1, 0.5, 1.6], '#6b4f3a');
    b.shape('cyl', [0.1, 0.9, 0], [0.4, 0.18, 0.4], '#333');
    b.shape('cyl', [0.1, 0.97, 0], [0.32, 0.04, 0.32], '#ff5a1f');
    for (let i = 0; i < 5; i++) b.shape('cyl8', [0.1 + (i - 2) * 0.12, 1.03, 0.0], [0.05, 0.4, 0.05], '#ffd43c', [PI / 2, 0, 0.2]);
    for (let i = 0; i < 8; i++) b.shape('cyl8', [-0.2 + (i % 4) * 0.12, 0.85, 0.5 + Math.floor(i / 4) * 0.12], [0.06, 0.42, 0.06], '#9acd32', [PI / 2, 0, 0]);
  },
  fruit(b, rng) {
    b.box([0, 0.75, 0], [1.4, 0.1, 2.6], '#8b5a2b');
    for (const [x, z] of [[-0.5, -1.1], [-0.5, 1.1], [0.5, -1.1], [0.5, 1.1]]) b.shape('cyl', [x, 0.3, z], [0.3, 0.08, 0.3], '#222', [PI / 2, 0, 0]);
    const kind = rng() < 0.5 ? ['#ffe14d', 'banana'] : ['#3f8f3a', 'coconut'];
    for (let i = 0; i < 14; i++) b.shape('sph6', [-0.4 + (i % 4) * 0.27, 0.95 + Math.floor(i / 8) * 0.25, -0.9 + (i % 7) * 0.3], kind[1] === 'banana' ? [0.12, 0.1, 0.3] : [0.22, 0.24, 0.22], kind[0]);
  },
};
const STALL_SIGNS = { poha: 0, chai: 1, jalebi: 23, bhutta: 14, fruit: 15 };

function building(b, rng, w, dep, h, night) {
  const pal = night ? NIGHT_PASTELS : PASTELS;
  const col = pal[Math.floor(rng() * pal.length)];
  b.box([0, h / 2, 0], [dep, h, w], col);
  b.box([dep / 2 + 0.05, 1.3, 0], [0.12, 2.5, w * 0.8], night ? '#5a6273' : '#8c95a3'); // shutter
  b.box([dep / 2 + 0.6, 2.9, 0], [1.2, 0.08, w], '#9b8c7a'); // chhajja
  const floors = Math.floor((h - 3) / 3);
  for (let f = 0; f < floors; f++) {
    const y = 4.6 + f * 3;
    const nw = Math.max(1, Math.floor(w / 3));
    for (let k = 0; k < nw; k++) {
      const z = (k - (nw - 1) / 2) * (w / nw);
      b.box([dep / 2 + 0.04, y, z], [0.1, 1.3, 1.1], night ? (rng() < 0.6 ? '#ffd88a' : '#2a2438') : '#2f3b4f');
    }
    if (rng() < 0.45) b.box([dep / 2 + 0.5, y - 0.9, 0], [1.0, 0.12, w * 0.6], '#7d6a5a');
    if (rng() < 0.3) b.box([dep / 2 + 0.25, y + 0.2, w * 0.3], [0.5, 0.45, 0.8], '#e9e9e9');
  }
  if (rng() < 0.6) {
    const tz = (rng() - 0.5) * w * 0.5;
    b.shape('cyl', [-dep * 0.2, h + 0.7, tz], [0.75, 1.4, 0.75], '#1e1e1e');
    b.box([-dep * 0.2, h + 0.03, tz], [1.6, 0.06, 1.6], '#777');
  }
  if (rng() < 0.3) b.rod([0, h, -w * 0.3], [0, h + 2.5, -w * 0.3], 0.03, '#777');
  if (rng() < 0.25) b.box([0, h + 0.5, 0], [dep, 1, 0.15], col);
}

// Vijay Nagar's glass towers. Lit window strips go in `g`, an unlit batch, so they glow at night.
function tower(b, g, rng, w, dep, h, night) {
  const glass = ['#2b4c7e', '#1f6f8b', '#3a506b', '#22577a', '#4a4e69', '#355c7d'][Math.floor(rng() * 6)];
  const frame = night ? '#3a4058' : '#d5dde6';
  b.box([0, h / 2, 0], [dep, h, w], glass);
  (night ? g : b).box([dep / 2 + 0.06, 1.9, 0], [0.1, 3.4, w * 0.9], night ? '#dfeaff' : '#a9c6e8');
  b.box([dep / 2 + 0.7, 3.75, 0], [1.4, 0.2, w], frame);
  const floors = Math.floor((h - 4.5) / 3.4);
  for (let f = 0; f < floors; f++) {
    const y = 4.6 + f * 3.4;
    b.box([0, y, 0], [dep + 0.08, 0.2, w + 0.08], frame);
    if (night) {
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        if (rng() < 0.35) continue;
        const len = w * (0.15 + rng() * 0.3), z = (rng() - 0.5) * (w - len);
        g.box([dep / 2 + 0.05, y + 1.6, z], [0.06, 1.7, len], rng() < 0.7 ? '#ffe7a3' : '#cfe6ff');
      }
    } else if (rng() < 0.5) b.box([dep / 2 + 0.05, y + 1.6, 0], [0.06, 1.4, w * 0.9], '#9ec3e6');
  }
  b.box([0, h + 0.6, 0], [dep * 0.7, 1.2, w * 0.7], frame);
  if (rng() < 0.5) b.rod([0, h + 1.2, 0], [0, h + 6, 0], 0.08, '#888');
  if (night && rng() < 0.5) g.shape('sph6', [0, h + 6.1, 0], [0.25, 0.25, 0.25], '#ff3030');
}

// A food stall on Chhappan Dukan: counter, steel bowls and a bright canopy.
function foodStall(b, g, rng, lit) {
  const canopy = ['#e63946', '#ffb703', '#2a9d8f', '#8338ec', '#ff4fa3', '#1d70d6'][Math.floor(rng() * 6)];
  b.box([0, 0.55, 0], [1.4, 1.1, 3], '#f1e3c8');
  b.box([0.71, 0.55, 0], [0.04, 0.9, 2.8], canopy);
  b.box([0, 1.12, 0], [1.5, 0.06, 3.1], '#c0c4ca');
  for (let k = 0; k < 4; k++) b.shape('cyl', [0.25, 1.22, -1.1 + k * 0.72], [0.25, 0.12, 0.25], k % 2 ? '#c0c4ca' : '#9aa1ab');
  for (let k = 0; k < 4; k++) b.shape('sph6', [0.25, 1.3, -1.1 + k * 0.72], [0.2, 0.1, 0.2], ['#ffd43c', '#ff8c1a', '#f4e4c1', '#2fbf55'][k]);
  for (const z of [-1.5, 1.5]) for (const x of [-0.7, 0.7]) b.rod([x, 0, z], [x, 2.9, z], 0.04, '#555');
  b.box([0.1, 3.0, 0], [2.0, 0.1, 3.4], canopy, [0, 0, -0.18]);
  if (lit) for (let k = 0; k < 6; k++) g.shape('sph6', [0.95, 2.75, -1.5 + k * 0.6], [0.07, 0.07, 0.07], ['#ffd166', '#ff4fa3', '#7bdff2'][k % 3]);
}

// Bombay Hospital on the ring road (front faces +x).
function hospital(b, g, night) {
  b.box([0, 10, 0], [22, 20, 44], '#f2f4f7');
  b.box([0, 21, -12], [14, 2, 10], '#e3e7ec');
  for (let r = 0; r < 5; r++) for (let c = 0; c < 11; c++) (night && (r + c) % 3 ? g : b).box([11.05, 4.5 + r * 3.3, -17.5 + c * 3.5], [0.1, 1.8, 2.4], night ? '#cfe6ff' : '#7fb0d8');
  b.box([13, 3.4, 0], [5, 0.4, 14], '#e3e7ec');
  for (const z of [-6, 6]) b.box([15, 1.7, z], [0.5, 3.4, 0.5], '#ced4da');
  b.box([11.1, 1.6, 0], [0.1, 3.0, 6], night ? '#ffffff' : '#bcd4e6');
  // an ambulance waiting outside
  b.box([17, 1.1, -12], [5, 2, 2.2], '#ffffff');
  b.box([17, 1.2, -10.88], [5.02, 0.35, 0.02], '#c1121f');
  b.box([17, 1.2, -13.12], [5.02, 0.35, 0.02], '#c1121f');
  (night ? g : b).box([17.8, 2.2, -12], [0.6, 0.2, 1.4], '#2f7bff');
  for (const [x, z] of [[15.5, -11], [15.5, -13], [18.5, -11], [18.5, -13]]) b.shape('cyl', [x, 0.4, z], [0.4, 0.25, 0.4], '#222', [PI / 2, 0, 0]);
}

// A mall: a big box with a glass front.
function mall(b, g, night) {
  b.box([0, 9, 0], [30, 18, 50], '#cfc6bd');
  (night ? g : b).box([15.05, 7, 0], [0.1, 12, 30], night ? '#bfe0ff' : '#7aa6c9');
  b.box([17, 4, 0], [4, 0.4, 16], '#b8aea3');
  for (let k = 0; k < 6; k++) b.box([15.1, 15.5, -20 + k * 8], [0.2, 1.2, 5], ['#ff4fa3', '#ffd23f', '#06d6a0'][k % 3]);
}

// Bhawarkuan-style coaching institute, with its students outside.
function coaching(b, g, rng, night) {
  b.box([0, 7, 0], [12, 14, 16], '#f6e7c1');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) (night ? g : b).box([6.05, 5 + r * 3.2, -5.4 + c * 3.6], [0.1, 1.6, 2.2], night ? '#ffe7a3' : '#2f3b4f');
  for (let k = 0; k < 10; k++) person(b, 8 + rng() * 4, -6 + rng() * 12, rng() * 6, rng);
}

// An arch over the road, with marigold strings and a banner both ways.
function arch(b, signs, T, i0, cell, { pillar = '#c1121f', beam = '#ff6b35', H = 7.5 } = {}) {
  const fx = T.TX[i0], fz = T.TZ[i0], nx = T.NX[i0], nz = T.NZ[i0], y0 = T.Y[i0];
  for (const s of [-1, 1]) {
    const px = T.X[i0] + nx * s * (HALF_W + 2.2), pz = T.Z[i0] + nz * s * (HALF_W + 2.2);
    b.box([px, y0 + H / 2, pz], [1.2, H, 1.2], pillar, [0, -T.ANG[i0], 0]);
    b.shape('sph', [px, y0 + H + 0.6, pz], [0.9, 0.9, 0.9], '#ffcd00');
    for (let k = 0; k < 14; k++) b.shape('sph6', [px + fx * 0.65, y0 + 0.5 + k * 0.5, pz + fz * 0.65], [0.28, 0.28, 0.28], k % 2 ? '#ff9f1c' : '#ffd23f');
  }
  const lx = T.X[i0] + nx * (HALF_W + 2.2), lz = T.Z[i0] + nz * (HALF_W + 2.2);
  const rx = T.X[i0] - nx * (HALF_W + 2.2), rz = T.Z[i0] - nz * (HALF_W + 2.2);
  b.box([(lx + rx) / 2, H - 0.4 + y0, (lz + rz) / 2], [0.8, 1.6, 2 * HALF_W + 5.6], beam, [0, -T.ANG[i0], 0]);
  for (let k = 0; k <= 40; k++) {
    const f = k / 40, sag = Math.sin(f * PI) * 1.6;
    for (const off of [-0.5, 0.5]) b.shape('sph6', [lx + (rx - lx) * f + fx * off, H - 1.4 - sag + y0, lz + (rz - lz) * f + fz * off], [0.3, 0.3, 0.3], (k + (off > 0 ? 1 : 0)) % 2 ? '#ff9f1c' : '#ffd23f');
  }
  const mid = [(lx + rx) / 2, H - 0.4 + y0, (lz + rz) / 2];
  signs.add(mid[0] - fx * 0.45, mid[1], mid[2] - fz * 0.45, T.ANG[i0] + PI, 9, cell, 1.5);
  signs.add(mid[0] + fx * 0.45, mid[1], mid[2] + fz * 0.45, T.ANG[i0], 9, cell, 1.5);
}

// ---------------------------------------------------------------- the world

export function buildWorld(T, scene) {
  const def = T.def;
  const th = THEMES[def.theme] || THEMES.day;
  const night = th.night;
  const style = def.style || 'old';
  const data = DATA[T.id];
  const real = !!(def.real && data); // real streets: buildings, side roads and gardens from OpenStreetMap
  const rng = seeded(hashStr(T.id));
  const group = new THREE.Group();
  const anim = { strips: null, boxes: null, cows: [], kites: null, lights: null, t: 0 };

  // sky, fog, light
  scene.background = skyTexture(th);
  scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  const hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]);
  const sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
  sun.position.set(...th.sunDir);
  group.add(hemi, sun);

  // bounds and a spatial grid of the centre line, to keep props off the road
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < T.N; i++) { minX = Math.min(minX, T.X[i]); maxX = Math.max(maxX, T.X[i]); minZ = Math.min(minZ, T.Z[i]); maxZ = Math.max(maxZ, T.Z[i]); }
  const CELL = 16, grid = new Map();
  const key = (gx, gz) => gx * 10007 + gz;
  for (let i = 0; i < T.N; i++) {
    const k = key(Math.floor(T.X[i] / CELL), Math.floor(T.Z[i] / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const roadDist = (x, z) => {
    let best = Infinity;
    const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL);
    for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) {
      const list = grid.get(key(gx + a, gz + c));
      if (list) for (const i of list) best = Math.min(best, Math.hypot(x - T.X[i], z - T.Z[i]));
    }
    return best;
  };
  const clear = (x, z, r) => roadDist(x, z) > FP1 + 0.4 + r;

  // ground
  const gw = Math.max(maxX - minX, maxZ - minZ) + 900;
  const gTex = groundTexture(th.ground, night);
  gTex.repeat.set(gw / 26, gw / 26);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gw), new THREE.MeshLambertMaterial({ map: gTex }));
  ground.rotation.x = -PI / 2;
  ground.position.set((minX + maxX) / 2, -0.02, (minZ + maxZ) / 2);
  group.add(ground);

  // road, kerbs, shoulders, footpaths
  const el = i => T.elevated[i];
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture(night), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const road = new THREE.Mesh(ribbon(T, () => HALF_W, () => -HALF_W, 0.06, 16), roadMat);
  group.add(road);
  const kerbMat = new THREE.MeshLambertMaterial({ map: kerbTexture(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  group.add(new THREE.Mesh(ribbon(T, () => HALF_W + KERB, () => HALF_W, 0.09, 3), kerbMat));
  group.add(new THREE.Mesh(ribbon(T, () => -HALF_W, () => -HALF_W - KERB, 0.09, 3), kerbMat));
  const dirt = dirtTexture(night ? '#5a4a42' : '#c8a46e');
  const dirtMat = new THREE.MeshLambertMaterial({ map: dirt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  // the shoulder narrows with the kart's limit (T.lim) into the flyover
  const sh = i => Math.max(HALF_W + KERB, Math.min(FP0, T.lim[i] + 1.2));
  group.add(new THREE.Mesh(ribbon(T, sh, () => HALF_W + KERB, 0.04, 8, { uScale: 8 }), dirtMat));
  group.add(new THREE.Mesh(ribbon(T, () => -HALF_W - KERB, i => -sh(i), 0.04, 8, { uScale: 8 }), dirtMat));
  const tiles = tileTexture(night);
  const fpMat = new THREE.MeshLambertMaterial({ map: tiles });
  const fp1 = i => (el(i) ? HALF_W + KERB : sh(i) + 2.2);
  group.add(new THREE.Mesh(ribbon(T, fp1, sh, 0.32, 2, { uScale: 2 }), fpMat));
  group.add(new THREE.Mesh(ribbon(T, i => -sh(i), i => -fp1(i), 0.32, 2, { uScale: 2 }), fpMat));
  const kerbFace = new THREE.MeshLambertMaterial({ map: kerbTexture() });
  for (const s of [1, -1]) {
    // the footpath's kerb face, painted in the same black and yellow
    const g = new THREE.BufferGeometry();
    const { N, X, Y, Z, NX, NZ, step } = T;
    const pos = [], uv = [], idx = [];
    const reps = Math.round(T.L / 3);
    for (let i = 0; i <= N; i++) {
      const j = i % N, d = s * sh(j);
      const lo = el(j) ? 0.06 : 0.04, hi = el(j) ? 0.06 : 0.32 + (FP0 - sh(j)) * 0.12;
      pos.push(X[j] + NX[j] * d, Y[j] + lo, Z[j] + NZ[j] * d, X[j] + NX[j] * d, Y[j] + hi, Z[j] + NZ[j] * d);
      const v = (i * step * reps) / T.L;
      uv.push(0, v, 1, v);
      if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: kerbFace.map, side: THREE.DoubleSide })));
  }

  // flyover: railings, retaining walls, deck and pillars
  if (T.elevated.some(v => v)) {
    const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const rail = wall(T, () => s * (HALF_W + KERB + 0.1), () => 0.05, () => 1.0, '#cfcac0', el);
      if (rail) group.add(new THREE.Mesh(rail, wallMat));
      const stripe = wall(T, () => s * (HALF_W + KERB + 0.12), () => 0.75, () => 1.0, '#ffcd00', el);
      if (stripe) group.add(new THREE.Mesh(stripe, wallMat));
      const ret = wall(T, () => s * (HALF_W + KERB + 0.1), i => -T.Y[i], () => 0.05, '#b8a48c', i => el(i) && !T.bridge[i]);
      if (ret) group.add(new THREE.Mesh(ret, wallMat));
      const deck = wall(T, () => s * (HALF_W + KERB + 0.1), () => -1.3, () => 0.05, '#a9a39a', i => T.bridge[i]);
      if (deck) group.add(new THREE.Mesh(deck, wallMat));
    }
    const under = ribbon(T, i => (T.bridge[i] ? -(HALF_W + KERB + 0.1) : 0), i => (T.bridge[i] ? HALF_W + KERB + 0.1 : 0), -1.3, 10);
    group.add(new THREE.Mesh(under, new THREE.MeshLambertMaterial({ color: '#8d877f', side: THREE.DoubleSide })));
    const pb = new Batch();
    for (let i = 0; i < T.N; i += 5) {
      if (!T.bridge[i]) continue;
      for (const s of [-1, 1]) {
        const x = T.X[i] + T.NX[i] * s * (HALF_W - 1.5), z = T.Z[i] + T.NZ[i] * s * (HALF_W - 1.5);
        // only where the lower road isn't
        let ok = true;
        for (let k = 0; k < T.N; k += 2) if (T.Y[k] < 1 && Math.hypot(T.X[k] - x, T.Z[k] - z) < HALF_W + 1.6) { ok = false; break; }
        if (ok) pb.box([x, (T.Y[i] - 1.3) / 2, z], [1.4, T.Y[i] - 1.3, 1.4], '#b5afa5', [0, -T.ANG[i], 0]);
      }
    }
    if (!pb.empty) group.add(pb.mesh());
  }

  // start line and the marigold gate
  {
    const i0 = 0;
    const fx = T.TX[i0], fz = T.TZ[i0], nx = T.NX[i0], nz = T.NZ[i0];
    const pos = [];
    for (const [a, d] of [[-1, HALF_W], [-1, -HALF_W], [1, -HALF_W], [1, HALF_W]]) pos.push(T.X[i0] + fx * a * 1.2 + nx * d, T.Y[i0] + 0.1, T.Z[i0] + fz * a * 1.2 + nz * d);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: checkerTexture(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })));
    const b = new Batch();
    const banner = new Signs();
    arch(b, banner, T, i0, cellOf('🏁 PON PON PRIX 🏁'));
    // the track's own welcome arches (56 Dukan, Scheme 114)
    for (const [f, kind] of def.arches || []) {
      const cell = cellOf(kind === 'gate56' ? '56 DUKAN' : 'SCHEME NO. 114 · SWAGAT HAI');
      arch(b, banner, T, T.at(f * T.L), cell, kind === 'gate56' ? { pillar: '#ff7b00', beam: '#8338ec', H: 8 } : { pillar: '#0b3d91', beam: '#ffffff', H: 8 });
    }
    group.add(b.mesh());
    group.add(banner.mesh());
  }

  // speed breakers, potholes, boost strips
  {
    const b = new Batch();
    for (const s of T.breakers) {
      const i = T.at(s);
      const t = new THREE.Vector3(T.TX[i], 0, T.TZ[i]), n = new THREE.Vector3(T.NX[i], 0, T.NZ[i]);
      const segs = 8;
      for (let k = 0; k < segs; k++) {
        const d = -HALF_W + (k + 0.5) * (2 * HALF_W / segs);
        const m = new THREE.Matrix4().makeBasis(t.clone().multiplyScalar(1.1), n.clone().multiplyScalar(2 * HALF_W / segs), new THREE.Vector3(0, 0.36, 0));
        m.setPosition(T.X[i] + T.NX[i] * d, T.Y[i] + 0.04, T.Z[i] + T.NZ[i] * d);
        b.add(unitCyl(), m, k % 2 ? '#1c1c1c' : '#ffcd00');
      }
    }
    for (const p of T.potholes) {
      b.shape('cyl', [p.x, p.y + 0.08, p.z], [p.r + 0.35, 0.02, p.r * 0.8 + 0.3], night ? '#2e2e33' : '#6b6a66', [0, rng() * 3, 0]);
      b.shape('cyl', [p.x, p.y + 0.1, p.z], [p.r, 0.02, p.r * 0.8], '#1a1612', [0, rng() * 3, 0]);
      b.shape('cyl', [p.x + 0.2, p.y + 0.115, p.z], [p.r * 0.5, 0.01, p.r * 0.35], night ? '#2b3550' : '#5f7186', [0, rng() * 3, 0]);
    }
    if (!b.empty) group.add(b.mesh());
    const chev = chevronTexture();
    const sMat = new THREE.MeshBasicMaterial({ map: chev, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    for (const st of T.boosts) {
      const pos = [], uv = [], idx = [];
      const n = Math.ceil(st.len / T.step);
      const i0 = T.at(st.s);
      for (let k = 0; k <= n; k++) {
        const i = (i0 + k) % T.N;
        for (const [d, u] of [[st.d + st.half, 0], [st.d - st.half, 1]]) pos.push(T.X[i] + T.NX[i] * d, T.Y[i] + 0.1, T.Z[i] + T.NZ[i] * d), uv.push(u, k * T.step / 3.5);
        if (k < n) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, sMat);
      group.add(m);
    }
    anim.strips = chev;
  }

  // the scenery, chunked along the lap
  const CHUNKS = 8;
  const chunks = Array.from({ length: CHUNKS }, () => new Batch());
  const signs = Array.from({ length: CHUNKS }, () => new Signs());
  const glows = Array.from({ length: CHUNKS }, () => new Batch()); // unlit: lit windows, bulbs
  const wires = [];
  const bulbs = th.lights ? new Particles(2400, { additive: true, maxPx: 14 }) : null;
  const lampGlow = [];
  const chunkOf = i => Math.min(CHUNKS - 1, Math.floor((i / T.N) * CHUNKS));
  const at = (i, d, dz = 0) => ({ x: T.X[i] + T.NX[i] * d + T.TX[i] * dz, z: T.Z[i] + T.NZ[i] * d + T.TZ[i] * dz });
  const place = (b, from, x, y, z, ang) => b.transform(from, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang), new THREE.Vector3(1, 1, 1)));
  const stallKinds = style === 'food' ? ['food56', 'food56', 'jalebi', 'food56', 'bhutta', 'chai', 'food56', 'fruit']
    : def.theme === 'night' ? ['jalebi', 'bhutta', 'poha', 'chai', 'jalebi', 'fruit'] : ['poha', 'chai', 'fruit', 'poha', 'chai', 'bhutta'];

  // special buildings at fixed spots (Bombay Hospital, the mall, the coaching class)
  const reserved = [];
  for (const [f, kind, side] of def.spots || []) {
    const i = T.at(f * T.L);
    const [w, dep] = { hospital: [46, 22], mall: [50, 30], coaching: [16, 12] }[kind];
    const p = at(i, side * (FP1 + 1.5 + dep / 2));
    if (!clear(p.x, p.z, Math.min(w, dep) * 0.5)) continue;
    const ch = chunkOf(i), b = chunks[ch], g = glows[ch];
    const face = T.ANG[i] + (side > 0 ? PI / 2 : -PI / 2); // towards the road
    const fb = b.mark(), fg = g.mark();
    if (kind === 'hospital') hospital(b, g, night);
    else if (kind === 'mall') mall(b, g, night);
    else coaching(b, g, rng, night);
    place(b, fb, p.x, 0, p.z, face);
    place(g, fg, p.x, 0, p.z, face);
    const front = (x, y, wd, cell, ht) => { const q = at(i, side * (FP1 + 1.5 + dep / 2 - x)); signs[ch].add(q.x, y, q.z, face, wd, cell, ht); };
    if (kind === 'hospital') { front(dep / 2 + 0.2, 17.5, 16, cellOf('BOMBAY HOSPITAL')); front(dep / 2 + 0.2, 4.6, 3, cellOf('H'), 3); }
    else if (kind === 'mall') front(dep / 2 + 0.3, 15.5, 16, cellOf('MEGA MALL · SALE 50%'));
    else front(dep / 2 + 0.2, 12.5, 11, cellOf('IIT-JEE COACHING · 100% RESULT'));
    reserved.push({ side, s0: f * T.L - w / 2 - 3, s1: f * T.L + w / 2 + 3 });
  }

  // ---- the real city: landmarks at their real spots, then real buildings round them
  const discs = [];
  for (const [f, kind, side] of def.spots || []) { const i = T.at(f * T.L); const [w, dep] = { hospital: [46, 22], mall: [50, 30], coaching: [16, 12] }[kind]; const p = at(i, side * (FP1 + 1.5 + dep / 2)); discs.push([p.x, p.z, Math.max(w, dep) * 0.55]); }
  const occupied = new Set(), occKey = (x, z) => `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
  if (real) {
    const R = { rajwada: 26, chhatri: 18, temple: 14, food56: 16, hospital: 26, fountain: 16, parliament: 40, oldparliament: 36, indiagate: 14, court: 34, watertank: 10, hall: 12, coaching: 6 };
    const landmarks = new Batch(), lglow = new Batch(), lsigns = new Signs();
    for (const [kind, mx, mz] of def.marks || []) {
      const rad = R[kind] || 12;
      let x = mx, z = mz;
      // a landmark far off the route comes closer (same direction), so you see it while racing
      {
        let bi = 0, bdd = Infinity;
        for (let i = 0; i < T.N; i += 2) { const d = Math.hypot(T.X[i] - x, T.Z[i] - z); if (d < bdd) { bdd = d; bi = i; } }
        if (bdd > 90) { const f = 70 / bdd; x = T.X[bi] + (x - T.X[bi]) * f; z = T.Z[bi] + (z - T.Z[bi]) * f; }
      }
      // nudge it off the road if the real spot is too close (karts need their footpath)
      for (let k = 0; k < 60 && roadDist(x, z) < FP1 + rad * 0.8; k++) {
        let bi = 0, bdd = Infinity;
        for (let i = 0; i < T.N; i += 2) { const d = Math.hypot(T.X[i] - x, T.Z[i] - z); if (d < bdd) { bdd = d; bi = i; } }
        const dx = x - T.X[bi], dz = z - T.Z[bi], l = Math.hypot(dx, dz) || 1;
        x += (dx / l) * 2; z += (dz / l) * 2;
      }
      let ci = 0, cd = Infinity;
      for (let i = 0; i < T.N; i += 2) { const d = Math.hypot(T.X[i] - x, T.Z[i] - z); if (d < cd) { cd = d; ci = i; } }
      const ang = Math.atan2(T.Z[ci] - z, T.X[ci] - x); // facing the road
      const fb = landmarks.mark(), fg = lglow.mark();
      switch (kind) {
        case 'rajwada': rajwada(landmarks); break;
        case 'chhatri': chhatri(landmarks); break;
        case 'temple': temple(landmarks); break;
        case 'food56': foodPlaza(landmarks, rng); break;
        case 'hospital': hospital(landmarks, lglow, night); break;
        case 'fountain': fountainSquare(landmarks); break;
        case 'parliament': parliament(landmarks); break;
        case 'oldparliament': oldParliament(landmarks); break;
        case 'indiagate': indiaGate(landmarks); break;
        case 'court': supremeCourt(landmarks); break;
        case 'watertank': waterTower(landmarks); break;
        case 'hall': communityHall(landmarks); break;
        case 'coaching': {
          landmarks.rod([0, 0, -4.6], [0, 9, -4.6], 0.15, '#555'); landmarks.rod([0, 0, 4.6], [0, 9, 4.6], 0.15, '#555');
          const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: toppersTexture(), side: THREE.DoubleSide }));
          board.position.set(x, 8.5, z);
          board.rotation.y = -ang + PI / 2;
          group.add(board);
          break;
        }
        default: break;
      }
      const big = ['parliament', 'oldparliament', 'indiagate', 'court'].includes(kind) ? 1.3 : 1;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang), new THREE.Vector3(big, big, big));
      landmarks.transform(fb, m);
      lglow.transform(fg, m);
      discs.push([x, z, rad]);
      const sign = { hospital: 'BOMBAY HOSPITAL', parliament: 'SANSAD MARG', court: 'SUPREME COURT ⚖️', indiagate: 'INDIA GATE', food56: '56 DUKAN', fountain: 'VIJAY NAGAR', hall: 'RAJIV AWAS VIHAR · SWAGAT HAI' }[kind];
      if (sign) {
        const off = { hospital: 12, parliament: 36, court: 22, indiagate: 9, food56: 8, fountain: 3, hall: 7.4 }[kind];
        const hy = { hospital: 17.5, parliament: 6, court: 6, indiagate: 3, food56: 9, fountain: 13, hall: 7 }[kind];
        lsigns.add(x + Math.cos(ang) * off, hy, z + Math.sin(ang) * off, ang, kind === 'fountain' ? 12 : 10, cellOf(sign), kind === 'fountain' ? 6 : 5);
      }
    }
    if (!landmarks.empty) group.add(landmarks.mesh());
    if (!lglow.empty) group.add(lglow.mesh(MAT.vcBasic));
    if (lsigns.p.length) group.add(lsigns.mesh());

    // real buildings
    const inDisc = (x, z) => discs.some(([dx, dz, r]) => Math.hypot(x - dx, z - dz) < r);
    const nearIdx = (x, z) => { let bi = 0, bdd = Infinity; const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL); for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) { const list = grid.get(key(gx + a, gz + c)); if (list) for (const i of list) { const d = Math.hypot(x - T.X[i], z - T.Z[i]); if (d < bdd) { bdd = d; bi = i; } } } return [bi, bdd]; };
    const signCells = style === 'modern' ? MODERN_SHOP_CELLS : style === 'delhi' ? DELHI_CELLS : style === 'colony' ? COLONY_CELLS : style === 'food' ? FOOD_CELLS.concat([0, 1, 5, 7, 22, 23]) : Array.from({ length: SHOPS.length }, (_, k) => k);
    buildRealBuildings(group, data, {
      style, night, chunks: CHUNKS, roofs: chunks, props: chunks, signs, signCells,
      chunkOf: (x, z) => chunkOf(nearIdx(x, z)[0]),
      roadNear: (x, z) => { const [i, d] = nearIdx(x, z); const dx = x - T.X[i], dz = z - T.Z[i], l = Math.hypot(dx, dz) || 1; return { d, nx: dx / l, nz: dz / l }; },
      skip: (x, z) => inDisc(x, z),
    });
    for (const bld of data.buildings || []) { // mark the ground every real building covers
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 1; k < bld.length; k += 2) { x0 = Math.min(x0, bld[k]); x1 = Math.max(x1, bld[k]); z0 = Math.min(z0, bld[k + 1]); z1 = Math.max(z1, bld[k + 1]); }
      for (let x = x0; x <= x1 + 5.9; x += 6) for (let z = z0; z <= z1 + 5.9; z += 6) occupied.add(occKey(Math.min(x, x1), Math.min(z, z1)));
    }
    for (const [x, z, r] of discs) for (let a = -r; a <= r; a += 5) for (let c = -r; c <= r; c += 5) occupied.add(occKey(x + a, z + c));

    // the other real streets (side roads, the colony's X lanes): drawn, not raced on
    const sp = [], si = [], suv = [];
    for (const rd of data.roads || []) {
      const w = rd[0] / 2;
      for (let k = 1; k + 3 < rd.length; k += 2) {
        const ax = rd[k], az = rd[k + 1], bx = rd[k + 2], bz = rd[k + 3];
        const l = Math.hypot(bx - ax, bz - az);
        if (l < 0.1) continue;
        const nx = -(bz - az) / l * w, nz = (bx - ax) / l * w, ex = (bx - ax) / l * w * 0.5, ez = (bz - az) / l * w * 0.5;
        const base = sp.length / 3;
        sp.push(ax + nx - ex, 0.035, az + nz - ez, ax - nx - ex, 0.035, az - nz - ez, bx + nx + ex, 0.035, bz + nz + ez, bx - nx + ex, 0.035, bz - nz + ez);
        suv.push(0, 0, 1, 0, 0, l / 6, 1, l / 6);
        si.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        for (let t = 0; t <= l; t += 5) occupied.delete(occKey(ax + (bx - ax) * t / l, az + (bz - az) * t / l));
      }
    }
    if (sp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2));
      g.setIndex(si);
      g.computeVertexNormals();
      const lane = roadTexture(night);
      lane.repeat.set(0.5, 1);
      group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: lane, color: night ? '#9a9aa6' : '#d8d8de', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
    }

    // gardens and udyaans: grass, a little white railing, trees, a swing and a bench
    const pb = new Batch();
    const grass = new THREE.MeshLambertMaterial({ map: groundTexture('#5f9a3a', night), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const gp = [];
    for (const pk of data.parks || []) {
      const pts = [];
      for (let k = 0; k < pk.length; k += 2) pts.push([pk[k], pk[k + 1]]);
      let tris = [];
      try { tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []); } catch (e) { tris = []; }
      for (const [a, b2, c] of tris) for (const q of [a, b2, c]) gp.push(pts[q][0], 0.05, pts[q][1]);
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], c = pts[(k + 1) % pts.length];
        pb.rod([a[0], 0.5, a[1]], [c[0], 0.5, c[1]], 0.05, '#f2f2f2');
        pb.rod([a[0], 0, a[1]], [a[0], 0.7, a[1]], 0.07, '#f2f2f2');
      }
      const cx = pts.reduce((v, p) => v + p[0], 0) / pts.length, cz = pts.reduce((v, p) => v + p[1], 0) / pts.length;
      for (let k = 0; k < Math.min(5, pts.length); k++) { const p = pts[k]; tree(pb, cx + (p[0] - cx) * 0.55, cz + (p[1] - cz) * 0.55, rng, 'neem'); }
      // a swing and a bench in every garden
      pb.rod([cx - 1.2, 0, cz], [cx - 1.2, 2.6, cz], 0.07, '#c1121f'); pb.rod([cx + 1.2, 0, cz], [cx + 1.2, 2.6, cz], 0.07, '#c1121f');
      pb.rod([cx - 1.2, 2.6, cz], [cx + 1.2, 2.6, cz], 0.07, '#c1121f'); pb.box([cx, 0.6, cz], [0.8, 0.06, 0.4], '#ffd23f');
      pb.box([cx, 0.45, cz + 2.4], [1.8, 0.1, 0.5], '#8b5a2b');
    }
    if (gp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); const uv = []; for (let k = 0; k < gp.length; k += 3) uv.push(gp[k] / 12, gp[k + 2] / 12); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); group.add(new THREE.Mesh(g, grass)); }
    if (!pb.empty) group.add(pb.mesh());

    // name boards for the gardens, schools and hospitals near the route
    const COL = { park: '#2a9d3f', school: '#1d70d6', hospital: '#c1121f', clinic: '#c1121f', supermarket: '#ff7b00' };
    for (const [name, x, z, kind] of (data.names || []).slice(0, 12)) {
      const board = textSprite(name, { color: '#fff', bg: COL[kind] || '#2a9d3f', stroke: null, size: 40, font: FONT2 + ' bold', height: 1.4 });
      board.position.set(x, 4.2, z);
      board.renderOrder = 3;
      group.add(board);
      const pole = new Batch(); pole.rod([x, 0, z], [x, 3.5, z], 0.08, '#666'); group.add(pole.mesh());
    }
  }

  for (const side of [1, -1]) {
    let s = rng() * 6;
    while (s < T.L - 4) {
      const i = T.at(s);
      if (T.elevated[i] || T.elevated[(i + 6) % T.N] || T.elevated[(i - 6 + T.N) % T.N]) { s += 8; continue; }
      if (reserved.some(q => q.side === side && s > q.s0 && s < q.s1)) { s += 4; continue; }
      const ch = chunkOf(i), b = chunks[ch], g = glows[ch];
      const face = T.ANG[i] + (side > 0 ? -PI / 2 : PI / 2); // direction from the building to the road
      const r = rng();
      const stallP = style === 'food' ? 0.62 : style === 'modern' ? 0.05 : def.theme === 'night' ? 0.32 : 0.16;
      if (style === 'delhi' && real) { // Lutyens' avenues: a tree every few metres
        const p = at(i, side * (FP0 + 1.1));
        if (clear(p.x, p.z, -1.6) && rng() < 0.7) tree(b, p.x, p.z, rng, 'neem');
      }
      if (r < stallP) {
        const kind = stallKinds[Math.floor(rng() * stallKinds.length)];
        const p = at(i, side * (real ? FP0 + 1.0 : FP1 + 1.4));
        if (clear(p.x, p.z, real ? -1.5 : 1.4)) {
          const from = b.mark(), fromG = g.mark();
          if (kind === 'food56') foodStall(b, g, rng, th.lights); else STALLS[kind](b, rng);
          place(b, from, p.x, 0, p.z, face + PI);
          place(g, fromG, p.x, 0, p.z, face + PI);
          const sp = at(i, side * (real ? FP0 + 1.2 : FP1 + 1.4 + 0.2));
          const cell = kind === 'food56' ? FOOD_CELLS[Math.floor(rng() * FOOD_CELLS.length)] : STALL_SIGNS[kind];
          signs[ch].add(sp.x, kind === 'chai' ? 3.2 : kind === 'food56' ? 3.55 : 2.3, sp.z, face + PI, kind === 'food56' ? 2.6 : 1.8, cell);
          for (let k = 0; k < 1 + Math.floor(rng() * 3); k++) {
            const q = at(i, side * (FP0 + 0.6 + rng() * 1.2), (rng() - 0.5) * 4);
            person(b, q.x, q.z, rng() * 6, rng, 0.32);
          }
          if (bulbs) for (let k = 0; k < 3; k++) { const q = at(i, side * (FP1 + 0.6), (k - 1) * 1.2); bulbs.emit(q.x, 2.6 + (k % 2) * 0.2, q.z, 0, 0, 0, 1e9, 0.7, ['#ffd166', '#ff4fa3', '#7bdff2'][k], 0); }
          s += 4 + rng() * 3;
          continue;
        }
      }
      if (r < 0.8 && !(real && style === 'delhi')) {
        const modern = style === 'modern';
        const w = modern ? 10 + rng() * 8 : 6 + rng() * 6, dep = modern ? 10 + rng() * 6 : 7 + rng() * 5;
        const h = modern ? 16 + rng() * 30 : style === 'food' || style === 'colony' ? 6.8 + Math.floor(rng() * 2) * 3.2 : 6.8 + Math.floor(rng() * 3) * 3.2;
        const p = at(i, side * (FP1 + 0.5 + dep / 2));
        // on real streets, only fill the gaps between the real buildings
        let gap = true;
        if (real) for (let a = -w / 2; a <= w / 2 && gap; a += 3) for (let c = -dep / 2; c <= dep / 2 && gap; c += 3) { const q = at(i, side * (FP1 + 0.5 + dep / 2 + c), a); if (occupied.has(occKey(q.x, q.z))) gap = false; }
        if (gap && clear(p.x, p.z, Math.max(w, dep) * 0.45)) {
          const from = b.mark(), fromG = g.mark();
          if (modern) tower(b, g, rng, w, dep, h, night); else building(b, rng, w, dep, h, night);
          place(b, from, p.x, 0, p.z, face + PI);
          place(g, fromG, p.x, 0, p.z, face + PI);
          if (rng() < 0.75) {
            const sp = at(i, side * (FP1 + 0.5 - 0.15));
            const cell = modern ? MODERN_SHOP_CELLS[Math.floor(rng() * MODERN_SHOP_CELLS.length)]
              : style === 'food' && rng() < 0.6 ? FOOD_CELLS[Math.floor(rng() * FOOD_CELLS.length)] : Math.floor(rng() * SHOPS.length);
            signs[ch].add(sp.x, modern ? 4.4 : 3.55, sp.z, face + PI, Math.min(w * 0.9, modern ? 7 : 5.5), cell);
          }
          // second row behind, taller
          if (rng() < 0.6) {
            const w2 = 8 + rng() * 6, d2 = 8 + rng() * 6, h2 = modern ? 30 + rng() * 40 : 9 + rng() * 12;
            const p2 = at(i, side * (FP1 + 1 + dep + d2 / 2 + 1));
            if (clear(p2.x, p2.z, Math.max(w2, d2) * 0.45)) {
              const f2 = b.mark(), g2 = g.mark();
              if (modern) tower(b, g, rng, w2, d2, h2, night); else building(b, rng, w2, d2, h2, night);
              place(b, f2, p2.x, 0, p2.z, face + PI);
              place(g, g2, p2.x, 0, p2.z, face + PI);
            }
          }
          s += w + 0.6;
          continue;
        }
      }
      if (r < 0.95) {
        const p = at(i, side * (FP1 + 2.5));
        if (clear(p.x, p.z, 2) && !occupied.has(occKey(p.x, p.z))) tree(b, p.x, p.z, rng);
      }
      s += 7 + rng() * 4;
    }
  }

  // street lamps, electric poles and their tangled wires, fairy lights at night
  const fairy = !!th.lights;
  for (let s = 5; s < T.L; s += fairy ? 22 : 30) {
    const i = T.at(s);
    if (T.elevated[i]) continue;
    const b = chunks[chunkOf(i)];
    const side = fairy ? (Math.floor(s / 22) % 2 ? 1 : -1) : style === 'modern' ? (Math.floor(s / 30) % 2 ? 1 : -1) : 1;
    const p = at(i, side * (FP0 + 0.7));
    if (!clear(p.x, p.z, -2.3)) continue;
    b.rod([p.x, 0.3, p.z], [p.x, 7.2, p.z], 0.11, '#5d5d66');
    const q = at(i, side * (FP0 - 1.5));
    b.rod([p.x, 7.0, p.z], [q.x, 7.3, q.z], 0.06, '#5d5d66');
    b.box([q.x, 7.15, q.z], [0.6, 0.18, 0.4], '#3a3a42', [0, -T.ANG[i], 0]);
    lampGlow.push([q.x, 7.0, q.z]);
    if (style === 'modern' && !fairy) {
      // the new city: lamps on both sides, no tangle of wires
      const o = at(i, -side * (FP0 + 0.7)), q2 = at(i, -side * (FP0 - 1.5));
      if (clear(o.x, o.z, -2.3)) {
        b.rod([o.x, 0.3, o.z], [o.x, 7.2, o.z], 0.11, '#5d5d66');
        b.rod([o.x, 7.0, o.z], [q2.x, 7.3, q2.z], 0.06, '#5d5d66');
        b.box([q2.x, 7.15, q2.z], [0.6, 0.18, 0.4], '#3a3a42', [0, -T.ANG[i], 0]);
        lampGlow.push([q2.x, 7.0, q2.z]);
      }
    } else if (!fairy) {
      const r = at(i, -side * (FP0 + 0.8));
      if (clear(r.x, r.z, -2.3)) {
        b.rod([r.x, 0.3, r.z], [r.x, 8.5, r.z], 0.14, '#6e6458');
        b.box([r.x, 8.2, r.z], [0.18, 0.12, 1.6], '#4a4038', [0, -T.ANG[i], 0]);
        wires.push([r.x, 8.2, r.z]);
      }
    } else {
      // a string of fairy lights across the road
      const o = at(i, -side * (FP0 + 0.7));
      b.rod([o.x, 0.3, o.z], [o.x, 7.2, o.z], 0.08, '#5d5d66');
      const cols = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#ff4fa3', '#ffffff'];
      for (let k = 0; k <= 34; k++) {
        const f = k / 34;
        const x = p.x + (o.x - p.x) * f, z = p.z + (o.z - p.z) * f;
        bulbs.emit(x, 7.0 - Math.sin(f * PI) * 1.6, z, 0, 0, 0, 1e9, 0.6, cols[k % cols.length], 0);
      }
    }
  }
  // wires: four sagging cables between neighbouring poles, plus the odd extra tangle
  const wirePos = [];
  if (wires.length) {
    for (let w = 0; w < wires.length; w++) {
      const a = wires[w], c = wires[(w + 1) % wires.length];
      if (Math.hypot(a[0] - c[0], a[2] - c[2]) > 45) continue;
      const n = 3 + (w % 3 === 0 ? 2 : 0);
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * 0.35, sag = 0.7 + ((k * 7 + w) % 5) * 0.3;
        let prev = null;
        for (let q = 0; q <= 8; q++) {
          const f = q / 8;
          const pt = [a[0] + (c[0] - a[0]) * f, a[1] - Math.sin(f * PI) * sag + off * 0.3, a[2] + (c[2] - a[2]) * f + off];
          if (prev) wirePos.push(...prev, ...pt);
          prev = pt;
        }
      }
    }
    if (wirePos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(wirePos, 3));
      group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#2a2a2a' })));
    }
  }

  // billboards with road-safety wisdom
  for (let k = 0; k < 7; k++) {
    const s = ((k + 0.35) / 7) * T.L;
    const i = T.at(s);
    if (T.elevated[i]) continue;
    const side = k % 2 ? 1 : -1;
    const p = at(i, side * (FP1 + 3));
    if (!clear(p.x, p.z, 1)) continue;
    const b = chunks[chunkOf(i)];
    const face = T.ANG[i] + PI + side * 0.5; // angled towards oncoming karts
    b.rod([p.x, 0, p.z], [p.x, 6, p.z], 0.15, '#555');
    signs[chunkOf(i)].add(p.x, 7.6, p.z, face, 8, SHOPS.length + 1 + (k % (BOARDS.length - 1)), 4);
  }

  // landmark in the middle of the track
  {
    let best = null, bd = 0;
    for (let x = minX; x <= maxX; x += 6) for (let z = minZ; z <= maxZ; z += 6) {
      const d = roadDist(x, z);
      if (d > bd) { bd = d; best = [x, z]; }
    }
    if (best && bd > 32 && !real) {
      const b = new Batch();
      const [lx, lz] = best;
      // face the closest bit of road
      let ci = 0, cd = Infinity;
      for (let i = 0; i < T.N; i++) { const d = Math.hypot(T.X[i] - lx, T.Z[i] - lz); if (d < cd) { cd = d; ci = i; } }
      const ang = Math.atan2(T.Z[ci] - lz, T.X[ci] - lx);
      const from = b.mark();
      const size = Math.min(1, (bd - 10) / 40);
      if (def.landmark === 'rajwada') rajwada(b);
      else if (def.landmark === 'sarafa') temple(b);
      else if (def.landmark === 'chhappan') foodPlaza(b, rng);
      else if (def.landmark === 'vijaynagar') fountainSquare(b);
      else truckYard(b, rng);
      b.transform(from, new THREE.Matrix4().compose(new THREE.Vector3(lx, 0, lz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang), new THREE.Vector3(size, size, size)));
      group.add(b.mesh());
      // the landmark's big signboards
      const ls = new Signs();
      const lsign = (dx, y, w, cell, h) => { const c = Math.cos(ang), sn = Math.sin(ang); ls.add(lx + c * dx * size, y * size, lz + sn * dx * size, ang, w * size, cell, h && h * size); };
      if (def.landmark === 'chhappan') lsign(6.6, 9, 14, cellOf('56 DUKAN'));
      if (def.landmark === 'vijaynagar') lsign(2.2, 13, 12, cellOf('VIJAY NAGAR'));
      if (ls.p.length) group.add(ls.mesh());
      // scatter trees and houses (or towers, in the new city) around it
      const tb = new Batch(), tg = new Batch();
      for (let k = 0; k < 120; k++) {
        const x = minX + rng() * (maxX - minX), z = minZ + rng() * (maxZ - minZ);
        if (!clear(x, z, style === 'modern' ? 8 : 4) || Math.hypot(x - lx, z - lz) < 30 * size + 6) continue;
        if (style === 'modern' && rng() < 0.6) { const f = tb.mark(), fg = tg.mark(); tower(tb, tg, rng, 10 + rng() * 8, 10 + rng() * 8, 20 + rng() * 40, night); place(tb, f, x, 0, z, rng() * 6); place(tg, fg, x, 0, z, rng() * 6); }
        else if (rng() < 0.6) tree(tb, x, z, rng);
        else { const f = tb.mark(); building(tb, rng, 6 + rng() * 4, 6 + rng() * 4, 4 + rng() * 5, night); place(tb, f, x, 0, z, rng() * 6); }
      }
      group.add(tb.mesh());
      if (!tg.empty) group.add(tg.mesh(MAT.vcBasic));
    }
  }

  // far ring of trees and houses beyond the streets, so there's no empty horizon
  {
    const b = new Batch(), farG = new Batch();
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, R = Math.max(maxX - minX, maxZ - minZ) / 2 + 70;
    for (let k = 0; k < 90; k++) {
      const a = (k / 90) * PI * 2 + rng() * 0.05, r = R + rng() * 60;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!clear(x, z, 6)) continue;
      if (style !== 'modern' && rng() < 0.5) tree(b, x, z, rng);
      else if (style === 'modern') { const f = b.mark(), fg = farG.mark(); tower(b, farG, rng, 12 + rng() * 10, 12 + rng() * 8, 25 + rng() * 50, night); place(b, f, x, 0, z, a + PI); place(farG, fg, x, 0, z, a + PI); }
      else { const f = b.mark(); building(b, rng, 10 + rng() * 10, 10 + rng() * 8, 8 + rng() * 18, night); place(b, f, x, 0, z, a + PI); }
    }
    group.add(b.mesh());
    if (!farG.empty) group.add(farG.mesh(MAT.vcBasic));
  }

  chunks.forEach(b => { if (!b.empty) group.add(b.mesh()); });
  glows.forEach(g => { if (!g.empty) group.add(g.mesh(MAT.vcBasic)); });
  signs.forEach(s => { if (s.p.length) group.add(s.mesh()); });

  if (night || th.lights) {
    const glow = new Particles(lampGlow.length + 10, { additive: true, maxPx: 60 });
    for (const [x, y, z] of lampGlow) glow.emit(x, y - 0.2, z, 0, 0, 0, 1e9, 3.2, '#ffcf87', 0);
    glow.update(0);
    group.add(glow.points);
    if (bulbs) { bulbs.update(0); group.add(bulbs.points); }
    // pools of lamp light on the road
    const pool = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,200,120,0.5)', 'rgba(255,200,120,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    const pg = new THREE.PlaneGeometry(12, 12);
    for (const [x, , z] of lampGlow) {
      const m = new THREE.Mesh(pg, pool);
      m.rotation.x = -PI / 2;
      m.position.set(x, 0.13, z);
      m.renderOrder = 2;
      group.add(m);
    }
    anim.lights = bulbs;
  }
  if (night) {
    // stars
    const stars = new Particles(300, { additive: true, maxPx: 6 });
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    for (let k = 0; k < 300; k++) {
      const a = rng() * PI * 2, e = 0.25 + rng() * 1.1;
      stars.emit(cx + Math.cos(a) * Math.cos(e) * 600, 80 + Math.sin(e) * 400, cz + Math.sin(a) * Math.cos(e) * 600, 0, 0, 0, 1e9, 3 + rng() * 5, '#ffffff', 0);
    }
    stars.update(0);
    stars.mat.fog = false;
    group.add(stars.points);
  } else {
    // kites over the city (Indore loves its patang)
    const b = new Batch();
    const cols = ['#e63946', '#ffd23f', '#1d70d6', '#2a9d3f', '#ff4fa3', '#ff7b00', '#8338ec'];
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    for (let k = 0; k < 14; k++) {
      const x = cx + (rng() - 0.5) * (maxX - minX + 100), z = cz + (rng() - 0.5) * (maxZ - minZ + 100), y = 40 + rng() * 40;
      const f = b.mark();
      b.box([0, 0, 0], [1.6, 1.6, 0.05], cols[k % cols.length], [0, 0, PI / 4]);
      b.box([0, -1.6, 0], [0.4, 0.4, 0.05], cols[(k + 2) % cols.length], [0, 0, PI / 4]);
      place(b, f, x, y, z, rng() * 6);
    }
    anim.kites = new THREE.Mesh(b.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    group.add(anim.kites);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,250,220,1)', 'rgba(255,220,150,0)'), fog: false, depthWrite: false, transparent: true }));
    const sd = new THREE.Vector3(...th.sunDir).normalize();
    sunSprite.position.set((minX + maxX) / 2 + sd.x * 500, sd.y * 240 + 30, (minZ + maxZ) / 2 + sd.z * 500);
    sunSprite.scale.set(90, 90, 1);
    group.add(sunSprite);
  }

  // natural cows (they move, so one mesh each) and the ones asleep on the road
  {
    const standing = new Batch();
    cow(standing, false);
    const sg = standing.geometry();
    for (const c of T.cows) {
      const m = new THREE.Mesh(sg, MAT.vc);
      group.add(m);
      anim.cows.push({ c, m });
    }
    const lying = new Batch();
    for (const c of T.sleepers) {
      const f = lying.mark();
      cow(lying, true);
      place(lying, f, c.x, c.y + 0.06, c.z, T.ANG[c.i] + 0.4);
    }
    if (!lying.empty) group.add(lying.mesh());
  }

  // mithai boxes
  {
    const tex = mithaiTexture();
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), new THREE.MeshLambertMaterial({ map: tex, emissive: '#ff4f8a', emissiveIntensity: night ? 0.55 : 0.25 }), T.boxes.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    group.add(mesh);
    anim.boxes = mesh;
  }

  scene.add(group);
  return { group, anim, theme: th };
}

let _cyl = null;
function unitCyl() {
  if (!_cyl) _cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, PI).toNonIndexed();
  return _cyl;
}

// Rajwada: the old Holkar palace, seven storeys over a giant wooden gate.
function rajwada(b) {
  const stone = '#c26b3c', cream = '#f2e2c2', wood = '#5a3418', dark = '#3b2416';
  b.box([0, 4, 0], [16, 8, 44], stone);
  b.box([8.1, 5.5, 0], [0.4, 9, 7], wood);
  b.box([8.2, 9.8, 0], [0.3, 1.4, 5], stone);
  for (let f = 0; f < 4; f++) {
    const y = 8 + f * 4.2, w = 42 - f * 3;
    b.box([0, y + 2.1, 0], [15 - f, 4.2, w], cream);
    b.box([8 - f / 2 + 0.6, y + 0.3, 0], [1.4, 0.25, w], wood);
    for (let k = 0; k < Math.floor(w / 3); k++) {
      const z = -w / 2 + 1.5 + k * 3;
      b.box([7.6 - f / 2, y + 2.2, z], [0.2, 2.2, 1.3], dark);
      b.shape('cyl8', [7.6 - f / 2, y + 3.3, z], [0.65, 0.2, 0.65], dark, [0, 0, PI / 2]);
    }
  }
  for (const z of [-19, 19, -7, 7]) {
    b.shape('cyl8', [5, 26, z], [1.6, 2.5, 1.6], cream);
    b.shape('sph', [5, 27.6, z], [1.8, 1.6, 1.8], '#e8d3a8');
  }
  b.rod([5, 29, 0], [5, 35, 0], 0.15, '#555');
  b.box([5, 34, 1.3], [0.05, 1.6, 2.4], '#ff7b00');
}

function temple(b) {
  const white = '#f6efe4', saffron = '#ff7b00';
  b.box([0, 1, 0], [18, 2, 18], '#d8c8b0');
  b.box([0, 6, 0], [11, 8, 11], white);
  b.shape('cone4', [0, 16, 0], [8, 12, 8], white, [0, PI / 4, 0]);
  b.shape('sph', [0, 22.4, 0], [1, 0.8, 1], '#ffcd00');
  b.rod([0, 23, 0], [0, 28, 0], 0.12, '#555');
  b.box([0, 27, 1.2], [0.05, 1.4, 2.2], saffron);
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) b.shape('cone4', [x, 11, z], [2.5, 5, 2.5], white, [0, PI / 4, 0]);
  b.box([5.6, 4, 0], [0.3, 5, 3.4], '#7a1f1f');
  for (let k = 0; k < 18; k++) b.shape('sph6', [6.2, 6.6 - Math.sin((k / 17) * PI) * 0.8, -2 + (k / 17) * 4], [0.25, 0.25, 0.25], k % 2 ? '#ff9f1c' : '#ffd23f');
}

// Chhappan Dukan's food plaza: tables, umbrellas, a giant jalebi and a giant hot dog.
function foodPlaza(b, rng) {
  b.box([0, 0.08, 0], [34, 0.16, 34], '#c9b8a0');
  for (let k = 0; k < 10; k++) {
    const x = -12 + (k % 5) * 6, z = k < 5 ? -9 : 9;
    b.shape('cyl', [x, 0.9, z], [1, 0.08, 1], '#f1faee');
    b.rod([x, 0.1, z], [x, 3.2, z], 0.05, '#555');
    b.shape('cone', [x, 3.3, z], [2.2, 0.8, 2.2], ['#e63946', '#ffd23f', '#2a9d8f', '#8338ec', '#ff4fa3'][k % 5]);
    for (let m = 0; m < 3; m++) person(b, x + Math.cos(m * 2.1) * 1.6, z + Math.sin(m * 2.1) * 1.6, rng() * 6, rng);
  }
  // giant jalebi
  for (let k = 0; k < 3; k++) b.shape('tor', [-6, 4.2, 0], [3.2 - k * 0.9, 3.2 - k * 0.9, 1.2], '#ff8c1a', [0, PI / 2, 0]);
  b.rod([-6, 0, 0], [-6, 1.2, 0], 0.4, '#8b5a2b');
  // giant hot dog
  b.shape('sph', [5, 2.6, 0], [3.4, 1.1, 1.3], '#d4a055');
  b.shape('sph', [5, 3.2, 0], [3.8, 0.75, 0.8], '#b5442c');
  b.rod([2, 3.95, 0], [8, 3.95, 0], 0.08, '#ffd23f');
  for (const z of [-2.8, 2.8]) b.rod([6.6, 0, z], [6.6, 11, z], 0.25, '#ff7b00');
}

// Vijay Nagar square: a fountain on a roundabout with a pillar and a big sign.
function fountainSquare(b) {
  b.shape('cyl', [0, 0.15, 0], [16, 0.3, 16], '#4f8f3a');
  b.shape('cyl', [0, 0.4, 0], [9, 0.5, 9], '#c9ced6');
  b.shape('cyl', [0, 0.55, 0], [8.4, 0.3, 8.4], '#3fa7d6');
  b.shape('cyl', [0, 1.5, 0], [1.2, 2.4, 1.2], '#e9ecef');
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; b.shape('cone', [Math.cos(a) * 5, 2.2, Math.sin(a) * 5], [0.35, 3.4, 0.35], '#e8f6ff'); }
  b.shape('cone', [0, 5.2, 0], [0.6, 5, 0.6], '#e8f6ff');
  for (const z of [-5.2, 5.2]) b.rod([2.2, 0, z], [2.2, 15, z], 0.3, '#0b3d91');
  for (let k = 0; k < 12; k++) { const a = (k / 12) * PI * 2; b.shape('sph6', [Math.cos(a) * 13, 0.9, Math.sin(a) * 13], [1, 0.9, 1], k % 2 ? '#ff4fa3' : '#ffd23f'); }
}

// ---------------------------------------------------------------- real-world landmarks

// Krishnapura Chhatris near Rajwada: domed sandstone pavilions.
function chhatri(b) {
  const stone = '#d9a066', light = '#ecd3a8';
  for (const [x, z, s] of [[0, 0, 1.2], [-11, 4, 0.9], [11, 4, 0.9]]) {
    b.box([x, 1 * s, z], [8 * s, 2 * s, 8 * s], stone);
    for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.shape('cyl8', [x + px * s, 4.5 * s, z + pz * s], [0.45 * s, 5 * s, 0.45 * s], light);
    b.box([x, 7.2 * s, z], [8.4 * s, 0.6 * s, 8.4 * s], stone);
    b.shape('dome', [x, 7.5 * s, z], [3.6 * s, 4 * s, 3.6 * s], light);
    b.shape('cone', [x, 12 * s, z], [0.4 * s, 1.4 * s, 0.4 * s], '#ffcd00');
  }
}

// The giant overhead water tank in the middle of Rajiv Awas Vihar.
function waterTower(b) {
  const conc = '#cfcac0', dark = '#a8a296';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; b.rod([Math.cos(a) * 5, 0, Math.sin(a) * 5], [Math.cos(a) * 4, 22, Math.sin(a) * 4], 0.45, conc); }
  for (let y = 6; y < 22; y += 5.5) b.shape('tor', [0, y, 0], [4.5, 4.5, 1.2], dark, [PI / 2, 0, 0]);
  b.shape('cyl', [0, 11, 0], [1.6, 22, 1.6], dark);
  b.shape('cone', [0, 23.2, 0], [9, 3, 9], conc, [PI, 0, 0]);
  b.shape('cyl', [0, 27.5, 0], [9.5, 7, 9.5], '#e9e5dc');
  b.shape('cyl', [0, 24.4, 0], [9.6, 0.5, 9.6], '#2f6fb0');
  b.shape('cone', [0, 32.2, 0], [9.6, 2.6, 9.6], conc);
  b.rod([0, 33.4, 0], [0, 36, 0], 0.1, '#555');
}

function communityHall(b) {
  b.box([0, 3, 0], [14, 6, 22], '#f2e2c4');
  b.box([7.1, 2.4, 0], [0.2, 4.4, 5], '#6b4226');
  b.box([8, 6.2, 0], [2.6, 0.3, 8], '#2f6fb0');
  for (const z of [-3.5, 3.5]) b.box([9, 3, z], [0.5, 6, 0.5], '#ffffff');
}

// India Gate: the arch, with its little dome on top.
function indiaGate(b) {
  const s = '#d8b48a', d = '#c49a6c';
  b.box([0, 0.6, 0], [26, 1.2, 14], '#e6d6bd');
  for (const x of [-8.5, 8.5]) b.box([x, 13, 0], [7, 24, 9], s);
  b.box([0, 27, 0], [24, 6, 9], s);
  b.box([0, 24.3, 0], [10, 0.8, 9.2], d);
  b.box([0, 31, 0], [18, 2, 7], d);
  b.box([0, 33.5, 0], [12, 3, 6], s);
  b.shape('dome', [0, 35, 0], [3, 2.4, 3], s);
  b.box([0, 0.9, 10], [3, 1.8, 3], '#4a3a2a');
}

// The Supreme Court: a dome over the centre with wings either side.
function supremeCourt(b) {
  const cream = '#f1e5cf', red = '#b5624a';
  b.box([0, 9, 0], [22, 18, 24], cream);
  b.box([0, 2, 0], [24, 4, 26], red);
  b.shape('cyl', [0, 19.5, 0], [7, 3, 7], cream);
  b.shape('dome', [0, 21, 0], [7.4, 8, 7.4], '#3a3a40');
  b.shape('cone', [0, 29.6, 0], [0.5, 2, 0.5], '#d4af37');
  for (const s of [-1, 1]) {
    b.box([-6, 7, s * 26], [16, 14, 30], cream, [0, s * 0.3, 0]);
    b.box([-6, 1.5, s * 26], [17, 3, 31], red, [0, s * 0.3, 0]);
  }
  for (let k = 0; k < 6; k++) b.shape('cyl8', [12, 8, -7.5 + k * 3], [0.6, 14, 0.6], '#ffffff');
}

// The new Parliament: a triangle of red and cream sandstone round a low dome.
function parliament(b) {
  b.shape('cyl3', [0, 8, 0], [44, 16, 44], '#d9a27a', [0, PI / 6, 0]);
  b.shape('cyl3', [0, 16.4, 0], [42, 1, 42], '#f2e6d0', [0, PI / 6, 0]);
  b.shape('dome', [0, 16.6, 0], [12, 6, 12], '#f2e6d0');
  b.rod([0, 22, 0], [0, 28, 0], 0.15, '#666');
  b.box([0, 26.8, 1.1], [0.05, 1.4, 2.1], '#ff7b00');
  b.box([0, 26.1, 1.1], [0.05, 0.7, 2.1], '#ffffff');
  b.box([0, 25.4, 1.1], [0.05, 0.7, 2.1], '#138808');
}

// The old Parliament (Samvidhan Sadan): a great round colonnade.
function oldParliament(b) {
  b.shape('cyl', [0, 6, 0], [34, 12, 34], '#e8c9a6');
  b.shape('cyl', [0, 12.3, 0], [35, 0.8, 35], '#d9a27a');
  for (let k = 0; k < 48; k++) { const a = (k / 48) * PI * 2; b.shape('cyl8', [Math.cos(a) * 35.2, 6, Math.sin(a) * 35.2], [0.7, 11, 0.7], '#f2e6d0'); }
  b.shape('dome', [0, 12.6, 0], [10, 4, 10], '#c98f6a');
}

// A coaching class banner. Their toppers, apparently, are the gang.
function toppersTexture() {
  const c = canvas(512, 256), x = c.getContext('2d');
  x.fillStyle = '#ffd60a'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#c1121f'; x.fillRect(0, 0, 512, 54);
  x.fillStyle = '#fff'; x.font = `34px ${FONT}`; x.textAlign = 'center'; x.fillText('TOPPER CLASSES', 256, 40);
  x.fillStyle = '#1b0f33'; x.font = `22px ${FONT}`; x.fillText('Hamare Toppers 2026 🏆', 256, 82);
  const tex = texture(c);
  const list = [['nav', '99.9%'], ['jihye', '99%'], ['vanshika', '98%'], ['liu', '97%'], ['lisa', '96%'], ['chechu', '61%'], ['ajay', '35% (grace)']];
  import('./riders.js').then(({ avatar }) => list.forEach(([id, pct], i) => {
    const img = new Image();
    img.onload = () => {
      const cx = 40 + i * 72;
      x.drawImage(img, cx - 31, 104, 62, 62);
      x.fillStyle = '#c1121f'; x.font = `${pct.length > 5 ? 13 : 20}px ${FONT}`; x.fillText(pct, cx, 200);
      tex.needsUpdate = true;
    };
    img.src = URL.createObjectURL(new Blob([avatar(id, { weapon: false }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" ')], { type: 'image/svg+xml' }));
  }));
  return tex;
}

function truckYard(b, rng) {
  const bodies = ['#e63946', '#ffd23f', '#2a9d3f', '#1d70d6'];
  for (let k = 0; k < 4; k++) {
    const z = (k - 1.5) * 6, c = bodies[k];
    b.box([2.5, 1.9, z], [2.2, 2.4, 2.4], c);
    b.box([2.6, 2.4, z], [0.1, 1.0, 2.0], '#2b3a52');
    b.box([-2, 2.3, z], [7, 3.0, 2.5], bodies[(k + 2) % 4]);
    b.box([-2, 3.9, z], [7.2, 0.3, 2.6], '#ff7b00');
    for (const x of [2.5, -0.5, -4]) for (const s of [-1, 1]) b.shape('cyl', [x, 0.55, z + 1.2 * s], [0.55, 0.3, 0.55], '#111', [PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) b.box([-5.55, 1.6 + i * 0.35, z], [0.05, 0.2, 2.4], ['#e63946', '#ffd23f', '#2a9d3f', '#ffffff', '#1d70d6'][i]);
  }
  b.box([12, 1.5, 0], [4, 3, 6], '#d9a066');
  b.box([12, 3.1, 0], [5, 0.2, 7], '#8a9199');
}
