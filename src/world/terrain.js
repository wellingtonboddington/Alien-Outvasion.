// TERRAIN — analytic heightfield (heightAt is exact, mesh is a density-warped grid) + procedural splat shading (shader-side detail layers).
// Styles: tropical (island or coast, beach strip, sea level 0), temperate, farmland (shader field patchwork), desert (dunes+mesas), snow, rocky (mountains).
import * as THREE from 'three';
import { Q, clamp, lerp, smoothstep, RNG } from '../engine/common.js';
import { noise2, fbm2 } from '../engine/proc.js';
import { terrainDetailTex } from './env/noise.js';
import { envUniforms } from './env/wind.js';

const sstep = (a, b, v) => smoothstep(a, b, v);
const hexLin = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

// --------- style tables: [A,B] colours per layer (L0..L3), detail-channel masks, bump amplitude (m) ----------
const CH = { sand: [1, 0, 0, 0], grass: [0, 1, 0, 0], rock: [0, 0, 1, 0], mix: [0.3, 0.4, 0.3, 0] , fine: [0.5, 0.5, 0, 0]};
const STYLE = {
  tropical: { layers: [['#23491a', '#78a032'], ['#d2c298', '#f0e6c2'], ['#5a554e', '#8e8579'], ['#4a3822', '#7d6240']], masks: [CH.grass, CH.sand, CH.rock, CH.mix], bump: [0.18, 0.045, 0.5, 0.15], edgeH: 90 },
  temperate: { layers: [['#355f22', '#6a9638'], ['#85843f', '#b5a959'], ['#5f5b55', '#928c82'], ['#5a4630', '#84694a']], masks: [CH.grass, CH.grass, CH.rock, CH.mix], bump: [0.2, 0.18, 0.5, 0.2], edgeH: 80 },
  farmland: { layers: [['#3a6424', '#6c9a3c'], ['#bd9f40', '#dec463'], ['#4c7c28', '#84b242'], ['#5a402a', '#8a6643']], masks: [CH.grass, CH.fine, CH.grass, CH.mix], bump: [0.18, 0.1, 0.12, 0.25], edgeH: 55 },
  desert: { layers: [['#c39455', '#e6c487'], ['#b87843', '#dba264'], ['#6d4a36', '#a37759'], ['#b9a483', '#ded0ae']], masks: [CH.sand, CH.sand, CH.rock, CH.mix], bump: [0.1, 0.1, 0.6, 0.15], edgeH: 90 },
  snow: { layers: [['#dce5ef', '#ffffff'], ['#aebfd8', '#e1eaf6'], ['#47474c', '#7b7877'], ['#5b5846', '#8b866b']], masks: [CH.sand, CH.grass, CH.rock, CH.mix], bump: [0.12, 0.2, 0.6, 0.2], edgeH: 70 },
  rocky: { layers: [['#32522a', '#5e7f3f'], ['#756d63', '#a29a8c'], ['#4a4642', '#7c746a'], ['#e4ebf4', '#ffffff']], masks: [CH.grass, CH.mix, CH.rock, CH.sand], bump: [0.25, 0.4, 0.9, 0.12], edgeH: 0 },
};

// ridged multifractal (0..~1): sharp ridgelines
function ridgeMF(x, z, f0, oct = 6, off = 0) {
  let v = 0, amp = 0.5, f = f0, w = 1;
  for (let o = 0; o < oct; o++) { let n = 1 - Math.abs(noise2(x * f + off, z * f + off * 0.7)) * 1.35; n = Math.max(0, n); n *= n; v += n * amp * w; w = clamp(n * 1.6); amp *= 0.5; f *= 2.05; }
  return v / 0.95;
}

