// Materials for the Vessari hero models. Every material is per-model (cloned) and infectable (-> toxic green) and can show alien ichor (setBloody).
import * as THREE from 'three';
import { infectable } from '../../engine/infect.js';
import { shellMaps, skinMaps, membraneMaps, mouthMaps } from './textures.js';

const BLOOD_GLSL = /* glsl */`
float _bh(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float _bn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(_bh(i),_bh(i+vec3(1,0,0)),f.x),mix(_bh(i+vec3(0,1,0)),_bh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(_bh(i+vec3(0,0,1)),_bh(i+vec3(1,0,1)),f.x),mix(_bh(i+vec3(0,1,1)),_bh(i+vec3(1,1,1)),f.x),f.y),f.z); }
float _bloodM = 0.0;`;

/** adds an "ichor splatter" layer controlled by uniform uBlood (0..1). */
export function bloodify(mat) {
  const u = { value: 0 }; mat.userData.uBlood = u;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    shader.uniforms.uBlood = u;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBlood; varying vec3 vBP;\n' + BLOOD_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (uBlood > 0.001) {
          float bn = _bn(vBP * vec3(7.0, 3.5, 7.0)) * 0.55 + _bn(vBP * vec3(19.0, 9.0, 19.0)) * 0.30 + _bn(vBP * 41.0) * 0.15;
          float lowGrav = clamp(1.4 - vBP.y * 0.45, 0.0, 1.0);
          _bloodM = smoothstep(1.0 - uBlood * 0.62 * (0.55 + 0.6 * lowGrav), 1.03 - uBlood * 0.62 * (0.55 + 0.6 * lowGrav), bn);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.012, 0.075), _bloodM * 0.94);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.10, _bloodM);');
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|blood';
  return mat;
}
export function setBloody(root, v) { root.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) if (mm.userData?.uBlood) mm.userData.uBlood.value = v; }); }

const pre = (m) => infectable(bloodify(m));

/** create the material set for one Vessari model. kind tints the shell / skin. */
export function makeVessariMaterials(kind = 'soldier', tint = {}) {
  const sh = shellMaps(), sk = skinMaps(), mb = membraneMaps(), mo = mouthMaps();
  const shellCol = new THREE.Color(tint.shell ?? (kind === 'hierarch' ? 0xfff0d0 : kind === 'officer' ? 0xffe6b8 : kind === 'drone' ? 0xc8b890 : 0xffffff));
  const skinCol = new THREE.Color(tint.skin ?? (kind === 'hierarch' ? 0xe6e4ff : kind === 'drone' ? 0xd8e8e8 : 0xffffff));
  const skin = pre(new THREE.MeshPhysicalMaterial({ color: skinCol, map: sk.map, normalMap: sk.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: sk.roughnessMap, roughness: 1.0, metalness: 0.02, clearcoat: 0.4, clearcoatRoughness: 0.25, iridescence: 0.3, iridescenceIOR: 1.4, iridescenceThicknessRange: [140, 460], sheen: 0.3, sheenColor: new THREE.Color(0x4aa0c0), sheenRoughness: 0.5 }));
  const shell = pre(new THREE.MeshPhysicalMaterial({ color: shellCol, map: sh.map, normalMap: sh.normalMap, normalScale: new THREE.Vector2(1.0, 1.0), roughnessMap: sh.roughnessMap, roughness: 1.0, metalness: 0.03, clearcoat: 0.75, clearcoatRoughness: 0.14 }));
  const glow = pre(new THREE.MeshStandardMaterial({ color: 0x061418, emissive: new THREE.Color(0x1fc8ff), emissiveIntensity: 1.9, roughness: 0.35, metalness: 0.0 }));
  const mouth = pre(new THREE.MeshStandardMaterial({ color: 0xffffff, map: mo.map, normalMap: mo.normalMap, roughness: 0.34, metalness: 0.0, emissive: new THREE.Color(0x4a0c28), emissiveIntensity: 0.55 }));
  const dark = pre(new THREE.MeshStandardMaterial({ color: 0x0b1219, roughness: 0.42, metalness: 0.25 }));
  const membrane = pre(new THREE.MeshStandardMaterial({ color: 0xffffff, map: mb.map, normalMap: mb.normalMap, emissiveMap: mb.emissiveMap, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.35, roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide }));
  return { skin, shell, glow, mouth, dark, membrane };
}

/** a separate emissive material (weapon cells) that still turns green with infection */
export function makeGlowMaterial(intensity = 3) {
  return pre(new THREE.MeshStandardMaterial({ color: 0x061418, emissive: new THREE.Color(0x1fc8ff), emissiveIntensity: intensity, roughness: 0.35, metalness: 0.0 }));
}
