// Kit: batching "set builder" for the everyday-life sets.
//  * collects boxes / cylinders / lathes / tubes / arbitrary geometry (in a local frame with a matrix stack),
//  * assigns tiling UVs in metres (box projection in set space) so textures line up across separate pieces,
//  * merges everything per material into a handful of draw calls,
//  * materials are per-set clones of cached specs (textures are shared through proc.cached) and get a cheap analytic "baked AO" patch.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RNG, seg, disposeTree, GLOBAL } from '../../../engine/common.js';
import { tex, normal, envTex, res } from './tex.js';

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const ZERO = new THREE.Vector3(0, 0, 0);

// ------------------------------------------------------------------ material specs
// tile = metres covered by one texture tile.  env = envMapIntensity (0 = none).
export const MATS = {
  plaster: { map: 'plaster', color: 0xe8e4da, rough: 0.92, tile: 2.4 },
  paint: { color: 0xcccccc, rough: 0.7 },
  matte: { color: 0xcccccc, rough: 0.95 },
  plastic: { color: 0xcccccc, rough: 0.28, env: 0.5 },
  tileWall: { map: 'tileWall', nrm: 'tileWall', nrmS: 0.8, color: 0xffffff, rough: 0.22, tile: 1.2, env: 0.6 },
  tileFloor: { map: 'tileFloor', nrm: 'tileFloor', nrmS: 0.5, color: 0xffffff, rough: 0.4, tile: 1.2, env: 0.45 },
  checker: { map: 'checker', color: 0xffffff, rough: 0.3, tile: 0.8, env: 0.6 },
  marble: { map: 'marble', color: 0xffffff, rough: 0.1, tile: 1.8, env: 0.9 },
  woodPlank: { map: 'woodPlank', nrm: 'woodPlank', nrmS: 0.7, color: 0xffffff, rough: 0.52, tile: 1.12, env: 0.35 },
  woodGrain: { map: 'woodGrain', color: 0xffffff, rough: 0.48, tile: 1.0, env: 0.35 },
  brick: { map: 'brick', nrm: 'brick', nrmS: 1.2, color: 0xffffff, rough: 0.92, tile: 0.9 },
  concrete: { map: 'concrete', nrm: 'concrete', nrmS: 0.8, color: 0xffffff, rough: 0.95, tile: 2.0 },
  asphalt: { map: 'asphalt', color: 0xffffff, rough: 0.96, tile: 3.0 },
  grass: { map: 'grass', color: 0xffffff, rough: 1.0, tile: 2.0 },
  steel: { map: 'steel', nrm: 'steel', nrmS: 0.25, color: 0xffffff, rough: 0.3, metal: 0.9, tile: 1.2, env: 1.0 },
  diamond: { map: 'diamond', nrm: 'diamond', nrmS: 1.0, color: 0xffffff, rough: 0.42, metal: 0.8, tile: 0.8, env: 0.9 },
  carpet: { map: 'carpet', color: 0xffffff, rough: 1.0, tile: 1.0 },
  fabric: { map: 'fabric', color: 0xffffff, rough: 0.95, tile: 0.5 },
  leather: { map: 'leather', nrm: 'leather', nrmS: 0.6, color: 0xffffff, rough: 0.5, tile: 0.5, env: 0.4 },
  corrugated: { map: 'corrugated', nrm: 'corrugated', nrmS: 0.9, color: 0xffffff, rough: 0.55, metal: 0.45, tile: 0.8, env: 0.7 },
  ceilTile: { map: 'ceilTile', color: 0xffffff, rough: 0.95, tile: 1.2, selfLit: 0.28 },
  rubber: { map: 'rubber', color: 0xffffff, rough: 0.9, tile: 0.8 },
  tarp: { map: 'tarp', color: 0xffffff, rough: 0.7, tile: 1.4, side: 'double' },
  sheet: { map: 'sheet', color: 0xffffff, rough: 0.95, tile: 0.8, side: 'double' },
  chrome: { color: 0xe4e8ec, rough: 0.1, metal: 1.0, env: 1.3 },
  steelPlain: { color: 0xaeb4ba, rough: 0.32, metal: 0.9, env: 1.0 },
  darkMetal: { color: 0x3a3e44, rough: 0.5, metal: 0.8, env: 0.8 },
  brass: { color: 0xc9a14a, rough: 0.28, metal: 1.0, env: 1.1 },
  rubberBlack: { color: 0x1c1d1f, rough: 0.9 },
  glass: { color: 0xc4e0e2, rough: 0.04, metal: 0.0, env: 1.5, transparent: true, opacity: 0.2, noShadow: true, side: 'double' },
  mirror: { color: 0xe8eef2, rough: 0.02, metal: 1.0, env: 1.4 },
  screenOff: { color: 0x050607, rough: 0.12, metal: 0.4, env: 0.8 },
  palmTrunk: { map: 'bark', color: 0xd8c8b4, rough: 0.95, tile: 1, uv: 'own' },
  leaf: { map: 'leaf', color: 0xffffff, rough: 0.7, alphaTest: 0.5, side: 'double', tile: 1, uv: 'own' },
  frond: { map: 'frond', color: 0xffffff, rough: 0.7, alphaTest: 0.45, side: 'double', tile: 1, uv: 'own' },
  glow: { glow: true, color: 0xffffff, intensity: 2.2 },
  glowWarm: { glow: true, color: 0xffd9a0, intensity: 2.0 },
  glowCool: { glow: true, color: 0xcfeaff, intensity: 2.0 },
  flatBlack: { glow: true, color: 0x000000, intensity: 1 },
};

