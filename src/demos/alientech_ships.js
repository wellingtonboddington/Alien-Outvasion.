// Ships: capital ship (hero) + fleet in a starfield + dropship. Dev/preview demo.
import * as THREE from 'three';
import { RNG } from '../engine/common.js';
import { createCapitalShip, createFleet, createMothership, createDropship } from '../models/alientech/index.js';

function starfield(n = 3000, r = 4000) {
  const rng = new RNG(9); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = rng.unit(); pos.set([u.x * r, u.y * r, u.z * r], i * 3); const b = rng.range(0.4, 1); col.set([b, b * rng.range(0.85, 1), b], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 3, vertexColors: true, sizeAttenuation: false, depthWrite: false, fog: false }));
}
export default async function setup(stage, params) {
  const scene = stage.scene; scene.background = new THREE.Color(0x02040a); scene.add(starfield());
  stage.camera.far = 20000; stage.camera.updateProjectionMatrix();
  const sun = new THREE.DirectionalLight(0xfff0dd, 3.0); sun.position.set(-1, 0.6, 0.4).multiplyScalar(1000); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x405880, 0x101018, 0.5));
  const cap = createCapitalShip(1); scene.add(cap.root);
  const fleet = createFleet(24); scene.add(fleet.root); fleet.root.visible = false;
  { const rng = new RNG(3); for (let i = 0; i < 24; i++) fleet.set(i, { x: rng.range(-4000, 4000), y: rng.range(-600, 900), z: 2500 + rng.range(0, 6000), yaw: rng.range(-0.4, 0.4) + Math.PI * 0.5, scale: rng.range(380, 760), infect: i % 6 === 0 ? 1 : 0 }); fleet.commit(); }
  const drop = createDropship(1); scene.add(drop.root); drop.root.visible = false;
  const mom = createMothership(1); mom.root.position.set(0, 0, 0); scene.add(mom.root); mom.root.visible = false;
  return {
    update(t, dt) { cap.update(dt, t); mom.update(dt, t); drop.update(dt, t); drop.openHatch(t > 3 ? 1 : 0); },
    onShot(s) { const dr = s.name.startsWith('drop'); const fl = s.name.startsWith('fleet'); fleet.root.visible = fl; cap.root.visible = !s.name.startsWith('mom') && !dr && !fl; mom.root.visible = s.name.startsWith('mom'); drop.root.visible = dr; },
    shots: [
      { name: 'cap_side', t: 1, cam: [900, 120, 300, 0, 30, 0], fov: 38 },
      { name: 'cap_34', t: 1, cam: [-500, 260, 700, 0, 20, 0], fov: 40 },
      { name: 'mom_far', t: 1, cam: [2600, 700, 3200, 0, 100, 0], fov: 35 },
      { name: 'mom_mid', t: 1, cam: [1700, 500, 1200, 0, 250, 0], fov: 40 },
      { name: 'mom_under', t: 1, cam: [900, -500, 1100, 0, 0, 0], fov: 45 },
      { name: 'fleet', t: 1, cam: [0, 80, 0, 0, 150, 6000], fov: 40 },
      { name: 'drop_front', t: 1, cam: [26, 8, 32, 0, 0, 0], fov: 40 },
      { name: 'drop_rear', t: 5, cam: [-14, 3, -34, 0, -1, -8], fov: 40 },
      { name: 'drop_under', t: 5, cam: [16, -14, -6, 0, 0, -3], fov: 45 },
      { name: 'cap_stern', t: 1, cam: [300, 100, -900, 0, 0, -300], fov: 40 },
    ],
  };
}
