// FX recipes: continuous emitters (smoke columns, fire, spore clouds, trails, engine glows) and one-shot effects
// (sparks, dust, debris, muzzle flashes, tracers, impacts, shockwaves, scorch marks, infection pulses).
// Emitters are deterministic: particle k of an emitter is born at t0 + k/rate and is generated from rngAt(seed, k),
// so results never depend on the frame-rate or on update granularity.
import * as THREE from 'three';
import { Q, clamp } from '../engine/common.js';
import { px, py, pz, resolve, toColor, setP, glowSprite, dirHemi, dirSphere, G_SOFT, G_STAR, G_RING, TAU } from './util.js';
import { spawnDebris } from './explosions.js';

const _c = new THREE.Color(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();
const FIRE = [1.0, 0.42, 0.08];
const GREEN = [0.25, 0.9, 0.1];

// ------------------------------------------------------------------------------------------------ emitter infrastructure
class Emitter {
  constructor(fx, o, rate, maxLife, spawn) {
    this.fx = fx; this.t0 = o.t ?? fx.time; this.stopT = o.life !== undefined ? this.t0 + o.life : Infinity;
    this.rate = rate; this.k = 0; this.dead = false; this.seed = o.seed ?? ((++fx.counter) * 2654435 + 7); this.spawn = spawn; this.maxLife = maxLife;
    this.pos = new THREE.Vector3(); this.last = new THREE.Vector3(); this.cur = new THREE.Vector3(); this.lastT = this.t0; this.hasLast = false; this.transient = false; this.o = o; this.getter = null; this.track = false;
    fx.em.push(this);
  }
  stop() { this.stopT = Math.min(this.stopT, this.fx.time); return this; }
  step(fx, t) {
    if (this.getter) { resolve(this.getter, this.cur); if (!this.hasLast) { this.last.copy(this.cur); this.hasLast = true; } }
    const tEnd = Math.min(t, this.stopT);
    if (tEnd >= this.t0) {
      const kEnd = Math.floor((tEnd - this.t0) * this.rate); let k0 = this.k;
      const kMin = Math.floor((t - this.maxLife - this.t0) * this.rate); if (k0 < kMin) k0 = kMin;
      for (let k = k0; k <= kEnd; k++) this.spawn(fx, this, k, this.t0 + k / this.rate);
      if (kEnd + 1 > this.k) this.k = kEnd + 1;
    }
    if (this.getter || this.track) this.last.copy(this.cur);
    this.lastT = t;
    if (t >= this.stopT) this.dead = true;
  }
}

// ------------------------------------------------------------------------------------------------ smoke column
export function smokeColumn(fx, pos, o = {}) {
  const height = o.height ?? 40, width = o.width ?? 6; const plife = o.puffLife ?? clamp(height / 4, 6, 26);
  const soot = o.soot ?? 1; toColor(o.color, _c, [0.1, 0.095, 0.09]); const col = [_c.r, _c.g, _c.b];
  const vy = height / plife; const rate = (o.rate ?? clamp(vy / (width * 0.4), 2, 40)) * Math.max(0.3, Q.particles) * fx.budgetScale;
  const em = new Emitter(fx, o, rate, plife, (fx, e, k, te) => {
    const R = fx.rngAt(e.seed, k); const P = fx.P;
    const a = R.range(0, TAU), r = Math.sqrt(R.next()) * width * 0.18; const c = R.range(0.75, 1.25);
    setP(P, e.pos.x + Math.cos(a) * r, e.pos.y + width * 0.1, e.pos.z + Math.sin(a) * r, R.range(-0.4, 0.4), vy * R.range(0.85, 1.15), R.range(-0.4, 0.4), te, plife * R.range(0.85, 1.1), width * R.range(0.45, 0.7), width * R.range(1.8, 2.8));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.2, 0.2); P.r = col[0] * c * 1.05; P.g = col[1] * c; P.b = col[2] * c * 0.95; P.a = clamp(0.5 + 0.4 * soot, 0.2, 0.95) * R.range(0.8, 1);
    P.drag = 0; P.extra = 0; P.turb = width * 0.4; P.heat = o.heat ?? R.range(0.0, 0.5); P.heatDecay = 0.6;
    fx.smokePool.add(P);
  });
  em.pos.set(px(pos), py(pos), pz(pos));
  em.move = (p) => { em.pos.set(px(p), py(p), pz(p)); return em; };
  return em;
}

