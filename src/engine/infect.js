// "Infection" shader patch: any machine / alien material can turn toxic-green (the film's visual language for infected tech & biology).
// Usage (hero model):   const mat = infectable(new THREE.MeshStandardMaterial({...}));   // per-material uniform
//                       setInfection(root, 0..1)                                          // walks root, sets uniform on every infectable material
// Usage (InstancedMesh): infectable(mat, {instanced:true}); geometry.setAttribute('aInfect', new THREE.InstancedBufferAttribute(new Float32Array(n),1)); write per-instance 0..1 then needsUpdate=true
// Usage (custom shader): inside your own onBeforeCompile call patchInfect(shader, u, {instanced})
//
// IMPORTANT: infection amount lives in a per-material uniform, so models that can be infected individually must NOT share
// materials with other instances of the same model (clone per hero model). Instanced swarms use the aInfect attribute instead.
import * as THREE from 'three';
import { GLOBAL } from './common.js';

const NOISE_GLSL = /* glsl */`
float _ih(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float _in(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(_ih(i),_ih(i+vec3(1,0,0)),f.x),mix(_ih(i+vec3(0,1,0)),_ih(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(_ih(i+vec3(0,0,1)),_ih(i+vec3(1,0,1)),f.x),mix(_ih(i+vec3(0,1,1)),_ih(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;

/** Patch a compiled-shader object (inside onBeforeCompile) to support infection. u = {value:number} uniform (ignored when instanced). */
export function patchInfect(shader, u, { instanced = false } = {}) {
  shader.uniforms.uInfect = u; shader.uniforms.uInfTime = GLOBAL.time;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vInfPos;\n${instanced ? 'attribute float aInfect;\nvarying float vInfI;' : ''}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvInfPos = position;\n${instanced ? 'vInfI = aInfect;' : ''}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nuniform float uInfect; uniform float uInfTime; varying vec3 vInfPos;\n${instanced ? 'varying float vInfI;' : ''}\n${NOISE_GLSL}`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float inf = ${instanced ? 'vInfI' : 'uInfect'};
        if (inf > 0.001) {
          // infection creeps in along noise-driven fronts, then veins glow
          float spread = _in(vInfPos * 2.2) * 0.7 + _in(vInfPos * 5.0) * 0.3;
          float front = smoothstep(spread - 0.12, spread + 0.12, inf * 1.25);
          float vn = abs(_in(vInfPos * 7.0 + vec3(0.0, uInfTime * 0.15, 0.0)) - 0.5);
          float vein = (1.0 - smoothstep(0.0, 0.06, vn)) * front;
          float pulse = 0.65 + 0.35 * sin(uInfTime * 3.0 + vInfPos.y * 4.0 + vInfPos.x * 3.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.45, 0.85, 0.30) + vec3(0.0, 0.025, 0.0), front * 0.75);
          float lum = dot(totalEmissiveRadiance, vec3(0.3, 0.55, 0.15));
          totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(0.22, 1.0, 0.10) * lum * 1.15, front);
          totalEmissiveRadiance += vec3(0.20, 1.0, 0.08) * vein * pulse * 2.2 + vec3(0.04, 0.22, 0.02) * front * pulse * 0.35;
        }
      }`);
}

export function infectable(mat, { instanced = false } = {}) {
  const u = { value: 0 }; mat.userData.uInfect = u; mat.userData.infInstanced = instanced;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => { if (prev) prev.call(mat, shader, renderer); patchInfect(shader, u, { instanced }); };
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|infect' + (instanced ? 'I' : '');
  return mat;
}
/** Set infection amount (0..1) on every infectable material beneath root. Returns root. */
export function setInfection(root, v) {
  root.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) if (mm.userData?.uInfect) mm.userData.uInfect.value = v; });
  return root;
}
/** Clone every material under root (so per-model infection / colour edits don't leak to other models). Infectable materials stay infectable.
 *  NOTE: materials that carry their own custom onBeforeCompile must be cloned by the module that owns them. */
export function cloneMaterials(root) {
  root.traverse((o) => {
    const m = o.material; if (!m) return;
    const clone = (mm) => { const c = mm.clone(); c.userData = { ...mm.userData, shared: false }; if (mm.userData?.uInfect) { delete c.userData.uInfect; infectable(c, { instanced: !!mm.userData.infInstanced }); } return c; };
    o.material = Array.isArray(m) ? m.map(clone) : clone(m);
  });
  return root;
}
