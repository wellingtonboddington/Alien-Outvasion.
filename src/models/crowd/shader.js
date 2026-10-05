// GLSL for instanced crowd agents: per-vertex FK skinning from a baked pose table, palette/texture-array shading, depth + blob shadow.
import * as THREE from 'three';
import { patchInfect } from '../../engine/infect.js';
import { NJ, NS, POSE_FRAMES, PARENT, ST } from './rig.js';

const VERT_PARS = /* glsl */`
#define NJ ${NJ}
#define NS ${NS}
#define POSE_F ${POSE_FRAMES}.0
uniform float uTime;
uniform vec3 uPivot[NJ];
uniform vec4 uStateInfo[NS];
uniform sampler2D uPose;
uniform vec4 uLook;     // xyz = world look target, w = weight (0 = off)
uniform vec4 uBody;     // hipY, waistY, shoulderY, neckY (rest) for shape morphs
uniform vec4 uKindV;    // x = max draw distance (0 = off), y = muzzle flash fire-rate multiplier
attribute vec4 aMeta;   // joint, gate, slot, layer
attribute vec4 aPos;    // x y z yaw
attribute vec4 aAnim;   // state speed phase scale
attribute vec4 aLook;   // seed tint variant ageSex
attribute vec4 aTrans;  // prevState tChange
attribute vec4 aCol;    // colour override rgb + amount
flat varying vec4 vMeta;
flat varying vec4 vInst;
flat varying vec4 vOvr;
varying vec2 vUvA;
const int PARENT_T[${NJ}] = int[${NJ}](${PARENT.join(',')});
int gSA; int gSB; float gUA; float gUB; float gWB; float gSeed; int gAge; float gSex; vec2 gW; float gLookYaw; float gLookPitch;
float h11(float x) { return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
vec4 poseTx(int s, int j, float u) { return texture2D(uPose, vec2(u + 0.5 / POSE_F, (float(s * NJ + j) + 0.5) / float(NS * NJ))); }
float cycU(int s, float tSince) {
  vec4 si = uStateInfo[s];
  if (si.y > 0.0) return clamp((tSince + aAnim.z) * aAnim.y / si.y, 0.0, 1.0) * (POSE_F - 1.0) / POSE_F;
  return fract((uTime * aAnim.y + aAnim.z) * si.x);
}
mat3 rotEuler(vec3 a) { // Ry * Rx * Rz
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  mat3 X = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
  mat3 Y = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 Z = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
  return Y * X * Z;
}
mat3 quatM(vec3 q) {
  float w = sqrt(max(0.0, 1.0 - dot(q, q))); float x = q.x, y = q.y, z = q.z;
  return mat3(1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y + z * w), 2.0 * (x * z - y * w),
              2.0 * (x * y - z * w), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z + x * w),
              2.0 * (x * z + y * w), 2.0 * (y * z - x * w), 1.0 - 2.0 * (x * x + y * y));
}
vec4 poseBlend(int j) {
  vec4 a = poseTx(gSA, j, gUA);
  if (gWB > 0.001) a = mix(a, poseTx(gSB, j, gUB), gWB);
  return a;
}
mat3 jointMat(int j) {
  vec4 a = poseBlend(j);
  mat3 R = quatM(a.xyz);
  if (a.w > 0.0005) {
    vec3 h = vec3(h11(gSeed * 13.1 + float(j) * 7.7), h11(gSeed * 29.7 + float(j) * 3.3 + 1.7), h11(gSeed * 5.3 + float(j) * 11.1 + 2.9)) - 0.5;
    if (j == 1) R = rotEuler(vec3(0.0, h.y * 2.0 * a.w * 3.14159, 0.0)) * R;
    else R = R * rotEuler(h * 2.0 * a.w);
  }
  if (gAge == 2) { // elder: stooped
    if (j == 2) R = R * rotEuler(vec3(0.26, 0.0, 0.0));
    else if (j == 3) R = R * rotEuler(vec3(-0.16, 0.0, 0.0));
    else if (j == 9 || j == 11) R = R * rotEuler(vec3(0.12, 0.0, 0.0));
  }
  if (j == 3 && uLook.w > 0.0) R = rotEuler(vec3(gLookPitch, gLookYaw, 0.0)) * R;
  return R;
}
vec3 bodyMorph(vec3 p) {
  float hip = smoothstep(uBody.x - 0.2, uBody.x - 0.02, p.y) * (1.0 - smoothstep(uBody.x + 0.02, uBody.x + 0.2, p.y));
  float sh = smoothstep(uBody.z - 0.25, uBody.z - 0.05, p.y);
  float fx = 1.0 + gSex * (0.13 * hip - 0.08 * sh);
  p.x *= gW.x * fx; p.z *= gW.y;
  return p;
}
void crowdSetup() {
  gSeed = aLook.x;
  gSA = int(aAnim.x + 0.5); gSB = int(aTrans.x + 0.5);
  float tSince = max(uTime - aTrans.y, 0.0);
  gUA = cycU(gSA, tSince); gWB = 0.0; gUB = 0.0;
  if (gSB != gSA) { gWB = 1.0 - smoothstep(0.0, max(uStateInfo[gSA].z, 0.02), tSince); gUB = cycU(gSB, 1000.0); }
  int ag = int(aLook.w + 0.5); gAge = ag - (ag / 3) * 3; gSex = float(ag / 3);
  gW = vec2(0.93 + 0.17 * h11(gSeed * 71.0 + 3.0), 0.92 + 0.14 * h11(gSeed * 53.0 + 9.0));
  if (gAge == 1) gW = vec2(0.92, 0.95);
  gLookYaw = 0.0; gLookPitch = 0.0;
  if (uLook.w > 0.0) {
    vec3 d = uLook.xyz - (aPos.xyz + vec3(0.0, 1.5 * aAnim.w, 0.0));
    float dy = atan(d.x, d.z) - aPos.w; dy = dy - 6.2831853 * floor((dy + 3.14159265) / 6.2831853);
    float w = uLook.w * (1.0 - float((int(uStateInfo[gSA].w + 0.5) / 2) - 2 * (int(uStateInfo[gSA].w + 0.5) / 4)));
    gLookYaw = clamp(dy, -1.15, 1.15) * w * 0.85;
    gLookPitch = -clamp(atan(d.y, length(d.xz)), -0.5, 0.6) * w * 0.7;
  }
}
// returns world-space skinned position / normal; vis = 0 hides the vertex (variant gating)
void crowdSkin(vec3 pos, vec3 nrm, vec4 meta, out vec3 outP, out vec3 outN, out float vis) {
  int j = int(meta.x + 0.5);
  int g = int(meta.y + 0.5);
  vis = 1.0;
  if (g > 0) {
    int grp = g >> 4; int mask = g & 15;
    if (grp == 15) vis = (gSA == ${ST.fire} && fract(gUA * 3.0 * uKindV.y) < 0.22) ? 1.0 : 0.0;
    else if (grp == 14) vis = (gSA == ${ST.cough} && gUA > 0.12 && gUA < 0.62) ? 1.0 : 0.0;
    else {
      int v = int(aLook.z + 0.5); int opt = (v >> (2 * (grp - 1))) & 3;
      vis = (((mask >> opt) & 1) == 1) ? 1.0 : 0.0;
    }
  }
  if (vis < 0.5) { outP = aPos.xyz; outN = nrm; return; }
  vec3 p = pos;
  if (gAge == 1 && j == 3) { vec3 nk = uPivot[3]; p = nk + (p - nk) * 1.3; }
  p = bodyMorph(p);
  vec3 n = nrm;
  for (int k = 0; k < 4; k++) {
    if (j < 1) break;
    mat3 R = jointMat(j);
    vec3 pv = bodyMorph(uPivot[j]);
    p = pv + R * (p - pv);
    n = R * n;
    j = PARENT_T[j];
  }
  p += poseBlend(0).xyz;
  if (gAge == 2) p.y -= 0.035;
  if ((g >> 4) == 14) { // cough puff: expands & drifts forward from the mouth (puff geometry is a small sphere at the mouth)
    float t = clamp((gUA - 0.12) / 0.5, 0.0, 1.0); p = vec3(0.0, uBody.w + 0.1, 0.0) + (p - vec3(0.0, uBody.w + 0.1, 0.0)) * (0.5 + 2.2 * t) + vec3(0.0, 0.05 * t, 0.25 + 0.6 * t);
  }
  p *= aAnim.w;
  float cy = cos(aPos.w), sy = sin(aPos.w);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
  outP = p + aPos.xyz; outN = normalize(n);
  if (uKindV.x > 0.0) { vec3 wp = outP; float dd = distance(wp, cameraPosition); if (dd > uKindV.x) outP = aPos.xyz; }
}
`;

