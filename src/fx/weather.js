// Weather & atmosphere: rain (streaks + splashes), snow, ash fall, ember fields — stateless GPU "volume fields" that wrap
// around a centre (camera-following or fixed area) — plus branching lightning bolts and storms.
import * as THREE from 'three';
import { Q, clamp } from '../engine/common.js';
import { px, py, pz, resolve, toColor, glowSprite, G_SOFT, G_STAR, TAU } from './util.js';
import { NOISE_GLSL } from './pools.js';
import { flakeAtlas, glowAtlas } from './textures.js';

const _c = new THREE.Color(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _w = new THREE.Vector3();

const VS = /* glsl */`
precision highp float;
uniform float uTime, uViewH, uIntensity, uSize, uSway, uMinPx, uShutter, uSeedT;
uniform vec3 uCenter, uBox, uVel;
attribute vec4 aS; // xyz lattice position 0..1, w size variation
attribute vec4 aT; // speed var, phase, keep, extra
varying vec2 vUv; varying vec4 vI; varying float vFrame;
#include <fog_pars_vertex>
${NOISE_GLSL}
void main() {
  if (aT.z > uIntensity) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float spd = 0.8 + 0.4 * aT.x;
  vec3 vel = uVel * spd;
  float ph = aT.y * 6.2831;
#if defined(F_SNOW) || defined(F_ASH) || defined(F_EMBER)
  vec3 sw = uSway * vec3(sin(uTime * (0.6 + aT.x) + ph) + 0.5 * sin(uTime * 1.9 + ph * 2.0), 0.15 * sin(uTime * 1.3 + ph), cos(uTime * (0.5 + aT.x * 0.9) + ph * 1.7) + 0.5 * sin(uTime * 2.3 + ph));
#else
  vec3 sw = vec3(0.0);
#endif
#ifdef F_SPLASH
  // splashes live on the ground plane: lattice in xz only, y = floor
  vec3 minC = vec3(uCenter.x - 0.5 * uBox.x, uCenter.y - 0.5 * uBox.y, uCenter.z - 0.5 * uBox.z);
  vec2 rel2 = mod(aS.xz * uBox.xz - minC.xz, uBox.xz);
  vec3 P = vec3(minC.x + rel2.x, minC.y + 0.03, minC.z + rel2.y);
  vec2 q2 = abs(rel2 / uBox.xz - 0.5) * 2.0;
  float fade = (1.0 - smoothstep(0.55, 1.0, q2.x)) * (1.0 - smoothstep(0.55, 1.0, q2.y));
  float period = 0.5 + aT.x * 0.6;
  float cyc = fract(uTime / period + aT.y);
  float duty = 0.42;
  if (cyc > duty) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float age01 = cyc / duty;
#else
  vec3 minC = uCenter - 0.5 * uBox;
  vec3 p = aS.xyz * uBox + vel * uTime + sw;
  vec3 rel = mod(p - minC, uBox);
  vec3 P = minC + rel;
  vec3 q = abs(rel / uBox - 0.5) * 2.0;
  float fade = (1.0 - smoothstep(0.62, 1.0, q.x)) * (1.0 - smoothstep(0.62, 1.0, q.z)) * (1.0 - smoothstep(0.88, 1.0, q.y));
  #ifdef F_EMBER
    fade *= smoothstep(0.0, 0.12, rel.y / uBox.y);
  #endif
  float age01 = 0.0;
#endif
  vec4 mvPosition = modelViewMatrix * vec4(P, 1.0);
  float dist = -mvPosition.z;
  float nearF = smoothstep(0.35, 1.6, dist);
  float pxm = max(dist, 0.01) * 2.0 / (uViewH * projectionMatrix[1][1]);
  float sz = uSize * (0.6 + 0.8 * aS.w);
#ifdef F_RAIN
  {
    vec3 Pt = P - vel * uShutter * (0.8 + 0.4 * aS.w);
    vec4 mt = modelViewMatrix * vec4(Pt, 1.0);
    vec2 d2 = mvPosition.xy - mt.xy; float len = length(d2); vec2 dir = len > 1e-6 ? d2 / len : vec2(0.0, 1.0); vec2 perp = vec2(-dir.y, dir.x);
    float w = max(sz * 0.5, uMinPx * pxm * 0.5);
    float u = position.x + 0.5;
    vec4 mv = mix(mt, mvPosition, u);
    mv.xy += perp * position.y * 2.0 * w;
    gl_Position = projectionMatrix * mv;
    vUv = vec2(u, position.y * 2.0);
    fade *= min(1.0, sz * 0.5 / max(w, 1e-5));
    mvPosition = mv;
  }
#elif defined(F_SPLASH)
  {
    float s = uSize * (0.7 + 0.8 * aS.w);
    mvPosition.xy += position.xy * 2.0 * s;
    gl_Position = projectionMatrix * mvPosition;
    vUv = position.xy * 2.0;
  }
#else
  {
    float w = max(sz, uMinPx * pxm * 0.5);
    float rot = ph + uTime * (0.4 + aT.x * 1.3) * (aT.w > 0.5 ? 1.0 : -1.0);
    float cr = cos(rot), sr = sin(rot);
    vec2 c = position.xy * 2.0;
  #ifdef F_ASH
    c.x *= 0.45 + 0.55 * abs(cos(uTime * (0.8 + aT.x * 1.2) + ph)); // tumbling flake
  #endif
    mvPosition.xy += vec2(c.x * cr - c.y * sr, c.x * sr + c.y * cr) * w;
    gl_Position = projectionMatrix * mvPosition;
    vUv = position.xy + 0.5;
    fade *= min(1.0, sz / max(w, 1e-5));
  }
#endif
  float soft = 1.0;
#ifdef F_SNOW
  soft = mix(0.35, 1.0, smoothstep(1.0, 6.0, dist)); // near flakes defocus: softer & dimmer
#endif
  vFrame = floor(aT.w * 3.0) + 1.0; // flake tiles 1..3
  float tw = 1.0;
#ifdef F_EMBER
  tw = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * (7.0 + aT.x * 9.0) + ph * 3.0));
#endif
  vI = vec4(fade * nearF * soft, tw, age01, aT.x);
  #include <fog_vertex>
}`;

const FS = /* glsl */`
precision highp float;
uniform vec3 uColor, uLight;
uniform float uAlpha, uFogAdd;
uniform sampler2D tMap;
varying vec2 vUv; varying vec4 vI; varying float vFrame;
#include <fog_pars_fragment>
void main() {
  vec4 outc;
#ifdef F_RAIN
  float y = abs(vUv.y), x = vUv.x;
  float a = pow(max(1.0 - y, 0.0), 1.3) * smoothstep(0.0, 1.0, x) * (0.4 + 0.6 * x);
  outc = vec4(uColor * uLight * a * vI.x * uAlpha, a * vI.x * uAlpha * 0.65);
#elif defined(F_SPLASH)
  vec2 p = vUv; float a01 = vI.z;
  // compressed ring on the ground + small crown of droplets
  vec2 e = vec2(p.x, p.y * 2.6);
  float r = length(e);
  float ring = exp(-pow((r - mix(0.12, 0.85, a01)) / 0.1, 2.0)) * (1.0 - a01);
  float ang = atan(p.y + 0.35, p.x);
  float crown = pow(max(0.0, abs(cos(ang * 3.5))), 6.0) * smoothstep(0.0, 0.4, p.y + 0.35) * exp(-length(vec2(p.x, (p.y + 0.35) * 0.9)) * 2.5 * (0.4 + a01)) * (1.0 - a01) * 0.8;
  float a = clamp(ring * 0.9 + crown, 0.0, 1.0);
  outc = vec4(uColor * uLight * a * vI.x * uAlpha, a * vI.x * uAlpha * 0.5);
#elif defined(F_SNOW)
  float r = length(vUv * 2.0 - 1.0);
  float a = 1.0 - smoothstep(0.15, 1.0, r); a *= a;
  outc = vec4(uColor * uLight * a * vI.x * uAlpha, a * vI.x * uAlpha);
#elif defined(F_ASH)
  float fr = vFrame;
  float t = texture2D(tMap, (vec2(mod(fr, 2.0), floor(fr / 2.0)) + clamp(vUv, 0.01, 0.99)) * 0.5).r;
  outc = vec4(uColor * uLight * t * vI.x * uAlpha, t * vI.x * uAlpha);
#else // ember
  float r = length(vUv * 2.0 - 1.0);
  float a = exp(-r * r * 5.0);
  vec3 col = mix(vec3(1.0, 0.35, 0.06), vec3(1.0, 0.8, 0.45), exp(-r * r * 14.0)) * 2.6;
  outc = vec4(col * a * vI.x * vI.y * uAlpha, 1.0);
#endif
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  outc.rgb = mix(outc.rgb, fogColor * outc.a, fogFactor * (1.0 - uFogAdd));
  outc.rgb *= mix(1.0, 1.0 - fogFactor, uFogAdd);
#endif
  gl_FragColor = outc;
}`;

function makeMesh(fx, kind, count, seed, box, cfg) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const aS = new Float32Array(count * 4), aT = new Float32Array(count * 4); let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) { for (let j = 0; j < 4; j++) { aS[i * 4 + j] = rnd(); aT[i * 4 + j] = rnd(); } }
  geo.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 4)); geo.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 4)); geo.instanceCount = count; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const additive = kind === 'ember';
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uIntensity: { value: 1 }, uSize: { value: cfg.size }, uSway: { value: cfg.sway ?? 0 }, uMinPx: { value: cfg.minPx ?? 1.2 }, uShutter: { value: cfg.shutter ?? 0.04 }, uSeedT: { value: 0 },
    uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(box[0], box[1], box[2]) }, uVel: { value: new THREE.Vector3(...cfg.vel) },
    uColor: { value: new THREE.Color(...(cfg.color || [1, 1, 1])) }, uLight: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: cfg.alpha ?? 1 }, uFogAdd: { value: additive ? 1 : 0 }, tMap: { value: cfg.tex || null },
  }]);
  u.uTime = fx.shared.uTime; u.uViewH = fx.shared.uViewH;
  const def = {}; def['F_' + kind.toUpperCase()] = 1;
  const add = [THREE.OneFactor, THREE.OneFactor], pm = [THREE.OneFactor, THREE.OneMinusSrcAlphaFactor]; const bl = additive ? add : pm;
  const mat = new THREE.ShaderMaterial({ defines: def, uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: bl[0], blendDst: bl[1], blendSrcAlpha: bl[0], blendDstAlpha: bl[1] });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = cfg.order ?? 107; mesh.name = 'fx_' + kind;
  return mesh;
}

