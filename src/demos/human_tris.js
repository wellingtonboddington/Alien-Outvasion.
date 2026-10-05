// Triangle / draw-call breakdown of a few humans (console.log; run with --verbose 1).
import { addStudioLights } from '../engine/stage.js';
import { createHuman, createNPC, MAIN_CAST } from '../models/human/index.js';
const info = (h) => h.meshes.map((m) => `${m.name}:${Math.round((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3)}`).join(' ');
export default async function setup(stage) {
  addStudioLights(stage, { bg: 0x2a2f38 });
  const hs = [createHuman(MAIN_CAST.mirrah), createHuman(MAIN_CAST.leon), createHuman(MAIN_CAST.jez), createNPC('soldier', 3), createNPC('nurse', 2), createNPC('civilian', 4)];
  hs.forEach((h, i) => { h.setTransform((i - 2.5) * 0.9, 0, 0, 0); stage.scene.add(h.root); h.update(1 / 30, 0); const tot = h.meshes.reduce((a, m) => a + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0); console.log('TRIS', h.profile.id, Math.round(tot), 'meshes', h.meshes.length, info(h)); });
  return { update(t, dt) { hs.forEach((h) => h.update(dt, t)); }, shots: [{ name: 'a', t: 0.2, cam: [0, 1.2, 4.5, 0, 0.9, 0], fov: 38 }] };
}
