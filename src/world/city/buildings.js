// Building emitter: tiers of facade walls (bay/floor snapped UVs), roofs, parapets, balconies, shopfronts, signs, roof props,
// plus a deterministic damage system (broken windows, soot, fires, collapsed corners, leaning, floors, rebar, rubble).
import * as THREE from 'three';
import { RNG, smoothstep, clamp } from '../../engine/common.js';
import { FACADE } from './facades.js';
import { rgb, mul, mix, jitter } from './builder.js';
import { getDecals, signRect } from './surfaces.js';
import * as P from './props.js';

const PI = Math.PI;
const SIDES = [
  { name: 'front', n: [0, 1] }, { name: 'right', n: [1, 0] }, { name: 'back', n: [0, -1] }, { name: 'left', n: [-1, 0] },
];
const sideAB = (name, x0, x1, z0, z1) => ({ front: [[x0, z1], [x1, z1]], right: [[x1, z1], [x1, z0]], back: [[x1, z0], [x0, z0]], left: [[x0, z0], [x0, z1]] }[name]);

const soot = [0.012, 0.011, 0.01];

/** per-building damage parameters from a 0..1 level */
export function damageParams(s, dmg, rng, boost = 1) {
  const hTot = s.tiers.reduce((a, t) => a + t.floors * (t.fh || 3), 0) + (s.shop ? s.shop.fh : 0);
  const f = smoothstep(0.32, 0.92, dmg);
  const hs = 1 - smoothstep(0.86, 1.0, dmg) * 0.86;
  const leanOK = dmg > 0.35 && dmg < 0.9 && rng.chance(0.55) && hTot > 8;
  return {
    dmg, hTot, scorch: smoothstep(0.06, 0.55, dmg), broken: smoothstep(0.03, 0.45, dmg) * 0.78 + (dmg > 0.9 ? 0.2 : 0),
    fire: Math.min(0.9, smoothstep(0.18, 0.65, dmg) * (dmg > 0.93 ? 0.12 : 0.34) * boost), f, hs,
    corner: rng.int(0, 3), corner2: rng.int(0, 3), lean: leanOK ? rng.range(0.025, 0.075) * rng.sign() : 0, leanAxis: rng.chance(0.5), roofGone: f > 0.45,
    seed: rng.int(1, 1e6),
  };
}
/** max standing height at local position (lx,lz) for a footprint w x d (damage collapse field) */
function cutHeight(dp, s, lx, lz, rngSeed) {
  let H = dp.hTot * dp.hs; if (dp.f <= 0.001) return H;
  const w = s.w, d = s.d; const diag = Math.hypot(w, d);
  const corners = [[w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]];
  const apply = (ci, scale) => { const c = corners[ci]; const dist = Math.hypot(lx - c[0], lz - c[1]); const Rc = dp.f * diag * 0.78 * scale; if (dist < Rc) { const k = Math.pow(dist / Rc, 1.25); const jag = ((Math.sin(lx * 1.7 + rngSeed) + Math.sin(lz * 2.3 + rngSeed * 0.37) + Math.sin((lx + lz) * 0.9 + rngSeed * 0.11)) * 0.33 + 0.5) * 3.0 * dp.f; H = Math.min(H, Math.max(0, dp.hTot * k * 0.98 + jag - 0.8)); } };
  apply(dp.corner, 1); if (dp.f > 0.55) apply((dp.corner + 2) % 4, 0.55 + (dp.corner2 % 2) * 0.1);
  if (dp.dmg > 0.7) { const j = (Math.sin(lx * 0.9 + rngSeed * 0.3) * Math.cos(lz * 0.8 + rngSeed) * 0.5 + 0.5); H = Math.min(H, dp.hTot * (0.2 + 0.8 * (1 - dp.f)) + j * 6 * dp.f); }
  return H;
}

/** rubble heap: chunks of concrete/brick/paint with some rebar. */
export function rubblePile(B, cx, cz, rx, rz, count, rng, tint = 0xc8c0b0, o = {}) {
  const pals = [0x8a8780, 0x9c9890, 0x76736e, 0xaaa69c, 0x6a6762, 0x8d4a38, 0x7a3a2c];
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, PI * 2), r = Math.sqrt(rng.next()) ; const x = cx + Math.cos(a) * r * rx, z = cz + Math.sin(a) * r * rz; const hill = (1 - r * r); const big = rng.chance(0.18);
    const sz = (big ? rng.range(0.7, 1.7) : rng.range(0.18, 0.6)) * (o.scale ?? 1); const y = hill * (o.height ?? 1.8) * rng.range(0.55, 1.0) + sz * 0.15;
    const col = rng.chance(0.2) ? jitter(tint, rng, 0.1) : jitter(rng.pick(pals), rng, 0.08);
    B.push(x, y, z, rng.range(0, PI * 2), 1, 1, 1, rng.range(-0.5, 0.5), rng.range(-0.5, 0.5));
    if (rng.chance(0.35)) B.box('rubble', 0, 0, 0, sz * rng.range(0.8, 1.6), sz * rng.range(0.25, 0.7), sz * rng.range(0.7, 1.4), { col, mpt: 1.2 });
    else blob(B, 'rubble', sz, rng, col);
    B.pop();
    if (rng.chance(0.07)) { B.push(x, y + 0.2, z, rng.range(0, PI * 2), 1, 1, 1, rng.range(-0.9, 0.9), rng.range(-0.9, 0.9)); B.cyl('metal', 0, 0, 0, 0.018, 0.018, rng.range(0.8, 2.2), 4, { col: 0x5a3422, cap: false }); B.pop(); }
  }
}
const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2; const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((c) => c / l); }); const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]; return { v, f }; })();
function blob(B, name, r, rng, col) {
  const v = ICO.v.map((p) => { const k = r * rng.range(0.55, 1.1); return [p[0] * k, p[1] * k * 0.7, p[2] * k]; });
  for (const f of ICO.f) B.tri(name, v[f[0]], v[f[1]], v[f[2]], mul(col, rng.range(0.85, 1.1)), [0, 0, 1, 0, 0.5, 1]);
}
export { blob };

