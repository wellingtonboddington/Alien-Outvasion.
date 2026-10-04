// Procedural airbrushed jeepney art: palettes, flames, swooshes, scrollwork, mural cartouches, chrome-effect lettering.
// All painters draw in LOGICAL millimetre coordinates (ctx pre-scaled) so any texture resolution works.
import * as THREE from 'three';
import { RNG, TAU } from '../../engine/common.js';
import { canvasTex, cached, texRes } from '../../engine/proc.js';

export const JEEPNEY_PALETTES = {
  blessed: { base: '#0f3f9a', base2: '#06204f', accent: '#ffd21f', accent2: '#e8262b', trim: '#f4f4f0', text: ['#ffffff', '#ffe27a'], body: 0x123f96 },
  sunrise: { base: '#e8531a', base2: '#9d230a', accent: '#ffd400', accent2: '#fff1b5', trim: '#fff6df', text: ['#fff7d6', '#ffd23a'], body: 0xdf4a14 },
  emerald: { base: '#0e8048', base2: '#04412a', accent: '#ffd21f', accent2: '#ff3b3b', trim: '#f3f6ee', text: ['#ffffff', '#c9ff9a'], body: 0x0c7a45 },
  rose: { base: '#c01877', base2: '#5a0b3b', accent: '#ffb6e1', accent2: '#7fd9ff', trim: '#fff0f8', text: ['#ffffff', '#ffc2ea'], body: 0xb81674 },
  crimson: { base: '#b0101c', base2: '#4a0509', accent: '#ffffff', accent2: '#f2b01e', trim: '#f3ede0', text: ['#ffffff', '#ffd0a0'], body: 0xa80f1a },
  ocean: { base: '#0b93a8', base2: '#04485a', accent: '#ffffff', accent2: '#ffb300', trim: '#f2fbfc', text: ['#ffffff', '#b3f2ff'], body: 0x0a8ea4 },
  royal: { base: '#5a2bb8', base2: '#26115a', accent: '#ffd21f', accent2: '#ff5fa8', trim: '#f5f0ff', text: ['#ffffff', '#ffe27a'], body: 0x5528b0 },
  noir: { base: '#14171c', base2: '#06070a', accent: '#26e0ff', accent2: '#ff2fb4', trim: '#d9dde3', text: ['#ffffff', '#7ff0ff'], body: 0x13161b },
  ivory: { base: '#efe8d6', base2: '#bfb394', accent: '#1950c4', accent2: '#d6232a', trim: '#ffffff', text: ['#1950c4', '#0b2a7a'], body: 0xe9e1cc },
  lime: { base: '#7bc620', base2: '#2c6a08', accent: '#fff200', accent2: '#ff4b1f', trim: '#fbffe8', text: ['#ffffff', '#fff68a'], body: 0x74be1c },
};
export const JEEPNEY_NAMES = ['BLESSED', 'DIVINE GRACE', 'MARY JOY', 'SAN ANTONIO', 'ANGELS WING', 'BAHALA NA', 'TRUE LOVE', 'SANTO NINO', 'GOD IS GOOD', 'LADY LUCK', 'SWEET HOME', 'ROAD KING'];
export const JEEPNEY_ROUTES = ['DUMAGUETE - BACOLOD', 'DUMAGUETE - SIQUIJOR', 'CEBU - MANDAUE', 'CEBU - COLON', 'DUMAGUETE - VALENCIA', 'CEBU - TALISAY'];
export function resolvePalette(p, rng) {
  if (!p) return JEEPNEY_PALETTES[rng.pick(Object.keys(JEEPNEY_PALETTES))];
  if (typeof p === 'string') return JEEPNEY_PALETTES[p] || JEEPNEY_PALETTES.blessed;
  if (Array.isArray(p)) { const c = (i, d) => '#' + new THREE.Color(p[i] ?? d).getHexString(); return { base: c(0, 0x1040a0), base2: '#' + new THREE.Color(p[0]).multiplyScalar(0.4).getHexString(), accent: c(1, 0xffd21f), accent2: c(2, 0xe82a2b), trim: c(3, 0xf4f4f0), text: ['#ffffff', c(1, 0xffd21f)], body: p[0] }; }
  return { ...JEEPNEY_PALETTES.blessed, ...p };
}

