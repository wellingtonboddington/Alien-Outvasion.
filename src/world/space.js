// SPACE — procedural Earth (continents/biomes/clouds/atmosphere/city lights/aurora), Moon, starfield + milky way, sun with lens-flare glare, nebula.
// Scale-free: pass any radius (6371 = km scale, or a small stylised planet). See docs/api/env.md for camera near/far advice.
import * as THREE from 'three';
import { Q, clamp, lerp, smoothstep, seg } from '../engine/common.js';
import { skyNoiseTex } from './env/noise.js';
import { createStarDome, createMilkyWayDome } from './env/stars.js';
import { buildEarthTextures, buildMoonTextures, latLonToDirArray } from './env/earthData.js';
import { SKY_VERT, MILKY_GLSL } from './env/skyShader.js';

export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737, MOON_DISTANCE_KM = 384400, SUN_DISTANCE_KM = 149.6e6;

const V3 = THREE.Vector3;

// ============================================================================ camera helpers
/** Recommended near/far for a camera at distance `dist` from the centre of a planet of `radius` (keeps the depth ratio sane; far reaches `farRadii` radii beyond). */
export function planetCameraRange(radius, dist, { farRadii = 12, nearFrac = 0.04 } = {}) {
  const alt = Math.max(dist - radius, radius * 0.0002); return { near: Math.max(alt * nearFrac, radius * 0.00005), far: dist + radius * farRadii };
}
/** Place a camera looking at a lat/lon point from some distance (in planet radii from the centre). */
export function frameEarth(camera, earth, { lat = 0, lon = 0, distance = 3, up = new V3(0, 1, 0), lookAtCentre = true, fov } = {}) {
  const dir = earth.latLonToWorld(lat, lon, 0, new V3()).sub(earth.root.getWorldPosition(new V3())).normalize();
  camera.position.copy(earth.root.getWorldPosition(new V3())).addScaledVector(dir, distance * earth.radius);
  camera.up.copy(up); camera.lookAt(earth.root.getWorldPosition(new V3()));
  const r = planetCameraRange(earth.radius, distance * earth.radius); camera.near = r.near; camera.far = r.far; if (fov) camera.fov = fov; camera.updateProjectionMatrix(); return camera;
}

