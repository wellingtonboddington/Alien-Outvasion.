// Fabric textures (greyscale albedo detail + derived normal maps, shared via cached()) and cloth material factory for the human module.
// Materials get the per-human FX patch (blood / dirt / infection / frost) through skin.js patchMaterial.
import * as THREE from 'three';
import { makeCanvas, texFromCanvas, heightToNormalCanvas, texRes, cached, noise2, fbm2 } from '../../engine/proc.js';
import { patchMaterial } from './skin.js';

const hsh = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
const TAU = Math.PI * 2;
const wv = (x, y, p) => { const i = Math.floor(x / p), j = Math.floor(y / p), fx = (x % p) / p, fy = (y % p) / p; const pr = ((i + j) & 1) ? Math.sin(Math.PI * fx) : Math.sin(Math.PI * fy); return 0.74 + 0.22 * pr + (hsh(i, j) - 0.5) * 0.07; };
const twl = (x, y, p, a = 0.2) => 0.76 + a * (0.5 + 0.5 * Math.sin(TAU * (x + y) / p)) + (hsh(x >> 1, y >> 2) - 0.5) * 0.05;

// kind: { tile (m per texture repeat), nrm (normal strength), rough, sheen?, fn(x,y,S) -> 0..1 }
const FAB = {
  weave: { tile: 0.05, nrm: 2.4, rough: 0.86, fn: (x, y) => wv(x, y, 4) },
  twill: { tile: 0.05, nrm: 2.0, rough: 0.8, fn: (x, y) => twl(x, y, 8) },
  scrubs: { tile: 0.05, nrm: 1.4, rough: 0.74, fn: (x, y) => twl(x, y, 4, 0.12) },
  labcoat: { tile: 0.06, nrm: 1.8, rough: 0.82, fn: (x, y) => twl(x, y, 8, 0.14) + (((y >> 4) % 6 === 0) ? -0.03 : 0) },
  denim: { tile: 0.055, nrm: 2.8, rough: 0.92, fn: (x, y, S) => { const d = 0.5 + 0.5 * Math.sin(TAU * (x + y) / 4); const warp = 0.55 + 0.45 * hsh(x, 3); const streak = 0.9 + 0.1 * Math.sin(TAU * x / 64 + hsh(x >> 3, 9) * 6); return Math.min(1, (0.5 + 0.3 * d * warp + (hsh(x, y >> 1) > 0.93 ? 0.2 : 0)) * streak * 1.18); } },
  knit: { tile: 0.07, nrm: 3.2, rough: 0.97, sheen: 0.6, fn: (x, y) => { const c = Math.sin(TAU * x / 8), r = ((y + (x >> 3) * 4) % 8) / 8; return 0.66 + 0.2 * (0.5 + 0.5 * c) * (0.6 + 0.4 * Math.sin(Math.PI * r)) + (hsh(x >> 1, y >> 1) - 0.5) * 0.08; } },
  pique: { tile: 0.05, nrm: 2.6, rough: 0.88, fn: (x, y) => { const dx = Math.abs(((x % 8) - 4)), dy = Math.abs(((y % 8) - 4)); return 0.7 + 0.26 * Math.max(0, 1 - (dx + dy) / 6) + (hsh(x >> 1, y >> 1) - 0.5) * 0.05; } },
  tech: { tile: 0.06, nrm: 1.0, rough: 0.52, fn: (x, y) => { const hx = (x % 12) - 6, hy = ((y + ((x / 12 | 0) & 1) * 6) % 12) - 6; return 0.8 + 0.1 * Math.max(0, 1 - Math.hypot(hx, hy) / 4) + (hsh(x, y) - 0.5) * 0.04; } },
  canvas: { tile: 0.06, nrm: 3.0, rough: 0.92, fn: (x, y) => wv(x, y, 4) * 0.9 + 0.1 * (0.5 + 0.5 * Math.sin(TAU * y / 32 + noise2(x * 0.05, y * 0.4) * 4)) },
  terry: { tile: 0.04, nrm: 3.5, rough: 1.0, fn: (x, y) => 0.55 + 0.45 * hsh(x >> 1, y >> 1) * (0.6 + 0.4 * hsh(x, y)) },
  blazer: { tile: 0.06, nrm: 1.2, rough: 0.78, fn: (x, y) => twl(x, y, 4, 0.12) - (x % 32 === 0 || x % 32 === 1 ? 0.08 : 0) },
  leather: { tile: 0.12, nrm: 2.2, rough: 0.5, size: 128, fn: (x, y, S) => { const cx = x * 0.16, cy = y * 0.16; const ix = Math.floor(cx), iy = Math.floor(cy); let d1 = 9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const px = ix + a + hsh(((ix + a) % 20 + 20) % 20, ((iy + b) % 20 + 20) % 20) * 0.9, py = iy + b + hsh(((iy + b) % 20 + 20) % 20 + 5, ((ix + a) % 20 + 20) % 20) * 0.9; d1 = Math.min(d1, Math.hypot(cx - px, cy - py)); } return 0.72 + 0.25 * Math.min(1, d1 * 1.5) + (hsh(x, y) - 0.5) * 0.03; } },
  rubber: { tile: 0.1, nrm: 0.5, rough: 0.62, fn: (x, y) => 0.88 + (hsh(x >> 1, y >> 1) - 0.5) * 0.08 },
  plain: { tile: 0.2, nrm: 0.0, rough: 0.7, fn: () => 1 },
};

