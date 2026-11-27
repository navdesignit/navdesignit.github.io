// Phone controls: a thumb joystick on the left (it jumps to wherever your thumb lands
// and follows it, like Mario Kart on a phone), hold DRIFT with the right thumb, tap the
// item button to throw. Keyboard works too. Every touch is tracked by its own pointer
// id, so both thumbs work at once.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Input {
  constructor(el, { stick, knob, drift, item, horn, onItem, onHorn, onDrift }) {
    this.el = el;
    this.stick = stick;
    this.knob = knob;
    this.btn = { drift, item, horn };
    this.onItem = onItem;
    this.onHorn = onHorn;
    this.onDrift = onDrift;
    this.state = { steer: 0, drift: false, use: false };
    this.steerId = null;
    this.driftIds = new Set();
    this.keys = new Set();
    this.touchSteer = 0;
    this.off = { x: 0, y: 0 };
    this.enabled = false;
    const opts = { passive: false };
    el.addEventListener('pointerdown', e => this.down(e), opts);
    el.addEventListener('pointermove', e => this.move(e), opts);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, e => this.up(e), opts);
    window.addEventListener('keydown', e => this.key(e, true));
    window.addEventListener('keyup', e => this.key(e, false));
    window.addEventListener('blur', () => this.reset());
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  reset() {
    this.steerId = null;
    this.driftIds.clear();
    this.keys.clear();
    this.touchSteer = 0;
    this.state.drift = false;
    this.state.steer = 0;
    this.release();
    for (const b of Object.values(this.btn)) b && b.classList.remove('down');
  }

  // how far the knob can travel (px): about half the joystick's width
  range() { return this.stick ? Math.max(40, this.stick.offsetWidth * 0.42) : 56; }

  down(e) {
    if (!this.enabled) return;
    const b = e.target.closest && e.target.closest('[data-ctl]');
    if (b && b.dataset.ctl === 'drift') {
      e.preventDefault();
      this.driftIds.add(e.pointerId);
      b.classList.add('down');
      this.state.drift = true;
      if (this.onDrift) this.onDrift();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      return;
    }
    if (b && b.dataset.ctl === 'item') { e.preventDefault(); this.state.use = true; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); if (this.onItem) this.onItem(); return; }
    if (b && b.dataset.ctl === 'horn') { e.preventDefault(); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 140); if (this.onHorn) this.onHorn(); return; }
    if (b) return; // some other button (pause)
    // anywhere else on the left 60% steers: the joystick jumps under the thumb
    if (e.clientX > window.innerWidth * 0.62 || this.steerId != null) return;
    e.preventDefault();
    this.steerId = e.pointerId;
    // the joystick's resting centre (layout position, ignoring any animation in flight)
    const st = this.stick;
    this.rest = { x: st.offsetLeft + st.offsetWidth / 2, y: st.offsetTop + st.offsetHeight / 2 };
    this.cx = e.clientX;
    this.cy = e.clientY;
    this.touchSteer = 0;
    this.stick.classList.add('active');
    this.draw(0, 0);
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  move(e) {
    if (e.pointerId !== this.steerId) return;
    e.preventDefault();
    const R = this.range();
    let dx = e.clientX - this.cx, dy = e.clientY - this.cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { // the stick follows a thumb that slides past the edge
      this.cx += (dx / len) * (len - R);
      this.cy += (dy / len) * (len - R);
      dx = e.clientX - this.cx; dy = e.clientY - this.cy;
    }
    // a small dead zone, then a gentle curve so small pushes give fine control
    const n = dx / R;
    const a = Math.abs(n) < 0.08 ? 0 : (Math.abs(n) - 0.08) / 0.92;
    this.touchSteer = Math.sign(n) * Math.min(1, a * (0.6 + 0.4 * a) * 1.12);
    this.draw(dx, dy);
  }

  up(e) {
    if (this.driftIds.has(e.pointerId)) {
      this.driftIds.delete(e.pointerId);
      if (!this.driftIds.size) { this.state.drift = this.keys.has('drift'); this.btn.drift.classList.remove('down'); }
    }
    if (e.pointerId === this.steerId) {
      this.steerId = null;
      this.touchSteer = 0;
      this.release();
    }
  }

  // Move the joystick base under the thumb and the knob to the push.
  draw(dx, dy) {
    if (!this.stick) return;
    this.off = { x: this.cx - this.rest.x, y: this.cy - this.rest.y };
    this.stick.style.transform = `translate3d(${this.off.x}px, ${this.off.y}px, 0)`;
    this.knob.style.transform = `translate3d(${dx}px, ${dy * 0.6}px, 0)`;
    this.stick.dataset.dir = this.touchSteer < -0.05 ? 'l' : this.touchSteer > 0.05 ? 'r' : '';
  }

  release() {
    this.off = { x: 0, y: 0 };
    if (!this.stick) return;
    this.stick.classList.remove('active');
    this.stick.style.transform = '';
    this.knob.style.transform = '';
    this.stick.dataset.dir = '';
  }

  // Keyboard arrows also move the knob, so it's clear what steering does.
  keyStick(dir) {
    if (this.steerId != null || !this.stick) return;
    this.knob.style.transform = dir ? `translate3d(${dir * this.range()}px, 0, 0)` : '';
    this.stick.dataset.dir = dir < 0 ? 'l' : dir > 0 ? 'r' : '';
  }

  key(e, on) {
    const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift', KeyX: 'item', ArrowUp: 'item', Enter: 'item', KeyH: 'horn' };
    const k = map[e.code];
    if (!k || !this.enabled) return;
    e.preventDefault();
    if (on && !this.keys.has(k)) {
      if (k === 'item') { this.state.use = true; if (this.onItem) this.onItem(); }
      if (k === 'horn' && this.onHorn) this.onHorn();
      if (k === 'drift' && this.onDrift) this.onDrift();
    }
    if (on) this.keys.add(k); else this.keys.delete(k);
    this.state.drift = this.keys.has('drift') || this.driftIds.size > 0;
  }

  // Called once per frame by the race.
  read() {
    const kb = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
    if (kb !== this.lastKb) { this.lastKb = kb; this.keyStick(kb); }
    this.state.steer = clamp(kb || this.touchSteer, -1, 1);
    return this.state;
  }

  consumeUse() { const u = this.state.use; this.state.use = false; return u; }
}
