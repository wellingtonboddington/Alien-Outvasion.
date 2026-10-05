// FX demo: the green infection language — spore clouds, coughs, infection pulses (night, toxic green light).
//   node tools/render.mjs --demo fx_infection --out out/fx/infect --q 2
import * as THREE from 'three';
import { createFX } from '../fx/particles.js';
import { createDemoWorld } from '../fx/demo_env.js';
import { limb } from '../engine/geo.js';

export default async function setup(stage, params = {}) {
  const world = createDemoWorld(stage, { preset: params.preset || 'night', radius: 90, seed: 4 });
  const scene = stage.scene;
  const fx = createFX(scene, { ground: 0, wind: [0.4, 0.2] }); fx.syncLights();
  // stand-in people (capsules) so scale reads
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.8 });
  const people = [];
  for (let i = 0; i < 5; i++) { const g = new THREE.Group(); const body = new THREE.Mesh(limb(1.45, 0.17, 0.14, { bulge: 0.1 }), mat); const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), mat); head.position.y = 1.62; g.add(body, head); g.position.set(-4 + i * 2, 0, -2 + (i % 2) * 1.5); g.rotation.y = 0.4 * i; g.traverse((o) => { o.castShadow = true; }); scene.add(g); people.push(g); }
  const glowL = new THREE.PointLight(0x40ff20, 0, 30, 1.6); glowL.position.set(0, 2, 0); scene.add(glowL);
  const cloud = fx.sporeCloud([0, 0.2, -2], { radius: 3.5, density: 1.2 });
  const cloud2 = fx.sporeCloud([14, 0.2, -10], { radius: 6, density: 1 });
  const shots = [
    { name: 'cloud_wide', t: 5, cam: [5, 2.2, 11, 0, 1.4, -2], fov: 45 }, { name: 'cloud_close', t: 5.2, cam: [1.4, 1.6, 3.2, 0, 1.5, -2], fov: 50 },
    { name: 'cough_a', t: 7.3, cam: [0.6, 1.7, 2.6, 0.1, 1.6, 0], fov: 38 }, { name: 'cough_b', t: 7.8, cam: [0.6, 1.7, 2.6, 0.1, 1.6, 0], fov: 38 },
    { name: 'pulse_a', t: 9.2, cam: [6, 3.2, 9, 0, 0.5, -2], fov: 48 }, { name: 'pulse_b', t: 9.7, cam: [6, 3.2, 9, 0, 0.5, -2], fov: 48 }, { name: 'pulse_c', t: 10.6, cam: [6, 3.2, 9, 0, 0.5, -2], fov: 48 },
  ];
  let c1 = false, c2 = false;
  return {
    shots,
    update(t, dt) {
      cloud.move([Math.sin(t * 0.3) * 1.5, 0.2, -2 + Math.cos(t * 0.25) * 1.0]);
      if (!c1 && t > 7.0) { c1 = true; fx.coughPuff([0.1, 1.55, 0.1], [0.2, -0.05, 1], { size: 1 }); fx.coughPuff([0.1, 1.55, 0.1], [0.2, -0.05, 1], { size: 1.3, delay: 0.5 }); }
      if (!c2 && t > 9.0) { c2 = true; fx.infectPulse([0, 0.05, -2], { radius: 8 }); }
      glowL.intensity = 40 + 20 * Math.sin(t * 3);
      fx.update(dt, t);
    },
  };
}
