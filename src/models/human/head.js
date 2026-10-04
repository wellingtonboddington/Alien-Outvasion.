// Head geometry: sculpted cylindrical grid with eye/mouth slits (real lids + lips), mouth interior sheets, procedural morph targets.
// Nominal head space: metres, origin at the head bone pivot (ear level), +Y up, +Z forward, +X = character's left. Nominal height chin→crown = 0.23.
import * as THREE from 'three';
import { Q } from '../../engine/common.js';
import { table, smooth, mixn } from './kit.js';

// ---- profile tables: y -> [A halfwidth, Df front depth, Db back depth, zw widest-point z, n exponent, kV taper] ----
const HT = [
  [-0.205, 0.078, 0.040, 0.092, -0.026, 2.0, 0], [-0.190, 0.064, 0.032, 0.080, -0.022, 2.0, 0], [-0.172, 0.0555, 0.030, 0.0720, -0.020, 2.0, 0],
  [-0.152, 0.0510, 0.030, 0.0690, -0.019, 2.0, 0], [-0.136, 0.0500, 0.031, 0.0680, -0.018, 2.0, 0], [-0.124, 0.0525, 0.040, 0.0700, -0.016, 2.05, 0.20],
  [-0.116, 0.0555, 0.066, 0.0700, -0.010, 2.1, 0.42], [-0.109, 0.0560, 0.0850, 0.0700, -0.004, 2.2, 0.55], [-0.1035, 0.0570, 0.0910, 0.0690, 0, 2.3, 0.60],
  [-0.098, 0.0575, 0.0950, 0.0670, 0, 2.35, 0.62], [-0.0925, 0.0578, 0.0975, 0.0655, 0, 2.4, 0.60], [-0.087, 0.0582, 0.0965, 0.0650, 0, 2.4, 0.55],
  [-0.075, 0.0585, 0.0955, 0.0640, 0, 2.5, 0.40], [-0.060, 0.0620, 0.0965, 0.0640, 0, 2.5, 0.25], [-0.040, 0.0675, 0.0975, 0.0660, 0, 2.45, 0.12],
  [-0.020, 0.0715, 0.0975, 0.0785, 0, 2.4, 0.06], [0.000, 0.0745, 0.0935, 0.0865, 0, 2.35, 0.03], [0.020, 0.0765, 0.0975, 0.0905, 0, 2.3, 0],
  [0.030, 0.0772, 0.1000, 0.0925, 0, 2.25, 0],
];
const CRANIUM_Y0 = 0.030, CROWN = 0.1150;
function profile(y) {
  if (y >= CRANIUM_Y0) {
    const t = Math.min(0.999, (y - CRANIUM_Y0) / (CROWN - CRANIUM_Y0 + 0.0005));
    const kA = Math.pow(Math.max(0, 1 - Math.pow(t, 2.3)), 1 / 2.3), kF = Math.pow(Math.max(0, 1 - Math.pow(t, 2.7)), 1 / 2.7), kB = Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 1 / 2.4);
    return [0.0772 * kA, 0.1000 * kF, 0.0925 * kB, 0.0, 2.25 - 0.1 * t, 0];
  }
  return table(HT, y);
}
export const headProfile = profile;
const sgnpow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const gauss2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

// columns (ellipse parameter, degrees, ascending from -180 .. 180)
function genCols(lod) {
  const k = lod ? 1.6 : 1;
  const pos = [0];
  let a = 0;
  while (a < 180) { const step = (a < 50 ? 2.5 : a < 90 ? 4 : a < 135 ? 7 : 10) * k; a = Math.min(180, a + step); if (180 - a < step * 0.4 && a < 180) a = 180; pos.push(a); }
  const full = []; for (let i = pos.length - 1; i > 0; i--) full.push(-pos[i]); for (let i = 0; i < pos.length; i++) full.push(pos[i]);
  return full.map((d) => d * Math.PI / 180);
}
function genRows(ym, ye, lod) {
  const k = lod ? 1.7 : 1.0;
  const dens = (y) => (y < -0.13 ? 0.02 : y < -0.10 ? 0.0065 : y < -0.045 ? 0.0028 : y < -0.018 ? 0.0032 : y < 0.026 ? 0.0021 : y < 0.05 ? 0.0035 : 0.0085) * (y > -0.10 && y < 0.03 ? k : (lod ? 1.3 : 1));
  const ys = []; let y = -0.205;
  while (y < CROWN - 0.004) { ys.push(y); y += dens(y); }
  ys.push(CROWN - 0.003);
  const snap = (t) => { let bi = 0, bd = 9; for (let i = 0; i < ys.length; i++) { const d = Math.abs(ys[i] - t); if (d < bd) { bd = d; bi = i; } } ys[bi] = t; return bi; };
  const jm = snap(ym), je = snap(ye);
  return { ys, jm, je };
}

/** Generic surface evaluation for the BASE head shape (no features): returns [x,z,nx,nz] for row-y and ellipse param phi */
export function baseXZ(y, phi, P, out = {}) {
  const t = profile(y); const f = P.f;
  let A = t[0], Df = t[1], Db = t[2], zw = t[3], n = t[4], kV = t[5];
  // face param modifiers
  const lowW = smooth(-0.03, -0.085, y);
  A *= f.width * mixn(1, f.jaw, lowW) * mixn(1, f.cheek ** 0.35, smooth(-0.075, -0.03, y) * (1 - smooth(0.0, 0.04, y)));
  const chinK = smooth(-0.075, -0.1, y) * (1 - smooth(-0.112, -0.13, y));
  Df += 0.006 * (f.chin - 1) * chinK;
  if (y > -0.2 && y < 0.03) Df *= 1 + 0.0 * f.forehead;
  if (y > 0.03) { Df *= 1 + (f.forehead - 1) * 0.04; }
  if (y < -0.125) { const nk = 1 + (f.neckK - 1) * smooth(-0.125, -0.15, y); A *= nk; Df = zw + (Df - zw) * nk; Db = -zw + (Db + zw) * nk; }
  const c = Math.cos(phi), s = Math.sin(phi);
  const p = 2 / n;
  const xs = sgnpow(s, p), zs = sgnpow(c, p);
  const frontK = Math.max(0, c);
  let x = A * xs * (1 - kV * Math.pow(frontK, 1.6));
  const zr = zs >= 0 ? (Df - zw) * zs : (Db + zw) * zs;
  const z = zw + zr;
  // outward normal in xz
  const gx = Math.sign(x) * Math.pow(Math.abs(x) / Math.max(A, 1e-4), n - 1) / Math.max(A, 1e-4);
  const D = zr >= 0 ? (Df - zw) : (Db + zw);
  const gz = Math.sign(zr) * Math.pow(Math.abs(zr) / Math.max(D, 1e-4), n - 1) / Math.max(D, 1e-4);
  const l = Math.hypot(gx, gz) || 1;
  out.x = x; out.z = z; out.nx = gx / l; out.nz = gz / l; out.A = A; out.Df = Df; out.Db = Db; out.zw = zw;
  return out;
}

