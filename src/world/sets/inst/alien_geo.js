// Organic geometry generators for the Vessari interiors: ribbed vaults, rib arches, lumpy ovoids, iris petals, drip/steam fx.
import * as THREE from 'three';
import { Q, TAU, RNG, seg } from '../../../engine/common.js';
import { noise3 } from '../../../engine/proc.js';
import { tube } from '../../../engine/geo.js';
import { tf, sstep, clamp01 } from './tex.js';

const _cache = new Map();
/** lumpy ovoid (sphere displaced by noise). cached by key. */
export function lumpGeo(seed = 1, { rx = 1, ry = 1, rz = 1, amp = 0.12, freq = 1.6, w = 18, h = 12 } = {}) {
  const key = `lump:${seed}:${rx}:${ry}:${rz}:${amp}:${freq}:${w}:${h}:${Q.detail}`; if (_cache.has(key)) return _cache.get(key);
  const g = new THREE.SphereGeometry(1, seg(w, 8), seg(h, 5)); const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = noise3(v.x * freq + seed * 3.1, v.y * freq + seed * 1.7, v.z * freq + seed * 5.3) * amp + noise3(v.x * freq * 2.7, v.y * freq * 2.7, v.z * freq * 2.7 + seed) * amp * 0.35; v.multiplyScalar(1 + n); p.setXYZ(i, v.x * rx, v.y * ry, v.z * rz); }
  g.computeVertexNormals(); g.userData.shared = true; _cache.set(key, g); return g;
}

function ribBump(z, period, offset, width) { const t = (z - offset) / period, f = (t - Math.round(t)) * period; return Math.exp(-(f * f) / (width * width)); }
/** Ribbed vault surface (inside facing). Cross-section is a half ellipse; ribs bulge inward. glowFn(z, th, bump) -> 0..1 */
export function vaultGeo({ z0, z1, rx, ry, cy, th0 = -0.1, th1 = Math.PI + 0.1, dz = 0.6, dth = 0.08, period = 2.4, offset = 0, rw = 0.38, depth = 0.04, wob = 0.03, seed = 1, glowFn = null, closeEnds = false }) {
  const nz = Math.max(2, Math.round((z1 - z0) / dz)), nt = Math.max(8, Math.round((th1 - th0) / dth * (0.7 + 0.3 * Q.detail)));
  const P = [], U = [], C = [], G = [], I = [];
  for (let iz = 0; iz <= nz; iz++) {
    const z = z0 + (z1 - z0) * iz / nz, bump = ribBump(z, period, offset, rw);
    for (let it = 0; it <= nt; it++) {
      const th = th0 + (th1 - th0) * it / nt, ct = Math.cos(th), st = Math.sin(th);
      const nA = noise3(ct * 1.3 + seed, st * 1.3, z * 0.09 + seed * 2.1), nB = noise3(ct * 3.2, st * 3.2 + seed, z * 0.4);
      const s = 1 - depth * bump + wob * nA + wob * 0.35 * nB;
      P.push(-rx * s * ct, cy + ry * s * st, z); U.push((th * 0.5 * (rx + ry)), z);
      const ao = (0.48 + 0.52 * bump) * (0.85 + 0.15 * (nB * 0.5 + 0.5)); C.push(ao, ao, ao);
      G.push(glowFn ? glowFn(z, th, bump, st) : 1);
    }
  }
  const row = nt + 1; for (let iz = 0; iz < nz; iz++) for (let it = 0; it < nt; it++) { const a = iz * row + it, b = a + 1, c = a + row, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(G, 1)); g.setIndex(I); g.computeVertexNormals();
  // make normals face the tunnel interior
  const pa = g.attributes.position, na = g.attributes.normal, mid = Math.floor(nt / 2), i0 = mid; const dx = -pa.getX(i0), dy = (cy + ry * 0.2) - pa.getY(i0);
  if (na.getX(i0) * dx + na.getY(i0) * dy < 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.computeVertexNormals(); }
  g.userData.uvMetres = true; return g;
}
/** end wall for a vault: flat shape with an optional arched hole. faces +Z (flip=true faces -Z) */
export function endWallGeo({ rx, ry, cy, th0 = -0.1, th1 = Math.PI + 0.1, hole = null, z = 0, flip = false, n = 64 }) {
  const sh = new THREE.Shape(); for (let i = 0; i <= n; i++) { const th = th0 + (th1 - th0) * i / n; const x = -rx * Math.cos(th), y = cy + ry * Math.sin(th); i ? sh.lineTo(x, y) : sh.moveTo(x, y); } sh.closePath();
  if (hole && hole.circle) { const h = new THREE.Path(); h.absarc(0, hole.circle.cy, hole.circle.r, 0, Math.PI * 2, true); sh.holes.push(h); }
  else if (hole) { const h = new THREE.Path(); const { hx, y0, y1, ay } = hole; h.moveTo(-hx, y0); h.lineTo(hx, y0); h.lineTo(hx, y1); for (let i = 1; i < 32; i++) { const a = i / 32 * Math.PI; h.lineTo(hx * Math.cos(a), y1 + ay * Math.sin(a)); } h.lineTo(-hx, y1); h.closePath(); sh.holes.push(h); }
  const g = new THREE.ShapeGeometry(sh, 4); const p = g.attributes.position, uv = g.attributes.uv; const U = [];
  for (let i = 0; i < p.count; i++) { p.setZ(i, z); uv.setXY(i, p.getX(i), p.getY(i)); }
  if (flip) { const idx = g.index; if (idx) for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); } for (let i = 0; i < g.attributes.normal.count; i++) g.attributes.normal.setZ(i, -1); }
  g.userData.uvMetres = true; return g;
}
/** one rib: tube following the vault cross-section at depth z. thick = [rBase, rTop] */
export function ribGeo({ z, rx, ry, cy, th0 = -0.05, th1 = Math.PI + 0.05, thick = [0.34, 0.2], inset = 0.1, seed = 1, n = 22 }) {
  const rng = new RNG(Math.floor(seed * 1000 + z * 7)); const pts = [], radii = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, th = th0 + (th1 - th0) * t, s = 1 - inset / Math.min(rx, ry) + 0.015 * noise3(t * 4 + seed, z * 0.3, 1.3);
    pts.push(new THREE.Vector3(-rx * s * Math.cos(th), cy + ry * s * Math.sin(th), z + 0.06 * noise3(t * 3, seed, z)));
    const mid = Math.sin(t * Math.PI), knob = 0.5 + 0.5 * noise3(t * 9 + seed, z, 4.4);
    radii.push((thick[0] + (thick[1] - thick[0]) * mid) * (0.85 + 0.35 * knob) * (0.75 + 0.25 * Math.sin(t * Math.PI)));
  }
  return tube(pts, radii, { radial: 8, segsPerPoint: 3 });
}
/** curved bone petal (iris door leaf) in the XY plane pointing +Y from origin, length L, base width wb, tip width wt */
export function petalGeo(L = 2.6, wb = 1.3, wt = 0.15, thick = 0.2, curve = 0.25) {
  const sh = new THREE.Shape(); sh.moveTo(-wb / 2, 0); sh.quadraticCurveTo(-wb * 0.62, L * 0.55, -wt / 2, L); sh.quadraticCurveTo(0, L * 1.04, wt / 2, L); sh.quadraticCurveTo(wb * 0.62, L * 0.55, wb / 2, 0); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: thick * 0.4, bevelSegments: 2, curveSegments: 8 });
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / L; p.setZ(i, p.getZ(i) + y * y * curve * L); }
  g.computeVertexNormals();
  // box uv by position
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 0.5, p.getY(i) * 0.5);
  return g;
}

