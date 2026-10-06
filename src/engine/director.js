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
    try { S.mergeHemis(); } catch (err) { this.report(S, 'hemi', err); }
    if (!S.shots.length) S.shot(0, def.dur, { pos: [0, 2, 8], look: [0, 1.5, 0], fov: 40 });
    if (S.scene.background == null) S.scene.background = new THREE.Color(0x000000);
    if (silentTo > 0) { S.silent = true; const step = 1 / 15; for (let t = 0; t < silentTo; t += step) S.update(Math.min(t, silentTo), step); S.update(silentTo, 1 / 60); S.silent = false; }
    return S;
  }
  _activate(S, i) {
    const prev = this.cur; this.cur = S; this.curIndex = i; this.stage.scene = S.scene; this._activatedFrame = this.frame;
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
    if (this._pending) { this._pending.S.dispose(); this._pending = null; }
    const keepAudio = this.audioState; this.audioState = { music: null, amb: {} };
    if (this.audio) { this.audio.sfx.stopAll && this.audio.sfx.stopAll(); this.audio.voice.stopAll && this.audio.voice.stopAll(); }
    const S = this._build(i, local); this._activate(S, i); this.time = t; if (this.old) { this.old.dispose(); this.old = null; }
    // restore audio bed for the new position
    const st = this.audioState; if (this.audio) { if (st.music) { if (st.music.cue === 'stop' || st.music.cue === 'silence') this.audio.music.stop(0.5); else this.audio.music.play(st.music.cue, { fade: 1.2, intensity: st.music.intensity ?? 0.5 }); } else this.audio.music.stop(0.5); this.audio.amb.clear && this.audio.amb.clear(0.5); for (const k in st.amb) this.audio.amb.set(k, st.amb[k], 1.0); }
    if (play !== null) this.playing = play; this._applyFrame(0); this._pinPrograms();
  }
  setPlaying(p) { this.playing = p; if (this.audio) { if (p) this.audio.resume && this.audio.resume(); else { this.audio.suspend && this.audio.suspend(); this.audio.voice.stopAll && this.audio.voice.stopAll(); } } }

  /** advance (if playing), update scene, render */
  update(dtReal) {
    const dt = clamp(dtReal, 0, 0.1); this.frame++;
    if (!this.cur) return;
    if (this._pending) {
      // the next scene is built and its shaders are compiling in the background: hold the last presented frame (black under a fade)
      const P = this._pending; if (!P.ready && performance.now() < P.deadline) return;
      this._pending = null; this._activate(P.S, P.i); this.time = this.starts[P.i];
    } else if (this.playing) {
      this.time += dt; if (this.time >= this.total) { this.time = this.total - 0.001; this.playing = false; if (this.onEnd) this.onEnd(); }
      const i = this.indexAt(this.time);
      if (i !== this.curIndex) {
        // build at the scene boundary (the screen is black under the fade-out) instead of during visible frames
        let S = this.next && this.nextIndex === i ? this.next : null; this.next = null; this.nextIndex = -1;
        if (!S) { if (this.audio && this.audio.prefill) this.audio.prefill(4.5); S = this._build(i); }
        this.time = this.starts[i];
        if (this._compile(S, i)) return;
        this._activate(S, i);
      }
    }
    this._applyFrame(dt);
    // dispose the previous scene once the new one has rendered a frame
    if (this.old && this.old !== this.cur) { this.old.dispose(); this.old = null; }
    if (this.frame % 30 === 0) this._pinPrograms();
  }
  /** true while a scene swap is in progress or just happened (frame times are not representative) */
  get busy() { return !!this._pending || this.frame - (this._activatedFrame || 0) < 30; }
  /** compile the new scene's shaders without blocking (KHR_parallel_shader_compile). Returns true if the swap must wait for them. */
  _compile(S, i) {
    const r = this.stage.renderer; if (!r.compileAsync || !r.info.programs) return false;
    const before = r.info.programs.length; const prev = r.getRenderTarget(); let prom = null;
    try { r.setRenderTarget(this.post && this.post.sceneTarget ? this.post.sceneTarget() : null); prom = r.compileAsync(S.scene, this.stage.camera); } catch (err) { this.report(S, 'compile', err); }
    r.setRenderTarget(prev); this._pinPrograms();
    // upload the scene's textures now (screen is black) rather than on the first visible frames
    if (r.initTexture) { const seen = new Set(); S.scene.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) for (const k in mm) { const v = mm[k]; if (v && v.isTexture && !seen.has(v) && !v.isRenderTargetTexture && (v.image || v.isDataTexture)) { seen.add(v); try { r.initTexture(v); } catch (err) { /* ignore */ } } } }); }
    if (!prom || r.info.programs.length === before) return false; // every shader was already cached
    const P = { S, i, ready: false, deadline: performance.now() + 4000 }; prom.then(() => { P.ready = true; }, () => { P.ready = true; });
    this._pending = P; return true;
  }
  /** keep compiled shader programs alive across scenes: three.js destroys a program when the last material using it is disposed,
   *  which made every scene recompile ~50-90 programs (multi-second stalls on laptop GPUs). A pin is one extra use count; pins are never
   *  released by hand (three also indexes programs in a private map, so only its own release path may destroy them). Beyond the ceiling
   *  (phones only) new programs simply behave as before. */
  _pinPrograms() {
    const progs = this.stage.renderer.info.programs; if (!progs) return; const pinned = this._pinned || (this._pinned = []); const cap = this.pinCap ?? Infinity;
    for (const p of progs) { if (pinned.length >= cap) break; if (!p.__pinned) { p.__pinned = true; p.usedTimes++; pinned.push(p); } }
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
  dispose() { for (const s of [this.cur, this.next, this.old, this._pending && this._pending.S]) if (s) s.dispose(); this._pending = null; }
}
