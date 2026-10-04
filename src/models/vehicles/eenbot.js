// EENBOT-2 — EEN Robotics' humanoid. Skinned (rigid-bound) mesh, procedural clip library with leg/arm IK, infection (rabid) variant.
import * as THREE from 'three';
import { Q, RNG, clamp, lerp, damp, smoothstep, TAU, GLOBAL, disposeTree } from '../../engine/common.js';
import { canvasTex, normalTex, paintNoise, speckle, texRes, cached } from '../../engine/proc.js';
import { limb, loft, tube, mergeGeometries } from '../../engine/geo.js';
import { infectable, setInfection as setInfectionTree } from '../../engine/infect.js';
import { norm, xf, box, rbox, cyl, cylX, cylZ, sph, ell, tor, between, TX, mk } from './kit.js';
import { BONES, BI, NB, Pose, CLIPS, LIMBS, DIM, solveIK, infectedStyle, LOCO_SPEED, ONCE, RIFLE } from './eenbot_anim.js';

const REST = { // world rest positions (left = +x)
  root: [0, 0, 0], hips: [0, 0.945, 0], spine: [0, 1.03, 0], chest: [0, 1.17, 0], neck: [0, 1.47, 0], head: [0, 1.53, 0],
  thumbL1: [0.22, 0.85, 0.035], thumbL2: [0.225, 0.815, 0.05], fingL1: [0.24, 0.785, 0], fingL2: [0.24, 0.735, 0],
  thumbR1: [-0.22, 0.85, 0.035], thumbR2: [-0.225, 0.815, 0.05], fingR1: [-0.24, 0.785, 0], fingR2: [-0.24, 0.735, 0],
};
for (const [s, n] of [[1, 'L'], [-1, 'R']]) { REST['ua' + n] = [0.235 * s, 1.41, 0]; REST['fa' + n] = [0.24 * s, 1.13, 0]; REST['hand' + n] = [0.24 * s, 0.87, 0]; REST['th' + n] = [0.1 * s, 0.935, 0]; REST['sh' + n] = [0.1 * s, 0.505, 0]; REST['ft' + n] = [0.1 * s, 0.085, 0]; }

// ───────── textures ─────────
const T = {
  ceramicNormal: () => cached('een:cerN', () => normalTex(texRes(256), texRes(256), (ctx, w, h) => {
    paintNoise(ctx, w, h, { scale: 30, oct: 3, a: '#7c7c7c', b: '#848484' });
    ctx.strokeStyle = '#202020'; ctx.lineWidth = 3; for (const y of [0.18, 0.5, 0.82]) { ctx.beginPath(); ctx.moveTo(0, y * h); ctx.lineTo(w, y * h); ctx.stroke(); }
    for (const x of [0.0, 0.5]) { ctx.beginPath(); ctx.moveTo(x * w, 0); ctx.lineTo(x * w, h); ctx.stroke(); }
    ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 1.5; for (const y of [0.18, 0.5, 0.82]) { ctx.beginPath(); ctx.moveTo(0, y * h + 3); ctx.lineTo(w, y * h + 3); ctx.stroke(); }
  }, { strength: 2.2 })),
  carbon: () => cached('een:carbon', () => normalTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { ctx.fillStyle = (i + j) % 2 ? '#b0b0b0' : '#555'; ctx.fillRect(i * 8, j * 8, 8, 4); ctx.fillStyle = (i + j) % 2 ? '#555' : '#b0b0b0'; ctx.fillRect(i * 8, j * 8 + 4, 8, 4); }
  }, { strength: 1.4, repeat: [3, 3] })),
  ceramicMap: () => cached('een:cerMap', () => canvasTex(texRes(256), texRes(256), (ctx, w, h) => {
    ctx.fillStyle = '#f4f5f6'; ctx.fillRect(0, 0, w, h); paintNoise(ctx, w, h, { scale: 6, oct: 4, a: '#fff', b: '#a9aeb4', contrast: 1.2, alpha: 0.18, blend: true, seed: 5 });
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,66,74,0.18)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, { count: 260, colors: ['#8a8f96', '#c9cdd2'], alpha: [0.1, 0.3], size: [1, 2], seed: 4 });
  })),
  visor: () => cached('een:visor', () => canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(40,150,255,0)'); g.addColorStop(0.15, '#2a9cff'); g.addColorStop(0.5, '#eaf8ff'); g.addColorStop(0.85, '#2a9cff'); g.addColorStop(1, 'rgba(40,150,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, h * 0.44, w, h * 0.12);
    const g2 = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.7); g2.addColorStop(0, 'rgba(30,110,255,0)'); g2.addColorStop(0.5, 'rgba(40,140,255,0.28)'); g2.addColorStop(1, 'rgba(30,110,255,0)'); ctx.fillStyle = g2; ctx.fillRect(w * 0.1, h * 0.3, w * 0.8, h * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 12; i++) ctx.fillRect(0, i * 5.4 + 1, w, 1.4);
  }, { wrap: 'clamp' })),
  glowDot: () => cached('een:glowDot', () => canvasTex(64, 64, (ctx, w, h) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }, { wrap: 'clamp' })),
  logo: () => cached('een:logo', () => canvasTex(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#17202a'; ctx.font = 'italic 900 78px "Liberation Sans", "DejaVu Sans", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EEN', w / 2, h * 0.42);
    ctx.fillStyle = '#2a8cff'; ctx.fillRect(w * 0.18, h * 0.78, w * 0.64, 6); ctx.fillStyle = '#17202a'; ctx.font = 'bold 20px "Liberation Sans", Arial, sans-serif'; ctx.fillText('ROBOTICS  EB-2', w / 2, h * 0.93);
  }, { wrap: 'clamp' })),
  serial: () => cached('een:serial', () => canvasTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#e8ecef'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#c9252c'; ctx.fillRect(0, 0, w, 10); ctx.fillStyle = '#17202a'; ctx.font = 'bold 26px "Liberation Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('EB2-0417', w / 2, 40); ctx.font = '12px sans-serif'; ctx.fillText('AUTHORISED UNIT', w / 2, 56);
  }, { wrap: 'clamp' })),
};

