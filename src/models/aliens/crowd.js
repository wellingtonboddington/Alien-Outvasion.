// createVessariCrowd(capacity, opts): instanced Vessari infantry (<= 700 tris each), one draw call, all animation in the vertex shader.
// The skeletal animation is BAKED from the hero rig (same IK gaits / clips) into a pose texture; the shader walks a 19-part hierarchy.
import * as THREE from 'three';
import { Q } from '../../engine/common.js';
import { infectable } from '../../engine/infect.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildRig, newPose, CH } from './rig.js';
import { evalClip, GAIT } from './clips.js';
import { loft, V3 } from './util.js';
import { createInstanceSet } from './instanced.js';

export const CROWD_STATES = { idle: 0, walk: 1, run: 2, aim: 3, fire: 4, roar: 5, fall: 6, dead: 7, lunge: 8 };
const PART_NAMES = ['pelvis', 'abdomen', 'chest', 'head', 'uarmL', 'farmL', 'uarmR', 'farmR', 'thighL', 'shinL', 'metaL', 'toeL', 'thighR', 'shinR', 'metaR', 'toeR', 'mandL', 'mandR', 'weapon'];
const PARENT = [-1, 0, 1, 2, 2, 4, 2, 6, 0, 8, 9, 10, 0, 12, 13, 14, 3, 3, 7];
const BONE = ['pelvis', 'spine0', 'spine2', 'head', 'uarm_L', 'farm_L', 'uarm_R', 'farm_R', 'thigh_L', 'shin_L', 'meta_L', 'toe_L', 'thigh_R', 'shin_R', 'meta_R', 'toe_R', 'mandU_L', 'mandU_R', 'hand_R'];
const PIVOT_BONE = ['pelvis', 'spine0', 'spine1', 'neck0', 'uarm_L', 'farm_L', 'uarm_R', 'farm_R', 'thigh_L', 'shin_L', 'meta_L', 'toe_L', 'thigh_R', 'shin_R', 'meta_R', 'toe_R', 'mandU_L', 'mandU_R', 'hand_R'];
const NP = PART_NAMES.length, W = NP + 1; // last column = pelvis translation
const P_ = {}; PART_NAMES.forEach((n, i) => { P_[n] = i; });

// ---------------------------------------------------------------- pose baking
const ROWS = {}; let ROW_COUNT = 0;
const plan = [ // [key, clip, count, tStart, tEnd, wrap]
  ['STAND', 'idle', 2, 0, 3.0], ['WALK', 'walk', 24, 0, GAIT.walk.T, true], ['RUN', 'run', 24, 0, GAIT.run.T, true], ['IRUN', 'infected_run', 24, 0, GAIT.run.T * 1.05, true],
  ['IIDLE', 'infected_idle', 2, 0, 1.6], ['AIM', 'aim', 2, 0, 2.0], ['FIRE', 'fire', 6, 0, 0.5, true], ['ROAR', 'roar', 8, 0, 2.8, true], ['FALL', 'die', 12, 0, 2.8], ['LUNGE', 'infected_lunge', 10, 0, 1.6], ['DEAD', 'dead', 1, 0, 0],
];
for (const [k, , n] of plan) { ROWS[k] = ROW_COUNT; ROW_COUNT += n; }
const WRAP = {}; for (const p of plan) WRAP[p[0]] = !!p[5];

