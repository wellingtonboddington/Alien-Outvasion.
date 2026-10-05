// Vessari TRIPOD hero: 30 m tall war machine on three long segmented legs with claw feet, bone-tan shell hull, ribbed slate-blue flesh,
// scanning cyan eye-slit, belly "lamprey mouth" cannon, snaking pincer tentacle. ONE skinned mesh (3 draw calls: flesh / shell / glow) + a few
// small meshes (eye, cannon core, halos). Real 2-bone IK legs with a world-space foot-planting gait controller.
import * as THREE from 'three';
import { RNG, Q, seg, damp, clamp, lerp, TAU, disposeTree, smoothstep } from '../../engine/common.js';
import { tube } from '../../engine/geo.js';
import { shellMat, fleshMat, glowMat, haloMat, infectAll, CYAN, GREEN } from './mats.js';
import { revolve, surface, blob, spike, place, smoothNormals, scaleUV, mergeAll, alignY, basisQuat, torus, scute, ellipsoidBase, orient, SkinSet, ik2, sstep } from './kit.js';

const V3 = THREE.Vector3, Qt = THREE.Quaternion, M4 = THREE.Matrix4;
const AX_X = new V3(1, 0, 0), AX_Y = new V3(0, 1, 0);
const _qs = new Qt(), _eulS = new THREE.Euler();
const qRy = (a) => new Qt().setFromAxisAngle(AX_Y, a);
const qRx = (a) => new Qt().setFromAxisAngle(AX_X, a);
const mulRy = (q, a) => q.multiply(_qs.setFromAxisAngle(AX_Y, a));
const mulRx = (q, a) => q.multiply(_qs.setFromAxisAngle(AX_X, a));
const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------------------ design constants (design scale = 30 m)
const PH = 21.0;                                   // nominal pelvis height
const HIP_R = 2.3, HIP_DY = -0.5;
const LEG_AZ = [58 * DEG, -58 * DEG, 180 * DEG];   // azimuth from +Z towards +X: front-left, front-right, rear
const HOME_R = [9.2, 9.2, 9.8];
const L1 = 9.8, L2 = 11.8;
const ANK = new V3(0, 2.6, -0.3);                  // ankle offset in foot frame
const TOE_AZ = [-42 * DEG, 0, 42 * DEG, 180 * DEG];
const TOE_LEN = [5.0, 5.8, 5.0, 3.4];
const HEAD_PIVOT = new V3(0, 4.7, 0.3);
const CANNON_BASE = new V3(0, 0.1, 2.4);
const CANNON_DIR = new V3(0, -0.5, 0.87).normalize();
const TENT_BASE = new V3(-2.1, 1.9, 2.3);
const TENT_DIR = new V3(-0.35, -0.42, 0.84).normalize();
const NT = 15, TENT_LEN = 17.0, TSEG = TENT_LEN / (NT - 1);
const B = { pelvis: 0, head: 1, cannon: 2, thigh: 3, shin: 6, foot: 9, toe: 12, tent: 36, claw: 36 + NT };
const NBONES = B.claw + 3;
const toeIdx = (leg, toe, s) => B.toe + leg * 8 + toe * 2 + s;
const HIP_LOCAL = LEG_AZ.map((a) => new V3(Math.sin(a) * HIP_R, HIP_DY, Math.cos(a) * HIP_R));
const POLE = LEG_AZ.map((a) => new V3(Math.sin(a), 0.2, Math.cos(a)).normalize());
const EYE_Y = 0.6;                                  // eye height in head-local space
const HEAD_C = new V3(0, 1.3, 0.7), HEAD_R = new V3(3.2, 3.0, 4.2);
const headSurfZ = (x, y) => HEAD_C.z + HEAD_R.z * Math.sqrt(Math.max(0.0001, 1 - (x / HEAD_R.x) ** 2 - ((y - HEAD_C.y) / HEAD_R.y) ** 2));

function catmull(pts) { // 1D catmull-rom through [x,y] control points
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1]; if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    let i = 0; while (x > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = (x - p1[0]) / (p2[0] - p1[0]), t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  };
}
const TORSO_R = catmull([[0, 1.9], [0.8, 2.75], [1.8, 3.35], [3.0, 3.5], [4.0, 3.1], [4.8, 2.45], [5.3, 2.1], [5.8, 2.0]]);   // radius vs y above pelvis(+0.0), torso starts at y=0
const TORSO_RATIO = 1.1, TORSO_H = 5.4;

// ------------------------------------------------------------------------------------------------ pose
function newPose() { return { p: Array.from({ length: NBONES }, () => new V3()), q: Array.from({ length: NBONES }, () => new Qt()) }; }
const _t1 = new V3(), _t2 = new V3(), _t3 = new V3(), _q1 = new Qt(), _q2 = new Qt(), _knee = new V3(), _ank = new V3(), _pole = new V3(), _dir = new V3();
const tentRestQ = new Qt().copy(basisQuat(TENT_DIR, new V3(0, 1, 0)));
const cannonRestQ = new Qt().copy(basisQuat(CANNON_DIR, new V3(0, 0, 1)));
const CLAW_AZ = [0, TAU / 3, 2 * TAU / 3];

/** fill pose from state. state: {pelvisP, pelvisQ, headYaw, headPitch, cannonYaw, cannonPitch, feet[3]{p,q,curl}, tent[NT] (pelvis-local joints), clawOpen} */
function computePose(st, pose) {
  const { p: P, q: Q } = pose; const Qp = st.pelvisQ, Pp = st.pelvisP;
  P[0].copy(Pp); Q[0].copy(Qp);
  P[1].copy(HEAD_PIVOT).applyQuaternion(Qp).add(Pp); Q[1].copy(Qp).multiply(_q1.setFromEuler(_eulS.set(st.headPitch, st.headYaw, 0, 'YXZ')));
  P[2].copy(CANNON_BASE).applyQuaternion(Qp).add(Pp); Q[2].copy(Qp).multiply(_q1.setFromEuler(_eulS.set(st.cannonPitch, st.cannonYaw, 0, 'YXZ'))).multiply(cannonRestQ);
  for (let i = 0; i < 3; i++) {
    const hip = P[B.thigh + i].copy(HIP_LOCAL[i]).applyQuaternion(Qp).add(Pp);
    const f = st.feet[i];
    _ank.copy(ANK).applyQuaternion(f.q).add(f.p);
    _pole.copy(POLE[i]).applyQuaternion(Qp);
    ik2(hip, _ank, L1, L2, _pole, _knee);
    Q[B.thigh + i].copy(basisQuat(_dir.subVectors(_knee, hip), _pole, _q2));
    P[B.shin + i].copy(_knee); Q[B.shin + i].copy(basisQuat(_dir.subVectors(_ank, _knee), _pole, _q2));
    P[B.foot + i].copy(f.p); Q[B.foot + i].copy(f.q);
    for (let t = 0; t < 4; t++) {
      const az = TOE_AZ[t]; const b0 = toeIdx(i, t, 0), b1 = toeIdx(i, t, 1);
      P[b0].set(Math.sin(az) * 0.85, 0.5, Math.cos(az) * 0.85).applyQuaternion(f.q).add(f.p);
      const c = f.curl; const c0 = c * (t === 3 ? -0.35 : 0.35), c1 = c * (t === 3 ? -0.7 : 1.1);
      mulRx(mulRy(Q[b0].copy(f.q), az), c0);
      const zK = TOE_LEN[t] * 0.46;
      P[b1].set(0, 0.45, zK).applyQuaternion(Q[b0]).add(P[b0]); mulRx(Q[b1].copy(Q[b0]), c1);
    }
  }
  // tentacle
  for (let j = 0; j < NT; j++) {
    P[B.tent + j].copy(st.tent[j]).applyQuaternion(Qp).add(Pp);
    _dir.subVectors(j === NT - 1 ? st.tent[NT - 1] : st.tent[j + 1], j === NT - 1 ? st.tent[NT - 2] : st.tent[j]).normalize();
    _q1.setFromUnitVectors(TENT_DIR, _dir).multiply(tentRestQ); Q[B.tent + j].copy(Qp).multiply(_q1);
  }
  const tipQ = Q[B.tent + NT - 1], tipP = P[B.tent + NT - 1];
  for (let k = 0; k < 3; k++) {
    P[B.claw + k].copy(tipP);
    // finger k hinges about the tangent axis (local to tip frame); built at azimuth CLAW_AZ[k] around tip +Y
    const ax = _t1.set(Math.sin(CLAW_AZ[k] + Math.PI / 2), 0, Math.cos(CLAW_AZ[k] + Math.PI / 2)).normalize();
    Q[B.claw + k].copy(tipQ).multiply(_q1.setFromAxisAngle(ax, st.clawOpen));
  }
}
const boneMatrix = (pose, i, out = new M4()) => out.compose(pose.p[i], pose.q[i], new V3(1, 1, 1));

