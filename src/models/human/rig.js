// Skeleton layout (proportions from profile) + bone hierarchy + skeleton creation.
// Conventions: model faces +Z, +Y up, character's LEFT is +X.  All bones have identity rest rotation (axes = world axes in bind pose),
// so a local rotation about X pitches, about Y twists/yaws, about Z rolls (see anim.js for sign helpers).
import * as THREE from 'three';
import { V } from './kit.js';

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const FINGER_SEGS = { thumb: 3, index: 3, middle: 3, ring: 3, pinky: 3 };

/** head height (chin→crown) in metres for a given stature & age */
export function headHeight(P) {
  const H = P.height;
  const adult = 0.218 + (H - 1.5) * 0.045 + (P.isFemale ? -0.004 : 0.003);
  const child = H * 0.165;
  return adult * (1 - P.youth) + child * P.youth;
}

export function computeLayout(P) {
  const H = P.height, F = P.isFemale, b = P.build, yo = P.youth, f = P.face;
  const hh = headHeight(P) * (f.headLen ** 0.5);
  const sh = hh / 0.23;                         // head scale (nominal head model is 0.23 m tall)
  const adj = (a, c) => a * (1 - yo) + c * yo; // adult→child blend
  const J = {};
  const hipY = H * adj(0.53, 0.47) * (1 + (b.legLen - 1) * 0.04);
  const kneeY = H * adj(0.285, 0.255) * (1 + (b.legLen - 1) * 0.03);
  const ankleY = H * adj(0.039, 0.035) + 0.012;
  const crown = H, chinY = H - hh, earY = H - hh * 0.5;
  const neckY = chinY - adj(0.014, 0.004) * H - 0.004 - (b.neck - 1) * 0.004;  // C7 pivot
  const shY = H * adj(0.805, 0.74);
  const wid = F ? 0.1 : 0.112;
  const shHalf = H * adj(wid, 0.098) * b.shoulder * (1 + b.muscle * 0.03);
  const hipW = H * adj(F ? 0.0545 : 0.0505, 0.05) * (0.78 + 0.22 * b.hip) * (1 + b.belly * 0.04);
  const armAbd = (7 + 8 * Math.min(1, b.belly + b.limbFat * 0.4 + b.muscle * 0.5 + (b.chest - 1) * 0.8)) * Math.PI / 180;
  const Lu = H * adj(0.186, 0.17) * b.armLen, Lf = H * adj(0.146, 0.14) * b.armLen;
  const handL = H * adj(0.108, 0.105) * b.hand * (F ? 0.96 : 1);
  // spine
  J.hips = V(0, hipY, 0);
  J.spine = V(0, hipY + (shY - hipY) * 0.2, 0.004);
  J.chest = V(0, hipY + (shY - hipY) * 0.52, 0.012);
  J.neck = V(0, neckY, -0.004);
  J.head = V(0, earY, 0.0);
  J.jaw = V(0, earY - 0.024 * sh, -0.016 * sh);
  const eyeX = 0.0315 * f.eyeSpacing * f.width ** 0.5 * sh, eyeY = earY + 0.0045 * sh, eyeZ = (0.0738 - 0.0007 * (f.eyeSize - 1) * 4) * sh;
  J.eyeL = V(eyeX, eyeY, eyeZ); J.eyeR = V(-eyeX, eyeY, eyeZ);
  // arms
  const cvx = 0.022 * (0.8 + 0.2 * b.shoulder);
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    J['clavicle' + S] = V(s * cvx, shY + H * 0.022, 0.03);
    const shoulder = V(s * (shHalf - 0.026), shY, -0.004);
    J['upperArm' + S] = shoulder;
    const du = V(s * Math.sin(armAbd), -Math.cos(armAbd), 0.0);
    const elbow = shoulder.clone().addScaledVector(du, Lu); elbow.z += 0.004;
    J['foreArm' + S] = elbow;
    const gam = 6 * Math.PI / 180, bet = armAbd * 0.7;
    const df = V(s * Math.sin(bet), -Math.cos(bet) * Math.cos(gam), Math.sin(gam)).normalize();
    const wrist = elbow.clone().addScaledVector(df, Lf);
    J['hand' + S] = wrist;
    J['_handDir' + S] = df.clone().lerp(V(s * 0.05, -1, 0.1), 0.35).normalize();
    // fingers
    const hd = J['_handDir' + S];
    const palmLen = handL * 0.5; // wrist → knuckles
    const half = handL * 0.215;
    const flen = { thumb: [0.28, 0.17, 0.14], index: [0.215, 0.125, 0.105], middle: [0.235, 0.14, 0.115], ring: [0.22, 0.135, 0.11], pinky: [0.17, 0.1, 0.09] };
    const off = { index: 0.8, middle: 0.27, ring: -0.27, pinky: -0.78 };   // lateral fraction across the knuckles; + = towards thumb(+z) side
    const front = V(0, 0, 1);
    for (const fn of FINGERS) {
      let p;
      if (fn === 'thumb') p = wrist.clone().addScaledVector(hd, palmLen * 0.18).addScaledVector(front, half * 1.12).addScaledVector(V(-s, 0, 0), half * 0.55);
      else p = wrist.clone().addScaledVector(hd, palmLen).addScaledVector(front, half * off[fn]);
      // thumb direction splays forward/down
      let dir = hd.clone();
      if (fn === 'thumb') dir = hd.clone().multiplyScalar(0.8).addScaledVector(front, 0.55).addScaledVector(V(-s, 0, 0), 0.15).normalize();
      for (let k = 0; k < 3; k++) {
        J[`${fn}${S}${k + 1}`] = p.clone();
        p = p.clone().addScaledVector(dir, handL * flen[fn][k]);
        if (k === 2) J[`${fn}${S}tip`] = p.clone();
      }
    }
    // legs
    const hipJ = V(s * hipW, hipY, 0.0);
    J['upperLeg' + S] = hipJ;
    J['lowerLeg' + S] = V(s * hipW * 0.97, kneeY, 0.004);
    J['foot' + S] = V(s * hipW * 0.93, ankleY, -0.012);
    const footLen = H * adj(0.152, 0.145) * (b.hand ** 0.3);
    J['toes' + S] = V(s * hipW * 0.93, 0.03 * Math.min(1, H / 1.7), -0.012 + footLen * 0.62);
    J['_footLen'] = footLen;
  }
  J._handLen = handL;
  const dims = { H, hh, sh, hipY, kneeY, ankleY, neckY, shY, earY, chinY, shHalf, hipW, armAbd, Lu, Lf, handL, footLen: J._footLen,
    thigh: V().subVectors(J.upperLegL, J.lowerLegL).length(), shin: V().subVectors(J.lowerLegL, J.footL).length() };
  return { J, dims };
}