function bakePoseTexture() {
  const rig = buildRig('soldier'); const P = newPose(); const ctx = { held: true, kind: 'soldier', E: 0, inf: 0 };
  const data = new Float32Array(W * ROW_COUNT * 4); const q = {}; const e = new THREE.Euler(); const qi = new THREE.Quaternion(), ql = new THREE.Quaternion(), qp = new THREE.Quaternion();
  const bones = {}; for (const n of new Set(BONE)) bones[n] = rig.B[n];
  const wq = {}; for (const n in bones) wq[n] = new THREE.Quaternion();
  let row = 0;
  for (const [key, clip, n, t0, t1, wrap] of plan) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? t0 : wrap ? t0 + (t1 - t0) * (i / n) : t0 + (t1 - t0) * (i / (n - 1));
      evalClip(clip, t, ctx, P); rig.applyPose(P, {}, {}); rig.group.updateMatrixWorld(true);
      for (const nm in bones) bones[nm].getWorldQuaternion(wq[nm]);
      for (let part = 0; part < NP; part++) {
        const bq = wq[BONE[part]]; const par = PARENT[part];
        if (par >= 0) { qp.copy(wq[BONE[par]]); ql.copy(qp).invert().multiply(bq); } else ql.copy(bq);
        e.setFromQuaternion(ql, 'XYZ'); const o = (row * W + part) * 4; data[o] = e.x; data[o + 1] = e.y; data[o + 2] = e.z;
      }
      const o = (row * W + NP) * 4; data[o] = rig.B.pelvis.position.x - rig.R.pelvis.x; data[o + 1] = rig.B.pelvis.position.y - rig.R.pelvis.y; data[o + 2] = rig.B.pelvis.position.z - rig.R.pelvis.z;
      row++;
    }
  }
  const tex = new THREE.DataTexture(data, W, ROW_COUNT, THREE.RGBAFormat, THREE.FloatType); tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true; tex.userData.shared = true;
  const pivots = PIVOT_BONE.map((b) => rig.R[b].clone());
  return { tex, pivots, rig };
}

