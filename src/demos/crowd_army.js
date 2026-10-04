// 500 soldiers advancing / firing down a street: formations, kneeling firing line, MG/launcher variants, muzzle flashes, blob + real shadows.
import * as THREE from 'three';
import { Q } from '../engine/common.js';
import { createCrowd, createCrowdSim, STATE } from '../models/crowd.js';
import { MODE } from '../models/crowd/sim.js';
import { makeStreetScene } from './crowd_scene.js';

export default async function setup(stage, params = {}) {
  const sc = makeStreetScene(stage, { fog: 0.006, skyTop: 0x9ab4d4, skyBottom: 0xcfd0c8, seed: 7 });
  const N = params.n ?? (Q.level >= 1 ? 500 : 200);
  const crowd = createCrowd('soldier', N, { seed: 11, castShadow: Q.shadows });
  stage.scene.add(crowd.root);
  const sim = createCrowdSim(crowd, { seed: 3, separation: 0.7, laneSpread: 3.5, autoCommit: true });
  const yaw = Math.PI; // facing -z
  const share = (f) => Math.max(1, Math.round(N * f));
  const nVan = share(0.13), nMain = share(0.5), nFire = share(0.16), nRear = N - nVan - nMain - nFire;
  let g;
  // vanguard: running
  g = crowd.spawnGroup({ n: nVan, center: [0, -22], width: 17, depth: 9, yawMean: yaw, spread: 0.06, state: 'run', seed: 21, speed: 1.0 });
  sim.add({ first: g, count: nVan, mode: MODE.ADVANCE, target: [0, -400], speed: 3.5, state: 'run', speedVar: 0.1 });
  // main body: marching column
  g = crowd.spawnGroup({ n: nMain, center: [0, 4], width: 20, depth: 34, yawMean: yaw, spread: 0.05, state: 'walk', seed: 22 });
  sim.add({ first: g, count: nMain, mode: MODE.ADVANCE, target: [0, -400], speed: 1.55, state: 'walk', speedVar: 0.08 });
  // firing line
  g = crowd.spawnGroup({ n: nFire, center: [0, -34], width: 19, depth: 5, yawMean: yaw, spread: 0.05, state: 'fire', seed: 23 });
  for (let i = 0; i < nFire; i++) crowd.set(g + i, { state: i % 5 === 0 ? 'crouch' : i % 3 === 0 ? 'aim' : 'fire' });
  sim.add({ first: g, count: nFire, mode: MODE.HOLD, idleState: 'aim' });
  for (let i = 0; i < nFire; i++) { sim.agents[g + i].curState = -1; }
  // rear: walking
  g = crowd.spawnGroup({ n: nRear, center: [0, 30], width: 18, depth: 18, yawMean: yaw, spread: 0.1, state: 'walk', seed: 24 });
  sim.add({ first: g, count: nRear, mode: MODE.ADVANCE, target: [0, -400], speed: 1.35, state: 'walk', speedVar: 0.1 });
  crowd.commit();
  // firing-line agents keep their assigned state (sim only controls moving agents)
  const holdState = []; for (let i = 0; i < nFire; i++) holdState.push(crowd.stateOf(g - nFire + i));
  const firstFire = nVan + nMain;
  return {
    update(t, dt) {
      crowd.update(dt, t); sim.update(dt);
      for (let i = 0; i < nFire; i++) crowd.setAnim(firstFire + i, holdState[i], 1);
      sc.follow(0, -8);
    },
    shots: params.shots || [
      { name: 'wide', t: 4, cam: [-14, 11, 38, 0, 1.5, -22], fov: 46 },
      { name: 'front', t: 4, cam: [3, 1.7, -78, 0, 1.3, -20], fov: 42 },
      { name: 'side', t: 4.4, cam: [11, 2.2, 3, -1, 1.2, -4], fov: 36 },
      { name: 'close', t: 4.6, cam: [2.6, 1.6, -27, -2, 1.3, -31], fov: 40 },
    ],
  };
}
