// City block / district generator: layout (roads + cells + ring lots), ground & road markings, street furniture, damage orchestration.
import * as THREE from 'three';
import { RNG, smoothstep, clamp, damp } from '../../engine/common.js';
import { fbm2 } from '../../engine/proc.js';
import { Builder, rgb, mul, mix, jitter } from './builder.js';
import { MatSet, meshesFromBuilder } from './materials.js';
import { STYLES } from './styles.js';
import { emitBuilding, rubblePile, blob } from './buildings.js';
import { getDecals } from './surfaces.js';
import * as P from './props.js';

const PI = Math.PI;
const CURB = 0.15;

/** deterministic layout independent of damage level */
export function layoutBlock(S, seed, w, d, density, reserve = null) {
  const rng = new RNG(seed * 97 + 11); const rw = S.roadW;
  const avg = (S.cell[0] + S.cell[1]) / 2; const nx = Math.max(1, Math.round(w / (avg + rw))), nz = Math.max(1, Math.round(d / (avg + rw)));
  const split = (L, n) => { const ws = []; let tot = 0; for (let i = 0; i < n; i++) { const v = rng.range(0.82, 1.18); ws.push(v); tot += v; } const avail = L - n * rw; return ws.map((v) => (v / tot) * avail); };
  const cwX = split(w, nx), cwZ = split(d, nz);
  const xs = [], zs = []; let x = -w / 2 + rw / 2; for (let i = 0; i < nx; i++) { xs.push([x, x + cwX[i]]); x += cwX[i] + rw; }
  let z = -d / 2 + rw / 2; for (let j = 0; j < nz; j++) { zs.push([z, z + cwZ[j]]); z += cwZ[j] + rw; }
  const roadsX = [], roadsZ = []; // roads running along X at zc / along Z at xc
  roadsX.push(-d / 2); for (let j = 0; j < nz - 1; j++) roadsX.push((zs[j][1] + zs[j + 1][0]) / 2); roadsX.push(d / 2);
  roadsZ.push(-w / 2); for (let i = 0; i < nx - 1; i++) roadsZ.push((xs[i][1] + xs[i + 1][0]) / 2); roadsZ.push(w / 2);
  const cells = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) cells.push({ i, j, x0: xs[i][0], x1: xs[i][1], z0: zs[j][0], z1: zs[j][1] });
  const lots = []; let lotId = 0;
  const env = { density };
  cells.forEach((c, idx) => { c.index = idx; c.reserved = !!(reserve && (typeof reserve === 'function' ? reserve(c, idx) : reserve.includes(idx))); });
  for (const cell of cells) {
    const sw = S.sidewalk; const ix0 = cell.x0 + sw, ix1 = cell.x1 - sw, iz0 = cell.z0 + sw, iz1 = cell.z1 - sw; cell.inner = { x0: ix0, x1: ix1, z0: iz0, z1: iz1 };
    const Wd = ix1 - ix0, Dp = iz1 - iz0; let D = rng.range(S.ringDepth[0], S.ringDepth[1]); D = Math.min(D, Math.min(Wd, Dp) * 0.42); cell.D = D;
    const addEdge = (side) => {
      const horizontal = side === 'top' || side === 'bottom'; const L0 = horizontal ? ix0 : iz0 + D, L1 = horizontal ? ix1 : iz1 - D; let t = L0; let k = 0;
      while (t < L1 - 2) {
        let lw = rng.range(S.lotW[0], S.lotW[1]); if (L1 - t - lw < S.lotW[0] * 0.75) lw = L1 - t; const ld = D * rng.range(0.88, 1.0);
        const lc = t + lw / 2; const first = horizontal && t === L0, last = horizontal && (t + lw >= L1 - 0.01);
        let cx, cz, yaw; if (side === 'top') { cx = lc; cz = iz1 - ld / 2; yaw = 0; } else if (side === 'bottom') { cx = lc; cz = iz0 + ld / 2; yaw = PI; } else if (side === 'right') { cx = ix1 - ld / 2; cz = lc; yaw = PI / 2; } else { cx = ix0 + ld / 2; cz = lc; yaw = -PI / 2; }
        const lot = { id: lotId++, cell: cell.i + ',' + cell.j, edge: true, corner: first || last, side, w: lw, d: ld, cx, cz, yaw, setback: 0 };
        lots.push(lot); t += lw; k++;
      }
    };
    if (!cell.reserved) { addEdge('top'); addEdge('bottom'); addEdge('left'); addEdge('right'); }
    cell.courtyard = { x0: ix0 + D, x1: ix1 - D, z0: iz0 + D, z1: iz1 - D };
  }
  // specs
  for (const lot of lots) {
    const lr = new RNG(seed * 7919 + lot.id * 104729 + 3); lot.rng = lr;
    const spec = S.spec(lr, lot, env); if (!spec) { lot.spec = null; continue; }
    // position: front flush to the edge (+ setback)
    const nxz = { top: [0, -1], bottom: [0, 1], right: [-1, 0], left: [1, 0] }[lot.side]; const half = lot.d / 2; const setb = spec.setback ?? (spec.inset ? lr.range(5, 8) : 0); const front = { top: [lot.cx, lot.cz + half], bottom: [lot.cx, lot.cz - half], right: [lot.cx + half, lot.cz], left: [lot.cx - half, lot.cz] }[lot.side];
    spec.x = front[0] + nxz[0] * (setb + spec.d / 2); spec.z = front[1] + nxz[1] * (setb + spec.d / 2); spec.yaw = lot.yaw; spec.y = CURB;
    if (S.spec && spec.w > lot.w + 0.2 && lot.side) { /* wide plattenbau: allow, neighbours overlap hidden */ }
    lot.spec = spec;
    // damage threshold: clustered "hot zones"
    const hx = lot.cx * 0.012 + seed * 0.37, hz = lot.cz * 0.012 - seed * 0.21; lot.threshold = clamp(fbm2(hx, hz, 3) * 0.75 + lr.next() * 0.25, 0, 1);
  }
  return { w, d, nx, nz, cells, roadsX, roadsZ, lots, xs, zs, rw };
}

