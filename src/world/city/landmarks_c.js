// Landmarks C: Pentagon (aerial), UN building, Georgia (Caucasus) mountains, White-House-like mansion.
import * as THREE from 'three';
import { RNG, smoothstep, clamp } from '../../engine/common.js';
import { fbm2, ridged2 } from '../../engine/proc.js';
import { Builder, rgb, mul, mix, jitter } from './builder.js';
import { STYLES } from './styles.js';
import { emitBuilding } from './buildings.js';
import { createSkyline } from './skyline.js';
import * as P from './props.js';
import { column, pediment, halfDome, pyramid, balustrade, stairs, flagPole, facadeWall } from './arch.js';

const PI = Math.PI;

// ---------------------------------------------------------------------------------------------- Pentagon
function pentVerts(R, rot = PI / 2 + PI / 5) { const v = []; for (let k = 0; k < 5; k++) { const a = rot + (k / 5) * PI * 2; v.push([Math.cos(a) * R, Math.sin(a) * R]); } return v; }
export function pentagon(B, ctx) {
  const rng = ctx.rng; const Rout = 239, ringW = 15, gap = 9.5, H = 22; const lime = 0xe8dcc0; const nRings = 5;
  // lawn + ground
  B.cyl('g_grass', 0, -0.05, 0, 900, 900, 0.05, 40, { col: 0xe0efd0, capBottom: false, mpt: 6 });
  B.prism('g_concrete', pentVerts(Rout + 6), 0.0, 0.08, { col: 0xc8c4bc, mpt: 4 });
  const rings = [];
  for (let i = 0; i < nRings; i++) {
    const Ro = Rout - i * (ringW + gap), Ri = Ro - ringW / Math.cos(PI / 5); const vo = pentVerts(Ro), vi = pentVerts(Ri); rings.push({ vo, vi });
    for (let k = 0; k < 5; k++) {
      const k2 = (k + 1) % 5; const oa = vo[k2], ob = vo[k]; const ia = vi[k], ib = vi[k2];
      facadeWall(B, 'office', oa, ob, 0.08, 5, 4.4, lime, { ground: true }); // outer face (reverse order => outward)
      facadeWall(B, 'office', ia, ib, 0.08, 5, 4.4, mul(lime, 0.92), { ground: true }); // inner face looks toward the centre
      B.quad('r_flat', [vo[k][0], H + 0.08, vo[k][1]], [vo[k2][0], H + 0.08, vo[k2][1]], [vi[k2][0], H + 0.08, vi[k2][1]], [vi[k][0], H + 0.08, vi[k][1]], [0, 0, 6, 1], 0xd8dce0, [0, 1, 0]);
      // little roof parapet line on the outer edge
      B.box('concrete', (vo[k][0] + vo[k2][0]) / 2, H + 0.5, (vo[k][1] + vo[k2][1]) / 2, 0.01, 0.01, 0.01, { col: 0x000000 });
    }
    // gap floor between this ring's inner edge and next ring's outer edge: connectors at mid sides
    if (i < nRings - 1) for (let k = 0; k < 5; k++) { const k2 = (k + 1) % 5; const mx = (vi[k][0] + vi[k2][0]) / 2, mz = (vi[k][1] + vi[k2][1]) / 2; const a = Math.atan2(mx, mz); const rr = Math.hypot(mx, mz); const gx = mx - Math.sin(a) * (gap / 2 + 0.2) , gz = mz - Math.cos(a) * (gap / 2 + 0.2); B.push(gx, 0.1, gz, a); B.box('concrete', 0, 5.5, 0, 7, 11, gap + 0.6, { col: lime, mpt: 4 }); B.pop(); }
  }
  const core = rings[nRings - 1].vi; B.prism('g_grass', core.map((p) => [p[0] * 0.995, p[1] * 0.995]), 0.08, 0.2, { col: 0xe0efd0, mpt: 6 });
  // courtyard: cross paths + pavilion
  for (let k = 0; k < 5; k++) { const a = rings[nRings - 1].vi[k]; B.quad('g_paving', [a[0] * 0.02 - 1.5, 0.22, a[1] * 0.02], [a[0] * 0.02 + 1.5, 0.22, a[1] * 0.02], [a[0] * 0.98 + 1.5, 0.22, a[1] * 0.98], [a[0] * 0.98 - 1.5, 0.22, a[1] * 0.98], [0, 0, 1, 12], 0xe8e4dc, [0, 1, 0]); }
  B.cyl('concrete', 0, 0.2, 0, 14, 14, 4.5, 6, { col: 0xd8d0b8, flat: true }); B.cyl('r_flat', 0, 4.7, 0, 15, 15, 0.6, 6, { col: 0xc8ccd0, flat: true }); B.cyl('plain', 0, 0.2, 0, 14.2, 14.2, 2.2, 6, { col: 0x24323c, cap: false });
  for (let i = 0; i < 40; i++) { const a = (i / 40) * PI * 2; const r = rng.range(20, 50); P.tree(B, 'bush', Math.cos(a) * r, Math.sin(a) * r, 1.4, i + 4, { y: 0.2 }); }
  // roads: ring road + radial highways + overpass + parking lots
  const road = (x0, z0, x1, z1, w, mk = true) => { const dx = x1 - x0, dz = z1 - z0; const L = Math.hypot(dx, dz); const ux = dx / L, uz = dz / L; const nx = -uz * w / 2, nz = ux * w / 2; B.quad('g_asphalt', [x0 - nx, 0.1, z0 - nz], [x0 + nx, 0.1, z0 + nz], [x1 + nx, 0.1, z1 + nz], [x1 - nx, 0.1, z1 - nz], [0, 0, w / 8, L / 8], 0xffffff, [0, 1, 0]); if (mk) B.quad('paint', [x0 - 0.12, 0.12, z0], [x0 + 0.12, 0.12, z0], [x1 + 0.12, 0.12, z1], [x1 - 0.12, 0.12, z1], [0, 0, 1, 1], 0xe0e0d8, [0, 1, 0]); };
  const Rr = 320; const NS = 56; for (let i = 0; i < NS; i++) { const a0 = (i / NS) * PI * 2, a1 = ((i + 1) / NS) * PI * 2; road(Math.cos(a0) * Rr, Math.sin(a0) * Rr, Math.cos(a1) * Rr, Math.sin(a1) * Rr, 24, i % 2 === 0); }
  for (const a of [0.35, 2.3, 4.2, 5.4]) road(Math.cos(a) * Rr, Math.sin(a) * Rr, Math.cos(a) * 1100, Math.sin(a) * 1100, 26);
  for (const a of [0.9, 3.4]) road(Math.cos(a) * 250, Math.sin(a) * 250, Math.cos(a) * Rr, Math.sin(a) * Rr, 12); // spokes to the building
  const carCols = [0xe8e8e8, 0xc8cacc, 0x2a2c30, 0x8a8e94, 0xb02a2a, 0x2a4a8a, 0x1a1a1e, 0xd8d0b8, 0x3a5a3a];
  const lots = [[0.6, 440], [1.3, 430], [1.95, 450], [2.7, 440], [3.3, 460], [4.0, 430], [4.7, 450], [5.9, 440]];
  for (const [a, r] of lots) { const cx = Math.cos(a) * r, cz = Math.sin(a) * r; B.push(cx, 0, cz, -a + PI / 2); B.quad('g_asphalt', [-60, 0.1, 40], [60, 0.1, 40], [60, 0.1, -40], [-60, 0.1, -40], [-60 / 8, 40 / 8, 60 / 8, -40 / 8], 0xe0e0e0, [0, 1, 0]);
    for (let row = 0; row < 10; row++) { const z = -34 + row * 7.6; if (row % 2 === 0) B.quad('paint', [-58, 0.12, z + 3.6], [58, 0.12, z + 3.6], [58, 0.12, z + 3.5], [-58, 0.12, z + 3.5], [0, 0, 1, 1], 0xe0e0d8, [0, 1, 0]); for (let k = 0; k < 40; k++) { if (rng.chance(0.28)) continue; const x = -57 + k * 2.9; B.box('car', x, 0.75, z, 1.8, 1.3, 4.3, { col: rng.pick(carCols), top: true }); } }
    for (let t = -50; t <= 50; t += 25) P.lampPost(B, t, 41, 0, { h: 9 }); B.pop(); }
  // overpass where a highway crosses the ring
  const oa = 0.35; B.push(Math.cos(oa) * Rr, 0, Math.sin(oa) * Rr, -oa + PI / 2 + PI / 2); B.box('g_concrete', 0, 7.2, 0, 30, 1.2, 90, { col: 0xc8c4bc, mpt: 4 }); B.box('g_asphalt', 0, 7.85, 0, 26, 0.1, 90, { col: 0xffffff }); for (const sx of [-1, 1]) { B.box('concrete', sx * 14.5, 8.5, 0, 0.5, 1.2, 90, { col: 0xc8c4bc }); for (const z of [-30, 0, 30]) B.box('concrete', sx * 9, 3.6, z, 2.2, 7.2, 3, { col: 0xc8c4bc }); } B.pop();
  for (let i = 0; i < 260; i++) { const a = rng.range(0, PI * 2), r = rng.range(270, 880); P.tree(B, rng.pick(['plane', 'raintree', 'bush']), Math.cos(a) * r, Math.sin(a) * r, rng.range(1, 1.6), i + 100, {}); }
  B.quad('water', [-2500, -0.4, 900], [2500, -0.4, 900], [2500, -0.4, 1500], [-2500, -0.4, 1500], [0, 0, 1, 1], [0.1, 0.18, 0.22], [0, 1, 0]);
  return { height: H, anchors: [] };
}

