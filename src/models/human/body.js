// Body skin geometry: lofted torso / limbs / hands / feet, anatomical bumps, skin weights.
import * as THREE from 'three';
import { Q } from '../../engine/common.js';
import { V, ringLoft, rseg, table, smooth, mixn, makeChain, applySkin, mergeAll, blob, rigid } from './kit.js';
import { uvRect } from './uvmap.js';
import { FINGERS } from './rig.js';

// ---------------- torso table: [y/H, rx, rz, cz, pw]  (reference H=1.75) ----------------
const TM = [
  [0.470, 0.128, 0.086, -0.006, 2.2], [0.500, 0.158, 0.108, -0.008, 2.2], [0.535, 0.162, 0.111, -0.004, 2.2], [0.570, 0.151, 0.104, 0.000, 2.15],
  [0.605, 0.140, 0.097, 0.004, 2.1], [0.640, 0.142, 0.099, 0.008, 2.1], [0.680, 0.153, 0.107, 0.012, 2.2], [0.720, 0.166, 0.114, 0.015, 2.35],
  [0.755, 0.172, 0.111, 0.012, 2.45], [0.790, 0.176, 0.097, 0.002, 2.6], [0.810, 0.172, 0.088, -0.004, 2.6], [0.830, 0.142, 0.081, -0.008, 2.4],
  [0.845, 0.104, 0.073, -0.010, 2.2], [0.855, 0.075, 0.066, -0.010, 2.1], [0.862, 0.059, 0.059, -0.008, 2.0],
];
const TF = [
  [0.470, 0.128, 0.088, -0.006, 2.2], [0.500, 0.158, 0.110, -0.008, 2.2], [0.535, 0.158, 0.108, -0.004, 2.2], [0.570, 0.140, 0.097, 0.000, 2.1],
  [0.605, 0.121, 0.087, 0.004, 2.05], [0.640, 0.124, 0.090, 0.008, 2.05], [0.680, 0.133, 0.098, 0.010, 2.1], [0.720, 0.141, 0.105, 0.012, 2.2],
  [0.755, 0.146, 0.099, 0.010, 2.3], [0.790, 0.150, 0.087, 0.002, 2.4], [0.810, 0.150, 0.080, -0.004, 2.4], [0.830, 0.124, 0.075, -0.008, 2.3],
  [0.845, 0.092, 0.068, -0.010, 2.15], [0.855, 0.066, 0.061, -0.010, 2.05], [0.862, 0.050, 0.052, -0.008, 2.0],
];

/** torso rows (resampled), scaled for the profile. offset = shell thickness (m). Returns [{c,rx,rz,pw,y}] bottom→top */
export function torsoStations(P, L, { off = 0, n = 24, y0 = 0.47, y1 = 0.862, flare = null } = {}) {
  const { H } = L.dims, b = P.build, F = P.isFemale;
  const sc = Math.pow(H / 1.75, 0.82) * (1 - P.youth * 0.12);
  const base = F ? TF : TM;
  const hip = b.hip * (1 + b.limbFat * 0.1), waist = b.waist * (1 + b.limbFat * 0.1), chest = b.chest, sh = b.shoulder;
  const fx = [[0.47, hip], [0.535, hip], [0.575, mixn(hip, waist, 0.6)], [0.61, waist], [0.65, waist], [0.69, mixn(waist, chest, 0.5)], [0.72, chest], [0.76, chest], [0.80, mixn(chest, sh, 0.6)], [0.82, sh], [0.84, 1 + (sh - 1) * 0.4], [0.86, 1]];
  const rows = [];
  const sec = (yf) => {
    const t = table(base, yf), k = table(fx, yf)[0];
    const musc = b.muscle * (smooth(0.66, 0.73, yf) * (1 - smooth(0.80, 0.84, yf)));
    const waistNarrow = b.muscle * 0.04 * Math.exp(-Math.pow((yf - 0.61) / 0.04, 2));
    const rx = t[0] * sc * k * (1 + 0.07 * musc - waistNarrow);
    const rz = t[1] * sc * (1 + (k - 1) * 0.55) * (1 + 0.07 * musc) * (P.youth ? 1 + P.youth * 0.15 : 1);
    return { rx, rz, cz: t[2] * sc, pw: t[3] };
  };
  for (let i = 0; i < n; i++) {
    const yf = y0 + (y1 - y0) * (i / (n - 1));
    const s = sec(yf);
    const y = yf * H;
    // flare near the top (neck/collars) handled by caller via `flare`
    rows.push({ c: V(0, y, s.cz), rx: s.rx + off, rz: s.rz + off, pw: s.pw, y, yf });
  }
  return rows;
}

