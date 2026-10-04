// VEGETATION — instanced palms/coconut, broadleaf/deciduous/autumn/birch trees, pines/spruce, bushes, grass tufts, banana, acacia.
// One shared texture atlas + one material for every kind (wind sway + backlit translucency in shader), 1 InstancedMesh (= 1 draw call, +1 shadow pass) per kind.
import * as THREE from 'three';
import { Q, RNG, clamp, lerp, smoothstep } from '../engine/common.js';
import { cached } from '../engine/proc.js';
import { vegAtlas, regUV } from './env/vegAtlas.js';
import { envUniforms, setWind, getWind, setSnow } from './env/wind.js';

export { setWind, getWind, setSnow };

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

// ============================================================================ geometry builder
class GB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.s = []; this.i = []; this.count = 0; }
  v(x, y, z, nx, ny, nz, u, v, r, g, b, bend = 0, flut = 0, flip = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(r, g, b); this.s.push(bend, flut, flip); return this.count++; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.s, 3));
    g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox(); g.userData.tris = this.i.length / 3; return g;
  }
}
const _uv = [0, 0];
const grade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** Tapered/curved tube. pts: V3[], radii: fn(t)->r, region: atlas region for uv (v mapped from vTop at t=1 to vBot at t=0) */
function tubeSweep(gb, pts, radiusFn, { radial = 7, region = 'white', vBot = 0.5, vTop = 0.5, color = () => [1, 1, 1], H = 10, amp = 0.5, uSpan = 1 } = {}) {
  const n = pts.length; const tans = [], Ns = [], Bs = [];
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; tans.push(b.clone().sub(a).normalize()); }
  let N = new V3(1, 0, 0); if (Math.abs(tans[0].dot(N)) > 0.9) N = new V3(0, 0, 1);
  for (let i = 0; i < n; i++) { N = N.clone().sub(tans[i].clone().multiplyScalar(N.dot(tans[i]))).normalize(); Ns.push(N); Bs.push(new V3().crossVectors(tans[i], N)); }
  const base = gb.count;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); const r = radiusFn(t); const col = color(t); const bend = amp * Math.pow(Math.max(0, pts[i].y) / H, 2);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a);
      const nx = Ns[i].x * ca + Bs[i].x * sa, ny = Ns[i].y * ca + Bs[i].y * sa, nz = Ns[i].z * ca + Bs[i].z * sa;
      const uvv = regUV(region, (j / radial) * uSpan, lerp(vBot, vTop, t), _uv);
      gb.v(pts[i].x + nx * r, pts[i].y + ny * r, pts[i].z + nz * r, nx, ny, nz, uvv[0], uvv[1], col[0], col[1], col[2], bend, 0, 0);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = base + i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1; gb.i.push(a, c, b, b, c, d); }
}

/** Bent strip along a heading: used for fronds, banana leaves, pine branches, grass blades. */
function bentStrip(gb, o) {
  const { origin, yaw, pitch0, pitch1, length, w0, w1, segs = 8, region, vdrop = 0.3, bendAmp = 0.5, H = 10, flutter = 1, color = () => [1, 1, 1], curve = 1.4, flip = 1, uRange = [0, 1], twist = 0, normalUp = 0 } = o;
  const s = new V3(Math.cos(yaw), 0, -Math.sin(yaw)); // horizontal side vector
  const p = origin.clone(); const base = gb.count;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const pitch = lerp(pitch0, pitch1, Math.pow(t, curve)) * Math.PI / 180;
    const f = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    if (i > 0) { // advance using the average heading of this segment
      const pitchPrev = lerp(pitch0, pitch1, Math.pow((i - 0.5) / segs, curve)) * Math.PI / 180; const fa = new V3(Math.sin(yaw) * Math.cos(pitchPrev), Math.sin(pitchPrev), Math.cos(yaw) * Math.cos(pitchPrev));
      p.addScaledVector(fa, length / segs);
    }
    const w = lerp(w0, w1, Math.pow(t, 0.8)) * (t > 0.85 ? Math.max(0.12, 1 - (t - 0.85) / 0.15 * 0.88) : 1) * 0.5; // taper last 15%
    const sv = s.clone(); if (twist) sv.applyAxisAngle(f, twist * t);
    const nUp = new V3().crossVectors(f, sv).normalize(); if (nUp.y < 0) nUp.negate();
    if (normalUp) nUp.lerp(UP, normalUp).normalize();
    const col = color(t); const bend = bendAmp * Math.pow(Math.max(0, p.y) / H, 2) + 0.0;
    const fl = flutter * (0.15 + 0.85 * t);
    const uu = lerp(uRange[0], uRange[1], t);
    for (let k = -1; k <= 1; k++) {
      const drop = Math.abs(k) * vdrop * w;
      const px = p.x + sv.x * w * k, py = p.y + sv.y * w * k - drop, pz = p.z + sv.z * w * k;
      const nn = nUp.clone().addScaledVector(sv, k * vdrop * 0.9).normalize();
      const uvv = regUV(region, uu, 0.5 + k * 0.5 * 0.97, _uv);
      gb.v(px, py, pz, nn.x, nn.y, nn.z, uvv[0], uvv[1], col[0], col[1], col[2], bend, fl, flip);
    }
  }
  for (let i = 0; i < segs; i++) { const a = base + i * 3, b = a + 3; gb.i.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
  return p.clone();
}

/** Free-standing card (leaf cluster) with spherical/custom normals. right/up are half-extent vectors. */
function card(gb, c, right, up, { region, normalFn, color = [1, 1, 1], bend = 0, flut = 1, uv = [0, 1, 0, 1], flip = 0 }) {
  const ids = []; const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sy] of corners) {
    const px = c.x + right.x * sx + up.x * sy, py = c.y + right.y * sx + up.y * sy, pz = c.z + right.z * sx + up.z * sy;
    const nn = normalFn(px, py, pz); const uvv = regUV(region, lerp(uv[0], uv[1], (sx + 1) / 2), lerp(uv[3], uv[2], (sy + 1) / 2), _uv);
    ids.push(gb.v(px, py, pz, nn.x, nn.y, nn.z, uvv[0], uvv[1], color[0], color[1], color[2], bend, flut, flip));
  }
  gb.quad(ids[0], ids[1], ids[2], ids[3]);
}

