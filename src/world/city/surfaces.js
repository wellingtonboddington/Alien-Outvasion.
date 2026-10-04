// Ground, roof, foliage, decal and sign-atlas textures for the city module. All cached + shared (userData.shared).
import * as THREE from 'three';
import { RNG, Q } from '../../engine/common.js';
import { texRes, cached, makeCanvas, texFromCanvas, voronoi2, fbm2 } from '../../engine/proc.js';
import { Layers, dat, shade, rgba, lerpCol, noiseCanvas } from './paint.js';

const shared = (t) => { t.userData.shared = true; return t; };
function finish(L, aniso = 8) { const t = L.textures({ emissive: false, aniso }); t.userData = { shared: true }; return t; }

/** ground materials' textures. tile size in metres in .tile */
export function getGround(kind) {
  return cached(`city.ground.${kind}.${Q.texSize}`, () => {
    const R = new RNG(kind.length * 977 + kind.charCodeAt(0)); const S = { asphalt: 8, sidewalk: 4.8, paving: 4, cobble: 3, grass: 6, dirt: 6, snow: 6, concrete: 4, gravel: 4 }[kind] || 4;
    const W = texRes(512); const L = new Layers(S, S, W / S); L.rng = R;
    const px = (m) => m * L.ppm;
    if (kind === 'asphalt') {
      L.rect(0, 0, S, S, '#46474b', dat(120, 225, 0));
      L.mottle(2, 3, 0.86, 1.06, 'overlay', 0.8); L.mottle(7, 4, 0.84, 1.06, 'multiply', 0.8); L.mottle(18, 5, 0.9, 1.04, 'multiply', 0.7);
      for (let i = 0; i < 14; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.3, 1.1), R.pick(['#1a1a1c', '#2a2a2c', '#55555a']), R.range(0.1, 0.25), R.range(0.4, 1.5));
      // patches
      for (let i = 0; i < 4; i++) L.rect(R.range(0, S - 1.5), R.range(0, S - 1.5), R.range(0.5, 1.5), R.range(0.4, 1.2), R.pick(['rgba(14,14,16,0.3)', 'rgba(30,30,34,0.2)']), dat(130, 235, 0));
      // cracks
      for (let i = 0; i < 9; i++) { let x = R.range(0, S), y = R.range(0, S); const ctx = L.ctx.col; ctx.strokeStyle = 'rgba(10,10,10,0.6)'; ctx.lineWidth = Math.max(1, px(0.012)); ctx.beginPath(); ctx.moveTo(px(x), px(y)); for (let k = 0; k < 8; k++) { x += R.range(-0.3, 0.3); y += R.range(0.1, 0.4); ctx.lineTo(px(x), px(y)); } ctx.stroke(); }
      L.grain(Math.round(W * W / 12), [0.15, 0.5], [0.6, 1.8], ['#8a8a90', '#111', '#5a5a60', '#c8c8c8']);
      L.mottleDat(40, 6, 0.8);
    } else if (kind === 'sidewalk' || kind === 'concrete') {
      const n = kind === 'sidewalk' ? 4 : 1; L.rect(0, 0, S, S, kind === 'concrete' ? '#cfccc4' : '#b4b1aa', dat(140, 215, 0));
      const step = S / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { L.rect(i * step, j * step, step, step, shade(kind === 'concrete' ? '#cfccc4' : '#b4b1aa', R.range(0.92, 1.06)), null); }
      L.mottle(3, 7, 0.82, 1.05); L.mottle(14, 8, 0.9, 1.05);
      if (kind === 'sidewalk') { for (let i = 0; i <= n; i++) { L.rect(i * step - 0.015, 0, 0.03, S, 'rgba(30,28,25,0.7)', dat(60, 230, 0)); L.rect(0, i * step - 0.015, S, 0.03, 'rgba(30,28,25,0.7)', dat(60, 230, 0)); } }
      for (let i = 0; i < 10; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.2, 0.8), R.pick(['#2a2a28', '#4a5a3a', '#6a5a40']), R.range(0.08, 0.2), R.range(0.6, 1.6));
      for (let i = 0; i < 6; i++) { let x = R.range(0, S), y = R.range(0, S); const ctx = L.ctx.col; ctx.strokeStyle = 'rgba(20,18,15,0.5)'; ctx.lineWidth = Math.max(1, px(0.01)); ctx.beginPath(); ctx.moveTo(px(x), px(y)); for (let k = 0; k < 5; k++) { x += R.range(-0.2, 0.2); y += R.range(0.05, 0.3); ctx.lineTo(px(x), px(y)); } ctx.stroke(); }
      L.grain(Math.round(W * W / 14), [0.08, 0.3], [0.5, 1.4], ['#000', '#fff', '#776']); L.mottleDat(30, 9, 0.6);
    } else if (kind === 'paving') {
      L.rect(0, 0, S, S, '#6c6862', dat(100, 230, 0)); const pw = 0.5, ph = 0.25;
      for (let r = 0; r * ph < S; r++) for (let c = 0; c * pw < S + pw; c++) { const x = c * pw + (r % 2) * pw / 2; L.rect(x + 0.012, r * ph + 0.012, pw - 0.024, ph - 0.024, shade(R.pick(['#b4afa6', '#c0bab0', '#a6a198', '#b8b0a6']), R.range(0.92, 1.08)), dat(150, 215, 0)); }
      L.mottle(5, 10, 0.8, 1.05); L.grain(Math.round(W * W / 14), [0.08, 0.25], [0.5, 1.4]);
    } else if (kind === 'cobble') {
      L.rect(0, 0, S, S, '#2e2c29', dat(90, 235, 0)); const n = 22;
      for (let i = 0; i < 520; i++) { const x = R.range(0, S), y = R.range(0, S), rx = R.range(0.07, 0.11), ry = rx * R.range(0.8, 1.2); const c = shade(R.pick(['#a8a49c', '#8e8a82', '#b8b3a8', '#9a968e']), R.range(0.88, 1.1)); for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { L.ctx.col.fillStyle = c; L.ctx.col.beginPath(); L.ctx.col.ellipse(px(x + ox), px(y + oy), px(rx), px(ry), 0, 0, 7); L.ctx.col.fill(); L.ctx.dat.fillStyle = dat(R.range(150, 200), 210, 0); L.ctx.dat.beginPath(); L.ctx.dat.ellipse(px(x + ox), px(y + oy), px(rx * 0.9), px(ry * 0.9), 0, 0, 7); L.ctx.dat.fill(); } }
      L.mottle(4, 11, 0.8, 1.05); L.mottle(16, 12, 0.88, 1.06);
    } else if (kind === 'grass') {
      L.rect(0, 0, S, S, '#587c38', dat(130, 235, 0)); L.mottle(2, 13, 0.7, 1.25, 'overlay', 1); L.mottle(8, 14, 0.8, 1.15, 'multiply', 0.8);
      for (let i = 0; i < 3500; i++) { const x = R.range(0, S), y = R.range(0, S); L.ctx.col.strokeStyle = shade(R.pick(['#628a3a', '#3c5a22', '#7a9e48', '#587a32', '#7a7040']), R.range(0.8, 1.12)); L.ctx.col.lineWidth = Math.max(1, px(0.012)); L.ctx.col.beginPath(); L.ctx.col.moveTo(px(x), px(y)); L.ctx.col.lineTo(px(x + R.range(-0.04, 0.04)), px(y - R.range(0.03, 0.09))); L.ctx.col.stroke(); }
      L.mottleDat(30, 15, 0.8);
    } else if (kind === 'dirt') {
      L.rect(0, 0, S, S, '#7e6a4e', dat(130, 235, 0)); L.mottle(2, 16, 0.7, 1.2, 'overlay', 1); L.mottle(9, 17, 0.8, 1.12, 'multiply', 0.9);
      for (let i = 0; i < 700; i++) { const x = R.range(0, S), y = R.range(0, S), r = R.range(0.008, 0.03); L.ctx.col.fillStyle = shade(R.pick(['#8c7a5c', '#5a4a34', '#a08a68', '#6a5a44']), R.range(0.8, 1.15)); L.ctx.col.beginPath(); L.ctx.col.arc(px(x), px(y), px(r), 0, 7); L.ctx.col.fill(); L.ctx.dat.fillStyle = dat(R.range(150, 210), 225, 0); L.ctx.dat.beginPath(); L.ctx.dat.arc(px(x), px(y), px(r), 0, 7); L.ctx.dat.fill(); }
      L.grain(Math.round(W * W / 12), [0.1, 0.35], [0.5, 1.6], ['#000', '#fff', '#3a2a1a']); L.mottleDat(35, 18, 0.8);
    } else if (kind === 'gravel') {
      L.rect(0, 0, S, S, '#6a6860', dat(130, 235, 0)); for (let i = 0; i < 2500; i++) { const x = R.range(0, S), y = R.range(0, S), r = R.range(0.012, 0.035); L.ctx.col.fillStyle = shade(R.pick(['#9a968c', '#6e6a60', '#b0aca0', '#55524a']), R.range(0.8, 1.15)); L.ctx.col.beginPath(); L.ctx.col.arc(px(x), px(y), px(r), 0, 7); L.ctx.col.fill(); L.ctx.dat.fillStyle = dat(R.range(150, 230), 225, 0); L.ctx.dat.beginPath(); L.ctx.dat.arc(px(x), px(y), px(r), 0, 7); L.ctx.dat.fill(); }
      L.mottle(3, 19, 0.8, 1.1);
    } else { // snow
      L.rect(0, 0, S, S, '#eef2f6', dat(140, 200, 0)); L.mottle(2, 20, 0.86, 1.02, 'multiply', 1); L.mottle(6, 21, 0.9, 1.0, 'multiply', 0.8);
      for (let i = 0; i < 1800; i++) { L.ctx.col.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,0.9)' : 'rgba(150,175,205,0.35)'; const s = R.range(0.5, 2.2); L.ctx.col.fillRect(R.range(0, W), R.range(0, W), s, s); }
      L.mottleDat(18, 22, 0.8);
    }
    const t = finish(L); t.tile = S; return t;
  });
}

