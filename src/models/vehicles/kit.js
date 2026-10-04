// Shared kit for every vehicle / machine in src/models/vehicles.js
// geometry helpers (Parts builder, lofts along Z, wheels), procedural textures (all `cached`), materials (infectable + damageable),
// the common Vehicle controller (wheel spin, suspension, steering, lights, infection, damage) and the smoke/flame plume FX.
import * as THREE from 'three';
import { Q, RNG, clamp, lerp, damp, smoothstep, TAU, DEG, GLOBAL, seg, disposeTree } from '../../engine/common.js';
import { canvasTex, normalTex, paintNoise, speckle, texRes, cached, makeCanvas, texFromCanvas, fbm2, noise2 } from '../../engine/proc.js';
import { infectable, setInfection as setInfectionTree } from '../../engine/infect.js';
import { mergeGeometries, roundedBox } from '../../engine/geo.js';

export { Q, mergeGeometries, THREE, RNG, clamp, lerp, damp, smoothstep, TAU, DEG, GLOBAL, seg, disposeTree, cached, texRes, canvasTex, normalTex, paintNoise, speckle, fbm2, noise2, roundedBox, infectable };

// ───────────────────────────── geometry helpers ─────────────────────────────
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const arr3 = (a, d = 0) => (a === undefined ? [d, d, d] : typeof a === 'number' ? [a, a, a] : a.isVector3 ? [a.x, a.y, a.z] : a);

/** keep only position/normal/uv and make indexed, so any geometries can be merged */
export function norm(g) {
  const n = g.attributes.position.count;
  if (!g.index) { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
/** transform a geometry in place: o = {pos, rot(euler xyz), scale(number|array), mirrorX} */
export function xf(g, o = {}) {
  const pos = arr3(o.pos, 0), rot = arr3(o.rot, 0), sc = arr3(o.scale, 1);
  _m4.compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(sc[0], sc[1], sc[2]));
  if (o.mirrorX) _m4.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  g.applyMatrix4(_m4);
  if (_m4.determinant() < 0 && g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; }
  return g;
}
/** Collects geometry per material key, merges at the end. add(key, geo, {pos,rot,scale,mirror}) — mirror adds a copy across x=0 */
export class Parts {
  constructor() { this.m = {}; }
  add(key, geo, o = {}) {
    const push = (opts) => { const g = norm(geo.clone()); xf(g, opts); if (o.uv) o.uv(g); (this.m[key] ||= []).push(g); };
    push(o); if (o.mirror) push({ ...o, mirrorX: true });
    return this;
  }
  /** returns {key: mergedGeometry} flagged shared (cache-friendly) */
  geos(shared = true) {
    const out = {};
    for (const k in this.m) { const g = mergeGeometries(this.m[k], false); g.computeBoundingSphere(); g.computeBoundingBox(); if (shared) g.userData.shared = true; out[k] = g; this.m[k].forEach((x) => x.dispose()); }
    return out;
  }
}
/** Build meshes from a {key:geometry} set and {key:material} set; returns Group. skip keys that have no material. */
export function assemble(geos, mats, { cast = true, receive = true, exclude = [] } = {}) {
  const g = new THREE.Group();
  for (const k in geos) { if (exclude.includes(k)) continue; const m = mats[k]; if (!m) { console.warn('vehicles kit: missing material', k); continue; } const mesh = new THREE.Mesh(geos[k], m); mesh.name = k; mesh.castShadow = cast && !m.transparent; mesh.receiveShadow = receive; g.add(mesh); }
  return g;
}
// primitives (fresh geometry each call)
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = 0.02, s = 1) => roundedBox(w, h, d, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3), s);
export const cyl = (rt, rb, h, radial = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg(radial, 5), 1, open);
export const cylX = (rt, rb, h, radial = 16, open = false) => cyl(rt, rb, h, radial, open).rotateZ(Math.PI / 2);
export const cylZ = (rt, rb, h, radial = 16, open = false) => cyl(rt, rb, h, radial, open).rotateX(Math.PI / 2);
export const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, seg(w, 6), seg(h, 4));
export const ell = (rx, ry, rz, w = 14, h = 10) => sph(1, w, h).scale(rx, ry, rz);
export const tor = (R, r, radial = 8, tubular = 20, arc = TAU) => new THREE.TorusGeometry(R, r, seg(radial, 4), seg(tubular, 6), arc);
export const plane = (w, h) => new THREE.PlaneGeometry(w, h);
/** cylinder from p0 to p1 */
export function between(p0, p1, r0, r1 = r0, radial = 8) {
  const a = arr3(p0), b = arr3(p1); const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = d.length() || 1e-4;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg(radial, 4), 1, false); // top r1 at p1
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); return g;
}
/** box from p0 to p1 with cross-section w (perp. to `up`) x d */
export function boxBetween(p0, p1, w, d, up = [0, 1, 0]) {
  const a = new THREE.Vector3(...arr3(p0)), b = new THREE.Vector3(...arr3(p1)); const dir = b.clone().sub(a); const len = dir.length() || 1e-4; dir.normalize();
  const g = new THREE.BoxGeometry(w, d, len); // length along z
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(...up), dir); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize(); const y = new THREE.Vector3().crossVectors(dir, x);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, dir)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g;
}
/** Extrude a side profile polygon [[z,y],...] across x (width w, centred) with bevel. */
export function sideSlab(profile, w, bevel = 0.02) {
  const sh = new THREE.Shape(profile.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, w - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(w - bevel * 2) / 2); g.rotateY(-Math.PI / 2); return g;
}
/** Extrude a plan/front polygon [[x,y],...] along z (depth d, centred) with bevel (shape stays in XY, extrusion along z). */
export function polyExtrude(poly, d, bevel = 0.01) {
  const sh = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(d - bevel * 2) / 2); return g;
}
/** Lathe about +Y from [[r,y],...] */
export function lath(profile, radial = 24, a0 = 0, a1 = TAU) { const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), seg(radial, 5), a0, a1 - a0); g.computeVertexNormals(); return g; }
/** planar uv projection from an axis with offset/scale: axis 'x'|'y'|'z' = viewing direction */
export function projUV(g, axis, { u0 = 0, u1 = 1, v0 = 0, v1 = 1, a0 = 0, a1 = 1, b0 = 0, b1 = 1, flipU = false } = {}) {
  // maps coordinates (a,b) from [a0,a1]x[b0,b1] to uv [u0,u1]x[v0,v1]
  const p = g.attributes.position; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); let a, b;
    if (axis === 'x') { a = z; b = y; } else if (axis === 'y') { a = x; b = z; } else { a = x; b = y; }
    let u = (a - a0) / (a1 - a0); if (flipU) u = 1 - u;
    uv[i * 2] = lerp(u0, u1, u); uv[i * 2 + 1] = lerp(v0, v1, (b - b0) / (b1 - b0));
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
/** Monotone cubic interpolator through [[x,y],...] (no overshoot) -> f(x) */
export function pw(pts) {
  const n = pts.length; if (n === 1) return () => pts[0][1];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / ((xs[i + 1] - xs[i]) || 1e-9));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; } else { const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } } }
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const F = (v) => (typeof v === 'function' ? v : () => v);
/**
 * Loft of superellipse cross-sections along Z (cars, trucks, hulls, fuselages).
 * spec: { z0, z1, n=44, w(z) half-width at the bottom (number|fn), wt(z) half-width at top (default w), yb(z), yt(z), p(z)=3.2 exponent (2 ellipse .. 8 boxy),
 *         cx(z)=0, round:[rBack, rFront] plan rounding of the ends (m), roundQ=2.4, roundY=0.3, radial=28, caps=true, uvY:[y0,y1] }
 * returns geometry with side-projected UV (u = z fraction, v = y fraction) and .userData.surf = analytic helpers (xAt, yTopAt, yBotAt)
 */
