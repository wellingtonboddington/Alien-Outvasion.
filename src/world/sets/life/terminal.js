// Cebu open-air jeepney terminal. Set space: origin = middle of the concrete apron. x∈[-22,22], z∈[-17,17] (street / camera side = +z, shop buildings = -z).
// Four parking bays (anchors bay1..bay4, yaw 0 = jeepney nose toward +z), tarp waiting shed (west), dispatcher kiosk (east), vendor carts, route boards, tangled cables.
import * as THREE from 'three';
import { RNG, TAU } from '../../../engine/common.js';
import { Kit, atlas, signMesh, uvRect } from './kit.js';
import { bench, trashBin, chairPlastic, plant, finishSet, A, AT } from './props.js';
import { stripes } from './tex.js';
const put = (K, o, x, y, z) => { o.position.set(x, y, z); return K.mesh(o); };

const W = 44, D = 34, H = 8, hw = W / 2, hd = D / 2;
const ROUTES = [['01A', 'COLON - CARBON', '#e0242b'], ['04L', 'LAHUG - IT PARK', '#1f6fd0'], ['17B', 'MANDAUE - PARKMALL', '#f0b020'], ['22C', 'TALISAY - SEASIDE', '#18a05a'], ['62B', 'CARBON - MAGELLAN', '#a040c0'], ['13C', 'COLON - PIT-OS', '#ee7a1a']];
const PASTELS = ['#c9b79a', '#b8c4b0', '#d4b0a0', '#a9b8c8', '#d8c890', '#c8a8b8', '#9fb5a5'];

function wrapText(ctx, text, x, y, maxW, lh) { const ws = text.split(' '); let line = ''; const lines = []; for (const w of ws) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; } lines.push(line); lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh)); }

/** shop/apartment building front in a local frame: front face at z=0 facing +z, volume extends to -z, centred on x */
function facade(K, rng, { w = 12, h = 12, depth = 8, color = '#c9b79a', floors = 4 } = {}) {
  K.tinted(color, () => K.box('plaster', w, h, depth, 0, 0, -depth / 2));
  const fh = h / floors, cols = Math.max(2, Math.round(w / 3));
  // ground floor: roll-up shutter + stall counter
  K.tinted(rng.pick(['#8a8f94', '#7a8a7a', '#9a8a7a']), () => K.box('corrugated', w * 0.62, fh * 0.7, 0.1, -w * 0.12, 0, 0.05));
  K.tinted('#2a2a2a', () => K.box('matte', w * 0.62 + 0.2, 0.18, 0.18, -w * 0.12, fh * 0.7, 0.09));
  for (let f = 1; f < floors; f++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) * w / cols - w / 2, y = f * fh + 0.5, lit = rng.chance(0.28);
    K.box('darkMetal', 1.5, 1.5, 0.12, x, y - 0.05, 0.03); K.tinted(lit ? '#b08a50' : rng.pick(['#3a5468', '#46627a', '#34495a']), () => K.box(lit ? 'glowWarm' : 'screenOff', 1.3, 1.3, 0.03, x, y + 0.05, 0.1));
    K.box('concrete', 1.7, 0.08, 0.12, x, y - 0.12, 0.08);
    if (rng.chance(0.35)) { K.slab('darkMetal', x - 0.85, y - 0.15, 0.1, x + 0.85, y - 0.1, 0.7); K.slab('darkMetal', x - 0.85, y - 0.1, 0.68, x + 0.85, y + 0.8, 0.7); }
    if (rng.chance(0.3)) K.tinted('#e8e8e4', () => K.box('plastic', 0.8, 0.5, 0.35, x + 0.5, y + 0.55, 0.12 + 0.15));
    if (rng.chance(0.35)) K.tinted(rng.pick(['#d8d8d0', '#c0392b', '#2a7ad0', '#e8c020']), () => K.cloth('banner', 0.55, 0.9, x - 0.3, y + 0.3, 0.75, 0, { pin: 'top' }));
  }
  K.tinted('#6a6a66', () => K.box('concrete', w + 0.3, 0.35, depth + 0.3, 0, h, -depth / 2));
  K.cyl('plastic#2a5a8a', 0.8, 1.4, w * 0.25, h + 0.35, -depth * 0.5, { seg: 12 }); K.cyl('darkMetal', 0.02, 2.5, -w * 0.3, h + 0.35, -depth * 0.3, { seg: 4 });
}

