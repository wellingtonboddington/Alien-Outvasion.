// Everyday interiors for dialogue scenes: apartment, hospital (corridor + ward), pharmacy (botika), courtroom, law office.
// All: origin = floor centre, +Z = camera/door side unless noted, hemisphere + <=2 point lights + emissive fixtures, anchors {pos,yaw,look?}, camWide/camMid.
import * as THREE from 'three';
import { RNG, TAU } from '../../../engine/common.js';
import { Kit, signMesh, makeScreen } from './kit.js';
import { room, wall, bench, troffer, lampShade, chairWood, chairPlastic, officeChair, tableRect, tableRound, sofa, plant, wallClock, frame, mug, paperStack, folder, trashBin, deskUnit, keyboard, finishSet, A, AT } from './props.js';
import { newsScreenDraw } from './restaurant.js';

const put = (K, o, x, y, z) => { o.position.set(x, y, z); return K.mesh(o); };
const hole = (c, w, along, y0 = 0, y1 = 2.1) => ({ x0: c - w / 2 + along + 0.1, x1: c + w / 2 + along + 0.1, y0, y1 });
const WALLS = (hw, hd) => ({ n: (c) => [[c, -hd - 0.1], 0], s: (c) => [[c, hd + 0.1], Math.PI], e: (c) => [[hw + 0.1, c], -Math.PI / 2], w: (c) => [[-hw - 0.1, c], Math.PI / 2] });
/** opening furniture placed in the wall frame: wall 'n'|'s'|'e'|'w', centre c along the wall */
function at(K, hw, hd, wl, c, fn) { const [p, yaw] = WALLS(hw, hd)[wl](c); if (wl === 'n' || wl === 's') K.at([p[0], 0, p[1]], yaw, fn); else K.at([p[0], 0, p[1]], yaw, fn); }
function skyline(mood = 'day', seed = 1) {
  return (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); const day = mood === 'day'; g.addColorStop(0, day ? '#5a9ee6' : '#1a2a52'); g.addColorStop(0.7, day ? '#cfe6f6' : '#f09a5a'); g.addColorStop(1, day ? '#e8e4d8' : '#6a4a5a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = new RNG(seed); for (let L = 0; L < 2; L++) { let x = -20; while (x < w) { const bw = r.range(40, 110), bh = r.range(h * 0.25, h * (L ? 0.55 : 0.8)); ctx.fillStyle = L ? (day ? '#9aaec0' : '#3a3a5a') : (day ? '#6a7e92' : '#241f3a'); ctx.fillRect(x, h * 0.95 - bh, bw, bh + h); if (!L) for (let wy = h * 0.95 - bh + 8; wy < h * 0.95; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 12) { if (r.chance(day ? 0.25 : 0.4)) { ctx.fillStyle = day ? 'rgba(255,255,255,0.45)' : '#ffd890'; ctx.fillRect(wx, wy, 6, 8); } } x += bw + r.range(-6, 10); } }
  };
}
const backdrop = (w, h, mood, seed) => signMesh(w, h, skyline(mood, seed), { px: 70, lit: true, emissive: mood === 'day' ? 0.95 : 0.8, bg: '#8aa' });
function windowAt(K, hw, hd, wl, c, w, y0, y1, { mood = 'day', seed = 1, bl = false } = {}) {
  at(K, hw, hd, wl, c, () => {
    K.tinted('#d8d4c8', () => { K.slab('plastic', -w / 2 - 0.05, y0 - 0.05, -0.1, w / 2 + 0.05, y0 + 0.03, 0.06); K.slab('plastic', -w / 2 - 0.05, y1 - 0.03, -0.1, w / 2 + 0.05, y1 + 0.05, 0.06); K.slab('plastic', -w / 2 - 0.05, y0, -0.1, -w / 2 + 0.03, y1, 0.06); K.slab('plastic', w / 2 - 0.03, y0, -0.1, w / 2 + 0.05, y1, 0.06); K.box('plastic', 0.04, y1 - y0, 0.06, 0, y0, -0.02); });
    K.tinted('#cfe6ee', () => K.box('glass', w, y1 - y0, 0.02, 0, y0, -0.04)); put(K, backdrop(w + 6, y1 - y0 + 5, mood, seed), 0, (y0 + y1) / 2 + 0.6, -2.4);
    if (bl) blinds(K, w, y1 - y0, 0, y0, 0.0);
  });
}
function blinds(K, w, h, x, y, z, drop = 0.7) { const n = Math.round(h * drop / 0.05); K.box('paint#d8d4c8', w + 0.1, 0.06, 0.08, x, y + h, z + 0.12); for (let i = 0; i < n; i++) K.tinted('#e8e4da', () => K.box('plastic', w, 0.012, 0.03, x, y + h - 0.08 - i * 0.05, z + 0.12)); }
function doorAt(K, hw, hd, wl, c, w = 0.95, h = 2.1, col = '#7a5230', glassPanel = false) {
  at(K, hw, hd, wl, c, () => { K.tinted('#e8e4da', () => { K.slab('plastic', -w / 2 - 0.06, 0, -0.1, -w / 2, h + 0.06, 0.08); K.slab('plastic', w / 2, 0, -0.1, w / 2 + 0.06, h + 0.06, 0.08); K.slab('plastic', -w / 2 - 0.06, h, -0.1, w / 2 + 0.06, h + 0.06, 0.08); }); K.tinted(col, () => K.box('woodGrain', w - 0.02, h - 0.02, 0.04, 0, 0.0, -0.03)); if (glassPanel) K.tinted('#cfe6ee', () => K.box('glass', 0.3, 0.9, 0.05, 0, 1.0, -0.03)); K.box('chrome', 0.12, 0.025, 0.06, w / 2 - 0.12, 1.0, 0.0); });
}
function phFlag(ctx, w, h) { ctx.fillStyle = '#0038a8'; ctx.fillRect(0, 0, w, h / 2); ctx.fillStyle = '#ce1126'; ctx.fillRect(0, h / 2, w, h / 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.5, h / 2); ctx.lineTo(0, h); ctx.fill(); ctx.fillStyle = '#fcd116'; ctx.beginPath(); ctx.arc(w * 0.17, h / 2, h * 0.09, 0, TAU); ctx.fill(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(w * 0.17 + Math.cos(a - 0.1) * h * 0.1, h / 2 + Math.sin(a - 0.1) * h * 0.1); ctx.lineTo(w * 0.17 + Math.cos(a) * h * 0.19, h / 2 + Math.sin(a) * h * 0.19); ctx.lineTo(w * 0.17 + Math.cos(a + 0.1) * h * 0.1, h / 2 + Math.sin(a + 0.1) * h * 0.1); ctx.fill(); } for (const [x, y] of [[0.04, 0.1], [0.04, 0.9], [0.43, 0.5]]) { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2, a2 = a + Math.PI / 5; ctx.lineTo(w * x + Math.cos(a) * h * 0.06, h * y + Math.sin(a) * h * 0.06); ctx.lineTo(w * x + Math.cos(a2) * h * 0.025, h * y + Math.sin(a2) * h * 0.025); } ctx.fill(); } }
function flagStand(K, x, z, rot = 0, h = 2.4) { K.at([x, 0, z], rot, () => { K.cyl('darkMetal', 0.18, 0.05, 0, 0, 0, { seg: 12 }); K.cyl('brass', 0.015, h, 0, 0.05, 0, { seg: 6 }); K.sph('brass', 0.04, 0, h + 0.07, 0, { seg: 6, segH: 4 }); put(K, signMesh(1.05, 0.55, phFlag, { px: 140, rough: 0.8, side: THREE.DoubleSide, bg: '#fff' }), 0.55, h - 0.35, 0); }); }
function bookshelf(K, rng, w, h, d = 0.3, { colors = ['#7a1a1a', '#1a3a6a', '#2a5a3a', '#5a3a1a', '#d8c8a0', '#3a2a4a', '#8a6a2a'] } = {}) {
  K.tinted('#4a2e18', () => { K.box('woodGrain', 0.03, h, d, -w / 2, 0, 0); K.box('woodGrain', 0.03, h, d, w / 2, 0, 0); K.box('woodGrain', w, h, 0.02, 0, 0, -d / 2); const n = Math.round(h / 0.36); for (let i = 0; i <= n; i++) K.box('woodGrain', w, 0.03, d, 0, i * h / n - (i === n ? 0.03 : 0), 0); });
  const n = Math.round(h / 0.36); for (let r = 0; r < n; r++) { let x = -w / 2 + 0.05; while (x < w / 2 - 0.1) { const bw = rng.range(0.025, 0.06), bh = rng.range(0.2, 0.31); K.tinted(rng.pick(colors), () => K.box('matte', bw, bh, d * 0.8, x + bw / 2, r * h / n + 0.03, 0.0)); x += bw + 0.004; if (rng.chance(0.04)) x += 0.1; } }
}
function tvAnim(scr, label) { return (t) => { const f = scr._f = (scr._f || 0) + 1; if (!scr._custom && (f === 1 || f % 3 === 0)) { newsScreenDraw(label)(scr.ctx, scr.canvas.width, scr.canvas.height, t); scr.tex.needsUpdate = true; } }; }
function wrapScreen(s) { const o1 = s.setTexture, o2 = s.setCanvas; s.setTexture = (t) => { s._custom = !!t; o1(t); }; s.setCanvas = (f) => { s._custom = true; o2(f); }; return s; }
function lights(hemi, pts) { const L = [new THREE.HemisphereLight(...hemi)]; for (const [c, i, x, y, z] of pts) { const p = new THREE.PointLight(c, i, 0, 2); p.position.set(x, y, z); L.push(p); } return L; }
const curtainMat = (K) => K.defMat('curtain', { map: 'fabric', color: 0xffffff, rough: 0.95, tile: 0.5, side: 'double', sway: 0.35 });
const camsOf = (a) => { for (const k of Object.keys(a)) if (a[k].look && a[k].yaw === undefined) a[k].yaw = 0; return a; };

