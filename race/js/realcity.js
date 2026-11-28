// Real buildings from OpenStreetMap, extruded: each outline becomes walls with a
// facade texture (shop shutters on the ground floor, windows above, lit at night),
// a flat roof, and on Indian rooftops, of course, a black water tank.
// Map data © OpenStreetMap contributors, ODbL 1.0.

import { THREE, canvas, texture, seeded } from './gfx.js';

const BAY = 3.6, FLOOR = 3.2;   // metres per window bay and per floor

// Facade styles: base wall colour is white-ish and gets tinted per building.
function facade(style, night) {
  const c = canvas(256, 256), x = c.getContext('2d');
  const glow = night ? canvas(256, 256) : null, gx = glow && glow.getContext('2d');
  const rng = seeded(style.length * 31 + (night ? 7 : 0));
  x.fillStyle = style === 'modern' ? '#c9d6e3' : '#f4efe6';
  x.fillRect(0, 0, 256, 256);
  if (gx) { gx.fillStyle = '#000'; gx.fillRect(0, 0, 256, 256); }
  for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
    const X = bx * 64, Y = fy * 64;
    if (style === 'modern') {
      x.fillStyle = '#3d5878'; x.fillRect(X + 3, Y + 6, 58, 50);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(X + 3, Y + 6, 58, 6);
      x.fillStyle = '#8a98a8'; x.fillRect(X, Y + 56, 64, 8);
    } else if (style === 'delhi') {
      x.fillStyle = '#5a3a2a'; x.beginPath(); x.moveTo(X + 18, Y + 56); x.lineTo(X + 18, Y + 24); x.arc(X + 32, Y + 24, 14, Math.PI, 0); x.lineTo(X + 46, Y + 56); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(X, Y + 58, 64, 6);
    } else if (style === 'colony') {
      x.fillStyle = '#2f6fb0'; x.fillRect(X + 14, Y + 12, 36, 32);
      x.fillStyle = '#cfe0f0'; x.fillRect(X + 17, Y + 15, 13, 26); x.fillRect(X + 34, Y + 15, 13, 26);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(X + 10, Y + 8, 44, 5);
      if (rng() < 0.35) { x.fillStyle = '#7a8a99'; x.fillRect(X + 2, Y + 50, 60, 4); for (let k = 0; k < 8; k++) x.fillRect(X + 4 + k * 8, Y + 44, 2, 8); }
    } else {
      // Indian city houses: a window with a grille, sometimes a balcony slab
      x.fillStyle = '#3a4250'; x.fillRect(X + 16, Y + 14, 32, 30);
      x.strokeStyle = '#8a8f99'; x.lineWidth = 2;
      for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(X + 16 + k * 8, Y + 14); x.lineTo(X + 16 + k * 8, Y + 44); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(X + 12, Y + 10, 40, 4);
      if (rng() < 0.4) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(X + 4, Y + 48, 56, 6); }
    }
    if (gx && rng() < 0.55) { gx.fillStyle = rng() < 0.75 ? '#ffd88a' : '#cfe6ff'; if (style === 'modern') gx.fillRect(X + 3, Y + 6, 58, 50); else if (style === 'delhi') gx.fillRect(X + 18, Y + 18, 28, 38); else gx.fillRect(X + 16, Y + 14, 32, 30); }
  }
  const t = texture(c, { repeat: true });
  return { map: t, glow: glow ? texture(glow, { repeat: true }) : null };
}

