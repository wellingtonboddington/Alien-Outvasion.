// Human crowd kinds: soldier, civilian, scientist, robot.
import { J, SLOT, LAYER, gate, ST } from './rig.js';
import { FigureMesh, loft, box, cyl, ellipsoid, xf, warp } from './build.js';
import { makeLayout } from './layout.js';
import { bodyParts, bakeBodyAO, hairCap, hairLong, faceUV } from './figure.js';
import { addWeapons, addPacks, helmet, capHat } from './gear.js';
import { arm, armIK, stanceLegs, S, C } from './clips.js';

const mat = (slot, layer, color = 0xffffff, shade = 1) => ({ slot, layer, color, shade });
const SKINS = [0xf4d3b5, 0xe8bd96, 0xd3a07a, 0xb27a52, 0x8a5636, 0x5a3a26];
const SKINS_PH = [0xe6c0a0, 0xd0a07c, 0xbf8c64, 0xa8744e, 0x8c5a3a, 0xf0d2b8];
const HAIRS_PH = [0x14100c, 0x1c140e, 0x241a12, 0x14100c, 0x34281c, 0x6a5a4a];
const HAIRS = [0x15110c, 0x2a1d12, 0x45301b, 0x6b4a2a, 0x9a7a4a, 0xb4aca4];

// =====================================================================================================================================
export function buildSoldier() {
  const L = makeLayout({});
  const M = new FigureMesh();
  const camoT = mat(SLOT.TOP, LAYER.camo), camoB = mat(SLOT.BOT, LAYER.camo);
  bodyParts(M, L, { R: 6, TR: 8, shoulderX: L.shoulderX, hipX: L.hipX, arm: { r0: 0.05, r1: 0.042, fr0: 0.042, fr1: 0.033 }, leg: { t0: 0.09, t1: 0.064, s0: 0.058, s1: 0.042, mid: 0.08, calf: 0.12 } }, {
    torso: camoT, pelvis: camoB, upperArm: camoT, foreArm: camoT, hand: mat(SLOT.FIXED, LAYER.leather, 0x1f1d1a), thigh: camoB, shin: camoB,
    foot: mat(SLOT.SHOE, LAYER.leather), head: mat(SLOT.FACE, LAYER.faceHuman), neck: mat(SLOT.SKIN, LAYER.skin),
  });
  // plate carrier + pouches
  const vest = loft([
    { y: L.waistY + 0.02, rx: 0.168, rz: 0.116 },
    { y: L.chestY - 0.01, rx: 0.205, rz: 0.139, cz: 0.012 },
    { y: L.shoulderY - 0.05, rx: 0.206, rz: 0.128 },
  ], { R: 8, k: 2.7, tile: 0.35 });
  M.add(vest, { j: J.SPINE, ...mat(SLOT.ACC, LAYER.molle), name: 'vest' });
  for (const x of [-0.085, 0, 0.085]) M.add(xf(box(0.07, 0.1, 0.045, { tile: 0.2 }), { pos: [x, L.chestY - 0.11, 0.158] }), { j: J.SPINE, ...mat(SLOT.ACC, LAYER.molle, 0xffffff, 0.85), name: 'pouch' });
  // headgear: 0 helmet, 1 cap, 2 bare + hair, 3 helmet (second colour)
  const hm = (c) => ({ slot: SLOT.TOP, layer: LAYER.camo, color: c });
  M.add(helmet(L), { j: J.HEAD, gate: gate(1, 0, 3), ...hm(0xd8d8d0), name: 'helmet' });
  M.add(xf(box(0.034, 0.045, 0.05), { pos: [0, L.headY + 0.1, 0.1] }), { j: J.HEAD, gate: gate(1, 0, 3), ...mat(SLOT.FIXED, LAYER.metal, 0x222428), name: 'nvg' });
  M.add(capHat(L, { brim: 0.138, crown: 0.095, y: 0.045, visor: 0.03 }), { j: J.HEAD, gate: gate(1, 1), ...hm(0xe4e4dc), name: 'cap' });
  M.add(hairCap(L, { s: 1 }), { j: J.HEAD, gate: gate(1, 2), slot: SLOT.HAIR, layer: LAYER.hair, name: 'hair' });
  addWeapons(M, 2);
  addPacks(M, L, 3, mat(SLOT.ACC, LAYER.weave, 0xe0e0e0));
  bakeBodyAO(M, L);
  const K = {
    weapon: { yaw: 0 }, idleWeaponPitch: 0.72, fireRate: 1.2,
    gait: {
      walk: { v: 1.35, f: 0.92, duty: 0.62, lift: 0.065, drop: 0.022, width: 0.03, toeOut: 0.1, roll: 0.18, lean: 0.07, twist: 0.05, weaponPitch: 0.62 },
      run: { v: 3.5, f: 1.35, duty: 0.42, lift: 0.17, drop: 0.05, width: 0.025, toeOut: 0.08, roll: 0.1, toe: 0.8, lean: 0.17, twist: 0.05, weaponPitch: 0.8 },
      sprint: { v: 5.3, f: 1.65, duty: 0.33, lift: 0.24, drop: 0.075, width: 0.02, toeOut: 0.06, roll: 0.08, toe: 0.9, lean: 0.27, twist: 0.04, weaponPitch: 0.95 },
    },
  };
  return {
    M, L, K, nominalExtra: {},
    palette: {
      skin: SKINS, hair: HAIRS,
      top: [0xffffff, 0xf2ead4, 0xdde4cc, 0xe8dec4, 0xc9d2b8, 0xf6f0e2, 0xbdc8ac, 0xe2d4b6], bot: [0xffffff, 0xeee6d0, 0xd6dcc4, 0xe4d8be, 0xc6cfb4, 0xf2ecde],
      acc: [0x6e6e58, 0x9a8a62, 0x3a3a3a, 0x7a7a60, 0x8c8266, 0x57604a], shoe: [0x2a241c, 0x3c3024, 0x1c1814, 0x4a3a28],
    },
    ovrSlot: SLOT.ACC, dirt: 0.35, mix: { kid: 0, elder: 0, female: 0.08 }, scale: [0.96, 1.07],
    groups: { head: 1, weapon: 2, pack: 3 },
    variant: (r) => { const w = r.next(); const weapon = w < 0.62 ? 0 : w < 0.74 ? 1 : w < 0.84 ? 2 : 3; const h = r.next(); const head = h < 0.72 ? 0 : h < 0.82 ? 1 : h < 0.92 ? 2 : 3; const pk = r.next(); const pack = pk < 0.35 ? 0 : pk < 0.7 ? 1 : pk < 0.82 ? 2 : 3; return { head, weapon, pack }; },
  };
}

