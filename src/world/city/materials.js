// Per-block material set. Textures are shared (cached), materials are cloned per block so setNight() is per-block.
import * as THREE from 'three';
import { GLOBAL, Q } from '../../engine/common.js';
import { getFacade } from './facades.js';
import { getGround, getRoof, getFoliage, getDecals, getSigns, getPoolTex } from './surfaces.js';
import { getStone, getDomeTex } from './stone.js';

const FLAME_VS = /* glsl */`
attribute vec3 color; varying vec2 vUv; varying vec3 vCol;
void main(){ vUv = uv; vCol = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FLAME_FS = /* glsl */`
uniform float uTime; uniform float uAmount; varying vec2 vUv; varying vec3 vCol;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
void main(){
  float ph = vCol.r * 17.0; float t = uTime * 2.1 + ph;
  float n = n2(vec2(vUv.x * 4.0 + ph, vUv.y * 2.5 - t)) * 0.65 + n2(vec2(vUv.x * 9.0 - ph, vUv.y * 5.0 - t * 1.7)) * 0.35;
  float y = vUv.y; float wdt = mix(0.48, 0.04, pow(y, 0.8)) * (0.7 + 0.6 * n);
  float m = smoothstep(wdt, wdt * 0.25, abs(vUv.x - 0.5)) * smoothstep(1.0, 0.05, y + (n - 0.45) * 0.55);
  float core = smoothstep(0.0, 0.6, m * (1.0 - y * 0.7));
  vec3 c = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.82, 0.35), core) * (2.2 + 1.8 * core) * vCol.g;
  gl_FragColor = vec4(c * m * uAmount, m * uAmount);
  if (gl_FragColor.a < 0.01) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const GLOW_FS = /* glsl */`
uniform float uTime; uniform float uAmount; varying vec2 vUv; varying vec3 vCol;
void main(){
  float ph = vCol.r * 17.0; float f = 0.75 + 0.25 * sin(uTime * 7.0 + ph) * sin(uTime * 3.1 + ph * 2.0) + 0.15 * sin(uTime * 13.0 + ph);
  vec2 q = vUv - 0.5; float v = smoothstep(0.7, 0.0, length(q * vec2(1.0, 1.3)));
  vec3 c = mix(vec3(0.9, 0.12, 0.0), vec3(1.0, 0.65, 0.2), v) * (1.2 + 2.2 * v) * f * vCol.g;
  gl_FragColor = vec4(c * uAmount, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class MatSet {
  constructor(opts = {}) { this.opts = opts; this.m = new Map(); this.night = 0; this.fireAmount = { value: 1 }; this.time = GLOBAL.time; }
  get(name) { let m = this.m.get(name); if (!m) { m = this.create(name); this.m.set(name, m); this.apply(name, m); } return m; }
  create(name) {
    const o = this.opts;
    if (name.startsWith('f_')) {
      const key = name.slice(2); const f = getFacade(key);
      return new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: 0xffffff, emissiveIntensity: 0, bumpMap: f.data, bumpScale: key.startsWith('shop') ? 0.12 : 0.18, roughnessMap: f.data, metalnessMap: f.data, roughness: 1, metalness: 1, vertexColors: true, envMapIntensity: 1.0 });
    }
    if (name.startsWith('r_')) {
      const key = name.slice(2); const t = getRoof(key); const metal = key === 'gi' || key === 'zinc' || key === 'green';
      return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.data, bumpScale: key === 'gi' ? 0.06 : 0.04, roughnessMap: t.data, metalnessMap: t.data, roughness: 1, metalness: metal ? 1 : 0, vertexColors: true, side: THREE.DoubleSide });
    }
    if (name.startsWith('g_')) {
      const key = name.slice(2); const t = getGround(key);
      return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.data, bumpScale: key === 'asphalt' ? 0.05 : 0.04, roughnessMap: t.data, roughness: 1, metalness: 0, vertexColors: true });
    }
    if (name.startsWith('s_') && name !== 's_dome') {
      const key = name.slice(2); const t = getStone(key);
      return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.data, bumpScale: key === 'steel' ? 0.03 : 0.1, roughnessMap: t.data, metalnessMap: t.data, roughness: 1, metalness: key === 'steel' ? 1 : 0, vertexColors: true, side: key === 'copper' ? THREE.DoubleSide : THREE.FrontSide });
    }
    switch (name) {
      case 's_dome': return new THREE.MeshStandardMaterial({ map: getDomeTex(), roughness: 0.32, metalness: 0.55, vertexColors: true, envMapIntensity: 1.3 });
      case 'copper': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55, envMapIntensity: 1.1 });
      case 'island': return new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
      case 'gold': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.3 });
      case 'bronze': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.9 });
      case 'water': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.6 });
      case 'pool': return new THREE.MeshBasicMaterial({ map: getPoolTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true });
      case 'flags': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
      case 'concrete': { const t = getGround('concrete'); return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.data, bumpScale: 0.04, roughnessMap: t.data, roughness: 1, metalness: 0, vertexColors: true }); }
      case 'plain': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
      case 'metal': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.75 });
      case 'painted': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2 });
      case 'car': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2, envMapIntensity: 1.2 });
      case 'rubble': { const t = getGround('concrete'); return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.data, bumpScale: 0.1, roughness: 1, metalness: 0, vertexColors: true, flatShading: true }); }
      case 'inner': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, emissive: 0x401000, emissiveIntensity: 0 });
      case 'paint': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      case 'glow': return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
      case 'glass': return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 });
      case 'signs': { const s = getSigns(); return new THREE.MeshStandardMaterial({ map: s.map, emissiveMap: s.emi, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.55, metalness: 0.1, vertexColors: true, side: THREE.DoubleSide }); }
      case 'foliage_canopy': case 'foliage_leafy': return new THREE.MeshStandardMaterial({ map: getFoliage('canopy'), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9, metalness: 0 });
      case 'foliage_frond': return new THREE.MeshStandardMaterial({ map: getFoliage('frond'), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.75, metalness: 0 });
      case 'foliage_banana': return new THREE.MeshStandardMaterial({ map: getFoliage('banana'), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.7, metalness: 0 });
      case 'decal': { const d = getDecals(); return new THREE.MeshStandardMaterial({ map: d.map, alphaMap: null, roughnessMap: d.data, roughness: 1, metalness: 0.0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, vertexColors: true }); }
      case 'fire': return new THREE.ShaderMaterial({ uniforms: { uTime: this.time, uAmount: this.fireAmount }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      case 'ember': return new THREE.ShaderMaterial({ uniforms: { uTime: this.time, uAmount: this.fireAmount }, vertexShader: FLAME_VS, fragmentShader: GLOW_FS, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      case 'wires': return new THREE.LineBasicMaterial({ vertexColors: true });
      default: return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    }
  }
  /** apply current night state to material */
  apply(name, m) {
    const n = this.night;
    if (name.startsWith('f_')) m.emissiveIntensity = n * (name.startsWith('f_shop') ? 1.7 : 2.1);
    else if (name === 'signs') m.emissiveIntensity = 0.12 + n * 1.5;
    else if (name === 'glow') { const k = 0.55 + n * 3.5; m.color.setScalar(k); }
    else if (name === 'inner') m.emissiveIntensity = this.opts.burning ? 1 : 0;
    else if (name === 'ember') this.fireAmount.value = 1;
    else if (name === 'pool') { m.opacity = Math.min(1, n * 1.0); m.visible = n > 0.02; }
  }
  setNight(n) { this.night = n; for (const [k, m] of this.m) this.apply(k, m); }
  dispose() { for (const m of this.m.values()) m.dispose(); this.m.clear(); }
}

/** Bucket geometry map -> THREE.Group of meshes using matset. opts: {shadows:true, receive:true} */
export function meshesFromBuilder(B, mats, { shadows = true } = {}) {
  const g = new THREE.Group(); const geos = B.build();
  for (const [name, geo] of geos) {
    let mesh;
    if (name === 'lines') { mesh = new THREE.LineSegments(geo, mats.get('wires')); mesh.name = 'wires'; }
    else {
      const m = mats.get(name); mesh = new THREE.Mesh(geo, m); mesh.name = name;
      const transparent = name === 'decal' || name === 'fire' || name === 'paint' || name === 'ember' || name === 'pool' || name === 'water';
      mesh.castShadow = shadows && !transparent && name !== 'glow' && !name.startsWith('g_') && name !== 'foliage_frond'; mesh.receiveShadow = !(name === 'glow' || name === 'fire');
      if (name === 'decal' || name === 'fire' || name === 'pool') mesh.renderOrder = 2; if (name === 'paint') mesh.renderOrder = 1;
    }
    g.add(mesh);
  }
  return g;
}