function addGeom(gb, geo, mat4, color, bend, region = 'white') {
  const p = geo.attributes.position, n = geo.attributes.normal; const v = new V3(), nn = new V3(); const nm = new THREE.Matrix3().getNormalMatrix(mat4); const base = gb.count;
  const uvv = regUV(region, 0.5, 0.5, [0, 0]);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mat4); nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); gb.v(v.x, v.y, v.z, nn.x, nn.y, nn.z, uvv[0], uvv[1], color[0], color[1], color[2], bend, 0, 0); }
  const idx = geo.index; for (let i = 0; i < idx.count; i++) gb.i.push(base + idx.getX(i));
}

const rad = (d) => d * Math.PI / 180;
const detail = () => (Q.level === 0 ? 0 : Q.level === 1 ? 1 : 2);

// ============================================================================ kind builders: return { geo, height, radius }
const BUILD = {};

BUILD.coconut = (variant, seed) => {
  const r = new RNG(seed); const gb = new GB(); const d = detail(); const H = 11.5 + r.range(-0.5, 1);
  const lean = new V3(1.5 + r.range(0, 0.8), 0, 0.5 * r.range(-1, 1)); const rings = 8 + d * 3; const pts = [];
  for (let i = 0; i <= rings; i++) { const t = i / rings; pts.push(new V3(lean.x * Math.pow(t, 1.7) + 0.12 * Math.sin(t * 5), H * t, lean.z * Math.sin(t * 2.4))); }
  const top = pts[pts.length - 1].clone();
  tubeSweep(gb, pts, (t) => lerp(0.3, 0.155, t) + 0.2 * Math.exp(-t * 16), { radial: 5 + d * 2, region: 'barkPalm', vBot: 0.98, vTop: 0.02, color: (t) => grade([1.05, 1.0, 0.95], 0.75 + 0.3 * t), H, amp: 0.9 });
  // crown: three layers of fronds (young upright, middle arching, old drooping)
  const layers = [{ n: 6, p0: 66, p1: 8, len: 4.0, tint: [1.12, 1.15, 1.0], ao: 0.62 }, { n: 8, p0: 40, p1: -38, len: 5.1, tint: [1, 1, 1], ao: 0.55 }, { n: 6, p0: 14, p1: -76, len: 4.5, tint: [0.98, 0.92, 0.62], ao: 0.5 }];
  const nCrown = d === 0 ? 0.65 : 1; let off = r.range(0, 6);
  for (const L of layers) {
    const n = Math.max(3, Math.round(L.n * nCrown));
    for (let i = 0; i < n; i++) {
      const yaw = off + (i / n) * Math.PI * 2 + r.range(-0.2, 0.2); const len = L.len * r.range(0.9, 1.1);
      bentStrip(gb, { origin: top.clone().add(new V3(0, -0.1 + L.p0 * 0.002, 0)), yaw, pitch0: L.p0 + r.range(-6, 6), pitch1: L.p1 + r.range(-10, 6), length: len, w0: 0.9, w1: 2.3, segs: 5 + d * 2, region: 'frondCoconut', vdrop: 0.38, bendAmp: 0.9, H, flutter: 1.0, curve: 1.5, flip: 1,
        color: (t) => grade(L.tint, lerp(L.ao, 1.05, Math.pow(t, 0.7))) });
    }
    off += 0.55;
  }
  // coconuts
  const geo = new THREE.SphereGeometry(0.14, 6, 4); const m = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + r.range(-0.3, 0.3); m.makeTranslation(top.x + Math.cos(a) * 0.28, top.y - 0.38 + r.range(-0.1, 0.1), top.z + Math.sin(a) * 0.28); m.scale(new V3(1, 1.15, 1)); addGeom(gb, geo, m, i % 3 === 0 ? [0.4, 0.34, 0.14] : [0.3, 0.46, 0.14], 0.9); }
  geo.dispose();
  return { geo: gb.geometry(), height: H + 2, radius: 5.6 };
};

BUILD.palm = (variant, seed) => { // royal / date style: straight tall trunk, smooth crownshaft, symmetric arching crown
  const r = new RNG(seed + 7); const gb = new GB(); const d = detail(); const H = 9 + r.range(-0.6, 1.2);
  const rings = 8 + d * 3; const pts = [];
  for (let i = 0; i <= rings; i++) { const t = i / rings; pts.push(new V3(0.25 * Math.sin(t * 2.5), H * t, 0.18 * Math.sin(t * 1.9 + 1))); }
  const top = pts[pts.length - 1].clone();
  tubeSweep(gb, pts, (t) => lerp(0.26, 0.17, t) + 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.18 * Math.exp(-t * 20), { radial: 6 + d * 2, region: 'barkPalm', vBot: 0.98, vTop: 0.02, color: (t) => grade([1.25, 1.22, 1.15], 0.8 + 0.25 * t), H, amp: 0.45 });
  const shaft = [top.clone().add(new V3(0, -0.1, 0)), top.clone().add(new V3(0, 0.9, 0))];
  tubeSweep(gb, [new V3(top.x, top.y - 0.1, top.z), new V3(top.x, top.y + 0.55, top.z), new V3(top.x, top.y + 1.3, top.z)], (t) => lerp(0.2, 0.15, t), { radial: 6, region: 'white', color: () => [0.5, 0.7, 0.28], H, amp: 0.45 });
  const n = d === 0 ? 7 : 10; const crown = top.clone().add(new V3(0, 1.15, 0));
  for (let i = 0; i < n; i++) {
    const up = i % 3 === 0; const yaw = (i / n) * Math.PI * 2 + r.range(-0.1, 0.1);
    bentStrip(gb, { origin: crown, yaw, pitch0: up ? 72 : 50 + r.range(-6, 6), pitch1: up ? 20 : -38 + r.range(-8, 6), length: (up ? 3.4 : 4.2) * r.range(0.9, 1.08), w0: 0.7, w1: 1.6, segs: 5 + d * 2, region: 'frondRoyal', vdrop: 0.42, bendAmp: 0.5, H, flutter: 1, curve: 1.4, flip: 1, color: (t) => grade(up ? [1.1, 1.12, 1] : [1, 1, 1], lerp(0.6, 1.05, Math.pow(t, 0.7))) });
  }
  void shaft; return { geo: gb.geometry(), height: H + 3.5, radius: 4 };
};