const FONT = (size, italic = true) => `${italic ? 'italic ' : ''}900 ${size}px Impact, "Arial Black", "Liberation Sans", "DejaVu Sans", sans-serif`;
const SCRIPT = (size) => `italic bold ${size}px "Brush Script MT", "Segoe Script", "Liberation Serif", "DejaVu Serif", serif`;
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const withAlpha = (c, a) => { const col = new THREE.Color(c); return `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`; };
const lighten = (c, k) => '#' + new THREE.Color(c).lerp(new THREE.Color(0xffffff), k).getHexString();
const darken = (c, k) => '#' + new THREE.Color(c).lerp(new THREE.Color(0x000000), k).getHexString();

/** ribbon along a spline with width profile wf(t) (t 0..1) */
function ribbon(ctx, pts, wf, fill, stroke = null, lw = 0) {
  const curve = new THREE.SplineCurve(pts.map((p) => new THREE.Vector2(p[0], p[1]))); const n = 40; const P = curve.getPoints(n); const L = [], R = [];
  for (let i = 0; i <= n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)]; let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const w = wf(i / n) / 2; L.push([P[i].x - dy * w, P[i].y + dx * w]); R.push([P[i].x + dy * w, P[i].y - dx * w]); }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= n; i++) ctx.lineTo(L[i][0], L[i][1]); for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
const taper = (p = 0.5, k = 1) => (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, Math.log(0.5) / Math.log(p))), 0.7) * k;

