// Vessari POD: a floating egg/lens shell ~2.6 m wide, three glowing ports, laser prongs underneath, shimmering thruster ring.
// createPod(seed) hero + createPodSwarm(capacity) instanced swarm (one draw call, shader hover/prong spin, per-instance infection).
import * as THREE from 'three';
import { RNG, GLOBAL, Q, seg, damp, clamp, lerp, TAU } from '../../engine/common.js';
import { disposeTree } from '../../engine/common.js';
import { tube } from '../../engine/geo.js';
import { infectable } from '../../engine/infect.js';
import { shellMat, fleshMat, glowMat, flameMat, haloMat, infectAll, CYAN, GREEN } from './mats.js';
import { revolve, surface, blob, spike, place, smoothNormals, scaleUV, mergeAll, sstep, alignY, orient, torus } from './kit.js';
import { shellTextures } from './tex.js';

// ---- shared hull profile: egg-lens, flatter underneath. y in [-0.62, 1.08]
const YB = -0.62, YT = 1.08, R0 = 1.3;
export function podRadius(y) { const s = y >= 0 ? y / YT : y / -YB; const p = 2.3; return R0 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), p)), 1 / p); }
const PORTS = [{ az: 0.46, y: 0.36 }, { az: -0.46, y: 0.36 }, { az: 0, y: -0.03 }];
function portPos(p, off = 0, out = new THREE.Vector3()) { const r = podRadius(p.y) + off; return out.set(Math.sin(p.az) * r, p.y, Math.cos(p.az) * r); }
function portNormal(p, out = new THREE.Vector3()) { // numeric surface normal of the revolved profile
  const e = 0.02, r0 = podRadius(p.y - e), r1 = podRadius(p.y + e); const dr = (r1 - r0) / (2 * e); return out.set(Math.sin(p.az), -dr, Math.cos(p.az)).normalize(); }
function ringAt(y, r, tubeR, rad = 10, tub = 5, tile = 0.9) { const g = torus(r, tubeR, rad, tub, { tile }); g.translate(0, y, 0); return g; }

function hullGeo(detail = 1) {
  const radial = seg(36, 12) * (detail > 1 ? 1 : 1), rings = seg(28, 10);
  const g = revolve(YT - YB, (t, yy, a) => {
    const y = YB + yy; let r = podRadius(y);
    r *= 1 + 0.018 * Math.cos(a * 9) * Math.sin(Math.PI * t) + 0.008 * Math.sin(a * 23 + y * 7);
    return r;
  }, { rings, radial, tile: 2.4, ratio: 1 });
  g.translate(0, YB, 0); return g;
}
/** scalloped bone-tan carapace plates covering the crown of the hull */
function capGeo() {
  const nu = seg(48, 16), nv = 10;
  const g = surface(nu, nv, (u, w, o) => {
    const a = u * TAU; const edge = 0.62 + 0.075 * Math.cos(a * 8) + 0.02 * Math.sin(a * 3 + 1);       // petal-scalloped lower rim
    const y = lerp(edge, YT - 0.002, Math.pow(w, 0.85));
    const lift = 0.05 * Math.sin(Math.PI * Math.min(1, w * 3.2) * 0.5 + 0.35) + 0.012 * Math.cos(a * 8) * Math.min(1, w * 4);
    const r = podRadius(y) + 0.015 + lift * (w < 0.999 ? 1 : 0.8);
    o.set(Math.sin(a) * r, y, Math.cos(a) * r);
  }, { uvScale: [5, 2] });
  return orient(g, 0, 0.2, 0);
}
function ribGeos() {
  const out = [];
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a = (k + 0.5) / n * TAU; const pts = [];
    for (let i = 0; i <= 8; i++) { const y = lerp(-0.42, 0.66, i / 8); const r = podRadius(y) + 0.012; pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r)); }
    const g = tube(pts, [0.03, 0.045, 0.05, 0.05, 0.048, 0.044, 0.04, 0.034, 0.02], { radial: 6, segsPerPoint: 3 }); scaleUV(g, 1, 6); out.push(g);
  }
  return mergeAll(out);
}
function portParts(hero) {
  const bezel = [], lens = [], brow = [], spikes = [];
  const rng = new RNG(77);
  for (const p of PORTS) {
    const pos = portPos(p, 0.012), n = portNormal(p);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const bz = new THREE.TorusGeometry(0.205, 0.05, 8, 20); scaleUV(bz, 4, 1); place(bz, [pos.x, pos.y, pos.z], q); bezel.push(bz);
    const ln = new THREE.SphereGeometry(0.165, 16, 10); ln.scale(1, 1, 0.55); smoothNormals(ln); place(ln, [pos.x + n.x * 0.01, pos.y + n.y * 0.01, pos.z + n.z * 0.01], q); lens.push(ln);
    // brow plate (shell) above each port
    const bw = new THREE.SphereGeometry(0.3, 12, 6, 0, TAU, 0, 1.0); bw.scale(1, 0.4, 0.8); smoothNormals(bw);
    const qb = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, 0, 0)));
    const pb = pos.clone().addScaledVector(n, -0.02).add(new THREE.Vector3(0, 0.17, 0)); place(bw, [pb.x, pb.y, pb.z], qb); brow.push(bw);
    for (let i = 0; i < 6; i++) { const ang = rng.range(0, TAU), rr = 0.26 + rng.range(0, 0.04); const sp = spike(rng.range(0.1, 0.22), 0.012, 4); const lp = new THREE.Vector3(Math.cos(ang) * rr, Math.sin(ang) * rr, 0.0).applyQuaternion(q).add(pos); const sq = alignY(n.clone().add(new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).applyQuaternion(q).multiplyScalar(0.7))); place(sp, [lp.x, lp.y, lp.z], sq); spikes.push(sp); }
  }
  return { bezel: mergeAll(bezel), lens: mergeAll(lens), brow: mergeAll(brow), spikes: mergeAll(spikes) };
}
function prongCurve(az) { // prong path (local, az rotation about Y applied by caller)
  return [new THREE.Vector3(0.18, -0.46, 0), new THREE.Vector3(0.34, -0.78, 0), new THREE.Vector3(0.40, -1.15, 0), new THREE.Vector3(0.30, -1.55, 0)];
}

