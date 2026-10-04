// Civilian road vehicles: cars (sedan/hatch/suv/taxi/police/ambulance/van/pickup), bus, trucks, motorbike, Philippine tricycle, instanced car parks.
import {
  THREE, RNG, clamp, lerp, damp, smoothstep, TAU, Q, GLOBAL, cached, mk, TX, Parts, assemble, box, rbox, cyl, cylX, cylZ, sph, ell, tor, plane, between, boxBetween,
  sideSlab, lath, projUV, pw, loftZ, wheelGeos, addWheel, makeVehicle, plateTex, randPlate, norm, xf, disposeTree, infectable, mergeGeometries, canvasTex, texRes, speckle, archable,
} from './kit.js';

export const CAR_PAINTS = { white: 0xe4e6e8, black: 0x14171b, silver: 0x9a9ea5, red: 0xa5161c, blue: 0x1c3b78, green: 0x2d5e3d, gold: 0xb08a2e, maroon: 0x6a1c2a, yellow: 0xe8b410, charcoal: 0x3a3f46, champagne: 0xcdc4ae, teal: 0x127078, orange: 0xd8581a, sky: 0x5f8fc4, police: 0xf2f4f6 };
const PAINT_LIST = ['white', 'black', 'silver', 'red', 'blue', 'green', 'charcoal', 'champagne', 'maroon', 'teal', 'sky', 'orange', 'gold'];
export const resolveCarPaint = (p, rng) => (p === undefined || p === null ? CAR_PAINTS[rng.pick(PAINT_LIST)] : typeof p === 'string' ? (CAR_PAINTS[p] ?? new THREE.Color(p).getHex()) : p);

// ───────────────────────────── specs ─────────────────────────────
// All z measured from the car centre, +z front. top/yb/w are [[z,value]...] breakpoints.
const SPEC = {
  sedan: {
    L: 4.75, hw: 0.92, wr: 0.325, tw: 0.215, rim: 0.2, wheel: 'alloy5', zF: 1.43, zR: -1.42, tx: 0.79, roundF: 0.34, roundB: 0.3,
    tubW: [[-2.375, 0.78], [-2.0, 0.89], [-1.2, 0.915], [1.2, 0.915], [1.9, 0.895], [2.375, 0.8]], tubB: [[-2.375, 0.32], [-2.0, 0.24], [-1.3, 0.2], [1.3, 0.2], [2.0, 0.23], [2.375, 0.28]],
    tubT: [[-2.375, 0.84], [-2.15, 0.93], [-1.5, 0.96], [1.0, 0.95], [1.3, 0.93], [1.9, 0.82], [2.375, 0.7]],
    cab: { z0: -1.42, z1: 1.12, yb: 0.955, top: [[-1.42, 1.0], [-1.22, 1.22], [-0.85, 1.4], [-0.35, 1.455], [0.2, 1.45], [0.55, 1.38], [0.85, 1.2], [1.12, 0.99]], wb: [[-1.42, 0.7], [-1.0, 0.8], [0.5, 0.8], [1.12, 0.72]], wt: [[-1.42, 0.46], [-1.0, 0.62], [0.3, 0.64], [0.8, 0.58], [1.12, 0.46]], p: 3 },
    roof: [-0.98, 0.45], doors: [1.12, 0.02, -1.22], win: { front: [0.98, 0.6], rear: [-1.25, -0.99], bpillar: -0.32 }, hl: { x0: 0.33, x1: 0.78, yc: 0.68, h: 0.1 }, tl: { x0: 0.3, x1: 0.8, yc: 0.77, h: 0.1 }, seats: [0.5, -0.55], dashZ: 0.82, tailKind: 'sedan',
  },
  hatch: {
    L: 4.0, hw: 0.88, wr: 0.31, tw: 0.2, rim: 0.19, wheel: 'alloy5', zF: 1.2, zR: -1.28, tx: 0.76, roundF: 0.45, roundB: 0.3,
    tubW: [[-2.0, 0.78], [-1.7, 0.86], [-1.1, 0.875], [1.1, 0.875], [1.6, 0.86], [2.0, 0.78]], tubB: [[-2.0, 0.32], [-1.7, 0.24], [-1.1, 0.2], [1.1, 0.2], [1.7, 0.23], [2.0, 0.28]],
    tubT: [[-2.0, 0.92], [-1.7, 1.0], [-1.0, 1.0], [0.9, 0.96], [1.1, 0.95], [1.55, 0.86], [2.0, 0.72]],
    cab: { z0: -1.98, z1: 0.98, yb: 0.97, top: [[-1.98, 1.02], [-1.9, 1.2], [-1.7, 1.42], [-1.2, 1.53], [-0.2, 1.55], [0.3, 1.48], [0.7, 1.27], [0.98, 1.0]], wb: [[-1.98, 0.7], [-1.7, 0.78], [0.5, 0.79], [0.98, 0.72]], wt: [[-1.98, 0.55], [-1.5, 0.66], [0.3, 0.66], [0.7, 0.6], [0.98, 0.5]], p: 3 },
    roof: [-1.55, 0.3], doors: [0.98, -0.0, -1.1], win: { front: [0.9, 0.5], rear: [-1.7, -1.45], bpillar: -0.1, noRear: false }, hl: { x0: 0.3, x1: 0.74, yc: 0.78, h: 0.12 }, tl: { x0: 0.5, x1: 0.8, yc: 0.88, h: 0.2 }, seats: [0.36, -0.75], dashZ: 0.68, tailKind: 'hatch',
  },
  suv: {
    L: 4.85, hw: 0.97, wr: 0.385, tw: 0.265, rim: 0.23, wheel: 'alloy10', zF: 1.5, zR: -1.38, tx: 0.82, roundF: 0.45, roundB: 0.25,
    tubW: [[-2.425, 0.88], [-2.0, 0.955], [-1.2, 0.965], [1.2, 0.965], [2.0, 0.945], [2.425, 0.86]], tubB: [[-2.425, 0.4], [-2.0, 0.32], [-1.3, 0.3], [1.3, 0.3], [2.1, 0.32], [2.425, 0.36]],
    tubT: [[-2.425, 1.04], [-2.2, 1.14], [-1.4, 1.14], [1.0, 1.1], [1.3, 1.1], [2.0, 1.0], [2.425, 0.88]],
    cab: { z0: -2.3, z1: 1.2, yb: 1.12, top: [[-2.3, 1.15], [-2.25, 1.4], [-2.1, 1.7], [-1.5, 1.8], [0.2, 1.8], [0.6, 1.74], [1.0, 1.45], [1.2, 1.14]], wb: [[-2.3, 0.88], [-2.0, 0.92], [0.6, 0.93], [1.2, 0.86]], wt: [[-2.3, 0.8], [-2.0, 0.84], [0.6, 0.84], [1.2, 0.66]], p: 4 },
    roof: [-2.08, 0.5], doors: [1.2, 0.2, -1.2], win: { front: [1.12, 0.7], rear: [-1.7, -1.55], bpillar: -0.5, extra: [[-1.6, -1.65, -2.05, -2.15]] }, hl: { x0: 0.4, x1: 0.88, yc: 0.93, h: 0.13 }, tl: { x0: 0.66, x1: 0.92, yc: 0.92, h: 0.2 }, seats: [0.58, -0.4], dashZ: 0.95, tailKind: 'suv',
  },
};

