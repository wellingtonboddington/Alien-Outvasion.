// Pooled GPU-simulated billboard particle systems.
//
// Every particle is written ONCE (CPU, at spawn) into a ring buffer; the vertex shader evaluates its whole life analytically
//   p(t) = p0 + v*(1-e^{-kt})/k + g*(t-(1-e^{-kt})/k)/k  (+ wind + turbulence + ground bounce)
// so simulation is a pure function of (spawn data, film time): deterministic, seekable, zero per-frame CPU work
// except flushing freshly spawned particles. One pool == one draw call.
import * as THREE from 'three';
import { Q } from '../engine/common.js';
import { noiseTexture } from './textures.js';

export const SPRITE_STRIDE = 24;

/** reusable particle descriptor (fill, then pool.add(P)); no allocation */
export class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.birth = 0; this.life = 1;
    this.s0 = 1; this.s1 = 1; this.rot = 0; this.rotVel = 0; this.rnd = 0; this.frame = -1; this.heat = 0; this.heatDecay = 1.5;
    this.r = 1; this.g = 1; this.b = 1; this.a = 1; this.turb = 0; this.stretch = 0; this.drag = 1; this.extra = 1; // extra = gravity multiplier (orbit pool: phi0)
    return this;
  }
}

export const NOISE_GLSL = /* glsl */`
float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ return vnoise(p)*0.55 + vnoise(p*2.03+7.1)*0.3 + vnoise(p*4.1+3.7)*0.15; }
`;