// ───────── skinned parts builder ─────────
class SkinParts {
  constructor() { this.m = {}; }
  add(mat, geo, bone, o = {}) {
    const g = norm(geo.clone()); xf(g, o); const n = g.attributes.position.count; const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); const bi = BI[bone]; if (bi === undefined) throw new Error('bone ' + bone);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); (this.m[mat] ||= []).push(g);
  }
  mirror(mat, geo, boneL, boneR, o = {}) { // add geometry for both sides (left = +x)
    this.add(mat, geo, boneL, o); const m = { ...o, mirrorX: true }; this.add(mat, geo, boneR, m);
  }
  build() { const out = {}; for (const k in this.m) { const g = mergeGeometries(this.m[k], false); g.computeBoundingSphere(); g.userData.shared = true; out[k] = g; this.m[k].forEach((x) => x.dispose()); } return out; }
}
const hang = (len, rt, rb, o = {}) => limb(len, rb, rt, { radial: 16, rings: 7, bulge: 0.1, ...o }).translate(0, -len, 0); // hangs from y=0 down to -len

function buildGeometry() {
  return cached(`een:geo:${Q.detail}`, () => {
    const S = new SkinParts(); const L = 'L', R = 'R';
    const both = (mat, geo, bone, o = {}) => { S.add(mat, geo, bone, o); S.add(mat, geo.clone(), bone, { ...o, mirrorX: true }); }; // symmetric pair on one bone
    // ── head ──
    const hy = 1.635;
    S.add('cer', ell(0.086, 0.11, 0.104, 28, 18), 'head', { pos: [0, hy, -0.008] });
    S.add('cer', ell(0.066, 0.056, 0.078, 20, 12), 'head', { pos: [0, 1.573, 0.024] }); // chin / jaw
    S.add('gra', rbox(0.15, 0.022, 0.15, 0.01), 'head', { pos: [0, 1.527, -0.005] }); // head-neck collar
    S.add('gra', rbox(0.014, 0.07, 0.1, 0.006), 'head', { pos: [0, 1.7, -0.07], rot: [-0.5, 0, 0] }); // sensor fin
    both('gra', cylX(0.03, 0.03, 0.022, 14), 'head', { pos: [0.088, hy - 0.002, -0.01] }); both('met', tor(0.027, 0.004, 5, 16).rotateY(Math.PI / 2), 'head', { pos: [0.1, hy - 0.002, -0.01] }); both('glow', cylX(0.012, 0.012, 0.006, 10), 'head', { pos: [0.103, hy - 0.002, -0.01] });
    both('gra', rbox(0.008, 0.045, 0.06, 0.004), 'head', { pos: [0.067, 1.572, 0.03] }); // cheek vents
    S.add('gra', rbox(0.072, 0.03, 0.014, 0.006), 'head', { pos: [0, 1.574, 0.098], rot: [0.25, 0, 0] }); // speaker grille housing
    // neck rings
    for (let i = 0; i < 3; i++) S.add('gra', cyl(0.044 - i * 0.002, 0.044 - i * 0.002, 0.016, 16), 'neck', { pos: [0, 1.452 + i * 0.022, 0] });
    S.add('rub', cyl(0.034, 0.034, 0.09, 12), 'neck', { pos: [0, 1.49, 0] });
    // ── torso: chest shell (white) ──
    const chest = loft([
      { y: 1.095, rx: 0.125, rz: 0.092 }, { y: 1.18, rx: 0.15, rz: 0.106, cz: 0.004 }, { y: 1.27, rx: 0.176, rz: 0.12, cz: 0.012 }, { y: 1.36, rx: 0.192, rz: 0.126, cz: 0.012 }, { y: 1.43, rx: 0.17, rz: 0.108 }, { y: 1.47, rx: 0.1, rz: 0.08 },
    ], { radial: 30, power: 2.7 });
    S.add('cer', chest, 'chest');
    S.add('gra', ell(0.1, 0.022, 0.078, 16, 8), 'chest', { pos: [0, 1.472, 0] }); // collar
    for (let i = 0; i < 6; i++) S.add('gra', cyl(0.115 + 0.005 * Math.sin(i * 1.3), 0.115 + 0.005 * Math.sin(i * 1.3), 0.016, 20).scale(1.05, 1, 0.78), 'spine', { pos: [0, 0.99 + i * 0.023, 0] }); // ribbed waist
    S.add('rub', cyl(0.105, 0.105, 0.15, 16).scale(1.05, 1, 0.75), 'spine', { pos: [0, 1.05, 0] });
    // chest ring (glow) + housing + core
    S.add('gra', cyl(0.062, 0.066, 0.016, 28).rotateX(Math.PI / 2), 'chest', { pos: [0, 1.3, 0.134] });
    S.add('glow', tor(0.05, 0.0085, 6, 36), 'chest', { pos: [0, 1.3, 0.142] });
    S.add('glass', cyl(0.043, 0.043, 0.004, 24).rotateX(Math.PI / 2), 'chest', { pos: [0, 1.3, 0.142] });
    S.add('glow', sph(0.017, 12, 8).scale(1, 1, 0.5), 'chest', { pos: [0, 1.3, 0.145] });
    // chest styling: side vents, sternum line, ribs
    both('gra', rbox(0.014, 0.13, 0.15, 0.006), 'chest', { pos: [0.18, 1.27, 0.0] });
    for (let i = 0; i < 4; i++) both('gra', rbox(0.004, 0.012, 0.11, 0.002), 'chest', { pos: [0.187, 1.2 + i * 0.03, 0.0] });
    S.add('gra', rbox(0.014, 0.26, 0.012, 0.005), 'chest', { pos: [0, 1.31, 0.128] }); // sternum seam
    both('gra', rbox(0.1, 0.012, 0.012, 0.004), 'chest', { pos: [0.075, 1.4, 0.122] });
    // back pack
    S.add('gra', rbox(0.2, 0.25, 0.08, 0.02), 'chest', { pos: [0, 1.3, -0.14] }); S.add('cer', rbox(0.17, 0.19, 0.03, 0.012), 'chest', { pos: [0, 1.3, -0.186] });
    for (let i = -1; i <= 1; i++) S.add('glow', rbox(0.014, 0.1, 0.004, 0.002), 'chest', { pos: [i * 0.045, 1.3, -0.203] });
    both('gra', cyl(0.009, 0.009, 0.1, 6), 'chest', { pos: [0.075, 1.5, -0.14] });
    // pelvis
    const pelvis = loft([{ y: 0.855, rx: 0.115, rz: 0.088 }, { y: 0.92, rx: 0.155, rz: 0.108 }, { y: 0.985, rx: 0.165, rz: 0.108 }, { y: 1.035, rx: 0.14, rz: 0.095 }], { radial: 24, power: 2.5 });
    S.add('cer', pelvis, 'hips');
    both('gra', ell(0.062, 0.07, 0.075, 12, 8), 'hips', { pos: [0.105, 0.925, 0] });
    S.add('gra', rbox(0.1, 0.05, 0.02, 0.008), 'hips', { pos: [0, 0.985, 0.112] }); S.add('gra', rbox(0.2, 0.02, 0.02, 0.008), 'hips', { pos: [0, 1.04, 0.096] });
    // ── arms (left authored, mirrored) ──
    for (const [n, s] of [[L, 1], [R, -1]]) {
      const mx = (g, o = {}) => (s < 0 ? { ...o, mirrorX: true } : o);
      const arm = (mat, geo, bone, pos) => S.add(mat, geo, bone + n, { pos: [pos[0] * s, pos[1], pos[2]], ...(s < 0 ? { mirrorX: false } : {}) });
      // geometry isn't mirrored (round shapes); positions are mirrored explicitly
      arm('met', sph(0.052, 14, 10), 'ua', [0.235, 1.41, 0]);
      S.add('cer', ell(0.058, 0.05, 0.066, 16, 12), 'ua' + n, { pos: [0.252 * s, 1.425, 0] });
      S.add('gra', ell(0.05, 0.045, 0.055, 12, 8), 'ua' + n, { pos: [0.24 * s, 1.385, 0] });
      S.add('cer', hang(0.255, 0.049, 0.04, { bulge: 0.12 }), 'ua' + n, { pos: [0.24 * s, 1.38, 0] });
      S.add('gra', cyl(0.047, 0.047, 0.018, 14), 'ua' + n, { pos: [0.24 * s, 1.27, 0] }); S.add('glow', cyl(0.0475, 0.0475, 0.004, 14), 'ua' + n, { pos: [0.24 * s, 1.255, 0] });
      S.add('met', sph(0.043, 12, 8), 'fa' + n, { pos: [0.24 * s, 1.13, 0] }); S.add('gra', cylX(0.046, 0.046, 0.09, 14), 'fa' + n, { pos: [0.24 * s, 1.13, 0] });
      S.add('cer', hang(0.235, 0.046, 0.034, { bulge: 0.14, bulgeAt: 0.3 }), 'fa' + n, { pos: [0.24 * s, 1.1, 0] });
      S.add('gra', rbox(0.03, 0.1, 0.034, 0.008), 'fa' + n, { pos: [(0.24 + 0.04) * s, 1.0, 0] }); S.add('gra', cyl(0.036, 0.036, 0.022, 12), 'fa' + n, { pos: [0.24 * s, 0.88, 0] });
      S.add('met', sph(0.03, 10, 8), 'hand' + n, { pos: [0.24 * s, 0.87, 0] });
      S.add('gra', rbox(0.032, 0.085, 0.076, 0.012, 2), 'hand' + n, { pos: [0.24 * s, 0.825, 0] }); S.add('cer', rbox(0.014, 0.07, 0.066, 0.006), 'hand' + n, { pos: [(0.24 + 0.02) * s, 0.826, 0] });
      S.add('gra', rbox(0.026, 0.05, 0.074, 0.01), 'fing' + n + '1', { pos: [0.24 * s, 0.757, 0] }); S.add('gra', rbox(0.022, 0.046, 0.07, 0.01), 'fing' + n + '2', { pos: [0.24 * s, 0.708, 0] });
      S.add('met', rbox(0.004, 0.04, 0.074, 0.002), 'fing' + n + '1', { pos: [(0.24 - 0.012) * s, 0.757, 0] });
      S.add('gra', between([0.22 * s, 0.85, 0.035], [0.225 * s, 0.82, 0.05], 0.014, 0.012, 7), 'thumb' + n + '1'); S.add('gra', between([0.225 * s, 0.815, 0.05], [0.235 * s, 0.775, 0.07], 0.012, 0.009, 7), 'thumb' + n + '2');
      // ── legs ──
      S.add('met', sph(0.062, 14, 10), 'th' + n, { pos: [0.1 * s, 0.935, 0] });
      S.add('cer', hang(0.405, 0.078, 0.058, { bulge: 0.12, ratio: 1.05 }), 'th' + n, { pos: [0.1 * s, 0.9, 0] });
      S.add('gra', rbox(0.014, 0.26, 0.05, 0.006), 'th' + n, { pos: [(0.1 + 0.07) * s, 0.74, 0.0] }); S.add('gra', cyl(0.074, 0.074, 0.02, 16), 'th' + n, { pos: [0.1 * s, 0.9, 0] });
      S.add('glow', rbox(0.004, 0.2, 0.012, 0.002), 'th' + n, { pos: [(0.1 + 0.0765) * s, 0.74, 0.0] });
      S.add('met', sph(0.055, 12, 10), 'sh' + n, { pos: [0.1 * s, 0.505, 0] }); S.add('gra', cylX(0.057, 0.057, 0.13, 16), 'sh' + n, { pos: [0.1 * s, 0.505, 0] });
      S.add('cer', ell(0.048, 0.055, 0.04, 12, 8), 'sh' + n, { pos: [0.1 * s, 0.505, 0.058] });
      S.add('cer', hang(0.385, 0.053, 0.036, { bulge: 0.16, bulgeAt: 0.3, ratio: 1.2 }), 'sh' + n, { pos: [0.1 * s, 0.485, 0] });
      S.add('gra', ell(0.04, 0.12, 0.028, 10, 8), 'sh' + n, { pos: [0.1 * s, 0.34, -0.045] }); S.add('gra', rbox(0.012, 0.22, 0.02, 0.006), 'sh' + n, { pos: [0.1 * s, 0.3, 0.043] });
      S.add('met', sph(0.04, 10, 8), 'ft' + n, { pos: [0.1 * s, 0.085, 0] });
      S.add('cer', rbox(0.1, 0.07, 0.27, 0.032, 2), 'ft' + n, { pos: [0.1 * s, 0.052, 0.06] }); S.add('cer', ell(0.05, 0.04, 0.05, 10, 8), 'ft' + n, { pos: [0.1 * s, 0.085, -0.02] });
      S.add('gra', rbox(0.102, 0.02, 0.285, 0.008), 'ft' + n, { pos: [0.1 * s, 0.012, 0.062] }); S.add('gra', rbox(0.09, 0.04, 0.05, 0.015), 'ft' + n, { pos: [0.1 * s, 0.04, 0.185] });
    }
    return S.build();
  });
}

