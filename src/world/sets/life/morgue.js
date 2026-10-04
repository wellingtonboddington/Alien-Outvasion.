// Morgue - Dumaguete City Hospital basement. Stainless autopsy tables, cold-chamber drawer wall, tiled walls, fluorescent tubes.
// Set space: origin = floor centre. Room x∈[-4.6,4.6], z∈[-4.2,4.2], h=3.1. Cold-chamber wall = north (-z). Double doors = south (+z, x≈+2.2).
import * as THREE from 'three';
import { RNG, TAU, damp } from '../../../engine/common.js';
import { noise2 } from '../../../engine/proc.js';
import { Kit, atlas, canvasTexture, signMesh, uvRect, mat4 } from './kit.js';
import { room, troffer, plant, officeChair, monitor, keyboard, deskUnit, wallClock, mug, paperStack, folder, trashBin, fireExt, finishSet, AT, A, chairPlastic } from './props.js';
import { makeScreen } from './kit.js';

const DEGS = String.fromCharCode(176);
const W = 9.2, D = 8.4, H = 3.1, HW = W / 2, HD = D / 2;

// ---------------------------------------------------------------- textures (own canvases)
function posterAtlas() {
  return atlas(3, 2, 256, 352, (ctx, i, w, h) => {
    const f = (c) => { ctx.fillStyle = c; };
    ctx.fillStyle = '#f2f0e8'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const title = (t, y, c = '#16324f', sz = 22) => { ctx.fillStyle = c; ctx.font = `bold ${sz}px Arial`; ctx.fillText(t, w / 2, y); };
    if (i === 0) { // anatomical landmarks
      f('#1d3b5c'); ctx.fillRect(8, 8, w - 16, 44); ctx.fillStyle = '#fff'; ctx.font = 'bold 19px Arial'; ctx.fillText('ANATOMICAL', w / 2, 24); ctx.fillText('SURFACE LANDMARKS', w / 2, 44);
      ctx.strokeStyle = '#34495e'; ctx.fillStyle = '#e9d2b8'; ctx.lineWidth = 2;
      const cx = w / 2; ctx.beginPath(); ctx.arc(cx, 92, 20, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 12, 110); ctx.lineTo(cx - 52, 124); ctx.lineTo(cx - 62, 200); ctx.lineTo(cx - 50, 204); ctx.lineTo(cx - 40, 140); ctx.lineTo(cx - 34, 220); ctx.lineTo(cx - 34, 300); ctx.lineTo(cx - 14, 300); ctx.lineTo(cx - 6, 230); ctx.lineTo(cx + 6, 230); ctx.lineTo(cx + 14, 300); ctx.lineTo(cx + 34, 300); ctx.lineTo(cx + 34, 220); ctx.lineTo(cx + 40, 140); ctx.lineTo(cx + 50, 204); ctx.lineTo(cx + 62, 200); ctx.lineTo(cx + 52, 124); ctx.lineTo(cx + 12, 110); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#b03030'; ctx.lineWidth = 1.2; for (const [y, t] of [[92, 'Cranium'], [128, 'Clavicle'], [160, 'Sternum'], [196, 'Costal margin'], [226, 'Iliac crest'], [262, 'Femur']]) { ctx.beginPath(); ctx.moveTo(cx + 10, y); ctx.lineTo(w - 70, y); ctx.stroke(); ctx.fillStyle = '#222'; ctx.font = '11px Arial'; ctx.textAlign = 'left'; ctx.fillText(t, w - 66, y); ctx.textAlign = 'center'; }
      ctx.strokeStyle = '#b03030'; ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 230); ctx.stroke();
    } else if (i === 1) { // biohazard
      ctx.fillStyle = '#f5c400'; ctx.fillRect(8, 8, w - 16, h - 16); ctx.fillStyle = '#111'; ctx.fillRect(8, 8, w - 16, 52); ctx.fillStyle = '#f5c400'; ctx.font = 'bold 30px Arial'; ctx.fillText('BIOHAZARD', w / 2, 36);
      ctx.fillStyle = '#111'; const cx = w / 2, cy = 160; for (let k = 0; k < 3; k++) { const a = k / 3 * TAU - Math.PI / 2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 36, cy + Math.sin(a) * 36, 40, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f5c400'; for (let k = 0; k < 3; k++) { const a = k / 3 * TAU - Math.PI / 2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 22, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f5c400'; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.fill(); ctx.fillStyle = '#f5c400'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = 'bold 15px Arial'; ctx.fillText('AUTHORIZED PERSONNEL ONLY', w / 2, 262); ctx.font = '13px Arial'; ctx.fillText('PPE REQUIRED BEYOND THIS POINT', w / 2, 290); ctx.fillText('DCGH · PATHOLOGY DEPT.', w / 2, 316);
    } else if (i === 2) { // hand hygiene
      f('#0c7a5a'); ctx.fillRect(8, 8, w - 16, 44); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.fillText('HOW TO HANDWASH', w / 2, 30);
      for (let k = 0; k < 6; k++) { const x = 20 + (k % 2) * 112, y = 66 + Math.floor(k / 2) * 92; ctx.fillStyle = '#cfe8df'; ctx.fillRect(x, y, 100, 82); ctx.fillStyle = '#e9b98f'; ctx.beginPath(); ctx.ellipse(x + 50, y + 44, 26, 20, k * 0.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7a4a2a'; ctx.stroke(); ctx.fillStyle = '#0c7a5a'; ctx.font = 'bold 13px Arial'; ctx.fillText(String(k + 1), x + 10, y + 12); ctx.fillStyle = '#123'; ctx.font = '10px Arial'; ctx.fillText(['Wet hands', 'Soap', 'Palms', 'Backs', 'Fingers', 'Rinse'][k], x + 50, y + 72); }
      title('20 SECONDS MINIMUM', 340, '#0c7a5a', 13);
    } else if (i === 3) { // livor/rigor timeline
      title('POST-MORTEM CHANGES', 30, '#7b1e1e', 20); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30, 90); ctx.lineTo(w - 30, 90); ctx.stroke();
      const pts = [['0', 'Primary flaccidity'], ['2h', 'Livor begins'], ['4h', 'Rigor jaw/neck'], ['12h', 'Rigor full'], ['24h', 'Livor fixed'], ['36h', 'Rigor passes'], ['48h+', 'Green discolour']];
      pts.forEach((p, k) => { const x = 30 + k * 32; ctx.fillStyle = '#b03030'; ctx.beginPath(); ctx.arc(x, 90, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#222'; ctx.font = 'bold 10px Arial'; ctx.fillText(p[0], x, 76); ctx.save(); ctx.translate(x, 104); ctx.rotate(Math.PI / 2.4); ctx.textAlign = 'left'; ctx.font = '10px Arial'; ctx.fillText(p[1], 0, 0); ctx.restore(); });
      ctx.fillStyle = '#c9c2b0'; for (let k = 0; k < 4; k++) ctx.fillRect(24, 200 + k * 34, w - 48, 24); ctx.fillStyle = '#222'; ctx.font = '11px Arial'; ctx.textAlign = 'left'; ['Algor mortis ~1.5' + DEGS + 'C/h', 'Vitreous potassium', 'Stomach contents', 'Entomology notes'].forEach((t, k) => ctx.fillText(t, 30, 213 + k * 34));
    } else if (i === 4) { // chain of custody
      title('CHAIN OF CUSTODY', 30, '#1d3b5c', 20); ctx.fillStyle = '#222'; ctx.font = '12px Arial'; ctx.textAlign = 'left';
      for (let k = 0; k < 10; k++) { ctx.fillText(['Case No.', 'Decedent', 'Date / Time', 'Released by', 'Received by', 'Specimen', 'Seal No.', 'Remarks', 'Witness', 'Signature'][k] + ':', 18, 70 + k * 27); ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(104, 74 + k * 27); ctx.lineTo(w - 16, 74 + k * 27); ctx.stroke(); }
      ctx.fillStyle = '#1d4a8a'; ctx.font = 'italic 16px "Brush Script MT", cursive'; ctx.fillText('DCGH-2050-0412', 110, 68); ctx.fillText('Dr. M. Reyes', 110, 176);
    } else { // rules
      f('#8a1c1c'); ctx.fillRect(8, 8, w - 16, 44); ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial'; ctx.fillText('MORGUE RULES', w / 2, 30);
      ctx.fillStyle = '#222'; ctx.font = '13px Arial'; ctx.textAlign = 'left'; ['1. Sign the logbook on entry', '2. Gloves, apron, mask at all times', '3. No food or drink', '4. Photograph before any incision', '5. Label every specimen', '6. Treat every decedent with', '    dignity and respect', '7. Report any needle-stick', '    immediately', '8. Close drawers after use'].forEach((t, k) => ctx.fillText(t, 20, 78 + k * 26));
    }
  });
}
function drawPlates() {
  return atlas(4, 4, 128, 64, (ctx, i, w, h) => {
    ctx.fillStyle = '#efeee6'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 40px Arial';
    if (i < 12) ctx.fillText(String(i + 1).padStart(2, '0'), w / 2, h / 2 + 2);
    else if (i === 12) { ctx.font = 'bold 15px Arial'; ctx.fillText('CHAMBER', w / 2, 20); ctx.font = '13px Arial'; ctx.fillText('4' + DEGS + 'C / 39' + DEGS + 'F', w / 2, 44); }
    else if (i === 13) { ctx.fillStyle = '#1a3a1a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#3f3'; ctx.font = 'bold 15px Arial'; ctx.fillText('EXIT', w / 2, h / 2); }
    else { ctx.fillStyle = '#d8d6cc'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#111'; ctx.font = 'bold 14px Arial'; ctx.fillText(i === 14 ? 'MORGUE' : 'PATHOLOGY', w / 2, h / 2); }
  });
}

// ---------------------------------------------------------------- local props
function instrument(K, kind, x, y, z, rot = 0) {
  K.at([x, y, z], rot, () => {
    if (kind === 'scalpel') { K.box('steelPlain', 0.13, 0.008, 0.012, 0, 0, 0); K.box('chrome', 0.035, 0.002, 0.009, 0.085, 0.004, 0); K.box('chrome', 0.006, 0.002, 0.004, 0.108, 0.004, 0); K.box('steelPlain', 0.035, 0.012, 0.014, -0.05, -0.002, 0); }
    else if (kind === 'forceps') { for (const s of [-1, 1]) K.at([0, 0.006, 0], [0, s * 0.03, 0], () => { K.box('chrome', 0.15, 0.003, 0.009, 0.075, 0, 0); K.box('chrome', 0.012, 0.004, 0.003, 0.155, 0, 0); }); }
    else if (kind === 'scissors') { for (const s of [-1, 1]) K.at([0, 0.008, 0], [0, s * 0.15, 0], () => { K.box('chrome', 0.12, 0.004, 0.012, 0.06, 0, 0); K.torus('chrome', 0.016, 0.004, -0.015, 0.002, 0, [Math.PI / 2, 0, 0], { seg: 4, segR: 12 }); }); K.cyl('darkMetal', 0.006, 0.012, 0.03, 0.0, 0, { seg: 6 }); }
    else if (kind === 'saw') { K.rbox('paint#d8dad4', 0.2, 0.05, 0.055, 0.015, -0.04, 0, 0); K.box('paint#2a6a8a', 0.06, 0.052, 0.057, -0.04, 0, 0); K.box('chrome', 0.11, 0.003, 0.03, 0.16, 0.005, 0); K.cyl('paint#222', 0.008, 0.18, -0.12, 0.002, 0.02, { axis: 'x', seg: 5 }); }
    else if (kind === 'shears') { for (const s of [-1, 1]) K.at([0, 0.01, 0], [0, s * 0.22, 0], () => { K.box('chrome', 0.2, 0.006, 0.014, 0.1, 0, 0); K.box('chrome', 0.05, 0.008, 0.03, 0.22, 0, s * 0.01); K.box('paint#222', 0.09, 0.012, 0.014, -0.05, 0, 0); }); }
    else if (kind === 'hemostat') { for (const s of [-1, 1]) K.at([0, 0.006, 0], [0, s * 0.06, 0], () => { K.box('chrome', 0.11, 0.003, 0.008, 0.055, 0, 0); K.torus('chrome', 0.012, 0.003, -0.012, 0.0, 0, [Math.PI / 2, 0, 0], { seg: 4, segR: 10 }); }); }
    else if (kind === 'ruler') { K.box('steelPlain', 0.3, 0.002, 0.03, 0, 0, 0); }
  });
}
function jar(K, x, y, z, { h = 0.18, r = 0.05, liquid = '#d8c276', spec = '#c98a8a' } = {}, rng) {
  K.cyl('glass', r, h, x, y, z, { seg: 14 }); K.tinted(liquid, () => K.cyl('matte', r * 0.9, h * 0.8, x, y + 0.005, z, { seg: 12 }));
  K.tinted(spec, () => K.sph('matte', r * 0.45, x + rng.range(-0.01, 0.01), y + h * 0.4, z, { seg: 8, segH: 6, s: [1, rng.range(0.8, 1.4), 0.9] }));
  K.cyl('paint#2a2d30', r * 1.05, 0.02, x, y + h, z, { seg: 14 }); K.box('paint#f1efe4', r * 1.2, 0.05, 0.002, x, y + h * 0.35, z + r + 0.001);
}
function sheetedBody(K, len = 1.75, scale = 1, slabHalf = 0.3) {
  // supine figure under a white sheet. head at z=0, feet at z=len. Cross-section path: hanging flap -> slab -> over the body -> slab -> flap
  const S = [[-0.06, 0.0, 0.0], [0.0, 0.03, 0.02], [0.03, 0.07, 0.1], [0.1, 0.09, 0.17], [0.2, 0.085, 0.17], [0.25, 0.06, 0.1], [0.33, 0.17, 0.12], [0.4, 0.21, 0.15], [0.52, 0.2, 0.19], [0.7, 0.17, 0.15], [0.88, 0.18, 0.13], [1.05, 0.17, 0.13], [1.35, 0.15, 0.13], [1.5, 0.14, 0.1], [1.62, 0.13, 0.16], [1.68, 0.12, 0.2], [1.73, 0.09, 0.12], [1.77, 0.03, 0.03], [1.83, 0.0, 0.0]];
  const arc = 8; const pts = []; // per-section local path builder
  const pathFor = (rx, ry, zz) => {
    const p = []; const sh = slabHalf * scale + 0.015; const wob = (k) => noise2(zz * 7 + k, k * 1.7) * 0.012;
    p.push([-sh - 0.01, -0.2]); p.push([-sh, -0.12 + wob(1)]); p.push([-sh + 0.005, -0.04 + wob(2)]);
    const flat = Math.max(rx, 0.02);
    p.push([-(sh - 0.04 - (sh - 0.04 - flat) * 0.4), 0.004 + ry * 0.04]); p.push([-(sh - 0.04 - (sh - 0.04 - flat) * 0.8), 0.012 + ry * 0.2]);
    for (let i = 0; i <= arc; i++) { const a = Math.PI - Math.PI * i / arc; p.push([Math.cos(a) * flat, Math.max(0.006, Math.sin(a) * ry + wob(i + 3) * 0.5)]); }
    p.push([sh - 0.04 - (sh - 0.04 - flat) * 0.8, 0.012 + ry * 0.2]); p.push([sh - 0.04 - (sh - 0.04 - flat) * 0.4, 0.004 + ry * 0.04]);
    p.push([sh - 0.005, -0.04 + wob(5)]); p.push([sh, -0.12 + wob(6)]); p.push([sh + 0.01, -0.2]);
    return p;
  };
  const rows = []; for (const [z, rx, ry] of S) rows.push(pathFor(rx * scale, ry * scale, z));
  const n = rows[0].length; const pos = [], uv = [], idx = [];
  for (let r = 0; r < rows.length; r++) for (let i = 0; i < n; i++) { const [x, y] = rows[r][i]; pos.push(x, y * 1.0, S[r][0] * scale); uv.push(i / n * 2, S[r][0]); }
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < n - 1; i++) { const a = r * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setY(i, y + (y > 0.02 ? noise2(x * 11 + 3, z * 6) * 0.006 : 0)); p.setX(i, x + noise2(z * 9, y * 8 + 1.3) * 0.004); }
  g.computeVertexNormals(); K.add('sheet', g);
}
function trolleyWheel(K, x, z, r = 0.05) { K.cyl('darkMetal', 0.01, 0.07, x, r * 1.0, z, { seg: 5 }); K.cyl('rubberBlack', r, 0.035, x, r, z, { axis: 'x', seg: 12 }); K.box('darkMetal', 0.05, 0.015, 0.04, x, r * 2 + 0.005, z); }
function gurney(K, withBody = true) {
  // length along local z, centred; deck height 0.86
  const L = 1.95, Wd = 0.6, hd = 0.84;
  K.box('steel', Wd, 0.03, L, 0, hd, 0); for (const s of [-1, 1]) { K.box('steel', 0.02, 0.05, L, s * (Wd / 2 - 0.01), hd + 0.03, 0, 0); K.box('steelPlain', 0.04, 0.06, 0.8, s * (Wd / 2 - 0.03), hd - 0.06, 0); }
  K.box('steelPlain', 0.02, 0.05, Wd, 0, hd + 0.03, L / 2 - 0.01); K.box('steelPlain', 0.02, 0.05, Wd, 0, hd + 0.03, -L / 2 + 0.01);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) K.cyl('steelPlain', 0.022, hd - 0.1, sx * (Wd / 2 - 0.06), 0.1, sz * (L / 2 - 0.18), { seg: 8 });
  for (const sz of [-1, 1]) K.box('steelPlain', Wd - 0.08, 0.025, 0.04, 0, 0.12, sz * (L / 2 - 0.18));
  for (const s of [-1, 1]) K.box('steelPlain', 0.025, 0.025, L - 0.4, s * (Wd / 2 - 0.06), 0.12, 0);
  K.box('steel', Wd - 0.05, 0.015, L - 0.5, 0, 0.19, 0);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) trolleyWheel(K, sx * (Wd / 2 - 0.05), sz * (L / 2 - 0.15));
  for (const s of [-1, 1]) K.cyl('chrome', 0.014, 0.28, s * (Wd / 2 - 0.04), hd + 0.04, L / 2 - 0.06, { seg: 6 });
  K.cyl('chrome', 0.014, Wd - 0.06, 0, hd + 0.32, L / 2 - 0.06, { axis: 'x', seg: 6 });
  if (withBody) K.at([0, hd + 0.015, -L / 2 + 0.1], 0, () => sheetedBody(K, 1.75, 0.98));
}
function sink(K, w = 0.62, d = 0.45, depth = 0.24) {
  // returns nothing: builds basin walls centred at origin with top at y=0.9
  const t = 0.02; K.box('steel', w, t, d, 0, 0.9 - depth, 0);
  K.box('steel', w, depth, t, 0, 0.9 - depth, d / 2 - t / 2); K.box('steel', w, depth, t, 0, 0.9 - depth, -d / 2 + t / 2); K.box('steel', t, depth, d, w / 2 - t / 2, 0.9 - depth, 0); K.box('steel', t, depth, d, -w / 2 + t / 2, 0.9 - depth, 0);
  K.cyl('darkMetal', 0.04, 0.004, 0, 0.9 - depth + t, 0, { seg: 12 }); for (let i = 0; i < 4; i++) K.box('paint#111', 0.005, 0.003, 0.05, 0, 0.9 - depth + t + 0.003, 0, i * Math.PI / 4);
}
function faucet(K, { reach = 0.28, h = 0.4 } = {}) {
  K.cyl('chrome', 0.025, 0.04, 0, 0, 0, { seg: 10 }); K.cyl('chrome', 0.014, h, 0, 0.04, 0, { seg: 8 });
  K.tube('chrome', [[0, h + 0.04, 0], [0, h + 0.1, 0], [0, h + 0.14, reach * 0.35], [0, h + 0.09, reach * 0.75], [0, h + 0.0, reach]], 0.013, { radial: 8 });
  K.cyl('chrome', 0.018, 0.05, 0, h - 0.06, reach, { seg: 8, rt: 0.013 });
  for (const s of [-1, 1]) K.at([s * 0.06, 0.12, 0], 0, () => { K.cyl('chrome', 0.01, 0.07, 0, 0, 0, { axis: 'x', seg: 6 }); K.box('chrome', 0.012, 0.012, 0.12, s * 0.06, 0.0, 0.05); });
}
function autopsyTable(K, side = 1, perf = 'perfSteel') {
  // long axis = z, head at -z, foot (drain) at +z. top surface y=0.90
  K.rbox('steel', 0.5, 0.05, 1.1, 0.02, 0, 0.0, 0); K.rbox('steel', 0.26, 0.75, 0.3, 0.03, 0, 0.05, 0.0);
  K.rbox('steel', 0.34, 0.05, 1.3, 0.02, 0, 0.78, 0);
  K.rbox('steel', 0.76, 0.04, 2.14, 0.012, 0, 0.8, 0);   // lower tray frame (under)
  K.box('steel', 0.72, 0.03, 2.1, 0, 0.84, 0);
  for (const s of [-1, 1]) K.box('steelPlain', 0.025, 0.04, 2.1, s * 0.355, 0.87, 0); K.box('steelPlain', 0.72, 0.04, 0.025, 0, 0.87, -1.04);
  K.box(perf, 0.58, 0.004, 1.75, 0, 0.87, -0.1);
  K.box('steelPlain', 0.5, 0.02, 0.22, 0, 0.868, 0.94); K.box('steelPlain', 0.025, 0.04, 0.22, 0.26, 0.87, 0.94); K.box('steelPlain', 0.025, 0.04, 0.22, -0.26, 0.87, 0.94);
  K.box('steelPlain', 0.72, 0.035, 0.025, 0, 0.87, 1.05);
  K.cyl('paint#0a0b0c', 0.035, 0.004, 0, 0.887, 0.97, { seg: 14 }); for (let i = 0; i < 3; i++) K.box('darkMetal', 0.07, 0.003, 0.004, 0, 0.892, 0.97, i * Math.PI / 3);
  K.rbox('steelPlain', 0.3, 0.025, 0.14, 0.008, 0, 0.872, -0.9);
  K.cyl('steelPlain', 0.032, 0.76, 0, 0.1, 1.02, { seg: 10 }); K.cyl('darkMetal', 0.045, 0.03, 0, 0.0, 1.02, { seg: 10 }); K.cyl('steelPlain', 0.034, 0.1, 0, 0.1, 0.97, { axis: 'z', seg: 8 });
  // faucet riser on the side, with hose
  const sx = 0.5 * side;
  K.cyl('chrome', 0.022, 1.3, sx, 0, -0.78, { seg: 10 }); K.cyl('chrome', 0.04, 0.04, sx, 0, -0.78, { seg: 10 });
  K.tube('chrome', [[sx, 1.3, -0.78], [sx - 0.02 * side, 1.42, -0.78], [sx - 0.18 * side, 1.46, -0.78], [sx - 0.34 * side, 1.38, -0.78], [sx - 0.36 * side, 1.28, -0.78]], 0.02, { radial: 8 });
  K.cyl('chrome', 0.03, 0.08, sx - 0.36 * side, 1.18, -0.78, { seg: 8, rt: 0.02 });
  for (const [yy, col] of [[0.96, 'paint#c02a2a'], [1.08, 'paint#2a5ac0']]) K.at([sx, yy, -0.78], 0, () => { K.cyl('chrome', 0.011, 0.14, 0.05 * side, 0, 0, { axis: 'x', seg: 6 }); K.cyl('chrome', 0.008, 0.12, 0.05 * side, 0.03, 0, { axis: 'x', seg: 6 }); K.box(col, 0.012, 0.012, 0.05, 0.12 * side, -0.005, 0.0); K.box(col, 0.012, 0.012, 0.05, -0.0, 0, 0); K.cyl('darkMetal', 0.02, 0.03, 0.0, -0.015, 0, { seg: 8 }); });
  K.tube('paint#252525', [[sx, 0.96, -0.74], [sx + 0.1 * side, 0.7, -0.7], [sx + 0.14 * side, 0.5, -0.45], [sx + 0.08 * side, 0.55, -0.2], [sx, 0.7, -0.05], [sx - 0.1 * side, 0.82, 0.0]], 0.012, { radial: 6 });
  K.cyl('chrome', 0.022, 0.12, sx - 0.1 * side, 0.74, 0.0, { seg: 8, rt: 0.014 });
  K.box('paint#f1efe6', 0.1, 0.05, 0.003, 0, 0.5, 0.112 + 0.0); K.cyl('darkMetal', 0.02, 0.02, 0.0, 0.0, 1.02, { seg: 6 });
  for (const sz of [-1, 1]) for (const s2 of [-1, 1]) K.cyl('rubberBlack', 0.025, 0.025, s2 * 0.62, 0, sz * 0.2, { seg: 8 });
}
function surgicalLamp(K, y = 2.35) {
  K.cyl('paint#e6e6e2', 0.08, 0.05, 0, y + 0.72, 0, { seg: 12 }); K.cyl('paint#d0d0cc', 0.04, 0.72, 0, y + 0.03, 0, { seg: 8 });
  K.tube('paint#d8d8d4', [[0, y + 0.03, 0], [0.2, y + 0.06, 0.1], [0.5, y + 0.1, 0.2]], 0.03, { radial: 8 });
  K.at([0.5, y, 0.2], 0, () => {
    K.cyl('paint#d8d8d4', 0.04, 0.12, 0, 0.06, 0, { seg: 8 }); K.lathe('paint#ecece8', [[0.02, 0.1], [0.14, 0.08], [0.26, 0.02], [0.28, 0.0], [0.27, -0.03], [0.1, -0.05], [0.0, -0.05]], 0, 0.02, 0, { seg: 28 });
    K.cyl('paint#ececec', 0.275, 0.006, 0, -0.02, 0, { seg: 28 });
    K.tinted('#dff3ff', () => { K.cyl('glow', 0.07, 0.012, 0, -0.045, 0, { seg: 14 }); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; K.cyl('glow', 0.032, 0.01, Math.cos(a) * 0.19, -0.046, Math.sin(a) * 0.19, { seg: 8 }); } for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; K.cyl('glow', 0.028, 0.01, Math.cos(a) * 0.115, -0.046, Math.sin(a) * 0.115, { seg: 8 }); } });
    K.cyl('paint#222', 0.03, 0.04, 0, -0.07, 0, { seg: 8 });
  });
}
function organScale(K, x, z, topY = H) {
  K.cyl('steelPlain', 0.03, 0.05, x, topY - 0.05, z, { seg: 10 }); K.cyl('steelPlain', 0.012, 0.7, x, topY - 0.75, z, { seg: 6 });
  K.cyl('paint#e8e8e2', 0.1, 0.07, x, topY - 0.86, z, { axis: 'z', seg: 22 }); K.cyl('chrome', 0.105, 0.012, x, topY - 0.86, z + 0.034, { axis: 'z', seg: 22 });
  const face = signMesh(0.19, 0.19, (ctx, w, h) => { ctx.fillStyle = '#f4f2ea'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 1, 0, TAU); ctx.fill(); ctx.strokeStyle = '#111'; for (let i = 0; i <= 40; i++) { const a = -2.4 + i / 40 * 4.8, big = i % 5 === 0; ctx.lineWidth = big ? 3 : 1.4; ctx.beginPath(); ctx.moveTo(w / 2 + Math.sin(a) * w * 0.4, h / 2 - Math.cos(a) * w * 0.4); ctx.lineTo(w / 2 + Math.sin(a) * w * (big ? 0.31 : 0.35), h / 2 - Math.cos(a) * w * (big ? 0.31 : 0.35)); ctx.stroke(); } ctx.fillStyle = '#111'; ctx.font = `bold ${w * 0.12}px Arial`; ctx.textAlign = 'center'; ctx.fillText('kg', w / 2, h * 0.7); ctx.strokeStyle = '#b01010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.sin(-0.6) * w * 0.38, h / 2 - Math.cos(-0.6) * w * 0.38); ctx.stroke(); }, { px: 300, bg: '#f4f2ea', rough: 0.3 });
  face.position.set(x, topY - 0.86, z + 0.042); K.mesh(face);
  K.cyl('steelPlain', 0.012, 0.35, x, topY - 1.31, z, { seg: 6 }); K.torus('steelPlain', 0.025, 0.006, x, topY - 1.33, z, [Math.PI / 2, 0, 0], { seg: 5, segR: 10 });
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; K.tube('chrome', [[x, topY - 1.33, z], [x + Math.cos(a) * 0.1, topY - 1.5, z + Math.sin(a) * 0.1], [x + Math.cos(a) * 0.19, topY - 1.65, z + Math.sin(a) * 0.19]], 0.004, { radial: 4, smooth: false }); }
  K.lathe('steel', [[0, 0.0], [0.17, 0.0], [0.2, 0.04], [0.21, 0.05], [0.2, 0.055], [0.17, 0.012], [0, 0.012]], x, topY - 1.68, z, { seg: 24 });
}
function mayo(K, x, z, rot, rng) {
  K.at([x, 0, z], rot, () => {
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.78; K.at([0, 0, 0], a, () => { K.box('steelPlain', 0.025, 0.02, 0.3, 0, 0.06, 0.15); K.cyl('rubberBlack', 0.025, 0.03, 0, 0, 0.3, { seg: 8 }); }); }
    K.cyl('steelPlain', 0.022, 0.86, 0, 0.06, 0, { seg: 8 }); K.cyl('chrome', 0.035, 0.05, 0, 0.88, 0, { seg: 10 });
    K.box('steel', 0.56, 0.012, 0.4, 0, 0.94, 0); for (const s of [-1, 1]) { K.box('steelPlain', 0.012, 0.025, 0.4, s * 0.28, 0.944, 0); K.box('steelPlain', 0.56, 0.025, 0.012, 0, 0.944, s * 0.2); }
    K.box('paint#4a7a9a', 0.5, 0.004, 0.34, 0, 0.953, 0);
    const kinds = ['scalpel', 'scalpel', 'forceps', 'forceps', 'scissors', 'hemostat', 'hemostat', 'shears', 'saw', 'ruler'];
    kinds.forEach((k, i) => { const col = i % 5, row = Math.floor(i / 5); instrument(K, k, -0.16 + col * 0.095 + (k === 'saw' ? 0.04 : 0), 0.957, -0.08 + row * 0.15 + rng.range(-0.02, 0.02), rng.range(-0.25, 0.25) + (row ? 1.4 : 1.57)); });
  });
}

