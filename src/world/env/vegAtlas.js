// One shared RGBA atlas for ALL vegetation (fronds, leaf sprays, bark, needles, grass/white, flowers).
// Colour canvas + mask canvas are painted separately and combined, so RGB under transparent pixels keeps leaf colour (no dark halos).
import * as THREE from 'three';
import { RNG, Q } from '../../engine/common.js';
import { makeCanvas } from '../../engine/proc.js';
import { cached } from '../../engine/proc.js';

// regions in cell units (atlas = 4 columns x 5 rows of square cells)
export const REG = {
  frondCoconut: [0, 0, 2, 1], frondRoyal: [2, 0, 2, 1], banana: [0, 1, 2, 1], barkPalm: [2, 1, 1, 1], barkTree: [3, 1, 1, 1],
  leafBroad: [0, 2, 1, 1], leafSmall: [1, 2, 1, 1], pine: [2, 2, 2, 1], white: [0, 3, 1, 1], leafBush: [1, 3, 1, 1], flowers: [2, 3, 1, 1], barkBirch: [3, 3, 1, 1], leafAutumn: [1, 4, 1, 1],
};
/** UV of a point inside a region: a along width (0..1), b along height (0 = top of the painted canvas region). */
export function regUV(name, a, b, out = [0, 0]) {
  const r = REG[name]; const pad = 0.0035; // small inset avoids bleeding between cells
  out[0] = (r[0] + pad * 2 + a * (r[2] - pad * 4)) / 4; out[1] = (r[1] + pad * 2 + b * (r[3] - pad * 4)) / 5; return out;
}

const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
const mix = (a, b, t) => a + (b - a) * t;

function leafShape(ctx, x, y, len, wid, ang, tip = 0.5) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * 0.25, -wid * 0.9, len * 0.7, -wid * 0.7, len, 0); ctx.bezierCurveTo(len * 0.7, wid * 0.7, len * 0.25, wid * 0.9, 0, 0); ctx.closePath(); ctx.restore();
}