function cart(K, rng, { umb = 'umbrella', goods = 'fruit', tint = '#8a6a3a' } = {}) {
  K.tinted(tint, () => { K.box('woodGrain', 1.6, 0.14, 0.9, 0, 0.72, 0); K.box('woodGrain', 1.5, 0.5, 0.04, 0, 0.22, 0.4); K.box('woodGrain', 1.5, 0.5, 0.04, 0, 0.22, -0.4); K.box('woodGrain', 0.04, 0.5, 0.8, 0.74, 0.22, 0); K.box('woodGrain', 0.04, 0.5, 0.8, -0.74, 0.22, 0); });
  for (const s of [-1, 1]) { K.cyl('rubberBlack', 0.3, 0.07, s * 0.86, 0.3, 0, { axis: 'x', seg: 14 }); K.cyl('steelPlain', 0.08, 0.09, s * 0.86, 0.3, 0, { axis: 'x', seg: 8 }); K.box('darkMetal', 0.04, 0.04, 1.3, s * 0.78, 0.75, 0.0); }
  K.cyl('darkMetal', 0.02, 1.7, 0.0, 0.8, -0.3, { seg: 6 }); K.cyl(umb, 1.35, 0.4, 0.0, 2.4, -0.3, { seg: 16, rt: 0.04, open: false });
  K.sph('steelPlain', 0.04, 0, 2.82, -0.3, { seg: 6, segH: 4 });
  if (goods === 'fruit') for (let i = 0; i < 18; i++) K.tinted(rng.pick(['#e8c020', '#d8442a', '#7ac040', '#f0902a']), () => K.sph('plastic', 0.09, -0.6 + (i % 6) * 0.24, 0.9, -0.1 + Math.floor(i / 6) * 0.22 - 0.1, { seg: 8, segH: 6 }));
  else if (goods === 'grill') { K.box('darkMetal', 1.0, 0.18, 0.5, -0.1, 0.8, 0.0); K.box('coal', 0.9, 0.02, 0.4, -0.1, 0.98, 0); for (let i = 0; i < 12; i++) K.tinted('#a06a3a', () => K.cyl('woodGrain', 0.008, 0.6, -0.5 + i * 0.08, 1.02, 0, { axis: 'z', seg: 4 })); K.box('chrome', 0.3, 0.3, 0.3, 0.6, 0.86, 0.1); }
  else { for (let i = 0; i < 3; i++) K.tinted(['#2a7ad0', '#e8e8e4', '#e08a1a'][i], () => K.cyl('plastic', 0.17, 0.5, -0.5 + i * 0.4, 0.86, 0.0, { seg: 12 })); for (let i = 0; i < 8; i++) K.tinted('#f4f4f0', () => K.cyl('plastic', 0.03, 0.08, 0.2 + i * 0.07, 0.86, 0.2, { seg: 6, rt: 0.04 })); }
}

