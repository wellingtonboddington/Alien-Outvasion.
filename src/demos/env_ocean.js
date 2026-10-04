// env_ocean: beach POV (sand, shallows, foam, palms), aerial coast, open sea at several times of day / storm.
//   node tools/render.mjs --demo env_ocean --out out/env_ocean [--q 0]
import * as THREE from 'three';
import { createSky } from '../world/sky.js';
import { createTerrain } from '../world/terrain.js';
import { createOcean } from '../world/ocean.js';
import { scatterVegetation, setWind } from '../world/vegetation.js';

export default async function setup(stage) {
  const { scene, camera } = stage;
  camera.near = 0.3; camera.far = 9000; camera.fov = 50; camera.updateProjectionMatrix();
  const sky = createSky('goldenHour'); sky.applyTo(scene);
  const terr = createTerrain({ style: 'tropical', size: 3600, seed: 4, flatRadius: 30, layout: 'island', islandRadius: 620, flatHeight: 2.3 });
  scene.add(terr.root);
  const ocean = createOcean({ terrain: terr, shore: { extent: 2200 }, waveDir: 0.9 }); scene.add(ocean.root);
  const sh = terr.shorePoint(0.6, {}); // shoreline point + seaward normal
  const veg = [];
  const palms = scatterVegetation(terr, 'coconut', 70, { cx: sh.x - sh.nx * 40, cz: sh.z - sh.nz * 40, radius: 90 }, 3, { minDist: 4.5 }); scene.add(palms.root); veg.push(palms);
  const bush = scatterVegetation(terr, 'bush', 60, { cx: sh.x - sh.nx * 25, cz: sh.z - sh.nz * 25, radius: 90 }, 5, { variant: 'flowering' }); scene.add(bush.root); veg.push(bush);
  const grass = scatterVegetation(terr, 'grass', 800, { cx: sh.x - sh.nx * 45, cz: sh.z - sh.nz * 45, radius: 80 }, 6); scene.add(grass.root); veg.push(grass);
  sky.setShadowFocus(new THREE.Vector3(sh.x - sh.nx * 20, 2, sh.z - sh.nz * 20), 90);
  const rel = (c) => { // coast frame: n = seaward, t = along
    const nx = sh.nx, nz = sh.nz, tx = -nz, tz = nx; return [sh.x + nx * c[0] + tx * c[1], c[2], sh.z + nz * c[0] + tz * c[1]];
  };
  const demo = {
    update(t, dt) { sky.update(dt, t); ocean.update(dt, t); },
    onShot(s, t) {
      if (s.preset) { sky.setPreset(s.preset); if (s.storm) { sky.setStorm(s.storm); ocean.setChoppiness(2); ocean.setWaveHeight(3.5); setWind(1.6, 0.9); } else { sky.setStorm(0); ocean.setChoppiness(1); ocean.setWaveHeight(s.wh ?? 1); setWind(0.5, 0.9); } }
      sky.update(0, 30 + t); ocean.update(0, t);
      if (s.rel) { const p = rel(s.rel), l = rel(s.relLook); camera.position.set(p[0], Math.max(p[1], terr.heightAt(p[0], p[2]) + (s.h || 1.7)), p[2]); camera.lookAt(l[0], l[1], l[2]); }
    },
    shots: [
      { name: 'beach', t: 12, preset: 'goldenHour', rel: [-6, 0, 0], relLook: [200, -25, 0], h: 1.7, fov: 52 },
      { name: 'beach2', t: 14, preset: 'day', rel: [-14, 20, 0], relLook: [200, 20, 0], h: 1.6, fov: 55 },
      { name: 'shallows', t: 16, preset: 'goldenHour', rel: [16, 0, 1.8], relLook: [180, 10, 0], fov: 55 },
      { name: 'aerial', t: 18, preset: 'day', cam: [-1800, 650, -1900, 0, 0, 0], fov: 50 },
      { name: 'open_sea', t: 20, preset: 'day', cam: [2400, 4, 2000, -1000, 40, -800], fov: 55 },
      { name: 'dusk_sea', t: 22, preset: 'dusk', cam: [2400, 6, 2000, -1000, 60, -800], fov: 55 },
      { name: 'storm_sea', t: 24, preset: 'overcast', storm: 1, cam: [2400, 6, 2000, -1000, 60, -800], fov: 55 },
    ],
  };
  return demo;
}