export function vegAtlas() {
  return cached('veg:atlas', () => {
    const S = Q.level === 0 ? 512 : Q.level === 1 ? 768 : 1024; const C = S / 4; const SH = S * 1.25;
    const col = makeCanvas(S, SH), msk = makeCanvas(S, SH); const cc = col.getContext('2d'), mc = msk.getContext('2d');
    cc.fillStyle = '#4a7a2a'; cc.fillRect(0, 0, S, SH); mc.fillStyle = '#000'; mc.fillRect(0, 0, S, SH);
    const R = (n) => { const r = REG[n]; return [r[0] * C, r[1] * C, r[2] * C, r[3] * C]; };
    const hq = Q.level === 2 ? 1 : Q.level === 1 ? 0.75 : 0.5;
    const clip = (ctx, x, y, w, h) => { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); };

    // ---------- pinnate palm fronds ----------
    function frond(name, seed, { n = 46, lenMax = 0.46, angle = 62, base = [58, 104, 34], tipc = [128, 166, 62], wid = 2.6, pale = [186, 182, 108], curl = 0.25 }) {
      wid *= 2.1;
      const [x, y, w, h] = R(name); const r = new RNG(seed); const cy = y + h / 2; const k = C / 256; n = Math.round(n * 1.3 * (0.6 + 0.4 * hq) + 6);
      clip(cc, x, y, w, h); clip(mc, x, y, w, h);
      cc.fillStyle = rgb(...base); cc.fillRect(x, y, w, h);
      // rachis
      for (const ctx of [cc, mc]) { ctx.strokeStyle = ctx === cc ? rgb(...pale) : '#fff'; ctx.lineWidth = 3.4 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 3 * k, cy); ctx.lineTo(x + w - 6 * k, cy); ctx.stroke(); }
      for (let side = -1; side <= 1; side += 2) for (let i = 0; i < n; i++) {
        const t = (i + 0.5 + r.range(-0.2, 0.2)) / n; const px = x + 8 * k + t * (w - 16 * k);
        const L = h * lenMax * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.65) * (1 - 0.28 * t) * r.range(0.9, 1.06);
        if (L < 3 * k) continue;
        const a = (angle - 22 * t + r.range(-5, 5)) * Math.PI / 180;
        const tx = px + Math.cos(a) * L, ty = cy + side * Math.sin(a) * L;
        const cx = px + Math.cos(a) * L * 0.35, cyy = cy + side * Math.sin(a) * L * 0.62 * (1 - curl * 0.5);
        const lw = wid * k * (1 - 0.3 * t) * r.range(0.85, 1.15);
        const shade = r.range(0.82, 1.12), tt = Math.min(1, t * 0.9 + r.range(-0.1, 0.1));
        const c0 = [mix(base[0], tipc[0], tt) * shade, mix(base[1], tipc[1], tt) * shade, mix(base[2], tipc[2], tt) * shade];
        for (const ctx of [cc, mc]) {
          ctx.fillStyle = ctx === cc ? rgb(...c0) : '#fff';
          ctx.beginPath(); ctx.moveTo(px - lw * 0.4, cy); ctx.quadraticCurveTo(cx - lw * 1.1, cyy - side * lw * 0.15, tx, ty); ctx.quadraticCurveTo(cx + lw * 0.9, cyy + side * lw * 0.15, px + lw * 0.9, cy); ctx.closePath(); ctx.fill();
        }
        // light centre vein
        cc.strokeStyle = rgb(c0[0] * 1.25, c0[1] * 1.25, c0[2] * 1.15); cc.lineWidth = 0.7 * k; cc.beginPath(); cc.moveTo(px, cy); cc.quadraticCurveTo(cx, cyy, tx, ty); cc.stroke();
      }
      cc.restore(); mc.restore();
    }
    frond('frondCoconut', 11, { n: 54, lenMax: 0.47, angle: 66, wid: 2.4 });
    frond('frondRoyal', 23, { n: 40, lenMax: 0.36, angle: 52, base: [48, 98, 36], tipc: [104, 150, 54], wid: 3.2, pale: [170, 176, 104] });

    // ---------- banana leaf ----------
    {
      const [x, y, w, h] = R('banana'); const r = new RNG(5); const cy = y + h / 2; const k = C / 256;
      clip(cc, x, y, w, h); clip(mc, x, y, w, h);
      const hw = (t) => (h / 2 - 5 * k) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.75) * (t > 0.92 ? Math.max(0, (1 - t) / 0.08) : 1);
      const path = (ctx, f = 1) => { ctx.beginPath(); const m = 40; for (let i = 0; i <= m; i++) { const t = i / m; ctx.lineTo(x + 5 * k + t * (w - 14 * k), cy - hw(t) * f); } for (let i = m; i >= 0; i--) { const t = i / m; ctx.lineTo(x + 5 * k + t * (w - 14 * k), cy + hw(t) * f); } ctx.closePath(); };
      path(mc); mc.fillStyle = '#fff'; mc.fill();
      path(cc); const g = cc.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, rgb(70, 118, 36)); g.addColorStop(0.5, rgb(86, 142, 44)); g.addColorStop(1, rgb(100, 150, 48)); cc.fillStyle = g; cc.fill();
      // side veins
      cc.strokeStyle = 'rgba(40,86,22,0.35)'; cc.lineWidth = 0.9 * k;
      for (let i = 0; i < 70; i++) { const t = i / 70; const px = x + 5 * k + t * (w - 14 * k); for (const s of [-1, 1]) { cc.beginPath(); cc.moveTo(px, cy); cc.lineTo(px + 14 * k, cy + s * hw(Math.min(1, t + 0.06)) * 0.97); cc.stroke(); } }
      // midrib
      cc.strokeStyle = rgb(170, 190, 100); cc.lineWidth = 3.6 * k; cc.beginPath(); cc.moveTo(x + 2 * k, cy); cc.lineTo(x + w - 12 * k, cy); cc.stroke();
      cc.strokeStyle = rgb(120, 160, 70); cc.lineWidth = 1.2 * k; cc.stroke();
      // tears (wind-ripped slits)
      mc.fillStyle = '#000';
      for (let i = 0; i < 22 * hq + 6; i++) { const t = r.range(0.12, 0.92); const s = r.sign(); const px = x + 5 * k + t * (w - 14 * k); const yy = cy + s * hw(t); mc.beginPath(); mc.moveTo(px - 1.2 * k, yy + s * 3 * k); mc.lineTo(px + 1.2 * k + 8 * k, yy + s * 3 * k); mc.lineTo(px + 6 * k, cy + s * hw(t) * r.range(0.3, 0.55)); mc.closePath(); mc.fill(); }
      // brown dried edge patches
      for (let i = 0; i < 18; i++) { const t = r.range(0.1, 0.95); const s = r.sign(); const px = x + 5 * k + t * (w - 14 * k); cc.fillStyle = `rgba(110,90,34,${r.range(0.15, 0.4)})`; cc.beginPath(); cc.ellipse(px, cy + s * hw(t) * 0.93, r.range(4, 10) * k, r.range(1.5, 3) * k, 0, 0, 7); cc.fill(); }
      cc.restore(); mc.restore();
    }

    // ---------- palm bark: rings ----------
    {
      const [x, y, w, h] = R('barkPalm'); const r = new RNG(9); const k = C / 256; clip(cc, x, y, w, h);
      const g = cc.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgb(120, 130, 76)); g.addColorStop(0.1, rgb(150, 138, 100)); g.addColorStop(0.7, rgb(138, 122, 98)); g.addColorStop(1, rgb(78, 66, 52)); cc.fillStyle = g; cc.fillRect(x, y, w, h);
      const rings = 44; for (let i = 0; i < rings; i++) { const yy = y + (i + 0.5) / rings * h + r.range(-0.8, 0.8) * k; cc.fillStyle = `rgba(52,42,30,${r.range(0.35, 0.65)})`; cc.fillRect(x, yy, w, 1.6 * k); cc.fillStyle = `rgba(200,190,160,${r.range(0.08, 0.2)})`; cc.fillRect(x, yy + 2.2 * k, w, 2.2 * k); }
      cc.lineWidth = 0.8 * k; for (let i = 0; i < 260 * hq; i++) { const xx = x + r.range(0, w); const yy = y + r.range(0, h); const l = r.range(4, 22) * k; cc.strokeStyle = `rgba(${r.chance(0.5) ? '40,34,26' : '190,180,150'},${r.range(0.08, 0.25)})`; for (const dx of [0, -w, w]) { cc.beginPath(); cc.moveTo(xx + dx, yy); cc.lineTo(xx + dx + r.range(-1.5, 1.5) * k, yy + l); cc.stroke(); } }
      mc.fillStyle = '#fff'; mc.fillRect(x, y, w, h); cc.restore();
    }
    // ---------- tree bark: furrows ----------
    function furrows(name, seed, base, dark, light) {
      const [x, y, w, h] = R(name); const r = new RNG(seed); const k = C / 256; clip(cc, x, y, w, h);
      cc.fillStyle = rgb(...base); cc.fillRect(x, y, w, h);
      for (let i = 0; i < 70 * hq + 20; i++) { const xx = x + r.range(0, w); let yy = y + r.range(-20, h); const len = r.range(30, 120) * k; let cx = xx; cc.strokeStyle = `rgba(${dark[0]},${dark[1]},${dark[2]},${r.range(0.25, 0.7)})`; cc.lineWidth = r.range(1, 3.2) * k;
        for (const dx of [0, -w, w]) { cc.beginPath(); cc.moveTo(xx + dx, yy); let px = xx + dx; for (let s = 1; s <= 6; s++) { px += r.range(-2.5, 2.5) * k; cc.lineTo(px, yy + len * s / 6); } cc.stroke(); } }
      for (let i = 0; i < 110 * hq + 20; i++) { const xx = x + r.range(0, w), yy = y + r.range(-20, h); const len = r.range(20, 80) * k; cc.strokeStyle = `rgba(${light[0]},${light[1]},${light[2]},${r.range(0.1, 0.3)})`; cc.lineWidth = r.range(1.5, 3.5) * k; for (const dx of [0, -w, w]) { cc.beginPath(); cc.moveTo(xx + dx, yy); cc.lineTo(xx + dx + r.range(-3, 3) * k, yy + len); cc.stroke(); } }
      mc.fillStyle = '#fff'; mc.fillRect(x, y, w, h); cc.restore();
    }
    furrows('barkTree', 31, [128, 106, 82], [52, 42, 32], [186, 164, 134]);
    // birch bark: pale with dark lenticels
    {
      const [x, y, w, h] = R('barkBirch'); const r = new RNG(41); const k = C / 256; clip(cc, x, y, w, h);
      cc.fillStyle = rgb(226, 222, 212); cc.fillRect(x, y, w, h);
      for (let i = 0; i < 90 * hq + 20; i++) { const xx = x + r.range(0, w), yy = y + r.range(0, h); const l = r.range(6, 26) * k; cc.fillStyle = `rgba(30,26,22,${r.range(0.4, 0.85)})`; for (const dx of [0, -w, w]) cc.fillRect(xx + dx, yy, l, r.range(1.2, 3.4) * k); }
      for (let i = 0; i < 200 * hq; i++) { cc.fillStyle = `rgba(140,130,110,${r.range(0.05, 0.14)})`; cc.fillRect(x + r.range(0, w), y + r.range(0, h), r.range(1, 6) * k, r.range(1, 6) * k); }
      mc.fillStyle = '#fff'; mc.fillRect(x, y, w, h); cc.restore();
    }

    // ---------- leaf sprays ----------
    function spray(name, seed, { leaves, size, wid, colA, colB, vein = true, spread = 1, twig = [86, 66, 40], rows = 1 }) {
      const [x, y, w, h] = R(name); const r = new RNG(seed); const k = C / 256; clip(cc, x, y, w, h);
      cc.fillStyle = rgb(...colA); cc.fillRect(x, y, w, h); clip(mc, x, y, w, h);
      const ox = x + w / 2, oy = y + h / 2; const ox0 = ox, oy0 = oy; leaves = Math.round(leaves * (0.7 + 0.3 * hq));
      // twigs radiating
      const items = [];
      for (let i = 0; i < leaves; i++) {
        const ang = r.range(0, Math.PI * 2); const dd = Math.sqrt(r.next()) * (Math.min(w, h) * 0.5 - size * C * 0.8);
        const lx = ox0 + Math.cos(ang) * dd * 1.0, ly = oy0 + Math.sin(ang) * dd; items.push({ lx, ly, a: ang + r.range(-0.9, 0.9) + (r.chance(0.3) ? Math.PI : 0), len: size * C * r.range(0.75, 1.15), z: r.next() });
      }
      items.sort((p, q) => q.z - p.z); // far (lower) first: later leaves paint on top
      cc.strokeStyle = rgb(...twig); cc.lineWidth = 1.5 * k;
      for (const it of items.filter((_, i) => i % 3 === 0)) { cc.beginPath(); cc.moveTo(ox, oy); cc.lineTo(it.lx, it.ly); cc.stroke(); mc.strokeStyle = '#fff'; mc.lineWidth = 1.5 * k; mc.beginPath(); mc.moveTo(ox, oy); mc.lineTo(it.lx, it.ly); mc.stroke(); }
      for (const it of items) {
        const sh = r.range(0.78, 1.18); const tt = r.next(); const c = [mix(colA[0], colB[0], tt) * sh, mix(colA[1], colB[1], tt) * sh, mix(colA[2], colB[2], tt) * sh];
        leafShape(cc, it.lx, it.ly, it.len, it.len * wid, it.a); cc.fillStyle = rgb(...c); cc.fill(); cc.strokeStyle = `rgba(20,40,10,0.35)`; cc.lineWidth = 0.8 * k; cc.stroke();
        leafShape(mc, it.lx, it.ly, it.len, it.len * wid, it.a); mc.fillStyle = '#fff'; mc.fill();
        if (vein) { cc.strokeStyle = rgb(c[0] * 1.35, c[1] * 1.3, c[2] * 1.15); cc.lineWidth = 0.9 * k; cc.beginPath(); cc.moveTo(it.lx, it.ly); cc.lineTo(it.lx + Math.cos(it.a) * it.len * 0.92, it.ly + Math.sin(it.a) * it.len * 0.92); cc.stroke(); }
      }
      cc.restore(); mc.restore();
    }
    spray('leafBroad', 51, { leaves: 36, size: 0.3, wid: 0.22, colA: [36, 74, 24], colB: [92, 138, 44], spread: 1.0 });
    spray('leafSmall', 61, { leaves: 300, size: 0.1, wid: 0.36, colA: [58, 104, 30], colB: [130, 172, 58], vein: false, spread: 1.1 });
    spray('leafAutumn', 66, { leaves: 300, size: 0.1, wid: 0.36, colA: [168, 58, 22], colB: [238, 178, 44], vein: false, spread: 1.1 });
    spray('leafBush', 71, { leaves: 46, size: 0.19, wid: 0.32, colA: [40, 82, 28], colB: [108, 150, 48], spread: 1.0 });

    // ---------- pine / spruce branch ----------
    {
      const [x, y, w, h] = R('pine'); const r = new RNG(81); const cy = y + h / 2; const k = C / 256; clip(cc, x, y, w, h); clip(mc, x, y, w, h);
      cc.fillStyle = rgb(44, 90, 56); cc.fillRect(x, y, w, h);
      cc.strokeStyle = rgb(96, 70, 46); cc.lineWidth = 2.6 * k; cc.lineCap = 'round'; cc.beginPath(); cc.moveTo(x + 2 * k, cy); cc.lineTo(x + w - 8 * k, cy); cc.stroke();
      mc.strokeStyle = '#fff'; mc.lineWidth = 2.6 * k; mc.lineCap = 'round'; mc.beginPath(); mc.moveTo(x + 2 * k, cy); mc.lineTo(x + w - 8 * k, cy); mc.stroke();
      const nb = Math.round(95 * hq + 20);
      for (let side = -1; side <= 1; side += 2) for (let i = 0; i < nb; i++) {
        const t = (i + r.next() * 0.6) / nb; const px = x + 6 * k + t * (w - 18 * k); const L = h * 0.46 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.7) * (1 - 0.2 * t) * r.range(0.85, 1.05);
        const a = (58 - 16 * t + r.range(-6, 6)) * Math.PI / 180; const ex = px + Math.cos(a) * L, ey = cy + side * Math.sin(a) * L;
        cc.strokeStyle = rgb(70, 50, 32); cc.lineWidth = 1.1 * k; cc.beginPath(); cc.moveTo(px, cy); cc.lineTo(ex, ey); cc.stroke();
        const nn = Math.max(6, Math.round(L / (1.5 * k)));
        for (let j = 0; j < nn; j++) { const u = (j + 0.5) / nn; const bx = px + (ex - px) * u, by = cy + (ey - cy) * u; const nl = (9 + 7 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1))) * k * (1 - 0.2 * t);
          for (const sg of [-1, 1]) {
            const dirx = Math.cos(a) * 0.6 + (-Math.sin(a) * side) * sg * 0.7, diry = side * Math.sin(a) * 0.6 + (Math.cos(a)) * sg * 0.7 * 1.0;
            const m = Math.hypot(dirx, diry); const shade = r.range(0.75, 1.25); const c0 = [44 * shade + 16 * t, 98 * shade + 20 * t, 60 * shade + 12 * t];
            cc.strokeStyle = rgb(...c0); cc.lineWidth = 1.5 * k; cc.beginPath(); cc.moveTo(bx, by); cc.lineTo(bx + dirx / m * nl, by + diry / m * nl); cc.stroke();
            mc.strokeStyle = '#fff'; mc.lineWidth = 2.6 * k; mc.beginPath(); mc.moveTo(bx, by); mc.lineTo(bx + dirx / m * nl, by + diry / m * nl); mc.stroke(); } }
      }
      cc.restore(); mc.restore();
    }

    // ---------- flowers (hibiscus-ish) ----------
    {
      const [x, y, w, h] = R('flowers'); const r = new RNG(91); const k = C / 256; clip(cc, x, y, w, h); clip(mc, x, y, w, h);
      cc.fillStyle = rgb(190, 30, 40); cc.fillRect(x, y, w, h);
      const cols = [[214, 30, 44], [236, 70, 120], [250, 160, 40], [240, 240, 230]];
      for (let i = 0; i < 9; i++) {
        const fx = x + r.range(0.18, 0.82) * w, fy = y + r.range(0.18, 0.82) * h, rad = r.range(0.1, 0.17) * C; const cl = cols[i % 4 === 3 ? 1 : i % 3 === 2 ? 0 : 0]; const rot = r.range(0, 6.28);
        for (let p = 0; p < 5; p++) { const a = rot + p * Math.PI * 2 / 5; const px = fx + Math.cos(a) * rad * 0.55, py = fy + Math.sin(a) * rad * 0.55;
          for (const ctx of [cc, mc]) { ctx.fillStyle = ctx === cc ? `rgb(${cl[0] * r.range(0.85, 1.05)},${cl[1] * r.range(0.8, 1.1)},${cl[2] * r.range(0.8, 1.1)})` : '#fff'; ctx.beginPath(); ctx.ellipse(px, py, rad * 0.62, rad * 0.5, a, 0, 7); ctx.fill(); } }
        cc.fillStyle = rgb(250, 210, 60); cc.beginPath(); cc.arc(fx, fy, rad * 0.16, 0, 7); cc.fill();
        cc.fillStyle = rgb(120, 10, 25); cc.beginPath(); cc.arc(fx, fy, rad * 0.32, 0, 7); cc.globalAlpha = 0.45; cc.fill(); cc.globalAlpha = 1;
      }
      cc.restore(); mc.restore();
    }
    // white block (vertex-coloured geometry: grass blades, coconuts, ...)
    { const [x, y, w, h] = R('white'); cc.fillStyle = '#fff'; cc.fillRect(x, y, w, h); mc.fillStyle = '#fff'; mc.fillRect(x, y, w, h); }

    // ---------- combine ----------
    const cd = cc.getImageData(0, 0, S, SH).data, md = mc.getImageData(0, 0, S, SH).data; const out = new Uint8Array(S * SH * 4);
    for (let i = 0; i < S * SH; i++) { out[i * 4] = cd[i * 4]; out[i * 4 + 1] = cd[i * 4 + 1]; out[i * 4 + 2] = cd[i * 4 + 2]; out[i * 4 + 3] = md[i * 4]; }
    const t = new THREE.DataTexture(out, S, SH, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; t.flipY = false;
    return t;
  });
}