/** chrome-effect lettering: extrusion, dark outline, gradient fill, glints */
export function fancyText(ctx, text, cx, cy, maxW, size, { fill = ['#fff', '#ffd'], outline = '#111', extrude = '#000', depth = 10, italic = true, skew = -0.18, glow = null, font = null } = {}) {
  ctx.save(); ctx.font = font || FONT(size, italic); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const m = ctx.measureText(text); const sx = Math.min(1.35, maxW / Math.max(1, m.width)); ctx.translate(cx, cy); ctx.transform(sx, 0, skew, 1, 0, 0);
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.35; ctx.fillStyle = glow; ctx.fillText(text, 0, 0); ctx.shadowBlur = 0; }
  for (let i = depth; i > 0; i--) { ctx.fillStyle = extrude; ctx.strokeStyle = extrude; ctx.lineWidth = size * 0.14; ctx.strokeText(text, i * 0.8, i * 0.9); ctx.fillText(text, i * 0.8, i * 0.9); }
  ctx.strokeStyle = outline; ctx.lineWidth = size * 0.16; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = lin(ctx, 0, -size * 0.5, 0, size * 0.5, [[0, fill[0]], [0.55, fill[0]], [0.58, fill[1]], [1, fill[1]]]); ctx.fillText(text, 0, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = size * 0.025; ctx.save(); ctx.translate(0, -size * 0.02); ctx.strokeText(text, 0, 0); ctx.restore();
  ctx.restore();
}
function scroll(ctx, x, y, s, flip, col, shade) {
  // curly scroll ornament: spiral + tail
  ctx.save(); ctx.translate(x, y); ctx.scale(flip * s, s); ctx.lineCap = 'round';
  for (const [c, dx, dy, lw] of [[shade, 4, 6, 14], [col, 0, 0, 10]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(dx - 200, dy + 30);
    ctx.bezierCurveTo(dx - 120, dy - 70, dx - 20, dy + 60, dx + 40, dy);
    ctx.bezierCurveTo(dx + 90, dy - 40, dx + 60, dy - 90, dx + 20, dy - 70);
    ctx.bezierCurveTo(dx - 10, dy - 55, dx, dy - 20, dx + 20, dy - 25); ctx.stroke();
  }
  ctx.restore();
}
function flames(ctx, x0, y0, dir, len, hgt, rng, pal, n = 7) {
  // flame tongues start at (x0, y0..y0-hgt) and sweep in direction `dir` (+1 right, -1 left)
  const layers = [['#2a0000', 1.06, '#7a0a05'], [pal.accent2 || '#e8262b', 1.0, '#ff3b14'], ['#ff7a1a', 0.78, '#ffa51f'], ['#ffd21f', 0.5, '#fff6a0'], ['#fffbe0', 0.22, '#ffffff']];
  for (const [c, k, c2] of layers) {
    const r2 = new RNG(rng.s);
    for (let i = 0; i < n; i++) {
      const by = y0 - (i / (n - 1)) * hgt; const L = len * (0.45 + 0.55 * r2.next()) * (1 - 0.35 * i / n) * k; const rise = hgt * 0.16 * (0.5 + r2.next()) * (i < n / 2 ? 1 : 1.4);
      const pts = [[x0, by], [x0 + dir * L * 0.3, by - rise * 0.2], [x0 + dir * L * 0.65, by + rise * 0.6 * (r2.chance(0.5) ? 1 : -1) - rise * 0.5], [x0 + dir * L, by - rise * 1.1]];
      ribbon(ctx, pts, taper(0.35, hgt / n * 2.3 * k + 6), lin(ctx, x0, 0, x0 + dir * L, 0, [[0, c2], [0.6, c], [1, c]]));
    }
  }
}
function swooshes(ctx, W, H, dir, pal, rng) {
  const sets = [[pal.trim, 26, 0.0], [pal.accent, 46, 0.045], [pal.accent2, 34, 0.1], [pal.base2, 60, 0.15]];
  sets.forEach(([c, wd, off], i) => {
    const y = H * (0.80 - off * 0.7);
    ribbon(ctx, [[W * (dir > 0 ? -0.02 : 1.02), y + 140], [W * (dir > 0 ? 0.3 : 0.7), y + 20], [W * (dir > 0 ? 0.62 : 0.38), y - 40 - i * 8], [W * (dir > 0 ? 1.02 : -0.02), y - 150 - i * 20]], taper(0.5, wd), lin(ctx, 0, 0, W, 0, [[0, withAlpha(c, 0.95)], [0.5, c], [1, withAlpha(c, 0.9)]]));
  });
}
function cartouche(ctx, cx, cy, w, h, pal, rng, kind) {
  ctx.save(); ctx.translate(cx, cy);
  // gold frame
  rr(ctx, -w / 2 - 18, -h / 2 - 18, w + 36, h + 36, h * 0.4); ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, [[0, '#fff3b0'], [0.5, '#c88a12'], [1, '#6d4300']]); ctx.fill();
  rr(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, h * 0.36); ctx.fillStyle = '#1a0f05'; ctx.fill();
  ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, h * 0.34); ctx.clip();
  // sky
  ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, kind === 1 ? [[0, '#14246b'], [0.55, '#d94a8c'], [0.8, '#ffb347'], [1, '#ffe08a']] : [[0, '#2e7ad6'], [0.6, '#8fd0ff'], [1, '#e6f6ff']]); ctx.fillRect(-w / 2, -h / 2, w, h);
  // sun
  ctx.fillStyle = lin(ctx, 0, -h * 0.1, 0, h * 0.25, [[0, '#fffbe0'], [1, '#ffb52e']]); ctx.beginPath(); ctx.arc(w * 0.12, h * 0.05, h * 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = withAlpha('#ffe9a0', 0.25); ctx.beginPath(); ctx.arc(w * 0.12, h * 0.05, h * 0.34, 0, TAU); ctx.fill();
  // clouds
  ctx.fillStyle = withAlpha('#ffffff', kind === 1 ? 0.35 : 0.8); for (let i = 0; i < 5; i++) { const x = rng.range(-w / 2, w / 2), y = rng.range(-h / 2, -h * 0.05); ctx.beginPath(); ctx.ellipse(x, y, rng.range(40, 90), rng.range(10, 22), 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 30, y - 8, 40, 14, 0, 0, TAU); ctx.fill(); }
  // mountains
  ctx.fillStyle = kind === 1 ? '#3a1750' : '#356b57'; ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.3); ctx.lineTo(-w * 0.3, -h * 0.12); ctx.lineTo(-w * 0.12, h * 0.1); ctx.lineTo(w * 0.05, -h * 0.28); ctx.lineTo(w * 0.28, h * 0.16); ctx.lineTo(w * 0.4, -h * 0.05); ctx.lineTo(w / 2, h * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = withAlpha('#ffffff', 0.55); ctx.beginPath(); ctx.moveTo(w * 0.05, -h * 0.28); ctx.lineTo(w * 0.0, -h * 0.17); ctx.lineTo(w * 0.04, -h * 0.2); ctx.lineTo(w * 0.07, -h * 0.15); ctx.lineTo(w * 0.1, -h * 0.19); ctx.closePath(); ctx.fill();
  // sea
  ctx.fillStyle = lin(ctx, 0, h * 0.2, 0, h / 2, kind === 1 ? [[0, '#e0698a'], [1, '#2a1c5c']] : [[0, '#4ec3e0'], [1, '#0b4f7a']]); ctx.fillRect(-w / 2, h * 0.2, w, h * 0.4);
  ctx.strokeStyle = withAlpha('#ffffff', 0.6); ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { const y = h * (0.26 + i * 0.045), x = rng.range(-w / 2, w / 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40, y - 8, x + 80, y); ctx.stroke(); }
  // palm + bangka boat silhouette
  ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-w * 0.36, h * 0.45); ctx.quadraticCurveTo(-w * 0.34, h * 0.1, -w * 0.3, -h * 0.1); ctx.stroke();
  ctx.fillStyle = '#143a14'; for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.5; ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.1); ctx.quadraticCurveTo(-w * 0.3 + Math.cos(a) * 60, -h * 0.1 + Math.sin(a) * 40 - 20, -w * 0.3 + Math.cos(a) * 110, -h * 0.1 + Math.sin(a) * 60 + 20); ctx.quadraticCurveTo(-w * 0.3 + Math.cos(a) * 60, -h * 0.1 + Math.sin(a) * 40 + 5, -w * 0.3, -h * 0.1); ctx.fill(); }
  ctx.fillStyle = '#1a0d05'; ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.34); ctx.lineTo(w * 0.42, h * 0.34); ctx.lineTo(w * 0.38, h * 0.4); ctx.lineTo(w * 0.24, h * 0.4); ctx.closePath(); ctx.fill(); ctx.fillRect(w * 0.31, h * 0.2, 5, h * 0.14); ctx.beginPath(); ctx.moveTo(w * 0.315, h * 0.2); ctx.lineTo(w * 0.4, h * 0.32); ctx.lineTo(w * 0.315, h * 0.32); ctx.fill();
  ctx.restore();
  ctx.restore();
}
function horseHead(ctx, cx, cy, s, flip, col) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(flip * s, s); ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(-60, 100); ctx.bezierCurveTo(-70, 40, -50, -40, -10, -90); ctx.lineTo(-5, -120); ctx.lineTo(15, -92); ctx.bezierCurveTo(60, -90, 100, -40, 118, 20); ctx.bezierCurveTo(128, 50, 110, 70, 90, 62); ctx.bezierCurveTo(70, 58, 55, 40, 30, 36); ctx.bezierCurveTo(10, 60, 0, 90, 10, 100); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(30, -40, 8, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(104, 38, 6, 10, 0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 7; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-20 - i * 8, -70 + i * 26); ctx.quadraticCurveTo(-60 - i * 10, -40 + i * 28, -80 - i * 8, -20 + i * 30); ctx.stroke(); }
  ctx.restore();
}
function stars(ctx, cx, cy, n, spread, rng, col) { ctx.fillStyle = col; for (let i = 0; i < n; i++) { const x = cx + rng.range(-spread, spread), y = cy + rng.range(-40, 40), s = rng.range(6, 16); ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? s * 0.25 : s; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); } }