// ------------------------------------------------------------------------------------------------ geometry
function ribBump(f, sharp = 0.6) { return Math.pow(Math.sin(Math.PI * (f - Math.floor(f))), sharp); }

function legBone(S, rest, bone, len, r0, r1, rng, shin) {
  const M = boneMatrix(rest, bone);
  const ribs = Math.round(len / 1.15);
  const rad = (t) => lerp(r0, r1, t) * (1 + 0.07 * Math.sin(Math.PI * t));
  S.add('flesh', revolve(len, (t, y) => rad(t) * (0.9 + 0.12 * ribBump(t * ribs)), { rings: ribs * 3, radial: 8, tile: 2.5 }), bone, { matrix: M });
  // shell collars every 3rd rib boundary
  for (let k = 1; k * 3 < ribs; k++) {
    const t = k * 3 / ribs, y = t * len, R = rad(t);
    S.add('shell', revolve(0.55, (u) => R * (1.1 + 0.2 * Math.pow(Math.sin(Math.PI * u), 0.55)), { rings: 4, radial: 10, tile: 1.0 }).translate(0, y - 0.275, 0), bone, { matrix: M, color: 0xfff4e0 });
  }
  // dorsal armour strip on the knee-bend (+Z) side: segmented bone plates
  const nseg = Math.round(len / 1.8);
  for (let k = 0; k < nseg; k++) {
    const t0 = (k + 0.08) / nseg, t1 = (k + 0.92) / nseg;
    const g = surface(8, 4, (u, v, o) => {
      const t = lerp(t0, t1, v), a = lerp(-0.62, 0.62, u) * (0.75 + 0.25 * Math.sin(Math.PI * v)); const R = rad(t) * (1.02 + 0.2 * Math.pow(Math.sin(Math.PI * v), 0.5) * Math.pow(Math.cos(a * 1.4), 0.7));
      o.set(Math.sin(a) * R, t * len, Math.cos(a) * R);
    }, { uvScale: [0.7, 0.6] });
    S.add('shell', orient(g, 0, len * (t0 + t1) / 2, 0), bone, { matrix: M, color: 0xfff4e0 });
  }
  // luminous organs
  const lights = [];
  for (let k = 1; k < ribs; k += 3) { const t = (k + 0.5) / ribs; const g = new THREE.SphereGeometry(0.12, 6, 4); g.scale(1, 1.4, 1); g.translate(0, t * len, rad(t) * 0.98); lights.push(g); }
  if (lights.length) S.add('glow', mergeAll(lights), bone, { matrix: M });
  // joint balls
  if (!shin) { S.add('shell', blob(1.2, 1.2, 1.2, { w: seg(16, 10), h: seg(10, 6), tile: 1.2 }), bone, { matrix: M, color: 0xfff4e0 }); }
}

function buildTripodGeometry(rest, rng) {
  const S = new SkinSet(['flesh', 'shell', 'glow']);
  const Mp = boneMatrix(rest, B.pelvis);
  // ===== pelvis hub + torso (bone: pelvis) =====
  S.add('flesh', blob(3.0, 1.55, 3.2, { w: 28, h: 14, tile: 4 }).translate(0, 0.0, 0.1), B.pelvis, { matrix: Mp });
  S.add('flesh', revolve(TORSO_H + 0.6, (t, y) => TORSO_R(y) * (1 + 0.05 * ribBump(y / 0.5, 1.0)), { rings: seg(46, 26), radial: seg(26, 12), tile: 4, ratio: TORSO_RATIO }), B.pelvis, { matrix: Mp });
  // dorsal armour (overlapping plates), chest plate with ridges, and lateral bone ribs; dark ribbed flesh shows between
  const torsoPlate = (y0, y1, c, half, thick, ridges = 0) => {
    const g = surface(16, 8, (u, v, o) => {
      const a = c + lerp(-half, half, u), y = lerp(y0, y1, v);
      const edge = Math.pow(Math.sin(Math.PI * v), 0.45) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u * 2 - 1), 3.0)), 0.55);
      const r = TORSO_R(y) + 0.03 + thick * edge + (ridges ? 0.07 * Math.pow(Math.abs(Math.sin(v * Math.PI * ridges)), 2) * edge : 0);
      o.set(Math.sin(a) * r, y, Math.cos(a) * r * TORSO_RATIO);
    }, { uvScale: [2.4, 1.0] });
    S.add('shell', orient(g, 0, (y0 + y1) / 2, 0), B.pelvis, { matrix: Mp, color: 0xf0e4ca });
  };
  for (let k = 0; k < 4; k++) torsoPlate(0.7 + k * 1.0, 0.7 + k * 1.0 + 1.35, Math.PI + (k % 2 ? 0.07 : -0.06), 1.05 - k * 0.07, 0.4);
  torsoPlate(1.6, 4.3, 0.0, 0.74, 0.34, 3);
  for (let k = 0; k < 6; k++) for (const sd of [-1, 1]) {
    const y = 1.0 + k * 0.7 + 0.1 * sd; const pts = []; const n = 7; const c = sd * Math.PI / 2;
    for (let i = 0; i <= n; i++) { const f = i / n; const a = c + lerp(-0.85, 0.85, f); const yy = y + 0.22 * Math.sin((f - 0.5) * 3.0) * sd; const R = TORSO_R(yy) + 0.1; pts.push(new V3(Math.sin(a) * R, yy, Math.cos(a) * R * TORSO_RATIO)); }
    const g = tube(pts, [0.06, 0.15, 0.2, 0.22, 0.22, 0.2, 0.15, 0.06], { radial: 6, segsPerPoint: 2 }); scaleUV(g, 1, 6);
    S.add('shell', g, B.pelvis, { matrix: Mp, color: 0xe8dcc0 });
  }
  // hip sockets: bone rings around each leg root
  for (let i = 0; i < 3; i++) {
    const h = HIP_LOCAL[i]; const dir = new V3().subVectors(rest.p[B.shin + i], rest.p[B.thigh + i]).normalize();
    const dl = dir.clone().applyQuaternion(rest.q[B.pelvis].clone().invert());
    const g = torus(1.45, 0.38, 20, 8, { tile: 1.6 }); g.rotateX(-Math.PI / 2); place(g, [h.x, h.y, h.z], alignZto(dl));
    S.add('shell', g, B.pelvis, { matrix: Mp, color: 0xfff4e0 });
    const g2 = blob(1.9, 1.0, 1.9, { w: 14, h: 8, tile: 3 }); place(g2, [h.x * 0.72, h.y + 0.5, h.z * 0.72]); S.add('shell', g2, B.pelvis, { matrix: Mp, color: 0xfff4e0 });
  }
  // dorsal spines + respirator tubes on the back
  for (let k = 0; k < 6; k++) {
    const y = 0.9 + k * 0.72, R = TORSO_R(y) * TORSO_RATIO; const len = 1.1 + 1.0 * Math.sin(Math.PI * (k + 0.5) / 6);
    const sp = spike(len, 0.2 + 0.05 * k * 0.3, 6); sp.scale(0.6, 1, 1.2); place(sp, [0, y, -R + 0.05], alignYdir(new V3(0, 0.55, -0.85)));
    S.add('shell', sp, B.pelvis, { matrix: Mp, color: 0xfff4e0 });
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
    const x0 = sx * (0.7 + k * 0.7);
    const pts = [new V3(x0, 0.9, -3.2), new V3(x0 * 1.4, 2.6, -4.6 - k * 0.2), new V3(x0 * 1.2, 4.4, -4.6 - k * 0.1), new V3(x0 * 0.9, 5.8, -3.9)];
    const g = tube(pts, [0.36, 0.34, 0.3, 0.26], { radial: 8, segsPerPoint: 6 }); scaleUV(g, 1, 4); S.add('flesh', g, B.pelvis, { matrix: Mp });
    const bell = revolve(0.9, (t) => 0.3 + 0.28 * Math.pow(t, 1.5) * 1.3, { rings: 5, radial: 10, tile: 1 }); place(bell, [x0 * 0.9, 5.8, -3.9], alignYdir(new V3(-sx * 0.05, 0.9, 0.45))); S.add('shell', bell, B.pelvis, { matrix: Mp, color: 0xfff4e0 });
    const glw = new THREE.SphereGeometry(0.3, 10, 6); glw.scale(1, 0.55, 1); place(glw, [x0 * 0.9 + 0.0, 6.05, -3.75]); S.add('glow', glw, B.pelvis, { matrix: Mp });
  }
  // neck collar
  S.add('flesh', revolve(1.4, (t) => 2.2 - 0.25 * Math.sin(Math.PI * t) + 0.1 * ribBump(t * 4), { rings: 10, radial: 20, tile: 3 }).translate(0, 4.1, 0.2), B.pelvis, { matrix: Mp });
  S.add('shell', torus(2.3, 0.3, 24, 8, { tile: 1.6 }).translate(0, 4.15, 0.1), B.pelvis, { matrix: Mp, color: 0xfff4e0 });
  // belly tendrils (static, hang under the torso)
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + 0.3, r = 1.2 + 0.3 * (k % 2);
    const base = new V3(Math.sin(a) * r, -1.0, Math.cos(a) * r - 0.2);
    const pts = [base, base.clone().add(new V3(Math.sin(a) * 0.4, -1.1, Math.cos(a) * 0.4)), base.clone().add(new V3(Math.sin(a) * 0.5, -2.4, Math.cos(a) * 0.7 + 0.2)), base.clone().add(new V3(Math.sin(a) * 0.3, -3.5, Math.cos(a) * 0.9 + 0.6))];
    S.add('flesh', tube(pts, [0.2, 0.17, 0.11, 0.025], { radial: 6, segsPerPoint: 4 }), B.pelvis, { matrix: Mp });
  }
  // bristles on the thorax
  { const sp = []; for (let i = 0; i < 40; i++) { const y = rng.range(1.2, 4.6), a = rng.range(0, TAU); const R = TORSO_R(y) * 1.0; const n = new V3(Math.sin(a), 0.25, Math.cos(a) * 1.0).normalize();
      const g = spike(rng.range(0.5, 1.4), 0.03, 4); place(g, [Math.sin(a) * R, y, Math.cos(a) * R * TORSO_RATIO], alignYdir(n)); sp.push(g); }
    S.add('flesh', mergeAll(sp), B.pelvis, { matrix: Mp, color: 0x302418 }); }

  // ===== head (bone: head) =====
  buildHead(S, rest, rng);
  // ===== cannon =====
  buildCannon(S, rest, rng);
  // ===== legs =====
  for (let i = 0; i < 3; i++) {
    legBone(S, rest, B.thigh + i, L1, 0.82, 0.5, rng, false);
    // knee knuckle + spikes on the shin origin (bone shin)
    const Ms = boneMatrix(rest, B.shin + i);
    S.add('shell', blob(0.95, 0.95, 1.15, { w: seg(16, 10), h: seg(10, 6), tile: 1.1 }), B.shin + i, { matrix: Ms, color: 0xfff4e0 });
    const ks = spike(2.8, 0.42, 6); place(ks, [0, 0, 0.7], alignYdir(new V3(0, 0.25, 1))); S.add('shell', ks, B.shin + i, { matrix: Ms, color: 0xfff4e0 });
    for (const sx of [-1, 1]) { const s2 = spike(1.5, 0.22, 5); place(s2, [sx * 0.5, 0.5, 0.6], alignYdir(new V3(sx * 0.7, 0.45, 0.8))); S.add('shell', s2, B.shin + i, { matrix: Ms, color: 0xfff4e0 }); }
    legBone(S, rest, B.shin + i, L2, 0.54, 0.3, rng, true);
    // ankle ball on the foot bone region (rides shin end)
    const ankleBall = blob(0.55, 0.55, 0.55, { w: 12, h: 8, tile: 1.5 }); ankleBall.translate(0, L2, 0); S.add('shell', ankleBall, B.shin + i, { matrix: Ms, color: 0xfff4e0 });
    buildFoot(S, rest, i, rng);
    // tendon cables across the knee (blended thigh->shin)
    for (const [ox, oz] of [[-0.35, -0.5], [0.35, -0.5], [0, -0.62]]) {
      const hipP = rest.p[B.thigh + i], kneeP = rest.p[B.shin + i], ankP = _ank.copy(ANK).applyQuaternion(rest.q[B.foot + i]).add(rest.p[B.foot + i]).clone();
      const Mt = boneMatrix(rest, B.thigh + i), Msh = boneMatrix(rest, B.shin + i);
      const pts = [];
      const up = [0.5, 0.72, 0.9, 1.0]; // along the thigh
      for (const u of up) pts.push(new V3(ox * (0.5 + 0.3 * u), L1 * u * 0.995, oz * (0.7 + 0.2 * u)).applyMatrix4(Mt));
      for (const u of [0.1, 0.28, 0.5]) pts.push(new V3(ox * 0.7, L2 * u, oz * 0.8).applyMatrix4(Msh));
      const g = tube(pts, [0.07, 0.065, 0.06, 0.06, 0.06, 0.055, 0.05], { radial: 5, segsPerPoint: 2 });
      const axis = new V3().subVectors(ankP, hipP).normalize();
      S.addBlend('flesh', g, (x, y, z) => { const t = sstep(-1.1, 1.1, (x - kneeP.x) * axis.x + (y - kneeP.y) * axis.y + (z - kneeP.z) * axis.z); return [B.thigh + i, 1 - t, B.shin + i, t]; }, { color: 0x20303c });
    }
  }
  // ===== tentacle =====
  buildTentacle(S, rest, rng);
  return S.build();
}

