// Crawlers ("creepy crawlers"): armoured crab-spider scuttlers. Hero (rigged, IK legs, tripod gait) + instanced swarm (baked from the hero rig).
import * as THREE from 'three';
import { RNG, disposeTree, damp, clamp, Q } from '../../engine/common.js';
import { setInfection as setInfectionTree } from '../../engine/infect.js';
import { makeVessariMaterials, setBloody as setBloodyTree } from './materials.js';
import { createInstanceSet } from './instanced.js';
import { tag, spindle } from './crowd.js';
import { infectable } from '../../engine/infect.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { V3, loft, sweep, blob, spike, solve2, quatFromDirAxis, bindAlong, bindRigid, bindFn, mergeSkinned, makeProbe, rayHit, conformStrip, surfacePlate, mirrorX } from './util.js';

const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
const ease = (v) => v * v * (3 - 2 * v);
const sin = Math.sin, cos = Math.cos;

// ------------------------------------------------------------------ dimensions
export const CR = {
  bodyY: 0.31, femur: 0.40, tibia: 0.60, tarsus: 0.22, tarAng: 62 * DEG,
  attach: [[0.27, -0.03, 0.25], [0.30, -0.03, 0.0], [0.27, -0.03, -0.26]],      // left side (+x); mirrored for the right
  foot: [[0.72, 0, 0.74], [0.90, 0, 0.06], [0.74, 0, -0.70]],                  // rest foot targets (ground frame), left side
};
const legSide = (k) => (k < 3 ? 1 : -1);
const legRow = (k) => k % 3;
// ------------------------------------------------------------------ pose channels
const names = ['rX', 'rY', 'rZ', 'rP', 'rYaw', 'rR'];
for (let k = 0; k < 6; k++) names.push('f' + k + 'x', 'f' + k + 'y', 'f' + k + 'z', 'f' + k + 't'); // foot target + tarsus pitch offset
names.push('md', 'pal', 'spot', 'tw', 'eye');
export const CC = {}; names.forEach((n, i) => { CC[n] = i; });
const NCC = names.length;
const newPose = () => new Float32Array(NCC);
function restPose(P) {
  P.fill(0);
  for (let k = 0; k < 6; k++) { const s = legSide(k), f = CR.foot[legRow(k)]; P[CC['f' + k + 'x']] = f[0] * s; P[CC['f' + k + 'y']] = 0; P[CC['f' + k + 'z']] = f[2]; }
  P[CC.spot] = 1; P[CC.eye] = 1; return P;
}

// ------------------------------------------------------------------ rig
function buildCrawlerRig() {
  const bones = [], idx = {}, R = {}; const group = new THREE.Group(); group.name = 'crawlerRig';
  const def = (name, parent, pos) => { const b = new THREE.Bone(); b.name = name; idx[name] = bones.length; bones.push(b); R[name] = pos.clone(); if (parent) { b.position.copy(pos).sub(R[parent]); bones[idx[parent]].add(b); } else { b.position.copy(pos); group.add(b); } return b; };
  def('body', null, new V3(0, CR.bodyY, 0));
  const legs = [];
  for (let k = 0; k < 6; k++) {
    const s = legSide(k), a = CR.attach[legRow(k)], f = CR.foot[legRow(k)];
    const A = new V3(a[0] * s, CR.bodyY + a[1], a[2]); const F = new V3(f[0] * s, 0, f[2]);
    const dirOut = new V3(F.x - A.x, 0, F.z - A.z).normalize();
    const tarVec = dirOut.clone().multiplyScalar(cos(CR.tarAng) * CR.tarsus).add(new V3(0, -sin(CR.tarAng) * CR.tarsus, 0));
    const ankle = F.clone().sub(tarVec);
    const knee = new V3(), end = new V3(), axis = new V3(); solve2(A, ankle, CR.femur, CR.tibia, new V3(0, 1, 0), knee, end, axis);
    def('fem' + k, 'body', A); def('tib' + k, 'fem' + k, knee); def('tar' + k, 'tib' + k, end);
    legs.push({ A, knee, ankle: end.clone(), foot: end.clone().add(tarVec), axis: axis.clone(), s, tarVec });
  }
  // mandibles & palps
  const M = (x, y, z) => new V3(x, CR.bodyY + y, z);
  def('mdL', 'body', M(0.10, -0.075, 0.36)); def('mdR', 'body', M(-0.10, -0.075, 0.36)); def('pL', 'body', M(0.05, -0.085, 0.40)); def('pR', 'body', M(-0.05, -0.085, 0.40));
  const restQ = {};
  legs.forEach((L, k) => {
    restQ['fem' + k] = quatFromDirAxis(L.knee.clone().sub(L.A), L.axis, new THREE.Quaternion());
    restQ['tib' + k] = quatFromDirAxis(L.ankle.clone().sub(L.knee), L.axis, new THREE.Quaternion());
    restQ['tar' + k] = quatFromDirAxis(L.foot.clone().sub(L.ankle), L.axis, new THREE.Quaternion());
  });
  const B = {}; for (const n in idx) B[n] = bones[idx[n]];
  const rig = { bones, idx, R, B, legs, restQ, group, skeleton: null };
  const e1 = new THREE.Euler(0, 0, 0, 'YXZ'); const qBody = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const mBody = new THREE.Matrix4(); const a = new V3(), tgt = new V3(), ank = new V3(), knee = new V3(), end = new V3(), ax = new V3(), dirOut = new V3(), tv = new V3(), pole = new V3(), tmp = new V3();
  rig.applyPose = (P) => {
    const body = B.body; body.position.set(R.body.x + P[CC.rX], R.body.y + P[CC.rY], R.body.z + P[CC.rZ]);
    e1.set(P[CC.rP], P[CC.rYaw], P[CC.rR], 'YXZ'); body.quaternion.setFromEuler(e1); body.updateMatrix(); mBody.copy(body.matrix); qBody.setFromRotationMatrix(mBody);
    pole.set(0, 1, 0).applyQuaternion(qBody);
    for (let k = 0; k < 6; k++) {
      const L = legs[k]; a.copy(B['fem' + k].position).applyMatrix4(mBody);
      tgt.set(P[CC['f' + k + 'x']], P[CC['f' + k + 'y']], P[CC['f' + k + 'z']]);
      dirOut.set(tgt.x - a.x, 0, tgt.z - a.z); if (dirOut.lengthSq() < 1e-6) dirOut.set(L.s, 0, 0); dirOut.normalize();
      const ang = CR.tarAng + P[CC['f' + k + 't']];
      tv.copy(dirOut).multiplyScalar(cos(ang) * CR.tarsus); tv.y = -sin(ang) * CR.tarsus;
      ank.copy(tgt).sub(tv);
      solve2(a, ank, CR.femur, CR.tibia, pole, knee, end, ax);
      quatFromDirAxis(tmp.copy(knee).sub(a), ax, qa).multiply(qt.copy(restQ['fem' + k]).invert());
      quatFromDirAxis(tmp.copy(end).sub(knee), ax, qb).multiply(qt.copy(restQ['tib' + k]).invert());
      B['fem' + k].quaternion.copy(qBody).invert().multiply(qa);
      B['tib' + k].quaternion.copy(qa).invert().multiply(qb);
      quatFromDirAxis(tmp.copy(tgt).sub(end), ax, qt).multiply(qa.copy(restQ['tar' + k]).invert());
      B['tar' + k].quaternion.copy(qb).invert().multiply(qt);
    }
    const md = P[CC.md], pal = P[CC.pal];
    B.mdL.quaternion.setFromEuler(e1.set(-0.25 * md, 0.55 * md + 0.0, -0.35 * md, 'YXZ')); B.mdR.quaternion.setFromEuler(e1.set(-0.25 * md, -0.55 * md, 0.35 * md, 'YXZ'));
    B.pL.quaternion.setFromEuler(e1.set(0.5 * md + 0.25 * pal, 0.3 * md, 0, 'YXZ')); B.pR.quaternion.setFromEuler(e1.set(0.5 * md + 0.25 * pal, -0.3 * md, 0, 'YXZ'));
  };
  rig.makeSkeleton = () => { group.updateMatrixWorld(true); rig.skeleton = new THREE.Skeleton(bones); return rig.skeleton; };
  return rig;
}

