// Shared prop builders for the life sets. Every function builds into Kit `K` in the *current local frame* (origin on the floor, facing +Z).
import * as THREE from 'three';
import { RNG, seg, TAU, disposeTree } from '../../../engine/common.js';
import { Kit, mat4, signMesh, canvasTexture, atlas, uvRect, uvPoint, uvCyl } from './kit.js';

export const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);
/** anchor helper: actor anchor facing a world point */
export const A = (pos, yaw = 0) => ({ pos, yaw });
export const AT = (pos, target) => ({ pos, yaw: Math.atan2(target[0] - pos[0], target[2] - pos[2]), look: target });

/** a straight wall along local +X (0..len), thickness t centred on z=0, base y=0. holes: [{x0,x1,y0,y1}].
 *  clad: {mat, h, side:+1|-1 (which face), t=0.03, y0=0} adds a cladding layer (tiles, panelling) up to h skipping door holes */
export function wall(K, mat, len, h, t, holes = [], clad = null) {
  const hs = holes.slice().sort((a, b) => a.x0 - b.x0);
  let x = 0; const seg0 = (m, x0, y0, x1, y1, z0, z1) => { if (x1 - x0 > 1e-4 && y1 - y0 > 1e-4) K.slab(m, x0, y0, z0, x1, y1, z1); };
  for (const o of hs) { seg0(mat, x, 0, o.x0, h, -t / 2, t / 2); seg0(mat, o.x0, 0, o.x1, o.y0, -t / 2, t / 2); seg0(mat, o.x0, o.y1, o.x1, h, -t / 2, t / 2); x = o.x1; }
  seg0(mat, x, 0, len, h, -t / 2, t / 2);
  if (clad) {
    const ct = clad.t ?? 0.03, z0 = clad.side > 0 ? t / 2 : -t / 2 - ct, z1 = z0 + ct, cy0 = clad.y0 || 0; x = 0;
    for (const o of hs) { seg0(clad.mat, x, cy0, o.x0, clad.h, z0, z1); if (o.y0 > cy0) seg0(clad.mat, o.x0, cy0, o.x1, Math.min(o.y0, clad.h), z0, z1); if (o.y1 < clad.h) seg0(clad.mat, o.x0, o.y1, o.x1, clad.h, z0, z1); x = o.x1; }
    seg0(clad.mat, x, cy0, len, clad.h, z0, z1);
  }
}
/** four walls of a rectangular room: x∈[-w/2,w/2], z∈[-d/2,d/2]. holes by wall name 'n','s','e','w' (positions are measured from the wall's start, see code) */
export function room(K, { w, d, h, t = 0.2, mat = 'plaster', floor = null, ceil = null, holes = {}, clad = {} }) {
  const hw = w / 2, hd = d / 2;
  // north wall (z=-hd), runs west->east ; south (z=+hd) runs east->west seen from inside, we keep x from -hw..hw for both
  K.at([-hw - t / 2, 0, -hd - t / 2], 0, () => wall(K, mat, w + t, h, t, holes.n || [], clad.n));
  K.at([-hw - t / 2, 0, hd + t / 2], 0, () => wall(K, mat, w + t, h, t, holes.s || [], clad.s ? { ...clad.s, side: -clad.s.side } : null));
  // east/west run along z using yaw = -90deg so local +x -> world +z
  K.at([hw + t / 2, 0, -hd - t / 2], -Math.PI / 2, () => wall(K, mat, d + t, h, t, holes.e || [], clad.e));
  K.at([-hw - t / 2, 0, -hd - t / 2], -Math.PI / 2, () => wall(K, mat, d + t, h, t, holes.w || [], clad.w ? { ...clad.w, side: -clad.w.side } : null));
  if (floor) K.slab(floor, -hw - t, -0.3, -hd - t, hw + t, 0, hd + t);
  if (ceil) K.slab(ceil, -hw - t, h, -hd - t, hw + t, h + 0.25, hd + t);
}

