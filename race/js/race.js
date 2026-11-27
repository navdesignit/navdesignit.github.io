// One race, from the countdown to the podium. Runs the fixed-step physics for the
// karts this phone owns, plays back everyone else's from the network, and turns what
// happens into sounds, commentary, trash talk and big shouty text.

import { buildTrack, locate } from './track.js';
import { World, makeKart, botInput, rubberBand, standings, DT, F, flagsOf, BASE_V, lapOf } from './sim.js';
import { RIDES, CHARACTERS, rideLine, hitLines, pickLine } from './riders.js';
import { packKart, unpackKart, RemoteKart } from './net.js';
import { say, ITEM_INFO } from './lines.js';
import { ordinal } from './hud.js';
import * as A from './audio.js';

// Position updates per kart: ~12 a second for people, ~8 for bots. A 3-lap race with
// two phones and three bots uses a few MB of the free plan's 10 GB a month.
const SEND_MS = 80;
const BOT_SEND_MS = 125;
const r2 = n => Math.round(n * 100) / 100;

export class Race {
  // app: { R, hud, input, room, me, auto, present: Set of uids online }
  constructor(app, info, { runner }) {
    this.app = app;
    this.info = info;
    this.me = app.me;
    this.runner = runner;
    this.T = buildTrack(info.track);
    app.R.setTrack(this.T);
    this.W = new World(this.T, { laps: info.laps });
    this.W.time = Math.min(-0.5, this.clock());
    this.remotes = new Map();
    this.views = new Map();
    this.prev = new Map();
    this.inputs = {};
    this.names = {};
    info.karts.forEach((k, slot) => {
      const owned = k.id === this.me || (k.bot && runner);
      const kart = makeKart(k.id, k.char, RIDES[k.char].stats, this.T, slot, { bot: k.bot, remote: !owned, skill: 0.92 + ((slot * 37) % 8) / 100 });
      kart.name = k.name;
      kart.finishT = 1e9;
      this.W.add(kart);
      this.names[k.id] = k.name;
      if (!owned) this.remotes.set(k.id, new RemoteKart());
      this.views.set(k.id, app.R.addKart(k.id, k.char, { name: k.bot ? `🤖 ${k.name}` : k.name, local: k.id === this.me }));
    });
    this.mine = this.W.byId[this.me] || null;
    this.char = this.mine ? this.mine.char : null;
    this.engine = this.mine ? new A.Engine(RIDES[this.char].veh) : null;
    this.lastSend = -1;
    this.stepN = 0;
    this.beeps = 4;
    this.fin = {};
    this.endSent = false;
    this.lastPos = 0;
    this.posCheck = 0;
    this.leader = null;
    this.talkAt = -10;
    this.honkAt = -10;
    this.done = false;
    this.camMode = 'intro';
    this.pose = {};
    this.loc = {};
    this.wrongSaid = -10;
    this.lastLapShown = 1;
    app.hud.reset(info.laps);
    app.hud.tick(say('start'));
    if (this.mine) app.hud.later(() => app.hud.bubble(this.char, rideLine(this.char, 'start')), 1200);
    this.stats = { frames: 0, slow: 0 };
  }

  clock() { return (this.app.room.now - this.info.startAt) / 1000; }
  nameOf(id) { return this.names[id] || (CHARACTERS[id] || {}).name || '?'; }
  charOf(id) { const k = this.W.byId[id]; return k ? k.char : null; }

  // Volume for something happening at (x, z), by distance from our kart.
  vol(x, z) {
    const m = this.mine || this.W.karts[0];
    if (!m) return 1;
    const d = Math.hypot(x - m.x, z - m.z);
    return Math.max(0, Math.min(1, 1.15 - d / 70));
  }

  // ---------------------------------------------------------------- per frame

