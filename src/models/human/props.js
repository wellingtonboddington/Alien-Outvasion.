// Hand-held props. createProp(name, human, side) -> { obj, pose, offPose, anchors, update(dt,t,human), dispose(), name }
// Prop space: +Y up, +Z forward (barrel / pointing direction), +X right, origin = grip point (palm centre).  obj is parented to the hand bone;
// its quaternion is re-solved every frame: 'natural' (fixed grip in the hand frame), 'level' (kept upright in the world), 'hybrid' (natural,
// upright when the arm hangs), 'gun' (natural when aiming, low-ready when the arm hangs), 'phone' (natural near the head, held at chest otherwise).
import * as THREE from 'three';
import { cached, makeCanvas, texFromCanvas } from '../../engine/proc.js';
import { roundedBox } from '../../engine/geo.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { decalTex } from './wear_tex.js';

export const PROP_NAMES = ['phone', 'rifle', 'pistol', 'shotgun', 'tray', 'clipboard', 'glass', 'bottle', 'tablet', 'mic', 'radio', 'binoculars', 'flashlight', 'scalpel', 'pen', 'headset', 'burgerbag', 'toolbox', 'cup', 'mop', 'megaphone', 'briefcase', 'folder'];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-9))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- materials (shared) + textures
const MATS = {};
function mat(key) {
  if (MATS[key]) return MATS[key];
  const o = {
    matte: { roughness: 0.62, metalness: 0.05 }, metal: { roughness: 0.3, metalness: 0.9 }, gun: { roughness: 0.42, metalness: 0.75 }, rubber: { roughness: 0.85, metalness: 0 }, paper: { roughness: 0.9, metalness: 0 },
    leather: { roughness: 0.5, metalness: 0.05 }, wood: { roughness: 0.55, metalness: 0 }, plastic: { roughness: 0.35, metalness: 0.02 },
  }[key];
  let m;
  if (o) m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, envMapIntensity: 0.8, ...o });
  else if (key === 'glass') m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.3 });
  else if (key === 'liquid') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide });
  else if (key === 'glow') m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 3, roughness: 0.3, vertexColors: true });
  else if (key === 'beam') m = new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  m.userData.shared = true; MATS[key] = m; return m;
}
const tex = (key, w, h, draw) => cached('prop.tex.' + key, () => { const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h); return texFromCanvas(c, { wrap: 'clamp', aniso: 4 }); });
const screenTex = (kind) => tex('screen.' + kind, 128, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, kind === 'tablet' ? '#12306a' : '#1b2c5c'); g.addColorStop(1, kind === 'tablet' ? '#46a6e8' : '#8a3fd0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('9:41', w / 2, 62); x.font = '12px sans-serif'; x.fillText('Tuesday 12 October', w / 2, 82);
  for (let i = 0; i < 12; i++) { x.fillStyle = `hsl(${i * 31},70%,60%)`; const cx = 20 + (i % 4) * 30, cy = 130 + Math.floor(i / 4) * 34; x.beginPath(); x.roundRect ? x.roundRect(cx, cy, 24, 24, 6) : x.rect(cx, cy, 24, 24); x.fill(); }
});
const paperTex = () => tex('paper', 128, 192, (x, w, h) => { x.fillStyle = '#f4f1e6'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a3a5a'; x.font = 'bold 12px sans-serif'; x.fillText('FIELD REPORT', 10, 20); x.fillStyle = '#888'; for (let i = 0; i < 18; i++) x.fillRect(10, 34 + i * 8.5, 90 - (i * 37 % 40), 2); x.fillStyle = '#b33'; x.fillRect(8, 168, 40, 8); });
const radioTex = () => tex('radio', 64, 64, (x, w, h) => { x.fillStyle = '#10321a'; x.fillRect(0, 0, w, h); x.fillStyle = '#7dff8a'; x.font = 'bold 20px monospace'; x.fillText('CH 07', 6, 28); x.font = '12px monospace'; x.fillText('156.800', 6, 48); });

// ---------------------------------------------------------------- geometry builder
class PB {
  constructor() { this.s = {}; }
  put(slot, g, color, pos, rot, scl) {
    if (scl) g.scale(...scl); if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); } if (pos) g.translate(pos[0], pos[1], pos[2]);
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed(); (this.s[slot] || (this.s[slot] = [])).push(g); return this;
  }
  box(slot, w, h, d, pos, color, rot, r = 0) { return this.put(slot, r > 0 ? roundedBox(w, h, d, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4), 2) : new THREE.BoxGeometry(w, h, d), color, pos, rot); }
  cyl(slot, rt, rb, h, pos, color, rot, seg = 14) { return this.put(slot, new THREE.CylinderGeometry(rt, rb, h, seg), color, pos, rot); }
  sph(slot, rx, ry, rz, pos, color, seg = 12) { return this.put(slot, new THREE.SphereGeometry(1, seg, Math.max(4, seg >> 1)), color, pos, null, [rx, ry, rz]); }
  lathe(slot, prof, pos, color, rot, seg = 18) { const g = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), seg); return this.put(slot, g, color, pos, rot); }
  torus(slot, R, r, pos, color, rot, arc = Math.PI * 2, seg = 20) { return this.put(slot, new THREE.TorusGeometry(R, r, 8, seg, arc), color, pos, rot); }
  plane(slot, w, h, pos, color, rot) { return this.put(slot, new THREE.PlaneGeometry(w, h), color, pos, rot); }
  build(textures = {}) {
    const g = new THREE.Group(); const geos = [];
    for (const k of Object.keys(this.s)) {
      const geo = mergeGeometries(this.s[k], false); geos.push(geo);
      const m = textures[k] || mat(k); const mesh = new THREE.Mesh(geo, m); mesh.name = 'prop_' + k; if (k === 'glass' || k === 'liquid' || k === 'beam') { mesh.castShadow = false; mesh.renderOrder = 2; } g.add(mesh);
    }
    g.userData.geos = geos; return g;
  }
}
const screenMat = (kind, intensity = 1.3) => cached('prop.screenmat.' + kind, () => { const m = new THREE.MeshStandardMaterial({ map: screenTex(kind), emissiveMap: screenTex(kind), emissive: 0xffffff, emissiveIntensity: intensity, roughness: 0.2, metalness: 0 }); m.userData.shared = true; return m; });
const texMat = (key, map, extra = {}) => cached('prop.texmat.' + key, () => { const m = new THREE.MeshStandardMaterial({ map, roughness: 0.7, side: THREE.DoubleSide, ...extra }); m.userData.shared = true; return m; });