const VERT = /* glsl */`
precision highp float;
uniform float uTime;
uniform vec3 uGravity;
uniform vec3 uWind;
uniform float uWindK;
uniform float uDrag;
uniform float uGrow;
uniform float uGround;
uniform float uBounce;
uniform float uTurbF;
uniform float uMinPx;
uniform float uViewH;
uniform float uNearFade;
uniform float uGrowR;
uniform float uSquash;
uniform vec3 uSunView;
uniform float uMinSprite;
uniform vec4 uAtlas;
attribute vec4 aA; // p0.xyz birth
attribute vec4 aB; // v.xyz life
attribute vec4 aC; // size0 size1 rot0 rotVel
attribute vec4 aD; // rnd frame heat heatDecay
attribute vec4 aE; // rgba
attribute vec4 aF; // turb stretch dragMul extra
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;   // age01, heat, age(s), nearFade
varying vec4 vFrames; // f0 col,row ; f1 col,row
varying vec3 vLight;
varying float vSeed;
#include <fog_pars_vertex>
${NOISE_GLSL}

vec3 motionAt(float t) {
  float k = uDrag * aF.z;
  float f = k > 1e-4 ? (1.0 - exp(-k * t)) / k : t;
  float gt = k > 1e-4 ? (t - f) / k : 0.5 * t * t;
  vec3 p = aA.xyz + aB.xyz * f + uGravity * (gt * aF.w);
  p += uWind * uWindK * (t - (1.0 - exp(-0.45 * t)) / 0.45);
#ifdef BOUNCE
  if (aF.w > 0.001) { // vertical channel with up to 3 analytic bounces (drag ignored on y); gravity-less particles (space, tracers) never bounce
    float h = aA.y - uGround, vy = aB.y, g = max(-uGravity.y * aF.w, 0.01), tt = t, yy = h;
    for (int i = 0; i < 3; i++) {
      float tau = (vy + sqrt(max(vy * vy + 2.0 * g * h, 0.0))) / g;
      if (tt < tau) { yy = h + vy * tt - 0.5 * g * tt * tt; break; }
      float vimp = vy - g * tau; vy = -vimp * uBounce; h = 0.0; tt -= tau; yy = 0.0;
      if (vy < 1.2) { yy = 0.0; break; }
    }
    p.y = uGround + max(yy, 0.0);
  }
#endif
  return p;
}

vec3 turbAt(vec3 p, float t) {
  float amp = aF.x;
  if (amp <= 0.0) return vec3(0.0);
  vec3 q = p * uTurbF + vec3(aD.x * 17.0, t * 0.22, aD.x * 5.0);
  vec3 n = vec3(vnoise(q), vnoise(q + vec3(31.4, 7.1, 2.3)), vnoise(q + vec3(11.3, 47.2, 5.9))) - 0.5;
  return n * 2.0 * amp * min(1.0, t * 0.7);
}

#ifdef ORBIT
// mushroom cloud: rolling torus (cap) or stem, riding a rising centre. aF = (riseV, mode, rollOmega, phi0/stemU)
vec3 orbitAt(float t) {
  float k = max(uDrag, 1e-3);
  float rise = aF.x * (1.0 - exp(-k * t)) / k;
  float grow = 1.0 + uGrowR * (1.0 - exp(-t * 0.28));
  if (aF.y < 0.5) {
    float psi = aB.x, R = aB.y * grow, r = aB.z * (1.0 + 0.25 * uGrowR * (1.0 - exp(-t * 0.28)));
    float phi = aF.w - aF.z * t;  // inner side moves up, top moves outward
    vec3 radial = vec3(cos(psi), 0.0, sin(psi));
    return aA.xyz + vec3(0.0, rise, 0.0) + radial * (R + r * cos(phi)) + vec3(0.0, r * sin(phi) * uSquash, 0.0);
  } else {
    float psi = aB.x + aF.z * t, rad = aB.y * grow; // stem: aB.z = capInitialHeight above base, aF.w = u along stem
    vec3 radial = vec3(cos(psi), 0.0, sin(psi));
    return aA.xyz + vec3(0.0, aF.w * (aB.z + rise), 0.0) + radial * rad;
  }
}
#endif

void main() {
  float age = uTime - aA.w;
  float life = aB.w;
  if (age < 0.0 || age >= life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float a01 = age / life;
  float size = mix(aC.x, aC.y, 1.0 - pow(1.0 - a01, uGrow));
#ifdef ORBIT
  vec3 P = orbitAt(age);
#else
  vec3 P = motionAt(age);
  P += turbAt(P, age);
#endif
#ifdef GROUND_CLAMP
  P.y = max(P.y, uGround + size * 0.3);
#endif
  vec4 mvPosition = modelViewMatrix * vec4(P, 1.0);
  float nearF = smoothstep(uNearFade * 0.5, uNearFade * 1.6, -mvPosition.z);
  vec2 c = position.xy * 2.0; // -1..1
#ifdef STREAK
  {
    float st = aF.y;
    vec3 Pt;
    if (st > 0.0) { Pt = motionAt(max(age - st, 0.0)); Pt += turbAt(Pt, max(age - st, 0.0)); }
    else { P = aA.xyz; Pt = aA.xyz + aB.xyz; mvPosition = modelViewMatrix * vec4(P, 1.0); } // stretch<0: static segment head=p0, tail=p0+v
    vec4 mh = mvPosition, mt = modelViewMatrix * vec4(Pt, 1.0);
    // pixels -> metres at this depth
    float pxm = max(-mh.z, 0.01) * 2.0 / (uViewH * projectionMatrix[1][1]);
    float w = max(size * 0.5, uMinPx * pxm * 0.5);
    vec2 d2 = mh.xy - mt.xy; float len = length(d2);
    vec2 dir = len > 1e-5 ? d2 / len : vec2(1.0, 0.0);
    vec2 perp = vec2(-dir.y, dir.x);
    float u = position.x + 0.5; // 0 tail .. 1 head
    vec4 mv = mix(mt, mh, u);
    mv.xy += perp * c.y * w + dir * (u * 2.0 - 1.0) * w * 0.35;
    vUv = vec2(u, position.y + 0.5);
    nearF *= min(1.0, size * 0.5 / max(w, 1e-5)); // widened sub-pixel streaks lose intensity (no over-brightening)
    mvPosition = mv;
  }
#else
  {
    float rot = aC.z + aC.w * age;
    float cr = cos(rot), sr = sin(rot);
    float pxm0 = max(-mvPosition.z, 0.01) * 2.0 / (uViewH * projectionMatrix[1][1]);
    float sizeIn = size; size = max(size, uMinSprite * pxm0); nearF *= min(1.0, sizeIn / max(size, 1e-6)); // far glows keep a minimum pixel size but dim accordingly
    vec2 off = vec2(c.x * cr - c.y * sr, c.x * sr + c.y * cr) * size * 0.5;
    mvPosition.xy += off;
    vUv = position.xy + 0.5;
    vLight = vec3(uSunView.x * cr + uSunView.y * sr, -uSunView.x * sr + uSunView.y * cr, uSunView.z); // light in tile space (rotate by -rot)
  }
#endif
  gl_Position = projectionMatrix * mvPosition;
  float nF = uAtlas.x * uAtlas.y;
  float fr = aD.y >= 0.0 ? aD.y : floor(aD.x * nF);
  float f1 = mod(fr + 5.0 + floor(aD.x * 7.0), nF);
  vFrames = vec4(mod(fr, uAtlas.x), floor(fr / uAtlas.x), mod(f1, uAtlas.x), floor(f1 / uAtlas.x));
  vCol = aE; vSeed = aD.x;
  vInfo = vec4(a01, aD.z * exp(-age * aD.w), age, nearF);
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tMap;
uniform vec4 uAtlas;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform float uFadeIn;
uniform float uFadeOut;
uniform float uShade;
uniform float uHeatAdd;
uniform float uFogAdd;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;
varying vec4 vFrames;
varying vec3 vLight;
varying float vSeed;
uniform sampler2D tNoise;
#include <fog_pars_fragment>
${NOISE_GLSL}

vec4 tileTex(vec2 fr, vec2 uv) {
  return texture2D(tMap, (fr + clamp(uv, 0.004, 0.996)) / uAtlas.xy);
}
float envelope(float a) { return smoothstep(0.0, max(uFadeIn, 1e-4), a) * (1.0 - smoothstep(1.0 - uFadeOut, 1.0, a)); }

#ifdef F_FIRE
vec3 fireRamp(float h, vec3 mid) {
  vec3 c1 = mid * mid * 0.5;
  vec3 c3 = mix(mid, vec3(1.0, 0.96, 0.82), 0.62);
  vec3 c4 = vec3(1.0, 0.98, 0.92) * 1.25;
  vec3 c = mix(vec3(0.0), c1, smoothstep(0.0, 0.2, h));
  c = mix(c, mid, smoothstep(0.2, 0.5, h));
  c = mix(c, c3, smoothstep(0.5, 0.85, h));
  c = mix(c, c4, smoothstep(0.85, 1.25, h));
  return c;
}
#endif

void main() {
  float a01 = vInfo.x;
  float env = envelope(a01) * vInfo.w;
  vec4 outc;
#if defined(F_SMOKE)
  vec4 s0 = tileTex(vFrames.xy, vUv), s1 = tileTex(vFrames.zw, vUv);
  vec4 s = mix(s0, s1, smoothstep(0.0, 1.0, a01) * 0.45);
  vec2 so = vec2(vSeed * 7.31, vSeed * 13.7);
  float n1 = texture2D(tNoise, vUv * 1.25 + so).g;                                   // billow lobes
  float n2 = texture2D(tNoise, vUv * 2.9 + so.yx + vec2(0.0, vInfo.z * 0.025)).r;    // fine wisps (drift slowly)
  float er = smoothstep(0.05, 1.0, a01);
  float d = s.r * (0.7 + 0.6 * n1) - er * 0.32 * (1.15 - n2);                         // erosion grows as the puff ages
  float dens = clamp((d - 0.035) / 0.5, 0.0, 1.0);
  vec2 n2d = s.gb * 2.0 - 1.0;
  n2d += (vec2(n1, n2) - 0.5) * 0.35 * (1.0 - er * 0.5);                              // break up the baked lighting
  float nz = sqrt(max(0.0, 1.0 - min(dot(n2d, n2d), 1.0)));
  float diff = clamp(dot(vec3(n2d, nz), normalize(vLight)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 lightc = uAmbient + uSunColor * diff * diff * 1.3;
  vec3 body = vCol.rgb * lightc;
  body *= 1.0 - uShade * smoothstep(0.3, 1.0, dens) * (1.0 - diff) * (0.6 + 0.8 * n1); // self-shadowed cores / creases
  float heat = clamp(vInfo.y, 0.0, 1.5);
  vec3 hot = vec3(1.0, 0.40, 0.09) * 2.6 * heat * (0.25 + 0.75 * dens) * (0.6 + 0.8 * n1);
  float alpha = dens * vCol.a * env;
  vec3 rgb = (body + hot) * alpha;
  float aOut = alpha * (1.0 - clamp(heat * uHeatAdd, 0.0, 1.0));
  outc = vec4(rgb, aOut);
#elif defined(F_FIRE)
  vec4 s0 = tileTex(vFrames.xy, vUv), s1 = tileTex(vFrames.zw, vUv);
  float t = mix(s0.r, s1.r, smoothstep(0.0, 1.0, a01) * 0.6);
  vec2 no = vUv * 1.55 + vec2(vSeed * 5.3, vSeed * 9.1 - vInfo.z * 0.55);            // texture scrolls upward: licking flames
  float det = texture2D(tNoise, no).g, det2 = texture2D(tNoise, no * 2.3 + 0.37).r;
  float life = pow(max(1.0 - a01, 0.0), 0.85);
  float h = t * (0.32 + 1.15 * det) * (0.72 + 0.55 * det2) * life * vCol.a;
  float al = smoothstep(0.05, 0.4, h) * smoothstep(0.0, 0.05, a01) * vInfo.w;
  vec3 col = fireRamp(h, vCol.rgb);
  outc = vec4(col * al, 1.0);
#elif defined(F_GLOW)
  vec4 s = tileTex(vFrames.xy, vUv);
  float decay = pow(max(1.0 - a01, 0.0), max(vCol.a, 0.0)); // glow pool: alpha channel = decay exponent
  outc = vec4(vCol.rgb * s.r * decay * vInfo.w, 1.0);
#elif defined(F_SPARK)
  float x = vUv.x, y = vUv.y * 2.0 - 1.0;
  float prof = exp(-y * y * 3.5);
  float core = exp(-y * y * 18.0);
  float tail = pow(smoothstep(0.0, 1.0, x), 1.4);
  float cap = 1.0 - smoothstep(0.86, 1.0, x);
  float I = (prof * 0.55 + core * 0.9) * tail * (0.25 + 0.75 * cap) + exp(-(pow((1.0 - x) * 3.0, 2.0) + y * y * 2.0)) * 0.6;
  float fade = pow(max(1.0 - a01, 0.0), 0.6) * smoothstep(0.0, 0.03, a01 + 0.03);
  vec3 col = vCol.rgb * mix(vec3(1.0), vec3(1.0, 0.42, 0.14), clamp(a01 * 1.4, 0.0, 1.0) * uHeatAdd);
  outc = vec4(col * I * fade * vInfo.w, 1.0);
#elif defined(F_MIST)
  vec4 s0 = tileTex(vFrames.xy, vUv), s1 = tileTex(vFrames.zw, vUv);
  vec4 s = mix(s0, s1, smoothstep(0.0, 1.0, a01));
  float dens = s.r;
  float glowm = s.b;
  float flick = 0.85 + 0.3 * vnoise(vec3(vUv * 3.0, vInfo.z * 0.8 + vCol.a * 9.0));
  vec3 base = vCol.rgb;
  vec3 col = mix(base * 0.12, base * 1.05, glowm * flick) + vec3(0.08, 0.4, 0.04) * smoothstep(0.6, 1.0, glowm) * 0.9;
  float alpha = dens * env * 0.55;
  outc = vec4(col * alpha, alpha * (1.0 - uHeatAdd * glowm * 0.7));
#endif
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  outc.rgb = mix(outc.rgb, fogColor * outc.a, fogFactor * (1.0 - uFogAdd)); // normal blend fades to fog colour
  outc.rgb *= mix(1.0, 1.0 - fogFactor, uFogAdd);                            // additive fades to black
#endif
  gl_FragColor = outc;
}
`;