function branchTree(variant, seed) {
  const r = new RNG(seed + 3); const gb = new GB(); const d = detail();
  const V = {
    tropical: { H: 13, trunkH: 5.2, crownR: 6.2, tr: 0.42, leaf: 'leafBroad', size: 3.3, cards: 3, tint: [0.78, 0.9, 0.72], limbs: 5, bark: 'barkTree', barkTint: [1, 0.95, 0.9], amp: 0.5, anchorsPer: 11 },
    deciduous: { H: 12, trunkH: 4.2, crownR: 5.6, tr: 0.38, leaf: 'leafSmall', size: 3.0, cards: 3, tint: [0.95, 1.05, 0.78], limbs: 5, bark: 'barkTree', barkTint: [1, 0.95, 0.9], amp: 0.5, anchorsPer: 11 },
    autumn: { H: 12, trunkH: 4.2, crownR: 5.6, tr: 0.38, leaf: 'leafAutumn', size: 3.0, cards: 3, tint: [1, 1, 1], limbs: 5, bark: 'barkTree', barkTint: [1, 0.95, 0.9], amp: 0.5, anchorsPer: 11, autumn: true },
    bare: { H: 12, trunkH: 4.2, crownR: 5.6, tr: 0.38, leaf: null, size: 0, cards: 0, tint: [1, 1, 1], limbs: 6, bark: 'barkTree', barkTint: [0.85, 0.85, 0.85], amp: 0.5, anchorsPer: 11, twigs: true },
    birch: { H: 13, trunkH: 6.0, crownR: 3.4, tr: 0.2, leaf: 'leafSmall', size: 2.5, cards: 3, tint: [1.15, 1.2, 0.72], limbs: 6, bark: 'barkBirch', barkTint: [1, 1, 1], amp: 0.7, anchorsPer: 9 },
  }[variant] || null;
  const P = V || { H: 12, trunkH: 4.5, crownR: 5.6, tr: 0.38, leaf: 'leafSmall', size: 3.0, cards: 3, tint: [1, 1, 1], limbs: 5, bark: 'barkTree', barkTint: [1, 1, 1], amp: 0.5, anchorsPer: 11 };
  const H = P.H * r.range(0.92, 1.08); const trunkH = P.trunkH; const anchors = [];
  const crownC = new V3(0, trunkH + (H - trunkH) * 0.5, 0); const crownRy = (H - trunkH) * 0.55;
  // trunk
  const rings = 6 + d * 2; const tp = [];
  for (let i = 0; i <= rings; i++) { const t = i / rings; tp.push(new V3(0.25 * Math.sin(t * 3 + seed), trunkH * 1.02 * t, 0.2 * Math.sin(t * 2.3 + seed * 2))); }
  tubeSweep(gb, tp, (t) => lerp(P.tr, P.tr * 0.62, t) + P.tr * 0.7 * Math.exp(-t * 13), { radial: 6 + d * 2, region: P.bark, vBot: 0.98, vTop: 0.1, color: (t) => grade(P.barkTint, 0.7 + 0.3 * t), H, amp: P.amp });
  const trunkTop = tp[tp.length - 1].clone();
  // limbs + sub-branches
  const limbCount = Math.round(P.limbs * (d === 0 ? 0.8 : 1)); const yaw0 = r.range(0, 6.28);
  function branch(o, dir, len, r0, depth) {
    const pts = []; const p = o.clone(); const dd = dir.clone().normalize(); const n = 4;
    for (let i = 0; i <= n; i++) { pts.push(p.clone()); dd.add(new V3(r.range(-0.12, 0.12), 0.1 + (depth === 0 ? -0.05 : 0.06), r.range(-0.12, 0.12))).normalize(); p.addScaledVector(dd, len / n); }
    tubeSweep(gb, pts, (t) => lerp(r0, r0 * 0.5, t), { radial: d === 0 ? 4 : 5, region: P.bark, vBot: 0.8, vTop: 0.2, color: (t) => grade(P.barkTint, 0.8 + 0.2 * t), H, amp: P.amp });
    const end = pts[n];
    if (depth < 2) {
      const kids = depth === 0 ? 3 : 2;
      for (let k = 0; k < kids; k++) {
        const at = pts[Math.min(n, 2 + (k % 3))]; const a = r.range(0, 6.28); const sp = r.range(0.45, 0.8);
        const nd = new V3(dd.x + Math.cos(a) * sp, dd.y * 0.6 + r.range(0.1, 0.5), dd.z + Math.sin(a) * sp);
        branch(at, nd, len * r.range(0.5, 0.75), r0 * 0.5, depth + 1);
      }
      if (depth === 1) anchors.push(end.clone());
    } else anchors.push(end.clone(), pts[3].clone());
    if (depth === 0) anchors.push(pts[3].clone().lerp(end, 0.5));
  }
  for (let i = 0; i < limbCount; i++) {
    const yaw = yaw0 + (i / limbCount) * Math.PI * 2 + r.range(-0.3, 0.3); const el = rad(r.range(32, 58)); const startY = trunkTop.y - r.range(0, 1.4) * (variant === 'birch' ? 0.6 : 1);
    const dir = new V3(Math.cos(yaw) * Math.cos(el), Math.sin(el), Math.sin(yaw) * Math.cos(el));
    branch(new V3(trunkTop.x, startY, trunkTop.z), dir, P.crownR * r.range(0.8, 1.05) * (variant === 'birch' ? 1.0 : 1), P.tr * 0.5, 0);
  }
  anchors.push(new V3(trunkTop.x, H * 0.97, trunkTop.z));
  // foliage
  if (P.leaf) {
    const cards = Math.round(P.cards * (d === 0 ? 0.7 : 1)); const nrm = new V3();
    const cmax = anchors.length * cards; void cmax;
    for (const a of anchors) {
      const reps = d === 0 ? 1 : (P.anchorsPer > 10 ? 1 : 1);
      for (let rr = 0; rr < reps; rr++) for (let k = 0; k < cards; k++) {
        const c = a.clone().add(new V3(r.range(-0.7, 0.7), r.range(-0.4, 0.8), r.range(-0.7, 0.7)));
        const out = c.clone().sub(crownC).setY(0); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
        // random card orientation, biased to face outward/up
        const n0 = new V3(r.range(-1, 1), r.range(-0.3, 1), r.range(-1, 1)).add(out.clone().multiplyScalar(0.8)).normalize();
        const right = new V3().crossVectors(n0, UP).normalize(); if (right.lengthSq() < 0.1) right.set(1, 0, 0); const up = new V3().crossVectors(right, n0).normalize();
        const sz = P.size * r.range(0.8, 1.15) * 0.5; right.multiplyScalar(sz); up.multiplyScalar(sz).applyAxisAngle(n0, r.range(0, 6.28)); right.applyAxisAngle(n0, r.range(0, 6.28));
        let tint = P.tint.slice(); if (P.autumn) { const q = r.next(); tint = q < 0.3 ? [1.1, 0.7, 0.8] : q < 0.7 ? [1.1, 1.0, 0.9] : [1.0, 1.0, 1.0]; }
        const hy = smoothstep(crownC.y - crownRy, crownC.y + crownRy, c.y); const shade = lerp(0.5, 1.12, hy) * r.range(0.9, 1.08);
        card(gb, c, right, up, { region: P.leaf, color: grade(tint, shade), bend: 0, normalFn: (x, y, z) => nrm.set(x - crownC.x, (y - crownC.y) * 0.8 + 0.25 * crownRy, z - crownC.z).normalize().clone(), flut: 1.0 });
      }
    }
    // swayed amplitude: set bend per vertex (cards bend with height)
    for (let i = 0; i < gb.count; i++) if (gb.s[i * 3 + 1] > 0) gb.s[i * 3] = P.amp * 1.2 * Math.pow(Math.max(0, gb.p[i * 3 + 1]) / H, 2);
  }
  return { geo: gb.geometry(), height: H + 1.5, radius: P.crownR + 1 };
}
BUILD.tree = (variant, seed) => branchTree(variant || 'tropical', seed);
for (const v of ['tropical', 'deciduous', 'autumn', 'bare', 'birch']) BUILD[v === 'tropical' ? 'broadleaf' : v] = (_, seed) => branchTree(v, seed);