  frame(dtMs) {
    const dt = Math.min(0.1, dtMs / 1000);
    const W = this.W;
    const rt = this.clock();
    if (rt - W.time > 0.5) W.time = rt - DT; // the tab slept: jump rather than fast-forward
    let n = 0;
    while (W.time + DT <= rt + 1e-6 && n < 8) { this.step(); n++; }
    const alpha = Math.max(0, Math.min(1, (rt - W.time) / DT));

    // others' karts from the network (a test can hold them back to fake a slow network)
    const now = this.app.now();
    if (this.lagQ) while (this.lagQ.length && this.lagQ[0].at <= now) { const q = this.lagQ.shift(); this.onKart(q.id, q.str, true); }
    for (const [id, rk] of this.remotes) {
      const p = rk.sample(now, dt, this.pose);
      if (p) this.applyRemote(W.byId[id], p);
    }

    this.app.hud.frame(this.app.now());
    this.countdown(rt);
    this.draw(dt, alpha, rt);
    this.hudUpdate(rt);
    this.send(rt);
    if (this.runner) this.maybeEnd(rt);
  }

  step() {
    const W = this.W, inp = this.app.input;
    for (const k of W.karts) {
      if (k.remote) continue;
      let pr = this.prev.get(k.id);
      if (!pr) { pr = {}; this.prev.set(k.id, pr); }
      pr.x = k.x; pr.y = k.y; pr.z = k.z; pr.h = k.h; pr.yaw = k.visYaw; pr.steer = k.steer;
      if (k === this.mine) {
        const s = inp.read();
        const use = inp.consumeUse() && W.time >= 0;
        if (this.app.auto || k.done || k.rocketT > 0) {
          const b = botInput(k, W, this.inputs[k.id] || {});
          if (!this.app.auto) { b.use = use; b.drift = false; }
          this.inputs[k.id] = b;
        } else this.inputs[k.id] = { steer: s.steer, drift: s.drift, use };
      } else this.inputs[k.id] = botInput(k, W, this.inputs[k.id] || {});
    }
    if (this.stepN++ % 60 === 0) rubberBand(W);
    W.step(DT, this.inputs);
    this.drain();
  }

  applyRemote(k, p) {
    k.x = p.x; k.z = p.z; k.y = p.y; k.h = p.h; k.v = p.v; k.P = p.P;
    k.f = p.f; k.steer = p.steer; k.visYaw = p.yaw;
    k.drift = p.f & F.DL ? -1 : p.f & F.DR ? 1 : 0;
    k.rocketT = p.f & F.ROCKET ? 1 : 0;
    k.shieldT = p.f & F.SHIELD ? 1 : 0;
    k.spinT = p.f & F.SPIN ? 1 : 0;
    k.air = !!(p.f & F.AIR);
    if (p.f & F.DONE) k.done = true;
    k.idx = locate(this.T, k.x, k.z, k.idx, this.loc).idx;
    k.gy = this.loc.y;
  }

  // ---------------------------------------------------------------- events

  drain() {
    const W = this.W;
    for (const ev of W.outQ) {
      if (ev.k === 'fin') {
        this.app.room.act({ type: 'fin', uid: this.me, id: ev.u, t: ev.t, st: ev.st, race: this.info.id });
        continue;
      }
      const msg = { ...ev, r: this.info.id, c: this.me };
      for (const key of ['x', 'y', 'z', 't']) if (typeof msg[key] === 'number') msg[key] = r2(msg[key]);
      if (typeof msg.h === 'number') msg.h = Math.round(msg.h * 1000) / 1000;
      this.app.room.sendEvent(JSON.parse(JSON.stringify(msg)));
      this.present(ev, true);
    }
    W.outQ.length = 0;
    for (const f of W.fxQ) this.local(f);
    W.fxQ.length = 0;
  }

  onEvent(ev) {
    if (!ev || ev.r !== this.info.id || ev.c === this.me) return;
    if (ev.k === 'use' && this.W.time - ev.t > 6) return;
    this.W.remote(ev);
    this.present(ev, false);
  }

