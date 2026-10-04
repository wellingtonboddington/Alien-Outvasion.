// Landmarks A: Dumaguete (boulevard, belfry, cathedral) and Berlin (TV tower, gate).
import * as THREE from 'three';
import { RNG, smoothstep, clamp } from '../../engine/common.js';
import { fbm2 } from '../../engine/proc.js';
import { Builder, rgb, mul, mix, jitter } from './builder.js';
import { STYLES } from './styles.js';
import { emitBuilding } from './buildings.js';
import * as P from './props.js';
import { column, archWall, pediment, onionDome, halfDome, pyramid, balustrade, stairs, crenellations } from './arch.js';

const PI = Math.PI;
const SIDE_YAW = [0, PI / 2, PI, -PI / 2];

/** four-sided stage of masonry with openings per side. openings(sideIndex) -> [{cx,w,h,y0,arch}] */
function stage(B, bk, w, h, y0, openingsOf, col = 0xffffff, mpt = 3, t = 0.9) {
  for (let s = 0; s < 4; s++) {
    const len = (s % 2 === 0) ? w : w - 2 * t; B.push(0, y0, 0, SIDE_YAW[s]); archWall(B, bk, len, h, t, openingsOf(s), col, mpt, 0, 0, w / 2 - t / 2); B.pop();
  }
  B.box('plain', 0, y0 + h / 2, 0, w - 2 * t + 0.1, h, w - 2 * t + 0.1, { col: 0x0b0a09 });
}
function pilasters(B, bk, w, h, y0, r = 0.42, col = 0xffffff) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(bk, sx * (w / 2 - r / 2 + 0.05), y0 + h / 2, sz * (w / 2 - r / 2 + 0.05), r, h, r, { col, mpt: 3 }); }
function bell(B, x, y, z, r = 0.7) { B.lathe('bronze', x, y, z, [[0.05, 1.3 * r], [0.25 * r, 1.25 * r], [0.38 * r, 1.0 * r], [0.5 * r, 0.55 * r], [0.78 * r, 0.12 * r], [0.9 * r, 0], [0.84 * r, -0.04 * r]], 12, { col: 0xb98a3e }); B.box('plain', x, y + 1.4 * r, z, 0.18, 0.18, 1.8 * r, { col: 0x3a2a1c }); }

/** the Dumaguete-style coral-stone belfry (local origin = ground centre). returns height */
function belfry(B, o = {}) {
  const bk = 's_coral'; const W = o.w ?? 7.6; let y = 0; const col = 0xf4f0e6; const col2 = 0xe8e4d8;
  B.box(bk, 0, 0.3, 0, W + 2.2, 0.6, W + 2.2, { col: col2, mpt: 3 }); B.box(bk, 0, 0.8, 0, W + 1.1, 0.5, W + 1.1, { col: col2, mpt: 3 }); y = 1.0;
  const h1 = o.h1 ?? 9;
  stage(B, bk, W, h1, y, (s) => (s === 0 ? [{ cx: 0, w: 2.2, h: 4.4 }, { cx: -2.1, w: 0.7, h: 1.9, y0: 5.2 }, { cx: 2.1, w: 0.7, h: 1.9, y0: 5.2 }] : [{ cx: 0, w: 0.8, h: 2.0, y0: 4.6 }]), col, 3); pilasters(B, bk, W, h1, y, 0.5, col2); y += h1;
  B.box(bk, 0, y + 0.22, 0, W + 0.9, 0.45, W + 0.9, { col: col2, mpt: 3 }); y += 0.45; const W2 = W * 0.88, h2 = o.h2 ?? 6.2;
  stage(B, bk, W2, h2, y, () => [{ cx: 0, w: 1.3, h: 3.7, y0: 1.2 }], col, 3, 0.85); pilasters(B, bk, W2, h2, y, 0.45, col2); y += h2;
  B.box(bk, 0, y + 0.25, 0, W2 + 1.0, 0.5, W2 + 1.0, { col: col2, mpt: 3 }); y += 0.5; const W3 = W * 0.76, h3 = o.h3 ?? 5.6;
  stage(B, bk, W3, h3, y, () => [{ cx: 0, w: 2.9, h: 4.5, y0: 0.5 }], col, 3, 0.8); pilasters(B, bk, W3, h3, y, 0.42, col2);
  bell(B, 0, y + 1.3, 0, 0.78); bell(B, 1.05, y + 2.0, 0.0, 0.42); y += h3;
  B.box(bk, 0, y + 0.25, 0, W3 + 1.1, 0.5, W3 + 1.1, { col: col2, mpt: 3 }); y += 0.5;
  balustrade(B, bk, -W3 / 2 - 0.4, -W3 / 2 - 0.4, -W3 / 2 - 0.4, W3 / 2 + 0.4, y, 0.9, col2); balustrade(B, bk, -W3 / 2 - 0.4, W3 / 2 + 0.4, W3 / 2 + 0.4, W3 / 2 + 0.4, y, 0.9, col2); balustrade(B, bk, W3 / 2 + 0.4, W3 / 2 + 0.4, W3 / 2 + 0.4, -W3 / 2 - 0.4, y, 0.9, col2); balustrade(B, bk, W3 / 2 + 0.4, -W3 / 2 - 0.4, -W3 / 2 - 0.4, -W3 / 2 - 0.4, y, 0.9, col2);
  B.box(bk, 0, y + 0.1, 0, W3 + 0.8, 0.2, W3 + 0.8, { col: col2, mpt: 3 }); y += 0.2;
  // octagonal drum + dome + lantern
  B.cyl('s_whitewash', 0, y, 0, W3 * 0.52, W3 * 0.5, 2.6, 8, { col, flat: true, mpt: 3, rot: PI / 8 }); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8 * 0; B.box('plain', Math.cos(a) * W3 * 0.5, y + 1.4, Math.sin(a) * W3 * 0.5, 0.05, 1.1, 0.5, { col: 0x15110d }); }
  y += 2.6; halfDome(B, 's_whitewash', 0, y, 0, W3 * 0.54, col, null, { squash: 0.85 }); y += W3 * 0.54 * 0.85;
  B.cyl('s_whitewash', 0, y - 0.1, 0, 0.7, 0.55, 1.2, 8, { col }); B.cyl('s_whitewash', 0, y + 1.1, 0, 0.55, 0.0, 0.9, 8, { col }); y += 2.0; B.box('gold', 0, y + 0.55, 0, 0.1, 1.1, 0.1, { col: 0x2a2420 }); B.box('gold', 0, y + 0.85, 0, 0.55, 0.1, 0.1, { col: 0x2a2420 });
  return y + 1.2;
}

