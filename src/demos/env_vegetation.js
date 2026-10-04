// env_vegetation: kind gallery + palm grove at golden hour (backlit translucency, wind sway).
//   node tools/render.mjs --demo env_vegetation --out out/env_veg [--q 0]
import * as THREE from 'three';
import { createSky } from '../world/sky.js';
import { createTerrain } from '../world/terrain.js';
import { createVegetation, scatterVegetation, setWind } from '../world/vegetation.js';

export default async function setup(stage, params = {}) {
  const { scene, camera } = stage;
  camera.near = 0.3; camera.far = 6000; camera.fov = 40; camera.updateProjectionMatrix();
  const sky = createSky('goldenHour'); sky.applyTo(scene);
  const roots = []; let terr = null; let cur = '';
  const clear = () => { for (const r of roots) { scene.remove(r.root || r); r.dispose && r.dispose(); } roots.length = 0; if (terr) { scene.remove(terr.root); terr.dispose(); terr = null; } };
  const add = (o) => { scene.add(o.root); roots.push(o); return o; };

  function gallery(which) {
    clear();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: 0x6a7a45, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground); roots.push({ root: ground, dispose() { ground.geometry.dispose(); ground.material.dispose(); } });
    const sets = which === 'a' ? [['coconut', {}], ['palm', {}], ['fanpalm', {}], ['tree', { variant: 'tropical' }], ['tree', { variant: 'deciduous' }], ['tree', { variant: 'autumn' }], ['tree', { variant: 'bare' }], ['tree', { variant: 'birch' }]]
      : [['pine', { variant: 'spruce' }], ['pine', { variant: 'scots' }], ['bush', {}], ['bush', { variant: 'flowering' }], ['grass', {}], ['grass', { variant: 'dry' }], ['banana', {}], ['acacia', {}]];
    sets.forEach(([k, o], i) => { const v = createVegetation(k, o); v.mesh.position.set((i - 3.5) * 10, 0, 0); if (k === 'grass') { v.mesh.scale.setScalar(3); } add(v); });
    sky.setShadowFocus(new THREE.Vector3(0, 4, 0), 50);
  }
  function grove() {
    clear();
    terr = createTerrain({ style: 'tropical', size: 3200, seed: 4, flatRadius: 30, layout: 'coast', seaAngle: 4.2, shoreDistance: 260, flatHeight: 2.3 }); scene.add(terr.root);
    const sh = terr.shorePoint(0, {});
    const area = { cx: sh.x - sh.nx * 55, cz: sh.z - sh.nz * 55, radius: 80 };
    add(scatterVegetation(terr, 'coconut', 90, area, 3, { minDist: 4.2 }));
    add(scatterVegetation(terr, 'palm', 14, { cx: area.cx - sh.nx * 40, cz: area.cz - sh.nz * 40, radius: 70 }, 5));
    add(scatterVegetation(terr, 'bush', 120, { cx: area.cx - sh.nx * 20, cz: area.cz - sh.nz * 20, radius: 85 }, 7, { variant: 'flowering' }));
    add(scatterVegetation(terr, 'grass', 1500, area, 9, { scale: [0.9, 1.6] }));
    add(scatterVegetation(terr, 'banana', 30, { cx: area.cx - sh.nx * 90, cz: area.cz - sh.nz * 90, radius: 60 }, 11));
    add(scatterVegetation(terr, 'tree', 24, { cx: area.cx - sh.nx * 110, cz: area.cz - sh.nz * 110, radius: 80 }, 13, { variant: 'tropical' }));
    sky.setShadowFocus(new THREE.Vector3(sh.x - sh.nx * 40, 2, sh.z - sh.nz * 40), 70);
    return sh;
  }
  let shore = null;
  const demo = {
    update(t, dt) { sky.update(dt, t); },
    onShot(s, t) {
      if (s.mode !== cur) { cur = s.mode; if (cur === 'galA') gallery('a'); else if (cur === 'galB') gallery('b'); else shore = grove(); }
      if (s.preset) sky.setPreset(s.preset); if (s.wind !== undefined) setWind(s.wind, 0.4);
      if (s.mode === 'grove' && shore && s.camRel) { const c = s.camRel; const nx = shore.nx, nz = shore.nz, tx = -nz, tz = nx; // coast frame: n = seaward, t = along
        const px = shore.x + nx * c[0] + tx * c[1], pz = shore.z + nz * c[0] + tz * c[1]; const lx = shore.x + nx * c[3] + tx * c[4], lz = shore.z + nz * c[3] + tz * c[4];
        camera.position.set(px, terr.heightAt(px, pz) + c[2], pz); camera.lookAt(lx, terr.heightAt(lx, lz) + c[5], lz); }
      sky.update(0, 20 + t);
    },
    shots: [
      { name: 'galA', t: 0, mode: 'galA', preset: 'day', wind: 0.4, cam: [0, 7, 52, 0, 5, 0], fov: 38 },
      { name: 'galB', t: 1, mode: 'galB', preset: 'day', wind: 0.4, cam: [0, 6, 46, 0, 4, 0], fov: 38 },
      { name: 'grove', t: 2, mode: 'grove', preset: 'goldenHour', wind: 0.5, camRel: [-150, 10, 1.8, 20, 0, 9], fov: 45 },
      { name: 'grove_wide', t: 3, mode: 'grove', preset: 'goldenHour', wind: 0.5, camRel: [60, 70, 6, -60, -10, 4], fov: 50 },
    ],
  };
  return demo;
}
