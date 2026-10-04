// Shared helpers for the city demos (sky, lights, bloom). Not a demo itself.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const PRESETS = {
  day: { zenith: 0x2f6fc0, horizon: 0xcfe0f2, ground: 0x8a8a80, sunEl: 48, sunAz: 40, sun: 3.0, sunCol: 0xfff2dc, hemi: 0.85, env: 0.75, fog: 0xc8d8ea, fogD: 0.0008 },
  haze: { zenith: 0x7c9ab8, horizon: 0xe8d8b8, ground: 0x8a7a60, sunEl: 40, sunAz: 40, sun: 2.4, sunCol: 0xffe2b0, hemi: 0.6, env: 0.5, fog: 0xd8c8a8, fogD: 0.0022 },
  dusk: { zenith: 0x28305a, horizon: 0xf09050, ground: 0x302830, sunEl: 7, sunAz: 40, sun: 2.4, sunCol: 0xffa060, hemi: 0.35, env: 0.4, fog: 0xc89070, fogD: 0.0012 },
  night: { zenith: 0x02040c, horizon: 0x1a2438, ground: 0x0a0c10, sunEl: 38, sunAz: 200, sun: 0.28, sunCol: 0x7e9ce8, hemi: 0.18, env: 0.16, fog: 0x0c1220, fogD: 0.0012 },
  overcast: { zenith: 0x8a929a, horizon: 0xc0c6cc, ground: 0x707478, sunEl: 55, sunAz: 40, sun: 1.0, sunCol: 0xe8eef4, hemi: 0.9, env: 0.7, fog: 0xbcc4cc, fogD: 0.0016 },
  snow: { zenith: 0xaab4c0, horizon: 0xe0e6ec, ground: 0xdde2e8, sunEl: 22, sunAz: 40, sun: 1.6, sunCol: 0xfff0e0, hemi: 0.95, env: 0.75, fog: 0xd4dce4, fogD: 0.0022 },
  smoke: { zenith: 0x3a2a22, horizon: 0xc06a30, ground: 0x2a2018, sunEl: 12, sunAz: 40, sun: 1.6, sunCol: 0xff8a3a, hemi: 0.4, env: 0.35, fog: 0x6a4028, fogD: 0.0035 },
};
export function setupSky(stage, preset = 'day', { shadow = 90, fogScale = 1 } = {}) {
  const p = PRESETS[preset] || PRESETS.day; const { scene, renderer } = stage;
  const sky = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zen: { value: new THREE.Color(p.zenith) }, hor: { value: new THREE.Color(p.horizon) }, gnd: { value: new THREE.Color(p.ground) }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color(p.sunCol) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vD; uniform vec3 zen,hor,gnd,sunCol,sunDir; void main(){ float h = vD.y; vec3 c = mix(hor, zen, pow(clamp(h,0.0,1.0),0.5)); c = mix(c, gnd, smoothstep(0.0,-0.25,h)); float s = max(dot(normalize(vD), sunDir),0.0); c += sunCol * (pow(s,600.0)*8.0 + pow(s,12.0)*0.35 + pow(s,3.0)*0.06); gl_FragColor = vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat); dome.frustumCulled = false; sky.add(dome);
  const el = p.sunEl * Math.PI / 180, az = p.sunAz * Math.PI / 180; const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)); mat.uniforms.sunDir.value.copy(dir);
  const bg = new THREE.Mesh(new THREE.SphereGeometry(4800, 32, 16), mat); bg.frustumCulled = false; bg.renderOrder = -10; bg.material = mat.clone(); bg.material.uniforms = THREE.UniformsUtils.clone(mat.uniforms); bg.material.uniforms.sunDir.value.copy(dir); bg.material.depthTest = false; scene.add(bg);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(sky, 0.02).texture; pm.dispose(); scene.environment = env; scene.environmentIntensity = p.env;
  scene.fog = new THREE.FogExp2(p.fog, p.fogD * fogScale);
  const sun = new THREE.DirectionalLight(p.sunCol, p.sun); sun.position.copy(dir.clone().multiplyScalar(300)); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = -shadow; c.right = shadow; c.top = shadow; c.bottom = -shadow; c.near = 10; c.far = 700; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4;
  const hemi = new THREE.HemisphereLight(p.horizon, p.ground, p.hemi); scene.add(sun, sun.target, hemi);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 48), new THREE.MeshStandardMaterial({ color: preset === 'snow' ? 0xdfe5ea : 0x5a604a, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
  return { sun, hemi, dir, ground, preset: p, bg, setTarget(v) { sun.target.position.copy(v); sun.position.copy(v).addScaledVector(dir, 300); sun.target.updateMatrixWorld(); } };
}
export function bloomRenderer(stage, { strength = 0.7, radius = 0.5, threshold = 0.85 } = {}) {
  const { renderer, scene, camera } = stage; const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer); composer.setSize(size.x, size.y); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(size, strength, radius, threshold)); composer.addPass(new OutputPass());
  return () => composer.render();
}
