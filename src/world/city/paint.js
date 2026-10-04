// Canvas painting toolkit for city textures. A "Layers" object paints the same tile into 3 canvases at once:
//   col  : albedo (sRGB)
//   emi  : emissive (night lights)   -> emissiveMap
//   dat  : data  R = height (bumpMap), G = roughness, B = metalness  -> bumpMap / roughnessMap / metalnessMap
// All coordinates are in METRES (top-left origin) so painters are resolution independent.
import * as THREE from 'three';
import { RNG } from '../../engine/common.js';
import { fbm2, makeCanvas, texFromCanvas, cached } from '../../engine/proc.js';

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
export const rgba = (c, a = 1) => { const col = new THREE.Color(c); return `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`; };
/** colour string/hex -> '#rrggbb' in sRGB, scaled by k and shifted */
export function shade(c, k = 1, add = 0) { const col = new THREE.Color(c); return `rgb(${clamp255(col.r * 255 * k + add)},${clamp255(col.g * 255 * k + add)},${clamp255(col.b * 255 * k + add)})`; }
export function lerpCol(a, b, t) { const A = new THREE.Color(a), B = new THREE.Color(b); A.lerp(B, t); return `rgb(${clamp255(A.r * 255)},${clamp255(A.g * 255)},${clamp255(A.b * 255)})`; }
export const dat = (h, r = 210, m = 0) => `rgb(${clamp255(h)},${clamp255(r)},${clamp255(m)})`;

/** tileable greyscale noise canvas (values 0..1 -> grey), cached by params */
export function noiseCanvas(size = 128, scale = 4, seed = 0, oct = 4) {
  return cached(`city.noise.${size}.${scale}.${seed}.${oct}`, () => {
    const c = makeCanvas(size, size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data; const o = seed * 13.37;
    const f = (u, v) => fbm2(u * scale + o, v * scale + o, oct);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size; // tileable: blend four shifted samples
      const n = f(u, v) * (1 - u) * (1 - v) + f(u - 1, v) * u * (1 - v) + f(u, v - 1) * (1 - u) * v + f(u - 1, v - 1) * u * v;
      // blending shrinks contrast in the middle: re-expand
      const g = clamp255(((n - 0.5) * 1.9 + 0.5) * 255); const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); c.userData = { shared: true }; return c;
  });
}