const BODY_FLOOR_FH = 3.0;

/** emit one building. s: spec (see blocks.js). dmg: 0..1. ctx: {S, snow, fires:[], night} */
export function emitBuilding(B, s, dmg, ctx) {
  const rng = new RNG(s.seed * 2654435761 >>> 0);
  const drng = new RNG((s.seed * 40503 + 17) >>> 0);
  const dp = dmg > 0.015 ? damageParams(s, dmg, drng, ctx.fireBoost || 1) : null;
  const tint = rgb(s.tint || 0xdddddd);
  B.push(s.x, s.y ?? 0, s.z, s.yaw || 0);
  if (dp && dp.lean) { const m = new THREE.Matrix4(); const k = Math.tan(dp.lean); if (dp.leanAxis) m.set(1, k, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1); else m.set(1, 0, 0, 0, 0, 1, 0, 0, 0, k, 1, 0, 0, 0, 0, 1); B.pushM(m); }
  const info = { top: 0, dp };
  let y = 0, floorBase = 0; const decals = getDecals();
  const nTiers = s.tiers.length;
  for (let ti = 0; ti < nTiers; ti++) {
    const t = s.tiers[ti]; const x0 = (t.ox || 0) - t.w / 2, x1 = (t.ox || 0) + t.w / 2, z0 = (t.oz || 0) - t.d / 2, z1 = (t.oz || 0) + t.d / 2;
    const F = FACADE[t.facade]; const fh = t.fh || F.fh; const tierFloors = t.floors; const shopH = ti === 0 && s.shop ? s.shop.fh : 0;
    const yTop = y + shopH + tierFloors * fh; const tTint = t.tint ? rgb(t.tint) : tint;
    let anyCut = false;
    for (const sd of SIDES) {
      const [a, b] = sideAB(sd.name, x0, x1, z0, z1); const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.5) continue;
      const nBays = Math.max(1, Math.round(len / F.bw)); const n = sd.n;
      // per column standing heights
      const tops = new Array(nBays); let cutHere = false;
      for (let i = 0; i < nBays; i++) { const tt = (i + 0.5) / nBays; const lx = a[0] + (b[0] - a[0]) * tt, lz = a[1] + (b[1] - a[1]) * tt; let top = yTop; if (dp) { top = Math.min(yTop, cutHeight(dp, s, lx, lz, dp.seed)); if (top < yTop - 0.01) cutHere = true; } tops[i] = top; }
      if (cutHere) anyCut = true;
      const shopSide = shopH > 0 && (sd.name === 'front' || (s.shop.sides && s.shop.sides.includes(sd.name)));
      const uOff = rng.int(0, F.bays - 1);
      // ground floor (shop) then upper floors
      let yBase = y;
      if (shopH > 0) {
        const SF = FACADE[s.shop.facade]; const shopFac = shopSide ? s.shop.facade : t.facade;
        const sfh = shopSide ? shopH : shopH; const fk = shopFac;
        emitWall(B, { fk, F: FACADE[fk], a, b, n, y0: y, y1: y + shopH, fh: shopSide ? shopH : (F.fh), nBays, uOff, vOff: shopSide ? 0 : 0, tint: shopSide ? mul(tTint, 0.98) : tTint, tops: tops.map((q) => Math.min(q, y + shopH)), ground: true, dp, dmgCtx: { decals, rng: drng, ctx, shop: true } });
        if (shopSide) { if (!dp || dp.dmg < 0.5) shopDetails(B, s, sd, a, b, n, nBays, y, shopH, rng, ctx, tTint); }
        yBase = y + shopH;
      }
      const wallTops = tops;
      if (yTop - yBase > 0.05) emitWall(B, { fk: t.facade, F, a, b, n, y0: yBase, y1: yTop, fh, nBays, uOff, vOff: rng.int(0, F.floors - 1), tint: tTint, tops: wallTops, ground: shopH === 0 && ti === 0, dp, dmgCtx: { decals, rng: drng, ctx, shop: false } });
      // balconies / ac / fire escape on front & sides with probability
      if (!dp || dp.dmg < 0.6) wallDetails(B, s, t, sd, a, b, n, nBays, yBase, fh, tierFloors, F, rng, ctx, tTint, ti === 0);
    }
    // roof / parapet / slabs
    if (dp && anyCut) {
      cutInterior(B, s, t, dp, x0, x1, z0, z1, y + shopH, fh, tierFloors, tTint, drng, ctx);
    } else if (ti === nTiers - 1 || true) {
      if (ti === nTiers - 1) emitRoof(B, s, t, x0, x1, z0, z1, yTop, rng, ctx, tTint, dp);
      else { // setback ledge roof of lower tier
        B.quad('r_flat', [x0, yTop, z1], [x1, yTop, z1], [x1, yTop, z0], [x0, yTop, z0], [x0 / 6, z1 / 6, x1 / 6, z0 / 6], ctx.snow ? 0xf0f4f8 : 0xe0e0de, [0, 1, 0]);
        parapet(B, x0, x1, z0, z1, yTop, 0.7, 0.2, mul(tTint, 0.96));
      }
    }
    y = yTop; floorBase += tierFloors + (shopH ? 1 : 0); info.top = Math.max(info.top, yTop);
    if (s.cornice && ti === nTiers - 1 && !(dp && anyCut)) { const cc = s.cornice; B.box('concrete', (x0 + x1) / 2, yTop - 0.15, (z0 + z1) / 2, t.w + 0.7, 0.35, t.d + 0.7, { col: cc }); }
  }
  // damage extras: rubble & rebar & dumped debris around the base
  if (dp && dp.dmg > 0.3) {
    const R = new RNG(dp.seed + 99); const cnt = Math.round(smoothstep(0.3, 1.0, dp.dmg) * (30 + s.w * s.d * 0.18));
    const cc = [[s.w / 2, s.d / 2], [-s.w / 2, s.d / 2], [-s.w / 2, -s.d / 2], [s.w / 2, -s.d / 2]][dp.corner];
    const spreadX = s.w * (0.45 + dp.f * 0.25), spreadZ = s.d * (0.45 + dp.f * 0.25);
    rubblePile(B, cc[0] * (dp.dmg > 0.85 ? 0.3 : 0.8), cc[1] * (dp.dmg > 0.85 ? 0.3 : 0.8), spreadX, spreadZ, cnt, R, s.tint, { height: 1.6 + dp.f * 2.2 });
    if (dp.dmg > 0.85) rubblePile(B, 0, 0, s.w * 0.6, s.d * 0.6, Math.round(cnt * 0.6), R, s.tint, { height: 2.5 });
  }
  info.decalsDone = true;
  if (dp && dp.lean) B.pop();
  B.pop();
  return info;
}