class Field {
  constructor(fx, o, kind, parts) {
    this.fx = fx; this.kind = kind; this.dead = false; this.intensity = o.intensity ?? 1; this.target = this.intensity; this.fadeRate = 0.7;
    this.parts = parts; this.centerSpec = o.center ?? null; this.follow = !o.area && !o.center; this.ground = o.groundY; this.stopping = false; this.centerFixed = new THREE.Vector3();
    if (o.area) { const a = o.area; if (a.center) this.centerFixed.set(px(a.center), py(a.center), pz(a.center)); else this.centerFixed.set(a.x ?? 0, a.y ?? 0, a.z ?? 0); }
    for (const m of parts) { fx.root.add(m); m.onBeforeRender = (r, sc, cam) => { fx.shared.onBefore(r, sc, cam); this._place(m, cam); }; }
    fx.fields.push(this);
  }
  _place(m, cam) {
    const u = m.material.uniforms, box = u.uBox.value; const g = this.ground !== undefined ? this.ground : this.fx.shared.uGround.value;
    const ground = this.kind === 'rain';
    if (this.follow) { cam.getWorldPosition(_v); u.uCenter.value.set(_v.x, g + box.y * 0.5, _v.z); }
    else if (this.centerSpec) { resolve(this.centerSpec, _v); u.uCenter.value.set(_v.x, ground ? g + box.y * 0.5 : _v.y, _v.z); }
    else { u.uCenter.value.copy(this.centerFixed); if (ground) u.uCenter.value.y = g + box.y * 0.5; }
  }
  update(fx, t, dt) {
    const S = fx.shared; const amb = S.uAmbient.value, sun = S.uSunColor.value;
    if (this.stopping) { this.intensity = Math.max(0, this.intensity - dt * this.fadeRate); if (this.intensity <= 0) { this.dispose(fx); return; } }
    else this.intensity += (this.target - this.intensity) * Math.min(1, dt * 4);
    for (const m of this.parts) {
      const u = m.material.uniforms; u.uIntensity.value = this.intensity;
      if (this.kind !== 'ember') u.uLight.value.setRGB(Math.min(1.3, amb.r * 1.1 + sun.r * 0.45), Math.min(1.3, amb.g * 1.1 + sun.g * 0.45), Math.min(1.3, amb.b * 1.1 + sun.b * 0.45));
      m.visible = this.intensity > 0.002;
    }
  }
  setIntensity(v) { this.target = v; return this; }
  setWind(x, z) { for (const m of this.parts) { const v = m.material.uniforms.uVel.value; const k = m.userData.windK ?? 1; v.x = x * k; v.z = z * k; } return this; }
  stop(fade = 1.5) { this.stopping = true; this.fadeRate = Math.max(0.01, this.intensity) / Math.max(0.05, fade); return this; }
  dispose(fx) {
    if (this._disposed) return; this._disposed = true; this.dead = true;
    for (const m of this.parts) { fx.root.remove(m); m.geometry.dispose(); m.material.dispose(); }
    const i = fx.fields.indexOf(this); if (i >= 0) fx.fields.splice(i, 1);
  }
}

