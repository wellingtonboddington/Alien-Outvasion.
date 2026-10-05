// Stand-alone objects built from the same Builder/MatSet pipeline: single buildings, streets, furniture, parked cars.
import * as THREE from 'three';
import { RNG, smoothstep, clamp, GLOBAL } from '../../engine/common.js';
import { fbm2 } from '../../engine/proc.js';
import { Builder, rgb, mul, mix, jitter } from './builder.js';
import { MatSet, meshesFromBuilder } from './materials.js';
import { STYLES } from './styles.js';
import { emitBuilding, rubblePile, blob } from './buildings.js';
import { FACADE } from './facades.js';
import { getDecals } from './surfaces.js';
import * as P from './props.js';

const PI = Math.PI;

/** wrap a finished Builder into a standard object {root, update, dispose, setNight, mats, stats} */
export function finishObject(B, mats, o = {}) {
  const root = new THREE.Group(); const g = meshesFromBuilder(B, mats, { shadows: o.shadows !== false }); root.add(g);
  const api = { root, mats, group: g, fireAnchors: o.fires || [], stats: { tris: B.tris(), buckets: B.buckets.size }, update() {}, setNight(n) { mats.setNight(n); }, dispose() { g.traverse((m) => m.geometry && m.geometry.dispose()); mats.dispose(); } };
  root.userData.api = api; root.userData.fireAnchors = api.fireAnchors; return api;
}

