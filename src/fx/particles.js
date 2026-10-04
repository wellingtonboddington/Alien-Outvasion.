// ALIEN OUTVASION — FX system (entry: createFX).
// Pooled, GPU-simulated particle systems + mesh effects. All simulation is a pure function of (spawn data, film time):
// deterministic (seeded), seekable, zero per-frame allocation. Budgets scale with Q.particles. See docs/api/fx.md.
import * as THREE from 'three';
import { Q, RNG, hashStr, clamp } from '../engine/common.js';
import { BillboardPool, Particle, makeSharedUniforms } from './pools.js';
import { RingPool, ShellPool, DecalPool, TrailPool, BoltPool, DebrisPool } from './meshfx.js';
import { smokeAtlas, fireAtlas, mistAtlas, glowAtlas } from './textures.js';
import * as EXP from './explosions.js';
import * as MISC from './recipes.js';
import * as WX from './weather.js';

const _v = new THREE.Vector3();
const _hash = (a, b = 0) => { let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); return (h ^ (h >>> 16)) >>> 0; };

export class FX {
  constructor(scene, opts = {}) {
    this.scene = scene; this.opts = opts; this.time = 0; this.lastUpdateT = -1; this.counter = 0; this.baseSeed = opts.seed ?? 1;
    this.root = new THREE.Group(); this.root.name = 'fx'; this.shared = makeSharedUniforms();
    this.P = new Particle(); this._rng = new RNG(1);
    this.budgetScale = 1;
    const cap = (n) => Math.max(24, Math.round(n * Math.max(0.3, Q.particles)));
    this.cap = cap;
    const smoke = smokeAtlas(), fire = fireAtlas(), mist = mistAtlas(), glow = glowAtlas();
    const S = this.shared;
    this.smoke = new BillboardPool(S, { name: 'smoke', frag: 'smoke', blend: 'premul', atlas: { tex: smoke, cols: 4, rows: 4 }, capacity: cap(3200), gravity: [0, 0.7, 0], drag: 0.5, grow: 1.7, fadeIn: 0.05, fadeOut: 0.55, groundClamp: true, shade: 0.45, turbF: 0.16, renderOrder: 101, nearFade: 1.5 });
    this.cloud = new BillboardPool(S, { name: 'cloud', frag: 'smoke', blend: 'premul', atlas: { tex: smoke, cols: 4, rows: 4 }, capacity: cap(720), drag: 0.1, grow: 1.5, fadeIn: 0.05, fadeOut: 0.3, orbit: true, shade: 0.5, growR: 0.7, squash: 0.7, renderOrder: 100, nearFade: 20 });
    this.fire = new BillboardPool(S, { name: 'fire', frag: 'fire', blend: 'add', atlas: { tex: fire, cols: 4, rows: 4 }, capacity: cap(1500), gravity: [0, 3.2, 0], drag: 1.2, grow: 1.4, turbF: 0.3, renderOrder: 103, nearFade: 1.5 });
    this.mist = new BillboardPool(S, { name: 'mist', frag: 'mist', blend: 'premul', atlas: { tex: mist, cols: 4, rows: 4 }, capacity: cap(1600), gravity: [0, 0.12, 0], drag: 0.6, grow: 1.25, fadeIn: 0.14, fadeOut: 0.5, heatAdd: 0.55, turbF: 0.35, renderOrder: 102, nearFade: 1.2, groundClamp: true });
    this.glow = new BillboardPool(S, { name: 'glow', frag: 'glow', blend: 'add', atlas: { tex: glow, cols: 2, rows: 2 }, capacity: cap(900), grow: 1, fadeIn: 0, fadeOut: 0, renderOrder: 105, nearFade: 0.8 });
    this.spark = new BillboardPool(S, { name: 'spark', frag: 'spark', blend: 'add', capacity: cap(2800), gravity: [0, -9.81, 0], drag: 0.3, bounce: 0.38, windK: 0, streak: true, heatAdd: 1, minPx: 1.5, renderOrder: 104, nearFade: 0.3 });
    this.pools = [this.smoke, this.cloud, this.fire, this.mist, this.glow, this.spark];
    this.rings = new RingPool(S, cap(120)); this.shells = new ShellPool(S, 24); this.decals = new DecalPool(S, 64); this.trails = new TrailPool(S, 32); this.bolts = new BoltPool(S, cap(1100));
    this.debrisPool = new DebrisPool(S, cap(280));
    this.meshPools = [this.rings, this.shells, this.decals, this.trails, this.bolts];
    for (const p of this.pools) { this.root.add(p.mesh); }
    for (const p of this.meshPools) { p.mesh.onBeforeRender = S.onBefore; this.root.add(p.mesh); }
    this.root.add(this.debrisPool.mesh);
    // event queue (delayed spawns), preallocated
    this.evs = []; for (let i = 0; i < 96; i++) this.evs.push({ used: false, when: 0, type: 0, x: 0, y: 0, z: 0, size: 1, seed: 0, kind: '', a: 0, b: 0 });
    this.em = []; this.fields = []; this.handlers = {};
    this.state = { flash: 0, flashColor: new THREE.Color(1, 1, 1), lightning: 0, shake: 0, lightPos: new THREE.Vector3(), lightColor: new THREE.Color(1, 0.6, 0.3), lightIntensity: 0, nukeFlash: 0 };
    this._flashes = []; for (let i = 0; i < 32; i++) this._flashes.push({ kind: 0, t0: -9, dur: 0, peak: 0, x: 0, y: 0, z: 0, r: 1, g: 1, b: 1, size: 1, shake: 0 });
    this._flashHead = 0;
    this.autoLight = opts.autoLight !== false; this._lastSync = -99; this._sunDir = new THREE.Vector3();
    if (opts.ground !== undefined) this.shared.uGround.value = typeof opts.ground === 'number' ? opts.ground : 0;
    if (opts.wind) this.shared.uWind.value.set(opts.wind[0] ?? 0, 0, opts.wind[1] ?? 0);
    if (opts.sunDir) this.setLighting({ sunDir: opts.sunDir, sunColor: opts.sunColor, ambient: opts.ambient });
    else if (opts.ambient || opts.sunColor) this.setLighting({ sunColor: opts.sunColor, ambient: opts.ambient });
    if (opts.attach !== false && scene) scene.add(this.root);
    this._disposed = false;
  }

