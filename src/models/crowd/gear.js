// Shared props for crowd figures: weapons (aligned to the soldier grip points), packs, hats.
import { J, SLOT, LAYER, gate, GATE } from './rig.js';
import { loft, box, cyl, ellipsoid, xf, warp } from './build.js';

const X0 = -0.12, Y0 = 1.385; // weapon axis (right shoulder, chest height)
const rotZ90 = [Math.PI / 2, 0, 0]; // +Y -> +Z

/** add the four weapon variants (group `grp`: 0 carbine, 1 machine gun, 2 launcher, 3 marksman rifle) */
export function addWeapons(M, grp = 2) {
  const W = (g, mm, gt, name) => M.add(g, { j: J.WEAPON, gate: gt, name, ...mm });
  const metal = { slot: SLOT.FIXED, layer: LAYER.metal, color: 0x2c2f33 };
  const dark = { slot: SLOT.FIXED, layer: LAYER.leather, color: 0x1c1d1e };
  const furn = { slot: SLOT.FIXED, layer: LAYER.leather, color: 0x2e3328 };
  const g03 = gate(grp, 0, 3);
  // carbine / marksman rifle
  W(xf(box(0.052, 0.078, 0.58, { tile: 0.3 }), { pos: [X0, Y0, 0.34] }), metal, g03, 'rifle_body');
  W(xf(box(0.044, 0.1, 0.2, { taperTop: [0.9, 0.85], slantTop: [0, -0.02] }), { pos: [X0, Y0 - 0.014, -0.06] }), furn, g03, 'rifle_stock');
  W(xf(cyl(0.011, 0.011, 0.27, 4), { pos: [X0, Y0, 0.62], rot: rotZ90 }), metal, g03, 'rifle_barrel');
  W(xf(box(0.032, 0.1, 0.038), { pos: [X0 - 0.004, Y0 - 0.085, 0.15], rot: [-0.3, 0, 0] }), dark, g03, 'rifle_grip');
  W(xf(box(0.032, 0.13, 0.046), { pos: [X0, Y0 - 0.1, 0.32], rot: [0.18, 0, 0] }), metal, g03, 'rifle_mag');
  W(xf(cyl(0.022, 0.022, 0.2, 5), { pos: [X0, Y0 + 0.062, 0.3], rot: rotZ90 }), dark, gate(grp, 3), 'rifle_scope');
  // machine gun
  const g1 = gate(grp, 1);
  W(xf(box(0.064, 0.092, 0.64, { tile: 0.3 }), { pos: [X0, Y0, 0.34] }), metal, g1, 'mg_body');
  W(xf(box(0.046, 0.1, 0.2, { taperTop: [0.9, 0.85] }), { pos: [X0, Y0 - 0.01, -0.06] }), furn, g1, 'mg_stock');
  W(xf(cyl(0.014, 0.014, 0.3, 4), { pos: [X0, Y0 + 0.004, 0.65], rot: rotZ90 }), metal, g1, 'mg_barrel');
  W(xf(box(0.1, 0.1, 0.09), { pos: [X0, Y0 - 0.1, 0.27] }), furn, g1, 'mg_box');
  W(xf(box(0.022, 0.022, 0.22), { pos: [X0, Y0 - 0.05, 0.78] }), metal, g1, 'mg_bipod');
  W(xf(box(0.028, 0.05, 0.12), { pos: [X0, Y0 + 0.07, 0.25] }), metal, g1, 'mg_handle');
  // launcher on the shoulder
  const g2 = gate(grp, 2);
  W(xf(cyl(0.05, 0.05, 1.08, 6, { caps: true }), { pos: [X0 - 0.01, Y0 + 0.05, -0.12], rot: rotZ90 }), { slot: SLOT.FIXED, layer: LAYER.metal, color: 0x4a5040 }, g2, 'rpg_tube');
  W(xf(loft([{ y: 0, rx: 0.06, rz: 0.06 }, { y: 0.1, rx: 0.036, rz: 0.036 }, { y: 0.2, rx: 0, rz: 0 }], { R: 6, rot0: 0 }), { pos: [X0 - 0.01, Y0 + 0.05, 0.96], rot: rotZ90 }), { slot: SLOT.FIXED, layer: LAYER.metal, color: 0x4a5a2a }, g2, 'rpg_head');
  W(xf(box(0.034, 0.1, 0.04), { pos: [X0 - 0.004, Y0 - 0.055, 0.15], rot: [-0.25, 0, 0] }), dark, g2, 'rpg_grip');
  W(xf(box(0.05, 0.12, 0.05), { pos: [X0 + 0.06, Y0 - 0.03, 0.42] }), dark, g2, 'rpg_front');
  // muzzle flash (shader-gated on the fire state)
  const flash = { slot: SLOT.EMIT, layer: LAYER.weave, color: [3.6, 2.5, 1.0] };
  M.add(xf(ellipsoid(0.05, 0.05, 0.13, 5, 2), { pos: [X0, Y0, 0.98] }), { j: J.WEAPON, gate: GATE.FLASH, name: 'flash', ...flash });
  M.add(xf(box(0.16, 0.012, 0.1), { pos: [X0, Y0, 0.96] }), { j: J.WEAPON, gate: GATE.FLASH, name: 'flash2', ...flash });
}

