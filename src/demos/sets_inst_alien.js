import { prepStage, shot } from './sets_inst__util.js';
import { createAlienInterior } from '../world/sets/institutional.js';

export default async function setup(stage, params) {
  const kind = params.kind || 'corridor';
  prepStage(stage, { bg: 0x010304, env: 0.14 });
  const set = createAlienInterior(kind);
  stage.scene.add(set.root);
  if (params.infect != null) set.setInfection(+params.infect);
  const A = set.anchors;
  const shots = {
    corridor: [
      shot('along', 1.0, [0, 1.7, 23], [0, 2.4, -10], 55),
      shot('low', 2.0, [0.8, 0.5, 14], [0, 2.0, -12], 60),
      shot('door', 3.0, [0, 1.6, -15], [0, 2.4, -24], 50),
      shot('side', 4.0, [2.2, 1.6, 4], [-2, 2.2, -3], 60),
    ],
    bridge: [
      shot('wide', 1.0, [0, 3.2, 28.5], [0, 7, -20], 60),
      shot('throne', 2.0, [0, 4.6, -6], [0, 6, -21], 50),
      shot('reverse', 3.0, [0, 9, -27], [0, 2, 8], 62),
      shot('window', 4.0, [-6, 5, 6], [2, 8, -26], 70),
      shot('console', 5.0, [4.5, 2.2, -3], [-1, 1.8, -10], 55),
    ],
    hatchery: [
      shot('along', 1.0, [0, 2.2, 32], [0, 3.2, -20], 60),
      shot('low', 2.0, [0.6, 1.0, 22], [3, 2, -8], 62),
      shot('egg', 3.0, [3.0, 1.9, -2], [6, 2.4, -9], 50),
      shot('mother', 4.0, [0, 2.0, -16], [0, 4.5, -30], 58),
      shot('high', 5.0, [-9, 9, 30], [3, 2, -10], 62),
    ],
    hold: [
      shot('wide', 1.0, [0, 3.2, 38.5], [0, 8, -20], 62),
      shot('berth', 2.0, [4, 2.2, -2], [14, 3, -22], 62),
      shot('pens', 3.0, [0, 2.2, 14], [10, 1.5, 33], 60),
      shot('bay', 4.0, [0, 4, 12], [0, 11, -38], 64),
      shot('gantry', 5.0, [-22, 11, -7], [10, 8, -8], 64),
    ],
  }[kind];
  return { update(t, dt) { set.update(dt, t); if (params.infectRamp) set.setInfection(Math.min(1, t / params.infectRamp)); }, shots };
}