export function belltower(B) {
  // surrounding plaza with palm trees
  B.quad('g_paving', [-30, 0.01, 30], [30, 0.01, 30], [30, 0.01, -30], [-30, 0.01, -30], [-30 / 4, 30 / 4, 30 / 4, -30 / 4], 0xffffff, [0, 1, 0]);
  const h = belfry(B); for (const [x, z] of [[-14, 12], [15, 10], [-12, -14], [14, -13]]) P.tree(B, 'coconut', x, z, 1.0, Math.abs(x * 7 + z) | 0); P.tree(B, 'raintree', 22, -4, 1.1, 3); P.tree(B, 'raintree', -22, 3, 1.1, 8);
  for (const sx of [-1, 1]) { P.lampPost(B, sx * 9, 11, PI, { style: 'ornate', h: 4.8 }); P.bench(B, sx * 12, 8, PI); }
  return { height: h };
}

function nave(B, x, z, w, d, h, col, roofCol) {
  B.box('s_whitewash', x, h / 2, z, w, h, d, { col, mpt: 4 });
  // pitched GI roof along z
  const rh = w * 0.3; const o = 0.5;
  B.quad('r_gi', [x - w / 2 - o, h, z + d / 2 + o], [x, h + rh, z + d / 2 + o], [x, h + rh, z - d / 2 - o], [x - w / 2 - o, h, z - d / 2 - o], [0, 0, 4, 6], roofCol); B.quad('r_gi', [x, h + rh, z + d / 2 + o], [x + w / 2 + o, h, z + d / 2 + o], [x + w / 2 + o, h, z - d / 2 - o], [x, h + rh, z - d / 2 - o], [0, 0, 4, 6], roofCol);
  B.tri('s_whitewash', [x - w / 2, h, z - d / 2 - 0.02], [x + w / 2, h, z - d / 2 - 0.02], [x, h + rh * 0.97, z - d / 2 - 0.02], col);
}