  // ------------------------------------------------------------------ environment
  /** sunDir: direction TOWARD the light (world); sunColor/ambient: THREE.Color|[r,g,b]|hex — relative lighting for smoke albedo */
  setLighting({ sunDir, sunColor, ambient, auto = false } = {}) {
    const S = this.shared; this.autoLight = auto;
    if (sunDir) { if (Array.isArray(sunDir)) S.sunWorld.set(sunDir[0], sunDir[1], sunDir[2]); else S.sunWorld.copy(sunDir); S.sunWorld.normalize(); }
    const setc = (c, v) => { if (!v) return; if (Array.isArray(v)) c.setRGB(v[0], v[1], v[2]); else c.set(v); };
    setc(S.uSunColor.value, sunColor); setc(S.uAmbient.value, ambient);
    return this;
  }
  setGround(y) { this.shared.uGround.value = y; return this; }
  setWind(x, z) { this.shared.uWind.value.set(x, 0, z); return this; }
  /** read the scene's DirectionalLight/HemisphereLight once to tint smoke (auto every ~3 s unless setLighting was called) */
  syncLights() {
    let dl = null, hl = null;
    const walk = (o, depth) => { if (o.isDirectionalLight && (!dl || o.intensity > dl.intensity)) dl = o; else if (o.isHemisphereLight && !hl) hl = o; if (depth < 4) { const c = o.children; for (let i = 0; i < c.length && i < 400; i++) walk(c[i], depth + 1); } };
    walk(this.scene, 0);
    const S = this.shared;
    if (dl) { this._sunDir.setFromMatrixPosition(dl.matrixWorld); if (dl.target) { _v.setFromMatrixPosition(dl.target.matrixWorld); this._sunDir.sub(_v); } if (this._sunDir.lengthSq() > 1e-6) S.sunWorld.copy(this._sunDir).normalize(); const k = clamp(dl.intensity / 3, 0, 1.6); S.uSunColor.value.copy(dl.color).multiplyScalar(k); }
    if (hl) { const k = clamp(hl.intensity * 1.7, 0.05, 1.2); S.uAmbient.value.copy(hl.color).lerp(hl.groundColor, 0.35).multiplyScalar(k); }
    else if (dl) { S.uAmbient.value.setRGB(0.12, 0.14, 0.18); }
  }