function parapet(B, x0, x1, z0, z1, y, h, t, col) {
  B.box('concrete', (x0 + x1) / 2, y + h / 2, z1 - t / 2, x1 - x0, h, t, { col }); B.box('concrete', (x0 + x1) / 2, y + h / 2, z0 + t / 2, x1 - x0, h, t, { col });
  B.box('concrete', x0 + t / 2, y + h / 2, (z0 + z1) / 2, t, h, z1 - z0 - 2 * t, { col }); B.box('concrete', x1 - t / 2, y + h / 2, (z0 + z1) / 2, t, h, z1 - z0 - 2 * t, { col });
}

/** wall segment with columns of different heights (damage); UVs snapped to bays/floors */
function emitWall(B, o) {
  const { fk, F, a, b, n, y0, nBays, uOff, vOff, tint, tops, dp } = o; const name = 'f_' + fk; const fh = o.fh;
  const ax = a[0], az = a[1], dx = b[0] - a[0], dz = b[1] - a[1]; const dmgOn = !!dp;
  let i = 0;
  while (i < nBays) {
    let j = i + 1; while (j < nBays && Math.abs(tops[j] - tops[i]) < 0.01) j++;
    const top = tops[i]; const h = top - y0;
    if (h > 0.15) {
      const s0 = i / nBays, s1 = j / nBays; const p0 = [ax + dx * s0, az + dz * s0], p1 = [ax + dx * s1, az + dz * s1];
      const u0 = (uOff + i) / F.bays, u1 = (uOff + j) / F.bays; const vv = (y) => (vOff + (y - y0) / fh) / F.floors;
      const lo = o.ground ? 0.72 : 0.94; const c1 = mul(tint, 1.0), c0 = mul(tint, lo);
      const sc = dmgOn ? (1 - dp.scorch * 0.55) : 1; const cT = mul(c1, sc), cB = mul(c0, sc);
      if (o.ground && h > 1.6) {
        const ym = y0 + 1.5; B.quad(name, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], ym, p1[1]], [p0[0], ym, p0[1]], [u0, vv(y0), u1, vv(ym)], cB);
        B.quad(name, [p0[0], ym, p0[1]], [p1[0], ym, p1[1]], [p1[0], top, p1[1]], [p0[0], top, p0[1]], [u0, vv(ym), u1, vv(top)], [cB, cB, cT, cT]);
      } else B.quad(name, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], top, p1[1]], [p0[0], top, p0[1]], [u0, vv(y0), u1, vv(top)], [cB, cB, cT, cT]);
      if (dmgOn && top < y0 + 99) { // inner wall + cut cap
        const nx = (dz === 0 ? 0 : Math.sign(dz)) , nz = 0; // placeholder (outward normal computed below)
        const ol = Math.hypot(dx, dz) || 1; const on = [dz / ol * -1, 0, dx / ol]; // (nz,-nx) along => normal = (-dz, dx)/l ... verified below
        const out = [-dz / ol, dx / ol]; // outward normal for a->b (see SIDES derivation: along=(nz,-nx) => n=(-along_z, along_x))
        const th = 0.28; const q0 = [p0[0] - out[0] * th, p0[1] - out[1] * th], q1 = [p1[0] - out[0] * th, p1[1] - out[1] * th];
        B.quad('inner', [q1[0], y0, q1[1]], [q0[0], y0, q0[1]], [q0[0], top, q0[1]], [q1[0], top, q1[1]], [0, 0, 1, 1], [soot, soot, mul(soot, 2.5), mul(soot, 2.5)]);
        // wall thickness cap at the cut
        if (top < o.y1 - 0.05) B.quad('rubble', [p0[0], top, p0[1]], [p1[0], top, p1[1]], [q1[0], top, q1[1]], [q0[0], top, q0[1]], [0, 0, (j - i) * 1.5, 0.3], [0.45, 0.43, 0.4], [0, 1, 0]);
      }
      if (dmgOn) windowDamage(B, o, i, j, y0, top, p0, p1);
    }
    i = j;
  }
}