// ---------------------------------------------------------------- prop definitions
// each returns { b: PB, mode, pose, offPose, nat: [X,Y,Z] (hand-local images of prop axes, right-hand), lev: [X,Y,Z] char-frame axes for level mode, grip:[x,y,z], anchors, extra }
const NAT = {
  cyl: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],     // prop Y along hand Z (upright when the forearm is horizontal), prop Z forward = fingers
  gun: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  phone: [[0, 0, 1], [0, -1, 0], [1, 0, 0]],   // long axis along fingers, screen towards the palm side (towards the head when raised)
  handle: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],  // handle across the fist (hand Z), body hangs along hand +Y... (hand hanging)
  flat: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  board: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],   // board fallback (level mode normally takes over)
};
const LEV = {
  up: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  hang: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  chest: [[-1, 0, 0], [0, 0.7, 0.714], [0, 0.714, -0.7]],     // board facing the holder (tilted back)
  flatT: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  phone: [[-1, 0, 0], [0, 0.3, 0.954], [0, 0.954, -0.3]],
  low: [[1, 0, 0], [0, 0.82, -0.57], [0, 0.57, 0.82]],         // gun low-ready: barrel forward & 35 deg down (Z -> (0,-0.57,0.82))
  mic: [[1, 0, 0], [0, 0.4, 0.92], [0, -0.92, 0.4]],
};
LEV.low = [[1, 0, 0], [0, 0.82, 0.57], [0, -0.57, 0.82]];

