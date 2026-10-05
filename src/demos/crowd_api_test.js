// API smoke test: every kind, every state, get/set/setCount/spawnGroup/dispose, infection per instance.
import { createCrowd, createCrowdSim, STATE, KIND_NAMES, crowdCount } from '../models/crowd.js';
import { STATE_NAMES } from '../models/crowd/rig.js';
import { addStudioLights } from '../engine/stage.js';
export default async function setup(stage) {
  addStudioLights(stage, { shadows: false });
  const crowds = [];
  KIND_NAMES.forEach((k, r) => {
    const c = createCrowd(k, 20, { seed: r + 1, blob: r % 2 === 0 });
    stage.scene.add(c.root);
    c.spawnGroup({ n: 4, center: [0, -r * 2.5], width: 6, depth: 1, yawMean: 0, state: STATE_NAMES[r % STATE_NAMES.length] });
    const o = {}; c.get(0, o); if (o.state !== STATE_NAMES[r % STATE_NAMES.length]) console.error('get/state mismatch', k, o.state);
    for (let s = 0; s < STATE_NAMES.length; s++) c.set(4 + s, { x: -8 + s * 0.8, z: -r * 2.5, yaw: 0.3, state: STATE_NAMES[s], infect: s / 14 });
    c.setCount(19); c.commit(); crowds.push(c);
  });
  const x = createCrowd('soldier', 5); x.set(0, { x: 1 }); x.commit(); x.dispose();
  console.log('api ok', KIND_NAMES.length, crowdCount(100));
  return { update(t, dt) { crowds.forEach((c) => c.update(dt, t)); }, shots: [{ name: 'a', t: 1.2, cam: [0, 14, 8, 0, 0, -12], fov: 50 }] };
}
