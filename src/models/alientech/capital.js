// Vessari CAPITAL SHIP (kilometre-scale ribbed ovoid with cathedral spires, windows, engine array), instanced FLEET and the MOTHERSHIP.
import * as THREE from 'three';
import { RNG, seg, clamp, lerp, TAU, disposeTree, GLOBAL } from '../../engine/common.js';
import { tube } from '../../engine/geo.js';
import { infectable } from '../../engine/infect.js';
import { hullMat, shellWindowMat, glowMat, flameMat, haloMat, infectAll, CYAN } from './mats.js';
import { revolve, surface, blob, spike, place, alignY, mergeAll, scaleUV, torus, orient, smoothNormals, sstep } from './kit.js';
import { shellTextures, windowTexture } from './tex.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const ribBump = (f, sharp = 1) => Math.pow(Math.sin(Math.PI * (f - Math.floor(f))), sharp);
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));
const flipUV = (g) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return g; };

// ----------------------------------------------------------------------------------------------------------------- capital ship geometry
export function shipProfile(L) {
  const RM = L * 0.135, FL = 0.82;
  const hullR = (s) => {
    const body = s < 0 ? 0.45 + 0.55 * Math.pow(Math.max(0, 1 - Math.pow(-s, 2.6)), 0.55) : Math.pow(Math.max(0, 1 - Math.pow(s, 2.1)), 0.6);
    return RM * body * (1 - 0.13 * gauss(s + 0.5, 0.06)) * (1 + 0.1 * gauss(s - 0.22, 0.28));
  };
  const point = (s, a, off = 0, out = new V3()) => { const r = hullR(s) + off; return out.set(Math.cos(a) * r, -Math.sin(a) * r * FL, s * L / 2); };
  const normal = (s, a, out = new V3()) => out.set(Math.cos(a), -Math.sin(a) * FL * 0.98, 0).normalize();
  return { RM, FL, hullR, point, normal };
}

