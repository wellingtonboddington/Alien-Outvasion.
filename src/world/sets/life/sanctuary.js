// Bead's Sanctuary (Georgia): a 100 x 100 m (10,000 m2) colourful circus-like fortress + an interior atrium with EEN robot assembly line, lab floor and holo control table.
//  createSanctuary() -> { root, exterior, interior, anchors, screens, update, dispose, setMode(), setGateOpen(a), bounds, ... }
//  Exterior = world frame (origin = courtyard centre, gate on the +Z wall, road leads away along +Z). The interior is a separate round hall (r=30 m) that sits IN_Y metres BELOW the exterior
//  (hidden under the lawn) so one set serves both; use setMode('exterior'|'interior'|'both') or add set.exterior / set.interior separately. Interior anchors are already offset.
import * as THREE from 'three';
import { RNG, TAU } from '../../../engine/common.js';
import { noise2 } from '../../../engine/proc.js';
import { Kit, signMesh, makeScreen } from './kit.js';
import { palm, plant, finishSet, A, AT, lampShade } from './props.js';
import { stripes } from './tex.js';

export const IN_Y = -100, HS = 50;
const FLAG = ['#e63946', '#f6c445', '#2a9d8f', '#3a6ea5', '#f08a24', '#9b59b6', '#f4f1de', '#ff6fa5'];
const put = (K, o, x, y, z) => { o.position.set(x, y, z); return K.mesh(o); };
export function eenLogo(ctx, w, h, { bg = '#101826', fg = '#ffffff', accent = '#46e6ff' } = {}) {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const cx = h * 0.5, cy = h / 2, r = h * 0.3; ctx.strokeStyle = accent; ctx.lineWidth = h * 0.05; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, TAU); ctx.fill();
  ctx.lineWidth = h * 0.03; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 1.15); ctx.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5); ctx.stroke(); }
  ctx.fillStyle = fg; ctx.font = `900 ${h * 0.6}px Arial Black, Arial`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('EEN', h * 1.1, h * 0.44);
  ctx.font = `bold ${h * 0.13}px Arial`; ctx.fillStyle = accent; ctx.fillText('ROBOTICS  -  INTELLIGENCE  -  HUMANITY', h * 1.12, h * 0.84);
}
function flagGeo(s) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.2 * s, 0, 0, 0.2 * s, 0, 0, 0, -0.42 * s, 0], 3)); g.setAttribute('sway', new THREE.Float32BufferAttribute([0, 0, 1], 1)); g.setIndex([0, 1, 2]); return g; }
function bunting(K, rng, a, b, sag, n, s = 1) {
  const p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  K.tube('rubberBlack', [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].map(p), 0.02, { radial: 3, segs: 12 });
  const yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
  for (let i = 0; i < n; i++) { const q = p((i + 0.5) / n); K.tinted(FLAG[(i + rng.int(0, 2)) % FLAG.length], () => K.geo('bunting', flagGeo(s), q[0], q[1], q[2], yaw)); }
}
function strutXY(K, mat, a, b, w) { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); K.at([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]], [0, 0, Math.atan2(dy, dx) - Math.PI / 2], () => K.boxC(mat, w, len, w, 0, 0, 0)); }
function part(K, name, fn) { const k = K.sub(name); fn(k); k.build(); return k.root; }
function mats(K) {
  K.defMat('bunting', { color: 0xffffff, rough: 0.7, side: 'double', sway: 1.1 });
  K.defMat('bannerCloth', { color: 0xffffff, rough: 0.8, side: 'double', sway: 0.8 });
  K.defMat('gold', { color: 0xf0c040, rough: 0.3, metal: 1.0, env: 1.0, noAmb: false });
  K.defMat('water', { color: 0x3aa0c8, rough: 0.06, metal: 0.2, env: 1.3 });
  K.defMat('glowAmber', { glow: true, color: 0xffb050, intensity: 2.0 });
}
const stripeMat = (K, key, c1, c2, n, size = 256, extra = {}) => K.defMat(key, { map: stripes(c1, c2, n, size), color: 0xffffff, uv: 'own', rough: 0.55, side: 'double', env: 0.35, ...extra });

// ------------------------------------------------------------------ EEN robot (standing, +Z front, 1.9 m). stage 0..5 = progressive assembly
function eenbot(K, stage = 5) {
  const W = 'plastic#f2f2ee', D = 'darkMetal', G = 'glow#46e6ff';
  K.rbox(D, 0.3, 0.16, 0.2, 0.03, 0, 0.82, 0); K.cyl(D, 0.035, 0.5, 0, 0.9, -0.04, { seg: 6 }); for (let i = 0; i < 4; i++) K.box(D, 0.3 - i * 0.03, 0.02, 0.16, 0, 0.98 + i * 0.13, -0.03);
  if (stage >= 1) for (const s of [-1, 1]) { K.sph(D, 0.07, s * 0.1, 0.8, 0, { seg: 8, segH: 6 }); K.rbox(W, 0.13, 0.4, 0.14, 0.03, s * 0.1, 0.4, 0); K.sph(D, 0.06, s * 0.1, 0.42, 0.02, { seg: 8, segH: 6 }); K.rbox(W, 0.11, 0.38, 0.12, 0.03, s * 0.1, 0.05, 0); K.rbox(D, 0.12, 0.06, 0.26, 0.02, s * 0.1, 0, 0.05); }
  if (stage >= 2) { K.rbox(W, 0.44, 0.5, 0.26, 0.07, 0, 0.96, 0.02); K.box(D, 0.3, 0.05, 0.22, 0, 1.4, 0.02); if (stage >= 5) K.cyl(G, 0.05, 0.02, 0, 1.2, 0.155, { axis: 'z', seg: 12 }); else K.cyl(D, 0.05, 0.02, 0, 1.2, 0.155, { axis: 'z', seg: 12 }); }
  if (stage >= 3) for (const s of [-1, 1]) { K.sph(W, 0.09, s * 0.28, 1.38, 0, { seg: 8, segH: 6 }); K.rbox(W, 0.09, 0.32, 0.1, 0.03, s * 0.3, 1.07, 0); K.sph(D, 0.05, s * 0.3, 1.07, 0, { seg: 6, segH: 5 }); K.rbox(W, 0.08, 0.3, 0.09, 0.03, s * 0.3, 0.78, 0.03); K.sph(D, 0.06, s * 0.3, 0.76, 0.03, { seg: 6, segH: 5 }); }
  if (stage >= 4) { K.cyl(D, 0.04, 0.08, 0, 1.44, 0, { seg: 6 }); K.sph(W, 0.13, 0, 1.62, 0, { seg: 12, segH: 8, s: [1, 1.08, 1.05] }); K.rbox('screenOff', 0.2, 0.1, 0.06, 0.02, 0, 1.58, 0.1); if (stage >= 5) K.box('glow#46e6ff', 0.17, 0.018, 0.012, 0, 1.63, 0.141); }
}
function workbench(K, rng, w = 3.2) {
  K.box('steel', w, 0.05, 0.9, 0, 0.85, 0); K.box('darkMetal', w - 0.1, 0.8, 0.8, 0, 0.0, 0); for (let i = 0; i < 4; i++) K.box('steelPlain', 0.4, 0.02, 0.01, -w / 2 + 0.5 + i * (w - 1) / 3, 0.5, 0.41);
  K.box('darkMetal', w, 0.9, 0.04, 0, 0.9, -0.4); for (let i = 0; i < 10; i++) K.tinted(rng.pick(['#d9422a', '#e8c020', '#2a6ad0', '#c8c8c8']), () => K.box('plastic', 0.02, 0.2 + rng.range(0, 0.15), 0.02, -w / 2 + 0.2 + i * (w - 0.4) / 9, 1.35, -0.36));
  for (let i = 0; i < 3; i++) K.at([-w / 2 + 0.5 + i * 1.1, 0.9, 0.0], rng.range(-1, 1), () => { K.sph('plastic#f2f2ee', 0.11, 0, 0.12, 0, { seg: 8, segH: 6 }); K.box('screenOff', 0.15, 0.06, 0.04, 0, 0.1, 0.08); K.rbox('plastic#f2f2ee', 0.09, 0.3, 0.1, 0.03, 0.3, 0.02, 0); });
}

