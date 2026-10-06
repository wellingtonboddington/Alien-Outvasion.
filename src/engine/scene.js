// SceneContext: the authoring + runtime object for one scene of the film. Everything registered here is time-keyed and seekable.
import * as THREE from 'three';
import { RNG, hashStr, clamp, smoothstep, disposeTree } from './common.js';
import { Actor, Entity } from './actor.js';
import { evalShot, CamState, coverageSpec, resolvePoint } from './camera.js';
import { buildVisemeTrack, sampleMouth, speechEnergy, estimateDuration, MOUTH_KEYS } from './lipsync.js';

const V3 = THREE.Vector3;

export class SceneContext {
  constructor(director, def) {
    this.dir = director; this.def = def; this.id = def.id; this.duration = def.dur;
    this.scene = new THREE.Scene(); this.scene.name = def.id;
    this.rng = new RNG(hashStr(def.id)); this.t = 0; this.dt = 0.016; this.silent = false;
    this.modules = []; this.actors = []; this.entities = []; this.events = []; this.shots = []; this.lines = []; this.overlays = []; this.postKeys = []; this.updaters = [];
    this.bounds = null; this.cam = new CamState(); this._shotIdx = -1; this._speakerActor = null; this.fxSys = null; this.lights = null; this.sky = null; this.broken = false;
    this.fadeIn = def.fadeIn ?? 0.6; this.fadeOut = def.fadeOut ?? 0.6; this.cutIn = !!def.cutIn; this.cutOut = !!def.cutOut; this.exposure = def.exposure ?? 1;
    this.grade = def.grade || null; this.camNear = def.near ?? 0.1; this.camFar = def.far ?? 6000; this.renderHooks = [];
  }
  get quality() { return this.dir.quality; }
  get audio() { return this.dir.audio; }
  get fx() { if (!this.fxSys && this.dir.createFX) { this.fxSys = this.dir.createFX(this.scene, {}); this.modules.push(this.fxSys); } return this.fxSys; }

  // ---------- content registration ----------
  /** Add a module ({root,update,dispose}) or an Object3D. Returns it. */
  add(m, parent = null) {
    if (!m) return m;
    if (m.isObject3D) { (parent || this.scene).add(m); return m; }
    if (m.root) { (parent || this.scene).add(m.root); this.modules.push(m); }
    return m;
  }
  /** Register a hero model as an Actor with tracks. opts:{name,color,alien,height,seed,autoLook} */
  actor(model, opts = {}) { this.scene.add(model.root); const a = new Actor(this, model, opts); this.actors.push(a); return a; }
  /** Register any object (vehicle, ship, jet...) for time-keyed movement */
  entity(obj, opts = {}) { this.scene.add(obj.root || obj); const e = new Entity(this, obj, opts); this.entities.push(e); return e; }
  /** per-frame callback during [t0,t1]: fn(localT, u01, dt) */
  during(t0, t1, fn) { this.updaters.push({ t0, t1, fn }); return this; }
  /** one-shot event at scene time t (fires in order; skipped audio when silent-seeking) */
  on(t, fn, { always = false } = {}) { this.events.push({ t, fn, done: false, always }); return this; }
  /** shorthand sound hooks */
  sfx(t, name, o = {}) { return this.on(t, () => this.audio && this.audio.sfx.play(name, { ...o, pos: o.pos ? (o.pos.isVector3 ? o.pos : new V3(...o.pos)) : null })); }
  music(t, cue, o = {}) { return this.on(t, () => this._setMusic(cue, o), { always: true }); }
  amb(t, name, level = 0.5, fade = 2) { return this.on(t, () => this._setAmb(name, level, fade), { always: true }); }
  ambClear(t, fade = 2) { return this.on(t, () => this._setAmb(null, 0, fade), { always: true }); }
  _setMusic(cue, o) { this.dir.audioState.music = { cue, ...o }; if (!this.silent && this.audio) { if (cue === 'stop' || cue === 'silence') this.audio.music.stop(o.fade ?? 2); else this.audio.music.play(cue, { fade: o.fade ?? 2, intensity: o.intensity ?? 0.5 }); } }
  _setAmb(name, level, fade) { const st = this.dir.audioState; if (!name) { st.amb = {}; if (!this.silent && this.audio) this.audio.amb.clear(fade); } else { st.amb[name] = level; if (!this.silent && this.audio) this.audio.amb.set(name, level, fade); } }

