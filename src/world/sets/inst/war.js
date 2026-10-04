// createWarRoom — Pentagon-style situation room: wall of screens, map table with hologram, conference table, console tiers, briefing room.
import * as THREE from 'three';
import { createKit } from './kit.js';
import { drawWorldMap, drawRadar, drawTelemetry, drawDataScroll, drawStatusGrid, drawClocks, drawCCTV, drawOrbit, drawSpectrum, SANS, MONO, mapBase, proj, theme } from './draw.js';
import { chair, keyboard, mug, papers, flag, deskMic, plant, lightPanel, wallClock, cable } from './props.js';
import { holoSphere } from './holo.js';
import { TAU, RNG } from '../../../engine/common.js';

function drawTableMap(ctx, w, h, t, S) {
  const th = theme('cyan'); ctx.fillStyle = '#020a10'; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = w * 0.47; ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  const base = mapBase(1024, 512, 'cyan', { pad: 0.0 }); ctx.globalAlpha = 0.9; ctx.drawImage(base.canvas, 0, 0, 1024, 512, cx - R * 1.35, cy - R * 0.68, R * 2.7, R * 1.36); ctx.globalAlpha = 1;
  ctx.restore(); ctx.strokeStyle = th.dot2; ctx.lineWidth = 2;
  for (let i = 1; i <= 4; i++) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 4; ctx.stroke();
  for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * R * (i % 5 ? 0.97 : 0.93), cy + Math.sin(a) * R * (i % 5 ? 0.97 : 0.93)); ctx.lineWidth = 2; ctx.stroke(); }
  const sw = t * 0.9; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, sw - i * 0.04 - 0.05, sw - i * 0.04); ctx.closePath(); ctx.fillStyle = th.dot2; ctx.globalAlpha = (1 - i / 30) * 0.22; ctx.fill(); } ctx.globalAlpha = 1;
  const r = new RNG(5); for (let i = 0; i < 16; i++) { const a = r.range(0, TAU), d = r.range(0.1, 0.92) * R; const x = cx + Math.cos(a + t * 0.02 * (i % 3 - 1)) * d, y = cy + Math.sin(a + t * 0.02 * (i % 3 - 1)) * d; const hot = i / 16 < S.threat; const p = 0.5 + 0.5 * Math.sin(t * 3 + i); ctx.strokeStyle = hot ? '#ff3b30' : th.ok; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x, y, 7 + (hot ? 7 * p : 0), 0, TAU); ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
  ctx.font = `bold ${h / 22}px ${MONO}`; ctx.fillStyle = th.text; ctx.textAlign = 'center'; ctx.fillText('TACTICAL OVERVIEW', cx, h * 0.045); ctx.textAlign = 'left';
}

