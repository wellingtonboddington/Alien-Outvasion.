// Stone / masonry / metal-panel / dome-pattern textures for landmarks. Cached + shared.
import * as THREE from 'three';
import { RNG, Q } from '../../engine/common.js';
import { cached, texRes, texFromCanvas, makeCanvas } from '../../engine/proc.js';
import { Layers, dat, shade, rgba, lerpCol } from './paint.js';

/** kinds: sandstone | coral | redbrick | redsand | marble | steel | plaster | whitewash | copper | concrete2 */
export function getStone(kind) {
  return cached(`city.stone.${kind}.${Q.texSize}`, () => {
    const R = new RNG(kind.length * 3571 + kind.charCodeAt(1)); const S = { sandstone: 4, coral: 3, redbrick: 2, redsand: 4, marble: 6, steel: 4.8, plaster: 4, whitewash: 4, copper: 4, concrete2: 5 }[kind] || 4; const W = texRes(512);
    const L = new Layers(S, S, W / S); L.rng = R; const px = (m) => m * L.ppm;
    const blocks = (bw, bh, base, cols, joint = 'rgba(40,34,26,0.45)', jw = 0.014, stagger = true, rough = 215) => {
      L.rect(0, 0, S, S, base, dat(140, rough, 0));
      const rows = Math.ceil(S / bh); for (let r = 0; r < rows; r++) { const off = stagger ? (r % 2) * bw / 2 : 0; for (let x = -bw; x < S + bw; x += bw) { const bwv = bw * R.range(0.85, 1.15); const c = shade(R.pick(cols), R.range(0.88, 1.1)); L.rect(x + off + jw, r * bh + jw, bwv - jw * 2, bh - jw * 2, c, dat(R.range(150, 190), rough, 0)); } }
      for (let r = 0; r <= rows; r++) L.rect(0, r * bh - jw, S, jw * 2, joint, dat(70, 235, 0));
    };
    if (kind === 'sandstone') { blocks(0.95, 0.52, '#d8cfba', ['#ddd4c0', '#d2c9b2', '#e2dac6', '#cbc2aa', '#d9d0ba'], 'rgba(60,52,40,0.35)', 0.012); L.mottle(2, 41, 0.86, 1.05); L.mottle(9, 42, 0.92, 1.03); for (let i = 0; i < 14; i++) L.streak(R.range(0, S), R.range(0, S * 0.7), R.range(0.2, 0.7), R.range(0.8, 2.5), R.range(0.05, 0.12), '#3a3226'); L.grain(4000, [0.03, 0.1], [0.5, 1.5], ['#000', '#fff', '#8a8068']); }
    else if (kind === 'coral') { blocks(0.55, 0.32, '#e6e1d2', ['#ece8da', '#dcd7c6', '#f0ecde', '#d2cdba', '#e6e0cc'], 'rgba(60,56,46,0.4)', 0.014); L.mottle(2, 43, 0.88, 1.06); L.mottle(11, 44, 0.93, 1.03); for (let i = 0; i < 700; i++) { L.ctx.col.fillStyle = `rgba(40,36,28,${R.range(0.1, 0.32)})`; L.ctx.col.beginPath(); L.ctx.col.arc(px(R.range(0, S)), px(R.range(0, S)), px(R.range(0.006, 0.02)), 0, 7); L.ctx.col.fill(); } for (let i = 0; i < 24; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.3, 0.9), R.pick(['#4a5a38', '#3a3a30', '#5a6a48']), R.range(0.06, 0.16), R.range(0.8, 2.4)); L.grain(5000, [0.04, 0.12], [0.5, 1.5]); }
    else if (kind === 'redbrick') { blocks(0.25, 0.075, '#8a3a28', ['#9a3a28', '#8a3424', '#a84430', '#7a3020', '#94402c', '#a0502e'], 'rgba(220,210,190,0.55)', 0.007, true, 225); L.mottle(2, 45, 0.8, 1.05); L.mottle(8, 46, 0.88, 1.04); for (let i = 0; i < 10; i++) L.streak(R.range(0, S), R.range(0, S * 0.6), R.range(0.1, 0.4), R.range(0.5, 1.6), R.range(0.06, 0.14), '#1a1410'); L.grain(5000, [0.05, 0.16], [0.5, 1.4]); }
    else if (kind === 'redsand') { blocks(1.1, 0.42, '#a4503a', ['#a8523a', '#9c4a34', '#b05a40', '#984630', '#a45038'], 'rgba(40,24,18,0.5)', 0.014); L.mottle(2, 47, 0.8, 1.06); for (let b = 0; b < 4; b++) L.rect(0, b * S / 4 + 0.02, S, 0.08, 'rgba(220,180,120,0.25)'); for (let i = 0; i < 14; i++) L.streak(R.range(0, S), R.range(0, S * 0.7), R.range(0.2, 0.6), R.range(0.8, 2.2), R.range(0.08, 0.2), '#2a1a10'); L.grain(5000, [0.05, 0.16]); }
    else if (kind === 'marble') { L.rect(0, 0, S, S, '#ecebe6', dat(140, 90, 0)); L.mottle(2, 48, 0.9, 1.03); for (let i = 0; i < 26; i++) { let x = R.range(0, S), y = R.range(0, S); L.ctx.col.strokeStyle = `rgba(110,112,118,${R.range(0.1, 0.3)})`; L.ctx.col.lineWidth = Math.max(1, px(R.range(0.004, 0.012))); L.ctx.col.beginPath(); L.ctx.col.moveTo(px(x), px(y)); for (let k = 0; k < 8; k++) { x += R.range(-0.5, 0.5); y += R.range(0.1, 0.6); L.ctx.col.lineTo(px(x), px(y)); } L.ctx.col.stroke(); } for (let i = 0; i <= 6; i++) { L.rect(i - 0.01, 0, 0.02, S, 'rgba(60,60,60,0.35)', dat(70, 200, 0)); L.rect(0, i - 0.01, S, 0.02, 'rgba(60,60,60,0.35)', dat(70, 200, 0)); } L.grain(2500, [0.03, 0.08]); }
    else if (kind === 'steel') { L.rect(0, 0, S, S, '#c4c8cc', dat(150, 90, 150)); const n = 4; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = R.range(0.88, 1.08); L.rect(i * S / n + 0.02, j * S / n + 0.02, S / n - 0.04, S / n - 0.04, shade('#b8bcc0', t), dat(R.range(150, 190), R.range(70, 120), 150)); L.hgrad(i * S / n, j * S / n, S / n, S / n, [[0, 'rgba(255,255,255,0.18)'], [1, 'rgba(0,0,0,0.18)']]); } for (let i = 0; i <= n; i++) { L.rect(i * S / n - 0.015, 0, 0.03, S, 'rgba(30,32,36,0.8)', dat(60, 130, 120)); L.rect(0, i * S / n - 0.015, S, 0.03, 'rgba(30,32,36,0.8)', dat(60, 130, 120)); } L.mottle(4, 49, 0.85, 1.05); }
    else if (kind === 'plaster' || kind === 'whitewash') { L.rect(0, 0, S, S, kind === 'whitewash' ? '#f0ece0' : '#e4d8bc', dat(140, 225, 0)); L.mottle(2, 50, 0.9, 1.04); L.mottle(10, 51, 0.94, 1.03); for (let i = 0; i < 12; i++) L.streak(R.range(0, S), R.range(0, S * 0.7), R.range(0.2, 0.8), R.range(1, 3), R.range(0.03, 0.08), '#4a4030'); for (let i = 0; i < 3; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.2, 0.5), '#8a7a60', 0.18, R.range(0.6, 1.4)); L.grain(3000, [0.03, 0.09]); }
    else if (kind === 'copper') { L.rect(0, 0, S, S, '#5e9c86', dat(140, 140, 130)); for (let i = 0; i < 12; i++) { L.rect(i * S / 12, 0, 0.03, S, 'rgba(0,0,0,0.4)', dat(220, 130, 130)); } L.mottle(3, 52, 0.7, 1.12); for (let i = 0; i < 12; i++) L.blob(R.range(0, S), R.range(0, S), R.range(0.3, 0.8), R.pick(['#2a4a3a', '#7ab8a0', '#a8d0b8']), R.range(0.15, 0.35), R.range(1, 3)); }
    else { L.rect(0, 0, S, S, '#a8a69f', dat(140, 220, 0)); L.mottle(3, 53, 0.78, 1.06); L.grain(5000, [0.05, 0.2]); for (let i = 0; i < 12; i++) L.streak(R.range(0, S), R.range(0, S * 0.6), R.range(0.2, 0.7), R.range(1, 3), 0.15, '#222'); }
    const t = L.textures({ emissive: false }); t.userData = { shared: true }; t.tile = S; return t;
  });
}

