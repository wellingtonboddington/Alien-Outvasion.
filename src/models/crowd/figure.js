// Parametric low-poly humanoid body builder (rest pose: standing, arms/legs hanging straight, facing +Z, left = +X).
import { J, SLOT, LAYER, gate } from './rig.js';
import { loft, box, cyl, ellipsoid, xf, warp, mirrorX } from './build.js';

const DM = (o, d) => ({ ...d, ...(o || {}) });
const mat = (slot, layer, color = 0xffffff, shade = 1) => ({ slot, layer, color, shade });

/** map head front -> face layer uv (u from x, v from y), back vertices -> plain skin corner */
export function faceUV(g, headY, o = {}) {
  const FW = o.fw ?? 0.2, FH = o.fh ?? 0.26, yEye = headY + (o.eyeDY ?? 0.012);
  const p = g.p, uv = g.uv;
  for (let i = 0; i < p.length / 3; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    let u = 0.5 + x / FW, v = 0.5 - (y - yEye) / FH;
    const back = Math.max(0, Math.min(1, (0.0 - z) / 0.03));
    u = Math.max(0.03, Math.min(0.97, u)); v = Math.max(0.03, Math.min(0.97, v));
    uv[i * 2] = u * (1 - back) + 0.03 * back; uv[i * 2 + 1] = v * (1 - back) + 0.03 * back;
  }
  return g;
}

