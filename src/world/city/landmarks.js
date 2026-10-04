// Landmark registry + createLandmark(name, opts). Each landmark is built from Builder buckets (see builder.js/materials.js).
import * as THREE from 'three';
import { RNG } from '../../engine/common.js';
import { Builder } from './builder.js';
import { MatSet } from './materials.js';
import { finishObject } from './objects.js';
import * as A from './landmarks_a.js';

const REG = {
  dumaguete_blvd: { fn: A.boulevard, bounds: { w: 190, d: 60 } },
  dumaguete_belltower: { fn: A.belltower, bounds: { w: 60, d: 60 } },
  cathedral: { fn: A.cathedral, bounds: { w: 120, d: 130 } },
  berlin_tv_tower: { fn: A.tvTower, bounds: { w: 300, d: 300 } },
  berlin_gate: { fn: A.brandenburgGate, bounds: { w: 220, d: 200 } },
};
export const LANDMARK_NAMES = () => Object.keys(REG);
export function registerLandmarks(extra) { Object.assign(REG, extra); }

/** createLandmark(name, opts) -> THREE.Group (with .update/.dispose/.setNight/.fireAnchors/.anchors attached) */
export function createLandmark(name, opts = {}) {
  const alias = { dumaguete_cathedral: 'cathedral', tvtower: 'berlin_tv_tower', brandenburg_gate: 'berlin_gate', whitehouse: 'whitehouse_like' }; name = alias[name] || name;
  const def = REG[name]; if (!def) throw new Error('unknown landmark ' + name + ' (have ' + Object.keys(REG).join(', ') + ')');
  const B = new Builder(); const mats = new MatSet({ snow: opts.snow || 0, burning: true }); const ctx = { rng: new RNG((opts.seed || 1) * 131 + name.length), mats, opts, snow: opts.snow || 0, extra: [] };
  const info = def.fn(B, ctx) || {}; const api = finishObject(B, mats, { shadows: opts.shadows });
  const g = api.root; g.name = 'landmark_' + name; for (const e of ctx.extra) g.add(e.root || e);
  g.userData = { ...g.userData, landmark: name, bounds: def.bounds, info, api }; g.update = (dt, t) => { api.update(dt, t); for (const e of ctx.extra) e.update && e.update(dt, t); }; g.dispose = () => { api.dispose(); for (const e of ctx.extra) e.dispose && e.dispose(); }; g.setNight = (n) => { api.setNight(n); for (const e of ctx.extra) e.setNight && e.setNight(n); };
  g.fireAnchors = api.fireAnchors; g.anchors = info.anchors || []; g.stats = api.stats; if (opts.night) g.setNight(opts.night);
  return g;
}
