// createLab(kind) — 'bsl4' (sealed containment), 'virology', 'research'
import * as THREE from 'three';
import { createKit } from './kit.js';
import { drawSequence, drawTelemetry, drawDataScroll, drawSpectrum, drawStatusGrid, drawRadar, SANS, MONO, theme } from './draw.js';
import { chair, stool, labStool, monitor, keyboard, mug, papers, lightPanel, whiteboard, plant, door, cable, vent, wallClock, crate, tablet, bottle } from './props.js';
import { limb } from '../../../engine/geo.js';
import { lumpGeo } from './alien_geo.js';
import { TAU, RNG } from '../../../engine/common.js';

// ---------- signage painters ----------
function trefoil(c, cx, cy, r, col = '#111') {
  c.fillStyle = col;
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; const x = cx + Math.cos(a) * r * 0.5, y = cy + Math.sin(a) * r * 0.5; c.beginPath(); c.arc(x, y, r * 0.52, 0, TAU); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; }
  c.restore();
}
function biohazardSign(text = 'BIOHAZARD', sub = '') {
  return (c, w, h) => {
    c.fillStyle = '#f0b800'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.fillRect(0, 0, w, h * 0.09); c.fillRect(0, h * 0.91, w, h * 0.09);
    const cx = w / 2, cy = h * 0.43, r = Math.min(w, h * 0.7) * 0.34; c.fillStyle = '#111'; c.strokeStyle = '#111'; c.lineWidth = r * 0.14;
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; const x = cx + Math.cos(a) * r * 0.56, y = cy + Math.sin(a) * r * 0.56; c.beginPath(); c.arc(x, y, r * 0.5, a + 2.4, a - 2.4 + TAU, false); c.arc(x, y, r * 0.3, a - 2.4 + TAU, a + 2.4, true); c.closePath(); c.fill(); }
    c.beginPath(); c.arc(cx, cy, r * 0.2, 0, TAU); c.fill(); c.fillStyle = '#f0b800'; c.beginPath(); c.arc(cx, cy, r * 0.1, 0, TAU); c.fill();
    c.strokeStyle = '#111'; c.lineWidth = r * 0.11; c.beginPath(); c.arc(cx, cy, r * 0.98, 0, TAU); c.stroke();
    c.fillStyle = '#111'; c.font = `900 ${h * 0.12}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h * 0.81); if (sub) { c.font = `bold ${h * 0.06}px ${SANS}`; c.fillText(sub, w / 2, h * 0.88); }
  };
}
const plate = (text, bg = '#1d4a8a', fg = '#fff') => (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = 3; c.strokeRect(5, 5, w - 10, h - 10); c.fillStyle = fg; c.font = `bold ${h * 0.36}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; const lines = text.split('\n'); lines.forEach((l, i) => c.fillText(l, w / 2, h * (0.5 + (i - (lines.length - 1) / 2) * 0.4))); };
function formulaBoard(seed) {
  return (c, w, h) => {
    c.fillStyle = '#f4f6f4'; c.fillRect(0, 0, w, h); const r = new RNG(seed); c.font = `${h * 0.08}px "Comic Sans MS", cursive, ${SANS}`; c.textBaseline = 'top';
    const cols = ['#1a2a8a', '#a01818', '#1a6a2a', '#222']; const forms = ['dN/dt = rN(1 - N/K)', 'R0 = β / γ', 'S + I + R = N', 'dS/dt = -βSI', 'dI/dt = βSI - γI', 'ATGCCGTAA -> M P *', 'Km = [S] at V/2', 'K = 1.4 x 10^-3', 'p < 0.001', 'ΔG = ΔH - TΔS', 'RNA -> cDNA -> PCR', 'titre 10^6 pfu/mL'];
    for (let i = 0; i < 9; i++) { c.fillStyle = r.pick(cols); c.fillText(r.pick(forms), r.range(0.03, 0.4) * w, (0.04 + i * 0.1) * h); }
    c.strokeStyle = '#1a2a8a'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.62, h * 0.8); c.lineTo(w * 0.62, h * 0.12); c.lineTo(w * 0.95, h * 0.12 + 0); c.stroke(); c.strokeStyle = '#a01818'; c.beginPath(); for (let i = 0; i <= 30; i++) { const x = w * (0.62 + i / 30 * 0.32), y = h * (0.8 - 0.62 * Math.exp(-Math.pow((i / 30 - 0.4) * 3, 2))); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  };
}
function drawLabStatus(c, w, h, t, S) {
  const th = theme('green'); c.fillStyle = '#031008'; c.fillRect(0, 0, w, h); c.font = `bold ${h * 0.11}px ${MONO}`; c.textBaseline = 'top';
  const rows = [['DIFF PRESS', `${(-61.5 + Math.sin(t * 0.7) * 1.2).toFixed(1)} Pa`], ['AIR CHANGES', `${(12 + Math.sin(t * 0.3) * 0.2).toFixed(1)} /h`], ['TEMP', `${(21.4 + Math.sin(t * 0.2) * 0.2).toFixed(1)} C`], ['HEPA SUPPLY', 'OK'], ['HEPA EXHAUST', 'OK'], ['INTERLOCK', S.alert > 0.5 ? 'BREACH' : 'LOCKED']];
  rows.forEach(([a, b], i) => { const bad = b === 'BREACH'; c.fillStyle = th.text; c.globalAlpha = 0.8; c.fillText(a, w * 0.05, h * (0.06 + i * 0.15)); c.globalAlpha = 1; c.fillStyle = bad ? '#ff3b30' : th.dot2; c.textAlign = 'right'; c.fillText(b, w * 0.95, h * (0.06 + i * 0.15)); c.textAlign = 'left'; });
  if (S.infect > 0.3) { c.fillStyle = `rgba(60,255,26,${0.2 * S.infect})`; c.fillRect(0, 0, w, h); }
}

