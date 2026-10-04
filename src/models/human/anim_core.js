// Animation core: pose builder, two-bone IK (legs + arms), hand poses, Animator (clip playback, blending, breathing, look-at).
import * as THREE from 'three';
import { clamp, damp, smoothstep } from '../../engine/common.js';
import { noise2 } from '../../engine/proc.js';
import { FINGERS } from './rig.js';

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qd = new THREE.Quaternion();
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vc = new THREE.Vector3(), _vd = new THREE.Vector3(), _ve = new THREE.Vector3();
const _e = new THREE.Euler();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
export const ID = new THREE.Quaternion();

/** smooth noise in [-1,1] */
export const sn = (t, seed = 0) => noise2(t, seed * 7.31 + 0.5) * 1.4;
export const wave = (t, f, ph = 0) => Math.sin((t * f + ph) * Math.PI * 2);
export const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerpn = (a, b, t) => a + (b - a) * t;

// ----- FK helpers (relative to the rig's root group; bones carry no scale) -----
export function fkPos(bone, out) {
  out.copy(bone.position); let n = bone.parent;
  while (n && n.isBone) { out.applyQuaternion(n.quaternion).add(n.position); n = n.parent; }
  return out;
}
export function fkQuat(bone, out) {
  out.copy(bone.quaternion); let n = bone.parent;
  while (n && n.isBone) { out.premultiply(n.quaternion); n = n.parent; }
  return out;
}
export function parentQuat(bone, out) { out.identity(); let n = bone.parent; while (n && n.isBone) { out.premultiply(n.quaternion); n = n.parent; } return out; }

function signedAngle(a, b, axis) { // angle from a to b about axis (a,b ⟂-projected)
  _va.copy(a).addScaledVector(axis, -a.dot(axis)); _vb.copy(b).addScaledVector(axis, -b.dot(axis));
  const la = _va.length(), lb = _vb.length(); if (la < 1e-6 || lb < 1e-6) return 0;
  _va.divideScalar(la); _vb.divideScalar(lb);
  const c = clamp(_va.dot(_vb), -1, 1); _vc.crossVectors(_va, _vb); const s = _vc.dot(axis);
  return Math.atan2(s, c);
}
/**
 * two-bone IK. rootPos/target in the same frame. rest dirs are the bind-pose bone directions (unit). pole = direction the middle joint bends towards.
 * writes world-space rotations (relative to rig root) into q1/q2, returns the (possibly clamped) end position in `endOut`.
 */
const _K = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3(), _n1 = new THREE.Vector3(), _n2 = new THREE.Vector3(), _h = new THREE.Vector3(), _a1 = new THREE.Vector3();
export function twoBone(rootPos, target, L1, L2, rest1, rest2, pole, q1, q2, endOut, maxReach = 0.9995) {
  _u.subVectors(target, rootPos); let dist = _u.length(); if (dist < 1e-5) { _u.set(0, -1, 0); dist = 1e-5; } else _u.divideScalar(dist);
  const maxD = (L1 + L2) * maxReach, minD = Math.abs(L1 - L2) * 1.02 + 1e-3;
  const d = clamp(dist, minD, maxD);
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1); const A = Math.acos(cosA);
  _w.copy(pole).addScaledVector(_u, -pole.dot(_u)); if (_w.lengthSq() < 1e-8) _w.set(0, 0, 1).addScaledVector(_u, -_u.z); _w.normalize();
  _K.copy(rootPos).addScaledVector(_u, Math.cos(A) * L1).addScaledVector(_w, Math.sin(A) * L1);
  endOut.copy(rootPos).addScaledVector(_u, d);
  _n1.subVectors(_K, rootPos).normalize(); _n2.subVectors(endOut, _K).normalize();
  _h.crossVectors(_n1, _n2); if (_h.lengthSq() < 1e-8) _h.crossVectors(_w, _u); _h.normalize();
  // bone 1
  q1.setFromUnitVectors(rest1, _n1); _a1.copy(AX).applyQuaternion(q1); let hh = _a1.dot(_h) < 0 ? _vd.copy(_h).negate() : _vd.copy(_h);
  let ang = signedAngle(_a1, hh, _n1); _qa.setFromAxisAngle(_n1, ang); q1.premultiply(_qa);
  // bone 2
  q2.setFromUnitVectors(rest2, _n2); _a1.copy(AX).applyQuaternion(q2); hh = _a1.dot(_h) < 0 ? _vd.copy(_h).negate() : _vd.copy(_h);
  ang = signedAngle(_a1, hh, _n2); _qa.setFromAxisAngle(_n2, ang); q2.premultiply(_qa);
  return endOut;
}