export function createJeepneyTerminal(opts = {}) {
  const K = new Kit({ name: 'jeepney_terminal', env: 'day', seed: 61 }); const rng = new RNG(61);
  K.setAmbience({ min: [-hw, 0, -hd], max: [hw, H, hd], floor: 0.3, wall: 0.1, ceil: 0.0, range: 0.8 });
  K.defMat('banner', { color: 0xffffff, rough: 0.8, side: 'double', sway: 1.0 });
  K.defMat('umbrella', { map: stripes('#f0e8d4', '#d8322a', 12, 128), color: 0xffffff, uv: 'own', rough: 0.7, side: 'double', env: 0.2 });
  K.defMat('umbrella2', { map: stripes('#f2ecd8', '#2a6ad0', 12, 128), color: 0xffffff, uv: 'own', rough: 0.7, side: 'double', env: 0.2 });
  K.defMat('coal', { glow: true, color: 0xff6a20, intensity: 1.6 });
  K.defMat('stain', { color: 0x0a0a0a, rough: 0.5, transparent: true, opacity: 0.4, noShadow: true });
  K.defMat('puddle', { color: 0x7a8a96, rough: 0.05, metal: 0.2, env: 1.4, transparent: true, opacity: 0.55, noShadow: true });
  // ---- ground
  K.slab('plaster#cfc9ba', -hw - 14, -0.4, -hd - 10, hw + 14, 0, hd - 4);
  K.slab('plaster#e4e0d2', -hw - 14, -0.4, hd - 4, hw + 14, 0.12, hd - 3.7);
  K.slab('asphalt#6a6c70', -hw - 14, -0.5, hd - 3.7, hw + 14, -0.06, hd + 24);
  for (let i = -8; i < 8; i++) K.slab('paint#e8c820', i * 6 + 0.5, -0.058, hd + 6.9, i * 6 + 3.5, -0.05, hd + 7.1);
  for (let i = 0; i <= 4; i++) K.slab('paint#f2f0e6', -10.06 + i * 5, 0, -9.5, -9.94 + i * 5, 0.012, -2.5);
  K.slab('paint#f2f0e6', -10, 0, -2.56, 10, 0.012, -2.44); K.slab('paint#e8c820', -22, 0, -10.9, 22, 0.01, -10.8);
  for (let i = 0; i < 14; i++) K.cyl('stain', rng.range(0.4, 1.0), 0.002, rng.range(-9, 9) , 0.004, rng.range(-9, 3), { seg: 12, s: [1, rng.range(0.6, 1)] });
  for (const [x, z, r] of [[-4, 6.5, 1.3], [8, 9.5, 1.0], [-13, 3, 0.8]]) K.cyl('puddle', r, 0.002, x, 0.005, z, { seg: 14, s: [1.4, 1] });
  K.box('darkMetal', 0.9, 0.02, 0.6, 5.5, 0, 6.5); // manhole
  // ---- tarp waiting shed (west)
  const px = [-21, -16.5, -12], pz = [-15, -10, -5.5];
  for (const x of px) for (const z of pz) K.tinted('#5a5e64', () => K.cyl('steelPlain', 0.06, 3.0 + (x + 21) * 0.08, x, 0, z, { seg: 8 }));
  K.at([-16.5, 3.3, -10.2], [0, 0, 0.08], () => { K.tinted('#2f6fb5', () => K.box('tarp', 10.6, 0.05, 10.8, 0, 0, 0)); K.tinted('#e07a1a', () => K.box('tarp', 4.2, 0.03, 5.5, 1.5, 0.045, -2.0)); K.tinted('#d8d4c8', () => K.box('corrugated', 3.0, 0.03, 4.5, -2.8, 0.05, 3.0)); });
  for (const [x, z] of [[-22.2, -15.4], [-11.2, -15.4], [-22.2, -5.0], [-11.2, -5.0]]) { K.tube('rubberBlack', [[x * 0.97 + (x < -17 ? 0.6 : -0.6), 3.0, z * 0.98 + (z < -10 ? 0.4 : -0.4)], [x, 1.6, z], [x + (x < -17 ? -1 : 1), 0.02, z + (z < -10 ? -1 : 1)]], 0.012, { radial: 4 }); }
  for (let i = 0; i < 3; i++) K.cyl('glow#eef6ff', 0.03, 2.6, -16.5, 3.05, -13 + i * 3.4, { axis: 'x', seg: 6 });
  for (const row of [-19.5, -15.5]) for (let i = 0; i < 3; i++) K.at([row, 0, -13.2 + i * 3.2], Math.PI / 2, () => bench(K, 2.0, { color: i % 2 ? '#8a5a30' : '#6a4a2a', back: true }));
  for (let i = 0; i < 4; i++) K.at([-12.8 + (i % 2) * 0.5, 0, -2.2 - i * 0.2], rng.range(-0.4, 0.4), () => chairPlastic(K, rng.pick(['#d9422a', '#2a6ad0', '#e8c020', '#e8e8e4'])));
  K.at([-21.6, 0, -10], Math.PI / 2, () => put(K, signMesh(2.6, 3.2, routeMap, { px: 160, lit: false, bg: '#f4f0e0', rough: 0.6 }), 0, 1.9, 0));
  // ---- bay signs + overhead route board
  const at = atlas(4, 1, 256, 128, (ctx, i, w, h) => { const r = ROUTES[i]; ctx.fillStyle = r[2]; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.5}px Arial Black, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`BAY ${i + 1}`, w / 2, h * 0.3); ctx.font = `bold ${h * 0.18}px Arial`; wrapText(ctx, r[0] + '  ' + r[1], w / 2, h * 0.65, w * 0.92, h * 0.2); });
  K.defMat('bayAtlas', { map: at.tex, color: 0xffffff, rough: 0.5, uv: 'own', side: 'double', selfLit: 0.12 });
  for (let i = 0; i < 4; i++) { const x = -7.5 + i * 5; K.cyl('steelPlain', 0.04, 2.6, x - 2.2, 0, -2.2, { seg: 6 }); K.geo('bayAtlas', uvRect(new THREE.PlaneGeometry(1.3, 0.65), at.cell(i)), x - 2.2, 2.3, -2.16, 0); }
  K.at([0, 0, -13.0], 0, () => { K.cyl('steelPlain', 0.09, 5.4, -11.5, 0, 0, { seg: 8 }); K.cyl('steelPlain', 0.09, 5.4, 11.5, 0, 0, { seg: 8 }); K.box('darkMetal', 24, 0.1, 0.1, 0, 5.2, -0.02); put(K, signMesh(23.6, 2.6, routeBoard, { px: 80, lit: true, emissive: 0.7, bg: '#f4f0e0' }), 0, 4.0, 0.05); });
  // ---- dispatcher kiosk (east)
  K.at([17.5, 0, -7], -Math.PI / 2, () => {
    K.tinted('#d8c070', () => K.box('concrete', 3.2, 2.6, 2.4, 0, 0, 0)); K.box('darkMetal', 1.6, 1.0, 0.1, 0, 1.2, 1.18); K.box('screenOff', 1.4, 0.8, 0.02, 0, 1.3, 1.2);
    K.box('woodGrain#4a3018', 1.9, 0.08, 0.5, 0, 1.1, 1.45); K.tinted('#d9422a', () => K.box('corrugated', 3.8, 0.08, 3.0, 0, 2.6, 0.3)); K.box('glow#fff2c0', 1.4, 0.04, 0.2, 0, 2.5, 1.1);
    put(K, signMesh(2.2, 0.5, (c, w, h) => { c.fillStyle = '#d9422a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * 0.55}px Arial Black, Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DISPATCH', w / 2, h / 2); }, { px: 160, lit: true, emissive: 0.6, bg: '#d9422a' }), 0, 2.85, 1.55);
    K.at([1.1, 0, 1.6], 0.3, () => stoolPlastic(K)); K.tinted('#fff', () => K.box('plastic', 0.3, 0.22, 0.25, -0.5, 1.18, 1.4));
  });
  // ---- vendor carts + plastic stools
  const carts = [[14, 6, -0.3, 'umbrella', 'fruit'], [-4.5, 8.5, 0.25, 'umbrella2', 'drinks'], [19.5, 0.5, -1.4, 'umbrella', 'grill']];
  for (const [x, z, yaw, umb, goods] of carts) K.at([x, 0, z], yaw, () => { cart(K, rng, { umb, goods, tint: goods === 'grill' ? '#6a5a4a' : '#8a6a3a' }); });
  for (const [x, z] of [[16, 5], [16.8, 6.4], [-6, 10], [20.5, 3], [21.0, -1.0]]) K.at([x, 0, z], rng.range(0, TAU), () => stoolPlastic(K));
  // ---- bins, crates, tyres, bollards, plants
  for (const [x, z, c] of [[-11, 9, '#2a5a8a'], [11.5, 10, '#2a8a4a'], [3, -1.2, '#7a2a2a']]) K.at([x, 0, z], 0, () => trashBin(K, 0.25, 0.7, c));
  for (let i = 0; i < 6; i++) K.tinted(rng.pick(['#d9422a', '#2a6ad0', '#e8c020', '#2a9a5a']), () => K.box('plastic', 0.5, 0.3, 0.35, 11 + (i % 3) * 0.55, Math.floor(i / 3) * 0.3, -2.0 + (i % 2) * 0.1, rng.range(-0.1, 0.1)));
  for (let i = 0; i < 5; i++) K.torus('rubberBlack', 0.3, 0.1, 21 - 0.1 * i, 0.12 + i * 0.2, -12.5, [Math.PI / 2, 0, 0], { seg: 6, segR: 14 });
  for (let i = 0; i < 9; i++) { K.tinted(i % 2 ? '#e8c820' : '#202020', () => K.cyl('plastic', 0.09, 0.8, -20 + i * 5, 0, hd - 3.5, { seg: 8 })); }
  K.at([-8, 0, 12.2], 0, () => plant(K, 'ficus', { s: 1.7, potColor: '#8a8a82', seed: 3 })); K.at([9, 0, 12.0], 0, () => plant(K, 'dracaena', { s: 1.6, potColor: '#8a8a82', seed: 5 }));
  // ---- perimeter: back buildings, side walls
  K.at([-14, 0, -16.5], 0, () => facade(K, rng, { w: 14, h: 15, depth: 9, color: PASTELS[0], floors: 4 })); K.at([-1, 0, -16.5], 0, () => facade(K, rng, { w: 12, h: 11, depth: 9, color: PASTELS[2], floors: 3 }));
  K.at([11.5, 0, -16.5], 0, () => facade(K, rng, { w: 13, h: 17, depth: 9, color: PASTELS[3], floors: 5 })); K.at([-hw - 0.2, 0, -3], Math.PI / 2, () => facade(K, rng, { w: 24, h: 9, depth: 6, color: PASTELS[4], floors: 3 }));
  K.at([hw + 0.2, 0, 6], -Math.PI / 2, () => facade(K, rng, { w: 22, h: 12, depth: 8, color: PASTELS[1], floors: 4 })); K.at([-hw + 0.0, 0, 12], Math.PI / 2, () => K.box('concrete#9a9588', 0.4, 2.6, 8, 0, 0, 0));
  K.at([-hw - 4, 0, 24], Math.PI, () => facade(K, rng, { w: 16, h: 13, depth: 8, color: PASTELS[5], floors: 4 })); K.at([hw + 4, 0, 28], Math.PI, () => facade(K, rng, { w: 14, h: 16, depth: 8, color: PASTELS[6], floors: 4 }));
  K.at([0, 0, 38], Math.PI, () => facade(K, rng, { w: 40, h: 14, depth: 8, color: PASTELS[2], floors: 4 }));
  // banner across the entrance
  K.tinted('#ffe14a', () => K.cloth('banner', 7, 0.9, 0, 5.4, hd - 3.0, 0, { ws: 14, hs: 2, pin: 'top' }));
  put(K, signMesh(6.6, 0.8, (c, w, h) => { c.fillStyle = '#ffe14a'; c.fillRect(0, 0, w, h); c.fillStyle = '#b3262d'; c.font = `bold ${h * 0.6}px Arial Black, Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MAGANDANG ARAW, CEBU!', w / 2, h / 2); }, { px: 100, bg: '#ffe14a' }), 0, 5.4, hd - 2.94);
  K.cyl('steelPlain', 0.06, 5.9, -3.7, 0, hd - 3.0, { seg: 6 }); K.cyl('steelPlain', 0.06, 5.9, 3.7, 0, hd - 3.0, { seg: 6 });
  // ---- utility poles + tangled cables
  const poles = [[-20, 12.4], [-10, 12.4], [0, 12.6], [10, 12.4], [20, 12.4], [-8, -14.2], [9, -14.2]];
  for (const [x, z] of poles) { K.tinted('#6a5a48', () => K.cyl('woodGrain', 0.16, 8, x, 0, z, { seg: 8, rt: 0.11 })); K.box('woodGrain#5a4a38', 2.2, 0.12, 0.12, x, 7.2, z); K.box('woodGrain#5a4a38', 1.6, 0.1, 0.1, x, 6.4, z); for (const s of [-0.9, -0.3, 0.3, 0.9]) K.cyl('plastic#cfd8dc', 0.04, 0.12, x + s, 7.32, z, { seg: 6 }); K.cyl('darkMetal', 0.22, 0.5, x + 0.3, 5.2, z + 0.2, { seg: 8 }); }
  const cab = (a, b, sag, r = 0.012) => { const m = [(a[0] + b[0]) / 2 + rng.range(-0.6, 0.6), Math.min(a[1], b[1]) - sag, (a[2] + b[2]) / 2 + rng.range(-0.4, 0.4)]; K.tube('rubberBlack', [a, [a[0] * 0.7 + m[0] * 0.3, a[1] * 0.7 + m[1] * 0.3 - sag * 0.2, a[2] * 0.7 + m[2] * 0.3], m, [b[0] * 0.7 + m[0] * 0.3, b[1] * 0.7 + m[1] * 0.3 - sag * 0.2, b[2] * 0.7 + m[2] * 0.3], b], r, { radial: 4, segs: 14 }); };
  for (let i = 0; i < poles.length - 3; i++) for (let k = 0; k < 5; k++) cab([poles[i][0] + (k - 2) * 0.45, 7.25 - (k % 2) * 0.8, poles[i][1]], [poles[i + 1][0] + (k - 2) * 0.45, 7.25 - (k % 2) * 0.8, poles[i + 1][1]], rng.range(0.3, 1.0), k === 2 ? 0.02 : 0.012);
  for (let k = 0; k < 14; k++) { const p = poles[k % 5]; cab([p[0] + rng.range(-0.8, 0.8), 7.2 - rng.range(0, 0.8), p[1]], [rng.range(-16, 16), rng.range(4.5, 8.5), -15.5 + rng.range(-0.8, 0.3)], rng.range(0.6, 2.0)); }
  for (let k = 0; k < 8; k++) { const p = poles[5 + (k % 2)]; cab([p[0] + rng.range(-0.8, 0.8), 7.2, p[1]], [p[0] + rng.range(-9, 9), rng.range(4, 8), p[1] + rng.range(-1.2, 1.2)], rng.range(0.5, 1.6)); }
  cab([-20, 7.2, 12.4], [-16.5, 3.4, -5.5], 0.8); cab([-12, 3.4, -5.5], [-10, 7.2, 12.4], 1.5);
  // ---- lights / hemisphere (sun comes from the scene)
  const lights = [new THREE.HemisphereLight(0xd4e6f8, 0x8a7a5a, 0.7)];
  const anchors = {
    bay1: A([-7.5, 0, -6], 0), bay2: A([-2.5, 0, -6], 0), bay3: A([2.5, 0, -6], 0), bay4: A([7.5, 0, -6], 0),
    driver1: A([-9.2, 0, -3.8], Math.PI / 2), driver2: A([-4.2, 0, -3.8], Math.PI / 2), driver3: A([0.8, 0, -3.8], Math.PI / 2), driver4: A([5.8, 0, -3.8], Math.PI / 2),
    front1: AT([-7.5, 0, -1.2], [-7.5, 1.3, -6]), front2: AT([-2.5, 0, -1.2], [-2.5, 1.3, -6]), front3: AT([2.5, 0, -1.2], [2.5, 1.3, -6]), front4: AT([7.5, 0, -1.2], [7.5, 1.3, -6]),
    vendor1: A([14.2, 0, 5.1], 0), vendor2: A([-4.4, 0, 7.6], 0), vendor3: A([19.2, 0, -0.3], -Math.PI / 2 - 1.4), customer1: AT([14.2, 0, 8.0], [14, 1, 6]), customer2: AT([-4.2, 0, 10.4], [-4.5, 1, 8.5]),
    bench1: A([-15.5, 0, -13.2], Math.PI / 2), bench2: A([-15.5, 0, -10.0], Math.PI / 2), bench3: A([-19.5, 0, -10.0], Math.PI / 2), shed: AT([-14, 0, -8], [-17, 1.2, -10]),
    dispatcher: A([16.6, 0, -6.8], -Math.PI / 2), queue1: A([13.5, 0, -6.2], Math.PI / 2), queue2: A([12.4, 0, -6.4], Math.PI / 2), queue3: A([11.4, 0, -6.0], Math.PI / 2),
    street: AT([0, 0, hd - 3.3], [0, 1.2, -6]), curb: A([4, 0, hd - 3.0], Math.PI), entrance: AT([0, 0, hd - 3.5], [0, 1, 0]),
    camWide: { pos: [0, 3.4, 17], yaw: Math.PI, look: [1, 1.8, -7] }, camMid: { pos: [-6.5, 1.65, 3.5], yaw: Math.PI, look: [-2.5, 1.5, -6] },
    camBays: { pos: [0, 1.6, 0.5], yaw: Math.PI, look: [0, 1.5, -6] }, camBay1: { pos: [-9.5, 1.5, 0.5], yaw: Math.PI, look: [-7.5, 1.4, -6] }, camBay4: { pos: [10.5, 1.5, 0.5], yaw: Math.PI, look: [7.5, 1.4, -6] },
    camVendors: { pos: [10.5, 1.6, 10.5], yaw: Math.PI, look: [15, 1.3, 4] }, camShed: { pos: [-9, 1.6, -2], yaw: Math.PI, look: [-17, 1.4, -10] }, camKiosk: { pos: [10.5, 1.6, -3.4], yaw: Math.PI, look: [17.5, 1.4, -7] },
    camHigh: { pos: [-16, 8.5, 14], yaw: Math.PI, look: [4, 0.5, -5] }, camStreet: { pos: [-12, 1.6, hd + 3], yaw: Math.PI, look: [4, 1.8, -8] }, camCables: { pos: [3, 1.5, 2], yaw: Math.PI, look: [-2, 6.8, -13] },
  };
  return finishSet(K, {}, { bounds: { w: W, d: D, h: H }, anchors, lights, update() { } });
}

function stoolPlastic(K) { K.tinted('#d8442a', () => { K.cyl('plastic', 0.17, 0.03, 0, 0.27, 0, { seg: 12 }); }); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.8; K.tinted('#d8442a', () => K.cyl('plastic', 0.015, 0.28, Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, { seg: 4 })); } }
function routeBoard(ctx, w, h) {
  ctx.fillStyle = '#f4f0e0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1b4a8a'; ctx.fillRect(0, 0, w, h * 0.3); ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.2}px Arial Black, Arial`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('CEBU CITY JEEPNEY TERMINAL  -  SAKAY NA!', w / 2, h * 0.16);
  const n = ROUTES.length, cw = w / n;
  ROUTES.forEach((r, i) => { ctx.fillStyle = r[2]; ctx.fillRect(i * cw + 6, h * 0.36, cw - 12, h * 0.58); ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.3}px Arial Black, Arial`; ctx.fillText(r[0], i * cw + cw / 2, h * 0.52); ctx.font = `bold ${h * 0.085}px Arial`; wrapText(ctx, r[1], i * cw + cw / 2, h * 0.74, cw * 0.85, h * 0.1); });
}
function routeMap(ctx, w, h) {
  ctx.fillStyle = '#f4f0e0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1b4a8a'; ctx.fillRect(0, 0, w, h * 0.1); ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.065}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MGA RUTA / ROUTES', w / 2, h * 0.05);
  ROUTES.forEach((r, i) => { const y = h * 0.14 + i * h * 0.145; ctx.fillStyle = r[2]; ctx.fillRect(w * 0.05, y, w * 0.22, h * 0.11); ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.06}px Arial`; ctx.fillText(r[0], w * 0.16, y + h * 0.055); ctx.fillStyle = '#222'; ctx.textAlign = 'left'; ctx.font = `bold ${h * 0.045}px Arial`; ctx.fillText(r[1], w * 0.31, y + h * 0.04); ctx.font = `${h * 0.035}px Arial`; ctx.fillText('P13 / P15 student', w * 0.31, y + h * 0.085); ctx.textAlign = 'center'; });
}