const VERT_MAIN = /* glsl */`
crowdSetup();
vec3 _cp; vec3 _cn; float _vis;
crowdSkin(position, normal, aMeta, _cp, _cn, _vis);
vec3 objectNormal = _cn;
vMeta = aMeta; vInst = aLook; vOvr = aCol; vUvA = uv;
`;

const FRAG_PARS = /* glsl */`
uniform sampler2DArray uAlb;
uniform sampler2DArray uNor;
uniform vec3 uPal[36];
uniform vec4 uKindF;   // x = emissive slot strength, y = emissive mask strength, z = normal strength, w = override slot
uniform vec3 uEmitCol;
uniform float uSkinLayer;
uniform vec4 uKindG;   // x = dirt amount, y = frost/gloss spare, z = spare, w = spare
varying vec2 vUvA;
flat varying vec4 vMeta;
flat varying vec4 vInst;
flat varying vec4 vOvr;
float hS(float s, float k) { return fract(sin(s * 91.3458 + k * 47.853) * 43758.5453); }
vec3 palPick(int off, int cnt, float h, float tint) { float f = fract(h + tint); int i = int(f * float(cnt)); return uPal[off + min(i, cnt - 1)]; }
vec3 slotCol(int slot, float seed, float tint) {
  vec3 c = vec3(1.0);
  if (slot == 1 || slot == 11) c = palPick(0, 6, hS(seed, 1.0), 0.0);
  else if (slot == 2) c = palPick(6, 6, hS(seed, 2.0), 0.0);
  else if (slot == 3) c = palPick(12, 8, hS(seed, 3.0), tint);
  else if (slot == 4) c = palPick(20, 6, hS(seed, 4.0), tint);
  else if (slot == 5) c = palPick(26, 6, hS(seed, 5.0), tint);
  else if (slot == 6) c = palPick(32, 4, hS(seed, 6.0), 0.0);
  else if (slot == 7) c = palPick(12, 8, hS(seed, 7.0), tint + 0.37);
  else if (slot == 12) c = palPick(12, 8, hS(seed, 3.0), tint);
  else return c;
  return c * (0.86 + 0.28 * hS(seed, 9.0 + float(slot)));
}
mat3 crowdTBN(vec3 eye, vec3 N, vec2 uv) {
  vec3 q0 = dFdx(eye), q1 = dFdy(eye); vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B)); float sc = (det == 0.0) ? 0.0 : inversesqrt(det);
  return mat3(T * sc, B * sc, N);
}
`;