// ------------------------------------------------------------------------------------------------ fire (persistent flames + smoke wisps + embers + halo)
export function fire(fx, pos, o = {}) {
  const size = o.size ?? 2; const mid = toColor(o.color, _c, FIRE); const col = [mid.r, mid.g, mid.b];
  const rate = 16 * Math.sqrt(size) * Q.particles * fx.budgetScale + 3;
  const em = new Emitter(fx, o, rate, 1.5, (fx, e, k, te) => {
    const R = fx.rngAt(e.seed, k); const P = fx.P; const S = e.size;
    const a = R.range(0, TAU), r = Math.sqrt(R.next()) * S * 0.28;
    setP(P, e.pos.x + Math.cos(a) * r, e.pos.y + S * 0.12, e.pos.z + Math.sin(a) * r, R.range(-0.25, 0.25) * S, S * R.range(1.1, 2.1), R.range(-0.25, 0.25) * S, te, R.range(0.5, 0.95), S * R.range(0.5, 0.85), S * R.range(0.1, 0.3));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-1.5, 1.5); P.r = col[0]; P.g = col[1]; P.b = col[2]; P.a = R.range(1.0, 1.7); P.turb = S * 0.2; P.drag = R.range(0.9, 1.4); P.extra = 1 + 1.2 * S * 0.2;
    fx.firePool.add(P);
    if (k % 3 === 0 && o.smoke !== false) { // sooty wisps above the flame
      setP(P, e.pos.x + Math.cos(a) * r, e.pos.y + S * 0.9, e.pos.z + Math.sin(a) * r, R.range(-0.3, 0.3), S * R.range(0.6, 1.1), R.range(-0.3, 0.3), te + 0.2, R.range(3.5, 6.0), S * R.range(0.5, 0.8), S * R.range(1.8, 3.0));
      P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.2, 0.2); const c = R.range(0.07, 0.16); P.r = c * 1.05; P.g = c; P.b = c * 0.95; P.a = 0.55; P.turb = S * 0.5; P.heat = 0.25; P.heatDecay = 1.2; P.extra = 0.8; P.drag = 1.0;
      fx.smokePool.add(P);
    }
    if (k % 9 === 0 && o.embers !== false) {
      setP(P, e.pos.x + Math.cos(a) * r, e.pos.y + S * 0.5, e.pos.z + Math.sin(a) * r, R.range(-1.2, 1.2) * S * 0.5, S * R.range(1.5, 3.5), R.range(-1.2, 1.2) * S * 0.5, te, R.range(1.2, 2.8), 0.06 * Math.sqrt(S), 0.06 * Math.sqrt(S));
      P.stretch = 0.015; P.r = col[0] * 3.5; P.g = col[1] * 2.5; P.b = col[2] * 1.5; P.drag = 1.5; P.extra = 0.12; P.turb = 0.8;
      fx.sparkPool.add(P);
    }
  });
  em.size = size; em.pos.set(px(pos), py(pos), pz(pos));
  // flickering halo: one-frame glow sprite per update (life == dt so exactly one is visible)
  const halo = { step(fx2, t, dt) { if (em.dead || t < em.t0) return; const f = 0.8 + 0.2 * Math.sin(t * 17 + em.seed) * Math.sin(t * 7.3 + 1.3); const lf = Math.max(dt, 1e-3) * 0.999; glowSprite(fx2, em.pos.x, em.pos.y + em.size * 0.7, em.pos.z, t, lf, em.size * 6 * f, em.size * 6 * f, G_SOFT, col[0] * 0.55, col[1] * 0.42, col[2] * 0.3, 0); }, dead: false, transient: false };
  fx.em.push(halo); const stop0 = em.stop.bind(em);
  em.stop = () => { stop0(); halo.dead = true; return em; };
  em.move = (p) => { em.pos.set(px(p), py(p), pz(p)); return em; }; em.setSize = (s) => { em.size = s; return em; };
  return em;
}