// ------------------------------------------------------------------ the kit
export class Kit {
  constructor(opts = {}) {
    this.share = opts.share || null;
    this.root = new THREE.Group(); this.root.name = opts.name || 'kit';
    this.buckets = new Map();
    this.mats = this.share ? this.share.mats : new Map();
    this.stack = []; this.cur = new THREE.Matrix4(); this.tintC = new THREE.Color(1, 1, 1); this.tintStack = [];
    this.amb = this.share ? this.share.amb : { inv: { value: new THREE.Matrix4() }, bmin: { value: new THREE.Vector3(-1e4, -1e4, -1e4) }, bmax: { value: new THREE.Vector3(1e4, 1e4, 1e4) }, ao: { value: new THREE.Vector4(0, 0, 0, 0.6) } };
    this.swayU = this.share ? this.share.swayU : { value: 0 };
    this.envKind = this.share ? this.share.envKind : (opts.env || 'interior');
    this.updaters = this.share ? this.share.updaters : [];
    this.rng = new RNG(opts.seed || 1);
    this.castShadow = opts.castShadow ?? true; this.receiveShadow = opts.receiveShadow ?? true;
    this.tris = 0;
  }
  sub(name, opts = {}) { return new Kit({ share: this, name, ...opts }); }
  /** configure the analytic ambient occlusion box (set space). strengths 0..1; range in metres */
  setAmbience({ min, max, floor = 0.45, wall = 0.35, ceil = 0.3, range = 0.7 }) {
    this.amb.bmin.value.set(...min); this.amb.bmax.value.set(...max); this.amb.ao.value.set(floor, wall, ceil, range);
  }
  /** call every frame (or when the set moves) so AO stays in set space */
  syncAmbience(root) { root.updateWorldMatrix(true, false); this.amb.inv.value.copy(root.matrixWorld).invert(); }
  anim(fn) { this.updaters.push(fn); }

