// Manhattan canyon street-level / aerial / night.  node tools/render.mjs --demo city_manhattan --out out/city_man
import * as THREE from 'three';
import { createCityBlock } from '../world/city.js';
import { setupSky, bloomRenderer } from './city_common.js';
export default async function setup(stage, params) {
  const preset = params.preset || 'day'; const sky = setupSky(stage, preset, { shadow: 130 });
  const block = createCityBlock('manhattan', { seed: params.seed || 2, damage: params.damage || 0 }); stage.scene.add(block.root);
  const L = block.layout; const zr = L.roadsX[1] ?? L.roadsX[0]; const xr = L.roadsZ[1] ?? L.roadsZ[0];
  console.log('manhattan', JSON.stringify(block.stats), 'h', block.bounds.h.toFixed(0));
  let render = null; if (preset === 'night') { block.setNight(1); const r = bloomRenderer(stage, { strength: 0.8, radius: 0.6, threshold: 0.8 }); render = () => r(); }
  return {
    shots: [
      { name: 'street', t: 0, cam: [xr - 70, 1.8, zr + 3, xr + 40, 14, zr - 2], fov: 55 },
      { name: 'canyon', t: 0, cam: [xr - 30, 3.5, zr + 2, xr + 10, 40, zr - 8], fov: 60 },
      { name: 'aerial', t: 0, cam: [-150, 140, 190, 0, 20, 0], fov: 45 },
    ], render: render ? () => render() : undefined,
  };
}
