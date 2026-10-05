// Procedural NPCs: createNPC(kind, seed=1, opts={}) -> Human (same API as createHuman). Everything derives from (kind, seed): ethnicity, gender, age, build,
// face, hair, outfit.  Skin/clothing textures are shared through the module caches (face archetype ids are pooled), so 30 NPCs are cheap.
// opts: { ethnicity, gender:'M'|'F', age, heightCm, hair:{...}, outfit:{...}, id, name, lod }
import { RNG, hashStr } from '../../engine/common.js';
import { ETHNICITY } from './profiles.js';
import { createHuman } from './index.js';

export const NPC_KINDS = ['civilian', 'elder', 'child', 'soldier', 'officer', 'general', 'pilot', 'scientist', 'doctor', 'nurse', 'anchor', 'reporter', 'politician', 'technician', 'police', 'worker', 'guard', 'monk'];

const ETH_W = { filipino: 40, caucasian: 14, black: 11, south_asian: 10, east_asian: 11, slavic: 5, german: 4, middle_eastern: 5 };
const ETH_H = { filipino: -0.05, east_asian: -0.03, south_asian: -0.03, middle_eastern: 0, caucasian: 0.01, slavic: 0.03, german: 0.04, black: 0.02 };
const TOPS = ['#c24a3a', '#3a6ea5', '#e0b84a', '#4f8a5b', '#8c8c92', '#e9e5da', '#2f3a4a', '#b86fa0', '#d9822b', '#5a4a7a', '#7a2f3a', '#2e6f73'];
const JEANS = ['#35465e', '#26303d', '#4a5f7d', '#1d232b'], KHAKI = ['#6b6b47', '#8a7b5a', '#4a4f3a', '#9a8f78'], DARKS = ['#1b1d22', '#2a2d36', '#3a3226', '#202a3a'];
const SHOES_CASUAL = [['sneakers', '#e9e9e9'], ['sneakers', '#3a5a9a'], ['boots', '#3a2a1c'], ['sandals', '#3a2e26'], ['work', '#1c1a18']];
const pick = (r, a) => a[Math.floor(r.next() * a.length) % a.length];
const wpick = (r, tbl) => { let t = 0; for (const k in tbl) t += tbl[k]; let x = r.next() * t; for (const k in tbl) { x -= tbl[k]; if (x <= 0) return k; } return Object.keys(tbl)[0]; };

const KIND = {
  civilian: { f: 0.5, age: [16, 58] }, elder: { f: 0.5, age: [63, 86] }, child: { f: 0.5, age: [5, 12] }, soldier: { f: 0.2, age: [19, 38] }, officer: { f: 0.3, age: [28, 52] },
  general: { f: 0.15, age: [50, 66] }, pilot: { f: 0.2, age: [26, 48] }, scientist: { f: 0.5, age: [26, 62] }, doctor: { f: 0.5, age: [28, 62] }, nurse: { f: 0.8, age: [22, 56] },
  anchor: { f: 0.5, age: [28, 55] }, reporter: { f: 0.45, age: [23, 48] }, politician: { f: 0.35, age: [40, 68] }, technician: { f: 0.2, age: [22, 56] }, police: { f: 0.2, age: [22, 52] },
  worker: { f: 0.12, age: [20, 58] }, guard: { f: 0.15, age: [24, 58] }, monk: { f: 0.1, age: [24, 74] },
};