/** createPod(seed) -> hero */
export function createPod(seed = 1, opts = {}) {
  const rng = new RNG(seed * 31 + 7);
  const root = new THREE.Group(); root.name = 'Pod';
  const body = new THREE.Group(); root.add(body);     // bob / tilt happen here
  const mFlesh = fleshMat(), mShell = shellMat(), mGlow = glowMat(3.4), mPort = glowMat(3.4), mGlow2 = glowMat(3.0);
  const mFlameRing = flameMat({ power: 1.0, fall: 2.0, rim: 1.6, seed }), mFlameCore = flameMat({ power: 1.6, fall: 2.6, rim: 1.0, seed: seed + 1 });
  const add = (g, m, parent = body, shadow = true) => { const me = new THREE.Mesh(g, m); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me; };
  // static parts are merged per material
  const st = { flesh: [], shell: [], port: [] };
  const S = (g, k) => { st[k].push(g); return g; };
  S(hullGeo(), 'flesh'); S(capGeo(), 'shell'); S(ribGeos(), 'shell');
  S(ringAt(0.0, podRadius(0) + 0.012, 0.05, seg(48, 16), 6), 'shell');                 // equator belt
  S(ringAt(-0.4, podRadius(-0.4) + 0.012, 0.035, seg(48, 16), 5), 'shell');            // lower belt
  { const sp = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const g = spike(0.36 - (i % 2) * 0.12, 0.03, 5); place(g, [Math.sin(a) * 0.16, YT - 0.02, Math.cos(a) * 0.16], new THREE.Euler(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5)); sp.push(g); } S(mergeAll(sp), 'shell'); }
  const pp = portParts(true);
  S(pp.bezel, 'flesh'); S(pp.lens, 'port'); S(pp.brow, 'shell'); S(pp.spikes, 'shell');
  S(revolve(0.34, (t) => 0.3 + 0.12 * Math.sin(t * Math.PI) - t * 0.12, { rings: 6, radial: 14, tile: 1.5 }).translate(0, -0.78, 0), 'shell');   // hub
  S(ringAt(-0.5, 1.0, 0.1, seg(40, 16), 8), 'flesh');                                  // thruster housing
  for (const k of Object.keys(st)) { if (!st[k].length) continue; const me = add(mergeAll(st[k]), k === 'flesh' ? mFlesh : k === 'shell' ? mShell : mPort, body, k !== 'port'); me.name = 'pod_' + k; }
  add(ringAt(-0.585, 0.98, 0.045, seg(40, 16), 6), mGlow2, body, false);
  // additive shimmer cones under the pod
  const cone = new THREE.CylinderGeometry(0.97, 0.62, 1.1, seg(32, 12), 1, true); cone.translate(0, -0.6 - 0.55, 0);
  { const uv = cone.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
  const flame = add(cone, mFlameRing, body, false);
  const cone2 = new THREE.ConeGeometry(0.5, 0.9, seg(20, 10), 1, true); cone2.rotateX(Math.PI); cone2.translate(0, -0.55 - 0.45, 0);
  { const uv = cone2.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
  const flameCore = add(cone2, mFlameCore, body, false);
  // prong assembly (spins): merged flesh / shell / glow tips + 3 halo sprites
  const prongs = new THREE.Group(); body.add(prongs);
  const pf = [], ps = [], pg = [], tips = [];
  for (let k = 0; k < 3; k++) {
    const az = k * TAU / 3; const g = tube(prongCurve(az), [0.075, 0.06, 0.04, 0.008], { radial: 6, segsPerPoint: 4 }); scaleUV(g, 2, 3); g.rotateY(az); pf.push(g);
    const col = new THREE.SphereGeometry(0.1, 8, 6); col.scale(1, 0.7, 1); col.translate(0.19, -0.5, 0); col.rotateY(az); ps.push(col);
    const col2 = new THREE.SphereGeometry(0.085, 8, 6); col2.scale(1, 0.7, 1); col2.translate(0.37, -0.95, 0); col2.rotateY(az); ps.push(col2);
    const tg = new THREE.SphereGeometry(0.055, 8, 6); tg.translate(0.30 * Math.cos(az), -1.57, -0.30 * Math.sin(az)); pg.push(tg);
    const halo = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.8 })); halo.position.set(0.30 * Math.cos(az), -1.57, -0.30 * Math.sin(az)); halo.scale.setScalar(0.4); prongs.add(halo);
    const tipHolder = new THREE.Object3D(); tipHolder.position.copy(halo.position); tipHolder.userData.halo = halo; prongs.add(tipHolder); tips.push(tipHolder);
  }
  add(mergeAll(pf), mFlesh, prongs); add(mergeAll(ps), mShell, prongs); add(mergeAll(pg), mGlow, prongs, false);
  // small tendrils hanging under the rear (sway together)
  const whips = new THREE.Group(); body.add(whips);
  { const wg = []; for (let k = 0; k < 4; k++) {
      const a = Math.PI + (k - 1.5) * 0.5; const base = new THREE.Vector3(Math.sin(a) * 0.7, -0.42, Math.cos(a) * 0.7);
      const pts = [base.clone(), base.clone().add(new THREE.Vector3(0, -0.35, 0)), base.clone().add(new THREE.Vector3(Math.sin(a) * 0.06, -0.75, Math.cos(a) * 0.06)), base.clone().add(new THREE.Vector3(Math.sin(a) * 0.1, -1.05, Math.cos(a) * 0.1))];
      const g = tube(pts, [0.03, 0.022, 0.014, 0.004], { radial: 5, segsPerPoint: 3 }); scaleUV(g, 1, 2); wg.push(g); }
    add(mergeAll(wg), mFlesh, whips, false); whips.position.set(0, -0.42, -0.7); whips.children[0].position.set(0, 0.42, 0.7); }
  // port halos
  const halos = [];
  for (const p of PORTS) { const hm = haloMat({ color: CYAN, opacity: 0.55 }); const h = new THREE.Sprite(hm); portPos(p, 0.12, h.position); h.scale.setScalar(0.75); body.add(h); halos.push(h); }

  const muzzleW = tips.map(() => new THREE.Vector3());
  const st2 = { thrust: 0.4, charge: 0, flash: 0, infect: 0, yaw: 0, aim: new THREE.Vector3(), hasAim: false, pitchT: 0, spin: 0, phase: rng.range(0, TAU) };
  const tmp = new THREE.Vector3();
  const pod = {
    root, body, height: 2.0, radius: R0,
    update(dt, t) {
      const ph = st2.phase;
      const bob = Math.sin(t * 1.9 + ph) * 0.07 + Math.sin(t * 3.1 + ph * 2.0) * 0.015;
      body.position.y = bob * (1 - st2.thrust * 0.4);
      let yawTo = 0, pitchTo = 0;
      if (st2.hasAim) { root.updateWorldMatrix(true, false); tmp.copy(st2.aim); root.worldToLocal(tmp); yawTo = Math.atan2(tmp.x, tmp.z); pitchTo = -Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)); }
      st2.yaw = damp(st2.yaw, clamp(yawTo, -1.2, 1.2), 5, dt); st2.pitchT = damp(st2.pitchT, clamp(pitchTo, -0.6, 0.6), 5, dt);
      body.rotation.set(st2.pitchT * 0.5 + Math.sin(t * 1.3 + ph) * 0.025 + st2.thrust * 0.1, st2.yaw, Math.sin(t * 1.1 + ph * 1.7) * 0.03 - st2.yaw * 0.05, 'YXZ');
      st2.flash = Math.max(0, st2.flash - dt * 4);
      const chg = clamp(st2.charge + st2.flash, 0, 1.4);
      st2.spin += dt * (1.2 + chg * 9.0); prongs.rotation.y = st2.spin;
      for (const tp of tips) { const hl = tp.userData.halo; hl.material.opacity = 0.25 + chg * 0.9; hl.scale.setScalar(0.25 + chg * 0.55); }
      mGlow.emissiveIntensity = 3.0 + chg * 4.0; mPort.emissiveIntensity = 3.2 + 0.4 * Math.sin(t * 2.2 + ph);
      const flick = 0.85 + 0.15 * Math.sin(t * 37.0 + ph) * Math.sin(t * 13.0);
      mFlameRing.uniforms.uPower.value = (0.1 + st2.thrust * 1.1) * flick; mFlameCore.uniforms.uPower.value = st2.thrust * 1.8 * flick;
      mGlow2.emissiveIntensity = (1.2 + st2.thrust * 3.4) * flick;
      flame.scale.set(1, 0.6 + st2.thrust * 0.9, 1); flameCore.scale.set(1, 0.4 + st2.thrust * 1.2, 1);
      for (let i = 0; i < halos.length; i++) halos[i].material.opacity = 0.4 + 0.15 * Math.sin(t * 2.3 + i * 2.1 + ph);
      whips.rotation.x = Math.sin(t * 1.4 + ph) * 0.12; whips.rotation.z = Math.sin(t * 1.1 + 2.7) * 0.1;
    },
    setThrust(v) { st2.thrust = clamp(v, 0, 1); },
    /** aim the three ports / prongs at a world point (null releases) */
    aimAt(v) { if (v) { st2.aim.copy(v); st2.hasAim = true; } else st2.hasAim = false; },
    /** 0..1 prong charge glow (sustained) */
    setCharge(v) { st2.charge = clamp(v, 0, 1); },
    /** fire flash on the prongs; returns the 3 world-space muzzle positions (reused array) */
    fire() { st2.flash = 1; return pod.muzzles(); },
    muzzles() { body.updateWorldMatrix(true, true); for (let i = 0; i < tips.length; i++) tips[i].getWorldPosition(muzzleW[i]); return muzzleW; },
    setInfection(a) { st2.infect = a; infectAll(root, a); },
    dispose() { disposeTree(root); },
  };
  return pod;
}

