// SKY — procedural dome (gradient + Mie glow + sun disc + moon + milky way + stars + volumetric-looking clouds), presets, lighting rig, env map, fog.
// See docs/api/env.md.
import * as THREE from 'three';
import { Q, clamp, lerp, GLOBAL, DEG } from '../engine/common.js';
import { skyNoiseTex } from './env/noise.js';
import { SKY_VERT, SKY_BASE_FRAG, SKY_CLOUD_FRAG } from './env/skyShader.js';
import { createStarDome } from './env/stars.js';
import { PRESETS, PRESET_NAMES, blendDesc, resolve, dirFromAngles, skyRadianceJS, lightningFlash, lightningDir } from './env/palette.js';
import { getWind } from './env/wind.js';

export { lightningFlash, PRESET_NAMES };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (r = 0, g = 0, b = 0) => new THREE.Color(r, g, b);

/** Uniform set shared by the dome, the clouds and anything that wants to reflect the sky (ocean). */
export function createSkyUniforms() {
  return {
    uSunDir: { value: V(0, 1, 0) }, uSunColor: { value: V(1, 1, 1) }, uZenith: { value: V() }, uMid: { value: V() }, uHorizon: { value: V() }, uGround: { value: V() }, uGlow: { value: V() },
    uSunDisc: { value: 20 }, uGlowAmt: { value: 1 }, uWide: { value: 0 }, uTime: { value: 0 }, uSunCos: { value: Math.cos(0.0145) },
    uFlashCol: { value: V(0.7, 0.8, 1.0) }, uFlash: { value: 0 }, uFlashDir: { value: V(0, 0.5, 1) },
    uMoonDir: { value: V(0, 0.5, 0.8) }, uMoonLight: { value: V(0, 0, 1) }, uMoonAmt: { value: 1 }, uMilky: { value: 0 },
    uNoise: { value: null },
    // clouds
    uCover: { value: 0.4 }, uSharp: { value: 0.12 }, uDens: { value: 0.95 }, uCirrus: { value: 0.3 }, uWind: { value: new THREE.Vector2(0.004, 0.0015) }, uScale: { value: 0.34 }, uQuality: { value: 1 },
    uCloudLit: { value: V(1, 1, 1) }, uCloudShade: { value: V(0.4, 0.4, 0.5) }, uCloudRim: { value: V(1, 0.8, 0.6) },
  };
}

const setV = (u, a) => u.value.set(a[0], a[1], a[2]);
const _tmp = [0, 0, 0];

