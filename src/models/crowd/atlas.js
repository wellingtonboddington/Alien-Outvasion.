// Procedural texture arrays for crowd agents.
//  alb: RGB albedo (sRGB) + A = palette tint mask (1 = multiply by the per-instance palette colour, 0 = texture colour only)
//  nor: RG tangent-space normal, B roughness, A emissive mask
// 22 layers (cloth, camo, skin, zombie flesh per strain, faces, robot shell ...). Layers are tileable except faces (plain borders).
import * as THREE from 'three';
import { RNG, Q } from '../../engine/common.js';
import { cached, makeCanvas } from '../../engine/proc.js';
import { NLAYER, LAYER } from './rig.js';

const gray = (v) => { const g = Math.max(0, Math.min(255, Math.round(v * 255))); return `rgb(${g},${g},${g})`; };
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** periodic value-noise fbm field in [0,1], S*S floats */
function field(S, period, oct, seed) {
  const out = new Float32Array(S * S); const r = new RNG(seed * 7919 + 13);
  let amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) {
    const P = period * (1 << o); const lat = new Float32Array(P * P); for (let i = 0; i < lat.length; i++) lat[i] = r.next();
    for (let y = 0; y < S; y++) {
      const fy = y / S * P, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty); const y0 = iy % P, y1 = (iy + 1) % P;
      for (let x = 0; x < S; x++) {
        const fx = x / S * P, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx); const x0 = ix % P, x1 = (ix + 1) % P;
        const a = lat[y0 * P + x0], b = lat[y0 * P + x1], c = lat[y1 * P + x0], d = lat[y1 * P + x1];
        out[y * S + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  // contrast-normalise roughly to [0,1]
  let mn = 1, mxv = 0; for (let i = 0; i < out.length; i++) { if (out[i] < mn) mn = out[i]; if (out[i] > mxv) mxv = out[i]; }
  const k = 1 / Math.max(1e-4, mxv - mn); for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) * k;
  return out;
}

