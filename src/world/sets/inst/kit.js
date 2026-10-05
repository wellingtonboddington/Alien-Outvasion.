// Set-building kit: material presets, merged static geometry batches, matrix stack, screens/feeds, sign atlas, light shafts.
// Everything static is merged per material -> a whole set is ~20-40 draw calls.
import * as THREE from 'three';
import { Q, RNG, disposeTree, seg, clamp } from '../../../engine/common.js';
import { makeCanvas, texFromCanvas } from '../../../engine/proc.js';
import { infectable, setInfection as setInfTree } from '../../../engine/infect.js';
import { roundedBox } from '../../../engine/geo.js';
import { texSet, radialTex, shaftTex, blobShadowTex, sstep } from './tex.js';

const C = (h) => new THREE.Color(h);

// ---------- material presets ----------
// tile = metres per texture repeat (box-projected uvs). tex = painter name in tex.js
const PRESET = {
  concrete: { tex: 'concrete', tile: 3 },
  concreteDark: { tex: 'concrete', color: 0x7c7e84, tile: 3 },
  concreteWarm: { tex: 'concrete', color: 0xcfc6b8, tile: 3 },
  concreteRough: { tex: 'concreteRough', tile: 5 },
  wood: { tex: 'wood', tile: 2, roughness: 1, rotUV: true },
  woodDark: { tex: 'wood', color: 0xb8a490, tile: 2 },
  woodLight: { tex: 'woodLight', tile: 2 },
  marbleGreen: { tex: 'marbleGreen', tile: 4 },
  marbleWhite: { tex: 'marbleWhite', tile: 3 },
  carpetBlue: { tex: 'carpet', color: 0x6a86c8, tile: 2.5 },
  carpetNavy: { tex: 'carpet', color: 0x3a4a80, tile: 2.5 },
  carpetGrey: { tex: 'carpet', color: 0xa6a8b0, tile: 2.5 },
  carpetRed: { tex: 'carpet', color: 0xb04a52, tile: 2.5 },
  domeWhite: { tex: 'paint', color: 0xe8eaee, tile: 2.5, metalness: 0.0, side: THREE.DoubleSide },
  gunmetal: { tex: 'metalPanel', color: 0xb4bcc8, tile: 2, metalness: 0.8 },
  steel: { tex: 'brushed', color: 0xd4d8de, tile: 1.5, metalness: 0.92 },
  steelDark: { tex: 'brushed', color: 0x70747c, tile: 1.5, metalness: 0.85 },
  chrome: { color: 0xe6eaf0, metalness: 1, roughness: 0.12, noTex: true },
  gold: { color: 0xe0ac3c, metalness: 1, roughness: 0.28, noTex: true },
  brass: { color: 0xb08a40, metalness: 0.9, roughness: 0.38, noTex: true },
  blackPlastic: { color: 0x15161a, roughness: 0.38, noTex: true },
  blackMatte: { color: 0x0c0d10, roughness: 0.85, noTex: true },
  whitePlastic: { color: 0xe9ebef, roughness: 0.26, noTex: true },
  greyPlastic: { color: 0x8a8e96, roughness: 0.5, noTex: true },
  paintWhite: { tex: 'paint', color: 0xe4e4e0, tile: 3 },
  paintCream: { tex: 'paint', color: 0xd8cfb8, tile: 3 },
  paintGrey: { tex: 'paint', color: 0x9aa0a8, tile: 3 },
  paintDark: { tex: 'paint', color: 0x3a3e46, tile: 3 },
  paintBlue: { tex: 'paint', color: 0x2c4a7c, tile: 3 },
  paintRed: { tex: 'paint', color: 0xa02a26, tile: 3 },
  paintYellow: { tex: 'paint', color: 0xd8b020, tile: 3 },
  paintOlive: { tex: 'paint', color: 0x5a6240, tile: 3 },
  paintGreen: { tex: 'paint', color: 0x3c6a4a, tile: 3 },
  rubber: { tex: 'rubber', tile: 1 },
  leather: { tex: 'leather', color: 0x4a4440, tile: 0.7 },
  leatherBrown: { tex: 'leather', color: 0xa86a40, tile: 0.7 },
  leatherWhite: { tex: 'leather', color: 0xe8e2d8, tile: 0.7 },
  fabricBlue: { tex: 'weave', color: 0x3a5a98, tile: 0.5 },
  fabricGrey: { tex: 'weave', color: 0x6a6e76, tile: 0.5 },
  fabricDark: { tex: 'weave', color: 0x2a2c32, tile: 0.5 },
  fabricRed: { tex: 'weave', color: 0x982a30, tile: 0.5 },
  fabricOlive: { tex: 'olive', color: 0xffffff, tile: 1.2 },
  canvas: { tex: 'olive', color: 0xd6dcc0, tile: 1.4, side: THREE.DoubleSide },
  camo: { tex: 'camo', tile: 2.5, side: THREE.DoubleSide },
  tileWhite: { tex: 'tile', tile: 2 },
  epoxy: { tex: 'epoxy', tile: 3 },
  epoxyGreen: { tex: 'epoxy', color: 0xb0d8c0, tile: 3 },
  ceilingTile: { tex: 'ceilingTile', tile: 1.2 },
  perf: { tex: 'perf', color: 0xffffff, tile: 1, metalness: 0.55 },
  dirt: { tex: 'dirt', tile: 6 },
  hazard: { tex: 'hazard', tile: 1.5 },
  floorBlack: { tex: 'floorBlack', tile: 4 },
  sandbag: { tex: 'sandbag', tile: 1.2 },
  rust: { tex: 'rust', tile: 2, metalness: 0.5 },
  floorMirror: { tex: 'floorBlack', tile: 4, transparent: true, opacity: 0.84, depthWrite: true, order: 2, ao: false },
  glossBlack: { color: 0x07080b, roughness: 0.07, metalness: 0.25, noTex: true },
  glass: { color: 0xb8e0ee, roughness: 0.04, metalness: 0, opacity: 0.16, transparent: true, depthWrite: false, side: THREE.DoubleSide, noTex: true, ao: false, envMapIntensity: 1.6, order: 3 },
  glassTint: { color: 0x6a8c98, roughness: 0.05, metalness: 0, opacity: 0.32, transparent: true, depthWrite: false, side: THREE.DoubleSide, noTex: true, ao: false, envMapIntensity: 1.6, order: 3 },
  frosted: { color: 0xeaf4f8, roughness: 0.6, metalness: 0, opacity: 0.55, transparent: true, depthWrite: false, side: THREE.DoubleSide, noTex: true, ao: false, order: 3 },
};
const NOAO = new Set(['screenBlack']);

