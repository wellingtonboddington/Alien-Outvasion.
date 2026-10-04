// Facade tile painters. Each facade is a tile of (bays x floors) painted into colour/emissive/data layers (see paint.js).
// Tiles repeat in U every `bays` bays and in V every `floors` floors; building code snaps wall length to whole bays.
import { RNG, Q } from '../../engine/common.js';
import { texRes, cached } from '../../engine/proc.js';
import { Layers, dat, shade, lerpCol, rgba, pickW } from './paint.js';

/** Spec table: bw = bay width (m), fh = floor height (m), bays/floors per tile, win = window box as fractions of a bay cell (for damage decals) */
export const FACADE = {
  tropic: { bw: 3.2, fh: 3.0, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.52, h: 0.4 }, seed: 11 },
  shop_ph: { bw: 3.2, fh: 3.8, bays: 4, floors: 1, win: { cx: 0.5, cy: 0.45, w: 0.7, h: 0.55 }, seed: 12 },
  shop_us: { bw: 3.2, fh: 4.2, bays: 4, floors: 1, win: { cx: 0.5, cy: 0.45, w: 0.8, h: 0.6 }, seed: 13 },
  shop_eu: { bw: 2.6, fh: 4.0, bays: 4, floors: 1, win: { cx: 0.5, cy: 0.45, w: 0.8, h: 0.6 }, seed: 14 },
  shop_in: { bw: 3.0, fh: 3.4, bays: 4, floors: 1, win: { cx: 0.5, cy: 0.45, w: 0.8, h: 0.6 }, seed: 15 },
  tenement: { bw: 2.8, fh: 3.2, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.4, h: 0.5 }, seed: 16 },
  altbau: { bw: 2.7, fh: 3.5, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.5, h: 0.6 }, seed: 17 },
  plattenbau: { bw: 2.7, fh: 2.8, bays: 4, floors: 3, win: { cx: 0.5, cy: 0.5, w: 0.5, h: 0.48 }, seed: 18 },
  stalin: { bw: 3.0, fh: 3.8, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.45, h: 0.6 }, seed: 19 },
  deco: { bw: 1.9, fh: 4.0, bays: 6, floors: 3, win: { cx: 0.5, cy: 0.5, w: 0.55, h: 0.55 }, seed: 20 },
  glass: { bw: 1.5, fh: 3.8, bays: 8, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.9, h: 0.7 }, seed: 21 },
  office: { bw: 3.0, fh: 3.6, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.9, h: 0.55 }, seed: 22 },
  delhi: { bw: 3.0, fh: 2.9, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.4, h: 0.4 }, seed: 23 },
  industrial: { bw: 3.0, fh: 4.5, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.7, w: 0.8, h: 0.2 }, seed: 24 },
  siding: { bw: 2.8, fh: 2.8, bays: 4, floors: 2, win: { cx: 0.5, cy: 0.5, w: 0.4, h: 0.45 }, seed: 25 },
};

const SKY = ['#9bbdda', '#7fa3c4', '#5f86a8', '#b4cde2', '#6a8fae', '#8aa9c2'];
const CURT = ['#e8d7c0', '#c9d8c4', '#e6c4c4', '#c4d0e6', '#f0e2a8', '#d9c4e0', '#f2f2ea'];
const WARM = ['#ffd58a', '#ffe3a8', '#ffc470', '#fff0cc', '#ffdca0', '#e8f2ff', '#ffe9b8', '#ffb86a'];

// ---------- shared pieces ----------
/** glass pane with sky reflection / dark interior; optionally lit. lit: emissive colour or null */
function pane(L, rng, x, y, w, h, o = {}) {
  const { lit = null, curtain = 0.0, blinds = 0, glare = 0.5, dark = 0.55 } = o;
  const top = o.top || rng.pick(SKY); const bot = o.bot || shade('#1c2a36', 1 + rng.range(-0.2, 0.3));
  L.vgrad(x, y, w, h, [[0, top], [Math.max(0.2, 1 - dark), lerpCol(top, bot, 0.6)], [1, bot]]);
  L.rect(x, y, w, h, null, dat(60, 40, 110));
  if (rng.chance(glare)) { // diagonal reflection streak
    const k = rng.range(0.15, 0.5), wd = rng.range(0.15, 0.35) * w; L.poly([[x + k * w, y], [x + k * w + wd, y], [x + k * w + wd - h * 0.3, y + h], [x + k * w - h * 0.3, y + h]].map((p) => [Math.min(Math.max(p[0], x), x + w), p[1]]), 'rgba(255,255,255,0.13)');
  }
  const cc = rng.pick(CURT);
  if (curtain > 0 && rng.chance(curtain)) { // curtains: two side drapes or one pulled panel
    const cw = w * rng.range(0.28, 0.5);
    L.rect(x, y, cw, h * 0.98, rgba(cc, 0.78)); L.rect(x + w - cw * rng.range(0.6, 1), y, cw, h * 0.98, rgba(cc, 0.78));
    for (let i = 0; i < 4; i++) L.line(x + (i + 0.5) * cw / 4, y, x + (i + 0.5) * cw / 4, y + h, 0.012, 'rgba(0,0,0,0.12)');
    if (lit) { L.rect(x + 0.0, y, cw, h * 0.98, null, null, shade(lit, 0.75)); L.rect(x + w - cw, y, cw, h * 0.98, null, null, shade(lit, 0.75)); }
  } else if (blinds > 0 && rng.chance(blinds)) {
    const bh = h * rng.range(0.4, 1); const step = Math.max(0.04, h / 14);
    L.rect(x, y, w, bh, rgba(cc, 0.82)); for (let yy = y; yy < y + bh; yy += step) L.rect(x, yy, w, step * 0.18, 'rgba(0,0,0,0.25)');
  }
  if (lit) { // interior glow gradient + a few dark shapes (furniture)
    const lg = L.ctx.emi.createLinearGradient(0, y * L.ppm, 0, (y + h) * L.ppm); lg.addColorStop(0, shade(lit, 1)); lg.addColorStop(1, shade(lit, 0.5));
    // paint emissive then overpaint curtain edges
    L.ctx.emi.fillStyle = lg; L.ctx.emi.fillRect(x * L.ppm, y * L.ppm, w * L.ppm, h * L.ppm);
    L.rect(x, y, w, h, 'rgba(255,214,140,0.28)'); // warm interior visible in daytime too
    if (rng.chance(0.4)) L.rect(x + w * rng.range(0.1, 0.6), y + h * 0.55, w * rng.range(0.15, 0.3), h * 0.45, 'rgba(10,8,6,0.5)', null, 'rgba(0,0,0,0.65)');
    if (rng.chance(0.3)) { const s = rng.range(0.1, 0.18) * w; L.rect(x + w * rng.range(0.1, 0.8), y + h * 0.1, s, s * 0.5, null, null, 'rgba(0,0,0,0.55)'); }
  }
}
function frame(L, x, y, w, h, t, c, d = dat(175, 110, 170)) {
  L.rect(x - t, y - t, w + 2 * t, t, c, d); L.rect(x - t, y + h, w + 2 * t, t, c, d); L.rect(x - t, y, t, h, c, d); L.rect(x + w, y, t, h, c, d);
}
function sill(L, x, y, w, c, depth = 0.1, over = 0.08) {
  L.rect(x - over, y, w + 2 * over, depth, c, dat(205, 190, 0)); L.rect(x - over, y + depth, w + 2 * over, 0.04, 'rgba(0,0,0,0.35)', dat(110, 220, 0));
}
function drip(L, rng, cx, y, w, tileBottom) { const len = Math.min(rng.range(0.8, 2.0), tileBottom - y - 0.1); if (len > 0.2) L.streak(cx + rng.range(-w / 3, w / 3), y, rng.range(0.25, 0.7) * w * 0.7, len, rng.range(0.1, 0.22)); }
function bars(L, x, y, w, h, c = '#1c1c1e', spacing = 0.13) {
  const n = Math.max(2, Math.round(w / spacing)); for (let i = 0; i <= n; i++) L.rect(x + (i / n) * w - 0.012, y, 0.024, h, c, dat(170, 120, 200));
  L.rect(x, y + h * 0.33, w, 0.025, c, dat(175, 120, 200)); L.rect(x, y + h * 0.66, w, 0.025, c, dat(175, 120, 200)); L.rect(x, y, w, 0.03, c); L.rect(x, y + h - 0.03, w, 0.03, c);
}
function acUnit(L, rng, x, y, w, h) {
  L.rect(x, y, w, h, '#d9dad6', dat(180, 130, 40)); L.rect(x + w * 0.08, y + h * 0.15, w * 0.84, h * 0.55, '#a9acaa', dat(110, 110, 60));
  for (let i = 0; i < 6; i++) L.rect(x + w * 0.1, y + h * (0.2 + i * 0.075), w * 0.8, h * 0.02, '#6d706f');
  L.rect(x + w * 0.1, y + h * 0.78, w * 0.3, h * 0.07, '#2c3a2c');
  L.streak(x + w * rng.range(0.2, 0.8), y + h, w * 0.3, rng.range(0.5, 1.1), 0.28, '#3a2a1a');
}
function finishWall(L, o = {}) {
  L.mottle(3, o.s1 || 5, o.lo1 ?? 0.8, 1); L.mottle(11, (o.s1 || 5) + 2, o.lo2 ?? 0.9, 1); L.mottleDat(7, 3, 0.35);
  L.grain(o.grain ?? Math.round(L.W * L.H / 70), [0.04, 0.16], [0.6, 1.8], ['#000', '#fff', '#6a5f50']);
}
/** mortar & texture on window recess shading (shadow under head) */
function headShadow(L, x, y, w, h = 0.22) { L.vgrad(x, y, w, h, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]); }

