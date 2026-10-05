// SFX playback machinery: handles, 3D positioning (distance gain + air-absorption lowpass + pan + wetter when far, speed-of-sound delay for
// big far booms), looping by re-triggering the recipe, doppler for moving sources, polyphony cap, tidy disconnects.
import { RNG, Syn, hashStr } from './dsp.js';
import { RECIPES } from './sfx_recipes.js';

const SOUND_SPEED = 343;
const REF = { // distance (m) at which the sound starts to fall off (loud things carry further)
  nuke: 400, explosion_big: 90, explosion_far: 250, thunder: 300, tripod_horn: 160, cannon: 70, missile_launch: 60, jet_pass: 70, afterburner: 50, explosion_small: 35, grenade: 30,
  siren: 45, helicopter: 50, tank: 35, tripod_step: 80, rifle: 22, burst: 22, mg: 25, shotgun: 20, pistol: 14, crash: 25, glass: 8, alarm: 18, scream: 14, crowd_panic: 30, engine_rev: 22, engine_idle: 10, laser_fire: 25, laser_hit: 14,
  pod_whine: 12, drone_hum: 14, zombie_roar: 12, alien_growl: 12, crawler_screech: 10, footstep: 3, footsteps: 4, door: 5, keyboard: 2, phone_ring: 4, phone_vibrate: 2, heartbeat: 1,
};

