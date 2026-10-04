// Geometry helpers for hand-built models. All return THREE.BufferGeometry (indexed, with normals + uv).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seg } from './common.js';

export { mergeGeometries };
/** merge a list (all must have same attributes); returns single geometry */
export function merge(list) {
  const norm = list.map((g) => { const c = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) c.deleteAttribute(k); if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2)); return c; });
  return mergeGeometries(norm, false);
}
export const T = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);
export const R = (g, x = 0, y = 0, z = 0) => { g.rotateX(x); g.rotateY(y); g.rotateZ(z); return g; };
export const S = (g, x = 1, y = x, z = x) => g.scale(x, y, z);
/** Apply a transformation matrix built from TRS to a geometry and return it. */
export function xform(g, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)); g.applyMatrix4(m); return g;
}
/** Bake a vertex colour (so many parts with different colours can share one material). */
export function colorize(g, color) {
  const c = new THREE.Color(color); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
/** Rounded box. r = corner radius. */
export function roundedBox(w = 1, h = 1, d = 1, r = 0.1, segs = 3) {
  const g = new THREE.BoxGeometry(w, h, d, segs * 2, segs * 2, segs * 2); const p = g.attributes.position; const v = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const c = new THREE.Vector3(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    const dir = v.clone().sub(c); if (dir.lengthSq() > 1e-9) { dir.normalize().multiplyScalar(r); v.copy(c).add(dir); } p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
/**
 * Tapered limb along +Y from y=0 to y=len with radii r0 (bottom) -> r1 (top), optional bulge (muscle belly, 0..1) and elliptical cross-section (rz/rx ratio).
 * Capped by hemispherical ends if cap=true (smooth joints).
 */
export function limb(len, r0, r1, { bulge = 0.12, ratio = 1, radial = 14, rings = 8, cap = true, bulgeAt = 0.4 } = {}) {
  radial = seg(radial, 6); rings = seg(rings, 4);
  const pts = [];
  if (cap) for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r0, -Math.cos(a) * r0 * 0.9)); }
  for (let i = 0; i <= rings; i++) {
    const t = i / rings; let r = r0 + (r1 - r0) * t; r *= 1 + bulge * Math.sin(Math.PI * Math.pow(t, Math.log(0.5) / Math.log(bulgeAt)));
    pts.push(new THREE.Vector2(r, t * len));
  }
  if (cap) for (let i = 1; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r1, len + Math.sin(a) * r1 * 0.9)); }
  const g = new THREE.LatheGeometry(pts, radial); if (ratio !== 1) g.scale(1, 1, ratio); g.computeVertexNormals(); return g;
}
/**
 * Loft elliptical cross-sections along Y. sections: [{y, rx, rz, cx=0, cz=0}] (bottom->top). Great for torsos, hips, necks, bodies of vehicles.
 * Optionally close ends (capTop/capBottom).
 */
export function loft(sections, { radial = 20, capTop = true, capBottom = true, power = 2 } = {}) {
  radial = seg(radial, 8); const pos = [], uv = [], idx = [];
  const n = sections.length;
  for (let s = 0; s < n; s++) { const S0 = sections[s]; for (let i = 0; i <= radial; i++) { const a = (i / radial) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a);
    // superellipse for squarer/rounder sections
    const k = S0.power ?? power; const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k), z = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k);
    pos.push((S0.cx || 0) + x * S0.rx, S0.y, (S0.cz || 0) + z * S0.rz); uv.push(i / radial, s / (n - 1)); } }
  for (let s = 0; s < n - 1; s++) for (let i = 0; i < radial; i++) { const a = s * (radial + 1) + i, b = a + 1, c = a + radial + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const addCap = (s, up) => { const S0 = sections[s]; const ci = pos.length / 3; pos.push(S0.cx || 0, S0.y, S0.cz || 0); uv.push(0.5, 0.5); for (let i = 0; i < radial; i++) { const a = s * (radial + 1) + i, b = a + 1; if (up) idx.push(ci, b, a); else idx.push(ci, a, b); } };
  if (capBottom) addCap(0, false); if (capTop) addCap(n - 1, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** Tube along a polyline/curve with per-point radius. points: Vector3[]; radii: number | number[] */
export function tube(points, radii = 0.05, { radial = 8, closed = false, smooth = true, segsPerPoint = 6 } = {}) {
  radial = seg(radial, 4); const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.4); const count = smooth ? Math.max(2, (points.length - 1) * segsPerPoint) : points.length - 1;
  const frames = curve.computeFrenetFrames(count, closed); const pos = [], uv = [], idx = [];
  for (let i = 0; i <= count; i++) { const t = i / count; const p = curve.getPoint(t); const r = Array.isArray(radii) ? sampleArr(radii, t) : radii; const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) { const a = (j / radial) * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); pos.push(p.x + (N.x * c + B.x * s) * r, p.y + (N.y * c + B.y * s) * r, p.z + (N.z * c + B.z * s) * r); uv.push(j / radial, t); } }
  for (let i = 0; i < count; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function sampleArr(a, t) { const f = t * (a.length - 1), i = Math.floor(f), j = Math.min(a.length - 1, i + 1); return a[i] + (a[j] - a[i]) * (f - i); }
/** Displace vertices: fn(x,y,z,i)->[dx,dy,dz] or number (along normal). Recomputes normals. */
export function displace(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const r = fn(v.x, v.y, v.z, i); if (typeof r === 'number') { p.setXYZ(i, v.x + n.getX(i) * r, v.y + n.getY(i) * r, v.z + n.getZ(i) * r); } else if (r) p.setXYZ(i, v.x + r[0], v.y + r[1], v.z + r[2]); }
  p.needsUpdate = true; g.computeVertexNormals(); return g;
}
/** Sphere helper with optional non-uniform scale baked in. */
export function ellipsoid(rx, ry = rx, rz = rx, w = 16, h = 12) { const g = new THREE.SphereGeometry(1, seg(w, 6), seg(h, 4)); g.scale(rx, ry, rz); return g; }
/** Lathe from [ [r,y], ... ] profile points. */
export function lathe(profile, radial = 24, phiStart = 0, phiLength = Math.PI * 2) { const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), seg(radial, 6), phiStart, phiLength); g.computeVertexNormals(); return g; }
/** Extrude a 2D polygon [[x,y],...] to depth along Z (centered). */
export function extrude(poly, depth = 0.1, { bevel = 0, curveSegments = 8 } = {}) {
  const sh = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1]))); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments }); g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
/** Spherical-box UV helper: planar-project uv on XZ (for ground/roof textures) with scale. */
export function planarUV(g, scale = 1, axis = 'y') {
  const p = g.attributes.position; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (axis === 'y') { uv[i * 2] = x * scale; uv[i * 2 + 1] = z * scale; } else if (axis === 'z') { uv[i * 2] = x * scale; uv[i * 2 + 1] = y * scale; } else { uv[i * 2] = z * scale; uv[i * 2 + 1] = y * scale; } }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
/** Box-projected world-space UVs (tiles texture by metres regardless of box size) — use for buildings, walls. */
export function boxUV(g, metersPerTile = 4) {
  g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i)); const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ny >= nx && ny >= nz) { uv[i * 2] = x / metersPerTile; uv[i * 2 + 1] = z / metersPerTile; } else if (nx >= nz) { uv[i * 2] = z / metersPerTile; uv[i * 2 + 1] = y / metersPerTile; } else { uv[i * 2] = x / metersPerTile; uv[i * 2 + 1] = y / metersPerTile; } }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