// ===================================================================================================================================
//  SWARM
// ===================================================================================================================================
export function createPodSwarm(capacity = 800, opts = {}) {
  const cap = capacity;
  // build merged geometry preserving custom attributes via BufferGeometryUtils directly
  const geo = swarmGeometryMerged();
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; for (const k in geo.attributes) ig.setAttribute(k, geo.attributes[k]);
  const aPS = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage); // phase, state, -, -
  const aInfect = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
  ig.setAttribute('aPS', aPS); ig.setAttribute('aInfect', aInfect);
  const sh = shellTextures();
  const mat = new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: sh.orm, roughness: 0.9, metalness: 0.05, vertexColors: true, envMapIntensity: 1.0 });
  const uniforms = { uTimeP: { value: 0 }, uGlowCol: { value: new THREE.Color(CYAN).multiplyScalar(3.4) } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aGlow; attribute float aSpin; attribute vec4 aPS; uniform float uTimeP;
        varying float vGlow; varying vec2 vPS;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float spinAng = aSpin * (uTimeP * (aPS.y > 1.5 ? 0.4 : (aPS.y > 0.5 ? 9.0 : 2.4)) + aPS.x * 6.2831);
        float scA = cos(spinAng), ssA = sin(spinAng);
        objectNormal = vec3(scA * objectNormal.x + ssA * objectNormal.z, objectNormal.y, -ssA * objectNormal.x + scA * objectNormal.z);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = vec3(scA * transformed.x + ssA * transformed.z, transformed.y, -ssA * transformed.x + scA * transformed.z);
        { float live = aPS.y > 1.5 ? 0.0 : 1.0; float ph = aPS.x * 6.2831;
          float bob = (sin(uTimeP * 1.9 + ph) * 0.07 + sin(uTimeP * 3.1 + ph * 2.0) * 0.015) * live;
          float wob = (aPS.y > 1.5 ? sin(uTimeP * 2.3 + ph) * 0.15 : sin(uTimeP * 1.3 + ph) * 0.025);
          float cw = cos(wob), sw = sin(wob);
          transformed = vec3(cw * transformed.x - sw * transformed.y, sw * transformed.x + cw * transformed.y, transformed.z);
          objectNormal = vec3(cw * objectNormal.x - sw * objectNormal.y, sw * objectNormal.x + cw * objectNormal.y, objectNormal.z);
          transformed.y += bob; }
        vGlow = aGlow; vPS = aPS.xy;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTimeP; uniform vec3 uGlowCol; varying float vGlow; varying vec2 vPS;`)
      .replace('#include <emissivemap_fragment>', `
        { float st = vPS.y; float gl = st > 1.5 ? 0.03 : (st > 0.5 ? 1.6 : 1.0);
          float pulse = 0.8 + 0.2 * sin(uTimeP * 13.0 + vPS.x * 40.0) * sin(uTimeP * 5.0 + vPS.x * 11.0);
          totalEmissiveRadiance += uGlowCol * vGlow * gl * pulse; }
        #include <emissivemap_fragment>`);
  };
  infectable(mat, { instanced: true });
  // NOTE: instancing via InstancedMesh needs its own instanceMatrix; we create it manually on a plain InstancedMesh sharing ig.
  const mesh = new THREE.InstancedMesh(ig, mat, cap); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'PodSwarm';
  const root = new THREE.Group(); root.add(mesh); root.name = 'PodSwarm';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), s = new THREE.Vector3();
  const STATES = { hover: 0, dive: 1, dead: 2 };
  const store = { x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap), yaw: new Float32Array(cap), pitch: new Float32Array(cap), roll: new Float32Array(cap), scale: new Float32Array(cap).fill(1), state: new Uint8Array(cap) };
  let count = 0; const rngp = new RNG(5);
  const sw = {
    root, capacity: cap, mesh,
    get count() { return count; },
    setCount(n) { count = Math.min(cap, Math.max(0, n | 0)); mesh.count = count; return sw; },
    /** set(i,{x,y,z,yaw,pitch,roll,scale,infect,phase,state:'hover'|'dive'|'dead'}) ; call commit() after a batch. pitch>0 = nose up, roll>0 = bank right. */
    set(i, o) {
      if (i >= cap) return sw; if (i >= count) { count = i + 1; mesh.count = count; }
      if (o.x !== undefined) store.x[i] = o.x; if (o.y !== undefined) store.y[i] = o.y; if (o.z !== undefined) store.z[i] = o.z;
      if (o.yaw !== undefined) store.yaw[i] = o.yaw; if (o.pitch !== undefined) store.pitch[i] = o.pitch; if (o.roll !== undefined) store.roll[i] = o.roll; if (o.scale !== undefined) store.scale[i] = o.scale;
      if (o.phase !== undefined) aPS.array[i * 4] = ((o.phase % 1) + 1) % 1;
      if (o.state !== undefined) { const v = typeof o.state === 'string' ? (STATES[o.state] ?? 0) : o.state; store.state[i] = v; aPS.array[i * 4 + 1] = v; }
      if (o.infect !== undefined) aInfect.array[i] = o.infect;
      writeMatrix(i); return sw;
    },
    get(i, out = {}) { out.x = store.x[i]; out.y = store.y[i]; out.z = store.z[i]; out.yaw = store.yaw[i]; out.pitch = store.pitch[i]; out.roll = store.roll[i]; out.scale = store.scale[i]; out.infect = aInfect.array[i]; out.phase = aPS.array[i * 4]; out.state = ['hover', 'dive', 'dead'][store.state[i]]; return out; },
    commit() { mesh.instanceMatrix.needsUpdate = true; aPS.needsUpdate = true; aInfect.needsUpdate = true; return sw; },
    update(dt, t) { uniforms.uTimeP.value = typeof t === 'number' ? t : uniforms.uTimeP.value + dt; },
    /** world position of instance i muzzle area (underside), handy for aiming beams */
    muzzle(i, out = new THREE.Vector3()) { out.set(store.x[i], store.y[i] - 1.5 * store.scale[i], store.z[i]); return out; },
    setInfectionAll(a) { for (let i = 0; i < cap; i++) aInfect.array[i] = a; aInfect.needsUpdate = true; },
    dispose() { ig.dispose(); mat.dispose(); mesh.dispose?.(); },
  };
  function writeMatrix(i) {
    const st = store.state[i]; let pitch = store.pitch[i], roll = store.roll[i];
    if (st === 1) pitch -= 0.8; else if (st === 2) { pitch += 0.55; roll += 0.7; }
    e.set(-pitch, store.yaw[i], roll, 'YXZ'); q.setFromEuler(e); p.set(store.x[i], store.y[i], store.z[i]); s.setScalar(store.scale[i]);
    m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
  }
  return sw;
}
function swarmGeometryMerged() {
  // Build then merge with custom attributes retained
  const parts = [];
  const mk = (g, color, glow = 0, spin = 0) => {
    const n = g.attributes.position.count; const c = new Float32Array(n * 3), gl = new Float32Array(n).fill(glow), sp = new Float32Array(n).fill(spin);
    if (!g.attributes.color) { const col = new THREE.Color(color); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); g.setAttribute('aSpin', new THREE.BufferAttribute(sp, 1));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aGlow', 'aSpin'].includes(k)) g.deleteAttribute(k);
    if (!g.index) { const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    return g;
  };
  const hull = revolve(YT - YB, (t, yy) => podRadius(YB + yy), { rings: 8, radial: 12, tile: 2.6 }); hull.translate(0, YB, 0);
  { const p = hull.attributes.position; const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getX(i), p.getZ(i)); const edge = 0.42 + 0.1 * Math.sin(a * 5 + 0.6); const k = sstep(edge - 0.1, edge + 0.08, y);
      c[i * 3] = lerp(0.13, 1.0, k); c[i * 3 + 1] = lerp(0.28, 1.0, k); c[i * 3 + 2] = lerp(0.70, 1.0, k); }
    hull.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  parts.push(mk(hull, 0xffffff));
  for (const p of PORTS) { const pos = portPos(p, 0.0), n = portNormal(p); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const ln = new THREE.SphereGeometry(0.19, 6, 3); ln.scale(1, 1, 0.5); place(ln, [pos.x + n.x * 0.02, pos.y + n.y * 0.02, pos.z + n.z * 0.02], q); parts.push(mk(ln, 0x0a1218, 1.0)); }
  for (let k = 0; k < 3; k++) { const az = k * TAU / 3;
    const g = new THREE.CylinderGeometry(0.075, 0.015, 1.1, 4, 1, false); g.translate(0, -0.55, 0); g.rotateZ(0.26); g.translate(0.2, -0.45, 0); g.rotateY(az); parts.push(mk(g, 0x3a4e5e, 0, 1));
    const tg = new THREE.OctahedronGeometry(0.075, 0); tg.translate(0.2 + Math.sin(0.26) * 1.1, -0.45 - Math.cos(0.26) * 1.1, 0); tg.rotateY(az); parts.push(mk(tg, 0x0a1218, 1.3, 1)); }
  const th = new THREE.CylinderGeometry(0.98, 0.5, 0.2, 12, 1, true); th.translate(0, -0.6, 0); parts.push(mk(th, 0x06101a, 0.85));
  return mergeGeometriesLocal(parts);
}
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
function mergeGeometriesLocal(list) { return mergeGeometries(list, false); }