// =====================================================================================================================================
export function buildCivilian() {
  const L = makeLayout({});
  const M = new FigureMesh();
  bodyParts(M, L, { R: 6, TR: 8, shoulderX: L.shoulderX, hipX: L.hipX, arm: { r0: 0.044, r1: 0.037, fr0: 0.037, fr1: 0.03 }, leg: { t0: 0.082, t1: 0.056, s0: 0.052, s1: 0.038 }, torso: { chestRx: 0.18, chestRz: 0.118, shRx: 0.195, waistRx: 0.148 } }, {
    torso: mat(SLOT.TOP, LAYER.weave), pelvis: mat(SLOT.BOT, LAYER.denim), upperArm: mat(SLOT.TOP, LAYER.weave), foreArm: mat(SLOT.SLEEVE, LAYER.weave), hand: mat(SLOT.SKIN, LAYER.skin),
    thigh: mat(SLOT.BOT, LAYER.denim), shin: mat(SLOT.LEGLOW, LAYER.denim), foot: mat(SLOT.SHOE, LAYER.leather), head: mat(SLOT.FACE, LAYER.faceHuman), neck: mat(SLOT.SKIN, LAYER.skin),
  });
  // headwear 0 none 1 cap 2 wide hat 3 beanie
  M.add(capHat(L, { brim: 0.126, crown: 0.094, y: 0.05, visor: 0.045 }), { j: J.HEAD, gate: gate(1, 1), ...mat(SLOT.ACC, LAYER.weave), name: 'cap' });
  M.add(capHat(L, { brim: 0.2, crown: 0.09, y: 0.052, visor: 0 }), { j: J.HEAD, gate: gate(1, 2), ...mat(SLOT.ACC, LAYER.weave, 0xe8e0c8), name: 'hat' });
  M.add(capHat(L, { brim: 0.1, crown: 0.093, y: 0.01 }), { j: J.HEAD, gate: gate(1, 3), ...mat(SLOT.TOP2, LAYER.knit), name: 'beanie' });
  // bags 0 none 1 backpack 2 shoulder bag 3 hand bag
  M.add(xf(box(0.27, 0.34, 0.14, { taperBottom: [0.92, 0.9] }), { pos: [0, L.chestY - 0.03, -0.2] }), { j: J.SPINE, gate: gate(2, 1), ...mat(SLOT.ACC, LAYER.weave), name: 'backpack' });
  M.add(xf(box(0.06, 0.24, 0.3), { pos: [0.18, L.hipY + 0.02, -0.01], rot: [0, 0, 0.1] }), { j: J.SPINE, gate: gate(2, 2), ...mat(SLOT.ACC, LAYER.leather), name: 'shoulderbag' });
  M.add(xf(box(0.05, 0.2, 0.28), { pos: [-L.shoulderX, L.shoulderY - L.armU - L.armF - 0.19, 0.02] }), { j: J.FORE_R, gate: gate(2, 3), ...mat(SLOT.ACC, LAYER.leather), name: 'handbag' });
  // outer: 0 none 1 jacket hem 2 hood 3 long coat (rigid)
  M.add(loft([{ y: L.hipY - 0.1, rx: 0.186, rz: 0.126 }, { y: L.hipY + 0.06, rx: 0.172, rz: 0.118 }], { R: 8, k: 2.6 }), { j: J.SPINE, gate: gate(3, 1), ...mat(SLOT.TOP2, LAYER.weave), name: 'jackethem' });
  M.add(xf(loft([{ y: 0, rx: 0.075, rz: 0.06 }, { y: 0.1, rx: 0.095, rz: 0.1, cz: -0.03 }], { R: 6, k: 2 }), { pos: [0, L.neckY - 0.02, -0.04], rot: [0.4, 0, 0] }), { j: J.HEAD, gate: gate(3, 2), ...mat(SLOT.TOP2, LAYER.weave), name: 'hood' });
  M.add(loft([{ y: L.kneeY + 0.05, rx: 0.2, rz: 0.15 }, { y: L.hipY - 0.04, rx: 0.19, rz: 0.13 }, { y: L.hipY + 0.06, rx: 0.172, rz: 0.118 }], { R: 8, k: 2.4 }), { j: J.ROOT_ROT, gate: gate(3, 3), ...mat(SLOT.TOP2, LAYER.weave), name: 'longcoat' });
  // hair: 0 short 1 long 2 buzz 3 bun
  M.add(hairCap(L, { s: 1, thick: 0.014 }), { j: J.HEAD, gate: gate(4, 0, 1, 3), slot: SLOT.HAIR, layer: LAYER.hair, name: 'hair' });
  M.add(hairCap(L, { s: 1, thick: 0.004, front: 0.07 }), { j: J.HEAD, gate: gate(4, 2), slot: SLOT.HAIR, layer: LAYER.hair, name: 'buzz' });
  M.add(hairLong(L, { len: 0.26 }), { j: J.HEAD, gate: gate(4, 1), slot: SLOT.HAIR, layer: LAYER.hair, name: 'longhair' });
  M.add(xf(ellipsoid(0.04, 0.04, 0.04, 6, 3), { pos: [0, L.headY + 0.04, -0.115] }), { j: J.HEAD, gate: gate(4, 3), slot: SLOT.HAIR, layer: LAYER.hair, name: 'bun' });
  bakeBodyAO(M, L);
  const K = {
    gait: {
      walk: { v: 1.3, f: 0.92, duty: 0.62, lift: 0.065, drop: 0.022, width: 0.03, toeOut: 0.12, roll: 0.18, lean: 0.04, twist: 0.1, arm: { A: 0.42, e0: 0.2, e1: 0.3 } },
      run: { v: 3.2, f: 1.3, duty: 0.4, lift: 0.17, drop: 0.05, width: 0.025, toeOut: 0.08, roll: 0.1, toe: 0.8, lean: 0.14, twist: 0.09, arm: { A: 0.85, e0: 1.2, e1: 0.4 } },
      sprint: { v: 5.0, f: 1.6, duty: 0.33, lift: 0.23, drop: 0.07, width: 0.02, toeOut: 0.06, roll: 0.08, toe: 0.9, lean: 0.24, twist: 0.08, arm: { A: 1.05, e0: 1.3, e1: 0.35 } },
      panic: { v: 4.0, f: 1.45, duty: 0.37, lift: 0.2, drop: 0.06, width: 0.025, toeOut: 0.1, roll: 0.1, toe: 0.85, lean: 0.12, twist: 0.2 },
    },
    post: {
      panic: (P, c) => { // flailing arms overhead, head whipping
        arm(P, 1, 1.9 + 0.7 * S(c, 2, 0.1) + 0.3 * S(c, 3), 0.55 + 0.25 * S(c, 1), 0.9 + 0.5 * S(c, 3, 0.2));
        arm(P, -1, 1.7 + 0.7 * S(c, 2, 0.6) + 0.3 * S(c, 3, 0.4), 0.55 + 0.25 * S(c, 1, 0.5), 0.9 + 0.5 * S(c, 3, 0.7));
        P.e(J.HEAD, -0.15 + 0.15 * S(c, 2), 0.5 * S(c, 1, 0.1), 0.15 * S(c, 3));
      },
    },
    aimArms: (P, c, fire, { L }) => { // point (aim) / filming with phone (fire)
      if (!fire) { arm(P, -1, 1.55 + 0.03 * S(c, 1), 0.08, 0.1); arm(P, 1, 0.1, 0.15, 0.25); }
      else { armIK(P, L, -1, [-0.045, L.neckY + 0.07, 0.3], [-0.5, -0.5, -0.8]); armIK(P, L, 1, [0.045, L.neckY + 0.07, 0.3], [0.5, -0.5, -0.8]); P.e(J.HEAD, -0.05, 0, 0); }
    },
    post2: null,
  };
  return {
    M, L, K,
    palette: {
      skin: SKINS_PH, hair: HAIRS_PH,
      top: [0xdad6cc, 0x8c7e6c, 0x4e5e72, 0x667658, 0xb4584a, 0x3f6a9a, 0x2e3036, 0xe0b440], bot: [0x3e5380, 0x2e323e, 0x6e5e4a, 0x4e5e4e, 0x8e887c, 0x22222a],
      acc: [0xb04a3a, 0x2e5a90, 0x2e2e2e, 0xb89a56, 0x3e704e, 0xd8d8d0], shoe: [0x1e1e1e, 0xd8d8d8, 0x3e2e22, 0x602424],
    },
    ovrSlot: SLOT.TOP, dirt: 0.25, bareArm: 0.55, bareLeg: 0.22, mix: { kid: 0.1, elder: 0.12, female: 0.5 }, scale: [0.93, 1.07],
    groups: { head: 1, bag: 2, outer: 3, hair: 4 },
    variant: (r, age, sex) => ({ head: r.chance(0.42) ? r.pick([1, 2, 3]) : 0, bag: r.chance(0.5) ? r.pick([1, 1, 2, 3]) : 0, outer: r.chance(0.32) ? (sex ? r.pick([1, 2, 3, 3, 3]) : r.pick([1, 1, 2, 2, 3])) : 0, hair: sex ? r.pick([1, 1, 3, 0]) : r.pick([0, 0, 2, 2, 0]) }),
  };
}

