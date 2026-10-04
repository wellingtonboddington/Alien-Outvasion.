// Reusable props for the institutional sets. Every function builds into a Kit using the current matrix frame.
import * as THREE from 'three';
import { TAU, RNG, seg } from '../../../engine/common.js';
import { SANS, MONO } from './draw.js';

// ---------- geometry helpers ----------
/** curved slab (annular sector) around the Y axis. angles measured from +Z toward +X. uvs in metres. */
export function arcSlabGeo(r0, r1, a0, a1, y0, y1, steps = 18, o = {}) {
  const P = [], N = [], U = [], I = [];
  const v = (x, y, z, nx, ny, nz, u, w) => { P.push(x, y, z); N.push(nx, ny, nz); U.push(u, w); return P.length / 3 - 1; };
  const quad = (a, b, c, d, n) => {
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    if (dot >= 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
  };
  const rm = (r0 + r1) / 2; const A = (i) => a0 + (a1 - a0) * i / steps;
  const strip = (fn, n) => { let prev = null; for (let i = 0; i <= steps; i++) { const cur = fn(i); if (prev) quad(prev[0], prev[1], cur[1], cur[0], n(i)); prev = cur; } };
  if (o.top !== false) strip((i) => { const a = A(i), s = Math.sin(a), c = Math.cos(a), u = a * rm; return [v(r0 * s, y1, r0 * c, 0, 1, 0, u, r0), v(r1 * s, y1, r1 * c, 0, 1, 0, u, r1)]; }, () => [0, 1, 0]);
  if (o.bottom !== false) strip((i) => { const a = A(i), s = Math.sin(a), c = Math.cos(a), u = a * rm; return [v(r0 * s, y0, r0 * c, 0, -1, 0, u, r0), v(r1 * s, y0, r1 * c, 0, -1, 0, u, r1)]; }, () => [0, -1, 0]);
  if (o.outer !== false) strip((i) => { const a = A(i), s = Math.sin(a), c = Math.cos(a), u = a * r1; return [v(r1 * s, y0, r1 * c, s, 0, c, u, y0), v(r1 * s, y1, r1 * c, s, 0, c, u, y1)]; }, (i) => [Math.sin(A(i)), 0, Math.cos(A(i))]);
  if (o.inner !== false) strip((i) => { const a = A(i), s = Math.sin(a), c = Math.cos(a), u = a * r0; return [v(r0 * s, y0, r0 * c, -s, 0, -c, u, y0), v(r0 * s, y1, r0 * c, -s, 0, -c, u, y1)]; }, (i) => [-Math.sin(A(i)), 0, -Math.cos(A(i))]);
  if (o.caps !== false) for (const [a, sg] of [[a0, -1], [a1, 1]]) {
    const s = Math.sin(a), c = Math.cos(a), tx = c * sg, tz = -s * sg;
    const q = [v(r0 * s, y0, r0 * c, tx, 0, tz, r0, y0), v(r1 * s, y0, r1 * c, tx, 0, tz, r1, y0), v(r1 * s, y1, r1 * c, tx, 0, tz, r1, y1), v(r0 * s, y1, r0 * c, tx, 0, tz, r0, y1)]; quad(q[0], q[1], q[2], q[3], [tx, 0, tz]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.userData.uvMetres = true; return g;
}
export const arcSlab = (k, m, r0, r1, a0, a1, y0, y1, pos = [0, 0, 0], o = {}) => k.part(m, arcSlabGeo(r0, r1, a0, a1, y0, y1, o.steps || 20, o), pos, o);
/** point on arc about center (cx,cz) */
export const arcPt = (cx, cz, r, a) => [cx + Math.sin(a) * r, cz + Math.cos(a) * r];

/** catenary-ish cable between two points with sag */
export function cable(k, a, b, r = 0.012, sag = 0.3, m = 'blackMatte', o = {}) {
  const n = 7, pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]); }
  return k.tubeAlong(m, pts, r, { seg: 4, perPoint: 3, ...o });
}

