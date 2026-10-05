// Headwear (caps, visors, helmets, hats) built on the head-shell tools. buildHeadwear(P, hs, bi, spec) ->
// { geo, glass, fab, rough, cover } ; geo is a merged, head-skinned geometry (vertex colours), cover = 'none'|'cap'|'full' (how much hair it hides)
import * as THREE from 'three';
import { V, smooth, mixn, applySkin, rigid, mergeAll } from './kit.js';
import { capGeometry, CROWN, hairline } from './hairlib.js';
import { noise2, fbm2 } from '../../engine/proc.js';

const deg = (a) => Math.abs(a) * 180 / Math.PI;
const tint = (g, color) => { const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };

/** brim: plate extending outward from the head at row y over phi range; len(phi) metres(nominal), drop = downward curl */
function brim(hs, y, off, p0, p1, len, drop, color, nc = 16, nr = 5) {
  const pos = [], uv = [], col = [], idx = [], tmp = { p: V(), n: V() }, m = V(), c = new THREE.Color(color);
  for (let j = 0; j <= nr; j++) for (let i = 0; i <= nc; i++) {
    const phi = mixn(p0, p1, i / nc), r = j / nr; hs.point(y, phi, off, tmp);
    const dir = V(tmp.n.x, 0, tmp.n.z).normalize(), L = len(phi);
    const q = tmp.p.clone().addScaledVector(dir, L * r); q.y -= drop * r * r;
    hs.toModel(q, m); pos.push(m.x, m.y, m.z); uv.push(i / nc, r); const k = 1 - 0.18 * r; col.push(c.r * k, c.g * k, c.b * k);
  }
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) { const a = j * (nc + 1) + i, b = a + 1, d = a + nc + 1, e = d + 1; idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** thin rod between nominal points */
function rod(hs, a, b, r, color) {
  const A = hs.toModel(V(...a)), B = hs.toModel(V(...b)), len = A.distanceTo(B), g = new THREE.CylinderGeometry(r, r, len, 5); g.rotateX(Math.PI / 2);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(A, B, V(0, 1, 0))); g.applyQuaternion(q); const mid = A.add(B).multiplyScalar(0.5); g.translate(mid.x, mid.y, mid.z); return tint(g, color);
}
const disc = (hs, p, r, th, color, rotY = 0) => { const g = new THREE.CylinderGeometry(r * hs.sh, r * hs.sh, th, 14); g.rotateX(Math.PI / 2); g.rotateY(rotY); const m = hs.toModel(V(...p)); g.translate(m.x, m.y, m.z); return tint(g, color); };

