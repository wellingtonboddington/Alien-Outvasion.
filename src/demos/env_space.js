// env_space: Earth from orbit (day side, night side with city lights, sunrise limb with glare), close atmosphere view, Moon, small stylised Earth.
//   node tools/render.mjs --demo env_space --out out/env_space [--q 0]
import * as THREE from 'three';
import { createEarth, createMoon, createStarfield, createSun, planetCameraRange, frameEarth } from '../world/space.js';

export default async function setup(stage) {
  const { scene, camera, renderer } = stage;
  scene.background = new THREE.Color(0x000000); scene.fog = null; scene.environment = null;
  const t0 = performance.now();
  const earth = createEarth({ radius: 6371 }); scene.add(earth.root);
  console.log('earth built in', Math.round(performance.now() - t0), 'ms; tex build', Math.round(earth.textures.ms), 'ms', earth.textures.W + 'x' + earth.textures.H);
  const stars = createStarfield({ nebula: { intensity: 0.07 } }); scene.add(stars.root);
  const sun = createSun({ size: 1 }); scene.add(sun.root); earth.setSun(sun);
  const moon = createMoon({ radius: 1737 }); moon.root.position.set(-30000, 4000, -52000); scene.add(moon.root);
  sun.occluders.push({ center: new THREE.Vector3(0, 0, 0), radius: 6371 + 160 });
  const small = createEarth({ radius: 6, seed: 3 }); small.root.position.set(500000, 0, 0); scene.add(small.root); small.root.visible = false;

  const place = (opts, sunRel) => {
    frameEarth(camera, earth, opts);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize(); const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const d = new THREE.Vector3().addScaledVector(fwd, -sunRel[0]).addScaledVector(right, sunRel[1]).addScaledVector(up, sunRel[2]).normalize();
    sun.setDirection(d); earth.setSunDirection(d);
  };
  const demo = {
    update(t, dt) { earth.update(dt, t); stars.update(dt, t); sun.update(dt, t); moon.update(dt, t); small.update(dt, t); },
    onShot(s, t) {
      earth.root.visible = !s.small; small.root.visible = !!s.small; moon.root.visible = s.moon !== false;
      camera.fov = s.fov || 40;
      if (s.frame) place(s.frame, s.sunRel || [0.4, 0.8, 0.35]);
      if (s.custom) s.custom();
      camera.updateProjectionMatrix(); earth.update(0, t); sun.update(0, t);
    },
    shots: [
      { name: 'orbit_day', t: 0, frame: { lat: 15, lon: 115, distance: 3.7 }, sunRel: [0.45, 0.85, 0.3], fov: 38, moon: false },
      { name: 'orbit_americas', t: 0.1, frame: { lat: 20, lon: -85, distance: 3.7 }, sunRel: [0.5, 0.7, 0.45], fov: 38, moon: false },
      { name: 'orbit_night', t: 0.2, frame: { lat: 30, lon: 15, distance: 3.4 }, sunRel: [-0.7, 0.25, 0.1], fov: 38, moon: false },
      { name: 'limb', t: 0.3, fov: 55, custom() {
        camera.position.set(0, 6371 + 520, 0); const sd = new THREE.Vector3(0.0, -0.1, -1).normalize(); camera.lookAt(0, 6371 + 480, -300); camera.up.set(0, 1, 0); camera.lookAt(new THREE.Vector3(0, 6371 + 120, -9000)); const r = planetCameraRange(6371, 6371 + 520); camera.near = 2; camera.far = 6e5; sun.setDirection(new THREE.Vector3(0.18, 0.02, -1).normalize()); earth.setSunDirection(sun.direction); earth.setRotation(0.3);
      } },
      { name: 'close_atmo', t: 0.4, frame: { lat: 12, lon: 80, distance: 1.5 }, sunRel: [0.15, 0.95, 0.1], fov: 45, moon: false, custom() { camera.lookAt(0, 6371 * 0.78, 0); } },
      { name: 'moon', t: 0.5, fov: 30, custom() {
        sun.setDirection(new THREE.Vector3(-0.6, 0.2, 0.7).normalize()); camera.position.copy(moon.root.position).add(new THREE.Vector3(2500, 600, 6200)); camera.lookAt(moon.root.position); camera.near = 20; camera.far = 4e6; } },
      { name: 'small', t: 0.6, small: true, fov: 40, custom() {
        sun.setDirection(new THREE.Vector3(0.7, 0.35, 0.6).normalize()); small.setSunDirection(sun.direction); camera.position.set(500000 + 5, 8, 22); camera.lookAt(500000, 0, 0); camera.near = 0.5; camera.far = 5000; } },
    ],
  };
  return demo;
}