export class Layers {
  constructor(tw, th, ppm) {
    this.tw = tw; this.th = th; this.ppm = ppm; this.W = Math.max(8, Math.round(tw * ppm)); this.H = Math.max(8, Math.round(th * ppm));
    this.canvases = {}; this.ctx = {};
    for (const k of ['col', 'emi', 'dat']) { const c = makeCanvas(this.W, this.H); this.canvases[k] = c; this.ctx[k] = c.getContext('2d'); }
    this.ctx.emi.fillStyle = '#000'; this.ctx.emi.fillRect(0, 0, this.W, this.H);
    this.ctx.dat.fillStyle = dat(140, 215, 0); this.ctx.dat.fillRect(0, 0, this.W, this.H);
    this.rng = new RNG(1);
  }
  /** metres -> pixels */
  p(m) { return m * this.ppm; }
  /** paint a rect in metres. c = colour (or null), d = data fill string (use dat(h,r,m)) or null, e = emissive colour or null */
  rect(x, y, w, h, c, d, e) {
    const P = this.ppm;
    if (c) { this.ctx.col.fillStyle = c; this.ctx.col.fillRect(x * P, y * P, w * P, h * P); }
    if (d) { this.ctx.dat.fillStyle = d; this.ctx.dat.fillRect(x * P, y * P, w * P, h * P); }
    if (e) { this.ctx.emi.fillStyle = e; this.ctx.emi.fillRect(x * P, y * P, w * P, h * P); }
  }
  /** vertical linear gradient rect on col (stops [[0,'#..'],[1,'#..']]) */
  vgrad(x, y, w, h, stops, layer = 'col') {
    const P = this.ppm, ctx = this.ctx[layer]; const g = ctx.createLinearGradient(0, y * P, 0, (y + h) * P); for (const s of stops) g.addColorStop(s[0], s[1]);
    ctx.fillStyle = g; ctx.fillRect(x * P, y * P, w * P, h * P);
  }
  hgrad(x, y, w, h, stops, layer = 'col') {
    const P = this.ppm, ctx = this.ctx[layer]; const g = ctx.createLinearGradient(x * P, 0, (x + w) * P, 0); for (const s of stops) g.addColorStop(s[0], s[1]);
    ctx.fillStyle = g; ctx.fillRect(x * P, y * P, w * P, h * P);
  }
  poly(pts, c, d, e) {
    const P = this.ppm;
    const path = (ctx) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0] * P, q[1] * P) : ctx.moveTo(q[0] * P, q[1] * P))); ctx.closePath(); };
    if (c) { path(this.ctx.col); this.ctx.col.fillStyle = c; this.ctx.col.fill(); }
    if (d) { path(this.ctx.dat); this.ctx.dat.fillStyle = d; this.ctx.dat.fill(); }
    if (e) { path(this.ctx.emi); this.ctx.emi.fillStyle = e; this.ctx.emi.fill(); }
  }
  line(x0, y0, x1, y1, wm, c, d, e) {
    const P = this.ppm;
    for (const [k, col] of [['col', c], ['dat', d], ['emi', e]]) { if (!col) continue; const ctx = this.ctx[k]; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, wm * P); ctx.beginPath(); ctx.moveTo(x0 * P, y0 * P); ctx.lineTo(x1 * P, y1 * P); ctx.stroke(); }
  }
  /** semi-transparent vertical streak (rain stain) from (x,y) downwards, on colour layer only */
  streak(x, y, w, len, alpha = 0.18, color = '#2a2218') {
    const P = this.ppm, ctx = this.ctx.col; const g = ctx.createLinearGradient(0, y * P, 0, (y + len) * P);
    g.addColorStop(0, rgba(color, alpha)); g.addColorStop(0.6, rgba(color, alpha * 0.6)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect((x - w / 2) * P, y * P, w * P, len * P);
  }
  /** soft blob (stain, mould, patch) with wrap-around so the tile stays seamless */
  blob(x, y, r, color, alpha = 0.2, sy = 1) {
    const P = this.ppm, ctx = this.ctx.col;
    for (const ox of [-this.tw, 0, this.tw]) for (const oy of [-this.th, 0, this.th]) {
      const cx = (x + ox) * P, cy = (y + oy) * P, rr = r * P; if (cx + rr < 0 || cx - rr > this.W || cy + rr * sy < 0 || cy - rr * sy > this.H) continue;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, sy); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr); g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(-rr, -rr, rr * 2, rr * 2); ctx.restore();
    }
  }
  /** multiply/overlay a tileable noise on the colour layer. lo..hi = grey range (1 = no change) */
  mottle(scale = 4, seed = 1, lo = 0.78, hi = 1, mode = 'multiply', alpha = 1) {
    const nc = noiseCanvas(128, scale, seed, 4); const ctx = this.ctx.col; const t = makeCanvas(128, 128); const tc = t.getContext('2d'); tc.drawImage(nc, 0, 0);
    // remap grey to [lo,hi]
    tc.globalCompositeOperation = 'source-over'; const id = tc.getImageData(0, 0, 128, 128); const d = id.data; for (let i = 0; i < d.length; i += 4) { const g = d[i] / 255; const v = clamp255((lo + (hi - lo) * g) * 255); d[i] = d[i + 1] = d[i + 2] = v; } tc.putImageData(id, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(t, 0, 0, this.W, this.H); ctx.restore();
  }
  /** same noise modulating the data layer (adds roughness/height variation) */
  mottleDat(scale = 6, seed = 2, amount = 0.3) {
    const nc = noiseCanvas(128, scale, seed, 4); const ctx = this.ctx.dat; ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amount; ctx.drawImage(nc, 0, 0, this.W, this.H); ctx.restore();
  }
  grain(count = 4000, alpha = [0.05, 0.2], size = [0.5, 1.6], colors = ['#000', '#fff', '#554']) {
    const ctx = this.ctx.col, r = this.rng; ctx.save();
    for (let i = 0; i < count; i++) { ctx.globalAlpha = r.range(alpha[0], alpha[1]); ctx.fillStyle = r.pick(colors); const s = r.range(size[0], size[1]); ctx.fillRect(r.range(0, this.W), r.range(0, this.H), s, s); }
    ctx.restore();
  }
  /** make 3 Three textures */
  textures({ emissive = true, aniso = 8 } = {}) {
    const mk = (c, srgb) => { const t = texFromCanvas(c, { srgb, aniso }); t.userData.shared = true; return t; };
    return { map: mk(this.canvases.col, true), emi: emissive ? mk(this.canvases.emi, true) : null, data: mk(this.canvases.dat, false), W: this.W, H: this.H };
  }
}

/** pick helper */
export const pickW = (rng, items) => { let tot = 0; for (const it of items) tot += it[1]; let r = rng.next() * tot; for (const it of items) { r -= it[1]; if (r <= 0) return it[0]; } return items[items.length - 1][0]; };
