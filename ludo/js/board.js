// Board drawing + token animation. The board is one SVG in "cell" units:
// 15 × 15, with (0,0) the top-left corner. Red sits top-left, then clockwise
// green, yellow, blue.

import { COLORS, START, SAFE, YARD, HOME, LAST_TRACK, square } from './engine.js';
import { CHAR_IDS, faceMarkup } from './characters.js';

export const TEAM = { red: '#E5383B', green: '#1FA45B', yellow: '#F2B705', blue: '#1F6FEB', pink: '#E040A0' };
export const TINT = { red: '#FDD5D5', green: '#C9EED8', yellow: '#FFEDB8', blue: '#D2E3FD', pink: '#FBD3EA' };

export const TRACK = (() => {
  const t = [];
  for (let c = 1; c <= 5; c++) t.push([c, 6]);
  for (let r = 5; r >= 0; r--) t.push([6, r]);
  t.push([7, 0], [8, 0]);
  for (let r = 1; r <= 5; r++) t.push([8, r]);
  for (let c = 9; c <= 14; c++) t.push([c, 6]);
  t.push([14, 7], [14, 8]);
  for (let c = 13; c >= 9; c--) t.push([c, 8]);
  for (let r = 9; r <= 14; r++) t.push([8, r]);
  t.push([7, 14], [6, 14]);
  for (let r = 13; r >= 9; r--) t.push([6, r]);
  for (let c = 5; c >= 0; c--) t.push([c, 8]);
  t.push([0, 7], [0, 6]);
  return t;
})();

const LANE = {
  red: [1, 2, 3, 4, 5].map(c => [c, 7]),
  green: [1, 2, 3, 4, 5].map(r => [7, r]),
  yellow: [13, 12, 11, 10, 9].map(c => [c, 7]),
  blue: [13, 12, 11, 10, 9].map(r => [7, r]),
};
const YARD_AT = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
const SPOTS = [[2, 2], [4, 2], [2, 4], [4, 4]];
const GOAL = { red: [6.55, 7.5], green: [7.5, 6.55], yellow: [8.45, 7.5], blue: [7.5, 8.45] };
const GOAL_SPOTS = [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]];

const SVGNS = 'http://www.w3.org/2000/svg';

const YARD_R = 2.4;
const CLASSIC = { TRACK, LANE, YARD_AT, GOAL, ANG: TRACK.map(() => 0), view: '-0.2 -0.2 15.4 15.4', draw: () => staticBoard() };

// 5-player board: five 3×6 arms around a pentagon centred on (0,0), red pointing
// left then clockwise. Same per-arm path as the classic board, so the same
// 13-squares-per-colour rules apply. Cells are stored by top-left corner like TRACK.
const PENTA = (() => {
  const A = 1.5 / Math.tan(Math.PI / 5); // centre → inner edge of an arm
  const deg = k => -162 + 72 * k;
  // `out` cells out from the arm's inner edge, `side` cells to its left (+) or right (−).
  const at = (k, out, side) => {
    const a = (deg(k) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), r = A + out;
    return [r * ux + side * uy - 0.5, r * uy - side * ux - 0.5];
  };
  const raw = [], ang = [];
  for (let k = 0; k < 5; k++) {
    for (let j = 0; j < 6; j++) raw.push(at(k, j + 0.5, 1));
    raw.push(at(k, 5.5, 0));
    for (let j = 5; j >= 0; j--) raw.push(at(k, j + 0.5, -1));
    for (let j = 0; j < 13; j++) ang.push(deg(k));
  }
  // Each colour starts on its own arm's right column, 2nd square from the tip.
  const rot = list => list.slice(8).concat(list.slice(0, 8));
  const P = { TRACK: rot(raw), ANG: rot(ang), LANE: {}, YARD_AT: {}, GOAL: {}, ARM: {}, CORNERS: {}, view: '-9.4 -9.4 18.8 18.8' };
  COLORS.forEach((c, k) => {
    P.LANE[c] = [4, 3, 2, 1, 0].map(j => at(k, j + 0.5, 0));
    // Yard: a circle wedged between this arm and the next, touching both.
    const y = ((deg(k) + 36) * Math.PI) / 180, d = (1.5 + YARD_R) / Math.sin(Math.PI / 5);
    P.YARD_AT[c] = [d * Math.cos(y) - 3, d * Math.sin(y) - 3];
    const g = (deg(k) * Math.PI) / 180;
    P.GOAL[c] = [1.3 * Math.cos(g), 1.3 * Math.sin(g)];
    P.ARM[c] = deg(k);
    P.CORNERS[c] = [at(k, 0, 1.5), at(k, 0, -1.5)].map(([x, py]) => [x + 0.5, py + 0.5]);
  });
  P.draw = () => staticBoard5(P);
  return P;
})();
let G = CLASSIC;

