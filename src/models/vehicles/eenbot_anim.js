// EENBOT-2 procedural animation: pose container, 2-bone IK, gait generator and the clip library.
// Conventions: model faces +Z, character LEFT side = +X. Hanging limbs: positive rotation.x swings the tip BACKWARD (-Z); positive rotation.z swings it toward +X.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, TAU, RNG } from '../../engine/common.js';

export const BONES = [
  ['root', null], ['hips', 'root'], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck'],
  ['uaL', 'chest'], ['faL', 'uaL'], ['handL', 'faL'], ['thumbL1', 'handL'], ['thumbL2', 'thumbL1'], ['fingL1', 'handL'], ['fingL2', 'fingL1'],
  ['uaR', 'chest'], ['faR', 'uaR'], ['handR', 'faR'], ['thumbR1', 'handR'], ['thumbR2', 'thumbR1'], ['fingR1', 'handR'], ['fingR2', 'fingR1'],
  ['thL', 'hips'], ['shL', 'thL'], ['ftL', 'shL'], ['thR', 'hips'], ['shR', 'thR'], ['ftR', 'shR'],
];
export const NB = BONES.length;
export const BI = {}; BONES.forEach((b, i) => { BI[b[0]] = i; });
const SWAP = [['uaL', 'uaR'], ['faL', 'faR'], ['handL', 'handR'], ['thumbL1', 'thumbR1'], ['thumbL2', 'thumbR2'], ['fingL1', 'fingR1'], ['fingL2', 'fingR2'], ['thL', 'thR'], ['shL', 'shR'], ['ftL', 'ftR']];
// limbs solved by IK: [upper, lower, end, kind]; kind 'leg' targets in ROOT space, 'arm' targets in CHEST-local space
export const LIMBS = [
  { name: 'legL', up: 'thL', lo: 'shL', end: 'ftL', kind: 'leg', side: 1 }, { name: 'legR', up: 'thR', lo: 'shR', end: 'ftR', kind: 'leg', side: -1 },
  { name: 'armL', up: 'uaL', lo: 'faL', end: 'handL', kind: 'arm', side: 1 }, { name: 'armR', up: 'uaR', lo: 'faR', end: 'handR', kind: 'arm', side: -1 },
];
export const DIM = { thigh: 0.43, shin: 0.42, upperArm: 0.28, foreArm: 0.26, hipX: 0.10, hipY: -0.01, shoulderX: 0.235, shoulderY: 0.24, standY: 0.935, ankleY: 0.08, restHipY: 0.945 };

export class Pose {
  constructor() {
    this.r = new Float32Array(NB * 3); this.hip = new Float32Array([0, DIM.standY, 0]);
    this.ikOn = new Float32Array(4); this.ikT = new Float32Array(12); this.ikYaw = new Float32Array(2); this.ikPitch = new Float32Array(2); this.ikRoll = new Float32Array(2);
    this.curl = new Float32Array(2); // finger curl L,R
    this.reset();
  }
  reset() { this.r.fill(0); this.hip[0] = 0; this.hip[1] = DIM.standY; this.hip[2] = 0; this.ikOn.fill(0); this.ikT.fill(0); this.ikYaw.fill(0); this.ikPitch.fill(0); this.ikRoll.fill(0); this.curl.fill(0.2); return this; }
  copy(o) { this.r.set(o.r); this.hip.set(o.hip); this.ikOn.set(o.ikOn); this.ikT.set(o.ikT); this.ikYaw.set(o.ikYaw); this.ikPitch.set(o.ikPitch); this.ikRoll.set(o.ikRoll); this.curl.set(o.curl); return this; }
  lerpTo(a, b, w) { // this = lerp(a,b,w)
    for (let i = 0; i < this.r.length; i++) this.r[i] = a.r[i] + (b.r[i] - a.r[i]) * w;
    for (let i = 0; i < 3; i++) this.hip[i] = a.hip[i] + (b.hip[i] - a.hip[i]) * w;
    for (let i = 0; i < 4; i++) this.ikOn[i] = a.ikOn[i] + (b.ikOn[i] - a.ikOn[i]) * w;
    for (let i = 0; i < 12; i++) this.ikT[i] = a.ikT[i] + (b.ikT[i] - a.ikT[i]) * w;
    for (let i = 0; i < 2; i++) { this.ikYaw[i] = a.ikYaw[i] + (b.ikYaw[i] - a.ikYaw[i]) * w; this.ikPitch[i] = a.ikPitch[i] + (b.ikPitch[i] - a.ikPitch[i]) * w; this.ikRoll[i] = a.ikRoll[i] + (b.ikRoll[i] - a.ikRoll[i]) * w; this.curl[i] = a.curl[i] + (b.curl[i] - a.curl[i]) * w; }
    return this;
  }
  mirror() {
    for (const [a, b] of SWAP) { const ia = BI[a] * 3, ib = BI[b] * 3; for (let k = 0; k < 3; k++) { const t = this.r[ia + k]; this.r[ia + k] = this.r[ib + k]; this.r[ib + k] = t; } for (const n of [a, b]) { const i = BI[n] * 3; this.r[i + 1] *= -1; this.r[i + 2] *= -1; } }
    for (const n of ['hips', 'spine', 'chest', 'neck', 'head']) { const i = BI[n] * 3; this.r[i + 1] *= -1; this.r[i + 2] *= -1; }
    this.hip[0] *= -1;
    // swap limb ik (legs 0,1; arms 2,3)
    for (const [a, b] of [[0, 1], [2, 3]]) { const t = this.ikOn[a]; this.ikOn[a] = this.ikOn[b]; this.ikOn[b] = t; for (let k = 0; k < 3; k++) { const x = this.ikT[a * 3 + k]; this.ikT[a * 3 + k] = this.ikT[b * 3 + k]; this.ikT[b * 3 + k] = x; } this.ikT[a * 3] *= -1; this.ikT[b * 3] *= -1; }
    { const t = this.ikYaw[0]; this.ikYaw[0] = -this.ikYaw[1]; this.ikYaw[1] = -t; const p = this.ikPitch[0]; this.ikPitch[0] = this.ikPitch[1]; this.ikPitch[1] = p; const q = this.ikRoll[0]; this.ikRoll[0] = -this.ikRoll[1]; this.ikRoll[1] = -q; const c = this.curl[0]; this.curl[0] = this.curl[1]; this.curl[1] = c; }
    return this;
  }
}