export function loftZ(spec) {
  const { z0, z1, n = 44, p = 3.2, round = [0, 0], roundQ = 2.4, roundY = 0.3, caps = true } = spec; const radial = seg(spec.radial || 28, 12);
  const w = F(spec.w), wt = spec.wt ? F(spec.wt) : w, yb = F(spec.yb), yt = F(spec.yt), pp = F(p), cx = F(spec.cx || 0);
  const kEnd = (z) => { let k = 1; const dB = z - z0, dF = z1 - z; if (round[0] > 0 && dB < round[0]) { const u = 1 - dB / round[0]; k = Math.min(k, Math.pow(Math.max(0, 1 - Math.pow(u, roundQ)), 1 / roundQ)); } if (round[1] > 0 && dF < round[1]) { const u = 1 - dF / round[1]; k = Math.min(k, Math.pow(Math.max(0, 1 - Math.pow(u, roundQ)), 1 / roundQ)); } return k; };
  const sec = (z) => { const k = Math.max(0.02, kEnd(z)); const b = yb(z), t = yt(z), yc = (b + t) / 2, hh = (t - b) / 2 * (1 - (1 - k) * roundY); return { wb: w(z) * k, wt: wt(z) * k, yc, hh, p: pp(z), cx: cx(z) }; };
  const secs = []; for (let i = 0; i <= n; i++) { const u = 0.5 - 0.5 * Math.cos(Math.PI * i / n); const z = lerp(z0, z1, u); secs.push({ z, ...sec(z) }); }
  let ymin = 1e9, ymax = -1e9; for (const s of secs) { ymin = Math.min(ymin, s.yc - s.hh); ymax = Math.max(ymax, s.yc + s.hh); }
  if (spec.uvY) { ymin = spec.uvY[0]; ymax = spec.uvY[1]; }
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const s = secs[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU, ca = Math.cos(a), sa = Math.sin(a); const e = 2 / s.p;
      const ux = Math.sign(ca) * Math.pow(Math.abs(ca), e), uy = Math.sign(sa) * Math.pow(Math.abs(sa), e);
      const ww = lerp(s.wb, s.wt, (uy + 1) / 2); const y = s.yc + uy * s.hh;
      pos.push(s.cx + ux * ww, y, s.z); uv.push((s.z - z0) / (z1 - z0), (y - ymin) / (ymax - ymin));
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const addCap = (i, front) => {
    const s = secs[i]; const base = pos.length / 3; const ring = []; for (let j = 0; j <= radial; j++) { const o = (i * (radial + 1) + j) * 3; pos.push(pos[o], pos[o + 1], pos[o + 2]); uv.push(0.5, 0.5); ring.push(base + j); }
    const c = pos.length / 3; pos.push(s.cx, s.yc, s.z); uv.push(0.5, 0.5);
    for (let j = 0; j < radial; j++) { if (front) idx.push(c, ring[j], ring[j + 1]); else idx.push(c, ring[j + 1], ring[j]); }
  };
  if (caps) { addCap(0, false); addCap(n, true); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // orientation check: normals should point away from the section centre
  const P = g.attributes.position, N = g.attributes.normal; const mid = (n >> 1) * (radial + 1); let dot = 0; for (let j = 0; j < radial; j++) { const k = mid + j; dot += (P.getX(k) - secs[n >> 1].cx) * N.getX(k) + (P.getY(k) - secs[n >> 1].yc) * N.getY(k); }
  if (dot < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  // smooth the seam (j = 0 and j = radial duplicate) normals
  const Nn = g.attributes.normal; for (let i = 0; i <= n; i++) { const a = i * (radial + 1), b = a + radial; const nx = Nn.getX(a) + Nn.getX(b), ny = Nn.getY(a) + Nn.getY(b), nz = Nn.getZ(a) + Nn.getZ(b); const l = Math.hypot(nx, ny, nz) || 1; Nn.setXYZ(a, nx / l, ny / l, nz / l); Nn.setXYZ(b, nx / l, ny / l, nz / l); }
  const secAt = (z) => sec(clamp(z, z0, z1));
  g.userData.surf = {
    /** x of the side surface at (z, y) (right side, +x); null if y outside */
    xAt(z, y) { const s = secAt(z); const v = (y - s.yc) / s.hh; if (Math.abs(v) > 1) return null; const ww = lerp(s.wb, s.wt, (v + 1) / 2); return s.cx + ww * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v), s.p)), 1 / s.p); },
    /** top surface y at (z, x) */
    yTopAt(z, x) { const s = secAt(z); const ww = s.wt; const u = Math.abs(x - s.cx) / ww; if (u > 1) return null; return s.yc + s.hh * Math.pow(Math.max(0, 1 - Math.pow(u, s.p)), 1 / s.p); },
    yBotAt(z, x) { const s = secAt(z); const u = Math.abs(x - s.cx) / s.wb; if (u > 1) return null; return s.yc - s.hh * Math.pow(Math.max(0, 1 - Math.pow(u, s.p)), 1 / s.p); },
  };
  return g;
}

