// Instanced human crowds & zombie hordes: ONE draw call per kind (+1 optional blob-shadow call), all animation in the vertex shader.
// See docs/api/crowd.md. Contract: CONTRACT §3.2.
import * as THREE from 'three';
import { RNG, Q, disposeTree, GLOBAL } from '../engine/common.js';
import { getKind, KIND_NAMES } from './crowd/kinds.js';
import { makeUniforms, makeMaterial, makeDepthMaterial, makeBlobMaterial } from './crowd/shader.js';
import { getCrowdTextures } from './crowd/atlas.js';
import { ST, STATE, STATE_NAMES, NS } from './crowd/rig.js';
export { createCrowdSim } from './crowd/sim.js';
export { KIND_NAMES };

/** public state ids (what set({state}) accepts as strings or numbers) */
export { STATE };
const PUB2INT = [ST.idle, ST.walk, ST.run, ST.sprint, ST.aim, ST.fire, ST.crouch, ST.cower, ST.crawl, ST.lunge, ST.panic, ST.cough, ST.fall_b, ST.dead_b, ST.cheer];
const INT2PUB = []; PUB2INT.forEach((v, i) => { INT2PUB[v] = i; }); INT2PUB[ST.fall_f] = STATE.fall; INT2PUB[ST.dead_f] = STATE.dead;
const resolveState = (pub, seed) => (pub === STATE.fall ? (seed > 0.5 ? ST.fall_f : ST.fall_b) : pub === STATE.dead ? (seed > 0.5 ? ST.dead_f : ST.dead_b) : PUB2INT[pub]);
const stateId = (s) => (typeof s === 'number' ? s : (STATE[s] ?? 0));
const _col = new THREE.Color();

/** scale a nominal crowd size by the global quality knob (use for demos / director) */
export const crowdCount = (n) => Math.max(1, Math.round(n * Q.crowd));

