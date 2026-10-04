// Director: owns the film timeline (a list of scene definitions), builds/disposes scenes, drives camera/post/HUD/audio, supports seeking.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, GLOBAL } from './common.js';
import { SceneContext } from './scene.js';
import { applyCam } from './camera.js';

const POST_KEYS = ['exposure', 'contrast', 'saturation', 'vignette', 'grain', 'chroma', 'glitch', 'flash', 'blur', 'fade'];

export class Director {
  /**
   * @param {object} o {stage, post, audio, hud, createFX, film:[{id,dur,build(S)}], quality}
   */
  constructor(o) {
    this.stage = o.stage; this.post = o.post || null; this.audio = o.audio || null; this.hud = o.hud || null; this.createFX = o.createFX || null;
    this.film = o.film; this.quality = o.quality ?? 1; this.perf = o.perf || null;
    this.starts = []; let t = 0; for (const d of this.film) { this.starts.push(t); t += d.dur; } this.total = t;
    this.time = 0; this.playing = false; this.cur = null; this.curIndex = -1; this.next = null; this.nextIndex = -1; this.old = null;
    this.audioState = { music: null, amb: {} }; this.errors = new Map(); this.errorCount = 0; this._ov = []; this._tr = { fade: 0, flash: 0, glitch: 0 }; this.aspect = 16 / 9; this.onScene = null;
    this.debug = false; this.frame = 0;
  }
  report(S, where, err) { const key = (S ? S.id : '?') + '|' + where + '|' + (err && err.message); this.errorCount++; if (!this.errors.has(key)) { this.errors.set(key, 1); console.error(`[film] ${S ? S.id : '?'} ${where}:`, err && err.stack ? err.stack : err); } else this.errors.set(key, this.errors.get(key) + 1); }
  indexAt(t) { let i = this.film.length - 1; while (i > 0 && this.starts[i] > t) i--; return i; }

  _build(i, silentTo = 0) {
    const def = this.film[i]; const S = new SceneContext(this, def);
    try { def.build(S); } catch (err) { this.report(S, 'build', err); S.broken = true; }
    if (!S.shots.length) S.shot(0, def.dur, { pos: [0, 2, 8], look: [0, 1.5, 0], fov: 40 });
    if (S.scene.background == null) S.scene.background = new THREE.Color(0x000000);
    if (silentTo > 0) { S.silent = true; const step = 1 / 15; for (let t = 0; t < silentTo; t += step) S.update(Math.min(t, silentTo), step); S.update(silentTo, 1 / 60); S.silent = false; }
    return S;
  }
  _activate(S, i) {
    const prev = this.cur; this.cur = S; this.curIndex = i; this.stage.scene = S.scene;
    this.stage.camera.near = S.camNear; this.stage.camera.far = S.camFar; this.stage.camera.updateProjectionMatrix();
    this.stage.renderer.toneMappingExposure = S.exposure;
    if (this.post && this.post.setScene) this.post.setScene(S.scene);
    if (prev) { this.old = prev; }
    if (this.onScene) this.onScene(S, i);
  }
  /** jump to global film time t */
  seek(t, { play = null } = {}) {
    t = clamp(t, 0, this.total - 0.001); const i = this.indexAt(t); const local = t - this.starts[i];
    if (this.next) { this.next.dispose(); this.next = null; this.nextIndex = -1; }
    const keepAudio = this.audioState; this.audioState = { music: null, amb: {} };
    if (this.audio) { this.audio.sfx.stopAll && this.audio.sfx.stopAll(); this.audio.voice.stopAll && this.audio.voice.stopAll(); }
    const S = this._build(i, local); this._activate(S, i); this.time = t; if (this.old) { this.old.dispose(); this.old = null; }
    // restore audio bed for the new position
    const st = this.audioState; if (this.audio) { if (st.music) { if (st.music.cue === 'stop' || st.music.cue === 'silence') this.audio.music.stop(0.5); else this.audio.music.play(st.music.cue, { fade: 1.2, intensity: st.music.intensity ?? 0.5 }); } else this.audio.music.stop(0.5); this.audio.amb.clear && this.audio.amb.clear(0.5); for (const k in st.amb) this.audio.amb.set(k, st.amb[k], 1.0); }
    if (play !== null) this.playing = play; this._applyFrame(0);
  }
  setPlaying(p) { this.playing = p; if (this.audio) { if (p) this.audio.resume && this.audio.resume(); else { this.audio.suspend && this.audio.suspend(); this.audio.voice.stopAll && this.audio.voice.stopAll(); } } }