const boxOf = (o, def) => (o.size ? [o.size[0], o.size[1], o.size[2]] : o.area ? [o.area.w ?? o.area.size?.[0] ?? def[0], o.area.h ?? o.area.size?.[1] ?? def[1], o.area.d ?? o.area.size?.[2] ?? def[2]] : def);

export function rain(fx, o = {}) {
  if (typeof o === 'function') o = { center: o };
  const box = boxOf(o, [36, 22, 36]); const wind = o.wind || [1.5, 0.5]; const speed = o.speed ?? 11; const q = Math.max(0.3, Q.particles);
  const nearN = Math.round((o.count ?? 3400) * q), farN = Math.round(1100 * q), splN = Math.round((o.splashes === false ? 0 : 1300) * q);
  const seed = (++fx.counter) * 31 + 3;
  const near = makeMesh(fx, 'rain', nearN, seed, box, { size: 0.012, vel: [wind[0], -speed, wind[1]], color: [0.72, 0.78, 0.9], alpha: 0.55, shutter: 0.045, order: 108 });
  const far = makeMesh(fx, 'rain', farN, seed + 1, [box[0] * 3.2, box[1] * 2.2, box[2] * 3.2], { size: 0.03, vel: [wind[0], -speed, wind[1]], color: [0.7, 0.76, 0.88], alpha: 0.26, shutter: 0.05, order: 107, minPx: 1.4 });
  far.userData.share = 1; const parts = [near, far];
  near.userData.windK = 1; far.userData.windK = 1;
  if (splN > 0) { const spl = makeMesh(fx, 'splash', splN, seed + 2, [box[0] * 0.8, 1, box[2] * 0.8], { size: 0.09, vel: [0, 0, 0], color: [0.8, 0.86, 0.95], alpha: 0.7, order: 107 }); spl.userData.windK = 0; parts.push(spl); }
  const f = new Field(fx, { ...o }, 'rain', parts);
  return f;
}