/** shared {map, normalMap, tile, rough, sheen} for a fabric kind */
export function fabricSet(kind) {
  const def = FAB[kind] || FAB.weave;
  return cached('wear.fab.' + kind + '.' + texRes(256), () => {
    const S = Math.min(def.size || 256, texRes(256) >= 256 ? 256 : texRes(256));
    const c = makeCanvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = Math.max(0, Math.min(1, def.fn(x, y, S))) * 255, i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    const map = texFromCanvas(c, { aniso: 4 });
    const normalMap = def.nrm > 0 ? texFromCanvas(heightToNormalCanvas(c, def.nrm), { srgb: false, aniso: 4 }) : null;
    map.userData.shared = true; if (normalMap) normalMap.userData.shared = true;
    const o = { map, normalMap, tile: def.tile, rough: def.rough, sheen: def.sheen || 0, userData: { shared: true } };
    return o;
  });
}

/** camouflage albedo (RGB), tileable by 4-corner blending. kind 'woodland'|'desert'|'urban' */
export function camoTex(kind = 'woodland') {
  return cached('wear.camo.' + kind, () => {
    const pal = { woodland: ['#2f3a22', '#55603a', '#7b6a43', '#1b1e14'], desert: ['#c2a878', '#a68a5b', '#7d6a45', '#d8c9a2'], urban: ['#555a60', '#3c4046', '#7a7f85', '#23262a'] }[kind] || [];
    const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
    const cols = pal.map((h) => new THREE.Color(h));
    const n = (x, y) => fbm2(x / S * 3.2 + 40, y / S * 3.2 + 40, 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = x / S, fy = y / S;
      const v = n(x, y) * (1 - fx) * (1 - fy) + n(x - S, y) * fx * (1 - fy) + n(x, y - S) * (1 - fx) * fy + n(x - S, y - S) * fx * fy;
      const w = n(x + 99, y + 71);
      const col = v > 0.56 ? cols[3] : v > 0.47 ? cols[2] : w > 0.5 ? cols[1] : cols[0];
      const i = (y * S + x) * 4, g = 0.9 + 0.1 * hsh(x, y);
      d[i] = col.r * 255 * g; d[i + 1] = col.g * 255 * g; d[i + 2] = col.b * 255 * g; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = texFromCanvas(c, { aniso: 4 }); return t;
  });
}

/** small decal textures: 'burger' logo patch, 'cross' (medical), 'badge', 'name' (text), 'stripe' */
export function decalTex(kind, text = '', c1 = '#f2c21b', c2 = '#c8202a') {
  return cached(`wear.decal.${kind}.${text}.${c1}.${c2}`, () => {
    const W = 128, H = 128, c = makeCanvas(W, H), x = c.getContext('2d');
    x.clearRect(0, 0, W, H);
    if (kind === 'burger') {
      x.fillStyle = c1; x.beginPath(); x.arc(64, 64, 60, 0, TAU); x.fill();
      x.strokeStyle = c2; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 54, 0, TAU); x.stroke();
      x.fillStyle = c2; x.beginPath(); x.ellipse(64, 46, 34, 20, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#3a2a1a'; x.fillRect(30, 50, 68, 10); x.fillStyle = '#6fbf3a'; x.fillRect(32, 60, 64, 5);
      x.fillStyle = c2; x.beginPath(); x.ellipse(64, 72, 34, 12, 0, 0, Math.PI); x.fill();
      x.fillStyle = c2; x.font = 'bold 20px sans-serif'; x.textAlign = 'center'; x.fillText(text || 'BURGIE', 64, 108);
    } else if (kind === 'cross') {
      x.fillStyle = c1; x.beginPath(); x.arc(64, 64, 58, 0, TAU); x.fill(); x.fillStyle = c2;
      x.fillRect(54, 22, 20, 84); x.fillRect(22, 54, 84, 20);
    } else if (kind === 'badge') {
      x.fillStyle = c1; x.beginPath(); x.moveTo(64, 4); x.lineTo(118, 30); x.lineTo(110, 92); x.lineTo(64, 124); x.lineTo(18, 92); x.lineTo(10, 30); x.closePath(); x.fill();
      x.strokeStyle = c2; x.lineWidth = 6; x.stroke(); x.fillStyle = c2; x.beginPath(); x.arc(64, 62, 22, 0, TAU); x.fill();
    } else if (kind === 'name') {
      x.fillStyle = c1; x.fillRect(0, 36, W, 56); x.strokeStyle = c2; x.lineWidth = 4; x.strokeRect(2, 38, W - 4, 52);
      x.fillStyle = c2; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 64);
    } else if (kind === 'flag') {
      x.fillStyle = '#1d4fa8'; x.fillRect(0, 20, W, 44); x.fillStyle = '#c8202a'; x.fillRect(0, 64, W, 44);
      x.fillStyle = '#f5f5f5'; x.beginPath(); x.moveTo(0, 20); x.lineTo(70, 64); x.lineTo(0, 108); x.closePath(); x.fill();
    }
    return texFromCanvas(c, { wrap: 'clamp', aniso: 4 });
  });
}

/**
 * Cloth material: fabric kind + colour. o: {rough, vertexColors, double, nrmScale, metal, emissive, emissiveIntensity, tag, map (override), alphaTest}
 * All pieces share textures; only the Material object is per human (FX uniforms).
 */
export function clothMat(kind, color, fx, o = {}) {
  const f = fabricSet(kind);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), map: o.map === undefined ? f.map : o.map, normalMap: f.normalMap, roughness: o.rough ?? f.rough, metalness: o.metal ?? 0,
    vertexColors: !!o.vertexColors, side: o.double ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: 0.6,
  });
  if (m.normalMap) m.normalScale.set(o.nrmScale ?? 0.7, o.nrmScale ?? 0.7);
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 2; }
  if (o.alphaTest) { m.alphaTest = o.alphaTest; }
  m.name = 'cloth_' + kind;
  m.userData.tile = f.tile;
  return patchMaterial(m, fx, { tag: 'cl' + kind });
}