// ------------------------------------------------------------------ lights (fixtures; glow materials are 'glow*')
/** recessed 2x4-ish troffer fixture on the ceiling at height y (faces down) */
export function troffer(K, w, d, y, glowMat = 'glow', tubes = 2) {
  K.box('paint#e9e9e4', w + 0.04, 0.012, d + 0.04, 0, y - 0.012, 0);
  K.box('paint#d8d8d2', w, 0.06, 0.02, 0, y - 0.07, d / 2 - 0.01); K.box('paint#d8d8d2', w, 0.06, 0.02, 0, y - 0.07, -d / 2 + 0.01);
  K.box('paint#d8d8d2', 0.02, 0.06, d, w / 2 - 0.01, y - 0.07, 0); K.box('paint#d8d8d2', 0.02, 0.06, d, -w / 2 + 0.01, y - 0.07, 0);
  K.tinted('#9aa5a2', () => K.box(glowMat, w - 0.04, 0.008, d - 0.04, 0, y - 0.075, 0));
  for (let i = 0; i < tubes; i++) { const zz = ((i + 0.5) / tubes - 0.5) * (d - 0.1); K.cyl(glowMat, 0.016, w - 0.12, 0, y - 0.066, zz, { axis: 'x', seg: 8 }); }
  K.slab('chrome', -w / 2 + 0.04, y - 0.058, -d / 2 + 0.03, -w / 2 + 0.055, y - 0.055, d / 2 - 0.03);
}
export function lampShade(K, r, h, x, y, z, { cordTo = null, glow = 'glowWarm', shade = 'paint#2a2a2e' } = {}) {
  if (cordTo != null) K.cyl('rubberBlack', 0.004, cordTo - y - h, x, y + h, z, { seg: 4 });
  K.lathe(shade, [[0.04, h], [r * 0.5, h * 0.92], [r, 0.0], [r - 0.012, 0.0], [r * 0.5 - 0.01, h * 0.9], [0.03, h - 0.01]], x, y, z, { seg: 20 });
  K.sph(glow, r * 0.45, x, y + h * 0.35, z, { seg: 10, segH: 6 });
  K.cyl(glow, r * 0.92, 0.01, x, y + 0.005, z, { seg: 20 });
}