  // ---------- camera ----------
  /** Add a camera shot [t0,t1). transition (at its START): 'cut' (default) | 'dip' | 'flash' | 'glitch' | 'fade' */
  shot(t0, t1, spec, transition = 'cut') { this.shots.push({ t0, t1, spec, transition }); this.shots.sort((a, b) => a.t0 - b.t0); return this; }
  setBounds(min, max) { this.bounds = { min, max }; return this; }
  /** Dialogue coverage: automatic shot-reverse-shot built from the lines registered in [t0,t1]. */
  cover(t0, t1, opts = {}) {
    const lines = this.lines.filter((l) => l.t0 >= t0 - 1e-6 && l.t0 < t1 && l.actor).sort((a, b) => a.t0 - b.t0); const people = opts.actors || [...new Set(lines.map((l) => l.actor))];
    const bounds = opts.bounds || this.bounds; if (!lines.length) return this;
    const partnerOf = (a, i) => { if (opts.partner && opts.partner.get && opts.partner.get(a)) return opts.partner.get(a); for (let j = i - 1; j >= 0; j--) if (lines[j].actor !== a) return lines[j].actor; for (let j = i + 1; j < lines.length; j++) if (lines[j].actor !== a) return lines[j].actor; return people.find((p) => p !== a) || a; };
    let t = t0, n = 0; const first = lines[0]; const A0 = first.actor; const B0 = partnerOf(A0, 0);
    const masterEnd = Math.min(first.t0 + 0.8, first.t0 + (first.t1 - first.t0) * 0.5);
    if (masterEnd - t > 0.4) this.shot(t, masterEnd, coverageSpec('wide', A0, B0, { bounds, dist: opts.dist || 1, seed: 1 }), opts.transition || 'cut'), t = masterEnd;
    const pattern = opts.pattern || ['cu', 'ots', 'mcu', 'cu', 'two', 'ots'];
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i]; const A = L.actor; const B = partnerOf(A, i); const idx = Math.max(0, people.indexOf(A)); const side = (people.indexOf(A) % 2 === 0) ? 1 : -1;
      const start = Math.max(t, L.t0 - 0.05); const end = (i + 1 < lines.length) ? Math.max(start + 0.6, lines[i + 1].t0 - 0.05) : Math.max(L.t1 + 0.5, start + 1); const e2 = Math.min(end, t1);
      if (e2 - start < 0.25) continue;
      let kind = pattern[n % pattern.length]; n++;
      if (A === B) kind = 'cu';
      const len = e2 - start;
      if (len > 6.5) { const mid = start + len * 0.55; this.shot(start, mid, coverageSpec(kind, A, B, { side, bounds, push: 0.25, seed: n, dist: opts.dist || 1 })); this.shot(mid, e2, coverageSpec(kind === 'cu' ? 'mcu' : 'cu', A, B, { side, bounds, push: 0.15, seed: n + 3, dist: opts.dist || 1 })); }
      else this.shot(start, e2, coverageSpec(kind, A, B, { side, bounds, push: 0.2, seed: n, dist: opts.dist || 1 }));
      t = e2;
      // reaction shot after a long line
      if (len > 4 && i + 1 < lines.length && lines[i + 1].actor !== A && this.shots.length) { /* handled by next line's shot */ }
    }
    if (t < t1 - 0.3) this.shot(t, t1, coverageSpec('two', A0, B0, { bounds, seed: 9, dist: opts.dist || 1 }));
    return this;
  }

  // ---------- dialogue ----------
  /**
   * One spoken line. who: Actor | string (off-screen speaker). opts:{dur, emotion, lang, sub, name, color, style, to, voice, gender, character, italic}
   * Returns end time. Subtitle shows opts.sub (translation) when given, else text.
   */
  say(t, who, text, opts = {}) {
    const actor = who && who.model ? who : null; const dur = opts.dur ?? Math.max(1.0, (estimateDuration(text, opts.wpm || 170) + 0.15) * (opts.pace || 1));
    const track = buildVisemeTrack(opts.visemeText || text, dur);
    const name = opts.name || (actor ? actor.name : String(who)); const color = opts.color || (actor ? actor.color : '#dfe8ff');
    const line = { t0: t, t1: t + dur, dur, actor, who, text, sub: opts.sub || text, name, color, track, emotion: opts.emotion || null, to: opts.to || null, amp: opts.amp ?? 1, style: opts.style || (actor && actor.isAlien ? 'alien' : 'human'), lang: opts.lang || 'en-US', gender: opts.gender || (actor && actor.model && actor.model.profile ? actor.model.profile.gender : 'M'), character: opts.character || (actor ? actor.id : name), idx: this.lines.length, italic: !!opts.italic || (opts.style === 'alien'), voice: opts.voice || {}, mute: !!opts.mute, pitch: opts.pitch, nosub: !!opts.nosub };
    this.lines.push(line);
    this.events.push({ t, fn: () => { if (this.silent || !this.audio || line.mute) return; this.audio.voice.say({ text: opts.speak || text, lang: line.lang, gender: line.gender === 'F' ? 'F' : 'M', pitch: line.pitch ?? 1, duration: dur, style: line.style, character: line.character, pan: opts.pan, ...line.voice }); }, done: false });
    return t + dur;
  }
  /**
   * Fit a conversation into [t0,t1]: lines keep natural (never clipped) durations — slack becomes natural pauses between lines,
   * overfull scenes compress speech by at most ~20%. lines = [[who,text,opts],...] (opts.gap = extra pause after the line). Returns end time.
   * This is the anti-cut-off / anti-dead-air tool: use it for every scene so the talk fills the shot and ends before the fade.
   */
  fit(t0, t1, lines, { gap0 = 0.28, maxStretch = 1.18, maxGap = 1.6, lead = 0.35 } = {}) {
    const nat = lines.map((l) => { const o = l[2] || {}; return o.dur ?? Math.max(1.0, (estimateDuration(l[1], o.wpm || 170) + 0.15) * (o.pace || 1)); });
    const sum = nat.reduce((a, b) => a + b, 0), n = lines.length; const avail = Math.max(0.5, t1 - t0 - lead); const base = sum + (n - 1) * gap0;
    let k = 1, gap = gap0;
    if (base > avail) { k = Math.max(0.8, (avail - (n - 1) * gap0) / sum); if (k * sum + (n - 1) * gap0 > avail + 0.05 && !this.dir.quiet) console.warn(`[film] ${this.id}: dialogue overfull by ${(k * sum + (n - 1) * gap0 - avail).toFixed(1)} s`); }
    else { k = Math.min(maxStretch, (avail - (n - 1) * gap0) / sum); k = Math.max(1, Math.min(k, 1.0 + (maxStretch - 1))); const slack = avail - k * sum; gap = n > 1 ? Math.min(maxGap, slack / (n - 1)) : 0; }
    let c = t0 + lead + (n > 1 ? 0 : Math.max(0, (avail - k * sum) / 2));
    for (let i = 0; i < n; i++) { const o = { ...(lines[i][2] || {}) }; o.dur = nat[i] * k; c = this.say(c, lines[i][0], lines[i][1], o) + (i < n - 1 ? Math.max(gap, 0.18) + (o.gap || 0) : 0); }
    return c;
  }
  /** Sequential dialogue: lines = [[who, text, opts?], ...]; returns end time. */
  dialogue(t, lines, { gap = 0.3 } = {}) { let c = t; for (const l of lines) { c = this.say(c, l[0], l[1], l[2] || {}) + (l[2] && l[2].gap !== undefined ? l[2].gap : gap); } return c - gap; }

  // ---------- overlays (HUD) ----------
  overlay(t0, t1, type, data) { this.overlays.push({ t0, t1, type, data, id: type + ':' + t0 + ':' + this.overlays.length }); return this; }
  /** top-left date/time/place stamp */
  stamp(t0, text, place = '', dur = 4.5) { return this.overlay(t0, t0 + dur, 'stamp', { text, place }); }
  /** lower-left character intro */
  nameCard(t0, name, role, age, color = '#ffd36e', dur = 4) { return this.overlay(t0, t0 + dur, 'name', { name, role, age, color }); }
  /** centred title text */
  title(t0, text, sub = '', dur = 4, opts = {}) { return this.overlay(t0, t0 + dur, 'title', { text, sub, ...opts }); }
  /** small caption in a corner (e.g. 'LIVE', 'TRANSMISSION') */
  tag(t0, t1, text, opts = {}) { return this.overlay(t0, t1, 'tag', { text, ...opts }); }
  /** scrolling credits */
  credits(t0, t1, lines) { return this.overlay(t0, t1, 'credits', { lines }); }
  /** radio/phone/holo-call frame: label shown while visible */
  callFrame(t0, t1, label, color = '#7fe9ff') { return this.overlay(t0, t1, 'call', { label, color }); }

  // ---------- post animation ----------
  /** animate a post param key from a to b over [t0,t1] (keys: exposure, contrast, saturation, vignette, grain, chroma, glitch, flash, blur, bloomStrength, tint) */
  post(t0, t1, key, a, b, ease = 'linear') { this.postKeys.push({ t0, t1, key, a, b, ease }); return this; }
  fadeFrom(t0, t1) { return this.post(t0, t1, 'fade', 1, 0); }
  fadeTo(t0, t1) { return this.post(t0, t1, 'fade', 0, 1); }
  flash(t, dur = 0.5) { return this.post(t, t + dur, 'flash', 1, 0, 'out'); }

  // ---------- runtime ----------
  /** called by the director every frame */
  update(t, dt) {
    this.t = t; this.dt = dt;
    // events
    for (const e of this.events) { if (!e.done && e.t <= t + 1e-9) { e.done = true; if (this.silent && !e.always) continue; try { e.fn(this); } catch (err) { this.dir.report(this, 'event', err); } } }
    // dialogue state
    this._speakerActor = null;
    for (const a of this.actors) a.speaking = null;
    for (const L of this.lines) {
      if (t >= L.t0 && t <= L.t1 + 0.12) {
        if (L.actor) {
          const lt = t - L.t0; const mouth = L.actor.mouth; sampleMouth(L.track, lt, mouth, L.amp); const en = speechEnergy(L.track, lt);
          L.actor.speaking = { mouth, energy: en, emotion: L.emotion, idx: L.idx, to: L.to };
          if (t <= L.t1) this._speakerActor = L.actor;
        }
      }
    }
    // tracks
    for (const a of this.actors) { try { a.evaluate(t, dt); } catch (err) { this.dir.report(this, 'actor ' + a.name, err); } }
    for (const e of this.entities) { try { e.evaluate(t, dt); } catch (err) { this.dir.report(this, 'entity', err); } }
    for (const u of this.updaters) { if (t >= u.t0 && t <= u.t1) { try { u.fn(t, (t - u.t0) / Math.max(1e-6, u.t1 - u.t0), dt); } catch (err) { this.dir.report(this, 'updater', err); } } }
    for (const m of this.modules) { try { m.update && m.update(dt, t); } catch (err) { this.dir.report(this, 'module', err); } }
    if (this._hemi) this._hemiSync();
    // camera
    this._evalCamera(t, dt);
  }
  /** Merge every hemisphere light into one scene-level light that tracks them each frame. Sets often bring their own hemi (and are
   *  placed at large offsets, which tilted those hemis sideways); one light means fewer shader variants and cheaper shading. */
  mergeHemis() {
    const hs = []; this.scene.traverse((o) => { if (o.isHemisphereLight) hs.push(o); });
    if (hs.length < 2) return;
    const M = new THREE.HemisphereLight(0, 0, 1); M.name = 'hemiMerged'; M.position.set(0, 1, 0); this.scene.add(M);
    for (const h of hs) h.layers.set(31); // excluded from lighting (the camera only sees layer 0), still animatable by scene code
    this._hemi = { M, hs }; this._hemiSync();
  }
  _hemiSync() {
    const { M, hs } = this._hemi; const c = M.color.setRGB(0, 0, 0), g = M.groundColor.setRGB(0, 0, 0);
    for (const h of hs) {
      let v = h.visible, p = h.parent; while (v && p) { v = p.visible; p = p.parent; } if (!v || !h.parent) continue;
      const k = h.intensity; c.r += h.color.r * k; c.g += h.color.g * k; c.b += h.color.b * k; g.r += h.groundColor.r * k; g.g += h.groundColor.g * k; g.b += h.groundColor.b * k;
    }
  }
  _evalCamera(t, dt) {
    const shots = this.shots; if (!shots.length) return;
    let i = 0; for (let k = shots.length - 1; k >= 0; k--) if (shots[k].t0 <= t + 1e-9) { i = k; break; }
    const sh = shots[i]; if (i !== this._shotIdx) { this._shotIdx = i; if (sh.spec._st) delete sh.spec._st; }
    evalShot(sh.spec, t - sh.t0, sh.t1 - sh.t0, this.cam, this);
    this.curShot = sh;
  }
  /** transition amounts at time t: {fade, flash, glitch} from shot transitions + scene fades */
  transitionState(t, out) {
    let fade = 0, flash = 0, glitch = 0; const D = this.duration; const tr = 0.32;
    if (!this.cutIn) fade = Math.max(fade, 1 - smoothstep(0, this.fadeIn, t)); if (!this.cutOut) fade = Math.max(fade, smoothstep(D - this.fadeOut, D, t));
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i]; if (s.transition === 'cut' || s.t0 <= 0.01) continue; const dtn = t - s.t0;
      if (s.transition === 'dip' || s.transition === 'fade') { if (dtn > -tr && dtn < 0) fade = Math.max(fade, smoothstep(-tr, 0, dtn)); else if (dtn >= 0 && dtn < tr) fade = Math.max(fade, 1 - smoothstep(0, tr, dtn)); }
      else if (s.transition === 'flash') { if (dtn >= 0 && dtn < 0.5) flash = Math.max(flash, 1 - dtn / 0.5); }
      else if (s.transition === 'glitch') { if (dtn >= -0.06 && dtn < 0.28) glitch = Math.max(glitch, 1 - Math.abs(dtn - 0.1) / 0.2); }
    }
    out.fade = fade; out.flash = flash; out.glitch = glitch; return out;
  }
  activeOverlays(t, out) { out.length = 0; for (const o of this.overlays) if (t >= o.t0 && t <= o.t1) out.push(o); return out; }
  activeSubtitle(t) { let best = null; for (const L of this.lines) { if (L.nosub) continue; if (t >= L.t0 - 0.05 && t <= L.t1 + 0.35) best = L; } return best; }
  dispose() {
    for (const m of this.modules) { try { m.dispose && m.dispose(); } catch (e) { /* ignore */ } }
    for (const a of this.actors) { try { a.model.dispose && a.model.dispose(); } catch (e) { /* ignore */ } }
    for (const e of this.entities) { try { e.obj.dispose && e.obj.dispose(); } catch (err) { /* ignore */ } }
    try { disposeTree(this.scene); } catch (e) { /* ignore */ }
    this.scene.clear(); this.modules.length = 0; this.actors.length = 0; this.entities.length = 0;
  }
}