const damageOf = (lot, level) => { if (level <= 0.001) return 0; const t = lot.threshold; const a = t * 0.6; return smoothstep(a, a + 0.45, level); };

function groundQuad(B, name, x0, z0, x1, z1, y, tile, col = 0xffffff) { B.quad(name, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / tile, z1 / tile, x1 / tile, z0 / tile], col, [0, 1, 0]); }

/** markings along a road: kind 'x' (running along X) or 'z' */
function roadMarkings(B, S, kind, c, a0, a1, rw, skipRanges) {
  const mk = S.markings; const along = (v) => skipRanges.every((r) => v < r[0] || v > r[1]);
  const W = (x0, z0, x1, z1, col = 0xe8e8e0) => B.quad('paint', [x0, 0.012, z1], [x1, 0.012, z1], [x1, 0.012, z0], [x0, 0.012, z0], [x0 / 4, z1 / 4, x1 / 4, z0 / 4], col, [0, 1, 0]);
  const strip = (off, wd, dashLen, gapLen, col) => { // along-axis strip at lateral offset
    let t = a0; while (t < a1) { const e = dashLen > 0 ? Math.min(a1, t + dashLen) : a1; // solid when dashLen=0
      const segs = dashLen > 0 ? [[t, e]] : [[a0, a1]]; for (const [s0, s1] of segs) { // subtract skip ranges
        let cur = s0; const cuts = skipRanges.filter((r) => r[1] > s0 && r[0] < s1).sort((p, q) => p[0] - q[0]); for (const r of cuts) { if (r[0] > cur) emit(cur, r[0]); cur = Math.max(cur, r[1]); } if (cur < s1) emit(cur, s1); }
      if (dashLen === 0) break; t += dashLen + gapLen; }
    function emit(p0, p1) { if (p1 - p0 < 0.3) return; if (kind === 'x') W(p0, c + off - wd / 2, p1, c + off + wd / 2, col); else W(c + off - wd / 2, p0, c + off + wd / 2, p1, col); }
  };
  const yel = 0xd8b020, whi = 0xe6e6de;
  if (mk === 'ph' || mk === 'us' || mk === 'ru') { strip(-0.12, 0.12, 0, 0, mk === 'us' || mk === 'ph' ? yel : whi); strip(0.12, 0.12, 0, 0, mk === 'us' || mk === 'ph' ? yel : whi); }
  else if (mk === 'eu') strip(0, 0.14, 3, 6, whi); else strip(0, 0.15, 3, 3, whi); // 'in': dashed centre
  const lane = (rw - 2 * (S.parkLane || 0)) / 2; if (lane > 5) { strip(-lane / 2, 0.12, 3, 6, whi); strip(lane / 2, 0.12, 3, 6, whi); }
  const edge = rw / 2 - (S.parkLane || 0) - 0.15; strip(-edge, 0.12, 0, 0, whi); strip(edge, 0.12, 0, 0, whi);
}
function zebra(B, x, z, len, wd, axisX, gap = 0.9) { // stripes across the width wd, along length len ; axisX true => stripes run along x
  const n = Math.floor(wd / gap); const col = 0xe8e8e2; for (let i = 0; i < n; i++) { const off = -wd / 2 + (i + 0.5) * wd / n; const sw2 = 0.5; if (axisX) B.quad('paint', [x - len / 2, 0.013, z + off + sw2 / 2], [x + len / 2, 0.013, z + off + sw2 / 2], [x + len / 2, 0.013, z + off - sw2 / 2], [x - len / 2, 0.013, z + off - sw2 / 2], [0, 0, len / 4, sw2 / 4], col, [0, 1, 0]); else B.quad('paint', [x + off - sw2 / 2, 0.013, z + len / 2], [x + off + sw2 / 2, 0.013, z + len / 2], [x + off + sw2 / 2, 0.013, z - len / 2], [x + off - sw2 / 2, 0.013, z - len / 2], [0, 0, sw2 / 4, len / 4], col, [0, 1, 0]); }
}

function decalQuad(B, decals, cell, cx, cz, sx, sz, rot, col, y = 0.02) {
  const c = Math.cos(rot), s = Math.sin(rot); const P0 = (u, v) => [cx + u * c - v * s, y, cz + u * s + v * c];
  B.quad('decal', P0(-sx, sz), P0(sx, sz), P0(sx, -sz), P0(-sx, -sz), decals.cell(cell), col, [0, 1, 0]);
}