// ------------------------------------------------------------------ seating / tables
export function chairPlastic(K, color = '#d9d9d6', { h = 0.45 } = {}) {
  K.tinted(color, () => {
    K.rbox('plastic', 0.42, 0.035, 0.40, 0.015, 0, h - 0.035, 0.0);
    K.at([0, h, -0.19], [-0.12, 0, 0], () => K.rbox('plastic', 0.40, 0.3, 0.025, 0.012, 0, 0, 0));
  });
  for (const [x, z] of [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.17], [0.18, 0.17]]) K.cyl('steelPlain', 0.012, h - 0.035, x, 0, z, { seg: 6 });
  K.box('steelPlain', 0.36, 0.015, 0.015, 0, 0.2, 0.17); K.box('steelPlain', 0.36, 0.015, 0.015, 0, 0.2, -0.16);
}
export function chairWood(K, color = '#7a5230', { h = 0.46, back = 0.9 } = {}) {
  K.tinted(color, () => {
    K.box('woodGrain', 0.42, 0.035, 0.42, 0, h - 0.035, 0);
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) K.box('woodGrain', 0.035, h - 0.035, 0.035, x, 0, z);
    for (const sx of [-1, 1]) K.box('woodGrain', 0.035, back - h, 0.035, sx * 0.18, h, -0.18);
    K.box('woodGrain', 0.4, 0.08, 0.025, 0, back - 0.1, -0.18); K.box('woodGrain', 0.4, 0.06, 0.025, 0, back - 0.26, -0.18); K.box('woodGrain', 0.36, 0.035, 0.03, 0, 0.2, 0.18);
  });
}
export function officeChair(K, { color = '#2c2f36', h = 0.48, back = 0.95, arms = true } = {}) {
  K.tinted(color, () => { K.rbox('fabric', 0.5, 0.08, 0.5, 0.03, 0, h - 0.08, 0.02); K.at([0, h, -0.24], [-0.1, 0, 0], () => K.rbox('fabric', 0.46, back - h, 0.07, 0.03, 0, 0, 0)); });
  K.cyl('darkMetal', 0.025, h - 0.1, 0, 0.14, 0, { seg: 8 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; K.at([0, 0.07, 0], a, () => { K.box('darkMetal', 0.035, 0.03, 0.32, 0, 0, 0.16); K.cyl('rubberBlack', 0.025, 0.025, 0, 0, 0.32, { seg: 6 }); }); }
  if (arms) for (const sx of [-1, 1]) { K.box('darkMetal', 0.03, 0.2, 0.03, sx * 0.26, h - 0.02, 0); K.rbox('rubberBlack', 0.06, 0.03, 0.26, 0.012, sx * 0.26, h + 0.18, 0.02); }
}
export function stoolRound(K, { h = 0.75, r = 0.18, color = '#a3262a', leg = 'chrome' } = {}) {
  K.cyl(leg, 0.02, h - 0.08, 0, 0.06, 0, { seg: 8 }); K.cyl(leg, 0.2, 0.02, 0, 0, 0, { seg: 16 }); K.torus(leg, 0.14, 0.008, 0, 0.28, 0, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.78; K.at([0, 0, 0], a, () => { K.cyl(leg, 0.012, 0.3, 0, 0.0, 0.1, { seg: 5, axis: 'z' }); }); }
  K.tinted(color, () => { K.cyl('leather', r, 0.06, 0, h - 0.08, 0, { seg: 18, rt: r * 0.95 }); K.cyl('leather', r * 0.95, 0.035, 0, h - 0.03, 0, { seg: 18, rt: r * 0.82 }); });
  K.cyl(leg, r * 0.98, 0.012, 0, h - 0.09, 0, { seg: 18 });
}
export function tableRect(K, w, d, h, { top = 'woodGrain', leg = 'darkMetal', topT = 0.04, color = null, legStyle = 'square' } = {}) {
  const fn = () => {
    K.box(top, w, topT, d, 0, h - topT, 0);
    if (legStyle === 'panel') { K.box(top, 0.04, h - topT, d - 0.1, -w / 2 + 0.06, 0, 0); K.box(top, 0.04, h - topT, d - 0.1, w / 2 - 0.06, 0, 0); }
    else for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(leg, 0.05, h - topT, 0.05, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07));
  };
  color ? K.tinted(color, fn) : fn();
}
export function tableRound(K, r, h, { top = 'woodGrain', base = 'darkMetal', color = null } = {}) {
  const fn = () => { K.cyl(top, r, 0.035, 0, h - 0.035, 0, { seg: 28 }); };
  color ? K.tinted(color, fn) : fn();
  K.cyl(base, 0.035, h - 0.04, 0, 0.02, 0, { seg: 8 }); K.cyl(base, r * 0.38, 0.025, 0, 0, 0, { seg: 20 });
}
export function sofa(K, w = 2.0, color = '#6b7a8f', { d = 0.9, h = 0.85, seatH = 0.42, mat = 'fabric' } = {}) {
  K.tinted(color, () => {
    K.rbox(mat, w, 0.2, d, 0.05, 0, 0.12, 0); K.rbox(mat, w, h - 0.3, 0.22, 0.07, 0, 0.3, -d / 2 + 0.11);
    for (const sx of [-1, 1]) K.rbox(mat, 0.2, 0.28, d, 0.06, sx * (w / 2 - 0.1), seatH - 0.08, 0);
    const n = Math.max(1, Math.round((w - 0.4) / 0.62)); const cw = (w - 0.4) / n;
    for (let i = 0; i < n; i++) { const x = -((w - 0.4) / 2) + cw * (i + 0.5); K.rbox(mat, cw - 0.02, 0.16, d - 0.28, 0.06, x, seatH - 0.24, 0.1); K.at([x, seatH - 0.05, -d / 2 + 0.28], [-0.2, 0, 0], () => K.rbox(mat, cw - 0.04, 0.42, 0.16, 0.07, 0, 0, 0)); }
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('darkMetal', 0.025, 0.12, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), { seg: 6, rt: 0.018 });
}
export function bench(K, w = 1.8, { h = 0.45, d = 0.4, color = '#7a5230', back = false, legMat = 'darkMetal' } = {}) {
  K.tinted(color, () => { for (let i = 0; i < 3; i++) K.box('woodGrain', w, 0.03, d / 3 - 0.01, 0, h - 0.03, -d / 2 + (i + 0.5) * d / 3); if (back) for (let i = 0; i < 2; i++) K.at([0, h + 0.18 + i * 0.14, -d / 2], [-0.1, 0, 0], () => K.box('woodGrain', w, 0.1, 0.025, 0, 0, 0)); });
  for (const sx of [-1, 1]) { K.box(legMat, 0.05, h - 0.03, 0.05, sx * (w / 2 - 0.1), 0, d / 2 - 0.06); K.box(legMat, 0.05, h - 0.03, 0.05, sx * (w / 2 - 0.1), 0, -d / 2 + 0.06); K.box(legMat, 0.04, 0.04, d - 0.08, sx * (w / 2 - 0.1), h - 0.07, 0); if (back) K.box(legMat, 0.04, 0.5, 0.04, sx * (w / 2 - 0.1), h, -d / 2 + 0.02); }
}

// ------------------------------------------------------------------ plants
export function leafGeo(len, wid, bend = 0.4, segs = 4) {
  const g = new THREE.PlaneGeometry(wid, len, 1, segs); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len + 0.5; p.setY(i, t * len); p.setZ(i, bend * len * t * t); p.setX(i, p.getX(i) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)))); }
  g.computeVertexNormals(); return g;
}
const GREENS = ['#3d7d33', '#4a8f3a', '#2f6a2c', '#5a9b3f', '#3a7a3a'];
export function pot(K, r = 0.18, h = 0.3, color = '#b5623a', { soil = true, rim = true } = {}) {
  K.tinted(color, () => K.lathe('plastic', [[r * 0.62, 0], [r * 0.7, 0.01], [r * 0.88, h * 0.5], [r, h - 0.03], [r * 1.04, h - 0.03], [r * 1.04, h], [r * 0.96, h], [r * 0.92, h - 0.02]], 0, 0, 0, { seg: 18 }));
  if (soil) K.cyl('paint#2a1d14', r * 0.92, 0.01, 0, h - 0.045, 0, { seg: 18 });
}
/** leafy potted plant. kind 'ficus' | 'dracaena' | 'fern' | 'snake' */
export function plant(K, kind = 'ficus', { s = 1, potColor = '#b5623a', seed = 3, potted = true } = {}) {
  const r = new RNG(seed); const ph = 0.3 * s;
  if (potted) pot(K, 0.17 * s, ph, potColor);
  const base = potted ? ph : 0;
  if (kind === 'snake') {
    for (let i = 0; i < 9; i++) { const a = r.range(0, TAU), rr = r.range(0, 0.06) * s; K.tinted(GREENS[i % 5], () => K.at([Math.cos(a) * rr, base, Math.sin(a) * rr], [0, a, 0], () => K.geo('leaf', leafGeo(r.range(0.45, 0.8) * s, 0.09 * s, 0.05), 0, 0, 0, [r.range(-0.12, 0.12), 0, 0]))); }
    return;
  }
  if (kind === 'ficus' || kind === 'dracaena') {
    const trunkH = (kind === 'ficus' ? 0.9 : 0.7) * s; K.tinted('#5a4030', () => K.cyl('woodGrain', 0.02 * s, trunkH, 0, base, 0, { seg: 6, rt: 0.012 * s }));
    const n = kind === 'ficus' ? 34 : 22;
    for (let i = 0; i < n; i++) { const t = i / n, a = i * 2.4 + r.range(-0.3, 0.3), hh = base + trunkH * (0.45 + 0.55 * t) + r.range(0, 0.15) * s; const sp = (kind === 'ficus' ? 0.12 + t * 0.22 : 0.05 + t * 0.08) * s;
      K.tinted(GREENS[i % 5], () => K.at([Math.cos(a) * sp * 0.4, hh, Math.sin(a) * sp * 0.4], [0, a, 0], () => K.geo('leaf', leafGeo((kind === 'ficus' ? 0.2 : 0.5) * s * r.range(0.8, 1.2), (kind === 'ficus' ? 0.1 : 0.07) * s, 0.5), 0, 0, 0, [Math.PI / 2 - r.range(0.2, 0.9) * (kind === 'ficus' ? 1 : 0.7) - (kind === 'dracaena' ? 0.2 : 0), 0, 0]))); }
    return;
  }
  // fern: arching fronds
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + r.range(-0.2, 0.2); K.tinted(GREENS[i % 5], () => K.at([0, base + 0.02, 0], [0, a, 0], () => K.geo('leaf', leafGeo(r.range(0.45, 0.7) * s, 0.14 * s, 0.7), 0, 0, 0, [Math.PI / 2 - r.range(0.35, 0.8), 0, 0]))); }
}
/** palm: ringed trunk with a crown of fronds */
export function palm(K, h = 6, { seed = 1, lean = 0.12, fronds = 13, frondLen = 2.4 } = {}) {
  const r = new RNG(seed); const pts = []; const n = 7; const la = r.range(0, TAU);
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([Math.cos(la) * lean * h * t * t, h * t, Math.sin(la) * lean * h * t * t]); }
  const rad = []; for (let i = 0; i <= n; i++) rad.push(0.22 - 0.09 * (i / n));
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), n * 5, 1, seg(10, 6), false);
  // taper + ring bumps
  const pa = g.attributes.position; const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))); const tmp = new THREE.Vector3();
  const ring = Math.floor(pa.count / ((n * 5 + 1))); // verts per ring
  for (let i = 0; i < pa.count; i++) { const seg0 = Math.floor(i / (g.parameters.radialSegments + 1)); const t = seg0 / (n * 5); const c = curve.getPoint(t); tmp.set(pa.getX(i) - c.x, pa.getY(i) - c.y, pa.getZ(i) - c.z); const rr = (0.2 - 0.085 * t) * (1 + 0.1 * Math.cos(t * h * 18)); tmp.multiplyScalar(rr); pa.setXYZ(i, c.x + tmp.x, c.y + tmp.y, c.z + tmp.z); }
  g.computeVertexNormals(); { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * h / 0.7); } K.add('palmTrunk', g);
  const top = pts[n];
  for (let i = 0; i < fronds; i++) { const a = i / fronds * TAU + r.range(-0.2, 0.2); const pitch = r.range(0.35, 1.0); K.tinted(i % 3 ? '#6aa84a' : '#4f8c3a', () => K.at([top[0], top[1] - 0.05, top[2]], [0, a, 0], () => K.geo('frond', leafGeo(frondLen * r.range(0.85, 1.15), frondLen * 0.55, 0.7, 6), 0, 0, 0, [Math.PI / 2 - pitch, 0, 0]))); }
  for (let i = 0; i < 5; i++) K.tinted('#7a5a2a', () => K.sph('matte', 0.07, top[0] + r.range(-0.12, 0.12), top[1] - 0.18, top[2] + r.range(-0.12, 0.12), { seg: 6, segH: 4 }));
}

