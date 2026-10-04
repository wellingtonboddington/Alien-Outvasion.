// createAlienInterior(kind) — Vessari mothership interiors: 'corridor' | 'bridge' | 'hatchery' | 'hold'
import * as THREE from 'three';
import { createKit } from './kit.js';
import { alienMats } from './alien_mats.js';
import { lumpGeo, vaultGeo, endWallGeo, ribGeo, petalGeo, fxMesh } from './alien_geo.js';
import { drawGlyphs, drawWorldMap, drawEarth, SANS, MONO } from './draw.js';
import { tf, sstep, clamp01 } from './tex.js';
import { TAU, RNG, seg, Q } from '../../../engine/common.js';
import { noise3 } from '../../../engine/proc.js';
import { cable } from './props.js';
import { holoSphere } from './holo.js';

const CYAN = new THREE.Color(0x46e6ff), GREEN = new THREE.Color(0x4cff22);
const ang = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);

/** infection of whole alien set: shader materials (via kit) + real lights + additive fx tint */
function alienInfect(k, a) {
  k.setInfection(a);
  for (const l of k.lights) if (l.userData.alienTint) l.color.copy(l.userData.alienTint).lerp(GREEN, a * 0.85);
  const tint = (m) => { const b = m.userData.fxBase; if (!b) return; const lum = b.r * 0.3 + b.g * 0.55 + b.b * 0.15; m.color.copy(b).lerp(_c.setRGB(0.25 * lum * 1.7, lum * 1.9, 0.08 * lum * 1.7), a); };
  const _c = new THREE.Color();
  for (const m of k.customMats.values()) tint(m);
  for (const m of k._fxMeshes || []) { if (m.userData.fxBase) m.uniforms.uColor.value.copy(m.userData.fxBase).lerp(GREEN, a * 0.9); }
}

/** ring/iris door: leaves are dynamic. returns {group, set(open)} */
function iris(k, N, [x, y, z], R, { leaves = 8, open = 0.3, ry = 0, mat = N.shell } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; k.dyn.add(grp); const m = k.mat(mat); const geo = petalGeo(R * 0.98, R * 0.9, R * 0.12, 0.16, 0.12); const L = [];
  for (let i = 0; i < leaves; i++) { const a = i / leaves * TAU; const g = new THREE.Group(); g.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); g.rotation.z = a + Math.PI / 2; const mesh = new THREE.Mesh(geo, m); mesh.position.z = (i % 2) * 0.05; g.add(mesh); grp.add(g); L.push({ g, a }); }
  const set = (o) => { for (const { g, a } of L) { g.position.set(Math.cos(a) * (R + o * R * 0.18), Math.sin(a) * (R + o * R * 0.18), 0); g.children[0].rotation.x = -o * 1.05; } };
  set(open); return { group: grp, set };
}

/** wall/ceiling tendon cluster between two points (organic twisting rope of 2-4 strands) */
function tendonBundle(k, N, a, b, { strands = 3, r = 0.07, sag = 0.4, twist = 0.14, seed = 1 } = {}) {
  const rng = new RNG(seed * 131 + 7); const n = 9;
  for (let s = 0; s < strands; s++) {
    const pts = [], ph = rng.range(0, TAU), rr = r * rng.range(0.75, 1.25);
    for (let i = 0; i <= n; i++) { const t = i / n; const sg = Math.sin(t * Math.PI) * sag; const tw = twist * Math.sin(t * Math.PI);
      pts.push([a[0] + (b[0] - a[0]) * t + Math.cos(ph + t * 9) * tw, a[1] + (b[1] - a[1]) * t - sg + Math.sin(ph + t * 9) * tw, a[2] + (b[2] - a[2]) * t]); }
    k.tubeAlong(N.tendon, pts, rr, { seg: 6, perPoint: 3, vs: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.7 });
  }
}

function lightOrgan(k, N, x, y, z, s = 1, cord = 0.8) {
  k.part(N.membrane, lumpGeo(Math.round(x * 10 + z), { rx: 0.2, ry: 0.36, rz: 0.2, amp: 0.15, w: 12, h: 8 }), [x, y, z], { scale: s });
  k.rod(N.tendon, [x, y + 0.3 * s, z], [x, y + cord, z], 0.03 * s, { seg: 5 });
}

