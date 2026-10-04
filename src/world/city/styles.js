// City style definitions: palettes, lot rules and building-spec generators for each city flavour.
import { RNG } from '../../engine/common.js';
import { pickW } from './paint.js';
import { mix, jitter } from './builder.js';

const PASTEL = [0xf4c7d0, 0xbfe3d4, 0xf7e0a3, 0x9ed3e6, 0xf2b38e, 0xcdb8e6, 0xe9e4d8, 0x7fc4b8, 0xe8d27a, 0xd98c7a, 0xf4f1ea, 0xa8d8a0, 0xe8a0b8, 0xf0e0c0, 0x8cc8e8];
const STONE = [0xe8dcc0, 0xd8cca8, 0xcfc4a8, 0xe0d2b0, 0xc8bca0];
const NEUTRAL = [0xd8d6d0, 0xc8c6c0, 0xe4e2dc, 0xb8b6b0, 0xcfccc4, 0xdcd8cc];
const GLASS_TINTS = [0xbcd8f0, 0xa8d0d8, 0x9cc4e0, 0xc8e0e8, 0x8cb4d0, 0xb0c8d8, 0xd0e4f0];
const BRICK = [0xffffff, 0xf0e4e0, 0xe8d8d0, 0xf4ece8];

function tiersFor(rng, w, d, floors, facade, o = {}) {
  const t = [{ w, d, ox: 0, oz: 0, floors, facade }]; return t;
}
/** stepped tower: returns tiers with setbacks */
function setbackTiers(rng, w, d, total, facade, o = {}) {
  const tiers = []; let remain = total; let cw = w, cd = d, ox = 0, oz = 0; const base = Math.max(3, Math.round(total * rng.range(0.28, 0.45)));
  tiers.push({ w: cw, d: cd, ox, oz, floors: Math.min(remain, base), facade: o.baseFacade || facade, fh: o.fh }); remain -= tiers[0].floors;
  const nSet = o.steps ?? rng.int(1, 3);
  for (let i = 0; i < nSet && remain > 0; i++) {
    const inset = rng.range(2.0, Math.min(4.5, cw * 0.18)); cw = Math.max(6, cw - inset * 2 * rng.range(0.7, 1)); cd = Math.max(6, cd - inset * 2 * rng.range(0.7, 1)); ox += rng.range(-inset, inset) * 0.4; oz += rng.range(-inset, inset) * 0.4;
    const fl = i === nSet - 1 ? remain : Math.max(2, Math.round(remain * rng.range(0.35, 0.6))); tiers.push({ w: cw, d: cd, ox: Math.max(-(w - cw) / 2 + 0.3, Math.min((w - cw) / 2 - 0.3, ox)), oz: Math.max(-(d - cd) / 2 + 0.3, Math.min((d - cd) / 2 - 0.3, oz)), floors: Math.min(fl, remain), facade, fh: o.fh }); remain -= fl;
  }
  return tiers;
}
const shopOf = (key, fh, sides) => ({ facade: key, fh, sides });