// ================================================================== EXTERIOR
function buildExterior() {
  const K = new Kit({ name: 'sanctuary_exterior', env: 'day', seed: 71, castShadow: false }); const rng = new RNG(71); mats(K);
  K.setAmbience({ min: [-130, 0, -130], max: [130, 40, 130], floor: 0.2, wall: 0.0, ceil: 0.0, range: 1.5 });
  stripeMat(K, 'topA', '#d92b3a', '#f7f0e0', 20); stripeMat(K, 'topB', '#2a6ab8', '#f6c445', 16); stripeMat(K, 'topC', '#1f9a8a', '#f4e8d8', 16); stripeMat(K, 'topD', '#8a3aa8', '#f4d0e0', 14);
  const TOPS = ['topA', 'topB', 'topC', 'topD'];
  // ---- ground
  K.cyl('grass', 420, 0.5, 0, -0.5, 0, { seg: 48 }); K.slab('tileFloor#e4d6bc', -HS + 1.5, -0.05, -HS + 1.5, HS - 1.5, 0.04, HS - 1.5);
  for (let i = 0; i < 6; i++) K.cyl(['paint#d9423a', 'paint#f4efe0'][i % 2], 27.5 - i * 1.0, 0.012, 0, 0.04 + i * 0.006, -5, { seg: 72 });
  K.slab('asphalt#5a5c62', -7, -0.3, HS + 1.5, 7, 0.03, 330); for (let i = 0; i < 40; i++) K.slab('paint#f0e8c0', -0.15, 0.03, HS + 6 + i * 6, 0.15, 0.036, HS + 9 + i * 6);
  K.cyl('tileFloor#d8cbb0', 20, 0.06, 0, 0, HS + 14, { seg: 48 });
  for (const s of [-1, 1]) { K.slab('concrete#b8b2a2', s * 7, -0.3, HS + 1.5, s * 7.5, 0.12, 330); }
  // ---- walls (local frame per wall: x along the wall, +z outward)
  const wallRun = (side) => {
    const L = 2 * HS + 3, n = Math.round(L / 6.5), sw = L / n;
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + sw * (i + 0.5); if (side === 'S' && Math.abs(x) < 15.5) continue;
      K.tinted(FLAG[(i * 3 + 1) % 8] === '#f4f1de' ? '#f0d8b8' : ['#f0e0c4', '#e86a5a', '#f6d070', '#7ac0b8'][i % 4], () => K.box('plaster', sw + 0.02, 9, 3, x, 0, 0));
      K.tinted('#d9423a', () => K.box('plaster', sw + 0.02, 0.5, 3.3, x, 8.2, 0));
      K.tinted('#2a2a3a', () => K.box('concrete', sw + 0.02, 0.8, 3.4, x, 0, 0));
      for (let m = 0; m < 3; m++) K.tinted(['#f0e0c4', '#f6d070'][(i + m) % 2], () => K.box('plaster', 1.4, 1.0, 0.8, x - 2.2 + m * 2.2, 9.0, 1.1));
      K.box('plaster#e8dcc0', sw, 0.6, 0.5, x, 9.0, -1.25); K.sph('glowAmber', 0.22, x, 6.8, 1.7, { seg: 6, segH: 5 });
      if (i % 2 === 0) K.tinted(FLAG[i % 8], () => K.box('plaster', 1.5, 9.6, 1.0, x + sw / 2, 0, 1.9));
    }
  };
  for (const [side, pos, yaw] of [['S', [0, 0, HS], 0], ['E', [HS, 0, 0], Math.PI / 2], ['N', [0, 0, -HS], Math.PI], ['W', [-HS, 0, 0], -Math.PI / 2]]) K.at(pos, yaw, () => wallRun(side));
  // ---- towers
  const tower = (x, z, r, h, mat) => {
    K.tinted('#f0e0c4', () => K.cyl('plaster', r, h, x, 0, z, { seg: 28 }));
    for (const y of [5, h * 0.55, h - 3.2]) K.cyl('gold', r + 0.15, 0.5, x, y, z, { seg: 28 });
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; K.box('glowAmber', 0.35, 1.8, 0.2, x + Math.cos(a) * r, h * 0.35, z + Math.sin(a) * r, -a + Math.PI / 2); }
    K.cyl('paint#2a2230', r + 1.2, 0.5, x, h - 0.3, z, { seg: 28 }); K.cyl(mat, r + 1.5, h * 0.5, x, h + 0.2, z, { seg: 28, rt: 0.0 });
    K.cyl('gold', 0.12, 4, x, h + h * 0.5 + 0.1, z, { seg: 6 }); K.sph('gold', 0.4, x, h + h * 0.5 + 4.2, z, { seg: 8, segH: 6 });
    K.tinted(FLAG[Math.abs(Math.round(x + z)) % 8], () => K.cloth('bannerCloth', 3.4, 1.6, x + 1.8, h + h * 0.5 + 2.8, z, Math.PI / 2 * 0, { ws: 8, hs: 2 }));
  };
  [[-HS, -HS], [HS, -HS], [-HS, HS], [HS, HS]].forEach(([x, z], i) => tower(x, z, 6.5, 24, TOPS[i]));
  tower(0, -HS, 4, 16, 'topC'); tower(HS, 0, 4, 16, 'topD'); tower(-HS, 0, 4, 16, 'topB');
  // ---- gate complex (south wall)
  for (const s of [-1, 1]) {
    const gx = s * 11.5; K.tinted(s < 0 ? '#e86a5a' : '#f6d070', () => K.box('plaster', 9, 20, 9, gx, 0, HS)); K.tinted('#f4efe0', () => K.box('plaster', 9.4, 1.0, 9.4, gx, 12, HS)); K.cyl(TOPS[s < 0 ? 0 : 1], 6.6, 9, gx, 20, HS, { seg: 4, rt: 0.0, rot: Math.PI / 4 });
    K.cyl('gold', 0.1, 4, gx, 29, HS, { seg: 6 }); K.sph('gold', 0.35, gx, 33, HS, { seg: 8, segH: 6 });
    for (let k = 0; k < 3; k++) K.box('glowAmber', 0.9, 2.2, 0.15, gx - 2.5 + k * 2.5, 7 + (k % 2) * 4, HS + 4.55);
    K.tinted(FLAG[(s + 2) * 2], () => K.cloth('bannerCloth', 3.4, 1.5, gx + 1.8, 31.5, HS, 0, { ws: 8, hs: 2 }));
  }
  K.tinted('#d9423a', () => K.box('plaster', 14, 5, 6, 0, 11, HS)); K.box('gold', 14.4, 0.5, 6.4, 0, 16, HS); K.box('gold', 14.4, 0.5, 6.4, 0, 10.7, HS);
  for (let i = 0; i < 18; i++) K.sph('glowAmber', 0.18, -6.8 + i * 0.8, 10.6, HS + 3.25, { seg: 6, segH: 5 });
  put(K, signMesh(11.6, 3.2, eenLogo, { px: 90, lit: true, emissive: 1.0, bg: '#101826' }), 0, 13.5, HS + 3.05);
  K.slab('gold', -7, 0, HS - 3.2, -6, 11, HS + 3.2); K.slab('gold', 6, 0, HS - 3.2, 7, 11, HS + 3.2);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) K.sph('gold', 0.25, s * 6.5, 11.2 + i * 0.0, HS + 3.2 + 0.0, { seg: 6, segH: 4 });
  // gate leaves (animated)
  const leaves = []; const leafGeo = (k, s0) => { const s = -s0; k.tinted('#ffffff', () => { k.box('topA', 6, 10, 0.5, s * 3, 0, 0); k.box('gold', 6.1, 0.5, 0.7, s * 3, 9.5, 0); k.box('gold', 6.1, 0.5, 0.7, s * 3, 0, 0); k.box('gold', 0.4, 10, 0.7, s * 5.8, 0, 0); k.box('gold', 0.3, 10, 0.7, s * 0.3, 0, 0); for (let j = 0; j < 5; j++) k.sph('gold', 0.15, s * (1 + j * 1), 5, 0.4, { seg: 6, segH: 4 }); }); };
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 6, 0, HS); g.add(part(K, 'leaf' + s, (k) => leafGeo(k, s))); g.userData.s = s; leaves.push(g); }
  // ---- big top
  const BT = [0, 0, -5];
  K.tinted('#f4e8d0', () => K.cyl('plaster', 20, 8, BT[0], 0, BT[2], { seg: 48 })); K.cyl('gold', 20.3, 0.6, 0, 7.6, BT[2], { seg: 48 }); K.cyl('gold', 20.3, 0.6, 0, 0, BT[2], { seg: 48 });
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; K.at([Math.cos(a) * 20.1, 0, BT[2] + Math.sin(a) * 20.1], -a + Math.PI / 2, () => { K.box('gold', 0.8, 7.8, 0.5, 0, 0, 0); K.box('glowAmber', 1.5, 3.0, 0.1, 1.6, 2.5, 0.05); }); }
  K.sph('topA', 20.2, 0, 8, BT[2], { seg: 48, segH: 18, thL: Math.PI / 2, s: [1, 0.72, 1] });
  K.cyl('gold', 0.5, 9, 0, 22.3, BT[2], { seg: 8, rt: 0.15 }); K.sph('gold', 1.0, 0, 31.6, BT[2], { seg: 12, segH: 8 }); K.cyl('gold', 0.08, 6, 0, 32.4, BT[2], { seg: 6 });
  K.tinted('#e63946', () => K.cloth('bannerCloth', 5.5, 2.4, 3.0, 36.0, BT[2], 0, { ws: 10, hs: 2 }));
  K.tinted('#f4efe0', () => K.box('plaster', 11, 9, 5, 0, 0, 15.5)); K.tinted('#2a1a28', () => K.box('matte', 5.4, 6.4, 0.3, 0, 0, 18.1)); K.box('gold', 6.2, 0.5, 0.5, 0, 6.5, 18.2);
  for (let i = 0; i < 14; i++) K.sph('glowAmber', 0.16, -3.0 + i * 0.46, 6.6, 18.55, { seg: 6, segH: 4 });
  put(K, signMesh(9, 2.3, eenLogo, { px: 80, lit: true, emissive: 1.0, bg: '#101826' }), 0, 8.2, 18.05);
  K.cyl('topA', 7.5, 3, 0, 9, 15.5, { seg: 4, rt: 0, rot: Math.PI / 4, s: [1, 0.7] });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; bunting(K, rng, [0, 30.8, BT[2]], [Math.cos(a) * 20.6, 8.6, BT[2] + Math.sin(a) * 20.6], 1.6, 9, 1.1); }
  // ---- small domes, tents, hall
  const dome = (x, z, r, mat, dh = 4.5) => { K.tinted('#f4e8d0', () => K.cyl('plaster', r, dh, x, 0, z, { seg: 32 })); K.cyl('gold', r + 0.15, 0.4, x, dh - 0.4, z, { seg: 32 }); K.sph(mat, r + 0.1, x, dh, z, { seg: 32, segH: 12, thL: Math.PI / 2, s: [1, 0.75, 1] }); K.cyl('gold', 0.2, 3, x, dh + r * 0.75 - 0.2, z, { seg: 6, rt: 0.08 }); K.sph('gold', 0.45, x, dh + r * 0.75 + 2.9, z, { seg: 8, segH: 6 }); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; K.box('glowAmber', 0.8, 1.6, 0.1, x + Math.cos(a) * r, 1.4, z + Math.sin(a) * r, -a + Math.PI / 2); } };
  dome(-34, -32, 9, 'topB'); dome(34, -32, 9, 'topC'); dome(-35, -10, 7, 'topD'); dome(-36, 5, 6, 'topA');
  const tent = (x, z, r, h, mat) => { K.cyl(mat, r, h * 0.45, x, 0, z, { seg: 20 }); K.cyl(mat, r * 1.12, h * 0.55, x, h * 0.45, z, { seg: 20, rt: 0.05 }); K.cyl('gold', 0.08, 2.4, x, h, z, { seg: 6 }); K.tinted(FLAG[Math.abs(Math.round(x)) % 8], () => K.cloth('bannerCloth', 1.4, 0.8, x + 0.75, h + 1.7, z, 0, { ws: 5, hs: 2 })); K.box('matte#2a1a28', 1.2, 2.0, 0.1, x, 0, z + r - 0.02); };
  [[-22, 36, 'topA'], [22, 36, 'topB'], [-42, -22, 'topC'], [44, -18, 'topD'], [-22, -38, 'topB'], [22, -38, 'topA'], [44, -6, 'topC']].forEach(([x, z, m]) => tent(x, z, 4, 7, m));
  K.tinted('#f6d070', () => K.box('plaster', 18, 7, 8, 38, 0, 28)); K.tinted('#e86a5a', () => K.box('plaster', 18.6, 0.8, 8.6, 38, 7, 28)); K.box('glowAmber', 4, 3, 0.1, 38, 1.5, 32.05);
  // ---- Ferris wheel (east courtyard)
  const WHUB = [31, 16.8, 16], R = 14, NG = 16; const wheel = new THREE.Group(); wheel.position.set(...WHUB);
  wheel.add(part(K, 'wheel', (k) => {
    for (const z of [-1.4, 1.4]) { k.torus('steelPlain', R, 0.16, 0, 0, z, 0, { seg: 6, segR: 64 }); k.torus('glow#ffd890', R - 1.8, 0.07, 0, 0, z, 0, { seg: 4, segR: 48 }); }
    for (let i = 0; i < NG; i++) { const a = i / NG * TAU; for (const z of [-1.4, 1.4]) k.at([0, 0, z], [0, 0, a - Math.PI / 2], () => k.box('steelPlain', 0.12, R, 0.12, 0, 0, 0)); k.box('steelPlain', 0.1, 0.1, 2.8, Math.cos(a) * R, Math.sin(a) * R - 0.05, 0); }
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; for (const z of [-1.4, 1.4]) k.sph('glow#ffe0a0', 0.13, Math.cos(a) * (R + 0.2), Math.sin(a) * (R + 0.2), z, { seg: 5, segH: 4 }); }
    k.cyl('gold', 0.6, 4, 0, 0, 0, { axis: 'z', seg: 12 });
  }));
  for (const z of [-2.4, 2.4]) { strutXY(K, 'steelPlain#d9423a', [WHUB[0], WHUB[1], WHUB[2] + z], [WHUB[0] - 8, 0, WHUB[2] + z], 0.35); strutXY(K, 'steelPlain#d9423a', [WHUB[0], WHUB[1], WHUB[2] + z], [WHUB[0] + 8, 0, WHUB[2] + z], 0.35); K.box('concrete', 20, 0.4, 1.0, WHUB[0], 0, WHUB[2] + z); }
  K.box('steelPlain', 0.4, 0.4, 5, WHUB[0], WHUB[1] - 0.2, WHUB[2]); K.box('concrete#c0b8a8', 6, 0.6, 7, WHUB[0] + 11.5, 0, WHUB[2] + 0.0); K.cyl('plaster#f6d070', 2.5, 4, WHUB[0] + 11.5, 0.6, WHUB[2], { seg: 10 }); K.cyl('topB', 3.2, 1.6, WHUB[0] + 11.5, 4.6, WHUB[2], { seg: 10, rt: 0.0 });
  const gondolas = []; const GC = ['#e63946', '#f6c445', '#2a9d8f', '#3a6ea5'];
  const gProto = GC.map((c, i) => part(K, 'gond' + i, (k) => { k.cyl('darkMetal', 0.025, 0.9, 0, -0.9, 0, { seg: 4 }); k.tinted(c, () => { k.rbox('plastic', 1.5, 1.1, 1.2, 0.1, 0, -2.0, 0); k.cyl('plastic', 1.0, 0.45, 0, -0.9, 0, { seg: 8, rt: 0.05 }); }); k.tinted('#bfe6f4', () => k.box('glass', 1.52, 0.5, 1.22, 0, -1.7, 0)); k.tinted('#fff4c8', () => k.box('glow', 1.3, 0.04, 1.0, 0, -1.0, 0)); k.box('woodGrain#6a4a2a', 1.3, 0.06, 0.9, 0, -1.9, 0); }));
  for (let i = 0; i < NG; i++) { const g = gProto[i % 4].clone(); gondolas.push(g); }
  // ---- helipad (north-west courtyard)
  K.cyl('concrete#8a8a86', 10, 0.5, -30, 0, 22, { seg: 40 }); K.cyl('paint#2e3238', 9, 0.02, -30, 0.5, 22, { seg: 40 }); K.cyl('paint#f4f4f0', 7.8, 0.02, -30, 0.52, 22, { seg: 40 }); K.cyl('paint#2e3238', 7.4, 0.02, -30, 0.54, 22, { seg: 40 });
  K.box('paint#f4d020', 0.9, 0.02, 6, -32.2, 0.56, 22); K.box('paint#f4d020', 0.9, 0.02, 6, -27.8, 0.56, 22); K.box('paint#f4d020', 4.4, 0.02, 0.9, -30, 0.56, 22);
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; K.sph('glow#7aff8a', 0.16, -30 + Math.cos(a) * 9.6, 0.55, 22 + Math.sin(a) * 9.6, { seg: 5, segH: 4 }); }
  K.cyl('steelPlain', 0.06, 6, -39.5, 0.5, 14, { seg: 6 }); K.tinted('#ff7a1a', () => K.cloth('bannerCloth', 1.6, 0.5, -38.7, 6.2, 14, 0, { ws: 6, hs: 2 }));
  // ---- fountain + gardens + lamps + palms
  K.cyl('marble#efe6d6', 5.5, 0.7, 0, 0, 34, { seg: 36 }); K.cyl('water', 5.0, 0.04, 0, 0.62, 34, { seg: 36 }); K.lathe('marble#efe6d6', [[0.0, 0], [0.6, 0], [0.7, 1.4], [1.9, 1.7], [1.2, 1.9], [0.25, 2.0], [0.25, 3.0], [0.9, 3.2], [0.0, 3.4]], 0, 0.6, 34, { seg: 24 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; K.tube('glass#cfeeff', [[Math.cos(a) * 0.5, 3.4, 34 + Math.sin(a) * 0.5], [Math.cos(a) * 2.2, 4.4, 34 + Math.sin(a) * 2.2], [Math.cos(a) * 4.0, 0.7, 34 + Math.sin(a) * 4.0]], 0.05, { radial: 4, segs: 12 }); }
  const bed = (x, z, w, d, c1, c2) => { K.tinted('#e8dcc0', () => { K.box('concrete', w + 0.6, 0.35, 0.3, x, 0, z - d / 2 - 0.15); K.box('concrete', w + 0.6, 0.35, 0.3, x, 0, z + d / 2 + 0.15); K.box('concrete', 0.3, 0.35, d, x - w / 2 - 0.15, 0, z); K.box('concrete', 0.3, 0.35, d, x + w / 2 + 0.15, 0, z); }); K.box('paint#3a2a1c', w, 0.3, d, x, 0, z); for (let i = 0; i < 70; i++) K.tinted(rng.chance(0.5) ? c1 : c2, () => K.sph('plastic', 0.17, x + rng.range(-w / 2, w / 2) * 0.95, 0.5, z + rng.range(-d / 2, d / 2) * 0.95, { seg: 5, segH: 4 })); };
  const beds = [[-12, 24, 8, 4, '#ff5a7a', '#ffd23a'], [12, 24, 8, 4, '#9a5ae8', '#ffffff'], [-12, 44, 8, 4, '#ffd23a', '#ff8a2a'], [12, 44, 8, 4, '#ff7aa8', '#ffffff'], [-19, 34, 4, 9, '#ffffff', '#ff5a7a'], [19, 34, 4, 9, '#ffd23a', '#9a5ae8'], [-30, 40, 8, 4, '#ff5a7a', '#ffd23a'], [30, 44, 6, 4, '#ffffff', '#ff8a2a'], [28, -2, 6, 5, '#ff7aa8', '#ffd23a']];
  for (const b of beds) bed(...b);
  for (let i = 0; i < 14; i++) { const s = i % 2 ? 1 : -1, z = 20 + Math.floor(i / 2) * 5.4; K.cyl('darkMetal', 0.08, 5, s * 8, 0, z, { seg: 6 }); K.sph('glowAmber', 0.4, s * 8, 5.2, z, { seg: 8, segH: 6 }); }
  for (let i = 0; i < 14; i++) { const a = i * 2.4; const x = [-44, 44, -26, 26, -44, 44, -40, 40, 16, -16, 30, -30, 44, -44][i], z = [44, 44, 46, 46, 28, 28, -44, -44, 22, 22, -42, -42, 0, -14][i]; K.at([x, 0, z], a, () => palm(K, 6 + rng.range(0, 4), { seed: i + 3, lean: 0.12, fronds: 11 })); }
  for (let i = 0; i < 6; i++) K.at([-2.5 + (i % 3) * 2.5, 0, 52.5 + Math.floor(i / 3) * 0], 0, () => { });
  // ---- bunting across the avenue + banners on walls
  for (const z of [26, 38, 48]) for (const s of [-1, 1]) { K.cyl('steelPlain', 0.12, 11, s * 14, 0, z, { seg: 6 }); K.sph('gold', 0.3, s * 14, 11.1, z, { seg: 6, segH: 4 }); }
  for (const z of [26, 38, 48]) bunting(K, rng, [-14, 10.8, z], [14, 10.8, z], 1.8, 22);
  for (let i = 0; i < 6; i++) bunting(K, rng, [-14, 10.8, [26, 38, 48][i % 3]], [14, 10.8, [38, 48, 26][i % 3]], 2.2, 28, 0.9);
  for (const x of [-30, -16, 16, 30]) { K.at([x, 0, HS - 1.6], Math.PI, () => { K.tinted(FLAG[Math.abs(x) % 8], () => K.box('plastic', 3.2, 6.5, 0.1, 0, 2.0, 0)); }); K.at([x, 0, HS - 1.5], Math.PI, () => put(K, signMesh(2.6, 1.2, (c, w, h) => eenLogo(c, w, h, { bg: '#101826' }), { px: 80, lit: true, emissive: 0.8, bg: '#101826' }), 0, 5.2, 0.06)); }
  // ---- wall-top details: guard posts + searchlights
  for (const s of [-1, 1]) { K.at([s * 26, 9, HS], 0, () => { K.box('plaster#e8dcc0', 2.4, 2.6, 2.2, 0, 0, 0.0); K.tinted('#d9423a', () => K.cyl('topA', 1.9, 1.4, 0, 2.6, 0, { seg: 4, rt: 0, rot: Math.PI / 4 })); K.box('glow#cfeaff', 1.4, 0.4, 0.1, 0, 1.4, 1.12); }); }
  // ---- anchors
  const anchors = {
    gate: A([0, 0, HS + 9], Math.PI), gate_courtyard: A([0, 0, HS - 6], 0), wall_top: A([8, 9, HS + 0.2], 0), wall_top2: A([-9, 9, HS + 0.2], 0), wall_top_in: A([8, 9, HS - 0.6], Math.PI),
    helipad: A([-30, 0.5, 22], 0), fountain: AT([0, 0, 40], [0, 1.2, 34]), courtyard: A([0, 0.04, 28], Math.PI), bigtop_door: A([0, 0.04, 21.5], Math.PI), wheel: AT([24, 0, 24], [31, 8, 16]), road: A([0, 0.03, HS + 40], Math.PI),
    camWide: AT([88, 62, 112], [0, 8, -4]), camMid: AT([14, 2.0, HS + 24], [0, 7, HS]), camAerial: AT([100, 80, 100], [0, 4, 0]), camAerial2: AT([-70, 45, 125], [0, 6, 10]), camGate: AT([0, 1.7, HS + 28], [0, 8, HS]), camGateHigh: AT([20, 14, HS + 40], [0, 9, HS]),
    camWallTop: AT([-4, 10.7, HS + 0.5], [14, 11.5, HS + 40]), camWallInside: AT([16, 11, HS - 0.5], [0, 10.5, HS + 0.6]), camCourtyard: AT([0, 1.7, HS - 8], [0, 12, -5]), camBigTop: AT([14, 2, 36], [0, 14, -5]), camWheel: AT([8, 3, 34], [31, 14, 16]),
    camHelipad: AT([-14, 3, 36], [-30, 1, 22]), camFountain: AT([10, 1.8, 46], [0, 2, 34]), camTower: AT([-20, 3, HS + 12], [-HS, 22, HS]),
  };
  let gateOpen = 0; const setGate = (a) => { gateOpen = a; for (const g of leaves) g.rotation.y = g.userData.s * a * 1.45; }; setGate(0);
  const hemiX = new THREE.HemisphereLight(0xd8e8ff, 0x7a6a50, 0.35);
  const api = finishSet(K, { setGateOpen: setGate, getGateOpen: () => gateOpen }, { bounds: { w: 104, d: 104, h: 40 }, anchors, lights: [hemiX], extraObjs: [wheel, ...gondolas, ...leaves],
    update(dt, t) { wheel.rotation.z = -t * 0.06; for (let i = 0; i < NG; i++) { const a = i / NG * TAU + -t * 0.06; gondolas[i].position.set(WHUB[0] + Math.cos(a) * R, WHUB[1] + Math.sin(a) * R, WHUB[2]); } } });
  gondolas.forEach((g, i) => { const a = i / NG * TAU; g.position.set(WHUB[0] + Math.cos(a) * R, WHUB[1] + Math.sin(a) * R, WHUB[2]); });
  return api;
}