/** Generic body. m = material table {torso, pelvis, upperArm, foreArm, hand, thigh, shin, foot, head, neck}, s = shape spec */
export function bodyParts(M, L, s, m) {
  const R = s.R ?? 6, TR = s.TR ?? 8, k = s.k ?? 1, kx = s.kx ?? k, kz = s.kz ?? k;
  const sh = s.shoulderX, hx = s.hipX;
  const T = DM(s.torso, { hipRx: 0.165, hipRz: 0.108, waistRx: 0.152, waistRz: 0.104, chestRx: 0.19, chestRz: 0.125, shRx: 0.205, shRz: 0.112, neckR: 0.07, chestCz: 0.01, power: 2.5 });
  // ---- pelvis
  const pelv = loft([
    { y: L.hipY - 0.1, rx: T.hipRx * 0.86 * kx, rz: T.hipRz * 0.95 * kz },
    { y: L.hipY - 0.02, rx: T.hipRx * kx, rz: T.hipRz * kz },
    { y: L.hipY + 0.035, rx: T.hipRx * 0.96 * kx, rz: T.hipRz * 0.97 * kz },
  ], { R: TR, k: T.power, capBottom: true });
  M.add(pelv, { j: J.ROOT_ROT, ...m.pelvis, name: 'pelvis' });
  // ---- chest
  const rib = { rx: (T.waistRx + T.chestRx) * 0.5 * 1.03, rz: (T.waistRz + T.chestRz) * 0.5 * 1.04 };
  const chest = loft([
    { y: L.hipY - 0.045, rx: (T.hipRx + 0.006) * 0.99 * kx, rz: (T.hipRz + 0.008) * kz },
    { y: L.waistY, rx: T.waistRx * kx, rz: T.waistRz * kz },
    { y: L.waistY + (L.chestY - L.waistY) * 0.5, rx: rib.rx * kx, rz: rib.rz * kz, cz: T.chestCz * 0.4 },
    { y: L.chestY, rx: T.chestRx * kx, rz: T.chestRz * kz, cz: T.chestCz },
    { y: L.shoulderY - 0.025, rx: T.shRx * kx, rz: T.shRz * kz },
    { y: L.neckY - 0.012, rx: T.neckR * kx, rz: T.neckR * 0.95 * kz },
  ], { R: TR, k: T.power });
  M.add(chest, { j: J.SPINE, ...m.torso, name: 'chest' });
  // ---- neck + head
  const nr = s.neckR ?? 0.047;
  const neck = xf(cyl(nr * 0.95 * kx, nr * kx, 0.1, 6), { pos: [0, L.neckY - 0.035, 0] });
  M.add(neck, { j: J.HEAD, ...m.neck, name: 'neck' });
  const H = DM(s.head, { rx: 0.082, rz: 0.097, scale: 1.12, jawW: 0.066, chinW: 0.042 });
  const hs = H.scale, hy = L.headY;
  const head = loft([
    { y: -0.118 * hs, rx: H.chinW * hs, rz: 0.062 * hs, cz: 0.04 * hs },
    { y: -0.066 * hs, rx: H.jawW * 1.1 * hs, rz: 0.09 * hs, cz: 0.014 * hs },
    { y: 0.03 * hs, rx: H.rx * hs, rz: H.rz * hs, cz: 0.004 * hs },
    { y: 0.092 * hs, rx: H.rx * 0.78 * hs, rz: H.rz * 0.86 * hs, cz: -0.008 * hs },
    { y: 0.128 * hs, rx: 0, rz: 0, cz: -0.012 * hs },
  ], { R: TR, k: 2.3 });
  xf(head, { pos: [0, hy, 0] }); faceUV(head, hy);
  M.add(head, { j: J.HEAD, ...m.head, name: 'head' });
  if (s.nose !== false) { // little nose wedge (3 tris)
    const nz = H.rz * hs + 0.004;
    const nose = loft([{ y: 0, rx: 0.014 * hs, rz: 0.016 * hs }, { y: 0.034 * hs, rx: 0, rz: 0 }], { R: 3, rot0: Math.PI / 2 });
    xf(nose, { pos: [0, hy - 0.026 * hs, nz - 0.01], rot: [Math.PI / 2 - 0.5, 0, 0] });
    for (let i = 0; i < nose.uv.length; i += 2) { nose.uv[i] = 0.5; nose.uv[i + 1] = 0.45; }
    M.add(nose, { j: J.HEAD, ...m.head, name: 'nose' });
  }
  for (const sgn of [-1, 1]) { // ears (single quads)
    const ex = sgn * (H.rx * hs + 0.003);
    const ear = { p: [ex, hy - 0.03 * hs, -0.03 * hs, ex + sgn * 0.016, hy - 0.012 * hs, 0.0, ex + sgn * 0.016, hy + 0.028 * hs, 0.0, ex, hy + 0.02 * hs, -0.03 * hs], n: [sgn, 0, 0, sgn, 0, 0, sgn, 0, 0, sgn, 0, 0], uv: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03], i: sgn > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3] };
    M.add(ear, { j: J.HEAD, ...m.head, name: 'ear' });
  }
  // ---- arms / legs (left built, right mirrored)
  const A = DM(s.arm, { r0: 0.048, r1: 0.04, fr0: 0.04, fr1: 0.031, bulge: 0, fbulge: 0 });
  const Lg = DM(s.leg, { t0: 0.086, t1: 0.058, s0: 0.056, s1: 0.04, mid: 0.07, calf: 0.1 });
  const eY = L.shoulderY - L.armU, wY = eY - L.armF;
  const upper = [
    { y: eY, rx: A.r1 * kx, rz: A.r1 * 0.95 * kz },
    ...(A.bulge ? [{ y: eY + L.armU * 0.62, rx: (A.r0 + A.r1) * 0.5 * (1 + A.bulge) * kx, rz: (A.r0 + A.r1) * 0.5 * (1 + A.bulge) * 0.95 * kz }] : []),
    { y: L.shoulderY - 0.005, rx: A.r0 * kx, rz: A.r0 * 0.95 * kz },
    { y: L.shoulderY + 0.8 * A.r0, rx: 0, rz: 0 },
  ];
  const fore = [
    { y: wY, rx: A.fr1 * kx, rz: A.fr1 * 0.95 * kz },
    ...(A.fbulge ? [{ y: wY + L.armF * 0.7, rx: A.fr0 * (1 + A.fbulge) * kx, rz: A.fr0 * (1 + A.fbulge) * 0.95 * kz }] : []),
    { y: eY, rx: A.fr0 * kx, rz: A.fr0 * 0.95 * kz },
    { y: eY + 0.8 * A.fr0, rx: 0, rz: 0 },
  ];
  const kY = L.kneeY;
  const thigh = [
    { y: kY, rx: Lg.t1 * kx, rz: Lg.t1 * kz },
    ...(Lg.mid ? [{ y: kY + L.thigh * 0.45, rx: (Lg.t0 + Lg.t1) * 0.5 * (1 + Lg.mid) * kx, rz: (Lg.t0 + Lg.t1) * 0.5 * (1 + Lg.mid) * kz }] : []),
    { y: L.hipY, rx: Lg.t0 * kx, rz: Lg.t0 * kz },
    { y: L.hipY + 0.8 * Lg.t0, rx: 0, rz: 0 },
  ];
  const shin = [
    { y: L.ankleY, rx: Lg.s1 * kx, rz: Lg.s1 * kz },
    ...(Lg.calf ? [{ y: L.ankleY + L.shin * 0.62, rx: Lg.s0 * (1 + Lg.calf) * kx, rz: Lg.s0 * (1 + Lg.calf) * kz, cz: -0.012 }] : []),
    { y: kY, rx: Lg.s0 * kx, rz: Lg.s0 * kz },
    { y: kY + 0.8 * Lg.s0, rx: 0, rz: 0 },
  ];
  const side = (sgn) => {
    const sx = sgn * sh, lx = sgn * hx;
    const put = (g, x, joint, mm, name) => { xf(g, { pos: [x, 0, 0] }); M.add(g, { j: joint, ...mm, name }); };
    put(loft(upper, { R, rot0: 0, k: 2 }), sx, sgn > 0 ? J.ARM_L : J.ARM_R, m.upperArm, 'upperArm');
    put(loft(fore, { R, rot0: 0, k: 2 }), sx, sgn > 0 ? J.FORE_L : J.FORE_R, m.foreArm, 'foreArm');
    if (s.hand !== false) {
      const hd = s.handSize ?? 1;
      const hand = box(0.074 * hd * kx, 0.092 * hd, 0.036 * hd * kz, { taperBottom: [0.8, 0.9] });
      xf(hand, { pos: [sx, wY - 0.045 * hd, 0.004] });
      M.add(hand, { j: sgn > 0 ? J.FORE_L : J.FORE_R, ...m.hand, name: 'hand' });
    }
    put(loft(thigh, { R, rot0: 0, k: 2 }), lx, sgn > 0 ? J.LEG_L : J.LEG_R, m.thigh, 'thigh');
    put(loft(shin, { R, rot0: 0, k: 2 }), lx, sgn > 0 ? J.SHIN_L : J.SHIN_R, m.shin, 'shin');
    const fw = s.footW ?? 0.092, fl = s.footL ?? 0.25, fh = s.footH ?? (L.ankleY + 0.035);
    const foot = box(fw * kx, fh, fl, { taperTop: [0.9, 0.82], taperBottom: [1, 1] });
    warp(foot, (x, y, z) => { const t = Math.max(0, Math.min(1, (z / fl) + 0.5)); const nx = x * (1 - 0.16 * t); if (y > 0) { const top = fh * (1 - 0.6 * t * t * (3 - 2 * t)); return [nx, top - fh / 2, z]; } return [nx, y, z]; }, true);
    xf(foot, { pos: [lx, fh / 2 - 0.002, fl / 2 - 0.085] });
    M.add(foot, { j: sgn > 0 ? J.FOOT_L : J.FOOT_R, ...m.foot, name: 'foot' });
  };
  side(1); side(-1);
}