// ---------------------------------------------------------------- the set
export function createMorgue(opts = {}) {
  const K = new Kit({ name: 'morgue', env: 'morgue', seed: 11 }); const rng = new RNG(11);
  K.setAmbience({ min: [-HW, 0, -HD], max: [HW, H, HD], floor: 0.55, wall: 0.45, ceil: 0.4, range: 0.9 });
  K.defMat('glowFlk', { glow: true, color: 0xe8fff0, intensity: 2.7 });
  const perfTex = canvasTexture(128, 128, (ctx, w, h) => { ctx.fillStyle = '#b4babe'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2c3034'; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc((i + (j % 2) * 0.5 + 0.25) * w / 8, (j + 0.5) * h / 8, 3.2, 0, TAU); ctx.fill(); } }, { repeat: true });
  K.defMat('perfSteel', { map: perfTex, color: 0xffffff, rough: 0.35, metal: 0.85, env: 1.0, tile: 0.25 });
  const posters = posterAtlas(), plates = drawPlates();
  K.defMat('poster', { map: posters.tex, color: 0xffffff, rough: 0.5, uv: 'own' });
  K.defMat('plate', { map: plates.tex, color: 0xffffff, rough: 0.4, uv: 'own' });

  // ---- shell
  const tileG = 'tileWall#c4d9cc', tileTrim = 'paint#3f7560', upper = 'plaster#dfe9e1';
  const doorX = 2.2, doorW = 1.8;
  room(K, {
    w: W, d: D, h: H, t: 0.2, mat: upper, floor: 'tileFloor#b9c8bf', ceil: 'ceilTile#dcdcd2',
    holes: { s: [{ x0: doorX - doorW / 2 + HW + 0.1, x1: doorX + doorW / 2 + HW + 0.1, y0: 0, y1: 2.15 }] },
    clad: { n: { mat: tileG, h: 2.1, side: 1 }, s: { mat: tileG, h: 2.1, side: 1 }, e: { mat: tileG, h: 2.1, side: 1 }, w: { mat: tileG, h: 2.1, side: 1 } },
  });
  // trim band + cap + skirting
  const T = 0.03;
  const strip = (mat, y0, y1, off = 0.012) => {
    K.slab(mat, -HW + T, y0, -HD + T, HW - T, y1, -HD + T + off); K.slab(mat, -HW + T, y0, -HD + T, -HW + T + off, y1, HD - T); K.slab(mat, HW - T - off, y0, -HD + T, HW - T, y1, HD - T);
    K.slab(mat, -HW + T, y0, HD - T - off, doorX - doorW / 2, y1, HD - T); K.slab(mat, doorX + doorW / 2, y0, HD - T - off, HW - T, y1, HD - T);
  };
  strip(tileTrim, 1.2, 1.35); strip('paint#9fb8aa', 2.1, 2.14, 0.03); strip('paint#5d6e66', 0, 0.1, 0.012);
  // door frame + double doors
  K.at([doorX, 0, HD + 0.1], 0, () => {
    K.box('steelPlain', 0.08, 2.2, 0.24, -doorW / 2 - 0.04, 0, 0); K.box('steelPlain', 0.08, 2.2, 0.24, doorW / 2 + 0.04, 0, 0); K.box('steelPlain', doorW + 0.16, 0.08, 0.24, 0, 2.15, 0);
    for (const s of [-1, 1]) { K.at([s * doorW / 4, 0, 0.0], 0, () => { K.box('steel', doorW / 2 - 0.02, 2.1, 0.05, 0, 0.02, 0); K.box('steelPlain', doorW / 2 - 0.02, 0.35, 0.06, 0, 0.02, 0); K.box('steelPlain', 0.025, 0.3, 0.06, -s * (doorW / 4 - 0.1), 1.0, 0.0); K.box('paint#111', 0.3, 0.38, 0.056, 0, 1.55, 0); K.box('glass', 0.26, 0.34, 0.058, 0, 1.55, 0); }); }
    K.box('paint#111', 0.02, 2.05, 0.03, 0, 0.05, 0.0);
  });
  K.geo('plate', uvRect(new THREE.PlaneGeometry(0.4, 0.2), plates.cell(14)), doorX, 2.45, HD - 0.02, Math.PI);
  K.geo('plate', uvRect(new THREE.PlaneGeometry(0.38, 0.19), plates.cell(13)), doorX - 1.25, 1.6, HD - 0.02, Math.PI);
  K.tinted('#5f8', () => K.box('glow', 0.4, 0.2, 0.01, doorX + 1.35, 2.3, HD - 0.03));

  // ---- ceiling: ducts, pipes, vents, fixtures
  K.cyl('steelPlain', 0.22, W - 0.3, 0, H - 0.34, -HD + 0.55, { axis: 'x', seg: 18 });
  for (let i = -3; i <= 3; i++) K.cyl('steelPlain', 0.225, 0.04, i * 1.2, H - 0.34, -HD + 0.55, { axis: 'x', seg: 18 });
  for (let i = 0; i < 4; i++) K.cyl('steelPlain', 0.12, 0.34, -3.2 + i * 2.2, H - 0.34, -HD + 0.55, { seg: 12, rt: 0.12 });
  for (const [x, z] of [[-3.2, -2.5], [3.2, -1.2], [0.2, 3.0]]) { K.box('paint#f0f0ea', 0.62, 0.02, 0.62, x, H - 0.02, z); for (let i = 0; i < 7; i++) K.box('paint#9aa09c', 0.56, 0.006, 0.014, x, H - 0.03, z - 0.24 + i * 0.08); }
  for (let i = 0; i < 3; i++) K.cyl(i === 1 ? 'paint#2a63b0' : 'paint#c0c4c6', 0.028, D - 0.4, -HW + 0.25 + i * 0.075, H - 0.14, 0, { axis: 'z', seg: 8 });
  for (let i = 0; i < 8; i++) K.box('darkMetal', 0.05, 0.12, 0.04, -HW + 0.28, H - 0.19, -3.6 + i * 1.0);
  K.box('darkMetal', 0.04, 0.04, D - 0.4, HW - 0.2, H - 0.16, 0);
  const fl = [[-1.2, -2.3], [-1.2, 0.2], [-1.2, 2.5], [1.3, -2.3], [1.3, 0.2], [1.3, 2.5], [-3.5, 0.9], [3.6, 0.9]];
  fl.forEach(([x, z], i) => K.at([x, 0, z], 0, () => troffer(K, 1.2, 0.6, H, (i === 1 || i === 3) ? 'glowFlk' : 'glow')));

  // ---- cold-chamber unit (north wall)
  const UX = -1.6, UW = 3.64, UD = 0.78, UH = 2.38, frontZ = -HD + UD;
  const plateIdx = (r, c) => r * 4 + c;
  K.at([UX, 0, -HD], 0, () => {
    K.box('darkMetal', UW, UH, UD - 0.05, 0, 0, (UD - 0.05) / 2);
    K.box('steel', UW + 0.04, 0.16, UD + 0.02, 0, 0, (UD + 0.02) / 2); // plinth
    K.box('steelPlain', UW + 0.04, 0.05, UD, 0, UH, UD / 2);
    for (let g = 0; g < 14; g++) K.box('darkMetal', 0.34, 0.04, 0.006, -UW / 2 + 0.3 + g * 0.24, UH - 0.12, UD + 0.004);
    const dw = (UW - 0.08) / 4;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const cx = -UW / 2 + 0.04 + dw * (c + 0.5), y0 = 0.2 + r * 0.7;
      if (r === 1 && c === 2) { K.box('paint#040505', dw - 0.04, 0.62, 0.04, cx, y0 + 0.02, UD - 0.03); continue; }
      K.at([cx, y0, UD], 0, () => {
        K.box('steel', dw - 0.04, 0.64, 0.045, 0, 0, -0.02);
        K.box('steelPlain', dw - 0.08, 0.6, 0.012, 0, 0.02, 0.026);
        for (const s of [-1, 1]) K.cyl('chrome', 0.012, 0.03, s * 0.09, 0.32, 0.03, { axis: 'z', seg: 6 }); K.cyl('chrome', 0.013, 0.2, 0, 0.32, 0.05, { axis: 'x', seg: 8 });
        K.box('chrome', 0.05, 0.1, 0.012, 0.28, 0.12, 0.03); K.cyl('darkMetal', 0.012, 0.01, 0.28, 0.2, 0.034, { axis: 'z', seg: 8 });
        K.box('darkMetal', 0.14, 0.07, 0.006, -0.22, 0.52, 0.03);
        K.geo('plate', uvRect(new THREE.PlaneGeometry(0.12, 0.06), plates.cell(plateIdx(r, c) % 12)), -0.22, 0.555, 0.036);
      });
    }
  });
  K.geo('plate', uvRect(new THREE.PlaneGeometry(0.5, 0.25), plates.cell(12)), UX - 0.9, 2.7, -HD + 0.02, 0);
  // temperature readout
  { const sg = signMesh(0.34, 0.12, (ctx, w, h) => { ctx.fillStyle = '#0a1a10'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#6fff9a'; ctx.font = 'bold 60px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('4.0' + DEGS + 'C  ALL OK', w / 2, h / 2); }, { px: 400, lit: true, emissive: 1.6, bg: '#0a1a10' }); sg.position.set(UX + 0.9, 2.7, -HD + 0.025); K.mesh(sg); }
  // sliding drawer (middle row, third column) - animated group
  const dk = K.sub('drawer'); const dwid = (UW - 0.08) / 4; const dcx = UX - UW / 2 + 0.04 + dwid * 2.5; const dy = 0.2 + 0.7;
  dk.at([0, 0, 0], 0, () => {
    dk.box('steel', dwid - 0.04, 0.64, 0.045, 0, 0, 0.0); dk.box('steelPlain', dwid - 0.08, 0.6, 0.012, 0, 0.02, 0.028);
    for (const s of [-1, 1]) dk.cyl('chrome', 0.012, 0.03, s * 0.09, 0.32, 0.04, { axis: 'z', seg: 6 }); dk.cyl('chrome', 0.013, 0.2, 0, 0.32, 0.06, { axis: 'x', seg: 8 }); dk.box('chrome', 0.05, 0.1, 0.012, 0.28, 0.12, 0.04);
    dk.box('steel', 0.7, 0.025, 2.0, 0, 0.14, -1.0); for (const s of [-1, 1]) { dk.box('steelPlain', 0.025, 0.07, 2.0, s * 0.35, 0.14, -1.0); dk.box('chrome', 0.03, 0.03, 2.0, s * 0.3, 0.1, -1.0); dk.box('steelPlain', 0.7, 0.07, 0.025, 0, 0.14, -0.012); }
    dk.box('steelPlain', 0.7, 0.07, 0.025, 0, 0.14, -2.0);
    dk.at([0, 0.1525, -0.1], [0, Math.PI, 0], () => sheetedBody(dk, 1.75, 0.98));
  });
  dk.build(); const drawer = dk.root; drawer.position.set(dcx, dy, frontZ - 0.002); drawer.userData.baseZ = frontZ - 0.002;
  // tag on the sheeted body
  

  // ---- autopsy tables, lamp, scale
  K.at([-1.2, 0, 0.1], 0, () => autopsyTable(K, 1));
  K.at([1.3, 0, 0.35], 0.04, () => autopsyTable(K, -1));
  K.at([-1.2, 0, 0.1], 0, () => surgicalLamp(K));
  organScale(K, 0.05, 1.6);
  mayo(K, -2.15, -0.4, 0.3, rng);

  // ---- gurney with covered body + wheelchair-less corner
  K.at([3.35, 0, 2.2], 0.35, () => gurney(K, true));
  // second empty gurney parked along the north-east
  K.at([3.7, 0, -0.2], -Math.PI / 2 + 0.05, () => gurney(K, false));

  // ---- west run: cabinets, two sinks, dispensers
  K.at([-HW + 0.3 + 0.04, 0, -0.9], Math.PI / 2, () => {
    const len = 3.6; const x0 = -len / 2; const sx = [-0.9, 0.9];
    for (let i = 0; i < 6; i++) { const cx = x0 + 0.3 + i * 0.6; const under = i === 1 || i === 4; K.box('steel', 0.58, under ? 0.56 : 0.8, 0.58, cx, 0.08, 0); K.box('steelPlain', 0.5, 0.62, 0.012, cx, 0.14, 0.296); K.box('chrome', 0.1, 0.014, 0.02, cx, 0.62, 0.315); }
    K.box('darkMetal', len, 0.08, 0.6, 0, 0, 0);
    // counter top built around the two sink openings
    K.slab('steel', -len / 2, 0.88, 0.23, len / 2, 0.9, 0.32); K.slab('steel', -len / 2, 0.88, -0.3, len / 2, 0.9, -0.19);
    K.slab('steel', -len / 2, 0.88, -0.19, -1.2, 0.9, 0.23); K.slab('steel', -0.6, 0.88, -0.19, 0.6, 0.9, 0.23); K.slab('steel', 1.2, 0.88, -0.19, len / 2, 0.9, 0.23);
    K.box('steel', len, 0.14, 0.02, 0, 0.9, -0.29);
    for (const x of sx) K.at([x, 0, 0.02], 0, () => sink(K, 0.6, 0.42, 0.24));
    for (const x of sx) K.at([x, 0.9, -0.22], 0, () => faucet(K));
    K.rbox('paint#eceae4', 0.26, 0.34, 0.12, 0.02, -1.55, 1.3, -0.24); K.rbox('paint#eceae4', 0.12, 0.2, 0.1, 0.02, -0.15, 1.3, -0.24); K.box('chrome', 0.04, 0.02, 0.05, -0.15, 1.28, -0.17); K.rbox('paint#eceae4', 0.12, 0.2, 0.1, 0.02, 1.35, 1.3, -0.24);
    K.box('mirror', 0.5, 0.6, 0.01, -0.1, 1.2, -0.294); K.box('steelPlain', 0.54, 0.02, 0.02, -0.1, 1.8, -0.288); K.box('steelPlain', 0.54, 0.02, 0.02, -0.1, 1.18, -0.288);
    for (let i = 0; i < 3; i++) K.tinted(['#2b6fc0', '#2b6fc0', '#8a3ac0'][i], () => K.box('plastic', 0.1, 0.12, 0.21, 1.4 + i * 0.13, 0.9, -0.1));
    K.tinted('#f0f0e8', () => { K.cyl('plastic', 0.035, 0.2, -1.35, 0.9, -0.12, { seg: 10 }); K.cyl('plastic', 0.035, 0.2, -1.42, 0.9, 0.05, { seg: 10 }); }); K.cyl('paint#2a6ac0', 0.037, 0.04, -1.35, 1.08, -0.12, { seg: 10 }); K.cyl('paint#c03a2a', 0.037, 0.04, -1.42, 1.08, 0.05, { seg: 10 });
  });
  // wall cabinets with specimen jars on the west wall
  K.at([-HW + 0.18, 1.5, 1.0], Math.PI / 2, () => {
    const len = 2.4; K.box('steel', len, 0.04, 0.34, 0, 0.0, 0); K.box('steel', len, 0.04, 0.34, 0, 0.62, 0); K.box('steel', len, 0.6, 0.02, 0, 0.0, -0.16); K.box('steel', 0.03, 0.62, 0.34, -len / 2, 0, 0); K.box('steel', 0.03, 0.62, 0.34, len / 2, 0, 0); K.box('steel', len - 0.03, 0.03, 0.34, 0, 0.3, 0);
    for (let i = 0; i < 9; i++) jar(K, -len / 2 + 0.2 + i * 0.25, 0.32, 0.0, { h: 0.19, r: 0.055, liquid: rng.pick(['#d8c276', '#e9d9a0', '#c7d9a0', '#e8e0d0']), spec: rng.pick(['#c98a8a', '#b86a6a', '#d9a8a0', '#8a5a5a']) }, rng);
    for (let i = 0; i < 9; i++) jar(K, -len / 2 + 0.2 + i * 0.25, 0.04, 0.0, { h: 0.17, r: 0.05, liquid: '#dad0b8', spec: rng.pick(['#c98a8a', '#a07070', '#d9b0a0']) }, rng);
    K.box('glass', len, 0.62, 0.012, 0, 0.0, 0.17);
    for (const s of [-1, 1]) K.box('chrome', 0.012, 0.2, 0.014, s * 0.05, 0.2, 0.18);
  });
  // eyewash + PPE rack near the door
  K.at([-2.7, 0, HD - 0.12], Math.PI, () => {
    K.box('steelPlain', 0.8, 0.04, 0.05, 0, 1.5, 0); for (const x of [-0.3, -0.1, 0.1, 0.3]) { K.cyl('chrome', 0.012, 0.1, x, 1.46, 0.0, { seg: 6 }); K.tinted(['#9ec4e8', '#e8e8e4', '#9ec4e8', '#e8e8e4'][Math.round((x + 0.3) / 0.2)], () => { K.box('plastic', 0.34, 0.9, 0.012, x, 0.58, 0.03, 0); }); }
    K.box('paint#2a7a3a', 0.45, 0.3, 0.012, -0.0, 1.9, 0.01); K.box('paint#f4f4f0', 0.4, 0.04, 0.003, 0, 2.0, 0.017); K.tinted('#2a8a40', () => { K.cyl('plastic', 0.2, 0.26, 0.9, 0.2, 0.02, { seg: 18 }); K.cyl('steelPlain', 0.12, 0.04, 0.9, 0.46, 0.02, { seg: 14 }); });
  });
  // ---- boot rack + biohazard bins + mop bucket + wet floor sign
  K.at([3.75, 0, 3.7], 0, () => { for (let i = 0; i < 2; i++) { K.tinted(i ? '#c8282c' : '#b52424', () => K.lathe('plastic', [[0.16, 0], [0.2, 0.02], [0.21, 0.58], [0.19, 0.6], [0, 0.6]], i * 0.46, 0, 0, { seg: 16 })); K.box('paint#f5c400', 0.18, 0.18, 0.004, i * 0.46, 0.25, 0.21); K.cyl('paint#161616', 0.16, 0.025, i * 0.46, 0.6, 0, { seg: 16 }); K.box('paint#161616', 0.1, 0.03, 0.02, i * 0.46, 0.62, 0.0); } K.tinted('#f5c400', () => { K.rbox('plastic', 0.26, 0.28, 0.2, 0.03, 0.04, 0.0, -0.5); }); });
  K.at([-3.9, 0, 3.55], 0.5, () => { K.tinted('#e7c21a', () => K.rbox('plastic', 0.34, 0.26, 0.5, 0.03, 0, 0.0, 0)); K.cyl('steelPlain', 0.014, 0.9, 0.1, 0.26, -0.2, { seg: 6 }); K.cyl('paint#d8d4c6', 0.04, 0.2, 0.1, 0.8, -0.2, { seg: 8 }); for (let i = 0; i < 14; i++) K.tube('paint#d8d4c6', [[0.1, 0.8, -0.2], [0.1 + Math.cos(i) * 0.07, 0.5, -0.2 + Math.sin(i) * 0.07], [0.1 + Math.cos(i) * 0.1, 0.0, -0.2 + Math.sin(i) * 0.1]], 0.006, { radial: 3, smooth: false }); K.cyl('steelPlain', 0.04, 0.006, 0.0, 0.26, 0.0, { seg: 4 }); });
  K.at([1.0, 0, 3.2], -0.4, () => { K.tinted('#f4c20d', () => { for (const s of [-1, 1]) K.at([0, 0, s * 0.12], [s * 0.26, 0, 0], () => K.box('plastic', 0.28, 0.62, 0.012, 0, 0, 0)); }); K.box('paint#cc2020', 0.2, 0.08, 0.002, 0, 0.35, 0.145); K.box('paint#cc2020', 0.2, 0.08, 0.002, 0, 0.35, -0.145); });

  // ---- desk area (east wall) with PC, chair
  const pcScr = makeScreen(0.46, 0.27, { res: [512, 300], draw: (ctx, w, h) => drawForm(ctx, w, h), frame: false });
  K.at([4.15, 0, -2.4], -Math.PI / 2, () => {
    deskUnit(K, 1.7, 0.72, 0.75, { top: 'woodGrain', body: 'woodGrain', color: '#c9b28c' });
    K.at([-0.28, 0.75, -0.04], 0, () => { monitor(K, { w: 0.5, h: 0.3, y: 0 }); pcScr.mesh.position.set(0, 0.265, 0.0168); K.mesh(pcScr.mesh); });
    K.at([-0.28, 0.75, 0.26], 0, () => keyboard(K)); K.at([0.3, 0.75, 0.2], 0.3, () => { K.box('paint#d9d9d4', 0.16, 0.07, 0.2, 0, 0, 0); K.box('paint#222', 0.14, 0.02, 0.08, 0, 0.07, 0.03); });
    mug(K, '#f2f2ee', 0.7, 0.75, 0.15); paperStack(K, 0.62, 0.75, -0.1, 12, 0.2); folder(K, 0.45, 0.76, 0.2, 0.15, '#4a7ab0'); folder(K, 0.5, 0.764, 0.18, -0.1, '#d9b45a');
    K.at([-0.7, 0.75, -0.05], 0.5, () => { K.cyl('darkMetal', 0.05, 0.015, 0, 0, 0, { seg: 10 }); K.cyl('darkMetal', 0.01, 0.3, 0, 0.0, 0, { seg: 5 }); K.tube('darkMetal', [[0, 0.3, 0], [0.1, 0.4, 0.05], [0.2, 0.36, 0.1]], 0.008, { radial: 5 }); K.lathe('paint#f0c860', [[0.01, 0], [0.05, -0.05], [0.055, -0.06]], 0.2, 0.33, 0.1, { seg: 10 }); });
  });
  K.at([3.3, 0, -2.3], Math.PI / 2, () => officeChair(K, { color: '#27425c' }));
  // whiteboard + corkboard + clock + posters on east wall
  { const wb = signMesh(1.7, 1.0, (ctx, w, h) => { ctx.fillStyle = '#f6f7f4'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4); ctx.font = 'bold 34px Arial'; ctx.fillStyle = '#1a3a6a'; ctx.textAlign = 'left'; ctx.fillText('CASE LOG - WEEK 14', 24, 46); ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(20, 74 + i * 52); ctx.lineTo(w - 20, 74 + i * 52); ctx.stroke(); } ctx.font = '26px "Segoe Print","Comic Sans MS",cursive'; const rows = [['0412', 'Dela Cruz, R.', 'RTA - pending tox', '#1a3a6a'], ['0413', 'Unknown F ~40', 'ID pending', '#a02020'], ['0414', 'Abella, J.', 'Cardiac - released', '#1a6a3a'], ['0415', 'Unknown M', 'Beach - drowning?', '#a02020'], ['0416', 'Tan, L.', 'Histology sent', '#1a3a6a'], ['0417', '??', 'Strange lesions - call Dr. Reyes', '#a02020']]; rows.forEach((r, i) => { ctx.fillStyle = r[3]; ctx.fillText(r[0] + '  ' + r[1], 24, 108 + i * 52); ctx.fillText(r[2], w * 0.55, 108 + i * 52); }); }, { px: 300, bg: '#f6f7f4', rough: 0.25 }); wb.position.set(HW - 0.07, 1.65, -2.4); wb.rotation.y = -Math.PI / 2; K.mesh(wb); }
  K.at([HW - 0.06, 0, 0.6], -Math.PI / 2, () => { for (let i = 0; i < 5; i++) K.geo('poster', uvRect(new THREE.PlaneGeometry(0.5, 0.69), posters.cell(i)), -0.0 - (i % 3) * 0.62 + 0.62, 1.55 + (i > 2 ? -0.0 : 0), 0.0, 0); });
  const clk = wallClock(K, 0.2, 2.0, 2.6, -HD + 0.035, 0);
  // posters on north wall right
  K.at([2.9, 0, -HD + 0.04], 0, () => { K.geo('poster', uvRect(new THREE.PlaneGeometry(0.6, 0.83), posters.cell(5)), -0.7, 1.6, 0, 0); K.geo('poster', uvRect(new THREE.PlaneGeometry(0.6, 0.83), posters.cell(2)), 0.9, 1.6, 0, 0); });
  // steel evidence shelving NE
  K.at([2.15, 0, -HD + 0.3], 0, () => {
    for (const x of [-0.7, 0.7]) for (const z of [-0.25, 0.25]) K.box('steelPlain', 0.035, 2.0, 0.035, x, 0, z);
    for (let i = 0; i < 5; i++) { K.box('steel', 1.45, 0.025, 0.56, 0, 0.18 + i * 0.4, 0); }
    for (let i = 0; i < 4; i++) { let x = -0.65; while (x < 0.55) { const bw = rng.range(0.1, 0.22), bh = rng.range(0.14, 0.3); K.tinted(rng.pick(['#c9a874', '#b99560', '#d8d2c4', '#3a5a8a', '#8a3a3a']), () => K.box('matte', bw, bh, 0.28, x + bw / 2, 0.2 + i * 0.4, rng.range(-0.1, 0.1))); x += bw + rng.range(0.02, 0.07); } }
  });
  // fire extinguisher, first-aid, thermostat
  fireExt(K, 4.4, 0.9, 0.0, -Math.PI / 2);
  K.at([HW - 0.05, 1.4, 2.4], -Math.PI / 2, () => { K.box('paint#f4f4f0', 0.3, 0.3, 0.1, 0, 0, 0); K.box('paint#2a8a3a', 0.2, 0.06, 0.005, 0, 0.12, 0.052); K.box('paint#2a8a3a', 0.06, 0.2, 0.005, 0, 0.05, 0.052); });
  // floor details: drains + puddles
  for (const [x, z] of [[-1.2, 1.1], [1.3, 1.37]]) { K.cyl('darkMetal', 0.11, 0.008, x, 0.001, z, { seg: 16 }); for (let i = 0; i < 5; i++) K.box('paint#0a0a0b', 0.01, 0.01, 0.18, x - 0.07 + i * 0.035, 0.005, z); }
  K.defMat('wet', { color: 0x10181a, rough: 0.06, metal: 0, env: 1.4, transparent: true, opacity: 0.55, noShadow: true });
  for (const [x, z, r] of [[-1.2, 1.1, 0.5], [1.3, 1.3, 0.6], [-2.0, -0.9, 0.35], [0.2, 2.9, 0.4]]) { K.cyl('wet', r, 0.002, x, 0.004, z, { seg: 20, s: [1, 0.7] }); }
  // computer chair cable, misc: stool near table B and the PPE trolley
  K.at([2.7, 0, 0.9], 1.2, () => { K.cyl('steelPlain', 0.18, 0.02, 0, 0.5, 0, { seg: 16 }); K.cyl('steelPlain', 0.02, 0.5, 0, 0.0, 0, { seg: 6 }); K.cyl('darkMetal', 0.22, 0.02, 0, 0.0, 0, { seg: 10 }); });

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xc6f0de, 0x1a2a24, 0.9);
  const l1 = new THREE.PointLight(0xdcf7ee, 18, 0, 2); l1.position.set(-1.2, 2.5, 0.2);
  const l2 = new THREE.PointLight(0xd8f2e8, 14, 0, 2); l2.position.set(1.4, 2.6, 0.4);
  const lights = [hemi, l1, l2];
  const flk = K.m('glowFlk'); const base = flk.color.clone(); let flick = opts.flicker ?? 0;
  const set = {
    setFlicker(a) { flick = a; },
    /** 0 closed .. 1 fully open */
    setDrawer(a) { drawer.position.z = drawer.userData.baseZ + 1.78 * a - 0.0; drawer.userData.a = a; },
    getDrawer() { return drawer.userData.a ?? 1; },
    clock: clk, drawer,
  };
  drawer.userData.a = 1; set.setDrawer(opts.drawerOpen ?? 1);
  const doorSize = { w: doorW };
  const anchors = {
    mirrahTableA: AT([-1.9, 0, 0.3], [-1.2, 0.9, 0.3]), tableA: AT([-1.9, 0, 0.3], [-1.2, 0.9, 0.3]), tableAFoot: AT([-1.2, 0, 1.45], [-1.2, 0.9, 0.3]), tableAHead: AT([-1.2, 0, -1.2], [-1.2, 0.9, 0.3]),
    tableB: AT([2.0, 0, 0.55], [1.3, 0.9, 0.35]), tableBHead: AT([1.3, 0, -1.1], [1.3, 0.9, 0.4]),
    drawerWall: AT([dcx, 0, frontZ + 0.8], [dcx, 1.0, frontZ]), drawerOpen: AT([dcx + 0.9, 0, frontZ + 1.3], [dcx, 1.1, frontZ + 1.2]),
    sinks: AT([-3.1, 0, 0.9], [-4.4, 1.0, 0.9]), desk: AT([3.1, 0, -2.4], [4.2, 0.9, -2.4]), deskSeat: A([3.3, 0.0, -2.3], Math.PI / 2),
    door: AT([doorX, 0, HD - 0.5], [doorX, 1.4, -2]), gurney: AT([2.4, 0, 2.0], [3.35, 0.9, 2.2]),
    camWide: { pos: [0.4, 1.65, 3.7], yaw: Math.PI, look: [-0.6, 1.0, -3.0] },
    camTable: { pos: [-3.0, 1.55, 1.9], yaw: 2.6, look: [-1.2, 0.95, 0.1] },
    camTableLow: { pos: [-0.7, 1.15, 1.7], yaw: Math.PI, look: [-1.2, 0.95, -0.2] },
    camDrawers: { pos: [-1.2, 1.5, 0.8], yaw: Math.PI, look: [-1.4, 1.2, -4.0] },
    camDrawerClose: { pos: [-0.2, 1.3, -1.3], yaw: Math.PI, look: [dcx, 1.0, frontZ + 1.2] },
    camDesk: { pos: [1.5, 1.7, -0.6], yaw: Math.PI / 2, look: [4.2, 1.0, -2.4] },
    camDoor: { pos: [2.2, 1.6, -3.2], yaw: 0, look: [2.2, 1.4, HD] },
    camOverhead: { pos: [0.0, 2.9, 0.4], yaw: Math.PI, look: [0, 0, 0] },
  };
  return finishSet(K, set, {
    bounds: { w: W, d: D, h: H }, anchors, lights, screens: [pcScr.screen], extraObjs: [drawer],
    update(dt, t) {
      clk.set(t + 9 * 3600 + 25 * 60);
      const n = noise2(t * 17, 3.1) * 0.5 + 0.5, n2 = noise2(t * 41, 7.7);
      const k = flick > 0 ? 1 - flick * (n > 0.7 ? 0.9 : n > 0.5 ? 0.35 * (n2 * 0.5 + 0.5) : 0) : 1;
      flk.color.copy(base).multiplyScalar(k); l1.intensity = 18 * (0.5 + 0.5 * k);
    },
  });
}
function drawForm(ctx, w, h) {
  ctx.fillStyle = '#e9eef4'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1d4a8a'; ctx.fillRect(0, 0, w, 34); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.textBaseline = 'middle'; ctx.fillText('DCGH · PATHOLOGY INFORMATION SYSTEM', 12, 18);
  ctx.fillStyle = '#222'; ctx.font = '15px Arial'; ctx.fillText('Autopsy Report - Case 2050-0417', 14, 56);
  const rows = ['Decedent: UNKNOWN (M, ~35 y)', 'Date received: 04/17  06:42', 'Referring: Dumaguete PNP', 'External: multiple sub-dermal lesions', 'Tox screen: PENDING', 'Cause of death: __________'];
  rows.forEach((r, i) => { ctx.fillStyle = i === 3 ? '#a02020' : '#222'; ctx.fillText(r, 14, 86 + i * 28); });
  ctx.fillStyle = '#cfd8e2'; ctx.fillRect(14, 262, 120, 26); ctx.fillStyle = '#123'; ctx.font = 'bold 14px Arial'; ctx.fillText('SAVE DRAFT', 28, 276);
}
export { autopsyTable as __autopsyTable };