// ---------- seating ----------
/** swivel office/anchor chair facing +Z. o: {seat, frame, arms, tall, color} */
export function chair(k, x, z, ry = 0, o = {}) {
  const seat = o.seat || 'leather', fr = o.frame || 'chrome', h = o.h ?? 0.48;
  k.push(x, o.y || 0, z, ry);
  k.cyl(fr, [0.03, 0.04, h - 0.1], [0, 0.1 + (h - 0.1) / 2, 0], { seg: 8 });
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; const ex = Math.sin(a) * 0.3, ez = Math.cos(a) * 0.3; k.rod(fr, [0, 0.1, 0], [ex, 0.06, ez], 0.02, { seg: 5 }); k.cyl('blackMatte', [0.03, 0.03, 0.05], [ex, 0.035, ez], { seg: 8 }); }
  k.rbox(seat, [0.5, 0.09, 0.5], [0, h, 0.02], { r: 0.035, color: o.color });
  k.rbox(seat, [0.46, o.tall ? 0.78 : 0.56, 0.08], [0, h + (o.tall ? 0.42 : 0.33), -0.23], { r: 0.035, rx: -0.12, color: o.color });
  if (o.arms !== false) for (const sx of [-1, 1]) { k.box(fr, [0.03, 0.2, 0.03], [sx * 0.27, h + 0.12, -0.02], {}); k.rbox('blackPlastic', [0.06, 0.04, 0.3], [sx * 0.27, h + 0.23, 0.02], { r: 0.015 }); }
  k.pop(); k.blob(x, z, 0.8, 0.8, 0.007);
}
/** upholstered delegate / theatre chair */
export function stallChair(k, x, y, z, ry, o = {}) {
  k.push(x, y, z, ry);
  k.rbox(o.mat || 'fabricBlue', [0.5, 0.08, 0.46], [0, 0.45, 0.02], { r: 0.03 });
  k.rbox(o.mat || 'fabricBlue', [0.48, 0.52, 0.08], [0, 0.78, -0.22], { r: 0.035, rx: -0.1 });
  k.box('blackPlastic', [0.06, 0.45, 0.06], [0, 0.22, -0.1]); k.box('blackPlastic', [0.4, 0.03, 0.4], [0, 0.015, -0.05]);
  k.pop();
}
export function stool(k, x, z, h = 0.65, o = {}) {
  k.push(x, 0, z, 0); k.cyl(o.seat || 'leather', [0.19, 0.18, 0.06], [0, h, 0], { seg: 14 }); k.cyl('chrome', [0.025, 0.025, h - 0.05], [0, h / 2, 0], { seg: 8 });
  k.cyl('chrome', [0.2, 0.22, 0.025], [0, 0.015, 0], { seg: 14 }); k.torus('chrome', 0.16, 0.012, [0, h * 0.4, 0], { rx: Math.PI / 2, tseg: 4, seg: 14 }); k.pop();
}
/** stainless lab stool / bench stool */
export function labStool(k, x, z, h = 0.68) { stool(k, x, z, h, { seat: 'blackPlastic' }); }