export function cathedral(B) {
  const bk = 's_whitewash'; const trim = 0xe6dfcd; const cream = 0xf0e8d2; const W = 30, D = 52;
  B.quad('g_paving', [-60, 0.01, 70], [60, 0.01, 70], [60, 0.01, -60], [-60, 0.01, -60], [-15, 17.5, 15, -15], 0xffffff, [0, 1, 0]);
  // facade (front +z at z = D/2): central block + two towers
  const zf = D / 2; const fh = 17;
  B.push(0, 0, zf - 0.6);
  archWall(B, bk, 14, fh, 1.2, [{ cx: 0, w: 4.2, h: 8.0 }], cream, 4); // central portal
  B.pop();
  for (const sx of [-1, 1]) { B.push(sx * 9.5, 0, zf - 0.6); archWall(B, bk, 5, fh - 4, 1.2, [{ cx: 0, w: 1.9, h: 4.4 }, { cx: 0, w: 1.0, h: 2.6, y0: 6.2 }], cream, 4); B.pop(); }
  // pediment + rose window + cornice
  pediment(B, bk, 16.5, 4.5, 1.6, cream, 4, fh); B.cyl('plain', 0, fh + 0.9, zf + 0.2, 1.4, 1.4, 0.05, 20, { col: 0x181410 }); B.cyl('s_coral', 0, fh + 0.9, zf + 0.15, 1.8, 1.8, 0.06, 20, { col: 0xe8e4d8, capBottom: true });
  B.box('s_coral', 0, fh + 0.25, zf, 16.5, 0.6, 1.9, { col: 0xe8e4d8, mpt: 3 });
  for (let i = 0; i < 6; i++) { const x = -5.5 + i * 2.2; if (Math.abs(x) < 2.6) continue; B.box('s_coral', x, 8 + 1.8, zf + 0.35, 0.5, 5, 0.3, { col: trim }); } // pilasters
  column(B, 's_coral', -3.1, 0.6, zf + 0.9, 0.38, 8.2, 0xe8e4d8); column(B, 's_coral', 3.1, 0.6, zf + 0.9, 0.38, 8.2, 0xe8e4d8); B.box('s_coral', 0, 9.0, zf + 0.9, 8.4, 0.7, 1.4, { col: 0xe8e4d8, mpt: 3 });
  stairs(B, 's_coral', 0, 0, zf + 3.6, 14, 4, 0.9, 5, 0xd8d4c8);
  // towers
  for (const sx of [-1, 1]) {
    B.push(sx * 13.6, 0, zf - 4); const w = 8.2; let y = 0; const h1 = fh - 1.0;
    stage(B, bk, w, h1, y, (s) => (s === 0 ? [{ cx: 0, w: 1.4, h: 3.2, y0: 4 }] : [{ cx: 0, w: 0.9, h: 2.4, y0: 4 }]), cream, 4); pilasters(B, 's_coral', w, h1, y, 0.5, trim); y += h1;
    B.box('s_coral', 0, y + 0.3, 0, w + 1, 0.6, w + 1, { col: trim, mpt: 3 }); y += 0.6; const w2 = w * 0.84; stage(B, bk, w2, 6.5, y, () => [{ cx: 0, w: 2.8, h: 4.4, y0: 0.4 }], cream, 4, 0.8); pilasters(B, 's_coral', w2, 6.5, y, 0.42, trim); bell(B, 0, y + 1.3, 0, 0.7); y += 6.5;
    B.box('s_coral', 0, y + 0.3, 0, w2 + 0.9, 0.6, w2 + 0.9, { col: trim, mpt: 3 }); y += 0.6;
    B.cyl(bk, 0, y, 0, w2 * 0.5, w2 * 0.46, 2.4, 8, { col: cream, flat: true, mpt: 3, rot: PI / 8 }); y += 2.4; halfDome(B, bk, 0, y, 0, w2 * 0.5, cream, null, { squash: 0.9 }); y += w2 * 0.45; B.cyl(bk, 0, y - 0.1, 0, 0.6, 0.5, 1.4, 8, { col: cream }); B.cyl(bk, 0, y + 1.3, 0, 0.5, 0, 1.4, 8, { col: cream }); y += 2.8; B.box('plain', 0, y + 0.55, 0, 0.1, 1.1, 0.1, { col: 0x2a2420 }); B.box('plain', 0, y + 0.85, 0, 0.55, 0.1, 0.1, { col: 0x2a2420 });
    B.pop();
  }
  // nave + aisles + transept + apse
  nave(B, 0, -2, 20, D - 10, 15, cream, 0xe8907c); for (const sx of [-1, 1]) { B.box(bk, sx * 12.6, 4.5, -2, 5.2, 9, D - 14, { col: cream, mpt: 4 }); B.quad('r_gi', [sx * 15.4, 8.8, D / 2 - 6], [sx * 10, 11.4, D / 2 - 6], [sx * 10, 11.4, -D / 2 - 6], [sx * 15.4, 8.8, -D / 2 - 6], [0, 0, 3, 8], 0xe8907c); }
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) B.box('plain', sx * 15.22, 4.6, -22 + i * 6.8 + 8, 0.06, 3.2, 1.5, { col: 0x1a1612 }); // aisle windows
  B.cyl(bk, 0, 0, -D / 2 - 5, 7.5, 7.5, 12, 14, { col: cream, flat: true, mpt: 4 }); halfDome(B, 'r_gi', 0, 12, -D / 2 - 5, 7.5, 0xe8907c, null, { squash: 0.7 });
  for (const [x, z] of [[-28, 40], [28, 40], [-26, -10], [27, -6]]) P.tree(B, 'raintree', x, z, 1.2, Math.abs(x + z * 3) | 0);
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { P.lampPost(B, sx * 20, D / 2 + 8 + i * 7, PI, { style: 'ornate', h: 4.8 }); }
  return {};
}