function windowDamage(B, o, i, j, y0, top, p0, p1) {
  const { F, dp, dmgCtx, nBays, fh } = o; const R = dmgCtx.rng; const W = F.win; const dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const len = Math.hypot(dx, dz); const ux = dx / len, uz = dz / len; const ox = -uz, oz = ux; // outward
  // outward normal for a->b (SIDES: along=(nz,-nx)) => n = (-uz... ) computed: n=( -uz?, ) -> derive: along=(ux,uz)=(nz,-nx) => nx=-uz, nz=ux
  const nxv = -uz, nzv = ux; const bayW = len / (j - i); const floors = Math.floor((top - y0) / fh + 0.001);
  const decals = dmgCtx.decals; const soot3 = decals.cell(3), soot7 = decals.cell(7), crack = decals.cell(2);
  for (let c = i; c < j; c++) {
    const cx = p0[0] + ux * bayW * (c - i + 0.5), cz = p0[1] + uz * bayW * (c - i + 0.5);
    for (let f = 0; f < floors + (top - y0 - floors * fh > fh * 0.7 ? 1 : 0); f++) {
      if (dmgCtx.shop && !(o.ground)) continue; const wy = y0 + (f + W.cy) * fh; const ww = W.w * bayW * 0.98, wh = W.h * fh;
      if (wy + wh / 2 > top) continue;
      const broken = R.next() < dp.broken * (0.45 + 0.55 * R.next()); const burning = broken && R.next() < dp.fire / Math.max(0.05, dp.broken) * 0.8;
      const off = 0.045; const px = cx + nxv * off, pz = cz + nzv * off;
      if (broken) {
        const hx = ux * ww / 2, hz = uz * ww / 2; const dark = burning ? [0.01, 0.005, 0.004] : [0.012, 0.014, 0.018];
        B.quad('dmgwin', [px - hx, wy - wh / 2, pz - hz], [px + hx, wy - wh / 2, pz + hz], [px + hx, wy + wh / 2, pz + hz], [px - hx, wy + wh / 2, pz - hz], [0, 0, 1, 1], dark);
        if (R.chance(0.7)) { // jagged glass teeth along the top & bottom
          for (let k = 0; k < 5; k++) { const t0 = (k + 0.1) / 5, t1 = (k + 0.9) / 5; B.tri('dmgwin', [px + ux * ww * (t0 - 0.5), wy + wh / 2, pz + uz * ww * (t0 - 0.5)], [px + ux * ww * (t1 - 0.5), wy + wh / 2, pz + uz * ww * (t1 - 0.5)], [px + ux * ww * ((t0 + t1) / 2 - 0.5), wy + wh / 2 - wh * R.range(0.1, 0.35), pz + uz * ww * ((t0 + t1) / 2 - 0.5)], [0.5, 0.55, 0.6]); }
        }
        // soot plume above
        const sw = ww * R.range(1.5, 2.1), sh = wh * R.range(2.0, 3.2); const cy = wy + wh * 0.5 + sh * 0.38; const sx = ux * sw / 2, sz = uz * sw / 2; const sootAmt = burning ? 0.9 : 0.5 + dp.scorch * 0.4;
        const cell = R.chance(0.5) ? soot3 : soot7; const sc = mul([0.02, 0.018, 0.016], 1); const alpha = sootAmt;
        B.quad('decal', [px - sx + nxv * 0.01, cy - sh / 2, pz - sz + nzv * 0.01], [px + sx + nxv * 0.01, cy - sh / 2, pz + sz + nzv * 0.01], [px + sx + nxv * 0.01, cy + sh / 2, pz + sz + nzv * 0.01], [px - sx + nxv * 0.01, cy + sh / 2, pz - sz + nzv * 0.01], cell, [[sc[0] * alpha, sc[1] * alpha, sc[2] * alpha], [sc[0] * alpha, sc[1] * alpha, sc[2] * alpha], [sc[0] * alpha, sc[1] * alpha, sc[2] * alpha], [sc[0] * alpha, sc[1] * alpha, sc[2] * alpha]]);
        if (burning) {
          const gx = ux * ww * 0.46, gz = uz * ww * 0.46; B.quad('ember', [px - gx + nxv * 0.01, wy - wh * 0.48, pz - gz + nzv * 0.01], [px + gx + nxv * 0.01, wy - wh * 0.48, pz + gz + nzv * 0.01], [px + gx + nxv * 0.01, wy + wh * 0.48, pz + gz + nzv * 0.01], [px - gx + nxv * 0.01, wy + wh * 0.48, pz - gz + nzv * 0.01], [0, 0, 1, 1], [R.next(), R.range(0.7, 1.1), 0]);
          const fl = ww * 0.9; for (let k = 0; k < 2; k++) { const ang = k * 0.9; const fx = ux * Math.cos(ang) * fl / 2, fz = uz * Math.cos(ang) * fl / 2; const nn = Math.sin(ang) * fl / 2; const col = [R.next(), R.range(0.8, 1.2), 0];
            B.quad('fire', [px - fx + nxv * (0.08 + nn * 0) , wy - wh * 0.4, pz - fz + nzv * 0.08], [px + fx + nxv * 0.08, wy - wh * 0.4, pz + fz + nzv * 0.08], [px + fx + nxv * (0.08 + 0.5 * k), wy + wh * 1.0, pz + fz + nzv * (0.08 + 0.5 * k)], [px - fx + nxv * (0.08 + 0.5 * k), wy + wh * 1.0, pz - fz + nzv * (0.08 + 0.5 * k)], [0, 0, 1, 1], col); }
          if (dmgCtx.ctx.fires.length < 60) { const wp = B.toWorld(px, wy + wh * 0.3, pz); dmgCtx.ctx.fires.push(new THREE.Vector3(wp.x, wp.y, wp.z)); }
        }
      } else if (dp.scorch > 0.35 && R.chance(dp.scorch * 0.3)) { // lightly scorched, not broken: faint soot streak
        const sw = ww * 1.2, sh = wh * 2.0; const cy = wy + wh * 0.5 + sh * 0.3; const sx = ux * sw / 2, sz = uz * sw / 2; const a = 0.4 * dp.scorch; const sc = [0.02 * a, 0.018 * a, 0.016 * a];
        B.quad('decal', [px - sx, cy - sh / 2, pz - sz], [px + sx, cy - sh / 2, pz + sz], [px + sx, cy + sh / 2, pz + sz], [px - sx, cy + sh / 2, pz - sz], soot3, sc);
      }
    }
  }
}