BUILD.pine = (variant, seed) => {
  const r = new RNG(seed + 11); const gb = new GB(); const d = detail(); const spruce = variant !== 'scots';
  const H = (spruce ? 15 : 14) * r.range(0.85, 1.15); const Rmax = spruce ? 2.9 : 3.2; const h0 = H * (spruce ? 0.16 : 0.42);
  const tp = []; const rings = 6 + d; for (let i = 0; i <= rings; i++) { const t = i / rings; tp.push(new V3(0.12 * Math.sin(t * 3 + seed), H * 0.985 * t, 0.1 * Math.sin(t * 2 + seed))); }
  tubeSweep(gb, tp, (t) => lerp(0.3, 0.03, Math.pow(t, 0.8)) + 0.12 * Math.exp(-t * 14), { radial: 5 + d, region: 'barkTree', vBot: 0.98, vTop: 0.02, color: (t) => grade([0.85, 0.78, 0.7], 0.7 + 0.3 * t), H, amp: 0.45 });
  const whorls = d === 0 ? 8 : spruce ? 14 : 10; const per = d === 0 ? 5 : 7; const layers = d === 0 ? 1 : 2;
  for (let w = 0; w < whorls; w++) {
    const t = w / (whorls - 1); const y = lerp(h0, H * 0.97, t);
    const prof = spruce ? Math.pow(1 - t, 0.85) : (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1))) * (1 - 0.5 * t);
    const len = Math.max(0.7, Rmax * prof * 1.08 + 0.2);
    for (let L = 0; L < layers; L++) for (let k = 0; k < per; k++) {
      const yaw = (k / per + L * 0.5 / per + w * 0.19) * Math.PI * 2 + r.range(-0.18, 0.18); const yy = y - L * 0.32 - r.range(0, 0.15);
      const ctr = tp[Math.min(tp.length - 1, Math.round(yy / H * rings))];
      bentStrip(gb, { origin: new V3(ctr.x, yy, ctr.z), yaw, pitch0: lerp(8, 18, t) + r.range(-6, 6), pitch1: -38 + r.range(-8, 8) + 20 * t, length: len * r.range(0.9, 1.05), w0: len * 0.28 + 0.12, w1: len * 0.28 + 0.12, segs: 3, region: 'pine', vdrop: 0.1, bendAmp: 0.4, H, flutter: 0.7, curve: 1.3, flip: 1, normalUp: 0.35,
        color: (tt) => grade(spruce ? [0.78, 0.9, 0.82] : [0.9, 0.92, 0.7], lerp(0.45, 1.02, tt * 0.9 + t * 0.2) * r.range(0.9, 1.08)) });
    }
  }
  // leader
  for (let k = 0; k < 2; k++) bentStrip(gb, { origin: new V3(tp[tp.length - 1].x, H * 0.9, tp[tp.length - 1].z), yaw: k * 1.57, pitch0: 82, pitch1: 80, length: H * 0.1, w0: 0.5, w1: 0.45, segs: 2, region: 'pine', vdrop: 0, bendAmp: 0.4, H, flutter: 0.4, flip: 1 });
  return { geo: gb.geometry(), height: H, radius: Rmax };
};

