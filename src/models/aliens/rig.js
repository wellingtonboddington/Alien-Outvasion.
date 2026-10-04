// Vessari skeleton + procedural pose solver (FK spine/neck/head, IK digitigrade legs, IK arms, finger curls, mandible/face rig).
// A "pose" is a flat Float32Array of channels (see CH). Clips write channels; blend = lerp of arrays; applyPose() drives the bones.
import * as THREE from 'three';
import { V3, solve2, quatFromDirAxis } from './util.js';

export const DEG = Math.PI / 180;
export const DIM = {
  hipY: 1.32, hipX: 0.165, hipZ: -0.01,
  thigh: 0.48, shin: 0.50, meta: 0.50, toe: 0.18,
  ballX: 0.185, ballY: 0.035, ballZ: 0.04, metaPitch: 64 * DEG,
  upper: 0.50, fore: 0.58,
  palm: 0.11, fing: [0.12, 0.09, 0.07], thumb: [0.09, 0.07, 0.06],
};
export const HEAD_SCALE = { soldier: 0.8, officer: 0.84, drone: 0.74, hierarch: 0.9 };
export const SPINE = {
  pelvis: [0, 1.32, 0], spine0: [0, 1.40, 0.0], spine1: [0, 1.60, 0.03], spine2: [0, 1.80, 0.06],
  neck0: [0, 1.98, 0.10], neck1: [0, 2.09, 0.145], head: [0, 2.19, 0.19],
};
const SHOULDER = { x: 0.345, y: 1.84, z: 0.05 }, CLAV = { x: 0.08, y: 1.82, z: 0.07 };
const WRIST_REST = [0.44, 0.94, 0.10];

// ---- pose channels ----
const names = ['rX', 'rY', 'rZ', 'rP', 'rYaw', 'rR',
  's0p', 's0y', 's0r', 's1p', 's1y', 's1r', 's2p', 's2y', 's2r',
  'n0p', 'n0y', 'n0r', 'n1p', 'n1y', 'n1r', 'hp', 'hy', 'hr'];
for (const f of ['l', 'r']) for (const k of ['x', 'y', 'z', 'th', 'yaw', 'toe']) names.push(f + 'f' + k); // left/right foot (l = +x side)
for (let i = 0; i < 4; i++) for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'el', 'gr', 'sp']) names.push('a' + i + k); // arm i: 0=R,1=L,2=R lower,3=L lower
names.push('wlh', 'clL', 'clR', 'frill', 'brow', 'eye', 'jt', 'tent', 'cape', 'weap', 'mjaw', 'mwide', 'mround');
export const CH = {}; names.forEach((n, i) => { CH[n] = i; });
export const NCH = names.length;
export const newPose = () => new Float32Array(NCH);

/** neutral standing pose */
export function restPose(p, hasLower = false) {
  p.fill(0);
  p[CH.rY] = 0;
  for (const f of ['l', 'r']) { const s = f === 'l' ? 1 : -1; p[CH[f + 'fx']] = DIM.ballX * s; p[CH[f + 'fy']] = DIM.ballY; p[CH[f + 'fz']] = DIM.ballZ; p[CH[f + 'fth']] = DIM.metaPitch; p[CH[f + 'fyaw']] = 0.12 * s; }
  const base = [WRIST_REST[0] - 0, WRIST_REST[1] - SPINE.spine2[1], WRIST_REST[2] - SPINE.spine2[2]];
  for (let i = 0; i < 2; i++) { const s = i === 1 ? 1 : -1; p[CH['a' + i + 'x']] = base[0] * s; p[CH['a' + i + 'y']] = base[1]; p[CH['a' + i + 'z']] = base[2]; p[CH['a' + i + 'gr']] = 0.35; }
  if (hasLower) for (let i = 2; i < 4; i++) { const s = i === 3 ? 1 : -1; p[CH['a' + i + 'x']] = 0.20 * s; p[CH['a' + i + 'y']] = -0.52; p[CH['a' + i + 'z']] = 0.22; p[CH['a' + i + 'gr']] = 0.3; }
  p[CH.eye] = 1; p[CH.frill] = 0.3; p[CH.wlh] = 0; p[CH.weap] = 0; p[CH.cape] = 0;
  return p;
}

const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), q4 = new THREE.Quaternion(), qI = new THREE.Quaternion();
const e1 = new THREE.Euler(0, 0, 0, 'YXZ');
const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();
const v1 = new V3(), v2 = new V3(), v3 = new V3(), v4 = new V3(), v5 = new V3(), v6 = new V3(), v7 = new V3();
const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);

