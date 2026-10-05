// Zombie crowd kinds (one builder, six strains with distinct silhouettes, textures and gaits).
import { J, SLOT, LAYER, gate, GATE } from './rig.js';
import { FigureMesh, loft, box, cyl, ellipsoid, xf, warp } from './build.js';
import { makeLayout } from './layout.js';
import { bodyParts, bakeBodyAO, hairCap, hairLong } from './figure.js';
import { capHat } from './gear.js';
import { arm, armIK, stanceLegs, S, C } from './clips.js';

const mat = (slot, layer, color = 0xffffff, shade = 1) => ({ slot, layer, color, shade });
const bump = (c, p, w) => { const d = Math.abs(((c - p + 0.5) % 1 + 1) % 1 - 0.5); return Math.exp(-(d / w) * (d / w)); };
const twitchSeries = (c, seeds, w = 0.025) => { let a = 0; for (const [p, s] of seeds) a += s * bump(c, p, w); return a; };
const TW1 = [[0.07, 1], [0.21, -0.8], [0.34, 0.9], [0.41, -0.6], [0.58, 1], [0.7, -1], [0.83, 0.7], [0.93, -0.5]];
const TW2 = [[0.12, -1], [0.19, 0.7], [0.47, 1], [0.53, -0.9], [0.66, 0.8], [0.77, -0.6], [0.9, 1]];
const TW3 = [[0.03, 0.8], [0.26, -1], [0.38, 0.6], [0.62, 1], [0.74, -0.7], [0.88, 0.9]];

// ---- arm behaviours shared by the strains
function armsReach(P, c, o) { // both arms forward, grabbing
  const r = o.reach ?? 1.3;
  arm(P, 1, r + 0.1 * S(c, 1, 0.1), o.abd ?? 0.12, (o.flex ?? 0.45) + 0.12 * S(c, 1, 0.3));
  arm(P, -1, r + 0.1 * S(c, 1, 0.6), o.abd ?? 0.12, (o.flex ?? 0.45) + 0.12 * S(c, 1, 0.8));
}
function armsFling(P, c, o) { // loose running arms
  const A = o.A ?? 1.0, cl = C(c, 1);
  arm(P, 1, (o.base ?? 0.3) - A * cl, o.abd ?? 0.25, 0.7 + 0.5 * (0.5 - 0.5 * cl) + (o.flex ?? 0));
  arm(P, -1, (o.base ?? 0.3) + A * cl, o.abd ?? 0.25, 0.7 + 0.5 * (0.5 + 0.5 * cl) + (o.flex ?? 0));
}
function armsHang(P, c, o) { // heavy dangling arms
  const cl = C(c, 1); const A = o.A ?? 0.25;
  arm(P, 1, (o.base ?? 0.2) - A * cl, o.abd ?? 0.16, 0.25 + 0.15 * (0.5 - 0.5 * cl));
  arm(P, -1, (o.base ?? 0.2) + A * cl, o.abd ?? 0.16, 0.25 + 0.15 * (0.5 + 0.5 * cl));
}
function armsStiff(P, c, o) { // rigid straight arms forward (disciplined)
  const r = o.reach ?? 1.4;
  arm(P, 1, r + 0.03 * S(c, 2), 0.06, 0.04); arm(P, -1, r + 0.03 * S(c, 2, 0.5), 0.06, 0.04);
}
const ARMS = { reach: armsReach, fling: armsFling, hang: armsHang, stiff: armsStiff };

