import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { _dbg } from '../models/vehicles/jeepney.js';
export default async function setup(stage) {
  addStudioLights(stage, { intensity: 1.0, bg: 0x8aa0b8 });
  const m = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1, roughness: 0.2 });
  const h = new THREE.Mesh(_dbg.horseGeo(1.0), m); h.position.y = 0.2; stage.scene.add(h);
  const e = new THREE.Mesh(_dbg.eagleGeo(1.0), m); e.position.set(1.5, 0.9, 0); stage.scene.add(e);
  return { shots: [{ name: 'side', t: 0, cam: [3.2, 0.6, 1.6, 0, 0.5, 0.0], fov: 40 }, { name: 'eagle', t: 0, cam: [1.5, 0.9, 3, 1.5, 0.9, 0], fov: 40 }] };
}
