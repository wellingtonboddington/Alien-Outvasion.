// Healthy vs infected Vessari (hero + crawler + crowd slice). Params: {amount: infection 0..1}
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createVessari, createCrawler, createVessariCrowd, createCrawlerSwarm } from '../models/aliens/index.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: true, bg: 0x262c34 });
  const a = params.amount ?? 1;
  const heroes = [];
  const mk = (kind, x, clip, inf, o = {}) => { const h = createVessari(kind, 4 + heroes.length, o); h.root.position.set(x, 0, 0); stage.scene.add(h.root); h.play(clip, { blend: 0 }); if (inf) h.setInfection(inf); heroes.push(h); return h; };
  mk('soldier', -3.2, 'idle', 0); mk('soldier', -1.6, 'infected_idle', a).setBloody(0.5); mk('officer', 0.2, 'idle_alert', 0); const hh = mk('officer', 1.9, 'infected_run', a * 0.65, { hold: false }); void hh;
  const c1 = createCrawler(3); c1.root.position.set(-2.6, 0, 2.6); c1.root.rotation.y = 0.5; c1.play('idle'); const c2 = createCrawler(4); c2.root.position.set(-0.8, 0, 2.7); c2.root.rotation.y = -0.4; c2.play('scuttle'); c2.setInfection(a); stage.scene.add(c1.root, c2.root);
  const crowd = createVessariCrowd(40); crowd.spawnGroup({ n: 12, center: [1.8, 4.0], radius: 2.2, yawMean: Math.PI, state: 'walk', seed: 2 }); crowd.spawnGroup({ n: 12, center: [5.0, 4.0], radius: 2.2, yawMean: Math.PI, state: 'run', seed: 3, infect: a }); stage.scene.add(crowd.root);
  const sw = createCrawlerSwarm(60); sw.spawnGroup({ n: 14, center: [-3.8, 5.2], radius: 1.8, yawMean: 0, state: 'run', seed: 5 }); sw.spawnGroup({ n: 14, center: [-1.2, 5.2], radius: 1.8, yawMean: 0, state: 'run', seed: 6, infect: a }); stage.scene.add(sw.root);
  return {
    update(t, dt) { for (const h of heroes) h.update(dt, t); c1.update(dt, t); c2.update(dt, t); crowd.update(dt, t); sw.update(dt, t); },
    shots: [
      { name: 'wide', t: 1.0, cam: [0.3, 2.3, 9.4, 0.3, 1.0, 1.5], fov: 40 },
      { name: 'heroes', t: 1.0, cam: [-0.7, 1.8, 6.0, -0.7, 1.3, 0], fov: 32 },
      { name: 'face', t: 1.0, cam: [-0.7, 2.5, 2.2, -1.6, 2.3, 0.2], fov: 24 },
    ],
  };
}