/** Side panel painter. Logical size 4300 x 640 (mm). dir = +1 if the vehicle front is on the RIGHT of the image, -1 if on the left. */
export function paintSide(ctx, W, H, o) {
  const { pal, name, route, dir, seed } = o; const rng = new RNG(seed);
  const front = dir > 0 ? W : 0;
  // base airbrush
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, lighten(pal.base, 0.12)], [0.5, pal.base], [1, pal.base2]]); ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(150, 420); const g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = rng.pick([pal.accent2, pal.base2, pal.accent, lighten(pal.base, 0.3)]); g.addColorStop(0, withAlpha(c, 0.22)); g.addColorStop(1, withAlpha(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  swooshes(ctx, W, H, dir, pal, rng);
  flames(ctx, front + dir * -80, H * 0.9, -dir, W * 0.34, H * 0.62, new RNG(seed + 5), pal, 8);
  // rear scroll ornaments + stars
  const rear = dir > 0 ? 0 : W;
  scroll(ctx, rear + dir * 280, H * 0.5, 0.9, dir, pal.accent, '#000'); scroll(ctx, rear + dir * 280, H * 0.5, 0.9, dir, pal.accent, '#000');
  stars(ctx, W * 0.5, H * 0.22, 14, W * 0.38, rng, withAlpha(pal.trim, 0.9));
  // mural cartouches (rear one + one inside the cab door) — kept out of the rear wheel-arch cut-out (u 0.32..0.53, lower 56%)
  const X = (u) => (dir > 0 ? W * u : W * (1 - u));
  cartouche(ctx, X(0.115), H * 0.46, 540, 320, pal, new RNG(seed + 1), 1);
  cartouche(ctx, X(0.86), H * 0.42, 560, 300, pal, new RNG(seed + 2), 0);
  // lettering
  fancyText(ctx, name, X(0.47), H * 0.31, 1900, 310, { fill: pal.text, outline: '#0a0a0a', extrude: darken(pal.accent2, 0.5), depth: 14, glow: withAlpha(pal.accent, 0.5) });
  // route banner (rear, below the rear mural)
  ctx.save(); ctx.translate(X(0.155), H * 0.885); rr(ctx, -590, -44, 1180, 88, 18); ctx.fillStyle = lin(ctx, 0, -44, 0, 44, [[0, '#ffffff'], [1, '#d8d8d0']]); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
  fancyText(ctx, route, X(0.155), H * 0.885, 1100, 62, { fill: ['#111', '#000'], outline: '#fff', extrude: 'rgba(0,0,0,0)', depth: 0, italic: false, skew: 0 });
  // little script sticker under the name (above the wheel arch)
  ctx.save(); ctx.fillStyle = withAlpha(pal.trim, 0.95); ctx.font = SCRIPT(78); ctx.textAlign = 'center'; ctx.fillText('God Bless Our Trip', X(0.47), H * 0.58, 1000); ctx.restore();
  ctx.save(); ctx.fillStyle = withAlpha(pal.accent, 0.95); ctx.font = SCRIPT(60); ctx.textAlign = 'center'; ctx.fillText('Ride Safely', X(0.67), H * 0.6, 500); ctx.restore();
  // pinstripes top & bottom edges
  for (const [y, c, lw] of [[14, pal.accent, 8], [34, pal.trim, 4], [H - 14, pal.accent, 8], [H - 34, pal.trim, 4]]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (o.cab) {
    // cab door: shut lines + door handle plate + "PARA PO" sign ghost
    const dx = front - dir * 760; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 7;
    for (const x of [front - dir * 70, front - dir * 1130]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(front - dir * 140 - 60, H * 0.1, 120, 20);
  }
}
/** hood top painter (logical 1000x1400 mm: x across, y = z (front at top)) */
export function paintHood(ctx, W, H, o) {
  const { pal } = o; const rng = new RNG(o.seed + 11);
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, lighten(pal.base, 0.1)], [1, pal.base2]]); ctx.fillRect(0, 0, W, H);
  // racing stripes
  for (const [x, w, c] of [[W * 0.5, 120, pal.trim], [W * 0.31, 60, pal.accent], [W * 0.69, 60, pal.accent], [W * 0.5, 36, pal.accent2]]) { ctx.fillStyle = c; ctx.fillRect(x - w / 2, 0, w, H); }
  // flames from the nose
  ctx.save(); ctx.translate(W / 2, H); ctx.rotate(-Math.PI / 2); // draw flames sweeping toward the cab (up the canvas)
  flames(ctx, 0, 330, 1, H * 0.55, 660, rng, pal, 7); ctx.restore();
  fancyText(ctx, o.short || 'BLESSED', W * 0.5, H * 0.18, 700, 170, { fill: pal.text, outline: '#000', extrude: darken(pal.accent2, 0.5), depth: 8 });
  ctx.strokeStyle = pal.accent; ctx.lineWidth = 10; ctx.strokeRect(14, 14, W - 28, H - 28);
}
/** front sign board (logical 1900 x 260 mm) lit with bulbs */
export function paintSign(ctx, W, H, o) {
  const { pal } = o;
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, lighten(pal.base2, 0.15)], [1, pal.base2]]); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#ffffff'], [0.15, pal.base], [1, pal.base2]]); rr(ctx, 30, 30, W - 60, H - 60, 24); ctx.fill();
  fancyText(ctx, o.name, W * 0.5, H * 0.52, W * 0.72, 150, { fill: pal.text, outline: '#000', extrude: darken(pal.accent2, 0.4), depth: 7, glow: withAlpha(pal.accent, 0.6) });
  const n = 36; for (let i = 0; i < n; i++) { const x = 60 + i * (W - 120) / (n - 1); for (const y of [16, H - 16]) { const c = ['#fff6c0', '#ff4040', '#40ff80', '#4090ff'][i % 4]; const g = ctx.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, c); g.addColorStop(1, withAlpha(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - 14, y - 14, 28, 28); } }
  stars(ctx, 150, H / 2, 3, 40, new RNG(3), pal.accent); stars(ctx, W - 150, H / 2, 3, 40, new RNG(4), pal.accent);
}
/** rear header board (logical 1900 x 300) */
export function paintRear(ctx, W, H, o) {
  const { pal } = o; const rng = new RNG(o.seed + 23);
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, lighten(pal.base, 0.1)], [1, pal.base2]]); ctx.fillRect(0, 0, W, H);
  swooshes(ctx, W, H, 1, pal, rng);
  fancyText(ctx, o.name, W * 0.5, H * 0.44, W * 0.7, 190, { fill: pal.text, outline: '#000', extrude: darken(pal.accent2, 0.5), depth: 10 });
  ctx.fillStyle = withAlpha(pal.trim, 0.95); ctx.font = SCRIPT(70); ctx.textAlign = 'center'; ctx.fillText('God Bless Our Trip - Ride Safely', W * 0.5, H * 0.86, 1300);
  scroll(ctx, 220, H * 0.5, 0.7, 1, pal.accent, '#000'); scroll(ctx, W - 220, H * 0.5, 0.7, -1, pal.accent, '#000');
}
/** windshield banner (logical 1700 x 150): tinted sun-strip with the name */
export function paintBanner(ctx, W, H, o) {
  const { pal } = o; ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, 'rgba(10,10,20,0.85)'], [0.7, 'rgba(10,10,20,0.55)'], [1, 'rgba(10,10,20,0)']]); ctx.fillRect(0, 0, W, H);
  fancyText(ctx, o.name, W * 0.5, H * 0.46, W * 0.5, 96, { fill: ['#ffffff', '#ffe27a'], outline: '#000', extrude: '#000', depth: 3 });
  stars(ctx, W * 0.14, H * 0.46, 3, 120, new RNG(8), pal.accent); stars(ctx, W * 0.86, H * 0.46, 3, 120, new RNG(9), pal.accent);
  // sticker row at the bottom
  for (let i = 0; i < 9; i++) { const x = 90 + i * 190, c = [pal.accent, pal.accent2, '#ffffff', pal.base][i % 4]; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, H * 0.84, 15, 0, TAU); ctx.fill(); }
}

