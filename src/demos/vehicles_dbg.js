// dev scratch demo (close-ups of single parts)
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createJeepney } from '../models/vehicles.js';
export default async function setup(stage, params) {
  addStudioLights(stage, { intensity: 1.0, bg: 0x8aa0b8 });
  const jeep = createJeepney({ seed: 1, palette: params.palette || 'blessed', name: 'BLESSED', route: 'DUMAGUETE - BACOLOD' });
  stage.scene.add(jeep.root);
  const shots = params.shots || [
    { name: 'horse', t: 0.5, cam: [1.4, 1.7, 3.9, 0, 1.2, 2.4], fov: 30 },
    { name: 'front', t: 0.55, cam: [0.5, 1.3, 6.5, 0, 1.0, 2.0], fov: 36 },
    { name: 'sidecl', t: 0.6, cam: [-4.5, 1.2, -1.0, 0, 0.95, -1.0], fov: 38 },
  ];
  return { shots, update(t, dt) { jeep.update(dt, t); } };
}
