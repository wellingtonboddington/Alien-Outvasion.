// Debug viewer: one Vessari kind / clip from arbitrary cameras.  --params '{"kind":"soldier","clip":"idle","inf":0}'
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createVessari } from '../models/aliens/index.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: true });
  const kind = params.kind || 'soldier'; const h = createVessari(kind, params.seed || 3, params.opts || {});
  stage.scene.add(h.root); h.play(params.clip || 'idle', { time: 0 }); if (params.inf) h.setInfection(params.inf); if (params.blood) h.setBloody(params.blood);
  if (params.mouth) h.setMouth(params.mouth); if (params.look) h.lookAt(new THREE.Vector3(...params.look));
  if (params.hold !== undefined) h.hold(params.hold ? 'rifle' : null);
  return { update(t, dt) { h.update(dt, t); }, shots: params.shots || [
    { name: 'front', t: 0.5, cam: [0, 1.5, 6.5, 0, 1.3, 0], fov: 32 },
    { name: 'side', t: 0.5, cam: [6.5, 1.5, 0.6, 0, 1.3, 0], fov: 32 },
    { name: 'face', t: 0.5, cam: [1.1, 2.6, 2.0, 0, 2.4, 0.3], fov: 30 },
  ] };
}