// ------------------------------------------------------------------------------------------------ sparks / dust / debris
function cone(R, dir, spread, out) { // random direction within a cone around dir (spread 0..1 -> up to 90 deg)
  _u.copy(Math.abs(dir.y) < 0.95 ? _d.set(0, 1, 0) : _d.set(1, 0, 0)).cross(dir).normalize(); _w.copy(dir).cross(_u);
  const a = R.range(0, TAU), c = Math.pow(R.next(), 0.6) * spread * 1.5708, s = Math.sin(c);
  return out.copy(dir).multiplyScalar(Math.cos(c)).addScaledVector(_u, Math.cos(a) * s).addScaledVector(_w, Math.sin(a) * s);
}
export function sparks(fx, pos, o = {}) {
  const x = px(pos), y = py(pos), z = pz(pos), t0 = (o.t ?? fx.time) + (o.delay || 0); const R = fx.rng(o.seed); const P = fx.P;
  const dir = o.dir ? (o.dir.isVector3 ? _q.copy(o.dir) : _q.set(o.dir[0], o.dir[1], o.dir[2])) : _q.set(0, 1, 0); dir.normalize(); const dd = _p.copy(dir);
  const spread = o.spread ?? 0.6, speed = o.speed ?? 9, n = fx.n(o.count ?? 24); toColor(o.color, _c, [1.0, 0.72, 0.3]);
  for (let i = 0; i < n; i++) {
    cone(R, dd, spread, _d); const sp = speed * R.range(0.4, 1.4);
    setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.04), R.range(0.5, 1.4) * (o.life ?? 1), R.range(0.03, 0.06) * (o.width ?? 1), R.range(0.03, 0.06) * (o.width ?? 1));
    P.stretch = R.range(0.03, 0.055); const b = R.range(2.2, 4.2) * (o.intensity ?? 1); P.r = _c.r * b; P.g = _c.g * b; P.b = _c.b * b; P.rnd = R.next();
    fx.sparkPool.add(P);
  }
}
export function dust(fx, pos, o = {}) {
  const x = px(pos), y = py(pos), z = pz(pos), t0 = (o.t ?? fx.time) + (o.delay || 0), rad = o.radius ?? 3, amt = o.amount ?? 1; const R = fx.rng(o.seed); const P = fx.P;
  toColor(o.color, _c, [0.52, 0.45, 0.36]); const n = fx.n(14 * amt + 4);
  for (let i = 0; i < n; i++) {
    const a = R.range(0, TAU), r = Math.sqrt(R.next()) * rad * 0.5, sp = rad * R.range(0.25, 0.9); const c = R.range(0.8, 1.1);
    setP(P, x + Math.cos(a) * r, y + rad * 0.12, z + Math.sin(a) * r, Math.cos(a) * sp, rad * R.range(0.05, 0.4), Math.sin(a) * sp, t0 + R.range(0, 0.2), R.range(2.5, 4.5), rad * R.range(0.3, 0.55), rad * R.range(0.9, 1.5));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.3, 0.3); P.r = _c.r * c; P.g = _c.g * c; P.b = _c.b * c; P.a = (o.opacity ?? 0.55) * R.range(0.8, 1); P.drag = 2.4; P.extra = 0.5; P.turb = rad * 0.1;
    fx.smokePool.add(P);
  }
}
export function debrisBurst(fx, pos, o = {}) {
  const x = px(pos), y = py(pos), z = pz(pos), t0 = (o.t ?? fx.time) + (o.delay || 0); const R = fx.newRng(o.seed ?? ((++fx.counter) * 31 + 5));
  spawnDebris(fx, R, x, y, z, t0, o.count ?? 10, { power: o.power ?? 12, size: o.size ?? 0.2, upBias: o.upBias ?? 0.6, heat: o.heat ?? 0.2, tint: o.tint ?? [0.34, 0.32, 0.3], spread: 0.1 });
}