// =====================================================================================================================================
const STRAINS = {
  us: {
    layout: { shoulderY: 1.5, neckY: 1.53, headY: 1.65, shoulderX: 0.275, hipX: 0.11, hipY: 0.95, kneeY: 0.51, armU: 0.34, armF: 0.31, waistY: 1.08, chestY: 1.31 },
    torso: { hipRx: 0.2, hipRz: 0.13, waistRx: 0.19, waistRz: 0.12, chestRx: 0.275, chestRz: 0.165, shRx: 0.3, shRz: 0.15, neckR: 0.135, chestCz: 0.03 },
    arm: { r0: 0.085, r1: 0.07, fr0: 0.072, fr1: 0.052, bulge: 0.3, fbulge: 0.25 }, leg: { t0: 0.108, t1: 0.075, s0: 0.07, s1: 0.05, mid: 0.14, calf: 0.15 },
    head: { scale: 0.95, rx: 0.084 }, handSize: 1.5, footW: 0.125, neckR: 0.062,
    skin: [0x849080, 0x788a72, 0x6e8068, 0x8a9078, 0x7a8a74, 0x647860], hair: [0x1a1510, 0x2a2018, 0x4a3a28, 0x302820, 0x6a5a48, 0x8a8478],
    skinLayer: LAYER.fleshUS, face: LAYER.faceZomb,
    top: [0x4a4238, 0x2e3238, 0x5a2e2a, 0x3a4234, 0x6a6458, 0x28282c, 0x4a5058, 0x6a4a32], bot: [0x30343c, 0x3e3a34, 0x4a4e58, 0x28262a, 0x5a5448, 0x36402f],
    acc: [0x4a3a2c, 0x2a2a2e, 0x5a4a38, 0x3a3a3a, 0x6a2a2a, 0x2e3a32], shoe: [0x24201c, 0x32281e, 0x181614, 0x3a3228],
    bareChest: 0.5, bareArm: 0.5, bareLeg: 0.55, dirt: 0.45, kneeBend: 0.14,
    walk: { v: 0.95, f: 0.7, duty: 0.66, lift: 0.07, drop: 0.045, width: 0.05, toeOut: 0.18, roll: 0.16, lean: 0.2, twist: 0.12, sway: 0.03, roll2: 0.07 },
    run: { v: 3.1, f: 1.15, duty: 0.44, lift: 0.17, drop: 0.07, width: 0.045, toeOut: 0.12, roll: 0.1, toe: 0.8, lean: 0.34, twist: 0.12, sway: 0.03, roll2: 0.07 },
    sprint: { v: 5.0, f: 1.5, duty: 0.35, lift: 0.24, drop: 0.09, width: 0.04, toeOut: 0.1, roll: 0.08, toe: 0.9, lean: 0.45, twist: 0.1, sway: 0.025, roll2: 0.06 },
    lunge: { v: 5.6, f: 1.35, duty: 0.3, lift: 0.26, drop: 0.1, width: 0.04, toeOut: 0.1, roll: 0.08, toe: 0.9, lean: 0.5, twist: 0.1, sway: 0.02, roll2: 0.05 },
    arms: { walk: 'reach', run: 'reach', sprint: 'fling', lunge: 'reach', panic: 'fling' }, reach: 1.25, hunch: 0.14, headLoll: 0.3, twitch: 0.0,
  },
  giant: {
    layout: { hipY: 1.26, kneeY: 0.68, ankleY: 0.115, waistY: 1.45, chestY: 1.77, shoulderY: 2.02, neckY: 2.08, headY: 2.27, shoulderX: 0.38, hipX: 0.155, armU: 0.47, armF: 0.43, handL: 0.13, weaponPivot: [0, 1.5, 0.1] },
    torso: { hipRx: 0.275, hipRz: 0.18, waistRx: 0.26, waistRz: 0.17, chestRx: 0.38, chestRz: 0.23, shRx: 0.42, shRz: 0.2, neckR: 0.19, chestCz: 0.04 },
    arm: { r0: 0.125, r1: 0.1, fr0: 0.105, fr1: 0.078, bulge: 0.28, fbulge: 0.22 }, leg: { t0: 0.15, t1: 0.105, s0: 0.1, s1: 0.072, mid: 0.1, calf: 0.12 },
    head: { scale: 1.0, rx: 0.088 }, handSize: 2.0, footW: 0.17, footL: 0.4, neckR: 0.085, giant: true,
    skin: [0x74866e, 0x687a64, 0x7e8c74, 0x5e7060], hair: [0x1a1510, 0x2a2018, 0x4a3a28, 0x302820],
    skinLayer: LAYER.fleshUS, face: LAYER.faceZomb,
    top: [0x3a342e, 0x2a2c30, 0x4a2e28, 0x34382e], bot: [0x34322e, 0x2c2a28, 0x3a3e46, 0x262428], acc: [0x4a3a2c, 0x2a2a2e, 0x5a4a38, 0x3a3a3a], shoe: [0x24201c, 0x32281e],
    bareChest: 0.9, bareArm: 0.95, bareLeg: 0.7, dirt: 0.4, kneeBend: 0.16,
    walk: { v: 1.5, f: 0.55, duty: 0.66, lift: 0.1, drop: 0.07, width: 0.07, toeOut: 0.14, roll: 0.25, lean: 0.12, twist: 0.1, sway: 0.04, roll2: 0.07 },
    run: { v: 4.4, f: 0.85, duty: 0.44, lift: 0.22, drop: 0.12, width: 0.06, toeOut: 0.1, roll: 0.14, toe: 0.7, lean: 0.25, twist: 0.1, sway: 0.04, roll2: 0.06 },
    sprint: { v: 6.5, f: 1.05, duty: 0.36, lift: 0.3, drop: 0.15, width: 0.05, toeOut: 0.08, roll: 0.1, toe: 0.8, lean: 0.34, twist: 0.08, sway: 0.03, roll2: 0.05 },
    lunge: { v: 6.8, f: 1.0, duty: 0.32, lift: 0.34, drop: 0.16, width: 0.05, toeOut: 0.08, roll: 0.1, toe: 0.8, lean: 0.4, twist: 0.08, sway: 0.03, roll2: 0.05 },
    arms: { walk: 'hang', run: 'fling', sprint: 'fling', lunge: 'reach', panic: 'fling' }, reach: 1.2, hunch: 0.1, headLoll: 0.15, twitch: 0.0,
  },
  india: {
    layout: { shoulderX: 0.185, hipX: 0.085, armU: 0.32, armF: 0.29, headY: 1.66 },
    torso: { hipRx: 0.15, hipRz: 0.1, waistRx: 0.135, waistRz: 0.092, chestRx: 0.165, chestRz: 0.108, shRx: 0.185, shRz: 0.1, neckR: 0.062 },
    arm: { r0: 0.04, r1: 0.034, fr0: 0.034, fr1: 0.027 }, leg: { t0: 0.074, t1: 0.05, s0: 0.048, s1: 0.034 },
    head: { scale: 1.0, rx: 0.078, rz: 0.092 }, handSize: 1.15, neckR: 0.04,
    skin: [0xb0ae78, 0xa2a06c, 0xb8b684, 0x949260, 0xaaa874, 0x8a8a5a], hair: [0x14100c, 0x241a12, 0x30241a, 0x3e3024, 0x58483a, 0x1c1814],
    skinLayer: LAYER.fleshIN, face: LAYER.faceIndia,
    top: [0xe8e4d8, 0xc8d4dc, 0xd8c8a8, 0xe0a86a, 0xb4c0a0, 0xd4d0c8, 0xa8b4c8, 0xc89a8a], bot: [0x4a4e5a, 0x6a6a64, 0xd8d2c4, 0x3e4048, 0x5e5a4e, 0x2e3038],
    acc: [0xc8883a, 0x8a3a2a, 0x3a5a7a, 0xd8d0b8, 0x4a6a4a, 0x2a2a2e], shoe: [0x2a2a2a, 0x4a3a2a, 0x6a5a48, 0x1e1e1e],
    bareChest: 0.0, bareArm: 0.35, bareLeg: 0.5, dirt: 0.3, kneeBend: 0.2,
    walk: { v: 1.5, f: 1.0, duty: 0.58, lift: 0.1, drop: 0.05, width: 0.03, toeOut: 0.1, roll: 0.18, lean: 0.34, twist: 0.2, sway: 0.03, roll2: 0.08 },
    run: { v: 4.4, f: 1.55, duty: 0.4, lift: 0.2, drop: 0.07, width: 0.03, toeOut: 0.1, roll: 0.1, toe: 0.9, lean: 0.5, twist: 0.2, sway: 0.03, roll2: 0.07 },
    sprint: { v: 6.8, f: 1.95, duty: 0.32, lift: 0.28, drop: 0.1, width: 0.025, toeOut: 0.08, roll: 0.08, toe: 1.0, lean: 0.65, twist: 0.16, sway: 0.03, roll2: 0.06 },
    lunge: { v: 6.8, f: 1.8, duty: 0.3, lift: 0.3, drop: 0.11, width: 0.025, toeOut: 0.08, roll: 0.08, toe: 1.0, lean: 0.7, twist: 0.14, sway: 0.03, roll2: 0.05 },
    arms: { walk: 'hang', run: 'fling', sprint: 'fling', lunge: 'reach', panic: 'fling' }, reach: 1.3, hunch: 0.2, headLoll: 0.35, twitch: 0.0, sprintFling: 1.25,
  },
  russia: {
    layout: { shoulderX: 0.235, hipX: 0.1, headY: 1.68 },
    torso: { hipRx: 0.205, hipRz: 0.145, waistRx: 0.2, waistRz: 0.14, chestRx: 0.24, chestRz: 0.17, shRx: 0.255, shRz: 0.15, neckR: 0.09, chestCz: 0.01 },
    arm: { r0: 0.068, r1: 0.063, fr0: 0.06, fr1: 0.05 }, leg: { t0: 0.1, t1: 0.075, s0: 0.065, s1: 0.058 },
    head: { scale: 1.02, rx: 0.082 }, handSize: 1.2, neckR: 0.05,
    skin: [0xb0c4dc, 0xa4bad6, 0xbccee4, 0x98aecc, 0xaabfd8, 0x8ca4c4], hair: [0xb8b8b8, 0x8a8a8e, 0x5a5a60, 0xd8d8dc, 0x3a3a40, 0x706a60],
    skinLayer: LAYER.fleshRU, face: LAYER.faceRus,
    top: [0x7a8272, 0x6a7078, 0x8a8470, 0x5e6878, 0x96968a, 0x7a6a66, 0x6a7480, 0x8c8266], bot: [0x5a5e66, 0x666c60, 0x6e6c62, 0x4e5260, 0x76786e, 0x5c5c68],
    acc: [0xc0beb4, 0xa8a8a2, 0xd0c8b4, 0xb4b8b8, 0x9a9e98, 0xdedcd6], shoe: [0x1c1a18, 0x24201c, 0x14120f, 0x2e2a24],
    bareChest: 0.0, bareArm: 0.0, bareLeg: 0.0, dirt: 0.2, kneeBend: 0.05,
    walk: { v: 1.25, f: 0.85, duty: 0.62, lift: 0.07, drop: 0.02, width: 0.045, toeOut: 0.04, roll: 0.18, lean: 0.03, twist: 0.02, sway: 0.006, roll2: 0.01 },
    run: { v: 3.4, f: 1.3, duty: 0.42, lift: 0.17, drop: 0.045, width: 0.04, toeOut: 0.03, roll: 0.1, toe: 0.8, lean: 0.14, twist: 0.02, sway: 0.006, roll2: 0.01 },
    sprint: { v: 5.2, f: 1.6, duty: 0.34, lift: 0.23, drop: 0.07, width: 0.035, toeOut: 0.03, roll: 0.08, toe: 0.9, lean: 0.22, twist: 0.02, sway: 0.006, roll2: 0.01 },
    lunge: { v: 5.2, f: 1.5, duty: 0.32, lift: 0.24, drop: 0.08, width: 0.035, toeOut: 0.03, roll: 0.08, toe: 0.9, lean: 0.26, twist: 0.02, sway: 0.006, roll2: 0.01 },
    arms: { walk: 'stiff', run: 'stiff', sprint: 'stiff', lunge: 'reach', panic: 'fling' }, reach: 1.42, hunch: 0.0, headLoll: 0.0, twitch: 0.0, look: 0.85,
  },
  germany: {
    layout: { shoulderX: 0.2, hipX: 0.09, armU: 0.315, armF: 0.285 },
    torso: { hipRx: 0.155, hipRz: 0.102, waistRx: 0.14, waistRz: 0.096, chestRx: 0.172, chestRz: 0.112, shRx: 0.195, shRz: 0.105, neckR: 0.062 },
    arm: { r0: 0.042, r1: 0.035, fr0: 0.035, fr1: 0.027 }, leg: { t0: 0.077, t1: 0.052, s0: 0.05, s1: 0.035 },
    head: { scale: 1.0, rx: 0.08 }, handSize: 1.2, neckR: 0.04,
    skin: [0xdfe3ee, 0xd2d8e8, 0xe6e9f4, 0xc4cadc, 0xd9dcec, 0xbcc4d8], hair: [0x1a1a1e, 0x3a3a3e, 0x6a6a70, 0xa8a8ac, 0x2a2420, 0x4a4036],
    skinLayer: LAYER.fleshDE, face: LAYER.faceZomb,
    top: [0x2a2c32, 0x3a3e46, 0x4a4a52, 0x22262c, 0x56586a, 0x30323a, 0x3e4a58, 0x58505a], bot: [0x22252c, 0x32353e, 0x3e4250, 0x1c1e24, 0x4a4e5c, 0x2a2c34],
    acc: [0x2a2a30, 0x4a4a52, 0x5a2e32, 0x22262c, 0x3a4a5e, 0x50505a], shoe: [0x1a1a1c, 0x2a2a2e, 0x14141a, 0x3a3a3e],
    bareChest: 0.0, bareArm: 0.1, bareLeg: 0.05, dirt: 0.3, kneeBend: 0.1,
    walk: { v: 1.4, f: 0.9, duty: 0.6, lift: 0.1, drop: 0.035, width: 0.03, toeOut: 0.06, roll: 0.18, lean: 0.14, twist: 0.1, sway: 0.01, roll2: 0.04 },
    run: { v: 3.8, f: 1.4, duty: 0.4, lift: 0.19, drop: 0.055, width: 0.03, toeOut: 0.05, roll: 0.1, toe: 0.85, lean: 0.26, twist: 0.1, sway: 0.01, roll2: 0.04 },
    sprint: { v: 5.8, f: 1.75, duty: 0.33, lift: 0.26, drop: 0.08, width: 0.025, toeOut: 0.05, roll: 0.08, toe: 0.9, lean: 0.36, twist: 0.1, sway: 0.01, roll2: 0.04 },
    lunge: { v: 6.0, f: 1.7, duty: 0.3, lift: 0.28, drop: 0.09, width: 0.025, toeOut: 0.05, roll: 0.08, toe: 0.9, lean: 0.4, twist: 0.1, sway: 0.01, roll2: 0.04 },
    arms: { walk: 'reach', run: 'reach', sprint: 'fling', lunge: 'reach', panic: 'fling' }, reach: 1.1, hunch: 0.12, headLoll: 0.18, twitch: 1.0,
  },
  cebu: {
    layout: { shoulderX: 0.2, hipX: 0.09 },
    torso: { chestRx: 0.18, chestRz: 0.118, shRx: 0.2 },
    arm: { r0: 0.045, r1: 0.038, fr0: 0.038, fr1: 0.03 }, leg: { t0: 0.082, t1: 0.056, s0: 0.052, s1: 0.038 },
    head: { scale: 1.0 }, handSize: 1.1, neckR: 0.045,
    skin: [0xb8a678, 0xa89868, 0xc2b288, 0x9a8c60, 0xb4ac84, 0x8e8458], hair: [0x14100c, 0x241a12, 0x30241a, 0x1c1814, 0x3a2a1c],
    skinLayer: LAYER.circuit, face: LAYER.faceCebu,
    top: [0xe8e8e0, 0xd84a3a, 0xe8c040, 0x3a9ab0, 0x58a860, 0x2a2a30, 0xe0783a, 0x7a58b0], bot: [0xc8b88a, 0x3e5a8a, 0x4a4e44, 0x2a2e3a, 0x8a8478, 0x6a5a48],
    acc: [0xd84a3a, 0x3a9ab0, 0xe8c040, 0x2a2a30, 0x58a860, 0xe8e8e0], shoe: [0x2a2a2a, 0xd8d0c0, 0x4a3a2a, 0x2a4a7a],
    bareChest: 0.0, bareArm: 0.8, bareLeg: 0.6, dirt: 0.22, kneeBend: 0.08, emit: true,
    walk: { v: 1.6, f: 1.0, duty: 0.58, lift: 0.1, drop: 0.035, width: 0.03, toeOut: 0.05, roll: 0.18, lean: 0.1, twist: 0.03, sway: 0.008, roll2: 0.02 },
    run: { v: 4.2, f: 1.55, duty: 0.4, lift: 0.2, drop: 0.055, width: 0.03, toeOut: 0.04, roll: 0.1, toe: 0.85, lean: 0.22, twist: 0.03, sway: 0.008, roll2: 0.02 },
    sprint: { v: 6.2, f: 1.9, duty: 0.33, lift: 0.26, drop: 0.08, width: 0.025, toeOut: 0.04, roll: 0.08, toe: 0.9, lean: 0.32, twist: 0.03, sway: 0.008, roll2: 0.02 },
    lunge: { v: 6.4, f: 1.8, duty: 0.3, lift: 0.28, drop: 0.09, width: 0.025, toeOut: 0.04, roll: 0.08, toe: 0.9, lean: 0.36, twist: 0.03, sway: 0.008, roll2: 0.02 },
    arms: { walk: 'reach', run: 'reach', sprint: 'fling', lunge: 'reach', panic: 'fling' }, reach: 1.2, hunch: 0.1, headLoll: 0.12, twitch: 0.7,
  },
};

