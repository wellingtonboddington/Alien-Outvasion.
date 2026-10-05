// Geometry / skinning / IK helpers private to the alien module.
// All geometry builders return indexed BufferGeometry with position, normal, uv (metric UVs: 1 unit = `tile` metres).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seg } from '../../engine/common.js';

const V3 = THREE.Vector3;
export { V3 };
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();

const sampleArr = (a, t) => { if (!Array.isArray(a)) return a; const f = Math.min(1, Math.max(0, t)) * (a.length - 1), i = Math.floor(f), j = Math.min(a.length - 1, i + 1); return a[i] + (a[j] - a[i]) * (f - i); };
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };
export { sstep, sampleArr };

function finish(pos, uv, idx, flipTest) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (flipTest) { // make sure normals point away from the given centre function (avg), else flip winding
    const n = g.attributes.normal, p = g.attributes.position; let s = 0;
    for (let i = 0; i < p.count; i += 3) { flipTest(_a.fromBufferAttribute(p, i), _b); s += _b.dot(_c.fromBufferAttribute(n, i)); }
    if (s < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  }
  return g;
}

/**
 * Loft elliptical sections along an axis ('y' or 'z').
 * sections: [{t, rx, ry, cx=0, cy=0, power=2, bot=1, top=1}] bottom->top / back->front.
 *  axis 'y': cross-section plane is (x, z): rx = half-width(x), ry = half-depth(z), cx/cy = centre offsets (x, z). 'bot' scales the -z (back) half, 'top' the +z (front) half.
 *  axis 'z': plane is (x, y): rx = half-width, ry = half-height, cx/cy = centre (x, y). 'bot' scales -y half (flat underside), 'top' scales +y.
 */
export function loft(sections, { axis = 'y', radial = 16, tile = 0.4, capStart = true, capEnd = true, arc = null, exact = false } = {}) {
  radial = exact ? radial : seg(radial, 6); const a0 = arc ? arc[0] : 0, a1 = arc ? arc[1] : Math.PI * 2; const n = sections.length; const pos = [], uv = [], idx = [];
  const P = (t, u, w) => (axis === 'y' ? [u, t, w] : [u, w, t]);
  let len = 0;
  for (let s = 0; s < n; s++) {
    const S = sections[s]; const k = S.power ?? 2; const bot = S.bot ?? 1, top = S.top ?? 1;
    if (s > 0) { const q = sections[s - 1]; len += Math.hypot(S.t - q.t, (S.cx || 0) - (q.cx || 0), (S.cy || 0) - (q.cy || 0)); }
    const per = Math.PI * (S.rx + S.ry);
    for (let i = 0; i <= radial; i++) {
      const a = a0 + (i / radial) * (a1 - a0), ca = Math.cos(a), sa = Math.sin(a);
      const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k) * S.rx;
      let w = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k) * S.ry; w *= w < 0 ? bot : top;
      const q = P(S.t, (S.cx || 0) + x, (S.cy || 0) + w); pos.push(q[0], q[1], q[2]); uv.push(i / radial * per / tile, len / tile);
    }
  }
  for (let s = 0; s < n - 1; s++) for (let i = 0; i < radial; i++) { const a = s * (radial + 1) + i, b = a + 1, c = a + radial + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const cap = (s, last) => {
    const S = sections[s]; const base = pos.length / 3; const c0 = P(S.t, S.cx || 0, S.cy || 0); pos.push(c0[0], c0[1], c0[2]); uv.push(0.5, 0.5);
    for (let i = 0; i <= radial; i++) { const j = (s * (radial + 1) + i) * 3; pos.push(pos[j], pos[j + 1], pos[j + 2]); uv.push(0.5, 0.5); }
    for (let i = 0; i < radial; i++) { if (last) idx.push(base, base + 2 + i, base + 1 + i); else idx.push(base, base + 1 + i, base + 2 + i); }
  };
  if (capStart) cap(0, false); if (capEnd) cap(n - 1, true);
  const cen = sections.reduce((a, S) => { const q = P(S.t, S.cx || 0, S.cy || 0); return a.add(new V3(q[0], q[1], q[2])); }, new V3()).multiplyScalar(1 / n);
  return finish(pos, uv, idx, (p, out) => out.copy(p).sub(cen));
}

