// Geometry kit for the Vessari machines: revolve/surface builders, plates ("scutes"), spikes, and a rigid/blended SkinSet that merges
// many parts into ONE skinned geometry (one draw call per material) bound to a flat bone array.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4();
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export { sstep };

/** average normals of vertices that share a position (hides uv-seam / pole creases). */
export function smoothNormals(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, map = new Map(), K = 1000;
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * K) + ',' + Math.round(p.getY(i) * K) + ',' + Math.round(p.getZ(i) * K);
    let e = map.get(k); if (!e) { e = [0, 0, 0, []]; map.set(k, e); }
    e[0] += n.getX(i); e[1] += n.getY(i); e[2] += n.getZ(i); e[3].push(i);
  }
  for (const e of map.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; for (const i of e[3]) n.setXYZ(i, e[0] / l, e[1] / l, e[2] / l); }
  n.needsUpdate = true; return g;
}
/** flip triangle winding if the surface mostly faces INWARD relative to (cx,cy,cz). Returns g with recomputed normals. */
export function orient(g, cx = 0, cy = 0, cz = 0) {
  const p = g.attributes.position, ix = g.index.array; let score = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t], b = ix[t + 1], c = ix[t + 2];
    _a.fromBufferAttribute(p, a); _b.fromBufferAttribute(p, b); _c.fromBufferAttribute(p, c);
    const cxp = (_a.x + _b.x + _c.x) / 3 - cx, cyp = (_a.y + _b.y + _c.y) / 3 - cy, czp = (_a.z + _b.z + _c.z) / 3 - cz;
    const e1x = _b.x - _a.x, e1y = _b.y - _a.y, e1z = _b.z - _a.z, e2x = _c.x - _a.x, e2y = _c.y - _a.y, e2z = _c.z - _a.z;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    score += nx * cxp + ny * cyp + nz * czp;
  }
  if (score < 0) { for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; } g.index.needsUpdate = true; }
  return smoothNormals(g);
}
/** torus with metre-based uv (R ring radius, r tube radius) */
export function torus(R, r, radial = 24, tubular = 6, { tile = 1, arc = Math.PI * 2 } = {}) {
  const g = new THREE.TorusGeometry(R, r, tubular, radial, arc); g.rotateX(Math.PI / 2);
  const su = Math.max(1, Math.round(R * arc / tile)), sv = Math.max(1, Math.round(Math.PI * 2 * r / tile)); scaleUV(g, su, sv); return g;
}
/** multiply uvs */
export function scaleUV(g, su, sv = su) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); uv.needsUpdate = true; return g; }
export function offsetUV(g, du, dv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv); uv.needsUpdate = true; return g; }

/**
 * Surface of revolution about +Y, from y=0 to y=len. rFn(t, y, a) -> radius (t 0..1 along length, a = angle) so ribs / spokes / bulges are easy.
 * ratio scales z. tile = metres per texture tile (uv density). Ends close when rFn -> 0.
 */