// ------------------------------------------------------------------ office / tech
export function monitor(K, { w = 0.5, h = 0.3, screen = null, y = 0, stand = true } = {}) {
  K.rbox('paint#16181b', w + 0.03, h + 0.03, 0.03, 0.01, 0, y + 0.1, 0);
  if (stand) { K.box('darkMetal', 0.05, 0.1, 0.03, 0, y, -0.01); K.rbox('darkMetal', 0.22, 0.012, 0.16, 0.005, 0, y, 0.02); }
  if (screen) { screen.position.set(0, y + 0.1 + (h + 0.03) / 2, 0.0155); screen.userData.local = true; }
  else K.box('screenOff', w - 0.01, h - 0.01, 0.002, 0, y + 0.1 + 0.015, 0.0155);
}
export function keyboard(K, w = 0.44, d = 0.15) { K.rbox('paint#d6d6d2', w, 0.018, d, 0.004, 0, 0, 0); K.box('paint#9a9a96', w - 0.03, 0.006, d - 0.03, 0, 0.018, 0); K.rbox('paint#d0d0cc', 0.06, 0.02, 0.1, 0.01, 0.3, 0, 0.0); }
export function deskUnit(K, w = 1.4, d = 0.7, h = 0.74, { top = 'woodGrain', body = 'woodGrain', color = null, side = 'drawers' } = {}) {
  const fn = () => {
    K.box(top, w, 0.035, d, 0, h - 0.035, 0);
    if (side === 'drawers') { K.box(body, 0.42, h - 0.035, d - 0.06, w / 2 - 0.23, 0, 0); for (let i = 0; i < 3; i++) { K.box('darkMetal', 0.14, 0.012, 0.012, w / 2 - 0.23, 0.1 + (i + 0.5) * 0.2, d / 2 - 0.02); } K.box(body, 0.04, h - 0.035, d - 0.06, -w / 2 + 0.04, 0, 0); K.box(body, w - 0.5, h * 0.7, 0.02, -0.08, h * 0.2, -d / 2 + 0.05); K.box(body, w - 0.6, 0.07, d - 0.2, -0.1, h - 0.1, 0.05); }
    else { for (const sx of [-1, 1]) K.box(body, 0.04, h - 0.035, d - 0.06, sx * (w / 2 - 0.04), 0, 0); K.box(body, w - 0.08, h * 0.55, 0.02, 0, h * 0.4, -d / 2 + 0.05); }
  };
  color ? K.tinted(color, fn) : fn();
}
/** analog wall clock: static body is merged; returns hand pivot objects to rotate: {hour,min,sec} (Object3Ds in the Kit root) */
export function wallClock(K, r = 0.17, x = 0, y = 0, z = 0, rot = 0) {
  const face = signMesh(r * 2, r * 2, (ctx, w, h) => {
    ctx.fillStyle = '#f1efe8'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, big = i % 5 === 0; ctx.lineWidth = big ? w * 0.014 : w * 0.005; ctx.beginPath(); ctx.moveTo(w / 2 + Math.sin(a) * w * (big ? 0.37 : 0.4), h / 2 - Math.cos(a) * h * (big ? 0.37 : 0.4)); ctx.lineTo(w / 2 + Math.sin(a) * w * 0.44, h / 2 - Math.cos(a) * h * 0.44); ctx.stroke(); }
    ctx.fillStyle = '#1b1b1b'; ctx.font = `bold ${w * 0.11}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU; ctx.fillText(String(i), w / 2 + Math.sin(a) * w * 0.31, h / 2 - Math.cos(a) * h * 0.31); }
  }, { px: 400, rough: 0.35, bg: '#f1efe8' });
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, rot, 0); g.updateMatrix(); face.position.z = 0.021; g.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.04, 28), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.4, metalness: 0.5 })); rim.rotation.x = Math.PI / 2; g.add(rim);
  const hm = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.4 }); const mkHand = (len, wd) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(wd, len, 0.004), hm); m.position.y = len / 2 - len * 0.1; p.add(m); p.position.z = 0.026; g.add(p); return p; };
  const hour = mkHand(r * 0.5, r * 0.07), min = mkHand(r * 0.75, r * 0.05), sec = mkHand(r * 0.8, r * 0.015); sec.children[0].material = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.5 });
  g.applyMatrix4(K.cur); K.root.add(g);
  return { group: g, set(tsec) { const T = tsec; sec.rotation.z = -(T % 60) / 60 * TAU; min.rotation.z = -(T / 60 % 60) / 60 * TAU; hour.rotation.z = -(T / 3600 % 12) / 12 * TAU; } };
}
/** simple framed picture (own canvas) */
export function frame(K, w, h, draw, { x = 0, y = 0, z = 0, rot = 0, color = '#3a2a1c', px = 200, thick = 0.03, mat = 'woodGrain' } = {}) {
  K.at([x, y, z], rot, () => {
    K.tinted(color, () => { K.slab(mat, -w / 2, 0, -0.015, w / 2, thick, 0.015); K.slab(mat, -w / 2, h - thick, -0.015, w / 2, h, 0.015); K.slab(mat, -w / 2, 0, -0.015, -w / 2 + thick, h, 0.015); K.slab(mat, w / 2 - thick, 0, -0.015, w / 2, h, 0.015); });
    const s = signMesh(w - thick * 2, h - thick * 2, draw, { px, rough: 0.5, bg: '#fff' }); s.position.set(0, h / 2, 0.006); K.mesh(s);
  });
}
export function fan(K, { r = 0.22, color = '#e8e8e4' } = {}) { /* returns a Group with rotating blades (not merged) */
  const g = new THREE.Group(); const hm = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
  const blades = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, r * 0.95), hm); b.position.z = r * 0.5; b.rotation.x = 0.15; const hold = new THREE.Group(); hold.rotation.y = i / 3 * TAU; hold.add(b); blades.add(hold); }
  g.add(blades); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), hm); g.add(hub); g.userData.blades = blades; return g;
}

// ------------------------------------------------------------------ small objects
export const cupProfile = [[0.0, 0.0], [0.028, 0.0], [0.034, 0.002], [0.04, 0.09], [0.042, 0.095]];
export function mug(K, color = '#f2f2ee', x = 0, y = 0, z = 0) { K.tinted(color, () => { K.lathe('plastic', [[0, 0], [0.034, 0], [0.04, 0.005], [0.042, 0.09], [0.04, 0.092], [0.036, 0.088], [0.034, 0.012], [0, 0.01]], x, y, z, { seg: 14 }); K.torus('plastic', 0.022, 0.005, x + 0.045, y + 0.05, z, [0, 0, 0], { seg: 5, segR: 10, arc: Math.PI }); }); }
export function paperStack(K, x, y, z, n = 8, rot = 0, color = '#f4f2ea') { K.tinted(color, () => K.box('matte', 0.21, n * 0.0012 + 0.002, 0.297, x, y, z, rot)); }
export function folder(K, x, y, z, rot = 0, color = '#d9b45a') { K.tinted(color, () => { K.box('matte', 0.23, 0.004, 0.31, x, y, z, rot); }); }
export function trashBin(K, r = 0.14, h = 0.3, color = '#4a4f55', x = 0, z = 0) { K.tinted(color, () => K.lathe('plastic', [[r * 0.82, 0.0], [r, 0.02], [r * 1.08, h], [r * 1.12, h], [r * 1.12, h + 0.01], [r * 1.04, h + 0.01], [r * 0.94, 0.04]], x, 0, z, { seg: 18 })); K.cyl('paint#0a0a0a', r * 1.02, 0.005, x, h - 0.02, z, { seg: 18 }); }
export function fireExt(K, x, y, z, rot = 0) { K.at([x, y, z], rot, () => { K.cyl('paint#b82020', 0.055, 0.34, 0, 0, 0, { seg: 12 }); K.cyl('paint#b82020', 0.03, 0.04, 0, 0.34, 0, { seg: 10, rt: 0.018 }); K.box('darkMetal', 0.04, 0.025, 0.05, 0, 0.37, 0.01); K.cyl('paint#111', 0.02, 0.02, 0, 0.1, 0.055, { axis: 'z', seg: 6 }); K.box('paint#f4f4f0', 0.07, 0.1, 0.002, 0, 0.14, 0.056); K.box('steelPlain', 0.13, 0.02, 0.012, 0, 0.28, -0.045); K.box('paint#cccccc', 0.18, 0.5, 0.01, 0, -0.04, -0.07); }); }

// ------------------------------------------------------------------ set assembly
/** common wrap-up: builds meshes, creates the lights group, returns the contract object. */
export function finishSet(K, extra, { bounds, anchors, lights = [], screens = [], update = null, extraObjs = [], flicker = null } = {}) {
  K.build();
  const root = new THREE.Group(); root.name = K.root.name || 'set'; root.add(K.root); for (const o of extraObjs) root.add(o); for (const l of lights) root.add(l);
  const tmp = { t: 0 };
  const api = {
    root, bounds, anchors, lights, screens,
    update(dt, t) { tmp.t = t; K.swayU.value = t; K.syncAmbience(root); for (const f of K.updaters) f(dt, t); if (update) update(dt, t); },
    dispose() { disposeTree(root); },
    stats() { let tris = 0, meshes = 0; root.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return { tris: Math.round(tris), draws: meshes }; },
  };
  Object.assign(api, extra || {});
  K.syncAmbience(root);
  return api;
}
