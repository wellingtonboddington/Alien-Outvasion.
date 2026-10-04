// Instanced low-poly TRIPOD HORDE (<= ~450 tris each, ONE draw call, capacity 400+). Gait is done in the vertex shader:
// analytic 2-bone IK per leg with foot planting (feet stay fixed in the ground frame when the instance advances at walkSpeed()).
import * as THREE from 'three';
import { RNG, GLOBAL, clamp, lerp, TAU, damp } from '../../engine/common.js';
import { tube } from '../../engine/geo.js';
import { infectable } from '../../engine/infect.js';
import { CYAN } from './mats.js';
import { revolve, blob, spike, place, alignY, basisQuat, sstep } from './kit.js';
import { shellTextures } from './tex.js';
import { tripodRest, TC } from './tripod.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const STRIDE = 8.5, LIFT = 3.4, DUTY = 0.75, V0 = 3.0;         // design-scale gait (matches the hero tripod)
const f = (n) => n.toFixed(5);
const v3s = (v) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;

function buildGeometry() {
  const rest = tripodRest();
  const parts = [];
  const FLESH = [0.2, 0.42, 1.0], TAN = [1, 0.96, 0.88], DARK = [0.1, 0.18, 0.4];
  // finalize a part: g in LOCAL coords (bone-local for legs, rest rig space for body); M = rest matrix (or null)
  const fin = (g, { bone, leg = 0, color = FLESH, glow = 0, M = null, param = null }) => {
    if (!g.index) { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count; const p = g.attributes.position;
    const loc = new Float32Array(p.array), cols = new Float32Array(n * 3), gl = new Float32Array(n).fill(glow), bn = new Float32Array(n).fill(bone), lg = new Float32Array(n).fill(leg), pr = new Float32Array(n);
    for (let i = 0; i < n; i++) { const c = typeof color === 'function' ? color(p.getX(i), p.getY(i), p.getZ(i)) : color; cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2]; }
    if (param) { for (let i = 0; i < n; i++) pr[i] = param(g, i); }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (M) { // position -> rest rig space, keep normal LOCAL
      const v = new V3(); for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); p.setXYZ(i, v.x, v.y, v.z); }
    }
    g.setAttribute('aLocal', new THREE.BufferAttribute(loc, 3)); g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
    g.setAttribute('aBone', new THREE.BufferAttribute(bn, 1)); g.setAttribute('aLeg', new THREE.BufferAttribute(lg, 1)); g.setAttribute('aParam', new THREE.BufferAttribute(pr, 1));
    parts.push(g); return g;
  };
  const sphere = (rx, ry, rz, w, h, y = 0, z = 0, x = 0) => { const g = new THREE.SphereGeometry(1, w, h); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
  // ----- body (rig rest space)
  fin(sphere(3.1, 1.6, 3.3, 6, 3, TC.PH, 0.1), { bone: 0, color: FLESH });
  fin(revolve(TC.TORSO_H, (t, y) => TC.TORSO_R(y), { rings: 3, radial: 8, tile: 5, ratio: TC.TORSO_RATIO }).translate(0, TC.PH, 0), { bone: 0, color: (x, y) => ((y - TC.PH) % 2.4 < 1.2 ? TAN : FLESH) });
  const hp = TC.HEAD_PIVOT;
  fin(sphere(TC.HEAD_R.x * 1.12, TC.HEAD_R.y * 1.12, TC.HEAD_R.z * 1.1, 8, 5, TC.PH + hp.y + TC.HEAD_C.y, hp.z + TC.HEAD_C.z), { bone: 4, color: TAN });
  { const zf = TC.headSurfZ(0, TC.EYE_Y) + hp.z + 0.12; const e = new THREE.CircleGeometry(1.0, 8); e.scale(1.7, 1.0, 1); e.translate(0, TC.PH + hp.y + TC.EYE_Y, zf); fin(e, { bone: 4, color: [0.05, 0.1, 0.12], glow: 1.4 }); }
  { const c = new THREE.ConeGeometry(0.7, 2.4, 4, 1, true); c.translate(0, 1.2, 0); c.scale(0.6, 1, 1); c.translate(0, TC.PH + hp.y + TC.HEAD_C.y + TC.HEAD_R.y - 0.4, hp.z - 0.8); fin(c, { bone: 4, color: TAN }); }
  { // belly cannon: cone with apex at the base, opening toward the aim direction, plus a glowing mouth disc
    const cg = new THREE.ConeGeometry(1.3, 3.6, 6, 1, true); cg.rotateX(Math.PI); cg.translate(0, 1.8, 0);
    const qd = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), TC.CANNON_DIR);
    cg.applyQuaternion(qd); cg.translate(TC.CANNON_BASE.x, TC.PH + TC.CANNON_BASE.y, TC.CANNON_BASE.z);
    fin(cg, { bone: 0, color: DARK });
    const mouth = new THREE.CircleGeometry(0.85, 6); mouth.rotateX(-Math.PI / 2); mouth.applyQuaternion(qd);
    mouth.translate(TC.CANNON_BASE.x + TC.CANNON_DIR.x * 3.2, TC.PH + TC.CANNON_BASE.y + TC.CANNON_DIR.y * 3.2, TC.CANNON_BASE.z + TC.CANNON_DIR.z * 3.2);
    fin(mouth, { bone: 0, color: [0.05, 0.1, 0.12], glow: 1.2 });
  }
  { // tentacle: curved tube, bends in the shader
    const pts = []; for (let j = 0; j <= 5; j++) { const s = j / 5; pts.push(new V3(TC.TENT_BASE.x - 0.6 * s * s * 4, TC.PH + TC.TENT_BASE.y - 5.5 * s + 0.0, TC.TENT_BASE.z + 9 * s)); }
    fin(tube(pts, [0.95, 0.75, 0.55, 0.38, 0.24, 0.12], { radial: 5, segsPerPoint: 1 }), { bone: 5, color: FLESH, param: (g, i) => g.attributes.uv.getY(i) });
  }
  // ----- legs (bone-local)
  for (let i = 0; i < 3; i++) {
    const Mt = TC.boneMatrix(rest, TC.B.thigh + i), Ms = TC.boneMatrix(rest, TC.B.shin + i), Mf = TC.boneMatrix(rest, TC.B.foot + i);
    fin(revolve(TC.L1, (t) => 1.1 - 0.4 * t, { rings: 1, radial: 6, tile: 6 }), { bone: 1, leg: i, color: FLESH, M: Mt });
    fin(revolve(TC.L2, (t) => 0.76 - 0.28 * t, { rings: 1, radial: 6, tile: 6 }), { bone: 2, leg: i, color: FLESH, M: Ms });
    { const k = new THREE.OctahedronGeometry(1.15, 0); fin(k, { bone: 2, leg: i, color: TAN, M: Ms }); }
    { const k = new THREE.ConeGeometry(0.45, 3.0, 4); k.translate(0, 1.5, 0.6); k.rotateX(0.0); const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(0, 0.3, 1).normalize()); const g2 = new THREE.ConeGeometry(0.45, 2.8, 4, 1, true); g2.translate(0, 1.4, 0); g2.applyQuaternion(q); g2.translate(0, 0, 0.6); fin(g2, { bone: 2, leg: i, color: TAN, M: Ms }); }
    // foot strut + toes (foot-local)
    const strut = revolve(TC.ANK.y - 0.5, (t) => 0.5 - 0.15 * t, { rings: 1, radial: 5, tile: 3 }).translate(0, 0.5, 0); fin(strut, { bone: 3, leg: i, color: FLESH, M: Mf });
    for (const [az, len] of [[-0.74, 4.6], [0, 5.4], [0.74, 4.6]]) { const t = new THREE.ConeGeometry(0.55, len, 4, 1, true); t.rotateX(Math.PI / 2); t.translate(0, 0.3, len / 2 + 0.3); t.rotateY(az); fin(t, { bone: 3, leg: i, color: TAN, M: Mf }); }
  }
  return mergeGeometries(parts, false);
}