function capitalParts(L, seed, lod) {
  const rng = new RNG(seed * 811 + 5);
  const { RM, FL, hullR, point, normal } = shipProfile(L);
  const parts = { hull: [], bone: [], glow: [], flameDefs: [], spikes: [], pods: [], organs: [], nozzles: [] };
  const radial = lod ? 16 : seg(48, 22), rings = lod ? 26 : seg(88, 36), ribPer = L / 50;
  // main hull: rib bumps, dorsal ridge, ventral keel
  const hull = revolve(L, (t, y, a) => {
    const s = t * 2 - 1; let r = hullR(s);
    if (!lod) r *= 1 + 0.024 * ribBump(y / ribPer, 1.2) + 0.010 * Math.sin(a * 14 + y * 0.05);
    r *= 1 + 0.09 * gauss(a - 1.5 * Math.PI, 0.26) + 0.07 * gauss(a - 0.5 * Math.PI, 0.2);
    return r;
  }, { rings, radial, tile: 256, ratio: FL });
  hull.rotateX(Math.PI / 2); hull.translate(0, 0, -L / 2); parts.hull.push(hull);
  // stern plate
  { const c = new THREE.CircleGeometry(hullR(-1) * 1.0, lod ? 16 : 48); c.scale(1, FL, 1); c.rotateY(Math.PI); c.translate(0, 0, -L / 2 - 0.3); scaleUV(c, 0.5, 0.5); parts.hull.push(c); }
  // big bone ribs (bands around the hull)
  const nb = lod ? 6 : 13;
  for (let k = 0; k < nb; k++) {
    const s = lerp(-0.78, 0.78, k / (nb - 1)) + rng.range(-0.015, 0.015); const w = L * (lod ? 0.025 : 0.014), Rc = hullR(s);
    const band = revolve(w, (t) => (Rc + L * 0.004 + L * 0.0045 * Math.pow(Math.sin(Math.PI * t), 0.6)) * (1 + 0.0), { rings: lod ? 3 : 3, radial: lod ? 16 : seg(40, 20), tile: 64, ratio: FL });
    band.rotateX(Math.PI / 2); band.translate(0, 0, s * L / 2 - w / 2); parts.bone.push(band);
  }
  // cathedral spires on the dorsal side
  const topY = (s) => hullR(s) * FL;
  const spires = [{ s: 0.12, x: 0, h: 0.30, r: 0.045 }, { s: -0.12, x: 0, h: 0.19, r: 0.032 }, { s: 0.34, x: 0, h: 0.15, r: 0.026 }, { s: 0.05, x: 1, h: 0.17, r: 0.03 }, { s: 0.05, x: -1, h: 0.17, r: 0.03 }, { s: 0.22, x: 1, h: 0.12, r: 0.024 }, { s: 0.22, x: -1, h: 0.12, r: 0.024 }, { s: -0.32, x: 1, h: 0.1, r: 0.022 }, { s: -0.32, x: -1, h: 0.1, r: 0.022 }];
  const nsp = lod ? 5 : spires.length;
  for (let i = 0; i < nsp; i++) {
    const sp = spires[i]; const hh = sp.h * L, r0 = sp.r * L; const lateral = sp.x * RM * 0.34;
    const g = revolve(hh, (t, y) => { const base = r0 * Math.pow(1 - t, 0.78); const step = 1 + 0.1 * Math.max(0, Math.sin(t * 22)) * (1 - t) + 0.06 * gauss(t - 0.5, 0.05) ; return Math.max(0.002, base * step * (t > 0.9 ? Math.max(0.15, 1 - (t - 0.9) * 8) : 1)); }, { rings: lod ? 8 : 26, radial: lod ? 8 : 12, tile: 64 });
    g.rotateX(-0.1); const y0 = topY(sp.s) * Math.sqrt(Math.max(0.2, 1 - (lateral / RM) ** 2)) - hh * 0.04; g.translate(lateral, y0, sp.s * L / 2); parts.bone.push(g);
    // gothic collar rings
    if (!lod) for (let k = 1; k <= 2; k++) { const t = k * 0.28; const rr = r0 * Math.pow(1 - t, 0.78) * 1.25; const rg = torus(rr, hh * 0.008, 16, 4, { tile: 32 }); rg.rotateX(-0.1); rg.translate(lateral - Math.sin(0.1) * 0, y0 + hh * t, sp.s * L / 2 - hh * t * 0.1); parts.bone.push(rg); }
    // beacon tip
    const bl = new THREE.SphereGeometry(r0 * 0.12 + 1.2, 8, 6); bl.translate(lateral, y0 + hh * 0.995, sp.s * L / 2 - hh * 0.1); parts.glow.push(bl);
    // flying buttresses (curved bone arms from the spire down to the hull flanks)
    if (!lod && i < 5) for (const sx of [-1, 1]) for (const dz of [-1, 1]) {
      const sz = sp.s * L / 2; const a = new V3(lateral, y0 + hh * 0.32, sz - hh * 0.03);
      const side = new V3(lateral + sx * hh * 0.28, y0 - hh * 0.04, sz + dz * hh * 0.12);
      const mid = new V3().lerpVectors(a, side, 0.5); mid.y += hh * 0.06; mid.x += sx * hh * 0.04;
      parts.bone.push(tube([a, mid, side], [r0 * 0.28, r0 * 0.22, r0 * 0.3], { radial: 5, segsPerPoint: 4 }));
    }
  }
  // luminous longitudinal veins
  if (!lod) for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + 0.12; const pts = []; const s0 = rng.range(-0.8, -0.5), s1 = rng.range(0.55, 0.88);
    for (let i = 0; i <= 14; i++) { const s = lerp(s0, s1, i / 14); pts.push(point(s, a + 0.05 * Math.sin(i * 0.9 + k), L * 0.0022)); }
    parts.glow.push(tube(pts, L * 0.0016, { radial: 4, segsPerPoint: 1 }));
  }
  // organs: glowing nodes in rings; greeble spikes + pods
  const nOrg = lod ? 0 : 150, nSpike = lod ? 0 : 700, nPod = lod ? 0 : 180;
  for (let i = 0; i < nOrg; i++) { const s = rng.range(-0.85, 0.82), a = rng.range(0, TAU); const p = point(s, a, L * 0.003); const sc = rng.range(0.9, 2.6); parts.organs.push({ p, sc: new V3(sc, sc * 1.4, sc), n: normal(s, a) }); }
  for (let i = 0; i < nSpike; i++) { const s = rng.range(-0.9, 0.86), a = rng.range(0, TAU); const p = point(s, a, -L * 0.002); const len = rng.range(0.008, 0.026) * L; parts.spikes.push({ p, n: normal(s, a).add(new V3(0, 0, rng.range(-0.5, 0.2))).normalize(), len, r: len * rng.range(0.07, 0.12) }); }
  for (let i = 0; i < nPod; i++) { const s = rng.range(-0.88, 0.84), a = rng.range(0, TAU); const p = point(s, a, -L * 0.001); parts.pods.push({ p, n: normal(s, a), sc: rng.range(0.006, 0.016) * L, tw: rng.range(-1, 1) }); }
  // engines
  const sternR = hullR(-1);
  const mkBell = (cx, cy, rOut, len) => { // bell opening backwards (-Z)
    const g = revolve(len, (t) => rOut * (0.45 + 0.55 * Math.pow(t, 0.6)) , { rings: lod ? 3 : 5, radial: lod ? 10 : 20, tile: 16 });
    g.rotateX(-Math.PI / 2); g.translate(cx, cy, -L / 2); parts.hull.push(g);
    parts.nozzles.push({ x: cx, y: cy, r: rOut, len });
    const d = new THREE.CircleGeometry(rOut * 0.92, lod ? 10 : 28); d.rotateY(Math.PI); d.translate(cx, cy, -L / 2 - len * 0.55); parts.glow.push(d);
  };
  mkBell(0, 0, RM * 0.22, RM * 0.3);
  const ne = lod ? 4 : 6; for (let i = 0; i < ne; i++) { const a = i / ne * TAU + 0.3; mkBell(Math.cos(a) * sternR * 0.62, Math.sin(a) * sternR * 0.62 * FL, RM * 0.095, RM * 0.16); }
  // bow maw (ventral) ring + glow
  { const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), new V3(0, -0.45, 0.89).normalize()); const c = point(0.86, Math.PI / 2, L * 0.005);
    const ring = torus(RM * 0.2, RM * 0.035, 32, 8, { tile: 16 }); ring.rotateX(Math.PI / 2); ring.rotateX(-Math.PI / 2); place(ring, [c.x, c.y, c.z], q); parts.bone.push(ring);
    const disc = new THREE.CircleGeometry(RM * 0.19, 28); place(disc, [c.x, c.y, c.z], q); parts.glow.push(disc);
    for (let i = 0; i < (lod ? 0 : 14); i++) { const a = i / 14 * TAU; const sp = spike(RM * 0.16, RM * 0.016, 5); const loc = new V3(Math.cos(a) * RM * 0.19, Math.sin(a) * RM * 0.19, 0).applyQuaternion(q).add(c); place(sp, [loc.x, loc.y, loc.z], new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(-Math.cos(a) * 0.5, -Math.sin(a) * 0.5, 1).applyQuaternion(q).normalize())); parts.bone.push(sp); } }
  return { parts, RM, FL, hullR };
}

