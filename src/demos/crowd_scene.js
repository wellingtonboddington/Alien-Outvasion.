// Shared street-like test scene for the crowd demos (ground, sidewalks, boxy buildings, sun + hemisphere + fog).
import * as THREE from 'three';
import { RNG } from '../engine/common.js';
import { canvasTex, paintNoise, speckle } from '../engine/proc.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function makeStreetScene(stage, { fog = 0.0045, skyTop = 0x8aa4c8, skyBottom = 0xd8d4c8, sunColor = 0xfff0d8, sunI = 3.0, hemi = 0.55, length = 400, width = 26, buildings = true, seed = 5, cold = false, ground = null, sunDir = [-0.5, 0.75, 0.45] } = {}) {
  const { scene, renderer } = stage;
  scene.background = new THREE.Color(skyBottom);
  scene.fog = new THREE.FogExp2(skyBottom, fog);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environment = env; scene.environmentIntensity = 0.35;
  const hemiL = new THREE.HemisphereLight(skyTop, 0x4a4238, hemi); scene.add(hemiL);
  const sun = new THREE.DirectionalLight(sunColor, sunI); sun.position.set(...sunDir).multiplyScalar(80); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 220; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);
  const asphalt = canvasTex(256, 256, (ctx, w, h) => { paintNoise(ctx, w, h, { scale: 8, oct: 4, a: cold ? '#4a4e54' : '#3c3c3e', b: cold ? '#6a6e74' : '#5e5c58', contrast: 1.3 }); speckle(ctx, w, h, { count: 4000, colors: ['#222', '#888'], alpha: [0.1, 0.35] }); }, { repeat: [width / 3, length / 3] });
  const gmat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, color: 0xffffff });
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(width, length * 2), gmat); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(600, length * 2), new THREE.MeshStandardMaterial({ color: cold ? 0xdfe6ee : 0x5a5848, roughness: 1 })); verge.rotation.x = -Math.PI / 2; verge.position.y = -0.02; verge.receiveShadow = true; scene.add(verge);
  // lane markings
  const mark = new THREE.MeshStandardMaterial({ color: 0xd8d0b0, roughness: 0.8 });
  for (let z = -length; z < length; z += 8) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3.5), mark); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, z); scene.add(m); }
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18, length * 2), mark); m.rotation.x = -Math.PI / 2; m.position.set(sx * (width / 2 - 1.2), 0.012, 0); scene.add(m); }
  if (buildings) {
    const r = new RNG(seed);
    const win = canvasTex(128, 256, (ctx, w, h) => { ctx.fillStyle = '#9a948a'; ctx.fillRect(0, 0, w, h); for (let y = 8; y < h - 8; y += 24) for (let x = 8; x < w - 8; x += 22) { ctx.fillStyle = r.chance(0.3) ? '#d8c890' : '#2a3038'; ctx.fillRect(x, y, 12, 14); } }, { repeat: [1, 1] });
    const bmat = new THREE.MeshStandardMaterial({ map: win, roughness: 0.9, color: 0xffffff });
    const geos = [];
    for (const sx of [-1, 1]) {
      let z = -length;
      while (z < length * 0.6) {
        const w = r.range(10, 20), d = r.range(14, 28), h = r.range(14, 46); const x = sx * (width / 2 + 3 + w / 2 + r.range(0, 4));
        const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 10), uv.getY(i) * (h / 12));
        g.translate(x, h / 2, z + d / 2); geos.push(g); z += d + r.range(1, 5);
      }
    }
    const merged = new THREE.Mesh(mergeG(geos), bmat); merged.castShadow = true; merged.receiveShadow = true; scene.add(merged);
  }
  return { sun, hemi: hemiL, ground: gnd, follow(x, z) { sun.target.position.set(x, 0, z); sun.position.set(x, 0, z).add(new THREE.Vector3(...sunDir).multiplyScalar(80)); sun.target.updateMatrixWorld(); } };
}
function mergeG(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const p = new Float32Array(nv * 3), n = new Float32Array(nv * 3), u = new Float32Array(nv * 2), idx = new Uint32Array(ni); let vo = 0, io = 0;
  for (const g of list) { p.set(g.attributes.position.array, vo * 3); n.set(g.attributes.normal.array, vo * 3); u.set(g.attributes.uv.array, vo * 2); for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; vo += g.attributes.position.count; io += g.index.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(p, 3)); m.setAttribute('normal', new THREE.BufferAttribute(n, 3)); m.setAttribute('uv', new THREE.BufferAttribute(u, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m;
}