// ----- hand poses (curl 0..1 for index,middle,ring,pinky; thumb [oppose, flex1, flex2, flex3] radians; spread) -----
export const HAND_POSES = {
  relaxed: { c: [0.30, 0.34, 0.40, 0.46], t: [0.35, 0.25, 0.28, 0.18], spread: 0.02 },
  open: { c: [0.05, 0.05, 0.06, 0.08], t: [0.05, 0.0, 0.05, 0.0], spread: 0.35 },
  flat: { c: [0.0, 0.0, 0.0, 0.0], t: [0.15, 0.0, 0.0, 0.0], spread: 0.0 },
  fist: { c: [0.95, 1.0, 1.0, 1.0], t: [0.75, 0.55, 0.7, 0.55], spread: 0.0 },
  point: { c: [0.0, 1.0, 1.0, 1.0], t: [0.6, 0.45, 0.55, 0.4], spread: 0.0 },
  grip_rifle: { c: [0.72, 0.8, 0.84, 0.88], t: [0.55, 0.4, 0.5, 0.3], spread: 0.0 },
  trigger: { c: [0.4, 0.8, 0.85, 0.9], t: [0.55, 0.4, 0.5, 0.3], spread: 0.0 },
  support: { c: [0.55, 0.6, 0.66, 0.7], t: [0.4, 0.3, 0.4, 0.3], spread: 0.05 },
  hold_phone: { c: [0.45, 0.62, 0.7, 0.78], t: [0.15, 0.2, 0.1, 0.1], spread: 0.0 },
  hold_cup: { c: [0.55, 0.62, 0.66, 0.72], t: [0.2, 0.25, 0.2, 0.2], spread: 0.04 },
  pinch: { c: [0.45, 0.3, 0.3, 0.35], t: [0.55, 0.5, 0.5, 0.2], spread: 0.0 },
  carry: { c: [0.6, 0.7, 0.75, 0.8], t: [0.3, 0.25, 0.35, 0.3], spread: 0.0 },
  claw: { c: [0.55, 0.55, 0.55, 0.55], t: [0.2, 0.1, 0.3, 0.2], spread: 0.4 },
  zombie: { c: [0.45, 0.5, 0.58, 0.65], t: [0.2, 0.1, 0.3, 0.2], spread: 0.12 },
  type: { c: [0.35, 0.4, 0.45, 0.5], t: [0.2, 0.1, 0.2, 0.15], spread: 0.05 },
};
const JOINT_K = [1.30, 1.65, 1.0];