export const STYLES = {
  // ------------------------------------------------------------------ Dumaguete: low/mid-rise tropical
  dumaguete: {
    defaultW: 170, defaultD: 170, roadW: 13, sidewalk: 2.4, cell: [52, 70], ringDepth: [11, 14], lotW: [7, 13], groundInner: 'g_dirt', parkLane: 2.2, markings: 'ph', tree: ['raintree', 'coconut', 'coconut', 'banana', 'mango'], treeSpacing: 12,
    signClass: 'fascia', signRange: [0, 16], signChance: 0.88, awning: 0.4, blades: 0.3, balconies: 0.5, acBoxes: 0.6, banners: 0.3, laundry: 0.35, ironRail: false, wires: true, poles: true, bunting: 0.8, cars: ['jeepney', 'tricycle', 'tricycle', 'sedan', 'suv', 'van', 'pickup', 'hatch'], carsDensity: 0.55, lamp: 'modern', fenceYards: false,
    spec(rng, lot, env) {
      const d = env.density; const floors = pickW(rng, [[0, 8], [1, 26], [2, 34 + d * 6], [3, 20 + d * 12], [4, 8 + d * 12], [5, 3 + d * 10]]);
      const shop = (lot.edge && (rng.chance(0.78) || floors === 0)) ? shopOf('shop_ph', rng.range(3.4, 3.9), lot.corner ? ['right', 'left'] : []) : null; const f = Math.max(shop ? 0 : 1, floors);
      const rtype = pickW(rng, [['flat', 55], ['gi_gable', 20], ['gi_hip', 10], ['flat', 15]]);
      const props = rtype === 'flat' ? pickW(rng, [[['tank', 'antenna', 'laundry'], 2], [['tank', 'shanty', 'dish', 'antenna'], 2], [['barrel', 'antenna', 'dish'], 2], [['shanty', 'laundry'], 1], [['bulkhead', 'tank', 'antenna', 'dish'], 1], [[], 0.5]]) : ['antenna', 'dish'];
      return { w: lot.w - 0.5, d: lot.d, tiers: [{ w: lot.w - 0.5, d: lot.d, ox: 0, oz: 0, floors: f, facade: 'tropic', fh: rng.range(2.9, 3.2) }], shop, tint: jitter(rng.pick(PASTEL), rng, 0.04), roof: { type: rtype, props, col: undefined }, seed: rng.int(1, 1e9), cornice: null };
    },
  },
  // ------------------------------------------------------------------ Cebu: denser, IT-park glass towers
  cebu: {
    defaultW: 190, defaultD: 190, roadW: 15, sidewalk: 3.0, cell: [60, 82], ringDepth: [14, 20], lotW: [12, 24], groundInner: 'g_concrete', parkLane: 2.2, markings: 'ph', tree: ['raintree', 'coconut', 'palm', 'mango'], treeSpacing: 14,
    signClass: 'fascia', signRange: [0, 24], signChance: 0.8, awning: 0.2, blades: 0.35, balconies: 0.45, acBoxes: 0.3, banners: 0.12, laundry: 0.05, ironRail: false, wires: true, poles: true, bunting: 0.0, cars: ['jeepney', 'sedan', 'suv', 'van', 'taxi', 'hatch', 'tricycle', 'pickup'], carsDensity: 0.5, lamp: 'modern',
    spec(rng, lot, env) {
      const d = env.density; const kind = pickW(rng, [['tower', 22 + d * 22], ['glass', 20 + d * 12], ['mid', 34], ['low', 18 - d * 8]]);
      if (kind === 'tower') { const fl = rng.int(12, 30 + Math.round(d * 14)); const tiers = setbackTiers(rng, lot.w - 1, lot.d, fl, rng.chance(0.6) ? 'glass' : 'office', { steps: rng.int(0, 2), baseFacade: 'office' });
        return { w: lot.w - 1, d: lot.d, tiers, shop: shopOf('shop_ph', 4.2, []), tint: jitter(rng.pick(GLASS_TINTS), rng, 0.05), roof: { type: 'flat', props: ['hvac', 'antenna', 'bulkhead', 'billboard'], parapetH: 1.0 }, seed: rng.int(1, 1e9), cornice: null }; }
      if (kind === 'glass') { const fl = rng.int(8, 20); return { w: lot.w - 1, d: lot.d, tiers: [{ w: lot.w - 1, d: lot.d, ox: 0, oz: 0, floors: fl, facade: 'glass' }], shop: shopOf('shop_ph', 4.2, []), tint: jitter(rng.pick(GLASS_TINTS), rng, 0.06), roof: { type: 'flat', props: ['hvac', 'antenna', 'bulkhead'], parapetH: 0.6 }, seed: rng.int(1, 1e9) }; }
      if (kind === 'mid') { const fl = rng.int(4, 9); return { w: lot.w - 0.6, d: lot.d, tiers: [{ w: lot.w - 0.6, d: lot.d, ox: 0, oz: 0, floors: fl, facade: rng.chance(0.55) ? 'tropic' : 'office', fh: 3.1 }], shop: rng.chance(0.8) ? shopOf('shop_ph', 3.8, lot.corner ? ['right', 'left'] : []) : null, tint: jitter(rng.chance(0.6) ? rng.pick(PASTEL) : rng.pick(NEUTRAL), rng, 0.04), roof: { type: 'flat', props: ['tank', 'hvac', 'antenna', 'dish', 'bulkhead'] }, seed: rng.int(1, 1e9) }; }
      return { w: lot.w - 0.5, d: lot.d, tiers: [{ w: lot.w - 0.5, d: lot.d, ox: 0, oz: 0, floors: rng.int(1, 3), facade: 'tropic', fh: 3.0 }], shop: shopOf('shop_ph', 3.6, []), tint: jitter(rng.pick(PASTEL), rng, 0.04), roof: { type: rng.chance(0.4) ? 'gi_gable' : 'flat', props: ['tank', 'antenna'] }, seed: rng.int(1, 1e9) };
    },
  },
  // ------------------------------------------------------------------ Manhattan
  manhattan: {
    defaultW: 180, defaultD: 190, roadW: 17, sidewalk: 4.0, cell: [56, 88], ringDepth: [26, 34], lotW: [14, 30], groundInner: 'g_concrete', parkLane: 2.6, markings: 'us', tree: ['plane', 'plane', 'bush'], treeSpacing: 16,
    signClass: 'fascia', signRange: [16, 24], signChance: 0.85, awning: 0.45, awningCols: [0xb83232, 0x2f5fa8, 0x2a7a4a, 0x222222], blades: 0.35, balconies: 0, acBoxes: 0.5, fireEscape: 0.9, banners: 0, ironRail: true, wires: false, poles: false, bunting: 0, cars: ['taxi', 'taxi', 'sedan', 'suv', 'van', 'taxi', 'police', 'pickup'], carsDensity: 0.7, lamp: 'cobra', steamVents: true,
    spec(rng, lot, env) {
      const d = env.density; const kind = pickW(rng, [['tenement', 22 - d * 8], ['deco', 14 + d * 10], ['modern', 24 + d * 10], ['mid', 28]]);
      if (kind === 'tenement') { const fl = rng.int(4, 7); return { w: lot.w - 0.4, d: lot.d, tiers: [{ w: lot.w - 0.4, d: lot.d, ox: 0, oz: 0, floors: fl, facade: 'tenement', fh: 3.2 }], shop: shopOf('shop_us', 4.2, lot.corner ? ['right', 'left'] : []), tint: jitter(rng.pick(BRICK), rng, 0.05), roof: { type: 'flat', props: ['woodtower', 'hvac', 'antenna', 'bulkhead'], parapetH: 0.9 }, seed: rng.int(1, 1e9), cornice: mix(0xc0b8a0, 0x000000, 0.1) }; }
      if (kind === 'deco') { const fl = rng.int(16, 38 + Math.round(d * 12)); const tiers = setbackTiers(rng, lot.w - 0.6, lot.d, fl, 'deco', { steps: rng.int(2, 3), baseFacade: 'deco', fh: 4.0 }); return { w: lot.w - 0.6, d: lot.d, tiers, shop: shopOf('shop_us', 5.0, lot.corner ? ['right', 'left'] : []), tint: jitter(rng.pick(STONE), rng, 0.04), roof: { type: 'spire', h: rng.range(14, 36), col: rng.pick([0xb8c0c0, 0x9ab0a8, 0xc8c8c0]) }, seed: rng.int(1, 1e9), cornice: 0xcfc6b0 }; }
      if (kind === 'modern') { const fl = rng.int(14, 34 + Math.round(d * 10)); const tiers = setbackTiers(rng, lot.w - 0.6, lot.d, fl, rng.chance(0.65) ? 'glass' : 'office', { steps: rng.int(0, 2), baseFacade: 'office' }); return { w: lot.w - 0.6, d: lot.d, tiers, shop: shopOf('shop_us', 4.6, lot.corner ? ['right', 'left'] : []), tint: jitter(rng.pick(GLASS_TINTS), rng, 0.05), roof: { type: 'flat', props: ['hvac', 'bulkhead', 'antenna', 'woodtower'], parapetH: 1.0 }, seed: rng.int(1, 1e9), cornice: null }; }
      const fl = rng.int(8, 16); return { w: lot.w - 0.4, d: lot.d, tiers: [{ w: lot.w - 0.4, d: lot.d, ox: 0, oz: 0, floors: fl, facade: rng.chance(0.5) ? 'tenement' : 'office', fh: 3.4 }], shop: shopOf('shop_us', 4.4, lot.corner ? ['right', 'left'] : []), tint: jitter(rng.chance(0.5) ? rng.pick(BRICK) : rng.pick(NEUTRAL), rng, 0.05), roof: { type: 'flat', props: ['woodtower', 'hvac', 'antenna', 'bulkhead', 'billboard'], parapetH: 1.0 }, seed: rng.int(1, 1e9), cornice: 0xb8b09c };
    },
  },
  // ------------------------------------------------------------------ Berlin
  berlin: {
    defaultW: 170, defaultD: 170, roadW: 14, sidewalk: 3.4, cell: [62, 84], ringDepth: [13, 16], lotW: [11, 20], groundInner: 'g_grass', parkLane: 2.2, markings: 'eu', tree: ['plane', 'plane', 'linden', 'bush'], treeSpacing: 11, tram: true,
    signClass: 'fascia', signRange: [24, 32], signChance: 0.7, awning: 0.25, awningCols: [0x1d3a2c, 0x7a2828, 0x222], blades: 0.25, balconies: 0.45, ironRail: true, acBoxes: 0, banners: 0, wires: false, poles: false, bunting: 0, cars: ['hatch', 'sedan', 'hatch', 'van', 'suv', 'sedan'], carsDensity: 0.55, lamp: 'ornate',
    spec(rng, lot, env) {
      const k = pickW(rng, [['altbau', 78], ['plattenbau', 10 + env.density * 4], ['office', 6]]);
      if (k === 'altbau') { const fl = rng.int(3, 5); const tint = jitter(rng.pick([0xf0e8d0, 0xe8d8b0, 0xdcd0b0, 0xd8d8c8, 0xe8d0c0, 0xc8d4c0, 0xd0d8e0, 0xe0c8a8]), rng, 0.03); const hip = rng.chance(0.75);
        return { w: lot.w - 0.2, d: lot.d, tiers: [{ w: lot.w - 0.2, d: lot.d, ox: 0, oz: 0, floors: fl, facade: 'altbau', fh: rng.range(3.3, 3.7) }], shop: rng.chance(0.65) ? shopOf('shop_eu', 4.0, lot.corner ? ['right', 'left'] : []) : null, tint, roof: { type: hip ? 'tile_hip' : 'flat', props: hip ? ['chimney', 'chimney', 'antenna'] : ['hvac', 'antenna'], pitch: 0.9, dormers: hip ? Math.max(1, Math.round(lot.w / 5)) : 0 }, seed: rng.int(1, 1e9), cornice: mix(tint, 0xffffff, 0.2) }; }
      if (k === 'plattenbau') { const fl = rng.int(5, 11); return { w: lot.w + rng.range(6, 18), d: Math.min(lot.d, 12.5), tiers: [{ w: lot.w + 10, d: Math.min(lot.d, 12.5), ox: 0, oz: 0, floors: fl, facade: 'plattenbau', fh: 2.8 }], shop: null, tint: jitter(rng.pick([0xd8d4cc, 0xc8ccd0, 0xd4d0bc, 0xcfc8c0]), rng, 0.04), roof: { type: 'flat', props: ['antenna', 'bulkhead', 'dish'] }, seed: rng.int(1, 1e9) }; }
      return { w: lot.w, d: lot.d, tiers: [{ w: lot.w, d: lot.d, ox: 0, oz: 0, floors: rng.int(5, 9), facade: 'office', fh: 3.4 }], shop: shopOf('shop_eu', 4.0, []), tint: jitter(rng.pick(NEUTRAL), rng, 0.04), roof: { type: 'flat', props: ['hvac', 'antenna'] }, seed: rng.int(1, 1e9) };
    },
  },
  // ------------------------------------------------------------------ Moscow
  moscow: {
    defaultW: 200, defaultD: 200, roadW: 24, sidewalk: 4.0, cell: [74, 100], ringDepth: [14, 18], lotW: [18, 40], groundInner: 'g_grass', parkLane: 2.4, markings: 'ru', tree: ['birch', 'spruce', 'birch', 'bare'], treeSpacing: 13, snow: 0.75,
    signClass: 'ru', signRange: [0, 8], signChance: 0.6, awning: 0, blades: 0, balconies: 0.5, ironRail: false, acBoxes: 0, banners: 0, wires: false, poles: false, bunting: 0, cars: ['sedan', 'hatch', 'suv', 'van', 'sedan', 'truck'], carsDensity: 0.4, lamp: 'cobra',
    spec(rng, lot, env) {
      const k = pickW(rng, [['stalin', 30], ['panel', 50], ['panel9', 20]]);
      if (k === 'stalin') { const fl = rng.int(7, 12); const tiers = rng.chance(0.4) ? setbackTiers(rng, lot.w, lot.d, fl + 6, 'stalin', { steps: 2, baseFacade: 'stalin', fh: 3.8 }) : [{ w: lot.w, d: lot.d, ox: 0, oz: 0, floors: fl, facade: 'stalin', fh: 3.8 }];
        return { w: lot.w, d: lot.d, tiers, shop: shopOf('shop_eu', 4.4, []), tint: jitter(rng.pick(STONE), rng, 0.03), roof: { type: tiers.length > 1 ? 'spire' : 'green_hip', h: rng.range(10, 22), col: 0xffffff, pitch: 0.5, props: [] }, seed: rng.int(1, 1e9), cornice: 0xe2d8b8 }; }
      const fl = k === 'panel' ? rng.int(5, 5) : rng.int(9, 16);
      return { w: lot.w + 6, d: Math.min(lot.d, 12.5), tiers: [{ w: lot.w + 6, d: Math.min(lot.d, 12.5), ox: 0, oz: 0, floors: fl, facade: 'plattenbau', fh: 2.8 }], shop: null, tint: jitter(rng.pick([0xd8d4cc, 0xcfd2d4, 0xdcd4b8, 0xcbc8c0, 0xd0c4b4]), rng, 0.04), roof: { type: 'flat', props: ['antenna', 'bulkhead', 'dish'] }, seed: rng.int(1, 1e9) };
    },
  },
  // ------------------------------------------------------------------ Delhi
  delhi: {
    defaultW: 150, defaultD: 150, roadW: 10, sidewalk: 1.6, cell: [42, 58], ringDepth: [10, 13], lotW: [5, 10], groundInner: 'g_dirt', parkLane: 2.0, markings: 'in', tree: ['neem', 'neem', 'mango', 'bush'], treeSpacing: 18, haze: true,
    signClass: 'in', signRange: [0, 8], signChance: 0.85, awning: 0.55, awningCols: [0xe84a2a, 0x2a6ac8, 0xf2c230, 0x2a8a4a, 0xd83a8a], blades: 0.4, balconies: 0.4, acBoxes: 0.8, banners: 0.2, laundry: 0.4, ironRail: true, wires: true, poles: true, bunting: 0.0, cars: ['tricycle', 'tricycle', 'hatch', 'sedan', 'van', 'pickup', 'tricycle'], carsDensity: 0.6, lamp: 'modern',
    spec(rng, lot, env) {
      const d = env.density; const fl = pickW(rng, [[0, 8], [1, 30], [2, 34], [3, 20 + d * 10], [4, 8 + d * 8]]); const shop = (lot.edge && rng.chance(0.85)) ? shopOf('shop_in', rng.range(3.2, 3.6), lot.corner ? ['right', 'left'] : []) : null;
      return { w: lot.w - 0.2, d: lot.d, tiers: [{ w: lot.w - 0.2, d: lot.d, ox: 0, oz: 0, floors: Math.max(shop ? 0 : 1, fl), facade: 'delhi', fh: rng.range(2.8, 3.1) }], shop, tint: jitter(rng.pick([0xe8d8b8, 0xe0c0a0, 0xd8a8a0, 0xa8c8c0, 0xe8e0c8, 0xd8c890, 0xc8b8d0, 0xf0d8d0]), rng, 0.05), roof: { type: 'flat', props: pickW(rng, [[['tankblack', 'tankblack', 'dish', 'laundry'], 3], [['tankblack', 'shanty', 'antenna'], 2], [['barrel', 'dish', 'laundry', 'shanty'], 2]]), parapetH: 0.9 }, seed: rng.int(1, 1e9) };
    },
  },
  // ------------------------------------------------------------------ generic
  generic: {
    defaultW: 160, defaultD: 160, roadW: 13, sidewalk: 3.0, cell: [56, 74], ringDepth: [12, 18], lotW: [10, 22], groundInner: 'g_concrete', parkLane: 2.2, markings: 'us', tree: ['plane', 'raintree', 'bush'], treeSpacing: 15,
    signClass: 'fascia', signRange: [16, 24], signChance: 0.7, awning: 0.3, blades: 0.2, balconies: 0.3, acBoxes: 0.3, ironRail: true, wires: false, poles: false, bunting: 0, cars: ['sedan', 'hatch', 'suv', 'van', 'pickup', 'taxi'], carsDensity: 0.5, lamp: 'modern',
    spec(rng, lot, env) {
      const fl = rng.int(2, 12); const f = pickW(rng, [['office', 3], ['tenement', 2], ['tropic', 1], ['plattenbau', 1]]);
      return { w: lot.w - 0.4, d: lot.d, tiers: [{ w: lot.w - 0.4, d: lot.d, ox: 0, oz: 0, floors: fl, facade: f }], shop: rng.chance(0.6) ? shopOf('shop_us', 4.0, lot.corner ? ['right', 'left'] : []) : null, tint: jitter(rng.pick(NEUTRAL.concat(PASTEL.slice(0, 5))), rng, 0.05), roof: { type: 'flat', props: ['hvac', 'antenna', 'bulkhead', 'tank'] }, seed: rng.int(1, 1e9) };
    },
  },
  // ------------------------------------------------------------------ suburb
  suburb: {
    defaultW: 150, defaultD: 150, roadW: 9, sidewalk: 1.8, cell: [60, 80], ringDepth: [20, 24], lotW: [16, 24], groundInner: 'g_grass', parkLane: 0, markings: 'us', tree: ['plane', 'raintree', 'bush', 'bush'], treeSpacing: 14, yards: true,
    signs: false, balconies: 0, acBoxes: 0.2, wires: true, poles: true, cars: ['sedan', 'suv', 'pickup', 'hatch', 'van'], carsDensity: 0.45, lamp: 'modern', signClass: 'fascia', signRange: [16, 24],
    spec(rng, lot, env) {
      const w = rng.range(9, 13), d = rng.range(8.5, 11); const fl = rng.int(1, 2);
      return { w, d, tiers: [{ w, d, ox: 0, oz: 0, floors: fl, facade: 'siding', fh: 2.8 }], shop: null, tint: jitter(rng.pick([0xf0ece0, 0xd8e0e8, 0xe8d8c0, 0xc8d8c8, 0xe0c8c0, 0xf4f0e8, 0xd0d8d0]), rng, 0.03), roof: { type: rng.chance(0.6) ? 'tile_hip' : 'zinc_gable', props: ['chimney'], pitch: 0.55, col: rng.pick([0xffffff, 0xd8c8c0, 0xb8a8a8, 0xe8c8b8, 0xc8ccd4]) }, seed: rng.int(1, 1e9), yardZ: lot.d - d, inset: true };
    },
  },
  // ------------------------------------------------------------------ industrial
  industrial: {
    defaultW: 190, defaultD: 190, roadW: 12, sidewalk: 1.2, cell: [70, 100], ringDepth: [26, 36], lotW: [28, 55], groundInner: 'g_gravel', parkLane: 0, markings: 'us', tree: ['bush', 'bare'], treeSpacing: 40, industrial: true,
    signs: false, balconies: 0, acBoxes: 0, wires: true, poles: true, cars: ['truck', 'van', 'pickup', 'truck'], carsDensity: 0.3, lamp: 'modern', signClass: 'fascia', signRange: [16, 24],
    spec(rng, lot, env) {
      const fl = rng.int(1, 2); const w = lot.w - 1, d = lot.d; return { w, d, tiers: [{ w, d, ox: 0, oz: 0, floors: fl, facade: 'industrial', fh: 4.5 }], shop: null, tint: jitter(rng.pick([0xc8cccc, 0xb8c0c4, 0xc8c0b0, 0xa8b8c0, 0xc4b8a4]), rng, 0.05), roof: { type: rng.chance(0.7) ? 'zinc_gable' : 'flat', props: ['hvac', 'hvac', 'antenna'], pitch: 0.12, col: 0xe8ecf0 }, seed: rng.int(1, 1e9) };
    },
  },
};
STYLES.cebu.name = 'cebu'; for (const k of Object.keys(STYLES)) STYLES[k].name = k;
export const STYLE_NAMES = Object.keys(STYLES);