export function revolve(len, rFn, { rings = 16, radial = 12, tile = 4, ratio = 1, a0 = 0, a1 = Math.PI * 2 } = {}) {
  const pos = [], uv = [], idx = [];
  let maxR = 0.01; for (let i = 0; i <= 6; i++) maxR = Math.max(maxR, rFn(i / 6, len * i / 6, 0));
  const ru = Math.max(1, Math.round(maxR * Math.PI * 2 * Math.max(1, ratio) / tile)); const full = Math.abs((a1 - a0) - Math.PI * 2) < 1e-4;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, y = t * len;
    for (let i = 0; i <= radial; i++) { const a = a0 + (a1 - a0) * (i / radial); const r = Math.max(0, rFn(t, y, a)); pos.push(Math.cos(a) * r, y, Math.sin(a) * r * ratio); uv.push((i / radial) * (full ? ru : (a1 - a0) / (Math.PI * 2) * ru), y / tile); }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < radial; i++) { const a = j * (radial + 1) + i, b = a + 1, c = a + radial + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return full ? smoothNormals(g) : (g.computeVertexNormals(), g);
}
/** Parametric surface: fn(u,v,out:Vector3) fills the position; (nu x nv quads); uv = (u,v)*uvScale. */
export function surface(nu, nv, fn, { uvScale = [1, 1] } = {}) {
  const pos = [], uv = [], idx = [], o = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { fn(i / nu, j / nv, o); pos.push(o.x, o.y, o.z); uv.push(i / nu * uvScale[0], j / nv * uvScale[1]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
/** ellipsoid with metre-based uv tiling */
export function blob(rx, ry = rx, rz = rx, { w = 24, h = 16, tile = 4, phi0 = 0, phiLen = Math.PI * 2, th0 = 0, thLen = Math.PI } = {}) {
  const g = new THREE.SphereGeometry(1, w, h, phi0, phiLen, th0, thLen); g.scale(rx, ry, rz);
  const su = Math.max(1, Math.round(Math.PI * 2 * Math.max(rx, rz) * (phiLen / (Math.PI * 2)) / tile)), sv = Math.max(0.5, Math.PI * Math.max(rx, ry, rz) * 0.5 * (thLen / Math.PI) / tile);
  scaleUV(g, su, sv); return smoothNormals(g);
}
/** unit tube along +Y with radius function, ends rounded; convenient for tendrils / limbs. */
export function taper(len, r0, r1, { rings = 8, radial = 8, tile = 3, bulge = 0, round = true } = {}) {
  return revolve(len, (t) => {
    let r = r0 + (r1 - r0) * t; r *= 1 + bulge * Math.sin(Math.PI * t);
    if (round) { const e = 0.5 / Math.max(1, rings); const k = Math.min(Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, t / (e * 2)), 2))), Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, (1 - t) / (e * 2)), 2)))); r *= k; }
    return r;
  }, { rings, radial, tile });
}
/** a cone/spike, base at origin pointing +Y */
export function spike(len, r, radial = 5) { const g = new THREE.ConeGeometry(r, len, radial, 1, false); g.translate(0, len / 2, 0); return g; }
export const alignY = (dir, out = new THREE.Quaternion()) => out.setFromUnitVectors(UP, _a.copy(dir).normalize());
/** quaternion whose local +Y = dir and local +Z = pole (orthogonalised) */
export function basisQuat(dir, pole, out = new THREE.Quaternion()) {
  const y = _a.copy(dir).normalize(); const z = _b.copy(pole); z.addScaledVector(y, -z.dot(y));
  if (z.lengthSq() < 1e-8) { z.set(1, 0, 0); z.addScaledVector(y, -z.dot(y)); if (z.lengthSq() < 1e-8) z.set(0, 0, 1); }
  z.normalize(); const x = _c.crossVectors(y, z); _m.makeBasis(x, y, z); return out.setFromRotationMatrix(_m);
}
/** place a geometry: pos, quaternion (or euler array), scale -> returns same geometry */
export function place(g, pos = [0, 0, 0], rot = null, scale = 1) {
  const q = rot ? (rot.isQuaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))) : new THREE.Quaternion();
  const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : (scale.isVector3 ? scale : new THREE.Vector3(...scale));
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(pos[0], pos[1], pos[2]), q, s)); return g;
}

/** Ellipsoidal base surface used to lay scutes (plates) on: P(th,ph) and N(th,ph); th 0..PI from +Y pole, ph 0..2PI from +Z towards +X. */
export function ellipsoidBase(cx, cy, cz, rx, ry, rz) {
  return {
    P(th, ph, o) { return o.set(cx + rx * Math.sin(th) * Math.sin(ph), cy + ry * Math.cos(th), cz + rz * Math.sin(th) * Math.cos(ph)); },
    N(th, ph, o) { return o.set(Math.sin(th) * Math.sin(ph) / rx, Math.cos(th) / ry, Math.sin(th) * Math.cos(ph) / rz).normalize(); },
    rx, ry, rz, c: [cx, cy, cz],
  };
}
/**
 * A raised chitin plate laid on a base surface: oval (dth x dph half extents in radians), flat-topped with a bevelled edge that melts into the base.
 * thick in metres; rot rotates the oval in (th,ph) space; edge exponent e (2 = ellipse, >2 = squarer plate).
 */