// ------------------------------------------------------------------ single building
const KIND_SPEC = {
  tower: (rng, S, o) => ({ tiers: (() => { const fl = o.floors || rng.int(22, 40); const w = o.w || 30, d = o.d || 28; const t = [{ w, d, ox: 0, oz: 0, floors: Math.round(fl * 0.4), facade: 'office' }]; let cw = w, cd = d; for (let i = 0; i < 2; i++) { cw *= 0.8; cd *= 0.8; t.push({ w: cw, d: cd, ox: 0, oz: 0, floors: Math.round(fl * 0.3), facade: 'glass' }); } return t; })(), shop: { facade: 'shop_us', fh: 4.6, sides: ['right', 'left'] }, tint: 0xb4d2e8, roof: { type: 'flat', props: ['hvac', 'bulkhead', 'antenna'], parapetH: 1 }, w: o.w || 30, d: o.d || 28 }),
  glass_tower: (rng, S, o) => ({ tiers: [{ w: o.w || 26, d: o.d || 26, ox: 0, oz: 0, floors: o.floors || 24, facade: 'glass' }], shop: { facade: 'shop_us', fh: 4.6, sides: [] }, tint: 0xa8d0d8, roof: { type: 'flat', props: ['hvac', 'bulkhead'], parapetH: 0.6 }, w: o.w || 26, d: o.d || 26 }),
  midrise: (rng, S, o) => ({ tiers: [{ w: o.w || 22, d: o.d || 16, ox: 0, oz: 0, floors: o.floors || rng.int(6, 10), facade: 'office', fh: 3.4 }], shop: { facade: 'shop_ph', fh: 4, sides: [] }, tint: 0xd8d6d0, roof: { type: 'flat', props: ['hvac', 'antenna', 'tank'] }, w: o.w || 22, d: o.d || 16 }),
  lowrise: (rng, S, o) => ({ tiers: [{ w: o.w || 10, d: o.d || 12, ox: 0, oz: 0, floors: o.floors || rng.int(2, 3), facade: 'tropic', fh: 3.0 }], shop: { facade: 'shop_ph', fh: 3.6, sides: [] }, tint: rng.pick([0xf4c7d0, 0xbfe3d4, 0xf7e0a3, 0x9ed3e6, 0xf2b38e]), roof: { type: 'gi_hip', props: ['antenna'] }, w: o.w || 10, d: o.d || 12 }),
  house: (rng, S, o) => ({ tiers: [{ w: o.w || 10, d: o.d || 9, ox: 0, oz: 0, floors: o.floors || rng.int(1, 2), facade: 'siding', fh: 2.8 }], shop: null, tint: 0xe8e0d0, roof: { type: 'tile_hip', props: ['chimney'], pitch: 0.6, col: 0xe0c8c0 }, w: o.w || 10, d: o.d || 9 }),
  shophouse: (rng, S, o) => ({ tiers: [{ w: o.w || 8, d: o.d || 14, ox: 0, oz: 0, floors: o.floors || rng.int(2, 3), facade: 'tropic', fh: 3.0 }], shop: { facade: 'shop_ph', fh: 3.7, sides: [] }, tint: rng.pick([0xf4c7d0, 0xbfe3d4, 0xf7e0a3, 0x9ed3e6]), roof: { type: 'flat', props: ['tank', 'antenna', 'shanty'] }, w: o.w || 8, d: o.d || 14 }),
  warehouse: (rng, S, o) => ({ tiers: [{ w: o.w || 40, d: o.d || 24, ox: 0, oz: 0, floors: 2, facade: 'industrial', fh: 4.5 }], shop: null, tint: 0xc4c8c8, roof: { type: 'zinc_gable', props: [], pitch: 0.12, col: 0xe8ecf0 }, w: o.w || 40, d: o.d || 24 }),
  tenement: (rng, S, o) => ({ tiers: [{ w: o.w || 16, d: o.d || 22, ox: 0, oz: 0, floors: o.floors || 6, facade: 'tenement', fh: 3.2 }], shop: { facade: 'shop_us', fh: 4.2, sides: [] }, tint: 0xf0e4e0, roof: { type: 'flat', props: ['woodtower', 'hvac'] }, cornice: 0xc0b8a0, w: o.w || 16, d: o.d || 22 }),
  altbau: (rng, S, o) => ({ tiers: [{ w: o.w || 18, d: o.d || 14, ox: 0, oz: 0, floors: o.floors || 5, facade: 'altbau', fh: 3.5 }], shop: { facade: 'shop_eu', fh: 4, sides: [] }, tint: 0xe8e0c8, roof: { type: 'tile_hip', props: ['chimney', 'chimney'], pitch: 0.9, dormers: 3 }, cornice: 0xf0ead8, w: o.w || 18, d: o.d || 14 }),
  stalin: (rng, S, o) => ({ tiers: [{ w: o.w || 34, d: o.d || 22, ox: 0, oz: 0, floors: o.floors || 9, facade: 'stalin', fh: 3.8 }, { w: 18, d: 14, ox: 0, oz: 0, floors: 5, facade: 'stalin', fh: 3.8 }, { w: 9, d: 8, ox: 0, oz: 0, floors: 4, facade: 'stalin', fh: 3.8 }], shop: null, tint: 0xe2d4ae, roof: { type: 'spire', h: 28, col: 0x6fb09a }, cornice: 0xe8dcc0, w: o.w || 34, d: o.d || 22 }),
  plattenbau: (rng, S, o) => ({ tiers: [{ w: o.w || 60, d: o.d || 12, ox: 0, oz: 0, floors: o.floors || 9, facade: 'plattenbau', fh: 2.8 }], shop: null, tint: 0xd4d0c8, roof: { type: 'flat', props: ['antenna', 'bulkhead'] }, w: o.w || 60, d: o.d || 12 }),
  deco: (rng, S, o) => ({ tiers: [{ w: 30, d: 30, ox: 0, oz: 0, floors: 14, facade: 'deco', fh: 4 }, { w: 22, d: 22, ox: 0, oz: 0, floors: 12, facade: 'deco', fh: 4 }, { w: 14, d: 14, ox: 0, oz: 0, floors: 10, facade: 'deco', fh: 4 }, { w: 8, d: 8, ox: 0, oz: 0, floors: 6, facade: 'deco', fh: 4 }], shop: { facade: 'shop_us', fh: 5, sides: ['right', 'left'] }, tint: 0xd8d0bc, roof: { type: 'spire', h: 34, col: 0xc4ccd0 }, cornice: 0xcfc6b0, w: 30, d: 30 }),
};
const KIND_STYLE = { tower: 'cebu', glass_tower: 'cebu', midrise: 'cebu', lowrise: 'dumaguete', house: 'suburb', shophouse: 'dumaguete', warehouse: 'industrial', tenement: 'manhattan', altbau: 'berlin', stalin: 'moscow', plattenbau: 'moscow', deco: 'manhattan' };

