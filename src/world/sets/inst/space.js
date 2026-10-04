// createObservatory — domed reflector telescope with open slit;  createMissionControl — tiered flight-control room
import * as THREE from 'three';
import { createKit } from './kit.js';
import { drawTelemetry, drawSpectrum, drawOrbit, drawCountdown, drawDataScroll, drawRadar, drawEarth, drawWorldMap, drawStatusGrid, SANS, MONO, theme } from './draw.js';
import { arcSlab, arcPt, chair, monitor, mug, papers, keyboard, headset, deskMic, plant, lightPanel, flag, wallClock, whiteboard, stallChair, railing, cable } from './props.js';
import { TAU, RNG } from '../../../engine/common.js';

/** dome surface with a constant-width slit. returns geometry (outside normals, double-sided material expected) */
function domeGeo(R, slit, thSlit, nx = 20, nth = 40) {
  const P = [], I = [], U = []; let base = 0;
  const grid = (xa, xb, ta, tb, nxx, ntt) => {
    for (let i = 0; i <= nxx; i++) for (let j = 0; j <= ntt; j++) {
      const x = xa + (xb - xa) * i / nxx, th = ta + (tb - ta) * j / ntt, rho = Math.sqrt(Math.max(0, R * R - x * x));
      P.push(x, rho * Math.sin(th), rho * Math.cos(th)); U.push(x * 0.3, th * R * 0.3);
    }
    for (let i = 0; i < nxx; i++) for (let j = 0; j < ntt; j++) { const a = base + i * (ntt + 1) + j, b = a + 1, c = a + ntt + 1, d = c + 1; I.push(a, b, c, b, d, c); }
    base = P.length / 3;
  };
  grid(slit, R, 0, thSlit, Math.round(nx * 0.6), nth);        // right half of slit zone
  grid(-R, -slit, 0, thSlit, Math.round(nx * 0.6), nth);       // left half
  grid(-R, R, thSlit, Math.PI, nx * 2, Math.round(nth * 0.45)); // closed rear zone
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
  // ensure normals point outward
  const n = g.attributes.normal, p = g.attributes.position; let dot = 0; for (let i = 0; i < p.count; i += 7) dot += n.getX(i) * p.getX(i) + n.getY(i) * p.getY(i) + n.getZ(i) * p.getZ(i);
  if (dot < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  g.userData.uvMetres = false; return g;
}

export function createObservatory(opts = {}) {
  const k = createKit('Observatory', { seed: 51 });
  const R = 7.6, WH = 4.2, DR = 7.9, slit = 1.35;
  const amber = k.glow(0xffb050, 2.0), red = k.glow(0xff3020, 2.2), cyan = k.glow(0x46c8ff, 2.0);
  // ----- drum & floor -----
  k.cyl('woodLight', [R, R, 0.2], [0, -0.1, 0], { seg: 56, uv: 'box', tile: 2.2 });
  for (const r of [2.6, 5.9, 6.1]) k.part('brass', new THREE.RingGeometry(r - 0.025, r + 0.025, 90), [0, 0.003, 0], { rx: -Math.PI / 2 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; k.box('brass', [0.04, 3.3, 0.01], [Math.sin(a) * 4.25, 0.004, Math.cos(a) * 4.25], { ry: a, rx: 0 }); }
  arcSlab(k, 'paintCream', R, R + 0.35, 0, TAU, 0, WH, [0, 0, 0], { steps: 72, caps: false, top: false, bottom: false, inner: true, outer: true });
  arcSlab(k, 'woodDark', R - 0.02, R + 0.02, 0, TAU, 0, 1.2, [0, 0, 0], { steps: 72, caps: false, top: false, bottom: false, outer: false });
  arcSlab(k, 'steel', R - 0.1, R + 0.4, 0, TAU, WH - 0.12, WH, [0, 0, 0], { steps: 72 });
  // door + windows slits
  k.box('steel', [1.4, 2.3, 0.22], [Math.sin(2.4) * (R - 0.1), 1.15, Math.cos(2.4) * (R - 0.1)], { ry: 2.4 }); k.box(k.glow(0x30ff60, 2), [0.5, 0.1, 0.02], [Math.sin(2.4) * (R - 0.25), 2.55, Math.cos(2.4) * (R - 0.25)], { ry: 2.4 });
  // mezzanine ring + spiral stair
  arcSlab(k, 'woodDark', R - 1.1, R - 0.02, 0.5, TAU - 0.5, 2.55, 2.7, [0, 0, 0], { steps: 60 });
  const rl = []; for (let i = 0; i <= 50; i++) { const a = 0.5 + i / 50 * (TAU - 1.0); rl.push([Math.sin(a) * (R - 1.12), 3.6, Math.cos(a) * (R - 1.12)]); }
  k.tubeAlong('steel', rl, 0.025, { seg: 5, perPoint: 1, tsegs: 80 });
  for (let i = 0; i <= 40; i++) { const a = 0.5 + i / 40 * (TAU - 1.0); k.cyl('steel', [0.015, 0.015, 1.05], [Math.sin(a) * (R - 1.12), 3.1, Math.cos(a) * (R - 1.12)], { seg: 4 }); }
  for (let i = 0; i < 20; i++) { const a = -0.3 - i * 0.065, y = 0.13 + i * 0.12; k.box('steel', [1.05, 0.04, 0.34], [Math.sin(a) * (R - 0.6), y, Math.cos(a) * (R - 0.6)], { ry: a }); }
  k.cyl('steel', [0.08, 0.08, 2.6], [Math.sin(-0.3) * (R - 0.6) * 0.9, 1.3, Math.cos(-0.3) * (R - 0.6) * 0.9], { seg: 8 });
  // star chart frames + bookshelves along the wall
  for (let i = 0; i < 7; i++) { const a = 0.9 + i * 0.5; if (a > 2.1 && a < 2.7) continue; const x = Math.sin(a) * (R - 0.08), z = Math.cos(a) * (R - 0.08); k.box('woodDark', [1.1, 0.8, 0.05], [x, 1.8, z], { ry: a + Math.PI }); k.sign(1.0, 0.7, (c, w, h) => { c.fillStyle = '#0a1830'; c.fillRect(0, 0, w, h); for (let q = 0; q < 140; q++) { c.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * ((q * 37) % 10) / 10})`; c.fillRect(((q * 97) % 101) / 101 * w, ((q * 53) % 97) / 97 * h, 2, 2); } c.strokeStyle = 'rgba(120,180,255,0.5)'; c.beginPath(); c.arc(w / 2, h / 2, h * 0.4, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); }, [Math.sin(a) * (R - 0.12), 1.8, Math.cos(a) * (R - 0.12)], { ry: a + Math.PI, ppm: 120 }); }
  for (const a of [-0.9, -1.25]) { const x = Math.sin(a) * (R - 0.3), z = Math.cos(a) * (R - 0.3); k.push(x, 0, z, a + Math.PI); k.box('woodDark', [1.5, 2.2, 0.4], [0, 1.1, 0]); for (let s = 0; s < 5; s++) { k.box('paintBlue', [1.4, 0.34, 0.3], [0, 0.35 + s * 0.4, 0.04], { color: [0x4a3020, 0x203050, 0x503028, 0x304030, 0x403828][s % 5] }); } k.pop(); }
  // ----- control desk (curved) -----
  const dA = -2.0, dR = 5.4;
  arcSlab(k, 'woodDark', dR - 0.5, dR + 0.5, dA - 0.65, dA + 0.65, 0.72, 0.77, [0, 0, 0], { steps: 14 }); arcSlab(k, 'paintDark', dR - 0.42, dR + 0.42, dA - 0.63, dA + 0.63, 0.0, 0.72, [0, 0, 0], { steps: 14 });
  const scr = [];
  for (let i = 0; i < 3; i++) { const a = dA + (i - 1) * 0.28, [x, z] = arcPt(0, 0, dR + 0.1, a); k.push(x, 0.77, z, a + Math.PI); k.box('blackPlastic', [0.04, 0.2, 0.04], [0, 0.1, 0]); const s = k.screen({ name: 'ctrl' + (i + 1), w: 0.78, h: 0.44, draw: [(c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { theme: 'amber', labels: ['RA', 'DEC', 'ALT', 'AZ'], rows: 4 }), (c, w, h, t, S) => drawSpectrum(c, w, h, t, S, { theme: 'amber' }), (c, w, h, t, S) => drawDataScroll(c, w, h, t, S, { theme: 'green' })][i], fps: 8, res: [320, 190], bezel: 0.02, k: 0.9 }, [0, 0.46, 0.01], { rx: -0.12 }); scr.push(s); k.pop(); }
  for (const da of [-0.3, 0.3]) { const [kx, kz] = arcPt(0, 0, dR - 0.1, dA + da); keyboard(k, kx, 0.775, kz, dA + da + Math.PI); const [mx, mz] = arcPt(0, 0, dR - 0.3, dA + da * 1.9); mug(k, mx, 0.77, mz); chair(k, ...arcPt(0, 0, dR - 1.1, dA + da), dA + da, { seat: 'fabricGrey', tall: false }); }
  const [lx, lz] = arcPt(0, 0, dR + 0.15, dA + 0.55); k.cyl('chrome', [0.01, 0.1, 0.5], [lx, 1.0, lz], { seg: 6, rx: 0.4 }); k.cyl(red, [0.1, 0.1, 0.02], [lx, 1.3, lz - 0.1], { seg: 8, rx: 0.8 });
  // utility benches
  k.box('woodDark', [2.2, 0.06, 0.9], [-4.3, 0.9, -4.5], { ry: 0.4 }); k.box('paintDark', [2.1, 0.88, 0.8], [-4.3, 0.44, -4.5], { ry: 0.4 }); for (let i = 0; i < 4; i++) k.box('steel', [0.2, 0.07, 0.14], [-4.7 + i * 0.28, 0.97, -4.45 - i * 0.04], { ry: 0.4 });
  plant(k, 5.2, -4.3, 1.1);
  // ----- dome (rotating) + ribs -----
  const dome = k.sub('dome'); dome.glowInfect = false;
  dome.part('domeWhite', domeGeo(DR, slit, 1.82), [0, 0, 0], {});
  for (let i = 0; i < 14; i++) { const ph = i / 14 * Math.PI * 2; if (Math.abs(Math.sin(ph)) < slit / DR + 0.05 && Math.cos(ph) > -0.1) continue; const pts = []; for (let j = 0; j <= 18; j++) { const el = j / 18 * (Math.PI / 2 - 0.02); const rr = DR - 0.1; pts.push([rr * Math.cos(el) * Math.sin(ph), rr * Math.sin(el), rr * Math.cos(el) * Math.cos(ph)]); } dome.tubeAlong('steel', pts, 0.045, { seg: 5, perPoint: 2 }); }
  for (const el of [0.35, 0.75, 1.1, 1.35]) { const rr = DR - 0.1, pts = []; for (let j = 0; j <= 48; j++) { const ph = j / 48 * TAU; const x = rr * Math.cos(el) * Math.sin(ph), z = rr * Math.cos(el) * Math.cos(ph); if (Math.abs(x) < slit && z > 0) { if (pts.length > 1) dome.tubeAlong('steel', pts, 0.04, { seg: 5, perPoint: 1 }); pts.length = 0; continue; } pts.push([x, rr * Math.sin(el), z]); } if (pts.length > 1) dome.tubeAlong('steel', pts, 0.04, { seg: 5, perPoint: 1 }); }
  // slit edge rails + shutter motor housings
  for (const sx of [-1, 1]) { dome.tubeAlong('steel', Array.from({ length: 20 }, (_, j) => { const th = j / 19 * 1.82, rho = Math.sqrt(DR * DR - slit * slit); return [sx * slit, rho * Math.sin(th), rho * Math.cos(th)]; }), 0.07, { seg: 6, perPoint: 2 }); }
  dome.box('steelDark', [0.9, 0.5, 0.7], [0, 0.4, DR - 0.5]); dome.box(dome.glow(0x30ff60, 2), [0.1, 0.08, 0.02], [0.2, 0.5, DR - 0.14]);
  dome.torus('steel', DR - 0.05, 0.14, [0, 0.05, 0], { rx: Math.PI / 2, seg: 72, tseg: 6 });
  const domeG = k.attach(dome, [0, WH, 0]);
  // ----- telescope on fork mount (dynamic) -----
  k.cyl('concrete', [0.9, 1.0, 0.9], [0, 0.45, 0], { seg: 28 }); k.cyl('steel', [0.55, 0.62, 0.5], [0, 1.15, 0], { seg: 24 });
  const scope = k.sub('scope'); scope.glowInfect = false;
  scope.cyl('paintWhite', [0.8, 0.8, 5.2], [0, 0, 0], { seg: 32, open: true, uv: 'native' }); scope.cyl('paintWhite', [0.8, 0.8, 5.2], [0, 0, 0], { seg: 32, open: true });
  scope.torus('steel', 0.8, 0.04, [0, 2.6, 0], { rx: Math.PI / 2, seg: 32, tseg: 5 }); scope.torus('steel', 0.8, 0.04, [0, -2.6, 0], { rx: Math.PI / 2, seg: 32, tseg: 5 });
  scope.cyl('blackMatte', [0.82, 0.82, 0.12], [0, -2.5, 0], { seg: 32 }); scope.cyl('chrome', [0.74, 0.74, 0.04], [0, -2.38, 0], { seg: 32 });
  scope.cyl('steelDark', [0.9, 0.9, 0.4], [0, -2.8, 0], { seg: 32 }); scope.box('blackPlastic', [0.4, 0.5, 0.4], [0.9, -2.7, 0]);
  for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) scope.rod('steel', [0, 2.45, 0], [Math.cos(a) * 0.78, 2.45, Math.sin(a) * 0.78], 0.012, { seg: 4 });
  scope.cyl('blackMatte', [0.16, 0.16, 0.22], [0, 2.4, 0], { seg: 14 });
  scope.rod('steel', [0.2, 1.8, 0], [0.45, 2.6, 0.4], 0.04, { seg: 5 }); scope.cyl('blackPlastic', [0.06, 0.06, 0.6], [0.9, 1.4, 0], { seg: 8 }); // finder
  scope.cyl('chrome', [0.1, 0.1, 0.5], [-0.92, 0.9, 0], { seg: 10 }); // counterweight shaft stub
  scope.cyl('steelDark', [0.28, 0.28, 0.7], [-0.9, 0.5, 0], { seg: 12 });
  // fork arms (yaw group) carrying the tube (pitch group)
  const fork = k.sub('fork'); fork.box('steel', [0.18, 2.4, 0.2], [-1.0, 1.2, 0]); fork.box('steel', [0.18, 2.4, 0.2], [1.0, 1.2, 0]); fork.box('steel', [2.4, 0.3, 0.6], [0, 0.0, 0]); fork.cyl('steelDark', [0.2, 0.2, 0.24], [-1.0, 2.4, 0], { seg: 14, rz: Math.PI / 2 }); fork.cyl('steelDark', [0.2, 0.2, 0.24], [1.0, 2.4, 0], { seg: 14, rz: Math.PI / 2 });
  const forkG = k.attach(fork, [0, 1.35, 0]); const pitchG = new THREE.Group(); pitchG.position.set(0, 2.4, 0); forkG.add(pitchG);
  scope.finish(); pitchG.add(scope.root);
  const aim = { yaw: 0, pitch: 0.95 };
  const applyAim = (t) => { forkG.rotation.y = aim.yaw + Math.sin(t * 0.02) * 0.01; pitchG.rotation.x = Math.PI / 2 - aim.pitch; };
  // ----- lights -----
  const hemi = new THREE.HemisphereLight(0x5a6a90, 0x201810, 1.4); k.light(hemi, 'hemi');
  const lamp = new THREE.PointLight(0xffb060, 26, 12, 1.5); lamp.position.set(-1.8, 2.2, -4.6); k.light(lamp, 'deskLamp');
  const moon = new THREE.PointLight(0x9ab8ff, 70, 20, 1.4); moon.position.set(0, 7.5, 2.5); k.light(moon, 'moonlight');
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; k.sph(amber, 0.06, [Math.sin(a) * (R - 0.3), 2.2, Math.cos(a) * (R - 0.3)], { seg: 8 }); k.rod('steel', [Math.sin(a) * (R - 0.1), 2.2, Math.cos(a) * (R - 0.1)], [Math.sin(a) * (R - 0.3), 2.2, Math.cos(a) * (R - 0.3)], 0.01, {}); }
  // ----- anchors -----
  k.anchor('telescope', [0, 0, 0], 0).anchor('eyepiece', [0, 1.55, -1.9], 0);
  { const pA = arcPt(0, 0, dR - 1.1, dA - 0.3), pB = arcPt(0, 0, dR - 1.1, dA + 0.3); k.anchor('deskA', [pA[0], 0, pA[1]], dA - 0.3 + Math.PI).anchor('deskB', [pB[0], 0, pB[1]], dA + 0.3 + Math.PI); }
  k.anchor('standSlit', [0, 0, 3.0], 0).anchor('mezzanine', [Math.sin(3.8) * (R - 0.6), 2.7, Math.cos(3.8) * (R - 0.6)], 3.8 + Math.PI).anchor('door', [Math.sin(2.4) * (R - 1), 0, Math.cos(2.4) * (R - 1)], 2.4 + Math.PI)
    .anchor('camWide', [0, 1.9, -6.7], 0).anchor('camSlit', [0.6, 0.15, 2.8], 0.2).anchor('camDesk', [Math.sin(-1.0) * 3.2, 1.5, Math.cos(-1.0) * 3.2], -1.0 + Math.PI + 0.3).anchor('camEyepiece', [-1.4, 1.5, -2.6], 0.5).anchor('camHigh', [Math.sin(2.7) * 6.8, 3.9, Math.cos(2.7) * 6.8], 2.7 + Math.PI);
  k.onUpdate((dt, t) => { applyAim(t); });
  const set = k.api({ dome: domeG, scope: pitchG, bounds: { w: 2 * (R + 0.4), d: 2 * (R + 0.4), h: WH + DR }, setSlit: (yaw) => { domeG.rotation.y = yaw; }, aimTelescope: (yaw, pitch) => { aim.yaw = yaw; aim.pitch = pitch; applyAim(0); } });
  applyAim(0);
  return set;
}

// =====================================================================================================
function drawMainDisplay(ctx, w, h, t, S) {
  const th = theme('blue'); drawOrbit(ctx, w, h, t, S, { title: 'ORBITAL OPERATIONS  —  ALL ASSETS' });
  ctx.fillStyle = 'rgba(2,8,20,0.5)'; ctx.fillRect(w * 0.7, h * 0.12, w * 0.28, h * 0.78); ctx.strokeStyle = th.dot2; ctx.lineWidth = 2; ctx.strokeRect(w * 0.7, h * 0.12, w * 0.28, h * 0.78);
  ctx.font = `${Math.round(h / 22)}px ${MONO}`; ctx.fillStyle = th.text; ctx.textBaseline = 'top'; const rows = ['STATUS      NOMINAL', 'ORBIT       LEO-2', 'ALT   ' + (412 + Math.sin(t * 0.3) * 4).toFixed(1) + ' KM', 'VEL   ' + (7.66 + Math.sin(t * 0.2) * 0.02).toFixed(3) + ' KM/S', 'INCL  51.64 DEG', 'COMMS       LOCKED', 'TRACK       ' + (97 + Math.sin(t) * 2).toFixed(1) + '%', 'UNIDENT     ' + Math.round((S.threat || 0) * 12)];
  rows.forEach((r, i) => ctx.fillText(r, w * 0.715, h * 0.15 + i * h * 0.095));
}

export function createMissionControl(opts = {}) {
  const k = createKit('MissionControl', { seed: 61 });
  const X0 = -15, X1 = 15, Z0 = -11, Z1 = 12.5, H = 9.2;
  const cyan = k.glow(0x46c8ff, 2.0), blue = k.glow(0x2a6cff, 1.8), amber = k.glow(0xffb040, 2.0), red = k.glow(0xff3020, 2.2), green = k.glow(0x30ff70, 2.0);
  k.floorQuad('carpetGrey', X1 - X0, Z1 - Z0, [0, 0, (Z0 + Z1) / 2], { color: 0x6a7080 }); k.box('blackMatte', [X1 - X0, 0.3, Z1 - Z0], [0, H + 0.15, (Z0 + Z1) / 2]);
  k.wall('paintDark', [X0, Z0], [X1, Z0], H, 0.3); k.wall('paintDark', [X0, Z1], [X1, Z1], H, 0.3); k.wall('fabricDark', [X0, Z0], [X0, Z1], H, 0.3, { tile: 1 }); k.wall('fabricDark', [X1, Z0], [X1, Z1], H, 0.3, { tile: 1 });
  for (const sx of [-1, 1]) { k.box(blue, [0.05, 0.08, Z1 - Z0 - 1], [sx * (X1 - 0.17), 1.0, (Z0 + Z1) / 2], { mirror: false }); k.box(blue, [0.05, 0.08, Z1 - Z0 - 1], [sx * (X1 - 0.17), 7.8, (Z0 + Z1) / 2], { mirror: false }); for (let z = Z0 + 3; z < Z1; z += 4) k.box(cyan, [0.04, 5.8, 0.05], [sx * (X1 - 0.17), 4.4, z], { mirror: false }); }
  // front display wall
  const zw = Z0 + 0.3;
  k.box('blackPlastic', [29, 8.2, 0.3], [0, 4.6, zw - 0.15]);
  const main = k.screen({ name: 'main', w: 15.5, h: 6.2, draw: drawMainDisplay, fps: 6, res: [1024, 410], bezel: 0.14, k: 1.15 }, [0, 4.9, zw + 0.05]);
  const left = k.screen({ name: 'left', w: 5.8, h: 3.3, draw: (c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { rows: 5, theme: 'cyan', labels: ['PWR', 'THERM', 'ATT', 'COMMS', 'PROP'] }), fps: 8, res: [512, 292], bezel: 0.1, k: 1.1 }, [-11.3, 4.6, zw + 0.05]);
  const right = k.screen({ name: 'right', w: 5.8, h: 3.3, draw: (c, w, h, t, S) => drawRadar(c, w, h, t, S, { theme: 'green', title: 'DEBRIS FIELD' }), fps: 8, res: [512, 292], bezel: 0.1, k: 1.1 }, [11.3, 4.6, zw + 0.05]);
  const clock = k.screen({ name: 'clock', w: 6.2, h: 1.1, draw: (c, w, h, t, S) => drawCountdown(c, w, h, t, S, { start: 1800, theme: 'amber', label: 'T-MINUS' }), fps: 2, res: [512, 90], bezel: 0.05, k: 1.2 }, [0, 8.55, zw + 0.05]);
  const cd2 = k.screen({ name: 'status', w: 4.4, h: 1.0, draw: (c, w, h, t, S) => drawStatusGrid(c, w, h, t, S, { cols: 14, rows: 3 }), fps: 4, res: [384, 90], bezel: 0.04, k: 1.0 }, [-11.3, 7.0, zw + 0.05]);
  k.pool(0, Z0 + 3, 7, 0x4a8cff, 0.2);
  // console rows (arcs)
  const feeds = ['data', 'tel', 'orb', 'grid', 'rad'].map((n, i) => k.feed(n, [(c, w, h, t, S) => drawDataScroll(c, w, h, t, S, { theme: 'green' }), (c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { rows: 3, theme: 'cyan' }), (c, w, h, t, S) => drawOrbit(c, w, h, t, S, { title: 'TRACK' }), (c, w, h, t, S) => drawStatusGrid(c, w, h, t, S, { cols: 12, rows: 6 }), (c, w, h, t, S) => drawRadar(c, w, h, t, S, { theme: 'amber' })][i], { res: [256, 144], fps: 6 }));
  const C = [0, -9.4]; const consoles = []; let fi = 0;
  const rowsDef = [[8.0, 0.0, 0.62, 7], [10.4, 0.42, 0.7, 9], [12.8, 0.84, 0.74, 11], [15.2, 1.26, 0.78, 12]];
  rowsDef.forEach(([r, y, am, n], ri) => {
    arcSlab(k, 'paintDark', r - 1.1, r + 0.95, -am - 0.06, am + 0.06, 0, y + 0.0, [C[0], 0, C[1]], { steps: 20, top: false }); arcSlab(k, 'carpetGrey', r - 1.1, r + 0.95, -am - 0.06, am + 0.06, y, y + 0.02, [C[0], 0, C[1]], { steps: 20, color: 0x4a5060, bottom: false, inner: false, outer: false, caps: false });
    arcSlab(k, cyan, r - 1.12, r - 1.1, -am - 0.06, am + 0.06, y - 0.12, y - 0.06, [C[0], 0, C[1]], { steps: 20, caps: false, bottom: false, top: false, outer: false });
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 2 * am; const dR = r - 0.35, [dx, dz] = arcPt(C[0], C[1], dR, a);
      arcSlab(k, 'woodLight', dR - 0.4, dR + 0.4, a - 0.5 * 2 * am / (n - 1) * 0.46, a + 0.5 * 2 * am / (n - 1) * 0.46, y + 0.72, y + 0.77, [C[0], 0, C[1]], { steps: 2 });
      arcSlab(k, 'paintDark', dR - 0.36, dR + 0.36, a - 0.5 * 2 * am / (n - 1) * 0.46, a + 0.5 * 2 * am / (n - 1) * 0.46, y, y + 0.72, [C[0], 0, C[1]], { steps: 2, color: 0x30343c, top: false });
      const yaw = a + Math.PI; const [mx, mz] = arcPt(C[0], C[1], dR + 0.05, a);
      k.push(mx, y + 0.77, mz, yaw);
      for (const sx of [-1, 0, 1]) { if (n < 8 && sx === 0) continue; if (sx === 0 && ri < 2) continue; const f = feeds[fi++ % feeds.length]; k.push(sx * 0.46, 0, 0, sx * 0.25, -0.1); k.box('blackPlastic', [0.46, 0.27, 0.025], [0, 0.34, 0]); k.ambient(f, 0.43, 0.24, [0, 0.34, 0.015], { k: 1.0 }); k.box('blackPlastic', [0.03, 0.2, 0.03], [0, 0.1, -0.03]); k.pop(); }
      k.pop();
      keyboard(k, ...arcPt(C[0], C[1], dR - 0.15, a).flatMap((v, ii) => (ii === 0 ? [v, y + 0.775] : [v])), yaw, 0.38);
      if (i % 3 === 0) { const [px, pz] = arcPt(C[0], C[1], dR - 0.2, a + 0.07); headset(k, px, y + 0.77, pz, yaw); }
      if (i % 2 === 0) { const [qx, qz] = arcPt(C[0], C[1], dR - 0.28, a - 0.06); mug(k, qx, y + 0.77, qz); }
      const [cx2, cz2] = arcPt(C[0], C[1], dR - 1.05, a); chair(k, cx2, cz2, a, { y, seat: 'fabricDark', frame: 'steel', tall: true }); consoles.push([cx2, y, cz2, a]);
    }
  });
  // flight director + flags on top tier
  k.box('woodLight', [3.6, 0.06, 1.0], [0, 1.26 + 0.9, 8.6 + 0.0 + 0.0], { ry: 0 });
  // glass viewing gallery
  k.box('blackPlastic', [X1 - X0 - 2, 1.2, 3.4], [0, 0.6, Z1 - 1.9]); k.box('carpetNavy', [X1 - X0 - 2.2, 0.03, 3.2], [0, 1.22, Z1 - 1.9], { color: 0x30384a });
  k.box('glass', [X1 - X0 - 2, 2.6, 0.05], [0, 2.4, Z1 - 3.5]); for (let x = X0 + 1; x <= X1 - 1; x += 3.7) k.box('steel', [0.1, 2.7, 0.1], [x, 2.4, Z1 - 3.5]); k.box('steel', [X1 - X0 - 2, 0.1, 0.12], [0, 3.72, Z1 - 3.5]);
  for (let row = 0; row < 2; row++) for (let x = -11; x <= 11; x += 1.0) stallChair(k, x, 1.2 + row * 0.35, Z1 - 1.4 + row * 1.0 - 0.6, Math.PI, { mat: 'fabricBlue' });
  for (const [i, x] of [[1, -5.2], [2, -4.4], [3, 4.4], [4, 5.2]]) flag(k, x, 0, Z0 + 1.2, 0, i + 5, { w: 1.4, h: 0.95, poleH: 2.9 });
  wallClock(k, -13.9, 6.6, -2, Math.PI / 2, 0.4); wallClock(k, 13.9, 6.6, -2, -Math.PI / 2, 0.4);
  for (let x = -11; x <= 11; x += 5.5) for (let z = -5; z <= 9; z += 4.6) lightPanel(k, x, H - 0.05, z, 1.8, 0.9, 0xcfe0ff, 1.2);
  for (let z = -8; z <= 10; z += 2.3) k.box(blue, [X1 - X0 - 4, 0.04, 0.05], [0, H - 0.06, z], { mirror: false });
  const hemi = new THREE.HemisphereLight(0x8aa4d8, 0x20222a, 1.4); k.light(hemi, 'hemi');
  const L1 = new THREE.PointLight(0xcfe0ff, 100, 30, 1.4); L1.position.set(0, 7.5, 3); k.light(L1, 'ceilKey');
  const L2 = new THREE.PointLight(0x4a8cff, 60, 26, 1.4); L2.position.set(0, 5, -6.5); k.light(L2, 'screenFill');
  consoles.forEach(([x, y, z, a], i) => k.anchor('console' + i, [x, y, z], a));
  k.anchor('flightDirector', [0, 1.26, 9.6 - 0.8], Math.PI).anchor('camWide', [0, 5.8, 11.0], Math.PI).anchor('camFloor', [0, 1.7, 6.5], Math.PI).anchor('camScreens', [0, 2.4, 2.0], Math.PI).anchor('camBack', [0, 3.0, -9.0], 0).anchor('camConsole', [-3.8, 1.4, 2.8], Math.PI + 0.35).anchor('camGallery', [-10, 3.0, 9.8], Math.PI + 0.8).anchor('camHigh', [-13, 7.8, 11], Math.PI + 0.5);
  return k.api({ screen: main, main, left, right, clock, bounds: { w: X1 - X0, d: Z1 - Z0, h: H } });
}
