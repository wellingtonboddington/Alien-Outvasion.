// Tripod horde: 360 instanced tripods marching across a plain (100-800 m), mixed states, some infected.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createTripodHorde, createTripod } from '../models/alientech/index.js';
import { RNG } from '../engine/common.js';

export default async function setup(stage, params) {
  const scene = stage.scene;
  addStudioLights(stage, { intensity: 0.8, bg: 0x93a3b8, shadows: false });
  const studio = scene.children.find((c) => c.getObjectByName && c.getObjectByName('studioFloor')); studio.getObjectByName('studioFloor').visible = false;
  const sun = new THREE.DirectionalLight(0xffe8c8, 3.2); sun.position.set(300, 400, 200); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -450; sc.right = 450; sc.top = 450; sc.bottom = -450; sc.near = 50; sc.far = 1200; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 1.0;
  scene.add(sun); scene.add(sun.target); sun.target.position.set(0, 0, 350);
  scene.fog = new THREE.Fog(0x93a3b8, 400, 2600);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x5a6150, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const N = params.n || 360; const horde = createTripodHorde(400); scene.add(horde.root); console.log("tris/instance", horde.trisPerInstance);
  const rng = new RNG(31);
  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / 24), col = i % 24;
    const x = (col - 11.5) * 55 + rng.range(-12, 12), z = 120 + row * 70 + rng.range(-15, 15);
    const sp = rng.range(0.85, 1.15);
    horde.set(i, { x, y: 0, z, yaw: rng.range(-0.08, 0.08) + Math.PI, speed: sp, phase: rng.next(), scale: rng.range(0.85, 1.2), infect: i % 9 === 0 ? 1 : (i % 5 === 0 ? 0.5 : 0), state: i % 41 === 0 ? 'dead' : (i % 17 === 0 ? 'stand' : 'walk') });
  }
  horde.commit();
  const hero = createTripod(2); hero.root.position.set(0, 0, 60); hero.root.rotation.y = Math.PI; scene.add(hero.root); hero.autoMove = false; hero.root.visible = false;
  return {
    update(t, dt) { horde.update(dt, t); },
    onShot(s) { hero.root.visible = !!s.hero; },
    shots: [
      { name: 'far', t: 3, cam: [0, 60, -250, 0, 20, 400], fov: 45 },
      { name: 'mid', t: 5, cam: [120, 30, -40, 0, 22, 260], fov: 40 },
      { name: 'low', t: 8, cam: [-60, 6, 20, 20, 20, 230], fov: 45 },
      { name: 'aerial', t: 10, cam: [300, 220, -150, 0, 10, 450], fov: 50 },
    ],
  };
}
