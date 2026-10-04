// Procedural particle textures (pure-JS pixel generation -> THREE.DataTexture; no DOM needed, deterministic).
// Atlases are channel-packed:
//   smoke : R = density, G/B = tile-space normal xy (0.5 = flat)           4x4 tiles
//   fire  : R = temperature (1 = white-hot core, falls to 0 at the rim)      4x4 tiles
//   mist  : R = density, G = swirl detail, B = glow mask                     4x4 tiles
//   glow  : RGB = intensity of [soft glow | star flare | ring | streak]      2x2 tiles
//   flake : R = alpha of [soft disc | 3 irregular flakes]                    2x2 tiles
//   scorch: RGBA decal (dark burn with spray)                                single
import * as THREE from 'three';
import { RNG, Q, clamp } from '../engine/common.js';
import { noise2, fbm2, cached } from '../engine/proc.js';

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** compute a normal (nx,ny) from a height field tile and write it as G/B */
function writeTile(out, W, tx, ty, T, dens, height, nStrength, extraFn) {
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const ix = (j * T + i);
      const hL = height[j * T + Math.max(0, i - 1)], hR = height[j * T + Math.min(T - 1, i + 1)];
      const hD = height[Math.max(0, j - 1) * T + i], hU = height[Math.min(T - 1, j + 1) * T + i];
      let nx = (hL - hR) * nStrength, ny = (hD - hU) * nStrength; // +y is up in uv space (row 0 = bottom)
      ny = -ny;
      const l = Math.hypot(nx, ny, 1);
      nx /= l; ny /= l;
      const o = ((ty * T + j) * W + (tx * T + i)) * 4;
      const d = dens[ix];
      out[o] = clamp(d) * 255; out[o + 1] = (nx * 0.5 + 0.5) * 255; out[o + 2] = (ny * 0.5 + 0.5) * 255;
      out[o + 3] = extraFn ? extraFn(i, j, d) : 255;
    }
  }
}

/**
 * Cumulus-like puff: a cluster of overlapping soft lobes. Density = 1-exp(-sum of gaussians) (soft rim, lumpy interior);
 * the baked normal height is built from per-lobe domes so a fake light direction reveals cauliflower billows with dark creases.
 */
function billowField(T, seed, { blobs = 12, spread = 0.46, rmin = 0.17, rmax = 0.36, warp = 0.1, soft = 1.15, edge0 = 0.66, hollow = 0 } = {}) {
  const rng = new RNG(seed * 7919 + 31);
  const B = [];
  for (let k = 0; k < blobs; k++) {
    const a = rng.range(0, Math.PI * 2), d = (k < 2 ? 0.1 * k : Math.pow(rng.next(), 0.55)) * spread;
    B.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rng.range(rmin, rmax) * (1 - 0.25 * d / spread), w: rng.range(0.75, 1.2) });
  }
  const dens = new Float32Array(T * T), height = new Float32Array(T * T); const sOff = seed * 4.13;
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const u = (i + 0.5) / T * 2 - 1, v = (j + 0.5) / T * 2 - 1; const r = Math.hypot(u, v);
    const x = u + noise2(u * 1.7 + sOff, v * 1.7 + 1.3) * warp, y = v + noise2(u * 1.7 - 4.4, v * 1.7 + sOff + 7.7) * warp;
    let sum = 0, h = 0;
    for (let k = 0; k < B.length; k++) {
      const b = B[k]; const dx = (x - b.x) / b.r, dy = (y - b.y) / b.r; const q = dx * dx + dy * dy;
      sum += Math.exp(-q * 2.2) * b.w;
      if (q < 1) h += Math.sqrt(1 - q) * b.r * b.w * 1.1; // dome height of this lobe
    }
    const edge = 1 - sstep(edge0, 1.0, r);
    let d = clamp((1 - Math.exp(-sum * soft)) * edge);
    if (hollow) d *= 1 - hollow * Math.exp(-Math.pow(r / 0.3, 2));
    dens[j * T + i] = d;
    height[j * T + i] = h * edge * (0.35 + 0.65 * d);
  }
  // gentle blur so the baked normals are smooth at texel level
  const tmp = new Float32Array(T * T); const R = Math.max(1, Math.round(T / 64));
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { let a = 0, c = 0; for (let k = -R; k <= R; k++) { const ii = i + k; if (ii < 0 || ii >= T) continue; a += height[j * T + ii]; c++; } tmp[j * T + i] = a / c; }
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { let a = 0, c = 0; for (let k = -R; k <= R; k++) { const jj = j + k; if (jj < 0 || jj >= T) continue; a += tmp[jj * T + i]; c++; } height[j * T + i] = a / c; }
  }
  return { dens, height };
}

