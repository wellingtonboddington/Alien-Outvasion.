// Leon's bar (Dumaguete): narrow brick-walled bar with bottle shelves, neon, stools, taps, TV, dartboard, jukebox and a hidden shotgun.
// Set space: origin = floor centre. Interior x∈[-2.8,2.8], z∈[-5.8,5.8], h=3.2. Street/door = +z. Bar counter on the east side (x≈+0.6..1.5), back bar on the east wall.
import * as THREE from 'three';
import { RNG, TAU, seg } from '../../../engine/common.js';
import { noise2 } from '../../../engine/proc.js';
import { Kit, atlas, canvasTexture, signMesh, uvRect, uvCyl, makeScreen, mat4 } from './kit.js';
import { room, troffer, lampShade, stoolRound, chairWood, tableRound, plant, wallClock, mug, finishSet, A, AT, frame, fan } from './props.js';
import { newsScreenDraw } from './restaurant.js';

const W = 5.6, D = 11.6, H = 3.2, HW = W / 2, HD = D / 2;
const BRANDS = [
  ['SILANGAN', 'WHISKY', '#b8741e', '#1a1410', '#e6c36a', 'A'], ['DON TOMAS', 'DARK RUM', '#2a1608', '#6a1a12', '#f0d8a0', 'B'], ['GINTONG', 'ARAW GIN', '#2f6a3a', '#e8efe0', '#1b4a28', 'C'], ['TRES REYES', 'BRANDY', '#9a5a18', '#2a1a10', '#f4d890', 'A'],
  ['BULKAN', 'SPICED RUM', '#14100e', '#c8421a', '#fff0d0', 'B'], ['KAYUMANGGI', 'LAGER', '#4a2a0a', '#e8d9a8', '#4a2a0a', 'D'], ['LAGUNA', 'PALE ALE', '#3a4a12', '#f1e8c0', '#2a3a10', 'D'], ['PULANG TORO', 'STRONG', '#46200a', '#b3262d', '#fff2d0', 'D'],
  ['HIELO', 'VODKA', '#cfe6ea', '#12305a', '#e8f4ff', 'E'], ['KRISTAL', 'TEQUILA', '#d8e4d8', '#d8a020', '#2a1a08', 'E'], ['LUNA', 'COFFEE LIQUEUR', '#1a0e08', '#d9b26a', '#1a0e08', 'G'], ['DALANDAN', 'ORANGE LIQUEUR', '#e07a1a', '#fff2d8', '#e07a1a', 'G'],
  ['VINO TINTO', 'RESERVA', '#1a2a16', '#e8dcc0', '#5a1a22', 'F'], ['VINO BLANCO', 'SECO', '#7a8a3a', '#f4f0d8', '#6a7a20', 'F'], ['TUBA', 'COCONUT', '#d9e2d8', '#2a6a4a', '#f4f0d0', 'E'], ['LAMBANOG', 'PROOF 90', '#d6e2e4', '#c8421a', '#fff0e0', 'E'],
];
const SHAPES = { // [[r,y]...] base at 0, heights in metres
  A: [[0, 0], [0.036, 0], [0.04, 0.004], [0.04, 0.15], [0.034, 0.17], [0.017, 0.185], [0.016, 0.23], [0.019, 0.236], [0.019, 0.25], [0, 0.25]],
  B: [[0, 0], [0.032, 0], [0.036, 0.004], [0.036, 0.19], [0.03, 0.215], [0.014, 0.245], [0.013, 0.285], [0.017, 0.29], [0.017, 0.305], [0, 0.305]],
  C: [[0, 0], [0.03, 0], [0.033, 0.004], [0.033, 0.2], [0.026, 0.23], [0.013, 0.255], [0.012, 0.29], [0.015, 0.295], [0.015, 0.31], [0, 0.31]],
  D: [[0, 0], [0.028, 0], [0.031, 0.004], [0.031, 0.13], [0.026, 0.16], [0.014, 0.2], [0.012, 0.225], [0.015, 0.23], [0.015, 0.24], [0, 0.24]],
  E: [[0, 0], [0.034, 0], [0.038, 0.004], [0.038, 0.2], [0.03, 0.235], [0.015, 0.26], [0.014, 0.295], [0.018, 0.3], [0.018, 0.315], [0, 0.315]],
  F: [[0, 0], [0.036, 0], [0.039, 0.004], [0.039, 0.19], [0.032, 0.225], [0.016, 0.26], [0.015, 0.3], [0.017, 0.305], [0.017, 0.32], [0, 0.32]],
  G: [[0, 0], [0.04, 0], [0.044, 0.004], [0.044, 0.12], [0.036, 0.15], [0.02, 0.17], [0.018, 0.2], [0.021, 0.205], [0.021, 0.22], [0, 0.22]],
};
function bottleAtlas() {
  return atlas(4, 4, 192, 384, (ctx, i, w, h) => {
    const [n1, n2, glass, lab, fg] = BRANDS[i]; const hgt = SHAPES[BRANDS[i][5]][SHAPES[BRANDS[i][5]].length - 1][1];
    const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, glass); gr.addColorStop(1, glass); ctx.fillStyle = glass; ctx.fillRect(0, 0, w, h);
    const sh = ctx.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.0)'); sh.addColorStop(0.62, 'rgba(255,255,255,0.28)'); sh.addColorStop(0.7, 'rgba(255,255,255,0.02)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
    // label band (canvas y down: bottom of bottle at y=h)
    const ly0 = h * (1 - 0.64 * 0.9 / 1.0 * (0.25 / hgt) * 0 - 0.62), ly1 = h * 0.82; const lx0 = w * 0.55, lx1 = w * 0.96;
    const y0 = h * 0.3, y1 = h * 0.8; ctx.fillStyle = lab; ctx.fillRect(lx0, y0, lx1 - lx0, y1 - y0); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(lx0, y0, lx1 - lx0, 6); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(lx0, y1 - 5, lx1 - lx0, 5);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const cx = (lx0 + lx1) / 2; ctx.font = 'bold 22px "Arial Black",Impact,sans-serif'; let fs = 22; while (ctx.measureText(n1).width > lx1 - lx0 - 8 && fs > 10) { fs--; ctx.font = `bold ${fs}px Arial`; } ctx.fillText(n1, cx, y0 + (y1 - y0) * 0.34); ctx.font = 'bold 14px Arial'; fs = 14; while (ctx.measureText(n2).width > lx1 - lx0 - 8 && fs > 8) { fs--; ctx.font = `bold ${fs}px Arial`; } ctx.fillText(n2, cx, y0 + (y1 - y0) * 0.66);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, y0 + (y1 - y0) * 0.5, 4, 0, TAU); ctx.fill();
    // foil / cap on neck
    ctx.fillStyle = BRANDS[i][5] === 'D' ? '#d8b040' : '#b8962e'; ctx.fillRect(0, 0, w, h * 0.16);
  });
}
function bottle(K, i, x, y, z, rot = 0) {
  const sh = SHAPES[BRANDS[i % 16][5]]; const hgt = sh[sh.length - 1][1]; const g = new THREE.LatheGeometry(sh.map((p) => new THREE.Vector2(p[0], p[1])), seg(12, 6)); g.computeVertexNormals();
  uvCyl(g, K._bottleCells[i % 16], 0, hgt); K.geo('bottleMat', g, x, y, z, rot);
}
function pintGlass(K, x, y, z, beer = true, h = 0.15) {
  K.lathe('glass', [[0.0, 0], [0.028, 0], [0.032, 0.004], [0.04, h], [0.0, h]], x, y, z, { seg: 12 });
  if (beer) { K.tinted('#d99a1e', () => K.lathe('matte', [[0.0, 0.006], [0.027, 0.006], [0.037, h * 0.8], [0.0, h * 0.8]], x, y, z, { seg: 12 })); K.tinted('#fff4d8', () => K.lathe('matte', [[0.0, h * 0.8], [0.037, h * 0.8], [0.039, h * 0.93], [0.0, h * 0.97]], x, y, z, { seg: 12 })); }
}
function shotgun(K) {
  // pump shotgun lying along local +x (barrel pointing +x)
  K.cyl('paint#17191c', 0.0115, 0.76, 0.0, 0.0, 0.0, { axis: 'x', seg: 10 }); K.cyl('paint#17191c', 0.0105, 0.52, -0.06, -0.026, 0.0, { axis: 'x', seg: 8 });
  K.cyl('chrome', 0.004, 0.012, 0.37, 0.016, 0, { seg: 5 });
  K.tinted('#6a4020', () => K.rbox('woodGrain', 0.2, 0.042, 0.048, 0.012, 0.16, -0.045, 0, 0)); K.rbox('paint#1c1e22', 0.24, 0.05, 0.046, 0.008, -0.2, -0.026, 0);
  K.torus('paint#1c1e22', 0.026, 0.004, -0.2, -0.06, 0, [0, 0, 0], { seg: 4, segR: 14, arc: Math.PI }); K.box('paint#1c1e22', 0.004, 0.02, 0.008, -0.205, -0.065, 0);
  K.at([-0.36, 0.0, 0], 0, () => { K.tinted('#6a4020', () => { K.add('woodGrain', (() => { const g = new THREE.BoxGeometry(0.34, 0.06, 0.042); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getX(i) < 0) p.setY(i, p.getY(i) * (p.getY(i) < 0 ? 2.1 : 1.3) - 0.0); } g.translate(-0.17, -0.03, 0); return g; })()); }); K.box('rubberBlack', 0.016, 0.1, 0.046, -0.34, -0.1, 0); });
}
function neonSign(text, color, w, h, px, font) {
  return signMesh(w, h, (ctx, W, H) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(H); ctx.lineJoin = 'round';
    for (const [blur, lw, c] of [[30, 0, color], [16, 0, color], [6, 0, color]]) { ctx.shadowColor = c; ctx.shadowBlur = blur * (H / 128); ctx.fillStyle = c; ctx.globalAlpha = 0.6; ctx.fillText(text, W / 2, H / 2); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5 * (H / 128); ctx.strokeText(text, W / 2, H / 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(text, W / 2, H / 2);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  }, { px, lit: true, emissive: 1.8 });
}
function dartboardTex() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const c = w / 2; const order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(c, c, c, 0, TAU); ctx.fill();
    for (let i = 0; i < 20; i++) { const a0 = (i - 0.5) / 20 * TAU - Math.PI / 2, a1 = (i + 0.5) / 20 * TAU - Math.PI / 2; const dark = i % 2 === 0; const rings = [[0.95, 1.0, dark ? '#c0202a' : '#1f8a3a'], [0.62, 0.95, dark ? '#111' : '#efe4c0'], [0.55, 0.62, dark ? '#c0202a' : '#1f8a3a'], [0.1, 0.55, dark ? '#111' : '#efe4c0']];
      for (const [r0, r1, col] of rings) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c, c, r1 * c * 0.84, a0, a1); ctx.arc(c, c, r0 * c * 0.84, a1, a0, true); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(order[i]), c + Math.cos((i) / 20 * TAU - Math.PI / 2) * c * 0.92, c + Math.sin((i) / 20 * TAU - Math.PI / 2) * c * 0.92); }
    ctx.fillStyle = '#1f8a3a'; ctx.beginPath(); ctx.arc(c, c, c * 0.09, 0, TAU); ctx.fill(); ctx.fillStyle = '#c0202a'; ctx.beginPath(); ctx.arc(c, c, c * 0.045, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,190,190,0.8)'; ctx.lineWidth = 1; for (let i = 0; i < 20; i++) { const a = (i - 0.5) / 20 * TAU - Math.PI / 2; ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * c * 0.09, c + Math.sin(a) * c * 0.09); ctx.lineTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84); ctx.stroke(); }
  });
}
function jukeboxFront() {
  return canvasTexture(256, 384, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a1030'); g.addColorStop(1, '#10203a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffb02a'; ctx.beginPath(); ctx.arc(w / 2, 120, 95, Math.PI, 0); ctx.lineTo(w - 30, 190); ctx.lineTo(30, 190); ctx.fill();
    for (let i = 0; i < 7; i++) { ctx.fillStyle = `hsl(${i * 50 + 10},95%,58%)`; ctx.fillRect(34 + i * 27, 40 + Math.abs(3 - i) * 9, 18, 150 - Math.abs(3 - i) * 9); }
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(38, 200, w - 76, 74); for (let i = 0; i < 6; i++) { ctx.fillStyle = '#f1e8c8'; ctx.fillRect(48, 208 + i * 11, w - 96, 7); }
    ctx.fillStyle = '#ff3a6a'; ctx.font = 'bold 28px "Brush Script MT",cursive'; ctx.textAlign = 'center'; ctx.fillText('Now Playing', w / 2, 306); ctx.fillStyle = '#e8e8e8'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(46 + i * 18.5, 350, 6, 0, TAU); ctx.fill(); }
  });
}

