// Crowd rig definition shared by the geometry builder, the pose baker and the shader.
// A "figure" is a rigid hierarchical rig of 17 joints; every vertex is bound to exactly one joint (aMeta.x).
// Joint rotations are Euler (applied as Ry * Rx * Rz) about a rest-space pivot; ROOT_POS is a pure translation.
export const J = {
  ROOT_POS: 0, ROOT_ROT: 1, SPINE: 2, HEAD: 3,
  ARM_L: 4, FORE_L: 5, ARM_R: 6, FORE_R: 7,
  LEG_L: 8, SHIN_L: 9, LEG_R: 10, SHIN_R: 11,
  FOOT_L: 12, FOOT_R: 13, WEAPON: 14, SKIRT_L: 15, SKIRT_R: 16,
};
export const NJ = 17;
export const PARENT = [-1, -1, 1, 2, 2, 4, 2, 6, 1, 8, 1, 10, 9, 11, 2, 1, 1];

/** internal animation states (public names map onto these; 'fall' and 'dead' pick a forward/backward variant per instance) */
export const ST = {
  idle: 0, walk: 1, run: 2, sprint: 3, aim: 4, fire: 5, crouch: 6, cower: 7, crawl: 8, lunge: 9, panic: 10, cough: 11,
  fall_b: 12, fall_f: 13, dead_b: 14, dead_f: 15, cheer: 16,
};
export const NS = 17;
/** public state ids accepted by set({state}) */
export const STATE = { idle: 0, walk: 1, run: 2, sprint: 3, aim: 4, fire: 5, crouch: 6, cower: 7, crawl: 8, lunge: 9, panic: 10, cough: 11, fall: 12, dead: 13, cheer: 14 };
export const STATE_NAMES = ['idle', 'walk', 'run', 'sprint', 'aim', 'fire', 'crouch', 'cower', 'crawl', 'lunge', 'panic', 'cough', 'fall', 'dead', 'cheer'];
export const POSE_FRAMES = 64;

/** colour slots (aMeta.z) */
export const SLOT = {
  FIXED: 0, SKIN: 1, HAIR: 2, TOP: 3, BOT: 4, ACC: 5, SHOE: 6, TOP2: 7, EMIT: 8, METAL: 9, CLOTH: 10, FACE: 11, GLOSS: 12, SLEEVE: 13, LEGLOW: 14, CHEST: 15,
};

/** texture-array layers */
export const LAYER = {
  weave: 0, camo: 1, knit: 2, denim: 3, leather: 4, metal: 5, skin: 6, fleshUS: 7, fleshIN: 8, fleshDE: 9, circuit: 10,
  faceHuman: 11, faceZomb: 12, faceRobot: 13, robotShell: 14, molle: 15, faceCebu: 16, faceIndia: 17, hair: 18, fur: 19, faceRus: 20, fleshRU: 21, gore: 22, frost: 23,
};
export const NLAYER = 24;

/** gate codes (aMeta.y): 0 = always; grp*16 + mask = visible when the instance's option for group grp (0..3) is in mask (bit o = option o);
 *  group 14 = cough puff, group 15 = muzzle flash (shader driven) */
export const GATE = { PUFF: 14 * 16 + 1, FLASH: 15 * 16 + 1 };
export const gate = (grp, ...opts) => grp * 16 + opts.reduce((m, o) => m | (1 << o), 0);
