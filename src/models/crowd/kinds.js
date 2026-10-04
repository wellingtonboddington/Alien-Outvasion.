// Registry: builds (and caches) the geometry, baked pose table and look parameters for each crowd kind.
import { cached } from '../../engine/proc.js';
import { makeClips } from './clips.js';
import { bakeTable } from './anim.js';
import { buildSoldier, buildCivilian, buildScientist, buildRobot } from './kinds_human.js';
import { buildZombie } from './kinds_zombie.js';

const BUILDERS = {
  soldier: buildSoldier, civilian: buildCivilian, scientist: buildScientist, robot: buildRobot,
  zombie_us: () => buildZombie('us'), zombie_giant: () => buildZombie('giant'), zombie_india: () => buildZombie('india'),
  zombie_russia: () => buildZombie('russia'), zombie_germany: () => buildZombie('germany'), zombie_cebu: () => buildZombie('cebu'),
};
export const KIND_NAMES = Object.keys(BUILDERS);

function finalize(name, d) {
  const geometry = d.M.toGeometry(); geometry.userData.shared = true;
  const { clips, nominal } = makeClips(d.L, d.K);
  const table = bakeTable(clips);
  const mix = d.mix || {}; const sc = d.scale || [0.96, 1.05];
  const groups = d.groups || {};
  const pack = (obj, cur = 0) => { let v = cur; for (const k in obj) { const g = groups[k]; if (!g) continue; const sh = 2 * (g - 1); v = (v & ~(3 << sh)) | ((obj[k] & 3) << sh); } return v; };
  return {
    name, geometry, table, layout: d.L, palette: d.palette, nominal: { idle: 0, ...nominal, ...(d.nominalExtra || {}) },
    emitSlot: d.emitSlot ?? 0, emitMask: d.emitMask ?? 0, emitColor: d.emitColor ?? 0, ovrSlot: d.ovrSlot ?? 3, dirt: d.dirt ?? 0.3, bareArm: d.bareArm ?? 0, bareLeg: d.bareLeg ?? 0, bareChest: d.bareChest ?? 0, skinLayer: d.skinLayer ?? 6,
    tris: d.M.tris, trisVisible: d.M.trisVisible(), verts: d.M.nv, parts: d.M.parts, heightScale: d.heightScale ?? 1, fireMul: d.fireMul ?? 1, lookWeight: d.lookWeight ?? 0, defaultInfect: d.defaultInfect ?? 0,
    rollAge: (r) => { const u = r.next(); return u < (mix.kid || 0) ? 1 : u < (mix.kid || 0) + (mix.elder || 0) ? 2 : 0; },
    rollSex: (r) => (r.next() < (mix.female || 0) ? 1 : 0),
    rollScale: (r, age) => (age === 1 ? r.range(0.6, 0.8) : age === 2 ? r.range(sc[0], sc[1]) * 0.96 : r.range(sc[0], sc[1])),
    rollVariant: (r, age, sex) => pack(d.variant ? d.variant(r, age, sex) : {}),
    packVariant: pack,
    groups,
  };
}

export function getKind(name) {
  if (!BUILDERS[name]) throw new Error('createCrowd: unknown kind "' + name + '" (known: ' + KIND_NAMES.join(', ') + ')');
  return cached('crowd-kind-v1-' + name, () => finalize(name, BUILDERS[name]()));
}