const DEF = {
  phone: () => {
    const b = new PB();
    b.box('plastic', 0.072, 0.152, 0.0082, [0, 0.02, 0], 0x15171c, null, 0.008); b.box('metal', 0.0735, 0.153, 0.004, [0, 0.02, -0.0005], 0x9aa0a8, null, 0.008);
    b.box('plastic', 0.026, 0.026, 0.003, [-0.016, 0.075, -0.0055], 0x0b0c0f, null, 0.004); b.cyl('glow', 0.0045, 0.0045, 0.002, [-0.022, 0.081, -0.0075], 0x9fb4d8, [Math.PI / 2, 0, 0]);
    const g = b.build({ glow: mat('glow') }); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.142), screenMat('phone')); scr.position.set(0, 0.02, 0.00425); g.add(scr); g.userData.geos.push(scr.geometry);
    return { b, g, mode: 'phone', pose: 'hold_phone', nat: NAT.phone, lev: LEV.phone, grip: [0, -0.05, 0] };
  },
  tablet: () => { const b = new PB(); b.box('plastic', 0.25, 0.175, 0.008, [0.1, 0.06, 0], 0x1a1c20, null, 0.008); b.box('metal', 0.252, 0.177, 0.004, [0.1, 0.06, -0.0005], 0xaab0b8, null, 0.008); const g = b.build(); const s = new THREE.Mesh(new THREE.PlaneGeometry(0.232, 0.157), screenMat('tablet', 1.1)); s.position.set(0.1, 0.06, 0.0043); g.add(s); g.userData.geos.push(s.geometry); return { g, mode: 'level', pose: 'carry', nat: NAT.board, lev: LEV.chest, grip: [0, -0.04, 0] }; },
  rifle: () => {
    const b = new PB(), K = 0x23262a, G = 0x14161a, T = 0x6a5a3a;
    b.box('gun', 0.044, 0.075, 0.26, [0, 0.055, 0.04], K, null, 0.006);              // receiver
    b.box('gun', 0.046, 0.026, 0.12, [0, 0.1, -0.02], G, null, 0.004); b.box('gun', 0.03, 0.012, 0.3, [0, 0.1, 0.06], G);   // top rail
    b.box('gun', 0.052, 0.058, 0.21, [0, 0.045, 0.285], G, null, 0.008);              // handguard
    b.cyl('gun', 0.0085, 0.0085, 0.26, [0, 0.062, 0.52], 0x2c2f33, [Math.PI / 2, 0, 0]); b.cyl('gun', 0.013, 0.013, 0.05, [0, 0.062, 0.665], 0x1a1c1f, [Math.PI / 2, 0, 0]);
    b.box('gun', 0.006, 0.04, 0.006, [0, 0.12, 0.42], G); b.box('gun', 0.03, 0.03, 0.03, [0, 0.12, -0.04], G, null, 0.004);       // sights
    b.box('rubber', 0.04, 0.085, 0.24, [0, 0.045, -0.2], 0x1b1d20, [-0.06, 0, 0], 0.01); b.box('rubber', 0.042, 0.1, 0.02, [0, 0.03, -0.32], 0x101214);   // stock
    b.box('rubber', 0.03, 0.1, 0.04, [0, -0.045, -0.012], 0x1a1c1f, [-0.25, 0, 0], 0.008);                                       // pistol grip
    b.box('gun', 0.032, 0.14, 0.05, [0, -0.06, 0.1], 0x2a2d31, [0.15, 0, 0], 0.005);                                              // magazine
    b.box('gun', 0.01, 0.025, 0.07, [0, 0.0, 0.058], 0x1b1d20);                                                                   // trigger guard
    return { b, mode: 'gun', pose: 'trigger', offPose: 'support', nat: NAT.gun, lev: LEV.low, grip: [0, -0.05, 0], anchors: { foregrip: V(0, 0.0, 0.2), muzzle: V(0, 0.062, 0.69) } };
  },
  pistol: () => {
    const b = new PB();
    b.box('gun', 0.03, 0.034, 0.19, [0, 0.04, 0.05], 0x30343a, null, 0.006); b.box('gun', 0.026, 0.026, 0.19, [0, 0.016, 0.045], 0x1c1e21, null, 0.004);
    b.box('rubber', 0.032, 0.105, 0.05, [0, -0.04, -0.012], 0x16181b, [-0.2, 0, 0], 0.008); b.box('gun', 0.01, 0.025, 0.06, [0, 0.0, 0.052], 0x1b1d20);
    b.box('gun', 0.006, 0.01, 0.01, [0, 0.062, 0.135], 0x111111); b.box('gun', 0.012, 0.01, 0.01, [0, 0.062, -0.03], 0x111111); b.cyl('gun', 0.006, 0.006, 0.03, [0, 0.036, 0.155], 0x0d0d0e, [Math.PI / 2, 0, 0]);
    return { b, mode: 'gun', pose: 'trigger', offPose: 'support', nat: NAT.gun, lev: LEV.low, grip: [0, -0.05, 0], anchors: { muzzle: V(0, 0.036, 0.17) } };
  },
  shotgun: () => {
    const b = new PB(), W = 0x6a4224;
    b.box('gun', 0.04, 0.06, 0.26, [0, 0.05, 0.02], 0x25282c, null, 0.006);
    b.cyl('gun', 0.0125, 0.0125, 0.62, [0, 0.062, 0.5], 0x2a2d31, [Math.PI / 2, 0, 0]); b.cyl('gun', 0.01, 0.01, 0.5, [0, 0.03, 0.43], 0x25282b, [Math.PI / 2, 0, 0]);
    b.box('wood', 0.048, 0.05, 0.19, [0, 0.025, 0.34], W, null, 0.01);                                       // pump
    b.box('wood', 0.04, 0.09, 0.28, [0, 0.03, -0.17], W, [-0.14, 0, 0], 0.012); b.box('rubber', 0.042, 0.1, 0.02, [0, 0.0, -0.31], 0x111111, [-0.14, 0, 0]);
    b.box('wood', 0.032, 0.095, 0.045, [0, -0.045, -0.01], W, [-0.25, 0, 0], 0.01); b.sph('gun', 0.006, 0.006, 0.006, [0, 0.11, 0.7], 0xddddcc, 6);
    return { b, mode: 'gun', pose: 'trigger', offPose: 'support', nat: NAT.gun, lev: LEV.low, grip: [0, -0.05, 0], anchors: { foregrip: V(0, -0.01, 0.27), muzzle: V(0, 0.062, 0.81) } };
  },
  tray: () => {
    const b = new PB(); b.box('plastic', 0.4, 0.014, 0.3, [0, 0.01, 0.0], 0xd9cdb4, null, 0.006); b.box('plastic', 0.42, 0.02, 0.01, [0, 0.02, 0.155], 0xcdbf9f); b.box('plastic', 0.42, 0.02, 0.01, [0, 0.02, -0.155], 0xcdbf9f); b.box('plastic', 0.01, 0.02, 0.3, [0.205, 0.02, 0], 0xcdbf9f); b.box('plastic', 0.01, 0.02, 0.3, [-0.205, 0.02, 0], 0xcdbf9f);
    b.box('paper', 0.17, 0.001, 0.13, [0.0, 0.0185, 0.0], 0xe9e2cf);                                        // paper liner
    for (const [x, z, c, r] of [[-0.09, -0.03, 0xc8202a, 0.1], [0.07, 0.0, 0xf2c21b, -0.12]]) { b.box('paper', 0.12, 0.045, 0.1, [x, 0.043, z], c, [0, r, 0], 0.01); b.box('paper', 0.12, 0.012, 0.1, [x, 0.07, z - 0.005], c, [0.25, r, 0], 0.005); }
    b.lathe('paper', [[0.0, 0], [0.026, 0], [0.034, 0.12], [0.036, 0.12], [0.0, 0.12]], [0.14, 0.07, -0.05], 0xf2f2f2); b.lathe('paper', [[0.0, 0], [0.0285, 0.03], [0.0305, 0.07], [0.0, 0.07]], [0.14, 0.0765, -0.05], 0xc8202a); b.cyl('plastic', 0.0025, 0.0025, 0.07, [0.145, 0.18, -0.05], 0xe03a3a, [0.12, 0, 0.1], 6);
    b.box('paper', 0.075, 0.1, 0.03, [-0.14, 0.065, 0.085], 0xf2c21b, [0, 0.4, 0], 0.003); b.box('paper', 0.06, 0.06, 0.02, [0.02, 0.05, 0.1], 0xd8a838, [0, -0.3, 0]);
    return { b, mode: 'level', pose: 'flat', offPose: 'open', nat: NAT.flat, lev: LEV.up, grip: [0, -0.015, 0.0] };
  },
  clipboard: () => {
    const b = new PB(); b.box('wood', 0.23, 0.32, 0.012, [0.09, 0.1, 0], 0x8a6a3e, null, 0.004); b.box('metal', 0.07, 0.04, 0.02, [0.09, 0.26, 0.004], 0xb4b8be, null, 0.004); b.box('metal', 0.03, 0.008, 0.024, [0.09, 0.282, 0.004], 0x9a9ea4);
    const g = b.build(); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.205, 0.27), texMat('paper', paperTex())); p.position.set(0.09, 0.09, 0.0066); g.add(p); g.userData.geos.push(p.geometry);
    return { g, mode: 'level', pose: 'carry', nat: NAT.board, lev: LEV.chest, grip: [0, -0.04, 0] };
  },
  folder: () => {
    const b = new PB(); b.box('paper', 0.235, 0.31, 0.01, [0.08, 0.1, 0], 0xd8b25c, null, 0.002); b.box('paper', 0.09, 0.025, 0.012, [0.15, 0.2665, 0], 0xcfa44a); b.box('paper', 0.2, 0.28, 0.006, [0.085, 0.115, 0.0], 0xf3f0e6); b.box('paper', 0.235, 0.31, 0.006, [0.08, 0.1, 0.011], 0xe0bc68);
    return { b, mode: 'level', pose: 'carry', nat: NAT.board, lev: LEV.chest, grip: [0, -0.04, 0] };
  },
  glass: () => { const b = new PB(); b.lathe('glass', [[0.0, -0.055], [0.027, -0.055], [0.0285, -0.05], [0.033, 0.055], [0.0, 0.055]].map((p, i) => p), [0, 0, 0], 0xcfe6f0, null, 20); b.lathe('liquid', [[0, -0.045], [0.026, -0.045], [0.03, 0.02], [0.0, 0.02]], [0, 0, 0], 0xd8903a, null, 18); b.box('glass', 0.018, 0.018, 0.018, [0.005, 0.015, 0.003], 0xe8f4ff, [0.4, 0.5, 0.2], 0.003); return { b, mode: 'hybrid', pose: 'hold_cup', nat: NAT.cyl, lev: LEV.up, grip: [0, -0.045, 0] }; },
  bottle: () => {
    const b = new PB(); b.lathe('glass', [[0, -0.11], [0.0295, -0.11], [0.0325, -0.1], [0.0325, 0.02], [0.027, 0.06], [0.0125, 0.1], [0.0125, 0.15], [0.0135, 0.153], [0.0, 0.153]], [0, 0, 0], 0x5a3414, null, 18);
    b.cyl('matte', 0.0332, 0.0332, 0.075, [0, -0.04, 0], 0xe8dfc4, null, 18); b.cyl('matte', 0.0334, 0.0334, 0.03, [0, -0.04, 0], 0xb02a2a, null, 18); b.cyl('metal', 0.0142, 0.0142, 0.012, [0, 0.151, 0], 0xc8b060, null, 12);
    return { b, mode: 'hybrid', pose: 'hold_cup', nat: NAT.cyl, lev: LEV.up, grip: [0, -0.05, 0] };
  },
  cup: () => { const b = new PB(); b.lathe('paper', [[0, -0.065], [0.03, -0.065], [0.0395, 0.065], [0.0, 0.065]], [0, 0, 0], 0xf4f4f4, null, 18); b.lathe('paper', [[0.0305, -0.03], [0.0385, 0.03], [0.0395, 0.03], [0.0315, -0.03]], [0, 0, 0], 0xc8202a, null, 18); b.lathe('plastic', [[0.0, 0.065], [0.0415, 0.065], [0.0415, 0.072], [0.03, 0.074], [0.0, 0.078]], [0, 0, 0], 0x2a2a2a, null, 18); b.cyl('plastic', 0.0025, 0.0025, 0.1, [0.008, 0.115, 0.004], 0xf2f2f2, [0.05, 0, -0.06], 6); return { b, mode: 'hybrid', pose: 'hold_cup', nat: NAT.cyl, lev: LEV.up, grip: [0, -0.02, 0] }; },
  mic: () => { const b = new PB(); b.cyl('matte', 0.0135, 0.0125, 0.14, [0, -0.01, 0], 0x1b1d20); b.cyl('metal', 0.0145, 0.0145, 0.012, [0, 0.062, 0], 0xb8bcc2); b.sph('metal', 0.028, 0.032, 0.028, [0, 0.092, 0], 0x4a4e54, 14); b.torus('metal', 0.028, 0.0035, [0, 0.092, 0], 0xc8ccd2, [Math.PI / 2, 0, 0]); b.cyl('rubber', 0.015, 0.015, 0.02, [0, -0.085, 0], 0x111111); return { b, mode: 'hybrid', pose: 'hold_cup', nat: NAT.cyl, lev: LEV.mic, grip: [0, -0.03, 0] }; },
  radio: () => { const b = new PB(); b.box('plastic', 0.052, 0.125, 0.03, [0, 0.01, 0], 0x1e2024, null, 0.008); b.cyl('rubber', 0.0045, 0.004, 0.1, [-0.016, 0.115, 0], 0x111111); b.box('rubber', 0.024, 0.05, 0.004, [0, 0.03, 0.0155], 0x2d2f33); b.box('plastic', 0.012, 0.03, 0.012, [0.031, 0.04, 0.0], 0xc43a2a, null, 0.003); b.cyl('plastic', 0.007, 0.007, 0.012, [0.012, 0.075, 0.0], 0x777777); const g = b.build(); const d = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.026), texMat('radio', radioTex(), { emissive: 0xffffff, emissiveMap: radioTex(), emissiveIntensity: 1.4 })); d.position.set(0, 0.06, 0.0155); g.add(d); g.userData.geos.push(d.geometry); return { g, mode: 'hybrid', pose: 'hold_cup', nat: NAT.cyl, lev: LEV.mic, grip: [0, -0.02, 0] }; },
  binoculars: () => { const b = new PB(); for (const s of [-1, 1]) { b.cyl('matte', 0.03, 0.03, 0.13, [s * 0.036, 0.0, 0.03], 0x1a1c20, [Math.PI / 2, 0, 0], 18); b.cyl('rubber', 0.034, 0.034, 0.05, [s * 0.036, 0.0, 0.1], 0x111214, [Math.PI / 2, 0, 0], 18); b.cyl('glass', 0.027, 0.027, 0.003, [s * 0.036, 0.0, 0.126], 0x7a60c0, [Math.PI / 2, 0, 0], 18); b.cyl('rubber', 0.016, 0.02, 0.03, [s * 0.036, 0.0, -0.055], 0x111214, [Math.PI / 2, 0, 0], 14); } b.box('matte', 0.04, 0.02, 0.07, [0, 0.0, 0.03], 0x24272c, null, 0.005); b.cyl('metal', 0.012, 0.012, 0.03, [0, 0.026, 0.035], 0x888c92, null, 10); return { b, mode: 'natural', pose: 'hold_cup', nat: NAT.cyl, lev: LEV.up, grip: [0, -0.025, 0] }; },
  flashlight: () => { const b = new PB(); b.cyl('rubber', 0.018, 0.016, 0.115, [0, -0.045, 0], 0x1b1d20); b.box('plastic', 0.04, 0.045, 0.06, [0, 0.03, 0.01], 0x2a2d31, null, 0.01); b.cyl('metal', 0.034, 0.028, 0.06, [0, 0.036, 0.075], 0x2a2d31, [Math.PI / 2, 0, 0], 18); b.cyl('metal', 0.037, 0.037, 0.012, [0, 0.036, 0.108], 0x8a8e94, [Math.PI / 2, 0, 0], 18); b.cyl('glow', 0.028, 0.028, 0.004, [0, 0.036, 0.113], 0xfff6dc, [Math.PI / 2, 0, 0], 18); b.box('plastic', 0.012, 0.01, 0.02, [0, 0.058, 0.005], 0xc43a2a); const g = b.build({ glow: mat('glow') }); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.2, 20, 1, true), mat('beam')); cone.rotation.x = -Math.PI / 2; cone.position.set(0, 0.036, 0.113 + 0.6); cone.renderOrder = 3; cone.castShadow = false; g.add(cone); g.userData.geos.push(cone.geometry); return { g, mode: 'gun', pose: 'trigger', offPose: 'relaxed', nat: NAT.gun, lev: LEV.low, grip: [0, -0.05, 0] }; },
  scalpel: () => { const b = new PB(); b.box('metal', 0.012, 0.008, 0.125, [0, 0, -0.04], 0xc0c4ca, null, 0.002); b.box('metal', 0.007, 0.0035, 0.05, [0, -0.002, 0.065], 0xdfe3e8); b.box('metal', 0.003, 0.012, 0.034, [0, -0.007, 0.085], 0xeef2f6, [0.5, 0, 0]); return { b, mode: 'natural', pose: 'pinch', nat: NAT.gun, lev: LEV.up, grip: [0.005, -0.12, 0.022] }; },
  pen: () => { const b = new PB(); b.cyl('plastic', 0.0058, 0.0052, 0.12, [0, 0, -0.03], 0x1b3f7a, [Math.PI / 2, 0, 0], 8); b.cyl('metal', 0.0052, 0.0013, 0.025, [0, 0, 0.043], 0xc8ccd2, [Math.PI / 2, 0, 0], 8); b.box('metal', 0.002, 0.0015, 0.05, [0, 0.0062, -0.04], 0xc8ccd2); b.cyl('plastic', 0.0035, 0.0035, 0.012, [0, 0, -0.095], 0x111111, [Math.PI / 2, 0, 0], 8); return { b, mode: 'natural', pose: 'pinch', nat: NAT.gun, lev: LEV.up, grip: [0.005, -0.12, 0.022] }; },
  headset: () => { const b = new PB(); b.torus('plastic', 0.085, 0.006, [0, 0.04, 0], 0x1c1e22, [0, 0, 0], Math.PI, 28); for (const s of [-1, 1]) { b.cyl('plastic', 0.036, 0.036, 0.025, [s * 0.085, 0.04, 0], 0x222428, [0, 0, Math.PI / 2], 18); b.cyl('rubber', 0.032, 0.032, 0.008, [s * 0.1, 0.04, 0], 0x15161a, [0, 0, Math.PI / 2], 18); } b.cyl('plastic', 0.0035, 0.0035, 0.08, [0.1, -0.005, 0.03], 0x1c1e22, [Math.PI / 2 * 0.5, 0, 0], 6); b.sph('rubber', 0.008, 0.008, 0.012, [0.1, -0.03, 0.062], 0x111111, 8); return { b, mode: 'natural', pose: 'carry', nat: NAT.cyl, lev: LEV.up, grip: [0, -0.05, 0] }; },
  burgerbag: () => {
    const b = new PB(); b.box('paper', 0.15, 0.2, 0.095, [0, -0.11, 0], 0xb98a56, null, 0.006); b.box('paper', 0.15, 0.04, 0.095, [0, -0.005, 0], 0xa67845, [0.0, 0, 0.04], 0.004); b.box('paper', 0.11, 0.02, 0.012, [0, 0.025, 0], 0x9d6f40, [0, 0, 0.1]);
    const g = b.build(); const d = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshStandardMaterial({ map: decalTex('burger', 'BURGIE', '#f2c21b', '#c8202a'), transparent: true, alphaTest: 0.4, roughness: 0.8 })); d.position.set(0, -0.11, 0.0485); g.add(d); g.userData.geos.push(d.geometry); g.userData.own = [d.material];
    return { g, mode: 'level', pose: 'carry', nat: NAT.handle, lev: LEV.hang, grip: [0, -0.04, 0] };
  },
  toolbox: () => { const b = new PB(); b.box('metal', 0.42, 0.17, 0.19, [0, -0.145, 0], 0xb82a22, null, 0.01); b.box('metal', 0.43, 0.02, 0.2, [0, -0.07, 0], 0x8f1f1a); b.torus('metal', 0.05, 0.009, [0, -0.062, 0], 0x8a8e94, [0, 0, 0], Math.PI, 14); b.box('metal', 0.04, 0.03, 0.02, [0, -0.08, 0.098], 0xc8ccd2); b.box('metal', 0.43, 0.012, 0.012, [0, -0.145, 0.0961], 0x6e1712); return { b, mode: 'level', pose: 'carry', nat: NAT.handle, lev: LEV.hang, grip: [0, -0.04, 0] }; },
  briefcase: () => { const b = new PB(); b.box('leather', 0.43, 0.3, 0.11, [0, -0.2, 0], 0x4a2f1c, null, 0.02); b.box('leather', 0.44, 0.012, 0.115, [0, -0.2, 0], 0x3a2315); b.torus('leather', 0.05, 0.008, [0, -0.045, 0], 0x2a1a10, [0, 0, 0], Math.PI, 14); for (const s of [-1, 1]) b.box('metal', 0.04, 0.03, 0.012, [s * 0.14, -0.1, 0.057], 0xc8b060); b.box('metal', 0.035, 0.03, 0.012, [0, -0.15, 0.058], 0xc8b060); return { b, mode: 'level', pose: 'carry', nat: NAT.handle, lev: LEV.hang, grip: [0, -0.04, 0] }; },
  mop: () => { const b = new PB(); b.cyl('wood', 0.0125, 0.0125, 1.34, [0, -0.25, 0], 0xb48a54, null, 10); b.cyl('rubber', 0.016, 0.016, 0.16, [0, 0.38, 0], 0x2a2a2e, null, 10); b.box('plastic', 0.32, 0.03, 0.09, [0, -0.93, 0], 0x4a6a9a, null, 0.008); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; b.cyl('rubber', 0.002, 0.004, 0.17, [Math.cos(a) * 0.12, -1.01, Math.sin(a) * 0.03], 0xe4e4dc, [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.35], 4); } b.sph('rubber', 0.12, 0.05, 0.04, [0, -1.0, 0], 0xd6d6cc, 10); return { b, mode: 'hybrid', pose: 'grip_rifle', nat: NAT.cyl, lev: LEV.up, grip: [0, -0.05, 0] }; },
  megaphone: () => { const b = new PB(); b.lathe('plastic', [[0.035, -0.02], [0.05, 0.06], [0.08, 0.14], [0.11, 0.26], [0.105, 0.26], [0.076, 0.14], [0.046, 0.06], [0.03, -0.02]], [0, 0.05, 0.0], 0xe8e8e4, [Math.PI / 2, 0, 0], 22); b.torus('plastic', 0.108, 0.006, [0, 0.05, 0.31], 0xc8202a, null, Math.PI * 2, 24); b.box('plastic', 0.07, 0.06, 0.1, [0, 0.05, -0.02], 0x2a2c30, null, 0.01); b.box('rubber', 0.03, 0.1, 0.04, [0, -0.04, 0.0], 0x1a1c1f, [-0.15, 0, 0], 0.008); b.box('plastic', 0.012, 0.012, 0.024, [0, 0.005, 0.045], 0xc8202a); b.cyl('plastic', 0.026, 0.026, 0.04, [0, 0.12, -0.02], 0x3a3c40); return { b, mode: 'gun', pose: 'grip_rifle', offPose: 'relaxed', nat: NAT.gun, lev: LEV.low, grip: [0, -0.05, 0] }; },
};