function shopfront(style, night) {
  const c = canvas(256, 64), x = c.getContext('2d');
  const glow = night ? canvas(256, 64) : null, gx = glow && glow.getContext('2d');
  x.fillStyle = '#e9e4da'; x.fillRect(0, 0, 256, 64);
  if (gx) { gx.fillStyle = '#000'; gx.fillRect(0, 0, 256, 64); }
  for (let b = 0; b < 4; b++) {
    const X = b * 64;
    if (style === 'colony') { // IDA blocks: a shop shutter with a tin shade, or a house gate
      if (b % 2) {
        x.fillStyle = '#8c95a3'; x.fillRect(X + 6, 14, 52, 50); x.strokeStyle = '#6c7583'; for (let k = 18; k < 64; k += 6) { x.beginPath(); x.moveTo(X + 6, k); x.lineTo(X + 58, k); x.stroke(); }
        x.fillStyle = '#3b6fb0'; x.fillRect(X + 2, 6, 60, 7);
      } else {
        x.fillStyle = '#ffffff'; x.fillRect(X + 4, 16, 8, 48); x.fillRect(X + 40, 16, 8, 48);
        x.fillStyle = '#6b4226'; x.fillRect(X + 12, 26, 28, 38);
        x.fillStyle = '#2f6fb0'; x.fillRect(X + 50, 22, 12, 18);
      }
      if (gx && b % 2) { gx.fillStyle = '#ffcf87'; gx.fillRect(X + 6, 14, 52, 50); }
    } else if (style === 'modern') {
      x.fillStyle = '#7aa6c9'; x.fillRect(X + 2, 8, 60, 56);
      if (gx) { gx.fillStyle = '#e6f2ff'; gx.fillRect(X + 2, 8, 60, 56); }
    } else { // shop shutters, half of them open with the shop lit inside
      const open = (b * 7) % 3 !== 0;
      if (open) { x.fillStyle = '#6b4f3a'; x.fillRect(X + 4, 8, 56, 56); x.fillStyle = '#c9a36a'; x.fillRect(X + 8, 40, 48, 24); }
      else { x.fillStyle = '#8c95a3'; x.fillRect(X + 4, 8, 56, 56); x.strokeStyle = '#6c7583'; for (let k = 12; k < 64; k += 6) { x.beginPath(); x.moveTo(X + 4, k); x.lineTo(X + 60, k); x.stroke(); } }
      if (gx && open) { gx.fillStyle = '#ffcf87'; gx.fillRect(X + 4, 8, 56, 56); }
    }
  }
  return { map: texture(c, { repeat: true }), glow: glow ? texture(glow, { repeat: true }) : null };
}

const TINTS = {
  old: ['#f6a6b2', '#ffd27a', '#9fd3ff', '#b5e48c', '#ffb385', '#d0b3ff', '#f7f0d6', '#7fd1c7', '#ffe066', '#e8a87c', '#c9e4ff', '#ff9f9f'],
  food: ['#ffd27a', '#ffb385', '#f6a6b2', '#f7f0d6', '#ffe066', '#e8a87c', '#9fd3ff'],
  colony: ['#f3e6b3', '#efe0a8', '#f5edd0', '#e8d9a0', '#f2e2c4', '#ece4c6', '#f6d9a6', '#e3e9d1'],
  modern: ['#e6ecf2', '#d3dde8', '#c7d6e6', '#f0f0f0', '#d9e2d0'],
  delhi: ['#e8c9a6', '#d9a27a', '#f2e6d0', '#e9d5b5', '#c98f6a'],
};

