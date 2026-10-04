// env_sky: every sky preset over a ground plane with reference objects (contact sheet + individual beauty shots).
//   node tools/render.mjs --demo env_sky --out out/env_sky [--q 0]
import * as THREE from 'three';
import { createSky, SKY_PRESETS } from '../world/sky.js';

export default async function setup(stage, params = {}) {
  const { scene, camera, renderer } = stage;
  camera.near = 0.3; camera.far = 8000; camera.fov = 45; camera.updateProjectionMatrix();
  const sky = createSky(params.preset || 'day');
  sky.applyTo(scene);
  sky.setShadowFocus(new THREE.Vector3(0, 0, 0), 24);

  // ground + reference props
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6000, 64), new THREE.MeshStandardMaterial({ color: 0x55633f, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const props = new THREE.Group(); scene.add(props);
  const white = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 1 });
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16), i === 2 ? chrome : white); s.position.set((i - 2) * 2.4, 0.9, 0); s.castShadow = s.receiveShadow = true; props.add(s); }
  const tall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), white); tall.position.set(-8, 4.5, -3); tall.castShadow = true; props.add(tall);
  const tall2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 16), white); tall2.position.set(7, 3, -4); tall2.castShadow = true; props.add(tall2);
  // distant hills to test fog / horizon
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x35452f, roughness: 1 });
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const r = 1500 + (i % 3) * 700; const h = new THREE.Mesh(new THREE.ConeGeometry(260 + (i % 5) * 80, 110 + (i % 4) * 70, 7), hillMat); h.position.set(Math.cos(a) * r, 40, Math.sin(a) * r); scene.add(h); }

  const cells = [['day', 0], ['dawn', 0], ['goldenHour', 0], ['dusk', 0], ['night', 0], ['overcast', 0], ['storm', 0.0], ['smoke', 0], ['dayHaze', 0], ['coldMorning', 0], ['storm', 1], ['night', 1]];
  let sheet = false, cur = null;
  const aspectCache = {};
  const camPos = new THREE.Vector3(0, 2.0, 11);

  function look(az, elev = 12) { const a = az * Math.PI / 180; camera.position.copy(camPos); camera.lookAt(camPos.x + Math.sin(a) * 50, camPos.y + Math.tan(elev * Math.PI / 180) * 50, camPos.z + Math.cos(a) * 50); }

  const demo = {
    update(t, dt) { sky.update(dt, t); },
    onShot(s, t) {
      sheet = s.name === 'sheet'; cur = s;
      if (!sheet) {
        sky.setPreset(s.preset || 'day'); if (s.storm) sky.setStorm(s.storm); else sky.setStorm(0);
        sky.setShadowFocus(new THREE.Vector3(0, 0, 0), 24);
        sky.update(0, t + 7);
      }
    },
    render(st) {
      const W = st.width, H = st.height;
      if (!sheet) { st.renderer.render(scene, camera); return; }
      const cols = 4, rows = 3; const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
      renderer.setScissorTest(true);
      cells.forEach(([name, extra], i) => {
        const cx = (i % cols) * cw, cy = H - (Math.floor(i / cols) + 1) * ch;
        sky.setPreset(name); sky.setStorm(name === 'storm' && extra ? 1 : 0);
        if (name === 'storm') sky.lightning.enabled = true;
        sky.setShadowFocus(new THREE.Vector3(0, 0, 0), 24);
        sky.update(0, 50 + i * 3.1 + (extra ? 4.6 : 0));
        camera.aspect = cw / ch; camera.updateProjectionMatrix();
        look(name === 'night' && extra ? 135 : (name === 'dawn' ? 85 : name === 'goldenHour' ? 255 : name === 'dusk' ? 285 : 150), name === 'night' ? 30 : 14);
        renderer.setViewport(cx, cy, cw, ch); renderer.setScissor(cx, cy, cw, ch);
        renderer.render(scene, camera);
      });
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
      camera.aspect = W / H; camera.updateProjectionMatrix();
    },
    shots: [
      { name: 'sheet', t: 0 },
      { name: 'day', t: 1, preset: 'day', cam: [0, 2, 11, 0, 40, 60] },
      { name: 'golden', t: 2, preset: 'goldenHour', cam: [0, 2, 11, -40, 18, -60] },
      { name: 'night', t: 3, preset: 'night', cam: [0, 2, 11, 40, 55, -50] },
      { name: 'storm', t: 4, preset: 'storm', storm: 1, cam: [0, 2, 11, 0, 30, 60] },
      { name: 'smoke', t: 5, preset: 'smoke', cam: [0, 2, 11, 0, 30, 60] },
    ],
  };
  return demo;
}
