// Helpers shared by military / air / naval modules.
import * as THREE from 'three';
import { Q, clamp, lerp, TAU, GLOBAL } from '../../engine/common.js';
import { canvasTex, texRes, cached, speckle, normalTex, paintNoise } from '../../engine/proc.js';
import { mk, TX, norm, xf } from './kit.js';

/** extrude a PLAN polygon [[x,z],...] (thin in y, centred) */
export function planSlab(poly, thick = 0.1, bevel = 0.01) {
  const sh = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, thick - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -(thick - bevel * 2) / 2); g.rotateX(Math.PI / 2); return g;
}
/** extrude a SIDE polygon [[z,y],...] across x (centred) */
export function sideSlab2(profile, w = 0.1, bevel = 0.01) {
  const sh = new THREE.Shape(profile.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, w - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -(w - bevel * 2) / 2); g.rotateY(-Math.PI / 2); return g;
}

export const MIL_COLORS = {
  olive: { base: 0x4e5a3a, camo: ['#4b5232', '#2d3220', '#7a6c4a'] }, desert: { base: 0xa8926a, camo: ['#b39b70', '#8a7650', '#cdb98d'] }, dark: { base: 0x30352c, camo: ['#34382e', '#202319', '#4c4a38'] },
  grey: { base: 0x6b7178, camo: ['#6d737a', '#4a4f55', '#8b9097'] }, arctic: { base: 0xd8dcdf, camo: ['#dfe3e6', '#b6bcc2', '#f2f4f5'] }, green: { base: 0x3c5a2c, camo: ['#3e5b2e', '#26391c', '#6b7a45'] },
};
/** standard military material set */
export function milMats(color = 'olive', { camo = true, dirt = 0.3 } = {}) {
  const c = MIL_COLORS[color] || MIL_COLORS.olive; const tex = camo ? TX.camo(c.camo[0], c.camo[1], c.camo[2], 'camo_' + color) : null;
  const flat = (col, o = {}) => mk.flat(col, { rough: 0.78, metal: 0.18, normalMap: TX.hammered(), normalScale: 0.5, ...o });
  const m = {
    paint: flat(camo ? 0xffffff : c.base, { map: tex }), paint2: flat(c.base), dark: mk.metal(0x1f2326, { rough: 0.62, metal: 0.55, normal: TX.hammered(), ns: 0.5 }), steel: mk.metal(0x6a717a, { rough: 0.38, metal: 0.9 }), black: mk.plastic(0x0e0f10, { rough: 0.6 }),
    rubber: mk.rubber({ tread: true }), rim: mk.metal(0x4a5058, { rough: 0.5, metal: 0.8 }), disc: mk.metal(0x2a2d31, { rough: 0.6 }), glass: mk.glass({ tint: 0x1c2b26, opacity: 0.55 }),
    lampHead: mk.light(0xfff0cc, { on: 6, off: 0.05, base: 0x9a9fa5 }), lampTail: mk.light(0xff1a12, { on: 4, off: 0.2, base: 0x701410 }), lampAmber: mk.light(0xffa020, { on: 2.5, off: 0.2, base: 0xa86010 }), ir: mk.light(0xff2a1a, { on: 3, off: 0.4, base: 0x400808 }),
    decal: mk.flat(0xffffff, { map: starTex(), rough: 0.6, metal: 0 }),
  };
  m.decal.transparent = true; m.decal.polygonOffset = true; m.decal.polygonOffsetFactor = -2; m.decal.polygonOffsetUnits = -2; m.decal.depthWrite = false;
  if (dirt > 0) for (const k of ['paint', 'paint2']) m[k].color.multiplyScalar(1 - dirt * 0.25);
  return m;
}
export function starTex() { return cached('mil:star', () => canvasTex(128, 128, (ctx, w, h) => { ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(235,235,225,0.95)'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 22 : 54; ctx.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(235,235,225,0.9)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(w / 2, h / 2, 60, 0, TAU); ctx.stroke(); }, { wrap: 'clamp' })); }
export function trackTex() {
  return cached('mil:trackTex', () => canvasTex(texRes(256), texRes(256), (ctx, w, h) => {
    ctx.fillStyle = '#2a2b2c'; ctx.fillRect(0, 0, w, h); const n = 4;
    for (let i = 0; i < n; i++) { const x = i * w / n; ctx.fillStyle = '#3b3c3e'; ctx.fillRect(x + 3, 6, w / n - 8, h - 12); ctx.fillStyle = '#1a1a1b'; ctx.fillRect(x + 3, h * 0.46, w / n - 8, h * 0.08); ctx.fillStyle = '#555'; ctx.fillRect(x + 6, 10, 4, h - 20); ctx.fillRect(x + w / n - 12, 10, 4, h - 20); ctx.fillStyle = '#6a5a44'; ctx.globalAlpha = 0.25; ctx.fillRect(x, 0, w / n, h); ctx.globalAlpha = 1; }
    speckle(ctx, w, h, { count: 600, colors: ['#7a6a52', '#111', '#555'], alpha: [0.1, 0.4], size: [1, 3], seed: 5 });
  }, { wrap: 'repeat', aniso: 8 }));
}
/** endless track belt around two end circles. returns geometry with u = path length / padLen */
export function trackBelt({ zF, zR, y, r, width, thick = 0.09, padLen = 0.2, nPer = 10 }) {
  const pts = []; const L = zF - zR; // path points (z,y) + outward normal
  const add = (z, yy, nz, ny) => pts.push([z, yy, nz, ny]);
  const nl = 20; for (let i = 0; i < nl; i++) add(lerp(zR, zF, i / nl), y + r, 0, 1);
  const na = 16; for (let i = 0; i < na; i++) { const a = Math.PI / 2 - Math.PI * (i / na); add(zF + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  for (let i = 0; i < nl; i++) add(lerp(zF, zR, i / nl), y - r, 0, -1);
  for (let i = 0; i < na; i++) { const a = -Math.PI / 2 - Math.PI * (i / na); add(zR + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  const n = pts.length; const pos = [], uv = [], idx = []; let s = 0; const S = [0];
  for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); S.push(s); }
  const faces = [[1, thick / 2, 'o'], [-1, -thick / 2, 'i']];
  const ring = (xSign, off, flip) => { const base = pos.length / 3; for (let i = 0; i <= n; i++) { const p = pts[i % n]; pos.push(xSign * width / 2, p[1] + p[3] * off, p[0] + p[2] * off); uv.push(S[i] / padLen / 4, xSign > 0 ? 1 : 0); } return base; };
  // outer/inner surfaces: two columns (x=-w/2, x=+w/2) per offset
  const quad = (b0, b1, flip) => { for (let i = 0; i < n; i++) { const a = b0 + i, b = b0 + i + 1, c = b1 + i, d = b1 + i + 1; if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); } };
  const oL = ring(-1, thick / 2), oR = ring(1, thick / 2), iL = ring(-1, -thick / 2), iR = ring(1, -thick / 2);
  quad(oL, oR, false); quad(iL, iR, true); quad(oL, iL, true); quad(oR, iR, false);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** additive flame / exhaust cone (shader driven, throttle 0..1). returns {mesh, set(a)} */
export function flameCone({ length = 3, radius = 0.4, color = 0xffa040, core = 0xffffff, diamonds = true, seed = 0 } = {}) {
  const g = new THREE.CylinderGeometry(radius * 0.7, radius * 0.1, 1, 14, 8, true); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2); // tip towards -z... base at z=0, extends toward -z? (rotateX(-90): -y -> +z). flip below
  g.rotateY(Math.PI);
  const u = { uT: GLOBAL.time, uA: { value: 0 }, uLen: { value: length }, uCol: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color(core) }, uSeed: { value: seed } };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uA,uLen,uT; varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vec3 p=position; float k = 1.0 - uv.y; /* uv.y: 0 at tip? */ p.z *= uLen*max(uA,0.001); p.xy *= (0.35+0.65*uA); p.xy *= 1.0 + 0.08*sin(uT*60.0+position.z*9.0); vP=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
    fragmentShader: `uniform float uA,uT,uSeed; uniform vec3 uCol,uCore; varying vec2 vUv; varying vec3 vP;
      float h(float x){ return fract(sin(x*127.1+uSeed)*43758.5); }
      void main(){ float t = clamp(-vP.z/(1.0), 0.0, 1.0); float along = 1.0 - vUv.y;
        float diam = 0.5+0.5*cos((along*5.0 - uT*0.0)*6.2831); float shock = ${diamonds ? '0.55+0.45*smoothstep(0.0,1.0,abs(sin(along*18.0)))' : '1.0'};
        vec3 c = mix(uCore, uCol, smoothstep(0.0,0.8,along)); float a = (1.0-along)*(0.6+0.4*shock)*uA; a *= 0.75+0.25*sin(uT*80.0+along*20.0+uSeed);
        a *= smoothstep(0.0,0.06,along); gl_FragColor = vec4(c*(1.0+2.0*(1.0-along)), a); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 6;
  return { mesh, set(a) { u.uA.value = a; mesh.visible = a > 0.02; }, uniforms: u };
}
export function glowSpriteTex() { return cached('mil:glow', () => canvasTex(64, 64, (ctx, w, h) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }, { wrap: 'clamp' })); }
export function glowSprite(color = 0xffaa55, size = 2, opacity = 0.6) { const m = new THREE.SpriteMaterial({ map: glowSpriteTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }); const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s; }
/** muzzle flash: star-shaped additive billboard pair, driven by intensity 0..1 */
export function muzzleFlash(size = 1.5) {
  const tex = cached('mil:flash', () => canvasTex(128, 128, (ctx, w, h) => { ctx.clearRect(0, 0, w, h); const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.25, 'rgba(255,200,90,0.9)'); g.addColorStop(1, 'rgba(255,90,0,0)'); ctx.fillStyle = g; ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k % 2 ? 22 : 62; ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }, { wrap: 'clamp' }));
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); const s = new THREE.Sprite(mat); s.scale.set(size, size, 1); s.visible = false; s.userData.base = size;
  s.userData.set = (a) => { s.visible = a > 0.02; mat.opacity = a; s.scale.setScalar(s.userData.base * (0.6 + 0.8 * a)); }; return s;
}
