// Same block at damage 0 / 0.5 / 1, plus ruins, crater, wrecks, rubble.  node tools/render.mjs --demo city_ruins
import * as THREE from 'three';
import { createCityBlock, damageCity, createRuins, createCrater, createWreck, createRubble, createBurningBuilding, createCollapsedOverpass, createToppledBridge } from '../world/city.js';
import { setupSky, bloomRenderer } from './city_common.js';
export default async function setup(stage, params) {
  const sky = setupSky(stage, params.preset || 'smoke', { shadow: 110 });
  const block = createCityBlock(params.style || 'dumaguete', { seed: params.seed || 3 }); stage.scene.add(block.root);
  const extras = new THREE.Group(); stage.scene.add(extras); extras.visible = false;
  const place = (o, x, z, ry = 0) => { o.root.position.set(x, 0, z); o.root.rotation.y = ry; extras.add(o.root); return o; };
  const L = block.layout; const zr = L.roadsX[1] ?? L.roadsX[0]; const xr = L.roadsZ[1] ?? L.roadsZ[0];
  const mk = () => {
    place(createRuins({ style: 'dumaguete', w: 60, d: 50, seed: 3 }), -300, 0); place(createCrater({ radius: 10, depth: 3, glow: true, fire: 3 }), -240, 0);
    place(createWreck('jet'), -190, 0); place(createWreck('tank'), -160, 0); place(createWreck('alien_pod'), -135, 0); place(createWreck('tripod_leg'), -100, 0, 0.3); place(createWreck('car'), -75, 0); place(createWreck('bus'), -60, 0, 0.5);
    place(createRubble({ radius: 8, count: 220, height: 3, fire: 2 }), -40, 0); place(createBurningBuilding({ kind: 'midrise', floors: 8 }), -10, 0, 0); place(createCollapsedOverpass(), 40, 60); place(createToppledBridge(), 120, 60);
  };
  let built = false;
  return {
    shots: [
      { name: 'd0', t: 0, cam: [xr - 28, 3.0, zr + 3, xr + 15, 6, zr - 4], fov: 60, lv: 0 },
      { name: 'd05', t: 0, cam: [xr - 28, 3.0, zr + 3, xr + 15, 6, zr - 4], fov: 60, lv: 0.5 },
      { name: 'd1', t: 0, cam: [xr - 28, 3.0, zr + 3, xr + 15, 6, zr - 4], fov: 60, lv: 1 },
      { name: 'aerial1', t: 0, cam: [-110, 80, 125, 0, 6, 0], fov: 42, lv: 1 },
      { name: 'aerial05', t: 0, cam: [-110, 80, 125, 0, 6, 0], fov: 42, lv: 0.5 },
      { name: 'props1', t: 0, cam: [-270, 20, 60, -150, 4, 0], fov: 55, props: true },
      { name: 'props2', t: 0, cam: [-60, 14, 30, 40, 6, 0], fov: 60, props: true },
    ],
    onShot(s) { if (s.props) { if (!built) { mk(); built = true; } extras.visible = true; block.root.visible = false; } else { extras.visible = false; block.root.visible = true; damageCity(block, s.lv ?? 0, 1); }
      sky.setTarget(new THREE.Vector3(s.cam[3], 0, s.cam[5])); sky.ground.visible = true; },
  };
}