/** backpacks on the spine. group opts: 0 none, 1 assault pack, 2 radio, 3 large ruck */
export function addPacks(M, L, grp = 3, mm = { slot: SLOT.ACC, layer: LAYER.weave }) {
  const P = (g, gt, name, m2) => M.add(g, { j: J.SPINE, gate: gt, name, ...(m2 || mm) });
  P(xf(box(0.27, 0.32, 0.15, { taperBottom: [0.9, 0.9] }), { pos: [0, L.chestY - 0.02, -0.2] }), gate(grp, 1), 'pack1');
  P(xf(box(0.2, 0.28, 0.11), { pos: [0, L.chestY - 0.03, -0.18] }), gate(grp, 2), 'radio');
  P(xf(box(0.012, 0.5, 0.012), { pos: [0.07, L.chestY + 0.27, -0.2] }), gate(grp, 2), 'antenna', { slot: SLOT.FIXED, layer: LAYER.metal, color: 0x1a1a1a });
  P(xf(box(0.33, 0.46, 0.2, { taperBottom: [0.9, 0.9] }), { pos: [0, L.chestY - 0.02, -0.22] }), gate(grp, 3), 'ruck');
  P(xf(cyl(0.065, 0.065, 0.32, 6), { pos: [0, L.chestY + 0.26, -0.2], rot: [0, 0, Math.PI / 2] }), gate(grp, 3), 'bedroll', { slot: SLOT.TOP2, layer: LAYER.weave });
}

/** military helmet (rim lower at the back), cap, etc. relative to head centre */
export function helmet(L, { s = 1, thick = 0.014, rimFront = 0.04, rimBack = -0.05 } = {}) {
  const hy = L.headY;
  const g = loft([
    { y: rimBack * s, rx: (0.088 + thick) * s, rz: (0.104 + thick) * s, cz: -0.012 * s },
    { y: 0.072 * s, rx: (0.088 + thick) * s, rz: (0.1 + thick) * s, cz: -0.012 * s },
    { y: 0.125 * s, rx: (0.058 + thick * 0.5) * s, rz: (0.074 + thick * 0.5) * s, cz: -0.012 * s },
    { y: 0.148 * s + thick, rx: 0, rz: 0, cz: -0.012 * s },
  ], { R: 8, k: 2.4 });
  warp(g, (x, y, z) => { if (y < 0.06 * s) { const t = Math.max(0, Math.min(1, z / (0.1 * s))); const tgt = rimFront * s; return [x, y + (tgt - y) * t * t * (3 - 2 * t), z]; } return null; });
  xf(g, { pos: [0, hy, 0] });
  for (let i = 0; i < g.uv.length; i += 2) { g.uv[i] = g.p[i / 2 * 3] * 2 + g.p[i / 2 * 3 + 2]; g.uv[i + 1] = g.p[i / 2 * 3 + 1] * 2 + g.p[i / 2 * 3 + 2] * 0.5; }
  return g;
}
export function capHat(L, { s = 1, brim = 0.15, crown = 0.1, y = 0.04, visor = 0 } = {}) {
  const hy = L.headY;
  const g = loft([
    { y: y * s, rx: brim * s, rz: brim * 1.02 * s, cz: visor * s },
    { y: (y + 0.012) * s, rx: (crown + 0.02) * s, rz: (crown + 0.025) * s, cz: visor * 0.3 * s },
    { y: (y + 0.06) * s, rx: crown * 0.92 * s, rz: crown * 1.0 * s },
    { y: (y + 0.085) * s, rx: 0, rz: 0 },
  ], { R: 8, k: 2.3 });
  xf(g, { pos: [0, hy, -0.004] });
  for (let i = 0; i < g.uv.length; i += 2) { g.uv[i] = g.p[i / 2 * 3] * 2; g.uv[i + 1] = g.p[i / 2 * 3 + 2] * 2; }
  return g;
}