// ───────── materials ─────────
function makeMats() {
  const cer = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: T.ceramicMap(), roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, normalMap: T.ceramicNormal(), normalScale: new THREE.Vector2(0.5, 0.5) });
  const gra = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.38, metalness: 0.75, normalMap: T.carbon(), normalScale: new THREE.Vector2(0.5, 0.5) });
  const met = new THREE.MeshStandardMaterial({ color: 0x8a919a, roughness: 0.28, metalness: 1 });
  const rub = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.8, metalness: 0.1, normalMap: TX.fabric(), normalScale: new THREE.Vector2(0.4, 0.4) });
  const glass = new THREE.MeshStandardMaterial({ color: 0x04070b, roughness: 0.05, metalness: 0.6, envMapIntensity: 1.6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x0c3a5e, emissive: new THREE.Color(0x36b4ff), emissiveIntensity: 3.2, roughness: 0.4 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x03060a, emissive: new THREE.Color(0xffffff), emissiveMap: T.visor(), emissiveIntensity: 2.4, roughness: 0.06, metalness: 0.6, envMapIntensity: 1.7 });
  const visor2 = new THREE.MeshStandardMaterial({ color: 0x0c3a5e, emissive: new THREE.Color(0x9fdcff), emissiveIntensity: 2.4, roughness: 0.4 });
  const green = new THREE.MeshStandardMaterial({ color: 0x103a08, emissive: new THREE.Color(0x3cff1a), emissiveIntensity: 3.0, roughness: 0.5 });
  const m = { cer, gra, met, rub, glass, glow, visor, visor2, green };
  for (const k in m) infectable(m[k]);
  return m;
}
const BLUE = new THREE.Color(0x36b4ff), GREEN = new THREE.Color(0x3cff1a);

