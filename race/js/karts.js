// The rides: Ajay's Bullet, Nav's Rocket Nano, Chechu's Poha Express auto, Vanshika's
// Advocate scooter and Liu's Masterpiece moped. Low-poly, merged into a few meshes per
// kart, with the rider's Ludo face as a big bobblehead sticker so you can tell who's who.
//
// Models face +x with the ground at y = 0; +z is the rider's right.

import { THREE, Batch, MAT, faceCanvas, texture, textSprite, radialTexture } from './gfx.js';
import { CHARACTERS, faceMarkup, RIDES } from './riders.js';
import { F } from './sim.js';

const C = {
  tyre: '#17171a', rim: '#9aa1ab', chrome: '#d4d9e0', black: '#1e1e24', seat: '#3d2a1d',
  glass: '#26364d', light: '#fff4c4', red: '#ff3030', skin: '#c68642', wood: '#c99a5b',
};
const PI = Math.PI;

function wheel(b, x, y, z, r, w, rim = C.rim) {
  b.shape('cyl', [x, y, z], [r, w, r], C.tyre, [PI / 2, 0, 0]);
  b.shape('cyl', [x, y, z], [r * 0.55, w + 0.02, r * 0.55], rim, [PI / 2, 0, 0]);
}
function limb(b, a, c, r, color) { b.rod(a, c, r, color); b.shape('sph6', c, [r, r, r], color); }

