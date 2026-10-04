// Pooled additive laser beams: white-hot core + cyan glow, muzzle & impact flares, flicker, soft fade, optional travelling bolt / ground sweep.
// ONE draw call: an instanced mesh of 3 quads per beam (beam / muzzle flare / impact flare), everything computed in the vertex+fragment shader.
import * as THREE from 'three';
import { CYAN } from './mats.js';

const VERT = /* glsl */`
attribute vec3 aCorner;       // x: along (0..1) for beam | -1..1 for flares, y: across -1..1, z: part (0 beam, 1 muzzle, 2 impact)
attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aTo2; attribute vec3 aColor;
attribute vec4 aP;            // width, t0, life, seed
attribute vec4 aX;            // travel (bolt length as fraction of beam, 0 = instant), sweep flag, muzzle size, impact size
uniform float uTime; uniform float uInfect; uniform float uPx;
varying vec2 vUv; varying vec3 vCol; varying float vEnv; varying float vPart; varying float vAlong; varying float vSeg; varying float vWm; varying float vSeed;
void main(){
  float age = uTime - aP.y; float life = max(aP.z, 1e-3); float k = age / life;
  vPart = aCorner.z; vSeed = aP.w; vCol = mix(aColor, vec3(0.24, 1.0, 0.1), uInfect);
  if (age < 0.0 || k >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 to = aX.y > 0.5 ? mix(aTo, aTo2, k) : aTo;
  vec3 d = to - aFrom; float len = max(length(d), 1e-3); vec3 ax = d / len;
  float travel = aX.x; float seed = aP.w;
  float flick = 0.80 + 0.20 * sin(age * 83.0 + seed * 40.0) * sin(age * 37.0 + seed * 11.0) + 0.06 * sin(age * 191.0 + seed * 7.0);
  float env, arrive = 1.0;
  if (travel > 0.0) { env = smoothstep(0.0, 0.03, k) * flick; arrive = 1.0 / (1.0 + travel); }
  else { env = smoothstep(0.0, 0.04, k) * (1.0 - smoothstep(0.45, 1.0, k)) * flick; }
  vEnv = env;
  vec3 P; vec4 mv;
  if (vPart < 0.5) {
    float t0 = 0.0, t1 = 1.0;
    if (travel > 0.0) { float hd = k * (1.0 + travel); t0 = clamp(hd - travel, 0.0, 1.0); t1 = clamp(hd, 0.0, 1.0); }
    float ta = mix(t0, t1, aCorner.x);
    P = aFrom + d * ta;
    vec3 vd = cameraPosition - P; float dist = length(vd);
    vec3 r = cross(ax, vd); if (dot(r, r) < 1e-8) r = cross(ax, vec3(0.0, 1.0, 0.0)); if (dot(r, r) < 1e-8) r = cross(ax, vec3(1.0, 0.0, 0.0)); r = normalize(r);
    float w = max(aP.x, dist * uPx) * 2.4; vWm = w;
    P += r * aCorner.y * w;
    vUv = vec2(aCorner.x, aCorner.y); vAlong = (ta - t0) * len; vSeg = (t1 - t0) * len;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  } else {
    vec3 c = vPart < 1.5 ? aFrom : to; float sz = vPart < 1.5 ? aX.z : aX.w;
    float fe;
    if (vPart < 1.5) { fe = travel > 0.0 ? (1.0 - smoothstep(0.0, 0.12, k)) : exp(-k * 5.0); }
    else { float ka = travel > 0.0 ? clamp((k - arrive) / max(1e-3, 1.0 - arrive), 0.0, 1.0) : k; fe = (travel > 0.0 && k < arrive) ? 0.0 : exp(-ka * 3.5) * (0.85 + 0.3 * sin(age * 120.0 + seed * 9.0)); }
    vEnv = fe * (0.7 + 0.3 * flick);
    mv = viewMatrix * vec4(c, 1.0);
    float dist = length(mv.xyz); sz = max(sz, dist * uPx * 2.0) * (0.55 + 0.45 * fe);
    mv.xy += aCorner.xy * sz;
    vUv = aCorner.xy; vAlong = 0.0; vSeg = 1.0; vWm = sz;
    gl_Position = projectionMatrix * mv;
  }
}`;
const FRAG = /* glsl */`
varying vec2 vUv; varying vec3 vCol; varying float vEnv; varying float vPart; varying float vAlong; varying float vSeg; varying float vWm; varying float vSeed;
void main(){
  vec3 c;
  if (vPart < 0.5) {
    float d = abs(vUv.y);
    float core = smoothstep(0.17, 0.0, d);
    float hot = smoothstep(0.34, 0.0, d);
    float halo = exp(-d * d * 6.5) * 0.85 + exp(-d * 2.2) * 0.22; halo *= smoothstep(1.0, 0.55, d);
    float cap = smoothstep(0.0, vWm * 1.6, vAlong) * smoothstep(0.0, vWm * 1.6, vSeg - vAlong);
    c = (vCol * halo * 1.9 + mix(vCol, vec3(1.0), 0.65) * hot * 1.4 + vec3(1.0) * core * 2.4) * cap * vEnv;
  } else {
    vec2 p = vUv; float r = length(p); float ang = atan(p.y, p.x) + vSeed * 6.2831;
    float glow = exp(-r * r * 6.0) * 1.1 + exp(-r * 2.4) * 0.25;
    float spk = pow(abs(cos(ang * 2.0)), 40.0) * exp(-r * 2.6) * 1.4 + pow(abs(cos(ang * 3.0 + 0.6)), 60.0) * exp(-r * 3.4) * 0.6;
    float cr = smoothstep(0.22, 0.0, r);
    float edge = smoothstep(1.0, 0.7, r);
    c = (vCol * (glow + spk) * 1.6 + vec3(1.0) * cr * 2.2 + mix(vCol, vec3(1.0), 0.6) * smoothstep(0.45, 0.0, r) * 0.9) * edge * vEnv;
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * createBeams({capacity=768}) -> Beams
 *  fire({from,to,color,width,life,delay,travel,muzzle,impact})   straight beam (travel>0 -> a travelling bolt whose length is `travel` x beam length)
 *  sweep({from,to,toEnd,color,width,life,delay})                  beam whose impact point sweeps from `to` to `toEnd` (ground sweep)
 *  Positions are WORLD space: add beams.root to the scene at the origin.
 */
export function createBeams(opts = {}) {
  const cap = opts.capacity || 768;
  const g = new THREE.InstancedBufferGeometry();
  // 3 quads: beam, muzzle, impact
  const corner = [], index = [];
  const quad = (part, x0, x1, y0, y1) => { const b = corner.length / 3; corner.push(x0, y0, part, x1, y0, part, x0, y1, part, x1, y1, part); index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); };
  quad(0, 0, 1, -1, 1); quad(1, -1, 1, -1, 1); quad(2, -1, 1, -1, 1);
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(corner.length), 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 3)); g.setIndex(index);
  const mk = (n) => new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage);
  const aFrom = mk(3), aTo = mk(3), aTo2 = mk(3), aColor = mk(3), aP = mk(4), aX = mk(4);
  g.setAttribute('aFrom', aFrom); g.setAttribute('aTo', aTo); g.setAttribute('aTo2', aTo2); g.setAttribute('aColor', aColor); g.setAttribute('aP', aP); g.setAttribute('aX', aX);
  g.instanceCount = cap;
  for (let i = 0; i < cap; i++) aP.array[i * 4 + 1] = -1e6; // all expired
  const uniforms = { uTime: { value: 0 }, uInfect: { value: 0 }, uPx: { value: 0.0022 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.name = 'beams';
  const root = new THREE.Group(); root.add(mesh); root.name = 'Beams';
  const col = new THREE.Color();
  let head = 0, now = 0, dirty = false, seedCtr = 1;
  const defCol = opts.color ? new THREE.Color(opts.color) : CYAN;
  function put(o, sweep) {
    const i = head; head = (head + 1) % cap;
    const f = o.from, t = o.to, t2 = o.toEnd || o.to;
    aFrom.setXYZ(i, f.x, f.y, f.z); aTo.setXYZ(i, t.x, t.y, t.z); aTo2.setXYZ(i, t2.x, t2.y, t2.z);
    col.set(o.color != null ? o.color : defCol); aColor.setXYZ(i, col.r, col.g, col.b);
    const w = o.width ?? 0.18;
    aP.setXYZW(i, w, now + (o.delay || 0), o.life ?? 0.35, (seedCtr++ * 0.6180339) % 1);
    aX.setXYZW(i, o.travel || 0, sweep ? 1 : 0, o.muzzle ?? w * 7, o.impact ?? w * 9);
    dirty = true; return i;
  }
  const api = {
    root, capacity: cap, mesh, material: mat,
    fire(o) { return put(o, false); },
    sweep(o) { return put(o, true); },
    update(dt, t) {
      now = typeof t === 'number' ? t : now + dt; uniforms.uTime.value = now;
      if (dirty) { for (const a of [aFrom, aTo, aTo2, aColor, aP, aX]) a.needsUpdate = true; dirty = false; }
    },
    /** 0..1: turn every beam green (infected strain) */
    setInfection(a) { uniforms.uInfect.value = a; },
    /** minimum on-screen beam thickness factor (world units per metre of distance); default ~2.2 px at 1080p/40deg */
    setMinPixel(k) { uniforms.uPx.value = k; },
    /** number of beams currently alive (approx) */
    get active() { let n = 0; for (let i = 0; i < cap; i++) { const age = now - aP.array[i * 4 + 1]; if (age >= 0 && age < aP.array[i * 4 + 2]) n++; } return n; },
    clear() { for (let i = 0; i < cap; i++) aP.array[i * 4 + 1] = -1e6; aP.needsUpdate = true; head = 0; },
    dispose() { g.dispose(); mat.dispose(); },
  };
  return api;
}
