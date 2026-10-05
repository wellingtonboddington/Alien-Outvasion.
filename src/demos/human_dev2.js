// dev: full human with clips
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createHuman, MAIN_CAST } from '../models/human/index.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: true });
  const who = params.who || 'mirrah'; const clip = params.clip || 'idle';
  const h = createHuman(MAIN_CAST[who]);
  stage.scene.add(h.root);
  h.play(clip, { params: params.p || {} });
  const H = h.profile.height;
  const cam = (a, d, y = H * 0.55, ty = H * 0.5, fov = 32) => ({ cam: [Math.sin(a) * d, y, Math.cos(a) * d, 0, ty, 0], fov });
  const shots = [
    { name: 'front', t: 1.0, ...cam(0, 4.2) }, { name: 'side', t: 1.0, ...cam(Math.PI / 2, 4.2) }, { name: 'q34', t: 1.0, ...cam(0.8, 4.2) },
  ];
  let ct = 0;
  return { update(t, dt) { if (params.speed) { /* moving root */ h.root.position.z = t * params.speed; } h.update(dt, t); }, shots, onShot(s) { if (params.speed) { } } };
}