/** createBuilding(kind, {style, seed, floors, w, d, damage, night, snow}) kinds: tower|glass_tower|midrise|lowrise|house|shophouse|warehouse|tenement|altbau|stalin|plattenbau|deco */
export function createBuilding(kind = 'midrise', opts = {}) {
  const sName = opts.style || KIND_STYLE[kind] || 'generic'; const S = STYLES[sName] || STYLES.generic; const rng = new RNG((opts.seed || 1) * 31 + 7);
  const mk = KIND_SPEC[kind] || KIND_SPEC.midrise; const spec = mk(rng, S, opts); spec.seed = rng.int(1, 1e9); spec.x = 0; spec.z = 0; spec.yaw = 0; spec.y = 0; if (opts.tint != null) spec.tint = opts.tint;
  const mats = new MatSet({ burning: true }); let api; const state = { damage: opts.damage || 0 };
  function build(dmg) {
    const B = new Builder(); const ctx = { S, snow: opts.snow || 0, fires: [], night: 0, fireBoost: opts.fireBoost || 1 };
    const info = emitBuilding(B, spec, dmg, ctx); B.quad('g_concrete', [-spec.w / 2 - 3, 0.01, spec.d / 2 + 3], [spec.w / 2 + 3, 0.01, spec.d / 2 + 3], [spec.w / 2 + 3, 0.01, -spec.d / 2 - 3], [-spec.w / 2 - 3, 0.01, -spec.d / 2 - 3], [0, 0, 5, 5], 0xb0aca4, [0, 1, 0]);
    return { B, ctx, info };
  }
  const first = build(state.damage); api = finishObject(first.B, mats, { shadows: opts.shadows, fires: first.ctx.fires });
  api.bounds = { w: spec.w, d: spec.d, h: first.info.top }; api.spec = spec; api.top = first.info.top;
  api.setDamage = (dmg) => { api.group.traverse((m) => m.geometry && m.geometry.dispose()); api.root.remove(api.group); const r = build(dmg); const n = finishObject(r.B, mats, { shadows: opts.shadows, fires: r.ctx.fires }); api.group = n.group; api.root.add(api.group); api.fireAnchors = r.ctx.fires; api.root.userData.fireAnchors = api.fireAnchors; api.bounds.h = r.info.top; mats.setNight(mats.night); return api; };
  if (opts.night) api.setNight(opts.night);
  return api;
}

// ------------------------------------------------------------------ street
/** A straight street along Z (centred on origin, from z=-len/2 to len/2), road width opts.width, sidewalks, markings, furniture, optional building rows.
 * opts: {style, width, sidewalk, seed, buildings:true, trees:true, cars:true, lamps:true, damage:0..1, barricades:0..1, checkpoint:false, tents:0, sandbags:0, wet:false, snow:0} */