/** Bone hierarchy (parent names) */
export function boneParents(extra = []) {
  const par = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', eyeL: 'head', eyeR: 'head' };
  for (const S of ['L', 'R']) {
    par['clavicle' + S] = 'chest'; par['upperArm' + S] = 'clavicle' + S; par['foreArm' + S] = 'upperArm' + S; par['hand' + S] = 'foreArm' + S;
    for (const fn of FINGERS) { par[`${fn}${S}1`] = 'hand' + S; par[`${fn}${S}2`] = `${fn}${S}1`; par[`${fn}${S}3`] = `${fn}${S}2`; }
    par['upperLeg' + S] = 'hips'; par['lowerLeg' + S] = 'upperLeg' + S; par['foot' + S] = 'lowerLeg' + S; par['toes' + S] = 'foot' + S;
  }
  for (const e of extra) par[e.name] = e.parent;
  return par;
}

/** Build Bone objects + Skeleton. extra = [{name,parent,pos:V3}] (hair chains etc.) */
export function createRig(layout, extra = []) {
  const { J } = layout;
  const parents = boneParents(extra);
  const pos = { ...J }; for (const e of extra) pos[e.name] = e.pos;
  const names = Object.keys(parents);
  const bones = {}, list = [];
  // ensure parents are created before children: names order in parents obj is parent-first except extras (also parent-first)
  for (const n of names) {
    const bone = new THREE.Bone(); bone.name = n; bones[n] = bone; list.push(bone);
    const p = parents[n];
    const wp = pos[n]; if (!wp) throw new Error('no joint position for ' + n);
    if (p) { bones[p].add(bone); bone.position.copy(wp).sub(pos[p]); } else bone.position.copy(wp);
  }
  const index = {}; list.forEach((b, i) => { index[b.name] = i; });
  const root = bones.hips;
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const rest = {}; for (const n of names) rest[n] = { p: bones[n].position.clone(), q: bones[n].quaternion.clone() };
  return { bones, list, index, root, skeleton, parents, rest, pos };
}
