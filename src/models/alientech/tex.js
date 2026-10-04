// Procedural, tileable textures for the Vessari machines: bone-tan shell, wet slate-blue flesh, ship hull plating, window lights.
// Everything is computed from one height field per material (albedo + normal + roughness in one pass). Deterministic.
import { makeCanvas, texFromCanvas, texRes, cached } from '../../engine/proc.js';

// ---------- periodic noise (so textures tile without seams) ----------
function hash(ix, iy, s) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, per, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const xa = ((x0 % per) + per) % per, xb = (xa + 1) % per, ya = ((y0 % per) + per) % per, yb = (ya + 1) % per;
  const a = hash(xa, ya, s), b = hash(xb, ya, s), c = hash(xa, yb, s), d = hash(xb, yb, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbmP(x, y, per, oct, s = 0) {
  let a = 0.5, f = 1, sum = 0, n = 0;
  for (let o = 0; o < oct; o++) { sum += a * vnoise(x * f, y * f, per * f, s + o * 7); n += a; a *= 0.5; f *= 2; }
  return sum / n;
}
const _v = { d1: 0, d2: 0, id: 0 };
function vor(x, y, per, s, out = _v) {
  const xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = xi + i, gy = yi + j; const wx = ((gx % per) + per) % per, wy = ((gy % per) + per) % per;
    const h = hash(wx, wy, s), h2 = hash(wx + 101, wy + 57, s);
    const dx = gx + 0.12 + 0.76 * h - x, dy = gy + 0.12 + 0.76 * h2 - y; const d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
  }
  out.d1 = Math.sqrt(d1); out.d2 = Math.sqrt(d2); out.id = id; return out;
}
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function packTex(N, rgba, srgb, name) {
  const c = makeCanvas(N, N); const ctx = c.getContext('2d'); const id = ctx.createImageData(N, N); id.data.set(rgba); ctx.putImageData(id, 0, 0);
  const t = texFromCanvas(c, { srgb, aniso: 8 }); t.userData.shared = true; t.name = name; return t;
}
/** periodic height -> tangent-space normal (RGBA bytes) */
function normalFrom(h, N, strength) {
  const o = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xm = (x - 1 + N) % N, xp = (x + 1) % N, ym = (y - 1 + N) % N, yp = (y + 1) % N;
    const dx = (h[y * N + xp] - h[y * N + xm]) * strength, dy = (h[yp * N + x] - h[ym * N + x]) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    o[i] = (-dx / l * 0.5 + 0.5) * 255; o[i + 1] = (-dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  return o;
}

/** Bone-tan glossy chitin: soft mottling, subtle scute seams, hairline cracks, fine pits. map (sRGB), normal, orm (G = roughness, B = metalness). */
export function shellTextures() {
  const N = texRes(512);
  return cached('alientech:shell' + N, () => {
    const col = new Uint8ClampedArray(N * N * 4), orm = new Uint8ClampedArray(N * N * 4), hgt = new Float32Array(N * N);
    const v = { d1: 0, d2: 0, id: 0 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, w = y / N;
      const wx = u * 4 + (fbmP(u * 5, w * 5, 5, 3, 3) - 0.5) * 0.7, wy = w * 4 + (fbmP(u * 5, w * 5, 5, 3, 9) - 0.5) * 0.7;
      vor(wx, wy, 4, 5, v);
      const edge = v.d2 - v.d1;                                  // ~0 at plate borders
      const seam = 1 - sstep(0.0, 0.04, edge);
      const dome = sstep(0.0, 0.6, edge);
      const rim = sstep(0.0, 0.2, edge);
      const grow = Math.sin(v.d1 * 38 + v.id * 31) * 0.5 + 0.5;
      // long hairline cracks
      const cw = fbmP(u * 6 + 3, w * 6 + 3, 6, 3, 21);
      const crk = 1 - Math.abs(fbmP(u * 9 + cw * 2.2, w * 9 + cw * 2.2, 9, 2, 31) * 2 - 1);
      const crack = sstep(0.972, 0.995, crk) * (v.id > 0.5 ? 1 : 0.0);
      const stain = fbmP(u * 3, w * 3, 3, 4, 51);
      const warm = fbmP(u * 7, w * 7, 7, 3, 57);
      const grain = fbmP(u * 110, w * 110, 110, 2, 61);
      const pit = sstep(0.8, 0.93, fbmP(u * 44, w * 44, 44, 2, 71));
      // ivory (#d6c79c) <-> bone-tan (#b89a62) <-> amber-brown mottling, per-plate id tint, darker patina at seams
      const k = Math.min(1, Math.max(0, stain * 1.15 + (v.id - 0.5) * 0.4 + (warm - 0.5) * 0.45 - 0.08));
      let r = mix(0.80, 0.56, k), g = mix(0.70, 0.42, k), b = mix(0.52, 0.24, k);
      const sh = 0.86 + 0.18 * dome + 0.05 * (1 - grow) * rim + (grain - 0.5) * 0.07;
      r *= sh; g *= sh; b *= sh;
      const rust = sstep(0.6, 0.9, warm) * 0.38; g = mix(g, g * 0.8, rust); b = mix(b, b * 0.6, rust);
      const patina = (1 - rim) * 0.55;                                          // grime collects near plate borders
      r = mix(r, r * 0.55, patina); g = mix(g, g * 0.5, patina); b = mix(b, b * 0.45, patina);
      const dk = Math.min(1, seam * 0.8 + crack * 0.85);
      r = mix(r, 0.14, dk); g = mix(g, 0.09, dk); b = mix(b, 0.05, dk);
      r -= pit * 0.1; g -= pit * 0.1; b -= pit * 0.07;
      const i = (y * N + x) * 4;
      col[i] = Math.min(255, Math.max(0, r * 255)); col[i + 1] = Math.min(255, Math.max(0, g * 255)); col[i + 2] = Math.min(255, Math.max(0, b * 255)); col[i + 3] = 255;
      const rough = Math.min(1, 0.2 + seam * 0.5 + (1 - rim) * 0.12 + crack * 0.4 + (grain - 0.5) * 0.1 + pit * 0.3 + (1 - k) * 0.08);
      orm[i] = 255; orm[i + 1] = rough * 255; orm[i + 2] = 0; orm[i + 3] = 255;
      hgt[y * N + x] = dome * 0.3 + rim * 0.12 + (grow - 0.5) * 0.015 + (grain - 0.5) * 0.025 - crack * 0.18 - seam * 0.2 - pit * 0.05;
    }
    const nrm = normalFrom(hgt, N, N / 140);
    return { map: packTex(N, col, true, 'shell_map'), normal: packTex(N, nrm, false, 'shell_nrm'), orm: packTex(N, orm, false, 'shell_orm') };
  });
}

/** Wet dark slate-blue flesh: leathery scales, fibre streaks, faint veins. */
export function fleshTextures() {
  const N = texRes(512);
  return cached('alientech:flesh' + N, () => {
    const col = new Uint8ClampedArray(N * N * 4), orm = new Uint8ClampedArray(N * N * 4), hgt = new Float32Array(N * N);
    const v = { d1: 0, d2: 0, id: 0 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, w = y / N;
      vor(u * 22 + (fbmP(u * 6, w * 6, 6, 2, 3) - 0.5) * 0.8, w * 22 + (fbmP(u * 6, w * 6, 6, 2, 8) - 0.5) * 0.8, 22, 11, v);
      const sc = sstep(0.0, 0.5, v.d2 - v.d1);
      const fib = fbmP(u * 5, w * 90, 90, 3, 17);                    // fibres run along u
      const mott = fbmP(u * 4, w * 4, 4, 4, 23);
      const mott2 = fbmP(u * 12, w * 12, 12, 3, 29);
      const vn = Math.abs(fbmP(u * 7 + mott * 0.7, w * 7 + mott * 0.7, 7, 3, 37) * 2 - 1);
      const vein = 1 - sstep(0.0, 0.07, vn);
      const base = 0.45 + mott * 0.7 + (mott2 - 0.5) * 0.35 + (fib - 0.5) * 0.35 + v.id * 0.08;
      // #1d2a36 -> #3a5368 palette in linear-ish sRGB bytes
      let r = mix(0.075, 0.20, base - 0.2), g = mix(0.125, 0.33, base - 0.2), b = mix(0.17, 0.42, base - 0.2);
      r *= 0.9 + 0.14 * sc; g *= 0.9 + 0.14 * sc; b *= 0.92 + 0.12 * sc;
      // veins: slightly lighter teal-violet, with a cyan hint
      r = mix(r, 0.20, vein * 0.5); g = mix(g, 0.40, vein * 0.5); b = mix(b, 0.46, vein * 0.5);
      // oily iridescent tint patches
      const irid = sstep(0.55, 0.8, fbmP(u * 3, w * 3, 3, 3, 43)); r += irid * 0.03; b += irid * 0.04;
      const i = (y * N + x) * 4;
      col[i] = Math.min(255, r * 255); col[i + 1] = Math.min(255, g * 255); col[i + 2] = Math.min(255, b * 255); col[i + 3] = 255;
      const rough = Math.min(1, 0.22 + (1 - sc) * 0.22 + (fib - 0.5) * 0.25 + (mott2 - 0.5) * 0.22 + vein * -0.06);
      orm[i] = 255; orm[i + 1] = Math.max(0, rough) * 255; orm[i + 2] = 0; orm[i + 3] = 255;
      hgt[y * N + x] = sc * 0.22 + (fib - 0.5) * 0.30 + vein * 0.25 + (mott2 - 0.5) * 0.30;
    }
    const nrm = normalFrom(hgt, N, N / 170);
    return { map: packTex(N, col, true, 'flesh_map'), normal: packTex(N, nrm, false, 'flesh_nrm'), orm: packTex(N, orm, false, 'flesh_orm') };
  });
}

/** Ship hull plating (kilometre scale): panel grid, rib seams, rivets, slate-blue with bone-tan accents. Tile = 64 px per panel row. */
export function hullTextures() {
  const N = texRes(512);
  return cached('alientech:hull' + N, () => {
    const col = new Uint8ClampedArray(N * N * 4), orm = new Uint8ClampedArray(N * N * 4), hgt = new Float32Array(N * N);
    const cols = 8, rows = 8, cw = N / cols, rh = N / rows;
    // per-panel variation (periodic) + a few tan accent panels
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, w = y / N;
      const stagger = (Math.floor(y / rh) % 2) * 0.5;
      const px = ((x / cw + stagger) % 1), py = (y / rh) % 1;
      const pid = hash(Math.floor((x / cw + stagger)) % cols, Math.floor(y / rh), 5);
      const bx = Math.min(px, 1 - px) * cw, by = Math.min(py, 1 - py) * rh; const bd = Math.min(bx, by);
      const seam = 1 - sstep(0.6, 2.4, bd);
      const bevel = sstep(0.0, 5.0, bd);
      const n1 = fbmP(u * 6, w * 6, 6, 4, 13), n2 = fbmP(u * 40, w * 40, 40, 3, 19), stain = fbmP(u * 3, w * 3, 3, 3, 27);
      const tan = pid > 0.82;
      let r, g, b;
      if (tan) { const k = 0.7 + n1 * 0.5; r = 0.62 * k; g = 0.50 * k; b = 0.32 * k; }
      else { const k = 0.65 + n1 * 0.9 + (pid - 0.5) * 0.35; r = 0.10 * k + 0.02; g = 0.16 * k + 0.02; b = 0.21 * k + 0.03; }
      const sh = (0.78 + 0.28 * bevel + (n2 - 0.5) * 0.18) * (1 - seam * 0.55);
      r *= sh; g *= sh; b *= sh;
      // streak stains running down
      const streak = sstep(0.55, 0.85, fbmP(u * 30, w * 3, 30, 3, 31)) * 0.25; r *= 1 - streak; g *= 1 - streak; b *= 1 - streak * 0.8;
      const i = (y * N + x) * 4;
      col[i] = Math.min(255, r * 255); col[i + 1] = Math.min(255, g * 255); col[i + 2] = Math.min(255, b * 255); col[i + 3] = 255;
      const rough = Math.min(1, (tan ? 0.35 : 0.42) + seam * 0.35 + (n2 - 0.5) * 0.3 + stain * 0.1);
      orm[i] = 255; orm[i + 1] = rough * 255; orm[i + 2] = (tan ? 20 : 60); orm[i + 3] = 255;
      hgt[y * N + x] = bevel * 0.55 + (n2 - 0.5) * 0.1 - seam * 0.4;
    }
    const nrm = normalFrom(hgt, N, N / 70);
    return { map: packTex(N, col, true, 'hull_map'), normal: packTex(N, nrm, false, 'hull_nrm'), orm: packTex(N, orm, false, 'hull_orm') };
  });
}