/** simple darkening heuristics baked into vertex colours (rest pose) */
export function bakeBodyAO(M, L) {
  M.bakeAO((x, y, z, nx, ny, nz, joint) => {
    let a = 0.62 + 0.38 * Math.min(1, Math.max(0, (ny + 0.9) / 1.1));
    // inner legs / between limbs
    const ax = Math.abs(x);
    if (y < L.hipY && ax < 0.16 && nx * Math.sign(x || 1) < -0.35) a *= 0.72;
    if (y > L.waistY - 0.2 && y < L.shoulderY && ax > 0.17 && nx * Math.sign(x || 1) < -0.4) a *= 0.7; // under/inside arms
    if (y < 0.3) a *= 0.72 + 0.28 * (y / 0.3); // grime near ground
    if (y > L.shoulderY - 0.02 && y < L.neckY + 0.04 && ax < 0.1 && ny < 0.3) a *= 0.8; // collar shade
    return a;
  });
}

/** short hair cap (hairline higher at the front). style: 'short' | 'buzz' */
export function hairCap(L, { s = 1, thick = 0.012, front = 0.062, back = -0.045, ring = 3, color } = {}) {
  const hy = L.headY;
  const g = loft([
    { y: back * s, rx: 0.085 * s + thick, rz: 0.1 * s + thick, cz: -0.004 * s },
    { y: 0.04 * s, rx: 0.087 * s + thick, rz: 0.1 * s + thick, cz: -0.004 * s },
    { y: 0.088 * s, rx: 0.073 * s + thick, rz: 0.088 * s + thick, cz: -0.008 * s },
    { y: 0.121 * s + thick, rx: 0.036 * s, rz: 0.05 * s, cz: -0.012 * s },
    { y: 0.133 * s + thick, rx: 0, rz: 0, cz: -0.012 * s },
  ], { R: 8, k: 2.3 });
  warp(g, (x, y, z) => { const lift = Math.max(0, Math.min(1, z / 0.09)); const tgt = front * s; if (y < tgt && lift > 0) return [x, y + (tgt - y) * lift * lift * (3 - 2 * lift), z]; return null; });
  xf(g, { pos: [0, hy, 0] });
  // hair uv: plain strands
  for (let i = 0; i < g.uv.length; i += 2) { g.uv[i] = g.p[i / 2 * 3] * 3 + 0.5; g.uv[i + 1] = g.p[i / 2 * 3 + 1] * 3; }
  return g;
}
/** long hair behind the head down to the shoulders */
export function hairLong(L, { s = 1, len = 0.3, width = 0.1 } = {}) {
  const hy = L.headY;
  const g = loft([
    { y: hy - len, rx: width * 0.85, rz: 0.03, cz: -0.115 * s },
    { y: hy - len * 0.55, rx: width * 1.0, rz: 0.04, cz: -0.115 * s },
    { y: hy - 0.02, rx: 0.088 * s, rz: 0.04, cz: -0.095 * s },
    { y: hy + 0.06 * s, rx: 0.085 * s, rz: 0.05, cz: -0.09 * s },
  ], { R: 6, k: 2 });
  for (let i = 0; i < g.uv.length; i += 2) { g.uv[i] = g.p[i / 2 * 3] * 3 + 0.5; g.uv[i + 1] = g.p[i / 2 * 3 + 1] * 3; }
  return g;
}
export { mat };
