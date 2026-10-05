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
    L: 4.85, hw: 0.97, wr: 0.385, tw: 0.265, rim: 0.23, wheel: 'alloy10', zF: 1.5, zR: -1.38, tx: 0.82, roundF: 0.4, roundB: 0.22,
    tubW: [[-2.425, 0.88], [-2.0, 0.955], [-1.2, 0.965], [1.2, 0.965], [2.0, 0.945], [2.425, 0.86]], tubB: [[-2.425, 0.4], [-2.0, 0.32], [-1.3, 0.3], [1.3, 0.3], [2.1, 0.32], [2.425, 0.36]],
    tubT: [[-2.425, 1.02], [-2.2, 1.12], [-1.4, 1.12], [0.9, 1.1], [1.1, 1.08], [2.0, 1.03], [2.425, 0.92]],
    cab: { z0: -2.32, z1: 1.0, yb: 1.1, top: [[-2.32, 1.12], [-2.29, 1.38], [-2.2, 1.64], [-2.05, 1.76], [-1.5, 1.8], [0.1, 1.8], [0.45, 1.74], [0.8, 1.42], [1.0, 1.12]], wb: [[-2.32, 0.88], [-2.0, 0.92], [0.6, 0.93], [1.0, 0.88]], wt: [[-2.32, 0.78], [-2.0, 0.84], [0.6, 0.85], [1.0, 0.7]], p: 4 },
    roof: [-2.1, 0.3], doors: [1.0, 0.15, -1.15], win: { front: [0.92, 0.55], rear: [-1.55, -1.4], bpillar: -0.5, extra: [[-1.6, -1.62, -2.0, -2.12]], m: 0.1 }, hl: { x0: 0.42, x1: 0.88, yc: 0.88, h: 0.12 }, tl: { x0: 0.6, x1: 0.94, yc: 1.0, h: 0.22 }, seats: [0.58, -0.4], dashZ: 0.8, tailKind: 'suv',
  },
  van: {
    L: 5.0, hw: 0.94, wr: 0.34, tw: 0.215, rim: 0.2, wheel: 'steel', zF: 1.58, zR: -1.4, tx: 0.8, roundF: 0.4, roundB: 0.2, p: 4.6,
    tubW: [[-2.5, 0.86], [-2.1, 0.93], [-1.2, 0.94], [1.4, 0.94], [2.1, 0.92], [2.5, 0.84]], tubB: [[-2.5, 0.4], [-2.0, 0.32], [-1.3, 0.28], [1.3, 0.28], [2.1, 0.3], [2.5, 0.34]],
    tubT: [[-2.5, 1.02], [-2.3, 1.1], [-1.0, 1.1], [1.1, 1.08], [1.5, 1.05], [2.0, 0.95], [2.5, 0.8]],
    cab: { z0: -2.46, z1: 1.55, yb: 1.08, top: [[-2.46, 1.1], [-2.44, 1.7], [-2.38, 2.0], [-2.2, 2.06], [0.2, 2.08], [0.8, 2.04], [1.2, 1.7], [1.55, 1.1]], wb: [[-2.46, 0.88], [-2.2, 0.9], [0.8, 0.91], [1.55, 0.86]], wt: [[-2.46, 0.84], [-2.2, 0.86], [0.8, 0.87], [1.55, 0.7]], p: 5 },
    roof: [-2.2, 0.8], doors: [1.5, 0.62, -0.85], win: { front: [1.38, 0.98], rear: [-1.95, -2.15], bpillar: 0.57, m: 0.12, bm: 0.09 }, hl: { x0: 0.38, x1: 0.82, yc: 0.78, h: 0.13 }, tl: { x0: 0.78, x1: 0.92, yc: 1.3, h: 0.4 }, seats: [0.95, 0.0], dashZ: 1.15, tailKind: 'van',
  },
  ambulance: {
    L: 5.3, hw: 0.97, wr: 0.34, tw: 0.215, rim: 0.2, wheel: 'steel', zF: 1.65, zR: -1.55, tx: 0.82, roundF: 0.4, roundB: 0.15, p: 5,
    tubW: [[-2.65, 0.9], [-2.2, 0.96], [-1.2, 0.97], [1.4, 0.97], [2.1, 0.95], [2.65, 0.86]], tubB: [[-2.65, 0.4], [-2.0, 0.32], [-1.3, 0.28], [1.3, 0.28], [2.1, 0.3], [2.65, 0.34]],
    tubT: [[-2.65, 1.05], [-2.4, 1.1], [-1.0, 1.1], [1.1, 1.08], [1.6, 1.05], [2.1, 0.95], [2.65, 0.8]],
    cab: { z0: -2.6, z1: 1.65, yb: 1.08, top: [[-2.6, 1.1], [-2.58, 2.2], [-2.5, 2.3], [-2.2, 2.34], [0.3, 2.34], [0.85, 2.3], [1.25, 1.75], [1.65, 1.1]], wb: [[-2.6, 0.92], [-2.2, 0.95], [0.8, 0.96], [1.65, 0.9]], wt: [[-2.6, 0.9], [-2.2, 0.92], [0.8, 0.93], [1.65, 0.7]], p: 6 },
    roof: [-2.2, 0.85], doors: [1.6, 0.7, 0.2], win: { front: [1.5, 1.05], rear: [0.9, 0.82], noRear: true, m: 0.12, bm: 0.09 }, hl: { x0: 0.4, x1: 0.86, yc: 0.78, h: 0.13 }, tl: { x0: 0.82, x1: 0.95, yc: 1.3, h: 0.5 }, seats: [1.05, 0.2], dashZ: 1.2, tailKind: 'van',
  },
  pickup: {
    L: 5.35, hw: 0.95, wr: 0.38, tw: 0.255, rim: 0.22, wheel: 'alloy5', zF: 1.62, zR: -1.55, tx: 0.81, roundF: 0.4, roundB: 0.12, p: 4.6, bed: -0.55,
    tubW: [[-2.675, 0.92], [-2.0, 0.95], [-1.2, 0.95], [1.3, 0.95], [2.1, 0.93], [2.675, 0.86]], tubB: [[-2.675, 0.42], [-2.0, 0.34], [-1.3, 0.32], [1.3, 0.32], [2.1, 0.34], [2.675, 0.4]],
    tubT: [[-2.675, 0.7], [-2.4, 0.72], [-0.6, 0.72], [-0.5, 1.1], [0.9, 1.1], [1.3, 1.08], [2.0, 1.02], [2.675, 0.9]],
    cab: { z0: -0.5, z1: 1.12, yb: 1.1, top: [[-0.5, 1.12], [-0.48, 1.5], [-0.4, 1.76], [-0.1, 1.84], [0.5, 1.82], [0.85, 1.72], [1.12, 1.12]], wb: [[-0.5, 0.9], [0.5, 0.91], [1.12, 0.88]], wt: [[-0.5, 0.78], [0.5, 0.8], [0.85, 0.74], [1.12, 0.62]], p: 4 },
    roof: [-0.35, 0.5], doors: [1.12, 0.5, -0.3], win: { front: [1.0, 0.62], rear: [-0.35, -0.38], bpillar: 0.28, m: 0.1 }, hl: { x0: 0.42, x1: 0.86, yc: 0.84, h: 0.13 }, tl: { x0: 0.8, x1: 0.94, yc: 0.62, h: 0.14, bedOnly: true }, seats: [0.55, -0.05], dashZ: 0.82, tailKind: 'pickup',
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
/** conforming side panel (both flanks) for text/livery decals. UV reads left->right on both flanks. */
function sideStrip(ts, z0, z1, y0, y1, side, off = 0.004, nx = 12, ny = 3) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) { const y = lerp(y0, y1, j / ny); for (let i = 0; i <= nx; i++) { const z = lerp(z0, z1, i / nx); const x = (ts.xAt(z, y) ?? 0.8) + off; pos.push(side * x, y, z); uv.push(side > 0 ? 1 - i / nx : i / nx, j / ny); } }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; if (side < 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function liveryTex(kind) {
  return cached('car:livery:' + kind, () => canvasTex(texRes(1024), texRes(256), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); const F = '"Liberation Sans", "DejaVu Sans", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (kind === 'taxi') { ctx.fillStyle = '#111'; const n = 28; for (let i = 0; i < n; i++) { ctx.fillRect(i * w / n, h * 0.05 + (i % 2) * h * 0.1, w / n, h * 0.1); ctx.fillRect(i * w / n, h * 0.15 + (i % 2) * h * 0.1 - 0, w / n, 0); } ctx.font = `900 ${h * 0.4}px ${F}`; ctx.fillText('TAXI', w * 0.5, h * 0.55); ctx.font = `bold ${h * 0.12}px ${F}`; ctx.fillText('METERED  •  24 HOURS  •  CALL 8-777', w * 0.5, h * 0.87); }
    else if (kind === 'police') { ctx.fillStyle = '#142a78'; ctx.fillRect(0, h * 0.34, w, h * 0.13); ctx.fillStyle = '#d4222c'; ctx.fillRect(0, h * 0.5, w, h * 0.04); ctx.fillStyle = '#142a78'; ctx.font = `900 ${h * 0.34}px ${F}`; ctx.fillText('POLICE', w * 0.5, h * 0.17); ctx.font = `bold ${h * 0.11}px ${F}`; ctx.fillStyle = '#fff'; ctx.fillText('PNP  -  TO SERVE AND PROTECT', w * 0.5, h * 0.405); ctx.fillStyle = '#142a78'; ctx.beginPath(); ctx.arc(w * 0.1, h * 0.75, h * 0.17, 0, TAU); ctx.fill(); ctx.fillStyle = '#e6c030'; ctx.beginPath(); ctx.arc(w * 0.1, h * 0.75, h * 0.12, 0, TAU); ctx.fill(); ctx.font = `bold ${h * 0.13}px ${F}`; ctx.fillStyle = '#142a78'; ctx.fillText('PNP', w * 0.5, h * 0.75); }
    else if (kind === 'ambulance') { ctx.fillStyle = '#d6222a'; ctx.fillRect(0, h * 0.5, w, h * 0.12); ctx.fillStyle = '#ee8a1c'; ctx.fillRect(0, h * 0.66, w, h * 0.03); ctx.fillStyle = '#d6222a'; ctx.font = `900 ${h * 0.28}px ${F}`; ctx.fillText('AMBULANCE', w * 0.5, h * 0.25); ctx.fillRect(w * 0.1 - h * 0.14, h * 0.8 - h * 0.04, h * 0.28, h * 0.08); ctx.fillRect(w * 0.1 - h * 0.04, h * 0.8 - h * 0.14, h * 0.08, h * 0.28); ctx.fillStyle = '#1a3a8a'; ctx.font = `bold ${h * 0.1}px ${F}`; ctx.fillText('EMERGENCY MEDICAL SERVICES  -  CALL 911', w * 0.55, h * 0.88); }
    else if (kind === 'fuel') { ctx.fillStyle = '#c8202a'; ctx.font = `900 ${h * 0.4}px ${F}`; ctx.fillText('PETRON', w * 0.5, h * 0.4); ctx.fillStyle = '#111'; ctx.font = `bold ${h * 0.14}px ${F}`; ctx.fillText('FLAMMABLE  -  DIESEL / UNLEADED', w * 0.5, h * 0.78); }
    else if (kind === 'box') { ctx.fillStyle = '#1a4aa8'; ctx.font = `900 ${h * 0.34}px ${F}`; ctx.fillText('FASTLINE', w * 0.4, h * 0.4); ctx.fillStyle = '#e8b020'; ctx.fillRect(0, h * 0.62, w, h * 0.08); ctx.fillStyle = '#111'; ctx.font = `bold ${h * 0.12}px ${F}`; ctx.fillText('NATIONWIDE DELIVERY - MANILA - CEBU - DAVAO', w * 0.5, h * 0.84); }
    else if (kind === 'bus') { ctx.fillStyle = '#fff'; ctx.font = `900 ${h * 0.36}px ${F}`; ctx.fillText('VICTORY LINER', w * 0.45, h * 0.5); ctx.fillStyle = '#ffd21f'; ctx.fillRect(0, h * 0.78, w, h * 0.07); }
    else if (kind === 'pickup') { ctx.fillStyle = '#111'; ctx.font = `900 ${h * 0.3}px ${F}`; ctx.fillText('4x4', w * 0.5, h * 0.5); }
  }, { wrap: 'clamp', aniso: 8 }));
}
function addSideDecals(r, kind, { z0, z1, y0, y1, off = 0.004 }) {
  const tex = liveryTex(kind); const m = infectable(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  const tsT = r.geo.tub.userData.surf, tsC = r.geo.info.cab.userData.surf; const ts = { xAt: (z, y) => { const a = tsT.xAt(z, y), b = tsC.xAt(z, y); return a === null ? b : b === null ? a : Math.max(a, b); } }; for (const sx of [1, -1]) { const mesh = new THREE.Mesh(sideStrip(ts, z0, z1, y0, y1, sx, off), m); mesh.name = 'decal'; r.chassis.add(mesh); }
  r.mats.decal = m; return m;
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
    const wheels = (spec.archZ || [spec.zF, spec.zR]).map((z) => [z, spec.wr]); info.arches = wheelArches(P, spec, tub, wheels);
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
    if (kind === 'pickup') {
      const bz0 = -2.675, bz1 = spec.bed - 0.05; const bl = bz1 - bz0, bc = (bz0 + bz1) / 2;
      for (const sx of [1, -1]) { P.add('paint', rbox(0.07, 0.36, bl, 0.025, 1), { pos: [sx * 0.9, 0.9, bc] }); P.add('chrome', rbox(0.09, 0.025, bl, 0.01, 1), { pos: [sx * 0.9, 1.085, bc] }); P.add('liner', rbox(0.5, 0.2, 0.62, 0.05, 1), { pos: [sx * 0.64, 0.82, spec.zR] }); }
      P.add('paint', rbox(1.8, 0.4, 0.06, 0.02, 1), { pos: [0, 0.9, bz0 + 0.03] }); P.add('chrome', rbox(1.78, 0.025, 0.08, 0.01, 1), { pos: [0, 1.1, bz0 + 0.03] }); P.add('black', rbox(0.2, 0.05, 0.03, 0.01, 1), { pos: [0, 1.0, bz0 - 0.005] });
      P.add('paint', rbox(1.8, 0.62, 0.08, 0.025, 1), { pos: [0, 1.0, bz1 + 0.04] }); P.add('liner', rbox(1.72, 0.03, bl, 0.01, 1), { pos: [0, 0.745, bc] }); for (let i = -4; i <= 4; i++) P.add('black', rbox(0.06, 0.02, bl - 0.1, 0.008, 1), { pos: [i * 0.19, 0.762, bc] });
      for (const sx of [1, -1]) P.add('lampTail', rbox(0.1, 0.22, 0.04, 0.02, 1), { pos: [sx * 0.86, 0.95, bz0 - 0.005] });
      P.add('chrome', rbox(1.9, 0.12, 0.1, 0.04, 1), { pos: [0, 0.4, bz0 - 0.03] }); P.add('chrome', cyl(0.025, 0.025, 0.1, 8), { pos: [0, 0.34, bz0 - 0.1], rot: [Math.PI / 2, 0, 0] });
    }
    info.tub = tub; info.cab = cabShell;
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
  else if (k === 'taxi') { r = buildCar({ base: 'sedan', name: 'taxi' }, { ...opts, paint: opts.paint ?? 'yellow', livery: 'taxi' }); addSideDecals(r, 'taxi', { z0: -1.15, z1: 1.05, y0: 0.44, y1: 0.88 }); addRoofSign(r, 'taxi'); }
  else if (k === 'police') { r = buildCar({ base: 'sedan', name: 'police' }, { ...opts, paint: opts.paint ?? 'police', livery: 'police', plateStyle: 'ph' }); addSideDecals(r, 'police', { z0: -1.3, z1: 1.05, y0: 0.3, y1: 0.92 }); addLightBar(r); }
  else if (k === 'van') r = buildCar('van', opts);
  else if (k === 'pickup') r = buildCar('pickup', opts);
  else if (k === 'ambulance') { r = buildCar('ambulance', { ...opts, paint: opts.paint ?? 'white', livery: 'ambulance' }); addSideDecals(r, 'ambulance', { z0: -2.45, z1: 0.35, y0: 0.5, y1: 1.65 }); addAmbulanceBits(r); }
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
function addAmbulanceBits(r) {
  const { mats, spec, chassis, api } = r; const top = spec.cab.top[3][1];
  const base = new THREE.Mesh(rbox(1.5, 0.07, 0.32, 0.03, 1), mats.black); base.position.set(0, top + 0.045, 0.45); chassis.add(base);
  const red = infectable(new THREE.MeshStandardMaterial({ color: 0x601010, emissive: 0xff1010, emissiveIntensity: 3, roughness: 0.2 })), blue = infectable(new THREE.MeshStandardMaterial({ color: 0x101060, emissive: 0x1a40ff, emissiveIntensity: 3, roughness: 0.2 }));
  const l1 = new THREE.Mesh(rbox(0.72, 0.1, 0.28, 0.04, 1), red); l1.position.set(0.38, top + 0.11, 0.45); const l2 = new THREE.Mesh(rbox(0.72, 0.1, 0.28, 0.04, 1), blue); l2.position.set(-0.38, top + 0.11, 0.45); chassis.add(l1, l2);
  api.state.siren = false; api.setSiren = (on) => { api.state.siren = !!on; };
  const prev = api.update; api.update = (dt, t) => { prev(dt, t); const on = api.state.siren ? 1 : 0; const ph = Math.floor(t * 6) % 2; red.emissiveIntensity = 0.15 + (ph === 0 ? 6 : 0.3) * on; blue.emissiveIntensity = 0.15 + (ph === 1 ? 6 : 0.3) * on; };
  // rear doors lines + red cross on the back
  const tex = canvasTex(128, 128, (ctx, w, h) => { ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#d6222a'; ctx.fillRect(w * 0.38, h * 0.12, w * 0.24, h * 0.76); ctx.fillRect(w * 0.12, h * 0.38, w * 0.76, h * 0.24); }, { wrap: 'clamp' }); tex.userData.shared = false;
  const cm = infectable(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  const c1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), cm); c1.position.set(0, 1.45, -spec.L / 2 - 0.004); c1.rotation.y = Math.PI; chassis.add(c1);
  for (const sx of [1, -1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), cm); c.position.set(sx * (spec.hw + 0.006), 1.55, -1.3); c.rotation.y = sx * Math.PI / 2; chassis.add(c); }
}

export const _civ = { SPEC, carGeometry, buildCar, makeWindowCfg, surfStrip, surfZ, sideStrip, liveryTex, addSideDecals, headlight, taillight, wheelArches, seatShape, bodyDecal, carMaterials, wheelPositions, addLightBar, addRoofSign };