// ───────────────────────────── wheels ─────────────────────────────
/**
 * Wheel geometry set (axle along X, centred on origin). Returns {tire, rim, disc?} (shared geometry, cached).
 * style: 'alloy5' | 'alloy10' | 'steel' | 'mag' (jeepney chrome spoke) | 'truck' | 'bike' | 'moped'
 */
export function wheelGeos({ r = 0.33, w = 0.22, rim = 0.2, style = 'alloy5', detail = 1 } = {}) {
  const key = `wheel:${r.toFixed(3)}:${w.toFixed(3)}:${rim.toFixed(3)}:${style}:${detail}:${Q.detail}`;
  return cached(key, () => {
    const radial = detail > 0 ? 32 : 14; const out = {};
    // tyre: profile (radius, axial) -> lathe around Y, then rotate so axis = X
    const hw = w / 2, sw = (r - rim) * 0.55; const tp = [];
    const cornerR = Math.min(hw * 0.55, (r - rim) * 0.4);
    tp.push([rim - 0.004, -hw * 0.82], [rim + sw * 0.35, -hw * 0.97], [rim + sw * 0.9, -hw * 1.0]);
    const shoulderY = -hw * 0.78, rr = r - cornerR * 0.55;
    tp.push([rr - cornerR * 0.45, -hw * 1.0], [r - cornerR * 0.18, -hw * 0.93], [r - 0.002, shoulderY * 0.85], [r, -hw * 0.5], [r, -hw * 0.18], [r, hw * 0.18], [r, hw * 0.5], [r - 0.002, -shoulderY * 0.85], [r - cornerR * 0.18, hw * 0.93], [rr - cornerR * 0.45, hw * 1.0]);
    tp.push([rim + sw * 0.9, hw * 1.0], [rim + sw * 0.35, hw * 0.97], [rim - 0.004, hw * 0.82]);
    const tire = lath(tp, radial); // uv: u around, v along profile
    tire.rotateZ(-Math.PI / 2); out.tire = norm(tire);
    // rim pieces
    const rp = new Parts(); const barrelHalf = hw * 0.78;
    const lip = lath([[rim + 0.012, -barrelHalf - 0.01], [rim + 0.004, -barrelHalf], [rim - 0.008, -barrelHalf * 0.8], [rim - 0.02, -barrelHalf * 0.2], [rim - 0.02, barrelHalf * 0.2], [rim - 0.008, barrelHalf * 0.8], [rim + 0.004, barrelHalf], [rim + 0.012, barrelHalf + 0.01]], radial).rotateZ(-Math.PI / 2);
    rp.add('rim', lip);
    const faceX = hw * 0.55; // outward face offset (wheel outer side = +x for the right wheel; mirrored for left by rotation)
    const dishPts = [[rim - 0.02, barrelHalf * 0.5], [rim * 0.8, faceX * 0.72], [rim * 0.5, faceX * 0.85], [rim * 0.2, faceX], [0.0, faceX]];
    const nsp = style === 'alloy10' ? 10 : style === 'alloy5' ? 5 : style === 'mag' ? 8 : style === 'truck' ? 10 : 6;
    if (style === 'steel' || style === 'truck') {
      rp.add('rim', lath(dishPts, radial).rotateZ(-Math.PI / 2));
      // stamped holes as dark discs
      for (let i = 0; i < nsp; i++) { const a = (i / nsp) * TAU; rp.add('disc', cyl(rim * 0.12, rim * 0.12, 0.012, 8), { pos: [faceX * 0.78 + 0.004, Math.sin(a) * rim * 0.55, Math.cos(a) * rim * 0.55], rot: [0, 0, Math.PI / 2] }); }
      rp.add('rim', lath([[rim * 0.3, faceX], [rim * 0.26, faceX + 0.025], [rim * 0.12, faceX + 0.04], [0, faceX + 0.04]], 14).rotateZ(-Math.PI / 2)); // hub cap
    } else if (style === 'bike' || style === 'moped') {
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; rp.add('rim', between([0, Math.sin(a) * rim * 0.12, Math.cos(a) * rim * 0.12], [(i % 2 ? 1 : -1) * hw * 0.5, Math.sin(a + 0.1) * (rim - 0.02), Math.cos(a + 0.1) * (rim - 0.02)], 0.0035, 0.0035, 4)); }
      rp.add('rim', cylX(rim * 0.2, rim * 0.2, hw * 1.2, 10));
    } else {
      // spokes: tapered boxes from hub to barrel
      for (let i = 0; i < nsp; i++) {
        const a = (i / nsp) * TAU + (style === 'mag' ? 0.2 : 0); const thick = style === 'alloy10' ? 0.014 : style === 'mag' ? 0.012 : 0.024; const wide0 = style === 'alloy10' ? 0.02 : style === 'mag' ? 0.018 : 0.05, wide1 = style === 'alloy10' ? 0.012 : style === 'mag' ? 0.01 : 0.034;
        const g = new THREE.BufferGeometry(); const verts = [], ii = [];
        // spoke as a skewed prism in local (axial=x, radial=y)
        const pts = [[faceX - 0.005, rim * 0.16, -wide0], [faceX - 0.005, rim * 0.16, wide0], [faceX * 0.66, rim * 0.93, wide1], [faceX * 0.66, rim * 0.93, -wide1]];
        const g2 = new THREE.BufferGeometry(); const P = [];
        for (const [ax, rad, wd] of pts) { P.push(ax + thick, rad, wd); } for (const [ax, rad, wd] of pts) { P.push(ax - thick, rad, wd); }
        const I = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
        g2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g2.setIndex(I); g2.computeVertexNormals();
        g2.rotateX(a);
        rp.add('rim', g2);
      }
      rp.add('rim', lath([[rim * 0.3, faceX], [rim * 0.27, faceX + 0.03], [rim * 0.13, faceX + 0.05], [0, faceX + 0.05]], 16).rotateZ(-Math.PI / 2));
      // lug nuts
      if (detail > 0) for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; rp.add('disc', cylX(0.011, 0.011, 0.012, 6), { pos: [faceX + 0.006, Math.sin(a) * rim * 0.22, Math.cos(a) * rim * 0.22] }); }
      // brake disc + caliper visible behind spokes
      if (detail > 0 && (style === 'alloy5' || style === 'alloy10')) { rp.add('disc', cylX(rim * 0.78, rim * 0.78, 0.014, 28), { pos: [-faceX * 0.25, 0, 0] }); rp.add('disc', rbox(0.06, rim * 0.5, 0.1, 0.01), { pos: [-faceX * 0.25 + 0.003, rim * 0.25, rim * 0.5], rot: [-0.6, 0, 0] }); }
    }
    const geos = rp.geos(); out.rim = geos.rim; if (geos.disc) out.disc = geos.disc; out.tire.userData.shared = true; return out;
  });
}

