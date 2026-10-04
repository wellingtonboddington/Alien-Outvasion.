// Rest-pose layout of a figure (metres). Arms and legs hang straight down at rest; poses are rotations about these pivots.
import { J, NJ } from './rig.js';

export const BASE = {
  hipY: 0.93, kneeY: 0.50, ankleY: 0.085, waistY: 1.07, chestY: 1.29, shoulderY: 1.47, neckY: 1.525, headY: 1.665,
  shoulderX: 0.205, hipX: 0.092, armU: 0.30, armF: 0.265, handL: 0.085, footLen: 0.15, weaponPivot: [-0.15, 1.42, 0.08],
};

export function makeLayout(over = {}) {
  const o = { ...BASE, ...over };
  const L = { ...o };
  L.thigh = o.hipY - o.kneeY; L.shin = o.kneeY - o.ankleY;
  const p = new Float32Array(NJ * 3); const set = (j, x, y, z) => { p[j * 3] = x; p[j * 3 + 1] = y; p[j * 3 + 2] = z; };
  set(J.ROOT_POS, 0, 0, 0); set(J.ROOT_ROT, 0, o.hipY, 0); set(J.SPINE, 0, o.waistY, 0); set(J.HEAD, 0, o.neckY, 0);
  set(J.ARM_L, o.shoulderX, o.shoulderY, 0); set(J.FORE_L, o.shoulderX, o.shoulderY - o.armU, 0);
  set(J.ARM_R, -o.shoulderX, o.shoulderY, 0); set(J.FORE_R, -o.shoulderX, o.shoulderY - o.armU, 0);
  set(J.LEG_L, o.hipX, o.hipY, 0); set(J.SHIN_L, o.hipX, o.kneeY, 0); set(J.FOOT_L, o.hipX, o.ankleY, 0);
  set(J.LEG_R, -o.hipX, o.hipY, 0); set(J.SHIN_R, -o.hipX, o.kneeY, 0); set(J.FOOT_R, -o.hipX, o.ankleY, 0);
  set(J.WEAPON, ...o.weaponPivot);
  set(J.SKIRT_L, o.hipX, o.hipY, 0); set(J.SKIRT_R, -o.hipX, o.hipY, 0);
  L.pivots = p;
  return L;
}
