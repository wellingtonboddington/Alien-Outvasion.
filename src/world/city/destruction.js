// Destruction props & damaged variants: damageCity, createRuins, createRubble (instanced), createCrater, createBurningBuilding,
// createWreck (car|bus|jet|tank|alien_pod|tripod_leg), collapsed overpass, toppled bridge segment.
import * as THREE from 'three';
import { RNG, smoothstep, clamp } from '../../engine/common.js';
import { fbm2 } from '../../engine/proc.js';
import { Builder, rgb, mul, mix, jitter } from './builder.js';
import { MatSet } from './materials.js';
import { STYLES } from './styles.js';
import { emitBuilding, rubblePile, blob } from './buildings.js';
import { createBuilding, finishObject } from './objects.js';
import { getGround, getDecals } from './surfaces.js';
import * as P from './props.js';

const PI = Math.PI;

/** crossed flame quads (animated in shader). col = [phase, intensity, 0] */
export function flames(B, x, y, z, w, h, rng, n = 2) {
  for (let k = 0; k < n; k++) { const a = rng.range(0, PI) + k * PI / n; const fx = Math.cos(a) * w / 2, fz = Math.sin(a) * w / 2; B.quad('fire', [x - fx, y, z - fz], [x + fx, y, z + fz], [x + fx * 0.8, y + h, z + fz * 0.8], [x - fx * 0.8, y + h, z - fz * 0.8], [0, 0, 1, 1], [rng.next(), rng.range(0.9, 1.3), 0]); }
}
const embers = (B, x, y, z, w, rng) => B.box('ember', x, y, z, w, 0.1, w, { col: [rng.next(), 1, 0] });

// ------------------------------------------------------------------ damageCity
/** damageCity(rootOrBlock, level01, seed): rebuilds a block/street/building to a damage level (broken windows, soot, fires, collapsed corners, rubble).
 *  Works on createCityBlock / createStreet / createBuilding results (or their .root). Anything else gets a scorch tint. Returns the api object. */
export function damageCity(target, level = 0, seed = 1) {
  const root = target.root || target; const api = target.root ? target : (root.userData && root.userData.api);
  const ctl = root.userData && root.userData.city;
  if (api && api.setDamage) { api.setDamage(level, seed); return api; }
  if (ctl && ctl.rebuild) { ctl.rebuild(level, seed); return ctl.api || api; }
  // generic fallback: scorch tint + stash level
  root.traverse((o) => { const m = o.material; if (!m || m.userData.shared) return; for (const mm of Array.isArray(m) ? m : [m]) { if (mm.color && !mm.isShaderMaterial && !mm.isMeshBasicMaterial) { if (!mm.userData._c0) mm.userData._c0 = mm.color.clone(); mm.color.copy(mm.userData._c0).multiplyScalar(1 - 0.65 * level); } } });
  root.userData.damage = level; return api || { root };
}