// =====================================================================================================
function buildCorridor(k, N) {
  const z0 = -24, z1 = 24, rx = 3.5, ry = 3.3, cy = 2.3, period = 2.4, off = z0 + 1.2;
  const glow = (z, th, bump, st) => { const wall = sstep(0.7, 0.05, st), bay = Math.pow(1 - bump, 1.3), spine = Math.exp(-Math.pow((th - Math.PI / 2) / 0.09, 2)); return clamp01(wall * bay + spine * 0.8 + 0.1 * bay); };
  k.part(N.vault, vaultGeo({ z0, z1, rx, ry, cy, th0: -0.76, th1: Math.PI + 0.76, period, offset: off, rw: 0.42, depth: 0.05, wob: 0.055, seed: 3, glowFn: glow, dz: 0.5 }));
  for (let z = off; z <= z1 - 0.5; z += period) k.part(N.shell, ribGeo({ z, rx, ry, cy, th0: -0.74, th1: Math.PI + 0.74, thick: [0.62, 0.3], inset: 0.14, seed: z * 0.1 }), [0, 0, 0], { us: 2, vs: 5, color: 0xffffff });
  // floor
  for (const s of [-1, 1]) { k.box(N.floor, [2.4, 0.3, L(z0, z1)], [s * 1.75, -0.15, 0], { tile: 3 }); k.box(N.shell, [0.1, 0.24, L(z0, z1)], [s * 0.62, -0.06, 0]); }
  k.box(N.floor, [1.2, 0.05, L(z0, z1)], [0, -0.24, 0]); k.box(k.glow(0x2ac8e8, 1.1), [0.7, 0.01, L(z0, z1)], [0, -0.2, 0], { mirror: false });
  for (let z = off + period / 2; z < z1; z += period) { k.box(N.shell, [4.8, 0.04, 0.55], [0, 0.015, z], { tile: 1.5 }); }
  // light organs & wall ports
  const rng = new RNG(5);
  for (let z = off + period / 2; z < z1 - 1; z += period) { lightOrgan(k, N, rng.range(-0.8, 0.8), 4.65 - rng.range(0, 0.3), z + rng.range(-0.3, 0.3), rng.range(0.8, 1.2), 0.7); }
  for (let z = off; z < z1; z += period) for (const s of [-1, 1]) { k.sph(N.glowDim, 0.16, [s * 3.02, 1.0, z + 0.4], { sx: 0.35, sy: 1.9, sz: 0.5, seg: 8 }); }
  // tendon garlands draped between ribs + trunk cables across the ceiling
  for (let z = off; z + period <= z1 - 0.1; z += period) for (const sd of [-1, 1]) for (const [th, h] of [[0.34, 0.2], [0.95, 0.42]]) {
    const ct = Math.cos(th), st = Math.sin(th), x = sd * rx * 0.9 * ct - sd * 0.28, y = cy + ry * 0.9 * st;
    tendonBundle(k, N, [x, y, z + 0.05], [x, y, z + period - 0.05], { strands: 2, r: 0.045 + 0.02 * ((z * 3) % 1), sag: h + 0.2 * (((z * 7) | 0) % 3), twist: 0.07, seed: z + th * 10 });
  }
  for (let i = 0; i < 7; i++) { const z = z0 + 4 + i * 6.5; tendonBundle(k, N, [-2.4, 3.9 - (i % 2) * 0.4, z], [2.4, 3.9 - ((i + 1) % 2) * 0.4, z + 0.8], { strands: 3, r: 0.06, sag: 0.55, seed: i }); }
  // end wall + iris door + back-glow
  k.part(N.flesh, endWallGeo({ rx, ry, cy, th0: -0.82, th1: Math.PI + 0.82, hole: { hx: 1.9, y0: 0, y1: 2.6, ay: 1.6 }, z: z0 + 0.05 }));
  k.sph(N.glowWhite, 4, [0, 2.4, z0 - 0.9], { sx: 0.7, sy: 0.9, sz: 0.2, seg: 16 });
  const door = iris(k, N, [0, 2.4, z0 + 0.35], 2.5, { open: 0.45, leaves: 8 });
  // fx
  const drips = []; for (let i = 0; i < 16; i++) drips.push([rng.range(-1.6, 1.6), 4.7 - Math.abs(rng.range(-1.6, 1.6)) * 0.2, rng.range(z0 + 2, z1 - 2)]); fxMesh(k, drips, { kind: 'drip', fall: 4.6, size: 0.05, color: 0x6ae8ff, a: 1.0, speed: 0.22, seed: 2 });
  const spores = []; for (let i = 0; i < 40; i++) spores.push([rng.range(-2.4, 2.4), rng.range(0.1, 2), rng.range(z0 + 1, z1 - 1)]); fxMesh(k, spores, { kind: 'steam', fall: 3.2, size: 0.12, color: 0x2a9ab8, a: 0.5, speed: 0.07, seed: 4 });
  for (let z = off + period / 2; z < z1; z += period * 2) k.pool(0, z, 2.6, 0x2ab8d8, 0.16, 0.03);
  // lights
  const L1 = k.light(new THREE.PointLight(0x7ae6ff, 55, 26, 1.4), 'cyanA'); L1.position.set(0, 3.7, -6); L1.userData.alienTint = new THREE.Color(0x7ae6ff);
  const L2 = k.light(new THREE.PointLight(0x8af0ff, 14, 14, 1.6), 'doorGlow'); L2.position.set(0, 2.4, z0 + 3.5); L2.userData.alienTint = new THREE.Color(0x8af0ff);
  const H = k.light(new THREE.HemisphereLight(0x4a9ab8, 0x0a1418, 1.5), 'hemi'); H.userData.alienTint = new THREE.Color(0x3a8aa8);
  k.anchor('start', [0, 0.05, 20], Math.PI).anchor('mid', [0, 0.05, 0], Math.PI).anchor('door', [0, 0.05, z0 + 3.5], 0).anchor('walkA', [-0.9, 0.05, 14], Math.PI).anchor('walkB', [0.9, 0.05, 14], Math.PI)
    .anchor('camAlong', [0, 1.7, 23], Math.PI).anchor('camLow', [0, 0.5, 14], Math.PI).anchor('camDoor', [0, 1.6, z0 + 7], 0).anchor('camSide', [2.1, 1.6, 3], -2.3).anchor('camHigh', [0, 4.2, 22], Math.PI);
  return { door, bounds: { w: 7, d: 48, h: 5.8 } };
}
const L = (a, b) => b - a;


