import * as THREE from 'three';
import { createCityBlock } from '../world/city.js';
export default async function setup(stage, params) {
  const out = {}; for (const st of (params.styles || ['dumaguete', 'cebu', 'manhattan', 'berlin', 'moscow', 'delhi', 'generic', 'suburb', 'industrial'])) { const b = createCityBlock(st, { seed: 1, damage: params.damage || 0 }); out[st] = { tris: b.stats.tris, buckets: b.stats.buckets, by: b.stats.byBucket, h: +b.bounds.h.toFixed(0), lots: b.layout.lots.length }; b.dispose(); }
  console.log(JSON.stringify(out, null, 1));
  return { shots: [{ name: 'x', t: 0 }] };
}