function instancedGreebles(parts, L, mat, rng) {
  const g = new THREE.Group();
  const mk = (geo, list, fill) => {
    if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3();
    list.forEach((it, i) => { fill(it, p, q, s); m.compose(p, q, s); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; g.add(im); return im;
  };
  const cone = new THREE.ConeGeometry(1, 1, 5, 1, true); cone.translate(0, 0.5, 0); scaleUV(cone, 1, 1);
  mk(cone, parts.spikes, (it, p, q, s) => { p.copy(it.p); q.setFromUnitVectors(new V3(0, 1, 0), it.n); s.set(it.r * 2, it.len, it.r * 2); });
  const pod = new THREE.SphereGeometry(1, 5, 3, 0, TAU, 0, Math.PI / 2); scaleUV(pod, 1, 1);
  mk(pod, parts.pods, (it, p, q, s) => { p.copy(it.p); q.setFromUnitVectors(new V3(0, 1, 0), it.n).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), it.tw * 3)); s.set(it.sc * 1.4, it.sc * 0.8, it.sc * 1.4); });
  return g;
}

/** createCapitalShip(seed, {length=700}) -> hero. Own units = metres, nose +Z; scale with root.scale. */
export function createCapitalShip(seed = 1, opts = {}) {
  const L = opts.length ?? 700; const rng = new RNG(seed * 77 + 3);
  const { parts, RM, FL } = capitalParts(L, seed, false);
  const root = new THREE.Group(); root.name = 'CapitalShip';
  const mHull = hullMat({ emissiveIntensity: 2.8, seed: 1 }), mBone = shellWindowMat({ emissiveIntensity: 2.6, seed: 3 }), mGlow = glowMat(3.4);
  const mFlame = flameMat({ power: 1.2, fall: 1.9, rim: 0.8, seed }), mFlameCore = flameMat({ power: 1.6, fall: 2.6, rim: 0.4, seed: seed + 3 });
  const add = (geos, mat, name) => { if (!geos.length) return; const me = new THREE.Mesh(mergeAll(geos), mat); me.name = name; root.add(me); return me; };
  add(parts.hull, mHull, 'hull'); add(parts.bone, mBone, 'bone'); add(parts.glow, mGlow, 'glow');
  // glowing organs (instanced)
  if (parts.organs.length) {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mGlow, parts.organs.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    parts.organs.forEach((o, i) => { q.setFromUnitVectors(new V3(0, 1, 0), o.n); m.compose(o.p, q, o.sc); im.setMatrixAt(i, m); }); im.frustumCulled = false; root.add(im);
  }
  root.add(instancedGreebles(parts, L, mHull, rng));
  // engine flames
  const flames = [];
  for (const n of parts.nozzles) {
    const len = n.len * (n.r > RM * 0.15 ? 6.0 : 5.0);
    const cone = new THREE.CylinderGeometry(n.r * 0.25, n.r * 0.9, len, 24, 1, true); cone.rotateX(-Math.PI / 2); cone.translate(0, 0, -len / 2);
    const fm = new THREE.Mesh(cone, mFlame); fm.position.set(n.x, n.y, -L / 2 - n.len * 0.5); fm.frustumCulled = false; root.add(fm); flames.push(fm);
    const cone2 = new THREE.ConeGeometry(n.r * 0.55, len * 0.55, 16, 1, true); cone2.rotateX(-Math.PI / 2); cone2.translate(0, 0, -len * 0.275);
    const fm2 = new THREE.Mesh(cone2, mFlameCore); fm2.position.copy(fm.position); fm2.frustumCulled = false; root.add(fm2); flames.push(fm2);
  }
  const halo = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.55 })); halo.position.set(0, 0, -L / 2 - RM * 0.5); halo.scale.setScalar(RM * 3.2); root.add(halo);
  const st = { lights: 1, thrust: 0.7, infect: 0 };
  const ship = {
    root, size: L, length: L, radius: RM, update(dt, t) {
      const fl = 0.93 + 0.07 * Math.sin(t * 9.0) * Math.sin(t * 3.7);
      mFlame.uniforms.uPower.value = (0.15 + st.thrust * 1.0) * fl; mFlameCore.uniforms.uPower.value = st.thrust * 1.5 * fl;
      for (let i = 0; i < flames.length; i += 2) flames[i].scale.set(1, 1, 0.5 + st.thrust * 0.7), flames[i + 1].scale.set(1, 1, 0.5 + st.thrust * 0.8);
      const br = st.lights * (0.96 + 0.04 * Math.sin(t * 1.3));
      mHull.emissiveIntensity = mHull.userData.baseEmissive * br; mBone.emissiveIntensity = mBone.userData.baseEmissive * br; mGlow.emissiveIntensity = 3.4 * br * (0.92 + 0.08 * Math.sin(t * 2.1));
      halo.material.opacity = 0.2 + 0.4 * st.thrust * st.lights;
    },
    setLights(v) { st.lights = clamp(v, 0, 1); }, setThrust(v) { st.thrust = clamp(v, 0, 1); },
    setInfection(a) { st.infect = a; infectAll(root, a); }, dispose() { disposeTree(root); },
  };
  ship.update(0, 0);
  return ship;
}

