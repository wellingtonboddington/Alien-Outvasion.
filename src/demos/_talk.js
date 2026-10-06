// Filmstrip: talk_a / talk_b / walk while speaking (energy from a real viseme track)
import { addStudioLights } from '../engine/stage.js';
import { createHuman, MAIN_CAST } from '../models/human/index.js';
import { buildVisemeTrack, sampleMouth, speechEnergy } from '../engine/lipsync.js';
export default async function setup(stage, p) {
  addStudioLights(stage, { bg: 0x2a2f38 });
  const clips = p.clips || ['talk_a', 'talk_b', 'walk'];
  const hs = clips.map((c, i) => { const h = createHuman(MAIN_CAST[p.who || 'ezra']); h.setTransform(i * 1.6, 0, 0, 0); stage.scene.add(h.root); return h; });
  const tr = buildVisemeTrack('Welcome to the morgue, may I take your order? It is just you again, isn\'t it.', 5); const m = {};
  const times = p.times || [0.6, 1.2, 1.8, 2.4, 3.0, 3.6];
  return {
    update(t, dt) { hs.forEach((h, i) => { const tt = t % 5; sampleMouth(tr, tt, m); h.setMouth(m); h.setTalk(speechEnergy(tr, tt), 'excited'); h.play(clips[i], { time: t, params: { speed: 1.4 } }); h.update(dt, t); }); },
    shots: times.flatMap((t) => clips.map((c, i) => ({ name: `${c}_${String(t).replace('.', '_')}`, t, cam: [i * 1.6 + 0.4, 1.2, 3.2, i * 1.6, 1.0, 0], fov: 34 }))),
  };
}
