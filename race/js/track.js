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

export const TRACKS = {
  rajwada: {
    name: 'Rajwada Ring',
    blurb: 'Poha stalls, chai tapri and gaay mata around the old palace',
    emoji: '🛕',
    theme: 'day',
    pts: [[0, 0], [90, -5], [150, 10], [185, 55], [175, 110], [130, 135], [95, 175], [110, 230], [80, 275], [20, 280], [-30, 250], [-45, 195], [-90, 170], [-125, 120], [-115, 55], [-70, 15]],
    breakers: [0.16, 0.62],
    potholes: [[0.1, -3], [0.1, 3.5], [0.33, 0], [0.47, -4], [0.71, 2], [0.86, -2.5], [0.86, 4]],
    boosts: [[0.24, 0], [0.55, -3.5], [0.9, 3]],
    boxes: [0.06, 0.4, 0.75],
    cows: [[0.29, 0], [0.52, 11], [0.8, 23]],
    sleepers: [[0.44, 2.5]],
    landmark: 'rajwada',
  },
  sarafa: {
    name: 'Sarafa Night Run',
    blurb: 'Jalebi, bhutte ka kees and fairy lights, after midnight',
    emoji: '🌙',
    theme: 'night',
    pts: [[0, 0], [70, 0], [120, -20], [170, 0], [190, 50], [160, 88], [105, 82], [72, 112], [88, 160], [140, 178], [178, 218], [162, 268], [100, 285], [40, 260], [0, 222], [-45, 238], [-98, 214], [-115, 162], [-82, 120], [-102, 70], [-75, 22]],
    breakers: [0.08, 0.45, 0.78],
    potholes: [[0.2, 2], [0.28, -3], [0.36, 3.5], [0.55, 0], [0.66, -4], [0.93, 2.5]],
    boosts: [[0.13, 3], [0.5, -2], [0.84, 0]],
    boxes: [0.04, 0.31, 0.6, 0.86],
    cows: [[0.24, 5], [0.42, 17], [0.7, 29], [0.96, 9]],
    sleepers: [[0.58, -2]],
    landmark: 'sarafa',
  },
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
export function buildTrack(id) {
  const def = TRACKS[id] || TRACKS.rajwada;
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