// ---------- fx: falling drips, rising steam / spores (one draw call each, fully vertex-shader driven) ----------
const FX_V = /* glsl */`
attribute vec3 aSeed; // x: phase  y: speed  z: size
uniform float uT; uniform float uFall; uniform float uKind;
varying vec2 vUv; varying float vA;
void main(){
  vUv = uv; float ph = aSeed.x, sp = aSeed.y, sz = aSeed.z; float f = fract(uT * sp + ph);
  vec3 p = position; vec3 off = vec3(0.0);
  if (uKind < 0.5) { off.y = -f * f * uFall; vA = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.9, 1.0, f)); }          // drip: accelerates downward
  else { off.y = f * uFall; off.x = sin(uT * 0.4 + ph * 40.0) * f * 0.8; off.z = cos(uT * 0.33 + ph * 31.0) * f * 0.8; vA = sin(f * 3.14159) ; } // steam / spores rise & drift
  vec4 mv = modelViewMatrix * vec4(p + off, 1.0);
  vec2 q = (uv - 0.5) * sz; if (uKind < 0.5) q.y *= 2.6 + f * 3.0; else { q *= 1.0 + f * 2.2; }
  mv.xy += q; gl_Position = projectionMatrix * mv;
}`;
const FX_F = /* glsl */`
uniform vec3 uColor; uniform float uKind; uniform float uA; varying vec2 vUv; varying float vA;
void main(){
  vec2 c = vUv - 0.5; float a;
  if (uKind < 0.5) { float d = abs(c.x) * 5.0; a = (1.0 - smoothstep(0.0, 1.0, d)) * (1.0 - smoothstep(0.15, 0.5, abs(c.y))); a *= 1.0 - 0.35 * smoothstep(-0.1, 0.5, -c.y); }
  else { a = 1.0 - smoothstep(0.0, 0.5, length(c)); a *= a; }
  gl_FragColor = vec4(uColor * a * vA * uA, 1.0);
}`;
/** points: [[x,y,z],...] source positions. kind 'drip'|'steam'. Returns mesh (additive). */
export function fxMesh(k, points, { kind = 'drip', fall = 3, size = 0.06, color = 0x46e6ff, a = 1.2, speed = 0.18, seed = 1 } = {}) {
  const rng = new RNG(seed * 77 + points.length); const n = points.length; const pos = [], uv = [], sd = [], idx = [];
  points.forEach((pt, i) => {
    const ph = rng.next(), sp = speed * rng.range(0.6, 1.4), sz = size * rng.range(0.7, 1.4);
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push(pt[0], pt[1], pt[2]); uv.push(u, v); sd.push(ph, sp, sz); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 3)); g.setIndex(idx);
  const box = new THREE.Box3(); for (const p of points) box.expandByPoint(new THREE.Vector3(p[0], p[1], p[2])); box.expandByScalar(Math.abs(fall) + 2); g.boundingBox = box; g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
  const m = new THREE.ShaderMaterial({ uniforms: { uT: k.uTime, uFall: { value: fall }, uKind: { value: kind === 'drip' ? 0 : 1 }, uColor: { value: new THREE.Color(color) }, uA: { value: a } }, vertexShader: FX_V, fragmentShader: FX_F, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 7; mesh.frustumCulled = false; mesh.name = 'fx:' + kind; k.root.add(mesh); m.userData.fxBase = new THREE.Color(color); (k._fxMeshes || (k._fxMeshes = [])).push(m); return mesh;
}
export { tf, sstep, clamp01 };