export function buildZombie(strain) {
  const Z = STRAINS[strain];
  const L = makeLayout(Z.layout);
  const M = new FigureMesh();
  const sk = (layer = Z.skinLayer) => mat(SLOT.SKIN, layer);
  const cloth = (slot, layer = strain === 'russia' ? LAYER.frost : LAYER.gore) => mat(slot, layer);
  const pantsLayer = strain === 'russia' ? LAYER.frost : LAYER.gore;
  const topSlot = Z.bareChest > 0 ? SLOT.CHEST : SLOT.TOP;
  const m = {
    torso: cloth(topSlot), pelvis: cloth(SLOT.BOT, pantsLayer), upperArm: cloth(Z.bareArm > 0.6 ? SLOT.SLEEVE : SLOT.TOP), foreArm: cloth(SLOT.SLEEVE), hand: sk(),
    thigh: cloth(SLOT.BOT, pantsLayer), shin: cloth(SLOT.LEGLOW, pantsLayer), foot: strain === 'russia' ? mat(SLOT.SHOE, LAYER.leather) : mat(SLOT.LEGLOW, LAYER.leather),
    head: mat(SLOT.FACE, Z.face), neck: sk(),
  };
  bodyParts(M, L, { R: Z.giant ? 8 : 6, TR: 8, shoulderX: L.shoulderX, hipX: L.hipX, torso: Z.torso, arm: Z.arm, leg: Z.leg, head: Z.head, handSize: Z.handSize, footW: Z.footW, footL: Z.footL, neckR: Z.neckR }, m);
  const slotHair = { slot: SLOT.HAIR, layer: LAYER.hair };
  const hs = Z.head.scale;
  // ---- head variants (group 1): 0 bald 1 messy hair 2 long hair 3 hat/hood (strain specific)
  M.add(hairCap(L, { s: hs, thick: 0.016 }), { j: J.HEAD, gate: gate(1, 1, 2), ...slotHair, name: 'hair' });
  M.add(hairLong(L, { s: hs, len: 0.22 }), { j: J.HEAD, gate: gate(1, 2), ...slotHair, name: 'longhair' });
  if (strain === 'russia') {
    M.add(capHat(L, { s: hs, brim: 0.112, crown: 0.098, y: 0.03, visor: 0.0 }), { j: J.HEAD, gate: gate(1, 3), ...mat(SLOT.ACC, LAYER.fur), name: 'ushanka' });
    for (const sg of [-1, 1]) M.add(xf(box(0.04, 0.1, 0.1, { taperBottom: [0.8, 0.9] }), { pos: [sg * 0.095, L.headY - 0.04, -0.01] }), { j: J.HEAD, gate: gate(1, 3), ...mat(SLOT.ACC, LAYER.fur), name: 'flap' });
  } else if (strain === 'germany') {
    M.add(xf(loft([{ y: -0.07, rx: 0.11, rz: 0.125 }, { y: 0.05, rx: 0.1, rz: 0.115 }, { y: 0.135, rx: 0.052, rz: 0.06 }, { y: 0.15, rx: 0, rz: 0 }], { R: 8, k: 2.3 }), { pos: [0, L.headY, -0.012] }), { j: J.HEAD, gate: gate(1, 3), ...mat(SLOT.TOP2, LAYER.weave), name: 'hood' });
  } else {
    M.add(capHat(L, { s: hs, brim: 0.125, crown: 0.095, y: 0.05, visor: 0.045 }), { j: J.HEAD, gate: gate(1, 3), ...mat(SLOT.ACC, LAYER.weave), name: 'cap' });
  }
  // ---- extras (group 2): 0 none 1 scarf/plate 2 backpack 3 -
  if (strain === 'russia') {
    M.add(loft([{ y: L.neckY - 0.045, rx: 0.1, rz: 0.1 }, { y: L.neckY + 0.02, rx: 0.075, rz: 0.075 }], { R: 6, k: 2 }), { j: J.HEAD, gate: gate(2, 1, 3), ...mat(SLOT.TOP2, LAYER.knit), name: 'scarf' });
    for (const sg of [1, -1]) M.add(xf(loft([{ y: L.kneeY - 0.1, rx: 0.14, rz: 0.17 }, { y: L.kneeY + 0.2, rx: 0.13, rz: 0.15 }, { y: L.hipY + 0.035, rx: 0.115, rz: 0.14 }], { R: 8, k: 2.2 }), { pos: [sg * 0.09, 0, 0] }), { j: sg > 0 ? J.SKIRT_L : J.SKIRT_R, gate: gate(3, 1), ...cloth(SLOT.TOP, LAYER.frost), name: 'coat' });
    M.add(xf(box(0.3, 0.38, 0.16, { taperBottom: [0.9, 0.9] }), { pos: [0, L.chestY - 0.02, -0.22] }), { j: J.SPINE, gate: gate(2, 2), ...mat(SLOT.ACC, LAYER.weave), name: 'pack' });
  } else if (strain === 'germany') {
    for (const sg of [1, -1]) M.add(xf(loft([{ y: L.kneeY + 0.05, rx: 0.12, rz: 0.15 }, { y: L.hipY + 0.035, rx: 0.1, rz: 0.12 }], { R: 6, k: 2.2 }), { pos: [sg * 0.082, 0, 0] }), { j: sg > 0 ? J.SKIRT_L : J.SKIRT_R, gate: gate(3, 1), ...cloth(SLOT.TOP, LAYER.weave), shade: 0.8, name: 'coattail' });
  }
  if (strain === 'giant') {
    M.add(xf(box(0.34, 0.1, 0.3, { taperBottom: [0.8, 0.8] }), { pos: [-0.38, L.shoulderY + 0.02, 0] }), { j: J.ARM_R, gate: gate(2, 1, 3), ...mat(SLOT.FIXED, LAYER.metal, 0x4a4036), name: 'plate' });
    M.add(xf(box(0.45, 0.4, 0.04), { pos: [0, L.hipY - 0.05, 0.22] }), { j: J.ROOT_ROT, gate: gate(2, 2, 3), ...mat(SLOT.TOP2, LAYER.leather, 0xffffff, 0.7), name: 'loin' });
  }
  if (strain === 'india') { // cough puff
    M.add(xf(ellipsoid(0.1, 0.09, 0.1, 6, 3), { pos: [0, L.headY - 0.06, 0.2] }), { j: J.HEAD, gate: GATE.PUFF, slot: SLOT.FIXED, layer: LAYER.fur, color: [0.72, 0.8, 0.38], name: 'puff' });
  }
  bakeBodyAO(M, L);

  // ---------------- animation style
  const A = Z.arms;
  const tw = Z.twitch || 0, hunch = Z.hunch || 0, loll = Z.headLoll || 0; const cold = strain === 'russia';
  const gaitPost = (name) => (P, c, { gg }) => {
    const mode = A[name];
    const lean = (gg.lean ?? 0.1) + hunch * 0.5;
    const t1 = tw * twitchSeries(c, TW1), t2 = tw * twitchSeries(c, TW2), t3 = tw * twitchSeries(c, TW3);
    P.e(J.SPINE, lean + 0.03 * S(c, 2) + 0.05 * t1, (gg.twist ?? 0.1) * C(c, 1) * 1.2, -(gg.roll2 ?? 0.04) * 1.5 * S(c, 1) + 0.04 * t2);
    ARMS[mode](P, c, { reach: Z.reach, A: name === 'sprint' || name === 'lunge' ? (Z.sprintFling ?? 1.0) : name === 'run' ? 0.85 : 0.6, flex: 0 });
    P.e(J.HEAD, loll * 0.5 + 0.15 * t1 - lean * 0.45, loll * 0.4 * S(c, 1, 0.3) + 0.35 * t2, loll * (0.8 + 0.5 * S(c, 1, 0.1)) * (name === 'walk' ? 1 : 0.6) + 0.3 * t3);
    const ra = cold ? 0.02 : 0.25;
    P.r(J.HEAD, cold ? 0.06 : 0.45); P.r(J.SPINE, cold ? 0.02 : 0.12); P.r(J.ARM_L, ra); P.r(J.ARM_R, ra); P.r(J.FORE_L, ra); P.r(J.FORE_R, ra);
    if (tw > 0.3) { P.eAdd(J.FORE_L, 0.35 * t2, 0, 0.2 * t1); P.eAdd(J.FORE_R, 0.35 * t1, 0, -0.2 * t3); P.eAdd(J.ARM_L, 0.25 * t3, 0, 0); }
    if (name === 'lunge') { P.e(J.HEAD, -0.3 + 0.2 * S(c, 2), 0, 0); arm(P, 1, 1.5 + 0.35 * S(c, 1), 0.2, 0.15 + 0.2 * (0.5 + 0.5 * S(c, 1))); arm(P, -1, 1.5 + 0.35 * S(c, 1, 0.5), 0.2, 0.15 + 0.2 * (0.5 + 0.5 * S(c, 1, 0.5))); }
  };
  const idlePost = (P, c) => {
    const t1 = tw * twitchSeries(c, TW1, 0.012), t2 = tw * twitchSeries(c, TW2, 0.012), t3 = tw * twitchSeries(c, TW3, 0.012);
    stanceLegs(P, L, { pelvisY: L.hipY - 0.05 - Z.kneeBend * 0.2 + 0.006 * S(c, 2), rootX: 0.02 * S(c, 1), lz: 0.05, rz: -0.06, width: 0.06, lyaw: 0.2, ryaw: 0.2 });
    P.e(J.ROOT_ROT, 0.06 + hunch * 0.2, 0.04 * S(c, 1, 0.1), 0.03 * S(c, 1));
    P.e(J.SPINE, 0.12 + hunch * 0.7 + 0.025 * S(c, 2) + 0.05 * t1, 0.1 * S(c, 1, 0.25), 0.05 * S(c, 1) + 0.05 * t2);
    P.e(J.HEAD, loll * 0.9 + 0.06 * S(c, 2, 0.3) + 0.2 * t1, 0.35 * S(c, 1, 0.1) + 0.3 * t2, loll * 0.7 + 0.04 * S(c, 1, 0.3) + 0.2 * t3);
    if (cold) { arm(P, 1, 0.08, 0.1, 0.15); arm(P, -1, 0.08, 0.1, 0.15); P.e(J.SPINE, 0.03, 0, 0); P.e(J.HEAD, 0.0, 0, 0); P.e(J.ROOT_ROT, 0, 0, 0); }
    else armsHang(P, c, { A: 0.1, base: 0.35, abd: 0.14 });
    P.r(J.HEAD, cold ? 0.05 : 0.45); P.r(J.SPINE, 0.1); P.r(J.ARM_L, cold ? 0.02 : 0.3); P.r(J.ARM_R, cold ? 0.02 : 0.3); P.r(J.FORE_L, 0.2); P.r(J.FORE_R, 0.2);
    if (tw > 0.3) { P.eAdd(J.FORE_L, 0.4 * t2, 0, 0); P.eAdd(J.FORE_R, 0.4 * t3, 0, 0); }
  };
  const K = {
    skirt: (strain === 'russia' || strain === 'germany') ? 0.55 : 0,
    crawlSpeed: 0.5, fireRate: 1.5,
    gait: { walk: Z.walk, run: Z.run, sprint: Z.sprint, lunge: Z.lunge, panic: { ...Z.sprint, v: Z.run.v, f: Z.run.f } },
    arms: { walk: 'none', run: 'none', sprint: 'none', lunge: 'none', panic: 'none' },
    post: {
      walk: gaitPost('walk'), run: gaitPost('run'), sprint: gaitPost('sprint'), lunge: gaitPost('lunge'), panic: gaitPost('run'),
      idle: idlePost,
      crouch: (P, c) => { // feeding: hunched over, head bobbing, hands scooping
        const b = S(c, 3);
        P.e(J.SPINE, 0.85 + 0.1 * b, 0.1 * S(c, 1), 0.0); P.e(J.HEAD, 0.35 + 0.35 * Math.max(0, b), 0.3 * S(c, 2), 0.1 * S(c, 3, 0.2));
        arm(P, 1, 0.9 + 0.45 * S(c, 3, 0.25), 0.25, 1.3 + 0.3 * S(c, 3)); arm(P, -1, 0.9 + 0.45 * S(c, 3, 0.75), 0.25, 1.3 + 0.3 * S(c, 3, 0.5));
        P.r(J.HEAD, 0.2); P.r(J.ARM_L, 0.2); P.r(J.ARM_R, 0.2);
      },
      cower: (P, c) => { // convulsing / writhing
        const t1 = twitchSeries(c, TW1, 0.03), t2 = twitchSeries(c, TW2, 0.03);
        P.eAdd(J.SPINE, 0.12 * t1, 0.2 * t2, 0.1 * t1); P.e(J.HEAD, 0.6 + 0.3 * t2, 0.5 * t1, 0.3 * t2);
        arm(P, 1, 1.0 + 0.5 * t1, 0.5, 1.4 + 0.4 * t2); arm(P, -1, 1.0 + 0.5 * t2, 0.5, 1.4 + 0.4 * t1); P.r(J.ARM_L, 0.3); P.r(J.ARM_R, 0.3);
      },
      cheer: (P, c) => { // roar
        const r = 0.5 + 0.5 * S(c, 1, -0.1);
        P.e(J.SPINE, -0.25 - 0.1 * r, 0.04 * S(c, 3), 0); P.e(J.HEAD, -0.75 - 0.3 * r, 0.1 * S(c, 3), 0.05 * S(c, 5));
        arm(P, 1, 2.4 + 0.5 * r, 0.7, 0.7 + 0.2 * S(c, 2)); arm(P, -1, 2.4 + 0.5 * r, 0.7, 0.7 + 0.2 * S(c, 2, 0.3));
        if (cold) { arm(P, 1, 1.6, 0.1, 0.05); arm(P, -1, 1.6, 0.1, 0.05); P.e(J.HEAD, -0.5, 0, 0); P.e(J.SPINE, -0.1, 0, 0); }
        P.r(J.ARM_L, 0.15); P.r(J.ARM_R, 0.15);
      },
      cough: (P, c, { p }) => { P.eAdd(J.HEAD, 0.2 * p, 0, 0); P.eAdd(J.SPINE, 0.1 * p, 0, 0); },
    },
    aimArms: (P, c, fire) => { // reach/grab (aim) and clawing swipes / bites (fire)
      if (!fire) { armsReach(P, c, { reach: 1.5, flex: 0.2, abd: 0.14 }); P.e(J.HEAD, 0.1 + 0.05 * S(c, 2), 0.1 * S(c, 1), 0); }
      else {
        const sw = 0.5 + 0.5 * S(c, 3);
        arm(P, 1, 1.35 + 0.55 * sw, 0.12 + 0.2 * (1 - sw), 0.2 + 0.7 * (1 - sw)); arm(P, -1, 1.35 + 0.55 * (1 - sw), 0.12 + 0.2 * sw, 0.2 + 0.7 * sw);
        P.e(J.HEAD, 0.25 * sw - 0.1, 0.2 * S(c, 3, 0.25), 0); P.e(J.SPINE, 0.28 * sw + 0.14, -0.1, 0);
      }
    },
  };
  const def = {
    M, L, K,
    palette: { skin: Z.skin, hair: Z.hair, top: Z.top, bot: Z.bot, acc: Z.acc, shoe: Z.shoe },
    ovrSlot: SLOT.TOP, dirt: Z.dirt, bareArm: Z.bareArm, bareLeg: Z.bareLeg, bareChest: Z.bareChest, skinLayer: Z.skinLayer,
    mix: { kid: strain === 'giant' ? 0 : 0.06, elder: strain === 'giant' ? 0 : 0.12, female: strain === 'giant' ? 0 : 0.4 }, scale: strain === 'giant' ? [0.96, 1.06] : [0.94, 1.08],
    heightScale: strain === 'giant' ? 1.45 : 1.05, lookWeight: Z.look || 0,
    groups: { head: 1, extra: 2, coat: 3 },
    variant: (r) => ({ head: r.pick(strain === 'russia' ? [0, 3, 3, 3, 3, 3] : [0, 0, 1, 1, 2, 3]), extra: r.pick(strain === 'russia' ? [0, 1, 1, 2] : [0, 0, 1, 2, 0]), coat: r.chance(0.5) ? 1 : 0 }),
  };
  if (Z.emit) { def.emitMask = 3.2; def.emitColor = 0x30ff30; def.emitSlot = 1; }
  return def;
}