/** roof textures: flat | gi | tile | zinc | green | snow | slate. .tile metres for (u,v) */
export function getRoof(kind) {
  return cached(`city.roof.${kind}.${Q.texSize}`, () => {
    const R = new RNG(kind.charCodeAt(0) * 313 + kind.length); const S = kind === 'gi' ? 4 : 6; const W = texRes(512); const L = new Layers(S, S, W / S); L.rng = R; const px = (m) => m * L.ppm;
    if (kind === 'flat') {
      L.rect(0, 0, S, S, '#8e8d88', dat(140, 225, 0)); L.mottle(2, 31, 0.84, 1.1, 'overlay', 1); L.mottle(8, 32, 0.8, 1.05);
      for (let i = 0; i < 5; i++) L.rect(R.range(0, S - 2), R.range(0, S - 2), R.range(0.8, 2.4), R.range(0.8, 2.4), R.pick(['rgba(40,40,44,0.35)', 'rgba(150,148,140,0.3)', 'rgba(90,70,50,0.25)']), dat(150, 215, 0));
      for (let i = 0; i < 9; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.3, 1.0), R.pick(['#1a1a1c', '#3a4a3a']), R.range(0.12, 0.28), R.range(0.5, 1.5));
      L.line(0, S * 0.5, S, S * 0.5, 0.03, 'rgba(20,20,20,0.55)', dat(100, 230, 0)); L.line(S * 0.5, 0, S * 0.5, S, 0.03, 'rgba(20,20,20,0.55)', dat(100, 230, 0));
      L.grain(Math.round(W * W / 14), [0.1, 0.35], [0.5, 1.5]); L.mottleDat(24, 33, 0.7);
    } else if (kind === 'gi' || kind === 'zinc' || kind === 'green') {
      const pitch = kind === 'gi' ? 0.1 : 0.55; const base = kind === 'gi' ? '#aeb2b0' : kind === 'zinc' ? '#7f8a92' : '#5e9c86'; const n = Math.round(S / pitch);
      L.rect(0, 0, S, S, base, dat(140, 120, kind === 'gi' ? 160 : 130));
      for (let i = 0; i < n; i++) {
        const x = i * S / n, w = S / n;
        if (kind === 'gi') { L.hgrad(x, 0, w, S, [[0, 'rgba(255,255,255,0.0)'], [0.25, 'rgba(255,255,255,0.45)'], [0.5, 'rgba(0,0,0,0.05)'], [0.8, 'rgba(0,0,0,0.38)'], [1, 'rgba(0,0,0,0.12)']]); L.hgrad(x, 0, w, S, [[0, dat(80, 130, 160)], [0.25, dat(235, 130, 160)], [0.5, dat(150, 130, 160)], [0.8, dat(30, 130, 160)], [1, dat(80, 130, 160)]], 'dat'); }
        else { L.rect(x, 0, 0.025, S, 'rgba(0,0,0,0.45)', dat(220, 120, 130)); L.rect(x + 0.025, 0, 0.02, S, 'rgba(255,255,255,0.25)'); }
      }
      if (kind === 'gi') { // sheet laps + rust
        for (let j = 0; j < 4; j++) L.rect(0, j * S / 4 - 0.02, S, 0.06, 'rgba(0,0,0,0.3)', dat(200, 150, 160));
        for (let i = 0; i < 22; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.15, 0.7), R.pick(['#8a4a20', '#a85a28', '#5a3418', '#6a5a48']), R.range(0.18, 0.5), R.range(0.6, 3));
        for (let i = 0; i < 40; i++) L.streak(R.range(0, S), R.range(0, S * 0.8), R.range(0.04, 0.2), R.range(0.5, 2), R.range(0.12, 0.3), '#7a3a1a');
        for (let i = 0; i < 12; i++) { L.ctx.col.fillStyle = 'rgba(30,20,10,0.6)'; L.ctx.col.beginPath(); L.ctx.col.arc(px(R.range(0, S)), px(R.range(0, S)), px(0.025), 0, 7); L.ctx.col.fill(); }
      } else { for (let i = 0; i < 16; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.3, 1.0), R.pick(['#2a3a30', '#8a9a90', '#3a3a3a']), R.range(0.1, 0.3), R.range(1, 3)); for (let j = 0; j < 6; j++) L.rect(0, j * S / 6, S, 0.02, 'rgba(0,0,0,0.35)', dat(100, 150, 130)); }
      L.mottle(3, 34, 0.8, 1.08); L.grain(Math.round(W * W / 20), [0.05, 0.2], [0.5, 1.3]);
    } else if (kind === 'tile' || kind === 'slate') {
      const th = kind === 'tile' ? 0.34 : 0.22, tw2 = kind === 'tile' ? 0.22 : 0.3; L.rect(0, 0, S, S, kind === 'tile' ? '#6a3a2a' : '#44484e', dat(120, 220, 0));
      const cols = ['#a0523a', '#8f4630', '#b0603f', '#7a3a28', '#9a4c34'], scols = ['#4a4e56', '#3c4046', '#555a62', '#34383e'];
      for (let r = 0; r * th < S + th; r++) for (let c = -1; c * tw2 < S + tw2; c++) { const x = c * tw2 + (r % 2) * tw2 / 2, y = r * th; const col = shade(R.pick(kind === 'tile' ? cols : scols), R.range(0.85, 1.12)); L.rect(x + 0.01, y, tw2 - 0.02, th + 0.01, col, dat(R.range(150, 190), 215, 0)); L.vgrad(x + 0.01, y, tw2 - 0.02, th, [[0, 'rgba(0,0,0,0.0)'], [0.75, 'rgba(0,0,0,0.0)'], [1, 'rgba(0,0,0,0.45)']]); L.rect(x, y + th - 0.04, tw2, 0.04, null, dat(60, 230, 0)); }
      for (let i = 0; i < 18; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.3, 0.9), R.pick(['#4a6a30', '#2a2a2a', '#7a8a50']), R.range(0.1, 0.3), R.range(0.8, 2));
      L.mottle(3, 35, 0.78, 1.08);
    } else { // snow
      L.rect(0, 0, S, S, '#f2f5f8', dat(150, 200, 0)); L.mottle(2, 36, 0.88, 1.0); L.mottle(8, 37, 0.92, 1.0); for (let i = 0; i < 1500; i++) { L.ctx.col.fillStyle = R.chance(0.6) ? 'rgba(255,255,255,0.9)' : 'rgba(160,180,205,0.3)'; const s = R.range(0.5, 2); L.ctx.col.fillRect(R.range(0, W), R.range(0, W), s, s); }
    }
    const t = finish(L); t.tile = S; return t;
  });
}

