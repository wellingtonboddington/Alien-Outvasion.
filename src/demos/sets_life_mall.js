// params: {"which":"atrium"|"mcd"|"ca"}  (default atrium)
import * as THREE from 'three';
import * as L from '../world/sets/life.js';
export default async function setup(stage, params) {
  const which = params.which || 'atrium';
  const set = which === 'ca' ? L.createMcDCalifornia() : which === 'mcd' ? L.createFoodCourtMcD() : L.createMallInterior();
  stage.scene.add(set.root);
  stage.scene.background = new THREE.Color(which === 'ca' ? 0x8fc0ee : 0x0a0a0c);
  if (which === 'ca') { const sun = new THREE.DirectionalLight(0xfff0d8, 3); sun.position.set(30, 40, 20); stage.scene.add(sun); stage.scene.fog = new THREE.Fog(0xbcd8f0, 120, 400); }
  const a = set.anchors; const sh = (name, key, fov = 60, t = 0.5) => ({ name, t, cam: [...a[key].pos, ...a[key].look], fov });
  const shots = which === 'ca'
    ? [sh('lot', 'camLot', 55), sh('lotwide', 'camLotWide', 60), sh('drive', 'camDriveThru', 55), sh('counter', 'camCounter', 60), sh('wide', 'camWide', 65)]
    : which === 'mcd'
      ? [sh('wide', 'camWide', 62), sh('counter', 'camCounter', 58), sh('kitchen', 'camKitchen', 62), sh('tv', 'camTV', 55), sh('window', 'camWindow', 60)]
      : [sh('wide', 'camWide', 62), sh('up', 'camAtriumUp', 70), sh('esc', 'camEscalator', 62), sh('balcony', 'camBalcony', 62), sh('shops', 'camShops', 60), sh('entrance', 'camEntrance', 62)];
  return { update(t, dt) { set.update(dt, t); }, shots, set };
}