/** dome / onion pattern atlas. 4 bands (bottom-up uv v in [i/4,(i+1)/4]): 0 red-green spiral, 1 gold-green diamonds, 2 blue-gold ribs, 3 gold plain with scale pattern */
export function getDomeTex() {
  return cached(`city.dome.${Q.texSize}`, () => {
    const W = texRes(512), H = texRes(512); const c = makeCanvas(W, H); const ctx = c.getContext('2d'); const d = ctx.createImageData(W, H); const o = d.data; const bandH = H / 4;
    const col = (hex) => { const k = new THREE.Color(hex); return [k.r * 255, k.g * 255, k.b * 255]; };
    const A = [col('#b83228'), col('#2f7a46'), col('#e8c050'), col('#f0e8d0')], Bb = [col('#d8b040'), col('#2a8a52'), col('#c89a30'), col('#1f5a3a')], Cc = [col('#1f4a9a'), col('#e0b840'), col('#2a5ab8'), col('#f2d878')], Dd = [col('#e8c050'), col('#c89a30'), col('#f4d878'), col('#a87a20')];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const band = 3 - Math.floor(y / bandH); const u = x / W, v = (y % bandH) / bandH; let rgb;
      if (band === 0) { const t = ((u * 8 + v * 3) % 1 + 1) % 1; rgb = t < 0.5 ? A[0] : A[1]; const t2 = ((u * 8 + v * 3 + 0.04) % 1 + 1) % 1; if (t2 < 0.07 || (t > 0.46 && t < 0.54)) rgb = A[2]; }
      else if (band === 1) { const a = ((u * 8 + v * 4) % 1 + 1) % 1, b = ((u * 8 - v * 4) % 1 + 1) % 1; const on = (a < 0.5) !== (b < 0.5); rgb = on ? Bb[1] : Bb[0]; if (Math.abs(a - 0.5) < 0.03 || Math.abs(b - 0.5) < 0.03 || a < 0.03 || b < 0.03) rgb = Bb[2]; }
      else if (band === 2) { const t = (u * 12) % 1; rgb = t < 0.8 ? Cc[0] : Cc[1]; if (t > 0.35 && t < 0.45) rgb = Cc[2]; if (t < 0.04) rgb = Cc[3]; }
      else { const row = Math.floor(v * 8), t = ((u * 16 + (row % 2) * 0.5) % 1), cy = (v * 8) % 1; const dx = t - 0.5, dy = cy - 0.35; const inside = dx * dx * 2 + dy * dy < 0.12; rgb = inside ? Dd[2] : Dd[1]; if (Math.hypot(dx, dy) < 0.12) rgb = Dd[0]; }
      const i = (y * W + x) * 4; o[i] = rgb[0]; o[i + 1] = rgb[1]; o[i + 2] = rgb[2]; o[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0); const t = texFromCanvas(c, { srgb: true, aniso: 8, wrap: 'repeat' }); t.userData.shared = true; return t;
  });
}
export const DOME_BAND = (i) => [0, i / 4 + 0.01, 1, (i + 1) / 4 - 0.01];
