// Tracks: Indore street circuits as closed splines, sampled every couple of metres.
// Everything here is plain maths (no three.js), so the race sim and the Node tests use it too.
//
// Map coordinates are metres: x to the east, z to the south, y up. A kart facing
// heading h drives towards (cos h, sin h); turning right makes h bigger.
// Hazards and props are placed by lap fraction (0 = start line, 0.5 = halfway).

export const ROAD_W = 14;      // tarmac width
export const HALF_W = ROAD_W / 2;
export const KERB = 1.2;       // black-and-yellow kerb on each side
export const SHOULDER = 7;     // dusty shoulder beyond the tarmac, before the walls
export const STEP = 2;         // sample spacing along the track

import { OSM } from './tracks-osm.js';

// The real-street tracks: centre lines traced from OpenStreetMap (see tools/build-tracks.mjs).
// Map data © OpenStreetMap contributors, ODbL 1.0.
const real = (id, def) => ({ pts: OSM[id].pts, marks: OSM[id].marks, real: true, autoStart: true, ...def });

export const TRACKS = {
  rajwada: real('rajwada', {
    name: 'Rajwada',
    blurb: 'Round the real Rajwada palace: Rajwada Square, MG Road, Jawahar Marg, Prince Yashwant Road',
    emoji: '🛕', theme: 'day', style: 'old',
    breakers: [0.3, 0.72], potholes: [[0.12, -3], [0.12, 3.5], [0.4, 0], [0.55, -4], [0.78, 2], [0.9, -2.5]],
    boosts: [[0.2, 0], [0.62, -3]], boxes: [0.08, 0.45, 0.8], cows: [[0.26, 0], [0.58, 11], [0.86, 23]], sleepers: [[0.5, 2.5]],
  }),
  sarafa: real('sarafa', {
    name: 'Sarafa Night Run',
    blurb: 'The real Sarafa lanes after midnight: jalebi, garadu and fairy lights',
    emoji: '🌙', theme: 'night', style: 'old',
    breakers: [0.18, 0.62], potholes: [[0.25, 2], [0.33, -3], [0.47, 3.5], [0.7, 0], [0.92, -3]],
    boosts: [[0.1, 3], [0.55, -2], [0.82, 0]], boxes: [0.05, 0.38, 0.72], cows: [[0.28, 5], [0.5, 17], [0.85, 29]], sleepers: [[0.66, -2]],
  }),
  chhappan: real('chhappan', {
    name: 'Chhappan Dukan',
    blurb: 'Real Palasia streets at dusk: Janjeerwala Square, MG Marg past 56 Dukan, Old A.B. Road',
    emoji: '🌭', theme: 'dusk', style: 'food',
    breakers: [0.22, 0.6], potholes: [[0.36, -3], [0.47, 2.5], [0.66, 0], [0.78, -4], [0.92, 3.5]],
    boosts: [[0.13, 0], [0.42, 3], [0.84, -2]], boxes: [0.08, 0.33, 0.68], cows: [[0.27, 4], [0.52, 15], [0.88, 27]], sleepers: [[0.6, 2.5]],
    arches: [[0.4, 'gate56']],
  }),
  vijaynagar: real('vijaynagar', {
    name: 'Vijay Nagar',
    blurb: 'Vijay Nagar Square, A.B. Road, Bombay Hospital and the Ring Road, at night',
    emoji: '🏙️', theme: 'city', style: 'modern',
    breakers: [0.28, 0.71], potholes: [[0.18, 3], [0.44, -3], [0.58, 0], [0.86, -2.5]],
    boosts: [[0.1, 0], [0.36, -3], [0.64, 3], [0.92, 0]], boxes: [0.05, 0.32, 0.62, 0.84], cows: [[0.23, 7], [0.52, 19], [0.78, 31]], sleepers: [[0.4, -2]],
    arches: [[0.16, 'gate114']], spots: [[0.82, 'mall', 1], [0.48, 'coaching', -1]],
  }),
  awasvihar: real('awasvihar', {
    name: 'Rajiv Awas Vihar',
    blurb: 'Scheme 114: in at the Aastha Hospital gate, through the blocks, past the water tank and the udyaans',
    emoji: '🏘️', theme: 'day', style: 'colony',
    breakers: [0.15, 0.4, 0.66, 0.9], potholes: [[0.22, 2], [0.3, -3], [0.5, 0], [0.74, 3], [0.82, -2]],
    boosts: [[0.08, 0], [0.56, 2]], boxes: [0.05, 0.35, 0.7], cows: [[0.2, 3], [0.46, 13], [0.78, 25]], sleepers: [[0.6, 1.5]],
    arches: [[0.03, 'gate114']],
  }),
  sansad: real('sansad', {
    name: 'Sansad Marg, Delhi',
    blurb: 'Round Parliament: Sansad Marg, Patel Chowk, Windsor Place, Raisina Road',
    emoji: '🏛️', theme: 'delhi', style: 'delhi',
    breakers: [0.3, 0.75], potholes: [[0.2, -3], [0.5, 2], [0.86, 0]],
    boosts: [[0.12, 0], [0.45, -3], [0.7, 3]], boxes: [0.06, 0.4, 0.78], cows: [[0.35, 5], [0.62, 19]], sleepers: [[0.55, -2]],
  }),
  court: real('court', {
    name: 'Supreme Court, Delhi',
    blurb: 'India Gate to the Supreme Court along Tilak Marg. Order, order!',
    emoji: '⚖️', theme: 'delhi', style: 'delhi',
    breakers: [0.25, 0.7], potholes: [[0.18, 3], [0.48, -2], [0.82, 0]],
    boosts: [[0.1, 0], [0.42, 3], [0.66, -3]], boxes: [0.06, 0.36, 0.74], cows: [[0.3, 9], [0.58, 21]], sleepers: [[0.9, 2]],
  }),
  flyover: {
    name: 'Flyover Phataphat',
    blurb: 'A figure of eight over the new flyover, trucks honking all the way',
    emoji: '🌉',
    theme: 'sunset',
    // A figure of eight: one branch climbs over the flyover, the other dives under it.
    pts: Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2;
      const w = Math.atan2(Math.sin(t), Math.cos(t));
      return [190 * Math.sin(t), 120 * Math.sin(2 * t), 9 * Math.exp(-((w / 0.62) ** 2))];
    }),
    // start on the flat straight just after passing under the flyover
    startAt: 0.56,
    breakers: [0.18, 0.83],
    potholes: [[0.22, -2.5], [0.38, 3], [0.6, 0], [0.68, -3.5], [0.74, 3]],
    boosts: [[0.5, 0], [0.94, 0], [0.08, -3]],
    boxes: [0.25, 0.55, 0.88],
    cows: [[0.12, 3], [0.64, 13], [0.78, 21]],
    sleepers: [[0.42, -1.5]],
    landmark: 'flyover',
  },
};
export const TRACK_IDS = Object.keys(TRACKS);

