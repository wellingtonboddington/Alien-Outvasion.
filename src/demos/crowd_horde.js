// 800 mixed zombies (all five strains + giants) charging down a street toward the camera.
import * as THREE from 'three';
import { Q } from '../engine/common.js';
import { createCrowd, createCrowdSim, STATE } from '../models/crowd.js';
import { MODE } from '../models/crowd/sim.js';
import { makeStreetScene } from './crowd_scene.js';

export default async function setup(stage, params = {}) {
  const sc = makeStreetScene(stage, { fog: 0.008, skyTop: 0xc89a78, skyBottom: 0xb8a090, sunColor: 0xffc890, sunI: 2.8, hemi: 0.5, seed: 9, sunDir: [-0.7, 0.45, -0.5] });
  const total = params.n ?? (Q.level >= 1 ? 800 : 280);
  const mix = [['zombie_us', 0.3, 'run'], ['zombie_india', 0.2, 'sprint'], ['zombie_russia', 0.12, 'run'], ['zombie_germany', 0.13, 'run'], ['zombie_cebu', 0.16, 'sprint'], ['zombie_giant', 0.05, 'run']];
  const crowds = [], sims = [];
  mix.forEach(([kind, f, state], k) => {
    const n = Math.max(2, Math.round(total * f));
    const c = createCrowd(kind, n, { seed: 31 + k, castShadow: Q.shadows && Q.level >= 2 }); stage.scene.add(c.root);
    const sim = createCrowdSim(c, { seed: 5 + k, separation: kind === 'zombie_giant' ? 2.6 : 0.8, laneSpread: 4, autoCommit: true });
    const depth = kind === 'zombie_giant' ? 90 : 120;
    const g = c.spawnGroup({ n, center: [0, -70 - (kind === 'zombie_giant' ? 0 : 0)], width: 22, depth, yawMean: 0, spread: 0.12, state, seed: 41 + k });
    const nom = c.nominalSpeed(state);
    sim.add({ first: g, count: n, mode: MODE.ADVANCE, target: [0, 120], speed: nom * (kind === 'zombie_giant' ? 1.0 : 0.95), state, speedVar: 0.18, lane: undefined });
    c.commit(); crowds.push(c); sims.push(sim);
  });
  return {
    update(t, dt) { for (let i = 0; i < crowds.length; i++) { crowds[i].update(dt, t); sims[i].update(dt); } sc.follow(0, 0); },
    shots: params.shots || [
      { name: 'wide', t: 9, cam: [10, 7, 22, 0, 1.5, -22], fov: 44 },
      { name: 'low', t: 12, cam: [1.5, 1.5, 12, 0, 1.4, -10], fov: 38 },
      { name: 'side', t: 12.6, cam: [10, 2.0, 0, -2, 1.5, -8], fov: 36 },
    ],
  };
}