export function buildHeadwear(P, hs, bi, spec) {
  const type = spec.type, col = new THREE.Color(spec.color || '#3a4a6a'), trim = new THREE.Color(spec.trim || spec.color || '#f2c21b');
  const parts = []; let glass = null, fab = 'twill', rough = 0.85, cover = 'cap';
  const seam = (y, phi, base, n = 6) => { const s = Math.abs(Math.sin(phi * n / 2)); return s < 0.05 ? base.clone().multiplyScalar(0.7) : base; };
  const camoAt = (y, phi) => { const n = fbm2(Math.sin(phi) * 3 + 10, y * 40 + Math.cos(phi) * 3, 3); return n > 0.58 ? new THREE.Color('#1c2216') : n > 0.46 ? new THREE.Color('#5a6238') : n > 0.36 ? new THREE.Color('#7b6a43') : new THREE.Color('#3a4426'); };
  if (type === 'cap') {
    parts.push(capGeometry(hs, { nr: 12, nc: 36, yBot: (phi) => 0.03 - 0.012 * smooth(90, 175, deg(phi)), off: 0.006, offFn: (y) => 0.008 * smooth(0.04, 0.1, y), colorFn: (y, phi, t) => seam(y, phi, col) }));
    parts.push(brim(hs, 0.042, 0.007, -1.2, 1.2, (phi) => 0.066 * Math.pow(Math.max(0, Math.cos(phi * 1.3)), 0.7), 0.02, trim.clone().lerp(col, 0.5)));
    parts.push(disc(hs, [0, CROWN + 0.0045, -0.002], 0.006, 0.004, trim)); rough = 0.8;
  } else if (type === 'visor') {
    parts.push(capGeometry(hs, { nr: 3, nc: 36, yBot: 0.03, yTop: 0.06, off: 0.0065, colorFn: () => col }));
    parts.push(capGeometry(hs, { nr: 1, nc: 36, yBot: 0.057, yTop: 0.063, off: 0.0075, colorFn: () => trim }));
    parts.push(brim(hs, 0.044, 0.007, -1.25, 1.25, (phi) => 0.078 * Math.pow(Math.max(0, Math.cos(phi * 1.25)), 0.6), 0.014, col)); cover = 'band';
  } else if (type === 'peaked') {
    parts.push(capGeometry(hs, { nr: 3, nc: 40, yBot: 0.028, yTop: 0.07, off: 0.008, colorFn: () => col.clone().multiplyScalar(0.6) }));
    parts.push(capGeometry(hs, { nr: 8, nc: 40, yBot: 0.068, yTop: CROWN - 0.003, off: 0.008, offFn: (y) => 0.034 * smooth(0.07, 0.097, y), colorFn: (y, phi, t) => (y < 0.072 ? trim : col) }));
    parts.push(brim(hs, 0.05, 0.01, -1.05, 1.05, (phi) => 0.052 * Math.pow(Math.max(0, Math.cos(phi * 1.4)), 0.6), 0.008, new THREE.Color(0x0d0d0f)));
    parts.push(disc(hs, [0, 0.062, 0.1 + 0.0], 0.011, 0.004, trim, 0)); rough = 0.6; fab = 'blazer';
  } else if (type === 'beret') {
    parts.push(capGeometry(hs, { nr: 10, nc: 36, yBot: 0.03, off: 0.006, offFn: (y, phi) => 0.045 * Math.sin(Math.min(1, (y - 0.03) / 0.085) * Math.PI * 0.85) * (0.8 + 0.2 * Math.cos(phi - 0.6)), colorFn: () => col }));
    parts.push(disc(hs, [0.012, CROWN + 0.004, -0.004], 0.004, 0.012, col)); fab = 'knit'; rough = 0.95;
  } else if (type === 'hardhat') {
    parts.push(capGeometry(hs, { nr: 9, nc: 40, yBot: 0.026, off: 0.012, offFn: (y, phi) => 0.004 * smooth(0.04, 0.1, y) + 0.007 * Math.exp(-Math.pow(Math.sin(phi) / 0.14, 2)) * smooth(0.03, 0.09, y), colorFn: () => col }));
    parts.push(brim(hs, 0.03, 0.012, -Math.PI, Math.PI, (phi) => 0.016 + 0.034 * Math.pow(Math.max(0, Math.cos(phi)), 2), 0.006, col, 36, 3)); fab = 'rubber'; rough = 0.35;
  } else if (type === 'helmet_mil') {
    const yb = (phi) => { const a = deg(phi); return 0.045 - 0.05 * smooth(35, 85, a) - 0.072 * smooth(115, 170, a); };
    parts.push(capGeometry(hs, { nr: 12, nc: 44, yBot: yb, off: 0.014, offFn: (y) => 0.005 * smooth(0.04, 0.11, y), colorFn: (y, phi) => camoAt(y, phi) }));
    parts.push(capGeometry(hs, { nr: 1, nc: 44, yBot: (phi) => yb(phi) - 0.004, yTop: (phi) => yb(phi) + 0.008, off: 0.017, colorFn: () => new THREE.Color(0x1b1d17) }));
    for (const s of [1, -1]) { parts.push(rod(hs, [s * 0.078, 0.002, 0.012], [s * 0.056, -0.09, 0.066], 0.0045, 0x2a2a24)); parts.push(rod(hs, [s * 0.056, -0.09, 0.066], [0, -0.128, 0.078], 0.0045, 0x2a2a24)); }
    fab = 'canvas'; rough = 0.8; cover = 'full';
  } else if (type === 'helmet_pilot') {
    const yb = (phi) => 0.052 - 0.065 * smooth(40, 85, deg(phi)) - 0.06 * smooth(110, 165, deg(phi));
    parts.push(capGeometry(hs, { nr: 12, nc: 44, yBot: yb, off: 0.016, offFn: (y) => 0.004 * smooth(0.04, 0.11, y), colorFn: (y, phi) => (Math.abs(Math.sin(phi)) < 0.1 && y > 0.05 ? trim : col) }));
    glass = capGeometry(hs, { nr: 7, nc: 24, yBot: -0.02, yTop: 0.062, phi0: -1.35, phi1: 1.35, off: 0.03, colorFn: () => new THREE.Color(0xffffff) });
    fab = 'plain'; rough = 0.22; cover = 'full';
  } else if (type === 'ushanka') {
    const fur = (y, phi) => { const n = 0.75 + 0.25 * noise2(phi * 6, y * 70); return col.clone().multiplyScalar(n); };
    parts.push(capGeometry(hs, { nr: 10, nc: 40, yBot: 0.035, off: 0.018, offFn: (y, phi) => 0.006 * noise2(phi * 8, y * 60), colorFn: fur }));
    parts.push(capGeometry(hs, { nr: 3, nc: 20, yBot: 0.03, yTop: 0.065, phi0: -1.25, phi1: 1.25, off: 0.026, colorFn: fur }));
    for (const s of [1, -1]) parts.push(capGeometry(hs, { nr: 6, nc: 10, yBot: -0.085, yTop: 0.04, phi0: s > 0 ? 0.9 : -2.3, phi1: s > 0 ? 2.3 : -0.9, off: 0.02, offFn: (y, phi) => 0.006 * noise2(phi * 8, y * 60), colorFn: fur }));
    fab = 'terry'; rough = 1; cover = 'full';
  } else return null;
  for (const g of parts) { if (!g.attributes.normal) g.computeVertexNormals(); applySkin(g, rigid(bi, 'head')); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  if (glass) { applySkin(glass, rigid(bi, 'head')); }
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
  return { geo: mergeAll(parts), glass, fab, rough, cover, type };
}