/** interior floors + rebar + exposed slabs for buildings with cut walls */
function cutInterior(B, s, t, dp, x0, x1, z0, z1, yBase, fh, floors, tint, rng, ctx) {
  const cell = 3.2; const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell)); const cw = (x1 - x0) / nx, cd = (z1 - z0) / nz;
  const slabCol = [0.46, 0.44, 0.41];
  for (let k = 1; k <= floors; k++) {
    const yy = yBase + k * fh; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lx = x0 + (i + 0.5) * cw, lz = z0 + (j + 0.5) * cd; const H = cutHeight(dp, s, lx, lz, dp.seed);
      if (H >= yy - 0.05 && !(k === floors && dp.roofGone && rng.chance(0.6))) { B.box('rubble', lx, yy - 0.12, lz, cw - 0.04, 0.24, cd - 0.04, { col: slabCol, mpt: 3 }); if (k === floors) B.box('r_flat', lx, yy + 0.002, lz, 0.001, 0.001, 0.001, { col: 0x000000 }); }
      else if (H >= yy - fh * 1.15 && rng.chance(0.55)) { // drooping slab piece hanging off the edge
        B.push(lx, yy - rng.range(0.3, 1.4), lz, rng.range(0, PI), 1, 1, 1, rng.range(-0.55, 0.55), rng.range(-0.55, 0.55)); B.box('rubble', 0, 0, 0, cw * rng.range(0.5, 0.95), 0.22, cd * rng.range(0.5, 0.95), { col: slabCol, mpt: 3 }); B.pop();
        for (let q = 0; q < 3; q++) { B.push(lx + rng.range(-1.2, 1.2), yy - 0.3, lz + rng.range(-1.2, 1.2), 0, 1, 1, 1, rng.range(-0.5, 0.5), rng.range(-0.5, 0.5)); B.cyl('metal', 0, 0, 0, 0.016, 0.016, rng.range(0.6, 1.6), 4, { col: 0x5a3422, cap: false }); B.pop(); }
      }
    }
  }
  // rebar sprouting from standing wall tops
  for (let q = 0; q < 10; q++) { const lx = rng.range(x0, x1), lz = rng.range(z0, z1); const H = cutHeight(dp, s, lx, lz, dp.seed); if (H < dp.hTot - 0.5 && H > 1) { B.push(lx, H, lz, 0, 1, 1, 1, rng.range(-0.5, 0.5), rng.range(-0.5, 0.5)); B.cyl('metal', 0, 0, 0, 0.018, 0.018, rng.range(0.7, 2.0), 4, { col: 0x5a3422, cap: false }); B.pop(); } }
  // burning interior glow on the cut level
  if (dp.fire > 0.05 && rng.chance(0.8)) {
    const nfire = Math.min(4, 1 + Math.floor(dp.fire * 8)); for (let q = 0; q < nfire; q++) {
      const lx = rng.range(x0 + 1, x1 - 1), lz = rng.range(z0 + 1, z1 - 1); const H = cutHeight(dp, s, lx, lz, dp.seed); const yy = Math.max(1, Math.min(H, yBase + floors * fh)) + 0.3; const wdt = rng.range(1.6, 3.0);
      const a = rng.range(0, PI);
      for (let k = 0; k < 2; k++) { const ang = a + k * PI / 2; const fx = Math.cos(ang) * wdt / 2, fz = Math.sin(ang) * wdt / 2; B.quad('fire', [lx - fx, yy, lz - fz], [lx + fx, yy, lz + fz], [lx + fx * 0.9, yy + wdt * 1.6, lz + fz * 0.9], [lx - fx * 0.9, yy + wdt * 1.6, lz - fz * 0.9], [0, 0, 1, 1], [rng.next(), rng.range(0.9, 1.3), 0]); }
      B.box('ember', lx, yy - 0.1, lz, wdt * 0.8, 0.12, wdt * 0.8, { col: [rng.next(), 1, 0] });
      if (ctx.fires.length < 60) { const wp = B.toWorld(lx, yy + 1.0, lz); ctx.fires.push(new THREE.Vector3(wp.x, wp.y, wp.z)); }
    }
  }
}

