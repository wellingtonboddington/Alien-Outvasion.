// OCEAN — camera-centred polar-ring mesh (dense near, sparse far), Gerstner vertex waves, scrolling procedural normal detail,
// fresnel sky reflection (shares the sky's uniforms -> clouds/sun/horizon match), sun glitter, crest foam, optional shoreline depth map (foam, turquoise shallows, transparency).
import * as THREE from 'three';
import { Q, clamp, lerp } from '../engine/common.js';
import { oceanTileTex, skyNoiseTex } from './env/noise.js';
import { SKY_UNIFORMS_GLSL, SKY_GRADIENT_GLSL } from './env/skyShader.js';
import { createSkyUniforms } from './sky.js';
import { getWind } from './env/wind.js';

const NW = 6;
const WAVELENGTHS = [150, 84, 47, 26, 14, 7.5];
const SPREAD = [0, 0.32, -0.45, 0.7, -0.8, 1.15];

const VERT = /* glsl */`
uniform vec2 uCenter; uniform float uSea; uniform float uTime; uniform vec4 uW1[${NW}]; uniform vec4 uW2[${NW}]; uniform float uSize;
varying vec3 vWorld; varying vec3 vN; varying float vFoam; varying float vH; varying float vRing;
#include <fog_pars_vertex>
void main() {
  vec3 p = position; p.xz += uCenter;
  float dist = length(p.xz - cameraPosition.xz);
  vec3 disp = vec3(0.0); vec3 n = vec3(0.0, 1.0, 0.0); float pinch = 0.0;
  for (int i = 0; i < ${NW}; i++) {
    vec2 d = uW1[i].xy; float k = uW1[i].z; float a = uW1[i].w; float Q = uW2[i].x; float w = uW2[i].y; float ph = uW2[i].z;
    float lam = 6.2831853 / k; a *= 1.0 - smoothstep(lam * 22.0, lam * 70.0, dist);
    float th = k * dot(d, p.xz) - w * uTime + ph; float s = sin(th), c = cos(th);
    disp.xz += Q * a * d * c; disp.y += a * s;
    n.xz -= d * (k * a * c); n.y -= Q * k * a * s; pinch += Q * k * a * s;
  }
  vec3 wp = vec3(p.x + disp.x, uSea + disp.y, p.z + disp.z);
  vWorld = wp; vN = normalize(n); vFoam = pinch; vH = disp.y; vRing = length(position.xz) / uSize;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
${SKY_UNIFORMS_GLSL}
uniform float uSunInt; uniform float uFoamAmt;
uniform sampler2D tOcean; uniform sampler2D tShore; uniform sampler2D uNoise;
uniform vec4 uShoreBox; uniform float uHasShore;
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoamColor; uniform float uChop; uniform float uDepthScale; uniform float uQuality; uniform float uSea;
uniform float uCover; uniform float uSharp; uniform float uDens; uniform vec2 uWind; uniform float uScale; uniform vec3 uCloudLit; uniform vec3 uCloudShade;
varying vec3 vWorld; varying vec3 vN; varying float vFoam; varying float vH; varying float vRing;
#include <fog_pars_fragment>
${SKY_GRADIENT_GLSL}

vec3 skyReflect(vec3 R) {
  vec3 c = skyGradient(R);
  if (uQuality > 0.5 && uCover > 0.02 && R.y > 0.0) {
    vec2 uv = R.xz / (R.y + 0.14); vec2 p = uv * uScale + uWind * uTime;
    float n = texture2D(uNoise, p).r * 0.55 + texture2D(uNoise, p * 2.17 + vec2(0.31, 0.57)).g * 0.3 + 0.075;
    float thr = mix(0.80, 0.28, uCover); float cl = smoothstep(thr, thr + uSharp, n); float blanket = smoothstep(0.72, 1.0, uCover); cl = max(cl, blanket * 0.9);
    float thick = smoothstep(thr, thr + 0.3, n);
    vec3 cc = mix(uCloudLit, uCloudShade, clamp(thick * 0.7 + 0.15, 0.0, 1.0));
    c = mix(c, mix(cc * 0.85, uHorizon, smoothstep(0.3, 0.0, R.y) * 0.8), cl * uDens * smoothstep(0.0, 0.16, R.y) * (0.75 - 0.35 * smoothstep(80.0, 1200.0, length(cameraPosition - vWorld))));
  }
  return c;
}

void main() {
  vec3 V = cameraPosition - vWorld; float dist = length(V); V /= dist;
  vec2 wp = vWorld.xz;
  // distance-faded normal detail
  float fine = 1.0 - smoothstep(30.0, 220.0, dist), mid = 1.0 - smoothstep(180.0, 1100.0, dist);
  vec3 n1 = texture2D(tOcean, wp * 0.043 + vec2(0.011, 0.006) * uTime).rgb * 2.0 - 1.0;
  vec3 n2 = texture2D(tOcean, wp * 0.17 + vec2(-0.017, 0.012) * uTime + 0.37).rgb * 2.0 - 1.0;
  vec3 n3 = uQuality > 0.5 ? texture2D(tOcean, wp * 0.71 + vec2(0.03, -0.026) * uTime + 0.71).rgb * 2.0 - 1.0 : vec3(0.0);
  vec2 dn = n1.xy * 0.42 * mid + n2.xy * 0.34 * mid + n3.xy * 0.26 * fine;
  dn *= uChop;
  vec3 N = normalize(vec3(vN.x + dn.x, vN.y, vN.z + dn.y));
  float NV = max(dot(N, V), 0.0);
  // reflection
  vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.015; R = normalize(R);
  vec3 refl = skyReflect(R);
  float F0 = 0.025; float fres = F0 + (1.0 - F0) * pow(1.0 - NV, 5.0);
  fres = clamp(fres, 0.02, 1.0);
  // depth
  float depth = 60.0;
  if (uHasShore > 0.5) {
    vec2 su = (wp - uShoreBox.xy) * uShoreBox.z; vec2 e = min(su, 1.0 - su);
    float inside = smoothstep(-0.02, 0.0, min(e.x, e.y));
    float sd = texture2D(tShore, clamp(su, 0.0, 1.0)).r;
    depth = mix(60.0, sd - vH * 0.6, inside);
  }
  float dk = 1.0 - exp(-max(depth, 0.0) / uDepthScale);
  vec3 body = mix(uShallow, uDeep, dk);
  // lighting of the body colour
  vec3 L = normalize(uSunDir.y < 0.02 ? vec3(uSunDir.x, 0.02, uSunDir.z) : uSunDir);
  float sunK = clamp(uSunInt / 3.2, 0.0, 1.0); float nl = max(dot(vec3(0.0, 1.0, 0.0), L), 0.0);
  vec3 amb = mix(uMid, uZenith, 0.3) * 0.9;
  vec3 lit = amb + uSunColor * sunK * nl * 0.55;
  vec3 col = body * lit * 1.3;
  // light scattering through wave crests (toward the sun)
  float sss = pow(clamp(dot(V, -vec3(L.x, 0.0, L.z) * 1.0), 0.0, 1.0), 3.0) * smoothstep(-0.1, 0.5, vH + vN.y * 0.0 + (1.0 - vN.y) * 1.5);
  col += vec3(0.04, 0.34, 0.26) * sss * sunK * 1.3 * (1.0 - dk * 0.4);
  // sun glitter
  vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.0);
  float rough = mix(0.03, 0.2, smoothstep(30.0, 900.0, dist));
  float a2 = rough * rough; float dd = nh * nh * (a2 - 1.0) + 1.0; float D = a2 / (3.14159 * dd * dd);
  float nl2 = max(dot(N, L), 0.0);
  vec3 spec = uSunColor * D * 0.05 * (uSunInt * 0.5 + 0.1) * smoothstep(0.0, 0.1, L.y) * smoothstep(0.0, 0.25, nl2);
  // composite reflection (sky) + body
  col = mix(col, refl, fres);
  col += spec * fres * 4.0 + spec * 0.25;
  // foam: crest foam + shoreline foam
  float lace = texture2D(tOcean, wp * 0.09 + vec2(0.006, 0.004) * uTime).a * 0.6 + texture2D(tOcean, wp * 0.31 - vec2(0.01, 0.008) * uTime).a * 0.4;
  float foam = smoothstep(0.17, 0.42, vFoam * uFoamAmt + (lace - 0.5) * 0.3) * (0.45 + 0.55 * lace) * mid;
  float alpha = 1.0;
  if (uHasShore > 0.5) {
    float dpt = max(depth, 0.0);
    float swash = 0.5 + 0.5 * sin(uTime * 0.85 + texture2D(uNoise, wp * 0.012).g * 9.0);
    float edge = smoothstep(0.55 + 0.3 * swash, 0.0, dpt);
    float surf = smoothstep(0.35, 0.0, abs(fract(dpt * 0.16 + uTime * 0.055 + texture2D(uNoise, wp * 0.02).r * 0.5) - 0.5) - 0.3) * smoothstep(3.2, 0.5, dpt) * 0.7;
    float sf = (edge * 1.0 + surf) * (0.35 + 0.8 * lace);
    foam = max(foam, clamp(sf, 0.0, 1.0));
    alpha = mix(0.0, 1.0, smoothstep(-0.02, 0.6 + 0.9 * dk * 3.0, depth));
    alpha = max(alpha * 0.96, fres);
    alpha = mix(alpha, 1.0, smoothstep(2.0, 6.0, depth));
  }
  vec3 foamCol = uFoamColor * (amb * 0.8 + uSunColor * sunK * (0.2 + 0.8 * nl) * 0.7);
  col = mix(col, foamCol, clamp(foam, 0.0, 1.0));
  alpha = max(alpha, clamp(foam, 0.0, 1.0));
  // blend far edge into the horizon colour
  float edgeK = smoothstep(0.78, 0.99, vRing);
  col = mix(col, uHorizon, edgeK); alpha = mix(alpha, 1.0, edgeK);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function buildGeometry(size, rings, segs, r0 = 2.2) {
  const pos = new Float32Array(((rings + 1) * segs + 1) * 3); let k = 0; pos[0] = pos[1] = pos[2] = 0; k = 3;
  for (let i = 0; i <= rings; i++) { const r = r0 * Math.pow(size / r0, i / rings); for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2; pos[k++] = Math.cos(a) * r; pos[k++] = 0; pos[k++] = Math.sin(a) * r; } }
  const idx = [];
  for (let j = 0; j < segs; j++) idx.push(0, 1 + (j + 1) % segs, 1 + j);
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = 1 + i * segs + j, b = 1 + i * segs + (j + 1) % segs, c = a + segs, d = b + segs; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), size * 1.1); return g;
}

/**
 * createOcean({size=7000, color, deepColor, choppiness=1, waveHeight=1, waveDir (rad, propagation direction in XZ), seaLevel=0, terrain, sky, depthScale=7}) -> Ocean
 *   Ocean = { root, mesh, update(dt,t), setSky(sky), setShore(terrain|fn, {center:[x,z], extent=2400, res}), setWaveDirection(rad), setChoppiness(c), setWaveHeight(h), setSeaLevel(y), dispose() }
 * The mesh re-centres itself on the camera every frame (so it never ends), waves are a pure function of world position and time.
 * Auto-binds to `scene.userData.sky` (set by sky.applyTo) for colours/sun/clouds; works without a sky (default daylight).
 */
export function createOcean(opts = {}) {
  const size = opts.size ?? 7000; const rings = Q.level === 0 ? 46 : Q.level === 1 ? 74 : 104; const segs = Q.level === 0 ? 72 : Q.level === 1 ? 120 : 172;
  const sk = createSkyUniforms(); // default (day) sky values used until bound
  sk.uZenith.value.set(0.03, 0.14, 0.5); sk.uMid.value.set(0.17, 0.4, 0.75); sk.uHorizon.value.set(0.55, 0.7, 0.8); sk.uGround.value.copy(sk.uHorizon.value).multiplyScalar(0.4); sk.uGlow.value.set(1, 0.9, 0.7); sk.uSunDir.value.set(0.4, 0.7, 0.6).normalize(); sk.uSunColor.value.set(1, 0.95, 0.85);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  Object.assign(uniforms, {
    uCenter: { value: new THREE.Vector2() }, uSea: { value: opts.seaLevel ?? 0 }, uW1: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, uW2: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, uSize: { value: size },
    uSunInt: { value: 3 }, uFoamAmt: { value: 1 }, tOcean: { value: oceanTileTex() }, tShore: { value: null }, uNoise: { value: skyNoiseTex() }, uShoreBox: { value: new THREE.Vector4(0, 0, 1, 0) }, uHasShore: { value: 0 },
    uShallow: { value: new THREE.Color(opts.color ?? 0x2fb5a8) }, uDeep: { value: new THREE.Color(opts.deepColor ?? 0x06304a) }, uFoamColor: { value: new THREE.Color(0xf4f8fa) }, uChop: { value: 1 }, uDepthScale: { value: opts.depthScale ?? 7 }, uQuality: { value: Q.level > 0 ? 1 : 0 },
  });
  const shared = Object.keys(sk); const own = {}; for (const k of shared) { uniforms[k] = sk[k]; own[k] = sk[k]; }
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: true, fog: true, side: THREE.DoubleSide });
  const geo = buildGeometry(size, rings, segs);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = -5; mesh.name = 'ocean';
  const root = new THREE.Group(); root.name = 'ocean'; root.add(mesh);

  const state = { waveDir: opts.waveDir ?? getWind().dir, chop: opts.choppiness ?? 1, height: opts.waveHeight ?? 1, boundSky: null };
  function setWaves() {
    const amp0 = 0.5 * state.height; const choppy = clamp(state.chop, 0, 2);
    for (let i = 0; i < NW; i++) {
      const lam = WAVELENGTHS[i]; const k = 2 * Math.PI / lam; const a = amp0 * Math.pow(lam / WAVELENGTHS[0], 0.85) * (i === 0 ? 1 : 0.85); const ang = state.waveDir + SPREAD[i];
      const Q0 = choppy * 0.55 / (k * a * NW); const w = Math.sqrt(9.81 * k);
      uniforms.uW1.value[i].set(Math.cos(ang), Math.sin(ang), k, a); uniforms.uW2.value[i].set(Q0, w, i * 1.7, 0);
    }
    uniforms.uChop.value = 0.35 + 0.65 * choppy * (0.6 + 0.4 * state.height); uniforms.uFoamAmt.value = clamp(0.25 + 0.55 * state.height * (0.5 + choppy * 0.5), 0, 1.5);
  }
  setWaves();

  const ocean = {
    root, mesh, material: mat, uniforms,
    setWaveDirection(a) { state.waveDir = a; setWaves(); }, setChoppiness(c) { state.chop = c; setWaves(); }, setWaveHeight(h) { state.height = h; setWaves(); },
    setSeaLevel(y) { uniforms.uSea.value = y; },
    setColors(shallow, deep) { if (shallow !== undefined) uniforms.uShallow.value.set(shallow); if (deep !== undefined) uniforms.uDeep.value.set(deep); },
    setSky(sky) {
      if (!sky) return; state.boundSky = sky; const su = sky.uniforms;
      for (const k of shared) if (su[k]) uniforms[k] = su[k];
      uniforms.uSunInt = uniforms.uSunInt; ocean._sunSource = sky;
    },
    /** Bake a depth map (R16F: metres below sea level, negative = land) from a terrain (needs heightAt) over a box so the shore gets foam, shallows and transparency. */
    setShore(src, o = {}) {
      const hf = typeof src === 'function' ? src : (x, z) => src.heightAt(x, z); const sea = uniforms.uSea.value;
      const extent = o.extent ?? Math.min(src.size || 2400, 2600); const cx = o.center ? o.center[0] : 0, cz = o.center ? o.center[1] : 0; const res = o.res ?? (Q.level === 0 ? 192 : Q.level === 1 ? 320 : 448);
      const data = new Uint16Array(res * res); const x0 = cx - extent / 2, z0 = cz - extent / 2;
      for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const x = x0 + (i + 0.5) / res * extent, z = z0 + (j + 0.5) / res * extent; data[j * res + i] = THREE.DataUtils.toHalfFloat(sea - hf(x, z)); }
      const t = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.HalfFloatType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.needsUpdate = true;
      if (uniforms.tShore.value) uniforms.tShore.value.dispose(); uniforms.tShore.value = t; uniforms.uShoreBox.value.set(x0, z0, 1 / extent, 1); uniforms.uHasShore.value = 1; return ocean;
    },
    update(dt, t) { uniforms.uTime.value = t; uniforms.uQuality.value = Q.level > 0 ? 1 : 0; },
    dispose() { geo.dispose(); mat.dispose(); if (uniforms.tShore.value) uniforms.tShore.value.dispose(); if (root.parent) root.parent.remove(root); },
  };
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const sky = scene.userData && scene.userData.sky; if (sky && sky !== state.boundSky) ocean.setSky(sky);
    if (state.boundSky && state.boundSky.P) uniforms.uSunInt.value = state.boundSky.P.sunInt;
    // follow the camera (snap to 4 m so the mesh does not crawl)
    const cx = Math.round(camera.position.x / 4) * 4, cz = Math.round(camera.position.z / 4) * 4; uniforms.uCenter.value.set(cx, cz);
  };
  if (opts.terrain) ocean.setShore(opts.terrain, opts.shore || {});
  if (opts.sky) ocean.setSky(opts.sky);
  return ocean;
}