// ---------------------------------------------------------------- orientation solver
const _qh = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _qn = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _f = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), _m = new THREE.Matrix4(), _ax = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function basisQ(ax, mirror, out) { // ax = [X,Y,Z] images; mirror => left-hand version of a right-hand mapping
  const [X, Y, Z] = ax;
  if (mirror) { _ax[0].set(X[0], X[1], X[2]); _ax[0].x = -_ax[0].x; _ax[0].negate(); _ax[1].set(-Y[0], Y[1], Y[2]); _ax[2].set(-Z[0], Z[1], Z[2]); } else { _ax[0].set(...X); _ax[1].set(...Y); _ax[2].set(...Z); }
  _m.makeBasis(_ax[0], _ax[1], _ax[2]); return out.setFromRotationMatrix(_m);
}

export function createProp(name, human, side = 'R') {
  const def = DEF[name]; if (!def) return null;
  const d = def(); const g = d.g || d.b.build();
  const obj = new THREE.Group(); obj.name = 'prop_' + name; obj.add(g);
  const m = side === 'L' ? -1 : 1, k = Math.max(0.7, (human.layout.dims.handL || 0.19) / 0.19);
  const grip = d.grip || [0, -0.05, 0];
  obj.position.set(m * (0.012 + grip[0]) * k, grip[1] * k, grip[2] * k);
  const qNat = basisQ(d.nat, side === 'L', new THREE.Quaternion()), qLev = basisQ(d.lev, false, new THREE.Quaternion());
  obj.quaternion.copy(qNat);
  const S = side === 'L' ? 'L' : 'R', mode = d.mode, anchors = d.anchors;
  const pr = {
    name, obj, pose: d.pose, offPose: d.offPose || null, anchors: anchors ? Object.fromEntries(Object.entries(anchors).map(([key, v]) => [key, v.clone()])) : undefined, mode,
    update(dt, t, h) {
      if (mode === 'natural') return;
      const bones = h.rig.bones, hb = bones['hand' + S]; hb.updateWorldMatrix(true, false); hb.matrixWorld.decompose(_p, _qh, _s);
      const chest = bones.chest; chest.matrixWorld.decompose(_h, _qc, _s); _f.set(0, 0, 1).applyQuaternion(_qc); _qy.setFromAxisAngle(_s.set(0, 1, 0), Math.atan2(_f.x, _f.z));
      _d.set(0, -1, 0).applyQuaternion(_qh);                       // fingers direction in the world
      let w = 1;
      if (mode === 'level') w = 1;
      else if (mode === 'phone') { const hd = bones.head; hd.matrixWorld.decompose(_h, _qc, _s); w = smooth(0.22, 0.42, _h.distanceTo(_p)); }
      else w = smooth(-0.55, -0.9, _d.y);                       // hybrid / gun: only when the hand hangs
      if (w < 0.001) { obj.quaternion.copy(qNat); return; }
      _qh.invert(); _qt.copy(_qy).multiply(qLev); _qt.premultiply(_qh); // local = hand^-1 * target
      obj.quaternion.copy(qNat).slerp(_qt, w);
    },
    dispose() { for (const gg of (g.userData.geos || [])) gg.dispose(); for (const mm of (g.userData.own || [])) mm.dispose(); },
  };
  return pr;
}
