// shared helper for the sets_inst_* demos (not a demo itself)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function prepStage(stage, { bg = 0x040508, env = 0.22, fog = null } = {}) {
  const pm = new THREE.PMREMGenerator(stage.renderer);
  const e = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  stage.scene.environment = e; stage.scene.environmentIntensity = env; stage.scene.background = new THREE.Color(bg);
  if (fog) stage.scene.fog = new THREE.FogExp2(fog[0], fog[1]);
  return e;
}
/** build a shot list from anchor-style camera defs: [name, t, [x,y,z], [tx,ty,tz], fov] */
export const shot = (name, t, from, to, fov = 50) => ({ name, t, cam: [...from, ...to], fov });