/** alpha foliage cards: canopy | frond | banana | leafy (small) */
export function getFoliage(kind) {
  return cached(`city.foliage.${kind}.${Q.texSize}`, () => {
    const R = new RNG(kind.length * 1291 + kind.charCodeAt(0)); const w = kind === 'frond' ? 128 : 256, h = kind === 'frond' ? 256 : 256; const S = texRes(256) / 256; const c = makeCanvas(Math.round(w * S), Math.round(h * S)); const ctx = c.getContext('2d'); ctx.scale(S, S);
    if (kind === 'canopy' || kind === 'leafy') {
      const greens = ['#4a8a30', '#5a9e3a', '#6cb044', '#3c7a2a', '#7cc04e', '#4a8a34'];
      const cx = 128, cy = 128, rad = 118;
      for (let i = 0; i < 1500; i++) { // dense blob of leaves, ragged edge
        const a = R.range(0, 6.283), d = Math.pow(R.next(), 0.55) * rad * (0.82 + 0.25 * fbm2(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, 2)); const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.92;
        const light = 0.75 + 0.4 * (1 - (y / 256)) + R.range(-0.1, 0.1); ctx.save(); ctx.translate(x, y); ctx.rotate(R.range(0, 6.283)); ctx.fillStyle = shade(R.pick(greens), light); ctx.beginPath(); ctx.ellipse(0, 0, R.range(4, 9), R.range(2, 4.2), 0, 0, 7); ctx.fill(); ctx.restore();
      }
      // dark core to fake depth, few light gaps
      const g = ctx.createRadialGradient(cx, cy + 20, 10, cx, cy + 20, rad * 0.9); g.addColorStop(0, 'rgba(10,25,8,0.3)'); g.addColorStop(1, 'rgba(10,25,8,0)'); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    } else if (kind === 'frond') { // palm frond, rib along the vertical centre (u=0.5), tip at top
      ctx.lineCap = 'round'; ctx.strokeStyle = '#6a7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(64, 256); ctx.lineTo(64, 6); ctx.stroke();
      for (let i = 0; i < 70; i++) {
        const y = 250 - i * 3.4; const len = 58 * Math.sin(Math.PI * Math.min(1, (i + 6) / 78)) * (0.85 + R.range(0, 0.25)) + 6; const droop = 12 + R.range(0, 8);
        for (const s of [-1, 1]) { ctx.strokeStyle = shade(R.pick(['#4a8e32', '#5aa63c', '#6cb846', '#3e7e2a']), R.range(0.95, 1.2)); ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(64, y); ctx.quadraticCurveTo(64 + s * len * 0.6, y - 10, 64 + s * len, y + droop - 10 + 0); ctx.stroke(); }
      }
    } else { // banana leaf
      ctx.fillStyle = '#62b040'; ctx.beginPath(); ctx.moveTo(128, 250); ctx.bezierCurveTo(10, 200, 0, 70, 128, 4); ctx.bezierCurveTo(256, 70, 246, 200, 128, 250); ctx.fill();
      for (let i = 0; i < 30; i++) { const y = 240 - i * 7.6; ctx.strokeStyle = shade('#2f6a20', R.range(0.8, 1.2)); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(128, y); ctx.lineTo(128 - 100 * Math.sin(Math.PI * (i + 3) / 36), y - 26); ctx.moveTo(128, y); ctx.lineTo(128 + 100 * Math.sin(Math.PI * (i + 3) / 36), y - 26); ctx.stroke(); }
      ctx.strokeStyle = '#d8e8a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(128, 250); ctx.lineTo(128, 6); ctx.stroke();
      // split tears
      ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 9; i++) { const y = R.range(30, 220); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(128 + s * 20, y); ctx.lineTo(128 + s * 140, y - 18); ctx.lineTo(128 + s * 140, y - 10); ctx.closePath(); ctx.fill(); } }
    }
    const t = texFromCanvas(c, { srgb: true, aniso: 4, wrap: 'clamp' }); t.userData.shared = true; return t;
  });
}