/** the profile object createNPC feeds to createHuman (useful for inspection / tweaking) */
export function npcProfile(kind, seed = 1, opts = {}) {
  const K = KIND[kind] || KIND.civilian;
  const r = new RNG((hashStr(kind + '#' + seed) ^ 0x2545f491) >>> 0);
  const eth = opts.ethnicity || (kind === 'monk' ? pick(r, ['east_asian', 'south_asian', 'filipino']) : wpick(r, ETH_W));
  const gender = opts.gender || (r.next() < K.f ? 'F' : 'M'), F = gender === 'F';
  const age = Math.round(opts.age ?? r.range(K.age[0], K.age[1]));
  const ageBin = age < 13 ? 'c' : age < 28 ? 'a' : age < 45 ? 'b' : age < 62 ? 'd' : 'e', ageRep = { c: age, a: 22, b: 36, d: 52, e: 72 }[ageBin];
  const E = ETHNICITY[eth];
  // pooled face archetype (shares skin textures): id = eth/gender/variant/ageBin
  const variant = Math.floor(r.next() * 3), id = opts.id || `npc_${eth}_${gender}_${variant}_${ageBin}${ageBin === 'c' ? age : ''}`;
  const lr = new RNG(hashStr(id)), pf = (a, b) => Math.round(lr.range(a, b) * 100) / 100;
  const face = { width: pf(0.93, 1.07), jaw: pf(0.9, 1.1), chin: pf(0.9, 1.1), cheek: pf(0.92, 1.1), brow: pf(0.9, 1.1), noseWidth: pf(0.92, 1.1), noseLen: pf(0.92, 1.08), noseBridge: pf(0.9, 1.1), lips: pf(0.9, 1.12), eyeSize: pf(0.94, 1.08), earSize: pf(0.9, 1.15), jowl: ageBin === 'e' ? 0.5 : 0 };
  const tone = E.tones[Math.floor(lr.next() * E.tones.length)], muscleBase = pf(0.1, 0.45);
  const fair = eth === 'caucasian' || eth === 'slavic' || eth === 'german';
  const skin = { tone, warm: 0.5, blush: F ? 0.28 : 0.15, freckles: fair ? pf(0, 0.35) : 0, stubble: 0, lip: F ? '#b46a68' : '#a05a50', lipstick: F && lr.next() < 0.4 ? pick(lr, ['#9a2f3a', '#b84a52', '#7a2a3a']) : null, eyeliner: F ? pf(0, 0.4) : 0, wrinkles: Math.min(1, Math.max(0, (age - 32) / 55)), tattoos: [], moles: [] };
  const eyes = { color: E.eyes[Math.floor(lr.next() * E.eyes.length)] };
  // body (per seed)
  const rg = (a, b) => r.range(a, b), old = age > 55 ? (age - 55) / 30 : 0;
  const build = F ? { shoulder: rg(0.88, 1.0), chest: rg(0.86, 1.02), waist: rg(0.8, 1.02) + old * 0.15, hip: rg(0.95, 1.12), limbFat: rg(0.12, 0.5), muscle: rg(0.04, 0.3), belly: Math.max(0, rg(-0.2, 0.25)) + old * 0.2, bust: rg(0.3, 0.85), neck: rg(0.88, 1), hand: rg(0.9, 1) }
    : { shoulder: rg(0.95, 1.1), chest: rg(0.92, 1.12), waist: rg(0.85, 1.12) + old * 0.12, hip: rg(0.9, 1.05), limbFat: rg(0.05, 0.45), muscle: muscleBase, belly: Math.max(0, rg(-0.25, 0.45)) + old * 0.3, bust: 0, neck: rg(0.95, 1.15), hand: rg(0.96, 1.1) };
  if (['soldier', 'worker', 'police', 'guard'].includes(kind)) { build.muscle = Math.min(1, build.muscle + 0.25); build.chest *= 1.04; }
  if (kind === 'general' || kind === 'politician') build.belly += 0.2;
  const heightCm = opts.heightCm ?? (kind === 'child' ? Math.max(104, Math.min(158, 100 + (age - 5) * 6.4 + rg(-4, 4))) : (F ? 162 : 174) + (ETH_H[eth] || 0) * 100 + rg(-7, 7) - old * 4);
  if (kind === 'child') { build.muscle = 0.05; build.belly = 0.05; build.waist = 1; build.shoulder = 1; }
  // hair + facial hair
  const hcol = pick(r, E.hair), gray = age > 40 ? Math.min(1, (age - 40) / 38) * r.range(0.6, 1) : 0;
  const hair = { style: pick(r, hairOptions(kind, F, eth, age)), color: hcol, hi: null, length: 1, volume: r.range(0.8, 1.2), gray };
  if (kind === 'monk') hair.style = 'bald';
  const facialHair = { type: 'none', color: hcol, density: 0.8 };
  if (!F && kind !== 'child' && kind !== 'monk' && age > 20 && !['nurse', 'anchor', 'general'].includes(kind)) {
    const q = r.next(), thick = ['soldier', 'worker', 'guard', 'civilian', 'elder', 'technician'].includes(kind) ? 1.3 : 0.7;
    facialHair.type = q < 0.12 * thick ? 'moustache' : q < 0.2 * thick ? 'goatee' : q < 0.26 * thick ? 'beard' : 'none';
    if (facialHair.type === 'none' && r.next() < 0.3 * thick) skin.stubble = r.range(0.15, 0.45);
  }
  const outfit = makeOutfit(kind, r, F), acc = outfit._acc || []; delete outfit._acc;
  if (kind !== 'child' && kind !== 'monk' && r.next() < (kind === 'scientist' || age > 50 ? 0.4 : 0.14)) acc.push(r.next() < 0.5 ? 'glasses_round' : 'glasses_tiny');
  return {
    id, name: opts.name || `${kind[0].toUpperCase()}${kind.slice(1)} ${seed}`, kind, gender, age: ageRep, ethnicity: eth, heightCm, build, face, skin, eyes,
    brows: { color: null, thick: r.range(0.85, 1.2), arch: r.range(0.2, 0.7) }, facialHair, hair: { ...hair, ...(opts.hair || {}) }, outfit: { ...outfit, ...(opts.outfit || {}) }, accessories: acc, baseSmile: r.range(-0.02, 0.2),
  };
}