// ───────────────────────────── textures ─────────────────────────────
const ts = (n) => texRes(n);
export const TX = {
  /** tyre tread normal (u = around, v = across) */
  tread() { return cached('veh:tread', () => normalTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    // sidewall lettering ring + tread blocks in the middle 40%
    ctx.fillStyle = '#9a9a9a'; for (let i = 0; i < 24; i++) { ctx.fillRect(i * w / 24 + 2, h * 0.14, w / 48, h * 0.06); }
    for (let i = 0; i < 16; i++) for (let s = -1; s <= 1; s += 2) { ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); const x = i * w / 16, y0 = h * 0.5; ctx.moveTo(x, y0); ctx.lineTo(x + w / 32, y0 + s * h * 0.17); ctx.lineTo(x + w / 16 - 3, y0 + s * h * 0.17); ctx.lineTo(x + w / 16 - 3 - w / 32, y0); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#303030'; ctx.fillRect(0, h * 0.5 - 2, w, 4); ctx.fillRect(0, h * 0.34, w, 3); ctx.fillRect(0, h * 0.64, w, 3);
    speckle(ctx, w, h, { count: 800, colors: ['#707070', '#909090'], alpha: [0.3, 0.6], size: [1, 2] });
  }, { strength: 2.2, repeat: [6, 1] })); },
  /** fine orange-peel / panel normal for paint */
  peel() { return cached('veh:peel', () => normalTex(ts(256), ts(256), (ctx, w, h) => { paintNoise(ctx, w, h, { scale: 40, oct: 3, a: '#707070', b: '#a0a0a0' }); }, { strength: 0.9, repeat: [5, 3] })); },
  /** coarse hammered-metal normal (military, trucks) */
  hammered() { return cached('veh:hammered', () => normalTex(ts(256), ts(256), (ctx, w, h) => { paintNoise(ctx, w, h, { scale: 14, oct: 4, a: '#606060', b: '#b0b0b0' }); speckle(ctx, w, h, { count: 900, colors: ['#fff', '#000'], alpha: [0.2, 0.5], size: [1, 3], seed: 7 }); }, { strength: 1.6, repeat: [3, 3] })); },
  /** diamond-plate / knurled */
  diamond() { return cached('veh:diamond', () => normalTex(128, 128, (ctx, w, h) => { ctx.fillStyle = '#707070'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f0f0f0'; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const x = (i + (j % 2) * 0.5) * w / 8 + w / 16, y = j * h / 8 + h / 16; ctx.save(); ctx.translate(x, y); ctx.rotate(j % 2 ? 0.8 : -0.8); ctx.fillRect(-w / 28, -h / 70, w / 14, h / 35); ctx.restore(); } }, { strength: 2.5, repeat: [4, 4] })); },
  /** grille mesh (alpha-less, used as bump + dark base) */
  weave() { return cached('veh:weave', () => normalTex(128, 128, (ctx, w, h) => { ctx.fillStyle = '#404040'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 6; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 8); ctx.lineTo(w, i * h / 8 + 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8 + 2, h); ctx.stroke(); } }, { strength: 3, repeat: [3, 3] })); },
  /** vinyl / leatherette seat normal with stitching & grain */
  vinyl() { return cached('veh:vinyl', () => normalTex(ts(256), ts(256), (ctx, w, h) => { paintNoise(ctx, w, h, { scale: 70, oct: 2, a: '#808080', b: '#b8b8b8' }); ctx.strokeStyle = '#303030'; ctx.lineWidth = 3; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke(); } }, { strength: 1.4, repeat: [2, 2] })); },
  /** fabric weave normal */
  fabric() { return cached('veh:fabric', () => normalTex(128, 128, (ctx, w, h) => { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 32; i++) { ctx.fillStyle = i % 2 ? '#b0b0b0' : '#606060'; ctx.fillRect(i * 4, 0, 2, h); ctx.fillStyle = i % 2 ? '#606060' : '#b0b0b0'; ctx.fillRect(0, i * 4, w, 2); } }, { strength: 1.2, repeat: [6, 6] })); },
  /** streaky glass reflection alpha (0.55 base) */
  glassAlpha() { return cached('veh:glassa', () => canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8c8c8c'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.rotate(-0.5); for (let i = 0; i < 6; i++) { const x = -40 + i * 42 + (i % 2) * 8; const g = ctx.createLinearGradient(x, 0, x + 18, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, -40, 18 + (i % 3) * 8, 260); } ctx.restore();
  }, { srgb: false })); },
  /** soft round smoke puff alpha */
  puff() { return cached('veh:puff', () => canvasTex(64, 64, (ctx, w, h) => { const r = new RNG(5); const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { const x = r.range(14, 50), y = r.range(14, 50), rr = r.range(6, 14); const g2 = ctx.createRadialGradient(x, y, 0, x, y, rr); g2.addColorStop(0, 'rgba(255,255,255,0.25)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); } }, { wrap: 'clamp' })); },
  /** flame sprite */
  flame() { return cached('veh:flame', () => canvasTex(64, 128, (ctx, w, h) => { const g = ctx.createRadialGradient(32, 90, 2, 32, 80, 56); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.35, 'rgba(255,190,70,0.9)'); g.addColorStop(0.7, 'rgba(255,90,20,0.45)'); g.addColorStop(1, 'rgba(255,40,0,0)'); ctx.fillStyle = g; ctx.save(); ctx.translate(32, 0); ctx.scale(0.55, 1); ctx.translate(-32, 0); ctx.fillRect(0, 0, w + 40, h); ctx.restore(); }, { wrap: 'clamp' })); },
  /** worn grime (white = clean). u across, v = bottom dirt gradient */
  grime() { return cached('veh:grime', () => canvasTex(ts(256), ts(256), (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    paintNoise(ctx, w, h, { scale: 5, oct: 4, a: '#ffffff', b: '#8a7d6d', contrast: 1.6, alpha: 0.35, blend: true, seed: 3 });
    const g = ctx.createLinearGradient(0, h, 0, h * 0.5); g.addColorStop(0, 'rgba(70,58,44,0.6)'); g.addColorStop(1, 'rgba(70,58,44,0)'); ctx.fillStyle = g; ctx.fillRect(0, h * 0.5, w, h * 0.5);
    speckle(ctx, w, h, { count: 500, colors: ['#554'], alpha: [0.05, 0.25], size: [1, 3], seed: 9 });
  })); },
  /** metal panel wear: brushed streak normal for chrome/steel */
  brushed() { return cached('veh:brushed', () => normalTex(ts(256), 64, (ctx, w, h) => { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); const r = new RNG(11); for (let i = 0; i < 260; i++) { ctx.fillStyle = r.chance(0.5) ? '#9a9a9a' : '#666'; ctx.fillRect(r.range(0, w), r.range(0, h), r.range(20, 120), 1); } }, { strength: 0.6, repeat: [2, 2] })); },
  /** military camo (NATO-ish 3 colour) */
  camo(a = '#4b5232', b = '#2d3220', c = '#7a6c4a', key = 'camo') { return cached('veh:' + key, () => canvasTex(ts(512), ts(512), (ctx, w, h) => {
    paintNoise(ctx, w, h, { scale: 3, oct: 3, a, b: a }); const img = ctx.getImageData(0, 0, w, h); const d = img.data; const A = new THREE.Color(a), B = new THREE.Color(b), C = new THREE.Color(c);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = x / w * 4, v = y / h * 4; const n = fbm2(u, v, 3), m = fbm2(u + 17, v + 9, 3); const col = n > 0.58 ? B : m > 0.6 ? C : A; const i = (y * w + x) * 4; const f = 0.92 + 0.16 * fbm2(u * 6, v * 6, 2); d[i] = col.r * 255 * f; d[i + 1] = col.g * 255 * f; d[i + 2] = col.b * 255 * f; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0); speckle(ctx, w, h, { count: 1500, colors: ['#000', '#fff'], alpha: [0.03, 0.12], size: [1, 3], seed: 2 });
  })); },
};
/** license plate texture (cached by text+style) */
export function plateTex(text, style = 'ph') {
  return cached(`veh:plate:${style}:${text}`, () => canvasTex(256, 128, (ctx, w, h) => {
    const bg = { ph: '#f5f5f0', us: '#e8e8e0', eu: '#f4f4ea', mil: '#222a1c', yellow: '#e6b800' }[style] || '#f5f5f0'; const fg = { ph: '#203a8a', us: '#1b2a6a', eu: '#111', mil: '#e8e0b0', yellow: '#111' }[style] || '#111';
    const rr = (x, y, ww, hh, r) => { ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath(); };
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = bg; ctx.beginPath(); rr(5, 5, w - 10, h - 10, 12); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.beginPath(); rr(11, 11, w - 22, h - 22, 8); ctx.stroke();
    if (style === 'eu') { ctx.fillStyle = '#1a3fa0'; ctx.fillRect(5, 5, 26, h - 10); ctx.fillStyle = '#ffd400'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 18, h / 2); }
    ctx.fillStyle = fg; ctx.font = 'bold 66px "Liberation Sans", "DejaVu Sans", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2 + (style === 'eu' ? 10 : 0), h / 2 + 4);
    if (style === 'ph') { ctx.font = 'bold 15px sans-serif'; ctx.fillText('PHILIPPINES', w / 2, 24); }
    if (style === 'us') { ctx.font = 'bold 14px sans-serif'; ctx.fillText('CALIFORNIA', w / 2, 25); }
    speckle(ctx, w, h, { count: 300, colors: ['#000', '#665'], alpha: [0.05, 0.3], size: [1, 2], seed: text.length });
  }, { wrap: 'clamp' }));
}
export function randPlate(r, style = 'ph') { const L = 'ABCDEFGHJKLMNPRSTUVWXYZ', D = '0123456789'; const l = () => L[r.int(0, L.length - 1)], d = () => D[r.int(0, 9)]; return style === 'us' ? `${r.int(1, 9)}${l()}${l()}${l()}${d()}${d()}${d()}` : style === 'eu' ? `B ${l()}${l()} ${d()}${d()}${d()}` : `${l()}${l()}${l()} ${d()}${d()}${d()}${d()}`; }

// ───────────────────────────── damage shader patch ─────────────────────────────
const DM_GLSL = /* glsl */`
float _dh(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float _dn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(_dh(i),_dh(i+vec3(1,0,0)),f.x),mix(_dh(i+vec3(0,1,0)),_dh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(_dh(i+vec3(0,0,1)),_dh(i+vec3(1,0,1)),f.x),mix(_dh(i+vec3(0,1,1)),_dh(i+vec3(1,1,1)),f.x),f.y),f.z); }
float _dfield(vec3 p){ return _dn(p*vec3(1.7,2.3,1.9)) * 0.75 + _dn(p*6.0)*0.25; }
`;
/** dents (vertex) + scorch / rust / scratches (fragment) driven by uniform uDamage. opts.glass => cracks instead. Call BEFORE infectable(). */
export function damageable(mat, { glass = false, dent = 1 } = {}) {
  const u = { value: 0 }; mat.userData.uDamage = u;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev.call(mat, shader, r);
    shader.uniforms.uDamage = u;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uDamage; varying vec3 vDmPos;\n${DM_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvDmPos = position;\n${glass ? '' : `{ float f = _dfield(position); transformed -= normal * smoothstep(0.55, 0.85, f) * uDamage * ${(0.10 * dent).toFixed(3)}; }`}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uDamage; varying vec3 vDmPos;\n${DM_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uDamage > 0.001) {
          ${glass ? `
          float cr = abs(_dn(vDmPos*9.0)-0.5) ; float cr2 = abs(_dn(vDmPos*21.0+3.0)-0.5);
          float crack = (1.0 - smoothstep(0.0, 0.03, min(cr, cr2*1.3))) * smoothstep(0.1, 0.6, uDamage);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8), crack*0.6); diffuseColor.a = clamp(diffuseColor.a + crack*0.5 + uDamage*0.12, 0.0, 1.0);
          ` : `
          float f = _dfield(vDmPos); float f2 = _dn(vDmPos*13.0);
          float burn = smoothstep(0.50, 0.80, f + f2*0.25) * uDamage;
          float rust = smoothstep(0.55, 0.75, f2) * smoothstep(0.1, 0.7, uDamage) * (1.0-burn);
          float scr = (1.0 - smoothstep(0.0, 0.02, abs(_dn(vec3(vDmPos.x*40.0+vDmPos.y*13.0, vDmPos.z*5.0, vDmPos.y*40.0))-0.5))) * uDamage;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025,0.022,0.02), burn*0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30,0.14,0.06), rust*0.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7,0.7,0.68), scr*0.5);`}
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        ${glass ? '' : `if (uDamage > 0.001) {
          float h = _dfield(vDmPos) * uDamage;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(h), dhy = dFdy(h);
          vec3 R1 = cross(dpy, normal), R2 = cross(normal, dpx); float det = dot(dpx, R1);
          normal = normalize(abs(det) * normal - 2.5 * sign(det) * (dhx * R1 + dhy * R2));
        }`}`);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|dmg' + (glass ? 'G' : 'B') + dent;
  return mat;
}

/** Cut wheel-arch holes into a body material by discarding fragments inside circles (object space, YZ plane) for |x| > xMin. arches: [[z,y,r],...]. Call BEFORE damageable/infectable. */
export function archable(mat, arches, xMin = 0.4) {
  const key = arches.map((a) => a.map((v) => v.toFixed(3)).join(',')).join(';') + xMin;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev.call(mat, shader, r);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vArchPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvArchPos = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vArchPos;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n{ ${arches.map((a) => `if (abs(vArchPos.x) > ${xMin.toFixed(3)} && length(vArchPos.zy - vec2(${a[0].toFixed(4)}, ${a[1].toFixed(4)})) < ${a[2].toFixed(4)}) discard;`).join('\n')} }`);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|arch' + key;
  mat.side = THREE.DoubleSide; return mat;
}

/** GLSL snippet (statements) that `discard`s fragments inside window openings of a car glasshouse shell (object space, +z front).
 *  cfg: { side:[[ [z,y],... ], ...] polygons (side view, mirrored automatically), xMin, ws:{z0,z1,x0,x1} windshield, rear:{z0,z1,x0,x1} } */
export function windowCutGLSL(cfg, pos = 'vArchPos') {
  let fn = '', calls = [];
  (cfg.side || []).forEach((poly, k) => {
    const n = poly.length; const arr = poly.map((p) => `vec2(${p[0].toFixed(4)},${p[1].toFixed(4)})`).join(',');
    fn += `bool _wp${k}(vec2 p){ vec2 v[${n}] = vec2[${n}](${arr}); bool c=false; for(int i=0,j=${n - 1};i<${n};j=i++){ if(((v[i].y>p.y)!=(v[j].y>p.y)) && (p.x < (v[j].x-v[i].x)*(p.y-v[i].y)/(v[j].y-v[i].y)+v[i].x)) c=!c; } return c; }\n`;
    calls.push(`_wp${k}(${pos}.zy)`);
  });
  const reg = (r) => `(${pos}.z>${r.z0.toFixed(4)} && ${pos}.z<${r.z1.toFixed(4)} && abs(${pos}.x) < mix(${r.x0.toFixed(4)}, ${r.x1.toFixed(4)}, (${pos}.z-(${r.z0.toFixed(4)}))/${(r.z1 - r.z0).toFixed(4)}))`;
  let cond = calls.length ? `(abs(${pos}.x) > ${(cfg.xMin ?? 0.25).toFixed(3)} && (${calls.join(' || ')}))` : 'false';
  if (cfg.ws) cond += ' || ' + reg(cfg.ws); if (cfg.rear) cond += ' || ' + reg(cfg.rear);
  return { fn, test: cond };
}
export function windowable(mat, cfg) {
  const g = windowCutGLSL(cfg); const key = g.fn.length + ':' + g.test;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev.call(mat, shader, r);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWinPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWinPos = position;');
    const body = g.test.split('vArchPos').join('vWinPos'); const fn = g.fn.split('vArchPos').join('vWinPos');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWinPos;\n${fn}`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (${body}) discard;`);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|win' + key.length + hashCode(key);
  mat.side = THREE.DoubleSide; return mat;
}
function hashCode(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; return h; }

// ───────────────────────────── materials ─────────────────────────────
const col = (c) => new THREE.Color(c);
/** All factories return per-model material clones (infectable + damageable). */
export const mk = {
  paint(color = 0xcc2222, { metal = 0.55, rough = 0.28, map = null, clearcoat = 1, peel = true, normalScale = 0.18, arches = null, archX = 0.4, windows = null } = {}) {
    const m = new THREE.MeshPhysicalMaterial({ color, metalness: metal, roughness: rough, clearcoat, clearcoatRoughness: 0.07, map, normalMap: peel ? TX.peel() : null, normalScale: new THREE.Vector2(normalScale, normalScale), envMapIntensity: 1.0 });
    if (arches) archable(m, arches, archX);
    if (windows) windowable(m, windows);
    return infectable(damageable(m));
  },
  flat(color = 0x888888, { rough = 0.7, metal = 0.1, map = null, normalMap = null, normalScale = 0.5, side } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map, normalMap, normalScale: new THREE.Vector2(normalScale, normalScale) }); if (side !== undefined) m.side = side; return infectable(damageable(m));
  },
  chrome({ rough = 0.12, color = 0xf2f4f8 } = {}) { return infectable(damageable(new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough, envMapIntensity: 1.5, normalMap: TX.brushed(), normalScale: new THREE.Vector2(0.15, 0.15) }), { dent: 0.2 })); },
  metal(color = 0x8a8f96, { rough = 0.4, metal = 0.9, normal = null, ns = 0.4, map = null } = {}) { return infectable(damageable(new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, normalMap: normal, normalScale: new THREE.Vector2(ns, ns), map }), { dent: 0.5 })); },
  rubber({ color = 0x151515, rough = 0.85, tread = false } = {}) { const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, normalMap: tread ? TX.tread() : TX.fabric(), normalScale: new THREE.Vector2(tread ? 1.1 : 0.3, tread ? 1.1 : 0.3) }); return infectable(damageable(m, { dent: 0 })); },
  plastic(color = 0x222222, { rough = 0.5, metal = 0.0 } = {}) { return infectable(damageable(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, normalMap: TX.fabric(), normalScale: new THREE.Vector2(0.15, 0.15) }), { dent: 0.2 })); },
  cloth(color = 0x884422, { rough = 0.9, map = null } = {}) { return infectable(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, map, normalMap: TX.fabric(), normalScale: new THREE.Vector2(0.6, 0.6), side: THREE.DoubleSide })); },
  vinyl(color = 0x6a1010, { rough = 0.45 } = {}) { return infectable(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, normalMap: TX.vinyl(), normalScale: new THREE.Vector2(0.7, 0.7) })); },
  /** tinted glass: translucent + env reflections (no transmission pass) */
  glass({ tint = 0x1a2a30, opacity = 0.55, rough = 0.04 } = {}) {
    const m = new THREE.MeshStandardMaterial({ color: tint, metalness: 0.2, roughness: rough, transparent: true, opacity, alphaMap: TX.glassAlpha(), envMapIntensity: 1.6, depthWrite: false });
    m.userData.baseTint = new THREE.Color(tint); m.userData.baseOpacity = opacity; m.userData.glass = true;
    return infectable(damageable(m, { glass: true }));
  },
  /** emissive lens (head/tail/indicator lights, screens). on = emissive intensity when lit */
  light(color = 0xfff2cc, { on = 3.0, off = 0.08, base = null, rough = 0.15 } = {}) {
    const m = new THREE.MeshStandardMaterial({ color: base ?? col(color).multiplyScalar(0.8), emissive: col(color), emissiveIntensity: off, roughness: rough, metalness: 0.0 });
    m.userData.light = { color: col(color), on, off }; return infectable(m);
  },
};

