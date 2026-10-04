// Shop fronts (mall + concourse backdrops). Local frame: origin = floor at the centre of the shop frontage, front faces +Z, shop interior extends to -Z.
import * as THREE from 'three';
import { RNG, TAU } from '../../../engine/common.js';
import { atlas, uvRect, signMesh } from './kit.js';

export const SHOP_NAMES = [
  ['BENCHMARK', '#1b1f2a', '#ffffff', 'apparel'], ['Kuya Shoes', '#b3262d', '#fff3d0', 'shoes'], ['iGadget Hub', '#0e1b33', '#58d0ff', 'tech'], ['Pahinga Cafe', '#4a2f1d', '#f6e3c1', 'food'],
  ['Sulat Books', '#14532d', '#fff2b0', 'books'], ['Optica Pilipinas', '#f2f2f2', '#1b4d9b', 'optic'], ['Little Giants', '#ffd23f', '#e63946', 'kids'], ['MEGA SPORTS', '#101010', '#ff7a1a', 'sports'],
  ['Dumaguete Bakeshop', '#f5d6a0', '#8a3b12', 'food'], ['SeaBreeze', '#1ab6c9', '#ffffff', 'apparel'], ['Pearl Jewellers', '#2a1236', '#f0d27a', 'jewel'], ['CELL WORLD', '#d6002a', '#ffffff', 'tech'],
  ['Mabuhay Botica', '#1c8a4b', '#ffffff', 'pharm'], ['Sari-Sari Mart', '#ff9f1c', '#2b2b2b', 'food'], ['Bella Salon', '#e34a8f', '#ffffff', 'salon'], ['UniFashion', '#6a1b9a', '#ffffff', 'apparel'],
];
const _atl = new Map();
export function shopSignAtlas() {
  if (_atl.has('sign')) return _atl.get('sign');
  const a = atlas(2, 8, 512, 96, (ctx, i, w, h) => {
    const [name, bg, fg] = SHOP_NAMES[i]; ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const fonts = ['bold 54px "Arial Black",Impact,sans-serif', 'italic bold 52px Georgia,serif', 'bold 50px "Trebuchet MS",sans-serif', '600 52px "Courier New",monospace'];
    ctx.font = fonts[i % 4]; let fs = 54; while (ctx.measureText(name).width > w - 130 && fs > 20) { fs -= 2; ctx.font = ctx.font.replace(/\d+px/, fs + 'px'); }
    ctx.fillText(name, w / 2 + 28, h / 2 + 3);
    ctx.beginPath(); ctx.arc(46, h / 2, 26, 0, TAU); ctx.strokeStyle = fg; ctx.lineWidth = 5; ctx.stroke(); ctx.beginPath(); ctx.moveTo(34, h / 2 + 8); ctx.lineTo(46, h / 2 - 14); ctx.lineTo(58, h / 2 + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(0, 0, w, 3); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, h - 4, w, 4);
  });
  a.tex.userData.shared = true; _atl.set('sign', a); return a;
}
export function shopBackAtlas() {
  if (_atl.has('back')) return _atl.get('back');
  const a = atlas(2, 4, 256, 128, (ctx, i, w, h) => {
    const r = new RNG(i + 5); const pal = [['#d9d2c5', '#222', '#b33'], ['#c8d6e6', '#123', '#3a7'], ['#f0e0c8', '#431', '#c82'], ['#e8e8e8', '#333', '#27c'], ['#2a2236', '#fff', '#fc4'], ['#ddebd8', '#242', '#e63'], ['#f6e9e0', '#512', '#d49'], ['#101822', '#8cf', '#f84']][i];
    ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) { const y = 14 + row * 28; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(6, y + 22, w - 12, 3); let x = 10; while (x < w - 24) { const bw = r.range(10, 26), bh = r.range(10, 22); ctx.fillStyle = r.chance(0.5) ? pal[2] : r.pick(['#fff', '#444', '#e5b', '#4a8', '#fb3', '#38d', '#d33']); ctx.globalAlpha = 0.9; ctx.fillRect(x, y + 22 - bh, bw, bh); ctx.globalAlpha = 1; x += bw + r.range(2, 8); } }
    ctx.fillStyle = pal[1]; ctx.globalAlpha = 0.7; ctx.fillRect(w * 0.35, 4, w * 0.3, 8); ctx.globalAlpha = 1;
  });
  a.tex.userData.shared = true; _atl.set('back', a); return a;
}
export function disposeShopAtlases() { for (const a of _atl.values()) a.tex.dispose(); _atl.clear(); }

