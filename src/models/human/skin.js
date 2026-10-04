// Skin: procedural head/body textures, normal maps, skin material (fake SSS) and the per-human FX patch (infection strains, blood, dirt, frost).
import * as THREE from 'three';
import { RNG, GLOBAL, Q, hashStr } from '../../engine/common.js';
import { makeCanvas, texFromCanvas, normalTex, texRes, cached, noise2, fbm2, speckle } from '../../engine/proc.js';
import { headUV, baseXZ, headParams, FEAT } from './head.js';
import { BODY_UV } from './uvmap.js';

const C = (c) => new THREE.Color(c);
const mix = (a, b, t) => { const x = C(a), y = C(b); return '#' + x.lerp(y, t).getHexString(); };
const rgba = (c, a) => { const h = C(c).getHex(); return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`; };
const s255 = (col) => { const h = col.getHex(); return [(h >> 16) & 255, (h >> 8) & 255, (h & 255)]; };
// colour object from linear->sRGB hex: THREE.Color(hex) stores linear; getHexString gives sRGB again. Good enough for canvas.

export function skinPalette(P) {
  const tone = P.skin.tone; const hsl = {}; C(tone).getHSL(hsl);
  const dark = hsl.l < 0.45;
  return {
    base: tone,
    light: mix(tone, '#ffffff', dark ? 0.08 : 0.14),
    deep: mix(tone, '#2a1208', 0.30),
    blush: mix(tone, dark ? '#9a3028' : '#d4524e', dark ? 0.35 : 0.42),
    red: mix(tone, '#c03a38', dark ? 0.35 : 0.5),
    shadow: mix(tone, '#4a1a10', 0.55),
    socket: mix(tone, '#5a3042', 0.40),
    lip: P.skin.lip, lipDark: mix(P.skin.lip, '#2a0a0e', 0.55),
    stubble: mix(P.facialHair.color || P.hair.color, '#000000', 0.2),
    dark,
  };
}

// ---------------------------------------------------------------------------------------- head texture
function mkMetric(H, W, Hh) {
  return (x, y) => {
    const a = headUVxy(H, x, y), b = headUVxy(H, x + 0.002, y), vy = headUV.v(y + 0.002);
    return { cx: a.u * W, cy: (1 - a.v) * Hh, sx: (b.u - a.u) / 0.002 * W, sy: (vy - a.v) / 0.002 * Hh };
  };
}
function headUVxy(H, x, y) {
  let lo = 0, hi = Math.PI / 2; const tmp = {}; const ax = Math.abs(x);
  for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; baseXZ(y, mid, H, tmp); if (tmp.x < ax) lo = mid; else hi = mid; }
  const phi = ((lo + hi) / 2) * (x < 0 ? -1 : 1);
  return { u: headUV.u(phi), v: headUV.v(y) };
}
function blobAt(ctx, M, x, y, rx, ry, color, alpha, op = 'source-over', hard = 0) {
  const m = M(x, y); ctx.save(); ctx.globalCompositeOperation = op; ctx.translate(m.cx, m.cy); ctx.scale(Math.max(0.5, m.sx * rx), Math.max(0.5, m.sy * ry));
  const g = ctx.createRadialGradient(0, 0, hard, 0, 0, 1); g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
}
function polyAt(ctx, M, pts, fill, stroke = null, lw = 1) {
  ctx.beginPath(); pts.forEach(([x, y], i) => { const m = M(x, y); if (i === 0) ctx.moveTo(m.cx, m.cy); else ctx.lineTo(m.cx, m.cy); }); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function lineAt(ctx, M, pts, color, lw) {
  ctx.beginPath(); pts.forEach(([x, y], i) => { const m = M(x, y); if (i === 0) ctx.moveTo(m.cx, m.cy); else ctx.lineTo(m.cx, m.cy); });
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}

export function paintHeadTexture(P, W = 1024, Hh = 512) {
  const H = headParams(P);
  const pal = skinPalette(P);
  const S = P.skin, f = P.face;
  const c = makeCanvas(W, Hh); const ctx = c.getContext('2d');
  const M = mkMetric(H, W, Hh);
  const rng = new RNG(P.seed ^ 0x9e3779);
  const px = W / 1024; // pixel scale factor for lines
  // base
  ctx.fillStyle = pal.base; ctx.fillRect(0, 0, W, Hh);
  // large-scale tone: lighter forehead / T-zone, slightly darker neck
  const vgrad = ctx.createLinearGradient(0, 0, 0, Hh);
  vgrad.addColorStop(0, rgba(pal.light, 0.35)); vgrad.addColorStop(0.35, rgba(pal.light, 0.10)); vgrad.addColorStop(0.7, rgba(pal.base, 0)); vgrad.addColorStop(1, rgba(pal.deep, 0.35));
  ctx.fillStyle = vgrad; ctx.fillRect(0, 0, W, Hh);
  // mottling (low-frequency noise)
  {
    const nc = makeCanvas(128, 64), nctx = nc.getContext('2d'); const img = nctx.createImageData(128, 64);
    const o = (P.seed % 97) * 1.3; const A = C(pal.deep).convertLinearToSRGB(), B = C(pal.blush).convertLinearToSRGB();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
      const n = fbm2(x / 128 * 6 + o, y / 64 * 3 + o, 4); const n2 = fbm2(x / 128 * 14 + o * 2, y / 64 * 7, 3);
      const i = (y * 128 + x) * 4; const k = Math.max(0, Math.min(1, (n - 0.5) * 2.2 + 0.5)); const k2 = Math.max(0, Math.min(1, (n2 - 0.5) * 2 + 0.5));
      img.data[i] = (A.r * (1 - k2) + B.r * k2) * 255; img.data[i + 1] = (A.g * (1 - k2) + B.g * k2) * 255; img.data[i + 2] = (A.b * (1 - k2) + B.b * k2) * 255; img.data[i + 3] = 255 * (0.10 + 0.10 * Math.abs(k - 0.5) * 2);
    }
    nctx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(nc, 0, 0, W, Hh);
  }
  // cheeks blush
  const bl = S.blush;
  for (const s of [1, -1]) {
    blobAt(ctx, M, s * 0.047, -0.030, 0.026, 0.024, pal.blush, 0.55 * bl * 2, 'source-over');
    blobAt(ctx, M, s * 0.020, -0.018, 0.020, 0.015, pal.red, 0.22 * bl * 2, 'source-over'); // nose-cheek
    blobAt(ctx, M, s * 0.014, -0.036, 0.010, 0.011, pal.red, 0.5, 'source-over'); // alar
    blobAt(ctx, M, s * 0.0165, 0.0045, 0.020, 0.016, pal.socket, 0.50, 'multiply');  // eye socket
    blobAt(ctx, M, s * 0.0315, -0.0055, 0.019, 0.0075, pal.shadow, 0.22 + 0.2 * (P.age > 30) + 0.25 * P.elder, 'multiply'); // under-eye
    blobAt(ctx, M, s * 0.034, 0.024, 0.026, 0.009, pal.socket, 0.35, 'multiply'); // lid crease shadow
    blobAt(ctx, M, s * 0.028, 0.0305, 0.024, 0.0045, pal.deep, 0.22, 'multiply'); // under brow ridge
    blobAt(ctx, M, s * 0.075, -0.012, 0.014, 0.034, pal.red, 0.50, 'source-over'); // ears
    blobAt(ctx, M, s * 0.062, -0.058, 0.025, 0.030, pal.deep, 0.12, 'multiply');  // jaw shade
  }
  blobAt(ctx, M, 0, -0.030, 0.014, 0.012, pal.red, 0.45, 'source-over'); // nose tip
  blobAt(ctx, M, 0, -0.012, 0.008, 0.012, pal.red, 0.15, 'source-over');
  blobAt(ctx, M, 0, 0.04, 0.05, 0.02, pal.light, 0.22, 'source-over'); // forehead highlight
  blobAt(ctx, M, 0, -0.098, 0.02, 0.013, pal.red, 0.10 + 0.05 * bl, 'source-over'); // chin
  blobAt(ctx, M, 0, -0.0535, 0.012, 0.007, pal.shadow, 0.15, 'multiply'); // philtrum/ upper lip shade
  // ---------- eyelid margins & lash line (eyeliner optional)
  const xin = H.eyeX - 0.0138 * (f.eyeSize ** 0.5), xout = H.eyeX + 0.0138 * (f.eyeSize ** 0.5);
  for (const s of [1, -1]) {
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; const ax = xin + (xout - xin) * t; const yy = H.ey + 0.0058 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.82)), 0.85) + H.tilt * 0.016 * (t - 0.35); pts.push([s * ax, yy + 0.0005]); }
    lineAt(ctx, M, pts, rgba('#120806', 0.35 + 0.5 * S.eyeliner), (1.4 + 1.6 * S.eyeliner) * px);
    const crease = []; for (let k = 0; k <= 16; k++) { const t = k / 16; const ax = xin + (xout - xin) * (0.04 + 0.92 * t); const yy = H.ey + 0.0105 + 0.0035 * Math.sin(Math.PI * t) + H.tilt * 0.016 * (t - 0.35); crease.push([s * ax, yy]); }
    lineAt(ctx, M, crease, rgba(pal.shadow, 0.55), 2.4 * px); lineAt(ctx, M, crease.map(([x, y]) => [x, y + 0.0013]), rgba(pal.light, 0.35), 2.0 * px);
    const lowl = []; for (let k = 0; k <= 16; k++) { const t = k / 16; const ax = xin + (xout - xin) * (0.1 + 0.8 * t); lowl.push([s * ax, H.ey - 0.0125 - 0.002 * Math.sin(Math.PI * t)]); } lineAt(ctx, M, lowl, rgba(pal.shadow, 0.22), 1.8 * px);
    if (S.eyeShadow > 0 || S.eyeliner > 0) blobAt(ctx, M, s * 0.034, 0.0165, 0.022, 0.0085, '#5a3a55', 0.25 + 0.3 * S.eyeShadow, 'multiply');
  }
  // ---------- lips
  const lipC = S.lipstick || mix(pal.lip, '#8a2830', 0.18);
  const xc = H.xc * 1.0; const ym = H.ym;
  const upper = [], lower = [];
  for (let k = 0; k <= 24; k++) {
    const t = -1 + 2 * k / 24; const ax = Math.abs(t) * (xc + 0.0006);
    const yu = ym + 0.0097 * f.lips ** 0.35 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.1)), 0.5) + 0.0011 * Math.exp(-(((ax - 0.0055) / 0.0038) ** 2)) - 0.0007 * Math.exp(-((ax / 0.003) ** 2));
    const yl = ym - 0.0128 * f.lips ** 0.35 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.3)), 0.55);
    upper.push([t * (xc + 0.0006), yu]); lower.push([t * (xc + 0.0006), yl]);
  }
  const lipPoly = upper.concat(lower.reverse());
  // soft edge: draw several strokes
  polyAt(ctx, M, lipPoly, rgba(lipC, 0.35));
  ctx.lineJoin = 'round'; polyAt(ctx, M, lipPoly, null, rgba(lipC, 0.35), 4 * px); polyAt(ctx, M, lipPoly, null, rgba(lipC, 0.55), 2.2 * px);
  polyAt(ctx, M, lipPoly, rgba(lipC, 0.92));
  blobAt(ctx, M, 0, ym - 0.005, 0.02, 0.006, pal.light, 0.10, 'source-over'); // lower lip sheen
  blobAt(ctx, M, 0, ym + 0.0035, 0.024, 0.0045, pal.lipDark, 0.35, 'multiply'); // upper lip darker (shadowed)
  // lip lines
  ctx.globalAlpha = 0.18; for (let k = 0; k < 46; k++) { const x = rng.range(-xc, xc) * 0.95; const up = k % 2 === 0; const y0 = ym + (up ? 0.0004 : -0.0004), y1 = ym + (up ? 0.0092 : -0.012); lineAt(ctx, M, [[x, y0], [x * 1.01, y1]], pal.lipDark, 0.8 * px); } ctx.globalAlpha = 1;
  // mouth slit line
  lineAt(ctx, M, [[-xc - 0.001, ym - 0.0004], [-xc * 0.5, ym], [0, ym + 0.0002], [xc * 0.5, ym], [xc + 0.001, ym - 0.0004]], rgba(pal.lipDark, 0.9), 2.2 * px);
  // corners shadow
  // ---------- nostrils
  const nw = f.noseWidth, ysub = -0.0462 - 0.002 * (f.noseLen - 1);
  for (const s of [1, -1]) { blobAt(ctx, M, s * 0.0100 * nw, ysub + 0.0052, 0.0050 * nw, 0.0034, '#1a0a08', 0.85, 'source-over', 0.3); blobAt(ctx, M, s * 0.0155 * nw, ysub + 0.0075, 0.006, 0.0045, pal.shadow, 0.35, 'multiply'); }
  blobAt(ctx, M, 0, ysub + 0.001, 0.014, 0.0045, pal.shadow, 0.35, 'multiply');
  // ---------- veins (temples, neck), subtle
  ctx.globalAlpha = 0.07 + 0.08 * (P.build.muscle > 0.6); for (const s of [1, -1]) { lineAt(ctx, M, [[s * 0.064, 0.02], [s * 0.060, 0.032], [s * 0.052, 0.040]], '#5a6fa0', 1.6 * px); lineAt(ctx, M, [[s * 0.022, -0.14], [s * 0.026, -0.16], [s * 0.02, -0.19]], '#5a6fa0', 2.4 * px); } ctx.globalAlpha = 1;
  // ---------- wrinkles / age
  const age = Math.max(S.wrinkles, Math.max(0, (P.age - 28) / 60), P.elder);
  if (age > 0.02) {
    ctx.globalAlpha = Math.min(0.55, age * 0.7);
    for (let k = 0; k < 4; k++) { const y = 0.044 + k * 0.012; const pts = []; for (let q = 0; q <= 8; q++) { const x = -0.04 + 0.08 * q / 8; pts.push([x, y + 0.002 * Math.sin(q * 1.3 + k) - 0.002 * (x * x) / 0.0016 * 0.3]); } lineAt(ctx, M, pts, pal.shadow, 1.3 * px); }
    for (const s of [1, -1]) {
      for (let k = 0; k < 3; k++) lineAt(ctx, M, [[s * 0.050, 0.004 + k * 0.004], [s * (0.062 + 0.004 * k), 0.0 + k * 0.010 + 0.002]], pal.shadow, 1.1 * px);
      lineAt(ctx, M, [[s * 0.022, -0.004], [s * 0.035, -0.010], [s * 0.046, -0.008]], pal.shadow, 1.2 * px);
      lineAt(ctx, M, [[s * 0.020, -0.040], [s * 0.027, -0.055], [s * 0.030, -0.068]], pal.shadow, 1.6 * px);
    }
    lineAt(ctx, M, [[-0.008, 0.022], [-0.002, 0.025], [0.002, 0.025], [0.008, 0.022]], pal.shadow, 1.3 * px);
    ctx.globalAlpha = 1;
  }
  // ---------- freckles & moles
  if (S.freckles > 0) {
    ctx.fillStyle = mix(pal.base, '#5a2c10', 0.55);
    const n = Math.floor(900 * S.freckles);
    for (let k = 0; k < n; k++) { const s = rng.sign(); const x = s * Math.abs(rng.gauss()) * 0.026; const y = -0.018 + rng.gauss() * 0.014; if (Math.abs(x) < 0.003 && y < -0.02 && y > -0.05) continue; if (y < -0.045 || y > 0.012) continue; const m = M(x, y); ctx.globalAlpha = rng.range(0.15, 0.5); ctx.beginPath(); ctx.arc(m.cx, m.cy, rng.range(0.6, 1.9) * px, 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  for (const [mx, my] of S.moles) { const m = M(mx, my); ctx.fillStyle = 'rgba(40,20,10,0.8)'; ctx.beginPath(); ctx.arc(m.cx, m.cy, 2.4 * px, 0, 6.3); ctx.fill(); }
  // ---------- stubble / facial hair stipple
  const fh = P.facialHair, stub = Math.max(S.stubble, fh.type !== 'none' ? 0.6 : 0);
  if (stub > 0.02) {
    const ys = [];
    const density = (x, y) => {
      const ax = Math.abs(x); if (y > -0.012 || y < -0.2) return 0;
      if (y < ym + 0.0125 && y > ym - 0.0150 && ax < xc * 1.1) return 0; // lips
      let d = smooth01(-0.012, -0.045, y) * (1 - smooth01(0.056, 0.070, ax));
      if (ax < 0.022 && y > -0.052 && y < -0.020) return 0; // nose
      if (y > ym + 0.0125 && y < -0.052) d *= ax < 0.05 ? 1 : 0; // moustache zone
      if (y < -0.12) d *= smooth01(-0.19, -0.13, y) * 0.8; // neck
      if (fh.type === 'goatee') { const g = Math.exp(-((ax / 0.026) ** 2)) * smooth01(ym - 0.012, ym - 0.03, y) + Math.exp(-((ax / 0.030) ** 2) - ((y - (ym + 0.012)) / 0.008) ** 2) * 0.5; d = d * 0.45 + g * 1.0; }
      return d;
    };
    ctx.fillStyle = pal.stubble;
    const N = Math.floor(W * Hh * 0.075 * stub);
    for (let k = 0; k < N; k++) {
      const u = 0.5 + (rng.next() - 0.5) * 0.62, v = rng.range(0.05, 0.62); const phi = headUV.phiOfU(u), y = headUV.yOfV(v);
      const t = {}; baseXZ(y, phi, H, t); const d = density(t.x, y); if (d <= 0.01 || rng.next() > d) continue;
      ctx.globalAlpha = rng.range(0.25, 0.7) * Math.min(1, stub * 1.4); ctx.fillRect(u * W, (1 - v) * Hh, rng.range(0.8, 1.7), rng.range(0.8, 1.7));
    }
    ctx.globalAlpha = 1;
    // five-o-clock shadow tone
    blobAt(ctx, M, 0, -0.07, 0.06, 0.04, pal.stubble, 0.12 * stub, 'multiply');
  }
  // ---------- neck tattoo etc
  if (S.tattoos.includes('neck')) {
    ctx.globalAlpha = 0.85; const ink = '#14181f';
    for (let k = 0; k < 7; k++) lineAt(ctx, M, [[0.034 + k * 0.0006, -0.14 - k * 0.006], [0.048, -0.165 - k * 0.006]], ink, 1.7 * px);
    lineAt(ctx, M, [[0.03, -0.13], [0.052, -0.15], [0.058, -0.18]], ink, 3.2 * px);
    for (let k = 0; k < 8; k++) { const t = k / 7; blobAt(ctx, M, 0.036 + 0.02 * t, -0.14 - 0.045 * t, 0.004, 0.003, ink, 0.9, 'source-over', 0.2); }
    ctx.globalAlpha = 1;
  }
  // ---------- scars
  for (const sc of (S.scars || [])) lineAt(ctx, M, sc, rgba('#c98c88', 0.6), 1.6 * px);
  // ---------- skin grain (pores / micro-colour)
  speckle(ctx, W, Hh, { count: Math.floor(W * Hh * 0.05), size: [0.6, 1.5], colors: [pal.deep, pal.shadow, pal.blush], alpha: [0.03, 0.10], seed: P.seed % 1000 });
  speckle(ctx, W, Hh, { count: Math.floor(W * Hh * 0.025), size: [0.6, 1.4], colors: [pal.light, '#ffffff'], alpha: [0.03, 0.08], seed: (P.seed % 1000) + 7 });
  // ---------- interior strip (v < 0.05)  rows: top=ring1 (lip inner) .. bottom=ring6 (dark)
  {
    const y0 = (1 - 0.052) * Hh, y1 = Hh; const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, mix(lipC, '#7a2a30', 0.35)); g.addColorStop(0.28, '#a84e55'); g.addColorStop(0.55, '#8a3a40'); g.addColorStop(0.8, '#2c1013'); g.addColorStop(1, '#0c0405');
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
  }
  return c;
}
const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------- body texture
export function paintBodyTexture(P, S = 512) {
  const pal = skinPalette(P);
  const c = makeCanvas(S, S); const ctx = c.getContext('2d'); const rng = new RNG(P.seed ^ 0x51ed27);
  ctx.fillStyle = pal.base; ctx.fillRect(0, 0, S, S);
  const R = (name) => { const r = BODY_UV[name]; return { x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S }; };
  const male = !P.isFemale;
  // mottling noise
  {
    const n = 128; const nc = makeCanvas(n, n), nctx = nc.getContext('2d'); const img = nctx.createImageData(n, n); const o = (P.seed % 91) * 1.7; const A = C(pal.deep).convertLinearToSRGB(), B = C(pal.blush).convertLinearToSRGB();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = fbm2(x / n * 7 + o, y / n * 7 + o, 4); const i = (y * n + x) * 4; const k = Math.max(0, Math.min(1, (v - 0.5) * 2.4 + 0.5)); img.data[i] = (A.r * (1 - k) + B.r * k) * 255; img.data[i + 1] = (A.g * (1 - k) + B.g * k) * 255; img.data[i + 2] = (A.b * (1 - k) + B.b * k) * 255; img.data[i + 3] = 255 * 0.16; }
    nctx.putImageData(img, 0, 0); ctx.drawImage(nc, 0, 0, S, S);
  }
  // slight neck-of-torso tint & general vertical shade per rect
  const shadeV = (r, a, b, color, op = 'multiply') => { const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, b)); ctx.globalCompositeOperation = op; ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalCompositeOperation = 'source-over'; };
  const spot = (r, fx, fy, rx, ry, color, a, op = 'source-over') => { ctx.save(); ctx.globalCompositeOperation = op; ctx.translate(r.x + fx * r.w, r.y + fy * r.h); ctx.scale(rx * r.w, ry * r.h); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore(); };
  for (const s of ['L', 'R']) {
    const arm = R('arm' + s), leg = R('leg' + s), hand = R('hand' + s), foot = R('foot' + s);
    // arms (first station = shoulder at top; elbow at 2/3, wrist at bottom)
    spot(arm, 0.5, 0.67, 0.35, 0.05, pal.red, 0.28); spot(arm, 0.5, 0.67, 0.5, 0.09, pal.deep, 0.15, 'multiply');
    shadeV(arm, 0.0, 0.0, pal.base);
    // hand / palm lighter
    ctx.globalCompositeOperation = 'source-over';
    const dorsalU = s === 'L' ? 0.25 : 0.75;
    // legs: knee at 2/3
    spot(leg, 0.5, 0.66, 0.4, 0.04, pal.red, 0.25); spot(leg, 0.5, 0.66, 0.5, 0.08, pal.deep, 0.12, 'multiply');
    // knuckles: palm rect top 40%: fingers 60%
    const fing = { x: hand.x, y: hand.y + hand.h * 0.4, w: hand.w, h: hand.h * 0.6 };
    for (let k = 0; k < 2; k++) spot({ x: hand.x, y: hand.y, w: hand.w, h: hand.h * 0.4 }, dorsalU, 0.95, 0.22, 0.2, pal.red, 0.22);
    // fingers: v from base(0) to tip(1). Reddish knuckles, nails near the tip on the dorsal side
    ctx.save(); ctx.beginPath(); ctx.rect(fing.x, fing.y, fing.w, fing.h); ctx.clip();
    spot(fing, dorsalU, 0.30, 0.2, 0.1, pal.red, 0.25); spot(fing, dorsalU, 0.55, 0.16, 0.06, pal.red, 0.16);
    spot(fing, 1 - dorsalU, 0.2, 0.3, 0.7, pal.light, 0.22); // palm side lighter
    // nail
    const nailC = mix(pal.light, '#f3c8c4', 0.55);
    ctx.fillStyle = rgba(nailC, 0.95); const nu = fing.x + fing.w * dorsalU; ctx.beginPath(); ctx.ellipse(nu, fing.y + fing.h * 0.86, fing.w * 0.095, fing.h * 0.105, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.25); ctx.beginPath(); ctx.ellipse(nu, fing.y + fing.h * 0.89, fing.w * 0.065, fing.h * 0.03, 0, 0, 6.3); ctx.fill();
    ctx.restore();
    // feet: redder soles / toes
    spot(foot, 0.5, 0.9, 0.4, 0.2, pal.red, 0.18);
  }
  // body hair on limbs
  const hairy = P.skin.bodyHair * (male ? 1 : 0.35) * (P.ethnicity === 'filipino' || P.ethnicity === 'east_asian' ? 0.5 : 1);
  if (hairy > 0.03) {
    ctx.strokeStyle = rgba(P.facialHair.color || P.hair.color, 0.28); ctx.lineWidth = 0.8;
    for (const name of ['armL', 'armR', 'legL', 'legR']) {
      const r = R(name); const n = Math.floor(r.w * r.h * 0.025 * hairy);
      ctx.beginPath(); for (let k = 0; k < n; k++) { const x = r.x + rng.next() * r.w, y = r.y + rng.next() * r.h; ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-0.8, 0.8), y + rng.range(1.5, 3.5)); } ctx.stroke();
    }
  }
  // freckles on arms
  if (P.skin.freckles > 0) { ctx.fillStyle = mix(pal.base, '#5a2c10', 0.5); for (const name of ['armL', 'armR']) { const r = R(name); const n = Math.floor(r.w * r.h * 0.01 * P.skin.freckles); for (let k = 0; k < n; k++) { ctx.globalAlpha = rng.range(0.1, 0.35); ctx.fillRect(r.x + rng.next() * r.w, r.y + rng.next() * r.h * 0.7, rng.range(0.8, 1.8), rng.range(0.8, 1.8)); } } ctx.globalAlpha = 1; }
  // veins on forearms/hands (muscle)
  if (P.build.muscle > 0.4 || P.age > 45) {
    ctx.globalAlpha = 0.10 + 0.12 * P.build.muscle; ctx.strokeStyle = '#5f78b0'; ctx.lineWidth = 1.3;
    for (const s of ['L', 'R']) { const r = R('arm' + s); const u0 = s === 'L' ? 0.28 : 0.72; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(r.x + r.w * (u0 + (k - 1) * 0.06), r.y + r.h * 0.68); ctx.bezierCurveTo(r.x + r.w * (u0 + 0.1), r.y + r.h * 0.78, r.x + r.w * (u0 - 0.1), r.y + r.h * 0.9, r.x + r.w * (u0 + (k - 1) * 0.05), r.y + r.h * 0.99); ctx.stroke(); } }
    ctx.globalAlpha = 1;
  }
  // tattoos
  if (P.skin.tattoos.includes('forearms')) {
    for (const s of ['L', 'R']) paintForearmTattoo(ctx, R('arm' + s), s, rng);
  }
  speckle(ctx, S, S, { count: S * S * 0.03, size: [0.6, 1.3], colors: [pal.deep, pal.shadow], alpha: [0.03, 0.09], seed: P.seed % 997 });
  return c;
}
function paintForearmTattoo(ctx, r, side, rng) {
  // forearm spans v 0.67..1.0 of the arm rect, upper arm 0.2..0.65. Wraps around u (0..1)
  const ink = '#161a22';
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const X = (u) => r.x + r.w * u, Y = (v) => r.y + r.h * v;
  // bands at wrist & elbow
  ctx.strokeStyle = ink; ctx.globalAlpha = 0.92;
  for (const [v0, w] of [[0.95, 2.5], [0.9, 1.4], [0.7, 2.0], [0.74, 1.2]]) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(X(0.02), Y(v0)); ctx.lineTo(X(0.98), Y(v0)); ctx.stroke(); }
  // tribal flame/blade pattern around forearm
  ctx.fillStyle = ink;
  for (let k = 0; k < 9; k++) {
    const u = 0.04 + k * 0.11; ctx.beginPath(); ctx.moveTo(X(u), Y(0.88)); ctx.quadraticCurveTo(X(u + 0.03), Y(0.82), X(u + 0.012), Y(0.755)); ctx.quadraticCurveTo(X(u - 0.02), Y(0.82), X(u - 0.04), Y(0.88)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(u + 0.05), Y(0.88)); ctx.quadraticCurveTo(X(u + 0.065), Y(0.84), X(u + 0.056), Y(0.80)); ctx.quadraticCurveTo(X(u + 0.04), Y(0.84), X(u + 0.02), Y(0.88)); ctx.closePath(); ctx.fill();
  }
  // outer forearm: a skull-ish mark + script + roses (abstract blobs with highlights) at front face u ~ 0.5 (front/top of arm)
  ctx.globalAlpha = 0.9;
  const cu = side === 'L' ? 0.3 : 0.7;   // lateral side
  ctx.beginPath(); ctx.ellipse(X(cu), Y(0.8), r.w * 0.11, r.h * 0.04, 0, 0, 6.3); ctx.fill();
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#9aa8c0'; ctx.beginPath(); ctx.ellipse(X(cu - 0.02), Y(0.79), r.w * 0.04, r.h * 0.018, 0, 0, 6.3); ctx.fill();
  ctx.globalAlpha = 0.9; ctx.fillStyle = ink;
  for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(X(cu - 0.05 + k * 0.06), Y(0.805), r.w * 0.012, r.h * 0.012, 0, 0, 6.3); ctx.fill(); }
  // upper arm: geometric rings and dotted stripe
  ctx.lineWidth = 1.2; ctx.strokeStyle = ink;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(X(0.0), Y(0.28 + k * 0.045)); for (let q = 0; q <= 24; q++) ctx.lineTo(X(q / 24), Y(0.28 + k * 0.045 + 0.012 * Math.sin(q * 1.57 + k))); ctx.stroke(); }
  for (let k = 0; k < 40; k++) { ctx.beginPath(); ctx.arc(X(rng.next()), Y(rng.range(0.4, 0.56)), rng.range(0.6, 1.4), 0, 6.3); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------- shared normal map
export function poresNormal(rx = 1, ry = 1) {
  return cached('human.pores' + rx + 'x' + ry, () => normalTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    const r = new RNG(5); ctx.fillStyle = '#505050';
    for (let i = 0; i < 2600; i++) { ctx.globalAlpha = r.range(0.25, 0.7); const s = r.range(0.8, 2.0); ctx.beginPath(); ctx.arc(r.next() * w, r.next() * h, s, 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 0.5; for (let i = 0; i < 900; i++) { ctx.fillStyle = r.next() < 0.5 ? '#9a9a9a' : '#6a6a6a'; ctx.fillRect(r.next() * w, r.next() * h, r.range(2, 8), 1); }
    ctx.globalAlpha = 1;
    const img = ctx.getImageData(0, 0, w, h); // low-freq undulation
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm2(x / w * 8, y / h * 8, 3); const i = (y * w + x) * 4; const k = (n - 0.5) * 50; img.data[i] = img.data[i] + k; img.data[i + 1] = img.data[i + 1] + k; img.data[i + 2] = img.data[i + 2] + k; }
    ctx.putImageData(img, 0, 0);
  }, { strength: 2.2, repeat: [rx, ry] }));
}

// ---------------------------------------------------------------------------------------- strains
export const STRAINS = {
  us: { tint: [0.60, 0.74, 0.55], tintAmt: 0.82, vein: [0.18, 0.12, 0.28], veinAmt: 1.0, veinScale: 9, veinEmit: 0, bruise: [0.35, 0.18, 0.42], bruiseAmt: 0.75, eye: '#c9c97a', wet: 0.0, rough: 0.55 },
  us_giant: { tint: [0.62, 0.72, 0.56], tintAmt: 0.85, vein: [0.15, 0.10, 0.24], veinAmt: 1.2, veinScale: 7, veinEmit: 0, bruise: [0.33, 0.16, 0.40], bruiseAmt: 0.85, eye: '#d4d27a', wet: 0.0, rough: 0.55 },
  india: { tint: [0.86, 0.84, 0.36], tintAmt: 0.85, vein: [0.52, 0.55, 0.12], veinAmt: 0.9, veinScale: 11, veinEmit: 0, bruise: [0.55, 0.45, 0.12], bruiseAmt: 0.55, eye: '#e8d27a', wet: 0.6, rough: 0.32 },
  russia: { tint: [0.74, 0.84, 1.0], tintAmt: 0.85, vein: [0.28, 0.44, 0.72], veinAmt: 0.7, veinScale: 10, veinEmit: 0, bruise: [0.35, 0.45, 0.7], bruiseAmt: 0.4, eye: '#bfe6ff', wet: 0.0, rough: 0.5 },
  germany: { tint: [0.88, 0.88, 0.92], tintAmt: 0.85, vein: [0.06, 0.04, 0.10], veinAmt: 1.5, veinScale: 14, veinEmit: 0, bruise: [0.28, 0.24, 0.34], bruiseAmt: 0.5, eye: '#d8d8e0', wet: 0.1, rough: 0.5 },
  cebu: { tint: [0.52, 0.72, 0.50], tintAmt: 0.65, vein: [0.22, 1.0, 0.10], veinAmt: 1.6, veinScale: 12, veinEmit: 2.4, bruise: [0.1, 0.35, 0.12], bruiseAmt: 0.4, eye: '#6cff3a', wet: 0.2, rough: 0.5 },
};

/** per-human FX uniforms shared by every material of that human */
export function makeFX() {
  return {
    uInfect: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uTintAmt: { value: 0 },
    uVeinCol: { value: new THREE.Vector3(0.1, 0.1, 0.1) }, uVeinAmt: { value: 0 }, uVeinScale: { value: 10 }, uVeinEmit: { value: 0 },
    uBruise: { value: new THREE.Vector3(0.3, 0.2, 0.3) }, uBruiseAmt: { value: 0 },
    uBlood: { value: 0 }, uDirt: { value: 0 }, uFrost: { value: 0 }, uSeed: { value: 0 }, uWet: { value: 0 },
  };
}
const FX_GLSL_PARS = /* glsl */`
uniform float uInfect; uniform vec3 uTint; uniform float uTintAmt; uniform vec3 uVeinCol; uniform float uVeinAmt; uniform float uVeinScale; uniform float uVeinEmit;
uniform vec3 uBruise; uniform float uBruiseAmt; uniform float uBlood; uniform float uDirt; uniform float uFrost; uniform float uSeed; uniform float uWet; uniform float uFxTime;
varying vec3 vFxPos;
float fxh(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float fxn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(fxh(i),fxh(i+vec3(1,0,0)),f.x),mix(fxh(i+vec3(0,1,0)),fxh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(fxh(i+vec3(0,0,1)),fxh(i+vec3(1,0,1)),f.x),mix(fxh(i+vec3(0,1,1)),fxh(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fxf(vec3 p){ return fxn(p)*0.55 + fxn(p*2.1)*0.3 + fxn(p*4.3)*0.15; }
float fxVein(vec3 p, float sc){ float a = abs(fxn(p*sc) - 0.5); float b = abs(fxn(p*sc*1.9 + 7.3) - 0.5); float v = 1.0 - smoothstep(0.0, 0.055, min(a, b*1.25)); return v; }
`;
/** apply the FX patch (and optional SSS wrap) to a material. fx = makeFX() object (shared per human). opts: {sss, skin} */
export function patchMaterial(mat, fx, { sss = 0, skin = false, tag = '' } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    for (const k in fx) shader.uniforms[k] = fx[k];
    shader.uniforms.uFxTime = GLOBAL.time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFxPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFxPos = position;');
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FX_GLSL_PARS);
    // tint + bruise + veins + blood + dirt + frost on diffuse
    fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 fp = vFxPos;
        if (uInfect > 0.001) {
          float sp = fxf(fp * 2.4 + uSeed) ; float fr = smoothstep(sp - 0.15, sp + 0.15, uInfect * 1.3);
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
          vec3 sick = mix(diffuseColor.rgb, vec3(lum) * uTint * 1.15, uTintAmt);
          float bru = smoothstep(0.52, 0.72, fxf(fp * 6.0 + uSeed * 1.7)) * uBruiseAmt;
          sick = mix(sick, sick * uBruise * 2.0, bru * 0.7);
          float vein = fxVein(fp + vec3(0.0, 0.0, uSeed), uVeinScale) * uVeinAmt;
          vein *= 0.5 + 0.5 * smoothstep(0.35, 0.65, fxf(fp * 3.0 + 3.1));
          sick = mix(sick, uVeinCol, clamp(vein, 0.0, 1.0) * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, sick, fr);
        }
        if (uDirt > 0.001) {
          float dn = fxf(fp * 9.0 + 11.0); float gr = smoothstep(0.35, 0.8, dn * (0.55 + 0.9 * uDirt) + (1.2 - fp.y) * 0.08 * uDirt);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.38, 0.30, 0.24), gr * uDirt * 0.9);
        }
        if (uBlood > 0.001) {
          float bn = fxf(fp * 5.5 + 21.0 + uSeed); float bm = smoothstep(1.0 - uBlood * 0.75, 1.0 - uBlood * 0.75 + 0.07, bn + 0.12 * fxn(fp * 22.0));
          vec3 bc = mix(vec3(0.30, 0.01, 0.015), vec3(0.12, 0.0, 0.01), fxn(fp * 14.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, bc, bm * 0.92);
        }
        if (uFrost > 0.001) {
          float fn2 = fxf(fp * 14.0 + 3.0); float fm = smoothstep(0.45, 0.8, fn2 + uFrost * 0.35 - 0.2 + 0.15 * (fp.y - 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.9, 1.0), fm * uFrost * 0.8);
        }
      }`);
    fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        if (uInfect > 0.001 && uVeinEmit > 0.0) {
          vec3 fp = vFxPos; float sp = fxf(fp * 2.4 + uSeed); float fr = smoothstep(sp - 0.15, sp + 0.15, uInfect * 1.3);
          float vein = fxVein(fp + vec3(0.0, 0.0, uSeed), uVeinScale) * uVeinAmt; vein *= 0.5 + 0.5 * smoothstep(0.35, 0.65, fxf(fp * 3.0 + 3.1));
          float pulse = 0.7 + 0.3 * sin(uFxTime * 3.0 + fp.y * 5.0);
          totalEmissiveRadiance += uVeinCol * clamp(vein, 0.0, 1.0) * fr * uVeinEmit * pulse;
        }
      }`);
    fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.22, clamp(uWet + uBlood * 0.35, 0.0, 1.0) * 0.8);`);
    if (sss > 0) {
      fs = fs.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;',
        `float sssW = ${sss.toFixed(3)}; float dotNLw = saturate((dot(geometryNormal, directLight.direction) + sssW) / (1.0 + sssW));
         vec3 irradiance = directLight.color * (vec3(dotNL) + (dotNLw - dotNL) * vec3(1.0, 0.42, 0.28) * 1.15);`));
    }
    shader.fragmentShader = fs;
  };
  const key = prevKey(mat);
  mat.customProgramCacheKey = () => key + '|hfx' + (sss > 0 ? 's' : '') + tag;
  return mat;
}
function prevKey(mat) { return mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''; }