// ---------- batch of merged geometry ----------
class Batch {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.g = []; this.i = []; this.nv = 0; }
  add(geo, M, o) {
    const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, cnt = pa.count, e = M.elements;
    const col = o.color, uvBox = o.uv === 'box', tile = o.tile || 1, glow = o.glow ?? 1; const uvm = geo.userData.uvMetres ? 1 / tile : 1, us = (o.us ?? 1) * uvm, vs = (o.vs ?? 1) * uvm;
    const det = M.determinant(), flip = det < 0; const nm = _n3.getNormalMatrix(M).elements;
    const cr = col ? col.r : 1, cg = col ? col.g : 1, cb = col ? col.b : 1;
    const base = this.nv; const ca = geo.attributes.color, ga = geo.attributes.aGlow;
    for (let i = 0; i < cnt; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx0 = na.getX(i), ny0 = na.getY(i), nz0 = na.getZ(i);
      let nx = nm[0] * nx0 + nm[3] * ny0 + nm[6] * nz0, ny = nm[1] * nx0 + nm[4] * ny0 + nm[7] * nz0, nz = nm[2] * nx0 + nm[5] * ny0 + nm[8] * nz0;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (flip) { nx = -nx; ny = -ny; nz = -nz; }
      this.p.push(wx, wy, wz); this.n.push(nx, ny, nz);
      if (uvBox) {
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay >= ax && ay >= az) this.u.push(wx / tile * us, wz / tile * vs);
        else if (ax >= az) this.u.push(wz / tile * us, wy / tile * vs);
        else this.u.push(wx / tile * us, wy / tile * vs);
      } else if (ua) this.u.push(ua.getX(i) * us, ua.getY(i) * vs); else this.u.push(0, 0);
      if (ca) this.c.push(cr * ca.getX(i), cg * ca.getY(i), cb * ca.getZ(i)); else this.c.push(cr, cg, cb);
      this.g.push(ga ? ga.getX(i) * glow : glow);
    }
    const idx = geo.index;
    const ic = idx ? idx.count : cnt;
    for (let k = 0; k < ic; k += 3) {
      const a = idx ? idx.getX(k) : k, b = idx ? idx.getX(k + 1) : k + 1, c = idx ? idx.getX(k + 2) : k + 2;
      if (flip) this.i.push(base + a, base + c, base + b); else this.i.push(base + a, base + b, base + c);
    }
    this.nv += cnt;
  }
  build(aoFn) {
    const g = new THREE.BufferGeometry();
    const col = this.c;
    if (aoFn) for (let i = 0; i < this.nv; i++) {
      const f = aoFn(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2], this.n[i * 3], this.n[i * 3 + 1], this.n[i * 3 + 2]);
      col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.g, 1));
    g.setIndex(this.nv > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

class Atlas {
  constructor(size, name) { this.size = size; this.name = name; this.c = makeCanvas(size, size); this.ctx = this.c.getContext('2d'); this.x = 1; this.y = 1; this.rowH = 0; this.tex = null; }
  alloc(pw, ph) {
    if (this.x + pw + 1 > this.size) { this.x = 1; this.y += this.rowH + 2; this.rowH = 0; }
    if (this.y + ph + 1 > this.size) return null;
    const r = { x: this.x, y: this.y, pw, ph }; this.x += pw + 2; this.rowH = Math.max(this.rowH, ph); return r;
  }
  texture() { if (!this.tex) this.tex = texFromCanvas(this.c, { srgb: true, aniso: 4, wrap: 'clamp' }); else this.tex.needsUpdate = true; return this.tex; }
}

// ---------- screens ----------
function curvedPlane(w, h, R, wseg = 32) {
  const g = new THREE.PlaneGeometry(w, h, wseg, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); const a = x / R; p.setX(i, Math.sin(a) * R); p.setZ(i, R - Math.cos(a) * R); }
  g.computeVertexNormals(); return g;
}