// ---------- space view for windows ----------
export function drawSpaceView(ctx, w, h, t, S = {}, o = {}) {
  ctx.fillStyle = '#01030a'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 520; i++) { const x = hash(i, 1) * w, y = hash(i, 2) * h; const b = 0.3 + 0.7 * hash(i, 3); const tw = 0.75 + 0.25 * Math.sin(t * (1 + hash(i, 4) * 3) + i); ctx.fillStyle = `rgba(${200 + 55 * hash(i, 5) | 0},${210 + 45 * hash(i, 6) | 0},255,${b * tw})`; const s = hash(i, 7) < 0.04 ? 2.2 : 1.1; ctx.fillRect(x, y, s, s); }
  const R = h * (o.R ?? 1.45), cx = w * (o.cx ?? 0.55), cy = h * (o.top ?? 0.55) + R;
  drawEarth(ctx, cx, cy, R, t, { res: Q.level === 0 ? 260 : Q.level === 1 ? 560 : 800, lon: o.lon ?? 105, spin: 0.01, clipTop: 0, clipBottom: h });
  const g2 = ctx.createRadialGradient(cx + R * 0.9, cy - R * 0.5, 0, cx + R * 0.9, cy - R * 0.5, h * 0.5); g2.addColorStop(0, 'rgba(255,245,220,0.55)'); g2.addColorStop(0.2, 'rgba(255,230,190,0.15)'); g2.addColorStop(1, 'rgba(255,230,190,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  if (S.infect > 0.2) { ctx.fillStyle = `rgba(60,255,26,${0.14 * S.infect})`; ctx.fillRect(0, 0, w, h); }
}
const hash = (i, s) => { let x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

function buildBridge(k, N) {
  const z0 = -30, z1 = 30, rx = 24, ry = 19, cy = 3, period = 5, off = z0 + 2.5, TH = 0.2;
  const glow = (z, th, bump, st) => { const wall = sstep(0.62, 0.05, st), bay = Math.pow(1 - bump, 1.2), spine = Math.exp(-Math.pow((th - Math.PI / 2) / 0.05, 2)); return clamp01(wall * bay * 0.9 + spine * 0.7 + 0.1 * bay); };
  k.part(N.vault, vaultGeo({ z0, z1, rx, ry, cy, th0: -TH, th1: Math.PI + TH, period, offset: off, rw: 0.9, depth: 0.04, wob: 0.045, seed: 7, glowFn: glow, dz: 1.0, dth: 0.045 }));
  for (let z = off; z <= z1 - 1; z += period) k.part(N.shell, ribGeo({ z, rx, ry, cy, th0: -TH, th1: Math.PI + TH, thick: [1.25, 0.6], inset: 0.5, seed: z * 0.07, n: 40 }), [0, 0, 0], { us: 3, vs: 14 });
  for (let z = off + period / 2; z <= z1 - 1; z += period) k.part(N.shell, ribGeo({ z, rx, ry, cy, th0: -TH, th1: Math.PI + TH, thick: [0.4, 0.2], inset: 0.4, seed: z * 0.11, n: 32 }), [0, 0, 0], { us: 2, vs: 10 });
  // floor
  k.box(N.floor, [50, 0.4, 62], [0, -0.2, 0], { tile: 5 });
  const D = [0, -19];
  // window wall + window
  k.part(N.vault, endWallGeo({ rx, ry, cy, th0: -TH, th1: Math.PI + TH, hole: { hx: 17, y0: 3.4, y1: 11, ay: 7 }, z: z0 + 0.1 }));
  const win = k.screen({ name: 'window', w: 36, h: 16.4, draw: (c, w, h, t, S) => drawSpaceView(c, w, h, t, S), fps: 4, res: [1024, 470], k: 1.5, rough: 1, mirror: false }, [0, 10.8, z0 - 0.15]);
  // window frame: arch tube + mullions + sill
  { const pts = []; const hx = 17, y1 = 11, ay = 7; pts.push([-hx, 3.2, z0 + 0.5], [-hx, y1, z0 + 0.5]); for (let i = 1; i < 16; i++) { const a = i / 16 * Math.PI; pts.push([-hx * Math.cos(a), y1 + ay * Math.sin(a), z0 + 0.5]); } pts.push([hx, y1, z0 + 0.5], [hx, 3.2, z0 + 0.5]); k.tubeAlong(N.shell, pts, 0.7, { seg: 10, perPoint: 3, us: 2, vs: 12 }); }
  for (const x of [-12, -6, 0, 6, 12]) { const top = 11 + 7 * Math.sqrt(Math.max(0, 1 - (x / 17) ** 2)); k.tubeAlong(N.shell, [[x * 1.05, 3.2, z0 + 1.2], [x * 1.0, top * 0.5, z0 + 0.6], [x * 0.98, top, z0 + 0.6]], 0.34 + (x === 0 ? 0.06 : 0), { seg: 8, perPoint: 8, us: 2, vs: 8 }); }
  for (const x of [-12, -6, 0, 6, 12]) k.sph(N.glowCyan, 0.2, [x * 1.05, 3.4, z0 + 1.4], { seg: 8 });
  k.part(N.shell, lumpGeo(2, { rx: 18, ry: 0.55, rz: 1.1, amp: 0.05, w: 40, h: 8 }), [0, 3.3, z0 + 1.2]);
  // dais + throne (built in dais-local space, scaled up for presence)
  const S = 1.4, tz = -1.6, ty = 2.1;
  k.push(D[0], 0, D[1], 0, 0, 0, S);
  const tiers = [[10.5, 0.45], [8.6, 0.95], [6.8, 1.55], [5.2, 2.05]];
  tiers.forEach(([r, h], i) => { k.cyl(i % 2 ? N.shellB : N.shell, [r, r * 1.02, h], [0, h / 2 - 0.02, 0], { seg: 56, uv: 'box', tile: 2.6 }); k.part(N.glowDim, new THREE.RingGeometry(r - 0.2, r - 0.08, 64), [0, h + 0.005 - 0.02, 0], { rx: -Math.PI / 2 }); });
  k.cyl(N.floor, [4.6, 4.6, 0.1], [0, 2.1, 0], { seg: 48, uv: 'box', tile: 3 });
  k.part(N.glowCyan, new THREE.RingGeometry(4.0, 4.1, 64), [0, 2.17, 0], { rx: -Math.PI / 2 });
  k.part(N.shell, lumpGeo(3, { rx: 1.5, ry: 0.55, rz: 1.35, amp: 0.1 }), [0, ty + 0.5, tz], {});
  k.part(N.flesh, lumpGeo(4, { rx: 1.15, ry: 0.35, rz: 1.0, amp: 0.1 }), [0, ty + 1.0, tz + 0.1], {});
  k.part(N.shell, lumpGeo(5, { rx: 1.7, ry: 3.4, rz: 0.45, amp: 0.07 }), [0, ty + 3.4, tz - 1.0], { rx: -0.1 });
  k.part(N.flesh, lumpGeo(6, { rx: 1.2, ry: 2.6, rz: 0.3, amp: 0.08 }), [0, ty + 3.2, tz - 0.62], { rx: -0.1 });
  for (let i = 0; i < 13; i++) { const a2 = (i / 12 - 0.5) * 2.7, len = 8.5 + 2.6 * Math.cos(a2 * 1.5) - Math.abs(i - 6) * 0.15; const base = [Math.sin(a2) * 1.3, ty + 3.4, tz - 1.25]; const tip = [Math.sin(a2) * (len * 0.8), ty + 3.4 + Math.cos(a2) * len, tz - 1.5 - Math.abs(a2) * 0.9]; k.tubeAlong(N.shell, [base, [(base[0] + tip[0]) * 0.5 + Math.sin(a2) * 0.25, (base[1] + tip[1]) * 0.5, tz - 1.35 - Math.abs(a2) * 0.3], tip], 0.2, { seg: 6, perPoint: 8, us: 1, vs: 4, r2: 0.01 }); k.sph(N.glowCyan, 0.1, tip, { seg: 6 }); }
  for (const s of [-1, 1]) { k.part(N.shell, lumpGeo(8 + s, { rx: 0.35, ry: 0.28, rz: 1.1, amp: 0.1 }), [s * 1.55, ty + 1.45, tz + 0.2], {}); k.tubeAlong(N.shell, [[s * 1.5, ty + 1.2, tz - 0.8], [s * 1.95, ty + 1.8, tz + 0.5], [s * 1.8, ty + 1.5, tz + 1.3]], 0.1, { seg: 6, perPoint: 6, vs: 3 }); k.sph(N.glowCyan, 0.09, [s * 1.8, ty + 1.52, tz + 1.35], { seg: 6 }); }
  // tendons feeding the throne from the floor
  for (const s of [-1, 1]) for (let q = 0; q < 3; q++) tendonBundle(k, N, [s * (5.5 + q * 1.2), 2.0, 1.5 + q], [s * 1.6, ty + 0.9, tz - 0.4], { strands: 2, r: 0.12, sag: -0.3, twist: 0.25, seed: q + s * 3 });
  k.pop();
  const hw = (x, y, z) => [D[0] + x * S, y * S, D[1] + z * S];
  const halo = new THREE.Mesh(new THREE.TorusGeometry(3.6 * S, 0.1 * S, 8, 80), k.mat(N.glowCyan)); halo.position.set(...hw(0, ty + 6.3, tz - 1.9)); k.dyn.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.9 * S, 0.05 * S, 8, 64), k.mat(N.glowCyan)); halo2.position.copy(halo.position); k.dyn.add(halo2);
  // columns
  for (const [x, z] of [[-15.5, -22], [15.5, -22], [-16.5, -8], [16.5, -8], [-16.5, 8], [16.5, 8], [-15.5, 22], [15.5, 22]]) {
    const prof = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * 21; prof.push([0.85 + 0.3 * Math.sin(y * 0.8 + x) * 0.5 + 0.35 * Math.exp(-Math.pow((y % 5 - 0.6) / 0.5, 2)) + (1 - i / 24) * 0.55 + (i > 20 ? (i - 20) * 0.3 : 0), y]); }
    k.lathe(N.shell, prof, [x, 0, z], { seg: 14, us: 2, vs: 9 });
    k.part(N.glowDim, new THREE.CylinderGeometry(0.1, 0.1, 15, 6), [x * 0.97, 8, z + 1.0], {});
  }
  // consoles around the dais, facing it
  const feeds = ['text', 'hud', 'star'].map((kind, i) => k.feed('glyph' + kind, (c, w, h, t, S) => drawGlyphs(c, w, h, t, S, { kind, seed: i + 1 }), { res: [384, 256], fps: 10 }));
  const cons = []; let ci = 0;
  for (const [R, angs] of [[16.5, [-1.15, -0.85, -0.55, -0.28, 0.28, 0.55, 0.85, 1.15]], [21.5, [-0.9, -0.65, -0.4, 0.4, 0.65, 0.9]]]) for (const a of angs) {
    const x = D[0] + Math.sin(a) * R, z = D[1] + Math.cos(a) * R, yaw = a + Math.PI; ci++;
    k.push(x, 0, z, yaw);
    k.part(N.flesh, lumpGeo(20 + ci, { rx: 1.05, ry: 0.7, rz: 0.85, amp: 0.12 }), [0, 0.62, 0], {});
    k.part(N.shell, lumpGeo(40 + ci, { rx: 0.95, ry: 0.16, rz: 0.75, amp: 0.1 }), [0, 1.18, 0.12], { rx: -0.32 });
    for (let i = 0; i < 6; i++) k.sph(i % 3 ? N.glowCyan : N.glowWhite, 0.04 + 0.01 * (i % 2), [-0.55 + i * 0.22, 1.28 - 0.05 * Math.abs(i - 2.5), 0.28 + 0.08 * (i % 2)], { seg: 6 });
    for (const s of [-1, 1]) k.tubeAlong(N.tendon, [[s * 0.75, 0.8, -0.2], [s * 1.15, 1.15, -0.1], [s * 1.2, 1.6, 0.25]], 0.05, { seg: 5, perPoint: 5, vs: 3 }), k.sph(N.glowCyan, 0.07, [s * 1.2, 1.62, 0.25], { seg: 6 });
    const scr = k.screen({ name: 'holo' + ci, w: 2.3, h: 1.55, feed: feeds[ci % 3], additive: true, k: 1.15, mirror: false }, [0, 2.25, 0.2], { rx: -0.22 });
    k.pop(); k.blob(x, z, 3, 2.4, 0.02); cons.push({ x, z, yaw, scr }); k.anchor('op' + (ci - 1), [x + Math.sin(yaw) * 0.0 - Math.sin(yaw) * 1.6 * -1 * 0, 0, z], yaw);
  }
  // fix operator stand positions: behind each console (further from dais)
  cons.forEach((c, i) => { const a = Math.atan2(c.x - D[0], c.z - D[1]); const p = [c.x + Math.sin(a) * 1.5, 0.05, c.z + Math.cos(a) * 1.5]; k.anchor('op' + i, p, c.yaw); });
  // central star-map hologram
  k.cyl(N.shell, [1.7, 2.1, 0.5], [0, 0.25, 4], { seg: 28 }); k.cyl(N.shellB, [1.2, 1.5, 0.5], [0, 0.7, 4], { seg: 28 }); k.part(N.glowCyan, new THREE.RingGeometry(1.15, 1.25, 48), [0, 0.96, 4], { rx: -Math.PI / 2 });
  const holo = holoSphere(k, 1.25, [0, 2.5, 4]);
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.7 + i * 0.3, 0.02, 6, 80), k.mat(N.glowCyan)); r.position.set(0, 2.5, 4); k.dyn.add(r); return r; });
  k.shaft([0, 1.0, 4], [0, 4.2, 4], 0.8, 1.6, 0x46e6ff, 0.12);
  // alcoves along both walls with attendants' cradles
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
    const z = -11 + i * 6.4, x = s * 22.8;
    k.push(x, 0, z, -s * Math.PI / 2);
    k.box(N.membrane, [3.4, 5.2, 0.12], [0, 3.1, 0.3], { glow: 1, uv: 'box', tile: 3 });
    const pts = []; pts.push([-2.0, 0.2, 0.6]); pts.push([-2.0, 4.6, 0.6]); for (let q = 1; q < 12; q++) { const a = q / 12 * Math.PI; pts.push([-2.0 * Math.cos(a), 4.6 + 1.9 * Math.sin(a), 0.6]); } pts.push([2.0, 4.6, 0.6], [2.0, 0.2, 0.6]);
    k.tubeAlong(N.shell, pts, 0.32, { seg: 8, perPoint: 2, us: 2, vs: 10 });
    k.part(N.shellB, lumpGeo(60 + i, { rx: 1.25, ry: 0.22, rz: 1.0, amp: 0.1 }), [0, 0.25, 1.3], {});
    for (const q of [-1, 1]) k.tubeAlong(N.shell, [[q * 1.1, 0.2, 1.8], [q * 1.4, 1.4, 2.2], [q * 0.9, 2.6, 2.0]], 0.09, { seg: 6, perPoint: 6, vs: 3 });
    k.pop(); k.anchor(`alcove${s < 0 ? 'L' : 'R'}${i}`, [s * 20.2, 0, z], s * Math.PI / 2 * -1 + Math.PI);
  }
  // hanging light organs & tendon curtains
  const rng = new RNG(31);
  for (let i = 0; i < 16; i++) { const x = rng.range(-14, 14), z = rng.range(-26, 26), hh = rng.range(12, 17); const sz = rng.range(0.8, 1.5); k.part(N.membrane, lumpGeo(70 + i, { rx: 0.5, ry: 0.85, rz: 0.5, amp: 0.15 }), [x, hh, z], { scale: sz }); k.rod(N.tendon, [x, hh + 0.8 * sz, z], [x * 0.97, 20.4 - Math.abs(x) * 0.1, z], 0.05, { seg: 5 }); k.shaft([x, hh, z], [x, hh - 5, z], 0.5 * sz, 1.4 * sz, 0x2ab8d8, 0.06); }
  for (let i = 0; i < 10; i++) { const x = rng.range(-18, 18), z = rng.range(-25, 25); tendonBundle(k, N, [x, 19.5 - Math.abs(x) * 0.07, z], [x + rng.range(-2, 2), 14, z + rng.range(-2, 2)], { strands: 3, r: 0.1, sag: 0.3, twist: 0.2, seed: i }); }
  // fx
  const spores = []; for (let i = 0; i < 90; i++) spores.push([rng.range(-20, 20), rng.range(0.1, 12), rng.range(-26, 26)]); fxMesh(k, spores, { kind: 'steam', fall: 4, size: 0.18, color: 0x2a9ab8, a: 0.35, speed: 0.04, seed: 9 });
  const drips = []; for (let i = 0; i < 18; i++) drips.push([rng.range(-10, 10), 19, rng.range(-20, 20)]); fxMesh(k, drips, { kind: 'drip', fall: 15, size: 0.06, color: 0x6ae8ff, a: 0.8, speed: 0.1, seed: 3 });
  // lights
  const Lw = k.light(new THREE.PointLight(0xc8e0ff, 200, 60, 1.3), 'windowGlow'); Lw.position.set(0, 9, -24); Lw.userData.alienTint = new THREE.Color(0xa8d4ff);
  const Lh = k.light(new THREE.PointLight(0x9ae8ff, 150, 55, 1.3), 'hallGlow'); Lh.position.set(0, 12, 2); Lh.userData.alienTint = new THREE.Color(0x9ae8ff);
  const H = k.light(new THREE.HemisphereLight(0x8aa6b8, 0x2a2218, 1.0), 'hemi'); H.userData.alienTint = new THREE.Color(0x8aa6b8);
  k.anchor('throne', hw(0, ty + 1.12, tz + 0.15), 0).anchor('hierarch', hw(0, 2.1, 2.2), 0).anchor('daisFront', [0, 0.05, D[1] + 15.5], Math.PI).anchor('attA', hw(-3.4, 2.1, 1.6), 0.3).anchor('attB', hw(3.4, 2.1, 1.6), -0.3)
    .anchor('camWide', [0, 3.2, 28.5], Math.PI).anchor('camThrone', [0, 4.6, -6.0], Math.PI).anchor('camThroneLow', [0, 1.4, -8.5], Math.PI).anchor('camReverse', [0, 9, -27], 0).anchor('camWindow', [0, 5, -4], Math.PI).anchor('camHigh', [-16, 12, 26], Math.PI + 0.55).anchor('camAisle', [0, 1.7, 22], Math.PI).anchor('holoTable', [0, 0.05, 4], 0);
  const spin = (dt, t) => { halo.rotation.z = t * 0.12; halo2.rotation.z = -t * 0.2; rings.forEach((r, i) => { r.rotation.x = t * (0.3 + i * 0.12) + i; r.rotation.y = t * (0.2 - i * 0.07); }); holo.mesh.rotation.y = 0; };
  k.onUpdate(spin);
  return { window: { mesh: win.mesh, screen: win, setTexture: (t) => win.setTexture(t), setCanvas: (f, o) => win.setCanvas(f, o) }, holo, bounds: { w: 48, d: 60, h: 22 }, extraInfect: (a) => holo.setInfection(a) };
}

