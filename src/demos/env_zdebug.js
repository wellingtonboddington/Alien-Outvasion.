import * as THREE from 'three';
import { vegAtlas } from '../world/env/vegAtlas.js';
export default async function setup(stage) {
  const { scene, camera } = stage; scene.background = new THREE.Color(0xff00ff);
  const tex = vegAtlas();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  scene.add(m); camera.position.set(0, 0, 2.6); camera.fov = 40; camera.lookAt(0, 0, 0);
  return { update() {}, shots: [{ name: 'atlas', t: 0 }] };
}