  // ------------------------------------------------------------------ rng / seeds
  /** deterministic RNG for an effect: explicit seed (number|string) else call-order counter */
  rng(seed) { const s = typeof seed === 'string' ? hashStr(seed) : seed; this._rng.s = _hash(this.baseSeed * 7919 + 17, s === undefined ? ++this.counter : s) || 1; this._rng.next(); return this._rng; }
  /** fresh RNG instance (for low-frequency code that interleaves spawns) */
  newRng(seed) { return new RNG(_hash(this.baseSeed * 7919 + 17, typeof seed === 'string' ? hashStr(seed) : seed) || 1); }
  rngAt(seed, k) { this._rng.s = _hash(_hash(this.baseSeed, seed), k) || 1; this._rng.next(); return this._rng; }
  /** budget-scaled count (>=1) */
  n(count) { return Math.max(1, Math.round(count * Q.particles * this.budgetScale)); }
  /** adjust spawn budget at runtime (0.2..1.5), e.g. from createPerf level */
  setBudget(s) { this.budgetScale = clamp(s, 0.1, 2); return this; }

  // ------------------------------------------------------------------ events / queue
  on(name, cb) { (this.handlers[name] || (this.handlers[name] = [])).push(cb); return this; }
  emit(name, a, b, c, d) { const h = this.handlers[name]; if (h) for (let i = 0; i < h.length; i++) h[i](a, b, c, d); }
  queue(type, when, x, y, z, size, seed, kind, a = 0, b = 0) {
    for (let i = 0; i < this.evs.length; i++) { const e = this.evs[i]; if (!e.used) { e.used = true; e.when = when; e.type = type; e.x = x; e.y = y; e.z = z; e.size = size; e.seed = seed; e.kind = kind; e.a = a; e.b = b; return e; } }
    return null; // queue full: drop
  }
  _runQueue(t) {
    for (let i = 0; i < this.evs.length; i++) {
      const e = this.evs[i]; if (!e.used || e.when > t) continue; e.used = false;
      if (e.type === 1) EXP.spawnExplosion(this, e.x, e.y, e.z, e.size, e.kind, e.seed, e.when);
      else if (e.type === 2) MISC.impactAt(this, e.x, e.y, e.z, 0, 1, 0, e.kind, e.size, e.seed, e.when);
    }
  }
  /** register a screen/lighting flash (used by nuke/explosions/lightning): state.flash / state.lightIntensity derive from them */
  addFlash(t0, dur, peak, x, y, z, r, g, b, size, shake = 0, kind = 0) {
    const f = this._flashes[this._flashHead]; this._flashHead = (this._flashHead + 1) % this._flashes.length;
    f.kind = kind; f.t0 = t0; f.dur = dur; f.peak = peak; f.x = x; f.y = y; f.z = z; f.r = r; f.g = g; f.b = b; f.size = size; f.shake = shake;
  }
  _updateState(t) {
    const st = this.state; let best = 0, bi = -1, shake = 0, nf = 0, ln = 0;
    for (let i = 0; i < this._flashes.length; i++) {
      const f = this._flashes[i]; const a = (t - f.t0) / f.dur; if (a < 0 || a >= 1) continue;
      let v = f.peak * Math.pow(1 - a, 2.2);
      if (f.kind === 1) { const tt = t - f.t0; v = f.peak * (Math.exp(-tt * 14) + 0.7 * Math.exp(-Math.pow((tt - 0.11) * 22, 2)) + 0.5 * Math.exp(-Math.pow((tt - 0.2) * 20, 2))); if (v > ln) ln = v; }
      if (v > best) { best = v; bi = i; }
      if (f.shake > 0) shake = Math.max(shake, f.shake * Math.pow(1 - a, 1.5));
      if (f.size > 100) nf = Math.max(nf, Math.min(1, v));
    }
    st.lightIntensity = best; st.shake = shake; st.nukeFlash = nf; st.lightning = Math.min(1, ln);
    if (bi >= 0) { const f = this._flashes[bi]; st.lightPos.set(f.x, f.y, f.z); st.lightColor.setRGB(f.r, f.g, f.b); }
  }

