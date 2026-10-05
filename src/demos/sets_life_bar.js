// params: {"which":"bar"|"apartment"|"hospital"|"pharmacy"|"courtroom"|"office"|"terminal"|"sanct"|"all"}  (all = one shot per set, t=i+0.5)
import * as THREE from 'three';
import * as L from '../world/sets/life.js';
export default async function setup(stage, params) {
  const which = params.which || 'bar'; stage.scene.background = null;
  const F = { bar: L.createBar, apartment: L.createApartment, hospital: L.createHospital, pharmacy: L.createPharmacy, courtroom: L.createCourtroom, office: L.createLawOffice, terminal: L.createJeepneyTerminal, sanct: () => { const s = L.createSanctuary(); s.setMode('interior'); return s; } };
  const CAM = { sanct: 'camInWide', terminal: 'camMid' };
  const names = which === 'all' ? Object.keys(F) : [which]; const sets = names.map((n) => F[n]()); const shots = [];
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.position.set(-20, 30, 25); stage.scene.add(sun);
  sets.forEach((set, i) => { stage.scene.add(set.root); const a = set.anchors; const keys = which === 'all' ? [params.cam || CAM[names[i]] || 'camWide'] : (params.cams ? params.cams.split(',') : ['camWide', 'camMid']); keys.forEach((k) => shots.push({ name: names[i] + '_' + k, t: shots.length + 0.5, set: i, cam: [...a[k].pos, ...a[k].look], fov: 68 })); });
  return { update(t, dt) { const cur = shots.find((s) => s.t > t - 1e-6)?.set ?? 0; sets.forEach((s, i) => { s.root.visible = i === cur; s.update(dt, t); }); sun.visible = names[cur] === 'terminal'; stage.scene.background = names[cur] === 'terminal' ? new THREE.Color(0x9cc6ee) : null; }, shots, sets };
}
