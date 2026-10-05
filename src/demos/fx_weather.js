// FX demo: rain (day + night storm with lightning), snow, ash + embers. Weather follows the camera.
//   node tools/render.mjs --demo fx_weather --out out/fx/weather --q 2 [--params '{"mode":"rain|storm|snow|ash"}']
import * as THREE from 'three';
import { createFX } from '../fx/particles.js';
import { createDemoWorld } from '../fx/demo_env.js';

export default async function setup(stage, params = {}) {
  const mode = params.mode || 'rain';
  const preset = { rain: 'overcast', storm: 'night', snow: 'overcast', ash: 'dusk' }[mode] || 'overcast';
  const world = createDemoWorld(stage, { preset, radius: 130, seed: 9 });
  const scene = stage.scene; const fx = createFX(scene, { ground: 0, wind: [2, 0.6] }); fx.syncLights();
  if (mode === 'snow') { scene.background = new THREE.Color(0x8c97a8); scene.fog.color.set(0x9aa4b4); world.ground.material.color.set(0xe8eef8); }
  const lamp = new THREE.PointLight(0xffd8a0, 30, 25, 1.7); lamp.position.set(2.5, 5.0, -6); scene.add(lamp);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), new THREE.MeshStandardMaterial({ color: 0x222 })); post.position.set(2.5, 2.5, -6); scene.add(post);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd8a0, emissiveIntensity: 12 })); bulb.position.set(2.5, 5.1, -6); scene.add(bulb);
  if (mode === 'rain') fx.rain({ intensity: 1 });
  if (mode === 'storm') { fx.rain({ intensity: 1, wind: [5, 1.5], speed: 13 }); fx.storm({ center: [0, 0, -120], radius: 90, rate: 0.7, seed: 4, height: 190 }); fx.on('lightning', (x, y, z, t) => console.log(`[lightning] strike at t=${t.toFixed(2)} (${x.toFixed(0)},${z.toFixed(0)})`)); }
  if (mode === 'snow') fx.snow({ wind: [1.2, 0.4] });
  if (mode === 'ash') { fx.ashFall({}); fx.embersField({ area: { center: [0, 8, -30], size: [80, 22, 80] } }); fx.fire([-4, 0, -22], { size: 3 }); fx.smokeColumn([-4, 0, -22], { height: 70, width: 8, puffLife: 14 }); }
  const sun = world.sun; if (mode === 'storm') { sun.intensity = 0.15; world.hemi.intensity = 0.15; }
  const bolt = new THREE.PointLight(0x9ab0ff, 0, 400, 1); bolt.position.set(0, 120, -60); scene.add(bolt);
  const base = world.hemi.intensity;
  const shots = [
    { name: mode + '_a', t: 4, cam: [0, 2.0, 10, 0, 2.6, -20], fov: 48 }, { name: mode + '_b', t: 7.3, cam: [4, 1.6, 7, 0, 3.0, -25], fov: 56 }, { name: mode + '_c', t: 9.1, cam: [-1, 3.2, 14, 3, 6, -50], fov: 40 },
  ];
  return {
    shots,
    update(t, dt) { fx.update(dt, t); if (mode === 'storm') { const l = fx.state.lightning; bolt.intensity = l * 4000; world.hemi.intensity = base + l * 2.5; } },
  };
}
