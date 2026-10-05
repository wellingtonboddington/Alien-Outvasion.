import * as City from '../world/city.js';
import { createSky } from '../world/sky.js';
import { createOcean } from '../world/ocean.js';
export default async function setup(stage) { const sky = createSky('dawn'); sky.applyTo(stage.scene); const g = City.createLandmark('dumaguete_blvd', {}); stage.scene.add(g); const oc = createOcean({ size: 6000, seaLevel: g.userData.info.waterLevel }); stage.scene.add(oc.root);
  stage.camera.far = 8000; return { update(t, dt) { sky.update(dt, t); oc.update(dt, t); g.update && g.update(dt, t); },
  shots: [{ name: 'aerial', t: 1, cam: [0, 70, 90, 0, 0, 0], fov: 55 }, { name: 'aerial2', t: 1, cam: [-80, 40, -60, 0, 0, 0], fov: 55 }, { name: 'walk', t: 1, cam: [-60, 2, 8, 0, 3, 0], fov: 50 }] }; }