export function snow(fx, o = {}) {
  if (typeof o === 'function') o = { center: o };
  const box = boxOf(o, [34, 20, 34]); const wind = o.wind || [0.8, 0.3]; const q = Math.max(0.3, Q.particles);
  const seed = (++fx.counter) * 37 + 5;
  const a = makeMesh(fx, 'snow', Math.round((o.count ?? 2600) * q), seed, box, { size: 0.035, vel: [wind[0], -(o.speed ?? 1.3), wind[1]], sway: 0.5, color: [0.95, 0.97, 1.0], alpha: 0.85, order: 108, minPx: 1.6 });
  const b = makeMesh(fx, 'snow', Math.round(1400 * q), seed + 1, [box[0] * 2.6, box[1] * 1.8, box[2] * 2.6], { size: 0.06, vel: [wind[0], -(o.speed ?? 1.3), wind[1]], sway: 0.9, color: [0.95, 0.97, 1.0], alpha: 0.55, order: 107, minPx: 1.8 });
  return new Field(fx, { ...o }, 'snow', [a, b]);
}

export function ashFall(fx, o = {}) {
  if (typeof o === 'function') o = { center: o };
  const box = boxOf(o, [34, 20, 34]); const wind = o.wind || [1.4, 0.6]; const q = Math.max(0.3, Q.particles);
  const seed = (++fx.counter) * 41 + 7;
  const a = makeMesh(fx, 'ash', Math.round((o.count ?? 1500) * q), seed, box, { size: 0.06, vel: [wind[0], -(o.speed ?? 0.9), wind[1]], sway: 0.8, color: o.color || [0.2, 0.19, 0.18], alpha: 0.9, order: 108, tex: flakeAtlas(), minPx: 1.8 });
  const b = makeMesh(fx, 'ash', Math.round(900 * q), seed + 1, [box[0] * 2.4, box[1] * 1.8, box[2] * 2.4], { size: 0.12, vel: [wind[0], -(o.speed ?? 0.9), wind[1]], sway: 1.2, color: o.color || [0.2, 0.19, 0.18], alpha: 0.55, order: 107, tex: flakeAtlas(), minPx: 2 });
  return new Field(fx, { ...o }, 'ash', [a, b]);
}