const _v2 = new THREE.Vector2();

/** Shared uniforms owned by the FX system (all pools reference the same objects) */
export function makeSharedUniforms() {
  const o = {
    uTime: { value: 0 },
    uSunView: { value: new THREE.Vector3(0.4, 0.7, 0.6).normalize() },
    uSunColor: { value: new THREE.Color(1.0, 0.92, 0.8) },
    uAmbient: { value: new THREE.Color(0.32, 0.36, 0.45) },
    uWind: { value: new THREE.Vector3(1.5, 0, 0.5) },
    uGround: { value: 0 },
    uViewH: { value: 540 },
    sunWorld: new THREE.Vector3(0.4, 0.8, 0.45).normalize(),
    /** mesh.onBeforeRender hook: refreshes drawing-buffer height + the sun direction in view space (no allocation) */
    onBefore: null,
  };
  o.onBefore = (renderer, scene, camera) => { renderer.getDrawingBufferSize(_v2); o.uViewH.value = _v2.y; o.uSunView.value.copy(o.sunWorld).transformDirection(camera.matrixWorldInverse); };
  return o;
}

const BLEND = {
  premul: [THREE.OneFactor, THREE.OneMinusSrcAlphaFactor],
  add: [THREE.OneFactor, THREE.OneFactor],
};

