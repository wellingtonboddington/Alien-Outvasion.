// Vessari material set: bone-tan shell, slate-blue wet flesh, cyan bioluminescent membranes, tendons, eggs. All infectable.
import * as THREE from 'three';
import { pbr, tf, tf2, cell, clamp01, mix, sstep } from './tex.js';

const P = {};
// bone-tan chitin plates with seams, cracks and staining
P.alienShell = (u, v, o) => {
  const c = cell(u, v, 5, 301), edge = 1 - clamp01((c[1] - c[0]) * 7.5), idv = c[2];
  const n = tf(u, v, 4, 5, 302), f = tf(u, v, 48, 3, 303), band = Math.sin((v * 20 + n * 3.2) * Math.PI * 2) * 0.5 + 0.5;
  const crack = Math.pow(1 - Math.abs(2 * tf(u, v, 7, 4, 304) - 1), 34), stain = clamp01((tf(u, v, 3, 4, 305) - 0.5) * 2.4);
  const ridge = Math.sin((u * 14 + n * 2.0) * Math.PI * 2) * 0.5 + 0.5; let l = 0.9 + (idv - 0.5) * 0.14 + (n - 0.5) * 0.36 + (f - 0.5) * 0.1 - edge * 0.17 - crack * 0.4 - stain * 0.16 - ridge * 0.07; l *= 0.94 + 0.06 * band;
  o.r = 226 * l; o.g = 192 * l; o.b = 130 * l - edge * 6;
  o.h = (1 - edge) * 0.5 + n * 0.3 + ridge * 0.15 + f * 0.1 - crack * 0.5; o.ro = 0.26 + edge * 0.22 + (f - 0.5) * 0.16 + crack * 0.3 + stain * 0.2;
};
// slate-blue wet flesh with glowing veins/nodules (emissive mask)
P.alienFlesh = (u, v, o) => {
  const n = tf(u, v, 4, 5, 311), fib = tf2(u, v, 3, 44, 3, 312), f = tf(u, v, 50, 2, 313);
  const k = 0.3 + 0.55 * n + 0.18 * (fib - 0.5);
  o.r = mix(34, 92, k) * (0.9 + f * 0.2); o.g = mix(48, 124, k) * (0.9 + f * 0.2); o.b = mix(62, 148, k) * (0.9 + f * 0.2);
  const w = tf(u, v, 5, 4, 314), vein = Math.pow(1 - Math.abs(2 * w - 1), 44), w2 = tf(u, v, 11, 3, 315), vein2 = Math.pow(1 - Math.abs(2 * w2 - 1), 70), nod = cell(u, v, 13, 316);
  o.em = clamp01(vein * 0.8 + vein2 * 0.45 + (nod[0] < 0.045 ? 0.8 : 0));
  o.h = 0.4 + 0.4 * n + fib * 0.2 + vein * 0.12; o.ro = 0.2 + (f - 0.5) * 0.25 + vein * 0.1;
};
// vault skin: slate flesh albedo, emissive = backlit membrane cells + fine veins
P.alienVault = (u, v, o) => {
  P.alienFlesh(u, v, o); const c = cell(u, v, 6, 361), rim = clamp01((c[1] - c[0]) * 5), centre = 1 - clamp01(c[0] * 2.0), w = tf(u, v, 8, 3, 362), vein = Math.pow(1 - Math.abs(2 * w - 1), 30);
  o.em = clamp01(0.08 + 0.62 * centre * rim + 0.22 * vein + o.em * 0.28); o.r *= 0.9 + 0.2 * rim; o.g *= 0.9 + 0.2 * rim; o.b *= 0.95 + 0.15 * rim;
};
// translucent glowing membrane: cells with bright centres + veins (used on bay panels, egg sacs, hanging orbs)
P.alienMembrane = (u, v, o) => {
  const c = cell(u, v, 7, 321), rim = clamp01((c[1] - c[0]) * 6), centre = 1 - clamp01(c[0] * 2.1), n = tf(u, v, 6, 4, 322), w = tf(u, v, 9, 3, 323), vein = Math.pow(1 - Math.abs(2 * w - 1), 9);
  o.r = 18 + 24 * rim; o.g = 44 + 40 * rim; o.b = 56 + 46 * rim;
  o.em = clamp01(0.2 + 0.62 * centre * rim + 0.4 * vein + 0.25 * (n - 0.5)); o.h = 0.5 + 0.3 * rim; o.ro = 0.28;
};
// wet floor: dark plates with glowing seams
P.alienFloor = (u, v, o) => {
  const c = cell(u, v, 6, 331), edge = 1 - clamp01((c[1] - c[0]) * 9), n = tf(u, v, 5, 5, 332), f = tf(u, v, 60, 2, 333), pud = clamp01((tf(u, v, 3, 3, 334) - 0.55) * 4);
  const k = 0.25 + 0.5 * n; o.r = mix(14, 44, k) * (0.9 + f * 0.2); o.g = mix(22, 62, k) * (0.9 + f * 0.2); o.b = mix(30, 78, k) * (0.9 + f * 0.2);
  o.em = edge > 0.55 ? (edge - 0.55) * 1.4 * (0.4 + 0.6 * tf(u, v, 8, 2, 335)) : 0; o.h = 0.6 - edge * 0.5 + n * 0.2; o.ro = 0.14 + (1 - pud) * 0.3 + (f - 0.5) * 0.2;
};
// fibrous tendon rope
P.alienTendon = (u, v, o) => {
  const fib = tf2(u, v, 18, 3, 3, 341), fb2 = tf2(u, v, 40, 2, 2, 342), n = tf(u, v, 4, 3, 343); const k = 0.28 + 0.5 * fib + 0.2 * (fb2 - 0.5);
  o.r = mix(22, 66, k); o.g = mix(30, 86, k); o.b = mix(38, 100, k); o.em = 0; o.h = 0.3 + fib * 0.6 + (fb2 - 0.5) * 0.3; o.ro = 0.22 + (n - 0.5) * 0.2;
};
// egg / sac membrane: pale glassy skin, veins + glowing nodules
P.alienEgg = (u, v, o) => {
  const w = tf(u, v, 4, 4, 351), vein = Math.pow(1 - Math.abs(2 * w - 1), 8), w2 = tf(u, v, 9, 3, 352), vein2 = Math.pow(1 - Math.abs(2 * w2 - 1), 18), c = cell(u, v, 9, 353), n = tf(u, v, 6, 4, 354);
  o.r = 120 + 40 * n; o.g = 170 + 50 * n; o.b = 190 + 40 * n;
  o.em = clamp01(vein * 0.8 + vein2 * 0.5 + (c[0] < 0.08 ? 0.7 : 0.05) + (n - 0.5) * 0.2); o.h = 0.55 + vein * 0.1; o.ro = 0.16 + (n - 0.5) * 0.15;
};

