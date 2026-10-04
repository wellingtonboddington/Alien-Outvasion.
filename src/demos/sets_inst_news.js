import { prepStage, shot } from './sets_inst__util.js';
import { createNewsStudio } from '../world/sets/institutional.js';

export default async function setup(stage, params) {
  prepStage(stage, { bg: 0x030408, env: params.env ?? 0.2 });
  const set = createNewsStudio();
  stage.scene.add(set.root);
  stage.camera.position.set(0, 1.7, 8.6); stage.camera.lookAt(0, 2.5, -8);
  return {
    update(t, dt) { set.update(dt, t); },
    shots: [
      shot('wide', 1.0, [0, 1.8, 8.8], [0, 2.6, -8], 52),
      shot('desk', 2.0, [0.5, 1.4, 0.8], [0, 1.1, -6.5], 38),
      shot('twoshot', 3.0, [0, 1.3, -1.2], [0, 1.25, -6.4], 34),
      shot('lounge', 4.0, [3.5, 1.6, 4], [8, 1, -4.5], 55),
      shot('high', 5.0, [-9, 5.5, 9], [2, 2, -8], 60),
    ],
  };
}