// Centre of where token t of colour c sits at step p.
export function spot(c, p, t) {
  if (p === YARD) { const [x, y] = G.YARD_AT[c]; return { x: x + SPOTS[t][0], y: y + SPOTS[t][1], s: 1 }; }
  if (p === HOME) { const [x, y] = G.GOAL[c]; return { x: x + GOAL_SPOTS[t][0], y: y + GOAL_SPOTS[t][1], s: 0.42 }; }
  const [x, y] = p > LAST_TRACK ? G.LANE[c][p - LAST_TRACK - 1] : G.TRACK[square(c, p)];
  return { x: x + 0.5, y: y + 0.5, s: 1 };
}
export const squareCenter = sq => ({ x: G.TRACK[sq][0] + 0.5, y: G.TRACK[sq][1] + 0.5 });

function starPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(3)} ${(cy + rr * Math.sin(a)).toFixed(3)}`;
  }
  return d + 'Z';
}

function staticBoard() {
  let g = '<rect x="-0.15" y="-0.15" width="15.3" height="15.3" rx="0.45" fill="#2a1747"/>';
  g += '<rect width="15" height="15" rx="0.3" fill="#fffdf7"/>';
  // track cells
  const startColor = {};
  for (const c of Object.keys(START)) startColor[START[c]] = c;
  TRACK.forEach(([x, y], sq) => {
    const c = startColor[sq];
    g += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c ? TEAM[c] : '#fffdf7'}" stroke="#d8d2c4" stroke-width="0.035"/>`;
    if (SAFE.includes(sq)) g += `<path d="${starPath(x + 0.5, y + 0.52, 0.32)}" fill="${c ? '#fff' : '#cfc6b3'}" opacity="${c ? 0.85 : 1}"/>`;
  });
  // home lanes + entry arrows
  for (const c of Object.keys(LANE)) {
    for (const [x, y] of LANE[c]) g += `<rect x="${x}" y="${y}" width="1" height="1" fill="${TEAM[c]}" stroke="#d8d2c4" stroke-width="0.035"/>`;
    const [ax, ay] = TRACK[square(c, LAST_TRACK)];
    const rot = { red: 0, green: 90, yellow: 180, blue: 270 }[c];
    g += `<path d="M-0.28 -0.14 H0.08 V-0.3 L0.32 0 L0.08 0.3 V0.14 H-0.28Z" fill="${TEAM[c]}" opacity=".55" transform="translate(${ax + 0.5} ${ay + 0.5}) rotate(${rot})"/>`;
  }
  // yards
  for (const c of Object.keys(YARD_AT)) {
    const [x, y] = YARD_AT[c];
    g += `<rect x="${x}" y="${y}" width="6" height="6" fill="${TEAM[c]}"/>`;
    g += `<rect x="${x + 0.75}" y="${y + 0.75}" width="4.5" height="4.5" rx="0.7" fill="#fffdf7"/>`;
    g += `<g class="yard-glow" data-c="${c}"><rect x="${x + 0.75}" y="${y + 0.75}" width="4.5" height="4.5" rx="0.7" fill="none" stroke="${TEAM[c]}" stroke-width="0.22"/></g>`;
    for (const [dx, dy] of SPOTS) g += `<circle cx="${x + dx}" cy="${y + dy}" r="0.62" fill="${TINT[c]}" stroke="${TEAM[c]}" stroke-width="0.08"/>`;
  }
  // centre
  g += `<path d="M6 6 L9 6 L7.5 7.5Z" fill="${TEAM.green}"/><path d="M9 6 L9 9 L7.5 7.5Z" fill="${TEAM.yellow}"/>`;
  g += `<path d="M9 9 L6 9 L7.5 7.5Z" fill="${TEAM.blue}"/><path d="M6 9 L6 6 L7.5 7.5Z" fill="${TEAM.red}"/>`;
  g += '<path d="M6 6 L9 9 M9 6 L6 9" stroke="rgba(255,255,255,.5)" stroke-width="0.04"/>';
  return g + `<g transform="translate(7.5 7.55)">${BOMB}</g>`;
}

