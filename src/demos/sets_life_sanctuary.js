// exterior aerial + gate + interior shots. update(t) switches the set mode by time so one scene serves both.
import * as THREE from 'three';
import * as L from '../world/sets/life.js';
export default async function setup(stage, params) {
  const set = L.createSanctuary(); stage.scene.add(set.root);
  stage.scene.background = new THREE.Color(0x9cc6ee); stage.scene.fog = new THREE.Fog(0xcfe0f0, 220, 700);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.8); sun.position.set(80, 120, 60); stage.scene.add(sun); const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6a6048, 0.5); stage.scene.add(hemi);
  const a = set.anchors; const spec = params.cams ? params.cams.split(',') : ['camWide:0.5', 'camGate:1', 'camInWide:10', 'camHolo:11', 'camLine:12'];
  const shots = spec.map((s) => { const [k, t] = s.split(':'); return { name: k, t: +t, cam: [...a[k].pos, ...a[k].look], fov: k === 'camWide' ? 50 : 62 }; });
  let hid = false;
  return { update(t, dt) { const inside = t >= 9; if (inside !== hid || t === 0) { hid = inside; set.setMode(inside ? 'interior' : 'exterior'); sun.visible = hemi.visible = !inside; stage.scene.background = new THREE.Color(inside ? 0x050508 : 0x9cc6ee); stage.scene.fog = inside ? null : new THREE.Fog(0xcfe0f0, 220, 700); } set.update(dt, t); }, shots, set };
}