// ------------------------------------------------------------------ rubble (instanced)
let _chunkGeo = null, _slabGeo = null, _rebarGeo = null;
function chunkGeos() {
  if (_chunkGeo) return;
  const r = new RNG(77); const ico = new THREE.IcosahedronGeometry(1, 0); const pos = ico.attributes.position; const map = new Map();
  for (let i = 0; i < pos.count; i++) { const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`; if (!map.has(k)) map.set(k, r.range(0.55, 1.1)); const s = map.get(k); pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s * 0.7, pos.getZ(i) * s); }
  _chunkGeo = ico.toNonIndexed(); _chunkGeo.computeVertexNormals(); const n = _chunkGeo.attributes.position.count; const uv = new Float32Array(n * 2); const p = _chunkGeo.attributes.position; for (let i = 0; i < n; i++) { uv[i * 2] = p.getX(i) * 0.8 + p.getZ(i) * 0.3; uv[i * 2 + 1] = p.getY(i) * 0.8 + p.getZ(i) * 0.5; } _chunkGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); _chunkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); _chunkGeo.userData.shared = true;
  _slabGeo = new THREE.BoxGeometry(1, 0.18, 1); _slabGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(_slabGeo.attributes.position.count * 3).fill(1), 3)); _slabGeo.userData.shared = true;
  _rebarGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 4, 1, true); _rebarGeo.translate(0, 0.5, 0); _rebarGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(_rebarGeo.attributes.position.count * 3).fill(1), 3)); _rebarGeo.userData.shared = true;
}
/** createRubble({radius=6, count=140, height=2, seed, kind:'concrete'|'brick'|'mixed', rebar=true, area:[w,d]}) -> {root,count,update,dispose,fireAnchors}  (3 instanced draw calls) */
export function createRubble(o = {}) {
  chunkGeos(); const rng = new RNG((o.seed || 1) * 313 + 9); const R = o.radius ?? 6; const [aw, ad] = o.area || [R * 2, R * 2]; const n = o.count ?? Math.round(40 + R * R * 3); const height = o.height ?? Math.min(R * 0.35, 3);
  const mats = new MatSet({}); const root = new THREE.Group(); root.name = 'rubble';
  const chunks = new THREE.InstancedMesh(_chunkGeo, mats.get('rubble'), n); const nSlab = Math.round(n * 0.12); const slabs = new THREE.InstancedMesh(_slabGeo, mats.get('rubble'), nSlab); const nReb = o.rebar === false ? 0 : Math.round(n * 0.3); const rebar = new THREE.InstancedMesh(_rebarGeo, mats.get('metal'), Math.max(1, nReb));
  const pals = o.kind === 'brick' ? [0x8d4a38, 0x7a3a2c, 0x9a5a44, 0x6a6762] : [0x8a8780, 0x9c9890, 0x76736e, 0xaaa69c, 0x6a6762, 0x8d4a38];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(); const col = new THREE.Color();
  const place = (mesh, i, big) => { const a = rng.range(0, PI * 2), r = Math.pow(rng.next(), 0.7); const x = Math.cos(a) * r * aw / 2, z = Math.sin(a) * r * ad / 2; const hill = Math.max(0, 1 - r * r); const sz = big ? rng.range(0.5, 1.5) : rng.range(0.15, 0.55); const y = hill * height * rng.range(0.4, 1.0) + sz * 0.15; e.set(rng.range(-0.6, 0.6), rng.range(0, PI * 2), rng.range(-0.6, 0.6)); q.setFromEuler(e); p.set(x, y, z); return { sz, q, p }; };
  for (let i = 0; i < n; i++) { const big = rng.chance(0.15); const { sz } = place(chunks, i, big); s.set(sz * rng.range(0.8, 1.5), sz * rng.range(0.6, 1.1), sz * rng.range(0.8, 1.4)); m.compose(p, q, s); chunks.setMatrixAt(i, m); col.setHex(rng.pick(pals)).multiplyScalar(rng.range(0.85, 1.15)); chunks.setColorAt(i, col); }
  for (let i = 0; i < nSlab; i++) { const { sz } = place(slabs, i, true); s.set(sz * rng.range(1.5, 3), 1, sz * rng.range(1.2, 2.6)); m.compose(p, q, s); slabs.setMatrixAt(i, m); col.setHex(0x8f8c86).multiplyScalar(rng.range(0.8, 1.1)); slabs.setColorAt(i, col); }
  for (let i = 0; i < nReb; i++) { place(rebar, i, false); s.set(1, rng.range(0.6, 2.4), 1); m.compose(p, q, s); rebar.setMatrixAt(i, m); col.setHex(0x5a3422); rebar.setColorAt(i, col); }
  if (!nReb) rebar.count = 0; chunks.castShadow = slabs.castShadow = true; chunks.receiveShadow = slabs.receiveShadow = true; rebar.castShadow = false;
  chunks.instanceMatrix.needsUpdate = true; for (const mm of [chunks, slabs, rebar]) { mm.frustumCulled = false; root.add(mm); }
  const fire = []; if (o.fire) { const B = new Builder(); for (let i = 0; i < o.fire; i++) { const x = rng.range(-R, R) * 0.5, z = rng.range(-R, R) * 0.5; flames(B, x, height * 0.7, z, 1.6, 3.0, rng); fire.push(new THREE.Vector3(x, height * 0.9, z)); } const geos = B.build(); for (const [name, g] of geos) { const mm = new THREE.Mesh(g, mats.get(name)); mm.renderOrder = 2; root.add(mm); } }
  return { root, count: n, update() {}, setNight() {}, fireAnchors: fire, dispose() { mats.dispose(); root.traverse((x) => { if (x.geometry && !x.geometry.userData.shared) x.geometry.dispose(); }); } };
}

// ------------------------------------------------------------------ crater
/** createCrater({radius=8, depth=2.5, seed, glow=false, fire=0, rubble=true}) -> {root,update,dispose,heightAt(x,z),fireAnchors} */
export function createCrater(o = {}) {
  const R = o.radius ?? 8, D = o.depth ?? 2.5; const rng = new RNG((o.seed || 1) * 71 + 5); const mats = new MatSet({}); const B = new Builder();
  const NR = 22, NA = 56; const outer = R * 2.4; const hAt = (x, z) => { const r = Math.hypot(x, z); const a = Math.atan2(z, x); const ir = R * (1 + 0.14 * (fbm2(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 3, 3) - 0.5)); const t = r / ir; let h; if (t < 1) h = -D * (1 - Math.pow(t, 2.2)) + D * 0.15 * (fbm2(x * 0.5, z * 0.5, 3) - 0.5); else h = D * 0.32 * Math.exp(-Math.pow((t - 1.12) / 0.38, 2)) * (0.7 + 0.6 * fbm2(x * 0.3 + 9, z * 0.3, 3)) * (1 - smoothstep(1.4, 2.4, t)); return h; };
  const pos = [], nor = [], col = [], uv = [], idx = [];
  for (let i = 0; i <= NR; i++) { const t = i / NR; const rr = (Math.pow(t, 1.15)) * outer; for (let j = 0; j <= NA; j++) { const a = (j / NA) * PI * 2; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; const h = hAt(x, z); pos.push(x, h, z); uv.push(x / 6, z / 6); const k = rr / R; const scorch = 1 - smoothstep(0.7, 2.2, k); const base = [0.5, 0.42, 0.32]; const c = mix(base, [0.03, 0.028, 0.026], clamp(scorch * 1.1 - 0.1 * fbm2(x * 0.4, z * 0.4, 2), 0, 1)); col.push(...c); } }
  const g = (ii, jj) => { const i = clamp(ii, 0, NR), j = ((jj % (NA + 1)) + NA + 1) % (NA + 1); const k = (i * (NA + 1) + j) * 3; return [pos[k], pos[k + 1], pos[k + 2]]; };
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NA; j++) { const a = g(i + 1, j), b = g(i - 1, j), c = g(i, j + 1), d = g(i, j - 1); const t1 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], t2 = [c[0] - d[0], c[1] - d[1], c[2] - d[2]]; let n = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]]; const l = Math.hypot(...n) || 1; n = n.map((v) => v / l); if (n[1] < 0) n = n.map((v) => -v); nor.push(...n); }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const ia = idx[0] * 3, ib = idx[1] * 3, ic = idx[2] * 3; const e1 = [pos[ib] - pos[ia], pos[ib + 1] - pos[ia + 1], pos[ib + 2] - pos[ia + 2]], e2 = [pos[ic] - pos[ia], pos[ic + 1] - pos[ia + 1], pos[ic + 2] - pos[ia + 2]]; if (e1[2] * e2[0] - e1[0] * e2[2] < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } geo.setIndex(idx);
  B.geometry('g_dirt', geo, 0xffffff); geo.dispose();
  // scorch decals + rim rocks + debris
  const dec = getDecals(); for (let k = 0; k < 3; k++) { const rr = R * rng.range(2.2, 3.2), a0 = rng.range(0, PI); const c = Math.cos(a0), s = Math.sin(a0); const P0 = (u, v) => [u * c - v * s, 0.06, u * s + v * c]; B.quad('decal', P0(-rr, rr), P0(rr, rr), P0(rr, -rr), P0(-rr, -rr), dec.cell(3), [0.01, 0.01, 0.01], [0, 1, 0]); }
  const fires = []; if (o.rubble !== false) rubblePile(B, 0, 0, R * 1.5, R * 1.5, Math.round(R * 7), rng, 0x9a9488, { height: 0.4, scale: 1.4 });
  for (let i = 0; i < Math.round(R * 2.2); i++) { const a = rng.range(0, PI * 2), r = R * rng.range(1.05, 1.5); const x = Math.cos(a) * r, z = Math.sin(a) * r; B.push(x, hAt(x, z) + 0.1, z, rng.range(0, PI * 2)); blob(B, 'rubble', rng.range(0.3, 1.1), rng, jitter(0x5a5650, rng, 0.2)); B.pop(); }
  if (o.glow) { B.cyl('ember', 0, -D + 0.12, 0, R * 0.35, R * 0.3, 0.05, 20, { col: [0.3, 1, 0] }); fires.push(new THREE.Vector3(0, -D + 0.6, 0)); }
  const nf = o.fire ?? 0; for (let i = 0; i < nf; i++) { const a = rng.range(0, PI * 2), r = R * rng.range(0.1, 0.7); const x = Math.cos(a) * r, z = Math.sin(a) * r; flames(B, x, hAt(x, z), z, 1.8, 3.4, rng); fires.push(new THREE.Vector3(x, hAt(x, z) + 1, z)); }
  const api = finishObject(B, mats, { fires }); api.heightAt = hAt; api.radius = R; return api;
}

// ------------------------------------------------------------------ ruins & burning building
/** createRuins({style='generic', w=60, d=60, seed, level=0.97, count=4, fires=true}) -> a cluster of collapsed buildings with rubble fields */
export function createRuins(o = {}) {
  const S = STYLES[o.style || 'generic'] || STYLES.generic; const rng = new RNG((o.seed || 1) * 53 + 3); const B = new Builder(); const mats = new MatSet({ burning: true }); const ctx = { S, snow: o.snow || 0, fires: [], night: 0, fireBoost: o.fires === false ? 0.1 : 1.6 };
  const w = o.w ?? 60, d = o.d ?? 60; const n = o.count ?? 4; const lvl = o.level ?? 0.97;
  B.quad('g_dirt', [-w / 2 - 8, 0.01, d / 2 + 8], [w / 2 + 8, 0.01, d / 2 + 8], [w / 2 + 8, 0.01, -d / 2 - 8], [-w / 2 - 8, 0.01, -d / 2 - 8], [0, 0, w / 6, d / 6], 0x9a9488, [0, 1, 0]);
  const cols = Math.ceil(Math.sqrt(n)); const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + ((i % cols) + 0.5) * w / cols, cz = -d / 2 + (Math.floor(i / cols) + 0.5) * d / rows; const lr = new RNG((o.seed || 1) * 7919 + i * 104729);
    const lot = { id: i, edge: true, corner: false, side: 'top', w: Math.min(w / cols - 4, lr.range(S.lotW[0], S.lotW[1] * 1.3)), d: Math.min(d / rows - 4, lr.range(S.ringDepth[0], S.ringDepth[1])) }; const spec = S.spec(lr, lot, { density: 0.9 }); if (!spec) continue;
    spec.x = cx; spec.z = cz; spec.yaw = lr.pick([0, PI / 2, PI, -PI / 2]); spec.y = 0.05; emitBuilding(B, spec, clamp(lvl - lr.range(0, 0.25), 0.3, 1), ctx);
  }
  rubblePile(B, 0, 0, w * 0.5, d * 0.5, Math.round(w * d * 0.08), rng, 0xb0aca0, { height: 2.2 }); rubblePile(B, 0, 0, w * 0.3, d * 0.3, Math.round(w * d * 0.04), rng, 0x8a8780, { height: 3.0, scale: 1.3 });
  const api = finishObject(B, mats, { fires: ctx.fires }); api.bounds = { w, d }; return api;
}
/** createBurningBuilding({kind='midrise', floors, w, d, seed, damage=0.58, fireBoost=3, style}) -> createBuilding result + fireAnchors (windows, tears) + smokeAnchor near the top */
export function createBurningBuilding(o = {}) {
  const b = createBuilding(o.kind || 'midrise', { ...o, damage: o.damage ?? 0.58, fireBoost: o.fireBoost ?? 3 });
  const fixAnchors = () => { b.fireAnchors.sort((p, q) => q.y - p.y); const top = b.fireAnchors[0]; b.smokeAnchor = top ? top.clone().setY(top.y + 1.5) : new THREE.Vector3(0, b.top, 0); };
  fixAnchors(); const sd = b.setDamage; b.setDamage = (x) => { const r = sd(x); fixAnchors(); return r; };
  return b;
}

// ------------------------------------------------------------------ wrecks
const BONE = 0xb89a62, SLATE = 0x1d2a36, SLATE2 = 0x3a5368, CYAN = 0x46e6ff;
function scorchTrail(B, len, w, rng, y = 0.03) { const dec = getDecals(); B.quad('decal', [-w, y, len / 2], [w, y, len / 2], [w, y, -len / 2], [-w, y, -len / 2], dec.cell(3), [0.01, 0.01, 0.01], [0, 1, 0]); for (let i = 0; i < 18; i++) { B.push(rng.range(-w, w), 0.15, rng.range(-len / 2, len / 2), rng.range(0, 6)); blob(B, 'rubble', rng.range(0.15, 0.5), rng, 0x2a2622); B.pop(); } }
function wreckJet(B, rng, fires) {
  const grey = 0x6a7078, dark = 0x1c1c1e;
  const prof = (s) => [[0.45, -7.5], [0.9, -6.8], [1.15, -5], [1.25, -2], [1.25, 1], [1.0, 4], [0.6, 6.2], [0.25, 7.3], [0.0, 7.6]].map((p) => [p[0] * s, p[1] * s]);
  // rear fuselage + engine nozzles (tilted, burnt)
  B.push(0, 1.0, -4.5, 0.2, 1, 1, 1, PI / 2 - 0.08, 0.1); B.lathe('metal', 0, -7.5, 0, [[0.5, 0], [0.95, 0.7], [1.2, 2.4], [1.25, 5.5], [1.25, 7.0]], 12, { col: mul(grey, 0.5) }); B.disc('plain', 0, 7.0, 0, 1.2, 12, 0x070707, true); B.cyl('metal', -0.45, -7.7, 0, 0.45, 0.4, 1.0, 10, { col: 0x2a2018, capBottom: true }); B.cyl('metal', 0.45, -7.7, 0, 0.45, 0.4, 1.0, 10, { col: 0x2a2018, capBottom: true }); B.pop();
  // front fuselage piece + nose + canopy lying in the dirt
  B.push(0.5, 1.1, 5.5, -0.35, 1, 1, 1, PI / 2 + 0.1, 0.35); B.lathe('metal', 0, 0, 0, [[1.25, 0], [1.25, 3], [1.0, 6], [0.6, 8.3], [0.25, 9.4], [0.0, 9.7]], 12, { col: grey }); B.disc('plain', 0, 0, 0, 1.25, 12, 0x070707, false); B.sphere('glass', 0, 3.2, 0.55, 0.62, 1.7, 0.6, 8, 6, { col: 0x101820 }); B.pop();
  // wings, one snapped and lying separately, tail fins
  B.push(-3.0, 0.75, 0.0, 0.0, 1, 1, 1, 0.1, -0.2); B.box('metal', -2.6, 0, 0, 5.4, 0.2, 3.4, { col: grey }); B.box('metal', -5.6, 0.05, -0.4, 0.8, 0.12, 2.0, { col: 0x3a3a3c }); B.pop();
  B.push(7.5, 0.1, -3.5, 0.9, 1, 1, 1, 0.0, 0.0); B.box('metal', 2.4, 0.1, 0, 5.0, 0.2, 3.0, { col: mul(grey, 0.8) }); B.box('metal', 5.3, 0.1, 0.3, 0.8, 0.12, 1.8, { col: 0x2a2a2c }); B.pop();
  B.push(1.6, 0.6, -9.0, 0.3, 1, 1, 1, 0.1, 0.3); B.box('metal', 0, 1.3, 0, 0.12, 2.7, 2.2, { col: grey }); B.pop(); B.push(-2.6, 0.3, -8.6, 0.7, 1, 1, 1, 0.0, -0.6); B.box('metal', 0, 0.5, 0, 0.12, 2.4, 2.0, { col: mul(grey, 0.7) }); B.pop();
  scorchTrail(B, 38, 3.4, rng); for (let i = 0; i < 8; i++) { flames(B, rng.range(-3, 3), 0.2, rng.range(-9, 8), 2.2, rng.range(2.5, 4.5), rng); } fires.push(new THREE.Vector3(0, 1.5, -5), new THREE.Vector3(0.5, 1.5, 5), new THREE.Vector3(-3, 1.0, 0));
}
function wreckTank(B, rng, fires) {
  const hull = 0x2a2a28, burnt = 0x141311;
  for (const sx of [-1, 1]) { B.box('metal', sx * 1.55, 0.55, 0, 0.8, 1.0, 7.0, { col: burnt }); for (let i = 0; i < 7; i++) { B.push(sx * 1.97, 0.5, -2.8 + i * 0.95, 0, 1, 1, 1, 0, PI / 2); B.cyl('metal', 0, 0, 0, 0.42, 0.42, 0.1, 10, { col: 0x1c1b19 }); B.pop(); } }
  P.loftBox(B, 'metal', [[-3.4, 0.5, 1.3, 1.5], [-2.0, 0.5, 1.6, 1.5], [1.5, 0.5, 1.7, 1.45], [3.0, 0.5, 1.2, 1.2], [3.5, 0.5, 0.9, 1.0]], { side: hull, top: burnt, rear: burnt, front: hull });
  B.box('metal', 0.0, 1.0, 1.3, 2.0, 0.5, 1.5, { col: 0x0a0a0a }); // open turret ring
  B.push(3.2, 0.45, 3.5, 0.9, 1, 1, 1, 0.22, 0.4); B.box('metal', 0, 0.6, 0, 3.2, 1.0, 3.6, { col: hull }); B.box('metal', 0, 1.2, 0, 1.2, 0.2, 1.2, { col: burnt }); B.push(0, 0.6, 1.4, 0, 1, 1, 1, PI / 2 + 0.2, 0); B.cyl('metal', 0, 0, 0, 0.14, 0.12, 4.4, 8, { col: 0x181716 }); B.pop(); B.pop();
  scorchTrail(B, 10, 3.0, rng); for (let i = 0; i < 4; i++) flames(B, rng.range(-1, 1), 1.4, rng.range(-1.5, 2), 1.8, 3.6, rng); fires.push(new THREE.Vector3(0, 2.0, 0.5));
}
function wreckPod(B, rng, fires) {
  const R = 1.35; const bone = BONE; const hx = 0.0;
  // trench with raised earth
  B.push(0, 0, 0, 0.4); const tr = getDecals(); B.quad('decal', [-5, 0.04, 9], [5, 0.04, 9], [5, 0.04, -9], [-5, 0.04, -9], tr.cell(3), [0.015, 0.012, 0.01], [0, 1, 0]); for (let i = 0; i < 16; i++) { B.push(rng.range(-3, 3), 0.1, rng.range(-7, 4), rng.range(0, 6)); blob(B, 'rubble', rng.range(0.3, 1.0), rng, jitter(0x5a4a38, rng, 0.2)); B.pop(); } B.pop();
  B.push(0, 0.35, 0, 0.5, 1, 1, 1, 0.25, 0.18);
  // lower hull half (half buried) and cracked upper shell lying aside
  B.sphere('chitin', 0, 0, 0, R, R * 0.95, R * 1.25, 18, 10, { col: bone, colTop: mul(bone, 1.15), colBottom: mul(bone, 0.7), t0: PI * 0.5, t1: PI });
  B.sphere('chitin', 0, 0.02, 0, R * 0.93, R * 0.88, R * 1.17, 18, 10, { col: SLATE2, colTop: SLATE, colBottom: SLATE, t0: PI * 0.5, t1: PI });
  // glowing ports + prongs
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2 + 0.4; B.sphere('glow', Math.cos(a) * R * 0.55, -R * 0.55, Math.sin(a) * R * 0.62, 0.22, 0.12, 0.22, 8, 4, { col: mul(CYAN, 0.55) }); B.cone && 0; B.cyl('chitin', Math.cos(a) * R * 0.5, -R * 1.05, Math.sin(a) * R * 0.55, 0.12, 0.02, 0.9, 6, { col: mul(bone, 0.8) }); }
  for (let i = 0; i < 9; i++) { const a = rng.range(0, PI * 2); const p0 = [Math.cos(a) * R * 0.5, 0.1, Math.sin(a) * R * 0.5]; B.tube('chitin', [p0, [p0[0] * 1.5, 0.5 + rng.range(0, 0.4), p0[2] * 1.5], [p0[0] * 2.0 + rng.range(-0.3, 0.3), rng.range(-0.1, 0.5), p0[2] * 2.0 + rng.range(-0.3, 0.3)]], [0.07, 0.05, 0.02], 5, { col: SLATE2 }); }
  B.sphere('glow', 0, 0.25, 0, 0.5, 0.18, 0.5, 8, 4, { col: mul(CYAN, 0.9) }); B.pop();
  B.push(2.6, 0.85, 1.5, -0.8, 1, 1, 1, 0.6, 1.1); B.sphere('chitin', 0, 0, 0, R, R * 0.95, R * 1.25, 18, 9, { col: bone, colTop: mul(bone, 1.2), colBottom: mul(bone, 0.9), t0: 0, t1: PI * 0.5, p0: 0.5, p1: PI * 2 - 0.5 }); B.sphere('chitin', 0, -0.02, 0, R * 0.93, R * 0.88, R * 1.17, 18, 9, { col: SLATE, t0: 0, t1: PI * 0.5, p0: 0.5, p1: PI * 2 - 0.5 }); B.pop();
  // cracked shards + steam hint
  for (let i = 0; i < 7; i++) { B.push(rng.range(-3, 3.5), 0.2, rng.range(-2.5, 3.5), rng.range(0, 6), 1, 1, 1, rng.range(-0.5, 0.5), rng.range(-0.5, 0.5)); B.box('chitin', 0, 0, 0, rng.range(0.4, 1.0), 0.08, rng.range(0.4, 0.9), { col: bone }); B.pop(); }
  for (let i = 0; i < 2; i++) flames(B, rng.range(-1.5, 1.5), 0.3, rng.range(-1, 1), 1.0, 1.8, rng); fires.push(new THREE.Vector3(0, 1.2, 0));
}
function wreckLeg(B, rng, fires) {
  // a fallen tripod leg ~24 m long: three plated segments, slate-blue flesh joints, tendon cables, three-clawed foot
  const seg = (len, r0, r1, colA) => { const n = 6; const prof = []; for (let i = 0; i <= n * 2; i++) { const t = i / (n * 2); const r = r0 + (r1 - r0) * t; prof.push([r * (i % 2 ? 0.86 : 1.0) * (1 + 0.06 * Math.sin(t * 9)), t * len]); } B.lathe('chitin', 0, 0, 0, prof, 10, { col: colA }); };
  B.push(0, 1.4, -10, 0.15, 1, 1, 1, PI / 2 - 0.03, 0);
  seg(9, 1.5, 1.2, BONE); B.sphere('chitin', 0, 9, 0, 1.4, 1.4, 1.4, 10, 6, { col: SLATE2 }); B.push(0, 9, 0, 0, 1, 1, 1, 0.12, 0.05); seg(8, 1.2, 0.85, mul(BONE, 0.95)); B.sphere('chitin', 0, 8, 0, 1.0, 1.0, 1.0, 10, 6, { col: SLATE2 });
  B.push(0, 8, 0, 0, 1, 1, 1, -0.2, 0.0); seg(4.2, 0.85, 0.6, BONE); // lower leg
  for (let c = 0; c < 3; c++) { const a = (c / 3) * PI * 2; const dx = Math.cos(a), dz = Math.sin(a); B.tube('chitin', [[dx * 0.3, 4.2, dz * 0.3], [dx * 1.2, 5.2, dz * 1.2], [dx * 2.0, 5.0, dz * 2.0], [dx * 2.4, 4.0, dz * 2.4]], [0.38, 0.3, 0.2, 0.04], 6, { col: mix(BONE, 0x3a2a1a, 0.15) }); }
  B.pop(); B.pop();
  for (let k = 0; k < 4; k++) { const a = rng.range(0, PI * 2); B.tube('plain', [[Math.cos(a) * 1.2, 0, 0], [Math.cos(a) * 1.4, 3, Math.sin(a) * 1.2], [Math.cos(a) * 1.3, 7, Math.sin(a) * 1.3], [Math.cos(a) * 1.0, 9, Math.sin(a) * 1.0]], 0.06, 4, { col: SLATE2 }); }
  B.pop();
  for (let i = 0; i < 6; i++) { B.push(rng.range(-3, 3), 0.1, rng.range(-18, 8), rng.range(0, 6)); blob(B, 'rubble', rng.range(0.4, 1.2), rng, jitter(0x6a6254, rng, 0.2)); B.pop(); }
  scorchTrail(B, 14, 3.0, rng); B.sphere('glow', 0.3, 1.0, 3.4, 0.25, 0.14, 0.25, 6, 4, { col: mul(CYAN, 0.7) });
  fires.push(new THREE.Vector3(0, 3, -4));
}
/** createWreck(kind, {seed, burning=true}) kinds: car|bus|jet|tank|alien_pod|tripod_leg -> {root,update,dispose,setNight,fireAnchors,bounds} */
export function createWreck(kind = 'car', o = {}) {
  const rng = new RNG((o.seed || 1) * 19 + kind.length); const B = new Builder(); const mats = new MatSet({ burning: true }); const fires = [];
  if (kind === 'car' || kind === 'bus') {
    const shape = o.shape || (kind === 'bus' ? 'bus' : rng.pick(['sedan', 'suv', 'taxi', 'hatch', 'van']));
    const flip = o.flipped ?? (kind === 'car' && rng.chance(0.3));
    B.push(0, flip ? 1.5 : 0.0, 0, rng.range(0, 6), 1, 1, 1, 0.0, flip ? PI : kind === 'bus' ? rng.range(-0.1, 0.1) : 0.04); P.car(B, shape, 0, 0, 0, shape === 'taxi' ? 0xf2c230 : rng.pick(P.PALETTE.carBody), { wreck: 1 }); B.pop();
    scorchTrail(B, kind === 'bus' ? 16 : 8, 2.4, rng); const L = kind === 'bus' ? 11 : 4.6;
    if (o.burning !== false) for (let i = 0; i < (kind === 'bus' ? 4 : 2); i++) { const z = rng.range(-L / 2, L / 2); flames(B, 0, 1.0, z, 1.8, 3.0, rng); embers(B, 0, 1.0, z, 1.4, rng); } fires.push(new THREE.Vector3(0, 1.4, 0));
    for (let i = 0; i < 6; i++) { B.push(rng.range(-2.5, 2.5), 0.1, rng.range(-L, L), rng.range(0, 6), 1, 1, 1, 0, rng.range(-0.4, 0.4)); B.box('metal', 0, 0, 0, rng.range(0.3, 0.9), 0.04, rng.range(0.3, 1.0), { col: 0x20201e }); B.pop(); }
  } else if (kind === 'jet') wreckJet(B, rng, fires);
  else if (kind === 'tank') wreckTank(B, rng, fires);
  else if (kind === 'alien_pod') wreckPod(B, rng, fires);
  else if (kind === 'tripod_leg') wreckLeg(B, rng, fires);
  else throw new Error('unknown wreck kind ' + kind);
  const api = finishObject(B, mats, { fires }); api.kind = kind; return api;
}

// ------------------------------------------------------------------ infrastructure collapse
/** createCollapsedOverpass({len=60, width=16, seed}) -> half-fallen highway overpass: standing pier, tilted slab, rubble, rebar, a few wrecked cars */
export function createCollapsedOverpass(o = {}) {
  const rng = new RNG((o.seed || 1) * 5 + 2); const B = new Builder(); const mats = new MatSet({ burning: true }); const fires = []; const L = o.len ?? 60, W = o.width ?? 16; const span = L / 2;
  B.quad('g_asphalt', [-W, 0.0, L], [W, 0.0, L], [W, 0.0, -L], [-W, 0.0, -L], [-W / 8, L / 8, W / 8, -L / 8], 0xffffff, [0, 1, 0]);
  for (let i = -1; i <= 1; i += 2) B.quad('paint', [i * 4 - 0.1, 0.012, L], [i * 4 + 0.1, 0.012, L], [i * 4 + 0.1, 0.012, -L], [i * 4 - 0.1, 0.012, -L], [0, 0, 1, 1], 0xe6e6de, [0, 1, 0]);
  const deckH = 8.5, deckT = 1.1;
  // standing pier + beam stub + remaining deck on the left
  for (const sx of [-1, 1]) B.box('concrete', sx * (W * 0.32), deckH / 2, 0, 1.8, deckH, 2.4, { col: 0xc8c4bc, mpt: 4 }); B.box('concrete', 0, deckH - 0.4, 0, W * 0.95, 1.0, 3.2, { col: 0xc0bcb4, mpt: 4 });
  B.box('concrete', 0, deckH + deckT / 2, -span * 0.55, W, deckT, span * 1.1, { col: 0xc8c4bc, mpt: 4 }); B.box('g_asphalt', 0, deckH + deckT + 0.02, -span * 0.55, W - 1, 0.06, span * 1.1, { col: 0xffffff }); for (const sx of [-1, 1]) B.box('concrete', sx * (W / 2 - 0.3), deckH + deckT + 0.55, -span * 0.55, 0.5, 1.1, span * 1.1, { col: 0xc8c4bc, mpt: 4 });
  // broken slab hinged at the pier, sloping down to the ground, plus a snapped second piece
  B.push(0, deckH + deckT, 0.5, 0, 1, 1, 1, 0.34, 0.06); B.box('concrete', 0, -deckT / 2, span * 0.45, W, deckT, span * 0.95, { col: 0xc8c4bc, mpt: 4 }); B.box('g_asphalt', 0, 0.02, span * 0.45, W - 1, 0.06, span * 0.95, { col: 0xffffff }); B.box('concrete', -(W / 2 - 0.3), 0.55, span * 0.45, 0.5, 1.1, span * 0.95, { col: 0xc8c4bc }); B.pop();
  B.push(rng.range(-2, 2), 1.4, span * 1.12, 0.3, 1, 1, 1, -0.2, 0.5); B.box('concrete', 0, 0, 0, W * 0.9, deckT, span * 0.35, { col: 0xb8b4ac, mpt: 4 }); B.pop();
  for (let i = 0; i < 26; i++) { B.push(rng.range(-W / 2, W / 2), deckH + rng.range(-0.5, 0.8), rng.range(-1.5, 2.5), 0, 1, 1, 1, rng.range(-0.8, 0.8), rng.range(-0.8, 0.8)); B.cyl('metal', 0, 0, 0, 0.02, 0.02, rng.range(1.0, 3.2), 4, { col: 0x5a3422, cap: false }); B.pop(); }
  rubblePile(B, 0, span * 0.8, W * 0.7, span * 0.5, 160, rng, 0xa8a49a, { height: 1.4 }); rubblePile(B, 0, 0, W * 0.5, 7, 80, rng, 0xa8a49a, { height: 2.2 });
  P.car(B, 'sedan', -4.4, span * 0.55, 0.5, 0x3a4a6a, { wreck: 1 }); P.car(B, 'van', 3.5, span * 0.95, -0.4, 0xe8e8e8, { wreck: 0.8 }); flames(B, -4.4, 1.0, span * 0.55, 1.8, 3, rng); fires.push(new THREE.Vector3(-4.4, 1.5, span * 0.55));
  return Object.assign(finishObject(B, mats, { fires }), { bounds: { w: W * 2, d: L * 2, h: deckH + deckT } });
}
/** createToppledBridge({len=70, seed}) -> girder bridge segment fallen on its side with broken cable stays and a leaning tower */
export function createToppledBridge(o = {}) {
  const rng = new RNG((o.seed || 1) * 7 + 1); const B = new Builder(); const mats = new MatSet({}); const L = o.len ?? 70, W = 14;
  // deck rolled onto its side & half-submerged into the ground
  B.push(0, 2.4, 0, 0.1, 1, 1, 1, 0.04, 1.1); B.box('concrete', 0, 0, 0, W, 1.4, L, { col: 0xb4b0a8, mpt: 4 }); B.box('g_asphalt', 0, 0.74, 0, W - 0.6, 0.08, L, { col: 0xffffff }); B.quad('paint', [-0.1, 0.8, L / 2], [0.1, 0.8, L / 2], [0.1, 0.8, -L / 2], [-0.1, 0.8, -L / 2], [0, 0, 1, 1], 0xe0d070, [0, 1, 0]);
  for (const sx of [-1, 1]) { B.box('metal', sx * (W / 2 + 0.1), 1.4, 0, 0.3, 2.0, L, { col: 0x8a9096 }); for (let i = 0; i < L / 3; i++) B.box('metal', sx * (W / 2 + 0.1), 1.4, -L / 2 + i * 3 + 1.5, 0.12, 1.8, 0.12, { col: 0x6a7076 }); }
  B.pop();
  // leaning pylon + cables dangling to the deck
  B.push(-9, 0, -18, 0.2, 1, 1, 1, 0.0, 0.32); B.box('concrete', 0, 25, 0, 2.6, 50, 2.6, { col: 0xc4c0b8, mpt: 4 }); B.box('concrete', 0, 52, 0, 4.2, 1.4, 3.4, { col: 0xb8b4ac, mpt: 4 }); B.pop();
  for (let i = 0; i < 12; i++) { const z = -26 + i * 2.2 + rng.range(-0.5, 0.5); const top = [-9 + 0.32 * 40 - 3, 36 + rng.range(-6, 6), -18 + rng.range(-1, 1)]; B.tube('metal', [top, [top[0] + 3, top[1] - 12 + rng.range(0, 6), top[2] + (z + 18) * 0.5], [rng.range(-6, 4), rng.range(0.5, 6), z]], 0.07, 4, { col: 0x3a3a3c }); }
  rubblePile(B, 0, 0, 12, 22, 120, rng, 0xa8a49a, { height: 1.3 }); const L2 = new RNG(3); P.car(B, 'taxi', 9, 6, 0.3, 0xf2c230, { wreck: 1 }); P.car(B, 'sedan', -8, 14, 2.2, 0x2a4a8a, { wreck: 1 });
  return Object.assign(finishObject(B, mats, {}), { bounds: { w: W * 2, d: L, h: 52 } });
}
