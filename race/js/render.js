// The WebGL view: one scene, a chase camera that's tuned separately for portrait and
// landscape phones, items flying about, explosions, and the podium.
// The pixel ratio adapts to the phone: if frames get slow it renders a bit softer.

import { THREE, Batch, MAT, Particles, textSprite, setMaxAniso, radialTexture } from './gfx.js';
import { buildWorld } from './scenery.js';
import { KartView } from './karts.js';
import { cowAt } from './track.js';
import { BASE_V } from './sim.js';

const PI = Math.PI;
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function chappalBatch() {
  const b = new Batch();
  b.box([0, 0, 0], [0.95, 0.12, 0.4], '#1d70d6');
  b.box([0, 0.07, 0], [0.9, 0.03, 0.36], '#ffffff');
  b.rod([0.2, 0.08, 0], [-0.1, 0.22, 0.16], 0.035, '#1d70d6');
  b.rod([0.2, 0.08, 0], [-0.1, 0.22, -0.16], 0.035, '#1d70d6');
  return b.geometry();
}
function cookerBatch() {
  const b = new Batch();
  b.shape('cyl', [0, 0.4, 0], [0.5, 0.75, 0.5], '#c9ced6');
  b.shape('cyl', [0, 0.8, 0], [0.42, 0.08, 0.42], '#7d838c');
  b.box([0.65, 0.8, 0], [0.8, 0.1, 0.14], '#1e1e1e');
  b.box([-0.6, 0.55, 0], [0.3, 0.08, 0.14], '#1e1e1e');
  b.shape('cyl', [0, 0.95, 0], [0.08, 0.22, 0.08], '#1e1e1e');
  b.shape('sph6', [0, 1.08, 0], [0.1, 0.1, 0.1], '#1e1e1e');
  return b.geometry();
}
function paanBatch() {
  const b = new Batch();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3, r = i ? 0.6 + (i % 3) * 0.35 : 0;
    b.shape('cyl', [Math.cos(a) * r, 0, Math.sin(a) * r], [i ? 0.45 + (i % 2) * 0.25 : 1.3, 0.02, i ? 0.4 : 1.1], i % 3 === 2 ? '#7a0f22' : '#b3122e');
  }
  return b.geometry();
}
function cowBatch() {
  const b = new Batch();
  const white = '#f4f1ea', grey = '#d8d2c6';
  b.box([0, 1.05, 0], [1.7, 0.75, 0.75], white);
  b.box([0.35, 1.5, 0], [0.45, 0.25, 0.5], grey);
  b.box([1.0, 1.35, 0], [0.5, 0.42, 0.4], white);
  b.box([1.3, 1.25, 0], [0.22, 0.26, 0.32], '#f0c4b4');
  for (const s of [-1, 1]) b.shape('cone', [0.95, 1.65, 0.16 * s], [0.06, 0.32, 0.06], s > 0 ? '#ff7a1a' : '#1d70d6', [0.6 * s, 0, 0]);
  for (const [x, z] of [[-0.6, -0.25], [-0.6, 0.25], [0.6, -0.25], [0.6, 0.25]]) b.box([x, 0.35, z], [0.16, 0.7, 0.16], grey);
  b.shape('sph6', [0.78, 1.0, 0], [0.12, 0.12, 0.12], '#ffcc1a');
  for (let i = 0; i < 8; i++) { const a = (i / 7) * PI; b.shape('sph6', [0.8, 1.15 - Math.sin(a) * 0.25, Math.cos(a) * 0.3], [0.07, 0.07, 0.07], i % 2 ? '#ff9f1c' : '#ffd23f'); }
  return b.geometry();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
    setMaxAniso(r.capabilities.getMaxAnisotropy());
    this.r = r;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = this.maxDpr;
    r.setPixelRatio(this.dpr);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.4, 900);
    this.sparks = new Particles(1200, { additive: true });
    this.fire = new Particles(600, { additive: true });
    this.dust = new Particles(600, { additive: false });
    this.confetti = new Particles(700, { additive: false, soft: false });
    for (const p of [this.sparks, this.fire, this.dust, this.confetti]) this.scene.add(p.points);
    this.karts = new Map();
    this.objs = new Map();
    this.fx = [];
    this.world = null;
    this.cam = { yaw: 0, x: 0, y: 5, z: 0, lx: 0, ly: 0, lz: 0, shake: 0, fov: 60, mode: 'chase', t: 0, init: false };
    this.geo = { chappal: chappalBatch(), cooker: cookerBatch(), paan: paanBatch(), cow: cowBatch() };
    this.glow = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.frames = [];
    this.lastAdapt = 0;
    this.w = 1; this.h = 1;
    this.portrait = false;
    this._v = new THREE.Vector3();
    this._dummy = new THREE.Object3D();
  }

  setTrack(T) {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.clearObjs();
    this.T = T;
    this.world = buildWorld(T, this.scene);
    this.updateFov(this.camera.fov);
  }

  addKart(id, char, opts) {
    if (this.karts.has(id)) this.removeKart(id);
    const v = new KartView(char, opts);
    this.scene.add(v.root);
    this.karts.set(id, v);
    return v;
  }
  removeKart(id) {
    const v = this.karts.get(id);
    if (!v) return;
    this.scene.remove(v.root);
    v.dispose();
    this.karts.delete(id);
  }
  clearKarts() { for (const id of [...this.karts.keys()]) this.removeKart(id); }

  resize(w, h) {
    this.w = w; this.h = h;
    this.portrait = h > w * 1.1;
    this.r.setPixelRatio(this.dpr);
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.updateFov(this.cam.fov);
  }

  updateFov(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    const scale = (this.h * this.dpr) / (2 * Math.tan((fov * PI) / 360));
    const set = m => { m.uniforms.scale.value = scale; m.uniforms.maxSize.value = (m.userData.maxPx || 160) * this.dpr; };
    for (const p of [this.sparks, this.fire, this.dust, this.confetti]) set(p.mat);
    if (this.world) this.world.group.traverse(o => { if (o.isPoints && o.material.uniforms) set(o.material); });
  }

  // Base vertical field of view: wide in landscape, taller in portrait.
  baseFov() {
    const aspect = this.w / this.h;
    const hfov = this.portrait ? 62 : 92;
    const v = (2 * Math.atan(Math.tan((hfov * PI) / 360) / aspect) * 180) / PI;
    return Math.max(50, Math.min(this.portrait ? 84 : 62, v));
  }

  // ---------------------------------------------------------------- camera

  // pose: { x, y, z, mh (direction of travel), v, boost }
  follow(dt, pose, mode = 'chase') {
    const c = this.cam;
    const P = this.portrait;
    const dist = P ? 7.4 : 6.4, height = P ? 4.1 : 2.9, look = P ? 6 : 5;
    if (!c.init || mode !== c.mode) { if (!c.init) { c.yaw = pose.mh; } c.mode = mode; c.t = 0; c.init = true; }
    c.t += dt;
    let tx, ty, tz;
    if (mode === 'intro') {
      // swing round from the front of the kart to behind it
      const t = Math.min(1, c.t / 3.2);
      const e = t * t * (3 - 2 * t);
      const a = pose.mh + PI * 0.7 * (1 - e);
      c.yaw = pose.mh;
      const d = dist + 5 * (1 - e);
      tx = pose.x - Math.cos(a) * d; tz = pose.z - Math.sin(a) * d; ty = pose.y + height + 5 * (1 - e);
      c.x = tx; c.y = ty; c.z = tz;
    } else if (mode === 'orbit') {
      const a = pose.mh + PI * 0.8 + c.t * 0.35;
      tx = pose.x - Math.cos(a) * 9; tz = pose.z - Math.sin(a) * 9; ty = pose.y + 3.8;
      const k = 1 - Math.exp(-dt * 3);
      c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.z += (tz - c.z) * k;
    } else {
      c.yaw = lerpAngle(c.yaw, pose.mh, 1 - Math.exp(-dt * 5.5));
      tx = pose.x - Math.cos(c.yaw) * dist; tz = pose.z - Math.sin(c.yaw) * dist; ty = pose.y + height;
      const k = 1 - Math.exp(-dt * 14);
      c.x += (tx - c.x) * k; c.z += (tz - c.z) * k;
      c.y += (ty - c.y) * (1 - Math.exp(-dt * 6));
    }
    const lx = pose.x + Math.cos(c.yaw) * look, lz = pose.z + Math.sin(c.yaw) * look, ly = pose.y + (P ? 1.0 : 1.3);
    if (mode === 'chase') { c.lx = lx; c.ly = ly; c.lz = lz; } else { c.lx = pose.x; c.ly = pose.y + 1.4; c.lz = pose.z; }
    const fovT = this.baseFov() + (pose.boost ? 9 : 0) + Math.min(1, (pose.v || 0) / BASE_V) * 3;
    c.fov += (fovT - c.fov) * (1 - Math.exp(-dt * 4));
    let sx = 0, sy = 0;
    if (c.shake > 0.01) { sx = (Math.random() - 0.5) * c.shake; sy = (Math.random() - 0.5) * c.shake; c.shake *= Math.exp(-dt * 7); }
    this.camera.position.set(c.x + sx, c.y + sy, c.z);
    this.camera.lookAt(c.lx, c.ly, c.lz);
    if (Math.abs(this.camera.fov - c.fov) > 0.05) this.updateFov(c.fov);
  }

  shake(a) { this.cam.shake = Math.max(this.cam.shake, a); }

  // Compile every effect's shader now (during the countdown), so the first explosion
  // or THWACK! doesn't stall a frame on a phone.
  prewarm() {
    const g = new THREE.Group();
    const at = this.camera.position.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(30));
    g.position.copy(at);
    for (const t of Object.keys(this.geo)) g.add(new THREE.Mesh(this.geo[t], MAT.vc));
    g.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffc36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    g.add(new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 8), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    const t = textSprite('PON PON!', { color: '#ffd23f', stroke: '#1b0f33', size: 72, height: 2 });
    t.material.depthTest = false;
    g.add(t);
    const restore = [];
    for (const v of this.karts.values()) {
      if (!v.shieldMesh) { v.shieldMesh = v.buildShield(); v.shieldMesh.visible = false; }
      if (!v.rocketMesh) { v.rocketMesh = v.buildRocket(); v.rocketMesh.visible = false; }
      for (const o of [v.shieldMesh, v.rocketMesh, v.flame]) { restore.push([o, o.visible]); o.visible = true; }
    }
    this.scene.add(g);
    try { this.r.compile(this.scene, this.camera); } catch (e) { /* older GPUs: just compile lazily */ }
    this.scene.remove(g);
    for (const [o, vis] of restore) o.visible = vis;
  }

  // ---------------------------------------------------------------- items & effects

  clearObjs() {
    for (const m of this.objs.values()) this.scene.remove(m);
    this.objs.clear();
    for (const f of this.fx) this.scene.remove(f.obj);
    this.fx = [];
    for (const p of [this.sparks, this.fire, this.dust, this.confetti]) p.clear();
  }

  syncObjs(objs, now, dt) {
    const seen = new Set();
    for (const o of objs) {
      seen.add(o.id);
      let m = this.objs.get(o.id);
      if (!m) {
        m = new THREE.Mesh(this.geo[o.type] || this.geo.chappal, MAT.vc);
        if (o.type === 'cooker') {
          const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xff2a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          g.position.y = 0.6; g.scale.set(2.5, 2.5, 1);
          m.add(g);
          m.userData.glow = g;
        }
        if (o.type === 'chappal') m.scale.setScalar(1.4);
        this.scene.add(m);
        this.objs.set(o.id, m);
      }
      m.position.set(o.x, o.y, o.z);
      if (o.type === 'chappal') {
        m.rotation.set(0, -o.h, 0);
        m.rotateZ((now * 18) % (2 * PI));
        if (Math.random() < 0.6) this.sparks.emit(o.x, o.y, o.z, 0, 0.5, 0, 0.3, 0.5, '#9fd3ff', 0);
      } else if (o.type === 'cooker') {
        const age = now - o.t0;
        const pulse = age > 2.2 ? 1 + Math.sin(age * 30) * 0.12 : 1;
        m.scale.setScalar(1.3 * pulse);
        m.rotation.y = -o.h;
        m.userData.glow.material.opacity = age > 2 ? 0.5 + Math.sin(age * 30) * 0.5 : 0.25 + Math.sin(age * 8) * 0.2;
      } else if (o.type === 'paan') {
        m.position.y = o.y + 0.12;
        m.rotation.y = -o.h;
      } else if (o.type === 'cow') {
        m.rotation.set(0, -o.h, Math.sin(now * 6) * 0.03);
        m.position.y = o.y + Math.abs(Math.sin(now * 6)) * 0.05;
      }
    }
    for (const [id, m] of this.objs) if (!seen.has(id)) { this.scene.remove(m); this.objs.delete(id); }
  }

  addFx(obj, life, update) {
    this.scene.add(obj);
    this.fx.push({ obj, t: 0, life, update });
  }

  textPop(x, y, z, text, color = '#ffd23f', size = 2.2) {
    const s = textSprite(text, { color, stroke: '#1b0f33', size: 72, height: size });
    s.position.set(x, y, z);
    s.renderOrder = 15;
    s.material.depthTest = false;
    this.addFx(s, 1.3, (f, t) => {
      s.position.y = y + t * 2.2;
      const k = t < 0.15 ? t / 0.15 : 1;
      s.scale.set(size * s.userData.aspect * k, size * k, 1);
      s.material.opacity = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.4) : 1;
    });
  }

  ring(x, y, z, color = '#ffd23f', R = 12) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -PI / 2;
    m.position.set(x, y + 0.6, z);
    this.addFx(m, 0.7, (f, t) => {
      const k = t / 0.7;
      m.scale.setScalar(1 + k * R);
      m.material.opacity = 1 - k;
    });
  }

  explosion(x, y, z, big = true) {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffc36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.position.set(x, y + 1.5, z);
    this.addFx(flash, 0.55, (f, t) => { const k = t / 0.55; flash.scale.setScalar((big ? 18 : 8) * (0.4 + k)); flash.material.opacity = 1 - k; });
    const n = big ? 70 : 30;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, e = Math.random() * 1.2, sp = 6 + Math.random() * 12;
      this.fire.emit(x, y + 0.8, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 3, Math.sin(a) * Math.cos(e) * sp, 0.5 + Math.random() * 0.5, 1.6 + Math.random() * 1.4, Math.random() < 0.5 ? '#ffb347' : '#ff5e1a', 8, -1.2);
    }
    for (let i = 0; i < n / 2; i++) {
      const a = Math.random() * PI * 2, sp = 2 + Math.random() * 4;
      this.dust.emit(x, y + 1, z, Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp, 1.2 + Math.random(), 2.4, '#5c5560', -0.6, 2.5);
    }
    this.ring(x, y, z, '#ffb347', big ? 8 : 4);
  }

  puff(x, y, z, color = '#ffffff', n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2;
      this.dust.emit(x, y + 0.6, z, Math.cos(a) * 2.5, 1 + Math.random() * 2, Math.sin(a) * 2.5, 0.8 + Math.random() * 0.5, 1.4, color, -0.5, 1.6);
    }
  }

  steam(x, y, z) {
    for (let i = 0; i < 16; i++) this.dust.emit(x + (Math.random() - 0.5) * 0.2, y + 1.3, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 1.5, 5 + Math.random() * 3, (Math.random() - 0.5) * 1.5, 0.9, 0.9, '#f4f4f4', 2, 1.8);
  }

  splash(x, y, z, colors, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, sp = 3 + Math.random() * 6;
      this.confetti.emit(x, y + 1, z, Math.cos(a) * sp, 3 + Math.random() * 6, Math.sin(a) * sp, 1 + Math.random() * 0.6, 0.35 + Math.random() * 0.25, colors[i % colors.length], 14);
    }
  }

  // ---------------------------------------------------------------- the world ticking

  animateWorld(dt, raceT, boxT, now) {
    const w = this.world;
    if (!w) return;
    const a = w.anim;
    a.t += dt;
    if (a.strips) a.strips.offset.y = -(a.t * 1.6) % 1;
    if (a.kites) { a.kites.rotation.y = Math.sin(a.t * 0.05) * 0.04; a.kites.position.y = Math.sin(a.t * 0.7) * 1.5; }
    const T = this.T;
    if (a.boxes) {
      const d = this._dummy;
      for (let i = 0; i < T.boxes.length; i++) {
        const b = T.boxes[i];
        const on = !boxT || raceT >= boxT[i];
        const back = boxT ? Math.min(1, Math.max(0, (raceT - boxT[i]) / 0.4)) : 1;
        d.position.set(b.x, b.y + 1.3 + Math.sin(a.t * 2.4 + i) * 0.18, b.z);
        d.rotation.set(0.5, a.t * 1.6 + i, 0.3);
        d.scale.setScalar(on ? 0.2 + 0.8 * back : 0.0001);
        d.updateMatrix();
        a.boxes.setMatrixAt(i, d.matrix);
      }
      a.boxes.instanceMatrix.needsUpdate = true;
    }
    for (const { c, m } of a.cows) {
      const p = cowAt(c, raceT);
      m.position.set(c.x + T.NX[c.i] * p.d, c.y + 0.05 + (p.walking ? Math.abs(Math.sin(now * 5)) * 0.06 : 0), c.z + T.NZ[c.i] * p.d);
      // walking across the road, or grazing on the shoulder facing along it
      const ang = p.walking ? Math.atan2(T.NZ[c.i] * -p.dir, T.NX[c.i] * -p.dir) : T.ANG[c.i] + (p.d > 0 ? 0.3 : -0.3) + PI * (c.phase % 2 ? 1 : 0);
      m.rotation.set(0, -ang, p.walking ? Math.sin(now * 5) * 0.04 : 0);
    }
  }

  // ---------------------------------------------------------------- podium

  // The podium stands on the road just past the finish line, facing back down the
  // straight, and the camera looks at it from the road (never from inside a shop).
  podium(order) {
    const T = this.T;
    const i = T.at(34);
    const cx = T.X[i], cz = T.Z[i], cy = T.Y[i];
    const face = T.ANG[i] + PI; // towards the camera
    const g = new THREE.Group();
    const b = new Batch();
    const steps = [[0, 1.7, '#ffd23f'], [-3.3, 1.15, '#d9dde3'], [3.3, 0.75, '#e0a060']];
    for (const [off, h, col] of steps) {
      b.box([0, h / 2, off], [3, h, 3.2], col);
      b.box([1.52, h * 0.55, off], [0.05, 0.6, 0.8], '#ffffff');
    }
    b.box([-0.4, 0.05, 0], [7, 0.1, 15], '#b3122e');
    for (let k = 0; k < 30; k++) { const f = k / 29; b.shape('sph6', [-2.2, 6.2 - Math.sin(f * PI) * 1.5, -6.5 + f * 13], [0.32, 0.32, 0.32], k % 2 ? '#ff9f1c' : '#ffd23f'); }
    for (const z of [-6.5, 6.5]) b.rod([-2.2, 0, z], [-2.2, 6.4, z], 0.14, '#c1121f');
    g.add(b.mesh());
    g.position.set(cx, cy + 0.06, cz);
    g.rotation.y = -face;
    this.scene.add(g);
    this.podiumGroup = g;
    const c = Math.cos(face), s = Math.sin(face);
    const spots = [];
    order.forEach((id, k) => {
      const v = this.karts.get(id);
      if (!v) return;
      const off = k < 3 ? steps[k][0] : (k % 2 ? 1 : -1) * (6.2 + Math.floor((k - 3) / 2) * 2.6);
      const h = k < 3 ? steps[k][1] : 0;
      const lx = k < 3 ? 0 : 1.2;
      spots.push({ v, x: cx + lx * c - off * s, y: cy + h + 0.06, z: cz + lx * s + off * c, h: face, rank: k });
    });
    this.podiumSpots = spots;
    this.podiumCenter = { x: cx, y: cy, z: cz, ang: face };
    this.cam.mode = 'podium';
    this.cam.t = 0;
  }

  clearPodium() {
    if (this.podiumGroup) this.scene.remove(this.podiumGroup);
    this.podiumGroup = null;
    this.podiumSpots = null;
    this.podiumCenter = null;
  }

  podiumFrame(dt) {
    const pc = this.podiumCenter;
    if (!pc) return;
    const c = this.cam;
    c.t += dt;
    for (const s of this.podiumSpots) {
      const jump = s.rank === 0 ? Math.abs(Math.sin(c.t * 4)) * 0.45 : s.rank < 3 ? Math.abs(Math.sin(c.t * 3 + s.rank)) * 0.15 : 0;
      s.v.update(dt, { x: s.x, y: s.y + jump, z: s.z, gy: s.y, h: s.h + Math.sin(c.t * 1.3 + s.rank) * 0.3, steer: 0, yaw: 0, f: 0, v: 0 }, null, null);
      if (s.v.tag) s.v.tag.visible = false;
    }
    const P = this.portrait;
    const a = pc.ang + Math.sin(c.t * 0.35) * 0.22;
    const d = P ? 17 : 13.5;
    const fx = Math.cos(a), fz = Math.sin(a);
    // the results list covers the bottom (portrait) or the right (landscape): aim so the podium sits in the clear part
    const rx = Math.sin(a), rz = -Math.cos(a); // camera's right as it looks back at the podium
    const side = P ? 0 : 5.2;
    this.camera.position.set(pc.x + fx * d, pc.y + (P ? 4.6 : 3.4), pc.z + fz * d);
    this.camera.lookAt(pc.x + rx * side, pc.y + (P ? -4.6 : 1.4), pc.z + rz * side);
    const fov = P ? 70 : 52;
    if (Math.abs(this.camera.fov - fov) > 0.05) { c.fov = fov; this.updateFov(fov); }
    const cols = ['#ff4fa3', '#ffd23f', '#33CA7F', '#4DA3FF', '#ff7b00', '#ffffff'];
    for (let k = 0; k < 3; k++) this.confetti.emit(pc.x + (Math.random() - 0.5) * 16, pc.y + 11, pc.z + (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 2, -2, (Math.random() - 0.5) * 2, 4, 0.3, cols[Math.floor(Math.random() * cols.length)], 1.2);
  }

  // ---------------------------------------------------------------- frame

  render(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.life) { this.scene.remove(f.obj); if (f.obj.material) f.obj.material.dispose(); this.fx.splice(i, 1); continue; }
      f.update(f, f.t);
    }
    for (const p of [this.sparks, this.fire, this.dust, this.confetti]) p.update(dt);
    this.r.render(this.scene, this.camera);
    this.adapt(dt);
  }

  // Keep it smooth: drop the resolution a notch if frames are slow, raise it back
  // if there's plenty of headroom.
  adapt(dt) {
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    this.frames.length = 0;
    const now = performance.now();
    if (med > 1 / 45 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.resize(this.w, this.h);
      this.lastAdapt = now;
    } else if (med < 1 / 75 && this.dpr < this.maxDpr && now - this.lastAdapt > 8000) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
      this.resize(this.w, this.h);
      this.lastAdapt = now;
    }
  }
}
