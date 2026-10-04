// createNewsStudio — modern TV news studio: curved anchor desk, LED video wall, ticker, cameras, light grid, lounge.
import * as THREE from 'three';
import { createKit } from './kit.js';
import { drawNewsWall, drawTicker, drawWorldMap, drawCCTV, drawTelemetry, SANS, MONO, drawDataScroll } from './draw.js';
import { arcSlab, arcPt, chair, monitor, mug, papers, tablet, deskMic, plant, lightPanel, spotFixture, trussGrid, cable, laptop, flag } from './props.js';
import { TAU } from '../../../engine/common.js';

function drawDeskFront(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#0a1a3a'); g.addColorStop(1, '#0c2a5a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const sx = ((t * 0.2) % 1.4 - 0.2) * w; const hg = ctx.createLinearGradient(sx - w * 0.15, 0, sx + w * 0.15, 0); hg.addColorStop(0, 'rgba(120,200,255,0)'); hg.addColorStop(0.5, 'rgba(120,200,255,0.35)'); hg.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d8141c'; ctx.fillRect(w * 0.08, h * 0.18, w * 0.06, h * 0.64); ctx.fillStyle = '#fff'; ctx.font = `900 ${h * 0.5}px ${SANS}`; ctx.textBaseline = 'middle'; ctx.fillText('EARTHWATCH', w * 0.17, h * 0.52); const tw0 = ctx.measureText('EARTHWATCH ').width; ctx.fillStyle = '#ffd400'; ctx.fillText('24', w * 0.17 + tw0, h * 0.52);
  ctx.fillStyle = '#8ec8ff'; ctx.font = `bold ${h * 0.32}px ${MONO}`; ctx.textAlign = 'right'; const tm = 12 * 3600 + Math.floor(t); ctx.fillText(`${String(Math.floor(tm / 3600) % 24).padStart(2, '0')}:${String(Math.floor(tm / 60) % 60).padStart(2, '0')}`, w * 0.96, h * 0.52); ctx.textAlign = 'left';
}

