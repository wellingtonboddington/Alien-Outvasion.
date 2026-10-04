// Tileable procedural PBR texture painters shared by all institutional sets.
// Every painter is a function (u,v,o) -> mutates o = {r,g,b (0..255), h (height 0..1), ro (roughness 0..1), em (emissive mask 0..1)}.
// Textures are built once (cached) and flagged shared, so sets never dispose them.
import * as THREE from 'three';
import { Q } from '../../../engine/common.js';
import { cached, makeCanvas, texFromCanvas, heightToNormalCanvas, texRes } from '../../../engine/proc.js';

// ---------- tileable value noise ----------
function h2(ix, iy, s) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** periodic smooth value noise 0..1; x in [0,px), y in [0,py) repeats */
export function vn(x, y, px, py, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  const a = h2(x0, y0, s), b = h2(x1, y0, s), c = h2(x0, y1, s), d = h2(x1, y1, s);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
/** tileable fbm in uv space. per = lattice cells across the texture at base octave */
export function tf(u, v, per, oct = 4, s = 0, gain = 0.5) { return tf2(u, v, per, per, oct, s, gain); }
export function tf2(u, v, px, py, oct = 4, s = 0, gain = 0.5) {
  let a = 1, sum = 0, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { sum += a * vn(u * px * f, v * py * f, px * f, py * f, s + i * 31); n += a; a *= gain; f *= 2; }
  return sum / n;
}
/** tileable cellular noise: returns [d1, d2, id] */
const _cell = [0, 0, 0];
export function cell(u, v, per, s = 0) {
  const x = u * per, y = v * per, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % per) + per) % per, wy = ((cy % per) + per) % per;
    const rx = h2(wx, wy, s + 5), ry = h2(wx, wy, s + 11);
    const dx = cx + rx - x, dy = cy + ry - y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < d1) { d2 = d1; d1 = d; id = h2(wx, wy, s + 17); } else if (d < d2) d2 = d;
  }
  _cell[0] = d1; _cell[1] = d2; _cell[2] = id; return _cell;
}
export const hash2 = h2;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * Paint a PBR set. fn(u,v,o). Returns {map, normalMap, roughnessMap?, emissiveMap?} (all flagged shared).
 * key must be unique; texture size follows the quality level.
 */
export function pbr(key, fn, opts = {}) {
  const { w: w0 = 512, h: h0 = w0, strength = 3, rough = false, emissive = false, srgbEmissive = true } = opts;
  const w = texRes(w0), h = Math.max(16, Math.round(h0 * w / w0));
  return cached(`pbr:${key}:${w}x${h}`, () => {
    const cc = makeCanvas(w, h), cx = cc.getContext('2d'), ci = cx.createImageData(w, h), cd = ci.data;
    const hc = makeCanvas(w, h), hx = hc.getContext('2d'), hi = hx.createImageData(w, h), hd = hi.data;
    let rc, rx, ri, rd, ec, ex, ei, ed;
    if (rough) { rc = makeCanvas(w, h); rx = rc.getContext('2d'); ri = rx.createImageData(w, h); rd = ri.data; }
    if (emissive) { ec = makeCanvas(w, h); ex = ec.getContext('2d'); ei = ex.createImageData(w, h); ed = ei.data; }
    const o = { r: 128, g: 128, b: 128, h: 0.5, ro: 0.7, em: 0, er: 255, eg: 255, eb: 255 };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      o.r = 128; o.g = 128; o.b = 128; o.h = 0.5; o.ro = 0.7; o.em = 0; o.er = 255; o.eg = 255; o.eb = 255;
      fn((x + 0.5) / w, (y + 0.5) / h, o);
      const i = (y * w + x) * 4;
      cd[i] = o.r; cd[i + 1] = o.g; cd[i + 2] = o.b; cd[i + 3] = 255;
      const hh = clamp01(o.h) * 255; hd[i] = hd[i + 1] = hd[i + 2] = hh; hd[i + 3] = 255;
      if (rough) { const rr = clamp01(o.ro) * 255; rd[i] = rd[i + 1] = rd[i + 2] = rr; rd[i + 3] = 255; }
      if (emissive) { const m = clamp01(o.em); ed[i] = o.er * m; ed[i + 1] = o.eg * m; ed[i + 2] = o.eb * m; ed[i + 3] = 255; }
    }
    cx.putImageData(ci, 0, 0); hx.putImageData(hi, 0, 0);
    const out = {};
    const flag = (t) => { t.userData.shared = true; return t; };
    out.map = flag(texFromCanvas(cc, { srgb: true, aniso: 4 }));
    out.normalMap = flag(texFromCanvas(heightToNormalCanvas(hc, strength), { srgb: false, aniso: 4 }));
    if (rough) { rx.putImageData(ri, 0, 0); out.roughnessMap = flag(texFromCanvas(rc, { srgb: false, aniso: 4 })); }
    if (emissive) { ex.putImageData(ei, 0, 0); out.emissiveMap = flag(texFromCanvas(ec, { srgb: srgbEmissive, aniso: 4 })); }
    out.userData = { shared: true };
    return out;
  });
}