/** decals atlas 4x4: puddle, oil, crack, scorch, skid, patch, dust, bloodlike dark stain ... returns {map,data, cell(i)->uv rect} */
export function getDecals() {
  return cached(`city.decals.${Q.texSize}`, () => {
    const S = texRes(512), C = S / 4; const c = makeCanvas(S, S), d = makeCanvas(S, S); const x = c.getContext('2d'), y = d.getContext('2d'); const R = new RNG(77);
    y.fillStyle = 'rgb(0,200,0)'; y.fillRect(0, 0, S, S);
    const blobPath = (ctx, cx, cy, r, k = 0.35, n = 16) => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * 6.283; const rr = r * (1 - k + k * 2 * fbm2(Math.cos(a) * 1.3 + cx * 0.05, Math.sin(a) * 1.3 + cy * 0.05, 3)); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
    const cellXY = (i) => [(i % 4) * C, Math.floor(i / 4) * C];
    for (let i = 0; i < 16; i++) {
      const [ox, oy] = cellXY(i); const cx = ox + C / 2, cy = oy + C / 2;
      if (i % 4 === 0) { // puddles (3 variants) -> glossy
        blobPath(x, cx, cy, C * 0.4 + (i / 4) * 2, 0.3); const g = x.createRadialGradient(cx, cy, 2, cx, cy, C * 0.45); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fill();
        y.fillStyle = 'rgb(0,12,0)'; y.fillRect(ox, oy, C, C);
      } else if (i % 4 === 1) { // oil / grime stains
        blobPath(x, cx, cy, C * 0.38, 0.45); x.fillStyle = 'rgba(255,255,255,0.65)'; x.fill(); x.fillStyle = 'rgba(255,255,255,0.9)'; blobPath(x, cx + 3, cy - 2, C * 0.22, 0.5); x.fill(); y.fillStyle = 'rgb(0,90,0)'; y.fillRect(ox, oy, C, C);
      } else if (i % 4 === 2) { // cracks / scorch streaks
        x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineCap = 'round'; for (let k = 0; k < 7; k++) { let px = cx, py = cy; x.lineWidth = R.range(1, 2.6); x.beginPath(); x.moveTo(px, py); const a0 = R.range(0, 6.283); for (let s = 0; s < 6; s++) { px += Math.cos(a0 + R.range(-0.6, 0.6)) * C * 0.09; py += Math.sin(a0 + R.range(-0.6, 0.6)) * C * 0.09; x.lineTo(px, py); } x.stroke(); }
        y.fillStyle = 'rgb(0,220,0)'; y.fillRect(ox, oy, C, C);
      } else { // soot burst / skid
        for (let k = 0; k < 120; k++) { const a = R.range(0, 6.283), dd = Math.pow(R.next(), 1.4) * C * 0.45; x.fillStyle = `rgba(255,255,255,${R.range(0.05, 0.28)})`; x.beginPath(); x.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, R.range(2, 9), 0, 7); x.fill(); }
        y.fillStyle = 'rgb(0,235,0)'; y.fillRect(ox, oy, C, C);
      }
    }
    const map = texFromCanvas(c, { srgb: true, aniso: 4, wrap: 'clamp' }), data = texFromCanvas(d, { srgb: false, aniso: 4, wrap: 'clamp' }); map.userData.shared = true; data.userData.shared = true;
    return { map, data, userData: { shared: true }, cell: (i) => { const [ox, oy] = cellXY(i); return [ox / S + 0.01, 1 - (oy + C) / S + 0.01, (ox + C) / S - 0.01, 1 - oy / S - 0.01]; } };
  });
}

