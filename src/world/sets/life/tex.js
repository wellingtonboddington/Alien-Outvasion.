// Procedural texture painters for the "everyday life" sets. All textures are deterministic, cached and shared between sets.
// Convention: tile textures are painted in near-neutral light tones; the materials tint them with `color`.
import * as THREE from 'three';
import { RNG, Q, TAU } from '../../../engine/common.js';
import { makeCanvas, texFromCanvas, heightToNormalCanvas, cached, noise2, fbm2, voronoi2 } from '../../../engine/proc.js';

export const res = (n = 512) => Math.min(n, Q.texSize);
export const rgba = (c, a = 1) => { const col = new THREE.Color(c); return `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`; };

/** per-pixel white-ish grain (tileable by construction) */
export function grain(ctx, w, h, amt = 10, seed = 1) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data; const r = new RNG(seed);
  for (let i = 0; i < d.length; i += 4) { const n = (r.next() - 0.5) * 2 * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}
/** big soft wrapped blobs for low-frequency mottling (tileable) */
export function blobs(ctx, w, h, { n = 40, rmin = 20, rmax = 90, colors = ['#000'], alpha = [0.03, 0.1], seed = 1 } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const x = r.range(0, w), y = r.range(0, h), rad = r.range(rmin, rmax), col = r.pick(colors), a = r.range(alpha[0], alpha[1]);
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      const cx = x + ox, cy = y + oy; if (cx + rad < 0 || cx - rad > w || cy + rad < 0 || cy - rad > h) continue;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
  }
}
export function specks(ctx, w, h, { n = 2000, size = [0.6, 2], colors = ['#000'], alpha = [0.1, 0.4], seed = 1 } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) { ctx.globalAlpha = r.range(alpha[0], alpha[1]); ctx.fillStyle = r.pick(colors); const s = r.range(size[0], size[1]); ctx.fillRect(r.range(0, w), r.range(0, h), s, s); }
  ctx.globalAlpha = 1;
}
/** thin wandering crack/scratch lines */
export function cracks(ctx, w, h, { n = 6, len = 80, color = '#000', alpha = 0.3, width = 1, seed = 1 } = {}) {
  const r = new RNG(seed); ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = width; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { let x = r.range(0, w), y = r.range(0, h), a = r.range(0, TAU); ctx.beginPath(); ctx.moveTo(x, y);
    const L = r.range(len * 0.4, len); for (let s = 0; s < L; s += 4) { a += r.range(-0.5, 0.5); x += Math.cos(a) * 4; y += Math.sin(a) * 4; ctx.lineTo(x, y); } ctx.stroke(); }
}
const mk = (key, w, h, draw, opts = {}) => cached(`life:${key}:${w}x${h}`, () => {
  const c = makeCanvas(w, h); const ctx = c.getContext('2d'); draw(ctx, w, h, c); return texFromCanvas(c, { aniso: 4, ...opts });
});
const mkNormal = (key, w, h, drawHeight, strength, opts = {}) => cached(`life:${key}:n:${w}x${h}`, () => {
  const c = makeCanvas(w, h); const ctx = c.getContext('2d'); drawHeight(ctx, w, h); return texFromCanvas(heightToNormalCanvas(c, strength), { srgb: false, aniso: 4, ...opts });
});