// ---------- painters (all tileable) ----------
const P = {};
P.concrete = (u, v, o) => {
  const n = tf(u, v, 4, 5, 1), g = tf(u, v, 64, 2, 2), bl = tf(u, v, 2, 3, 3), pore = tf(u, v, 40, 1, 7) > 0.8 ? 1 : 0;
  const l = 150 + (n - 0.5) * 70 + (g - 0.5) * 38 + (bl - 0.5) * 36 - pore * 38;
  o.r = l; o.g = l * 0.99; o.b = l * 0.965; o.h = 0.45 * n + 0.4 * g + 0.15 - pore * 0.25; o.ro = 0.88 + (g - 0.5) * 0.2;
};
P.concreteRough = (u, v, o) => {
  const n = tf(u, v, 3, 5, 11), g = tf(u, v, 48, 3, 12), c = cell(u, v, 22, 4), crk = Math.abs(tf(u, v, 5, 4, 14) - 0.5) < 0.012 ? 1 : 0;
  const stain = tf(u, v, 2, 4, 15);
  const l = 118 + (n - 0.5) * 70 + (g - 0.5) * 55 + (c[0] < 0.18 ? -22 : 0) - crk * 60 - (stain > 0.62 ? 26 * (stain - 0.62) * 6 : 0);
  o.r = l * 1.02; o.g = l; o.b = l * 0.93; o.h = 0.4 * n + 0.45 * g + 0.15 * (1 - c[0]) - crk * 0.4; o.ro = 0.95;
};
P.wood = (u, v, o) => { // vertical planks, grain along v
  const NP = 4, pl = Math.floor(u * NP), pu = (u * NP) % 1, tint = h2(pl, 3, 201);
  const n = tf2(u, v, NP * 2, 4, 3, 21), w = tf2(u, v, NP, 2, 2, 22), fine = tf2(u, v, NP * 40, 2, 2, 23);
  const grain = Math.sin((pu * 4 + w * 1.6 + n * 0.5 + tint * 4) * Math.PI * 2) * 0.5 + 0.5;
  const k = clamp01(0.42 + 0.3 * n + 0.22 * grain * (0.5 + n) + (tint - 0.5) * 0.3 + (fine - 0.5) * 0.12);
  const seam = pu < 0.012 || pu > 0.988 ? 1 : 0;
  const f = 1 - seam * 0.55; o.r = mix(66, 132, k) * f; o.g = mix(44, 92, k) * f; o.b = mix(30, 62, k) * f;
  o.h = 0.55 + (fine - 0.5) * 0.25 + (grain - 0.5) * 0.12 - seam * 0.4; o.ro = 0.42 + (n - 0.5) * 0.16 + seam * 0.4;
};
P.woodLight = (u, v, o) => {
  P.wood(u, v, o); o.r = o.r * 1.55 + 40; o.g = o.g * 1.6 + 38; o.b = o.b * 1.6 + 25;
};
P.marbleGreen = (u, v, o) => {
  const n = tf(u, v, 3, 5, 31), n2 = tf(u, v, 8, 4, 36), w = tf(u + n * 0.08, v, 5, 4, 32), vein = Math.pow(1 - Math.abs(2 * w - 1), 38), v2 = Math.pow(1 - Math.abs(2 * tf(u, v + n * 0.06, 11, 3, 33) - 1), 60), v3 = Math.pow(1 - Math.abs(2 * tf(u, v, 22, 2, 37) - 1), 80);
  const k = n * 0.7 + n2 * 0.3; const r = mix(8, 34, k), g = mix(42, 92, k), b = mix(30, 62, k);
  const wv = clamp01(vein * 0.85 + v2 * 0.5 + v3 * 0.25);
  o.r = mix(r, 205, wv * 0.7); o.g = mix(g, 225, wv * 0.7); o.b = mix(b, 200, wv * 0.7); o.h = 0.5 + wv * 0.02; o.ro = 0.14 + wv * 0.12;
};
P.marbleWhite = (u, v, o) => {
  const n = tf(u, v, 3, 5, 41), w = tf(u, v, 5, 4, 42), vein = Math.pow(1 - Math.abs(2 * w - 1), 10);
  const l = 218 + (n - 0.5) * 24 - vein * 70; o.r = l; o.g = l * 0.985; o.b = l * 0.965; o.h = 0.5; o.ro = 0.14 + vein * 0.1;
};
P.carpet = (u, v, o) => {
  const n = tf(u, v, 6, 3, 51), g = h2(Math.floor(u * 256), Math.floor(v * 256), 9), g2 = h2(Math.floor(u * 128), Math.floor(v * 128), 10);
  const l = 0.78 + (n - 0.5) * 0.3 + (g - 0.5) * 0.26 + (g2 - 0.5) * 0.1;
  o.r = 120 * l; o.g = 122 * l; o.b = 128 * l; o.h = 0.5 + (g - 0.5) * 0.7; o.ro = 1;
};
P.metalPanel = (u, v, o) => { // 2 panels across, brushed
  const br = tf2(u, v, 2, 90, 3, 61), grain = tf(u, v, 24, 2, 62), pu = (u * 2) % 1, pv = (v * 2) % 1;
  const seam = Math.min(Math.min(pu, 1 - pu), Math.min(pv, 1 - pv)); const groove = seam < 0.012 ? 1 : 0, edge = seam < 0.03 ? 1 : 0;
  const rivet = (Math.hypot(pu - 0.06, pv - 0.06) < 0.012 || Math.hypot(pu - 0.94, pv - 0.06) < 0.012 || Math.hypot(pu - 0.06, pv - 0.94) < 0.012 || Math.hypot(pu - 0.94, pv - 0.94) < 0.012) ? 1 : 0;
  let l = 112 + (br - 0.5) * 36 + (grain - 0.5) * 22 - groove * 55 + edge * 6 + rivet * 20;
  o.r = l * 0.96; o.g = l * 0.99; o.b = l * 1.04; o.h = 0.55 - groove * 0.4 + rivet * 0.2 + (br - 0.5) * 0.08; o.ro = 0.38 + (grain - 0.5) * 0.25 + groove * 0.3;
};
P.tile = (u, v, o) => { // 4x4 tiles
  const pu = (u * 4) % 1, pv = (v * 4) % 1, e = Math.min(Math.min(pu, 1 - pu), Math.min(pv, 1 - pv)); const grout = e < 0.018 ? 1 : 0;
  const id = h2(Math.floor(u * 4), Math.floor(v * 4), 71), n = tf(u, v, 8, 3, 72);
  const l = grout ? 168 + (n - 0.5) * 20 : 236 + (id - 0.5) * 8 + (n - 0.5) * 8; o.r = l * 0.99; o.g = l; o.b = l * 1.01;
  o.h = grout ? 0.2 : 0.62; o.ro = grout ? 0.8 : 0.22 + n * 0.08;
};
P.epoxy = (u, v, o) => { // lab floor: pale grey-blue flecks, glossy
  const n = tf(u, v, 5, 4, 81), f = h2(Math.floor(u * 256), Math.floor(v * 256), 82);
  const l = 150 + (n - 0.5) * 26 + (f > 0.93 ? -26 : 0) + (f < 0.04 ? 30 : 0); o.r = l * 0.93; o.g = l * 0.99; o.b = l * 1.03; o.h = 0.5 + (f - 0.5) * 0.1; o.ro = 0.24 + (n - 0.5) * 0.2;
};
P.leather = (u, v, o) => {
  const c = cell(u, v, 36, 91), n = tf(u, v, 6, 3, 92); const peb = Math.min(1, c[0] * 1.6); const edge = clamp01((c[1] - c[0]) * 7);
  const l = 0.9 + (n - 0.5) * 0.18 - (1 - edge) * 0.05; o.r = 255 * l; o.g = 255 * l; o.b = 255 * l; o.h = edge * 0.7 + 0.1 - peb * 0.05; o.ro = 0.42 + (1 - edge) * 0.14 + (n - 0.5) * 0.12;
};
P.weave = (u, v, o) => { // fabric / canvas / acoustic cloth
  const N = 64, a = Math.sin(u * N * Math.PI * 2), b = Math.sin(v * N * Math.PI * 2); const over = ((Math.floor(u * N) + Math.floor(v * N)) & 1) ? a : b;
  const n = tf(u, v, 8, 3, 101); const l = 0.78 + over * 0.12 + (n - 0.5) * 0.28; o.r = 255 * l; o.g = 255 * l; o.b = 255 * l; o.h = 0.5 + over * 0.25; o.ro = 0.95;
};
P.perf = (u, v, o) => { // perforated sheet (rack doors, grilles)
  const N = 24, fu = (u * N) % 1, fv = (v * N) % 1, d = Math.hypot(fu - 0.5, fv - 0.5); const hole = d < 0.26 ? 1 : 0; const n = tf(u, v, 6, 3, 111);
  const l = hole ? 12 : 54 + (n - 0.5) * 18; o.r = l; o.g = l * 1.02; o.b = l * 1.06; o.h = hole ? 0 : 0.7; o.ro = hole ? 1 : 0.42;
};
P.ceilingTile = (u, v, o) => {
  const pu = (u * 2) % 1, pv = (v * 2) % 1, e = Math.min(Math.min(pu, 1 - pu), Math.min(pv, 1 - pv)); const gr = e < 0.012 ? 1 : 0;
  const f = tf(u, v, 40, 3, 121), sp = h2(Math.floor(u * 200), Math.floor(v * 200), 122);
  const l = gr ? 70 : 214 + (f - 0.5) * 30 - (sp > 0.93 ? 55 : 0); o.r = l; o.g = l; o.b = l * 0.97; o.h = gr ? 0.2 : 0.55 + (f - 0.5) * 0.4 - (sp > 0.93 ? 0.3 : 0); o.ro = 0.95;
};
P.dirt = (u, v, o) => {
  const n = tf(u, v, 4, 5, 131), g = tf(u, v, 60, 2, 132), pb = cell(u, v, 40, 133); const peb = pb[0] < 0.2 ? 1 : 0;
  const k = n * 0.7 + g * 0.3; o.r = mix(70, 150, k) + peb * 20; o.g = mix(56, 120, k) + peb * 16; o.b = mix(40, 88, k) + peb * 10; o.h = 0.4 * n + 0.4 * g + peb * 0.2; o.ro = 0.98;
};
P.hazard = (u, v, o) => {
  const s = ((u + v) * 8) % 1; const yel = s < 0.5; const n = tf(u, v, 16, 3, 141);
  const wear = n > 0.66 ? (n - 0.66) * 2.5 : 0;
  if (yel) { o.r = mix(240, 150, wear); o.g = mix(190, 125, wear); o.b = mix(20, 60, wear); } else { o.r = o.g = o.b = mix(26, 70, wear); }
  o.h = 0.5 - wear * 0.2; o.ro = 0.6 + wear * 0.3;
};
P.floorBlack = (u, v, o) => {
  const n = tf(u, v, 6, 4, 151), f = h2(Math.floor(u * 256), Math.floor(v * 256), 152);
  const l = 22 + (n - 0.5) * 12 + (f - 0.5) * 5; o.r = l; o.g = l * 1.03; o.b = l * 1.12; o.h = 0.5 + (f - 0.5) * 0.1; o.ro = 0.14 + (n - 0.5) * 0.14;
};
P.sandbag = (u, v, o) => {
  const rows = 6, rv = (v * rows) % 1, ru = (u * 4 + Math.floor(v * rows) * 0.5) % 1; const bag = Math.sin(ru * Math.PI) * Math.sin(rv * Math.PI); const n = tf(u, v, 20, 3, 161);
  const wv = Math.sin((u * 220)) * 0.04 + Math.sin(v * 200) * 0.04;
  const l = 0.5 + bag * 0.45 + (n - 0.5) * 0.3; o.r = 168 * l + wv * 30; o.g = 148 * l + wv * 30; o.b = 104 * l; o.h = bag * 0.8 + 0.1 + wv; o.ro = 0.98;
};
P.rubber = (u, v, o) => { const n = tf(u, v, 30, 3, 171); const l = 26 + n * 14; o.r = l; o.g = l; o.b = l; o.h = 0.5 + n * 0.4; o.ro = 0.85; };
P.paint = (u, v, o) => { // plaster / painted wall, subtle
  const n = tf(u, v, 5, 4, 181), g = tf(u, v, 80, 2, 182); const l = 0.9 + (n - 0.5) * 0.18 + (g - 0.5) * 0.06; o.r = 255 * l; o.g = 255 * l; o.b = 255 * l; o.h = 0.5 + (g - 0.5) * 0.5; o.ro = 0.85;
};
P.brushed = (u, v, o) => {
  const br = tf2(u, v, 2, 120, 3, 191), n = tf(u, v, 6, 3, 192); const l = 0.82 + (br - 0.5) * 0.3 + (n - 0.5) * 0.12; o.r = 255 * l; o.g = 255 * l; o.b = 255 * l; o.h = 0.5 + (br - 0.5) * 0.4; o.ro = 0.34 + (br - 0.5) * 0.2;
};
P.camo = (u, v, o) => { // net/tent camouflage blotches
  const a = tf(u, v, 4, 4, 201), b = tf(u, v, 6, 3, 202), c = tf(u, v, 9, 3, 203);
  let r = 74, g = 82, bl = 52; if (a > 0.52) { r = 52; g = 62; bl = 38; } if (b > 0.58) { r = 118; g = 104; bl = 70; } if (c > 0.66) { r = 30; g = 36; bl = 24; }
  const w = Math.sin(u * 256 * 3.14159) * Math.sin(v * 256 * 3.14159) * 0.07 + 0.93; o.r = r * w; o.g = g * w; o.b = bl * w; o.h = 0.5 + (w - 0.93) * 4; o.ro = 0.96;
};
P.olive = (u, v, o) => { const n = tf(u, v, 6, 4, 211); const w = Math.sin(u * 300) * Math.sin(v * 300) * 0.06 + 0.94; const l = (0.82 + (n - 0.5) * 0.3) * w; o.r = 86 * l; o.g = 92 * l; o.b = 60 * l; o.h = 0.5 + (w - 0.94) * 5; o.ro = 0.95; };
P.rust = (u, v, o) => { const n = tf(u, v, 5, 5, 221), r2 = tf(u, v, 14, 3, 222); const k = clamp01((n - 0.4) * 2.2); o.r = mix(70, 150, k * r2); o.g = mix(78, 76, k * r2); o.b = mix(86, 46, k * r2); o.h = 0.5 + (r2 - 0.5) * 0.5; o.ro = 0.55 + k * 0.4; };