// ---------- painters ----------
function paintTropic(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#f1ede4', dat(140, 215, 0));
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh; // canvas top of floor f
    // slab / belt line
    L.rect(0, yf - 0.1, tw, 0.28, '#e2dcd0', dat(175, 215, 0)); L.rect(0, yf + 0.18, tw, 0.1, 'rgba(0,0,0,0.22)', dat(100, 220, 0));
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw, cx = x0 + bw / 2; const kind = pickW(rng, [['slide', 40], ['jalousie', 20], ['balcony', 22], ['grill', 18]]);
      const lit = rng.chance(0.32) ? rng.pick(WARM) : null;
      const ww = kind === 'balcony' ? bw * 0.72 : rng.range(1.5, 1.95), wh = kind === 'balcony' ? 2.1 : 1.2; const wx = cx - ww / 2, wy = yf + (kind === 'balcony' ? 0.55 : 0.95);
      if (kind === 'balcony') {
        L.rect(wx - 0.08, wy - 0.08, ww + 0.16, wh + 0.16, '#cfc8b8', dat(160, 215, 0));
        L.rect(wx, wy, ww, wh, '#161d24', dat(40, 215, 0)); pane(L, rng, wx + ww * 0.05, wy + 0.1, ww * 0.55, wh - 0.1, { lit, curtain: 0.7 });
        // sliding door frame
        frame(L, wx + ww * 0.05, wy + 0.1, ww * 0.55, wh - 0.1, 0.035, '#d8dadc'); L.rect(wx + ww * 0.05 + ww * 0.275, wy + 0.1, 0.03, wh - 0.1, '#d8dadc', dat(175, 110, 170));
        // railing: top rail + balusters, laundry
        const ry = wy + wh - 1.0; L.rect(wx - 0.04, ry, ww + 0.08, 0.05, '#2c2f33', dat(180, 100, 200));
        const nb = Math.round(ww / 0.12); for (let i = 0; i <= nb; i++) L.rect(wx + (i / nb) * ww - 0.01, ry, 0.02, 1.0, '#2c2f33', dat(170, 100, 200));
        if (rng.chance(0.5)) { for (let i = 0; i < rng.int(2, 4); i++) { const lx = wx + ww * rng.range(0.55, 0.92), lw = rng.range(0.22, 0.4); L.rect(lx, ry + 0.06, lw, rng.range(0.4, 0.75), rng.pick(['#d8453a', '#3a7bd5', '#f2c230', '#f4f4f0', '#3aa86f', '#e86a9a', '#7a52c8']), dat(150, 235, 0)); } }
        else if (rng.chance(0.5)) { L.rect(wx + ww * 0.7, ry - 0.35, 0.35, 0.35, '#2e6b34', dat(160, 230, 0)); } // plant
        L.rect(wx - 0.1, wy + wh, ww + 0.2, 0.12, '#c8c2b4', dat(190, 215, 0)); // slab
        L.streak(cx, wy + wh + 0.12, ww * 0.9, Math.min(1.6, th - (wy + wh) - 0.3), 0.18);
      } else {
        const hood = rng.chance(0.3);
        L.rect(wx - 0.1, wy - 0.1, ww + 0.2, wh + 0.2, '#e7e1d6', dat(165, 215, 0)); // surround
        pane(L, rng, wx, wy, ww, wh, { lit, curtain: 0.5, blinds: 0.25 });
        if (kind === 'jalousie') { frame(L, wx, wy, ww, wh, 0.045, '#d6d9db'); const n = Math.round(wh / 0.1); for (let i = 1; i < n; i++) { const yy = wy + (i / n) * wh; L.rect(wx, yy, ww, 0.025, 'rgba(235,240,245,0.55)', dat(150, 80, 100)); L.rect(wx, yy + 0.025, ww, 0.02, 'rgba(0,0,0,0.3)'); } L.rect(wx + ww / 2 - 0.015, wy, 0.03, wh, '#d6d9db'); }
        else { frame(L, wx, wy, ww, wh, 0.045, '#dcdee0'); const panes = ww > 1.7 ? 3 : 2; for (let i = 1; i < panes; i++) L.rect(wx + (i / panes) * ww - 0.02, wy, 0.04, wh, '#dcdee0', dat(180, 100, 170)); L.rect(wx, wy + wh * 0.5 - 0.012, ww, 0.024, 'rgba(220,222,224,0.5)'); }
        if (kind === 'slide' && rng.chance(0.28)) acUnit(L, rng, wx + ww * 0.55, wy + 0.15, ww * 0.42, wh * 0.7);
        if (kind === 'grill') bars(L, wx - 0.02, wy - 0.02, ww + 0.04, wh + 0.04, rng.pick(['#252527', '#2a2f3a', '#3a2a28', '#d8d4cc']));
        sill(L, wx, wy + wh + 0.1, ww, '#d9d3c6');
        if (hood) { L.rect(wx - 0.2, wy - 0.3, ww + 0.4, 0.14, '#d2ccc0', dat(200, 215, 0)); L.vgrad(wx - 0.2, wy - 0.16, ww + 0.4, 0.4, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]); } else headShadow(L, wx - 0.1, wy - 0.1, ww + 0.2, 0.22);
        drip(L, rng, cx, wy + wh + 0.18, ww, th - 0.2);
      }
    }
    // column pilasters
    for (let b = 0; b <= bays; b++) { const x = b * bw; L.rect(x - 0.14, yf + 0.28, 0.28, fh - 0.3, null, dat(158, 220, 0)); L.rect(x - 0.15, yf + 0.28, 0.03, fh - 0.3, 'rgba(0,0,0,0.12)'); L.rect(x + 0.12, yf + 0.28, 0.03, fh - 0.3, 'rgba(255,255,255,0.18)'); }
  }
  // moss / stain patches
  for (let i = 0; i < 22; i++) L.blob(rng.range(0, tw), rng.range(0, th), rng.range(0.5, 1.4), rng.pick(['#4a5a38', '#5a4a3a', '#2a2a2a']), rng.range(0.05, 0.12), rng.range(0.8, 2.2));
  finishWall(L, { s1: 5, lo1: 0.78 });
}