// Centripetal Catmull-Rom through closed control points (smooth, no loops or cusps).
function spline(pts, segs = 32) {
  const n = pts.length;
  const P = pts.map(p => [p[0], p[2] || 0, p[1]]); // [x, y, z]
  const out = [];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const t0 = 0;
    const t1 = t0 + Math.sqrt(dist(p0, p1));
    const t2 = t1 + Math.sqrt(dist(p1, p2));
    const t3 = t2 + Math.sqrt(dist(p2, p3));
    for (let k = 0; k < segs; k++) {
      const t = t1 + ((t2 - t1) * k) / segs;
      const pt = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const a1 = ((t1 - t) / (t1 - t0)) * p0[c] + ((t - t0) / (t1 - t0)) * p1[c];
        const a2 = ((t2 - t) / (t2 - t1)) * p1[c] + ((t - t1) / (t2 - t1)) * p2[c];
        const a3 = ((t3 - t) / (t3 - t2)) * p2[c] + ((t - t2) / (t3 - t2)) * p3[c];
        const b1 = ((t2 - t) / (t2 - t0)) * a1 + ((t - t0) / (t2 - t0)) * a2;
        const b2 = ((t3 - t) / (t3 - t1)) * a2 + ((t - t1) / (t3 - t1)) * a3;
        pt[c] = ((t2 - t) / (t2 - t1)) * b1 + ((t - t1) / (t2 - t1)) * b2;
      }
      out.push(pt);
    }
  }
  return out;
}

const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

// Build the sampled track: arrays of centre points, tangents, left normals and heights.
// Start on the longest straight (so the grid isn't round a corner).
function rotateToStraight(X, Y, Z, N) {
  const ang = i => Math.atan2(Z[(i + 1) % N] - Z[(i - 1 + N) % N], X[(i + 1) % N] - X[(i - 1 + N) % N]);
  const bend = new Float32Array(N);
  for (let i = 0; i < N; i++) bend[i] = Math.abs(wrapPi(ang((i + 2) % N) - ang((i - 2 + N) % N)));
  let best = 0, bestLen = 0;
  for (let i = 0; i < N; i++) {
    let len = 0;
    while (len < N && bend[(i + len) % N] < 0.05) len++;
    if (len > bestLen) { bestLen = len; best = i; }
  }
  const k = (best + Math.floor(bestLen * 0.6)) % N;
  for (const A of [X, Y, Z]) { const c = Array.from(A); for (let i = 0; i < N; i++) A[i] = c[(i + k) % N]; }
}