// ---- UV mapping (head atlas): u from ellipse parameter phi, v from nominal y ----
export const headUV = {
  u: (phi) => { const a = phi * 180 / Math.PI; const aa = Math.abs(a); const u = aa <= 75 ? aa / 75 * 0.30 : 0.30 + (aa - 75) / 105 * 0.20; return 0.5 + Math.sign(a) * u; },
  v: (y) => 0.06 + 0.94 * (y < -0.12 ? (y + 0.205) / 0.085 * 0.10 : y < 0.06 ? 0.10 + (y + 0.12) / 0.18 * 0.78 : 0.88 + (y - 0.06) / 0.06 * 0.12),
  phiOfU: (u) => { const du = Math.abs(u - 0.5); const aa = du <= 0.30 ? du / 0.30 * 75 : 75 + (du - 0.30) / 0.20 * 105; return Math.sign(u - 0.5) * aa * Math.PI / 180; },
  yOfV: (v) => { const w = (v - 0.06) / 0.94; return w < 0.10 ? -0.205 + w / 0.10 * 0.085 : w < 0.88 ? -0.12 + (w - 0.10) / 0.78 * 0.18 : 0.06 + (w - 0.88) / 0.12 * 0.06; },
};
/** nominal (x,y) on the front of the face -> head UV (u,v) via the base ellipse parameter */
export function uvOfXY(H, x, y) {
  let lo = 0, hi = Math.PI * 0.95, tmp = {}; const ax = Math.abs(x);
  // x(phi) rises to a max near phi~90deg; search only the front quadrant
  hi = Math.PI / 2; for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; baseXZ(y, mid, H, tmp); if (tmp.x < ax) lo = mid; else hi = mid; }
  const phi = ((lo + hi) / 2) * Math.sign(x || 1);
  return { u: headUV.u(phi), v: headUV.v(y), phi };
}

// ---- fixed feature layout (nominal) ----
export const FEAT = { ye: 0.0045, ym: -0.0665, eyeX: 0.0315, eyeZ: 0.0738, re: 0.0125, mouthHalf: 0.0265, jawPivot: [0, -0.024, -0.016] };

/** build per-profile derived feature values */
export function headParams(P) {
  const f = P.face, F = P.isFemale, el = P.elder, yo = P.youth;
  const eyeX = FEAT.eyeX * f.eyeSpacing * (f.width ** 0.5);
  return {
    f: { ...f, neckK: Math.pow(P.build.neck, 0.8) * (F ? 0.93 : 1.0) }, F, el, yo, eyeX, ey: FEAT.ye, ez: FEAT.eyeZ - 0.0007 * (f.eyeSize - 1) * 4, re: FEAT.re * f.eyeSize * (1 + yo * 0.18),
    ym: FEAT.ym, xc: FEAT.mouthHalf * f.lipWidth, jawPivot: FEAT.jawPivot,
    skinFat: P.build.limbFat, musc: P.build.muscle,
    tilt: f.eyeTilt,
  };
}

/** displacement (outward, metres) of face features at (x, y); ax=|x| */
function features(x, y, H, P) {
  const f = H.f, F = H.F, ax = Math.abs(x);
  let d = 0;
  const noseL = f.noseLen, nw = f.noseWidth, br = f.noseBridge;
  const ytip = -0.0238 - 0.0085 * (noseL - 1) - 0.004 * f.noseUp;
  const ysub = -0.0462 - 0.002 * (noseL - 1);
  const noseH = (0.0170 + 0.0040 * (br - 0.8) + 0.002 * (noseL - 1)) * (1 - 0.1 * P.youth) * (F ? 0.94 : 1.0) + 0.0015 * f.noseTip;
  // dorsum
  const yroot = 0.009;
  if (y < yroot + 0.004 && y > ysub - 0.006) {
    let h;
    if (y >= ytip) { const t = Math.min(1, Math.max(0, (yroot - y) / (yroot - ytip))); h = noseH * Math.pow(t, 1.15) * (0.93 + 0.07 * t); }
    else { const u = Math.min(1, (ytip - y) / (ytip - ysub)); h = noseH * (1 - Math.pow(u, 0.75)); }
    const t2 = Math.min(1, Math.max(0, (yroot - y) / (yroot - ytip)));
    const sd = (0.0058 + 0.0040 * t2 * t2 * nw) * (0.92 + 0.12 * nw);
    d += h * Math.exp(-((x / sd) ** 2));
    // tip bulb
    d += 0.0036 * Math.exp(-((x / (0.0085 * nw ** 0.7)) ** 2 + ((y - ytip - 0.0014) / 0.0072) ** 2));
    // alae
    const ax0 = 0.0148 * nw;
    d += noseH * 0.42 * Math.exp(-(((ax - ax0) / (0.0062 * nw ** 0.5)) ** 2 + ((y - (ytip - 0.0105)) / 0.0072) ** 2));
    // nostril dimples
    d -= 0.0042 * Math.exp(-(((ax - 0.0100 * nw) / 0.0036) ** 2 + ((y - (ysub + 0.0052)) / 0.0030) ** 2));
    // columella / septum under tip
    d += 0.0016 * Math.exp(-((x / 0.0042) ** 2 + ((y - (ytip - 0.011)) / 0.006) ** 2));
  }
  // nasion dip
  d -= 0.0045 * Math.exp(-((x / 0.011) ** 2 + ((y - 0.011) / 0.006) ** 2));
  // brow ridge + glabella
  const brow = f.brow * (F ? 0.7 : 1.0);
  d += 0.0046 * brow * Math.exp(-(((ax - 0.0) / 0.046) ** 4 + ((y - 0.0315) / 0.0088) ** 2));
  d += 0.0028 * Math.exp(-((x / 0.011) ** 2 + ((y - 0.0265) / 0.0075) ** 2));
  // zygomatic + cheeks
  d += 0.0042 * f.cheek * Math.exp(-(((ax - 0.054) / 0.017) ** 2 + ((y + 0.012) / 0.016) ** 2));
  d += 0.0105 * (f.cheek - 1) * Math.exp(-(((ax - 0.040) / 0.024) ** 2 + ((y + 0.032) / 0.024) ** 2));
  d -= (0.0032 - 0.004 * H.skinFat - 0.003 * H.el) * Math.exp(-(((ax - 0.045) / 0.014) ** 2 + ((y + 0.052) / 0.018) ** 2));
  // temples
  d -= 0.0028 * Math.exp(-(((ax - 0.066) / 0.011) ** 2 + ((y - 0.020) / 0.012) ** 2));
  // muzzle: pushes mouth area forward a little
  d += 0.0014 * Math.exp(-((x / 0.034) ** 2 + ((y + 0.063) / 0.026) ** 2));
  // chin
  d += 0.0090 * f.chin * Math.exp(-((x / 0.014) ** 2 + ((y + 0.097) / 0.011) ** 2));
  d -= 0.0014 * Math.exp(-((x / 0.0035) ** 2 + ((y + 0.0925) / 0.006) ** 2));
  // mentolabial sulcus
  d -= 0.0030 * Math.exp(-((x / 0.017) ** 2 + ((y + 0.0825) / 0.0042) ** 2));
  // philtrum
  d -= 0.0018 * Math.exp(-((x / 0.0032) ** 2 + ((y + 0.0535) / 0.0050) ** 2));
  d += 0.0013 * Math.exp(-(((ax - 0.0075) / 0.0032) ** 2 + ((y + 0.0535) / 0.0050) ** 2));
  // nasolabial folds
  const fold = 0.0016 + 0.0030 * (H.el + Math.max(0, P.age - 30) / 80) + 0.0009 * f.cheek;
  for (let k = 0; k < 5; k++) { const t = k / 4; const cx = 0.0205 + 0.0095 * t, cy = -0.040 - 0.026 * t; d -= fold * 0.7 * Math.exp(-(((ax - cx) / 0.0036) ** 2 + ((y - cy) / 0.0048) ** 2)); }
  // jowls / fat
  const jl = f.jowl + H.skinFat * 0.25 + H.el * 0.4;
  d += 0.010 * jl * Math.exp(-(((ax - 0.040) / 0.018) ** 2 + ((y + 0.090) / 0.016) ** 2));
  d += 0.012 * jl * Math.exp(-((x / 0.028) ** 2 + ((y + 0.118) / 0.011) ** 2));
  // neck: adam's apple, sternocleidomastoid
  if (y < -0.12) {
    if (!F) d += 0.0045 * Math.exp(-((x / 0.0075) ** 2 + ((y + 0.136) / 0.010) ** 2));
    d += (0.0020 + 0.003 * H.musc) * Math.exp(-(((ax - 0.024) / 0.011) ** 2 + ((y + 0.15) / 0.03) ** 2));
  }
  return d;
}