export function createStreet(len = 80, opts = {}) {
  const mats = new MatSet({ burning: true }); const first = buildStreet(len, opts, opts.damage || 0, mats);
  const api = finishObject(first.B, mats, { shadows: opts.shadows, fires: first.ctx.fires }); api.streetAnchors = first.anchors; api.bounds = first.bounds;
  api.setDamage = (lv) => { api.group.traverse((m) => m.geometry && m.geometry.dispose()); api.root.remove(api.group); const r = buildStreet(len, opts, lv, mats); const n = finishObject(r.B, mats, { shadows: opts.shadows, fires: r.ctx.fires }); api.group = n.group; api.root.add(api.group); api.fireAnchors = r.ctx.fires; api.root.userData.fireAnchors = api.fireAnchors; api.streetAnchors = r.anchors; mats.setNight(mats.night); return api; };
  if (opts.night) api.setNight(opts.night); return api;
}
function buildStreet(len, opts, level, mats) {
  const S = STYLES[opts.style || 'generic'] || STYLES.generic; const rng = new RNG((opts.seed || 1) * 977 + 13); const B = new Builder(); const ctx = { S, snow: opts.snow || 0, fires: [], night: 0 };
  const rw = opts.width || S.roadW; const sw = opts.sidewalk ?? S.sidewalk; const snow = (opts.snow || 0) > 0.4; const parkW = S.parkLane || 0; const CURB = 0.15;
  const anchors = []; const decals = getDecals();
  const sideMat = snow ? 'g_snow' : (S.name === 'berlin' || S.name === 'moscow' ? 'g_paving' : 'g_sidewalk'); const tileOf = (m) => ({ g_sidewalk: 4.8, g_paving: 4, g_snow: 6 })[m] || 4;
  const halfL = len / 2;
  // road (lies along Z)
  B.quad('g_asphalt', [-rw / 2, 0, halfL], [rw / 2, 0, halfL], [rw / 2, 0, -halfL], [-rw / 2, 0, -halfL], [-rw / 2 / 8, halfL / 8, rw / 2 / 8, -halfL / 8], snow ? 0x9a9ca0 : 0xffffff, [0, 1, 0]);
  for (const sg of [-1, 1]) { // sidewalks + kerbs
    const x0 = sg * rw / 2, x1 = sg * (rw / 2 + sw), xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    B.quad(sideMat, [xa, CURB, halfL], [xb, CURB, halfL], [xb, CURB, -halfL], [xa, CURB, -halfL], [xa / tileOf(sideMat), halfL / tileOf(sideMat), xb / tileOf(sideMat), -halfL / tileOf(sideMat)], snow ? 0xf4f6f8 : 0xffffff, [0, 1, 0]);
    { const zA = sg > 0 ? -halfL : halfL, zB = -zA; B.quad('g_concrete', [x0, 0, zA], [x0, 0, zB], [x0, CURB, zB], [x0, CURB, zA], [0, 0, len / 4, 0.04], 0xdcd8d0, [-sg, 0, 0]); }
    // ground behind the sidewalk
    const gx0 = sg * (rw / 2 + sw), gx1 = sg * (rw / 2 + sw + 40); B.quad(S.groundInner === 'g_grass' || snow ? (snow ? 'g_snow' : 'g_grass') : 'g_dirt', [Math.min(gx0, gx1), CURB - 0.01, halfL], [Math.max(gx0, gx1), CURB - 0.01, halfL], [Math.max(gx0, gx1), CURB - 0.01, -halfL], [Math.min(gx0, gx1), CURB - 0.01, -halfL], [0, 0, 7, len / 6], snow ? 0xf4f6f8 : 0xffffff, [0, 1, 0]);
  }
  // markings
  if (!snow || (opts.snow || 0) < 0.9) {
    const W = (x0, z0, x1, z1, col = 0xe8e8e0) => B.quad('paint', [x0, 0.012, z1], [x1, 0.012, z1], [x1, 0.012, z0], [x0, 0.012, z0], [x0 / 4, z1 / 4, x1 / 4, z0 / 4], col, [0, 1, 0]);
    const yel = S.markings === 'us' || S.markings === 'ph'; const col = yel ? 0xd8b020 : 0xe6e6de;
    if (S.markings === 'eu' || S.markings === 'in') { for (let z = -halfL; z < halfL; z += 9) W(-0.07, z, 0.07, z + 3, 0xe6e6de); } else { W(-0.22, -halfL, -0.1, halfL, col); W(0.1, -halfL, 0.22, halfL, col); }
    const lane = rw / 2 - parkW; for (const sg of [-1, 1]) W(sg * (rw / 2 - parkW - 0.15) - 0.06, -halfL, sg * (rw / 2 - parkW - 0.15) + 0.06, halfL, 0xe6e6de);
    if (rw > 11) for (const sg of [-1, 1]) for (let z = -halfL; z < halfL; z += 9) W(sg * lane / 2 - 0.06, z, sg * lane / 2 + 0.06, z + 3, 0xe6e6de);
  }
  // decals (wet, oil, cracks)
  const nDec = Math.round(len / 4 * (0.6 + level)); for (let i = 0; i < nDec; i++) { const kd = rng.pick(opts.wet ? [0, 0, 0, 1, 2] : [0, 1, 2, 2, 3]); if (kd === 0 && !opts.wet && rng.chance(0.6)) continue; const sc = rng.range(0.7, 2.8); const cx = rng.range(-rw / 2 + 1, rw / 2 - 1), cz = rng.range(-halfL, halfL); const c = Math.cos(rng.range(0, PI)), s = Math.sin(rng.range(0, PI)); const dark = kd === 0 ? (opts.wet ? [0.2, 0.22, 0.26] : [0.05, 0.055, 0.06]) : [0.02, 0.02, 0.02]; const Pp = (u, v) => [cx + u * c - v * s, 0.02, cz + u * s + v * c]; B.quad('decal', Pp(-sc * 1.4, sc), Pp(sc * 1.4, sc), Pp(sc * 1.4, -sc), Pp(-sc * 1.4, -sc), decals.cell(kd === 0 ? 0 : kd === 1 ? 1 : kd === 2 ? 2 : 3), dark, [0, 1, 0]); }
  for (let z = -halfL + 10; z < halfL; z += rng.range(30, 50)) P.manhole(B, rng.range(-rw / 4, rw / 4), z);
  // building rows
  if (opts.buildings !== false) {
    for (const sg of [-1, 1]) {
      let z = -halfL; const D = rng.range(S.ringDepth[0], S.ringDepth[1]);
      while (z < halfL - 4) {
        let lw = rng.range(S.lotW[0], S.lotW[1]); if (halfL - z - lw < S.lotW[0] * 0.7) lw = halfL - z; const ld = D * rng.range(0.88, 1.0);
        const lot = { id: Math.round((z + 500) * 7 + sg), edge: true, corner: false, side: sg > 0 ? 'right' : 'left', w: lw, d: ld };
        const lr = new RNG((opts.seed || 1) * 7919 + lot.id * 104729 + 3); const spec = S.spec(lr, lot, { density: opts.density ?? 0.8 }); z += lw; if (!spec) continue;
        const xFront = sg * (rw / 2 + sw); const setb = spec.setback ?? (spec.inset ? lr.range(5, 8) : 0);
        spec.x = xFront + sg * (setb + spec.d / 2); spec.z = z - lw / 2; spec.yaw = sg > 0 ? PI / 2 : -PI / 2; spec.y = CURB;
        const thr = clamp(fbm2(spec.z * 0.02 + 3, sg * 4.1, 3) * 0.75 + lr.next() * 0.25, 0, 1); const a = thr * 0.6; const dm = level > 0.001 ? smoothstep(a, a + 0.45, level) : 0;
        emitBuilding(B, spec, dm, ctx);
      }
    }
  }
  // furniture
  const wantTrees = opts.trees !== false; const lampSp = S.lamp === 'ornate' ? 22 : 28; const burn = smoothstep(0.35, 0.9, level);
  for (const sg of [-1, 1]) {
    const yawS = sg > 0 ? -PI / 2 : PI / 2; const xk = sg * (rw / 2);
    if (opts.lamps !== false) for (let z = -halfL + 5 + rng.range(0, 6); z < halfL - 3; z += lampSp * rng.range(0.9, 1.1)) { const tilt = level > 0.55 && rng.chance(burn * 0.35); B.push(xk + sg * 0.7, CURB, z, yawS); if (tilt) B.push(0, 0, 0, 0, 1, 1, 1, 0.15 + rng.range(0, 0.9), 0); P.lampPost(B, 0, 0, 0, { style: S.lamp === 'ornate' ? 'ornate' : 'modern', h: S.lamp === 'ornate' ? 5.2 : 8, arm: 1.8 }); if (tilt) B.pop(); B.pop(); anchors.push({ pos: [xk + sg * 0.7, CURB, z], yaw: yawS, kind: 'lamp' }); }
    if (wantTrees && S.treeSpacing < 100) for (let z = -halfL + 8 + rng.range(0, 4); z < halfL - 3; z += S.treeSpacing * rng.range(0.85, 1.2)) { const k = rng.pick(S.tree); const dead = level > 0.55 && rng.chance(burn * 0.7); P.tree(B, dead ? 'bare' : k, xk + sg * sw * 0.6, z, rng.range(0.85, 1.2), rng.int(1, 9999), { snow: snow ? 1 : 0, bare: dead || (snow && (k === 'plane' || k === 'linden' || k === 'birch')), y: CURB }); }
    if (S.poles) for (let z = -halfL + 6, prev = null; z < halfL; z += 22 * rng.range(0.9, 1.1)) { const px = xk + sg * 0.5; P.utilityPole(B, px, z, PI / 2, { transformer: rng.chance(0.2), clutter: true, h: 9.5 }); if (prev !== null && S.wires) for (let wk = 0; wk < 5; wk++) { const dy = 9.0 - (wk % 2) * 0.7; const o2 = (wk - 2) * 0.32; B.wire([px + o2, dy, prev], [px + o2, dy - 0.1, z], 0.5 + rng.range(0, 0.4), 8, 0x101010); } prev = z; }
    if (opts.props !== false) { for (let z = -halfL + 10; z < halfL - 5; z += rng.range(18, 40)) { const r = rng.next(); const px = xk + sg * 1.1; if (r < 0.35) P.bench(B, px + sg * 0.4, z, yawS); else if (r < 0.55) P.trashBin(B, px, z, yawS); else if (r < 0.7) P.hydrant(B, xk + sg * 0.5, z); else if (r < 0.85) P.signPost(B, xk + sg * 0.5, z, yawS, rng.pick(['blue', 'yellow', 'green'])); else P.bollard(B, xk + sg * 0.5, z); } }
    if (opts.cars !== false && parkW > 0) for (let z = -halfL + 6; z < halfL - 6;) { if (rng.chance(S.carsDensity)) { const shape = rng.pick(S.cars); const lenC = shape === 'jeepney' ? 6.3 : shape === 'truck' ? 7.5 : shape === 'tricycle' ? 2.8 : 4.6; const burnt = level > 0.4 ? clamp((level - 0.3) * 1.3 * rng.range(0.4, 1.4), 0, 1) * (rng.chance(0.6) ? 1 : 0.3) : 0; const col = shape === 'taxi' ? 0xf2c230 : shape === 'jeepney' ? rng.pick([0xc8302a, 0x2a5ac8, 0x2a9a5a, 0xe8e0d0]) : rng.pick(P.PALETTE.carBody); P.car(B, shape, sg * (rw / 2 - parkW * 0.5 - 0.1), z + lenC / 2, rng.chance(0.5) ? 0 : PI, col, { wreck: burnt, col2: rng.pick([0xf2c230, 0xe84a2a, 0x2a9ae8]) }); if (burnt > 0.55 && ctx.fires.length < 40) ctx.fires.push(new THREE.Vector3(sg * (rw / 2 - parkW * 0.5), 1.0, z + lenC / 2)); z += lenC + rng.range(0.4, 3); } else z += rng.range(3, 7); }
  }
  // set pieces
  const midZ = opts.checkpointZ ?? 0;
  if (opts.checkpoint) P.checkpoint(B, 0, midZ, 0, rng);
  const nbar = Math.round((opts.barricades || 0) * 6); for (let i = 0; i < nbar; i++) { const z = rng.range(-halfL + 8, halfL - 8); P.barricade(B, rng.range(-rw / 2 + 1.5, rw / 2 - 1.5), z, rng.range(-0.4, 0.4) + (rng.chance(0.5) ? PI / 2 : 0), rng.pick(['jersey', 'hbar', 'hedgehog', 'jersey'])); }
  for (let i = 0; i < (opts.sandbags || 0); i++) { P.sandbags(B, rng.range(-rw / 2 + 2, rw / 2 - 2), rng.range(-halfL + 6, halfL - 6), rng.range(-0.3, 0.3) + (i % 2 ? PI / 2 : 0), rng.range(3, 6), rng.int(2, 4), rng); }
  for (let i = 0; i < (opts.tents || 0); i++) { const sg = i % 2 ? 1 : -1; P.tent(B, sg * (rw / 2 + sw + 6 + rng.range(0, 6)), rng.range(-halfL + 6, halfL - 6), rng.range(-0.3, 0.3), { col: rng.pick([0x6a7048, 0x7a7a60, 0xc8c0a0]) }); }
  if (level > 0.3) for (let i = 0; i < Math.round(level * 8); i++) rubblePile(B, rng.range(-rw / 2, rw / 2), rng.range(-halfL, halfL), rng.range(2, 5), rng.range(2, 5), Math.round(level * 40), rng, 0xb0aca0, { height: 0.9 });
  for (let z = -halfL + 20; z < halfL - 10; z += 40) anchors.push({ pos: [-rw / 4, 0, z], yaw: 0, kind: 'lane' }, { pos: [rw / 4, 0, z], yaw: PI, kind: 'lane' }, { pos: [rw / 2 + sw / 2, CURB, z], yaw: 0, kind: 'sidewalk' }, { pos: [-rw / 2 - sw / 2, CURB, z], yaw: 0, kind: 'sidewalk' });
  return { B, ctx, anchors, bounds: { w: rw + 2 * sw, d: len, minZ: -halfL, maxZ: halfL, roadWidth: rw, sidewalk: sw } };
}