const FRAG_COLOR = /* glsl */`
if ((int(vMeta.y + 0.5) >> 4) == 14) { if (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > 0.42) discard; }
int cSlot = int(vMeta.z + 0.5);
float cLayer = vMeta.w;
int cPal = cSlot;
if (cSlot >= 13) {
  bool bare = cSlot == 13 ? (hS(vInst.x, 21.0) < uKindG.y) : (cSlot == 14 ? (hS(vInst.x, 22.0) < uKindG.z) : (hS(vInst.x, 23.0) < uKindG.w));
  cPal = bare ? 1 : (cSlot == 14 ? 4 : 3);
  if (bare) cLayer = uSkinLayer;
}
vec4 cTx = texture(uAlb, vec3(vUvA, cLayer));
vec4 cNx = texture(uNor, vec3(vUvA, cLayer));
{
  vec3 pc = slotCol(cPal, vInst.x, vInst.y);
  if (cPal == int(uKindF.w + 0.5) && vOvr.a > 0.0) pc = mix(pc, vOvr.rgb * (0.9 + 0.2 * hS(vInst.x, 4.4)), vOvr.a);
  vec3 alb;
  if (cSlot == 11) { // face layers: tint mask 1 = skin, 0.5 = hair, 0 = untinted (eyes, teeth, blood)
    float aS = smoothstep(0.78, 0.95, cTx.a); float aH = 1.0 - smoothstep(0.08, 0.2, abs(cTx.a - 0.5));
    alb = cTx.rgb * mix(mix(vec3(1.0), pc, aS), slotCol(2, vInst.x, vInst.y), aH);
  } else alb = mix(cTx.rgb, cTx.rgb * pc, cTx.a);
  float dirt = 1.0 - uKindG.x * smoothstep(0.55, 0.0, vInfPos.y) * (0.45 + 0.55 * cTx.g);
  diffuseColor.rgb = alb * vColor.rgb * dirt;
  if (cSlot == 8) { diffuseColor.rgb = vColor.rgb; totalEmissiveRadiance += vColor.rgb * uKindF.x; }
  totalEmissiveRadiance += uEmitCol * cNx.a * uKindF.y;
}
`;
const FRAG_ROUGH = /* glsl */`
roughnessFactor = clamp(cNx.b * (cSlot == 12 ? 0.55 : 1.0), 0.05, 1.0);
metalnessFactor = cSlot == 9 ? 0.82 : (cSlot == 12 ? 0.18 : 0.0);
`;
const FRAG_NORMAL = /* glsl */`
{
  vec3 nm = vec3((cNx.rg * 2.0 - 1.0) * uKindF.z, 0.0); nm.z = sqrt(max(0.0, 1.0 - dot(nm.xy, nm.xy)));
  normal = normalize(crowdTBN(-vViewPosition, normal, vUvA) * nm);
}
`;

