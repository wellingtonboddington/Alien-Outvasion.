import { prepStage, shot } from './sets_inst__util.js';
import { createLab } from '../world/sets/institutional.js';

export default async function setup(stage, params) {
  const kind = params.kind || 'bsl4';
  prepStage(stage, { bg: 0x05070a, env: params.env ?? 0.3 });
  const set = createLab(kind);
  stage.scene.add(set.root);
  if (params.infect != null) set.setInfection(+params.infect);
  const bsl = {
    wide: shot('wide', 1.0, [1.6, 1.9, 5.0], [-1, 1.3, -2], 62),
    gloves: shot('gloves', 2.0, [-0.8, 1.5, 3.9], [-0.8, 1.2, 0], 55),
    fridges: shot('fridges', 3.0, [1.5, 1.6, 1.2], [1.4, 1.2, -5], 62),
    suits: shot('suits', 4.0, [3.6, 1.5, -2.0], [7, 1.2, -0.5], 62),
    airlock: shot('airlock', 5.0, [-3.3, 1.5, 1.5], [-6.5, 1.4, -1.5], 66),
    virus: shot('virus', 6.0, [-1.8, 1.4, 1.5], [-2.3, 1.4, 5.2], 55),
  };
  const gen = {
    wide: shot('wide', 1.0, [0.5, 1.9, 4.5], [0, 1.3, -2], 62),
    bench: shot('bench', 2.0, [-1.0, 1.5, 1.0], [-1.5, 1.0, -4.0], 52),
    island: shot('island', 3.0, [0.6, 1.4, 3.4], [0.6, 1.0, 0.9], 55),
    hood: shot('hood', 4.0, [3.7, 1.5, 1.4], [4.5, 1.4, -4.2], 56),
    board: shot('board', 5.0, [-3.0, 1.6, 1.8], [-6.5, 1.9, 2.8], 62),
  };
  return { update(t, dt) { set.update(dt, t); }, shots: Object.values(kind === 'bsl4' ? bsl : gen) };
}