function mannequin(K, color, x, z, ry = 0) {
  K.at([x, 0, z], ry, () => {
    K.cyl('chrome', 0.15, 0.015, 0, 0, 0, { seg: 12 }); K.cyl('chrome', 0.012, 1.0, 0, 0.015, 0, { seg: 6 });
    K.tinted('#d8d0c4', () => { K.sph('plastic', 0.085, 0, 1.62, 0, { seg: 10, segH: 7, s: [0.9, 1.2, 1] }); K.cyl('plastic', 0.04, 0.1, 0, 1.46, 0, { seg: 8 }); });
    K.tinted(color, () => { K.cyl('fabric', 0.17, 0.5, 0, 1.0, 0, { seg: 10, rt: 0.2, s: [1.1, 0.7] }); K.cyl('fabric', 0.15, 0.3, 0, 0.72, 0, { seg: 10, rt: 0.17, s: [1.1, 0.7] }); for (const s of [-1, 1]) K.cyl('fabric', 0.04, 0.45, s * 0.22, 1.05, 0, { seg: 6, rt: 0.045 }); });
    K.tinted('#2a3550', () => { for (const s of [-1, 1]) K.cyl('fabric', 0.065, 0.7, s * 0.08, 0.02, 0, { seg: 8, rt: 0.075 }); });
  });
}
function rack(K, rng, x, z, w = 1.4) {
  K.at([x, 0, z], 0, () => {
    for (const s of [-1, 1]) K.cyl('chrome', 0.012, 1.5, s * w / 2, 0, 0, { seg: 6 }); K.cyl('chrome', 0.012, w, 0, 1.5, 0, { axis: 'x', seg: 6 }); K.cyl('chrome', 0.012, w, 0, 1.2, 0, { axis: 'x', seg: 6 });
    for (let i = 0; i < 11; i++) K.tinted(rng.pick(['#c0392b', '#2c6fbb', '#e5b53a', '#2a8a5a', '#f0f0f0', '#222', '#d47aa6', '#7a5ac0']), () => K.box('fabric', 0.03, 0.55, 0.45, -w / 2 + 0.1 + i * (w - 0.2) / 10, 0.95, 0));
  });
}
function shelfWall(K, rng, w, zBack) {
  for (let r = 0; r < 4; r++) { K.box('paint#e0e0e0', w - 0.2, 0.025, 0.4, 0, 0.55 + r * 0.5, zBack + 0.2); let x = -w / 2 + 0.2; while (x < w / 2 - 0.35) { const bw = rng.range(0.1, 0.3), bh = rng.range(0.14, 0.34); K.tinted(rng.pick(['#e5b53a', '#2c6fbb', '#d94b4b', '#f4f4f0', '#3a3a3a', '#47a56a']), () => K.box('matte', bw, bh, 0.28, x + bw / 2, 0.575 + r * 0.5, zBack + 0.22)); x += bw + rng.range(0.03, 0.1); } }
}
/** Build a shopfront. opts {w, h, idx (SHOP_NAMES index), depth, seed}. Returns nothing (adds to K). */
export function shopFront(K, { w = 5, h = 4.2, idx = 0, depth = 3.6, seed = 1, openDoor = true, lit = 1 } = {}) {
  const rng = new RNG(seed * 31 + idx); const sa = shopSignAtlas(), ba = shopBackAtlas(); const kind = SHOP_NAMES[idx % SHOP_NAMES.length][3];
  if (!K.mats.has('shopSign')) { K.defMat('shopSign', { map: sa.tex, color: 0xffffff, rough: 0.4, uv: 'own', emissive: 0xffffff, emissiveIntensity: 0.0 }); const m = K.m('shopSign'); m.emissiveMap = sa.tex; m.emissiveIntensity = 0.85; K.defMat('shopBack', { map: ba.tex, color: 0xffffff, rough: 0.8, uv: 'own', emissive: 0xffffff, emissiveIntensity: 0 }); const mb = K.m('shopBack'); mb.emissiveMap = ba.tex; mb.emissiveIntensity = 0.55; }
  const fh = 0.85, gh = h - fh - 0.35;
  // fascia sign + lit lightbox edge
  K.box('paint#2b2d31', w, fh, 0.2, 0, h - fh, -0.1);
  K.geo('shopSign', uvRect(new THREE.PlaneGeometry(w - 0.3, fh - 0.14), sa.cell(idx % SHOP_NAMES.length)), 0, h - fh / 2, 0.003);
  K.box('chrome', w, 0.03, 0.22, 0, h - fh - 0.03, -0.1);
  // shutter housing + frame
  K.box('darkMetal', w, 0.3, 0.22, 0, h - fh - 0.33, -0.1);
  for (const s of [-1, 1]) K.box('darkMetal', 0.1, h - fh, 0.2, s * (w / 2 - 0.05), 0, -0.1);
  // glass wall with mullions and a door
  const dw = 1.5, dx = rng.range(-w / 4, w / 4);
  K.box('glass', w - 0.2, gh, 0.02, 0, 0.0, -0.02);
  K.box('darkMetal', w - 0.2, 0.1, 0.1, 0, 0, -0.05);
  K.box('darkMetal', 0.06, gh, 0.07, dx - dw / 2, 0, -0.05); K.box('darkMetal', 0.06, gh, 0.07, dx + dw / 2, 0, -0.05); K.box('darkMetal', dw, 0.06, 0.07, dx, gh - 0.05, -0.05);
  K.box('chrome', 0.02, 0.6, 0.03, dx - 0.2, 0.9, 0.0); K.box('chrome', 0.02, 0.6, 0.03, dx + 0.2, 0.9, 0.0);
  for (let i = 1; i < 3; i++) { const mx = -w / 2 + 0.1 + i * (w - 0.2) / 3; if (Math.abs(mx - dx) > dw / 2 + 0.1) K.box('darkMetal', 0.05, gh, 0.07, mx, 0, -0.05); }
  // interior shell
  const D = depth; K.box('tileFloor#d8d0c4', w - 0.2, 0.02, D, 0, 0.0, -D / 2); K.box('plaster#e8e6e0', 0.1, h - fh - 0.35, D, -w / 2 + 0.05, 0, -D / 2); K.box('plaster#e8e6e0', 0.1, h - fh - 0.35, D, w / 2 - 0.05, 0, -D / 2);
  K.box('paint#f4f4f0', w, 0.05, D, 0, h - fh - 0.4, -D / 2);
  K.geo('shopBack', uvRect(new THREE.PlaneGeometry(w - 0.2, h - fh - 0.4), ba.cell((idx * 3 + seed) % 8)), 0, (h - fh - 0.4) / 2 + 0.02, -D + 0.01);
  K.tinted('#fff5e0', () => { for (let i = 0; i < Math.max(2, Math.round(w / 1.6)); i++) K.box('glow', 0.9, 0.02, 0.15, -w / 2 + 0.7 + i * 1.6, h - fh - 0.43, -D * 0.4); });
  // shop dressing by kind
  if (kind === 'apparel' || kind === 'sports') { mannequin(K, rng.pick(['#c0392b', '#2c6fbb', '#e5b53a', '#2a8a5a']), -w / 4, -0.9, rng.range(-0.5, 0.5)); mannequin(K, rng.pick(['#f0f0f0', '#222', '#7a5ac0']), w / 6, -1.1, rng.range(-0.5, 0.5)); rack(K, rng, w / 3, -2.2, 1.3); }
  else if (kind === 'shoes' || kind === 'tech' || kind === 'pharm' || kind === 'food' || kind === 'kids' || kind === 'jewel' || kind === 'salon' || kind === 'optic' || kind === 'books') {
    shelfWall(K, rng, w, -D);
    K.tinted(rng.pick(['#e8e4dc', '#222', '#c8a070']), () => { K.box('woodGrain', w * 0.5, 0.9, 0.7, -0.4, 0, -1.8); });
    if (kind === 'tech') { for (let i = 0; i < 4; i++) K.tinted(rng.pick(['#58d0ff', '#ffd23f', '#8fff9a', '#ffffff']), () => K.box('glow', 0.18, 0.003, 0.12, -1.0 + i * 0.35, 0.91, -1.8)); }
    if (kind === 'food') { K.tinted('#fff0cc', () => K.box('glow', w * 0.45, 0.35, 0.02, -0.4, 1.4, -2.2)); }
  }
  K.at([dx, 0, 0.0], 0, () => { });
}
/** a plain shop-lined wall, n shopfronts side by side. Local frame: x from -n*w/2..n*w/2 */
export function shopRow(K, n, w, h, startIdx = 0, seed = 1) {
  for (let i = 0; i < n; i++) K.at([-(n - 1) * w / 2 + i * w, 0, 0], 0, () => shopFront(K, { w: w - 0.1, h, idx: (startIdx + i * 3 + seed) % 16, seed: seed + i }));
}
