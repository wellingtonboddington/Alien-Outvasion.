// Landmark contact sheet (one shot per landmark).  node tools/render.mjs --demo city_landmarks --params '{"only":["berlin_gate"]}'
import * as THREE from 'three';
import { createLandmark } from '../world/city/landmarks.js';
import { setupSky, bloomRenderer } from './city_common.js';

const SHOTS = {
  dumaguete_blvd: { cam: [-30, 4, 28, 20, 5, -10], fov: 58, sky: 'day' },
  dumaguete_belltower: { cam: [24, 9, 38, 0, 12, 0], fov: 50, sky: 'day' },
  cathedral: { cam: [30, 12, 95, 0, 14, 0], fov: 50, sky: 'day' },
  berlin_tv_tower: { cam: [260, 120, 360, 0, 150, 0], fov: 50, sky: 'overcast' },
  berlin_gate: { cam: [40, 8, 75, 0, 14, 0], fov: 50, sky: 'day' },
  moscow_kremlin: { cam: [-60, 14, 110, 60, 22, -60], fov: 50, sky: 'day', snow: 0.8 },
  newyork_towers: { cam: [-320, 90, 260, 20, 120, -10], fov: 50, sky: 'day' },
  delhi_gate: { cam: [30, 10, 120, 0, 18, 0], fov: 50, sky: 'haze' },
  cebu_skyline: { cam: [420, 70, 320, 0, 60, 0], fov: 50, sky: 'day' },
  pentagon: { cam: [0, 520, 560, 0, 0, 0], fov: 45, sky: 'day' },
  un_building: { cam: [-50, 14, 190, 10, 40, -60], fov: 50, sky: 'day' },
  georgia_mountains: { cam: [0, 60, 900, 0, 900, -4000], fov: 55, sky: 'day' },
  whitehouse_like: { cam: [-40, 14, 120, 0, 8, 0], fov: 50, sky: 'day' },
};
export default async function setup(stage, params) {
  const names = params.only || Object.keys(SHOTS);
  const sky = setupSky(stage, params.sky || 'day', { shadow: 200 });
  const group = new THREE.Group(); stage.scene.add(group); const cur = {};
  const shots = names.map((n) => ({ name: n, t: 0 }));
  let current = null;
  return {
    shots,
    onShot(s) {
      const nm = s.lm || s.name; const sh = SHOTS[nm] || {}; if (!current || current.userData.landmark !== (nm === 'dumaguete_cathedral' ? 'cathedral' : nm)) { if (current) { group.remove(current); current.dispose && current.dispose(); } current = createLandmark(nm, { snow: sh.snow || 0 }); } else { /* reuse */ } if (!current.parent) group.add(current); if (params.night) current.setNight(1);
      stage.camera.fov = s.fov || sh.fov || 50; const c = s.cam || sh.cam || [0, 20, 80, 0, 10, 0]; stage.camera.position.set(c[0], c[1], c[2]); stage.camera.lookAt(c[3], c[4], c[5]); stage.camera.updateProjectionMatrix(); stage.camera.updateMatrixWorld(true);
      sky.setTarget(new THREE.Vector3(c[3], 0, c[5])); sky.ground.visible = !(nm === 'dumaguete_blvd');
      console.log(s.name, JSON.stringify(current.stats));
    },
    update() {},
  };
}