// ================================================================== INTERIOR (round hall, r=30)
function buildInterior() {
  const K = new Kit({ name: 'sanctuary_interior', env: 'interior', seed: 72 }); const rng = new RNG(72); mats(K);
  const R = 30, HW = 9;
  K.setAmbience({ min: [-R, 0, -R], max: [R, 17, R], floor: 0.35, wall: 0.3, ceil: 0.25, range: 1.6 });
  stripeMat(K, 'tentA', '#d92b3a', '#f7f0e0', 28, 256, { selfLit: 0.6 }); stripeMat(K, 'ringStripe', '#d92b3a', '#f7f0e0', 96, 512, { selfLit: 0.15 });
  K.defMat('holoGlass', { color: 0x46e6ff, rough: 0.1, transparent: true, opacity: 0.25, noShadow: true, emissive: 0x46e6ff, emissiveIntensity: 0.6 });
  // ---- hall shell
  K.cyl('marble#efe6d6', R, 0.3, 0, -0.3, 0, { seg: 64 }); K.cyl('paint#b3262d', 9.5, 0.02, 0, 0.0, 0, { seg: 48 }); K.cyl('paint#f4efe0', 9.8, 0.015, 0, 0.0, 0, { seg: 48 }); K.cyl('gold', 9.9, 0.012, 0, 0.0, 0, { seg: 48 });
  for (const [r, c] of [[29.4, 'paint#d9423a'], [28.4, 'paint#f4efe0'], [27.4, 'paint#2a6ab8']]) K.torus(c, r, 0.12, 0, 0.02, 0, [Math.PI / 2, 0, 0], { seg: 3, segR: 96 });
  K.defMat('wallD', { map: 'plaster', color: 0xffffff, rough: 0.9, tile: 2.4, side: 'double' }); K.tinted('#f4e8d2', () => K.cyl('wallD', R, HW, 0, 0, 0, { seg: 64, open: true })); K.cyl('ringStripe', R - 0.12, 2.4, 0, 0, 0, { seg: 96, open: true }); K.torus('gold', R - 0.2, 0.2, 0, 2.4, 0, [Math.PI / 2, 0, 0], { seg: 4, segR: 96 }); K.torus('gold', R - 0.3, 0.3, 0, HW, 0, [Math.PI / 2, 0, 0], { seg: 4, segR: 96 });
  K.torus('glow#ffe0b0', R - 0.5, 0.1, 0, HW - 0.5, 0, [Math.PI / 2, 0, 0], { seg: 3, segR: 96 });
  K.cyl('tentA', R + 0.4, 8.4, 0, HW, 0, { seg: 64, rt: 0.3, open: true }); K.sph('gold', 0.8, 0, 17.3, 0, { seg: 10, segH: 8 });
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; K.tube('gold', [[0, 17.2, 0], [Math.cos(a) * 14, 13.2, Math.sin(a) * 14], [Math.cos(a) * 29.8, HW + 0.1, Math.sin(a) * 29.8]], 0.06, { radial: 4, segs: 10 }); }
  for (let i = 0; i < 28; i++) { const a = (i + 0.5) / 28 * TAU; bunting(K, rng, [0, 16.4, 0], [Math.cos(a) * 29.2, HW + 0.1, Math.sin(a) * 29.2], 1.2, 12, 1.2); }
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; K.at([Math.cos(a) * (R - 0.45), 0, Math.sin(a) * (R - 0.45)], Math.atan2(-Math.cos(a), -Math.sin(a)), () => { K.tinted(['#f6d070', '#e86a5a', '#7ac0b8', '#f0e0c4'][i % 4], () => K.box('plaster', 1.2, HW, 0.5, 0, 0, 0)); K.box('gold', 1.4, 0.3, 0.6, 0, 6.5, 0); if (i % 2) { K.box('glow#ffe0b0', 0.2, 2.6, 0.1, 1.9, 3, 0.2); K.box('glow#ffe0b0', 0.2, 2.6, 0.1, -1.9, 3, 0.2); } }); }
  // lights: hanging rings + globes
  for (const [r, y] of [[12, 11.6], [6, 12.8], [20, 10.6]]) { K.torus('glow#bfe6ff', r, 0.12, 0, y, 0, [Math.PI / 2, 0, 0], { seg: 4, segR: 64 }); K.torus('gold', r, 0.06, 0, y + 0.18, 0, [Math.PI / 2, 0, 0], { seg: 4, segR: 64 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; K.tube('gold', [[0, 17, 0], [Math.cos(a) * r * 0.5, 15, Math.sin(a) * r * 0.5], [Math.cos(a) * r, y + 0.2, Math.sin(a) * r]], 0.025, { radial: 3, segs: 6 }); } }
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, r = i % 2 ? 16 : 24; K.sph('glowWarm', 0.28, Math.cos(a) * r, 9.6, Math.sin(a) * r, { seg: 8, segH: 6 }); K.cyl('rubberBlack', 0.01, 1.4, Math.cos(a) * r, 10.0, Math.sin(a) * r, { seg: 3 }); }
  // entrance door (+z)
  K.at([0, 0, R - 0.4], Math.PI, () => { K.box('gold', 6.4, 0.5, 0.6, 0, 5.6, 0); K.box('gold', 0.5, 5.6, 0.6, -3.1, 0, 0); K.box('gold', 0.5, 5.6, 0.6, 3.1, 0, 0); K.box('woodGrain#5a3418', 2.9, 5.5, 0.2, -1.5, 0, 0); K.box('woodGrain#5a3418', 2.9, 5.5, 0.2, 1.5, 0, 0); K.box('glow#aeffc0', 1.2, 0.3, 0.05, 0, 6.2, 0); for (const s of [-1, 1]) K.box('gold', 0.1, 0.5, 0.1, s * 0.3, 2.5, 0.2); });
  // ---- gallery balcony (north arc)
  for (let i = 0; i < 18; i++) { const a = (200 + i * 8.2) * Math.PI / 180, r = 27.4; K.at([Math.cos(a) * r, 0, Math.sin(a) * r], Math.atan2(-Math.cos(a), -Math.sin(a)), () => { K.box('woodGrain#6a4a2a', 3.9, 0.25, 3.2, 0, 4.4, 0); K.box('gold', 0.35, 4.4, 0.35, 1.8, 0, 1.4); K.box('plastic#d9422a', 3.9, 0.9, 0.06, 0, 4.65, 1.58); }); }
  { const pts = []; for (let i = 0; i <= 36; i++) { const a = (198 + i * 4.1) * Math.PI / 180; pts.push([Math.cos(a) * 25.9, 5.6, Math.sin(a) * 25.9]); } K.tube('brass', pts, 0.04, { radial: 5, segs: 72, smooth: false }); }
  // ---- back wall logo + wall screens
  const wallScreens = [];
  for (const [deg, w, h, y, kind] of [[270, 14, 4, 5.4, 'logo'], [243, 4.4, 2.5, 3.8, 'a'], [297, 4.4, 2.5, 3.8, 'b']]) { const a = deg * Math.PI / 180; K.at([Math.cos(a) * 29.3, 0, Math.sin(a) * 29.3], Math.atan2(-Math.cos(a), -Math.sin(a)), () => { if (kind === 'logo') put(K, signMesh(w, h, (c, ww, hh) => eenLogo(c, ww, hh), { px: 80, lit: true, emissive: 1.1, bg: '#101826' }), 0, y, 0); else { const s = makeScreen(w, h, { res: [512, 288], bright: 1.3 }); s.screen.kind = kind; wallScreens.push(s.screen); put(K, s.mesh, 0, y, 0); } }); }
  // ---- assembly line (z=-12, x -8..22)
  const BZ = -12, BX0 = -8, BX1 = 22, BL = BX1 - BX0, BM = (BX0 + BX1) / 2;
  K.box('darkMetal', BL, 0.8, 1.7, BM, 0, BZ); K.box('rubberBlack', BL - 0.2, 0.06, 1.35, BM, 0.8, BZ); for (let i = 0; i < 40; i++) K.cyl('steelPlain', 0.05, 1.5, BX0 + 0.4 + i * (BL - 0.8) / 39, 0.84, BZ, { axis: 'z', seg: 5 });
  K.box('glow#46e6ff', BL, 0.03, 0.04, BM, 0.45, BZ + 0.86); K.box('glow#46e6ff', BL, 0.03, 0.04, BM, 0.45, BZ - 0.86);
  for (const s of [-1, 1]) { K.tinted('#e8c020', () => K.box('plastic', BL, 0.05, 0.05, BM, 0.9, BZ + s * 3.4)); for (let i = 0; i <= 15; i++) K.tinted('#e8c020', () => K.box('plastic', 0.05, 0.9, 0.05, BX0 + i * BL / 15, 0, BZ + s * 3.4)); }
  for (const x of [0, 7, 14, 21]) { for (const s of [-1, 1]) K.box('steelPlain', 0.3, 5.2, 0.3, x, 0, BZ + s * 4.6); K.box('steelPlain', 0.3, 0.4, 9.5, x, 5.0, BZ); K.box('glow#eef6ff', 0.2, 0.05, 6, x, 4.9, BZ); }
  for (const s of [-1, 1]) K.box('steelPlain', BL + 2, 0.3, 0.3, BM, 5.0, BZ + s * 4.6);
  // station arms (articulated, animated)
  const arms = []; const armStations = [1, 6, 11, 16, 21];
  const mkArm = (x, side) => {
    const base = new THREE.Group(); base.position.set(x, 0, BZ + side * 2.2); const turn = new THREE.Group(); base.add(turn);
    turn.add(part(K, 'armB' + arms.length, (k) => { k.cyl('darkMetal', 0.4, 0.5, 0, 0, 0, { seg: 12 }); k.cyl('plastic#f2f2ee', 0.3, 0.5, 0, 0.5, 0, { seg: 12 }); k.sph('plastic#f2f2ee', 0.28, 0, 1.05, 0, { seg: 10, segH: 8 }); k.cyl('glow#46e6ff', 0.31, 0.03, 0, 0.7, 0, { seg: 12 }); }));
    const sh = new THREE.Group(); sh.position.y = 1.05; turn.add(sh); sh.add(part(K, 'armU' + arms.length, (k) => { k.rbox('plastic#f2f2ee', 0.28, 1.5, 0.26, 0.06, 0, 0, 0); k.sph('darkMetal', 0.22, 0, 1.5, 0, { seg: 8, segH: 6 }); }));
    const el = new THREE.Group(); el.position.y = 1.5; sh.add(el); el.add(part(K, 'armF' + arms.length, (k) => { k.rbox('plastic#f2f2ee', 0.2, 1.2, 0.2, 0.05, 0, 0, 0); k.box('darkMetal', 0.12, 0.3, 0.12, 0, 1.2, 0); k.box('glow#46e6ff', 0.14, 0.04, 0.14, 0, 1.45, 0); }));
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xcfffff, toneMapped: false })); spark.position.y = 1.62; el.add(spark);
    arms.push({ base, turn, sh, el, spark, side, ph: x * 0.31 + side }); return base;
  };
  const armRoots = []; for (const x of armStations) for (const s of [-1, 1]) armRoots.push(mkArm(x, s));
  // robots on the belt (lying, head toward +x). Stage groups cloned per unit
  const stageRoots = []; for (let s = 0; s <= 5; s++) stageRoots.push(part(K, 'bot' + s, (k) => eenbot(k, s)));
  const lay = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
  const units = []; const NU = 7; for (let i = 0; i < NU; i++) { const g = new THREE.Group(); const l = new THREE.Group(); l.quaternion.copy(lay); g.add(l); const st = stageRoots.map((r) => { const c = r.clone(); c.visible = false; l.add(c); return c; }); units.push({ g, st, cur: -1, x0: i * (BL / NU) }); }
  for (const [x, z, y] of [[24.6, -15, 0], [24.6, -12.5, 0.2], [24.6, -10, 0.1], [23.2, -8.6, 0.0]]) K.at([x, 0, z], -Math.PI / 2 + y * 3, () => eenbot(K, 5));
  // statues in niches
  for (let i = 0; i < 9; i++) { const a = [20, 35, 50, 65, 115, 130, 145, 160, 175][i] * Math.PI / 180, r = 28.2; K.at([Math.cos(a) * r, 0, Math.sin(a) * r], Math.atan2(-Math.cos(a), -Math.sin(a)), () => { K.cyl('marble#efe6d6', 0.6, 0.5, 0, 0, 0, { seg: 12 }); eenbot(K, 5); }); }
  // ---- lab floor (north-west)
  [[-22, -17], [-17, -17], [-22, -13], [-17, -13]].forEach(([x, z], i) => K.at([x, 0, z], Math.PI * (i < 2 ? 0 : 1) , () => workbench(K, rng, 3.4)));
  for (let i = 0; i < 3; i++) K.at([-26, 0, -7 + i * 3.4], Math.PI / 2 * -1 + Math.PI, () => { K.box('darkMetal', 0.6, 2.2, 2.6, 0, 0, 0); for (let j = 0; j < 4; j++) { K.box('steelPlain', 0.55, 0.03, 2.5, 0.05, 0.4 + j * 0.5, 0); for (let k = 0; k < 4; k++) K.tinted(rng.pick(['#f2f2ee', '#46e6ff', '#e8c020', '#d9422a']), () => K.rbox('plastic', 0.3, 0.25, 0.4, 0.04, 0.1, 0.43 + j * 0.5, -1 + k * 0.6)); } });
  K.at([-19, 0, -2.5], 0, () => { K.box('glass', 6, 3.2, 0.05, 0, 0, 2.5); K.box('glass', 6, 3.2, 0.05, 0, 0, -2.5); K.box('glass', 0.05, 3.2, 5, 3, 0, 0); K.box('glass', 0.05, 3.2, 5, -3, 0, 0); K.box('steelPlain', 6.1, 0.08, 5.1, 0, 3.2, 0); K.box('glow#eef6ff', 5.6, 0.04, 4.6, 0, 3.12, 0); K.at([0, 0, 0], 0, () => { K.box('steel', 3, 0.9, 1.2, 0, 0, 0); K.at([0, 0.9, 0], 0, () => eenbot(K, 3)); }); });
  // ---- holo control table (anchors bead_desk / visitor)
  const TB = [-6, 0, -1];
  K.at(TB, 0, () => { K.lathe('plastic#f2f2ee', [[0, 0], [1.4, 0], [1.2, 0.1], [0.5, 0.5], [0.45, 0.85], [0, 0.85]], 0, 0, 0, { seg: 24, s: 1 }); K.cyl('plastic#f6f6f2', 1, 0.08, 0, 0.82, 0, { seg: 40, s: [1.8, 1.0] }); K.cyl('glow#46e6ff', 1.0, 0.02, 0, 0.9, 0, { seg: 40, s: [1.8, 1.0] }); K.cyl('plastic#f6f6f2', 0.92, 0.01, 0, 0.91, 0, { seg: 40, s: [1.76, 0.96] }); K.cyl('glow#46e6ff', 0.55, 0.012, 0, 0.912, 0, { seg: 24, s: [1.0, 1.0] }); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; K.box('glow#46e6ff', 0.2, 0.012, 0.03, Math.cos(a) * 1.4, 0.915, Math.sin(a) * 0.8, -a); } K.torus('glow#46e6ff', 1.0, 0.02, 0, 0.83, 0, [Math.PI / 2, 0, 0], { seg: 3, segR: 40 }); });
  const holo = new THREE.Group(); holo.position.set(TB[0], 1.55, TB[2]);
  const hm = (op, wf) => new THREE.MeshBasicMaterial({ color: 0x46e6ff, transparent: true, opacity: op, wireframe: !!wf, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), hm(0.55, true)); const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), hm(0.18)); holo.add(globe, core);
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.72 + i * 0.12, 0.012, 4, 64), hm(0.8)); r.rotation.set(i * 1.0, i * 0.7, 0); holo.add(r); return r; });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.9, 0.7, 24, 1, true), hm(0.1)); beam.position.y = -0.62; holo.add(beam);
  const pts = []; for (let i = 0; i < 60; i++) { const v = rng.unit().multiplyScalar(0.55); pts.push(v); } const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: 0xaaffff, size: 0.03, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); holo.add(dots);
  const panels = [];
  for (const [dx, dz, ry, kind] of [[-3.3, 0.3, 0.9, 'a'], [3.3, 0.3, -0.9, 'b']]) { const s = makeScreen(1.5, 0.85, { res: [512, 290], bright: 1.5, frame: false }); s.screen.kind = kind; s.mesh.position.set(TB[0] + dx, 1.9, TB[2] + dz); s.mesh.rotation.y = ry; panels.push(s.screen); holoPanels.push(s.mesh); }
  // reception desk near the door
  K.at([5, 0, 21], Math.PI, () => { K.box('plastic#f2f2ee', 4.0, 1.05, 0.9, 0, 0, 0); K.box('glow#46e6ff', 4.0, 0.03, 0.02, 0, 0.5, -0.46); K.box('woodGrain#6a4a2a', 4.2, 0.06, 1.05, 0, 1.05, 0); });
  for (const [x, z] of [[-14, 22], [14, 22], [-24, 14], [24, 14]]) K.at([x, 0, z], 0, () => plant(K, 'ficus', { s: 2.2, potColor: '#d8c8a8', seed: Math.abs(x) }));
  for (let i = 0; i < 4; i++) K.at([-12 + i * 2.2, 0, 12], 0, () => { K.rbox('leather#c0404a', 1.6, 0.4, 0.7, 0.08, 0, 0.0, 0); K.rbox('leather#c0404a', 1.6, 0.4, 0.2, 0.08, 0, 0.4, -0.3); });
  // ---- panels (screens)
  const drawPanel = (kind, ctx, w, h, t) => {
    ctx.fillStyle = '#04141c'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#46e6ff'; ctx.fillStyle = '#46e6ff'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, w - 12, h - 12); ctx.font = `bold ${h * 0.09}px monospace`; ctx.textBaseline = 'top';
    if (kind === 'a') { ctx.fillText('EEN FABRICATION', 22, 20); ctx.font = `bold ${h * 0.3}px monospace`; ctx.fillText(String(48210 + Math.floor(t * 3)).padStart(6, '0'), 22, h * 0.28); ctx.font = `${h * 0.075}px monospace`; ctx.fillText('UNITS COMPLETED / TODAY', 22, h * 0.64); for (let i = 0; i < 24; i++) { const bh = (0.25 + 0.65 * noise2(i * 0.7, Math.floor(t * 2) * 0.1 + 3)) * h * 0.18; ctx.fillRect(22 + i * (w - 44) / 24, h - 24 - bh, (w - 44) / 24 - 3, bh); } }
    else if (kind === 'b') { ctx.fillText('GLOBAL NODES', 22, 20); for (let y = 0; y < 18; y++) for (let x = 0; x < 40; x++) { const n = noise2(x * 0.22, y * 0.28); if (n > 0.15) { ctx.globalAlpha = 0.3 + n * 0.6; ctx.fillRect(20 + x * (w - 40) / 40, h * 0.25 + y * h * 0.038, 5, 5); } } ctx.globalAlpha = 1; for (let i = 0; i < 9; i++) { const x = 40 + ((i * 97) % (w - 80)), y = h * 0.3 + ((i * 53) % (h * 0.5)); ctx.beginPath(); ctx.arc(x, y, 5 + 4 * Math.sin(t * 3 + i), 0, TAU); ctx.stroke(); } }
    else if (kind === 'wide' || kind === 'logo') eenLogo(ctx, w, h);
    else { ctx.fillText('EENBOT-9 / DIAGNOSTIC', 22, 20); ctx.font = `${h * 0.07}px monospace`; for (let i = 0; i < 9; i++) { ctx.globalAlpha = 0.5 + 0.5 * noise2(i, Math.floor(t * 4)); ctx.fillRect(22, h * 0.26 + i * h * 0.075, w * 0.1 + noise2(i * 2, Math.floor(t * 3)) * w * 0.7, h * 0.04); } ctx.globalAlpha = 1; }
  };
  const allScreens = [...panels, ...wallScreens];
  for (const s of allScreens) { s.setCanvas((c, w, h) => drawPanel(s.kind, c, w, h, 0)); const o1 = s.setTexture, o2 = s.setCanvas; s.setTexture = (tx) => { s._custom = !!tx; o1(tx); }; s.setCanvas = (f) => { s._custom = true; o2(f); }; }
  // ---- anchors (interior-local; offset applied by the caller)
  const anchors = {
    bead_desk: A([-6, 0, -3.1], 0), visitor: A([-6, 0, 1.3], Math.PI), visitor2: A([-8.4, 0, 0.9], Math.PI - 0.5), visitor3: A([-3.6, 0, 0.9], Math.PI + 0.5), line: AT([10, 0, BZ + 2.3], [10, 1.0, BZ]), line2: AT([3, 0, BZ + 2.3], [3, 1.0, BZ]), line3: AT([17, 0, BZ + 2.3], [17, 1.0, BZ]),
    gate_in: A([0, 0, 24], Math.PI), door: A([0, 0, 26.5], Math.PI), balcony: A([0, 4.65, -27.3], 0), balcony2: A([-11, 4.65, -25.3], 0.4), lab: AT([-20, 0, -9.6], [-20, 1.0, -13]), glassroom: AT([-19, 0, 2.2], [-19, 1.4, -2.5]), reception: A([5, 0, 19.2], 0), arena: A([0, 0, 4], Math.PI), center: A([0, 0, 0], 0),
    camWide: AT([0, 3.2, 26], [-2, 4, -12]), camMid: AT([-8, 1.65, 6], [-4, 1.4, -8]), camInWide: AT([0, 3.2, 26], [-2, 4, -12]), camInMid: AT([-8, 1.65, 6], [-4, 1.4, -8]),
    camHolo: AT([-6, 1.5, 5.2], [-6, 1.45, -1]), camHoloSide: AT([-2, 1.6, 2.5], [-6.5, 1.5, -1.5]), camBead: AT([-6, 1.55, 2.6], [-6, 1.6, -3.1]), camVisitor: AT([-5, 1.55, -5.6], [-6, 1.55, 1.3]), camLine: AT([6, 1.7, -4], [10, 0.9, -12]), camLineLow: AT([-9, 0.6, -10.0], [14, 1.1, -12]), camLineHigh: AT([12, 4.3, -20], [10, 1, -12]),
    camAtrium: AT([-26, 1.7, 20], [4, 8, -4]), camCeiling: AT([0, 1.7, 14], [0, 14, 0]), camBalcony: AT([-4, 6.4, -26], [8, 1.0, -12]), camLab: AT([-12, 1.8, -5], [-22, 1.1, -15]), camGate: AT([0, 1.7, 8], [0, 3, 29]),
  };
  const hemi = new THREE.HemisphereLight(0xfff2e4, 0x80708a, 1.15); const l1 = new THREE.PointLight(0xaee8ff, 10, 0, 2); l1.position.set(-6, 5.0, -1); const l2 = new THREE.PointLight(0xfff0d8, 14, 0, 2); l2.position.set(10, 6.5, -8);
  let lastPanel = -1;
  const api = finishSet(K, { screens: allScreens }, { bounds: { w: 60, d: 60, h: 17.5 }, anchors, lights: [hemi, l1, l2], screens: allScreens, extraObjs: [holo, ...holoPanels, ...armRoots, ...units.map((u) => u.g)],
    update(dt, t) {
      globe.rotation.y = t * 0.5; core.rotation.y = -t * 0.3; dots.rotation.y = t * 0.8; rings.forEach((r, i) => { r.rotation.z = t * (0.6 + i * 0.3); r.rotation.x = i + t * 0.2; }); holo.position.y = 1.55 + Math.sin(t * 1.3) * 0.03; l1.intensity = 10 * (1 + 0.06 * Math.sin(t * 7));
      for (const a of arms) { const w = t * 0.9 + a.ph; a.turn.rotation.y = (a.side < 0 ? 0 : Math.PI) + 0.45 * Math.sin(w); a.sh.rotation.x = 0.55 + 0.25 * Math.sin(w * 1.7 + 1); a.el.rotation.x = 1.15 + 0.4 * Math.sin(w * 1.3); a.spark.visible = Math.sin(w * 6.0) > 0.2; }
      for (const u of units) { const x = ((u.x0 + t * 0.45) % BL + BL) % BL; u.g.position.set(BX0 + x, 0.98, BZ); const s = Math.min(5, Math.floor(x / BL * 6)); if (s !== u.cur) { if (u.cur >= 0) u.st[u.cur].visible = false; u.st[s].visible = true; u.cur = s; } }
      const f = Math.floor(t * 2); if (f !== lastPanel) { lastPanel = f; for (const s of allScreens) if (!s._custom) { const o = s.ctx; drawPanel(s.kind, o, s.canvas.width, s.canvas.height, t); s.tex.needsUpdate = true; } }
    } });
  return api;
}
const holoPanels = [];