export function createSfx(A) {
  const ctx = A.ctx; const handles = new Set(); const warned = new Set();
  const dead = { stop() {}, setGain() {}, setPitch() {}, setPos() {}, playing: false, dead: true };

  class Handle {
    constructor(name, rec, o) {
      this.name = name; this.rec = rec; this.o = o; this.stopped = false; this.loop = !!o.loop; this.pitch = o.pitch > 0 ? o.pitch : 1; this.pitch0 = this.pitch; this.userGain = o.gain !== undefined ? o.gain : 1;
      this.syns = new Set(); this.endT = 0; this.period = 0; this.nextT = 0; this.sp = null; this.pos = null; this.to = null; this.moveT0 = 0; this.moveDur = 0; this.follow = !!o.follow;
      this.lastDist = null; this.lastStamp = ''; this.dopplerOn = !!(rec.doppler && (o.doppler !== false)); this.pitchCtl = null; this.nodeList = [];
      this.in = ctx.createGain(); this.cal = (A.mix && A.mix.sfx && A.mix.sfx[name]) || 1; this.in.gain.value = this.userGain * (rec.g || 1) * this.cal;
      this.fade = ctx.createGain(); this.post = ctx.createGain(); this.gS = ctx.createGain(); this.gL = ctx.createGain();
      this.in.connect(this.fade); this.fade.connect(this.post);
      const bus = A.bus.sfx; this.post.connect(bus.dry); this.post.connect(this.gS); this.post.connect(this.gL); this.gS.connect(bus.wetS); this.gL.connect(bus.wetL);
      this.gS.gain.value = 0; this.gL.gain.value = 0; this.wet = rec.wet || [0.1, 0.2];
      if (this.loop || rec.cont || this.dopplerOn || o.follow) { this.pitchCtl = ctx.createConstantSource(); this.pitchCtl.offset.value = 0; this.pitchCtl.start(); }
      this.nodeList.push(this.in, this.fade, this.post, this.gS, this.gL);
    }
    get playing() { return !this.finished; }
    setGain(g, tc = 0.05) { this.userGain = g; this.in.gain.setTargetAtTime(g * (this.rec.g || 1) * this.cal, A.now(), Math.max(0.002, tc)); }
    setPitch(p) {
      this.pitch = p > 0 ? p : 1;
      if (this.pitchCtl) this.pitchCtl.offset.setTargetAtTime(1200 * Math.log2(this.pitch / this.pitch0), A.now(), 0.04);
    }
    setPos(v) {
      if (!v) return; if (!this.pos) this.pos = { x: 0, y: 0, z: 0 }; this.pos.x = v.x; this.pos.y = v.y; this.pos.z = v.z; this._ensureSpatial(); this._update(A.now(), true);
    }
    _ensureSpatial() {
      if (this.sp) return;
      this.sp = A.spatial(this.pos, { ref: this.o.ref || REF[this.name] || 10 });
      this.fade.disconnect(this.post); this.fade.connect(this.sp.in); this.sp.out.connect(this.post);
    }
    _update(now, instant) {
      if (!this.sp) return; const L = A.listener;
      if (this.to && this.moveDur > 0) { const k = Math.max(0, Math.min(1, (now - this.moveT0) / this.moveDur)); const p = this.pos, a = this.from, b = this.to; p.x = a.x + (b.x - a.x) * k; p.y = a.y + (b.y - a.y) * k; p.z = a.z + (b.z - a.z) * k; }
      else if (this.follow && this.src) { this.pos.x = this.src.x; this.pos.y = this.src.y; this.pos.z = this.src.z; }
      const stamp = `${this.pos.x.toFixed(2)},${this.pos.y.toFixed(2)},${this.pos.z.toFixed(2)}|${L.x.toFixed(2)},${L.y.toFixed(2)},${L.z.toFixed(2)},${L.fx.toFixed(2)},${L.fz.toFixed(2)}`;
      if (!instant && stamp === this.lastStamp) return; this.lastStamp = stamp;
      const prev = this.sp.dist; this.sp.update(now, instant);
      const w = this.wet; const m = this.sp.wetMul; const dg = Math.max(0.12, Math.sqrt(this.sp.dryGain));
      this.gS.gain.setTargetAtTime(Math.min(1.2, w[0] * m / dg * Math.min(1, dg + 0.4)), now, 0.05); this.gL.gain.setTargetAtTime(Math.min(1.6, w[1] * m / dg * Math.min(1, dg + 0.4)), now, 0.05);
      if (this.dopplerOn && this.pitchCtl && this.lastDist !== null && this.lastT !== undefined && now > this.lastT + 0.01) {
        const vr = (this.sp.dist - this.lastDist) / (now - this.lastT); const f = SOUND_SPEED / (SOUND_SPEED + 0.55 * Math.max(-250, Math.min(250, vr))); // cinematic: ~half-strength doppler
        this.pitchCtl.offset.setTargetAtTime(1200 * Math.log2(f * this.pitch / this.pitch0), now, 0.06);
      }
      if (this.lastT === undefined || now > this.lastT + 0.01) { this.lastDist = this.sp.dist; this.lastT = now; }
    }
    _trigger(t) {
      const S = new Syn(A, this.in, t, 'sfx', this.pitchCtl); const h = this; const rec = this.rec;
      const R = { A, ctx, S, h, t0: t, out: this.in, o: this.o, rng: new RNG((A.rng.next() * 4294967296) >>> 0), pitch: this.pitch0, loop: this.loop,
        sustain: this.loop && !!rec.cont, wet: this.wet.slice(), period: 0,
        F(f) { return f * this.pitch; }, D(d) { return d / Math.sqrt(this.pitch); }, life(d) { return this.D(d); } };
      let dur = 1;
      try { dur = rec.fn(R, this.o) || 1; } catch (e) { if (!warned.has(this.name + 'err')) { warned.add(this.name + 'err'); console.warn('[audio] sfx recipe failed:', this.name, e); } try { S.stopAt(t); } catch (e2) { /* */ } S.dispose(); return 0; }
      this.syns.add(S); S.onDone = () => this.syns.delete(S);
      this.endT = Math.max(this.endT, t + dur); this.period = R.period || dur; this.wet = R.wet;
      if (!this.sp) { this.gS.gain.setTargetAtTime(this.wet[0], A.now(), 0.01); this.gL.gain.setTargetAtTime(this.wet[1], A.now(), 0.01); }
      return dur;
    }
    stop(fade = 0.05) {
      if (this.stopped) return; this.stopped = true; this.loop = false; const now = A.now(); fade = Math.max(0.005, fade);
      this.fade.gain.setTargetAtTime(0, now, fade / 3); for (const s of this.syns) s.stopAt(now + fade * 1.6 + 0.03);
      this.endT = Math.min(this.endT, now + fade * 1.6 + 0.08) || now + 0.1; if (this.endT < now) this.endT = now + 0.1;
    }
    _dispose() {
      if (this.finished) return; this.finished = true; handles.delete(this);
      for (const s of this.syns) { s.stopAt(A.now()); s.dispose(); } this.syns.clear();
      for (const n of this.nodeList) { try { n.disconnect(); } catch (e) { /* */ } }
      if (this.sp) this.sp.dispose(); if (this.pitchCtl) { try { this.pitchCtl.stop(); this.pitchCtl.disconnect(); } catch (e) { /* */ } }
    }
  }

  A.addTicker((now, until) => {
    for (const h of handles) {
      if (h.finished) continue;
      if (h.loop && !h.stopped) {
        let guard = 0;
        while (h.nextT < until && guard++ < 6) {
          if (A.live.sfx >= A.caps.sfx + 8) { h.nextT = until + 0.05; break; }
          h._trigger(Math.max(h.nextT, now)); const adv = Math.max(0.05, h.o.interval && !h.rec.cont ? h.o.interval : h.period); h.nextT += adv;
        }
      }
      if (h.sp) h._update(now, false);
      if (!h.loop && now > h.endT + 0.15 && (h.stopped || h.syns.size === 0)) h._dispose();
    }
  });

  function play(name, o = {}) {
    const rec = RECIPES[name];
    if (!rec) { if (!warned.has(name)) { warned.add(name); console.warn('[audio] unknown sfx', name); } return dead; }
    if (A.live.sfx >= A.caps.sfx && !rec.vip) return dead;
    if (A.live.sfx >= A.caps.sfx + 12) return dead;
    const h = new Handle(name, rec, o); handles.add(h); h.src = null;
    let t0 = A.now() + 0.012 + Math.max(0, o.delay || 0);
    if (o.pos) {
      h.pos = { x: o.pos.x, y: o.pos.y, z: o.pos.z }; if (o.follow) h.src = o.pos;
      if (o.to) { h.from = { x: o.pos.x, y: o.pos.y, z: o.pos.z }; h.to = { x: o.to.x, y: o.to.y, z: o.to.z }; h.moveT0 = t0; h.moveDur = o.dur || 6; }
      h._ensureSpatial(); h._update(A.now(), true);
      if (rec.travel && o.travel !== 0) { const k = (o.travel === undefined ? 0.7 : o.travel); t0 += Math.min(3.0, (h.sp.dist / SOUND_SPEED) * k); }
    }
    h.nextT = t0; h.endT = t0;
    const dur = h._trigger(t0); h.nextT = t0 + Math.max(0.05, o.interval && !rec.cont ? o.interval : h.period || dur);
    return h;
  }

  return {
    play,
    stopAll(fade = 0.08) { for (const h of [...handles]) h.stop(fade); },
    has: (n) => !!RECIPES[n],
    names: () => Object.keys(RECIPES),
    get active() { return handles.size; },
  };
}