// ----------------------------------------------------------------------------------------------------------------- fleet (instanced)
function fleetGeometry() {
  const L = 600; const { parts } = capitalParts(L, 7, true);
  const out = [];
  const tint = (g, c, glow = 0) => {
    const n = g.attributes.position.count; const cols = new Float32Array(n * 3), gl = new Float32Array(n).fill(glow); const col = new THREE.Color(c);
    for (let i = 0; i < n; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.index) { const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); return g;
  };
  for (const g of parts.hull) out.push(tint(g, 0x2a4a8a));
  for (const g of parts.bone) out.push(tint(g, 0xffffff));
  for (const g of parts.glow) out.push(tint(g, 0x0a1218, 1.0));
  const merged = mergeGeometries(out, false); merged.scale(1 / L, 1 / L, 1 / L); // unit length so instance scale = metres
  return merged;
}
/** createFleet(count, opts) -> instanced distant ships. set(i,{x,y,z,yaw,scale,infect}); scale = ship length in metres. */
export function createFleet(count = 20, opts = {}) {
  const cap = count; const geo = fleetGeometry();
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; for (const k in geo.attributes) ig.setAttribute(k, geo.attributes[k]);
  const aInfect = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage); ig.setAttribute('aInfect', aInfect);
  const sh = shellTextures(); const win = windowTexture(5);
  const mat = new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normal, roughnessMap: sh.orm, roughness: 0.7, metalness: 0.1, vertexColors: true, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 2.2 });
  const uni = { uGlowCol: { value: new THREE.Color(CYAN).multiplyScalar(3.2) } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGlowCol; varying float vGlow;').replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += uGlowCol * vGlow;\n#include <emissivemap_fragment>');
  };
  infectable(mat, { instanced: true });
  const mesh = new THREE.InstancedMesh(ig, mat, cap); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.name = 'Fleet';
  const root = new THREE.Group(); root.add(mesh); root.name = 'Fleet';
  const S = { x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap), yaw: new Float32Array(cap), scale: new Float32Array(cap).fill(600) };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), s = new V3(), UP = new V3(0, 1, 0); let n = 0;
  const fl = {
    root, capacity: cap, mesh, get count() { return n; }, trisPerInstance: geo.index.count / 3,
    setCount(k) { n = Math.min(cap, Math.max(0, k | 0)); mesh.count = n; return fl; },
    set(i, o) { if (i >= cap) return fl; if (i >= n) { n = i + 1; mesh.count = n; }
      if (o.x !== undefined) S.x[i] = o.x; if (o.y !== undefined) S.y[i] = o.y; if (o.z !== undefined) S.z[i] = o.z; if (o.yaw !== undefined) S.yaw[i] = o.yaw; if (o.scale !== undefined) S.scale[i] = o.scale; if (o.infect !== undefined) aInfect.array[i] = o.infect;
      q.setFromAxisAngle(UP, S.yaw[i]); p.set(S.x[i], S.y[i], S.z[i]); s.setScalar(S.scale[i]); m4.compose(p, q, s); mesh.setMatrixAt(i, m4); return fl; },
    get(i, out = {}) { out.x = S.x[i]; out.y = S.y[i]; out.z = S.z[i]; out.yaw = S.yaw[i]; out.scale = S.scale[i]; out.infect = aInfect.array[i]; return out; },
    commit() { mesh.instanceMatrix.needsUpdate = true; aInfect.needsUpdate = true; return fl; },
    update() {}, setLights(v) { mat.emissiveIntensity = 2.2 * v; uni.uGlowCol.value.copy(CYAN).multiplyScalar(3.2 * v); }, setInfectionAll(a) { for (let i = 0; i < cap; i++) aInfect.array[i] = a; aInfect.needsUpdate = true; },
    dispose() { ig.dispose(); mat.dispose(); },
  };
  return fl;
}