// ---------------------------------------------------------------------------------------------- UN building
export function unBuilding(B, ctx) {
  const rng = ctx.rng; const rc = { S: STYLES.manhattan, snow: 0, fires: [], night: 0 };
  // plaza + river + drive
  B.quad('g_paving', [-220, 0.02, 160], [220, 0.02, 160], [220, 0.02, -140], [-220, 0.02, -140], [-55, 40, 55, -35], 0xe8e4dc, [0, 1, 0]);
  B.quad('water', [-3000, -0.5, 330], [3000, -0.5, 330], [3000, -0.5, 1500], [-3000, -0.5, 1500], [0, 0, 1, 1], [0.08, 0.15, 0.2], [0, 1, 0]);
  B.quad('g_asphalt', [-600, 0.0, 190], [600, 0.0, 190], [600, 0.0, 160], [-600, 0.0, 160], [-75, 24, 75, 20], 0xffffff, [0, 1, 0]); B.quad('g_sidewalk', [-600, 0.05, 330], [600, 0.05, 330], [600, 0.05, 190], [-600, 0.05, 190], [-125, 69, 125, 40], 0xffffff, [0, 1, 0]); B.quad('g_grass', [-600, 0.03, 330], [600, 0.03, 330], [600, 0.03, 200], [-600, 0.03, 200], [0, 0, 100, 22], 0xe0efd0, [0, 1, 0]);
  // Secretariat slab: marble ends, glass curtain walls (green tint) front/back
  const SW = 87, SD = 22, SH = 39, fh = 3.95; const x0 = -SW / 2, x1 = SW / 2, z0 = -80 - SD / 2, z1 = -80 + SD / 2;
  facadeWall(B, 'glass', [x0, z1], [x1, z1], 0.1, SH, fh, 0x8cc4b0, { ground: true }); facadeWall(B, 'glass', [x1, z0], [x0, z0], 0.1, SH, fh, 0x8cc4b0, { ground: true });
  const hh = SH * fh; B.box('s_marble', x1, hh / 2 + 0.1, (z0 + z1) / 2, 0.2, hh, SD, { col: 0xffffff, mpt: 6, sides: true }); B.box('s_marble', x0, hh / 2 + 0.1, (z0 + z1) / 2, 0.2, hh, SD, { col: 0xffffff, mpt: 6 });
  B.quad('s_marble', [x1, 0.1, z1], [x1, 0.1, z0], [x1, hh + 0.1, z0], [x1, hh + 0.1, z1], [z1 / 6, 0, z0 / 6, hh / 6], 0xffffff); B.quad('s_marble', [x0, 0.1, z0], [x0, 0.1, z1], [x0, hh + 0.1, z1], [x0, hh + 0.1, z0], [z0 / 6, 0, z1 / 6, hh / 6], 0xffffff);
  B.box('s_marble', 0, hh + 1.1, (z0 + z1) / 2, SW + 0.4, 2, SD + 0.4, { col: 0xf4f4f0, mpt: 6 }); B.box('metal', 0, hh + 4.2, (z0 + z1) / 2, SW * 0.55, 4.2, SD * 0.7, { col: 0xc8ccd0 });
  for (let i = 0; i < 4; i++) B.box('plain', x1 + 0.12, 25 + i * 28, (z0 + z1) / 2, 0.06, 3.2, 1.2, { col: 0x24323c }); // slit windows on the marble gable
  // General Assembly hall (curved sloping roof + low dome)
  const gx = 38, gz = -10, GW = 68, GD = 52; B.push(gx, 0, gz);
  B.box('s_marble', 0, 7, 0, GW, 14, GD, { col: 0xffffff, mpt: 6 }); facadeWall(B, 'glass', [-GW / 2 + 3, GD / 2 + 0.1], [GW / 2 - 3, GD / 2 + 0.1], 1.0, 3, 3.8, 0x8cc4b0, { ground: true });
  for (let i = 0; i <= 10; i++) { const t0 = i / 10, t1 = (i + 1) / 10; const y = (t) => 14 + 9 * t - 3 * Math.sin(t * PI); const zz = (t) => -GD / 2 + t * GD; if (i < 10) B.quad('metal', [-GW / 2 - 0.3, y(t0), zz(t0)], [GW / 2 + 0.3, y(t0), zz(t0)], [GW / 2 + 0.3, y(t1), zz(t1)], [-GW / 2 - 0.3, y(t1), zz(t1)], [0, 0, 1, 1], 0xb4bcc4); }
  halfDome(B, 's_copper', 0, 16, -6, 17, 0xc8e8d8, null, { squash: 0.42 }); B.pop();
  // conference building (long, low) + delegates entrance canopy
  emitBuilding(B, { x: -50, z: 70, yaw: 0, y: 0, w: 130, d: 24, tiers: [{ w: 130, d: 24, ox: 0, oz: 0, floors: 4, facade: 'glass', fh: 3.8 }], shop: null, tint: 0x9cc8b8, roof: { type: 'flat', props: ['hvac', 'hvac'], parapetH: 0.6 }, seed: 5 }, 0, rc);
  // flag poles in a line along the plaza front + fountain pool
  const fcols = [[0xd02a2a, 0xffffff, 0x2a4ac8], [0x2a8a3a, 0xffffff, 0xd02a2a], [0xf2d030, 0x2a4ac8, 0xd02a2a], [0xffffff, 0xd02a2a, 0x101010], [0x2a4ac8, 0xffffff, 0x2a4ac8], [0xe85a1a, 0xffffff, 0x2a8a3a], [0x101010, 0xd02a2a, 0x2a8a3a]];
  for (let i = 0; i < 38; i++) flagPole(B, -100 + i * 5.6, 0.1, 120, 8.5, rng.pick(fcols), rng); B.cyl('water', -12, 0.04, 40, 22, 22, 0.1, 28, { col: [0.2, 0.34, 0.4] }); B.cyl('s_marble', -12, 0.0, 40, 23.2, 23.2, 0.5, 28, { col: 0xf0f0ec, capBottom: false });
  for (let i = 0; i < 12; i++) P.tree(B, 'plane', -150 + i * 28, 140 + rng.range(-3, 3), 1.2, i + 3); for (let i = 0; i < 16; i++) P.lampPost(B, -150 + i * 20, 170, PI, { h: 8 });
  const sk = createSkyline('manhattan', { kind: 'row', length: 2400, depth: 260, z0: 360, count: 90, seed: 3, haze: 0xb8c8d8, hazeAmount: 0.5, minH: 60, maxH: 260 }); sk.root.rotation.y = PI; sk.root.position.z = 0; ctx.extra.push(sk);
  return { height: hh };
}