const alignYdir = (d) => new Qt().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
const alignZto = (d) => new Qt().setFromUnitVectors(new V3(0, 0, 1), d.clone().normalize());

function buildFoot(S, rest, i, rng) {
  const bone = B.foot + i, M = boneMatrix(rest, bone);
  S.add('flesh', blob(1.15, 0.5, 1.45, { w: 14, h: 8, tile: 2 }).translate(0, 0.65, 0.05), bone, { matrix: M });
  const strut = tube([new V3(0, 0.7, 0), new V3(0, 1.6, -0.18), new V3(ANK.x, ANK.y, ANK.z)], [0.46, 0.4, 0.34], { radial: 8, segsPerPoint: 4 }); scaleUV(strut, 1, 2); S.add('flesh', strut, bone, { matrix: M });
  S.add('shell', blob(0.62, 0.6, 0.62, { w: 12, h: 8, tile: 1.5 }).translate(0, 1.3, -0.1), bone, { matrix: M, color: 0xfff4e0 });
  for (let t = 0; t < 4; t++) {
    const az = TOE_AZ[t], len = TOE_LEN[t], zK = len * 0.46;
    const Mt0 = boneMatrix(rest, toeIdx(i, t, 0));
    const wf = (x, y, z) => { const w = sstep(zK - 0.7, zK + 0.7, z); return [toeIdx(i, t, 0), 1 - w, toeIdx(i, t, 1), w]; };
    // flesh proximal toe (base -> knuckle), toe-local coords along +Z
    const p0 = [new V3(0, 0.0, 0), new V3(0, 0.25, zK * 0.5), new V3(0, 0.45, zK), new V3(0, 0.3, zK + 0.7)];
    const toe = tube(p0, [0.5, 0.44, 0.36, 0.3], { radial: 6, segsPerPoint: 3 }); scaleUV(toe, 1, 2);
    S.addBlend('flesh', toe, wf, { matrix: Mt0 });
    const kn = blob(0.5, 0.46, 0.5, { w: 10, h: 8, tile: 1.5 }); kn.translate(0, 0.45, zK); S.addBlend('shell', kn, wf, { matrix: Mt0, color: 0xfff4e0 });
    // claw: shell, curves down into the ground
    const p1 = [new V3(0, 0.45, zK - 0.1), new V3(0, 0.5, zK + (len - zK) * 0.4), new V3(0, 0.3, zK + (len - zK) * 0.78), new V3(0, -0.12, len)];
    const claw = tube(p1, [0.34, 0.28, 0.17, 0.02], { radial: 6, segsPerPoint: 3 }); scaleUV(claw, 1, 2); S.addBlend('shell', claw, wf, { matrix: Mt0, color: 0xfff4e0 });
  }
  // heel spur is the 4th toe (az=180)
}