BUILD.bush = (variant, seed) => {
  const r = new RNG(seed + 5); const gb = new GB(); const d = detail(); const flowering = variant === 'flowering' || variant === 'hibiscus';
  const R0 = 1.0; const c0 = new V3(0, 0.62, 0); const nrm = new V3();
  const clusters = d === 0 ? 5 : 8; const cards = d === 0 ? 2 : 3; const H = 1.6;
  for (let i = 0; i < clusters; i++) for (let k = 0; k < cards; k++) {
    const a = r.range(0, 6.28), rr = Math.sqrt(r.next()) * R0 * 0.75; const c = new V3(Math.cos(a) * rr, r.range(0.25, 1.05) * (1 - rr / R0 * 0.35), Math.sin(a) * rr);
    const n0 = new V3(r.range(-1, 1), r.range(0, 1), r.range(-1, 1)).add(c.clone().sub(c0).normalize()).normalize(); const right = new V3().crossVectors(n0, UP).normalize(); const up = new V3().crossVectors(right, n0).normalize();
    const sz = r.range(0.55, 0.8); right.multiplyScalar(sz).applyAxisAngle(n0, r.range(0, 6.28)); up.multiplyScalar(sz).applyAxisAngle(n0, r.range(0, 6.28));
    card(gb, c, right, up, { region: 'leafBush', color: grade([0.9, 1, 0.8], lerp(0.5, 1.1, c.y / H) * r.range(0.88, 1.08)), bend: 0.12 * Math.pow(c.y / H, 2), normalFn: (x, y, z) => nrm.set(x - c0.x, (y - c0.y) * 0.7 + 0.2, z - c0.z).normalize().clone(), flut: 1 });
  }
  if (flowering) for (let i = 0; i < (d === 0 ? 5 : 10); i++) {
    const a = r.range(0, 6.28); const c = new V3(Math.cos(a) * R0 * r.range(0.45, 0.8), r.range(0.6, 1.15), Math.sin(a) * R0 * r.range(0.45, 0.8)); const out = c.clone().sub(c0).normalize();
    const right = new V3().crossVectors(out, UP).normalize().multiplyScalar(0.22); const up = new V3().crossVectors(right, out).normalize().multiplyScalar(0.22);
    card(gb, c.add(out.clone().multiplyScalar(0.12)), right, up, { region: 'flowers', color: [1.15, 1.1, 1.1], bend: 0.12 * Math.pow(c.y / H, 2), normalFn: () => out, flut: 1 });
  }
  return { geo: gb.geometry(), height: H, radius: R0 };
};

BUILD.grass = (variant, seed) => {
  const r = new RNG(seed + 13); const gb = new GB(); const d = detail(); const dry = variant === 'dry'; const blades = d === 0 ? 6 : d === 1 ? 9 : 12;
  for (let i = 0; i < blades; i++) {
    const a = r.range(0, 6.28), rr = Math.sqrt(r.next()) * 0.2; const o = new V3(Math.cos(a) * rr, 0, Math.sin(a) * rr); const h = r.range(0.38, 0.85) * (dry ? 1.1 : 1);
    const yaw = r.range(0, 6.28); const lean = r.range(12, 42);
    const base = dry ? [0.35, 0.28, 0.12] : [0.12, 0.26, 0.07], tip = dry ? [0.82, 0.7, 0.34] : [0.5, 0.68, 0.2]; const sh = r.range(0.8, 1.15);
    const s = new V3(Math.cos(yaw), 0, -Math.sin(yaw)); const segs = 3; const ids = [];
    let p = o.clone();
    for (let k = 0; k <= segs; k++) {
      const t = k / segs; const pitch = rad(90 - lean - 55 * t * t); const f = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      if (k > 0) p.addScaledVector(f, h / segs);
      const w = 0.026 * (1 - t) * (k === segs ? 0 : 1) + 0.004; const col = [lerp(base[0], tip[0], t) * sh, lerp(base[1], tip[1], t) * sh, lerp(base[2], tip[2], t) * sh];
      const uvv = regUV('white', 0.5, 0.5, _uv); const nn = new V3(0, 1, 0).addScaledVector(f.clone().setY(0).normalize(), 0.5).normalize();
      const bend = 0.34 * Math.pow(t, 1.3);
      ids.push(gb.v(p.x - s.x * w, p.y, p.z - s.z * w, nn.x, nn.y, nn.z, uvv[0], uvv[1], col[0], col[1], col[2], bend, 0.35 * t, 0), gb.v(p.x + s.x * w, p.y, p.z + s.z * w, nn.x, nn.y, nn.z, uvv[0], uvv[1], col[0], col[1], col[2], bend, 0.35 * t, 0));
    }
    for (let k = 0; k < segs; k++) { const a0 = ids[k * 2], b0 = ids[k * 2 + 1], a1 = ids[k * 2 + 2], b1 = ids[k * 2 + 3]; gb.i.push(a0, b0, a1, b0, b1, a1); }
  }
  return { geo: gb.geometry(), height: 0.9, radius: 0.35 };
};

BUILD.banana = (variant, seed) => {
  const r = new RNG(seed + 17); const gb = new GB(); const d = detail(); const H = 2.7 + r.range(-0.3, 0.4);
  const pts = []; for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push(new V3(0.12 * Math.sin(t * 2), H * t, 0)); }
  tubeSweep(gb, pts, (t) => lerp(0.15, 0.09, t) + 0.05 * Math.exp(-t * 8), { radial: 6 + d, region: 'white', color: (t) => (t < 0.3 ? [0.38, 0.4, 0.2] : [0.5, 0.6, 0.27]), H, amp: 0.25 });
  const top = pts[pts.length - 1].clone(); const n = d === 0 ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const t = i / n; const yaw = i * 2.4 + r.range(-0.2, 0.2); const y0 = top.y - 0.35 * (1 - t) * 0.0 - t * 0.0;
    bentStrip(gb, { origin: new V3(top.x, y0 - (i % 3) * 0.1, top.z), yaw, pitch0: lerp(72, 28, t) + r.range(-6, 6), pitch1: lerp(5, -62, t) + r.range(-8, 8), length: r.range(2.4, 3.2), w0: 0.25, w1: 0.95, segs: 5 + d, region: 'banana', vdrop: 0.22, bendAmp: 0.4, H, flutter: 1.2, curve: 1.6, flip: 1,
      color: (tt) => grade([1.0, 1.05, 0.9], lerp(0.55, 1.05, Math.pow(tt, 0.6)) * (i < 3 ? 0.95 : 1)) });
  }
  // fruit bunch + flower bell
  const g = new THREE.SphereGeometry(0.06, 5, 4); const m = new THREE.Matrix4();
  for (let k = 0; k < 3; k++) for (let j = 0; j < 7; j++) { const a = k * 2.1 + j * 0.25; m.makeTranslation(top.x + 0.35 + Math.cos(a) * 0.09 + k * 0.01, top.y - 0.55 - j * 0.05 - k * 0.12, top.z + Math.sin(a) * 0.09); m.scale(new V3(1, 2.2, 1)); addGeom(gb, g, m, [0.46, 0.62, 0.18], 0.3); }
  const bell = new THREE.SphereGeometry(0.11, 6, 4); m.makeTranslation(top.x + 0.38, top.y - 1.15, top.z); m.scale(new V3(1, 1.6, 1)); addGeom(gb, bell, m, [0.42, 0.1, 0.18], 0.3);
  g.dispose(); bell.dispose();
  return { geo: gb.geometry(), height: H + 1, radius: 3 };
};