/**
 * Sweep an elliptical cross-section along a Catmull-Rom path (parallel transport frames).
 * rx = half-width along frame axis A, ry = half-thickness along B (B ~ `up` hint). radii: number | number[] over path.
 * opts: {radial, samples, up, power, round (cap rings), tile, closed}
 */
export function sweep(pts, rx, ry = rx, { radial = 8, samples = 0, up = null, power = 2, round = 2, tile = 0.3, tension = 0.5 } = {}) {
  radial = seg(radial, 4);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (Array.isArray(p) ? new V3(p[0], p[1], p[2]) : p.clone())), false, 'catmullrom', tension);
  const N = samples || Math.max(2, (pts.length - 1) * 6);
  const pos = [], uv = [], idx = [];
  let T = curve.getTangentAt(0).normalize();
  let B = (up ? _a.copy(up) : Math.abs(T.y) < 0.9 ? _a.set(0, 1, 0) : _a.set(1, 0, 0)).clone(); B.addScaledVector(T, -B.dot(T)).normalize();
  let A = new V3().crossVectors(B, T).normalize();
  const rings = []; let len = 0, prev = null;
  const capN = round > 0 ? round : 0;
  const add = (p, a, b, wx, wy, v) => {
    for (let j = 0; j <= radial; j++) {
      const an = (j / radial) * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / power) * wx, y = Math.sign(s) * Math.pow(Math.abs(s), 2 / power) * wy;
      pos.push(p.x + a.x * x + b.x * y, p.y + a.y * x + b.y * y, p.z + a.z * x + b.z * y); uv.push(j / radial * Math.PI * (wx + wy) / tile, v / tile);
    }
  };
  const frames = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; const p = curve.getPointAt(t); const T2 = curve.getTangentAt(t).normalize();
    if (i > 0) { const ax = _b.crossVectors(T, T2); const l = ax.length(); if (l > 1e-6) { ax.multiplyScalar(1 / l); const ang = Math.acos(Math.min(1, Math.max(-1, T.dot(T2)))); A.applyAxisAngle(ax, ang); B.applyAxisAngle(ax, ang); } }
    T = T2; if (prev) len += p.distanceTo(prev); prev = p;
    frames.push({ p: p.clone(), A: A.clone(), B: B.clone(), T: T.clone(), t, len });
  }
  const first = frames[0], last = frames[N];
  // start cap rings (round)
  for (let c = capN; c >= 1; c--) { const s = c / (capN + 1); const k = Math.sqrt(Math.max(0, 1 - s * s)); const r0x = sampleArr(rx, 0), r0y = sampleArr(ry, 0); const off = Math.sqrt(1 - k * k) * Math.min(r0x, r0y) * 0.9; add(first.p.clone().addScaledVector(first.T, -off), first.A, first.B, r0x * k, r0y * k, first.len - off); rings.push(1); }
  for (const f of frames) { add(f.p, f.A, f.B, sampleArr(rx, f.t), sampleArr(ry, f.t), f.len); rings.push(1); }
  for (let c = 1; c <= capN; c++) { const s = c / (capN + 1); const k = Math.sqrt(Math.max(0, 1 - s * s)); const r0x = sampleArr(rx, 1), r0y = sampleArr(ry, 1); const off = Math.sqrt(1 - k * k) * Math.min(r0x, r0y) * 0.9; add(last.p.clone().addScaledVector(last.T, off), last.A, last.B, r0x * k, r0y * k, last.len + off); rings.push(1); }
  const R = rings.length;
  for (let s = 0; s < R - 1; s++) for (let i = 0; i < radial; i++) { const a = s * (radial + 1) + i, b = a + 1, c = a + radial + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  // end fans
  const fan = (ringIdx, p, T0, flip) => { const base = pos.length / 3; const o = new V3().copy(p).addScaledVector(T0, 0); pos.push(o.x, o.y, o.z); uv.push(0, 0); for (let i = 0; i < radial; i++) { const a = ringIdx * (radial + 1) + i; if (flip) idx.push(base, a, a + 1); else idx.push(base, a + 1, a); } };
  // tip points: extend a hair beyond last ring along tangent
  const tipS = capN > 0 ? new V3().copy(first.p).addScaledVector(first.T, -Math.min(sampleArr(rx, 0), sampleArr(ry, 0)) * 0.95) : first.p;
  const tipE = capN > 0 ? new V3().copy(last.p).addScaledVector(last.T, Math.min(sampleArr(rx, 1), sampleArr(ry, 1)) * 0.95) : last.p;
  fan(0, tipS, first.T, true); fan(R - 1, tipE, last.T, false);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // orientation check using centreline
  const nA = g.attributes.normal, pA = g.attributes.position; let sum = 0; for (let i = 0; i < pA.count; i += 5) { _a.fromBufferAttribute(pA, i); const f = frames[Math.min(N, Math.max(0, Math.floor(i / (radial + 1)) - capN))] || frames[0]; _b.copy(_a).sub(f.p); sum += _b.dot(_c.fromBufferAttribute(nA, i)); }
  if (sum < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

/** Straight tapered limb segment between two points (rounded ends). */
export function seg2(a, b, r0, r1, { radial = 8, ratio = 1, mid = 0, up = null, tile = 0.3 } = {}) {
  const A = Array.isArray(a) ? new V3(...a) : a, B = Array.isArray(b) ? new V3(...b) : b;
  const m = A.clone().lerp(B, 0.5); const rm = (r0 + r1) / 2 * (1 + mid);
  return sweep([A, m, B], [r0, rm, r1], [r0 * ratio, rm * ratio, r1 * ratio], { radial, samples: 6, up: up || new V3(0, 0, 1), round: 2, tile });
}

/** Ellipsoid with a baked transform: radii rx,ry,rz, centred at p. */
export function blob(p, rx, ry = rx, rz = rx, { w = 12, h = 8, tile = 0.3, rot = null } = {}) {
  const g = new THREE.SphereGeometry(1, seg(w, 6), seg(h, 4)); g.scale(rx, ry, rz); if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); } g.translate(p[0] ?? p.x, p[1] ?? p.y, p[2] ?? p.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * (rx + rz) / tile, uv.getY(i) * Math.PI * ry / tile); return g;
}
/** Cone / spike from base point towards tip (bristles, thorns). */
export function spike(base, tip, r, { radial = 5, curve = 0, bend = null } = {}) {
  const A = Array.isArray(base) ? new V3(...base) : base.clone(), B = Array.isArray(tip) ? new V3(...tip) : tip.clone();
  const m = A.clone().lerp(B, 0.5); if (bend) m.add(bend.clone().multiplyScalar(curve));
  const g = sweep([A, m, B], [r, r * 0.55, 0.0006], [r, r * 0.55, 0.0006], { radial, samples: 4, round: 0, tile: 0.2 });
  return g;
}

