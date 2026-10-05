// Debug: demographics (kid/adult/elder, male/female) + lookAt.
import { createCrowd } from '../models/crowd.js';
import { makeStreetScene } from './crowd_scene.js';
export default async function setup(stage, params = {}) {
  const sc = makeStreetScene(stage, { fog: 0.003, buildings: false });
  const kind = params.kind || 'civilian';
  const crowd = createCrowd(kind, 30, { seed: 5, castShadow: true });
  stage.scene.add(crowd.root);
  const ages = ['adult', 'adult', 'kid', 'kid', 'elder', 'elder'];
  let i = 0;
  for (let k = 0; k < 12; k++) {
    const age = ages[k % 6], sex = k < 6 ? 0 : 1;
    crowd.set(i, { x: (k % 6 - 2.5) * 1.3, z: Math.floor(k / 6) * 1.6, yaw: Math.PI, state: params.state || 'walk', seed: 0.07 + k * 0.081, age, sex, scale: age === 'kid' ? 0.68 : 1, phase: k * 0.2 }); i++;
  }
  crowd.setCount(i); crowd.commit();
  if (params.look) crowd.lookAt({ x: 4, y: 3, z: 6 }, 1);
  return { update(t, dt) { crowd.update(dt, t); sc.follow(0, 0); }, shots: params.shots || [{ name: 'a', t: 1.3, cam: [0, 1.4, -5.5, 0, 0.95, 0.5], fov: 40 }] };
}
