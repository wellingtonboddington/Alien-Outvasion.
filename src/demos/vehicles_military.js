// Military ground vehicles lineup: tank, humvee, HIMARS, howitzer (+ APC, Patriot) in a row.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import * as V from '../models/vehicles.js';
import { ground } from './vehicles_common.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { intensity: 1.0, bg: 0x8aa0b8 });
  stage.scene.add(ground(stage, { size: 300 }));
  const items = [];
  const add = (v, x, z = 0, yaw = 0) => { v.root.position.set(x, 0, z); v.root.rotation.y = yaw; stage.scene.add(v.root); items.push(v); return v; };
  const tank = add(V.createTank({ color: 'olive' }), -20);
  add(V.createHumvee({ color: 'desert' }), -8);
  const him = add(V.createLauncher('himars'), 5); him.setElevation?.(0.6);
  const how = add(V.createHowitzer(), 19);
  if (params.extra) { add(V.createAPC(), -20, -14); add(V.createLauncher('patriot'), 0, -16); add(V.createAntiAir(), 18, -14); add(V.createLauncher('tel'), 40, -10); }
  tank.setTurret?.(0.4, 0.05); how.setTurret?.(-0.5, 0.4);
  const shots = params.shots || [
    { name: 'front34', t: 0.5, cam: [8, 6, 36, 0, 2, 0], fov: 42 },
    { name: 'rear34', t: 0.6, cam: [-12, 6, -30, 0, 2, 0], fov: 42 },
    { name: 'side', t: 0.7, cam: [-2, 3.5, 22, -2, 2, 0], fov: 55 },
  ];
  return { shots, update(t, dt) { for (const v of items) v.update(dt, t); } };
}