export function createTerrain(opts = {}) {
  const size = opts.size ?? 3000; const seed = opts.seed ?? 1; const style = STYLE[opts.style] ? opts.style : 'temperate';
  const flatRadius = opts.flatRadius ?? 60; const seaLevel = opts.seaLevel ?? 0;
  const S = STYLE[style]; const cx = opts.center ? opts.center[0] : 0, cz = opts.center ? opts.center[1] : 0;
  const relief = opts.relief ?? 1;
  const ox = seed * 17.31 + 3.1, oz = seed * 9.77 + 1.7;
  const isTropical = style === 'tropical'; const layout = opts.layout || 'island';
  const flatH = opts.flatHeight ?? (isTropical ? 2.3 : 0);
  const islandR = opts.islandRadius ?? size * 0.17;
  const seaAngle = opts.seaAngle ?? 0; const sd = { x: Math.sin(seaAngle), z: Math.cos(seaAngle) }; // direction toward the sea (coast layout), angle from +Z toward +X
  const shoreDist = opts.shoreDistance ?? 150;
  const ring = opts.ring ?? (style === 'rocky' ? 1 : 0); const ringRadius = opts.ringRadius ?? size * 0.17;
  const hasSea = isTropical;

  // ---------- coastline: signed inland distance ----------
  function inland(x, z) {
    if (layout === 'island') {
      const dx = x - cx, dz = z - cz; const r = Math.hypot(dx, dz) + 1e-6, c = dx / r, s = dz / r;
      const rad = islandR * (1 + 0.3 * noise2(c * 1.6 + ox, s * 1.6 + oz) + 0.12 * noise2(c * 4.3 + oz, s * 4.3 + ox));
      return rad - r + 34 * (fbm2(x / 150 + ox, z / 150 + oz, 3) - 0.5) + 10 * (fbm2(x / 40 + oz, z / 40 + ox, 2) - 0.5);
    }
    const t = (x - cx) * sd.x + (z - cz) * sd.z, tang = (x - cx) * -sd.z + (z - cz) * sd.x;
    return shoreDist - t + 46 * noise2(tang / 340 + ox, 0.5) + 16 * noise2(tang / 95 + oz, 3.1) + 6 * noise2(tang / 30 + ox, 7.7);
  }

  const baseH = {
    tropical(x, z) {
      const d = inland(x, z); let h;
      if (d <= 0) h = -72 * (1 - Math.exp(d / 900)) - 0.4 * (fbm2(x / 30, z / 30, 2) - 0.5);
      else {
        const beach = 1.75 * sstep(0, 32, d);
        const back = 0.9 * sstep(28, 110, d) * (0.5 + fbm2(x / 55 + ox, z / 55 + oz, 2));
        const inl = sstep(170, 650, d);
        const hills = inl * 62 * (0.2 + 0.8 * fbm2(x / 330 + ox, z / 330 + oz, 4)) * (0.55 + 0.9 * ridgeMF(x, z, 1 / 520, 3, oz));
        h = beach + back + hills + 0.5 * (fbm2(x / 14 + oz, z / 14 + ox, 2) - 0.5) * sstep(20, 90, d);
      }
      return h;
    },
    temperate(x, z) { return 34 * (fbm2(x / 520 + ox, z / 520 + oz, 5) - 0.42) + 10 * (fbm2(x / 130 + oz, z / 130 + ox, 3) - 0.5) + 2.5 * (fbm2(x / 28 + ox, z / 28, 2) - 0.5); },
    farmland(x, z) { return 15 * (fbm2(x / 650 + ox, z / 650 + oz, 4) - 0.45) + 3 * (fbm2(x / 90 + oz, z / 90 + ox, 3) - 0.5); },
    desert(x, z) {
      const warp = fbm2(x / 280 + ox, z / 280 + oz, 3) * 2.2; const a = 0.55 + 0.4 * noise2(x / 1400 + ox, z / 1400); const ca = Math.cos(a), sa = Math.sin(a);
      const u = ((x * ca + z * sa) / 175 + warp + noise2(x / 600, z / 600) * 0.8); const f = u - Math.floor(u);
      const prof = f < 0.72 ? Math.pow(f / 0.72, 1.35) : Math.pow(1 - (f - 0.72) / 0.28, 0.9); // windward gentle, leeward steep
      const amp = 9 * (0.35 + 0.9 * fbm2(x / 900 + oz, z / 900 + ox, 3));
      const mesaN = fbm2(x / 1100 + ox + 9, z / 1100 + oz + 5, 3); const mesa = sstep(0.6, 0.66, mesaN);
      const terr = Math.floor((fbm2(x / 400 + ox, z / 400, 2) * 3)) / 3; // terraced rock
      return prof * amp + 3 * (fbm2(x / 40, z / 40, 3) - 0.5) + mesa * (34 + 26 * terr + 22 * ridgeMF(x, z, 1 / 300, 3, ox));
    },
    snow(x, z) { return 24 * (fbm2(x / 600 + ox, z / 600 + oz, 5) - 0.42) + 5 * (fbm2(x / 70 + oz, z / 70 + ox, 3) - 0.5) + 1.5 * (fbm2(x / 16 + ox, z / 16, 2) - 0.5); },
    rocky(x, z) {
      const r = Math.hypot(x - cx, z - cz); const m = sstep(ringRadius, ringRadius + size * 0.22, r);
      const rm = ridgeMF(x, z, 1 / 900, 7, ox);
      return 16 * (fbm2(x / 400 + ox, z / 400 + oz, 4) - 0.4) * (1 - m * 0.5) + m * (rm * 640 + 60 * fbm2(x / 160, z / 160, 4)) * relief;
    },
  }[style];

  // extras: ring of mountains for non-rocky styles, edge hills so the terrain border never shows against the sky
  function extras(x, z) {
    let e = 0; const r = Math.hypot(x - cx, z - cz);
    if (ring > 0 && style !== 'rocky') e += ring * sstep(ringRadius, ringRadius + size * 0.2, r) * (ridgeMF(x, z, 1 / 800, 6, oz) * 560 + 40 * fbm2(x / 150 + oz, z / 150, 3));
    if (S.edgeH > 0 && !(isTropical && layout === 'island')) {
      const e1 = Math.max(Math.abs(x - cx), Math.abs(z - cz)) / (size * 0.5); e += sstep(0.62, 0.98, e1) * S.edgeH * (0.6 + 0.8 * fbm2(x / 260 + ox, z / 260 + oz, 3));
    }
    return e;
  }
  const heightAt = (x, z) => {
    let h = baseH(x, z) * relief;
    // flat region (e.g. under a city set): blend to constant height; on the sea side of a coast it just follows the land mask
    const r = Math.hypot(x - 0, z - 0); const ft = sstep(flatRadius, flatRadius * 2.4 + 40, r);
    if (flatRadius > 0) { const landK = isTropical ? sstep(0, 25, inland(x, z)) : 1; h = lerp(h, lerp(flatH, h, ft), landK); }
    return h + extras(x, z) * sstep(flatRadius * 1.5, flatRadius * 3 + 200, r);
  };

  // ---------- splat weights (grass, sand, rock, X) ----------
  const _w = [0, 0, 0, 0];
  function splatWeights(x, z, h, ny, out = _w) {
    const slope = 1 - ny; let g = 0, s = 0, r = 0, o = 0;
    const patch = fbm2(x / 24 + ox, z / 24 + oz, 3), patch2 = fbm2(x / 90 + oz, z / 90 + ox, 3);
    if (style === 'tropical') {
      const sandTop = 1.45 + (patch - 0.5) * 1.5; s = 1 - sstep(sandTop, sandTop + 1.3, h);
      r = sstep(0.16, 0.4, slope) + sstep(60, 85, h) * 0.5; o = sstep(0.55, 0.72, patch2) * 0.7 * (1 - s);
      g = (1 - s) * (1 - Math.min(1, r)) * (1 - o * 0.7);
    } else if (style === 'temperate' || style === 'farmland') {
      r = sstep(0.2, 0.45, slope) + sstep(150, 230, h) * 0.5; s = sstep(0.55, 0.8, patch2) * (style === 'farmland' ? 0.0 : 0.55); o = sstep(0.62, 0.8, patch) * 0.35; g = (1 - r) * (1 - o);
      if (style === 'farmland') { s = 0.0; }
    } else if (style === 'desert') {
      g = sstep(0.35, 0.65, patch2) * (1 - 0.0); s = 1 - g; r = sstep(0.16, 0.4, slope) + sstep(18, 30, h) * 0.4; o = sstep(0.62, 0.8, patch) * 0.6 * (1 - r);
    } else if (style === 'snow') {
      r = sstep(0.28, 0.55, slope) + sstep(0.5, 0.7, ridgeMF(x, z, 1 / 120, 3, ox)) * sstep(0.15, 0.3, slope) * 0.4; g = (1 - r) * (1 - sstep(0.58, 0.75, patch2) * 0.7); s = (1 - r) * sstep(0.58, 0.75, patch2) * 0.7; o = sstep(0.72, 0.82, patch) * 0.2 * (1 - r);
    } else { // rocky
      const snowH = 300 + (patch - 0.5) * 80; o = sstep(snowH, snowH + 60, h) * (1 - sstep(0.4, 0.7, slope) * 0.6);
      r = sstep(0.25, 0.5, slope) + sstep(150, 280, h) * 0.4; r = Math.min(1, r); s = sstep(0.2, 0.4, slope) * (1 - sstep(0.5, 0.7, slope)) * 0.5 * (1 - o);
      g = (1 - r) * (1 - sstep(130, 230, h)) * (1 - o);
    }
    out[0] = Math.max(0, g); out[1] = Math.max(0, s); out[2] = Math.max(0, r); out[3] = Math.max(0, o); return out;
  }

  // low-frequency colour variation baked per vertex (so the repeating detail tile never reads as a grid)
  const macroAt = (x, z) => clamp((0.45 * fbm2(x / 520 + ox, z / 520 + oz, 3) + 0.35 * fbm2(x / 130 + oz, z / 130 + ox, 3) + 0.2 * fbm2(x / 38 + ox * 2, z / 38 + oz * 2, 2) - 0.5) * 2.4 + 0.5);
  // ---------- mesh ----------
  const N = opts.segments ?? (Q.level === 0 ? 144 : Q.level === 1 ? 232 : 320);
  const warpA = opts.warp ?? 0.2; const half = size / 2;
  const coord = (i) => { const u = (i / N) * 2 - 1; return half * (warpA * u + (1 - warpA) * u * u * u); };
  const vc = (N + 1) * (N + 1);
  const pos = new Float32Array(vc * 3), splat = new Float32Array(vc * 4), uv = new Float32Array(vc * 2), macro = new Float32Array(vc);
  for (let j = 0, k = 0; j <= N; j++) {
    const z = coord(j);
    for (let i = 0; i <= N; i++, k++) { const x = coord(i); pos[k * 3] = x; pos[k * 3 + 1] = heightAt(x, z); pos[k * 3 + 2] = z; uv[k * 2] = i / N; uv[k * 2 + 1] = j / N; }
  }
  const idx = new Uint32Array(N * N * 6);
  for (let j = 0, t = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  { const nrm = geo.attributes.normal.array; for (let k = 0; k < vc; k++) { splatWeights(pos[k * 3], pos[k * 3 + 2], pos[k * 3 + 1], nrm[k * 3 + 1], _w); splat[k * 4] = _w[0]; splat[k * 4 + 1] = _w[1]; splat[k * 4 + 2] = _w[2]; splat[k * 4 + 3] = _w[3]; macro[k] = macroAt(pos[k * 3], pos[k * 3 + 2]); } }
  geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4)); geo.setAttribute('aMacro', new THREE.BufferAttribute(macro, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();

  // ---------- material ----------
  const U = {
    tDetail: { value: terrainDetailTex() },
    uColA: { value: S.layers.map((l) => hexLin(l[0])) }, uColB: { value: S.layers.map((l) => hexLin(l[1])) },
    uMask: { value: S.masks.map((m) => new THREE.Vector4(...m)) }, uBump: { value: new THREE.Vector4(...S.bump) },
    uSea: { value: hasSea ? seaLevel : -1e4 }, uFarm: { value: style === 'farmland' ? 1 : 0 }, uSeed: { value: seed },
    uSnowT: { value: opts.snow ?? 0 }, uGlobalSnow: envUniforms.uSnow, uWetness: { value: opts.wetness ?? 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSplat; attribute float aMacro; varying vec4 vSplat; varying vec3 vWPos; varying float vMacro;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSplat = aSplat; vMacro = aMacro; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vSplat; varying vec3 vWPos; varying float vMacro;
uniform sampler2D tDetail; uniform vec3 uColA[4]; uniform vec3 uColB[4]; uniform vec4 uMask[4]; uniform vec4 uBump;
uniform float uSea; uniform float uFarm; uniform float uSeed; uniform float uSnowT; uniform float uGlobalSnow; uniform float uWetness;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float terrHeightFromDetail(vec4 d, vec4 w) { return dot(w, vec4(dot(d, uMask[0]) * uBump.x, dot(d, uMask[1]) * uBump.y, dot(d, uMask[2]) * uBump.z, dot(d, uMask[3]) * uBump.w)); }
float gWet; vec2 gGrad; float gSnowAmt;
`)
      .replace('#include <color_fragment>', `
  vec4 sw = vSplat; sw /= max(sw.x + sw.y + sw.z + sw.w, 1e-3);
  vec2 wp = vWPos.xz;
  float camD = length(vWPos - cameraPosition);
  float nearK = 1.0 - smoothstep(25.0, 140.0, camD);
  vec4 dA = texture2D(tDetail, wp * 0.23);
  vec2 wpr = vec2(wp.x * 0.8 + wp.y * 0.6, wp.y * 0.8 - wp.x * 0.6);
  vec4 dB = texture2D(tDetail, wpr * 0.0371 + 0.31);
  vec4 dC = texture2D(tDetail, wp * 1.35 + 0.57);
  vec4 dd = dA * 0.4 + dB * 0.3 + dC * (0.2 * nearK) + vec4(0.5) * (0.2 * (1.0 - nearK));
  float macro = vMacro;
  dd += vec4((macro - 0.5) * 1.3);
  // bump gradient (finite difference on the near-scale tile only)
  const float EPS = 0.35;
  vec4 dAx = texture2D(tDetail, (wp + vec2(EPS, 0.0)) * 0.23), dAz = texture2D(tDetail, (wp + vec2(0.0, EPS)) * 0.23);
  float h0 = terrHeightFromDetail(dA, sw);
  gGrad = vec2(terrHeightFromDetail(dAx, sw) - h0, terrHeightFromDetail(dAz, sw) - h0) / EPS * (0.35 + 0.65 * nearK);
  gGrad *= 1.0 - 0.7 * (1.0 - smoothstep(0.0, 0.7, vWPos.y - uSea)) * step(-50.0, vWPos.y - uSea);
  vec3 alb = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float l = dot(dd, uMask[i]);
    alb += sw[i] * mix(uColA[i], uColB[i], smoothstep(0.22, 0.78, l));
  }
  alb *= 0.78 + 0.5 * macro;
  // farmland patchwork: warped, staggered rectangular fields with hedgerows and crop rows
  if (uFarm > 0.5) {
    vec2 wq = wp + 16.0 * (texture2D(tDetail, wp * 0.0011).gb - 0.5) * 2.0 + 2.2 * (texture2D(tDetail, wp * 0.0073 + 0.2).rg - 0.5) * 2.0;
    float ca = 0.42, sa = sin(ca); ca = cos(ca);
    vec2 q = vec2(wq.x * ca - wq.y * sa, wq.x * sa + wq.y * ca) + uSeed * 31.7;
    vec2 cs = vec2(150.0, 170.0);
    float row = floor(q.y / cs.y);
    float rh = hash21(vec2(row, 3.7 + uSeed));
    vec2 qq = vec2(q.x + rh * cs.x * 3.0, q.y);
    float colw = cs.x * (0.65 + 0.7 * hash21(vec2(row, 9.1)));
    float colIdx = floor(qq.x / colw); vec2 f = vec2(fract(qq.x / colw), fract(qq.y / cs.y)); float cw = colw;
    vec2 cell = vec2(colIdx, row);
    float hh = hash21(cell + 1.3); float h2 = hash21(cell + 17.3); float h3 = hash21(cell + 5.9);
    if (h3 > 0.62) { f.y = fract(f.y * 2.0); cell.y += 0.5 * floor(fract(qq.y / cs.y) * 2.0); hh = hash21(cell + 1.3); h2 = hash21(cell + 17.3); }
    vec3 crop;
    if (hh < 0.26) crop = mix(vec3(0.55, 0.40, 0.11), vec3(0.76, 0.58, 0.21), h2);
    else if (hh < 0.50) crop = mix(vec3(0.09, 0.2, 0.04), vec3(0.2, 0.38, 0.07), h2);
    else if (hh < 0.66) crop = mix(vec3(0.15, 0.085, 0.04), vec3(0.27, 0.15, 0.075), h2);
    else if (hh < 0.84) crop = mix(vec3(0.16, 0.3, 0.06), vec3(0.3, 0.46, 0.12), h2);
    else crop = mix(vec3(0.56, 0.46, 0.17), vec3(0.7, 0.6, 0.27), h2);
    float ang = 0.42 + (hh > 0.5 ? 0.0 : 1.5708); vec2 rd = vec2(cos(ang), sin(ang));
    float rows = 0.5 + 0.5 * sin(dot(q, rd) * 6.2831 / (1.2 + h2 * 0.8));
    float rowAmt = (hh < 0.66) ? 0.32 : 0.1; crop *= 1.0 - rowAmt * rows * (0.35 + 0.65 * nearK) - rowAmt * 0.35 * (1.0 - nearK);
    crop *= 0.68 + 0.6 * macro + 0.25 * (dd.g - 0.5);
    float edge = min(min(f.x * cw, (1.0 - f.x) * cw), min(f.y * cs.y, (1.0 - f.y) * cs.y));
    float hedge = 1.0 - smoothstep(1.0, 3.6, edge + (dA.g - 0.5) * 3.0 + (dB.r - 0.5) * 3.0);
    vec3 hedgeCol = vec3(0.045, 0.1, 0.03) * (0.6 + dd.g);
    crop = mix(crop, hedgeCol, hedge * 0.95);
    float fm = smoothstep(0.25, 0.6, sw.x + sw.y);
    alb = mix(alb, crop, fm * (1.0 - sw.w));
  }
  // wet sand near the waterline, fade seabed to green-teal with depth
  float aboveSea = vWPos.y - uSea;
  gWet = (1.0 - smoothstep(0.0, 0.7, aboveSea)) * step(-50.0, aboveSea) * clamp(sw.y + 0.2, 0.0, 1.0);
  alb *= mix(1.0, 0.68, gWet) * mix(1.0, 0.7, clamp(uWetness, 0.0, 1.0));
  alb = mix(alb, alb * vec3(0.55, 0.85, 0.85), smoothstep(0.0, -4.0, aboveSea) * step(-50.0, aboveSea));
  diffuseColor.rgb = alb;
`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.3, max(gWet, uWetness * 0.6));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 nW = inverseTransformDirection(normal, viewMatrix);
    nW = normalize(nW + vec3(-gGrad.x, 0.0, -gGrad.y) * 1.1);
    // snow dusting on upward facing surfaces
    float snowAmt = clamp(uSnowT + uGlobalSnow, 0.0, 1.0) * smoothstep(0.45, 0.85, nW.y);
    gSnowAmt = snowAmt;
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }`)
    ;
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  material.diffuseColor = mix(material.diffuseColor, vec3(0.92, 0.95, 1.0) * (1.0 - 0.0), gSnowAmt);
  material.roughness = mix(material.roughness, 0.55, gSnowAmt);`);
  };
  mat.customProgramCacheKey = () => 'terrain-' + style;

  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'terrain'; mesh.receiveShadow = Q.shadows; mesh.frustumCulled = false;
  const root = new THREE.Group(); root.name = 'terrain'; root.add(mesh);

  // ---------- queries ----------
  const _n = new THREE.Vector3();
  const terrain = {
    root, mesh, size, style, seaLevel, flatRadius, flatHeight: flatH, layout, material: mat,
    heightAt,
    /** unit surface normal (finite differences) */
    normalAt(x, z, out = _n) { const e = 1.2; const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); return out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize(); },
    slopeAt(x, z) { return 1 - terrain.normalAt(x, z).y; },
    /** metres of land inland of the coast (tropical only; negative = at sea). Infinity for non-coastal styles */
    inlandAt(x, z) { return isTropical ? inland(x, z) : 1e5; },
    isLand(x, z) { return heightAt(x, z) > seaLevel + 0.05; },
    /** splat weights [grass, sand/layer1, rock/layer2, other/layer3] at a point */
    splatAt(x, z, out = [0, 0, 0, 0]) { const h = heightAt(x, z); const ny = terrain.normalAt(x, z).y; splatWeights(x, z, h, ny, out); const s = out[0] + out[1] + out[2] + out[3] || 1; for (let i = 0; i < 4; i++) out[i] /= s; return out; },
    /** Point on the shoreline in a given direction from the island centre (island layout) or along the coast (coast layout: angle ignored, `along` metres). Returns {x,z,nx,nz(seaward normal)} */
    shorePoint(angle = 0, out = {}) {
      if (!isTropical) return null;
      if (layout === 'island') {
        const c = Math.cos(angle), s = Math.sin(angle); let r = islandR * 1.6;
        for (let k = 0; k < 40; k++) { if (inland(cx + c * r, cz + s * r) > 0) break; r -= islandR * 0.05; }
        let lo = r, hi = r + islandR * 0.12; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (inland(cx + c * m, cz + s * m) > 0) lo = m; else hi = m; }
        out.x = cx + c * lo; out.z = cz + s * lo; out.nx = c; out.nz = s; return out;
      }
      const along = angle; // metres along the coast tangent
      let lo = -size * 0.5, hi = size * 0.5; const tx = -sd.z, tz = sd.x; // march along sea direction at fixed tangent offset
      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (inland(cx + tx * along + sd.x * m, cz + tz * along + sd.z * m) > 0) lo = m; else hi = m; }
      out.x = cx + tx * along + sd.x * lo; out.z = cz + tz * along + sd.z * lo; out.nx = sd.x; out.nz = sd.z; return out;
    },
    /** vegetation suitability 0..1 for a kind at (x,z) — used by scatterVegetation */
    density(kind, x, z) {
      const h = heightAt(x, z); if (h < seaLevel + 0.15 && hasSea) return 0;
      const ny = terrain.normalAt(x, z).y; const slope = 1 - ny; const w = splatWeights(x, z, h, ny, [0, 0, 0, 0]); const tot = w[0] + w[1] + w[2] + w[3] || 1;
      const g = w[0] / tot, sn = w[1] / tot, rk = w[2] / tot, ot = w[3] / tot; const nz = fbm2(x / 60 + 5.5, z / 60 + 1.5, 3);
      const d = isTropical ? inland(x, z) : 1e5;
      switch (style) {
        case 'tropical':
          if (kind === 'coconut' || kind === 'palm') return clamp(sstep(1.2, 2.2, h) * (1 - sstep(10, 22, h)) * (1 - rk) * (0.35 + 0.65 * sstep(0.3, 0.7, nz)) * (d < 160 ? 1.0 : 0.4)) * (1 - 0.7 * sstep(0.28, 0.45, slope));
          if (kind === 'grass') return clamp((1 - sn * 0.85) * (1 - rk) * sstep(1.6, 2.6, h)) * (0.5 + 0.5 * nz);
          if (kind === 'bush') return clamp(sstep(1.8, 3, h) * (1 - rk) * (0.3 + 0.7 * nz));
          if (kind === 'banana') return clamp(sstep(2.5, 4, h) * (1 - rk) * sstep(0.45, 0.65, nz) * (1 - sstep(40, 60, h)));
          return clamp(sstep(2.6, 4.5, h) * (1 - sstep(0.3, 0.5, slope)) * (0.2 + 0.8 * sstep(0.35, 0.6, nz)) * (1 - sstep(70, 95, h)) * (d > 60 ? 1 : d / 60));
        case 'desert': return kind === 'acacia' ? sstep(0.62, 0.75, nz) * (1 - rk) : kind === 'bush' ? sstep(0.55, 0.7, nz) * 0.6 * (1 - rk) : kind === 'grass' ? sstep(0.55, 0.7, nz) * 0.5 * g : 0;
        case 'snow': return (kind === 'pine' ? clamp((1 - rk) * (0.15 + 0.85 * sstep(0.4, 0.62, nz))) : kind === 'tree' ? clamp((1 - rk) * sstep(0.55, 0.7, nz) * 0.5) : kind === 'bush' ? 0.3 * (1 - rk) * sstep(0.45, 0.6, nz) : 0.15 * (1 - rk));
        case 'rocky': return (kind === 'pine' ? clamp(g * (1 - sstep(190, 260, h)) * (0.25 + 0.75 * sstep(0.4, 0.6, nz)) * (1 - sstep(0.4, 0.55, slope))) : kind === 'grass' ? g * 0.8 : kind === 'bush' ? g * 0.4 * (1 - sstep(200, 260, h)) : kind === 'tree' ? g * (1 - sstep(120, 170, h)) * sstep(0.45, 0.62, nz) : 0);
        case 'farmland': return (kind === 'tree' ? clamp(sstep(0.62, 0.74, nz) * 0.9) : kind === 'bush' ? sstep(0.5, 0.7, nz) * 0.4 : kind === 'grass' ? 0.5 : kind === 'pine' ? sstep(0.7, 0.8, nz) * 0.6 : 0.4);
        default: return (kind === 'tree' || kind === 'pine') ? clamp((1 - rk) * (1 - sstep(0.35, 0.55, slope)) * (0.15 + 0.85 * sstep(0.4, 0.62, nz))) * (1 - sstep(170, 230, h)) : kind === 'grass' ? g * 0.9 : kind === 'bush' ? g * (0.3 + 0.5 * nz) : 0.3 * g;
      }
    },
    setSnow(a) { U.uSnowT.value = a; },
    setWetness(a) { U.uWetness.value = a; },
    update() {},
    dispose() { geo.dispose(); mat.dispose(); },
  };
  return terrain;
}
