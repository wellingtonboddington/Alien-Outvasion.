// Canvas drawers: default animated content for screens (world map, radar, telemetry, ticker, news, DNA, CCTV, alien glyphs ...).
// Every drawer: (ctx, w, h, t, S) where S = kit.state {threat, alert, infect}. All are pure functions of t (seekable).
import { RNG, TAU, Q } from '../../../engine/common.js';
import { makeCanvas } from '../../../engine/proc.js';
import { hash2 } from './tex.js';

export const SANS = 'Arial, "Helvetica Neue", Helvetica, "DejaVu Sans", sans-serif';
export const MONO = '"DejaVu Sans Mono", Consolas, "Courier New", monospace';
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
const hs = (i, s = 0) => hash2(i | 0, (i * 7 + 3) | 0, s);

// ---------------- world geometry (coarse lon/lat polygons) ----------------
const LAND = [
  // North America
  [[-168, 65], [-165, 68], [-156, 71], [-140, 70], [-125, 70], [-110, 68], [-95, 70], [-85, 69], [-82, 64], [-90, 60], [-94, 58], [-88, 56], [-82, 53], [-79, 56], [-78, 62], [-72, 62], [-65, 60], [-62, 57], [-56, 52], [-60, 47], [-66, 45], [-70, 43], [-74, 40], [-76, 36], [-81, 31], [-80, 26], [-83, 29], [-85, 30], [-90, 29], [-94, 29], [-97, 26], [-97, 22], [-94, 18], [-90, 21], [-87, 21], [-88, 16], [-83, 15], [-82, 9], [-78, 8], [-80, 7], [-86, 11], [-90, 13], [-96, 16], [-105, 20], [-106, 23], [-110, 27], [-113, 31], [-110, 23], [-115, 28], [-117, 32], [-121, 35], [-124, 40], [-124, 47], [-128, 51], [-135, 58], [-142, 60], [-150, 60], [-158, 57], [-165, 54], [-160, 58], [-165, 62]],
  // South America
  [[-78, 8], [-72, 12], [-62, 10], [-52, 5], [-50, 0], [-44, -2], [-35, -6], [-38, -13], [-40, -20], [-48, -26], [-53, -34], [-58, -38], [-63, -41], [-65, -47], [-69, -52], [-72, -54], [-74, -47], [-73, -38], [-71, -30], [-70, -18], [-76, -14], [-81, -6], [-80, -2], [-78, 2]],
  // Eurasia
  [[-9, 43], [-2, 44], [-1, 46], [-4, 48], [2, 51], [5, 53], [8, 54], [10, 57], [11, 55], [14, 54], [20, 54], [22, 57], [24, 59], [30, 60], [32, 63], [38, 64], [42, 67], [44, 68], [54, 68], [60, 69], [68, 69], [73, 72], [80, 73], [90, 76], [104, 78], [112, 74], [127, 73], [140, 72], [150, 71], [160, 69], [170, 70], [180, 69], [180, 65], [178, 62], [170, 60], [163, 58], [160, 54], [156, 51], [155, 58], [150, 59], [142, 59], [137, 54], [141, 52], [140, 48], [135, 43], [130, 42], [129, 36], [126, 35], [126, 38], [125, 40], [121, 40], [118, 38], [122, 37], [120, 34], [122, 30], [120, 26], [116, 23], [110, 21], [108, 17], [109, 12], [105, 9], [100, 13], [100, 8], [104, 1], [100, 3], [98, 8], [98, 16], [94, 17], [92, 22], [88, 22], [87, 21], [80, 15], [77, 8], [73, 16], [72, 21], [67, 24], [62, 25], [57, 26], [56, 27], [52, 28], [48, 30], [50, 27], [56, 24], [59, 22], [52, 17], [45, 13], [43, 13], [38, 22], [35, 28], [34, 31], [36, 35], [30, 36], [27, 37], [26, 40], [23, 40], [24, 38], [21, 37], [19, 41], [14, 45], [12, 44], [16, 41], [16, 38], [13, 38], [9, 44], [3, 43], [0, 39], [-2, 37], [-5, 36], [-9, 37]],
  // Scandinavia
  [[5, 59], [5, 62], [10, 64], [15, 68], [20, 70], [28, 71], [30, 69], [26, 66], [22, 65], [25, 62], [21, 60], [17, 59], [18, 56], [14, 56], [11, 58], [8, 58]],
  // Africa
  [[-17, 21], [-13, 28], [-9, 32], [-5, 36], [10, 37], [11, 33], [20, 31], [32, 31], [34, 28], [37, 22], [43, 12], [51, 12], [48, 5], [40, -3], [40, -10], [35, -20], [33, -26], [27, -34], [20, -35], [16, -29], [12, -17], [13, -8], [9, -1], [9, 4], [5, 5], [-4, 5], [-8, 4], [-13, 8], [-17, 14]],
  [[-5, 50], [1, 51], [2, 53], [-2, 56], [-3, 58.5], [-6, 58], [-5, 55], [-3, 54], [-5, 52]], // GB
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]], // Ireland
  [[-52, 60], [-44, 60], [-22, 70], [-18, 76], [-20, 82], [-40, 83], [-60, 82], [-72, 78], [-58, 75], [-52, 68]], // Greenland
  [[-24, 64], [-14, 64], [-14, 66], [-22, 66]], // Iceland
  [[130, 31], [135, 34], [140, 36], [142, 40], [142, 45], [140, 41], [137, 37], [132, 34]], // Japan
  [[120, 18], [122, 18], [122, 14], [121, 13], [120, 15]], // Luzon
  [[122, 9], [126, 9], [126, 6], [122, 7]], // Mindanao
  [[123, 11], [125, 11.5], [125, 10], [123, 9.5]], // Visayas
  [[109, 1], [110, -3], [116, -4], [118, 1], [119, 5], [116, 7], [113, 3]], // Borneo
  [[95, 5], [98, 4], [104, -2], [106, -6], [102, -4], [97, 1]], // Sumatra
  [[105, -6], [114, -8], [114, -7]], // Java
  [[119, 0], [125, 1], [121, -4], [120, -5]], // Sulawesi
  [[131, -1], [140, -3], [147, -6], [150, -10], [143, -9], [138, -8], [133, -4]], // New Guinea
  [[114, -22], [122, -17], [130, -12], [137, -12], [136, -16], [142, -11], [146, -19], [153, -26], [151, -34], [146, -39], [140, -38], [135, -34], [129, -32], [124, -34], [115, -34], [114, -26]], // Australia
  [[172, -35], [178, -38], [175, -41], [173, -41]], [[167, -46], [174, -41], [171, -45]], // NZ
  [[44, -25], [50, -15], [49, -12], [44, -17]], // Madagascar
  [[80, 6], [82, 7], [80, 9]], [[120, 22], [122, 25], [121, 25], [120, 23]], // Sri Lanka, Taiwan
  [[-85, 22], [-74, 20], [-78, 22]], // Cuba
  [[-80, 63], [-62, 66], [-68, 72], [-80, 72]], [[-118, 70], [-105, 69], [-105, 73], [-118, 73]], // arctic islands
  [[-180, -72], [180, -72], [180, -90], [-180, -90]], // Antarctica
];
const SEAS = [[[28, 42], [28, 46], [34, 46], [41, 42], [36, 41.5], [30, 41]], [[47, 45], [53, 47], [53, 41], [54, 37], [49, 37], [50, 40]]];