/** build everything for a level of damage; returns Builder + info */
function emitBlock(S, L, opts, level, dseed, mats) {
  const B = new Builder(); const ctx = { S, snow: opts.snow, fires: [], night: 0 }; const rng = new RNG(opts.seed * 31 + 5); const frng = new RNG(opts.seed * 131 + dseed + 7); const decals = getDecals();
  const snow = opts.snow > 0.4; const w = L.w, d = L.d, rw = S.roadW; const anchors = [];
  const sidewalkMat = snow ? 'g_snow' : (S.name === 'berlin' ? 'g_paving' : (S.name === 'moscow' ? 'g_paving' : 'g_sidewalk')); const innerMat = snow ? 'g_snow' : S.groundInner;
  const tileOf = (m) => ({ g_asphalt: 8, g_sidewalk: 4.8, g_paving: 4, g_cobble: 3, g_grass: 6, g_dirt: 6, g_snow: 6, g_concrete: 4, g_gravel: 4 })[m] || 4;
  // ---- roads
  const roadCol = snow ? 0x9a9ca0 : 0xffffff;
  for (const zc of L.roadsX) { const z0 = Math.max(-d / 2, zc - rw / 2), z1 = Math.min(d / 2, zc + rw / 2); groundQuad(B, 'g_asphalt', -w / 2, z0, w / 2, z1, 0, 8, roadCol); }
  for (let j = 0; j < L.nz; j++) { const zr = L.zs[j]; for (let i = 0; i <= L.nx; i++) { const xc = L.roadsZ[i]; const x0 = Math.max(-w / 2, xc - rw / 2), x1 = Math.min(w / 2, xc + rw / 2); groundQuad(B, 'g_asphalt', x0, zr[0], x1, zr[1], 0, 8, roadCol); } }
  // tram tracks (berlin): along X roads centre
  if (S.tram) for (const zc of L.roadsX) { if (Math.abs(zc) > d / 2 - 1) continue; for (const o of [-0.72, 0.72]) B.box('metal', 0, 0.045, zc + o, w, 0.09, 0.07, { col: 0x6a6d70 }); B.quad('g_paving', [-w / 2, 0.01, zc + 1.4], [w / 2, 0.01, zc + 1.4], [w / 2, 0.01, zc - 1.4], [-w / 2, 0.01, zc - 1.4], [-w / 2 / 4, (zc + 1.4) / 4, w / 2 / 4, (zc - 1.4) / 4], 0x6a6866, [0, 1, 0]); }
  // ---- cell plates + kerbs + inner ground
  for (const c of L.cells) {
    const sw = S.sidewalk; groundQuad(B, sidewalkMat, c.x0, c.z0, c.x1, c.z1, CURB, tileOf(sidewalkMat), snow ? 0xf4f6f8 : 0xffffff);
    const kc = 0xdcd8d0; B.quad('g_concrete', [c.x0, 0, c.z1], [c.x1, 0, c.z1], [c.x1, CURB, c.z1], [c.x0, CURB, c.z1], [c.x0 / 4, 0, c.x1 / 4, 0.04], kc, [0, 0, 1]); B.quad('g_concrete', [c.x1, 0, c.z0], [c.x0, 0, c.z0], [c.x0, CURB, c.z0], [c.x1, CURB, c.z0], [0, 0, 1, 0.04], kc, [0, 0, -1]);
    B.quad('g_concrete', [c.x1, 0, c.z1], [c.x1, 0, c.z0], [c.x1, CURB, c.z0], [c.x1, CURB, c.z1], [0, 0, 1, 0.04], kc, [1, 0, 0]); B.quad('g_concrete', [c.x0, 0, c.z0], [c.x0, 0, c.z1], [c.x0, CURB, c.z1], [c.x0, CURB, c.z0], [0, 0, 1, 0.04], kc, [-1, 0, 0]);
    const i0 = c.inner; groundQuad(B, innerMat, i0.x0, i0.z0, i0.x1, i0.z1, CURB + 0.004, tileOf(innerMat), snow ? 0xf4f6f8 : (innerMat === 'g_grass' ? 0xd8e8c8 : 0xffffff));
  }
  // ---- markings + junction info
  const juncRanges = (axis) => { const arr = []; const list = axis === 'x' ? L.roadsZ : L.roadsX; for (const c of list) arr.push([c - rw / 2 - 0.5, c + rw / 2 + 0.5]); return arr; };
  if (!snow || opts.snow < 0.9) {
    for (const zc of L.roadsX) { if (Math.abs(zc) > d / 2 - 1) { roadMarkingsEdge(); continue; } roadMarkings(B, S, 'x', zc, -w / 2, w / 2, rw, juncRanges('x')); }
    for (const xc of L.roadsZ) { if (Math.abs(xc) > w / 2 - 1) continue; roadMarkings(B, S, 'z', xc, -d / 2, d / 2, rw, juncRanges('z')); }
    function roadMarkingsEdge() {}
    // crosswalks + stop lines at junctions
    for (const zc of L.roadsX) for (const xc of L.roadsZ) {
      if (Math.abs(zc) > d / 2 - 1 || Math.abs(xc) > w / 2 - 1) continue; const off = rw / 2 + 1.6;
      zebra(B, xc, zc + off, rw - 2 * (S.parkLane || 0) - 0.4, 3.2, true); zebra(B, xc, zc - off, rw - 2 * (S.parkLane || 0) - 0.4, 3.2, true); zebra(B, xc + off, zc, rw - 2 * (S.parkLane || 0) - 0.4, 3.2, false); zebra(B, xc - off, zc, rw - 2 * (S.parkLane || 0) - 0.4, 3.2, false);
      anchors.push({ pos: [xc, 0, zc], yaw: 0, kind: 'junction' });
    }
  }
  // road decals: stains, cracks, puddles
  const nDec = Math.round((w * d) / 700 * (0.5 + level)); const R2 = new RNG(opts.seed + 5);
  for (let i = 0; i < nDec; i++) {
    const onX = R2.chance(0.5); const zc = R2.pick(L.roadsX), xc = R2.pick(L.roadsZ); const x = onX ? R2.range(-w / 2, w / 2) : xc + R2.range(-rw / 2, rw / 2), z = onX ? zc + R2.range(-rw / 2, rw / 2) : R2.range(-d / 2, d / 2);
    const kindD = R2.pick([0, 0, 1, 2, 2, 3]); const sc = R2.range(0.7, 2.6); const dark = kindD === 0 ? (opts.wet ? [0.2, 0.22, 0.26] : [0.05, 0.055, 0.06]) : kindD === 1 ? [0.02, 0.02, 0.02] : [0.01, 0.01, 0.01];
    if (kindD === 0 && !opts.wet && R2.chance(0.6)) continue; decalQuad(B, decals, kindD === 3 ? 3 : kindD === 0 ? 0 : kindD === 1 ? 1 : 2, x, z, sc * 1.4, sc, R2.range(0, PI), dark);
  }
  for (let i = 0; i < Math.round(w * d / 2500); i++) { const x = R2.range(-w / 2, w / 2), z = R2.pick(L.roadsX) + R2.range(-rw / 2, rw / 2); manholeAt(x, z); }
  function manholeAt(x, z) { P.manhole(B, x, z, 0.42); }
  // ---- buildings
  let maxH = 0; const infos = [];
  for (const lot of L.lots) { if (!lot.spec) continue; const dm = damageOf(lot, level); const info = emitBuilding(B, lot.spec, dm, ctx); lot.dmg = dm; maxH = Math.max(maxH, info.top); infos.push(info); }
  // ---- courtyard fill + street furniture
  furniture(B, S, L, opts, level, rng, frng, ctx, anchors, snow);
  // spill rubble onto streets near heavily damaged lots
  if (level > 0.3) { for (const lot of L.lots) { if (!lot.spec || lot.dmg < 0.4) continue; const R3 = new RNG(lot.id * 977 + dseed); const nxz = { top: [0, 1], bottom: [0, -1], right: [1, 0], left: [-1, 0] }[lot.side]; const edgeX = lot.cx + nxz[0] * (lot.d / 2 + 1.8), edgeZ = lot.cz + nxz[1] * (lot.d / 2 + 1.8); rubblePile(B, edgeX, edgeZ, lot.w * 0.4 + 1.5, 2.8, Math.round(lot.dmg * 26), R3, lot.spec.tint, { height: 0.9 }); } }
  return { B, ctx, maxH, anchors };
}