// ------------------------------------------------------------------------------------------------ muzzle flash / tracer / impact
export function muzzleFlash(fx, pos, dir, o = {}) {
  const x = px(pos), y = py(pos), z = pz(pos), t0 = (o.t ?? fx.time) + (o.delay || 0), S = o.size ?? 1; const R = fx.rng(o.seed); const P = fx.P;
  const dd = _q.set(px(dir), py(dir), pz(dir)).normalize(); toColor(o.color, _c, [1.0, 0.72, 0.32]); const cr = _c.r, cg = _c.g, cb = _c.b;
  const fxp = x + dd.x * S * 0.25, fyp = y + dd.y * S * 0.25, fzp = z + dd.z * S * 0.25;
  glowSprite(fx, fxp, fyp, fzp, t0, 0.075, S * 1.5, S * 2.0, G_STAR, cr * 4.5, cg * 4.5, cb * 4.5, 1.5, R.range(0, 6));
  glowSprite(fx, x, y, z, t0, 0.05, S * 0.9, S * 1.2, G_SOFT, cr * 5, cg * 4.5, cb * 4, 1.5);
  for (let i = 0; i < 3; i++) { // forward petals (static segments: tail = head - dir*len)
    cone(R, dd, 0.16, _d); const L = S * R.range(1.0, 1.9);
    setP(P, x, y, z, -_d.x * L, -_d.y * L, -_d.z * L, t0, 0.06, S * R.range(0.1, 0.17), S * 0.1); // head at p0+... tail at p0 + v (v = -dir*L) -> head is nozzle; flip so streak points forward
    P.x = x + _d.x * L; P.y = y + _d.y * L; P.z = z + _d.z * L; P.stretch = -1; P.r = cr * 3.6; P.g = cg * 2.8; P.b = cb * 1.7; P.extra = 0; P.drag = 0;
    fx.sparkPool.add(P);
  }
  const n = fx.n(5);
  for (let i = 0; i < n; i++) { cone(R, dd, 0.5, _d); const sp = R.range(10, 34) * Math.sqrt(S); setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, t0, R.range(0.2, 0.5), 0.025 * S, 0.025 * S); P.stretch = 0.03; P.r = cr * 4; P.g = cg * 3; P.b = cb * 2; fx.sparkPool.add(P); }
  setP(P, x + dd.x * S * 0.3, y + dd.y * S * 0.3, z + dd.z * S * 0.3, dd.x * 2.4, dd.y * 2.4 + 0.3, dd.z * 2.4, t0 + 0.02, R.range(1.0, 1.6), S * 0.25, S * R.range(0.9, 1.3));
  P.rnd = R.next(); P.rot = R.range(0, 6); P.r = 0.5; P.g = 0.48; P.b = 0.46; P.a = 0.22; P.heat = 0.5; P.heatDecay = 6; P.extra = 0.3; P.drag = 2.5; P.turb = 0.15;
  fx.smokePool.add(P);
}

export function tracer(fx, from, to, o = {}) {
  const ax = px(from), ay = py(from), az = pz(from), bx = px(to), by = py(to), bz = pz(to), t0 = (o.t ?? fx.time) + (o.delay || 0);
  const dx = bx - ax, dy = by - ay, dz = bz - az, dist = Math.hypot(dx, dy, dz) || 1, speed = o.speed ?? 380, len = o.length ?? 5; const P = fx.P;
  toColor(o.color, _c, [1.0, 0.72, 0.28]); const b = o.intensity ?? 5;
  const life = dist / speed; setP(P, ax, ay, az, dx / dist * speed, dy / dist * speed, dz / dist * speed, t0, life, o.width ?? 0.07, o.width ?? 0.07);
  P.stretch = len / speed; P.r = _c.r * b; P.g = _c.g * b; P.b = _c.b * b; P.drag = 0; P.extra = 0;
  fx.sparkPool.add(P);
  if (o.impact) fx.queue(2, t0 + life, bx, by, bz, o.impactSize ?? 1, ((++fx.counter) * 977) | 0, typeof o.impact === 'string' ? o.impact : 'ground');
}