/** Position a geometry with TRS (euler XYZ). */
export function place(g, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new V3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])), new V3(...scl)); g.applyMatrix4(m); return g;
}
/** Mirror geometry across X (x -> -x) with correct winding. */
export function mirrorX(g) {
  const c = g.clone(); const p = c.attributes.position, n = c.attributes.normal; for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); n.setX(i, -n.getX(i)); }
  if (c.index) { const ix = c.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
  return c;
}

/**
 * Parametric curved armour plate that hugs a surface described by fn(u,v)->{p:V3,n:V3} (u,v in [-1,1]).
 * thickness(u,v) -> metres of lift; edges should go to ~0. Returns geometry (grid nu x nv) with metric uv.
 */
export function surfacePlate(fn, thickness, { nu = 10, nv = 6, tile = 0.4, uvScale = 1 } = {}) {
  nu = seg(nu, 4); nv = seg(nv, 3); const pos = [], uv = [], idx = [];
  let uAcc = 0, prevP = null;
  for (let j = 0; j <= nv; j++) {
    const v = (j / nv) * 2 - 1; prevP = null; uAcc = 0;
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1; const s = fn(u, v); const th = thickness(u, v);
      const p = s.p.clone().addScaledVector(s.n, th); pos.push(p.x, p.y, p.z);
      if (prevP) uAcc += p.distanceTo(prevP); prevP = p; uv.push(uAcc / tile * uvScale, (j / nv) * 0.12 / tile * 8);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // orient outward: compare with fn normal at centre
  const c = fn(0, 0); const mid = Math.floor(((nv / 2) * (nu + 1) + nu / 2)); const nrm = new V3().fromBufferAttribute(g.attributes.normal, mid);
  if (nrm.dot(c.n) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

// ---------- ray conform (decals: eye bands, glyphs, veins) ----------
const _ray = new THREE.Raycaster();
export function makeProbe(geo) { return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); }
/** cast from `o` along `d` (unit) against probe mesh(es); returns {p,n} of nearest hit or null */
export function rayHit(probes, o, d) {
  _ray.set(o, d); _ray.far = 10; let best = null;
  for (const pr of Array.isArray(probes) ? probes : [probes]) { const h = _ray.intersectObject(pr, false)[0]; if (h && (!best || h.distance < best.distance)) best = h; }
  if (!best) return null; const n = best.face.normal.clone(); return { p: best.point.clone(), n, distance: best.distance };
}
/**
 * Ribbon glued onto a surface. path: array of {o:V3 (ray origin), d:V3 (ray dir)} OR [o, d] pairs.
 * width: number | number[] ; lift: metres above surface. Double sided not needed (visible from outside).
 */
export function conformStrip(probes, path, width = 0.02, lift = 0.004, { tile = 0.3 } = {}) {
  const hits = path.map((q) => rayHit(probes, q.o, q.d)).filter(Boolean); if (hits.length < 2) return null;
  const pos = [], uv = [], idx = []; let acc = 0;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]; const prev = hits[Math.max(0, i - 1)], next = hits[Math.min(hits.length - 1, i + 1)];
    const tan = _a.copy(next.p).sub(prev.p).normalize(); const side = _b.crossVectors(h.n, tan).normalize();
    const w = sampleArr(width, hits.length > 1 ? i / (hits.length - 1) : 0) / 2;
    const c = h.p.clone().addScaledVector(h.n, lift);
    pos.push(c.x + side.x * w, c.y + side.y * w, c.z + side.z * w, c.x - side.x * w, c.y - side.y * w, c.z - side.z * w);
    if (i > 0) acc += h.p.distanceTo(hits[i - 1].p); uv.push(0, acc / tile, 1, acc / tile);
  }
  for (let i = 0; i < hits.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // face outward (towards first hit normal)
  const nn = new V3().fromBufferAttribute(g.attributes.normal, 0); if (nn.dot(hits[0].n) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

// ---------- skinning ----------
export function setSkin(g, idxArr, wArr) {
  const n = g.attributes.position.count; const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = idxArr[i * 2]; si[i * 4 + 1] = idxArr[i * 2 + 1]; sw[i * 4] = wArr[i * 2]; sw[i * 4 + 1] = wArr[i * 2 + 1]; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return g;
}
/** all vertices rigidly follow bone index b */
export function bindRigid(g, b) {
  const n = g.attributes.position.count; const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = b; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return g;
}
/**
 * Smooth skin along a polyline of joints. joints: V3[] (p0..pn, bone i has origin p_i and covers segment i->i+1; the last bone also owns anything beyond),
 * bones: bone indices (length = joints.length - 1 or joints.length), blend: half-width (m) of the blend zone around each inner joint (number|array).
 */
export function bindAlong(g, joints, bones, blend = 0.06) {
  const n = g.attributes.position.count, P = g.attributes.position; const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const segs = joints.length - 1; const L = [0]; for (let i = 0; i < segs; i++) L.push(L[i] + joints[i].distanceTo(joints[i + 1]));
  const v = new V3(), ab = new V3(), ap = new V3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i); let bestD = 1e9, bestS = 0;
    for (let k = 0; k < segs; k++) {
      ab.copy(joints[k + 1]).sub(joints[k]); ap.copy(v).sub(joints[k]); const l2 = ab.lengthSq() || 1e-9; let t = ap.dot(ab) / l2; t = t < 0 ? (k === 0 ? t : 0) : t > 1 ? (k === segs - 1 ? t : 1) : t;
      const tc = Math.min(1, Math.max(0, t)); const d = ap.sub(ab.clone().multiplyScalar(tc)).lengthSq();
      if (d < bestD) { bestD = d; bestS = L[k] + t * Math.sqrt(l2); }
    }
    // find bone(s)
    let k = 0; while (k < segs - 1 && bestS >= L[k + 1]) k++;
    const bAt = (j) => bones[Math.min(j, bones.length - 1)];
    let b0 = bAt(k), b1 = -1, w1 = 0;
    const bw = (j) => (Array.isArray(blend) ? blend[j] : blend);
    if (k < segs - 1) { const bwk = bw(k); const w = sstep(L[k + 1] - bwk, L[k + 1] + bwk, bestS); if (w > 0) { b1 = bAt(k + 1); w1 = w; } }
    if (k > 0 && b1 < 0) { const bwk = bw(k - 1); const w = 1 - sstep(L[k] - bwk, L[k] + bwk, bestS); if (w > 0) { b1 = bAt(k - 1); w1 = w; } }
    si[i * 4] = b0; sw[i * 4] = 1 - w1; if (b1 >= 0) { si[i * 4 + 1] = b1; sw[i * 4 + 1] = w1; }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return g;
}
/** weights from a per-vertex function fn(x,y,z,i,out) -> out=[b0,w0,b1,w1] */
export function bindFn(g, fn) {
  const n = g.attributes.position.count, P = g.attributes.position; const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); const out = [0, 1, 0, 0];
  for (let i = 0; i < n; i++) { out[0] = 0; out[1] = 1; out[2] = 0; out[3] = 0; fn(P.getX(i), P.getY(i), P.getZ(i), i, out); si[i * 4] = out[0]; sw[i * 4] = out[1]; si[i * 4 + 1] = out[2]; sw[i * 4 + 1] = out[3]; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return g;
}

/** merge skinned geometries (all must have position, normal, uv, skinIndex, skinWeight) */
export function mergeSkinned(list) {
  const L = list.filter(Boolean).map((g) => {
    const c = g; for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) c.deleteAttribute(k);
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    if (!c.index) { const n = c.attributes.position.count; const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; c.setIndex(new THREE.BufferAttribute(ix, 1)); }
    return c;
  });
  if (!L.length) return null; const m = mergeGeometries(L, false); L.forEach((g) => g.dispose()); return m;
}
export function mergePlain(list) {
  const L = list.filter(Boolean).map((c) => { for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) c.deleteAttribute(k); if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2)); if (!c.index) { const n = c.attributes.position.count; const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; c.setIndex(new THREE.BufferAttribute(ix, 1)); } return c; });
  if (!L.length) return null; return mergeGeometries(L, false);
}