// ---------------------------------------------------------------------------------------- materials
function skinKey(P) { return `${P.id}|${P.skin.tone}|${P.skin.stubble}|${P.facialHair.type}|${P.skin.freckles}|${P.skin.lipstick}|${P.skin.eyeliner}|${P.skin.eyeShadow}|${P.age}|${P.skin.tattoos.join(',')}|${P.face.lips}|${P.face.noseWidth}|${P.face.noseLen}|${P.build.muscle}|${P.skin.lip}|${P.skin.blush}|${P.skin.moles.length}|${P.face.eyeSpacing}|${P.face.eyeTilt}|${P.face.lipWidth}|${P.face.width}|${P.face.jaw}|${P.face.cheek}|${P.skin.scars?.length || 0}`; }

export function makeSkinMaterials(P, fx, { glove = false } = {}) {
  const res = texRes(1024);
  const headMap = cached('human.headtex.' + skinKey(P) + res, () => { const c = paintHeadTexture(P, res, res / 2); const t = texFromCanvas(c, { aniso: 8 }); t.userData.shared = true; return t; });
  const bodyMap = cached('human.bodytex.' + skinKey(P) + res, () => { const c = paintBodyTexture(P, Math.min(res, 1024) >= 512 ? 512 : res); const t = texFromCanvas(c, { aniso: 8 }); t.userData.shared = true; return t; });
  const mk = (map, nrm, nscale) => {
    const m = new THREE.MeshPhysicalMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(nscale, nscale), roughness: 0.56, metalness: 0, sheen: 0.22, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffb59a'), side: THREE.FrontSide, envMapIntensity: 0.7 });
    return patchMaterial(m, fx, { sss: 0.55, skin: true, tag: 'sk' });
  };
  const head = mk(headMap, poresNormal(7, 3.5), 0.55); head.name = 'skinHead';
  const body = mk(bodyMap, poresNormal(6, 6), 0.45); body.name = 'skinBody';
  return { head, body, headMap, bodyMap };
}
