// Procedural texture toolkit: noise, canvas painting helpers, height->normal conversion.
// Everything is deterministic (seeded) so textures are identical across runs.
import * as THREE from 'three';
import { RNG, Q } from './common.js';

// ---------- value / gradient noise (seeded) ----------
const PERM = new Uint8Array(512);
(function initPerm() { const r = new RNG(1337); const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; })();
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad2 = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
/** 2D gradient noise, returns ~[-1,1] */
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = PERM[X] + Y, b = PERM[X + 1] + Y;
  const l1 = grad2(PERM[a], x, y) * (1 - u) + grad2(PERM[b], x - 1, y) * u;
  const l2 = grad2(PERM[a + 1], x, y - 1) * (1 - u) + grad2(PERM[b + 1], x - 1, y - 1) * u;
  return (l1 * (1 - v) + l2 * v) * 0.7;
}
const grad3 = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); };
/** 3D gradient noise, returns ~[-1,1] */
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z, B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(grad3(PERM[AA], x, y, z), grad3(PERM[BA], x - 1, y, z), u), L(grad3(PERM[AB], x, y - 1, z), grad3(PERM[BB], x - 1, y - 1, z), u), v),
    L(L(grad3(PERM[AA + 1], x, y, z - 1), grad3(PERM[BA + 1], x - 1, y, z - 1), u), L(grad3(PERM[AB + 1], x, y - 1, z - 1), grad3(PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w) * 0.9;
}
/** fractal brownian motion, returns ~[0,1] */
export function fbm2(x, y, oct = 4, lac = 2, gain = 0.5) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= gain; f *= lac; } return s / n * 0.5 + 0.5; }
export function fbm3(x, y, z, oct = 4, lac = 2, gain = 0.5) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= gain; f *= lac; } return s / n * 0.5 + 0.5; }
/** ridged noise (cracks / veins). returns [0,1], 1 on ridges */
export function ridged2(x, y, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise2(x * f, y * f)) * 1.4); n += a; a *= 0.5; f *= 2; } return Math.max(0, Math.min(1, s / n)); }
/** cellular (worley) noise: returns {d1,d2,id}; scale in cells */
export function voronoi2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j; let h = (cx * 374761393 + cy * 668265263 + seed * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; const rx = ((h & 0xffff) / 65535), ry = (((h >>> 16) & 0xffff) / 65535);
    const dx = cx + rx - x, dy = cy + ry - y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < d1) { d2 = d1; d1 = d; id = (h >>> 8) & 0xff; } else if (d < d2) d2 = d;
  }
  return { d1, d2, id: id / 255 };
}

// ---------- canvas helpers ----------
export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
/** Create a CanvasTexture by running draw(ctx,w,h). opts: {repeat:[x,y], srgb=true, aniso=4, wrap='repeat'|'clamp', mip=true} */
export function canvasTex(w, h, draw, opts = {}) {
  const c = makeCanvas(w, h); const ctx = c.getContext('2d'); draw(ctx, w, h, c);
  return texFromCanvas(c, opts);
}
export function texFromCanvas(c, { repeat = [1, 1], srgb = true, aniso = 4, wrap = 'repeat', mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap === 'clamp' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]); t.anisotropy = aniso; t.generateMipmaps = mip; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.needsUpdate = true; return t;
}
const hex2rgb = (c) => { const col = new THREE.Color(c); return [col.r * 255, col.g * 255, col.b * 255]; };
/**
 * Paint fbm noise into a canvas between two colours. Fast pixel loop.
 * opts: {scale=4 (cells across), oct=4, a:'#000', b:'#fff', contrast=1, seed=0, tile=true, mode:'fbm'|'ridged'|'cells'}
 */
