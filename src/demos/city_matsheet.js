// Dev: material swatches lit by the demo sky.  node tools/render.mjs --demo city_matsheet --params '{"names":["s_coral","s_sandstone"]}'
import * as THREE from 'three';
import { MatSet } from '../world/city/materials.js';
import { setupSky } from './city_common.js';
export default async function setup(stage, params) {
  const sky = setupSky(stage, params.sky || 'day', { shadow: 30 }); sky.ground.visible = false; stage.scene.background = new THREE.Color(0x667788);
  const names = params.names || ['g_asphalt', 'g_sidewalk', 'g_paving', 'g_cobble', 'g_grass', 'g_dirt', 'g_concrete', 'g_gravel', 'r_flat', 'r_gi', 'r_tile', 'r_zinc', 's_coral', 's_sandstone', 's_redbrick', 's_redsand', 's_marble', 's_steel', 's_whitewash', 's_plaster', 's_copper', 'concrete'];
  const ms = new MatSet({}); const cols = 6; const g = new THREE.Group(); stage.scene.add(g);
  names.forEach((n, i) => {
    const geo = new THREE.PlaneGeometry(4, 4); const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 1, uv.getY(k) * 1);
    const c = new Float32Array(geo.attributes.position.count * 3).fill(1); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.Mesh(geo, ms.get(n)); m.position.set((i % cols) * 4.4, -Math.floor(i / cols) * 4.4, 0); m.rotation.x = -0.2; m.castShadow = true; m.receiveShadow = true; g.add(m);
  });
  const w = cols * 4.4, h = Math.ceil(names.length / cols) * 4.4; sky.setTarget(new THREE.Vector3(w / 2, -h / 2, 0));
  return { shots: [{ name: 'sheet', t: 0, cam: [w / 2 - 2.2, -h / 2 + 2.2, Math.max(w, h * 1.7) * 0.95, w / 2 - 2.2, -h / 2 + 2.2, 0], fov: 40 }] };
}