// The lap fraction nearest f where the road runs straight for a little while.
function straightNear(T, f, loose = false) {
  const { N, CURV } = T;
  const i0 = Math.round(f * N), win = Math.round(N * 0.06);
  let best = i0, bv = Infinity;
  for (let j = -win; j <= win; j++) {
    let c = 0;
    for (let k = -6; k <= 6; k++) c += Math.abs(CURV[(((i0 + j + k) % N) + N) % N]);
    const v = c + Math.abs(j) * (loose ? 0.004 : 0.0015);
    if (v < bv) { bv = v; best = i0 + j; }
  }
  return ((((best % N) + N) % N) / N);
}

export function buildTrack(id) {
  let def = TRACKS[id] || TRACKS.rajwada;
  let dense = spline(def.pts);
  if (def.startAt) { // rotate so s = 0 sits at the chosen start
    const k = Math.round(def.startAt * dense.length);
    dense = dense.slice(k).concat(dense.slice(0, k));
  }
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2]));
  }
  const L = cum[dense.length];
  const N = Math.round(L / STEP);
  const step = L / N;
  const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * step;
    while (cum[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length];
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    X[i] = a[0] + (b[0] - a[0]) * f;
    Y[i] = a[1] + (b[1] - a[1]) * f;
    Z[i] = a[2] + (b[2] - a[2]) * f;
  }
  if (def.autoStart) rotateToStraight(X, Y, Z, N);
  const TX = new Float32Array(N), TZ = new Float32Array(N), NX = new Float32Array(N), NZ = new Float32Array(N);
  const ANG = new Float32Array(N), CURV = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = (i - 1 + N) % N, q = (i + 1) % N;
    const dx = X[q] - X[p], dz = Z[q] - Z[p];
    const l = Math.hypot(dx, dz) || 1;
    TX[i] = dx / l; TZ[i] = dz / l;
    NX[i] = TZ[i]; NZ[i] = -TX[i]; // left of the driver
    ANG[i] = Math.atan2(TZ[i], TX[i]);
  }
  for (let i = 0; i < N; i++) {
    CURV[i] = wrapPi(ANG[(i + 1) % N] - ANG[(i - 1 + N) % N]) / (2 * step); // >0 bends right
  }
  const T = { id, def, N, L, step, X, Y, Z, TX, TZ, NX, NZ, ANG, CURV };
  T.at = s => ((Math.round(s / step) % N) + N) % N;
  T.world = (frac, d = 0) => {
    const i = T.at(frac * L);
    return { i, x: X[i] + NX[i] * d, z: Z[i] + NZ[i] * d, y: Y[i], h: ANG[i] };
  };
  // Is sample i part of the flyover deck (with the other branch passing underneath)?
  T.bridge = new Uint8Array(N);
  T.elevated = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (Y[i] > 0.6) T.elevated[i] = 1;
    if (Y[i] < 3) continue;
    for (let k = 0; k < N; k += 2) {
      if (Y[i] - Y[k] > 4 && Math.hypot(X[i] - X[k], Z[i] - Z[k]) < HALF_W + SHOULDER + 12) { T.bridge[i] = 1; break; }
    }
  }
  // How far from the centre line a kart can go: the full street with its dusty shoulder,
  // narrowing smoothly over ~30 m into the flyover railings (no sudden walls).
  T.lim = new Float32Array(N);
  const FULL = HALF_W + SHOULDER - 1.5, RAIL = HALF_W - 0.4, TAPER = 15;
  for (let i = 0; i < N; i++) {
    let lim = FULL;
    for (let j = -TAPER; j <= TAPER; j++) {
      if (!T.elevated[(i + j + N) % N]) continue;
      const f = Math.abs(j) / TAPER;
      lim = Math.min(lim, RAIL + (FULL - RAIL) * f * f * (3 - 2 * f));
    }
    T.lim[i] = lim;
  }
  // On the real streets, nudge hazards and boxes onto the nearest straight bit.
  const snap = (f, loose) => (def.real ? straightNear(T, f, loose) : f);
  def = { ...def,
    breakers: (def.breakers || []).map(f => snap(f)),
    boosts: (def.boosts || []).map(([f, d]) => [snap(f), d]),
    boxes: (def.boxes || []).map(f => snap(f)),
    potholes: (def.potholes || []).map(([f, d]) => [snap(f, true), d]),
    cows: (def.cows || []).map(([f, ph]) => [snap(f, true), ph]),
    sleepers: (def.sleepers || []).map(([f, d]) => [snap(f, true), d]),
    arches: (def.arches || []).map(([f, k]) => [snap(f), k]),
  };
  T.def = def;
  T.breakers = (def.breakers || []).map(f => f * L);
  T.potholes = (def.potholes || []).map(([f, d]) => ({ ...T.world(f, d), r: 1.4, s: f * L, d }));
  T.boosts = (def.boosts || []).map(([f, d]) => ({ ...T.world(f, d), s: f * L, d, len: 7, half: 2.2 }));
  T.boxes = [];
  for (const f of def.boxes || []) for (const d of [-4.8, -2.4, 0, 2.4, 4.8]) T.boxes.push({ ...T.world(f, d), s: f * L });
  T.cows = (def.cows || []).map(([f, phase]) => ({ ...T.world(f, 0), s: f * L, phase }));
  T.sleepers = (def.sleepers || []).map(([f, d]) => ({ ...T.world(f, d), s: f * L, d }));
  return T;
}