// ───────────────────────────── plume FX (smoke / fire; one draw call) ─────────────────────────────
/**
 * Billboard particle plume computed entirely in the vertex shader from GLOBAL.time.
 * opts: {count, color, size, height, rate, spread, additive, drift:[x,y,z], tex:'puff'|'flame', seed}
 * returns {mesh, setAmount(a), setDrift(x,y,z), set size...}
 */
export function createPlume({ count = 18, color = 0x1a1a1a, size = 0.8, height = 3, rate = 0.35, spread = 0.6, additive = false, drift = [0, 0, 0], tex = 'puff', seed = 1, opacity = 0.6 } = {}) {
  const r = new RNG(seed); const n = Math.max(4, Math.round(count * (0.5 + 0.5 * Q.particles)));
  const pos = [], uv = [], aP = [], idx = [];
  for (let i = 0; i < n; i++) {
    const p = [r.next(), r.next(), r.next(), r.range(0.7, 1.3)];
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) { pos.push(x, y, 0); uv.push(x + 0.5, y + 0.5); aP.push(...p); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aP', new THREE.Float32BufferAttribute(aP, 4)); g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * 0.5, 0), height + spread + size * 2);
  const u = { uTime: GLOBAL.time, uAmount: { value: 0 }, uHeight: { value: height }, uSize: { value: size }, uRate: { value: rate }, uSpread: { value: spread }, uDrift: { value: new THREE.Vector3(...drift) }, uColor: { value: col(color) }, uMap: { value: tex === 'flame' ? TX.flame() : TX.puff() }, uOpacity: { value: opacity } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute vec4 aP; uniform float uTime,uAmount,uHeight,uSize,uRate,uSpread; uniform vec3 uDrift; varying vec2 vUv; varying float vA;
      void main(){ float age = fract(uTime*uRate + aP.x*7.31); vec3 c = vec3((aP.y-0.5)*uSpread*(0.3+age)*2.0, age*uHeight, (aP.z-0.5)*uSpread*(0.3+age)*2.0) + uDrift*age;
        c.x += sin(uTime*1.3 + aP.x*20.0)*0.12*age; c.z += cos(uTime*1.1 + aP.z*20.0)*0.12*age;
        float sz = uSize*(0.35 + age*1.7)*aP.w; vec4 mv = modelViewMatrix*vec4(c,1.0); mv.xy += position.xy*sz; gl_Position = projectionMatrix*mv; vUv = uv;
        vA = smoothstep(0.0,0.1,age)*(1.0-age)*uAmount; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying float vA;
      void main(){ vec4 t = texture2D(uMap, vUv); float a = t.a * vA * uOpacity; if (a < 0.003) discard; gl_FragColor = vec4(uColor * (${additive ? '1.0' : '0.6 + 0.4*t.r'}), a); }`,
  });
  mat.userData.shared = false;
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 5;
  return { mesh, setAmount(a) { u.uAmount.value = a; mesh.visible = a > 0.01; }, setDrift(x, y, z) { u.uDrift.value.set(x, y, z); }, uniforms: u };
}

// ───────────────────────────── vehicle controller ─────────────────────────────
const GREEN = new THREE.Color(0x3cff1a);
/**
 * Common Vehicle behaviour.
 * cfg: { kind, root, chassis, wheels:[{spin:Object3D, steer:Object3D|null, r, side:+1|-1, front:bool, drive?:bool}], steeringWheel?:Object3D, steerRatio=4,
 *        lights:[{mat, role:'head'|'tail'|'signal'|'interior'}], glass:[mat], anchors, bounds:{length,width,height}, bobAmp=1, smokeAt:[x,y,z], plume?, onUpdate?(dt,t,S), onInfect?(a), onDamage?(d), seed }
 */
export function makeVehicle(cfg) {
  const { root, chassis } = cfg; const wheels = cfg.wheels || []; const rng = new RNG(cfg.seed || 7); const ph = rng.range(0, 100);
  const S = { v: 0, vPrev: 0, first: true, steer: 0, steerSm: 0, pitch: 0, roll: 0, spin: 0, travel: 0, lightsOn: false, lightK: 0, brake: 0, brakeSm: 0, inf: 0, dmg: 0, t: 0, accel: 0, yOff: 0, sag: 0, cam: 0 };
  const lights = cfg.lights || []; const glass = cfg.glass || [];
  let plume = null, fire = null;
  if (cfg.smokeAt) {
    plume = createPlume({ count: 18, color: 0x15110e, size: 1.1, height: 3.2, rate: 0.3, spread: 0.5, seed: 4, opacity: 0.7 });
    plume.mesh.position.set(...cfg.smokeAt); chassis.add(plume.mesh);
    fire = createPlume({ count: 9, color: 0xff9a40, size: 0.8, height: 0.8, rate: 1.3, spread: 0.3, additive: true, tex: 'flame', seed: 9, opacity: 0.9 });
    fire.mesh.position.set(cfg.smokeAt[0], cfg.smokeAt[1] - 0.15, cfg.smokeAt[2]); chassis.add(fire.mesh);
  }
  const api = {
    kind: cfg.kind, root, chassis, wheels, anchors: cfg.anchors || {}, crew: cfg.anchors || {}, bounds: cfg.bounds, speed: 0, props: cfg.props || {},
    setSpeed(mps) { S.v = mps; api.speed = mps; },
    /** director may also pass an exact travelled distance so wheels are pure functions of position */
    setTravel(m) { S.travelSet = m; },
    steer(rad) { S.steer = rad; },
    setBrake(a) { S.brake = a; },
    setLights(on) { S.lightsOn = !!on; if (S.first) { S.lightK = on ? 1 : 0; applyLights(); } },
    setInfection(a) {
      S.inf = clamp(a); setInfectionTree(root, S.inf);
      for (const m of glass) { m.color.copy(m.userData.baseTint).lerp(GREEN, S.inf * 0.35); m.opacity = lerp(m.userData.baseOpacity, Math.min(0.9, m.userData.baseOpacity + 0.25), S.inf); m.emissive?.copy(GREEN).multiplyScalar(S.inf * 0.1); }
      if (cfg.onInfect) cfg.onInfect(S.inf);
    },
    setDamage(d) {
      S.dmg = clamp(d); root.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) if (mm.userData?.uDamage) mm.userData.uDamage.value = S.dmg; });
      if (plume) { plume.setAmount(smoothstep(0.25, 0.7, S.dmg)); fire.setAmount(smoothstep(0.8, 1.0, S.dmg)); }
      if (cfg.onDamage) cfg.onDamage(S.dmg);
    },
    update(dt, t) {
      dt = clamp(dt, 0, 0.1); S.t = t; const v = S.v;
      if (S.first) { S.vPrev = v; S.first = false; }
      const accel = dt > 0 ? (v - S.vPrev) / dt : 0; S.vPrev = v; S.accel = damp(S.accel, clamp(accel, -12, 12), 8, dt);
      if (S.travelSet !== undefined) { S.spin = S.travelSet; } else { S.spin += v * dt; }
      S.steerSm = damp(S.steerSm, S.steer, 9, dt); S.brakeSm = damp(S.brakeSm, S.brake, 14, dt);
      for (const w of wheels) { w.spin.rotation.x = S.spin / w.r; if (w.steer) w.steer.rotation.y = S.steerSm * (w.steerK ?? 1); }
      if (cfg.steeringWheel) cfg.steeringWheel.rotation.z = -S.steerSm * (cfg.steerRatio ?? 4);
      // suspension: road roughness bob + idle shudder + load transfer
      const amp = (cfg.bobAmp ?? 1) * (0.0012 + 0.0075 * Math.min(1, Math.abs(v) / 14));
      const bob = (Math.sin(t * 7.3 + ph) * 0.55 + Math.sin(t * 13.1 + ph * 1.7) * 0.3 + Math.sin(t * 23.7 + ph * 0.6) * 0.15) * amp;
      const idle = Math.sin(t * 61.0 + ph) * 0.0006 * (1 - Math.min(1, Math.abs(v) / 2)) * (cfg.bobAmp ?? 1) * 1.5;
      const tp = clamp(-S.accel * 0.0045, -0.05, 0.05) * (cfg.pitchK ?? 1), tr = clamp(-S.steerSm * v * 0.0032, -0.07, 0.07) * (cfg.rollK ?? 1);
      S.pitch = damp(S.pitch, tp, 5, dt); S.roll = damp(S.roll, tr, 5, dt);
      const pn = (Math.sin(t * 5.3 + ph) * 0.4 + Math.sin(t * 9.7 + ph * 2.1) * 0.3) * amp * 0.5;
      chassis.position.y = bob + idle - S.dmg * 0.03; chassis.rotation.x = S.pitch + pn; chassis.rotation.z = S.roll + Math.sin(t * 6.1 + ph) * amp * 0.35 + S.dmg * 0.012;
      S.lightK = damp(S.lightK, S.lightsOn ? 1 : 0, 25, dt); applyLights();
      if (plume) plume.setDrift(0, 0, -clamp(v, 0, 30) * 0.18);
      if (cfg.onUpdate) cfg.onUpdate(dt, t, S);
    },
    dispose() { disposeTree(root); if (cfg.onDispose) cfg.onDispose(); },
    state: S,
  };
  function applyLights() {
    for (const L of lights) {
      const d = L.mat.userData.light; if (!d) continue;
      let k = S.lightK; let e = lerp(d.off, d.on, k);
      if (L.role === 'tail') e = lerp(d.off, d.on * 0.45, k) + S.brakeSm * d.on * 0.9;
      else if (L.role === 'brake') e = S.brakeSm * d.on;
      else if (L.role === 'signal') e = d.off;
      else if (L.role === 'interior') e = lerp(d.off, d.on, k * 0.6);
      if (S.dmg > 0.5 && L.role === 'head' && L.flick) e *= 0.4 + 0.6 * (Math.sin(S.t * 40 + L.flick) > 0 ? 1 : 0.2);
      L.mat.emissiveIntensity = e;
    }
  }
  return api;
}
/** create a wheel node (spin group inside steer group), returns {steer, spin} added to parent at pos (axle centre) */
export function addWheel(parent, geos, mats, { x, y, z, r, side, steerable = false, mirrorFace = true, extra = [] }) {
  const steer = new THREE.Group(); steer.position.set(x, y, z); const spin = new THREE.Group(); steer.add(spin);
  const face = new THREE.Group(); spin.add(face); if (side < 0 && mirrorFace) face.rotation.y = Math.PI; // rim face outward on the left side
  const tire = new THREE.Mesh(geos.tire, mats.rubber); tire.castShadow = true; face.add(tire);
  const rim = new THREE.Mesh(geos.rim, mats.rim); rim.castShadow = true; face.add(rim);
  if (geos.disc) { const d = new THREE.Mesh(geos.disc, mats.disc || mats.metal); face.add(d); }
  parent.add(steer);
  return { steer: steerable ? steer : null, steerNode: steer, spin, r, side, front: steerable, x, y, z };
}
