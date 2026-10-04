// Vessari materials. Every factory returns NEW material objects (per hero model, infectable) that share cached textures.
import * as THREE from 'three';
import { GLOBAL, Q } from '../../engine/common.js';
import { infectable, setInfection } from '../../engine/infect.js';
import { shellTextures, fleshTextures, hullTextures, windowTexture, glowSpriteTexture } from './tex.js';

export const CYAN = new THREE.Color(0x46e6ff);
export const GREEN = new THREE.Color(0x3cff1a);
export const SHELL_TAN = 0xb89a62, SLATE_DARK = 0x1d2a36, SLATE_LIGHT = 0x3a5368;

export function shellMat({ tint = 0xffffff, clearcoat = 0.4, vertexColors = false } = {}) {
  const t = shellTextures();
  return infectable(new THREE.MeshPhysicalMaterial({ color: tint, map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, vertexColors, clearcoat, clearcoatRoughness: 0.24, envMapIntensity: 1.0 }));
}
export function fleshMat({ tint = 0xffffff, iridescence = Q.level > 0 ? 0.55 : 0, vertexColors = false } = {}) {
  const t = fleshTextures();
  const m = new THREE.MeshPhysicalMaterial({ color: tint, map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, vertexColors, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 1.1 });
  if (iridescence > 0) { m.iridescence = iridescence; m.iridescenceIOR = 1.4; m.iridescenceThicknessRange = [160, 460]; }
  return infectable(m);
}
export function hullMat({ emissiveIntensity = 2.6, windows = true, seed = 1, vertexColors = false } = {}) {
  const t = hullTextures();
  const m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(1, 1), roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, vertexColors, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 1.0 });
  if (windows) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = windowTexture(seed); m.emissiveIntensity = emissiveIntensity; }
  m.userData.baseEmissive = emissiveIntensity;
  return infectable(m);
}
/** bone-tan shell with emissive window lights (spires of the big ships) */
export function shellWindowMat({ emissiveIntensity = 2.6, seed = 2, vertexColors = false } = {}) {
  const t = shellTextures();
  const m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, vertexColors, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  m.emissive = new THREE.Color(0xffffff); m.emissiveMap = windowTexture(seed); m.emissiveIntensity = emissiveIntensity; m.userData.baseEmissive = emissiveIntensity;
  return infectable(m);
}
/** emissive cyan (turns green when infected via the infect patch). intensity > 1 so bloom picks it up. */
export function glowMat(intensity = 3.2, color = CYAN) {
  return infectable(new THREE.MeshStandardMaterial({ color: 0x03080c, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0 }));
}
export function darkMat(color = 0x0f1820) { return infectable(new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, vertexColors: true })); }

// ---- additive glow (thruster flames, rings, halos): ShaderMaterial, uv.y = 0 at the source -> 1 at the tail ----
const FLAME_V = /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FLAME_F = /* glsl */`
uniform vec3 uColor; uniform float uPower; uniform float uTime; uniform float uInfect; uniform float uSeed; uniform float uFall; uniform float uRim;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(vec2 p){ p = fract(p*vec2(0.3183,0.3679)+uSeed); p *= 17.0; return fract(p.x*p.y*(p.x+p.y)); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
void main(){
  float along = vUv.y;
  float fall = pow(clamp(1.0-along,0.0,1.0), uFall);
  float t = uTime;
  float fl = 0.55 + 0.45*n(vec2(vUv.x*6.0 + t*1.7, along*5.0 - t*9.0)) + 0.25*n(vec2(vUv.x*14.0 - t*2.3, along*11.0 - t*17.0));
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uRim);   // brighter at silhouette edges -> soft look
  float core = mix(1.0, fres, 0.55);
  vec3 col = mix(uColor, vec3(0.24,1.0,0.1), uInfect);
  col = mix(col, vec3(1.0), pow(fall, 3.0)*0.55);
  float a = fall * fl * core * uPower;
  gl_FragColor = vec4(col * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function flameMat({ color = CYAN, power = 2.2, fall = 1.6, rim = 1.0, seed = 0, side = THREE.DoubleSide } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uPower: { value: power }, uTime: GLOBAL.time, uInfect: { value: 0 }, uSeed: { value: seed }, uFall: { value: fall }, uRim: { value: rim } },
    vertexShader: FLAME_V, fragmentShader: FLAME_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
  });
  m.userData.uInfect = m.uniforms.uInfect; m.userData.setPower = (p) => { m.uniforms.uPower.value = p; };
  return m;
}
/** additive sprite halo (camera-facing). */
export function haloMat({ color = CYAN, opacity = 1 } = {}) {
  const m = new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: color.clone(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, toneMapped: true });
  m.userData.cyan = color.clone(); m.userData.setInf = (a) => { m.color.copy(m.userData.cyan).lerp(GREEN, a); };
  return m;
}
/** set infection on a hero model: patched hull materials + manual halos/flames. */
export function infectAll(root, a) {
  setInfection(root, a);
  root.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) if (mm.userData?.setInf) mm.userData.setInf(a); });
}