// ---------------------------------------------------------------------------------------------- Georgia (Caucasus)
export function georgiaMountains(B, ctx) {
  const rng = ctx.rng; const seed = ctx.opts.seed || 3; const NR = 54, NA = 168; const r0 = 60, r1 = 11000;
  const H = (x, z) => {
    const r = Math.hypot(x, z); const ridge = ridged2(x * 0.00042 + seed * 1.7, z * 0.00042 - seed, 5); const base = fbm2(x * 0.00035 + 4, z * 0.00035 - 2, 4); const hills = fbm2(x * 0.0022, z * 0.0022, 3);
    const mask = smoothstep(700, 3600, r) * (1 - smoothstep(7500, 11000, r) * 0.55); const valley = smoothstep(0, 900, r); const wall = Math.pow(ridge, 1.35);
    return mask * (2500 * wall + 900 * base) + valley * (60 + 140 * smoothstep(500, 2200, r) * hills) + (1 - valley) * 6 * hills;
  };
  const verts = [], cols = [], idx = []; const snowLine = 1900;
  for (let i = 0; i <= NR; i++) { const rr = r0 * Math.pow(r1 / r0, i / NR); for (let j = 0; j <= NA; j++) { const a = (j / NA) * PI * 2; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; verts.push([x, H(x, z), z]); } }
  const normal = (i, j) => { const g = (ii, jj) => verts[Math.min(NR, Math.max(0, ii)) * (NA + 1) + ((jj % (NA + 1)) + NA + 1) % (NA + 1)]; const a = g(i + 1, j), b = g(i - 1, j), c = g(i, j + 1), d = g(i, j - 1); const t1 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], t2 = [c[0] - d[0], c[1] - d[1], c[2] - d[2]]; let n = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]]; const l = Math.hypot(...n) || 1; n = n.map((v) => v / l); if (n[1] < 0) n = n.map((v) => -v); return n; };
  const pos = [], nor = [], col = [], uv = [];
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NA; j++) {
    const v = verts[i * (NA + 1) + j]; const n = normal(i, j); pos.push(...v); nor.push(...n); uv.push(v[0] / 120, v[2] / 120);
    const h = v[1], slope = 1 - n[1]; const nz = fbm2(v[0] * 0.01, v[2] * 0.01, 3);
    let c; const rock = [0.3 + nz * 0.08, 0.27 + nz * 0.07, 0.25 + nz * 0.06], forest = [0.07 + nz * 0.03, 0.15 + nz * 0.05, 0.06], meadow = [0.2 + nz * 0.06, 0.32 + nz * 0.08, 0.12], snow = [0.9, 0.93, 0.98];
    if (h < 1100) c = mix(meadow, forest, smoothstep(150, 520, h) * (1 - smoothstep(0.1, 0.35, slope))); else c = mix(meadow, rock, smoothstep(1000, 1700, h));
    c = mix(c, rock, smoothstep(0.18, 0.42, slope)); const sn = smoothstep(snowLine - 250 + nz * 300, snowLine + 300 + nz * 300, h) * (1 - smoothstep(0.34, 0.62, slope)); c = mix(c, snow, sn); col.push(...c);
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  // faces wind (a,b,c): ensure upward by checking first triangle
  const ia = idx[0] * 3, ib = idx[1] * 3, ic = idx[2] * 3; const e1 = [pos[ib] - pos[ia], pos[ib + 1] - pos[ia + 1], pos[ib + 2] - pos[ia + 2]], e2 = [pos[ic] - pos[ia], pos[ic + 1] - pos[ia + 1], pos[ic + 2] - pos[ia + 2]]; const cy = e1[2] * e2[0] - e1[0] * e2[2]; if (cy < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } geo.setIndex(idx); }
  B.geometry('g_gravel', geo, 0xffffff, 1); geo.dispose();
  // valley: river, stone houses with red roofs and Svan-style towers, spruce forest
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([-700 + t * 1400, 0.8 + 0, 240 * Math.sin(t * 5 + 1) + 80 * Math.sin(t * 13) - 120]); }
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz); const nx = -dz / l * 9, nz = dx / l * 9; B.quad('water', [a[0] - nx, 1.2, a[2] - nz], [a[0] + nx, 1.2, a[2] + nz], [b[0] + nx, 1.2, b[2] + nz], [b[0] - nx, 1.2, b[2] - nz], [0, 0, 1, 1], [0.1, 0.22, 0.26], [0, 1, 0]); }
  const village = (cx, cz, n) => { for (let i = 0; i < n; i++) { const x = cx + rng.range(-50, 50), z = cz + rng.range(-40, 40); const y = H(x, z); const w = rng.range(7, 11), d = rng.range(6, 9), h = rng.range(5, 7); B.push(x, y, z, rng.range(0, PI * 2)); B.box('s_coral', 0, h / 2, 0, w, h, d, { col: 0xd8d0c0, mpt: 3 }); const ex = w / 2 + 0.4, ez = d / 2 + 0.4; B.quad('s_redsand', [-ex, h, ez], [ex, h, ez], [ex, h + 2.6, 0], [-ex, h + 2.6, 0], [0, 0, 4, 2], 0xd0b8a8); B.quad('s_redsand', [ex, h, -ez], [-ex, h, -ez], [-ex, h + 2.6, 0], [ex, h + 2.6, 0], [0, 0, 4, 2], 0xd0b8a8); B.tri('s_coral', [-ex + 0.4, h, ez - 0.4], [ex - 0.4, h, ez - 0.4], [0, h + 2.4, 0], 0xd8d0c0); B.pop();
      if (i % 3 === 0) { B.push(x + 12, H(x + 12, z), z + 5); B.box('s_coral', 0, 8, 0, 4.6, 16, 4.6, { col: 0xcfc6b2, mpt: 3 }); B.box('plain', 0, 13.5, 2.32, 1.2, 1.6, 0.1, { col: 0x181410 }); pyramid(B, 's_redsand', 0, 16, 0, 5.4, 5.4, 3.5, 0xc8b0a0, 4); B.pop(); } } };
  village(260, 60, 14); village(-420, -160, 9);
  for (let i = 0; i < 700; i++) { const a = rng.range(0, PI * 2), r = rng.range(250, 3200); const x = Math.cos(a) * r, z = Math.sin(a) * r; const y = H(x, z); if (y > 1250) continue; const e = 0.2 * (x * 0 + 1); const hh = rng.range(9, 20); B.cyl('plain', x, y - 0.5, z, 3.2, 0.2, hh, 5, { col: mix(0x1a3a22, 0x2a5a32, rng.next()), cap: false, flat: true }); B.cyl('plain', x, y + hh * 0.35, z, 2.4, 0.2, hh * 0.7, 5, { col: mix(0x1a3a22, 0x2a5a32, rng.next()), cap: false, flat: true }); }
  return { height: 3200, heightAt: H };
}