// ---------------- Limb: polyline + radius table ----------------
export class Limb {
  constructor(pts, tab) { this.pts = pts; this.tab = tab; }
  pos(u) { const n = this.pts.length - 1; u = Math.max(0, Math.min(n, u)); const i = Math.min(n - 1, Math.floor(u)); return this.pts[i].clone().lerp(this.pts[i + 1], u - i); }
  tan(u) { const n = this.pts.length - 1; const i = Math.max(0, Math.min(n - 1, Math.floor(u))); return this.pts[i + 1].clone().sub(this.pts[i]).normalize(); }
  at(u) { const r = table(this.tab, u); const c = this.pos(u); c.z += r[2] || 0; c.x += r[3] || 0; return { c, rx: r[0], rz: r[1] }; }
  /** n stations from u0..u1; off = thickness; fn(u,st) may tweak */
  stations(u0, u1, n, { off = 0, kx = 1, kz = 1, fn = null, pw = 2 } = {}) {
    const out = [];
    for (let i = 0; i < n; i++) { const u = u0 + (u1 - u0) * (i / (n - 1)); const s = this.at(u); const st = { c: s.c, rx: s.rx * kx + off, rz: s.rz * kz + off, pw, u }; if (fn) fn(u, st); out.push(st); }
    return out;
  }
}

function scaleTab(tab, k, fatK, musc, muscCols) {
  return tab.map((r) => { const u = r[0]; let m = k * (1 + fatK); for (const [a, b2, amt] of muscCols) m *= 1 + musc * amt * smooth(a - 0.25, a, u) * (1 - smooth(b2, b2 + 0.25, u)); return [u, r[1] * m, r[2] * m, (r[3] || 0) * k, (r[4] || 0) * k]; });
}
const ARM_TAB = [[0, .046, .050, 0, 0], [1, .056, .062, 0, 0], [1.35, .052, .060, 0, 0], [1.6, .046, .052, 0.002, 0], [1.9, .041, .044, 0, 0], [2.0, .0385, .0415, 0, 0], [2.2, .040, .042, 0.001, 0], [2.35, .042, .040, 0, 0], [2.7, .0335, .030, 0, 0], [2.95, .0265, .0235, 0, 0], [3.0, .0258, .0220, 0, 0]];
const LEG_TAB = [[0, .084, .092, 0, 0], [1, .080, .092, 0, 0], [1.25, .076, .086, 0.002, 0], [1.55, .069, .076, 0.006, 0], [1.85, .056, .060, 0.004, 0], [2.0, .050, .054, 0, 0], [2.2, .052, .056, -0.003, 0], [2.35, .052, .060, -0.009, 0], [2.7, .040, .043, -0.004, 0], [2.92, .0300, .0320, 0, 0], [3.0, .0290, .0305, 0, 0]];

export function makeLimbs(P, L) {
  const { J, dims } = L, b = P.build, F = P.isFemale;
  const k = Math.pow(dims.H / 1.75, 0.9) * (1 - P.youth * 0.1);
  const limbs = {};
  const armK = k * (F ? 0.9 : 1), legK = k * (F ? 0.94 : 1);
  const fatK = b.limbFat * 0.34 + b.belly * 0.06;
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    const sh = J['upperArm' + S], el = J['foreArm' + S], wr = J['hand' + S];
    const P0 = V(sh.x - s * 0.045 * k, sh.y - 0.01, sh.z);
    const tabA = scaleTab(ARM_TAB, armK, fatK, b.muscle, [[1.6, 1.9, 0.2], [2.35, 2.5, 0.1]]);
    for (const r of tabA) r[3] = r[3] * s;
    limbs['arm' + S] = new Limb([P0, sh, el, wr], tabA);
    const hp = J['upperLeg' + S], kn = J['lowerLeg' + S], an = J['foot' + S];
    const Q0 = V(hp.x - s * 0.012, hp.y + 0.075 * k, hp.z);
    const tabL = scaleTab(LEG_TAB, legK, fatK * 1.15 + (F ? 0.04 : 0), b.muscle, [[1.5, 1.9, 0.18], [2.35, 2.55, 0.14]]);
    limbs['leg' + S] = new Limb([Q0, hp, kn, an], tabL);
  }
  return limbs;
}

