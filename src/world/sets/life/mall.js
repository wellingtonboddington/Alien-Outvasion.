// City Mall (Dumaguete): 3-storey atrium, escalators with animated steps, shop fronts, kiosks, skylight, banners.
// Set space: origin = ground-floor centre. Concourse x∈[-24,24], z∈[-17,17]; floors at y=0 / 5.2 / 10.4; roof 16.2. Void (atrium) x∈[-10,10], z∈[-6.5,6.5].
// West wall (x=-24) = main entrance. Escalators: A (south) & A' (north) L0->L1, B (east) & B' (west) L1->L2.
import * as THREE from 'three';
import { RNG, TAU, seg } from '../../../engine/common.js';
import { Kit, atlas, canvasTexture, signMesh, uvRect, makeScreen, mat4 } from './kit.js';
import { plant, palm, bench, trashBin, finishSet, A, AT, troffer, stoolRound } from './props.js';
import { shopFront, shopSignAtlas, SHOP_NAMES } from './shops.js';

const LW = 48, LD = 34, F = 5.2, ROOF = 16.2, VX = 10, VZ = 6.5, SLAB = 0.4;

function slabHoles(K, top, body, x0, z0, x1, z1, y, holes) {
  const pieces = [[x0, z0, x1, z1]];
  let list = pieces;
  for (const h of holes) {
    const next = [];
    for (const [a, b, c, d] of list) {
      const hx0 = Math.max(h[0], a), hz0 = Math.max(h[1], b), hx1 = Math.min(h[2], c), hz1 = Math.min(h[3], d);
      if (hx0 >= hx1 || hz0 >= hz1) { next.push([a, b, c, d]); continue; }
      next.push([a, b, hx0, d], [hx1, b, c, d], [hx0, b, hx1, hz0], [hx0, hz1, hx1, d]);
    }
    list = next.filter((p) => p[2] - p[0] > 1e-3 && p[3] - p[1] > 1e-3);
  }
  for (const [a, b, c, d] of list) { K.slab(top, a, y - 0.05, b, c, y, d); K.slab(body, a, y - SLAB, b, c, y - 0.05, d); }
  return list;
}