// ---------- prop builders ----------
function coil(k, a, b, r = 0.07, turns = 8, tr = 0.012, m = 'paintYellow') {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), L = dir.length(); dir.normalize();
  const u = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0.3, 1, 0.2)).normalize(), v = new THREE.Vector3().crossVectors(dir, u).normalize(); const pts = [];
  const n = turns * 8; for (let i = 0; i <= n; i++) { const t = i / n, ph = t * turns * TAU, p = A.clone().addScaledVector(dir, L * t).addScaledVector(u, Math.cos(ph) * r).addScaledVector(v, Math.sin(ph) * r); pts.push([p.x, p.y, p.z]); }
  k.tubeAlong(m, pts, tr, { seg: 4, perPoint: 1, tsegs: n });
}
function ppeSuit(k, x, z, ry, hex = 0x2a62c8) {
  k.push(x, 0, z, ry);
  const L = limb(0.46, 0.085, 0.07, { radial: 10, rings: 3, bulge: 0.05 }), A = limb(0.5, 0.06, 0.05, { radial: 9, rings: 3, bulge: 0.05 });
  for (const s of [-1, 1]) { k.part('paintBlue', L, [s * 0.1, 0.18, 0], { color: hex }); k.part('paintBlue', L, [s * 0.1, 0.62, 0], { color: hex, sy: 1.05 }); k.box('blackPlastic', [0.12, 0.1, 0.26], [s * 0.1, 0.07, 0.05]); k.part('paintBlue', A, [s * 0.3, 1.24, 0], { color: hex, rz: -s * 0.12, sy: 1.0 }); k.sph('blackPlastic', 0.055, [s * 0.34, 0.72, 0.0], { seg: 8 }); }
  k.part('paintBlue', lumpGeo(3, { rx: 0.27, ry: 0.36, rz: 0.19, amp: 0.04, w: 14, h: 10 }), [0, 1.2, 0], { color: hex }); k.part('paintBlue', lumpGeo(4, { rx: 0.25, ry: 0.2, rz: 0.18, amp: 0.04, w: 12, h: 8 }), [0, 0.88, 0], { color: hex });
  k.torus('steel', 0.16, 0.025, [0, 1.52, 0], { rx: Math.PI / 2, seg: 14, tseg: 5 });
  k.part('paintBlue', lumpGeo(5, { rx: 0.23, ry: 0.27, rz: 0.24, amp: 0.02, w: 16, h: 12 }), [0, 1.72, 0], { color: hex }); k.sph('glassTint', 0.215, [0, 1.74, 0.025], { seg: 14, sx: 1, sy: 1.1, sz: 1 });
  k.box('steelDark', [0.2, 0.14, 0.08], [0, 1.28, 0.17]); k.box(k.glow(0x30ff70, 1.6), [0.03, 0.03, 0.02], [0.05, 1.3, 0.215]);
  k.pop();
}
function glovebox(k, x, z, len, ry = 0) {
  k.push(x, 0, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('steel', [0.08, 0.8, 0.08], [sx * (len / 2 - 0.1), 0.4, sz * 0.38]);
  k.box('steel', [len, 0.1, 0.9], [0, 0.82, 0]); k.box('steel', [len - 0.1, 0.5, 0.86], [0, 1.16, -0.02], { uv: 'box' });
  k.box('glass', [len - 0.2, 0.55, 0.02], [0, 1.2, 0.46], { rx: 0.2 }); k.box('steel', [len, 0.08, 0.04], [0, 0.93, 0.44]); k.box('steel', [len, 0.08, 0.04], [0, 1.52, 0.38]);
  k.box(k.glow(0xdfeaff, 2.0), [len - 0.3, 0.02, 0.06], [0, 1.4, 0.3], { mirror: false });
  const n = Math.max(2, Math.round(len / 1.1)); for (let i = 0; i < n; i++) { const px = (i + 0.5) / n * (len - 0.5) - (len - 0.5) / 2; for (const sx of [-0.17, 0.17]) { k.cyl('blackMatte', [0.095, 0.095, 0.14], [px + sx, 1.1, 0.46], { rx: Math.PI / 2 - 0.2, seg: 12 }); k.part('rubber', new THREE.CapsuleGeometry(0.05, 0.38, 3, 8), [px + sx, 1.06, 0.26], { rx: Math.PI / 2 - 0.55, color: 0x1a58c8, sy: 1.0 }); } }
  k.cyl('steel', [0.3, 0.3, 0.7], [len / 2 + 0.3, 1.15, 0], { rz: Math.PI / 2, seg: 18 }); k.cyl('steelDark', [0.32, 0.32, 0.06], [len / 2 + 0.68, 1.15, 0], { rz: Math.PI / 2, seg: 18 }); k.torus('chrome', 0.18, 0.02, [len / 2 + 0.72, 1.15, 0], { ry: Math.PI / 2, seg: 14, tseg: 4 });
  k.cyl('steel', [0.1, 0.1, 0.5], [-len / 2 + 0.3, 1.65, -0.2], { seg: 8 }); k.rod('steel', [-len / 2 + 0.3, 1.9, -0.2], [-len / 2 + 0.3, 3.4, -0.1], 0.05, { seg: 6 });
  k.pop();
}
function virusModel(k, x, y, z, r = 0.42) {
  k.sph('paintWhite', r, [x, y, z], { color: 0xd8e4ee, seg: 24 });
  const rng = new RNG(5); const spike = new THREE.CylinderGeometry(0.012, 0.03, 0.14, 6);
  for (let i = 0; i < 96; i++) { const a = rng.unit(); const p = [x + a.x * r, y + a.y * r, z + a.z * r]; const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a), 'YXZ'); k.part('paintRed', spike, [p[0] + a.x * 0.06, p[1] + a.y * 0.06, p[2] + a.z * 0.06], { rx: e.x, ry: e.y, rz: e.z, color: 0xd02a2a }); k.sph('paintRed', 0.034, [x + a.x * (r + 0.14), y + a.y * (r + 0.14), z + a.z * (r + 0.14)], { seg: 5, color: 0xff5a40 }); }
}
function dnaHelix(k, x, y, z, h = 1.4, r = 0.18, turns = 3) {
  const a1 = [], a2 = []; const n = turns * 14;
  for (let i = 0; i <= n; i++) { const t = i / n, ph = t * turns * TAU; a1.push([x + Math.cos(ph) * r, y + t * h, z + Math.sin(ph) * r]); a2.push([x + Math.cos(ph + Math.PI) * r, y + t * h, z + Math.sin(ph + Math.PI) * r]); }
  k.tubeAlong('chrome', a1, 0.025, { seg: 5, perPoint: 1, tsegs: n }); k.tubeAlong('chrome', a2, 0.025, { seg: 5, perPoint: 1, tsegs: n });
  for (let i = 0; i < n; i += 2) { const col = [0xff5a40, 0x40a0ff, 0xffd040, 0x50e070][(i >> 1) % 4]; k.rod('whitePlastic', a1[i], a2[i], 0.012, { seg: 4, color: col }); k.sph('whitePlastic', 0.03, a1[i], { seg: 6, color: col }); k.sph('whitePlastic', 0.03, a2[i], { seg: 6, color: [0x40a0ff, 0xff5a40, 0x50e070, 0xffd040][(i >> 1) % 4] }); }
}
function microscope(k, x, y, z, ry) {
  k.push(x, y, z, ry);
  k.rbox('whitePlastic', [0.2, 0.04, 0.26], [0, 0.02, 0], { r: 0.015, s: 1 }); k.part('whitePlastic', new THREE.TorusGeometry(0.17, 0.028, 6, 14, Math.PI * 1.1), [0, 0.2, -0.1], { rz: -Math.PI * 0.05, ry: Math.PI / 2 });
  k.box('whitePlastic', [0.05, 0.3, 0.06], [0, 0.18, -0.12], {}); k.box('blackPlastic', [0.14, 0.012, 0.13], [0, 0.14, 0.02]); k.cyl('greyPlastic', [0.04, 0.04, 0.08], [0, 0.27, 0.0], { seg: 8 }); for (const a of [-0.5, 0.2, 0.9]) k.cyl('blackPlastic', [0.014, 0.014, 0.07], [Math.sin(a) * 0.02, 0.22, Math.cos(a) * 0.02], { seg: 6, rx: 0.1 });
  k.cyl('blackPlastic', [0.025, 0.025, 0.14], [0, 0.4, -0.04], { seg: 8, rx: -0.5 }); k.cyl('blackMatte', [0.022, 0.03, 0.04], [0, 0.46, -0.1], { seg: 8, rx: -0.5 }); k.sph(k.glow(0xfff0c0, 1.5), 0.02, [0, 0.07, 0.01], { seg: 6 });
  k.pop();
}
function centrifuge(k, x, y, z, ry, big = false) {
  k.push(x, y, z, ry); const s = big ? 1.6 : 1;
  k.rbox('whitePlastic', [0.46 * s, 0.3 * s, 0.5 * s], [0, 0.15 * s, 0], { r: 0.04 * s }); k.part('greyPlastic', new THREE.SphereGeometry(0.2 * s, 18, 8, 0, TAU, 0, Math.PI / 2), [0, 0.3 * s, -0.02], { sy: 0.5, color: 0x9aa4b0 });
  k.box('blackPlastic', [0.18 * s, 0.07 * s, 0.01], [0.1 * s, 0.14 * s, 0.255 * s]); k.box(k.glow(0x30ff70, 1.6), [0.14 * s, 0.04 * s, 0.005], [0.1 * s, 0.14 * s, 0.262 * s]); k.cyl('greyPlastic', [0.025 * s, 0.025 * s, 0.02], [-0.1 * s, 0.14 * s, 0.26 * s], { rx: Math.PI / 2, seg: 8 });
  k.pop();
}
function incubator(k, x, z, ry, h = 1.0) { k.push(x, 0, z, ry); k.box('steel', [0.7, h, 0.65], [0, h / 2, 0]); k.box('glass', [0.6, h - 0.2, 0.02], [0, h / 2, 0.335]); k.box('blackPlastic', [0.6, 0.12, 0.02], [0, h - 0.1, 0.336]); k.box(k.glow(0x30ff70, 1.4), [0.18, 0.04, 0.01], [0.14, h - 0.1, 0.347]); for (let i = 0; i < 3; i++) k.box('steelDark', [0.54, 0.015, 0.5], [0, 0.15 + i * (h - 0.3) / 2.2, 0]); k.pop(); }
function fridge(k, x, z, ry, w = 0.8, h = 1.95, glassDoor = true) {
  k.push(x, 0, z, ry); k.box('steel', [w, h, 0.75], [0, h / 2, 0]); k.box('steelDark', [w, 0.1, 0.75], [0, 0.05, 0]); if (glassDoor) { k.box('glass', [w - 0.1, h - 0.4, 0.02], [0, h / 2 + 0.05, 0.385]); for (let i = 0; i < 4; i++) { k.box('steelDark', [w - 0.12, 0.02, 0.6], [0, 0.3 + i * 0.42, 0.02]); for (let j = 0; j < 4; j++) k.box(['paintWhite', 'paintBlue', 'paintRed', 'paintYellow'][(i + j) % 4], [0.12, 0.1, 0.12], [-0.27 + j * 0.18, 0.37 + i * 0.42, 0.1]); } } else k.box('steelDark', [w - 0.1, h - 0.3, 0.02], [0, h / 2, 0.385]);
  k.box('blackPlastic', [0.28, 0.12, 0.02], [0, h - 0.12, 0.39]); k.box(k.glow(0x46e6ff, 1.6), [0.2, 0.05, 0.01], [0, h - 0.12, 0.4]); k.rod('chrome', [w / 2 - 0.08, 0.5, 0.4], [w / 2 - 0.08, 1.5, 0.4], 0.012, { seg: 5 }); k.pop();
}
function rackTubes(k, x, y, z, ry, rows = 3, cols = 8) { k.push(x, y, z, ry); k.box('steel', [cols * 0.04 + 0.04, 0.02, 0.2], [0, 0.01, 0]); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { k.cyl('glass', [0.012, 0.012, 0.1], [(c - (cols - 1) / 2) * 0.04, 0.07, (r - (rows - 1) / 2) * 0.05], { seg: 6, color: [0xff9080, 0x80d0ff, 0xf0f0a0, 0xa0f0b0][(r + c) % 4] }); k.cyl('paintRed', [0.013, 0.013, 0.02], [(c - (cols - 1) / 2) * 0.04, 0.125, (r - (rows - 1) / 2) * 0.05], { seg: 6, color: [0xd03030, 0x3060d0, 0xe0d030][(r * 3 + c) % 3] }); } k.pop(); }
function flasks(k, x, y, z, n = 3) { for (let i = 0; i < n; i++) { const c = [0x80d0ff, 0xffd080, 0xa0ffb0, 0xff9a9a][i % 4]; k.part('glass', new THREE.LatheGeometry([[0.001, 0], [0.06, 0], [0.065, 0.02], [0.02, 0.12], [0.02, 0.17], [0.026, 0.18]].map((p) => new THREE.Vector2(p[0], p[1])), 12), [x + i * 0.17, y, z + (i % 2) * 0.05], { color: c }); k.part('whitePlastic', new THREE.LatheGeometry([[0.001, 0], [0.058, 0], [0.06, 0.012], [0.001, 0.012]].map((p) => new THREE.Vector2(p[0], p[1])), 10), [x + i * 0.17, y + 0.012, z + (i % 2) * 0.05], { color: c }); } }
function bench(k, x, z, ry, len, d = 0.75, h = 0.9, o = {}) {
  k.push(x, 0, z, ry);
  k.box('paintDark', [len, h - 0.04, d - 0.04], [0, (h - 0.04) / 2, 0]); k.box(o.top || 'blackPlastic', [len + 0.04, 0.04, d + 0.04], [0, h - 0.02, 0], { color: o.topColor }); k.box('steelDark', [len, 0.08, d - 0.02], [0, 0.04, 0]);
  const n = Math.round(len / 0.6); for (let i = 1; i < n; i++) k.box('steelDark', [0.012, h - 0.2, 0.01], [-len / 2 + i * len / n, h / 2 - 0.02, (d - 0.04) / 2 + 0.002]);
  for (let i = 0; i < n; i++) { if (i % 3 === 0) k.box('steel', [0.1, 0.012, 0.012], [-len / 2 + (i + 0.5) * len / n, h * 0.72, (d - 0.04) / 2 + 0.01]); k.rod('chrome', [-len / 2 + (i + 0.5) * len / n - 0.06, h * 0.7, (d - 0.04) / 2 + 0.02], [-len / 2 + (i + 0.5) * len / n + 0.06, h * 0.7, (d - 0.04) / 2 + 0.02], 0.008, { seg: 4 }); }
  k.pop();
}
function sink(k, x, y, z, ry) { k.push(x, y, z, ry); k.box('steel', [0.5, 0.03, 0.4], [0, 0.0, 0]); k.box('steelDark', [0.4, 0.14, 0.3], [0, -0.07, 0]); k.rod('chrome', [0, 0.0, -0.17], [0, 0.3, -0.17], 0.015, { seg: 6 }); k.rod('chrome', [0, 0.3, -0.17], [0, 0.3, -0.04], 0.012, { seg: 6 }); k.pop(); }
function fumeHood(k, x, z, ry, w = 1.6) {
  k.push(x, 0, z, ry); k.box('paintDark', [w, 0.85, 0.8], [0, 0.425, 0]); k.box('blackPlastic', [w + 0.04, 0.04, 0.84], [0, 0.87, 0]); k.box('whitePlastic', [w, 1.45, 0.78], [0, 1.6, -0.01]);
  k.box('glass', [w - 0.2, 1.0, 0.02], [0, 1.45, 0.37]); k.box('steel', [w - 0.2, 0.06, 0.04], [0, 1.1, 0.37]); k.box('steelDark', [w - 0.2, 0.34, 0.5], [0, 1.0 + 0.0, -0.1], { color: 0x40454c }); k.box(k.glow(0xdfeaff, 1.8), [w - 0.4, 0.02, 0.06], [0, 2.18, 0.2], { mirror: false }); k.cyl('steel', [0.14, 0.14, 0.8], [w / 2 - 0.3, 2.7, -0.1], { seg: 12 });
  k.rod('steel', [-w / 2 + 0.08, 0.9, 0.38], [-w / 2 + 0.08, 0.98, 0.38], 0.01, {}); k.pop();
}
function bsc(k, x, z, ry, w = 1.3) {
  k.push(x, 0, z, ry); for (const sx of [-1, 1]) k.box('steelDark', [0.06, 0.78, 0.06], [sx * (w / 2 - 0.05), 0.39, 0.3]); k.box('steel', [w, 0.1, 0.8], [0, 0.82, 0]); k.box('whitePlastic', [w, 1.0, 0.8], [0, 1.45, -0.02]); k.box('whitePlastic', [w, 0.3, 0.6], [0, 2.1, -0.1]);
  k.box('glass', [w - 0.14, 0.6, 0.02], [0, 1.3, 0.34], { rx: -0.25 }); k.box('steel', [w - 0.14, 0.04, 0.04], [0, 0.96, 0.4]); k.box('blackPlastic', [w - 0.14, 0.04, 0.5], [0, 0.88, 0.1]); k.box(k.glow(0xcfe8ff, 2.0), [w - 0.3, 0.015, 0.05], [0, 1.74, 0.28], { mirror: false }); k.box('blackPlastic', [0.3, 0.1, 0.02], [w / 2 - 0.25, 1.9, 0.31]); k.box(k.glow(0x30ff70, 1.6), [0.18, 0.04, 0.01], [w / 2 - 0.25, 1.9, 0.322]);
  k.cyl('steel', [0.12, 0.12, 0.9], [w / 2 - 0.3, 2.7, -0.1], { seg: 10 }); k.pop();
}
function autoclave(k, x, z, ry) {
  k.push(x, 0, z, ry); k.box('steel', [1.5, 2.0, 1.4], [0, 1.0, 0]); k.box('steelDark', [1.5, 0.2, 1.4], [0, 0.1, 0]);
  k.cyl('chrome', [0.55, 0.55, 0.12], [0, 1.15, 0.72], { rx: Math.PI / 2, seg: 32 }); k.torus('steelDark', 0.55, 0.05, [0, 1.15, 0.78], { seg: 32, tseg: 6 }); k.cyl('steelDark', [0.08, 0.08, 0.18], [0, 1.15, 0.84], { rx: Math.PI / 2, seg: 10 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.3; k.rod('chrome', [0, 1.15, 0.86], [Math.cos(a) * 0.4, 1.15 + Math.sin(a) * 0.4, 0.86], 0.016, { seg: 5 }); k.sph('blackPlastic', 0.04, [Math.cos(a) * 0.42, 1.15 + Math.sin(a) * 0.42, 0.86], { seg: 6 }); }
  k.box('blackPlastic', [0.5, 0.3, 0.04], [0.5, 1.9, 0.72]); k.box(k.glow(0xff5030, 1.8), [0.3, 0.1, 0.01], [0.5, 1.92, 0.745]); k.box('paintYellow', [1.4, 0.06, 0.02], [0, 0.4, 0.71]); k.cyl('steel', [0.09, 0.09, 1.6], [-0.5, 2.8, -0.3], { seg: 8 });
  k.pop();
}
function shelf(k, x, y, z, ry, len = 1.6, n = 3, items = true) { k.push(x, y, z, ry); for (let i = 0; i < n; i++) { k.box('steel', [len, 0.03, 0.3], [0, i * 0.38, 0]); if (items) { const r = new RNG(Math.round(x * 17 + y * 3 + i)); for (let j = 0; j < 6; j++) { const c = r.pick([0x3060c0, 0xd0a030, 0x40a060, 0xc04040, 0x8a8a8a]); k.cyl('glass', [0.045, 0.045, 0.2], [-len / 2 + 0.15 + j * (len - 0.3) / 5, i * 0.38 + 0.115, 0], { seg: 8, color: c }); k.cyl('blackPlastic', [0.03, 0.03, 0.04], [-len / 2 + 0.15 + j * (len - 0.3) / 5, i * 0.38 + 0.235, 0], { seg: 6 }); } } } for (const sx of [-1, 1]) k.box('steelDark', [0.03, (n - 1) * 0.38 + 0.4, 0.3], [sx * len / 2, ((n - 1) * 0.38) / 2, 0]); k.pop(); }
function gasCyl(k, x, z, hex = 0x3a6aa8, h = 1.5) { k.cyl('paintBlue', [0.1, 0.1, h], [x, h / 2, z], { seg: 12, color: hex }); k.sph('paintBlue', 0.1, [x, h, z], { seg: 12, sy: 0.6, color: hex }); k.cyl('chrome', [0.03, 0.03, 0.1], [x, h + 0.08, z], { seg: 6 }); k.torus('steelDark', 0.1, 0.012, [x, h - 0.2, z], { rx: Math.PI / 2, seg: 12, tseg: 4 }); }

export function createLab(kind = 'bsl4', opts = {}) {
  const k = createKit('Lab_' + kind, { seed: 71 });
  const bsl = kind === 'bsl4', vir = kind === 'virology', res = kind === 'research';
  const W = bsl ? 15 : 13, D = bsl ? 11 : 9.5, H = bsl ? 3.5 : 3.3; const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
  const wallM = bsl ? 'epoxyGreen' : 'paintWhite', cyan = k.glow(0x46e6ff, 1.8), green = k.glow(0x30ff70, 1.8), red = k.glow(0xff3020, 2.2), amber = k.glow(0xffb040, 2.0);
  // shell
  k.floorQuad('epoxy', W, D, [0, 0, 0], { color: bsl ? 0xb8d0c8 : 0xd8dce0 }); k.box('ceilingTile', [W, 0.3, D], [0, H + 0.15, 0], { color: 0xf0f0f0 });
  k.wall(wallM, [X0, Z0], [X1, Z0], H, 0.25, { color: bsl ? 0xc8dcd2 : 0xeef0f2 }); k.wall(wallM, [X0, Z0], [X0, Z1], H, 0.25, { color: bsl ? 0xc8dcd2 : 0xeef0f2 }); k.wall(wallM, [X1, Z0], [X1, Z1], H, 0.25, { color: bsl ? 0xc8dcd2 : 0xeef0f2 }); k.wall(wallM, [X0, Z1], [X1, Z1], H, 0.25, { color: bsl ? 0xc8dcd2 : 0xeef0f2 });
  // coved base & dado
  for (const [x, z, w, d] of [[0, Z0 + 0.15, W, 0.06], [0, Z1 - 0.15, W, 0.06], [X0 + 0.15, 0, 0.06, D], [X1 - 0.15, 0, 0.06, D]]) k.box(bsl ? 'epoxyGreen' : 'paintGrey', [w, 0.18, d], [x, 0.09, z], { color: bsl ? 0x90b0a0 : 0x8a9098 });
  // ceiling lights (flush panels) + HEPA diffusers
  const lights = [];
  for (let x = -W / 2 + 2.2; x < W / 2 - 1; x += 3.4) for (let z = -D / 2 + 1.8; z < D / 2 - 1; z += 3.2) { lightPanel(k, x, H - 0.02, z, 1.2, 0.6, bsl ? 0xe8f4ff : 0xfff8f0, bsl ? 1.7 : 1.5); }
  if (bsl) for (let x = -W / 2 + 3.6; x < W / 2 - 1; x += 3.4) for (let z = -D / 2 + 3.4; z < D / 2 - 1; z += 3.2) { k.box('steel', [0.7, 0.05, 0.7], [x, H - 0.02, z]); k.box('perf', [0.6, 0.02, 0.6], [x, H - 0.05, z], { color: 0xdddddd }); }
  // ---- kind-specific ----
  const screens = {}; let anchorSet = {};
  if (bsl) {
    // ceiling utility pipes and ducts
    for (const [x, y] of [[-4, 3.2], [-4.5, 3.05], [2.5, 3.2]]) k.rod('steel', [x, y, Z0 + 0.3], [x, y, Z1 - 0.3], 0.07, { seg: 8 }); k.box('steel', [0.8, 0.4, D - 0.6], [5.0, 3.28, 0]);
    // airlock vestibule (left) : partition with two pressure doors
    const AX = X0 + 3.2;
    k.wall('epoxyGreen', [AX, Z0], [AX, Z1], H, 0.22, { openings: [{ s: 3.3, w: 1.1, h: 2.1 }], color: 0xc8dcd2 });
    k.box('glassTint', [0.05, 1.0, 2.0], [AX, 1.9, Z0 + 1.8]); k.box('steel', [0.1, 1.1, 2.1], [AX, 1.9, Z0 + 1.8]); k.box('glass', [0.06, 0.9, 1.9], [AX, 1.9, Z0 + 1.8]);
    for (const [dx, nm] of [[AX, 'inner'], [X0 + 0.05, 'outer']]) { k.push(dx, 0, Z0 + 3.3 + 0.55, Math.PI / 2); k.box('steel', [1.28, 2.2, 0.28], [0, 1.1, 0.0]); k.box('paintWhite', [1.0, 2.05, 0.14], [0, 1.05, 0.16], { color: 0xe0e8e4 }); k.box('glass', [0.34, 0.34, 0.16], [0, 1.6, 0.17]); k.cyl('chrome', [0.12, 0.12, 0.05], [-0.34, 1.05, 0.28], { rx: Math.PI / 2, seg: 14 }); k.torus('chrome', 0.13, 0.014, [-0.34, 1.05, 0.31], { seg: 14, tseg: 4 }); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.rod('chrome', [-0.34, 1.05, 0.31], [-0.34 + Math.cos(a) * 0.13, 1.05 + Math.sin(a) * 0.13, 0.31], 0.01, { seg: 4 }); } k.box('blackPlastic', [0.2, 0.3, 0.03], [0.62, 1.4, 0.19]); k.box(nm === 'inner' ? green : red, [0.05, 0.05, 0.01], [0.62, 1.48, 0.21]); k.box(nm === 'inner' ? red : green, [0.05, 0.05, 0.01], [0.62, 1.35, 0.21]); k.pop(); }
    k.sign(0.9, 0.9, biohazardSign('BSL-4', 'AUTHORISED ONLY'), [AX + 0.13, 1.7, Z0 + 3.0], { ry: Math.PI / 2, ppm: 150 }); k.sign(0.7, 0.7, biohazardSign('BIOHAZARD', 'LEVEL 4'), [X0 + 0.14, 1.9, Z0 + 4.8], { ry: Math.PI / 2, ppm: 150 });
    k.floorQuad('hazard', 0.6, 1.2, [AX + 0.4, 0.014, Z0 + 3.85], { mirror: false, tile: 1.2 }); k.floorQuad('hazard', 0.6, 1.2, [AX - 0.4, 0.014, Z0 + 3.85], { mirror: false });
    // decon shower in the airlock corner
    k.box('glass', [0.04, 2.3, 1.6], [X0 + 2.2, 1.15, Z0 + 1.0]); k.box('steel', [1.8, 0.06, 1.8], [X0 + 1.2, 2.3, Z0 + 0.9]); for (let i = 0; i < 5; i++) k.sph('chrome', 0.04, [X0 + 0.7 + i * 0.35, 2.26, Z0 + 0.9], { seg: 6 }); k.rod('chrome', [X0 + 0.4, 0.2, Z0 + 0.3], [X0 + 0.4, 2.3, Z0 + 0.3], 0.03, { seg: 6 }); k.cyl('steelDark', [0.3, 0.3, 0.04], [X0 + 1.2, 0.03, Z0 + 0.9], { seg: 18 });
    k.sign(0.7, 0.45, plate('CHEMICAL\nSHOWER', '#c8a010', '#111'), [X0 + 1.0, 2.0, Z0 + 0.14], { ppm: 150 });
    // suits on a hanging rail (right wall)
    k.rod('steel', [X1 - 0.6, 2.35, Z0 + 1.0], [X1 - 0.6, 2.35, Z0 + 5.4], 0.03, { seg: 6 });
    const suits = []; for (let i = 0; i < 4; i++) { const z = Z0 + 1.3 + i * 1.05; ppeSuit(k, X1 - 0.75, z, -Math.PI / 2, [0x2a62c8, 0x2a62c8, 0xc8a020, 0x2a62c8][i]); k.rod('steel', [X1 - 0.75, 2.35, z], [X1 - 0.75, 2.05, z], 0.012, { seg: 4 }); coil(k, [X1 - 0.8, 1.42, z], [X1 - 1.2, 3.1, z + 0.15], 0.07, 7, 0.013); suits.push([X1 - 1.5, 0, z]); }
    k.sign(1.2, 0.3, plate('PRESSURE SUITS - CHECK SEALS', '#c8a010', '#111'), [X1 - 0.14, 2.5, Z0 + 3.2], { ry: -Math.PI / 2, ppm: 150 });
    // glovebox line (centre island)
    glovebox(k, -0.8, -0.3, 4.4, 0); glovebox(k, -0.8, 1.9, 4.4, Math.PI); k.box('steel', [0.2, 0.5, 2.0], [-3.2, 0.6, 0.8]);
    for (const x of [-2.4, 0.3]) { stool(k, x, 0.8, 0.62, { seat: 'blackPlastic' }); }
    // back wall: autoclave, fridges, freezers
    autoclave(k, -3.2, Z0 + 0.8, 0); for (let i = 0; i < 3; i++) fridge(k, 0.4 + i * 0.85, Z0 + 0.5, 0, 0.8, 1.95, i !== 1); for (let i = 0; i < 2; i++) fridge(k, 3.2 + i * 0.95, Z0 + 0.5, 0, 0.9, 1.9, false);
    k.sign(0.8, 0.22, plate('-80 C  ULTRA LOW', '#1d4a8a'), [3.65, 2.15, Z0 + 0.9], { ppm: 140 });
    // right bench: microscopes, centrifuge, PCR, monitors, virus model
    bench(k, X1 - 1.2, Z1 - 3.4, Math.PI / 2, 4.2, 0.8); microscope(k, X1 - 1.2, 0.9, Z1 - 4.6, -Math.PI / 2); microscope(k, X1 - 1.2, 0.9, Z1 - 3.5, -Math.PI / 2); centrifuge(k, X1 - 1.15, 0.9, Z1 - 2.4, -Math.PI / 2); rackTubes(k, X1 - 1.4, 0.9, Z1 - 1.8, 0);
    const mA = monitor(k, X1 - 0.75, 0.9, Z1 - 5.3, -Math.PI / 2, { w: 0.6, name: 'monitorA', draw: (c, w, h, t, S) => drawSequence(c, w, h, t, S, {}), res: [384, 216], fps: 8, k: 1.0 });
    const mB = monitor(k, X1 - 0.75, 0.9, Z1 - 2.9, -Math.PI / 2 - 0.1, { w: 0.6, name: 'monitorB', draw: (c, w, h, t, S) => drawSpectrum(c, w, h, t, S, { theme: 'green' }), res: [384, 216], fps: 8, k: 1.0 });
    screens.monitorA = mA; screens.monitorB = mB;
    virusModel(k, X0 + 5.2, 1.5, Z1 - 1.2); k.cyl('steel', [0.25, 0.3, 0.9], [X0 + 5.2, 0.45, Z1 - 1.2], { seg: 16 }); k.cyl('chrome', [0.12, 0.12, 0.3], [X0 + 5.2, 1.0, Z1 - 1.2], { seg: 12 }); k.sign(0.6, 0.18, plate('SARS-LIKE VIRION  MODEL', '#10305a'), [X0 + 5.2, 0.7, Z1 - 0.88], { ppm: 150 });
    // status screen + wall signage
    const stat = k.screen({ name: 'status', w: 0.9, h: 0.6, draw: drawLabStatus, fps: 4, res: [320, 214], bezel: 0.03, k: 1.0 }, [X0 + 5.6, 1.9, Z0 + 0.14]); screens.status = stat;
    k.sign(0.9, 0.9, biohazardSign('BIOHAZARD', 'CONTAINMENT AREA'), [0.1, 2.0, Z0 + 0.14], { ppm: 150 });
    // misc: eyewash, emergency shower, floor drains, hose reels
    k.cyl('paintYellow', [0.2, 0.2, 0.08], [4.9, 0.0, Z0 + 1.0], { seg: 12 }); k.rod('paintYellow', [4.9, 0.05, Z0 + 1.0], [4.9, 2.4, Z0 + 1.0], 0.025, { seg: 6 }); k.cyl('paintYellow', [0.2, 0.2, 0.06], [4.9, 2.4, Z0 + 1.0], { seg: 12 }); k.rod('paintYellow', [4.9, 2.2, Z0 + 1.0], [4.9, 2.2, Z0 + 1.5], 0.02, {}); k.cyl('chrome', [0.01, 0.01, 0.4], [4.4, 1.0, Z0 + 0.5], { seg: 4 });
    for (const [x, z] of [[-0.8, 0.8], [3.0, 3.5], [-4.2, 3.0]]) { k.cyl('steelDark', [0.12, 0.12, 0.02], [x, 0.012, z], { seg: 12 }); }
    for (let i = 0; i < 2; i++) { const x = 1.0 + i * 3.0; k.cyl('paintYellow', [0.28, 0.28, 0.14], [x, 3.25, 0.4], { seg: 14, rx: Math.PI / 2 }); coil(k, [x, 3.2, 0.4], [x + 0.3, 1.2, 1.2], 0.09, 6, 0.014); }
    k.rod('steel', [X0 + 4.1, 0.2, Z1 - 0.3], [X0 + 4.1, 2.5, Z1 - 0.3], 0.03, { seg: 6 });
    k.cyl(k.glow(0xff2a20, 2.8), [0.08, 0.08, 0.12], [AX - 0.05, 2.6, Z0 + 3.3 + 0.55], { seg: 10 }); // beacon above inner door
    anchorSet = { scientistA: [[-2.2, 0, 0.62], Math.PI], scientistB: [[0.3, 0, 1.4], 0], suit0: [suits[0], Math.PI / 2], suit1: [suits[1], Math.PI / 2], suit2: [suits[2], Math.PI / 2], suit3: [suits[3], Math.PI / 2], airlockIn: [[X0 + 1.6, 0, Z0 + 3.8], -Math.PI / 2], airlockInner: [[AX + 0.7, 0, Z0 + 3.85], Math.PI / 2], bench: [[X1 - 2.0, 0, Z1 - 3.4], Math.PI / 2], virusModel: [[X0 + 5.2, 0, Z1 - 2.2], Math.PI], fridges: [[1.4, 0, Z0 + 2.0], 0], autoclave: [[-3.2, 0, Z0 + 2.2], 0],
      camWide: [[1.6, 1.9, Z1 - 0.6], Math.PI + 0.12], camGlovebox: [[-0.8, 1.45, 3.9], Math.PI], camFridges: [[1.5, 1.6, 1.2], Math.PI], camSuits: [[X1 - 4.0, 1.5, Z0 + 3.5], Math.PI / 2], camVirus: [[X0 + 5.0, 1.5, 0.6], 0.2], camAirlock: [[X0 + 4.2, 1.5, Z1 - 4], -2.3], camHigh: [[-5.5, 2.9, Z1 - 0.5], Math.PI + 0.45] };
  } else {
    // ---------- virology / research ----------
    const side = vir ? 'paintBlue' : 'paintGreen';
    k.box(vir ? 'paintBlue' : 'paintGreen', [W - 0.5, 0.14, 0.04], [0, 1.4, Z0 + 0.15]);
    for (const [x, z, ry, len] of [[-1.2, Z0 + 0.5, 0, 6.5], [X0 + 0.5, -0.5, Math.PI / 2, 5.2], [X1 - 0.5, -0.5, -Math.PI / 2, 5.2]]) bench(k, x, z, ry, len, 0.75, 0.92, { top: 'blackPlastic' });
    for (const [x, z, ry, len] of [[-1.2, Z0 + 0.5, 0, 6.5]]) for (let i = 0; i < 2; i++) { k.push(x, 1.6, z + 0.05, ry); k.box('paintWhite', [len / 2 - 0.1, 0.03, 0.3], [(i - 0.5) * (len / 2), 0.0, 0], {}); k.box('paintWhite', [len / 2 - 0.1, 0.5, 0.02], [(i - 0.5) * (len / 2), 0.25, -0.15]); k.pop(); }
    // island bench with stools
    bench(k, 0.6, 0.9, 0, 4.2, 1.2, 0.92, { top: res ? 'steel' : 'blackPlastic' }); k.box('paintDark', [4.2, 0.55, 0.02], [0.6, 1.2, 0.9]); for (let i = 0; i < 3; i++) k.box('steel', [0.5, 0.015, 0.25], [-0.8 + i * 1.4, 1.5, 0.9]);
    for (let i = 0; i < 4; i++) labStool(k, -1.0 + i * 1.2, 2.0);
    // equipment on benches
    microscope(k, -3.6, 0.92, Z0 + 0.5, Math.PI); microscope(k, -2.9, 0.92, Z0 + 0.5, Math.PI); centrifuge(k, -1.4, 0.92, Z0 + 0.5, 0); centrifuge(k, -0.6, 0.92, Z0 + 0.5, 0.2, true); rackTubes(k, 0.7, 0.92, Z0 + 0.4, 0); rackTubes(k, 1.4, 0.92, Z0 + 0.4, 0.3, 3, 6); flasks(k, 2.2, 0.92, Z0 + 0.45, 4); flasks(k, 1.6, 0.92, 0.9, 3); flasks(k, -0.2, 0.92, 0.9, 4); rackTubes(k, 2.3, 0.92, 0.9, 0, 4, 10);
    const feedA = k.feed('labSeq', (c, w, h, t, S) => drawSequence(c, w, h, t, S, {}), { res: [256, 144], fps: 6 }); const feedB = k.feed('labTel', (c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { rows: 3 }), { res: [256, 144], fps: 6 });
    const m1 = monitor(k, X0 + 0.6, 0.92, -0.5, Math.PI / 2, { w: 0.58, name: 'monitorA', draw: (c, w, h, t, S) => drawSequence(c, w, h, t, S, {}), res: [384, 216], fps: 8, k: 1.0 });
    const m2 = monitor(k, X0 + 0.6, 0.92, -2.0, Math.PI / 2 - 0.1, { w: 0.58, name: 'monitorB', draw: (c, w, h, t, S) => drawSpectrum(c, w, h, t, S, { theme: 'green' }), res: [384, 216], fps: 8, k: 1.0 });
    const m3 = monitor(k, X1 - 0.6, 0.92, 0.6, -Math.PI / 2, { w: 0.58, name: 'monitorC', draw: (c, w, h, t, S) => drawDataScroll(c, w, h, t, S, { theme: 'cyan' }), res: [384, 216], fps: 8, k: 1.0 });
    screens.monitorA = m1; screens.monitorB = m2; screens.monitorC = m3; keyboard(k, X0 + 0.9, 0.92, -0.5, Math.PI / 2); keyboard(k, X1 - 0.9, 0.92, 0.6, -Math.PI / 2);
    mug(k, -3.2, 0.92, 1.0); papers(k, 0.4, 0.92, 1.2, 0.3, 3); tablet(k, 1.9, 0.93, 1.1, 0.2);
    // hoods, BSCs, incubators, fridges
    if (vir) { bsc(k, 3.6, Z0 + 0.6, 0, 1.4); bsc(k, 5.0, Z0 + 0.6, 0, 1.4); fumeHood(k, X1 - 0.6, 3.2, -Math.PI / 2, 1.5); incubator(k, X1 - 0.5, -3.6, -Math.PI / 2, 1.1); incubator(k, X1 - 0.5, -2.7, -Math.PI / 2, 1.1); fridge(k, X0 + 0.5, -3.9, Math.PI / 2, 0.8, 1.95); fridge(k, X0 + 0.5, 3.3, Math.PI / 2, 0.9, 1.9, false); virusModel(k, X1 - 0.9, 1.35, 1.5, 0.3); k.cyl('steel', [0.15, 0.2, 0.43], [X1 - 0.9, 0.92 + 0.0, 1.5], { seg: 12, y: 0 }); }
    else { fumeHood(k, 3.7, Z0 + 0.6, 0, 1.6); fumeHood(k, 5.4, Z0 + 0.6, 0, 1.6); incubator(k, X1 - 0.5, -3.6, -Math.PI / 2, 1.1); fridge(k, X0 + 0.5, -3.9, Math.PI / 2, 0.8, 1.95); fridge(k, X0 + 0.5, 3.3, Math.PI / 2, 0.9, 1.9, false); dnaHelix(k, X1 - 1.1, 1.0, 1.6, 1.2, 0.15, 3); k.cyl('steel', [0.2, 0.25, 0.12], [X1 - 1.1, 0.96, 1.6], { seg: 14 });
      gasCyl(k, X1 - 0.4, 3.3, 0x3a6aa8); gasCyl(k, X1 - 0.4, 3.6, 0xc8a030); gasCyl(k, X1 - 0.4, 3.9, 0x4a8a50); k.rod('steel', [X1 - 0.5, 0.4, 3.2], [X1 - 0.5, 0.4, 4.2], 0.02, {}); }
    for (let i = 0; i < 2; i++) sink(k, -3.0 + i * 6.0, 0.94, Z0 + 0.5, 0);
    // whiteboards + clock + signs
    const wb = whiteboard(k, X0 + 0.14, 1.9, 2.8, Math.PI / 2, 2.4, 1.3, formulaBoard(11)); whiteboard(k, 2.0, 2.1, Z1 - 0.14, Math.PI, 2.4, 1.3, formulaBoard(23));
    wallClock(k, X1 - 0.14, 2.7, 2.5, -Math.PI / 2, 0.2);
    k.sign(0.5, 0.5, biohazardSign('BSL-2'), [X1 - 0.14, 2.0, -2.2], { ry: -Math.PI / 2, ppm: 140 }); k.sign(0.8, 0.25, plate(vir ? 'VIROLOGY  UNIT 3' : 'RESEARCH  LAB  2B', '#1d4a8a'), [-3.0, 2.5, Z0 + 0.14], { ppm: 140 });
    door(k, X1 - 0.1, Z1 - 1.5, -Math.PI / 2, 1.0, 2.1, { mat: 'paintWhite' }); k.sign(0.4, 0.14, plate('EXIT', '#1a7a3a'), [X1 - 0.16, 2.35, Z1 - 1.5], { ry: -Math.PI / 2, ppm: 160, glow: false });
    if (res) { // daylight window wall (right side behind bench) with blinds
      k.box('steel', [0.1, 1.6, 6.0], [X0 + 0.14, 1.9, -2.5 + 0], { }); k.box(k.glow(0xcfe4ff, 1.4), [0.04, 1.5, 5.8], [X0 + 0.2, 1.9, -2.5], { mirror: false }); for (let i = 0; i <= 6; i++) k.box('steel', [0.12, 1.65, 0.05], [X0 + 0.14, 1.9, -5.4 + i * 1.0 + 0.4]);
      for (let i = 0; i < 12; i++) k.box('paintWhite', [0.03, 0.04, 5.8], [X0 + 0.28, 2.6 - i * 0.13, -2.5], { color: 0xe8e8e0 });
    }
    anchorSet = { scientistA: [[-2.0, 0, 1.8], Math.PI], scientistB: [[1.0, 0, -0.3], Math.PI], scientistC: [[2.6, 0, 1.8], Math.PI], bench: [[-1.5, 0, Z0 + 1.6], Math.PI], hood: [[4.0, 0, Z0 + 1.5], Math.PI], whiteboard: [[X0 + 1.5, 0, 2.8], Math.PI / 2], monitor: [[X0 + 1.6, 0, -0.5], Math.PI / 2], dna: [[X1 - 2.0, 0, 1.6], -Math.PI / 2], door: [[X1 - 1.5, 0, Z1 - 1.5], -Math.PI / 2],
      camWide: [[0.5, 1.9, Z1 - 0.7], Math.PI], camBench: [[-1.0, 1.5, 1.0], Math.PI - 0.3], camIsland: [[0.6, 1.4, 3.4], Math.PI], camHood: [[3.7, 1.5, 1.4], Math.PI], camWhiteboard: [[X0 + 3.2, 1.6, 1.8], Math.PI / 2 + 0.3], camHigh: [[-4.8, 2.9, Z1 - 0.5], Math.PI + 0.5] };
  }
  for (const [n, [p, yaw]] of Object.entries(anchorSet)) k.anchor(n, p, yaw);
  // lighting
  const hemi = new THREE.HemisphereLight(bsl ? 0xd8ecff : 0xfff6ee, 0x303840, bsl ? 1.8 : 1.7); k.light(hemi, 'hemi');
  const L1 = new THREE.PointLight(bsl ? 0xe8f4ff : 0xfff2e0, 38, 18, 1.5); L1.position.set(0, H - 0.5, 0); k.light(L1, 'ceilA');
  if (bsl) { const L2 = new THREE.PointLight(0xff4030, 6, 6, 1.6); L2.position.set(X0 + 3.2, 2.6, Z0 + 3.9); k.light(L2, 'beacon'); }
  const set = k.api({ kind, screen: screens.monitorA || null, bounds: { w: W, d: D, h: H } });
  return set;
}
