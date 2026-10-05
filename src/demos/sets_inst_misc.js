import { prepStage, shot } from './sets_inst__util.js';
import * as S from '../world/sets/institutional.js';

const DEFS = {
  datacenter: () => S.createDataCenter(), bunker: () => S.createBunker(), command: () => S.createCommandPost(), launch: () => S.createLaunchSite(), silo: () => S.createSiloControl(),
};
const SHOTS = {
  datacenter: [shot('wide', 1, [0, 2.0, 14.3], [0, 1.6, -4], 64), shot('aisle', 2, [-5.4, 1.5, 11.5], [-5.4, 1.3, -6], 58), shot('cores', 3, [0.4, 1.6, 11], [0, 1.8, -8], 56), shot('desk', 4, [-3, 1.6, 9], [0, 1.0, 13], 62)],
  bunker: [shot('wide', 1, [-4.6, 1.7, 3.3], [1.5, 1.0, -1.5], 70), shot('radio', 2, [3.6, 1.5, -0.6], [3.4, 1.0, -3.4], 58), shot('bunks', 3, [3, 1.5, 1.2], [-4.5, 1.0, -0.5], 66), shot('table', 4, [-1, 1.5, 2.8], [0.2, 0.9, 0.3], 56)],
  command: [shot('wide', 1, [-4, 2.4, 14], [0, 1.6, -2], 64), shot('tent', 2, [0, 1.6, 6.8], [0, 1.3, -3], 60), shot('inside', 3, [-5.5, 1.7, 0.8], [-1, 1.0, -3], 62), shot('mast', 4, [6, 1.4, 8], [11, 8, 3], 64)],
  launch: [shot('wide', 1, [-16, 3.2, 24], [0, 8, 0], 62), shot('pad', 2, [8, 1.8, 15], [0, 6, 0], 60), shot('low', 3, [0.5, 0.6, 12], [0, 12, 0], 64), shot('trucks', 4, [10, 1.8, 6], [22, 1.8, -8], 60)],
  silo: [shot('wide', 1, [-3.8, 1.9, 2.8], [1, 1.2, -1.5], 66), shot('both', 2, [0, 1.5, 2.6], [0, 1.2, -1], 62), shot('keyA', 3, [-3.3, 1.5, 0.9], [-2.4, 1.0, -0.5], 50), shot('board', 4, [0, 1.6, 1.2], [0, 1.9, -3], 60)],
};
export default async function setup(stage, params) {
  const which = params.which || 'datacenter';
  prepStage(stage, { bg: which === 'launch' || which === 'command' ? 0x7a9ac0 : 0x030405, env: params.env ?? (which === 'launch' || which === 'command' ? 0.7 : 0.2) });
  const set = DEFS[which]();
  stage.stage = null; stage.scene.add(set.root);
  if (params.infect != null) set.setInfection(+params.infect);
  return { update(t, dt) { set.update(dt, t); }, shots: SHOTS[which] };
}
