// Dev: single buildings.   node tools/render.mjs --demo city_bldg --params '{"kind":"shophouse"}'
import * as THREE from 'three';
import { createBuilding } from '../world/city/objects.js';
import { setupSky } from './city_common.js';
export default async function setup(stage, params) {
  const sky = setupSky(stage, params.sky || 'day', { shadow: 60 });
  const b = createBuilding(params.kind || 'shophouse', { seed: params.seed || 2, damage: params.damage || 0 }); stage.scene.add(b.root);
  if (params.night) b.setNight(1);
  console.log(JSON.stringify(b.stats), JSON.stringify(b.bounds));
  const h = b.bounds.h, w = b.bounds.w;
  return { shots: [{ name: 'front', t: 0, cam: [w * 0.6, Math.min(8, h * 0.4), w * 1.3 + 10, 0, h * 0.3, 0], fov: 45 }, { name: 'corner', t: 0, cam: [w * 1.0 + 8, 3, 18, -w * 0.2, h * 0.35, 0], fov: 55 }] };
}