export class Screen {
  constructor(kit, o) {
    this.kit = kit; this.name = o.name; this.w = o.w; this.h = o.h; this.fps = o.fps || 10; this.draw = o.draw || null; this.frame = -999; this.external = false; this.brightness = o.k ?? 1.15;
    this.state = o.state || kit.state;
    this.feed = o.feed || null;
    let tex;
    if (this.feed) { tex = this.feed.tex; this.canvas = this.feed.canvas; this.ctx = this.feed.ctx; this.pw = this.canvas.width; this.ph = this.canvas.height; }
    else { this._own(o.res); tex = this.tex; }
    let mat;
    if (o.additive) { mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(this.brightness, this.brightness, this.brightness), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }); this.mapKey = 'map'; }
    else { mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: this.brightness, roughness: o.rough ?? 0.7, metalness: 0 }); this.mapKey = 'emissiveMap'; if (kit.infectScreens) infectable(mat); }
    if (o.additive) mat.userData.order = 6;
    const geo = o.circle ? new THREE.CircleGeometry(o.w / 2, 64) : o.curve ? curvedPlane(o.w, o.h, o.curve, o.curveSegs || 48) : new THREE.PlaneGeometry(o.w, o.h);
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.name = 'screen:' + o.name; this.mesh.userData.screen = this; if (o.additive) this.mesh.renderOrder = 6;
    this.mesh.matrixAutoUpdate = true;
    this.defaultTex = tex;
  }
  _own(res) {
    const pw = res ? res[0] : Math.min(1024, Math.max(128, Math.round(this.w * 160 / 16) * 16)); const ph = res ? res[1] : Math.max(64, Math.round(pw * this.h / this.w / 8) * 8);
    const rs = Q.level === 0 ? 0.5 : 1;
    this.canvas = makeCanvas(Math.max(64, Math.round(pw * rs)), Math.max(48, Math.round(ph * rs))); this.ctx = this.canvas.getContext('2d'); this.pw = this.canvas.width; this.ph = this.canvas.height;
    this.tex = texFromCanvas(this.canvas, { srgb: true, aniso: 4, wrap: 'clamp', mip: true });
    this.tex.userData.owned = true;
  }
  /** Show any THREE.Texture (CanvasTexture, VideoTexture, render target texture ...) on this screen. Pass null to restore the default content. */
  setTexture(tex) {
    const m = this.mesh.material;
    if (!tex) { this.external = false; m[this.mapKey] = this.tex || this.defaultTex; this.frame = -999; return this; }
    this.external = true; m[this.mapKey] = tex; return this;
  }
  /** Draw live content: drawFn(ctx, w, h, t). Allocates a private canvas if the screen was sharing a default feed. */
  setCanvas(drawFn, { fps = 12, res = null } = {}) {
    if (this.feed || !this.tex) { this.feed = null; this._own(res); }
    this.draw = drawFn; this.fps = fps; this.external = false; this.frame = -999; this.mesh.material[this.mapKey] = this.tex; this.redraw(this.kit.t);
    return this;
  }
  setBrightness(k) { this.brightness = k; const m = this.mesh.material; if (m.emissiveIntensity !== undefined) m.emissiveIntensity = k; else m.color.setScalar(k); return this; }
  redraw(t) { if (this.draw && !this.feed) { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.draw(this.ctx, this.pw, this.ph, t, this.state); this.tex.needsUpdate = true; } }
  tick(t) {
    if (this.external || !this.draw || this.feed) return;
    const f = Math.floor(t * this.fps); if (f === this.frame) return; this.frame = f; this.redraw(t);
  }
}