class LayerCtx {
  constructor(S) { this.S = S; this.a = this._c(); this.m = this._c(); this.h = this._c(); this.r = this._c(); this.e = this._c(); this.m.fillStyle = '#fff'; this.m.fillRect(0, 0, S, S); this.h.fillStyle = gray(0.5); this.h.fillRect(0, 0, S, S); this.r.fillStyle = gray(0.8); this.r.fillRect(0, 0, S, S); this.e.fillStyle = '#000'; this.e.fillRect(0, 0, S, S); this.a.fillStyle = '#888'; this.a.fillRect(0, 0, S, S); this.hs = 3; }
  _c() { return makeCanvas(this.S).getContext('2d', { willReadFrequently: true }); }
  /** per-pixel fill of a channel: fn(x,y) -> [r,g,b] (0..255) for 'a', number 0..1 for others */
  px(ch, fn) {
    const S = this.S, ctx = this[ch], img = ctx.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = fn(x, y); const i = (y * S + x) * 4; if (ch === 'a') { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; } else { const g = Math.max(0, Math.min(255, v * 255)); d[i] = d[i + 1] = d[i + 2] = g; } d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  /** fill a shape on several channels: path(ctx) builds the path; v = {a:'#rrggbb', m, h, r, e, alpha} */
  shape(path, v) {
    for (const k of ['a', 'm', 'h', 'r', 'e']) if (v[k] !== undefined) { const ctx = this[k]; ctx.save(); ctx.fillStyle = k === 'a' ? v.a : gray(v[k]); if (v.alpha !== undefined) ctx.globalAlpha = v.alpha; ctx.beginPath(); path(ctx); ctx.fill(); ctx.restore(); }
  }
  clip(path) { for (const k of ['a', 'm', 'h', 'r', 'e']) { const c = this[k]; c.save(); c.beginPath(); path(c); c.clip(); } }
  unclip() { for (const k of ['a', 'm', 'h', 'r', 'e']) this[k].restore(); }
  line(path, v) {
    for (const k of ['a', 'm', 'h', 'r', 'e']) if (v[k] !== undefined) { const ctx = this[k]; ctx.save(); ctx.strokeStyle = k === 'a' ? v.a : gray(v[k]); ctx.lineWidth = v.w || 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (v.alpha !== undefined) ctx.globalAlpha = v.alpha; ctx.beginPath(); path(ctx); ctx.stroke(); ctx.restore(); }
  }
}

// ----------------------------------------------------------------------------------------------------------------------------------
// layer painters. S = pixel size. Coordinates in pixels; use u = S/256 to scale vector drawing.
const PAINT = {};

PAINT.weave = (L, S) => {
  const f = field(S, 6, 3, 1);
  L.px('a', (x, y) => { const t = ((x + y) & 3) / 3, w = (((x - y) & 7) < 4 ? 0.05 : 0); const v = 0.80 + 0.10 * f[y * S + x] + 0.05 * Math.sin(t * 6.283) + w; const g = v * 255; return [g, g, g]; });
  L.px('h', (x, y) => 0.5 + 0.22 * Math.sin((x + y) * 1.571) * Math.cos((x - y) * 0.785) + 0.15 * f[y * S + x]);
  L.px('r', (x, y) => 0.82 + 0.1 * f[y * S + x]);
};
PAINT.camo = (L, S) => {
  const f1 = field(S, 5, 3, 11), f2 = field(S, 6, 3, 12), f3 = field(S, 7, 2, 13), f4 = field(S, 10, 2, 14);
  const tan = hex(0x8f8462), khaki = hex(0xaaa07e), olive = hex(0x5e6340), brown = hex(0x4f402b), dark = hex(0x2f382a);
  L.px('a', (x, y) => {
    const i = y * S + x; let c = tan;
    if (f1[i] < 0.34) c = khaki; if (f1[i] > 0.6) c = olive; if (f2[i] > 0.64) c = brown; if (f3[i] > 0.72 && f4[i] > 0.45) c = dark;
    if (f4[i] > 0.78 && f2[i] < 0.5) c = khaki;
    const w = 0.9 + 0.1 * Math.sin((x + y) * 1.571) * Math.cos((x - y) * 0.785);
    return [c[0] * w, c[1] * w, c[2] * w];
  });
  L.px('m', () => 0.35);
  L.px('h', (x, y) => 0.5 + 0.2 * Math.sin((x + y) * 1.571) * Math.cos((x - y) * 0.785));
  L.px('r', () => 0.88);
};
PAINT.knit = (L, S) => {
  const f = field(S, 6, 2, 21); const sw = Math.max(4, S / 32), sh = sw * 1.3;
  L.px('a', () => [200, 200, 200]); L.px('h', () => 0.3);
  for (let row = 0; row * sh < S + sh; row++) for (let col = 0; col * sw < S + sw; col++) {
    const x0 = col * sw + (row & 1 ? sw / 2 : 0), y0 = row * sh;
    for (const k of ['a', 'h']) { const ctx = L[k]; ctx.lineWidth = sw * 0.3; ctx.lineCap = 'round'; ctx.strokeStyle = k === 'a' ? '#f4f4f4' : gray(0.85); ctx.beginPath(); ctx.moveTo(x0 - sw * 0.42, y0); ctx.lineTo(x0, y0 + sh * 0.85); ctx.lineTo(x0 + sw * 0.42, y0); ctx.stroke(); ctx.strokeStyle = k === 'a' ? '#888' : gray(0.1); ctx.beginPath(); ctx.moveTo(x0 - sw * 0.42, y0 + sh * 0.2); ctx.lineTo(x0, y0 + sh * 1.05); ctx.lineTo(x0 + sw * 0.42, y0 + sh * 0.2); ctx.stroke(); }
  }
  L.px('r', () => 0.95);
};
PAINT.denim = (L, S) => {
  const f = field(S, 5, 3, 31), g = field(S, 12, 2, 32);
  L.px('a', (x, y) => { const tw = (((x + y) & 3) < 2) ? 0.06 : -0.03; const fleck = ((x * 7 + 3) % 5 === 0 && g[y * S + x] > 0.55) ? 0.12 : 0; const fade = 0.78 + 0.22 * f[y * S + x]; const v = (0.62 + tw + fleck) * fade + 0.12; const k = v * 255; return [k * 0.96, k, k * 1.03]; });
  L.px('h', (x, y) => 0.5 + 0.25 * (((x + y) & 3) < 2 ? 1 : -1) * 0.5 + 0.15 * g[y * S + x]);
  L.px('r', () => 0.85);
};
PAINT.leather = (L, S) => {
  const f = field(S, 10, 3, 41), g = field(S, 20, 1, 42);
  L.px('a', (x, y) => { const v = 0.35 + 0.35 * f[y * S + x] + 0.1 * g[y * S + x]; const k = v * 255; return [k, k, k]; });
  L.px('h', (x, y) => 0.4 + 0.5 * (1 - Math.abs(f[y * S + x] - 0.5) * 2) * g[y * S + x] + 0.1 * f[y * S + x]);
  L.px('r', (x, y) => 0.45 + 0.3 * f[y * S + x]);
};
PAINT.metal = (L, S) => {
  const f = field(S, 3, 2, 51); const r = new RNG(52);
  L.px('a', (x, y) => { const v = 0.55 + 0.12 * Math.sin(y * 0.9 + f[y * S + x] * 5) * 0.5 + 0.1 * f[y * S + x]; const k = v * 255; return [k, k, k]; });
  L.px('m', () => 0.0); L.px('h', () => 0.5); L.px('r', (x, y) => 0.38 + 0.2 * f[y * S + x]);
  for (let i = 0; i < 70; i++) { const x = r.range(0, S), y = r.range(0, S), l = r.range(S * 0.04, S * 0.2); L.line((c) => { c.moveTo(x, y); c.lineTo(x + l, y + r.range(-2, 2)); }, { a: '#d8d8d8', h: 0.8, r: 0.7, w: 1, alpha: 0.45 }); }
  for (let i = 0; i < 6; i++) { const y = (i + 0.5) / 6 * S; L.line((c) => { c.moveTo(0, y); c.lineTo(S, y); }, { a: '#202020', h: 0.1, w: 1.5, alpha: 0.7 }); }
};
PAINT.skin = (L, S) => {
  const f = field(S, 4, 4, 61), g = field(S, 14, 2, 62);
  L.px('a', (x, y) => { const i = y * S + x; const v = 0.90 + 0.10 * f[i] - 0.05 * g[i]; const red = 0.04 * sstep(0.55, 0.8, f[i]); return [v * 255, (v - red * 0.8) * 255 * 0.99, (v - red * 1.3) * 255 * 0.99]; });
  L.px('h', (x, y) => 0.5 + 0.35 * (g[y * S + x] - 0.5));
  L.px('r', (x, y) => 0.58 + 0.15 * f[y * S + x]);
};

// ---- zombie flesh layers
function veinNet(S, seed, freq, oct, thick) { const f = field(S, freq, oct, seed); const v = new Float32Array(S * S); for (let i = 0; i < v.length; i++) { const r = 1 - Math.abs(f[i] * 2 - 1); v[i] = sstep(1 - thick, 1, r); } return v; }
PAINT.fleshUS = (L, S) => {
  const f = field(S, 4, 4, 71), g = field(S, 9, 3, 72); const vein = veinNet(S, 73, 5, 3, 0.07), vein2 = veinNet(S, 74, 11, 2, 0.05);
  L.px('a', (x, y) => { const i = y * S + x; let c = mix([232, 238, 226], [150, 140, 170], sstep(0.45, 0.8, f[i])); c = mix(c, [190, 120, 120], 0.35 * sstep(0.7, 0.9, g[i])); const vv = Math.max(vein[i], vein2[i] * 0.7); c = mix(c, [74, 58, 100], vv * 0.85); return c; });
  L.px('h', (x, y) => { const i = y * S + x; return 0.4 + 0.45 * Math.max(vein[i], vein2[i] * 0.7) + 0.2 * (g[i] - 0.5); });
  L.px('r', (x, y) => 0.55 + 0.25 * f[y * S + x]);
};
PAINT.fleshIN = (L, S) => {
  const f = field(S, 4, 4, 81), g = field(S, 10, 3, 82), r = new RNG(83);
  L.px('a', (x, y) => { const i = y * S + x; let c = mix([238, 238, 224], [214, 208, 160], sstep(0.4, 0.85, f[i])); c = mix(c, [150, 70, 50], 0.45 * sstep(0.68, 0.9, g[i])); return c; });
  L.px('h', (x, y) => 0.5 + 0.3 * (g[y * S + x] - 0.5)); L.px('r', () => 0.5);
  for (let i = 0; i < 26; i++) { const x = r.range(0, S), y = r.range(0, S), rr = r.range(S * 0.012, S * 0.03); L.shape((c) => c.arc(x, y, rr * 1.7, 0, 6.283), { a: '#e8d889', h: 0.62, alpha: 0.7 }); L.shape((c) => c.arc(x, y, rr, 0, 6.283), { a: '#7a2d1c', h: 0.35, alpha: 0.85 }); }
  for (let i = 0; i < 14; i++) { const x = r.range(0, S), y = r.range(0, S * 0.7); L.line((c) => { c.moveTo(x, y); c.lineTo(x + r.range(-3, 3), y + r.range(S * 0.08, S * 0.28)); }, { a: '#5c1510', w: S / 90, alpha: 0.65 }); }
};
PAINT.fleshDE = (L, S) => {
  const f = field(S, 4, 4, 91), g = field(S, 8, 3, 92); const v1 = veinNet(S, 93, 6, 4, 0.06), v2 = veinNet(S, 94, 13, 3, 0.05), v3 = veinNet(S, 95, 22, 2, 0.045);
  L.px('a', (x, y) => { const i = y * S + x; let c = mix([248, 248, 252], [206, 212, 228], sstep(0.4, 0.85, f[i])); c = mix(c, [150, 120, 150], 0.25 * sstep(0.7, 0.92, g[i])); const vv = Math.min(1, v1[i] + v2[i] * 0.8 + v3[i] * 0.5); c = mix(c, [28, 20, 42], vv * 0.92); return c; });
  L.px('h', (x, y) => { const i = y * S + x; return 0.45 + 0.4 * Math.min(1, v1[i] + v2[i] * 0.8) + 0.1 * (g[i] - 0.5); });
  L.px('r', (x, y) => 0.5 + 0.2 * f[y * S + x]);
};
PAINT.fleshRU = (L, S) => {
  const f = field(S, 5, 4, 101), g = field(S, 16, 2, 102), r = new RNG(103); const v1 = veinNet(S, 104, 7, 3, 0.045);
  L.px('a', (x, y) => { const i = y * S + x; let c = mix([230, 238, 250], [160, 190, 225], sstep(0.35, 0.8, f[i])); c = mix(c, [255, 255, 255], 0.5 * sstep(0.62, 0.9, g[i])); c = mix(c, [90, 120, 170], v1[i] * 0.6); return c; });
  L.px('h', (x, y) => 0.5 + 0.35 * (g[y * S + x] - 0.5) + 0.2 * v1[y * S + x]); L.px('r', (x, y) => 0.35 + 0.35 * g[y * S + x]);
  for (let i = 0; i < 120; i++) { const x = r.range(0, S), y = r.range(0, S); L.shape((c) => c.arc(x, y, r.range(0.5, 1.8), 0, 6.283), { a: '#ffffff', h: 0.9, r: 0.2, alpha: 0.85 }); }
};
PAINT.circuit = (L, S) => {
  const f = field(S, 4, 3, 111), r = new RNG(112), u = S / 256;
  L.px('a', (x, y) => { const v = 0.84 + 0.1 * f[y * S + x]; const k = v * 255; return [k, k * 1.02, k * 0.98]; });
  L.px('h', () => 0.5); L.px('r', () => 0.55);
  const grid = Math.round(S / 16);
  for (let t = 0; t < 22; t++) {
    let gx = r.int(0, 15), gy = r.int(0, 15); let dx = r.pick([-1, 0, 1]), dy = dx === 0 ? r.pick([-1, 1]) : r.pick([-1, 0, 1]);
    const pts = [[gx, gy]]; const n = r.int(3, 8);
    for (let k = 0; k < n; k++) { const len = r.int(1, 4); gx += dx * len; gy += dy * len; pts.push([gx, gy]); if (r.chance(0.6)) { if (dx !== 0 && dy === 0) { dy = r.pick([-1, 1]); dx = r.chance(0.5) ? dx : 0; } else if (dx === 0) { dx = r.pick([-1, 1]); dy = r.chance(0.5) ? dy : 0; } else { dx = r.pick([-1, 0, 1]); if (dx === 0) dy = r.pick([-1, 1]); } } }
    const path = (c) => { pts.forEach((p, i) => { const px = ((p[0] % 16 + 16) % 16) * grid + grid / 2 + (i ? 0 : 0), py = ((p[1] % 16 + 16) % 16) * grid + grid / 2; if (i && (Math.abs(p[0] - pts[i - 1][0]) > 8 || Math.abs(p[1] - pts[i - 1][1]) > 8)) c.moveTo(px, py); else if (i) c.lineTo(px, py); else c.moveTo(px, py); }); };
    L.line(path, { a: '#1c2a20', w: 4.2 * u, alpha: 0.55 }); L.line(path, { e: 1, a: '#d8ffe0', w: 2.2 * u }); L.line(path, { m: 0.3, w: 3 * u });
    const e = pts[pts.length - 1]; const ex = ((e[0] % 16 + 16) % 16) * grid + grid / 2, ey = ((e[1] % 16 + 16) % 16) * grid + grid / 2;
    L.shape((c) => c.arc(ex, ey, 3.2 * u, 0, 6.283), { e: 1, a: '#e8ffe8' }); L.shape((c) => c.arc(ex, ey, 1.4 * u, 0, 6.283), { e: 0.3, a: '#1c2a20' });
  }
};
PAINT.robotShell = (L, S) => {
  const f = field(S, 6, 3, 121), r = new RNG(122), u = S / 256;
  L.px('a', (x, y) => { const v = 0.94 - 0.05 * f[y * S + x]; const k = v * 255; return [k, k, k]; }); L.px('h', () => 0.6); L.px('r', (x, y) => 0.26 + 0.12 * f[y * S + x]);
  for (let i = 0; i < 5; i++) { const y = (i / 5) * S + r.range(-4, 4); L.line((c) => { c.moveTo(0, y); c.lineTo(S, y); }, { a: '#8a8f96', h: 0.3, w: 1.2 * u, alpha: 0.7 }); }
  for (let i = 0; i < 4; i++) { const x = (i / 4) * S + r.range(-4, 4); L.line((c) => { c.moveTo(x, 0); c.lineTo(x, S); }, { a: '#8a8f96', h: 0.3, w: 1.2 * u, alpha: 0.7 }); }
  for (let i = 0; i < 12; i++) { const x = r.range(0, S), y = r.range(0, S); L.shape((c) => c.arc(x, y, 1.6 * u, 0, 6.283), { a: '#7b8087', h: 0.8, alpha: 0.9 }); }
};
PAINT.molle = (L, S) => {
  const f = field(S, 8, 2, 131), u = S / 256;
  L.px('a', (x, y) => { const band = (y % Math.round(16 * u)) < Math.round(11 * u); const v = (band ? 0.72 : 0.58) * (0.9 + 0.2 * f[y * S + x]); const k = v * 255; return [k, k, k]; });
  L.px('h', (x, y) => ((y % Math.round(16 * u)) < Math.round(11 * u)) ? 0.62 : 0.38);
  for (let y = 0; y < S; y += Math.round(16 * u)) for (let x = 0; x < S; x += Math.round(24 * u)) L.line((c) => { c.moveTo(x + 2, y + 5 * u); c.lineTo(x + 2, y + 9 * u); }, { a: '#151515', w: 1.2 * u, alpha: 0.7 });
  L.px('r', () => 0.9);
};
PAINT.gore = (L, S) => { // worn cloth with dark blood stains, grime and rips (stains are untinted: tint mask 0)
  PAINT.weave(L, S);
  const f = field(S, 5, 3, 161), g = field(S, 9, 3, 162), r = new RNG(163), u = S / 256;
  L.px('a', (x, y) => { const i = y * S + x; const t = ((x + y) & 3) / 3; let v = 0.72 + 0.1 * f[i] + 0.05 * Math.sin(t * 6.283); v *= 0.7 + 0.45 * g[i]; const k = v * 255; return [k, k, k]; });
  for (let n = 0; n < 3; n++) { const x = r.range(0, S), y = r.range(0, S), rr = r.range(7, 16) * u; L.shape((c) => { c.ellipse(x, y, rr, rr * r.range(0.5, 1.2), r.range(0, 3), 0, 6.283); }, { a: r.chance(0.5) ? '#4a0a0a' : '#2c0808', m: 0.12, alpha: r.range(0.35, 0.6), r: 0.3, h: 0.55 }); }
  for (let n = 0; n < 2; n++) { const x = r.range(0, S), y = r.range(0, S * 0.8); L.line((c) => { c.moveTo(x, y); c.lineTo(x + r.range(-4, 4), y + r.range(S * 0.1, S * 0.3)); }, { a: '#3a0707', m: 0.1, w: r.range(1.5, 4) * u, alpha: 0.7 }); }
  for (let n = 0; n < 2; n++) { const x = r.range(0, S), y = r.range(0, S), l = r.range(14, 30) * u, a0 = r.range(0, 6.28); L.line((c) => { c.moveTo(x, y); c.lineTo(x + Math.cos(a0) * l, y + Math.sin(a0) * l); }, { a: '#141414', m: 0.3, w: 2.2 * u, alpha: 0.75, h: 0.1 }); }
};
PAINT.frost = (L, S) => { // padded winter cloth dusted with frost
  PAINT.weave(L, S);
  const f = field(S, 7, 3, 171), g = field(S, 24, 1, 172), r = new RNG(173), u = S / 256;
  L.px('a', (x, y) => { const i = y * S + x; const t = ((x + y) & 3) / 3; let v = 0.78 + 0.12 * f[i] + 0.05 * Math.sin(t * 6.283); v += 0.35 * Math.max(0, g[i] - 0.62) * 2.2 * Math.max(0, f[i] - 0.35); const k = Math.min(255, v * 255); return [k * 0.96, k * 0.99, k]; });
  for (let n = 0; n < 260; n++) L.shape((c) => c.arc(r.range(0, S), r.range(0, S), r.range(0.5, 1.4) * u, 0, 6.283), { a: '#ffffff', m: 0.7, alpha: 0.7, h: 0.8 });
  L.px('r', (x, y) => 0.7 - 0.3 * g[y * S + x]);
};
PAINT.hair = (L, S) => {
  const f = field(S, 3, 2, 141), r = new RNG(142);
  L.px('a', (x, y) => { const v = 0.35 + 0.5 * f[y * S + (x * 3) % S]; const k = v * 255; return [k, k, k]; }); L.px('h', (x, y) => 0.4 + 0.4 * f[y * S + (x * 3) % S]); L.px('r', () => 0.55);
  for (let i = 0; i < 120; i++) { const x = r.range(0, S); L.line((c) => { c.moveTo(x, 0); c.lineTo(x + r.range(-6, 6), S); }, { a: r.chance(0.5) ? '#ffffff' : '#222222', h: r.range(0.3, 0.9), w: 1.2, alpha: 0.35 }); }
};
PAINT.fur = (L, S) => {
  const f = field(S, 12, 3, 151), g = field(S, 30, 1, 152);
  L.px('a', (x, y) => { const v = 0.55 + 0.45 * f[y * S + x] * (0.6 + 0.6 * g[y * S + x]); const k = Math.min(255, v * 255); return [k, k, k * 1.02]; }); L.px('h', (x, y) => 0.3 + 0.7 * f[y * S + x] * g[y * S + x]); L.px('r', () => 0.95);
};

// ---- faces: uv (0..1) maps x in [-0.10,0.10] m, y in [headY-0.13, headY+0.13] m ; eye line at v = 0.5 ; borders are plain skin
function face(L, S, o = {}) {
  const u = S / 256, cx = S / 2;
  L.px('a', () => [255, 255, 255]); L.px('m', () => 1); L.px('h', () => 0.5); L.px('r', () => o.rough ?? 0.55); L.px('e', () => 0);
  const soft = (ch, x, y, rx, ry, col, alpha) => { const c = L[ch]; c.save(); c.translate(x, y); c.scale(rx, ry); const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalAlpha = alpha; c.beginPath(); c.arc(0, 0, 1, 0, 6.283); c.fill(); c.restore(); };
  const eyeY = S * 0.5, eyeDX = S * 0.165, noseY = S * 0.665, mouthY = S * 0.775, browY = S * 0.36;
  const hollow = o.hollow ?? 0.18, ew = (o.eyeW ?? 19) * u, eh = (o.eyeH ?? 9) * u;
  // cheek blush / shading
  if (o.blush) for (const sg of [-1, 1]) soft('a', cx + sg * 50 * u, noseY + 4 * u, 22 * u, 15 * u, '#d9756a', o.blush);
  for (const sgn of [-1, 1]) {
    const ex = cx + sgn * eyeDX;
    soft('a', ex, eyeY - 2 * u, 34 * u, 22 * u, o.socket || '#6a4a3e', hollow * 2.4);
    soft('h', ex, eyeY, 30 * u, 18 * u, '#000', hollow > 0.3 ? 0.5 : 0.25);
    L.shape((c) => c.ellipse(ex, eyeY, ew, eh, 0, 0, 6.283), { a: o.sclera || '#f2efe8', m: 0, h: 0.4, r: 0.15 });
    if (o.bloodshot) for (let k = 0; k < 9; k++) L.line((c) => { const a = k / 9 * 6.283; c.moveTo(ex + Math.cos(a) * ew * 0.95, eyeY + Math.sin(a) * eh * 0.9); c.lineTo(ex + Math.cos(a) * ew * 0.45, eyeY + Math.sin(a) * eh * 0.4); }, { a: '#b02020', m: 0, w: 1.0 * u, alpha: 0.65 });
    const ix = ex + (o.lookX || 0) * u;
    L.shape((c) => c.arc(ix, eyeY, (o.irisR ?? 8.6) * u, 0, 6.283), { a: o.iris || '#3a2a20', m: 0, h: 0.35, r: 0.1, e: o.glow ? 1 : undefined });
    L.shape((c) => c.arc(ix, eyeY, (o.pupilR ?? 4.2) * u, 0, 6.283), { a: o.pupil || '#050505', m: 0, e: o.glow ? 0.25 : undefined });
    L.shape((c) => c.arc(ix + 2.6 * u, eyeY - 2.8 * u, 1.9 * u, 0, 6.283), { a: '#ffffff', m: 0, alpha: 0.85 });
    L.line((c) => { c.ellipse(ex, eyeY, ew + u, eh + u, 0, Math.PI * 1.02, Math.PI * 1.98); }, { a: o.lid || '#2a1e1a', m: 0.5, w: 2.4 * u, alpha: 0.95, h: 0.7 });
    L.line((c) => { c.ellipse(ex, eyeY, ew + u, eh + u, 0, Math.PI * 0.06, Math.PI * 0.94); }, { a: o.lid || '#4a3430', m: 0.7, w: 1.3 * u, alpha: 0.45 });
    L.line((c) => { c.moveTo(ex - sgn * ew * 1.15, browY + 5 * u * (o.browAngle || 0)); c.quadraticCurveTo(ex, browY - 8 * u + (o.browAngle || 0) * 4 * u, ex + sgn * ew * 1.05, browY + 3 * u - (o.browAngle || 0) * 6 * u); }, { a: o.brow || '#2a2018', m: 0.25, w: (o.browW || 6.5) * u, alpha: o.browA ?? 0.85, h: 0.6 });
  }
  // nose
  L.line((c) => { c.moveTo(cx - 5 * u, noseY - 30 * u); c.lineTo(cx - 7 * u, noseY - 4 * u); }, { a: '#8a6a5a', w: 4.5 * u, alpha: 0.2 });
  L.shape((c) => { c.ellipse(cx - 9 * u, noseY + 1 * u, 4.2 * u, 2.8 * u, 0, 0, 6.283); c.ellipse(cx + 9 * u, noseY + 1 * u, 4.2 * u, 2.8 * u, 0, 0, 6.283); }, { a: '#2a1814', m: 0.5, alpha: 0.7, h: 0.2 });
  soft('a', cx, noseY - 4 * u, 16 * u, 10 * u, '#a07868', 0.3);
  // mouth
  const mw = (o.mouthW || 30) * u;
  if (o.mouth === 'open') {
    const mo = (o.mouthOpen || 24) * u;
    L.shape((c) => { c.moveTo(cx - mw, mouthY); c.quadraticCurveTo(cx, mouthY - 8 * u, cx + mw, mouthY); c.quadraticCurveTo(cx + mw * 0.7, mouthY + mo, cx, mouthY + mo * 1.1); c.quadraticCurveTo(cx - mw * 0.7, mouthY + mo, cx - mw, mouthY); }, { a: o.mouthCol || '#1c0606', m: 0, h: 0.1, r: 0.3 });
    L.shape((c) => { c.rect(cx - mw * 0.8, mouthY - 3 * u, mw * 1.6, 7 * u); }, { a: o.teeth || '#d0c8a8', m: 0, alpha: 0.9, h: 0.6 });
    for (let k = -4; k <= 4; k++) L.line((c) => { c.moveTo(cx + k * mw * 0.19, mouthY - 3 * u); c.lineTo(cx + k * mw * 0.19, mouthY + 4 * u); }, { a: '#2a1a14', m: 0, w: 1.1 * u, alpha: 0.7 });
    L.shape((c) => c.ellipse(cx, mouthY + mo * 0.75, mw * 0.5, 6 * u, 0, 0, 6.283), { a: '#6a2228', m: 0, alpha: 0.85 });
  } else if (o.mouth === 'gash') {
    L.line((c) => { c.moveTo(cx - mw, mouthY + 3 * u); c.lineTo(cx - mw * 0.4, mouthY + 6 * u); c.lineTo(cx + mw * 0.3, mouthY + 4 * u); c.lineTo(cx + mw, mouthY + 1 * u); }, { a: '#1c0808', m: 0, w: 6 * u, alpha: 0.95, h: 0.2 });
    for (let k = -3; k <= 3; k++) L.line((c) => { c.moveTo(cx + k * mw * 0.28, mouthY + 2 * u); c.lineTo(cx + k * mw * 0.28 + 1.5 * u, mouthY + 7 * u); }, { a: '#cfc6a6', m: 0, w: 2.2 * u, alpha: 0.85 });
  } else {
    L.line((c) => { c.moveTo(cx - mw, mouthY + 1 * u); c.quadraticCurveTo(cx, mouthY + (o.smile ?? 3) * u, cx + mw, mouthY + 1 * u); }, { a: o.lip || '#8a4a44', m: 0.55, w: 4.6 * u, alpha: 0.95, h: 0.35 });
    L.line((c) => { c.moveTo(cx - mw * 0.7, mouthY + 7 * u); c.quadraticCurveTo(cx, mouthY + 11 * u, cx + mw * 0.7, mouthY + 7 * u); }, { a: o.lip || '#a8605a', m: 0.6, w: 3.6 * u, alpha: 0.5 });
  }
  if (o.blood) {
    L.shape((c) => { c.moveTo(cx - mw * 1.1, mouthY - 3 * u); c.quadraticCurveTo(cx, mouthY - 10 * u, cx + mw * 1.1, mouthY - 3 * u); c.lineTo(cx + mw * 1.25, mouthY + 30 * u); c.quadraticCurveTo(cx + mw * 0.2, mouthY + 58 * u, cx - mw * 1.3, mouthY + 26 * u); }, { a: o.bloodCol || '#4a0808', m: 0.0, alpha: 0.72, r: 0.25, h: 0.55 });
    for (let k = 0; k < 7; k++) { const bx = cx + (k - 3) * 9 * u; L.line((c) => { c.moveTo(bx, mouthY + 22 * u); c.lineTo(bx + (k % 2 ? 2 : -2) * u, mouthY + (38 + k * 6) * u); }, { a: '#3a0606', m: 0, w: 2.4 * u, alpha: 0.7 }); }
  }
  if (o.veins) for (let k = 0; k < o.veins; k++) { const sgn = k % 2 ? 1 : -1; const bx = cx + sgn * S * 0.3, by = S * (0.28 + 0.05 * k); L.line((c) => { c.moveTo(bx, by); c.quadraticCurveTo(bx - sgn * 16 * u, by + 22 * u, bx - sgn * 9 * u, by + 50 * u); c.moveTo(bx - sgn * 7 * u, by + 19 * u); c.lineTo(bx - sgn * 30 * u, by + 34 * u); }, { a: o.veinCol || '#4a2a5a', m: 0.3, w: 2.6 * u, alpha: 0.75, h: 0.7, e: o.veinGlow ? 1 : undefined }); }
  if (o.frost) { const r = new RNG(7); for (let k = 0; k < 200; k++) L.shape((c) => c.arc(r.range(0, S), r.range(S * 0.2, S * 0.92), r.range(0.6, 1.8) * u, 0, 6.283), { a: '#ffffff', m: 0.0, alpha: 0.55 }); }
  // hair zone (tint mask 0.5 -> palette HAIR): above the hairline, plus temples/back of head (borders map to the back of the skull)
  const hairPath = (c) => { c.moveTo(0, 0); c.lineTo(S, 0); c.lineTo(S, S * 0.62); c.lineTo(S * 0.93, S * 0.62); c.lineTo(S * 0.93, S * 0.34); c.quadraticCurveTo(S * 0.5, S * (o.hairline ?? 0.12), S * 0.07, S * 0.34); c.lineTo(S * 0.07, S * 0.62); c.lineTo(0, S * 0.62); c.closePath(); };
  if (!o.noHair) {
    L.shape(hairPath, { a: '#8a8a8a', m: 0.5, h: 0.6, r: 0.6 });
    L.clip(hairPath);
    const hr = new RNG(77); for (let k = 0; k < 90; k++) { const x = hr.range(0, S), y = hr.range(0, S * 0.5); L.line((c) => { c.moveTo(x, y); c.lineTo(x + hr.range(-5, 5), y + hr.range(S * 0.06, S * 0.2)); }, { a: hr.chance(0.5) ? '#d0d0d0' : '#4a4a4a', m: 0.5, w: 1.6 * u, alpha: 0.4, h: hr.range(0.3, 0.8) }); }
    L.unclip();
  }
  const bw = S * 0.045; for (const [ch, col] of [['a', '#ffffff'], ['m', '#ffffff'], ['h', gray(0.5)], ['e', '#000']]) { const c = L[ch]; c.fillStyle = col; c.fillRect(0, S * 0.62, bw, S * 0.38); c.fillRect(S - bw, S * 0.62, bw, S * 0.38); c.fillRect(0, S - bw, S, bw); }
}
PAINT.faceHuman = (L, S) => face(L, S, { smile: 3, blush: 0.14 });
PAINT.faceZomb = (L, S) => face(L, S, { hollow: 0.55, socket: '#2e2438', sclera: '#c8cdb0', iris: '#7a8260', pupilR: 2.2, irisR: 7.6, mouth: 'gash', blood: true, bloodshot: true, browA: 0.25, veins: 3, mouthW: 30, rough: 0.5, eyeW: 18, eyeH: 9 });
PAINT.faceIndia = (L, S) => face(L, S, { hollow: 0.5, socket: '#4a3414', sclera: '#e0d890', iris: '#6a5a20', pupilR: 2.4, irisR: 7.4, mouth: 'open', mouthOpen: 34, blood: true, bloodCol: '#5a0c0c', bloodshot: true, browA: 0.25, veins: 2, mouthW: 31, veinCol: '#6a5a1a', eyeW: 18, eyeH: 9.5 });
PAINT.faceRus = (L, S) => face(L, S, { hollow: 0.42, socket: '#243652', sclera: '#dde8f0', iris: '#7aa8d0', pupilR: 2.6, irisR: 8, mouth: 'gash', mouthCol: '#241a2a', browA: 0.45, frost: true, veins: 2, veinCol: '#506a98', lip: '#4a5a8a', mouthW: 26, browAngle: 0.6 });
PAINT.faceCebu = (L, S) => face(L, S, { hollow: 0.34, socket: '#1e3a1e', sclera: '#d8ffd0', iris: '#38ff30', glow: true, pupilR: 2.2, irisR: 9, mouth: 'gash', mouthCol: '#102a10', blood: false, veins: 4, veinCol: '#a0ffa0', veinGlow: true, browA: 0.3, eyeW: 19, eyeH: 9.5 });
PAINT.faceRobot = (L, S) => {
  const u = S / 256;
  L.px('a', () => [235, 235, 238]); L.px('m', () => 1); L.px('h', () => 0.6); L.px('r', () => 0.22); L.px('e', () => 0);
  L.shape((c) => { c.moveTo(S * 0.1, S * 0.4); c.quadraticCurveTo(S * 0.5, S * 0.32, S * 0.9, S * 0.4); c.lineTo(S * 0.86, S * 0.64); c.quadraticCurveTo(S * 0.5, S * 0.72, S * 0.14, S * 0.64); c.closePath(); }, { a: '#05070c', m: 0, h: 0.3, r: 0.06 });
  L.shape((c) => { c.moveTo(S * 0.2, S * 0.49); c.quadraticCurveTo(S * 0.5, S * 0.45, S * 0.8, S * 0.49); c.lineTo(S * 0.78, S * 0.57); c.quadraticCurveTo(S * 0.5, S * 0.61, S * 0.22, S * 0.57); c.closePath(); }, { a: '#4ac8ff', m: 0, e: 1 });
  L.shape((c) => { c.moveTo(S * 0.3, S * 0.5); c.quadraticCurveTo(S * 0.5, S * 0.48, S * 0.7, S * 0.5); c.lineTo(S * 0.7, S * 0.54); c.quadraticCurveTo(S * 0.5, S * 0.56, S * 0.3, S * 0.54); c.closePath(); }, { a: '#e0f8ff', m: 0, e: 1 });
  L.line((c) => { c.moveTo(S * 0.5, S * 0.78); c.lineTo(S * 0.5, S * 0.9); }, { a: '#9a9fa6', w: 2 * u, h: 0.2 });
  const bw = S * 0.045; for (const [ch, col] of [['a', '#ebebee'], ['m', '#ffffff'], ['h', gray(0.6)], ['e', '#000']]) { const c = L[ch]; c.fillStyle = col; c.fillRect(0, 0, bw, S); c.fillRect(S - bw, 0, bw, S); c.fillRect(0, 0, S, bw); c.fillRect(0, S - bw, S, bw); }
};

const ORDER = ['weave', 'camo', 'knit', 'denim', 'leather', 'metal', 'skin', 'fleshUS', 'fleshIN', 'fleshDE', 'circuit', 'faceHuman', 'faceZomb', 'faceRobot', 'robotShell', 'molle', 'faceCebu', 'faceIndia', 'hair', 'fur', 'faceRus', 'fleshRU', 'gore', 'frost'];
const NSTRENGTH = { weave: 2.2, camo: 1.2, knit: 3.5, denim: 2.4, leather: 3, metal: 1.2, skin: 1.2, fleshUS: 4, fleshIN: 3, fleshDE: 4, fleshRU: 2.5, circuit: 2, faceHuman: 2.2, faceZomb: 3, faceRobot: 1.5, faceCebu: 2.5, faceIndia: 3, faceRus: 3, robotShell: 1.8, gore: 2, frost: 2.5, molle: 1.4, hair: 2.5, fur: 4 };

/** Build (cached) texture arrays. size follows Q.texSize (128 on phones, 256 otherwise). */
export function getCrowdTextures() {
  return cached('crowd-textures-v1-' + Q.level, () => {
    const S = Q.texSize <= 256 ? (Q.level === 0 ? 128 : 256) : 256;
    const alb = new Uint8Array(S * S * 4 * NLAYER), nor = new Uint8Array(S * S * 4 * NLAYER);
    for (let li = 0; li < NLAYER; li++) {
      const name = ORDER[li]; const L = new LayerCtx(S);
      PAINT[name](L, S);
      const A = L.a.getImageData(0, 0, S, S).data, M = L.m.getImageData(0, 0, S, S).data, Hh = L.h.getImageData(0, 0, S, S).data, R = L.r.getImageData(0, 0, S, S).data, E = L.e.getImageData(0, 0, S, S).data;
      const k = NSTRENGTH[name] || 2; const base = li * S * S * 4; const H = (x, y) => Hh[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        alb[base + i] = A[i]; alb[base + i + 1] = A[i + 1]; alb[base + i + 2] = A[i + 2]; alb[base + i + 3] = M[i];
        const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1);
        nor[base + i] = (-dx / l * 0.5 + 0.5) * 255; nor[base + i + 1] = (dy / l * 0.5 + 0.5) * 255; nor[base + i + 2] = R[i]; nor[base + i + 3] = E[i];
      }
    }
    const mk = (data, srgb) => { const t = new THREE.DataArrayTexture(data, S, S, NLAYER); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = Q.level >= 2 ? 4 : 2; t.needsUpdate = true; t.userData.shared = true; return t; };
    const out = { alb: mk(alb, true), nor: mk(nor, false), size: S, normStrength: 1.0 };
    out.userData = { shared: true };
    return out;
  });
}
export const LAYER_NAMES = ORDER;
