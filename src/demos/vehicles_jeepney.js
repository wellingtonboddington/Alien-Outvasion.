// Jeepney showcase: orbit angles, interior, hood, drive-by, infected/wrecked variants.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createJeepney } from '../models/vehicles.js';
import { mannequin, seat } from './vehicles_common.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { intensity: 1.0, bg: 0x8aa0b8 });
  const jeep = createJeepney({ seed: 1, palette: 'blessed', name: 'BLESSED', route: 'DUMAGUETE - BACOLOD' });
  stage.scene.add(jeep.root);
  const a = jeep.anchors; const crew = new THREE.Group(); jeep.chassis.add(crew);
  seat(jeep, a.driverSeat, crew, { color: 1, arms: 'wheel', hands: [0.17, 1.12, 0.62] });
  seat(jeep, a.passengerSeats[0], crew, { color: 2 });
  for (const i of [2, 3, 5, 6, 8, 9, 12]) seat(jeep, a.passengerSeats[i], crew, { color: i });
  const j2 = createJeepney({ seed: 4, palette: 'sunrise', name: 'MARY JOY', route: 'CEBU - COLON', variant: 'worn' }); j2.root.position.set(-6.5, 0, -4); j2.root.rotation.y = 0.4; stage.scene.add(j2.root);
  const j3 = createJeepney({ seed: 7, palette: 'emerald', name: 'ROAD KING', variant: 'infected' }); j3.root.position.set(6.8, 0, -3); j3.root.rotation.y = -0.5; stage.scene.add(j3.root);
  const j4 = createJeepney({ seed: 9, palette: 'rose', name: 'LADY LUCK', variant: 'wrecked' }); j4.root.position.set(-9, 0, 5); j4.root.rotation.y = 1.0; stage.scene.add(j4.root);
  const std = mannequin('stand', { color: 3 }); std.position.set(0.6, 0, -4.1); std.rotation.y = Math.PI; stage.scene.add(std);
  const h = new THREE.Group(); stage.scene.add(h);
  const shots = [
    { name: 'front34', t: 0.5, cam: [4.6, 1.7, 7.0, 0, 1.0, 0.2], fov: 38 },
    { name: 'side', t: 0.55, cam: [8.5, 1.25, 0.3, 0, 1.1, -0.2], fov: 36 },
    { name: 'rear34', t: 0.6, cam: [-4.2, 1.8, -8.0, 0, 1.1, -1.2], fov: 38 },
    { name: 'hood', t: 0.65, cam: [1.6, 1.7, 4.6, 0, 1.05, 2.3], fov: 36 },
    { name: 'cab', t: 0.7, cam: [-0.2, 1.55, 0.35, 0.0, 1.4, 1.6], fov: 70 },
    { name: 'inside', t: 0.75, cam: [0.1, 1.75, -4.2, 0, 1.3, -1.0], fov: 62 },
    { name: 'left', t: 0.8, cam: [-8.5, 1.25, 0.3, 0, 1.1, -0.2], fov: 36 },
    { name: 'top', t: 0.85, cam: [0.2, 9.0, -3.0, 0, 1.0, -0.6], fov: 40 },
    { name: 'drive', t: 3.0, cam: [4.5, 1.1, 3.0, 0, 1.0, 0.0], fov: 42, drive: true },
  ];
  return {
    shots,
    update(t, dt) { jeep.update(dt, t); j2.update(dt, t); j3.update(dt, t); j4.update(dt, t); },
    onShot(s, t) {
      if (s.drive) { jeep.setSpeed(11); jeep.steer(0.05); jeep.root.position.set(0, 0, -2.0); jeep.root.rotation.y = 0; jeep.setLights(true); }
      else { jeep.setSpeed(0); jeep.root.position.set(0, 0, 0); jeep.root.rotation.y = 0; }
      const vis = !s.drive; j2.root.visible = j3.root.visible = j4.root.visible = vis && !['cab', 'inside', 'top'].includes(s.name); std.visible = vis;
    },
  };
}
