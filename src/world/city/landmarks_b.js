// Landmarks B: Moscow (Red Square / Kremlin / cathedral), New York towers, New Delhi gate, Cebu skyline (hero towers).
import * as THREE from 'three';
import { RNG, smoothstep, clamp } from '../../engine/common.js';
import { fbm2 } from '../../engine/proc.js';
import { Builder, rgb, mul, mix, jitter } from './builder.js';
import { STYLES } from './styles.js';
import { emitBuilding } from './buildings.js';
import { createCityBlock } from './block.js';
import { createSkyline } from './skyline.js';
import * as P from './props.js';
import { column, archWall, pediment, onionDome, halfDome, pyramid, balustrade, stairs, crenellations, flagPole } from './arch.js';

const PI = Math.PI;
const SNOWW = 0xf2f6fa;

// ---------------------------------------------------------------------------------------------- Moscow
function kremlinTower(B, x, z, o, snow) {
  const brick = 's_redbrick', trim = 0xf4f0e6; const W = o.w ?? 12, H = o.h ?? 26; const sp = snow > 0.4 ? mix(0x5a9a82, SNOWW, snow * 0.7) : 0xffffff;
  B.push(x, 0, z, o.yaw || 0);
  if (o.round) { B.cyl(brick, 0, 0, 0, W * 0.5, W * 0.46, H, 16, { col: 0xffffff, mpt: 2 }); B.cyl('s_plaster', 0, H, 0, W * 0.56, W * 0.56, 1.2, 16, { col: trim, mpt: 3 }); for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2; B.push(Math.cos(a) * W * 0.54, H + 1.2, Math.sin(a) * W * 0.54, -a + PI / 2); B.box(brick, 0, 0.7, 0, 1.4, 1.4, 0.9, { col: 0xffffff, mpt: 1.5 }); B.pop(); } B.cyl('s_copper', 0, H + 1.2, 0, W * 0.5, 0.4, o.spire ?? 20, 16, { col: sp, flat: true, mpt: 4 }); B.sphere('gold', 0, H + 1.2 + (o.spire ?? 20), 0, 0.5, 0.5, 0.5, 6, 4, { col: 0xe8c050 }); B.pop(); return; }
  B.box(brick, 0, H / 2, 0, W, H, W, { col: 0xffffff, mpt: 2 });
  // arched windows band + white trim belts
  for (let s = 0; s < 4; s++) { B.push(0, 0, 0, s * PI / 2); B.box('s_plaster', 0, H * 0.62, W / 2 + 0.05, W * 0.62, 5.2, 0.15, { col: trim, mpt: 3 }); for (const sx of [-1, 1]) B.box('plain', sx * W * 0.16, H * 0.62, W / 2 + 0.16, W * 0.16, 3.6, 0.05, { col: 0x15110d }); B.box('s_plaster', 0, H * 0.35, W / 2 + 0.05, W + 0.1, 0.6, 0.18, { col: trim, mpt: 3 }); B.pop(); }
  B.box('s_plaster', 0, H + 0.3, 0, W + 1.6, 0.6, W + 1.6, { col: trim, mpt: 3 }); B.box(brick, 0, H + 1.5, 0, W + 0.4, 1.8, W + 0.4, { col: 0xffffff, mpt: 2 }); // machicolation band
  crenellations(B, brick, -W / 2 - 0.9, W / 2 + 0.9, W / 2 + 0.9, W / 2 + 0.9, H + 2.4, 0xffffff, { swallow: true, w: 1.5, h: 1.4, d: 0.9, gap: 0.8 }); crenellations(B, brick, W / 2 + 0.9, W / 2 + 0.9, W / 2 + 0.9, -W / 2 - 0.9, H + 2.4, 0xffffff, { swallow: true, w: 1.5, h: 1.4, d: 0.9, gap: 0.8 }); crenellations(B, brick, W / 2 + 0.9, -W / 2 - 0.9, -W / 2 - 0.9, -W / 2 - 0.9, H + 2.4, 0xffffff, { swallow: true, w: 1.5, h: 1.4, d: 0.9, gap: 0.8 }); crenellations(B, brick, -W / 2 - 0.9, -W / 2 - 0.9, -W / 2 - 0.9, W / 2 + 0.9, H + 2.4, 0xffffff, { swallow: true, w: 1.5, h: 1.4, d: 0.9, gap: 0.8 });
  let y = H + 2.4;
  if (o.stages) for (let k = 0; k < o.stages; k++) { const w2 = W * (0.78 - k * 0.2), h2 = (o.stageH ?? 8) * (1 - k * 0.1); B.box(brick, 0, y + h2 / 2, 0, w2, h2, w2, { col: 0xffffff, mpt: 2 }); for (let s = 0; s < 4; s++) { B.push(0, y, 0, s * PI / 2); B.box('plain', 0, h2 * 0.5, w2 / 2 + 0.03, w2 * 0.28, h2 * 0.55, 0.05, { col: 0x15110d }); B.pop(); } B.box('s_plaster', 0, y + h2 + 0.25, 0, w2 + 0.8, 0.5, w2 + 0.8, { col: trim, mpt: 3 }); y += h2 + 0.5; }
  const wB = W * (o.stages ? 0.42 : 0.7);
  B.cyl('s_whitewash', 0, y, 0, wB * 0.62, wB * 0.62, o.drum ?? 6, 8, { col: trim, flat: true, mpt: 3, rot: PI / 8 }); y += o.drum ?? 6; for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; B.box('plain', Math.cos(a) * wB * 0.62, y - (o.drum ?? 6) * 0.5, Math.sin(a) * wB * 0.62, 0.05, 2.4, 0.9, { col: 0x15110d, }); }
  B.cyl('s_copper', 0, y, 0, wB * 0.74, 0.35, o.spire ?? 18, 8, { col: sp, flat: true, mpt: 4, rot: PI / 8 }); B.cyl('gold', 0, y + (o.spire ?? 18) - 0.5, 0, 0.3, 0.15, 3.0, 6, { col: 0xe8c050 }); B.sphere('gold', 0, y + (o.spire ?? 18) + 2.6, 0, 0.7, 0.7, 0.7, 8, 5, { col: 0xe8c050 });
  if (o.clock) { y = H * 0.74; for (let s = 0; s < 4; s++) { B.push(0, 0, 0, s * PI / 2); B.push(0, y, W / 2 + 0.3, 0, 1, 1, 1, PI / 2, 0); B.cyl('plain', 0, 0, 0, 3.0, 3.0, 0.2, 24, { col: 0xf8f4ec }); B.cyl('plain', 0, 0.08, 0, 3.15, 3.15, 0.08, 24, { col: 0x2a2018, capBottom: false }); B.pop(); B.box('plain', 0, y + 0.1, W / 2 + 0.45, 0.16, 1.9, 0.06, { col: 0x101010 }); B.push(0, y, W / 2 + 0.46, 0, 1, 1, 1, 0, 0.9); B.box('plain', 0, 1.3, 0, 0.18, 2.5, 0.06, { col: 0x101010 }); B.pop(); B.pop(); } }
  B.pop();
}
function churchGold(B, x, z, w, d, h, yaw = 0) { // white single-nave cathedral with five gold domes
  B.push(x, 0, z, yaw); B.box('s_whitewash', 0, h / 2, 0, w, h, d, { col: 0xf4f0e4, mpt: 4 }); B.box('s_plaster', 0, h + 0.3, 0, w + 0.8, 0.6, d + 0.8, { col: 0xe8e0cc, mpt: 3 });
  for (let i = 0; i < 4; i++) { const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1; B.cyl('s_whitewash', sx * w * 0.28, h, sz * d * 0.28, w * 0.1, w * 0.1, 4.5, 10, { col: 0xf4f0e4, mpt: 3 }); onionDome(B, 's_dome', sx * w * 0.28, h + 4.5, sz * d * 0.28, w * 0.12, w * 0.2, 3, { segs: 12 }); }
  B.cyl('s_whitewash', 0, h, 0, w * 0.17, w * 0.17, 8, 12, { col: 0xf4f0e4, mpt: 3 }); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; B.box('plain', Math.cos(a) * w * 0.17, h + 5, Math.sin(a) * w * 0.17, 0.05, 3.0, 0.8, { col: 0x15110d }); } onionDome(B, 's_dome', 0, h + 8, 0, w * 0.19, w * 0.34, 3, { segs: 16 });
  for (let s = 0; s < 4; s++) { B.push(0, 0, 0, s * PI / 2); const ww = (s % 2 ? d : w); for (let i = -2; i <= 2; i++) B.box('plain', i * ww * 0.18, h * 0.55, (s % 2 ? w : d) / 2 + 0.04, 1.1, 5.5, 0.06, { col: 0x15110d }); B.pop(); }
  B.pop();
}
function ivanTower(B, x, z, snow) {
  B.push(x, 0, z); let y = 0; const tiers = [[12, 28], [10, 16], [8.4, 12], [7.2, 10]]; for (const [w, h] of tiers) { B.cyl('s_whitewash', 0, y, 0, w * 0.54, w * 0.52, h, 8, { col: 0xf6f2e8, flat: true, mpt: 3, rot: PI / 8 }); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; B.box('plain', Math.cos(a) * w * 0.5, y + h * 0.55, Math.sin(a) * w * 0.5, 0.05, h * 0.38, 1.1, { col: 0x15110d }); } B.cyl('s_plaster', 0, y + h, 0, w * 0.6, w * 0.6, 0.6, 8, { col: 0xe8e0cc, rot: PI / 8 }); y += h + 0.6; }
  B.cyl('s_whitewash', 0, y, 0, 3.2, 3.0, 6, 10, { col: 0xf6f2e8 }); onionDome(B, 's_dome', 0, y + 6, 0, 3.6, 7.5, 3, { segs: 14 }); B.pop();
}
function stBasil(B, x, z, o = {}) {
  B.push(x, 0, z, o.yaw || 0); const colors = [0xd8503a, 0x3a9a5a, 0xe8d070, 0x4a7ac8, 0xf4f0e6, 0xe08a3a, 0xc83a6a, 0x4ab0b0]; const rng = new RNG(5);
  B.box('s_redbrick', 0, 3, 0, 52, 6, 52, { col: 0xffffff, mpt: 2 }); for (let s = 0; s < 4; s++) { B.push(0, 0, 0, s * PI / 2); stairs(B, 's_redbrick', 0, 0, 29, 12, 4, 6, 8, 0xffffff); B.pop(); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; const big = k % 2 === 0; const r = big ? 5.4 : 4.0; const h = big ? 17 + (k % 4) * 1.2 : 13 + (k % 3); const rad = 18.5; const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad;
    B.cyl('s_plaster', cx, 6, cz, r * 1.35, r * 1.35, 3, 12, { col: colors[(k + 2) % 8], mpt: 3 }); B.cyl('s_plaster', cx, 9, cz, r, r * 0.96, h - 3, 12, { col: colors[k % 8], mpt: 3 });
    for (let i = 0; i < 8; i++) { const aa = (i / 8) * PI * 2; B.box('plain', cx + Math.cos(aa) * r * 0.97, 6 + h * 0.65, cz + Math.sin(aa) * r * 0.97, 0.05, 2.6, 0.7, { col: 0x15110d }); }
    B.cyl('s_plaster', cx, 6 + h, cz, r * 1.05, r * 0.7, 1.0, 12, { col: 0xf4f0e6 }); onionDome(B, 's_dome', cx, 7 + h, cz, r * 0.95, r * 1.9, k % 4, { segs: 16 }); }
  // central tent tower
  B.cyl('s_plaster', 0, 6, 0, 8.8, 8.8, 14, 8, { col: 0xf4f0e6, mpt: 3, flat: true, rot: PI / 8 }); B.cyl('s_redbrick', 0, 20, 0, 8.8, 2.6, 24, 8, { col: 0xffffff, mpt: 3, flat: true, rot: PI / 8 }); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; B.cyl('s_whitewash', Math.cos(a) * 5.0, 26, Math.sin(a) * 5.0, 0.5, 0.0, 3.5, 5, { col: 0xf4f0e6 }); }
  B.cyl('s_plaster', 0, 44, 0, 2.4, 2.4, 5, 8, { col: 0xf0ece0 }); onionDome(B, 's_dome', 0, 49, 0, 2.7, 6.5, 0, { segs: 16 });
  B.pop();
}
export function kremlin(B, ctx) {
  const rng = ctx.rng; const snow = ctx.snow || 0; const wallH = 13; const wall = 's_redbrick';
  const plaza = snow > 0.4 ? 'g_snow' : 'g_cobble'; const pt = snow > 0.4 ? 6 : 3;
  B.quad(plaza, [-300, 0.02, 120], [300, 0.02, 120], [300, 0.02, -260], [-300, 0.02, -260], [-300 / pt, 120 / pt, 300 / pt, -260 / pt], snow > 0.4 ? 0xf4f6f8 : 0xffffff, [0, 1, 0]);
  // wall along z=-62 with towers; crenellations
  const wz = -62, x0 = -260, x1 = 260; B.box(wall, 0, wallH / 2, wz, x1 - x0, wallH, 5.2, { col: 0xffffff, mpt: 2 }); B.box('s_plaster', 0, wallH - 0.2, wz + 2.5, x1 - x0, 0.4, 0.3, { col: 0xf0ece0, mpt: 3 });
  crenellations(B, wall, x0, wz + 2.0, x1, wz + 2.0, wallH, 0xffffff, { swallow: true, w: 1.8, h: 2.0, d: 1.0, gap: 0.9 }); crenellations(B, wall, x0, wz - 2.0, x1, wz - 2.0, wallH, 0xffffff, { swallow: true, w: 1.8, h: 2.0, d: 1.0, gap: 0.9 });
  if (snow > 0.4) B.box('plain', 0, wallH + 0.03, wz, x1 - x0, 0.06, 4.2, { col: SNOWW });
  // towers on the wall (clock tower at centre)
  kremlinTower(B, 0, wz, { w: 15, h: 38, stages: 2, stageH: 9, drum: 7, spire: 22, clock: true }, snow); kremlinTower(B, 82, wz, { w: 11, h: 24, drum: 5, spire: 18 }, snow); kremlinTower(B, -82, wz, { w: 11, h: 26, stages: 1, stageH: 7, drum: 5, spire: 20 }, snow);
  kremlinTower(B, 160, wz, { w: 10, h: 22, drum: 4.5, spire: 16 }, snow); kremlinTower(B, -160, wz, { w: 10, h: 22, drum: 4.5, spire: 16 }, snow); kremlinTower(B, 235, wz, { round: true, w: 15, h: 28, spire: 20 }, snow); kremlinTower(B, -235, wz, { round: true, w: 15, h: 28, spire: 20 }, snow);
  // Kremlin interior: cathedral cluster, bell tower, palace
  churchGold(B, -30, -122, 26, 32, 15); churchGold(B, 12, -140, 22, 26, 17, PI / 2); churchGold(B, -62, -150, 20, 24, 14); ivanTower(B, -10, -110, snow);
  const rc = { S: STYLES.moscow, snow, fires: [], night: 0 }; emitBuilding(B, { x: 100, z: -150, yaw: 0, y: 0, w: 120, d: 34, tiers: [{ w: 120, d: 34, ox: 0, oz: 0, floors: 3, facade: 'altbau', fh: 4.2 }], shop: null, tint: 0xf0d890, roof: { type: 'flat', props: ['chimney'], parapetH: 1.2 }, seed: 7, cornice: 0xf8f4ec }, 0, rc);
  emitBuilding(B, { x: -150, z: -170, yaw: 0, y: 0, w: 90, d: 30, tiers: [{ w: 90, d: 30, ox: 0, oz: 0, floors: 3, facade: 'altbau', fh: 4.4 }], shop: null, tint: 0xe0d0b0, roof: { type: 'tile_hip', props: [], pitch: 0.5, dormers: 0, col: 0xffffff }, seed: 8, cornice: 0xf8f4ec }, 0, rc);
  B.quad(snow > 0.4 ? 'g_snow' : 'g_paving', [-260, 0.03, -62], [260, 0.03, -62], [260, 0.03, -320], [-260, 0.03, -320], [0, 0, 60, 60], snow > 0.4 ? 0xf4f6f8 : 0xffffff, [0, 1, 0]);
  // mausoleum in front of the wall
  B.box('s_redbrick', 0, 1.0, -53, 26, 2, 11, { col: 0x8a2a22, mpt: 3 }); B.box('s_redbrick', 0, 3.4, -53, 22, 3, 9, { col: 0x7a2420, mpt: 3 }); B.box('s_redbrick', 0, 5.7, -53, 18, 2.6, 7, { col: 0x6a2018, mpt: 3 }); B.box('plain', 0, 7.5, -53, 14, 1.2, 5, { col: 0x1a1a1c }); B.box('plain', 0, 1.6, -47.4, 6, 1.8, 0.1, { col: 0x101012 });
  // St Basil's at the south-east end; GUM-like arcade building on the south side
  stBasil(B, 215, -8, { yaw: -PI / 2 }); emitBuilding(B, { x: 0, z: 100, yaw: PI, y: 0, w: 250, d: 38, tiers: [{ w: 250, d: 38, ox: 0, oz: 0, floors: 4, facade: 'altbau', fh: 4.4 }], shop: { facade: 'shop_eu', fh: 5.2, sides: [] }, tint: 0xe8c8b8, roof: { type: 'tile_hip', props: ['chimney'], pitch: 0.35, dormers: 0, col: 0xffffff }, seed: 11, cornice: 0xf6f0e8 }, 0, rc);
  for (const sx of [-110, -40, 40, 110]) { B.box('s_plaster', sx, 14, 80.5, 14, 28, 6, { col: 0xf0e4d8, mpt: 3 }); B.cyl('s_copper', sx, 28, 80.5, 5.5, 0.3, 11, 8, { col: snow > 0.4 ? mix(0x5a9a82, SNOWW, 0.7) : 0xffffff, flat: true, mpt: 3 }); }
  // lamps, trees, snow patches
  for (let x = -250; x <= 250; x += 24) { P.lampPost(B, x, -44, 0, { style: 'ornate', h: 5.4 }); P.lampPost(B, x + 12, 70, PI, { style: 'ornate', h: 5.4 }); }
  for (let i = 0; i < 18; i++) P.tree(B, snow > 0.4 ? 'bare' : 'birch', -250 + i * 28, -76 + rng.range(-3, 3), 1.2, i + 5, { bare: snow > 0.4, snow: snow > 0.4 ? 1 : 0 });
  for (let i = 0; i < 14; i++) P.tree(B, 'spruce', -250 + i * 38, -88, 1.3, i + 50, { snow: snow > 0.4 ? 1 : 0 });
  return { anchors: [] };
}