// =====================================================================================================================================
export function buildScientist() {
  const L = makeLayout({});
  const M = new FigureMesh();
  const coat = mat(SLOT.TOP, LAYER.weave), trs = mat(SLOT.BOT, LAYER.weave);
  bodyParts(M, L, { R: 6, TR: 8, shoulderX: L.shoulderX, hipX: L.hipX, arm: { r0: 0.044, r1: 0.039, fr0: 0.039, fr1: 0.031 }, leg: { t0: 0.082, t1: 0.056, s0: 0.052, s1: 0.038 }, torso: { chestRx: 0.18, chestRz: 0.12, shRx: 0.195 } }, {
    torso: coat, pelvis: coat, upperArm: coat, foreArm: coat, hand: mat(SLOT.SKIN, LAYER.skin), thigh: trs, shin: trs,
    foot: mat(SLOT.SHOE, LAYER.leather), head: mat(SLOT.FACE, LAYER.faceHuman), neck: mat(SLOT.SKIN, LAYER.skin),
  });
  // lab-coat skirt halves follow the thighs at half amplitude (SKIRT joints)
  for (const sgn of [1, -1]) M.add(xf(loft([{ y: L.kneeY - 0.06, rx: 0.125, rz: 0.15, cz: 0.0 }, { y: L.kneeY + 0.2, rx: 0.115, rz: 0.135 }, { y: L.hipY + 0.035, rx: 0.1, rz: 0.12 }], { R: 8, k: 2.2 }), { pos: [sgn * 0.078, 0, 0] }), { j: sgn > 0 ? J.SKIRT_L : J.SKIRT_R, ...coat, name: 'coat' });
  // collar + pocket (always)
  M.add(xf(box(0.07, 0.06, 0.012), { pos: [0.1, L.chestY - 0.17, 0.134], rot: [0, 0, 0.05] }), { j: J.SPINE, ...coat, shade: 0.93, name: 'pocket' });
  // head: 0 hair 1 goggles 2 hood+mask 3 grey hair
  M.add(hairCap(L, { s: 1, thick: 0.013 }), { j: J.HEAD, gate: gate(1, 0, 1, 3), slot: SLOT.HAIR, layer: LAYER.hair, name: 'hair' });
  M.add(xf(box(0.168, 0.034, 0.05, { taperTop: [0.96, 0.9] }), { pos: [0, L.headY + 0.012, 0.075] }), { j: J.HEAD, gate: gate(1, 1), ...mat(SLOT.FIXED, LAYER.leather, 0x1a2a34), name: 'goggles' });
  M.add(xf(box(0.12, 0.05, 0.03), { pos: [0, L.headY - 0.04, 0.095] }), { j: J.HEAD, gate: gate(1, 2), ...mat(SLOT.FIXED, LAYER.leather, 0x505a60), name: 'mask' });
  M.add(xf(loft([{ y: -0.06, rx: 0.108, rz: 0.12 }, { y: 0.06, rx: 0.1, rz: 0.115 }, { y: 0.145, rx: 0.052, rz: 0.06 }, { y: 0.158, rx: 0, rz: 0 }], { R: 8, k: 2.3 }), { pos: [0, L.headY, -0.01] }), { j: J.HEAD, gate: gate(1, 2), ...mat(SLOT.TOP2, LAYER.weave, 0xe8f0e8), name: 'hood' });
  M.add(xf(box(0.168, 0.034, 0.05), { pos: [0, L.headY + 0.012, 0.075] }), { j: J.HEAD, gate: gate(1, 2), ...mat(SLOT.FIXED, LAYER.leather, 0x1a2a34), name: 'visor' });
  // carried item on left hand: 0 none 1 clipboard 2 tablet 3 sample case
  const fy = L.shoulderY - L.armU - L.armF - 0.07;
  M.add(xf(box(0.24, 0.31, 0.014), { pos: [L.shoulderX + 0.0, fy - 0.06, 0.06], rot: [0.0, 0, 0] }), { j: J.FORE_L, gate: gate(2, 1), ...mat(SLOT.ACC, LAYER.leather), name: 'clipboard' });
  M.add(xf(box(0.17, 0.23, 0.012), { pos: [L.shoulderX, fy - 0.03, 0.05] }), { j: J.FORE_L, gate: gate(2, 2), ...mat(SLOT.FIXED, LAYER.metal, 0x22272c), name: 'tablet' });
  M.add(xf(box(0.34, 0.22, 0.14), { pos: [L.shoulderX + 0.0, fy - 0.17, 0.03] }), { j: J.FORE_L, gate: gate(2, 3), ...mat(SLOT.ACC, LAYER.metal), name: 'case' });
  // hair back: 0 short 1 long 2 bun (group 3) 
  M.add(hairLong(L, { len: 0.24 }), { j: J.HEAD, gate: gate(3, 1), slot: SLOT.HAIR, layer: LAYER.hair, name: 'longhair' });
  M.add(xf(ellipsoid(0.04, 0.04, 0.04, 6, 3), { pos: [0, L.headY + 0.04, -0.115] }), { j: J.HEAD, gate: gate(3, 2), slot: SLOT.HAIR, layer: LAYER.hair, name: 'bun' });
  bakeBodyAO(M, L);
  const K = {
    skirt: 0.55,
    gait: {
      walk: { v: 1.3, f: 0.92, duty: 0.62, lift: 0.06, drop: 0.02, width: 0.03, toeOut: 0.08, roll: 0.18, lean: 0.03, twist: 0.07, arm: { A: 0.32, e0: 0.2, e1: 0.25 } },
      run: { v: 3.0, f: 1.25, duty: 0.4, lift: 0.16, drop: 0.05, width: 0.025, toeOut: 0.06, roll: 0.1, toe: 0.8, lean: 0.14, twist: 0.08, arm: { A: 0.8, e0: 1.2, e1: 0.4 } },
      sprint: { v: 4.7, f: 1.55, duty: 0.33, lift: 0.22, drop: 0.07, width: 0.02, toeOut: 0.06, roll: 0.08, toe: 0.9, lean: 0.22, twist: 0.08, arm: { A: 1.0, e0: 1.3, e1: 0.35 } },
      panic: { v: 3.8, f: 1.4, duty: 0.37, lift: 0.19, drop: 0.06, width: 0.025, toeOut: 0.1, roll: 0.1, toe: 0.85, lean: 0.12, twist: 0.2 },
    },
    post: {
      panic: (P, c) => { arm(P, 1, 1.9 + 0.7 * S(c, 2, 0.1) + 0.3 * S(c, 3), 0.55 + 0.25 * S(c, 1), 0.9 + 0.5 * S(c, 3, 0.2)); arm(P, -1, 1.7 + 0.7 * S(c, 2, 0.6) + 0.3 * S(c, 3, 0.4), 0.55 + 0.25 * S(c, 1, 0.5), 0.9 + 0.5 * S(c, 3, 0.7)); P.e(J.HEAD, -0.15 + 0.15 * S(c, 2), 0.5 * S(c, 1, 0.1), 0.15 * S(c, 3)); },
    },
    aimArms: (P, c, fire, { L }) => {
      if (!fire) { arm(P, -1, 1.5 + 0.03 * S(c, 1), 0.08, 0.1); arm(P, 1, 0.1, 0.15, 0.25); }
      else { armIK(P, L, -1, [-0.1, L.chestY + 0.04, 0.26], [-0.5, -0.6, -0.8]); armIK(P, L, 1, [0.1, L.chestY - 0.02, 0.24], [0.5, -0.6, -0.8]); P.e(J.HEAD, 0.22 + 0.04 * S(c, 1), 0.1 * S(c, 0.5), 0); }
    },
  };
  return {
    M, L, K,
    palette: {
      skin: SKINS_PH.concat([]), hair: [0x15110c, 0x2a1d12, 0x45301b, 0x6b4a2a, 0xb4aca4, 0x8a8a90],
      top: [0xe6e6e0, 0xdedfda, 0xd6dce0, 0xe2dfd6, 0xdcdcd8, 0xe8e8e6, 0xd2d8d4, 0xdadada], bot: [0x2e323e, 0x3e4252, 0x56524a, 0x22262e, 0x4a5262, 0x32363a],
      acc: [0x3e78c8, 0x2a2a2e, 0xc8a038, 0x4a8a5a, 0xc04848, 0x8a8a90], shoe: [0x1e1e1e, 0xe0e0e0, 0x3e2e22, 0x2a2a30],
    },
    ovrSlot: SLOT.ACC, dirt: 0.12, bareArm: 0, bareLeg: 0, mix: { kid: 0, elder: 0.1, female: 0.5 }, scale: [0.94, 1.06],
    groups: { head: 1, item: 2, hair: 3 },
    variant: (r, age, sex) => ({ head: r.pick([0, 0, 0, 1, 1, 2, 3]), item: r.pick([0, 1, 1, 2, 2, 3]), hair: sex ? r.pick([0, 1, 1, 2]) : 0 }),
  };
}