// ---------- sign atlas ----------
// fixed layout in a 1024x1024 virtual atlas; ids index into per-class lists
const FASCIA = [ // [text, bg, fg, style]
  ['SARI-SARI STORE', '#f2c230', '#b02020'], ['BOTICA', '#2f8f4a', '#ffffff', 'cross'], ['CARINDERIA', '#c43a2a', '#fff3c8'], ['E-LOAD  BILLS PAY', '#1f5fb0', '#fff'], ['PAWNSHOP', '#f2d230', '#1a1a1a'], ['LECHON MANOK', '#d8402a', '#ffe070'], ['HALO-HALO', '#e86aa0', '#fff'], ['MOTOR PARTS', '#2a58a8', '#ffd24a'],
  ['BARBERSHOP', '#f4f4f0', '#c02020', 'stripes'], ['INTERNET CAFE', '#14202c', '#46e6ff', 'neon'], ['CELLPHONE REPAIR', '#303a48', '#7af0ff', 'neon'], ['HARDWARE', '#d08a20', '#222'], ['PANADERIA', '#e8d2a0', '#7a3a1a'], ['TAILOR', '#6a3a8a', '#f8e8ff'], ['PHARMACY', '#f4f4f4', '#1a8a4a', 'cross'], ['SUPERMARKET', '#e03a2a', '#fff'],
  ['PIZZA', '#b02020', '#fff3d0', 'neon'], ['DELI & GROCERY', '#1f6a3a', '#ffe9a0'], ['HOTEL', '#101820', '#ffd070', 'neon'], ['BAR', '#101018', '#ff4aa0', 'neon'], ['LIQUORS', '#18202a', '#ffb040', 'neon'], ['CAFE', '#3a2a20', '#f0e0c0'], ['NOODLES 24H', '#c02a2a', '#ffe8a0', 'neon'], ['BANK', '#1a3a6a', '#e8eef8'],
  ['APOTHEKE', '#f4f4f0', '#c01818', 'cross'], ['BAECKEREI', '#e8d8b0', '#5a3418'], ['CAFE', '#1d3a2c', '#e8d8a0'], ['KIOSK', '#2a3a58', '#fff'], ['DOENER', '#c8342a', '#fff0b0'], ['BUCHHANDLUNG', '#3a2a20', '#e8d8b0'], ['HOTEL', '#202a38', '#d8e0f0'], ['SPAETI', '#2a2a30', '#ffe060', 'neon'],
];
const FASCIA_RU = [['АПТЕКА', '#f4f4f0', '#b01818', 'cross'], ['ПРОДУКТЫ', '#2a5a3a', '#f8f0c8'], ['МАГАЗИН', '#a02a24', '#f8e8c0'], ['ХЛЕБ', '#e8d2a0', '#6a3418'], ['КАФЕ', '#2a2a38', '#f0d070'], ['ГОСТИНИЦА', '#1a2a48', '#e8eef8'], ['ОБУВЬ', '#4a3a2a', '#f0e0c0'], ['РЫНОК', '#3a5a2a', '#f8f0b0']];
const FASCIA_IN = [['CHAI', '#e8a020', '#7a1a10'], ['SWEETS', '#e8508a', '#fff0b0'], ['MOBILE', '#2060c0', '#fff'], ['HOTEL', '#c83a2a', '#ffe8a0'], ['TAILORS', '#2a7a5a', '#fff0d0'], ['ELECTRICALS', '#d8b020', '#1a1a1a'], ['PHARMACY', '#f4f4f4', '#1a8a4a', 'cross'], ['DHABA', '#a02a1a', '#ffe070']];
const BANNERS = [ // 256x96 tarps
  ['CONGRATULATIONS GRADUATES!', '#1f4fa8', '#ffd24a', 'grad'], ['HAPPY FIESTA!', '#e8402a', '#fff0a0', 'fiesta'], ['SALE 50% OFF', '#f2d010', '#c01818', 'sale'], ['FOR RENT  0917-000-0000', '#f4f4f4', '#1a1a1a'],
  ['VOTE: J. DELA CRUZ', '#2a8a3a', '#ffffff', 'face'], ['MEDICAL MISSION', '#1a8a9a', '#fff', 'cross'], ['GRAND OPENING', '#c0307a', '#fff3b0', 'sale'], ['WELCOME TO DUMAGUETE', '#2a5aa8', '#ffe070', 'fiesta'],
];
const BILLBOARDS = [ // 512x192
  ['EEN ROBOTICS', 'A helping hand.', '#0a1a30', '#46e6ff'], ['ZENITH WATCHES', 'Time, perfected.', '#1a1a1a', '#f0d080'], ['VOLT ENERGY', 'Charge ahead.', '#102a14', '#60ff80'], ['ORBIT AIRLINES', 'Fly higher.', '#10285a', '#ffffff'],
  ['NOVA COLA', 'Taste the new.', '#a01010', '#ffffff'], ['LUMEN PHONES', 'See more.', '#2a1050', '#c0a0ff'], ['MANILA TRUST BANK', 'Grow together.', '#0a3a3a', '#a0ffe0'], ['SUNRISE RESORTS', 'Escape to Siquijor.', '#e86a20', '#fff0c0'],
];
const BLADES = ['HOTEL', 'BAR', 'OPEN', 'RESTO', 'INN', 'SPA', 'ATM', 'CAFE', 'KTV', 'PHARMA', 'FOOD', 'BANK', 'SALE', 'TEA', 'WIFI', '24H']; // 64x192 vertical neon blades