const thetaForY = (y) => Math.acos(clamp((y - HEAD_C.y) / HEAD_R.y, -0.999, 0.999));
function thinSheet(g, t) { // double-sided thin plate from a single surface
  const n = g.attributes.normal, p = g.attributes.position; const a = g.clone(), b = g.clone();
  const pa = a.attributes.position, pb = b.attributes.position;
  for (let i = 0; i < p.count; i++) { pa.setXYZ(i, p.getX(i) + n.getX(i) * t * 0.5, p.getY(i) + n.getY(i) * t * 0.5, p.getZ(i) + n.getZ(i) * t * 0.5); pb.setXYZ(i, p.getX(i) - n.getX(i) * t * 0.5, p.getY(i) - n.getY(i) * t * 0.5, p.getZ(i) - n.getZ(i) * t * 0.5); }
  const ix = b.index.array; for (let i = 0; i < ix.length; i += 3) { const k = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = k; } b.index.needsUpdate = true; smoothNormals(a); smoothNormals(b);
  return mergeAll([a, b]);
}
function buildHead(S, rest, rng) {
  const bone = B.head, M = boneMatrix(rest, bone);
  const SH = 0xf2e6cc, SH2 = 0xe2d2b0;
  // main shell: displaced ellipsoid
  const g = blob(HEAD_R.x, HEAD_R.y, HEAD_R.z, { w: seg(38, 20), h: seg(26, 12), tile: 4 }); g.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z);
  { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = 0.07 * Math.sin(x * 1.9 + z * 1.3) * Math.sin(y * 1.7 + 0.5) + 0.05 * Math.sin(z * 3.1 + x * 2.3); p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d); } smoothNormals(g); }
  S.add('shell', g, bone, { matrix: M, color: SH });
  const base = ellipsoidBase(HEAD_C.x, HEAD_C.y, HEAD_C.z, HEAD_R.x, HEAD_R.y, HEAD_R.z);
  const thBrow = thetaForY(1.65), thLip = thetaForY(-0.2);
  // heavy brow over the eye slit, lower lip, temples, crown ridge plates, occiput, cheeks
  const plates = [[thBrow, 0.0, 0.2, 0.95, 0.85, 0.0, 3.6], [thBrow - 0.05, 0.95, 0.22, 0.34, 0.6, 0.35, 2.8], [thBrow - 0.05, -0.95, 0.22, 0.34, 0.6, -0.35, 2.8], [thLip, 0.0, 0.15, 0.62, 0.5, 0.0, 3.4],
    [1.18, 1.35, 0.32, 0.4, 0.45, 0.2, 2.6], [1.18, -1.35, 0.32, 0.4, 0.45, -0.2, 2.6], [0.95, 0.0, 0.3, 0.3, 0.5, 0.0, 3.0], [0.62, 0.0, 0.3, 0.32, 0.55, 0.0, 3.0], [0.3, 0.0, 0.24, 0.5, 0.55, 0.0, 3.0],
    [1.1, Math.PI, 0.55, 0.8, 0.5, 0.0, 2.6], [1.7, 1.55, 0.36, 0.45, 0.4, 0.3, 2.6], [1.7, -1.55, 0.36, 0.45, 0.4, -0.3, 2.6], [2.05, 0.55, 0.22, 0.34, 0.34, 0.2, 2.6], [2.05, -0.55, 0.22, 0.34, 0.34, -0.2, 2.6]];
  let seed = 1;
  for (const [th, ph, dth, dph, thick, rot, e] of plates) S.add('shell', scute(base, th, ph, dth, dph, thick, { na: 18, nr: 4, rot, e, tile: 3.5, seed: seed++, bevel: 0.32 }), bone, { matrix: M, color: SH2 });
  // eye slit: bone rim, dark recess, luminous nodes
  const EA = 2.0, EB = 0.62;
  const eyeSurf = (x, y, off, out = new V3()) => { const z = headSurfZ(x, y); const n = new V3(x / HEAD_R.x ** 2, (y - HEAD_C.y) / HEAD_R.y ** 2, (z - HEAD_C.z) / HEAD_R.z ** 2).normalize(); return out.set(x, y, z).addScaledVector(n, off); };
  { const pts = []; const n = 32; for (let i = 0; i < n; i++) { const a = i / n * TAU; const sa = Math.sin(a); pts.push(eyeSurf(Math.cos(a) * EA, EYE_Y + sa * EB * (sa > 0 ? 1 : 0.85), 0.16)); }
    const rim = tube(pts, 0.26, { radial: 8, closed: true, segsPerPoint: 2 }); scaleUV(rim, 4, 1); S.add('shell', rim, bone, { matrix: M, color: SH });
    const nodes = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; const p = eyeSurf(Math.cos(a) * (EA + 0.42), EYE_Y + Math.sin(a) * (EB + 0.45), 0.1); const gg = new THREE.SphereGeometry(0.11, 8, 6); gg.translate(p.x, p.y, p.z); nodes.push(gg); }
    S.add('glow', mergeAll(nodes), bone, { matrix: M }); }
  const recess = surface(28, 5, (u, v, o) => { const a = u * TAU, r = v; eyeSurf(Math.cos(a) * EA * r, EYE_Y + Math.sin(a) * EB * r, -0.1 - 0.55 * Math.sqrt(Math.max(0, 1 - r * r)), o); }, { uvScale: [3, 1] });
  S.add('flesh', orient(recess, HEAD_C.x, HEAD_C.y, HEAD_C.z), bone, { matrix: M, color: 0x0b1218 });
  // frill: dark-blue membrane stretched between bone spokes behind the head (cobra-hood silhouette)
  { const nS = 9, a0 = Math.PI - 1.55, a1 = Math.PI + 1.55; const P = new V3(), N = new V3();
    const frillPt = (u, v, out) => { const ph = lerp(a0, a1, u); const th0 = 1.45 + 0.25 * Math.abs(u - 0.5); base.P(th0, ph, P); base.N(th0, ph, N);
      const L = (1.4 + 3.0 * Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * u)), 0.8)) * (1 + 0.1 * Math.cos(u * TAU * 8) * v);
      const dir = new V3(N.x * 0.9, N.y * 0.25 - 0.45, N.z * 0.9 - 0.3).normalize();
      return out.copy(P).addScaledVector(dir, L * v).add(new V3(0, -0.5 * v * v * L * 0.25, 0)); };
    const mem = surface(36, 8, (u, v, o) => frillPt(u, v, o), { uvScale: [3, 2] }); orient(mem, 0, 1.3, 0);
    S.add('flesh', thinSheet(mem, 0.08), bone, { matrix: M, color: 0x46647a });
    for (let k = 0; k < nS; k++) { const u = (k + 0.5) / nS; const pts = []; for (let i = 0; i <= 6; i++) pts.push(frillPt(u, i / 6, new V3())); const t = tube(pts, [0.2, 0.17, 0.14, 0.11, 0.09, 0.06, 0.02], { radial: 6, segsPerPoint: 2 }); S.add('shell', t, bone, { matrix: M, color: SH2 }); } }
  // crest blades along the top midline (taller, swept back)
  for (let k = 0; k < 7; k++) {
    const f = k / 6; const z = lerp(2.8, -3.0, f), y = HEAD_C.y + HEAD_R.y * Math.sqrt(Math.max(0, 1 - ((z - HEAD_C.z) / HEAD_R.z) ** 2)) - 0.15;
    const len = 1.3 + 2.0 * Math.sin(Math.PI * (0.1 + f * 0.8)); const sp = spike(len, 0.38, 6); sp.scale(0.4, 1, 1.1); place(sp, [0, y, z], alignYdir(new V3(0, 1, -0.45 - 0.35 * f)));
    S.add('shell', sp, bone, { matrix: M, color: SH2 });
  }
  // chin: jaw plate + throat sac (horn)
  S.add('shell', blob(1.9, 0.5, 1.8, { w: 14, h: 8, tile: 3 }).translate(0, -1.55, 1.7), bone, { matrix: M, color: SH2 });
  S.add('flesh', blob(1.4, 1.0, 1.4, { w: 14, h: 10, tile: 3 }).translate(0, -1.85, 1.2), bone, { matrix: M });
  // bristles around the brow, crown and back
  { const sp = []; for (let i = 0; i < 90; i++) { const th = rng.range(0.15, 2.3), ph = rng.range(0, TAU); if (th > 1.35 && th < 2.2 && Math.cos(ph) > 0.2 && Math.abs(Math.sin(ph)) < 0.75) continue;
      const Pp = new V3(); base.P(th, ph, Pp); const Nn = new V3(); base.N(th, ph, Nn); Nn.y += 0.3; const gg = spike(rng.range(0.4, 1.3), 0.028, 4); place(gg, [Pp.x, Pp.y, Pp.z], alignYdir(Nn)); sp.push(gg); }
    // dense brow bristles
    for (let i = 0; i < 18; i++) { const ph = lerp(-0.95, 0.95, i / 17), th = thBrow - 0.14; const Pp = new V3(); base.P(th, ph, Pp); const Nn = new V3(); base.N(th, ph, Nn); Nn.y += 0.5; const gg = spike(rng.range(0.7, 1.2), 0.03, 4); place(gg, [Pp.x, Pp.y, Pp.z], alignYdir(Nn)); sp.push(gg); }
    S.add('flesh', mergeAll(sp), bone, { matrix: M, color: 0x2e2216 }); }
  // two long whip antennae
  for (const sx of [-1, 1]) { const pts = [new V3(sx * 1.2, 4.0, -1.6), new V3(sx * 1.8, 5.3, -2.8), new V3(sx * 2.6, 6.0, -4.4), new V3(sx * 3.2, 5.4, -6.0)]; S.add('flesh', tube(pts, [0.12, 0.08, 0.05, 0.015], { radial: 5, segsPerPoint: 5 }), bone, { matrix: M, color: 0x2a3a46 }); }
}