function paintShop(L, rng, spec, variant) {
  const { bw, fh, bays } = spec; const tw = L.tw, th = L.th;
  const wallC = { ph: '#e8e2d6', us: '#4a4038', eu: '#d8d2c4', in: '#e0d4bc' }[variant];
  L.rect(0, 0, tw, th, wallC, dat(140, 215, 0));
  const palette = { ph: ['#2f8f6d', '#2d6aa6', '#b33a3a', '#d8a02a', '#4a4a50'], us: ['#c8c4bc', '#2a2a2e', '#7a2828'], eu: ['#1d3a2c', '#2a2a30', '#5a2a2a'], in: ['#6a8a30', '#b0522a', '#3a5f9a', '#c8a030'] }[variant];
  // plinth
  L.rect(0, th - 0.35, tw, 0.35, shade(wallC, 0.62), dat(165, 220, 0));
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw, ww = bw - 0.5, wx = x0 + 0.25; const kind = pickW(rng, variant === 'ph' ? [['shutter', 30], ['store', 28], ['glass', 20], ['open', 12], ['door', 10]] : variant === 'in' ? [['stall', 45], ['shutter', 25], ['glass', 15], ['door', 15]] : [['glass', 55], ['shutter', 18], ['door', 15], ['store', 12]]);
    const topY = variant === 'us' ? 0.9 : 0.75, botY = th - 0.35; const hh = botY - topY - 0.1;
    // fascia sign board background (signs themselves are geometry)
    L.rect(x0 + 0.05, 0.12, bw - 0.1, topY - 0.22, shade(wallC, 0.92), dat(150, 200, 0));
    if (kind === 'shutter') {
      const c = rng.pick(palette); L.rect(wx, topY, ww, hh, c, dat(150, 120, 140));
      const n = Math.round(hh / 0.075); for (let i = 0; i < n; i++) { const yy = topY + (i / n) * hh; L.rect(wx, yy, ww, 0.025, 'rgba(0,0,0,0.30)', dat(110, 150, 140)); L.rect(wx, yy + 0.04, ww, 0.015, 'rgba(255,255,255,0.12)'); }
      const open = rng.range(0, 0.28) * hh; if (rng.chance(0.4)) { L.rect(wx, topY, ww, open, '#0c0d10', dat(40, 220, 0)); L.rect(wx, topY + open - 0.02, ww, 0.05, '#555'); }
      L.rect(wx + ww * 0.45, topY + hh - 0.25, 0.1, 0.1, '#8c8a85', dat(180, 90, 220));
      if (rng.chance(0.5)) { const gx = wx + rng.range(0.1, ww * 0.6); L.rect(gx, topY + hh * rng.range(0.2, 0.6), rng.range(0.4, 0.9), 0.18, rng.pick(['rgba(255,70,120,0.7)', 'rgba(30,30,30,0.6)', 'rgba(70,200,255,0.65)'])); }
      L.streak(wx + ww * 0.3, topY + 0.1, 0.2, 0.9, 0.2, '#5a2a10');
      L.rect(wx - 0.08, topY - 0.08, ww + 0.16, 0.1, shade(wallC, 0.7), dat(180, 190, 0)); L.rect(wx - 0.08, topY - 0.08, 0.08, hh + 0.1, shade(wallC, 0.7)); L.rect(wx + ww, topY - 0.08, 0.08, hh + 0.1, shade(wallC, 0.7));
    } else if (kind === 'store' || kind === 'stall' || kind === 'open') {
      // open-front sari-sari / market stall: dark interior with shelves of goods, counter, grill
      L.rect(wx, topY, ww, hh, '#15110e', dat(45, 215, 0), 'rgba(0,0,0,1)');
      const lit = rng.chance(0.7); const lightC = lit ? rng.pick(['#fff0c8', '#fffbe8', '#ffe2a0']) : null;
      if (lit) L.rect(wx, topY, ww, hh * 0.9, 'rgba(255,224,160,0.28)', null, shade(lightC, 0.55));
      for (let sh = 0; sh < 4; sh++) { // shelves with colourful goods
        const sy = topY + 0.15 + sh * (hh * 0.17); L.rect(wx + 0.05, sy + hh * 0.12, ww - 0.1, 0.03, '#5a432a', dat(170, 200, 0));
        let gx = wx + 0.08; while (gx < wx + ww - 0.2) { const gw = rng.range(0.07, 0.18), gh = rng.range(0.08, 0.15); const gc = rng.pick(['#e03a3a', '#f2c230', '#2f6fd2', '#3aa86f', '#f2f2f2', '#e87a2a', '#c04aa8', '#2ac0d8']); L.rect(gx, sy + hh * 0.12 - gh, gw, gh, gc, null, lit ? shade(gc, 0.5) : null); gx += gw + rng.range(0.01, 0.05); }
      }
      // hanging snack packs
      if (variant === 'ph' || variant === 'in') for (let i = 0; i < Math.round(ww / 0.14); i++) { if (rng.chance(0.75)) L.rect(wx + 0.06 + i * 0.14, topY + 0.02, 0.06, rng.range(0.15, 0.4), rng.pick(['#e03a3a', '#f2c230', '#2f6fd2', '#3aa86f', '#f2f2f2', '#e87a2a']), null, lit ? 'rgba(120,90,50,1)' : null); }
      // counter + grill
      L.rect(wx - 0.05, topY + hh * 0.62, ww + 0.1, hh * 0.38, rng.pick(['#5a7ab0', '#c8b080', '#7a5a3a', '#a8483a']), dat(150, 180, 0)); L.rect(wx - 0.05, topY + hh * 0.62, ww + 0.1, 0.06, '#d8d2c4', dat(200, 190, 0));
      if (kind !== 'open') bars(L, wx, topY, ww, hh * 0.62, '#26262a', 0.14);
      L.rect(wx - 0.1, topY - 0.14, ww + 0.2, 0.16, shade(wallC, 0.7), dat(180, 190, 0));
    } else if (kind === 'glass') {
      L.rect(wx - 0.06, topY - 0.06, ww + 0.12, hh + 0.12, variant === 'eu' ? '#1d2a24' : '#aab0b5', dat(180, 100, 200));
      const lit = rng.chance(0.65) ? rng.pick(WARM) : null; pane(L, rng, wx, topY, ww, hh * 0.92, { lit, curtain: 0.15, blinds: 0.15, glare: 0.7, dark: 0.8 });
      const n = ww > 2 ? 2 : 1; for (let i = 1; i <= n; i++) L.rect(wx + (i / (n + 1)) * ww - 0.025, topY, 0.05, hh * 0.92, variant === 'eu' ? '#1d2a24' : '#aab0b5', dat(180, 100, 200));
      L.rect(wx, topY + hh * 0.92, ww, hh * 0.08, shade(wallC, 0.55), dat(160, 220, 0));
      if (lit && rng.chance(0.7)) { for (let i = 0; i < 3; i++) L.rect(wx + ww * rng.range(0.1, 0.8), topY + hh * rng.range(0.3, 0.75), rng.range(0.15, 0.4), hh * rng.range(0.1, 0.25), 'rgba(0,0,0,0.5)', null, 'rgba(0,0,0,0.6)'); }
    } else { // door
      const dw = Math.min(1.3, ww), dx = x0 + (bw - dw) / 2; L.rect(dx - 0.1, topY + 0.1, dw + 0.2, hh - 0.1, shade(wallC, 0.7), dat(165, 215, 0));
      L.rect(dx, topY + 0.2, dw, hh - 0.2, rng.pick(['#3a2c20', '#2a4a3a', '#4a2020', '#2a2f40']), dat(150, 160, 30)); L.rect(dx + dw * 0.1, topY + 0.35, dw * 0.8, hh * 0.45, 'rgba(120,150,170,0.45)', dat(80, 60, 100), rng.chance(0.3) ? 'rgba(255,220,150,0.7)' : null);
      L.rect(dx + dw * 0.82, topY + hh * 0.55, 0.05, 0.14, '#c8c8c0'); L.rect(dx - 0.2, th - 0.5, dw + 0.4, 0.2, shade(wallC, 0.75), dat(185, 215, 0));
    }
    if (variant === 'us' && rng.chance(0.5)) { // striped awning
      const aw = ww + 0.2, ay = 0.8, c1 = rng.pick(['#b83232', '#2f5fa8', '#2a7a4a', '#222']); const ns = Math.round(aw / 0.18); for (let i = 0; i < ns; i++) L.rect(wx - 0.1 + i * aw / ns, ay, aw / ns, 0.5, i % 2 ? '#e8e4dc' : c1, dat(160, 230, 0));
      L.vgrad(wx - 0.1, ay + 0.5, aw, 0.3, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
    }
  }
  for (let i = 0; i < 14; i++) L.blob(rng.range(0, tw), rng.range(0.6, th), rng.range(0.3, 0.9), rng.pick(['#2a2a2a', '#4a3a2a']), rng.range(0.05, 0.14), rng.range(0.8, 2));
  finishWall(L, { s1: 8, lo1: 0.75 });
}