function shopDetails(B, s, sd, a, b, n, nBays, y, shopH, rng, ctx, tint) {
  const S = ctx.S; const dx = b[0] - a[0], dz = b[1] - a[1]; const len = Math.hypot(dx, dz); const ux = dx / len, uz = dz / len; const nxv = -uz, nzv = ux; const bayW = len / nBays;
  const yaw = Math.atan2(nxv, nzv); const signCls = S.signClass || 'fascia'; const range = S.signRange || [0, 16];
  // fascia signs per 1-2 bays
  let i = 0; while (i < nBays) {
    const span = nBays - i >= 2 && rng.chance(0.45) ? 2 : 1; const cx = a[0] + ux * bayW * (i + span / 2), cz = a[1] + uz * bayW * (i + span / 2);
    if (S.signs !== false && rng.chance(S.signChance ?? 0.8)) {
      const w = Math.min(2.7, bayW * span * 0.92); B.push(cx + nxv * 0.04, y + shopH - 0.42, cz + nzv * 0.04, yaw); const idx = rng.int(range[0], range[1] - 1); P.signFascia(B, 0, 0, 0, w, signCls, idx); B.pop();
    }
    if (S.awning && rng.chance(S.awning)) { B.push(cx, y, cz, yaw); P.awning(B, bayW * span * 0.9, 1.1, 0.7, rng.pick(S.awningCols || [0xe8402a, 0x2a6ac8, 0xf2c230]), rng.pick([0xf4f4f0, 0xe8e0c8]), y + shopH * 0.7 > 3 ? 3.0 : y + 2.9); B.pop(); }
    if (S.blades && rng.chance(S.blades)) { B.push(a[0] + ux * bayW * i, y + shopH + 0.6, a[1] + uz * bayW * i, yaw + (rng.chance(0.5) ? 0 : 0)); P.bladeSign(B, 0, 0, 0, rng.int(0, 15), 0.9, Math.PI / 2); B.pop(); }
    i += span;
  }
}