// ---------------- anatomical bumps (Gaussian displacements along the normal) ----------------
export function makeBumps(P, L) {
  const { H } = L.dims, b = P.build, F = P.isFemale, sc = H / 1.75, m = b.muscle, f = b.limbFat;
  const y = (yf) => yf * H;
  const out = [];
  const mir = (c, s, a, o = {}) => { out.push({ c: V(c[0], c[1], c[2]), s, a, ...o }); if (c[0] !== 0) out.push({ c: V(-c[0], c[1], c[2]), s, a, ...o }); };
  const ts = torsoStations(P, L, { n: 3, y0: 0.72, y1: 0.72 });
  const frontZ = ts[0].c.z + ts[0].rz;
  if (F) {
    const bust = b.bust * (1 + (b.chest - 1) * 0.5 + f * 0.3);
    mir([0.077 * sc, y(0.718), frontZ - 0.02 * sc], 0.052 * sc, 0.032 * bust * sc);
    mir([0.066 * sc, y(0.728), frontZ - 0.012 * sc], 0.036 * sc, 0.008 * bust * sc);
  } else {
    mir([0.082 * sc * b.chest ** 0.5, y(0.742), frontZ - 0.012 * sc], 0.050 * sc, (0.006 + 0.03 * m + 0.01 * f) * sc);
    // abs
    if (m > 0.4) { mir([0.032 * sc, y(0.64), frontZ + 0.004], 0.03 * sc, 0.006 * m * sc, { mode: 'front' }); mir([0.034 * sc, y(0.60), frontZ + 0.004], 0.03 * sc, 0.005 * m * sc, { mode: 'front' }); }
  }
  // lats / traps / lower back
  mir([0.145 * sc, y(0.70), -0.045 * sc], 0.075 * sc, (0.006 + 0.016 * m) * sc);
  mir([0.07 * sc, y(0.836), -0.028 * sc], 0.05 * sc, (0.004 + 0.013 * m + (b.neck - 1) * 0.01) * sc);
  // glutes
  mir([0.082 * sc, y(0.495), -0.098 * sc], 0.078 * sc, (0.014 + 0.013 * f + 0.014 * m + (F ? 0.014 : 0)) * sc);
  // belly & love handles
  if (b.belly > 0.01 || f > 0.4) {
    const bel = b.belly + Math.max(0, f - 0.4) * 0.4;
    out.push({ c: V(0, y(0.585), 0.105 * sc), s: 0.13 * sc, a: 0.085 * bel * sc });
    mir([0.17 * sc * b.waist ** 0.5, y(0.575), 0.0], 0.075 * sc, 0.034 * bel * sc);
    out.push({ c: V(0, y(0.52), 0.095 * sc), s: 0.1 * sc, a: 0.03 * bel * sc });
  }
  return out;
}
const _p = new THREE.Vector3();
export function applyBumps(g, bumps, k = 1, { region = null } = {}) {
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let d = 0;
    for (const bp of bumps) {
      const dx = x - bp.c.x, dy = y - bp.c.y, dz = z - bp.c.z; const r2 = dx * dx + dy * dy + dz * dz; const s2 = bp.s * bp.s;
      if (r2 > s2 * 9) continue;
      d += bp.a * k * Math.exp(-r2 / (2 * s2));
    }
    if (d !== 0) p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  p.needsUpdate = true; g.computeVertexNormals(); return g;
}