// ================================================================== APARTMENT
export function createApartment(opts = {}) {
  const W = 7.2, D = 8.6, H = 2.8, hw = W / 2, hd = D / 2; const K = new Kit({ name: 'apartment', env: 'interior', seed: 81 }); const rng = new RNG(81);
  K.setAmbience({ min: [-hw, 0, -hd], max: [hw, H, hd], floor: 0.5, wall: 0.45, ceil: 0.35, range: 0.8 }); curtainMat(K);
  room(K, { w: W, d: D, h: H, t: 0.2, mat: 'plaster#efe6d4', floor: 'woodPlank#b8946a', ceil: 'soffit#f4f0e6', holes: { n: [hole(0.6, 3.4, hw, 0.85, 2.35)], e: [hole(-1.4, 1.6, hd, 0.9, 2.2)], s: [hole(2.6, 0.95, hw)] } });
  for (const [x0, x1, y0, y1] of [[-hw, -1.1, 0, H], [2.3, hw, 0, H], [-1.1, 2.3, 0, 0.85], [-1.1, 2.3, 2.35, H]]) K.slab('paint#3a5a6a', x0, y0, -hd, x1, y1, -hd + 0.02); K.slab('plaster#7a9aa8', -hw, 0.0, -hd + 0.02, -hw + 0.02, H, hd); K.slab('woodGrain#7a5a3a', -hw, 0, -hd, hw, 0.1, -hd + 0.03);
  windowAt(K, hw, hd, 'n', 0.6, 3.4, 0.85, 2.35, { mood: 'dusk', seed: 4, bl: false }); windowAt(K, hw, hd, 'e', -1.4, 1.6, 0.9, 2.2, { mood: 'dusk', seed: 7 }); doorAt(K, hw, hd, 's', 2.6, 0.95, 2.1, '#6a4a2a');
  for (const [x, w] of [[-0.5, 1.3], [1.7, 1.3]]) K.tinted('#f0e8d8', () => K.cloth('curtain', w, 1.7, x, 1.5, -hd + 0.2, 0, { ws: 6, hs: 3, pin: 'top' }));
  K.box('darkMetal', 4.2, 0.03, 0.03, 0.6, 2.35, -hd + 0.18);
  K.slab('carpet#8a5a4a', -2.6, 0.003, -3.2, 0.2, 0.012, 0.2);
  // living: TV unit (west), sofa, coffee table
  const tvm = makeScreen(1.25, 0.72, { res: [512, 290], bright: 1.3 }); const tvs = wrapScreen(tvm.screen); const tvUp = tvAnim(tvs, 'DNN 24'); tvUp(0);
  K.at([-hw + 0.25, 0, -1.6], Math.PI / 2, () => { K.box('woodGrain#3a2616', 1.8, 0.45, 0.45, 0, 0.1, 0); K.box('darkMetal', 1.8, 0.04, 0.42, 0, 0.08, 0); K.box('darkMetal', 0.3, 0.25, 0.06, 0, 0.55, -0.02); K.box('darkMetal', 0.5, 0.02, 0.2, 0, 0.55, 0); put(K, tvm.mesh, 0, 1.18, 0.0); });
  K.at([-0.5, 0, -1.55], -Math.PI / 2, () => sofa(K, 2.1, '#6b7a8f')); K.at([-1.6, 0, -3.5], 0.2, () => chairWood(K, '#6a4a2a')); K.at([-1.6, 0, -1.6], Math.PI / 2, () => tableRect(K, 1.0, 0.55, 0.4, { top: 'woodGrain', color: '#5a3a1e' }));
  K.at([-1.6, 0.4, -1.7], 0.5, () => { mug(K, '#e8e8e4', 0.2, 0, 0); paperStack(K, -0.1, 0, 0.0, 4, 0.3); });
  K.at([-hw + 0.5, 0, -hd + 0.5], 0, () => plant(K, 'ficus', { s: 1.6, potColor: '#c8c0b0', seed: 3 })); K.at([hw - 0.4, 0, 1.0], 0, () => plant(K, 'snake', { s: 1.4, potColor: '#8a8a82', seed: 6 }));
  K.at([-0.2, 0, -3.9], 0, () => { K.cyl('darkMetal', 0.02, 1.5, 0, 0, 0, { seg: 5 }); lampShade(K, 0.2, 0.28, 0, 1.5, 0, { shade: 'paint#e8dcc0' }); K.cyl('darkMetal', 0.15, 0.02, 0, 0, 0, { seg: 12 }); });
  // kitchen (south-west)
  K.at([-hw + 0.33, 0, 2.4], Math.PI / 2, () => { K.box('woodGrain#d8d0c0', 3.0, 0.88, 0.62, 0, 0, 0); K.slab('marble#e0d8c8', -1.52, 0.88, -0.33, 1.52, 0.92, 0.33); K.box('steel', 0.6, 0.05, 0.4, -0.6, 0.9, 0); K.tube('chrome', [[-0.6, 0.92, -0.2], [-0.6, 1.15, -0.2], [-0.5, 1.2, -0.12]], 0.015, { radial: 5 }); K.box('darkMetal', 0.6, 0.02, 0.5, 0.7, 0.92, 0); for (const sx of [-0.12, 0.12]) for (const sz of [-0.12, 0.12]) K.cyl('darkMetal', 0.07, 0.01, 0.7 + sx, 0.935, sz, { seg: 10 }); K.box('steelPlain', 0.7, 0.4, 0.5, 0.7, 1.55, -0.1); K.box('woodGrain#d8d0c0', 3.0, 0.7, 0.35, 0, 1.5, -0.14); for (let i = 0; i < 6; i++) K.box('chrome', 0.02, 0.12, 0.02, -1.4 + i * 0.5, 0.82, 0.32); K.tinted('#f0f0ee', () => K.rbox('plastic', 0.7, 1.7, 0.65, 0.04, 1.8, 0, 0.0)); K.box('chrome', 0.02, 0.5, 0.03, 1.5, 0.9, 0.35); });
  K.at([-1.0, 0, 2.7], 0, () => { tableRound(K, 0.5, 0.74, { top: 'woodGrain', color: '#6a4a2a' }); for (const a of [0.5, 2.3, 4.2]) K.at([Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62], -a + Math.PI / 2 + Math.PI, () => chairWood(K, '#8a6a3a')); mug(K, '#d9422a', 0.1, 0.74, 0.1); });
  // bedroom corner (north-east)
  K.at([2.55, 0, -hd + 1.15], 0, () => { K.box('woodGrain#5a3a1e', 1.7, 0.3, 2.1, 0, 0, 0); K.rbox('sheet#e8e4da', 1.6, 0.25, 2.0, 0.06, 0, 0.3, 0); K.tinted('#7a8aa0', () => K.rbox('fabric', 1.62, 0.1, 1.2, 0.05, 0, 0.5, 0.35)); for (const sx of [-0.4, 0.4]) K.tinted('#f4f2ea', () => K.rbox('fabric', 0.6, 0.12, 0.38, 0.05, sx, 0.55, -0.7)); K.box('woodGrain#5a3a1e', 1.75, 1.0, 0.07, 0, 0, -1.07); });
  K.at([3.4, 0, -hd + 0.6], 0, () => { K.box('woodGrain#5a3a1e', 0.45, 0.5, 0.4, 0, 0, 0); lampShade(K, 0.12, 0.2, 0, 0.5, 0, { shade: 'paint#e8dcc0' }); });
  K.at([hw - 0.35, 0, 1.0], -Math.PI / 2, () => { K.box('woodGrain#d8d0c0', 2.0, 2.2, 0.55, 0, 0, 0); K.box('darkMetal', 0.02, 2.0, 0.02, 0, 0.1, 0.285); K.box('darkMetal', 0.02, 0.02, 0.02, -0.1, 1.0, 0.29); });
  K.at([1.15, 0, -1.2], 0, () => bookshelf(K, rng, 0.9, 1.6, 0.28));
  // entry
  K.at([hw - 0.45, 0, hd - 0.4], Math.PI, () => { K.box('woodGrain#5a3a1e', 0.9, 0.5, 0.3, 0, 0, 0); for (let i = 0; i < 4; i++) K.tinted(rng.pick(['#d9d9d6', '#2a2a2e', '#a32a2a']), () => K.box('rubber', 0.18, 0.06, 0.3, -0.3 + i * 0.2, 0.5, 0)); });
  K.at([-1.0, 0, hd - 0.1], Math.PI, () => frame(K, 0.9, 1.3, (c, w, h) => { c.fillStyle = '#9ab'; c.fillRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#dff'); g.addColorStop(1, '#789'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, { y: 0.7, color: '#2a2a2e' }));
  const ph = [[-hw + 0.02, 1.6, -3.7, Math.PI / 2], [-hw + 0.02, 1.7, -3.1, Math.PI / 2], [-hw + 0.02, 1.5, 0.1, Math.PI / 2]];
  ph.forEach(([x, y, z, r], i) => frame(K, 0.4, 0.5, (c, w, h) => { c.fillStyle = ['#e8a050', '#6aa0c8', '#c86a7a'][i]; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(w * 0.5, h * 0.55, w * 0.25, 0, TAU); c.fill(); }, { x, y, z, rot: r, color: '#3a2a1c' }));
  const clk = wallClock(K, 0.17, 3.45, 2.2, -0.2, -Math.PI / 2);
  for (const x of [-2.2, 0.6, 2.4]) K.at([x, 0, 0.0], 0, () => troffer(K, 0.8, 0.4, H, 'glow', 2)); K.at([-0.6, 0, -2.6], 0, () => { K.cyl('glowWarm', 0.28, 0.04, 0, H - 0.04, 0, { seg: 14 }); });
  const anchors = camsOf({
    sofa1: A([-0.5, 0, -1.9], -Math.PI / 2), sofa2: A([-0.5, 0, -1.1], -Math.PI / 2), tv: AT([-hw + 0.7, 0, -1.6], [-hw + 0.1, 1.2, -1.6]), standLiving: AT([-0.4, 0, -0.2], [-1.6, 1.0, -2.0]), kitchen: AT([-2.2, 0, 2.4], [-hw, 1.0, 2.4]), fridge: AT([-2.4, 0, 3.6], [-hw + 0.3, 1.0, 3.6]),
    dining1: AT([-1.0, 0, 3.4], [-1.0, 0.9, 2.7]), dining2: AT([-1.9, 0, 2.7], [-1.0, 0.9, 2.7]), dining3: AT([-0.2, 0, 2.2], [-1.0, 0.9, 2.7]), bed: AT([2.55, 0, -1.0], [2.55, 0.5, -3.2]), bedside: AT([2.4, 0, -2.9], [3.4, 0.6, -3.7]), window: AT([0.6, 0, -hd + 0.9], [0.6, 1.5, -hd]), window2: AT([hw - 0.8, 0, -1.4], [hw, 1.5, -1.4]),
    door: AT([2.6, 0, hd - 0.7], [2.6, 1.4, 0]), entry: AT([2.4, 0, hd - 0.9], [0, 1.2, -1]), wardrobe: AT([hw - 1.1, 0, 1.0], [hw, 1.0, 1.0]),
    camWide: AT([1.2, 1.95, hd - 0.35], [-0.8, 1.0, -2.2]), camMid: AT([2.4, 1.55, 0.8], [-1.0, 1.15, -1.5]), camSofa: AT([-2.6, 1.3, 0.2], [-0.5, 0.9, -1.8]), camKitchen: AT([1.8, 1.6, 1.0], [-hw + 0.5, 1.0, 2.8]), camBed: AT([-0.4, 1.5, -0.6], [2.55, 0.7, -3.0]), camWindow: AT([-1.6, 1.5, 0.5], [0.8, 1.5, -hd]), camDoor: AT([-2.2, 1.6, -3.0], [2.6, 1.2, hd]), camTV: AT([1.2, 1.4, -1.8], [-hw, 1.2, -1.6]),
  });
  const set = finishSet(K, { clock: clk, tv: tvs }, { bounds: { w: W, d: D, h: H }, anchors, lights: lights([0xfff0dc, 0x8a7a6a, 1.05], [[0xffd6a0, 9, -0.6, 2.4, -1.0], [0xffe8c8, 6, -1.0, 2.4, 2.6]]), screens: [tvs], update(dt, t) { clk.set(t + 19 * 3600 + 20 * 60); tvUp(t); } });
  return set;
}

// ================================================================== HOSPITAL (corridor along the south, ward along the north)
function hospitalBed(K, { patient = false, blanket = '#7ab0c8' } = {}) {
  K.box('darkMetal', 0.9, 0.08, 1.95, 0, 0.28, 0); for (const sx of [-0.4, 0.4]) for (const sz of [-0.85, 0.85]) { K.cyl('rubberBlack', 0.05, 0.04, sx, 0.05, sz, { axis: 'x', seg: 8 }); K.cyl('steelPlain', 0.02, 0.25, sx, 0.08, sz, { seg: 5 }); }
  K.rbox('sheet#f4f6f8', 0.86, 0.14, 1.15, 0.05, 0, 0.36, 0.38); K.at([0, 0.5, -0.5], [0.5, 0, 0], () => K.rbox('sheet#f4f6f8', 0.86, 0.14, 0.8, 0.05, 0, 0, 0));
  K.box('plastic#d8dde0', 0.92, 0.7, 0.05, 0, 0.3, -1.0); K.box('plastic#d8dde0', 0.92, 0.45, 0.05, 0, 0.3, 1.0);
  for (const sx of [-0.45, 0.45]) { K.tube('chrome', [[sx, 0.55, -0.2], [sx, 0.8, -0.05], [sx, 0.8, 0.6], [sx, 0.55, 0.7]], 0.015, { radial: 5 }); }
  K.tinted('#f6f6f2', () => K.rbox('sheet', 0.5, 0.1, 0.34, 0.04, 0, 0.67, -0.82));
  K.tinted(blanket, () => K.rbox('sheet', 0.9, 0.1, 1.0, 0.05, 0, 0.5, 0.45));
  if (patient) { K.tinted('#9a6a4a', () => K.sph('plastic', 0.1, 0, 0.78, -0.82, { seg: 10, segH: 8, s: [1, 1.15, 1] })); K.tinted('#1a1410', () => K.sph('matte', 0.105, 0, 0.8, -0.85, { seg: 10, segH: 6, thL: Math.PI * 0.55, s: [1, 1, 1.05] })); K.tinted(blanket, () => K.sph('sheet', 0.3, 0, 0.55, 0.0, { seg: 10, segH: 8, s: [1.1, 0.5, 1.8] })); K.tinted('#f4f0ea', () => K.rbox('sheet', 0.5, 0.16, 0.3, 0.05, 0, 0.62, -0.5)); K.tinted('#9a6a4a', () => K.cyl('plastic', 0.035, 0.5, 0.3, 0.56, -0.2, { seg: 6 })); }
}
function ivPole(K, rng) { K.cyl('darkMetal', 0.2, 0.02, 0, 0, 0, { seg: 10 }); K.cyl('steelPlain', 0.015, 1.9, 0, 0.02, 0, { seg: 6 }); K.box('steelPlain', 0.3, 0.015, 0.015, 0, 1.9, 0); for (const sx of [-0.14, 0.14]) { K.tinted('#dff1f6', () => K.box('glass', 0.1, 0.18, 0.025, sx, 1.65, 0)); K.cyl('plastic#e8e8e4', 0.012, 0.03, sx, 1.83, 0, { seg: 6 }); } K.tube('glass#cfeaf0', [[0.14, 1.65, 0], [0.18, 1.2, 0.1], [0.3, 0.9, 0.4]], 0.006, { radial: 3 }); K.box('plastic#e8e8e4', 0.2, 0.12, 0.1, 0, 1.2, 0.06); }
export function createHospital(opts = {}) {
  const W = 16, D = 12, H = 3.0, hw = W / 2, hd = D / 2, PZ = 1.9; const K = new Kit({ name: 'hospital', env: 'morgue', seed: 82 }); const rng = new RNG(82);
  K.setAmbience({ min: [-hw, 0, -hd], max: [hw, H, hd], floor: 0.4, wall: 0.4, ceil: 0.3, range: 0.9 }); curtainMat(K);
  room(K, { w: W, d: D, h: H, t: 0.2, mat: 'plaster#e4ece6', floor: 'tileFloor#d4dcd8', ceil: 'ceilTile', holes: { n: [hole(-2.75, 2.0, hw, 1.15, 2.4), hole(2.75, 2.0, hw, 1.15, 2.4)], w: [hole(4.0, 1.7, hd)], e: [] } });
  K.slab('tileWall#9ac4c0', -hw, 0, -hd, hw, 1.1, -hd + 0.02); K.slab('tileWall#9ac4c0', -hw, 0, hd - 0.02, hw, 1.1, hd); K.slab('paint#7ab0a8', -hw, 1.05, -hd, hw, 1.1, -hd + 0.03); K.slab('paint#7ab0a8', -hw, 1.05, hd - 0.03, hw, 1.1, hd);
  windowAt(K, hw, hd, 'n', -2.75, 2.0, 1.15, 2.4, { mood: 'day', seed: 12, bl: true }); windowAt(K, hw, hd, 'n', 2.75, 2.0, 1.15, 2.4, { mood: 'day', seed: 13, bl: true });
  at(K, hw, hd, 'w', 4.0, () => { K.tinted('#d8dcdc', () => { K.box('plastic', 0.06, 2.2, 0.1, -0.85, 0, -0.02); K.box('plastic', 0.06, 2.2, 0.1, 0.85, 0, -0.02); K.box('plastic', 1.7, 0.06, 0.1, 0, 2.15, -0.02); }); K.tinted('#cfe6ee', () => K.box('glass', 0.8, 2.0, 0.03, -0.42, 0.05, -0.03)); K.tinted('#cfe6ee', () => K.box('glass', 0.8, 2.0, 0.03, 0.42, 0.05, -0.03)); });
  at(K, hw, hd, 'w', 4.0, () => put(K, signMesh(0.9, 0.22, (c, w, h) => { c.fillStyle = '#12803a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * 0.55}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EXIT  >>', w / 2, h / 2); }, { px: 160, lit: true, emissive: 1.4, bg: '#12803a' }), 0, 2.45, 0.05));
  // partition wall between ward (north) and corridor (south)
  K.at([-hw - 0.1, 0, PZ], 0, () => wall(K, 'plaster#e4ece6', W + 0.2, H, 0.2, [hole(1.0, 1.7, hw, 0, 2.15), hole(-5.0, 1.7, hw, 1.15, 2.1)], { mat: 'tileWall#9ac4c0', h: 1.1, side: 1, t: 0.02 }));
  K.slab('tileWall#9ac4c0', -hw, 0, PZ - 0.12, 0.15, 1.1, PZ - 0.1); K.slab('tileWall#9ac4c0', 1.85, 0, PZ - 0.12, hw, 1.1, PZ - 0.1);
  at(K, hw, hd, 'n', 0, () => { });
  K.at([1.0, 0, PZ], 0, () => { K.tinted('#d8dcdc', () => { K.slab('plastic', -0.9, 0, -0.12, -0.82, 2.2, 0.12); K.slab('plastic', 0.82, 0, -0.12, 0.9, 2.2, 0.12); K.slab('plastic', -0.9, 2.15, -0.12, 0.9, 2.22, 0.12); }); for (const s of [-1, 1]) { K.tinted('#cfe6ee', () => K.box('glass', 0.78, 1.6, 0.03, s * 0.41, 0.5, 0)); K.tinted('#bcd0d0', () => K.box('plastic', 0.8, 0.5, 0.04, s * 0.41, 0, 0)); K.box('chrome', 0.03, 0.4, 0.02, s * 0.06, 0.9, 0.06); } });
  K.at([-5.0, 0, PZ], 0, () => { K.tinted('#d8dcdc', () => { K.slab('plastic', -0.9, 1.1, -0.12, 0.9, 1.15, 0.12); K.slab('plastic', -0.9, 2.1, -0.12, 0.9, 2.17, 0.12); }); K.tinted('#cfe6ee', () => K.box('glass', 1.7, 0.95, 0.03, 0, 1.15, 0)); });
  K.at([5.9, 0, PZ + 0.1], 0, () => { K.tinted('#6a8aa0', () => K.box('woodGrain', 0.95, 2.1, 0.05, 0, 0, 0)); K.box('chrome', 0.1, 0.03, 0.08, 0.35, 1.0, 0.06); put(K, signMesh(0.3, 0.12, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0392b'; c.font = `bold ${h * 0.7}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ICU', w / 2, h / 2); }, { px: 200, bg: '#fff' }), 0, 2.3, 0.06); });
  // ward: beds, curtains, monitors
  const ecgs = []; const bx = [-5.5, 0, 5.5];
  bx.forEach((x, i) => {
    K.at([x, 0, -hd + 1.15], 0, () => hospitalBed(K, { patient: i !== 2, blanket: ['#7ab0c8', '#a8c8a0', '#c8b0d0'][i] }));
    K.at([x + 0.85, 0, -hd + 0.9], 0, () => { K.box('plastic#e8e8e4', 0.45, 0.62, 0.4, 0, 0.15, 0); K.cyl('steelPlain', 0.015, 0.1, 0, 0.0, 0, { seg: 4 }); K.box('plastic#e8e8e4', 0.45, 0.02, 0.42, 0, 0.77, 0); });
    K.at([x - 0.75, 0, -hd + 1.2], rng.range(-0.3, 0.3), () => ivPole(K, rng));
    const m = makeScreen(0.46, 0.28, { res: [320, 200], bright: 1.4, frame: true }); const s = wrapScreen(m.screen); s.kind = i; ecgs.push(s); K.at([x - 0.62, 0, -hd + 0.3], 0, () => { K.cyl('darkMetal', 0.02, 1.2, 0, 0.1, 0, { seg: 6 }); K.cyl('darkMetal', 0.2, 0.02, 0, 0.0, 0, { seg: 10 }); K.box('plastic#2a2e32', 0.5, 0.34, 0.08, 0, 1.2, 0.0); put(K, m.mesh, 0, 1.35, 0.045); });
  });
  for (const x of [-2.75, 2.75]) { K.box('darkMetal', 0.03, 0.03, 2.9, x, 2.55, -hd + 1.45); K.tinted(x < 0 ? '#9fc8d8' : '#a8d0b0', () => K.cloth('curtain', 2.5, 1.65, x, 1.7, -hd + 1.45, Math.PI / 2, { ws: 10, hs: 3, pin: 'top' })); }
  const wtv = makeScreen(0.95, 0.55, { res: [512, 290], bright: 1.2 }); const wtvS = wrapScreen(wtv.screen); const wtvUp = tvAnim(wtvS, 'DNN 24'); wtvUp(0);
  K.at([hw - 0.12, 0, -2.0], -Math.PI / 2, () => { K.box('darkMetal', 0.08, 0.5, 0.06, 0, 1.9, -0.05); K.box('darkMetal', 0.04, 0.04, 0.4, 0, 2.2, -0.2); put(K, wtv.mesh, 0, 2.15, 0.0); });
  K.at([hw - 0.35, 0, -hd + 0.5], 0, () => { K.box('steel', 0.6, 0.15, 0.5, 0, 0.8, 0); K.box('plastic#e8e8e4', 0.6, 0.8, 0.5, 0, 0, 0); K.tube('chrome', [[0, 0.95, 0.1], [0, 1.1, 0.1], [0, 1.1, 0.25]], 0.015, { radial: 5 }); });
  K.at([2.9, 0, -1.2], 0.5, () => chairPlastic(K, '#6a8aa0')); K.at([-2.8, 0, -1.4], -0.4, () => chairPlastic(K, '#6a8aa0')); K.at([-hw + 0.5, 0, -2.4], Math.PI / 2, () => { K.box('darkMetal', 0.5, 0.9, 1.0, 0, 0, 0); for (let i = 0; i < 3; i++) K.tinted('#e8e8e4', () => K.box('plastic', 0.4, 0.04, 0.9, 0.05, 0.1 + i * 0.3, 0)); });
  for (const x of [-4.8, -0.8, 3.6]) K.at([x, 0, -1.6], 0, () => troffer(K, 1.2, 0.5, H, 'glow', 2)); for (const x of [-6.8, -3.4, 0, 3.4, 6.8]) K.at([x, 0, 4.0], 0, () => troffer(K, 1.2, 0.5, H, 'glow', 2));
  // corridor
  for (const [z, s] of [[hd - 0.08, 1], [PZ + 0.18, -1]]) { K.box('woodGrain#c8b8a0', W - 0.2, 0.08, 0.06, 0, 0.92, z); for (let i = 0; i < 9; i++) K.box('darkMetal', 0.04, 0.12, 0.06, -hw + 1.0 + i * 1.8, 0.88, z); }
  K.at([0, 2.25, 3.2], Math.PI / 2, () => put(K, signMesh(2.4, 0.5, (c, w, h) => { c.fillStyle = '#12606a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * 0.5}px Arial`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('WARD 3', w * 0.05, h / 2); c.font = `bold ${h * 0.4}px Arial`; c.fillText('>>', w * 0.8, h / 2); }, { px: 120, lit: true, emissive: 1.1, bg: '#12606a' }), 0, 0.2, 0));
  K.at([-3.2, 0, 5.1], 0.1, () => { K.box('chrome', 1.9, 0.04, 0.7, 0, 0.8, 0); K.rbox('sheet#e8eef0', 1.85, 0.1, 0.65, 0.04, 0, 0.84, 0); K.box('steelPlain', 0.05, 0.6, 0.6, 0.8, 0.2, 0); K.box('steelPlain', 0.05, 0.6, 0.6, -0.8, 0.2, 0); for (const sx of [-0.8, 0.8]) for (const sz of [-0.28, 0.28]) K.cyl('rubberBlack', 0.07, 0.04, sx, 0.07, sz, { axis: 'x', seg: 8 }); });
  K.at([2.9, 0, 5.4], 0, () => { for (let i = 0; i < 3; i++) K.at([i * 0.5, 0, 0], 0, () => chairPlastic(K, '#6a8aa0')); }); K.at([-6.2, 0, 3.0], 0.6, () => { K.torus('chrome', 0.3, 0.015, 0, 0.35, 0.0, [0, Math.PI / 2, 0]); K.box('leather#2a2e36', 0.45, 0.06, 0.45, 0, 0.45, 0); K.box('leather#2a2e36', 0.45, 0.45, 0.06, 0, 0.5, -0.22); });
  K.at([7.0, 0, 4.0], 0, () => { K.box('plastic#e8e8e4', 2.0, 1.1, 0.7, 0.0, 0, 1.0); K.box('woodGrain#c8b090', 2.1, 0.05, 0.8, 0, 1.1, 1.0); K.box('plastic#e8e8e4', 0.7, 1.1, 2.2, -1.0, 0, 0); K.box('woodGrain#c8b090', 0.8, 0.05, 2.3, -1.0, 1.1, 0); for (const z of [-0.6, 0.6]) { K.box('screenOff', 0.4, 0.26, 0.02, -1.0, 1.4, z); K.box('darkMetal', 0.06, 0.3, 0.04, -1.0, 1.1, z); } K.tinted('#e8f4f6', () => K.box('glow', 1.8, 0.03, 0.2, 0, 2.2, 1.0)); });
  K.at([6.3, 0, 4.3], -0.8, () => officeChair(K)); K.at([hw - 0.5, 0, 5.6], 0, () => plant(K, 'ficus', { s: 1.7, potColor: '#c8c0b0', seed: 8 }));
  K.at([-1.0, 0, hd - 0.1], Math.PI, () => frame(K, 1.0, 0.7, (c, w, h) => { c.fillStyle = '#e8f0f0'; c.fillRect(0, 0, w, h); c.fillStyle = '#12606a'; c.fillRect(0, 0, w, h * 0.22); c.fillStyle = '#fff'; c.font = `bold ${h * 0.14}px Arial`; c.textAlign = 'center'; c.fillText('WASH YOUR HANDS', w / 2, h * 0.16); c.fillStyle = '#c0392b'; c.fillRect(w * 0.42, h * 0.4, w * 0.16, h * 0.4); c.fillRect(w * 0.3, h * 0.52, w * 0.4, h * 0.16); }, { y: 1.3, color: '#2a2a2e' }));
  const clk = wallClock(K, 0.2, -2.4, 2.4, hd - 0.1, Math.PI);
  const ecgDraw = (c, w, h, t, i) => { c.fillStyle = '#02100a'; c.fillRect(0, 0, w, h); c.strokeStyle = ['#3aff8a', '#ffd23a', '#46e6ff'][i % 3]; c.lineWidth = 3; c.beginPath(); const beat = (p) => p < 0.1 ? Math.sin(p / 0.1 * Math.PI) * 0.12 : p < 0.28 ? 0 : p < 0.31 ? -(p - 0.28) / 0.03 * 0.15 : p < 0.34 ? -0.15 + (p - 0.31) / 0.03 * 1.15 : p < 0.38 ? 1.0 - (p - 0.34) / 0.04 * 1.3 : p < 0.42 ? -0.3 + (p - 0.38) / 0.04 * 0.3 : p < 0.6 ? 0 : p < 0.72 ? Math.sin((p - 0.6) / 0.12 * Math.PI) * 0.2 : 0; for (let x = 0; x < w; x++) { const p = (((x / w * 2.2 - t * 0.9 * (1 + i * 0.1)) % 1) + 1) % 1; const y = h * 0.55 - beat(p) * h * 0.38; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.fillStyle = c.strokeStyle; c.font = `bold ${h * 0.14}px monospace`; c.textAlign = 'left'; c.fillText(['HR 78', 'HR 64', 'HR 92'][i % 3], 8, h * 0.16); c.fillText(['SpO2 98', 'SpO2 96', 'SpO2 93'][i % 3], w * 0.55, h * 0.16); };
  ecgs.forEach((s, i) => { ecgDraw(s.ctx, s.canvas.width, s.canvas.height, 0, i); s.tex.needsUpdate = true; });
  const anchors = camsOf({
    bed1: A([-5.5, 0.5, -hd + 1.4], 0), bed2: A([0, 0.5, -hd + 1.4], 0), bed3: A([5.5, 0.5, -hd + 1.4], 0), doctor1: A([-4.6, 0, -hd + 1.4], -Math.PI / 2), doctor2: A([0.9, 0, -hd + 1.4], -Math.PI / 2), doctor3: A([6.4, 0, -hd + 1.4], -Math.PI / 2), family1: A([-6.4, 0, -hd + 1.5], Math.PI / 2), family2: A([-0.9, 0, -hd + 1.5], Math.PI / 2),
    nurse1: A([-5.5, 0, -2.9], Math.PI), nurse2: A([0, 0, -2.9], Math.PI), nurseStation: AT([6.3, 0, 4.4], [7.0, 1.0, 4.0]), wardDoor: AT([1.0, 0, PZ + 0.8], [1.0, 1.4, -2]), wardEntry: AT([1.0, 0, PZ - 0.9], [0, 1.0, -5]), corridorW: AT([-6.5, 0, 4.0], [6, 1.4, 4.0]), corridorE: AT([4.5, 0, 4.0], [-6, 1.4, 4.0]), corridor: AT([-1, 0, 4.0], [4, 1.2, 4]), gurney: AT([-3.2, 0, 4.1], [-3.2, 0.9, 5.1]), exit: AT([-6.8, 0, 4.0], [-hw, 1.4, 4.0]), window: AT([-2.75, 0, -hd + 1.0], [-2.75, 1.5, -hd]), tv: AT([5.8, 0, -2.0], [hw, 2.1, -2.0]),
    camWide: AT([hw - 0.6, 1.9, 0.9], [-3.5, 1.0, -4.4]), camMid: AT([2.0, 1.55, PZ - 0.5], [-3.5, 1.0, -4.8]), camBed1: AT([-3.4, 1.6, -2.2], [-5.5, 0.9, -hd + 1.2]), camBed2: AT([2.0, 1.55, -2.4], [0, 0.9, -hd + 1.2]), camMonitor: AT([-4.0, 1.5, -hd + 1.0], [-6.1, 1.35, -hd + 0.3]), camWard: AT([-hw + 0.8, 1.7, 0.4], [3.0, 1.0, -4.6]),
    camCorridor: AT([-7.5, 1.65, 4.0], [7, 1.5, 4.0]), camCorridorRev: AT([7.0, 1.65, 3.2], [-7.5, 1.5, 4.2]), camNurse: AT([2.0, 1.6, 3.2], [7.0, 1.2, 4.2]), camDoor: AT([1.0, 1.6, 3.4], [1.0, 1.3, -2]),
  });
  return finishSet(K, { clock: clk, tv: wtvS, ecg: ecgs }, { bounds: { w: W, d: D, h: H }, anchors, lights: lights([0xeaf6f2, 0x90a09c, 1.6], [[0xf0fbff, 14, -3, 2.7, -3], [0xf0fbff, 14, 3, 2.7, 3.5]]), screens: [wtvS, ...ecgs],
    update(dt, t) { clk.set(t + 3 * 3600 + 14 * 60); wtvUp(t); ecgs.forEach((s, i) => { if (!s._custom && ((s._f = (s._f || 0) + 1) % 2 === 0)) { ecgDraw(s.ctx, s.canvas.width, s.canvas.height, t, i); s.tex.needsUpdate = true; } }); } });
}

// ================================================================== PHARMACY (botika)
const MEDC = ['#f4f4f0', '#2a6ab8', '#2f9a5a', '#e8c030', '#d9422a', '#f0f0f6', '#7a4ab0', '#e8884a', '#1a8a9a'];
function medShelf(K, rng, w, h, d, { back = true, dbl = false } = {}) {
  K.tinted('#e8e4da', () => { K.box('plastic', 0.03, h, d, -w / 2, 0, 0); K.box('plastic', 0.03, h, d, w / 2, 0, 0); if (back) K.box('plastic', w, h, 0.02, 0, 0, dbl ? 0 : -d / 2); const n = Math.round(h / 0.34); for (let i = 0; i <= n; i++) K.box('plastic', w, 0.025, d, 0, i * (h - 0.025) / n, 0); });
  const n = Math.round(h / 0.34);
  for (const side of dbl ? [-1, 1] : [1]) for (let r = 0; r < n; r++) { let x = -w / 2 + 0.05; while (x < w / 2 - 0.12) { const bw = rng.range(0.06, 0.13), bh = rng.range(0.1, 0.22); const bottle = rng.chance(0.25); K.tinted(rng.pick(MEDC), () => { if (bottle) K.cyl('plastic', bw * 0.4, bh, x + bw / 2, r * (h - 0.025) / n + 0.03, side * d * 0.22, { seg: 7, rt: bw * 0.3 }); else K.box('matte', bw, bh, d * 0.38, x + bw / 2, r * (h - 0.025) / n + 0.03, side * d * 0.2); }); x += bw + 0.008; } }
}
export function createPharmacy(opts = {}) {
  const W = 9, D = 7, H = 3.2, hw = W / 2, hd = D / 2; const K = new Kit({ name: 'pharmacy', env: 'mall', seed: 83 }); const rng = new RNG(83);
  K.setAmbience({ min: [-hw, 0, -hd], max: [hw, H, hd], floor: 0.4, wall: 0.35, ceil: 0.3, range: 0.9 });
  room(K, { w: W, d: D, h: H, t: 0.2, mat: 'plaster#f2f4f0', floor: 'checker#d8e8dc', ceil: 'ceilTile', holes: { s: [hole(-1.4, 4.8, hw, 0.0, 2.7), hole(2.7, 1.1, hw, 0, 2.15)] } });
  K.slab('paint#1c8a4b', -hw, 0, -hd, hw, 0.12, -hd + 0.02); K.slab('paint#1c8a4b', -hw, 2.7, -hd, hw, 2.78, -hd + 0.03);
  at(K, hw, hd, 's', -1.4, () => { K.tinted('#d8dcdc', () => { K.slab('plastic', -2.45, 0, -0.1, -2.35, 2.78, 0.06); K.slab('plastic', 2.35, 0, -0.1, 2.45, 2.78, 0.06); K.slab('plastic', -2.45, 2.7, -0.1, 2.45, 2.78, 0.06); K.slab('plastic', -2.45, 0, -0.1, 2.45, 0.08, 0.06); K.slab('plastic', -0.04, 0, -0.1, 0.04, 2.7, 0.06); }); K.tinted('#cfe6ee', () => K.box('glass', 4.7, 2.62, 0.02, 0, 0.08, -0.03)); put(K, backdrop(7.5, 4.0, 'day', 21), 0, 1.8, -2.6); });
  doorAt(K, hw, hd, 's', 2.7, 1.1, 2.15, '#d8dcdc', true);
  at(K, hw, hd, 's', 0, () => { }); K.at([-1.4, 0, hd - 0.1], Math.PI, () => { K.tinted('#e8f4ea', () => K.box('glow', 3.2, 0.5, 0.06, 0, 2.82, 0)); });
  // back wall: medicine shelving + hatch
  K.at([-1.7, 0, -hd + 0.2], 0, () => { medShelf(K, rng, 2.4, 2.5, 0.35); }); K.at([1.0, 0, -hd + 0.2], 0, () => medShelf(K, rng, 2.4, 2.5, 0.35)); K.at([3.45, 0, -hd + 0.2], 0, () => medShelf(K, rng, 1.0, 2.5, 0.35)); K.at([-3.65, 0, -hd + 0.2], 0, () => medShelf(K, rng, 1.0, 2.5, 0.35));
  K.at([-1.2, 0, -1.3], 0, () => { // sales counter (L): customers at +z
    K.tinted('#f4f6f2', () => K.box('plastic', 5.0, 1.0, 0.7, 0, 0, 0)); K.slab('marble#e8e8e4', -2.6, 1.0, -0.4, 2.6, 1.05, 0.4); K.box('paint#1c8a4b', 5.0, 0.1, 0.72, 0, 0.0, 0.0); K.box('glass', 2.0, 0.35, 0.5, -1.2, 1.05, 0.0); for (let i = 0; i < 7; i++) K.tinted(rng.pick(MEDC), () => K.box('matte', 0.16, 0.12, 0.2, -2.0 + i * 0.25, 1.06, 0.0));
    K.box('screenOff', 0.5, 0.3, 0.02, 1.5, 1.3, 0.0); K.box('darkMetal', 0.06, 0.3, 0.05, 1.5, 1.05, -0.05); K.box('plastic#d8d8d4', 0.4, 0.1, 0.35, 0.8, 1.05, 0.0); K.box('glow#a0ffb0', 0.1, 0.04, 0.02, 0.8, 1.15, 0.18); });
  K.at([3.1, 0, -1.9], 0, () => { K.box('plastic#f4f6f2', 1.4, 0.9, 0.6, 0, 0, 0); K.slab('marble#e8e8e4', -0.72, 0.9, -0.32, 0.72, 0.94, 0.32); K.box('screenOff', 0.5, 0.3, 0.02, 0, 1.2, -0.1); K.at([0, 0, 0.9], 2.8, () => officeChair(K)); });
  K.at([-0.2, 0, -2.5], 0.1, () => officeChair(K, { color: '#e8e8e4' }));
  K.at([hw - 0.4, 0, -0.5], -Math.PI / 2, () => { K.box('plastic#f4f6f2', 0.9, 1.8, 0.6, 0, 0, 0); K.tinted('#cfe6ee', () => K.box('glass', 0.8, 1.5, 0.02, 0, 0.15, 0.31)); for (let i = 0; i < 4; i++) K.tinted(rng.pick(MEDC), () => K.box('matte', 0.5, 0.12, 0.12, 0, 0.3 + i * 0.35, 0.1)); K.box('glow#cfeaff', 0.8, 0.04, 0.04, 0, 1.76, 0.3); });
  // customer area: gondolas, wall shelves
  K.at([-2.4, 0, 1.0], 0, () => { medShelf(K, rng, 2.4, 1.6, 0.45, { dbl: true }); K.box('plastic#1c8a4b', 2.4, 0.3, 0.05, 0, 1.9, 0); }); K.at([1.0, 0, 1.0], 0, () => { medShelf(K, rng, 2.4, 1.6, 0.45, { dbl: true }); K.box('plastic#1a6ab8', 2.4, 0.3, 0.05, 0, 1.9, 0); });
  K.at([-hw + 0.25, 0, 0.8], Math.PI / 2, () => medShelf(K, rng, 3.4, 2.2, 0.35)); K.at([hw - 0.25, 0, 1.6], -Math.PI / 2, () => medShelf(K, rng, 2.6, 2.2, 0.35));
  for (const [x, c, t] of [[-2.4, '#1c8a4b', 'VITAMINS'], [1.0, '#1a6ab8', 'FIRST AID']]) K.at([x, 0, 1.0], 0, () => put(K, signMesh(1.5, 0.3, (cx, w, h) => { cx.fillStyle = c; cx.fillRect(0, 0, w, h); cx.fillStyle = '#fff'; cx.font = `bold ${h * 0.6}px Arial`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, w / 2, h / 2); }, { px: 120, lit: true, emissive: 0.9, bg: c }), 0, 1.9, 0.03));
  K.at([hw - 0.6, 0, 3.0], -Math.PI / 2, () => { K.box('darkMetal', 0.5, 1.2, 0.4, 0, 0, 0); K.box('screenOff', 0.3, 0.2, 0.02, 0, 0.9, 0.21); K.cyl('plastic#d8d8d4', 0.05, 0.3, 0.1, 0.6, 0.0, { axis: 'z', seg: 8 }); });
  K.at([-hw + 0.8, 0, 3.0], 0.4, () => { K.cyl('chrome', 0.02, 1.0, 0, 0, 0, { seg: 6 }); K.box('plastic#e8e8e4', 0.45, 0.04, 0.4, 0, 0.0, 0); K.box('screenOff', 0.2, 0.12, 0.02, 0, 1.0, 0); });
  K.at([hw - 1.0, 0, 3.0], 0.3, () => chairPlastic(K, '#1c8a4b')); K.at([hw - 1.8, 0, 3.1], -0.2, () => chairPlastic(K, '#1c8a4b')); K.at([-hw + 0.4, 0, -hd + 0.4], 0, () => plant(K, 'ficus', { s: 1.4, potColor: '#c8c0b0', seed: 9 }));
  put(K, signMesh(4.4, 0.7, (c, w, h) => { c.fillStyle = '#12803a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.beginPath(); const cx = h * 0.5, cy = h / 2, a = h * 0.36; c.fillRect(cx - a * 0.3, cy - a, a * 0.6, a * 2); c.fillRect(cx - a, cy - a * 0.3, a * 2, a * 0.6); c.font = `900 ${h * 0.5}px Arial Black, Arial`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('BOTIKA NI JUAN', h * 1.1, h * 0.52); }, { px: 120, lit: true, emissive: 1.2, bg: '#12803a' }), -1.2, 2.85, -hd + 0.03);
  K.at([0, 0, 0], 0, () => { for (const x of [-3, -0.8, 1.6, 3.4]) for (const z of [-1.4, 1.6]) K.at([x, 0, z], 0, () => troffer(K, 1.2, 0.5, H, 'glow', 2)); });
  const clk = wallClock(K, 0.16, -hw + 0.03, 2.3, -1.0, Math.PI / 2);
  const anchors = camsOf({
    pharmacist: A([-1.2, 0, -2.0], 0), pharmacist2: A([1.2, 0, -2.0], 0), customer: A([-1.2, 0, -0.55], Math.PI), customer2: A([0.2, 0, -0.55], Math.PI), customer3: A([-2.5, 0, -0.55], Math.PI), queue: A([-1.0, 0, 0.2], Math.PI), aisle1: AT([-2.4, 0, 2.0], [-2.4, 1.0, 1.0]), aisle2: AT([1.0, 0, 2.0], [1.0, 1.0, 1.0]), aisle3: AT([-3.6, 0, 1.0], [-hw, 1.2, 0.8]), register: AT([1.0, 0, -2.2], [1.3, 1.0, -1.3]),
    door: AT([2.7, 0, hd - 0.7], [2.7, 1.4, 0]), window: AT([-1.4, 0, hd - 0.8], [-1.4, 1.4, hd]), bp: AT([hw - 1.2, 0, 3.0], [hw, 1.0, 3.0]), waiting: A([hw - 1.0, 0, 3.0], Math.PI), shelf: AT([-3.6, 0, -2.2], [-3.65, 1.4, -hd]),
    camWide: AT([3.9, 1.9, hd - 0.4], [-1.2, 1.2, -2.2]), camMid: AT([2.4, 1.55, 0.9], [-1.2, 1.3, -1.8]), camCounter: AT([-3.4, 1.5, 0.8], [-1.0, 1.25, -1.5]), camPharmacist: AT([1.2, 1.55, -0.2], [-1.2, 1.5, -2.2]), camCustomer: AT([-1.2, 1.55, -3.0], [-1.2, 1.5, 0.5]), camAisle: AT([-0.6, 1.6, 3.0], [-0.6, 1.0, 0.8]), camDoor: AT([-3.4, 1.6, -1.8], [2.7, 1.2, hd]), camShelf: AT([-1.0, 1.6, -0.6], [-1.5, 1.6, -hd]),
  });
  return finishSet(K, { clock: clk }, { bounds: { w: W, d: D, h: H }, anchors, lights: lights([0xf6fff8, 0x889088, 1.1], [[0xffffff, 10, -1.2, 2.9, -0.3], [0xf4fff6, 8, 0.8, 2.9, 2.2]]), update(dt, t) { clk.set(t + 10 * 3600 + 5 * 60); } });
}

// ================================================================== COURTROOM (Epiphany's world)
export function createCourtroom(opts = {}) {
  const W = 14, D = 12, H = 5.2, hw = W / 2, hd = D / 2; const K = new Kit({ name: 'courtroom', env: 'warm', seed: 84 }); const rng = new RNG(84);
  K.setAmbience({ min: [-hw, 0, -hd], max: [hw, H, hd], floor: 0.45, wall: 0.4, ceil: 0.3, range: 1.0 });
  room(K, { w: W, d: D, h: H, t: 0.2, mat: 'plaster#e8dcc4', floor: 'woodPlank#9a7048', ceil: 'soffit#f0e8d8', holes: { s: [hole(0, 1.9, hw, 0, 2.4)], e: [hole(-2.6, 1.4, hd, 1.0, 3.6), hole(0.2, 1.4, hd, 1.0, 3.6), hole(3.0, 1.4, hd, 1.0, 3.6)] } });
  for (const [a, b, c, d] of [[-hw, -hd, hw, -hd + 0.04], [-hw, -hd, -hw + 0.04, hd], [-hw, hd - 0.04, -1.04, hd], [1.04, hd - 0.04, hw, hd]]) { K.slab('woodGrain#8a5a34', a, 0, b, c, 2.5, d); K.slab('woodGrain#4a2c14', a, 2.45, b, c, 2.55, d + (d > b ? 0.01 : 0)); } K.slab('woodGrain#8a5a34', hw - 0.04, 0, -hd, hw, 1.0, hd);
  for (const z of [-3.6, 0.4, 4.4]) K.box('woodGrain#3a2210', W, 0.3, 0.3, 0, H - 0.3, z); for (const x of [-4.5, 0, 4.5]) K.box('woodGrain#3a2210', 0.3, 0.3, D, x, H - 0.3, 0);
  for (const wz of [-2.6, 0.2, 3.0]) { windowAt(K, hw, hd, 'e', wz, 1.4, 1.0, 3.6, { mood: 'day', seed: 31 + Math.round(wz), bl: true }); }
  doorAt(K, hw, hd, 's', -0.5, 0.95, 2.4, '#5a3a1e'); doorAt(K, hw, hd, 's', 0.5, 0.95, 2.4, '#5a3a1e');
  // judge's bench on a dais (north)
  K.slab('woodPlank#8a6038', -4.2, 0, -hd, 4.2, 0.45, -hd + 2.6); K.slab('woodGrain#3a2210', -4.2, 0.45, -hd + 2.6, 4.2, 0.5, -hd + 2.7);
  K.at([0, 0.45, -hd + 2.0], 0, () => { K.box('woodGrain#4a2c14', 5.2, 1.25, 0.9, 0, 0, 0); K.slab('woodGrain#2a160a', -2.75, 1.25, -0.5, 2.75, 1.31, 0.5); for (let i = 0; i < 6; i++) K.box('woodGrain#3a2210', 0.78, 0.9, 0.04, -2.1 + i * 0.84, 0.18, 0.46); K.at([0, 1.31, 0.1], 0, () => { K.cyl('woodGrain#3a2210', 0.04, 0.12, -0.8, 0, 0, { axis: 'x', seg: 8 }); K.box('woodGrain#3a2210', 0.12, 0.02, 0.12, -0.5, 0, 0); K.box('darkMetal', 0.5, 0.02, 0.08, 0.6, 0, 0.1); K.box('brass', 0.3, 0.1, 0.05, 0.1, 0, 0.3); K.tube('chrome', [[0.9, 0, 0.2], [0.9, 0.25, 0.2], [0.8, 0.35, 0.3]], 0.008, { radial: 4 }); K.box('screenOff', 0.5, 0.3, 0.02, -1.4, 0.2, 0.1); }); });
  K.at([0, 0.5, -hd + 1.0], 0, () => { officeChair(K, { color: '#3a2210', h: 0.52, back: 1.25 }); });
  K.at([0, 0, -hd + 0.06], 0, () => put(K, signMesh(1.8, 1.8, (c, w, h) => { const cx = w / 2, cy = h / 2; c.fillStyle = '#e6c46a'; c.beginPath(); c.arc(cx, cy, w * 0.48, 0, TAU); c.fill(); c.fillStyle = '#0038a8'; c.beginPath(); c.arc(cx, cy, w * 0.38, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, w * 0.2, 0, TAU); c.fill(); c.fillStyle = '#ce1126'; c.fillRect(cx - w * 0.16, cy, w * 0.32, w * 0.08); c.fillStyle = '#fff'; c.font = `bold ${w * 0.06}px Arial`; c.textAlign = 'center'; c.fillText('REPUBLIC OF THE PHILIPPINES', cx, cy - w * 0.28); c.fillText('REGIONAL TRIAL COURT', cx, cy + w * 0.34); }, { px: 160, rough: 0.5, bg: '#8a6a3a' }), 0, 3.7, 0.0));
  flagStand(K, -3.6, -hd + 1.0, 0.2, 2.6); flagStand(K, 3.6, -hd + 1.0, -0.2, 2.6);
  // witness stand, clerk, stenographer
  K.at([-4.4, 0, -3.1], Math.PI / 2, () => { K.slab('woodPlank#4a2e18', -0.75, 0, -0.7, 0.75, 0.3, 0.7); K.box('woodGrain#4a2c14', 1.2, 0.9, 0.9, 0, 0.3, 0.1); K.slab('woodGrain#2a160a', -0.65, 1.2, -0.35, 0.65, 1.26, 0.55); K.tube('chrome', [[0.3, 1.26, 0.2], [0.3, 1.5, 0.15], [0.15, 1.6, 0.25]], 0.008, { radial: 4 }); K.at([0, 0.3, -0.45], 0, () => chairWood(K, '#4a2c14', { h: 0.46, back: 0.9 })); });
  K.at([3.3, 0, -hd + 2.9], -Math.PI / 2, () => { K.box('woodGrain#4a2c14', 1.6, 0.85, 0.7, 0, 0, 0); K.slab('woodGrain#2a160a', -0.85, 0.85, -0.4, 0.85, 0.9, 0.4); K.box('screenOff', 0.4, 0.26, 0.02, 0, 0.98, -0.1); K.at([0, 0, -0.8], 0, () => officeChair(K)); });
  K.at([-2.6, 0, -hd + 2.9], Math.PI / 2 * 0, () => { K.box('woodGrain#4a2c14', 1.2, 0.75, 0.6, 0, 0, 0); K.box('darkMetal', 0.4, 0.04, 0.3, 0, 0.78, 0); K.at([0, 0, 0.7], Math.PI, () => officeChair(K)); });
  // counsel tables + chairs, podium
  for (const x of [-2.8, 2.8]) { K.at([x, 0, -0.8], 0, () => { tableRect(K, 2.2, 0.85, 0.76, { top: 'woodGrain', color: '#4a2c14', legStyle: 'panel' }); folder(K, -0.5, 0.76, 0.0, 0.3, '#d9b45a'); folder(K, 0.2, 0.76, 0.1, -0.2, '#2a5a8a'); paperStack(K, 0.7, 0.76, -0.1, 6, 0.1); K.box('darkMetal', 0.34, 0.02, 0.24, -0.8, 0.76, -0.1); K.box('screenOff', 0.34, 0.22, 0.01, -0.8, 0.78, -0.22); mug(K, '#f2f2ee', 0.95, 0.76, 0.1); }); for (const dx of [-0.55, 0.55]) K.at([x + dx, 0, 0.0], Math.PI, () => chairWood(K, '#3a2210', { h: 0.48, back: 1.0 })); }
  K.at([0, 0, -1.9], Math.PI, () => { K.box('woodGrain#4a2c14', 0.6, 1.1, 0.4, 0, 0, 0); K.at([0, 1.1, 0], [-0.3, 0, 0], () => K.box('woodGrain#3a2210', 0.64, 0.03, 0.44, 0, 0, 0)); });
  // bar rail + gallery
  K.box('woodGrain#3a2210', 5.6, 0.05, 0.08, -4.2, 1.0, 2.2); K.box('woodGrain#3a2210', 5.6, 0.05, 0.08, 4.2, 1.0, 2.2); for (let i = 0; i < 28; i++) { const x = (i < 14 ? -6.8 + i * 0.4 : 1.6 + (i - 14) * 0.4); K.box('woodGrain#4a2c14', 0.04, 0.95, 0.04, x, 0.05, 2.2); } K.box('woodGrain#4a2c14', 5.8, 0.4, 0.05, -4.1, 0.0, 2.2); K.box('woodGrain#4a2c14', 5.8, 0.4, 0.05, 4.1, 0.0, 2.2);
  for (let r = 0; r < 4; r++) for (const x of [-3.7, 3.7]) K.at([x, 0, 3.4 + r * 1.2], Math.PI, () => bench(K, 4.2, { color: '#4a2c14', back: true, d: 0.45 }));
  const clk = wallClock(K, 0.26, 0, 4.1, hd - 0.1, Math.PI);
  for (const [x, z] of [[-3.5, -2.0], [3.5, -2.0], [-3.5, 2.0], [3.5, 2.0], [-3.5, 5.0], [3.5, 5.0]]) K.at([x, 0, z], 0, () => { troffer(K, 1.4, 0.5, H, 'glow', 2); });
  for (const [x, z] of [[-4.5, -3.6], [4.5, -3.6], [-4.5, 0.4], [4.5, 0.4], [0, -1.8], [0, 2.4]]) lampShade(K, 0.3, 0.3, x, 3.4, z, { cordTo: H - 0.3, shade: 'paint#1c3a2a' });
  for (const [z, i] of [[-3.5, 0], [0.5, 1]]) frame(K, 0.9, 1.2, (c, w, h) => { c.fillStyle = ['#3a4a5a', '#5a4a3a'][i]; c.fillRect(0, 0, w, h); c.fillStyle = '#c8b898'; c.beginPath(); c.arc(w / 2, h * 0.38, w * 0.18, 0, TAU); c.fill(); c.fillRect(w * 0.25, h * 0.58, w * 0.5, h * 0.4); }, { x: -hw + 0.04, y: 1.4, z, rot: Math.PI / 2, color: '#c8a030' });
  const anchors = camsOf({
    judge: A([0, 0.5, -hd + 1.0], 0), witness: A([-4.4, 0.3, -2.65], Math.PI / 2 + 0.6), counsel1: A([-2.8, 0, -0.05], Math.PI), counsel2: A([2.8, 0, -0.05], Math.PI), counsel1b: A([-2.25, 0, 0.0], Math.PI), counsel2b: A([3.35, 0, 0.0], Math.PI), podium: A([0, 0, -1.2], Math.PI), approach: AT([-2.0, 0, -2.4], [-4.0, 1.2, -3.1]), clerk: A([4.2, 0, -hd + 2.9], -Math.PI / 2), stenographer: A([-2.6, 0, -hd + 3.6], Math.PI), bailiff: A([-5.6, 0, -2.0], Math.PI / 2),
    gallery1: A([-4.7, 0.45, 3.5], Math.PI), gallery2: A([-3.0, 0.45, 4.7], Math.PI), gallery3: A([3.0, 0.45, 3.5], Math.PI), gallery4: A([4.6, 0.45, 5.9], Math.PI), door: AT([0, 0, hd - 0.9], [0, 1.4, 0]), aisle: AT([0, 0, 3.0], [0, 1.0, -hd]), gate: AT([0, 0, 1.4], [0, 1.0, -hd]),
    camWide: AT([hw - 1.5, 3.2, hd - 0.8], [-1.0, 1.2, -hd + 2.0]), camMid: AT([2.0, 1.6, 3.4], [-1.0, 1.4, -2.0]), camJudge: AT([0.3, 1.7, 0.6], [0, 1.9, -hd + 1.0]), camWitness: AT([2.6, 1.6, -0.6], [-4.4, 1.5, -3.0]), camCounsel1: AT([-2.2, 1.55, -3.0], [-2.8, 1.45, -0.1]), camCounsel2: AT([2.2, 1.55, -3.0], [2.8, 1.45, -0.1]), camGallery: AT([0, 1.6, -3.0], [0, 1.2, 5.0]), camBench: AT([-3.6, 1.6, 1.2], [1.0, 1.8, -hd + 1.0]), camRear: AT([-0.6, 1.7, hd - 0.7], [0, 1.6, -hd + 1.0]),
  });
  return finishSet(K, { clock: clk }, { bounds: { w: W, d: D, h: H }, anchors, lights: lights([0xfff2dc, 0x8a7a6a, 1.8], [[0xffe0b0, 30, 0, 4.2, -2.0], [0xffe8c8, 24, 0, 4.2, 3.5]]), update(dt, t) { clk.set(t + 9 * 3600 + 40 * 60); } });
}

// ================================================================== LAW OFFICE
export function createLawOffice(opts = {}) {
  const W = 6.4, D = 5.6, H = 2.9, hw = W / 2, hd = D / 2; const K = new Kit({ name: 'law_office', env: 'warm', seed: 85 }); const rng = new RNG(85);
  K.setAmbience({ min: [-hw, 0, -hd], max: [hw, H, hd], floor: 0.5, wall: 0.45, ceil: 0.35, range: 0.8 });
  room(K, { w: W, d: D, h: H, t: 0.2, mat: 'plaster#d8d0bc', floor: 'woodPlank#9a7048', ceil: 'soffit#f0e8d8', holes: { n: [hole(0.6, 2.6, hw, 1.15, 2.5)], s: [hole(-2.0, 0.95, hw)] } });
  for (const [a, b, c, d] of [[-hw, -hd, hw, -hd + 0.03], [-hw, hd - 0.03, -2.54, hd], [-1.46, hd - 0.03, hw, hd], [hw - 0.03, -hd, hw, hd]]) K.slab('woodGrain#4a2c14', a, 0, b, c, 1.1, d); K.slab('woodGrain#4a2c14', -hw, 0, -hd, -hw + 0.03, 1.1, hd);
  windowAt(K, hw, hd, 'n', 0.6, 2.6, 1.15, 2.5, { mood: 'dusk', seed: 41, bl: true }); doorAt(K, hw, hd, 's', -2.0, 0.95, 2.1, '#4a2c14', true);
  K.slab('carpet#7a2a2a', -2.0, 0.003, -1.9, 2.0, 0.012, 1.9);
  // west wall of law books
  for (let i = 0; i < 3; i++) K.at([-hw + 0.2, 0, -1.6 + i * 1.5], Math.PI / 2, () => bookshelf(K, rng, 1.4, 2.4, 0.34));
  // desk + chairs
  K.at([0.3, 0, -1.35], 0, () => { K.box('woodGrain#4a2810', 2.0, 0.72, 0.9, 0, 0, 0); K.slab('leather#2a3a2a', -0.95, 0.72, -0.4, 0.95, 0.745, 0.4); K.slab('woodGrain#3a1e0c', -1.05, 0.745 - 0.02, -0.46, 1.05, 0.77, 0.46); K.box('darkMetal', 0.02, 0.02, 0.02, 0, 0, 0); for (let i = 0; i < 3; i++) K.box('brass', 0.12, 0.012, 0.012, -0.6 + 0.4 * 0, 0.2 + i * 0.2, 0.46);
    folder(K, -0.6, 0.77, 0.0, 0.1, '#d9b45a'); folder(K, -0.45, 0.78, 0.05, -0.2, '#2a5a8a'); paperStack(K, 0.5, 0.77, 0.1, 8, 0.2); K.box('darkMetal', 0.34, 0.02, 0.24, 0.0, 0.77, 0.0); K.at([0.0, 0.79, -0.1], [-0.2, 0, 0], () => K.box('screenOff', 0.34, 0.22, 0.01, 0, 0, -0.1)); mug(K, '#2a5a8a', 0.75, 0.77, -0.2); K.box('brass', 0.35, 0.06, 0.07, 0.3, 0.77, 0.32); K.at([-0.85, 0.77, -0.25], 0, () => { K.cyl('brass', 0.1, 0.02, 0, 0, 0, { seg: 10 }); K.cyl('brass', 0.012, 0.28, 0, 0.02, 0, { seg: 5 }); K.box('brass', 0.3, 0.01, 0.01, 0, 0.3, 0); for (const sx of [-0.15, 0.15]) K.cyl('brass', 0.05, 0.01, sx, 0.2, 0, { seg: 8 }); }); });
  K.at([0.3, 0, -2.25], 0.15, () => officeChair(K, { color: '#2a1a12', h: 0.5, back: 1.1 })); K.at([-0.5, 0, 0.0], Math.PI - 0.15, () => chairWood(K, '#3a2a1a', { h: 0.46, back: 0.9 })); K.at([1.1, 0, 0.0], Math.PI + 0.15, () => chairWood(K, '#3a2a1a', { h: 0.46, back: 0.9 }));
  K.at([hw - 0.5, 0, 1.0], -Math.PI / 2, () => sofa(K, 1.8, '#4a3a2e', { mat: 'leather' })); K.at([hw - 1.3, 0, 1.0], -Math.PI / 2, () => tableRect(K, 0.9, 0.5, 0.4, { top: 'woodGrain', color: '#4a2c14' }));
  for (let i = 0; i < 2; i++) K.at([hw - 0.35, 0, -hd + 0.5 + i * 0.5], -Math.PI / 2, () => { K.box('darkMetal#6a7078', 0.45, 1.3, 0.55, 0, 0, 0); for (let j = 0; j < 3; j++) { K.box('steelPlain', 0.3, 0.03, 0.02, 0, 0.2 + j * 0.4, 0.28); } });
  flagStand(K, 2.5, -hd + 0.5, -0.2, 2.2); K.at([hw - 0.4, 0, -hd + 0.2], 0, () => { }); K.at([hw - 0.6, 0, hd - 0.6], 0, () => plant(K, 'ficus', { s: 1.6, potColor: '#c8c0b0', seed: 11 }));
  K.at([-1.2, 0, -hd + 0.5], 0, () => { K.cyl('darkMetal', 0.02, 1.6, 0, 0, 0, { seg: 5 }); lampShade(K, 0.22, 0.28, 0, 1.6, 0, { shade: 'paint#1c3a2a' }); K.cyl('darkMetal', 0.16, 0.02, 0, 0, 0, { seg: 12 }); });
  const dip = (i) => (c, w, h) => { c.fillStyle = '#f4ecd0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a6a2a'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = '#2a1a0a'; c.textAlign = 'center'; c.font = `bold ${h * 0.12}px serif`; c.fillText(['UNIVERSITY OF SAN CARLOS', 'INTEGRATED BAR OF THE PHILIPPINES', 'CERTIFICATE OF ADMISSION'][i], w / 2, h * 0.3); c.font = `${h * 0.1}px serif`; c.fillText('JURIS DOCTOR', w / 2, h * 0.5); c.beginPath(); c.arc(w * 0.8, h * 0.78, h * 0.1, 0, TAU); c.fillStyle = '#b8902a'; c.fill(); c.fillStyle = '#2a1a0a'; c.fillRect(w * 0.2, h * 0.75, w * 0.35, 3); };
  for (let i = 0; i < 3; i++) frame(K, 0.55, 0.42, dip(i), { x: hw - 0.04, y: 1.45, z: -1.6 + i * 0.7, rot: -Math.PI / 2, color: '#2a1a0a' });
  frame(K, 1.0, 0.7, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a4a6a'; c.fillRect(0, h * 0.62, w, h * 0.38); c.fillStyle = '#6a8ab0'; c.fillRect(0, h * 0.5, w, h * 0.14); }, { x: -2.2, y: 1.5, z: hd - 0.04, rot: Math.PI, color: '#6a4a2a' });
  const clk = wallClock(K, 0.16, 2.4, 2.35, hd - 0.1, Math.PI);
  for (const [x, z] of [[-1.2, -1.0], [1.2, 0.6]]) K.at([x, 0, z], 0, () => troffer(K, 0.9, 0.45, H, 'glow', 2)); lampShade(K, 0.25, 0.22, 0.3, 2.0, -0.2, { cordTo: H, glow: 'glowWarm' });
  const anchors = camsOf({
    lawyer: A([0.3, 0, -1.95], 0), lawyerStand: AT([0.3, 0, -2.5], [0.3, 1.2, 0]), client1: A([-0.5, 0, 0.1], Math.PI), client2: A([1.1, 0, 0.1], Math.PI), sofa: A([hw - 0.6, 0.0, 1.0], -Math.PI / 2), shelf: AT([-hw + 1.3, 0, -0.1], [-hw, 1.4, -0.1]), window: AT([0.6, 0, -hd + 0.9], [0.6, 1.5, -hd]), door: AT([-2.0, 0, hd - 0.8], [-2.0, 1.4, 0]), diplomas: AT([hw - 1.2, 0, -0.9], [hw, 1.5, -0.9]),
    camWide: AT([-hw + 0.6, 2.0, hd - 0.5], [0.6, 1.1, -1.4]), camMid: AT([-1.6, 1.55, 1.3], [0.3, 1.25, -1.5]), camDesk: AT([0.3, 1.5, 1.7], [0.3, 1.2, -1.6]), camClient: AT([0.3, 1.5, -3.0 + 0.4], [0.3, 1.4, 0.2]), camWindow: AT([-1.6, 1.5, 0.6], [0.8, 1.6, -hd]), camShelf: AT([1.6, 1.6, 0.4], [-hw, 1.4, -0.4]), camDoor: AT([2.0, 1.6, -1.2], [-2.0, 1.2, hd]),
  });
  return finishSet(K, { clock: clk }, { bounds: { w: W, d: D, h: H }, anchors, lights: lights([0xffeed4, 0x8a7a6a, 1.5], [[0xffd8a0, 16, 0.3, 2.5, -0.3], [0xffe8c8, 9, -1.5, 2.4, 1.5]]), update(dt, t) { clk.set(t + 16 * 3600 + 25 * 60); } });
}