  // ---------------------------------------------------------------- materials
  /** m('woodGrain'), m('paint#c0392b'), m(THREE.Material) */
  m(spec) {
    if (spec && spec.isMaterial) return spec;
    if (this.mats.has(spec)) return this.mats.get(spec);
    const [name, col] = spec.split('#'); const def = MATS[name]; if (!def) throw new Error('life kit: unknown material ' + spec);
    const mat = this._make(name, def, col ? '#' + col : null); this.mats.set(spec, mat); return mat;
  }
  /** register a custom material under a key */
  defMat(key, def, col) { const mat = this._make(key, def, col); this.mats.set(key, mat); return mat; }
  _make(name, def, col) {
    let mat;
    if (def.glow) {
      mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: true });
      mat.color.set(col || def.color).multiplyScalar(def.intensity || 1);
      mat.userData.noShadow = true;
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: col || def.color, roughness: def.rough ?? 0.7, metalness: def.metal ?? 0, vertexColors: true,
        side: def.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (def.map) mat.map = typeof def.map === 'string' ? tex(def.map, def.size || 512) : def.map;
      if (def.nrm) { mat.normalMap = normal(def.nrm, def.size || 512, def.nrmStrength || 3); mat.normalScale.set(def.nrmS ?? 1, def.nrmS ?? 1); }
      if (def.env) { mat.envMap = envTex(def.envKind || this.envKind); mat.envMapIntensity = def.env; }
      if (def.transparent) { mat.transparent = true; mat.opacity = def.opacity ?? 0.5; mat.depthWrite = false; }
      if (def.alphaTest) mat.alphaTest = def.alphaTest;
      if (def.selfLit && mat.map) { mat.emissive.set(0xffffff); mat.emissiveMap = mat.map; mat.emissiveIntensity = def.selfLit; }
      if (def.emissive) { mat.emissive.set(def.emissive); mat.emissiveIntensity = def.emissiveIntensity ?? 1; }
      this._patchAmbience(mat);
      if (def.noShadow) mat.userData.noShadow = true;
    }
    mat.name = name; mat.userData.tile = def.tile || 1; mat.userData.uv = def.uv || 'world'; mat.userData.sway = !!def.sway;
    if (def.sway) this._patchSway(mat, def.sway);
    return mat;
  }
  _patchAmbience(mat) {
    const A = this.amb; const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mat, sh, r);
      sh.uniforms.uLifeInv = A.inv; sh.uniforms.uLifeMin = A.bmin; sh.uniforms.uLifeMax = A.bmax; sh.uniforms.uLifeAO = A.ao;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uLifeInv; varying vec3 vLifeP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLifeP = (uLifeInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uLifeMin; uniform vec3 uLifeMax; uniform vec4 uLifeAO; varying vec3 vLifeP;')
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        { vec3 lp = vLifeP; float rg = uLifeAO.w;
          float fl = 1.0 - uLifeAO.x * exp(-max(lp.y - uLifeMin.y, 0.0) / rg);
          float ce = 1.0 - uLifeAO.z * exp(-max(uLifeMax.y - lp.y, 0.0) / rg);
          float dw = min(min(lp.x - uLifeMin.x, uLifeMax.x - lp.x), min(lp.z - uLifeMin.z, uLifeMax.z - lp.z));
          float wa = 1.0 - uLifeAO.y * exp(-max(dw, 0.0) / rg);
          float lao = fl * ce * wa;
          reflectedLight.indirectDiffuse *= lao; reflectedLight.indirectSpecular *= mix(1.0, lao, 0.8); reflectedLight.directDiffuse *= mix(1.0, lao, 0.4); }`);
    };
    mat.customProgramCacheKey = () => 'lifeAmb';
  }
  _patchSway(mat, amp) {
    const U = this.swayU; const prev = mat.onBeforeCompile; const a = typeof amp === 'number' ? amp : 1;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mat, sh, r);
      sh.uniforms.uSwayT = U;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float sway; uniform float uSwayT;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float ph = position.x * 0.9 + position.z * 0.7 + position.y * 0.3;
          float w = sin(uSwayT * 2.6 + ph * 1.7) * 0.6 + sin(uSwayT * 4.3 + ph * 2.9) * 0.4;
          transformed += normalize(objectNormal) * w * sway * ${(0.16 * a).toFixed(3)};
          transformed.y += sin(uSwayT * 3.1 + ph * 2.1) * sway * 0.03; }`);
    };
    mat.customProgramCacheKey = () => (mat.userData.noAmb ? 'swayB' : 'lifeAmb') + 'sway' + a;
  }

  // ---------------------------------------------------------------- transform stack
  push() { this.stack.push(this.cur.clone(), this.tintC.clone()); return this; }
  pop() { this.tintC = this.stack.pop(); this.cur = this.stack.pop(); return this; }
  /** run fn(K) in a local frame at pos [x,y,z] rotated by yaw (number) or Euler [rx,ry,rz], optional uniform scale */
  at(pos, rot, fn, scale = 1) {
    this.push(); this.cur.multiply(mat4(pos, rot, scale)); fn(this); this.pop(); return this;
  }
  tint(c) { this.tintC.set(c); return this; }
  tinted(c, fn) { this.push(); this.tintC.set(c); fn(this); this.pop(); return this; }

  // ---------------------------------------------------------------- core add
  add(spec, geo, local = null) {
    const mat = this.m(spec); const g = geo;
    if (local) g.applyMatrix4(_m4.copy(this.cur).multiply(local)); else g.applyMatrix4(this.cur);
    if (!g.attributes.normal) g.computeVertexNormals();
    { const pa = g.attributes.position.array; let bad = false; for (let i = 0; i < pa.length; i++) if (pa[i] !== pa[i]) { bad = true; break; }
      if (bad) { if ((Kit._nanWarn = (Kit._nanWarn || 0) + 1) <= 6) console.warn('life kit: NaN geometry skipped (' + g.type + ', mat ' + mat.name + ') cur=' + this.cur.elements.slice(0,16).map((v)=>v.toFixed(2)).join(',') + ' params=' + JSON.stringify(g.parameters) + '\n' + new Error().stack.split('\n').slice(2, 6).join('\n')); return this; } }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (mat.userData.uv !== 'own') boxProject(g, mat.userData.tile);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3); _c.copy(this.tintC); for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (mat.userData.sway && !g.attributes.sway) g.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(n), 1));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'sway'].includes(k)) g.deleteAttribute(k);
    if (!g.index) { const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    let b = this.buckets.get(mat.uuid); if (!b) { b = { mat, list: [] }; this.buckets.set(mat.uuid, b); }
    b.list.push(g); this.tris += g.index.count / 3;
    return this;
  }

  // ---------------------------------------------------------------- primitives (all positions in current local frame, metres)
  /** box standing on y (base-anchored), centred in x/z, optional yaw / euler rot */
  box(mat, w, h, d, x = 0, y = 0, z = 0, rot = 0) { return this.add(mat, UNIT_BOX(), mat4([x, y + h / 2, z], rot, 1, [w, h, d])); }
  /** box centred at (x,y,z) */
  boxC(mat, w, h, d, x = 0, y = 0, z = 0, rot = 0) { return this.add(mat, UNIT_BOX(), mat4([x, y, z], rot, 1, [w, h, d])); }
  /** axis-aligned slab from min corner to max corner */
  slab(mat, x0, y0, z0, x1, y1, z1) { return this.add(mat, UNIT_BOX(), mat4([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], 0, 1, [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)])); }
  /** rounded box, base-anchored */
  rbox(mat, w, h, d, r = 0.02, x = 0, y = 0, z = 0, rot = 0, segs = 2) { return this.add(mat, roundedBoxGeo(w, h, d, r, segs), mat4([x, y + h / 2, z], rot)); }
  /** cylinder: vertical base-anchored by default. o:{rt (top radius), seg, axis:'x'|'z' (lies horizontally, centred), rot, open, s:[sx,sz]} */
  cyl(mat, r, h, x = 0, y = 0, z = 0, o = {}) {
    if (r !== r || h !== h || x !== x || y !== y || z !== z) console.warn('cyl NaN args', r, h, x, y, z, JSON.stringify(o));
    const g = new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || seg(16, 6), 1, !!o.open, o.thStart || 0, o.thLen || Math.PI * 2);
    let m;
    if (o.axis === 'x') m = mat4([x, y, z], [0, 0, Math.PI / 2]); else if (o.axis === 'z') m = mat4([x, y, z], [Math.PI / 2, 0, 0]);
    else m = mat4([x, y + h / 2, z], o.rot || 0, 1, o.s ? [o.s[0], 1, o.s[1]] : null);
    return this.add(mat, g, m);
  }
  /** sphere/ellipsoid centred */
  sph(mat, r, x = 0, y = 0, z = 0, o = {}) { const g = new THREE.SphereGeometry(r, o.seg || seg(14, 6), o.segH || seg(10, 4), o.ph0 || 0, o.phL || Math.PI * 2, o.th0 || 0, o.thL || Math.PI); return this.add(mat, g, mat4([x, y, z], o.rot || 0, 1, o.s ? (Array.isArray(o.s) ? o.s : [o.s, o.s, o.s]) : null)); }
  /** lathe from [[r,y],...] profile; base at y */
  lathe(mat, profile, x = 0, y = 0, z = 0, o = {}) { const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), o.seg || seg(16, 6)); g.computeVertexNormals(); return this.add(mat, g, mat4([x, y, z], o.rot || 0, o.s || 1)); }
  /** flat plane centred, facing +Z by default; rot yaw or euler */
  plane(mat, w, h, x = 0, y = 0, z = 0, rot = 0, o = {}) { const g = new THREE.PlaneGeometry(w, h, o.ws || 1, o.hs || 1); return this.add(mat, g, mat4([x, y, z], rot)); }
  /** torus ring (e.g. rings, tyres): axis along local Z by default; rot to orient */
  torus(mat, R, r, x = 0, y = 0, z = 0, rot = 0, o = {}) { return this.add(mat, new THREE.TorusGeometry(R, r, o.seg || seg(8, 4), o.segR || seg(24, 8), o.arc || Math.PI * 2), mat4([x, y, z], rot)); }
  /** tube along points [[x,y,z],...] */
  tube(mat, pts, r = 0.02, o = {}) {
    const P = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])); const curve = new THREE.CatmullRomCurve3(P, !!o.closed, 'catmullrom', o.tension ?? 0.4);
    return this.add(mat, new THREE.TubeGeometry(curve, o.segs || Math.max(2, P.length * (o.smooth === false ? 1 : 6)), r, o.radial || seg(6, 4), !!o.closed));
  }
  /** extrude a 2D polygon [[x,y],...] in the XY plane; depth along Z (centred) */
  extr(mat, poly, depth = 0.05, x = 0, y = 0, z = 0, rot = 0, o = {}) {
    const sh = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: !!o.bevel, bevelThickness: o.bevel || 0, bevelSize: o.bevel || 0, bevelSegments: 1, curveSegments: o.curve || 6 }); g.translate(0, 0, -depth / 2);
    return this.add(mat, g, mat4([x, y, z], rot));
  }
  /** arbitrary geometry (consumed) */
  geo(mat, g, x = 0, y = 0, z = 0, rot = 0, scale = 1) { return this.add(mat, g, mat4([x, y, z], rot, scale)); }
  /** swaying cloth plane, pinned along its left edge; sway weight grows along +x. w,h centred at x,y,z facing +Z */
  cloth(mat, w, h, x, y, z, rot = 0, o = {}) {
    const ws = o.ws || 8, hs = o.hs || 3; const g = new THREE.PlaneGeometry(w, h, ws, hs); const n = g.attributes.position.count; const sw = new Float32Array(n);
    for (let i = 0; i < n; i++) { const u = g.attributes.position.getX(i) / w + 0.5; const v = g.attributes.position.getY(i) / h + 0.5; sw[i] = o.pin === 'top' ? (1 - v) : o.pin === 'bottom' ? v : o.pin === 'none' ? 1 : u; }
    g.setAttribute('sway', new THREE.BufferAttribute(sw, 1)); if (o.rect) uvRect(g, o.rect); return this.add(mat, g, mat4([x, y, z], rot));
  }
  /** an arbitrary prebuilt Object3D (animated parts, screens, signs): the current matrix is applied. */
  mesh(obj) { obj.applyMatrix4(this.cur); this.root.add(obj); return obj; }

  // ---------------------------------------------------------------- finish
  build({ cast = this.castShadow, receive = this.receiveShadow } = {}) {
    const meshes = [];
    for (const { mat, list } of this.buckets.values()) {
      if (!list.length) continue;
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false); if (!g) continue;
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, mat); mesh.name = 'life_' + mat.name;
      const ns = mat.userData.noShadow; mesh.castShadow = cast && !ns; mesh.receiveShadow = receive && !ns && !mat.isMeshBasicMaterial;
      if (mat.transparent) mesh.renderOrder = 2;
      this.root.add(mesh); meshes.push(mesh);
      if (list.length > 1) for (const l of list) l.dispose();
    }
    this.buckets.clear(); return meshes;
  }
}

