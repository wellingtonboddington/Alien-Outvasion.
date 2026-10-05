// Explosions (6 kinds), nuclear detonations (space + atmosphere) and reentry / comet streaks.
import * as THREE from 'three';
import { Q } from '../engine/common.js';
import { px, py, pz, setP, glowSprite, dirHemi, dirSphere, G_SOFT, G_STAR, G_RING, TAU } from './util.js';

const FIRE = [1.0, 0.42, 0.08];
const _d = new THREE.Vector3(), _a = new THREE.Vector3();

// ------------------------------------------------------------------------------------------------ debris helper (shared with recipes.js)
/** chunks of rock/concrete/metal. color: 0xrrggbb or [r,g,b] palette handled by caller via `tint` */
export function spawnDebris(fx, R, x, y, z, t0, count, { power = 20, size = 0.25, upBias = 0.5, heat = 0.6, spread = 0.2, life = [4, 8], tint = [0.16, 0.15, 0.14], dirt = false } = {}) {
  const pool = fx.debrisPool; const n = Math.max(1, Math.round(count * Math.max(0.3, Q.particles)));
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    dirHemi(R, _d, upBias, 0.02);
    const sp = power * R.range(0.35, 1.0);
    const s = size * R.range(0.35, 1.0);
    const k = R.range(0.7, 1.15);
    col.setRGB(tint[0] * k * R.range(0.6, 1.1), tint[1] * k * R.range(0.6, 1.1), tint[2] * k * R.range(0.6, 1.1));
    _a.set(R.range(-1, 1), R.range(-1, 1), R.range(-1, 1)).normalize();
    pool.add(x + _d.x * spread * size * 8, y + _d.y * 0.3, z + _d.z * spread * size * 8, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.05), R.range(life[0], life[1]),
      s * R.range(0.7, 1.6), s * R.range(0.5, 1.2), s * R.range(0.7, 1.5), R.range(2, 12) * R.sign(), _a.x, _a.y, _a.z, heat * R.range(0.3, 1), R.range(1.4, 2.6), 0.34, col);
  }
}

// ------------------------------------------------------------------------------------------------ explosion
function sootColor(R, lo = 0.09, hi = 0.24) { return R.range(lo, hi); }

export function explosion(fx, pos, o = {}) {
  const size = o.size ?? 10, kind = o.kind ?? 'fireball';
  const x = px(pos), y = py(pos), z = pz(pos);
  const when = (o.t ?? fx.time) + (o.delay || 0);
  const seed = o.seed ?? ((++fx.counter) * 7919 + 3);
  if (kind === 'chain') {
    const R = fx.newRng(seed); const m = 5 + Math.floor(R.range(0, 4)); let tt = when; const S = size;
    for (let i = 0; i < m; i++) {
      const last = i === m - 1; const a = R.range(0, TAU), d = Math.sqrt(R.next()) * S * 1.4 * (last ? 0.3 : 1);
      const kd = last ? 'big' : R.chance(0.35) ? 'air' : 'fireball'; const sz = last ? S : S * R.range(0.45, 0.85);
      const yy = kd === 'air' ? y + R.range(1, S * 0.9) : y;
      const sd = seed * 31 + i * 101;
      if (tt <= fx.time + 1e-6) spawnExplosion(fx, x + Math.cos(a) * d, yy, z + Math.sin(a) * d, sz, kd, sd, tt);
      else fx.queue(1, tt, x + Math.cos(a) * d, yy, z + Math.sin(a) * d, sz, sd, kd);
      tt += R.range(0.1, 0.4);
    }
    return;
  }
  if (when <= fx.time + 1e-6) spawnExplosion(fx, x, y, z, size, kind, seed, when);
  else fx.queue(1, when, x, y, z, size, seed, kind);
}