// ================================================================== composite
export function createSanctuary(opts = {}) {
  holoPanels.length = 0;
  const ex = buildExterior(); const inn = buildInterior();
  inn.root.position.y = IN_Y; inn.root.updateMatrixWorld(true);
  const off = (a) => ({ ...a, pos: [a.pos[0], a.pos[1] + IN_Y, a.pos[2]], ...(a.look ? { look: [a.look[0], a.look[1] + IN_Y, a.look[2]] } : {}) });
  const inA = {}; for (const k of Object.keys(inn.anchors)) inA[k] = off(inn.anchors[k]);
  const exA = ex.anchors; const anchors = { ...exA };
  for (const k of Object.keys(inA)) anchors[exA[k] ? 'in_' + k : k] = inA[k];
  anchors.camInWide = inA.camWide; anchors.camInMid = inA.camMid;
  ex.root.userData.anchors = exA; inn.root.userData.anchors = inA; ex.root.anchors = exA; inn.root.anchors = inA;
  const root = new THREE.Group(); root.name = 'sanctuary'; root.add(ex.root, inn.root);
  const api = {
    root, exterior: ex.root, interior: inn.root, anchors, interiorAnchors: inA, exteriorAnchors: exA, screens: inn.screens, bounds: { w: 104, d: 104, h: 40 }, interiorOffsetY: IN_Y, eenLogo,
    update(dt, t) { ex.update(dt, t); inn.update(dt, t); },
    setMode(m = 'both') { ex.root.visible = m !== 'interior'; inn.root.visible = m !== 'exterior'; },
    setGateOpen: ex.setGateOpen, getGateOpen: ex.getGateOpen,
    dispose() { ex.dispose(); inn.dispose(); },
    stats() { const a = ex.stats(), b = inn.stats(); return { exterior: a, interior: b, tris: a.tris + b.tris, draws: a.draws + b.draws }; },
  };
  return api;
}