// ---------------------------------------------------------------------------------------------- White House-like
export function whiteHouse(B, ctx) {
  const rng = ctx.rng; const rc = { S: STYLES.manhattan, snow: 0, fires: [], night: 0 }; const white = 0xf6f4ee;
  B.cyl('g_grass', 0, -0.05, 0, 260, 260, 0.1, 40, { col: 0xe0efd0, capBottom: false, mpt: 6 }); B.cyl('g_asphalt', 0, 0.0, 0, 70, 70, 0.06, 40, { col: 0xe8e8e8, capBottom: false }); B.cyl('g_grass', 0, 0.01, 0, 58, 58, 0.06, 36, { col: 0xe0efd0 }); B.quad('g_asphalt', [-5, 0.02, 100], [5, 0.02, 100], [5, 0.02, 40], [-5, 0.02, 40], [0, 0, 1, 8], 0xffffff, [0, 1, 0]);
  emitBuilding(B, { x: 0, z: 0, yaw: 0, y: 0.3, w: 52, d: 22, tiers: [{ w: 52, d: 22, ox: 0, oz: 0, floors: 3, facade: 'altbau', fh: 3.6 }], shop: null, tint: white, roof: { type: 'flat', props: ['chimney', 'chimney'], parapetH: 1.2 }, seed: 9, cornice: white }, 0, rc);
  for (const sx of [-1, 1]) { emitBuilding(B, { x: sx * 44, z: -4, yaw: 0, y: 0.3, w: 32, d: 14, tiers: [{ w: 32, d: 14, ox: 0, oz: 0, floors: 2, facade: 'altbau', fh: 3.4 }], shop: null, tint: white, roof: { type: 'flat', props: [], parapetH: 0.8 }, seed: 10 + sx, cornice: white }, 0, rc); for (let i = 0; i < 6; i++) column(B, 's_marble', sx * (24 + i * 2.1), 0.3, 6, 0.3, 5.5, white); B.box('s_marble', sx * 29, 6.0, 6, 14, 0.5, 2.2, { col: white, mpt: 5 }); }
  // north portico (pediment + 6 columns) and south bow with columns
  B.box('s_marble', 0, 0.6, 14.5, 20, 0.6, 7, { col: white, mpt: 5 }); for (let i = 0; i < 6; i++) column(B, 's_marble', -8.5 + i * 3.4, 0.9, 14.5, 0.62, 9.5, white); B.box('s_marble', 0, 10.8, 14.5, 20.4, 1.2, 6.4, { col: white, mpt: 5 }); pediment(B, 's_marble', 21, 3.4, 6.4, white, 5, 11.4);
  B.cyl('s_marble', 0, 0.3, -11, 8.4, 8.4, 9.8, 18, { col: white, mpt: 5 }); for (let i = 0; i < 12; i++) { const a = PI + (i / 11 - 0.5) * PI * 0.95; column(B, 's_marble', Math.sin(a) * 9.4, 0.3, -11 + Math.cos(a) * 9.4 * -1 * -1, 0.3, 4.8, white); }
  stairs(B, 's_marble', 0, 0.0, 19.5, 12, 3.4, 0.9, 4, 0xf0eee8);
  for (let i = 0; i < 70; i++) { const a = (i / 70) * PI * 2; B.box('metal', Math.cos(a) * 125, 1.1, Math.sin(a) * 125, 0.08, 2.2, 0.08, { col: 0x15161a }); B.box('metal', Math.cos(a) * 125, 2.1, Math.sin(a) * 125, 3.2, 0.06, 0.06, { col: 0x15161a }); }
  for (let i = 0; i < 40; i++) { const a = rng.range(0, PI * 2), r = rng.range(30, 110); P.tree(B, rng.pick(['plane', 'mango', 'raintree']), Math.cos(a) * r, Math.sin(a) * r, rng.range(1, 1.5), i + 7); }
  B.cyl('s_marble', 0, 0, 0 + 70, 5, 5, 0.9, 20, { col: white, capBottom: false }); B.cyl('water', 0, 0.8, 70, 4.4, 4.4, 0.1, 20, { col: [0.2, 0.34, 0.4] }); P.lampPost(B, 4, 40, PI, { style: 'ornate', h: 4.6 }); P.lampPost(B, -4, 40, PI, { style: 'ornate', h: 4.6 });
  return {};
}