// ---------- the kit ----------
export class Kit {
  constructor(name, { seed = 1, infectAll = false, infectScreens = true, glowInfect = true, aoFloor = true, ambient = true } = {}) {
    this.name = name; this.rng = new RNG(seed); this.root = new THREE.Group(); this.root.name = name;
    this.M = new THREE.Matrix4(); this.stack = []; this._t1 = new THREE.Matrix4(); this._t2 = new THREE.Matrix4();
    this.batches = new Map(); this.mats = new Map(); this.customMats = new Map(); this.screens = []; this.feeds = []; this.updaters = []; this.lights = []; this.anchors = {};
    this.atlases = []; this.zone = ''; this.state = { threat: 0.4, alert: 0, infect: 0 }; this.t = 0;
    this.infectAll = infectAll; this.infectScreens = infectScreens; this.glowInfect = glowInfect;
    this.dyn = new THREE.Group(); this.dyn.name = 'dynamic'; this.root.add(this.dyn);
    this.aoFn = aoFloor ? (x, y, z, nx, ny, nz) => (0.5 + 0.5 * sstep(0, 0.65, y)) * (ny < -0.6 ? 0.8 : 1) : null;
    this._inf = { infectable }; this.mirrorFloor = false; this.uTime = { value: 0 }; this._finished = false; this._box = null; this._rb = new Map(); this.infection = 0;
  }
  // ----- materials -----
  mat(name) {
    let m = this.mats.get(name); if (m) return m;
    const c = this.customMats.get(name); if (c) { this.mats.set(name, c); return c; }
    const s = PRESET[name]; if (!s) throw new Error('kit: unknown material ' + name);
    const p = { color: C(s.color ?? 0xffffff), roughness: s.roughness ?? 1, metalness: s.metalness ?? 0, vertexColors: true, side: s.side ?? THREE.FrontSide };
    if (s.tex && !s.noTex) { const t = texSet(s.tex); p.map = t.map; p.normalMap = t.normalMap; p.roughnessMap = t.roughnessMap; p.normalScale = new THREE.Vector2(1, 1); }
    if (s.transparent) { p.transparent = true; p.opacity = s.opacity; p.depthWrite = s.depthWrite ?? false; }
    if (s.envMapIntensity) p.envMapIntensity = s.envMapIntensity;
    m = new THREE.MeshStandardMaterial(p); m.userData.spec = s; m.userData.order = s.order || 0;
    if (this.infectAll) infectable(m);
    this.mats.set(name, m); return m;
  }
  /** register a custom material under a name usable in part calls */
  defMat(name, material, opts = {}) { material.userData.spec = { tile: opts.tile || 1, ao: opts.ao ?? false, ...opts }; this.customMats.set(name, material); this.mats.set(name, material); return name; }
  /** emissive material: returns its name. hex colour, k = emissive intensity */
  glow(hex, k = 2) {
    const name = `glow:${hex.toString(16)}:${k}`; if (this.customMats.has(name)) return name;
    const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: C(hex), emissiveIntensity: k, roughness: 0.6, metalness: 0, vertexColors: false });
    if (this.glowInfect || this.infectAll) infectable(m);
    return this.defMat(name, m, { ao: false });
  }
  /** additive fx material (light pools, shafts, halos). kind: 'radial'|'shaft' */
  fx(kind, hex, k = 1) {
    const name = `fx:${kind}:${hex.toString(16)}:${k}`; if (this.customMats.has(name)) return name;
    const map = kind === 'shaft' ? shaftTex() : radialTex();
    const col = C(hex).multiplyScalar(k);
    const m = new THREE.MeshBasicMaterial({ map, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: false, fog: false });
    m.userData.order = 5; m.userData.fxBase = col.clone();
    return this.defMat(name, m, { ao: false });
  }
  _batch(name) {
    const key = this.zone ? name + '@' + this.zone : name; let b = this.batches.get(key);
    if (!b) { b = new Batch(); b.matName = name; this.mat(name); this.batches.set(key, b); } return b;
  }
  // ----- matrix stack -----
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
    this.stack.push(this.M.clone());
    this._t1.compose(_v1.set(x, y, z), _q1.setFromEuler(_e1.set(rx, ry, rz, 'YXZ')), _v2.set(s, s, s)); this.M.multiply(this._t1); return this;
  }
  pop() { this.M = this.stack.pop(); return this; }
  at(x, y, z, ry, fn, rx = 0, rz = 0) { this.push(x, y, z, ry, rx, rz); fn(this); this.pop(); return this; }
  // ----- generic part -----
  _local(pos, o) {
    const sx = o.sx ?? o.scale ?? 1, sy = o.sy ?? o.scale ?? 1, sz = o.sz ?? o.scale ?? 1;
    this._t2.compose(_v1.set(pos[0], pos[1], pos[2]), _q1.setFromEuler(_e1.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), _v2.set(sx, sy, sz));
    return this._t2;
  }
  part(matName, geo, pos = [0, 0, 0], o = {}) {
    const b = this._batch(matName); const spec = this.mats.get(matName).userData.spec || {};
    const L = this._local(pos, o); const M = _m1.multiplyMatrices(this.M, L);
    const po = { color: o.color !== undefined ? (o.color.isColor ? o.color : C(o.color)) : null, glow: o.glow, uv: o.uv || 'native', tile: o.tile ?? spec.tile ?? 1, us: o.us, vs: o.vs };
    b.add(geo, M, po);
    if (this.mirrorFloor && o.mirror !== false && (o.mirror === true || matName.startsWith('glow:') || matName.startsWith('fx:shaft'))) {
      _m2.copy(M); const e = _m2.elements; e[1] = -e[1]; e[5] = -e[5]; e[9] = -e[9]; e[13] = -e[13]; // y -> -y
      b.add(geo, _m2, po);
    }
    return this;
  }
  /** centred box [w,h,d] at pos */
  box(m, size, pos, o = {}) { return this.part(m, _unitBox(), pos, { ...o, sx: size[0] * (o.sx ?? 1), sy: size[1] * (o.sy ?? 1), sz: size[2] * (o.sz ?? 1), uv: o.uv || 'box' }); }
  /** box sitting on y (pos.y = bottom) */
  slab(m, size, pos, o = {}) { return this.box(m, size, [pos[0], pos[1] + size[1] / 2, pos[2]], o); }
  /** cylinder along Y: [rTop, rBottom, h] */
  cyl(m, dims, pos, o = {}) {
    const g = new THREE.CylinderGeometry(dims[0], dims[1], dims[2], o.seg || seg(o.segs || 18, 6), 1, !!o.open, o.thetaStart || 0, o.thetaLength || Math.PI * 2);
    return this.part(m, g, pos, o);
  }
  sph(m, r, pos, o = {}) { return this.part(m, new THREE.SphereGeometry(r, o.seg || seg(16, 6), o.seg ? Math.max(4, o.seg >> 1) : seg(10, 4), 0, Math.PI * 2, o.t0 || 0, o.t1 ?? Math.PI), pos, o); }
  /** plane facing +Z (before rotation) */
  plane(m, w, h, pos, o = {}) { return this.part(m, new THREE.PlaneGeometry(w, h, o.ws || 1, o.hs || 1), pos, o); }
  /** plane lying on floor facing up */
  floorQuad(m, w, d, pos, o = {}) { return this.part(m, new THREE.PlaneGeometry(w, d), pos, { ...o, rx: -Math.PI / 2, uv: o.uv || 'box' }); }
  torus(m, R, r, pos, o = {}) { return this.part(m, new THREE.TorusGeometry(R, r, o.tseg || seg(8, 4), o.seg || seg(28, 8), o.arc || Math.PI * 2), pos, o); }
  rbox(m, size, pos, o = {}) {
    const r = o.r ?? Math.min(size[0], size[1], size[2]) * 0.2; const key = size.join(',') + ',' + r + ',' + (o.s || 2);
    let g = this._rb.get(key); if (!g) { g = roundedBox(size[0], size[1], size[2], r, o.s || 2); this._rb.set(key, g); }
    return this.part(m, g, pos, { ...o, uv: o.uv || 'box' });
  }
  /** lathe from [[r,y],...] about Y at pos */
  lathe(m, profile, pos, o = {}) { return this.part(m, new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), o.seg || seg(o.segs || 24, 6), o.phi0 || 0, o.phiLen || Math.PI * 2), pos, o); }
  /** tube through points (array of [x,y,z]) */
  tubeAlong(m, pts, r, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'catmullrom', o.tension ?? 0.35);
    const g = new THREE.TubeGeometry(curve, o.tsegs || Math.max(4, pts.length * (o.perPoint || 6)), r, o.seg || seg(6, 4), !!o.closed);
    return this.part(m, g, [0, 0, 0], o);
  }
  /** straight rod between two points */
  rod(m, a, b, r, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz); if (len < 1e-5) return this;
    _v3.set(dx, dy, dz).normalize(); _q2.setFromUnitVectors(_up, _v3); const e = _e2.setFromQuaternion(_q2, 'YXZ');
    return this.cyl(m, [r, o.r2 ?? r, len], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], { seg: o.seg || 6, ...o, rx: e.x, ry: e.y, rz: e.z });
  }
  /** wall along ground line (x0,z0)->(x1,z1) with optional openings [{s, w, h, y}] */
  wall(m, p0, p1, h, th = 0.2, o = {}) {
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1], L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, y0 = o.y0 || 0;
    const ops = (o.openings || []).slice().sort((a, b) => a.s - b.s); let s = 0;
    const piece = (s0, s1, yb, yt) => { if (s1 - s0 < 1e-3 || yt - yb < 1e-3) return; const c = (s0 + s1) / 2; this.box(m, [s1 - s0, yt - yb, th], [p0[0] + ux * c, y0 + (yb + yt) / 2, p0[1] + uz * c], { ry, color: o.color, tile: o.tile }); };
    for (const op of ops) { piece(s, op.s, 0, h); const oy = op.y || 0; piece(op.s, op.s + op.w, 0, oy); piece(op.s, op.s + op.w, oy + op.h, h); s = op.s + op.w; }
    piece(s, L, 0, h); return this;
  }
  // ----- atlas signs -----
  /** textured quad from the shared sign atlas. draw(ctx, pw, ph). glow=true uses the emissive atlas. ppm = px per metre */
  sign(w, h, draw, pos, o = {}) {
    const ppm = o.ppm || 160; const pw = Math.max(16, Math.round(w * ppm)), ph = Math.max(16, Math.round(h * ppm));
    const glow = !!o.glow; let at = null, rect = null;
    for (const a of this.atlases) { if (a.glow !== glow) continue; rect = a.alloc(pw, ph); if (rect) { at = a; break; } }
    if (!rect) {
      const size = Q.level === 0 ? 1024 : 2048; at = new Atlas(size, `${glow ? 'neon' : 'sign'}${this.atlases.length}`); at.glow = glow; this.atlases.push(at);
      const mm = new THREE.MeshStandardMaterial(glow ? { color: 0x000000, emissive: 0xffffff, emissiveIntensity: o.k || 1.6, roughness: 0.6, vertexColors: false } : { color: 0xffffff, roughness: 0.65, vertexColors: true });
      if (glow && (this.glowInfect || this.infectAll)) infectable(mm);
      at.matName = this.defMat('atlas:' + at.name, mm, { ao: false }); at.mat = mm; rect = at.alloc(pw, ph);
    }
    const ctx = at.ctx; ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.pw, rect.ph); ctx.clip(); ctx.translate(rect.x, rect.y);
    draw(ctx, rect.pw, rect.ph); ctx.restore();
    const S = at.size, u0 = rect.x / S, u1 = (rect.x + rect.pw) / S, v1 = 1 - rect.y / S, v0 = 1 - (rect.y + rect.ph) / S;
    const g = new THREE.PlaneGeometry(w, h, o.ws || 1, o.hs || 1); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    if (o.deform) o.deform(g);
    return this.part(at.matName, g, pos, { ...o, uv: 'native' });
  }
  // ----- screens -----
  /** create a screen. o: {name,w,h,draw,fps,res,curve,bezel,k,feed} ; positioned in the current matrix frame at pos with ry/rx/rz */
  screen(o, pos = [0, 0, 0], r = {}) {
    const s = new Screen(this, o);
    this.push(pos[0], pos[1], pos[2], r.ry || 0, r.rx || 0, r.rz || 0);
    if (o.bezel) {
      const b = o.bezel, t = o.bezelDepth ?? 0.05;
      if (o.curve) { /* curved bezel: top & bottom bars only */ this.box(o.bezelMat || 'blackPlastic', [o.w + b * 2, b, t], [0, o.h / 2 + b / 2, -t / 2 + 0.01], { uv: 'native' }); this.box(o.bezelMat || 'blackPlastic', [o.w + b * 2, b, t], [0, -o.h / 2 - b / 2, -t / 2 + 0.01]); }
      else this.box(o.bezelMat || 'blackPlastic', [o.w + b * 2, o.h + b * 2, t], [0, 0, -t / 2 - 0.002]);
    }
    s.mesh.matrixAutoUpdate = true; this.M.decompose(s.mesh.position, s.mesh.quaternion, s.mesh.scale); this.root.add(s.mesh);
    if (this.mirrorFloor && o.mirror !== false) { const mir = new THREE.Mesh(s.mesh.geometry, s.mesh.material); mir.position.copy(s.mesh.position); mir.position.y *= -1; mir.quaternion.copy(s.mesh.quaternion); mir.scale.copy(s.mesh.scale); mir.scale.y *= -1; mir.name = 'mirror:' + o.name; mir.userData.mirror = true; this.root.add(mir); s.mirror = mir; }
    this.pop();
    s.redraw(0); this.screens.push(s); return s;
  }
  /** merged ambient monitor face using a shared feed (cheap: one draw call per feed). Not individually addressable. */
  ambient(feed, w, h, pos, o = {}) {
    const name = 'feed:' + feed.name;
    if (!this.customMats.has(name)) { const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: feed.tex, emissiveIntensity: o.k ?? 1.0, roughness: 0.7, metalness: 0, vertexColors: false }); if (this.infectScreens) infectable(m); this.defMat(name, m, { ao: false }); }
    return this.part(name, new THREE.PlaneGeometry(w, h), pos, o);
  }
  /** shared default feed canvas (drawn once per frame-tick, shown on any number of monitors) */
  feed(name, draw, { res = [256, 144], fps = 8 } = {}) {
    let f = this.feeds.find((x) => x.name === name); if (f) return f;
    const rs = Q.level === 0 ? 0.5 : 1; const canvas = makeCanvas(Math.round(res[0] * rs), Math.round(res[1] * rs)); const tex = texFromCanvas(canvas, { srgb: true, aniso: 2, wrap: 'clamp', mip: true });
    f = { name, canvas, ctx: canvas.getContext('2d'), tex, draw, fps, frame: -999 }; this.feeds.push(f); this._drawFeed(f, 0); return f;
  }
  _drawFeed(f, t) { f.ctx.setTransform(1, 0, 0, 1, 0, 0); f.draw(f.ctx, f.canvas.width, f.canvas.height, t, this.state); f.tex.needsUpdate = true; }
  // ----- lights & fx -----
  light(l, name) { if (name) l.name = name; this.root.add(l); this.lights.push(l); return l; }
  /** additive light pool on the floor / wall */
  pool(x, z, r, hex = 0xffffff, k = 0.6, y = 0.012) { return this.part(this.fx('radial', hex, k), new THREE.PlaneGeometry(r * 2, r * 2), [x, y, z], { rx: -Math.PI / 2 }); }
  /** soft contact blob (dark) under furniture */
  blob(x, z, w, d, y = 0.008, a = 1) {
    if (!this.customMats.has('blob')) { const m = new THREE.MeshBasicMaterial({ map: blobShadowTex(), color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, vertexColors: false }); m.userData.order = 1; this.defMat('blob', m, { ao: false }); }
    return this.part('blob', new THREE.PlaneGeometry(w, d), [x, y, z], { rx: -Math.PI / 2, glow: a });
  }
  /** light shaft from a->b : r0 at source (bright end), r1 at target */
  shaft(a, b, r0, r1, hex = 0xffffff, k = 0.5) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz); _v3.set(dx, dy, dz).normalize(); _q2.setFromUnitVectors(_up, _v3); const e = _e2.setFromQuaternion(_q2, 'YXZ');
    const g = new THREE.CylinderGeometry(r1, r0, len, 16, 1, true);
    return this.part(this.fx('shaft', hex, k), g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], { rx: e.x, ry: e.y, rz: e.z });
  }
  // ----- dynamic objects (not merged) -----
  addDyn(obj, pos) { if (pos) obj.position.set(pos[0], pos[1], pos[2]); this.M.decompose(_v1, _q1, _v2); const hold = new THREE.Group(); hold.position.copy(_v1); hold.quaternion.copy(_q1); hold.scale.copy(_v2); hold.add(obj); this.dyn.add(hold); return obj; }
  /** build a small separate kit (for dynamic sub-assemblies) */
  sub(name) { return new Kit(name, { aoFloor: false, infectScreens: this.infectScreens, glowInfect: this.glowInfect, infectAll: this.infectAll }); }
  /** attach a finished sub-kit as a dynamic group at pos/ry in the current frame; returns the group (animate it freely) */
  attach(sub, pos = [0, 0, 0], o = {}) {
    sub.finish(); const g = new THREE.Group(); g.add(sub.root); g.name = 'dyn:' + sub.name;
    this._t2.compose(_v1.set(pos[0], pos[1], pos[2]), _q1.setFromEuler(_e1.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), _v2.set(o.scale ?? 1, o.scale ?? 1, o.scale ?? 1));
    _m1.multiplyMatrices(this.M, this._t2); _m1.decompose(g.position, g.quaternion, g.scale); this.dyn.add(g); return g;
  }
  onUpdate(fn) { this.updaters.push(fn); return this; }
  anchor(name, pos, yaw = 0) { this.anchors[name] = { pos: [pos[0], pos[1], pos[2]], yaw }; return this; }
  // ----- finish -----
  finish() {
    if (this._finished) return this; this._finished = true;
    for (const [key, b] of this.batches) {
      if (!b.nv) continue; const m = this.mats.get(b.matName); const spec = m.userData.spec || {};
      const ao = spec.ao === false || NOAO.has(b.matName) ? null : this.aoFn;
      const mesh = new THREE.Mesh(b.build(ao), m); mesh.name = key; mesh.renderOrder = m.userData.order || 0; this.root.add(mesh); mesh.userData.static = true;
      if (m.transparent) mesh.castShadow = false;
    }
    for (const a of this.atlases) { a.mat.map = a.glow ? null : a.texture(); if (a.glow) a.mat.emissiveMap = a.texture(); a.mat.needsUpdate = true; }
    this.batches.clear(); this.root.updateMatrixWorld(true);
    this._box = new THREE.Box3().setFromObject(this.root); return this;
  }
  update(dt, t) {
    this.t = t; this.uTime.value = t;
    for (const f of this.feeds) { const fr = Math.floor(t * f.fps); if (fr !== f.frame) { f.frame = fr; this._drawFeed(f, t); } }
    for (const s of this.screens) s.tick(t);
    for (const u of this.updaters) u(dt, t);
  }
  setInfection(a) { this.infection = a; this.state.infect = a; setInfTree(this.root, a); }
  dispose() { disposeTree(this.root); for (const f of this.feeds) f.tex.dispose(); for (const a of this.atlases) a.tex && a.tex.dispose(); }
  /** standard return object */
  api(extra = {}) {
    this.finish();
    const size = this._box.getSize(new THREE.Vector3());
    const byName = (n) => this.screens.find((s) => s.name === n) || null;
    const out = { root: this.root, update: (dt, t) => this.update(dt, t), dispose: () => this.dispose(), bounds: { w: size.x, d: size.z, h: size.y }, anchors: this.anchors, screens: this.screens, getScreen: byName, lights: this.lights, setInfection: (a) => this.setInfection(a), state: this.state, kit: this };
    return Object.assign(out, extra);
  }
}
const _n3 = new THREE.Matrix3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e1 = new THREE.Euler(), _e2 = new THREE.Euler(), _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
let _ub = null; const _unitBox = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));
export const createKit = (name, opts) => new Kit(name, opts);
export { THREE, C };