function wallDetails(B, s, t, sd, a, b, n, nBays, yBase, fh, floors, F, rng, ctx, tint, lowest) {
  const S = ctx.S; if (floors < 1) return; const dx = b[0] - a[0], dz = b[1] - a[1]; const len = Math.hypot(dx, dz); const ux = dx / len, uz = dz / len; const nxv = -uz, nzv = ux; const bayW = len / nBays; const yaw = Math.atan2(nxv, nzv);
  const front = sd.name === 'front';
  if (S.balconies && (front || rng.chance(0.2)) && len > 5) {
    const slab = mul(tint, 0.92), rail = mul(tint, 0.85);
    for (let f = 1; f < floors; f++) for (let i = 0; i < nBays; i++) {
      if (!rng.chance(S.balconies * (front ? 1 : 0.4))) continue; const cx = a[0] + ux * bayW * (i + 0.5), cz = a[1] + uz * bayW * (i + 0.5);
      B.push(cx, 0, cz, yaw); P.balcony(B, bayW * 0.82, S.balconyDepth || 1.0, 1.05, slab, rail, S.ironRail, yBase + f * fh - (S.ironRail ? 0 : 0)); B.pop();
    }
  }
  if (S.acBoxes && rng.chance(0.7)) {
    const cnt = Math.round(S.acBoxes * floors * nBays * 0.3); for (let k = 0; k < cnt; k++) { const i = rng.int(0, nBays - 1), f = rng.int(0, floors - 1); const cx = a[0] + ux * bayW * (i + 0.25 + rng.range(0, 0.5)), cz = a[1] + uz * bayW * (i + 0.5); P.acBox(B, cx + nxv * 0.2, yBase + f * fh + 0.5, cz + nzv * 0.2, yaw); }
  }
  if (S.fireEscape && front && len > 6 && rng.chance(S.fireEscape)) { const i = rng.int(1, Math.max(1, nBays - 2)); B.push(a[0] + ux * bayW * (i + 0.5), 0, a[1] + uz * bayW * (i + 0.5), yaw); P.fireEscape(B, bayW * 1.6, floors + 1, fh, yBase - fh); B.pop(); }
  if (S.banners && front && rng.chance(S.banners) && floors >= 2) { const f = rng.int(1, floors - 1); const i = rng.int(0, nBays - 1); const w = Math.min(bayW * 1.6, 3.6); P.banner(B, a[0] + ux * bayW * (i + 0.5) + nxv * 0.12, yBase + (f + 0.35) * fh, a[1] + uz * bayW * (i + 0.5) + nzv * 0.12, w, rng.int(0, 7), yaw); }
  if (S.laundry && front && floors >= 2 && rng.chance(S.laundry)) { const f = rng.int(1, floors - 1); const i = rng.int(0, nBays - 1); P.laundryLine(B, a[0] + ux * bayW * (i + 0.5) + nxv * 0.9, yBase + (f + 0.8) * fh, a[1] + uz * bayW * (i + 0.5) + nzv * 0.9, bayW * 0.9, Math.atan2(ux, uz) - Math.PI / 2 + Math.PI / 2, rng); }
}

const GI_COLS = [0xffffff, 0xf2f2f2, 0xe8a090, 0x98d0a8, 0x98b8f0, 0xdcdcd6, 0xe8d498, 0xffffff];
const roofProp = (B, kind, x, y, z, rng, ctx, tint) => {
  switch (kind) {
    case 'tank': P.waterTank(B, x, y, z, 'blue', rng); break; case 'tankblack': P.waterTank(B, x, y, z, 'black', rng); break; case 'barrel': P.waterTank(B, x, y, z, 'barrel', rng); break;
    case 'antenna': P.antenna(B, x, y, z, rng.range(4, 9), rng); break; case 'dish': P.dish(B, x, y, z, rng.range(0, 6.28), rng.range(0.4, 0.8)); break;
    case 'hvac': P.hvac(B, x, y, z, rng.range(0, 6.28), rng); break; case 'bulkhead': P.stairBulkhead(B, x, y, z, rng.range(2.2, 3.5), rng.range(2.2, 3.5), 2.5, mul(tint, 0.95)); break;
    case 'woodtower': P.woodWaterTower(B, x, y, z); break; case 'shanty': P.shanty(B, x, y, z, rng.range(2.5, 4), rng.range(2.5, 3.5), rng.pick([0, PI / 2]), rng); break;
    case 'laundry': P.laundryLine(B, x, y + 1.9, z, rng.range(3, 5), rng.range(0, PI), rng); break;
    case 'chimney': P.chimney(B, x, y, z, rng.range(1.5, 2.6), 0x8a4a36); break;
    case 'billboard': P.billboardFrame(B, x, y, z, rng.pick([0, PI / 2, PI]), rng.range(8, 12), 4, rng.int(0, 7)); break;
  }
};