// ------------------------------------------------------------------ geometry (hero)
function buildCrawlerBody(rig, seed) {
  const bk = { skin: [], shell: [], glow: [], mouth: [], dark: [] }; const B = rig.idx; const rng = new RNG(seed * 31 + 7);
  const add = (b, g) => { if (g) bk[b].push(g); return g; };
  const Y = CR.bodyY;
  // carapace
  const shellSecs = [
    { t: -0.50, rx: 0.04, ry: 0.025, cy: 0.04 }, { t: -0.42, rx: 0.24, ry: 0.07, cy: 0.06, bot: 0.3, power: 2.8 }, { t: -0.26, rx: 0.42, ry: 0.105, cy: 0.06, bot: 0.3, power: 2.8 }, { t: -0.04, rx: 0.50, ry: 0.125, cy: 0.05, bot: 0.3, power: 2.8 },
    { t: 0.18, rx: 0.46, ry: 0.115, cy: 0.05, bot: 0.3, power: 2.8 }, { t: 0.36, rx: 0.33, ry: 0.088, cy: 0.045, bot: 0.3, power: 2.7 }, { t: 0.46, rx: 0.17, ry: 0.055, cy: 0.035, bot: 0.3 }, { t: 0.52, rx: 0.04, ry: 0.025, cy: 0.03 },
  ].map((s) => ({ ...s, cy: s.cy + Y }));
  const cara = loft(shellSecs, { axis: 'z', radial: 36, tile: 0.5 }); bindRigid(cara, B.body); add('shell', cara);
  const probe = makeProbe(cara.clone());
  // belly (skin) tucked under the shell
  const belly = loft([{ t: -0.40, rx: 0.12, ry: 0.05, cy: Y - 0.03 }, { t: -0.2, rx: 0.34, ry: 0.09, cy: Y - 0.04 }, { t: 0.0, rx: 0.40, ry: 0.10, cy: Y - 0.045 }, { t: 0.2, rx: 0.36, ry: 0.09, cy: Y - 0.04 }, { t: 0.4, rx: 0.2, ry: 0.065, cy: Y - 0.03 }, { t: 0.5, rx: 0.04, ry: 0.025, cy: Y - 0.025 }], { axis: 'z', radial: 24, tile: 0.3 }); bindRigid(belly, B.body); add('skin', belly);
  // raised plate ridges across the back (conform to shell)
  for (let i = 0; i < 5; i++) {
    const z = -0.32 + i * 0.16; const path = []; for (let j = 0; j <= 14; j++) { const x = (j / 14 * 2 - 1) * 0.40 * (1 - Math.abs(i - 2) * 0.1); path.push({ o: new V3(x, Y + 0.6, z), d: new V3(0, -1, 0) }); }
    const g = conformStrip(probe, path, [0.001, 0.03, 0.045, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.045, 0.03, 0.001].concat([0.001]).slice(0, 15), 0.012, { tile: 0.3 }); if (g) { bindRigid(g, B.body); add('shell', g); }
  }
  // dorsal ridge + side spines
  { const pts = []; for (let i = 0; i <= 8; i++) { const z = -0.38 + i * 0.1; const r = rayHit(probe, new V3(0, Y + 0.6, z), new V3(0, -1, 0)); if (r) pts.push(r.p.clone().add(new V3(0, 0.012, 0))); }
    if (pts.length > 3) { const g = sweep(pts, [0.006, 0.014, 0.018, 0.018, 0.016, 0.014, 0.01, 0.006, 0.003], [0.02, 0.04, 0.05, 0.05, 0.045, 0.04, 0.03, 0.02, 0.01], { radial: 8, samples: 20, round: 1, tile: 0.2, up: new V3(0, 0, 1) }); bindRigid(g, B.body); add('shell', g); } }
  for (const s of [1, -1]) for (let i = 0; i < 5; i++) { const z = -0.34 + i * 0.17; const r = rayHit(probe, new V3(s * 0.7, Y + 0.05, z), new V3(-s, 0, 0)); if (r) { const sp = spike(r.p.clone().add(r.n.clone().multiplyScalar(-0.01)), r.p.clone().add(r.n.clone().multiplyScalar(0.11)).add(new V3(0, 0.03, -0.03)), 0.022, { radial: 6, curve: 0.3, bend: new V3(0, 0.3, -0.3) }); bindRigid(sp, B.body); add('shell', sp); } }
  // glowing cyan spots on the back
  const spots = [[0, -0.2, 0.05], [0.16, -0.08, 0.04], [-0.16, -0.08, 0.04], [0.26, 0.1, 0.035], [-0.26, 0.1, 0.035], [0, 0.06, 0.055], [0.12, 0.26, 0.03], [-0.12, 0.26, 0.03]];
  for (const [x, z, r] of spots) { const h = rayHit(probe, new V3(x, Y + 0.6, z), new V3(0, -1, 0)); if (h) { const b = blob(h.p.clone().addScaledVector(h.n, 0.004), r, r * 0.35, r, { w: 8, h: 5 }); b.rotateX(0); bindRigid(b, B.body); add('glow', b); } }
  // eyes + mouth + mandibles
  for (const s of [1, -1]) for (const [x, z] of [[0.07, 0.47], [0.13, 0.43]]) { const h = rayHit(probe, new V3(x * s, Y + 0.5, z), new V3(0, -1, 0)); if (h) { const b = blob(h.p.clone().addScaledVector(h.n, 0.002), 0.018, 0.012, 0.018, { w: 8, h: 6 }); bindRigid(b, B.body); add('glow', b); } }
  const cav = blob([0, Y - 0.085, 0.40], 0.10, 0.045, 0.085, { w: 14, h: 8 }); bindRigid(cav, B.body); add('mouth', cav);
  for (const [S, s] of [['L', 1], ['R', -1]]) {
    const o = rig.R['md' + S]; const p = (x, y, z) => o.clone().add(new V3(x * s, y, z));
    const g = sweep([p(0, 0, 0), p(0.02, -0.03, 0.07), p(0.0, -0.04, 0.15), p(-0.045, -0.025, 0.2), p(-0.075, 0.0, 0.215)], [0.03, 0.032, 0.026, 0.016, 0.005], [0.02, 0.022, 0.018, 0.011, 0.004], { radial: 9, samples: 16, round: 2, tile: 0.2, up: new V3(0, 1, 0) }); bindRigid(g, B['md' + S]); add('shell', g);
    for (let i = 0; i < 4; i++) { const t0 = p(-0.012, -0.01 + (i % 2) * 0.004, 0.04 + i * 0.035); const tt = spike(t0, t0.clone().add(new V3(-0.03 * s, 0.012, 0.012)), 0.006, { radial: 4 }); bindRigid(tt, B['md' + S]); add('shell', tt); }
    const q = rig.R['p' + S]; const pg = sweep([q.clone(), q.clone().add(new V3(0.01 * s, -0.01, 0.05)), q.clone().add(new V3(0.0, 0.0, 0.1))], [0.012, 0.01, 0.004], [0.009, 0.008, 0.003], { radial: 6, samples: 6, round: 1, tile: 0.1 }); bindRigid(pg, B['p' + S]); add('dark', pg);
  }
  // legs: continuous skinned sweep femur->tibia->tarsus with knee/ankle swellings, plates and spines
  rig.legs.forEach((L, k) => {
    const joints = [L.A, L.knee, L.ankle, L.foot]; const bones = [B['fem' + k], B['tib' + k], B['tar' + k]];
    const pts = [], rad = []; const seg3 = [[L.A, L.knee, 0.052, 0.046, 6], [L.knee, L.ankle, 0.046, 0.030, 7], [L.ankle, L.foot, 0.030, 0.011, 4]];
    seg3.forEach(([a, b, r0, r1, n], si) => { for (let i = 0; i < n + (si === 2 ? 1 : 0); i++) { const t = i / n; pts.push(a.clone().lerp(b, t)); rad.push((r0 + (r1 - r0) * t) * (1 + (si < 2 ? 0.28 : 0) * sin(PI * t) * (si === 0 ? 0.7 : 1))); } });
    const g = sweep(pts, rad, rad.map((r) => r * 0.9), { radial: 9, round: 2, tile: 0.2, up: new V3(0, 0, 1) }); bindAlong(g, joints.concat([L.foot.clone().add(new V3(0, -0.05, 0))]), bones, 0.06); add('skin', g);
    const kb = blob(L.knee, 0.062, 0.062, 0.062, { w: 10, h: 7 }); bindAlong(kb, joints, bones, 0.04); add('shell', kb);
    const ks = spike(L.knee.clone().add(new V3(0, 0.04, 0)), L.knee.clone().add(new V3(L.s * 0.03, 0.18, 0.0)), 0.025, { radial: 6 }); bindRigid(ks, B['tib' + k]); add('shell', ks);
    // armour plate along the top of the femur and the outside of the tibia
    const fa = L.knee.clone().sub(L.A); const fp = sweep([L.A.clone().addScaledVector(fa, 0.15).add(new V3(0, 0.045, 0)), L.A.clone().addScaledVector(fa, 0.5).add(new V3(0, 0.06, 0)), L.A.clone().addScaledVector(fa, 0.88).add(new V3(0, 0.055, 0))], [0.034, 0.04, 0.03], [0.012, 0.015, 0.011], { radial: 8, samples: 8, round: 1, tile: 0.2, up: new V3(0, 1, 0) }); bindRigid(fp, B['fem' + k]); add('shell', fp);
    const ta = L.ankle.clone().sub(L.knee); for (let i = 0; i < 3; i++) { const b0 = L.knee.clone().addScaledVector(ta, 0.3 + i * 0.22); const o = new V3(L.s * 0.0, 0.0, 0).add(new V3(ta.x, 0, ta.z).normalize().multiplyScalar(0.03)); const sp = spike(b0.clone().add(o), b0.clone().add(o).add(new V3(L.s * 0.05, 0.04, 0.0)), 0.012, { radial: 4 }); bindRigid(sp, B['tib' + k]); add('shell', sp); }
    // claw tip (bone)
    const tarDir = L.foot.clone().sub(L.ankle).normalize(); const claw = spike(L.foot.clone().addScaledVector(tarDir, -0.04), L.foot.clone().addScaledVector(tarDir, 0.075), 0.017, { radial: 6, curve: 0.4, bend: new V3(0, 0.4, 0) }); bindRigid(claw, B['tar' + k]); add('shell', claw);
  });
  const geos = {}; for (const k of Object.keys(bk)) geos[k] = mergeSkinned(bk[k]);
  return geos;
}