/** Emissive window/port lights for the ships (black background, cyan-white dots in clusters). Clamp-to-repeat tile. */
export function windowTexture(seed = 1) {
  const N = texRes(512);
  return cached('alientech:win' + N + ':' + seed, () => {
    const c = makeCanvas(N, N); const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);
    const step = N / 64; // 64 window cells across
    const pal = ['#46e6ff', '#7ff0ff', '#46e6ff', '#2fb7d8', '#bff8ff', '#46e6ff', '#9ef0e0'];
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
      const u = i / 64, w = j / 64;
      const cluster = fbmP(u * 4, w * 4, 4, 3, seed * 3 + 5);
      const row = hash(0, j, seed) > 0.18 ? 1 : 0;                  // dark rows between window bands
      const p = sstep(0.38, 0.65, cluster) * 0.92 + 0.04;
      if (!row || hash(i, j, seed + 9) > p) continue;
      const br = 0.55 + 0.45 * hash(i, j, seed + 17);
      ctx.globalAlpha = br; ctx.fillStyle = pal[Math.floor(hash(i, j, seed + 3) * pal.length) % pal.length];
      const ww = step * (0.34 + 0.3 * hash(i, j, seed + 23)), hh = step * 0.28;
      ctx.fillRect(i * step + step * 0.15, j * step + step * 0.3, ww, hh);
    }
    ctx.globalAlpha = 1;
    const t = texFromCanvas(c, { srgb: true, aniso: 8 }); t.userData.shared = true; t.name = 'windows'; return t;
  });
}

/** Soft round glow sprite texture (for flares). */
export function glowSpriteTexture() {
  return cached('alientech:glowsprite', () => {
    const N = 128; const c = makeCanvas(N, N); const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,0.75)'); g.addColorStop(0.35, 'rgba(255,255,255,0.22)'); g.addColorStop(0.7, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
    const t = texFromCanvas(c, { srgb: true, wrap: 'clamp', mip: true }); t.userData.shared = true; t.name = 'glowsprite'; return t;
  });
}