// lip protrusion profiles
const LIP_U = [[0, 0.0035], [0.0035, 0.0060], [0.0075, 0.0068], [0.0115, 0.0048], [0.0155, 0.0018], [0.021, 0], [0.03, 0]];
const LIP_L = [[0, 0.0035], [0.0045, 0.0072], [0.009, 0.0080], [0.0135, 0.0050], [0.0185, -0.0012], [0.0235, -0.0024], [0.03, 0], [0.04, 0]];
function lipBump(x, y, H) {
  const d = y - H.ym; const ax = Math.abs(x);
  const lx = Math.pow(Math.max(0, 1 - smooth(H.xc * 0.35, H.xc * 1.12, ax)), 0.9);
  if (d >= 0) { if (d > 0.03) return 0; return table(LIP_U, d)[0] * lx * H.f.lips; }
  const dd = -d; if (dd > 0.04) return 0; return table(LIP_L, dd)[0] * lx * H.f.lips;
}

/**
 * Build the head. Returns everything the face/hair/clothing modules need.
 * opts: {lod: 0|1}
 */
export function buildHead(P, L, boneIndex, opts = {}) {
  const lod = opts.lod || 0;
  const H = headParams(P);
  const sh = L.dims.sh;
  const pivot = L.J.head;
  const { ys, jm, je } = genRows(H.ym, H.ey, lod);
  const phis = genCols(lod);
  const NC = phis.length - 1; // columns 0..NC, NC duplicates 0 (seam)
  const NR = ys.length;
  // ---- vertices ----
  const verts = []; // {x,y,z,x0,y0,j,i,kind,...}
  const grid = []; // grid[j][i] = {up, lo} indices
  const tmp = {};
  // eye/mouth slit column ranges
  const rowXm = [], rowXe = [];
  const xAt = (y, i) => { baseXZ(y, phis[i], H, tmp); return tmp.x; };
  const findCol = (y, xt) => { let best = 0, bd = 9; for (let i = NC / 2; i <= NC && phis[i] <= Math.PI / 2; i++) { const d = Math.abs(xAt(y, i) - xt); if (d < bd) { bd = d; best = i; } } return best; };
  const eyeIn = H.eyeX - 0.0138 * (H.f.eyeSize ** 0.5), eyeOut = H.eyeX + 0.0138 * (H.f.eyeSize ** 0.5);
  const half = (NC) / 2; // column index of phi=0 is NC/2
  const iM_L = findCol(H.ym, H.xc), iM_R = NC - iM_L; // mouth corner columns (left = +x -> larger index)
  const iE_Lin = findCol(H.ey, eyeIn), iE_Lout = findCol(H.ey, eyeOut);
  const iE_Rin = NC - iE_Lin, iE_Rout = NC - iE_Lout;
  // slit definitions
  const slits = {
    mouth: { j: jm, a: iM_R, b: iM_L, cx: 0 },
    eyeL: { j: je, a: iE_Lin, b: iE_Lout, cx: H.eyeX },    // left eye (+x): columns ascend with x
    eyeR: { j: je, a: iE_Rout, b: iE_Rin, cx: -H.eyeX },
  };
  const inSlit = (name, j, i) => { const s = slits[name]; return j === s.j && i > s.a && i < s.b; };
  const mouthInner = (i) => i > iM_R && i < iM_L;
  // eye helper: normalised position xn along the eye (0 inner .. 1 outer) for column x
  const eyeXN = (ax) => (ax - eyeIn) / (eyeOut - eyeIn);
  const lidProfileUp = (xn) => { if (xn <= 0 || xn >= 1) return 0; return Math.pow(Math.sin(Math.PI * Math.pow(xn, 0.82)), 0.85); };
  const lidProfileLo = (xn) => { if (xn <= 0 || xn >= 1) return 0; return Math.pow(Math.sin(Math.PI * Math.pow(xn, 1.25)), 0.9); };
  const upH = 0.0060 * (0.9 + 0.1 * H.f.eyeSize) * (1 + 0.1 * H.f.eyeSize), loH = 0.0040 * (0.9 + 0.1 * H.f.eyeSize);
  const tiltDy = (xn) => H.tilt * 0.016 * (xn - 0.35);
  const lidSpanU = 0.0125, lidSpanL = 0.0095;

  const addV = (o) => { o.idx = verts.length; verts.push(o); return o.idx; };
  const nrm = {};
  for (let j = 0; j < NR; j++) {
    const y0 = ys[j]; const row = [];
    for (let i = 0; i <= NC; i++) {
      baseXZ(y0, phis[i], H, nrm);
      let x = nrm.x, z = nrm.z; const nx = nrm.nx, nz = nrm.nz;
      const fm = smooth(-0.25, 0.30, nz) * (y0 < -0.125 ? 1 : 1);
      const d = (features(x, y0, H, P) + lipBump(x, y0, H)) * fm;
      x += nx * d; z += nz * d;
      const base = { x, y: y0, z, x0: x, y0, j, i, phi: phis[i], d };
      // ---- eye warp & shell ----
      {
        const side = x >= 0 ? 1 : -1;
        const ex = side * H.eyeX;
        const rho = Math.hypot((x - ex) / 0.0255, (y0 - H.ey) / 0.0215);
        if (rho < 1.8 && nz > 0.25) { base.eyeSide = side; base.rho = rho; }
      }
      row.push(base);
    }
    grid.push(row);
  }
  // --- eye/lids/shell evaluation (needs per-vertex processing for up/lo variants) ---
  const mkEyeVertex = (b, which /* 'up' | 'lo' | 'mid' */) => {
    const side = b.eyeSide; const v = { ...b };
    if (!side) return v;
    const ex = side * H.eyeX, ax = Math.abs(b.x0);
    const xn = eyeXN(ax);
    let y = b.y0;
    const dyy = b.y0 - H.ey;
    const tdy = tiltDy(Math.min(1, Math.max(0, xn)));
    const inRange = xn > -0.15 && xn < 1.15;
    let upM = 0, loM = 0;
    if (inRange) {
      const xc = Math.min(1, Math.max(0, xn));
      const pu = lidProfileUp(xn), pl = lidProfileLo(xn);
      upM = upH * pu + tdy; loM = -loH * pl + tdy;
      // canthus pinch: blend the corner shift
      const edge = smooth(-0.1, 0.08, xn) * (1 - smooth(0.92, 1.1, xn));
      // upper lid / lower lid warps
      if (which === 'up' || (which === 'mid' && dyy > 0)) {
        const w = dyy <= 0 ? 1 : Math.pow(Math.max(0, 1 - dyy / lidSpanU), 1.5);
        y = b.y0 + (upM) * w * edge;
        if (which === 'up') y = b.y0 + upM * edge;
      } else {
        const w = dyy >= 0 ? 1 : Math.pow(Math.max(0, 1 + dyy / lidSpanL), 1.5);
        y = b.y0 + loM * w * edge;
        if (which === 'lo') y = b.y0 + loM * edge;
      }
    }
    // shell
    const dx = b.x0 - ex, dy = y - H.ey, d2 = dx * dx + dy * dy;
    const rhoV = Math.hypot(dx / 0.0255, (b.y0 - H.ey) / ((b.y0 - H.ey) > 0 ? 0.0215 : 0.0165));
    const w = 1 - smooth(0.62, 1.55, rhoV);
    if (w > 0) {
      // distance from margin along the lid for thickness
      const mUp = H.ey + upM, mLo = H.ey + loM;
      let dm = y >= H.ey ? Math.max(0, y - mUp) : Math.max(0, mLo - y);
      if (y < mUp && y > mLo) dm = 0;
      const tl = 0.00018 + 0.0013 * smooth(0, 0.004, dm) + 0.0012 * smooth(0.005, 0.013, dm);
      const rs = H.re + tl;
      const zs = H.ez + Math.sqrt(Math.max(rs * rs - d2, (0.30 * rs) ** 2));
      v.z = mixn(b.z, zs, w);
      v.x = mixn(b.x, b.x, 1);
    }
    v.y = y; v.lid = which;
    v.xn = xn; v.upM = upM; v.loM = loM; v.eyeCx = ex;
    return v;
  };
  // --- assemble final vertex list with slit duplicates ---
  const rowIdx = []; // rowIdx[j][i] = {up, lo}
  for (let j = 0; j < NR; j++) {
    const r = [];
    for (let i = 0; i <= NC; i++) {
      const b = grid[j][i];
      const isEyeSlit = j === je && (inSlit('eyeL', j, i) || inSlit('eyeR', j, i));
      const isMouthSlit = j === jm && mouthInner(i);
      if (isEyeSlit) {
        const vu = mkEyeVertex(b, 'up'), vl = mkEyeVertex(b, 'lo');
        vu.kind = 'lidUp'; vl.kind = 'lidLo';
        r.push({ up: addV(vu), lo: addV(vl) });
      } else if (isMouthSlit) {
        const vu = { ...b, kind: 'lipUp' }, vl = { ...b, kind: 'lipLo' };
        // upper margin: cupid's bow, slightly raised at centre; lower margin
        const ax = Math.abs(b.x0), sxn = ax / H.xc;
        const bow = 0.0007 * Math.exp(-(((ax - 0.0055) / 0.0035) ** 2)) - 0.0005 * Math.exp(-(((ax) / 0.0025) ** 2));
        vu.y += bow; vl.y -= 0.0001;
        vu.cornerS = sxn; vl.cornerS = sxn;
        r.push({ up: addV(vu), lo: addV(vl) });
      } else {
        const v = b.eyeSide ? mkEyeVertex(b, 'mid') : { ...b };
        if (j === jm && (i === iM_L || i === iM_R)) v.kind = 'mouthCorner';
        if (j === je && (i === iE_Lin || i === iE_Lout || i === iE_Rin || i === iE_Rout)) v.kind = 'canthus';
        const id = addV(v);
        r.push({ up: id, lo: id });
      }
    }
    rowIdx.push(r);
  }
  // seam welds
  const weldMap = new Map();
  for (let j = 0; j < NR; j++) { weldMap.set(rowIdx[j][NC].up, rowIdx[j][0].up); weldMap.set(rowIdx[j][NC].lo, rowIdx[j][0].lo); }
  // ---- triangles ----
  const tris = [];
  const quad = (a, b, c, d) => { tris.push(a, b, c, b, d, c); };
  for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NC; i++) {
    // vertices (j: lower row uses .up side because the cell sits ABOVE row j; row j+1 uses .lo side because cell sits BELOW it)
    const a = rowIdx[j][i].up, b = rowIdx[j][i + 1].up, c = rowIdx[j + 1][i].lo, d = rowIdx[j + 1][i + 1].lo;
    // winding: grid i ascends towards +x(left) when seen from front -> triangle (a,c,b) faces outward (+z)
    tris.push(a, b, c, b, d, c);
  }
  // crown pole
  const poleY = CROWN; const pole = addV({ x: 0, y: poleY, z: -0.0005, x0: 0, y0: poleY, j: NR, i: 0, phi: 0, d: 0, kind: 'pole' });
  for (let i = 0; i < NC; i++) { const a = rowIdx[NR - 1][i].up, b = rowIdx[NR - 1][i + 1].up; tris.push(a, b, pole); }
  // winding check: use front row vertex normal
  // (the quads above are wound so that outward is +z at front when phi ascends toward +x?) verified by orientation test below.
  // ---- mouth interior sheets ----
  const mouthCols = []; for (let i = iM_R; i <= iM_L; i++) mouthCols.push(i);
  const K = mouthCols.length - 1; const RINGS = 6;
  const yoffU = [0, 0.0022, 0.0062, 0.0105, 0.0138, 0.0152, 0.0152], zoff = [0, 0.0010, 0.0050, 0.0092, 0.0180, 0.0340, 0.0560];
  const sheetU = [], sheetL = [];
  for (let c = 0; c <= K; c++) { sheetU.push([rowIdx[jm][mouthCols[c]].up]); sheetL.push([rowIdx[jm][mouthCols[c]].lo]); }
  for (let c = 0; c <= K; c++) {
    const mv = verts[sheetU[c][0]]; const s = (mv.x0) / H.xc; const yf = Math.pow(Math.max(0, 1 - s * s), 0.7);
    for (let r = 1; r <= RINGS; r++) {
      const zr = mv.z - zoff[r] * (1 + 0.6 * s * s);
      const xr = mv.x * (1 - 0.012 * r + (r >= 4 ? 0.03 : 0));
      const corner = c === 0 || c === K;
      const mk = (sign) => ({ x: xr, y: H.ym + sign * yoffU[r] * yf, z: zr, x0: xr, y0: H.ym, j: -1, i: c, phi: 0, d: 0, kind: 'sheet', sheet: sign > 0 ? 'U' : 'L', ring: r, col: c, K });
      if (corner) { const id = addV(mk(1)); sheetU[c].push(id); sheetL[c].push(id); }
      else { sheetU[c].push(addV(mk(1))); sheetL[c].push(addV(mk(-1))); }
    }
  }
  for (let c = 0; c < K; c++) {
    for (let r = 0; r < RINGS; r++) {
      // upper sheet faces downward (into the cavity), lower faces upward
      { const a = sheetU[c][r], b = sheetU[c + 1][r], cc = sheetU[c][r + 1], d = sheetU[c + 1][r + 1]; if (a !== cc && b !== d || true) tris.push(b, a, cc, b, cc, d); }
      { const a = sheetL[c][r], b = sheetL[c + 1][r], cc = sheetL[c][r + 1], d = sheetL[c + 1][r + 1]; tris.push(a, b, cc, b, d, cc); }
    }
    // back wall
    const a = sheetU[c][RINGS], b = sheetU[c + 1][RINGS], cc = sheetL[c][RINGS], d = sheetL[c + 1][RINGS];
    tris.push(a, cc, b, b, cc, d);
  }

  // ---- ears (appended to the head mesh) ----
  const earVerts = [];
  for (const side of [1, -1]) {
    const rh = 0.0315 * f_ear(H) * (H.F ? 0.93 : 1), rw = 0.0175 * f_ear(H) * (H.F ? 0.93 : 1);
    const ye = -0.011, ze = -0.0045, tau = 0.17;
    const prof = [[0, 0.0020], [0.28, 0.0035], [0.45, 0.0078], [0.62, 0.0088], [0.78, 0.0148], [0.88, 0.0105], [0.95, 0.0035], [1.0, -0.0045]];
    const NRg = 8, NSg = 22; const base = verts.length;
    for (let r = 0; r <= NRg; r++) {
      const rr = r / NRg;
      for (let q = 0; q < (r === 0 ? 1 : NSg); q++) {
        const th = (q / NSg) * Math.PI * 2;
        let a = Math.cos(th) * rw * rr, b = Math.sin(th) * rh * rr;
        if (b < 0) a *= 0.86 + 0.14 * (1 + b / rh) ;
        const z = ze + a * Math.cos(tau) - b * Math.sin(tau), y = ye + a * Math.sin(tau) + b * Math.cos(tau);
        const t = profile(y); const A = t[0] * H.f.width * mixn(1, H.f.jaw, smooth(-0.03, -0.085, y)), D = z >= t[3] ? (t[1] - t[3]) : (t[2] + t[3]);
        const q2 = Math.pow(Math.min(0.98, Math.abs((z - t[3]) / D)), t[4]);
        const xs = A * Math.pow(Math.max(0.05, 1 - q2), 1 / t[4]);
        // the ear root hugs the skull: after the rim, slope into the head
        const off = table(prof, rr)[0] * (0.85 + 0.35 * (H.f.earSize - 1) + 0.3) ;
        const x = side * (xs + off - 0.001);
        const phi = side * (Math.PI / 2 - z * 13.6);
        addV({ x, y, z, x0: x, y0: y, j: -2, i: 0, phi, d: 0, kind: 'ear', side });
      }
    }
    // triangles
    const idxOf = (r, q) => (r === 0 ? base : base + 1 + (r - 1) * NSg + (q % NSg));
    const et = [];
    for (let q = 0; q < NSg; q++) et.push(idxOf(0, 0), idxOf(1, q), idxOf(1, q + 1));
    for (let r = 1; r < NRg; r++) for (let q = 0; q < NSg; q++) { const a = idxOf(r, q), b = idxOf(r, q + 1), c = idxOf(r + 1, q), d = idxOf(r + 1, q + 1); et.push(a, c, b, b, c, d); }
    // orientation: normal of first ring quad must point to +side*x
    const A0 = verts[idxOf(3, 0)], B0 = verts[idxOf(4, 0)], C0 = verts[idxOf(3, 1)];
    const e1 = new THREE.Vector3(B0.x - A0.x, B0.y - A0.y, B0.z - A0.z), e2 = new THREE.Vector3(C0.x - A0.x, C0.y - A0.y, C0.z - A0.z);
    const nrm0 = e1.cross(e2);
    if (nrm0.x * side < 0) for (let k = 0; k < et.length; k += 3) { const t2 = et[k + 1]; et[k + 1] = et[k + 2]; et[k + 2] = t2; }
    for (const v of et) tris.push(v);
  }
  // ---- eyelid margin to eyeball: no extra geometry needed ----
  // ---- orientation test & normals ----
  const nv = verts.length;
  const pos = new Float32Array(nv * 3), uvA = new Float32Array(nv * 2);
  const UVU = headUV.u, UVV = headUV.v;
  for (let k = 0; k < nv; k++) {
    const v = verts[k]; pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
    if (v.kind === 'sheet') { uvA[k * 2] = v.col / Math.max(1, v.K); uvA[k * 2 + 1] = 0.05 - 0.045 * (v.ring - 1) / (RINGS - 1); }
    else if (v.kind === 'pole') { uvA[k * 2] = 0.5; uvA[k * 2 + 1] = 1; }
    else { uvA[k * 2] = UVU(v.phi); uvA[k * 2 + 1] = UVV(v.y0); }
  }
  const idx = new Uint32Array(tris);
  const outward = (() => { // check the front-centre quad winding
    const j = Math.floor(NR * 0.5), i = NC / 2; const a = rowIdx[j][i].up, b = rowIdx[j][i + 1].up, c = rowIdx[j + 1][i].lo;
    const A = verts[a], B = verts[b], C = verts[c];
    const e1 = new THREE.Vector3(B.x - A.x, B.y - A.y, B.z - A.z), e2 = new THREE.Vector3(C.x - A.x, C.y - A.y, C.z - A.z);
    return e1.cross(e2).z > 0;
  })();
  if (!outward) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } }
  const weld = new Int32Array(nv); for (let k = 0; k < nv; k++) weld[k] = weldMap.has(k) ? weldMap.get(k) : k;
  const normals = computeWeldedNormals(pos, idx, weld);

  return finishHead({ P, L, H, sh, pivot, verts, pos, idx, uvA, weld, normals, rowIdx, grid, ys, phis, NR, NC, jm, je, slits, iM_L, iM_R, iE_Lin, iE_Lout, boneIndex, outward, sheetU, sheetL, K, RINGS });
}

