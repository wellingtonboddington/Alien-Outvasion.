// Low-poly geometry builder for crowd figures. Produces plain {p,n,uv,i} meshes (rest pose, metres), tags every vertex with
// joint / gate / slot / layer, merges everything into ONE indexed BufferGeometry.
import * as THREE from 'three';

const SQ = (c, k) => Math.sign(c) * Math.pow(Math.abs(c), 2 / k);
const _M = new THREE.Matrix4(), _N = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export function computeNormals(p, idx) {
  const n = new Array(p.length).fill(0);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/**
 * Loft elliptical rings along +Y. sections: [{y, rx, rz, cx=0, cz=0, k?}] bottom -> top (rx=rz=0 makes an apex).
 * opt: R radial count, rot0 start angle (PI/R puts a flat panel facing +Z), k superellipse power (2 = ellipse, 4 = boxy),
 *      tile metres-per-texture-tile (uv), capBottom/capTop flat caps.
 */
export function loft(sections, { R = 8, rot0 = Math.PI / 8, k = 2, tile = 0.5, capBottom = false, capTop = false } = {}) {
  const p = [], uv = [], idx = [];
  let v0 = 0;
  const ns = sections.length;
  for (let s = 0; s < ns; s++) {
    const S = sections[s]; const kk = S.k ?? k;
    if (s > 0) { const P = sections[s - 1]; v0 += Math.hypot(S.y - P.y, (S.rx + S.rz - P.rx - P.rz) * 0.5); }
    const circ = Math.PI * (S.rx + S.rz);
    for (let i = 0; i <= R; i++) {
      const a = rot0 + (i / R) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a);
      p.push((S.cx || 0) + SQ(ca, kk) * S.rx, S.y, (S.cz || 0) + SQ(sa, kk) * S.rz);
      uv.push(i / R * Math.max(circ, 0.05) / tile, v0 / tile);
    }
  }
  // ring i goes counter-clockwise seen from above (+Y); triangles wound so normals point outward. Degenerate (apex) rings drop their zero-area triangle.
  for (let s = 0; s < ns - 1; s++) for (let i = 0; i < R; i++) {
    const a = s * (R + 1) + i, b = a + 1, c = a + R + 1, d = c + 1;
    const dA = sections[s].rx + sections[s].rz < 1e-6, dB = sections[s + 1].rx + sections[s + 1].rz < 1e-6;
    if (!dA) idx.push(a, c, b);
    if (!dB) idx.push(b, c, d);
  }
  let n = computeNormals(p, idx);
  // weld normals along the uv seam (ring vertex 0 and R are coincident)
  for (let s = 0; s < ns; s++) { const o0 = (s * (R + 1)) * 3, o1 = (s * (R + 1) + R) * 3; for (let c = 0; c < 3; c++) { const m = n[o0 + c] + n[o1 + c]; n[o0 + c] = n[o1 + c] = m; } const l = Math.hypot(n[o0], n[o0 + 1], n[o0 + 2]) || 1; for (let c = 0; c < 3; c++) { n[o0 + c] /= l; n[o1 + c] /= l; } }
  const g = { p, n, uv, i: idx };
  const addCap = (s, up) => {
    const S = sections[s]; const base = p.length / 3;
    p.push(S.cx || 0, S.y, S.cz || 0); n.push(0, up ? 1 : -1, 0); uv.push(0.5, 0.5);
    for (let i = 0; i < R; i++) {
      const o = (s * (R + 1) + i) * 3; p.push(p[o], p[o + 1], p[o + 2]); n.push(0, up ? 1 : -1, 0); uv.push(0.5 + (p[o] - (S.cx || 0)) / tile, 0.5 + (p[o + 2] - (S.cz || 0)) / tile);
    }
    for (let i = 0; i < R; i++) { const a = base + 1 + i, b = base + 1 + ((i + 1) % R); if (up) idx.push(base, b, a); else idx.push(base, a, b); }
  };
  if (capBottom) addCap(0, false); if (capTop) addCap(ns - 1, true);
  return g;
}

