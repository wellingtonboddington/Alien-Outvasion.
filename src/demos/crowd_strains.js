// One row per kind, close up, so the strain / role differences read. Each row shows the animation range (idle, walk, run, sprint, lunge, aim, fire).
import * as THREE from 'three';
import { Q } from '../engine/common.js';
import { createCrowd } from '../models/crowd.js';
import { addStudioLights } from '../engine/stage.js';

export default async function setup(stage, params = {}) {
  addStudioLights(stage, { shadows: true, intensity: 1.0, bg: 0x2c3036 });
  const zombies = ['zombie_india', 'zombie_germany', 'zombie_cebu', 'zombie_russia', 'zombie_us', 'zombie_giant'];
  const humans = ['civilian', 'scientist', 'soldier', 'robot'];
  const states = ['idle', 'walk', 'run', 'sprint', 'lunge', 'aim', 'fire'];
  const crowds = [];
  const place = (kinds, z0, zStep, xGap, seedBase) => kinds.forEach((kind, r) => {
    const c = createCrowd(kind, states.length, { seed: 7 + seedBase + r, castShadow: true }); stage.scene.add(c.root);
    states.forEach((st, i) => c.set(i, { x: (i - (states.length - 1) / 2) * xGap, z: z0 - r * zStep, yaw: 0.35, state: st, seed: 0.12 + 0.13 * i + r * 0.037, phase: i * 0.21 + r * 0.3, scale: 1, age: 'adult' }));
    c.setCount(states.length); c.commit(); crowds.push(c);
  });
  place(zombies, 0, 3.0, 2.2, 0);
  place(humans, -30, 2.7, 2.2, 20);
  const T = params.t ?? 1.4;
  return {
    update(t, dt) { for (const c of crowds) c.update(dt, t); },
    shots: params.shots || [
      { name: 'zombies', t: T, cam: [-4, 3.2, 12.5, 0, 1.2, -6.5], fov: 44 },
      { name: 'zombies_close', t: T + 0.2, cam: [-2, 1.9, 4.8, 0, 1.2, 0], fov: 40 },
      { name: 'humans', t: T, cam: [-4, 3.0, -17.5, 0, 1.2, -36.5], fov: 44 },
    ],
  };
}