let _land = null;
export function landMask() {
  if (_land) return _land;
  const c = makeCanvas(360, 180), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 360, 180);
  const poly = (p, col) => { x.fillStyle = col; x.beginPath(); p.forEach((q, i) => { const px = q[0] + 180, py = 90 - q[1]; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); x.fill(); };
  for (const p of LAND) poly(p, '#fff'); for (const p of SEAS) poly(p, '#000');
  const d = x.getImageData(0, 0, 360, 180).data; const m = new Uint8Array(360 * 180); for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
  _land = { canvas: c, m, isLand(lon, lat) { const ix = Math.floor(lon + 180), iy = Math.floor(90 - lat); if (ix < 0 || ix > 359 || iy < 0 || iy > 179) return false; return m[iy * 360 + ix] === 1; } }; return _land;
}

export const CITIES = {
  washington: [-77, 38.9, 'WASHINGTON'], newyork: [-74, 40.7, 'NEW YORK'], la: [-118, 34, 'LOS ANGELES'], mexico: [-99, 19.4, 'MEXICO CITY'], saopaulo: [-46.6, -23.5, 'SAO PAULO'],
  london: [0, 51.5, 'LONDON'], paris: [2.3, 48.9, 'PARIS'], berlin: [13.4, 52.5, 'BERLIN'], moscow: [37.6, 55.8, 'MOSCOW'], tbilisi: [44.8, 41.7, 'TBILISI'], cairo: [31, 30, 'CAIRO'], lagos: [3.4, 6.5, 'LAGOS'], capetown: [18.4, -34, 'CAPE TOWN'],
  dubai: [55, 25, 'DUBAI'], delhi: [77.2, 28.6, 'DELHI'], beijing: [116.4, 40, 'BEIJING'], tokyo: [139.7, 35.7, 'TOKYO'], seoul: [127, 37.5, 'SEOUL'], singapore: [104, 1.3, 'SINGAPORE'], manila: [121, 14.6, 'MANILA'], cebu: [123.9, 10.3, 'CEBU'], dumaguete: [123.3, 9.3, 'DUMAGUETE'], sydney: [151, -34, 'SYDNEY'],
};
const THEMES = {
  cyan: { bg: '#031018', dot: '#1f7f9c', dot2: '#46e6ff', grid: 'rgba(70,230,255,0.10)', text: '#8ff0ff', hot: '#ff3b30', warn: '#ffb020', ok: '#46e6ff' },
  amber: { bg: '#120a02', dot: '#8a5a1a', dot2: '#ffb030', grid: 'rgba(255,176,48,0.10)', text: '#ffd080', hot: '#ff3b30', warn: '#ffe040', ok: '#ffb030' },
  green: { bg: '#021008', dot: '#1a7a3a', dot2: '#5cff7a', grid: 'rgba(92,255,122,0.10)', text: '#a8ffb8', hot: '#ff3b30', warn: '#ffd040', ok: '#5cff7a' },
  blue: { bg: '#02060f', dot: '#2a58a8', dot2: '#78b0ff', grid: 'rgba(120,176,255,0.10)', text: '#b8d4ff', hot: '#ff4a40', warn: '#ffc040', ok: '#78b0ff' },
};
export const theme = (n) => THEMES[n] || THEMES.cyan;

const _mapCache = new Map();
/** dot-matrix world base layer rendered once per size/theme. Returns {canvas, rect:{x,y,w,h}}; lat range 84..-60 */
export function mapBase(w, h, themeName = 'cyan', { pad = 0.04, top = 0 } = {}) {
  const key = `${w}x${h}:${themeName}:${pad}:${top}`; if (_mapCache.has(key)) return _mapCache.get(key);
  const th = theme(themeName), L = landMask(); const c = makeCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = th.bg; x.fillRect(0, 0, w, h);
  const mw = w * (1 - pad * 2), mh = mw * (144 / 360), my = top ? top : (h - mh) / 2; const mx = w * pad; const rect = { x: mx, y: my, w: mw, h: mh };
  const cell = Math.max(3, Math.round(mw / 130));
  x.strokeStyle = th.grid; x.lineWidth = 1; x.beginPath();
  for (let lo = -180; lo <= 180; lo += 30) { const px = mx + (lo + 180) / 360 * mw; x.moveTo(px, my); x.lineTo(px, my + mh); }
  for (let la = -60; la <= 80; la += 20) { const py = my + (84 - la) / 144 * mh; x.moveTo(mx, py); x.lineTo(mx + mw, py); } x.stroke();
  for (let py = 0; py < mh; py += cell) for (let px = 0; px < mw; px += cell) {
    const lon = (px + cell / 2) / mw * 360 - 180, lat = 84 - (py + cell / 2) / mh * 144; const land = L.isLand(lon, lat);
    if (land) { x.fillStyle = th.dot; x.globalAlpha = 0.55 + 0.4 * hs(px * 131 + py, 4); x.fillRect(mx + px + 0.5, my + py + 0.5, cell - 1.4, cell - 1.4); } else { x.globalAlpha = 0.25; x.fillStyle = th.dot; x.fillRect(mx + px + cell / 2 - 0.5, my + py + cell / 2 - 0.5, 1.2, 1.2); }
  }
  x.globalAlpha = 1; const out = { canvas: c, rect, th, cell }; _mapCache.set(key, out); return out;
}
export const proj = (rect, lon, lat) => [rect.x + (lon + 180) / 360 * rect.w, rect.y + (84 - lat) / 144 * rect.h];

