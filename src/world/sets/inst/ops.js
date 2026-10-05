// createDataCenter, createBunker, createCommandPost, createLaunchSite, createSiloControl
import * as THREE from 'three';
import { createKit } from './kit.js';
import { pbr, tf, tf2, cell, clamp01, mix, hash2 } from './tex.js';
import { drawStatusGrid, drawDataScroll, drawTelemetry, drawRadar, drawWorldMap, drawCCTV, drawSpectrum, drawCountdown, drawSequence, SANS, MONO, theme } from './draw.js';
import { chair, stool, monitor, keyboard, mug, papers, lightPanel, wallClock, crate, barrel, sandbags, cable, door, vent, plant, railing, whiteboard, laptop, stairs, tablet } from './props.js';
import { TAU, RNG, Q } from '../../../engine/common.js';
import { noise3 } from '../../../engine/proc.js';
import { infectable } from '../../../engine/infect.js';

const sstepL = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ======================================================================================= DATA CENTER
const rackFaceTex = () => pbr('rackFace', (u, v, o) => {
  const U = Math.floor(v * 42), fu = (v * 42) % 1; const unit = (U % 3 === 0) ? 2 : 1; const edge = fu < 0.06 || fu > 0.94;
  const bay = Math.floor(u * 8), fb = (u * 8) % 1; const slot = fb > 0.1 && fb < 0.9 && !edge && U % 7 !== 6;
  const l = edge ? 22 : slot ? 34 + hash2(U, bay, 3) * 14 : 18; o.r = l; o.g = l * 1.02; o.b = l * 1.1; o.h = slot ? 0.4 : 0.6; o.ro = 0.5;
  // LED dots on the left of each unit
  const led = !edge && fu > 0.35 && fu < 0.65 && ((u * 24) % 1 > 0.3 && (u * 24) % 1 < 0.7) && Math.floor(u * 24) % 2 === 0 && Math.floor(u * 24) < 12 && U % 7 !== 6;
  o.em = led ? 1 : 0; const c = hash2(Math.floor(u * 24), U, 9); if (c < 0.6) { o.er = 40; o.eg = 255; o.eb = 120; } else if (c < 0.85) { o.er = 60; o.eg = 170; o.eb = 255; } else { o.er = 255; o.eg = 170; o.eb = 40; }
}, { w: 256, h: 1024, strength: 2, rough: true, emissive: true });

export function createDataCenter(opts = {}) {
  const k = createKit('DataCenter', { seed: 81 });
  const W = 26, D = 30, H = 4.6, X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
  const cyan = k.glow(0x46c8ff, 1.8), green = k.glow(0x30ff70, 1.8), red = k.glow(0xff2a20, 2.4), white = k.glow(0xdfeaff, 2.4);
  // rack face material: blinking LEDs, infectable
  const t = rackFaceTex(); const rm = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 1, metalness: 0.5, vertexColors: false });
  rm.onBeforeCompile = (sh) => { sh.uniforms.uT = k.uTime; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;\nfloat hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec2 c = floor(vEmissiveMapUv * vec2(24.0, 42.0)); float r = hh(c + floor(uT * (1.5 + hh(c.yx) * 7.0))); totalEmissiveRadiance *= mix(0.1, 1.0, step(0.32, r)); }'); }; rm.customProgramCacheKey = () => 'rackBlink'; infectable(rm); k.defMat('rackFace', rm, { ao: false });
  // shell
  k.floorQuad('perf', W, D, [0, 0.0, 0], { color: 0x9aa0a8, tile: 0.6 }); k.floorQuad('paintDark', W, D, [0, -0.04, 0]); k.box('ceilingTile', [W, 0.3, D], [0, H + 0.15, 0], { color: 0xd8dce4 });
  k.wall('paintGrey', [X0, Z0], [X1, Z0], H, 0.3); k.wall('paintGrey', [X0, Z0], [X0, Z1], H, 0.3); k.wall('paintGrey', [X1, Z0], [X1, Z1], H, 0.3, { openings: [{ s: 3, w: 1.6, h: 2.3 }] }); k.wall('paintGrey', [X0, Z1], [X1, Z1], H, 0.3);
  k.box(cyan, [W - 1, 0.04, 0.05], [0, 0.04, Z0 + 0.2], { mirror: false }); k.box(cyan, [0.05, 0.04, D - 1], [X0 + 0.2, 0.04, 0], { mirror: false });
  // racks: 4 rows facing aisles
  const racks = []; const rowDefs = [[-6.8, Math.PI / 2], [-4.0, -Math.PI / 2], [4.0, Math.PI / 2], [6.8, -Math.PI / 2]];
  rowDefs.forEach(([x, yaw], ri) => {
    for (let i = 0; i < 22; i++) {
      const z = -D / 2 + 3.2 + i * 0.62; if (Math.abs(z) < 0.3 && ri % 2 === 0) { /* cross aisle */ }
      k.push(x, 0, z, yaw); k.box('blackMatte', [1.0, 2.25, 0.6], [0, 1.125, 0]); k.box('steelDark', [1.02, 0.05, 0.62], [0, 2.27, 0]); k.plane('rackFace', 0.58, 2.1, [0, 1.14, 0.302], { uv: 'native' }); k.box('perf', [0.58, 2.1, 0.01], [0, 1.14, 0.31], { color: 0x606870, tile: 0.5 }); k.pop(); racks.push([x, z]);
    }
  });
  // cold aisles: glass roofs + light strips, hot aisle cable trays
  for (const x of [-5.4, 5.4]) { k.box('glass', [1.5, 0.03, D - 6.5], [x, 2.45, 0], { mirror: false }); k.box(cyan, [0.04, 0.04, D - 6.5], [x - 0.5, 2.4, 0], { mirror: false }); k.box(cyan, [0.04, 0.04, D - 6.5], [x + 0.5, 2.4, 0], { mirror: false }); k.floorQuad(cyan, 1.1, D - 7, [x, 0.012, 0], { mirror: false }); k.pool(x, 0, 1.6, 0x46c8ff, 0.15, 0.03); }
  for (const x of [-8.2, -2.6, 2.6, 8.2]) { k.box('steelDark', [0.06, 0.1, D - 5], [x - 0.3, 3.5, 0]); k.box('steelDark', [0.06, 0.1, D - 5], [x + 0.3, 3.5, 0]); for (let z = -12; z <= 12; z += 0.5) k.box('steelDark', [0.6, 0.02, 0.03], [x, 3.47, z]); const r = new RNG(Math.round(x * 5)); for (let c = 0; c < 6; c++) k.rod('paintBlue', [x - 0.22 + c * 0.09, 3.55, -12.5], [x - 0.22 + c * 0.09, 3.55, 12.5], 0.025, { seg: 4, color: r.pick([0x2a5ac8, 0xd0a020, 0x30a050, 0xc03030, 0x909090]) }); }
  for (const z of [-11, -4, 4, 11]) for (const x of [-5.4, 5.4, 0]) lightPanel(k, x, H - 0.02, z, 1.2, 0.35, 0xdfeaff, 1.6);
  // centre aisle: cores
  const cores = [];
  for (let i = 0; i < 3; i++) {
    const z = -8 + i * 8; k.cyl('steelDark', [0.7, 0.8, 0.3], [0, 0.15, z], { seg: 24 }); k.cyl('steelDark', [0.7, 0.7, 0.2], [0, 3.55, z], { seg: 24 }); k.cyl('glass', [0.6, 0.6, 3.1], [0, 1.85, z], { seg: 24 });
    for (let j = 0; j < 14; j++) { k.cyl(j % 3 === 0 ? white : cyan, [0.42 - (j % 2) * 0.05, 0.42 - (j % 2) * 0.05, 0.03], [0, 0.5 + j * 0.2, z], { seg: 20 }); }
    k.cyl(cyan, [0.1, 0.1, 3.0], [0, 1.85, z], { seg: 8 }); k.pool(0, z, 2.0, 0x46c8ff, 0.2, 0.03); cores.push([0, z]);
    for (const s of [-1, 1]) k.rod('steelDark', [s * 0.6, 3.5, z], [s * 3.0, 3.5, z], 0.07, { seg: 6 });
  }
  // CRAC units & pipes along back wall; control desk
  for (let i = 0; i < 5; i++) { k.box('paintWhite', [1.8, 2.1, 0.9], [-9.5 + i * 2.2, 1.05, Z0 + 0.7]); k.box('blackPlastic', [1.5, 0.3, 0.02], [-9.5 + i * 2.2, 1.7, Z0 + 1.16]); k.box(green, [0.15, 0.05, 0.01], [-9.0 + i * 2.2, 1.7, Z0 + 1.17]); k.cyl('steel', [0.35, 0.35, 0.05], [-9.5 + i * 2.2, 0.8, Z0 + 1.16], { rx: Math.PI / 2, seg: 16 }); }
  k.rod('paintBlue', [X0 + 1, 3.2, Z0 + 0.4], [X1 - 1, 3.2, Z0 + 0.4], 0.12, { seg: 8, color: 0x3a70c8 }); k.rod('paintRed', [X0 + 1, 3.5, Z0 + 0.4], [X1 - 1, 3.5, Z0 + 0.4], 0.12, { seg: 8, color: 0xc84030 });
  const deskZ = Z1 - 2.0; k.box('paintDark', [6, 0.75, 0.9], [0, 0.375, deskZ]); k.box('blackPlastic', [6.1, 0.05, 1.0], [0, 0.775, deskZ]); const scr = [];
  for (let i = 0; i < 3; i++) scr.push(monitor(k, -1.8 + i * 1.8, 0.8, deskZ + 0.1, Math.PI, { w: 0.9, name: 'dc' + (i + 1), draw: [(c, w, h, tt, S) => drawStatusGrid(c, w, h, tt, S, { cols: 16, rows: 8 }), (c, w, h, tt, S) => drawTelemetry(c, w, h, tt, S, { rows: 4, theme: 'cyan', labels: ['CPU', 'NET', 'TEMP', 'POWER'] }), (c, w, h, tt, S) => drawDataScroll(c, w, h, tt, S, { theme: 'green' })][i], res: [384, 216], fps: 8, k: 1.0 }));
  for (let i = 0; i < 2; i++) chair(k, -1 + i * 2, deskZ - 1.0, Math.PI, { seat: 'fabricDark', tall: true });
  k.sign(1.6, 0.4, (c, w, h) => { c.fillStyle = '#10305a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * 0.5}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EEN CORE  HALL 2', w / 2, h / 2); }, [0, 3.2, Z0 + 0.17], { ppm: 150 });
  k.sph(red, 0.12, [X1 - 0.3, 3.8, Z1 - 0.3], { seg: 8 });
  k.light(new THREE.HemisphereLight(0xb8d0ff, 0x202428, 1.5), 'hemi'); const L1 = new THREE.PointLight(0xcfe4ff, 60, 26, 1.4); L1.position.set(0, 3.8, 0); k.light(L1, 'hall');
  k.anchor('aisleA', [-5.4, 0, 8], Math.PI).anchor('aisleB', [5.4, 0, 8], Math.PI).anchor('core0', [1.2, 0, cores[0][1]], -Math.PI / 2).anchor('core1', [1.2, 0, cores[1][1]], -Math.PI / 2).anchor('core2', [1.2, 0, cores[2][1]], -Math.PI / 2).anchor('desk', [0, 0, deskZ - 1.3], Math.PI).anchor('camWide', [0, 2.0, Z1 - 0.7], Math.PI).anchor('camAisle', [-5.4, 1.5, Z1 - 3.5], Math.PI).anchor('camCores', [0, 1.6, Z1 - 4], Math.PI).anchor('camHigh', [-9, 3.8, Z1 - 1], Math.PI + 0.5).anchor('door', [X1 - 1.2, 0, Z0 + 3.8], -Math.PI / 2);
  return k.api({ screen: scr[0], cores, bounds: { w: W, d: D, h: H } });
}

