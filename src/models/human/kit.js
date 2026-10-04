// Human module geometry kit: ring-lofted tubes, skin-weight chains, merging.  (owned by the human module)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Q } from '../../engine/common.js';

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _ref = new THREE.Vector3();
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const toV = (p) => (p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]));
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-9))); return t * t * (3 - 2 * t); };
export const mixn = (a, b, t) => a + (b - a) * t;
export const clampn = (v, a, b) => (v < a ? a : v > b ? b : v);
/** radial segment multiplier by quality (never below min) */
export const rseg = (n, min = 6) => Math.max(min, Math.round(n * (0.7 + 0.15 * Q.detail)));

const DOME_ANG = [24, 48, 68, 82].map((d) => d * Math.PI / 180);

/**
 * Loft elliptical rings along a polyline.
 * stations: [{c:[x,y,z]|V3, rx, rz, pw?(superellipse power), tw?(twist rad)}]
 *   rx = half-size along the "side" axis, rz = half-size along the "front" axis (reference vector projected perpendicular to the path).
 * o: radial, ref:[0,0,1], capStart/capEnd = dome length (m) or 0, uv:{u0,u1,v0,v1} (u 0.5 = front, seam at back), cx cz: none
 */
export function ringLoft(stations, o = {}) {
  const radial = o.radial || 16, nS = stations.length;
  const ref = o.ref ? toV(o.ref) : V(0, 0, 1);
  const st = stations.map((s) => ({ c: toV(s.c), rx: s.rx, rz: s.rz ?? s.rx, pw: s.pw ?? o.pw ?? 2, tw: s.tw || 0, col: s.col, dv: s.dv }));
  // add dome stations
  const caps = (arr, len, dirSign) => {
    const first = dirSign < 0 ? arr[0] : arr[arr.length - 1];
    const nb = dirSign < 0 ? arr[1] : arr[arr.length - 2];
    _t.copy(first.c).sub(nb.c).normalize();
    const out = DOME_ANG.map((a) => ({ c: first.c.clone().addScaledVector(_t, len * Math.sin(a)), rx: first.rx * Math.cos(a), rz: first.rz * Math.cos(a), pw: first.pw, tw: first.tw, col: first.col }));
    return out;
  };
  let all = st;
  const nCapS = o.capStart ? DOME_ANG.length : 0, nCapE = o.capEnd ? DOME_ANG.length : 0;
  if (o.capStart) all = caps(st, o.capStart, -1).reverse().concat(all);
  if (o.capEnd) all = all.concat(caps(st, o.capEnd, 1));
  const N = all.length;
  // arc length for v
  const cum = [0]; for (let i = 1; i < N; i++) cum.push(cum[i - 1] + all[i].c.distanceTo(all[i - 1].c));
  const total = cum[N - 1] || 1;
  const uvr = o.uv || { u0: 0, u1: 1, v0: 0, v1: 1 };
  const pos = [], uv = [], idx = [], colr = [];
  const hasCol = st.some((s) => s.col);
  const C = new THREE.Color();
  for (let i = 0; i < N; i++) {
    // frame
    const prev = all[Math.max(0, i - 1)].c, next = all[Math.min(N - 1, i + 1)].c;
    _t.copy(next).sub(prev); if (_t.lengthSq() < 1e-12) _t.set(0, 1, 0); _t.normalize();
    _ref.copy(ref); if (Math.abs(_ref.dot(_t)) > 0.97) _ref.set(0, 1, 0);
    _b.copy(_ref).addScaledVector(_t, -_ref.dot(_t)).normalize();   // front axis
    _a.crossVectors(_t, _b).normalize();                              // side axis
    const s = all[i], cs = Math.cos(s.tw), sn = Math.sin(s.tw);
    const v = uvr.v0 + (uvr.v1 - uvr.v0) * (cum[i] / total);
    if (hasCol) { C.set(s.col ?? 0xffffff); }
    for (let k = 0; k <= radial; k++) {
      const ang = Math.PI + (k / radial) * Math.PI * 2; // seam at the back
      let ca = Math.cos(ang), sa = Math.sin(ang);
      if (s.pw !== 2) { ca = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / s.pw); sa = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / s.pw); }
      let fx = ca * s.rz, fy = sa * s.rx; // front, side
      if (s.tw) { const x2 = fx * cs - fy * sn, y2 = fx * sn + fy * cs; fx = x2; fy = y2; }
      pos.push(s.c.x + _b.x * fx + _a.x * fy, s.c.y + _b.y * fx + _a.y * fy, s.c.z + _b.z * fx + _a.z * fy);
      uv.push(uvr.u0 + (uvr.u1 - uvr.u0) * (k / radial), v);
      if (hasCol) colr.push(C.r, C.g, C.b);
    }
  }
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * (radial + 1) + k, b = a + 1, c = a + radial + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  // end fans
  const addFan = (ring, flip) => {
    const ci = pos.length / 3; const s = all[ring]; pos.push(s.c.x, s.c.y, s.c.z); uv.push((uvr.u0 + uvr.u1) / 2, uvr.v0 + (uvr.v1 - uvr.v0) * (cum[ring] / total)); if (hasCol) colr.push(C.r, C.g, C.b);
    for (let k = 0; k < radial; k++) { const a = ring * (radial + 1) + k, b = a + 1; if (flip) idx.push(ci, a, b); else idx.push(ci, b, a); }
    return ci;
  };
  const fans = [];
  if (o.capStart) fans.push(addFan(0, false)); else if (o.closeStart) fans.push(addFan(0, false));
  if (o.capEnd) fans.push(addFan(N - 1, true)); else if (o.closeEnd) fans.push(addFan(N - 1, true));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  // orientation check: first ring quad normal vs outward
  orientOutward(g, all, radial, o);
  g.computeVertexNormals();
  seamNormals(g, N, radial);
  g.userData.ringInfo = { N, radial, nCapS, nCapE };
  return g;
}
function orientOutward(g, all, radial, o) {
  const p = g.attributes.position, ix = g.index.array;
  // pick a mid ring quad
  const ri = Math.floor(all.length / 2), k = Math.floor(radial / 4);
  const a = ri * (radial + 1) + k; const base = ix.indexOf ? findTri(ix, a) : 0;
  const i0 = ix[base], i1 = ix[base + 1], i2 = ix[base + 2];
  _a.fromBufferAttribute(p, i0); _b.fromBufferAttribute(p, i1); _t.fromBufferAttribute(p, i2);
  const n = _b.clone().sub(_a).cross(_t.clone().sub(_a));
  const cen = all[ri].c; const outward = _a.clone().sub(cen);
  if (n.dot(outward) < 0) { for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
}
function findTri(ix, a) { for (let i = 0; i < ix.length; i += 3) if (ix[i] === a) return i; return 0; }
function seamNormals(g, N, radial) {
  const n = g.attributes.normal;
  for (let i = 0; i < N; i++) {
    const a = i * (radial + 1), b = a + radial;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b); const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
}

/** Ellipsoid blob with skin-friendly UV (u around, v pole to pole in a rect) */
export function blob(c, rx, ry, rz, { w = 12, h = 8, uv = null, rot = null } = {}) {
  const g = new THREE.SphereGeometry(1, rseg(w, 6), rseg(h, 4));
  g.scale(rx, ry, rz);
  if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); }
  g.translate(c[0] ?? c.x, c[1] ?? c.y, c[2] ?? c.z);
  if (uv) remapUV(g, uv);
  g.deleteAttribute('normal'); g.computeVertexNormals();
  return g;
}
export function remapUV(g, r) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, r.u0 + (r.u1 - r.u0) * u.getX(i), r.v0 + (r.v1 - r.v0) * u.getY(i)); return g; }