function paintTenement(L, rng, spec) { // Manhattan-style brick walk-up
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#8c4a38', dat(135, 225, 0));
  // bricks
  const bh = 0.075, bl = 0.23; const rows = Math.ceil(th / bh); const ctx = L.ctx.col;
  const bricks = [['#8d4a36', '#9a523b', '#7e4030', '#a5603f', '#74392c', '#935743']];
  for (let r = 0; r < rows; r++) { const off = (r % 2) * bl / 2; for (let x = -bl; x < tw + bl; x += bl) { const c = rng.pick(bricks[0]); L.rect(x + off + 0.008, r * bh + 0.008, bl - 0.016, bh - 0.016, shade(c, rng.range(0.88, 1.1))); } }
  L.rect(0, 0, tw, th, null, dat(150, 225, 0));
  // mortar lines on data layer for bump
  for (let r = 0; r < rows; r++) L.rect(0, r * bh, tw, 0.012, null, dat(95, 230, 0));
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh;
    L.rect(0, yf + 0.0, tw, 0.18, '#c9bfa8', dat(185, 215, 0)); L.rect(0, yf + 0.18, tw, 0.08, 'rgba(0,0,0,0.3)', dat(100, 220, 0));
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw, cx = x0 + bw / 2, ww = bw * 0.46, wh = 1.7, wx = cx - ww / 2, wy = yf + 0.85; const lit = rng.chance(0.3) ? rng.pick(WARM) : null;
      L.rect(wx - 0.12, wy - 0.16, ww + 0.24, 0.16, '#cfc6b0', dat(190, 215, 0)); // lintel
      L.rect(wx - 0.05, wy - 0.02, ww + 0.1, wh + 0.04, '#e4e0d6', dat(165, 215, 0)); // frame
      pane(L, rng, wx, wy, ww, wh * 0.5, { lit, blinds: 0.4, curtain: 0.3 }); pane(L, rng, wx, wy + wh * 0.5, ww, wh * 0.5, { lit, blinds: 0.4, curtain: 0.3 });
      L.rect(wx, wy + wh * 0.5 - 0.025, ww, 0.05, '#e4e0d6', dat(180, 110, 100)); L.rect(wx + ww / 2 - 0.015, wy, 0.03, wh, '#e4e0d6', dat(180, 110, 100));
      L.rect(wx - 0.12, wy + wh + 0.04, ww + 0.24, 0.1, '#cfc6b0', dat(195, 215, 0)); L.rect(wx - 0.12, wy + wh + 0.14, ww + 0.24, 0.05, 'rgba(0,0,0,0.35)');
      if (rng.chance(0.2)) acUnit(L, rng, wx + ww * 0.15, wy + wh * 0.5, ww * 0.7, wh * 0.45);
      drip(L, rng, cx, wy + wh + 0.2, ww * 1.2, th - 0.2);
    }
  }
  for (let i = 0; i < 18; i++) L.blob(rng.range(0, tw), rng.range(0, th), rng.range(0.5, 1.4), rng.pick(['#1a1a1a', '#d8d0c0', '#4a3a2a']), rng.range(0.05, 0.13), rng.range(1, 2.5));
  L.mottle(3, 21, 0.78, 1); L.mottle(13, 22, 0.88, 1); L.grain(Math.round(L.W * L.H / 60), [0.04, 0.14], [0.6, 1.6]);
}