function buildCannon(S, rest, rng) {
  const bone = B.cannon, M = boneMatrix(rest, bone);
  S.add('shell', blob(1.55, 1.15, 1.55, { w: 16, h: 10, tile: 2.5 }), bone, { matrix: M, color: 0xfff4e0 });
  const LEN = 4.4; const rr = (t) => (t < 0.5 ? lerp(0.95, 0.78, t / 0.5) : lerp(0.78, 1.55, Math.pow((t - 0.5) / 0.5, 1.7)));
  S.add('flesh', revolve(LEN, (t, y) => rr(t) * (1 + 0.07 * ribBump(y / 0.42, 0.8)), { rings: 32, radial: seg(18, 12), tile: 2.5 }), bone, { matrix: M });
  const lip = torus(1.52, 0.24, 28, 8, { tile: 1.4 }); lip.translate(0, LEN, 0); S.add('shell', lip, bone, { matrix: M, color: 0xfff4e0 });
  // teeth: 2 rings pointing inward/forward
  const teeth = [], teeth2 = [];
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; const g = spike(1.0, 0.17, 5); place(g, [Math.sin(a) * 1.4, LEN - 0.05, Math.cos(a) * 1.4], alignYdir(new V3(-Math.sin(a) * 0.55, 1, -Math.cos(a) * 0.55))); teeth.push(g); }
  for (let k = 0; k < 11; k++) { const a = k / 11 * TAU + 0.2; const g = spike(0.8, 0.13, 5); place(g, [Math.sin(a) * 1.05, LEN - 0.55, Math.cos(a) * 1.05], alignYdir(new V3(-Math.sin(a) * 0.7, 1, -Math.cos(a) * 0.7))); teeth2.push(g); }
  S.add('shell', mergeAll(teeth), bone, { matrix: M, color: 0xfff4e0 }); S.add('shell', mergeAll(teeth2), bone, { matrix: M, color: 0xfff4e0 });
  // dark throat (inside-facing funnel)
  const throat = revolve(2.0, (t) => lerp(1.42, 0.35, Math.pow(t, 0.8)), { rings: 8, radial: 20, tile: 2 }); throat.translate(0, LEN - 2.0, 0); flipWinding(throat); S.add('flesh', throat, bone, { matrix: M, color: 0x10161c });
  // tendons feeding the barrel
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.5; const pts = [new V3(Math.sin(a) * 1.1, 0.3, Math.cos(a) * 1.1), new V3(Math.sin(a) * 1.5, 1.6, Math.cos(a) * 1.5), new V3(Math.sin(a) * 1.25, 3.0, Math.cos(a) * 1.25)]; S.add('flesh', tube(pts, [0.13, 0.12, 0.09], { radial: 5, segsPerPoint: 4 }), bone, { matrix: M, color: 0x3a5368 }); }
}
function flipWinding(g) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.index.needsUpdate = true; return smoothNormals(g); }

function buildTentacle(S, rest, rng) {
  const M = boneMatrix(rest, B.tent);
  const rad = (t) => lerp(0.85, 0.15, Math.pow(t, 0.85));
  const wf = (x, y) => { const f = clamp(y / TSEG, 0, NT - 1); const j = Math.min(NT - 2, Math.floor(f)); const w = f - j; return [B.tent + j, 1 - w, B.tent + j + 1, w]; };
  const ribsN = 46;
  const g = revolve(TENT_LEN, (t, y) => rad(t) * (0.9 + 0.13 * ribBump(t * ribsN, 0.7)) * (1 + 0.1 * Math.max(0, Math.sin(y * 0.5)) * 0), { rings: seg(70, 40), radial: 8, tile: 2.5 });
  S.addBlend('flesh', g, wf, { matrix: M, color: (x, y, z, nx, ny, nz) => { const u = 0.62 + 0.25 * Math.max(0, -nz * 0.5 + 0.5); return [u, u, u]; } });
  // shell collars every 3 joints + glow nodes
  for (let j = 2; j < NT - 1; j += 2) { const t = j / (NT - 1), y = j * TSEG; const R = rad(t);
    const c = revolve(0.5, (u) => R * (1.12 + 0.25 * Math.pow(Math.sin(Math.PI * u), 0.5)), { rings: 6, radial: 12, tile: 1.2 }); c.translate(0, y - 0.25, 0);
    S.addBlend('shell', c, wf, { matrix: M, color: 0xfff4e0 });
    const nd = new THREE.SphereGeometry(0.1, 8, 6); nd.translate(0, y + 0.2, R * 1.0); S.addBlend('glow', nd, wf, { matrix: M }); }
  // small spikes along the underside
  { const sp = []; for (let j = 1; j < NT - 1; j++) { const t = j / (NT - 1); const R = rad(t); const gg = spike(0.7 * (1 - t) + 0.25, 0.05, 4); place(gg, [0, j * TSEG, -R], alignYdir(new V3(0, 0.4, -1))); sp.push(gg); } S.addBlend('shell', mergeAll(sp), wf, { matrix: M, color: 0xfff4e0 }); }
  // pincers: 3 curved claw fingers, rigidly attached to claw bones (hinge at the tip joint)
  const tipM = boneMatrix(rest, B.tent + NT - 1); // bone frame at the tip joint
  for (let k = 0; k < 3; k++) {
    const az = CLAW_AZ[k]; const pts = [new V3(0.08, 0, 0), new V3(0.34, 0.8, 0), new V3(0.52, 1.7, 0), new V3(0.4, 2.55, 0), new V3(0.08, 3.1, 0)];
    const f = tube(pts, [0.17, 0.15, 0.12, 0.07, 0.012], { radial: 6, segsPerPoint: 5 }); f.rotateY(az); scaleUV(f, 1, 2);
    S.add('shell', f, B.claw + k, { matrix: tipM, color: 0xfff4e0 });
  }
  const hub = blob(0.26, 0.26, 0.26, { w: 10, h: 8, tile: 1 }); S.add('shell', hub, B.tent + NT - 1, { matrix: tipM, color: 0xfff4e0 });
}

function defaultState() {
  return {
    pelvisP: new V3(0, PH, 0), pelvisQ: new Qt(), headYaw: 0, headPitch: 0, cannonYaw: 0, cannonPitch: 0, clawOpen: 0.5,
    feet: [0, 1, 2].map((i) => ({ p: new V3(Math.sin(LEG_AZ[i]) * HOME_R[i], 0, Math.cos(LEG_AZ[i]) * HOME_R[i]), q: qRy(LEG_AZ[i]), curl: 0 })),
    tent: Array.from({ length: NT }, (_, j) => TENT_DIR.clone().multiplyScalar(j * TSEG).add(TENT_BASE)),
  };
}
/** rest pose (bone positions/quaternions in rig space, design scale 30 m) + design constants, shared with the horde. */
export function tripodRest() { const p = newPose(); computePose(defaultState(), p); return p; }
export function _buildForTest() { const st = defaultState(); const p = newPose(); computePose(st, p); return buildTripodGeometry(p, new RNG(1)); }
export const TC = { PH, HIP_R, HIP_DY, LEG_AZ, HOME_R, L1, L2, ANK, TOE_AZ, TOE_LEN, HEAD_PIVOT, HEAD_C, HEAD_R, EYE_Y, CANNON_BASE, CANNON_DIR, TENT_BASE, TENT_DIR, TORSO_R, TORSO_RATIO, TORSO_H, HIP_LOCAL, POLE, B, boneMatrix, headSurfZ };