export function scute(base, th0, ph0, dth, dph, thick, { na = 18, nr = 4, rot = 0, e = 2.6, tile = 4, bevel = 0.28, seed = 0 } = {}) {
  const pos = [], uv = [], idx = [], p = new THREE.Vector3(), n = new THREE.Vector3();
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const sizeA = dth * (base.ry + base.rx + base.rz) / 3 * 2, sizeB = dph * Math.max(0.3, Math.sin(th0)) * (base.rx + base.rz) / 2 * 2;
  const vert = (s, ang) => {
    const a = Math.cos(ang) * s, b = Math.sin(ang) * s; // superellipse radius scaling so the outline is squarish for e>2
    const k = Math.pow(Math.pow(Math.abs(Math.cos(ang)), e) + Math.pow(Math.abs(Math.sin(ang)), e), -1 / e);
    const aa = a * k, bb = b * k; const da = aa * cr - bb * sr, db = aa * sr + bb * cr;
    const th = Math.min(Math.PI - 0.001, Math.max(0.001, th0 + da * dth)), ph = ph0 + db * dph;
    base.P(th, ph, p); base.N(th, ph, n);
    const prof = sstep(1.0, 1.0 - bevel, s); const dome = 1 + 0.18 * (1 - s * s);
    p.addScaledVector(n, thick * prof * dome + (s > 0.999 ? -0.01 : 0.01));
    pos.push(p.x, p.y, p.z); uv.push(0.5 + aa * sizeA / tile * 0.5 + seed * 0.37, 0.5 + bb * sizeB / tile * 0.5 + seed * 0.61);
  };
  vert(0, 0);
  for (let r = 1; r <= nr; r++) for (let i = 0; i <= na; i++) vert(r / nr, (i / na) * Math.PI * 2);
  for (let i = 0; i < na; i++) idx.push(0, 1 + i + 1, 1 + i);
  for (let r = 1; r < nr; r++) for (let i = 0; i < na; i++) { const a = 1 + (r - 1) * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return orient(g, base.c[0], base.c[1], base.c[2]);
}

/** Merge many geometries (must all be indexed with position/normal/uv). Adds missing uv. */
export function mergeAll(list) {
  const out = list.map((g) => { if (!g.index) { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
  return mergeGeometries(out, false);
}

/**
 * SkinSet: collect parts per material key, each rigidly bound to a bone (add) or blended between bones (addBlend),
 * then build() -> single geometry with groups (one per material key, in `keys` order) + skinIndex/skinWeight/color attributes.
 */
export class SkinSet {
  constructor(matKeys) { this.keys = matKeys; this.b = {}; for (const k of matKeys) this.b[k] = []; }
  _prep(g, color, matrix, wFn, bone) {
    if (!g.index) { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, p = g.attributes.position;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), col = new Float32Array(n * 3);
    const c = new THREE.Color(); const cf = typeof color === 'function';
    if (!cf) c.set(color == null ? 0xffffff : color);
    const nrm = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (wFn) { const w = wFn(x, y, z); si[i * 4] = w[0]; sw[i * 4] = w[1]; si[i * 4 + 1] = w[2] ?? 0; sw[i * 4 + 1] = w[3] ?? 0; }
      else { si[i * 4] = bone; sw[i * 4] = 1; }
      if (cf) { const r = color(x, y, z, nrm.getX(i), nrm.getY(i), nrm.getZ(i)); col[i * 3] = r[0]; col[i * 3 + 1] = r[1]; col[i * 3 + 2] = r[2]; } else { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (matrix) g.applyMatrix4(matrix);
    return g;
  }
  add(key, geo, bone, { color = 0xffffff, matrix = null } = {}) { this.b[key].push(this._prep(geo, color, matrix, null, bone)); return this; }
  addBlend(key, geo, wFn, { color = 0xffffff, matrix = null } = {}) { this.b[key].push(this._prep(geo, color, matrix, wFn, 0)); return this; }
  build() {
    const keys = [], parts = [];
    for (const k of this.keys) if (this.b[k].length) { keys.push(k); parts.push(mergeGeometries(this.b[k], false)); }
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, true);
    if (parts.length === 1) geometry.addGroup(0, geometry.index.count, 0);
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    return { geometry, keys };
  }
}

/** 2-bone IK: returns knee position in `out` for hip h, target t, lengths l1,l2, pole direction (need not be orthogonal). */
export function ik2(h, t, l1, l2, pole, out) {
  const d = _a.subVectors(t, h); let len = d.length(); const maxL = (l1 + l2) * 0.9995, minL = Math.abs(l1 - l2) + 0.05;
  len = Math.min(maxL, Math.max(minL, len)); d.normalize();
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pp = _b.copy(pole); pp.addScaledVector(d, -pp.dot(d)); if (pp.lengthSq() < 1e-8) pp.set(1, 0, 0); pp.normalize();
  return out.copy(h).addScaledVector(d, a).addScaledVector(pp, hh);
}

/** triangle / mesh / draw-call statistics of a model (instanced meshes count once per draw call; their per-instance triangles are reported as tris) */
export function assetStats(root) {
  let tris = 0, meshes = 0, instTris = 0, calls = 0;
  root.traverse((o) => {
    if (!(o.isMesh || o.isSprite || o.isPoints)) return;
    if (o.visible === false) return;
    const g = o.geometry; const mats = Array.isArray(o.material) ? o.material.length : 1; meshes++;
    calls += g && g.groups && g.groups.length > 1 ? g.groups.length : 1;
    const t = g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0;
    if (o.isInstancedMesh) instTris += t; tris += o.isInstancedMesh ? t * (o.count || 1) : t;
  });
  return { tris: Math.round(tris), meshes, drawCalls: calls, perInstanceTris: Math.round(instTris) };
}