// ============================================================================ Earth shaders
const EARTH_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
void main() {
  vUv = uv; vWN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const EARTH_FRAG = /* glsl */`
uniform sampler2D tMap; uniform sampler2D tLights; uniform sampler2D tClouds; uniform sampler2D uNoise;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uAxis; uniform float uCityLights; uniform float uCloudAmt; uniform float uCloudShift; uniform vec2 uMapSize; uniform float uRelief; uniform float uTime; uniform float uQuality;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
void main() {
  vec3 N = normalize(vWN); vec3 L = normalize(uSunDir); vec3 V = normalize(cameraPosition - vWP);
  vec4 m = texture2D(tMap, vUv);
  vec2 nuv = vUv * vec2(220.0, 110.0);
  float nd = texture2D(uNoise, nuv * 0.25).r - 0.5;
  float nd2 = texture2D(uNoise, nuv * 1.7).g - 0.5;
  float h = m.r + nd * 0.014 + nd2 * 0.006;
  float land = smoothstep(0.490, 0.510, h);
  float elev = m.a;
  float moist = clamp(m.g + (texture2D(uNoise, vUv * vec2(70.0, 35.0)).b - 0.5) * 0.3, 0.0, 1.0);
  float lat = (vUv.y - 0.5) * 3.14159265;
  float temp = pow(max(cos(lat), 0.0), 1.4) - elev * 1.3;
  float detail = texture2D(uNoise, vUv * vec2(160.0, 80.0)).g * 0.6 + texture2D(uNoise, vUv * vec2(520.0, 260.0)).b * 0.4;
  vec3 desert = vec3(0.60, 0.46, 0.27), savanna = vec3(0.43, 0.40, 0.19), grass = vec3(0.17, 0.33, 0.10), forest = vec3(0.06, 0.19, 0.07), rain = vec3(0.035, 0.15, 0.05);
  vec3 tundra = vec3(0.33, 0.34, 0.28), rock = vec3(0.31, 0.27, 0.23), ice = vec3(0.90, 0.94, 0.98);
  vec3 b = mix(desert, savanna, smoothstep(0.15, 0.33, moist));
  b = mix(b, grass, smoothstep(0.33, 0.52, moist)); b = mix(b, forest, smoothstep(0.52, 0.72, moist)); b = mix(b, rain, smoothstep(0.74, 0.95, moist) * smoothstep(0.5, 0.8, temp));
  b = mix(tundra, b, smoothstep(0.12, 0.4, temp)); b = mix(b, rock, smoothstep(0.3, 0.75, elev));
  vec3 landCol = b * (0.7 + 0.6 * detail);
  float iceK = clamp(m.b * 1.15, 0.0, 1.0);
  landCol = mix(landCol, ice * (0.85 + 0.15 * detail), smoothstep(0.25, 0.7, iceK));
  float depth = clamp(h / 0.5, 0.0, 1.0);
  vec3 oceanCol = mix(vec3(0.003, 0.016, 0.06), vec3(0.025, 0.17, 0.30), pow(depth, 2.4));
  oceanCol = mix(oceanCol, vec3(0.09, 0.40, 0.44), smoothstep(0.88, 1.0, depth));
  vec3 albedo = mix(oceanCol, landCol, land);
  albedo = mix(albedo, ice * 0.95, smoothstep(0.3, 0.8, iceK) * (1.0 - land));
  float oceanMask = (1.0 - land) * (1.0 - smoothstep(0.3, 0.8, iceK));

  // relief shading (mountains catch light near the terminator)
  vec3 Nn = N;
  if (uRelief > 0.0 && uQuality > 0.5) {
    vec2 e = vec2(1.0 / uMapSize.x, 0.0), f = vec2(0.0, 1.0 / uMapSize.y);
    float hx = texture2D(tMap, vUv + e).a - texture2D(tMap, vUv - e).a; float hy = texture2D(tMap, vUv + f).a - texture2D(tMap, vUv - f).a;
    vec3 East = normalize(cross(uAxis, N)); vec3 North = cross(N, East);
    Nn = normalize(N - (East * hx + North * hy) * 5.0 * uRelief * land);
  }
  float ndlG = dot(N, L);
  float day = smoothstep(-0.10, 0.30, ndlG);
  float diff = max(dot(Nn, L), 0.0);
  vec3 twilight = mix(vec3(1.0, 0.52, 0.30), vec3(1.0), smoothstep(0.0, 0.32, ndlG));
  // cloud shadow on the surface
  vec3 Ls = L - N * ndlG; float cosLat = max(cos(lat), 0.15);
  vec3 East2 = normalize(cross(uAxis, N)); vec3 North2 = cross(N, East2);
  vec2 sh = vec2(dot(Ls, East2) / (cosLat * 6.2832), dot(Ls, North2) / 3.1416) * 0.02 * uCloudAmt;
  float shadow = texture2D(tClouds, vUv + vec2(uCloudShift, 0.0) + sh).r * uCloudAmt;
  vec3 col = albedo * uSunColor * 1.25 * pow(diff, 0.95) * twilight * day * (1.0 - shadow * 0.5);
  col += albedo * vec3(0.016, 0.022, 0.045); // earthshine
  // ocean glint + fresnel sky reflection
  vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.0);
  float cloudHere = texture2D(tClouds, vUv + vec2(uCloudShift, 0.0)).r * uCloudAmt;
  float glint = (pow(nh, 260.0) * 1.6 + pow(nh, 30.0) * 0.1) * smoothstep(0.0, 0.2, ndlG);
  col += uSunColor * glint * oceanMask * (1.0 - cloudHere) * 1.1;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col += vec3(0.10, 0.20, 0.42) * fr * oceanMask * day * 0.6;
  // city lights on the night side, hidden by clouds
  float nightK = 1.0 - smoothstep(-0.18, 0.06, ndlG);
  float lt = texture2D(tLights, vUv).r; float tw = 0.85 + 0.15 * texture2D(uNoise, vUv * vec2(900.0, 450.0) + uTime * 0.01).g;
  col += vec3(1.0, 0.70, 0.36) * lt * tw * nightK * uCityLights * (1.0 - cloudHere * 0.8) * 4.5;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CLOUD_FRAG = /* glsl */`
uniform sampler2D tClouds; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uCloudAmt; uniform vec3 uAxis; uniform float uQuality; uniform sampler2D uNoise;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
void main() {
  vec3 N = normalize(vWN); vec3 L = normalize(uSunDir);
  float c = texture2D(tClouds, vUv).r;
  float detail = texture2D(uNoise, vUv * vec2(300.0, 150.0)).r;
  c = c * (0.85 + 0.3 * detail) * uCloudAmt;
  float a = smoothstep(0.12, 0.78, c);
  if (a < 0.01) discard;
  vec3 Ls = L - N * dot(N, L); vec3 East = normalize(cross(uAxis, N)); vec3 North = cross(N, East);
  float cosLat = max(cos((vUv.y - 0.5) * 3.14159), 0.15);
  vec2 off = vec2(dot(Ls, East) / (cosLat * 6.2832), dot(Ls, North) / 3.1416) * 0.012;
  float cs = texture2D(tClouds, vUv + off).r * uCloudAmt;
  float occ = clamp((cs - c) * 2.2 + 0.1, 0.0, 1.0);
  float ndl = dot(N, L);
  float day = smoothstep(-0.12, 0.3, ndl);
  vec3 twilight = mix(vec3(1.0, 0.5, 0.3), vec3(1.0), smoothstep(0.0, 0.35, ndl));
  vec3 lit = uSunColor * (1.0 - occ * 0.45) * (0.75 + 0.45 * smoothstep(0.2, 0.9, c)) * 1.15;
  vec3 col = lit * twilight * max(ndl * 0.9 + 0.1, 0.0) * day + vec3(0.006, 0.009, 0.02) * (1.0 - day);
  gl_FragColor = vec4(col, a * 0.96);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ATMO_VERT = /* glsl */`
varying vec3 vWP;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const ATMO_FRAG = /* glsl */`
uniform vec3 uCenter; uniform float uRadius; uniform float uAtmoR; uniform vec3 uSunDir; uniform float uIntensity; uniform vec3 uKR; uniform float uFall;
varying vec3 vWP;
const int NS = 10;
void main() {
  vec3 ro = cameraPosition - uCenter; vec3 rd = normalize(vWP - cameraPosition);
  float b = dot(ro, rd); float cA = dot(ro, ro) - uAtmoR * uAtmoR; float disc = b * b - cA;
  if (disc < 0.0) discard;
  float sq = sqrt(disc); float t0 = max(-b - sq, 0.0), t1 = -b + sq;
  float cP = dot(ro, ro) - uRadius * uRadius; float dP = b * b - cP;
  if (dP > 0.0) { float tp = -b - sqrt(dP); if (tp > 0.0) t1 = min(t1, tp); }
  if (t1 <= t0) discard;
  vec3 L = normalize(uSunDir); float Hh = uAtmoR - uRadius; float dt = (t1 - t0) / float(NS);
  vec3 sumR = vec3(0.0); vec3 sumM = vec3(0.0); float tauV = 0.0;
  vec3 kM = vec3(0.35);
  for (int i = 0; i < NS; i++) {
    float t = t0 + (float(i) + 0.5) * dt; vec3 p = ro + rd * t; float r = length(p); float h = max((r - uRadius) / Hh, 0.0);
    float dens = exp(-h * uFall); vec3 up = p / r; float mu = dot(up, L);
    float horizonCos = -sqrt(max(0.0, 1.0 - (uRadius * uRadius) / (r * r)));
    float lit = smoothstep(horizonCos - 0.04, horizonCos + 0.10, mu);
    float tauS = dens * 2.2 / max(mu + 0.16, 0.05) * 0.5;
    tauV += dens * dt / Hh * 0.55;
    vec3 T = exp(-(uKR + kM * 0.4) * (tauS + tauV));
    sumR += T * dens * dt / Hh * lit; sumM += T * dens * dt / Hh * lit;
  }
  float cosT = dot(rd, L); float phR = 0.75 * (1.0 + cosT * cosT); float g = 0.78; float phM = (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * cosT, 1.5));
  vec3 col = (sumR * uKR * phR * 1.6 + sumM * kM * phM * 0.5) * uIntensity;
  float Tview = exp(-dot(uKR + kM * 0.4, vec3(0.3333)) * tauV * 0.9);
  gl_FragColor = vec4(col, Tview);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const AURORA_VERT = /* glsl */`
attribute float aT; attribute float aS; uniform float uTime; varying float vT; varying float vS; varying float vH;
void main() { vT = aT; vS = aS; vH = position.y; vec3 p = position; p += normalize(position) * 0.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const AURORA_FRAG = /* glsl */`
uniform float uTime; uniform float uAmt; uniform sampler2D uNoise; varying float vT; varying float vS; varying float vH;
void main() {
  float rays = texture2D(uNoise, vec2(vS * 9.0 + uTime * 0.02, 0.3)).r * 0.6 + texture2D(uNoise, vec2(vS * 31.0 - uTime * 0.05, 0.7)).g * 0.4;
  float drift = texture2D(uNoise, vec2(vS * 2.0 + uTime * 0.03, 0.1)).b;
  float prof = smoothstep(0.0, 0.12, vT) * pow(1.0 - vT, 1.6);
  float a = prof * smoothstep(0.35, 0.8, rays) * smoothstep(0.25, 0.7, drift + 0.2) * uAmt;
  vec3 col = mix(vec3(0.1, 1.0, 0.45), vec3(0.75, 0.2, 0.9), smoothstep(0.35, 1.0, vT));
  gl_FragColor = vec4(col * a * 2.2, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * createEarth({radius=6371, seed=1, atmosphere (height frac of radius, default .026), cityLights=1, clouds=1, spin (rad/s), aurora=true, relief=1}) ->
 *   Earth = { root, globe, radius, update(dt,t), setCityLights(0..1), setClouds(0..1), setSun(sunObj|null), setSunDirection(v3), sunDir (Vector3), setSpin(rad/s),
 *             setRotation(rad), latLonToWorld(lat,lon,alt,out), cameraRange(dist), setAurora(0..1), dispose() }
 */
export function createEarth(opts = {}) {
  const R = opts.radius ?? EARTH_RADIUS_KM; const seed = opts.seed ?? 1; const tx = buildEarthTextures(seed);
  const noise = skyNoiseTex(); const atmoH = (opts.atmosphere ?? 0.026) * R;
  const root = new THREE.Group(); root.name = 'earth'; const globe = new THREE.Group(); globe.name = 'earthGlobe'; root.add(globe);
  const sunDir = new V3(1, 0.25, 0.6).normalize(); const axis = new V3(0, 1, 0);
  const shared = { uSunDir: { value: sunDir }, uSunColor: { value: new V3(1.0, 0.97, 0.92) }, uAxis: { value: axis }, uCityLights: { value: opts.cityLights ?? 1 }, uCloudAmt: { value: opts.clouds ?? 1 }, uCloudShift: { value: 0 }, uQuality: { value: Q.level > 0 ? 1 : 0 }, uNoise: { value: noise }, uTime: { value: 0 } };
  const segs = seg(96, 32), rings = seg(64, 20);
  const geo = new THREE.SphereGeometry(R, segs, rings);
  const surfMat = new THREE.ShaderMaterial({ uniforms: { ...shared, tMap: { value: tx.map }, tLights: { value: tx.lights }, tClouds: { value: tx.clouds }, uMapSize: { value: new THREE.Vector2(tx.W, tx.H) }, uRelief: { value: opts.relief ?? 1 } }, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG });
  const surface = new THREE.Mesh(geo, surfMat); surface.name = 'earthSurface'; surface.frustumCulled = false; globe.add(surface);
  const cloudGeo = new THREE.SphereGeometry(R * 1.0065, segs, rings);
  const cloudMat = new THREE.ShaderMaterial({ uniforms: { ...shared, tClouds: { value: tx.clouds } }, vertexShader: EARTH_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat); clouds.name = 'earthClouds'; clouds.frustumCulled = false; clouds.renderOrder = 1; globe.add(clouds);
  const atmoGeo = new THREE.SphereGeometry(R + atmoH, segs, rings);
  const atmoU = { uCenter: { value: new V3() }, uRadius: { value: R }, uAtmoR: { value: R + atmoH }, uSunDir: shared.uSunDir, uIntensity: { value: opts.atmosphereIntensity ?? 1.5 }, uKR: { value: new V3(0.26, 0.55, 1.25) }, uFall: { value: 9 } };
  const atmoMat = new THREE.ShaderMaterial({ uniforms: atmoU, vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor, blendEquation: THREE.AddEquation, depthWrite: false, side: THREE.FrontSide });
  const atmo = new THREE.Mesh(atmoGeo, atmoMat); atmo.name = 'earthAtmosphere'; atmo.frustumCulled = false; atmo.renderOrder = 2; root.add(atmo);
  atmo.onBeforeRender = (renderer, scene, camera) => { root.getWorldPosition(atmoU.uCenter.value); const inside = camera.position.distanceTo(atmoU.uCenter.value) < R + atmoH; atmoMat.side = inside ? THREE.BackSide : THREE.FrontSide; shared.uQuality.value = Q.level > 0 ? 1 : 0; };
  // aurora curtains (optional)
  let aurora = null; const auroraU = { uTime: shared.uTime, uAmt: { value: 0 }, uNoise: { value: noise } };
  if (opts.aurora !== false) {
    const SEG = 160, lat = 67 * Math.PI / 180; const pos = [], aT = [], aS = []; const rows = 8; const ind = [];
    for (const sign of [1, -1]) for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI * 2; for (let j = 0; j <= rows; j++) { const t = j / rows; const rr = R * (1.02 + t * 0.06); const l = lat + Math.sin(a * 2.0 + sign) * 0.05; const cl = Math.cos(l), sl = Math.sin(l); pos.push(Math.cos(a) * cl * rr, sign * sl * rr, Math.sin(a) * cl * rr); aT.push(t); aS.push(i / SEG); } }
    const per = (SEG + 1) * (rows + 1);
    for (let k = 0; k < 2; k++) for (let i = 0; i < SEG; i++) for (let j = 0; j < rows; j++) { const a = k * per + i * (rows + 1) + j, b = a + (rows + 1), c = a + 1, d = b + 1; ind.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); g.setIndex(ind);
    const m = new THREE.ShaderMaterial({ uniforms: auroraU, vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    aurora = new THREE.Mesh(g, m); aurora.frustumCulled = false; aurora.renderOrder = 3; aurora.visible = false; aurora.name = 'earthAurora'; root.add(aurora); aurora.userData.own = true;
  }
  const state = { spin: opts.spin ?? 0.012, base: opts.rotation ?? 0, sun: null, cloudDrift: 0.0016 };
  const _m = new THREE.Matrix4(), _v = new V3();
  const earth = {
    root, globe, radius: R, sunDir, surface, clouds, atmosphere: atmo, textures: tx,
    setSunDirection(v) { sunDir.copy(v).normalize(); return earth; },
    setSun(s) { state.sun = s; if (s && s.direction) sunDir.copy(s.direction); return earth; },
    setCityLights(k) { shared.uCityLights.value = k; return earth; }, setClouds(k) { shared.uCloudAmt.value = k; clouds.visible = k > 0.01; return earth; },
    setSpin(r) { state.spin = r; return earth; }, setRotation(rad) { state.base = rad; globe.rotation.y = rad; return earth; },
    setAurora(a) { auroraU.uAmt.value = a; if (aurora) aurora.visible = a > 0.01; return earth; },
    setAtmosphereIntensity(k) { atmoU.uIntensity.value = k; return earth; },
    /** world position of a lat/lon (degrees) at `alt` above the surface (same units as radius), including the globe's current rotation */
    latLonToWorld(lat, lon, alt = 0, out = new V3()) { latLonToDirArray(lon, lat, _arr); out.set(_arr[0], _arr[1], _arr[2]).multiplyScalar(R + alt); globe.updateWorldMatrix(true, false); return out.applyMatrix4(globe.matrixWorld); },
    surfaceNormal(lat, lon, out = new V3()) { latLonToDirArray(lon, lat, _arr); out.set(_arr[0], _arr[1], _arr[2]); globe.updateWorldMatrix(true, false); return out.transformDirection(globe.matrixWorld); },
    cameraRange(dist) { return planetCameraRange(R, dist); },
    update(dt, t) {
      if (state.sun && state.sun.direction) sunDir.copy(state.sun.direction);
      globe.rotation.y = state.base + t * state.spin; shared.uTime.value = t;
      const sh = t * state.cloudDrift; clouds.rotation.y = sh; shared.uCloudShift.value = -sh / (Math.PI * 2);
      globe.updateWorldMatrix(true, false); axis.set(0, 1, 0).transformDirection(globe.matrixWorld);
      if (aurora) aurora.rotation.set(0, 0, 0);
    },
    dispose() { geo.dispose(); cloudGeo.dispose(); atmoGeo.dispose(); surfMat.dispose(); cloudMat.dispose(); atmoMat.dispose(); if (aurora) { aurora.geometry.dispose(); aurora.material.dispose(); } if (root.parent) root.parent.remove(root); },
  };
  const _arr = [0, 0, 0];
  earth.update(0, 0);
  return earth;
}

// ============================================================================ Moon
/** createMoon({radius=1737, seed=1}) -> {root, mesh, radius, update(dt,t), dispose()}; lit by the scene's DirectionalLight (use createSun().light). */
export function createMoon(opts = {}) {
  const R = opts.radius ?? MOON_RADIUS_KM; const tx = buildMoonTextures(opts.seed ?? 1);
  const mat = new THREE.MeshStandardMaterial({ map: tx.albedo, normalMap: tx.normal, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 1, metalness: 0 });
  const geo = new THREE.SphereGeometry(R, seg(96, 32), seg(64, 20)); const mesh = new THREE.Mesh(geo, mat); mesh.name = 'moon'; mesh.castShadow = false; mesh.receiveShadow = false;
  const root = new THREE.Group(); root.name = 'moon'; root.add(mesh); mesh.rotation.y = opts.rotation ?? -Math.PI * 0.55;
  return { root, mesh, radius: R, update(dt, t) { mesh.rotation.y = (opts.rotation ?? -Math.PI * 0.55) + t * (opts.spin ?? 0.0004); }, dispose() { geo.dispose(); mat.dispose(); if (root.parent) root.parent.remove(root); } };
}

// ============================================================================ Starfield (+ milky way + optional nebula)
/** createStarfield({count, milkyWay=true, brightness=1, nebula=false}) -> {root, update(dt,t), setBrightness(k), dispose()} — rendered at infinity, ignores camera far. */
export function createStarfield(opts = {}) {
  const count = opts.count ?? (Q.level === 0 ? 3500 : Q.level === 1 ? 7000 : 12000);
  const stars = createStarDome({ count, seed: opts.seed ?? 21, brightness: opts.brightness ?? 1.1, milkyBias: 0.45, maxSize: 3.1 });
  const root = new THREE.Group(); root.name = 'starfield'; const disposables = [stars];
  let mw = null; if (opts.milkyWay !== false) { mw = createMilkyWayDome({ amount: opts.milkyWayAmount ?? 1.5 }); root.add(mw.mesh); disposables.push(mw); }
  root.add(stars.root);
  let nb = null; if (opts.nebula) { nb = createNebula(typeof opts.nebula === 'object' ? opts.nebula : {}); root.add(nb.mesh); disposables.push(nb); }
  return { root, stars, update(dt, t) { stars.update(t); if (nb) nb.update(dt, t); }, setBrightness(k) { stars.setVisibility(k); if (mw) mw.uniforms.uAmt.value = 1.5 * k; }, dispose() { disposables.forEach((d) => d.dispose()); if (root.parent) root.parent.remove(root); } };
}

// ============================================================================ Nebula
const NEB_FRAG = /* glsl */`
${MILKY_GLSL}
uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform float uAmt; uniform float uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 w = vec3(tri(d + 0.3, 1.7, 1), tri(d - 0.2, 1.9, 2), tri(d * 1.3, 1.5, 3));
  vec3 q = d + (w - 0.5) * 0.9;
  float n = tri(q, 1.2, 0) * 0.55 + tri(q, 2.6, 1) * 0.3 + tri(q, 5.5, 2) * 0.15;
  float m = smoothstep(0.48, 0.82, n);
  float m2 = smoothstep(0.55, 0.9, tri(q + 3.1, 1.9, 3) * 0.6 + tri(q, 4.0, 0) * 0.4);
  vec3 c = mix(uColA, uColB, smoothstep(0.4, 0.9, tri(d, 0.8, 2))) * m + uColC * m2 * 0.7;
  gl_FragColor = vec4(c * uAmt, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
/** createNebula({colors:[[r,g,b]x3], intensity}) -> {mesh, update, dispose}  (additive dome, add to a starfield or scene) */
export function createNebula({ colors = [[0.5, 0.1, 0.6], [0.1, 0.3, 0.8], [0.9, 0.35, 0.15]], intensity = 0.1 } = {}) {
  const uniforms = { uNoise: { value: skyNoiseTex() }, uColA: { value: new V3(...colors[0]) }, uColB: { value: new V3(...colors[1]) }, uColC: { value: new V3(...colors[2]) }, uAmt: { value: intensity }, uTime: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: NEB_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m); mesh.frustumCulled = false; mesh.renderOrder = -990; mesh.name = 'nebula';
  return { mesh, uniforms, update(dt, t) { uniforms.uTime.value = t; }, dispose() { mesh.geometry.dispose(); m.dispose(); } };
}

// ============================================================================ Sun (directional light + lens-flare glare)
const FLARE_VERT = /* glsl */`
attribute vec4 aA; attribute vec3 aC; uniform vec2 uSun; uniform float uAspect; uniform float uVis; uniform float uGhost; uniform float uScale;
varying vec2 vP; varying vec4 vA; varying vec3 vC;
void main() {
  vec2 c = uSun * (1.0 - aA.x); vec2 sc = vec2(aA.y / uAspect, aA.y) * uScale;
  if (aA.z > 0.5 && aA.z < 1.5) sc.x *= 7.0;
  vec2 pos = c + position.xy * sc;
  float vis = (aA.z < 2.5 || aA.z > 4.5) ? uVis : uVis * uGhost;
  gl_Position = vec4(pos, 0.99998, 1.0);
  vP = position.xy; vA = aA; vC = aC * vis;
}`;
const FLARE_FRAG = /* glsl */`
uniform float uTime; varying vec2 vP; varying vec4 vA; varying vec3 vC;
void main() {
  float r = length(vP); float ty = vA.z; float s = 0.0;
  if (ty < 0.5) s = exp(-r * r * 5.0) * 0.7 + 0.3 / (1.0 + r * r * 60.0);
  else if (ty < 1.5) s = exp(-abs(vP.x) * 2.6) * exp(-abs(vP.y) * 26.0);
  else if (ty < 2.5) { float an = atan(vP.y, vP.x); float ray = pow(abs(cos(an * 3.0 + sin(uTime * 0.3) * 0.2)), 18.0) * 0.8 + pow(abs(cos(an * 5.0 + 0.7)), 40.0) * 0.4; s = ray * exp(-r * 2.6) * smoothstep(1.0, 0.0, r); }
  else if (ty < 3.5) { s = smoothstep(1.0, 0.82, r) * (0.35 + 0.65 * smoothstep(0.3, 1.0, r)); }
  else if (ty < 4.5) { s = exp(-pow((r - 0.72) / 0.1, 2.0)) * 0.8; }
  else s = exp(-r * r * 12.0) * 1.2;
  if (s < 0.002) discard;
  gl_FragColor = vec4(vC * vA.w * s, 1.0);
}`;
/**
 * createSun({size=1, intensity=3.4, direction}) -> {root, light, direction, setDirection(v3), setIntensity(k), occluders[], update(dt,t), dispose()}
 * `light` is the DirectionalLight (lights moons/ships in space shots). The glare is a depth-tested flare (hidden behind planets, visible past their limb); pass
 * occluders=[{center:Vector3, radius}] so ghosts fade when the sun is eclipsed.
 */
export function createSun(opts = {}) {
  const dir = (opts.direction ? opts.direction.clone() : new V3(1, 0.25, 0.6)).normalize();
  const light = new THREE.DirectionalLight(opts.color ?? 0xfff3e0, opts.intensity ?? 3.4); light.name = 'spaceSun';
  const root = new THREE.Group(); root.name = 'sun'; root.add(light, light.target);
  const defs = [ // [t, size, type, intensity, r,g,b]
    [0, 0.8, 0, 0.55, 1, 0.9, 0.7], [0, 0.075, 5, 28, 1, 0.97, 0.92], [0, 0.55, 2, 0.5, 1, 0.9, 0.75], [0, 0.55, 1, 0.45, 0.7, 0.85, 1],
    [0.45, 0.07, 3, 0.18, 0.5, 0.9, 1], [0.8, 0.12, 3, 0.12, 1, 0.7, 0.4], [1.15, 0.05, 3, 0.25, 0.6, 1, 0.7], [1.55, 0.18, 3, 0.1, 0.9, 0.6, 1], [2.0, 0.09, 3, 0.2, 1, 0.8, 0.5], [1.0, 0.62, 4, 0.1, 0.8, 0.9, 1],
  ];
  const n = defs.length; const pos = [], aA = [], aC = [], idx = []; const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  defs.forEach((d, i) => { for (const c of corners) { pos.push(c[0], c[1], 0); aA.push(d[0], d[1], d[2], d[3]); aC.push(d[4], d[5], d[6]); } idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.Float32BufferAttribute(aA, 4)); g.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 3)); g.setIndex(idx);
  const U = { uSun: { value: new THREE.Vector2() }, uAspect: { value: 1.78 }, uVis: { value: 0 }, uGhost: { value: 0 }, uTime: { value: 0 }, uScale: { value: opts.size ?? 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: FLARE_VERT, fragmentShader: FLARE_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false });
  const flare = new THREE.Mesh(g, m); flare.frustumCulled = false; flare.renderOrder = 10; flare.name = 'sunFlare'; root.add(flare); void n;
  const sun = { root, light, direction: dir, occluders: [], flare };
  const _v = new V3(), _c = new V3();
  flare.onBeforeRender = (renderer, scene, camera) => {
    _v.copy(dir).transformDirection(camera.matrixWorldInverse); // view-space direction
    const front = _v.z < 0 ? 1 : 0; const nx = front ? camera.projectionMatrix.elements[0] * _v.x / -_v.z : 9, ny = front ? camera.projectionMatrix.elements[5] * _v.y / -_v.z : 9;
    U.uSun.value.set(nx, ny); U.uAspect.value = camera.aspect; const off = Math.max(Math.abs(nx), Math.abs(ny));
    let occ = 1; camera.getWorldPosition(_c);
    for (const o of sun.occluders) { const to = o.center.clone().sub(_c); const dist = to.length(); const ang = Math.asin(Math.min(1, o.radius / dist)); const th = Math.acos(clamp(to.normalize().dot(dir), -1, 1)); occ *= smoothstep(ang - 0.01, ang + 0.02, th); }
    U.uVis.value = front * smoothstep(2.6, 1.5, off); U.uGhost.value = smoothstep(1.7, 0.8, off) * occ;
  };
  sun.setDirection = (v) => { dir.copy(v).normalize(); light.position.copy(dir).multiplyScalar(1000); light.target.position.set(0, 0, 0); return sun; };
  sun.setIntensity = (k) => { light.intensity = k; return sun; };
  sun.setGlare = (k) => { U.uScale.value = k; flare.visible = k > 0.01; return sun; };
  sun.update = (dt, t) => { U.uTime.value = t; light.position.copy(dir).multiplyScalar(1000); };
  sun.dispose = () => { g.dispose(); m.dispose(); light.dispose?.(); if (root.parent) root.parent.remove(root); };
  sun.setDirection(dir);
  return sun;
}

/** Stylised "sun" for spots where only a glow disc is needed: alias of createSun with a stronger glare. */
export const createSunGlare = (o = {}) => createSun({ size: 1.4, ...o });