// ---------------- hands ----------------
export const HAND_FLEN = { thumb: [0.28, 0.17, 0.14], index: [0.215, 0.125, 0.105], middle: [0.235, 0.14, 0.115], ring: [0.22, 0.135, 0.11], pinky: [0.17, 0.1, 0.09] };
export function buildHand(P, L, S, bi, { glove = 0 } = {}) {
  const { J, dims } = L, s = S === 'L' ? 1 : -1, F = P.isFemale;
  const hl = dims.handL, wr = J['hand' + S];
  const hd = J['_handDir' + S];
  const parts = [];
  const radial = rseg(12, 8);
  const tk = hl * 1.0;
  // palm
  const palmLen = hl * 0.5;
  const pst = [
    { c: wr.clone().addScaledVector(hd, -0.012), rx: hl * 0.067 + glove, rz: hl * 0.158 + glove },
    { c: wr.clone().addScaledVector(hd, palmLen * 0.18), rx: hl * 0.074 + glove, rz: hl * 0.182 + glove },
    { c: wr.clone().addScaledVector(hd, palmLen * 0.55), rx: hl * 0.085 + glove, rz: hl * 0.205 + glove },
    { c: wr.clone().addScaledVector(hd, palmLen * 0.9), rx: hl * 0.075 + glove, rz: hl * 0.213 + glove },
    { c: wr.clone().addScaledVector(hd, palmLen * 1.02), rx: hl * 0.062 + glove, rz: hl * 0.205 + glove },
  ];
  const palm = ringLoft(pst, { radial, capEnd: hl * 0.035, uv: uvRect('hand' + S, true, { fx: 0, fy: 0, fw: 1, fh: 0.4 }), ref: [0, 0, 1], pw: 2.3 });
  applySkin(palm, rigid(bi, 'hand' + S));
  parts.push(palm);
  // thenar pad
  const th1 = J['thumb' + S + '1'];
  const pad = blob([th1.x - s * hl * 0.02, th1.y - hl * 0.045, th1.z - hl * 0.01], hl * 0.085, hl * 0.14, hl * 0.09, { w: 10, h: 8, uv: uvRect('hand' + S, true, { fx: 0, fy: 0, fw: 1, fh: 0.4 }), rot: [0.15, 0, 0] });
  applySkin(pad, rigid(bi, 'hand' + S)); parts.push(pad);
  const fingerUV = uvRect('hand' + S, true, { fx: 0, fy: 0.4, fw: 1, fh: 0.6 });
  for (const fn of FINGERS) {
    const j1 = J[`${fn}${S}1`], j2 = J[`${fn}${S}2`], j3 = J[`${fn}${S}3`], tip = J[`${fn}${S}tip`];
    const dir = j2.clone().sub(j1).normalize();
    const w0 = fn === 'thumb' ? 0.0105 : fn === 'pinky' ? 0.0078 : 0.0092;
    const fr = (fn === 'thumb' ? 1.1 : fn === 'pinky' ? 0.85 : 1) * (hl / 0.19) * (F ? 0.9 : 1) * (1 + P.build.limbFat * 0.12);
    const r = w0 * fr + glove * 0.6;
    const pts = [
      [j1.clone().addScaledVector(dir, -0.012), 1.0],
      [j1.clone(), 1.04], [j1.clone().lerp(j2, 0.5), 0.94], [j2.clone(), 0.98], [j2.clone().lerp(j3, 0.5), 0.9], [j3.clone(), 0.9], [tip.clone().addScaledVector(j3.clone().sub(tip).normalize(), 0.0), 0.82],
    ];
    const st = pts.map(([c, k], i) => ({ c, rx: r * k * (fn === 'thumb' ? 1.0 : 1.0), rz: r * k * 0.93, pw: 2.2 }));
    const g = ringLoft(st, { radial: rseg(8, 6), capEnd: r * 0.9, uv: fingerUV, ref: [0, 0, 1] });
    // chain: hand | f1 | f2 | f3
    const ch = makeChain(bi, ['hand' + S, `${fn}${S}1`, `${fn}${S}2`, `${fn}${S}3`], [j1, j2, j3], [0.007, 0.0065, 0.006]);
    applySkin(g, ch);
    parts.push(g);
  }
  return parts;
}