const DEF_MARKERS = [['washington', 0.2], ['moscow', 0.5], ['beijing', 0.6], ['delhi', 0.7], ['tbilisi', 0.75], ['berlin', 0.8], ['manila', 0.9], ['cebu', 0.92], ['london', 0.45], ['tokyo', 0.55], ['capetown', 0.85], ['saopaulo', 0.65], ['sydney', 0.95], ['cairo', 0.4], ['newyork', 0.3], ['la', 0.35]];

/** Tactical world map: dot-matrix continents, blinking markers (threat-driven), arcs, HUD text. */
export function drawWorldMap(ctx, w, h, t, S = {}, o = {}) {
  const base = mapBase(w, h, o.theme || 'cyan', { top: o.top }); const th = base.th, rect = base.rect;
  ctx.drawImage(base.canvas, 0, 0);
  const threat = S.threat ?? 0.5, inf = S.infect || 0; const markers = o.markers || DEF_MARKERS;
  // arcs (missile tracks / flight paths)
  ctx.lineWidth = Math.max(1, w / 700);
  const arcs = o.arcs ?? [['moscow', 'washington'], ['beijing', 'la'], ['tbilisi', 'london'], ['delhi', 'cairo'], ['manila', 'sydney']];
  arcs.forEach(([a, b], i) => {
    const A = CITIES[a], B = CITIES[b]; if (!A || !B) return; const pa = proj(rect, A[0], A[1]), pb = proj(rect, B[0], B[1]); const mx = (pa[0] + pb[0]) / 2, my = Math.min(pa[1], pb[1]) - Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) * 0.25;
    const act = threat * 1.3 - i * 0.18; if (act <= 0) return; ctx.strokeStyle = i % 2 ? th.warn : th.hot; ctx.globalAlpha = Math.min(1, act) * 0.7; ctx.setLineDash([w / 90, w / 160]); ctx.lineDashOffset = -t * w / 20; ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.quadraticCurveTo(mx, my, pb[0], pb[1]); ctx.stroke(); ctx.setLineDash([]);
    const k = fract(t * 0.12 + i * 0.27); const qx = (1 - k) * (1 - k) * pa[0] + 2 * (1 - k) * k * mx + k * k * pb[0], qy = (1 - k) * (1 - k) * pa[1] + 2 * (1 - k) * k * my + k * k * pb[1];
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(qx, qy, w / 300 + 1.5, 0, TAU); ctx.fill();
  }); ctx.globalAlpha = 1;
  const fs = Math.max(8, Math.round(w / 85)); ctx.font = `bold ${fs}px ${MONO}`; ctx.textBaseline = 'middle';
  markers.forEach(([c, lvl], i) => {
    const C = CITIES[c]; if (!C) return; const p = proj(rect, C[0], C[1]); const hot = lvl < threat; const ph = t * (hot ? 3.2 : 1.2) + i * 1.7; const pulse = 0.5 + 0.5 * Math.sin(ph);
    const col = inf > 0.5 ? '#6aff3a' : hot ? th.hot : th.ok; const r = w / 170;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.globalAlpha = hot ? 0.35 + 0.65 * pulse : 0.8; ctx.beginPath(); ctx.arc(p[0], p[1], r * (hot ? 1 + pulse * 1.8 : 1.2), 0, TAU); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.7, 0, TAU); ctx.fill();
    if (o.labels !== false && (hot || i < 6)) { ctx.fillStyle = th.text; ctx.globalAlpha = 0.85; ctx.fillText(C[2], p[0] + r * 2.4, p[1] - 1); ctx.globalAlpha = 1; }
  });
  // HUD
  if (o.hud !== false) {
    const big = Math.round(w / 38); ctx.font = `bold ${big}px ${SANS}`; ctx.fillStyle = th.text; ctx.textBaseline = 'top'; ctx.fillText(o.title || 'GLOBAL THREAT MAP', w * 0.035, h * 0.03);
    ctx.font = `${fs}px ${MONO}`; ctx.fillStyle = th.ok; const lvl = threat < 0.3 ? 'DEFCON 4' : threat < 0.6 ? 'DEFCON 3' : threat < 0.85 ? 'DEFCON 2' : 'DEFCON 1'; ctx.textAlign = 'right';
    ctx.fillText(`${lvl}   UNIDENTIFIED CONTACTS: ${Math.round(threat * 214)}`, w * 0.965, h * 0.035); ctx.textAlign = 'left';
    // scan line
    const sx = rect.x + fract(t * 0.08) * rect.w; const g = ctx.createLinearGradient(sx - w * 0.08, 0, sx, 0); g.addColorStop(0, 'rgba(70,230,255,0)'); g.addColorStop(1, th.dot2 + '55'); ctx.fillStyle = g; ctx.fillRect(sx - w * 0.08, rect.y, w * 0.08, rect.h);
    ctx.fillStyle = th.dot2; ctx.globalAlpha = 0.6; ctx.fillRect(sx, rect.y, 1.5, rect.h); ctx.globalAlpha = 1;
  }
  if (inf > 0.2) glitch(ctx, w, h, t, inf);
}
/** green glitch overlay used for infected screens */
export function glitch(ctx, w, h, t, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const n = Math.round(6 + a * 14);
  for (let i = 0; i < n; i++) { const k = Math.floor(t * 8); const y = hs(i * 31 + k, 5) * h, hh = h * (0.004 + hs(i + k * 13, 6) * 0.03); ctx.fillStyle = `rgba(60,255,26,${0.1 + 0.25 * a * hs(i + k, 7)})`; ctx.fillRect(hs(i + k, 8) * w * 0.3, y, w * (0.3 + 0.7 * hs(i + k, 9)), hh); }
  ctx.restore();
}

