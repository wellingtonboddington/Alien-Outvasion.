// Fast-food restaurants: McD (Dumaguete food court) + McD California (drive-thru + parking lot).
// Brand note: golden double-arch SHAPE and "Mc" menu names only; no exact trademark artwork.
import * as THREE from 'three';
import { RNG, TAU } from '../../../engine/common.js';
import { Kit, atlas, signMesh, uvRect, makeScreen, mat4, canvasTexture } from './kit.js';
import { room, wall, troffer, plant, palm, chairPlastic, stoolRound, tableRect, tableRound, bench, trashBin, wallClock, fireExt, finishSet, A, AT, frame, officeChair } from './props.js';
import { shopRow, shopFront } from './shops.js';

const RED = '#c8102e', YEL = '#ffc72c', DKRED = '#8f0c20';
const PESO = 'P';

// ------------------------------------------------------------------ food + small props
export function archesGeo(R = 0.3, t = 0.07, L = 0.25, ryo = 0.72, depth = 0.1) {
  const ro = R + t, ri = R - t, ryi = ryo - 2 * t; const sh = new THREE.Shape();
  sh.moveTo(-ro, 0); sh.lineTo(-ro, L); sh.absellipse(0, L, ro, ryo, Math.PI, 0, true); sh.lineTo(ro, 0); sh.lineTo(ri, 0); sh.lineTo(ri, L); sh.absellipse(0, L, ri, ryi, 0, Math.PI, false); sh.lineTo(-ri, 0); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 14 }); g.translate(0, 0, -depth / 2); return g;
}
/** golden twin-arch emblem, base at y=0 centred on x, facing +Z; s = scale (1 ≈ 1.4 m wide) */
export function arches(K, s = 1, mat = 'goldArch', depth = 0.1) {
  const R = 0.3; K.at([0, 0, 0], 0, () => { for (const sx of [-1, 1]) { const g = archesGeo(R, 0.07, 0.25, 0.72, depth); K.geo(mat, g, sx * R * s, 0, sx > 0 ? 0.002 * s : 0, 0, s); } });
}
export function burger(K, x, y, z, s = 1, rng = null) {
  K.at([x, y, z], rng ? rng.range(0, TAU) : 0, () => {
    K.tinted('#d89a4a', () => { K.cyl('matte', 0.05 * s, 0.014 * s, 0, 0, 0, { seg: 14, rt: 0.046 * s }); });
    K.tinted('#e8d35a', () => K.box('matte', 0.09 * s, 0.004 * s, 0.09 * s, 0, 0.014 * s, 0, 0.5));
    K.tinted('#4a2a18', () => K.cyl('matte', 0.047 * s, 0.014 * s, 0, 0.018 * s, 0, { seg: 14 }));
    K.tinted('#e8d35a', () => K.box('matte', 0.1 * s, 0.003 * s, 0.1 * s, 0, 0.032 * s, 0, 0.9));
    K.tinted('#4fa332', () => K.cyl('leaf', 0.055 * s, 0.006 * s, 0, 0.034 * s, 0, { seg: 12 }));
    K.tinted('#c8321e', () => K.cyl('matte', 0.043 * s, 0.006 * s, 0, 0.04 * s, 0, { seg: 12 }));
    K.tinted('#d89a4a', () => K.sph('matte', 0.052 * s, 0, 0.046 * s, 0, { seg: 14, segH: 6, thL: Math.PI / 2, s: [1, 0.75, 1] }));
    K.tinted('#fff0c8', () => { for (let i = 0; i < 9; i++) K.sph('matte', 0.004 * s, Math.cos(i * 2.4) * 0.03 * s * (0.4 + i / 14), 0.046 * s + 0.032 * s * Math.sqrt(Math.max(0, 1 - Math.pow(0.6 * (i / 9), 2))), Math.sin(i * 2.4) * 0.03 * s * (0.4 + i / 14), { seg: 4, segH: 3 }); });
  });
}
export function friesBox(K, x, y, z, rot = 0, s = 1) {
  K.at([x, y, z], rot, () => {
    K.tinted(RED, () => { K.add('matte', (() => { const g = new THREE.CylinderGeometry(0.045 * s, 0.035 * s, 0.1 * s, 4, 1, true); g.rotateY(Math.PI / 4); g.translate(0, 0.05 * s, 0); return g; })()); });
    const r = new RNG(7); K.tinted('#f2c230', () => { for (let i = 0; i < 16; i++) K.box('matte', 0.01 * s, 0.07 * s, 0.01 * s, r.range(-0.03, 0.03) * s, 0.09 * s, r.range(-0.03, 0.03) * s, r.range(-0.4, 0.4)); });
    K.box('paint#ffc72c', 0.05 * s, 0.03 * s, 0.002, 0, 0.04 * s, 0.047 * s);
  });
}
export function cupSoda(K, x, y, z, { color = '#f4f4f0', band = RED, h = 0.15 } = {}) {
  K.tinted(color, () => K.lathe('plastic', [[0, 0], [0.026, 0], [0.031, 0.003], [0.04, h], [0.0, h]], x, y, z, { seg: 12 }));
  K.tinted(band, () => K.lathe('plastic', [[0.032, h * 0.35], [0.0345, h * 0.35], [0.036, h * 0.75], [0.0335, h * 0.75]], x, y, z, { seg: 12 }));
  K.tinted('#f4f4f0', () => { K.cyl('plastic', 0.043, 0.008, x, y + h, z, { seg: 12 }); K.cyl('plastic', 0.03, 0.01, x, y + h + 0.008, z, { seg: 12, rt: 0.02 }); });
  K.tinted('#d83a3a', () => K.cyl('plastic', 0.003, 0.08, x + 0.01, y + h + 0.01, z, { seg: 4 }));
}
export function foodTray(K, x, y, z, rot = 0, rng = new RNG(3)) {
  K.at([x, y, z], rot, () => {
    K.tinted(RED, () => K.rbox('plastic', 0.44, 0.014, 0.33, 0.006, 0, 0, 0)); K.tinted('#f6f3ea', () => K.box('matte', 0.38, 0.002, 0.27, 0, 0.014, 0));
    burger(K, -0.1, 0.016, 0.02, 1, rng); if (rng.chance(0.7)) burger(K, 0.0, 0.016, -0.06, 0.9, rng); friesBox(K, 0.1, 0.016, 0.05, 0.2); cupSoda(K, 0.16, 0.016, -0.08, { color: '#e8e8e4' });
  });
}
export function napkinBox(K, x, y, z) { K.tinted('#c8c8c4', () => K.rbox('steelPlain', 0.12, 0.1, 0.06, 0.01, x, y, z)); K.tinted('#ffffff', () => K.box('matte', 0.1, 0.02, 0.05, x, y + 0.1, z)); }
export function posTerminal(K, screen) {
  K.rbox('paint#1e2024', 0.34, 0.03, 0.26, 0.01, 0, 0, 0); K.cyl('darkMetal', 0.02, 0.2, 0, 0.03, -0.04, { seg: 8 });
  K.at([0, 0.23, -0.04], [-0.28, 0, 0], () => { K.rbox('paint#1e2024', 0.32, 0.23, 0.025, 0.01, 0, 0, 0); if (screen) { screen.mesh.position.set(0, 0.115, 0.014); K.mesh(screen.mesh); } });
  K.rbox('paint#2a2d33', 0.09, 0.02, 0.13, 0.008, 0.25, 0, 0.0); K.box('paint#111', 0.07, 0.003, 0.08, 0.25, 0.02, 0); K.rbox('paint#d8d8d4', 0.1, 0.1, 0.11, 0.015, -0.28, 0, 0.0); K.box('paint#f4f4f0', 0.07, 0.002, 0.12, -0.28, 0.1, 0.07);
}
const drawPOS = (ctx, w, h) => { ctx.fillStyle = '#12161c'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = RED; ctx.fillRect(0, 0, w, 26); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textBaseline = 'middle'; ctx.fillText('ORDER #0042  •  DINE IN', 8, 14); const items = [['Double McBurger', 129], ['McFries L', 69], ['McFloat', 49], ['McChick', 99]]; ctx.font = '15px Arial'; items.forEach((it, i) => { ctx.fillStyle = '#dfe6ee'; ctx.fillText(it[0], 10, 48 + i * 22); ctx.fillText(PESO + it[1], w - 56, 48 + i * 22); }); ctx.fillStyle = YEL; ctx.fillRect(0, h - 36, w, 36); ctx.fillStyle = '#111'; ctx.font = 'bold 20px Arial'; ctx.fillText('TOTAL ' + PESO + '346', 12, h - 17); };
const drawKiosk = (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d6102e'); g.addColorStop(1, '#8f0c20'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = YEL; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center'; ctx.fillText('TOUCH TO ORDER', w / 2, 70); ctx.fillStyle = '#fff'; ctx.font = '22px Arial'; ctx.fillText('Dine in  •  Take out', w / 2, 110); for (let i = 0; i < 6; i++) { const x = 30 + (i % 3) * 112, y = 150 + Math.floor(i / 3) * 110; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 100, 96); ctx.fillStyle = ['#d89a4a', '#f2c230', '#8a5a3a', '#e8e8e4', '#c8321e', '#4fa332'][i]; ctx.beginPath(); ctx.arc(x + 50, y + 42, 28, 0, TAU); ctx.fill(); ctx.fillStyle = '#222'; ctx.font = 'bold 13px Arial'; ctx.fillText(['Burgers', 'Fries', 'Chicken', 'Drinks', 'Sweets', 'Salad'][i], x + 50, y + 88); } };
function menuCanvas(kind) {
  return (ctx, w, h) => {
    const sets = {
      burgers: ['BURGERS', [['McBurger', 59], ['Cheese McBurger', 79], ['Double McBurger', 129], ['McChick Sandwich', 99], ['McSpicy Chicken', 119], ['Big Stack', 159]], '#d89a4a'],
      meals: ['VALUE MEALS', [['Burger Meal', 119], ['Chick Meal', 139], ['2-pc Chicken Meal', 169], ['McSpaghetti Meal', 109], ['Family Bucket', 489], ['Kids Meal + Toy', 129]], '#f2c230'],
      sides: ['SIDES & BREKKIE', [['McFries Medium', 59], ['McFries Large', 69], ['Chicken Nuggets 6pc', 99], ['Hotcakes', 79], ['Egg Muffin', 69], ['Hash Brown', 35]], '#e8b020'],
      drinks: ['DRINKS & SWEETS', [['McFloat', 49], ['Iced Coffee', 69], ['Cola Large', 45], ['Pineapple Juice', 39], ['Sundae', 45], ['Apple Pie', 39]], '#c8321e'],
    }[kind];
    ctx.fillStyle = '#1d1210'; ctx.fillRect(0, 0, w, h); const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#c8102e'); g.addColorStop(1, '#8f0c20'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.2);
    ctx.fillStyle = YEL; ctx.font = `bold ${h * 0.14}px "Arial Black",Impact,sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(sets[0], w * 0.04, h * 0.105);
    ctx.fillStyle = sets[2]; ctx.beginPath(); ctx.arc(w * 0.88, h * 0.52, h * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(w * 0.85, h * 0.45, h * 0.12, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(w * 0.88, h * 0.52, h * 0.15, 0, TAU); ctx.fill();
    sets[1].forEach((it, i) => { const y = h * (0.31 + i * 0.115); ctx.fillStyle = '#fff6e0'; ctx.font = `600 ${h * 0.075}px Arial`; ctx.textAlign = 'left'; ctx.fillText(it[0], w * 0.04, y); ctx.fillStyle = YEL; ctx.textAlign = 'right'; ctx.fillText(PESO + it[1], w * 0.62, y); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(w * 0.04, y + h * 0.04); ctx.lineTo(w * 0.62, y + h * 0.04); ctx.stroke(); ctx.setLineDash([]); });
  };
}
export function menuBoard(kind, w = 2.2, h = 0.95, px = 200) { return signMesh(w, h, menuCanvas(kind), { px, lit: true, emissive: 1.1, bg: '#1d1210' }); }
export function newsScreenDraw(label = 'DNN 24') {
  return (ctx, w, h, t = 0) => {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#12263f'); g.addColorStop(1, '#0a1220'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b3a63'; ctx.fillRect(0, 0, w, h * 0.62); ctx.fillStyle = '#26507f'; for (let i = 0; i < 6; i++) ctx.fillRect(w * (0.05 + i * 0.16), h * 0.08, w * 0.12, h * 0.46);
    ctx.fillStyle = '#d9a67a'; ctx.beginPath(); ctx.arc(w * 0.68, h * 0.3, h * 0.09, 0, TAU); ctx.fill(); ctx.fillStyle = '#222a3a'; ctx.beginPath(); ctx.moveTo(w * 0.56, h * 0.62); ctx.quadraticCurveTo(w * 0.68, h * 0.34, w * 0.8, h * 0.62); ctx.fill(); ctx.fillStyle = '#c8102e'; ctx.fillRect(0, h * 0.7, w, h * 0.12); ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.085}px Arial`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText('BREAKING: STRANGE LIGHTS OVER VISAYAS', w * 0.04, h * 0.76);
    ctx.fillStyle = '#e8eef6'; ctx.fillRect(0, h * 0.82, w, h * 0.18); ctx.fillStyle = '#12263f'; ctx.font = `${h * 0.07}px Arial`; ctx.fillText('Officials: no cause for alarm  •  Markets steady  •  Typhoon watch lifted for Negros Oriental  •  PHIVOLCS...', w * 0.04 - ((t * 40) % (w * 1.4)), h * 0.91);
    ctx.fillStyle = YEL; ctx.fillRect(0, 0, w * 0.2, h * 0.1); ctx.fillStyle = '#111'; ctx.font = `bold ${h * 0.075}px Arial`; ctx.textAlign = 'center'; ctx.fillText(label, w * 0.1, h * 0.052);
  };
}
function fryStation(K, rng) {
  // local frame: faces +z, 1.2 wide x 0.8 deep, 3 vats
  K.box('steel', 1.4, 0.82, 0.8, 0, 0, 0); K.box('darkMetal', 1.4, 0.06, 0.8, 0, 0, 0);
  K.box('steelPlain', 1.42, 0.04, 0.82, 0, 0.82, 0);
  for (let i = 0; i < 3; i++) {
    const x = -0.45 + i * 0.45; K.box('paint#6b4a14', 0.36, 0.01, 0.5, x, 0.84, -0.02);
    for (const s of [-1, 1]) { K.box('darkMetal', 0.15, 0.1, 0.34, x + s * 0.085, 0.82, -0.02); for (let j = 0; j < 5; j++) K.box('darkMetal', 0.15, 0.006, 0.006, x + s * 0.085, 0.84, -0.17 + j * 0.07); K.cyl('paint#202020', 0.012, 0.22, x + s * 0.085, 0.9, 0.2, { axis: 'z', seg: 5 }); }
    K.box('paint#16181b', 0.34, 0.18, 0.03, x, 0.55, 0.4); for (let b = 0; b < 4; b++) K.tinted(['#4f4', '#ff4', '#f84', '#4af'][b], () => K.box('glow', 0.03, 0.02, 0.005, x - 0.1 + b * 0.065, 0.62, 0.417));
    K.box('steelPlain', 0.3, 0.1, 0.02, x, 0.2, 0.4);
  }
  K.box('steelPlain', 1.4, 0.3, 0.05, 0, 0.82, -0.4); K.box('steelPlain', 1.4, 0.04, 0.4, 0, 1.12, -0.2);
  // basket rack above
  for (let i = 0; i < 6; i++) { K.box('darkMetal', 0.2, 0.012, 0.3, -0.58 + i * 0.23, 1.1, -0.1); K.box('paint#202020', 0.014, 0.014, 0.22, -0.58 + i * 0.23, 1.1, 0.14); }
  K.box('steel', 1.0, 0.04, 0.5, 1.05, 0.87, 0.0); K.box('steel', 0.02, 0.1, 0.5, 0.55, 0.87, 0.0); K.box('steel', 0.02, 0.1, 0.5, 1.55, 0.87, 0.0); K.tinted('#ffb04a', () => { K.box('glowWarm', 0.8, 0.012, 0.04, 1.05, 1.3, 0.0); K.box('glowWarm', 0.8, 0.012, 0.04, 1.05, 1.3, 0.25); });
  K.box('chrome', 0.04, 0.5, 0.04, 0.55, 0.87, 0.2); K.box('steelPlain', 1.0, 0.02, 0.5, 1.05, 1.25, 0.12);
  const r = rng; K.tinted('#f2c230', () => { for (let i = 0; i < 40; i++) K.box('matte', 0.012, 0.012, 0.07, 0.75 + r.range(0, 0.6), 0.91 + r.range(0, 0.03), r.range(-0.18, 0.18), r.range(0, 3)); });
}
function hood(K, w = 3.0, d = 1.0, y = 2.15, H = 4.2) {
  K.box('steelPlain', w, 0.06, d, 0, y, 0); K.box('steel', w, 0.34, d - 0.06, 0, y + 0.06, -0.01); K.box('steel', w * 0.62, 0.3, d * 0.62, 0, y + 0.4, -0.12);
  K.box('steel', 0.7, H - y - 0.7, 0.7, 0, y + 0.7, -0.14);
  K.box('darkMetal', w - 0.2, 0.03, d - 0.2, 0, y - 0.02, 0); for (let i = 0; i < Math.round(w / 0.12); i++) K.box('steelPlain', 0.02, 0.045, d - 0.25, -w / 2 + 0.1 + i * 0.12, y - 0.045, 0);
  K.tinted('#fff0d0', () => { K.box('glow', 0.3, 0.012, 0.18, -w / 4, y - 0.05, 0.2); K.box('glow', 0.3, 0.012, 0.18, w / 4, y - 0.05, 0.2); });
}
function griddle(K, rng) {
  K.box('steel', 1.3, 0.85, 0.8, 0, 0, 0); K.box('steelPlain', 1.34, 0.04, 0.84, 0, 0.85, 0); K.box('darkMetal', 1.2, 0.01, 0.7, 0, 0.89, 0);
  K.box('steelPlain', 1.3, 0.04, 0.06, 0, 0.9, -0.38);
  for (let i = 0; i < 6; i++) { K.tinted('#5a2e1a', () => K.cyl('matte', 0.055, 0.012, -0.5 + i * 0.2, 0.9, 0.1 + (i % 2) * 0.1, { seg: 10 })); }
  K.at([0.3, 0.92, 0.25], 0.5, () => { K.box('chrome', 0.1, 0.004, 0.07, 0, 0, 0.05); K.box('paint#111', 0.02, 0.02, 0.14, 0, 0.0, -0.05); });
  for (let i = 0; i < 6; i++) K.cyl('darkMetal', 0.018, 0.02, -0.55 + i * 0.22, 0.45, 0.4, { axis: 'z', seg: 8 });
  K.tinted('#ffa23a', () => K.box('glowWarm', 1.0, 0.012, 0.05, 0, 1.55, 0.05));
  K.box('steel', 1.3, 0.04, 0.4, 0, 1.45, -0.2);
}
function drinkStation(K, rng) {
  K.box('steel', 1.2, 0.92, 0.7, 0, 0, 0); K.box('steelPlain', 1.24, 0.04, 0.74, 0, 0.92, 0);
  K.rbox('paint#e8e8e4', 0.9, 0.7, 0.4, 0.03, 0, 0.96, -0.12); K.box('paint#16181b', 0.86, 0.12, 0.02, 0, 1.4, 0.09);
  const cols = ['#c8321e', '#e8b020', '#2a7ad0', '#3a9a3a', '#7a4a2a', '#c8c8c8']; for (let i = 0; i < 6; i++) { K.tinted(cols[i], () => K.box('glow', 0.1, 0.1, 0.01, -0.35 + i * 0.14, 1.26, 0.085)); K.cyl('steelPlain', 0.012, 0.1, -0.35 + i * 0.14, 1.05, 0.05, { seg: 6 }); K.cyl('chrome', 0.016, 0.03, -0.35 + i * 0.14, 1.02, 0.05, { seg: 6, rt: 0.012 }); }
  K.box('darkMetal', 0.8, 0.02, 0.3, 0, 0.93, 0.15); for (let i = 0; i < 7; i++) K.box('darkMetal', 0.7, 0.003, 0.012, 0, 0.945, 0.07 + i * 0.03);
  for (let i = 0; i < 4; i++) { for (let j = 0; j < 5; j++) cupSoda(K, -0.5 + i * 0.12, 0.92 + 0.0, -0.18, { color: j % 2 ? '#e8e8e4' : '#f4f4f0', h: 0.18 }); }
}
function booth(K, len = 2.0, color = RED) {
  // faces +z: seat back at -z; a table in front
  K.tinted(color, () => { K.rbox('leather', len, 0.42, 0.5, 0.05, 0, 0.04, 0); K.rbox('leather', len, 0.62, 0.12, 0.05, 0, 0.45, -0.22); K.rbox('leather', len - 0.1, 0.1, 0.46, 0.04, 0, 0.42, 0.01); });
  K.box('darkMetal', len, 0.05, 0.4, 0, 0, 0); K.tinted('#e8dcc0', () => K.box('woodGrain', len, 0.04, 0.03, 0, 1.05, -0.24));
}
function booth2(K, len = 1.8) { K.at([0, 0, 0.55], Math.PI, () => { }); K.at([0, 0, -0.55], 0, () => booth(K, len)); K.at([0, 0, 0.55], Math.PI, () => booth(K, len)); K.tinted('#f4f0e6', () => K.box('plastic', len - 0.3, 0.04, 0.68, 0, 0.72, 0)); K.cyl('darkMetal', 0.04, 0.72, 0, 0, 0, { seg: 8 }); K.box('darkMetal', 0.5, 0.02, 0.3, 0, 0, 0); }
function squareTable(K, rng, withChairs = true, tray = true) {
  K.tinted('#f4f0e6', () => K.rbox('plastic', 0.8, 0.035, 0.8, 0.01, 0, 0.7, 0)); K.cyl('darkMetal', 0.04, 0.7, 0, 0, 0, { seg: 8 }); K.cyl('darkMetal', 0.28, 0.025, 0, 0, 0, { seg: 16 });
  if (withChairs) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; K.at([Math.sin(a) * 0.58, 0, Math.cos(a) * 0.58], a + Math.PI, () => chairPlastic(K, i % 2 ? '#ffc72c' : '#c8102e')); }
  if (tray && rng.chance(0.55)) foodTray(K, rng.range(-0.12, 0.12), 0.735, rng.range(-0.08, 0.08), rng.range(0, TAU), rng);
  if (rng.chance(0.5)) napkinBox(K, 0.25, 0.735, -0.25);
}