// ---- periodic (tileable) gradient noise for the detail texture
const hang = (ix, iy, seed) => { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 * 6.283185; };
function pnoise(x, y, P, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y); const fx = x - x0, fy = y - y0; const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const g = (ix, iy, dx, dy) => { const a = hang(((ix % P) + P) % P, ((iy % P) + P) % P, seed); return Math.cos(a) * dx + Math.sin(a) * dy; };
  const n00 = g(x0, y0, fx, fy), n10 = g(x0 + 1, y0, fx - 1, fy), n01 = g(x0, y0 + 1, fx, fy - 1), n11 = g(x0 + 1, y0 + 1, fx - 1, fy - 1);
  return (n00 + (n10 - n00) * u + (n01 + (n11 - n01) * u - (n00 + (n10 - n00) * u)) * v) * 1.4;
}
const pfbm = (x, y, P, oct, seed) => { let a = 0.5, s = 0, n = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * pnoise(x * f, y * f, P * f, seed + i * 7); n += a; a *= 0.52; f *= 2; } return clamp(s / n * 0.5 + 0.5); };

/** tileable detail noise (REPEAT): R = fbm, G = billow (cauliflower lobes), B = fine fbm, A = ridged wisps */
export function genNoiseTile(size) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    const f = pfbm(u * 4, v * 4, 4, 5, 1);
    let bil = 0, a = 0.55, fr = 3, nrm = 0; for (let o = 0; o < 4; o++) { bil += a * (1 - Math.abs(pnoise(u * fr, v * fr, fr, 40 + o * 5)) * 1.7); nrm += a; a *= 0.5; fr *= 2; } bil = clamp(bil / nrm);
    const fine = pfbm(u * 8, v * 8, 8, 4, 90);
    let rid = 0; a = 0.55; fr = 4; nrm = 0; for (let o = 0; o < 4; o++) { rid += a * Math.pow(1 - Math.abs(pnoise(u * fr, v * fr, fr, 120 + o * 3)) * 1.5, 2); nrm += a; a *= 0.5; fr *= 2; } rid = clamp(rid / nrm);
    const o4 = (j * size + i) * 4; data[o4] = f * 255; data[o4 + 1] = bil * 255; data[o4 + 2] = fine * 255; data[o4 + 3] = rid * 255;
  }
  return { data, w: size, h: size };
}

export function genSmokeAtlas(size) {
  const T = size / 4, data = new Uint8Array(size * size * 4);
  for (let n = 0; n < 16; n++) {
    const { dens, height } = billowField(T, n + 1, { blobs: 11 + (n % 5), spread: 0.54 + (n % 3) * 0.03, rmin: 0.19 + (n % 4) * 0.01, rmax: 0.4 + (n % 3) * 0.02, warp: 0.08 + (n % 4) * 0.025, edge0: 0.72 });
    // light smoothing of density gives soft interior, keep sharpish silhouette
    writeTile(data, size, n % 4, Math.floor(n / 4), T, dens, height, T / 30);
  }
  return { data, w: size, h: size };
}

export function genFireAtlas(size) {
  const T = size / 4, data = new Uint8Array(size * size * 4);
  for (let n = 0; n < 16; n++) {
    const { dens } = billowField(T, 100 + n, { blobs: 12 + (n % 4), spread: 0.48, rmin: 0.19, rmax: 0.4, warp: 0.12, soft: 1.3, edge0: 0.72 });
    const heat = new Float32Array(T * T);
    const rng = new RNG(900 + n);
    const ox = rng.range(0, 50), oy = rng.range(0, 50);
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const u = (i + 0.5) / T * 2 - 1, v = (j + 0.5) / T * 2 - 1;
      const r = Math.hypot(u, v * 0.95);
      const d = dens[j * T + i];
      // temperature: hot core + hot ridges of the billows, cool at the rim
      const core = Math.exp(-r * r * 3.0);
      const tongue = fbm2(u * 2.6 + ox, v * 2.6 + oy - 0.4, 4);
      let h = d * (0.45 + 0.9 * core) + (tongue - 0.5) * 0.35 * d;
      h = clamp(h * 1.05);
      heat[j * T + i] = h;
    }
    // write R = heat, G=B=0, A=255
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const o = ((Math.floor(n / 4) * T + j) * size + ((n % 4) * T + i)) * 4;
      data[o] = heat[j * T + i] * 255; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255;
    }
  }
  return { data, w: size, h: size };
}

