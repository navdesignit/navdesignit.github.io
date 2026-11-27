// Small three.js helpers: merged low-poly geometry, canvas textures, text sprites,
// the riders' faces as stickers, and one GPU-friendly particle system.
// Everything static is merged into a few big meshes so phones only draw a handful of things.

import * as THREE from './three.js';

export { THREE };

const UNIT = {};
function unit(name) {
  if (!UNIT[name]) {
    let g;
    switch (name) {
      case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
      case 'cyl': g = new THREE.CylinderGeometry(1, 1, 1, 14, 1); break;
      case 'cyl6': g = new THREE.CylinderGeometry(1, 1, 1, 6, 1); break;
      case 'cyl8': g = new THREE.CylinderGeometry(1, 1, 1, 8, 1); break;
      case 'sph': g = new THREE.SphereGeometry(1, 14, 10); break;
      case 'sph6': g = new THREE.SphereGeometry(1, 8, 6); break;
      case 'ico': g = new THREE.IcosahedronGeometry(1, 0); break;
      case 'ico1': g = new THREE.IcosahedronGeometry(1, 1); break;
      case 'cone': g = new THREE.ConeGeometry(1, 1, 12, 1); break;
      case 'cone4': g = new THREE.ConeGeometry(1, 1, 4, 1); break;
      case 'tor': g = new THREE.TorusGeometry(1, 0.28, 8, 18); break;
      case 'halfcyl': g = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI); break;
      default: throw new Error(name);
    }
    UNIT[name] = g.index ? g.toNonIndexed() : g;
  }
  return UNIT[name];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();
const _c = new THREE.Color();

// Collects coloured shapes and bakes them into one mesh with vertex colours.
export class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; }
  add(geom, matrix, color) {
    const pos = geom.attributes.position, nor = geom.attributes.normal;
    _nm.getNormalMatrix(matrix);
    _c.set(color);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
      this.p.push(_v.x, _v.y, _v.z);
      this.n.push(_n.x, _n.y, _n.z);
      this.c.push(_c.r, _c.g, _c.b);
    }
    return this;
  }
  // shape(name, [x,y,z], [sx,sy,sz], color, [rx,ry,rz]) — rotations in radians, Y then X then Z
  shape(name, pos, scale, color, rot) {
    _p.set(pos[0], pos[1], pos[2]);
    _s.set(scale[0], scale[1], scale[2]);
    if (rot) _q.setFromEuler(_e.set(rot[0] || 0, rot[1] || 0, rot[2] || 0, 'YXZ')); else _q.identity();
    _m.compose(_p, _q, _s);
    return this.add(unit(name), _m, color);
  }
  box(pos, scale, color, rot) { return this.shape('box', pos, scale, color, rot); }
  // A cylinder between two points.
  rod(a, b, r, color, name = 'cyl8') {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1e-3;
    _p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.set(dx / len, dy / len, dz / len));
    _s.set(r, len, r);
    _m.compose(_p, _q, _s);
    return this.add(unit(name), _m, color);
  }
  // Apply a transform to everything added since `from` (for groups placed in the world).
  mark() { return this.p.length; }
  transform(from, matrix) {
    _nm.getNormalMatrix(matrix);
    for (let i = from; i < this.p.length; i += 3) {
      _v.set(this.p[i], this.p[i + 1], this.p[i + 2]).applyMatrix4(matrix);
      this.p[i] = _v.x; this.p[i + 1] = _v.y; this.p[i + 2] = _v.z;
      _n.set(this.n[i], this.n[i + 1], this.n[i + 2]).applyMatrix3(_nm).normalize();
      this.n[i] = _n.x; this.n[i + 1] = _n.y; this.n[i + 2] = _n.z;
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
  mesh(material = MAT.vc) { return new THREE.Mesh(this.geometry(), material); }
  get empty() { return this.p.length === 0; }
}

export const placeMatrix = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));

