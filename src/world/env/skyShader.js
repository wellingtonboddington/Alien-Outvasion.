// GLSL for the sky: shared uniform declarations, gradient/sun/moon/milky-way dome, cloud layer. Also reused by the ocean for reflections.

export const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww; // always on the far plane, independent of camera position/far
}`;

export const SKY_UNIFORMS_GLSL = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uGlow;
uniform float uSunDisc; uniform float uGlowAmt; uniform float uWide; uniform float uTime;
uniform vec3 uFlashCol; uniform float uFlash; uniform vec3 uFlashDir;
`;

// base gradient + sun glow; no disc. Used by dome AND ocean reflections.
export const SKY_GRADIENT_GLSL = /* glsl */`
vec3 skyGradient(vec3 d) {
  float y = d.y; float up = max(y, 0.0);
  vec3 c = mix(uZenith, uMid, pow(1.0 - up, 2.6));
  c = mix(c, uHorizon, pow(1.0 - up, 10.0));
  c = mix(c, uGround, smoothstep(0.0, -0.18, y));
  float sd = max(dot(d, uSunDir), 0.0);
  float lobe = pow(sd, 3.0) * 0.12 + pow(sd, 14.0) * 0.35 + pow(sd, 90.0) * 0.9 + pow(sd, 1.6) * 0.16 * uWide;
  c += uGlow * lobe * uGlowAmt * (y > -0.1 ? 1.0 : 0.3);
  // lightning lights up the whole sky a bit, brighter toward the strike
  float fd = max(dot(d, uFlashDir), 0.0);
  c += uFlashCol * uFlash * (0.18 + 0.9 * pow(fd, 6.0)) * smoothstep(-0.3, 0.2, y);
  return c;
}`;

export const MILKY_GLSL = /* glsl */`
uniform sampler2D uNoise;
float tri(vec3 d, float s, int ch) {
  vec3 w = pow(abs(d), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec4 a = texture2D(uNoise, d.zy * s), b = texture2D(uNoise, d.xz * s), c = texture2D(uNoise, d.xy * s);
  vec4 v = a * w.x + b * w.y + c * w.z;
  return ch == 0 ? v.r : ch == 1 ? v.g : ch == 2 ? v.b : v.a;
}
vec3 milkyWay(vec3 d) {
  const vec3 GN = vec3(0.3339, 0.8197, 0.4650);
  const vec3 GC = vec3(-0.5774, 0.2200, 0.7855);
  float b = dot(d, GN);
  float band = exp(-b * b * 26.0);
  float core = exp(-b * b * 140.0);
  float lc = pow(max(dot(d, GC) * 0.5 + 0.5, 0.0), 4.0);
  float n = tri(d, 1.7, 1) * 0.55 + tri(d, 4.1, 2) * 0.3 + tri(d, 9.0, 3) * 0.15;
  float dust = smoothstep(0.5, 0.78, tri(d, 2.6, 0) * 0.7 + tri(d, 6.5, 3) * 0.3);
  float br = band * (0.25 + 0.9 * n) * (0.55 + 0.9 * lc) + core * (0.4 + 0.6 * n) * lc * 0.9;
  br *= 1.0 - 0.75 * dust * band;
  vec3 col = mix(vec3(0.46, 0.55, 0.9), vec3(1.0, 0.82, 0.62), clamp(lc * 1.4 + core * 0.4, 0.0, 1.0));
  return col * br * 0.085;
}
`;

export const SKY_BASE_FRAG = /* glsl */`
${SKY_UNIFORMS_GLSL}
uniform vec3 uMoonDir; uniform vec3 uMoonLight; uniform float uMoonAmt; uniform float uMilky; uniform float uSunCos;
#include <common>
#include <dithering_pars_fragment>
varying vec3 vDir;
${SKY_GRADIENT_GLSL}
${MILKY_GLSL}

vec3 moonDisc(vec3 d) {
  float md = dot(d, uMoonDir);
  float rad = 0.0215; // angular radius (rad) - a little bigger than real for the film
  float cosR = cos(rad);
  vec3 col = vec3(0.0);
  // halo
  col += vec3(0.5, 0.62, 0.9) * (pow(max(md, 0.0), 900.0) * 0.16 + pow(max(md, 0.0), 120.0) * 0.012) * uMoonAmt;
  if (md > cosR - 0.0004) {
    vec3 up = abs(uMoonDir.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 r = normalize(cross(up, uMoonDir)); vec3 u = cross(uMoonDir, r);
    vec2 p = vec2(dot(d, r), dot(d, u)) / sin(rad);
    float r2 = dot(p, p);
    float edge = smoothstep(1.0, 0.94, sqrt(r2));
    float nz = sqrt(max(1.0 - r2, 0.0));
    vec3 n = r * p.x + u * p.y - uMoonDir * nz;
    float lit = clamp(dot(n, uMoonLight) * 1.4 + 0.1, 0.0, 1.0);
    vec2 uv = p * 0.5 + 0.5;
    float maria = smoothstep(0.42, 0.62, texture2D(uNoise, uv * 0.9 + 0.17).r * 0.65 + texture2D(uNoise, uv * 2.3).g * 0.35);
    float speck = texture2D(uNoise, uv * 7.0).b;
    vec3 albedo = mix(vec3(0.82, 0.8, 0.76), vec3(0.34, 0.35, 0.38), maria * 0.85) * (0.85 + 0.3 * speck);
    float limb = pow(nz, 0.25);
    col = mix(col, albedo * lit * limb * 1.5, edge);
    col *= uMoonAmt;
  }
  return col;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 c = skyGradient(d);
  // milky way (night only)
  if (uMilky > 0.01) c += milkyWay(d) * uMilky * smoothstep(-0.05, 0.1, d.y);
  // sun disc
  float sd = dot(d, uSunDir);
  float disc = smoothstep(uSunCos, uSunCos + 0.00007, sd);
  c += uSunColor * disc * uSunDisc;
  // moon
  c += moonDisc(d);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
}`;