// ---------------------------------------------------------------- geometry
const C = { skin: new THREE.Color(0x35506b), skinD: new THREE.Color(0x1f3146), shell: new THREE.Color(0xc9b588), dark: new THREE.Color(0x10161d), glow: new THREE.Color(0xffffff) };
export function tag(g, part, color, { shell = 0, glow = 0, flash = 0 } = {}) {
  const n = g.attributes.position.count; const col = new Float32Array(n * 3), av = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; av[i * 4] = part; av[i * 4 + 1] = glow; av[i * 4 + 2] = shell; av[i * 4 + 3] = flash; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aV', new THREE.BufferAttribute(av, 4));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aV'].includes(k)) g.deleteAttribute(k);
  if (!g.index) { const ix = new Uint16Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
  return g;
}
/** spindle: pointed-ended tapered prism between a and b. radial sides (default 5) */
export function spindle(a, b, r0, r1, radial = 5, k = 0.18) {
  const pos = [], idx = []; const A = a.clone ? a : new V3(...a), B = b.clone ? b : new V3(...b); const ax = B.clone().sub(A); const L = ax.length(); ax.normalize();
  const u = Math.abs(ax.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0); const e1 = new V3().crossVectors(ax, u).normalize(), e2 = new V3().crossVectors(ax, e1);
  const ringAt = (t, r) => { const c = A.clone().addScaledVector(ax, t * L); for (let i = 0; i < radial; i++) { const an = (i / radial) * Math.PI * 2; pos.push(c.x + (e1.x * Math.cos(an) + e2.x * Math.sin(an)) * r, c.y + (e1.y * Math.cos(an) + e2.y * Math.sin(an)) * r, c.z + (e1.z * Math.cos(an) + e2.z * Math.sin(an)) * r); } };
  pos.push(A.x - ax.x * r0 * 0.3, A.y - ax.y * r0 * 0.3, A.z - ax.z * r0 * 0.3); ringAt(k, r0); ringAt(1 - k, r1); pos.push(B.x + ax.x * r1 * 0.3, B.y + ax.y * r1 * 0.3, B.z + ax.z * r1 * 0.3);
  const r0i = 1, r1i = 1 + radial, top = 1 + radial * 2;
  for (let i = 0; i < radial; i++) { const j = (i + 1) % radial; idx.push(0, r0i + j, r0i + i); idx.push(r0i + i, r0i + j, r1i + i, r0i + j, r1i + j, r1i + i); idx.push(top, r1i + i, r1i + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function buildCrowdGeometry(rig) {
  const R = rig.R, rest = rig.rest; const list = []; const add = (g, part, color, o) => { list.push(tag(g, part, color, o)); return g; };
  const v = (x, y, z) => new V3(x, y, z); const mir = (p) => v(-p.x, p.y, p.z);
  // ---- torso lofted in 3 part groups (per-section part assignment)
  const secs = [[1.22, 0, 0.16, 0.11, -0.01, 0], [1.32, 0, 0.19, 0.13, -0.01, 0], [1.42, 1, 0.16, 0.115, 0.0, 0], [1.54, 1, 0.18, 0.14, 0.02, 0], [1.66, 2, 0.22, 0.18, 0.035, 1], [1.78, 2, 0.26, 0.195, 0.05, 1], [1.88, 2, 0.225, 0.165, 0.06, 1], [1.97, 2, 0.13, 0.115, 0.08, 0]];
  { // build separate lofts per part so each carries a single part id
    const groups = [[0, 1], [1, 2, 3], [2, 4, 5, 6, 7]]; // overlapping edge sections to stay watertight
    const defs = [[0, [secs[0], secs[1], secs[2]]], [1, [secs[2], secs[3], secs[4]]], [2, [secs[4], secs[5], secs[6], secs[7]]]]; void groups;
    for (const [part, ss] of defs) {
      const g = loft(ss.map((s) => ({ t: s[0], rx: s[2], ry: s[3], cy: s[4], power: 2.2 })), { axis: 'y', radial: 6, exact: true, capStart: part === 0, capEnd: part === 2, tile: 0.4 });
      // chest plating: shell colour on the upper sections via vertex colours baked after tag
      add(g, part, part === 2 ? C.shell.clone().lerp(C.skin, 0.25) : C.skin, { shell: part === 2 ? 1 : 0 });
    }
  }
  // ---- head (helm + face + visor band + mandibles + crest)
  const H = R.head; const hs = 0.8;
  const hl = (x, y, z) => v(H.x + x * hs, H.y + y * hs, H.z + z * hs);
  { const hsecs = [[-0.34, 0.012, 0.016, 0.13], [-0.14, 0.12, 0.14, 0.15], [0.06, 0.14, 0.16, 0.125], [0.22, 0.105, 0.115, 0.09], [0.31, 0.04, 0.05, 0.07]].map((s) => ({ t: s[0] * hs, rx: s[1] * hs, ry: s[2] * hs, cy: s[3] * hs, bot: 0.5, power: 2.1 }));
    const g = loft(hsecs, { axis: 'z', radial: 6, exact: true, tile: 0.4 }); g.translate(H.x, H.y, H.z); add(g, 3, C.shell, { shell: 1 });
    const fsecs = [[0.0, 0.1, 0.09, -0.05], [0.2, 0.085, 0.11, -0.06], [0.34, 0.03, 0.06, -0.05]].map((s) => ({ t: s[0] * hs, rx: s[1] * hs, ry: s[2] * hs, cy: s[3] * hs }));
    const f = loft(fsecs, { axis: 'z', radial: 6, exact: true, tile: 0.4 }); f.translate(H.x, H.y, H.z); add(f, 3, C.skin, {});
    // visor band: thin glowing ribbon across the front
    const bp = [], bi = []; const N = 6; for (let i = 0; i <= N; i++) { const a = (i / N * 2 - 1) * 1.25; const rr = 0.115 * hs; const x = H.x + Math.sin(a) * rr, z = H.z + (0.04 + Math.cos(a) * 0.19) * hs; bp.push(x, H.y + 0.085 * hs, z, x, H.y + 0.055 * hs, z); }
    for (let i = 0; i < N; i++) { const a = i * 2; bi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals();
    const nA = bg.attributes.normal; if (nA.getZ(0) < 0) { const ix = bg.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } bg.computeVertexNormals(); }
    // push the ribbon out slightly along z so it sits over the shell
    bg.translate(0, 0, 0.012); add(bg, 3, C.dark, { glow: 1 });
    // crest
    const cr = new THREE.BufferGeometry(); const cp = [H.x, H.y + 0.28 * hs, H.z - 0.3 * hs, H.x, H.y + 0.43 * hs, H.z - 0.15 * hs, H.x, H.y + 0.33 * hs, H.z + 0.12 * hs, H.x, H.y + 0.28 * hs, H.z + 0.0];
    cr.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cr.setIndex([0, 1, 3, 1, 2, 3, 0, 3, 1, 1, 3, 2]); cr.computeVertexNormals(); add(cr, 3, C.shell, { shell: 1 });
  }
  for (const [S, s] of [['L', 1], ['R', -1]]) { // mandibles (part 16/17): one tusk per side keeps the silhouette
    const o = R['mandU_' + S]; const m = spindle(o.clone(), o.clone().add(v(-0.05 * s * hs, -0.14 * hs, 0.14 * hs)), 0.018, 0.008, 3, 0.1); add(m, S === 'L' ? 16 : 17, C.shell, { shell: 1 });
  }
  // ---- legs
  for (const [S, s] of [['L', 1], ['R', -1]]) {
    const L = rest.leg[S]; const base = S === 'L' ? 8 : 12; const col = C.skin;
    add(spindle(L.hip, L.knee, 0.12, 0.07, 5, 0.12), base, C.shell.clone().lerp(C.skin, 0.35), { shell: 1 }); add(spindle(L.knee, L.hock, 0.07, 0.045, 5, 0.1), base + 1, col, {});
    add(spindle(L.hock, L.ball, 0.045, 0.035, 5, 0.08), base + 2, col, {});
    add(spindle(L.ball.clone().add(v(0, 0.0, -0.03)), L.ball.clone().add(v(0, -0.01, 0.2)), 0.04, 0.02, 4, 0.1), base + 3, col, {});
  }
  // ---- arms (rest) + hands
  for (const [S, s] of [['L', 1], ['R', -1]]) {
    const A = rest.arm[S]; const pu = S === 'L' ? 4 : 6, pf = pu + 1;
    add(spindle(A.sh, A.elbow, 0.082, 0.058, 5, 0.12), pu, C.skin, {}); add(spindle(A.elbow, A.wrist, 0.062, 0.044, 5, 0.1), pf, C.shell.clone().lerp(C.skin, 0.3), { shell: 1 });
    add(spindle(A.wrist, A.wrist.clone().add(v(0, -0.2, 0.02)), 0.04, 0.012, 4, 0.1), pf, C.skin, {});
    add(spindle(A.sh.clone().add(v(0.02 * s, 0.1, 0)), A.sh.clone().add(v(0.1 * s, -0.04, 0)), 0.09, 0.06, 4, 0.15), pu, C.shell, { shell: 1 });
  }
  // ---- respirator + dorsal spikes (on chest)
  { const c0 = v(0, 1.68, -0.15); const g = new THREE.SphereGeometry(1, 5, 3); g.scale(0.12, 0.18, 0.08); g.translate(c0.x, c0.y, c0.z); add(g, 2, new THREE.Color(0x3b1830), {});
    for (const s of [1, -1]) { const q = new THREE.PlaneGeometry(0.04, 0.07); q.rotateY(Math.PI); q.translate(0.07 * s, 1.8, -0.2); add(q, 2, C.dark, { glow: 1 }); }
    for (let i = 0; i < 2; i++) { const y = 1.55 + i * 0.2; add(spindle(v(0, y, -0.1 + i * 0.02), v(0, y + 0.05, -0.2 + i * 0.02), 0.025, 0.006, 3, 0.1), 2, C.shell, { shell: 1 }); } }
  // ---- weapon (bio-lance) rigid to the right hand (part 18): placed relative to the rest hand
  { const wr = rest.arm.R.wrist; const R90 = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2); const grip = new V3(0, -0.115, -0.085); const wl = new V3(0.03, -0.08, 0).sub(grip.clone().applyQuaternion(R90));
    const place = (g) => { g.applyQuaternion(R90); g.translate(wl.x + wr.x, wl.y + wr.y, wl.z + wr.z); return g; };
    add(place(spindle(v(0, 0.01, -0.22), v(0, 0.015, 0.5), 0.062, 0.03, 5, 0.12)), 18, C.shell, { shell: 1 });
    add(place(spindle(v(0, 0.01, 0.45), v(0, 0.016, 1.18), 0.024, 0.012, 4, 0.04)), 18, C.dark, {});
    const mz = new THREE.PlaneGeometry(0.05, 0.05); mz.translate(0, 0.016, 1.19); add(place(mz), 18, C.dark, { glow: 1, flash: 1 });
    add(place(spindle(v(0, -0.03, -0.065), v(0, -0.18, -0.115), 0.03, 0.026, 4, 0.1)), 18, C.skinD, {});
    add(place(spindle(v(0, 0.0, -0.15), v(0, -0.06, -0.5), 0.02, 0.025, 4, 0.1)), 18, C.skinD, {}); }
  const bd = {}; for (const g of list) { const p = g.attributes.aV.getX(0); bd[p] = (bd[p] || 0) + g.index.count / 3; }
  const merged = mergeGeometries(list, false); merged.userData.breakdown = bd; list.forEach((g) => g.dispose()); return merged;
}

// ---------------------------------------------------------------- shader
function crowdGLSL(pivots, declareInfect) {
  const arr = pivots.map((p) => `vec3(${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)})`).join(',');
  const defs = Object.keys(ROWS).map((k) => `#define ROW_${k} ${ROWS[k]}`).join('\n');
  return /* glsl */`
${defs}
#define NPARTS ${NP}
uniform sampler2D uPoseTex; uniform float uTime;
attribute vec4 aV; attribute vec4 aAnim;
${declareInfect ? 'attribute float aInfect;' : ''}
const int PARENT[${NP}] = int[${NP}](${PARENT.join(',')});
const vec3 PIV[${NP}] = vec3[${NP}](${arr});
float _cFlash = 0.0;
mat3 cRotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 cRotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 cRotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
vec3 cRow(int row, int col){ return texelFetch(uPoseTex, ivec2(col, row), 0).xyz; }
int g_base; int g_n; float g_fr; bool g_wrap; vec3 g_trans;
vec3 cPart(int part){
  float f = g_wrap ? fract(g_fr) * float(g_n) : clamp(g_fr, 0.0, 1.0) * float(g_n - 1);
  int i0 = int(floor(f)); int i1 = g_wrap ? (i0 + 1) - ((i0 + 1) >= g_n ? g_n : 0) : min(i0 + 1, g_n - 1); float w = f - float(i0);
  return mix(cRow(g_base + i0, part), cRow(g_base + i1, part), w);
}
void cSetup(){
  int st = int(aAnim.x + 0.5); float sp = aAnim.z; float tt = uTime * sp + aAnim.y; float tl = max(0.0, (uTime - aAnim.w)) * sp; bool inf = aInfect > 0.5;
  g_wrap = false; g_n = 2; g_fr = 0.5 + 0.5 * sin(tt * 0.9); g_base = ROW_STAND;
  if (inf) { g_base = ROW_IIDLE; g_fr = 0.5 + 0.5 * sin(tt * 3.1); }
  if (st == 1) { if (inf) { g_base = ROW_IRUN; g_n = 24; g_wrap = true; g_fr = tt / ${(GAIT.run.T * 1.05 * 1.35).toFixed(3)}; } else { g_base = ROW_WALK; g_n = 24; g_wrap = true; g_fr = tt / ${GAIT.walk.T.toFixed(3)}; } }
  else if (st == 2) { if (inf) { g_base = ROW_IRUN; g_n = 24; g_wrap = true; g_fr = tt / ${(GAIT.run.T * 1.05).toFixed(3)}; } else { g_base = ROW_RUN; g_n = 24; g_wrap = true; g_fr = tt / ${GAIT.run.T.toFixed(3)}; } }
  else if (st == 3 && !inf) { g_base = ROW_AIM; g_n = 2; g_fr = 0.5 + 0.5 * sin(tt * 1.3); }
  else if (st == 4 && !inf) { g_base = ROW_FIRE; g_n = 6; g_wrap = true; g_fr = tt / 0.5; float ph = fract(tt / 0.5); _cFlash = exp(-ph * 10.0) * (1.0 - exp(-ph * 60.0)); }
  else if (st == 5) { g_base = ROW_ROAR; g_n = 8; g_wrap = true; g_fr = tt / 2.8; }
  else if (st == 6) { g_base = ROW_FALL; g_n = 12; g_fr = tl / 2.8; }
  else if (st == 7) { g_base = ROW_DEAD; g_n = 1; g_fr = 0.0; }
  else if (st == 8) { g_base = ROW_LUNGE; g_n = 10; g_fr = tl / 1.6; }
  g_trans = cPart(NPARTS);
}
void crowdAnimate(inout vec3 p, inout vec3 n){
  int part = int(aV.x + 0.5);
  cSetup();
  if (part == 18 && aInfect > 0.5) { p = vec3(0.0); return; }
  for (int k = 0; k < 6; k++) {
    if (part < 0) break;
    vec3 a = cPart(part);
    mat3 R = cRotX(a.x) * cRotY(a.y) * cRotZ(a.z);
    vec3 pv = PIV[part];
    p = R * (p - pv) + pv; n = R * n;
    part = PARENT[part];
  }
  p += g_trans;
}`;
}

function makeMaterials(poseTex, pivots, timeU) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.04, emissive: new THREE.Color(0x000000) });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPoseTex = { value: poseTex }; shader.uniforms.uTime = timeU;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 aTint;\nvarying float vGlow; varying float vFlash;\n${crowdGLSL(pivots, false)}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 _cp = position; crowdAnimate(_cp, objectNormal);\nvGlow = aV.y; vFlash = aV.w * _cFlash;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = _cp;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb *= mix(vec3(1.0), aTint, aV.z);\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow; varying float vFlash;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ntotalEmissiveRadiance += vec3(0.10, 0.78, 1.0) * (vGlow * 1.5 + vFlash * 8.0);');
  };
  mat.customProgramCacheKey = () => 'vessariCrowd';
  infectable(mat, { instanced: true });
  const dep = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  dep.onBeforeCompile = (shader) => {
    shader.uniforms.uPoseTex = { value: poseTex }; shader.uniforms.uTime = timeU;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${crowdGLSL(pivots, true)}`).replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec3 _dn = normal; vec3 _cp = position; crowdAnimate(_cp, _dn); transformed = _cp; }');
  };
  dep.customProgramCacheKey = () => 'vessariCrowdDepth';
  return { mat, dep };
}

let _base = null;
function getBase() { if (!_base) { const b = bakePoseTexture(); const geo = buildCrowdGeometry(b.rig); _base = { tex: b.tex, pivots: b.pivots, geo }; } return _base; }

/** Instanced Vessari infantry. opts: {shadows:bool} */
export function createVessariCrowd(capacity = 400, opts = {}) {
  const b = getBase(); const geo = b.geo.clone(); const timeU = { value: 0 };
  const { mat, dep } = makeMaterials(b.tex, b.pivots, timeU);
  const crowd = createInstanceSet(capacity, geo, mat, CROWD_STATES, { timeUniform: timeU, castShadow: opts.shadows ?? Q.shadows, name: 'vessariCrowd' });
  crowd.mesh.customDepthMaterial = dep;
  crowd.triCount = geo.index.count / 3;
  return crowd;
}
export function crowdTriCount() { return getBase().geo.index.count / 3; }
export function crowdBreakdown() { const o = {}; const bd = getBase().geo.userData.breakdown; for (const k in bd) o[PART_NAMES[k]] = bd[k]; return o; }