// the bomb in the middle
const BOMB = '<circle r="0.52" fill="#2a1747" stroke="#fff" stroke-width="0.07"/>' +
  '<path d="M0.22 -0.42 Q0.42 -0.72 0.62 -0.6" fill="none" stroke="#fff" stroke-width="0.07" stroke-linecap="round"/>' +
  '<circle class="spark" cx="0.64" cy="-0.6" r="0.11" fill="#FFC93C"/>' +
  '<text y="0.17" text-anchor="middle" font-size="0.42" font-weight="900" fill="#fff" font-family="Bungee, sans-serif">AL</text>';

function staticBoard5(P) {
  const cell = ([x, y], a, fill) => `<rect x="-0.5" y="-0.5" width="1" height="1" transform="translate(${(x + 0.5).toFixed(3)} ${(y + 0.5).toFixed(3)}) rotate(${a})" fill="${fill}" stroke="#d8d2c4" stroke-width="0.035"/>`;
  let g = '<circle r="9.3" fill="#2a1747"/><circle r="9.12" fill="#fffdf7"/>';
  const startColor = {};
  for (const c of Object.keys(P.LANE)) startColor[START[c]] = c;
  P.TRACK.forEach(([x, y], sq) => {
    const c = startColor[sq];
    g += cell([x, y], P.ANG[sq], c ? TEAM[c] : '#fffdf7');
    if (SAFE.includes(sq)) g += `<path d="${starPath(x + 0.5, y + 0.52, 0.32)}" fill="${c ? '#fff' : '#cfc6b3'}" opacity="${c ? 0.85 : 1}"/>`;
  });
  for (const c of Object.keys(P.LANE)) {
    for (const xy of P.LANE[c]) g += cell(xy, P.ARM[c], TEAM[c]);
    const [ax, ay] = P.TRACK[square(c, LAST_TRACK)];
    g += `<path d="M-0.28 -0.14 H0.08 V-0.3 L0.32 0 L0.08 0.3 V0.14 H-0.28Z" fill="${TEAM[c]}" opacity=".55" transform="translate(${(ax + 0.5).toFixed(3)} ${(ay + 0.5).toFixed(3)}) rotate(${P.ARM[c] + 180})"/>`;
    const [yx, yy] = P.YARD_AT[c].map(v => v + 3);
    g += `<circle cx="${yx.toFixed(3)}" cy="${yy.toFixed(3)}" r="${YARD_R}" fill="${TEAM[c]}"/><circle cx="${yx.toFixed(3)}" cy="${yy.toFixed(3)}" r="${YARD_R - 0.35}" fill="#fffdf7"/>`;
    g += `<g class="yard-glow" data-c="${c}"><circle cx="${yx.toFixed(3)}" cy="${yy.toFixed(3)}" r="${YARD_R - 0.35}" fill="none" stroke="${TEAM[c]}" stroke-width="0.22"/></g>`;
    for (const [dx, dy] of SPOTS) g += `<circle cx="${(yx + dx - 3).toFixed(3)}" cy="${(yy + dy - 3).toFixed(3)}" r="0.62" fill="${TINT[c]}" stroke="${TEAM[c]}" stroke-width="0.08"/>`;
    const [[x1, y1], [x2, y2]] = P.CORNERS[c];
    g += `<path d="M0 0 L${x1.toFixed(3)} ${y1.toFixed(3)} L${x2.toFixed(3)} ${y2.toFixed(3)}Z" fill="${TEAM[c]}" stroke="rgba(255,255,255,.5)" stroke-width="0.04"/>`;
  }
  return g + `<g transform="translate(0 0.05)">${BOMB}</g>`;
}

