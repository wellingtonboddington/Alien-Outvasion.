// Crowd animation core: tiny mat3/quat maths, 2-bone IK, Pose container and the baker that turns clip functions into a
// half-float "pose table" texture (width = frames, height = NS*NJ rows, RGBA = quaternion xyz | random-amplitude).
// The vertex shader only fetches (state,joint,cycle) texels, so thousands of agents animate for free.
import * as THREE from 'three';
import { J, NJ, NS, ST, POSE_FRAMES } from './rig.js';

// ---------- mat3 (row-major arrays) ----------
export const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const mmul = (A, B) => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]];
export const mT = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
export const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
export const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
/** Euler -> matrix, order Ry * Rx * Rz (same as the shader would build) */
export const rotE = (x, y, z) => mmul(Ry(y), mmul(Rx(x), Rz(z)));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
/** matrix -> quaternion [x,y,z,w] with w >= 0 */
export function mq(M) {
  const t = M[0] + M[4] + M[8]; let x, y, z, w;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (M[7] - M[5]) / s; y = (M[2] - M[6]) / s; z = (M[3] - M[1]) / s; }
  else if (M[0] > M[4] && M[0] > M[8]) { const s = Math.sqrt(1 + M[0] - M[4] - M[8]) * 2; w = (M[7] - M[5]) / s; x = s / 4; y = (M[1] + M[3]) / s; z = (M[2] + M[6]) / s; }
  else if (M[4] > M[8]) { const s = Math.sqrt(1 + M[4] - M[0] - M[8]) * 2; w = (M[2] - M[6]) / s; x = (M[1] + M[3]) / s; y = s / 4; z = (M[5] + M[7]) / s; }
  else { const s = Math.sqrt(1 + M[8] - M[0] - M[4]) * 2; w = (M[3] - M[1]) / s; x = (M[2] + M[6]) / s; y = (M[5] + M[7]) / s; z = s / 4; }
  const l = Math.hypot(x, y, z, w) || 1; x /= l; y /= l; z /= l; w /= l;
  return w < 0 ? [-x, -y, -z, -w] : [x, y, z, w];
}
export function qm(q) { // quaternion [x,y,z,w] -> mat3 row-major
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}

// ---------- 2-bone IK ----------
/**
 * Solve a two-bone chain hanging along -Y at rest. S = root joint position, T = target end position, L1/L2 bone lengths, pole = direction
 * the middle joint should bend toward, hs = hinge sign (+1 arms: forearm swings forward (+Z); -1 legs: shin swings backward).
 * Returns { R1: mat3 of the first bone, kappa: flexion of the second joint (rad, >=0), E: middle joint position, reach }
 */
export function ik2(S, T, L1, L2, pole, hs) {
  let d = sub(T, S); let dist = len(d); const maxR = (L1 + L2) * 0.9995; const minR = Math.abs(L1 - L2) + 0.01;
  const u = scl(d, 1 / (dist || 1)); dist = Math.min(maxR, Math.max(minR, dist));
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist); const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let pp = sub(pole, scl(u, dot(pole, u))); if (len(pp) < 1e-5) pp = [0, 0, 1]; pp = nrm(pp);
  const E = add(add(S, scl(u, a)), scl(pp, h));
  const Tc = add(S, scl(u, dist));
  const d1 = nrm(sub(E, S)); const f = nrm(sub(Tc, E));
  const kappa = Math.acos(Math.max(-1, Math.min(1, dot(d1, f))));
  let b = sub(f, scl(d1, dot(f, d1))); b = len(b) < 1e-5 ? nrm(sub(pole, scl(d1, dot(pole, d1)))) : nrm(b);
  const y1 = scl(d1, -1), z1 = scl(b, hs), x1 = cross(y1, z1);
  const R1 = [x1[0], y1[0], z1[0], x1[1], y1[1], z1[1], x1[2], y1[2], z1[2]];
  return { R1, kappa, E, reach: Tc };
}

// ---------- Pose ----------
export class Pose {
  constructor() { this.q = []; this.t = [0, 0, 0]; this.rnd = new Float32Array(NJ); this.reset(); }
  reset() { for (let j = 0; j < NJ; j++) this.q[j] = [0, 0, 0, 1]; this.t[0] = this.t[1] = this.t[2] = 0; this.rnd.fill(0); return this; }
  /** Euler (rad) rotation, order Ry*Rx*Rz */
  e(j, x = 0, y = 0, z = 0) { this.q[j] = mq(rotE(x, y, z)); return this; }
  m(j, M) { this.q[j] = mq(M); return this; }
  /** add Euler rotation on top of current joint rotation (applied in joint frame after existing) */
  eAdd(j, x = 0, y = 0, z = 0) { this.q[j] = mq(mmul(qm(this.q[j]), rotE(x, y, z))); return this; }
  pos(x, y, z) { this.t[0] = x; this.t[1] = y; this.t[2] = z; return this; }
  r(j, a) { this.rnd[j] = a; return this; }
}

/**
 * Bake clips into the pose table. clips[stateIndex] = { f: cycles/s (loop) , dur: seconds (one-shot, 0 = loop), blend: blend-in seconds, flags, fn(P, c) }.
 * c is the normalised cycle (0..1) for loops and the normalised time (0..1) for one-shots. Returns { tex: DataTexture, info: Float32Array(NS*4) }
 */
export function bakeTable(clips) {
  const F = POSE_FRAMES, H = NS * NJ; const data = new Uint16Array(F * H * 4);
  const P = new Pose(); const hf = THREE.DataUtils.toHalfFloat;
  const info = new Float32Array(NS * 4);
  for (let s = 0; s < NS; s++) {
    const cl = clips[s] || clips[ST.idle];
    info[s * 4] = cl.f || 0.25; info[s * 4 + 1] = cl.dur || 0; info[s * 4 + 2] = cl.blend ?? 0.25; info[s * 4 + 3] = (cl.dur ? 1 : 0) + (cl.lying ? 2 : 0);
    for (let fr = 0; fr < F; fr++) {
      const c = cl.dur ? fr / (F - 1) : fr / F;
      P.reset(); cl.fn(P, c, fr);
      for (let j = 0; j < NJ; j++) {
        const o = ((s * NJ + j) * F + fr) * 4;
        if (j === J.ROOT_POS) { data[o] = hf(P.t[0]); data[o + 1] = hf(P.t[1]); data[o + 2] = hf(P.t[2]); data[o + 3] = 0; }
        else { const q = P.q[j]; data[o] = hf(q[0]); data[o + 1] = hf(q[1]); data[o + 2] = hf(q[2]); data[o + 3] = hf(P.rnd[j]); }
      }
    }
  }
  const tex = new THREE.DataTexture(data, F, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  tex.userData.shared = false;
  return { tex, info };
}
