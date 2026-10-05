import { addStudioLights } from '../engine/stage.js';
import { createHuman, MAIN_CAST } from '../models/human/index.js';
export default async function setup(stage, p) { addStudioLights(stage, { bg: 0x2a2f38 }); const keys = p.keys || ['epiphany', 'jez', 'mirrah', 'bead']; const hs = keys.map((k, i) => { const h = createHuman(MAIN_CAST[k]); h.setTransform(i * 1.2, 0, 0, 0); stage.scene.add(h.root); h.play('idle', { time: 0 }); return h; });
  const heads = keys.map((k, i) => 1.5 * (MAIN_CAST[k].heightCm || 165) / 165 - 0.02);
  return { update(t, dt) { hs.forEach((h) => { h.play('idle', { time: t }); h.update(dt, t); }); }, shots: keys.map((k, i) => ({ name: k, t: 1.2, cam: [i * 1.2 + 0.18, heads[i], 1.25, i * 1.2, heads[i] - 0.03, 0], fov: 26 })) }; }
