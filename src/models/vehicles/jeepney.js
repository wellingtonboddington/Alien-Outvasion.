// Philippine jeepney — hero vehicle. Z+ is the front. Left side (x<0) holds the driver.
import {
  THREE, RNG, clamp, lerp, damp, smoothstep, TAU, Q, GLOBAL, cached, mk, TX, Parts, assemble, box, rbox, cyl, cylX, cylZ, sph, ell, tor, plane, between, boxBetween,
  sideSlab, lath, projUV, pw, loftZ, wheelGeos, addWheel, makeVehicle, plateTex, randPlate, norm, xf, disposeTree, infectable, mergeGeometries,
} from './kit.js';
import { tube } from '../../engine/geo.js';
import { JEEPNEY_PALETTES, JEEPNEY_NAMES, JEEPNEY_ROUTES, resolvePalette, jeepneyArt } from './jeepney_art.js';

export { JEEPNEY_PALETTES, JEEPNEY_NAMES };
// ── dimensions (m) ──
const FLOOR = 0.66, CABF = 0.56, SEATH = 0.40, SILL = 1.22, WINTOP = 1.82, HEADY = 1.96, HW = 0.97, WR = 0.385;
const ZF = 3.0, ZR = -3.16, ZFA = 2.05, ZRA = -1.30, ZCOWL = 1.28, ZB = 0.04;
const PANEL_Y0 = 0.55, PANEL_Y1 = SILL, PANEL_Z0 = -3.13, PANEL_Z1 = 1.18;
const grimeUV = (g) => projUV(g, 'x', { a0: ZR, a1: ZF, b0: 0, b1: 2.4 });