function f_ear(H) { return H.f.earSize; }
function computeWeldedNormals(pos, idx, weld) {
  const n = pos.length / 3; const acc = new Float32Array(n * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const e1x = pos[b * 3] - ax, e1y = pos[b * 3 + 1] - ay, e1z = pos[b * 3 + 2] - az, e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; // area weighted
    for (const v of [a, b, c]) { const w = weld[v] * 3; acc[w] += nx; acc[w + 1] += ny; acc[w + 2] += nz; }
  }
  const out = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) { const w = weld[v] * 3; const l = Math.hypot(acc[w], acc[w + 1], acc[w + 2]) || 1; out[v * 3] = acc[w] / l; out[v * 3 + 1] = acc[w + 1] / l; out[v * 3 + 2] = acc[w + 2] / l; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
function finishHead(S) {
  const { P, L, H, sh, pivot, verts, pos, idx, uvA, weld, rowIdx, NR, NC, jm, je, slits, boneIndex } = S;
  const nv = verts.length;
  const f = H.f;
  // ---------- jaw weights ----------
  const wj = new Float32Array(nv);
  const xcorner = H.xc;
  for (let k = 0; k < nv; k++) {
    const v = verts[k]; const ax = Math.abs(v.x0 ?? v.x);
    let w;
    if (v.kind === 'sheet') { w = v.sheet === 'L' ? 1 : 0; if (v.col === 0 || v.col === v.K) w = 0.5; }
    else if (v.kind === 'lipUp') w = 0;
    else if (v.kind === 'lipLo') w = 1;
    else if (v.kind === 'mouthCorner') w = 0.5;
    else if (v.kind === 'pole') w = 0;
    else {
      const y0 = v.y0;
      // formula: vertical ramp around mouth line, lateral falloff, fade into neck
      const vert = smooth(H.ym + 0.012, H.ym - 0.010, y0);
      const lat = 1 - smooth(0.050, 0.068, ax) * 0.0;
      const neckFade = smooth(-0.150, -0.118, y0);
      const formula = vert * neckFade * (1 - smooth(0.045, 0.074, ax) * (1 - smooth(-0.04, -0.09, y0) * 0.0));
      // slit-column mode: hard split above/below
      const sm = smooth(xcorner - 0.002, xcorner + 0.014, ax);
      const hard = (y0 > H.ym + 0.0001 ? 0 : 1) * neckFade;
      w = mixn(hard, formula, sm);
      if (y0 > H.ym && ax < xcorner + 0.002) w = Math.min(w, 0.0);
    }
    wj[k] = w;
  }
  // ---------- bone weights ----------
  const yN = (L.J.neck.y - L.J.head.y) / sh; // neck pivot in nominal units
  const bi = boneIndex;
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  for (let k = 0; k < nv; k++) {
    const y = verts[k].kind === 'sheet' ? verts[k].y : verts[k].y0;
    const wHead = smooth(yN - 0.010, yN + 0.055, y);
    const wChest = 1 - smooth(yN - 0.080, yN - 0.040, y);
    const wNeck = Math.max(0, 1 - wHead - wChest);
    const j = wj[k] * wHead;
    const arr = [[bi.head, wHead], [bi.neck, wNeck], [bi.chest, wChest], [bi.head, 0]]; // jaw motion is done by morph targets (the jaw bone only moves teeth/tongue)
    for (let m = 0; m < 4; m++) { si[k * 4 + m] = arr[m][0]; sw[k * 4 + m] = Math.max(0, arr[m][1]); }
  }
  // ---------- morph targets (deltas in nominal space) ----------
  const morphNames = ['jaw', 'wide', 'round', 'press', 'tuck', 'smileL', 'smileR', 'frown', 'browUp', 'browDown', 'browInnerUp', 'browAngry', 'blinkL', 'blinkR', 'lidWide', 'squint', 'sneer', 'cheekPuff'];
  const M = {}; for (const n of morphNames) M[n] = new Float32Array(nv * 3);
  const jp = H.jawPivot; const JA = 0.34;
  const ym = H.ym, xc = H.xc;
  const lipC = (v) => { const ax = Math.abs(v.x0 ?? v.x); return Math.max(0, 1 - smooth(xc * 1.2, xc * 2.7, ax)); }; // influence around the mouth
  const mouthG = (v) => { const dx = (v.x0 ?? v.x) / 0.036, dy = ((v.y0 ?? v.y) - ym) / 0.030; return Math.exp(-(dx * dx + dy * dy)); };
  for (let k = 0; k < nv; k++) {
    const v = verts[k]; if (v.kind === 'ear') continue; const x = v.x, y = v.y, z = v.z; const ax = Math.abs(x), sgn = Math.sign(x) || 1;
    const set = (name, dx, dy, dz) => { const m = M[name]; m[k * 3] += dx; m[k * 3 + 1] += dy; m[k * 3 + 2] += dz; };
    // jaw: rotate about pivot
    if (wj[k] > 0) {
      const a = JA * wj[k]; const py = y - jp[1], pz = z - jp[2]; const ca = Math.cos(a), sa = Math.sin(a);
      set('jaw', 0, py * ca - pz * sa - py, py * sa + pz * ca - pz);
    }
    const isSheet = v.kind === 'sheet';
    const my = (v.y0 ?? y) - ym; const side = v.kind === 'lipUp' ? 1 : v.kind === 'lipLo' ? -1 : (isSheet ? (v.sheet === 'U' ? 1 : -1) : Math.sign(my));
    const g = mouthG(v) * (isSheet ? 1 : 1);
    const ctr = Math.exp(-((x / 0.012) ** 2));
    if (g > 0.01 || isSheet) {
      const sxn = Math.min(1.4, ax / xc);
      const gg = isSheet ? Math.min(1, 0.9) : g;
      // wide
      set('wide', sgn * 0.0075 * gg * sxn, 0.0009 * gg * sxn, -0.0020 * gg * sxn);
      // round (pucker)
      set('round', -sgn * 0.0100 * gg * Math.pow(sxn, 0.8), side * 0.0014 * gg * (1 - sxn * 0.5), 0.0075 * gg * (0.4 + 0.6 * (1 - sxn)));
      // press
      set('press', -sgn * 0.0020 * gg * sxn, -side * 0.0011 * gg * (v.kind === 'lipUp' || v.kind === 'lipLo' ? 1 : 0.5) * (isSheet ? 0 : 1), -0.0022 * gg);
      // tuck: lower lip curls up and in
      if (side < 0) set('tuck', 0, 0.0085 * gg * (1 - sxn * 0.4), -0.0072 * gg);
      // frown
      set('frown', -sgn * 0.0018 * gg * sxn, -0.0058 * gg * Math.pow(sxn, 1.4) + (side < 0 ? 0.0016 * gg * (1 - sxn) : 0), 0.0006 * gg * (side < 0 ? 1 : 0));
    }
    // smile (per side): corners up/out, cheeks up, nasolabial deepening
    for (const [nm, sd] of [['smileL', 1], ['smileR', -1]]) {
      if (x * sd <= -0.004) continue;
      const xs = x * sd; // positive on this side
      const gm = Math.exp(-(((xs - xc * 0.95) / 0.030) ** 2 + (((v.y0 ?? y) - ym) / 0.026) ** 2)) * smooth(-0.004, 0.006, xs);
      const gc = Math.exp(-(((xs - 0.046) / 0.024) ** 2 + (((v.y0 ?? y) + 0.030) / 0.024) ** 2));
      const gw = smooth(-0.002, 0.012, xs);
      set(nm, sd * 0.0048 * gm * Math.min(1.2, xs / xc), 0.0072 * gm * Math.pow(Math.max(0, Math.min(1.2, xs / xc)), 1.3) + 0.0040 * gc, 0.0015 * gc - 0.0012 * gm);
      // lower lid pushed up by cheek raise
      if (v.lid === 'lo' || (v.eyeSide === sd && (v.y0 ?? y) < H.ey)) set(nm, 0, 0.0014 * smooth(0.0, 0.01, xs) * (v.rho !== undefined ? Math.max(0, 1 - v.rho * 0.8) : 0), 0);
    }
    // brows
    const yb = v.y0 ?? y;
    const gb = Math.exp(-(((ax - 0.034) / 0.026) ** 2 + ((yb - 0.030) / 0.020) ** 2));
    const gf = Math.exp(-((ax / 0.06) ** 2 + ((yb - 0.062) / 0.030) ** 2)) * smooth(0.02, 0.05, yb);
    set('browUp', 0, 0.0062 * gb + 0.0042 * gf, 0.0012 * gb);
    set('browDown', 0, -0.0042 * gb - 0.0012 * gf, 0.0020 * gb);
    const gi = Math.exp(-(((ax - 0.016) / 0.016) ** 2 + ((yb - 0.030) / 0.018) ** 2));
    const go = Math.exp(-(((ax - 0.046) / 0.018) ** 2 + ((yb - 0.030) / 0.018) ** 2));
    set('browInnerUp', -sgn * 0.0009 * gi, 0.0075 * gi + 0.0014 * go * -1, 0.0006 * gi);
    set('browAngry', -sgn * 0.0006 * gi, -0.0062 * gi + 0.0030 * go, 0.0024 * gi);
    // sneer: raise upper lip & nose wrinkle
    const gs = Math.exp(-(((ax - 0.014) / 0.014) ** 2 + ((yb + 0.050) / 0.014) ** 2));
    set('sneer', 0, 0.0036 * gs + (v.kind === 'lipUp' ? 0.0016 * Math.exp(-((ax / 0.016) ** 2)) : 0), 0.0006 * gs);
    set('cheekPuff', sgn * 0.0040 * Math.exp(-(((ax - 0.045) / 0.020) ** 2 + ((yb + 0.040) / 0.026) ** 2)), 0, 0.0038 * Math.exp(-(((ax - 0.040) / 0.022) ** 2 + ((yb + 0.040) / 0.026) ** 2)));
    // eyes: rotate lid vertices about the eye centre (YZ plane). delta > 0 rotates towards +y.
    if (v.eyeSide && v.kind !== 'canthus') {
      const cz = H.ez, cy = H.ey;
      const isL = v.eyeSide > 0; const nameB = isL ? 'blinkL' : 'blinkR';
      const xn = v.xn ?? 0.5; const xcn = Math.min(1, Math.max(0, xn));
      const dyv = y - cy;
      const rM = H.re * 1.05;
      const asn = (q) => Math.asin(Math.max(-1, Math.min(1, q)));
      const closeOff = tiltOf(H, xcn) - 0.0030 * Math.pow(Math.sin(Math.PI * xcn), 0.7);
      const aClose = asn(closeOff / rM);
      const upperLid = (v.lid === 'up') || (v.lid !== 'lo' && dyv > 0);
      const margin = upperLid ? v.upM : v.loM;
      const aM = asn((margin || 0) / rM);
      const dm = upperLid ? Math.max(0, dyv - (v.upM || 0)) : Math.max(0, (v.loM || 0) - dyv);
      const wd = (v.lid === 'up' || v.lid === 'lo') ? 1 : (upperLid ? Math.pow(Math.max(0, 1 - dm / 0.020), 1.5) : Math.pow(Math.max(0, 1 - dm / 0.011), 1.5));
      const winEdge = (xn > -0.12 && xn < 1.12) ? 1 : 0;
      const delta = (aClose - aM) * wd * winEdge;
      const rotv = (ang) => { const ca = Math.cos(ang), sa = Math.sin(ang); const py = y - cy, pz = z - cz; return [py * ca + pz * sa - py, pz * ca - py * sa - pz]; };
      if (delta !== 0) { const r = rotv(delta); set(nameB, 0, r[0], r[1]); }
      const w2 = wd * winEdge;
      if (w2 > 0) {
        if (upperLid) {
          let r = rotv(0.24 * w2); set('lidWide', 0, r[0], r[1]);
          r = rotv(-0.15 * w2); set('squint', 0, r[0], r[1]);
          r = rotv(-0.06 * w2); set('browDown', 0, r[0], r[1]);
          r = rotv(0.08 * w2); set('browUp', 0, r[0], r[1]);
        } else {
          let r = rotv(-0.07 * w2); set('lidWide', 0, r[0], r[1]);
          r = rotv(0.20 * w2); set('squint', 0, r[0], r[1]);
          const gcs = smooth(-0.002, 0.012, x * v.eyeSide);
          r = rotv(0.10 * w2 * gcs); set(isL ? 'smileL' : 'smileR', 0, r[0], r[1]);
        }
      }
    }
  }
  // ---------- morph normals ----------
  const morphPos = [], morphNor = [];
  const tmpPos = new Float32Array(pos.length);
  for (const name of morphNames) {
    const d = M[name]; for (let q = 0; q < d.length; q++) if (!(d[q] === d[q])) d[q] = 0;
    for (let q = 0; q < pos.length; q++) tmpPos[q] = pos[q] + d[q];
    const nn = computeWeldedNormals(tmpPos, idx, weld);
    const dn = new Float32Array(nn.length); for (let q = 0; q < nn.length; q++) dn[q] = nn[q] - S.normals[q];
    // scale deltas to model space
    const dp = new Float32Array(d.length); for (let q = 0; q < d.length; q++) dp[q] = d[q] * sh;
    morphPos.push(new THREE.Float32BufferAttribute(dp, 3)); morphNor.push(new THREE.Float32BufferAttribute(dn, 3));
  }
  // ---------- geometry (model space) ----------
  const gp = new Float32Array(pos.length);
  for (let k = 0; k < nv; k++) { gp[k * 3] = pivot.x + pos[k * 3] * sh; gp[k * 3 + 1] = pivot.y + pos[k * 3 + 1] * sh; gp[k * 3 + 2] = pivot.z + pos[k * 3 + 2] * sh; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(S.normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.morphAttributes.position = morphPos; geo.morphAttributes.normal = morphNor; geo.morphTargetsRelative = true;
  geo.userData.morphNames = morphNames;
  geo.userData.morphDeltas = M; // nominal-space deltas (for followers)
  const head = { geometry: geo, morphNames, H, sh, pivot, verts, rowIdx, grid: S.grid, ys: S.ys, phis: S.phis, NR, NC, jm, je, slits, wj, nominalPos: pos, weld, idx, normals: S.normals, P, L };
  head.sample = (x, y) => sampleGrid(head, x, y);
  return head;
}
function tiltOf(H, xn) { return H.tilt * 0.016 * (xn - 0.35); }

/** nominal → model space helper */
export function nomToModel(head, p, out = new THREE.Vector3()) { return out.set(head.pivot.x + p[0] * head.sh, head.pivot.y + p[1] * head.sh, head.pivot.z + p[2] * head.sh); }

/** Evaluate base surface (incl. features, ignoring lid/eye shell) at nominal (x, y) on the front half: returns {z, nx, ny, nz}. Used to place brows, hair, etc. */
export function surfaceAt(head, x, y) {
  const H = head.H, P = head.P || null;
  // solve phi so base x matches
  let lo = 0, hi = Math.PI / 2, tmp = {};
  const sg = Math.sign(x) || 1; const ax = Math.abs(x);
  for (let it = 0; it < 24; it++) { const mid = (lo + hi) / 2; baseXZ(y, mid, H, tmp); if (tmp.x < ax) lo = mid; else hi = mid; }
  const phi = (lo + hi) / 2; baseXZ(y, phi, H, tmp);
  return { z: tmp.z, nx: tmp.nx * sg, nz: tmp.nz, phi: phi * sg };
}

/** bilinear sample of the base head surface (nominal space) at (x,y) on the front: {p:[x,y,z], n:[..], v: nearest vertex index} */
function sampleGrid(head, x, y) {
  const { ys, rowIdx, verts, NC, NR, normals } = head;
  let j = 0; while (j < NR - 2 && ys[j + 1] <= y) j++;
  const ty = Math.min(1, Math.max(0, (y - ys[j]) / (ys[j + 1] - ys[j])));
  const side = x >= 0 ? 1 : -1, ax = Math.abs(x);
  const col = (jj, i) => (side > 0 ? i : NC - i);
  const half = NC / 2;
  const xs = (jj, i) => Math.abs(verts[rowIdx[jj][col(jj, i)].up].x);
  let i = half; let guard = 0;
  // columns ascend from front (index half) toward the side; walk until bracket found
  const iF = (jj, k) => (side > 0 ? half + k : half - k);
  let k = 0; while (k < NC / 2 - 1 && Math.abs(verts[rowIdx[j][iF(j, k + 1)].up].x) < ax && guard++ < 300) k++;
  const i0 = iF(j, k), i1 = iF(j, k + 1);
  const xa = Math.abs(verts[rowIdx[j][i0].up].x), xb = Math.abs(verts[rowIdx[j][i1].up].x);
  const tx = Math.min(1, Math.max(0, (ax - xa) / Math.max(1e-6, xb - xa)));
  const get = (jj, ii, useLo) => { const id = useLo ? rowIdx[jj][ii].lo : rowIdx[jj][ii].up; return id; };
  const ids = [get(j, i0, false), get(j, i1, false), get(j + 1, i0, true), get(j + 1, i1, true)];
  const w = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  const p = [0, 0, 0], n = [0, 0, 0];
  for (let q = 0; q < 4; q++) { const v = verts[ids[q]]; p[0] += v.x * w[q]; p[1] += v.y * w[q]; p[2] += v.z * w[q]; n[0] += normals[ids[q] * 3] * w[q]; n[1] += normals[ids[q] * 3 + 1] * w[q]; n[2] += normals[ids[q] * 3 + 2] * w[q]; }
  const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l;
  let best = ids[0], bw = w[0]; for (let q = 1; q < 4; q++) if (w[q] > bw) { bw = w[q]; best = ids[q]; }
  return { p, n, v: best };
}