const SETS = {
  shell: { p: 'alienShell', opts: { rough: true, strength: 3.2 } },
  flesh: { p: 'alienFlesh', opts: { rough: true, emissive: true, strength: 3.4 } },
  vault: { p: 'alienVault', opts: { rough: true, emissive: true, strength: 3.0 } },
  membrane: { p: 'alienMembrane', opts: { rough: true, emissive: true, strength: 2.4 } },
  floor: { p: 'alienFloor', opts: { rough: true, emissive: true, strength: 3.0 } },
  tendon: { p: 'alienTendon', opts: { rough: true, strength: 3.8 } },
  egg: { p: 'alienEgg', opts: { rough: true, emissive: true, strength: 2.0 } },
};
export function alienTex(name) { const s = SETS[name]; return pbr(s.p, P[s.p], { w: 512, ...s.opts }); }

const CYAN = new THREE.Color(0x46e6ff);
/** shader patch: per-vertex glow mask (aGlow), travelling pulse, fresnel rim, optional translucency, optional egg breathing */
function bioPatch(mat, k, o) {
  const key = `bio|${o.pulse ?? 1}|${o.trans ? 1 : 0}|${o.breathe ? 1 : 0}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = k.uTime; sh.uniforms.uRim = { value: new THREE.Color(o.rim ?? 0x1a7a99).multiplyScalar(o.rimK ?? 0.7) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;\nvarying vec3 vWp;\nuniform float uT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvGlow = aGlow;${o.breathe ? '\ntransformed += normal * (0.022 * sin(uT * 1.35 + aGlow * 61.0) + 0.008 * sin(uT * 3.1 + aGlow * 17.0));' : ''}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uT; uniform vec3 uRim; varying float vGlow; varying vec3 vWp;')
      .replace('#include <emissivemap_fragment>', `
      {
        float wave = ${o.pulse === 0 ? '1.0' : '0.70 + 0.30 * sin(uT * 1.5 - vWp.z * 0.42 + vWp.x * 0.21 + vWp.y * 0.1)'};
        totalEmissiveRadiance *= ${o.eggGlow ? 'mix(0.55, 1.0, fract(vGlow * 7.3))' : 'vGlow'} * wave;
        vec3 vdir = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(vdir, normal), 0.0, 1.0), 3.0);
        vec3 rimc = mix(uRim, uRim.gbr * vec3(0.7, 1.4, 0.6), clamp(uInfect, 0.0, 1.0));
        totalEmissiveRadiance += rimc * fres * (0.35 + 0.65 * ${o.eggGlow ? '1.0' : 'vGlow'});
        ${o.trans ? 'diffuseColor.a = clamp(0.30 + 0.55 * fres + 0.12 * wave, 0.0, 0.92);' : ''}
      }
      #include <emissivemap_fragment>`);
  };
  mat.customProgramCacheKey = () => key;
}