/** Builder: collects pose requests (FK offsets as quaternions + IK requests) for one clip evaluation */
export class PoseBuilder {
  constructor(human) {
    this.h = human; this.rig = human.rig; this.D = human.layout.dims; this.J = human.layout.J;
    this.pq = {}; for (const n in this.rig.bones) this.pq[n] = new THREE.Quaternion();
    this.hipsOff = new THREE.Vector3();
    this.foot = { L: null, R: null }; this.hand = { L: null, R: null };
    this.handPose = { L: null, R: null };
    this.fingerOverride = { L: null, R: null };
    this.mirror = false; this.t = 0; this.p = {};
    this.restAnkle = { L: this.J.footL.clone(), R: this.J.footR.clone() };
    this._eul = new THREE.Euler(); this.extra = {};
  }
  begin(mirror, t, p) {
    this.mirror = mirror; this.t = t; this.p = p || {}; this.hipsOff.set(0, 0, 0);
    for (const n in this.pq) this.pq[n].identity();
    this.foot.L = this.foot.R = null; this.hand.L = this.hand.R = null; this.handPose.L = this.handPose.R = null; this.fingerOverride.L = this.fingerOverride.R = null;
    this.extra = {};
    this.hipsMode = 'free'; this.hipsLimit = 0.985; this.hipsFloor = null;
  }
  /** swap sides when mirrored */
  S(side) { return this.mirror ? (side === 'L' ? 'R' : 'L') : side; }
  m() { return this.mirror ? -1 : 1; }
  /** set bone offset by euler (radians), default order ZXY: twist(Y) first, then pitch(X), then roll(Z) */
  set(bone, x = 0, y = 0, z = 0, order = 'ZXY') { this._eul.set(x, y, z, order); this.pq[bone].setFromEuler(this._eul); return this; }
  add(bone, x = 0, y = 0, z = 0, order = 'ZXY') { this._eul.set(x, y, z, order); _qd.setFromEuler(this._eul); this.pq[bone].multiply(_qd); return this; }
  hips(x = 0, y = 0, z = 0) { this.hipsOff.set(x * this.m(), y, z); return this; }
  hipsRot(pitch = 0, yaw = 0, roll = 0) { const m = this.m(); return this.set('hips', pitch, yaw * m, roll * m, 'YXZ'); }
  /** torso: total pitch (forward +), yaw (to character's left +), roll(to right shoulder down +); distributed over spine/chest */
  spine(pitch = 0, yaw = 0, roll = 0, split = 0.42) {
    const m = this.m();
    this.set('spine', pitch * split, yaw * m * split, roll * m * split, 'YXZ'); this.set('chest', pitch * (1 - split), yaw * m * (1 - split), roll * m * (1 - split), 'YXZ'); return this;
  }
  /** head+neck: pitch (down +), yaw (left +), roll (tilt to right +) */
  head(pitch = 0, yaw = 0, roll = 0, neckShare = 0.4) {
    const m = this.m();
    this.set('neck', pitch * neckShare, yaw * m * neckShare, roll * m * neckShare, 'YXZ'); this.set('head', pitch * (1 - neckShare), yaw * m * (1 - neckShare), roll * m * (1 - neckShare), 'YXZ'); return this;
  }
  /** shoulder girdle: up (shrug +), fwd (protract +) */
  shoulder(side, up = 0, fwd = 0) { const S = this.S(side), s = S === 'L' ? 1 : -1; return this.set('clavicle' + S, -fwd * 0.5, 0, s * up * 0.9); }
  /**
   * arm FK. raise: forward-up flexion (rad, + = forward/up), abd: out to the side (rad, + = away from body, measured from bind pose), rot: internal(+)/external(-) rotation,
   * elbow: flexion (0 straight .. ~2.6), pron: forearm pronation(+)/supination(-), wflex: wrist flex (+ palm towards forearm), wdev: ulnar(+)/radial deviation
   */
  arm(side, { raise = 0, abd = 0, rot = 0, elbow = 0.12, pron = 0, wflex = 0, wdev = 0 } = {}) {
    const S = this.S(side), s = S === 'L' ? 1 : -1;
    this._eul.set(-raise, rot * -s, s * abd, 'ZXY'); this.pq['upperArm' + S].setFromEuler(this._eul);
    this._eul.set(-elbow, pron * s, 0, 'ZXY'); this.pq['foreArm' + S].setFromEuler(this._eul);
    this._eul.set(wdev * 0.0, 0, -s * wflex, 'ZXY'); this.pq['hand' + S].setFromEuler(this._eul);
    if (wdev) { _qd.setFromAxisAngle(AX, wdev); this.pq['hand' + S].premultiply(_qd); }
    return this;
  }
  /** leg FK: hip flexion (fwd +), abduction (out +), rot, knee flexion (+ bends), ankle (plantar +) */
  leg(side, { hip = 0, abd = 0, rot = 0, knee = 0, ankle = 0, toe = 0 } = {}) {
    const S = this.S(side), s = S === 'L' ? 1 : -1;
    this._eul.set(-hip, rot * s, s * abd, 'ZXY'); this.pq['upperLeg' + S].setFromEuler(this._eul);
    this.set('lowerLeg' + S, knee); this.set('foot' + S, ankle); this.set('toes' + S, toe);
    return this;
  }
  /** IK foot: ankle target = bind ankle + (dx,dy,dz) (root space, y = lift above ground); yaw (toes out), pitch (toe down +), toe (toes up -) */
  footIK(side, dx, dy, dz, yaw = 0, pitch = 0, toe = 0, plant = false) {
    const S = this.S(side); this.foot[S] = this.foot[S] || {}; Object.assign(this.foot[S], { dx: dx * (this.mirror ? -1 : 1), dy, dz, yaw: yaw * this.m(), pitch, toe, plant }); return this;
  }
  /** IK hand: wrist target in root space (absolute) or function returning V3; elbow pole; optional world rotation quaternion or euler */
  handIK(side, target, { pole = null, rot = null, w = 1 } = {}) {
    const S = this.S(side); this.hand[S] = { target, pole, rot, w }; return this;
  }
  /** hand pose name/obj with amount */
  handPose_(side, pose, amt = 1) { const S = this.S(side); this.handPose[S] = { pose, amt }; return this; }
  fingers(side, pose, amt = 1) { return this.handPose_(side, pose, amt); }
}

