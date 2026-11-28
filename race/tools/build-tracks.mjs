// Builds the real-street tracks from OpenStreetMap data.
//   node race/tools/build-tracks.mjs <folder with the .osm files>
// For each track: route along real roads between waypoints (shortest path), close the
// loop, scale it to race size, round the corners so karts can take them, and collect
// the real building outlines along the way. Writes js/tracks-osm.js (the centre lines
// and landmark spots) and tracks/<id>.json (the buildings, loaded when you race there).
//
// Map data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
// Fetch an area with: https://api.openstreetmap.org/api/0.6/map?bbox=minLon,minLat,maxLon,maxLat

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOsm } from './osm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RACE = path.join(HERE, '..');
const SRC = process.argv[2] || '.';

// Waypoints are [lat, lon]; the route goes through them in order and back to the first.
// marks: landmarks to build at their real spot. scale shrinks or stretches the map.
export const CONFIG = {
  rajwada: {
    area: 'rajwada', scale: 1.3,
    waypoints: [[22.71853, 75.85561], [22.71886, 75.85411], [22.71629, 75.85429], [22.71643, 75.85554]],
    marks: [['rajwada', 22.71802, 75.85476], ['chhatri', 22.7192, 75.8565]],
  },
  sarafa: {
    area: 'rajwada', scale: 1.0,
    waypoints: [[22.71853, 75.85561], [22.71807, 75.8530], [22.71800, 75.85107], [22.71573, 75.85107], [22.71643, 75.85554]],
    marks: [['rajwada', 22.71802, 75.85476], ['temple', 22.7171, 75.8524]],
  },
  chhappan: {
    area: 'palasia', scale: 0.72,
    waypoints: [[22.72664, 75.88099], [22.72262, 75.88232], [22.72380, 75.88530], [22.72530, 75.88770], [22.72550, 75.88422]],
    marks: [['food56', 22.72399, 75.88451]],
  },
  vijaynagar: {
    area: 'vijaynagar', scale: 0.52,
    waypoints: [[22.75112, 75.89546], [22.75520, 75.89620], [22.75380, 75.90100], [22.75350, 75.90400], [22.74940, 75.90350], [22.74975, 75.89900]],
    marks: [['hospital', 22.75467, 75.90349], ['fountain', 22.75112, 75.89546]],
  },
  // Rajiv Awas Vihar (Scheme 114 side): round the blocks with the X-shaped lanes
  awasvihar: {
    area: 'awasvihar', scale: 1.35,
    gardens: [['A Block Garden', 22.77012, 75.88858, 16, -0.3], ['Block-B Udyaan', 22.77135, 75.88882, 16, -0.3], ['C Block Garden', 22.77105, 75.89005, 16, -0.3], ['D Block Garden', 22.76988, 75.89000, 16, -0.3]],
    // in at the Aastha Hospital gate, up through the blocks, out along the top road,
    // down the east road and back along the main road
    waypoints: [[22.76936, 75.88902, 'secondary'], [22.77010, 75.88920], [22.77117, 75.88911], [22.77189, 75.88927], [22.77151, 75.89075], [22.76940, 75.89045, 'secondary']],
    marks: [['watertank', 22.77058, 75.88933], ['hall', 22.77030, 75.88985], ['coaching', 22.76985, 75.88935]],
  },
  sansad: {
    area: 'delhi', scale: 0.55,
    waypoints: [[28.61706, 77.21227], [28.62368, 77.21293], [28.62019, 77.21874], [28.61671, 77.21861]],
    marks: [['parliament', 28.61711, 77.20965], ['oldparliament', 28.61719, 77.20781]],
  },
  court: {
    area: 'delhi', scale: 0.38,
    waypoints: [[28.61543, 77.23315], [28.62100, 77.23750], [28.62495, 77.24028], [28.61683, 77.24028], [28.61427, 77.23460]],
    marks: [['indiagate', 28.61293, 77.22949], ['court', 28.62231, 77.23943]],
  },
};

const ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link', 'trunk_link', 'service']);
const FP1 = 7 + 7 - 0.3 + 2.2; // the footpath's outer edge (see scenery.js): buildings start here