BUILD.acacia = (variant, seed) => {
  const r = new RNG(seed + 19); const gb = new GB(); const d = detail(); const H = 6.2 * r.range(0.9, 1.1);
  const tp = []; for (let i = 0; i <= 6; i++) { const t = i / 6; tp.push(new V3(0.5 * Math.sin(t * 3.2) * t, 3.1 * t, 0.35 * Math.sin(t * 2.4 + 1) * t)); }
  tubeSweep(gb, tp, (t) => lerp(0.24, 0.13, t) + 0.12 * Math.exp(-t * 12), { radial: 5 + d, region: 'barkTree', vBot: 0.95, vTop: 0.3, color: (t) => grade([0.9, 0.85, 0.78], 0.7 + 0.3 * t), H, amp: 0.4 });
  const fork = tp[tp.length - 1].clone(); const limbs = d === 0 ? 3 : 4; const anchors = []; const nrm = new V3();
  for (let i = 0; i < limbs; i++) {
    const yaw = i / limbs * 6.28 + r.range(-0.4, 0.4); const el = rad(r.range(28, 48)); const dir = new V3(Math.cos(yaw) * Math.cos(el), Math.sin(el), Math.sin(yaw) * Math.cos(el)); const pts = []; const p = fork.clone(); const dd = dir.clone();
    for (let k = 0; k <= 4; k++) { pts.push(p.clone()); dd.add(new V3(r.range(-0.15, 0.15), 0.05, r.range(-0.15, 0.15))).normalize(); p.addScaledVector(dd, 1.0); }
    tubeSweep(gb, pts, (t) => lerp(0.1, 0.05, t), { radial: 4 + (d > 0 ? 1 : 0), region: 'barkTree', vBot: 0.8, vTop: 0.3, color: () => [0.7, 0.66, 0.6], H, amp: 0.4 });
    anchors.push(pts[4].clone(), pts[3].clone().lerp(pts[4], 0.5), pts[2].clone().add(new V3(dd.x, 0, dd.z).multiplyScalar(0.6)));
  }
  const cc = new V3(fork.x, H * 0.85, fork.z);
  for (const a of anchors) for (let k = 0; k < (d === 0 ? 1 : 2); k++) {
    const c = a.clone().add(new V3(r.range(-0.4, 0.4), 0.3 + k * 0.35, r.range(-0.4, 0.4)));
    const ang = r.range(0, 6.28); const right = new V3(Math.cos(ang), 0.05, Math.sin(ang)).multiplyScalar(2.1 * r.range(0.9, 1.15)); const up = new V3(-Math.sin(ang), 0.05, Math.cos(ang)).multiplyScalar(2.1 * r.range(0.9, 1.15));
    card(gb, c, right, up, { region: 'leafSmall', color: grade([1.0, 1.05, 0.62], lerp(0.7, 1.1, k * 0.5 + r.next() * 0.4)), bend: 0.4 * Math.pow(c.y / H, 2), normalFn: (x, y, z) => nrm.set((x - cc.x) * 0.25, 1, (z - cc.z) * 0.25).normalize().clone(), flut: 0.8 });
  }
  return { geo: gb.geometry(), height: H, radius: 5 };
};

BUILD.fanpalm = (variant, seed) => { // simple fan palm for boulevards: slim trunk + fan leaves
  const r = new RNG(seed + 23); const gb = new GB(); const d = detail(); const H = 6 + r.range(-0.5, 1.5);
  const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new V3(0.15 * Math.sin(t * 2.4), H * t, 0)); }
  tubeSweep(gb, pts, (t) => lerp(0.2, 0.14, t) + 0.1 * Math.exp(-t * 14), { radial: 5 + d, region: 'barkPalm', vBot: 0.98, vTop: 0.02, color: (t) => grade([1.2, 1.1, 0.95], 0.75 + 0.25 * t), H, amp: 0.4 });
  const top = pts[pts.length - 1]; const n = d === 0 ? 10 : 16;
  for (let i = 0; i < n; i++) { const yaw = i / n * 6.28 + r.range(-0.2, 0.2); const down = i % 2 ? 1 : 0; bentStrip(gb, { origin: new V3(top.x, top.y - down * 0.35, top.z), yaw, pitch0: down ? 10 : 38, pitch1: down ? -64 : -22, length: 2.1 * r.range(0.9, 1.1), w0: 0.3, w1: 1.5, segs: 4, region: 'frondRoyal', vdrop: 0.5, bendAmp: 0.4, H, flutter: 1, curve: 1.3, flip: 1, color: (t) => grade(down ? [0.95, 0.9, 0.7] : [1, 1.04, 0.95], lerp(0.55, 1.0, t)) }); }
  return { geo: gb.geometry(), height: H + 2, radius: 2.6 };
};

export const VEGETATION_KINDS = ['palm', 'coconut', 'tree', 'broadleaf', 'deciduous', 'autumn', 'bare', 'birch', 'pine', 'bush', 'grass', 'banana', 'acacia', 'fanpalm'];
const DEFAULT_MIN_DIST = { coconut: 3.6, palm: 3.8, tree: 4.5, broadleaf: 4.5, deciduous: 4.2, autumn: 4.2, bare: 4, birch: 2.6, pine: 2.6, bush: 1.1, grass: 0, banana: 1.8, acacia: 6, fanpalm: 3.5 };