function defs() {
  const faces = CHAR_IDS.map(id => `<symbol id="face-${id}" viewBox="0 0 100 100">${faceMarkup(id)}</symbol>`).join('');
  return `<defs>${faces}<clipPath id="tok-clip"><circle r="0.4"/></clipPath>` +
    '<radialGradient id="boom-grad"><stop offset="0" stop-color="#fff7c2"/><stop offset=".35" stop-color="#FFC93C"/><stop offset=".7" stop-color="#FF6B35"/><stop offset="1" stop-color="#E5383B" stop-opacity="0"/></radialGradient></defs>';
}

function boxMarkup(sq) {
  const { x, y } = squareCenter(sq);
  return `<g class="box" transform="translate(${x} ${y})"><g class="box-in">` +
    '<rect x="-0.36" y="-0.3" width="0.72" height="0.62" rx="0.1" fill="#8A4FFF" stroke="#fff" stroke-width="0.05"/>' +
    '<rect x="-0.06" y="-0.3" width="0.12" height="0.62" fill="#FFC93C"/>' +
    '<text y="0.16" text-anchor="middle" font-size="0.42" font-weight="900" fill="#fff" font-family="Bungee, sans-serif">?</text></g></g>';
}

export class Board {
  constructor(svg, { onTap } = {}) {
    this.svg = svg;
    this.onTap = onTap;
    this.speed = 1;
    svg.innerHTML = defs() + '<g class="static"></g><g class="boxes"></g><g class="marks"></g><g class="tokens"></g><g class="fxl"></g>';
    this.staticG = svg.querySelector('.static');
    this.useArms(4);
    this.boxesG = svg.querySelector('.boxes');
    this.marksG = svg.querySelector('.marks');
    this.tokensG = svg.querySelector('.tokens');
    this.fxG = svg.querySelector('.fxl');
    this.els = new Map();   // "red:0" → <g>
    this.pos = new Map();   // "red:0" → {x, y, s}
    this.targets = [];      // tappable tokens [{c, t}]
    svg.addEventListener('pointerup', e => this.tap(e));
  }

  // Classic board for 2–4 players, the 5-arm one for 5.
  useArms(n) {
    if (n === this.arms) return;
    this.arms = n;
    G = n === 5 ? PENTA : CLASSIC;
    this.svg.setAttribute('viewBox', G.view);
    this.staticG.innerHTML = G.draw();
  }