// ------------------------------------------------------------------ escalator
function escalator(K, rise, o = {}) {
  const flat = 1.0, ang = Math.PI / 6, Li = rise / Math.sin(ang), R = Li * Math.cos(ang), Lp = flat + Li + flat, sd = 0.4;
  const pathY = (s) => (s <= flat ? 0 : s >= flat + Li ? rise : (s - flat) * Math.sin(ang));
  const pathZ = (s) => (s <= flat ? s : s >= flat + Li ? flat + R + (s - flat - Li) : flat + (s - flat) * Math.cos(ang));
  const total = flat * 2 + R;
  // truss (side view polygon -> extruded across x). polygon in (-z, y)
  const prof = [[0, -0.7], [0, -0.05], [flat, -0.05], [flat + R, rise - 0.05], [total, rise - 0.05], [total, rise - 0.7]];
  const poly = prof.map(([z, y]) => [-z, y]);
  for (const x of [-1.6, 0, 1.6]) K.extr('steelPlain', poly, 0.16, x, 0, 0, [0, Math.PI / 2, 0]);
  K.slab('darkMetal', -1.7, -0.3, 0.0, 1.7, -0.05, 0.3);
  K.at([0, 0, 0], 0, () => {
    // comb plates / floor covers
    K.slab('diamond', -1.7, 0.0, -0.45, 1.7, 0.012, 0.1); K.slab('diamond', -1.7, rise, total - 0.1, 1.7, rise + 0.012, total + 0.45);
    // balustrade glass ribbons + handrail
    const ptsTop = [], ptsBot = [];
    const nodes = [0, flat, flat + Li, flat + Li + flat]; // path param nodes
    const P = nodes.map((s) => [pathZ(s), pathY(s)]);
    for (const x of [-1.6, 0, 1.6]) {
      const mk = (y0, y1) => { const g = new THREE.BufferGeometry(); const pos = []; const idx = []; P.forEach(([z, y], i) => { pos.push(x, y + y0, z, x, y + y1, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
      if (x !== 0) K.geo('glass', mk(0.25, 1.0));
      else K.geo('paint#1c1d1f', mk(0.1, 0.95));
      // skirt
      K.geo('steel', mk(0.0, 0.3)); K.geo('rubberBlack', mk(0.95, 1.05));
      K.tube('rubberBlack', [[x, 1.02, -0.0], [x, 1.02, flat], [x, 1.02 + 0.0, flat]].slice(0, 1).concat(P.map(([z, y]) => [x, y + 1.02, z])), 0.04, { radial: 6, smooth: true, segs: 24 });
    }
  });
  // moving steps
  const N = Math.floor(Lp / sd); const lanes = [-0.8, 0.8];
  const sg = new THREE.BufferGeometry();
  { const t = new THREE.BoxGeometry(1.0, 0.035, sd - 0.01); t.translate(0, 0, 0); const r = new THREE.BoxGeometry(1.0, 0.2, 0.03); r.translate(0, -0.1, -sd / 2 + 0.02); const ge = [t, r].map((g) => g.toNonIndexed()); const m = [];
    for (const g of ge) { const p = g.attributes.position; const n = p.count; const col = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.push(g); }
    const pos = [], nor = [], uvs = [], cols = []; for (const g of m) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uvs.push(...g.attributes.uv.array); cols.push(...g.attributes.color.array); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); }
  const inst = new THREE.InstancedMesh(sg, K.m('diamondStep'), N * 2); inst.frustumCulled = false; inst.castShadow = true;
  const M = new THREE.Matrix4();
  const upd = (t) => {
    const speed = 0.5; let k = 0;
    for (let l = 0; l < 2; l++) { const dir = l === 0 ? 1 : -1; for (let i = 0; i < N; i++) { let s = ((i * sd + dir * speed * t) % Lp + Lp) % Lp; M.makeTranslation(lanes[l], pathY(s) + 0.0, pathZ(s)); inst.setMatrixAt(k++, M); } }
    inst.instanceMatrix.needsUpdate = true;
  };
  upd(0); K.mesh(inst);
  K.anim((dt, t) => upd(t));
  return { total, rise };
}

// ------------------------------------------------------------------ floor bake
function floorTexture() {
  return canvasTexture(1024, 724, (ctx, w, h) => {
    const px = w / 48; // px per metre
    const r = new RNG(71); const wx = (x) => (x + 24) * px, wz = (z) => (z + 17) * px;
    ctx.fillStyle = '#d9cfbf'; ctx.fillRect(0, 0, w, h);
    const tile = 0.9;
    for (let z = -17; z < 17; z += tile) for (let x = -24; x < 24; x += tile) { const v = r.range(-9, 9); ctx.fillStyle = `rgb(${220 + v},${210 + v},${192 + v})`; ctx.fillRect(wx(x) + 0.6, wz(z) + 0.6, tile * px - 1.2, tile * px - 1.2); }
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(${r.chance(0.5) ? '255,250,240' : '120,100,80'},${r.range(0.03, 0.1)})`; ctx.beginPath(); ctx.arc(r.range(0, w), r.range(0, h), r.range(8, 28), 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(80,66,50,0.35)'; ctx.lineWidth = 1; for (let x = -24; x <= 24; x += tile) { ctx.beginPath(); ctx.moveTo(wx(x), 0); ctx.lineTo(wx(x), h); ctx.stroke(); } for (let z = -17; z <= 17; z += tile) { ctx.beginPath(); ctx.moveTo(0, wz(z)); ctx.lineTo(w, wz(z)); ctx.stroke(); }
    // inlay border around the void + medallion
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = px * 0.5; ctx.strokeRect(wx(-10.8), wz(-7.3), px * 21.6, px * 14.6); ctx.strokeStyle = '#c7a96a'; ctx.lineWidth = px * 0.18; ctx.strokeRect(wx(-11.4), wz(-7.9), px * 22.8, px * 15.8);
    ctx.fillStyle = 'rgba(120,90,60,0.35)'; ctx.beginPath(); ctx.arc(wx(0), wz(0), px * 4.6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c7a96a'; ctx.lineWidth = px * 0.2; ctx.beginPath(); ctx.arc(wx(0), wz(0), px * 4.4, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(wx(0), wz(0), px * 3.2, 0, TAU); ctx.stroke();
    // skylight pool
    const g = ctx.createRadialGradient(wx(0), wz(0), 0, wx(0), wz(0), px * 15); g.addColorStop(0, 'rgba(255,252,240,0.55)'); g.addColorStop(0.6, 'rgba(255,248,230,0.18)'); g.addColorStop(1, 'rgba(255,248,230,0)'); ctx.save(); ctx.translate(wx(0), wz(0)); ctx.scale(1.5, 1); ctx.translate(-wx(0), -wz(0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
    // shop front reflections (north + south): coloured spill + streaks
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) { const cx = -24 + 3 + i * 6, col = ['#ff7a1a', '#58d0ff', '#e63946', '#ffd23f', '#6a1b9a', '#1ab6c9', '#ffffff', '#ff9f1c'][i]; const z0 = side < 0 ? -17 : 17; const gg = ctx.createLinearGradient(0, wz(z0), 0, wz(z0 - side * 4)); gg.addColorStop(0, 'rgba(255,240,215,0.45)'); gg.addColorStop(1, 'rgba(255,240,215,0)'); ctx.fillStyle = gg; ctx.fillRect(wx(cx - 2.8), Math.min(wz(z0), wz(z0 - side * 4)), px * 5.6, px * 4); ctx.fillStyle = col; ctx.globalAlpha = 0.16; ctx.fillRect(wx(cx - 2.2), Math.min(wz(z0), wz(z0 - side * 2.4)), px * 4.4, px * 2.4); ctx.globalAlpha = 1; for (let k = 0; k < 6; k++) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(wx(cx - 2.4 + k * 0.9), Math.min(wz(z0), wz(z0 - side * 3)), px * 0.08, px * 3); } }
    // wall AO
    for (const [x0, z0, x1, z1, vert] of [[0, 0, w, 14, 0], [0, h - 14, w, h, 0], [0, 0, 14, h, 1], [w - 14, 0, w, h, 1]]) { const gg = vert ? ctx.createLinearGradient(x0, 0, x1, 0) : ctx.createLinearGradient(0, z0, 0, z1); const dark = 'rgba(50,40,30,0.35)'; if (x0 === 0 && vert) { gg.addColorStop(0, dark); gg.addColorStop(1, 'rgba(50,40,30,0)'); } else if (vert) { gg.addColorStop(0, 'rgba(50,40,30,0)'); gg.addColorStop(1, dark); } else if (z0 === 0) { gg.addColorStop(0, dark); gg.addColorStop(1, 'rgba(50,40,30,0)'); } else { gg.addColorStop(0, 'rgba(50,40,30,0)'); gg.addColorStop(1, dark); } ctx.fillStyle = gg; ctx.fillRect(x0, z0, x1 - x0, z1 - z0); }
    // scuff / traffic lanes
    for (let i = 0; i < 70; i++) { ctx.strokeStyle = `rgba(90,75,60,${r.range(0.03, 0.09)})`; ctx.lineWidth = r.range(1, 4); ctx.beginPath(); const x = r.range(0, w), y = r.range(0, h); ctx.moveTo(x, y); ctx.lineTo(x + r.range(-60, 60), y + r.range(-60, 60)); ctx.stroke(); }
  }, { aniso: 8 });
}
function bannerAtlas() {
  return atlas(4, 1, 256, 768, (ctx, i, w, h) => {
    const cols = [['#c8102e', '#ffd23f', 'MEGA', 'SALE', '70% OFF'], ['#0e4a8a', '#ffffff', 'CITY', 'MALL', 'DUMAGUETE'], ['#1c8a4b', '#fff2b0', 'BACK TO', 'SCHOOL', 'NEW ARRIVALS'], ['#6a1b9a', '#ffd23f', 'SUMMER', 'FEST', 'JUN 1-30']][i];
    ctx.fillStyle = cols[0]; ctx.fillRect(0, 0, w, h); const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cols[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 82px "Arial Black",Impact,sans-serif'; ctx.fillText(cols[2], w / 2, 180); ctx.font = 'bold 96px "Arial Black",Impact,sans-serif'; ctx.fillText(cols[3], w / 2, 290);
    ctx.beginPath(); ctx.arc(w / 2, 520, 90, 0, TAU); ctx.fill(); ctx.fillStyle = cols[0]; ctx.font = 'bold 44px Arial'; ctx.fillText(cols[4].split(' ')[0], w / 2, 505); ctx.font = 'bold 30px Arial'; ctx.fillText(cols[4].split(' ').slice(1).join(' '), w / 2, 548);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(10, 10, w - 20, 6); ctx.fillRect(10, h - 16, w - 20, 6);
  });
}
const drawDirectory = (ctx, w, h) => {
  ctx.fillStyle = '#0f2a4a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Arial'; ctx.textAlign = 'left'; ctx.fillText('MALL DIRECTORY', 24, 50);
  const names = SHOP_NAMES.map((s) => s[0]); ctx.font = '19px Arial'; names.forEach((n, i) => { ctx.fillStyle = i % 2 ? '#9fd0ff' : '#ffffff'; ctx.fillText(`${String(i + 1).padStart(2, '0')}  ${n}`, 24 + Math.floor(i / 8) * 240, 96 + (i % 8) * 28); });
  ctx.strokeStyle = '#3a6ea8'; ctx.lineWidth = 3; ctx.strokeRect(w - 250, 70, 226, 170); ctx.fillStyle = '#1b4a7a'; ctx.fillRect(w - 244, 76, 214, 158); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(w - 137, 155, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '14px Arial'; ctx.fillText('YOU ARE HERE', w - 200, 190);
};
function ledWallDraw(ctx, w, h, t = 0) {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#102a52'); g.addColorStop(1, '#2a0e4a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 120px "Arial Black",Impact,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MEGA SALE', w / 2, h * 0.38); ctx.fillStyle = '#fff'; ctx.font = 'bold 56px Arial'; ctx.fillText('UP TO 70% OFF  •  ALL FLOORS  •  THIS WEEKEND', w / 2, h * 0.68);
  for (let i = 0; i < 18; i++) { ctx.fillStyle = `hsla(${(i * 20 + t * 30) % 360},90%,60%,0.7)`; ctx.beginPath(); ctx.arc(30 + i * (w - 60) / 17, h * 0.9, 12, 0, TAU); ctx.fill(); }
}

// ------------------------------------------------------------------ the set
export function createMallInterior(opts = {}) {
  const K = new Kit({ name: 'mall', env: 'mall', seed: 41 }); const rng = new RNG(41);
  K.setAmbience({ min: [-LW / 2, 0, -LD / 2], max: [LW / 2, ROOF, LD / 2], floor: 0.4, wall: 0.3, ceil: 0.3, range: 1.4 });
  K.defMat('diamondStep', { map: 'diamond', nrm: 'diamond', nrmS: 1.0, color: 0xffffff, rough: 0.42, metal: 0.8, tile: 0.8, env: 0.9, noAmb: true });
  const floorMat = K.defMat('mallFloor', { map: floorTexture(), color: 0xffffff, rough: 0.16, metal: 0.0, env: 0.9, uv: 'own' });
  const ba = bannerAtlas(); K.defMat('banner', { map: ba.tex, color: 0xffffff, rough: 0.85, uv: 'own', side: 'double', sway: 1.0 });
  const handTex = canvasTexture(64, 16, (ctx, w, h) => { ctx.fillStyle = '#1a1b1d'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#3a3c40'; ctx.fillRect(0, 0, w * 0.2, h); }, { repeat: true });
  handTex.repeat.set(30, 1);
  K.defMat('handrail', { map: handTex, color: 0xffffff, rough: 0.6, uv: 'own' });
  // note: handrail via 'rubberBlack' in escalator() (static). Texture scroll below applies to ring lamps instead.

  // ground floor (baked)
  K.geo('mallFloor', new THREE.PlaneGeometry(LW, LD), 0, 0, 0, [-Math.PI / 2, 0, 0]);
  K.slab('concrete', -LW / 2 - 8, -0.8, -LD / 2 - 8, LW / 2 + 8, -0.01, LD / 2 + 8);
  // upper slabs
  const holesL1 = [[-3.2, 6.5, 3.2, 13.0], [-3.2, -13.0, 3.2, -6.5]], holesL2 = [[11.0, -3.2, 20.0, 3.2], [-20.0, -3.2, -11.0, 3.2]];
  const ringRects = (hs) => { const out = []; for (const [a, b, c, d] of [[-24, -17, -10, 17], [10, -17, 24, 17], [-10, -17, 10, -6.5], [-10, 6.5, 10, 17]]) out.push(...slabHoles(K, 'marble#f1e8dc', 'soffit', a, b, c, d, 0, hs)); };
  for (let l = 1; l <= 2; l++) K.at([0, l * F, 0], 0, () => { const hs = l === 1 ? holesL1 : holesL2; for (const [a, b, c, d] of [[-24, -17, -10, 17], [10, -17, 24, 17], [-10, -17, 10, -6.5], [-10, 6.5, 10, 17]]) slabHoles(K, 'marble#f1e8dc', 'soffit', a, b, c, d, 0, hs); });
  // roof deck over the ring + skylight over the void
  K.slab('soffit', -24.3, ROOF - 0.5, -17.3, -10, ROOF, 17.3); K.slab('soffit', 10, ROOF - 0.5, -17.3, 24.3, ROOF, 17.3); K.slab('soffit', -10, ROOF - 0.5, -17.3, 10, ROOF, -6.5); K.slab('soffit', -10, ROOF - 0.5, 6.5, 10, ROOF, 17.3);
  // skylight: trusses + glowing panels
  K.at([0, ROOF, 0], 0, () => {
    for (let i = -5; i <= 5; i++) { K.box('darkMetal', 0.22, 0.5, 13.4, i * 2, -0.5, 0); K.box('darkMetal', 0.12, 0.9, 13.4, i * 2, -0.6, 0); }
    for (let j = -3; j <= 3; j++) K.box('darkMetal', 20.2, 0.18, 0.18, 0, -0.4, j * 2.1);
    K.tinted('#e6f2ff', () => { for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) K.box('glowCool', 1.85, 0.03, 2.0, -9 + i * 2, -0.18, -5.25 + j * 2.1); });
  });
  K.slab('glass', -10, ROOF + 0.1, -6.5, 10, ROOF + 0.13, 6.5);
  // columns around the void
  const colPos = []; for (const x of [-10, -5, 0, 5, 10]) for (const z of [-6.5, 6.5]) colPos.push([x, z]); for (const z of [-3.2, 3.2]) for (const x of [-10, 10]) colPos.push([x, z]);
  for (const [x, z] of colPos) K.at([x, 0, z], 0, () => { K.cyl('marble#e8dccb', 0.38, ROOF - 0.5, 0, 0, 0, { seg: 18 }); K.cyl('brass', 0.4, 0.12, 0, 1.0, 0, { seg: 18 }); K.cyl('darkMetal', 0.42, 0.15, 0, 0, 0, { seg: 18 }); K.tinted('#fff0d8', () => K.cyl('glowWarm', 0.06, 1.2, 0.33, 0.3, 0, { seg: 6 })); });
  // glass rails around the void on L1/L2 (+ openings)
  for (const l of [1, 2]) K.at([0, l * F, 0], 0, () => {
    const rail = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2; K.at([(x0 + x1) / 2, 0, (z0 + z1) / 2], yaw + Math.PI / 2 * 0, () => { K.at([0, 0, 0], Math.PI / 2, () => { K.box('glass', len, 1.05, 0.03, 0, 0.0, 0); K.box('chrome', len, 0.05, 0.07, 0, 1.05, 0); K.box('chrome', len, 0.04, 0.05, 0, 0.0, 0); for (let i = 0; i <= Math.round(len / 2); i++) K.box('chrome', 0.04, 1.05, 0.04, -len / 2 + i * len / Math.round(len / 2), 0, 0); }); }); };
    // each rail = long box along local x; rotate so it lies on the edge
    const railZ = (z, xa, xb) => K.at([(xa + xb) / 2, 0, z], 0, () => { const len = xb - xa; K.box('glass', len, 1.05, 0.03, 0, 0, 0); K.box('chrome', len, 0.05, 0.08, 0, 1.05, 0); K.box('chrome', len, 0.05, 0.05, 0, 0.0, 0); for (let i = 0; i <= Math.round(len / 2); i++) K.box('chrome', 0.04, 1.05, 0.04, -len / 2 + i * len / Math.round(len / 2), 0, 0); });
    const railX = (x, za, zb) => K.at([x, 0, (za + zb) / 2], Math.PI / 2, () => { const len = zb - za; K.box('glass', len, 1.05, 0.03, 0, 0, 0); K.box('chrome', len, 0.05, 0.08, 0, 1.05, 0); K.box('chrome', len, 0.05, 0.05, 0, 0.0, 0); for (let i = 0; i <= Math.round(len / 2); i++) K.box('chrome', 0.04, 1.05, 0.04, -len / 2 + i * len / Math.round(len / 2), 0, 0); });
    railZ(-VZ, -VX, VX); railZ(VZ, -VX, VX); railX(-VX, -VZ, VZ); railX(VX, -VZ, VZ);
    if (l === 1) { for (const sz of [1, -1]) { for (const sx of [-3.2, 3.2]) railX(sx, sz > 0 ? 6.5 : -13.0, sz > 0 ? 13.0 : -6.5); railZ(sz > 0 ? 13.0 : -13.0, -3.2, 3.2); } }
    else { for (const sx of [1, -1]) { for (const sz of [-3.2, 3.2]) railZ(sz, sx > 0 ? 11 : -20, sx > 0 ? 20 : -11); railX(sx > 0 ? 20 : -20, -3.2, 3.2); } }
  });
  // ---- shop fronts on all levels
  const sy = (l) => l * F;
  const shopH = 4.5;
  for (let l = 0; l < 3; l++) {
    K.at([0, sy(l), -17], 0, () => { for (let i = 0; i < 8; i++) K.at([-21 + i * 6, 0, 0], 0, () => { if (l > 0 && (i + l * 3) % 7 === 4) closedShop(K, 6, shopH, (l * 8 + i)); else shopFront(K, { w: 5.9, h: shopH, idx: (l * 5 + i * 3 + 1) % 16, seed: l * 8 + i + 1 }); }); });
    K.at([0, sy(l), 17], Math.PI, () => { for (let i = 0; i < 8; i++) K.at([-21 + i * 6, 0, 0], 0, () => { if (l > 0 && (i + l * 5) % 6 === 2) closedShop(K, 6, shopH, (l * 8 + i + 20)); else shopFront(K, { w: 5.9, h: shopH, idx: (l * 7 + i * 5 + 2) % 16, seed: l * 8 + i + 30 }); }); });
    K.at([24, sy(l), 0], -Math.PI / 2, () => { for (let i = 0; i < 6; i++) K.at([-14.17 + i * 5.667, 0, 0], 0, () => { if (l > 0 && (i + l) % 5 === 1) closedShop(K, 5.67, shopH, l * 6 + i + 40); else shopFront(K, { w: 5.57, h: shopH, idx: (l * 3 + i * 7 + 4) % 16, seed: l * 6 + i + 60 }); }); });
    if (l === 0) {
      K.at([-24, 0, 0], Math.PI / 2, () => { for (const i of [0, 1, 4, 5]) K.at([-14.17 + i * 5.667, 0, 0], 0, () => shopFront(K, { w: 5.57, h: shopH, idx: (i * 3 + 9) % 16, seed: 80 + i })); });
      mallEntrance(K);
    } else K.at([-24, sy(l), 0], Math.PI / 2, () => { for (let i = 0; i < 6; i++) K.at([-14.17 + i * 5.667, 0, 0], 0, () => { if ((i + l) % 4 === 0) closedShop(K, 5.67, shopH, l * 6 + i + 70); else shopFront(K, { w: 5.57, h: shopH, idx: (l * 4 + i * 3 + 11) % 16, seed: l * 6 + i + 90 }); }); });
  }
  // ---- escalators
  const eA = (x, z, yaw, rise, y0) => K.at([x, y0, z], yaw, () => escalator(K, rise));
  eA(0, 3.0, 0, F, 0); eA(0, -3.0, Math.PI, F, 0);       // A (south), A' (north): run along +/-z
  eA(11.0, 0, Math.PI / 2, F, F); eA(-11.0, 0, -Math.PI / 2, F, F);  // B (east), B' (west)
  // ---- ground-floor atrium furniture
  const kiosk = (x, z, yaw, idx) => K.at([x, 0, z], yaw, () => {
    K.box('paint#f2f0ea', 3.0, 0.9, 1.2, 0, 0, 0); K.box('woodGrain#7a5030', 3.1, 0.06, 1.3, 0, 0.9, 0); K.box('glass', 2.9, 0.45, 1.1, 0, 0.96, 0); K.box('darkMetal', 3.0, 0.1, 1.2, 0, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box('darkMetal', 0.07, 2.6, 0.07, sx * 1.45, 0, sz * 0.55);
    K.box('paint#2b2d31', 3.1, 0.5, 1.3, 0, 2.6, 0); K.tinted('#fff4e0', () => K.box('glow', 2.8, 0.03, 1.1, 0, 2.58, 0));
    const sa = shopSignAtlas(); if (!K.mats.has('shopSign')) { K.defMat('shopSign', { map: sa.tex, color: 0xffffff, rough: 0.4, uv: 'own', emissive: 0xffffff, emissiveIntensity: 0 }); const m = K.m('shopSign'); m.emissiveMap = sa.tex; m.emissiveIntensity = 0.85; }
    for (const s of [-1, 1]) K.at([0, 0, s * 0.66], s > 0 ? 0 : Math.PI, () => K.geo('shopSign', uvRect(new THREE.PlaneGeometry(2.8, 0.44), sa.cell(idx)), 0, 2.85, 0));
    for (let i = 0; i < 9; i++) K.tinted(rng.pick(['#e5b53a', '#2c6fbb', '#d94b4b', '#47a56a', '#f4f4f0']), () => K.box('matte', 0.25, 0.2, 0.2, -1.2 + i * 0.3, 1.0, 0.0 + (i % 2) * 0.1 - 0.1));
    K.at([0.9, 0, -0.9], 0.4, () => stoolRound(K, { h: 0.7, color: '#2c6fbb' }));
  });
  kiosk(-5.6, -2.6, 0.2, 2); kiosk(5.8, 2.8, Math.PI + 0.3, 3); kiosk(-2.2, 4.4, 0.1, 6); kiosk(3.0, -4.0, Math.PI, 8); kiosk(-8.0, 1.0, Math.PI / 2, 10);
  // central stage + big planter ring
  K.at([0, 0, 0], 0, () => { K.cyl('marble#d9cdbd', 3.3, 0.35, 0, 0, 0, { seg: 40 }); K.cyl('brass', 3.32, 0.03, 0, 0.35, 0, { seg: 40 }); K.cyl('marble#efe6d8', 3.0, 0.03, 0, 0.35, 0, { seg: 40 }); K.torus('glowWarm', 3.18, 0.025, 0, 0.34, 0, [Math.PI / 2, 0, 0], { seg: 4, segR: 48 }); plant(K, 'ficus', { s: 4.2, potColor: '#cfc6b6', seed: 8, n: 120 }); });
  for (const [x, z] of [[-9, -5.5], [9, 5.5], [-9, 5.5], [9, -5.5], [0, -5.6], [0, 5.6], [-7, 0], [7, 0]]) K.at([x, 0, z], 0, () => { K.cyl('marble#d9cdbd', 0.7, 0.55, 0, 0, 0, { seg: 20 }); K.cyl('matte#2a1d14', 0.62, 0.04, 0, 0.54, 0, { seg: 16 }); plant(K, (x + z) % 2 ? 'dracaena' : 'ficus', { s: 2.4, potted: false, seed: Math.abs(x * 3 + z) }); });
  for (const [x, z, yaw] of [[-3, -5.0, 0], [3, 5.2, Math.PI], [-6, 4.5, 0.5], [7, -3, -Math.PI / 2], [-7.2, -2, Math.PI / 2], [0, -4.4, 0]]) K.at([x, 0, z], yaw, () => bench(K, 1.8, { color: '#6a4a30', legMat: 'steelPlain', back: true }));
  for (const [x, z] of [[-4.5, 0.5], [4.5, -0.5], [-8.6, -4.0], [8.6, 4.0]]) K.at([x, 0, z], 0, () => trashBin(K, 0.22, 0.8, '#3a3f45'));
  // info boards
  const dir = makeScreen(1.5, 1.0, { res: [640, 430], draw: drawDirectory, frame: true }); const dir2 = makeScreen(1.5, 1.0, { res: [640, 430], draw: drawDirectory, frame: true });
  K.at([-6.0, 0, 5.1], 0.2, () => { K.box('darkMetal', 1.7, 2.1, 0.2, 0, 0, 0); dir.mesh.position.set(0, 1.2, 0.11); K.mesh(dir.mesh); });
  K.at([6.0, 0, -5.1], Math.PI + 0.2, () => { K.box('darkMetal', 1.7, 2.1, 0.2, 0, 0, 0); dir2.mesh.position.set(0, 1.2, 0.11); K.mesh(dir2.mesh); });
  // big LED wall on the east end, above L1
  const led = makeScreen(9, 3.6, { res: [1024, 410], draw: (c, w, h) => ledWallDraw(c, w, h, 0), frame: true, bright: 1.25 });
  K.at([23.9, 5.4, 0], -Math.PI / 2, () => { K.box('darkMetal', 9.6, 4.2, 0.3, 0, -0.3, -0.18); led.mesh.position.set(0, 1.5, 0); K.mesh(led.mesh); });
  // hanging banners (from the L2 rail down)
  for (const [x, z, yaw, i] of [[-8, -6.5, 0, 0], [0, -6.5, 0, 1], [8, -6.5, 0, 2], [-8, 6.5, Math.PI, 3], [0, 6.5, Math.PI, 0], [8, 6.5, Math.PI, 1], [-10, -3, Math.PI / 2, 2], [10, 3, -Math.PI / 2, 3]]) K.at([x, 10.4 + 0.9, z + (z < 0 ? 0.12 : z > 0 ? -0.12 : 0)], yaw, () => { K.cloth('banner', 1.5, 4.5, 0, -2.25, 0, 0, { rect: ba.cell(i), pin: 'top', ws: 4, hs: 12 }); K.box('chrome', 1.6, 0.05, 0.05, 0, 0.02, 0); });
  // hanging ring chandeliers
  for (const [x, z, r] of [[-5, 0, 2.6], [5, 0, 2.6]]) K.at([x, 13.6, z], 0, () => { K.torus('glow', r, 0.08, 0, 0, 0, [Math.PI / 2, 0, 0], { seg: 6, segR: 56 }); K.torus('glowWarm', r * 0.6, 0.05, 0, 0.1, 0, [Math.PI / 2, 0, 0], { seg: 5, segR: 40 }); for (let i = 0; i < 4; i++) { const a = i * TAU / 4; K.cyl('darkMetal', 0.015, 2.6, Math.cos(a) * r, 0, Math.sin(a) * r, { seg: 4 }); } });
  // ceilings' troffers for ring corridors
  for (let l = 0; l < 3; l++) { const cy = l < 2 ? (l + 1) * F - SLAB : ROOF - 0.5; for (let i = 0; i < 10; i++) for (const z of [-11.5, 11.5]) K.at([-21.6 + i * 4.8, 0, z], 0, () => { if (Math.abs(-21.6 + i * 4.8) > 9.5 || Math.abs(z) > 7) troffer(K, 1.2, 0.5, cy + l * F * 0 + (l < 2 ? 0 : 0) , 'glow', 2); }); }
  // bright entrance daylight spill is handled in mallEntrance
  K.build();
  // ---- lights
  const hemi = new THREE.HemisphereLight(0xf2f6ff, 0xc2b296, 1.15);
  const p1 = new THREE.PointLight(0xfff2dc, 70, 0, 2); p1.position.set(0, 7.5, 0); const p2 = new THREE.PointLight(0xffefd6, 40, 0, 2); p2.position.set(0, 2.8, 3.5);
  const set = finishSet(K, {}, {
    bounds: { w: LW, d: LD, h: ROOF },
    anchors: {
      entrance: AT([-21, 0, 0], [0, 1.4, 0]), kiosk1: AT([-5.6, 0, -1.2], [-5.6, 1.2, -2.6]), kiosk2: AT([5.8, 0, 1.4], [5.8, 1.2, 2.8]), stage: AT([0, 0.35, 4.0], [0, 1.4, 0]), bench1: AT([-3, 0, -4.4], [-3, 0.5, -5.0]), bench2: AT([3, 0, 4.6], [3, 0.5, 5.2]),
      escalatorA_bottom: AT([0, 0, 1.6], [0, 1, 6]), escalatorA_top: AT([0, F, 14.2], [0, F + 1, 10]), escalatorB_top: AT([21, F * 2, 0], [14, F * 2, 0]),
      balcony1: AT([-6, F, -6.0], [-6, 1.0, 0]), balcony2: AT([6, 2 * F, 5.9], [6, F * 2, 0]), shop1: AT([-12, 0, -13.5], [-12, 1.5, -17]), shop2: AT([12, 0, 13.5], [12, 1.5, 17]),
      camWide: { pos: [-22.5, 1.7, 14.5], yaw: Math.atan2(40, -22), look: [8, 4.5, -5] }, camEntrance: { pos: [-21.5, 1.7, 0], yaw: Math.PI / 2, look: [10, 3.0, 0] },
      camAtriumUp: { pos: [-6, 1.2, 8], yaw: 0, look: [3, 12, -4] }, camEscalator: { pos: [-6, F + 1.6, 6.0], yaw: 0, look: [0, F + 0.5, 12] }, camBalcony: { pos: [8, 2 * F + 1.6, 6.0], yaw: Math.PI, look: [-4, F, -4] },
      camShops: { pos: [0, 1.6, 8.0], yaw: Math.PI, look: [-6, 2.6, -17] }, camKiosk: { pos: [-3.2, 1.6, -0.2], yaw: -Math.PI / 2, look: [-5.6, 1.2, -2.6] }, camLevel1: { pos: [-20, F + 1.6, 12], yaw: 0, look: [8, F + 1.5, -6] },
      camOverhead: { pos: [0, 15.6, 0.1], yaw: Math.PI, look: [0, 0, 0] },
    },
    lights: [hemi, p1, p2], screens: [dir.screen, dir2.screen, led.screen],
    update(dt, t) { if (((led.screen._f = (led.screen._f || 0) + 1) % 4) === 0) { led.screen.ctx && ledWallDraw(led.screen.ctx, led.screen.canvas.width, led.screen.canvas.height, t); led.screen.tex.needsUpdate = true; } },
  });
  return set;
}

function closedShop(K, w, h, seed) {
  const rng = new RNG(seed + 3);
  K.box('paint#2b2d31', w - 0.1, 0.85, 0.2, 0, h - 0.85, -0.1); const sa = shopSignAtlas();
  K.geo('shopSign', uvRect(new THREE.PlaneGeometry(w - 0.4, 0.7), sa.cell(seed % 16)), 0, h - 0.43, 0.003);
  K.box('corrugated', w - 0.1, h - 0.85, 0.12, 0, 0, -0.05); K.box('darkMetal', w - 0.1, 0.18, 0.2, 0, h - 1.03, -0.05);
  K.box('paint#d8d0c2', w, h, 0.1, 0, 0, -0.35);
  if (rng.chance(0.5)) K.tinted('#e8e0c0', () => K.box('matte', 0.4, 0.5, 0.004, rng.range(-w / 3, w / 3), 1.5, 0.02));
}
function mallEntrance(K) {
  K.at([-24, 0, 0], Math.PI / 2, () => {
    const w = 11.3, h = 4.5;
    K.box('glass', w, 4.3, 0.04, 0, 0, 0); for (let i = 0; i <= 8; i++) K.box('darkMetal', 0.1, 4.4, 0.12, -w / 2 + i * w / 8, 0, 0); K.box('darkMetal', w, 0.14, 0.14, 0, 0, 0); K.box('darkMetal', w, 0.14, 0.14, 0, 2.3, 0); K.box('darkMetal', w, 0.14, 0.14, 0, 4.3, 0);
    for (let i = 0; i < 4; i++) K.at([-4.2 + i * 2.8, 0, 0], 0, () => { K.box('chrome', 0.03, 0.7, 0.04, -0.2, 0.9, 0.05); K.box('chrome', 0.03, 0.7, 0.04, 0.2, 0.9, 0.05); K.box('chrome', 1.2, 0.06, 0.06, 0, 2.2, 0.0); });
    K.box('paint#0e4a8a', w, 0.7, 0.3, 0, 4.4, -0.1); K.tinted('#fff', () => K.box('glow', w - 0.3, 0.02, 0.05, 0, 4.4, 0.06));
    const sg = signMesh(8.0, 0.55, (ctx, W, H) => { ctx.fillStyle = '#0e4a8a'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffd23f'; ctx.font = `bold ${H * 0.7}px "Arial Black",Impact,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CITY MALL  DUMAGUETE', W / 2, H * 0.54); }, { px: 150, lit: true, emissive: 1.0, bg: '#0e4a8a' }); sg.position.set(0, 4.62, 0.065); K.mesh(sg);
    const day = signMesh(12.4, 5.4, (ctx, W, H) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6ea6e6'); g.addColorStop(0.55, '#d6e8f6'); g.addColorStop(0.62, '#e8e2d0'); g.addColorStop(1, '#b8b0a0'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) { const x = (i + 0.5) * W / 6; ctx.fillStyle = '#6a4a30'; ctx.fillRect(x - 3, H * 0.28, 7, H * 0.4); ctx.fillStyle = '#3c7a30'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.ellipse(x + Math.cos(k * 0.7) * 30, H * 0.28 + Math.sin(k * 0.7) * 6, 36, 7, k * 0.7, 0, TAU); ctx.fill(); } } ctx.fillStyle = '#9a9a96'; ctx.fillRect(0, H * 0.7, W, H * 0.3); }, { px: 60, lit: true, emissive: 1.5, bg: '#fff' }); day.position.set(0, 2.5, -1.5); K.mesh(day);
  });
}
