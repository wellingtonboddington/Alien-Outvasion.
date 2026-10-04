// Architectural building blocks for landmarks (columns, arched walls, domes, crenellations, balustrades...).
import * as THREE from 'three';
import { RNG } from '../../engine/common.js';
import { rgb, mul, mix } from './builder.js';
import { DOME_BAND } from './stone.js';

const PI = Math.PI;

/** Doric/Tuscan column standing on y with base at (x,z). bucket = stone bucket. */
export function column(B, bk, x, y, z, r, h, col = 0xffffff, o = {}) {
  const base = r * 0.28, cap = r * 0.55; const shaft = h - base - cap; const tw = o.mpt ?? 3;
  const prof = [[r * 1.32, 0], [r * 1.32, base * 0.55], [r * 1.12, base * 0.7], [r * 1.02, base], [r * 1.0, base + shaft * 0.02], [r * 1.0, base + shaft * 0.35], [r * 0.93, base + shaft * 0.7], [r * 0.86, base + shaft], [r * 0.92, base + shaft + cap * 0.1], [r * 1.12, base + shaft + cap * 0.35], [r * 1.22, base + shaft + cap * 0.55]];
  B.lathe(bk, x, y, z, prof, o.segs ?? 12, { col, mpt: tw });
  B.box(bk, x, y + h - cap * 0.2, z, r * 2.9, cap * 0.45, r * 2.9, { col, mpt: tw });
}
/** wall panel (XY plane, front +Z, thickness depth) with rect/arched openings. openings: [{cx, w, h, y0=0, arch=true, sill?}] */
export function archWall(B, bk, w, h, depth, openings = [], col = 0xffffff, mpt = 3, x0 = 0, y0 = 0, z0 = 0) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.lineTo(-w / 2, 0);
  for (const op of openings) {
    const oy = op.y0 ?? 0, ow = op.w, oh = op.h, cx = op.cx; const p = new THREE.Path();
    if (op.arch === false) { p.moveTo(cx - ow / 2, oy); p.lineTo(cx - ow / 2, oy + oh); p.lineTo(cx + ow / 2, oy + oh); p.lineTo(cx + ow / 2, oy); p.lineTo(cx - ow / 2, oy); }
    else { p.moveTo(cx - ow / 2, oy); p.lineTo(cx - ow / 2, oy + oh - ow / 2); p.absarc(cx, oy + oh - ow / 2, ow / 2, PI, 0, true); p.lineTo(cx + ow / 2, oy); p.lineTo(cx - ow / 2, oy); }
    sh.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 8 }); g.translate(0, 0, -depth / 2);
  B.push(x0, y0, z0); B.geometry(bk, g, col, 1 / mpt); B.pop(); g.dispose();
}
/** triangular pediment, front +Z */
export function pediment(B, bk, w, h, depth, col, mpt = 3, y = 0) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, y, -depth / 2); B.geometry(bk, g, col, 1 / mpt); g.dispose();
}
export function onionDome(B, bk, cx, cy, cz, r, h, band = 0, o = {}) {
  const f = (k) => [r * k[0], h * k[1]];
  const prof = [[0.52, 0], [0.92, 0.1], [1.0, 0.24], [0.94, 0.38], [0.74, 0.52], [0.48, 0.66], [0.24, 0.8], [0.1, 0.92], [0.02, 1.0]].map(f);
  B.lathe(bk, cx, cy, cz, prof, o.segs ?? 16, { uvRect: DOME_BAND(band), rot: o.rot || 0, col: 0xffffff });
  B.cyl('gold', cx, cy + h * 0.98, cz, r * 0.04, r * 0.03, r * 0.55, 5, { col: 0xe8c050 }); B.box('gold', cx, cy + h + r * 0.28, cz, r * 0.03, r * 0.3, r * 0.03, { col: 0xe8c050 }); B.box('gold', cx, cy + h + r * 0.34, cz, r * 0.16, r * 0.03, r * 0.03, { col: 0xe8c050 });
}
export function halfDome(B, bk, cx, cy, cz, r, col, band = null, o = {}) {
  const prof = []; const n = 8; for (let i = 0; i <= n; i++) { const a = (i / n) * PI / 2; prof.push([Math.cos(a) * r, Math.sin(a) * r * (o.squash ?? 0.8)]); }
  B.lathe(bk, cx, cy, cz, prof, o.segs ?? 20, band != null ? { uvRect: DOME_BAND(band) } : { col, mpt: 4 });
}
/** hip/tent roof (square or rectangular pyramid) */
export function pyramid(B, bk, cx, cy, cz, w, d, h, col, mpt = 4, o = {}) {
  const hw = w / 2, hd = d / 2; const top = [cx, cy + h, cz]; const c = [[cx - hw, cy, cz + hd], [cx + hw, cy, cz + hd], [cx + hw, cy, cz - hd], [cx - hw, cy, cz - hd]];
  const uvs = (len) => [0, 0, len / mpt, 0, len / mpt / 2, h / mpt];
  B.tri(bk, c[0], c[1], top, col, uvs(w)); B.tri(bk, c[1], c[2], top, col, uvs(d)); B.tri(bk, c[2], c[3], top, col, uvs(w)); B.tri(bk, c[3], c[0], top, col, uvs(d));
}
/** merlons along a segment (o.swallow adds a pitched cap) */
export function crenellations(B, bk, x0, z0, x1, z1, y, col, o = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0); const ux = (x1 - x0) / len, uz = (z1 - z0) / len; const mw = o.w ?? 1.6, mh = o.h ?? 1.4, md = o.d ?? 0.9, gap = o.gap ?? 1.0;
  const n = Math.max(1, Math.floor(len / (mw + gap))); const rem = len - n * (mw + gap) + gap; const yaw = Math.atan2(ux, uz);
  for (let i = 0; i < n; i++) {
    const t = rem / 2 + i * (mw + gap) + mw / 2; B.push(x0 + ux * t, y, z0 + uz * t, yaw);
    B.box(bk, 0, mh / 2, 0, md, mh, mw, { col, mpt: 1.5, top: !o.swallow });
    if (o.swallow) { const pk = md * 0.55; B.quad(bk, [-md / 2, mh, mw / 2], [0, mh + pk, mw / 2], [0, mh + pk, -mw / 2], [-md / 2, mh, -mw / 2], [0, 0, 1, 1], col); B.quad(bk, [0, mh + pk, mw / 2], [md / 2, mh, mw / 2], [md / 2, mh, -mw / 2], [0, mh + pk, -mw / 2], [0, 0, 1, 1], col); B.tri(bk, [-md / 2, mh, mw / 2], [md / 2, mh, mw / 2], [0, mh + pk, mw / 2], col); B.tri(bk, [md / 2, mh, -mw / 2], [-md / 2, mh, -mw / 2], [0, mh + pk, -mw / 2], col); }
    B.pop();
  }
}
/** balustrade between two points: top rail, bottom rail, balusters, pillars */
export function balustrade(B, bk, x0, z0, x1, z1, y, h, col, o = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0); const ux = (x1 - x0) / len, uz = (z1 - z0) / len; const yaw = Math.atan2(ux, uz); const sp = o.pillar ?? 3.0; const bsp = o.baluster ?? 0.22; B.push(x0, y, z0, yaw - PI / 2 + PI / 2);
  // local: +Z along the segment
  B.box(bk, 0, h - 0.06, len / 2, 0.3, 0.12, len, { col, mpt: 2 }); B.box(bk, 0, 0.08, len / 2, 0.28, 0.16, len, { col, mpt: 2 });
  const n = Math.round(len / bsp); for (let i = 1; i < n; i++) { const z = i * len / n; if (Math.round(z / sp) * sp - z < 0.12 && Math.round(z / sp) * sp - z > -0.12) continue; B.cyl(bk, 0, 0.16, z, 0.07, 0.05, h - 0.28, 6, { col, cap: false, mpt: 1 }); }
  for (let z = 0; z <= len + 0.01; z += sp) B.box(bk, 0, h / 2 + 0.05, z, 0.34, h + 0.1, 0.34, { col, mpt: 2 });
  B.pop();
}
/** staircase occupying z in [cz-d/2, cz+d/2], rising toward -Z; lowest step at the +Z front */
export function stairs(B, bk, cx, y0, cz, w, d, h, steps, col) {
  for (let i = 0; i < steps; i++) { const dep = d - i * d / steps; const sy = (i + 1) * h / steps; B.box(bk, cx, y0 + sy / 2, cz - d / 2 + dep / 2, w, sy, dep, { col, mpt: 3 }); }
}
export function flagPole(B, x, y, z, h, col, rng) {
  B.cyl('metal', x, y, z, 0.07, 0.04, h, 6, { col: 0xd8d8d8 }); B.sphere('gold', x, y + h, z, 0.1, 0.1, 0.1, 6, 4, { col: 0xe8c050 });
  const c = col; const fw = h * 0.22, fh = fw * 0.62; const yaw = rng ? rng.range(0, PI * 2) : 0; B.push(x, y + h - fh - 0.2, z, yaw); const stripes = 3; for (let k = 0; k < stripes; k++) { const cc = (Array.isArray(c) ? c[k % c.length] : c); B.quad('flags', [0, fh * (1 - (k + 1) / stripes), 0], [fw, fh * (1 - (k + 1) / stripes), 0.0], [fw, fh * (1 - k / stripes), 0], [0, fh * (1 - k / stripes), 0], [0, 0, 1, 1], cc); B.quad('flags', [fw, fh * (1 - (k + 1) / stripes), 0], [0, fh * (1 - (k + 1) / stripes), 0], [0, fh * (1 - k / stripes), 0], [fw, fh * (1 - k / stripes), 0], [0, 0, 1, 1], mul(cc, 0.8)); } B.pop();
}

import { FACADE } from './facades.js';
/** one facade wall run from a to b ([x,z], left->right seen from outside; outward normal = (-dz, dx)/len). floors x fh, snapped to bays. tint = colour. */
export function facadeWall(B, key, a, b, y0, floors, fh, tint = 0xffffff, o = {}) {
  const F = FACADE[key]; const dx = b[0] - a[0], dz = b[1] - a[1]; const len = Math.hypot(dx, dz); const n = Math.max(1, Math.round(len / (o.bw ?? F.bw)));
  const uo = o.uOff ?? 0, vo = o.vOff ?? 0; const y1 = y0 + floors * fh; const c = rgb(tint); const cb = mul(c, o.ground ? 0.78 : 0.95);
  B.quad('f_' + key, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [uo / F.bays, vo / F.floors, (uo + n) / F.bays, (vo + floors) / F.floors], [cb, cb, c, c]);
}
