// Low-level mesh accumulator for the city module. Emits quads/boxes/prisms/cylinders/lathes into named "buckets"
// (one bucket == one material == one draw call). Supports a TRS matrix stack so sub-assemblies can be placed freely.
// All positions are in metres, colours are linear vertex colours (so one material can carry many paints).
import * as THREE from 'three';

const _c = new THREE.Color();
const _cc = new Map();
/** any colour spec -> [r,g,b] (linear) */
export function rgb(c) {
  if (Array.isArray(c)) return c;
  if (c && c.isColor) return [c.r, c.g, c.b];
  if (typeof c === 'number') { let v = _cc.get(c); if (!v) { _c.setHex(c); v = [_c.r, _c.g, _c.b]; _cc.set(c, v); } return v; }
  _c.set(c); return [_c.r, _c.g, _c.b];
}
export const mul = (c, k) => { const a = rgb(c); return [a[0] * k, a[1] * k, a[2] * k]; };
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
/** tint with hue/value jitter: rng-driven variation of a colour */
export const jitter = (c, rng, amt = 0.1) => { const a = rgb(c); const k = 1 + (rng.next() - 0.5) * amt * 2; return [a[0] * k * (1 + (rng.next() - 0.5) * amt), a[1] * k * (1 + (rng.next() - 0.5) * amt), a[2] * k * (1 + (rng.next() - 0.5) * amt)]; };