export const SIGN_COUNT = { fascia: FASCIA.length, ru: FASCIA_RU.length, in: FASCIA_IN.length, banner: BANNERS.length, billboard: BILLBOARDS.length, blade: BLADES.length };
const AW = 1024, AH = 1792; // virtual atlas size (fascia 0..768, banners 768..960, blades 960..1024, billboards 1024..1792)
function cell(cls, i) {
  let x, y, w, h;
  if (cls === 'fascia') { const k = i % 32; x = (k % 4) * 256; y = Math.floor(k / 4) * 64; w = 256; h = 64; }
  else if (cls === 'ru') { const k = 32 + (i % 8); x = (k % 4) * 256; y = Math.floor(k / 4) * 64; w = 256; h = 64; }
  else if (cls === 'in') { const k = 40 + (i % 8); x = (k % 4) * 256; y = Math.floor(k / 4) * 64; w = 256; h = 64; }
  else if (cls === 'banner') { const k = i % 8; x = (k % 4) * 256; y = 768 + Math.floor(k / 4) * 96; w = 256; h = 96; }
  else if (cls === 'billboard') { const k = i % 8; x = (k % 2) * 512; y = 1024 + Math.floor(k / 2) * 192; w = 512; h = 192; }
  else { const k = i % 16; x = k * 64; y = 960; w = 64; h = 64; }
  return { x, y, w, h };
}
/** uv rect [u0,v0,u1,v1] for a sign; cls in fascia|ru|in|banner|billboard|blade. aspect = w/h */
export function signRect(cls, i) {
  const c = cell(cls, i); const e = 1.5;
  return { rect: [(c.x + e) / AW, 1 - (c.y + c.h - e) / AH, (c.x + c.w - e) / AW, 1 - (c.y + e) / AH], aspect: c.w / c.h };
}