export function embersField(fx, o = {}) {
  if (typeof o === 'function') o = { center: o };
  const box = boxOf(o, [50, 30, 50]); const wind = o.wind || [1.2, 0.4]; const q = Math.max(0.3, Q.particles);
  const seed = (++fx.counter) * 43 + 9;
  const a = makeMesh(fx, 'ember', Math.round((o.count ?? 700) * q), seed, box, { size: 0.06, vel: [wind[0], o.rise ?? 1.6, wind[1]], sway: 1.4, alpha: o.alpha ?? 1, order: 109, minPx: 2.2 });
  return new Field(fx, { ...o }, 'ember', [a]);
}

// ------------------------------------------------------------------------------------------------ lightning
const MAXPTS = 130;
const ptsX = new Float32Array(MAXPTS * 2), ptsY = new Float32Array(MAXPTS * 2), ptsZ = new Float32Array(MAXPTS * 2);

const tmpX = new Float32Array(MAXPTS * 2), tmpY = new Float32Array(MAXPTS * 2), tmpZ = new Float32Array(MAXPTS * 2);
/** midpoint displacement A->B into ptsX/Y/Z; returns the point count (2^levels + 1) */
function jagged(R, ax, ay, az, bx, by, bz, levels, amp, decay) {
  let n = 2; ptsX[0] = ax; ptsY[0] = ay; ptsZ[0] = az; ptsX[1] = bx; ptsY[1] = by; ptsZ[1] = bz;
  for (let l = 0; l < levels; l++) {
    let m = 0;
    for (let i = 0; i < n - 1; i++) {
      tmpX[m] = ptsX[i]; tmpY[m] = ptsY[i]; tmpZ[m] = ptsZ[i]; m++;
      tmpX[m] = (ptsX[i] + ptsX[i + 1]) * 0.5 + R.range(-1, 1) * amp; tmpY[m] = (ptsY[i] + ptsY[i + 1]) * 0.5 + R.range(-1, 1) * amp * 0.45; tmpZ[m] = (ptsZ[i] + ptsZ[i + 1]) * 0.5 + R.range(-1, 1) * amp; m++;
    }
    tmpX[m] = ptsX[n - 1]; tmpY[m] = ptsY[n - 1]; tmpZ[m] = ptsZ[n - 1]; m++;
    for (let i = 0; i < m; i++) { ptsX[i] = tmpX[i]; ptsY[i] = tmpY[i]; ptsZ[i] = tmpZ[i]; }
    n = m; amp *= decay;
  }
  return n;
}