  /** advance (if playing), update scene, render */
  update(dtReal) {
    const dt = Math.min(dtReal, 0.1); this.frame++;
    if (!this.cur) return;
    if (this.playing) {
      this.time += dt; if (this.time >= this.total) { this.time = this.total - 0.001; this.playing = false; if (this.onEnd) this.onEnd(); }
      let i = this.indexAt(this.time);
      if (i !== this.curIndex) {
        // switch scene (use preloaded if available)
        let S = this.next && this.nextIndex === i ? this.next : null; this.next = null; this.nextIndex = -1; if (!S) S = this._build(i);
        this._activate(S, i);
      }
      // preload next scene shortly before the end (hidden under the fade)
      const local = this.time - this.starts[this.curIndex]; const remain = this.film[this.curIndex].dur - local;
      if (!this.next && this.curIndex + 1 < this.film.length && remain < 1.6 && remain > 0.05) { this.nextIndex = this.curIndex + 1; this.next = this._build(this.nextIndex); }
    }
    this._applyFrame(dt);
    // dispose the previous scene once the new one has rendered a frame
    if (this.old && this.old !== this.cur) { this.old.dispose(); this.old = null; }
  }
  _applyFrame(dt) {
    const S = this.cur; const local = clamp(this.time - this.starts[this.curIndex], 0, S.duration);
    GLOBAL.time.value = this.time;
    if (this.playing || dt === 0 || true) S.update(local, dt || 0.0001);
    const st = this.stage; const cam = st.camera; applyCam(cam, S.cam, this.aspect);
    // post
    if (this.post) {
      const p = this.post.params; const g = S.grade; const base = { exposure: 1, contrast: 1, saturation: 1, vignette: 0.35, grain: 0.35, chroma: 0.25, glitch: 0, flash: 0, blur: 0, fade: 0 };
      for (const k of POST_KEYS) p[k] = (g && g[k] !== undefined) ? g[k] : base[k];
      if (g && g.tint) p.tint = g.tint; else if (p.tint && p.tint.set) p.tint.set(1, 1, 1); else p.tint = [1, 1, 1];
      if (g && g.bloom !== undefined && p.bloom) p.bloom.strength = g.bloom; else if (p.bloom) p.bloom.strength = 0.55;
      for (const k of S.postKeys) { if (local >= k.t0 && local <= k.t1) { const u = (local - k.t0) / Math.max(1e-6, k.t1 - k.t0); const e = k.ease === 'out' ? 1 - (1 - u) * (1 - u) : k.ease === 'in' ? u * u : k.ease === 'smooth' ? u * u * (3 - 2 * u) : u; this._setPost(p, k.key, lerp(k.a, k.b, e)); } else if (local > k.t1 && (k.hold || k.key === 'fade' && k.b >= 1)) { this._setPost(p, k.key, k.b); } }
      S.transitionState(local, this._tr); p.fade = Math.max(p.fade || 0, this._tr.fade); p.flash = Math.max(p.flash || 0, this._tr.flash); p.glitch = Math.max(p.glitch || 0, this._tr.glitch);
      // global film fade at very start / end
      if (this.time < 0.4) p.fade = Math.max(p.fade, 1 - this.time / 0.4);
      if (this.total - this.time < 1.0) p.fade = Math.max(p.fade, 1 - (this.total - this.time));
    }
    // HUD
    if (this.hud) { this.hud.sync(local, S.activeOverlays(local, this._ov), S.activeSubtitle(local)); }
    if (this.audio && this.audio.setListener) this.audio.setListener(cam);
    // render
    if (this.post) this.post.render(dt); else st.renderer.render(S.scene, cam);
  }
  _setPost(p, key, v) { if (key === 'bloomStrength') { if (p.bloom) p.bloom.strength = v; } else if (key === 'tint') { p.tint = v; } else p[key] = v; }
  resize(w, h, pixelRatio) { this.stage.resize(w, h, pixelRatio); if (this.post) this.post.setSize(w, h, pixelRatio); this.aspect = w / h; }
  dispose() { for (const s of [this.cur, this.next, this.old]) if (s) s.dispose(); }
}