// ---------------------------------------------------------------------------------------------- hero towers (NYC / Cebu)
export function heroTower(B, x, z, o = {}) {
  const rng = new RNG(o.seed || 1); const kind = o.kind || 'deco'; const W = o.w || 44; const fh = o.fh || 4.0; const rc = { S: STYLES.manhattan, snow: 0, fires: [], night: 0 };
  let tiers, facade = o.facade || (kind === 'glass' ? 'glass' : kind === 'deco' ? 'deco' : 'office');
  if (kind === 'deco') tiers = [[1, 10], [0.82, 12], [0.64, 14], [0.46, 12], [0.3, 8]]; else if (kind === 'setback') tiers = [[1, 18], [0.84, 14], [0.68, 12], [0.52, 10], [0.36, 8]]; else if (kind === 'glass') tiers = [[1, 16], [0.94, 16], [0.86, 16], [0.78, 16], [0.7, 16], [0.62, 14]]; else if (kind === 'pyramid') tiers = [[1, 22], [0.9, 12], [0.8, 8]]; else tiers = [[1, 30]];
  const sc = (o.floorScale ?? 1);
  const spec = { x, z, yaw: 0, y: 0.15, w: W, d: W * (o.aspect || 1), tiers: tiers.map(([f, n]) => ({ w: W * f, d: W * f * (o.aspect || 1), ox: 0, oz: 0, floors: Math.max(2, Math.round(n * sc)), facade: kind === 'deco' ? 'deco' : (f > 0.9 && kind === 'setback' ? 'office' : facade), fh })), shop: { facade: 'shop_us', fh: 5.2, sides: ['right', 'left', 'back'] }, tint: o.tint ?? (kind === 'glass' ? 0xa8d4e0 : kind === 'deco' ? 0xdcd4bc : 0xd8d6d0), roof: { type: 'flat', props: [], parapet: false }, seed: o.seed || 3, cornice: kind === 'deco' ? 0xcfc6b0 : null };
  const info = emitBuilding(B, spec, 0, rc); const top = info.top; const lastW = W * tiers[tiers.length - 1][0];
  B.push(x, top + 0.15, z);
  if (kind === 'deco') { // sunburst crown: stacked terraced arcs with lit triangular windows + needle
    for (let k = 0; k < 7; k++) { const r0 = lastW * 0.52 * (1 - k * 0.12), h = 5.4; B.cyl('metal', 0, k * h * 0.9, 0, r0, r0 * 0.84, h, 18, { col: 0xdfe3e7, flat: true }); const n = 16; for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2 + (k % 2) * PI / n; const rr = r0 * 0.9; const tx = -Math.sin(a) * 0.75, tz = Math.cos(a) * 0.75; const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, cy = k * h * 0.9 + 1.3; B.tri('glow', [cx - tx, cy, cz - tz], [cx + tx, cy, cz + tz], [cx, cy + h * 0.6, cz], 0xffe0a0); B.tri('glow', [cx + tx, cy, cz + tz], [cx - tx, cy, cz - tz], [cx, cy + h * 0.6, cz], 0xffe0a0); } }
    B.cyl('metal', 0, 7 * 4.9, 0, 0.9, 0.08, 46, 6, { col: 0xe8ecef }); B.sphere('glow', 0, 7 * 4.9 + 46, 0, 0.4, 0.4, 0.4, 6, 4, { col: 0xff3020 }); for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { B.push(sx * lastW * 0.62, -3, sz * lastW * 0.62, Math.atan2(sx, sz)); B.box('metal', 0, 0, 0, 1.2, 3.4, 4.0, { col: 0xdfe3e7 }); B.pop(); }
  } else if (kind === 'setback') {
    B.cyl('glow', 0, 0.05, 0, lastW * 0.5 + 0.5, lastW * 0.5 + 0.5, 0.6, 20, { col: 0xffd8a0, cap: false }); B.cyl('metal', 0, 0, 0, lastW * 0.22, lastW * 0.12, 18, 12, { col: 0xd8dce0 }); B.cyl('metal', 0, 18, 0, lastW * 0.1, 0.4, 18, 8, { col: 0xd8dce0 });
    let yy = 36; for (let i = 0; i < 10; i++) { B.cyl('metal', 0, yy, 0, 1.1 - i * 0.07, 1.04 - i * 0.07, 6, 8, { col: i % 2 ? 0xf2f2f0 : 0xc82a1e }); yy += 6; } B.sphere('glow', 0, yy + 0.4, 0, 0.5, 0.5, 0.5, 6, 4, { col: 0xff3020 });
  } else if (kind === 'glass') { B.cyl('metal', 0, 0, 0, lastW * 0.46, lastW * 0.2, 36, 4, { col: 0xc8d4dc, flat: true, rot: PI / 4 }); B.cyl('metal', 0, 36, 0, 0.9, 0.08, 40, 6, { col: 0xe0e4e8 }); B.sphere('glow', 0, 76, 0, 0.4, 0.4, 0.4, 6, 4, { col: 0xff3020 }); }
  else if (kind === 'pyramid') { pyramid(B, 's_copper', 0, 0, 0, lastW + 1, lastW * (o.aspect || 1) + 1, lastW * 0.8, 0x9ad8c0, 4); B.cyl('metal', 0, lastW * 0.8, 0, 0.4, 0.06, 24, 6, { col: 0xe0e4e8 }); B.sphere('glow', 0, lastW * 0.8 + 24, 0, 0.4, 0.4, 0.4, 6, 4, { col: 0xff3020 }); }
  B.pop();
  return top + 60;
}