function paintAltbau(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#f0ead9', dat(140, 215, 0));
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh;
    // stucco belt course
    L.rect(0, yf - 0.05, tw, 0.35, '#e8e1cf', dat(185, 215, 0)); L.rect(0, yf + 0.3, tw, 0.08, 'rgba(0,0,0,0.3)', dat(100, 220, 0)); L.rect(0, yf + 0.38, tw, 0.4, null, dat(155, 215, 0));
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw, cx = x0 + bw / 2, ww = 1.3, wh = 2.15, wx = cx - ww / 2, wy = yf + 0.95; const lit = rng.chance(0.32) ? rng.pick(WARM) : null;
      L.rect(wx - 0.22, wy - 0.22, ww + 0.44, wh + 0.4, '#fbf7ea', dat(165, 215, 0)); // surround
      L.rect(wx - 0.22, wy - 0.22, ww + 0.44, 0.04, 'rgba(0,0,0,0.2)');
      if (f % 2 === 1) { L.poly([[wx - 0.3, wy - 0.22], [wx + ww + 0.3, wy - 0.22], [cx, wy - 0.62]], '#fbf7ea', dat(185, 215, 0)); L.poly([[wx - 0.1, wy - 0.24], [wx + ww + 0.1, wy - 0.24], [cx, wy - 0.52]], 'rgba(0,0,0,0.12)'); }
      else { L.rect(wx - 0.3, wy - 0.4, ww + 0.6, 0.18, '#fbf7ea', dat(190, 215, 0)); L.rect(wx - 0.25, wy - 0.22, ww + 0.5, 0.05, 'rgba(0,0,0,0.25)'); }
      L.rect(wx, wy, ww, wh, '#f4f2ea', dat(175, 100, 120)); // frame
      const pw = (ww - 0.18) / 2; const ph = (wh - 0.2); // two casements; transom
      for (let i = 0; i < 2; i++) { pane(L, rng, wx + 0.06 + i * (pw + 0.06), wy + 0.06, pw, ph * 0.28, { lit, curtain: 0.2 }); pane(L, rng, wx + 0.06 + i * (pw + 0.06), wy + 0.06 + ph * 0.28 + 0.04, pw, ph * 0.72 - 0.04, { lit, curtain: 0.65, blinds: 0.15 }); }
      L.rect(wx, wy + 0.06 + ph * 0.28 + 0.01, ww, 0.05, '#f4f2ea', dat(185, 100, 120));
      // muntins on lower casements
      for (let i = 0; i < 2; i++) { const px = wx + 0.06 + i * (pw + 0.06); L.rect(px + pw / 2 - 0.012, wy + 0.06 + ph * 0.28 + 0.04, 0.024, ph * 0.72, '#f4f2ea'); L.rect(px, wy + 0.06 + ph * 0.28 + 0.04 + ph * 0.36, pw, 0.024, '#f4f2ea'); }
      sill(L, wx - 0.1, wy + wh + 0.0, ww + 0.2, '#fbf7ea', 0.12, 0.1);
      // iron balcony railing on some
      if (rng.chance(0.28)) { const ry = wy + wh - 0.95; const nb = Math.round((ww + 0.3) / 0.1); L.rect(wx - 0.15, ry, ww + 0.3, 0.04, '#222', dat(175, 100, 200)); for (let i = 0; i <= nb; i++) L.rect(wx - 0.15 + i * (ww + 0.3) / nb - 0.01, ry, 0.02, 0.95, '#222', dat(165, 100, 200)); }
      drip(L, rng, cx, wy + wh + 0.16, ww * 1.1, th - 0.2);
    }
  }
  // plaster loss patches showing brick
  for (let i = 0; i < 6; i++) { const px = rng.range(0, tw), py = rng.range(0, th), r = rng.range(0.25, 0.6); L.blob(px, py, r, '#8a5a44', 0.55, rng.range(0.6, 1.4)); }
  for (let i = 0; i < 20; i++) L.blob(rng.range(0, tw), rng.range(0, th), rng.range(0.5, 1.4), rng.pick(['#2a2a2a', '#5a5a48', '#6a5a40']), rng.range(0.05, 0.13), rng.range(0.8, 2));
  finishWall(L, { s1: 3, lo1: 0.82 });
}

