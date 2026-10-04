// Civilian vehicles lineup + car park.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import * as V from '../models/vehicles.js';
import { ground } from './vehicles_common.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { intensity: 1.0, bg: 0x8aa0b8 });
  const list = params.list || [['car', 'sedan', { paint: 'blue' }], ['car', 'hatch', { paint: 'red' }], ['car', 'suv', { paint: 'silver' }], ['car', 'taxi', {}], ['car', 'police', {}]];
  const items = []; const sp = params.spacing || 3.2; let x = -(list.length - 1) * sp / 2;
  for (const [fn, kind, o] of list) {
    const v = fn === 'car' ? V.createCar(kind, o) : V[fn](kind, o);
    if (params.zrow) v.root.position.set(0, 0, x); else v.root.position.set(x, 0, 0); x += sp; stage.scene.add(v.root); items.push(v);
  }
  const shots = params.shots || [
    { name: 'front34', t: 0.5, cam: [-5.5, 1.6, 7.5, -4, 0.7, 0], fov: 36 },
    { name: 'side', t: 0.55, cam: [-3.2, 1.0, 9, -3.2, 0.7, 0], fov: 30 },
    { name: 'rear34', t: 0.6, cam: [-1.5, 1.5, -8, -3.2, 0.7, 0], fov: 34 },
  ];
  return { shots, update(t, dt) { for (const v of items) v.update(dt, t); } };
}