// ======================================================================================= BUNKER
export function createBunker(opts = {}) {
  const k = createKit('Bunker', { seed: 91 });
  const W = 12, D = 8, H = 2.9, X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
  const amber = k.glow(0xffc060, 2.4), red = k.glow(0xff2a20, 3.0), green = k.glow(0x30ff70, 2.0);
  k.floorQuad('concreteDark', W, D, [0, 0, 0]); k.box('concrete', [W, 0.3, D], [0, H + 0.15, 0], { color: 0xa0a0a0 });
  for (const [a, b] of [[[X0, Z0], [X1, Z0]], [[X0, Z0], [X0, Z1]], [[X1, Z0], [X1, Z1]]]) k.wall('concrete', a, b, H, 0.4, { color: 0xb0aca4 });
  k.wall('concrete', [X0, Z1], [X1, Z1], H, 0.4, { color: 0xb0aca4, openings: [{ s: 8.6, w: 1.5, h: 2.1 }] });
  for (let x = X0 + 1.5; x < X1; x += 3) k.box('concreteDark', [0.3, 0.22, D - 0.3], [x, H - 0.11, 0]); // ceiling beams
  for (let z = Z0 + 1; z < Z1; z += 2) { k.box('concreteDark', [0.18, H, 0.3], [X0 + 0.25, H / 2, z]); k.box('concreteDark', [0.18, H, 0.3], [X1 - 0.25, H / 2, z]); }
  // blast door (round hatch) on the front wall opening
  const dx = X0 + 8.6 + 0.75; k.push(dx, 0, Z1 - 0.1, Math.PI); k.box('steelDark', [1.8, 2.4, 0.3], [0, 1.2, 0]); k.cyl('steel', [0.85, 0.85, 0.2], [0, 1.05, 0.12], { rx: Math.PI / 2, seg: 28 }); k.torus('chrome', 0.45, 0.04, [0, 1.05, 0.26], { seg: 24, tseg: 5 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.rod('chrome', [0, 1.05, 0.26], [Math.cos(a) * 0.45, 1.05 + Math.sin(a) * 0.45, 0.26], 0.025, { seg: 5 }); } for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.cyl('steelDark', [0.05, 0.05, 0.08], [Math.cos(a) * 0.78, 1.05 + Math.sin(a) * 0.78, 0.2], { rx: Math.PI / 2, seg: 6 }); } k.box('paintYellow', [1.6, 0.1, 0.02], [0, 2.3, 0.16]); k.pop();
  // bunks: 3 two-tier beds along the left wall
  for (let i = 0; i < 3; i++) { const z = Z0 + 1.2 + i * 1.7; k.push(X0 + 1.1, 0, z, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.rod('steelDark', [sx * 0.95, 0, sz * 0.4], [sx * 0.95, 1.9, sz * 0.4], 0.03, { seg: 6 }); for (const y of [0.45, 1.3]) { k.box('steelDark', [1.95, 0.04, 0.86], [0, y, 0]); k.box('fabricOlive', [1.9, 0.12, 0.8], [0.0, y + 0.08, 0], { color: 0x6a7050 }); k.box('fabricGrey', [0.4, 0.1, 0.6], [-0.7, y + 0.18, 0]); k.box('fabricOlive', [1.3, 0.07, 0.78], [0.3, y + 0.17, 0], { color: [0x58603c, 0x80704c, 0x4a5a48][i] }); } k.pop(); }
  // radio rack & operator desk (back wall)
  k.box('paintDark', [2.4, 0.8, 0.8], [X1 - 2.6, 0.4, Z0 + 0.6]); k.box('woodDark', [2.5, 0.05, 0.9], [X1 - 2.6, 0.82, Z0 + 0.6]);
  const rrx = X1 - 2.6; for (let i = 0; i < 4; i++) { k.box('steelDark', [0.5, 0.2 + (i % 2) * 0.08, 0.3], [rrx - 0.8 + i * 0.55, 0.96 + (i % 2) * 0.04, Z0 + 0.5]); k.box('blackPlastic', [0.4, 0.1, 0.01], [rrx - 0.8 + i * 0.55, 0.97 + (i % 2) * 0.04, Z0 + 0.655]); k.box(green, [0.3, 0.02, 0.005], [rrx - 0.8 + i * 0.55, 0.99 + (i % 2) * 0.04, Z0 + 0.662]); k.cyl('chrome', [0.025, 0.025, 0.02], [rrx - 0.65 + i * 0.55, 0.93, Z0 + 0.66], { rx: Math.PI / 2, seg: 6 }); k.cyl('chrome', [0.025, 0.025, 0.02], [rrx - 0.95 + i * 0.55, 0.93, Z0 + 0.66], { rx: Math.PI / 2, seg: 6 }); }
  k.cyl('blackMatte', [0.2, 0.2, 0.12], [rrx + 0.9, 1.0, Z0 + 0.6], { rx: Math.PI / 2, seg: 14 }); k.rod('steel', [rrx + 1.0, 1.0, Z0 + 0.4], [rrx + 1.0, 2.6, Z0 + 0.2], 0.012, { seg: 4 }); k.box('blackPlastic', [0.3, 0.05, 0.2], [rrx - 1.0, 0.85, Z0 + 0.95]); chair(k, rrx, Z0 + 1.5, Math.PI, { seat: 'fabricDark', tall: false }); k.cyl('paintOlive', [0.03, 0.03, 0.02], [rrx - 0.5, 0.85, Z0 + 0.95], { seg: 6 });
  const cctv = monitor(k, X1 - 0.9, 0.84, Z0 + 0.55, 0.7, { w: 0.45, name: 'cctv', draw: (c, w, h, tt, S) => drawCCTV(c, w, h, tt, S, { seed: 4 }), res: [320, 180], fps: 6, k: 1.0 });
  // map table
  k.box('woodDark', [2.0, 0.07, 1.2], [0.2, 0.85, 0.3]); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('woodDark', [0.07, 0.82, 0.07], [0.2 + sx * 0.92, 0.41, 0.3 + sz * 0.52]);
  const mapScr = k.screen({ name: 'map', w: 1.8, h: 1.0, draw: (c, w, h, tt, S) => drawWorldMap(c, w, h, tt, S, { theme: 'amber', title: 'SURVIVOR NET', labels: false }), fps: 6, res: [512, 290], k: 0.95, mirror: false }, [0.2, 0.89, 0.3], { rx: -Math.PI / 2 });
  for (const [x, z, ry] of [[-1.0, 0.3, Math.PI / 2], [1.4, 0.3, -Math.PI / 2], [0.2, -0.6, 0]]) chair(k, x, z, ry + 0, { seat: 'fabricDark', tall: false }); mug(k, 1.0, 0.89, 0.6); papers(k, -0.5, 0.89, 0.6, 0.3, 2);
  k.cyl(amber, [0.07, 0.07, 0.14], [0.3, 0.96, 0.0], { seg: 8 }); k.cyl('steelDark', [0.09, 0.09, 0.04], [0.3, 0.9, 0.0], { seg: 8 });
  // wall map + shelves + crates + barrels + lockers
  k.sign(2.2, 1.4, (c, w, h) => { c.fillStyle = '#c8bc98'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(80,70,50,0.5)'; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(0, h * i / 12); c.lineTo(w, h * i / 12); c.stroke(); c.beginPath(); c.moveTo(w * i / 12, 0); c.lineTo(w * i / 12, h); c.stroke(); } c.fillStyle = 'rgba(90,120,80,0.6)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(w * (0.15 + (i * 0.37 % 0.7)), h * (0.2 + (i * 0.23 % 0.6)), w * 0.1, h * 0.08, i, 0, TAU); c.fill(); } for (let i = 0; i < 14; i++) { c.fillStyle = i % 4 ? '#d03020' : '#2060d0'; c.beginPath(); c.arc(w * ((i * 0.31) % 0.9 + 0.05), h * ((i * 0.47) % 0.8 + 0.1), 5, 0, TAU); c.fill(); } }, [0.2, 1.7, Z0 + 0.22], { ppm: 120 });
  for (const [x, z] of [[X1 - 0.6, -1.0], [X1 - 0.6, 0.0], [X1 - 0.6, 1.0]]) crate(k, x, z, 0.7, 0.1, 'wood'); crate(k, X1 - 0.6, 0.0, 0.6, 0, 'wood', 0.56); barrel(k, X0 + 1.2, Z1 - 0.7, 0x3a5a8a, 0.9); barrel(k, X0 + 1.9, Z1 - 0.7, 0x3a5a8a, 0.9); barrel(k, X0 + 2.6, Z1 - 0.7, 0x4a5a3a, 0.9);
  for (let i = 0; i < 3; i++) { k.box('paintOlive', [0.6, 1.9, 0.5], [X0 + 4.2 + i * 0.62, 0.95, Z1 - 0.45]); k.box('blackPlastic', [0.04, 0.12, 0.02], [X0 + 4.4 + i * 0.62, 1.0, Z1 - 0.7]); }
  for (let i = 0; i < 4; i++) { k.part('paintOlive', new THREE.SphereGeometry(0.1, 8, 6), [X0 + 6.0 + i * 0.2, 1.7, Z1 - 0.2], { sy: 1.2, color: 0x5a5a40 }); }
  // overhead pipes, vent fan (dynamic), cage lamps, emergency beacon
  for (const [y, r] of [[2.65, 0.07], [2.45, 0.045]]) k.rod('steel', [X0 + 0.4, y, Z0 + 0.5], [X1 - 0.4, y, Z0 + 0.5], r, { seg: 8 }); k.box('steelDark', [0.5, 0.4, D - 1], [X1 - 1.5, 2.55, 0]);
  for (const [x, z] of [[-3.5, 0], [0, 1.5], [3.5, -0.5]]) { k.rod('blackMatte', [x, H, z], [x, H - 0.25, z], 0.01, { seg: 4 }); k.sph(amber, 0.07, [x, H - 0.3, z], { seg: 8 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.rod('steelDark', [x + Math.cos(a) * 0.09, H - 0.22, z + Math.sin(a) * 0.09], [x + Math.cos(a) * 0.09, H - 0.39, z + Math.sin(a) * 0.09], 0.004, { seg: 3 }); } }
  const fan = k.sub('fan'); fan.cyl('steelDark', [0.28, 0.28, 0.06], [0, 0, 0], { seg: 16, rx: Math.PI / 2 }); for (let i = 0; i < 4; i++) fan.box('steel', [0.5, 0.06, 0.02], [0, 0, 0.04], { rz: i * Math.PI / 4 + 0.2 }); const fanG = k.attach(fan, [X0 + 0.22, 2.1, -1.5], { ry: Math.PI / 2 });
  const beacon = new THREE.Group(); beacon.position.set(X0 + 4, H - 0.05, 2.6); k.dyn.add(beacon); const bm = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); bm.rotation.z = Math.PI / 2; bm.position.x = -1.2; beacon.add(bm);
  k.cyl('steelDark', [0.12, 0.14, 0.06], [X0 + 4, H - 0.03, 2.6], { seg: 12 }); k.sph(red, 0.1, [X0 + 4, H - 0.12, 2.6], { seg: 10 }); k.cyl(red, [0.025, 0.025, 0.02], [X1 - 0.3, 2.4, Z0 + 0.5], { seg: 6 });
  k.sign(0.9, 0.3, (c, w, h) => { c.fillStyle = '#c8a010'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = `900 ${h * 0.5}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SHELTER 14', w / 2, h / 2); }, [X0 + 8.6 + 0.75 - 2.2, 2.4, Z1 - 0.21], { ry: Math.PI, ppm: 130 });
  wallClock(k, X1 - 0.22, 2.2, 1.5, -Math.PI / 2, 0.18);
  k.light(new THREE.HemisphereLight(0xb0a898, 0x201c18, 1.3), 'hemi'); const L1 = new THREE.PointLight(0xffc880, 22, 12, 1.5); L1.position.set(0, 2.5, 0.5); k.light(L1, 'bulbs'); const L2 = new THREE.PointLight(0xff2010, 8, 9, 1.5); L2.position.set(X0 + 4, 2.4, 2.6); k.light(L2, 'emergency');
  k.onUpdate((dt, t) => { fanG.children[0].rotation.z = t * 9; beacon.rotation.y = t * 3.2; const on = 0.5 + 0.5 * Math.sin(t * 3.2); L2.intensity = 4 + 9 * on; });
  [['bunk0', X0 + 1.9, Z0 + 1.2], ['bunk1', X0 + 1.9, Z0 + 2.9], ['bunk2', X0 + 1.9, Z0 + 4.6]].forEach(([n, x, z]) => k.anchor(n, [x, 0, z], Math.PI / 2));
  k.anchor('radio', [X1 - 2.6, 0, Z0 + 1.3], Math.PI).anchor('mapTable', [0.2, 0, 1.2], Math.PI).anchor('mapTableB', [0.2, 0, -0.6], 0).anchor('door', [X0 + 8.6 + 0.75, 0, Z1 - 1.0], Math.PI).anchor('camWide', [X0 + 1.4, 1.7, Z1 - 0.7], 0.5 + Math.PI / 2 - 0.3 + 2.3 - 1.57).anchor('camRadio', [X1 - 4.6, 1.5, Z0 + 3], Math.PI + 0.5).anchor('camBunks', [X1 - 3, 1.5, 1.2], Math.PI / 2 + 0.2).anchor('camTable', [-1.0, 1.5, 2.8], Math.PI - 0.2).anchor('camDoor', [0, 1.5, Z0 + 1.0], 0);
  k.anchors.camWide = { pos: [X0 + 1.4, 1.7, Z1 - 0.7], yaw: Math.atan2(X1 - (X0 + 1.4), Z0 - (Z1 - 0.7)) };
  return k.api({ screen: mapScr, cctv, bounds: { w: W, d: D, h: H }, setAlert: (a) => { k.state.alert = a; } });
}

// ======================================================================================= COMMAND POST
export function createCommandPost(opts = {}) {
  const k = createKit('CommandPost', { seed: 101 });
  const G = 44; const green = k.glow(0x30ff70, 2.0), amber = k.glow(0xffc060, 2.4), red = k.glow(0xff2a20, 2.6);
  k.floorQuad('dirt', G, G, [0, 0, 0], { tile: 5 });
  for (const [x, z, w, d] of [[-6, 3, 9, 7], [8, -6, 6, 5]]) k.floorQuad('concreteRough', w, d, [x, 0.004, z], { color: 0x9a8a70, mirror: false });
  // tent: 14 x 7 gabled, open front (+Z)
  const TW = 14, TD = 7, TH = 2.4, RH = 3.7, TZ = -2;
  const roofL = Math.hypot(TD / 2, RH - TH); const ang = Math.atan2(RH - TH, TD / 2);
  for (const s of [-1, 1]) { k.box('canvas', [TW + 0.4, 0.05, roofL + 0.3], [0, (TH + RH) / 2, TZ + s * TD / 4], { rx: -s * ang * -1, color: 0xcdd4b0 }); }
  k.box('canvas', [TW, TH, 0.05], [0, TH / 2, TZ - TD / 2], { color: 0xc4cca8 }); for (const s of [-1, 1]) { k.box('canvas', [0.05, TH, TD], [s * TW / 2, TH / 2, TZ], { color: 0xc4cca8 }); }
  // gable ends (triangles) back; front open with rolled flaps
  const tri = new THREE.Shape(); tri.moveTo(-TD / 2, 0); tri.lineTo(TD / 2, 0); tri.lineTo(0, RH - TH); tri.closePath(); const triG = new THREE.ShapeGeometry(tri);
  for (const s of [-1, 1]) k.part('canvas', triG, [s * TW / 2, TH, TZ], { ry: Math.PI / 2, color: 0xc4cca8 });
  for (const x of [-TW / 2, -TW / 4, 0, TW / 4, TW / 2]) { k.rod('steelDark', [x, 0, TZ + TD / 2], [x, TH, TZ + TD / 2], 0.04, { seg: 6 }); k.rod('steelDark', [x, TH, TZ + TD / 2], [x, RH, TZ], 0.03, { seg: 5 }); k.rod('steelDark', [x, TH, TZ - TD / 2], [x, RH, TZ], 0.03, { seg: 5 }); }
  k.rod('steelDark', [-TW / 2, RH, TZ], [TW / 2, RH, TZ], 0.05, { seg: 6 });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = s * (TW / 2 + 0.9 + i * 0.0); } // (guys omitted)
  for (const x of [-TW / 2, TW / 2]) for (const z of [TZ + TD / 2, TZ - TD / 2]) { k.rod('rubber', [x, TH, z], [x * 1.35, 0, z * (z > 0 ? 1.45 : 1.0) + (z > 0 ? 0 : -1.5)], 0.01, { seg: 3 }); }
  // interior: floor mat, map table, radios, laptops, chairs, lamps
  k.floorQuad('fabricOlive', TW - 0.4, TD - 0.4, [0, 0.012, TZ], { mirror: false, color: 0x6a6a50 });
  k.box('woodLight', [3.0, 0.06, 1.6], [-2.5, 0.84, TZ + 0.3]); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.rod('steelDark', [-2.5 + sx * 1.35, 0, TZ + 0.3 + sz * 0.7], [-2.5 + sx * 1.35, 0.82, TZ + 0.3 + sz * 0.7], 0.025, { seg: 5 });
  const mapScr = k.screen({ name: 'map', w: 2.8, h: 1.45, draw: (c, w, h, t, S) => drawWorldMap(c, w, h, t, S, { theme: 'green', title: 'FIELD COMMAND', labels: true }), fps: 6, res: [512, 270], k: 0.95, mirror: false }, [-2.5, 0.875, TZ + 0.3], { rx: -Math.PI / 2 });
  for (let i = 0; i < 4; i++) { k.cyl('chrome', [0.2, 0.2, 0.02], [-3.7 + i * 0.7, 0.45, TZ + 1.5], { seg: 10 }); chair(k, -3.7 + i * 0.7, TZ + 1.5, Math.PI, { seat: 'fabricOlive', frame: 'steelDark', arms: false, h: 0.45 }); }
  k.box('paintOlive', [3.4, 0.05, 0.9], [3.2, 0.78, TZ - 2.3]); for (const sx of [-1, 1]) k.rod('steelDark', [3.2 + sx * 1.6, 0, TZ - 2.3], [3.2 + sx * 1.6, 0.76, TZ - 2.3], 0.025, { seg: 5 });
  const lp1 = laptop(k, 2.4, 0.805, TZ - 2.3, 0, { name: 'laptop1', draw: (c, w, h, t, S) => drawDataScroll(c, w, h, t, S, { theme: 'green' }) }); const lp2 = laptop(k, 3.4, 0.805, TZ - 2.3, 0.2, { name: 'laptop2', draw: (c, w, h, t, S) => drawRadar(c, w, h, t, S, { theme: 'green' }) });
  for (let i = 0; i < 3; i++) { k.rbox('paintOlive', [0.36, 0.2, 0.3], [4.1 + i * 0.0, 0.9 + i * 0.22, TZ - 2.3 - 0.0], { r: 0.02 }); k.box(green, [0.2, 0.03, 0.005], [4.1, 0.95 + i * 0.22, TZ - 2.14], { mirror: false }); k.rod('steelDark', [4.0, 1.0 + i * 0.22, TZ - 2.3], [4.0, 1.9 + i * 0.22, TZ - 2.3], 0.008, {}); }
  chair(k, 3.2, TZ - 1.4, Math.PI, { seat: 'fabricOlive', frame: 'steelDark', arms: false, h: 0.45 });
  for (const [x, z] of [[-6.2, TZ - 2], [6.2, TZ + 1.8]]) { crate(k, x, z, 0.7, 0.2, 'paintOlive'); crate(k, x + 0.75, z + 0.1, 0.6, 0, 'paintOlive'); }
  k.cyl('steelDark', [0.03, 0.03, 2.2], [-0.2, 1.1, TZ - 0.8], { seg: 6 }); k.sph(amber, 0.1, [-0.2, 2.25, TZ - 0.8], { seg: 8 }); k.rod('blackMatte', [4.8, 3.0, TZ - 2.0], [4.8, 2.4, TZ - 2.0], 0.01, {}); k.sph(amber, 0.08, [4.8, 2.35, TZ - 2.0], { seg: 8 });
  // outside: generator + cables, jerry cans, antenna mast, sandbags, camo net, light tripods, signboard
  k.box('paintOlive', [2.2, 1.2, 1.0], [-10, 0.6, 6]); k.box('steelDark', [2.0, 0.1, 0.9], [-10, 1.25, 6]); k.cyl('steelDark', [0.1, 0.1, 1.4], [-9.3, 1.9, 5.6], { seg: 8 }); k.box('blackPlastic', [0.5, 0.35, 0.02], [-10.6, 0.8, 6.51]); k.box(green, [0.08, 0.04, 0.005], [-10.7, 0.85, 6.52], { mirror: false });
  cable(k, [-9, 0.3, 6.3], [-6.5, 0.02, TZ + TD / 2 - 0.3], 0.03, 0.05, 'blackMatte', { mirror: false }); cable(k, [-9, 0.3, 6.3], [-1, 0.02, TZ + TD / 2 + 0.2], 0.025, 0.04, 'blackMatte', { mirror: false });
  for (let i = 0; i < 5; i++) { const x = -8.2 + (i % 3) * 0.4, z = 7.7 + (i >> 1) * 0.4; k.box('paintOlive', [0.34, 0.5, 0.16], [x, 0.25, z], { ry: i }); k.box('blackPlastic', [0.12, 0.06, 0.1], [x, 0.53, z], { ry: i }); }
  // mast
  const MX = 11, MZ = 3; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { k.rod('steel', [MX + sx * 0.35, 0, MZ + sz * 0.35], [MX + sx * 0.12, 15, MZ + sz * 0.12], 0.025, { seg: 4 }); } for (let y = 0.6; y < 15; y += 0.9) { const s = 0.35 - y * 0.0153; k.rod('steel', [MX - s, y, MZ - s], [MX + s, y + 0.9, MZ - s], 0.01, { seg: 3 }); k.rod('steel', [MX + s, y, MZ + s], [MX - s, y + 0.9, MZ + s], 0.01, { seg: 3 }); }
  k.rod('steel', [MX, 15, MZ], [MX, 18, MZ], 0.02, { seg: 4 }); k.cyl(red, [0.06, 0.06, 0.08], [MX, 18.05, MZ], { seg: 6 }); for (const [sx, sz] of [[1, 0], [-1, 0.5], [0, -1]]) { for (const h of [8, 14]) k.rod('rubber', [MX, h, MZ], [MX + sx * 7 * (h > 10 ? 0.6 : 1), 0, MZ + sz * 7 * (h > 10 ? 0.6 : 1)], 0.008, { seg: 3 }); } k.cyl('steelDark', [0.5, 0.6, 0.12], [MX, 0.06, MZ], { seg: 10 });
  k.box('paintOlive', [1.2, 1.1, 0.8], [MX - 1.5, 0.55, MZ + 0.5]); k.box(green, [0.2, 0.05, 0.005], [MX - 1.5, 0.8, MZ + 0.91], { mirror: false });
  // sandbag walls
  sandbags(k, -9, 9, 2, 10.5, 4); sandbags(k, 2, 10.5, 14, 8, 4); sandbags(k, 14, 8, 14, -2, 3); sandbags(k, -10, 4.5, -10, 9, 3);
  // camo net over generator area
  const net = new THREE.PlaneGeometry(6, 5, 8, 6); { const p = net.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.1) * 0.12 + Math.cos(p.getY(i) * 1.7) * 0.1); net.computeVertexNormals(); } k.part('camo', net, [-9, 2.6, 6.5], { rx: -Math.PI / 2 + 0.15, uv: 'box' }); for (const [x, z] of [[-11.8, 4.5], [-6.2, 4.5], [-11.8, 8.5], [-6.2, 8.5]]) k.rod('steelDark', [x, 0, z], [x, 2.5, z], 0.04, { seg: 5 });
  // flood tripod lights
  for (const [x, z] of [[5, 4], [-4, 6]]) { for (let i = 0; i < 3; i++) { const a = i * TAU / 3; k.rod('steelDark', [x, 2.0, z], [x + Math.cos(a) * 0.5, 0, z + Math.sin(a) * 0.5], 0.02, { seg: 4 }); } k.box('blackPlastic', [0.5, 0.35, 0.15], [x, 2.15, z], { ry: 0.5 }); k.box(k.glow(0xfff0d0, 3.0), [0.42, 0.28, 0.02], [x + 0.06, 2.15, z + 0.1], { ry: 0.5 }); }
  k.sign(1.4, 0.5, (c, w, h) => { c.fillStyle = '#d8d4c0'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = `bold ${h * 0.34}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FWD CMD POST', w / 2, h * 0.36); c.font = `bold ${h * 0.22}px ${SANS}`; c.fillText('AUTHORISED ONLY', w / 2, h * 0.72); }, [4, 1.25, TZ + TD / 2 + 3.2], { ppm: 120 }); k.rod('woodDark', [4 - 0.6, 0, TZ + TD / 2 + 3.2], [4 - 0.6, 1.5, TZ + TD / 2 + 3.2], 0.03, {}); k.rod('woodDark', [4 + 0.6, 0, TZ + TD / 2 + 3.2], [4 + 0.6, 1.5, TZ + TD / 2 + 3.2], 0.03, {});
  const sun = new THREE.DirectionalLight(0xfff0e0, 2.0); sun.position.set(14, 22, 10); k.light(sun, 'sun'); k.light(new THREE.HemisphereLight(0xbcd0ff, 0x4a4030, 0.9), 'hemi'); const lamp = new THREE.PointLight(0xffc880, 18, 9, 1.6); lamp.position.set(-0.2, 2.3, TZ - 0.8); k.light(lamp, 'lantern');
  k.anchor('mapTableA', [-2.5, 0, TZ + 1.5], Math.PI).anchor('mapTableB', [-2.5, 0, TZ - 0.9], 0).anchor('commander', [-2.5, 0, TZ + 1.5], Math.PI).anchor('radioOp', [3.2, 0, TZ - 1.4], Math.PI).anchor('tentFront', [0, 0, TZ + TD / 2 + 1], 0).anchor('generator', [-10, 0, 7.3], 0).anchor('mast', [MX, 0, MZ + 1.2], 0).anchor('sentryA', [-3, 0, 9.2], Math.PI).anchor('sentryB', [10.5, 0, 7.5], -2.4)
    .anchor('camWide', [-4, 2.4, 14], Math.PI + 0.25).anchor('camTent', [0, 1.6, TZ + TD / 2 + 4], Math.PI).anchor('camInside', [-5.5, 1.7, TZ + 2.8], Math.PI + 0.9).anchor('camMast', [6, 1.4, 8], Math.PI + 0.6).anchor('camHigh', [-12, 6, 15], Math.PI + 0.65);
  return k.api({ screen: mapScr, bounds: { w: G, d: G, h: 18 } });
}

// ======================================================================================= LAUNCH SITE
export function createLaunchSite(opts = {}) {
  const withMissile = opts.missile !== false;
  const k = createKit('LaunchSite', { seed: 111 });
  const red = k.glow(0xff2a20, 2.6), green = k.glow(0x30ff70, 2.0), white = k.glow(0xfff4e0, 3.0);
  const G = 160;
  k.floorQuad('dirt', G, G, [0, -0.02, 0], { tile: 8 });
  k.floorQuad('concreteRough', 56, 40, [0, 0.0, 0], { tile: 5 }); k.box('concreteRough', [56.4, 0.3, 0.4], [0, 0.1, -20.2]); k.box('concreteRough', [56.4, 0.3, 0.4], [0, 0.1, 20.2]);
  // pad markings
  k.part('paintYellow', new THREE.RingGeometry(10.5, 10.8, 72), [0, 0.012, 0], { rx: -Math.PI / 2 }); k.part('paintWhite', new THREE.RingGeometry(6.0, 6.15, 72), [0, 0.012, 0], { rx: -Math.PI / 2, color: 0xdddddd });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box('hazard', [0.7, 0.01, 2.0], [Math.sin(a) * 12.4, 0.013, Math.cos(a) * 12.4], { ry: a, tile: 1.0 }); }
  for (let z = -16; z <= 16; z += 4) k.box('paintWhite', [0.25, 0.01, 1.8], [-20, 0.013, z], { color: 0xdddddd });
  // flame trench & launch mount
  k.box('concreteDark', [3.2, 0.1, 14], [0, -0.2, 0]); k.box('concrete', [0.8, 1.0, 14], [-2.0, 0.5, 0]); k.box('concrete', [0.8, 1.0, 14], [2.0, 0.5, 0]); k.box('steelDark', [4.8, 0.5, 4.8], [0, 1.05, 0]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { k.rod('steel', [sx * 1.9, 1.3, sz * 1.9], [sx * 0.9, 2.6, sz * 0.9], 0.14, { seg: 8 }); }
  k.cyl('steelDark', [1.3, 1.5, 0.3], [0, 2.6, 0], { seg: 24 });
  const mis = [];
  if (withMissile) {
    const prof1 = [[0.001, 2.75], [1.0, 2.75], [1.0, 11.5], [0.95, 11.7], [0.95, 12.2]], prof2 = [[0.95, 12.2], [0.9, 12.4], [0.9, 19], [0.001, 19.1]];
    k.lathe('whitePlastic', prof1, [0, 0, 0], { seg: 28, color: 0xe8e8e0 }); k.lathe('paintGrey', prof2.map((p) => [Math.max(0.001, p[0]), p[1]]), [0, 0, 0], { seg: 28, color: 0xc8cac8 });
    k.lathe('paintDark', [[0.001, 19], [0.9, 19], [0.82, 20.3], [0.5, 22.4], [0.001, 23.6]], [0, 0, 0], { seg: 28 });
    for (const y of [4, 8, 14]) k.cyl('blackPlastic', [1.005, 1.005, 0.5], [0, y, 0], { seg: 28 }); k.cyl('paintRed', [1.005, 1.005, 0.18], [0, 11.0, 0], { seg: 28 });
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; k.part('paintGrey', new THREE.BoxGeometry(0.1, 2.2, 1.2), [Math.sin(a) * 1.4, 3.7, Math.cos(a) * 1.4], { ry: a, rx: 0 }); }
    k.cyl('steelDark', [0.7, 0.9, 0.5], [0, 2.9, 0], { seg: 20 });
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; k.cyl('steelDark', [0.3, 0.38, 0.5], [Math.sin(a) * 0.5, 2.55, Math.cos(a) * 0.5], { seg: 12 }); }
    mis.push(true);
    // umbilical gantry tower
    const GX = 5.2; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.rod('paintRed', [GX + sx * 1.1, 0, sz * 1.1], [GX + sx * 1.1, 27, sz * 1.1], 0.12, { seg: 6, color: 0xb83a30 });
    for (let y = 0; y < 27; y += 3) { for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { k.rod('paintRed', [GX + a[0] * 1.1, y, a[1] * 1.1], [GX + b[0] * 1.1, y + 3, b[1] * 1.1], 0.05, { seg: 4, color: 0xb83a30 }); k.rod('paintRed', [GX + a[0] * 1.1, y + 3, a[1] * 1.1], [GX + b[0] * 1.1, y, b[1] * 1.1], 0.035, { seg: 4, color: 0xb83a30 }); } if (y % 9 === 3) { k.box('steelDark', [2.6, 0.12, 2.6], [GX, y, 0]); } }
    for (const y of [8.5, 15.5, 21.5]) { k.rod('steel', [GX - 1.1, y, 0], [0.9, y, 0], 0.16, { seg: 6 }); k.box('steelDark', [0.4, 0.4, 0.4], [0.9, y, 0]); k.rod('blackMatte', [0.9, y - 0.2, 0], [0.6, y - 4, 0.0], 0.04, { seg: 4 }); }
    k.rod('steel', [GX, 27, 0], [GX - 3, 28.5, 0], 0.1, { seg: 5 }); k.sph(red, 0.2, [GX, 27.6, 0], { seg: 8 });
  }
  // fuel truck area (right)
  const truck = (x, z, ry) => { k.push(x, 0, z, ry); k.box('paintOlive', [2.4, 1.0, 5.0], [0, 1.0, 1.5]); k.box('paintOlive', [2.3, 1.5, 2.1], [0, 1.9, -2.5], { color: 0x56603c }); k.box('glassTint', [2.0, 0.6, 0.03], [0, 2.1, -3.58]); k.cyl('steel', [1.05, 1.05, 5.8], [0, 2.3, 1.4], { rx: Math.PI / 2, seg: 24 }); for (const z of [-2.8, 0.2, 1.4, 2.8]) for (const sx of [-1, 1]) { k.cyl('rubber', [0.55, 0.55, 0.4], [sx * 1.2, 0.55, z], { rz: Math.PI / 2, seg: 14 }); } k.cyl('paintYellow', [1.06, 1.06, 0.3], [0, 2.3, 1.4], { rx: Math.PI / 2, seg: 24 }); k.box('paintRed', [1.2, 0.5, 0.05], [0, 1.2, 4.0]); k.pop(); };
  truck(18, -8, -0.3); truck(22, -8.4, -0.35); truck(26, -9, -0.25);
  for (const [x, z] of [[17, 8], [19, 8.5], [21, 8]]) barrel(k, x, z, 0xb83a30, 0.9);
  k.box('paintOlive', [6, 2.6, 2.4], [-20, 1.3, -10]); k.box('steelDark', [1.0, 2.0, 0.05], [-20, 1.0, -8.8]); k.box('blackPlastic', [4, 0.6, 0.05], [-20, 1.8, -8.78]); k.box(green, [0.2, 0.1, 0.02], [-19, 2.4, -8.77], { mirror: false });
  const ctrlScr = k.screen({ name: 'launchControl', w: 1.6, h: 0.8, draw: (c, w, h, t, S) => drawCountdown(c, w, h, t, S, { start: 180, theme: 'amber', label: 'LAUNCH' }), fps: 2, res: [256, 128], k: 1.1 }, [-18.4, 1.8, -8.74]);
  // camo nets
  for (const [x, z, w, d] of [[-20, -10, 10, 7], [-20, 8, 8, 6], [22, -8.5, 14, 8]]) { const n = new THREE.PlaneGeometry(w, d, 10, 8); const p = n.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.9) * 0.18 + Math.cos(p.getY(i) * 1.2) * 0.15); n.computeVertexNormals(); k.part('camo', n, [x, 3.6, z], { rx: -Math.PI / 2, uv: 'box' }); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.rod('steelDark', [x + sx * w / 2 * 0.92, 0, z + sz * d / 2 * 0.92], [x + sx * w / 2 * 0.92, 3.5, z + sz * d / 2 * 0.92], 0.06, { seg: 5 }); }
  // floodlight towers + fence
  for (const [x, z] of [[-26, -18], [26, -18], [-26, 18], [26, 18]]) { k.rod('steel', [x, 0, z], [x, 11, z], 0.16, { seg: 8 }); for (let i = 0; i < 3; i++) k.box('blackPlastic', [0.8, 0.5, 0.2], [x - 0.4 + i * 0.5, 11.3, z + 0.1], { ry: 0.4 }), k.box(white, [0.7, 0.4, 0.03], [x - 0.4 + i * 0.5 + 0.05, 11.3, z + 0.22], { ry: 0.4 }); k.pool(x * 0.6, z * 0.6, 8, 0xfff0d0, 0.1, 0.03); }
  for (let i = -30; i <= 30; i += 3) for (const z of [-24, 24]) { k.rod('steel', [i, 0, z], [i, 2.2, z], 0.04, { seg: 4 }); } k.rod('steel', [-30, 2.1, -24], [30, 2.1, -24], 0.012, { seg: 3 }); k.rod('steel', [-30, 2.1, 24], [30, 2.1, 24], 0.012, { seg: 3 }); k.rod('steel', [-30, 1.2, -24], [30, 1.2, -24], 0.012, { seg: 3 }); k.rod('steel', [-30, 1.2, 24], [30, 1.2, 24], 0.012, { seg: 3 });
  // mountain backdrop ring
  { const N = 120, M = 8, r0 = 120, r1 = 340, P = [], I = [], U = []; for (let j = 0; j <= N; j++) { const a = j / N * TAU; const Hh = 45 + 85 * (noise3(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 3.3) * 0.5 + 0.5) + 30 * Math.sin(a * 5.0 + 1.0); for (let i = 0; i <= M; i++) { const t = i / M, r = r0 + (r1 - r0) * t, y = Hh * Math.pow(Math.sin(Math.min(1, t * 1.1) * Math.PI / 2), 1.5) * (0.85 + 0.3 * noise3(a * 7, t * 4, 1.1)) - 2 + noise3(a * 25, t * 9, 2.2) * 6 * t; P.push(Math.sin(a) * r, Math.max(-2, y), Math.cos(a) * r); U.push(j * 0.35, i * 0.8); } } for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) { const a = j * (M + 1) + i, b = a + 1, c = a + M + 1, d = c + 1; I.push(a, b, c, b, d, c); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); k.part('concreteRough', g, [0, 0, 0], { color: 0x6a6a58, us: 2, vs: 2 }); }
  const sun = new THREE.DirectionalLight(0xfff0e0, 2.6); sun.position.set(-30, 40, 20); k.light(sun, 'sun'); k.light(new THREE.HemisphereLight(0xbcd0ff, 0x6a5a40, 0.9), 'hemi');
  k.anchor('telPad', [0, 0.02, 0], 0).anchor('missile', [0, 2.75, 0], 0).anchor('gantry', [5.2, 0, 0], 0).anchor('fuelTrucks', [22, 0, -8.4], Math.PI / 2).anchor('controlCabin', [-20, 0, -7.4], Math.PI).anchor('crewA', [4, 0, 8], Math.PI).anchor('crewB', [-6, 0, 9], Math.PI)
    .anchor('camWide', [-16, 3.2, 24], Math.PI + 0.55).anchor('camPad', [8, 1.8, 15], Math.PI + 0.3).anchor('camLow', [0.5, 0.5, 12], Math.PI).anchor('camMountain', [-40, 2.2, 30], Math.PI + 0.7).anchor('camTower', [14, 18, 12], Math.PI + 0.7);
  return k.api({ screen: ctrlScr, hasMissile: withMissile, bounds: { w: 60, d: 50, h: withMissile ? 28 : 12 } });
}

