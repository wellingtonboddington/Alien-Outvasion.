// createUNHall — General Assembly style hall: curved tiered seating, green-marble dais wall with gold relief, gallery, booths, flags.
import * as THREE from 'three';
import { createKit } from './kit.js';
import { drawNewsWall, drawWorldMap, drawCountdown, SANS, MONO } from './draw.js';
import { arcSlab, arcPt, chair, lightPanel, flagDraw, stallChair } from './props.js';
import { TAU, RNG } from '../../../engine/common.js';

const NAMES = ['ARGENTINA', 'AUSTRALIA', 'BRAZIL', 'CANADA', 'CHILE', 'CHINA', 'COLOMBIA', 'EGYPT', 'ETHIOPIA', 'FRANCE', 'GERMANY', 'GHANA', 'INDIA', 'INDONESIA', 'IRELAND', 'ITALY', 'JAPAN', 'KENYA', 'MEXICO', 'MOROCCO', 'NEPAL', 'NIGERIA', 'NORWAY', 'PAKISTAN', 'PERU', 'PHILIPPINES', 'POLAND', 'PORTUGAL', 'ROMANIA', 'RUSSIA', 'SENEGAL', 'SPAIN', 'SWEDEN', 'THAILAND', 'TURKEY', 'UKRAINE', 'UNITED KINGDOM', 'UNITED STATES', 'VIETNAM', 'ZAMBIA', 'GEORGIA', 'GREECE', 'CUBA', 'IRAQ', 'ISRAEL', 'JORDAN', 'LIBYA', 'MALAYSIA', 'NEW ZEALAND', 'SOUTH AFRICA', 'SOUTH KOREA', 'SWITZERLAND', 'TANZANIA', 'URUGUAY', 'VENEZUELA', 'AUSTRIA', 'BELGIUM', 'DENMARK', 'FINLAND', 'HUNGARY', 'IRAN', 'KAZAKHSTAN', 'SAUDI ARABIA', 'SINGAPORE'];