// ------------------------------------------------------------------ clips
const clips = {}; const def = (name, dur, loop, fn, extra = {}) => { clips[name] = { name, dur, loop, fn, ...extra }; };
const TRI = [[0, 4, 2], [3, 1, 5]]; // tripod sets
function legPhase(k) { return (k === 0 || k === 4 || k === 2) ? 0 : 0.5; }
function footCycle(P, k, p, g) {
  const f = CR.foot[legRow(k)], s = legSide(k); const d = g.duty; let dz, y, tp;
  if (p < d) { const u = p / d; dz = g.stride * (1 - 2 * u); y = 0; tp = 0.0; }
  else { const v = (p - d) / (1 - d); const e = ease(v); dz = -g.stride + 2 * g.stride * e; y = g.lift * Math.pow(sin(PI * v), 0.8); tp = -0.5 * sin(PI * v); }
  const row = legRow(k); const out = (g.out || 0) * (row === 1 ? 1 : 0.7);
  P[CC['f' + k + 'x']] = (f[0] + out) * s; P[CC['f' + k + 'y']] = y; P[CC['f' + k + 'z']] = f[2] + dz + g.zshift * (row - 1) * -1; P[CC['f' + k + 't']] = tp;
}
function scuttleClip(P, t, T, g, o) {
  restPose(P); const p = ((t / T) % 1 + 1) % 1;
  for (let k = 0; k < 6; k++) footCycle(P, k, (p + legPhase(k)) % 1, g);
  const sp = sin(TAU * p), cp = cos(TAU * p);
  P[CC.rY] = -o.bob * cos(4 * PI * p) - o.down; P[CC.rR] = o.roll * sp; P[CC.rYaw] = o.yaw * sin(TAU * p * 2 + 0.7) + o.wig * sin(TAU * p); P[CC.rP] = o.pitch; P[CC.rX] = o.sway * sp;
  P[CC.md] = 0.15 + 0.15 * sin(TAU * p * 2); P[CC.pal] = sin(TAU * p * 3); P[CC.spot] = 1 + 0.3 * sin(TAU * p);
}
const SC = { stride: 0.30, duty: 0.58, lift: 0.17, zshift: 0.0, out: 0.0 }, RN = { stride: 0.38, duty: 0.50, lift: 0.22, zshift: 0.0, out: 0.08 };
const CRAWL_T = { scuttle: 0.46, run: 0.27 };
export const CRAWLER_SPEED = { scuttle: 2 * SC.stride / (SC.duty * CRAWL_T.scuttle), run: 2 * RN.stride / (RN.duty * CRAWL_T.run) };
def('idle', 6.0, true, (P, t) => {
  restPose(P); const w = t * TAU / 6.0; P[CC.rY] = 0.006 * sin(w * 3) - 0.01; P[CC.rP] = 0.02 * sin(w); P[CC.rYaw] = 0.04 * sin(w * 0.5);
  // an occasional leg adjusts: leg index cycles every 1.5 s
  const slot = Math.floor(t / 1.5) % 6, lt = (t % 1.5) / 1.5; const k = [0, 4, 2, 3, 1, 5][slot]; const lift = sin(PI * clamp(lt * 1.4)); const f = CR.foot[legRow(k)]; P[CC['f' + k + 'y']] = 0.10 * lift; P[CC['f' + k + 'z']] = f[2] + 0.06 * sin(PI * clamp(lt * 1.4)) * (legRow(k) === 0 ? 1 : -1); P[CC['f' + k + 't']] = -0.3 * lift;
  P[CC.md] = 0.12 + 0.12 * Math.max(0, sin(w * 7)); P[CC.pal] = sin(w * 11); P[CC.spot] = 0.8 + 0.4 * sin(w * 2); P[CC.tw] = 0;
});
def('scuttle', CRAWL_T.scuttle, true, (P, t) => scuttleClip(P, t, CRAWL_T.scuttle, SC, { bob: 0.012, down: 0.015, roll: 0.05, yaw: 0.05, wig: 0.06, pitch: 0.04, sway: 0.01 }), { moveSpeed: CRAWLER_SPEED.scuttle });
def('run', CRAWL_T.run, true, (P, t) => { scuttleClip(P, t, CRAWL_T.run, RN, { bob: 0.02, down: 0.05, roll: 0.07, yaw: 0.07, wig: 0.08, pitch: 0.12, sway: 0.015 }); P[CC.md] = 0.4 + 0.3 * sin(TAU * t / CRAWL_T.run * 2); }, { moveSpeed: CRAWLER_SPEED.run });
def('leap', 1.5, false, (P, t, o = {}) => {
  restPose(P); const D = o.dist ?? 2.8, Hh = o.height ?? 1.0;
  const coil = sstep(0.0, 0.32, t) * (1 - sstep(0.32, 0.42, t)); const fl = sstep(0.38, 0.5, t) * (1 - sstep(1.05, 1.22, t)); const tt = clamp((t - 0.40) / 0.7); const arc = 4 * tt * (1 - tt);
  const land = sstep(1.05, 1.2, t) * (1 - sstep(1.2, 1.5, t));
  P[CC.rZ] = D * sstep(0.40, 1.10, t) - 0.12 * coil; P[CC.rY] = -0.13 * coil + Hh * arc - 0.07 * land; P[CC.rP] = 0.18 * coil - 0.38 * fl * (1 - tt * 0.8) + 0.2 * tt * fl;
  for (let k = 0; k < 6; k++) { const f = CR.foot[legRow(k)], s = legSide(k), row = legRow(k);
    const inAir = t > 0.42 && t < 1.12; const tz = P[CC.rZ];
    // before take-off: planted (pulled in during the coil); in flight: splayed out and forward; after landing: planted at new place
    let fx = f[0] * s * (1 - 0.35 * coil), fz = f[2] * (1 - 0.3 * coil), fy = 0, ft = 0;
    if (inAir) { fx = f[0] * s * (1.25 + 0.15 * fl); fz = tz + (row === 0 ? 1.05 : row === 1 ? 0.35 : -0.55) * (0.9 + 0.2 * fl); fy = 0.2 + 0.55 * fl * (row === 0 ? 1.2 : 0.7) + 0.4 * arc * 0.5; ft = 0.4 * fl; }
    else if (t >= 1.12) { fz = tz + f[2] + (row === 2 ? 0 : 0.1 * (1 - land)); fy = 0; }
    P[CC['f' + k + 'x']] = fx; P[CC['f' + k + 'y']] = fy; P[CC['f' + k + 'z']] = fz; P[CC['f' + k + 't']] = ft;
  }
  P[CC.md] = 0.5 + 0.5 * fl + 0.4 * coil; P[CC.pal] = sin(t * 30); P[CC.spot] = 1.5 + 1.5 * fl; P[CC.eye] = 1.5;
}, { displacement: 2.8 });
def('screech', 2.4, false, (P, t) => {
  restPose(P); const up = sstep(0.0, 0.5, t) * (1 - sstep(1.9, 2.4, t)), sh = sin(t * 55) * up * (sstep(0.5, 0.7, t));
  P[CC.rP] = -0.85 * up; P[CC.rY] = 0.20 * up; P[CC.rZ] = -0.12 * up; P[CC.rR] = 0.03 * sh; P[CC.rYaw] = 0.04 * sh;
  for (let k = 0; k < 6; k++) { const f = CR.foot[legRow(k)], s = legSide(k), row = legRow(k);
    if (row === 0) { P[CC['f' + k + 'x']] = f[0] * s * (1 + 0.45 * up); P[CC['f' + k + 'y']] = 0.15 + 1.1 * up; P[CC['f' + k + 'z']] = f[2] * (0.8 - 0.1 * up) + 0.2 * up; P[CC['f' + k + 't']] = 0.6 * up + 0.2 * sin(t * 12 + k) * up; }
    else if (row === 1) { P[CC['f' + k + 'x']] = f[0] * s * (1 + 0.15 * up); P[CC['f' + k + 'z']] = f[2] - 0.1 * up; P[CC['f' + k + 'y']] = 0.05 * up; }
    else { P[CC['f' + k + 'x']] = f[0] * s * (1 + 0.1 * up); P[CC['f' + k + 'z']] = f[2] - 0.15 * up; P[CC['f' + k + 'y']] = 0; } }
  P[CC.md] = 1.2 * up + 0.1 * sh; P[CC.pal] = sin(t * 40) * up; P[CC.spot] = 1 + 2.2 * up * (0.6 + 0.4 * sin(t * 26)); P[CC.eye] = 1 + 1.5 * up;
});
function deadPose(P, curl, t = 0) {
  restPose(P); P[CC.rR] = PI * 0.97; P[CC.rY] = lerp(0, -0.12, 1); P[CC.rYaw] = 0.2;
  for (let k = 0; k < 6; k++) { const s = legSide(k), row = legRow(k); const f = CR.foot[row]; const wob = 0.03 * sin(t * 3 + k * 1.7);
    // legs curl up (toward world +y, since the body is upside down) and inward
    P[CC['f' + k + 'x']] = lerp(f[0] * s, s * (0.28 + 0.08 * row + wob), curl); P[CC['f' + k + 'y']] = lerp(0, 0.62 + 0.14 * (row === 1 ? 1 : 0) + wob, curl); P[CC['f' + k + 'z']] = lerp(f[2], f[2] * 0.42 + 0.05, curl); P[CC['f' + k + 't']] = lerp(0, -0.8, curl); }
  P[CC.md] = lerp(0, 0.7, curl); P[CC.spot] = lerp(1, 0.08, curl); P[CC.eye] = lerp(1, 0.05, curl);
}
def('die', 1.7, false, (P, t) => {
  const k = sstep(0.1, 1.0, t); const k2 = ease(k); const thrash = sin(t * 28) * (1 - sstep(0.2, 1.2, t)) * sstep(0.0, 0.1, t);
  deadPose(P, sstep(0.3, 1.4, t), t); P[CC.rR] = PI * 0.97 * k2 + 0.15 * thrash; P[CC.rY] = lerp(0.2, -0.12, k2) + 0.18 * sin(PI * k) ; P[CC.rP] += 0.1 * thrash; P[CC.rYaw] = 0.2 * k2;
  if (k < 1) { for (let q = 0; q < 6; q++) { P[CC['f' + q + 'y']] += (1 - k) * 0.0; } }
  P[CC.md] = 0.9 * (1 - sstep(0.8, 1.4, t)) + 0.5 * sstep(0.8, 1.4, t); P[CC.pal] = thrash;
});
def('dead', 3.0, true, (P, t) => { deadPose(P, 1, t); P[CC.pal] = 0.1 * sin(t * 2); });
def('climb', 1.3, true, (P, t) => {
  // crawler on a wall located at +z (belly towards the wall, nose up): body pitched -90deg; feet on the plane z=0.30
  restPose(P); const p = ((t / 1.3) % 1 + 1) % 1; const g = { stride: 0.28, duty: 0.58, lift: 0.14 };
  P[CC.rP] = -PI / 2; P[CC.rY] = 0.0; P[CC.rZ] = 0.05;
  for (let k = 0; k < 6; k++) { const f = CR.foot[legRow(k)], s = legSide(k); const q = (p + legPhase(k)) % 1; let dy, lift;
    if (q < g.duty) { const u = q / g.duty; dy = g.stride * (1 - 2 * u); lift = 0; } else { const v = (q - g.duty) / (1 - g.duty); dy = -g.stride + 2 * g.stride * ease(v); lift = g.lift * sin(PI * v); }
    // wall plane: feet at z = body-belly distance; positions spread along world-y (the body's forward axis)
    P[CC['f' + k + 'x']] = f[0] * s * 0.9; P[CC['f' + k + 'z']] = 0.33 - lift; P[CC['f' + k + 'y']] = CR.bodyY + f[2] * 0.95 + dy; P[CC['f' + k + 't']] = -0.2 * (lift > 0 ? 1 : 0); }
  P[CC.rY] = CR.bodyY * 0 + 0.03 * sin(TAU * p * 2) + 0.0; P[CC.rY] += 0.0; P[CC.md] = 0.2; P[CC.spot] = 1 + 0.4 * sin(TAU * p);
}, { moveSpeed: 2 * 0.28 / (0.58 * 1.3) });
export const CRAWLER_CLIPS = clips;
const wallBodyY = () => CR.bodyY; void wallBodyY;