function drawSignText(ctx, text, x, y, w, h, bg, fg, style, R) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  // frame / bevel
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, 3); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h - 4, w, 4);
  if (style === 'stripes') for (let i = 0; i < 20; i++) { ctx.fillStyle = i % 2 ? '#c02020' : '#2050b0'; ctx.fillRect(x + i * 14, y + h - 10, 8, 10); }
  let size = h * 0.62; ctx.font = `bold ${size}px "DejaVu Sans", Arial, sans-serif`; while (ctx.measureText(text).width > w * 0.84 && size > 8) { size -= 2; ctx.font = `bold ${size}px "DejaVu Sans", Arial, sans-serif`; }
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  if (style === 'cross') { // medical cross at left, text shifted
    ctx.fillStyle = fg; const cx = x + 26, cy = y + h / 2; ctx.fillRect(cx - 4, cy - 14, 8, 28); ctx.fillRect(cx - 14, cy - 4, 28, 8); ctx.textAlign = 'left'; ctx.fillText(text, x + 50, y + h / 2 + 2);
  } else {
    if (style === 'neon') { ctx.shadowColor = fg; ctx.shadowBlur = 8; ctx.fillStyle = fg; ctx.fillText(text, x + w / 2, y + h / 2 + 2); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.strokeText(text, x + w / 2, y + h / 2 + 2); ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(text, x + w / 2 + 1.5, y + h / 2 + 3.5); ctx.fillStyle = fg; ctx.fillText(text, x + w / 2, y + h / 2 + 2); }
  }
  ctx.restore();
}