// ------------------------------------------------------------------ interior generator
/** Builds a fast-food restaurant interior into K. o:{w,d,h,seed,pal:{wall,band,floor,kit}, glassFront:true} returns {anchors, screens, parts} */
function restaurantInterior(K, o) {
  const { w: W, d: D, h: H } = o; const hw = W / 2, hd = D / 2; const rng = new RNG(o.seed || 5); const pal = o.pal; const screens = []; const anchors = {};
  const zc = -hd + 4.4;          // counter centreline
  const T = 0.2;
  const holes = { ...(o.holes || {}), s: [{ x0: 0.1, x1: W + 0.1, y0: 0, y1: 3.55 }] };
  room(K, { w: W, d: D, h: H, t: T, mat: pal.wall, floor: null, ceil: pal.ceil || 'ceilTile#f2efe6', holes, clad: { n: { mat: 'tileWall#f2f2ee', h: 2.4, side: 1 } } });
  // floors: dining + kitchen
  K.slab(pal.floor, -hw - T, -0.3, zc + 0.5, hw + T, 0, hd + T); K.slab(pal.kfloor, -hw - T, -0.3, -hd - T, hw + T, 0, zc + 0.5);
  K.slab('paint#2a2a2a', -hw, 0, zc + 0.46, hw, 0.004, zc + 0.52);
  // colour band + base
  for (const [x0, z0, x1, z1] of [[-hw, -hd, hw, -hd + 0.05], [-hw, -hd, -hw + 0.05, hd], [hw - 0.05, -hd, hw, hd]]) { K.slab(pal.band, x0, 1.0, z0, x1, 1.2, z1); }
  // stripe on dining walls (west/east/back-of-dining)
  // front glass wall
  const gz = hd; const doorX0 = o.doorX0 ?? -4.4, doorX1 = doorX0 + 1.8;
  K.box('glass', W, 3.55, 0.03, 0, 0, gz);
  for (let i = 0; i <= 8; i++) { const x = -hw + i * W / 8; if (x > doorX0 - 0.1 && x < doorX1 + 0.1) continue; K.box('darkMetal', 0.07, 3.6, 0.1, x, 0, gz); }
  K.box('darkMetal', W, 0.12, 0.12, 0, 0, gz); K.box('darkMetal', W, 0.1, 0.12, 0, 3.5, gz); K.box('darkMetal', 0.07, 3.6, 0.1, doorX0, 0, gz); K.box('darkMetal', 0.07, 3.6, 0.1, doorX1, 0, gz); K.box(pal.wall, W + 0.4, H - 3.55, 0.3, 0, 3.55, gz);
  K.box('darkMetal', 0.04, 0.06, 0.1, (doorX0 + doorX1) / 2, 0, gz); for (const x of [doorX0 + 0.35, doorX1 - 0.35]) K.box('chrome', 0.03, 0.7, 0.03, x, 0.9, gz + 0.07);
  K.box(pal.band, W, 0.12, 0.2, 0, 3.45, gz - 0.1);
  // ---- ceiling
  const nx = Math.max(2, Math.round(W / 3.4)), nz = Math.max(2, Math.round(D / 3.0));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) K.at([-hw + (i + 0.5) * W / nx, 0, -hd + (j + 0.5) * D / nz], 0, () => troffer(K, 1.2, 0.6, H, 'glow', 2));
  // bulkhead over the counter
  K.box(pal.accent, W - 1.2, 0.9, 1.5, 0, H - 0.9, zc - 0.6); K.tinted(YEL, () => K.box('paint', W - 1.2, 0.07, 0.04, 0, H - 0.95, zc + 0.16));
  // ---- counter (customer side +z)
  const cx0 = -hw + 1.0, cx1 = hw - 1.6; const cw = cx1 - cx0, ccx = (cx0 + cx1) / 2;
  K.at([ccx, 0, zc], 0, () => {
    K.box('paint#c8c8c4', cw, 0.95, 0.9, 0, 0.0, 0); K.box(pal.counterFront, cw, 0.85, 0.04, 0, 0.08, 0.45); K.tinted(YEL, () => K.box('paint', cw, 0.05, 0.045, 0, 0.55, 0.455)); K.tinted(YEL, () => K.box('paint', cw, 0.02, 0.045, 0, 0.1, 0.455));
    K.box('darkMetal', cw, 0.08, 0.9, 0, 0, 0); K.rbox('woodGrain#3c2c22', cw + 0.04, 0.05, 1.02, 0.02, 0, 0.95, 0.04);
    K.box('chrome', cw, 0.03, 0.03, 0, 1.0, 0.56); for (let i = 0; i <= 6; i++) K.box('chrome', 0.02, 0.1, 0.1, -cw / 2 + i * cw / 6, 0.93, 0.5);   // tray rail
    K.box('steel', cw, 0.05, 0.02, 0, 0.99, -0.45);
  });
  // POS stations
  const posX = [cx0 + 1.4, cx0 + 3.6, cx0 + 5.8].filter((x) => x < cx1 - 1.5);
  posX.forEach((x, i) => { const sc = makeScreen(0.3, 0.19, { res: [300, 188], draw: drawPOS, frame: false }); screens.push(sc.screen); K.at([x, 1.0, zc - 0.15], Math.PI, () => posTerminal(K, sc)); K.at([x, 1.0, zc + 0.3], 0, () => { K.rbox('paint#16181b', 0.26, 0.3, 0.02, 0.01, 0, 0.0, 0); const cs = makeScreen(0.22, 0.14, { res: [220, 140], draw: (ctx, w, h) => { ctx.fillStyle = '#12161c'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = YEL; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('YOUR ORDER', w / 2, 32); ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Arial'; ctx.fillText(PESO + (346 + i * 50), w / 2, 84); }, frame: false }); cs.mesh.position.set(0, 0.2, 0.012); K.mesh(cs.mesh); screens.push(cs.screen); }); });
  // order pickup shelf at the right of the counter
  K.at([cx1 - 0.7, 1.0, zc], 0, () => { K.tinted('#ffa23a', () => K.box('glowWarm', 1.1, 0.012, 0.04, 0, 0.52, -0.2)); K.box('steel', 1.2, 0.04, 0.5, 0, 0.5, -0.05); K.box('steelPlain', 1.2, 0.5, 0.02, 0, 0.0, -0.3); for (let i = 0; i < 5; i++) { K.tinted(rng.pick(['#f6f0e0', '#d8b070']), () => K.rbox('matte', 0.18, 0.22, 0.1, 0.01, -0.45 + i * 0.22, 0.0, -0.1)); } });
  const dpl = signMesh(0.6, 0.18, (ctx, w, h) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ff3a2a'; ctx.font = 'bold 56px monospace'; ctx.textBaseline = 'middle'; ctx.fillText('NOW SERVING  0041', 10, h / 2); }, { px: 400, lit: true, emissive: 1.4, bg: '#000' }); dpl.position.set(cx1 - 0.7, 2.6, zc + 0.13); K.mesh(dpl);
  // menu boards
  const kinds = ['burgers', 'meals', 'sides', 'drinks'];
  const nb = Math.min(4, Math.max(3, Math.floor((cw - 1.0) / 2.35)));
  for (let i = 0; i < nb; i++) { const bx = cx0 + 0.3 + 1.1 + i * (cw - 0.6) / nb + 0.0; const b = menuBoard(kinds[i % 4]); b.position.set(bx, 2.55 + 0.0, zc + 0.14); K.mesh(b); K.box('darkMetal', 2.3, 0.04, 0.06, bx, 3.03, zc + 0.12); K.box('darkMetal', 2.3, 0.04, 0.06, bx, 2.05, zc + 0.12); for (const s of [-1, 1]) K.box('darkMetal', 0.05, 1.0, 0.05, bx + s * 1.13, 2.05, zc + 0.12); K.tinted('#fff0d0', () => K.box('glow', 2.1, 0.02, 0.04, bx, 3.06, zc + 0.16)); }
  // arches emblem inside (on bulkhead front) + red feature wall
  K.at([-hw + 2.0, H - 1.3, zc + 0.19], 0, () => arches(K, 0.7, 'goldArch', 0.08));
  // ---- kitchen equipment (back wall z=-hd)
  const kz = -hd + 0.5;
  K.at([-hw + 2.6, 0, kz], 0, () => fryStation(K, rng)); K.at([-hw + 2.6 + 0.6, 0, -hd + 0.5], 0, () => { });
  K.at([-hw + 2.6 + 0.2, 0, -hd + 0.55], 0, () => hood(K, 3.0, 1.1, 2.2, H));
  K.at([0.3, 0, kz], 0, () => griddle(K, rng)); K.at([0.3, 0, -hd + 0.55], 0, () => hood(K, 1.8, 1.1, 2.2, H));
  K.at([hw - 3.0, 0, kz], 0, () => drinkStation(K, rng));
  K.at([-1.0, 0, -hd + 2.5], 0, () => { K.box('steel', 3.0, 0.88, 0.75, 0, 0, 0); K.box('steelPlain', 3.04, 0.04, 0.79, 0, 0.88, 0); K.box('steel', 3.0, 0.04, 0.55, 0, 0.35, 0); for (let i = 0; i < 5; i++) { K.tinted(['#d89a4a', '#e8d35a', '#4fa332'][i % 3], () => K.cyl('matte', 0.07, 0.015, -1.2 + i * 0.22, 0.92, 0.0, { seg: 10 })); } K.box('paint#f6f3ea', 0.5, 0.01, 0.4, 0.8, 0.92, 0.0); for (let i = 0; i < 3; i++) K.tinted(['#c8102e', '#ffc72c'][i % 2], () => K.box('matte', 0.2, 0.15, 0.1, 0.5 + i * 0.25, 0.93, 0.0)); });
  // wall tile shelves + shelving with boxes
  K.at([hw - 0.5, 0, -hd + 0.9], -Math.PI / 2, () => { for (const z of [-0.5, 0.5]) for (const x of [-0.7, 0.7]) K.box('steelPlain', 0.04, 1.9, 0.04, x, 0, z); for (let i = 0; i < 4; i++) K.box('steel', 1.5, 0.03, 0.62, 0, 0.3 + i * 0.5, 0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K.tinted(rng.pick(['#c9a874', '#b99560', '#e8dcc0', '#c8102e', '#ffc72c']), () => K.box('matte', rng.range(0.2, 0.34), rng.range(0.15, 0.3), 0.4, -0.55 + j * 0.37, 0.33 + i * 0.5, rng.range(-0.05, 0.05))); });
  K.at([-hw + 0.3, 0, -hd + 3.4], Math.PI / 2, () => { K.box('steel', 0.7, 0.9, 0.6, 0, 0, 0); K.box('steelPlain', 0.74, 0.04, 0.64, 0, 0.9, 0); K.box('mirror', 0.4, 0.5, 0.01, 0, 1.3, -0.3); K.cyl('chrome', 0.014, 0.35, 0.0, 0.9, -0.2, { seg: 6 }); K.tube('chrome', [[0, 1.25, -0.2], [0, 1.35, -0.14], [0, 1.28, -0.06]], 0.013, { radial: 6 }); K.box('paint#f4f4f0', 0.3, 0.2, 0.004, 0.0, 1.55, -0.29); });
  K.box('paint#1a1a1a', 7, 0.006, 3.0, hw - 6.5 - 3.5, 0.0, -hd + 1.6);   // rubber floor mats
  // ---- dining furnishings
  const dz0 = zc + 1.4;
  // booths along west wall
  const nbth = Math.floor((hd - dz0 - 0.4) / 1.5);
  for (let i = 0; i < nbth + 1; i++) K.at([-hw + 0.65, 0, dz0 + 0.4 + i * 1.55], Math.PI / 2, () => booth2(K, 1.1));
  // table grid
  const cols = [-2.4, -0.2, 2.0, 4.2].filter((x) => x < hw - 1.2), rowsZ = [dz0 + 0.3, dz0 + 2.0].filter((z) => z < hd - 1.1);
  cols.forEach((x, i) => rowsZ.forEach((z, j) => K.at([x, 0, z], rng.range(-0.2, 0.2), () => squareTable(K, rng))));
  // kiosks (self order) near the counter
  for (const x of [cx1 - 3.6, cx1 - 4.6]) { const ks = makeScreen(0.42, 0.62, { res: [336, 496], draw: drawKiosk, frame: false }); screens.push(ks.screen); K.at([x, 0, zc + 1.4], 0.12, () => { K.rbox('paint#c8102e', 0.6, 1.5, 0.22, 0.03, 0, 0.0, 0.0); K.rbox('paint#16181b', 0.5, 0.72, 0.06, 0.02, 0, 0.9, 0.12); ks.mesh.position.set(0, 1.26, 0.152); K.mesh(ks.mesh); K.box('darkMetal', 0.4, 0.04, 0.16, 0, 0.84, 0.16); K.tinted(YEL, () => K.box('paint', 0.52, 0.08, 0.04, 0, 1.55, 0.0)); }); }
  // plants
  K.at([hw - 0.7, 0, hd - 0.7], 0, () => plant(K, 'ficus', { s: 1.6, potColor: '#c8c0b0', seed: 3 })); K.at([-hw + 0.7, 0, hd - 0.7], 0, () => plant(K, 'dracaena', { s: 1.7, potColor: '#c8c0b0', seed: 5 }));
  K.at([hw - 0.6, 0, zc + 1.2], 0, () => plant(K, 'snake', { s: 1.6, potColor: '#403a34', seed: 2 }));
  // waste station
  K.at([hw - 0.5, 0, hd - 2.4], -Math.PI / 2, () => { K.rbox('paint#4a4f55', 1.2, 1.1, 0.6, 0.03, 0, 0, 0); K.box('paint#161616', 0.38, 0.28, 0.02, -0.3, 0.5, 0.31); K.box('paint#161616', 0.38, 0.28, 0.02, 0.3, 0.5, 0.31); K.tinted(YEL, () => K.box('paint', 1.0, 0.1, 0.02, 0, 0.9, 0.31)); K.box('steelPlain', 1.2, 0.04, 0.62, 0, 1.1, 0); for (let i = 0; i < 4; i++) foodTray(K, -0.4 + i * 0.28, 1.14 + i * 0.012, 0, 0, rng); });
  // TV on east wall
  const tv = makeScreen(1.5, 0.84, { res: [640, 360], draw: newsScreenDraw(o.tvLabel || 'DNN 24'), frame: true, bright: 1.35 }); screens.unshift(tv.screen); tv.screen.animateTicker = true;
  K.at([hw - 0.08, 2.35, zc + 3.0], -Math.PI / 2, () => { K.rbox('paint#101215', 1.62, 0.96, 0.06, 0.02, 0, -0.48, -0.04); tv.mesh.position.set(0, 0, 0.0); K.mesh(tv.mesh); K.box('darkMetal', 0.3, 0.3, 0.05, 0, -0.15, -0.06); });
  const clk = wallClock(K, 0.2, -hw + 0.05, 3.0, zc + 2.0, Math.PI / 2);
  // posters on the west wall above booths
  frame(K, 0.7, 0.9, (ctx, w, h) => { ctx.fillStyle = YEL; ctx.fillRect(0, 0, w, h); ctx.fillStyle = RED; ctx.font = `bold ${w * 0.17}px Arial`; ctx.textAlign = 'center'; ctx.fillText('FRESH', w / 2, h * 0.2); ctx.fillText('& HOT', w / 2, h * 0.34); ctx.fillStyle = '#d89a4a'; ctx.beginPath(); ctx.arc(w / 2, h * 0.64, w * 0.3, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#4a2a18'; ctx.fillRect(w * 0.2, h * 0.64, w * 0.6, h * 0.08); ctx.fillStyle = '#d89a4a'; ctx.fillRect(w * 0.2, h * 0.72, w * 0.6, h * 0.08); }, { x: -hw + 0.12, y: 1.6, z: zc + 4.3, rot: Math.PI / 2, color: '#222', mat: 'paint' });
  frame(K, 0.9, 0.6, (ctx, w, h) => { ctx.fillStyle = '#14304a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#e8eef4'; ctx.font = `bold ${h * 0.14}px Arial`; ctx.textAlign = 'center'; ctx.fillText('EMPLOYEE OF THE MONTH', w / 2, h * 0.2); ctx.fillStyle = '#d9a67a'; ctx.beginPath(); ctx.arc(w / 2, h * 0.52, h * 0.16, 0, TAU); ctx.fill(); ctx.fillStyle = '#c8102e'; ctx.fillRect(w * 0.38, h * 0.7, w * 0.24, h * 0.2); }, { x: -hw + 0.12, y: 1.5, z: zc + 2.8, rot: Math.PI / 2, color: '#222', mat: 'paint' });
  // ---- anchors
  Object.assign(anchors, {
    customer1: AT([posX[0] ?? -3, 0, zc + 1.0], [posX[0] ?? -3, 1.4, zc]), customer2: AT([posX[1] ?? 0, 0, zc + 1.0], [posX[1] ?? 0, 1.4, zc]),
    pos1: AT([posX[0] ?? -3, 0, zc - 0.75], [posX[0] ?? -3, 1.4, zc + 2]), pos2: AT([posX[1] ?? 0, 0, zc - 0.75], [posX[1] ?? 0, 1.4, zc + 2]), pos3: AT([posX[2] ?? 3, 0, zc - 0.75], [posX[2] ?? 3, 1.4, zc + 2]),
    fryer: AT([-hw + 2.6, 0, kz + 0.95], [-hw + 2.6, 1.0, kz]), grill: AT([0.3, 0, kz + 0.95], [0.3, 1.0, kz]), drinks: AT([hw - 3.0, 0, kz + 0.95], [hw - 3.0, 1.0, kz]), prep: AT([-1.0, 0, -hd + 3.3], [-1.0, 0.9, -hd + 2.5]),
    pickup: AT([cx1 - 0.7, 0, zc - 0.75], [cx1 - 0.7, 1.2, zc]), door: AT([(doorX0 + doorX1) / 2, 0, hd - 1.0], [(doorX0 + doorX1) / 2, 1.4, zc]),
    booth1: AT([-hw + 1.35, 0, dz0 + 0.4], [-hw + 0.7, 0.8, dz0 + 0.4]), table1: AT([cols[0] ?? -2, 0, (rowsZ[0] ?? 1) + 0.7], [cols[0] ?? -2, 0.8, rowsZ[0] ?? 1]), table2: AT([cols[1] ?? 0, 0, (rowsZ[1] ?? 2) - 0.7], [cols[1] ?? 0, 0.8, rowsZ[1] ?? 2]),
    tv: { pos: [hw - 0.08, 2.35, zc + 3.0], yaw: -Math.PI / 2, look: [hw - 0.08, 2.35, zc + 3.0] },
    camWide: { pos: [hw - 1.0, 2.0, hd - 1.0], yaw: Math.atan2(-hw * 0.6 - hw, zc - hd), look: [-1.5, 1.2, zc - 1.0] },
    camCounter: { pos: [posX[0] ?? -3, 1.55, zc + 3.2], yaw: Math.PI, look: [posX[0] ?? -3, 1.3, zc - 1.2] },
    camCounterLow: { pos: [(posX[1] ?? 0) + 1.2, 1.25, zc + 1.6], yaw: Math.PI, look: [posX[1] ?? 0, 1.2, zc - 0.5] },
    camKitchen: { pos: [hw - 3.5, 1.6, zc - 1.2], yaw: Math.PI / 2, look: [-3, 1.0, -hd + 0.8] },
    camBehind: { pos: [-2.0, 1.55, zc - 2.4], yaw: 0, look: [-2.0, 1.2, zc + 3] },
    camTV: { pos: [-1.0, 1.6, zc + 3.0], yaw: Math.PI / 2, look: [hw - 0.1, 2.3, zc + 3.0] },
    camWindow: { pos: [0.0, 1.5, hd - 2.5], yaw: 0, look: [0, 1.5, hd + 8] },
    camBooth: { pos: [-hw + 3.4, 1.4, dz0 + 2.5], yaw: -Math.PI / 2, look: [-hw + 0.6, 0.9, dz0 + 0.4] },
  });
  return { anchors, screens, clk, zc, cx0, cx1, posX, hd, hw, doorX0, doorX1, kz };
}

function restaurantMats(K) {
  K.defMat('goldArch', { color: 0xffc72c, rough: 0.35, metal: 0.1, emissive: 0xffa800, emissiveIntensity: 0.65, env: 0.6 });
}

// ------------------------------------------------------------------ McD Dumaguete (food-court unit inside the City Mall)
export function createFoodCourtMcD(opts = {}) {
  const K = new Kit({ name: 'mcd_food_court', env: 'mall', seed: 21 });
  const W = 14, D = 11, H = 4.2; restaurantMats(K);
  K.setAmbience({ min: [-W / 2, 0, -D / 2], max: [W / 2, H, D / 2], floor: 0.45, wall: 0.35, ceil: 0.3, range: 0.8 });
  const rr = restaurantInterior(K, { w: W, d: D, h: H, seed: 21, pal: { wall: 'plaster#f0e6d0', band: 'paint#c8102e', floor: 'tileFloor#e0d4bc', kfloor: 'tileFloor#9a4a38', accent: 'paint#c8102e', counterFront: 'paint#f2f0ea' }, doorX0: -4.4, tvLabel: 'DNN 24' });
  const hw = W / 2, hd = D / 2;
  // outside: mall concourse seen through the glass
  const Ko = new Kit({ name: 'concourse', env: 'mall', seed: 22 }); Ko.setAmbience({ min: [-60, 0, -60], max: [60, 9, 60], floor: 0.2, wall: 0, ceil: 0.25, range: 1.0 });
  Ko.slab('marble#e6dccb', -26, -0.3, hd, 26, 0, 14); Ko.slab('plaster#efe9dc', -26, 5.2, hd, 26, 5.6, 14); Ko.slab('plaster#e4dccb', -26, 0, 13.9, 26, 5.2, 14.2);
  Ko.slab('plaster#e4dccb', -26, 0, hd, -25.8, 5.2, 14); Ko.slab('plaster#e4dccb', 25.8, 0, hd, 26, 5.2, 14);
  Ko.slab('plaster#e4dccb', -20, 0, hd - 0.2, -hw, 5.2, hd + 0.0); Ko.slab('plaster#e4dccb', hw, 0, hd - 0.2, 20, 5.2, hd);
  Ko.at([0, 0, 13.7], Math.PI, () => shopRow(Ko, 7, 5.6, 4.4, 2, 3));
  for (let i = 0; i < 9; i++) Ko.at([-22 + i * 5.5, 0, hd + 1.5], 0, () => troffer(Ko, 1.2, 0.6, 5.2, 'glow', 2));
  Ko.at([0, 5.2, 9], 0, () => { for (let i = 0; i < 6; i++) Ko.box('glow', 0.6, 0.03, 3.0, -13 + i * 5.2, -0.08, 0); });
  // outside signage: arches + 'Mc' lettering over the glass
  Ko.defMat('goldArch', { color: 0xffc72c, rough: 0.35, emissive: 0xffa800, emissiveIntensity: 0.7, env: 0.6 });
  Ko.at([-hw + 2.2, 3.7, hd + 0.17], 0, () => arches(Ko, 0.8, 'goldArch', 0.12));
  const outSign = signMesh(5.0, 0.7, (ctx, w, h) => { ctx.fillStyle = RED; ctx.fillRect(0, 0, w, h); ctx.fillStyle = YEL; ctx.font = `italic bold ${h * 0.72}px "Arial Black",Impact,sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('McBurger', w / 2, h * 0.52); }, { px: 160, lit: true, emissive: 0.9, bg: RED }); outSign.position.set(1.0, 3.9, hd + 0.16); Ko.mesh(outSign);
  Ko.at([5, 0, hd + 2.2], 0, () => { for (let i = 0; i < 4; i++) Ko.at([i * 3.5 - 6, 0, 0], 0, () => bench(Ko, 1.6, { color: '#5a4030', back: false })); });
  Ko.at([12, 0, hd + 2.0], 0, () => plant(Ko, 'ficus', { s: 1.8, potColor: '#c8c0b0', seed: 9 })); Ko.at([-9, 0, hd + 2.0], 0, () => plant(Ko, 'ficus', { s: 1.6, potColor: '#c8c0b0', seed: 10 }));
  Ko.build();
  const lights = [new THREE.HemisphereLight(0xfff4e4, 0xb8a888, 0.95)]; const pl = new THREE.PointLight(0xffecd0, 16, 0, 2); pl.position.set(-2, 3.5, 1.5); const pl2 = new THREE.PointLight(0xffecd0, 12, 0, 2); pl2.position.set(3, 3.5, -3); lights.push(pl, pl2);
  const tvScreen = rr.screens[0];
  const set = finishSet(K, { clock: rr.clk }, {
    bounds: { w: W, d: D, h: H }, anchors: rr.anchors, lights, screens: rr.screens, extraObjs: [Ko.root],
    update(dt, t) { Ko.syncAmbience(set.root); rr.clk.set(t + 12 * 3600 + 35 * 60); if (tvScreen.animateTicker && !tvScreen._custom) { if ((tvScreen._f = (tvScreen._f || 0) + 1) % 3 === 0) { newsScreenDraw('DNN 24')(tvScreen.ctx, tvScreen.canvas.width, tvScreen.canvas.height, t); tvScreen.tex.needsUpdate = true; } } },
  });
  const origSet = tvScreen.setTexture, origCanvas = tvScreen.setCanvas; tvScreen.setTexture = (t) => { tvScreen._custom = !!t; origSet(t); }; tvScreen.setCanvas = (f) => { tvScreen._custom = true; origCanvas(f); };
  set.tv = tvScreen;
  return set;
}

// ------------------------------------------------------------------ cars (very light) for the parking lot
function simpleCar(K, color, kind = 'sedan', rng) {
  const L = kind === 'suv' ? 4.7 : kind === 'hatch' ? 3.9 : 4.5, Wd = 1.8, Hh = kind === 'suv' ? 1.7 : 1.45;
  K.tinted(color, () => { K.rbox('plastic', Wd, 0.62, L, 0.12, 0, 0.32, 0); K.rbox('plastic', Wd - 0.08, 0.4, L * (kind === 'sedan' ? 0.5 : 0.62), 0.12, 0, 0.9, kind === 'sedan' ? -0.1 : -0.25); });
  K.tinted('#223038', () => { K.rbox('glass', Wd - 0.05, 0.34, L * (kind === 'sedan' ? 0.5 : 0.62) - 0.08, 0.1, 0, 0.93, kind === 'sedan' ? -0.1 : -0.25); });
  K.tinted(color, () => K.rbox('plastic', Wd - 0.12, 0.05, L * (kind === 'sedan' ? 0.48 : 0.6), 0.02, 0, 1.31, kind === 'sedan' ? -0.1 : -0.25));
  K.box('rubberBlack', Wd + 0.02, 0.22, 0.3, 0, 0.26, L / 2 - 0.1); K.box('rubberBlack', Wd + 0.02, 0.22, 0.3, 0, 0.26, -L / 2 + 0.1);
  for (const s of [-1, 1]) { K.tinted('#fff4d0', () => K.box('glow', 0.3, 0.1, 0.02, s * 0.6, 0.6, L / 2 + 0.0)); K.tinted('#e02020', () => K.box('glow', 0.3, 0.1, 0.02, s * 0.6, 0.62, -L / 2)); for (const z of [-1, 1]) { K.cyl('rubberBlack', 0.34, 0.24, s * (Wd / 2 - 0.1), 0.34, z * L * 0.32, { axis: 'x', seg: 12 }); K.cyl('chrome', 0.2, 0.25, s * (Wd / 2 - 0.1), 0.34, z * L * 0.32, { axis: 'x', seg: 8 }); } }
}

// ------------------------------------------------------------------ McD California (drive-thru + parking lot)
export function createMcDCalifornia(opts = {}) {
  const Ki = new Kit({ name: 'mcd_ca_interior', env: 'interior', seed: 31 }); const W = 16, D = 12, H = 4.6; restaurantMats(Ki);
  Ki.setAmbience({ min: [-W / 2, 0, -D / 2], max: [W / 2, H, D / 2], floor: 0.45, wall: 0.35, ceil: 0.3, range: 0.9 });
  const hw = W / 2, hd = D / 2;
  const zwin = -D / 2 + 4.4 - 1.4;
  const rr = restaurantInterior(Ki, { w: W, d: D, h: H, seed: 31, holes: { e: [{ x0: zwin - 0.75 + D / 2 + 0.1, x1: zwin + 0.75 + D / 2 + 0.1, y0: 1.08, y1: 2.3 }] }, pal: { wall: 'plaster#e9dfca', band: 'paint#8a5a34', floor: 'tileFloor#cdbf9f', kfloor: 'tileFloor#8a8a82', accent: 'paint#8a1a24', counterFront: 'woodGrain#8a6038', ceil: 'ceilTile#eeeae0' }, doorX0: 2.2, tvLabel: 'KCAL 7' });
  // ---- exterior kit (daylight)
  const K = new Kit({ name: 'mcd_ca_exterior', env: 'day', seed: 32, castShadow: true });
  K.setAmbience({ min: [-500, 0, -500], max: [500, 90, 500], floor: 0.25, wall: 0, ceil: 0, range: 0.5 });
  K.defMat('goldArch', { color: 0xffc72c, rough: 0.35, emissive: 0xffa800, emissiveIntensity: 0.35, env: 0.8 });
  const rng = new RNG(33);
  // ground: lot asphalt, sidewalk ring, grass strips
  K.slab('asphalt#b8b8bc', -60, -0.5, -45, 60, 0, 50);
  K.slab('concrete#d9d6cf', -hw - 1.6, 0, -hd - 1.6, hw + 1.6, 0.15, hd + 2.6);   // building pad / sidewalk
  K.slab('concrete#cfccc4', -hw - 1.6, 0.15, hd + 1.6, hw + 1.6, 0.17, hd + 2.6);
  // building shell: exterior walls (stucco) — interior walls were built by the interior kit; add an outer wrap + roof + parapet
  const OW = 0.35;
  K.slab('plaster#e4d4b4', -hw - OW, 0, -hd - OW, hw + OW, H + 0.2, -hd);                 // north outer
  K.slab('plaster#e4d4b4', -hw - OW, 0, -hd, -hw, H + 0.2, hd);                          // west outer
  { const zw = rr.zc - 1.4; K.slab('plaster#e4d4b4', hw, 0, -hd, hw + OW, H + 0.2, zw - 0.75); K.slab('plaster#e4d4b4', hw, 0, zw + 0.75, hw + OW, H + 0.2, hd); K.slab('plaster#e4d4b4', hw, 0, zw - 0.75, hw + OW, 1.08, zw + 0.75); K.slab('plaster#e4d4b4', hw, 2.3, zw - 0.75, hw + OW, H + 0.2, zw + 0.75); }
  K.slab('plaster#e4d4b4', -hw - OW, 0, hd, -hw, H + 0.2, hd + 0.0);
  K.slab('paint#8a5a34', -hw - OW, H - 0.35, -hd - OW, hw + OW, H + 0.2, hd + OW);       // parapet band
  K.slab('paint#2a2a2e', -hw - 0.5, H + 0.2, -hd - 0.5, hw + 0.5, H + 0.3, hd + 0.5);   // roof edge cap
  K.slab('concrete#9a9a96', -hw - 0.5, H + 0.2, -hd - 0.5, hw + 0.5, H + 0.26, hd + 0.5);
  // roof equipment: AC units + vents
  for (let i = 0; i < 4; i++) K.at([-5 + i * 3.4, H + 0.26, -1.5], 0, () => { K.box('steelPlain', 2.0, 1.1, 1.4, 0, 0, 0); K.cyl('darkMetal', 0.5, 0.05, 0, 1.1, 0, { seg: 14 }); for (let j = 0; j < 6; j++) K.box('darkMetal', 1.8, 0.02, 0.02, 0, 0.2 + j * 0.15, 0.71); });
  // storefront mullion + awning along the south facade
  K.slab('paint#8a5a34', -hw - 0.2, 3.6, hd + 0.0, hw + 0.2, 3.7, hd + 1.4);
  for (let i = 0; i < 5; i++) K.slab('paint#2a2a2e', -hw + i * W / 4 - 0.05, 0, hd + 1.35, -hw + i * W / 4 + 0.05, 3.6, hd + 1.4);
  // big wall arches + brand lettering on the facade
  K.at([-hw + 3.0, 3.1, hd + 0.35], 0, () => arches(K, 1.15, 'goldArch', 0.14));
  const fac = signMesh(6.0, 0.8, (ctx, w, h) => { ctx.fillStyle = '#8a1a24'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = YEL; ctx.font = `italic bold ${h * 0.7}px "Arial Black",Impact,sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('McBurger', w / 2, h * 0.52); }, { px: 160, lit: true, emissive: 0.7, bg: '#8a1a24' }); fac.position.set(2.0, 4.2, hd + 0.5); K.mesh(fac);
  // drive-thru window on the east wall
  K.at([hw + 0.0, 0, rr.zc - 1.4], Math.PI / 2, () => {
    K.box('darkMetal', 1.5, 0.08, 0.5, 0, 1.12, 0.1); K.box('darkMetal', 0.08, 1.2, 0.5, -0.76, 1.12, 0.1); K.box('darkMetal', 0.08, 1.2, 0.5, 0.76, 1.12, 0.1); K.box('darkMetal', 1.5, 0.08, 0.5, 0, 2.3, 0.1);
    K.box('glass', 0.7, 1.1, 0.02, -0.35, 1.18, 0.16); K.box('glass', 0.7, 1.1, 0.02, 0.35, 1.2, 0.2); K.box('chrome', 0.03, 1.1, 0.04, 0, 1.18, 0.22); K.box('steel', 1.6, 0.06, 0.4, 0, 1.08, 0.38);
    K.box('paint#8a1a24', 3.2, 0.25, 1.5, 0, 2.6, 0.55); K.tinted(YEL, () => K.box('paint', 3.2, 0.05, 1.5, 0, 2.58, 0.55));
    for (const s of [-1, 1]) K.cyl('darkMetal', 0.06, 2.6, s * 1.5, 0, 1.2, { seg: 8 });
    const pw = signMesh(1.1, 0.26, (ctx, w, h) => { ctx.fillStyle = '#8a1a24'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = YEL; ctx.font = `bold ${h * 0.58}px Arial`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('PICK UP', w / 2, h / 2); }, { px: 220, lit: true, emissive: 0.8, bg: '#8a1a24' }); pw.position.set(0, 2.45, 1.32); K.mesh(pw);
  });
  // palms + planting
  const palmSpots = [[-14, 17, 8], [-6, 18.5, 6.5], [4.5, 18.4, 9], [13, 17.5, 7], [-17, 6, 7.5], [-17, -6, 8.5], [-13, -12, 6], [3, -13, 9.5], [-24, 14, 9], [25, 12, 8], [18, -14, 7]];
  palmSpots.forEach(([x, z, h], i) => K.at([x, 0, z], 0, () => palm(K, h, { seed: i + 3, lean: 0.08 + (i % 4) * 0.03, fronds: 12 })));
  for (const [x, z] of [[-9, 18.5], [0, 18.5], [9, 18.5], [-hw - 1.6, 9], [hw + 1.2, 9]]) K.at([x, 0, z], 0, () => { K.cyl('concrete', 1.1, 0.35, 0, 0, 0, { seg: 16 }); K.tinted('#3a2a1a', () => K.cyl('matte', 1.0, 0.04, 0, 0.34, 0, { seg: 16 })); for (let i = 0; i < 18; i++) K.tinted(['#3d7d33', '#4a8f3a', '#5a9b3f'][i % 3], () => K.sph('leaf', 0.35, Math.cos(i * 1.9) * 0.6, 0.5, Math.sin(i * 1.9) * 0.6, { seg: 6, segH: 4, s: [1, 0.8, 1] })); K.tinted('#d94a6a', () => { for (let i = 0; i < 8; i++) K.sph('matte', 0.05, Math.cos(i * 2.7) * 0.7, 0.75 + (i % 3) * 0.05, Math.sin(i * 2.7) * 0.7, { seg: 5, segH: 4 }); }); });
  // parking: stalls
  const stallZ = 14.5;
  for (let i = 0; i <= 10; i++) K.slab('paint#f2f2f2', -14 + i * 2.8 - 0.05, 0.003, stallZ - 2.7, -14 + i * 2.8 + 0.05, 0.006, stallZ + 2.7);
  for (let i = 0; i <= 10; i++) K.slab('paint#f2f2f2', -14 + i * 2.8 - 0.05, 0.003, 28 - 2.7 + 0, -14 + i * 2.8 + 0.05, 0.006, 28 + 2.7 + 0.0);
  const carCols = ['#c8d0d8', '#2a3a5a', '#8a1a1a', '#e8e8e8', '#1a1a1c', '#3a6a4a', '#d8b050', '#6a6a70'];
  for (const [i, kind] of [[0, 'sedan'], [2, 'suv'], [3, 'hatch'], [6, 'sedan'], [8, 'suv']]) K.at([-14 + (i + 0.5) * 2.8, 0, stallZ + (i % 2 ? 0.2 : -0.1)], Math.PI / 2 * 0 + (i % 2 ? 0 : Math.PI), () => simpleCar(K, carCols[i % 8], kind, rng));
  // handicap + ADA marking
  K.slab('paint#2a5ac0', -14 + 4 * 2.8 + 0.3, 0.004, stallZ - 1.6, -14 + 4 * 2.8 + 2.5, 0.007, stallZ + 0.4);
  // drive-thru lane (east side, runs north along x=+13 then west behind the building)
  const laneX = hw + 5.0;
  K.slab('asphalt#9a9aa0', laneX - 1.9, 0.0, -18, laneX + 1.9, 0.02, 24); K.slab('asphalt#9a9aa0', -30, 0.0, -18, laneX + 1.9, 0.02, -14.2);
  for (let z = 22; z > -14; z -= 3.2) K.slab('paint#f2d24a', laneX - 0.06, 0.021, z - 0.8, laneX + 0.06, 0.024, z);
  K.slab('concrete#d6d3cb', laneX - 2.4, 0.0, -18, laneX - 1.9, 0.18, 24); K.slab('concrete#d6d3cb', laneX + 1.9, 0.0, -18, laneX + 2.4, 0.18, 24);
  K.slab('concrete#d6d3cb', -30, 0.0, -14.2, laneX + 2.4, 0.18, -13.7); K.slab('concrete#d6d3cb', -30, 0.0, -18.7, laneX + 2.4, 0.18, -18.2);
  // curb islands with planting
  K.slab('concrete#d6d3cb', hw + 2.2, 0.0, 5, laneX - 2.4, 0.18, 25); K.slab('woodGrain#3a2a1c', hw + 2.25, 0.18, 5.05, laneX - 2.45, 0.2, 24.95);
  // drive-thru order board + speaker (menu board, with screen)
  K.at([laneX + 2.6, 0, 6], -Math.PI / 2, () => {
    K.box('paint#2a2a2e', 2.5, 2.6, 0.35, 0, 0, 0); K.box('darkMetal', 2.6, 0.12, 0.45, 0, 2.6, 0); K.tinted(YEL, () => K.box('paint', 2.4, 0.06, 0.05, 0, 2.5, 0.21));
    const mb = menuBoard('burgers', 1.1, 1.0, 180); mb.position.set(-0.6, 1.6, 0.19); K.mesh(mb); const mb2 = menuBoard('meals', 1.1, 1.0, 180); mb2.position.set(0.6, 1.6, 0.19); K.mesh(mb2);
    const os = makeScreen(0.8, 0.45, { res: [400, 225], draw: (ctx, w, h) => { ctx.fillStyle = '#10161e'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = YEL; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText('WELCOME', w / 2, 52); ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.fillText('May I take your order?', w / 2, 92); ctx.fillStyle = '#8fd'; ctx.fillText('1x McBurger   $5.49', w / 2, 140); ctx.fillText('1x McFries   $2.99', w / 2, 170); }, frame: true }); os.mesh.position.set(0, 0.7, 0.2); K.mesh(os.mesh);
    K.box('darkMetal', 0.35, 0.3, 0.1, 0.9, 0.35, 0.2); for (let i = 0; i < 12; i++) K.cyl('paint#111', 0.012, 0.01, 0.9 - 0.08 + (i % 4) * 0.05, 0.38 + Math.floor(i / 4) * 0.07, 0.26, { axis: 'z', seg: 6 });
    Ki._ordScreen = os.screen;
  });
  // sign pylon
  K.at([-20, 0, 21], 0, () => { K.cyl('steelPlain', 0.25, 9.0, 0, 0, 0, { seg: 12 }); K.box('paint#8a1a24', 3.2, 1.8, 0.35, 0, 7.4, 0); K.at([0, 7.55, 0.2], 0, () => arches(K, 0.95, 'goldArch', 0.12)); K.box('paint#8a1a24', 2.6, 0.9, 0.3, 0, 5.6, 0); K.tinted(YEL, () => K.box('paint', 2.4, 0.5, 0.04, 0, 5.8, 0.17)); K.box('concrete', 1.0, 0.6, 1.0, 0, 0, 0); });
  // light poles
  for (const [x, z] of [[-22, 8], [-8, 8], [8, 28], [-8, 28], [-22, 28], [20, 28], [20, -4]]) K.at([x, 0, z], 0, () => { K.cyl('darkMetal', 0.09, 8.0, 0, 0, 0, { seg: 8, rt: 0.06 }); K.box('darkMetal', 1.4, 0.08, 0.12, 0, 8.0, 0); K.tinted('#fff3d0', () => { K.box('glow', 0.4, 0.04, 0.2, -0.55, 7.96, 0); K.box('glow', 0.4, 0.04, 0.2, 0.55, 7.96, 0); }); K.cyl('concrete', 0.22, 0.5, 0, 0, 0, { seg: 8 }); });
  // trash bins + bench + bike rack at the entrance
  K.at([hw - 1.2 - 3, 0.17, hd + 2.1], 0, () => { trashBin(K, 0.3, 0.9, '#3a3f45'); K.cyl('chrome', 0.31, 0.04, 0, 0.9, 0, { seg: 14 }); });
  K.at([hw - 6, 0.17, hd + 2.1], 0, () => bench(K, 1.8, { color: '#6a5038', back: true }));
  // parked drive-thru queue
  K.at([laneX, 0, 12], Math.PI, () => simpleCar(K, '#d8b050', 'suv', rng)); K.at([laneX, 0, 17.5], Math.PI, () => simpleCar(K, '#1a1a1c', 'sedan', rng));
  K.build(); Ki.build();
  // east-wall window hole: interior wall has no hole, so cut one by rebuilding? (interior face stays; window shows the glass on the exterior shell only)
  const sun = null;
  const lights = [new THREE.HemisphereLight(0xfff6e8, 0xb8a888, 0.95)]; const pl = new THREE.PointLight(0xfff0d8, 14, 0, 2); pl.position.set(-2, 3.8, 1.5); lights.push(pl);
  const set = finishSet(Ki, { exterior: K.root, interior: Ki.root, clock: rr.clk }, {
    bounds: { w: 120, d: 95, h: 12 }, anchors: {
      ...rr.anchors,
      driveThruWindow: AT([hw + 1.0, 0, rr.zc - 1.4], [hw - 1, 1.3, rr.zc - 1.4]), driveThruCar: AT([laneX, 0, rr.zc - 1.4 + 0.6], [hw, 1.3, rr.zc - 1.4]), orderBoard: AT([laneX + 0.2, 0, 7], [laneX + 2.6, 1.3, 6]),
      parkingStall: A([-14 + 2.5 * 2.8, 0, stallZ], Math.PI), entrance: AT([rr.doorX0 + 0.9 + 0, 0, hd + 4], [rr.doorX0 + 0.9, 1.3, hd]),
      camLot: { pos: [28, 4.5, 36], yaw: 0, look: [0, 1.5, 0] }, camLotWide: { pos: [-30, 12, 44], yaw: 0, look: [0, 2, 0] }, camDriveThru: { pos: [laneX + 3.5, 1.5, 14], yaw: Math.PI, look: [hw, 1.5, rr.zc - 1.4] }, camPalms: { pos: [0, 1.6, 30], yaw: Math.PI, look: [0, 4, 15] },
    },
    lights, screens: rr.screens, extraObjs: [K.root],
    update(dt, t) { K.syncAmbience(set.root); rr.clk.set(t + 14 * 3600 + 5 * 60); },
  });
  set.exterior = K.root; set.interior = Ki.root; set.tv = rr.screens[0]; set.orderScreen = Ki._ordScreen;
  return set;
}