/** Flat-shaded tapered box centred at origin. taperTop/taperBottom: [sx,sz] scale of that face; slantTop: [dx,dz] shift of the top face. */
export function box(w, h, d, { taperTop = [1, 1], taperBottom = [1, 1], slantTop = [0, 0], tile = 0.5 } = {}) {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const c = [];
  for (let iy = 0; iy < 2; iy++) for (let iz = 0; iz < 2; iz++) for (let ix = 0; ix < 2; ix++) {
    const top = iy === 1; const t = top ? taperTop : taperBottom;
    c.push([(ix ? hw : -hw) * t[0] + (top ? slantTop[0] : 0), top ? hh : -hh, (iz ? hd : -hd) * t[1] + (top ? slantTop[1] : 0)]);
  }
  const C = (ix, iy, iz) => c[iy * 4 + iz * 2 + ix];
  // faces: [corner indices CCW seen from outside]
  const F = [
    [C(1, 0, 0), C(1, 0, 1), C(1, 1, 1), C(1, 1, 0)], // +x
    [C(0, 0, 1), C(0, 0, 0), C(0, 1, 0), C(0, 1, 1)], // -x
    [C(0, 1, 1), C(0, 1, 0), C(1, 1, 0), C(1, 1, 1)], // +y (reversed below)
    [C(0, 0, 0), C(0, 0, 1), C(1, 0, 1), C(1, 0, 0)], // -y
    [C(1, 0, 1), C(0, 0, 1), C(0, 1, 1), C(1, 1, 1)], // +z
    [C(0, 0, 0), C(1, 0, 0), C(1, 1, 0), C(0, 1, 0)], // -z
  ];
  F[2] = [C(0, 1, 0), C(0, 1, 1), C(1, 1, 1), C(1, 1, 0)];
  const p = [], n = [], uv = [], idx = [];
  for (let f of F) {
    const base = p.length / 3;
    let e1 = [f[1][0] - f[0][0], f[1][1] - f[0][1], f[1][2] - f[0][2]], e2 = [f[3][0] - f[0][0], f[3][1] - f[0][1], f[3][2] - f[0][2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    // make sure the winding is outward (face centroid vs normal)
    const cx = (f[0][0] + f[1][0] + f[2][0] + f[3][0]) / 4, cy = (f[0][1] + f[1][1] + f[2][1] + f[3][1]) / 4, cz = (f[0][2] + f[1][2] + f[2][2] + f[3][2]) / 4;
    if (nx * cx + ny * cy + nz * cz < 0) { f = [f[0], f[3], f[2], f[1]]; nx = -nx; ny = -ny; nz = -nz; e1 = [f[1][0] - f[0][0], f[1][1] - f[0][1], f[1][2] - f[0][2]]; e2 = [f[3][0] - f[0][0], f[3][1] - f[0][1], f[3][2] - f[0][2]]; }
    const l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
    const uvs = [[0, 0], [l1 / tile, 0], [l1 / tile, l2 / tile], [0, l2 / tile]];
    for (let k = 0; k < 4; k++) { p.push(...f[k]); n.push(nx, ny, nz); uv.push(...uvs[k]); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { p, n, uv, i: idx };
}
export const cyl = (rTop, rBot, h, R = 6, o = {}) => loft([{ y: 0, rx: rBot, rz: rBot }, { y: h, rx: rTop, rz: rTop }], { R, rot0: 0, capBottom: !!o.caps, capTop: !!o.caps, tile: o.tile || 0.5 });
export function ellipsoid(rx, ry = rx, rz = rx, R = 8, rings = 4, o = {}) {
  const sec = [];
  for (let i = 0; i <= rings; i++) { const th = (i / rings) * Math.PI; const r = Math.sin(th); sec.push({ y: -Math.cos(th) * ry, rx: r * rx, rz: r * rz }); }
  return loft(sec, { R, rot0: o.rot0 ?? 0, tile: o.tile || 0.5, k: 2 });
}

/** Place a mesh: scale, rotate (Euler XYZ), translate. Returns same object. */
export function xf(g, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  _M.compose(_v.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ')), _s.set(scale[0], scale[1], scale[2]));
  _N.getNormalMatrix(_M);
  const p = g.p, n = g.n;
  for (let i = 0; i < p.length; i += 3) { _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(_M); p[i] = _v.x; p[i + 1] = _v.y; p[i + 2] = _v.z; }
  for (let i = 0; i < n.length; i += 3) { _v.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_N).normalize(); n[i] = _v.x; n[i + 1] = _v.y; n[i + 2] = _v.z; }
  return g;
}
/** per-vertex position edit (x,y,z) -> [x,y,z]; normals recomputed only if recompute */
export function warp(g, fn, recompute = false) {
  const p = g.p; const o = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) { const r = fn(p[i], p[i + 1], p[i + 2], i / 3); if (r) { p[i] = r[0]; p[i + 1] = r[1]; p[i + 2] = r[2]; } }
  if (recompute) g.n = computeNormals(g.p, g.i);
  return g;
}
/** mirror a mesh across x=0 (also flips winding) */
export function mirrorX(g) {
  const m = { p: g.p.slice(), n: g.n.slice(), uv: g.uv.slice(), i: g.i.slice() };
  for (let i = 0; i < m.p.length; i += 3) { m.p[i] = -m.p[i]; m.n[i] = -m.n[i]; }
  for (let t = 0; t < m.i.length; t += 3) { const b = m.i[t + 1]; m.i[t + 1] = m.i[t + 2]; m.i[t + 2] = b; }
  return m;
}

const col3 = (c) => (Array.isArray(c) ? c : (() => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; })());

export class FigureMesh {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.m = []; this.i = []; this.nv = 0; this.parts = []; }
  /** add geometry g with tags: j joint, slot colour slot, layer texture layer, gate variant gate, color vertex colour (shade), shade fn/num */
  add(g, { j = 2, slot = 0, layer = 0, gate = 0, color = 0xffffff, shade = 1, name = '' } = {}) {
    const base = this.nv; const cc = col3(color); const nv = g.p.length / 3;
    for (let i = 0; i < g.p.length; i++) { this.p.push(g.p[i]); this.n.push(g.n[i]); }
    for (let i = 0; i < g.uv.length; i++) this.uv.push(g.uv[i]);
    for (let v = 0; v < nv; v++) {
      const sh = typeof shade === 'function' ? shade(g.p[v * 3], g.p[v * 3 + 1], g.p[v * 3 + 2], g.n[v * 3], g.n[v * 3 + 1], g.n[v * 3 + 2]) : shade;
      this.c.push(cc[0] * sh, cc[1] * sh, cc[2] * sh);
      this.m.push(j, gate, slot, layer);
    }
    for (let i = 0; i < g.i.length; i++) this.i.push(g.i[i] + base);
    this.nv += nv; this.parts.push({ name, tris: g.i.length / 3, gate, j });
    return this;
  }
  get tris() { return this.i.length / 3; }
  /** tris that are visible for one variant choice (counts always-on + the max over variant options of each group) */
  trisVisible() {
    let always = 0; const groups = {};
    for (const pt of this.parts) {
      if (pt.gate === 0) { always += pt.tris; continue; }
      const grp = pt.gate >> 4, mask = pt.gate & 15; if (grp >= 14) continue;
      for (let o = 0; o < 4; o++) if ((mask >> o) & 1) { (groups[grp] = groups[grp] || [0, 0, 0, 0])[o] += pt.tris; }
    }
    let v = always; for (const g in groups) v += Math.max(...groups[g]); return v;
  }
  /** darken vertices by simple baked ambient occlusion heuristics (rest pose) */
  bakeAO(fn) { for (let v = 0; v < this.nv; v++) { const f = fn(this.p[v * 3], this.p[v * 3 + 1], this.p[v * 3 + 2], this.n[v * 3], this.n[v * 3 + 1], this.n[v * 3 + 2], this.m[v * 4]); this.c[v * 3] *= f; this.c[v * 3 + 1] *= f; this.c[v * 3 + 2] *= f; } }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(this.m, 4));
    g.setIndex(new THREE.BufferAttribute(this.nv > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i), 1));
    return g;
  }
}