class Walls {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  quad(a, b, y0, y1, u0, u1, v0, v1, nx, nz, col) {
    const P = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
    const UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { this.p.push(...P[k]); this.uv.push(...UV[k]); this.n.push(nx, 0, nz); this.c.push(col.r, col.g, col.b); }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}

// data.buildings: [height, x0, z0, x1, z1, ...] in track metres.
// opts: style, night, chunkOf(x, z) → chunk index, roofs (Batch per chunk), signs (Signs per chunk),
// signCells, roadNear(x, z) → { d, nx, nz } (distance to the road and the direction to it), skip(x, z) → true to leave out.
export function buildRealBuildings(group, data, opts) {
  const { style, night, chunkOf, roofs, signs, signCells, roadNear, skip, chunks } = opts;
  const rng = seeded(97);
  const fac = facade(style === 'food' ? 'old' : style, night), shop = shopfront(style === 'food' ? 'old' : style, night);
  const lit = { vertexColors: true, side: THREE.DoubleSide };
  const upperMat = new THREE.MeshLambertMaterial({ ...lit, map: fac.map, ...(night ? { emissive: '#ffffff', emissiveMap: fac.glow, emissiveIntensity: 0.9 } : {}) });
  const groundMat = new THREE.MeshLambertMaterial({ ...lit, map: shop.map, ...(night ? { emissive: '#ffffff', emissiveMap: shop.glow, emissiveIntensity: 0.8 } : {}) });
  const upper = Array.from({ length: chunks }, () => new Walls()), ground = Array.from({ length: chunks }, () => new Walls());
  const tints = TINTS[style] || TINTS.old;
  const col = new THREE.Color();
  const ROOFS = style === 'delhi' ? ['#c9b79c', '#b8a68c'] : style === 'modern' ? ['#8f99a6', '#7d8794'] : ['#b9b2a6', '#a9a297', '#c4bcae', '#b5714e'];
  let n = 0;
  for (const b of data.buildings || []) {
    const h = b[0];
    const pts = [];
    for (let i = 1; i < b.length; i += 2) pts.push([b[i], b[i + 1]]);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (skip(cx, cz)) continue;
    const ch = chunkOf(cx, cz);
    col.set(tints[Math.floor(rng() * tints.length)]);
    // OpenStreetMap rarely knows how tall a building is here; Indian streets are G+1 to G+3
    const MIN = { old: [6.8, 6.4], food: [6.8, 6.4], colony: [6.8, 3.2], delhi: [7, 5], modern: [14, 30] }[style] || [6.8, 6.4];
    const hh = Math.max(h, MIN[0] + Math.floor(rng() * (MIN[1] / FLOOR + 1)) * FLOOR);
    const groundH = Math.min(hh, FLOOR);
    let u = 0, best = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 0.05) continue;
      let nx = (c[1] - a[1]) / len, nz = -(c[0] - a[0]) / len;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      const u1 = u + len / (BAY * 4);
      ground[ch].quad(a, c, 0, groundH, u, u1, 0, 1, nx, nz, col);
      if (hh > groundH + 0.2) upper[ch].quad(a, c, groundH, hh, u, u1, 0, (hh - groundH) / (FLOOR * 4), nx, nz, col);
      u = u1;
      // the wall that faces the street gets a signboard
      const r = roadNear(mx, mz);
      const facing = -(nx * r.nx + nz * r.nz);
      if (len > 3.5 && facing > 0.6 && r.d < 30 && (!best || r.d < best.d)) best = { d: r.d, mx, mz, nx, nz, len };
    }
    // flat roof, a parapet line, and often a water tank
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    let tris = [];
    try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { tris = []; }
    const roofCol = ROOFS[Math.floor(rng() * ROOFS.length)];
    for (const [i, j, k] of tris) roofs[ch].tri([pts[i][0], hh, pts[i][1]], [pts[j][0], hh, pts[j][1]], [pts[k][0], hh, pts[k][1]], roofCol);
    if (style !== 'modern' && style !== 'delhi' && rng() < 0.55 && hh < 20) {
      roofs[ch].shape('cyl', [cx, hh + 0.7, cz], [0.7, 1.4, 0.7], '#1e1e1e');
    }
    if (best && style === 'colony' && opts.props) {
      const P = opts.props[ch], ax = best.nx, az = best.nz, tx = -az, tz = ax; // out from the wall, and along it
      const at = (o, al, y) => [best.mx + ax * o + tx * al, y, best.mz + az * o + tz * al];
      const ang = -Math.atan2(az, ax);
      if (hh > 5 && rng() < 0.55) { // first-floor balcony with a railing, often a carpet hung over it
        P.box(at(0.6, 0, 3.4), [1.2, 0.15, Math.min(best.len * 0.7, 4)], '#d9d2c5', [0, ang, 0]);
        P.box(at(1.15, 0, 3.9), [0.05, 0.9, Math.min(best.len * 0.7, 4)], '#7a6a5a', [0, ang, 0]);
        if (rng() < 0.6) P.box(at(1.2, rng() * 0.8 - 0.4, 3.45), [0.04, 1.4, 1.3], ['#9d1b2b', '#7a1f3d', '#2a4b8d'][Math.floor(rng() * 3)], [0, ang, 0]);
      }
      if (hh > 5 && rng() < 0.35) { // outside staircase up the wall
        for (let k = 0; k < 8; k++) P.box(at(0.5, -best.len * 0.3 + k * 0.32, 0.2 + k * 0.4), [1.0, 0.18, 0.34], '#cfc8bb', [0, ang, 0]);
      }
      if (rng() < 0.4) for (let k = 0; k < 2; k++) P.shape('cyl8', at(0.6, best.len * 0.3 + k * 0.65, 0.45), [0.3, 0.9, 0.3], '#1f6fd1');
      if (rng() < 0.45) { // a parked scooter
        const c2 = ['#e63946', '#1d70d6', '#222', '#f1faee', '#2a9d3f'][Math.floor(rng() * 5)];
        P.box(at(1.4, -best.len * 0.15, 0.55), [0.5, 0.5, 1.4], c2, [0, ang + Math.PI / 2, 0]);
        P.shape('cyl', at(1.4, -best.len * 0.15 - 0.6, 0.25), [0.25, 0.1, 0.25], '#151515', [0, ang + Math.PI / 2, Math.PI / 2]);
      }
      if (rng() < 0.35) P.shape('cyl', [cx, hh + 0.9, cz], [0.45, 0.06, 0.45], '#e9e9e9', [0.6, 0, 0]);
    }
    if (best && signCells && signCells.length && rng() < (style === 'colony' ? 0.25 : 0.8)) {
      const w = Math.min(best.len * 0.85, 5.5);
      signs[ch].add(best.mx + best.nx * 0.15, Math.min(hh - 0.3, FLOOR + 0.5), best.mz + best.nz * 0.15, Math.atan2(best.nz, best.nx), w, signCells[Math.floor(rng() * signCells.length)]);
    }
    n++;
  }
  for (const w of upper) if (w.p.length) group.add(w.mesh(upperMat));
  for (const w of ground) if (w.p.length) group.add(w.mesh(groundMat));
  return n;
}