function furniture(B, S, L, opts, level, rng, frng, ctx, anchors, snow) {
  const rw = S.roadW, sw = S.sidewalk; const wantCars = opts.cars !== false, wantTrees = opts.trees !== false; const lampSpacing = S.lamp === 'ornate' ? 22 : 28;
  const poles = []; const placedBlock = [];
  const burn = smoothstep(0.35, 0.9, level);
  const treeKinds = S.tree;
  const treeAt = (x, z, big = 1) => { const kind = rng.pick(treeKinds); const bare = snow && (kind === 'plane' || kind === 'linden' || kind === 'birch'); const dead = level > 0.55 && rng.chance(burn * 0.7); P.tree(B, dead ? 'bare' : kind, x, z, big * rng.range(0.85, 1.2), rng.int(1, 99999), { snow: snow ? 1 : 0, bare: bare || dead, y: CURB }); };
  const parkW = S.parkLane || 0;
  for (const c of L.cells) {
    // ----- edges of the cell: walk each side along its kerb line
    const sides = [
      { name: 'top', a: [c.x0, c.z1], b: [c.x1, c.z1], n: [0, 1], along: [1, 0] }, { name: 'bottom', a: [c.x1, c.z0], b: [c.x0, c.z0], n: [0, -1], along: [-1, 0] },
      { name: 'right', a: [c.x1, c.z1], b: [c.x1, c.z0], n: [1, 0], along: [0, -1] }, { name: 'left', a: [c.x0, c.z0], b: [c.x0, c.z1], n: [-1, 0], along: [0, 1] },
    ];
    for (const sd of sides) {
      const len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]); const ux = sd.along[0], uz = sd.along[1]; const nx = sd.n[0], nz = sd.n[1]; const yawStreet = Math.atan2(nx, nz); // faces the road
      const pt = (t, off) => [sd.a[0] + ux * t - nx * off * -1 * 0 + nx * off * 0, sd.a[1] + uz * t]; // helper replaced below
      const at = (t, off) => [sd.a[0] + ux * t + nx * (-off), sd.a[1] + uz * t + nz * (-off)]; // off measured inward from kerb (positive = onto sidewalk)
      const margin = rw / 2 + 2.5;
      // lamps (alternate sides)
      const lampOff = 0.7; let t = margin + rng.range(0, 6); let k = 0;
      while (t < len - margin) { const [px, pz] = at(t, lampOff); const tilt = level > 0.55 && rng.chance(burn * 0.35); if (!(tilt)) P.lampPost(B, px, pz, yawStreet + PI, { y: CURB, style: S.lamp === 'ornate' ? 'ornate' : 'modern', h: S.lamp === 'ornate' ? 5.2 : 8, arm: 1.8 }); else { B.push(px, CURB, pz, yawStreet); B.push(0, 0, 0, 0, 1, 1, 1, 0.15 + rng.range(0, 0.9), 0); P.lampPost(B, 0, 0, 0, { h: 8, arm: 1.8 }); B.pop(); B.pop(); }
        anchors.push({ pos: [px + nx * -0.0, CURB, pz], yaw: yawStreet, kind: 'lamp' }); t += lampSpacing * rng.range(0.9, 1.15); k++; }
      // trees
      if (wantTrees && S.treeSpacing < 100) { t = margin + 4 + rng.range(0, 3); while (t < len - margin) { const [px, pz] = at(t, sw * 0.58); if (sw >= 2.0 || S.tree.length) treeAt(px, pz); t += S.treeSpacing * rng.range(0.85, 1.2); } }
      // utility poles + wires (every ~24 m)
      if (S.poles && rng.chance(0.7) && opts.props !== false) { t = margin + 3; let prev = null; while (t < len - margin + 2) { const [px, pz] = at(t, 0.45); poles.push([px, pz]); P.utilityPole(B, px, pz, yawStreet + PI / 2, { transformer: rng.chance(0.2), clutter: true, arms: 2, h: 9.5 }); if (prev && S.wires && opts.wires !== false) { for (let wk = 0; wk < 5; wk++) { const dy = 9.0 - (wk % 2) * 0.7 - (wk >> 1) * 0.06; const off2 = (wk - 2) * 0.32; B.wire([prev[0] + (-nz) * off2, dy, prev[1] + nx * off2], [px + (-nz) * off2, dy - 0.1, pz + nx * off2], 0.5 + rng.range(0, 0.4), 8, 0x101010); } if (rng.chance(0.6)) B.wire([prev[0], 6.2, prev[1]], [px, 6.0, pz], 0.7, 8, 0x1a1a1a); } prev = [px, pz]; t += 22 * rng.range(0.9, 1.15); } }
      // benches / bins / hydrants
      if (opts.props !== false) {
        if (rng.chance(0.55)) { const tt = rng.range(margin, len - margin); const [px, pz] = at(tt, 1.1); P.bench(B, px, pz, yawStreet + PI); }
        if (rng.chance(0.5)) { const tt = rng.range(margin, len - margin); const [px, pz] = at(tt, 0.6); P.trashBin(B, px, pz, yawStreet); }
        if (rng.chance(0.4)) { const tt = rng.range(margin, len - margin); const [px, pz] = at(tt, 0.5); P.hydrant(B, px, pz); }
        if (S.signs !== false && rng.chance(0.4)) { const tt = rng.range(margin, len - margin); const [px, pz] = at(tt, 0.5); P.signPost(B, px, pz, yawStreet, rng.pick(['blue', 'yellow', 'green', 'white'])); }
        if ((S.name === 'dumaguete' || S.name === 'delhi') && rng.chance(0.85)) { const nStall = rng.int(1, 3); for (let q = 0; q < nStall; q++) { const tt = rng.range(margin, len - margin); const [px, pz] = at(tt, sw * 0.65 - 0.3); if (q % 2) P.umbrellaStall(B, px, pz, rng.pick([0xe84a4a, 0x2a8ae8, 0xf2c230, 0x3aa86f]), rng); else P.kiosk(B, px, pz, yawStreet + PI, { col: rng.pick([0x3aa0c8, 0xe8a030, 0x4aa860, 0xd05a7a]), sign: rng.int(0, 15) }); } }
        if (S.name === 'dumaguete' && rng.chance(0.15)) { const tt = rng.range(margin, len - margin); const [px, pz] = at(tt, 1.2); P.busShelter(B, px, pz, yawStreet + PI, { ad: 0x60a0ff }); }
      }
      // parked cars along the kerb in the parking lane
      if (wantCars && parkW > 0) {
        t = margin + 1; while (t < len - margin - 3) { if (rng.chance(S.carsDensity)) { const shape = rng.pick(S.cars); const [px, pz] = [sd.a[0] + ux * t + nx * (parkW * 0.5 + 0.2 - 0) , sd.a[1] + uz * t + nz * (parkW * 0.5 + 0.2)]; const lenCar = shape === 'jeepney' ? 6.3 : shape === 'bus' ? 11 : shape === 'truck' ? 7.5 : shape === 'tricycle' ? 2.8 : 4.6; const yaw = Math.atan2(ux, uz) + (rng.chance(0.5) ? 0 : PI);
            const burnt = level > 0.4 ? clamp((level - 0.3) * 1.3 * rng.range(0.4, 1.4), 0, 1) * (rng.chance(0.6) ? 1 : 0.3) : 0; const col = shape === 'taxi' ? 0xf2c230 : shape === 'jeepney' ? rng.pick([0xc8302a, 0x2a5ac8, 0x2a9a5a, 0xe8e0d0, 0x8a2ac8]) : rng.pick(P.PALETTE.carBody);
            B.push(0, 0, 0); P.car(B, shape, px, pz, yaw, col, { wreck: burnt, col2: rng.pick([0xf2c230, 0xe84a2a, 0x2a9ae8, 0xffffff]), col3: rng.pick([0xe8e0d0, 0xf2c230, 0xc8302a]) }); B.pop();
            if (burnt > 0.55 && ctx.fires.length < 70) ctx.fires.push(new THREE.Vector3(px, 1.0, pz));
            t += lenCar + rng.range(0.4, 3.5); } else t += rng.range(3, 7); }
      }
    }
    // courtyard
    if (!c.reserved) courtyard(B, S, c, opts, level, rng, ctx, snow, treeAt, anchors);
  }
  // junction furniture
  if (opts.props !== false) for (const zc of L.roadsX) for (const xc of L.roadsZ) {
    if (Math.abs(zc) > L.d / 2 - 1 || Math.abs(xc) > L.w / 2 - 1) continue; const o = rw / 2 + 0.6;
    if (S.name !== 'suburb' && S.name !== 'industrial') for (const [sx, sz, yw] of [[1, 1, PI * 1.25], [-1, 1, PI * 0.75], [1, -1, -PI * 0.25], [-1, -1, PI * 0.25]]) { P.trafficLight(B, xc + sx * o, zc + sz * o, yw + (sx * sz > 0 ? 0 : 0), { state: rng.int(0, 2) }); }
    if (S.name === 'manhattan') P.steamVent(B, xc + rng.range(-3, 3), zc + rng.range(-3, 3));
    // bunting across streets (fiesta)
    if (S.bunting && rng.chance(S.bunting)) { const hy = 6.3; const o2 = rw / 2 + 0.8; for (const dir of rng.chance(0.5) ? ['x'] : ['x', 'z']) { if (dir === 'x') { const off = rng.range(8, 16); P.bunting(B, [xc + off, hy, zc - o2], [xc + off, hy - 0.4, zc + o2], 22, 1.3, rng); } else { const off = rng.range(8, 16); P.bunting(B, [xc - o2, hy, zc + off], [xc + o2, hy - 0.4, zc + off], 22, 1.3, rng); } } }
  }
}

