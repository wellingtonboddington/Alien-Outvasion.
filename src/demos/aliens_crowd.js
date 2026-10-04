// 400 Vessari infantry + 800 crawlers charging, plus state showcase. Params: {n, m, infect}
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createVessariCrowd } from '../models/aliens/index.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: true, bg: 0x6a7a8c });
  const key = stage.scene.children[0].children.find((l) => l.isDirectionalLight); if (key) { key.shadow.camera.left = -60; key.shadow.camera.right = 60; key.shadow.camera.top = 60; key.shadow.camera.bottom = -60; key.shadow.camera.far = 120; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.updateProjectionMatrix(); }
  const n = params.n ?? 400; const crowd = createVessariCrowd(n + 30); stage.scene.add(crowd.root);
  const states = ['walk', 'run', 'aim', 'fire', 'roar', 'idle'];
  let idx = 0;
  idx = crowd.spawnGroup({ n: Math.floor(n * 0.5), center: [0, 0], radius: 14, yawMean: 0, spread: 0.15, state: 'run', seed: 3 });
  crowd.spawnGroup({ n: Math.floor(n * 0.2), center: [-20, -12], radius: 7, yawMean: 0.3, state: 'walk', seed: 4 });
  crowd.spawnGroup({ n: Math.floor(n * 0.15), center: [20, -10], radius: 6, yawMean: -0.3, state: 'fire', seed: 5 });
  crowd.spawnGroup({ n: Math.floor(n * 0.15), center: [0, 24], radius: 6, yawMean: Math.PI, state: 'aim', seed: 6 });
  return {
    update(t, dt) {
      crowd.update(dt, t);
      // simple advance for the running group
      const o = {}; for (let i = 0; i < Math.floor(n * 0.5); i++) { crowd.get(i, o); crowd.set(i, { z: o.z + 5.0 * o.speed * dt * Math.cos(o.yaw), x: o.x + 5.0 * o.speed * dt * Math.sin(o.yaw) }); }
      crowd.commit();
    },
    shots: [{ name: 'a', t: 0.5, cam: [0, 6, -26, 0, 1.2, 4], fov: 40 }, { name: 'b', t: 2.0, cam: [12, 2.2, -8, 0, 1.5, 6], fov: 40 }],
  };
}
