// Shared "Crowd" implementation for instanced, vertex-shader animated aliens (Vessari infantry, crawler swarm).
// Interface (CONTRACT 3.2): { root, capacity, count, update(dt,t), dispose(), set(i,{x,y,z,yaw,state,speed,phase,scale,infect,tint,...}), setCount(n), get(i,out), commit(), spawnGroup({...}) }
import * as THREE from 'three';
import { RNG, GLOBAL } from '../../engine/common.js';

/**
 * geo: BufferGeometry (rest pose, per-vertex attributes already set). material: shader material using aAnim/aInfect/aTint/aExtra (declared here).
 * states: {name: id}. opts.extra: names of extra per-instance float fields (up to 2) e.g. ['leapDist','leapH'].
 */
export function createInstanceSet(capacity, geo, material, states, { timeUniform, extra = [], defaults = {}, castShadow = true, name = 'crowd' } = {}) {
  const cap = Math.max(1, capacity | 0);
  const root = new THREE.Group(); root.name = name;
  const mesh = new THREE.InstancedMesh(geo, material, cap); mesh.frustumCulled = false; mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.name = name + '_mesh';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(mesh);
  // per-instance attributes
  const aAnim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // state, phase, speed, t0
  const aInfect = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  const aTint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const aExtra = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
  for (const a of [aAnim, aInfect, aTint, aExtra]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAnim', aAnim); geo.setAttribute('aInfect', aInfect); geo.setAttribute('aTint', aTint); geo.setAttribute('aExtra', aExtra);
  // JS mirrors
  const D = new Float32Array(cap * 8); // x y z yaw scale | (spare)
  const stateName = []; for (const k in states) stateName[states[k]] = k;
  const crowd = { root, mesh, capacity: cap, count: 0, time: 0, states };
  for (let i = 0; i < cap; i++) { aAnim.array[i * 4 + 2] = 1; aTint.array[i * 3] = aTint.array[i * 3 + 1] = aTint.array[i * 3 + 2] = 1; D[i * 8 + 4] = 1; }
  const mat = new THREE.Matrix4();
  const writeMatrix = (i) => {
    const x = D[i * 8], y = D[i * 8 + 1], z = D[i * 8 + 2], yaw = D[i * 8 + 3], s = D[i * 8 + 4]; const c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s; const e = mesh.instanceMatrix.array, o = i * 16;
    e[o] = c; e[o + 1] = 0; e[o + 2] = -sn; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = s; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = sn; e[o + 9] = 0; e[o + 10] = c; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
  };
  const dirty = { a: true };
  crowd.set = (i, o = {}) => {
    if (i < 0 || i >= cap) return crowd; const b = i * 8;
    if (o.x !== undefined) D[b] = o.x; if (o.y !== undefined) D[b + 1] = o.y; if (o.z !== undefined) D[b + 2] = o.z; if (o.yaw !== undefined) D[b + 3] = o.yaw; if (o.scale !== undefined) D[b + 4] = o.scale;
    writeMatrix(i);
    if (o.state !== undefined) { const id = typeof o.state === 'number' ? o.state : (states[o.state] ?? 0); if (aAnim.array[i * 4] !== id || o.t0 !== undefined) aAnim.array[i * 4 + 3] = o.t0 !== undefined ? o.t0 : crowd.time; aAnim.array[i * 4] = id; }
    if (o.phase !== undefined) aAnim.array[i * 4 + 1] = o.phase; if (o.speed !== undefined) aAnim.array[i * 4 + 2] = o.speed;
    if (o.infect !== undefined) aInfect.array[i] = o.infect;
    if (o.tint !== undefined) { const t = o.tint; if (typeof t === 'number') { aTint.array[i * 3] = aTint.array[i * 3 + 1] = aTint.array[i * 3 + 2] = t; } else if (Array.isArray(t)) { aTint.array[i * 3] = t[0]; aTint.array[i * 3 + 1] = t[1]; aTint.array[i * 3 + 2] = t[2]; } else { aTint.array[i * 3] = t.r; aTint.array[i * 3 + 1] = t.g; aTint.array[i * 3 + 2] = t.b; } }
    for (let k = 0; k < extra.length; k++) if (o[extra[k]] !== undefined) aExtra.array[i * 2 + k] = o[extra[k]];
    if (i >= crowd.count) { /* implicit growth is not applied: use setCount */ }
    return crowd;
  };
  crowd.get = (i, out = {}) => {
    const b = i * 8; out.x = D[b]; out.y = D[b + 1]; out.z = D[b + 2]; out.yaw = D[b + 3]; out.scale = D[b + 4]; out.state = stateName[aAnim.array[i * 4]]; out.phase = aAnim.array[i * 4 + 1]; out.speed = aAnim.array[i * 4 + 2]; out.infect = aInfect.array[i];
    out.tint = out.tint || [1, 1, 1]; out.tint[0] = aTint.array[i * 3]; out.tint[1] = aTint.array[i * 3 + 1]; out.tint[2] = aTint.array[i * 3 + 2]; for (let k = 0; k < extra.length; k++) out[extra[k]] = aExtra.array[i * 2 + k]; return out;
  };
  crowd.setCount = (n) => { crowd.count = Math.max(0, Math.min(cap, n | 0)); mesh.count = crowd.count; return crowd; };
  crowd.commit = () => { mesh.instanceMatrix.needsUpdate = true; aAnim.needsUpdate = true; aInfect.needsUpdate = true; aTint.needsUpdate = true; aExtra.needsUpdate = true; mesh.count = crowd.count; return crowd; };
  crowd.update = (dt, t) => {
    if (t === undefined) t = crowd.time + dt; crowd.time = t; if (timeUniform) timeUniform.value = t; mesh.count = crowd.count;
  };
  /**
   * Fill `n` instances (appended after the current count) with varied looks inside a disc.
   * opts: {n, center:[x,z], radius, yawMean, spread (yaw jitter rad), state, seed, speed:[a,b], scale:[a,b], infect, y, spacing, tint:bool, phase}
   * Returns the index of the first created instance.
   */
  crowd.spawnGroup = (o = {}) => {
    const n = Math.max(0, Math.min(o.n ?? 10, cap - crowd.count)); const first = crowd.count; const rng = new RNG((o.seed ?? 1) * 7919 + first + 1);
    const [cx, cz] = o.center || [0, 0]; const R = o.radius ?? 8; const yawM = o.yawMean ?? 0, spread = o.spread ?? 0.2; const sp = o.speed || [0.9, 1.1], sc = o.scale || [0.94, 1.08];
    const side = Math.ceil(Math.sqrt(n * 1.4)); const cell = (2 * R) / side; const cells = []; for (let a = 0; a < side; a++) for (let b = 0; b < side; b++) cells.push([a, b]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    let placed = 0;
    for (let k = 0; k < cells.length && placed < n; k++) {
      const x = -R + (cells[k][0] + 0.15 + rng.next() * 0.7) * cell, z = -R + (cells[k][1] + 0.15 + rng.next() * 0.7) * cell; if (x * x + z * z > R * R * 1.05) continue;
      // rotate offset so the group's local +z follows yawMean (group faces yawMean)
      const cs = Math.cos(yawM), sn = Math.sin(yawM); const wx = cx + x * cs + z * sn, wz = cz - x * sn + z * cs;
      const tint = o.tint === false ? [1, 1, 1] : [0.86 + rng.next() * 0.26, 0.86 + rng.next() * 0.24, 0.80 + rng.next() * 0.3];
      crowd.set(first + placed, { x: wx, y: o.y ?? 0, z: wz, yaw: yawM + (rng.next() * 2 - 1) * spread, scale: sc[0] + rng.next() * (sc[1] - sc[0]), speed: sp[0] + rng.next() * (sp[1] - sp[0]), phase: o.phase ?? rng.next() * 3, state: o.state ?? 'idle', infect: o.infect ?? 0, tint });
      placed++;
    }
    crowd.setCount(first + placed); crowd.commit(); return first;
  };
  crowd.dispose = () => { geo.dispose(); material.dispose(); if (mesh.customDepthMaterial) mesh.customDepthMaterial.dispose(); mesh.dispose?.(); };
  crowd.setInfectAll = (v) => { for (let i = 0; i < crowd.count; i++) aInfect.array[i] = v; aInfect.needsUpdate = true; };
  return crowd;
}