// ------------------------------------------------------------------------------------------------ factory
export function createTripod(seed = 1, opts = {}) {
  const size = opts.size ?? 30, Sc = size / 30;
  const rng = new RNG(seed * 977 + 13);
  const root = new THREE.Group(); root.name = 'Tripod';
  const rig = new THREE.Group(); rig.scale.setScalar(Sc); root.add(rig);

  // ---- rest state & pose
  const state = defaultState();
  const restPose = newPose(); computePose(state, restPose);
  const { geometry, keys } = buildTripodGeometry(restPose, rng);
  const matFor = { flesh: fleshMat({ vertexColors: true }), shell: shellMat({ vertexColors: true }), glow: glowMat(3.2) };
  const mats = keys.map((k) => matFor[k]);
  const bones = []; for (let i = 0; i < NBONES; i++) { const b = new THREE.Bone(); b.position.copy(restPose.p[i]); b.quaternion.copy(restPose.q[i]); bones.push(b); rig.add(b); }
  const mesh = new THREE.SkinnedMesh(geometry, mats); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'TripodHull';
  rig.add(mesh); rig.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton, mesh.matrixWorld);

  // ---- extra (non-skinned) glow parts: eye lens, cannon core, halos
  const eyeMat = glowMat(2.6), eyeMat2 = glowMat(2.4), eyeCoreMat = glowMat(7.0), coreMat = glowMat(2.5);
  const eye = new THREE.Group(); bones[B.head].add(eye);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), eyeMat); lens.scale.set(1.25, 1, 0.9); eye.add(lens);
  const lensCore = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), eyeCoreMat); lensCore.scale.set(1.5, 1, 1); lensCore.position.z = 0.35; eye.add(lensCore);
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 24), eyeMat2); lensRing.scale.set(1.5, 1, 1); lensRing.position.z = 0.25; eye.add(lensRing);
  const eyeHalo = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.9 })); eyeHalo.scale.set(6.5, 3.4, 1); eye.add(eyeHalo);
  const eyeHalo2 = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.35 })); eyeHalo2.scale.set(10, 5.0, 1); eye.add(eyeHalo2);
  const core = new THREE.Group(); bones[B.cannon].add(core);
  const coreDisc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), coreMat); coreDisc.rotation.x = -Math.PI / 2; coreDisc.position.y = 3.35; core.add(coreDisc);
  const coreBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), coreMat); coreBall.position.y = 3.55; core.add(coreBall);
  const coreHalo = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.0 })); coreHalo.position.y = 4.3; coreHalo.scale.setScalar(1); core.add(coreHalo);
  const coreHalo2 = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.0 })); coreHalo2.position.y = 6.0; coreHalo2.scale.setScalar(1); core.add(coreHalo2);

  // ---- gait controller state
  const legs = [0, 1, 2].map((i) => ({ planted: true, armed: true, pos: new V3(), yaw: 0, from: new V3(), fromYaw: 0, s: 0, dur: 1, off: [0, 2 / 3, 1 / 3][i], lift: 0 }));
  const ctl = {
    speed: 0, targetSpeed: 0, heading: 0, hasHeading: false, phase: 0, vel: new V3(), prevPos: new V3(), init: false, bob: 0, swayX: 0, swayZ: 0, lean: 0, roll: 0,
    cannon: 0, cannonSm: 0, tentMode: 'idle', tentW: { idle: 1, reach: 0, sweep: 0 }, tentTarget: null, tentReachW: 0, clawOpen: 0.5,
    aim: null, headYawT: 0, headYawS: 0, headPitchS: 0, cannonYawS: 0, cannonPitchS: 0, t: 0, infect: 0, horn: 0, lookT: 0,
  };
  const cfg = { stride: 8.5 * Sc, lift: 3.4 * Sc, duty: 0.7, maxStray: 3.4 * Sc, minCycle: 1.5 * Math.sqrt(Sc), maxSpeed: 12 * Sc, accel: 2.5 * Math.sqrt(Sc), turnRate: 0.45 };
  const homeW = [new V3(), new V3(), new V3()];
  const inv = new M4(), tmpV = new V3(), tmpV2 = new V3(), tmpV3 = new V3();
  const pose = newPose();
  const footOut = [new V3(), new V3(), new V3()];
  const stepCbs = [];
  let ground = null; // optional height function (x,z)->y in WORLD

  function homeWorld(i, out) { // world position of the leg's home foot
    tmpV.set(Math.sin(LEG_AZ[i]) * HOME_R[i] * Sc, 0, Math.cos(LEG_AZ[i]) * HOME_R[i] * Sc).applyMatrix4(root.matrixWorld); // root has unit scale; rig scale handled via Sc
    out.copy(tmpV); if (ground) out.y = ground(out.x, out.z); return out;
  }
  const smoother = (s) => s * s * s * (s * (s * 6 - 15) + 10);
  function startSwing(L, dur) { L.planted = false; L.armed = false; L.s = 0; L.dur = dur; L.from.copy(L.pos); L.fromYaw = L.yaw; }
  function gaitStep(h) {
    // ---- body motion (self drive)
    if (ctl.hasHeading) { const dy = ((ctl.heading - root.rotation.y + Math.PI * 3) % TAU) - Math.PI; const lim = cfg.turnRate * h; root.rotation.y += clamp(dy * Math.min(1, h * 1.5), -lim, lim); }
    ctl.speed = damp(ctl.speed, ctl.targetSpeed, 0.9, h);
    if (ctl.auto && ctl.speed > 1e-3) { root.position.x += Math.sin(root.rotation.y) * ctl.speed * h; root.position.z += Math.cos(root.rotation.y) * ctl.speed * h; if (ground) root.position.y = ground(root.position.x, root.position.z); }
    root.updateWorldMatrix(true, true);
    const pos = tmpV3.setFromMatrixPosition(root.matrixWorld);
    if (!ctl.init) ctl.prevPos.copy(pos);
    const vx = (pos.x - ctl.prevPos.x) / h, vz = (pos.z - ctl.prevPos.z) / h; ctl.prevPos.copy(pos);
    ctl.vel.x = damp(ctl.vel.x, vx, 10, h); ctl.vel.z = damp(ctl.vel.z, vz, 10, h);
    const spd = Math.hypot(ctl.vel.x, ctl.vel.z);
    for (let i = 0; i < 3; i++) homeWorld(i, homeW[i]);
    if (!ctl.init) { for (let i = 0; i < 3; i++) { legs[i].pos.copy(homeW[i]); legs[i].yaw = root.rotation.y + LEG_AZ[i]; } ctl.init = true; }
    // teleport / seek safety: a planted foot that ended up far from its home (root was moved externally) re-plants at home
    for (let i = 0; i < 3; i++) { const L = legs[i]; if (L.planted && (Math.hypot(L.pos.x - homeW[i].x, L.pos.z - homeW[i].z) > cfg.maxStray * 2.6 || Math.abs(L.pos.y - homeW[i].y) > 6 * Sc)) { L.pos.copy(homeW[i]); L.yaw = root.rotation.y + LEG_AZ[i]; L.armed = true; } }
    const cycle = Math.max(cfg.minCycle, cfg.stride / Math.max(spd, 0.01));
    const moving = spd > 0.15 * Sc + 0.03;
    if (moving) ctl.phase = (ctl.phase + h / cycle) % 1;
    let anySwing = false; for (const L of legs) if (!L.planted) anySwing = true;
    for (let i = 0; i < 3; i++) {
      const L = legs[i];
      if (L.planted) {
        const lp = (ctl.phase + L.off) % 1;
        if (lp < cfg.duty) L.armed = true;
        if (moving && L.armed && lp >= cfg.duty && !anySwing) { startSwing(L, Math.max(0.45, cycle * (1 - cfg.duty))); anySwing = true; }
        else if (!moving && !anySwing) { // re-centre when standing / turning in place
          const dx = L.pos.x - homeW[i].x, dz = L.pos.z - homeW[i].z; if (Math.hypot(dx, dz) > cfg.maxStray) { startSwing(L, 0.9 * Math.sqrt(Sc) + 0.25); anySwing = true; }
        }
      }
      if (!L.planted) {
        L.s += h / L.dur; const sc = clamp(L.s, 0, 1), rem = (1 - sc) * L.dur;
        const lead = moving ? rem + cycle * cfg.duty * 0.5 : rem * 0.0;       // land ahead of home so the stance is centred
        const tx = homeW[i].x + ctl.vel.x * lead, tz = homeW[i].z + ctl.vel.z * lead;
        const e = smoother(sc);
        L.pos.x = lerp(L.from.x, tx, e); L.pos.z = lerp(L.from.z, tz, e);
        const gy = ground ? ground(L.pos.x, L.pos.z) : 0; const arc = Math.pow(Math.sin(Math.PI * sc), 0.8);
        L.pos.y = lerp(L.from.y, gy, e) + arc * cfg.lift; L.lift = arc;
        const targetYaw = root.rotation.y + LEG_AZ[i]; L.yaw = L.fromYaw + (((targetYaw - L.fromYaw + Math.PI * 3) % TAU) - Math.PI) * e;
        if (L.s >= 1) { L.planted = true; L.pos.y = gy; L.lift = 0; if (stepCbs.length) { footOut[i].copy(L.pos); for (const cb of stepCbs) cb(i, footOut[i]); } }
      }
    }
    ctl.spd = spd;
  }

  function applyPose(t, dt) {
    // ----- feet to rig space
    rig.updateWorldMatrix(true, false); inv.copy(rig.matrixWorld).invert();
    // support centroid (rig space)
    let cx = 0, cz = 0, cw = 0, avgY = 0;
    for (let i = 0; i < 3; i++) {
      const L = legs[i]; const f = state.feet[i];
      f.p.copy(L.pos).applyMatrix4(inv);
      const sw = L.planted ? 1 : 0.2; cx += f.p.x * sw; cz += f.p.z * sw; cw += sw; avgY += f.p.y;
      // foot orientation: yaw relative to root; pitch toes down while swinging (heel lift)
      const yawRel = L.yaw - root.rotation.y;
      const pitch = L.planted ? 0 : 0.45 * Math.sin(Math.PI * clamp(L.s, 0, 1)) * (1 - clamp(L.s, 0, 1) * 0.5);
      mulRx(f.q.setFromAxisAngle(AX_Y, yawRel), pitch); f.curl = L.planted ? 0 : Math.pow(Math.sin(Math.PI * clamp(L.s * 1.05, 0, 1)), 0.7);
    }
    cx /= cw; cz /= cw;
    const spd = ctl.spd || 0;
    // ----- pelvis: shift over the support polygon, height from leg stretch, tilt with speed
    const breathe = Math.sin(t * 1.15) * 0.1 + Math.sin(t * 0.43 + 1.0) * 0.07;
    ctl.swayX = damp(ctl.swayX, clamp(cx * 0.34, -1.6, 1.6), 3.0, dt); ctl.swayZ = damp(ctl.swayZ, clamp(cz * 0.34, -1.6, 1.6), 3.0, dt);
    state.pelvisP.set(ctl.swayX, PH, ctl.swayZ);
    // choose height so average hip->ankle distance stays near the nominal reach
    let dsum = 0; for (let i = 0; i < 3; i++) { const hip = tmpV.copy(HIP_LOCAL[i]).add(state.pelvisP); const f = state.feet[i]; const a = tmpV2.copy(ANK).applyQuaternion(f.q).add(f.p); dsum += Math.hypot(hip.x - a.x, hip.z - a.z); }
    const dh = dsum / 3; const reach = 19.2;                           // nominal hip->ankle distance of the rest pose
    const hipY = Math.sqrt(Math.max(4, reach * reach - dh * dh)) + ANK.y + avgY / 3;
    state.pelvisP.y = PH + (hipY - HIP_DY - PH) * 0.55 + breathe;
    ctl.lean = damp(ctl.lean, clamp(spd / (7 * Sc), 0, 1) * 0.06, 2, dt);
    ctl.roll = damp(ctl.roll, clamp(-(cx) * 0.012, -0.08, 0.08), 3, dt);
    const sway = Math.sin(ctl.phase * TAU * 3) * 0.015 * clamp(spd / (3 * Sc), 0, 1);
    state.pelvisQ.setFromEuler(_eulS.set(ctl.lean + Math.sin(t * 0.7) * 0.006, sway * 2 + Math.sin(t * 0.31) * 0.01, ctl.roll + sway, 'YXZ'));
    // ----- head / cannon aim
    let yawT = Math.sin(t * 0.37 + 0.6) * 0.45 + Math.sin(t * 0.91) * 0.12, pitchT = Math.sin(t * 0.52 + 2.0) * 0.07 + 0.05;
    let cYawT = 0, cPitchT = 0;
    if (ctl.aim) {
      tmpV.copy(ctl.aim).applyMatrix4(inv); const pivot = tmpV2.copy(HEAD_PIVOT).add(state.pelvisP);
      const d = tmpV3.subVectors(tmpV, pivot);
      yawT = clamp(Math.atan2(d.x, d.z), -1.4, 1.4); pitchT = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.5, 0.6);
      const cb = tmpV2.copy(CANNON_BASE).add(state.pelvisP); const dc = tmpV3.subVectors(tmpV, cb);
      const rest = Math.atan2(CANNON_DIR.x, CANNON_DIR.z); cYawT = clamp(Math.atan2(dc.x, dc.z) - rest, -0.9, 0.9);
      const hor = Math.hypot(dc.x, dc.z); cPitchT = clamp(-Math.atan2(dc.y, hor) - Math.asin(-CANNON_DIR.y) * 0 - (-Math.atan2(CANNON_DIR.y, Math.hypot(CANNON_DIR.x, CANNON_DIR.z))), -0.6, 0.7);
    }
    ctl.headYawT = yawT; ctl.headYawS = damp(ctl.headYawS, yawT, 2.4, dt); ctl.headPitchS = damp(ctl.headPitchS, pitchT, 2.4, dt);
    ctl.cannonYawS = damp(ctl.cannonYawS, cYawT, 3.0, dt); ctl.cannonPitchS = damp(ctl.cannonPitchS, cPitchT, 3.0, dt);
    state.headYaw = ctl.headYawS; state.headPitch = ctl.headPitchS; state.cannonYaw = ctl.cannonYawS; state.cannonPitch = ctl.cannonPitchS;
    // ----- tentacle
    solveTentacle(t, dt);
    computePose(state, pose);
    for (let i = 0; i < NBONES; i++) { bones[i].position.copy(pose.p[i]); bones[i].quaternion.copy(pose.q[i]); }
  }

  // ---- tentacle shape: blend of idle / sweep / reach chains (pelvis-local joint positions), constant segment lengths
  const chains = { idle: Array.from({ length: NT }, () => new V3()), sweep: Array.from({ length: NT }, () => new V3()), reach: Array.from({ length: NT }, () => new V3()) };
  const reachT = new V3(), bez = []; for (let i = 0; i <= 60; i++) bez.push(new V3());
  const dirV = new V3(), qa = new Qt(), qb = new Qt(), lastDir = new V3();
  function fkChain(out, t, amp, yawFn, pitchFn) {
    const p = out[0].copy(TENT_BASE); const d = dirV.copy(TENT_DIR);
    // frame: yaw about world up, pitch about the horizontal axis perpendicular to dir
    for (let j = 0; j < NT - 1; j++) {
      const yaw = yawFn(j, t), pit = pitchFn(j, t);
      qa.setFromAxisAngle(_up, yaw); d.applyQuaternion(qa);
      const side = _t1.crossVectors(d, _up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
      qb.setFromAxisAngle(side, pit); d.applyQuaternion(qb); d.normalize();
      out[j + 1].copy(out[j]).addScaledVector(d, TSEG);
    }
  }
  const _up = new V3(0, 1, 0);
  function solveTentacle(t, dt) {
    const w = ctl.tentW; const tgt = { idle: ctl.tentMode === 'idle' ? 1 : 0, reach: ctl.tentMode === 'reach' ? 1 : 0, sweep: ctl.tentMode === 'sweep' ? 1 : 0 };
    for (const k in w) w[k] = damp(w[k], tgt[k], 2.2, dt);
    const ws = w.idle + w.reach + w.sweep || 1;
    // idle: slow travelling waves, tip curling
    fkChain(chains.idle, t, 1, (j, tt) => 0.06 * Math.sin(tt * 0.55 - j * 0.5 + 1.2) + 0.012 * Math.sin(tt * 1.3 + j), (j, tt) => 0.05 * Math.sin(tt * 0.7 - j * 0.42) + (j > 6 ? 0.1 + 0.02 * (j - 6) : 0.0) + 0.012 * Math.sin(tt * 1.9 - j));
    // sweep: big lateral S-wave, raised base
    fkChain(chains.sweep, t, 1, (j, tt) => 0.14 * Math.sin(tt * 1.1 - j * 0.38) + 0.11 * Math.sin(tt * 0.5) * (j < 3 ? 1.5 : 0.5), (j, tt) => (j === 0 ? 0.35 : 0.0) + 0.04 * Math.sin(tt * 0.9 - j * 0.5));
    // reach: arc from base to the target
    const tw = ctl.tentTarget; const rc = chains.reach;
    if (tw) reachT.copy(tw).applyMatrix4(inv).sub(state.pelvisP); else reachT.copy(TENT_BASE).add(_t3.set(-1.0, -5.0, 11.0));
    // reachT is pelvis-local now; clamp to arm length
    const toT = _t2.subVectors(reachT, TENT_BASE); let D = toT.length(); const maxD = TENT_LEN * 0.97; if (D > maxD) { toT.multiplyScalar(maxD / D); D = maxD; }
    const mid = _t1.copy(TENT_BASE).addScaledVector(toT, 0.5);
    const sag = Math.sqrt(Math.max(0, (TENT_LEN * 0.5) ** 2 - (D * 0.5) ** 2)) * 1.25;
    const ctrl = _t3.copy(mid).addScaledVector(_up, sag * 0.9).addScaledVector(TENT_DIR, sag * 0.35 * (1 - D / maxD));
    for (let i = 0; i <= 60; i++) { const u = i / 60, a = (1 - u) * (1 - u), b2 = 2 * (1 - u) * u, c = u * u; bez[i].set(a * TENT_BASE.x + b2 * ctrl.x + c * (TENT_BASE.x + toT.x), a * TENT_BASE.y + b2 * ctrl.y + c * (TENT_BASE.y + toT.y), a * TENT_BASE.z + b2 * ctrl.z + c * (TENT_BASE.z + toT.z)); }
    rc[0].copy(TENT_BASE); let ci = 0, acc = 0, need = TSEG;
    for (let j = 1; j < NT; j++) {
      // walk along the polyline until `need` arc length covered
      let remaining = TSEG; let cur = _t1.copy(rc[j - 1]);
      while (ci < 60 && remaining > 0) { const seg = bez[ci + 1]; const dseg = cur.distanceTo(seg); if (dseg <= remaining) { remaining -= dseg; cur.copy(seg); ci++; } else { cur.lerp(seg, remaining / dseg); remaining = 0; } }
      if (remaining > 0) cur.addScaledVector(lastDir.subVectors(bez[60], bez[59]).normalize(), remaining);
      rc[j].copy(cur);
    }
    // blend chains and re-project to constant segment lengths
    const o = state.tent; o[0].copy(TENT_BASE);
    for (let j = 1; j < NT; j++) {
      const bx = (chains.idle[j].x * w.idle + chains.sweep[j].x * w.sweep + rc[j].x * w.reach) / ws, by = (chains.idle[j].y * w.idle + chains.sweep[j].y * w.sweep + rc[j].y * w.reach) / ws, bz = (chains.idle[j].z * w.idle + chains.sweep[j].z * w.sweep + rc[j].z * w.reach) / ws;
      const px = (chains.idle[j - 1].x * w.idle + chains.sweep[j - 1].x * w.sweep + rc[j - 1].x * w.reach) / ws, py = (chains.idle[j - 1].y * w.idle + chains.sweep[j - 1].y * w.sweep + rc[j - 1].y * w.reach) / ws, pz = (chains.idle[j - 1].z * w.idle + chains.sweep[j - 1].z * w.sweep + rc[j - 1].z * w.reach) / ws;
      dirV.set(bx - px, by - py, bz - pz); if (dirV.lengthSq() < 1e-8) dirV.copy(TENT_DIR); dirV.normalize();
      o[j].copy(o[j - 1]).addScaledVector(dirV, TSEG);
    }
    // pincers: open as the tip nears the target; idle flex
    const near = tw ? clamp(1 - o[NT - 1].distanceTo(reachT) / 6, 0, 1) : 0;
    const openT = w.reach > 0.5 ? 0.25 + 0.9 * (1 - near * 0.8) + 0.05 * Math.sin(t * 3) : 0.55 + 0.14 * Math.sin(t * 0.8) + (ctl.tentMode === 'sweep' ? 0.35 : 0);
    ctl.clawOpen = damp(ctl.clawOpen, openT, 4, dt); state.clawOpen = ctl.clawOpen;
  }

  // ---- visuals (eye / cannon / infection)
  function updateVisuals(t, dt) {
    // scanning eye lens glides along the slit
    // the lens glides inside the oval socket (scan) and darts slightly toward the aim target
    let ex = Math.sin(t * 0.8 + 1.3) * 0.55 + Math.sin(t * 2.1) * 0.06, ey = Math.sin(t * 0.63) * 0.12;
    if (ctl.aim) { ex = clamp((ctl.headYawS - ctl.headYawT) * -2.0, -0.55, 0.55); ey = 0; }
    const z = headSurfZ(ex, EYE_Y + ey) - 0.35; eye.position.set(ex, EYE_Y + ey, z);
    const flick = 0.92 + 0.08 * Math.sin(t * 17.0) * Math.sin(t * 6.3);
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    eyeMat.emissiveIntensity = 2.6 * flick * pulse; eyeHalo.material.opacity = 0.7 * flick; eyeHalo2.material.opacity = 0.3 + 0.1 * Math.sin(t * 1.3);
    // cannon glow
    ctl.cannonSm = damp(ctl.cannonSm, ctl.cannon, 5, dt); const c = ctl.cannonSm;
    coreMat.emissiveIntensity = 1.2 + c * 11.0 * (0.9 + 0.1 * Math.sin(t * 40));
    coreHalo.material.opacity = c * 0.95; coreHalo.scale.setScalar(2.0 + c * 6.0 * (0.92 + 0.08 * Math.sin(t * 33))); coreHalo2.material.opacity = c * c * 0.5; coreHalo2.scale.setScalar(4 + c * 14);
    coreBall.scale.setScalar(0.6 + c * 1.2);
    matFor.glow.emissiveIntensity = 2.6 + 0.6 * Math.sin(t * 1.7);
  }

  function update(dt, t) {
    dt = Math.max(0, dt || 0); ctl.t = t;
    const n = Math.max(1, Math.min(40, Math.ceil(dt / (1 / 30)))); const h = n > 0 ? Math.max(1e-4, dt / n) : 1 / 60;
    for (let i = 0; i < n; i++) gaitStep(dt > 0 ? h : 1 / 60);
    applyPose(t, dt > 0 ? dt : 1 / 60); updateVisuals(t, dt > 0 ? dt : 1 / 60);
  }
  // prime so the first frame already looks right
  ctl.auto = opts.autoMove !== false;
  const tripod = {
    root, rig, height: 30 * Sc, size, mesh, skeleton, bones, legsState: legs, scale: Sc,
    update,
    /** speed in m/s (world), heading = world yaw (rad) the tripod turns towards. The tripod moves its own root (autoMove) and plants feet in world space. */
    setGait({ speed, heading } = {}) { if (speed !== undefined) ctl.targetSpeed = clamp(speed, 0, cfg.maxSpeed * 1.5); if (heading !== undefined) { ctl.heading = heading; ctl.hasHeading = true; } return tripod; },
    /** if false the caller moves root itself (feet still plant); default true */
    get autoMove() { return ctl.auto; }, set autoMove(v) { ctl.auto = !!v; },
    /** look + belly cannon follow a world point (null = idle scanning) */
    aimAt(v) { if (v) { ctl.aim = (ctl.aim || new V3()).copy(v); } else ctl.aim = null; return tripod; },
    /** belly cannon charge 0..1 (mouth glows, halo swells) */
    setCannon(p) { ctl.cannon = clamp(p, 0, 1); return tripod; },
    /** tentacle mode 'idle' | 'reach' | 'sweep'; optional world-space reach target */
    setTentacle(mode, target) { ctl.tentMode = mode; ctl.tentTarget = target ? (ctl.tentTarget || new V3()).copy(target) : (mode === 'reach' ? ctl.tentTarget : null); return tripod; },
    setInfection(a) { ctl.infect = a; infectAll(root, a); return tripod; },
    /** current planted/lifted contact positions (world), reused vectors */
    footWorldPositions() { for (let i = 0; i < 3; i++) footOut[i].copy(legs[i].pos); return footOut; },
    /** world position of the belly-cannon muzzle and the eye (for beams / FX) */
    muzzleWorld(out = new V3()) { bones[B.cannon].updateWorldMatrix(true, false); return out.set(0, 4.5, 0).applyMatrix4(bones[B.cannon].matrixWorld); },
    eyeWorld(out = new V3()) { eye.updateWorldMatrix(true, false); return eye.getWorldPosition(out); },
    onStep(cb) { stepCbs.push(cb); return tripod; },
    setGround(fn) { ground = fn; return tripod; },
    dispose() { disposeTree(root); skeleton.dispose(); },
    get gaitSpeed() { return ctl.speed; },
  };
  // settle: run 0.5 s at t=0 so the asset looks right immediately
  for (let i = 0; i < 6; i++) update(1 / 12, i / 12);
  return tripod;
}
