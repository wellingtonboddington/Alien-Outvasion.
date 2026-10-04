// Tripod: standing, walking (IK gait with planted feet), head / cannon / tentacle close-ups, with 1.8 m human silhouettes for scale.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createTripod } from '../models/alientech/index.js';
import { RNG } from '../engine/common.js';

function humanSilhouette() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.0, 4, 8), m); body.position.y = 1.05 - 0.1; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), m); head.position.y = 1.72; g.add(head);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.7, 8), m); legs.position.y = 0.35; g.add(legs);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function gridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#3a3f3a'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#59605a'; x.lineWidth = 2; for (let i = 0; i <= 512; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = '#7a847c'; x.lineWidth = 4; x.strokeRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export default async function setup(stage, params) {
  const scene = stage.scene;
  addStudioLights(stage, { intensity: 0.55, bg: 0x6d86a6, shadows: false });
  const sun = new THREE.DirectionalLight(0xffd9a8, 3.4); sun.position.set(90, 55, 40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 300; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.2;
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.Fog(0xc9b49a, 250, 1400);
  { const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 hor = vec3(0.86,0.70,0.55); vec3 mid = vec3(0.45,0.58,0.78); vec3 top = vec3(0.16,0.28,0.55); vec3 c = h<0.0 ? hor*0.8 : mix(hor, mix(mid, top, smoothstep(0.15,0.8,h)), smoothstep(0.0,0.3,h)); gl_FragColor = vec4(c,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}` })); scene.add(sky); stage.camera.far = 8000; stage.camera.updateProjectionMatrix(); }
  const studio = scene.children.find((c) => c.getObjectByName && c.getObjectByName('studioFloor')); studio.getObjectByName('studioFloor').visible = false;
  const gt = gridTexture(); gt.repeat.set(200, 200);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95, color: 0xb0a090 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const trip = createTripod(1, params.size ? { size: params.size } : {}); scene.add(trip.root);
  const hum = []; for (let i = 0; i < 6; i++) { const h = humanSilhouette(); h.position.set(15 + (i % 2) * 6, 0, i * 34 - 6); scene.add(h); hum.push(h); }
  // a few block "buildings" for scale
  const rng = new RNG(5); const bm = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.85 });
  for (let i = 0; i < 24; i++) { const h = rng.range(30, 130); const b = new THREE.Mesh(new THREE.BoxGeometry(rng.range(18, 40), h, rng.range(18, 40)), bm); b.position.set((rng.chance(0.5) ? -1 : 1) * rng.range(70, 140), h / 2, rng.range(-80, 420)); b.castShadow = b.receiveShadow = true; scene.add(b); }
  const tgt = new THREE.Vector3(30, 8, 50), aimV = new THREE.Vector3();
  const tl = (t) => ({ speed: t < 1.0 ? 0 : t < 14 ? 3.0 : 0 });
  const prevF = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], prevPl = [true, true, true]; let maxSlide = 0, steps = 0, swingFrames = 0, lastLog = 0;
  return {
    update(t, dt) {
      trip.setGait({ speed: tl(t).speed, heading: 0 });
      if (t > 15) trip.setCannon(Math.min(1, (t - 15) / 3)); if (t > 19) trip.setCannon(0.0);
      if (t > 19.5) trip.setTentacle('reach', aimV.set(trip.root.position.x + 14, 1.5, trip.root.position.z + 22));
      if (t > 15 && t < 19) trip.aimAt(aimV.set(trip.root.position.x + 25, 2, trip.root.position.z + 45));
      trip.update(dt, t);
      if (params.debug) {
        const f = trip.footWorldPositions(); const L = trip.legsState;
        for (let i = 0; i < 3; i++) { if (L[i].planted && prevPl[i]) { const d = Math.hypot(f[i].x - prevF[i].x, f[i].z - prevF[i].z); if (t > 1.5) maxSlide = Math.max(maxSlide, d); } if (!L[i].planted && prevPl[i]) steps++; prevF[i].copy(f[i]); prevPl[i] = L[i].planted; }
        if (t - lastLog > 1.0) { lastLog = t; console.log('t=' + t.toFixed(1) + ' root z=' + trip.root.position.z.toFixed(1) + ' speed=' + trip.gaitSpeed.toFixed(2) + ' planted=' + L.map((l) => (l.planted ? 'P' : 'S')).join('') + ' maxPlantedSlide=' + maxSlide.toFixed(4) + ' steps=' + steps + ' feetZ=' + f.map((v) => v.z.toFixed(1)).join(',')); }
      }
      sun.position.set(trip.root.position.x + 90, 55, trip.root.position.z + 40); sun.target.position.copy(trip.root.position); sun.target.updateMatrixWorld();
    },
    onShot(s, t) { if (s.rel) { const p = trip.root.position; stage.camera.position.set(p.x + s.rel[0], s.rel[1], p.z + s.rel[2]); stage.camera.lookAt(p.x + s.rel[3], s.rel[4], p.z + s.rel[5]); } },
    shots: [
      { name: 'stand_front', t: 0.6, rel: [18, 10, 58, 0, 14, 0], fov: 42 },
      { name: 'walk_side_a', t: 7.0, rel: [58, 13, 4, 0, 14, 0], fov: 42 },
      { name: 'walk_side_b', t: 8.2, rel: [58, 13, 4, 0, 14, 0], fov: 42 },
      { name: 'walk_34', t: 9.4, rel: [40, 10, 46, 0, 14, 4], fov: 45 },
      { name: 'head', t: 12.0, rel: [10, 29, 24, 0, 27.5, 3], fov: 40 },
      { name: 'feet', t: 12.3, rel: [20, 5, 20, 8, 2, 8], fov: 45 },
    ],
  };
}