// ---------- electronics ----------
/** monitor on a stand; returns the Screen. w,h = visible diagonal-ish size in m */
export function monitor(k, x, y, z, ry, o = {}) {
  const w = o.w ?? 0.6, h = o.h ?? w * 0.5625; const bz = 0.025;
  k.push(x, y, z, ry, o.rx || 0);
  k.box('blackPlastic', [w + 0.03, h + 0.03, bz], [0, h / 2 + (o.lift ?? 0.12), -bz / 2 - 0.001]);
  const s = k.screen({ name: o.name || 'monitor', w, h, feed: o.feed, draw: o.draw, fps: o.fps || 6, res: o.res, k: o.k ?? 1.0 }, [0, h / 2 + (o.lift ?? 0.12), 0.002]);
  if (o.stand !== false) { k.box('blackPlastic', [0.04, (o.lift ?? 0.12) + 0.02, 0.025], [0, (o.lift ?? 0.12) / 2, -0.04]); k.box('blackPlastic', [0.24, 0.012, 0.16], [0, 0.006, -0.03], { }); }
  k.pop(); return s;
}
export function laptop(k, x, y, z, ry, o = {}) {
  k.push(x, y, z, ry); k.box('gunmetal', [0.32, 0.015, 0.22], [0, 0.0075, 0]); k.box('blackPlastic', [0.28, 0.002, 0.1], [0, 0.0165, 0.03]);
  k.push(0, 0.012, -0.108, 0, -0.2); k.box('gunmetal', [0.32, 0.21, 0.01], [0, 0.105, 0]);
  const s = k.screen({ name: o.name || 'laptop', w: 0.29, h: 0.18, feed: o.feed, draw: o.draw, fps: o.fps || 6, k: 0.95 }, [0, 0.105, 0.006]); k.pop(); k.pop(); return s;
}
export function keyboard(k, x, y, z, ry, w = 0.44) { k.push(x, y, z, ry); k.rbox('blackPlastic', [w, 0.02, 0.15], [0, 0.01, 0], { r: 0.006, s: 1 }); k.box('greyPlastic', [w - 0.03, 0.004, 0.11], [0, 0.021, 0]); k.pop(); }
export function mug(k, x, y, z, hex = 0xf0f0f0) { k.cyl('whitePlastic', [0.04, 0.035, 0.09], [x, y + 0.045, z], { seg: 10, color: hex }); k.torus('whitePlastic', 0.025, 0.006, [x + 0.045, y + 0.045, z], { seg: 8, tseg: 4, rz: 0, arc: Math.PI * 2, color: hex }); }
export function papers(k, x, y, z, ry = 0, n = 1) { for (let i = 0; i < n; i++) k.box('paintWhite', [0.21, 0.004, 0.297], [x + (i % 2) * 0.02, y + 0.003 + i * 0.004, z + i * 0.01], { ry: ry + i * 0.18, color: 0xf2f0ea }); }
export function tablet(k, x, y, z, ry, hex = 0x202428) { k.box('blackPlastic', [0.24, 0.009, 0.17], [x, y + 0.005, z], { ry }); k.box(k.glow(0x6aa8d8, 1.4), [0.2, 0.002, 0.14], [x, y + 0.0105, z], { ry }); }
export function bottle(k, x, y, z, hex = 0x9ad8f0, h = 0.22) { k.cyl('glass', [0.032, 0.036, h], [x, y + h / 2, z], { seg: 10, color: hex }); k.cyl('blackPlastic', [0.014, 0.018, 0.04], [x, y + h + 0.02, z], { seg: 8 }); }
/** gooseneck desk microphone */
export function deskMic(k, x, y, z, ry = 0) { k.push(x, y, z, ry); k.cyl('blackMatte', [0.05, 0.055, 0.02], [0, 0.01, 0], { seg: 12 }); k.rod('chrome', [0, 0.02, 0], [0, 0.18, 0.02], 0.007, { seg: 5 }); k.rod('chrome', [0, 0.18, 0.02], [0, 0.26, 0.09], 0.007, { seg: 5 }); k.cyl('blackMatte', [0.014, 0.014, 0.07], [0, 0.265, 0.1], { seg: 8, rx: 1.2 }); k.pop(); }
export function headset(k, x, y, z, ry = 0) { k.push(x, y, z, ry); k.torus('blackPlastic', 0.085, 0.008, [0, 0.07, 0], { rx: 0.0, arc: Math.PI, ry: 0, tseg: 4, seg: 12, rz: 0 }); k.cyl('blackPlastic', [0.04, 0.04, 0.03], [-0.085, 0.05, 0], { seg: 10, rz: Math.PI / 2 }); k.cyl('blackPlastic', [0.04, 0.04, 0.03], [0.085, 0.05, 0], { seg: 10, rz: Math.PI / 2 }); k.pop(); }

// ---------- desks / tables ----------
export function desk(k, x, z, ry, w, d, h = 0.75, o = {}) {
  k.push(x, 0, z, ry);
  k.box(o.top || 'wood', [w, 0.045, d], [0, h - 0.0225, 0]);
  if (o.panels !== false) { for (const sx of [-1, 1]) k.box(o.frame || 'paintDark', [0.04, h - 0.045, d - 0.1], [sx * (w / 2 - 0.05), (h - 0.045) / 2, 0]); k.box(o.frame || 'paintDark', [w - 0.1, h * 0.55, 0.025], [0, h * 0.62, -d / 2 + 0.07]); }
  k.pop();
}
export function plant(k, x, z, s = 1, o = {}) {
  k.push(x, 0, z, 0, 0, 0, s); k.cyl('concrete', [0.22, 0.17, 0.4], [0, 0.2, 0], { seg: 12 }); k.cyl('dirt', [0.2, 0.2, 0.02], [0, 0.39, 0], { seg: 10 });
  const r = new RNG(Math.round(x * 100 + z * 10)); const leaf = new THREE.PlaneGeometry(0.16, 0.5, 1, 3); leaf.translate(0, 0.25, 0); const p = leaf.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, y * y * 0.4); p.setX(i, p.getX(i) * (1 - y * 0.6)); } leaf.computeVertexNormals();
  k.mat('paintGreen');
  for (let i = 0; i < 18; i++) { const a = r.range(0, TAU), tilt = r.range(0.2, 0.9); k.part('paintGreen', leaf, [0, 0.4, 0], { ry: a, rx: -tilt, scale: r.range(0.9, 1.6), color: r.pick([0x2a6a38, 0x347a40, 0x1f5a30]), sy: 1.2 }); }
  k.pop();
}