function hairOptions(kind, F, eth, age) {
  if (kind === 'child') return F ? ['pixie', 'ponytail', 'bob', 'messy'] : ['crop', 'messy', 'buzz'];
  if (eth === 'black') return F ? ['curls', 'bob', 'long_straight', 'bun', 'pixie'] : ['curls', 'buzz', 'fade', 'crop'];
  if (age > 62) return F ? ['bun', 'bob', 'pixie', 'low_ponytail'] : ['balding', 'buzz', 'slick', 'balding'];
  if (['soldier', 'guard', 'police'].includes(kind)) return F ? ['bun', 'low_ponytail', 'pixie'] : ['buzz', 'crop', 'fade'];
  if (['anchor', 'politician', 'officer', 'general'].includes(kind)) return F ? ['bob', 'low_ponytail', 'bun', 'long_straight'] : ['slick', 'sidepart', 'crop'];
  if (kind === 'nurse' || kind === 'doctor') return F ? ['bun', 'ponytail', 'low_ponytail', 'bob'] : ['crop', 'sidepart', 'buzz'];
  return F ? ['long_wavy', 'long_straight', 'ponytail', 'low_ponytail', 'bob', 'bun', 'pixie', 'long_wavy'] : ['crop', 'messy', 'sidepart', 'fade', 'buzz', 'slick', 'messy', 'crop'];
}