function courtyard(B, S, c, opts, level, rng, ctx, snow, treeAt, anchors) {
  const cy = c.courtyard; const w = cy.x1 - cy.x0, d = cy.z1 - cy.z0; if (w < 6 || d < 6) return; const cx = (cy.x0 + cy.x1) / 2, cz = (cy.z0 + cy.z1) / 2; const nm = S.name;
  const fill = (specGen, spacing, prob) => { // jittered grid of small buildings
    const nxg = Math.max(1, Math.floor(w / spacing[0])), nzg = Math.max(1, Math.floor(d / spacing[1])); const sx = w / nxg, sz = d / nzg;
    for (let i = 0; i < nxg; i++) for (let j = 0; j < nzg; j++) { if (!rng.chance(prob)) { if (rng.chance(0.6)) treeAt(cy.x0 + (i + 0.5) * sx + rng.range(-1, 1), cy.z0 + (j + 0.5) * sz + rng.range(-1, 1), 0.8); continue; } const spec = specGen(sx - 1.5, sz - 1.5); spec.x = cy.x0 + (i + 0.5) * sx + rng.range(-0.5, 0.5); spec.z = cy.z0 + (j + 0.5) * sz + rng.range(-0.5, 0.5); spec.yaw = rng.pick([0, PI / 2, PI, -PI / 2]); spec.y = CURB; const dm = smoothstep(0.1, 0.9, level) * rng.range(0.4, 1.2); emitBuilding(B, spec, Math.min(1, dm * (level > 0.01 ? 1 : 0)), ctx); } };
  if (nm === 'dumaguete' || nm === 'delhi' || nm === 'cebu') {
    const court = nm === 'dumaguete' && w > 28 && d > 20 && rng.chance(0.45);
    if (court) { basketballCourt(B, cx, cz, rng.chance(0.5) ? 0 : PI / 2, rng, ctx, level); }
    else fill((ww, dd) => { const fl = rng.int(1, nm === 'delhi' ? 3 : 2); const W = Math.min(rng.range(4.5, 8), ww), D = Math.min(rng.range(4.5, 8), dd); return { w: W, d: D, tiers: [{ w: W, d: D, ox: 0, oz: 0, floors: fl, facade: nm === 'delhi' ? 'delhi' : 'tropic', fh: 3.0 }], shop: null, tint: jitter(rng.pick([0xf4c7d0, 0xbfe3d4, 0xf7e0a3, 0x9ed3e6, 0xf2b38e, 0xe9e4d8, 0xd8c8a0, 0xc8b8a8]), rng, 0.05), roof: { type: nm === 'delhi' ? 'flat' : 'gi_gable', props: ['tankblack', 'laundry'] }, seed: rng.int(1, 1e9) }; }, [10, 10], 0.75);
  } else if (nm === 'berlin') {
    for (let i = 0; i < Math.round(w * d / 90); i++) treeAt(rng.range(cy.x0 + 2, cy.x1 - 2), rng.range(cy.z0 + 2, cy.z1 - 2), 0.9);
    if (w > 14 && d > 14) { P.bench(B, cx, cz, rng.range(0, 6), {}); }
  } else if (nm === 'moscow') {
    const wD = Math.min(12, d * 0.4); if (w > 40 && d > 24 && rng.chance(0.8)) { const fl = rng.chance(0.5) ? 5 : 9; const ww = Math.min(w - 8, rng.range(40, 70)); const spec = { w: ww, d: 12, tiers: [{ w: ww, d: 12, ox: 0, oz: 0, floors: fl, facade: 'plattenbau', fh: 2.8 }], shop: null, tint: jitter(rng.pick([0xd8d4cc, 0xcfd2d4, 0xdcd4b8]), rng, 0.04), roof: { type: 'flat', props: ['antenna'] }, seed: rng.int(1, 1e9), x: cx, z: cz - d * 0.12, yaw: 0, y: CURB }; emitBuilding(B, spec, smoothstep(0.1, 0.9, level) * rng.range(0.3, 1), ctx); }
    for (let i = 0; i < Math.round(w * d / 120); i++) treeAt(rng.range(cy.x0 + 2, cy.x1 - 2), rng.range(cy.z0 + 2, cy.z1 - 2), 0.9);
  } else if (nm === 'manhattan' || nm === 'generic') {
    if (w > 10 && d > 10) fill((ww, dd) => { const W = Math.min(ww, rng.range(8, 14)), D = Math.min(dd, rng.range(8, 14)); const fl = rng.int(3, 6); return { w: W, d: D, tiers: [{ w: W, d: D, ox: 0, oz: 0, floors: fl, facade: 'tenement', fh: 3.2 }], shop: null, tint: jitter(0xf0e4e0, rng, 0.05), roof: { type: 'flat', props: ['hvac', 'woodtower'] }, seed: rng.int(1, 1e9) }; }, [14, 14], 0.8);
  } else if (nm === 'suburb') {
    for (let i = 0; i < Math.round(w * d / 150); i++) treeAt(rng.range(cy.x0 + 1, cy.x1 - 1), rng.range(cy.z0 + 1, cy.z1 - 1), 0.9);
  } else if (nm === 'industrial') {
    for (let i = 0; i < Math.round(w * d / 300); i++) { const kind = rng.pick(['silo', 'tank', 'containers', 'containers', 'stack']); const x = rng.range(cy.x0 + 5, cy.x1 - 5), z = rng.range(cy.z0 + 5, cy.z1 - 5); industrialProp(B, kind, x, z, rng); }
  }
}