/** Register the alien material set on a kit (all infectable). Returns names. */
export function alienMats(k) {
  k.infectAll = true;
  const mk = (name, params, tex, patch) => {
    const { _tile, ...rest } = params; const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...rest });
    if (tex) { const t = alienTex(tex); m.map = t.map; m.normalMap = t.normalMap; m.roughnessMap = t.roughnessMap; if (t.emissiveMap) m.emissiveMap = t.emissiveMap; m.normalScale = new THREE.Vector2(1, 1); }
    if (patch) bioPatch(m, k, patch);
    else { m.customProgramCacheKey = () => 'bioPlain'; }
    const { infectable } = k._inf; infectable(m);
    return k.defMat(name, m, { tile: _tile || 3, ao: false });
  };
  const N = {};
  N.shell = mk('a:shell', { color: 0xffffff, roughness: 1, metalness: 0.05, _tile: 2.2 }, 'shell', { pulse: 0, rim: 0x6a5a30, rimK: 0.25 });
  N.shellB = mk('a:shellB', { color: 0xd8c8a8, roughness: 1, metalness: 0.0, _tile: 3.0 }, 'shell', { pulse: 0, rim: 0x6a5a30, rimK: 0.2 });
  N.flesh = mk('a:flesh', { color: 0xffffff, emissive: CYAN.clone(), emissiveIntensity: 1.7, roughness: 1, metalness: 0.0, _tile: 3 }, 'flesh', { rim: 0x1a7a99, rimK: 0.9 });
  N.vault = mk('a:vault', { color: 0xffffff, emissive: CYAN.clone(), emissiveIntensity: 1.9, roughness: 1, metalness: 0.0, _tile: 3.2 }, 'vault', { rim: 0x1a7a99, rimK: 0.9 });
  N.membrane = mk('a:membrane', { color: 0xffffff, emissive: CYAN.clone(), emissiveIntensity: 2.3, roughness: 1, _tile: 2.2 }, 'membrane', { rim: 0x2a9ab8, rimK: 0.9 });
  N.floor = mk('a:floor', { color: 0xffffff, emissive: CYAN.clone(), emissiveIntensity: 1.4, roughness: 1, metalness: 0.1, _tile: 4 }, 'floor', { pulse: 1, rim: 0x1a6a88, rimK: 0.5 });
  N.tendon = mk('a:tendon', { color: 0xe8f0ff, roughness: 1, metalness: 0.0, _tile: 1 }, 'tendon', { pulse: 0, rim: 0x1a7a99, rimK: 0.8 });
  N.egg = mk('a:egg', { color: 0xffffff, emissive: CYAN.clone(), emissiveIntensity: 1.5, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, _tile: 2 }, 'egg', { trans: true, breathe: true, eggGlow: true, rim: 0x3ab8d8, rimK: 1.2 });
  k.mats.get(N.egg).userData.order = 4;
  N.eggB = mk('a:eggB', { color: 0xffffff, emissive: CYAN.clone(), emissiveIntensity: 1.1, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.BackSide, _tile: 2 }, 'egg', { trans: true, breathe: true, eggGlow: true, rim: 0x2a98b8, rimK: 0.8 });
  k.mats.get(N.eggB).userData.order = 4; k.mats.get(N.egg).userData.order = 5;
  N.embryo = mk('a:embryo', { color: 0xffffff, emissive: CYAN.clone(), emissiveIntensity: 0.6, roughness: 1, metalness: 0, _tile: 2 }, 'flesh', { pulse: 1, rim: 0x1a7a99, rimK: 0.7 });
  N.glowCyan = k.glow(0x46e6ff, 3.2); N.glowDim = k.glow(0x2ab8d8, 1.5); N.glowWhite = k.glow(0xcff8ff, 4);
  return N;
}
