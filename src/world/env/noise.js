// Tileable (periodic) noise generators + packed RGBA noise textures used by the sky / ocean / terrain shaders.
import * as THREE from 'three';
import { RNG, Q } from '../../engine/common.js';
import { cached } from '../../engine/proc.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Periodic gradient-noise lattice. Returns fn(x,y) -> [-1,1] that tiles with period `cells` in both axes. */
export function periodicNoise(cells, seed = 1) {
  const r = new RNG(seed * 7919 + cells);
  const n = cells * cells; const gx = new Float32Array(n), gy = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = r.range(0, Math.PI * 2); gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const wrap = (i) => ((i % cells) + cells) % cells;
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y); const fx = x - x0, fy = y - y0;
    const i0 = wrap(x0), i1 = wrap(x0 + 1), j0 = wrap(y0), j1 = wrap(y0 + 1);
    const d = (i, j, dx, dy) => { const k = j * cells + i; return gx[k] * dx + gy[k] * dy; };
    const u = fade(fx), v = fade(fy);
    const a = d(i0, j0, fx, fy), b = d(i1, j0, fx - 1, fy), c = d(i0, j1, fx, fy - 1), e = d(i1, j1, fx - 1, fy - 1);
    return (a + (b - a) * u + (c + (e - c) * u - a - (b - a) * u) * v) * 1.4;
  };
}

/** Tileable fbm field: Float32Array size*size normalised to ~[0,1]. */
export function tileFbm(size, baseCells, oct, seed, gain = 0.5, ridged = false) {
  const out = new Float32Array(size * size);
  const fns = []; for (let o = 0; o < oct; o++) fns.push(periodicNoise(baseCells * (1 << o), seed + o * 31));
  let norm = 0; { let a = 1; for (let o = 0; o < oct; o++) { norm += a; a *= gain; } }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let s = 0, a = 1;
    for (let o = 0; o < oct; o++) {
      const f = baseCells * (1 << o) / size; let v = fns[o](x * f, y * f);
      if (ridged) v = 1 - Math.abs(v) * 1.6 - 0.35; s += v * a; a *= gain;
    }
    out[y * size + x] = Math.max(0, Math.min(1, (s / norm) * 0.5 + 0.5));
  }
  return out;
}

function makeRGBA(size, w, h, fill) {
  const data = new Uint8Array(size * size * 4); fill(data);
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t;
}

/**
 * Cloud/noise tile: RGBA = four independent tileable fbm fields (soft cumulus-like, contrast boosted).
 * Shared by sky (clouds, milky way), terrain (detail layers use their own tile).
 */
export function skyNoiseTex() {
  return cached('env:skyNoise', () => {
    const size = Q.level === 0 ? 128 : 256;
    const ch = [0, 1, 2, 3].map((i) => tileFbm(size, 4 + i, 5, 11 + i * 17, 0.52));
    // contrast-stretch each channel around its mean so thresholds behave consistently
    for (const c of ch) { let mn = 1, mx = 0; for (let i = 0; i < c.length; i++) { mn = Math.min(mn, c[i]); mx = Math.max(mx, c[i]); } const k = 1 / (mx - mn); for (let i = 0; i < c.length; i++) c[i] = (c[i] - mn) * k; }
    const t = makeRGBA(size, size, size, (d) => { for (let i = 0; i < size * size; i++) for (let k = 0; k < 4; k++) d[i * 4 + k] = Math.round(ch[k][i] * 255); });
    return t;
  });
}

/** Ocean tile: RGB = tangent-space normal of a choppy wave-height field, A = lacy foam pattern. */
export function oceanTileTex() {
  return cached('env:oceanTile', () => {
    const size = Q.level === 0 ? 128 : 256;
    const base = tileFbm(size, 6, 5, 77, 0.55, true);          // ridged = sharp crests
    const fine = tileFbm(size, 16, 3, 91, 0.5);
    const h = new Float32Array(size * size); for (let i = 0; i < h.length; i++) h[i] = base[i] * 0.8 + fine[i] * 0.2;
    // foam lace: voronoi-ish via thresholded high-frequency ridged noise
    const lace = tileFbm(size, 10, 4, 123, 0.6, true); const lace2 = tileFbm(size, 22, 3, 321, 0.5, true);
    const t = makeRGBA(size, size, size, (d) => {
      const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * 5, dy = (H(x, y + 1) - H(x, y - 1)) * 5; const l = Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
        d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
        const f = Math.max(0, Math.min(1, (lace[y * size + x] * 0.65 + lace2[y * size + x] * 0.35 - 0.52) * 3.2)); d[i + 3] = f * 255;
      }
    });
    return t;
  });
}

/** Terrain detail tile: R sand grain / ripples, G grass mottling, B rock strata/cracks, A macro variation (low freq). */
export function terrainDetailTex() {
  return cached('env:terrainDetail', () => {
    const size = Q.level === 0 ? 128 : 256;
    const sand = tileFbm(size, 28, 3, 5, 0.5), rip = tileFbm(size, 8, 2, 6, 0.5);
    const grass = tileFbm(size, 22, 4, 7, 0.55), grass2 = tileFbm(size, 52, 2, 8, 0.5);
    const rock = tileFbm(size, 12, 5, 9, 0.55, true), rock2 = tileFbm(size, 30, 3, 10, 0.5);
    const macro = tileFbm(size, 9, 3, 12, 0.5);
    const ch = [new Float32Array(size * size), new Float32Array(size * size), new Float32Array(size * size), macro];
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const rv = 0.5 + 0.5 * Math.sin((x / size * 14 + rip[i] * 5) * Math.PI * 2 * 0.5); // sand ripples: stripes bent by noise
      ch[0][i] = Math.min(1, sand[i] * 0.7 + rv * 0.3); ch[1][i] = grass[i] * 0.65 + grass2[i] * 0.35; ch[2][i] = rock[i] * 0.7 + rock2[i] * 0.3;
    }
    for (const c of ch) { let mn = 1, mx = 0, sm = 0; for (let i = 0; i < c.length; i++) { mn = Math.min(mn, c[i]); mx = Math.max(mx, c[i]); } const k = 1 / (mx - mn); for (let i = 0; i < c.length; i++) c[i] = (c[i] - mn) * k; }
    return makeRGBA(size, size, size, (d) => { for (let i = 0; i < size * size; i++) for (let k = 0; k < 4; k++) d[i * 4 + k] = Math.round(ch[k][i] * 255); });
  });
}