// ---------------- radar ----------------
export function drawRadar(ctx, w, h, t, S = {}, o = {}) {
  const th = theme(o.theme || 'green'); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46; ctx.strokeStyle = th.grid.replace('0.10', '0.35'); ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, TAU); ctx.stroke(); }
  ctx.beginPath(); for (let a = 0; a < 12; a++) { ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a * TAU / 12) * R, cy + Math.sin(a * TAU / 12) * R); } ctx.stroke();
  const ang = t * (o.speed || 1.6); const N = 28; for (let i = 0; i < N; i++) { const a0 = ang - i * 0.045; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0 - 0.05, a0); ctx.closePath(); ctx.fillStyle = th.dot2; ctx.globalAlpha = (1 - i / N) * 0.35; ctx.fill(); } ctx.globalAlpha = 1;
  ctx.strokeStyle = th.dot2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
  const nb = o.blips ?? 14; for (let i = 0; i < nb; i++) {
    const a = hs(i, 11) * TAU + t * (hs(i, 12) - 0.5) * 0.08, r = (0.15 + hs(i, 13) * 0.8) * R; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    let d = fract((ang - a) / TAU); const bright = Math.pow(1 - d, 3); if (bright < 0.03) continue; const hot = hs(i, 14) < (S.threat ?? 0.4) * 0.7;
    ctx.fillStyle = hot ? th.hot : th.dot2; ctx.globalAlpha = Math.min(1, bright * 1.2); ctx.beginPath(); ctx.arc(px, py, w / 90 + 2, 0, TAU); ctx.fill();
  } ctx.globalAlpha = 1;
  ctx.font = `${Math.round(h / 22)}px ${MONO}`; ctx.fillStyle = th.text; ctx.textBaseline = 'top'; ctx.fillText(o.title || 'RADAR  SECTOR 7', 8, 6); ctx.fillText(`RNG ${(120 + (t * 3) % 20).toFixed(0)} KM`, 8, h - Math.round(h / 22) - 6);
}

// ---------------- telemetry / graphs ----------------
export function drawTelemetry(ctx, w, h, t, S = {}, o = {}) {
  const th = theme(o.theme || 'cyan'); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
  const rows = o.rows || 4, ph = h / rows; ctx.font = `${Math.round(h / (rows * 5))}px ${MONO}`; ctx.textBaseline = 'top';
  for (let r = 0; r < rows; r++) {
    const y0 = r * ph + 4, hh = ph - 8; ctx.strokeStyle = th.grid.replace('0.10', '0.3'); ctx.strokeRect(6, y0, w - 12, hh);
    const col = r % 3 === 1 ? th.warn : th.dot2; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, h / 240); ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const x = 6 + i / 80 * (w - 12), tt = t * 0.9 + i * 0.12 + r * 7; const v = 0.5 + 0.25 * Math.sin(tt * (1 + r * 0.3)) + 0.15 * Math.sin(tt * 2.7 + r) + (hs(Math.floor(tt * 4) + r * 91, 3) - 0.5) * 0.12; const y = y0 + hh * (1 - Math.min(0.95, Math.max(0.05, v))); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.fillStyle = th.text; ctx.fillText((o.labels || ['ALT', 'VEL', 'TEMP', 'PRESS', 'FUEL', 'ATT'])[r % 6] + '  ' + (100 + 90 * Math.sin(t * 0.7 + r * 2)).toFixed(1), 12, y0 + 2);
  }
}
export function drawDataScroll(ctx, w, h, t, S = {}, o = {}) {
  const th = theme(o.theme || 'green'); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
  const fs = Math.max(8, Math.round(h / 14)); ctx.font = `${fs}px ${MONO}`; ctx.textBaseline = 'top'; const rows = Math.ceil(h / fs) + 1, off = (t * (o.speed || 6)) % 1;
  const base = Math.floor(t * (o.speed || 6));
  for (let r = 0; r < rows; r++) {
    const id = base + r; const y = h - (r + 1 - off) * fs; let s = ''; for (let k = 0; k < Math.floor(w / (fs * 0.62)); k++) { const v = hs(id * 17 + Math.floor(k / 5), 22); s += k % 5 === 4 ? ' ' : (v * 16 | 0).toString(16).toUpperCase(); }
    const hot = hs(id, 23) < 0.07 + (S.infect || 0) * 0.3; ctx.fillStyle = hot ? (S.infect > 0.3 ? '#6aff3a' : th.hot) : (r % 7 === 0 ? th.text : th.ok); ctx.globalAlpha = hot ? 1 : 0.45 + hs(id, 24) * 0.4; ctx.fillText(s, 4, y);
  } ctx.globalAlpha = 1;
}
export function drawStatusGrid(ctx, w, h, t, S = {}, o = {}) { // server / system status tiles
  const th = theme(o.theme || 'green'); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h); const cols = o.cols || 12, rows = o.rows || 7, cw = w / cols, ch = h / rows; const inf = S.infect || 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const id = j * cols + i, k = Math.floor(t * 1.5 + id * 0.37), v = hs(id * 5 + k, 31); let col = th.ok; if (v < 0.05 + S.threat * 0.1) col = th.hot; else if (v < 0.16) col = th.warn; if (inf > 0 && hs(id, 32) < inf) col = '#6aff3a';
    ctx.fillStyle = col; ctx.globalAlpha = 0.18 + 0.5 * hs(id + k, 33); ctx.fillRect(i * cw + 2, j * ch + 2, cw - 4, ch - 4); ctx.globalAlpha = 0.9; ctx.fillRect(i * cw + 2, j * ch + 2, cw - 4, Math.max(2, ch * 0.08));
  } ctx.globalAlpha = 1;
}
export function drawSpectrum(ctx, w, h, t, S = {}, o = {}) {
  const th = theme(o.theme || 'cyan'); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h); const n = 40; const bw = w / n;
  for (let i = 0; i < n; i++) { const v = 0.15 + 0.7 * Math.abs(Math.sin(t * (1.1 + hs(i, 41)) + i * 0.4)) * (0.4 + 0.6 * Math.sin(i / n * Math.PI)); ctx.fillStyle = th.dot2; ctx.globalAlpha = 0.85; ctx.fillRect(i * bw + 1, h * (1 - v), bw - 2, h * v); ctx.globalAlpha = 0.25; ctx.fillRect(i * bw + 1, h * (1 - v) - 3, bw - 2, 2); }
  ctx.globalAlpha = 1;
}

