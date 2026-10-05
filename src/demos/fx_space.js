// FX demo: orbital nuclear detonation against a starfield, atmospheric nuke with mushroom cloud, and reentry comets/meteors.
//   node tools/render.mjs --demo fx_space --out out/fx/space --q 2 [--params '{"mode":"space|atmo|comets"}']
import * as THREE from 'three';
import { createFX } from '../fx/particles.js';
import { createDemoWorld, createStars } from '../fx/demo_env.js';

export default async function setup(stage, params = {}) {
  const mode = params.mode || 'space';
  const scene = stage.scene;
  let world, fx, shots;
  if (mode === 'space') {
    world = createDemoWorld(stage, { preset: 'space', buildings: false, ground: false }); createStars(scene);
    // a planet limb + a distant "ship" silhouette for scale
    const planet = new THREE.Mesh(new THREE.SphereGeometry(6400, 64, 48), new THREE.MeshStandardMaterial({ color: 0x2a5aa0, roughness: 0.9, emissive: 0x050a14 })); planet.position.set(-1500, -6900, -2500); scene.add(planet);
    const ship = new THREE.Mesh(new THREE.CylinderGeometry(20, 35, 220, 12), new THREE.MeshStandardMaterial({ color: 0x8a8f98, metalness: 0.6, roughness: 0.4 })); ship.position.set(260, 20, -350); ship.rotation.z = 1.2; scene.add(ship);
    fx = createFX(scene, { ground: -1e6 }); fx.setLighting({ sunDir: [0.5, 0.4, 0.7], sunColor: [1, 1, 1], ambient: [0.05, 0.06, 0.1] });
    fx.nuke([0, 0, -600], { size: 160, inSpace: true });
    const cam = [60, 30, 140, 0, 0, -600];
    shots = [0.05, 0.25, 0.7, 1.6, 3.2, 6, 10].map((t) => ({ name: 'nuke_' + String(t).replace('.', 'p'), t, cam, fov: 45 }));
  } else if (mode === 'atmo') {
    world = createDemoWorld(stage, { preset: 'dusk', radius: 1200, seed: 21 }); scene.fog.density = 0.0006; world.sun.shadow.camera.far = 4000;
    fx = createFX(scene, { ground: 0 }); fx.syncLights();
    fx.nuke([0, 0, -1500], { size: 240 });
    const cam = [0, 40, 100, 0, 420, -1500];
    shots = [0.1, 0.6, 2, 5, 10, 20, 32].map((t) => ({ name: 'nuke_' + String(t).replace('.', 'p'), t, cam: t < 3 ? [0, 30, 120, 0, 160, -1500] : cam, fov: t < 3 ? 40 : 45 }));
  } else {
    world = createDemoWorld(stage, { preset: 'dusk', buildings: true, radius: 700, seed: 5 }); scene.fog.density = 0.0009; createStars(scene);
    fx = createFX(scene, { ground: 0 }); fx.syncLights();
    fx.reentry([-900, 700, -1400], [200, 12, -1500], { life: 3.4, size: 60, explodeAtEnd: true, explodeSize: 160, impact: 'big' });
    fx.reentry([900, 900, -1700], [-400, 15, -1800], { life: 4.2, size: 80, color: [0.5, 0.75, 1.0], delay: 0.4 });
    fx.reentry([-300, 800, -1300], [500, 20, -1400], { life: 5.0, size: 40, delay: 1.0, flare: false });
    shots = [0.8, 1.6, 2.4, 3.3, 4.6, 6].map((t) => ({ name: 'comets_' + String(t).replace('.', 'p'), t, cam: [0, 8, 40, 0, 220, -1500], fov: 55 }));
  }
  return { shots, update(t, dt) { fx.update(dt, t); } };
}
