// FX demo: every explosion kind at several timestamps (ground-level, daylight skyline).
//   node tools/render.mjs --demo fx_explosions --out out/fx_expl [--q 2]
//   --params '{"kinds":["big"],"preset":"dusk"}' to focus on particular kinds / lighting
import * as THREE from 'three';
import { createFX } from '../fx/particles.js';
import { createDemoWorld } from '../fx/demo_env.js';

const SIZES = { fireball: 10, ground: 12, air: 12, big: 22, laser: 6, chain: 8, ground2: 12 };

export default async function setup(stage, params = {}) {
  const kinds = params.kinds || ['fireball', 'ground', 'air', 'big', 'laser', 'chain'];
  const world = createDemoWorld(stage, { preset: params.preset || 'day', radius: 150 });
  const fx = createFX(stage.scene, { ground: 0 });
  fx.syncLights();
  const T0 = 0.3, gap = 70;
  const xs = kinds.map((k, i) => (i - (kinds.length - 1) / 2) * gap);
  const fired = kinds.map(() => false);
  const times = params.times || [0.12, 0.45, 1.3, 3.5];
  const shots = [];
  kinds.forEach((k, i) => {
    const S = SIZES[k] || 10; const d = Math.max(30, S * 3.0);
    for (const dt of times) shots.push({ name: `${k}_${String(dt).replace('.', 'p')}`, t: T0 + dt, cam: [xs[i] + d * 0.25, S * 0.35 + 2, d, xs[i], S * 0.6 + 1, 0], fov: 42 });
  });
  stage.camera.position.set(0, 8, 60);
  return {
    shots,
    update(t, dt) {
      kinds.forEach((k, i) => { if (!fired[i] && t >= T0 - 1e-6) { fired[i] = true; fx.explosion([xs[i], 0, 0], { size: SIZES[k] || 10, kind: k }); } });
      fx.update(dt, t);
    },
  };
}
