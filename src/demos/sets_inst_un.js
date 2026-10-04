import { prepStage, shot } from './sets_inst__util.js';
import { createUNHall } from '../world/sets/institutional.js';

export default async function setup(stage, params) {
  prepStage(stage, { bg: 0x050608, env: params.env ?? 0.25 });
  const set = createUNHall();
  stage.scene.add(set.root);
  return {
    update(t, dt) { set.update(dt, t); },
    shots: [
      shot('wide', 1.0, [0, 7.4, 13.2], [0, 3.5, -14], 66),
      shot('podium', 2.0, [0, 1.9, -9], [0, 2.4, -20], 44),
      shot('emblem', 3.0, [0, 4.5, -10], [0, 8, -26], 52),
      shot('delegates', 4.0, [0, 2.3, -19.5], [0, 2.2, 6], 62),
      shot('side', 5.0, [-21, 3.2, -9], [8, 4, -8], 66),
      shot('high', 6.0, [-20, 9, 12.5], [0, 2, -12], 66),
    ],
  };
}