export const SKY_CLOUD_FRAG = /* glsl */`
${SKY_UNIFORMS_GLSL}
uniform sampler2D uNoise;
uniform float uCover; uniform float uSharp; uniform float uDens; uniform float uCirrus; uniform vec2 uWind; uniform float uScale; uniform float uQuality;
uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uCloudRim;
#include <common>
#include <dithering_pars_fragment>
varying vec3 vDir;

float cnoise(vec2 p) {
  float n = texture2D(uNoise, p).r * 0.5;
  n += texture2D(uNoise, p * 2.17 + vec2(0.31, 0.57)).g * 0.27;
  n += texture2D(uNoise, p * 4.63 + vec2(0.71, 0.13)).b * 0.15;
  if (uQuality > 0.5) n += texture2D(uNoise, p * 9.7 + vec2(0.17, 0.83)).a * 0.08;
  return n;
}
float cnoiseLow(vec2 p) {
  return texture2D(uNoise, p).r * 0.55 + texture2D(uNoise, p * 2.17 + vec2(0.31, 0.57)).g * 0.3 + 0.075;
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  if (y < 0.0) discard;
  float sd = max(dot(d, uSunDir), 0.0);
  // project onto a cloud plane (flattened a bit so clouds compress toward the horizon)
  vec2 uv = d.xz / (y + 0.14);
  vec2 p = uv * uScale + uWind * uTime;
  float n = cnoise(p);
  // coverage threshold (cover 1 => blanket)
  float thr = mix(0.80, 0.28, uCover);
  float c = smoothstep(thr, thr + uSharp, n);
  float blanket = smoothstep(0.72, 1.0, uCover);
  c = max(c, blanket * (0.9 + 0.1 * smoothstep(0.25, 0.7, n)));
  float thick = max(smoothstep(thr, thr + 0.30, n), blanket * smoothstep(0.22, 0.8, n));
  vec3 col = vec3(0.0); float a = 0.0;
  if (c > 0.002) {
    // fake self-shadowing: density toward the sun vs here
    vec2 sx = normalize(uSunDir.xz + vec2(1e-4)) * (0.03 + 0.08 * (1.0 - clamp(uSunDir.y, 0.0, 1.0)));
    float ns = cnoiseLow(p + sx), ns2 = cnoiseLow(p + sx * 2.6);
    float nh = cnoiseLow(p);
    float occ = clamp((ns - nh) * 3.4 + (ns2 - nh) * 1.8 + 0.3, 0.0, 1.0);
    float det = texture2D(uNoise, p * 5.3 + 0.2).a;
    float shadeAmt = clamp(occ * 0.7 + thick * 0.62 + (det - 0.5) * 0.5 * (0.4 + thick), 0.0, 1.0);
    col = mix(uCloudLit, uCloudShade, shadeAmt);
    // bright, sun-lit fringes where the cloud is thin and the sun is behind/near it
    float rim = smoothstep(0.0, 0.3, c) * (1.0 - smoothstep(0.0, 0.45, thick));
    col += uCloudRim * rim * (pow(sd, 3.0) * 1.6 + 0.1) * (1.0 - occ * 0.6);
    a = c * uDens;
    // lightning: clouds light from within
    float fd = max(dot(d, uFlashDir), 0.0);
    col += uFlashCol * uFlash * (0.25 + 1.6 * pow(fd, 4.0)) * (0.4 + 0.6 * thick);
  }
  // high thin cirrus streaks
  if (uCirrus > 0.01 && uQuality > 0.5) {
    vec2 pc = d.xz / (y + 0.32) * vec2(0.55, 1.5) * uScale * 0.9 + uWind * uTime * 0.4;
    float ci = texture2D(uNoise, pc * 0.8).g * 0.55 + texture2D(uNoise, pc * 2.6 + 0.4).b * 0.3 + texture2D(uNoise, pc * 6.0).a * 0.15;
    ci = smoothstep(0.52, 0.86, ci) * uCirrus * (1.0 - 0.6 * a);
    vec3 cc = uCloudLit * 0.95 + uCloudRim * (pow(sd, 6.0) * 0.8);
    col = (col * a + cc * ci) / max(a + ci, 1e-3); a = clamp(a + ci * 0.55, 0.0, 1.0);
  }
  // atmospheric perspective toward the horizon
  float hz = smoothstep(0.28, 0.0, y);
  col = mix(col, uHorizon * 1.02, hz * 0.8);
  a *= smoothstep(0.0, 0.16, y);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
}`;