// ---------------- foot ----------------
export function buildFoot(P, L, S, bi) {
  const { J, dims } = L, s = S === 'L' ? 1 : -1, F = P.isFemale;
  const an = J['foot' + S], toes = J['toes' + S];
  const fl = dims.footLen, sc = fl / 0.266;
  const hz = an.z - 0.062 * sc; // heel back z
  const px = an.x;
  const stx = [
    [-0.058, 0.022, 0.027, 0.034], [-0.040, 0.029, 0.034, 0.039], [-0.012, 0.031, 0.036, 0.045], [0.02, 0.031, 0.0355, 0.040], [0.06, 0.036, 0.029, 0.032],
    [0.10, 0.043, 0.024, 0.025], [0.14, 0.047, 0.0205, 0.0205], [0.18, 0.043, 0.0165, 0.0165], [0.205, 0.032, 0.0125, 0.0125],
  ];
  const st = stx.map(([z, rx, rz, cy]) => ({ c: V(px + s * 0.0 + (z > 0.1 ? s * -0.0 : 0), cy * sc, an.z + z * sc), rx: rx * sc * (F ? 0.93 : 1), rz: rz * sc, pw: 2.4 }));
  const g = ringLoft(st, { radial: rseg(12, 8), capStart: 0.02 * sc, capEnd: 0.016 * sc, ref: [0, 1, 0], uv: uvRect('foot' + S, true) });
  const ch = makeChain(bi, ['foot' + S, 'toes' + S], [toes], [0.018], [V(0, 0, 1)]);
  applySkin(g, ch);
  return g;
}

// ---------------- full skin ----------------
export function buildBodySkin(P, L, rig, { hands = true, feet = true, glove = 0 } = {}) {
  const bi = rig.index, { J, dims } = L;
  const parts = [];
  // torso
  const rows = torsoStations(P, L, { n: 26 });
  const radial = rseg(26, 12);
  const torso = ringLoft(rows, { radial, capStart: 0.045, uv: uvRect('torso', false), ref: [0, 0, 1], closeEnd: true });
  const bumps = makeBumps(P, L);
  applyBumps(torso, bumps, 1);
  const midHS = (a, b) => V(0, (J[a].y + J[b].y) / 2, 0);
  const torsoChain = makeChain(bi, ['hips', 'spine', 'chest'], [midHS('hips', 'spine').setY(J.hips.y + (J.spine.y - J.hips.y) * 0.8), midHS('spine', 'chest')], [0.05, 0.07]);
  applySkin(torso, torsoChain);
  parts.push(torso);
  const limbs = makeLimbs(P, L);
  for (const S of ['L', 'R']) {
    const arm = limbs['arm' + S];
    const ag = ringLoft(arm.stations(0, 3, 17), { radial: rseg(14, 8), capEnd: 0.0, uv: uvRect('arm' + S), ref: [0, 0, 1], closeStart: true });
    applySkin(ag, makeChain(bi, ['clavicle' + S, 'upperArm' + S, 'foreArm' + S, 'hand' + S], [J['upperArm' + S], J['foreArm' + S], J['hand' + S]], [0.05, 0.035, 0.022]));
    parts.push(ag);
    const leg = limbs['leg' + S];
    const lg = ringLoft(leg.stations(0, 3, 19), { radial: rseg(16, 8), uv: uvRect('leg' + S), ref: [0, 0, 1], closeStart: true });
    applySkin(lg, makeChain(bi, ['hips', 'upperLeg' + S, 'lowerLeg' + S, 'foot' + S], [J['upperLeg' + S], J['lowerLeg' + S], J['foot' + S]], [0.05, 0.04, 0.022]));
    parts.push(lg);
    if (hands) parts.push(...buildHand(P, L, S, bi, { glove }));
    if (feet) parts.push(buildFoot(P, L, S, bi));
  }
  // light bump pass on limbs (glutes/thighs are covered by torso bumps; limbs have table profiles)
  const geo = mergeAll(parts);
  geo.userData.limbs = limbs; geo.userData.bumps = bumps;
  return { geometry: geo, limbs, bumps };
}