export function spawnExplosion(fx, x, y, z, S, kind, seed, t0) {
  const R = fx.rng(seed), P = fx.P;
  fx.emit('explosion', x, y, z, S, kind, t0);
  const k = Math.sqrt(S / 10);                // bigger = slower
  const air = kind === 'air', ground = kind === 'ground', big = kind === 'big', laser = kind === 'laser';
  const cy = air ? y : y + S * (ground ? 0.1 : 0.22);
  const gy = y;
  const sc = S / 10;
  // ---- light / flash state for the director
  if (laser) fx.addFlash(t0, 0.35 * k, 0.9, x, cy, z, 0.4, 0.8, 1.0, S, 0);
  else fx.addFlash(t0, (big ? 1.4 : 0.8) * k, big ? 1.6 : 1.0, x, cy, z, 1.0, 0.62, 0.3, S, Math.min(1, S / 28));

  // ---- flash + flare
  if (laser) {
    glowSprite(fx, x, cy, z, t0, 0.2 * k, S * 2.4, S * 3.4, G_SOFT, 3.2, 6.5, 9.0, 2.2);
    glowSprite(fx, x, cy, z, t0, 0.3 * k, S * 4.0, S * 5.0, G_STAR, 0.9, 2.6, 4.0, 2.0, R.range(0, 6), 0.4);
  } else {
    glowSprite(fx, x, cy, z, t0, 0.17 * k, S * (big ? 4.2 : 3.0), S * (big ? 5.5 : 4.2), G_SOFT, 8.5, 6.2, 3.6, 2.2);
    glowSprite(fx, x, cy, z, t0, 0.32 * k, S * (big ? 5 : 3.4), S * (big ? 9 : 6.5), G_STAR, 3.2, 2.0, 1.0, 2.0, R.range(0, 6), 0.35);
    glowSprite(fx, x, cy, z, t0, 0.9 * k, S * 1.8, S * 2.6, G_SOFT, 1.1, 0.45, 0.15, 1.6); // lingering orange glow
  }

  // ---- fireball puffs (additive, temperature-ramped)
  const fireN = fx.n(laser ? 16 : big ? 44 : air ? 30 : ground ? 12 : 24);
  const fscale = laser ? 0.7 : ground ? 0.65 : 1;
  const fireCol = laser ? [0.12, 0.55, 1.0] : FIRE;
  for (let i = 0; i < fireN; i++) {
    if (air || laser) dirSphere(R, _d); else dirHemi(R, _d, 0.15);
    const r = R.range(0.04, 0.2) * S * fscale, sp = R.range(0.25, 0.8) * S * fscale * (big ? 1.25 : 1);
    setP(P, x + _d.x * r, cy + _d.y * r * 0.8, z + _d.z * r, _d.x * sp, _d.y * sp + (air || laser ? 0 : S * 0.3), _d.z * sp, t0 + R.range(0, 0.09) * k, R.range(0.7, 1.5) * k * (laser ? 0.6 : 1),
      R.range(0.35, 0.6) * S * fscale, R.range(0.9, 1.55) * S * fscale * (big ? 1.2 : 1));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.8, 0.8); P.r = fireCol[0]; P.g = fireCol[1]; P.b = fireCol[2]; P.a = R.range(0.85, 1.35);
    P.turb = 0.08 * S; P.extra = air || laser ? 0.0 : sc; P.drag = R.range(0.8, 1.3);
    fx.firePool.add(P);
  }
  if (big) { // secondary rising fireball
    const n2 = fx.n(22);
    for (let i = 0; i < n2; i++) {
      const dl = R.range(0.15, 0.75) * k; dirHemi(R, _d, 0.7);
      setP(P, x + R.range(-0.15, 0.15) * S, cy + R.range(0, 0.3) * S, z + R.range(-0.15, 0.15) * S, _d.x * S * 0.2, S * R.range(0.4, 1.0), _d.z * S * 0.2, t0 + dl, R.range(0.9, 1.7) * k, R.range(0.5, 0.8) * S, R.range(1.0, 1.6) * S);
      P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.5, 0.5); P.r = FIRE[0]; P.g = 0.36; P.b = 0.06; P.a = R.range(1.0, 1.5); P.turb = 0.1 * S; P.extra = sc * 1.3; P.drag = 1.1;
      fx.firePool.add(P);
    }
  }

  // ---- hot cinder smoke (glows orange, then goes dark)
  if (!laser) {
    const cn = fx.n(big ? 22 : 12);
    for (let i = 0; i < cn; i++) {
      if (air) dirSphere(R, _d); else dirHemi(R, _d, 0.25);
      const sp = R.range(0.15, 0.5) * S;
      const c = sootColor(R, 0.1, 0.2);
      setP(P, x + _d.x * S * 0.1, cy + _d.y * S * 0.1, z + _d.z * S * 0.1, _d.x * sp, _d.y * sp + S * 0.3, _d.z * sp, t0 + R.range(0, 0.15) * k, R.range(2.5, 4.5) * k, R.range(0.4, 0.7) * S, R.range(1.1, 1.8) * S);
      P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.3, 0.3); P.r = c * 1.1; P.g = c * 1.0; P.b = c * 0.95; P.a = 0.82; P.heat = R.range(0.5, 0.95); P.heatDecay = 1.7 / k; P.turb = 0.1 * S; P.extra = sc * (air ? 0.3 : 1);
      fx.smokePool.add(P);
    }
  }

  // ---- main smoke
  const smokeN = fx.n(laser ? 8 : big ? 70 : air ? 34 : ground ? 20 : 34);
  const sSize = laser ? 0.45 : 1;
  for (let i = 0; i < smokeN; i++) {
    const delay = R.range(0, laser ? 0.3 : big ? 3.2 : 0.9) * k;
    const c = sootColor(R, laser ? 0.2 : 0.09, laser ? 0.34 : 0.26);
    let vx, vy, vz;
    if (air) { dirSphere(R, _d); const sp = R.range(0.2, 0.8) * S; vx = _d.x * sp; vy = _d.y * sp + S * 0.25; vz = _d.z * sp; }
    else { vx = R.range(-0.25, 0.25) * S; vz = R.range(-0.25, 0.25) * S; vy = S * R.range(0.25, big ? 1.25 : 0.85); }
    setP(P, x + R.gauss() * 0.12 * S, cy + R.range(0, big ? 0.7 : 0.4) * S, z + R.gauss() * 0.12 * S, vx, vy, vz, t0 + delay, R.range(5, 9) * k * (laser ? 0.5 : 1),
      R.range(0.5, 0.9) * S * sSize, R.range(1.5, 2.6) * S * sSize * (big ? 1.2 : 1));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.15, 0.15); P.r = c * 1.08; P.g = c; P.b = c * 0.94; P.a = R.range(0.8, 0.95);
    P.heat = delay < 0.5 ? R.range(0.1, 0.6) : 0; P.heatDecay = 0.8 / k; P.turb = 0.12 * S; P.extra = sc * R.range(0.7, 1.2) * (air ? 0.4 : 1); P.drag = R.range(0.7, 1.3);
    fx.smokePool.add(P);
  }

  // ---- ground-only: dust ring, dirt, shock ring, scorch
  if (!air) {
    const dn = fx.n(laser ? 6 : ground ? 30 : 20);
    for (let i = 0; i < dn; i++) {
      const a = (i / dn) * TAU + R.range(-0.2, 0.2), sp = S * R.range(0.8, 1.6) * (ground ? 1.3 : 1) * (laser ? 0.5 : 1);
      const c = R.range(0.8, 1.1);
      setP(P, x + Math.cos(a) * 0.15 * S, gy + 0.1 * S, z + Math.sin(a) * 0.15 * S, Math.cos(a) * sp, S * R.range(0.0, 0.12), Math.sin(a) * sp, t0 + R.range(0, 0.06), R.range(2.2, 3.8) * k, R.range(0.25, 0.4) * S * (laser ? 0.6 : 1), R.range(0.8, 1.3) * S * (laser ? 0.6 : 1));
      P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.4, 0.4); P.r = 0.5 * c; P.g = 0.43 * c; P.b = 0.34 * c; P.a = 0.5; P.drag = 3.2; P.extra = 0.2; P.turb = 0.05 * S;
      fx.smokePool.add(P);
    }
    if (ground || big) { // dirt clods thrown up + dust column
      const cn = fx.n(ground ? 26 : 12);
      for (let i = 0; i < cn; i++) {
        dirHemi(R, _d, 0.75); const sp = S * R.range(0.8, ground ? 2.2 : 1.6);
        setP(P, x + _d.x * 0.1 * S, gy + 0.1 * S, z + _d.z * 0.1 * S, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.1), R.range(2.0, 4.0) * k, R.range(0.3, 0.55) * S, R.range(0.8, 1.2) * S);
        P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.5, 0.5); const c = R.range(0.8, 1.2);
        P.r = 0.27 * c; P.g = 0.2 * c; P.b = 0.14 * c; P.a = 0.9; P.extra = -11; P.drag = 0.9; P.turb = 0.06 * S;
        fx.smokePool.add(P);
      }
    }
    fx.rings.add(x, gy, z, 0, 1, 0, t0, (laser ? 0.35 : 0.6) * k, 0.12 * S, (laser ? 1.3 : big ? 3.4 : 2.6) * S, 0.06, laser ? 1.6 : 0.85, laser ? 0.4 : 1.0, laser ? 0.85 : 0.86, laser ? 1.0 : 0.7, R.next());
    if (!laser) fx.rings.add(x, gy, z, 0, 1, 0, t0 + 0.05 * k, 0.9 * k, 0.1 * S, (big ? 4.4 : 3.2) * S, 0.04, 0.3, 1.0, 0.9, 0.78, R.next());
    fx.decals.add(x, gy, z, t0 + 0.03, 90, S * (laser ? 1.1 : big ? 2.4 : ground ? 1.8 : 1.7), R.range(0, TAU), laser ? 0.7 : 0.9);
  } else { // airburst: spherical shock
    fx.shells.add(x, cy, z, t0, 0.65 * k, 0.15 * S, 2.6 * S, 1.3, 1.0, 0.8, 0.55, 3.2, R.next() * 10, 1.8, 0.5);
    fx.rings.add(x, cy, z, 0, 0, 0, t0, 0.7 * k, 0.12 * S, 3.0 * S, 0.06, 1.6, 1.0, 0.85, 0.65, R.next());
  }
  if (big) fx.shells.add(x, cy, z, t0, 0.8 * k, 0.2 * S, 3.2 * S, 0.8, 1.0, 0.82, 0.6, 3.5, R.next() * 10, 1.8, 0.5);
  if (laser) fx.rings.add(x, cy, z, 0, 0, 0, t0, 0.3 * k, 0.1 * S, 1.6 * S, 0.07, 2.2, 0.5, 0.9, 1.0, R.next());

  // ---- sparks + embers
  const sn = fx.n(laser ? 34 : big ? 90 : 46);
  const wid = Math.sqrt(sc);
  for (let i = 0; i < sn; i++) {
    if (air || laser) dirSphere(R, _d); else dirHemi(R, _d, 0.35);
    const sp = S * R.range(1.0, laser ? 3.0 : 3.5);
    const warm = R.next();
    setP(P, x + _d.x * S * 0.1, cy + _d.y * S * 0.1, z + _d.z * S * 0.1, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.05), R.range(0.7, 1.9) * Math.sqrt(k), R.range(0.05, 0.1) * wid, R.range(0.05, 0.1) * wid);
    P.stretch = R.range(0.035, 0.06); P.rnd = R.next(); const b = R.range(2.2, 4.5);
    if (laser) { P.r = 0.8 * b * 0.5; P.g = 1.4 * b * 0.5; P.b = 2.0 * b * 0.5; } else { P.r = b; P.g = b * (0.55 + 0.25 * warm); P.b = b * (0.2 + 0.2 * warm); }
    P.drag = 1; P.extra = air ? 0.8 : 1;
    fx.sparkPool.add(P);
  }
  if (!laser) {
    const en = fx.n(big ? 24 : 12);
    for (let i = 0; i < en; i++) {
      dirHemi(R, _d, 0.6); const sp = S * R.range(0.2, 0.9);
      setP(P, x, cy, z, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.4), R.range(2.0, 4.5), R.range(0.06, 0.11) * wid, R.range(0.06, 0.11) * wid);
      P.stretch = 0.012; P.rnd = R.next(); P.r = 3.2; P.g = 1.2; P.b = 0.3; P.drag = 2.0; P.extra = 0.3; P.turb = 0.6;
      fx.sparkPool.add(P);
    }
  }

  // ---- debris chunks
  fx.rng(seed + 977);
  const rr = fx._rng;
  spawnDebris(fx, rr, x, laser ? cy : gy + 0.2 * S * (ground ? 0.2 : 1), z, t0, laser ? 6 : ground ? 30 : big ? 40 : 20,
    { power: S * (ground ? 2.4 : 2.0) * (laser ? 0.6 : 1), size: 0.034 * S * (big ? 1.3 : 1), upBias: ground ? 0.7 : 0.45, heat: laser ? 1 : 0.7, dirt: ground, tint: ground ? [0.14, 0.1, 0.07] : [0.16, 0.15, 0.14], spread: 0.15 });

  if (big) { // chain of secondary flashes around the main blast
    for (let i = 0; i < 3; i++) {
      const a = R.range(0, TAU), d = R.range(0.5, 1.4) * S;
      fx.queue(1, t0 + R.range(0.25, 1.1) * k, x + Math.cos(a) * d, y, z + Math.sin(a) * d, S * R.range(0.28, 0.45), seed * 13 + i * 17, 'fireball');
    }
  }
}