// ------------------------------------------------------------------ hero factory
/** createCrawler(seed) -> hero {root, update, dispose, play(clip,{time,speed,blend,loop}), setInfection, setBloody} */
export function createCrawler(seed = 1, opts = {}) {
  const root = new THREE.Group(); root.name = 'crawler';
  const body = new THREE.Group(); root.add(body); const sc = opts.scale ?? (0.92 + new RNG(seed * 13 + 5).next() * 0.16); body.scale.setScalar(sc);
  const mats = makeVessariMaterials('soldier', { shell: opts.shell ?? 0xe6dcc2, skin: opts.skin ?? 0xd0dce6 });
  mats.glow.emissiveIntensity = 2.2;
  const rig = buildCrawlerRig(); const geos = buildCrawlerBody(rig, seed); body.add(rig.group);
  const meshes = [];
  for (const k of Object.keys(geos)) { const g = geos[k]; if (!g) continue; const m = new THREE.SkinnedMesh(g, mats[k]); m.name = 'crawler_' + k; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; body.add(m); meshes.push(m); }
  root.updateMatrixWorld(true); const skel = rig.makeSkeleton(); for (const m of meshes) m.bind(skel, m.matrixWorld);
  const P = newPose(), Pprev = newPose(), Pcur = newPose(), Pfinal = newPose(); const cur = { name: 'idle', time: 0, speed: 1, loop: true, explicit: false, opts: {} };
  let blendT = 1, blendDur = 0.15, infection = 0, t_ = 0; const o = {};
  restPose(Pfinal);
  function evalNow() { const cl = clips[cur.name] || clips.idle; cl.fn(Pcur, cl.loop ? cur.time : Math.min(cur.time, cl.dur), cur.opts); }
  function apply(dt, t) {
    evalNow(); const w = blendT >= 1 ? 1 : blendT * blendT * (3 - 2 * blendT);
    if (w < 1) for (let i = 0; i < NCC; i++) Pfinal[i] = Pprev[i] + (Pcur[i] - Pprev[i]) * w; else Pfinal.set(Pcur);
    if (infection > 0.02) { const a = infection; const f = t * 14; Pfinal[CC.rYaw] += 0.05 * a * Math.sin(f * 1.3) * Math.sin(f * 0.37); Pfinal[CC.rR] += 0.05 * a * Math.sin(f * 1.7); Pfinal[CC.md] += a * 0.35 * (0.5 + 0.5 * Math.sin(t * 31)); Pfinal[CC.spot] *= 1 + a * 0.5; for (let k = 0; k < 6; k++) Pfinal[CC['f' + k + 'y']] += a * 0.012 * Math.max(0, Math.sin(t * 23 + k * 2.1)); }
    rig.applyPose(Pfinal);
    mats.glow.emissiveIntensity = 2.2 * Math.max(0.03, Pfinal[CC.spot]) ;
  }
  const hero = {
    root, rig, meshes, kind: 'crawler',
    update(dt, t = t_ + dt) { t_ = t; if (blendT < 1) blendT = Math.min(1, blendT + dt / Math.max(1e-3, blendDur)); if (cur.explicit) cur.explicit = false; else cur.time += dt * cur.speed; apply(dt, t); },
    play(clip, op = {}) {
      const name = clips[clip] ? clip : 'idle'; const cl = clips[name];
      if (name !== cur.name) { Pprev.set(Pfinal); blendT = 0; blendDur = op.blend ?? 0.15; cur.name = name; cur.time = 0; cur.loop = cl.loop; cur.speed = 1; }
      if (op.speed !== undefined) cur.speed = op.speed; if (op.loop !== undefined) cur.loop = op.loop; if (op.time !== undefined) { cur.time = op.time; cur.explicit = true; }
      if (op.dist !== undefined) cur.opts.dist = op.dist; if (op.height !== undefined) cur.opts.height = op.height;
      return hero;
    },
    clipInfo(name) { const c = clips[name]; return c ? { duration: c.dur, loop: c.loop, moveSpeed: c.moveSpeed || 0, displacement: c.displacement || 0 } : null; },
    setInfection(a) { infection = clamp(a, 0, 1); setInfectionTree(root, infection); return hero; },
    setBloody(a) { setBloodyTree(root, clamp(a, 0, 1)); return hero; },
    setTransform(x, y, z, yaw) { root.position.set(x, y, z); root.rotation.y = yaw; return hero; },
    dispose() { disposeTree(root); },
  };
  apply(0, 0); void o; return hero;
}

