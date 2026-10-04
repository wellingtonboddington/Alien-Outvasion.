// Pods: hero close-ups, then a 500-pod swarm firing ~600 simultaneous beams at a city ground plane.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createPod, createPodSwarm, createBeams } from '../models/alientech/index.js';
import { RNG, GLOBAL } from '../engine/common.js';

export default async function setup(stage, params) {
  const lights = addStudioLights(stage, { intensity: 0.75, bg: 0x070b12, shadows: false });
  const scene = stage.scene;
  scene.fog = new THREE.FogExp2(0x0a1018, 0.0016);
  // hero pod
  const hero = createPod(3); hero.root.position.set(0, 2.2, 0); scene.add(hero.root); hero.setThrust(0.6);
  // ground + a few blocks for scale
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.01; scene.add(ground);
  const rng = new RNG(11);
  const bm = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.8 });
  const blocks = new THREE.Group(); blocks.position.z = -400; scene.add(blocks); blocks.visible = false;
  for (let i = 0; i < 120; i++) { const w = rng.range(14, 40), h = rng.range(15, 90), d = rng.range(14, 40); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm); b.position.set(rng.range(-250, 250), h / 2, rng.range(-250, 250)); blocks.add(b); }
  // swarm
  const N = params.n || 500;
  const swarm = createPodSwarm(800); scene.add(swarm.root); swarm.root.visible = false;
  const beams = createBeams({ capacity: 768 }); scene.add(beams.root);
  const nextFire = new Float32Array(N), pos = [];
  for (let i = 0; i < N; i++) {
    const ring = rng.range(0, 1); const a = rng.range(-1.1, 1.1) , r = rng.range(40, 260);
    const x = Math.sin(a) * r * 1.4, z = -Math.cos(a) * r * 0.8 - 60, y = rng.range(25, 90) + (1 - ring) * 20;
    pos.push([x, y, z]);
    swarm.set(i, { x, y, z, yaw: Math.atan2(rng.range(-60, 60) - x, -300 - z) + rng.range(-0.15, 0.15), pitch: rng.range(-0.1, 0.1), roll: rng.range(-0.15, 0.15), scale: rng.range(0.9, 1.15), phase: rng.next(), state: i % 23 === 0 ? 'dive' : (i % 31 === 0 ? 'dead' : 'hover'), infect: i % 7 === 0 ? 0 : 0 });
    nextFire[i] = rng.range(0, 1.2);
  }
  swarm.commit();
  let first = true;
  const tgt = new THREE.Vector3(), from = new THREE.Vector3();
  const R2 = new RNG(99);
  return {
    update(t, dt) {
      hero.update(dt, t); swarm.update(dt, t);
      if (params.fire !== false) for (let i = 0; i < N; i++) {
        if (t < nextFire[i]) continue; nextFire[i] = t + R2.range(0.5, 1.6);
        const p = pos[i]; from.set(p[0], p[1] - 1.6, p[2]); tgt.set(R2.range(-220, 220), 0, R2.range(-760, -420));
        beams.fire({ from, to: tgt, width: 0.22, life: R2.range(0.25, 0.55), travel: R2.chance(0.6) ? 0.12 : 0, delay: R2.range(0, 0.1), color: R2.chance(0.08) ? 0x3cff1a : 0x46e6ff });
      }
      beams.update(dt, t);
    },
    onShot(s) { const sw = s.name.startsWith('swarm') || s.name.startsWith('city'); hero.root.visible = !sw; swarm.root.visible = sw; blocks.visible = sw; ground.visible = sw; lights.getObjectByName('studioFloor').visible = !sw; scene.fog.density = sw ? 0.0016 : 0; },
    shots: [
      { name: 'hero_front', t: 1.0, cam: [0, 2.6, 6.0, 0, 2.2, 0], fov: 35 },
      { name: 'hero_side', t: 1.5, cam: [5.5, 1.2, 2.0, 0, 2.0, 0], fov: 35 },
      { name: 'hero_under', t: 2.0, cam: [2.5, -0.2, 3.6, 0, 1.9, 0], fov: 40 },
      { name: 'swarm_up', t: 4.0, cam: [0, 2.0, 40, 0, 45, -150], fov: 60 },
      { name: 'swarm_wide', t: 5.0, cam: [300, 60, 220, 0, 40, -250], fov: 50 },
      { name: 'city_beams', t: 6.0, cam: [0, 4, 80, 0, 25, -450], fov: 55 },
    ],
  };
}