function buildHatchery(k, N) {
  const z0 = -34, z1 = 34, rx = 18, ry = 12, cy = 2.5, period = 4, off = z0 + 2, TH = 0.25;
  const glow = (z, th, bump, st) => clamp01(sstep(0.6, 0.05, st) * Math.pow(1 - bump, 1.2) * 0.8 + Math.exp(-Math.pow((th - Math.PI / 2) / 0.06, 2)) * 0.6 + 0.12 * (1 - bump));
  k.part(N.vault, vaultGeo({ z0, z1, rx, ry, cy, th0: -TH, th1: Math.PI + TH, period, offset: off, rw: 0.7, depth: 0.045, wob: 0.05, seed: 11, glowFn: glow, dz: 0.9, dth: 0.05 }));
  for (let z = off; z <= z1 - 1; z += period) k.part(N.shell, ribGeo({ z, rx, ry, cy, th0: -TH, th1: Math.PI + TH, thick: [0.95, 0.45], inset: 0.35, seed: z * 0.09, n: 36 }), [0, 0, 0], { us: 3, vs: 11 });
  k.box(N.floor, [40, 0.4, 70], [0, -0.2, 0], { tile: 5 });
  // raised central walkway with rails
  k.box(N.shellB, [3.8, 0.45, 68], [0, 0.225, 0], { tile: 2.5 }); k.box(N.floor, [3.2, 0.06, 68], [0, 0.48, 0], { tile: 3 });
  for (const s of [-1, 1]) { k.box(k.glow(0x3ae0ff, 1.4), [0.05, 0.03, 68], [s * 1.75, 0.5, 0], { mirror: false }); k.rod(N.shell, [s * 1.7, 1.45, z0], [s * 1.7, 1.45, z1], 0.07, { seg: 8 }); for (let z = z0 + 1; z <= z1; z += 3) { k.rod(N.shell, [s * 1.7, 0.45, z], [s * 1.78, 1.45, z], 0.07, { seg: 6 }); k.sph(N.glowCyan, 0.07, [s * 1.78, 1.5, z], { seg: 6 }); } }
  const rng = new RNG(41); const eggs = [];
  // egg rows
  const eggGeo = lumpGeo(5, { rx: 0.9, ry: 1.35, rz: 0.9, amp: 0.05, w: 14, h: 10 });
  const embGeo = lumpGeo(6, { rx: 0.36, ry: 0.5, rz: 0.32, amp: 0.1, w: 10, h: 8 }), headGeo = lumpGeo(7, { rx: 0.22, ry: 0.3, rz: 0.24, amp: 0.1, w: 10, h: 7 });
  let ei = 0;
  for (let z = z0 + 4; z <= z1 - 3; z += 4.4) for (const s of [-1, 1]) for (const cx of [5.3, 10.4]) {
    const x = s * (cx + rng.range(-0.4, 0.4)), zz = z + rng.range(-0.5, 0.5), sc = rng.range(0.85, 1.2); ei++;
    k.part(N.flesh, lumpGeo(30 + (ei % 5), { rx: 1.7, ry: 0.4, rz: 1.7, amp: 0.15, w: 12, h: 6 }), [x, 0.12, zz], { scale: sc });
    for (let q = 0; q < 4; q++) { const a = q * TAU / 4 + rng.range(0, 1); tendonBundle(k, N, [x + Math.cos(a) * 0.5, 0.35, zz + Math.sin(a) * 0.5], [x + Math.cos(a) * 2.3, 0.05, zz + Math.sin(a) * 2.3], { strands: 1, r: 0.09, sag: -0.1, twist: 0.05, seed: ei * 5 + q }); }
    k.cyl(N.flesh, [0.26 * sc, 0.45 * sc, 1.0 * sc], [x, 0.7 * sc, zz], { seg: 8 });
    const ey = (0.95 + 1.35) * sc, g = rng.next(); const e = { x, y: ey, z: zz, sc };
    k.part(N.embryo, embGeo, [x, ey - 0.15 * sc, zz], { scale: sc * 0.95, rx: 0.6, ry: ei, color: 0xffffff }); k.part(N.embryo, headGeo, [x, ey + 0.38 * sc, zz + 0.1 * sc], { scale: sc * 0.95, ry: ei });
    if (rng.chance(0.6)) { for (const q of [-1, 1]) k.sph(N.glowCyan, 0.035, [x + q * 0.08 * sc, ey + 0.42 * sc, zz + 0.3 * sc], { seg: 5 }); }
    k.part(N.eggB, eggGeo, [x, ey, zz], { scale: sc, glow: g }); k.part(N.egg, eggGeo, [x, ey, zz], { scale: sc, glow: g });
    k.rod(N.tendon, [x, ey + 1.3 * sc, zz], [x * 0.9, 11 - Math.abs(x) * 0.2, zz], 0.04, { seg: 5 }); eggs.push(e);
  }
  // hanging pods
  for (let i = 0; i < 18; i++) { const x = rng.range(-14, 14), z = rng.range(-30, 30); if (Math.abs(x) < 2.5) continue; const y = rng.range(6.5, 9), sc = rng.range(0.6, 0.95), g = rng.next(); k.part(N.eggB, eggGeo, [x, y, z], { scale: sc, glow: g }); k.part(N.egg, eggGeo, [x, y, z], { scale: sc, glow: g }); k.part(N.embryo, embGeo, [x, y, z], { scale: sc * 0.9, rx: 0.4 }); k.rod(N.tendon, [x, y + 1.3 * sc, z], [x * 0.97, 12.2 - Math.abs(x) * 0.15, z], 0.05, { seg: 5 }); }
  // far end: mother sac cluster in a bone cage
  k.part(N.flesh, endWallGeo({ rx, ry, cy, th0: -TH, th1: Math.PI + TH, z: z0 + 0.1 }));
  for (const [x, y, r, sd] of [[0, 5, 3.6, 1], [-4.4, 3.4, 2.2, 2], [4.2, 3.2, 2.4, 3]]) { const g = 0.9; k.part(N.eggB, lumpGeo(80 + sd, { rx: r, ry: r * 1.1, rz: r, amp: 0.06, w: 20, h: 14 }), [x, y, z0 + 4.2], { glow: g }); k.part(N.egg, lumpGeo(80 + sd, { rx: r, ry: r * 1.1, rz: r, amp: 0.06, w: 20, h: 14 }), [x, y, z0 + 4.2], { glow: g }); k.part(N.embryo, lumpGeo(90 + sd, { rx: r * 0.42, ry: r * 0.58, rz: r * 0.4, amp: 0.15 }), [x, y - 0.1, z0 + 4.2], { rx: 0.3 }); }
  for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.6; tendonBundle(k, N, [Math.sin(a) * 4, 4.5 + Math.cos(a) * 3, z0 + 4.2], [Math.sin(a) * 15, 3 + Math.cos(a) * 8, z0 + 0.6], { strands: 2, r: 0.16, sag: 0.3, twist: 0.3, seed: i + 50 }); }
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.0; k.tubeAlong(N.shell, [[Math.sin(a) * 6.2, 0, z0 + 7], [Math.sin(a) * 6.5, 5, z0 + 6.5], [Math.sin(a) * 4.4, 10.8, z0 + 4.8]], 0.3, { seg: 8, perPoint: 8, us: 2, vs: 5 }); }
  k.pool(0, z0 + 7, 7, 0x46e6ff, 0.22, 0.05);
  // steam & spores
  const steam = []; for (let z = z0 + 3; z < z1; z += 4.5) for (const s of [-1, 1]) steam.push([s * 3.4, 0.2, z]); for (let i = 0; i < 24; i++) steam.push([rng.range(-14, 14), 0.1, rng.range(-30, 30)]);
  fxMesh(k, steam, { kind: 'steam', fall: 6, size: 1.1, color: 0x2a9ab8, a: 0.2, speed: 0.045, seed: 5 });
  const sp = []; for (let i = 0; i < 80; i++) sp.push([rng.range(-14, 14), rng.range(0.4, 6), rng.range(-30, 30)]); fxMesh(k, sp, { kind: 'steam', fall: 3.5, size: 0.1, color: 0x6ae8ff, a: 0.5, speed: 0.05, seed: 6 });
  const dr = []; for (let i = 0; i < 20; i++) dr.push([rng.range(-12, 12), 11, rng.range(-30, 30)]); fxMesh(k, dr, { kind: 'drip', fall: 10, size: 0.06, color: 0x6ae8ff, a: 0.8, speed: 0.1, seed: 7 });
  // lights
  const Lc = k.light(new THREE.PointLight(0x7ae6ff, 120, 50, 1.3), 'centre'); Lc.position.set(0, 7.5, 6); Lc.userData.alienTint = new THREE.Color(0x7ae6ff);
  const Lq = k.light(new THREE.PointLight(0x9af4ff, 110, 36, 1.3), 'mother'); Lq.position.set(0, 5, z0 + 9); Lq.userData.alienTint = new THREE.Color(0x9af4ff);
  const H = k.light(new THREE.HemisphereLight(0x7a9ab0, 0x2a2218, 1.2), 'hemi'); H.userData.alienTint = new THREE.Color(0x7a9ab0);
  k.anchor('walkA', [-0.6, 0.48, 24], Math.PI).anchor('walkB', [0.6, 0.48, 8], Math.PI).anchor('walkEnd', [0, 0.48, z0 + 10], 0).anchor('camAlong', [0, 2.2, 32], Math.PI).anchor('camLow', [0, 1.0, 22], Math.PI)
    .anchor('camEgg', [3.0, 1.9, eggs[8].z + 4], 2.6).anchor('camHigh', [-9, 9, 30], Math.PI + 0.3).anchor('mother', [0, 0, z0 + 9], 0).anchor('camMother', [0, 2.0, z0 + 18], 0);
  return { eggs, bounds: { w: 36, d: 68, h: 14.5 } };
}