// ------------------------------------------------------------------------------------------------ nuke
export function nuke(fx, pos, o = {}) {
  const S = o.size ?? (o.inSpace ? 300 : 260), space = !!o.inSpace;
  const x = px(pos), y = py(pos), z = pz(pos);
  const t0 = (o.t ?? fx.time) + (o.delay || 0);
  const seed = o.seed ?? ((++fx.counter) * 104729 + 11);
  const R = fx.rng(seed), P = fx.P; const sc = S / 10;
  fx.emit('nuke', x, y, z, S, space, t0);
  fx.addFlash(t0, space ? 4.5 : 6.0, 1.0, x, y + (space ? 0 : S * 0.4), z, 1.0, 0.9, 0.8, S * 10, 1);
  const gy = y;
  if (space) {
    const cy = y;
    // blinding flash + flares + afterglow
    glowSprite(fx, x, cy, z, t0, 1.0, S * 6, S * 10, G_SOFT, 10, 10, 9.5, 2.8);
    glowSprite(fx, x, cy, z, t0, 1.6, S * 14, S * 20, G_STAR, 5, 6, 8, 2.2, R.range(0, 6), 0.05);
    glowSprite(fx, x, cy, z, t0, 6.0, S * 5, S * 14, G_SOFT, 0.9, 1.1, 1.8, 1.4);
    glowSprite(fx, x, cy, z, t0 + 0.5, 12.0, S * 2.5, S * 3.4, G_SOFT, 1.1, 0.5, 0.2, 1.6);
    glowSprite(fx, x, cy, z, t0, 2.6, S * 12, S * 34, G_RING, 0.9, 1.2, 1.7, 1.5);
    // plasma core puffs: vacuum, no gravity, coasting
    const n = fx.n(46);
    for (let i = 0; i < n; i++) {
      dirSphere(R, _d); const r = R.range(0.02, 0.25) * S, sp = R.range(0.15, 0.7) * S;
      setP(P, x + _d.x * r, cy + _d.y * r, z + _d.z * r, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.15), R.range(1.8, 4.2), R.range(0.5, 0.9) * S, R.range(1.2, 2.4) * S);
      P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.6, 0.6); P.drag = 0.35; P.extra = 0; P.turb = 0.15 * S;
      if (R.chance(0.7)) { P.r = 0.35; P.g = 0.62; P.b = 1.0; } else { P.r = 1.0; P.g = 0.5; P.b = 0.22; } P.a = R.range(1.4, 2.4);
      fx.firePool.add(P);
    }
    // radial streaks (X-ray spikes)
    const sn = fx.n(70);
    for (let i = 0; i < sn; i++) {
      dirSphere(R, _d); const sp = S * R.range(1.2, 4.2);
      setP(P, x, cy, z, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.1), R.range(1.2, 3.2), S * R.range(0.012, 0.035), S * R.range(0.012, 0.035));
      P.stretch = R.range(0.12, 0.3); P.extra = 0; P.drag = 0.15; const b = R.range(2.5, 6); P.r = b * 0.75; P.g = b * 0.92; P.b = b;
      fx.sparkPool.add(P);
    }
    // fresnel shells: bright fast blast front + violet slow plasma shell
    fx.shells.add(x, cy, z, t0, 6.5, 0.05 * S, 2.8 * S, 1.5, 0.55, 0.78, 1.0, 2.2, R.next() * 10, 2.0, 0.85);
    fx.shells.add(x, cy, z, t0, 3.2, 0.05 * S, 1.7 * S, 1.6, 1.0, 1.0, 1.0, 3.6, R.next() * 10, 2.4, 0.6);
    fx.shells.add(x, cy, z, t0 + 0.15, 9.0, 0.1 * S, 4.4 * S, 0.8, 0.5, 0.35, 1.0, 1.8, R.next() * 10, 1.6, 0.6);
    // EMP rings in three tilted planes (+ camera-facing)
    const ringDefs = [[0, 0, 0, 7.5, 5.5, 1.0, 1.0, 1.0], [0.25, 1, 0.35, 9.5, 6.0, 0.4, 0.9, 1.0], [0.9, 0.4, 0.5, 11, 7.0, 0.6, 0.55, 1.0], [-0.5, 0.35, 1, 8, 5.0, 0.35, 1.0, 0.9]];
    for (let i = 0; i < ringDefs.length; i++) { const d = ringDefs[i]; fx.rings.add(x, cy, z, d[0], d[1], d[2], t0 + i * 0.12, d[4], 0.1 * S, d[3] * S, 0.022, 3.4, d[5], d[6], d[7], R.next()); }
    fx.rings.add(x, cy, z, 0, 0, 0, t0 + 0.4, 9, 0.2 * S, 14 * S, 0.012, 1.6, 0.6, 0.75, 1.0, R.next());
    return;
  }
  // ---------------- atmospheric
  const cy = gy + S * 0.5;
  glowSprite(fx, x, cy, z, t0, 1.1, S * 9, S * 14, G_SOFT, 22, 20, 16, 2.6);
  glowSprite(fx, x, cy, z, t0, 1.8, S * 12, S * 18, G_STAR, 5, 4, 2.4, 2.2, R.range(0, 6), 0.04);
  glowSprite(fx, x, cy, z, t0, 7.0, S * 2.2, S * 3.0, G_SOFT, 3.4, 1.4, 0.4, 1.4);
  glowSprite(fx, x, cy, z, t0 + 0.2, 14.0, S * 1.6, S * 2.0, G_SOFT, 1.5, 0.45, 0.12, 1.2, 0, 0, 0, S * 0.06, 0);
  // fireball puffs
  const fn = fx.n(64);
  for (let i = 0; i < fn; i++) {
    dirHemi(R, _d, 0.1); const r = R.range(0.04, 0.3) * S, sp = R.range(0.1, 0.45) * S;
    setP(P, x + _d.x * r, cy + _d.y * r * 0.8, z + _d.z * r, _d.x * sp, _d.y * sp + S * 0.12, _d.z * sp, t0 + R.range(0, 0.25), R.range(2.5, 6.5), R.range(0.5, 0.9) * S, R.range(1.2, 2.0) * S);
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.4, 0.4); P.drag = 0.75; P.r = 1.0; P.g = 0.4; P.b = 0.07; P.a = R.range(1.2, 2.2); P.extra = sc * 0.03 + 0.2; P.turb = 0.08 * S;
    fx.firePool.add(P);
  }
  // mushroom: rising centre; cap = rolling torus, stem = column; k (pool drag) = 0.1
  const Hfinal = S * 5.5, riseV = Hfinal / (9.2); const capY = gy + S * 0.8;
  const cn = fx.n(170), sn = fx.n(120);
  for (let i = 0; i < cn; i++) {
    const phi = R.range(0, TAU), psi = R.range(0, TAU), rm = R.range(0.5, 1.05) * S * 0.3;
    const c = R.range(0.33, 0.52);
    setP(P, x, capY, z, psi, S * 0.5, rm, t0 + R.range(0, 0.6), R.range(30, 44), R.range(0.34, 0.6) * S, R.range(0.55, 0.9) * S);
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.05, 0.05); P.r = c * 1.05; P.g = c; P.b = c * 0.92; P.a = 0.92; P.heat = R.range(0.5, 1.1); P.heatDecay = 0.12 + 0.1 * R.next();
    P.extra = phi; // phi0
    // orbit pool reinterprets aF = (turb, stretch, drag, extra) as (riseV, mode 0=torus, roll omega, phi0)
    P.turb = riseV; P.stretch = 0; P.drag = R.range(0.3, 0.46); P.extra = phi;
    fx.cloudPool.add(P);
  }
  for (let i = 0; i < sn; i++) {
    const u = Math.pow(R.next(), 0.8), psi = R.range(0, TAU);
    const rad = S * (0.1 + 0.16 * Math.pow(1 - u, 3.0) + 0.05 * Math.sin(u * 9) + 0.0) * R.range(0.55, 1.0);
    const cc = 0.32 + 0.12 * u + R.range(-0.04, 0.04);
    setP(P, x, gy, z, psi, rad, capY - gy, t0 + R.range(0, 1.2), R.range(28, 40), R.range(0.22, 0.4) * S * (1.2 - 0.4 * u), R.range(0.4, 0.7) * S);
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.08, 0.08);
    const dust = 1 - u; P.r = cc * (1 + 0.25 * dust); P.g = cc * (1 + 0.05 * dust); P.b = cc * (1 - 0.2 * dust); P.a = 0.9; P.heat = R.range(0.2, 0.8) * (0.4 + 0.6 * u); P.heatDecay = 0.18;
    P.turb = riseV; P.stretch = 1; P.drag = R.range(0.04, 0.1) * R.sign(); P.extra = u; // mode 1 = stem, aF.w = u along the stem
    fx.cloudPool.add(P);
  }
  // base surge dust ring (flat, tan) + condensation skirt
  const dn = fx.n(70);
  for (let i = 0; i < dn; i++) {
    const a = (i / dn) * TAU + R.range(-0.1, 0.1), sp = S * R.range(0.5, 1.1);
    setP(P, x + Math.cos(a) * 0.3 * S, gy + 0.06 * S, z + Math.sin(a) * 0.3 * S, Math.cos(a) * sp, S * R.range(0, 0.05), Math.sin(a) * sp, t0 + R.range(0.1, 0.9), R.range(10, 17), R.range(0.25, 0.4) * S, R.range(1.0, 1.7) * S);
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.2, 0.2); const c = R.range(0.55, 0.85); P.r = c * 0.9; P.g = c * 0.8; P.b = c * 0.68; P.a = 0.55; P.drag = 0.7; P.extra = 0.05; P.turb = 0.04 * S;
    fx.smokePool.add(P);
  }
  // shock front (ground ring + vapour dome shell)
  fx.rings.add(x, gy, z, 0, 1, 0, t0, 7.5, 0.5 * S, 7.5 * S, 0.035, 2.4, 1.0, 0.88, 0.7, R.next());
  fx.rings.add(x, gy, z, 0, 1, 0, t0 + 0.3, 9.0, 0.4 * S, 9.5 * S, 0.02, 0.9, 0.8, 0.9, 1.0, R.next());
  fx.shells.add(x, cy, z, t0, 4.0, 0.3 * S, 6.0 * S, 1.6, 1.0, 0.85, 0.7, 3.4, R.next() * 10, 1.9, 0.5);
  fx.shells.add(x, cy, z, t0, 10, 0.3 * S, 2.4 * S, 0.7, 0.95, 0.6, 0.3, 2.5, R.next() * 10, 1.3, 0.8);
  fx.decals.add(x, gy, z, t0 + 0.1, 600, S * 5.5, R.range(0, TAU), 0.9);
  // sparks/embers + debris
  const spn = fx.n(60);
  for (let i = 0; i < spn; i++) {
    dirHemi(R, _d, 0.3); const sp = S * R.range(0.8, 2.6);
    setP(P, x, cy, z, _d.x * sp, _d.y * sp, _d.z * sp, t0 + R.range(0, 0.4), R.range(1.5, 4.0), S * R.range(0.01, 0.025), S * R.range(0.01, 0.025));
    P.stretch = R.range(0.05, 0.12); P.r = 4; P.g = 2; P.b = 0.7; P.extra = 1.0; P.drag = 0.5;
    fx.sparkPool.add(P);
  }
  spawnDebris(fx, fx.rng(seed + 5), x, gy, z, t0, 40, { power: S * 0.5, size: S * 0.022, upBias: 0.5, heat: 0.8, spread: 0.8 });
}