  // ------------------------------------------------------------------ frame update
  update(dt, t) {
    if (this._disposed) return;
    if (t === undefined) t = this.time + dt;
    if (t < this.time - 0.02) this._rewind();
    this.time = t; this.shared.uTime.value = t;
    if (this.autoLight && t - this._lastSync > 3) { this._lastSync = t; this.syncLights(); }
    this._runQueue(t);
    for (let i = this.em.length - 1; i >= 0; i--) { const e = this.em[i]; if (e.dead) { this.em[i] = this.em[this.em.length - 1]; this.em.pop(); continue; } e.step(this, t, dt); }
    for (let i = this.fields.length - 1; i >= 0; i--) this.fields[i].update(this, t, dt);
    this._updateState(t);
    for (const p of this.pools) p.flush(t);
    for (const p of this.meshPools) p.flush(t);
    this.debrisPool.update(t);
    this.lastUpdateT = t;
  }
  _rewind() { // time went backwards (seek): drop everything transient
    this.clear({ weather: false });
  }
  /** remove all transient effects (and, unless {weather:false}, emitters/weather fields) */
  clear({ weather = true } = {}) {
    for (const p of this.pools) p.clear(); for (const p of this.meshPools) p.clear(); this.debrisPool.clear();
    for (const e of this.evs) e.used = false;
    for (const f of this._flashes) f.t0 = -99;
    if (weather) { for (const e of this.em) e.dead = true; this.em.length = 0; for (const f of this.fields) f.dispose(this); this.fields.length = 0; }
    else { for (const e of this.em) { if (e.transient) e.dead = true; } }
    this.state.lightIntensity = 0; this.state.shake = 0; this.state.nukeFlash = 0; this.state.lightning = 0;
  }
  /** compile every shader/pipeline once (call after scene setup, before the film starts, to avoid first-use hitches) */
  prewarm(renderer, camera) {
    const vis = []; for (const p of this.pools) { vis.push(p.mesh.visible); p.mesh.visible = true; } for (const p of this.meshPools) { vis.push(p.mesh.visible); p.mesh.visible = true; }
    const dv = this.debrisPool.mesh.visible; this.debrisPool.mesh.visible = true;
    try { renderer.compile(this.root, camera || new THREE.PerspectiveCamera()); } catch (e) { /* ignore */ }
    let k = 0; for (const p of this.pools) p.mesh.visible = vis[k++]; for (const p of this.meshPools) p.mesh.visible = vis[k++]; this.debrisPool.mesh.visible = dv;
  }
  stats() { let n = 0; for (const p of this.pools) n += p.high; return { particles: n, pools: this.pools.length + this.meshPools.length + 1, emitters: this.em.length, fields: this.fields.length }; }
  dispose() {
    if (this._disposed) return; this._disposed = true;
    for (const f of this.fields) f.dispose(this); for (const p of this.pools) p.dispose(); for (const p of this.meshPools) p.dispose(); this.debrisPool.dispose();
    if (this.root.parent) this.root.parent.remove(this.root);
  }

  // ------------------------------------------------------------------ contract API (recipes live in explosions.js / recipes.js / weather.js)
  explosion(pos, o = {}) { return EXP.explosion(this, pos, o); }
  nuke(pos, o = {}) { return EXP.nuke(this, pos, o); }
  reentry(from, to, o = {}) { return EXP.reentry(this, from, to, o); }
  smokeColumn(pos, o = {}) { return MISC.smokeColumn(this, pos, o); }
  fire(pos, o = {}) { return MISC.fire(this, pos, o); }
  sparks(pos, o = {}) { return MISC.sparks(this, pos, o); }
  dust(pos, o = {}) { return MISC.dust(this, pos, o); }
  debris(pos, o = {}) { return MISC.debrisBurst(this, pos, o); }
  muzzleFlash(pos, dir, o = {}) { return MISC.muzzleFlash(this, pos, dir, o); }
  tracer(from, to, o = {}) { return MISC.tracer(this, from, to, o); }
  impact(pos, normal, o = {}) { return MISC.impact(this, pos, normal, o); }
  shockwave(pos, o = {}) { return MISC.shockwave(this, pos, o); }
  scorch(pos, o = {}) { return MISC.scorch(this, pos, o); }
  sporeCloud(pos, o = {}) { return MISC.sporeCloud(this, pos, o); }
  coughPuff(pos, dir, o = {}) { return MISC.coughPuff(this, pos, dir, o); }
  infectPulse(pos, o = {}) { return MISC.infectPulse(this, pos, o); }
  engineGlow(pos, o = {}) { return MISC.engineGlow(this, pos, o); }
  smokeTrail(getter, o = {}) { return MISC.smokeTrail(this, getter, o); }
  rain(o = {}) { return WX.rain(this, o); }
  snow(o = {}) { return WX.snow(this, o); }
  embersField(o = {}) { return WX.embersField(this, o); }
  ashFall(o = {}) { return WX.ashFall(this, o); }
  lightning(from, to, o = {}) { return WX.lightning(this, from, to, o); }
  storm(o = {}) { return WX.storm(this, o); }
}
/** @returns {FX} */
export function createFX(scene, opts = {}) {
  return new FX(scene, opts);
}
export { FX as FXSystem };
