// Non-billboard pooled effects: oriented shock rings, fresnel shells, ground decals, instanced debris chunks,
// comet/reentry ribbons and lightning ribbons. Same philosophy as pools.js: spawn once, evaluate analytically from time.
import * as THREE from 'three';
import { Q, RNG } from '../engine/common.js';
import { scorchTexture } from './textures.js';
import { NOISE_GLSL } from './pools.js';

const FOG_FRAG = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  outc.rgb = mix(outc.rgb, fogColor * outc.a, fogFactor * (1.0 - uFogAdd));
  outc.rgb *= mix(1.0, 1.0 - fogFactor, uFogAdd);
#endif
`;
const ADD = [THREE.OneFactor, THREE.OneFactor];
const PREMUL = [THREE.OneFactor, THREE.OneMinusSrcAlphaFactor];

function makeMat(shared, { vs, fs, defines = {}, blend = ADD, uniforms = {}, side = THREE.DoubleSide, depthTest = true, polygon = false }) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]);
  u.uTime = shared.uTime; u.uSunColor = shared.uSunColor; u.uAmbient = shared.uAmbient; u.uViewH = shared.uViewH; u.uGround = shared.uGround;
  u.uFogAdd = { value: blend === ADD ? 1 : 0 };
  const m = new THREE.ShaderMaterial({ defines, uniforms: u, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, depthTest, side, fog: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: blend[0], blendDst: blend[1], blendSrcAlpha: blend[0], blendDstAlpha: blend[1] });
  if (polygon) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  return m;
}

/** generic ring-buffer for an instanced mesh with N vec4 interleaved attributes */
class InstPool {
  constructor(geo, names, cap) {
    this.cap = cap; this.stride = names.length * 4; this.data = new Float32Array(cap * this.stride); this.head = 0; this.high = 0; this.wrapped = false; this.endTime = -1; this.dirty = false;
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, this.stride, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    names.forEach((n, i) => geo.setAttribute(n, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    geo.instanceCount = 0; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9); this.geo = geo;
  }
  write(arr, endTime) {
    const o = this.head * this.stride; for (let i = 0; i < arr.length; i++) this.data[o + i] = arr[i];
    if (endTime > this.endTime) this.endTime = endTime; this.dirty = true;
    this.head++; if (this.head >= this.cap) { this.head = 0; this.wrapped = true; }
    this.high = this.wrapped ? this.cap : Math.max(this.high, this.head);
  }
  flush(t) { if (this.dirty) { this.buf.clearUpdateRanges(); this.buf.needsUpdate = true; this.dirty = false; } this.geo.instanceCount = this.high; this.mesh.visible = this.high > 0 && t < this.endTime + 0.05; }
  clear() { this.data.fill(0); this.head = 0; this.high = 0; this.wrapped = false; this.endTime = -1; this.buf.needsUpdate = true; this.geo.instanceCount = 0; if (this.mesh) this.mesh.visible = false; }
  dispose() { this.geo.dispose(); this.mesh.material.dispose(); }
}

const quadGeo = () => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]); return g; };
const tmpArr = new Float32Array(16);

// ------------------------------------------------------------------------------------------------ rings
const RING_VS = /* glsl */`
precision highp float;
uniform float uTime;
attribute vec4 aA; // center, birth
attribute vec4 aB; // normal (0 = billboard), life
attribute vec4 aC; // r0, r1, thickness (fraction of R), intensity
attribute vec4 aD; // rgb, seed
varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol; varying float vSeed;
#include <fog_pars_vertex>
void main() {
  float age = uTime - aA.w, life = aB.w;
  if (age < 0.0 || age >= life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float a = age / life;
  float e = 1.0 - pow(1.0 - a, 2.4);
  float R = mix(aC.x, aC.y, e);
  float th = max(aC.z * R, 0.04 + R * 0.01);
  float half_ = R + th * 3.0;
  vec3 n = aB.xyz; vec3 T, B;
  if (dot(n, n) < 0.01) { T = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); B = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); }
  else { n = normalize(n); vec3 h = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0); T = normalize(cross(h, n)); B = cross(n, T); }
  vec3 P = aA.xyz + (T * position.x + B * position.y) * 2.0 * half_;
  if (dot(aB.xyz, aB.xyz) > 0.01) P += n * (0.05 + R * 0.0015);
  vec4 mvPosition = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = position.xy * 2.0;
  vInfo = vec4(a, R, th, half_);
  vCol = aD.rgb * aC.w; vSeed = aD.w;
  #include <fog_vertex>
}`;
const RING_FS = /* glsl */`
precision highp float;
uniform float uFogAdd;
varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol; varying float vSeed;
#include <fog_pars_fragment>
${NOISE_GLSL}
void main() {
  float a = vInfo.x, R = vInfo.y, th = vInfo.z, hf = vInfo.w;
  float d = length(vUv) * hf;
  float ang = atan(vUv.y, vUv.x);
  float nz = vnoise(vec3(cos(ang) * 2.5 + vSeed * 9.0, sin(ang) * 2.5, a * 2.0 + vSeed));
  float thk = th * (0.75 + 0.7 * nz);
  float ring = exp(-pow((d - R) / thk, 2.0));
  float trail = exp(-max(R - d, 0.0) / (R * 0.22 + 1e-3)) * 0.18 * step(d, R); // soft inner glow behind the front
  float fade = pow(1.0 - a, 1.6) * smoothstep(0.0, 0.04, a + 0.04);
  vec3 c = vCol * (ring + trail) * fade * (0.7 + 0.6 * nz);
  vec4 outc = vec4(c, 1.0);
  ${FOG_FRAG}
  gl_FragColor = outc;
}`;

export class RingPool extends InstPool {
  constructor(shared, cap) {
    super(quadGeo(), ['aA', 'aB', 'aC', 'aD'], cap);
    this.mesh = new THREE.Mesh(this.geo, makeMat(shared, { vs: RING_VS, fs: RING_FS, polygon: true })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 98; this.mesh.visible = false; this.mesh.name = 'fx_rings';
  }
  /** normal=(0,0,0) -> camera-facing ring */
  add(x, y, z, nx, ny, nz, birth, life, r0, r1, thick, intensity, cr, cg, cb, seed) {
    const a = tmpArr; a[0] = x; a[1] = y; a[2] = z; a[3] = birth; a[4] = nx; a[5] = ny; a[6] = nz; a[7] = life; a[8] = r0; a[9] = r1; a[10] = thick; a[11] = intensity; a[12] = cr; a[13] = cg; a[14] = cb; a[15] = seed; this.write(a, birth + life);
  }
}

// ------------------------------------------------------------------------------------------------ shells
const SHELL_VS = /* glsl */`
precision highp float;
uniform float uTime;
attribute vec4 aA; // center, birth
attribute vec4 aB; // r0, r1, life, intensity
attribute vec4 aC; // rgb, fresnel power
attribute vec4 aD; // seed, growExp, noiseAmt, core(0..1)
varying vec3 vN; varying vec3 vV; varying vec4 vInfo; varying vec3 vCol; varying vec3 vObj; varying float vSeed;
#include <fog_pars_vertex>
void main() {
  float age = uTime - aA.w, life = aB.z;
  if (age < 0.0 || age >= life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float a = age / life;
  float R = mix(aB.x, aB.y, 1.0 - pow(1.0 - a, aD.y));
  vec3 P = aA.xyz + position * R;
  vec4 mvPosition = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vN = normalize(mat3(modelViewMatrix) * position); vV = normalize(-mvPosition.xyz);
  vInfo = vec4(a, aC.w, aB.w, aD.z); vCol = aC.rgb; vObj = position; vSeed = aD.x;
  #include <fog_vertex>
}`;
const SHELL_FS = /* glsl */`
precision highp float;
uniform float uFogAdd; uniform float uTime;
varying vec3 vN; varying vec3 vV; varying vec4 vInfo; varying vec3 vCol; varying vec3 vObj; varying float vSeed;
#include <fog_pars_fragment>
${NOISE_GLSL}
void main() {
  float a = vInfo.x;
  float nv = abs(dot(normalize(vN), normalize(vV)));
  float fres = pow(1.0 - nv, vInfo.y);
  float n = fbm3(vObj * 3.2 + vec3(vSeed * 13.0, a * 1.4, 0.0));
  float pat = mix(1.0, 0.35 + 1.3 * n, vInfo.w);
  float fade = pow(1.0 - a, 1.4) * smoothstep(0.0, 0.03, a + 0.03);
  vec3 c = vCol * (fres * pat * 1.6 + (1.0 - fres) * 0.05 * pat) * vInfo.z * fade;
  vec4 outc = vec4(c, 1.0);
  ${FOG_FRAG}
  gl_FragColor = outc;
}`;

export class ShellPool extends InstPool {
  constructor(shared, cap) {
    const base = new THREE.IcosahedronGeometry(1, Q.level >= 2 ? 4 : Q.level === 1 ? 3 : 2);
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', base.attributes.position); g.setIndex(base.index); base.dispose();
    super(g, ['aA', 'aB', 'aC', 'aD'], cap);
    this.mesh = new THREE.Mesh(this.geo, makeMat(shared, { vs: SHELL_VS, fs: SHELL_FS })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 99; this.mesh.visible = false; this.mesh.name = 'fx_shells';
  }
  add(x, y, z, birth, life, r0, r1, intensity, cr, cg, cb, fresnelPow, seed, growExp = 2, noiseAmt = 0.8) {
    const a = tmpArr; a[0] = x; a[1] = y; a[2] = z; a[3] = birth; a[4] = r0; a[5] = r1; a[6] = life; a[7] = intensity; a[8] = cr; a[9] = cg; a[10] = cb; a[11] = fresnelPow; a[12] = seed; a[13] = growExp; a[14] = noiseAmt; a[15] = 0; this.write(a, birth + life);
  }
}

// ------------------------------------------------------------------------------------------------ decals (scorch)
const DECAL_VS = /* glsl */`
precision highp float;
uniform float uTime;
attribute vec4 aA; // center, birth
attribute vec4 aB; // size, life, rot, opacity
varying vec2 vUv; varying float vA; varying float vOp;
#include <fog_pars_vertex>
void main() {
  float age = uTime - aA.w;
  if (age < 0.0 || age >= aB.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float c = cos(aB.z), s = sin(aB.z);
  vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aB.x;
  vec3 P = vec3(aA.x + q.x, aA.y + 0.03 + aA.w * 0.0, aA.z + q.y);
  vec4 mvPosition = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = position.xy + 0.5; vA = age / aB.y; vOp = aB.w;
  #include <fog_vertex>
}`;
const DECAL_FS = /* glsl */`
precision highp float;
uniform sampler2D tMap; uniform float uFogAdd;
varying vec2 vUv; varying float vA; varying float vOp;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(tMap, vUv);
  float fade = smoothstep(0.0, 0.015, vA) * (1.0 - smoothstep(0.7, 1.0, vA));
  vec4 outc = vec4(t.rgb, t.a * vOp * fade);
  outc.rgb *= outc.a; // premultiplied
  ${FOG_FRAG}
  gl_FragColor = outc;
}`;

export class DecalPool extends InstPool {
  constructor(shared, cap) {
    const g = quadGeo(); super(g, ['aA', 'aB'], cap);
    // quad lies on XZ: rotate by mapping position.xy -> (x,z) in the shader
    this.mesh = new THREE.Mesh(this.geo, makeMat(shared, { vs: DECAL_VS, fs: DECAL_FS, blend: PREMUL, uniforms: { tMap: { value: scorchTexture() } }, polygon: true })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 90; this.mesh.visible = false; this.mesh.name = 'fx_decals';
  }
  add(x, y, z, birth, life, size, rot, opacity) { const a = tmpArr; a[0] = x; a[1] = y; a[2] = z; a[3] = birth; a[4] = size; a[5] = life; a[6] = rot; a[7] = opacity; this.write(a.subarray(0, 8), birth + life); }
}

// ------------------------------------------------------------------------------------------------ ribbons: comet trail (reentry)
const TRAIL_SEGS = 56;
const TRAIL_VS = /* glsl */`
precision highp float;
uniform float uTime;
uniform float uViewH;
attribute vec2 aSeg; // x = s (0 head .. 1 tail), y = side (-1,1)
attribute vec4 aA; // from, birth
attribute vec4 aB; // to, life
attribute vec4 aC; // size, trailTime, seed, intensity
attribute vec4 aD; // rgb(mid colour), curve
varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol;
#include <fog_pars_vertex>
${NOISE_GLSL}
vec3 pathAt(float u) {
  vec3 p = mix(aA.xyz, aB.xyz, u);
  vec3 d = aB.xyz - aA.xyz;
  vec3 side = normalize(cross(d, vec3(0.0, 1.0, 0.0)) + vec3(0.001));
  p += side * aD.w * length(d) * sin(u * 3.14159) * 0.12; // slight arc
  return p;
}
void main() {
  float age = uTime - aA.w;
  float life = aB.w, tt = aC.y;
  if (age < 0.0 || age >= life + tt) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float s = aSeg.x;
  float av = age - s * tt;               // age of the path point this vertex shows
  float u = clamp(av / life, 0.0, 1.0);
  float started = step(0.0, av);
  vec3 P = pathAt(u);
  vec3 P2 = pathAt(min(u + 0.01, 1.0)), P1 = pathAt(max(u - 0.01, 0.0));
  vec4 m0 = modelViewMatrix * vec4(P, 1.0);
  vec4 ma = modelViewMatrix * vec4(P1, 1.0), mb = modelViewMatrix * vec4(P2, 1.0);
  vec2 dir = mb.xy - ma.xy; float dl = length(dir); dir = dl > 1e-6 ? dir / dl : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float pxm = max(-m0.z, 0.01) * 2.0 / (uViewH * projectionMatrix[1][1]);
  float grow = 0.12 + pow(s, 0.8) * 1.5;           // plume widens away from the head
  float w = max(aC.x * grow * 0.5, pxm * 0.9);
  // lateral turbulence of the plume
  float wob = (vnoise(vec3(s * 9.0 + aC.z * 7.0, av * 0.9, 1.7)) - 0.5) * aC.x * s * 1.3;
  vec4 mv = m0; mv.xy += perp * (aSeg.y * w + wob);
  float tailFade = 1.0 - smoothstep(0.55, 1.0, s);
  float headCap = smoothstep(0.0, 0.015, s) ;
  gl_Position = projectionMatrix * mv;
  vUv = vec2(s, aSeg.y);
  vInfo = vec4(s, started * tailFade, av, min(1.0, w / max(aC.x * grow * 0.5, 1e-5)));
  vCol = aD.rgb * aC.w;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;
const TRAIL_FS = /* glsl */`
precision highp float;
uniform float uFogAdd; uniform float uTime;
varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol;
#include <fog_pars_fragment>
${NOISE_GLSL}
void main() {
  float s = vInfo.x, y = vUv.y;
  float across = pow(max(1.0 - abs(y), 0.0), 1.4);
  float streak = 0.55 + 0.9 * vnoise(vec3(s * 26.0 - vInfo.z * 14.0, y * 3.0, 3.1)) * (0.6 + 0.4 * vnoise(vec3(s * 70.0, y * 9.0 - vInfo.z * 9.0, 8.3)));
  float heat = pow(max(1.0 - s * 1.35, 0.0), 1.6) * streak;
  // hot core -> glowing orange -> dark smoke
  vec3 mid = vCol;
  vec3 hotc = mix(mid, vec3(1.0, 0.97, 0.88), smoothstep(0.35, 1.0, heat)) * (0.4 + 2.4 * heat);
  vec3 smoke = vec3(0.16, 0.14, 0.13);
  float core = exp(-y * y * 9.0);
  float aSmoke = across * (1.0 - smoothstep(0.0, 0.3, s)) * 0.0 + across * 0.55 * smoothstep(0.1, 0.5, s) * (1.0 - smoothstep(0.75, 1.0, s));
  vec3 col = hotc * (across * 0.55 + core * 0.9) * heat + smoke * aSmoke;
  float alpha = (across * 0.7 + core * 0.3) * vInfo.y * (0.25 + 0.75 * heat) + aSmoke;
  alpha = clamp(alpha, 0.0, 1.0) * vInfo.w;
  vec4 outc = vec4(col * vInfo.y * vInfo.w, alpha * (1.0 - clamp(heat * 1.5, 0.0, 1.0)));
  ${FOG_FRAG}
  gl_FragColor = outc;
}`;

export class TrailPool extends InstPool {
  constructor(shared, cap) {
    const g = new THREE.InstancedBufferGeometry(); const n = TRAIL_SEGS; const seg = new Float32Array((n + 1) * 2 * 2); const pos = new Float32Array((n + 1) * 2 * 3); const idx = [];
    for (let i = 0; i <= n; i++) { for (let k = 0; k < 2; k++) { const v = i * 2 + k; seg[v * 2] = i / n; seg[v * 2 + 1] = k ? 1 : -1; } if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeg', new THREE.BufferAttribute(seg, 2)); g.setIndex(idx);
    super(g, ['aA', 'aB', 'aC', 'aD'], cap);
    this.mesh = new THREE.Mesh(this.geo, makeMat(shared, { vs: TRAIL_VS, fs: TRAIL_FS, blend: PREMUL })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 102; this.mesh.visible = false; this.mesh.name = 'fx_trails';
  }
  add(fx, fy, fz, tx, ty, tz, birth, life, size, trailTime, seed, intensity, cr, cg, cb, curve) {
    const a = tmpArr; a[0] = fx; a[1] = fy; a[2] = fz; a[3] = birth; a[4] = tx; a[5] = ty; a[6] = tz; a[7] = life; a[8] = size; a[9] = trailTime; a[10] = seed; a[11] = intensity; a[12] = cr; a[13] = cg; a[14] = cb; a[15] = curve; this.write(a, birth + life + trailTime);
  }
}

// ------------------------------------------------------------------------------------------------ lightning ribbons
const BOLT_VS = /* glsl */`
precision highp float;
uniform float uTime;
uniform float uViewH;
attribute vec4 aA; // p0, birth
attribute vec4 aB; // p1, life
attribute vec4 aC; // width, level(0 main..1 fine), order(0..1 from top), intensity
attribute vec4 aD; // rgb, seed
varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol;
#include <fog_pars_vertex>
${NOISE_GLSL}
void main() {
  float age = uTime - aA.w, life = aB.w;
  if (age < 0.0 || age >= life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float a = age / life;
  float grow = smoothstep(aC.z * 0.9 - 0.06, aC.z * 0.9, a * 7.0 - 0.0); // stepped leader: grows from the top within ~14% of life
  if (grow <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 m0 = modelViewMatrix * vec4(aA.xyz, 1.0), m1 = modelViewMatrix * vec4(aB.xyz, 1.0);
  vec2 d = m1.xy - m0.xy; float l = length(d); vec2 dir = l > 1e-6 ? d / l : vec2(0.0, -1.0); vec2 perp = vec2(-dir.y, dir.x);
  float u = position.x + 0.5; vec4 mv = mix(m0, m1, u);
  float pxm = max(-mv.z, 0.01) * 2.0 / (uViewH * projectionMatrix[1][1]);
  float w = max(aC.x, pxm * 1.3);
  float glowW = w * 7.0;
  mv.xy += perp * position.y * 2.0 * glowW + dir * (u * 2.0 - 1.0) * glowW * 0.4;
  gl_Position = projectionMatrix * mv;
  // return strokes: main flash, then 2 flickers, then fade; fine branches die first
  float t = age;
  float flick = 0.55 + 0.45 * sin(t * 80.0 + aD.w * 30.0);
  float pulses = exp(-t * 14.0) + 0.7 * exp(-pow((t - 0.11) * 22.0, 2.0)) + 0.5 * exp(-pow((t - 0.2) * 20.0, 2.0));
  float env = (pulses * (0.7 + 0.3 * flick) + 0.18 * (1.0 - a)) * (1.0 - smoothstep(0.55, 1.0, a + aC.y * 0.45));
  vUv = vec2(u, position.y * 2.0);
  vInfo = vec4(env * aC.w, w / glowW, aC.y, min(1.0, w / max(aC.x, 1e-5)) );
  vCol = aD.rgb;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;
const BOLT_FS = /* glsl */`
precision highp float;
uniform float uFogAdd;
varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol;
#include <fog_pars_fragment>
void main() {
  float y = abs(vUv.y);
  float coreW = vInfo.y;
  float core = exp(-pow(y / max(coreW, 1e-4), 2.0) * 1.2);
  float halo = exp(-y * 3.2) * 0.35 + exp(-y * y * 14.0) * 0.5;
  float capx = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
  vec3 white = vec3(1.0, 0.97, 1.0);
  vec3 c = (white * core * 1.6 + vCol * halo) * vInfo.x * (0.35 + 0.65 * capx);
  vec4 outc = vec4(c * vInfo.w, 1.0);
  ${FOG_FRAG}
  gl_FragColor = outc;
}`;

export class BoltPool extends InstPool {
  constructor(shared, cap) {
    super(quadGeo(), ['aA', 'aB', 'aC', 'aD'], cap);
    this.mesh = new THREE.Mesh(this.geo, makeMat(shared, { vs: BOLT_VS, fs: BOLT_FS })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 106; this.mesh.visible = false; this.mesh.name = 'fx_bolts';
  }
  add(ax, ay, az, bx, by, bz, birth, life, width, level, order, intensity, cr, cg, cb, seed) {
    const a = tmpArr; a[0] = ax; a[1] = ay; a[2] = az; a[3] = birth; a[4] = bx; a[5] = by; a[6] = bz; a[7] = life; a[8] = width; a[9] = level; a[10] = order; a[11] = intensity; a[12] = cr; a[13] = cg; a[14] = cb; a[15] = seed; this.write(a, birth + life);
  }
}

// ------------------------------------------------------------------------------------------------ debris chunks
let _debrisGeo = null;
function debrisGeometry() {
  if (_debrisGeo) return _debrisGeo;
  const ico = new THREE.IcosahedronGeometry(0.5, 1);
  const p = ico.attributes.position; const r = new RNG(5);
  const map = new Map();
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3); if (!map.has(k)) map.set(k, 0.62 + r.next() * 0.55); const f = map.get(k); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.9, p.getZ(i) * f); }
  ico.computeVertexNormals(); _debrisGeo = ico; _debrisGeo.userData.shared = true; return _debrisGeo;
}

const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _pos = new THREE.Vector3(), _scl = new THREE.Vector3(), _axis = new THREE.Vector3(), _col = new THREE.Color();
const DSTRIDE = 20;

/** CPU-evaluated (but analytic) ballistic chunks with ground bounce/spin; one InstancedMesh; emissive heat that cools */
export class DebrisPool {
  constructor(shared, cap) {
    this.cap = cap; this.data = new Float32Array(cap * DSTRIDE); this.head = 0; this.high = 0; this.wrapped = false; this.endTime = -1; this.ground = shared.uGround;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.12, flatShading: true });
    this.heat = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); this.heat.setUsage(THREE.DynamicDrawUsage);
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHeat;\nvarying float vHeat;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeat = aHeat;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHeat;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.36, 0.07) * vHeat * 3.2;');
    };
    mat.customProgramCacheKey = () => 'fxdebris';
    const geo = debrisGeometry().clone(); geo.userData.shared = false; geo.setAttribute('aHeat', this.heat);
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.count = 0; this.mesh.visible = false; this.mesh.name = 'fx_debris'; this.mesh.renderOrder = 5;
    _m4.makeScale(0, 0, 0); for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, _m4);
    this.mesh.setColorAt(0, _col.set(0x777777)); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.lastT = -1;
  }
  // data: 0-2 p0, 3 birth, 4-6 v, 7 life, 8-10 scale xyz, 11 spinRate, 12-14 axis, 15 heat0, 16 heatDecay, 17 tau1 (first ground hit), 18 restitution, 19 groundY
  add(x, y, z, vx, vy, vz, birth, life, sx, sy, sz, spin, ax, ay, az, heat0, heatDecay, restitution, color) {
    const o = this.head * DSTRIDE, d = this.data, g = this.ground.value, G = 9.81;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = birth; d[o + 4] = vx; d[o + 5] = vy; d[o + 6] = vz; d[o + 7] = life; d[o + 8] = sx; d[o + 9] = sy; d[o + 10] = sz; d[o + 11] = spin; d[o + 12] = ax; d[o + 13] = ay; d[o + 14] = az; d[o + 15] = heat0; d[o + 16] = heatDecay;
    const h = y - g; d[o + 17] = (vy + Math.sqrt(Math.max(vy * vy + 2 * G * h, 0))) / G; d[o + 18] = restitution; d[o + 19] = g;
    this.mesh.setColorAt(this.head, color); this._colDirty = true;
    if (birth + life > this.endTime) this.endTime = birth + life;
    this.head++; if (this.head >= this.cap) { this.head = 0; this.wrapped = true; } this.high = this.wrapped ? this.cap : Math.max(this.high, this.head);
    this.lastT = -1; // force re-eval
  }
  update(t) {
    const m = this.mesh; m.visible = this.high > 0 && t < this.endTime + 0.05; if (!m.visible) { m.count = 0; return; }
    m.count = this.high; const d = this.data, arr = m.instanceMatrix.array, hv = this.heat.array, G = 9.81;
    for (let i = 0; i < this.high; i++) {
      const o = i * DSTRIDE; const age = t - d[o + 3], life = d[o + 7]; const k = i * 16;
      if (age < 0 || age >= life) { if (arr[k] !== 0) { for (let j = 0; j < 16; j++) arr[k + j] = 0; hv[i] = 0; } continue; }
      const tau1 = d[o + 17], gy = d[o + 19], e = d[o + 18]; const vy = d[o + 5];
      // horizontal: slides with friction after first hit
      let px, pz, py;
      if (age < tau1) { px = d[o] + d[o + 4] * age; pz = d[o + 2] + d[o + 6] * age; py = d[o + 1] + vy * age - 0.5 * G * age * age; }
      else {
        const hx = d[o] + d[o + 4] * tau1, hz = d[o + 2] + d[o + 6] * tau1; const ta = age - tau1; const fr = (1 - Math.exp(-ta * 3.0)) / 3.0;
        px = hx + d[o + 4] * 0.35 * fr; pz = hz + d[o + 6] * 0.35 * fr;
        // up to 3 further bounces
        let v = -(vy - G * tau1) * e, tt = ta; py = 0;
        for (let b = 0; b < 3; b++) { const tb = 2 * v / G; if (v < 0.9) { py = 0; break; } if (tt < tb) { py = v * tt - 0.5 * G * tt * tt; break; } tt -= tb; v *= e; }
        py += gy;
      }
      const sc = Math.min(1, (life - age) / 0.6) * 1.0; // shrink away at the end of life
      const angle = d[o + 11] * (age < tau1 ? age : tau1 + (1 - Math.exp(-(age - tau1) * 4.0)) / 4.0 * 0.4);
      _axis.set(d[o + 12], d[o + 13], d[o + 14]); _q.setFromAxisAngle(_axis, angle);
      _pos.set(px, py + d[o + 9] * 0.3 * sc, pz); _scl.set(d[o + 8] * sc, d[o + 9] * sc, d[o + 10] * sc);
      _m4.compose(_pos, _q, _scl); _m4.toArray(arr, k);
      hv[i] = d[o + 15] * Math.exp(-age * d[o + 16]);
    }
    m.instanceMatrix.needsUpdate = true; this.heat.needsUpdate = true;
    if (this._colDirty) { m.instanceColor.needsUpdate = true; this._colDirty = false; }
  }
  clear() { this.data.fill(0); this.head = 0; this.high = 0; this.wrapped = false; this.endTime = -1; this.mesh.count = 0; this.mesh.visible = false; const arr = this.mesh.instanceMatrix.array; arr.fill(0); this.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}