/** cached art set for a jeepney design */
export function jeepneyArt({ palette, name, route, seed, short }) {
  const key = `jp:${JSON.stringify(palette.base)}:${palette.accent}:${name}:${route}:${seed}`;
  return cached(key + ':set', () => {
    const SW = 4300, SH = 700, tw = texRes(1024), th = texRes(512);
    const side = (dir) => canvasTex(tw, th, (ctx, w, h) => { ctx.save(); ctx.scale(w / SW, h / SH); paintSide(ctx, SW, SH, { pal: palette, name, route, dir, seed, cab: true }); ctx.restore(); }, { wrap: 'clamp', aniso: 8 });
    const set = {
      sideL: side(1), sideR: side(-1), // sideL: image front on the right (left flank seen from outside), sideR: front on the left
      hood: canvasTex(texRes(512), texRes(512), (ctx, w, h) => { ctx.save(); ctx.scale(w / 1000, h / 1400); paintHood(ctx, 1000, 1400, { pal: palette, seed, short: short || name }); ctx.restore(); }, { wrap: 'clamp' }),
      sign: canvasTex(texRes(1024), texRes(256), (ctx, w, h) => { ctx.save(); ctx.scale(w / 1900, h / 260); paintSign(ctx, 1900, 260, { pal: palette, name }); ctx.restore(); }, { wrap: 'clamp' }),
      rear: canvasTex(texRes(1024), texRes(256), (ctx, w, h) => { ctx.save(); ctx.scale(w / 1900, h / 300); paintRear(ctx, 1900, 300, { pal: palette, name, seed }); ctx.restore(); }, { wrap: 'clamp' }),
      banner: canvasTex(texRes(1024), texRes(128), (ctx, w, h) => { ctx.save(); ctx.scale(w / 1700, h / 150); paintBanner(ctx, 1700, 150, { pal: palette, name }); ctx.restore(); }, { wrap: 'clamp' }),
    };
    for (const k in set) set[k].userData.shared = true;
    set.userData = { shared: true }; return set;
  });
}