// =====================================================================================================================
// SWARM: instanced crawlers (<= 400 tris), one draw call. Poses are baked from the hero rig into a texture; the vertex shader is FK only.
// =====================================================================================================================
export const SWARM_STATES = { idle: 0, run: 1, scuttle: 2, leap: 3, screech: 4, dead: 5, climb: 6 };
const SW_PARTS = 23, SW_W = SW_PARTS + 1;
const SW_PARENT = [-1]; for (let k = 0; k < 6; k++) SW_PARENT.push(0, 1 + 3 * k, 2 + 3 * k); SW_PARENT.push(0, 0, 0, 0);
const SW_BONES = ['body']; for (let k = 0; k < 6; k++) SW_BONES.push('fem' + k, 'tib' + k, 'tar' + k); SW_BONES.push('mdL', 'mdR', 'pL', 'pR');
const SW_ROWS = {}; let SW_ROWCOUNT = 0;
const swPlan = [['IDLE', 'idle', 2, 0, 3.0], ['SCUT', 'scuttle', 16, 0, CRAWL_T.scuttle, true], ['RUN', 'run', 16, 0, CRAWL_T.run, true], ['SCREECH', 'screech', 8, 0, 2.4], ['LEAP', 'leap', 12, 0, 1.5], ['DIE', 'die', 8, 0, 1.7], ['DEAD', 'dead', 1, 0, 0], ['CLIMB', 'climb', 12, 0, 1.3, true]];
for (const [k, , n] of swPlan) { SW_ROWS[k] = SW_ROWCOUNT; SW_ROWCOUNT += n; }
function bakeSwarmPoses() {
  const rig = buildCrawlerRig(); const P = newPose(); const data = new Float32Array(SW_W * SW_ROWCOUNT * 4); const e = new THREE.Euler(); const ql = new THREE.Quaternion(); let row = 0;
  for (const [key, clip, n, t0, t1, wrap] of swPlan) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? t0 : wrap ? t0 + (t1 - t0) * (i / n) : t0 + (t1 - t0) * (i / (n - 1));
      clips[clip].fn(P, t, {}); rig.applyPose(P);
      for (let part = 0; part < SW_PARTS; part++) { ql.copy(rig.B[SW_BONES[part]].quaternion); e.setFromQuaternion(ql, 'XYZ'); const o = (row * SW_W + part) * 4; data[o] = e.x; data[o + 1] = e.y; data[o + 2] = e.z; }
      const o = (row * SW_W + SW_PARTS) * 4; data[o] = rig.B.body.position.x - rig.R.body.x; data[o + 1] = rig.B.body.position.y - rig.R.body.y; data[o + 2] = rig.B.body.position.z - rig.R.body.z;
      row++;
    }
  }
  const tex = new THREE.DataTexture(data, SW_W, SW_ROWCOUNT, THREE.RGBAFormat, THREE.FloatType); tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true; tex.userData.shared = true;
  return { tex, rig };
}
function buildSwarmGeometry(rig) {
  const list = []; const add = (g, part, col, o) => { list.push(tag(g, part, col, o)); };
  const shell = new THREE.Color(0xcdb98c), skin = new THREE.Color(0x2c4663), dark = new THREE.Color(0x10161d); const Y = CR.bodyY;
  const secs = [
    { t: -0.50, rx: 0.05, ry: 0.03, cy: 0.04 }, { t: -0.34, rx: 0.34, ry: 0.10, cy: 0.06, bot: 0.35, power: 2.6 }, { t: -0.02, rx: 0.50, ry: 0.125, cy: 0.05, bot: 0.35, power: 2.6 }, { t: 0.28, rx: 0.40, ry: 0.10, cy: 0.045, bot: 0.35, power: 2.6 }, { t: 0.46, rx: 0.14, ry: 0.05, cy: 0.035, bot: 0.4 }, { t: 0.52, rx: 0.03, ry: 0.02, cy: 0.03 },
  ].map((s) => ({ ...s, cy: s.cy + Y }));
  add(loft(secs, { axis: 'z', radial: 8, exact: true, tile: 0.5 }), 0, shell, { shell: 1 });
  for (const [x, z] of [[0, -0.12], [0.2, 0.05], [-0.2, 0.05]]) { const q = new THREE.PlaneGeometry(0.09, 0.09); q.rotateX(-Math.PI / 2); q.translate(x, Y + 0.185 - Math.abs(x) * 0.12, z); add(q, 0, dark, { glow: 1 }); }
  rig.legs.forEach((L, k) => {
    const p0 = 1 + 3 * k;
    add(spindle(L.A, L.knee, 0.062, 0.05, 4, 0.12), p0, shell.clone().lerp(skin, 0.3), { shell: 1 });
    add(spindle(L.knee, L.ankle, 0.05, 0.026, 4, 0.1), p0 + 1, skin, {});
    add(spindle(L.ankle, L.foot.clone().add(L.foot.clone().sub(L.ankle).multiplyScalar(0.25)), 0.03, 0.006, 3, 0.1), p0 + 2, shell, { shell: 1 });
  });
  for (const [S, s, part] of [['L', 1, 19], ['R', -1, 20]]) { const o = rig.R['md' + S]; add(spindle(o.clone(), o.clone().add(new V3(-0.06 * s, -0.03, 0.2)), 0.03, 0.006, 3, 0.1), part, shell, { shell: 1 }); }
  const bd = {}; for (const g of list) { const p = g.attributes.aV.getX(0); bd[p] = (bd[p] || 0) + g.index.count / 3; }
  const merged = mergeGeometries(list, false); merged.userData.tris = merged.index.count / 3; list.forEach((g) => g.dispose()); return merged;
}
function swarmGLSL(pivots, declareInfect) {
  const arr = pivots.map((p) => `vec3(${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)})`).join(',');
  const defs = Object.keys(SW_ROWS).map((k) => `#define ROW_${k} ${SW_ROWS[k]}`).join('\n');
  return /* glsl */`
${defs}
#define NPARTS ${SW_PARTS}
uniform sampler2D uPoseTex; uniform float uTime;
attribute vec4 aV; attribute vec4 aAnim; attribute vec2 aExtra;
${declareInfect ? 'attribute float aInfect;' : ''}
const int PARENT[${SW_PARTS}] = int[${SW_PARTS}](${SW_PARENT.join(',')});
const vec3 PIV[${SW_PARTS}] = vec3[${SW_PARTS}](${arr});
float _cFlash = 0.0;
mat3 cRotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 cRotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 cRotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
vec3 cRow(int row, int col){ return texelFetch(uPoseTex, ivec2(col, row), 0).xyz; }
int g_base; int g_n; float g_fr; bool g_wrap; vec3 g_trans; float g_dead;
vec3 cPart(int part){
  float f = g_wrap ? fract(g_fr) * float(g_n) : clamp(g_fr, 0.0, 1.0) * float(g_n - 1);
  int i0 = int(floor(f)); int i1 = g_wrap ? (i0 + 1) - ((i0 + 1) >= g_n ? g_n : 0) : min(i0 + 1, g_n - 1); float w = f - float(i0);
  return mix(cRow(g_base + i0, part), cRow(g_base + i1, part), w);
}
void cSetup(){
  int st = int(aAnim.x + 0.5); float sp = aAnim.z; float tt = uTime * sp + aAnim.y; float tl = max(0.0, (uTime - aAnim.w)) * sp;
  g_wrap = false; g_n = 2; g_fr = 0.5 + 0.5 * sin(tt * 1.3); g_base = ROW_IDLE; g_dead = 0.0;
  if (st == 1) { g_base = ROW_RUN; g_n = 16; g_wrap = true; g_fr = tt / ${CRAWL_T.run}; }
  else if (st == 2) { g_base = ROW_SCUT; g_n = 16; g_wrap = true; g_fr = tt / ${CRAWL_T.scuttle}; }
  else if (st == 3) { g_base = ROW_LEAP; g_n = 12; g_fr = tl / 1.5; }
  else if (st == 4) { g_base = ROW_SCREECH; g_n = 8; g_fr = tl / 2.4; }
  else if (st == 5) { if (tl < 1.7) { g_base = ROW_DIE; g_n = 8; g_fr = tl / 1.7; } else { g_base = ROW_DEAD; g_n = 1; g_fr = 0.0; } }
  else if (st == 6) { g_base = ROW_CLIMB; g_n = 12; g_wrap = true; g_fr = tt / 1.3; }
  g_trans = cPart(NPARTS);
  if (st == 3 && aExtra.x > 0.0) g_trans.z *= aExtra.x / 2.8;
}
void crowdAnimate(inout vec3 p, inout vec3 n){
  int part = int(aV.x + 0.5);
  cSetup();
  for (int k = 0; k < 5; k++) {
    if (part < 0) break;
    vec3 a = cPart(part);
    mat3 R = cRotX(a.x) * cRotY(a.y) * cRotZ(a.z);
    vec3 pv = PIV[part];
    p = R * (p - pv) + pv; n = R * n;
    part = PARENT[part];
  }
  p += g_trans;
}`;
}
let _swarmBase = null;
function getSwarmBase() { if (!_swarmBase) { const b = bakeSwarmPoses(); const geo = buildSwarmGeometry(b.rig); const pivots = SW_BONES.map((n) => b.rig.R[n].clone()); _swarmBase = { tex: b.tex, geo, pivots }; } return _swarmBase; }
export function swarmTriCount() { return getSwarmBase().geo.userData.tris; }