function paintPlatten(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#c8c6c0', dat(140, 220, 0));
  for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
    const x0 = b * bw, yf = th - (f + 1) * fh; const panelC = rng.chance(0.22) ? rng.pick(['#c9a368', '#7aa09a', '#b97a5a', '#aab48a']) : null;
    if (panelC) L.rect(x0 + 0.04, yf + 0.04, bw - 0.08, fh - 0.08, panelC, dat(142, 215, 0));
    const lit = rng.chance(0.33) ? rng.pick(WARM) : null;
    if (rng.chance(0.28)) { // loggia (recessed balcony)
      L.rect(x0 + 0.25, yf + 0.5, bw - 0.5, fh - 0.55, '#232830', dat(40, 215, 0));
      pane(L, rng, x0 + 0.5, yf + 0.65, bw - 1.0, fh - 1.5, { lit, curtain: 0.6 });
      L.rect(x0 + 0.2, yf + fh - 1.05, bw - 0.4, 1.0, rng.pick(['#bdb8a8', '#8a9aa8', '#a89a80']), dat(175, 215, 0)); // solid parapet panel
      for (let i = 0; i < 3; i++) L.rect(x0 + 0.3 + i * (bw - 0.6) / 3, yf + fh - 0.95, (bw - 0.6) / 3 - 0.06, 0.8, 'rgba(0,0,0,0.12)', dat(150, 215, 0));
      if (rng.chance(0.5)) L.rect(x0 + bw * rng.range(0.3, 0.6), yf + fh - 1.5, rng.range(0.3, 0.6), 0.45, rng.pick(['#d8453a', '#3a7bd5', '#f2c230', '#f4f4f0']), dat(150, 235, 0));
    } else {
      const ww = bw * 0.66, wh = 1.3, wx = x0 + (bw - ww) / 2, wy = yf + 0.7; L.rect(wx - 0.06, wy - 0.06, ww + 0.12, wh + 0.12, '#dcdad2', dat(168, 215, 0));
      pane(L, rng, wx, wy, ww / 2 - 0.03, wh, { lit, curtain: 0.6, blinds: 0.2 }); pane(L, rng, wx + ww / 2 + 0.03, wy, ww / 2 - 0.03, wh, { lit, curtain: 0.6, blinds: 0.2 });
      L.rect(wx + ww / 2 - 0.03, wy, 0.06, wh, '#e8e6de', dat(180, 110, 100)); L.rect(wx, wy + wh * 0.22, ww, 0.035, '#e8e6de');
      sill(L, wx - 0.05, wy + wh + 0.06, ww + 0.1, '#bfbcb2', 0.08); drip(L, rng, wx + ww / 2, wy + wh + 0.14, ww, th - 0.2);
    }
  }
  // panel joints
  for (let b = 0; b <= bays; b++) L.rect(b * bw - 0.025, 0, 0.05, th, 'rgba(40,40,36,0.55)', dat(80, 230, 0));
  for (let f = 0; f <= floors; f++) L.rect(0, th - f * fh - 0.025, tw, 0.05, 'rgba(40,40,36,0.55)', dat(80, 230, 0));
  for (let i = 0; i < 30; i++) L.streak(rng.range(0, tw), rng.range(0, th * 0.6), rng.range(0.15, 0.5), rng.range(1, 3), rng.range(0.08, 0.2), rng.pick(['#3a2a1a', '#222']));
  for (let i = 0; i < 20; i++) L.blob(rng.range(0, tw), rng.range(0, th), rng.range(0.4, 1.2), rng.pick(['#4a5a3a', '#2a2a2a']), 0.08, rng.range(0.8, 2));
  finishWall(L, { s1: 14, lo1: 0.74 });
}

function paintStalin(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#e8dcb8', dat(140, 215, 0));
  // ashlar course lines
  for (let y = 0; y < th; y += 0.45) L.rect(0, y, tw, 0.015, 'rgba(80,66,40,0.28)', dat(110, 225, 0));
  for (let y = 0, r = 0; y < th; y += 0.45, r++) for (let x = (r % 2) * 0.6; x < tw; x += 1.2) L.rect(x, y, 0.015, 0.45, 'rgba(80,66,40,0.22)', dat(120, 225, 0));
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh;
    L.rect(0, yf, tw, 0.22, '#d9cba0', dat(185, 215, 0)); L.rect(0, yf + 0.22, tw, 0.08, 'rgba(0,0,0,0.28)', dat(100, 220, 0));
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw, cx = x0 + bw / 2, ww = 1.35, wh = 2.45, wx = cx - ww / 2, wy = yf + 0.85; const lit = rng.chance(0.32) ? rng.pick(WARM) : null;
      L.rect(wx - 0.18, wy - 0.18, ww + 0.36, wh + 0.3, '#f4ecd2', dat(170, 215, 0));
      if (f % 2 === 0) { L.poly([[wx - 0.18, wy - 0.18], [wx + ww + 0.18, wy - 0.18], [wx + ww + 0.18, wy + 0.25], [cx, wy - 0.38], [wx - 0.18, wy + 0.25]], null, null); }
      L.rect(wx, wy, ww, wh, '#3a3026', dat(60, 215, 0));
      pane(L, rng, wx + 0.05, wy + 0.05, ww / 2 - 0.07, wh - 0.1, { lit, curtain: 0.5 }); pane(L, rng, wx + ww / 2 + 0.02, wy + 0.05, ww / 2 - 0.07, wh - 0.1, { lit, curtain: 0.5 });
      L.rect(wx, wy + wh * 0.28, ww, 0.05, '#3a3026'); L.rect(wx, wy + wh * 0.66, ww, 0.04, '#3a3026');
      sill(L, wx - 0.1, wy + wh + 0.12, ww + 0.2, '#f4ecd2', 0.14, 0.1); drip(L, rng, cx, wy + wh + 0.3, ww, th - 0.2);
    }
    // pilasters between bays
    for (let b = 0; b <= bays; b++) { const x = b * bw; L.rect(x - 0.22, yf + 0.3, 0.44, fh - 0.3, '#efe4c4', dat(170, 215, 0)); L.rect(x - 0.22, yf + 0.3, 0.04, fh - 0.3, 'rgba(0,0,0,0.12)'); L.rect(x + 0.18, yf + 0.3, 0.04, fh - 0.3, 'rgba(255,255,255,0.2)'); }
  }
  for (let i = 0; i < 24; i++) L.blob(rng.range(0, tw), rng.range(0, th), rng.range(0.5, 1.4), rng.pick(['#3a3020', '#6a5a3a', '#2a2a2a']), rng.range(0.06, 0.14), rng.range(0.8, 2.2));
  finishWall(L, { s1: 31, lo1: 0.8 });
}

function paintDeco(L, rng, spec) { // skyscraper: limestone piers + recessed spandrels, vertical emphasis
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#cfc9b8', dat(150, 215, 0));
  for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
    const x0 = b * bw, yf = th - (f + 1) * fh; const wx = x0 + 0.34, ww = bw - 0.68; const lit = rng.chance(0.38) ? rng.pick(WARM.slice(0, 7)) : null;
    L.rect(wx, yf, ww, fh, '#26303a', dat(70, 160, 140)); // recessed bay
    pane(L, rng, wx + 0.06, yf + 0.5, ww - 0.12, fh - 1.25, { lit, curtain: 0.2, blinds: 0.3, glare: 0.4 });
    L.rect(wx + 0.06, yf + 0.5, ww - 0.12, 0.05, '#8a8f95', dat(190, 100, 180));
    L.rect(wx + ww / 2 - 0.02, yf + 0.5, 0.04, fh - 1.25, '#8a8f95', dat(190, 100, 180));
    L.rect(wx, yf + fh - 0.72, ww, 0.72, '#4a525a', dat(110, 120, 190)); // spandrel panel
    for (let i = 0; i < 3; i++) L.rect(wx + 0.08, yf + fh - 0.62 + i * 0.2, ww - 0.16, 0.03, 'rgba(255,255,255,0.14)');
    L.rect(wx - 0.05, yf, ww + 0.1, 0.12, 'rgba(0,0,0,0.5)');
  }
  for (let b = 0; b <= bays; b++) { const x = b * bw; L.rect(x - 0.33, 0, 0.66, th, '#d8d2c0', dat(190, 215, 0)); L.rect(x - 0.33, 0, 0.04, th, 'rgba(0,0,0,0.14)'); L.rect(x + 0.29, 0, 0.04, th, 'rgba(255,255,255,0.22)'); }
  for (let i = 0; i < 26; i++) L.streak(rng.range(0, tw), rng.range(0, th * 0.7), rng.range(0.2, 0.6), rng.range(1.2, 3.5), rng.range(0.06, 0.15), '#2a2420');
  finishWall(L, { s1: 41, lo1: 0.82 });
}

