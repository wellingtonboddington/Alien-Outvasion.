// Tiny test world for the FX demos: ground, skyline boxes with lit windows, sun + hemisphere light, sky colour/fog.
import * as THREE from 'three';
import { RNG } from '../engine/common.js';
import { canvasTex, paintNoise, speckle, normalTex } from '../engine/proc.js';

const PRESETS = {
  day: { sky: 0x8fb0d8, fog: 0xa9c0da, fogD: 0.0022, sun: 0xfff0d8, sunI: 3.0, sunPos: [60, 90, 40], hemiSky: 0xbfd6ff, hemiGnd: 0x4a4038, hemiI: 0.9, win: 0.0, ground: 0x9a9da3 },
  dusk: { sky: 0x3a2f4c, fog: 0x5a3f48, fogD: 0.004, sun: 0xff9a5a, sunI: 2.4, sunPos: [90, 28, -30], hemiSky: 0x6a6fa8, hemiGnd: 0x2a2020, hemiI: 0.45, win: 0.5, ground: 0x3c3c40 },
  night: { sky: 0x05070f, fog: 0x070a14, fogD: 0.0035, sun: 0x6c88c8, sunI: 0.5, sunPos: [-40, 70, 30], hemiSky: 0x1a2440, hemiGnd: 0x0a0a10, hemiI: 0.35, win: 1.0, ground: 0x1c1d22 },
  overcast: { sky: 0x6a7078, fog: 0x777d86, fogD: 0.007, sun: 0xd8dde8, sunI: 1.2, sunPos: [30, 80, 50], hemiSky: 0x9aa6b8, hemiGnd: 0x3a3a3a, hemiI: 0.9, win: 0.1, ground: 0x45474a },
  space: { sky: 0x000004, fog: null, fogD: 0, sun: 0xffffff, sunI: 2.5, sunPos: [60, 40, 80], hemiSky: 0x202838, hemiGnd: 0x000000, hemiI: 0.15, win: 0, ground: null },
};

function windowTexture(seed, lit) {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2b2e34'; ctx.fillRect(0, 0, w, h); paintNoise(ctx, w, h, { scale: 6, a: '#23262c', b: '#3a3e46', contrast: 1.2, blend: true, alpha: 0.6 });
    const r = new RNG(seed);
    for (let y = 8; y < h - 8; y += 22) for (let x = 8; x < w - 8; x += 20) {
      const on = r.next() < lit; ctx.fillStyle = on ? (r.next() < 0.5 ? '#ffd9a0' : '#bfe0ff') : '#12161c'; ctx.fillRect(x, y, 11, 14);
    }
  }, { repeat: [1, 1], srgb: true });
}

export function createDemoWorld(stage, { preset = 'day', buildings = true, ground = true, radius = 160, seed = 3, fog = true } = {}) {
  const P = PRESETS[preset] || PRESETS.day; const scene = stage.scene; const g = new THREE.Group(); g.name = 'demoWorld';
  scene.background = new THREE.Color(P.sky);
  if (fog && P.fog !== null) scene.fog = new THREE.FogExp2(P.fog, P.fogD);
  const sun = new THREE.DirectionalLight(P.sun, P.sunI); sun.position.set(...P.sunPos); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 5; c.far = 400; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  const hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGnd, P.hemiI); g.add(sun, hemi);
  let groundMesh = null;
  if (ground && P.ground !== null) {
    const map = canvasTex(512, 512, (ctx, w, h) => { paintNoise(ctx, w, h, { scale: 8, a: '#797b80', b: '#b0b2b8', contrast: 1.3 }); speckle(ctx, w, h, { count: 4000, colors: ['#222', '#888'], alpha: [0.1, 0.4] });
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6; ctx.setLineDash([36, 28]); ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke(); }, { repeat: [60, 60] });
    groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map, color: P.ground, roughness: 0.92 })); groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; groundMesh.name = 'demoGround'; g.add(groundMesh);
  }
  if (buildings) {
    const r = new RNG(seed); const tex = windowTexture(seed, P.win * 0.55 + 0.05);
    for (let i = 0; i < 60; i++) {
      const a = r.range(0, Math.PI * 2), d = radius * r.range(0.5, 1.5); const w = r.range(10, 26), h = r.range(18, 90), dd = r.range(10, 24);
      const m = new THREE.MeshStandardMaterial({ map: tex, color: 0x9aa0a8, roughness: 0.8, metalness: 0.1, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: P.win * 0.9 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), m); b.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d - 20); b.rotation.y = a + 1.2; b.castShadow = true; b.receiveShadow = true;
      b.material.map = tex.clone(); b.material.map.repeat.set(w / 20, h / 40); b.material.map.needsUpdate = true; b.material.emissiveMap = b.material.map; g.add(b);
    }
  }
  scene.add(g);
  return { group: g, sun, hemi, ground: groundMesh, preset: P, dispose() { scene.remove(g); } };
}

/** star dots for space demos */
export function createStars(scene, n = 1500, radius = 4000, seed = 5) {
  const r = new RNG(seed); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = r.unit(); pos.set([u.x * radius, u.y * radius, u.z * radius], i * 3); const b = r.range(0.4, 1.6); col.set([b, b * r.range(0.85, 1), b * r.range(0.9, 1.1)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, vertexColors: true, sizeAttenuation: false, fog: false, toneMapped: false })); p.name = 'stars'; scene.add(p); return p;
}