function project(lat0, lon0, scale) {
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320, kz = 110540;
  return (lat, lon) => [(lon - lon0) * kx * scale, -(lat - lat0) * kz * scale];
}

function graphOf({ nodes, ways }, allowService = false) {
  const adj = new Map();
  const add = (a, b, w) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, w]); };
  for (const w of ways) {
    const hw = w.tags.highway;
    if (!ROADS.has(hw) || (hw === 'service' && !allowService) || ['parking_aisle', 'driveway', 'drive-through'].includes(w.tags.service)) continue;
    const pen = hw === 'service' ? 3 : 1; // prefer proper roads
    for (let i = 1; i < w.refs.length; i++) {
      const a = nodes.get(w.refs[i - 1]), b = nodes.get(w.refs[i]);
      if (!a || !b) continue;
      const d = Math.hypot((a.lat - b.lat) * 110540, (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180)) * pen;
      add(a.id, b.id, d); add(b.id, a.id, d);
    }
  }
  return adj;
}

function nearestNode(nodes, adj, lat, lon, only = null) {
  let best = null, bd = Infinity;
  for (const id of adj.keys()) {
    if (only && !only.has(id)) continue;
    const n = nodes.get(id);
    const d = (n.lat - lat) ** 2 + ((n.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

// Shortest path; edges already used by the loop cost extra, so it doesn't double back.
function dijkstra(adj, from, to, used) {
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  const heap = [[0, from]];
  while (heap.length) {
    heap.sort((a, b) => a[0] - b[0]);
    const [d, u] = heap.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const [v, w] of adj.get(u) || []) {
      const extra = used.has(`${u}>${v}`) || used.has(`${v}>${u}`) ? 20 : 1;
      const nd = d + w * extra;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); heap.push([nd, v]); }
    }
  }
  const out = [to];
  while (out[0] !== from) { const p = prev.get(out[0]); if (!p) throw new Error(`no road from ${from} to ${to}`); out.unshift(p); }
  return out;
}

function simplify(pts, tol) { // Douglas-Peucker on an open polyline
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    const d = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / l;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= tol) return [a, b];
  return simplify(pts.slice(0, idx + 1), tol).slice(0, -1).concat(simplify(pts.slice(idx), tol));
}

// Douglas-Peucker on a closed loop: split at the point farthest from the first.
function simplifyClosed(pts, tol) {
  let k = 0, dm = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > dm) { dm = d; k = i; } }
  const a = simplify(pts.slice(0, k + 1), tol), b = simplify(pts.slice(k).concat([pts[0]]), tol);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function chaikin(loop, n) { // round the corners of a closed polygon
  let p = loop;
  for (let k = 0; k < n; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

function resample(loop, step) {
  const out = [];
  let carry = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = carry;
    while (t < len) { out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]); t += step; }
    carry = t - len;
  }
  return out;
}

// Cut out places where the route comes back near itself over a short stretch (a lap
// round a roundabout, a spike up a lane and back), keeping the big loop.
function unpinch(loop, near, maxFrac) {
  for (let pass = 0; pass < 50; pass++) {
    const n = loop.length;
    let cut = null;
    outer: for (let i = 0; i < n; i++) {
      for (let span = Math.ceil(70 / 4); span < n * maxFrac; span++) {
        const j = (i + span) % n;
        if (Math.hypot(loop[i][0] - loop[j][0], loop[i][1] - loop[j][1]) < near) { cut = [i, span]; break outer; }
      }
    }
    if (!cut) return loop;
    const [i, span] = cut;
    const keep = [];
    for (let k = 0; k < n; k++) { const off = (k - i + n) % n; if (off === 0 || off >= span) keep.push(loop[k]); }
    loop = keep;
  }
  return loop;
}