export function createWarRoom(opts = {}) {
  const k = createKit('WarRoom', { seed: 31 });
  const X0 = -13, X1 = 13, Z0 = -12, Z1 = 12.5, H = 6.6;
  const cyan = k.glow(0x46c8ff, 2.2), amber = k.glow(0xffa828, 2.2), white = k.glow(0xfff4e0, 3.0), red = k.glow(0xff2a20, 2.4), green = k.glow(0x30ff70, 2.0);
  // ----- shell -----
  k.floorQuad('floorBlack', X1 - X0, Z1 - Z0, [0, 0, (Z0 + Z1) / 2]);
  k.box('paintDark', [X1 - X0, 0.3, Z1 - Z0], [0, H + 0.15, (Z0 + Z1) / 2]);
  k.wall('paintDark', [X0, Z0], [X1, Z0], H, 0.3); k.wall('paintDark', [X0, Z1], [X1, Z1], H, 0.3);
  k.wall('woodDark', [X0, Z0], [X0, Z1], H, 0.3, { tile: 1.5 }); k.wall('woodDark', [X1, Z0], [X1, Z1], H, 0.3, { tile: 1.5 });
  // wall panelling: fabric inserts + gold trim
  for (const sx of [-1, 1]) { for (let i = 0; i < 8; i++) { const z = -10 + i * 3.05; k.box('fabricDark', [0.1, 3.4, 2.5], [sx * (X1 - 0.2), 3.3, z]); k.box('brass', [0.04, 3.5, 0.04], [sx * (X1 - 0.25), 3.3, z + 1.3]); } k.box('brass', [0.06, 0.06, Z1 - Z0 - 0.5], [sx * (X1 - 0.2), 5.2, (Z0 + Z1) / 2]); k.box('brass', [0.06, 0.06, Z1 - Z0 - 0.5], [sx * (X1 - 0.2), 1.3, (Z0 + Z1) / 2]); k.box(cyan, [0.04, 0.04, Z1 - Z0 - 0.5], [sx * (X1 - 0.18), 6.3, (Z0 + Z1) / 2], { mirror: false }); }
  // ----- screen wall -----
  const zw = Z0 + 0.35;
  k.box('woodDark', [X1 - X0 - 0.4, 1.2, 0.3], [0, 0.6, zw - 0.1]); k.box('blackPlastic', [26, 5.6, 0.3], [0, 3.8, zw - 0.18]);
  for (let i = -6; i <= 6; i++) k.box(i % 2 ? cyan : k.glow(0x1a5acc, 1.6), [0.04, 5.2, 0.03], [i * 2.0, 3.6, zw + 0.0], { mirror: false });
  const wall = k.screen({ name: 'wall', w: 9.8, h: 4.2, draw: (c, w, h, t, S) => drawWorldMap(c, w, h, t, S, { title: 'GLOBAL THREAT MAP  //  NORAD-EN', theme: 'cyan' }), fps: 8, res: [1024, 440], bezel: 0.12, k: 1.15 }, [0, 3.55, zw + 0.05]);
  const clocks = k.screen({ name: 'clocks', w: 18, h: 0.9, draw: drawClocks, fps: 2, res: [1024, 56], bezel: 0.08, k: 1.1 }, [0, 6.0, zw + 0.05]);
  const side = [];
  for (const sx of [-1, 1]) for (let r = 0; r < 2; r++) {
    const draws = sx < 0 ? [(c, w, h, t, S) => drawRadar(c, w, h, t, S, { theme: 'green' }), (c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { rows: 4 })] : [(c, w, h, t, S) => drawOrbit(c, w, h, t, S, { title: 'SATELLITE COVERAGE' }), (c, w, h, t, S) => drawStatusGrid(c, w, h, t, S, { cols: 14, rows: 6 })];
    side.push(k.screen({ name: `screen${sx < 0 ? 'L' : 'R'}${r + 1}`, w: 4.4, h: 2.2, draw: draws[r], fps: 8, res: [512, 256], bezel: 0.08, k: 1.1 }, [sx * 8.3, 4.5 - r * 2.5, zw + 0.05]));
  }
  k.pool(0, Z0 + 3, 5.5, 0x4a9cff, 0.18);
  // ----- map table with hologram -----
  const MT = [0, -1.6];
  k.cyl('gunmetal', [2.7, 3.0, 0.5], [MT[0], 0.25, MT[1]], { seg: 40 }); k.cyl('blackPlastic', [2.9, 2.9, 0.12], [MT[0], 0.8, MT[1]], { seg: 40 });
  k.torus('chrome', 2.92, 0.045, [MT[0], 0.875, MT[1]], { rx: Math.PI / 2, seg: 64, tseg: 6 }); k.cyl('gunmetal', [2.5, 2.2, 0.35], [MT[0], 0.6, MT[1]], { seg: 36 });
  const mapTable = k.screen({ name: 'mapTable', w: 5.7, h: 5.7, circle: true, draw: drawTableMap, fps: 10, res: [512, 512], k: 1.25, mirror: false }, [MT[0], 0.885, MT[1]], { rx: -Math.PI / 2 });
  k.part(cyan, new THREE.RingGeometry(3.0, 3.07, 64), [MT[0], 0.03, MT[1]], { rx: -Math.PI / 2 }); k.part(amber, new THREE.RingGeometry(3.6, 3.64, 64), [MT[0], 0.03, MT[1]], { rx: -Math.PI / 2 });
  k.pool(MT[0], MT[1], 5.5, 0x46e6ff, 0.2);
  const holo = holoSphere(k, 0.95, [MT[0], 2.2, MT[1]], 0x46e6ff);
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.015, 6, 64), k.mat(cyan)); ringA.position.set(MT[0], 2.2, MT[1]); k.dyn.add(ringA); const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.012, 6, 64), k.mat(cyan)); ringB.position.copy(ringA.position); k.dyn.add(ringB);
  k.shaft([MT[0], 0.9, MT[1]], [MT[0], 2.9, MT[1]], 1.3, 0.7, 0x46e6ff, 0.12);
  // ----- conference table -----
  const CT = [0, 5.4];
  k.cyl('woodDark', [1, 1, 0.07], [CT[0], 0.77, CT[1]], { sx: 4.9, sz: 1.5, seg: 48, uv: 'box', tile: 2 }); k.cyl('brass', [1, 1, 0.02], [CT[0], 0.735, CT[1]], { sx: 4.93, sz: 1.53, seg: 48 });
  k.cyl('blackPlastic', [1, 1, 0.6], [CT[0], 0.4, CT[1]], { sx: 3.4, sz: 0.55, seg: 32 }); k.cyl('blackPlastic', [1, 1, 0.04], [CT[0], 0.02, CT[1]], { sx: 3.9, sz: 0.9, seg: 32 });
  const feeds = {
    data: k.feed('data', (c, w, h, t, S) => drawDataScroll(c, w, h, t, S, { theme: 'green' }), { res: [256, 144], fps: 8 }),
    radar: k.feed('radar', (c, w, h, t, S) => drawRadar(c, w, h, t, S, { theme: 'cyan', title: 'TRACK' }), { res: [256, 144], fps: 10 }),
    tel: k.feed('tel', (c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { rows: 3, theme: 'amber' }), { res: [256, 144], fps: 8 }),
    grid: k.feed('grid', (c, w, h, t, S) => drawStatusGrid(c, w, h, t, S, { cols: 12, rows: 6, theme: 'cyan' }), { res: [256, 144], fps: 5 }),
    map: k.feed('map', (c, w, h, t, S) => drawWorldMap(c, w, h, t, S, { theme: 'amber', labels: false, title: 'REGIONAL' }), { res: [320, 180], fps: 6 }),
    cctv: k.feed('cctv', (c, w, h, t, S) => drawCCTV(c, w, h, t, S, { seed: 3 }), { res: [256, 144], fps: 6 }),
  };
  const fk = Object.keys(feeds); let fi = 0;
  const seats = [];
  for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) {
    const x = -3.9 + i * 1.3, z = CT[1] + sd * 1.95, yaw = sd > 0 ? Math.PI : 0;
    chair(k, x, z, yaw, { seat: 'leather', frame: 'chrome', tall: true, color: 0x403a36 }); seats.push([x, z, yaw]);
    const pz = CT[1] + sd * 0.95; k.box('blackPlastic', [0.4, 0.015, 0.28], [x, 0.78, pz]); if (i % 2 === 0) { papers(k, x, 0.8, pz - sd * 0.1, sd * 0.2, 2); mug(k, x + 0.3, 0.8, pz); } else deskMic(k, x, 0.8, pz - sd * 0.2, 0);
  }
  for (const sd of [-1, 1]) { chair(k, sd * 5.7, CT[1], sd > 0 ? -Math.PI / 2 : Math.PI / 2, { seat: 'leather', tall: true, color: 0x403a36 }); seats.push([sd * 5.7, CT[1], sd > 0 ? -Math.PI / 2 : Math.PI / 2]); }
  // table-top display pods
  for (const x of [-2.6, 0, 2.6]) { k.box('chrome', [0.3, 0.02, 0.2], [x, 0.8, CT[1]]); k.box(cyan, [0.24, 0.004, 0.14], [x, 0.812, CT[1]], { mirror: false }); }
  // ----- console tiers (back and sides) -----
  const mon = (x, y, z, ry, feed, w = 0.62, lean = 0) => {
    k.push(x, y, z, ry, lean); k.box('blackPlastic', [w + 0.03, w * 0.5625 + 0.03, 0.03], [0, w * 0.2812 + 0.1, 0]); k.ambient(feed, w, w * 0.5625, [0, w * 0.2812 + 0.1, 0.017], { k: 1.0 }); k.box('blackPlastic', [0.05, 0.1, 0.03], [0, 0.05, -0.04]); k.box('blackPlastic', [0.26, 0.012, 0.18], [0, 0.006, -0.02]); k.pop();
  };
  const tier = (cx, cz, w, d, y, ry) => { k.push(cx, 0, cz, ry); k.box('paintDark', [w, y, d], [0, y / 2, 0]); k.box('carpetGrey', [w - 0.1, 0.02, d - 0.1], [0, y + 0.01, 0], { color: 0x30343a }); k.box(cyan, [w, 0.04, 0.05], [0, y - 0.05, d / 2 - 0.02], { mirror: false }); k.pop(); };
  const consoleRow = (cx, cz, y, ry, n, spacing) => {
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * spacing; k.push(cx, y, cz, ry);
      k.box('woodDark', [1.7, 0.05, 0.75], [lx, 0.74, 0]); k.box('paintDark', [1.7, 0.7, 0.04], [lx, 0.37, 0.34]); k.box('paintDark', [0.04, 0.7, 0.7], [lx - 0.83, 0.37, 0]); k.box('paintDark', [0.04, 0.7, 0.7], [lx + 0.83, 0.37, 0]);
      const f1 = feeds[fk[fi++ % fk.length]], f2 = feeds[fk[fi++ % fk.length]]; k.pop();
      k.push(cx, y, cz, ry); mon(lx - 0.42, 0.76, -0.1, 0, f1, 0.6, -0.04); mon(lx + 0.42, 0.76, -0.1, 0, f2, 0.6, -0.04); keyboard(k, lx, 0.77, 0.2, 0); k.pop();
    }
  };
  // back tiers (consoles face -Z)
  tier(0, 9.0, 16, 2.2, 0.4, 0); tier(0, 11.2, 16, 2.2, 0.8, 0);
  const rows = [];
  consoleRow(0, 8.7, 0.4, Math.PI, 7, 2.1); consoleRow(0, 10.9, 0.8, Math.PI, 7, 2.1);
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 2.1; chair(k, x, 7.6 + 0.0, 0, { y: 0.4, seat: 'fabricDark', tall: true }); chair(k, x, 9.8, 0, { y: 0.8, seat: 'fabricDark', tall: true }); }
  // side wings (consoles face centre)
  for (const sx of [-1, 1]) { tier(sx * 11.2, 5.0, 3.2, 6.5, 0.4, 0); for (const z of [2.6, 4.9, 7.2]) { k.push(sx * 11.5, 0.4, z, -sx * Math.PI / 2 - 0.0); k.box('woodDark', [1.7, 0.05, 0.7], [0, 0.74, 0]); k.box('paintDark', [1.7, 0.7, 0.04], [0, 0.37, 0.32]); k.pop(); k.push(sx * 11.5, 0.4, z, -sx * Math.PI / 2); mon(-0.42, 0.76, -0.1, 0, feeds[fk[fi++ % fk.length]], 0.6, -0.04); mon(0.42, 0.76, -0.1, 0, feeds[fk[fi++ % fk.length]], 0.6, -0.04); k.pop(); const cxx = sx * 11.5 - (-sx * Math.PI / 2 > 0 ? 0 : 0); chair(k, sx * 10.4, z, sx * Math.PI / 2 * -1 + Math.PI, { y: 0.4, seat: 'fabricDark', tall: true }); } }
  // hero consoles near map table with addressable screens
  const hero = [];
  for (const sx of [-1, 1]) { k.push(sx * 5.4, 0, -4.2, sx * -0.35); k.box('gunmetal', [2.0, 0.1, 0.9], [0, 0.78, 0]); k.box('paintDark', [1.9, 0.76, 0.8], [0, 0.38, 0]); const s2 = k.screen({ name: sx < 0 ? 'consoleL' : 'consoleR', w: 0.9, h: 0.52, draw: sx < 0 ? (c, w, h, t, S) => drawWorldMap(c, w, h, t, S, { theme: 'amber', title: 'REGION', labels: true }) : (c, w, h, t, S) => drawSpectrum(c, w, h, t, S), fps: 8, res: [320, 190], bezel: 0.03, k: 1.1 }, [0, 1.12, -0.28], { rx: -0.2 }); hero.push(s2); keyboard(k, 0, 0.84, 0.05, 0, 0.5); k.pop(); }
  // ----- glass briefing room (left) -----
  const BX = -9.4;
  k.box('glass', [0.05, 2.7, 8.0], [BX, 1.35, -5.5]); k.box('frosted', [0.05, 0.9, 8.0], [BX, 0.95, -5.5]); for (let z = -9.5; z <= -1.5; z += 2.0) k.box('steel', [0.1, 2.8, 0.08], [BX, 1.4, z]); k.box('steel', [0.1, 0.08, 8.1], [BX, 2.75, -5.5]);
  k.box('paintDark', [0.1, 3.2, 0.1], [BX, 1.6, -1.5]);
  k.floorQuad('carpetNavy', 3.6, 8, [BX - 1.8, 0.012, -5.5], { mirror: false });
  k.cyl('woodDark', [1, 1, 0.06], [BX - 1.8, 0.75, -5.5], { sx: 0.8, sz: 2.2, seg: 28, uv: 'box' }); k.cyl('blackPlastic', [1, 1, 0.7], [BX - 1.8, 0.38, -5.5], { sx: 0.3, sz: 1.1, seg: 20 });
  for (let i = 0; i < 6; i++) { const z = -5.5 + (i - 2.5) * 0.82; for (const sd of [-1, 1]) if (i < 3 || sd < 0) chair(k, BX - 1.8 + sd * 1.15, z, sd < 0 ? Math.PI / 2 : -Math.PI / 2, { seat: 'fabricGrey', frame: 'steel', tall: false }); }
  const briefing = k.screen({ name: 'briefing', w: 3.4, h: 1.9, draw: (c, w, h, t, S) => drawWorldMap(c, w, h, t, S, { theme: 'blue', title: 'BRIEFING', hud: true, labels: false }), fps: 6, res: [512, 290], bezel: 0.06, k: 1.05, mirror: false }, [X0 + 0.5, 2.0, -5.5], { ry: Math.PI / 2 });
  // ----- flags and plaques -----
  for (const [i, x, z] of [[1, -5.6, Z0 + 1.4], [2, -4.7, Z0 + 1.2], [3, 4.7, Z0 + 1.2], [4, 5.6, Z0 + 1.4]]) flag(k, x, 0, z, 0, i, { w: 1.5, h: 1.0, poleH: 3.0 });
  k.box('woodDark', [2.2, 1.4, 0.06], [-3.4, 3.2, Z1 - 0.2]); k.box('paintDark', [2.0, 1.2, 0.02], [-3.4, 3.2, Z1 - 0.23]);
  // ----- ceiling -----
  for (const [x, z] of [[-6, -4], [6, -4], [-6, 3], [6, 3], [0, -8], [0, 0.6], [-6, 9], [6, 9]]) lightPanel(k, x, H - 0.04, z, 2.2, 1.0, 0xffffff, 1.8);
  for (let z = -10; z <= 11; z += 3.5) k.box(cyan, [X1 - X0 - 3, 0.04, 0.05], [0, H - 0.05, z], { mirror: false });
  // ----- lights -----
  const hemi = new THREE.HemisphereLight(0xa8c0e8, 0x2a2a30, 1.9); k.light(hemi, 'hemi');
  const L1 = new THREE.PointLight(0xfff0e0, 85, 26, 1.4); L1.position.set(0, 5.6, 2); k.light(L1, 'tableKey');
  const L2 = new THREE.PointLight(0x4a8cff, 40, 22, 1.5); L2.position.set(0, 3.5, -8); k.light(L2, 'screenFill');
  k.state.threat = 0.55;
  // ----- anchors -----
  seats.forEach(([x, z, yaw], i) => k.anchor('seat' + i, [x, 0, z], yaw));
  k.anchor('general', [5.7, 0, CT[1]], -Math.PI / 2).anchor('briefer', [-5.6, 0, -9.3], 0).anchor('mapTable', [3.6, 0, MT[1] + 2.0], Math.PI + 0.7).anchor('mapTableFar', [0, 0, MT[1] - 3.4], 0).anchor('mapTableL', [-3.6, 0, MT[1] + 0.4], Math.PI / 2 + 0.2)
    .anchor('camWide', [0, 3.4, 11.6], Math.PI).anchor('camTable', [0, 1.7, 2.6], Math.PI).anchor('camScreens', [0, 2.0, -5.6], Math.PI).anchor('camMapTable', [-4.2, 1.9, 1.4], Math.PI + 0.9).anchor('camTop', [0, 6.0, 8.5], Math.PI).anchor('camBriefing', [-12, 1.6, -9], -0.6).anchor('camConsoles', [-3, 1.6, 6.5], Math.PI - 0.1).anchor('camLow', [0, 0.8, 4.5], Math.PI)
    .anchor('briefingA', [BX - 1.8, 0, -7.4], 0).anchor('briefingB', [BX - 1.8, 0, -3.6], Math.PI);
  k.onUpdate((dt, t) => { ringA.rotation.x = t * 0.4; ringA.rotation.y = t * 0.2; ringB.rotation.x = -t * 0.3 + 1; ringB.rotation.z = t * 0.25; });
  return k.api({ screen: wall, wall, mapTable, clocks, briefing, holo, bounds: { w: X1 - X0, d: Z1 - Z0, h: H }, setThreat: (v) => { k.state.threat = v; } });
}