export function createBar(opts = {}) {
  const K = new Kit({ name: 'bar', env: 'warm', seed: 51 }); const rng = new RNG(51);
  K.setAmbience({ min: [-HW, 0, -HD], max: [HW, H, HD], floor: 0.6, wall: 0.55, ceil: 0.5, range: 0.9 });
  const ba = bottleAtlas(); K._bottleCells = Array.from({ length: 16 }, (_, i) => ba.cell(i));
  K.defMat('bottleMat', { map: ba.tex, color: 0xffffff, rough: 0.22, metal: 0.0, env: 0.9, uv: 'own', selfLit: 0.22 });
  K.defMat('glowAmber', { glow: true, color: 0xffa040, intensity: 2.0 });
  K.defMat('beer', { color: 0xd99a1e, rough: 0.2, env: 0.5 });
  // ---- shell
  room(K, { w: W, d: D, h: H, t: 0.25, mat: 'plaster#2a1e18', floor: 'woodPlank#6a5240', ceil: 'paint#1a1412', holes: { s: [{ x0: 0.125 + 0.4, x1: 0.125 + 1.5, y0: 0, y1: 2.1 }, { x0: 0.125 + 2.9, x1: 0.125 + 5.0, y0: 0.9, y1: 2.4 }] }, clad: {} });
  // brick west wall (inside face), partial wainscot on others
  K.slab('brick#cf9a86', -HW, 0, -HD, -HW + 0.06, H, HD); K.slab('woodGrain#2a1a10', -HW + 0.06, 0, -HD, -HW + 0.08, 1.0, HD);
  K.slab('brick#b07a66', -HW, 0, -HD, HW, H, -HD + 0.05);                                  // north brick
  K.slab('woodGrain#6a4426', HW - 0.05, 0, -HD, HW, H, HD);                                 // east panelling
  K.slab('woodGrain#2a1a10', -HW, 0, HD - 0.06, HW, 1.0, HD); K.slab('brick#9a6a56', -HW, 1.0, HD - 0.05, HW, H, HD);
  // ceiling: beams, ducts, pipes
  for (let i = 0; i < 6; i++) K.box('woodGrain#2a1a10', W, 0.2, 0.18, 0, H - 0.2, -HD + 0.8 + i * 2.0);
  K.cyl('steelPlain', 0.18, D - 0.6, -1.4, H - 0.4, 0, { axis: 'z', seg: 14 }); for (let i = 0; i < 9; i++) K.cyl('steelPlain', 0.19, 0.05, -1.4, H - 0.4, -HD + 0.8 + i * 1.2, { axis: 'z', seg: 14 });
  for (let i = 0; i < 3; i++) K.cyl(i === 1 ? 'paint#8a2a1a' : 'brass', 0.025, D - 0.4, -0.2 + i * 0.1, H - 0.14, 0, { axis: 'z', seg: 6 });
  // ---- floor floor wear
  K.defMat('stain', { color: 0x0a0604, rough: 0.5, transparent: true, opacity: 0.35, noShadow: true });
  for (let i = 0; i < 9; i++) K.cyl('stain', rng.range(0.25, 0.6), 0.002, rng.range(-2, 2), 0.003, rng.range(-5, 5), { seg: 12, s: [1, rng.range(0.6, 1)] });
  K.defMat('rug', { map: 'carpet', color: 0x6a1a1a, rough: 1, tile: 0.8 }); K.box('rug', 1.9, 0.012, 2.7, -1.3, 0.0, 1.9);
  // ---- BAR COUNTER (customer side at x=+0.62)
  const cz0 = -4.9, cz1 = 2.2, cL = cz1 - cz0, cm = (cz0 + cz1) / 2;
  K.at([0, 0, cm], 0, () => {
    K.box('woodGrain#2a160a', 0.78, 0.9, cL, 1.0, 0, 0);               // body
    K.slab('woodGrain#5a3418', 0.62, 0.9, -cL / 2 - 0.05, 1.5, 0.96, cL / 2 + 0.05);   // top
    K.slab('paint#0f0a06', 0.62, 0.96, -cL / 2 - 0.05, 0.7, 0.97, cL / 2 + 0.05);       // black lip
    K.rbox('leather#3a1a14', 0.14, 0.05, cL - 0.1, 0.02, 0.66, 0.98, 0);                // padded rail
    K.box('brass', 0.05, 0.05, cL - 0.2, 0.5, 0.18, 0);               // foot rail
    for (let i = 0; i <= 8; i++) K.cyl('brass', 0.02, 0.18, 0.5, 0, -cL / 2 + 0.35 + i * (cL - 0.7) / 8, { seg: 6 });
    for (let i = 0; i < 12; i++) K.box('woodGrain#3a1c0c', 0.02, 0.62, (cL - 0.4) / 12 - 0.06, 0.615, 0.12, -cL / 2 + 0.28 + i * (cL - 0.4) / 12); // panel strips
    K.box('woodGrain#20100a', 0.04, 0.12, cL, 0.6, 0.02, 0);
    // staff-side open shelf + sink + ice bin
    K.slab('steel', 1.15, 0.82, -cL / 2 + 0.4, 1.45, 0.84, cL / 2 - 0.4); K.slab('darkMetal', 1.4, 0.0, -cL / 2 + 0.4, 1.45, 0.82, cL / 2 - 0.4);
  });
  // ice bin + sink + speed rail on the staff side
  K.at([1.45, 0.96, -1.2], 0, () => { K.box('steel', 0.5, 0.2, 0.7, 0, 0, 0); K.box('paint#cfe8f0', 0.44, 0.02, 0.62, 0, 0.19, 0); for (let i = 0; i < 18; i++) K.tinted('#e6f4fa', () => K.box('glass', 0.07, 0.07, 0.07, rng.range(-0.18, 0.18), 0.2 + rng.range(0, 0.04), rng.range(-0.26, 0.26), rng.range(0, 3))); K.cyl('chrome', 0.02, 0.1, 0.0, 0.2, -0.38, { seg: 6 }); });
  K.at([1.45, 0.96, 0.9], 0, () => { K.box('steel', 0.46, 0.16, 0.5, 0, 0, 0); K.box('paint#16181a', 0.38, 0.02, 0.42, 0, 0.15, 0); K.tube('chrome', [[0.2, 0.15, -0.2], [0.2, 0.3, -0.2], [0.1, 0.34, -0.2]], 0.012, { radial: 6 }); });
  K.at([1.35, 0.97, -3.2], 0, () => { K.box('chrome', 0.04, 0.012, 1.6, 0.0, 0.0, 0); for (let i = 0; i < 8; i++) K.cyl('chrome', 0.006, 0.05, 0, 0.01, -0.7 + i * 0.2, { seg: 4 }); for (let i = 0; i < 8; i++) bottle(K, [8, 0, 4, 11, 2, 1, 15, 3][i], 0.0, 0.058, -0.7 + i * 0.2, 0);});
  // taps tower
  K.at([1.02, 0.97, -2.2], 0, () => {
    K.cyl('chrome', 0.05, 0.015, 0, 0, 0, { seg: 12 }); K.cyl('chrome', 0.035, 0.34, 0, 0.015, 0, { seg: 12 }); K.box('chrome', 0.08, 0.1, 0.46, 0, 0.3, 0); K.cyl('chrome', 0.03, 0.46, 0, 0.35, 0, { axis: 'z', seg: 10 });
    for (let i = 0; i < 4; i++) { const z = -0.15 + i * 0.1; K.cyl('chrome', 0.012, 0.09, -0.04, 0.34, z, { axis: 'x', seg: 6, }); K.tinted(['#d6a21e', '#b3262d', '#2a7ad0', '#2f8a4a'][i], () => K.cyl('plastic', 0.02, 0.15, -0.08, 0.34, z, { seg: 8, rt: 0.028 })); K.cyl('chrome', 0.008, 0.05, -0.1, 0.3, z, { seg: 5 }); }
    K.box('paint#16181a', 0.02, 0.1, 0.01, -0.1, 0.0, 0.0);
    K.tinted('#fff', () => K.box('steelPlain', 0.3, 0.012, 0.45, -0.08, -0.0, 0));
    K.box('steelPlain', 0.3, 0.015, 0.4, -0.1, 0.0, 0);
  });
  // drip tray with glasses
  for (let i = 0; i < 6; i++) pintGlass(K, 0.84 + (i % 2) * 0.1, 0.97, -3.9 + i * 0.16, i % 3 !== 0);
  // bar top clutter: mats, peanut bowls, register, tip jar, napkins
  K.box('rubberBlack', 0.4, 0.008, 0.6, 1.0, 0.97, -0.6); K.box('rubberBlack', 0.4, 0.008, 0.6, 1.0, 0.97, 0.6); K.tinted('#b3262d', () => K.box('rubberBlack', 0.3, 0.003, 0.5, 1.0, 0.978, -0.6));
  pintGlass(K, 0.9, 0.978, -0.5, true); pintGlass(K, 0.95, 0.978, 0.75, true, 0.16); K.tinted('#d8b070', () => { K.lathe('plastic', [[0, 0], [0.08, 0], [0.11, 0.05], [0.0, 0.05]], 1.18, 0.97, 0.2, { seg: 14 }); for (let i = 0; i < 18; i++) K.sph('matte', 0.012, 1.18 + Math.cos(i) * 0.05, 1.02 + (i % 4) * 0.005, 0.2 + Math.sin(i) * 0.05, { seg: 5, segH: 4 }); });
  K.at([1.25, 0.97, 1.7], 0.2, () => { K.rbox('paint#2a2d33', 0.36, 0.1, 0.34, 0.02, 0, 0, 0); K.at([0, 0.1, 0.0], [-0.5, 0, 0], () => { K.rbox('paint#d8c8a0', 0.34, 0.16, 0.26, 0.02, 0, 0, 0); K.box('paint#0a0a0a', 0.26, 0.06, 0.01, 0, 0.05, 0.13); K.tinted('#7fff9a', () => K.box('glow', 0.18, 0.04, 0.005, 0, 0.1, 0.133)); }); for (let i = 0; i < 12; i++) K.box('paint#f4f4ef', 0.03, 0.03, 0.02, -0.14 + (i % 6) * 0.05, 0.09 + Math.floor(i / 6) * 0.04, 0.17); });
  K.lathe('glass', [[0, 0], [0.05, 0], [0.055, 0.15], [0.04, 0.17], [0.0, 0.17]], 0.85, 0.97, 1.9, { seg: 12 }); K.tinted('#2a8a3a', () => { for (let i = 0; i < 10; i++) K.box('plastic', 0.06, 0.003, 0.04, 0.85 + Math.cos(i) * 0.02, 0.98 + i * 0.012, 1.9 + Math.sin(i) * 0.02, i); });
  for (const z of [-1.7, 0.4]) { K.rbox('steelPlain', 0.1, 0.12, 0.1, 0.01, 1.3, 0.97, z); K.box('paint#f4f4f0', 0.08, 0.01, 0.08, 1.3, 1.09, z); }
  // ---- BACK BAR (east wall)
  K.at([HW, 0, 0], -Math.PI / 2, () => {
    const x0 = -4.85, x1 = 1.5, L = x1 - x0, mx = (x0 + x1) / 2;
    K.box('woodGrain#2a160a', L, 0.9, 0.5, mx, 0, -0.25); K.slab('woodGrain#5a3418', x0, 0.9, -0.52, x1, 0.94, 0.0);
    for (let i = 0; i < 8; i++) K.box('steelPlain', 0.18, 0.012, 0.012, x0 + 0.4 + i * (L - 0.6) / 7, 0.45, 0.0);
    K.box('mirror', L, 1.5, 0.02, mx, 0.95, -0.54);
    K.box('woodGrain#2a160a', L, 0.12, 0.2, mx, 2.5, -0.46); K.tinted('#ffb860', () => K.box('glowAmber', L - 0.2, 0.02, 0.04, mx, 2.5, -0.35));
    for (let t = 0; t < 4; t++) { const y = 1.12 + t * 0.34; K.box('glass', L - 0.1, 0.015, 0.2, mx, y, -0.42); K.tinted('#ffc070', () => K.box('glowAmber', L - 0.1, 0.01, 0.02, mx, y - 0.01, -0.35)); let x = x0 + 0.25; let n = 0; while (x < x1 - 0.25) { bottle(K, rng.int(0, 15), x, y + 0.008, -0.42, rng.range(-0.3, 0.3)); x += 0.115; n++; } }
    for (const x of [x0 + 0.05, x1 - 0.05, mx]) K.box('woodGrain#2a160a', 0.06, 1.55, 0.2, x, 0.95, -0.44);
    // cooler (glass door fridge) at the front end
    K.at([x1 - 0.55, 0, -0.3], 0, () => { K.box('darkMetal', 1.0, 0.92, 0.55, 0, 0, 0); K.box('darkMetal', 1.0, 0.04, 0.58, 0, 0.92, 0); K.box('glass', 0.86, 0.7, 0.02, 0, 0.12, 0.28); for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) bottle(K, 5 + (i % 3), -0.38 + i * 0.095, 0.16 + r * 0.22, 0.0, 0); K.tinted('#cfeaff', () => K.box('glow', 0.8, 0.012, 0.04, 0, 0.8, 0.22)); });
    // glass-washer + register shelf unit
    K.box('steel', 0.8, 0.2, 0.5, x0 + 0.6, 0.94, -0.28); K.box('steelPlain', 0.74, 0.02, 0.44, x0 + 0.6, 1.14, -0.28);
  });
  // ---- TV on the east wall above the back bar (front end)
  const tv = makeScreen(1.1, 0.62, { res: [640, 360], draw: newsScreenDraw('DNN 24'), frame: true, bright: 1.3 });
  K.at([HW - 0.05, 2.55, 1.1], -Math.PI / 2, () => { K.rbox('paint#101215', 1.2, 0.72, 0.07, 0.02, 0, -0.36, -0.04); tv.mesh.position.set(0, 0, 0.0); K.mesh(tv.mesh); K.box('darkMetal', 0.2, 0.2, 0.08, 0, -0.1, -0.07); });
  // ---- WEST WALL: dartboard, shelf with trophies, posters, jukebox, booths
  const dt = dartboardTex(); K.defMat('dartMat', { map: dt, color: 0xffffff, rough: 0.8, uv: 'own' });
  K.at([-HW + 0.05, 1.7, -2.7], Math.PI / 2, () => { K.box('woodGrain#2a1a10', 0.7, 0.8, 0.07, 0, -0.35, -0.04); K.box('paint#0e0e0e', 0.66, 0.74, 0.02, 0, -0.32, 0.0); K.geo('dartMat', new THREE.CircleGeometry(0.225, 40), 0, 0, 0.034); K.torus('paint#222', 0.226, 0.01, 0, 0, 0.03, 0, { seg: 5, segR: 30 }); for (let i = 0; i < 3; i++) K.at([0.06 * (i - 1), 0.05 * (i % 2 ? 1 : -1), 0.03], [0, 0, 0], () => { K.cyl('chrome', 0.003, 0.07, 0, 0, 0.04, { axis: 'z', seg: 4 }); K.box('paint#c0202a', 0.02, 0.02, 0.004, 0, 0, 0.075); }); K.box('paint#222', 0.5, 0.01, 0.02, 0, -0.45, 0.04); });
  { const cb = signMesh(0.7, 0.5, (ctx, w, h) => { ctx.fillStyle = '#20301f'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f0f0e0'; ctx.font = '38px "Segoe Print","Comic Sans MS",cursive'; ctx.textAlign = 'center'; ctx.fillText('DARTS', w / 2, 46); ctx.font = '30px "Segoe Print","Comic Sans MS",cursive'; ['LEON  301', 'JUN   147', 'SAM   88'].forEach((t, i) => ctx.fillText(t, w / 2, 92 + i * 44)); }, { px: 220, bg: '#20301f' }); cb.position.set(-HW + 0.09, 1.4, -1.6); cb.rotation.y = Math.PI / 2; K.mesh(cb); }
  K.at([-HW + 0.12, 2.35, 2.0], Math.PI / 2, () => { K.box('woodGrain#2a1a10', 1.8, 0.04, 0.2, 0, 0, 0); for (let i = 0; i < 6; i++) { K.tinted('#d8b040', () => { K.cyl('brass', 0.035, 0.05, -0.7 + i * 0.28, 0.04, 0, { seg: 8 }); K.cyl('brass', 0.015, 0.09, -0.7 + i * 0.28, 0.09, 0, { seg: 6 }); K.cyl('brass', 0.045, 0.012, -0.7 + i * 0.28, 0.17, 0, { seg: 8 }); }); } });
  frame(K, 0.6, 0.8, (ctx, w, h) => { ctx.fillStyle = '#1a1020'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ff4a8a'; ctx.font = `bold ${w * 0.2}px Impact`; ctx.textAlign = 'center'; ctx.fillText('LIVE', w / 2, h * 0.3); ctx.fillText('BAND', w / 2, h * 0.5); ctx.fillStyle = '#ffd23f'; ctx.font = `${w * 0.1}px Arial`; ctx.fillText('FRI 9PM', w / 2, h * 0.7); }, { x: -HW + 0.1, y: 1.5, z: -4.0, rot: Math.PI / 2, color: '#1a1a1a', mat: 'paint' });
  frame(K, 0.5, 0.7, (ctx, w, h) => { ctx.fillStyle = '#e8d8b0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#6a3a1a'; ctx.font = `bold ${w * 0.14}px Georgia`; ctx.textAlign = 'center'; ctx.fillText('BAR', w / 2, h * 0.25); ctx.fillText('LICENSE', w / 2, h * 0.42); ctx.fillStyle = '#3a2a1a'; ctx.font = `${w * 0.07}px Arial`; ctx.fillText('LEON\'S BAR', w / 2, h * 0.62); ctx.fillText('DUMAGUETE CITY', w / 2, h * 0.74); }, { x: -HW + 0.1, y: 1.4, z: -0.6, rot: Math.PI / 2, color: '#2a1a10', mat: 'paint' });
  // jukebox
  const jf = jukeboxFront(); K.defMat('jukeFront', { map: jf, color: 0x000000, emissive: 0xffffff, rough: 0.3, uv: 'own' }); K.m('jukeFront').emissiveMap = jf; K.m('jukeFront').emissiveIntensity = 1.4;
  K.at([-HW + 0.45, 0, -4.9], Math.PI / 2, () => { K.rbox('paint#7a1a22', 0.9, 0.55, 0.55, 0.05, 0, 0, 0); K.rbox('paint#7a1a22', 0.86, 0.9, 0.5, 0.08, 0, 0.5, 0); K.box('chrome', 0.9, 0.04, 0.56, 0, 0.55, 0); K.geo('jukeFront', new THREE.PlaneGeometry(0.7, 1.05), 0, 0.95, 0.26); K.cyl('chrome', 0.43, 0.02, 0, 1.38, 0.0, { seg: 24, rt: 0.43, s: [1, 0.55] }); K.torus('chrome', 0.36, 0.02, 0, 1.4, 0.255, 0, { seg: 5, segR: 24, arc: Math.PI }); K.box('paint#161616', 0.5, 0.2, 0.01, 0, 0.14, 0.28); K.tinted('#ff9a2a', () => K.box('glow', 0.08, 0.1, 0.01, 0.3, 0.55 - 0.15, 0.28)); });
  // booths along west wall (z from -0.2 to 3.2)
  for (let i = 0; i < 2; i++) K.at([-HW + 0.5, 0, 0.9 + i * 2.1], Math.PI / 2, () => { K.tinted('#5a1a1a', () => { K.rbox('leather', 1.5, 0.45, 0.45, 0.05, 0, 0.0, -0.47); K.rbox('leather', 1.5, 0.7, 0.12, 0.05, 0, 0.45, -0.67); K.rbox('leather', 1.5, 0.45, 0.45, 0.05, 0, 0.0, 0.47); K.rbox('leather', 1.5, 0.7, 0.12, 0.05, 0, 0.45, 0.67); }); K.box('woodGrain#3a2210', 1.0, 0.04, 0.55, 0, 0.72, 0); K.cyl('darkMetal', 0.04, 0.72, 0, 0, 0, { seg: 8 }); K.box('darkMetal', 0.5, 0.02, 0.3, 0, 0, 0); pintGlass(K, -0.2, 0.76, 0.1, true); pintGlass(K, 0.25, 0.76, -0.1, i === 0); K.tinted('#fff0c0', () => { K.cyl('glowWarm', 0.015, 0.03, 0.05, 0.76, 0.0, { seg: 6 }); }); K.lathe('glass', [[0, 0], [0.03, 0], [0.034, 0.07], [0.0, 0.07]], 0.05, 0.76, 0.0, { seg: 10 }); });
  // ---- central high tables + stools near the window
  for (const [x, z] of [[-0.8, 3.9], [-1.4, 5.0]]) { K.at([x, 0, z], 0, () => { tableRound(K, 0.34, 1.0, { top: 'woodGrain', color: '#4a2a14' }); pintGlass(K, 0.1, 1.0, 0.0, true); pintGlass(K, -0.1, 1.0, 0.1, false); K.at([0.5, 0, 0.1], 0, () => stoolRound(K, { h: 0.72, color: '#3a2218' })); K.at([-0.5, 0, -0.1], 0, () => stoolRound(K, { h: 0.72, color: '#3a2218' })); }); }
  // bar stools along the counter
  const stoolZ = [-4.2, -3.1, -2.0, -0.9, 0.2, 1.3];
  stoolZ.forEach((z, i) => K.at([0.2, 0, z], rng.range(-0.4, 0.4), () => stoolRound(K, { h: 0.72, r: 0.19, color: i % 2 ? '#5a1a1a' : '#2a2a30' })));
  // ---- window + door front
  K.at([0, 0, HD + 0.12], 0, () => {
    K.box('woodGrain#2a1a10', 1.2, 2.15, 0.08, -1.95 + 0.6 - 0.0, 0, 0.0, 0); K.box('glass', 0.9, 1.3, 0.02, -1.95 + 0.6, 0.6, 0.0);
    K.box('woodGrain#2a1a10', 2.3, 0.1, 0.1, 1.1, 0.8, 0); K.box('woodGrain#2a1a10', 2.3, 0.1, 0.1, 1.1, 2.4, 0); K.box('glass', 2.1, 1.5, 0.02, 1.1, 0.9, 0); K.box('woodGrain#2a1a10', 0.08, 1.7, 0.1, 0.05, 0.8, 0); K.box('woodGrain#2a1a10', 0.08, 1.7, 0.1, 2.15, 0.8, 0);
    for (let i = 0; i < 9; i++) K.box('paint#2a2a2a', 2.0, 0.025, 0.02, 1.1, 1.0 + i * 0.16, -0.06);
  });
  const nightStreet = signMesh(6, 2.4, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1020'); g.addColorStop(0.6, '#1a2a44'); g.addColorStop(1, '#3a3a40'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { ctx.fillStyle = '#10141c'; ctx.fillRect(i * w / 14, h * (0.2 + (i * 7 % 5) * 0.08), w / 14 - 4, h); for (let j = 0; j < 6; j++) { ctx.fillStyle = rng.chance(0.4) ? '#ffcc66' : '#2a3040'; ctx.fillRect(i * w / 14 + 6 + (j % 3) * 14, h * (0.3 + (i * 7 % 5) * 0.08) + Math.floor(j / 3) * 26, 8, 12); } } const lg = ctx.createRadialGradient(w * 0.7, h * 0.55, 0, w * 0.7, h * 0.55, 90); lg.addColorStop(0, 'rgba(255,230,160,0.9)'); lg.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h); }, { px: 90, lit: true, emissive: 0.7, bg: '#000' });
  nightStreet.position.set(0, 1.6, HD + 0.9); nightStreet.rotation.y = Math.PI; K.mesh(nightStreet);
  // neon signs
  const nLeon = neonSign("LEON'S", '#ff3a8c', 1.8, 0.7, 260, (H) => `italic bold ${H * 0.72}px "Brush Script MT","Segoe Script",cursive`); nLeon.position.set(HW - 0.1, 2.0 - 0.0, -2.9); nLeon.rotation.y = -Math.PI / 2; nLeon.position.y = 2.9 - 0.15; nLeon.scale.set(0.001, 0.001, 0.001);
  const sLeon = neonSign("LEON'S", '#ff3a8c', 1.9, 0.75, 260, (H) => `italic bold ${H * 0.7}px "Brush Script MT","Segoe Script",cursive`); sLeon.position.set(HW - 0.07, 2.88, -3.6); sLeon.rotation.y = -Math.PI / 2; K.mesh(sLeon);
  const sBeer = neonSign('COLD BEER', '#35c8ff', 1.3, 0.34, 260, (H) => `bold ${H * 0.62}px "Arial Black",Impact,sans-serif`); sBeer.position.set(-HW + 0.08, 2.35, -3.4); sBeer.rotation.y = Math.PI / 2; K.mesh(sBeer);
  const sOpen = neonSign('OPEN', '#ff2a2a', 0.8, 0.34, 260, (H) => `bold ${H * 0.7}px "Arial Black",Impact,sans-serif`); sOpen.position.set(-1.35, 1.9, HD + 0.02); sOpen.rotation.y = Math.PI; K.mesh(sOpen);
  const sCock = signMesh(0.5, 0.6, (ctx, w, h) => { ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = 7; ctx.shadowColor = '#7dff6a'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.2); ctx.lineTo(w * 0.85, h * 0.2); ctx.lineTo(w * 0.5, h * 0.55); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.55); ctx.lineTo(w * 0.5, h * 0.85); ctx.moveTo(w * 0.3, h * 0.85); ctx.lineTo(w * 0.7, h * 0.85); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowBlur = 0; ctx.stroke(); }, { px: 250, lit: true, emissive: 1.8 }); sCock.position.set(-HW + 0.08, 2.35, -2.2); sCock.rotation.y = Math.PI / 2; K.mesh(sCock);
  // pendant lamps over the bar + string lights
  for (const z of [-3.9, -2.2, -0.5, 1.2]) K.at([0.7, 0, z], 0, () => lampShade(K, 0.2, 0.17, 0, 2.2, 0, { cordTo: H - 0.2, glow: 'glowAmber', shade: 'paint#1a2a1c' }));
  for (let i = 0; i < 16; i++) { const t = i / 15; K.tinted(['#ffd080', '#ff8a5a', '#ffe8b0', '#80d0ff'][i % 4], () => K.sph('glow', 0.03, -2.4 + t * 2.0, 2.55 - Math.sin(t * Math.PI) * 0.0 + (Math.abs(Math.sin(t * Math.PI * 4)) * -0.1), 3.0 + t * 0.2, { seg: 6, segH: 4 })); }
  K.tube('rubberBlack', [[-2.5, 2.7, 2.9], [-1.8, 2.55, 3.0], [-1.0, 2.7, 3.1], [-0.2, 2.55, 3.2]], 0.004, { radial: 3 });
  // ceiling fans (animated)
  const fans = []; for (const [x, z] of [[-1.4, -2.5], [-1.0, 2.2]]) { const f = fan(K, { r: 0.55, color: '#2a1a10' }); f.position.set(x, H - 0.34, z); K.root.add(f); fans.push(f); K.cyl('darkMetal', 0.012, 0.3, x, H - 0.32, z, { seg: 5 }); }
  K.anim((dt, t) => { fans.forEach((f, i) => { f.userData.blades.rotation.y = -t * (4.5 + i); }); });
  // back wall: kegs, crates, restroom door
  K.at([-1.2, 0, -HD + 0.45], 0, () => { for (let i = 0; i < 3; i++) K.at([i * 0.58, 0, 0], 0, () => { K.lathe('steelPlain', [[0.0, 0.0], [0.26, 0.0], [0.27, 0.03], [0.27, 0.38], [0.25, 0.4], [0.2, 0.41], [0.0, 0.41]], 0, 0, 0, { seg: 16 }); K.torus('darkMetal', 0.265, 0.02, 0, 0.35, 0, [Math.PI / 2, 0, 0], { seg: 5, segR: 18 }); K.cyl('chrome', 0.04, 0.05, 0, 0.41, 0, { seg: 8 }); }); K.at([0.3, 0.41, 0.0], 0, () => { for (let i = 0; i < 2; i++) K.at([i * 0.58 - 0.3, 0, 0], 0, () => { K.lathe('steelPlain', [[0.0, 0.0], [0.26, 0.0], [0.27, 0.03], [0.27, 0.38], [0.25, 0.4], [0.2, 0.41], [0.0, 0.41]], 0, 0, 0, { seg: 16 }); }); }); });
  for (let i = 0; i < 3; i++) K.at([-2.4, 0, -4.2 + i * 0.5], 0.1 * i, () => { for (let r = 0; r < 3; r++) { K.tinted(['#c8421a', '#3a7a3a', '#c8421a'][i], () => K.box('plastic', 0.4, 0.3, 0.3, 0, r * 0.31, 0)); for (let b = 0; b < 4; b++) K.cyl('glass', 0.025, 0.2, -0.13 + b * 0.09, r * 0.31 + 0.3, 0, { seg: 6 }); } });
  K.at([-2.0, 0, -HD + 0.14], 0, () => { K.box('woodGrain#2a1a10', 0.95, 2.1, 0.06, 0.3, 0, 0); K.box('woodGrain#2a1a10', 1.1, 0.08, 0.1, 0.3, 2.1, 0); K.box('brass', 0.04, 0.12, 0.05, 0.65, 1.0, 0.06); const cr = signMesh(0.4, 0.2, (ctx, w, h) => { ctx.fillStyle = '#d8d6cc'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#222'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('C.R.', w / 2, h / 2); }, { px: 160, bg: '#d8d6cc' }); cr.position.set(0.3, 1.6, 0.1); K.mesh(cr); });
  K.tinted('#7dff8a', () => K.box('glow', 0.35, 0.16, 0.02, -0.7, 2.45, -HD + 0.07));
  // wall clock + plant
  const clk = wallClock(K, 0.18, -HW + 0.08, 2.65, -0.9, Math.PI / 2); K.at([-HW + 0.45, 0, 4.7], 0, () => plant(K, 'fern', { s: 1.6, potColor: '#4a3020', seed: 5 }));
  // ---- shotgun hidden under the counter on the staff side
  K.at([1.33, 0.8, -3.4], Math.PI / 2, () => { K.box('darkMetal', 0.03, 0.06, 0.03, 0.2, -0.0, 0.0); K.box('darkMetal', 0.03, 0.06, 0.03, -0.25, 0.0, 0.0); K.at([-0.0, 0.07, 0.0], 0, () => shotgun(K)); });
  K.box('paint#16110d', 0.5, 0.04, 0.12, 1.28, 0.78, -3.4, Math.PI / 2);
  K.build();
  // ---- lights (dim, warm)
  const hemi = new THREE.HemisphereLight(0xffd4a0, 0x40281a, 1.8);
  const l1 = new THREE.PointLight(0xffa860, 22, 0, 2); l1.position.set(0.6, 2.4, -2.0); const l2 = new THREE.PointLight(0xff9a50, 12, 0, 2); l2.position.set(-0.8, 2.3, 3.6);
  const lights = [hemi, l1, l2];
  const anchors = {
    leon: AT([1.95, 0, -1.8], [0.4, 1.2, -1.8]), leonTaps: AT([1.95, 0, -2.2], [1.0, 1.2, -2.2]), leonRegister: AT([1.95, 0, 1.7], [1.2, 1.2, 1.7]), leonBottles: AT([1.9, 0, -3.8], [2.7, 1.8, -3.8]),
    stool1: A([0.2, 0.0, -4.2], Math.PI / 2), stool2: A([0.2, 0.0, -3.1], Math.PI / 2), stool3: A([0.2, 0.0, -2.0], Math.PI / 2), stool4: A([0.2, 0.0, -0.9], Math.PI / 2), stool5: A([0.2, 0.0, 0.2], Math.PI / 2), stool6: A([0.2, 0.0, 1.3], Math.PI / 2),
    standAtBar: AT([-0.15, 0, -1.4], [1.0, 1.2, -1.4]), booth1: A([-1.9, 0.0, 0.9], -Math.PI / 2), booth2: A([-1.9, 0.0, 3.0], -Math.PI / 2), highTable: AT([-0.8, 0, 3.4], [-0.8, 1.0, 3.9]),
    door: AT([-1.35, 0, HD - 0.5], [-1.35, 1.4, 0]), window: AT([0.0, 0, HD - 0.8], [1.3, 1.4, HD]), jukebox: AT([-HW + 1.2, 0, -4.9], [-HW + 0.45, 1.0, -4.9]), dartboard: AT([-1.0, 0, -2.7], [-HW + 0.1, 1.7, -2.7]), restroom: AT([-1.6, 0, -HD + 0.9], [-1.7, 1.2, -HD]),
    tv: { pos: [HW - 0.05, 2.55, 1.1], yaw: -Math.PI / 2, look: [HW - 0.05, 2.55, 1.1] }, shotgun: { pos: [1.55, 0.0, -3.4], yaw: -Math.PI / 2, look: [1.3, 0.82, -3.4] },
    camWide: { pos: [-1.2, 1.65, HD - 0.5], yaw: Math.PI, look: [0.8, 1.4, -4.2] }, camBar: { pos: [-1.4, 1.5, -1.0], yaw: Math.PI / 2, look: [1.8, 1.35, -1.8] }, camBartender: { pos: [2.05, 1.55, 3.0], yaw: Math.PI, look: [-0.5, 1.2, -1.0] },
    camTaps: { pos: [0.1, 1.35, -1.4], yaw: Math.PI / 2, look: [1.0, 1.25, -2.2] }, camBottles: { pos: [-0.5, 1.5, -1.0], yaw: Math.PI / 2, look: [2.5, 1.7, -2.4] }, camNeon: { pos: [-1.6, 1.6, -0.8], yaw: Math.PI / 2, look: [2.7, 2.7, -3.2] },
    camShotgun: { pos: [1.9, 0.95, -2.6], yaw: Math.PI, look: [1.3, 0.8, -3.4] }, camTV: { pos: [-1.6, 1.7, -1.0], yaw: Math.PI / 2, look: [2.7, 2.5, 1.1] }, camBack: { pos: [-0.5, 1.7, 1.5], yaw: 0, look: [-0.5, 1.2, -5.5] },
    camWindow: { pos: [-1.0, 1.5, 2.2], yaw: Math.PI, look: [-0.5, 1.4, HD] }, camJukebox: { pos: [-0.8, 1.4, -3.4], yaw: Math.PI / 2 + 0.6, look: [-HW + 0.4, 1.0, -4.9] },
  };
  const set = finishSet(K, { clock: clk, tv }, {
    bounds: { w: W, d: D, h: H }, anchors, lights, screens: [tv.screen],
    update(dt, t) { clk.set(t + 23 * 3600 + 12 * 60); const f = 1 + noise2(t * 9, 1.7) * 0.05; l1.intensity = 22 * f; if ((tv.screen._f = (tv.screen._f || 0) + 1) % 3 === 0 && !tv.screen._custom) { newsScreenDraw('DNN 24')(tv.screen.ctx, tv.screen.canvas.width, tv.screen.canvas.height, t); tv.screen.tex.needsUpdate = true; } },
  });
  const o1 = tv.screen.setTexture, o2 = tv.screen.setCanvas; tv.screen.setTexture = (t) => { tv.screen._custom = !!t; o1(t); }; tv.screen.setCanvas = (f) => { tv.screen._custom = true; o2(f); };
  set.tv = tv.screen;
  return set;
}