// ---------------- news ----------------
const HEADLINES = ['MILITARY ON HIGHEST ALERT AS UNIDENTIFIED OBJECTS ENTER ORBIT', 'UN SECURITY COUNCIL CALLS EMERGENCY SESSION', 'AIRLINES GROUNDED ACROSS THREE CONTINENTS', 'STOCK MARKETS HALT TRADING AFTER STEEP SELL-OFF', 'EEN ROBOTICS URGES CALM: "ALL SYSTEMS NOMINAL"', 'MYSTERY SIGNAL DETECTED FROM THE ASTEROID BELT', 'GOVERNMENTS CONFIRM CONTACT: "THEY ARE NOT OF EARTH"', 'MASS EVACUATIONS ORDERED IN COASTAL CITIES', 'FIRST FOOTAGE: OBJECTS DESCEND OVER THE PACIFIC', 'WHO WARNS OF UNKNOWN PATHOGEN: "STAY INDOORS"'];
export function drawTicker(ctx, w, h, t, S = {}, o = {}) { // red BREAKING NEWS tag + scrolling ticker
  ctx.fillStyle = '#0c1220'; ctx.fillRect(0, 0, w, h);
  const tagW = w * 0.2, fs = h * 0.5; ctx.fillStyle = '#d8141c'; ctx.fillRect(0, 0, tagW, h); ctx.fillStyle = '#fff'; ctx.font = `900 ${h * 0.42}px ${SANS}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const flash = fract(t * 0.8) < 0.5 ? 1 : 0.82; ctx.globalAlpha = flash; ctx.fillText(o.tag || 'BREAKING', tagW / 2, h * 0.52); ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.font = `bold ${fs}px ${SANS}`; ctx.fillStyle = '#f2f6ff'; ctx.save(); ctx.beginPath(); ctx.rect(tagW + 4, 0, w - tagW, h); ctx.clip();
  const heads = o.headlines || HEADLINES; const sep = '   //   '; const text = heads.join(sep) + sep; const tw = ctx.measureText(text).width; const x = tagW + 12 - ((t * (w * 0.09)) % tw);
  ctx.fillText(text, x, h * 0.55); ctx.fillText(text, x + tw, h * 0.55); ctx.restore();
  ctx.fillStyle = '#ffd400'; ctx.fillRect(tagW, 0, 4, h);
}
export function drawNewsWall(ctx, w, h, t, S = {}, o = {}) { // video wall: dim map backdrop + headline card cycling + live badge
  drawWorldMap(ctx, w, h, t, S, { theme: 'blue', hud: false, labels: false, top: h * 0.18 });
  ctx.fillStyle = 'rgba(2,6,16,0.45)'; ctx.fillRect(0, 0, w, h);
  const k = Math.floor(t / 5), hd = (o.headlines || HEADLINES)[k % (o.headlines || HEADLINES).length]; const p = fract(t / 5); const a = Math.min(1, p * 6) * Math.min(1, (1 - p) * 6);
  ctx.globalAlpha = a; ctx.fillStyle = '#d8141c'; ctx.fillRect(w * 0.06, h * 0.30, w * 0.012, h * 0.4); ctx.fillStyle = '#fff'; ctx.font = `900 ${h * 0.11}px ${SANS}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const words = hd.split(' '); let line = '', y = h * 0.30; const maxW = w * 0.72; for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (ctx.measureText(tt).width > maxW) { ctx.fillText(line, w * 0.09, y); y += h * 0.125; line = wd; } else line = tt; } ctx.fillText(line, w * 0.09, y);
  ctx.globalAlpha = 1; ctx.fillStyle = '#d8141c'; ctx.fillRect(w * 0.06, h * 0.06, w * 0.13, h * 0.1); ctx.fillStyle = '#fff'; ctx.font = `900 ${h * 0.065}px ${SANS}`; ctx.textBaseline = 'middle'; ctx.fillText('● LIVE', w * 0.075, h * 0.113);
  ctx.textAlign = 'right'; ctx.font = `bold ${h * 0.06}px ${SANS}`; ctx.fillStyle = '#cfe4ff'; const tm = 12 * 3600 + Math.floor(t); ctx.fillText(`${String(Math.floor(tm / 3600) % 24).padStart(2, '0')}:${String(Math.floor(tm / 60) % 60).padStart(2, '0')}:${String(tm % 60).padStart(2, '0')} UTC`, w * 0.95, h * 0.11); ctx.textAlign = 'left';
  if (S.infect > 0.2) glitch(ctx, w, h, t, S.infect);
}
export function drawCCTV(ctx, w, h, t, S = {}, o = {}) {
  const seed = o.seed || 1; const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a4a42'); g.addColorStop(1, '#1a221e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0c120f'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
  for (let i = 0; i < 5; i++) { const x = (hs(i + seed, 51) * 1.3 - 0.15 + Math.sin(t * 0.2 * (0.5 + hs(i, 52)) + i) * 0.05) * w; ctx.fillStyle = '#6a7a70'; ctx.globalAlpha = 0.6; ctx.fillRect(x, h * 0.4, w * 0.06, h * 0.25); ctx.beginPath(); ctx.arc(x + w * 0.03, h * 0.37, w * 0.02, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; const rr = new RNG(Math.floor(t * 12) + seed * 100); ctx.fillStyle = 'rgba(200,255,220,0.07)'; for (let i = 0; i < 60; i++) ctx.fillRect(rr.range(0, w), rr.range(0, h), rr.range(1, 6), 1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.font = `${Math.round(h / 9)}px ${MONO}`; ctx.fillStyle = '#d8ffe0'; ctx.textBaseline = 'top'; ctx.fillText(`CAM ${String(seed).padStart(2, '0')}`, 6, 4); ctx.fillStyle = '#ff3030'; if (fract(t) < 0.6) { ctx.beginPath(); ctx.arc(w - 14, 14, 5, 0, TAU); ctx.fill(); }
  if (S.infect > 0.3) glitch(ctx, w, h, t, S.infect);
}
// ---------------- science ----------------
export function drawSequence(ctx, w, h, t, S = {}, o = {}) { // DNA/genome readout with gel bands
  const th = theme(o.theme || 'green'); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h); const fs = Math.max(8, Math.round(h / 16)); ctx.font = `${fs}px ${MONO}`; ctx.textBaseline = 'top'; const cols = ['#5cff7a', '#46e6ff', '#ffd040', '#ff6050'];
  const lines = Math.floor(h * 0.6 / fs); const base = Math.floor(t * 3);
  for (let r = 0; r < lines; r++) { let x = 6; const id = base + r; for (let k = 0; k < Math.floor(w * 0.55 / (fs * 0.62)); k++) { const v = Math.floor(hs(id * 29 + k, 61) * 4); ctx.fillStyle = cols[v]; ctx.globalAlpha = 0.9; ctx.fillText('ACGT'[v], x, r * fs + 4); x += fs * 0.62; } }
  ctx.globalAlpha = 1; const gx = w * 0.62, gw = w * 0.34; for (let l = 0; l < 6; l++) { const lx = gx + (l + 0.5) / 6 * gw; ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(lx - gw / 14, h * 0.08, gw / 7, h * 0.7); for (let b = 0; b < 8; b++) { const y = h * (0.12 + hs(l * 9 + b, 62) * 0.62); ctx.fillStyle = th.dot2; ctx.globalAlpha = 0.45 + 0.5 * hs(l * 5 + b, 63) * (0.7 + 0.3 * Math.sin(t * 2 + l)); ctx.fillRect(lx - gw / 16, y, gw / 8, 3); } }
  ctx.globalAlpha = 1; ctx.fillStyle = th.text; ctx.fillText(o.title || 'SEQ-ALIGN  STRAIN V-7  ' + (97 + Math.sin(t) * 2).toFixed(2) + '% MATCH', 6, h - fs - 6);
  if (S.infect > 0.3) glitch(ctx, w, h, t, S.infect);
}
export function drawOrbit(ctx, w, h, t, S = {}, o = {}) { // orbital ground tracks (mission control)
  drawWorldMap(ctx, w, h, t, { ...S, threat: 0 }, { theme: o.theme || 'blue', hud: false, labels: false, arcs: [], markers: [], top: h * 0.1 });
  const base = mapBase(w, h, o.theme || 'blue', { top: h * 0.1 }), rect = base.rect, th = base.th;
  ctx.lineWidth = Math.max(1, w / 600);
  for (let s = 0; s < 4; s++) {
    ctx.strokeStyle = s === 0 ? '#ffd040' : th.dot2; ctx.globalAlpha = s === 0 ? 0.95 : 0.45; ctx.beginPath(); const inc = 51 - s * 9, ph = s * 1.7;
    for (let i = 0; i <= 200; i++) { const a = i / 200 * TAU * 1.6 + ph; const lat = Math.asin(Math.sin(inc * Math.PI / 180) * Math.sin(a)) * 180 / Math.PI; let lon = (Math.atan2(Math.cos(inc * Math.PI / 180) * Math.sin(a), Math.cos(a)) * 180 / Math.PI) - i / 200 * 1.6 * 24 + s * 40; lon = ((lon + 540) % 360) - 180; const p = proj(rect, lon, lat); if (i && Math.abs(p[0] - ctx._lx) < rect.w * 0.5) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); ctx._lx = p[0]; } ctx.stroke();
    const a = t * 0.12 + ph + s; const lat = Math.asin(Math.sin(inc * Math.PI / 180) * Math.sin(a)) * 180 / Math.PI; let lon = (Math.atan2(Math.cos(inc * Math.PI / 180) * Math.sin(a), Math.cos(a)) * 180 / Math.PI) - t * 0.05 + s * 40; lon = ((lon + 540) % 360) - 180; const p = proj(rect, lon, lat);
    ctx.globalAlpha = 1; ctx.fillStyle = s === 0 ? '#ffd040' : '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], w / 150 + 2, 0, TAU); ctx.fill();
  } ctx.globalAlpha = 1;
  ctx.font = `bold ${Math.round(w / 40)}px ${SANS}`; ctx.fillStyle = th.text; ctx.textBaseline = 'top'; ctx.fillText(o.title || 'ORBITAL TRACKING  —  GROUND TRACKS', w * 0.035, h * 0.025);
}
export function drawCountdown(ctx, w, h, t, S = {}, o = {}) {
  const th = theme(o.theme || 'amber'); ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h); const total = (o.start ?? 3600) - t; const neg = total < 0; const a = Math.abs(total);
  const s = `${neg ? 'T+' : 'T-'}${String(Math.floor(a / 3600)).padStart(2, '0')}:${String(Math.floor(a / 60) % 60).padStart(2, '0')}:${String(Math.floor(a) % 60).padStart(2, '0')}`;
  ctx.font = `900 ${h * 0.62}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = th.dot2; ctx.shadowColor = th.dot2; ctx.shadowBlur = h * 0.1; ctx.fillText(s, w / 2, h * 0.5); ctx.shadowBlur = 0; ctx.textAlign = 'left';
  ctx.font = `${h * 0.14}px ${MONO}`; ctx.fillStyle = th.text; ctx.fillText(o.label || 'MISSION ELAPSED', w * 0.03, h * 0.1);
}
export function drawClocks(ctx, w, h, t, S = {}, o = {}) {
  ctx.fillStyle = '#04080e'; ctx.fillRect(0, 0, w, h); const zones = o.zones || [['WASHINGTON', -5], ['LONDON', 0], ['MOSCOW', 3], ['TBILISI', 4], ['BEIJING', 8], ['MANILA', 8], ['SYDNEY', 10]]; const n = zones.length, cw = w / n; const base = 14 * 3600 + t;
  zones.forEach(([nm, off], i) => {
    const cx = cw * (i + 0.5), cy = h * 0.46, R = Math.min(cw * 0.42, h * 0.34); ctx.strokeStyle = '#46e6ff'; ctx.lineWidth = Math.max(2, R * 0.06); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; for (let k = 0; k < 12; k++) { const a = k * TAU / 12; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * R * 0.86, cy - Math.cos(a) * R * 0.86); ctx.lineTo(cx + Math.sin(a) * R * 0.97, cy - Math.cos(a) * R * 0.97); ctx.stroke(); }
    const sec = (base + off * 3600); const hh = (sec / 3600) % 12, mm = (sec / 60) % 60, ss = sec % 60; const hand = (a, l, wd, col) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * R * l, cy - Math.cos(a) * R * l); ctx.stroke(); };
    hand(hh / 12 * TAU, 0.5, R * 0.08, '#fff'); hand(mm / 60 * TAU, 0.78, R * 0.05, '#fff'); hand(ss / 60 * TAU, 0.88, R * 0.025, '#ff3b30');
    ctx.fillStyle = '#8ff0ff'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(h * 0.1)}px ${SANS}`; ctx.fillText(nm, cx, h * 0.88); ctx.font = `${Math.round(h * 0.085)}px ${MONO}`; ctx.fillStyle = '#fff'; ctx.fillText(`${String(Math.floor(sec / 3600) % 24).padStart(2, '0')}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}Z`, cx, h * 0.97 - h * 0.02);
  }); ctx.textAlign = 'left';
}
// ---------------- alien ----------------
const GLYPHS = [];
function glyphPath(i) { // seeded pseudo-script glyph: arcs, hooks, dots on a 4x4 lattice
  const r = new RNG(7000 + i * 13); const segs = []; const n = 2 + r.int(0, 3);
  for (let k = 0; k < n; k++) { const kind = r.int(0, 3); segs.push({ kind, x: r.range(0.1, 0.9), y: r.range(0.1, 0.9), x2: r.range(0.1, 0.9), y2: r.range(0.1, 0.9), r: r.range(0.1, 0.34), a0: r.range(0, TAU), a1: r.range(1.5, 5) }); } return segs;
}
export function alienGlyph(ctx, i, x, y, s) {
  const g = GLYPHS[i] || (GLYPHS[i] = glyphPath(i));
  for (const q of g) {
    ctx.beginPath();
    if (q.kind === 0) ctx.arc(x + q.x * s, y + q.y * s, q.r * s, q.a0, q.a0 + q.a1);
    else if (q.kind === 1) { ctx.moveTo(x + q.x * s, y + 0.05 * s); ctx.lineTo(x + q.x * s, y + 0.95 * s); }
    else if (q.kind === 2) { ctx.moveTo(x + q.x * s, y + q.y * s); ctx.quadraticCurveTo(x + q.x2 * s, y + q.y * s, x + q.x2 * s, y + q.y2 * s); }
    else { ctx.moveTo(x + q.x * s - 0.002 * s, y + q.y * s); ctx.lineTo(x + q.x * s, y + q.y * s + 0.001 * s); ctx.stroke(); ctx.beginPath(); ctx.arc(x + q.x * s, y + q.y * s, 0.05 * s, 0, TAU); ctx.fill(); continue; }
    ctx.stroke();
  }
}
/** Vessari holo-glyph panel (transparent-friendly: black bg is treated as transparent by additive materials). kind: 'text'|'star'|'hud' */
export function drawGlyphs(ctx, w, h, t, S = {}, o = {}) {
  const inf = S.infect || 0; const col = inf > 0.5 ? '#7aff3a' : o.color || '#46e6ff'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = col; ctx.fillStyle = col; const seed = o.seed || 1; const kind = o.kind || 'text'; ctx.lineWidth = Math.max(1.5, w / 260); ctx.lineCap = 'round';
  ctx.globalAlpha = 0.9; ctx.strokeRect(w * 0.02, h * 0.02, w * 0.96, h * 0.96); ctx.globalAlpha = 0.35; ctx.strokeRect(w * 0.05, h * 0.06, w * 0.9, h * 0.88);
  ctx.globalAlpha = 1;
  if (kind === 'star' || kind === 'hud') {
    const cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.34; for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.9 - i * 0.15; ctx.beginPath(); ctx.arc(cx, cy, R * (1 - i * 0.2), t * (i % 2 ? 1 : -1) * 0.4 + i, t * (i % 2 ? 1 : -1) * 0.4 + i + 3.8 + i * 0.4); ctx.stroke(); }
    ctx.globalAlpha = 0.8; for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + t * 0.2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2); ctx.lineTo(cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12, w * 0.012, 0, TAU); ctx.fill(); }
    const gs = w * 0.045; ctx.globalAlpha = 0.9; for (let i = 0; i < 6; i++) alienGlyph(ctx, (seed * 7 + i + Math.floor(t * 0.5)) % 40, w * 0.08 + i * gs * 1.1, h * 0.84, gs);
  } else {
    const gs = Math.min(w * 0.055, h * 0.1), rows = Math.floor((h * 0.84) / (gs * 1.35)); const cols = Math.floor((w * 0.84) / (gs * 1.1));
    for (let r = 0; r < rows; r++) { const len = Math.floor(cols * (0.4 + 0.6 * hs(r + seed * 13, 71))); for (let c = 0; c < len; c++) { const idx = Math.floor(hs(r * 31 + c + seed * 7, 72) * 40); ctx.globalAlpha = 0.45 + 0.55 * hs(r * 7 + c, 73) * (0.6 + 0.4 * Math.sin(t * 2 + r)); alienGlyph(ctx, idx, w * 0.08 + c * gs * 1.1, h * 0.09 + r * gs * 1.35, gs); } }
    const sy = (fract(t * 0.25) * 0.9 + 0.05) * h; ctx.globalAlpha = 0.5; ctx.fillRect(w * 0.03, sy, w * 0.94, 2);
  }
  ctx.globalAlpha = 1; if (inf > 0.3) glitch(ctx, w, h, t, inf);
}

