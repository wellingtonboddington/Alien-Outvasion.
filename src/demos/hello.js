// Minimal demo: proves the harness + shared libs work.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { limb, roundedBox } from '../engine/geo.js';
import { canvasTex, paintNoise, speckle, normalTex } from '../engine/proc.js';
import { infectable, setInfection } from '../engine/infect.js';

export default async function setup(stage) {
  addStudioLights(stage);
  const map = canvasTex(256, 256, (ctx, w, h) => { paintNoise(ctx, w, h, { scale: 6, a: '#3a3f46', b: '#9aa3ad', contrast: 1.4 }); speckle(ctx, w, h, { count: 3000 }); });
  const nrm = normalTex(256, 256, (ctx, w, h) => paintNoise(ctx, w, h, { scale: 10, oct: 5 }), { strength: 4 });
  const mat = infectable(new THREE.MeshStandardMaterial({ map, normalMap: nrm, roughness: 0.5, metalness: 0.6, emissive: 0x2288ff, emissiveIntensity: 0.4 }));
  const a = new THREE.Mesh(limb(1.2, 0.18, 0.1, { bulge: 0.2 }), mat); a.position.set(-1, 0, 0); a.castShadow = true;
  const b = new THREE.Mesh(roundedBox(0.8, 0.8, 0.8, 0.12), mat); b.position.set(0.4, 0.4, 0); b.castShadow = true;
  stage.scene.add(a, b);
  stage.camera.position.set(0, 1.4, 4); stage.camera.lookAt(0, 0.6, 0);
  return { update(t) { setInfection(stage.scene, Math.min(1, t / 2)); a.rotation.y = t; }, shots: [{ name: 'a', t: 0 }, { name: 'b', t: 2 }] };
}
