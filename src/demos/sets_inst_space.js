import { prepStage, shot } from './sets_inst__util.js';
import { createObservatory, createMissionControl } from '../world/sets/institutional.js';

export default async function setup(stage, params) {
  const which = params.which || 'observatory';
  prepStage(stage, { bg: 0x02040a, env: params.env ?? 0.18 });
  const set = which === 'mission' ? createMissionControl() : createObservatory();
  stage.scene.add(set.root);
  const shots = which === 'mission' ? [
    shot('wide', 1.0, [0, 5.8, 11], [0, 4, -8], 64),
    shot('floor', 2.0, [0, 1.7, 6.5], [0, 3.5, -10], 62),
    shot('console', 3.0, [-3.8, 1.4, 2.8], [2, 1.8, -6], 58),
    shot('gallery', 4.0, [-10, 3.0, 9.8], [2, 2.5, -4], 66),
    shot('back', 5.0, [0, 3.0, -8], [0, 2.0, 10], 62),
  ] : [
    shot('wide', 1.0, [0, 1.9, -6.7], [0, 3.0, 1], 62),
    shot('slit', 2.0, [0.6, 0.15, 2.8], [0, 7, 0], 70),
    shot('desk', 3.0, [-3.0, 1.5, -2.0], [-4.5, 1.0, -4.5], 56),
    shot('door', 4.0, [-2, 1.6, 2], [3, 1.6, -5], 62),
    shot('high', 5.0, [3.0, 3.9, 6.8], [-1, 2.5, -2], 66),
  ];
  return { update(t, dt) { set.update(dt, t); if (which !== 'mission') set.setSlit(Math.sin(t * 0.2) * 0.3); }, shots };
}