export function genMistAtlas(size) {
  const T = size / 4, data = new Uint8Array(size * size * 4);
  for (let n = 0; n < 16; n++) {
    const sOff = n * 5.31;
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const u = (i + 0.5) / T * 2 - 1, v = (j + 0.5) / T * 2 - 1;
      // iterated swirl warp -> wispy tendrils
      let x = u, y = v;
      for (let k = 0; k < 3; k++) {
        const a = noise2(x * 1.8 + sOff + k * 3.1, y * 1.8 + k * 1.7) * 1.5;
        const b = noise2(x * 1.8 - k * 2.3, y * 1.8 + sOff + k * 4.9) * 1.5;
        x += Math.cos(a) * 0.16; y += Math.sin(b) * 0.16;
      }
      const f = fbm2(x * 2.4 + sOff, y * 2.4, 5);
      const f2 = fbm2(x * 5.2 - sOff, y * 5.2 + 3.3, 3);
      const r = Math.hypot(u, v);
      const mask = 1 - sstep(0.45, 0.97, r);
      let d = sstep(0.36, 0.86, f * 0.85 + f2 * 0.25) * mask;
      d = Math.min(1, d * 1.25);
      const glow = clamp(Math.pow(d, 0.7) * (0.55 + 0.7 * f2));
      const o = ((Math.floor(n / 4) * T + j) * size + ((n % 4) * T + i)) * 4;
      data[o] = d * 255; data[o + 1] = f2 * 255; data[o + 2] = glow * 255; data[o + 3] = 255;
    }
  }
  return { data, w: size, h: size };
}

export function genGlowAtlas(size) {
  const T = size / 2, data = new Uint8Array(size * size * 4);
  const put = (tx, ty, fn) => {
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const u = (i + 0.5) / T * 2 - 1, v = (j + 0.5) / T * 2 - 1;
      const val = clamp(fn(u, v, Math.hypot(u, v)));
      const o = ((ty * T + j) * size + (tx * T + i)) * 4; const b = val * 255;
      data[o] = b; data[o + 1] = b; data[o + 2] = b; data[o + 3] = 255;
    }
  };
  const edge = (r) => 1 - sstep(0.85, 1.0, r);
  // 0 soft glow: tight bright core + wide halo
  put(0, 0, (u, v, r) => (Math.exp(-r * r * 9) * 0.9 + Math.exp(-r * 3.2) * 0.22) * edge(r));
  // 1 star flare: 4 long spikes + 4 short diagonals + core
  put(1, 0, (u, v, r) => {
    const a = Math.atan2(v, u);
    const spike = Math.pow(Math.abs(Math.cos(a * 2)), 90) * Math.exp(-r * 2.2);
    const diag = Math.pow(Math.abs(Math.cos(a * 2 + Math.PI / 2)), 160) * Math.exp(-r * 4.5) * 0.45;
    const core = Math.exp(-r * r * 22) + Math.exp(-r * 6) * 0.15;
    return (spike * 0.9 + diag + core) * edge(r);
  });
  // 2 ring: thin bright ring at r~0.78 with faint inner fill
  put(0, 1, (u, v, r) => (Math.exp(-Math.pow((r - 0.78) / 0.06, 2)) * 0.95 + Math.exp(-Math.pow((r - 0.74) / 0.2, 2)) * 0.12) * edge(r));
  // 3 anamorphic streak: horizontal thin line
  put(1, 1, (u, v, r) => (Math.exp(-Math.pow(v / 0.05, 2)) * Math.exp(-Math.abs(u) * 1.7) * 0.9 + Math.exp(-r * r * 30) * 0.5) * (1 - sstep(0.8, 1.0, Math.abs(u))) * (1 - sstep(0.7, 1.0, Math.abs(v))));
  return { data, w: size, h: size };
}