/** createCrawlerSwarm(capacity, opts) -> Crowd. set(i,{x,y,z,yaw,state:'idle|run|scuttle|leap|screech|dead|climb',speed,phase,scale,infect,tint,leapDist}) */
export function createCrawlerSwarm(capacity = 800, opts = {}) {
  const b = getSwarmBase(); const geo = b.geo.clone(); const timeU = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.04 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPoseTex = { value: b.tex }; shader.uniforms.uTime = timeU;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 aTint;\nvarying float vGlow;\n${swarmGLSL(b.pivots, false)}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 _cp = position; crowdAnimate(_cp, objectNormal);\nvGlow = aV.y;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = _cp;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb *= mix(vec3(1.0), aTint, aV.z);\n#endif');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;').replace('#include <color_fragment>', '#include <color_fragment>\ntotalEmissiveRadiance += vec3(0.10, 0.78, 1.0) * vGlow * 1.8;');
  };
  mat.customProgramCacheKey = () => 'crawlerSwarm'; infectable(mat, { instanced: true });
  const dep = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  dep.onBeforeCompile = (shader) => { shader.uniforms.uPoseTex = { value: b.tex }; shader.uniforms.uTime = timeU; shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${swarmGLSL(b.pivots, true)}`).replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec3 _dn = normal; vec3 _cp = position; crowdAnimate(_cp, _dn); transformed = _cp; }'); };
  dep.customProgramCacheKey = () => 'crawlerSwarmDepth';
  const swarm = createInstanceSet(capacity, geo, mat, SWARM_STATES, { timeUniform: timeU, extra: ['leapDist'], castShadow: opts.shadows ?? Q.shadows, name: 'crawlerSwarm' });
  swarm.mesh.customDepthMaterial = dep; swarm.triCount = geo.userData.tris;
  return swarm;
}
