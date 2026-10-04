// env_terrain: tropical island (aerial + beach POV), snow plain, desert dunes, Caucasus-style mountain ring, farmland.
//   node tools/render.mjs --demo env_terrain --out out/env_terrain [--q 0]
import * as THREE from 'three';
import { createSky } from '../world/sky.js';
import { createTerrain } from '../world/terrain.js';

export default async function setup(stage, params = {}) {
  const { scene, camera } = stage;
  camera.near = 0.3; camera.far = 9000; camera.fov = 50; camera.updateProjectionMatrix();
  const sky = createSky('day'); sky.applyTo(scene);
  let terr = null, sea = null; let cur = '';
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1b6a86, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.88 });

  const SETUPS = {
    island: { terrain: { style: 'tropical', size: 3200, seed: 4, flatRadius: 50, islandRadius: 520 }, preset: 'goldenHour', sea: true },
    snow: { terrain: { style: 'snow', size: 3200, seed: 2, flatRadius: 80, ring: 0.5 }, preset: 'coldMorning' },
    desert: { terrain: { style: 'desert', size: 3200, seed: 3, flatRadius: 40 }, preset: 'day' },
    rocky: { terrain: { style: 'rocky', size: 4000, seed: 5, flatRadius: 90, ringRadius: 560 }, preset: 'dayHaze' },
    farmland: { terrain: { style: 'farmland', size: 3200, seed: 6, flatRadius: 60 }, preset: 'day' },
    temperate: { terrain: { style: 'temperate', size: 3200, seed: 7, flatRadius: 60 }, preset: 'day' },
  };
  function build(name) {
    if (cur === name) return; cur = name;
    if (terr) { scene.remove(terr.root); terr.dispose(); terr = null; } if (sea) { scene.remove(sea); sea.geometry.dispose(); sea = null; }
    const S = SETUPS[name]; const t0 = performance.now();
    terr = createTerrain(S.terrain); scene.add(terr.root);
    console.log(`terrain ${name} built in ${(performance.now() - t0).toFixed(0)}ms`);
    if (S.sea) { sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), seaMat); sea.rotation.x = -Math.PI / 2; scene.add(sea); }
    sky.setPreset(S.preset); sky.setShadowFocus(new THREE.Vector3(0, 0, 0), 200); sky.update(0, 3.3);
    if (terr.receiveShadow !== undefined) terr.mesh.receiveShadow = true;
  }
  build('island');
  const demo = {
    update(t, dt) { sky.update(dt, t); },
    onShot(s) { build(s.terrain || 'island'); if (s.preset) { sky.setPreset(s.preset); sky.update(0, 10 + s.t); } },
    shots: [
      { name: 'island_aerial', t: 0, terrain: 'island', cam: [-1100, 520, -1250, 0, -10, 0], fov: 50 },
      { name: 'island_beach', t: 1, terrain: 'island', cam: [440, 3.2, 150, 700, 6, 330], fov: 55 },
      { name: 'island_hills', t: 2, terrain: 'island', cam: [70, 40, -380, 100, 10, 0], fov: 50 },
      { name: 'snow', t: 3, terrain: 'snow', cam: [-300, 90, -500, 100, 0, 200], fov: 50, preset: 'coldMorning' },
      { name: 'desert', t: 4, terrain: 'desert', cam: [-300, 70, -500, 100, 0, 200], fov: 50, preset: 'day' },
      { name: 'rocky', t: 5, terrain: 'rocky', cam: [-100, 120, -520, 200, 150, 400], fov: 55, preset: 'dayHaze' },
      { name: 'farm', t: 6, terrain: 'farmland', cam: [-300, 260, -600, 100, 0, 200], fov: 55, preset: 'day' },
      { name: 'temperate', t: 7, terrain: 'temperate', cam: [-300, 130, -500, 100, 0, 200], fov: 55, preset: 'day' },
    ],
  };
  return demo;
}