// ----------------------------------------------------------------------------------------------------------------- MOTHERSHIP
function spireGeo(h, r0, rings = 44, radial = 16, tile = 96) {
  return revolve(h, (t) => { const base = r0 * Math.pow(1 - t, 0.74); const step = 1 + 0.1 * Math.max(0, Math.sin(t * 24)) * (1 - t) + 0.07 * gauss(t - 0.5, 0.05) + 0.05 * gauss(t - 0.22, 0.04); return Math.max(0.002, base * step * (t > 0.9 ? Math.max(0.12, 1 - (t - 0.9) * 8.5) : 1)); }, { rings, radial, tile });
}
/** createMothership(seed, {diameter=1400}) -> hero. Gothic crown of spires on a ribbed saucer-hive, ventral maw, rim engines. Own units = metres. */
export function createMothership(seed = 1, opts = {}) {
  const D = opts.diameter ?? 1400, R = D / 2; const rng = new RNG(seed * 313 + 17);
  const hu = D * 0.13, hb = D * 0.1; // upper dome / lower belly half-heights
  const root = new THREE.Group(); root.name = 'Mothership';
  const mHull = hullMat({ emissiveIntensity: 3.0, seed: 4 }), mBone = shellWindowMat({ emissiveIntensity: 2.8, seed: 6 }), mGlow = glowMat(3.2), mGlowV = glowMat(1.8);
  const mFlame = flameMat({ power: 2.0, fall: 1.8, rim: 0.7, seed }), mCore = flameMat({ power: 2.8, fall: 2.4, rim: 0.3, seed: seed + 1 });
  const P = { hull: [], bone: [], glow: [], vein: [] };
  const radial = seg(88, 36), rings = seg(48, 24);
  // saucer-hive body: upper dome (taller) + lower belly, meridian ribs, terraces on the dome
  const bodyR = (y) => { const up = y >= 0; const s = up ? y / hu : y / -hb; const k = 2.3; let r = R * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), k)), 1 / k); if (up) r *= 1 - 0.05 * ribBump(s * 4.5 + 0.2, 1.4); return r; };
  const body = revolve(hu + hb, (t, yy, a) => { const y = yy - hb; let r = bodyR(y); r *= 1 + 0.028 * Math.pow(Math.abs(Math.cos(a * 30)), 3.0) * (1 - Math.abs(y) / (hu + hb) * 0.5); return Math.max(0.5, r); }, { rings, radial, tile: 512 });
  body.translate(0, -hb, 0); P.hull.push(body);
  // equatorial bone collar + glowing band
  { const c = torus(R * 1.002, D * 0.006, seg(160, 64), 8, { tile: 64 }); P.bone.push(c); const gl = torus(R * 0.998, D * 0.0024, seg(160, 64), 6, { tile: 64 }); gl.translate(0, D * 0.0125, 0); P.vein.push(gl); const gl2 = gl.clone(); gl2.translate(0, -D * 0.025, 0); P.vein.push(gl2); }
  // crown of spires
  const topAt = (rad) => hu * Math.pow(Math.max(0, 1 - Math.pow(rad / R, 2.3)), 1 / 2.3);
  const nCrown = 9;
  for (let i = 0; i < nCrown; i++) {
    const a = i / nCrown * TAU + 0.2; const rad = R * 0.5; const h = D * rng.range(0.30, 0.42), r0 = D * rng.range(0.022, 0.03);
    const g = spireGeo(h, r0, 26, 12); const tilt = 0.17; g.rotateZ(-Math.sin(a) * 0 ); // build upright then lean outward
    g.rotateX(Math.sin(a) * tilt); g.rotateZ(-Math.cos(a) * tilt); g.translate(Math.cos(a) * rad, topAt(rad) - h * 0.03, Math.sin(a) * rad); P.bone.push(g);
    const bl = new THREE.SphereGeometry(r0 * 0.14 + 3, 8, 6); bl.translate(Math.cos(a) * (rad + Math.sin(tilt) * h), topAt(rad) + h * 0.97, Math.sin(a) * (rad + Math.sin(tilt) * h)); P.glow.push(bl);
    for (let k = 1; k <= 2; k++) { const t = k * 0.28, rr = r0 * Math.pow(1 - t, 0.74) * 1.3; const rg = torus(rr, h * 0.006, 16, 4, { tile: 32 }); rg.rotateX(Math.sin(a) * tilt); rg.rotateZ(-Math.cos(a) * tilt); rg.translate(Math.cos(a) * rad + Math.cos(a) * Math.sin(tilt) * h * t, topAt(rad) + h * t, Math.sin(a) * rad + Math.sin(a) * Math.sin(tilt) * h * t); P.bone.push(rg); }
    // buttress arc to the dome centre
    const a0 = new V3(Math.cos(a) * (rad + h * 0.05), topAt(rad) + h * 0.3, Math.sin(a) * (rad + h * 0.05)), a1 = new V3(Math.cos(a) * R * 0.78, topAt(R * 0.78) + 4, Math.sin(a) * R * 0.78), mid = a0.clone().lerp(a1, 0.5); mid.y += h * 0.05;
    P.bone.push(tube([a0, mid, a1], [r0 * 0.3, r0 * 0.24, r0 * 0.3], { radial: 5, segsPerPoint: 4 }));
  }
  // great central spire (cathedral)
  { const h = D * 0.62, r0 = D * 0.05; const g = spireGeo(h, r0, seg(50, 28), 16, 128); g.translate(0, topAt(0) - h * 0.02, 0); P.bone.push(g);
    for (let k = 1; k <= 4; k++) { const t = k * 0.17, rr = r0 * Math.pow(1 - t, 0.74) * 1.35; const rg = torus(rr, h * 0.005, 24, 4, { tile: 32 }); rg.translate(0, topAt(0) + h * t, 0); P.bone.push(rg); }
    const bl = new THREE.SphereGeometry(7, 10, 8); bl.translate(0, topAt(0) + h * 0.985, 0); P.glow.push(bl);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const t = tube([new V3(Math.cos(a) * r0 * 0.9, topAt(0) + h * 0.25, Math.sin(a) * r0 * 0.9), new V3(Math.cos(a) * R * 0.2, topAt(R * 0.2) + h * 0.07, Math.sin(a) * R * 0.2), new V3(Math.cos(a) * R * 0.32, topAt(R * 0.32) + 6, Math.sin(a) * R * 0.32)], [r0 * 0.2, r0 * 0.16, r0 * 0.22], { radial: 5, segsPerPoint: 4 }); P.bone.push(t); } }
  // radial glow veins on the dome
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + 0.03; const pts = []; for (let k = 0; k <= 16; k++) { const rad = lerp(R * 0.97, R * 0.1, k / 16); pts.push(new V3(Math.cos(a) * rad, topAt(rad) * 1.004 + 3, Math.sin(a) * rad)); } P.vein.push(tube(pts, D * 0.0018, { radial: 4, segsPerPoint: 1 })); }
  // belly: central maw (ring of teeth + glowing core), radial ribs
  { const mawR = R * 0.2; const ring = torus(mawR, D * 0.008, 40, 6, { tile: 32 }); ring.translate(0, -hb * 0.97, 0); P.bone.push(ring);
    const core = new THREE.CircleGeometry(mawR * 0.96, 48); core.rotateX(Math.PI / 2); core.translate(0, -hb * 0.93, 0); P.glow.push(core);
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; const sp = spike(mawR * 0.55, mawR * 0.035, 5); place(sp, [Math.cos(a) * mawR * 0.97, -hb * 0.96, Math.sin(a) * mawR * 0.97], new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(-Math.cos(a) * 0.55, -1, -Math.sin(a) * 0.55).normalize())); P.bone.push(sp); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.26; const rad = R * 0.5; const ey = -bodyR(0) * 0 - hb * Math.pow(Math.max(0, 1 - Math.pow(rad / R, 2.3)), 1 / 2.3) * 0.99; const em = new THREE.ConeGeometry(D * 0.014, D * 0.03, 10, 1, true); em.rotateX(Math.PI); em.translate(Math.cos(a) * rad, ey - D * 0.012, Math.sin(a) * rad); P.bone.push(em);
      const eg = new THREE.CircleGeometry(D * 0.012, 12); eg.rotateX(Math.PI / 2); eg.translate(Math.cos(a) * rad, ey - D * 0.027, Math.sin(a) * rad); P.glow.push(eg); } }
  // rim thrusters (merged) + flames
  const flameGeo = [], coreGeo = []; const nRim = 24;
  for (let i = 0; i < nRim; i++) {
    const a = i / nRim * TAU + 0.07; const x = Math.cos(a) * R * 0.93, z = Math.sin(a) * R * 0.93, y = -hb * 0.28; const ro = D * 0.014, ln = D * 0.03;
    const b = revolve(ln, (t) => ro * (0.5 + 0.5 * Math.pow(t, 0.6)), { rings: 3, radial: 10, tile: 16 }); b.rotateX(Math.PI); b.translate(x, y, z); P.hull.push(b);
    const d = new THREE.CircleGeometry(ro * 0.9, 14); d.rotateX(Math.PI / 2); d.translate(x, y - ln * 0.55, z); P.glow.push(d);
    const fl = D * 0.2; const c = new THREE.CylinderGeometry(ro * 0.9, ro * 0.25, fl, 14, 1, true); c.translate(0, -fl / 2, 0); flipUV(c); c.translate(x, y - ln * 0.55, z); flameGeo.push(c);
    const c2 = new THREE.ConeGeometry(ro * 0.5, fl * 0.55, 10, 1, true); c2.rotateX(Math.PI); c2.translate(0, -fl * 0.275, 0); flipUV(c2); c2.translate(x, y - ln * 0.55, z); coreGeo.push(c2);
  }
  // greeble spikes and pods on the dome
  const spikes = [], pods = [];
  const domeP = (rad, a, off = 0) => { const y = topAt(rad); return new V3(Math.cos(a) * rad, y + off, Math.sin(a) * rad); };
  const domeN = (rad, a) => { const e = 5; const dy = (topAt(rad + e) - topAt(Math.max(0, rad - e))) / (2 * e); return new V3(-dy * Math.cos(a), 1, -dy * Math.sin(a)).normalize(); };
  const nS = seg(900, 300), nPod = seg(200, 80);
  for (let i = 0; i < nS; i++) { const rad = R * Math.sqrt(rng.range(0.02, 0.97)), a = rng.range(0, TAU); const len = rng.range(0.008, 0.024) * D; spikes.push({ p: domeP(rad, a, -2), n: domeN(rad, a), len, r: len * rng.range(0.07, 0.12) }); }
  for (let i = 0; i < nPod; i++) { const rad = R * Math.sqrt(rng.range(0.05, 0.95)), a = rng.range(0, TAU); const n = domeN(rad, a); pods.push({ p: domeP(rad, a, -1), n, sc: rng.range(0.007, 0.018) * D, tw: rng.range(-1, 1) }); }
  const add = (geos, mat, name) => { if (!geos.length) return null; const m = new THREE.Mesh(mergeAll(geos), mat); m.name = name; m.frustumCulled = false; root.add(m); return m; };
  add(P.hull, mHull, 'hull'); add(P.bone, mBone, 'bone'); add(P.glow, mGlow, 'glow'); add(P.vein, mGlowV, 'veins');
  root.add(instancedGreebles({ spikes, pods }, D, mHull, rng));
  const fm = new THREE.Mesh(mergeAll(flameGeo), mFlame); fm.frustumCulled = false; root.add(fm); const fm2 = new THREE.Mesh(mergeAll(coreGeo), mCore); fm2.frustumCulled = false; root.add(fm2);
  const mawHalo = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.5 })); mawHalo.position.set(0, -hb * 1.35, 0); mawHalo.scale.setScalar(R * 0.8); root.add(mawHalo);
  const st = { lights: 1, charge: 0.3, thrust: 0.6 };
  const ms = {
    root, size: D, diameter: D, radius: R, height: hu + hb + D * 0.62,
    update(dt, t) {
      const fl = 0.93 + 0.07 * Math.sin(t * 7.0) * Math.sin(t * 2.9); mFlame.uniforms.uPower.value = (0.3 + st.thrust * 1.5) * fl; mCore.uniforms.uPower.value = st.thrust * 2.2 * fl;
      const br = st.lights * (0.97 + 0.03 * Math.sin(t * 0.9)); mHull.emissiveIntensity = mHull.userData.baseEmissive * br; mBone.emissiveIntensity = mBone.userData.baseEmissive * br;
      mGlow.emissiveIntensity = (2.4 + st.charge * 4.0) * br * (0.93 + 0.07 * Math.sin(t * 3.1)); mGlowV.emissiveIntensity = 1.8 * br * (0.85 + 0.15 * Math.sin(t * 1.7));
      mawHalo.material.opacity = (0.15 + st.charge * 0.7) * st.lights;
    },
    setLights(v) { st.lights = clamp(v, 0, 1); }, setThrust(v) { st.thrust = clamp(v, 0, 1); }, setCharge(v) { st.charge = clamp(v, 0, 1); },
    setInfection(a) { infectAll(root, a); }, dispose() { disposeTree(root); },
  };
  ms.update(0, 0);
  return ms;
}