// cast-chrome ornaments: a rearing horse built from tapered limbs (3D, ~1k tris) and a spread-wing eagle
function horseGeo(h = 0.27) {
  const s = h / 0.30; const list = []; const A = (g) => { list.push(norm(g)); return g; };
  const P = (z, y, x = 0) => [x * s, y * s, z * s];
  const rod = (a, b, r0, r1) => A(between(a, b, r0 * s, r1 * s, 6));
  const ball = (p, r, sy = 1) => A(sph(r * s, 8, 6).scale(1, sy, 1).translate(p[0], p[1], p[2]));
  const chain = (pts, rs, x0 = 0) => { for (let i = 0; i < pts.length - 1; i++) { rod(P(pts[i][0], pts[i][1], x0), P(pts[i + 1][0], pts[i + 1][1], x0), rs[i], rs[i + 1]); ball(P(pts[i + 1][0], pts[i + 1][1], x0), rs[i + 1] * 1.05); } };
  // torso (tilted ellipsoid), haunch, chest
  A(ell(0.036 * s, 0.036 * s, 0.075 * s, 10, 8).rotateX(-0.65).translate(0, 0.134 * s, 0.002 * s));
  ball(P(-0.04, 0.108), 0.04); ball(P(0.05, 0.168), 0.036);
  // neck (arched) via smooth tube, head, ears, mane
  const neck = [new THREE.Vector3(...P(0.045, 0.175)), new THREE.Vector3(...P(0.075, 0.215)), new THREE.Vector3(...P(0.083, 0.255)), new THREE.Vector3(...P(0.1, 0.285))];
  A(tube(neck, [0.03 * s, 0.024 * s, 0.019 * s, 0.015 * s], { radial: 6, segsPerPoint: 4 }));
  A(ell(0.0135 * s, 0.017 * s, 0.045 * s, 8, 6).rotateX(0.75).translate(...P(0.125, 0.278)));
  ball(P(0.15, 0.255), 0.011); ball(P(0.098, 0.292), 0.015);
  for (const sx of [-1, 1]) A(cyl(0.0, 0.006 * s, 0.026 * s, 5).translate(0, 0.013 * s, 0).rotateX(-0.2).translate(...P(0.092, 0.3, 0.009 * sx)));
  const mane = [new THREE.Vector3(...P(0.04, 0.2)), new THREE.Vector3(...P(0.055, 0.25)), new THREE.Vector3(...P(0.075, 0.292)), new THREE.Vector3(...P(0.094, 0.305))];
  A(tube(mane, [0.006 * s, 0.01 * s, 0.009 * s, 0.003 * s], { radial: 4, segsPerPoint: 3 }).scale(2.4, 1, 1));
  // legs: front pair raised, hind pair planted (x offset +-)
  chain([[0.052, 0.16], [0.075, 0.125], [0.12, 0.128], [0.14, 0.098]], [0.02, 0.016, 0.011, 0.009], 0.012);
  chain([[0.052, 0.16], [0.07, 0.108], [0.1, 0.092], [0.108, 0.058]], [0.02, 0.016, 0.011, 0.009], -0.012);
  chain([[-0.04, 0.105], [-0.012, 0.07], [-0.055, 0.04], [-0.05, 0.004]], [0.03, 0.02, 0.011, 0.01], 0.014);
  chain([[-0.04, 0.105], [-0.002, 0.075], [-0.03, 0.04], [-0.012, 0.004]], [0.03, 0.02, 0.011, 0.01], -0.014);
  for (const [z, x] of [[-0.05, 0.014], [-0.012, -0.014]]) A(box(0.014 * s, 0.006 * s, 0.026 * s).translate(x * s, 0.003 * s, (z + 0.006) * s));
  // tail
  const tail = [new THREE.Vector3(...P(-0.065, 0.13)), new THREE.Vector3(...P(-0.1, 0.12)), new THREE.Vector3(...P(-0.118, 0.08)), new THREE.Vector3(...P(-0.108, 0.035)), new THREE.Vector3(...P(-0.09, 0.012))];
  A(tube(tail, [0.012 * s, 0.014 * s, 0.012 * s, 0.008 * s, 0.002 * s], { radial: 5, segsPerPoint: 3 }).scale(1.6, 1, 1));
  const g = mergeGeometries(list, false); g.computeVertexNormals(); return g;
}
function eagleGeo(span = 0.34) {
  const k = span / 0.5; const list = []; const A = (g) => { list.push(norm(g)); return g; };
  const wing = [[0.02, 0.04], [0.1, 0.075], [0.19, 0.035], [0.255, -0.04], [0.245, -0.09], [0.215, -0.07], [0.205, -0.13], [0.17, -0.1], [0.155, -0.155], [0.125, -0.115], [0.1, -0.165], [0.075, -0.115], [0.045, -0.15], [0.02, -0.09]];
  { const sh = new THREE.Shape(wing.map((p) => new THREE.Vector2(p[0] * k, p[1] * k)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.01 * k, bevelEnabled: true, bevelThickness: 0.003 * k, bevelSize: 0.003 * k, bevelSegments: 1 });
    g.rotateX(-Math.PI / 2); g.rotateZ(-0.28); g.computeVertexNormals(); A(g); const g2 = norm(g.clone()); xf(g2, { mirrorX: true }); list.push(g2); }
  A(ell(0.03 * k, 0.03 * k, 0.1 * k, 8, 6).translate(0, 0, -0.02 * k)); A(sph(0.028 * k, 8, 6).translate(0, 0.012 * k, 0.085 * k));
  A(cyl(0.0, 0.012 * k, 0.04 * k, 5).rotateX(Math.PI / 2 + 0.3).translate(0, 0.005 * k, 0.13 * k));
  const tail = new THREE.Shape([[-0.03, 0], [0.03, 0], [0.06, -0.12], [0.03, -0.1], [0.0, -0.14], [-0.03, -0.1], [-0.06, -0.12]].map((p) => new THREE.Vector2(p[0] * k, p[1] * k)));
  A(new THREE.ExtrudeGeometry(tail, { depth: 0.008 * k, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0, -0.08 * k));
  const g = mergeGeometries(list, false); g.computeVertexNormals(); return g;
}
function roofShell(z0, z1, halfW, crown, yEdge, off = 0, rad = 28) {
  const R = (halfW * halfW + crown * crown) / (2 * crown); const half = Math.asin(halfW / R);
  const g = new THREE.CylinderGeometry(R + off, R + off, z1 - z0, rad, 1, true, Math.PI - half, half * 2);
  g.rotateX(Math.PI / 2); g.translate(0, yEdge + crown - R, (z0 + z1) / 2); return g;
}
const roofY = (x, halfW = 1.03, crown = 0.14, yEdge = HEADY + 0.015) => { const R = (halfW * halfW + crown * crown) / (2 * crown); return yEdge + crown - R + Math.sqrt(Math.max(0, R * R - x * x)); };

function bulbString(pts, colors, r = 0.011) {
  const list = []; const c = new THREE.Color();
  pts.forEach((p, i) => { const g = new THREE.SphereGeometry(r, 6, 4); g.translate(p[0], p[1], p[2]); c.set(colors[i % colors.length]); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { a[k * 3] = c.r * 3.2; a[k * 3 + 1] = c.g * 3.2; a[k * 3 + 2] = c.b * 3.2; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g); });
  const g = mergeGeometries(list, false); g.userData.shared = true; return g;
}

function buildGeometry(style) {
  return cached(`jeepney:geo:${style.ornament}:${style.rack}:${Q.detail}`, () => {
    const P = new Parts(); const add = (k, g, o) => P.add(k, g, o); const hi = Q.detail >= 1;
    const info = {};
    // ───────── chassis ─────────
    add('black', rbox(0.1, 0.18, 5.9, 0.02), { pos: [0.43, 0.47, -0.05], mirror: true });
    for (const z of [2.45, 1.4, 0.3, -0.7, -1.95, -2.9]) add('black', rbox(0.9, 0.1, 0.1, 0.015), { pos: [0, 0.46, z] });
    add('black', rbox(1.9, 0.12, 3.35, 0.02), { pos: [0, FLOOR - 0.1, -1.47] }); // underbody
    add('black', rbox(1.82, 0.12, 1.5, 0.02), { pos: [0, CABF - 0.09, 0.78] });
    // axles + diff + springs + shocks
    add('black', cylX(0.04, 0.04, 1.75, 10), { pos: [0, 0.385, ZFA] });
    add('black', cylX(0.05, 0.05, 1.7, 10), { pos: [0, 0.385, ZRA] });
    add('black', ell(0.2, 0.17, 0.17, 12, 8), { pos: [0, 0.385, ZRA] });
    add('black', cylZ(0.04, 0.04, 1.6, 8), { pos: [0, 0.42, -0.45] }); // drive shaft
    add('black', rbox(0.06, 0.035, 1.25, 0.012), { pos: [0.52, 0.5, ZFA], mirror: true });
    add('black', rbox(0.07, 0.04, 1.5, 0.012), { pos: [0.5, 0.52, ZRA], mirror: true });
    add('black', rbox(0.07, 0.04, 1.5, 0.012), { pos: [0.5, 0.56, ZRA], mirror: true });
    for (const [z, sx] of [[ZFA, 0.6], [ZRA, 0.5]]) add('chrome', between([sx, 0.4, z - 0.06], [sx - 0.04, 0.58, z - 0.1], 0.016, 0.016, 8), { mirror: true });
    add('black', cyl(0.14, 0.14, 0.55, 14).rotateZ(Math.PI / 2), { pos: [-0.52, 0.36, -1.95] }); // muffler
    add('black', rbox(0.7, 0.2, 0.34, 0.04), { pos: [0.5, 0.45, -0.25] }); // tank
    add('black', box(0.8, 0.5, 0.06), { pos: [0, 0.82, 2.57] }); // radiator
    // ───────── floor / interior shell ─────────
    add('floor', rbox(1.86, 0.06, 3.3, 0.01), { pos: [0, FLOOR - 0.03, -1.5] });
    add('floor', rbox(1.86, 0.06, 1.3, 0.01), { pos: [0, CABF - 0.03, 0.7] });
    add('body', rbox(1.9, 0.14, 0.05, 0.015), { pos: [0, 0.6, ZR + 0.02] }); // rear sill panel
    add('floor', rbox(1.1, 0.03, 0.26, 0.012), { pos: [0, 0.34, ZR - 0.1] }); // rear step plate
    add('chrome', rbox(1.12, 0.02, 0.03, 0.008), { pos: [0, 0.357, ZR - 0.22] });
    add('black', rbox(0.04, 0.3, 0.04, 0.01), { pos: [0.5, 0.5, ZR - 0.05], mirror: true });
    add('black', rbox(0.04, 0.04, 0.3, 0.01), { pos: [0.5, 0.34, ZR - 0.08], mirror: true });
    // ───────── side art panels (textured) ─────────
    const prof = [[PANEL_Z1, PANEL_Y0], [PANEL_Z1, PANEL_Y1], [PANEL_Z0, PANEL_Y1], [PANEL_Z0, PANEL_Y0]];
    const aPhi0 = Math.atan2(PANEL_Y0 - WR, -0.44), aPhi1 = Math.atan2(PANEL_Y0 - WR, 0.44);
    const arch = []; for (let i = 0; i <= 14; i++) { const a = lerp(aPhi0, aPhi1, i / 14); arch.push([ZRA + 0.47 * Math.cos(a), WR + 0.47 * Math.sin(a)]); }
    const profile = [[PANEL_Z1, PANEL_Y0], [PANEL_Z1, PANEL_Y1], [PANEL_Z0, PANEL_Y1], [PANEL_Z0, PANEL_Y0], ...arch];
    const slab = sideSlab(profile, 0.035, 0.004);
    const uvA = (flip) => (g) => projUV(g, 'x', { a0: PANEL_Z0, a1: PANEL_Z1, b0: PANEL_Y0, b1: PANEL_Y1, flipU: flip });
    add('artL', slab, { pos: [-HW + 0.0175, 0, 0], uv: uvA(false) });
    add('artR', slab, { pos: [HW - 0.0175, 0, 0], uv: uvA(true) });
    // wheel-arch trims (rear): half tori in the YZ plane + dark liner
    add('chrome', tor(0.475, 0.016, 6, 24, Math.PI).rotateY(Math.PI / 2), { pos: [HW + 0.004, WR, ZRA], mirror: true });
    add('liner', new THREE.CylinderGeometry(0.44, 0.44, 0.46, 22, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), { pos: [0.7, WR, ZRA], mirror: true });
    // sill rail + door-line chrome
    add('chrome', rbox(0.045, 0.03, 4.4, 0.012), { pos: [HW - 0.005, SILL + 0.012, (PANEL_Z0 + PANEL_Z1) / 2], mirror: true });
    add('chrome', rbox(0.04, 0.025, 4.34, 0.01), { pos: [HW - 0.002, PANEL_Y0 - 0.005, (PANEL_Z0 + PANEL_Z1) / 2], mirror: true });
    // ───────── hood + cowl + fenders ─────────
    const hood = loftZ({ z0: ZCOWL, z1: 2.62, n: 22, w: 0.58, yb: 0.64, yt: pw([[ZCOWL, 1.16], [1.95, 1.14], [2.62, 1.03]]), p: 5.2, round: [0, 0.1], radial: 28 });
    add('hoodArt', hood, { uv: (g) => projUV(g, 'y', { a0: -0.58, a1: 0.58, b0: 2.62, b1: ZCOWL }) });
    add('body', rbox(1.9, 0.58, 0.16, 0.04), { pos: [0, 0.93, ZCOWL - 0.04], uv: grimeUV });
    add('chrome', rbox(1.88, 0.03, 0.04, 0.01), { pos: [0, 1.225, ZCOWL + 0.04] });
    const fender = loftZ({ z0: 1.38, z1: 2.68, n: 22, w: 0.2, cx: 0.8, yb: 0.84, yt: pw([[1.38, 1.0], [1.8, 1.07], [2.3, 1.05], [2.68, 0.92]]), p: 3.0, round: [0, 0.22], radial: 22 });
    add('body', fender, { mirror: true, uv: grimeUV });
    add('black', box(0.34, 0.03, 1.15), { pos: [0.8, 0.825, 2.05], mirror: true });
    add('chrome', between([0.995, 0.97, 1.46], [0.99, 0.97, 2.55], 0.012, 0.012, 6), { mirror: true });
    // hood louvers + ridge trim
    const hs = hood.userData.surf;
    for (let i = 0; i < 5; i++) { const y = 0.8 + i * 0.06; const x = hs.xAt(1.75, y) ?? 0.57; add('chrome', rbox(0.014, 0.014, 0.34, 0.005), { pos: [x + 0.002, y, 1.75], mirror: true }); add('black', rbox(0.012, 0.03, 0.34, 0.004), { pos: [x - 0.001, y - 0.022, 1.75], mirror: true }); }
    add('chrome', rbox(0.035, 0.012, 1.3, 0.004), { pos: [0, hs.yTopAt(1.95, 0) + 0.003, 1.95] });
    add('chrome', rbox(0.05, 0.06, 0.012, 0.004), { pos: [0.0, 1.1, 2.62] });
    // ───────── grille + headlights + bumpers ─────────
    add('black', rbox(0.62, 0.52, 0.04, 0.02), { pos: [0, 0.86, 2.62] });
    for (let i = -7; i <= 7; i++) add('chrome', rbox(0.016, 0.46, 0.035, 0.006), { pos: [i * 0.038, 0.86, 2.645] });
    add('chrome', rbox(0.68, 0.04, 0.06, 0.015), { pos: [0, 1.11, 2.64] });
    add('chrome', rbox(0.68, 0.04, 0.06, 0.015), { pos: [0, 0.6, 2.64] });
    add('chrome', rbox(0.04, 0.55, 0.06, 0.015), { pos: [0.33, 0.86, 2.64], mirror: true });
    add('chrome', cylZ(0.055, 0.055, 0.02, 20), { pos: [0, 0.98, 2.675] });
    add('lampTail', cylZ(0.04, 0.04, 0.02, 16), { pos: [0, 0.98, 2.688] });
    for (const sx of [1, -1]) {
      add('chrome', cylZ(0.135, 0.12, 0.12, 24), { pos: [0.77 * sx, 0.935, 2.6] });
      add('chrome', tor(0.128, 0.014, 6, 28), { pos: [0.77 * sx, 0.935, 2.665] });
      add('chrome', lath([[0.115, 0.085], [0.09, 0.05], [0.06, 0.022], [0.03, 0.006], [0.0, 0.0]], 24).rotateX(Math.PI / 2), { pos: [0.77 * sx, 0.935, 2.585] });
      add('lampHead', sph(0.034, 10, 8), { pos: [0.77 * sx, 0.935, 2.625] });
      add('lens', sph(0.118, 22, 10).scale(1, 1, 0.42), { pos: [0.77 * sx, 0.935, 2.668] });
      // eyebrow
      add('chrome', tor(0.15, 0.011, 5, 16, Math.PI * 0.8).rotateZ(Math.PI * 0.1), { pos: [0.77 * sx, 0.935, 2.665] });
      // amber indicator + aux lamp
      add('lampAmber', sph(0.045, 10, 6).scale(1, 1, 0.6), { pos: [0.77 * sx, 0.78, 2.68] });
      add('lampHead', sph(0.055, 10, 8).scale(1, 1, 0.6), { pos: [0.5 * sx, 0.5, 2.98] });
      add('chrome', tor(0.06, 0.01, 5, 14), { pos: [0.5 * sx, 0.5, 2.985] });
    }
    // front bumper (heavy chrome) + guards + plate
    add('chrome', rbox(1.98, 0.13, 0.1, 0.045), { pos: [0, 0.46, 2.93] });
    add('chrome', rbox(0.1, 0.13, 0.45, 0.04), { pos: [0.94, 0.46, 2.72], mirror: true });
    add('chrome', rbox(1.5, 0.04, 0.06, 0.015), { pos: [0, 0.6, 2.9] });
    for (const sx of [0.36, -0.36]) { add('chrome', between([sx, 0.5, 2.96], [sx, 0.78, 2.9], 0.018, 0.018, 8)); add('chrome', between([sx, 0.78, 2.9], [sx * 0.9, 0.78, 2.7], 0.018, 0.018, 8)); }
    add('plateFront', plane(0.34, 0.17), { pos: [0, 0.455, 2.985] });
    // ───────── cab: windshield, pillars, roof, sign ─────────
    const wsTilt = -0.1;
    for (const sx of [-1, 1]) {
      add('glass', plane(0.85, 0.68), { pos: [0.445 * sx, 1.58, 1.245], rot: [wsTilt, 0, 0] });
      add('chrome', rbox(0.88, 0.028, 0.045, 0.01), { pos: [0.445 * sx, 1.235, 1.268], rot: [wsTilt, 0, 0] });
    }
    add('chrome', rbox(0.05, 0.72, 0.05, 0.012), { pos: [0, 1.58, 1.235], rot: [wsTilt, 0, 0] });
    add('body', rbox(0.07, 0.74, 0.08, 0.02), { pos: [0.915, 1.58, 1.235], rot: [wsTilt, 0, 0], mirror: true });
    add('body', rbox(1.9, 0.1, 0.09, 0.025), { pos: [0, 1.94, 1.21], rot: [wsTilt, 0, 0] });
    add('banner', plane(1.72, 0.16), { pos: [0, 1.82, 1.264], rot: [wsTilt, 0, 0] });
    for (const sx of [-1, 1]) { add('black', between([0.07 * sx, 1.27, 1.272], [0.5 * sx, 1.33, 1.262], 0.007, 0.007, 4)); add('black', between([0.22 * sx, 1.265, 1.274], [0.62 * sx, 1.46, 1.262], 0.005, 0.005, 4)); }
    // roof shell (+trim, stripes)
    const rz0 = -3.24, rz1 = 1.40;
    add('body', roofShell(rz0, rz1, 1.03, 0.14, HEADY + 0.015), { uv: (g) => projUV(g, 'y', { a0: -1, a1: 1, b0: rz0, b1: rz1, v0: 0.78, v1: 0.95 }) });
    add('trim', roofShell(rz0, rz1, 0.2, 0.14, HEADY + 0.015, 0.004), {});
    add('ceiling', roofShell(rz0 + 0.04, rz1 - 0.02, 1.0, 0.14, HEADY - 0.02, -0.0));
    for (const sx of [1, -1]) add('chrome', between([1.03 * sx, HEADY + 0.02, rz0], [1.03 * sx, HEADY + 0.02, rz1], 0.014, 0.014, 6));
    { const N = 16; for (let i = 0; i < N; i++) { const x0 = -1.03 + 2.06 * i / N, x1 = -1.03 + 2.06 * (i + 1) / N; add('chrome', between([x0, roofY(x0) + 0.004, rz1], [x1, roofY(x1) + 0.004, rz1], 0.014, 0.014, 6)); add('chrome', between([x0, roofY(x0) + 0.004, rz0], [x1, roofY(x1) + 0.004, rz0], 0.012, 0.012, 6)); } }
    // header beams + posts along both sides
    add('body', rbox(0.075, 0.14, 4.5, 0.025), { pos: [0.935, HEADY - 0.07, (rz1 - 0.1 + rz0 + 0.1) / 2], mirror: true, uv: grimeUV });
    add('chrome', rbox(0.03, 0.02, 4.4, 0.008), { pos: [0.955, WINTOP - 0.01, -0.93], mirror: true });
    for (const z of [ZB, -0.75, -1.55, -2.35, -3.09]) add('body', rbox(z === ZB || z === -3.09 ? 0.09 : 0.07, WINTOP - SILL + 0.04, z === ZB || z === -3.09 ? 0.1 : 0.07, 0.02), { pos: [0.935, (SILL + WINTOP) / 2 + 0.01, z], mirror: true, uv: grimeUV });
    for (const z of [-0.75, -1.55, -2.35]) add('chrome', rbox(0.012, WINTOP - SILL, 0.02, 0.005), { pos: [0.972, (SILL + WINTOP) / 2, z], mirror: true });
    add('body', rbox(0.1, WINTOP - SILL + 0.04, 0.09, 0.02), { pos: [0.935, (SILL + WINTOP) / 2 + 0.01, 1.14], mirror: true });
    // cab side windows
    for (const sx of [-1, 1]) {
      add('glass', plane(1.0, WINTOP - SILL - 0.06).rotateY(sx * Math.PI / 2), { pos: [0.945 * sx, (SILL + WINTOP) / 2 + 0.01, 0.6] });
      add('chrome', rbox(0.02, 0.025, 1.04, 0.008), { pos: [0.95 * sx, SILL + 0.045, 0.6] });
      add('chrome', rbox(0.02, 0.025, 1.04, 0.008), { pos: [0.95 * sx, WINTOP - 0.005, 0.6] });
      add('chrome', rbox(0.02, WINTOP - SILL - 0.04, 0.025, 0.008), { pos: [0.95 * sx, (SILL + WINTOP) / 2 + 0.01, 0.11] });
      add('chrome', rbox(0.02, WINTOP - SILL - 0.04, 0.025, 0.008), { pos: [0.95 * sx, (SILL + WINTOP) / 2 + 0.01, 1.1] });
      // door handle + lock
      add('chrome', rbox(0.03, 0.03, 0.14, 0.012), { pos: [(HW + 0.02) * sx, SILL - 0.1, 0.2] });
      add('black', rbox(0.025, 0.05, 0.05, 0.01), { pos: [(HW + 0.015) * sx, SILL - 0.07, 0.2] });
    }
    // front sign board (+ stays, marker lights)
    add('sign', box(1.84, 0.28, 0.05), { pos: [0, 2.12, 1.41], rot: [-0.14, 0, 0], uv: (g) => projUV(g, 'z', { a0: -0.92, a1: 0.92, b0: 1.98, b1: 2.26 }) });
    add('chrome', between([0.7, 1.98, 1.3], [0.7, 2.02, 1.4], 0.012, 0.012, 6), { mirror: true });
    add('chrome', rbox(1.88, 0.02, 0.06, 0.008), { pos: [0, 1.99, 1.43] });
    for (let i = -4; i <= 4; i++) add('lampAmber', sph(0.026, 8, 6), { pos: [i * 0.2, 2.275, 1.4] });
    add('lampTail', sph(0.03, 8, 6), { pos: [0.93, 2.12, 1.46], mirror: true });
    // chrome air horns on the roof
    for (const sx of [0.55, 0.33]) { add('chrome', cylZ(0.04, 0.012, 0.3, 12), { pos: [sx * 0.9, 2.2, 1.15] }); add('chrome', cylZ(0.04, 0.012, 0.3, 12), { pos: [-sx * 0.9, 2.2, 1.15] }); }
    // ornaments: horses + eagle
    if (style.ornament !== 'none') {
      const hg = horseGeo(0.27); add('chrome', hg, { pos: [0, hs.yTopAt(2.42, 0) - 0.005, 2.4] });
      add('chrome', rbox(0.1, 0.012, 0.3, 0.004), { pos: [0, hs.yTopAt(2.42, 0) - 0.002, 2.42] });
      const sm = horseGeo(0.15); add('chrome', sm, { pos: [0.8, 1.1, 2.3], rot: [0, 0.2, 0], mirror: true });
      if (style.ornament === 'both') add('chrome', eagleGeo(0.3), { pos: [0, 2.3, 1.44], rot: [-0.3, 0, 0] });
    }
    // mirrors (rectangular + convex round) on stalks
    for (const sx of [-1, 1]) {
      add('chrome', between([0.99 * sx, 1.42, 1.2], [1.17 * sx, 1.5, 1.3], 0.012, 0.012, 6));
      add('chrome', between([1.17 * sx, 1.5, 1.3], [1.21 * sx, 1.62, 1.28], 0.012, 0.012, 6));
      add('chrome', rbox(0.025, 0.25, 0.15, 0.01), { pos: [1.22 * sx, 1.55, 1.27] });
      add('black', rbox(0.02, 0.22, 0.12, 0.008), { pos: [1.205 * sx, 1.55, 1.27] });
      add('chrome', between([0.99 * sx, 1.84, 1.2], [1.24 * sx, 1.91, 1.26], 0.01, 0.01, 6));
      add('chrome', cyl(0.07, 0.07, 0.025, 16).rotateZ(Math.PI / 2), { pos: [1.25 * sx, 1.91, 1.26] });
      add('chrome', sph(0.07, 12, 6).scale(0.35, 1, 1), { pos: [1.265 * sx, 1.91, 1.26] });
    }
    // exhaust stacks (chrome), 4 pipes with clamps
    for (const [x, z, h] of [[1.0, -3.04, 2.2], [-1.0, -3.04, 2.2], [1.0, 0.0, 1.95], [-1.0, 0.0, 1.95]]) {
      add('chrome', cyl(0.036, 0.036, h - 0.4, 12), { pos: [x, 0.4 + (h - 0.4) / 2, z] });
      add('chrome', cyl(0.05, 0.034, 0.12, 12), { pos: [x, h + 0.04, z] });
      add('chrome', cyl(0.055, 0.055, 0.02, 12), { pos: [x, h + 0.105, z] });
      for (const y of [0.7, 1.2, 1.7]) add('chrome', tor(0.04, 0.008, 5, 12).rotateX(Math.PI / 2), { pos: [x, y, z] });
      add('black', cyl(0.036, 0.036, 0.25, 10), { pos: [x * 0.9, 0.5, z + (z < -1 ? 0.0 : 0)] });
    }
    // ───────── rear: header board, rails, lights, bumper, plate ─────────
    add('rearBoard', box(1.88, 0.2, 0.05), { pos: [0, 1.86, ZR + 0.01], uv: (g) => projUV(g, 'z', { a0: 0.94, a1: -0.94, b0: 1.76, b1: 1.96 }) });
    add('chrome', rbox(1.9, 0.025, 0.06, 0.01), { pos: [0, 1.75, ZR + 0.015] });
    add('chrome', rbox(1.98, 0.14, 0.1, 0.045), { pos: [0, 0.5, ZR - 0.04] });
    add('chrome', rbox(0.1, 0.14, 0.3, 0.04), { pos: [0.94, 0.5, ZR + 0.08], mirror: true });
    add('plateRear', plane(0.34, 0.17).rotateY(Math.PI), { pos: [0, 0.74, ZR - 0.03] });
    add('black', box(0.37, 0.2, 0.02), { pos: [0, 0.74, ZR - 0.022] });
    for (const sx of [-1, 1]) {
      add('lampTail', rbox(0.06, 0.2, 0.04, 0.015), { pos: [0.9 * sx, 0.9, ZR + 0.0] });
      add('lampAmber', rbox(0.06, 0.06, 0.04, 0.015), { pos: [0.9 * sx, 1.06, ZR + 0.0] });
      add('chrome', rbox(0.075, 0.015, 0.045, 0.006), { pos: [0.9 * sx, 0.79, ZR + 0.0] });
      // entry grab-rails (vertical chrome) and mud flaps
      add('chrome', cyl(0.018, 0.018, 1.24, 10), { pos: [0.74 * sx, FLOOR + 0.62, ZR + 0.12] });
      add('chrome', between([0.74 * sx, FLOOR + 1.22, ZR + 0.12], [0.5 * sx, WINTOP + 0.02, ZR + 0.0], 0.014, 0.014, 6));
      add('black', rbox(0.34, 0.4, 0.012, 0.004), { pos: [0.72 * sx, 0.3, -1.84] });
      add('chrome', rbox(0.2, 0.12, 0.014, 0.005), { pos: [0.72 * sx, 0.24, -1.846] });
      add('black', rbox(0.3, 0.3, 0.012, 0.004), { pos: [0.8 * sx, 0.32, 1.7] });
      add('chrome', rbox(0.14, 0.09, 0.014, 0.005), { pos: [0.8 * sx, 0.27, 1.708] });
    }
    // ───────── cab interior ─────────
    add('dash', rbox(1.82, 0.2, 0.32, 0.05), { pos: [0, 1.04, 1.08], uv: grimeUV });
    add('dash', rbox(1.7, 0.1, 0.24, 0.04), { pos: [0, 1.15, 1.1] });
    add('dash', rbox(0.5, 0.17, 0.2, 0.04), { pos: [-0.45, 1.19, 1.06] }); // instrument hood
    add('gauge', cyl(0.045, 0.045, 0.01, 18).rotateX(Math.PI / 2 - 0.5), { pos: [-0.5, 1.185, 0.962] });
    add('gauge', cyl(0.04, 0.04, 0.01, 18).rotateX(Math.PI / 2 - 0.5), { pos: [-0.39, 1.185, 0.962] });
    add('chrome', tor(0.047, 0.005, 5, 18).rotateX(-0.5), { pos: [-0.5, 1.187, 0.962] });
    add('chrome', tor(0.042, 0.005, 5, 18).rotateX(-0.5), { pos: [-0.39, 1.187, 0.962] });
    add('black', rbox(0.5, 0.015, 0.1, 0.005), { pos: [0.3, 1.205, 1.04] }); // glovebox lid line
    add('chrome', cyl(0.025, 0.02, 0.02, 10), { pos: [0.0, 1.213, 1.1] });
    add('dash', rbox(0.5, 0.5, 0.45, 0.06), { pos: [0, 0.8, 0.95] }); // engine tunnel
    add('chrome', between([-0.08, 0.85, 0.7], [-0.08, 1.12, 0.62], 0.012, 0.012, 6)); add('black', sph(0.032, 10, 8), { pos: [-0.08, 1.14, 0.615] });
    add('chrome', between([-0.2, 0.9, 0.62], [-0.22, 1.02, 0.75], 0.011, 0.011, 6)); // hand-brake
    // pedals
    add('black', rbox(0.07, 0.01, 0.1, 0.004), { pos: [-0.55, 0.7, 1.12], rot: [-0.6, 0, 0] });
    add('black', rbox(0.07, 0.01, 0.1, 0.004), { pos: [-0.44, 0.7, 1.12], rot: [-0.6, 0, 0] });
    add('black', rbox(0.1, 0.012, 0.08, 0.004), { pos: [-0.3, 0.72, 1.1], rot: [-0.4, 0, 0] });
    // cab bench seats (driver + 2 passengers) with backs
    for (const x of [-0.46, 0.2, 0.66]) {
      add('seat', rbox(0.44, 0.1, 0.48, 0.04), { pos: [x, CABF + SEATH - 0.05, 0.38] });
      add('seat', rbox(0.44, 0.52, 0.11, 0.045), { pos: [x, CABF + SEATH + 0.28, 0.1], rot: [-0.08, 0, 0] });
      add('seat', rbox(0.26, 0.14, 0.09, 0.04), { pos: [x, CABF + SEATH + 0.6, 0.085], rot: [-0.08, 0, 0] });
    }
    add('seatBase', rbox(1.7, SEATH - 0.09, 0.5, 0.02), { pos: [0.1, CABF + (SEATH - 0.09) / 2, 0.38] });
    // ceiling lamps + rails inside
    add('lampInt', cyl(0.07, 0.07, 0.02, 18), { pos: [0, HEADY - 0.03, 0.65] });
    for (const z of [-0.7, -1.7, -2.7]) { add('chrome', cyl(0.085, 0.085, 0.018, 18), { pos: [0, HEADY - 0.03, z] }); add('lampInt', cyl(0.07, 0.07, 0.012, 18), { pos: [0, HEADY - 0.042, z] }); }
    for (const sx of [0.4, -0.4]) {
      add('chrome', cylZ(0.016, 0.016, 3.0, 10), { pos: [sx, HEADY - 0.2, -1.5] });
      for (const z of [-0.2, -1.0, -1.8, -2.6]) add('chrome', between([sx, HEADY - 0.2, z], [sx * 1.05, HEADY, z], 0.012, 0.012, 6));
    }
    // ───────── passenger benches ─────────
    const benchZ0 = -0.16, benchZ1 = -2.98, benchLen = benchZ0 - benchZ1, benchC = (benchZ0 + benchZ1) / 2;
    for (const sx of [-1, 1]) {
      add('seatBase', rbox(0.5, SEATH - 0.08, benchLen, 0.02), { pos: [0.68 * sx, FLOOR + (SEATH - 0.08) / 2, benchC] });
      const n = 6, seatL = benchLen / n;
      for (let i = 0; i < n; i++) {
        const z = benchZ0 - seatL * (i + 0.5);
        add('seat', rbox(0.5, 0.09, seatL - 0.015, 0.04, 2), { pos: [0.68 * sx, FLOOR + SEATH - 0.045, z] });
        add('seat', rbox(0.1, 0.3, seatL - 0.02, 0.04, 2), { pos: [0.875 * sx, FLOOR + SEATH + 0.17, z], rot: [0, 0, -0.1 * sx] });
      }
      add('chrome', rbox(0.02, 0.03, benchLen, 0.008), { pos: [0.43 * sx, FLOOR + SEATH - 0.2, benchC] });
      add('black', rbox(0.035, 0.02, benchLen, 0.006), { pos: [0.425 * sx, FLOOR + 0.04, benchC] });
    }
    // roof rack
    if (style.rack) {
      const ry = roofY(0.0) + 0.18;
      for (const sx of [-1, 1]) {
        add('chrome', cylZ(0.016, 0.016, 3.3, 10), { pos: [0.8 * sx, ry, -1.5] });
        add('chrome', cylZ(0.012, 0.012, 3.3, 8), { pos: [0.8 * sx, ry - 0.1, -1.5] });
        for (const z of [-3.1, -2.1, -1.1, -0.1]) add('chrome', between([0.8 * sx, ry, z], [0.8 * sx, roofY(0.8) + 0.002, z], 0.014, 0.014, 6));
      }
      for (const z of [-3.15, -2.6, -2.05, -1.5, -0.95, -0.4, 0.05]) add('chrome', cylX(0.011, 0.011, 1.6, 8), { pos: [0, ry - 0.02, z] });
      add('chrome', cylX(0.016, 0.016, 1.6, 10), { pos: [0, ry, -3.15] }); add('chrome', cylX(0.016, 0.016, 1.6, 10), { pos: [0, ry, 0.05] });
      add('chrome', cylZ(0.009, 0.009, 3.3, 6), { pos: [0, ry - 0.02, -1.5] });
    }
    // string of tiny lights: roof edges inside + cab header + rear header
    const bp = []; for (let i = 0; i < 24; i++) bp.push([-0.9 + 1.8 * i / 23, 1.9, 1.2]);
    for (let i = 0; i < 40; i++) { const z = 0.0 - 3.1 * i / 39; bp.push([0.9, 1.88, z], [-0.9, 1.88, z]); }
    for (let i = 0; i < 22; i++) bp.push([-0.85 + 1.7 * i / 21, 1.73, ZR + 0.04]);
    info.bulbs = bulbString(bp, [0xffd070, 0xff4040, 0x50ff80, 0x5aa0ff, 0xffffff, 0xff70e0], 0.011);
    const geos = P.geos();
    return { geos, info };
  });
}

/**
 * createJeepney(opts) — opts: {seed=1, palette:'blessed'|...|[c0,c1,c2,c3]|{...}, name, route, plate, seatColor, ornament:'horse'|'both'|'none', rack=true,
 *   variant:'clean'|'worn'|'infected'|'wrecked', dirt:0..1, speed:0}
 */
export function createJeepney(opts = {}) {
  const seed = opts.seed ?? 1; const rng = new RNG(seed * 977 + 13);
  const pal = resolvePalette(opts.palette, rng);
  const name = (opts.name || rng.pick(JEEPNEY_NAMES)).toUpperCase(); const route = (opts.route || rng.pick(JEEPNEY_ROUTES)).toUpperCase();
  const variant = opts.variant || 'clean'; const dirt = opts.dirt ?? (variant === 'worn' ? 0.6 : variant === 'wrecked' ? 0.8 : 0.1);
  const art = jeepneyArt({ palette: pal, name, route, seed, short: name.length > 12 ? name.split(' ')[0] : name });
  const { geos, info } = buildGeometry({ ornament: opts.ornament || 'both', rack: opts.rack !== false });
  const plateTxt = opts.plate || randPlate(rng, 'ph');
  const dirtTint = new THREE.Color(0x6b5a45);
  const paintOpts = { metal: 0.4, rough: 0.34 + dirt * 0.25, clearcoat: 1 - dirt * 0.7, map: TX.grime() };
  const mats = {
    body: mk.paint(pal.body, paintOpts), trim: mk.paint(new THREE.Color(pal.accent).getHex(), { metal: 0.5, rough: 0.3 }),
    hoodArt: mk.paint(0xffffff, { map: art.hood, rough: 0.3 + dirt * 0.2 }), artL: mk.paint(0xffffff, { map: art.sideL, rough: 0.32 + dirt * 0.2, metal: 0.2, peel: false }), artR: mk.paint(0xffffff, { map: art.sideR, rough: 0.32 + dirt * 0.2, metal: 0.2, peel: false }),
    sign: mk.paint(0xffffff, { map: art.sign, rough: 0.5, clearcoat: 0.3, peel: false }), rearBoard: mk.paint(0xffffff, { map: art.rear, rough: 0.45, clearcoat: 0.4, peel: false }),
    chrome: mk.chrome(), liner: mk.flat(0x0b0c0e, { rough: 0.95, side: THREE.DoubleSide }), lens: mk.glass({ tint: 0xe8f0f4, opacity: 0.2 }), black: mk.metal(0x15171a, { rough: 0.62, metal: 0.5 }), glass: mk.glass({ tint: 0x1b2b32, opacity: 0.42 }),
    seat: mk.vinyl(opts.seatColor ?? rng.pick([0x7a1214, 0x141a22, 0x1d3f77, 0x5b2b0c]), { rough: 0.5 }), seatBase: mk.flat(0x282522, { rough: 0.8 }),
    floor: mk.flat(0x34363a, { rough: 0.75, metal: 0.4, normalMap: TX.diamond(), normalScale: 0.8 }), ceiling: mk.flat(0xe6dcc0, { rough: 0.9, side: THREE.DoubleSide }),
    dash: mk.plastic(0x1b1c1f, { rough: 0.55 }), rubber: mk.rubber({ tread: true }), rim: mk.chrome({ rough: 0.18 }), disc: mk.metal(0x333333, { rough: 0.5 }),
    lampHead: mk.light(0xfff0cc, { on: 7, off: 0.12 }), lampTail: mk.light(0xff1810, { on: 4.5, off: 0.35 }), lampAmber: mk.light(0xffa020, { on: 3, off: 0.25 }), lampInt: mk.light(0xfff0d0, { on: 3.2, off: 0.15 }), gauge: mk.light(0x5affc8, { on: 2, off: 0.6 }),
    plateFront: mk.flat(0xffffff, { map: plateTex(plateTxt, 'ph'), rough: 0.5, metal: 0.2 }), plateRear: mk.flat(0xffffff, { map: plateTex(plateTxt, 'ph'), rough: 0.5, metal: 0.2 }),
  };
  mats.banner = infectable(new THREE.MeshStandardMaterial({ map: art.banner, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mats.plateFront.userData.shared = false; mats.plateRear.userData.shared = false;
  if (dirt > 0.3) for (const k of ['body', 'trim']) mats[k].color.lerp(dirtTint, (dirt - 0.2) * 0.35);

  const root = new THREE.Group(); root.name = 'jeepney'; const chassis = new THREE.Group(); root.add(chassis);
  chassis.add(assemble(geos, mats));
  // string of lights (HDR vertex colours, twinkle in shader)
  const bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }); bulbMat.userData.shared = false;
  bulbMat.onBeforeCompile = (sh) => { sh.uniforms.uT = GLOBAL.time; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; varying float vTw;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTw = 0.55 + 0.45 * sin(uT * 3.0 + position.x * 21.0 + position.z * 13.0);'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTw;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTw;'); };
  bulbMat.customProgramCacheKey = () => 'jpBulb';
  const bulbs = new THREE.Mesh(info.bulbs, bulbMat); bulbs.name = 'bulbs'; chassis.add(bulbs);

  // curtains (cloth) tied back, one per open window
  const curtainMat = mk.cloth(new THREE.Color(pal.accent2).getHex(), { rough: 0.85 });
  for (const sx of [-1, 1]) for (const zc of [-0.35, -1.15, -1.95, -2.75]) {
    const g = new THREE.PlaneGeometry(0.2, WINTOP - SILL - 0.02, 10, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i); p.setZ(i, Math.sin(u * 60) * 0.012); const t = (p.getY(i) + 0.31) / 0.62; p.setX(i, u * (1 - 0.35 * (1 - t) * 0.6)); } g.computeVertexNormals(); g.rotateY(sx * Math.PI / 2);
    const m = new THREE.Mesh(g, curtainMat); m.position.set(0.915 * sx, (SILL + WINTOP) / 2 + 0.02, zc + 0.3); m.name = 'curtain'; chassis.add(m);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 12), mats.trim); tie.rotation.y = Math.PI / 2; tie.position.set(0.915 * sx, 1.42, zc + 0.3); chassis.add(tie);
  }
  // hanging ornaments (sway): rosary, fuzzy dice, cross, tassel fringe
  const swing = new THREE.Group(); swing.position.set(0, 1.78, 1.1); chassis.add(swing);
  const beadMat = mk.plastic(0xe9e2c8, { rough: 0.3 }); const goldMat = mk.metal(0xd2a640, { rough: 0.25, metal: 1 });
  { const pts = []; const N = 24; for (let i = 0; i <= N; i++) { const t = i / N; pts.push([Math.sin(t * Math.PI) * 0.045 * (t < 0.5 ? 1 : 1), -t * 0.2]); } const bg = []; pts.forEach((p, i) => { const s = new THREE.SphereGeometry(i % 5 === 0 ? 0.009 : 0.006, 6, 5); s.translate(p[0], p[1], 0); bg.push(s); }); const bm = new THREE.Mesh(mergeGeometries(bg), beadMat); swing.add(bm);
    const cross = new THREE.Group(); const cm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.008), goldMat); const cm2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.008), goldMat); cm2.position.y = 0.012; cross.add(cm, cm2); cross.position.set(0, -0.24, 0); swing.add(cross); }
  const dice = new THREE.Group(); dice.position.set(0.16, 0, 0); swing.add(dice); { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.14, 4), mats.black); cord.position.y = -0.07; dice.add(cord); const d1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), mk.cloth(0xf2f2f0, { rough: 0.7 })); d1.position.y = -0.17; d1.rotation.set(0.4, 0.5, 0.2); dice.add(d1); const d2 = d1.clone(); d2.position.set(0.0, -0.23, 0.02); d2.scale.setScalar(0.8); d2.rotation.set(0.1, 0.9, 0.5); dice.add(d2); }
  const fringe = new THREE.Group(); fringe.position.set(0, 1.88, 1.22); chassis.add(fringe); { const m = mk.cloth(new THREE.Color(pal.accent2).getHex(), { rough: 0.7 }); for (let i = 0; i < 32; i++) { const x = -0.85 + 1.7 * i / 31; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.1, 5), i % 2 ? m : mats.trim); t.position.set(x, -0.05, 0); fringe.add(t); } }

  // steering wheel (group whose local Z = column axis, pointing at the driver)
  const swheel = new THREE.Group(); const swPos = new THREE.Vector3(-0.46, 1.33, 0.86); swheel.position.copy(swPos); const swN = new THREE.Vector3(0, 0.55, -0.83).normalize(); swheel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), swN);
  { const rimM = mk.plastic(0x16171a, { rough: 0.5 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 8, 36), rimM); swheel.add(rim);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + Math.PI / 2; const s = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.016, 0.012), mats.chrome); s.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0); s.rotation.z = a; swheel.add(s); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.04, 14), mats.chrome); hub.rotation.x = Math.PI / 2; hub.position.z = 0.012; swheel.add(hub); }
  chassis.add(swheel);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 10), mats.dash); col.position.copy(swPos).addScaledVector(swN, 0.24).add(new THREE.Vector3(0, -0.2, 0.2).multiplyScalar(0)); col.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -0.45, 0.89).normalize()); col.position.set(-0.46, 1.17, 0.95); chassis.add(col);

  // wheels: single front, dual rear
  const wg = wheelGeos({ r: WR, w: 0.23, rim: 0.215, style: 'mag', detail: Q.detail >= 1 ? 1 : 0 });
  const wheels = [];
  for (const sx of [-1, 1]) {
    wheels.push(addWheel(root, wg, mats, { x: 0.83 * sx, y: WR, z: ZFA, r: WR, side: sx, steerable: true }));
    wheels.push(addWheel(root, wg, mats, { x: 0.6 * sx, y: WR, z: ZRA, r: WR, side: sx }));
    wheels.push(addWheel(root, wg, mats, { x: 0.84 * sx, y: WR, z: ZRA, r: WR, side: sx }));
  }
  // chassis lights list
  const lights = [{ mat: mats.lampHead, role: 'head', flick: 1 }, { mat: mats.lampTail, role: 'tail' }, { mat: mats.lampAmber, role: 'signal' }, { mat: mats.lampInt, role: 'interior' }, { mat: mats.gauge, role: 'interior' }];
  // anchors (local space). pos = floor point under the hips (feet side), hip = seat contact point, yaw faces the way the person looks
  const seatAt = (x, y, z, yaw, seatH) => ({ pos: [x, y, z], hip: [x, y + seatH, z], yaw, seatH });
  const passengerSeats = [seatAt(0.2, CABF, 0.38, 0, SEATH), seatAt(0.66, CABF, 0.38, 0, SEATH)];
  for (let i = 0; i < 6; i++) { const z = -0.16 - (2.82 / 6) * (i + 0.5); passengerSeats.push(seatAt(-0.66, FLOOR, z, Math.PI / 2, SEATH)); passengerSeats.push(seatAt(0.66, FLOOR, z, -Math.PI / 2, SEATH)); }
  const anchors = {
    driverSeat: seatAt(-0.46, CABF, 0.38, 0, SEATH),
    passengerSeats,
    exitDoor: { pos: [0, 0, ZR - 0.75], yaw: Math.PI, step: [0, 0.36, ZR - 0.18] },
    steeringWheel: { pos: [swPos.x, swPos.y, swPos.z], normal: [swN.x, swN.y, swN.z], radius: 0.2 },
    standRear: { pos: [0, FLOOR, -2.85], yaw: Math.PI },
    roof: { pos: [0, roofY(0) + 0.2, -1.5], yaw: 0 },
    hood: { pos: [0, 1.15, 1.95], yaw: 0 },
    headlights: { pos: [0, 0.94, 2.7] },
    muzzle: null,
  };
  const spr = { swayX: 0, swayZ: 0, vx: 0, vz: 0 };
  const api = makeVehicle({
    kind: 'jeepney', root, chassis, wheels, steeringWheel: swheel, steerRatio: 3.2, lights, glass: [mats.glass, mats.lens], anchors, seed, bobAmp: 1.15, smokeAt: [0, 1.3, 1.9],
    bounds: { length: 6.2, width: 2.0, height: 2.4, wheelbase: ZFA - ZRA },
    props: { name, route, palette: pal, plate: plateTxt },
    onUpdate(dt, t, S) {
      // damped pendulum for hanging items: driven by lateral/longitudinal accel + road bob
      const ax = clamp(-S.steerSm * S.v * 0.05, -1.2, 1.2), az = clamp(-S.accel * 0.05, -1, 1);
      const bobv = Math.sin(t * 7.3 + 1.1) * 0.02 * Math.min(1, Math.abs(S.v) / 6);
      spr.vx += (ax - spr.swayX) * 60 * dt - spr.vx * 5 * dt + bobv; spr.vz += (az - spr.swayZ) * 60 * dt - spr.vz * 5 * dt;
      spr.swayX += spr.vx * dt; spr.swayZ += spr.vz * dt;
      swing.rotation.z = spr.swayX * 0.5 + Math.sin(t * 1.7) * 0.01; swing.rotation.x = spr.swayZ * 0.5 + Math.sin(t * 1.3 + 2.0) * 0.01; dice.rotation.z = spr.swayX * 0.3; fringe.rotation.x = spr.swayZ * 0.15 + Math.sin(t * 2.0) * 0.01;
    },
    onDispose() { },
  });
  api.palette = pal; api.name = name; api.mats = mats;
  api.setSign = undefined;
  if (variant === 'infected') api.setInfection(1);
  if (variant === 'wrecked') { api.setDamage(0.9); }
  if (opts.damage) api.setDamage(opts.damage); if (opts.infection) api.setInfection(opts.infection);
  if (opts.speed) api.setSpeed(opts.speed);
  api.update(0, 0);
  return api;
}
export const _dbg = { buildGeometry, horseGeo, eagleGeo };