function paintGlass(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#3a4752', dat(160, 90, 190));
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh; const litRow = rng.chance(0.55);
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw; const lit = (litRow ? rng.chance(0.6) : rng.chance(0.12)) ? rng.pick(['#eef6ff', '#fff4dc', '#dff0ff', '#fff0c0']) : null;
      const top = rng.pick(['#b8d4e8', '#9ec0d8', '#cfe2ee', '#7aa4c2', '#a8c8d4']); const bot = rng.pick(['#26384a', '#2e4256', '#1f3040']);
      pane(L, rng, x0 + 0.03, yf + 0.04, bw - 0.06, fh - 0.88, { lit, top, bot, dark: 0.7, glare: 0.8 });
      // spandrel (opaque slab zone) with slightly different tone
      L.rect(x0 + 0.03, yf + fh - 0.84, bw - 0.06, 0.84, '#3c4c58', dat(105, 60, 160)); L.vgrad(x0 + 0.03, yf + fh - 0.84, bw - 0.06, 0.84, [[0, 'rgba(160,200,225,0.35)'], [1, 'rgba(10,20,30,0.3)']]);
    }
    L.rect(0, yf + fh - 0.05, tw, 0.05, '#aab4bc', dat(180, 90, 220));
  }
  for (let b = 0; b <= bays; b++) L.rect(b * bw - 0.04, 0, 0.08, th, '#c0c8d0', dat(200, 80, 230));
  L.mottle(2, 51, 0.88, 1, 'multiply', 0.8); L.grain(Math.round(L.W * L.H / 200), [0.03, 0.1], [0.6, 1.4]);
}

function paintOffice(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#b9b8b2', dat(145, 215, 0));
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh;
    L.rect(0, yf, tw, 0.95, '#c8c7c0', dat(165, 205, 0)); L.rect(0, yf + 0.95, tw, 0.1, 'rgba(0,0,0,0.3)', dat(100, 215, 0)); // spandrel
    const litRow = rng.chance(0.5);
    for (let b = 0; b < bays * 2; b++) {
      const wx = b * bw / 2, lit = (litRow ? rng.chance(0.55) : rng.chance(0.12)) ? rng.pick(WARM) : null;
      pane(L, rng, wx + 0.025, yf + 1.1, bw / 2 - 0.05, fh - 1.4, { lit, curtain: 0.2, blinds: 0.5, glare: 0.6 });
      L.rect(wx - 0.03, yf + 1.05, 0.06, fh - 1.3, '#2b2f34', dat(180, 90, 220));
    }
    L.rect(0, yf + fh - 0.3, tw, 0.08, '#2b2f34', dat(180, 90, 220));
  }
  for (let i = 0; i < 20; i++) L.streak(rng.range(0, tw), rng.range(0, th * 0.6), rng.range(0.15, 0.5), rng.range(1, 3), rng.range(0.06, 0.16), '#222');
  finishWall(L, { s1: 61, lo1: 0.8 });
}

function paintDelhi(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#e2d3b4', dat(140, 225, 0));
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh;
    L.rect(0, yf, tw, 0.2, '#cdbf9e', dat(170, 225, 0)); L.rect(0, yf + 0.2, tw, 0.07, 'rgba(0,0,0,0.25)');
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw, cx = x0 + bw / 2; const kind = pickW(rng, [['shutter', 45], ['open', 25], ['ac', 15], ['arch', 15]]); const lit = rng.chance(0.3) ? rng.pick(WARM) : null;
      const ww = 1.1, wh = 1.25, wx = cx - ww / 2, wy = yf + 0.85;
      L.rect(wx - 0.1, wy - 0.1, ww + 0.2, wh + 0.2, '#d9cdb0', dat(165, 225, 0));
      if (kind === 'shutter') { L.rect(wx, wy, ww, wh, rng.pick(['#3a6a4a', '#7a5a2a', '#2a4a6a', '#6a2a2a']), dat(150, 180, 0)); L.rect(wx + ww / 2 - 0.01, wy, 0.02, wh, 'rgba(0,0,0,0.5)'); for (let i = 1; i < 9; i++) L.rect(wx, wy + i * wh / 9, ww, 0.015, 'rgba(0,0,0,0.3)'); if (rng.chance(0.4)) L.rect(wx + ww * 0.55, wy, ww * 0.45, wh, '#0c0e10', dat(40, 215, 0), lit ? shade(lit, 0.8) : null); }
      else if (kind === 'arch') { L.rect(wx, wy, ww, wh, '#15171a', dat(45, 215, 0)); pane(L, rng, wx + 0.08, wy + 0.1, ww - 0.16, wh - 0.1, { lit, curtain: 0.6 }); bars(L, wx, wy, ww, wh, '#242426', 0.12); }
      else if (kind === 'ac') { pane(L, rng, wx, wy, ww, wh, { lit, curtain: 0.5 }); frame(L, wx, wy, ww, wh, 0.04, '#c8c8c4'); acUnit(L, rng, wx + 0.1, wy + 0.1, ww * 0.6, wh * 0.55); }
      else { pane(L, rng, wx, wy, ww, wh, { lit, curtain: 0.5, blinds: 0.2 }); frame(L, wx, wy, ww, wh, 0.05, '#7a5a3a', dat(165, 170, 0)); L.rect(wx + ww / 2 - 0.02, wy, 0.04, wh, '#7a5a3a'); }
      // chhajja sunshade
      L.rect(wx - 0.25, wy - 0.22, ww + 0.5, 0.12, '#c4b690', dat(200, 225, 0)); L.vgrad(wx - 0.25, wy - 0.1, ww + 0.5, 0.35, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
      drip(L, rng, cx, wy + wh + 0.1, ww * 1.2, th - 0.2);
      // dangling wires
      if (rng.chance(0.4)) L.line(x0 + bw * rng.range(0.1, 0.9), yf + 0.3, x0 + bw * rng.range(0.1, 0.9), yf + fh * rng.range(0.5, 0.95), 0.02, 'rgba(10,10,10,0.8)');
    }
  }
  // hand painted wall ads
  for (let i = 0; i < 2; i++) { const ax = rng.range(0, tw - 2.4), ay = rng.range(0.2, th - 1.4); const c = rng.pick(['rgba(180,40,30,0.5)', 'rgba(230,180,30,0.5)', 'rgba(30,90,160,0.45)']); L.rect(ax, ay, 2.2, 0.9, c); L.ctx.col.font = `bold ${Math.round(0.5 * L.ppm)}px sans-serif`; L.ctx.col.fillStyle = 'rgba(250,250,240,0.7)'; L.ctx.col.fillText(rng.pick(['HOTEL', 'SWEETS', 'CHAI', 'MOBILE', 'TAILOR', 'ELECTRIC']), (ax + 0.15) * L.ppm, (ay + 0.65) * L.ppm); }
  for (let i = 0; i < 26; i++) L.blob(rng.range(0, tw), rng.range(0, th), rng.range(0.4, 1.3), rng.pick(['#3a2a1a', '#5a5a40', '#1a1a1a', '#8a3a20']), rng.range(0.06, 0.16), rng.range(0.8, 2.2));
  finishWall(L, { s1: 71, lo1: 0.72, lo2: 0.85 });
}