function panelArt(seed) {
  return (c, w, h) => {
    const hue = [200, 215, 190, 225, 205][seed % 5]; const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `hsl(${hue},70%,10%)`); g.addColorStop(0.5, `hsl(${hue},75%,26%)`); g.addColorStop(1, `hsl(${hue + 10},80%,14%)`); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = `hsla(${hue},90%,70%,0.35)`; c.lineWidth = 1.5; const n = 9; for (let i = -n; i <= n; i++) { c.beginPath(); c.moveTo(w / 2 + i * w / n * 0.55, 0); c.lineTo(w / 2 + i * w / n * 1.3, h); c.stroke(); }
    for (let j = 1; j < 14; j++) { c.globalAlpha = 0.18; c.fillStyle = `hsl(${hue},90%,70%)`; c.fillRect(0, j * h / 14, w, 1.5); } c.globalAlpha = 1;
    const r = (x) => ((Math.sin(x * 127.1 + seed * 31.7) * 43758.5453) % 1 + 1) % 1; for (let i = 0; i < 40; i++) { c.fillStyle = `hsla(${hue},90%,75%,${0.15 + 0.5 * r(i + 3)})`; const s = 2 + r(i) * 5; c.fillRect(r(i * 2.3) * w, r(i * 5.1) * h, s, s); }
  };
}
export function createNewsStudio(opts = {}) {
  const k = createKit('NewsStudio', { seed: 11 }); k.mirrorFloor = true;
  const X0 = -14, X1 = 14, Z0 = -13, Z1 = 11, H = 9.6;
  const cyan = k.glow(0x46c8ff, 2.4), blue = k.glow(0x2a6cff, 2.0), warm = k.glow(0xffe2b0, 3.0), white = k.glow(0xffffff, 3.2), red = k.glow(0xff2020, 2.6), amber = k.glow(0xffa020, 2.0);

  // ----- shell -----
  k.floorQuad('floorMirror', X1 - X0, Z1 - Z0, [0, 0, (Z0 + Z1) / 2]);
  k.box('paintDark', [X1 - X0, 0.3, Z1 - Z0], [0, H + 0.15, (Z0 + Z1) / 2]);
  k.wall('fabricDark', [X0, Z0], [X0, Z1], H, 0.3, { tile: 1 }); k.wall('fabricDark', [X1, Z0], [X1, Z1], H, 0.3, { tile: 1 });
  k.wall('paintDark', [X0, Z0], [X1, Z0], H, 0.3); k.wall('paintDark', [X0, Z1], [X1, Z1], H, 0.3);
  // back wall slat cladding
  for (let i = 0; i < 90; i++) { const x = -13.4 + i * 0.3; if (Math.abs(x) < 8.2) continue; k.box('woodDark', [0.1, 8.2, 0.07], [x, 4.4, Z0 + 0.19], { color: 0x4a3a30 }); }
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) { const x = sx * (8.3 + i * 1.15); k.box(i % 2 ? blue : cyan, [0.05, 7.6, 0.03], [x, 4.4, Z0 + 0.23], { mirror: false }); }
  // side-wall back-lit panels + vertical LED lines
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) { const z = -10.4 + i * 4.2; k.box('paintDark', [0.12, 5.2, 3.3], [sx * (X1 - 0.2), 3.6, z]); k.sign(2.9, 4.8, panelArt(i + (sx > 0 ? 5 : 0)), [sx * (X1 - 0.27), 3.6, z], { ry: -sx * Math.PI / 2, glow: true, k: 1.0, ppm: 70 }); }
    k.box(cyan, [0.05, 0.06, Z1 - Z0 - 1], [sx * (X1 - 0.17), 0.9, (Z0 + Z1) / 2]); k.box(blue, [0.05, 0.06, Z1 - Z0 - 1], [sx * (X1 - 0.17), 7.3, (Z0 + Z1) / 2]);
  }
  // ----- video wall assembly -----
  const wy = 3.9;
  k.box('blackPlastic', [15.6, 6.4, 0.5], [0, wy + 0.05, Z0 + 0.45]); k.box('steelDark', [15.9, 0.22, 0.7], [0, wy + 3.4, Z0 + 0.5]); k.box('steelDark', [15.9, 0.22, 0.7], [0, wy - 3.2, Z0 + 0.5]);
  k.box(cyan, [14.4, 0.05, 0.05], [0, wy - 2.9, Z0 + 0.78]);
  const mainScr = k.screen({ name: 'wall', w: 14.4, h: 5.4, curve: 30, draw: drawNewsWall, fps: 8, res: [1024, 384], k: 1.25 }, [0, wy, Z0 + 0.8]);
  k.screen({ name: 'ticker', w: 14.4, h: 0.55, curve: 30, draw: (c, w, h, t, S) => drawTicker(c, w, h, t, S), fps: 20, res: [1024, 48], k: 1.2 }, [0, wy + 3.0, Z0 + 0.8]);
  for (const sx of [-1, 1]) {
    k.box('blackPlastic', [3.8, 5.8, 0.3], [sx * 9.7, wy - 0.1, Z0 + 1.6], { ry: sx * -0.42 });
    k.screen({ name: sx < 0 ? 'screenL' : 'screenR', w: 3.5, h: 5.4, draw: sx < 0 ? (c, w, h, t, S) => drawWorldMap(c, w, h, t, S, { theme: 'blue', title: 'LIVE MAP', arcs: [] }) : (c, w, h, t, S) => drawTelemetry(c, w, h, t, S, { rows: 5, labels: ['CASES', 'ALERTS', 'FLIGHTS', 'MARKETS', 'SIGNAL'] }), fps: 8, res: [320, 480], k: 1.15 }, [sx * 9.55, wy, Z0 + 1.78], { ry: sx * -0.42 });
  }
  k.pool(0, Z0 + 3.2, 5.5, 0x4a9cff, 0.28); k.pool(0, Z0 + 3.0, 8, 0x2a5cc8, 0.18);

  // ----- anchor desk (curved) -----
  const C = [0, -9.6], R1 = 4.7, R0 = 3.7, aMax = 0.95, topY = 0.76;
  arcSlab(k, 'glossBlack', R0, R1, -aMax, aMax, topY - 0.05, topY, [C[0], 0, C[1]], { steps: 36 });
  arcSlab(k, 'chrome', R1 - 0.01, R1 + 0.02, -aMax, aMax, topY - 0.05, topY + 0.004, [C[0], 0, C[1]], { steps: 36, caps: false, inner: false, top: false });
  arcSlab(k, 'whitePlastic', R1 - 0.3, R1, -aMax, aMax, 0.1, topY - 0.05, [C[0], 0, C[1]], { steps: 36, color: 0xf4f6fa });
  arcSlab(k, 'blackPlastic', R1 - 0.34, R1 - 0.05, -aMax, aMax, 0.0, 0.1, [C[0], 0, C[1]], { steps: 36 });
  arcSlab(k, cyan, R1 - 0.02, R1 + 0.012, -aMax + 0.01, aMax - 0.01, 0.075, 0.095, [C[0], 0, C[1]], { steps: 36, caps: false, inner: false, top: false, bottom: false });
  arcSlab(k, blue, R0 + 0.02, R0 + 0.04, -aMax + 0.02, aMax - 0.02, topY - 0.07, topY - 0.05, [C[0], 0, C[1]], { steps: 36, caps: false, outer: false, top: false });
  // modesty panel under the desk top
  arcSlab(k, 'paintDark', R1 - 0.9, R1 - 0.86, -aMax + 0.05, aMax - 0.05, 0.1, topY - 0.05, [C[0], 0, C[1]], { steps: 28, caps: false });
  // desk-front LED screen + logos
  const dz = C[1] + R1 + 0.012;
  const chy = k.screen({ name: 'chyron', w: 3.6, h: 0.5, curve: -R1, draw: drawDeskFront, fps: 12, res: [768, 112], k: 1.2, mirror: false }, [0, 0.46, dz]);
  for (const sg of [-1, 1]) {
    const a = sg * 0.72; const [px, pz] = arcPt(C[0], C[1], R1 + 0.014, a);
    k.sign(1.3, 0.3, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8f4ff'; c.font = `900 ${h * 0.46}px ${SANS}`; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText('EARTHWATCH 24', w / 2, h * 0.54); }, [px, 0.46, pz], { ry: a, glow: true, ppm: 150, k: 1.4 });
  }
  // desk props
  const seatR = 3.15;
  for (const [i, a] of [[0, -0.2], [1, 0.2], [2, 0.62], [3, -0.62]]) {
    const [sx, sz] = arcPt(C[0], C[1], i < 2 ? seatR : seatR - 0.1, a);
    chair(k, sx, sz, a, { seat: i < 2 ? 'leather' : 'leatherWhite', frame: 'chrome', arms: true, tall: i < 2 });
    const [mx, mz] = arcPt(C[0], C[1], 4.15, a);
    if (i < 2) {
      k.push(mx, topY, mz, a + Math.PI, -1.15); k.box('blackPlastic', [0.46, 0.27, 0.025], [0, 0.14, 0]); k.pop(); k.box('blackPlastic', [0.16, 0.05, 0.1], [mx, topY + 0.025, mz], { ry: a });
      const [px, pz] = arcPt(C[0], C[1], 4.0, a + 0.16);
      papers(k, px, topY, pz, a + 0.2, 3); const [ux, uz] = arcPt(C[0], C[1], 3.98, a - 0.19); mug(k, ux, topY, uz); const [tx, tz] = arcPt(C[0], C[1], 3.95, a - 0.08); tablet(k, tx, topY, tz, a);
      const [qx, qz] = arcPt(C[0], C[1], 4.2, a + 0.1); deskMic(k, qx, topY, qz, a + Math.PI);
    }
  }
  k.blob(0, C[1] + 3.2, 4.5, 2.4, 0.008); k.pool(0, -6.6, 4.5, 0xdfe8ff, 0.12);
  // ----- floor rings -----
  const ring = (r, kI, th) => k.part(kI, new THREE.RingGeometry(r - th, r + th, 96), [0, 0.012, -7.2], { rx: -Math.PI / 2 });
  ring(8.2, cyan, 0.035); ring(8.55, blue, 0.02); ring(6.2, k.glow(0x1a4a9a, 1.4), 0.02);
  k.part(k.glow(0x0a2a5a, 0.8), new THREE.CircleGeometry(5.3, 64), [0, 0.011, -7.2], { rx: -Math.PI / 2 });

  // ----- lounge (right) -----
  const lx = 8.2, lz = -4.4;
  k.floorQuad('carpetNavy', 6.4, 5.0, [lx, 0.012, lz], { mirror: false });
  k.push(lx, 0, lz, -0.5);
  k.rbox('leatherWhite', [2.7, 0.42, 0.95], [0, 0.34, 0], { r: 0.1 }); k.rbox('leatherWhite', [2.7, 0.55, 0.28], [0, 0.72, -0.4], { r: 0.1 });
  for (const sx of [-1, 1]) k.rbox('leatherWhite', [0.28, 0.32, 0.9], [sx * 1.36, 0.58, 0], { r: 0.08 });
  for (const sx of [-0.7, 0.7]) k.rbox('leatherWhite', [1.1, 0.14, 0.8], [sx, 0.58, 0.05], { r: 0.06 });
  k.pop();
  for (const [dx, dz, ry] of [[-2.2, 1.3, 1.4], [-0.7, 2.2, 0.6]]) { k.push(lx + dx, 0, lz + dz, ry); k.rbox('leatherBrown', [0.9, 0.38, 0.85], [0, 0.3, 0], { r: 0.1 }); k.rbox('leatherBrown', [0.9, 0.5, 0.22], [0, 0.62, -0.32], { r: 0.1 }); k.pop(); }
  k.cyl('glossBlack', [0.62, 0.62, 0.04], [lx - 1.3, 0.38, lz + 1.0], { seg: 24 }); k.cyl('chrome', [0.04, 0.04, 0.34], [lx - 1.3, 0.19, lz + 1.0], { seg: 8 }); k.cyl('chrome', [0.36, 0.36, 0.02], [lx - 1.3, 0.01, lz + 1.0], { seg: 18 });
  plant(k, lx + 3.0, lz - 1.8, 1.5); plant(k, -12.6, -10.8, 1.7); plant(k, 12.6, -11.0, 1.7);
  k.blob(lx, lz, 4, 3, 0.014);

  // ----- cameras -----
  const camDefs = [[-5.6, 3.4], [0.4, 5.6], [5.6, 2.2]]; const cams = [];
  const tgt = [0, -6.2];
  camDefs.forEach(([cx, cz], i) => {
    const yaw = Math.atan2(tgt[0] - cx, tgt[1] - cz);
    k.push(cx, 0, cz, yaw);
    k.cyl('steelDark', [0.44, 0.48, 0.12], [0, 0.18, 0], { seg: 20 }); k.cyl('chrome', [0.09, 0.1, 0.9], [0, 0.65, 0], { seg: 12 }); k.cyl('blackPlastic', [0.14, 0.14, 0.3], [0, 0.4, 0], { seg: 12 });
    for (let w = 0; w < 3; w++) { const a = w * TAU / 3 + 0.4; k.cyl('blackMatte', [0.07, 0.07, 0.05], [Math.sin(a) * 0.42, 0.07, Math.cos(a) * 0.42], { seg: 10, rz: Math.PI / 2, ry: a }); k.rod('steelDark', [0, 0.14, 0], [Math.sin(a) * 0.42, 0.1, Math.cos(a) * 0.42], 0.03, { seg: 5 }); }
    k.pop(); k.blob(cx, cz, 1.7, 1.7, 0.009);
    const head = k.sub('camhead'); head.mirrorFloor = false;
    head.cyl('blackPlastic', [0.12, 0.12, 0.14], [0, 0, 0], { seg: 12 });
    head.box('greyPlastic', [0.3, 0.3, 0.55], [0, 0.22, -0.02]); head.box('blackPlastic', [0.34, 0.12, 0.3], [0, 0.4, -0.1]);
    head.cyl('blackMatte', [0.1, 0.075, 0.28], [0, 0.22, 0.4], { rx: Math.PI / 2, seg: 14 }); head.cyl('blackPlastic', [0.16, 0.16, 0.14], [0, 0.22, 0.5], { rx: Math.PI / 2, seg: 14 });
    head.cyl(head.glow(0x6aaaff, 1.5), [0.08, 0.08, 0.01], [0, 0.22, 0.58], { rx: Math.PI / 2, seg: 14 });
    head.box('blackMatte', [0.46, 0.4, 0.42], [0, 0.26, 0.74]); // prompter hood
    head.box('glass', [0.44, 0.58, 0.01], [0, 0.26, 0.97], { rx: -0.65, color: 0x4a6a88 });
    head.box('blackPlastic', [0.4, 0.26, 0.04], [0, 0.55, 0.0], {}); head.box(head.glow(0x1a3a6a, 1.0), [0.36, 0.2, 0.005], [0, 0.55, 0.024]);
    head.box(head.glow(0xff2a2a, 2.5), [0.03, 0.03, 0.02], [0, 0.4, 0.78]);
    head.rod('steelDark', [-0.18, 0.22, -0.28], [-0.24, 0.0, -1.0], 0.016, { seg: 5 }); head.rod('steelDark', [0.18, 0.22, -0.28], [0.24, 0.0, -1.0], 0.016, { seg: 5 });
    head.cyl('blackMatte', [0.025, 0.025, 0.14], [-0.24, 0.0, -1.0], { seg: 8, rx: 1.2 }); head.cyl('blackMatte', [0.025, 0.025, 0.14], [0.24, 0.0, -1.0], { seg: 8, rx: 1.2 });
    k.push(cx, 0, cz, yaw); const g = k.attach(head, [0, 1.12, 0]); k.pop(); cams.push({ g, yaw, base: g.rotation.y, i });
    // floor cable to the wall
    const ex = cx < 0 ? X0 + 1 : X1 - 1, ez = Z1 - 2.5 + i;
    cable(k, [cx - 0.3, 0.02, cz - 0.4], [ex, 0.02, ez], 0.014, 0.0, 'blackMatte', { mirror: false });
  });
  // floor monitors
  const fm = k.feed('floorMon', (c, w, h, t, S) => drawCCTV(c, w, h, t, S, { seed: 2 }), { res: [192, 108], fps: 6 });
  for (const [x, z, ry] of [[-2.8, 1.4, 0.1], [3.2, 1.2, -0.12]]) { k.cyl('blackPlastic', [0.03, 0.04, 0.9], [x, 0.45, z], { seg: 8 }); k.cyl('steelDark', [0.2, 0.22, 0.03], [x, 0.02, z], { seg: 14 }); monitor(k, x, 0.82, z, ry, { w: 0.62, feed: fm, stand: false, lift: 0, name: 'floorMonitor' + (x < 0 ? 'L' : 'R') }); }
  // ----- light grid -----
  trussGrid(k, -12.5, 12.5, -12, 8.5, 8.2, 8, 7);
  for (let i = 0; i < 18; i++) { const x = -10 + (i % 6) * 4, z = -10.5 + Math.floor(i / 6) * 4.6; spotFixture(k, x, 7.9, z, 0, 0.0 + (i % 3) * 0.1, { drop: 0.3 }); }
  for (const [x, z] of [[-3.3, -8], [3.3, -8], [-3.3, -3.4], [3.3, -3.4], [0, -6], [-8, -7], [8, -7]]) { lightPanel(k, x, 7.1, z, 2.6, 1.3, 0xffffff, 3.0); k.rod('steelDark', [x - 1, 7.17, z], [x - 1, 8.1, z], 0.01, {}); k.rod('steelDark', [x + 1, 7.17, z], [x + 1, 8.1, z], 0.01, {}); }
  k.shaft([-8, 7.1, -7], [-8, 0.2, -7], 0.9, 1.9, 0xcfe0ff, 0.05); k.shaft([8, 7.1, -7], [8, 0.2, -7], 0.9, 1.9, 0xcfe0ff, 0.05);
  // ON AIR sign + studio plate
  k.sign(1.8, 0.62, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff2a2a'; c.font = `900 ${h * 0.62}px ${SANS}`; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText('ON AIR', w / 2, h * 0.54); }, [X0 + 0.2, 6.6, 4.0], { ry: Math.PI / 2, glow: true, k: 2.8, ppm: 120 });
  k.box('blackPlastic', [0.1, 0.8, 2.0], [X0 + 0.12, 6.6, 4.0]);
  // exit door (left, behind cameras)
  k.box('steel', [0.2, 2.3, 1.3], [X0 + 0.1, 1.15, 7.5]); k.box(k.glow(0x30ff60, 2.0), [0.04, 0.2, 0.6], [X0 + 0.25, 2.6, 7.5]);

  // ----- lights -----
  const hemi = new THREE.HemisphereLight(0x9db8ff, 0x1a1c28, 1.15); k.light(hemi, 'hemi');
  const deskKey = new THREE.PointLight(0xfff0e0, 70, 26, 1.6); deskKey.position.set(0, 6.4, -4.2); k.light(deskKey, 'deskKey');
  const wallFill = new THREE.PointLight(0x5a8cff, 38, 22, 1.6); wallFill.position.set(0, 3.8, -8.5); k.light(wallFill, 'wallFill');
  k.state.threat = 0.3;

  // ----- anchors -----
  const seatPos = (a, r = seatR) => { const p = arcPt(C[0], C[1], r, a); return [p[0], 0, p[1]]; };
  k.anchor('anchorL', seatPos(-0.2), -0.2).anchor('anchorR', seatPos(0.2), 0.2).anchor('guest', seatPos(0.62, seatR - 0.1), 0.62).anchor('guest2', seatPos(-0.62, seatR - 0.1), -0.62)
    .anchor('anchorStand', [-1.0, 0, -4.1], 0.0).anchor('weatherSpot', [4.2, 0, -8.6], -0.3).anchor('loungeA', [lx - 2.0, 0, lz + 1.6], 1.2).anchor('loungeB', [lx + 0.6, 0, lz + 0.6], -0.9)
    .anchor('camWide', [0, 1.7, 8.6], Math.PI).anchor('camMid', [0.2, 1.45, 4.4], Math.PI).anchor('camTwoShot', [0, 1.3, -1.0], Math.PI).anchor('camAnchorL', [-1.0, 1.28, -1.9], Math.PI - 0.12).anchor('camAnchorR', [1.0, 1.28, -1.9], Math.PI + 0.12)
    .anchor('camDesk', [0, 0.9, -2.2], Math.PI).anchor('camWall', [0, 2.4, 3.0], Math.PI).anchor('camLounge', [lx - 4.5, 1.5, lz + 4.5], -2.4).anchor('camHigh', [-8, 5.0, 8], Math.PI + 0.7)
    .anchor('cam1', [camDefs[0][0], 0, camDefs[0][1]], cams[0].yaw).anchor('cam2', [camDefs[1][0], 0, camDefs[1][1]], cams[1].yaw).anchor('cam3', [camDefs[2][0], 0, camDefs[2][1]], cams[2].yaw);

  cams.forEach((c) => { c.g.rotation.order = 'YXZ'; });
  k.onUpdate((dt, t) => { cams.forEach((c, i) => { c.g.rotation.y = c.yaw + Math.sin(t * 0.21 + i * 1.9) * 0.05 + Math.sin(t * 0.07 + i) * 0.03; c.g.rotation.x = Math.sin(t * 0.17 + i) * 0.012; }); });
  const set = k.api({ screen: mainScr, chyron: chy, bounds: { w: X1 - X0, d: Z1 - Z0, h: H } });
  return set;
}