// ---------- IK / frames ----------
/**
 * Two-bone IK. a = root joint pos, t = target, l1,l2 lengths, pole = preferred bend direction (any vector, will be projected).
 * Writes mid joint into outMid and clamped end into outEnd; returns hinge axis in outAxis (unit, = dir x pole⊥).
 */
export function solve2(a, t, l1, l2, pole, outMid, outEnd, outAxis) {
  _a.copy(t).sub(a); let dist = _a.length(); const maxR = (l1 + l2) * 0.9995, minR = Math.abs(l1 - l2) * 1.001 + 1e-4;
  if (dist < 1e-6) { _a.set(0, -1, 0); dist = 1e-6; } else _a.multiplyScalar(1 / dist);
  dist = Math.min(maxR, Math.max(minR, dist));
  const x = (dist * dist + l1 * l1 - l2 * l2) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _b.copy(pole).addScaledVector(_a, -pole.dot(_a)); if (_b.lengthSq() < 1e-8) _b.set(0, 0, 1).addScaledVector(_a, -_a.z); _b.normalize();
  outMid.copy(a).addScaledVector(_a, x).addScaledVector(_b, h);
  outEnd.copy(a).addScaledVector(_a, dist);
  if (outAxis) outAxis.crossVectors(_a, _b).normalize();
}
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _x = new V3(), _y = new V3(), _z = new V3();
/** quaternion with Y = dir and X ~ axis (orthogonalised) */
export function quatFromDirAxis(dir, axis, out) {
  _y.copy(dir).normalize(); _x.copy(axis).addScaledVector(_y, -axis.dot(_y)); if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0).addScaledVector(_y, -_y.x); _x.normalize(); _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z); return out.setFromRotationMatrix(_m);
}