// ----- apply finger pose to bones -----
const _fq = new THREE.Quaternion(), _fe = new THREE.Euler();
export function applyHandPose(pq, S, pose, amt = 1, extraCurl = 0) {
  const s = S === 'L' ? 1 : -1;
  const hp = typeof pose === 'string' ? HAND_POSES[pose] || HAND_POSES.relaxed : pose;
  const names = ['index', 'middle', 'ring', 'pinky'];
  const rel = HAND_POSES.relaxed;
  for (let i = 0; i < 4; i++) {
    const c = clamp(rel.c[i] + (hp.c[i] - rel.c[i]) * amt + extraCurl, 0, 1.1);
    const spread = (rel.spread + (hp.spread - rel.spread) * amt) * [-0.14, -0.04, 0.05, 0.14][i];
    for (let k = 0; k < 3; k++) {
      const ang = c * JOINT_K[k];
      _fe.set(k === 0 ? spread : 0, 0, -s * ang, 'ZXY'); pq[`${names[i]}${S}${k + 1}`].setFromEuler(_fe);
    }
  }
  // thumb
  const t = hp.t, tr = rel.t;
  const tv = (j) => tr[j] + (t[j] - tr[j]) * amt;
  _fe.set(0, -s * tv(0), -s * tv(1) * 0.8, 'ZXY'); pq['thumb' + S + '1'].setFromEuler(_fe);
  _fe.set(0, 0, -s * tv(2) * 1.1, 'ZXY'); pq['thumb' + S + '2'].setFromEuler(_fe);
  _fe.set(0, 0, -s * tv(3) * 1.2, 'ZXY'); pq['thumb' + S + '3'].setFromEuler(_fe);
}