// ---------------------------------------------------------------- seafront boulevard
function bangkaHull(B, x, z, yaw, rng) {
  B.push(x, -0.15, z, yaw); const L = rng.range(6.5, 9.5); const col = rng.pick([0xc83a2a, 0x2a6ac8, 0xf2f2ee, 0x2a9a6a, 0xe8b030]);
  const st = []; for (let i = 0; i <= 8; i++) { const t = i / 8; st.push([-L / 2 + t * L, 0, 0.55 + 0.55 * Math.pow(Math.abs(t - 0.5) * 2, 3), 0.32 * Math.sin(Math.PI * (0.05 + 0.9 * t)) + 0.03]); }
  P.loftBox(B, 'painted', st, { side: col, top: mix(col, 0xffffff, 0.4) });
  for (const sx of [-1, 1]) { B.cyl('plain', sx * 2.2, 0.55, -1.5, 0.04, 0.04, 4.4, 5, { col: 0xb09060, rot: 0 }); B.push(sx * 2.2, 0.0, 0, 0, 1, 1, 1, 0, PI / 2); B.cyl('plain', 0, -L * 0.3, 0, 0.1, 0.1, L * 0.6, 6, { col: 0xb8a070 }); B.pop(); B.box('plain', sx * 0.0, 0.5, -1.5 + 1.5, 4.4, 0.04, 0.05, { col: 0xb09060 }); }
  B.box('plain', 0, 0.6, 0, 0.5, 0.7, 1.2, { col: 0x2a2a2a }); B.pop();
}
export function boulevard(B, ctx) {
  const rng = ctx.rng; const L = 190; const hx = L / 2; const S = STYLES.dumaguete;
  // sea & wall
  B.quad('water', [-1800, -0.45, -6], [1800, -0.45, -6], [1800, -0.45, -3200], [-1800, -0.45, -3200], [0, 0, 1, 1], [0.04, 0.26, 0.34], [0, 1, 0]);
  B.quad('s_coral', [-hx, -1.2, -6.3], [hx, -1.2, -6.3], [hx, 0.9, -6.3], [-hx, 0.9, -6.3], [-hx / 3, 0, hx / 3, 0.7], 0xe8e4d8); B.quad('s_coral', [hx, -1.2, -6.3], [-hx, -1.2, -6.3], [-hx, -1.2, -6.3], [hx, -1.2, -6.3], [0, 0, 1, 1], 0x888070);
  B.box('s_coral', 0, 0.45, -5.6, L, 0.9, 1.4, { col: 0xe0dccf, mpt: 3 });
  for (const sx of [-1, 1]) B.quad('s_coral', [sx * hx, -1.2, -6.3], [sx * hx, -1.2, -4.9], [sx * hx, 0.9, -4.9], [sx * hx, 0.9, -6.3], [0, 0, 1, 1], 0xd8d4c8);
  // promenade paving + stripes
  B.quad('g_paving', [-hx, 0.06, 6], [hx, 0.06, 6], [hx, 0.06, -4.9], [-hx, 0.06, -4.9], [-hx / 4, 6 / 4, hx / 4, -4.9 / 4], 0xf8f4ec, [0, 1, 0]); B.quad('g_paving', [-hx, 0.07, 1.4], [hx, 0.07, 1.4], [hx, 0.07, -0.4], [-hx, 0.07, -0.4], [0, 0, hx / 2, 0.5], 0xa07058, [0, 1, 0]);
  // balustrade along the sea edge (with gaps for steps)
  balustrade(B, 's_whitewash', -hx, -4.9, -hx / 3, -4.9, 0.9, 1.0, 0xf0ece0, { pillar: 3.0, baluster: 0.24 }); balustrade(B, 's_whitewash', -hx / 3 + 6, -4.9, hx * 0.55, -4.9, 0.9, 1.0, 0xf0ece0, { pillar: 3.0, baluster: 0.24 }); balustrade(B, 's_whitewash', hx * 0.55 + 6, -4.9, hx, -4.9, 0.9, 1.0, 0xf0ece0, { pillar: 3.0, baluster: 0.24 });
  // steps down to the water
  for (const xs of [-hx / 3 + 3, hx * 0.55 + 3]) for (let i = 0; i < 6; i++) B.box('s_coral', xs, 0.8 - i * 0.28 - 0.15, -5.0 - i * 0.55, 5.4, 0.3, 0.55, { col: 0xdcd8cc, mpt: 2 });
  // road + kerb + markings + buildings row
  B.quad('g_asphalt', [-hx, 0.0, 15], [hx, 0.0, 15], [hx, 0.0, 6], [-hx, 0.0, 6], [-hx / 8, 15 / 8, hx / 8, 6 / 8], 0xffffff, [0, 1, 0]);
  B.box('g_concrete', 0, 0.08, 6.1, L, 0.2, 0.3, { col: 0xe0dcd4 }); B.quad('g_sidewalk', [-hx, 0.15, 19], [hx, 0.15, 19], [hx, 0.15, 15], [-hx, 0.15, 15], [-hx / 4.8, 19 / 4.8, hx / 4.8, 15 / 4.8], 0xffffff, [0, 1, 0]); B.box('g_concrete', 0, 0.08, 15, L, 0.2, 0.3, { col: 0xe0dcd4 });
  for (let x = -hx; x < hx; x += 9) B.quad('paint', [x, 0.012, 10.7], [x + 3, 0.012, 10.7], [x + 3, 0.012, 10.5], [x, 0.012, 10.5], [0, 0, 1, 1], 0xe6e6de, [0, 1, 0]);
  B.quad('paint', [-hx, 0.012, 10.4], [hx, 0.012, 10.4], [hx, 0.012, 10.3], [-hx, 0.012, 10.3], [0, 0, 1, 1], 0xd8b020, [0, 1, 0]); B.quad('paint', [-hx, 0.012, 10.9], [hx, 0.012, 10.9], [hx, 0.012, 10.8], [-hx, 0.012, 10.8], [0, 0, 1, 1], 0xd8b020, [0, 1, 0]);
  const rc = { S, snow: 0, fires: [], night: 0 }; let x = -hx + 2;
  while (x < hx - 8) { const lw = rng.range(8, 14); const lr = new RNG(Math.floor(x * 100) + 5); const lot = { id: Math.floor(x), edge: true, corner: false, side: 'bottom', w: lw, d: 13 }; const spec = S.spec(lr, lot, { density: 0.75 }); x += lw; if (!spec) continue; spec.x = x - lw / 2; spec.z = 19 + spec.d / 2; spec.yaw = PI; spec.y = 0.15; emitBuilding(B, spec, 0, rc); }
  // palms, benches, lamps, bins, vendors
  for (let px = -hx + 6; px < hx; px += 10) { P.tree(B, 'coconut', px + rng.range(-1, 1), -3.0 + rng.range(-0.3, 0.3), rng.range(0.95, 1.2), rng.int(1, 999), { y: 0.06 }); if (rng.chance(0.6)) P.tree(B, 'coconut', px + 5 + rng.range(-1, 1), 4.2, rng.range(0.9, 1.1), rng.int(1, 999), { y: 0.06 }); }
  for (let px = -hx + 12; px < hx; px += 15) P.lampPost(B, px, -2.0, PI, { y: 0.06, style: 'ornate', h: 5.4 }); for (let px = -hx + 8; px < hx; px += 13) { P.concreteBench(B, px, -3.9, 0); }
  for (let px = -hx + 20; px < hx; px += 35) P.trashBin(B, px + 4, -1.0, 0, 0x2c5a3a); for (let i = 0; i < 5; i++) P.umbrellaStall(B, rng.range(-hx + 10, hx - 10), rng.range(2.6, 4.4), rng.pick([0xe84a4a, 0x2a8ae8, 0xf2c230, 0xe86aa0]), rng);
  // pier
  for (let i = 0; i < 16; i++) { B.cyl('plain', 40 - 1.6, -1.2, -8 - i * 2.4, 0.16, 0.16, 2.1, 6, { col: 0x5a4a3a }); B.cyl('plain', 40 + 1.6, -1.2, -8 - i * 2.4, 0.16, 0.16, 2.1, 6, { col: 0x5a4a3a }); }
  B.box('plain', 40, 0.9, -8 - 18.5, 4.2, 0.18, 38, { col: 0x9a8a72 }); for (let i = 0; i < 38; i++) B.box('plain', 40, 1.0, -8 - i * 1.0, 4.2, 0.02, 0.03, { col: 0x3a3228 }); B.box('plain', 40, 1.8, -8 - 36, 3.6, 0.1, 5, { col: 0x8a7a62 }); for (const sx of [-1.7, 1.7]) for (const sz of [-8 - 34, -8 - 38]) B.cyl('plain', 40 + sx, 0.9, sz, 0.08, 0.08, 1.0, 5, { col: 0x5a4a3a });
  // fishing bangkas in the water
  for (let i = 0; i < 9; i++) bangkaHull(B, rng.range(-hx, hx), -rng.range(18, 90), rng.range(-0.4, 0.4) + PI / 2 * (rng.chance(0.2) ? 1 : 0) + PI / 2, rng);
  // Apo Island silhouette far across the water (+ a smaller islet), vertex-coloured, haze-blended at the base
  const island = (cx, cz, w, h, seed, tint) => {
    const n = 40; const geo = new THREE.BufferGeometry(); const pos = [], col = [], idx = []; const haze = [0.62, 0.74, 0.82];
    for (let i = 0; i <= n; i++) { const u = i / n; const x = cx + (u - 0.5) * w; const prof = Math.pow(Math.sin(Math.PI * u), 0.8) * (0.55 + 0.45 * fbm2(u * 5 + seed, seed, 4)) * h * (u > 0.28 && u < 0.5 ? 1.15 : 0.8); const prof2 = Math.max(prof, 0.0);
      for (let k = 0; k < 2; k++) { const y = k === 0 ? -1 : prof2; const hz = k === 0 ? 0.8 : 0.35 + 0.35 * (1 - prof2 / (h * 1.1)); pos.push(x, y, cz); col.push(...mix(tint, haze, hz)); } }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((v, i) => (i % 3 === 2 ? 1 : 0)), 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2)); geo.setIndex(idx);
    B.geometry('island', geo, 0xffffff); geo.dispose();
  };
  island(-260, -3000, 900, 160, 3.1, [0.14, 0.26, 0.2]); island(700, -3400, 500, 70, 7.7, [0.18, 0.3, 0.26]);
  return { waterLevel: -0.45 };
}