export function impact(fx, pos, normal, o = {}) {
  const t0 = (o.t ?? fx.time) + (o.delay || 0);
  const nx = normal ? px(normal) : 0, ny = normal ? py(normal) : 1, nz = normal ? pz(normal) : 0;
  const run = () => impactAt(fx, px(pos), py(pos), pz(pos), nx, ny, nz, o.kind ?? 'ground', o.size ?? 1, o.seed ?? ((++fx.counter) * 541 + 9), t0);
  run();
}
export function impactAt(fx, x, y, z, nx, ny, nz, kind, S, seed, t0) {
  const R = fx.rng(seed), P = fx.P; const n3 = _q.set(nx, ny, nz); if (n3.lengthSq() < 1e-6) n3.set(0, 1, 0); n3.normalize(); const nn = _p.copy(n3);
  x += nn.x * 0.03; y += nn.y * 0.03; z += nn.z * 0.03;
  if (kind === 'ground') {
    const dn = fx.n(5);
    for (let i = 0; i < dn; i++) { cone(R, nn, 0.7, _d); const sp = R.range(1.5, 5) * S; setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.05), R.range(1.0, 2.0), S * R.range(0.5, 0.9), S * R.range(1.6, 2.6)); P.rnd = R.next(); P.rot = R.range(0, 6); P.rotVel = R.range(-0.5, 0.5); const c = R.range(0.8, 1.1); P.r = 0.5 * c; P.g = 0.43 * c; P.b = 0.34 * c; P.a = 0.5; P.drag = 2.2; P.extra = 0.3; fx.smokePool.add(P); }
    for (let i = 0; i < fx.n(5); i++) { cone(R, nn, 0.9, _d); const sp = R.range(3, 9) * S; setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, t0, R.range(0.7, 1.4), S * R.range(0.12, 0.22), S * R.range(0.25, 0.35)); P.rnd = R.next(); P.r = 0.25; P.g = 0.18; P.b = 0.12; P.a = 0.85; P.extra = -12; P.drag = 0.5; fx.smokePool.add(P); }
    sparksInline(fx, R, x, y, z, nn, 6, 5, 0.5, 1.0, 0.7, 0.3);
    return;
  }
  if (kind === 'metal') {
    glowSprite(fx, x, y, z, t0, 0.08, S * 0.7, S * 1.0, G_SOFT, 7, 6, 4.5, 1.6);
    glowSprite(fx, x, y, z, t0, 0.12, S * 1.4, S * 1.9, G_STAR, 3, 2.4, 1.6, 1.6, R.range(0, 6));
    sparksInline(fx, R, x, y, z, nn, 16, 12 * Math.sqrt(S), 0.55, 1.0, 0.78, 0.4);
    setP(P, x, y, z, nn.x * 0.8, nn.y * 0.8 + 0.4, nn.z * 0.8, t0 + 0.03, 1.2, S * 0.3, S * 1.0); P.rnd = R.next(); P.rot = R.range(0, 6); P.r = 0.4; P.g = 0.4; P.b = 0.4; P.a = 0.18; P.heat = 0.6; P.heatDecay = 5; P.extra = 0.3; fx.smokePool.add(P);
    return;
  }
  if (kind === 'flesh_green') {
    glowSprite(fx, x, y, z, t0, 0.18, S * 1.0, S * 1.5, G_SOFT, 0.8, 3.0, 0.4, 1.4);
    sparksInline(fx, R, x, y, z, nn, 18, 6 * Math.sqrt(S), 0.75, 0.35, 1.2, 0.18, 0.045, 1.2, true);
    for (let i = 0; i < fx.n(3); i++) { cone(R, nn, 0.6, _d); const sp = R.range(0.8, 2.2) * S; setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.05), R.range(0.9, 1.5), S * 0.3, S * R.range(0.9, 1.4)); P.rnd = R.next(); P.rot = R.range(0, 6); P.r = GREEN[0]; P.g = GREEN[1]; P.b = GREEN[2]; P.a = R.next(); P.extra = 0.1; fx.mistPool.add(P); }
    return;
  }
  // energy
  glowSprite(fx, x, y, z, t0, 0.16, S * 1.9, S * 2.4, G_STAR, 1.6, 4.0, 5.5, 1.8, R.range(0, 6), 0.3);
  glowSprite(fx, x, y, z, t0, 0.14, S * 1.0, S * 1.4, G_SOFT, 2.5, 5.5, 8, 1.8);
  fx.rings.add(x, y, z, 0, 0, 0, t0, 0.28, 0.05 * S, 1.5 * S, 0.1, 2.2, 0.4, 0.85, 1.0, R.next());
  sparksInline(fx, R, x, y, z, nn, 12, 10 * Math.sqrt(S), 0.8, 0.5, 1.2, 1.7);
  for (let i = 0; i < 2; i++) { setP(P, x + nn.x * 0.1, y + nn.y * 0.1, z + nn.z * 0.1, nn.x * S, nn.y * S, nn.z * S, t0, R.range(0.2, 0.35), S * 0.5, S * 0.9); P.rnd = R.next(); P.rot = R.range(0, 6); P.r = 0.12; P.g = 0.55; P.b = 1.0; P.a = 1.6; P.extra = 0; fx.firePool.add(P); }
}
function sparksInline(fx, R, x, y, z, nn, count, speed, spread, cr, cg, cb, width = 0.04, intensity = 1, grav = false) {
  const P = fx.P; const n = fx.n(count);
  for (let i = 0; i < n; i++) {
    cone(R, nn, spread, _d); const sp = speed * R.range(0.4, 1.3);
    setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, fx.time + R.range(0, 0.02), R.range(0.4, 1.1), width, width);
    P.stretch = R.range(0.025, 0.05); const b = R.range(2.2, 4.0) * intensity; P.r = cr * b; P.g = cg * b; P.b = cb * b; P.rnd = R.next(); fx.sparkPool.add(P);
  }
}

