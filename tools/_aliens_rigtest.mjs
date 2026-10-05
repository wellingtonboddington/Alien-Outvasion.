import { buildBody } from '../src/models/aliens/body.js';
import { setQuality } from '../src/engine/common.js';
for (const q of [0, 1, 2]) { setQuality(q); for (const k of ['soldier', 'officer', 'drone', 'hierarch']) { const { geos } = buildBody(k, 3, null); const per = {}; let t = 0; for (const m in geos) { if (!geos[m]) continue; per[m] = Math.round(geos[m].index.count / 3); t += per[m]; } console.log('q' + q, k, t, JSON.stringify(per)); } }