/** build uniforms shared by main + depth material of one crowd */
export function makeUniforms(kind, table, tex) {
  const piv = new Float32Array(NJ * 3); piv.set(kind.layout.pivots);
  const pal = new Float32Array(36 * 3);
  const col = new THREE.Color(); const put = (off, list, n) => { for (let i = 0; i < n; i++) { col.set(list[i % list.length]); pal[(off + i) * 3] = col.r; pal[(off + i) * 3 + 1] = col.g; pal[(off + i) * 3 + 2] = col.b; } };
  const P = kind.palette; put(0, P.skin, 6); put(6, P.hair, 6); put(12, P.top, 8); put(20, P.bot, 6); put(26, P.acc, 6); put(32, P.shoe, 4);
  const b = kind.layout;
  return {
    uTime: { value: 0 }, uPivot: { value: piv }, uStateInfo: { value: table.info }, uPose: { value: table.tex },
    uLook: { value: new THREE.Vector4(0, 0, 0, 0) },
    uBody: { value: new THREE.Vector4(b.hipY, b.waistY, b.shoulderY, b.neckY) },
    uKindV: { value: new THREE.Vector4(0, 1, 0, 0) },
    uAlb: { value: tex.alb }, uNor: { value: tex.nor }, uPal: { value: pal },
    uKindF: { value: new THREE.Vector4(kind.emitSlot ?? 0, kind.emitMask ?? 0, tex.normStrength ?? 1, kind.ovrSlot ?? 3) },
    uEmitCol: { value: new THREE.Color(kind.emitColor ?? 0x000000) },
    uKindG: { value: new THREE.Vector4(kind.dirt ?? 0.3, kind.bareArm ?? 0, kind.bareLeg ?? 0, kind.bareChest ?? 0) }, uSkinLayer: { value: kind.skinLayer ?? 6 },
  };
}

export function makeMaterial(uniforms, { infect = true } = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <beginnormal_vertex>', VERT_MAIN)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = _cp;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL);
    patchInfect(shader, { value: 0 }, { instanced: true });
  };
  mat.customProgramCacheKey = () => 'crowd-main-v1';
  mat.userData.crowd = true;
  return mat;
}

export function makeDepthMaterial(uniforms) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ncrowdSetup(); { vec3 _cp; vec3 _cn; float _vis; crowdSkin(position, normal, aMeta, _cp, _cn, _vis); transformed = _cp; vMeta = aMeta; vInst = aLook; vOvr = aCol; vUvA = uv; }');
  };
  mat.customProgramCacheKey = () => 'crowd-depth-v1';
  return mat;
}

/** soft ground blob shadow (one extra draw call per crowd, 2 tris per agent) */
export function makeBlobMaterial(opacity = 0.55) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uOpacity: { value: opacity }, uStateInfo: { value: null } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec4 aPos; attribute vec4 aAnim; attribute vec4 aLook; attribute vec4 aTrans;
      uniform vec4 uStateInfo[${NS}]; uniform float uTime;
      varying vec2 vQ; varying float vA;
      void main() {
        int sA = int(aAnim.x + 0.5);
        bool lying = (int(uStateInfo[sA].w + 0.5) / 2 - 2 * (int(uStateInfo[sA].w + 0.5) / 4)) == 1;
        float w = uStateInfo[sA].y > 0.0 ? clamp((uTime0 - aTrans.y) * aAnim.y / uStateInfo[sA].y, 0.0, 1.0) : 1.0;
        vec2 size = vec2(0.62, 0.62) * aAnim.w;
        float rot = aPos.w;
        if (lying) { float k = uStateInfo[sA].y > 0.0 ? w : 1.0; size = mix(size, vec2(0.62, 1.15) * aAnim.w, k); rot += 0.0; }
        float age = float(int(aLook.w + 0.5) - (int(aLook.w + 0.5) / 3) * 3);
        vQ = position.xy * 2.0; vA = 1.0;
        vec3 lp = vec3(position.x * size.x * 2.0, 0.0, position.y * size.y * 2.0);
        float cy = cos(rot), sy = sin(rot);
        lp = vec3(lp.x * cy + lp.z * sy, 0.03, -lp.x * sy + lp.z * cy);
        vec4 mvPosition = modelViewMatrix * vec4(aPos.xyz + lp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`.replace('uTime0', 'uTime'),
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uOpacity;
      varying vec2 vQ; varying float vA;
      void main() {
        float d = length(vQ);
        float a = (1.0 - smoothstep(0.1, 1.0, d)); a *= a * uOpacity;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
        #include <fog_fragment>
      }`,
  });
}