export function newyorkTowers(B, ctx) {
  const rng = ctx.rng; const blk = createCityBlock('manhattan', { seed: 4, w: 270, d: 270, density: 1, reserve: [4, 0, 8] });
  ctx.extra.push(blk); const cells = blk.layout.cells; const heights = [];
  const c = (i) => { const k = cells[i]; return [(k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2]; };
  heights.push(heroTower(B, ...c(4), { kind: 'deco', w: 46, seed: 21 })); heights.push(heroTower(B, ...c(0), { kind: 'setback', w: 50, seed: 22, tint: 0xd0cec6, fh: 3.9 })); heights.push(heroTower(B, ...c(8), { kind: 'glass', w: 30, seed: 23, floorScale: 1.2, fh: 3.9 }));
  // Hudson river to the west, piers
  B.quad('water', [-2500, -0.25, 150], [-160, -0.25, 150], [-160, -0.25, -2200], [-2500, -0.25, -2200], [0, 0, 1, 1], [0.05, 0.12, 0.17], [0, 1, 0]);
  B.quad('g_concrete', [-165, 0.02, 160], [-135, 0.02, 160], [-135, 0.02, -160], [-165, 0.02, -160], [0, 0, 8, 80], 0xdcd8d0, [0, 1, 0]);
  for (let i = 0; i < 4; i++) { B.box('g_concrete', -190 - 0, 0.0, 80 - i * 60, 70, 0.8, 9, { col: 0xdcd8d0 }); for (let k = 0; k < 8; k++) B.cyl('plain', -222 + k * 9, -3, 80 - i * 60 + 4.7, 0.3, 0.3, 4, 6, { col: 0x4a3a2c }); }
  // far skyline ring with the river gap
  const sk = createSkyline('manhattan', { kind: 'ring', radius: 1000, count: 110, seed: 5, haze: 0xb8c8d8, hazeAmount: 0.55, minH: 40, maxH: 280 }); ctx.extra.push(sk);
  return { height: Math.max(...heights) };
}

// ---------------------------------------------------------------------------------------------- Delhi
export function delhiGate(B, ctx) {
  const rng = ctx.rng; const bk = 's_redsand'; const red = 0xf4e4dc; const W = 28, H = 42, D = 20;
  // plinth tiers + gate body with arch
  for (let i = 0; i < 3; i++) B.box(bk, 0, 0.5 + i * 1.0, 0, 64 - i * 8, 1.0, 64 - i * 8, { col: red, mpt: 4 }); const y0 = 3.0;
  B.push(0, y0, 0); const t = 4.5;
  archWall(B, bk, W, H - 8, t, [{ cx: 0, w: 11.5, h: 26 }], red, 4, 0, 0, D / 2 - t / 2); B.push(0, 0, 0, PI); archWall(B, bk, W, H - 8, t, [{ cx: 0, w: 11.5, h: 26 }], red, 4, 0, 0, D / 2 - t / 2); B.pop();
  for (const sx of [-1, 1]) B.box(bk, sx * (W / 2 - t / 2), (H - 8) / 2, 0, t, H - 8, D - 2 * t + 0.2, { col: red, mpt: 4 }); B.box(bk, 0, 18, 0, 12, 36, D - 2 * t + 0.1, { col: 0x0a0a0a, top: false }); // inner (arch passage walls dark)
  B.box(bk, 0, 26 + 6, 0, 11.5, 12, D - 2 * t + 0.4, { col: red, mpt: 4 }); // soffit above the arch
  // upper cornices and panels
  B.box(bk, 0, H - 8 + 0.6, 0, W + 2.4, 1.2, D + 2.4, { col: red, mpt: 4 }); B.box(bk, 0, H - 8 + 2.3, 0, W + 1.0, 2.2, D + 1.0, { col: mix(red, 0xd8a890, 0.3), mpt: 4 }); B.box(bk, 0, H - 8 + 4.6, 0, W + 2.4, 1.4, D + 2.4, { col: red, mpt: 4 });
  for (let s = 0; s < 2; s++) { B.push(0, 0, 0, s * PI); B.box('plain', 0, H - 8 + 2.3, D / 2 + 0.55, W - 6, 1.6, 0.06, { col: 0x4a2a1e }); for (const sx of [-1, 1]) B.box(bk, sx * (W / 2 - 3), 14, D / 2 + 0.2, 2.8, 20, 0.5, { col: 0xe8d0c0, mpt: 4 }); B.pop(); }
  B.cyl('metal', 0, H - 8 + 5.3, 0, 3.4, 2.4, 1.0, 14, { col: 0x3a3028 }); B.cyl('glow', 0, H - 8 + 6.2, 0, 2.6, 0.2, 0.3, 12, { col: 0xff8a2a });
  B.pop();
  // chhatri (canopy pavilion) behind the gate
  B.push(0, 0, -90); B.box(bk, 0, 0.8, 0, 22, 1.6, 22, { col: red, mpt: 4 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { column(B, bk, sx * 8, 1.6, sz * 8, 0.9, 10, red); } B.box(bk, 0, 12.2, 0, 20, 1.4, 20, { col: red, mpt: 4 }); B.cyl(bk, 0, 13, 0, 8, 7.2, 1.4, 12, { col: red }); halfDome(B, bk, 0, 14.2, 0, 7.4, red, null, { squash: 0.9 }); B.cyl('gold', 0, 20.8, 0, 0.3, 0.2, 2.4, 6, { col: 0xe8c050 }); B.pop();
  // Kartavya-path avenue: central gravel road, lawns, canals, lamp rows, trees, ring road
  const len = 900; B.quad('g_gravel', [-9, 0.03, 40], [9, 0.03, 40], [9, 0.03, 40 + len], [-9, 0.03, 40 + len], [-9 / 4, 40 / 4, 9 / 4, (40 + len) / 4], 0xf0c8a8, [0, 1, 0]);
  for (const sx of [-1, 1]) { B.quad('g_grass', [Math.min(sx * 12, sx * 60), 0.04, 40], [Math.max(sx * 12, sx * 60), 0.04, 40], [Math.max(sx * 12, sx * 60), 0.04, 40 + len], [Math.min(sx * 12, sx * 60), 0.04, 40 + len], [0, 0, 8, len / 6], 0xe8f4d8, [0, 1, 0]); B.quad('water', [Math.min(sx * 10, sx * 12), 0.06, 40], [Math.max(sx * 10, sx * 12), 0.06, 40], [Math.max(sx * 10, sx * 12), 0.06, 40 + len], [Math.min(sx * 10, sx * 12), 0.06, 40 + len], [0, 0, 1, 1], [0.1, 0.22, 0.22], [0, 1, 0]);
    for (let z = 60; z < len; z += 14) { P.tree(B, 'neem', sx * 20, 40 + z, 1.2, z | 0); P.tree(B, 'neem', sx * 36, 40 + z + 7, 1.3, (z | 0) + 9); P.lampPost(B, sx * 14, 40 + z, sx > 0 ? PI / 2 : -PI / 2, { style: 'ornate', h: 6 }); } }
  // ring road and surrounding lawn
  B.cyl('g_asphalt', 0, 0.0, 0, 72, 72, 0.04, 40, { col: 0xffffff, capBottom: false }); B.cyl('g_grass', 0, 0.05, 0, 58, 58, 0.02, 36, { col: 0xe8f4d8, capBottom: false }); B.cyl('g_gravel', 0, 0.07, 0, 44, 44, 0.02, 30, { col: 0xf0c8a8 });
  for (let i = 0; i < 24; i++) { const a = (i / 24) * PI * 2; P.lampPost(B, Math.cos(a) * 66, Math.sin(a) * 66, a + PI, { style: 'ornate', h: 6 }); if (i % 2) P.tree(B, 'neem', Math.cos(a) * 80, Math.sin(a) * 80, 1.3, i + 90); }
  // distant domed government building at the end of the avenue
  B.push(0, 0, 40 + len + 120); B.box(bk, 0, 15, 0, 220, 30, 36, { col: red, mpt: 4 }); for (let i = -4; i <= 4; i++) B.box('plain', i * 24, 14, -18.1, 8, 14, 0.2, { col: 0x2a1a14 }); B.cyl(bk, 0, 30, 0, 16, 14, 14, 20, { col: red }); halfDome(B, bk, 0, 44, 0, 16, 0xf0e8d0, null, { squash: 0.75 }); B.cyl('gold', 0, 56, 0, 0.6, 0.2, 7, 6, { col: 0xe8c050 }); B.pop();
  return {};
}

// ---------------------------------------------------------------------------------------------- Cebu
export function cebuSkyline(B, ctx) {
  const rng = ctx.rng; const blk = createCityBlock('cebu', { seed: 6, w: 300, d: 300, density: 1, reserve: [1, 3, 5, 7] }); ctx.extra.push(blk); const cells = blk.layout.cells;
  const kinds = [['glass', 34, 1.2], ['setback', 40, 0.9], ['pyramid', 38, 0.7], ['glass', 32, 0.95]]; const heights = [];
  [1, 3, 5, 7].forEach((ci, i) => { const k = cells[ci]; const [kind, w, fs] = kinds[i]; heights.push(heroTower(B, (k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2, { kind, w, seed: 31 + i, floorScale: fs, fh: 3.8, tint: [0x8cc0d8, 0xc8d0d4, 0xd0c8b8, 0x98d0c0][i] })); });
  // sea strait to the east with Mactan island strip
  B.quad('water', [190, -0.3, 400], [3200, -0.3, 400], [3200, -0.3, -900], [190, -0.3, -900], [0, 0, 1, 1], [0.04, 0.24, 0.3], [0, 1, 0]); B.quad('g_concrete', [168, 0.02, 400], [190, 0.02, 400], [190, 0.02, -900], [168, 0.02, -900], [0, 0, 4, 160], 0xdcd8d0, [0, 1, 0]);
  const sk = createSkyline('cebu', { kind: 'ring', radius: 1100, count: 120, seed: 8, haze: 0xc8dcea, hazeAmount: 0.5, minH: 30, maxH: 150 }); ctx.extra.push(sk);
  return { height: Math.max(...heights) };
}