export function lightning(fx, from, to, o = {}) {
  const t0 = (o.t ?? fx.time) + (o.delay || 0);
  const ax = px(from), ay = py(from), az = pz(from);
  const bx = to ? px(to) : ax + (o.dx ?? 0), by = to ? py(to) : fx.shared.uGround.value, bz = to ? pz(to) : az;
  const seed = o.seed ?? ((++fx.counter) * 7727 + 1); const R = fx.newRng(seed);
  const len = Math.hypot(bx - ax, by - ay, bz - az) || 1; const width = o.width ?? Math.max(0.12, len * 0.0012);
  toColor(o.color, _c, [0.62, 0.68, 1.0]); const life = o.life ?? 0.55; const inten = o.intensity ?? 1.6;
  const budget = Math.max(0.35, Q.particles); const levels = budget > 0.6 ? 6 : 5;
  const n = jagged(R, ax, ay, az, bx, by, bz, levels, len * 0.045, 0.52);
  // snapshot main points (the branch generator below reuses the scratch arrays)
  const mx = new Float32Array(n), my = new Float32Array(n), mz = new Float32Array(n); for (let i = 0; i < n; i++) { mx[i] = ptsX[i]; my[i] = ptsY[i]; mz[i] = ptsZ[i]; }
  const pool = fx.bolts; const dirx = (bx - ax) / len, diry = (by - ay) / len, dirz = (bz - az) / len;
  for (let i = 0; i < n - 1; i++) pool.add(mx[i], my[i], mz[i], mx[i + 1], my[i + 1], mz[i + 1], t0, life, width, 0, i / (n - 1), inten, _c.r, _c.g, _c.b, R.next());
  // branches
  const nb = Math.round((o.branches ?? 7) * (budget > 0.6 ? 1 : 0.6));
  for (let b = 0; b < nb; b++) {
    const si = Math.floor(R.range(0.12, 0.9) * (n - 1)); const order = si / (n - 1);
    const sx = mx[si], sy = my[si], sz = mz[si];
    // branch direction: roughly downward and sideways
    _a.set(R.range(-1, 1), R.range(-0.9, -0.15), R.range(-1, 1)).normalize(); _a.addScaledVector(_b.set(dirx, diry, dirz), 0.5).normalize();
    const bl = len * R.range(0.1, 0.32) * (1 - order * 0.5);
    const ex = sx + _a.x * bl, ey = sy + _a.y * bl, ez = sz + _a.z * bl;
    const bn = jagged(R, sx, sy, sz, ex, ey, ez, 3, bl * 0.12, 0.55);
    const bxs = new Float32Array(bn), bys = new Float32Array(bn), bzs = new Float32Array(bn); for (let i = 0; i < bn; i++) { bxs[i] = ptsX[i]; bys[i] = ptsY[i]; bzs[i] = ptsZ[i]; }
    for (let i = 0; i < bn - 1; i++) pool.add(bxs[i], bys[i], bzs[i], bxs[i + 1], bys[i + 1], bzs[i + 1], t0, life * R.range(0.55, 0.85), width * 0.5, 0.55, Math.min(1, order + (i / (bn - 1)) * 0.12), inten * 0.55, _c.r, _c.g, _c.b, R.next());
    if (R.chance(0.35)) { // sub-branch
      const k = Math.floor(R.range(0.3, 0.8) * (bn - 1)); _w.set(R.range(-1, 1), R.range(-0.8, -0.1), R.range(-1, 1)).normalize(); const sl = bl * R.range(0.25, 0.5);
      const sn = jagged(R, bxs[k], bys[k], bzs[k], bxs[k] + _w.x * sl, bys[k] + _w.y * sl, bzs[k] + _w.z * sl, 2, sl * 0.12, 0.5);
      for (let i = 0; i < sn - 1; i++) pool.add(ptsX[i], ptsY[i], ptsZ[i], ptsX[i + 1], ptsY[i + 1], ptsZ[i + 1], t0, life * R.range(0.4, 0.6), width * 0.28, 1, Math.min(1, order + 0.15), inten * 0.38, _c.r, _c.g, _c.b, R.next());
    }
  }
  // cloud glow, ground flare, light flash for the director
  glowSprite(fx, ax, ay, az, t0, 0.45, len * 0.55, len * 0.8, G_SOFT, _c.r * 2.2, _c.g * 2.2, _c.b * 2.4, 2.2);
  if (to) { glowSprite(fx, bx, by + 0.3, bz, t0 + 0.04, 0.3, Math.max(3, len * 0.04), Math.max(5, len * 0.07), G_STAR, 1.8, 1.9, 2.4, 2.0, R.range(0, 6)); fx.impact([bx, by, bz], [0, 1, 0], { kind: 'energy', size: Math.max(1, len * 0.012), t: t0 + 0.04, seed: seed + 3 }); }
  if (o.flash !== false) fx.addFlash(t0, life * 1.3, o.flash ?? 1.0, ax, ay, az, _c.r, _c.g, _c.b, len, 0, 1);
  fx.emit('lightning', bx, by, bz, t0, len);
}

