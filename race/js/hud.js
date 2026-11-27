// The heads-up display: position, lap, item slot, minimap, the commentator's ticker,
// trash-talk bubbles and the big centre messages. Plain DOM over the WebGL canvas,
// written only when something changes so it never costs a frame.

import { CHARACTERS, avatar } from './riders.js';
import { ITEM_INFO } from './lines.js';

const $ = (s, r = document) => r.querySelector(s);
const SUF = ['th', 'st', 'nd', 'rd'];
export const ordinal = n => `${n}${SUF[(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0] || 'th'}`;

// Item icons: emoji, except the pressure cooker and paan which emoji can't do.
export const ITEM_SVG = {
  cooker: '<svg viewBox="0 0 64 64"><rect x="12" y="24" width="40" height="30" rx="8" fill="#d4d9e0" stroke="#5c6168" stroke-width="3"/><rect x="14" y="18" width="36" height="8" rx="3" fill="#8a9099"/><rect x="48" y="18" width="14" height="5" rx="2" fill="#222"/><rect x="29" y="8" width="6" height="11" rx="2" fill="#222"/><path d="M30 6 Q26 0 31 -2 M36 6 Q40 0 35 -3" stroke="#fff" stroke-width="2.5" fill="none" opacity=".9"/><path d="M20 38 h24" stroke="#fff" stroke-width="3" opacity=".6"/></svg>',
  paan: '<svg viewBox="0 0 64 64"><path d="M32 6 C50 14 58 30 50 46 C44 56 34 60 32 62 C30 60 20 56 14 46 C6 30 14 14 32 6Z" fill="#2fbf55" stroke="#1d7a35" stroke-width="3"/><path d="M32 10 V58" stroke="#1d7a35" stroke-width="2.5"/><circle cx="44" cy="46" r="9" fill="#c8102e"/><circle cx="52" cy="54" r="4" fill="#c8102e"/></svg>',
};
export function itemIcon(id) {
  if (!id) return '';
  return ITEM_SVG[id] || `<span class="emo">${(ITEM_INFO[id] || {}).icon || '❓'}</span>`;
}

export class Hud {
  constructor(root) {
    this.root = root;
    this.el = {
      pos: $('#h-pos', root), suf: $('#h-suf', root), lap: $('#h-lap', root), laps: $('#h-laps', root),
      item: $('#h-item', root), itemBtn: $('#btn-item', root), ticker: $('#h-ticker', root), bubble: $('#h-bubble', root),
      big: $('#h-big', root), speed: $('#h-speed', root), map: $('#h-map', root), board: $('#h-board', root),
      wrong: $('#h-wrong', root), drift: $('#btn-drift', root), x2: $('#h-x2', root), chargeBar: $('#h-charge', root),
    };
    this.cache = {};
    this.mapCtx = this.el.map.getContext('2d');
    this.mapBase = null;
    this.tickQ = [];
    this.now = 0;
    this.timers = [];
    this.rolling = false;
  }

  // Timers run on the game clock, pumped once a frame.
  later(fn, ms) { this.timers.push({ at: this.now + ms, fn }); }
  frame(now) {
    this.now = now;
    if (!this.timers.length) return;
    const due = this.timers.filter(t => t.at <= now);
    if (!due.length) return;
    this.timers = this.timers.filter(t => t.at > now);
    for (const t of due) t.fn();
  }
  cancel(tag) { this.timers = this.timers.filter(t => t.fn.tag !== tag); }
  after(tag, fn, ms) { this.cancel(tag); fn.tag = tag; this.later(fn, ms); }