  onKart(id, str, delayed = false) {
    const rk = this.remotes.get(id);
    if (!rk) return;
    if (this.app.lag && !delayed) {
      // test only: deliver later, with jitter (so packets can even arrive out of order)
      const at = this.app.now() + this.app.lag.ms + Math.random() * this.app.lag.jitter;
      (this.lagQ || (this.lagQ = [])).push({ id, str, at });
      this.lagQ.sort((a, b) => a.at - b.at);
      return;
    }
    const s = unpackKart(str);
    if (!s || s.r !== this.info.id) return;
    rk.push(s, this.app.now());
    this.rx = (this.rx || 0) + 1;
  }

  // Finishing times from the room.
  onState(st) {
    const r = st.race;
    if (!r || r.id !== this.info.id) return;
    for (const [id, t] of Object.entries(r.fin || {})) {
      if (this.fin[id] != null) continue;
      this.fin[id] = t;
      const k = this.W.byId[id];
      if (k) { k.finishT = t; k.done = true; }
      if (id !== this.me && !(k && !k.remote)) {
        const place = Object.keys(this.fin).length;
        this.app.hud.tick(`🏁 ${this.nameOf(id)} finished ${ordinal(place)}!`);
      }
    }
  }

  present(ev, mine) {
    const W = this.W, hud = this.app.hud, R = this.app.R, me = this.me;
    const k = W.byId[ev.u];
    switch (ev.k) {
      case 'use': {
        const v = ev.u === me ? 1 : this.vol(ev.x, ev.z);
        const a = this.nameOf(ev.u);
        switch (ev.it) {
          case 'chappal':
            if (v > 0.1) A.sfx('throw');
            if (ev.tg === me && ev.u !== me) { hud.big('🩴<small>Mummy ki chappal aa rahi hai!</small>', 'warn', 1300); A.sfx('wrong'); }
            break;
          case 'cooker':
            if (ev.u === me || (k && !k.remote && k.bot && v > 0.5)) { const l = pickLine(k.char, 'kaboom', null); if (ev.u === me) hud.bubble(k.char, l); }
            if (v > 0.1) A.sfx('pop');
            break;
          case 'paan': if (v > 0.1) A.sfx('ptoo', v); break;
          case 'nimbu': if (ev.u === me) { A.sfx('shield'); hud.big('🍋🌶️<small>Nazar battu ON</small>', 'good', 1000); } break;
          case 'chai':
            if (ev.u === me) { A.sfx('slurp'); hud.big('☕<small>Cutting chai!</small>', 'good', 900); }
            else if (v > 0.4) A.sfx('slurp');
            break;
          case 'horn':
            if (v > 0.05) A.sfx('ponpon', Math.max(0.3, v));
            R.ring(ev.x, ev.y, ev.z, '#ffd23f', 12);
            R.textPop(ev.x, ev.y + 3.2, ev.z, 'PON PON!', '#ffd23f', 2.4);
            if (v > 0.6) R.shake(0.35);
            break;
          case 'rocket':
            if (v > 0.1) A.sfx('rocket');
            if (ev.u === me) { hud.big('🚀<small>Diwali rocket!</small>', 'good', 1100); A.fx('whoa'); A.meme(A.memeIndex('System phaad'), false); }
            else hud.tick(say('rocket', { a }));
            break;
          case 'cow': if (v > 0.1) A.sfx('moo', v); hud.tick(say('gaay', { a, b: 'sab' })); break;
          default: break;
        }
        break;
      }
      case 'hit': {
        const a = this.nameOf(ev.by), b = this.nameOf(ev.u);
        const kind = ev.w === 'horn' ? 'horn' : ev.w;
        const v = k ? this.vol(k.x, k.z) : 0.5;
        if (ev.w === 'chappal') { A.sfx('thwack', Math.max(0.3, v)); if (k) R.textPop(k.x, k.y + 3, k.z, 'THWACK!', '#9fd3ff', 2); }
        if (ev.w === 'paan') { A.sfx('splat', Math.max(0.3, v)); if (k) R.splash(k.x, k.y, k.z, ['#b3122e', '#7a0f22', '#2fbf55'], 24); }
        if (ev.w === 'bump' && k) R.textPop(k.x, k.y + 3, k.z, 'DHADAAM!', '#ff7b00', 1.8);
        if (ev.by === ev.u) hud.tick(say('self', { b }), 1);
        else if (ev.w !== 'horn' || ev.u === me || ev.by === me) hud.tick(say(kind === 'bump' ? 'bump' : kind, { a, b }), 1);
        const victim = this.charOf(ev.u), attacker = this.charOf(ev.by);
        if (ev.by === me && ev.u !== me) {
          this.mine.stats2.hits++;
          const word = { chappal: 'THWACK!', cooker: 'BOOM!', paan: 'PHISLA!', bump: 'DHADAAM!', horn: 'PON PON!' }[ev.w] || 'HIT!';
          hud.big(`${word}<small>${b} 😵</small>`, 'hit', 1000);
          A.fx(ev.w === 'cooker' ? 'fatality' : 'boom');
          A.buzz(30);
          if (ev.w !== 'horn') hud.bubble(this.char, hitLines(this.char, victim).kill);
        } else if (ev.u === me) {
          hud.big(`${{ chappal: '🩴', cooker: '💥', paan: '🤢', bump: '🚀', horn: '📯' }[ev.w] || '😵'}<small>${ev.w === 'horn' ? 'Pon pon!' : 'Ouch!'}</small>`, 'ouch', 1000);
          A.fx(Math.random() < 0.5 ? 'ohman' : 'react');
          A.buzz([60, 40, 60]);
          R.shake(ev.w === 'cooker' ? 0.9 : 0.5);
          if (ev.w !== 'horn') hud.later(() => hud.bubble(this.char, hitLines(attacker, this.char).die), 500);
        } else if (attacker && victim && Math.random() < 0.4 && ev.w !== 'horn') {
          hud.later(() => hud.bubble(attacker, hitLines(attacker, victim).kill), 300);
        }
        if (ev.w === 'cooker' && ev.u !== me && v > 0.3) A.meme(A.memeIndex('PUBG'), false);
        break;
      }
      case 'block': {
        const b = this.nameOf(ev.u);
        hud.tick(say('block', { b }), 1);
        if (k) R.textPop(k.x, k.y + 3, k.z, 'BACH GAYA!', '#ffe14d', 1.8);
        if (ev.u === me) { A.sfx('block'); hud.big('🍋<small>Nazar utar gayi!</small>', 'good', 1000); }
        break;
      }
      case 'honk': {
        if (!k) break;
        const v = this.vol(k.x, k.z);
        if (v > 0.05) A.sfx('horn', RIDES[k.char].veh, v);
        const view = this.views.get(ev.u);
        if (view) R.textPop(k.x, k.y + 3.4, k.z, 'pon pon', CHARACTERS[k.char].accent, 1.3);
        break;
      }
      default: break;
    }
  }