// ------------------------------------------------------------------ helpers
export function mat4(pos = ZERO, rot = 0, scale = 1, size = null) {
  const p = Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z];
  if (typeof rot === 'number') _e.set(0, rot, 0); else if (Array.isArray(rot)) _e.set(rot[0], rot[1], rot[2], 'YXZ'); else _e.set(0, 0, 0);
  _q.setFromEuler(_e);
  if (size) _s.set(size[0] * (Array.isArray(scale) ? scale[0] : scale), size[1] * (Array.isArray(scale) ? scale[1] : scale), size[2] * (Array.isArray(scale) ? scale[2] : scale));
  else if (Array.isArray(scale)) _s.set(scale[0], scale[1], scale[2]); else _s.set(scale, scale, scale);
  return new THREE.Matrix4().compose(_v.set(p[0], p[1], p[2]), _q, _s);
}
let _unit = null;
function UNIT_BOX() { if (!_unit) _unit = new THREE.BoxGeometry(1, 1, 1); return _unit.clone(); }
const _rbCache = new Map(); const _dir = new THREE.Vector3();
function roundedBoxGeo(w, h, d, r, segs) {
  // build a unit-ish rounded box via scaled sphere-cube; cache by rounded dims
  const key = [w, h, d, r, segs].map((v) => v.toFixed(3)).join('|');
  if (!_rbCache.has(key)) {
    const g = new THREE.BoxGeometry(w, h, d, segs * 2, segs * 2, segs * 2); const p = g.attributes.position; const v = new THREE.Vector3(); const c = new THREE.Vector3();
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r; const nrm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); nrm.setXYZ(i, nrm.getX(i), nrm.getY(i), nrm.getZ(i)); c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz)); const dir = _dir.copy(v).sub(c); if (dir.lengthSq() > 1e-12) { dir.normalize(); nrm.setXYZ(i, dir.x, dir.y, dir.z); dir.multiplyScalar(r); v.copy(c).add(dir); } else v.copy(c); p.setXYZ(i, v.x, v.y, v.z); }
    _rbCache.set(key, g);
  }
  return _rbCache.get(key).clone();
}
/** box-projected UVs in metres/tile from (already transformed) positions + normals */
export function boxProject(g, tile = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; const k = 1 / tile;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i)); const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ny >= nx && ny >= nz) uv.setXY(i, x * k, z * k); else if (nx >= nz) uv.setXY(i, z * k, y * k); else uv.setXY(i, x * k, y * k);
  }
  uv.needsUpdate = true;
}
/** remap a geometry's uv (0..1) into an atlas cell rect [u0,v0,u1,v1] */
export function uvRect(g, r) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1])); return g; }
/** all vertices to one uv point (solid colour sample) */
export function uvPoint(g, u, v) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v); return g; }
/** cylindrical UVs (u around, v by y between y0..y1) into an atlas rect */
export function uvCyl(g, r, y0, y1, ax = 'y') {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + 0.5; const v = (p.getY(i) - y0) / (y1 - y0); uv.setXY(i, r[0] + a * (r[2] - r[0]), r[1] + THREE.MathUtils.clamp(v, 0, 1) * (r[3] - r[1])); }
  return g;
}

