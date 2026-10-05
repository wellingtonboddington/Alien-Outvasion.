import * as THREE from 'three';
import * as L from '../world/sets/life.js';
export default async function setup(stage, params) {
  const set = L.createJeepneyTerminal(); stage.scene.add(set.root);
  stage.scene.background = new THREE.Color(0x9cc6ee); stage.scene.fog = new THREE.Fog(0xcfe0f0, 90, 300);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.position.set(-20, 30, 25); stage.scene.add(sun);
  const a = set.anchors; const keys = params.cams ? params.cams.split(',') : ['camWide', 'camBays', 'camVendors', 'camHigh'];
  const shots = keys.map((k) => ({ name: k, t: 0.5, cam: [...a[k].pos, ...a[k].look], fov: 62 }));
  return { update(t, dt) { set.update(dt, t); }, shots, set };
}