/** storm({center:[x,y,z]|Vector3, radius=250, height=260, rate=0.18 strikes/s, seed}) -> handle{stop()} — deterministic random strikes */
export function storm(fx, o = {}) {
  const c = o.center ? _v.set(px(o.center), py(o.center), pz(o.center)) : _v.set(0, 0, 0); const cx = c.x, cz = c.z;
  const radius = o.radius ?? 250, height = o.height ?? 260, rate = o.rate ?? 0.18; const gy = fx.shared.uGround.value;
  const h = { dead: false, transient: false, seed: o.seed ?? ((++fx.counter) * 99991 + 3), k: 0, t0: o.t ?? fx.time, stopT: Infinity, rate };
  h.stop = () => { h.stopT = fx.time; return h; };
  h.step = (fx2, t) => {
    if (h.dead) return; const tEnd = Math.min(t, h.stopT); const kEnd = Math.floor((tEnd - h.t0) * rate);
    for (let k = Math.max(h.k, kEnd - 8); k <= kEnd; k++) {
      const R = fx2.rngAt(h.seed, k); const te = h.t0 + k / rate + R.range(0, 1 / rate); const a = R.range(0, TAU), d = Math.sqrt(R.next()) * radius;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; const cloudH = height * R.range(0.85, 1.15);
      lightning(fx2, [x + R.range(-30, 30), cloudH, z + R.range(-30, 30)], [x, gy, z], { t: te, seed: h.seed * 17 + k, flash: o.flash, color: o.color });
      if (R.chance(0.4)) lightning(fx2, [x + R.range(-60, 60), cloudH, z + R.range(-60, 60)], [x + R.range(-60, 60), gy, z + R.range(-60, 60)], { t: te + R.range(0.12, 0.3), seed: h.seed * 19 + k, flash: (o.flash ?? 1) * 0.7, color: o.color });
    }
    if (kEnd + 1 > h.k) h.k = kEnd + 1; if (t >= h.stopT) h.dead = true;
  };
  fx.em.push(h); return h;
}