// ============================================================================ material (shared)
const SWAY_VERT_PARS = `
attribute vec3 aSway; uniform float uTime; uniform vec2 uWindDir; uniform float uWindStrength; uniform float uGust;
varying float vLeaf; varying float vFlip;
vec3 vegSway(vec3 p, vec3 sw) {
  vec3 ipos = vec3(0.0); mat3 im = mat3(1.0);
  #ifdef USE_INSTANCING
    ipos = instanceMatrix[3].xyz; im = mat3(instanceMatrix);
  #endif
  vec3 wpos = (modelMatrix * vec4(ipos, 1.0)).xyz; float ph = dot(wpos.xz, vec2(0.37, 0.29));
  float travel = dot(wpos.xz, uWindDir) * 0.04 - uTime * (0.45 + 0.5 * uWindStrength);
  float gust = 0.5 + 0.5 * sin(travel) * (0.6 + 0.4 * sin(travel * 0.37 + 1.3)) + 0.2 * sin(travel * 2.3 + ph);
  float s = uWindStrength * mix(0.55, 0.3 + 0.9 * gust, uGust);
  float osc = 0.75 + 0.25 * sin(uTime * (0.8 + 0.4 * fract(ph * 7.13)) + ph * 5.0);
  vec3 wd = vec3(uWindDir.x, 0.0, uWindDir.y); vec3 wl = transpose(im) * wd; wl = normalize(wl + vec3(1e-5));
  vec3 off = wl * s * sw.x * osc;
  off.y -= s * s * sw.x * 0.12;
  float f = sw.y * (0.3 + 0.7 * min(uWindStrength, 1.6));
  off += vec3(sin(uTime * 5.3 + p.x * 3.1 + ph * 3.0), 0.5 * sin(uTime * 4.1 + p.z * 2.7 + ph * 2.0), cos(uTime * 4.7 + p.y * 2.3 + ph)) * 0.055 * f * (0.5 + s);
  return off;
}`;