// ---------------------------------------------------------------- Berlin
function horse(B, x, y, z, yaw, rng, col) {
  B.push(x, y, z, yaw); const dark = mul(col, 0.8);
  B.sphere('copper', 0, 1.4, 0, 0.5, 0.58, 1.25, 10, 6, { col }); B.sphere('copper', 0, 1.62, 0.9, 0.42, 0.45, 0.5, 8, 5, { col });
  B.tube('copper', [[0, 1.8, 1.05], [0, 2.4, 1.35], [0, 2.95, 1.55]], [0.3, 0.24, 0.18], 7, { col }); B.sphere('copper', 0, 3.05, 1.85, 0.2, 0.22, 0.42, 8, 5, { col: dark });
  B.tube('copper', [[0, 3.1, 1.55], [0, 2.7, 1.2], [0, 2.2, 1.0]], [0.08, 0.13, 0.12], 5, { col: dark });
  for (const [lx, lz, up] of [[-0.3, 1.05, 1], [0.3, 1.0, 0.3], [-0.3, -0.95, 0], [0.3, -1.0, 0]]) { const ex = up === 1 ? 0.7 : up === 0.3 ? 0.35 : 0; B.tube('copper', [[lx, 1.1, lz], [lx, 0.55, lz + 0.2 + ex * 0.3], [lx, up === 1 ? 0.95 : 0.0, lz + 0.35 + ex]], [0.16, 0.1, 0.07], 6, { col }); }
  B.tube('copper', [[0, 1.6, -1.2], [0, 1.2, -1.7], [0, 0.4, -1.8]], [0.12, 0.2, 0.1], 5, { col: dark });
  B.pop();
}
export function brandenburgGate(B, ctx) {
  const rng = ctx.rng; const bk = 's_sandstone'; const sand = 0xfff6e2; const W = 65.5, D = 11, H = 13.2;
  // plaza
  B.quad('g_paving', [-110, 0.01, 90], [110, 0.01, 90], [110, 0.01, -110], [-110, 0.01, -110], [-27.5, 22.5, 27.5, -27.5], 0xffffff, [0, 1, 0]);
  // plinth steps + floor
  B.box(bk, 0, 0.75, 0, W + 2, 1.5, D + 2, { col: sand, mpt: 4 }); const y0 = 1.5;
  // rear/front columns
  const xs = [-26.2, -15.7, -5.3, 5.3, 15.7, 26.2]; for (const z of [-D / 2 + 1.4, D / 2 - 1.4]) for (const x of xs) column(B, bk, x, y0, z, 0.88, H, sand, { mpt: 4 });
  // side walls and cross walls of the gate (pylons)
  for (const sx of [-1, 1]) { B.box(bk, sx * 31.6, y0 + H / 2, 0, 3.0, H, D - 1.4, { col: sand, mpt: 4 }); }
  for (const x of [-20.9, -10.5, 0, 10.5, 20.9]) { if (Math.abs(x) < 1) continue; B.box(bk, x, y0 + H / 2, 0, 1.0, H, D - 4, { col: sand, mpt: 4 }); } // piers between passages
  // entablature (architrave + frieze) + attic + cornice
  B.box(bk, 0, y0 + H + 0.7, 0, W - 1, 1.4, D, { col: sand, mpt: 4 }); B.box(bk, 0, y0 + H + 2.1, 0, W - 1.4, 1.5, D - 0.4, { col: mix(sand, 0xb0a07c, 0.2), mpt: 4 });
  for (let i = 0; i < 40; i++) { const x = -W / 2 + 2 + i * (W - 4) / 39; B.box(bk, x, y0 + H + 2.1, D / 2 - 0.05, 0.55, 1.1, 0.14, { col: mix(sand, 0x8a7a5a, 0.35), mpt: 1 }); B.box(bk, x, y0 + H + 2.1, -D / 2 + 0.05, 0.55, 1.1, 0.14, { col: mix(sand, 0x8a7a5a, 0.35), mpt: 1 }); }
  B.box(bk, 0, y0 + H + 3.15, 0, W + 0.6, 0.6, D + 0.6, { col: sand, mpt: 4 }); B.box(bk, 0, y0 + H + 5.7, 0, W - 5, 4.6, D - 2, { col: sand, mpt: 4 });
  for (let i = 0; i < 6; i++) { const x = -W / 2 + 8 + i * (W - 16) / 5; B.box(bk, x, y0 + H + 5.9, D / 2 - 0.95, 6.4, 2.6, 0.12, { col: mix(sand, 0x9a8a6a, 0.3), mpt: 2 }); }
  B.box(bk, 0, y0 + H + 8.2, 0, W - 4.5, 0.5, D - 1.5, { col: sand, mpt: 4 });
  // quadriga on the attic
  const qy = y0 + H + 8.45; B.box(bk, 0, qy + 0.5, 0, 9, 1.0, 5.4, { col: sand, mpt: 4 }); const green = 0x6fa08c;
  for (let i = 0; i < 4; i++) horse(B, -2.4 + i * 1.6, qy + 1.0, 1.0, 0, rng, green);
  B.box('copper', 0, qy + 2.1, -1.6, 3.2, 1.0, 2.2, { col: green }); B.push(0, qy + 1.4, -1.6, 0, 1, 1, 1, 0, PI / 2); for (const sy of [-1.65, 1.65]) B.cyl('copper', 0, sy - 0.05, 0, 0.9, 0.9, 0.1, 14, { col: mul(green, 0.9), cap: true }); B.pop();
  B.cyl('copper', 0, qy + 2.7, -1.6, 0.34, 0.5, 2.2, 7, { col: green }); B.sphere('copper', 0, qy + 4.95, -1.6, 0.26, 0.3, 0.26, 6, 4, { col: green }); B.quad('copper', [-2.2, qy + 3.9, -1.7], [2.2, qy + 3.9, -1.7], [1.6, qy + 5.4, -1.8], [-1.6, qy + 5.4, -1.8], [0, 0, 1, 1], mul(green, 0.9)); B.quad('copper', [2.2, qy + 3.9, -1.7], [-2.2, qy + 3.9, -1.7], [-1.6, qy + 5.4, -1.8], [1.6, qy + 5.4, -1.8], [0, 0, 1, 1], mul(green, 0.9)); B.cyl('copper', 0, qy + 3.4, 0.0, 0.04, 0.04, 2.8, 5, { col: green });
  // front steps in the central passage
  stairs(B, bk, 0, 0, D / 2 + 3, 10, 3, 1.5, 4, 0xf0e4c4);
  // side pavilions (Torhaeuser): small temples with 6 columns
  for (const sx of [-1, 1]) { B.push(sx * 44, 0, -4); B.box(bk, 0, 0.8, 0, 15, 1.6, 9, { col: sand, mpt: 4 }); for (let i = 0; i < 6; i++) column(B, bk, -5.8 + i * 2.3, 1.6, 3.4, 0.55, 7.0, sand); for (let i = 0; i < 6; i++) column(B, bk, -5.8 + i * 2.3, 1.6, -3.4, 0.55, 7.0, sand); B.box(bk, 0, 1.6 + 7.5, 0, 14.6, 1.2, 9, { col: sand, mpt: 4 }); B.box(bk, 0, 4.6, 0, 11, 6.2, 5.6, { col: sand, mpt: 4 }); pediment(B, bk, 14, 2.6, 8.6, sand, 4, 10.1); B.pop(); }
  // linden trees + lamps + paved avenue
  for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) { P.tree(B, 'linden', sx * 14, -26 - i * 14, 1.1, i * 3 + (sx > 0 ? 7 : 1)); P.lampPost(B, sx * 9, -22 - i * 14, PI, { style: 'ornate', h: 5 }); }
  for (let i = 0; i < 4; i++) P.tree(B, 'linden', -60 + i * 14, 45, 1.0, i + 20), P.tree(B, 'linden', 36 + i * 14, 45, 1.0, i + 40);
  return {};
}

