// Lineup of the 9 main cast + a talking close-up (lip-sync) — used to eyeball the human module.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createHuman, MAIN_CAST } from '../models/human/index.js';
import { buildVisemeTrack, sampleMouth, speechEnergy } from '../engine/lipsync.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { bg: 0x2a2f38 });
  const keys = ['mirrah', 'bead', 'jez', 'stephen', 'ezra', 'sam', 'jhaz', 'leon', 'epiphany'];
  const humans = keys.map((k, i) => { const h = createHuman(MAIN_CAST[k]); h.setTransform((i - 4) * 1.0, 0, 0, 0); stage.scene.add(h.root); h.play('idle', { time: 0 }); return h; });
  const track = buildVisemeTrack('Doc Mirrah, the dead do not have meetings, Tito. I do.', 4);
  const mouth = {};
  return {
    update(t, dt) { humans.forEach((h, i) => { h.play(i % 2 ? 'idle' : 'talk_a', { time: t }); h.update(dt, t); }); const m = humans[0]; sampleMouth(track, t % 5, mouth); m.setMouth(mouth); m.setTalk(speechEnergy(track, t % 5), 'calm'); },
    shots: [
      { name: 'line', t: 1.5, cam: [0, 1.5, 9.5, 0, 0.95, 0], fov: 38 },
      { name: 'face_mirrah', t: 1.9, cam: [-4 + 0.3, 1.38, 1.1, -4, 1.32, 0], fov: 28 },
      { name: 'face_bead', t: 1.5, cam: [-3 + 0.3, 1.58, 1.1, -3, 1.52, 0], fov: 28 },
      { name: 'face_sam', t: 1.5, cam: [1 + 0.3, 1.58, 1.3, 1, 1.5, 0], fov: 28 },
    ],
  };
}