// ------------------------------------------------------------------ street furniture factories (each returns {root, update, dispose, ...})
const single = (fn, o = {}) => { const B = new Builder(); fn(B); const mats = new MatSet({ burning: true }); const api = finishObject(B, mats, o); return api; };
export const createLampPost = (o = {}) => single((B) => P.lampPost(B, 0, 0, 0, { style: o.style, h: o.h, arm: o.arm }));
export const createUtilityPole = (o = {}) => single((B) => P.utilityPole(B, 0, 0, 0, { transformer: o.transformer ?? true, clutter: true, h: o.h ?? 9.5 }));
export const createTrafficLight = (o = {}) => single((B) => P.trafficLight(B, 0, 0, 0, o));
export const createBench = (o = {}) => single((B) => (o.concrete ? P.concreteBench(B, 0, 0, 0) : P.bench(B, 0, 0, 0, o)));
export const createBollard = () => single((B) => P.bollard(B, 0, 0));
export const createSign = (kind = 'blue') => single((B) => P.signPost(B, 0, 0, 0, kind));
export const createBarricade = (kind = 'jersey', o = {}) => single((B) => P.barricade(B, 0, 0, 0, kind, o));
export const createSandbagWall = (len = 5, rows = 3, seed = 1) => single((B) => P.sandbags(B, 0, 0, 0, len, rows, new RNG(seed)));
export const createTent = (o = {}) => single((B) => P.tent(B, 0, 0, 0, o));
export const createCheckpoint = (seed = 1) => single((B) => P.checkpoint(B, 0, 0, 0, new RNG(seed)));
export const createKiosk = (o = {}) => single((B) => P.kiosk(B, 0, 0, 0, o));
export const createBusShelter = (o = {}) => single((B) => P.busShelter(B, 0, 0, 0, o));
export function createTree(kind = 'raintree', o = {}) { return single((B) => P.tree(B, kind, 0, 0, o.scale || 1, o.seed || 1, { snow: o.snow, bare: o.bare })); }
/** cheap parked-car group. list: [{shape, x, z, yaw, color}] or count (random along a line). shape: sedan|hatch|suv|van|pickup|taxi|police|jeepney|tricycle|bus|truck */
export function createParkedCars(list = 8, o = {}) {
  const rng = new RNG((o.seed || 1) * 17 + 3); const B = new Builder(); const shapes = o.shapes || ['sedan', 'hatch', 'suv', 'van', 'pickup', 'taxi']; const arr = Array.isArray(list) ? list : Array.from({ length: list }, (_, i) => ({ shape: rng.pick(shapes), x: 0, z: i * 6, yaw: 0 }));
  for (const c of arr) P.car(B, c.shape || 'sedan', c.x || 0, c.z || 0, c.yaw || 0, c.color ?? (c.shape === 'taxi' ? 0xf2c230 : rng.pick(P.PALETTE.carBody)), { wreck: c.wreck || o.wreck || 0, col2: c.col2, col3: c.col3 });
  return finishObject(B, new MatSet({ burning: true }), {});
}
