// Debug contact sheet: one agent of a kind in every state, side by side.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createCrowd, STATE } from '../models/crowd.js';
import { STATE_NAMES } from '../models/crowd/rig.js';

export default async function setup(stage, params = {}) {
  addStudioLights(stage, { shadows: true });
  const kind = params.kind || 'soldier';
  const crowd = createCrowd(kind, 40, { seed: params.seed || 3, castShadow: true });
  stage.scene.add(crowd.root);
  const names = params.states || STATE_NAMES;
  const gap = params.gap || 1.7;
  names.forEach((n, i) => {
    crowd.set(i, { x: (i - (names.length - 1) / 2) * gap, y: 0, z: 0, yaw: params.yaw ?? 0.0, state: n, seed: params.seeds ? params.seeds[i % params.seeds.length] : 0.31 + (i % 2) * 0.4, phase: i * 0.13, scale: 1, age: 'adult', sex: params.sex ?? 0 });
  });
  crowd.setCount(names.length); crowd.commit();
  const T = params.t ?? 1.3;
  const cx = 0, span = (names.length - 1) * gap / 2;
  return {
    update(t, dt) { crowd.update(dt, t); },
    shots: params.shots || [{ name: 'front', t: T, cam: [0, 1.5, 8 + span * 0.9, 0, 0.9, 0], fov: 42 }, { name: 'side', t: T + 0.4, cam: [8 + span, 1.4, 0.0, 0, 0.9, 0], fov: 42 }],
  };
}