function swayPatchVertex(sh) {
  sh.uniforms.uTime = envUniforms.uTime; sh.uniforms.uWindDir = envUniforms.uWindDir; sh.uniforms.uWindStrength = envUniforms.uWindStrength; sh.uniforms.uGust = envUniforms.uGust;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SWAY_VERT_PARS)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += vegSway(position, aSway); vLeaf = step(0.001, aSway.y); vFlip = aSway.z;');
}
let _lfb = null;
function patchedLightsBegin() {
  if (_lfb) return _lfb; const src = THREE.ShaderChunk.lights_fragment_begin; const marker = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const i = src.lastIndexOf(marker);
  if (i < 0) { _lfb = src; return _lfb; }
  // backlit translucency for leaves: light passing through a leaf toward the camera (shadowed light already folded into directLight.color)
  const extra = `
		{ float tr = pow(saturate(dot(-geometryViewDir, directLight.direction)), 2.2); float thin = vLeaf * 0.62; reflectedLight.directDiffuse += directLight.color * material.diffuseColor * (tr * thin * 0.9 + 0.12 * thin * saturate(-dot(normal, directLight.direction))); }`;
  _lfb = src.slice(0, i + marker.length) + extra + src.slice(i + marker.length); return _lfb;
}
function vegMaterial() {
  return cached('veg:material', () => {
    const m = new THREE.MeshStandardMaterial({ map: vegAtlas(), vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.42, alphaToCoverage: true });
    m.onBeforeCompile = (sh) => {
      swayPatchVertex(sh); sh.uniforms.uSnow = envUniforms.uSnow;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLeaf; varying float vFlip; uniform float uSnow;')
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', 'normal *= mix(1.0, faceDirection, vFlip);'))
        .replace('#include <lights_fragment_begin>', patchedLightsBegin())
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  { float upk = smoothstep(0.35, 0.9, inverseTransformDirection(normal, viewMatrix).y) * uSnow; material.diffuseColor = mix(material.diffuseColor, vec3(0.9, 0.93, 0.97), upk); }`);
    };
    m.customProgramCacheKey = () => 'veg-v1'; m.userData.shared = true; return m;
  });
}
function vegDepthMaterial() {
  return cached('veg:depth', () => {
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: vegAtlas(), alphaTest: 0.42 });
    m.onBeforeCompile = (sh) => { swayPatchVertex(sh); };
    m.customProgramCacheKey = () => 'vegdepth-v1'; m.userData.shared = true; return m;
  });
}

// ============================================================================ factory
const _kindGeo = (kind, variant, seed) => cached(`veg:geo:${kind}:${variant}:${seed}:${Q.level}`, () => {
  const b = BUILD[kind]; if (!b) throw new Error('unknown vegetation kind ' + kind);
  const out = b(variant, seed); out.geo.userData.meta = { height: out.height, radius: out.radius }; return out.geo;
});

/**
 * createVegetation(kind, {capacity=1, variant, seed=1, castShadow}) -> VegetationSet
 *   kinds: palm coconut tree|broadleaf deciduous autumn bare birch pine bush grass banana acacia fanpalm
 *   variants: tree {tropical|deciduous|autumn|bare|birch}, pine {spruce|scots}, bush {flowering}, grass {dry}
 * Returns { root, mesh, kind, capacity, count, height, radius, set(i,{x,y,z,yaw,scale,tilt,tint}), setCount(n), commit(), update(), dispose(), tris }.
 */
export function createVegetation(kind = 'palm', opts = {}) {
  let variant = opts.variant; let k = kind;
  if (k === 'tree' && !variant) variant = 'tropical';
  const seeds = opts.variants ?? 1; const seed = opts.seed ?? 1;
  const geo = _kindGeo(k, variant, ((seed - 1) % Math.max(1, seeds)) + 1);
  const capacity = opts.capacity ?? 1;
  const mesh = new THREE.InstancedMesh(geo, vegMaterial(), capacity); mesh.name = 'veg:' + kind;
  mesh.customDepthMaterial = vegDepthMaterial(); mesh.castShadow = opts.castShadow ?? Q.shadows; mesh.receiveShadow = Q.shadows; mesh.frustumCulled = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage); mesh.count = 0;
  const root = new THREE.Group(); root.name = 'vegetation:' + kind; root.add(mesh);
  const col = new THREE.Color(); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new V3(), sc = new V3();
  const set = {
    root, mesh, kind, capacity, count: 0, height: geo.userData.meta.height, radius: geo.userData.meta.radius, tris: geo.userData.tris,
    set(i, { x = 0, y = 0, z = 0, yaw = 0, scale = 1, tilt = 0, tiltDir = 0, tint = null, sx, sy, sz } = {}) {
      e.set(Math.sin(tiltDir) * tilt, yaw, Math.cos(tiltDir) * tilt, 'YXZ'); q.setFromEuler(e); pos.set(x, y, z); sc.set(sx ?? scale, sy ?? scale, sz ?? scale); m4.compose(pos, q, sc); mesh.setMatrixAt(i, m4);
      if (tint) { if (Array.isArray(tint)) col.setRGB(tint[0], tint[1], tint[2]); else col.set(tint); } else col.setRGB(1, 1, 1);
      mesh.setColorAt(i, col); if (i >= set.count) { set.count = i + 1; mesh.count = set.count; } return set;
    },
    setCount(n) { set.count = Math.min(n, capacity); mesh.count = set.count; mesh.instanceMatrix.needsUpdate = true; },
    commit() { mesh.count = set.count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.boundingSphere = null; mesh.boundingBox = null; mesh.computeBoundingSphere(); },
    update() {},
    dispose() { mesh.dispose(); if (root.parent) root.parent.remove(root); },
  };
  if (!mesh.instanceColor) { mesh.setColorAt(0, col.setRGB(1, 1, 1)); }
  if (capacity === 1 && opts.place !== false) { set.set(0, {}); set.commit(); }
  return set;
}

/**
 * scatterVegetation(heightFnOrTerrain, kind, count, area, seed, opts) -> VegetationSet (one InstancedMesh)
 *  area: number (radius around centre) | {cx,cz,radius} | {x0,z0,x1,z1}
 *  opts: {variant, mask(x,z)->0..1, minHeight,maxHeight,maxSlope, minDist, scale:[a,b], exclude:[{x,z,r}|{x0,z0,x1,z1}], tintVar, lean, yOffset, scaleCount=true, densityKind}
 *  count is scaled by Q.crowd (0.45+0.55*crowd) unless opts.scaleCount===false. With a terrain the terrain's own density(kind,x,z) mask is used.
 */
export function scatterVegetation(heightSrc, kind, count, area = 100, seed = 1, opts = {}) {
  const r = new RNG(seed * 7919 + 13);
  const hf = typeof heightSrc === 'function' ? heightSrc : (x, z) => heightSrc.heightAt(x, z);
  const dens = typeof heightSrc === 'object' && heightSrc.density ? (x, z) => heightSrc.density(opts.densityKind || kind, x, z) : () => 1;
  let cx = 0, cz = 0, rad = 100, rect = null;
  if (typeof area === 'number') rad = area; else if (area.radius !== undefined) { cx = area.cx ?? 0; cz = area.cz ?? 0; rad = area.radius; } else { rect = area; }
  const target = opts.scaleCount === false ? count : Math.max(1, Math.round(count * (0.45 + 0.55 * Q.crowd)));
  const minDist = opts.minDist ?? DEFAULT_MIN_DIST[kind] ?? 2; const cell = Math.max(0.5, minDist); const grid = new Map(); const placed = [];
  const sc = opts.scale || [0.8, 1.25]; const excl = opts.exclude || [];
  const inExcl = (x, z) => { for (const ex of excl) { if (ex.r !== undefined) { const dx = x - ex.x, dz = z - ex.z; if (dx * dx + dz * dz < ex.r * ex.r) return true; } else if (x > ex.x0 && x < ex.x1 && z > ex.z0 && z < ex.z1) return true; } return false; };
  const veg = createVegetation(kind, { capacity: target, variant: opts.variant, seed: opts.geoSeed ?? 1, castShadow: opts.castShadow });
  let tries = 0; const maxTries = target * 14; const nrm = new V3();
  while (placed.length < target && tries++ < maxTries) {
    let x, z;
    if (rect) { x = r.range(rect.x0, rect.x1); z = r.range(rect.z0, rect.z1); } else { const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * rad; x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d; }
    if (inExcl(x, z)) continue;
    const y = hf(x, z); if (opts.minHeight !== undefined && y < opts.minHeight) continue; if (opts.maxHeight !== undefined && y > opts.maxHeight) continue;
    let p = dens(x, z) * (opts.mask ? opts.mask(x, z) : 1); if (p <= 0 || r.next() > p) continue;
    if (opts.maxSlope !== undefined && heightSrc.normalAt) { heightSrc.normalAt(x, z, nrm); if (1 - nrm.y > opts.maxSlope) continue; }
    if (minDist > 0) { // spatial hash min-distance
      const gx = Math.floor(x / cell), gz = Math.floor(z / cell); let bad = false;
      for (let j = -1; j <= 1 && !bad; j++) for (let i = -1; i <= 1 && !bad; i++) { const l = grid.get((gx + i) * 73856093 ^ (gz + j) * 19349663); if (l) for (const o of l) { const dx = o[0] - x, dz = o[1] - z; if (dx * dx + dz * dz < minDist * minDist) { bad = true; break; } } }
      if (bad) continue; const key = gx * 73856093 ^ gz * 19349663; (grid.get(key) || grid.set(key, []).get(key)).push([x, z]);
    }
    placed.push([x, y, z]);
  }
  const tv = opts.tintVar ?? 0.12; const lean = opts.lean ?? 0.04;
  for (let i = 0; i < placed.length; i++) {
    const [x, y, z] = placed[i]; const s = lerp(sc[0], sc[1], Math.pow(r.next(), 0.8)); const t = 1 + r.range(-tv, tv);
    veg.set(i, { x, y: y + (opts.yOffset ?? 0), z, yaw: r.range(0, Math.PI * 2), scale: s, tilt: r.range(0, lean), tiltDir: r.range(0, 6.28), tint: [t * (1 + r.range(-tv * 0.4, tv * 0.4)), t, t * (1 + r.range(-tv * 0.4, tv * 0.4))] });
  }
  veg.setCount(placed.length); veg.commit(); veg.requested = target; return veg;
}

/** Deterministic hand placement helper: place `n` instances from an array of {x,y,z,yaw,scale} */
export function placeVegetation(kind, items, opts = {}) { const v = createVegetation(kind, { ...opts, capacity: items.length }); items.forEach((it, i) => v.set(i, it)); v.commit(); return v; }
