// Lineup of the 9 main cast (clothed + haired) + talking close-ups + rows of every NPC kind — used to eyeball the human module.
// params: {noNpc:true} skips the NPC rows (faster).
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createHuman, createNPC, MAIN_CAST, NPC_KINDS } from '../models/human/index.js';
import { buildVisemeTrack, sampleMouth, speechEnergy } from '../engine/lipsync.js';

const tris = (h) => h.meshes.reduce((a, m) => a + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
const info = (h) => h.meshes.map((m) => `${m.name}:${Math.round((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3)}`).join(' ');

export default async function setup(stage, params) {
  addStudioLights(stage, { bg: 0x2a2f38 });
  const keys = ['mirrah', 'bead', 'jez', 'stephen', 'ezra', 'sam', 'jhaz', 'leon', 'epiphany'];
  const humans = keys.map((k, i) => { const h = createHuman(MAIN_CAST[k]); h.setTransform((i - 4) * 1.0, 0, 0, 0); stage.scene.add(h.root); h.play('idle', { time: 0 }); return h; });
  const npcs = [];
  const row = (kinds, z, x0, dx, seed0) => kinds.forEach((k, i) => { const h = createNPC(k, seed0 + i); h.setTransform(x0 + i * dx, 0, z, 0); stage.scene.add(h.root); h.play(i % 3 === 0 ? 'talk_b' : 'idle', { time: 0 }); npcs.push(h); });
  if (!params.noNpc) {
    row(NPC_KINDS.slice(0, 12), -10, -5.5, 1.0, 3);
    row([...NPC_KINDS.slice(12), 'civilian', 'civilian'].slice(0, 8), -14, -3.5, 1.0, 5);
  }
  console.log('TRIS mirrah', Math.round(tris(humans[0])), info(humans[0]));
  console.log('TRIS leon', Math.round(tris(humans[7])), info(humans[7]));
  if (npcs[3]) console.log('TRIS soldier', Math.round(tris(npcs[3])), info(npcs[3]));
  const track = buildVisemeTrack('Doc Mirrah, the dead do not have meetings, Tito. I do.', 4);
  const mouth = {};
  return {
    update(t, dt) {
      humans.forEach((h, i) => { h.play(i % 2 ? 'idle' : 'talk_a', { time: t }); h.update(dt, t); });
      npcs.forEach((h, i) => { h.play(i % 3 === 0 ? 'talk_b' : 'idle', { time: t + i * 0.3 }); h.update(dt, t); });
      const m = humans[0]; sampleMouth(track, t % 5, mouth); m.setMouth(mouth); m.setTalk(speechEnergy(track, t % 5), 'calm');
    },
    shots: [
      { name: 'line_a', t: 1.5, cam: [-2, 1.15, 5.2, -2, 0.88, 0], fov: 38 },
      { name: 'line_b', t: 1.5, cam: [2.4, 1.15, 5.2, 2.4, 0.88, 0], fov: 38 },
      { name: 'face_mirrah', t: 1.9, cam: [-4 + 0.45, 1.36, 1.1, -4, 1.31, 0], fov: 26 },
      { name: 'face_leon', t: 1.5, cam: [3 - 0.5, 1.28, 1.2, 3, 1.22, 0], fov: 26 },
      { name: 'back_jez', t: 1.5, cam: [-2 - 0.5, 1.3, -1.6, -2, 1.2, 0], fov: 32 },
      { name: 'npc_a', t: 1.5, cam: [-2.75, 1.3, -5.2, -2.75, 0.95, -10], fov: 40 },
      { name: 'npc_b', t: 1.5, cam: [2.75, 1.3, -5.2, 2.75, 0.95, -10], fov: 40 },
      { name: 'npc_c', t: 1.5, cam: [0, 1.3, -9.0, 0, 0.95, -14], fov: 40 },
    ],
  };
}
