// Dumaguete street-level / aerial / night.   node tools/render.mjs --demo city_dumaguete --out out/city_dumaguete
import * as THREE from 'three';
import { createCityBlock } from '../world/city.js';
import { setupSky, bloomRenderer } from './city_common.js';

export default async function setup(stage, params) {
  const preset = params.preset || 'day'; const sky = setupSky(stage, preset, { shadow: 110 });
  const block = createCityBlock('dumaguete', { seed: params.seed || 3 });
  stage.scene.add(block.root);
  const L = block.layout; const zr = L.roadsX[1] ?? L.roadsX[0]; const xr = L.roadsZ[1] ?? L.roadsZ[0];
  console.log('block', JSON.stringify(block.stats), 'bounds h', block.bounds.h.toFixed(1), 'roads', L.roadsX.map((v) => v.toFixed(1)), L.roadsZ.map((v) => v.toFixed(1)));
  let render = null; if (preset === 'night' || preset === 'dusk') { block.setNight(preset === 'night' ? 1 : 0.6); render = (() => { const r = bloomRenderer(stage, { strength: 0.8, radius: 0.6, threshold: 0.8 }); return () => r(); })(); }
  return {
    shots: [
      { name: 'street', t: 0, cam: [xr - 50, 1.7, zr + 2.5, xr + 20, 5.5, zr - 3], fov: 52 },
      { name: 'across', t: 0, cam: [xr - 28, 2.4, zr + 1.5, xr - 14, 3.2, zr - 11], fov: 55 },
      { name: 'aerial', t: 0, cam: [-110, 85, 125, 0, 6, 0], fov: 42 },
      { name: 'drone', t: 0, cam: [xr - 25, 14, zr + 1, xr + 15, 5, zr - 4], fov: 60 },
    ],
    render: render ? () => render() : undefined,
    onShot(s) {},
  };
}