function emitRoof(B, s, t, x0, x1, z0, z1, y, rng, ctx, tint, dp) {
  const S = ctx.S; const kind = s.roof?.type || 'flat'; const snow = ctx.snow || 0; const w = x1 - x0, d = z1 - z0; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (kind === 'flat' || kind === 'none') {
    B.quad(snow > 0.4 ? 'r_snow' : 'r_flat', [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / 6, z1 / 6, x1 / 6, z0 / 6], jitter(snow > 0.4 ? 0xf6f8fa : 0xf0f0ee, rng, 0.06), [0, 1, 0]);
    if (s.roof?.parapet !== false) parapet(B, x0, x1, z0, z1, y, s.roof?.parapetH ?? rng.range(0.7, 1.1), 0.22, mul(tint, 0.97));
    if (snow > 0.4) B.box('plain', cx, y + 0.01, cz, w - 0.6, 0.02, d - 0.6, { col: 0xf4f6f8 });
    // props
    const props = s.roof?.props || []; const placed = [];
    for (const pr of props) { for (let tries = 0; tries < 6; tries++) { const px = rng.range(x0 + 1.5, x1 - 1.5), pz = rng.range(z0 + 1.5, z1 - 1.5); if (w < 4 || d < 4) break; if (placed.some((q) => Math.hypot(q[0] - px, q[1] - pz) < 3.2)) continue; placed.push([px, pz]); roofProp(B, pr, px, y, pz, rng, ctx, tint); break; } }
  } else if (kind === 'gi_gable' || kind === 'tile_gable' || kind === 'zinc_gable' || kind === 'gi_hip' || kind === 'tile_hip' || kind === 'zinc_hip' || kind === 'green_hip') {
    const mat = kind.startsWith('gi') ? 'r_gi' : kind.startsWith('tile') ? 'r_tile' : kind.startsWith('zinc') ? 'r_zinc' : 'r_green';
    const col = snow > 0.4 ? 0xf4f6f8 : (s.roof?.col ?? (mat === 'r_gi' ? rng.pick(GI_COLS) : mat === 'r_tile' ? jitter(0xfff0e8, rng, 0.08) : 0xffffff));
    const pitch = s.roof?.pitch ?? (mat === 'r_tile' ? 0.75 : 0.42); const hip = kind.endsWith('hip'); const o = s.roof?.overhang ?? 0.45;
    const alongX = w >= d; const L = alongX ? w : d, Wd = alongX ? d : w; const rh = (Wd / 2) * pitch;
    B.push(cx, y, cz, alongX ? 0 : PI / 2);
    const ex = L / 2, ez = Wd / 2; const rhh = rh * (1 + o / ez); const tile = mat === 'r_gi' ? 4 : 6;
    const slopeLen = Math.hypot(ez + o, rhh); const rl = hip ? Math.max(0, ex - ez * 0.9) : ex + o;
    // front slope (z+)
    B.quad(mat, [-ex - o, -0.0, ez + o], [ex + o, 0, ez + o], [rl, rhh, 0], [-rl, rhh, 0], [-ex / tile, 0, ex / tile, slopeLen / tile], jitter(col, rng, 0.04));
    B.quad(mat, [ex + o, 0, -ez - o], [-ex - o, 0, -ez - o], [-rl, rhh, 0], [rl, rhh, 0], [-ex / tile, 0, ex / tile, slopeLen / tile], jitter(col, rng, 0.04));
    const wallCol = mul(tint, 0.96);
    if (hip) {
      B.tri(mat, [ex + o, 0, ez + o], [ex + o, 0, -ez - o], [rl, rhh, 0], col, [0, 0, 1, 0, 0.5, 1]); B.tri(mat, [-ex - o, 0, -ez - o], [-ex - o, 0, ez + o], [-rl, rhh, 0], col, [0, 0, 1, 0, 0.5, 1]);
      if (s.roof?.dormers) for (let k = 0; k < s.roof.dormers; k++) { const dxm = (k + 0.5) / s.roof.dormers * (L * 0.7) - L * 0.35; const f = 0.45; B.push(dxm, rhh * f, (ez + o) * (1 - f), 0); B.box('concrete', 0, 0.55, 0.0, 1.5, 1.1, 1.0, { col: wallCol }); B.box('plain', 0, 0.55, 0.51, 0.9, 0.75, 0.02, { col: 0x1c2630 }); B.quad(mat, [-0.95, 1.05, 0.55], [0.95, 1.05, 0.55], [0.95, 1.55, -0.4], [-0.95, 1.55, -0.4], [0, 0, 1, 1], col); B.pop(); }
    } else {
      // gable ends
      B.tri('concrete', [ex, 0, ez], [ex, 0, -ez], [ex, rh, 0], wallCol, [0, 0, 1, 0, 0.5, 1]); B.tri('concrete', [-ex, 0, -ez], [-ex, 0, ez], [-ex, rh, 0], wallCol, [0, 0, 1, 0, 0.5, 1]);
      B.box('plain', 0, rhh + 0.02, 0, (ex + o) * 2, 0.08, 0.14, { col: mul(rgb(col), 0.7) });
    }
    B.pop();
    if (s.roof?.props) for (const pr of s.roof.props) { if (pr === 'chimney') { const px = rng.range(x0 + 1, x1 - 1), pz = rng.range(z0 + 1, z1 - 1); roofProp(B, 'chimney', px, y + rh * 0.55, pz, rng, ctx, tint); } else if (pr === 'antenna' || pr === 'dish') roofProp(B, pr, rng.range(x0 + 1, x1 - 1), y + rh * 0.9, rng.range(z0 + 1, z1 - 1), rng, ctx, tint); }
    // low parapet band at eaves for gable on flat-ish look
    B.box('concrete', cx, y - 0.1, cz, w + 0.1, 0.22, d + 0.1, { col: mul(tint, 0.9) });
  } else if (kind === 'spire') {
    B.quad('r_flat', [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 0, 1, 1], 0x8a8a86, [0, 1, 0]); parapet(B, x0, x1, z0, z1, y, 0.8, 0.25, mul(tint, 0.95));
    const h = s.roof.h || 12; B.cyl('metal', cx, y, cz, Math.min(w, d) * 0.28, 0.06, h, 8, { col: s.roof.col ?? 0x8aa6a0, flat: true });
  }
}

function wallDetailsDummy() {}
export { SIDES, sideAB };