/**
 * Build the bone hierarchy for a Vessari kind. Returns the rig object (bones, rest data, applyPose).
 */
export function buildRig(kind) {
  const hasLower = kind === 'hierarch';
  const D = DIM; const defs = []; const R = {}; // rest world positions by name
  const def = (name, parent, pos) => { defs.push({ name, parent, pos: Array.isArray(pos) ? new V3(...pos) : pos }); R[name] = defs[defs.length - 1].pos; };
  for (const k of ['pelvis', 'spine0', 'spine1', 'spine2', 'neck0', 'neck1', 'head']) def(k, k === 'pelvis' ? null : ({ spine0: 'pelvis', spine1: 'spine0', spine2: 'spine1', neck0: 'spine2', neck1: 'neck0', head: 'neck1' })[k], SPINE[k]);
  const sides = [['L', 1], ['R', -1]]; const rest = { leg: {}, arm: {} };
  // ---- legs (solve rest IK) ----
  for (const [S, s] of sides) {
    const hip = new V3(D.hipX * s, D.hipY, D.hipZ), ball = new V3(D.ballX * s, D.ballY, D.ballZ);
    const hock = ball.clone().add(new V3(0, Math.sin(D.metaPitch) * D.meta, -Math.cos(D.metaPitch) * D.meta));
    const knee = new V3(), end = new V3(), ax = new V3(); solve2(hip, hock, D.thigh, D.shin, AZ, knee, end, ax);
    def('thigh_' + S, 'pelvis', hip); def('shin_' + S, 'thigh_' + S, knee); def('meta_' + S, 'shin_' + S, end); def('toe_' + S, 'meta_' + S, ball.clone().set(ball.x, ball.y, ball.z));
    rest.leg[S] = { hip, knee: knee.clone(), hock: end.clone(), ball, axis: ax.clone() };
    // metatarsus bone must point from hock to ball: fix ball so length matches
    R['toe_' + S].copy(end).add(ball.clone().sub(end).normalize().multiplyScalar(D.meta));
    rest.leg[S].ball.copy(R['toe_' + S]);
  }
  // ---- arms ----
  const armDefs = [['', 0, 1.0]]; if (hasLower) armDefs.push(['2', 2, 0.74]);
  for (const [sfx, ai, sc] of armDefs) {
    for (const [S, s] of sides) {
      const ci = sfx === '' ? 0 : 1;
      const sh = sfx === '' ? new V3(SHOULDER.x * s, SHOULDER.y, SHOULDER.z) : new V3(0.17 * s, 1.60, 0.12);
      const clavPos = sfx === '' ? new V3(CLAV.x * s, CLAV.y, CLAV.z) : new V3(0.06 * s, 1.62, 0.10);
      const wr = sfx === '' ? new V3(WRIST_REST[0] * s, WRIST_REST[1], WRIST_REST[2]) : new V3(0.22 * s, 1.08, 0.40);
      const l1 = D.upper * sc, l2 = D.fore * sc; const pole = new V3(0.5 * s, -0.3, -0.8);
      const elbow = new V3(), end = new V3(), ax = new V3(); solve2(sh, wr, l1, l2, pole, elbow, end, ax);
      const parent = sfx === '' ? 'spine2' : 'spine1';
      def('clav' + sfx + '_' + S, parent, clavPos); def('uarm' + sfx + '_' + S, 'clav' + sfx + '_' + S, sh); def('farm' + sfx + '_' + S, 'uarm' + sfx + '_' + S, elbow); def('hand' + sfx + '_' + S, 'farm' + sfx + '_' + S, end);
      rest.arm[sfx + S] = { sh, elbow: elbow.clone(), wrist: end.clone(), axis: ax.clone(), l1, l2, pole, s, sc };
      // fingers (3 digits x 3 bones)
      const wp = end; const dg = [
        { n: 'a', base: [0.0, -D.palm * sc, 0.032], dir: [0.03 * s, -1, 0.10], len: D.fing },
        { n: 'b', base: [0.0, -D.palm * sc * 1.02, -0.032], dir: [0.0, -1, -0.10], len: D.fing },
        { n: 't', base: [-0.032 * s, -D.palm * sc * 0.42, 0.052], dir: [-0.38 * s, -0.62, 0.68], len: D.thumb },
      ];
      for (const d of dg) {
        const dir = new V3(...d.dir).normalize(); let pos = wp.clone().add(new V3(...d.base).multiplyScalar(1)); let parentName = 'hand' + sfx + '_' + S;
        d.rest = [];
        for (let k = 0; k < 3; k++) { const nm = 'f' + sfx + d.n + k + '_' + S; def(nm, parentName, pos.clone()); parentName = nm; d.rest.push(pos.clone()); pos = pos.clone().addScaledVector(dir, d.len[k] * sc); }
        d.dirV = dir; d.tip = pos;
      }
      rest.arm[sfx + S].digits = dg;
    }
  }
  // ---- head face bones (rest positions in rig space; head-local offsets resolved by head geometry) ----
  const H = SPINE.head;
  const hs = HEAD_SCALE[kind] || 0.8; const hp = (x, y, z) => new V3(H[0] + x * hs, H[1] + y * hs, H[2] + z * hs);
  for (const [S, s] of sides) {
    def('mandU_' + S, 'head', hp(0.065 * s, -0.015, 0.255)); def('mandL_' + S, 'head', hp(0.05 * s, -0.125, 0.215)); def('brow_' + S, 'head', hp(0.07 * s, 0.12, 0.17));
  }
  def('tongue0', 'head', hp(0, -0.085, 0.20)); def('tongue1', 'tongue0', hp(0, -0.085, 0.29));
  def('crest0', 'head', hp(0, 0.28, -0.10)); def('crest1', 'crest0', hp(0, 0.24, -0.30));
  def('frillL', 'head', hp(0.09, 0.2, -0.16)); def('frillR', 'head', hp(-0.09, 0.2, -0.16));
  def('resp', 'spine2', new V3(0, 1.64, -0.10));
  if (hasLower) { def('cape0', 'spine2', new V3(0, 1.84, -0.04)); def('cape1', 'cape0', new V3(0, 1.30, -0.14)); def('cape2', 'cape1', new V3(0, 0.80, -0.22)); }
  for (const [S, s] of sides) def('tendril_' + S, 'head', hp(0.05 * s, -0.13, 0.28));

  // ---- create THREE.Bones ----
  const bones = [], idx = {}; const group = new THREE.Group(); group.name = 'rig';
  defs.forEach((d, i) => {
    const b = new THREE.Bone(); b.name = d.name; idx[d.name] = i; bones.push(b);
    if (d.parent) { b.position.copy(d.pos).sub(R[d.parent]); bones[idx[d.parent]].add(b); } else { b.position.copy(d.pos); group.add(b); }
  });
  // ---- rest quaternions for IK bones ----
  const restQ = {}; const rq = (name, dir, axis) => { restQ[name] = quatFromDirAxis(dir, axis, new THREE.Quaternion()); };
  for (const [S] of sides) {
    const L = rest.leg[S];
    rq('thigh_' + S, L.knee.clone().sub(L.hip), L.axis); rq('shin_' + S, L.hock.clone().sub(L.knee), L.axis); rq('meta_' + S, L.ball.clone().sub(L.hock), L.axis); rq('toe_' + S, AZ, L.axis);
    for (const sfx of hasLower ? ['', '2'] : ['']) { const A = rest.arm[sfx + S]; rq('uarm' + sfx + '_' + S, A.elbow.clone().sub(A.sh), A.axis); rq('farm' + sfx + '_' + S, A.wrist.clone().sub(A.elbow), A.axis); }
  }
  const rig = { kind, hasLower, bones, idx, R, rest, restQ, group, defs, byName: (n) => bones[idx[n]], skeleton: null };
  // scratch for FK chain matrices
  const M = {}; for (const n of ['pelvis', 'spine0', 'spine1', 'spine2', 'neck0', 'neck1', 'head']) M[n] = new THREE.Matrix4();
  const Mcl = {}; for (const n of ['clavL', 'clavR', 'clav2L', 'clav2R']) Mcl[n] = new THREE.Matrix4();
  rig.M = M;
  const qW = {}; // world (rig-space) quats scratch
  const Qp = new THREE.Quaternion(), Qs = new THREE.Quaternion();
  const knee = new V3(), hockE = new V3(), axL = new V3(), elbow = new V3(), wristE = new V3();
  const hipP = new V3(), pole = new V3(), tgt = new V3(), ballP = new V3();
  const qThigh = new THREE.Quaternion(), qShin = new THREE.Quaternion(), qMeta = new THREE.Quaternion(), qToe = new THREE.Quaternion(), qPar = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
  const qChest = new THREE.Quaternion(), qHandR = new THREE.Quaternion(), qUpper = new THREE.Quaternion(), qFore = new THREE.Quaternion(), qHand = new THREE.Quaternion();
  const eul = (b, x, y, z) => { e1.set(x, y, z, 'YXZ'); b.quaternion.setFromEuler(e1); b.updateMatrix(); };
  const bn = (n) => bones[idx[n]];
  const B = {}; for (const n in idx) B[n] = bones[idx[n]]; rig.B = B;
  const rightWristW = new V3(); const qRightHandW = new THREE.Quaternion(); let haveRight = false;
  const fgOff = new V3(0.0, -0.02, 0.36), fgQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)); // left hand relative to right hand (weapon foregrip), tuned by caller via rig.fg

  rig.fg = { off: fgOff, q: fgQ };
  rig.weaponFollow = { enabled: true };

  const solveLeg = (S, p, sx) => {
    const f = S === 'L' ? 'l' : 'r'; const th = p[CH[f + 'fth']], yaw = p[CH[f + 'fyaw']], toeP = p[CH[f + 'ftoe']];
    ballP.set(p[CH[f + 'fx']], p[CH[f + 'fy']], p[CH[f + 'fz']]);
    const hip = hipP.copy(B['thigh_' + S].position).applyMatrix4(M.pelvis);
    // metatarsus direction from ball up/back to hock (rotated by foot yaw)
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    v1.set(0, Math.sin(th), -Math.cos(th)); // ball->hock direction (yaw 0)
    v2.set(v1.z * sy, v1.y, v1.z * cy);     // yaw about Y: x' = z*sin, z' = z*cos
    hockE.copy(ballP).addScaledVector(v2, D.meta);
    pole.set(Math.sin(yaw * 0.5) * 0.6, 0, 1);
    solve2(hip, hockE, D.thigh, D.shin, pole, knee, v3, axL);
    const kneeP = v4.copy(knee), hockP = v5.copy(v3);
    qPar.setFromRotationMatrix(M.pelvis);
    quatFromDirAxis(v6.copy(kneeP).sub(hip), axL, qThigh).multiply(qTmp.copy(restQ['thigh_' + S]).invert());
    quatFromDirAxis(v6.copy(hockP).sub(kneeP), axL, qShin).multiply(qTmp.copy(restQ['shin_' + S]).invert());
    // meta: from hock down to ball
    const ballA = v7.copy(hockP).addScaledVector(v2, -D.meta);
    // axis for foot plane: rotate hinge axis by yaw
    const ax2 = v1.copy(axL).applyAxisAngle(AY, yaw * 0.5);
    quatFromDirAxis(v6.copy(ballA).sub(hockP), ax2, qMeta).multiply(qTmp.copy(restQ['meta_' + S]).invert());
    // toe: horizontal forward (yaw) pitched down by toeP
    v6.set(Math.sin(yaw) * Math.cos(toeP), -Math.sin(toeP), Math.cos(yaw) * Math.cos(toeP));
    quatFromDirAxis(v6, ax2, qToe).multiply(qTmp.copy(restQ['toe_' + S]).invert());
    B['thigh_' + S].quaternion.copy(qPar).invert().multiply(qThigh);
    B['shin_' + S].quaternion.copy(qThigh).invert().multiply(qShin);
    B['meta_' + S].quaternion.copy(qShin).invert().multiply(qMeta);
    B['toe_' + S].quaternion.copy(qMeta).invert().multiply(qToe);
  };

  const curl = (S, sfx, ai, p) => {
    const A = rest.arm[sfx + S]; const gr = p[CH['a' + ai + 'gr']], sp = p[CH['a' + ai + 'sp']], s = A.s;
    const wts = [0.85, 1.15, 0.9];
    for (const d of A.digits) {
      const isT = d.n === 't';
      for (let k = 0; k < 3; k++) {
        const b = B['f' + sfx + d.n + k + '_' + S];
        if (!isT) { q1.setFromAxisAngle(AZ, -s * gr * wts[k] * 1.25); if (k === 0) { q2.setFromAxisAngle(AY, (d.n === 'a' ? 1 : -1) * sp * 0.35); q1.premultiply(q2); } }
        else { // thumb curls about an axis perpendicular to its direction, towards the palm
          v1.copy(d.dirV).cross(v2.set(-s, 0, -0.3)).normalize(); q1.setFromAxisAngle(v1, -gr * wts[k] * (k === 0 ? 0.55 : 0.95)); if (k === 0) { q2.setFromAxisAngle(AY, -s * sp * 0.4); q1.premultiply(q2); }
        }
        b.quaternion.copy(q1);
      }
    }
  };

  const solveArm = (S, sfx, ai, p) => {
    const A = rest.arm[sfx + S]; const s = A.s; const cn = sfx === '' ? 'spine2' : 'spine1';
    const cl = B['clav' + sfx + '_' + S]; const clq = sfx === '' ? p[CH['cl' + S]] : 0;
    // clavicle: small shrug/lift following shoulder raise
    q1.setFromEuler(e1.set(0, 0, -s * clq * 0.5, 'YXZ')); cl.quaternion.copy(q1); cl.updateMatrix();
    const Mc = Mcl['clav' + sfx + S] || (Mcl['clav' + sfx + S] = new THREE.Matrix4());
    Mc.multiplyMatrices(M[cn], cl.matrix);
    const sh = v1.copy(B['uarm' + sfx + '_' + S].position).applyMatrix4(Mc);
    qChest.setFromRotationMatrix(Mc);
    // target in chest frame (relative to spine origin)
    let tx = p[CH['a' + ai + 'x']], ty = p[CH['a' + ai + 'y']], tz = p[CH['a' + ai + 'z']];
    let rx = p[CH['a' + ai + 'rx']], ry = p[CH['a' + ai + 'ry']], rz = p[CH['a' + ai + 'rz']];
    const useW = ai === 1 && p[CH.wlh] > 0.001 && haveRight;
    const tp = tgt.set(tx, ty, tz).applyMatrix4(M[cn]);
    // M[cn] includes the spine origin translation; the pose values are relative to spine origin so that's what we want
    if (useW) { // blend towards weapon foregrip following the right hand
      const w = p[CH.wlh]; v2.copy(fgOff).applyQuaternion(qRightHandW).add(rightWristW); tp.lerp(v2, w);
    }
    // elbow pole direction in chest frame -> world
    const el = p[CH['a' + ai + 'el']]; pole.copy(A.pole).normalize().applyAxisAngle(v3.copy(tp).sub(sh).normalize(), el).applyQuaternion(qPar.setFromRotationMatrix(M[cn]));
    solve2(sh, tp, A.l1, A.l2, pole, elbow, wristE, v3);
    const ax = v3;
    quatFromDirAxis(v2.copy(elbow).sub(sh), ax, qUpper).multiply(qTmp.copy(restQ['uarm' + sfx + '_' + S]).invert());
    quatFromDirAxis(v2.copy(wristE).sub(elbow), ax, qFore).multiply(qTmp.copy(restQ['farm' + sfx + '_' + S]).invert());
    B['uarm' + sfx + '_' + S].quaternion.copy(qChest).invert().multiply(qUpper);
    B['farm' + sfx + '_' + S].quaternion.copy(qUpper).invert().multiply(qFore);
    // hand orientation in chest frame
    qHand.setFromAxisAngle(AY, ry); qTmp.setFromAxisAngle(AX, rx); qHand.multiply(qTmp); qTmp.setFromAxisAngle(AY, rz); qHand.multiply(qTmp); qHand.premultiply(qPar.setFromRotationMatrix(M[cn]));
    if (useW) { const w = p[CH.wlh]; qTmp.copy(qRightHandW).multiply(fgQ); qHand.slerp(qTmp, w); }
    B['hand' + sfx + '_' + S].quaternion.copy(qFore).invert().multiply(qHand);
    if (ai === 0) { rightWristW.copy(wristE); qRightHandW.copy(qHand); haveRight = true; }
    curl(S, sfx, ai, p);
  };

  /** Drive all bones from the pose p and mouth params m (jaw,wide,round,press,tuck,teeth,tongue) + extras. */
  rig.applyPose = (p, m, ex) => {
    const s = rig.bodyScale || 1;
    const pel = B.pelvis; pel.position.set(SPINE.pelvis[0] + p[CH.rX], SPINE.pelvis[1] + p[CH.rY], SPINE.pelvis[2] + p[CH.rZ]);
    e1.set(p[CH.rP], p[CH.rYaw], p[CH.rR], 'YXZ'); pel.quaternion.setFromEuler(e1); pel.updateMatrix(); M.pelvis.copy(pel.matrix);
    const chain = [['spine0', 's0'], ['spine1', 's1'], ['spine2', 's2'], ['neck0', 'n0'], ['neck1', 'n1'], ['head', 'h']]; let par = 'pelvis';
    for (const [bnm, k] of chain) { const b = B[bnm]; e1.set(p[CH[k + 'p']], p[CH[k + 'y']], p[CH[k + 'r']], 'YXZ'); b.quaternion.setFromEuler(e1); b.updateMatrix(); M[bnm].multiplyMatrices(M[par], b.matrix); par = bnm; }
    haveRight = false;
    solveLeg('L', p); solveLeg('R', p);
    solveArm('R', '', 0, p); solveArm('L', '', 1, p);
    if (hasLower) { solveArm('R', '2', 2, p); solveArm('L', '2', 3, p); }
    // ---- face: mandibles, brows, tongue ----
    const jaw = Math.min(1.2, (m.jaw || 0) + p[CH.mjaw]), wide = Math.min(1.2, (m.wide || 0) + p[CH.mwide]), round = Math.min(1.2, (m.round || 0) + p[CH.mround]), press = m.press || 0, tuck = m.tuck || 0, tongue = m.tongue || 0;
    const jt = p[CH.jt] || 0;
    for (const [S, sg] of sides) {
      // +yaw about Y swings a +z tip toward +x, so 'open' = sg * amount (L side is +x). Upper (outer) mandibles hang down & curve inward; lower ones are tusks pointing forward/up.
      const openU = 0.03 + 0.50 * jaw + 0.70 * wide - 0.60 * round - 0.10 * press + jt * 0.30 * (S === 'L' ? 1 : -0.6);
      const pitU = -0.18 * jaw + 0.30 * round - 0.08 * press + jt * 0.1;
      B['mandU_' + S].quaternion.setFromEuler(e1.set(pitU, sg * openU, 0, 'YXZ'));
      const openL = 0.02 + 0.18 * jaw + 0.45 * wide - 0.45 * round - 0.08 * press + jt * 0.25 * (S === 'L' ? -0.6 : 1);
      const pitL = 0.05 + 0.95 * jaw + 0.25 * tuck - 0.25 * press - 0.12 * round + jt * 0.35;
      B['mandL_' + S].quaternion.setFromEuler(e1.set(pitL, sg * openL, 0, 'YXZ'));
    }
    B.tongue0.quaternion.setFromEuler(e1.set(-0.2 - 0.9 * tongue + 0.3 * jaw, 0, 0, 'YXZ')); B.tongue1.quaternion.setFromEuler(e1.set(-0.3 * tongue + 0.2, 0, 0, 'YXZ'));
    const brow = p[CH.brow];
    B.brow_L.quaternion.setFromEuler(e1.set(0, 0, -brow * 0.5, 'YXZ')); B.brow_R.quaternion.setFromEuler(e1.set(0, 0, brow * 0.5, 'YXZ'));
    const fr = p[CH.frill];
    B.frillL.quaternion.setFromEuler(e1.set(0, -0.15 - fr * 0.95, 0.1, 'YXZ')); B.frillR.quaternion.setFromEuler(e1.set(0, 0.15 + fr * 0.95, -0.1, 'YXZ'));
    B.crest0.quaternion.setFromEuler(e1.set(-0.25 * fr + (ex?.crestLag || 0) * 0.5, 0, 0, 'YXZ')); B.crest1.quaternion.setFromEuler(e1.set(-0.2 * fr + (ex?.crestLag || 0) * 0.8, 0, 0, 'YXZ'));
    // respirator organ breathing
    const br = ex?.breath || 0; B.resp.scale.set(1 + br * 0.05, 1 + br * 0.08, 1 + br * 0.05);
    if (hasLower) { const c = p[CH.cape] + (ex?.capeLag || 0); B.cape0.quaternion.setFromEuler(e1.set(0.12 + c * 0.5, 0, 0, 'YXZ')); B.cape1.quaternion.setFromEuler(e1.set(0.08 + c * 0.8, 0, 0, 'YXZ')); B.cape2.quaternion.setFromEuler(e1.set(0.05 + c * 1.1, 0, 0, 'YXZ')); }
    for (const [S, sg] of sides) B['tendril_' + S].quaternion.setFromEuler(e1.set((ex?.tendLag || 0) + 0.15 * jaw, (ex?.tendSway || 0) * sg, (ex?.tendSway || 0) * 0.6 * sg, 'YXZ'));
  };
  /** finish: create skeleton after meshes are ready */
  rig.makeSkeleton = () => {
    group.updateMatrixWorld(true); rig.skeleton = new THREE.Skeleton(bones); return rig.skeleton;
  };
  rig.rightWrist = rightWristW; rig.rightHandQ = qRightHandW;
  return rig;
}