function paintIndustrial(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#aeb4b4', dat(140, 150, 90));
  const ribs = Math.round(tw / 0.18); for (let i = 0; i < ribs; i++) { const x = i * tw / ribs; L.rect(x, 0, tw / ribs * 0.5, th, 'rgba(255,255,255,0.14)', dat(190, 140, 100)); L.rect(x + tw / ribs * 0.5, 0, tw / ribs * 0.5, th, 'rgba(0,0,0,0.18)', dat(90, 160, 100)); }
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw; const yf = th - 2 * fh;
    // clerestory strip window band
    L.rect(x0 + 0.15, yf + 0.5, bw - 0.3, 0.8, '#1e2a30', dat(60, 60, 150)); pane(L, rng, x0 + 0.2, yf + 0.55, bw - 0.4, 0.7, { lit: rng.chance(0.4) ? '#e8f4ff' : null, glare: 0.7 }); for (let i = 1; i < 4; i++) L.rect(x0 + 0.2 + i * (bw - 0.4) / 4 - 0.02, yf + 0.55, 0.04, 0.7, '#333');
    if (rng.chance(0.4)) { L.rect(x0 + 0.3, th - 3.4, bw - 0.6, 3.3, rng.pick(['#7a3a2a', '#2a4a6a', '#5a6a3a', '#8a8a8a']), dat(150, 140, 120)); for (let i = 0; i < 12; i++) L.rect(x0 + 0.3, th - 3.4 + i * 0.275, bw - 0.6, 0.03, 'rgba(0,0,0,0.3)'); L.rect(x0 + 0.3, th - 0.3, bw - 0.6, 0.3, '#e8c020'); for (let i = 0; i < 10; i++) L.poly([[x0 + 0.3 + i * (bw - 0.6) / 10, th - 0.3], [x0 + 0.3 + (i + 0.5) * (bw - 0.6) / 10, th - 0.3], [x0 + 0.3 + (i + 0.2) * (bw - 0.6) / 10, th], [x0 + 0.3 + (i - 0.3) * (bw - 0.6) / 10, th]], '#222'); }
  }
  for (let i = 0; i < 40; i++) L.streak(rng.range(0, tw), rng.range(0, th * 0.7), rng.range(0.1, 0.4), rng.range(1, 4), rng.range(0.1, 0.3), rng.pick(['#7a3a1a', '#3a2a1a', '#222']));
  for (let i = 0; i < 16; i++) L.blob(rng.range(0, tw), rng.range(0, th), rng.range(0.3, 1), '#8a4a20', rng.range(0.1, 0.25), rng.range(0.8, 2));
  finishWall(L, { s1: 81, lo1: 0.76 });
}

function paintSiding(L, rng, spec) {
  const { bw, fh, bays, floors } = spec; const tw = L.tw, th = L.th;
  L.rect(0, 0, tw, th, '#e4e2dc', dat(140, 200, 0));
  for (let y = 0; y < th; y += 0.16) { L.rect(0, y, tw, 0.02, 'rgba(0,0,0,0.25)', dat(85, 210, 0)); L.rect(0, y + 0.02, tw, 0.03, 'rgba(255,255,255,0.18)'); }
  for (let f = 0; f < floors; f++) {
    const yf = th - (f + 1) * fh;
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw, cx = x0 + bw / 2, ww = 1.0, wh = 1.35, wx = cx - ww / 2, wy = yf + 0.7; const lit = rng.chance(0.3) ? rng.pick(WARM) : null; const shutC = rng.pick(['#2f4a6a', '#3a5a3a', '#6a2a2a', '#2a2a2a']);
      L.rect(wx - 0.1, wy - 0.1, ww + 0.2, wh + 0.2, '#f4f2ee', dat(170, 200, 0)); pane(L, rng, wx, wy, ww, wh, { lit, curtain: 0.7, blinds: 0.2 });
      L.rect(wx + ww / 2 - 0.02, wy, 0.04, wh, '#f4f2ee'); L.rect(wx, wy + wh / 2 - 0.02, ww, 0.04, '#f4f2ee');
      L.rect(wx - 0.38, wy - 0.05, 0.28, wh + 0.1, shutC, dat(160, 180, 0)); L.rect(wx + ww + 0.1, wy - 0.05, 0.28, wh + 0.1, shutC, dat(160, 180, 0));
      for (let i = 1; i < 10; i++) { L.rect(wx - 0.38, wy - 0.05 + i * (wh + 0.1) / 10, 0.28, 0.015, 'rgba(0,0,0,0.3)'); L.rect(wx + ww + 0.1, wy - 0.05 + i * (wh + 0.1) / 10, 0.28, 0.015, 'rgba(0,0,0,0.3)'); }
      sill(L, wx, wy + wh + 0.1, ww, '#f4f2ee', 0.07, 0.06);
    }
  }
  finishWall(L, { s1: 91, lo1: 0.86 });
}

const PAINTERS = {
  tropic: paintTropic, shop_ph: (L, r, s) => paintShop(L, r, s, 'ph'), shop_us: (L, r, s) => paintShop(L, r, s, 'us'), shop_eu: (L, r, s) => paintShop(L, r, s, 'eu'), shop_in: (L, r, s) => paintShop(L, r, s, 'in'),
  tenement: paintTenement, altbau: paintAltbau, plattenbau: paintPlatten, stalin: paintStalin, deco: paintDeco, glass: paintGlass, office: paintOffice, delhi: paintDelhi, industrial: paintIndustrial, siding: paintSiding,
};

/** returns {map, emi, data, spec, W, H} (cached textures, shared) */
export function getFacade(key) {
  return cached(`city.facade.${key}.${Q.texSize}`, () => {
    const spec = FACADE[key]; const tw = spec.bays * spec.bw, th = spec.floors * spec.fh;
    const W = texRes(1024); const ppm = W / tw; const L = new Layers(tw, th, ppm); L.rng = new RNG(spec.seed * 7919);
    PAINTERS[key](L, new RNG(spec.seed * 104729), spec);
    const t = L.textures(); t.spec = spec; t.userData = { shared: true }; return t;
  });
}
