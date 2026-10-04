import { prepStage, shot } from './sets_inst__util.js';
import { createWarRoom } from '../world/sets/institutional.js';

export default async function setup(stage, params) {
  prepStage(stage, { bg: 0x030408, env: params.env ?? 0.22 });
  const set = createWarRoom();
  stage.scene.add(set.root);
  if (params.threat != null) set.setThreat(+params.threat);
  stage.camera.position.set(0, 3.4, 11.6);
  return {
    update(t, dt) { set.update(dt, t); },
    shots: [
      shot('wide', 1.0, [0, 3.4, 11.6], [0, 2.8, -8], 62),
      shot('table', 2.0, [0, 1.7, 2.6], [0, 1.4, -6], 52),
      shot('mapTable', 3.0, [-4.2, 1.9, 1.4], [0, 1.0, -1.6], 55),
      shot('consoles', 4.0, [-3, 1.6, 6.5], [3, 1.2, 10], 60),
      shot('briefing', 5.0, [-12, 1.6, -9], [-10, 1.4, -4], 60),
      shot('top', 6.0, [0, 6.0, 8.5], [0, 0.5, -4], 70),
    ],
  };
}
