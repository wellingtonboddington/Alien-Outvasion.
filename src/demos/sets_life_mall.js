import * as THREE from 'three';
import * as L from '../world/sets/life.js';
const mk = (stage, which) => {
  const set = which === 'ca' ? L.createMcDCalifornia() : L.createFoodCourtMcD();
  stage.scene.add(set.root);
  return set;
};
export default async function setup(stage, params) {
  const which = params.which || 'mcd';
  const set = mk(stage, which);
  stage.scene.background = new THREE.Color(which === 'ca' ? 0x8fc0ee : 0x0a0a0c);
  if (which === 'ca') { const sun = new THREE.DirectionalLight(0xfff0d8, 3); sun.position.set(30, 40, 20); stage.scene.add(sun); stage.scene.fog = new THREE.Fog(0xbcd8f0, 120, 400); }
  const a = set.anchors; const sh = (name, key, fov = 60, t = 0.5) => ({ name, t, cam: [...a[key].pos, ...a[key].look], fov });
  const shots = which === 'ca'
    ? [sh('lot', 'camLot', 55), sh('lotwide', 'camLotWide', 60), sh('drive', 'camDriveThru', 55), sh('counter', 'camCounter', 60), sh('wide', 'camWide', 65), sh('kitchen', 'camKitchen', 60)]
    : [sh('wide', 'camWide', 62), sh('counter', 'camCounter', 58), sh('counterLow', 'camCounterLow', 52), sh('kitchen', 'camKitchen', 62), sh('behind', 'camBehind', 62), sh('tv', 'camTV', 55), sh('window', 'camWindow', 60), sh('booth', 'camBooth', 60)];
  return { update(t, dt) { set.update(dt, t); }, shots, set };
}