const VERT_DECL = `
attribute float aBone; attribute float aLeg; attribute vec3 aLocal; attribute float aParam; attribute float aGlow; attribute vec4 aGait; attribute float aSeed;
uniform float uTime;
varying float vGlow; varying float vDeadG;
const float H_PH = ${f(TC.PH)}; const float H_L1 = ${f(TC.L1)}; const float H_L2 = ${f(TC.L2)};
const float H_STRIDE = ${f(STRIDE)}; const float H_LIFT = ${f(LIFT)}; const float H_DUTY = ${f(DUTY)};
const vec3 H_ANK = ${v3s(TC.ANK)};
const vec3 H_HIP[3] = vec3[3](${TC.HIP_LOCAL.map(v3s).join(', ')});
const vec3 H_POLE[3] = vec3[3](${TC.POLE.map(v3s).join(', ')});
const float H_AZ[3] = float[3](${TC.LEG_AZ.map(f).join(', ')});
const float H_HR[3] = float[3](${TC.HOME_R.map(f).join(', ')});
const float H_OFF[3] = float[3](0.0, 0.66667, 0.33333);
const vec3 H_HEADP = ${v3s(TC.HEAD_PIVOT)}; const vec3 H_TENT = ${v3s(TC.TENT_BASE)};
mat3 hRotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 hRotX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 hRotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
mat3 hBasis(vec3 dir, vec3 pole){ vec3 y = normalize(dir); vec3 z = pole - y * dot(pole, y); z = normalize(z); vec3 x = cross(y, z); return mat3(x, y, z); }
vec3 hIK(vec3 h, vec3 t, vec3 pole){
  vec3 d = t - h; float len = clamp(length(d), abs(H_L1 - H_L2) + 0.05, (H_L1 + H_L2) * 0.9995); d = normalize(d);
  float a = (H_L1 * H_L1 - H_L2 * H_L2 + len * len) / (2.0 * len); float hh = sqrt(max(0.0, H_L1 * H_L1 - a * a));
  vec3 pp = pole - d * dot(pole, d); pp = normalize(pp); return h + d * a + pp * hh;
}`;
const VERT_NORMAL = `
float hSt = aGait.z; float hPh = aGait.x; float hSpd = aGait.y;
float hDead = (hSt > 1.5) ? clamp((uTime - aGait.w) / 1.6, 0.0, 1.0) : 0.0; hDead = hDead * hDead * (3.0 - 2.0 * hDead);
float hMove = (hSt < 0.5) ? clamp(hSpd, 0.0, 1.0) : 0.0;
float hCyc = hPh * 6.2831853;
float hBob = -0.5 * (0.5 - 0.5 * cos(hCyc * 3.0)) * hMove + 0.1 * sin(uTime * 1.1 + aSeed * 6.28);
vec3 hPelvis = vec3(0.0, H_PH + hBob, 0.0); hPelvis.y = mix(hPelvis.y, 4.6, hDead);
mat3 hRp = hRotZ(sin(hCyc * 3.0) * 0.02 * hMove + 0.32 * hDead) * hRotX(0.05 * hMove + 0.12 * hDead);
vec3 hPos = vec3(0.0); vec3 hNrm = normal;
if (aBone < 0.5) { hPos = hPelvis + hRp * (aLocal - vec3(0.0, H_PH, 0.0)); hNrm = hRp * normal; }
else if (aBone < 3.5) {
  int lg = int(aLeg + 0.5); float az = H_AZ[lg];
  float p = fract(hPh + H_OFF[lg]); float fz, lift, pit = 0.0;
  if (p < H_DUTY) { float k = p / H_DUTY; fz = H_STRIDE * 0.5 - H_STRIDE * k; lift = 0.0; }
  else { float k = (p - H_DUTY) / (1.0 - H_DUTY); float e = k * k * k * (k * (k * 6.0 - 15.0) + 10.0); fz = -H_STRIDE * 0.5 + H_STRIDE * e; lift = pow(sin(3.14159265 * k), 0.8) * H_LIFT; pit = 0.45 * sin(3.14159265 * k); }
  fz *= hMove; lift *= hMove; pit *= hMove;
  float rs = mix(1.0, 1.32, hDead);
  vec3 foot = vec3(sin(az) * H_HR[lg] * rs, lift, cos(az) * H_HR[lg] * rs + fz);
  mat3 Rf = hRotY(az) * hRotX(pit);
  vec3 ankle = foot + Rf * H_ANK; vec3 hip = hPelvis + hRp * H_HIP[lg]; vec3 pole = hRp * H_POLE[lg];
  vec3 knee = hIK(hip, ankle, pole);
  if (aBone < 1.5) { mat3 Bm = hBasis(knee - hip, pole); hPos = hip + Bm * aLocal; hNrm = Bm * normal; }
  else if (aBone < 2.5) { mat3 Bm = hBasis(ankle - knee, pole); hPos = knee + Bm * aLocal; hNrm = Bm * normal; }
  else { hPos = foot + Rf * aLocal; hNrm = Rf * normal; }
}
else if (aBone < 4.5) { // head scans left/right
  float hy = sin(uTime * 0.45 + aSeed * 6.28) * 0.5 * (1.0 - hDead);
  mat3 Ry = hRotY(hy); vec3 loc = aLocal - vec3(0.0, H_PH, 0.0) - H_HEADP;
  hPos = hPelvis + hRp * (H_HEADP + Ry * loc); hNrm = hRp * (Ry * normal);
}
else { // tentacle sways
  float s = aParam; float yb = (sin(uTime * 0.8 + aSeed * 6.28 + s * 2.0) * 0.45 * s) * (1.0 - hDead * 0.7);
  vec3 loc = aLocal - vec3(0.0, H_PH, 0.0) - H_TENT; mat3 Ry = hRotY(yb);
  hPos = hPelvis + hRp * (H_TENT + Ry * loc); hNrm = hRp * (Ry * normal);
}
vec3 objectNormal = normalize(hNrm);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

/** createTripodHorde(capacity, opts) -> Crowd-like. set(i,{x,y,z,yaw,speed,phase,scale,infect,state:'walk'|'stand'|'dead'}) */
export function createTripodHorde(capacity = 400, opts = {}) {
  const cap = capacity;
  const geo = buildGeometry();
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; for (const k in geo.attributes) ig.setAttribute(k, geo.attributes[k]);
  const aGait = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  const aInfect = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
  ig.setAttribute('aGait', aGait); ig.setAttribute('aSeed', aSeed); ig.setAttribute('aInfect', aInfect);
  const rng = new RNG(4242); for (let i = 0; i < cap; i++) aSeed.array[i] = rng.next();
  const sh = shellTextures();
  const mat = new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: sh.orm, roughness: 0.85, metalness: 0.0, vertexColors: true, envMapIntensity: 1.0 });
  const uniforms = { uTime: { value: 0 }, uGlowCol: { value: new THREE.Color(CYAN).multiplyScalar(3.2) } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <beginnormal_vertex>', VERT_NORMAL)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = hPos; vGlow = aGlow * (1.0 - hDead);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uGlowCol; uniform float uTime; varying float vGlow;`)
      .replace('#include <emissivemap_fragment>', `totalEmissiveRadiance += uGlowCol * vGlow * (0.85 + 0.15 * sin(uTime * 3.0));\n#include <emissivemap_fragment>`);
  };
  infectable(mat, { instanced: true });
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying float vGlowD;\n${VERT_DECL.replace('varying float vGlow; varying float vDeadG;', '')}`)
      .replace('#include <begin_vertex>', `${VERT_NORMAL}\nvec3 transformed = hPos;`);
  };
  const mesh = new THREE.InstancedMesh(ig, mat, cap); mesh.customDepthMaterial = depthMat; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'TripodHorde';
  const root = new THREE.Group(); root.add(mesh); root.name = 'TripodHorde';
  const S = { x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap), yaw: new Float32Array(cap), scale: new Float32Array(cap).fill(1), speed: new Float32Array(cap), state: new Uint8Array(cap), phase: new Float32Array(cap) };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), sc = new V3(), UPY = new V3(0, 1, 0);
  let count = 0, now = 0, dirty = false;
  const STATES = { walk: 0, stand: 1, dead: 2 };
  // cycle rate (cycles/s) at speed multiplier 1 = nominal world speed V0*scale / (STRIDE*scale)
  const CYC = V0 / STRIDE;
  const hd = {
    root, capacity: cap, mesh, autoAdvance: opts.autoAdvance !== false, trisPerInstance: geo.index.count / 3,
    get count() { return count; },
    setCount(n) { count = Math.min(cap, Math.max(0, n | 0)); mesh.count = count; return hd; },
    /** world speed (m/s) that exactly matches instance i's foot cadence (feet then do not slide) */
    walkSpeed(i) { return V0 * S.speed[i] * S.scale[i]; },
    set(i, o) {
      if (i >= cap) return hd; if (i >= count) { count = i + 1; mesh.count = count; }
      if (o.x !== undefined) S.x[i] = o.x; if (o.y !== undefined) S.y[i] = o.y; if (o.z !== undefined) S.z[i] = o.z;
      if (o.yaw !== undefined) S.yaw[i] = o.yaw; if (o.scale !== undefined) S.scale[i] = o.scale; if (o.speed !== undefined) S.speed[i] = o.speed;
      if (o.phase !== undefined) { S.phase[i] = o.phase; aGait.array[i * 4] = o.phase % 1; }
      if (o.state !== undefined) { const v = typeof o.state === 'string' ? (STATES[o.state] ?? 0) : o.state; if (v !== S.state[i]) { S.state[i] = v; aGait.array[i * 4 + 2] = v; aGait.array[i * 4 + 3] = now; } }
      if (o.infect !== undefined) aInfect.array[i] = o.infect;
      write(i); dirty = true; return hd;
    },
    get(i, out = {}) { out.x = S.x[i]; out.y = S.y[i]; out.z = S.z[i]; out.yaw = S.yaw[i]; out.scale = S.scale[i]; out.speed = S.speed[i]; out.phase = S.phase[i]; out.infect = aInfect.array[i]; out.state = ['walk', 'stand', 'dead'][S.state[i]]; return out; },
    commit() { mesh.instanceMatrix.needsUpdate = true; aGait.needsUpdate = true; aInfect.needsUpdate = true; dirty = false; return hd; },
    update(dt, t) {
      now = typeof t === 'number' ? t : now + dt; uniforms.uTime.value = now;
      for (let i = 0; i < count; i++) {
        if (S.state[i] !== 0) continue; const sp = S.speed[i]; if (sp <= 0) { continue; }
        S.phase[i] = (S.phase[i] + dt * CYC * sp) % 1; aGait.array[i * 4] = S.phase[i]; aGait.array[i * 4 + 1] = clamp(sp, 0, 1.5);
        if (hd.autoAdvance) { const v = V0 * sp * S.scale[i] * dt; S.x[i] += Math.sin(S.yaw[i]) * v; S.z[i] += Math.cos(S.yaw[i]) * v; write(i); }
      }
      mesh.instanceMatrix.needsUpdate = true; aGait.needsUpdate = true;
    },
    setInfectionAll(a) { for (let i = 0; i < cap; i++) aInfect.array[i] = a; aInfect.needsUpdate = true; },
    dispose() { ig.dispose(); mat.dispose(); depthMat.dispose(); },
  };
  function write(i) {
    q.setFromAxisAngle(UPY, S.yaw[i]); p.set(S.x[i], S.y[i], S.z[i]); sc.setScalar(S.scale[i]); m4.compose(p, q, sc); mesh.setMatrixAt(i, m4);
    aGait.array[i * 4 + 1] = clamp(S.speed[i], 0, 1.5);
  }
  return hd;
}
