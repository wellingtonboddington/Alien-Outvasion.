// A refugee stream: families, elders and kids shuffling along a road with bags, a few runners, a cowering group at the verge, hands-up and pointing at the sky.
import * as THREE from 'three';
import { Q } from '../engine/common.js';
import { createCrowd, createCrowdSim } from '../models/crowd.js';
import { MODE } from '../models/crowd/sim.js';
import { makeStreetScene } from './crowd_scene.js';

export default async function setup(stage, params = {}) {
  const sc = makeStreetScene(stage, { fog: 0.0055, skyTop: 0x8a9ab4, skyBottom: 0xaeb0b4, sunColor: 0xffe8c8, sunI: 2.4, hemi: 0.7, seed: 4 });
  const N = params.n ?? (Q.level >= 1 ? 520 : 200);
  const civ = createCrowd('civilian', N, { seed: 5, castShadow: Q.shadows && Q.level >= 2 }); stage.scene.add(civ.root);
  const sim = createCrowdSim(civ, { seed: 2, separation: 0.75, laneSpread: 4, autoCommit: true });
  const nWalk = Math.round(N * 0.7), nRun = Math.round(N * 0.1), nCower = Math.round(N * 0.06), nPoint = Math.round(N * 0.06), nRest = N - nWalk - nRun - nCower - nPoint;
  let g;
  g = civ.spawnGroup({ n: nWalk, center: [0, 0], width: 20, depth: 130, yawMean: Math.PI, spread: 0.1, state: 'walk', seed: 61, speed: 1 });
  sim.add({ first: g, count: nWalk, mode: MODE.ADVANCE, target: [0, -400], speed: 1.1, state: 'walk', speedVar: 0.25 });
  g = civ.spawnGroup({ n: nRun, center: [0, 30], width: 18, depth: 110, yawMean: Math.PI, spread: 0.1, state: 'run', seed: 62 });
  sim.add({ first: g, count: nRun, mode: MODE.ADVANCE, target: [0, -400], speed: 3.0, state: 'auto', speedVar: 0.2 });
  g = civ.spawnGroup({ n: nCower, center: [10.5, -8], radius: 3.2, yawMean: 0, spread: 3, state: 'cower', seed: 63 });
  sim.add({ first: g, count: nCower, mode: MODE.HOLD, idleState: 'cower' });
  g = civ.spawnGroup({ n: nPoint, center: [-9.5, -4], radius: 3, yawMean: 0.3, spread: 0.5, state: 'aim', seed: 64 });
  sim.add({ first: g, count: nPoint, mode: MODE.HOLD, idleState: 'aim' });
  g = civ.spawnGroup({ n: nRest, center: [-3, 9], radius: 7, yawMean: Math.PI, spread: 3, state: 'cough', seed: 65 });
  sim.add({ first: g, count: nRest, mode: MODE.HOLD, idleState: 'idle' });
  civ.commit();
  const holdFrom = nWalk + nRun, holdState = []; for (let i = holdFrom; i < N; i++) holdState.push(civ.stateOf(i));
  return {
    update(t, dt) { civ.update(dt, t); sim.update(dt); for (let i = holdFrom; i < N; i++) civ.setAnim(i, holdState[i - holdFrom], 1); sc.follow(0, 0); },
    shots: params.shots || [
      { name: 'wide', t: 6, cam: [-9, 8, 42, 0, 1.2, -4], fov: 44 },
      { name: 'low', t: 8, cam: [4, 1.7, 26, -1, 1.4, 8], fov: 36 },
      { name: 'side', t: 8.4, cam: [12, 1.9, 4, -2, 1.2, -3], fov: 34 },
    ],
  };
}
