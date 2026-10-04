// Post-processing chain for ALIEN OUTVASION.
//   scene -> HDR render target (HalfFloat, optional 4x MSAA)  ->  dual-filter bloom (Karis-averaged prefilter, 13-tap down, 9-tap tent up)
//   [-> half-res blur chain only while params.blur / params.dof are active]  ->  final pass on the canvas:
//   chroma aberration + glitch -> blur/dof mix -> + bloom -> exposure/tint/lift-gamma-gain (linear HDR) -> renderer tone mapping (ONCE)
//   -> sRGB -> contrast/saturation -> vignette -> grain -> scanlines -> fade/flash -> letterbox -> dither.
// Tone mapping is applied exactly once, in the final pass, using the renderer's own toneMapping/exposure (scene materials render linear into the target).
import * as THREE from 'three';
import { GLOBAL, clamp } from '../engine/common.js';

const VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const HDR_CLAMP = 'c = min(c, vec3(64.0));';

const PREFILTER_FS = /* glsl */`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform vec3 uThresh; uniform float uScale;
varying vec2 vUv;
vec3 thr(vec3 c) { ${HDR_CLAMP} float br = max(max(c.r, c.g), c.b); float knee = max(uThresh.y, 1e-4); float soft = clamp(br - uThresh.x + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4); float k = max(soft, br - uThresh.x) / max(br, 1e-4); return c * k; }
vec3 tap(vec2 o) { return thr(texture2D(tSrc, vUv + o * uTexel * uScale).rgb); }
float kar(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec3 a = tap(vec2(-2.0, -2.0)), b = tap(vec2(0.0, -2.0)), c = tap(vec2(2.0, -2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, 2.0)), h = tap(vec2(0.0, 2.0)), i = tap(vec2(2.0, 2.0));
  vec3 j = tap(vec2(-1.0, -1.0)), k = tap(vec2(1.0, -1.0)), l = tap(vec2(-1.0, 1.0)), m = tap(vec2(1.0, 1.0));
  vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
  float w0 = 0.125 * kar(g0), w1 = 0.125 * kar(g1), w2 = 0.125 * kar(g2), w3 = 0.125 * kar(g3), w4 = 0.5 * kar(g4);
  gl_FragColor = vec4((g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4), 1.0);
}`;

const DOWN_FS = /* glsl */`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScale;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel * uScale).rgb; }
void main() {
  vec3 a = tap(vec2(-2.0, -2.0)), b = tap(vec2(0.0, -2.0)), c = tap(vec2(2.0, -2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, 2.0)), h = tap(vec2(0.0, 2.0)), i = tap(vec2(2.0, 2.0));
  vec3 j = tap(vec2(-1.0, -1.0)), k = tap(vec2(1.0, -1.0)), l = tap(vec2(-1.0, 1.0)), m = tap(vec2(1.0, 1.0));
  vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(r, 1.0);
}`;

const UP_FS = /* glsl */`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 r = tap(vec2(0.0)) * 4.0 + (tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0)) + tap(vec2(0.0, 1.0))) * 2.0 + (tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0)));
  gl_FragColor = vec4(r * (1.0 / 16.0) * uWeight, 1.0);
}`;