// ============================================================================================================================
export class Animator {
  constructor(human, clips) {
    this.h = human; this.clips = clips; this.rig = human.rig; this.B = new PoseBuilder(human);
    this.names = this.rig.list.map((b) => b.name); this.nB = this.names.length;
    this.prevQ = new Float32Array(this.nB * 4); this.newQ = new Float32Array(this.nB * 4); this.outQ = new Float32Array(this.nB * 4);
    for (let i = 0; i < this.nB; i++) { this.prevQ[i * 4 + 3] = 1; this.outQ[i * 4 + 3] = 1; this.newQ[i * 4 + 3] = 1; }
    this.prevHips = new THREE.Vector3(); this.hipsPos = new THREE.Vector3(); this.newHips = new THREE.Vector3();
    this.clip = 'idle'; this.fn = clips.idle.fn; this.meta = clips.idle; this.time = 0; this.speed = 1; this.blendDur = 0.2; this.blendT = 1; this.mirror = false; this.params = {}; this.loop = true;
    this.explicit = false; this.prevName = null; this.started = false;
    this.talk = 0; this.talkStyle = 'calm'; this.look = null; this.lookW = 0; this.lookS = 0;
    this.gaze = { y: 0, p: 0 }; this.headYawSm = 0; this.headPitchSm = 0;
    this.restHips = this.rig.rest.hips.p.clone();
    this.legL1 = this.h.layout.dims.thigh; this.legL2 = this.h.layout.dims.shin;
    this.armL1 = this.h.layout.dims.Lu; this.armL2 = this.h.layout.dims.Lf;
    const J = this.h.layout.J;
    this.restDir = {};
    for (const S of ['L', 'R']) {
      this.restDir['leg1' + S] = J['lowerLeg' + S].clone().sub(J['upperLeg' + S]).normalize(); this.restDir['leg2' + S] = J['foot' + S].clone().sub(J['lowerLeg' + S]).normalize();
      this.restDir['arm1' + S] = J['foreArm' + S].clone().sub(J['upperArm' + S]).normalize(); this.restDir['arm2' + S] = J['hand' + S].clone().sub(J['foreArm' + S]).normalize();
    }
    this.seed = (human.profile.seed % 1000) * 0.137;
    this.layerTime = 0; this.t = 0;
  }
  play(clip, o = {}) {
    const meta = this.clips[clip] || this.clips.idle; const name = this.clips[clip] ? clip : 'idle';
    const mirror = !!o.mirror, params = o.params || {};
    const changed = name !== this.clip || mirror !== this.mirror || (o.restart === true);
    if (changed) {
      if (this.started) { this.prevQ.set(this.outQ); this.prevHips.copy(this.hipsPos); this.blendT = 0; this.blendDur = o.blend ?? 0.2; } else { this.blendT = 1; }
      this.clip = name; this.fn = meta.fn; this.meta = meta; this.time = o.time ?? 0; this.mirror = mirror;
    }
    if (o.time !== undefined) { this.time = o.time; this.explicit = true; }
    this.speed = o.speed ?? 1; this.params = params; this.loop = o.loop ?? !meta.once;
    if (o.blend !== undefined && changed) this.blendDur = o.blend;
  }
  /** evaluate the clip at time t into newQ/newHips (applies to bones as a side effect) */
  evaluate(t) {
    const B = this.B, rig = this.rig; const bones = rig.bones;
    B.begin(this.mirror, t, this.params);
    let tt = t;
    if (this.meta.once) tt = Math.min(t, this.meta.dur || 1);
    this.fn(B, tt, this.params, this.h);
    // apply FK
    for (const n of this.names) { bones[n].quaternion.copy(B.pq[n]); }
    // hand poses (clip override or held prop default)
    const held = this.h.held;
    for (const S of ['L', 'R']) {
      let hp = B.handPose[S];
      if (!hp && held && held.handS === S) hp = { pose: held.pose, amt: 1 };
      if (!hp && held && held.offPose && held.handS !== S) hp = { pose: held.offPose, amt: 1 };
      if (!hp) hp = { pose: this.meta.hand || 'relaxed', amt: 1 };
      applyHandPose(B.pq, S, hp.pose, hp.amt, this.h.fingerCurl || 0);
      for (const f of FINGERS) for (let k = 1; k <= 3; k++) { const n = `${f}${S}${k}`; bones[n].quaternion.copy(B.pq[n]); }
    }
    // hips (position computed after IK floor logic)
    const hips = bones.hips; hips.position.copy(this.restHips).add(B.hipsOff);
    // leg IK (hips height may be adjusted to keep the planted legs reachable)
    this.solveLegs(B, hips);
    this.solveArms(B);
    this.newHips.copy(hips.position);
    for (let i = 0; i < this.nB; i++) { const q = bones[this.names[i]].quaternion; this.newQ[i * 4] = q.x; this.newQ[i * 4 + 1] = q.y; this.newQ[i * 4 + 2] = q.z; this.newQ[i * 4 + 3] = q.w; }
  }
  solveLegs(B, hips) {
    const bones = this.rig.bones, J = this.h.layout.J;
    const targets = {};
    // 1. choose hips height if requested: lowest height at which each planted foot is reachable (keeps knees slightly bent)
    const hipsQ = _qa.copy(hips.quaternion);
    let yReq = Infinity; const L1 = this.legL1, L2 = this.legL2;
    for (const S of ['L', 'R']) {
      const f = B.foot[S]; if (!f) continue;
      const ra = B.restAnkle[S];
      const tx = ra.x + f.dx, ty = ra.y + f.dy, tz = ra.z + f.dz;
      targets[S] = _vd.set(tx, ty, tz).clone();
      if (B.hipsMode === 'plant' && f.plant) {
        // hip joint offset relative to hips bone in rest, rotated by hips rotation
        _vb.copy(J['upperLeg' + S]).sub(J.hips).applyQuaternion(hipsQ);
        const dx = tx - (hips.position.x + _vb.x), dz = tz - (hips.position.z + _vb.z);
        const reach = (L1 + L2) * B.hipsLimit; const h2 = reach * reach - dx * dx - dz * dz;
        const yr = ty + (h2 > 0 ? Math.sqrt(h2) : 0) - _vb.y;
        if (yr < yReq) yReq = yr;
      }
    }
    if (B.hipsMode === 'plant' && isFinite(yReq)) { hips.position.y = Math.min(this.restHips.y + (B.hipsMax ?? 0.03), yReq) - (B.hipsDrop || 0) + (B.hipsLift || 0); }
    hips.updateMatrixWorld(false);
    for (const S of ['L', 'R']) {
      const f = B.foot[S]; if (!f) continue;
      const tgt = targets[S];
      const up = bones['upperLeg' + S], lo = bones['lowerLeg' + S], ft = bones['foot' + S], toes = bones['toes' + S];
      fkPos(up, _va); // hip joint (rig-root space) — after hips pose applied (children keep identity so far)
      // recompute using hips transform
      _va.copy(up.position).applyQuaternion(hips.quaternion).add(hips.position);
      const pole = _ve.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
      const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), end = new THREE.Vector3();
      twoBone(_va, tgt, L1, L2, this.restDir['leg1' + S], this.restDir['leg2' + S], pole, q1, q2, end);
      // local rotations
      _qb.copy(hips.quaternion).invert(); up.quaternion.copy(_qb).multiply(q1);
      _qc.copy(q1).invert(); lo.quaternion.copy(_qc).multiply(q2);
      // foot world: yaw then pitch
      _qd.setFromAxisAngle(AY, f.yaw); _qa.setFromAxisAngle(AX, f.pitch); _qd.multiply(_qa);
      ft.quaternion.copy(q2).invert().multiply(_qd);
      toes.quaternion.setFromAxisAngle(AX, f.toe);
    }
  }
  solveArms(B) {
    const bones = this.rig.bones;
    for (const S of ['L', 'R']) {
      const hk = B.hand[S]; if (!hk) continue;
      const up = bones['upperArm' + S], fo = bones['foreArm' + S], hand = bones['hand' + S], cl = bones['clavicle' + S];
      // shoulder position & parent rotation (rig space)
      fkPos(up, _va);
      parentQuat(up, _qb); // world rot of clavicle chain
      let tgt = typeof hk.target === 'function' ? hk.target(_vb) : hk.target; if (!tgt) continue;
      const tv = _vc.copy(tgt);
      const s = S === 'L' ? 1 : -1;
      const pole = hk.pole ? _ve.copy(hk.pole) : _ve.set(s * 0.55, -0.7, -0.45);
      const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), end = new THREE.Vector3();
      const sh = _va.clone();
      twoBone(sh, tv, this.armL1, this.armL2, this.restDir['arm1' + S], this.restDir['arm2' + S], pole, q1, q2, end, 0.999);
      const w = hk.w ?? 1;
      const origUp = up.quaternion.clone(), origFo = fo.quaternion.clone(), origHand = hand.quaternion.clone();
      const pq = _qb.clone(); // parent world
      const loUp = pq.clone().invert().multiply(q1);
      const loFo = q1.clone().invert().multiply(q2);
      up.quaternion.copy(origUp).slerp(loUp, w); fo.quaternion.copy(origFo).slerp(loFo, w);
      if (hk.rot) { const wq = hk.rot.isQuaternion ? hk.rot : new THREE.Quaternion().setFromEuler(hk.rot); const loH = q2.clone().invert().multiply(wq); hand.quaternion.copy(origHand).slerp(loH, w); }
    }
  }
  /** advance time & produce final pose. dt seconds, t = global time (for breathing / noise layers) */
  update(dt, t) {
    this.t = t;
    if (!this.explicit) this.time += dt * this.speed;
    this.explicit = false; this.started = true;
    let ct = this.time;
    const dur = this.meta.dur || 0;
    if (this.meta.once) ct = Math.min(Math.max(0, ct), dur || 1e9);
    this.evaluate(ct);
    // blend
    let k = 1;
    if (this.blendT < 1) { this.blendT += dt / Math.max(1e-4, this.blendDur); k = ease(this.blendT); if (this.blendT >= 1) { this.blendT = 1; k = 1; } }
    const bones = this.rig.bones;
    if (k < 1) {
      for (let i = 0; i < this.nB; i++) {
        _qa.fromArray(this.prevQ, i * 4); _qb.fromArray(this.newQ, i * 4); _qa.slerp(_qb, k); _qa.toArray(this.outQ, i * 4);
      }
      this.hipsPos.copy(this.prevHips).lerp(this.newHips, k);
    } else { this.outQ.set(this.newQ); this.hipsPos.copy(this.newHips); }
    for (let i = 0; i < this.nB; i++) bones[this.names[i]].quaternion.fromArray(this.outQ, i * 4);
    bones.hips.position.copy(this.hipsPos);
    this.applyLayers(dt, t);
  }
  /** breathing, idle micro-motion, talk nods, look-at */
  applyLayers(dt, t) {
    const bones = this.rig.bones, sd = this.seed, E = this.h.energy || 0;
    const m = this.meta;
    const br = m.noBreath ? 0.3 : 1;
    const breath = Math.sin(t * (1.45 + 0.35 * E + this.h.breathRate) * Math.PI * 2 + sd) * 0.5 + 0.5; // 0..1
    const amp = (0.012 + 0.012 * E + 0.02 * (this.h.breathHeavy || 0)) * br;
    _fe.set(-breath * amp * 1.6, 0, 0, 'ZXY'); _qa.setFromEuler(_fe); bones.chest.quaternion.multiply(_qa);
    _fe.set(breath * amp * 0.5, 0, 0, 'ZXY'); _qa.setFromEuler(_fe); bones.neck.quaternion.multiply(_qa);
    // shoulders lift slightly with breath
    for (const S of ['L', 'R']) { _fe.set(0, 0, (S === 'L' ? 1 : -1) * breath * amp * 0.9, 'ZXY'); _qa.setFromEuler(_fe); bones['clavicle' + S].quaternion.multiply(_qa); }
    // idle head micro sway
    const hs = (m.noSway ? 0.3 : 1);
    _fe.set(sn(t * 0.35, sd) * 0.018 * hs, sn(t * 0.27, sd + 3) * 0.03 * hs, sn(t * 0.22, sd + 6) * 0.015 * hs, 'ZXY'); _qa.setFromEuler(_fe); bones.head.quaternion.multiply(_qa);
    // look-at
    this.applyLook(dt);
  }
  applyLook(dt) {
    const h = this.h; const bones = this.rig.bones;
    const target = this.look; const w = damp(this.lookS, target ? this.lookW : 0, 7, dt); this.lookS = w;
    if (!target || w < 0.002) { this.gaze.y = damp(this.gaze.y, 0, 12, dt); this.gaze.p = damp(this.gaze.p, 0, 12, dt); this.headYawSm = damp(this.headYawSm, 0, 8, dt); this.headPitchSm = damp(this.headPitchSm, 0, 8, dt); return; }
    // target in rig-root space
    h.root.updateWorldMatrix(true, false);
    const tl = h.root.worldToLocal(_vb.copy(target));
    // head world position/orientation (rig space) with current pose
    fkPos(bones.head, _va); fkQuat(bones.head, _qa);
    _vc.copy(tl).sub(_va); const dist = _vc.length(); if (dist < 0.05) return;
    // direction in the neck's parent frame
    parentQuat(bones.neck, _qb); _qb.invert(); _vd.copy(_vc).applyQuaternion(_qb).normalize();
    const yaw = Math.atan2(_vd.x, _vd.z), pitch = Math.asin(clamp(-_vd.y, -1, 1)); // pitch + = look down
    const headYaw = clamp(yaw, -1.15, 1.15) * 0.62 * w, headPitch = clamp(pitch, -0.7, 0.8) * 0.5 * w;
    this.headYawSm = damp(this.headYawSm, headYaw, 10, dt); this.headPitchSm = damp(this.headPitchSm, headPitch, 10, dt);
    _fe.set(this.headPitchSm * 0.35, this.headYawSm * 0.4, 0, 'YXZ'); _qa.setFromEuler(_fe); bones.neck.quaternion.premultiply(_qa);
    _fe.set(this.headPitchSm * 0.65, this.headYawSm * 0.6, 0, 'YXZ'); _qa.setFromEuler(_fe); bones.head.quaternion.premultiply(_qa);
    // eyes: residual in head frame
    bones.neck.updateMatrixWorld(false);
    fkQuat(bones.head, _qa); fkPos(bones.head, _va); _qb.copy(_qa).invert();
    _vd.copy(tl).sub(_va).applyQuaternion(_qb).normalize();
    // account for eye offset: use direction from head pivot (small error acceptable)
    const ey = clamp(Math.atan2(_vd.x, _vd.z), -0.6, 0.6) * w, ep = clamp(Math.asin(clamp(-_vd.y, -1, 1)), -0.45, 0.45) * w;
    this.gaze.y = damp(this.gaze.y, ey, 18, dt); this.gaze.p = damp(this.gaze.p, ep, 18, dt);
  }
}