export const PAINTERS = P;
/** Fetch a cached PBR texture set from the painter table. */
const STRENGTH = { floorBlack: 0.6, leather: 0.45, carpet: 1.6, concrete: 2.2, concreteRough: 2.6, paint: 0.3, weave: 1.4, ceilingTile: 1.3, wood: 1.5, woodLight: 1.5, epoxy: 0.8, tile: 1.6, marbleGreen: 0.4, marbleWhite: 0.4, brushed: 0.8, metalPanel: 2.0, rubber: 1.2, sandbag: 2.4, dirt: 3, camo: 1.5, olive: 1.5 };
export function texSet(name, opts = {}) {
  const f = P[name]; if (!f) throw new Error('unknown texture ' + name);
  return pbr(name, f, { w: 512, strength: STRENGTH[name] ?? 2.5, rough: true, ...opts });
}

// ---------- small shared utility textures ----------
export function radialTex(key = 'radial', stops = [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]) {
  return cached(`util:${key}`, () => {
    const c = makeCanvas(128, 128), x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [p, col] of stops) g.addColorStop(p, col); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = texFromCanvas(c, { wrap: 'clamp', srgb: true, aniso: 1 }); return t;
  });
}
/** soft elongated light shaft gradient: bright at v=0 (top/uv.y=1 depending on geometry), fades along length & across width */
export function shaftTex() {
  return cached('util:shaft', () => {
    const c = makeCanvas(64, 256), x = c.getContext('2d'); const img = x.createImageData(64, 256);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 64; i++) { const a = Math.pow(1 - Math.abs(i / 63 - 0.5) * 2, 1.6), b = Math.pow(j / 255, 1.3); const k = a * b * 255; const p = (j * 64 + i) * 4; img.data[p] = img.data[p + 1] = img.data[p + 2] = k; img.data[p + 3] = 255; }
    x.putImageData(img, 0, 0); return texFromCanvas(c, { wrap: 'clamp', srgb: false, aniso: 1, mip: false });
  });
}
export function blobShadowTex() {
  return cached('util:blob', () => {
    const c = makeCanvas(128, 128), x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.55, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return texFromCanvas(c, { wrap: 'clamp', srgb: true, aniso: 1 });
  });
}
export { THREE, Q };
