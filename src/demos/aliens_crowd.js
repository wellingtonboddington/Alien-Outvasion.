// Vessari infantry (instanced, baked gait) + crawler swarm charging. Params: {n: infantry (400), m: crawlers (800), infect: 0..1 fraction of crawlers infected}
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createVessariCrowd, createCrawlerSwarm, CRAWLER_SPEED } from '../models/aliens/index.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: true, bg: 0x7d8b9c });
  const key = stage.scene.children[0].children.find((l) => l.isDirectionalLight);
  if (key) { const c = key.shadow.camera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.far = 160; key.shadow.mapSize.set(2048, 2048); c.updateProjectionMatrix(); key.position.set(30, 50, 25); }
  stage.scene.fog = new THREE.Fog(0x7d8b9c, 60, 180);
  const n = params.n ?? 400, m = params.m ?? 800;
  const inf = createVessariCrowd(n + 40); const cra = createCrawlerSwarm(m + 40);
  stage.scene.add(inf.root, cra.root);
  // infantry: three blocks (advancing run / walk, a firing line, a roaring officer cluster)
  const runN = Math.floor(n * 0.55);
  inf.spawnGroup({ n: runN, center: [0, -8], radius: 15, yawMean: 0, spread: 0.12, state: 'run', seed: 3 });
  inf.spawnGroup({ n: Math.floor(n * 0.2), center: [-24, -14], radius: 8, yawMean: 0.25, state: 'walk', seed: 4 });
  inf.spawnGroup({ n: Math.floor(n * 0.15), center: [24, -12], radius: 7, yawMean: -0.25, state: 'fire', seed: 5 });
  inf.spawnGroup({ n: Math.floor(n * 0.1), center: [0, -34], radius: 6, yawMean: 0, state: 'roar', seed: 6 });
  // crawlers ahead of the line
  const runM = Math.floor(m * 0.85);
  cra.spawnGroup({ n: runM, center: [0, 22], radius: 18, yawMean: 0, spread: 0.15, state: 'run', seed: 8, scale: [0.9, 1.15] });
  const first = cra.spawnGroup({ n: Math.floor(m * 0.08), center: [-12, 40], radius: 6, yawMean: 0.2, state: 'leap', seed: 9 });
  cra.spawnGroup({ n: Math.floor(m * 0.04), center: [14, 36], radius: 4, yawMean: -0.2, state: 'screech', seed: 10 });
  cra.spawnGroup({ n: Math.floor(m * 0.03), center: [0, 52], radius: 4, yawMean: 0, state: 'dead', seed: 11 });
  void first;
  if (params.infect) { for (let i = 0; i < cra.count; i++) if ((i * 7919 % 100) / 100 < params.infect) cra.set(i, { infect: 1 }); cra.commit(); }
  const o = {}; const vInf = 5.2, vCr = CRAWLER_SPEED.run * 1.0;
  return {
    update(t, dt) {
      inf.update(dt, t); cra.update(dt, t);
      for (let i = 0; i < runN; i++) { inf.get(i, o); inf.set(i, { x: o.x + vInf * o.speed * dt * Math.sin(o.yaw), z: o.z + vInf * o.speed * dt * Math.cos(o.yaw) }); }
      for (let i = 0; i < runM; i++) { cra.get(i, o); cra.set(i, { x: o.x + vCr * o.speed * dt * Math.sin(o.yaw), z: o.z + vCr * o.speed * dt * Math.cos(o.yaw) }); }
      inf.commit(); cra.commit();
    },
    shots: [
      { name: 'rear', t: 0.6, cam: [0, 7, -36, 0, 1.5, 18], fov: 42 },
      { name: 'side', t: 1.2, cam: [26, 3.0, 6, 0, 1.2, 18], fov: 42 },
      { name: 'front', t: 1.8, cam: [4, 1.8, 62, 0, 1.0, 20], fov: 46 },
    ],
  };
}