// ───────────────────────────── body decals (per style, painted once) ─────────────────────────────
function bodyDecal(kind, spec, tub, livery) {
  return cached(`car:decal:${kind}:${livery || ''}`, () => canvasTex(texRes(1024), texRes(256), (ctx, w, h) => {
    const L = spec.L, z0 = -L / 2, ymin = tub.userData.ymin, ymax = tub.userData.ymax;
    const U = (z) => ((z - z0) / L) * w, V = (y) => (1 - (y - ymin) / (ymax - ymin)) * h;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    // beltline shading + character line
    let g = ctx.createLinearGradient(0, V(0.95), 0, V(0.78)); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(150,150,150,0.14)'); ctx.fillStyle = g; ctx.fillRect(0, V(0.95), w, V(0.78) - V(0.95));
    ctx.strokeStyle = 'rgba(255,255,255,0.0)';
    // door shut lines
    ctx.strokeStyle = 'rgba(10,10,12,0.55)'; ctx.lineWidth = Math.max(1.2, w / 500); ctx.lineCap = 'round';
    const [dF, dM, dR] = spec.doors; const top = V(0.98), bot = V(0.3);
    for (const z of [dF, dM, dR]) { ctx.beginPath(); ctx.moveTo(U(z), top); ctx.lineTo(U(z) + (z === dM ? 0 : (z === dF ? -4 : 3)), bot); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(U(dF), bot); ctx.lineTo(U(dR), bot + 2); ctx.stroke(); // sill line
    ctx.beginPath(); ctx.moveTo(U(dF), top); ctx.lineTo(U(dR), top); ctx.stroke(); // beltline slot (window sill)
    // hood / trunk / fender gaps at the tub top (seen on the top surface through the same uv)
    ctx.strokeStyle = 'rgba(10,10,12,0.5)'; for (const z of [spec.cab.z1 + 0.12, spec.cab.z0 - 0.12]) { ctx.beginPath(); ctx.moveTo(U(z), V(ymax - 0.01)); ctx.lineTo(U(z), V(0.9)); ctx.stroke(); }
    // fuel flap
    ctx.strokeRect(U(spec.zR - 0.55), V(0.88), w * 0.025, h * 0.1);
    // dirt: lower body + arch dust
    g = ctx.createLinearGradient(0, V(0.55), 0, V(0.2)); g.addColorStop(0, 'rgba(90,76,60,0)'); g.addColorStop(1, 'rgba(90,76,60,0.38)'); ctx.fillStyle = g; ctx.fillRect(0, V(0.55), w, V(0.2) - V(0.55));
    speckle(ctx, w, h, { count: 400, colors: ['#554', '#222', '#887'], alpha: [0.03, 0.12], size: [1, 3], seed: kind.length });
    if (livery === 'police') {
      // black/white livery: black lower doors? classic: white body with blue/black stripe + POLICE text
      ctx.fillStyle = 'rgba(20,40,110,0.95)'; ctx.fillRect(U(dR) - 10, V(0.78), U(dF) - U(dR) + 20, h * 0.06); ctx.fillStyle = 'rgba(210,30,40,0.95)'; ctx.fillRect(U(dR) - 10, V(0.78) + h * 0.07, U(dF) - U(dR) + 20, h * 0.015);
      ctx.fillStyle = 'rgba(20,40,110,0.95)'; ctx.font = `900 ${h * 0.16}px "Liberation Sans", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('POLICE', U((dF + dR) / 2 - 0.2), V(0.62));
      ctx.font = `bold ${h * 0.06}px "Liberation Sans", Arial, sans-serif`; ctx.fillText('PNP  -  TO PROTECT AND SERVE', U((dF + dR) / 2 - 0.2), V(0.52));
    } else if (livery === 'taxi') {
      ctx.fillStyle = '#111'; const n = 14, y0 = V(0.8); for (let i = 0; i < n * 2; i++) { ctx.fillRect(U(dR) + (i * (U(dF) - U(dR)) / (n * 2)), y0 + (i % 2) * h * 0.035, (U(dF) - U(dR)) / (n * 2), h * 0.035); }
      ctx.font = `900 ${h * 0.14}px "Liberation Sans", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('TAXI', U((dF + dR) / 2 - 0.1), V(0.6)); ctx.font = `bold ${h * 0.05}px "Liberation Sans", Arial, sans-serif`; ctx.fillText('METERED  -  24 HRS', U((dF + dR) / 2 - 0.1), V(0.5));
    } else if (livery === 'ambulance') {
      ctx.fillStyle = '#d6222a'; ctx.fillRect(0, V(0.62), w, h * 0.07); ctx.fillStyle = '#e8801c'; ctx.fillRect(0, V(0.62) + h * 0.085, w, h * 0.02);
    }
  }, { wrap: 'clamp', aniso: 8 }));
}

// ───────────────────────────── shared small builders ─────────────────────────────
/** z of the end surface at lateral position x (bisect on the loft's analytic surface). end=+1 front / -1 rear */
function surfZ(ts, x, y, zEnd, end) {
  let a = zEnd - end * 0.7, b = zEnd; // a inside (wide), b at tip (narrow)
  for (let i = 0; i < 22; i++) { const m = (a + b) / 2; const xm = ts.xAt(m, y); if (xm === null || xm < x) b = m; else a = m; }
  return (a + b) / 2;
}
function surfYaw(ts, z, y, end) { const dz = 0.03 * end; const x0 = ts.xAt(z - dz, y) ?? 0, x1 = ts.xAt(z + dz, y) ?? 0; return Math.atan2(-(x1 - x0), dz * 2 * end); }
/** A strip hugging the nose/tail surface between lateral positions x0..x1 (|x|), centred at height yc with height h. end=+1 front / -1 rear. Both sides built via mirror by the caller. */
function surfStrip(ts, x0, x1, yc, h, zEnd, end, off = 0.004, n = 8, rows = 3) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const y = yc - h / 2 + (h * j) / rows;
    for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); const z = surfZ(ts, x, y, zEnd, end) + end * off; pos.push(x, y, z); uv.push(i / n, j / rows); }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; if (end > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function headlight(P, ts, zEnd, { x0 = 0.3, x1 = 0.8, yc = 0.8, h = 0.12, hi = true } = {}) {
  const n = hi ? 8 : 4;
  for (const sx of [1, -1]) {
    const mir = sx < 0 ? { mirrorX: true } : {};
    P.add('black', surfStrip(ts, x0 - 0.012, x1 + 0.012, yc, h + 0.024, zEnd, 1, 0.003, n), { ...mir });
    P.add('lampHead', surfStrip(ts, x0, x1, yc, h, zEnd, 1, 0.007, n), { ...mir });
    if (hi) P.add('chrome', surfStrip(ts, x0 + 0.02, x0 + 0.13, yc - h * 0.05, h * 0.55, zEnd, 1, 0.009, 3), { ...mir });
    P.add('lens', surfStrip(ts, x0, x1, yc, h, zEnd, 1, 0.012, n), { ...mir });
  }
}
function taillight(P, ts, zEnd, { x0 = 0.3, x1 = 0.8, yc = 0.9, h = 0.11, hi = true } = {}) {
  const n = hi ? 8 : 4;
  for (const sx of [1, -1]) {
    const mir = sx < 0 ? { mirrorX: true } : {};
    P.add('black', surfStrip(ts, x0 - 0.012, x1 + 0.012, yc, h + 0.024, zEnd, -1, 0.003, n), { ...mir });
    P.add('lampTail', surfStrip(ts, x0, x1 - (x1 - x0) * 0.28, yc, h, zEnd, -1, 0.007, n), { ...mir });
    P.add('lampAmber', surfStrip(ts, x1 - (x1 - x0) * 0.26, x1, yc, h, zEnd, -1, 0.007, 3), { ...mir });
    if (hi) P.add('lens2', surfStrip(ts, x0, x1 - (x1 - x0) * 0.27, yc, h, zEnd, -1, 0.012, n), { ...mir });
  }
}
function wheelArches(P, spec, tub, wheelPos) {
  const arches = wheelPos.map(([z, y]) => [z, y, spec.wr + 0.075]);
  for (const [z, y] of wheelPos) for (const sx of [1, -1]) {
    const ra = spec.wr + 0.075; const x = (tub.userData.surf.xAt(z, y + ra * 0.7) ?? spec.hw);
    P.add('liner', new THREE.CylinderGeometry(ra - 0.004, ra - 0.004, 0.5, 22, 1, true, Math.PI / 2 - 1.62, 3.24), { pos: [sx * (x - 0.27), y, z], rot: [0, 0, Math.PI / 2] });
    P.add('black', tor(ra + 0.004, 0.013, 5, 28, Math.PI).rotateY(Math.PI / 2), { pos: [sx * (x + 0.002), y, z] });
  }
  return arches;
}
function seatShape(P, x, y, z, { w = 0.46, back = 0.52, yaw = 0, head = true } = {}) {
  P.add('int', rbox(w, 0.14, 0.5, 0.04, 1), { pos: [x, y, z] });
  P.add('int', rbox(w, back, 0.12, 0.05, 1), { pos: [x, y + back / 2 + 0.05, z - 0.25], rot: [-0.18, 0, 0] });
  if (head) P.add('int', rbox(0.26, 0.15, 0.09, 0.04, 1), { pos: [x, y + back + 0.07, z - 0.285], rot: [-0.18, 0, 0] });
}

/** window openings (side polygons, windshield, rear) for the paint cab shell, derived from the cabin profile */
function makeWindowCfg(spec) {
  const C = spec.cab, top = pw(C.top), W = spec.win; const yb = C.yb, bm = W.bm ?? 0.05, m = W.m ?? 0.095;
  const poly = (zb0, zt0, zt1, zb1) => { // front-bottom, front-top, rear-top, rear-bottom (z); top edge sampled along the roofline
    const pts = [[zb0, yb + bm]]; const n = 6; for (let i = 0; i <= n; i++) { const z = lerp(zt0, zt1, i / n); pts.push([z, top(z) - m]); } pts.push([zb1, yb + bm]); return pts;
  };
  const side = [];
  const bz = W.bpillar; const hasB = bz !== undefined;
  side.push(poly(W.front[0], W.front[1], hasB ? bz + 0.05 : W.rear[1], hasB ? bz + 0.05 : W.rear[0]));
  if (hasB) side.push(poly(bz - 0.05, bz - 0.05, W.rear[1], W.rear[0]));
  if (W.extra) for (const e of W.extra) side.push(poly(...e));
  const wt = pw(C.wt);
  const ws = { z0: spec.roof[1] + 0.02, z1: C.z1 - 0.025, x0: wt(spec.roof[1] + 0.02) - 0.13, x1: wt(C.z1 - 0.025) - 0.07 };
  const rear = { z0: C.z0 + 0.03, z1: spec.roof[0] - 0.02, x0: wt(C.z0 + 0.03) - 0.07, x1: wt(spec.roof[0] - 0.02) - 0.14 };
  return { side, xMin: 0.22, ws, rear: W.noRear ? undefined : rear };
}

function carGeometry(kind, lod) {
  return cached(`car:geo:${kind}:${lod}:${Q.detail}`, () => {
    const spec = SPEC[kind]; const hiq = lod > 0; const P = new Parts(); const info = { spec };
    const tw = pw(spec.tubW), tb = pw(spec.tubB), tt = pw(spec.tubT);
    const tub = loftZ({ z0: -spec.L / 2, z1: spec.L / 2, n: hiq ? 46 : 24, w: (z) => tw(z) * 0.9, wt: tw, yb: tb, yt: tt, p: spec.p ?? 4.2, round: [spec.roundB, spec.roundF], roundQ: 3.4, roundY: 0.04, radial: hiq ? 34 : 16, uvY: [0.2, 1.3] });
    tub.userData.ymin = 0.2; tub.userData.ymax = 1.3;
    const C = spec.cab; const cwb = pw(C.wb), cwt = pw(C.wt), ctop = pw(C.top);
    const cabSpec = (inset) => ({ z0: C.z0 + inset, z1: C.z1 - inset, n: hiq ? 36 : 20, w: (z) => cwb(z) - inset, wt: (z) => cwt(z) - inset, yb: C.yb - 0.01, yt: (z) => ctop(z) - inset, p: C.p, radial: hiq ? 28 : 14, round: [0, 0], uvY: [0.2, 1.3] });
    const cabShell = loftZ(cabSpec(0)); const cabGlass = loftZ(cabSpec(0.014));
    P.add('paint', tub); P.add('paintCab', cabShell); P.add('glass', cabGlass);
    const wheels = [[spec.zF, spec.wr], [spec.zR, spec.wr]]; info.arches = wheelArches(P, spec, tub, wheels);
    info.windows = makeWindowCfg(spec);
    // chrome window-bottom strip along both sides (follows the shell)
    const cs = cabShell.userData.surf; const zA = spec.doors[0] + 0.02, zB = spec.doors[2] - 0.05; const nS = 10;
    for (const sx of [1, -1]) for (let i = 0; i < nS; i++) { const z0 = lerp(zA, zB, i / nS), z1 = lerp(zA, zB, (i + 1) / nS); const y = C.yb + 0.035; P.add('chrome', between([sx * ((cs.xAt(z0, y) ?? 0.75) + 0.003), y, z0], [sx * ((cs.xAt(z1, y) ?? 0.75) + 0.003), y, z1], 0.009, 0.009, 4)); }
    // front & rear fascia
    const zf = spec.L / 2, zb = -spec.L / 2; const ts = tub.userData.surf;
    const fTop = tt(zf - 0.1), hwF2 = ts.xAt(zf - 0.06, 0.45) ?? 0.7, hwB2 = ts.xAt(zb + 0.06, 0.45) ?? 0.7;
    P.add('black', rbox(0.9, 0.1, 0.05, 0.03, 1), { pos: [0, 0.33, zf - 0.005] }); P.add('black', rbox(0.9, 0.1, 0.05, 0.03, 1), { pos: [0, 0.33, zb + 0.005] });
    P.add('black', rbox(0.88, 0.15, 0.04, 0.04, 1), { pos: [0, 0.46, zf - 0.005] }); // lower intake
    P.add('black', rbox(0.74, 0.1, 0.04, 0.03, 1), { pos: [0, fTop - 0.09, zf - 0.005] }); // grille
    P.add('chrome', rbox(0.78, 0.014, 0.04, 0.006, 1), { pos: [0, fTop - 0.03, zf - 0.005] }); P.add('chrome', rbox(0.78, 0.012, 0.04, 0.006, 1), { pos: [0, fTop - 0.15, zf - 0.005] });
    if (hiq) for (let i = -4; i <= 4; i++) P.add('chrome', rbox(0.012, 0.09, 0.03, 0.004, 1), { pos: [i * 0.085, fTop - 0.09, zf + 0.003] });
    P.add('chrome', cyl(0.04, 0.04, 0.012, 14), { pos: [0, fTop - 0.09, zf + 0.012], rot: [Math.PI / 2, 0, 0] });
    P.add('chrome', rbox(0.7, 0.025, 0.03, 0.01, 1), { pos: [0, tt(zb + 0.12) - 0.1, zb + 0.005] });
    headlight(P, ts, zf, { x0: spec.hl.x0, x1: spec.hl.x1, yc: spec.hl.yc, h: spec.hl.h, hi: hiq });
    taillight(P, ts, zb, { x0: spec.tl.x0, x1: spec.tl.x1, yc: spec.tl.yc, h: spec.tl.h, hi: hiq });
    P.add('lampAmber', surfStrip(ts, 0.55, 0.7, 0.58, 0.04, zf, 1, 0.006, 3)); P.add('lampAmber', surfStrip(ts, 0.55, 0.7, 0.58, 0.04, zf, 1, 0.006, 3), { mirrorX: true });
    P.add('plateF', plane(0.52, 0.12), { pos: [0, 0.455, zf + 0.018] }); P.add('plateR', plane(0.52, 0.12).rotateY(Math.PI), { pos: [0, 0.66, zb - 0.004] });
    // mirrors
    for (const sx of [1, -1]) { const mz = C.z1 - 0.24, my = C.yb + 0.03; const mx = cwb(mz); P.add('paintCab', rbox(0.1, 0.1, 0.18, 0.04, 1), { pos: [sx * (mx + 0.14), my + 0.04, mz], rot: [0, -sx * 0.1, 0] }); P.add('black', between([sx * (mx - 0.02), my - 0.02, mz + 0.03], [sx * (mx + 0.1), my + 0.03, mz], 0.014, 0.014, 5)); P.add('glass2', plane(0.085, 0.085), { pos: [sx * (mx + 0.14), my + 0.04, mz - 0.092], rot: [0, Math.PI - sx * 0.1, 0] }); }
    if (hiq) {
      for (const sx of [1, -1]) {
        for (const z of [spec.doors[1] + 0.32, spec.doors[2] + 0.32]) { const y = 0.9; const x = ts.xAt(z, y) ?? spec.hw; P.add('chrome', rbox(0.016, 0.026, 0.12, 0.008, 1), { pos: [sx * (x + 0.005), y, z] }); }
        const sy = 0.27; const xs = ts.xAt(0, sy) ?? spec.hw; P.add('black', rbox(0.04, 0.06, spec.doors[0] - spec.doors[2] + 0.1, 0.02, 1), { pos: [sx * (xs - 0.012), sy, (spec.doors[0] + spec.doors[2]) / 2] });
        P.add('black', between([sx * 0.05, C.yb + 0.005, C.z1 - 0.03], [sx * 0.62, C.yb + 0.005 + 0.07, C.z1 - 0.13], 0.005, 0.005, 4));
      }
      P.add('chrome', cyl(0.025, 0.025, 0.1, 10), { pos: [0.55, 0.3, zb - 0.02], rot: [Math.PI / 2, 0, 0] });
      P.add('black', cyl(0.004, 0.004, 0.32, 5), { pos: [0.7, ctop(spec.roof[0]) + 0.17, spec.roof[0] - 0.05] });
    }
    // interior (visible through the glass)
    const sy = 0.54; P.add('int', rbox(1.6, 0.1, 0.9, 0.04, 1), { pos: [0, 0.5, spec.seats[0] - 0.25] });
    seatShape(P, -0.38, sy, spec.seats[0]); seatShape(P, 0.38, sy, spec.seats[0]);
    P.add('int', rbox(1.5, 0.3, 0.12, 0.04, 1), { pos: [0, 0.9, spec.seats[1] - 0.35] });
    seatShape(P, -0.4, sy, spec.seats[1]); seatShape(P, 0.4, sy, spec.seats[1]); seatShape(P, 0, sy - 0.01, spec.seats[1], { head: false, w: 0.4 });
    P.add('int', rbox(1.5, 0.22, 0.38, 0.06, 2), { pos: [0, 0.9, spec.dashZ], rot: [0.2, 0, 0] });
    P.add('int', rbox(1.0, 0.03, 1.3, 0.01, 1), { pos: [0, ctop(0) - 0.07, (spec.roof[0] + spec.roof[1]) / 2] });
    info.tub = tub;
    return { geos: P.geos(), info, spec, tub };
  });
}

function wheelPositions(spec) { return [[-spec.tx, spec.wr, spec.zF, -1, true], [spec.tx, spec.wr, spec.zF, 1, true], [-spec.tx, spec.wr, spec.zR, -1, false], [spec.tx, spec.wr, spec.zR, 1, false]]; }

function carMaterials(spec, kind, o) {
  const rng = o.rng; const paint = o.paintColor; const livery = o.livery;
  const decal = bodyDecal(kind, spec, o.geo.tub, livery);
  const dirt = o.dirt ?? 0.1;
  const body = mk.paint(paint, { metal: 0.6, rough: 0.26 + dirt * 0.3, clearcoat: 1 - dirt * 0.6, map: decal, arches: o.geo.info.arches, archX: 0.42 });
  const bodyCab = mk.paint(paint, { metal: 0.6, rough: 0.26 + dirt * 0.3, clearcoat: 1 - dirt * 0.6, windows: o.geo.info.windows });
  const m = {
    paint: body, paintCab: bodyCab, glass: mk.glass({ tint: o.glassTint ?? 0x14222a, opacity: 0.5 }), glass2: mk.glass({ tint: 0x9fb0b8, opacity: 0.85 }), chrome: mk.chrome(), black: mk.plastic(0x101113, { rough: 0.45 }), bumper: mk.paint(paint, { metal: 0.3, rough: 0.4, peel: false, clearcoat: 0.4 }),
    int: mk.flat(0x1a1a1c, { rough: 0.9 }), liner: mk.flat(0x08090a, { rough: 0.95, side: THREE.DoubleSide }), rubber: mk.rubber({ tread: true }), rim: mk.metal(o.rimColor ?? 0xb5bac2, { rough: 0.25, metal: 1 }), disc: mk.metal(0x3a3d42, { rough: 0.55 }),
    lampHead: mk.light(0xfff3d6, { on: 7, off: 0.05, base: 0xa9afb6 }), lampTail: mk.light(0xff1a12, { on: 4, off: 0.25, base: 0x7a1410 }), lampAmber: mk.light(0xffa020, { on: 2.5, off: 0.2, base: 0xb06a10 }), lens: mk.glass({ tint: 0xdde6ea, opacity: 0.2 }), lens2: mk.glass({ tint: 0xff4030, opacity: 0.25 }),
    plateF: mk.flat(0xffffff, { map: plateTex(o.plate, o.plateStyle), rough: 0.5, metal: 0.15 }), plateR: mk.flat(0xffffff, { map: plateTex(o.plate, o.plateStyle), rough: 0.5, metal: 0.15 }),
  };
  if (m.glass.userData) { /* keep */ }
  return m;
}

/** shared body for the standard cars */
function buildCar(kind, opts = {}) {
  const spec = SPEC[kind.base || kind]; const base = kind.base || kind; const rng = new RNG((opts.seed ?? 1) * 7919 + 3);
  const geo = carGeometry(base, 1);
  const paintColor = resolveCarPaint(opts.paint ?? opts.color, rng);
  const plateStyle = opts.plateStyle || (opts.country === 'us' ? 'us' : 'ph'); const plate = opts.plate || randPlate(rng, plateStyle);
  const mats = carMaterials(spec, base, { rng, paintColor, geo, livery: opts.livery, dirt: opts.dirt, plate, plateStyle, rimColor: opts.rimColor });
  const root = new THREE.Group(); root.name = kind.name || base; const chassis = new THREE.Group(); root.add(chassis);
  const keys = Object.keys(geo.geos); chassis.add(assemble(geo.geos, mats));
  const wg = wheelGeos({ r: spec.wr, w: spec.tw, rim: spec.rim, style: spec.wheel, detail: 1 });
  const wheels = wheelPositions(spec).map(([x, y, z, side, steer]) => addWheel(root, wg, mats, { x, y, z, r: spec.wr, side, steerable: steer }));
  const lights = [{ mat: mats.lampHead, role: 'head', flick: 1 }, { mat: mats.lampTail, role: 'tail' }, { mat: mats.lampAmber, role: 'signal' }];
  const sw = new THREE.Group(); { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 24), mats.black); sw.add(rim); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), mats.black); hub.rotation.x = Math.PI / 2; sw.add(hub); for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + Math.PI / 2; const sp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.014, 0.012), mats.black); sp.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0); sp.rotation.z = a; sw.add(sp); } }
  sw.position.set(-0.37, 1.02, spec.dashZ - 0.27); sw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.5, -0.87).normalize()); chassis.add(sw);
  const seatH = 0.42, floorY = 0.32;
  const seat = (x, z, yaw = 0) => ({ pos: [x, floorY, z], hip: [x, floorY + seatH, z], yaw, seatH });
  const anchors = {
    driverSeat: seat(-0.38, spec.seats[0] - 0.05), passengerSeats: [seat(0.38, spec.seats[0] - 0.05), seat(-0.4, spec.seats[1] - 0.05), seat(0, spec.seats[1] - 0.05), seat(0.4, spec.seats[1] - 0.05)],
    exitDoor: { pos: [-spec.hw - 0.5, 0, (spec.doors[0] + spec.doors[1]) / 2], yaw: Math.PI / 2 }, exitDoorR: { pos: [spec.hw + 0.5, 0, (spec.doors[0] + spec.doors[1]) / 2], yaw: -Math.PI / 2 },
    trunk: { pos: [0, 0.9, -spec.L / 2 - 0.4], yaw: Math.PI }, hood: { pos: [0, 1.0, spec.L / 2 - 0.9], yaw: 0 }, roof: { pos: [0, spec.cab.top[3][1] + 0.05, -0.3], yaw: 0 },
    steeringWheel: { pos: [-0.37, 1.02, spec.dashZ - 0.27], normal: [0, 0.5, -0.87], radius: 0.17 },
  };
  const api = makeVehicle({ kind: base, root, chassis, wheels, steeringWheel: sw, steerRatio: 3.5, lights, glass: [mats.glass, mats.glass2, mats.lens, mats.lens2], anchors, seed: opts.seed ?? 1, smokeAt: [0, 1.0, spec.L / 2 - 0.9], bounds: { length: spec.L, width: spec.hw * 2, height: spec.cab.top[3][1], wheelbase: spec.zF - spec.zR } });
  api.mats = mats; api.paintColor = paintColor; api.plate = plate;
  return { api, mats, spec, chassis, root, geo };
}