export function paintNoise(ctx, w, h, { scale = 4, oct = 4, a = '#000', b = '#fff', contrast = 1, seed = 0, mode = 'fbm', alpha = 1, blend = false } = {}) {
  const img = blend ? ctx.getImageData(0, 0, w, h) : ctx.createImageData(w, h); const d = img.data; const A = hex2rgb(a), B = hex2rgb(b); const o = seed * 17.37;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w * scale, v = y / h * scale; let n;
    // tileable by blending 4 corners
    if (mode === 'ridged') n = ridged2(u + o, v + o, oct); else if (mode === 'cells') { const c = voronoi2(u + o, v + o, seed); n = Math.min(1, c.d1 * 1.2); } else n = fbm2(u + o, v + o, oct);
    n = Math.max(0, Math.min(1, (n - 0.5) * contrast + 0.5)); const i = (y * w + x) * 4;
    if (blend) { const k = n * alpha; d[i] = d[i] * (1 - k) + B[0] * k; d[i + 1] = d[i + 1] * (1 - k) + B[1] * k; d[i + 2] = d[i + 2] * (1 - k) + B[2] * k; }
    else { d[i] = A[0] + (B[0] - A[0]) * n; d[i + 1] = A[1] + (B[1] - A[1]) * n; d[i + 2] = A[2] + (B[2] - A[2]) * n; d[i + 3] = 255 * alpha; }
  }
  ctx.putImageData(img, 0, 0);
}
/** Sprinkle speckles / dirt / grain on top of a canvas. */
export function speckle(ctx, w, h, { count = 2000, size = [0.5, 2], colors = ['#000'], alpha = [0.1, 0.4], seed = 1 } = {}) {
  const r = new RNG(seed); ctx.save();
  for (let i = 0; i < count; i++) { ctx.globalAlpha = r.range(alpha[0], alpha[1]); ctx.fillStyle = r.pick(colors); const s = r.range(size[0], size[1]); ctx.fillRect(r.range(0, w), r.range(0, h), s, s); }
  ctx.restore();
}
/** Convert a greyscale height canvas to a tangent-space normal map canvas. strength ~ 1..8 */
export function heightToNormalCanvas(src, strength = 3) {
  const w = src.width, h = src.height; const sctx = src.getContext('2d'); const sd = sctx.getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h); const octx = out.getContext('2d'); const od = octx.createImageData(w, h); const o = od.data;
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4; o[i] = (-dx / l * 0.5 + 0.5) * 255; o[i + 1] = (dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  octx.putImageData(od, 0, 0); return out;
}
/** Build a normal-map texture from a draw-height function (white = high). */
export function normalTex(w, h, drawHeight, { strength = 3, repeat = [1, 1] } = {}) {
  const c = makeCanvas(w, h); drawHeight(c.getContext('2d'), w, h); return texFromCanvas(heightToNormalCanvas(c, strength), { repeat, srgb: false });
}
/** Greyscale roughness/metalness style canvas texture from a draw function. */
export function dataTex(w, h, draw, opts = {}) { return canvasTex(w, h, draw, { ...opts, srgb: false }); }
/** Text -> canvas texture (signs, screens, chyrons). */
export function textTex(text, { w = 512, h = 128, font = 'bold 72px sans-serif', color = '#fff', bg = null, align = 'center', pad = 8, stroke = null } = {}) {
  return canvasTex(w, h, (ctx) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = align;
    const x = align === 'center' ? w / 2 : align === 'left' ? pad : w - pad;
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 6; ctx.strokeText(text, x, h / 2); }
    ctx.fillText(text, x, h / 2);
  }, { repeat: [1, 1], wrap: 'clamp', aniso: 4 });
}
/** Resolution helper: pick power-of-two <= Q.texSize */
export const texRes = (preferred = 512) => Math.min(preferred, Q.texSize);

/** Tiny memo cache so modules share textures/materials (key -> value). */
const _cache = new Map();
export function cached(key, make) { if (!_cache.has(key)) { const v = make(); if (v && v.userData) v.userData.shared = true; _cache.set(key, v); } return _cache.get(key); }
