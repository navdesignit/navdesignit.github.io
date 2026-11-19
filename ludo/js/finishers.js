// Signature moves. Every character finishes a kill their own way, and sets off a Kaboom their
// own way. Plain DOM + Web Animations, moving only transform and opacity so phones keep up.
//
// Kills play full screen in #killshow: letterbox bars, the move's name, the move itself, then a
// giant stamp and a meme clip. Kabooms add a short signature before and/or after the blast.
// To change a move, edit its function below; styles are under "signature moves" in style.css.

import { TEAM, figureHTML } from './board.js';

let env = { sfx: () => {}, buzz: () => {}, speed: 1 };
export function setFinisherEnv(e) { env = { ...env, ...e }; }

const wait = ms => new Promise(r => setTimeout(r, ms / env.speed));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const rand = (a, b) => a + Math.random() * (b - a);

// Animate el and resolve when it's done. Holds its first frame during a delay and its last after.
function anim(el, frames, ms, opts = {}) {
  if (!el || !el.animate) return Promise.resolve();
  const a = el.animate(frames, { duration: ms / env.speed, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'both', ...opts });
  return a.finished.catch(() => {});
}

// A big standing figure of player p (same drawing as their board token).
const actor = (p, flip = false) =>
  `<div class="fin-actor${flip ? ' flip' : ''}"><div class="piece" data-ch="${esc(p.char)}" style="--c:${TEAM[p.color]};--step:260ms">${figureHTML(p.char, p.color)}</div></div>`;

// Drop something into the effects layer. `at` is CSS for its position, in % of the arena.
function spawn(s, html, at = '') {
  const box = document.createElement('div');
  box.className = 'fin-thing';
  box.style.cssText = at;
  box.innerHTML = html;
  s.fx.appendChild(box);
  return box;
}

function flash(s, color = '#fff') {
  const f = s.q('.fin-flash');
  f.style.background = color;
  anim(f, [{ opacity: 0.95 }, { opacity: 0 }], 260, { easing: 'ease-out' });
}

function shake(s, px = 10, ms = 300) {
  const k = [0, 1, 2, 3, 4, 5].map(i => ({ transform: `translate(${(i % 2 ? 1 : -1) * px * (1 - i / 6)}px, ${(i % 3 - 1) * px * 0.5}px)` }));
  anim(s.arena, [...k, { transform: 'none' }], ms, { easing: 'linear' });
}

// "ORDER!", "CLANG!"… a word that pops up and fades.
function word(s, text, at) {
  const w = spawn(s, `<b class="fin-word">${esc(text)}</b>`, at);
  anim(w, [{ transform: 'scale(0) rotate(-12deg)', opacity: 1 }, { transform: 'scale(1.2) rotate(-6deg)', opacity: 1, offset: 0.4 }, { transform: 'scale(1) rotate(-6deg)', opacity: 0 }], 700);
}

function build(root, hero, prey, move) {
  root.getAnimations({ subtree: true }).forEach(a => a.cancel());
  root.className = `killshow fin fin-${hero.char}`;
  root.innerHTML = '<i class="fin-bar t"></i><i class="fin-bar b"></i>' +
    `<div class="fin-name"><small>${esc(hero.name)} ka</small><b>${esc(move)}</b></div>` +
    `<div class="fin-arena"><div class="fin-hero">${actor(hero)}</div><div class="fin-prey n${prey.length}">${prey.map(p => actor(p, true)).join('')}</div><div class="fin-fx"></div></div>` +
    '<div class="fin-stamp"><span class="big"></span><b></b><small></small></div><i class="fin-flash"></i>';
  root.hidden = false;
  const q = sel => root.querySelector(sel);
  return {
    root, q, arena: q('.fin-arena'), fx: q('.fin-fx'), preyBox: q('.fin-prey'),
    hero: q('.fin-hero .fin-actor'), heroPiece: q('.fin-hero .piece'),
    prey: [...root.querySelectorAll('.fin-prey .fin-actor')], preyPieces: [...root.querySelectorAll('.fin-prey .piece')],
  };
}