// Each builder fills: body (lit), glow (always bright), front (steers), and returns layout.
const BUILD = {
  bullet(b, g, f, acc) {
    wheel(b, -0.8, 0.37, 0, 0.37, 0.14);
    b.box([0, 0.62, 0], [1.25, 0.2, 0.2], C.black);
    b.box([0.05, 0.48, 0], [0.5, 0.36, 0.34], '#80868f');
    for (let i = 0; i < 3; i++) b.box([0.05, 0.42 + i * 0.1, 0], [0.56, 0.03, 0.4], '#5c6168');
    b.shape('sph', [0.3, 0.95, 0], [0.46, 0.2, 0.25], C.black);
    b.box([0.3, 1.1, 0], [0.5, 0.05, 0.06], acc);
    b.box([-0.32, 0.92, 0], [0.6, 0.11, 0.32], C.seat);
    b.box([-0.88, 0.8, 0], [0.55, 0.05, 0.22], C.black);
    b.box([-0.45, 0.62, 0.22], [0.32, 0.24, 0.07], C.black);
    b.rod([0.0, 0.42, 0.24], [-1.1, 0.52, 0.24], 0.075, C.chrome);
    b.shape('cone', [-1.18, 0.53, 0.24], [0.1, 0.2, 0.1], C.chrome, [0, 0, PI / 2]);
    g.box([-1.14, 0.86, 0], [0.05, 0.09, 0.16], C.red);
    // front (pivot at x = 0.62)
    wheel(f, 0.22, 0.37, 0, 0.37, 0.14);
    f.rod([0.22, 0.37, 0.12], [0.02, 1.15, 0.12], 0.04, C.chrome);
    f.rod([0.22, 0.37, -0.12], [0.02, 1.15, -0.12], 0.04, C.chrome);
    f.box([0.24, 0.78, 0], [0.5, 0.05, 0.2], C.black);
    f.shape('cyl', [0.22, 1.05, 0], [0.17, 0.12, 0.17], C.chrome, [0, 0, PI / 2]);
    f.rod([0.04, 1.22, -0.42], [0.04, 1.22, 0.42], 0.035, C.black);
    // rider: leather jacket, skinny jeans, huge white kicks, bat on his back
    b.box([-0.22, 1.36, 0], [0.42, 0.62, 0.5], '#232327', [0, 0, -0.32]);
    b.box([-0.1, 1.32, 0], [0.1, 0.5, 0.2], '#f2f2f2', [0, 0, -0.32]);
    for (const s of [-1, 1]) {
      limb(b, [-0.12, 1.58, 0.26 * s], [0.62, 1.22, 0.4 * s], 0.08, '#232327');
      limb(b, [-0.3, 1.0, 0.15 * s], [0.12, 0.92, 0.25 * s], 0.1, '#2f4f8f');
      limb(b, [0.12, 0.92, 0.25 * s], [0.08, 0.5, 0.27 * s], 0.085, '#2f4f8f');
      b.box([0.16, 0.44, 0.28 * s], [0.36, 0.16, 0.18], '#ffffff');
    }
    b.box([-0.42, 1.5, 0], [0.08, 1.0, 0.2], C.wood, [0, 0, 0.55]);
    return { pivot: 0.62, head: [-0.1, 2.15, 0], size: 1.2, exhaust: [-1.25, 0.53, 0.24], rear: [-0.85, 0.1], bike: true, flag: [-1.0, 0.9, -0.15] };
  },
  nano(b, g, f, acc) {
    b.box([0, 0.55, 0], [2.3, 0.56, 1.36], acc);
    b.shape('sph', [-0.08, 0.92, 0], [1.08, 0.58, 0.67], acc);
    b.box([-0.08, 1.05, 0], [1.25, 0.34, 1.36], C.glass);
    b.box([0.58, 1.0, 0], [0.06, 0.34, 1.1], C.glass, [0, 0, 0.55]);
    b.box([0, 0.33, 0], [2.42, 0.18, 1.3], C.black);
    for (const x of [-0.75, 0.75]) for (const z of [-0.6, 0.6]) wheel(b, x, 0.27, z, 0.27, 0.2);
    g.box([1.16, 0.66, 0.46], [0.04, 0.13, 0.22], C.light);
    g.box([1.16, 0.66, -0.46], [0.04, 0.13, 0.22], C.light);
    g.box([-1.16, 0.66, 0.5], [0.04, 0.12, 0.18], C.red);
    g.box([-1.16, 0.66, -0.5], [0.04, 0.12, 0.18], C.red);
    // the jugaad: a Diwali rocket on a roof rack
    b.box([-0.2, 1.5, 0], [1.3, 0.05, 0.9], C.black);
    for (const z of [-0.18, 0.18]) {
      b.shape('cyl', [-0.35, 1.72, z], [0.16, 1.4, 0.16], '#e02424', [0, 0, PI / 2]);
      b.shape('cyl', [-0.35, 1.72, z], [0.165, 0.18, 0.165], '#ffffff', [0, 0, PI / 2]);
      b.shape('cone', [0.53, 1.72, z], [0.16, 0.36, 0.16], '#ffcc1a', [0, 0, -PI / 2]);
      b.rod([-1.05, 1.72, z], [-1.6, 1.72, z], 0.025, C.wood);
    }
    b.box([0.12, 1.55, 0], [0.42, 0.3, 0.6], '#3c7ff0');
    return { pivot: 0.75, head: [0.15, 2.15, 0], size: 1.15, exhaust: [-1.25, 0.35, 0.4], rear: [-0.8, 0.62], bike: false, flag: [-1.0, 1.5, 0.55] };
  },
  auto(b, g, f, acc) {
    const green = '#1f9a45', yellow = '#ffcd1f';
    b.box([-0.15, 0.4, 0], [2.0, 0.12, 1.2], C.black);
    b.box([-0.55, 0.72, 0], [1.15, 0.56, 1.26], green);
    b.box([0.62, 0.76, 0], [0.55, 0.7, 0.66], green);
    b.box([0.62, 1.28, 0], [0.07, 0.55, 1.05], '#bfe3ff', [0, 0, 0.12]);
    b.box([-0.15, 1.74, 0], [2.05, 0.1, 1.34], yellow);
    b.box([-1.13, 1.25, 0], [0.12, 0.95, 1.34], yellow);
    b.box([-0.15, 1.69, 0], [2.06, 0.08, 1.36], acc);
    for (const [x, z] of [[0.62, -0.55], [0.62, 0.55], [-1.1, -0.62], [-1.1, 0.62]]) b.rod([x, 0.5, z], [x, 1.7, z], 0.035, C.black);
    b.box([-0.95, 1.0, 0], [0.16, 0.6, 1.2], '#2a2a2a');
    wheel(b, -0.68, 0.29, -0.64, 0.29, 0.16);
    wheel(b, -0.68, 0.29, 0.64, 0.29, 0.16);
    g.box([0.9, 1.0, 0], [0.04, 0.16, 0.16], C.light);
    g.box([-1.2, 0.6, 0.5], [0.04, 0.1, 0.16], C.red);
    g.box([-1.2, 0.6, -0.5], [0.04, 0.1, 0.16], C.red);
    // poha stall on the roof: steel thali, a heap of poha, sev, coriander and anar
    b.shape('cyl', [-0.2, 1.82, 0], [0.62, 0.05, 0.62], C.chrome);
    b.shape('sph', [-0.2, 1.86, 0], [0.54, 0.3, 0.54], '#ffd43c');
    const dots = [['#ff7a1a', 9], ['#2f9e2f', 7], ['#c8102e', 6]];
    let k = 0;
    for (const [col, n] of dots) for (let i = 0; i < n; i++) {
      const a = (k++ * 2.399), r = 0.12 + ((k * 37) % 30) / 100;
      const y = 1.86 + 0.3 * Math.sqrt(Math.max(0, 1 - (r / 0.54) ** 2));
      b.box([-0.2 + Math.cos(a) * r, y, Math.sin(a) * r], [0.07, 0.04, 0.07], col);
    }
    // tassels and a tawa hanging at the back
    for (const z of [-0.6, 0.6]) b.rod([0.55, 1.68, z], [0.55, 1.4, z], 0.04, acc);
    b.shape('cyl', [-1.24, 1.15, 0], [0.32, 0.05, 0.32], '#202020', [0, 0, PI / 2]);
    b.rod([-1.24, 1.47, 0], [-1.24, 1.75, 0], 0.03, '#202020');
    // front wheel and handlebar (pivot at 0.95)
    wheel(f, 0, 0.28, 0, 0.28, 0.16);
    f.box([0, 0.62, 0], [0.42, 0.06, 0.24], green);
    f.rod([-0.2, 1.12, -0.36], [-0.2, 1.12, 0.36], 0.03, C.black);
    // Chechu leans out of the side like every auto bhaiya
    b.box([0.12, 1.15, 0.45], [0.4, 0.55, 0.42], '#7c4dff');
    limb(b, [0.2, 1.3, 0.65], [0.72, 1.12, 0.36], 0.08, '#b5754a');
    return { pivot: 0.95, head: [0.15, 1.75, 0.82], size: 1.15, exhaust: [-1.25, 0.35, -0.4], rear: [-0.68, 0.64], bike: false, flag: [-1.15, 1.8, -0.55] };
  },
  scooter(b, g, f, acc) {
    b.box([-0.08, 0.36, 0], [0.85, 0.08, 0.44], C.black);
    b.shape('sph', [-0.58, 0.62, 0], [0.62, 0.34, 0.37], acc);
    b.box([-0.48, 0.9, 0], [0.75, 0.11, 0.33], C.black);
    b.box([0.38, 0.78, 0], [0.13, 0.86, 0.5], acc, [0, 0, -0.16]);
    b.box([0.46, 0.92, 0], [0.03, 0.14, 0.38], '#ffffff', [0, 0, -0.16]);
    wheel(b, -0.62, 0.25, 0, 0.25, 0.15);
    g.box([-1.18, 0.66, 0], [0.04, 0.1, 0.2], C.red);
    wheel(f, 0.12, 0.25, 0, 0.25, 0.15);
    f.rod([0.12, 0.25, 0], [0.0, 1.22, 0], 0.05, '#555');
    f.rod([0.0, 1.24, -0.4], [0.0, 1.24, 0.4], 0.035, C.black);
    f.shape('cyl', [0.06, 1.26, 0], [0.15, 0.18, 0.15], acc, [0, 0, PI / 2]);
    for (const s of [-1, 1]) { f.rod([0, 1.24, 0.3 * s], [-0.02, 1.5, 0.36 * s], 0.015, '#333'); f.shape('cyl', [-0.02, 1.52, 0.36 * s], [0.08, 0.02, 0.08], C.chrome, [0, 0, PI / 2]); }
    // lawyer's black coat, white bands, red heels; a gavel strapped behind
    b.box([-0.42, 1.38, 0], [0.4, 0.62, 0.48], '#16161b', [0, 0, -0.1]);
    b.box([-0.22, 1.5, 0], [0.05, 0.25, 0.16], '#ffffff', [0, 0, -0.1]);
    for (const s of [-1, 1]) {
      limb(b, [-0.35, 1.6, 0.25 * s], [-0.02, 1.25, 0.36 * s], 0.075, '#16161b');
      limb(b, [-0.5, 0.95, 0.14 * s], [-0.02, 0.98, 0.18 * s], 0.09, '#16161b');
      limb(b, [-0.02, 0.98, 0.18 * s], [0.08, 0.48, 0.17 * s], 0.075, '#e0ac69');
      b.box([0.12, 0.43, 0.17 * s], [0.24, 0.1, 0.12], '#d90429');
    }
    b.shape('cyl', [-1.02, 1.05, 0], [0.11, 0.32, 0.11], '#7a4a24', [PI / 2, 0, 0]);
    b.rod([-1.02, 1.05, 0], [-1.02, 1.55, 0], 0.035, '#7a4a24');
    return { pivot: 0.42, head: [-0.38, 2.1, 0], size: 1.15, exhaust: [-1.1, 0.3, 0.2], rear: [-0.62, 0.05], bike: true, flag: [-1.1, 0.95, -0.2] };
  },
  moped(b, g, f, acc) {
    b.rod([0.55, 1.0, 0], [-0.15, 0.48, 0], 0.06, acc);
    b.rod([-0.15, 0.48, 0], [-0.72, 0.36, 0], 0.05, acc);
    b.rod([-0.25, 0.85, 0], [-0.72, 0.36, 0], 0.05, acc);
    b.box([-0.2, 0.64, 0], [0.48, 0.3, 0.26], acc);
    const splat = ['#ff3b3b', '#2f7bff', '#ffd400', '#ff4fa3', '#ffffff', '#8a4fff'];
    splat.forEach((col, i) => b.shape('sph6', [-0.36 + i * 0.07, 0.6 + ((i * 7) % 3) * 0.08, 0.13 * (i % 2 ? 1 : -1)], [0.06, 0.05, 0.03], col));
    b.box([-0.38, 0.92, 0], [0.56, 0.1, 0.28], C.seat);
    b.box([-0.95, 0.82, 0], [0.4, 0.04, 0.28], C.black);
    wheel(b, -0.72, 0.34, 0, 0.34, 0.08);
    g.box([-1.16, 0.82, 0], [0.04, 0.08, 0.14], C.red);
    wheel(f, 0.15, 0.34, 0, 0.34, 0.08);
    f.rod([0.15, 0.34, 0.07], [-0.05, 1.18, 0.07], 0.03, C.chrome);
    f.rod([0.15, 0.34, -0.07], [-0.05, 1.18, -0.07], 0.03, C.chrome);
    f.rod([-0.05, 1.2, -0.38], [-0.05, 1.2, 0.38], 0.03, C.black);
    f.box([0.25, 1.0, 0], [0.34, 0.24, 0.4], '#a0703c');
    ['#ff3b3b', '#2f7bff', '#ffd400', '#33CA7F'].forEach((col, i) => {
      f.rod([0.2 + i * 0.05, 1.05, -0.12 + i * 0.08], [0.24 + i * 0.07, 1.42, -0.14 + i * 0.09], 0.02, C.wood);
      f.shape('sph6', [0.24 + i * 0.07, 1.44, -0.14 + i * 0.09], [0.05, 0.08, 0.05], col);
    });
    // artist: black top, rainbow stockings, squeaky green clown shoes, a big brush
    b.box([-0.35, 1.36, 0], [0.38, 0.6, 0.46], '#1d1d1d', [0, 0, -0.18]);
    for (const s of [-1, 1]) {
      limb(b, [-0.25, 1.58, 0.24 * s], [-0.05, 1.2, 0.36 * s], 0.07, '#1d1d1d');
      limb(b, [-0.42, 0.98, 0.14 * s], [0.0, 0.95, 0.2 * s], 0.085, '#e63946');
      const cols = ['#ff3b3b', '#ffd400', '#2f7bff'];
      for (let i = 0; i < 3; i++) limb(b, [0.0 + i * 0.02, 0.95 - i * 0.15, 0.2 * s], [0.02 + i * 0.02, 0.8 - i * 0.15, 0.2 * s], 0.07, cols[i]);
      b.shape('sph', [0.18, 0.42, 0.2 * s], [0.26, 0.11, 0.13], '#2ecc40');
    }
    b.rod([-0.62, 0.95, -0.05], [-0.25, 2.05, -0.15], 0.035, C.wood);
    b.shape('cone', [-0.22, 2.18, -0.16], [0.1, 0.28, 0.1], '#ff4fa3', [0, 0, -0.33]);
    return { pivot: 0.6, head: [-0.3, 2.12, 0], size: 1.15, exhaust: [-1.05, 0.35, 0.18], rear: [-0.72, 0.05], bike: true, flag: [-1.1, 0.85, 0.18] };
  },
  // Lisa's Steppe Express: an Indore tonga behind a horse from the steppe.
  tonga(b, g, f, acc) {
    const wood = '#7a4a24', gold = '#FEC50C';
    for (const z of [-0.78, 0.78]) {
      b.shape('cyl', [-0.55, 0.6, z], [0.6, 0.08, 0.6], '#3b2416', [PI / 2, 0, 0]);
      b.shape('cyl', [-0.55, 0.6, z], [0.12, 0.12, 0.12], gold, [PI / 2, 0, 0]);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * PI; b.rod([-0.55 + Math.cos(a) * 0.55, 0.6 + Math.sin(a) * 0.55, z], [-0.55 - Math.cos(a) * 0.55, 0.6 - Math.sin(a) * 0.55, z], 0.025, wood); }
    }
    b.box([-0.45, 0.95, 0], [1.7, 0.12, 1.35], wood);
    b.box([-0.95, 1.25, 0], [0.7, 0.5, 1.3], '#c1121f');
    b.box([-1.28, 1.55, 0], [0.1, 0.7, 1.3], wood);
    b.box([0.15, 1.15, 0], [0.5, 0.12, 1.1], '#c1121f');
    for (const [x, z] of [[-1.25, -0.6], [-1.25, 0.6], [-0.45, -0.6], [-0.45, 0.6]]) b.rod([x, 1.0, z], [x, 2.0, z], 0.035, wood);
    b.box([-0.85, 2.02, 0], [1.05, 0.08, 1.45], acc);
    for (let k = 0; k < 7; k++) b.shape('sph6', [-1.35 + k * 0.16, 1.93, 0.74], [0.05, 0.08, 0.05], gold);
    for (let k = 0; k < 7; k++) b.shape('sph6', [-1.35 + k * 0.16, 1.93, -0.74], [0.05, 0.08, 0.05], gold);
    g.box([-1.35, 1.1, 0.45], [0.04, 0.1, 0.16], C.red);
    g.box([-1.35, 1.1, -0.45], [0.04, 0.1, 0.16], C.red);
    // Lisa on the front bench, reins in hand
    b.box([0.05, 1.5, 0], [0.42, 0.6, 0.5], '#00AFCA', [0, 0, -0.1]);
    b.box([0.07, 1.5, 0], [0.44, 0.08, 0.52], gold, [0, 0, -0.1]);
    for (const s of [-1, 1]) {
      limb(b, [0.1, 1.7, 0.25 * s], [0.55, 1.4, 0.2 * s], 0.075, '#00AFCA');
      limb(b, [0.0, 1.2, 0.15 * s], [0.45, 1.15, 0.18 * s], 0.09, '#1d1d24');
      limb(b, [0.45, 1.15, 0.18 * s], [0.5, 0.75, 0.18 * s], 0.075, '#1d1d24');
      b.box([0.58, 0.7, 0.18 * s], [0.26, 0.12, 0.12], '#7a1f1f');
    }
    b.rod([-0.25, 1.4, -0.12], [-0.85, 2.1, -0.4], 0.04, wood);
    b.shape('sph', [-0.2, 1.33, -0.1], [0.22, 0.14, 0.18], wood);
    // the horse (front group, so it turns into corners); legs are animated separately
    f.rod([-0.2, 1.05, 0.45], [1.0, 1.25, 0.32], 0.04, wood);
    f.rod([-0.2, 1.05, -0.45], [1.0, 1.25, -0.32], 0.04, wood);
    f.box([1.25, 1.45, 0], [1.35, 0.6, 0.52], '#8b5a2b');
    f.shape('sph', [0.62, 1.48, 0], [0.32, 0.32, 0.3], '#8b5a2b');
    f.shape('sph', [1.9, 1.5, 0], [0.3, 0.32, 0.28], '#8b5a2b');
    f.rod([1.85, 1.6, 0], [2.25, 2.25, 0], 0.17, '#8b5a2b');
    f.box([2.45, 2.25, 0], [0.62, 0.26, 0.26], '#8b5a2b', [0, 0, -0.5]);
    f.box([2.7, 2.05, 0], [0.2, 0.2, 0.24], '#5c3a1c', [0, 0, -0.5]);
    f.rod([1.75, 1.75, 0], [2.2, 2.45, 0], 0.07, '#2b1a0e');
    for (const s of [-1, 1]) {
      f.shape('cone', [2.3, 2.5, 0.09 * s], [0.06, 0.18, 0.06], '#8b5a2b');
      f.shape('sph6', [2.52, 2.32, 0.13 * s], [0.05, 0.05, 0.04], '#1d1d1f');
    }
    f.rod([0.62, 1.4, 0], [0.4, 0.9, 0], 0.06, '#2b1a0e');
    // a plume of feathers and a string of ghungroo bells
    ['#ff4fa3', '#FEC50C', '#00AFCA'].forEach((col, i) => f.shape('cone', [2.2 + i * 0.05, 2.75, -0.08 + i * 0.08], [0.06, 0.45, 0.06], col, [0.2 - i * 0.2, 0, 0.3]));
    for (let k = 0; k < 7; k++) { const a = (k / 6) * PI; f.shape('sph6', [1.95, 1.55 - Math.sin(a) * 0.3, Math.cos(a) * 0.3], [0.05, 0.05, 0.05], gold); }
    return {
      pivot: 0.55, head: [0.05, 2.35, 0], size: 1.2, exhaust: [-1.35, 0.9, 0], rear: [-0.55, 0.78], bike: false, flag: [-1.25, 2.05, 0.6],
      legs: [[1.75, 1.25, 0.18, 0], [1.75, 1.25, -0.18, PI], [0.75, 1.25, 0.18, PI * 0.5], [0.75, 1.25, -0.18, PI * 1.5]],
    };
  },
};