// ======================================================================================= SILO CONTROL
export function createSiloControl(opts = {}) {
  const k = createKit('SiloControl', { seg: 1, seed: 121 });
  const W = 9, D = 6.5, H = 3.0, X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
  const redG = k.glow(0xff2a20, 2.6), greenG = k.glow(0x30ff70, 2.0), amber = k.glow(0xffb040, 2.2), cyan = k.glow(0x46c8ff, 1.6);
  const redM = k.mat(redG), greenM = k.mat(greenG);
  k.floorQuad('epoxyGreen', W, D, [0, 0, 0], { color: 0x90a898 }); k.box('paintGrey', [W, 0.3, D], [0, H + 0.15, 0], { color: 0xb8bcc0 });
  k.wall('paintGreen', [X0, Z0], [X1, Z0], H, 0.3, { color: 0xa8b8a8 }); k.wall('paintGreen', [X0, Z0], [X0, Z1], H, 0.3, { color: 0xa8b8a8 }); k.wall('paintGreen', [X1, Z0], [X1, Z1], H, 0.3, { color: 0xa8b8a8 }); k.wall('paintGreen', [X0, Z1], [X1, Z1], H, 0.3, { color: 0xa8b8a8, openings: [{ s: 3.6, w: 1.5, h: 2.1 }] });
  for (let z = Z0 + 0.8; z < Z1; z += 1.6) { k.box('steelDark', [0.1, H, 0.12], [X0 + 0.18, H / 2, z]); k.box('steelDark', [0.1, H, 0.12], [X1 - 0.18, H / 2, z]); }
  for (let x = X0 + 1; x < X1; x += 2) k.box('steelDark', [0.18, 0.2, D], [x, H - 0.1, 0]);
  k.box('paintYellow', [W, 0.04, 0.02], [0, 1.1, Z0 + 0.16]); k.box('paintYellow', [0.02, 0.04, D], [X0 + 0.16, 1.1, 0]); k.box('paintYellow', [0.02, 0.04, D], [X1 - 0.16, 1.1, 0]);
  // blast door
  const dx = X0 + 3.6 + 0.75; k.push(dx, 0, Z1 - 0.12, Math.PI); k.box('steelDark', [1.8, 2.4, 0.34], [0, 1.2, 0]); k.cyl('steel', [0.8, 0.8, 0.2], [0, 1.1, 0.14], { rx: Math.PI / 2, seg: 24 }); k.torus('chrome', 0.4, 0.04, [0, 1.1, 0.28], { seg: 20, tseg: 5 }); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.rod('chrome', [0, 1.1, 0.28], [Math.cos(a) * 0.4, 1.1 + Math.sin(a) * 0.4, 0.28], 0.025, { seg: 5 }); } k.box('paintYellow', [1.6, 0.1, 0.02], [0, 2.3, 0.18]); k.pop();
  // two consoles, 3.4 m apart
  const keys = [], lamps = [];
  for (const [i, x] of [[0, -2.4], [1, 2.4]]) {
    const yaw = i === 0 ? Math.PI / 2 : -Math.PI / 2; k.push(x, 0, -0.5, yaw);
    k.box('paintGrey', [1.6, 0.9, 0.9], [0, 0.45, 0], { color: 0x8a928e }); k.box('paintDark', [1.7, 0.05, 1.0], [0, 0.93, 0]); k.box('paintGrey', [1.6, 0.8, 0.12], [0, 1.4, -0.4], { rx: 0.0, color: 0x8a928e });
    k.box('paintDark', [1.55, 0.7, 0.05], [0, 1.4, -0.34], { rx: -0.35, color: 0x40464a });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { k.cyl('chrome', [0.012, 0.012, 0.05], [-0.65 + c * 0.17, 1.26 + r * 0.14 - 0.0, -0.3 - r * 0.04 + 0.0], { seg: 5, rx: -0.35 - 0.4 }); k.box(((r + c) % 3 === 0) ? redG : (((r + c) % 3 === 1) ? greenG : amber), [0.035, 0.035, 0.012], [-0.65 + c * 0.17, 1.26 + r * 0.14 + 0.06, -0.3 - r * 0.04 + 0.0], { rx: -0.35, mirror: false }); }
    // key switch + guarded launch button
    k.cyl('chrome', [0.05, 0.05, 0.03], [0.4, 1.0, 0.12], { seg: 14 }); k.box('steelDark', [0.16, 0.02, 0.16], [0.4, 0.955, 0.12]);
    const key = k.sub('key'); key.box('brass', [0.012, 0.045, 0.03], [0, 0.0, 0.0]); key.cyl('brass', [0.012, 0.012, 0.03], [0, 0.05, 0], { seg: 6 }); const kg = k.attach(key, [0.4, 1.03, 0.12], {}); keys.push(kg); kg.children[0].rotation.set(0, 0, 0);
    for (let b = 0; b < 2; b++) { k.cyl(b ? redG : greenG, [0.045, 0.045, 0.03], [-0.55 + b * 0.18, 1.0, 0.18], { seg: 12 }); }
    k.box('glass', [0.5, 0.05, 0.3], [-0.2, 1.05, 0.3], { rx: 0.0 }); k.box('paintRed', [0.4, 0.12, 0.25], [-0.2, 0.99, 0.3], { color: 0xb02820 });
    const lamp = k.cyl(redG, [0.05, 0.05, 0.03], [0.62, 1.0, 0.0], { seg: 10 }); k.cyl(greenG, [0.05, 0.05, 0.03], [0.62, 1.0, 0.2], { seg: 10 });
    k.screen({ name: 'launch' + (i ? 'B' : 'A'), w: 0.5, h: 0.3, draw: (c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { rows: 3, theme: 'amber', labels: ['TARGET', 'STATUS', 'CODE'] }), fps: 6, res: [256, 154], bezel: 0.015, k: 1.0 }, [-0.1, 1.5, -0.26], { rx: -0.35 });
    k.pop();
    chair(k, x + (i ? 1.0 : -1.0) * -1 * -1, -0.5, yaw + Math.PI, { seat: 'leatherWhite', frame: 'chrome', tall: false, color: 0x6a7a68 });
  }
  // wall fixtures: safe, red phone, big status board, clock, strobes
  k.box('paintRed', [0.7, 0.9, 0.35], [-0.0, 1.2, Z0 + 0.35], { color: 0xa82820 }); k.box('chrome', [0.2, 0.2, 0.04], [0, 1.2, Z0 + 0.54]); k.cyl('chrome', [0.04, 0.04, 0.03], [0, 1.2, Z0 + 0.57], { rx: Math.PI / 2, seg: 10 });
  k.box('paintRed', [0.25, 0.12, 0.18], [1.1, 1.1, Z0 + 0.3]); k.cyl('blackPlastic', [0.04, 0.04, 0.2], [1.1, 1.22, Z0 + 0.3], { rz: Math.PI / 2, seg: 8 });
  const board = k.screen({ name: 'board', w: 2.6, h: 1.1, draw: (c, w, h, t, S) => drawStatusGrid(c, w, h, t, S, { cols: 10, rows: 4, theme: 'amber' }), fps: 3, res: [512, 216], bezel: 0.05, k: 1.0 }, [-2.6, 2.1, Z0 + 0.17]);
  const cd = k.screen({ name: 'countdown', w: 1.8, h: 0.6, draw: (c, w, h, t, S) => drawCountdown(c, w, h, t, S, { start: 600, theme: 'amber', label: 'LAUNCH WINDOW' }), fps: 2, res: [384, 128], bezel: 0.04, k: 1.1 }, [2.2, 2.1, Z0 + 0.17]);
  wallClock(k, 0, 2.3, Z0 + 0.17, 0, 0.22);
  k.sign(1.4, 0.4, (c, w, h) => { c.fillStyle = '#b02820'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `900 ${h * 0.36}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TWO-PERSON RULE', w / 2, h / 2); }, [0, 2.7, Z0 + 0.17], { ppm: 130 });
  for (const [x, z] of [[X0 + 0.3, Z0 + 0.4], [X1 - 0.3, Z0 + 0.4]]) { k.cyl('steelDark', [0.1, 0.12, 0.06], [x, H - 0.05, z], { seg: 10 }); k.sph(redG, 0.09, [x, H - 0.12, z], { seg: 8 }); }
  for (let x = -3; x <= 3; x += 3) lightPanel(k, x, H - 0.02, 0, 1.2, 0.5, 0xe8f0e8, 1.3);
  k.light(new THREE.HemisphereLight(0xc8d8c8, 0x303830, 1.5), 'hemi'); const L1 = new THREE.PointLight(0xf0f4e8, 26, 12, 1.5); L1.position.set(0, 2.6, 0); k.light(L1, 'ceil'); const L2 = new THREE.PointLight(0xff2010, 6, 8, 1.6); L2.position.set(0, 2.7, 0); k.light(L2, 'strobe');
  const S = { keys: 0, alert: 0 };
  k.onUpdate((dt, t) => { keys.forEach((g, i) => { g.rotation.y = -S.keys * 1.57 * (i ? 1 : 1); }); const a = S.alert > 0.01 ? (Math.floor(t * 2) % 2) : 0; redM.emissiveIntensity = 2.6 * (0.4 + 0.6 * (a || (S.alert > 0.5 ? 0 : 1))) * (1 + S.alert); greenM.emissiveIntensity = 2.0 * (1 - 0.7 * S.alert); L2.intensity = S.alert * (a ? 14 : 2); });
  k.anchor('operatorA', [-2.4 + 0.0, 0, -0.5 - 0.0], Math.PI / 2).anchor('operatorB', [2.4, 0, -0.5], -Math.PI / 2);
  k.anchors.operatorA = { pos: [-3.5, 0, -0.5], yaw: Math.PI / 2 }; k.anchors.operatorB = { pos: [3.5, 0, -0.5], yaw: -Math.PI / 2 };
  k.anchor('door', [dx, 0, Z1 - 1.0], Math.PI).anchor('safe', [0, 0, Z0 + 1.2], 0).anchor('camWide', [X0 + 0.7, 1.9, Z1 - 0.6], Math.atan2(2, -6)).anchor('camBoth', [0, 1.5, Z1 - 0.8], Math.PI).anchor('camKeyA', [-3.3, 1.5, 0.9], Math.PI / 2 + 2.6).anchor('camKeyB', [3.3, 1.5, 0.9], -Math.PI / 2 - 2.6).anchor('camBoard', [0, 1.6, 1.2], Math.PI).anchor('camHigh', [X1 - 0.5, 2.7, Z1 - 0.5], Math.PI + 0.7);
  return k.api({ screen: board, board, countdown: cd, bounds: { w: W, d: D, h: H }, setKeys: (a) => { S.keys = a; }, setAlert: (a) => { S.alert = a; k.state.alert = a; } });
}