export function tvTower(B, ctx) {
  // concrete shaft
  const shaft = [[16, 0], [14.2, 6], [11.0, 18], [8.0, 40], [6.0, 75], [4.9, 110], [4.0, 150], [3.5, 185], [3.2, 200], [6.2, 204], [9.0, 207]];
  B.lathe('s_concrete2', 0, 0, 0, shaft, 20, { col: 0xd8d4cc, mpt: 5 }); // lower shaft + flare under the sphere
  const R = 16.0; const cy = 212; B.sphere('s_steel', 0, cy, 0, R, R, R, 28, 18, { col: 0xffffff, uvk: [21, 10], t0: 0.0, t1: Math.PI });
  // belt rings & upper cones
  B.lathe('s_concrete2', 0, 0, 0, [[9.0, 207], [9.0, 209]], 20, { col: 0xc8c4bc }); B.cyl('s_concrete2', 0, 226.5, 0, 6.0, 3.3, 7.5, 18, { col: 0xd0ccc4, mpt: 5 }); B.cyl('s_concrete2', 0, 234, 0, 3.3, 3.0, 22, 14, { col: 0xd8d4cc, mpt: 5 });
  B.cyl('s_concrete2', 0, 254, 0, 3.0, 5.2, 3.4, 14, { col: 0xc0bcb4 }); B.cyl('s_concrete2', 0, 257.4, 0, 5.2, 3.2, 3.0, 14, { col: 0xb8b4ac }); B.cyl('metal', 0, 260.4, 0, 3.2, 2.2, 6, 12, { col: 0xa8aaae });
  // antenna mast with red/white bands
  let yy = 266; const bands = 12; for (let i = 0; i < bands; i++) { const r0 = 2.2 - i * 0.14, r1 = r0 - 0.14; B.cyl('metal', 0, yy, 0, r0, r1, 8.6, 10, { col: i % 2 ? 0xf2f2f0 : 0xc82a1e }); yy += 8.6; } B.cyl('metal', 0, yy, 0, 0.5, 0.05, 8, 6, { col: 0xc82a1e }); B.sphere('glow', 0, yy + 8, 0, 0.5, 0.5, 0.5, 6, 4, { col: 0xff3020 });
  // base pavilion & plaza
  B.quad('g_paving', [-150, 0.01, 150], [150, 0.01, 150], [150, 0.01, -150], [-150, 0.01, -150], [-37.5, 37.5, 37.5, -37.5], 0xffffff, [0, 1, 0]);
  B.box('s_concrete2', 0, 4, 28, 60, 8, 22, { col: 0xc4c0b8, mpt: 5 }); B.box('glass', 0, 3, 39.1, 50, 5, 0.3, { col: 0x4a6a80 }); B.box('s_concrete2', 0, 8.3, 28, 62, 0.6, 24, { col: 0xb0aca4, mpt: 5 }); B.box('s_concrete2', -22, 3, -20, 30, 6, 20, { col: 0xc4c0b8, mpt: 5 });
  // ring of lamps & trees around
  for (let i = 0; i < 26; i++) { const a = (i / 26) * PI * 2; P.lampPost(B, Math.cos(a) * 48, Math.sin(a) * 48, a, { style: 'ornate', h: 5 }); if (i % 2) P.tree(B, 'linden', Math.cos(a) * 62, Math.sin(a) * 62, 1.2, i + 3); }
  return { height: 368 };
}