function makeOutfit(kind, r, F) {
  const o = { _acc: [] }, acc = o._acc, top = pick(r, TOPS), shoes = pick(r, SHOES_CASUAL), sh = (t, c) => ({ type: t, color: c });
  switch (kind) {
    case 'civilian': {
      const t = F ? pick(r, ['tshirt', 'tank', 'blouse', 'sweater', 'hoodie']) : pick(r, ['tshirt', 'shirt', 'hoodie', 'sweater', 'tshirt']);
      o.top = { type: t, color: top, rolled: t === 'shirt' && r.chance(0.5) };
      o.bottom = F && r.chance(0.35) ? sh(r.chance(0.5) ? 'skirt' : 'pencil', pick(r, [...JEANS, ...DARKS, ...KHAKI])) : sh(r.chance(0.2) ? 'shorts' : r.chance(0.35) ? 'cargo' : 'jeans', pick(r, r.chance(0.5) ? JEANS : KHAKI));
      if (o.bottom.type === 'cargo') o.bottom.color = pick(r, KHAKI);
      if (r.chance(0.28)) o.outer = sh(pick(r, ['jacket', 'driver_jacket']), pick(r, [...DARKS, ...KHAKI]));
      o.shoes = sh(shoes[0], shoes[1]); if (r.chance(0.2)) acc.push('watch'); if (r.chance(0.12)) acc.push('satchel');
      break;
    }
    case 'elder':
      o.top = { type: F ? pick(r, ['blouse', 'sweater']) : pick(r, ['shirt', 'sweater', 'tshirt']), color: pick(r, ['#8a9a8a', '#a08a70', '#6a7a9a', '#c9bfae', '#7a5a5a']) };
      o.bottom = F && r.chance(0.5) ? sh('skirt', pick(r, DARKS)) : sh('slacks', pick(r, ['#3a3a40', '#6a6048', '#2a3040'])); o.shoes = sh('work', '#2a2420'); if (r.chance(0.3)) o.outer = sh('jacket', '#5a5a52');
      break;
    case 'child':
      o.top = { type: r.chance(0.3) ? 'hoodie' : 'tshirt', color: pick(r, TOPS) }; o.bottom = sh(F && r.chance(0.5) ? 'skirt' : r.chance(0.5) ? 'shorts' : 'jeans', pick(r, [...JEANS, '#6a8a4a', '#8a5a9a'])); o.shoes = sh('sneakers', pick(r, ['#e9e9e9', '#c24a3a', '#3a6ea5']));
      break;
    case 'soldier': {
      const camo = pick(r, ['woodland', 'woodland', 'desert', 'urban']);
      o.top = { type: 'uniform', color: '#ffffff', camo }; o.bottom = { type: 'camo', color: '#ffffff', camo }; o.shoes = sh('boots', '#2a221a'); if (r.chance(0.4)) o.gloves = { color: '#222' };
      if (r.chance(0.65)) o.outer = { type: 'armor', color: camo === 'desert' ? '#8a7a58' : '#3a4030' };
      o.cap = { type: 'helmet_mil', color: '#4a5230' }; break;
    }
    case 'officer': o.top = { type: 'uniform', color: '#5a6246' }; o.bottom = sh(F && r.chance(0.4) ? 'pencil' : 'uniform', '#4a523c'); o.shoes = sh('work', '#17140f'); if (r.chance(0.7)) o.tie = { color: '#2a2a22' }; o.cap = { type: r.chance(0.5) ? 'beret' : 'peaked', color: r.chance(0.5) ? '#7a1f2b' : '#4a523c', trim: '#c8a43a' }; break;
    case 'general': o.top = { type: 'uniform', color: '#3d4a3a' }; o.bottom = sh('uniform', '#34402f'); o.shoes = sh('work', '#0f0d0b'); o.tie = { color: '#222' }; o.cap = { type: 'peaked', color: '#3d4a3a', trim: '#d4af37' }; break;
    case 'pilot': { const c = pick(r, ['#4a5238', '#c96a1a', '#5a6068']); o.top = { type: 'jumpsuit', color: c }; o.shoes = sh('boots', '#1a1a1a'); o.gloves = { color: '#2a2a2a' }; if (r.chance(0.6)) o.cap = { type: 'helmet_pilot', color: '#e8e8ea', trim: '#c8202a' }; break; }
    case 'scientist': o.top = { type: F ? 'blouse' : 'shirt', color: pick(r, ['#c9d6e8', '#e8e0d0', '#9ab0c0', '#d8c0c8']) }; o.bottom = sh(F && r.chance(0.3) ? 'pencil' : 'slacks', pick(r, DARKS)); o.outer = sh('labcoat', '#f1f3f5'); o.shoes = sh(r.chance(0.5) ? 'work' : 'sneakers', r.chance(0.5) ? '#222' : '#eee'); acc.push('lanyard', 'pen_pocket'); break;
    case 'doctor': { const sc = pick(r, ['#2c8fa6', '#3a7a5a', '#2a4a8a']); o.top = sh('scrubs', sc); o.bottom = sh('scrubs', sc); if (r.chance(0.6)) o.outer = sh('labcoat', '#f1f3f5'); o.shoes = sh(r.chance(0.5) ? 'clog' : 'sneakers', '#f0f0f0'); o.stethoscope = true; acc.push('lanyard'); break; }
    case 'nurse': { const sc = pick(r, ['#e8a0b4', '#2c9fb6', '#a0c8a0', '#9a88d0']); o.top = sh('scrubs', sc); o.bottom = sh('scrubs', sc); o.shoes = sh(r.chance(0.5) ? 'clog' : 'sneakers', '#f4f4f4'); acc.push('lanyard'); if (r.chance(0.4)) o.stethoscope = true; break; }
    case 'anchor': { const c = pick(r, ['#2a3a5a', '#3a2a40', '#1d1d22', '#6a2a3a']); o.top = { type: F ? 'blouse' : 'shirt', color: F ? pick(r, ['#f2ece4', '#c8d6e8', '#e8c8d0']) : '#f4f4f0' }; o.outer = sh('blazer', c); o.bottom = sh(F && r.chance(0.6) ? 'pencil' : 'slacks', c); o.shoes = sh(F && r.chance(0.5) ? 'heels' : 'work', '#17151a'); if (!F) o.tie = { color: pick(r, ['#7a1f2b', '#1f3a7a', '#d4af37']) }; break; }
    case 'reporter': o.top = { type: r.chance(0.5) ? 'tshirt' : 'shirt', color: top, rolled: r.chance(0.5) }; o.outer = sh(r.chance(0.5) ? 'jacket' : 'cargo_jacket', pick(r, [...KHAKI, '#2a2f38'])); o.bottom = sh('jeans', pick(r, JEANS)); o.shoes = sh('boots', '#3a2a1c'); o.lanyard = { color: '#c8202a' }; break;
    case 'politician': { const c = pick(r, ['#1d1d28', '#2a2f3a', '#3a3a3a', '#202838']); o.top = { type: F ? 'blouse' : 'shirt', color: F ? '#f4eee6' : pick(r, ['#f4f4f0', '#c8d8ec']) }; o.outer = sh('blazer', c); o.bottom = sh(F && r.chance(0.5) ? 'pencil' : 'slacks', c); o.shoes = sh(F && r.chance(0.5) ? 'heels' : 'work', '#14120f'); if (!F) o.tie = { color: pick(r, ['#8a1f2b', '#1f3a8a', '#2a2a2a']) }; break; }
    case 'technician': { const c = pick(r, ['#2f4a7a', '#5a6068', '#c96a1a', '#4a5238']); o.top = { type: 'jumpsuit', color: c }; o.shoes = sh('boots', '#2a221a'); if (r.chance(0.5)) o.outer = { type: 'hivis', color: '#d8f020' }; if (r.chance(0.5)) o.cap = { type: 'hardhat', color: pick(r, ['#f2c21b', '#f0f0f0', '#e06a1a']) }; if (r.chance(0.4)) o.gloves = { color: '#8a6a3a' }; break; }
    case 'police': o.top = { type: 'uniform', color: '#1f2c4a' }; o.bottom = sh('uniform', '#1a2540'); o.shoes = sh('boots', '#101010'); if (r.chance(0.35)) o.outer = { type: 'vest', color: '#14203a' }; if (r.chance(0.7)) o.cap = { type: 'peaked', color: '#1f2c4a', trim: '#c8a43a' }; if (r.chance(0.2)) o.gloves = { color: '#111' }; break;
    case 'worker': o.top = { type: r.chance(0.5) ? 'tank' : 'tshirt', color: pick(r, ['#8a8a82', '#c24a3a', '#e0e0d8', '#3a6ea5']) }; o.bottom = sh(r.chance(0.5) ? 'cargo' : 'jeans', pick(r, KHAKI)); if (r.chance(0.6)) o.outer = { type: 'hivis', color: pick(r, ['#d8f020', '#ff8a1a']) }; o.shoes = sh('boots', '#3a2a1c'); o.cap = { type: 'hardhat', color: pick(r, ['#f2c21b', '#f0f0f0', '#e06a1a']) }; o.gloves = { color: '#8a6a3a' }; break;
    case 'guard': o.top = { type: 'uniform', color: pick(r, ['#2a2a2e', '#3a3a3e', '#2a3a2a']) }; o.bottom = sh('uniform', '#222226'); o.shoes = sh('boots', '#101010'); o.cap = r.chance(0.7) ? { type: 'peaked', color: '#2a2a2e', trim: '#8a8a90' } : { type: 'cap', color: '#2a2a2e' }; if (r.chance(0.4)) o.outer = { type: 'vest', color: '#1c1c20' }; break;
    case 'monk': { const rc = pick(r, ['#d9822b', '#8a2a1a', '#c8601a', '#7a5a3a']); o.top = { type: 'robe', color: rc, accent: '#6a2a14' }; o.shoes = sh('sandals', '#3a2a1c'); break; }
    default: o.top = { type: 'tshirt', color: top }; o.bottom = sh('jeans', JEANS[0]); o.shoes = sh('sneakers', '#eee');
  }
  return o;
}

export function createNPC(kind = 'civilian', seed = 1, opts = {}) {
  const k = NPC_KINDS.includes(kind) ? kind : 'civilian';
  const h = createHuman(npcProfile(k, seed, opts), { lod: opts.lod || 0 });
  h.npcKind = k; h.npcSeed = seed; return h;
}