// ---------------- Earth seen from orbit (spherical projection, cached texture) ----------------
let _earth = null;
function earthData() {
  if (_earth) return _earth;
  const W = Q.level === 0 ? 512 : 1024, H = W / 2, c = makeCanvas(W, H), x = c.getContext('2d');
  const L = landMask(); const lc = makeCanvas(W, H), lx = lc.getContext('2d'); lx.imageSmoothingEnabled = true; lx.drawImage(L.canvas, 0, 0, W, H);
  const land = lx.getImageData(0, 0, W, H).data;
  // blur the land mask a little (box blur 2 passes) for soft coasts
  const m = new Float32Array(W * H); for (let i = 0; i < W * H; i++) m[i] = land[i * 4] / 255;
  const tmp = new Float32Array(W * H); const R = 3;
  for (let pass = 0; pass < 2; pass++) { for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { let s = 0; for (let k = -R; k <= R; k++) s += m[y * W + ((xx + k + W) % W)]; tmp[y * W + xx] = s / (2 * R + 1); } for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { let s = 0; for (let k = -R; k <= R; k++) s += tmp[Math.min(H - 1, Math.max(0, y + k)) * W + xx]; m[y * W + xx] = s / (2 * R + 1); } }
  const img = x.createImageData(W, H), d = img.data; const lights = new Uint8Array(W * H);
  const n2 = (u, v, p, s) => { // tileable fbm via tex.js hash would add dependency; use local value noise
    let a = 0, amp = 0.5, f = p; for (let o = 0; o < 4; o++) { a += amp * vnoise(u * f, v * f, f, s + o); amp *= 0.5; f *= 2; } return a; };
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const u = xx / W, v = y / H, i = y * W + xx, lm = m[i], lat = Math.abs(v - 0.5) * 2;
    const t1 = n2(u, v, 6, 3), t2 = n2(u, v, 14, 7); const land_ = clamp01((lm - 0.35) * 5);
    let r, g, b;
    if (land_ > 0) { const dry = clamp01((t1 - 0.35) * 2.6 - lat * 0.5 + (0.5 - Math.abs(v - 0.5)) * 0.2); const gr = [58 + 20 * t2, 96 + 24 * t2, 48], dr = [176 - 20 * t2, 150 - 20 * t2, 96]; r = gr[0] + (dr[0] - gr[0]) * dry; g = gr[1] + (dr[1] - gr[1]) * dry; b = gr[2] + (dr[2] - gr[2]) * dry; const hm = clamp01((t2 - 0.55) * 3); r = r * (1 - hm * 0.4) + 120 * hm * 0.4; g = g * (1 - hm * 0.4) + 110 * hm * 0.4; b = b * (1 - hm * 0.4) + 100 * hm * 0.4; }
    else { const dp = 0.7 + 0.3 * t1; r = 10 * dp; g = 44 * dp + 8; b = 110 * dp + 20; }
    // coast shallow tint
    const coast = clamp01(1 - Math.abs(lm - 0.5) * 3) * (1 - land_); r += 10 * coast; g += 40 * coast; b += 50 * coast;
    if (lat > 0.86) { const ice = clamp01((lat - 0.86) * 8); r += (240 - r) * ice; g += (244 - g) * ice; b += (250 - b) * ice; }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; lights[i] = land_ > 0.5 && vnoise(u * 90, v * 90, 90, 21) > 0.62 && lat < 0.8 ? 1 : 0;
  }
  // clouds
  const cl = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const u = xx / W, v = y / H; const a = n2(u, v, 5, 41), b = n2(u, v * 1.6, 11, 51); cl[y * W + xx] = clamp01((a * 0.65 + b * 0.5 - 0.5) * 3.2); }
  _earth = { W, H, rgb: d, lights, cl }; return _earth;
}
function vnoise(x, y, per, s) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const wp = (v) => ((v % per) + per) % per; const a = hs2(wp(xi), wp(yi), s), b = hs2(wp(xi + 1), wp(yi), s), c = hs2(wp(xi), wp(yi + 1), s), d = hs2(wp(xi + 1), wp(yi + 1), s); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }
const hs2 = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
let _eBuf = null;
/** draw a lit Earth disc (centre cx,cy radius R in px) with atmosphere. o: {lon, lat tilt, sun:[x,y,z], res (sample width)} */
export function drawEarth(ctx, cx, cy, R, t, o = {}) {
  const E = earthData(); const rs = Math.max(0.12, Math.min(1, (o.res || 240) / (R * 2))); // sampling resolution factor
  const bw = Math.max(16, Math.round(R * 2 * rs)), bh = bw; if (!_eBuf || _eBuf.w !== bw) { const c = makeCanvas(bw, bh); _eBuf = { w: bw, c, x: c.getContext('2d'), img: null }; _eBuf.img = _eBuf.x.createImageData(bw, bh); }
  const clipB = o.clipBottom ?? (cy + R); const jmax = Math.min(bh, Math.max(1, Math.ceil((clipB - (cy - R)) / (2 * R) * bh) + 1)); const clipT = o.clipTop ?? (cy - R); const jmin = Math.max(0, Math.floor((clipT - (cy - R)) / (2 * R) * bh) - 1);
  const d = _eBuf.img.data, lonC = (o.lon ?? 100) * Math.PI / 180 + t * (o.spin ?? 0.012), tilt = (o.tilt ?? 0.35); const sun = o.sun || [0.75, 0.35, 0.55]; const sl = Math.hypot(...sun); const sx = sun[0] / sl, sy = sun[1] / sl, sz = sun[2] / sl;
  const ct = Math.cos(tilt), st = Math.sin(tilt), cl = Math.cos(lonC), sl2 = Math.sin(lonC), drift = t * 0.004;
  for (let j = jmin; j < jmax; j++) for (let i = 0; i < bw; i++) {
    const nx = (i + 0.5) / bw * 2 - 1, ny = 1 - (j + 0.5) / bh * 2, r2 = nx * nx + ny * ny, p = (j * bw + i) * 4;
    if (r2 >= 1) { d[p + 3] = 0; continue; }
    const nz = Math.sqrt(1 - r2);
    // rotate view-space normal to world: tilt about X, then spin about Y
    const y1 = ny * ct - nz * st, z1 = ny * st + nz * ct; const x2 = nx * cl + z1 * sl2, z2 = -nx * sl2 + z1 * cl;
    const lon = Math.atan2(x2, z2), lat = Math.asin(Math.max(-1, Math.min(1, y1)));
    let u = lon / (Math.PI * 2) + 0.5, v = 0.5 - lat / Math.PI; const tx = Math.min(E.W - 1, Math.max(0, (u * E.W) | 0)), ty = Math.min(E.H - 1, Math.max(0, (v * E.H) | 0)), ti = ty * E.W + tx;
    let r = E.rgb[ti * 4], g = E.rgb[ti * 4 + 1], b = E.rgb[ti * 4 + 2]; const cu = ((u + drift) % 1 + 1) % 1; const cti = ty * E.W + Math.min(E.W - 1, (cu * E.W) | 0); const c = E.cl[cti] * 0.92;
    r += (245 - r) * c; g += (248 - g) * c; b += (252 - b) * c;
    const dif = nx * sx + ny * sy + nz * sz; const lit = Math.max(0, Math.min(1, dif * 1.6 + 0.12)); const night = 1 - lit;
    const spec = Math.pow(Math.max(0, 2 * dif * nz - sz), 40) * (E.lights[ti] ? 0 : 1) * (c < 0.3 ? 1 : 0.2) * 120;
    let rr = r * lit + spec, gg = g * lit + spec, bb = b * lit + spec;
    if (night > 0.5 && E.lights[ti] && c < 0.5) { const k2 = (night - 0.5) * 2; rr += 255 * 0.8 * k2; gg += 190 * 0.8 * k2; bb += 110 * 0.8 * k2; }
    const rim = Math.pow(1 - nz, 3); const lim = 1 - 0.55 * Math.pow(1 - nz, 1.8);
    rr = rr * lim + 70 * rim * (0.2 + lit); gg = gg * lim + 140 * rim * (0.2 + lit); bb = bb * lim + 255 * rim * (0.2 + lit);
    d[p] = rr; d[p + 1] = gg; d[p + 2] = bb; d[p + 3] = 255;
  }
  _eBuf.x.putImageData(_eBuf.img, 0, jmin * 0, 0, jmin, bw, jmax - jmin);
  // atmosphere glow behind & around
  const gl = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12); gl.addColorStop(0, 'rgba(110,180,255,0.75)'); gl.addColorStop(0.25, 'rgba(60,120,255,0.32)'); gl.addColorStop(1, 'rgba(20,50,200,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.fill();
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(_eBuf.c, cx - R, cy - R, R * 2, R * 2); ctx.restore();
}
