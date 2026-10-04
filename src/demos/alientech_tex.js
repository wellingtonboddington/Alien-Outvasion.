// Dev demo: show the procedural textures flat (albedo / normal / roughness).
import * as THREE from 'three';
import { shellTextures, fleshTextures, hullTextures, windowTexture } from '../models/alientech/tex.js';
export default async function setup(stage, params) {
  stage.scene.background = new THREE.Color(0x202020);
  const sets = { shell: shellTextures(), flesh: fleshTextures(), hull: hullTextures() };
  const which = params.which || 'shell';
  const s = sets[which];
  const items = [s.map, s.normal, s.orm, windowTexture(1)];
  items.forEach((tx, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); m.position.set((i % 2) - 0.5, 0.5 - Math.floor(i / 2), 0); tx.repeat.set(2, 2); stage.scene.add(m); });
  stage.camera.position.set(0, 0, 1.55); stage.camera.lookAt(0, 0, 0);
  return { shots: [{ name: which, t: 0, fov: 60 }] };
}