/**
 * One instanced-billboard pool. cfg:
 *  frag: 'smoke'|'fire'|'glow'|'spark'|'mist'; blend: 'premul'|'add'; atlas: {tex, cols, rows}; capacity (already budget-scaled)
 *  gravity:[x,y,z] (buoyancy = +y), drag, grow (size growth exponent), fadeIn, fadeOut, streak:boolean, bounce:number (restitution, 0=off),
 *  groundClamp:boolean, orbit:boolean, nearFade (m), turbF, shade, heatAdd, minPx, renderOrder
 */
export class BillboardPool {
  constructor(shared, cfg) {
    this.name = cfg.name || cfg.frag; this.cap = Math.max(16, cfg.capacity | 0); this.head = 0; this.high = 0; this.endTime = -1; this.dirtyLo = 1e9; this.dirtyHi = -1; this.wrapped = false;
    this.data = new Float32Array(this.cap * SPRITE_STRIDE);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.buf = new THREE.InstancedInterleavedBuffer(this.data, SPRITE_STRIDE, 1); this.buf.setUsage(THREE.DynamicDrawUsage);
    ['aA', 'aB', 'aC', 'aD', 'aE', 'aF'].forEach((n, i) => geo.setAttribute(n, new THREE.InterleavedBufferAttribute(this.buf, 4, i * 4)));
    geo.instanceCount = 0; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.geo = geo;
    const defines = {};
    defines['F_' + cfg.frag.toUpperCase()] = 1;
    if (cfg.streak) defines.STREAK = 1; if (cfg.bounce) defines.BOUNCE = 1; if (cfg.groundClamp) defines.GROUND_CLAMP = 1; if (cfg.orbit) defines.ORBIT = 1;
    const atlas = cfg.atlas || { tex: null, cols: 1, rows: 1 };
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      tMap: { value: atlas.tex }, tNoise: { value: noiseTexture() },
      uAtlas: { value: new THREE.Vector4(atlas.cols, atlas.rows, 1, 1) },
      uGravity: { value: new THREE.Vector3(...(cfg.gravity || [0, 0, 0])) },
      uWindK: { value: cfg.windK ?? 1 }, uDrag: { value: cfg.drag ?? 0 }, uGrow: { value: cfg.grow ?? 1 }, uBounce: { value: cfg.bounce ?? 0 }, uTurbF: { value: cfg.turbF ?? 0.18 },
      uMinPx: { value: cfg.minPx ?? 1.4 }, uMinSprite: { value: cfg.minSprite ?? 0 }, uNearFade: { value: cfg.nearFade ?? 1.2 }, uGrowR: { value: cfg.growR ?? 0.6 }, uSquash: { value: cfg.squash ?? 0.72 },
      uFadeIn: { value: cfg.fadeIn ?? 0.08 }, uFadeOut: { value: cfg.fadeOut ?? 0.5 }, uShade: { value: cfg.shade ?? 0.45 }, uHeatAdd: { value: cfg.heatAdd ?? 0.85 }, uFogAdd: { value: cfg.blend === 'add' ? 1 : 0 },
    }]);
    uniforms.uTime = shared.uTime; uniforms.uSunView = shared.uSunView; uniforms.uSunColor = shared.uSunColor; uniforms.uAmbient = shared.uAmbient; uniforms.uWind = shared.uWind; uniforms.uGround = shared.uGround; uniforms.uViewH = shared.uViewH;
    const [bs, bd] = BLEND[cfg.blend || 'premul'];
    this.material = new THREE.ShaderMaterial({
      defines, uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: bs, blendDst: bd, blendSrcAlpha: bs, blendDstAlpha: bd,
    });
    this.material.userData.noInfect = true;
    this.mesh = new THREE.Mesh(geo, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = cfg.renderOrder ?? 100; this.mesh.visible = false; this.mesh.name = 'fx_' + this.name;
    this.mesh.onBeforeRender = shared.onBefore;
  }
  /** write the descriptor into the next ring slot; returns slot index */
  add(P) {
    const i = this.head, d = this.data, o = i * SPRITE_STRIDE;
    d[o] = P.x; d[o + 1] = P.y; d[o + 2] = P.z; d[o + 3] = P.birth;
    d[o + 4] = P.vx; d[o + 5] = P.vy; d[o + 6] = P.vz; d[o + 7] = P.life;
    d[o + 8] = P.s0; d[o + 9] = P.s1; d[o + 10] = P.rot; d[o + 11] = P.rotVel;
    d[o + 12] = P.rnd; d[o + 13] = P.frame; d[o + 14] = P.heat; d[o + 15] = P.heatDecay;
    d[o + 16] = P.r; d[o + 17] = P.g; d[o + 18] = P.b; d[o + 19] = P.a;
    d[o + 20] = P.turb; d[o + 21] = P.stretch; d[o + 22] = P.drag; d[o + 23] = P.extra;
    const end = P.birth + P.life; if (end > this.endTime) this.endTime = end;
    if (i < this.dirtyLo) this.dirtyLo = i; if (i > this.dirtyHi) this.dirtyHi = i;
    this.head = i + 1; if (this.head >= this.cap) { this.head = 0; this.wrapped = true; }
    if (!this.wrapped && this.head > this.high) this.high = this.head; else if (this.wrapped) this.high = this.cap;
    return i;
  }
  /** push pending writes to the GPU, update draw range / visibility */
  flush(t) {
    const buf = this.buf;
    if (this.dirtyHi >= 0) {
      buf.clearUpdateRanges();
      if (this.dirtyHi - this.dirtyLo + 1 < this.cap * 0.9 && this.dirtyHi >= this.dirtyLo) buf.addUpdateRange(this.dirtyLo * SPRITE_STRIDE, (this.dirtyHi - this.dirtyLo + 1) * SPRITE_STRIDE);
      buf.needsUpdate = true; this.dirtyLo = 1e9; this.dirtyHi = -1;
    }
    this.geo.instanceCount = this.high;
    this.mesh.visible = this.high > 0 && t < this.endTime + 0.05;
  }
  clear() { this.data.fill(0); this.head = 0; this.high = 0; this.wrapped = false; this.endTime = -1; this.dirtyLo = 0; this.dirtyHi = this.cap - 1; this.buf.clearUpdateRanges(); this.buf.needsUpdate = true; this.geo.instanceCount = 0; this.mesh.visible = false; }
  dispose() { this.geo.dispose(); this.material.dispose(); }
}

export const budget = (n) => Math.max(1, Math.round(n * Q.particles));