export function genFlakeAtlas(size) {
  const T = size / 2, data = new Uint8Array(size * size * 4);
  for (let n = 0; n < 4; n++) {
    const tx = n % 2, ty = Math.floor(n / 2); const rng = new RNG(40 + n);
    const lobes = 5 + n, ph = rng.range(0, 6.28), amp = 0.28 + n * 0.04;
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const u = (i + 0.5) / T * 2 - 1, v = (j + 0.5) / T * 2 - 1; const r = Math.hypot(u, v);
      let a;
      if (n === 0) a = 1 - sstep(0.35, 0.95, r);
      else {
        const th = Math.atan2(v, u);
        const rad = 0.55 + amp * Math.sin(th * lobes + ph) * 0.5 + 0.18 * noise2(Math.cos(th) * 1.5 + n, Math.sin(th) * 1.5);
        a = 1 - sstep(rad - 0.12, rad + 0.04, r * (1 + 0.25 * Math.abs(u) * (n - 1) * 0.5));
      }
      const o = ((ty * T + j) * size + (tx * T + i)) * 4; const b = clamp(a) * 255;
      data[o] = b; data[o + 1] = b; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return { data, w: size, h: size };
}

export function genScorch(size) {
  const data = new Uint8Array(size * size * 4); const rng = new RNG(77);
  const spots = []; for (let i = 0; i < 160; i++) { const a = rng.range(0, 6.283), d = Math.sqrt(rng.range(0.15, 1)) * 0.95; spots.push([Math.cos(a) * d, Math.sin(a) * d, rng.range(0.006, 0.03), rng.range(0.4, 1)]); }
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = (i + 0.5) / size * 2 - 1, v = (j + 0.5) / size * 2 - 1; const r = Math.hypot(u, v), th = Math.atan2(v, u);
    const lobes = fbm2(Math.cos(th) * 1.7 + 3, Math.sin(th) * 1.7 + 5, 3);
    const rim = 0.46 + 0.34 * (lobes - 0.5) * 2 + 0.07 * noise2(th * 9, 1.7);
    const base = 1 - sstep(rim - 0.22, rim + 0.1, r);
    const detail = fbm2(u * 7 + 11, v * 7 - 4, 4);
    let a = base * (0.62 + 0.45 * detail);
    // sprayed soot spots outside the crater
    for (let k = 0; k < spots.length; k++) { const s = spots[k]; const d = Math.hypot(u - s[0], v - s[1]); if (d < s[2] * 2.2) a = Math.max(a, (1 - d / (s[2] * 2.2)) * s[3] * 0.8); }
    a *= 1 - sstep(0.8, 1.0, r);
    const o = (j * size + i) * 4;
    const warm = clamp(base * 0.5 - 0.1 + (1 - detail) * 0.2);
    data[o] = 14 + warm * 40; data[o + 1] = 11 + warm * 22; data[o + 2] = 9 + warm * 10; data[o + 3] = clamp(a * 1.1) * 255;
  }
  return { data, w: size, h: size };
}

function toTex({ data, w, h }, { mip = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.generateMipmaps = mip; t.anisotropy = 1; t.flipY = false; t.needsUpdate = true;
  return t;
}

const atlasSize = (cap = 512) => Math.max(128, Math.min(cap, Q.texSize));

export const smokeAtlas = () => cached('fx.smoke.' + atlasSize(512), () => toTex(genSmokeAtlas(atlasSize(512))));
export const fireAtlas = () => cached('fx.fire.' + atlasSize(512), () => toTex(genFireAtlas(atlasSize(512))));
export const mistAtlas = () => cached('fx.mist.' + atlasSize(512), () => toTex(genMistAtlas(atlasSize(512))));
export const glowAtlas = () => cached('fx.glow.' + atlasSize(256), () => toTex(genGlowAtlas(atlasSize(256))));
export const noiseTexture = () => cached('fx.noise.' + Math.min(128, atlasSize(128)), () => { const t = toTex(genNoiseTile(Math.min(128, atlasSize(128)))); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; });
export const flakeAtlas = () => cached('fx.flake', () => toTex(genFlakeAtlas(128)));
export const scorchTexture = () => cached('fx.scorch', () => toTex(genScorch(Math.min(256, atlasSize(256)))));
