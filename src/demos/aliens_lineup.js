// Line-up of the four Vessari kinds (full body + close-up faces mid-speech driven by lipsync.js).
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createVessari } from '../models/aliens/index.js';
import { buildVisemeTrack, sampleMouth, speechEnergy } from '../engine/lipsync.js';

const LINES = {
  soldier: ['The signal is ours now. Hold the line until the ships arrive.', 'talk_a'],
  officer: ['Advance on my mark. Leave nothing standing.', 'talk_b'],
  drone: ['Yes, yes. We carry. We carry. We do not stop.', 'idle'],
  hierarch: ['Your world was a seed. We are the harvest, and the harvest is patient.', 'talk_a'],
};
export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: true });
  const kinds = ['soldier', 'officer', 'drone', 'hierarch']; const xs = [-3.3, -1.1, 1.1, 3.4]; const items = [];
  kinds.forEach((k, i) => {
    const h = createVessari(k, 5 + i); h.root.position.set(xs[i], 0, 0); h.root.rotation.y = -xs[i] * 0.05; stage.scene.add(h.root);
    const [text, clip] = LINES[k]; const dur = 3.4; const track = buildVisemeTrack(text, dur);
    h.play(clip, { blend: 0 }); if (k === 'soldier' || k === 'officer') h.hold(k === 'soldier' ? 'rifle' : null);
    items.push({ h, track, k, clip });
  });
  const mouth = {};
  return {
    update(t, dt) { for (const o of items) { const lt = (t + 0.3) % 4.2; sampleMouth(o.track, lt, mouth, 1.0); o.h.setMouth(mouth); o.h.setTalk(speechEnergy(o.track, lt), o.k === 'officer' ? 'angry' : 'calm'); o.h.update(dt, t); } },
    shots: params.shots || [
      { name: 'wide', t: 1.3, cam: [0, 1.7, 9.5, 0, 1.35, 0], fov: 32 },
      { name: 'soldier', t: 1.3, cam: [-3.3 + 0.9, 2.45, 2.0, -3.3, 2.3, 0.2], fov: 24 },
      { name: 'officer', t: 1.3, cam: [-1.1 + 0.9, 2.45, 2.0, -1.1, 2.3, 0.2], fov: 24 },
      { name: 'drone', t: 1.3, cam: [1.1 + 0.8, 2.15, 1.9, 1.1, 2.0, 0.2], fov: 24 },
      { name: 'hierarch', t: 1.3, cam: [3.4 + 1.0, 2.65, 2.3, 3.4, 2.5, 0.2], fov: 24 },
    ],
  };
}