// ---------- lighting hardware ----------
/** rectangular soft-box / panel light: emissive face + frame. face faces down (-Y) by default; rotate with o.rx */
export function lightPanel(k, x, y, z, w, d, hex = 0xfff4e0, kInt = 2.2, o = {}) {
  k.push(x, y, z, o.ry || 0, o.rx || 0);
  k.box(o.frame || 'blackPlastic', [w + 0.08, 0.06, d + 0.08], [0, 0.03, 0]); k.box(k.glow(hex, kInt), [w, 0.02, d], [0, -0.004, 0], {});
  k.pop();
}
// k.glow() returns a name; keep helper for call sites
export function glowBox(k, hex, kInt, size, pos, o = {}) { return k.box(k.glow(hex, kInt), size, pos, o); }
/** theatrical spot fixture hanging from y_top, aimed along -Y tilted by tilt toward heading */
export function spotFixture(k, x, y, z, ry = 0, tilt = 0.5, o = {}) {
  k.push(x, y, z, ry, 0);
  k.cyl('blackMatte', [0.015, 0.015, o.drop ?? 0.4], [0, (o.drop ?? 0.4) / 2, 0], { seg: 5 }); k.box('blackMatte', [0.16, 0.05, 0.2], [0, 0, 0]);
  k.push(0, -0.1, 0, 0, tilt);
  k.cyl('blackMatte', [0.12, 0.09, 0.3], [0, -0.1, 0], { seg: 12 }); k.cyl(k.glow(o.hex || 0xfff0d8, o.k || 3), [0.1, 0.1, 0.01], [0, -0.25, 0], { seg: 12 });
  k.pop(); k.pop();
}
/** pipe-grid light truss. x0..x1 / z0..z1 at height y */
export function trussGrid(k, x0, x1, z0, z1, y, nx = 6, nz = 5, o = {}) {
  const m = o.mat || 'blackMatte', r = o.r || 0.035;
  for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx; k.rod(m, [x, y, z0], [x, y, z1], r, { seg: 6 }); }
  for (let j = 0; j <= nz; j++) { const z = z0 + (z1 - z0) * j / nz; k.rod(m, [x0, y - 0.1, z], [x1, y - 0.1, z], r, { seg: 6 }); }
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) k.box(m, [0.08, 0.1, 0.08], [x0 + (x1 - x0) * i / nx, y - 0.05, z0 + (z1 - z0) * j / nz]);
}