// Height of the speed breakers at distance s along the lap (they span the full road).
export function bumpAt(T, s) {
  for (const b of T.breakers) {
    let ds = s - b;
    if (ds > T.L / 2) ds -= T.L; else if (ds < -T.L / 2) ds += T.L;
    if (ds > -1.1 && ds < 1.1) { const c = Math.cos((ds / 1.1) * (Math.PI / 2)); return 0.34 * c * c; }
  }
  return 0;
}

// Natural cows wander across the road on a fixed 36 s timetable, so every phone sees
// them in the same place without sending anything. Returns lateral offset and facing.
export const COW_REACH = HALF_W + 2.5;
export function cowAt(cow, t) {
  const p = ((((t + cow.phase) / 36) % 1) + 1) % 1;
  let d, dir = 0;
  if (p < 0.25) d = -COW_REACH;
  else if (p < 0.5) { const f = (p - 0.25) / 0.25; d = -COW_REACH + 2 * COW_REACH * (f * f * (3 - 2 * f)); dir = 1; }
  else if (p < 0.75) d = COW_REACH;
  else { const f = (p - 0.75) / 0.25; d = COW_REACH - 2 * COW_REACH * (f * f * (3 - 2 * f)); dir = -1; }
  return { d, dir, walking: dir !== 0 };
}

// Where is (x, z) on the track? Searches around `hint` so the two branches of the
// figure of eight never get mixed up. Writes into `out` to avoid garbage.
export function locate(T, x, z, hint, out = {}, win = 14) {
  const { N, X, Z } = T;
  let best = 0, bd = Infinity;
  if (hint == null || hint < 0) { hint = 0; win = N >> 1; }
  for (let j = -win; j <= win; j++) {
    const i = (((hint + j) % N) + N) % N;
    const dx = x - X[i], dz = z - Z[i];
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = i; }
  }
  // project onto the segment either side of the closest sample
  let i0 = best, i1 = (best + 1) % N;
  let ex = X[i1] - X[i0], ez = Z[i1] - Z[i0];
  let f = ((x - X[i0]) * ex + (z - Z[i0]) * ez) / (ex * ex + ez * ez);
  if (f < 0) {
    i1 = i0; i0 = (best - 1 + N) % N;
    ex = X[i1] - X[i0]; ez = Z[i1] - Z[i0];
    f = ((x - X[i0]) * ex + (z - Z[i0]) * ez) / (ex * ex + ez * ez);
  }
  f = Math.max(0, Math.min(1, f));
  const cx = X[i0] + ex * f, cz = Z[i0] + ez * f;
  const nx = T.NX[i0] + (T.NX[i1] - T.NX[i0]) * f, nz = T.NZ[i0] + (T.NZ[i1] - T.NZ[i0]) * f;
  out.idx = best;
  out.i0 = i0;
  out.s = (i0 + f) * T.step;
  out.d = (x - cx) * nx + (z - cz) * nz;
  out.y = T.Y[i0] + (T.Y[i1] - T.Y[i0]) * f;
  out.tx = T.TX[i0]; out.tz = T.TZ[i0];
  out.nx = nx; out.nz = nz;
  out.ang = T.ANG[i0];
  out.elevated = T.elevated[i0] || T.elevated[i1];
  out.lim = T.lim[i0] + (T.lim[i1] - T.lim[i0]) * f;
  return out;
}

// Distance along the lap from a to b, wrapped into (-L/2, L/2].
export function lapDelta(T, a, b) {
  let d = b - a;
  if (d > T.L / 2) d -= T.L; else if (d <= -T.L / 2) d += T.L;
  return d;
}