// Ease every bend until none is tighter than rmin (the line moves inside the corner a bit).
function easeCorners(loop, rmin) {
  const n = loop.length;
  for (let pass = 0; pass < 2000; pass++) {
    let worst = 0;
    for (let i = 0; i < n; i++) {
      const a = loop[(i - 1 + n) % n], b = loop[i], c = loop[(i + 1) % n];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      const curv = (2 * cross) / (ab * bc * ac || 1); // 1 / circumradius
      if (curv > 1 / rmin) {
        worst = Math.max(worst, curv);
        b[0] += ((a[0] + c[0]) / 2 - b[0]) * 0.4;
        b[1] += ((a[1] + c[1]) / 2 - b[1]) * 0.4;
      }
    }
    if (!worst) break;
  }
  return loop;
}

function distToLoop(loop, x, z) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const f = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - a[0] - dx * f, z - a[1] - dz * f);
    if (d < best) { best = d; bi = i; }
  }
  return [best, bi];
}

const area = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function buildOne(id, cfg, osm) {
  const { nodes } = osm;
  const adj = graphOf(osm, cfg.service);
  const lat0 = cfg.waypoints.reduce((s, w) => s + w[0], 0) / cfg.waypoints.length;
  const lon0 = cfg.waypoints.reduce((s, w) => s + w[1], 0) / cfg.waypoints.length;
  const P = project(lat0, lon0, cfg.scale);
  // a waypoint can say which kind of road it means: [lat, lon, 'secondary']
  const onClass = cls => { const set = new Set(); for (const w of osm.ways) if (w.tags.highway === cls) for (const r of w.refs) set.add(r); return set; };
  const W = cfg.waypoints.map(([la, lo, cls]) => nearestNode(nodes, adj, la, lo, cls ? onClass(cls) : null));
  const used = new Set();
  let route = [];
  for (let i = 0; i < W.length; i++) {
    const seg = dijkstra(adj, W[i], W[(i + 1) % W.length], used);
    for (let k = 1; k < seg.length; k++) used.add(`${seg[k - 1]}>${seg[k]}`);
    route = route.concat(i ? seg.slice(1) : seg);
  }
  route.pop(); // the last node is the first again
  // drop out-and-back spikes (A, B, A)
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < route.length; i++) {
      const a = route[(i - 1 + route.length) % route.length], c = route[(i + 1) % route.length];
      if (a === c) { route.splice(i, 1); route.splice(i % route.length, 1); changed = true; break; }
    }
  }
  const repeats = route.length - new Set(route).size;
  let loop = route.map(nid => { const n = nodes.get(nid); return P(n.lat, n.lon); });
  loop = simplifyClosed(loop, 1.5);
  loop = resample(loop, 4);
  loop = unpinch(loop, cfg.pinch ?? 30, cfg.pinchFrac ?? 0.3);
  loop = easeCorners(resample(loop, 4), cfg.rmin ?? 21);
  loop = easeCorners(resample(loop, 4), cfg.rmin ?? 21);
  const pts = resample(loop, cfg.step ?? 16).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
  let len = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }

  // buildings along the route: real outlines, pushed back behind the footpath if needed
  const rng = seeded(id.length * 7919);
  const bld = [];
  for (const w of osm.ways) {
    if (!w.tags.building || w.refs.length < 4 || w.refs[0] !== w.refs[w.refs.length - 1]) continue;
    let poly = w.refs.slice(0, -1).map(r => nodes.get(r)).filter(Boolean).map(n => P(n.lat, n.lon));
    if (poly.length < 3) continue;
    poly = simplifyClosed(poly, 0.6 * cfg.scale);
    if (poly.length < 3 || poly.length > 24) continue;
    const ar = Math.abs(area(poly));
    if (ar < 12 || ar > 6000) continue;
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const [dc] = distToLoop(loop, cx, cz);
    if (dc > 150 || dc < 6) continue;
    let dmin = Infinity, bi = 0;
    for (const p of poly) { const [d, i] = distToLoop(loop, p[0], p[1]); if (d < dmin) { dmin = d; bi = i; } }
    if (dmin < FP1 + 0.6) {
      // push it straight away from the road
      const a = loop[bi], b = loop[(bi + 1) % loop.length];
      let nx = -(b[1] - a[1]), nz = b[0] - a[0];
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      if ((cx - a[0]) * nx + (cz - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
      const push = FP1 + 0.6 - dmin;
      if (push > 25) continue;
      poly = poly.map(([x, z]) => [x + nx * push, z + nz * push]);
      const again = Math.min(...poly.map(p => distToLoop(loop, p[0], p[1])[0]));
      if (again < FP1 + 0.3) continue;
    }
    const lv = Number(w.tags['building:levels']) || Number(w.tags.levels) || 0;
    const tall = Number(String(w.tags.height || '').replace(/[^\d.]/g, '')) || 0;
    const floors = lv || Math.max(1, Math.round((tall || 0) / 3.2)) || (ar < 60 ? 1 + Math.floor(rng() * 2) : ar < 250 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 3));
    const h = tall || floors * 3.2 + 0.4;
    bld.push({ h: Math.round(Math.min(60, h) * 10) / 10, d: dmin, poly: poly.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]) });
  }
  // the other real streets (side roads, the colony's X lanes), cut where they meet the race road
  const WIDTH = { primary: 12, trunk: 12, secondary: 11, tertiary: 9, unclassified: 7, residential: 6.5, living_street: 5, service: 4.5, track: 4 };
  const roads = [];
  for (const w of osm.ways) {
    const base = WIDTH[w.tags.highway];
    if (!base) continue;
    const wd = Math.max(3.5, Math.min(12, base * Math.min(1.2, cfg.scale + 0.3)));
    let run = [];
    const flush = () => { if (run.length > 1) roads.push([Math.round(wd * 10) / 10, ...run.flat()]); run = []; };
    for (const r of w.refs) {
      const n = nodes.get(r);
      if (!n) { flush(); continue; }
      const [x, z] = P(n.lat, n.lon);
      const [d] = distToLoop(loop, x, z);
      if (d < FP1 + wd / 2 || d > 220) { flush(); continue; }
      run.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
    }
    flush();
  }
  // parks and gardens (the colony's udyaans), and named places to put up boards for.
  // A garden too close to the race road shrinks towards its middle instead of vanishing.
  const parks = [], names = [];
  const fit = poly => {
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    if (distToLoop(loop, cx, cz)[0] > 200 || distToLoop(loop, cx, cz)[0] < FP1 + 3) return null;
    for (let f = 1; f >= 0.3; f -= 0.05) {
      const q = poly.map(([x, z]) => [cx + (x - cx) * f, cz + (z - cz) * f]);
      if (q.every(p => distToLoop(loop, p[0], p[1])[0] > FP1 + 1)) return { q, cx, cz };
    }
    return null;
  };
  const addPark = (poly, name) => {
    const r = fit(poly);
    if (!r || parks.some(pk => Math.hypot(pk.cx - r.cx, pk.cz - r.cz) < 18)) return;
    parks.push({ ...r, name });
  };
  for (const w of osm.ways) {
    const t = w.tags;
    const green = t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'grass' || t.landuse === 'recreation_ground' || t.leisure === 'playground';
    if (!green || w.refs[0] !== w.refs[w.refs.length - 1]) continue;
    const poly = w.refs.slice(0, -1).map(r => nodes.get(r)).filter(Boolean).map(n => P(n.lat, n.lon));
    if (poly.length >= 3) addPark(poly, t.name || '');
  }
  // the colony's blocks A, B, C and D each have a garden in the middle; name the mapped ones
  // and add the ones the map doesn't have: [name, lat, lon, size in metres, turn]
  for (const [name, la, lo, size, turn] of cfg.gardens || []) {
    const [x, z] = P(la, lo);
    const near = parks.find(pk => Math.hypot(pk.cx - x, pk.cz - z) < 25 * cfg.scale);
    if (near) { near.name = name; continue; }
    const h = (size * cfg.scale) / 2, c = Math.cos(turn || 0), sn = Math.sin(turn || 0);
    addPark([[-h, -h], [h, -h], [h, h], [-h, h]].map(([u, v]) => [x + u * c - v * sn, z + u * sn + v * c]), name);
  }
  for (const pk of parks) if (pk.name) names.push([pk.name, Math.round(pk.cx), Math.round(pk.cz), 'park']);
  for (const w of osm.ways) {
    const t = w.tags;
    if (!t.name || !(t.amenity === 'school' || t.amenity === 'hospital' || t.amenity === 'clinic' || t.shop === 'supermarket')) continue;
    const ns = w.refs.map(r => nodes.get(r)).filter(Boolean);
    if (!ns.length) continue;
    const [x, z] = P(ns.reduce((a, n) => a + n.lat, 0) / ns.length, ns.reduce((a, n) => a + n.lon, 0) / ns.length);
    if (distToLoop(loop, x, z)[0] < 160) names.push([t.name, Math.round(x), Math.round(z), t.amenity || t.shop]);
  }
  for (const n of nodes.values()) {
    const t = n.tags;
    if (!t.name || !(t.amenity === 'school' || t.amenity === 'hospital' || t.shop === 'supermarket' || t.leisure === 'park')) continue;
    const [x, z] = P(n.lat, n.lon);
    if (distToLoop(loop, x, z)[0] < 160 && !names.some(m => m[0] === t.name)) names.push([t.name, Math.round(x), Math.round(z), t.amenity || t.shop || t.leisure]);
  }
  bld.sort((a, b) => a.d - b.d);
  const keep = bld.slice(0, cfg.maxBuildings || 900);
  const marks = (cfg.marks || []).map(([kind, la, lo]) => { const [x, z] = P(la, lo); return [kind, Math.round(x), Math.round(z)]; });
  // drop buildings sitting on a garden
  const inPark = (x, z) => parks.some(pk => { let c = false; const q = pk.q; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > z) !== (q[j][1] > z) && x < ((q[j][0] - q[i][0]) * (z - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c; return c; });
  const keep2 = keep.filter(b => { const xs = b.poly.map(p => p[0]), zs = b.poly.map(p => p[1]); return !inPark(xs.reduce((a, v) => a + v, 0) / xs.length, zs.reduce((a, v) => a + v, 0) / zs.length); });
  const round = v => Math.round(v * 10) / 10;
  return { id, pts, len, repeats, marks, buildings: keep2.map(b => [b.h, ...b.poly.flat()]), roads, parks: parks.map(pk => pk.q.flatMap(([x, z]) => [round(x), round(z)])), names: names.slice(0, 14), lat0, lon0, scale: cfg.scale };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cache = {};
  const out = {};
  const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(CONFIG);
  fs.mkdirSync(path.join(RACE, 'tracks'), { recursive: true });
  for (const id of only) {
    const cfg = CONFIG[id];
    const osm = cache[cfg.area] || (cache[cfg.area] = readOsm(path.join(SRC, `${cfg.area}.osm`)));
    const r = buildOne(id, cfg, osm);
    out[id] = { pts: r.pts, marks: r.marks };
    if (process.env.DEBUG_OUT) fs.writeFileSync(path.join(process.env.DEBUG_OUT, `${id}.route.json`), JSON.stringify({ lat0: r.lat0, lon0: r.lon0, scale: r.scale, pts: r.pts, area: cfg.area, waypoints: cfg.waypoints, buildings: r.buildings.slice(0, 900) }));
    fs.writeFileSync(path.join(RACE, 'tracks', `${id}.json`), JSON.stringify({ attribution: 'Map data © OpenStreetMap contributors, ODbL', buildings: r.buildings, roads: r.roads, parks: r.parks, names: r.names }));
    console.log(`${id}: lap ${Math.round(r.len)} m, ${r.pts.length} points, ${r.buildings.length} buildings, ${r.roads.length} side streets, ${r.parks.length} parks, names: ${r.names.map(n => n[0]).join(', ')}`);
  }
  // merge with tracks already built
  const file = path.join(RACE, 'js', 'tracks-osm.js');
  let prev = {};
  if (fs.existsSync(file)) { const m = fs.readFileSync(file, 'utf8').match(/export const OSM = (\{[\s\S]*\});/); if (m) prev = JSON.parse(m[1]); }
  const all = { ...prev, ...out };
  fs.writeFileSync(file, `// Generated by race/tools/build-tracks.mjs from OpenStreetMap: real street centre lines\n// (scaled to race size, corners rounded) and landmark spots, in metres.\n// Map data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).\nexport const OSM = ${JSON.stringify(all)};\n`);
}