const faceCache = {};
export function faceTexture(char) {
  if (!faceCache[char]) {
    faceCache[char] = faceCanvas(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="256" height="256">${faceMarkup(char)}</svg>`)
      .then(c => (c ? texture(c, { aniso: false }) : null));
  }
  return faceCache[char];
}

const shadowTex = () => shadowTex.t || (shadowTex.t = radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'));
const glowTex = () => glowTex.t || (glowTex.t = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
const MAT_GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });

// Everything you see of one kart, driven from a pose (local physics or network).
export class KartView {
  constructor(char, { name = null, local = false } = {}) {
    const ride = RIDES[char] || RIDES.nav;
    const acc = (CHARACTERS[char] || CHARACTERS.nav).accent;
    this.char = char;
    this.acc = acc;
    this.local = local;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const b = new Batch(), g = new Batch(), f = new Batch();
    const L = BUILD[ride.veh](b, g, f, acc);
    this.L = L;
    // a flag on a stick in the rider's colour, to spot them from behind
    const [fx, fy, fz] = L.flag;
    b.rod([fx, fy, fz], [fx, fy + 1.45, fz], 0.025, '#3a3a3a');
    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.75, -0.22, 0, 0, -0.45, 0], 3));
    flagGeo.computeVertexNormals();
    this.flag = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ color: acc, side: THREE.DoubleSide }));
    this.flag.position.set(fx, fy + 1.45, fz);
    this.body.add(b.mesh(MAT.vc));
    if (!g.empty) this.body.add(g.mesh(MAT_GLOW));
    this.body.add(this.flag);
    this.front = new THREE.Group();
    this.front.position.set(L.pivot, 0, 0);
    if (!f.empty) this.front.add(f.mesh(MAT.vc));
    this.body.add(this.front);
    // galloping legs (the tonga horse)
    this.legs = [];
    if (L.legs) {
      const lb = new Batch();
      lb.box([0, -0.55, 0], [0.16, 1.1, 0.16], '#8b5a2b');
      lb.box([0, -1.12, 0], [0.2, 0.14, 0.2], '#2b1a0e');
      const geo = lb.geometry();
      for (const [x, y, z, ph] of L.legs) {
        const m = new THREE.Mesh(geo, MAT.vc);
        m.position.set(x - L.pivot, y, z);
        m.userData.ph = ph;
        this.front.add(m);
        this.legs.push(m);
      }
      this.gait = 0;
    }
    // big face sticker
    this.head = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, alphaTest: 0.5, transparent: false }));
    this.head.position.set(...L.head);
    this.head.scale.set(L.size, L.size, 1);
    this.head.visible = false;
    this.body.add(this.head);
    faceTexture(char).then(t => { if (t) { this.head.material.map = t; this.head.material.needsUpdate = true; this.head.visible = true; } });
    // blob shadow
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.shadow.rotation.x = -PI / 2;
    this.shadow.scale.set(L.bike ? 2.6 : 3, L.bike ? 1.3 : 2, 1);
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);
    // boost flame
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa21f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flame.rotation.z = PI / 2;
    this.flame.position.set(L.exhaust[0] - 0.45, L.exhaust[1], L.exhaust[2]);
    this.flame.visible = false;
    this.body.add(this.flame);
    this.flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flameCore.position.set(0, 0.15, 0);
    this.flame.add(this.flameCore);
    // name tag for the others
    if (name && !local) {
      this.tag = textSprite(name, { color: '#fff', bg: acc, stroke: null, size: 44, font: "'Nunito', system-ui, sans-serif", attenuate: false, height: 0.045 });
      this.tag.material.depthTest = false;
      this.tag.renderOrder = 20;
      this.tag.center.set(0.5, 0);
      this.root.add(this.tag);
    }
    this.spinA = 0;
    this.t = Math.random() * 10;
    this.shieldMesh = null;
    this.rocketMesh = null;
    this.stars = null;
    this.dizzyT = 0;
  }

  // The nimbu-mirchi totem (lemon, seven chillies and a bit of charcoal on a thread).
  buildShield() {
    const b = new Batch();
    b.rod([0, 0, 0], [0, -0.55, 0], 0.012, '#eeeeee');
    b.shape('sph', [0, -0.62, 0], [0.16, 0.13, 0.13], '#ffe14d');
    for (let i = 0; i < 7; i++) b.shape('cone', [0, -0.82 - i * 0.12, 0], [0.05, 0.16, 0.05], i % 2 ? '#1f9a45' : '#2fbf55', [PI, i * 0.9, 0]);
    b.box([0, -1.7, 0], [0.09, 0.09, 0.09], '#222');
    const m = b.mesh(MAT.vc);
    const g = new THREE.Group();
    g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = PI / 2;
    ring.position.y = 0.7;
    g.add(ring);
    g.userData.ring = ring;
    g.userData.totem = m;
    m.position.set(0.9, 2.0, 0);
    this.body.add(g);
    return g;
  }

  buildRocket() {
    const b = new Batch();
    b.shape('cyl', [0, 0, 0], [0.35, 2.2, 0.35], '#e02424', [0, 0, PI / 2]);
    b.shape('cyl', [0.3, 0, 0], [0.36, 0.3, 0.36], '#ffcc1a', [0, 0, PI / 2]);
    b.shape('cyl', [-0.5, 0, 0], [0.36, 0.25, 0.36], '#ffffff', [0, 0, PI / 2]);
    b.shape('cone', [1.4, 0, 0], [0.35, 0.7, 0.35], '#ffcc1a', [0, 0, -PI / 2]);
    for (const a of [0, PI / 2, PI, 1.5 * PI]) b.box([-1.0, Math.cos(a) * 0.45, Math.sin(a) * 0.45], [0.5, 0.06, 0.06], '#7a1b1b', [a, 0, 0]);
    const m = b.mesh(MAT.vc);
    m.position.set(-0.2, 0.35, 0);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7b1f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.rotation.z = PI / 2;
    flame.position.set(-2.2, 0, 0);
    m.add(flame);
    m.userData.flame = flame;
    this.body.add(m);
    return m;
  }

  // pose: { x, y, z, h, steer, yaw, f (flags), v, level }
  update(dt, pose, R, camPos) {
    this.t += dt;
    const fl = pose.f || 0;
    const r = this.root, L = this.L;
    r.position.set(pose.x, pose.y, pose.z);
    r.rotation.y = -pose.h;
    // spin out: whirl, then settle facing forward again
    if (fl & F.SPIN) { this.spinA += dt * 15; this.dizzyT = 1.6; }
    else if (this.spinA !== 0) {
      const target = Math.ceil(this.spinA / (2 * PI) - 1e-6) * 2 * PI;
      this.spinA = Math.min(target, this.spinA + dt * 12);
      if (this.spinA >= target - 1e-3) this.spinA = 0;
    }
    const drift = fl & F.DL ? -1 : fl & F.DR ? 1 : 0;
    const steer = pose.steer || 0;
    const v = pose.v || 0;
    this.body.rotation.order = 'YXZ';
    this.body.rotation.y = -((pose.yaw || 0) + this.spinA);
    const lean = L.bike ? steer * 0.42 + drift * 0.18 : -steer * 0.07 - drift * 0.05;
    this.body.rotation.x += (lean - this.body.rotation.x) * Math.min(1, dt * 10);
    const wob = fl & F.WOBBLE ? Math.sin(this.t * 40) * 0.12 : 0;
    this.body.rotation.z = (fl & F.AIR ? -0.08 : 0) + wob;
    const bob = Math.sin(this.t * (8 + v * 0.5)) * (fl & F.OFF ? 0.06 : 0.02) * Math.min(1, v / 5);
    this.body.position.y = bob;
    this.front.rotation.y = -steer * (this.legs.length ? 0.3 : 0.45);
    if (this.legs.length) {
      this.gait += dt * (3 + v * 0.55);
      const amp = Math.min(1, v / 6) * 0.65;
      for (const m of this.legs) m.rotation.z = Math.sin(this.gait + m.userData.ph) * amp;
      this.front.position.y = Math.abs(Math.sin(this.gait)) * 0.08 * Math.min(1, v / 6);
    }
    this.flag.rotation.y = Math.sin(this.t * 9) * 0.25 + 0.15;
    this.head.position.y = L.head[1] + Math.sin(this.t * 7.3) * 0.04 * Math.min(1, v / 4);
    // shadow stays on the ground while we fly
    this.shadow.position.y = (pose.gy != null ? pose.gy - pose.y : 0) + 0.06;
    // boost
    const boosting = fl & (F.BOOST | F.ROCKET);
    this.flame.visible = !!(fl & F.BOOST);
    if (this.flame.visible) {
      const s = 0.8 + Math.random() * 0.5;
      this.flame.scale.set(1, s * 1.3, 1);
      this.flame.position.x = L.exhaust[0] - 0.55 * s;
    }
    // shield
    if (fl & F.SHIELD) {
      if (!this.shieldMesh) this.shieldMesh = this.buildShield();
      this.shieldMesh.visible = true;
      this.shieldMesh.userData.ring.rotation.z += dt * 2;
      this.shieldMesh.userData.ring.scale.setScalar(1 + Math.sin(this.t * 6) * 0.05);
      this.shieldMesh.userData.totem.rotation.x = Math.sin(this.t * 5) * 0.25 - Math.min(0.5, v / 60);
    } else if (this.shieldMesh) this.shieldMesh.visible = false;
    // Diwali rocket
    if (fl & F.ROCKET) {
      if (!this.rocketMesh) this.rocketMesh = this.buildRocket();
      this.rocketMesh.visible = true;
      this.rocketMesh.userData.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
      if (R) for (let i = 0; i < 3; i++) this.emit(R.sparks, -2.6, 0.4, 0, -12, 2, '#ffd04a', 0.5, 0.6, 3);
    } else if (this.rocketMesh) this.rocketMesh.visible = false;
    // dizzy stars after a hit
    if (this.dizzyT > 0) {
      this.dizzyT -= dt;
      if (!this.stars) {
        this.stars = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const s = textSprite('⭐', { stroke: null, size: 48, height: 0.5 });
          this.stars.add(s);
        }
        this.body.add(this.stars);
      }
      this.stars.visible = true;
      this.stars.position.set(L.head[0], L.head[1] + L.size * 0.55, L.head[2]);
      this.stars.children.forEach((s, i) => {
        const a = this.t * 6 + (i * 2 * PI) / 3;
        s.position.set(Math.cos(a) * 0.6, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.6);
      });
    } else if (this.stars) this.stars.visible = false;
    // particles: drift sparks, dust, boost embers
    if (R) {
      if (drift && !(fl & F.AIR)) {
        const lv = (fl & F.LV1 ? 1 : 0) | (fl & F.LV2 ? 2 : 0);
        const col = ['#ffffff', '#ffd21f', '#ff7a1a', '#ff3df2'][lv];
        const n = lv ? 3 : 1;
        for (const side of L.bike ? [0] : [-1, 1]) {
          for (let i = 0; i < n; i++) this.emit(R.sparks, L.rear[0], 0.15, side * L.rear[1], -3 - Math.random() * 3, 2 + Math.random() * 3, col, 0.28 + Math.random() * 0.2, lv ? 0.38 : 0.25, 14, drift * 3);
        }
        if (Math.random() < 0.5) this.emit(R.dust, L.rear[0] - 0.3, 0.2, 0, -2, 0.6, '#d9d2c5', 0.6, 0.8, -0.5, 0, 1.4);
      }
      if (fl & F.OFF && v > 6 && Math.random() < 0.7) this.emit(R.dust, L.rear[0] - 0.2, 0.2, (Math.random() - 0.5), -1, 1.2, '#c9a36a', 0.8, 0.9, -0.5, 0, 1.6);
      if (boosting && Math.random() < 0.8) this.emit(R.sparks, L.exhaust[0] - 0.3, L.exhaust[1], L.exhaust[2], -6, 0.5, '#ffb347', 0.25, 0.35, 0);
    }
    if (this.tag) {
      this.tag.position.set(0, L.head[1] + L.size * 0.62, 0);
      if (camPos) {
        const d = camPos.distanceTo(r.position);
        this.tag.visible = d < 90 && d > 4;
      }
    }
  }

  // Emit a particle at a point given in kart coordinates, with kart-relative velocity.
  emit(sys, lx, ly, lz, vlx, vly, color, life, size, grav = 0, vlz = 0, grow = 0) {
    const r = this.root;
    const h = -r.rotation.y - this.body.rotation.y; // world heading of the body
    const c = Math.cos(h), s = Math.sin(h);
    const x = r.position.x + lx * c - lz * s;
    const z = r.position.z + lx * s + lz * c;
    const vx = vlx * c - vlz * s, vz = vlx * s + vlz * c;
    sys.emit(x + (Math.random() - 0.5) * 0.2, r.position.y + ly, z + (Math.random() - 0.5) * 0.2, vx + (Math.random() - 0.5), vly, vz + (Math.random() - 0.5), life, size, color, grav, grow);
  }

  dispose() {
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}