export function createSky(preset = 'day', opts = {}) {
  const uniforms = createSkyUniforms(); uniforms.uNoise.value = skyNoiseTex();
  const root = new THREE.Group(); root.name = 'sky';

  const mkMat = (frag, extra = {}) => new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: frag, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false, dithering: true, ...extra });
  const domeMat = mkMat(SKY_BASE_FRAG);
  const cloudMat = mkMat(SKY_CLOUD_FRAG, { transparent: true, depthTest: true });
  const geo = new THREE.SphereGeometry(1, 40, 20);
  const dome = new THREE.Mesh(geo, domeMat); dome.renderOrder = -1000; dome.frustumCulled = false; dome.name = 'skyDome';
  const clouds = new THREE.Mesh(geo, cloudMat); clouds.renderOrder = -998; clouds.frustumCulled = false; clouds.name = 'skyClouds';
  const stars = createStarDome({ count: Q.level === 0 ? 1800 : Q.level === 1 ? 3500 : 6000, seed: 7 });
  stars.root.children[0].renderOrder = -999;
  root.add(dome, stars.root, clouds);

  // lights
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.name = 'sun';
  const hemi = new THREE.HemisphereLight(0xaaccff, 0x554433, 0.5); hemi.name = 'hemi';
  root.add(sun, sun.target, hemi);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;

  const sky = {
    root, uniforms, lights: { sun, hemi }, preset, desc: null, P: null,
    flash: 0, lightning: { enabled: true, seed: 1, rate: 1 },
    _base: null, _storm: 0, _smoke: 0, _override: null, _dirty: true, _scenes: new Set(), _env: null, _envKey: '', _envT: -1e9, _focus: V(), _radius: 80, _reach: 0, _hasFocus: false,
    _sunDir: V(0, 1, 0), _moonDir: V(0, 1, 0), _lastShadowSize: 0,
  };

  // ---------- preset / state ----------
  function setBase(desc, name) { sky._base = desc; if (name) sky.preset = name; sky._dirty = true; }
  sky.setPreset = (name, o = {}) => {
    const d = PRESETS[name] || PRESETS.day; setBase({ ...d }, PRESETS[name] ? name : 'day'); sky._override = null;
    if (o.elev !== undefined || o.az !== undefined) sky.setSunAngle(o.elev ?? d.elev, o.az ?? d.az);
    return sky;
  };
  /** Blend two presets (pure function of k: seek-safe). The sun angle blends too unless overridden with setSunAngle afterwards. */
  sky.blend = (a, b, k) => { setBase(blendDesc(PRESETS[a] || PRESETS.day, PRESETS[b] || PRESETS.day, clamp(k)), k < 0.5 ? a : b); sky._override = null; return sky; };
  sky.setSunAngle = (elevDeg, azDeg) => { sky._override = { elev: elevDeg, az: azDeg ?? (sky._override ? sky._override.az : sky._base.az) }; sky._dirty = true; return sky; };
  sky.setMoonAngle = (elevDeg, azDeg) => { sky._moonOverride = { elev: elevDeg, az: azDeg }; sky._dirty = true; return sky; };
  sky.setStorm = (k) => { k = clamp(k); if (k !== sky._storm) { sky._storm = k; sky._dirty = true; } return sky; };
  sky.setSmoke = (k) => { k = clamp(k); if (k !== sky._smoke) { sky._smoke = k; sky._dirty = true; } return sky; };
  sky.setCloudCover = (c) => { sky._coverOverride = c; sky._dirty = true; return sky; };

  function effectiveDesc() {
    let d = { ...sky._base };
    if (sky._override) { d.elev = sky._override.elev; d.az = sky._override.az; }
    if (sky._moonOverride) { d.moonElev = sky._moonOverride.elev; d.moonAz = sky._moonOverride.az ?? d.moonAz; }
    const keep = (t) => ({ ...t, elev: d.elev, az: d.az, moonElev: d.moonElev, moonAz: d.moonAz });
    if (sky._storm > 0) d = blendDesc(d, keep(PRESETS.storm), sky._storm);
    if (sky._smoke > 0) d = blendDesc(d, keep(PRESETS.smoke), sky._smoke);
    if (sky._coverOverride !== undefined) d.cover = sky._coverOverride;
    return d;
  }

  const lightCol = new THREE.Color(), lightCol2 = new THREE.Color(), tmpV = V();
  function apply(t) {
    const d = effectiveDesc(); const P = resolve(d); sky.desc = d; sky.P = P;
    const u = uniforms;
    dirFromAngles(d.elev, d.az, sky._sunDir); dirFromAngles(d.moonElev, d.moonAz, sky._moonDir);
    u.uSunDir.value.copy(sky._sunDir); u.uMoonDir.value.copy(sky._moonDir);
    // moon phase: light comes from "sun" direction, but the sun is far below at night; fake a lit direction relative to moon
    u.uMoonLight.value.set(-0.45, 0.35, 0.82).normalize();
    setV(u.uZenith, P.zenith); setV(u.uMid, P.mid); setV(u.uHorizon, P.horizon); setV(u.uGround, P.ground); setV(u.uGlow, P.glow);
    setV(u.uSunColor, P.sun); u.uSunDisc.value = 24 * P.sunDisc * (P.sunInt > 0.05 ? 1 : 0); u.uGlowAmt.value = P.glowAmt * smooth01(P.sunInt / 1.2);
    u.uWide.value = clamp(1 - (d.elev - 4) / 28) * P.glowAmt;
    u.uMoonAmt.value = clamp((1 - P.day * 0.8) * smooth01((d.moonElev + 2) / 8)) + P.day * 0.12 * smooth01((d.moonElev + 2) / 8);
    u.uMilky.value = P.milky * (1 - 0.7 * d.cover);
    u.uCover.value = P.cover; u.uSharp.value = P.sharp; u.uDens.value = P.dens; u.uCirrus.value = P.cirrus;
    setV(u.uCloudLit, P.cloudLit); setV(u.uCloudShade, P.cloudShade); setV(u.uCloudRim, P.cloudRim);
    stars.setVisibility(P.starVis * (1 - 0.85 * smooth01(d.cover * 1.3 - 0.4)));
    clouds.visible = P.cover > 0.02;
    sky._windMul = P.wind;
    // lights ----------------------------------------------------------------
    const sunW = P.sunInt, moonW = P.moonLightK * P.moonInt;
    const wsum = sunW + moonW + 1e-5;
    tmpV.copy(sky._sunDir).multiplyScalar(sunW / wsum).addScaledVector(sky._moonDir, moonW / wsum);
    if (tmpV.lengthSq() < 1e-6) tmpV.copy(sky._sunDir); tmpV.normalize();
    tmpV.y = Math.max(tmpV.y, 0.04); tmpV.y = Math.min(tmpV.y, 0.985); tmpV.normalize();
    sky._lightDir = (sky._lightDir || V()).copy(tmpV);
    lightCol.setRGB(P.sun[0], P.sun[1], P.sun[2]); lightCol2.setRGB(P.moonColor[0], P.moonColor[1], P.moonColor[2]); lightCol.lerp(lightCol2, moonW / wsum);
    sun.color.copy(lightCol); sun.intensity = sunW + moonW;
    // normalise hemisphere colour to a hue, desaturate a bit
    const hs = P.hemiSky; const mx = Math.max(hs[0], hs[1], hs[2], 1e-4); const lm = (hs[0] * 0.3 + hs[1] * 0.6 + hs[2] * 0.1) / mx;
    hemi.color.setRGB(lerp(hs[0] / mx, lm, 0.35), lerp(hs[1] / mx, lm, 0.35), lerp(hs[2] / mx, lm, 0.35));
    const hg = P.hemiGround; const gm = Math.max(hg[0], hg[1], hg[2], 1e-4); hemi.groundColor.setRGB(hg[0] / gm * 0.8, hg[1] / gm * 0.7, hg[2] / gm * 0.6).multiplyScalar(Math.min(1, gm * 4.5 + 0.12));
    hemi.intensity = P.hemiInt * (1 + 0 * t);
    sky._baseHemi = hemi.intensity; sky._baseSun = sun.intensity;
    updateShadowRig(); sky._dirty = false; sky._envDirty = true;
    // fog ------------------------------------------------------------------
    for (const s of sky._scenes) applyFog(s);
  }
  const smooth01 = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

  function applyFog(scene) {
    const P = sky.P; if (!P) return;
    if (!(scene.fog && scene.fog.isFogExp2)) scene.fog = new THREE.FogExp2(0x000000, 0.0003);
    scene.fog.color.setRGB(P.horizon[0], P.horizon[1], P.horizon[2]); scene.fog.density = P.fogDensity * (sky.fogScale ?? 1);
    if (!scene.background || scene.background.isColor) { scene.background = scene.background && scene.background.isColor ? scene.background : new THREE.Color(); scene.background.copy(scene.fog.color); }
    scene.environmentIntensity = P.envInt * (sky.envScale ?? 1);
  }

  // ---------- shadows ----------
  const _snapX = V(), _snapY = V(), _up = V(0, 1, 0), _foc = V();
  function updateShadowRig() {
    const wantShadow = Q.shadows && sky._shadowsOn !== false && sun.intensity > 0.04;
    const L = sky._lightDir; const radius = sky._radius; const dist = Math.max(160, radius * 3) + sky._reach;
    if (sun.castShadow !== wantShadow) sun.castShadow = wantShadow;
    const size = Q.shadowMap;
    if (wantShadow) {
      if (sky._lastShadowSize !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } sky._lastShadowSize = size; }
      const cam = sun.shadow.camera; cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius; cam.near = 1; cam.far = dist + radius * 2.2 + 50; cam.updateProjectionMatrix();
      sun.shadow.normalBias = Math.max(0.03, 2.0 * radius / size * 1.5);
    }
    // texel snapping in light space to prevent shimmering when the focus moves
    _snapX.crossVectors(_up, L).normalize(); _snapY.crossVectors(L, _snapX).normalize();
    const texel = (2 * radius) / size; _foc.copy(sky._focus);
    const fx = Math.round(_foc.dot(_snapX) / texel) * texel, fy = Math.round(_foc.dot(_snapY) / texel) * texel, fz = _foc.dot(L);
    sun.target.position.set(0, 0, 0).addScaledVector(_snapX, fx).addScaledVector(_snapY, fy).addScaledVector(L, fz);
    sun.position.copy(sun.target.position).addScaledVector(L, dist);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  }
  sky.setShadowFocus = (v3, radius = 80, reach = 0) => { sky._focus.copy(v3); sky._radius = Math.max(2, radius); sky._reach = reach; sky._hasFocus = true; updateShadowRig(); return sky; };
  sky.setShadows = (on) => { sky._shadowsOn = on; updateShadowRig(); return sky; };

  // ---------- environment map (CPU-baked equirect -> three PMREMs it automatically) ----------
  const EW = 64, EH = 32;
  function bakeEnv() {
    const P = sky.P; const data = new Uint16Array(EW * EH * 4); const L = sky._sunDir; const out = [0, 0, 0];
    const toH = THREE.DataUtils.toHalfFloat;
    for (let j = 0; j < EH; j++) {
      const v = (j + 0.5) / EH; const el = (v - 0.5) * Math.PI; const dy = Math.sin(el), cy = Math.cos(el);
      for (let i = 0; i < EW; i++) {
        const u = (i + 0.5) / EW; const az = (u - 0.5) * Math.PI * 2; const dx = Math.cos(az) * cy, dz = Math.sin(az) * cy;
        skyRadianceJS(dx, dy, dz, P, dx * L.x + dy * L.y + dz * L.z, out);
        // stars/moon glow at night: faint moonlit tint
        const k = (j * EW + i) * 4; data[k] = toH(out[0]); data[k + 1] = toH(out[1]); data[k + 2] = toH(out[2]); data[k + 3] = toH(1);
      }
    }
    const tex = new THREE.DataTexture(data, EW, EH, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
    return tex;
  }
  function refreshEnv(t) {
    // rate limit (<= ~5/s) and only when the sky actually changed
    if (!sky._envDirty) return; if (sky._env && Math.abs(t - sky._envT) < 0.2) return;
    const old = sky._env; sky._env = bakeEnv(); sky._envT = t; sky._envDirty = false;
    for (const s of sky._scenes) { s.environment = sky._env; s.environmentIntensity = sky.P.envInt * (sky.envScale ?? 1); }
    if (old) old.dispose();
  }

  // ---------- public ----------
  sky.applyTo = (scene) => {
    sky._scenes.add(scene); scene.userData.sky = sky;
    if (sky._dirty || !sky.P) apply(0);
    if (!root.parent) scene.add(root);
    applyFog(scene);
    refreshEnvNow(); scene.environment = sky._env; scene.environmentIntensity = sky.P.envInt * (sky.envScale ?? 1);
    return sky.lights;
  };
  function refreshEnvNow() { if (sky._envDirty || !sky._env) { sky._envT = -1e9; refreshEnv(0); } }

  sky.sunDirection = (out = V()) => out.copy(sky._sunDir);
  sky.moonDirection = (out = V()) => out.copy(sky._moonDir);
  sky.lightDirection = (out = V()) => out.copy(sky._lightDir);
  sky.fogColor = (out = new THREE.Color()) => out.setRGB(sky.P.horizon[0], sky.P.horizon[1], sky.P.horizon[2]);
  sky.lightningFlash = (t) => lightningFlash(t, sky.lightning.seed, sky.lightning.rate);

  let lastQ = -1;
  sky.update = (dt, t) => {
    if (sky._dirty || !sky.P) apply(t);
    if (lastQ !== Q.level) { lastQ = Q.level; uniforms.uQuality.value = Q.level > 0 ? 1 : 0; sky._lastShadowSize = 0; updateShadowRig(); }
    uniforms.uTime.value = t; stars.update(t);
    const w = getWind();
    uniforms.uWind.value.set(0.0035 * Math.cos(w.dir), 0.0035 * Math.sin(w.dir)).multiplyScalar(sky._windMul * (0.7 + 0.5 * w.strength));
    // lightning
    const stormK = Math.max(sky._storm, sky.desc.storm);
    let f = 0;
    if (sky.lightning.enabled && stormK > 0.25) { f = lightningFlash(t, sky.lightning.seed, sky.lightning.rate) * smooth01((stormK - 0.25) / 0.5); lightningDir(t, sky.lightning.seed, sky.lightning.rate, uniforms.uFlashDir.value); }
    if (f !== sky.flash) {
      sky.flash = f; uniforms.uFlash.value = f * 0.55;
      hemi.intensity = sky._baseHemi + f * 2.2; sun.intensity = sky._baseSun + f * 1.5;
      for (const s of sky._scenes) s.environmentIntensity = sky.P.envInt * (sky.envScale ?? 1) * (1 + f * 3);
    }
    refreshEnv(t);
  };

  sky.dispose = () => {
    geo.dispose(); domeMat.dispose(); cloudMat.dispose(); stars.dispose();
    if (sky._env) sky._env.dispose(); sky._env = null;
    for (const s of sky._scenes) { if (s.userData.sky === sky) delete s.userData.sky; if (s.environment === sky._env) s.environment = null; }
    sky._scenes.clear(); sun.dispose?.(); if (root.parent) root.parent.remove(root); sun.shadow.map?.dispose();
  };

  sky.setPreset(preset, opts);
  apply(0);
  return sky;
}

/** Convenience: list of preset names. */
export const SKY_PRESETS = PRESET_NAMES;