// ───────── 2-bone IK (both legs and arms hang along -Y in rest) ─────────
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _k = new THREE.Vector3(), _m = new THREE.Matrix4(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _x = new THREE.Vector3(), _qw = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
function basisQuat(yAxis, zHint, out) {
  _y.copy(yAxis).normalize(); _z.copy(zHint).addScaledVector(_y, -zHint.dot(_y));
  if (_z.lengthSq() < 1e-8) { _z.set(1, 0, 0).addScaledVector(_y, -_y.x); }
  _z.normalize(); _x.crossVectors(_y, _z); _m.makeBasis(_x, _y, _z); return out.setFromRotationMatrix(_m);
}
/** shoulder S, target T (same frame), bone lengths, pole direction (bend toward). Fills q1 (upper, relative to parent frame) and q2 (lower, relative to upper). returns reach ratio */
export function solveIK(S, T, l1, l2, pole, q1, q2, zHint = Z_AXIS) {
  _u.subVectors(T, S); let dist = _u.length(); if (dist < 1e-5) { _u.set(0, -1, 0); dist = 1e-5; } else _u.divideScalar(dist);
  const reach = Math.min(dist, (l1 + l2) * 0.9993), minR = Math.abs(l1 - l2) + 1e-3; const r = Math.max(reach, minR);
  const cosA = clamp((l1 * l1 + r * r - l2 * l2) / (2 * l1 * r), -1, 1), A = Math.acos(cosA), sinA = Math.sin(A);
  _n.copy(pole).addScaledVector(_u, -pole.dot(_u)); if (_n.lengthSq() < 1e-8) _n.set(0, 0, 1).addScaledVector(_u, -_u.z); _n.normalize();
  _d1.copy(_u).multiplyScalar(cosA).addScaledVector(_n, sinA); // upper bone direction
  _k.copy(S).addScaledVector(_d1, l1); _c.copy(S).addScaledVector(_u, r); _d2.subVectors(_c, _k).normalize();
  basisQuat(_a.copy(_d1).negate(), zHint, q1); basisQuat(_b.copy(_d2).negate(), zHint, _qw); q2.copy(q1).invert().multiply(_qw);
  return dist / (l1 + l2);
}

// ───────── helpers for clips ─────────
export const RIFLE = { grip: [-0.09, 0.07, 0.26], fore: [-0.035, 0.1, 0.52] }; // chest-local hand targets for the held rifle
const ease = (x) => x * x * (3 - 2 * x);
const fr = (x) => x - Math.floor(x);
const sn = Math.sin, cs = Math.cos;
function J(P, name, x = 0, y = 0, z = 0) { const i = BI[name] * 3; P.r[i] = x; P.r[i + 1] = y; P.r[i + 2] = z; }
function A(P, name, x = 0, y = 0, z = 0) { const i = BI[name] * 3; P.r[i] += x; P.r[i + 1] += y; P.r[i + 2] += z; }
function foot(P, side, x, y, z, yaw = 0, pitch = 0, roll = 0, on = 1) { const i = side > 0 ? 0 : 1; P.ikOn[i] = on; P.ikT[i * 3] = x; P.ikT[i * 3 + 1] = y; P.ikT[i * 3 + 2] = z; P.ikYaw[i] = yaw; P.ikPitch[i] = pitch; P.ikRoll[i] = roll; }
function hand(P, side, x, y, z, on = 1) { const i = side > 0 ? 2 : 3; P.ikOn[i] = on; P.ikT[i * 3] = x; P.ikT[i * 3 + 1] = y; P.ikT[i * 3 + 2] = z; }
const ARM_REST = { y: DIM.shoulderY - DIM.upperArm - DIM.foreArm + 0.02 }; // wrist height (chest-local) when hanging
function standFeet(P, spread = 0.105, off = 0.02) { foot(P, 1, spread, DIM.ankleY, off, 0.04); foot(P, -1, -spread, DIM.ankleY, -off, -0.04); }

/**
 * Gait generator. c: {T cycle seconds, sweep (half stance sweep m), s stance fraction, step (swing lift m), lean, bob (run), reach (0..1 leg extension), arm (swing rad),
 * elbow (rad), twist (pelvis yaw), chestTwist, sway (m), roll (rad), crouch, spread, arms:'swing'|'hold'|callback}
 */
export function gait(P, t, c, S) {
  const ph = t / c.T; const sw = c.sweep, st = c.s;
  const legs = [{ side: 1, phi: fr(ph) }, { side: -1, phi: fr(ph + 0.5) }];
  let hMin = 1e9; const spread = c.spread ?? 0.105;
  const Lmax = DIM.thigh + DIM.shin;
  for (const L of legs) {
    const phi = L.phi; let z, y, pitch;
    if (phi < st) {
      const u = phi / st; z = sw - 2 * sw * u; y = DIM.ankleY + 0.05 * smoothstep(0.72, 1.0, u); pitch = lerp(0.3, 0, smoothstep(0, 0.22, u)) - 0.5 * smoothstep(0.72, 1.0, u);
      const dz = Math.abs(z);
      // pelvis height such that the stance leg keeps `reach` of full extension
      const target = Lmax * (c.reach ?? 0.985); const h = (y - DIM.ankleY) + DIM.ankleY + Math.sqrt(Math.max(0.05, target * target - dz * dz - spread * spread * 0.3)) - DIM.hipY;
      hMin = Math.min(hMin, h);
    } else {
      const u = (phi - st) / (1 - st); const e = ease(u); z = -sw + 2 * sw * e; y = DIM.ankleY + c.step * Math.pow(sn(Math.PI * Math.pow(u, 0.8)), 1.3) + 0.05 * (1 - smoothstep(0, 0.25, u)); pitch = lerp(-0.5, -0.1, smoothstep(0, 0.4, u)) + lerp(0, 0.35, smoothstep(0.6, 1.0, u));
    }
    foot(P, L.side, L.side * (spread + (c.sway ? 0 : 0)), y, z + (c.fwd ?? 0), L.side * 0.05, pitch);
  }
  // pelvis
  const cyc = fr(ph); let H;
  if (c.bob !== undefined) { // run: compression at mid-stance of each leg (phi = s/2 -> cyc = s/2 and cyc = s/2+0.5)
    H = DIM.standY - (c.crouch ?? 0.06) + c.bob * cs(2 * TAU * (cyc - st / 2));
  } else H = hMin > 1e8 ? DIM.standY : hMin; // never in flight in a walk
  H = Math.min(H, DIM.standY + 0.005) - (c.crouch ?? 0);
  const lx = cs(TAU * legs[0].phi); // +1 when left foot forward (heel strike)
  // sway toward the stance foot: stance leg L when phi in [0, s] -> shift to +x (left)
  const stanceL = legs[0].phi < st ? sn(Math.PI * legs[0].phi / st) : -sn(Math.PI * (legs[1].phi) / st);
  P.hip[0] = (c.sway ?? 0.02) * stanceL; P.hip[1] = H; P.hip[2] = c.hipZ ?? 0;
  const twist = c.twist ?? 0.1; J(P, 'hips', c.lean ?? 0.05, -twist * lx, -(c.roll ?? 0.04) * stanceL);
  J(P, 'spine', (c.lean ?? 0.05) * 0.5, twist * 0.55 * lx * (c.chestTwist ?? 1), (c.roll ?? 0.04) * stanceL * 0.5);
  J(P, 'chest', (c.lean ?? 0.05) * 0.4 + 0.01 * sn(TAU * ph * 2), twist * 0.7 * lx * (c.chestTwist ?? 1), 0);
  J(P, 'neck', -0.05 - (c.lean ?? 0.05) * 0.5, -twist * 0.6 * lx * (c.chestTwist ?? 1), 0); J(P, 'head', -0.02 + 0.01 * sn(TAU * ph * 2 + 1), 0, 0);
  // arms
  if (c.arms !== 'hold') {
    const a = c.arm ?? 0.5, e = c.elbow ?? 0.25;
    for (const [n, side, f] of [['L', 1, legs[0]], ['R', -1, legs[1]]]) {
      const x = cs(TAU * f.phi); // +1 when same-side leg forward => arm back
      J(P, 'ua' + n, a * x, 0, side * (0.09 + (c.armOut ?? 0.0))); J(P, 'fa' + n, -(e + (c.elbowSwing ?? 0.35) * (0.5 - 0.5 * x)), 0, 0); J(P, 'hand' + n, 0.05, 0, 0); P.curl[side > 0 ? 0 : 1] = c.curl ?? 0.35;
    }
  }
}

// clip library ---------------------------------------------------------------------------------
const WALK = { T: 0.92, sweep: 0.37, s: 0.62, step: 0.07, lean: 0.045, reach: 0.985, arm: 0.5, elbow: 0.22, twist: 0.12, sway: 0.022, roll: 0.035 };
const JOG = { T: 0.7, sweep: 0.42, s: 0.5, step: 0.14, lean: 0.12, reach: 0.96, arm: 0.8, elbow: 1.0, elbowSwing: 0.4, twist: 0.16, sway: 0.018, roll: 0.03, armOut: 0.04, curl: 0.7 };
const RUN = { T: 0.58, sweep: 0.46, s: 0.37, step: 0.2, lean: 0.2, bob: 0.045, crouch: 0.05, arm: 1.0, elbow: 1.35, elbowSwing: 0.3, twist: 0.2, sway: 0.012, roll: 0.03, armOut: 0.05, curl: 0.85 };
const SPRINT = { T: 0.46, sweep: 0.52, s: 0.32, step: 0.26, lean: 0.3, bob: 0.06, crouch: 0.07, arm: 1.2, elbow: 1.5, elbowSwing: 0.3, twist: 0.24, sway: 0.01, roll: 0.03, armOut: 0.05, curl: 0.9 };
export const SPEEDS = {};
for (const [k, c] of [['walk', WALK], ['jog', JOG], ['run', RUN], ['sprint', SPRINT]]) SPEEDS[k] = (2 * c.sweep) / (c.s * c.T); // ground speed that plants the feet

function breathe(P, t, k = 1) { const b = sn(TAU * t / 3.8); A(P, 'chest', 0.014 * b * k, 0, 0); A(P, 'spine', 0.007 * b * k, 0, 0); A(P, 'uaL', 0, 0, 0.01 * b * k); A(P, 'uaR', 0, 0, -0.01 * b * k); }
function relaxedArms(P, t, k = 1) {
  const s = sn(TAU * t / 5.3) * 0.02;
  J(P, 'uaL', -0.05 + s, 0, 0.1); J(P, 'faL', -0.18, 0, 0); J(P, 'handL', 0.05, 0, 0); J(P, 'uaR', -0.05 - s, 0, -0.1); J(P, 'faR', -0.18, 0, 0); J(P, 'handR', 0.05, 0, 0); P.curl[0] = P.curl[1] = 0.3 + 0.05 * sn(t * 0.7);
}
function talkGest(P, t, kind, E) {
  const e = E.talk; // energy 0..1
  const b = sn(TAU * t * 0.9) * e;
  relaxedArms(P, t);
  const g = (kind === 'b' ? 1.25 : kind === 'c' ? 0.8 : 1.0);
  const beat = Math.pow(0.5 + 0.5 * sn(TAU * t * 1.3 * g), 3);
  A(P, 'uaR', -0.65 * beat * e - 0.2 * e, 0, -0.18 * e); A(P, 'faR', -0.9 * beat * e - 0.4 * e, 0, 0); A(P, 'handR', 0.3 * beat * e, 0, 0);
  const beat2 = Math.pow(0.5 + 0.5 * sn(TAU * t * 1.1 * g + 2.0), 3);
  A(P, 'uaL', -0.5 * beat2 * e - 0.15 * e, 0, 0.15 * e); A(P, 'faL', -0.8 * beat2 * e - 0.3 * e, 0, 0);
  A(P, 'head', 0.06 * b + 0.04 * e * sn(TAU * t * 1.7), 0.05 * sn(TAU * t * 0.6) * e, 0); A(P, 'chest', 0.02 * b, 0.05 * sn(TAU * t * 0.5) * e, 0);
}
function idleLegs(P, t, shift = 1) {
  const w = sn(TAU * t / 6.5) * shift; // weight shift
  foot(P, 1, 0.11, DIM.ankleY, 0.03, 0.06); foot(P, -1, -0.11, DIM.ankleY, -0.05, -0.08);
  P.hip[0] = 0.014 * w; P.hip[1] = DIM.standY - 0.012 - 0.004 * Math.abs(w); J(P, 'hips', 0.0, 0.03 * w, -0.02 * w); J(P, 'spine', 0, -0.02 * w, 0.015 * w); J(P, 'chest', 0, 0, 0.0);
}
const J0 = (P) => { P.reset(); };

/** returns ground speed hint (m/s) for locomotion clips */
export const CLIPS = {
  idle(P, t, p, E) { idleLegs(P, t); relaxedArms(P, t); breathe(P, t); J(P, 'neck', 0.0, 0.05 * sn(TAU * t / 11), 0); J(P, 'head', 0.02, 0.1 * sn(TAU * t / 9 + 1) , 0.015 * sn(TAU * t / 7)); },
  idle_scan(P, t, p, E) { idleLegs(P, t); relaxedArms(P, t); breathe(P, t); const k = smoothstep(-0.2, 0.2, sn(TAU * t / 8)); J(P, 'neck', 0, 0.55 * sn(TAU * t / 8) * 0.6, 0); J(P, 'head', 0.02, 0.5 * sn(TAU * t / 8) * 0.5 * (0.6 + 0.4 * k), 0); },
  idle_arms_crossed(P, t, p, E) { idleLegs(P, t); breathe(P, t); J(P, 'uaL', -0.5, 0.3, 0.1); J(P, 'faL', -2.0, 0, 0.0); J(P, 'uaR', -0.5, -0.3, -0.1); J(P, 'faR', -2.0, 0, 0); hand(P, 1, 0.0, 0, 0, 0); P.curl[0] = P.curl[1] = 0.6; },
  walk(P, t, p, E) { gait(P, t, WALK, E); },
  jog(P, t, p, E) { gait(P, t, JOG, E); },
  run(P, t, p, E) { gait(P, t, RUN, E); },
  sprint(P, t, p, E) { gait(P, t, SPRINT, E); },
  walk_tired(P, t, p, E) { gait(P, t, { ...WALK, T: 1.15, lean: 0.14, arm: 0.2, step: 0.04, crouch: 0.03, twist: 0.06 }, E); A(P, 'head', 0.2, 0, 0); A(P, 'neck', 0.15, 0, 0); },
  carry(P, t, p, E) {
    gait(P, t, { ...WALK, arms: 'hold', arm: 0, twist: 0.05, lean: 0.0, sway: 0.018 }, E);
    // hands under/around a crate held in front of the chest (chest-local targets)
    const bob = 0.01 * sn(TAU * t / WALK.T * 2);
    hand(P, 1, 0.205, 0.0 + bob, 0.3); hand(P, -1, -0.205, 0.0 + bob, 0.3);
    J(P, 'handL', -0.1, 0, -0.5); J(P, 'handR', -0.1, 0, 0.5); P.curl[0] = P.curl[1] = 0.55; A(P, 'chest', -0.03, 0, 0);
  },
  aim(P, t, p, E) {
    idleLegs(P, t, 0.3); foot(P, 1, 0.16, DIM.ankleY, 0.18, 0.5); foot(P, -1, -0.12, DIM.ankleY, -0.18, 0.2); P.hip[1] = DIM.standY - 0.05; P.hip[2] = -0.03;
    J(P, 'hips', 0.04, -0.35, 0); J(P, 'spine', 0.02, 0.2, 0); J(P, 'chest', 0.02, 0.2, 0); J(P, 'neck', -0.04, 0.05, 0); J(P, 'head', 0.0, 0.0, 0.0);
    breathe(P, t, 0.5);
    // rifle in shoulder: right hand at the grip near the right shoulder, left hand on the fore-grip
    hand(P, -1, ...RIFLE.grip); hand(P, 1, ...RIFLE.fore); J(P, 'handR', 0, 0, 0.3); J(P, 'handL', 0.0, 0, -0.6); P.curl[0] = P.curl[1] = 0.65;
  },
  aim_walk(P, t, p, E) {
    gait(P, t, { ...WALK, arms: 'hold', arm: 0, T: 1.0, lean: 0.08, crouch: 0.04, sweep: 0.3, twist: 0.05, spread: 0.13, sway: 0.01 }, E);
    hand(P, -1, ...RIFLE.grip); hand(P, 1, ...RIFLE.fore); J(P, 'handR', 0, 0, 0.3); J(P, 'handL', 0.0, 0, -0.6); P.curl[0] = P.curl[1] = 0.65; A(P, 'chest', 0.03, 0.1, 0);
  },
  work(P, t, p, E) {
    idleLegs(P, t, 0.5); P.hip[1] = DIM.standY - 0.015; J(P, 'hips', 0.04, 0, 0); J(P, 'spine', 0.1, 0.0, 0); J(P, 'chest', 0.08, 0.0, 0); J(P, 'neck', 0.15, 0.03 * sn(t * 0.9), 0); J(P, 'head', 0.18, 0.05 * sn(t * 0.7 + 1), 0);
    breathe(P, t, 0.5);
    const a = sn(TAU * t * 1.3), b = sn(TAU * t * 1.7 + 1.2), c = sn(TAU * t * 0.4);
    hand(P, 1, 0.14 + 0.03 * c, -0.12 + 0.015 * a, 0.34); hand(P, -1, -0.14 - 0.03 * c, -0.12 + 0.015 * b, 0.34);
    J(P, 'handL', 0.5, 0, -0.1); J(P, 'handR', 0.5, 0, 0.1); P.curl[0] = 0.45 + 0.2 * a; P.curl[1] = 0.45 + 0.2 * b;
  },
  wave(P, t, p, E) {
    idleLegs(P, t, 0.6); relaxedArms(P, t); breathe(P, t);
    const w = sn(TAU * t * 1.9); J(P, 'uaR', 0.0, 0.0, -2.35 - 0.05 * sn(TAU * t * 0.9)); J(P, 'faR', -0.45 + 0.1 * w, 0, -0.55 * w); J(P, 'handR', 0, 0, -0.3 * w); P.curl[1] = 0.05; J(P, 'head', 0.04, 0.12, -0.08); J(P, 'chest', 0.0, 0.0, 0.05);
  },
  point(P, t, p, E) { idleLegs(P, t, 0.4); relaxedArms(P, t); breathe(P, t); J(P, 'uaR', -1.5, 0, -0.1); J(P, 'faR', -0.05, 0, 0); P.curl[1] = 0.8; J(P, 'chest', 0, 0.2, 0); J(P, 'head', 0, 0.2, 0); },
  salute(P, t, p, E) { idleLegs(P, t, 0.0); breathe(P, t); J(P, 'uaL', 0, 0, 0.1); J(P, 'faL', -0.2, 0, 0); J(P, 'uaR', -0.5, -0.6, -1.4); J(P, 'faR', -2.2, 0, 0); P.curl[1] = 0.05; },
  nod(P, t, p, E) { CLIPS.idle(P, t, p, E); A(P, 'head', 0.25 * (0.5 - 0.5 * cs(TAU * t * 1.5)), 0, 0); A(P, 'neck', 0.1 * (0.5 - 0.5 * cs(TAU * t * 1.5)), 0, 0); },
  shake_head(P, t, p, E) { CLIPS.idle(P, t, p, E); A(P, 'head', 0, 0.35 * sn(TAU * t * 2.2), 0); A(P, 'neck', 0, 0.15 * sn(TAU * t * 2.2), 0); },
  shrug(P, t, p, E) { CLIPS.idle(P, t, p, E); const k = 0.5 - 0.5 * cs(TAU * t / 1.6); A(P, 'uaL', 0, 0, 0.5 * k); A(P, 'uaR', 0, 0, -0.5 * k); A(P, 'faL', -0.8 * k, 0, 0); A(P, 'faR', -0.8 * k, 0, 0); A(P, 'head', 0, 0, 0.15 * k); },
  talk_a(P, t, p, E) { idleLegs(P, t, 0.7); breathe(P, t); talkGest(P, t, 'a', E); },
  talk_b(P, t, p, E) { idleLegs(P, t, 0.7); breathe(P, t); talkGest(P, t, 'b', E); },
  talk_c(P, t, p, E) { idleLegs(P, t, 0.7); breathe(P, t); talkGest(P, t, 'c', E); },
  listen(P, t, p, E) { idleLegs(P, t); breathe(P, t); relaxedArms(P, t); J(P, 'head', 0.03, 0.0, 0.1 * sn(TAU * t / 6)); A(P, 'uaR', 0, 0, 0); },
  stagger(P, t, p, E) {
    const T = 1.3, ph = t / T; const a = sn(TAU * ph), b = sn(TAU * ph * 2 + 0.7), c = sn(TAU * ph * 3 + 2);
    foot(P, 1, 0.16 + 0.04 * b, DIM.ankleY + 0.07 * Math.max(0, sn(TAU * ph)), -0.12 + 0.28 * sn(TAU * ph + 0.5), 0.3 * a, -0.2 * Math.max(0, a));
    foot(P, -1, -0.16 - 0.04 * b, DIM.ankleY + 0.07 * Math.max(0, -sn(TAU * ph)), -0.12 - 0.28 * sn(TAU * ph + 0.5), -0.3 * a, -0.2 * Math.max(0, -a));
    P.hip[0] = 0.08 * a; P.hip[1] = DIM.standY - 0.1 - 0.03 * b; P.hip[2] = -0.04;
    J(P, 'hips', -0.06 + 0.05 * c, 0.2 * a, -0.18 * a); J(P, 'spine', -0.18 + 0.08 * b, -0.25 * a, 0.2 * a); J(P, 'chest', -0.12, -0.15 * a, 0.12 * a); J(P, 'neck', 0.1 * c, 0.2 * a, 0.1 * b); J(P, 'head', -0.25 + 0.2 * b, 0.3 * c, 0.2 * a);
    J(P, 'uaL', 0.5 + 0.9 * a, 0, 0.8 + 0.4 * b); J(P, 'faL', -0.6, 0, 0); J(P, 'uaR', 0.5 - 0.9 * a, 0, -0.8 - 0.4 * c); J(P, 'faR', -0.5, 0, 0); P.curl[0] = P.curl[1] = 0.1;
  },
  fall(P, t, p, E) { const k = clamp(t / 1.5); fallPose(P, k, E, t); },
  dead(P, t, p, E) { fallPose(P, 1, E, 99); const tw = Math.max(0, sn(t * 9.1) * sn(t * 3.7) - 0.6); A(P, 'head', 0, 0.02 * tw, 0.03 * tw); },
  get_up(P, t, p, E) { const k = 1 - clamp(t / 1.8); fallPose(P, k, E, 5); },
  // rabid / infected specific
  rabid_idle(P, t, p, E) { CLIPS.idle(P, t, p, E); twitch(P, t, 1, E); },
  rabid_run(P, t, p, E) { gait(P, t, { ...RUN, lean: 0.38, arm: 0.5, elbow: 0.7, twist: 0.3, sway: 0.04 }, E); A(P, 'head', 0.3, 0, 0); twitch(P, t, 1, E); },
  rabid_lunge(P, t, p, E) { const k = smoothstep(0, 0.35, t % 1.2); idleLegs(P, t, 0); foot(P, 1, 0.1, DIM.ankleY, 0.35 * k, 0); foot(P, -1, -0.1, DIM.ankleY, -0.3 * k, 0); P.hip[1] = DIM.standY - 0.2 * k; P.hip[2] = 0.15 * k; J(P, 'hips', 0.5 * k, 0, 0); J(P, 'spine', 0.35 * k, 0, 0); J(P, 'chest', 0.3 * k, 0, 0); J(P, 'neck', -0.4 * k, 0, 0); J(P, 'uaL', -1.6 * k, 0, 0.3); J(P, 'uaR', -1.6 * k, 0, -0.3); J(P, 'faL', -0.2, 0, 0); J(P, 'faR', -0.2, 0, 0); P.curl[0] = P.curl[1] = 1; twitch(P, t, 1, E); },
};
CLIPS.zombie_idle = CLIPS.rabid_idle; CLIPS.zombie_run = CLIPS.rabid_run; CLIPS.zombie_lunge = CLIPS.rabid_lunge; CLIPS.zombie_shamble = (P, t, p, E) => { gait(P, t, { ...WALK, T: 1.25, lean: 0.2, arm: 0.12, elbow: 0.2, twist: 0.2, sway: 0.05, crouch: 0.03 }, E); J(P, 'head', 0.3, 0.3 * sn(t * 1.1), 0.25); A(P, 'uaL', -1.1, 0, 0.1); A(P, 'uaR', -0.9, 0, -0.1); A(P, 'faL', -0.5, 0, 0); A(P, 'faR', -0.4, 0, 0); twitch(P, t, 0.6, E); };
CLIPS.zombie_shamble.dur = 0;
export const LOCO_SPEED = { walk: SPEEDS.walk, walk_tired: 0.6, jog: SPEEDS.jog, run: SPEEDS.run, sprint: SPEEDS.sprint, carry: SPEEDS.walk, aim_walk: 1.1, rabid_run: SPEEDS.run, zombie_run: SPEEDS.run, zombie_shamble: 0.8 };
export const ONCE = { fall: 1.5, get_up: 1.8, stagger: 0 };

function fallPose(P, k, E, t) {
  // k 0..1: standing -> lying on back; includes a staggered start
  const a = ease(clamp(k / 0.35)), b = ease(clamp((k - 0.25) / 0.75)), c = clamp((k - 0.8) / 0.2);
  idleLegs(P, 0, 0);
  const side = 0.18;
  // hips drop & tip backward (about X: -pi/2 = lying on the back, head toward -Z)
  P.hip[1] = lerp(DIM.standY, 0.13, b); P.hip[2] = lerp(0, -0.55, b); P.hip[0] = lerp(0, 0.05, b);
  J(P, 'hips', -b * (Math.PI / 2 - 0.05), 0, 0.08 * b);
  J(P, 'spine', lerp(-0.1 * a, 0.05, b), 0.0, 0); J(P, 'chest', lerp(-0.2 * a, 0.0, b), 0, 0); J(P, 'neck', lerp(0.2 * a, -0.05, b), 0, 0.1 * b); J(P, 'head', lerp(-0.3 * a, -0.15, b), 0.25 * b, 0.15 * b);
  // legs FK, splayed (hips-local; the hips are rotated, so knees flexed up a bit)
  for (const [n, s] of [['L', 1], ['R', -1]]) {
    J(P, 'th' + n, -0.15 * b + 0.2 * b * s, 0, s * 0.15 * b); J(P, 'sh' + n, 0.4 * b - 0.2 * b * s, 0, 0); J(P, 'ft' + n, 0.1 * b, 0, 0);
    J(P, 'ua' + n, (0.3 + 0.6 * s) * b * 0.0 + 0.4 * b, 0, s * (0.35 + 0.9 * b * (n === 'L' ? 1 : 0.6))); J(P, 'fa' + n, -0.3 * b, 0, 0); J(P, 'hand' + n, 0.1, 0, 0);
  }
  P.ikOn.fill(0); P.curl[0] = P.curl[1] = 0.15;
}
function twitch(P, t, k, E) {
  // rabid jitter: quantised random glitches on head, shoulders, arms, torso
  const q = Math.floor(t * 14), r = (n) => { const x = Math.sin(q * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
  const g1 = r(1) > 0.7 ? 1 : 0, g2 = r(2) > 0.78 ? 1 : 0, g3 = r(3) > 0.8 ? 1 : 0;
  A(P, 'head', (r(4) - 0.5) * 0.5 * g1, (r(5) - 0.5) * 0.9 * g1, (r(6) - 0.5) * 0.5 * g1);
  A(P, 'neck', (r(7) - 0.5) * 0.3 * g1, (r(8) - 0.5) * 0.5 * g1, 0);
  A(P, 'uaL', (r(9) - 0.5) * 0.7 * g2, 0, (r(10) - 0.5) * 0.4 * g2); A(P, 'uaR', (r(11) - 0.5) * 0.7 * g3, 0, (r(12) - 0.5) * 0.4 * g3);
  A(P, 'faL', -(r(13)) * 0.8 * g2, 0, 0); A(P, 'faR', -(r(14)) * 0.8 * g3, 0, 0); A(P, 'chest', (r(15) - 0.5) * 0.2 * g2, (r(16) - 0.5) * 0.35 * g3, 0);
  P.curl[0] = clamp(P.curl[0] + r(17) * 0.5 * g2); P.curl[1] = clamp(P.curl[1] + r(18) * 0.5 * g3);
  P.hip[1] -= 0.02 * g1 * r(19);
}
/** rabid style modifiers applied on top of any clip when the robot is infected (amount 0..1) */
export function infectedStyle(P, t, a, E) {
  if (a < 0.05) return;
  const k = smoothstep(0.05, 0.6, a);
  A(P, 'spine', 0.1 * k, 0, 0.05 * k * sn(t * 1.3)); A(P, 'chest', 0.1 * k, 0, 0); A(P, 'neck', 0.15 * k, 0, 0.1 * k * sn(t * 0.8)); A(P, 'head', 0.12 * k, 0, 0.15 * k * sn(t * 1.9));
  P.hip[1] -= 0.015 * k; A(P, 'uaL', -0.1 * k, 0, 0); A(P, 'uaR', -0.1 * k, 0, 0);
  twitch(P, t, k, E);
}