function buildHold(k, N) {
  const z0 = -40, z1 = 40, rx = 30, ry = 16, cy = 4, period = 5.5, off = z0 + 2.75, TH = 0.3; const rng = new RNG(61);
  const glow = (z, th, bump, st) => clamp01(sstep(0.6, 0.05, st) * Math.pow(1 - bump, 1.2) * 0.75 + Math.exp(-Math.pow((th - Math.PI / 2) / 0.05, 2)) * 0.6 + 0.1 * (1 - bump));
  k.part(N.vault, vaultGeo({ z0, z1, rx, ry, cy, th0: -TH, th1: Math.PI + TH, period, offset: off, rw: 0.9, depth: 0.04, wob: 0.045, seed: 13, glowFn: glow, dz: 1.1, dth: 0.05 }));
  for (let z = off; z <= z1 - 1; z += period) k.part(N.shell, ribGeo({ z, rx, ry, cy, th0: -TH, th1: Math.PI + TH, thick: [1.3, 0.65], inset: 0.5, seed: z * 0.06, n: 40 }), [0, 0, 0], { us: 3, vs: 13 });
  k.box(N.floor, [68, 0.4, 84], [0, -0.2, 0], { tile: 6 });
  // bay door: circular hole in the far wall, space view behind, bone ring + iris leaves
  k.part(N.vault, endWallGeo({ rx, ry, cy, th0: -TH, th1: Math.PI + TH, hole: { circle: { cy: 11.5, r: 11 } }, z: z0 + 0.1 }));
  const bay = k.screen({ name: 'bay', w: 26, h: 26, draw: (c, w, h, t, S) => drawSpaceView(c, w, h, t, S, { R: 1.0, top: 0.52, cx: 0.4 }), fps: 4, res: [512, 512], k: 1.5, rough: 1, mirror: false }, [0, 11.5, z0 - 0.2]);
  k.tubeAlong(N.shell, Array.from({ length: 41 }, (_, i) => [Math.cos(i / 40 * TAU) * 11.6, 11.5 + Math.sin(i / 40 * TAU) * 11.6, z0 + 0.9]), 0.95, { seg: 10, perPoint: 1, closed: true, us: 6, vs: 28 });
  const bayDoor = iris(k, N, [0, 11.5, z0 + 0.7], 11.2, { leaves: 12, open: 0.85 });
  // berths for dropships (3 per side)
  const berths = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = s * 17, z = -26 + i * 20; berths.push([x, z]);
    k.cyl(N.shellB, [7.4, 7.7, 0.6], [x, 0.3, z], { seg: 40, uv: 'box', tile: 3 }); k.cyl(N.floor, [6.4, 6.4, 0.06], [x, 0.62, z], { seg: 40, uv: 'box', tile: 3 });
    k.part(N.glowCyan, new THREE.RingGeometry(6.2, 6.35, 64), [x, 0.66, z], { rx: -Math.PI / 2 }); k.part(N.glowDim, new THREE.RingGeometry(3.6, 3.7, 64), [x, 0.66, z], { rx: -Math.PI / 2 });
    for (let q = 0; q < 5; q++) { const a = q / 5 * TAU + 0.3; const bx = x + Math.cos(a) * 7.0, bz = z + Math.sin(a) * 7.0, tx = x + Math.cos(a) * 3.6, tz = z + Math.sin(a) * 3.6; k.tubeAlong(N.shell, [[bx, 0.5, bz], [bx * 1.0 + (tx - bx) * 0.08, 3.2, bz + (tz - bz) * 0.08], [bx + (tx - bx) * 0.35, 6.0, bz + (tz - bz) * 0.35], [bx + (tx - bx) * 0.55, 7.2, bz + (tz - bz) * 0.55]], 0.42, { seg: 8, perPoint: 6, us: 2, vs: 5 }); k.sph(N.glowCyan, 0.16, [bx + (tx - bx) * 0.55, 7.2, bz + (tz - bz) * 0.55], { seg: 6 }); }
    k.pool(x, z, 9, 0x46e6ff, 0.16, 0.7);
    k.anchor('berth' + (berths.length - 1), [x, 0.66, z], Math.PI);
  }
  // guide lights down the centre lane
  for (let z = -36; z <= 36; z += 4) for (const s of [-1, 1]) k.box(k.glow(0x2ac8e8, 1.2), [0.18, 0.02, 1.4], [s * 4, 0.02, z], { mirror: false });
  for (let z = -34; z <= 30; z += 8) k.part(k.glow(0x1a98b8, 0.9), new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-2, 0); s.lineTo(0, 1.2); s.lineTo(2, 0); s.lineTo(1.6, 0); s.lineTo(0, 0.9); s.lineTo(-1.6, 0); s.closePath(); return s; })()), [0, 0.03, z], { rx: -Math.PI / 2 });
  // crawler pens
  const pens = [];
  for (const x of [-21, -10, 10, 21]) for (const z of [26, 35]) {
    k.box(N.floor, [8, 0.1, 7], [x, 0.05, z], { tile: 3 }); k.box(k.glow(0x2ac8e8, 0.9), [7.2, 0.01, 6.2], [x, 0.11, z], { mirror: false });
    const h = 3.2; const rail = (a, b) => k.rod(N.shell, [a[0], h, a[1]], [b[0], h, b[1]], 0.14, { seg: 6 });
    rail([x - 4, z - 3.5], [x + 4, z - 3.5]); rail([x - 4, z - 3.5], [x - 4, z + 3.5]); rail([x + 4, z - 3.5], [x + 4, z + 3.5]);
    for (let q = 0; q <= 8; q++) { const bx = x - 4 + q; k.tubeAlong(N.shell, [[bx, 0, z - 3.5], [bx + 0.08, h * 0.5, z - 3.5], [bx, h, z - 3.5]], 0.14, { seg: 6, perPoint: 3, vs: 4 }); if (q % 2 === 0) { k.tubeAlong(N.shell, [[x - 4, 0, z - 3.5 + q * 0.875], [x - 4, h * 0.5, z - 3.5 + q * 0.875 + 0.05], [x - 4, h, z - 3.5 + q * 0.875]], 0.14, { seg: 6, perPoint: 3, vs: 4 }); k.tubeAlong(N.shell, [[x + 4, 0, z - 3.5 + q * 0.875], [x + 4, h * 0.5, z - 3.5 + q * 0.875 - 0.05], [x + 4, h, z - 3.5 + q * 0.875]], 0.14, { seg: 6, perPoint: 3, vs: 4 }); } }
    k.part(N.flesh, lumpGeo(100 + pens.length, { rx: 0.9, ry: 0.35, rz: 0.7, amp: 0.15, w: 10, h: 6 }), [x + 2.5, 0.3, z + 2], {}); // trough
    pens.push([x, z]); k.anchor('pen' + (pens.length - 1), [x, 0.12, z], Math.PI);
  }
  // cargo pods (stacked grown containers)
  for (const sx of [-1, 1]) for (let q = 0; q < 4; q++) { const z = 4 + q * 5.2; for (let lv = 0; lv < 2 + (q % 2); lv++) { const x = sx * 26.0; k.part(N.shellB, lumpGeo(120 + q * 3 + lv, { rx: 1.9, ry: 1.0, rz: 1.5, amp: 0.05, w: 14, h: 9 }), [x - sx * lv * 0.3, 0.9 + lv * 2.0, z], { ry: Math.PI / 2 }); k.part(N.glowDim, new THREE.TorusGeometry(1.45, 0.05, 6, 24), [x - sx * lv * 0.3, 0.9 + lv * 2.0, z], { ry: 0 }); } }
  // gantry across the hall
  const gy = 9.5, gz = -8;
  k.box(N.shellB, [54, 0.4, 3.2], [0, gy, gz], { tile: 3 }); k.box(N.floor, [54, 0.06, 2.8], [0, gy + 0.22, gz], { tile: 3 });
  for (const s of [-1, 1]) { k.rod(N.shell, [-27, gy + 1.2, gz + s * 1.5], [27, gy + 1.2, gz + s * 1.5], 0.09, { seg: 6 }); for (let x = -26; x <= 26; x += 3) k.rod(N.shell, [x, gy + 0.2, gz + s * 1.5], [x, gy + 1.2, gz + s * 1.5], 0.07, { seg: 5 }); k.box(k.glow(0x3ae0ff, 1.2), [54, 0.03, 0.05], [0, gy + 0.24, gz + s * 1.55], { mirror: false }); }
  for (const x of [-12, 12]) k.tubeAlong(N.shell, [[x, 0, gz], [x * 1.02, gy * 0.5, gz], [x * 0.97, gy, gz]], 0.7, { seg: 10, perPoint: 8, us: 2, vs: 6 });
  for (let x = -22; x <= 22; x += 11) tendonBundle(k, N, [x, 16.2, gz], [x, gy + 0.3, gz], { strands: 2, r: 0.07, sag: 0.0, seed: x });
  // hanging cocoons
  const eggGeo = lumpGeo(9, { rx: 0.9, ry: 1.4, rz: 0.9, amp: 0.05, w: 14, h: 10 }), embGeo = lumpGeo(6, { rx: 0.36, ry: 0.5, rz: 0.32, amp: 0.1, w: 10, h: 8 });
  for (let i = 0; i < 28; i++) { const x = rng.range(-26, 26), z = rng.range(-6, 38); if (Math.abs(x) < 4.5) continue; const y = rng.range(5.5, 10.5), sc = rng.range(0.8, 1.5), g = rng.next(); k.part(N.eggB, eggGeo, [x, y, z], { scale: sc, glow: g }); k.part(N.egg, eggGeo, [x, y, z], { scale: sc, glow: g }); if (rng.chance(0.6)) k.part(N.embryo, embGeo, [x, y, z], { scale: sc * 0.9, rx: 0.4 }); k.rod(N.tendon, [x, y + 1.4 * sc, z], [x * 0.98, 18 - Math.abs(x) * 0.2, z], 0.06, { seg: 5 }); }
  // columns
  for (const [x, z] of [[-27, -30], [27, -30], [-27, -14], [27, -14], [-27, 2], [27, 2], [-27, 18], [27, 18]]) { const prof = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * 20; prof.push([1.0 + 0.3 * Math.sin(y * 0.8 + x) * 0.5 + 0.4 * Math.exp(-Math.pow((y % 5 - 0.6) / 0.5, 2)) + (1 - i / 24) * 0.7]); prof[i] = [prof[i][0], y]; } k.lathe(N.shell, prof, [x * 0.97, 0, z], { seg: 14, us: 2, vs: 9 }); }
  // fx & lights
  const sp = []; for (let i = 0; i < 100; i++) sp.push([rng.range(-28, 28), rng.range(0.4, 10), rng.range(-34, 36)]); fxMesh(k, sp, { kind: 'steam', fall: 4, size: 0.14, color: 0x6ae8ff, a: 0.45, speed: 0.04, seed: 3 });
  const st = []; for (let i = 0; i < 30; i++) st.push([rng.range(-26, 26), 0.2, rng.range(18, 38)]); fxMesh(k, st, { kind: 'steam', fall: 7, size: 1.4, color: 0x2a9ab8, a: 0.16, speed: 0.04, seed: 8 });
  const dr = []; for (let i = 0; i < 20; i++) dr.push([rng.range(-20, 20), 16, rng.range(-30, 30)]); fxMesh(k, dr, { kind: 'drip', fall: 15, size: 0.07, color: 0x6ae8ff, a: 0.7, speed: 0.08, seed: 9 });
  const Lb = k.light(new THREE.PointLight(0xc8e0ff, 320, 80, 1.3), 'bayGlow'); Lb.position.set(0, 11.5, z0 + 6); Lb.userData.alienTint = new THREE.Color(0xc8e0ff);
  const Lh = k.light(new THREE.PointLight(0x7ae6ff, 160, 70, 1.3), 'hall'); Lh.position.set(0, 12, 10); Lh.userData.alienTint = new THREE.Color(0x7ae6ff);
  const H = k.light(new THREE.HemisphereLight(0x7a9ab0, 0x2a2218, 1.1), 'hemi'); H.userData.alienTint = new THREE.Color(0x7a9ab0);
  k.anchor('bayDoor', [0, 0.05, z0 + 6], 0).anchor('camWide', [0, 3.2, 38.5], Math.PI).anchor('camBay', [0, 4, 14], Math.PI).anchor('camBerth', [3, 2.5, -4], Math.PI - 0.3).anchor('camPens', [0, 2.2, 14], 0).anchor('camGantry', [-22, gy + 1.6, gz + 1], -Math.PI / 2).anchor('gantry', [0, gy + 0.25, gz], 0).anchor('camHigh', [-26, 14, 36], Math.PI + 0.55);
  return { window: { mesh: bay.mesh, screen: bay, setTexture: (t) => bay.setTexture(t), setCanvas: (f, o) => bay.setCanvas(f, o) }, bayDoor, bounds: { w: 62, d: 80, h: 20 } };
}

export function createAlienInterior(kind = 'corridor', opts = {}) {
  const k = createKit('Alien_' + kind, { seed: 21, infectAll: true });
  const N = alienMats(k);
  let extra = {};
  if (kind === 'corridor') extra = buildCorridor(k, N);
  else if (kind === 'bridge') extra = buildBridge(k, N);
  else if (kind === 'hatchery') extra = buildHatchery(k, N);
  else if (kind === 'hold') extra = buildHold(k, N);
  else throw new Error('createAlienInterior: unknown kind ' + kind);
  const set = k.api({ kind, ...extra });
  set.setInfection = (a) => { alienInfect(k, a); extra.extraInfect && extra.extraInfect(a); };
  return set;
}