const FINAL_FS = /* glsl */`
precision highp float;
uniform sampler2D tScene, tBloom, tBlur1, tBlur2;
uniform vec2 uRes; uniform float uTime;
uniform float uBloom, uExposure, uContrast, uSaturation, uVignette, uGrain, uChroma, uGlitch, uFade, uFlash, uBlur, uDof, uDofFocus, uLetter;
uniform vec2 uDofCenter;
uniform vec3 uTint, uLift, uGamma, uGain, uFlashColor, uGlitchTint;
varying vec2 vUv;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 S(vec2 uv) { return texture2D(tScene, uv).rgb; }
#ifdef FXAA
float lq(vec3 c) { c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 uv) {
  vec2 px = 1.0 / uRes;
  vec3 nw = S(uv + vec2(-1.0, -1.0) * px), ne = S(uv + vec2(1.0, -1.0) * px), sw = S(uv + vec2(-1.0, 1.0) * px), se = S(uv + vec2(1.0, 1.0) * px), m = S(uv);
  float lnw = lq(nw), lne = lq(ne), lsw = lq(sw), lse = lq(se), lm = lq(m);
  float lmin = min(lm, min(min(lnw, lne), min(lsw, lse))), lmax = max(lm, max(max(lnw, lne), max(lsw, lse)));
  vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), ((lnw + lsw) - (lne + lse)));
  float dr = max((lnw + lne + lsw + lse) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dr);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
  vec3 a = 0.5 * (S(uv + dir * (1.0 / 3.0 - 0.5)) + S(uv + dir * (2.0 / 3.0 - 0.5)));
  vec3 b = a * 0.5 + 0.25 * (S(uv + dir * -0.5) + S(uv + dir * 0.5));
  float lb = lq(b);
  return (lb < lmin || lb > lmax) ? a : b;
}
vec3 sceneAA(vec2 uv) { return fxaa(uv); }
#else
vec3 sceneAA(vec2 uv) { return S(uv); }
#endif
void main() {
  vec2 uv = vUv; vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 split = vec2(0.0); float tearLine = 0.0; float blk = 0.0;
  if (uGlitch > 0.001) {
    float g = uGlitch; float tq = floor(uTime * 13.0);
    float bandsN = mix(5.0, 30.0, h11(tq * 1.7 + 3.0));
    float by = floor(uv.y * bandsN); float r1 = h12(vec2(by, tq));
    float act = step(1.0 - g * 0.55, r1);
    uv.x += act * (h12(vec2(by + 13.0, tq)) - 0.5) * 0.32 * g;
    float tear = step(1.0 - g * 0.22, h11(tq * 3.1 + 7.0));
    uv.y = fract(uv.y + tear * (h11(tq * 5.3) - 0.5) * 0.09 * g);
    vec2 bl = floor(uv * vec2(14.0, 8.0)); float rb = h12(bl + tq * 1.3);
    float ab = step(1.0 - g * 0.16, rb);
    uv += ab * (vec2(h12(bl + 2.1 + tq), h12(bl + 7.7 + tq)) - 0.5) * 0.12 * g;
    uv.x = clamp(uv.x, 0.0, 1.0);
    split = vec2((act * 0.014 + ab * 0.022 + 0.0015) * g, 0.0); tearLine = tear; blk = max(act * 0.5, ab);
  }
  // edge-weighted chromatic aberration (+ glitch RGB split)
  vec2 cc = (uv - 0.5) * asp; float edge = dot(cc, cc);
  vec2 dirc = (uv - 0.5); float dl = length(dirc); dirc = dl > 1e-5 ? dirc / dl : vec2(0.0);
  vec2 off = dirc * (edge * uChroma * 0.016) + split;
  vec3 col;
  if (uChroma > 0.002 || uGlitch > 0.001) { col = vec3(S(uv + off).r, sceneAA(uv).g, S(uv - off).b); } else { col = sceneAA(uv); }
  // blur / radial defocus
  float dist = length((uv - uDofCenter) * asp);
  float bm = max(smoothstep(0.0, 1.0, uBlur), uDof * smoothstep(uDofFocus, uDofFocus + 0.45, dist));
  if (bm > 0.002) { vec3 b1 = texture2D(tBlur1, uv).rgb, b2 = texture2D(tBlur2, uv).rgb; vec3 bb = mix(b1, b2, smoothstep(0.5, 1.0, bm)); col = mix(col, bb, clamp(bm * 1.25, 0.0, 1.0)); }
  col += texture2D(tBloom, uv).rgb * uBloom;
  // linear HDR grade
  col *= uExposure * uTint;
  col = pow(max(col * uGain + uLift, vec3(0.0)), 1.0 / max(uGamma, vec3(0.05)));
#ifdef LDR_INPUT
  col *= 1.18;
#endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 c = gl_FragColor.rgb; // display-referred sRGB
  c = (c - 0.5) * uContrast + 0.5;
  float l = luma(c); c = mix(vec3(l), c, uSaturation);
  c *= mix(1.0, smoothstep(1.0, 0.28, length(cc * 1.08)), uVignette);
  float gn = h12(gl_FragCoord.xy + floor(uTime * 24.0) * vec2(17.0, 31.0)) - 0.5;
  c += gn * uGrain * 0.11 * (1.0 - 0.55 * abs(l * 2.0 - 1.0));
  if (uGlitch > 0.001) {
    float g = uGlitch; float tq = floor(uTime * 13.0);
    float sl = 0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159);
    c *= 1.0 - 0.28 * g * (1.0 - sl);
    float band = step(1.0 - g * 0.08, h12(vec2(floor(vUv.y * 60.0), tq + 9.0)));
    c = mix(c, vec3(h12(gl_FragCoord.xy + tq) ), band * 0.5 * g);
    c = mix(c, c * uGlitchTint, blk * 0.65 * g);
    c += tearLine * 0.05 * g;
  }
  c = mix(c, uFlashColor, clamp(uFlash, 0.0, 1.0));
  c *= 1.0 - clamp(uFade, 0.0, 1.0);
  if (uLetter > 0.0001) { float e = 1.0 / uRes.y; float m = smoothstep(uLetter, uLetter - e * 1.5, min(vUv.y, 1.0 - vUv.y)); c *= 1.0 - m; }
  c += (h12(gl_FragCoord.xy * 1.37 + 11.0) + h12(gl_FragCoord.yx * 0.73 + 3.0) - 1.0) / 255.0; // triangular dither
  gl_FragColor = vec4(c, 1.0);
}`;