// ------------------------------------------------------------------------------------------------ reentry (comets, meteors, falling ships)
export function reentry(fx, from, to, o = {}) {
  const t0 = (o.t ?? fx.time) + (o.delay || 0), life = o.life ?? 3, size = o.size ?? 8;
  const ax = px(from), ay = py(from), az = pz(from), bx = px(to), by = py(to), bz = pz(to);
  const seed = o.seed ?? ((++fx.counter) * 15485863 + 5);
  const R = fx.rng(seed), P = fx.P;
  const col = o.color ? (o.color.isColor ? o.color : new THREE.Color(o.color)) : null;
  const mid = col ? [col.r, col.g, col.b] : [1.0, 0.52, 0.16];
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz) || 1;
  const vx = dx / life, vy = dy / life, vz = dz / life; const speed = len / life;
  const trailTime = o.trailTime ?? Math.min(life * 0.85, 2.6);
  fx.trails.add(ax, ay, az, bx, by, bz, t0, life, size, trailTime, R.next() * 10, o.intensity ?? 1.0, mid[0], mid[1], mid[2], 0);
  // head: white-hot core + orange halo + optional flare, moving linearly with the ribbon head
  glowSprite(fx, ax, ay, az, t0, life, size * 2.6, size * 3.6, G_SOFT, 12, 11, 8.5, 0, 0, 0, vx, vy, vz);
  glowSprite(fx, ax, ay, az, t0, life, size * 7, size * 10, G_SOFT, mid[0] * 2.6, mid[1] * 1.9, mid[2] * 1.2, 0, 0, 0, vx, vy, vz);
  if (o.flare !== false) glowSprite(fx, ax, ay, az, t0, life, size * 12, size * 22, G_STAR, 2.4, 1.8, 1.3, 0, R.range(0, 6), 0.3, vx, vy, vz);
  // shed sparks and smoke along the path (deterministic timeline)
  const n = fx.n(Math.min(160, Math.round(life * 42)));
  for (let i = 0; i < n; i++) {
    const tt = R.range(0, 1) * life, px_ = ax + vx * tt, py_ = ay + vy * tt, pz_ = az + vz * tt; dirSphere(R, _d); const sp = R.range(0.04, 0.22) * size * 3;
    setP(P, px_, py_, pz_, _d.x * sp - vx * 0.03, _d.y * sp - vy * 0.03, _d.z * sp - vz * 0.03, t0 + tt, R.range(0.5, 1.5), size * R.range(0.03, 0.08), size * R.range(0.03, 0.08));
    P.stretch = 0.05; P.r = mid[0] * 4; P.g = mid[1] * 3; P.b = mid[2] * 2; P.drag = 1.5; P.extra = 0.15;
    fx.sparkPool.add(P);
  }
  const sm = fx.n(Math.min(80, Math.round(life * 9)));
  for (let i = 0; i < sm; i++) {
    const tt = (i + R.next()) / sm * life; dirSphere(R, _d);
    setP(P, ax + vx * tt, ay + vy * tt, az + vz * tt, _d.x * size * 0.25, _d.y * size * 0.25, _d.z * size * 0.25, t0 + tt, R.range(7, 12), size * R.range(0.9, 1.5), size * R.range(3.5, 6));
    P.rnd = R.next(); P.rot = R.range(0, 6.28); P.rotVel = R.range(-0.1, 0.1); const c = R.range(0.38, 0.55); P.r = c * 1.05; P.g = c; P.b = c * 0.95; P.a = 0.34; P.heat = 0.7; P.heatDecay = 0.9; P.extra = 0.0; P.drag = 1.0; P.turb = size * 0.4;
    fx.smokePool.add(P);
  }
  fx.emit('reentry', ax, ay, az, bx, by, bz, t0, life);
  if (o.explodeAtEnd || o.impact) {
    const sz = o.explodeSize ?? size * 5; const kd = typeof o.impact === 'string' ? o.impact : (o.explodeKind ?? 'big');
    fx.queue(1, t0 + life, bx, by, bz, sz, seed + 1, kd);
  }
  return { speed };
}