function plateDraw(name) { return (c, w, h) => { c.fillStyle = '#e8e4d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8a24a'; c.fillRect(0, 0, w, 3); c.fillRect(0, h - 3, w, 3); c.fillStyle = '#16202e'; c.font = `bold ${Math.round(h * 0.52)}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; let s = h * 0.52; while (c.measureText(name).width > w * 0.9 && s > 8) { s -= 2; c.font = `bold ${Math.round(s)}px ${SANS}`; } c.fillText(name, w / 2, h * 0.54); }; }

export function createUNHall(opts = {}) {
  const k = createKit('UNHall', { seed: 41 });
  const X0 = -27, X1 = 27, Z0 = -27.5, Z1 = 14.5, H = 17;
  const C = [0, -15]; const gold = k.glow(0xffd890, 2.2), warm = k.glow(0xffe2b0, 2.4), cyan = k.glow(0x46c8ff, 1.6);
  // ----- shell -----
  k.floorQuad('carpetBlue', X1 - X0, Z1 - Z0, [0, 0, (Z0 + Z1) / 2], { color: 0xc8d0e8 });
  k.box('paintCream', [X1 - X0, 0.4, Z1 - Z0], [0, H + 0.2, (Z0 + Z1) / 2]);
  k.wall('woodLight', [X0, Z0], [X0, Z1], H, 0.4, { tile: 2 }); k.wall('woodLight', [X1, Z0], [X1, Z1], H, 0.4, { tile: 2 });
  k.wall('woodLight', [X0, Z1], [X1, Z1], H, 0.4, { tile: 2 }); for (let x = X0 + 2; x < X1; x += 2.4) k.box('woodDark', [0.22, H - 0.4, 0.16], [x, H / 2, Z1 - 0.3]); k.box('brass', [X1 - X0, 0.12, 0.1], [0, 10.6, Z1 - 0.25]);
  for (const sx of [-1, 1]) { for (let z = Z0 + 2; z < Z1; z += 2.4) k.box('woodDark', [0.16, H - 0.4, 0.22], [sx * (X1 - 0.3), H / 2, z]); k.box('brass', [0.1, 0.12, Z1 - Z0], [sx * (X1 - 0.25), 5.6, (Z0 + Z1) / 2]); k.box('brass', [0.1, 0.12, Z1 - Z0], [sx * (X1 - 0.25), 10.6, (Z0 + Z1) / 2]); }
  // ----- dais wall: green marble slab + gold relief -----
  k.box('woodLight', [X1 - X0, H, 0.5], [0, H / 2, Z0 + 0.25]);
  k.box('marbleGreen', [24, 13, 0.5], [0, 7.3, Z0 + 0.55], { tile: 5 }); k.box('brass', [24.3, 0.2, 0.62], [0, 13.9, Z0 + 0.55]); k.box('brass', [24.3, 0.2, 0.62], [0, 0.8, Z0 + 0.55]);
  for (const sx of [-1, 1]) k.box('brass', [0.2, 13.2, 0.62], [sx * 12.1, 7.3, Z0 + 0.55]);
  const ez = Z0 + 0.88, ey = 9.0;
  k.push(0, ey, ez);
  const R0 = 3.7;
  k.torus('gold', R0, 0.14, [0, 0, 0], { seg: 64, tseg: 8 }); k.torus('gold', R0 * 0.64, 0.1, [0, 0, 0.03], { seg: 56, tseg: 8 }); k.torus('gold', R0 * 0.3, 0.08, [0, 0, 0.05], { seg: 40, tseg: 8 });
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, r1 = R0 * 0.68, r2 = R0 * (i % 3 === 0 ? 0.97 : 0.9); k.box('gold', [0.07, r2 - r1, 0.06], [Math.sin(a) * (r1 + r2) / 2, Math.cos(a) * (r1 + r2) / 2, 0.02], { rz: -a }); }
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 9; i++) { const t = i / 8; const a = (0.35 + t * 2.3) * side, r = R0 * 0.5 + 0.0; const x = Math.sin(a) * r * 0.98, y = -Math.cos(a) * r * 0.98; k.part('gold', new THREE.SphereGeometry(1, 10, 7), [x, y, 0.07], { sx: 0.34, sy: 0.14, sz: 0.06, rz: -a - Math.PI / 2 + 0.5 * side * 0 }); }
  k.part('gold', new THREE.SphereGeometry(0.62, 24, 16), [0, 0, 0.12], {}); for (let i = 0; i < 5; i++) k.torus('brass', 0.62, 0.015, [0, 0, 0.12], { rx: Math.PI / 2 + i * 0.6, seg: 28, tseg: 4, ry: i * 0.5 });
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 1.6; k.box('gold', [0.12, 1.3, 0.06], [Math.sin(a) * 1.3, 1.1 + Math.cos(a) * 0.5, 0.1], { rz: -a }); }
  k.pop();
  k.shaft([0, 14.6, Z0 + 2], [0, ey, ez + 0.1], 0.2, 3.2, 0xffe0a0, 0.0);
  // side screens flanking the slab
  const scrL = k.screen({ name: 'screenL', w: 5.6, h: 3.15, draw: (c, w, h, t, S) => drawWorldMap(c, w, h, t, S, { theme: 'blue', title: 'LIVE FEED', labels: false }), fps: 6, res: [512, 288], bezel: 0.1, k: 1.15 }, [-18.5, 6.5, Z0 + 0.9]);
  const scrR = k.screen({ name: 'screenR', w: 5.6, h: 3.15, draw: (c, w, h, t, S) => drawNewsWall(c, w, h, t, S), fps: 6, res: [512, 288], bezel: 0.1, k: 1.15 }, [18.5, 6.5, Z0 + 0.9]);
  // ----- dais platform, presidium, rostrum -----
  k.box('woodDark', [24, 1.6, 6], [0, 0.8, Z0 + 3.6]); k.box('carpetRed', [23.6, 0.03, 5.6], [0, 1.62, Z0 + 3.6], { color: 0x8a3a3a }); k.box('brass', [24.2, 0.1, 6.2], [0, 1.65, Z0 + 3.6]);
  k.box('marbleGreen', [10, 1.0, 1.6], [0, 2.15, Z0 + 2.2], { tile: 3 }); k.box('woodLight', [10.2, 0.08, 1.8], [0, 2.69, Z0 + 2.2]); k.box('brass', [10.1, 0.1, 1.65], [0, 1.66, Z0 + 2.2]);
  for (const x of [-3.2, 0, 3.2]) { chair(k, x, Z0 + 3.5, 0, { y: 1.62, seat: 'leather', frame: 'chrome', tall: true, color: 0x303a50 }); k.box('blackPlastic', [0.45, 0.02, 0.3], [x, 2.72, Z0 + 2.0]); }
  k.floorQuad('marbleWhite', 30, 14, [0, 0.015, C[1] - 1.5], { mirror: false });
  for (const [r, th] of [[7.6, 0.05], [8.2, 0.03]]) k.part(gold, new THREE.RingGeometry(r - th, r + th, 96, 1, Math.PI - 1.4, 2.8), [C[0], 0.02, C[1]], { rx: -Math.PI / 2, ry: 0 });
  for (const r of [26, 27.6]) k.part('brass', new THREE.RingGeometry(r - 0.04, r + 0.04, 120, 1, Math.PI - 1.3, 2.6), [C[0], 0.02, C[1]], { rx: -Math.PI / 2 });
  // rostrum
  const rz = Z0 + 7.2;
  k.box('woodDark', [8, 0.9, 3], [0, 0.45, rz - 0.4]); k.box('marbleWhite', [8.2, 0.08, 3.2], [0, 0.94, rz - 0.4]);
  k.box('marbleGreen', [3.2, 1.15, 1.3], [0, 1.5, rz], { tile: 2 }); k.box('woodLight', [3.0, 0.1, 1.2], [0, 2.12, rz]); k.box('brass', [3.3, 0.08, 1.4], [0, 0.96, rz]);
  k.box('gold', [0.9, 0.5, 0.04], [0, 1.45, rz + 0.67]); k.torus('gold', 0.22, 0.02, [0, 1.45, rz + 0.7], { seg: 28, tseg: 4 });
  k.push(0, 2.17, rz); k.box('blackPlastic', [0.9, 0.04, 0.5], [0, 0.04, 0], { rx: 0.18 }); k.rod('chrome', [0, 0.05, 0.1], [0, 0.34, 0.16], 0.01, { seg: 5 }); k.rod('chrome', [0.2, 0.05, 0.1], [0.2, 0.3, 0.16], 0.01, { seg: 5 }); k.sph('blackMatte', 0.025, [0, 0.34, 0.16], { seg: 6 }); k.sph('blackMatte', 0.025, [0.2, 0.3, 0.16], { seg: 6 }); k.pop();
  const timer = k.screen({ name: 'timer', w: 0.42, h: 0.14, draw: (c, w, h, t, S) => drawCountdown(c, w, h, t, S, { start: 300, theme: 'amber', label: 'TIME' }), fps: 2, res: [192, 64], k: 1.2, mirror: false }, [0.72, 2.2, rz + 0.55], { rx: -0.5 });
  // ----- delegate seating -----
  const rowsN = 10, aMax = 1.2, aisles = [0, -0.62, 0.62]; const rng = new RNG(7); let plate = 0; const delegates = [];
  for (let i = 0; i < rowsN; i++) {
    const r = 9.5 + i * 1.4, y = 0.3 * (i + 1);
    arcSlab(k, i === rowsN - 1 ? 'woodDark' : 'paintDark', r - 0.95, r + 0.55, -aMax - 0.05, aMax + 0.05, 0, y - 0.03, [C[0], 0, C[1]], { steps: 30, top: false });
    arcSlab(k, 'carpetBlue', r - 0.95, r + 0.55, -aMax - 0.05, aMax + 0.05, y - 0.03, y, [C[0], 0, C[1]], { steps: 30, bottom: false, inner: false, outer: false, caps: false, color: 0xd0d8f0 });
    arcSlab(k, 'brass', r - 0.96, r - 0.93, -aMax - 0.05, aMax + 0.05, y - 0.03, y + 0.005, [C[0], 0, C[1]], { steps: 30, bottom: false, outer: false, caps: false, top: false });
    // desks: blocks between aisles
    const spans = []; let a0 = -aMax; for (const ai of [...aisles].sort((p, q) => p - q)) { spans.push([a0, ai - 0.045]); a0 = ai + 0.045; } spans.push([a0, aMax]);
    for (const [s0, s1] of spans) {
      const rd = r - 0.8; const blocks = Math.max(1, Math.round((s1 - s0) * rd / 1.7)); const da = (s1 - s0) / blocks;
      for (let b = 0; b < blocks; b++) {
        const b0 = s0 + b * da + 0.004, b1 = s0 + (b + 1) * da - 0.004;
        arcSlab(k, 'woodLight', rd - 0.28, rd + 0.28, b0, b1, y + 0.7, y + 0.75, [C[0], 0, C[1]], { steps: 3, color: 0xe8d8c0 });
        arcSlab(k, 'woodDark', rd - 0.1, rd + 0.26, b0, b1, y + 0.28, y + 0.7, [C[0], 0, C[1]], { steps: 3, caps: true });
        const nseats = Math.max(1, Math.round((b1 - b0) * rd / 0.85)); const dd = (b1 - b0) / nseats;
        for (let q = 0; q < nseats; q++) {
          const a = b0 + (q + 0.5) * dd, [sx, sz] = arcPt(C[0], C[1], r + 0.25, a);
          stallChair(k, sx, y, sz, a + Math.PI, { mat: 'fabricBlue' });
          if (i < 7 || q === 0) { const [mx, mz] = arcPt(C[0], C[1], rd + 0.1, a); k.cyl('blackMatte', [0.012, 0.012, 0.2], [mx, y + 0.85, mz], { seg: 5 }); k.sph('blackMatte', 0.02, [mx, y + 0.96, mz], { seg: 5 }); k.box('blackMatte', [0.07, 0.015, 0.07], [mx, y + 0.757, mz], { ry: a }); }
          if ((q === 0 || (i < 6 && q === 1)) && plate < 150) { const nm = NAMES[(plate * 7 + i * 3) % NAMES.length]; plate++; const [px, pz] = arcPt(C[0], C[1], rd - 0.18, a); k.sign(0.44, 0.1, plateDraw(nm), [px, y + 0.82, pz], { ry: a + Math.PI, rx: -0.5, ppm: 160 }); }
          if (delegates.length < 400) delegates.push([sx, y, sz, a + Math.PI]);
        }
      }
    }
  }
  // ----- galleries & booths -----
  for (const sx of [-1, 1]) {
    k.box('woodDark', [3.4, 0.4, 26], [sx * (X1 - 2.0), 5.7, -2]); k.box('woodLight', [0.12, 1.0, 26], [sx * (X1 - 3.7), 6.4, -2]); k.box('glass', [0.04, 0.6, 26], [sx * (X1 - 3.72), 7.0, -2]); k.rod('brass', [sx * (X1 - 3.7), 7.3, -15], [sx * (X1 - 3.7), 7.3, 11], 0.04, { seg: 6 });
    for (let z = -14; z <= 10; z += 2.5) k.cyl('woodDark', [0.3, 0.3, 5.4], [sx * (X1 - 3.8), 2.7, z], { seg: 8 });
    for (let row = 0; row < 2; row++) for (let z = -14; z < 10; z += 0.75) stallChair(k, sx * (X1 - 1.5 - row * 1.0), 5.9 + row * 0.25, z, -sx * Math.PI / 2, { mat: 'fabricRed' });
    for (let b = 0; b < 6; b++) { const z = -12 + b * 4.2; k.box('paintDark', [2.4, 2.6, 3.4], [sx * (X1 - 1.4), 9.5, z]); k.box('glass', [0.04, 1.6, 3.2], [sx * (X1 - 2.62), 9.7, z]); k.box('steel', [0.08, 2.7, 3.5], [sx * (X1 - 2.62), 9.5, z - 1.72]); k.box('woodLight', [0.9, 0.06, 2.8], [sx * (X1 - 2.1), 9.3, z]); k.box(warm, [0.05, 0.05, 2.6], [sx * (X1 - 2.58), 10.75, z], { mirror: false }); }
    // wall flags on angled poles
    for (let q = 0; q < 12; q++) { const z = -22 + q * 3.4, idx = q + (sx > 0 ? 12 : 0); const x0 = sx * (X1 - 0.5), y0 = 13.6; k.rod('chrome', [x0, y0, z], [x0 - sx * 2.8, y0 + 1.7, z], 0.03, { seg: 6 }); k.sph('gold', 0.05, [x0 - sx * 2.8, y0 + 1.7, z], { seg: 6 }); k.sign(1.5, 1.0, flagDraw(idx), [x0 - sx * 1.45, y0 + 0.28, z], { ry: 0, ppm: 70, ws: 6, hs: 3, deform: (g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + 0.75) / 1.5; p.setZ(i, Math.sin(u * 5 + idx) * 0.07 * u); } g.computeVertexNormals(); } }); }
  }
  k.box('woodDark', [X1 - X0 - 8, 0.4, 3.6], [0, 5.4, Z1 - 1.8]); for (let row = 0; row < 3; row++) k.box('paintDark', [X1 - X0 - 8, 0.3 + row * 0.3, 1.0], [0, 5.65 + row * 0.15, Z1 - 3.4 + row * 1.1 - 0.0]);
  // ----- ceiling coffers + chandelier ring -----
  for (let x = -21; x <= 21; x += 7) for (let z = -22; z <= 12; z += 5.8) { k.box('paintCream', [6.2, 0.5, 5.0], [x, H - 0.1, z]); lightPanel(k, x, H - 0.46, z, 5.4, 4.2, 0xffd9a0, 0.9, { frame: 'brass' }); }
  for (const r of [3.2, 5.0]) k.torus(gold, r, 0.07, [C[0], H - 0.6, C[1]], { rx: Math.PI / 2, seg: 72, tseg: 5 });
  // dome-ish gold ceiling over the dais
  k.part('gold', new THREE.CylinderGeometry(4.6, 4.6, 0.3, 40, 1, true), [0, H - 0.4, Z0 + 5], {});
  // ----- lights -----
  const hemi = new THREE.HemisphereLight(0xfff0e0, 0x2a2430, 1.5); k.light(hemi, 'hemi');
  const key = new THREE.PointLight(0xffe2c0, 160, 44, 1.3); key.position.set(0, 12, -8); k.light(key, 'hallKey');
  const spot = new THREE.SpotLight(0xfff4e0, 600, 30, 0.38, 0.5, 1.4); spot.position.set(0, 14, -10); spot.target.position.set(0, 1.5, rz); k.root.add(spot.target); k.light(spot, 'podiumSpot');
  // ----- anchors -----
  const seatAt = (row, frac) => { const r = 9.5 + row * 1.4 + 0.25, a = (frac - 0.5) * 2 * 1.1; const p = arcPt(C[0], C[1], r, a); return [p[0], 0.3 * (row + 1), p[1]]; };
  k.anchor('podium', [0, 0.94, rz + 0.95], 0).anchor('presidentC', [0, 1.62, Z0 + 3.5], 0).anchor('presidentL', [-3.2, 1.62, Z0 + 3.5], 0).anchor('presidentR', [3.2, 1.62, Z0 + 3.5], 0);
  [[0, 0.35], [1, 0.62], [2, 0.3], [3, 0.7], [4, 0.2], [5, 0.5], [6, 0.8], [7, 0.4], [8, 0.65], [9, 0.45]].forEach(([row, f], i) => { const p = seatAt(row, f); const a = Math.atan2(C[0] - p[0], C[1] - p[2]); k.anchor('delegate' + i, p, a); });
  k.anchor('camWide', [0, 7.4, 13.2], Math.PI).anchor('camPodium', [0, 1.9, -9.0], Math.PI).anchor('camPodiumClose', [1.5, 2.6, rz + 3.2], Math.PI + 0.35).anchor('camDelegates', [0, 2.3, rz + 0.3], 0).anchor('camSideL', [-21, 3.2, -9], -1.9).anchor('camSideR', [21, 3.2, -9], 1.9).anchor('camEmblem', [0, 5.0, -12], Math.PI).anchor('camAisle', [0, 1.7, 9], Math.PI).anchor('camHigh', [-20, 9, 12.5], Math.PI + 0.65);
  return k.api({ screenL: scrL, screenR: scrR, timer, bounds: { w: X1 - X0, d: Z1 - Z0, h: H } });
}