  // Build token elements for the players in this game.
  setPlayers(players) {
    const sig = players.map(p => `${p.color}${p.char}`).join();
    if (sig === this.sig) return;
    this.sig = sig;
    this.tokensG.innerHTML = '';
    this.els.clear(); this.pos.clear();
    for (const p of players) {
      if (!p.color) continue;
      for (let t = 0; t < 4; t++) {
        const g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', 'tok');
        g.innerHTML = '<g class="tok-in">' +
          '<ellipse cx="0" cy="0.36" rx="0.34" ry="0.11" fill="rgba(0,0,0,.28)"/>' +
          `<circle class="tok-ring" r="0.47" fill="${TEAM[p.color]}" stroke="#fff" stroke-width="0.07"/>` +
          `<g clip-path="url(#tok-clip)"><circle r="0.4" fill="${TINT[p.color]}"/><use href="#face-${p.char}" xlink:href="#face-${p.char}" x="-0.46" y="-0.5" width="0.92" height="0.92"/></g>` +
          '<circle class="tok-hi" r="0.58" fill="none" stroke="#fff" stroke-width="0.09" stroke-dasharray="0.22 0.12"/>' +
          '<text class="tok-shield" x="0.3" y="-0.22" font-size="0.36" text-anchor="middle">🛡️</text>' +
          '</g>';
        this.tokensG.appendChild(g);
        this.els.set(`${p.color}:${t}`, g);
      }
    }
  }