export const MAT = {
  vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
  vcBasic: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

// ---------------------------------------------------------------- canvas textures

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

let maxAniso = 4;
export function setMaxAniso(n) { maxAniso = Math.min(8, n || 1); }

export function texture(c, { repeat = false, aniso = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (aniso) t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function noiseFill(ctx, w, h, base, spread, n = 4000, size = 2, rng = Math.random) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.floor((rng() - 0.5) * spread);
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
    ctx.fillRect(rng() * w, rng() * h, size, size);
  }
}

export const FONT = "'Bungee', 'Nunito', system-ui, sans-serif";
export const FONT2 = "'Nunito', system-ui, sans-serif";

// A text label as a sprite (for "PON PON!", name tags and signs that float).
// Textures are cached, so a repeated pop-up costs no new upload to the GPU.
const textCache = new Map();
export function textSprite(text, opts = {}) {
  const { attenuate = true, height = 1 } = opts;
  const key = JSON.stringify([text, opts.color, opts.bg, opts.stroke, opts.size, opts.font, opts.pad]);
  let hit = textCache.get(key);
  if (!hit) { hit = textTexture(text, opts); textCache.set(key, hit); }
  const mat = new THREE.SpriteMaterial({ map: hit.tex, transparent: true, depthWrite: false, sizeAttenuation: attenuate });
  const s = new THREE.Sprite(mat);
  s.scale.set(height * hit.aspect, height, 1);
  s.userData.aspect = hit.aspect;
  return s;
}

function textTexture(text, { color = '#fff', bg = null, stroke = '#000', size = 64, font = FONT, pad = 16 } = {}) {
  const c = canvas(8, 8);
  const ctx = c.getContext('2d');
  ctx.font = `${size}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = Math.ceil(size * 1.35) + pad;
  c.width = w; c.height = h;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (bg) {
    ctx.fillStyle = bg;
    const r = h / 2.4;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(2, 2, w - 4, h - 4, r); // iOS 15 has no roundRect
    else { ctx.moveTo(2 + r, 2); ctx.arcTo(w - 2, 2, w - 2, h - 2, r); ctx.arcTo(w - 2, h - 2, 2, h - 2, r); ctx.arcTo(2, h - 2, 2, 2, r); ctx.arcTo(2, 2, w - 2, 2, r); ctx.closePath(); }
    ctx.fill();
  }
  if (stroke) { ctx.lineWidth = size / 6; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(text, w / 2, h / 2 + 2); }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 2);
  return { tex: texture(c, { aniso: false }), aspect: w / h };
}

// The rider's face from the Ludo game as a big sticker with a dark outline, so it
// reads clearly on a small phone screen. Returns a canvas.
export function faceCanvas(svgMarkup, px = 256) {
  return new Promise(resolve => {
    const img = new Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const c = canvas(px, px);
      const ctx = c.getContext('2d');
      const tmp = canvas(px, px);
      const t = tmp.getContext('2d');
      const pad = px * 0.06;
      t.drawImage(img, pad, pad, px - pad * 2, px - pad * 2);
      // outline: stamp the silhouette around in dark, then the face on top
      const o = px * 0.028;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        ctx.drawImage(tmp, Math.cos(ang) * o, Math.sin(ang) * o);
      }
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#16102a';
      ctx.fillRect(0, 0, px, px);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, 0, 0);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', px = 64) {
  const c = canvas(px, px);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  return texture(c, { aniso: false });
}

// ---------------------------------------------------------------- particles

const PVERT = `
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vAlpha;
varying vec3 vTint;
uniform float scale;
uniform float maxSize;
void main() {
  vAlpha = alpha;
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(maxSize, size * scale / max(0.5, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = `
varying float vAlpha;
varying vec3 vTint;
uniform float soft;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = soft > 0.5 ? (1.0 - smoothstep(0.0, 1.0, r)) : (1.0 - step(1.0, r));
  if (a <= 0.01) discard;
  gl_FragColor = vec4(vTint, a * vAlpha);
}`;

// A pool of points: sparks, dust, smoke, confetti. Updated on the CPU, drawn in one call.
export class Particles {
  constructor(max, { additive = true, soft = true, maxPx = 160 } = {}) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.grow = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('tint', this.aCol);
    g.setAttribute('size', this.aSize);
    g.setAttribute('alpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG,
      uniforms: { scale: { value: 300 }, soft: { value: soft ? 1 : 0 }, maxSize: { value: maxPx * 2 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.mat.userData.maxPx = maxPx;
    this.geom = g;
  }
  emit(x, y, z, vx, vy, vz, life, size, color, grav = 0, grow = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    _c.set(color);
    this.col[i * 3] = _c.r; this.col[i * 3 + 1] = _c.g; this.col[i * 3 + 2] = _c.b;
    this.size[i] = size; this.alpha[i] = 1; this.life[i] = life; this.age[i] = 0;
    this.grav[i] = grav; this.grow[i] = grow;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.kill(i); continue; }
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const f = this.age[i] / this.life[i];
      this.alpha[i] = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
      i++;
    }
    this.geom.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (let c = 0; c < 3; c++) {
      this.pos[i * 3 + c] = this.pos[j * 3 + c];
      this.vel[i * 3 + c] = this.vel[j * 3 + c];
      this.col[i * 3 + c] = this.col[j * 3 + c];
    }
    this.size[i] = this.size[j]; this.alpha[i] = this.alpha[j]; this.life[i] = this.life[j];
    this.age[i] = this.age[j]; this.grav[i] = this.grav[j]; this.grow[i] = this.grow[j];
  }
  clear() { this.n = 0; this.geom.setDrawRange(0, 0); }
}

// Deterministic randomness, so every phone builds the same scenery.
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export const hashStr = str => [...str].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