  // Things that happened on this phone (to our own karts, or visible to us).
  local(f) {
    const k = f.k, mine = k && k === this.mine;
    const hud = this.app.hud, R = this.app.R;
    switch (f.type) {
      case 'box': if (mine) A.sfx('roll'); break;
      case 'gotitem': if (mine) { A.sfx('got'); hud.tick(`${(ITEM_INFO[f.a] || {}).icon} ${(ITEM_INFO[f.a] || {}).name}!`); } break;
      case 'boxpop': {
        const b = this.T.boxes[f.a];
        if (b) {
          R.splash(b.x, b.y + 0.5, b.z, ['#ff5fa2', '#ffd23f', '#ff8a3d', '#ffffff'], 18);
          const v = mine ? 1 : this.vol(b.x, b.z);
          if (v > 0.2) A.sfx('box');
        }
        break;
      }
      case 'hop': if (mine) A.sfx('hop'); break;
      case 'spark': if (mine) A.sfx('spark', f.a); break;
      case 'turbo': if (mine) { A.sfx('turbo', f.a); if (f.a >= 2) hud.big(f.a === 3 ? 'MASALA BOOST!' : 'BOOST!', 'boost', 700); if (f.a === 3 && Math.random() < 0.5) hud.bubble(this.char, rideLine(this.char, 'boost')); } break;
      case 'rocketstart': if (mine) { A.sfx('turbo', 3); hud.big('ROCKET START! 🚀', 'boost', 1200); hud.tick(say('rocketstart')); } break;
      case 'wall': if (mine) { A.sfx('wall', f.a); R.shake(0.25 * f.a); if (Math.random() < 0.25) hud.tick(say('wall')); } break;
      case 'land': if (mine) { A.sfx('land', Math.min(1, f.a / 10)); R.shake(0.2); } break;
      case 'breaker': if (mine) { A.sfx('breaker'); R.shake(0.3); A.buzz(25); if (Math.random() < 0.35) hud.tick(say('breaker')); } break;
      case 'pothole': if (mine) { A.sfx('pothole'); R.shake(0.45); A.buzz(40); hud.big('🕳️<small>Gaddha!</small>', 'ouch', 700); if (Math.random() < 0.4) hud.tick(say('pothole')); } break;
      case 'strip': if (mine) A.sfx('strip'); break;
      case 'cow': case 'gaayhit':
        if (mine) { A.sfx('moo'); A.fx('huh'); R.shake(0.5); A.buzz(50); hud.big('🐄<small>Gaay mata!</small>', 'ouch', 900); hud.tick(say('cow', { b: this.nameOf(k.id) }), 1); }
        else if (k && this.vol(k.x, k.z) > 0.4) A.sfx('moo', 0.5);
        break;
      case 'moo': if (mine) A.sfx('moo'); break;
      case 'bump': if (mine) A.sfx('bump'); break;
      case 'lap':
        if (mine) {
          if (f.a === this.info.laps) { A.sfx('final'); hud.big(`AAKHRI LAP! 🏁<small>Final lap</small>`, 'lap', 1600); hud.tick(say('lastlap'), 1); }
          else { A.sfx('lap'); hud.big(`LAP ${f.a}/${this.info.laps}`, 'lap', 1200); }
        }
        break;
      case 'finish': if (mine) this.finished(); break;
      case 'boom': {
        const o = f.a;
        const v = this.vol(o.x, o.z);
        R.explosion(o.x, o.y, o.z, true);
        A.sfx('boom', Math.max(0.25, v));
        if (v > 0.5) { A.fx('boom'); R.shake(0.9 * v); }
        break;
      }
      case 'seeti': { const o = f.a; R.steam(o.x, o.y, o.z); const v = this.vol(o.x, o.z); if (v > 0.1) A.sfx('seeti', v); break; }
      case 'poof': R.puff(f.a.x, f.a.y, f.a.z, '#fff8ec'); break;
      case 'gone': if (f.a.type === 'chappal') R.puff(f.a.x, f.a.y - 1, f.a.z, '#9fd3ff', 6); break;
      case 'thwack': R.puff(f.a.x, f.a.y - 1, f.a.z, '#9fd3ff', 10); break;
      case 'hit': if (mine) A.buzz(40); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- controls

  honk() {
    if (!this.mine || this.W.time - this.honkAt < 0.6) return;
    this.honkAt = this.W.time;
    A.sfx('horn', RIDES[this.char].veh, 1);
    this.app.room.sendEvent({ k: 'honk', u: this.me, r: this.info.id, c: this.me });
    const k = this.mine;
    this.app.R.textPop(k.x, k.y + 3.4, k.z, 'pon pon', CHARACTERS[k.char].accent, 1.3);
  }

  // ---------------------------------------------------------------- timeline

  countdown(rt) {
    const hud = this.app.hud;
    if (rt < 0) {
      const n = Math.ceil(-rt);
      if (n <= 3 && n < this.beeps) {
        this.beeps = n;
        hud.big(`<span class="num">${n}</span>`, 'count', 900);
        A.sfx('count', 3 - n);
        if (n === 3) { this.app.input.enabled = true; this.app.R.prewarm(); }
      }
    } else if (this.beeps > 0) {
      this.beeps = 0;
      hud.big('PON PON! 📯<small>GO GO GO</small>', 'go', 1000);
      A.sfx('go');
      this.camMode = 'chase';
    }
  }

  finished() {
    const hud = this.app.hud, k = this.mine;
    this.done = true;
    const order = this.order();
    const place = order.indexOf(k) + 1;
    A.sfx('finish');
    A.fx(place === 1 ? 'whoa' : place === order.length ? 'later' : 'boom');
    if (place === 1) A.meme(A.memeIndex('Wah Modi'), true);
    else if (place === order.length) A.meme(A.memeIndex('Mazaa nahi'), true);
    hud.big(`${ordinal(place)}!<small>${place === 1 ? 'Indore ka King 👑' : place === order.length ? 'Agli baar bhai 😅' : 'Finished!'}</small>`, place === 1 ? 'win' : 'lap', 2600);
    hud.bubble(this.char, rideLine(this.char, place === 1 ? 'win' : place === order.length ? 'last' : 'pass'));
    hud.tick(say(place === 1 ? 'finishFirst' : place === order.length ? 'finishLast' : 'lead', { a: this.nameOf(this.me) }), 1);
    this.app.root.classList.add('finished');
    this.camMode = 'orbit';
  }

  order() {
    for (const k of this.W.karts) if (this.fin[k.id] != null) { k.done = true; k.finishT = this.fin[k.id]; }
    return standings(this.W.karts);
  }

  // The bot runner closes the race once every human is home (or a straggler takes
  // more than 40 seconds after the first finisher).
  maybeEnd(rt) {
    if (this.endSent || rt < 2 || this.stepN % 15) return;
    const present = this.app.present;
    const humans = this.info.karts.filter(k => !k.bot && (!present || present.has(k.id) || k.id === this.me));
    const fins = humans.map(h => this.fin[h.id] ?? (h.id === this.me && this.mine && this.mine.done ? this.mine.finishT : null));
    const doneTimes = fins.filter(t => t != null);
    const all = doneTimes.length === humans.length;
    const first = doneTimes.length ? Math.min(...doneTimes) : null;
    const last = doneTimes.length ? Math.max(...doneTimes) : null;
    if ((all && rt > last + 3.5) || (first != null && rt > first + 40)) {
      this.endSent = true;
      const est = {};
      for (const k of this.W.karts) est[k.id] = Math.round(k.P);
      this.app.room.act({ type: 'end', race: this.info.id, est });
    }
  }

  // Take over the bots if their runner's phone left (or give them back).
  setRunner(on) {
    if (on === this.runner) return;
    this.runner = on;
    for (const k of this.W.karts) {
      if (!k.bot) continue;
      if (on) {
        k.remote = false;
        k.lastS = locate(this.T, k.x, k.z, k.idx, this.loc).s;
        k.s = k.lastS;
        k.kx = k.kz = 0; k.vy = 0; k.gvy = 0;
        this.remotes.delete(k.id);
      } else {
        k.remote = true;
        this.remotes.set(k.id, new RemoteKart());
      }
    }
  }

  // ---------------------------------------------------------------- drawing

  draw(dt, alpha, rt) {
    const R = this.app.R, W = this.W;
    const cam = R.camera.position;
    for (const k of W.karts) {
      const view = this.views.get(k.id);
      if (!view) continue;
      let pose;
      if (!k.remote) {
        const pr = this.prev.get(k.id) || k;
        const h = pr.h + Math.atan2(Math.sin(k.h - pr.h), Math.cos(k.h - pr.h)) * alpha;
        pose = this.pose2 || (this.pose2 = {});
        pose.x = pr.x + (k.x - pr.x) * alpha; pose.y = pr.y + (k.y - pr.y) * alpha; pose.z = pr.z + (k.z - pr.z) * alpha;
        pose.h = h; pose.steer = k.steer; pose.yaw = k.visYaw; pose.v = k.v; pose.f = flagsOf(k);
        pose.gy = locate(this.T, pose.x, pose.z, k.idx, this.loc).y;
      } else {
        pose = this.pose3 || (this.pose3 = {});
        pose.x = k.x; pose.y = k.y; pose.z = k.z; pose.h = k.h; pose.steer = k.steer; pose.yaw = k.visYaw; pose.v = k.v; pose.f = k.f || 0; pose.gy = k.gy ?? k.y;
      }
      view.update(dt, pose, R, cam);
      if (k === this.mine) this.camPose = { x: pose.x, y: pose.y, z: pose.z, mh: pose.h - k.drift * 0.2, v: k.v, boost: k.boostT > 0 || k.rocketT > 0 };
    }
    R.syncObjs(W.objs, W.time, dt);
    R.animateWorld(dt, W.time, W.boxT, rt);
    let target = this.camPose;
    if (!this.mine) {
      const lead = this.order()[0];
      target = lead && { x: lead.x, y: lead.y, z: lead.z, mh: lead.h, v: lead.v, boost: false };
    }
    if (target) R.follow(dt, target, this.mine ? this.camMode : 'chase');
    const r0 = performance.now();
    if (!this.app.noRender) R.render(dt);
    this.renderMs = performance.now() - r0;
    // engine note
    if (this.engine && this.mine) {
      const k = this.mine;
      this.engine.set(k.v / BASE_V, k.boostT > 0 || k.rocketT > 0, !!k.drift, k.offroad, true);
    }
  }

  hudUpdate(rt) {
    const k = this.mine, hud = this.app.hud;
    const order = this.order();
    if (k) {
      const pos = order.indexOf(k) + 1;
      hud.update({
        pos, n: order.length, lap: lapOf(k, this.T, this.info.laps), laps: this.info.laps,
        kmh: Math.round(k.v * 3.6), item: k.item, itemN: k.itemN, rolling: k.rollT > 0,
        wrong: k.wrongT > 1, level: k.level, drifting: !!k.drift,
      });
      if (k.wrongT > 1 && rt - this.wrongSaid > 5) { this.wrongSaid = rt; hud.tick(say('wrong'), 1); A.sfx('wrong'); if (Math.random() < 0.5) A.meme(A.memeIndex('Moorkh'), false); }
      // overtakes and trash talk
      if (rt > 3 && rt - this.posCheck > 0.5 && !k.done) {
        this.posCheck = rt;
        if (this.lastPos && pos !== this.lastPos && rt - this.talkAt > 6) {
          if (pos < this.lastPos) {
            const passed = order[pos];
            if (passed) { this.talkAt = rt; hud.bubble(this.char, rideLine(this.char, 'pass', passed.char)); }
            if (pos === 1 && Math.random() < 0.5) A.meme(A.memeIndex('Alag hi level'), false);
          } else {
            const passer = order[pos - 2];
            if (passer) { this.talkAt = rt; hud.bubble(passer.char, rideLine(passer.char, 'pass', this.char)); }
          }
        }
        this.lastPos = pos;
      }
    }
    const lead = order[0];
    if (lead && rt > 5 && lead.id !== this.leader) {
      if (this.leader) hud.tick(say('lead', { a: this.nameOf(lead.id) }));
      this.leader = lead.id;
    }
    hud.board(order, this.me);
    if (this.stepN % 2 === 0) hud.minimap(this.T, this.W.karts, this.me);
  }

  send(rt) {
    const room = this.app.room;
    if (!room.online || rt < -1.5) return;
    const t = this.W.time * 1000;
    if (this.lastSend >= 0 && t - this.lastSend < SEND_MS - 1) return;
    this.lastSend = t;
    this.sendN = (this.sendN || 0) + 1;
    for (const k of this.W.karts) {
      if (k.remote) continue;
      if (k.bot) {
        if (t - (k.sentAt ?? -1e9) < BOT_SEND_MS - 1) continue;
        k.sentAt = t;
      }
      room.sendKart(k.id, packKart(this.info.id, t, k, flagsOf(k)));
    }
  }

  destroy() {
    if (this.engine) this.engine.stop();
    this.app.R.clearKarts();
    this.app.R.clearObjs();
    this.app.input.enabled = false;
    this.app.input.reset();
  }
}