// The name slams in with a gong, the killer struts on, the victims shake.
async function intro(s) {
  env.sfx('gong'); env.buzz([60, 40, 60]);
  anim(s.q('.fin-name'), [{ transform: 'scale(2.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 420, { easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
  s.heroPiece.classList.add('turn', 'walking');
  anim(s.hero, [{ transform: 'translateX(-130%)' }, { transform: 'none' }], 520);
  s.prey.forEach(p => anim(p, [{ transform: 'translateX(130%)' }, { transform: 'none' }], 520));
  s.preyPieces.forEach(p => p.classList.add('scared'));
  await wait(540);
  s.heroPiece.classList.remove('walking');
  await wait(260);
}

// Freeze, flash, the stamp slams down with the meme clip, then fade out.
async function finale(s, title, line, emoji = '', style = '') {
  env.sfx('kill'); env.buzz([30, 30, 160]);
  flash(s);
  const st = s.q('.fin-stamp');
  if (style) st.classList.add(style);
  st.querySelector('.big').textContent = emoji;
  st.querySelector('b').textContent = title;
  st.querySelector('small').textContent = line;
  anim(st, [{ transform: 'scale(3) rotate(-14deg)', opacity: 0 }, { transform: 'scale(0.95) rotate(-6deg)', opacity: 1, offset: 0.65 }, { transform: 'scale(1) rotate(-6deg)', opacity: 1 }], 520, { easing: 'cubic-bezier(0.2, 1.2, 0.4, 1)' });
  shake(s, 12, 320);
  s.heroPiece.classList.add('land');
  await wait(1500);
  await anim(s.root, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: 'ease-in' });
}

// ---------------------------------------------------------------- kills

const KILLS = {
  // Ajay: the helicopter shot. The bat whirls twice, CRACK, and the victims leave the stadium.
  ajay: { move: 'Helicopter Shot', async play(s) {
    const bat = s.heroPiece.querySelector('.p-weapon');
    env.sfx('whoosh');
    anim(bat, [{ transform: 'rotate(0)' }, { transform: 'rotate(-720deg)' }], 760, { easing: 'cubic-bezier(0.5, 0, 0.5, 1)' });
    word(s, 'WHIRR', 'left:6%;top:4%');
    await wait(380); env.sfx('whoosh'); await wait(380);
    anim(s.hero, [{ transform: 'none' }, { transform: 'translateX(26%) rotate(6deg)' }], 150, { easing: 'ease-in' });
    await anim(bat, [{ transform: 'rotate(-120deg)' }, { transform: 'rotate(70deg)' }], 150, { easing: 'ease-in' });
    env.sfx('crack'); env.buzz(90); flash(s); shake(s, 8, 200);
    word(s, 'CRACK!', 'left:44%;top:20%');
    s.preyPieces.forEach(p => p.classList.add('spinning'));
    s.prey.forEach((p, i) => anim(p, [
      { transform: 'none', opacity: 1 },
      { transform: `translate(${90 + i * 30}%, -230%) rotate(${700 + i * 90}deg) scale(0.3)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${110 + i * 30}%, -300%) rotate(${900 + i * 90}deg) scale(0.1)`, opacity: 0 },
    ], 1000, { easing: 'cubic-bezier(0.25, 0.7, 0.4, 1)' }));
    await wait(350); env.sfx('crowd');
    await wait(650);
    await finale(s, 'SIXER!', 'Seedha stadium ke bahar 🏟️', '🙌');
  } },

  // Nav: Ctrl + Alt + Delete. A pop-up asks, he clicks "Bilkul haan", the victims switch off like an old TV.
  nav: { move: 'Ctrl + Alt + Delete', async play(s, prey) {
    const bulb = spawn(s, '<span class="fin-emoji">💡</span>', 'left:22%;top:-8%');
    env.sfx('ding');
    anim(bulb, [{ transform: 'scale(0)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }], 380);
    await wait(420);
    const names = prey.map(p => esc(p.name)).join(' aur ');
    const dlg = spawn(s, `<div class="fin-dialog"><header>⚠️ nav.exe</header><p>${names} ko permanently delete karein?</p><footer><i>Haan</i><i class="go">Bilkul haan</i></footer><div class="fin-progress"><u></u></div></div>`, 'left:6%;right:6%;top:2%');
    anim(dlg, [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 280, { easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
    env.sfx('keys');
    const go = dlg.querySelector('.go');
    const cur = spawn(s, '<span class="fin-emoji sm">👆</span>', 'right:8%;top:30%');
    await anim(cur, [{ transform: 'translate(-160px, 140px)' }, { transform: 'none' }], 560);
    env.sfx('click');
    anim(go, [{ transform: 'scale(1)' }, { transform: 'scale(0.85)' }, { transform: 'scale(1)' }], 160);
    s.preyPieces.forEach(p => p.classList.add('glitch'));
    env.sfx('glitch');
    await anim(dlg.querySelector('u'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 800, { easing: 'linear' });
    env.sfx('zap'); flash(s, '#9ff');
    await Promise.all(s.prey.map(p => anim(p, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.3, 0.04)', opacity: 1, offset: 0.55 }, { transform: 'scale(0, 0.02)', opacity: 0 }], 420, { easing: 'ease-in' })));
    anim(dlg, [{ opacity: 1 }, { opacity: 0 }], 200);
    await wait(200);
    await finale(s, 'DELETED!', 'Recycle bin bhi khaali kar diya', '🗑️');
  } },

  // Chechu: tawa tadka. A giant tawa flattens the victims, they sizzle, get plated and garnished.
  chechu: { move: 'Tawa Tadka', async play(s) {
    anim(s.hero, [{ transform: 'none' }, { transform: 'translateX(18%) rotate(-6deg)' }], 300);
    const tawa = spawn(s, '<span class="fin-emoji xl">🍳</span>', 'right:4%;top:-6%');
    await anim(tawa, [{ transform: 'translateY(-90vh) rotate(-200deg)' }, { transform: 'none' }], 360, { easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)' });
    env.sfx('clang'); env.buzz(140); flash(s); shake(s, 16, 380);
    word(s, 'TANNNG!', 'left:30%;top:6%');
    s.preyPieces.forEach(p => p.classList.remove('scared'));
    s.prey.forEach(p => anim(p, [{ transform: 'none' }, { transform: 'scale(1.6, 0.16)', offset: 0.35 }, { transform: 'scale(1.45, 0.2)' }], 420, { easing: 'cubic-bezier(0.2, 1.5, 0.4, 1)' }));
    anim(tawa, [{ transform: 'none', opacity: 1 }, { transform: 'translate(30%, -60%) rotate(40deg)', opacity: 0 }], 600, { delay: 150 / env.speed });
    await wait(380);
    env.sfx('sizzle');
    for (let i = 0; i < 6; i++) {
      const steam = spawn(s, '<span class="fin-emoji sm">💨</span>', `right:${8 + i * 7}%;bottom:12%`);
      anim(steam, [{ transform: 'translateY(0) scale(0.5)', opacity: 0.9 }, { transform: `translateY(-${rand(70, 130)}px) scale(1.4)`, opacity: 0 }], 900, { delay: (i * 90) / env.speed, easing: 'ease-out' });
    }
    await wait(500);
    s.preyBox.classList.add('plated');
    env.sfx('pop');
    for (let i = 0; i < 22; i++) {
      const bit = i % 5 === 0 ? '<span class="fin-emoji tiny">🌶️</span>' : '<i class="fin-sev"></i>';
      const b = spawn(s, bit, `right:${rand(8, 44)}%;bottom:${rand(8, 16)}%`);
      anim(b, [{ transform: `translateY(-${rand(160, 260)}px) rotate(${rand(-90, 90)}deg)` }, { transform: `rotate(${rand(-60, 60)}deg)` }], rand(350, 600), { delay: (i * 25) / env.speed, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' });
    }
    await wait(800);
    await finale(s, 'POHA BANA DIYA!', 'Upar se sev aur jeeravan, Indori style', '🍛');
  } },

  // Vanshika: court ka faisla. ORDER! ORDER! ORDER! Jail bars slam down. Case closed.
  vanshika: { move: 'Court Ka Faisla', async play(s) {
    const gavel = spawn(s, '<span class="fin-emoji lg gavel">🔨</span>', 'left:30%;top:4%');
    for (let i = 0; i < 3; i++) {
      await anim(gavel, [{ transform: 'rotate(-60deg)' }, { transform: 'rotate(25deg)' }], 140, { easing: 'ease-in' });
      env.sfx('gavel'); env.buzz(40); shake(s, 6, 140);
      word(s, 'ORDER!', ['left:4%;top:-2%', 'left:44%;top:-6%', 'left:20%;top:20%'][i]);
      await anim(gavel, [{ transform: 'rotate(25deg)' }, { transform: 'rotate(-60deg)' }], 200, { easing: 'ease-out' });
    }
    const bars = spawn(s, '<div class="fin-jail"></div>', 'right:-4%;width:58%;top:6%;bottom:-2%');
    await anim(bars, [{ transform: 'translateY(-110vh)' }, { transform: 'none' }], 320, { easing: 'cubic-bezier(0.7, 0, 1, 0.5)' });
    env.sfx('bars'); env.buzz(120); shake(s, 14, 320); flash(s, '#ccc');
    s.preyPieces.forEach(p => { p.classList.remove('scared'); p.classList.add('jailed'); });
    await wait(650);
    await finale(s, 'CASE CLOSED', 'Sazaa: seedha ghar. Koi bail nahi.', '⚖️', 'rubber');
  } },

  // Liu: modern art. Three giant brush strokes, splats, a gold frame and a museum label.
  liu: { move: 'Modern Art', async play(s) {
    const paints = ['#ff5d8f', '#ffd23f', '#3ec1d3', '#9b6cf3', '#33CA7F'];
    for (let i = 0; i < 3; i++) {
      anim(s.hero, [{ transform: 'none' }, { transform: `translateX(16%) rotate(${i % 2 ? -8 : 8}deg)` }, { transform: 'none' }], 260);
      const stroke = spawn(s, `<i class="fin-stroke" style="--paint:${paints[i]}"></i>`, `right:2%;width:56%;top:${14 + i * 24}%;height:20%`);
      env.sfx('brush');
      await anim(stroke, [{ transform: `scaleX(0) rotate(${i % 2 ? 6 : -6}deg)` }, { transform: `scaleX(1) rotate(${i % 2 ? 6 : -6}deg)` }], 200, { easing: 'cubic-bezier(0.3, 0.9, 0.3, 1)' });
      await wait(90);
    }
    for (let i = 0; i < 6; i++) {
      const sp = spawn(s, `<i class="fin-splat" style="--paint:${paints[i % paints.length]}"></i>`, `right:${rand(2, 40)}%;top:${rand(4, 70)}%`);
      anim(sp, [{ transform: 'scale(0)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 260, { delay: (i * 70) / env.speed });
      if (i % 2 === 0) setTimeout(() => env.sfx('splat'), (i * 70) / env.speed);
    }
    await wait(500);
    const frame = spawn(s, '<div class="fin-frame"><span class="fin-label">Untitled (Landu), 2026 · <b>₹10 crore</b></span></div>', 'right:-4%;width:58%;top:2%;bottom:0');
    await anim(frame, [{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 300, { easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)' });
    env.sfx('stamp'); shake(s, 10, 240);
    await wait(150); env.sfx('tada');
    await wait(450);
    await finale(s, 'MASTERPIECE!', 'Museum mein tang diya. Entry ₹500.', '🖼️');
  } },
};

// Play `hero`'s finishing move on `prey` (players) in the #killshow overlay.
export async function playFinisher(root, hero, prey) {
  const k = KILLS[hero && hero.char];
  if (!k || !root) return;
  try {
    const s = build(root, hero, prey, k.move);
    await intro(s);
    await k.play(s, prey);
  } catch (e) {
    // never let a show break the game
  } finally {
    root.getAnimations({ subtree: true }).forEach(a => a.cancel());
    root.hidden = true;
    root.innerHTML = '';
    root.className = 'killshow';
  }
}

// ---------------------------------------------------------------- Kabooms

function sig(html, cls = '') {
  const el = document.createElement('div');
  el.className = `kb-sig ${cls}`;
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
const gone = (el, ms = 250) => anim(el, [{ opacity: 1 }, { opacity: 0 }], ms).then(() => el.remove());

// SVG pressure cooker, the star of Chechu's Kaboom.
const COOKER = '<svg viewBox="0 0 160 150" class="kb-cooker-svg" aria-hidden="true">' +
  '<defs><linearGradient id="kbsteel" x1="0" x2="1"><stop offset="0" stop-color="#7d838c"/><stop offset=".35" stop-color="#eef1f4"/><stop offset=".6" stop-color="#b9c0c8"/><stop offset="1" stop-color="#6c737c"/></linearGradient></defs>' +
  '<rect x="18" y="58" width="104" height="82" rx="14" fill="url(#kbsteel)" stroke="#4a4f56" stroke-width="3"/>' +
  '<ellipse cx="70" cy="58" rx="56" ry="13" fill="url(#kbsteel)" stroke="#4a4f56" stroke-width="3"/>' +
  '<rect x="118" y="44" width="40" height="13" rx="6" fill="#1d1d1f"/><rect x="-2" y="52" width="24" height="10" rx="5" fill="#1d1d1f"/>' +
  '<g class="kb-weight"><rect x="61" y="26" width="18" height="22" rx="4" fill="#1d1d1f"/><rect x="66" y="16" width="8" height="12" rx="3" fill="#3a3d42"/></g></svg>';

export const KABOOMS = {
  // Ajay: lights it and walks away in slow motion. A boss never looks back at the explosion.
  ajay: {
    async after(p) {
      const el = sig(`<div class="kb-boss">${actor(p)}</div><b class="kb-caption">Boss kabhi peeche mudke nahi dekhta 😎</b>`, 'bottom');
      el.querySelector('.piece').classList.add('walking', 'turn');
      el.querySelector('.piece').style.setProperty('--step', '320ms');
      anim(el.querySelector('.kb-boss'), [{ transform: 'translateY(-30%) scale(0.55)' }, { transform: 'translateY(0) scale(1.15)' }], 2200, { easing: 'linear' });
      anim(el.querySelector('.kb-caption'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 400, { delay: 500 / env.speed });
      env.sfx('hero');
      await wait(2300);
      await gone(el, 300);
    },
  },
  // Nav: slams the big red PLAN B button. Alarms.
  nav: {
    async before() {
      const el = sig('<div class="kb-panel"><b>PLAN B</b><div class="kb-btn"></div></div><span class="kb-hand">👇</span><b class="kb-caption">Plan B activated 🧠</b>');
      const hand = el.querySelector('.kb-hand'), btn = el.querySelector('.kb-btn');
      anim(el.querySelector('.kb-panel'), [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 300, { easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
      await anim(hand, [{ transform: 'translateY(-160px)', opacity: 0 }, { transform: 'translateY(-40px)', opacity: 1 }], 350);
      await anim(hand, [{ transform: 'translateY(-40px)' }, { transform: 'translateY(0)' }], 120, { easing: 'ease-in' });
      env.sfx('click'); env.buzz(60);
      anim(btn, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.6) translateY(20%)' }, { transform: 'scaleY(1)' }], 300);
      el.classList.add('alarm');
      env.sfx('alarm');
      await wait(900);
      await gone(el);
    },
  },
  // Chechu: the bomb is a pressure cooker. It goes off on the third whistle.
  chechu: {
    async countdown() {
      const el = sig(`<div class="kb-cooker">${COOKER}<span class="kb-steam">💨</span></div><b class="kb-count"></b>`);
      const cooker = el.querySelector('.kb-cooker'), weight = el.querySelector('.kb-weight'), steam = el.querySelector('.kb-steam'), count = el.querySelector('.kb-count');
      anim(cooker, [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 280, { easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
      await wait(350);
      for (let i = 1; i <= 3; i++) {
        count.textContent = i < 3 ? `${i} seeti` : '3 SEETI!!';
        anim(count, [{ transform: 'scale(2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 220, { easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
        anim(weight, [{ transform: 'none' }, { transform: 'translateY(-10px) rotate(-12deg)' }, { transform: 'translateY(-6px) rotate(12deg)' }, { transform: 'none' }], 500, { easing: 'linear' });
        anim(steam, [{ transform: 'translateY(0) scale(0.4)', opacity: 1 }, { transform: 'translateY(-90px) scale(2)', opacity: 0 }], 650, { easing: 'ease-out' });
        anim(cooker, [{ transform: 'none' }, { transform: `scale(${1 + i * 0.06}) rotate(${i % 2 ? -3 : 3}deg)` }, { transform: `scale(${1 + i * 0.04})` }], 300);
        env.sfx('cooker'); env.buzz(40 * i);
        await wait(i < 3 ? 650 : 450);
      }
      el.remove();
    },
  },
  // Vanshika: files a Kaboom permit and stamps it APPROVED.
  vanshika: {
    async before() {
      const el = sig('<div class="kb-doc"><b>KABOOM PERMIT</b><small>Ludo Penal Code, Section 420</small><p>Applicant ko sab ke saath ghar jaane ki anumati di jaati hai.</p><i>✍️ Wakeel Saab</i><span class="kb-approved">APPROVED</span></div>');
      const doc = el.querySelector('.kb-doc'), stamp = el.querySelector('.kb-approved');
      await anim(doc, [{ transform: 'translateX(-120vw) rotate(-12deg)' }, { transform: 'rotate(-3deg)' }], 380);
      await wait(250);
      await anim(stamp, [{ transform: 'scale(3) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1) rotate(-12deg)', opacity: 1 }], 200, { easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)' });
      env.sfx('stamp'); env.sfx('gavel'); env.buzz(80);
      anim(doc, [{ transform: 'rotate(-3deg)' }, { transform: 'rotate(-3deg) scale(0.96)' }, { transform: 'rotate(-3deg)' }], 160);
      await wait(700);
      await gone(el);
    },
  },
  // Liu: the blast is a Holi explosion of colour.
  liu: {
    blast() {
      const colours = ['#ff2d87', '#ffd23f', '#22c55e', '#3b82f6', '#a855f7', '#ff7a1a'];
      for (let i = 0; i < 14; i++) {
        const g = sig('', 'gulal');
        g.style.setProperty('--g', colours[i % colours.length]);
        const a = rand(0, Math.PI * 2), d = rand(60, 220);
        anim(g, [{ transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.6}px), calc(-50% + ${Math.sin(a) * d * 0.6}px)) scale(${rand(4, 6)})`, opacity: 0.95, offset: 0.45 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(${rand(6, 10)})`, opacity: 0 }], rand(1800, 2500), { easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', delay: (i * 45) / env.speed })
          .then(() => g.remove());
      }
      env.sfx('whoosh');
    },
    debris: ['💜', '💛', '💚', '💙', '🩷', '🎨', '🌈', '🧡'],
    title: 'HOLI HAI!',
  },
};