// ───────────────────────────── public: cars ─────────────────────────────
/** createCar(kind, opts) kind: sedan|hatch|suv|taxi|police|ambulance|van|pickup  opts: {seed, paint:'white'|0xrrggbb, plate, dirt, lights} */
export function createCar(kind = 'sedan', opts = {}) {
  const k = kind;
  let r;
  if (k === 'sedan' || k === 'hatch' || k === 'suv') r = buildCar(k, opts);
  else if (k === 'taxi') { r = buildCar({ base: 'sedan', name: 'taxi' }, { ...opts, paint: opts.paint ?? 'yellow', livery: 'taxi' }); addRoofSign(r, 'taxi'); }
  else if (k === 'police') { r = buildCar({ base: 'sedan', name: 'police' }, { ...opts, paint: opts.paint ?? 'police', livery: 'police', plateStyle: 'ph' }); addLightBar(r); }
  else if (k === 'ambulance' || k === 'van' || k === 'pickup') return createVanLike(k, opts);
  else r = buildCar('sedan', opts);
  const api = r.api; if (opts.damage) api.setDamage(opts.damage); if (opts.infection) api.setInfection(opts.infection); api.update(0, 0); return api;
}
function addRoofSign(r, text) {
  const { mats, spec, chassis } = r; const top = spec.cab.top[3][1];
  const tex = canvasTex(256, 64, (ctx, w, h) => { ctx.fillStyle = '#f4f0dc'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#111'; ctx.font = '900 44px "Liberation Sans", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 2); }, { wrap: 'clamp' }); tex.userData.shared = false;
  const m = infectable(new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.4 }));
  const mesh = new THREE.Mesh(rbox(0.5, 0.14, 0.2, 0.04, 2), m); mesh.position.set(0, top + 0.11, -0.2); chassis.add(mesh); mesh.castShadow = true;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), m); back.position.set(0, top + 0.11, -0.302); back.rotation.y = Math.PI; chassis.add(back);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), m); front.position.set(0, top + 0.11, -0.098); chassis.add(front);
}
function addLightBar(r) {
  const { mats, spec, chassis, api } = r; const top = spec.cab.top[3][1];
  const base = new THREE.Mesh(rbox(1.15, 0.05, 0.3, 0.02, 1), mats.black); base.position.set(0, top + 0.05, -0.3); chassis.add(base);
  const red = infectable(new THREE.MeshStandardMaterial({ color: 0x601010, emissive: 0xff1010, emissiveIntensity: 3, roughness: 0.2 })); red.userData.light = null;
  const blue = infectable(new THREE.MeshStandardMaterial({ color: 0x101060, emissive: 0x1a40ff, emissiveIntensity: 3, roughness: 0.2 }));
  const l1 = new THREE.Mesh(rbox(0.54, 0.09, 0.26, 0.04, 1), red); l1.position.set(0.29, top + 0.1, -0.3); const l2 = new THREE.Mesh(rbox(0.54, 0.09, 0.26, 0.04, 1), blue); l2.position.set(-0.29, top + 0.1, -0.3); chassis.add(l1, l2);
  api.setSiren = (on) => { api.state.siren = !!on; }; api.state.siren = false;
  const prevUpdate = api.update; api.update = (dt, t) => { prevUpdate(dt, t); const on = api.state.siren ? 1 : 0; const ph = Math.floor(t * 6) % 2; red.emissiveIntensity = 0.15 + (ph === 0 ? 6 : 0.3) * on; blue.emissiveIntensity = 0.15 + (ph === 1 ? 6 : 0.3) * on; };
}
// van / ambulance / pickup are in a second builder below (vanLike)
function createVanLike() { throw new Error('placeholder'); }