function bone(name, parentBone) { const b = new THREE.Bone(); b.name = name; return b; }

/**
 * createEenbot(opts) -> Robot
 * opts: {seed, serial, color:'white'|'graphite'|'orange'|'police'}  (accent tints)
 */
export function createEenbot(opts = {}) {
  const geos = buildGeometry(); const mats = makeMats();
  if (opts.tint !== undefined) mats.cer.color.set(opts.tint);
  const root = new THREE.Group(); root.name = 'eenbot';
  // skeleton
  const bones = BONES.map(([n]) => { const b = new THREE.Bone(); b.name = n; return b; });
  BONES.forEach(([n, p], i) => { const b = bones[i]; const rp = REST[n]; if (p) { const pp = REST[p]; b.position.set(rp[0] - pp[0], rp[1] - pp[1], rp[2] - pp[2]); bones[BI[p]].add(b); } else b.position.set(...rp); });
  root.add(bones[0]); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const meshes = [];
  for (const k in geos) { const m = new THREE.SkinnedMesh(geos[k], mats[k]); m.bind(skeleton, new THREE.Matrix4()); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.name = 'een_' + k; root.add(m); meshes.push(m); }
  const bn = (n) => bones[BI[n]];
  // visor band + talk bars + glow sprite (on head)
  const visorGeo = new THREE.SphereGeometry(1, 36, 16, Math.PI / 2 - 1.12, 2.24, 1.14, 0.9); visorGeo.scale(0.0875, 0.1115, 0.1055);
  const visorMesh = new THREE.Mesh(visorGeo, mats.visor); visorMesh.position.set(0, 1.635 - REST.head[1], -0.008); bn('head').add(visorMesh);
  const bars = []; const barGeo = new THREE.BoxGeometry(0.0042, 0.02, 0.004); barGeo.translate(0, 0.01, 0);
  for (let i = 0; i < 9; i++) { const x = (i - 4) * 0.0072; const yy = 1.574 - 0.01; const zf = 0.024 + 0.078 * Math.sqrt(Math.max(0, 1 - Math.pow(x / 0.066, 2) - Math.pow((1.574 - 1.573) / 0.056, 2))) + 0.004; const b = new THREE.Mesh(barGeo, mats.visor2); b.position.set(x, yy - REST.head[1], zf); b.rotation.x = 0.25; b.scale.y = 0.15; bars.push(b); bn('head').add(b); }
  const sprMat = new THREE.SpriteMaterial({ map: T.glowDot(), color: 0x36b4ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const spr = new THREE.Sprite(sprMat); spr.scale.set(0.34, 0.12, 1); spr.position.set(0, 1.635 - REST.head[1], 0.12); bn('head').add(spr);
  const spr2 = new THREE.Sprite(sprMat.clone()); spr2.scale.set(0.26, 0.26, 1); spr2.position.set(0, 1.3 - REST.chest[1], 0.17); spr2.material.opacity = 0.3; bn('chest').add(spr2);
  // logo decals
  const logoM = new THREE.MeshStandardMaterial({ map: T.logo(), transparent: true, roughness: 0.4, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.045), logoM); logo.position.set(0.105, 1.395 - REST.chest[1], 0.1235); logo.rotation.y = 0.45; bn('chest').add(logo);
  const serM = new THREE.MeshStandardMaterial({ map: T.serial(), roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const ser = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), serM); ser.position.set(-0.3, 1.42 - REST.uaR[1], 0.0); ser.rotation.y = -Math.PI / 2 - 0.0; bn('uaR').add(ser);
  // infection extras: exposed wiring, open hatches, green core
  const wires = [
    ['chest', [0.0, 1.46, -0.06], [[0, 0, 0], [0.04, 0.06, -0.04], [0.1, 0.05, -0.1], [0.14, -0.04, -0.12]]],
    ['chest', [-0.06, 1.46, -0.04], [[0, 0, 0], [-0.05, 0.08, -0.02], [-0.12, 0.06, -0.05], [-0.16, -0.05, -0.02]]],
    ['chest', [0.05, 1.4, -0.19], [[0, 0, 0], [0.0, 0.0, -0.08], [0.06, -0.08, -0.12], [0.05, -0.2, -0.1]]],
    ['chest', [-0.05, 1.35, -0.19], [[0, 0, 0], [-0.02, 0.02, -0.08], [-0.08, -0.05, -0.12], [-0.1, -0.15, -0.14]]],
    ['faR', [-0.27, 1.04, 0.0], [[0, 0, 0], [-0.04, -0.03, 0.04], [-0.07, -0.09, 0.02], [-0.06, -0.17, 0.06]]],
    ['thL', [0.17, 0.78, 0.02], [[0, 0, 0], [0.05, -0.02, 0.03], [0.07, -0.1, 0.0], [0.05, -0.18, -0.04]]],
    ['head', [-0.03, 1.75, -0.05], [[0, 0, 0], [-0.03, 0.06, -0.03], [-0.08, 0.05, -0.08], [-0.1, -0.03, -0.12]]],
    ['shR', [-0.145, 0.42, 0.0], [[0, 0, 0], [-0.04, -0.03, 0.03], [-0.06, -0.1, 0.0]]],
  ].map(([b, pos, pts], i) => {
    const g = new THREE.Group(); const p = pts.map((q) => new THREE.Vector3(...q)); const m = new THREE.Mesh(tube(p, 0.0085, { radial: 5, segsPerPoint: 4 }), mats.rub); g.add(m);
    const tipM = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 5), mats.green); tipM.position.copy(p[p.length - 1]); g.add(tipM);
    const core = new THREE.Mesh(tube(p, 0.0035, { radial: 4, segsPerPoint: 4 }), mats.green); core.scale.setScalar(1.0); g.add(core);
    g.position.set(pos[0] - REST[b][0], pos[1] - REST[b][1], pos[2] - REST[b][2]); g.visible = false; bn(b).add(g); g.userData.k = 0.25 + (i % 4) * 0.12; return g;
  });
  // chest hatch (hinged at the top edge) + green core behind it
  const hatchPivot = new THREE.Group(); hatchPivot.position.set(0, 1.235 - REST.chest[1], 0.134); bn('chest').add(hatchPivot);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.012), mats.cer); hatch.position.y = -0.0375; hatchPivot.add(hatch);
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.065, 0.01), mats.green); core.position.set(0, 1.2 - REST.chest[1], 0.126); core.visible = false; bn('chest').add(core);
  const hatchR = new THREE.Group(); hatchR.position.set(-0.262, 0.99 - REST.faR[1], -0.0); bn('faR').add(hatchR); const hatchR1 = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.09, 0.05), mats.cer); hatchR1.position.set(0, -0.0, 0); hatchR.add(hatchR1);
  // props
  const propMat = { crate: mk.paint(0xc8921e, { metal: 0.2, rough: 0.5, peel: false }), dark: mats.gra };
  const props = {}; const mkProp = (name, build) => { const g = new THREE.Group(); build(g); g.visible = false; props[name] = g; return g; };
  mkProp('crate', (g) => { const c = new THREE.Mesh(rbox(0.4, 0.26, 0.3, 0.02, 2), propMat.crate); c.castShadow = true; g.add(c); for (const sx of [-1, 1]) { const h = new THREE.Mesh(rbox(0.012, 0.05, 0.12, 0.005), propMat.dark); h.position.set(0.2 * sx, 0.03, 0); g.add(h); } const band = new THREE.Mesh(rbox(0.402, 0.03, 0.302, 0.005), propMat.dark); band.position.y = -0.06; g.add(band); const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshStandardMaterial({ map: T.logo(), transparent: true })); lab.position.set(0, 0.04, 0.152); g.add(lab); g.position.set(0, 0.02, 0.33); bn('chest').add(g); });
  mkProp('rifle', (g) => { const dark = mats.gra; const parts = [[0.05, 0.08, 0.34, 0, 0.0, 0.0], [0.035, 0.13, 0.12, 0, -0.07, 0.03], [0.03, 0.03, 0.4, 0, 0.012, 0.36], [0.05, 0.07, 0.18, 0, -0.03, -0.2]]; for (const [w, h, d, x, y, z] of parts) { const m = new THREE.Mesh(rbox(w, h, d, 0.008), dark); m.position.set(x, y, z); m.castShadow = true; g.add(m); } const mz = new THREE.Mesh(cylZ(0.016, 0.016, 0.08, 10), mats.met); mz.position.z = 0.6; g.add(mz); const sc = new THREE.Mesh(cylZ(0.022, 0.022, 0.16, 10), mats.rub); sc.position.set(0, 0.07, 0.04); g.add(sc); const lens = new THREE.Mesh(cylZ(0.018, 0.018, 0.004, 10), mats.glow); lens.position.set(0, 0.07, 0.122); g.add(lens);
    g.position.set(-0.062, 0.145, 0.34).add(new THREE.Vector3(0, 0, 0)); g.rotation.set(-0.0, -0.06, 0); bn('chest').add(g); });
  mkProp('tablet', (g) => { const t = new THREE.Mesh(rbox(0.19, 0.012, 0.26, 0.006), mats.gra); g.add(t); const s = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.24), mats.visor); s.rotation.x = -Math.PI / 2; s.position.y = 0.0065; g.add(s); g.position.set(0, 0.0, 0.0); bn('handL').add(g); g.position.set(-0.02, -0.1, 0.06); g.rotation.set(1.2, 0, 0); });
  let heldProp = null;

  // ── animation state ──
  const poseA = new Pose(), poseFrom = new Pose(), poseOut = new Pose(), poseBlend = new Pose(), poseCur = new Pose();
  const S = { clip: 'idle', time: 0, speed: 1, loop: true, mirror: false, params: {}, blend: 0.2, blendT: 1, talk: 0, talkStyle: 'calm', inf: 0, look: null, lookW: 0, lookY: 0, lookP: 0, t: 0, started: false, visorOn: 1, glowAmt: 1, talkSm: 0 };
  const E = S; // clip env
  const q = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qf = new THREE.Quaternion(), eu = new THREE.Euler(), qh = new THREE.Quaternion();
  const vS = new THREE.Vector3(), vT = new THREE.Vector3(), vPole = new THREE.Vector3(), vTmp = new THREE.Vector3(), vHip = new THREE.Vector3();
  const qyaw = new THREE.Quaternion(), qpit = new THREE.Quaternion(), qrol = new THREE.Quaternion(); 
  const fkQ = (P, name, out) => { const i = BI[name] * 3; return out.setFromEuler(eu.set(P.r[i], P.r[i + 1], P.r[i + 2], 'XYZ')); };
  const setBone = (name, quat) => bones[BI[name]].quaternion.copy(quat);
  function evalClip(P, name, time, params) {
    P.reset(); const fn = CLIPS[name] || CLIPS.idle; fn(P, time, params || {}, E);
    if (S.mirror) P.mirror();
  }
  function applyPose(P) {
    // FK for torso/head/hands/fingers
    for (const n of ['hips', 'spine', 'chest', 'neck', 'head', 'handL', 'handR']) setBone(n, fkQ(P, n, q));
    bones[BI.hips].position.set(P.hip[0], P.hip[1], P.hip[2]);
    // fingers curl (about Z, towards the palm)
    for (const [side, n] of [[1, 'L'], [-1, 'R']]) { const c = P.curl[side > 0 ? 0 : 1]; bn('fing' + n + '1').rotation.set(0, 0, -side * c * 1.25); bn('fing' + n + '2').rotation.set(0, 0, -side * c * 1.5); bn('thumb' + n + '1').rotation.set(-c * 0.35, 0, -side * c * 0.5); bn('thumb' + n + '2').rotation.set(-c * 0.3, 0, -side * c * 0.7); }
    // limbs
    qh.copy(bones[BI.hips].quaternion);
    for (let li = 0; li < 4; li++) {
      const Lb = LIMBS[li]; const w = P.ikOn[li]; const fkU = fkQ(P, Lb.up, qa), fkL = fkQ(P, Lb.lo, qb);
      if (w < 0.001) { setBone(Lb.up, fkU); setBone(Lb.lo, fkL); if (Lb.kind === 'leg') setBone(Lb.end, fkQ(P, Lb.end, q)); continue; }
      const l1 = Lb.kind === 'leg' ? DIM.thigh : DIM.upperArm, l2 = Lb.kind === 'leg' ? DIM.shin : DIM.foreArm; const side = Lb.side;
      if (Lb.kind === 'leg') {
        // hip joint & target in hips-local space
        qhInv.copy(qh).invert(); vHip.set(DIM.hipX * side, DIM.hipY, 0);
        vT.set(P.ikT[li * 3], P.ikT[li * 3 + 1], P.ikT[li * 3 + 2]).sub(vTmp.set(P.hip[0], P.hip[1], P.hip[2])).applyQuaternion(qhInv);
        vPole.set(0.12 * side, 0, 1).normalize();
        solveIK(vHip, vT, l1, l2, vPole, q1, q2);
        // foot orientation: yaw/pitch/roll given in root space -> hips-local -> relative to the shin
        const fi = side > 0 ? 0 : 1; qyaw.setFromAxisAngle(AXY, P.ikYaw[fi]); qpit.setFromAxisAngle(AXX, -P.ikPitch[fi]); qrol.setFromAxisAngle(AXZ, P.ikRoll[fi]);
        qf.copy(qyaw).multiply(qpit).multiply(qrol).premultiply(qhInv);
        vQ.copy(q1).multiply(q2); const footLocal = vQ2.copy(vQ).invert().multiply(qf);
        setBone(Lb.up, w >= 0.999 ? q1 : qa.slerp(q1, w)); setBone(Lb.lo, w >= 0.999 ? q2 : qb.slerp(q2, w));
        const fkF = fkQ(P, Lb.end, vQ3); setBone(Lb.end, w >= 0.999 ? footLocal : fkF.slerp(footLocal, w));
      } else {
        vHip.set(DIM.shoulderX * side, DIM.shoulderY, 0); vT.set(P.ikT[li * 3], P.ikT[li * 3 + 1], P.ikT[li * 3 + 2]);
        vPole.set(0.45 * side, -0.35, -1).normalize(); solveIK(vHip, vT, l1, l2, vPole, q1, q2, ZH);
        setBone(Lb.up, w >= 0.999 ? q1 : qa.slerp(q1, w)); setBone(Lb.lo, w >= 0.999 ? q2 : qb.slerp(q2, w));
      }
    }
  }
  const AXY = new THREE.Vector3(0, 1, 0), AXX = new THREE.Vector3(1, 0, 0), AXZ = new THREE.Vector3(0, 0, 1), ZH = new THREE.Vector3(0, 0, 1);
  const vTmp2 = new THREE.Quaternion(), qhInv = new THREE.Quaternion(), vQ = new THREE.Quaternion(), vQ2 = new THREE.Quaternion(), vQ3 = new THREE.Quaternion();
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3(), tmpM = new THREE.Matrix4(), headW = new THREE.Vector3();
  const qLook = new THREE.Quaternion();

  const api = {
    root, kind: 'eenbot', height: 1.75, bones, skeleton, meshes, props, mats, heldProp: null,
    anchors: { handR: { bone: 'handR' }, handL: { bone: 'handL' }, head: { bone: 'head' }, chest: { bone: 'chest' } },
    /** ground speed (m/s) at which a locomotion clip's feet plant when time advances at `speed` = 1 */
    clipSpeed(name) { return LOCO_SPEED[name] || 0; },
    setTransform(x, y, z, yaw) { root.position.set(x, y, z); root.rotation.y = yaw; },
    play(clip, { time, speed = 1, blend = 0.2, loop = true, mirror = false, params = {} } = {}) {
      if (!CLIPS[clip]) clip = 'idle';
      if (clip !== S.clip || mirror !== S.mirror) { if (S.started) { poseFrom.copy(poseCur); S.blendT = 0; S.blend = Math.max(0.001, blend); } S.clip = clip; }
      S.mirror = mirror; S.speed = speed; S.loop = loop; S.params = params; if (time !== undefined) S.time = time * speed; else S.time += 0; S.started = true;
      if (loop === false && ONCE[clip]) S.time = Math.min(S.time, ONCE[clip]);
    },
    setTalk(energy, style = 'calm') { S.talk = clamp(energy); S.talkStyle = style; },
    setMouth(p) { if (!p) { S.talk = 0; return; } S.talk = clamp(Math.max(p.jaw ?? 0, (p.wide ?? 0) * 0.6, (p.round ?? 0) * 0.6)); },
    setExpression() { },
    lookAt(v, weight = 1) { S.look = v ? (S.look || new THREE.Vector3()).copy(v) : null; S.lookWTarget = v ? weight : 0; },
    hold(name, hand = 'R') {
      for (const k in props) props[k].visible = false; heldProp = null;
      if (name && props[name]) { props[name].visible = true; heldProp = props[name]; if (name === 'tablet') { const par = bn(hand === 'R' ? 'handR' : 'handL'); par.add(heldProp); heldProp.position.set(-0.02 * (hand === 'R' ? -1 : 1), -0.1, 0.06); } }
    },
    setInfection(a) {
      S.inf = clamp(a); setInfectionTree(root, S.inf);
      const col = BLUE.clone().lerp(GREEN, smoothstep(0.05, 0.5, S.inf));
      mats.glow.emissive.copy(col); mats.visor.emissive.setRGB(1, 1, 1).lerp(new THREE.Color(0.35, 1, 0.2), smoothstep(0.05, 0.5, S.inf)); mats.visor2.emissive.set(0x9fdcff).lerp(GREEN, smoothstep(0.05, 0.5, S.inf)); sprMat.color.copy(col); spr2.material.color.copy(col);
    },
    setVisor(a) { S.visorOn = clamp(a); },
    setDamage() { },
    footWorldPositions(out = []) { for (const n of ['ftL', 'ftR']) { const v = out[n === 'ftL' ? 0 : 1] || (out[n === 'ftL' ? 0 : 1] = new THREE.Vector3()); bn(n).getWorldPosition(v); } return out; },
    update(dt, t) {
      dt = clamp(dt, 0, 0.1); S.t = t;
      // loop wrap
      let tm = S.time; const cl = CLIPS[S.clip]; if (S.loop === false && ONCE[S.clip]) tm = Math.min(tm, ONCE[S.clip]);
      evalClip(poseA, S.clip, tm, S.params); if (S.inf > 0.05) infectedStyle(poseA, t, S.inf, S);
      let P = poseA;
      if (S.blendT < S.blend) { S.blendT += dt; const w = clamp(S.blendT / S.blend); const e = w * w * (3 - 2 * w); poseBlend.lerpTo(poseFrom, poseA, e); P = poseBlend; }
      poseCur.copy(P); applyPose(P);
      // look-at (additive on neck/head)
      if (S.lookWTarget !== undefined) S.lookW = damp(S.lookW, S.lookWTarget, 6, dt);
      if (S.lookW > 0.01 && S.look) {
        root.updateMatrixWorld(true); bn('head').getWorldPosition(headW); tmpV.copy(S.look).sub(headW); tmpV.applyQuaternion(tmpQ.copy(root.getWorldQuaternion(tmpQ)).invert()); const yaw = clamp(Math.atan2(tmpV.x, tmpV.z), -1.1, 1.1), pit = clamp(-Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z)), -0.5, 0.6);
        S.lookY = damp(S.lookY, yaw, 8, dt); S.lookP = damp(S.lookP, pit, 8, dt);
      } else { S.lookY = damp(S.lookY, 0, 6, dt); S.lookP = damp(S.lookP, 0, 6, dt); }
      if (Math.abs(S.lookY) + Math.abs(S.lookP) > 1e-3) { const w = S.lookW; for (const [n, k] of [['neck', 0.35], ['head', 0.65]]) { const b = bn(n); qLook.setFromEuler(eu.set(S.lookP * k * w, S.lookY * k * w, 0)); b.quaternion.premultiply(qLook); } }
      // talk bars + visor/glow pulses
      S.talkSm = damp(S.talkSm, S.talk, 18, dt);
      for (let i = 0; i < bars.length; i++) { const n = 0.5 + 0.5 * Math.sin(t * (17 + i * 3.1) + i * 1.7) * Math.sin(t * (9 + i) + i); bars[i].scale.y = 0.12 + (S.talkSm * (0.35 + 0.65 * n)) * 1.0 * (1 - Math.abs(i - 4) / 7); }
      const flick = 1 + (S.inf > 0.05 ? (Math.sin(t * 47) * Math.sin(t * 13.3) > 0.4 ? -0.5 * S.inf : 0.12 * Math.sin(t * 23) * S.inf) : 0);
      mats.visor2.emissiveIntensity = 2.6 * S.visorOn * (0.5 + S.talkSm) * flick; mats.visor.emissiveIntensity = 2.4 * S.visorOn * (0.92 + 0.08 * Math.sin(t * 2.1) + S.talkSm * 0.35) * flick; mats.glow.emissiveIntensity = 3.2 * S.glowAmt * (0.9 + 0.1 * Math.sin(t * 3.3 + 1)) * (0.85 + 0.15 * flick);
      sprMat.opacity = 0.32 * S.visorOn * (0.7 + 0.5 * S.talkSm) * flick; spr2.material.opacity = 0.26 * S.glowAmt * (0.85 + 0.15 * Math.sin(t * 3.3 + 1));
      // infection extras
      const k = smoothstep(0.2, 0.9, S.inf); for (const g of wires) { g.visible = S.inf > g.userData.k * 0.6; g.scale.setScalar(clamp((S.inf - g.userData.k * 0.5) * 2.2, 0.01, 1)); }
      hatchPivot.rotation.x = -k * 1.25 * (1 + 0.1 * Math.sin(t * 12) * (S.inf > 0.6 ? 1 : 0)); core.visible = k > 0.1; hatchR.rotation.z = -k * 1.0;
    },
    dispose() { disposeTree(root); sprMat.dispose(); spr2.material.dispose(); skeleton.dispose(); },
  };
  const tmpQ = new THREE.Quaternion();
  // first pose
  api.play('idle', { time: 0 }); api.update(0, 0);
  if (opts.infection) api.setInfection(opts.infection);
  return api;
}
