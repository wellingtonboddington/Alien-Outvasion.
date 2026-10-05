// Air / missile / space / sea / extra-civil showcase. params.set: 'air' (default) | 'misc'
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import * as V from '../models/vehicles.js';
import { ground } from './vehicles_common.js';

export default async function setup(stage, params) {
  const set = params.set || 'air';
  addStudioLights(stage, { intensity: 1.0, bg: set === 'misc' ? 0x6f8aa6 : 0x8aa0b8 });
  stage.scene.add(ground(stage, { size: 3000, color: set === 'misc' ? 0x20506e : 0x4a4d50 }));
  const items = []; const put = (v, x, y, z, yaw = 0) => { v.root.position.set(x, y, z); v.root.rotation.y = yaw; stage.scene.add(v.root); items.push(v); return v; };
  let shots;
  if (set === 'air') {
    // formation (in the air, gear up)
    const j1 = put(V.createJet('f15', { throttle: 0.9, bank: 0.25 }), 0, 30, 0), j2 = put(V.createJet('f15', { throttle: 0.9, bank: 0.25 }), -16, 29, -12), j3 = put(V.createJet('f35', { throttle: 0.6, bank: 0.25 }), 15, 29.5, -14), j4 = put(V.createJet('bomber', { throttle: 0.5 }), 0, 40, -70);
    // landed f15 w/ gear down, afterburner
    put(V.createJet('f15', { gear: 1, throttle: 1 }), -70, 0, 0, 0.3); put(V.createJet('f35', { gear: 1, throttle: 0.2 }), -95, 0, 6, 0.3);
    const ha = put(V.createHelicopter('attack', { rotor: 1 }), 40, 0, 0, -0.4), ht = put(V.createHelicopter('transport', { rotor: 1 }), 65, 0, 4, -0.5);
    const mx = 100; put(V.createMissile('icbm', { burn: 0.0 }), mx, 0, 0); const ii = put(V.createMissile('interceptor', { burn: 1 }), mx + 12, 6, 0); put(V.createMissile('sam', { burn: 0.8 }), mx + 20, 3, 0); put(V.createMissile('rocket', { burn: 0.8 }), mx + 26, 2, 0); put(V.createMissile('cruise', { burn: 0.8 }), mx + 33, 4, 0);
    const icb = put(V.createMissile('icbm', { burn: 1 }), mx - 14, 6, 0);
    shots = [
      { name: 'jets', t: 0.6, cam: [34, 34, 40, -2, 29, -18], fov: 38 },
      { name: 'jets_rear', t: 0.6, cam: [-22, 33, -34, 0, 30, -8], fov: 40 },
      { name: 'ground_jets', t: 0.6, cam: [-62, 5, 24, -80, 2.5, 3], fov: 40 },
      { name: 'helis', t: 0.8, cam: [62, 6, 28, 52, 2.5, 2], fov: 42 },
      { name: 'missiles', t: 0.6, cam: [mx + 14, 10, 48, mx + 14, 8, 0], fov: 46 },
    ];
  } else {
    // civil extras
    const row = [['createBus', null, -18], ['createTruck', 'box', -9], ['createTruck', 'fuel', 0], ['createTruck', 'flatbed', 9], ['createMotorbike', null, 15], ['createTricycle', null, 19]];
    for (const [fn, kind, x] of row) put(kind ? V[fn](kind) : V[fn](), x, 0, 0);
    const cp = V.createCarPark({ cols: 6 }); put(cp, 0, 0, -30);
    // satellites + station
    put(V.createSatellite('comms'), 300, 12, 0); put(V.createSatellite('recon'), 340, 12, 0); put(V.createSatellite('gps'), 372, 12, 0);
    put(V.createSpaceStation(), 600, 40, 0, 0.4);
    // ships
    put(V.createWarship('destroyer'), 1000, 0, 0, 0.3); put(V.createWarship('ferry'), 1000, 0, -200, 0.2); put(V.createWarship('carrier'), 1000, 0, -600, -0.2);
    shots = [
      { name: 'civ', t: 0.6, cam: [10, 6, 30, 0, 1.8, 0], fov: 42 },
      { name: 'carpark', t: 0.6, cam: [10, 12, -5, 0, 0.5, -30], fov: 45 },
      { name: 'sats', t: 0.6, cam: [340, 18, 45, 335, 12, 0], fov: 40 },
      { name: 'station', t: 0.6, cam: [640, 70, 120, 600, 40, 0], fov: 44 },
      { name: 'destroyer', t: 0.6, cam: [1060, 25, 130, 1000, 8, 0], fov: 40 },
      { name: 'ferry', t: 0.6, cam: [1060, 25, -90, 1000, 12, -200], fov: 42 },
      { name: 'carrier', t: 0.6, cam: [1300, 120, -300, 1000, 10, -600], fov: 40 },
    ];
  }
  if (params.only) shots = shots.filter((s) => params.only.includes(s.name));
  return { shots, update(t, dt) { for (const v of items) v.update(dt, t); } };
}