  place(k, { x, y, s }) {
    const el = this.els.get(k);
    if (!el) return;
    this.pos.set(k, { x, y, s });
    el.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${s.toFixed(3)})`);
  }

  // Snap everything to where the state says it is (with stacking for shared squares).
  layout(state) {
    this.setPlayers(state.players);
    const groups = new Map();
    for (const c of Object.keys(state.tokens || {})) {
      state.tokens[c].forEach((p, t) => {
        const at = spot(c, p, t);
        const k = p === YARD || p === HOME ? `${c}:${t}` : `${at.x},${at.y}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push({ k: `${c}:${t}`, at });
      });
    }
    const OFF = { 2: [[-0.2, -0.16], [0.2, 0.16]], 3: [[-0.2, -0.18], [0.2, -0.18], [0, 0.2]], 4: [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] };
    for (const list of groups.values()) {
      const n = Math.min(list.length, 4);
      list.forEach(({ k, at }, i) => {
        if (n === 1) return this.place(k, at);
        const [dx, dy] = OFF[n][i % 4];
        this.place(k, { x: at.x + dx, y: at.y + dy, s: 0.68 });
      });
    }
    // Draw tokens further down the board on top, so stacks read naturally.
    [...this.els.entries()].sort((a, b) => (this.pos.get(a[0])?.y || 0) - (this.pos.get(b[0])?.y || 0))
      .forEach(([, el]) => this.tokensG.appendChild(el));
    this.boxesG.innerHTML = (state.boxes || []).map(boxMarkup).join('');
    for (const [k, el] of this.els) el.classList.toggle('shielded', !!(state.shields && state.shields[k]));
    this.svg.querySelectorAll('.yard-glow').forEach(g => {
      const cur = state.players[state.turn];
      g.classList.toggle('on', (state.phase === 'roll' || state.phase === 'move') && !!cur && cur.color === g.dataset.c);
    });
  }

  // Tokens the local player may tap right now. mode: 'move' | 'kaboom' | null
  highlight(list = [], mode = null, blast = null) {
    this.targets = list;
    this.mode = mode;
    for (const [k, el] of this.els) {
      const on = list.some(o => `${o.c}:${o.t}` === k);
      el.classList.toggle('can', on && mode === 'move');
      el.classList.toggle('aim', on && mode === 'kaboom');
    }
    this.marksG.innerHTML = '';
    if (mode === 'kaboom' && blast) {
      for (const { sq } of blast) {
        const { x, y } = squareCenter(sq);
        this.marksG.insertAdjacentHTML('beforeend', `<rect class="blast-zone" x="${x - 0.5}" y="${y - 0.5}" width="1" height="1" transform="rotate(${G.ANG[sq]} ${x} ${y})"/>`);
      }
    }
  }

  tap(e) {
    if (!this.targets.length || !this.onTap) return;
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = this.svg.getScreenCTM();
    if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    let best = null, bestD = 1.3;
    for (const o of this.targets) {
      const at = this.pos.get(`${o.c}:${o.t}`);
      if (!at) continue;
      const d = Math.hypot(at.x - p.x, at.y - p.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) this.onTap(best);
  }

  // ---------- animation ----------
  wait(ms) { return new Promise(r => setTimeout(r, ms / this.speed)); }

  tween(ms, fn) {
    ms /= this.speed;
    return new Promise(res => {
      if (document.hidden || ms < 5) { fn(1); return res(); }
      const t0 = performance.now();
      const step = now => {
        const u = Math.max(0, Math.min(1, (now - t0) / ms));
        fn(u);
        if (u < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }

  async hop(k, to, ms = 150, height = 0.35) {
    const el = this.els.get(k);
    if (!el) return;
    this.tokensG.appendChild(el);
    const from = this.pos.get(k) || to;
    const ease = u => 1 - (1 - u) * (1 - u);
    await this.tween(ms, u => {
      const e = ease(u);
      this.place(k, {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * u) * height,
        s: from.s + (to.s - from.s) * e,
      });
    });
  }

  // Walk a token from step `from` to step `to`, one square at a time.
  async walk(c, t, from, to, { fast = false, onStep } = {}) {
    const k = `${c}:${t}`;
    this.place(k, from === YARD ? spot(c, YARD, t) : spot(c, from, t));
    if (from === YARD) { onStep && onStep(); return this.hop(k, spot(c, to, t), 320, 1.2); }
    const dir = to > from ? 1 : -1;
    for (let p = from + dir; dir > 0 ? p <= to : p >= to; p += dir) {
      onStep && onStep();
      await this.hop(k, spot(c, p, t), fast ? 70 : 150, fast ? 0.15 : 0.35);
    }
  }

  // Teleport-style flight straight to step `to` (mystery box swaps).
  async walkFly(c, t, to) {
    await this.hop(`${c}:${t}`, spot(c, to, t), 700, 2.5);
  }

  async flyHome(c, t, ms = 520) {
    await this.hop(`${c}:${t}`, spot(c, YARD, t), ms, 2.2);
  }

  async boom(sq, big = true) {
    const { x, y } = squareCenter(sq);
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);
    const r0 = big ? 3.2 : 1.1;
    let parts = `<circle class="boom-core" r="0.1" fill="url(#boom-grad)"/>`;
    const n = big ? 14 : 7;
    for (let i = 0; i < n; i++) parts += `<circle class="boom-p" r="${big ? 0.16 : 0.1}" fill="${['#FFC93C', '#FF6B35', '#E5383B', '#2a1747'][i % 4]}"/>`;
    g.innerHTML = parts;
    this.fxG.appendChild(g);
    const core = g.querySelector('.boom-core');
    const ps = [...g.querySelectorAll('.boom-p')].map((el, i) => ({ el, a: (i / n) * Math.PI * 2 + Math.random() * 0.4, d: r0 * (0.6 + Math.random() * 0.5) }));
    await this.tween(big ? 750 : 420, u => {
      const e = 1 - Math.pow(1 - u, 3);
      core.setAttribute('r', (r0 * e).toFixed(3));
      core.setAttribute('opacity', (1 - u * u).toFixed(3));
      for (const p of ps) {
        p.el.setAttribute('cx', (Math.cos(p.a) * p.d * e).toFixed(3));
        p.el.setAttribute('cy', (Math.sin(p.a) * p.d * e + u * u * 0.8).toFixed(3));
        p.el.setAttribute('opacity', (1 - u).toFixed(3));
      }
    });
    g.remove();
  }

  // A little emoji pop above a square (box opening, shield block…)
  async pop(sq, text) {
    const { x, y } = squareCenter(sq);
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '1');
    t.textContent = text;
    this.fxG.appendChild(t);
    await this.tween(800, u => {
      t.setAttribute('x', x.toFixed(3));
      t.setAttribute('y', (y - 0.2 - u * 1.4).toFixed(3));
      t.setAttribute('opacity', (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3).toFixed(3));
    });
    t.remove();
  }
}
