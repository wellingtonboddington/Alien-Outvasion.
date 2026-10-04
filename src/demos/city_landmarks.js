// Landmark contact sheet (one shot per landmark).  node tools/render.mjs --demo city_landmarks --params '{"only":["berlin_gate"]}'
import * as THREE from 'three';
import { createLandmark } from '../world/city/landmarks.js';
import { setupSky, bloomRenderer } from './city_common.js';

const SHOTS = {
  dumaguete_blvd: { cam: [-30, 4, 28, 20, 5, -10], fov: 58, sky: 'day' },
  dumaguete_belltower: { cam: [24, 9, 38, 0, 12, 0], fov: 50, sky: 'day' },
  cathedral: { cam: [30, 12, 95, 0, 14, 0], fov: 50, sky: 'day' },
  berlin_tv_tower: { cam: [260, 120, 360, 0, 150, 0], fov: 50, sky: 'overcast' },
  berlin_gate: { cam: [60, 14, 110, 0, 12, 0], fov: 50, sky: 'day' },
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
      const nm = s.lm || s.name; const sh = SHOTS[nm] || {}; if (!current || current.userData.landmark !== (nm === 'dumaguete_cathedral' ? 'cathedral' : nm)) { if (current) { group.remove(current); current.dispose && current.dispose(); } current = createLandmark(nm); } else { /* reuse */ } if (!current.parent) group.add(current); if (params.night) current.setNight(1);
      stage.camera.fov = s.fov || sh.fov || 50; const c = s.cam || sh.cam || [0, 20, 80, 0, 10, 0]; stage.camera.position.set(c[0], c[1], c[2]); stage.camera.lookAt(c[3], c[4], c[5]); stage.camera.updateProjectionMatrix(); stage.camera.updateMatrixWorld(true);
      sky.setTarget(new THREE.Vector3(c[3], 0, c[5])); sky.ground.visible = !(nm === 'dumaguete_blvd');
      console.log(s.name, JSON.stringify(current.stats));
    },
    update() {},
  };
}