export class Builder {
  constructor() {
    this.buckets = new Map();
    this.lines = { p: [], c: [] };
    this.m = new THREE.Matrix4(); this.nm = new THREE.Matrix3(); this.stack = []; this.identity = true;
    this._t = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  bucket(name) {
    let b = this.buckets.get(name);
    if (!b) { b = { p: [], n: [], uv: [], c: [], i: [], count: 0 }; this.buckets.set(name, b); }
    return b;
  }
  has(name) { const b = this.buckets.get(name); return !!(b && b.count); }
  tris() { let n = 0; for (const b of this.buckets.values()) n += b.i.length / 3; return n; }
  byBucket() { const o = {}; for (const [k, b] of this.buckets) o[k] = Math.round(b.i.length / 3); return o; }
  // ---- transform stack ----
  push(x = 0, y = 0, z = 0, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0, roll = 0) {
    this.stack.push(this.m.clone());
    this._e.set(pitch, yaw, roll, 'YXZ'); this._q.setFromEuler(this._e);
    this._t.compose(this._v.set(x, y, z), this._q, this._s.set(sx, sy, sz));
    this.m.multiply(this._t); this._upd(); return this;
  }
  pushM(mat) { this.stack.push(this.m.clone()); this.m.multiply(mat); this._upd(); return this; }
  pop() { this.m.copy(this.stack.pop()); this._upd(); return this; }
  _upd() { this.nm.getNormalMatrix(this.m); this.identity = this.stack.length === 0; }
  /** world transform of a local point (uses current stack) */
  toWorld(x, y, z, out = new THREE.Vector3()) { return out.set(x, y, z).applyMatrix4(this.m); }
  // ---- vertices ----
  vert(b, x, y, z, nx, ny, nz, u, v, c) {
    const e = this.m.elements, k = this.nm.elements;
    b.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
    let X = k[0] * nx + k[3] * ny + k[6] * nz, Y = k[1] * nx + k[4] * ny + k[7] * nz, Z = k[2] * nx + k[5] * ny + k[8] * nz;
    const l = Math.hypot(X, Y, Z) || 1; b.n.push(X / l, Y / l, Z / l);
    b.uv.push(u, v); b.c.push(c[0], c[1], c[2]); return b.count++;
  }
  /** quad p0,p1,p2,p3 (counter-clockwise seen from the front). uv = [u0,v0,u1,v1] (p0->p1 is u, p0->p3 is v) or 8 numbers. col = colour or array of 4 colours. */
  quad(name, p0, p1, p2, p3, uv = [0, 0, 1, 1], col = 0xffffff, nrm) {
    const b = this.bucket(name);
    let nx, ny, nz;
    if (nrm) { nx = nrm[0]; ny = nrm[1]; nz = nrm[2]; } else {
      const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
      nx = ay * bz - az * by; ny = az * bx - ax * bz; nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    }
    let u0, v0, u1, v1, u2, v2, u3, v3;
    if (uv.length === 4) { u0 = uv[0]; v0 = uv[1]; u1 = uv[2]; v1 = v0; u2 = u1; v2 = uv[3]; u3 = u0; v3 = v2; } else [u0, v0, u1, v1, u2, v2, u3, v3] = uv;
    const cs = Array.isArray(col) && Array.isArray(col[0]) ? col : null;
    const c0 = cs ? rgb(cs[0]) : rgb(col), c1 = cs ? rgb(cs[1]) : c0, c2 = cs ? rgb(cs[2]) : c0, c3 = cs ? rgb(cs[3]) : c0;
    const a = this.vert(b, p0[0], p0[1], p0[2], nx, ny, nz, u0, v0, c0), bb = this.vert(b, p1[0], p1[1], p1[2], nx, ny, nz, u1, v1, c1),
      c = this.vert(b, p2[0], p2[1], p2[2], nx, ny, nz, u2, v2, c2), d = this.vert(b, p3[0], p3[1], p3[2], nx, ny, nz, u3, v3, c3);
    b.i.push(a, bb, c, a, c, d);
  }
  /** flat triangle */
  tri(name, p0, p1, p2, col = 0xffffff, uv) {
    const b = this.bucket(name);
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const c = rgb(col); const t = uv || [0, 0, 1, 0, 0.5, 1];
    const i0 = this.vert(b, p0[0], p0[1], p0[2], nx, ny, nz, t[0], t[1], c), i1 = this.vert(b, p1[0], p1[1], p1[2], nx, ny, nz, t[2], t[3], c), i2 = this.vert(b, p2[0], p2[1], p2[2], nx, ny, nz, t[4], t[5], c);
    b.i.push(i0, i1, i2);
  }
  /** axis-aligned box centred (cx,cy,cz). o: {col, colTop, colBottom, mpt (metres per uv tile, default 4), uvRect:[u0,v0,u1,v1] (every face), bottom:false, top:true, sides:true, ao:0..1 (darken lower verts), uvOff:[u,v]} */
  box(name, cx, cy, cz, sx, sy, sz, o = {}) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2; const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    const col = rgb(o.col ?? 0xffffff), ct = o.colTop ? rgb(o.colTop) : col, cb = o.colBottom ? rgb(o.colBottom) : col; const mpt = o.mpt ?? 4; const R = o.uvRect;
    const ao = o.ao ?? 0; const lo = ao ? [col[0] * (1 - ao), col[1] * (1 - ao), col[2] * (1 - ao)] : col;
    const sideCols = [lo, lo, col, col];
    const uo = o.uvOff || [0, 0];
    const U = (a) => a / mpt + uo[0], V = (a) => a / mpt + uo[1];
    if (o.sides !== false) {
      // +z
      this.quad(name, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], R || [U(x0), V(y0), U(x1), V(y1)], sideCols, [0, 0, 1]);
      // -z
      this.quad(name, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], R || [U(x1), V(y0), U(x0), V(y1)], sideCols, [0, 0, -1]);
      // +x
      this.quad(name, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], R || [U(z1), V(y0), U(z0), V(y1)], sideCols, [1, 0, 0]);
      // -x
      this.quad(name, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], R || [U(z0), V(y0), U(z1), V(y1)], sideCols, [-1, 0, 0]);
    }
    if (o.top !== false) this.quad(name, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], R || [U(x0), U(z1), U(x1), U(z0)], ct, [0, 1, 0]);
    if (o.bottom) this.quad(name, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], R || [U(x0), U(z0), U(x1), U(z1)], cb, [0, -1, 0]);
  }
  boxAABB(name, x0, y0, z0, x1, y1, z1, o) { this.box(name, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o); }
  /** extruded polygon (xz points, CCW seen from above). o: {col, colTop, mpt, top:true, bottom:false, uvTop:'world'|'rect', rect} */
  prism(name, poly, y0, y1, o = {}) {
    const col = rgb(o.col ?? 0xffffff), ct = o.colTop ? rgb(o.colTop) : col; const mpt = o.mpt ?? 4; const n = poly.length; let acc = 0;
    const ao = o.ao ?? 0; const lo = ao ? [col[0] * (1 - ao), col[1] * (1 - ao), col[2] * (1 - ao)] : col;
    let A = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
    const rev = A > 0; // numerically CCW in (x,z): walk edges backwards so the quad faces outward
    for (let i = 0; i < n; i++) {
      let a = poly[i], b = poly[(i + 1) % n]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (rev) { const t = a; a = b; b = t; }
      this.quad(name, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [acc / mpt, y0 / mpt, (acc + len) / mpt, y1 / mpt], [lo, lo, col, col]);
      acc += len;
    }
    if (o.top !== false) this.cap(name, poly, y1, ct, mpt, true);
    if (o.bottom) this.cap(name, poly, y0, col, mpt, false);
  }
  /** flat polygon cap at height y. up=true faces +Y. */
  cap(name, poly, y, col, mpt = 4, up = true) {
    const b = this.bucket(name); const c = rgb(col);
    const pts = poly.map((p) => new THREE.Vector2(p[0], p[1])); const tri = THREE.ShapeUtils.triangulateShape(pts, []);
    const base = b.count; const ny = up ? 1 : -1;
    for (const p of poly) this.vert(b, p[0], y, p[1], 0, ny, 0, p[0] / mpt, p[1] / mpt, c);
    for (const t of tri) {
      const a = poly[t[0]], bb = poly[t[1]], cc = poly[t[2]];
      const cy = (bb[0] - a[0]) * (cc[1] - a[1]) - (bb[1] - a[1]) * (cc[0] - a[0]); // y component of normal is -(this) for (a,b,c) in (x,z)
      const facesUp = cy < 0; if (facesUp === up) b.i.push(base + t[0], base + t[1], base + t[2]); else b.i.push(base + t[0], base + t[2], base + t[1]);
    }
  }
  /** cylinder / cone along +Y from y=cy (bottom) to cy+h. o:{col, colTop, cap:true (top), capBottom:false, open:false, mpt, uvRect, rot (yaw), flat:false, ao} */
  cyl(name, cx, cy, cz, r0, r1, h, segs = 12, o = {}) {
    const b = this.bucket(name); const col = rgb(o.col ?? 0xffffff); const ct = o.colTop ? rgb(o.colTop) : col; const mpt = o.mpt ?? 4; const R = o.uvRect;
    const slope = (r0 - r1) / (h || 1); const nl = Math.hypot(1, slope);
    const ao = o.ao ?? 0; const lo = ao ? [col[0] * (1 - ao), col[1] * (1 - ao), col[2] * (1 - ao)] : col;
    const a0 = o.rot || 0; const circ = Math.PI * 2 * Math.max(r0, r1);
    for (let i = 0; i < segs; i++) {
      const A0 = a0 + (i / segs) * Math.PI * 2, A1 = a0 + ((i + 1) / segs) * Math.PI * 2; const c0 = Math.cos(A0), s0 = Math.sin(A0), c1 = Math.cos(A1), s1 = Math.sin(A1);
      const u0 = R ? R[0] + (R[2] - R[0]) * (i / segs) : (i / segs) * circ / mpt, u1 = R ? R[0] + (R[2] - R[0]) * ((i + 1) / segs) : ((i + 1) / segs) * circ / mpt;
      const v0 = R ? R[1] : cy / mpt, v1 = R ? R[3] : (cy + h) / mpt;
      if (o.flat) {
        const am = (A0 + A1) / 2; const nn = [Math.cos(am) / nl, slope / nl, Math.sin(am) / nl];
        this.quad(name, [cx + c1 * r0, cy, cz + s1 * r0], [cx + c0 * r0, cy, cz + s0 * r0], [cx + c0 * r1, cy + h, cz + s0 * r1], [cx + c1 * r1, cy + h, cz + s1 * r1], [u1, v0, u0, v1], [lo, lo, col, col], [nn[0], nn[1], nn[2]]);
      } else {
        const i0 = this.vert(b, cx + c0 * r0, cy, cz + s0 * r0, c0 / nl, slope / nl, s0 / nl, u0, v0, lo), i1 = this.vert(b, cx + c1 * r0, cy, cz + s1 * r0, c1 / nl, slope / nl, s1 / nl, u1, v0, lo),
          i2 = this.vert(b, cx + c1 * r1, cy + h, cz + s1 * r1, c1 / nl, slope / nl, s1 / nl, u1, v1, col), i3 = this.vert(b, cx + c0 * r1, cy + h, cz + s0 * r1, c0 / nl, slope / nl, s0 / nl, u0, v1, col);
        b.i.push(i0, i2, i1, i0, i3, i2);
      }
    }
    if (o.cap !== false && !o.open && r1 > 0.001) this.disc(name, cx, cy + h, cz, r1, segs, ct, true, a0, mpt);
    if (o.capBottom && !o.open && r0 > 0.001) this.disc(name, cx, cy, cz, r0, segs, col, false, a0, mpt);
  }
  disc(name, cx, y, cz, r, segs, col, up = true, a0 = 0, mpt = 4) {
    const b = this.bucket(name); const c = rgb(col); const ny = up ? 1 : -1;
    const ci = this.vert(b, cx, y, cz, 0, ny, 0, cx / mpt, cz / mpt, c);
    const first = b.count;
    for (let i = 0; i <= segs; i++) { const a = a0 + (i / segs) * Math.PI * 2; const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r; this.vert(b, px, y, pz, 0, ny, 0, px / mpt, pz / mpt, c); }
    for (let i = 0; i < segs; i++) { if (up) b.i.push(ci, first + i + 1, first + i); else b.i.push(ci, first + i, first + i + 1); }
  }
  /** surface of revolution around Y through (cx,cy,cz). profile = [[r,y],...] bottom->top. o:{col | cols:[per-point], segs, mpt, flat, uvU:1} */
  lathe(name, cx, cy, cz, profile, segs = 16, o = {}) {
    const b = this.bucket(name); const n = profile.length; const mpt = o.mpt ?? 4; const R = o.uvRect;
    const col = rgb(o.col ?? 0xffffff); const cols = o.cols ? o.cols.map(rgb) : null;
    // per point normals (2D) from neighbouring segments
    const nrm = []; for (let k = 0; k < n; k++) {
      const p0 = profile[Math.max(0, k - 1)], p1 = profile[Math.min(n - 1, k + 1)]; let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; nrm.push([ty, -tx]);
    }
    const first = b.count; let acc = 0; const vs = [0];
    for (let k = 1; k < n; k++) { acc += Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]); vs.push(acc); }
    const a0 = o.rot || 0; const maxR = Math.max(...profile.map((p) => p[0]));
    for (let i = 0; i <= segs; i++) {
      const a = a0 + (i / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (let k = 0; k < n; k++) {
        const r = profile[k][0], y = profile[k][1]; const c = cols ? cols[k] : col;
        const u = R ? R[0] + (R[2] - R[0]) * (i / segs) : (i / segs) * Math.PI * 2 * maxR / mpt; const v = R ? R[1] + (R[3] - R[1]) * (vs[k] / (acc || 1)) : vs[k] / mpt;
        this.vert(b, cx + ca * r, cy + y, cz + sa * r, ca * nrm[k][0], nrm[k][1], sa * nrm[k][0], u, v, c);
      }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < n - 1; k++) {
      const a = first + i * n + k, bb = a + n, c = a + 1, d = bb + 1; b.i.push(a, c, bb, bb, c, d);
    }
  }
  /** ellipsoid (smooth) */
  sphere(name, cx, cy, cz, rx, ry = rx, rz = rx, ws = 10, hs = 6, o = {}) {
    const b = this.bucket(name); const col = rgb(o.col ?? 0xffffff); const ct = o.colTop ? rgb(o.colTop) : col; const cb = o.colBottom ? rgb(o.colBottom) : col; const first = b.count;
    const t0 = o.t0 ?? 0, t1 = o.t1 ?? Math.PI; // polar range (0 = top)
    for (let j = 0; j <= hs; j++) {
      const th = t0 + (t1 - t0) * (j / hs), st = Math.sin(th), ctt = Math.cos(th); const k = (1 - j / hs); const c = [cb[0] + (ct[0] - cb[0]) * k, cb[1] + (ct[1] - cb[1]) * k, cb[2] + (ct[2] - cb[2]) * k];
      for (let i = 0; i <= ws; i++) {
        const a = (o.p0 ?? 0) + ((o.p1 ?? Math.PI * 2) - (o.p0 ?? 0)) * (i / ws) + (o.rot || 0), ca = Math.cos(a), sa = Math.sin(a);
        const nx = st * ca / rx, ny = ctt / ry, nz = st * sa / rz; const l = Math.hypot(nx, ny, nz) || 1;
        this.vert(b, cx + st * ca * rx, cy + ctt * ry, cz + st * sa * rz, nx / l, ny / l, nz / l, (i / ws) * (o.uvk ? o.uvk[0] : 1), (j / hs) * (o.uvk ? o.uvk[1] : 1), c);
      }
    }
    for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) { const a = first + j * (ws + 1) + i, bb = a + ws + 1; b.i.push(a, a + 1, bb, a + 1, bb + 1, bb); }
  }
  /** tube along points with radius array (or number), smooth. o:{col,cols,capEnds} */
  tube(name, pts, radii, segs = 6, o = {}) {
    const b = this.bucket(name); const n = pts.length; const col = rgb(o.col ?? 0xffffff); const cols = o.cols ? o.cols.map(rgb) : null; const first = b.count;
    const T = new THREE.Vector3(), N = new THREE.Vector3(), B2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), alt = new THREE.Vector3(1, 0, 0);
    let acc = 0;
    for (let k = 0; k < n; k++) {
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[Math.min(n - 1, k + 1)]; T.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize();
      N.crossVectors(Math.abs(T.y) > 0.95 ? alt : up, T).normalize(); B2.crossVectors(T, N).normalize();
      const r = Array.isArray(radii) ? radii[k] : radii; const c = cols ? cols[k] : col; if (k > 0) acc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); const nx = N.x * ca + B2.x * sa, ny = N.y * ca + B2.y * sa, nz = N.z * ca + B2.z * sa;
        this.vert(b, pts[k][0] + nx * r, pts[k][1] + ny * r, pts[k][2] + nz * r, nx, ny, nz, i / segs, acc / (o.mpt || 2), c);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < segs; i++) { const a = first + k * (segs + 1) + i, bb = a + segs + 1; b.i.push(a, bb, a + 1, a + 1, bb, bb + 1); }
  }
  /** ribbon (leaf / flag / cloth): pts[k] centre, sides[k] = half-width vector, uv rect or per-point v. double sided materials expected. */
  ribbon(name, pts, sides, uv = [0, 0, 1, 1], col = 0xffffff, cols = null, fixedNormal = null) {
    const b = this.bucket(name); const n = pts.length; const c = rgb(col); const first = b.count;
    // normal = tangent x side
    for (let k = 0; k < n; k++) {
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[Math.min(n - 1, k + 1)]; const tx = p1[0] - p0[0], ty = p1[1] - p0[1], tz = p1[2] - p0[2]; const s = sides[k];
      let nx = ty * s[2] - tz * s[1], ny = tz * s[0] - tx * s[2], nz = tx * s[1] - ty * s[0]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      if (fixedNormal) { nx = fixedNormal[0]; ny = fixedNormal[1]; nz = fixedNormal[2]; } else if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const cc = cols ? rgb(cols[k]) : c; const v = uv[1] + (uv[3] - uv[1]) * (k / (n - 1));
      this.vert(b, pts[k][0] - s[0], pts[k][1] - s[1], pts[k][2] - s[2], nx, ny, nz, uv[0], v, cc);
      this.vert(b, pts[k][0] + s[0], pts[k][1] + s[1], pts[k][2] + s[2], nx, ny, nz, uv[2], v, cc);
    }
    for (let k = 0; k < n - 1; k++) { const a = first + k * 2; b.i.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }

  /** import a THREE.BufferGeometry (indexed or not) through the current matrix. uvScale divides uv (e.g. 1/mpt). */
  geometry(name, geo, col = 0xffffff, uvScale = 1) {
    const b = this.bucket(name); const c = rgb(col); const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { this.vert(b, p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0, uv ? uv.getX(i) * uvScale : 0, uv ? uv.getY(i) * uvScale : 0, c); b.i.push(b.count - 1); }
    if (g !== geo) g.dispose();
  }
  line(a, b2, col = 0x111111) { const c = rgb(col); const e = this.m.elements; const P = (p) => [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; this.lines.p.push(...P(a), ...P(b2)); this.lines.c.push(...c, ...c); }
  /** catenary-ish sagging wire between two points */
  wire(a, b2, sag = 0.4, segs = 8, col = 0x151515) {
    let prev = a; for (let i = 1; i <= segs; i++) { const t = i / segs; const p = [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b2[2] - a[2]) * t]; this.line(prev, p, col); prev = p; }
  }
  /** build geometries: Map name -> BufferGeometry (plus 'lines' if any) */
  build() {
    const out = new Map();
    for (const [name, b] of this.buckets) {
      if (!b.count) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.p), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(b.n), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b.uv), 2));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(b.c), 3));
      g.setIndex(new THREE.BufferAttribute(b.count > 65535 ? new Uint32Array(b.i) : new Uint16Array(b.i), 1));
      g.computeBoundingSphere(); g.computeBoundingBox(); out.set(name, g);
    }
    if (this.lines.p.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.lines.p), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.lines.c), 3));
      g.computeBoundingSphere(); out.set('lines', g);
    }
    return out;
  }
}