  set(key, el, val, fn) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    fn(el, val);
  }

  reset(laps) {
    this.cache = {};
    this.tickQ = [];
    this.timers = [];
    this.tickBusy = false;
    this.el.ticker.classList.remove('on');
    this.el.bubble.classList.remove('on');
    this.el.big.className = 'h-big';
    this.el.big.innerHTML = '';
    this.el.laps.textContent = laps;
    this.setItem(null, 0, false);
    this.root.classList.remove('finished');
  }

  update(info) {
    const { pos, n, lap, laps, kmh, item, itemN, rolling, wrong, level, drifting } = info;
    this.set('pos', this.el.pos, pos, (e, v) => { e.textContent = v; this.el.suf.textContent = ordinal(v).replace(/\d+/, ''); e.parentNode.dataset.p = v; e.parentNode.classList.remove('pop'); void e.offsetWidth; e.parentNode.classList.add('pop'); });
    this.set('lap', this.el.lap, lap, (e, v) => { e.textContent = v; });
    this.set('kmh', this.el.speed, kmh, (e, v) => { e.textContent = v; });
    this.set('wrong', this.el.wrong, !!wrong, (e, v) => e.classList.toggle('on', v));
    this.set('lvl', this.el.drift, drifting ? level : -1, (e, v) => { e.dataset.lv = v; });
    if (rolling !== this.rolling || item !== this.cache.item || itemN !== this.cache.itemN) this.setItem(item, itemN, rolling);
  }

  setItem(item, n, rolling) {
    this.rolling = rolling;
    this.cache.item = item;
    this.cache.itemN = n;
    const btn = this.el.itemBtn;
    btn.classList.toggle('rolling', !!rolling);
    btn.classList.toggle('has', !!item && !rolling);
    this.cancel('roll');
    if (rolling) {
      const ids = Object.keys(ITEM_INFO);
      let i = 0;
      const spin = () => { this.el.item.innerHTML = itemIcon(ids[i++ % ids.length]); this.after('roll', spin, 90); };
      spin();
    } else this.el.item.innerHTML = itemIcon(item);
    this.el.x2.textContent = n > 1 && !rolling ? `×${n}` : '';
    btn.setAttribute('aria-label', item ? `Use ${(ITEM_INFO[item] || {}).name}` : 'No item');
  }

  // The commentator: one line at a time across the top.
  tick(text, prio = 0) {
    if (!text) return;
    if (prio) this.tickQ.unshift(text); else this.tickQ.push(text);
    if (this.tickQ.length > 3) this.tickQ.length = 3;
    if (!this.tickBusy) this.nextTick();
  }
  nextTick() {
    const t = this.tickQ.shift();
    const el = this.el.ticker;
    if (!t) { this.tickBusy = false; el.classList.remove('on'); return; }
    this.tickBusy = true;
    el.textContent = t;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    this.after('tick', () => this.nextTick(), 2400);
  }

  // A character says something (a face and a speech bubble).
  bubble(char, text, ms = 2600) {
    if (!text) return;
    const c = CHARACTERS[char] || CHARACTERS.nav;
    const el = this.el.bubble;
    el.innerHTML = `${avatar(char, { weapon: false })}<p><b style="color:${c.accent}">${c.name}</b>${escapeHtml(text)}</p>`;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    this.after('bubble', () => el.classList.remove('on'), ms);
  }

  // Big centre text: countdown, THWACK!, final lap…
  big(html, cls = '', ms = 1100) {
    const el = this.el.big;
    el.innerHTML = html;
    el.className = 'h-big';
    void el.offsetWidth;
    el.className = `h-big on ${cls}`;
    this.cancel('big');
    if (ms) this.after('big', () => { el.className = 'h-big'; }, ms);
  }

  // Standings strip: faces in race order.
  board(order, me) {
    const key = order.map(k => k.id + (k.done ? '!' : '')).join('|');
    if (key === this.cache.board) return;
    this.cache.board = key;
    this.el.board.innerHTML = order.map((k, i) => `<div class="hb ${k.id === me ? 'me' : ''} ${k.done ? 'done' : ''}" style="--a:${(CHARACTERS[k.char] || {}).accent}"><span>${i + 1}</span>${avatar(k.char, { weapon: false })}</div>`).join('');
  }

  // Minimap, north up. The track outline is drawn once per track.
  minimap(T, karts, me) {
    const c = this.el.map;
    const px = Math.round(c.clientWidth * Math.min(2, window.devicePixelRatio || 1));
    if (!px) return;
    if (c.width !== px) { c.width = c.height = px; this.mapBase = null; }
    if (!this.mapBase || this.mapBase.T !== T) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < T.N; i++) { minX = Math.min(minX, T.X[i]); maxX = Math.max(maxX, T.X[i]); minZ = Math.min(minZ, T.Z[i]); maxZ = Math.max(maxZ, T.Z[i]); }
      const pad = px * 0.1;
      const s = (px - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
      const ox = pad + ((px - pad * 2) - (maxX - minX) * s) / 2 - minX * s, oz = pad + ((px - pad * 2) - (maxZ - minZ) * s) / 2 - minZ * s;
      const base = document.createElement('canvas');
      base.width = base.height = px;
      const b = base.getContext('2d');
      b.lineJoin = b.lineCap = 'round';
      const path = () => { b.beginPath(); for (let i = 0; i <= T.N; i++) { const j = i % T.N; const x = T.X[j] * s + ox, y = T.Z[j] * s + oz; if (i) b.lineTo(x, y); else b.moveTo(x, y); } };
      path(); b.strokeStyle = 'rgba(0,0,0,0.55)'; b.lineWidth = px * 0.075; b.stroke();
      path(); b.strokeStyle = '#fff8ec'; b.lineWidth = px * 0.04; b.stroke();
      // the flyover crossing: draw the upper deck again on top
      if (T.bridge.some(v => v)) {
        b.beginPath();
        let on = false;
        for (let i = 0; i < T.N; i++) {
          if (T.Y[i] > 2) { const x = T.X[i] * s + ox, y = T.Z[i] * s + oz; if (on) b.lineTo(x, y); else { b.moveTo(x, y); on = true; } } else on = false;
        }
        b.strokeStyle = 'rgba(0,0,0,0.55)'; b.lineWidth = px * 0.075; b.stroke();
        b.strokeStyle = '#ffd23f'; b.lineWidth = px * 0.04; b.stroke();
      }
      const sx = T.X[0] * s + ox, sy = T.Z[0] * s + oz;
      b.fillStyle = '#111'; b.fillRect(sx - px * 0.035, sy - px * 0.035, px * 0.07, px * 0.07);
      b.fillStyle = '#fff'; b.fillRect(sx - px * 0.035, sy - px * 0.035, px * 0.035, px * 0.035); b.fillRect(sx, sy, px * 0.035, px * 0.035);
      this.mapBase = { T, base, s, ox, oz };
    }
    const { base, s, ox, oz } = this.mapBase;
    const ctx = this.mapCtx;
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(base, 0, 0);
    const r = px * 0.055;
    let mine = null;
    for (const k of karts) {
      if (k.id === me) { mine = k; continue; }
      ctx.beginPath();
      ctx.arc(k.x * s + ox, k.z * s + oz, r, 0, Math.PI * 2);
      ctx.fillStyle = (CHARACTERS[k.char] || {}).accent || '#fff';
      ctx.fill();
      ctx.lineWidth = px * 0.012; ctx.strokeStyle = '#1b0f33'; ctx.stroke();
    }
    if (mine) {
      const x = mine.x * s + ox, y = mine.z * s + oz;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(mine.h);
      ctx.beginPath();
      ctx.moveTo(r * 1.9, 0); ctx.lineTo(-r * 1.1, r * 1.15); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r * 1.1, -r * 1.15); ctx.closePath();
      ctx.fillStyle = (CHARACTERS[mine.char] || {}).accent || '#fff';
      ctx.fill();
      ctx.lineWidth = px * 0.016; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