// =====================================================================================================================================
// EENBOT-like robot: white ceramic shell, graphite joints, blue visor band + chest ring. Stiff, precise motion.
export function buildRobot() {
  const L = makeLayout({ shoulderX: 0.215, hipX: 0.088, headY: 1.69 });
  const M = new FigureMesh();
  const shell = (extra) => ({ slot: SLOT.GLOSS, layer: LAYER.robotShell, ...extra });
  const domeShade = (yMin, yMax) => (x, y) => ((y > yMin || y < yMax) ? 0.14 : 1);
  const ys = L.shoulderY, eY = L.shoulderY - L.armU, wY = eY - L.armF;
  bodyParts(M, L, {
    R: 6, TR: 8, shoulderX: L.shoulderX, hipX: L.hipX, kx: 0.95, kz: 0.95,
    arm: { r0: 0.043, r1: 0.036, fr0: 0.038, fr1: 0.033 }, leg: { t0: 0.074, t1: 0.056, s0: 0.052, s1: 0.04, mid: 0, calf: 0 }, torso: { chestRx: 0.172, chestRz: 0.115, shRx: 0.2, waistRx: 0.125, waistRz: 0.088, hipRx: 0.14, hipRz: 0.095 },
    head: { rx: 0.078, rz: 0.088, scale: 1.04 }, neckR: 0.034, nose: false,
  }, {
    torso: shell(), pelvis: shell({ slot: SLOT.ACC, layer: LAYER.metal, shade: 0.9 }),
    upperArm: shell({ shade: (x, y) => (y > ys - 0.012 ? 0.16 : 1) }), foreArm: shell({ shade: (x, y) => (y > eY - 0.01 ? 0.16 : 1) }), hand: shell({ slot: SLOT.ACC, layer: LAYER.metal, shade: 0.8 }),
    thigh: shell({ shade: (x, y) => (y > L.hipY - 0.012 ? 0.16 : 1) }), shin: shell({ shade: (x, y) => (y > L.kneeY - 0.012 ? 0.16 : 1) }), foot: shell({ slot: SLOT.ACC, layer: LAYER.metal, shade: 0.85 }),
    head: shell({ layer: LAYER.faceRobot }), neck: { slot: SLOT.ACC, layer: LAYER.metal, shade: 0.7 },
  });
  // glowing chest ring + collar light
  M.add(loft([{ y: L.chestY - 0.065, rx: 0.176, rz: 0.121, cz: 0.01 }, { y: L.chestY - 0.05, rx: 0.181, rz: 0.126, cz: 0.01 }, { y: L.chestY - 0.035, rx: 0.176, rz: 0.121, cz: 0.01 }], { R: 8, k: 2.5 }), { j: J.SPINE, slot: SLOT.EMIT, layer: LAYER.weave, color: [0.25, 0.9, 2.8], name: 'chestring' });
  // back unit / antenna variants (group 1): 0 plain 1 backpack unit 2 shoulder lamp + antenna 3 cargo plate
  M.add(xf(box(0.2, 0.26, 0.09, { taperBottom: [0.9, 0.9] }), { pos: [0, L.chestY - 0.02, -0.15] }), { j: J.SPINE, gate: gate(1, 1, 3), slot: SLOT.ACC, layer: LAYER.metal, shade: 0.85, name: 'unit' });
  M.add(xf(box(0.012, 0.22, 0.012), { pos: [0.075, L.chestY + 0.17, -0.15] }), { j: J.SPINE, gate: gate(1, 2), slot: SLOT.ACC, layer: LAYER.metal, shade: 0.7, name: 'antenna' });
  M.add(xf(box(0.045, 0.03, 0.05), { pos: [-0.2, L.shoulderY + 0.05, 0.03] }), { j: J.ARM_R, gate: gate(1, 2), slot: SLOT.EMIT, layer: LAYER.weave, color: [0.3, 0.9, 2.6], name: 'lamp' });
  M.add(xf(box(0.22, 0.16, 0.05), { pos: [0, L.chestY + 0.0, 0.158] }), { j: J.SPINE, gate: gate(1, 3), slot: SLOT.GLOSS, layer: LAYER.robotShell, shade: 0.8, name: 'plate' });
  bakeBodyAO(M, L);
  const stiff = (c, k = 1) => { const x = Math.sin(Math.PI * 2 * c * k); return Math.sign(x) * Math.pow(Math.abs(x), 0.55); }; // squarer wave -> mechanical
  const K = {
    gait: {
      walk: { v: 1.2, f: 0.9, duty: 0.6, lift: 0.07, drop: 0.015, width: 0.03, toeOut: 0.02, roll: 0.16, lean: 0.0, twist: 0.0, sway: 0.004, roll2: 0.0, arm: { A: 0.38, e0: 0.12, e1: 0.1, abd: 0.08 } },
      run: { v: 3.6, f: 1.45, duty: 0.42, lift: 0.17, drop: 0.045, width: 0.025, toeOut: 0.02, roll: 0.1, toe: 0.8, lean: 0.12, twist: 0.0, sway: 0.004, roll2: 0.0, arm: { A: 0.75, e0: 1.45, e1: 0.05, abd: 0.08 } },
      sprint: { v: 5.8, f: 1.8, duty: 0.34, lift: 0.22, drop: 0.07, width: 0.02, toeOut: 0.02, roll: 0.08, toe: 0.9, lean: 0.2, twist: 0.0, sway: 0.004, roll2: 0.0, arm: { A: 0.95, e0: 1.5, e1: 0.05, abd: 0.08 } },
    },
    post: {
      walk: (P, c) => { P.e(J.HEAD, 0, 0.0, 0); },
      idle: (P, c) => { const step = Math.floor(c * 4) / 4; const k = Math.min(1, Math.max(0, (c * 4 - Math.floor(c * 4)) * 5)); const a = [0, 0.5, 0, -0.5][Math.floor(c * 4) % 4], b = [0.5, 0, -0.5, 0][Math.floor(c * 4) % 4]; P.e(J.HEAD, 0, a + (b - a) * k * k * (3 - 2 * k), 0); P.e(J.SPINE, 0, 0, 0); arm(P, 1, 0.0, 0.07, 0.1); arm(P, -1, 0.0, 0.07, 0.1); P.e(J.ROOT_ROT, 0, 0, 0); },
    },
    aimArms: (P, c, fire, { L }) => { arm(P, -1, 1.5 + (fire ? 0.05 * stiff(c, 3) : 0), 0.04, 0.0); arm(P, 1, 1.4, 0.06, 0.08); },
  };
  return {
    M, L, K,
    palette: {
      skin: [0xf0f0f2], hair: [0x303030],
      top: [0xf4f4f6, 0xeceef2, 0xe0e4ea, 0xf0f0f0, 0x3a3e46, 0xdcdfe4, 0x2e3238, 0xe8eaee], bot: [0xf4f4f6], acc: [0x34383f, 0x2a2e34, 0x40454d, 0x30343a, 0x464b54, 0x2c3036], shoe: [0x2a2e34],
    },
    ovrSlot: SLOT.GLOSS, emitMask: 2.6, emitColor: 0x2aa8ff, emitSlot: 1.0, dirt: 0.05, mix: { kid: 0, elder: 0, female: 0 }, scale: [0.99, 1.02],
    groups: { head: 1 }, variant: (r) => ({ head: r.pick([0, 0, 1, 1, 2, 3]) }),
  };
}