// ---------------------------------------------------------------- painters
const P = {};
P.plaster = (ctx, w, h) => {
  ctx.fillStyle = '#e8e4da'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 50, rmin: w * 0.06, rmax: w * 0.28, colors: ['#bdb6a6', '#fffaf0', '#cfd3d0'], alpha: [0.05, 0.14], seed: 3 });
  grain(ctx, w, h, 7, 5); specks(ctx, w, h, { n: w * 3, colors: ['#8a8478', '#fff'], alpha: [0.08, 0.3], seed: 7 });
  cracks(ctx, w, h, { n: 3, len: w * 0.2, color: '#6e675c', alpha: 0.12, seed: 9 });
};
P.tileWall = (ctx, w, h) => {
  const n = 8, s = w / n, r = new RNG(11); ctx.fillStyle = '#9ea5a1'; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = r.range(-6, 6), x = i * s, y = j * s, g = ctx.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, `rgb(${236 + v},${240 + v},${238 + v})`); g.addColorStop(1, `rgb(${214 + v},${220 + v},${218 + v})`);
    ctx.fillStyle = g; ctx.fillRect(x + 1.5, y + 1.5, s - 3, s - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + 1.5, y + 1.5, s - 3, 1.4); ctx.fillRect(x + 1.5, y + 1.5, 1.4, s - 3);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + 1.5, y + s - 3, s - 3, 1.4); ctx.fillRect(x + s - 3, y + 1.5, 1.4, s - 3);
    if (r.chance(0.08)) { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(x + 2, y + 2, s - 4, s - 4); }
  }
  blobs(ctx, w, h, { n: 25, rmin: 20, rmax: w * 0.2, colors: ['#7a7f68', '#cfd8d2'], alpha: [0.03, 0.09], seed: 5 });
  grain(ctx, w, h, 4, 2); specks(ctx, w, h, { n: 500, colors: ['#555'], alpha: [0.05, 0.18], seed: 4 });
};
P.tileWallH = (ctx, w, h) => {
  const n = 8, s = w / n; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff';
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const g = ctx.createLinearGradient(i * s, j * s, i * s + s, j * s + s); g.addColorStop(0, '#fff'); g.addColorStop(1, '#dcdcdc'); ctx.fillStyle = g; ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
};
P.tileFloor = (ctx, w, h) => {
  const n = 4, s = w / n, r = new RNG(21); ctx.fillStyle = '#5c625e'; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = r.range(-8, 8), x = i * s, y = j * s; ctx.fillStyle = `rgb(${158 + v},${167 + v},${162 + v})`; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 2, y + 2, s - 4, 2); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 2, y + s - 4, s - 4, 2);
  }
  blobs(ctx, w, h, { n: 40, rmin: 20, rmax: w * 0.22, colors: ['#8a928e', '#e3ebe6', '#a29a7a'], alpha: [0.03, 0.08], seed: 8 });
  specks(ctx, w, h, { n: w * 6, size: [0.6, 2.4], colors: ['#fff', '#2a2f2c', '#a5afa8', '#6d756f'], alpha: [0.2, 0.55], seed: 6 });
  grain(ctx, w, h, 6, 3);
  cracks(ctx, w, h, { n: 2, len: w * 0.1, color: '#444', alpha: 0.1, seed: 12 });
};
P.tileFloorH = (ctx, w, h) => { const n = 4, s = w / n; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#e0e0e0'; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); specks(ctx, w, h, { n: 2500, colors: ['#fff', '#444'], alpha: [0.2, 0.5], seed: 3 }); };
P.checker = (ctx, w, h) => {
  const s = w / 2; ctx.fillStyle = '#bfbfb8'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#222428'; ctx.fillRect(0, 0, s, s); ctx.fillRect(s, s, s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(s - 1, 0, 2, h); ctx.fillRect(0, s - 1, w, 2); ctx.fillRect(0, 0, 2, h); ctx.fillRect(0, 0, w, 2);
  blobs(ctx, w, h, { n: 30, rmin: 20, rmax: w * 0.25, colors: ['#000', '#fff'], alpha: [0.03, 0.1], seed: 3 });
  specks(ctx, w, h, { n: w * 3, colors: ['#fff', '#000'], alpha: [0.05, 0.3], seed: 4 }); cracks(ctx, w, h, { n: 14, len: 40, color: '#fff', alpha: 0.12, seed: 2 }); grain(ctx, w, h, 5, 1);
};
P.marble = (ctx, w, h) => {
  const img = ctx.createImageData(w, h), d = img.data, s = w / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w * 3, v = y / h * 3; const n = fbm2(u * 1.4, v * 1.4, 4); const vein = Math.pow(1 - Math.abs(noise2(u * 2 + n * 2, v * 2 - n * 1.5) * 1.6), 6);
    let c = 218 + (n - 0.5) * 34 - vein * 55; const i = (y * w + x) * 4; d[i] = c; d[i + 1] = c - 4 + vein * 4; d[i + 2] = c - 14; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); ctx.fillStyle = 'rgba(70,64,56,0.55)'; ctx.fillRect(s - 1, 0, 2, h); ctx.fillRect(0, s - 1, w, 2); ctx.fillRect(0, 0, 1.5, h); ctx.fillRect(0, 0, w, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(s + 1, 0, 1, h); ctx.fillRect(0, s + 1, w, 1);
  grain(ctx, w, h, 3, 4);
};
P.woodPlank = (ctx, w, h) => {
  const n = 8, ph = h / n, r = new RNG(31); ctx.fillStyle = '#2b1f16'; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < n; j++) {
    const y = j * ph, v = r.range(-16, 16); const g = ctx.createLinearGradient(0, y, 0, y + ph);
    g.addColorStop(0, `rgb(${172 + v},${140 + v},${104 + v})`); g.addColorStop(0.5, `rgb(${184 + v},${150 + v},${112 + v})`); g.addColorStop(1, `rgb(${166 + v},${134 + v},${98 + v})`);
    ctx.fillStyle = g; ctx.fillRect(0, y + 1, w, ph - 2);
    for (let k = 0; k < 40; k++) { const yy = y + r.range(1, ph - 1); ctx.strokeStyle = r.chance(0.6) ? `rgba(60,38,20,${r.range(0.05, 0.22)})` : `rgba(255,230,190,${r.range(0.04, 0.12)})`; ctx.lineWidth = r.range(0.4, 1.4); ctx.beginPath(); ctx.moveTo(0, yy);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, yy + Math.sin(x * 0.02 + k) * 1.4 + noise2(x * 0.01, k) * 2); ctx.stroke(); }
    if (r.chance(0.6)) { const kx = r.range(40, w - 40), ky = y + r.range(ph * 0.3, ph * 0.7); for (let q = 3; q > 0; q--) { ctx.strokeStyle = `rgba(50,30,15,${0.25 / q + 0.05})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(kx, ky, 3 + q * 4, 1.5 + q * 1.6, 0, 0, TAU); ctx.stroke(); } }
    const jx = r.range(0, w); ctx.fillStyle = 'rgba(20,12,6,0.7)'; ctx.fillRect(jx, y, 1.5, ph); if (r.chance(0.5)) ctx.fillRect((jx + w / 2) % w, y, 1.5, ph);
  }
  blobs(ctx, w, h, { n: 30, rmin: 20, rmax: w * 0.25, colors: ['#3a2410', '#d8b585'], alpha: [0.05, 0.14], seed: 6 }); grain(ctx, w, h, 5, 2);
};
P.woodPlankH = (ctx, w, h) => { const n = 8, ph = h / n, r = new RNG(31); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); for (let j = 0; j < n; j++) { ctx.fillStyle = '#ddd'; ctx.fillRect(0, j * ph + 1.5, w, ph - 3); for (let k = 0; k < 30; k++) { ctx.fillStyle = `rgba(0,0,0,${r.range(0.1, 0.4)})`; ctx.fillRect(0, j * ph + r.range(2, ph - 2), w, 1); } } };
P.woodGrain = (ctx, w, h) => {
  const r = new RNG(41); ctx.fillStyle = '#9b7650'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 40, rmin: 20, rmax: w * 0.3, colors: ['#7a5535', '#b8905f', '#6a4528'], alpha: [0.1, 0.28], seed: 9 });
  for (let k = 0; k < w / 2.2; k++) { const x = r.range(0, w); ctx.strokeStyle = r.chance(0.55) ? `rgba(55,32,14,${r.range(0.06, 0.3)})` : `rgba(235,200,150,${r.range(0.05, 0.16)})`; ctx.lineWidth = r.range(0.5, 1.8); ctx.beginPath(); ctx.moveTo(x, 0); for (let y = 0; y <= h; y += 14) ctx.lineTo(x + Math.sin(y * 0.012 + k * 0.7) * 3 + noise2(k * 0.3, y * 0.01) * 5, y); ctx.stroke(); }
  for (let q = 0; q < 3; q++) { const kx = r.range(40, w - 40), ky = r.range(40, h - 40); for (let i = 5; i > 0; i--) { ctx.strokeStyle = `rgba(45,25,10,${0.07 + 0.05 * (5 - i)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(kx, ky, 4 + i * 3, 9 + i * 6, 0, 0, TAU); ctx.stroke(); } }
  grain(ctx, w, h, 5, 4);
};
P.brick = (ctx, w, h) => {
  const cols = 4, rows = 11, bw = w / cols, bh = h / rows, r = new RNG(51); ctx.fillStyle = '#a9a294'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 20, rmin: 20, rmax: 70, colors: ['#8a8374', '#c8c0b0'], alpha: [0.1, 0.25], seed: 2 });
  for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) {
    const off = (j % 2) * bw / 2, x = i * bw + off, y = j * bh, v = r.range(-22, 22), rr = 150 + v, gg = 66 + v * 0.55, bb = 48 + v * 0.4;
    const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, `rgb(${rr + 12},${gg + 8},${bb + 6})`); g.addColorStop(1, `rgb(${rr - 14},${gg - 6},${bb - 4})`);
    for (const ox of [0, w]) { ctx.fillStyle = g; ctx.fillRect(x + 3 - ox, y + 3, bw - 6, bh - 6); ctx.fillStyle = 'rgba(255,200,170,0.18)'; ctx.fillRect(x + 3 - ox, y + 3, bw - 6, 2); }
    for (let k = 0; k < 12; k++) { ctx.fillStyle = `rgba(${r.chance(0.5) ? '40,16,8' : '210,140,100'},${r.range(0.06, 0.25)})`; ctx.fillRect(x + r.range(4, bw - 8), y + r.range(4, bh - 8), r.range(2, 12), r.range(1, 3)); }
  }
  blobs(ctx, w, h, { n: 24, rmin: 30, rmax: 110, colors: ['#1a0e08', '#e0d0c0'], alpha: [0.05, 0.16], seed: 4 }); grain(ctx, w, h, 8, 3);
};
P.brickH = (ctx, w, h) => {
  const cols = 4, rows = 11, bw = w / cols, bh = h / rows, r = new RNG(52); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) { const off = (j % 2) * bw / 2, x = i * bw + off, y = j * bh; ctx.fillStyle = `rgb(${200 + r.range(-30, 30)},${200},${200})`; for (const ox of [0, w]) ctx.fillRect(x + 3 - ox, y + 3, bw - 6, bh - 6); }
  specks(ctx, w, h, { n: 4000, colors: ['#000', '#fff'], alpha: [0.1, 0.35], seed: 5 });
};
P.concrete = (ctx, w, h) => {
  ctx.fillStyle = '#9b9b96'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 70, rmin: w * 0.05, rmax: w * 0.3, colors: ['#6f6f6a', '#c3c2bb', '#85867f', '#a29a8c'], alpha: [0.06, 0.18], seed: 3 });
  grain(ctx, w, h, 12, 4); specks(ctx, w, h, { n: w * 5, size: [0.6, 3], colors: ['#333', '#ddd', '#555'], alpha: [0.1, 0.45], seed: 6 });
  cracks(ctx, w, h, { n: 5, len: w * 0.4, color: '#2a2a28', alpha: 0.35, width: 1.2, seed: 7 });
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, w, 1.5); ctx.fillRect(0, 0, 1.5, h);
};
P.concreteH = (ctx, w, h) => { ctx.fillStyle = '#777'; ctx.fillRect(0, 0, w, h); specks(ctx, w, h, { n: w * 14, size: [0.8, 3], colors: ['#000', '#fff', '#ccc'], alpha: [0.1, 0.6], seed: 8 }); blobs(ctx, w, h, { n: 40, rmin: 10, rmax: 60, colors: ['#000', '#fff'], alpha: [0.05, 0.2], seed: 2 }); cracks(ctx, w, h, { n: 5, len: w * 0.4, color: '#000', alpha: 0.8, width: 1.4, seed: 7 }); };
P.asphalt = (ctx, w, h) => {
  ctx.fillStyle = '#6a6b70'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 60, rmin: 20, rmax: w * 0.25, colors: ['#4a4b50', '#7e7f84', '#6e6a64'], alpha: [0.1, 0.3], seed: 5 });
  grain(ctx, w, h, 20, 3); specks(ctx, w, h, { n: w * 8, size: [0.8, 2.6], colors: ['#8a8a8e', '#c8c8c8', '#15151a', '#6b6258'], alpha: [0.25, 0.7], seed: 4 });
  cracks(ctx, w, h, { n: 5, len: w * 0.5, color: '#0a0a0c', alpha: 0.55, width: 1.4, seed: 9 });
};
P.steel = (ctx, w, h) => {
  const r = new RNG(61); ctx.fillStyle = '#b4babe'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 30, rmin: 30, rmax: w * 0.3, colors: ['#8e949a', '#dde2e6'], alpha: [0.1, 0.25], seed: 3 });
  for (let i = 0; i < h * 1.2; i++) { const y = r.range(0, h), x = r.range(0, w), L = r.range(w * 0.2, w * 0.9); ctx.strokeStyle = r.chance(0.5) ? `rgba(255,255,255,${r.range(0.04, 0.2)})` : `rgba(40,45,50,${r.range(0.04, 0.16)})`; ctx.lineWidth = r.range(0.4, 1.2); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y + r.range(-0.3, 0.3)); if (x + L > w) { ctx.moveTo(x - w, y); ctx.lineTo(x + L - w, y); } ctx.stroke(); }
  grain(ctx, w, h, 5, 2);
};
P.steelH = (ctx, w, h) => { const r = new RNG(62); ctx.fillStyle = '#888'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < h * 2; i++) { const y = r.range(0, h), x = r.range(0, w), L = r.range(w * 0.1, w * 0.8); ctx.strokeStyle = r.chance(0.5) ? `rgba(255,255,255,${r.range(0.05, 0.3)})` : `rgba(0,0,0,${r.range(0.05, 0.3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y); ctx.stroke(); } };
P.diamond = (ctx, w, h) => {
  ctx.fillStyle = '#8f959a'; ctx.fillRect(0, 0, w, h); const n = 8, sx = w / n, sy = h / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) for (const [ox, oy, rot] of [[0, 0, 0.78], [0.5, 0.5, -0.78]]) {
    ctx.save(); ctx.translate((i + ox + 0.25) * sx, (j + oy + 0.25) * sy); ctx.rotate(rot); const g = ctx.createLinearGradient(-sx * 0.25, 0, sx * 0.25, 0); g.addColorStop(0, '#d8dde0'); g.addColorStop(1, '#6a7076'); ctx.fillStyle = g; ctx.fillRect(-sx * 0.22, -sy * 0.06, sx * 0.44, sy * 0.12); ctx.restore();
  }
  grain(ctx, w, h, 6, 3); blobs(ctx, w, h, { n: 20, rmin: 20, rmax: w * 0.2, colors: ['#2a2d30'], alpha: [0.05, 0.15], seed: 3 });
};
P.diamondH = (ctx, w, h) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h); const n = 8, sx = w / n, sy = h / n; ctx.fillStyle = '#fff'; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) for (const [ox, oy, rot] of [[0, 0, 0.78], [0.5, 0.5, -0.78]]) { ctx.save(); ctx.translate((i + ox + 0.25) * sx, (j + oy + 0.25) * sy); ctx.rotate(rot); ctx.fillRect(-sx * 0.22, -sy * 0.06, sx * 0.44, sy * 0.12); ctx.restore(); } };
P.carpet = (ctx, w, h) => {
  ctx.fillStyle = '#8a8d92'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 40, rmin: 20, rmax: w * 0.25, colors: ['#6a6d72', '#a9acb2'], alpha: [0.08, 0.2], seed: 4 });
  grain(ctx, w, h, 22, 2); specks(ctx, w, h, { n: w * 10, size: [0.8, 1.6], colors: ['#fff', '#000'], alpha: [0.05, 0.2], seed: 3 });
  for (let y = 0; y < h; y += 4) { ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, y, w, 1); }
};
P.fabric = (ctx, w, h) => {
  ctx.fillStyle = '#b4b4b4'; ctx.fillRect(0, 0, w, h); const s = w / 64;
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const a = (i + j) % 2; ctx.fillStyle = a ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.13)'; ctx.fillRect(i * s, j * s, s, s * 0.5); ctx.fillStyle = a ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.1)'; ctx.fillRect(i * s, j * s + s * 0.5, s * 0.5, s * 0.5); }
  grain(ctx, w, h, 14, 5); blobs(ctx, w, h, { n: 12, rmin: 30, rmax: w * 0.3, colors: ['#000', '#fff'], alpha: [0.04, 0.1], seed: 3 });
};
P.leather = (ctx, w, h) => {
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = voronoi2(x / w * 22, y / h * 22, 3); const e = Math.min(1, (v.d2 - v.d1) * 3.5); const c = 150 + e * 40 + (fbm2(x / w * 6, y / h * 6, 3) - 0.5) * 30; const i = (y * w + x) * 4; d[i] = c; d[i + 1] = c; d[i + 2] = c; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
};
P.leatherH = (ctx, w, h) => { const img = ctx.createImageData(w, h), d = img.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = voronoi2(x / w * 22, y / h * 22, 3); const e = Math.min(1, (v.d2 - v.d1) * 3.5); const c = 90 + e * 160; const i = (y * w + x) * 4; d[i] = c; d[i + 1] = c; d[i + 2] = c; d[i + 3] = 255; } ctx.putImageData(img, 0, 0); };
P.corrugated = (ctx, w, h) => {
  const n = 8, s = w / n; for (let i = 0; i < n; i++) { const g = ctx.createLinearGradient(i * s, 0, (i + 1) * s, 0); g.addColorStop(0, '#6a6e72'); g.addColorStop(0.35, '#d0d4d8'); g.addColorStop(0.55, '#b6babe'); g.addColorStop(1, '#5a5e62'); ctx.fillStyle = g; ctx.fillRect(i * s, 0, s, h); }
  blobs(ctx, w, h, { n: 40, rmin: 20, rmax: w * 0.25, colors: ['#7a4a2a', '#3a2a1a', '#a8754a'], alpha: [0.05, 0.2], seed: 7 }); grain(ctx, w, h, 8, 2);
  for (let i = 0; i < 6; i++) { const x = (i + 0.5) * w / 6; ctx.fillStyle = '#44484c'; ctx.beginPath(); ctx.arc(x, h * 0.12, 3, 0, TAU); ctx.fill(); }
};
P.corrugatedH = (ctx, w, h) => { const n = 8, s = w / n; for (let i = 0; i < n; i++) { const g = ctx.createLinearGradient(i * s, 0, (i + 1) * s, 0); g.addColorStop(0, '#000'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#000'); ctx.fillStyle = g; ctx.fillRect(i * s, 0, s, h); } };
P.ceilTile = (ctx, w, h) => {
  const r = new RNG(71); ctx.fillStyle = '#d6d5cc'; ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 10, 3); for (let i = 0; i < w * 6; i++) { ctx.fillStyle = `rgba(${r.chance(0.5) ? '90,88,80' : '255,255,250'},${r.range(0.1, 0.4)})`; ctx.fillRect(r.range(0, w), r.range(0, h), r.range(1, 4), r.range(0.6, 1.2)); }
  blobs(ctx, w, h, { n: 20, rmin: 20, rmax: w * 0.2, colors: ['#8a7a5a', '#fff'], alpha: [0.03, 0.1], seed: 3 });
  ctx.fillStyle = '#a5a49c'; const t = Math.max(2, w / 128); ctx.fillRect(0, 0, w, t); ctx.fillRect(0, 0, t, h); ctx.fillRect(w / 2 - t / 2, 0, t, h); ctx.fillRect(0, h / 2 - t / 2, w, t);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, t, w, 1); ctx.fillRect(t, 0, 1, h);
};
P.rubber = (ctx, w, h) => { ctx.fillStyle = '#26282a'; ctx.fillRect(0, 0, w, h); const n = 10, s = w / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc((i + 0.5) * s, (j + 0.5) * s, s * 0.32, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); } grain(ctx, w, h, 10, 2); };
P.tarp = (ctx, w, h) => {
  ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, w, h); const r = new RNG(81);
  blobs(ctx, w, h, { n: 30, rmin: 20, rmax: w * 0.25, colors: ['#000', '#fff'], alpha: [0.05, 0.14], seed: 3 });
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; for (let i = 0; i < w; i += 3) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); } for (let j = 0; j < h; j += 3) { ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(w / 2 - 1, 0, 2, h); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(w / 2 + 1, 0, 1, h);
  grain(ctx, w, h, 8, 4); cracks(ctx, w, h, { n: 5, len: 40, color: '#000', alpha: 0.12, seed: 4 });
};
P.sheet = (ctx, w, h) => {
  ctx.fillStyle = '#e9e9e4'; ctx.fillRect(0, 0, w, h); const r = new RNG(91);
  for (let i = 0; i < 40; i++) { const x = r.range(0, w); const g = ctx.createLinearGradient(x - 20, 0, x + 20, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${r.range(0.03, 0.09)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 20, 0, 40, h); }
  const s = w / 128; for (let j = 0; j < 128; j++) { ctx.fillStyle = j % 2 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(0, j * s, w, s); }
  grain(ctx, w, h, 5, 5);
};
P.leaf = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h); const cx = w / 2;
  ctx.beginPath(); ctx.moveTo(cx, h * 0.98); ctx.bezierCurveTo(w * 0.02, h * 0.7, w * 0.05, h * 0.2, cx, h * 0.02); ctx.bezierCurveTo(w * 0.95, h * 0.2, w * 0.98, h * 0.7, cx, h * 0.98);
  const g = ctx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#2d6a2a'); g.addColorStop(0.5, '#3f8f36'); g.addColorStop(1, '#6fb84c'); ctx.fillStyle = g; ctx.fill(); ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(210,240,170,0.8)'; ctx.lineWidth = w * 0.02; ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(cx, h * 0.04); ctx.stroke();
  ctx.lineWidth = w * 0.008; ctx.strokeStyle = 'rgba(190,230,150,0.45)'; for (let i = 0; i < 12; i++) { const y = h * (0.9 - i * 0.07); ctx.beginPath(); ctx.moveTo(cx, y); ctx.quadraticCurveTo(cx + w * 0.2, y - h * 0.04, w * 0.95, y - h * 0.16); ctx.moveTo(cx, y); ctx.quadraticCurveTo(cx - w * 0.2, y - h * 0.04, w * 0.05, y - h * 0.16); ctx.stroke(); }
  grain(ctx, w, h, 0, 0); ctx.restore();
};
P.frond = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h); const cx = w / 2, r = new RNG(5); ctx.lineCap = 'round';
  ctx.strokeStyle = '#4e7a2a'; ctx.lineWidth = w * 0.014; ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(cx, h * 0.02); ctx.stroke();
  const n = 46; for (let i = 0; i < n; i++) {
    const t = i / n, y = h * (0.97 - t * 0.93), len = w * 0.47 * Math.sin(Math.PI * (0.12 + t * 0.9)) ** 0.7, droop = h * 0.2 * (1 - t * 0.5);
    for (const sd of [-1, 1]) { const g = r.range(0, 1); ctx.strokeStyle = `rgb(${50 + g * 40},${110 + g * 50},${36 + g * 20})`; ctx.lineWidth = Math.max(2.6, w * 0.022 * (1 - t * 0.45)); ctx.beginPath(); ctx.moveTo(cx, y); ctx.quadraticCurveTo(cx + sd * len * 0.6, y - h * 0.03, cx + sd * len, y + droop * 0.5); ctx.stroke(); }
  }
};
P.bark = (ctx, w, h) => {
  const r = new RNG(101); ctx.fillStyle = '#8c7a66'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 40, rmin: 10, rmax: w * 0.2, colors: ['#5a4a3a', '#b8a58c', '#3c3028'], alpha: [0.1, 0.3], seed: 2 });
  for (let j = 0; j < 8; j++) { const y = j * h / 8; const g = ctx.createLinearGradient(0, y, 0, y + h / 8); g.addColorStop(0, 'rgba(30,22,16,0.7)'); g.addColorStop(0.18, 'rgba(30,22,16,0)'); g.addColorStop(0.7, 'rgba(255,240,220,0.12)'); g.addColorStop(1, 'rgba(30,22,16,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, y, w, h / 8); }
  for (let i = 0; i < 80; i++) { const x = r.range(0, w), y = r.range(0, h); ctx.strokeStyle = `rgba(30,20,12,${r.range(0.1, 0.4)})`; ctx.lineWidth = r.range(0.6, 1.6); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r.range(-4, 4), y + r.range(6, 30)); ctx.stroke(); }
  grain(ctx, w, h, 14, 4);
};
P.grass = (ctx, w, h) => {
  ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, 0, w, h);
  blobs(ctx, w, h, { n: 90, rmin: 10, rmax: w * 0.25, colors: ['#3f7030', '#7aa84a', '#6a9a3a', '#8aa850', '#4a7a30'], alpha: [0.1, 0.3], seed: 11 });
  const r = new RNG(5); for (let i = 0; i < w * 14; i++) { const x = r.range(0, w), y = r.range(0, h); ctx.strokeStyle = r.chance(0.5) ? `rgba(40,80,25,${r.range(0.2, 0.5)})` : `rgba(160,200,90,${r.range(0.15, 0.4)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r.range(-2, 2), y - r.range(2, 6)); ctx.stroke(); }
  grain(ctx, w, h, 10, 3);
};
P.stripeBase = (ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); const s = w / 8; ctx.fillStyle = '#000'; for (let i = 0; i < 8; i += 2) ctx.fillRect(i * s, 0, s, h); };
P.noiseGrey = (ctx, w, h) => { ctx.fillStyle = '#888'; ctx.fillRect(0, 0, w, h); blobs(ctx, w, h, { n: 60, rmin: 8, rmax: 50, colors: ['#000', '#fff'], alpha: [0.1, 0.4], seed: 2 }); grain(ctx, w, h, 40, 3); };
P.water = (ctx, w, h) => { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { const r = new RNG(i + 3); const x = r.range(0, w), y = r.range(0, h), rad = r.range(8, 40); const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.7, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(128,128,128,0)'); for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { ctx.fillStyle = g; ctx.save(); ctx.translate(ox, oy); ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.restore(); } } };

/** alpha-cut foliage texture as a DataTexture whose transparent texels carry the leaf colour (no dark mip fringes) */
function mkAlpha(key, w, h, draw) {
  return cached(`life:${key}:a:${w}x${h}`, () => {
    const c = makeCanvas(w, h); const ctx = c.getContext('2d'); draw(ctx, w, h); const src = ctx.getImageData(0, 0, w, h).data; const out = new Uint8Array(w * h * 4);
    let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < src.length; i += 4) if (src[i + 3] > 200) { r += src[i]; g += src[i + 1]; b += src[i + 2]; n++; } r = n ? r / n : 60; g = n ? g / n : 120; b = n ? b / n : 40;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const si = (y * w + x) * 4, di = ((h - 1 - y) * w + x) * 4; const a = src[si + 3]; if (a > 0) { // un-premultiply approx: canvas data is already straight alpha
        out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; } else { out[di] = r; out[di + 1] = g; out[di + 2] = b; } out[di + 3] = a; }
    const tx = new THREE.DataTexture(out, w, h, THREE.RGBAFormat); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.magFilter = THREE.LinearFilter; tx.anisotropy = 4; tx.needsUpdate = true; return tx;
  });
}
/** Get a cached texture by painter name. Variants with 'H' height painters become normal maps via normal(). */
export function tex(name, size = 512, opts = {}) { const n = res(size); if (name === 'leaf' || name === 'frond') return mkAlpha(name, n, n, P[name]); return mk(name, n, n, P[name], opts); }
export function normal(name, size = 512, strength = 3, opts = {}) { const n = res(size); return mkNormal(name, n, n, P[name + 'H'], strength, opts); }
/** striped circus fabric: two colours, vertical stripes; cached per pair */
export function stripes(c1, c2, n = 8, size = 256) {
  const rs = res(size); return mk(`stripe_${c1}_${c2}_${n}`, rs, rs, (ctx, w, h) => {
    const s = w / n; for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(i * s, 0, s + 1, h); }
    for (let i = 0; i < n; i++) { const g = ctx.createLinearGradient(i * s, 0, (i + 1) * s, 0); g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = g; ctx.fillRect(i * s, 0, s, h); }
    const sw = w / 128; for (let y = 0; y < 128; y++) { ctx.fillStyle = y % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(0, y * sw, w, sw); }
    grain(ctx, w, h, 8, 4);
  }, { aniso: 4 });
}