export function getSigns() {
  return cached(`city.signs.${Q.texSize}`, () => {
    const S = texRes(1024); const k = S / AW; const c = makeCanvas(S, Math.round(S * AH / AW)); const ctx = c.getContext('2d'); ctx.scale(k, k); const R = new RNG(99);
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, AW, AH);
    const place = (cls, list, draw) => list.forEach((s, i) => { const cc = cell(cls, i); draw(s, cc.x, cc.y, cc.w, cc.h); });
    place('fascia', FASCIA, (s, x, y, w, h) => drawSignText(ctx, s[0], x, y, w, h, s[1], s[2], s[3], R));
    place('ru', FASCIA_RU, (s, x, y, w, h) => drawSignText(ctx, s[0], x, y, w, h, s[1], s[2], s[3], R));
    place('in', FASCIA_IN, (s, x, y, w, h) => drawSignText(ctx, s[0], x, y, w, h, s[1], s[2], s[3], R));
    place('banner', BANNERS, (s, x, y, w, h) => { // tarpaulin
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, s[1]); g.addColorStop(1, shade(s[1], 0.7)); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      if (s[3] === 'fiesta') for (let i = 0; i < 16; i++) { ctx.fillStyle = ['#ffd24a', '#ff6a3a', '#3ad0ff', '#ff8ad0'][i % 4]; ctx.beginPath(); ctx.moveTo(x + i * 16, y); ctx.lineTo(x + i * 16 + 16, y); ctx.lineTo(x + i * 16 + 8, y + 18); ctx.fill(); }
      if (s[3] === 'face') { ctx.fillStyle = '#e8c8a0'; ctx.beginPath(); ctx.ellipse(x + 48, y + 44, 24, 30, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 48, y + 28, 24, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x + 20, y + 74, 56, 18); }
      if (s[3] === 'grad') { ctx.fillStyle = '#222'; ctx.fillRect(x + w - 54, y + 12, 36, 6); ctx.beginPath(); ctx.moveTo(x + w - 36, y + 4); ctx.lineTo(x + w - 62, y + 14); ctx.lineTo(x + w - 36, y + 24); ctx.lineTo(x + w - 10, y + 14); ctx.closePath(); ctx.fill(); }
      const words = s[0].split(' '); let size = 30; ctx.font = `900 ${size}px "DejaVu Sans", Arial, sans-serif`; const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [s[0]];
      for (const ln of lines) { while (ctx.measureText(ln).width > w * 0.92 && size > 10) { size -= 2; ctx.font = `900 ${size}px "DejaVu Sans", Arial, sans-serif`; } }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; lines.forEach((ln, i) => { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText(ln, x + w / 2 + 2, y + h * (lines.length === 1 ? 0.52 : 0.36 + i * 0.3) + 2); ctx.fillStyle = s[2]; ctx.fillText(ln, x + w / 2, y + h * (lines.length === 1 ? 0.52 : 0.36 + i * 0.3)); });
      ctx.restore();
    });
    place('billboard', BILLBOARDS, (s, x, y, w, h) => {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, s[2]); g.addColorStop(1, shade(s[2], 0.5, 8)); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.25; for (let i = 0; i < 6; i++) { ctx.fillStyle = s[3]; ctx.beginPath(); ctx.arc(x + R.range(0, w), y + R.range(0, h), R.range(20, 90), 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let size = 58; ctx.font = `900 ${size}px "DejaVu Sans", Arial, sans-serif`; while (ctx.measureText(s[0]).width > w * 0.86 && size > 12) { size -= 3; ctx.font = `900 ${size}px "DejaVu Sans", Arial, sans-serif`; }
      ctx.shadowColor = s[3]; ctx.shadowBlur = 14; ctx.fillStyle = s[3]; ctx.fillText(s[0], x + 28, y + h * 0.42); ctx.shadowBlur = 0; ctx.font = `italic 28px "DejaVu Sans", Arial, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(s[1], x + 30, y + h * 0.72); ctx.restore();
    });
    place('blade', BLADES, (s, x, y, w, h) => { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#10141a'; ctx.fillRect(x, y, w, h); const col = ['#ff4aa0', '#46e6ff', '#ffd24a', '#7aff7a', '#ff7a3a'][s.length % 5]; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillStyle = col; ctx.font = `bold ${Math.min(26, 150 / s.length + 6)}px "DejaVu Sans", Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x + w / 2, y + h / 2 + 2); ctx.restore(); });
    const map = texFromCanvas(c, { srgb: true, aniso: 8, wrap: 'clamp' }); map.userData.shared = true;
    const emi = texFromCanvas(c, { srgb: true, aniso: 8, wrap: 'clamp' }); emi.userData.shared = true;
    return { map, emi, userData: { shared: true } };
  });
}

/** soft radial light-pool texture (for lamp / shop-glow ground decals, additive) */
export function getPoolTex() {
  return cached('city.pool', () => {
    const S = 128; const c = makeCanvas(S, S); const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(0.7, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); const t = texFromCanvas(c, { srgb: true, aniso: 1, wrap: 'clamp' }); t.userData.shared = true; return t;
  });
}