export function createCrowd(kindName, capacity, opts = {}) {
  const kind = getKind(kindName);
  capacity = Math.max(1, capacity | 0);
  const seed0 = opts.seed ?? 1;
  const uniforms = makeUniforms(kind, kind.table, getCrowdTextures());
  uniforms.uKindV.value.y = kind.fireMul ?? 1;
  if (kind.lookWeight) uniforms.uLook.value.w = kind.lookWeight;

  // ---- instance buffers
  const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const aPos = mk(4), aAnim = mk(4), aLook = mk(4), aTrans = mk(4), aCol = mk(4), aInfect = mk(1);
  const geo = new THREE.InstancedBufferGeometry();
  const base = kind.geometry;
  for (const k of Object.keys(base.attributes)) geo.setAttribute(k, base.attributes[k]);
  geo.setIndex(base.index);
  geo.setAttribute('aPos', aPos); geo.setAttribute('aAnim', aAnim); geo.setAttribute('aLook', aLook); geo.setAttribute('aTrans', aTrans); geo.setAttribute('aCol', aCol); geo.setAttribute('aInfect', aInfect);
  geo.instanceCount = 0; geo.userData.shared = false;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-1e5, -1e5, -1e5), new THREE.Vector3(1e5, 1e5, 1e5));

  const material = makeMaterial(uniforms); material.userData.shared = false;
  const depth = makeDepthMaterial(uniforms);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'crowd_' + kindName; mesh.frustumCulled = opts.frustumCulled !== false;
  mesh.castShadow = opts.castShadow ?? (Q.shadows && Q.level >= 2); mesh.receiveShadow = opts.receiveShadow ?? true;
  mesh.customDepthMaterial = depth;
  const root = new THREE.Group(); root.name = 'crowd_root_' + kindName; root.add(mesh);

  // ---- optional blob shadow (shares instance attributes)
  let blob = null, blobGeo = null, blobMat = null;
  if (opts.blob ?? true) {
    blobGeo = new THREE.InstancedBufferGeometry();
    blobGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    blobGeo.setIndex([0, 1, 2, 0, 2, 3]);
    blobGeo.setAttribute('aPos', aPos); blobGeo.setAttribute('aAnim', aAnim); blobGeo.setAttribute('aLook', aLook); blobGeo.setAttribute('aTrans', aTrans);
    blobGeo.instanceCount = 0; blobGeo.boundingSphere = geo.boundingSphere; blobGeo.boundingBox = geo.boundingBox;
    blobMat = makeBlobMaterial(opts.blobOpacity ?? (Q.level === 0 ? 0.5 : 0.55));
    blobMat.uniforms.uStateInfo.value = kind.table.info; blobMat.uniforms.uTime = uniforms.uTime;
    blob = new THREE.Mesh(blobGeo, blobMat); blob.name = 'crowd_blob_' + kindName; blob.renderOrder = -1; blob.frustumCulled = mesh.frustumCulled;
    root.add(blob);
  }

  // ---- CPU-side bookkeeping
  const seedArr = new Float32Array(capacity), pubState = new Uint8Array(capacity), initd = new Uint8Array(capacity);
  const P = aPos.array, A = aAnim.array, Lk = aLook.array, Tr = aTrans.array, Co = aCol.array, In = aInfect.array;
  const hashSeed = (i) => { let h = (i * 2654435761 + (seed0 * 97 | 0) * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000; };

  const crowd = {
    root, mesh, blobMesh: blob, kind: kindName, capacity, count: 0, time: 0, uniforms,
    get triangles() { return kind.tris; },
    get drawCalls() { return blob ? 2 : 1; },

    /** set any subset of per-instance fields. x,y,z,yaw,scale,speed,phase,infect,tint(0..1),seed(0..1),state,variant,age('adult'|'kid'|'elder'),sex(0|1),color(hex|[r,g,b]),colorAmount,t0 */
    set(i, o) {
      if (i < 0 || i >= capacity) return crowd;
      const i4 = i * 4, first = !initd[i];
      if (first) {
        initd[i] = 1; const sd = o.seed ?? hashSeed(i); seedArr[i] = sd; Lk[i4] = sd;
        A[i4] = A[i4 + 1] = 0; A[i4 + 1] = 1; A[i4 + 3] = 1; Tr[i4] = 0; Tr[i4 + 1] = this.time; pubState[i] = 0;
        const r = new RNG((sd * 4294967 | 0) + 11); const age = kind.rollAge ? kind.rollAge(r) : 0, sex = kind.rollSex ? kind.rollSex(r) : 0;
        Lk[i4 + 3] = (typeof o.age === 'string' ? ({ adult: 0, kid: 1, elder: 2 }[o.age] ?? 0) : age) + 3 * (o.sex ?? sex);
        Lk[i4 + 2] = kind.rollVariant ? kind.rollVariant(r, Lk[i4 + 3] % 3, Math.floor(Lk[i4 + 3] / 3)) : 0;
        Lk[i4 + 1] = o.tint ?? r.next(); A[i4 + 3] = o.scale ?? kind.rollScale(r, Lk[i4 + 3] % 3);
        Tr[i4] = resolveState(0, sd);
        A[i4] = Tr[i4];
        In[i] = kind.defaultInfect ?? 0;
        Co[i4] = Co[i4 + 1] = Co[i4 + 2] = Co[i4 + 3] = 0;
      }
      if (o.seed !== undefined && !first) { seedArr[i] = o.seed; Lk[i4] = o.seed; }
      if (o.x !== undefined) P[i4] = o.x; if (o.y !== undefined) P[i4 + 1] = o.y; if (o.z !== undefined) P[i4 + 2] = o.z; if (o.yaw !== undefined) P[i4 + 3] = o.yaw;
      if (o.scale !== undefined) A[i4 + 3] = o.scale;
      if (o.tint !== undefined) Lk[i4 + 1] = o.tint;
      if (o.variant !== undefined) Lk[i4 + 2] = typeof o.variant === 'number' ? o.variant : kind.packVariant ? kind.packVariant(o.variant, Lk[i4 + 2]) : 0;
      if (o.age !== undefined && !first) Lk[i4 + 3] = (typeof o.age === 'string' ? ({ adult: 0, kid: 1, elder: 2 }[o.age] ?? 0) : o.age) + 3 * Math.floor(Lk[i4 + 3] / 3);
      if (o.sex !== undefined && !first) Lk[i4 + 3] = (Lk[i4 + 3] % 3) + 3 * o.sex;
      if (o.speed !== undefined && o.speed !== A[i4 + 1]) { if (o.phase === undefined && !first) A[i4 + 2] += this.time * (A[i4 + 1] - o.speed); A[i4 + 1] = o.speed; }
      if (o.phase !== undefined) A[i4 + 2] = o.phase;
      if (o.state !== undefined) {
        const pub = stateId(o.state); const ns = resolveState(pub, seedArr[i]);
        if (pub !== pubState[i] || first) { if (!first) Tr[i4] = A[i4]; pubState[i] = pub; A[i4] = ns; Tr[i4 + 1] = o.t0 ?? this.time; if (first) Tr[i4] = ns; }
      } else if (o.t0 !== undefined) Tr[i4 + 1] = o.t0;
      if (o.infect !== undefined) In[i] = o.infect;
      if (o.color !== undefined) { if (o.color === null) Co[i4 + 3] = 0; else { if (Array.isArray(o.color)) { Co[i4] = o.color[0]; Co[i4 + 1] = o.color[1]; Co[i4 + 2] = o.color[2]; } else { _col.set(o.color); Co[i4] = _col.r; Co[i4 + 1] = _col.g; Co[i4 + 2] = _col.b; } Co[i4 + 3] = o.colorAmount ?? 0.85; } }
      if (i >= crowd.count) crowd.count = Math.min(capacity, i + 1);
      return crowd;
    },
    /** allocation-free hot path: transform only */
    setTransform(i, x, y, z, yaw) { const i4 = i * 4; P[i4] = x; P[i4 + 1] = y; P[i4 + 2] = z; P[i4 + 3] = yaw; },
    /** allocation-free: change state (public id from STATE) and anim speed. keeps animation phase continuous when only the speed changes */
    setAnim(i, pubState_, speed) {
      const i4 = i * 4;
      if (speed !== A[i4 + 1]) { A[i4 + 2] += this.time * (A[i4 + 1] - speed); A[i4 + 1] = speed; }
      if (pubState_ !== pubState[i]) { Tr[i4] = A[i4]; pubState[i] = pubState_; A[i4] = resolveState(pubState_, seedArr[i]); Tr[i4 + 1] = this.time; }
    },
    stateOf(i) { return pubState[i]; },
    get(i, out = {}) {
      const i4 = i * 4; out.x = P[i4]; out.y = P[i4 + 1]; out.z = P[i4 + 2]; out.yaw = P[i4 + 3];
      out.state = STATE_NAMES[pubState[i]]; out.speed = A[i4 + 1]; out.phase = A[i4 + 2]; out.scale = A[i4 + 3];
      out.infect = In[i]; out.tint = Lk[i4 + 1]; out.seed = Lk[i4]; out.variant = Lk[i4 + 2]; out.age = ['adult', 'kid', 'elder'][Lk[i4 + 3] % 3]; out.sex = Math.floor(Lk[i4 + 3] / 3);
      return out;
    },
    setCount(n) { crowd.count = Math.max(0, Math.min(capacity, n | 0)); geo.instanceCount = crowd.count; if (blobGeo) blobGeo.instanceCount = crowd.count; return crowd; },
    /** upload instance data (call once after a batch of set()) and refresh the culling sphere */
    commit() {
      const n = crowd.count; geo.instanceCount = n; if (blobGeo) blobGeo.instanceCount = n;
      let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9, maxS = 1;
      for (let i = 0; i < n; i++) { const i4 = i * 4; const x = P[i4], y = P[i4 + 1], z = P[i4 + 2]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; if (A[i4 + 3] > maxS) maxS = A[i4 + 3]; }
      if (n > 0) {
        const c = geo.boundingSphere.center.set((minX + maxX) / 2, (minY + maxY) / 2 + 1, (minZ + maxZ) / 2);
        geo.boundingSphere.radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 3.6 * maxS * kind.heightScale;
        geo.boundingBox.min.set(minX - 2, minY - 0.5, minZ - 2); geo.boundingBox.max.set(maxX + 2, maxY + 3 * maxS * kind.heightScale, maxZ + 2);
      }
      for (const a of [aPos, aAnim, aLook, aTrans, aCol, aInfect]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); a.needsUpdate = true; }
      return crowd;
    },
    /** fill n new instances (appended at count) with varied looks. returns first index */
    spawnGroup({ n = 10, center = [0, 0], radius = 5, width, depth, shape, yawMean = 0, spread = 0.3, state = 'idle', seed = 1, speed, y = 0, scale, infect, tint, heightAt, speedVar = 0.08, jitter = 0.3, color, colorAmount, phaseSpan } = {}) {
      const first = crowd.count; const r = new RNG(seed * 7919 + first * 13 + seed0);
      const sh = shape || (width !== undefined ? 'rect' : 'disc'); const pub = stateId(state);
      const nominal = kind.nominal[STATE_NAMES[pub]];
      for (let k = 0; k < n && first + k < capacity; k++) {
        let x, z;
        if (sh === 'rect') { x = center[0] + (r.next() - 0.5) * (width ?? radius * 2); z = center[1] + (r.next() - 0.5) * (depth ?? radius * 2); }
        else if (sh === 'ring') { const a = r.range(0, Math.PI * 2); x = center[0] + Math.cos(a) * radius * (0.9 + 0.1 * r.next()); z = center[1] + Math.sin(a) * radius * (0.9 + 0.1 * r.next()); }
        else { const a = r.range(0, Math.PI * 2), rr = radius * Math.sqrt(r.next()); x = center[0] + Math.cos(a) * rr; z = center[1] + Math.sin(a) * rr; }
        const o = { x, z, y: heightAt ? heightAt(x, z) : y, yaw: yawMean + (r.next() - 0.5) * 2 * spread, state, seed: r.next(), speed: (speed ?? 1) * (1 + r.range(-speedVar, speedVar * 1.2)), phase: r.range(0, phaseSpan ?? 3) };
        if (scale !== undefined) o.scale = scale; if (infect !== undefined) o.infect = infect; if (tint !== undefined) o.tint = tint; if (color !== undefined) { o.color = color; o.colorAmount = colorAmount; }
        crowd.set(first + k, o);
      }
      crowd.count = Math.min(capacity, first + n);
      return first;
    },
    /** world point all agents turn their heads toward (null = off). weight 0..1 */
    lookAt(v, weight = 1) { const u = uniforms.uLook.value; if (!v) u.w = 0; else u.set(v.x ?? v[0], v.y ?? v[1], v.z ?? v[2], weight); return crowd; },
    setInfectAll(a) { for (let i = 0; i < capacity; i++) In[i] = a; aInfect.needsUpdate = true; return crowd; },
    /** nominal ground speed (m/s) of a locomotion state at anim speed 1 */
    nominalSpeed(state) { return kind.nominal[typeof state === 'number' ? STATE_NAMES[state] : state] ?? 1.4; },
    /** anim speed multiplier that makes `state` match a ground speed in m/s (no foot sliding) */
    speedFor(state, mps) { return Math.max(0.05, mps / crowd.nominalSpeed(state)); },
    /** max draw distance in metres (0 = unlimited); agents beyond are collapsed in the shader */
    setMaxDistance(d) { uniforms.uKindV.value.x = d; return crowd; },
    update(dt, t) { crowd.time = t ?? crowd.time + (dt || 0); uniforms.uTime.value = crowd.time; },
    dispose() { geo.dispose(); material.dispose(); depth.dispose(); if (blobGeo) blobGeo.dispose(); if (blobMat) blobMat.dispose(); root.removeFromParent(); },
    kindInfo: kind,
  };
  geo.instanceCount = 0;
  return crowd;
}