// ---------------------------------------------------------------- equirect environments (for reflections on metals/glass, and a little baked ambient light)
export function envTex(kind = 'interior') {
  return cached(`life:env:${kind}`, () => {
    const w = 256, h = 128, c = makeCanvas(w, h), ctx = c.getContext('2d');
    const cfg = {
      interior: { top: '#f4f1e8', mid: '#9a9a96', bot: '#3a3835', lights: '#ffffff', n: 7, ly: 0.12 },
      morgue: { top: '#e2f3ea', mid: '#7f9690', bot: '#2c3a36', lights: '#eafff2', n: 8, ly: 0.1 },
      warm: { top: '#5a3a24', mid: '#4a3022', bot: '#1c1410', lights: '#ffb25a', n: 5, ly: 0.2 },
      day: { top: '#6ea6e6', mid: '#cfe3f2', bot: '#6a6a60', lights: '#fff6d8', n: 1, ly: 0.28 },
      mall: { top: '#ffffff', mid: '#c9c4ba', bot: '#6a645a', lights: '#ffffff', n: 9, ly: 0.1 },
      night: { top: '#162a4a', mid: '#2a3a5a', bot: '#0a0c10', lights: '#ffd890', n: 4, ly: 0.35 },
    }[kind] || {};
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, cfg.top); g.addColorStop(0.5, cfg.mid); g.addColorStop(1, cfg.bot); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cfg.lights; for (let i = 0; i < cfg.n; i++) { const x = (i + 0.5) / cfg.n * w; ctx.globalAlpha = 0.95; ctx.fillRect(x - w / cfg.n * 0.22, h * cfg.ly, w / cfg.n * 0.44, h * 0.07); } ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  });
}
