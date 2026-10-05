// Dev demo: prints triangle / draw-call cost of every alientech asset (use --verbose).
import * as THREE from 'three';
import { createBeams, createPod, createPodSwarm, createTripod, createTripodHorde, createDropship, createCapitalShip, createFleet, createMothership, assetStats } from '../models/alientech/index.js';
export default async function setup(stage) {
  stage.scene.background = new THREE.Color(0x101820);
  const list = { pod: createPod(1), tripod: createTripod(1), tripod_scout: createTripod(2, { size: 12 }), dropship: createDropship(1), capital: createCapitalShip(1), mothership: createMothership(1) };
  for (const k in list) { stage.scene.add(list[k].root); console.log('STAT', k, JSON.stringify(assetStats(list[k].root))); }
  const sw = createPodSwarm(800), hd = createTripodHorde(400), fl = createFleet(30), bm = createBeams();
  for (const [k, o] of Object.entries({ podswarm: sw, horde: hd, fleet: fl, beams: bm })) { console.log('STAT', k, JSON.stringify(assetStats(o.root))); }
  return { shots: [{ name: 'x', t: 0, cam: [0, 10, 60, 0, 0, 0] }] };
}