function industrialProp(B, kind, x, z, rng) {
  if (kind === 'silo') { const r = rng.range(3, 5), h = rng.range(14, 24); for (let k = 0; k < 2; k++) { B.cyl('metal', x + k * (r * 2.1), CURB, z, r, r, h, 14, { col: 0xc4c8c8, flat: false }); B.cyl('metal', x + k * (r * 2.1), CURB + h, z, r, 0.4, 2.2, 14, { col: 0xa8acac }); } B.box('metal', x + r * 1.05, CURB + h + 1.4, z, 0.4, 2.8, 0.4, { col: 0x555 }); }
  else if (kind === 'tank') { const r = rng.range(5, 9); B.cyl('metal', x, CURB, z, r, r, 8, 18, { col: rng.pick([0xd8d8d0, 0xb8c0c4, 0xc8b8a0]) }); B.cyl('metal', x, CURB + 8, z, r + 0.15, r + 0.15, 0.3, 18, { col: 0x9a9ea0 }); }
  else if (kind === 'containers') { const cols = [0xb02a2a, 0x2a58a8, 0x2a8a4a, 0xd8a020, 0xc8c8c0, 0x7a4a2a, 0x2a2a30]; const nx = rng.int(2, 4), nz = rng.int(1, 3), ny = rng.int(1, 3); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (let k = 0; k < ny; k++) { if (k > 0 && rng.chance(0.3)) continue; B.box('metal', x + i * 2.6, CURB + 1.3 + k * 2.6, z + j * 12.6, 2.44, 2.6, 12.2, { col: rng.pick(cols), mpt: 2 }); B.box('metal', x + i * 2.6, CURB + 1.3 + k * 2.6, z + j * 12.6 + 6.12, 2.3, 2.45, 0.06, { col: 0x555 }); } }
  else { const h = rng.range(26, 42); B.cyl('concrete', x, CURB, z, 1.6, 0.9, h, 10, { col: 0xb8a898 }); for (let k = 0; k < 3; k++) B.cyl('plain', x, CURB + h * (0.55 + k * 0.14), z, 1.6 - k * 0.32 + 0.06, 1.6 - k * 0.32 + 0.06, 1.2, 10, { col: 0xc03020, cap: false }); }
}

