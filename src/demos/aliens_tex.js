// Texture preview: shell / skin / membrane / mouth maps (colour + normal) as unlit quads.
import * as THREE from 'three';
import { shellMaps, skinMaps, membraneMaps, mouthMaps } from '../models/aliens/textures.js';
export default async function setup(stage) {
  stage.scene.background = new THREE.Color(0x202020);
  const sets = [shellMaps(), skinMaps(), membraneMaps(), mouthMaps()]; const g = new THREE.PlaneGeometry(1, 1);
  sets.forEach((s, i) => {
    const a = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: s.map, toneMapped: false })); a.position.set(i * 1.05 - 1.6, 0.55, 0);
    const b = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: s.normalMap, toneMapped: false })); b.position.set(i * 1.05 - 1.6, -0.55, 0);
    stage.scene.add(a, b);
  });
  return { update() {}, shots: [{ name: 'maps', t: 0, cam: [0, 0, 4.2, 0, 0, 0], fov: 33 }] };
}