/**
 * Skin-weight chain: bones[k] / bones[k+1] separated by a transition plane through joints[k] (normal = chain direction there), half-width blend[k].
 * Returns fn(x,y,z) -> fills sk (4 indices/weights).
 */
export function makeChain(boneIndex, bones, joints, blend, dirs) {
  const n = bones.length - 1;
  const J = joints.map(toV), D = [];
  for (let k = 0; k < n; k++) {
    let d;
    if (dirs && dirs[k]) d = toV(dirs[k]).normalize();
    else {
      const p0 = k > 0 ? J[k - 1] : null, p1 = J[k], p2 = k + 1 < n ? J[k + 1] : null;
      d = V();
      if (p0) d.add(p1.clone().sub(p0).normalize());
      if (p2) d.add(p2.clone().sub(p1).normalize());
      if (d.lengthSq() < 1e-8) d.set(0, -1, 0);
      d.normalize();
    }
    D.push(d);
  }
  const bi = bones.map((b) => boneIndex[b]);
  for (let i = 0; i < bi.length; i++) if (bi[i] === undefined) throw new Error('chain bone missing: ' + bones[i]);
  const w = new Array(bones.length);
  const bl = Array.isArray(blend) ? blend : new Array(n).fill(blend);
  return function (x, y, z, out) {
    let rem = 1;
    for (let k = 0; k < n; k++) {
      const s = ((x - J[k].x) * D[k].x + (y - J[k].y) * D[k].y + (z - J[k].z) * D[k].z);
      const t = smooth(-bl[k], bl[k], s);
      w[k] = rem * (1 - t); rem *= t;
    }
    w[n] = rem;
    // choose top 4
    let i0 = -1, i1 = -1, i2 = -1, i3 = -1;
    for (let pass = 0; pass < 4; pass++) {
      let best = -1, bv = 1e-4;
      for (let k = 0; k <= n; k++) { if (k === i0 || k === i1 || k === i2) continue; if (w[k] > bv) { bv = w[k]; best = k; } }
      if (pass === 0) i0 = best; else if (pass === 1) i1 = best; else if (pass === 2) i2 = best; else i3 = best;
    }
    const sel = [i0, i1, i2, i3]; let sum = 0;
    for (let j = 0; j < 4; j++) sum += sel[j] >= 0 ? w[sel[j]] : 0;
    for (let j = 0; j < 4; j++) { if (sel[j] >= 0) { out.i[j] = bi[sel[j]]; out.w[j] = w[sel[j]] / sum; } else { out.i[j] = 0; out.w[j] = 0; } }
  };
}
/** single bone chain */
export function rigid(boneIndex, bone) { const i = boneIndex[bone]; if (i === undefined) throw new Error('bone missing ' + bone); return (x, y, z, out) => { out.i[0] = i; out.w[0] = 1; out.i[1] = out.i[2] = out.i[3] = 0; out.w[1] = out.w[2] = out.w[3] = 0; }; }
/** weights from an arbitrary function (x,y,z,out) */
export function applySkin(g, fn) {
  const p = g.attributes.position, n = p.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const out = { i: [0, 0, 0, 0], w: [0, 0, 0, 0] };
  for (let v = 0; v < n; v++) {
    fn(p.getX(v), p.getY(v), p.getZ(v), out, v);
    for (let j = 0; j < 4; j++) { si[v * 4 + j] = out.i[j]; sw[v * 4 + j] = out.w[j]; }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}
/** merge geometries, requiring identical attribute sets (adds missing uv/color/skin as zeros/ones) */
export function mergeAll(list, { keepColor = false } = {}) {
  const gs = list.filter(Boolean).map((g) => {
    const c = g.index ? g : g;
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    return c;
  });
  const anyColor = keepColor || gs.some((g) => g.attributes.color);
  if (anyColor) for (const g of gs) if (!g.attributes.color) { const n = g.attributes.position.count; const a = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  const anySkin = gs.some((g) => g.attributes.skinIndex);
  if (anySkin) for (const g of gs) if (!g.attributes.skinIndex) throw new Error('mergeAll: mixed skinned/unskinned');
  for (const g of gs) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
  return mergeGeometries(gs, false);
}
/** add a vertex-colour attribute (single colour) */
export function tint(g, color) { const c = new THREE.Color(color); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
/** Catmull-Rom interpolation of a numeric table [[x, a, b, ...], ...] at x */
export function table(tab, x) {
  if (x <= tab[0][0]) return tab[0].slice(1);
  if (x >= tab[tab.length - 1][0]) return tab[tab.length - 1].slice(1);
  let i = 0; while (i < tab.length - 2 && x > tab[i + 1][0]) i++;
  const p0 = tab[Math.max(0, i - 1)], p1 = tab[i], p2 = tab[i + 1], p3 = tab[Math.min(tab.length - 1, i + 2)];
  const t = (x - p1[0]) / (p2[0] - p1[0]); const t2 = t * t, t3 = t2 * t; const out = [];
  for (let k = 1; k < p1.length; k++) out.push(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  return out;
}
/** resample a table at n evenly-spaced x values between x0..x1 → array of [x, ...vals] */
export function resample(tab, n, x0 = tab[0][0], x1 = tab[tab.length - 1][0]) { const out = []; for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / (n - 1); out.push([x, ...table(tab, x)]); } return out; }