const arr3 = (v, o) => { if (!v) return o.set(1, 1, 1); if (Array.isArray(v) || ArrayBuffer.isView(v)) return o.set(v[0], v[1], v[2]); if (v.r !== undefined) return o.set(v.r, v.g, v.b); if (v.x !== undefined) return o.set(v.x, v.y, v.z); return o.set(1, 1, 1); };

export function createPost(stage, opts = {}) {
  const renderer = stage.renderer;
  const ext = renderer.extensions;
  const hdr = opts.hdr !== false && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'));
  const params = {
    bloom: { strength: 0.55, radius: 0.65, threshold: 1.0, knee: 0.5 },
    exposure: 1, contrast: 1, saturation: 1, tint: [1, 1, 1], vignette: 0.35, grain: 0.3, chroma: 0.25, fade: 0, flash: 0, flashColor: [1, 1, 1], glitch: 0, glitchTint: [0.35, 1.0, 0.35], blur: 0, letterbox: 0,
    dof: 0, dofFocus: 0.28, dofCenter: [0.5, 0.5], lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], fxaa: undefined,
  };
  const post = { params, enabled: true, hdr, level: opts.level ?? 2, time: 0, scene: null, stats: { passes: 0 }, shakeState: { amount: 0, x: 0, y: 0, roll: 0 } };
  const fsGeo = new THREE.BufferGeometry(); fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const fsCam = new THREE.Camera(); const fsScene = new THREE.Scene();
  const mk = (fs, uniforms, extra = {}, defines = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false, defines, ...extra });
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  const matPre = mk(PREFILTER_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: new THREE.Vector3(1, 0.5, 1) }, uScale: { value: 1 } });
  const matDown = mk(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uScale: { value: 1 } });
  const matUp = mk(UP_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
  const U = {
    tScene: { value: null }, tBloom: { value: black }, tBlur1: { value: black }, tBlur2: { value: black }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
    uBloom: { value: 0 }, uExposure: { value: 1 }, uContrast: { value: 1 }, uSaturation: { value: 1 }, uVignette: { value: 0 }, uGrain: { value: 0 }, uChroma: { value: 0 }, uGlitch: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 },
    uBlur: { value: 0 }, uDof: { value: 0 }, uDofFocus: { value: 0.28 }, uLetter: { value: 0 }, uDofCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uFlashColor: { value: new THREE.Vector3(1, 1, 1) }, uGlitchTint: { value: new THREE.Vector3(0.35, 1, 0.35) },
  };
  let matFinal = null;
  const finalMat = (fxaa) => { const d = {}; if (fxaa) d.FXAA = 1; if (!hdr) d.LDR_INPUT = 1; return mk(FINAL_FS, U, { toneMapped: true }, d); }; // toneMapped: renderer tone mapping + sRGB happen here, once
  const tri = new THREE.Mesh(fsGeo, matPre); tri.frustumCulled = false; fsScene.add(tri);

  let sceneRT = null, bloomRTs = [], blurRTs = [], W = 2, H = 2, fxaaOn = false, bloomLevels = 5, bloomShift = 1;
  const _v2 = new THREE.Vector2();
  const rtType = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const mkRT = (w, h, { samples = 0, depth = false, filter = true } = {}) => {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: rtType, format: THREE.RGBAFormat, depthBuffer: depth, stencilBuffer: false, samples, minFilter: filter ? THREE.LinearFilter : THREE.NearestFilter, magFilter: filter ? THREE.LinearFilter : THREE.NearestFilter, generateMipmaps: false });
    rt.texture.colorSpace = hdr ? THREE.NoColorSpace : THREE.SRGBColorSpace; // 8-bit fallback stores sRGB (hardware encode/decode) to avoid dark banding
    return rt;
  };
  function disposeRTs() { if (sceneRT) sceneRT.dispose(); for (const r of bloomRTs) r.dispose(); for (const r of blurRTs) r.dispose(); sceneRT = null; bloomRTs = []; blurRTs = []; }
  function build() {
    disposeRTs();
    renderer.getDrawingBufferSize(_v2); W = Math.max(2, Math.floor(_v2.x)); H = Math.max(2, Math.floor(_v2.y));
    const lv = post.level; const maxS = renderer.capabilities.maxSamples || 0;
    const samples = lv >= 2 ? Math.min(4, maxS) : 0;
    sceneRT = mkRT(W, H, { samples, depth: true });
    bloomShift = lv >= 1 ? 1 : 2; bloomLevels = lv >= 2 ? 6 : lv === 1 ? 5 : 3;
    let w = W >> bloomShift, h = H >> bloomShift;
    for (let i = 0; i < bloomLevels; i++) { w = Math.max(2, w); h = Math.max(2, h); bloomRTs.push(mkRT(w, h)); w >>= 1; h >>= 1; }
    blurRTs = [mkRT(W >> 1, H >> 1), mkRT(W >> 2, H >> 2), mkRT(W >> 3, H >> 3)];
    fxaaOn = params.fxaa !== undefined ? !!params.fxaa : lv < 2;
    if (matFinal) matFinal.dispose(); matFinal = finalMat(fxaaOn);
    U.uRes.value.set(W, H); post._fxaaBuilt = fxaaOn;
  }
  post.setSize = (w, h, pr = 1) => {
    if (stage.resize) stage.resize(w, h, pr); else { renderer.setPixelRatio(pr); renderer.setSize(w, h, false); }
    build(); return post;
  };
  post.setQuality = (level) => { level = clamp(Math.round(level), 0, 2); if (level === post.level && sceneRT) return post; post.level = level; build(); return post; };
  post.setScene = (s) => { post.scene = s; return post; };
  post.setBloom = (strength, radius, threshold) => { if (strength !== undefined) params.bloom.strength = strength; if (radius !== undefined) params.bloom.radius = radius; if (threshold !== undefined) params.bloom.threshold = threshold; return post; };
  /** bar thickness (fraction of screen height, per bar) that gives a target cinematic aspect on the current drawing buffer */
  post.letterboxFor = (aspect) => Math.max(0, 0.5 - 0.5 * (W / H) / aspect);

  // ---- camera shake value (applied by the director; post only exposes it)
  const sh = { amount: 0, t0: -9, dur: 0.01, peak: 0 };
  post.shake = (amount, seconds = 0.5) => { sh.peak = Math.max(sh.peak * Math.max(0, 1 - (post.time - sh.t0) / sh.dur), amount); sh.t0 = post.time; sh.dur = Math.max(0.05, seconds); return post; };
  post.getShake = () => post.shakeState;
  const noise1 = (x) => Math.sin(x * 12.9898) * 0.5 + Math.sin(x * 7.233 + 1.7) * 0.3 + Math.sin(x * 3.11 + 4.2) * 0.2;

  function pass(mat, target, clear = false) {
    tri.material = mat; renderer.setRenderTarget(target); if (clear) renderer.clear(); renderer.render(fsScene, fsCam); post.stats.passes++;
  }
  function renderPost(dt, t) {
    if (t === undefined) t = GLOBAL.time.value; if (!(t > 0) && dt) t = post.time + dt; post.time = t;
    const age = (t - sh.t0) / sh.dur; const a = age >= 0 && age < 1 ? sh.peak * (1 - age) * (1 - age) : 0; const s = post.shakeState; s.amount = a; s.x = noise1(t * 31) * a; s.y = noise1(t * 27 + 9) * a; s.roll = noise1(t * 19 + 3) * a * 0.5;
    const scene = post.scene || stage.scene, camera = stage.camera;
    if (!post.enabled) { renderer.render(scene, camera); return; }
    // drawing buffer changed behind our back (e.g. stage.resize called directly)?
    renderer.getDrawingBufferSize(_v2); if (!sceneRT || Math.floor(_v2.x) !== W || Math.floor(_v2.y) !== H || (params.fxaa !== undefined ? !!params.fxaa : post.level < 2) !== post._fxaaBuilt) build();
    const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, info = renderer.info, prevReset = info.autoReset;
    info.autoReset = false; info.reset(); post.stats.passes = 0;
    renderer.autoClear = true; renderer.setRenderTarget(sceneRT); renderer.render(scene, camera); renderer.autoClear = false; post.stats.passes++;
    // ---- bloom
    const B = params.bloom; const strength = B.strength; let bloomTex = black;
    if (strength > 0.002 && bloomRTs.length) {
      matPre.uniforms.tSrc.value = sceneRT.texture; matPre.uniforms.uTexel.value.set(1 / W, 1 / H); matPre.uniforms.uScale.value = bloomShift >= 2 ? 2 : 1; matPre.uniforms.uThresh.value.set(B.threshold ?? 1, Math.max(0.01, (B.threshold ?? 1) * (B.knee ?? 0.5)), 1);
      pass(matPre, bloomRTs[0]);
      for (let i = 1; i < bloomRTs.length; i++) { const src = bloomRTs[i - 1]; matDown.uniforms.tSrc.value = src.texture; matDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); matDown.uniforms.uScale.value = 1; pass(matDown, bloomRTs[i]); }
      const w = 0.35 + 0.62 * clamp(B.radius ?? 0.65);
      for (let i = bloomRTs.length - 2; i >= 0; i--) { const src = bloomRTs[i + 1]; matUp.uniforms.tSrc.value = src.texture; matUp.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); matUp.uniforms.uWeight.value = w; pass(matUp, bloomRTs[i]); }
      bloomTex = bloomRTs[0].texture;
    }
    // ---- blur chain (only while blur/dof are used)
    const needBlur = params.blur > 0.002 || params.dof > 0.002; let b1 = black, b2 = black;
    if (needBlur) {
      let src = sceneRT.texture, sw = W, sh2 = H;
      for (let i = 0; i < 3; i++) { matDown.uniforms.tSrc.value = src; matDown.uniforms.uTexel.value.set(1 / sw, 1 / sh2); matDown.uniforms.uScale.value = 1; pass(matDown, blurRTs[i]); src = blurRTs[i].texture; sw = blurRTs[i].width; sh2 = blurRTs[i].height; }
      // one extra soft pass at quarter res for a smoother, larger kernel
      b1 = blurRTs[1].texture; b2 = blurRTs[2].texture;
    }
    // ---- final
    U.tScene.value = sceneRT.texture; U.tBloom.value = bloomTex; U.tBlur1.value = b1; U.tBlur2.value = b2; U.uTime.value = t;
    U.uBloom.value = bloomTex === black ? 0 : strength * (1 + clamp(params.flash) * 1.5);
    U.uExposure.value = params.exposure; U.uContrast.value = params.contrast; U.uSaturation.value = params.saturation; U.uVignette.value = params.vignette; U.uGrain.value = params.grain; U.uChroma.value = params.chroma;
    U.uGlitch.value = params.glitch; U.uFade.value = params.fade; U.uFlash.value = params.flash; U.uBlur.value = params.blur; U.uDof.value = params.dof; U.uDofFocus.value = params.dofFocus; U.uLetter.value = params.letterbox;
    const dc = params.dofCenter; U.uDofCenter.value.set(dc ? dc[0] : 0.5, dc ? dc[1] : 0.5);
    arr3(params.tint, U.uTint.value); arr3(params.lift, U.uLift.value); arr3(params.gamma, U.uGamma.value); arr3(params.gain, U.uGain.value); arr3(params.flashColor, U.uFlashColor.value); arr3(params.glitchTint, U.uGlitchTint.value);
    if (!params.lift) U.uLift.value.set(0, 0, 0);
    tri.material = matFinal; renderer.setRenderTarget(null); renderer.render(fsScene, fsCam); post.stats.passes++;
    renderer.autoClear = prevAuto; renderer.setRenderTarget(prevRT); info.autoReset = prevReset;
  }
  post.render = renderPost;
  post.dispose = () => { disposeRTs(); matPre.dispose(); matDown.dispose(); matUp.dispose(); if (matFinal) matFinal.dispose(); fsGeo.dispose(); black.dispose(); };
  build();
  return post;
}