// ------------------------------------------------------------------------------------------------ shockwave / scorch
export function shockwave(fx, pos, o = {}) {
  const x = px(pos), y = py(pos), z = pz(pos), t0 = (o.t ?? fx.time) + (o.delay || 0), S = o.size ?? 10, speed = o.speed ?? S * 2; toColor(o.color, _c, [1.0, 0.88, 0.7]);
  const life = S / speed; const R = fx.rng(o.seed);
  const nx = o.normal ? px(o.normal) : 0, ny = o.normal ? py(o.normal) : 1, nz = o.normal ? pz(o.normal) : 0;
  fx.rings.add(x, y, z, o.billboard ? 0 : nx, o.billboard ? 0 : ny, o.billboard ? 0 : nz, t0, life, S * 0.04, S, o.thickness ?? 0.07, o.intensity ?? 1.6, _c.r, _c.g, _c.b, R.next());
  fx.rings.add(x, y, z, o.billboard ? 0 : nx, o.billboard ? 0 : ny, o.billboard ? 0 : nz, t0 + life * 0.06, life * 1.5, S * 0.03, S * 1.15, 0.04, 0.5, _c.r, _c.g, _c.b, R.next());
  if (o.dust) dust(fx, pos, { radius: S * 0.3, amount: 1.4, t: t0 });
}
export function scorch(fx, pos, o = {}) { const R = fx.rng(o.seed); fx.decals.add(px(pos), py(pos), pz(pos), (o.t ?? fx.time) + (o.delay || 0), o.life ?? 120, o.size ?? 4, R.range(0, TAU), o.opacity ?? 0.9); }

// ------------------------------------------------------------------------------------------------ infection: spores, cough, pulse
export function sporeCloud(fx, pos, o = {}) {
  const radius = o.radius ?? 3, density = o.density ?? 1; toColor(o.color, _c, GREEN); const col = [_c.r, _c.g, _c.b];
  const rate = clamp(4.5 * density * Math.pow(radius, 0.8), 2, 60) * Q.particles * fx.budgetScale + 2;
  const em = new Emitter(fx, o, rate, 6, (fx, e, k, te) => {
    const R = fx.rngAt(e.seed, k); const P = fx.P; const rad = e.radius;
    // position along the cloud's recent path (moves with the handle) inside a squashed sphere
    const f = clamp((te - e.lastT) / Math.max(1e-4, fx.time - e.lastT), 0, 1);
    const cx = e.last.x + (e.cur.x - e.last.x) * f, cy = e.last.y + (e.cur.y - e.last.y) * f, cz = e.last.z + (e.cur.z - e.last.z) * f;
    dirSphere(R, _d); const r = Math.cbrt(R.next()) * rad * 0.85;
    setP(P, cx + _d.x * r, cy + _d.y * r * 0.7 + rad * 0.3, cz + _d.z * r, R.range(-0.25, 0.25), R.range(0.02, 0.3), R.range(-0.25, 0.25), te, R.range(3.5, 5.5), rad * R.range(0.5, 0.8), rad * R.range(0.95, 1.4));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.35, 0.35); P.r = col[0]; P.g = col[1]; P.b = col[2]; P.a = R.next(); P.turb = rad * 0.35; P.drag = 1; P.extra = 0.6;
    fx.mistPool.add(P);
    if (k % 2 === 0) { // glowing spores
      dirSphere(R, _d); const r2 = Math.cbrt(R.next()) * rad * 1.05;
      setP(P, cx + _d.x * r2, cy + _d.y * r2 * 0.7 + rad * 0.3, cz + _d.z * r2, R.range(-0.3, 0.3), R.range(-0.1, 0.35), R.range(-0.3, 0.3), te, R.range(1.8, 3.6), 0.07 * Math.sqrt(rad) * R.range(0.6, 1.4), 0.07 * Math.sqrt(rad) * R.range(0.6, 1.4));
      P.frame = 0; P.r = col[0] * 3; P.g = col[1] * 3.4; P.b = col[2] * 3; P.a = 1.2; P.drag = 0; P.extra = 0;
      fx.glowPool.add(P);
    }
  });
  em.track = true; em.radius = radius; em.cur.set(px(pos), py(pos), pz(pos)); em.last.copy(em.cur); em.hasLast = true; em.pos.copy(em.cur);
  em.move = (p) => { em.cur.set(px(p), py(p), pz(p)); return em; };
  em.setRadius = (r) => { em.radius = r; return em; };
  // emitter's step() overwrites last=cur at the end of each frame: that is exactly what the path interpolation above expects
  return em;
}