function basketballCourt(B, cx, cz, yaw, rng, ctx, level) {
  B.push(cx, CURB, cz, yaw); const W = 15, Dd = 28; const roofH = 8.5; // covered court: painted floor, arched GI roof, side walls
  B.quad('g_concrete', [-W / 2 - 1, 0.01, Dd / 2 + 1], [W / 2 + 1, 0.01, Dd / 2 + 1], [W / 2 + 1, 0.01, -Dd / 2 - 1], [-W / 2 - 1, 0.01, -Dd / 2 - 1], [0, 0, 5, 9], rng.pick([0x2a7a5a, 0x2a5aa8, 0xb03a2a, 0x7a7a74]), [0, 1, 0]);
  const L = (x0, z0, x1, z1) => B.quad('paint', [x0, 0.02, z1], [x1, 0.02, z1], [x1, 0.02, z0], [x0, 0.02, z0], [0, 0, 1, 1], 0xe8e8e0, [0, 1, 0]); L(-W / 2, -Dd / 2, W / 2, -Dd / 2 + 0.1); L(-W / 2, Dd / 2 - 0.1, W / 2, Dd / 2); L(-W / 2, -Dd / 2, -W / 2 + 0.1, Dd / 2); L(W / 2 - 0.1, -Dd / 2, W / 2, Dd / 2); L(-W / 2, -0.05, W / 2, 0.05);
  B.cyl('paint', 0, 0.02, 0, 1.8, 1.8, 0.002, 20, { col: 0xe8e8e0, cap: true }); B.cyl('paint', 0, 0.025, 0, 1.7, 1.7, 0.002, 20, { col: 0x2a5aa8, cap: true });
  for (const sz of [-1, 1]) { B.box('metal', 0, 3.05, sz * (Dd / 2 - 0.5), 1.8, 1.05, 0.06, { col: 0xf4f4f0 }); B.cyl('metal', 0, 0, sz * (Dd / 2 + 0.1), 0.08, 0.08, 3.05, 6, { col: 0x555a60 }); }
  // roof trusses + arched sheet
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { const z = -Dd / 2 + 1 + k * (Dd - 2) / 4; B.box('metal', sx * (W / 2 + 0.6), roofH / 2 - 0.5, z, 0.25, roofH, 0.25, { col: 0x4a4e52 }); }
  const arc = (a) => [Math.sin(a) * (W / 2 + 1.4), roofH + Math.cos(a) * 3.0 - 3.0 + 1.8 * (1 - Math.abs(a) / 1.2)];
  const segsA = 8; for (let i = 0; i < segsA; i++) { const a0 = -1.2 + (i / segsA) * 2.4, a1 = -1.2 + ((i + 1) / segsA) * 2.4; const p0 = arc(a0), p1 = arc(a1); B.quad('r_gi', [p0[0], p0[1], Dd / 2 + 1], [p1[0], p1[1], Dd / 2 + 1], [p1[0], p1[1], -Dd / 2 - 1], [p0[0], p0[1], -Dd / 2 - 1], [0, 0, 1, 7], 0xb8bcbc); }
  B.pop();
}