/** atlas of canvas cells. drawCell(ctx, i, cw, ch). returns {tex, cell(i)->[u0,v0,u1,v1], canvas} */
export function atlas(cols, rows, cw, ch, drawCell, { srgb = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch; const ctx = c.getContext('2d');
  for (let i = 0; i < cols * rows; i++) { const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch; ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip(); ctx.translate(cx, cy); drawCell(ctx, i, cw, ch); ctx.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  const pad = 0.5 / Math.max(c.width, c.height);
  return { tex: t, canvas: c, cols, rows, cell(i, inset = 0) { const col = i % cols, row = Math.floor(i / cols); const e = inset * pad * 4; return [col / cols + pad + e, 1 - (row + 1) / rows + pad + e, (col + 1) / cols - pad - e, 1 - row / rows - pad - e]; } };
}
/** canvas texture from a draw function (non-shared; freed on dispose) */
export function canvasTexture(w, h, draw, { srgb = true, aniso = 4, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t;
}
/** Emissive "sign" mesh (own texture): neon / lightbox / printed poster. opts {w,h,res,emissive=1.2, lit=true, rough} returns Mesh facing +Z centred. */
export function signMesh(w, h, draw, { px = 256, emissive = 1.0, lit = false, rough = 0.6, side = THREE.FrontSide, bg = null } = {}) {
  const tw = Math.round(Math.min(2048, Math.max(32, w * px))), th = Math.round(Math.min(2048, Math.max(32, h * px)));
  const t = canvasTexture(tw, th, (ctx, W, H) => { if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); } draw(ctx, W, H); });
  const mat = lit
    ? new THREE.MeshStandardMaterial({ color: 0x000000, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: emissive, roughness: 0.5, side, transparent: !bg, alphaTest: bg ? 0 : 0.02 })
    : new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: 0, side, transparent: !bg, alphaTest: bg ? 0 : 0.03 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.userData.sign = true; return m;
}
/** a lit screen. returns {mesh, screen:{mesh,setTexture,setCanvas,canvas,ctx,redraw}} */
export function makeScreen(w, h, { res: R = [512, 288], draw = null, bright = 1.25, frame = true, bezel = 0.012 } = {}) {
  const c = document.createElement('canvas'); c.width = R[0]; c.height = R[1]; const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: bright, roughness: 0.25, metalness: 0.0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); mesh.name = 'screen';
  const grp = new THREE.Group(); grp.add(mesh); mesh.position.z = 0.0015;
  if (frame) { const f = new THREE.Mesh(new THREE.BoxGeometry(w + bezel * 2, h + bezel * 2, 0.025), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.4, metalness: 0.5 })); f.position.z = -0.0125; grp.add(f); }
  const screen = {
    mesh, canvas: c, ctx, tex: t,
    setTexture(tx) { mat.emissiveMap = tx || t; mat.needsUpdate = true; },
    setCanvas(fn) { fn(ctx, c.width, c.height); t.needsUpdate = true; mat.emissiveMap = t; },
    redraw() { if (draw) draw(ctx, c.width, c.height, 0); t.needsUpdate = true; },
    setBrightness(b) { mat.emissiveIntensity = b; },
  };
  if (draw) { draw(ctx, c.width, c.height, 0); t.needsUpdate = true; }
  grp.userData.screen = screen; return { mesh: grp, screen };
}
export { seg, res, GLOBAL, THREE, RNG, disposeTree };