// ---------- flags ----------
const FLAG_PAL = [['#c8202a', '#f4f4f4', '#1a3a8a'], ['#0a6a3a', '#f4f4f4', '#d8b020'], ['#1a3a8a', '#f4d020', '#f4f4f4'], ['#202020', '#c8202a', '#f4d020'], ['#f4f4f4', '#c8202a', '#102a6a'], ['#0e7a8a', '#f4f4f4', '#c8202a'], ['#d8601a', '#f4f4f4', '#0a6a3a'], ['#6a1a7a', '#f4d020', '#f4f4f4'], ['#a01a2a', '#102a6a', '#f4f4f4'], ['#f4d020', '#0a6a3a', '#c8202a']];
/** draw procedural (fictional) flag number i */
export function flagDraw(i) {
  return (ctx, w, h) => {
    const r = new RNG(900 + i * 17), pal = FLAG_PAL[i % FLAG_PAL.length], kind = Math.floor(i / FLAG_PAL.length + r.int(0, 5)) % 7;
    const [a, b, c] = pal; ctx.fillStyle = a; ctx.fillRect(0, 0, w, h);
    const star = (x, y, R, col) => { ctx.fillStyle = col; ctx.beginPath(); for (let q = 0; q < 10; q++) { const rr = q % 2 ? R * 0.4 : R, an = -Math.PI / 2 + q * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); };
    if (kind === 0) { ctx.fillStyle = b; ctx.fillRect(0, h / 3, w, h / 3); ctx.fillStyle = c; ctx.fillRect(0, h * 2 / 3, w, h / 3); }
    else if (kind === 1) { ctx.fillStyle = b; ctx.fillRect(w / 3, 0, w / 3, h); ctx.fillStyle = c; ctx.fillRect(w * 2 / 3, 0, w / 3, h); }
    else if (kind === 2) { ctx.fillStyle = b; ctx.fillRect(w * 0.28, 0, w * 0.16, h); ctx.fillRect(0, h * 0.42, w, h * 0.16); ctx.fillStyle = c; ctx.fillRect(w * 0.32, 0, w * 0.08, h); ctx.fillRect(0, h * 0.46, w, h * 0.08); }
    else if (kind === 3) { ctx.fillStyle = b; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.16, 0, TAU); ctx.fill(); }
    else if (kind === 4) { ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill(); star(w * 0.25, h * 0.7, h * 0.14, c); }
    else if (kind === 5) { for (let q = 0; q < 7; q++) { ctx.fillStyle = q % 2 ? b : a; ctx.fillRect(0, q * h / 7, w, h / 7); } ctx.fillStyle = c; ctx.fillRect(0, 0, w * 0.42, h * 4 / 7); for (let q = 0; q < 12; q++) star(w * (0.06 + (q % 4) * 0.1), h * (0.07 + Math.floor(q / 4) * 0.15), h * 0.045, '#f4f4f4'); }
    else { ctx.fillStyle = b; ctx.fillRect(0, 0, w, h / 2); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.4, h / 2); ctx.lineTo(0, h); ctx.fill(); star(w * 0.14, h / 2, h * 0.12, '#f4f4f4'); }
    // cloth shading
    const g = ctx.createLinearGradient(0, 0, w, 0); for (let q = 0; q <= 8; q++) g.addColorStop(q / 8, `rgba(0,0,0,${0.0 + 0.16 * (q % 2)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
}
/** draped / hanging flag on pole. kind 'pole': standing pole with flag at top; 'hang': vertical-hanging banner against wall */
export function flag(k, x, y, z, ry, idx, o = {}) {
  const w = o.w ?? 1.5, h = o.h ?? 1.0, amp = o.amp ?? 0.07, seed = idx * 1.3;
  k.push(x, y, z, ry);
  if (o.pole !== false) { k.cyl('chrome', [0.018, 0.022, o.poleH ?? 2.9], [0, (o.poleH ?? 2.9) / 2, 0], { seg: 8 }); k.sph('gold', 0.035, [0, (o.poleH ?? 2.9) + 0.02, 0], { seg: 8 }); if (o.base !== false) k.cyl('blackPlastic', [0.16, 0.19, 0.06], [0, 0.03, 0], { seg: 12 }); }
  const fy = (o.poleH ?? 2.9) - h / 2 - 0.12;
  k.sign(w, h, flagDraw(idx), [w / 2 + 0.02, fy, 0.0], { ppm: 90, ws: 14, hs: 4, deform: (g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + w / 2) / w; p.setZ(i, Math.sin(u * 7.5 + seed) * amp * (0.15 + u) + Math.sin(p.getY(i) * 4 + seed) * amp * 0.25 * u); p.setY(i, p.getY(i) - u * 0.08 * h); } g.computeVertexNormals(); } });
  k.pop();
}

// ---------- structural bits ----------
export function door(k, x, z, ry, w = 1.0, h = 2.1, o = {}) {
  k.push(x, 0, z, ry);
  k.box(o.frame || 'steel', [w + 0.14, h + 0.07, 0.14], [0, (h + 0.07) / 2, 0], { tile: 1 });
  k.box(o.mat || 'paintGrey', [w - 0.04, h - 0.04, 0.05], [0, h / 2, 0.012]);
  if (o.window !== false) k.box('glassTint', [0.26, 0.5, 0.06], [0, h * 0.7, 0.012]);
  k.box('chrome', [0.14, 0.025, 0.04], [w / 2 - 0.12, h * 0.46, 0.05]);
  k.pop();
}
export function ceilingPipe(k, a, b, r = 0.06, m = 'steel') { k.rod(m, a, b, r, { seg: 8 }); }
export function vent(k, x, y, z, ry, w = 0.6, h = 0.3) { k.push(x, y, z, ry); k.box('steelDark', [w + 0.05, h + 0.05, 0.03], [0, 0, 0]); for (let i = 0; i < 5; i++) k.box('blackMatte', [w, 0.012, 0.035], [0, -h / 2 + 0.04 + i * (h - 0.06) / 4, 0.006]); k.pop(); }
export function wallClock(k, x, y, z, ry, r = 0.22) { k.push(x, y, z, ry); k.cyl('chrome', [r + 0.02, r + 0.02, 0.04], [0, 0, 0], { rx: Math.PI / 2, seg: 20 }); k.cyl('paintWhite', [r, r, 0.045], [0, 0, 0.003], { rx: Math.PI / 2, seg: 20 }); k.box('blackMatte', [0.012, r * 0.8, 0.01], [0, r * 0.35, 0.03], { rz: 0.5 }); k.box('blackMatte', [0.01, r * 0.9, 0.01], [0, r * 0.4, 0.034], { rz: -0.9 }); k.pop(); }
export function whiteboard(k, x, y, z, ry, w = 2.0, h = 1.2, draw = null) {
  k.push(x, y, z, ry); k.box('steel', [w + 0.08, h + 0.08, 0.04], [0, 0, -0.02]); k.box('whitePlastic', [w, h, 0.01], [0, 0, 0.0]);
  if (draw) k.sign(w - 0.02, h - 0.02, draw, [0, 0, 0.007], { ppm: 150 }); k.box('steel', [w * 0.8, 0.03, 0.05], [0, -h / 2 - 0.02, 0.02]); k.pop();
}
export function crate(k, x, z, s = 0.6, ry = 0, m = 'wood', y = 0) { k.box(m, [s, s * 0.8, s * 0.7], [x, y + s * 0.4, z], { ry }); k.box('steelDark', [s + 0.01, 0.03, s * 0.7 + 0.01], [x, y + s * 0.15, z], { ry }); k.box('steelDark', [s + 0.01, 0.03, s * 0.7 + 0.01], [x, y + s * 0.65, z], { ry }); }
export function barrel(k, x, z, hex = 0x3a5a8a, h = 0.9, y = 0) { k.cyl('paintBlue', [0.29, 0.29, h], [x, y + h / 2, z], { seg: 16, color: hex }); for (const f of [0.2, 0.5, 0.8]) k.torus('steelDark', 0.295, 0.015, [x, y + h * f, z], { rx: Math.PI / 2, seg: 16, tseg: 4 }); }
export function sandbags(k, x0, z0, x1, z1, rows = 4, o = {}) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz) - Math.PI / 2, n = Math.ceil(L / 0.5); const rng = new RNG(Math.round(x0 * 7 + z0 * 13)); const bag = new THREE.CapsuleGeometry(0.11, 0.3, 3, 8); bag.rotateZ(Math.PI / 2); bag.scale(1, 0.62, 1.15);
  k.mat('sandbag');
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const t = (i + 0.5 + (r % 2) * 0.5) / n; if (t > 1) continue; k.part('sandbag', bag, [x0 + dx * t + rng.range(-0.02, 0.02), 0.09 + r * 0.17, z0 + dz * t + rng.range(-0.02, 0.02)], { ry: ry + rng.range(-0.06, 0.06), sx: 1.2 }); }
}
export function stairs(k, x, y0, z, w, steps, rise, run, dir = 1, m = 'concrete', o = {}) { for (let i = 0; i < steps; i++) k.box(m, [w, rise * (i + 1), run], [x, y0 + rise * (i + 1) / 2, z + dir * run * (i + 0.5)], { color: o.color }); }
export function railing(k, a, b, h = 1.0, o = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.max(2, Math.round(L / (o.post || 1.2))), y0 = o.y || 0;
  const m = o.mat || 'steel';
  k.rod(m, [a[0], y0 + h, a[1]], [b[0], y0 + h, b[1]], 0.025, { seg: 6 }); k.rod(m, [a[0], y0 + h * 0.5, a[1]], [b[0], y0 + h * 0.5, b[1]], 0.015, { seg: 5 });
  for (let i = 0; i <= n; i++) { const t = i / n; k.cyl(m, [0.02, 0.02, h], [a[0] + dx * t, y0 + h / 2, a[1] + dz * t], { seg: 6 }); }
  if (o.glass) k.box('glass', [L, h * 0.8, 0.02], [a[0] + dx / 2, y0 + h * 0.5, a[1] + dz / 2], { ry: Math.atan2(-dz, dx) });
}
/** floor-standing vertical LED tower / sign column with emissive face */
export function ledColumn(k, x, z, h, w, hex, kInt = 2, o = {}) { k.box('blackPlastic', [w + 0.06, h, w + 0.06], [x, h / 2, z], { ry: o.ry || 0 }); k.push(x, 0, z, o.ry || 0); k.box(k.glow(hex, kInt), [w * 0.7, h - 0.2, 0.01], [0, h / 2, w / 2 + 0.032]); k.pop(); }
export { SANS, MONO };