/** create a district. returns {root, update, dispose, bounds, streetAnchors, fireAnchors, setNight, setDamage} */
export function createCityBlock(style = 'generic', opts = {}) {
  const S = STYLES[style] || STYLES.generic;
  const o = { seed: 1, w: S.defaultW, d: S.defaultD, density: 0.8, damage: 0, night: 0, snow: S.snow ?? 0, shadows: true, wet: false, ...opts };
  const layout = layoutBlock(S, o.seed, o.w, o.d, o.density, o.reserve);
  const root = new THREE.Group(); root.name = 'city_' + style; const mats = new MatSet({ snow: o.snow, burning: true });
  let group = null; let level = 0, dseed = 1;
  const api = {
    root, style, layout, fireAnchors: [], streetAnchors: [], bounds: { minX: -o.w / 2, maxX: o.w / 2, minZ: -o.d / 2, maxZ: o.d / 2, w: o.w, d: o.d, h: 0 }, damage: 0, stats: { tris: 0, buckets: 0 },
    update() {}, dispose() { if (group) { root.remove(group); group.traverse((m) => m.geometry && m.geometry.dispose()); } mats.dispose(); },
    setNight(n) { mats.setNight(n); api.night = n; },
    setDamage(lv, sd = 1) { rebuild(lv, sd); return api; },
    mats,
  };
  function rebuild(lv, sd) {
    level = lv; dseed = sd; api.damage = lv;
    if (group) { root.remove(group); group.traverse((m) => m.geometry && m.geometry.dispose()); }
    const { B, ctx, maxH, anchors } = emitBlock(S, layout, o, lv, sd, mats);
    group = meshesFromBuilder(B, mats, { shadows: o.shadows }); group.name = 'cityGeo'; root.add(group);
    api.stats = { tris: B.tris(), buckets: B.buckets.size }; api.bounds.h = maxH; api.fireAnchors = ctx.fires; api.streetAnchors = anchors; root.userData.fireAnchors = ctx.fires;
    for (const [name] of B.buckets) { /* ensure materials exist (already created lazily) */ }
    mats.setNight(mats.night);
  }
  root.userData.city = { style, rebuild: (lv, sd) => rebuild(lv, sd), api }; root.userData.api = api;
  rebuild(o.damage, 1); if (o.night) api.setNight(o.night);
  return api;
}