export function coughPuff(fx, pos, dir, o = {}) {
  const x = px(pos), y = py(pos), z = pz(pos), t0 = (o.t ?? fx.time) + (o.delay || 0), S = o.size ?? 1; const R = fx.rng(o.seed); const P = fx.P;
  const dd = dir ? _q.set(px(dir), py(dir), pz(dir)).normalize() : _q.set(0, 0, 1); const d0 = _p.copy(dd); toColor(o.color, _c, GREEN);
  glowSprite(fx, x, y, z, t0, 0.2, S * 0.4, S * 0.7, G_SOFT, _c.r * 2.5, _c.g * 3, _c.b * 2.5, 1.6);
  const n = fx.n(10);
  for (let i = 0; i < n; i++) { cone(R, d0, 0.38, _d); const sp = R.range(1.4, 4.2) * S; setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.12), R.range(1.5, 2.4), S * R.range(0.12, 0.2), S * R.range(0.55, 0.9)); P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.6, 0.6); P.r = _c.r; P.g = _c.g; P.b = _c.b; P.a = R.next(); P.drag = 1.8; P.extra = 0.4; P.turb = 0.15 * S; fx.mistPool.add(P); }
  const m = fx.n(10);
  for (let i = 0; i < m; i++) { cone(R, d0, 0.5, _d); const sp = R.range(2.5, 7) * S; setP(P, x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, t0, R.range(0.4, 0.9), 0.022 * S, 0.022 * S); P.stretch = 0.03; P.r = _c.r * 2; P.g = _c.g * 3.4; P.b = _c.b * 2; P.drag = 1.5; P.extra = 1; fx.sparkPool.add(P); }
}

export function infectPulse(fx, pos, o = {}) {
  const x = px(pos), y = py(pos), z = pz(pos), t0 = (o.t ?? fx.time) + (o.delay || 0), Rr = o.radius ?? 6; toColor(o.color, _c, GREEN); const R = fx.rng(o.seed); const P = fx.P;
  fx.rings.add(x, y, z, 0, 1, 0, t0, 1.35, 0.05 * Rr, Rr, 0.06, 2.3, _c.r, _c.g * 1.1, _c.b, R.next());
  fx.rings.add(x, y, z, 0, 1, 0, t0 + 0.18, 1.5, 0.05 * Rr, Rr * 0.85, 0.04, 1.2, _c.r, _c.g, _c.b, R.next());
  fx.rings.add(x, y + Rr * 0.04, z, 0, 0, 0, t0, 1.1, 0.04 * Rr, Rr * 0.9, 0.05, 1.4, _c.r, _c.g, _c.b, R.next());
  fx.shells.add(x, y, z, t0, 1.0, 0.05 * Rr, Rr * 0.8, 1.4, _c.r, _c.g, _c.b, 2.4, R.next() * 10, 1.9, 0.8);
  glowSprite(fx, x, y, z, t0, 0.7, Rr * 1.4, Rr * 2.2, G_SOFT, _c.r * 2, _c.g * 2.8, _c.b * 2, 2.0);
  const n = fx.n(16);
  for (let i = 0; i < n; i++) { dirSphere(R, _d); const sp = Rr * R.range(0.5, 1.2); setP(P, x, y, z, _d.x * sp, Math.abs(_d.y) * sp * 0.6, _d.z * sp, t0 + R.range(0, 0.15), R.range(1.0, 2.0), 0.08 * Math.sqrt(Rr), 0.08 * Math.sqrt(Rr)); P.frame = 0; P.r = _c.r * 3; P.g = _c.g * 3.4; P.b = _c.b * 3; P.a = 1.0; P.drag = 1.5; P.extra = 0; fx.glowPool.add(P); }
}

// ------------------------------------------------------------------------------------------------ engine glow
export function engineGlow(fx, pos, o = {}) {
  const h = { dead: false, transient: false, size: o.size ?? 1, intensity: o.intensity ?? 1, flicker: o.flicker ?? 0.15, getter: (pos && (typeof pos === 'function' || pos.isObject3D || pos.root)) ? pos : null, pos: new THREE.Vector3(), color: new THREE.Color(), dir: new THREE.Vector3(), length: o.length ?? 0, t0: o.t ?? fx.time, seed: (++fx.counter) * 13, stopT: Infinity };
  if (!h.getter) h.pos.set(px(pos), py(pos), pz(pos)); toColor(o.color, h.color, [0.4, 0.7, 1.0]);
  if (o.dir) h.dir.set(px(o.dir), py(o.dir), pz(o.dir)).normalize(); else h.dir.set(0, 0, -1);
  h.step = (fx2, t, dt) => {
    if (h.dead) return; if (t >= h.stopT) { h.dead = true; return; }
    if (h.getter) resolve(h.getter, h.pos);
    const lf = Math.max(dt, 1e-3) * 0.999; const f = 1 + h.flicker * (Math.sin(t * 43 + h.seed) * 0.5 + Math.sin(t * 17.3 + h.seed * 1.7) * 0.5);
    const S = h.size * f, c = h.color, I = h.intensity;
    glowSprite(fx2, h.pos.x, h.pos.y, h.pos.z, t, lf, S * 2.4, S * 2.4, G_SOFT, c.r * 1.5 * I, c.g * 1.5 * I, c.b * 1.5 * I, 0);
    glowSprite(fx2, h.pos.x, h.pos.y, h.pos.z, t, lf, S * 0.8, S * 0.8, G_SOFT, 2.4 * I, 2.4 * I, 2.4 * I, 0);
    if (h.length > 0) { const P = fx2.P; setP(P, h.pos.x, h.pos.y, h.pos.z, h.dir.x * h.length * f, h.dir.y * h.length * f, h.dir.z * h.length * f, t, lf, S * 0.7, S * 0.7); P.stretch = -1; P.r = c.r * 2.2 * I; P.g = c.g * 2.2 * I; P.b = c.b * 2.2 * I; P.extra = 0; fx2.sparkPool.add(P); }
  };
  h.move = (p) => { h.pos.set(px(p), py(p), pz(p)); return h; }; h.setSize = (s) => { h.size = s; return h; }; h.setColor = (c) => { toColor(c, h.color); return h; }; h.setIntensity = (v) => { h.intensity = v; return h; }; h.setDir = (d) => { h.dir.set(px(d), py(d), pz(d)).normalize(); return h; };
  h.stop = () => { h.stopT = fx.time; return h; };
  fx.em.push(h);
  return h;
}

// ------------------------------------------------------------------------------------------------ smoke trail for missiles / falling wrecks
export function smokeTrail(fx, getter, o = {}) {
  const size = o.size ?? 1.2, plife = o.life ?? 6, rate = (o.rate ?? 45) * Q.particles * fx.budgetScale + 4; toColor(o.color, _c, [0.42, 0.40, 0.38]); const col = [_c.r, _c.g, _c.b]; const hot = !!o.fire;
  const em = new Emitter(fx, o, rate, plife, (fx, e, k, te) => {
    const R = fx.rngAt(e.seed, k); const P = fx.P;
    const f = clamp((te - e.lastT) / Math.max(1e-4, fx.time - e.lastT), 0, 1);
    const x = e.last.x + (e.cur.x - e.last.x) * f, y = e.last.y + (e.cur.y - e.last.y) * f, z = e.last.z + (e.cur.z - e.last.z) * f;
    const dt_ = Math.max(1e-4, fx.time - e.lastT); const vx = (e.cur.x - e.last.x) / dt_, vy = (e.cur.y - e.last.y) / dt_, vz = (e.cur.z - e.last.z) / dt_; const inh = o.inherit ?? 0.04;
    dirSphere(R, _d); const spr = (o.spread ?? 0.35) * size; const c = R.range(0.8, 1.2);
    setP(P, x + _d.x * size * 0.15, y + _d.y * size * 0.15, z + _d.z * size * 0.15, _d.x * spr + vx * inh, _d.y * spr + vy * inh + (o.rise ?? 0.5), _d.z * spr + vz * inh, te, plife * R.range(0.8, 1.15), size * R.range(0.5, 0.8), size * R.range(2.2, 3.6));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.25, 0.25); P.r = col[0] * c * 1.05; P.g = col[1] * c; P.b = col[2] * c * 0.95; P.a = o.opacity ?? 0.6; P.heat = hot ? 1.0 : (o.heat ?? 0.15); P.heatDecay = hot ? 2.5 : 3; P.drag = 1.1; P.extra = 0.3; P.turb = size * 0.35;
    fx.smokePool.add(P);
    if (hot && (k & 1) === 0) { // flame core
      setP(P, x, y, z, vx * inh * 0.5, vy * inh * 0.5 + 0.5, vz * inh * 0.5, te, R.range(0.35, 0.6), size * R.range(0.8, 1.2), size * R.range(0.3, 0.5)); P.rnd = R.next(); P.rot = R.range(0, 6); P.rotVel = R.range(-1, 1); P.r = FIRE[0]; P.g = FIRE[1]; P.b = FIRE[2]; P.a = R.range(1.2, 1.8); P.extra = 0.4; P.turb = size * 0.2; P.drag = 1.5;
      fx.firePool.add(P);
    }
  });
  em.getter = getter; resolve(getter, em.cur); em.last.copy(em.cur); em.hasLast = true; em.lastT = fx.time;
  em.setRate = (r) => { em.rate = r; return em; };
  return em;
}
