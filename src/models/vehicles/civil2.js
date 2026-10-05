// More civilian vehicles: city bus, trucks (box/fuel/flatbed), motorbike, Philippine sidecar tricycle, car park.
import { THREE, RNG, TAU, cached, mk, TX, Parts, assemble, rbox, cyl, cylX, cylZ, sph, ell, between, loftZ, pw, plane, wheelGeos, addWheel, makeVehicle, Q } from './kit.js';
import { createCar } from './civil.js';
import { seatAnchor } from './craft.js';

const PAINTS = { white: 0xe6e8ea, red: 0xb4161c, blue: 0x1f4a9a, yellow: 0xe8b410, green: 0x2a7a3a, orange: 0xe0601a, silver: 0xa6abb2, black: 0x17191c, teal: 0x127078, maroon: 0x6a1c2a };
const pick = (rng, p) => (p === undefined ? Object.values(PAINTS)[rng.int(0, 9)] : typeof p === 'string' ? (PAINTS[p] ?? new THREE.Color(p).getHex()) : p);
function civMats(color, { rough = 0.3 } = {}) {
  return {
    paint: mk.paint(color, { metal: 0.45, rough, clearcoat: 0.8 }), white: mk.paint(0xe8eaec, { metal: 0.3, rough: 0.35, clearcoat: 0.6 }), stripe: mk.flat(0x14306a, { rough: 0.5, metal: 0.1 }), stripe2: mk.flat(0xe8b410, { rough: 0.5, metal: 0.1 }),
    dark: mk.metal(0x1b1d20, { rough: 0.6, metal: 0.5, normal: TX.hammered(), ns: 0.4 }), chrome: mk.chrome(), steel: mk.metal(0x8a8f96, { rough: 0.4, metal: 0.9 }), silver: mk.metal(0xcfd3d7, { rough: 0.28, metal: 0.95, normal: TX.hammered(), ns: 0.15 }),
    glass: mk.glass({ tint: 0x1a2a30, opacity: 0.55 }), rubber: mk.rubber({ tread: true }), rim: mk.metal(0xc4c8cc, { rough: 0.3, metal: 0.9 }), disc: mk.metal(0x2a2d31, { rough: 0.6 }),
    seat: mk.vinyl(0x2a2c30), wood: mk.flat(0x8a6a44, { rough: 0.8, metal: 0, normalMap: TX.hammered(), normalScale: 0.5 }), orange: mk.flat(0xe0601a, { rough: 0.5 }), red: mk.flat(0xb4161c, { rough: 0.5 }),
    lampHead: mk.light(0xfff0cc, { on: 6, off: 0.05, base: 0xbfc4c8 }), lampTail: mk.light(0xff1a12, { on: 4, off: 0.2, base: 0x701410 }), sign: mk.light(0xffa020, { on: 3, off: 0.8, base: 0x6a4410 }),
  };
}
const lightsOf = (m) => [{ mat: m.lampHead, role: 'head', flick: 1 }, { mat: m.lampTail, role: 'tail' }, { mat: m.sign, role: 'interior' }];
function axles(root, mats, defs) {
  const out = [];
  for (const d of defs) { const wg = wheelGeos({ r: d.r, w: d.w, rim: d.rim, style: d.style || 'truck', detail: 1 }); for (const sx of [1, -1]) { out.push(addWheel(root, wg, mats, { x: sx * d.x, y: d.r, z: d.z, r: d.r, side: sx, steerable: !!d.steer })); if (d.dual) out.push(addWheel(root, wg, mats, { x: sx * (d.x - d.w * 1.05), y: d.r, z: d.z, r: d.r, side: sx })); } }
  return out;
}
const finish = (api, opts) => { if (opts.damage) api.setDamage(opts.damage); if (opts.infection) api.setInfection(opts.infection); api.update(0, 0); return api; };
const headTail = (P, w, zF, zR, yF, yR) => { for (const sx of [1, -1]) { P.add('lampHead', rbox(0.4, 0.22, 0.08, 0.03, 1), { pos: [sx * w * 0.7, yF, zF] }); P.add('lampTail', rbox(0.3, 0.3, 0.07, 0.03, 1), { pos: [sx * w * 0.8, yR, zR] }); } };

// ───────────────────────────── bus ─────────────────────────────
export function createBus(opts = {}) {
  const rng = new RNG(opts.seed ?? 4); const color = pick(rng, opts.paint ?? 'white'); const mats = civMats(color); mats.paint = mats.white; if (opts.paint) mats.paint = mk.paint(color, { metal: 0.45, rough: 0.3, clearcoat: 0.8 });
  mats.stripe = mk.flat(opts.stripe ?? 0xc8161c, { rough: 0.5, metal: 0.1 });
  const L = 11, root = new THREE.Group(); root.name = 'bus'; const chassis = new THREE.Group(); root.add(chassis);
  const geo = cached(`civ2:bus:${Q.detail}`, () => {
    const P = new Parts();
    P.add('paint', loftZ({ z0: -L / 2, z1: L / 2, n: 24, w: 1.25, wt: 1.2, yb: 0.55, yt: pw([[-L / 2, 3.2], [-3, 3.3], [4, 3.3], [L / 2, 3.0]]), p: 5, round: [0.3, 0.7], radial: 22 }));
    P.add('glass', rbox(2.25, 1.25, 0.08, 0.03, 1), { pos: [0, 2.45, L / 2 - 0.1], rot: [-0.08, 0, 0] });
    for (const sx of [1, -1]) { P.add('glass', rbox(0.06, 1.0, 8.6, 0.03, 1), { pos: [sx * 1.235, 2.55, -0.4] }); P.add('stripe', rbox(0.05, 0.42, 10.2, 0.02, 1), { pos: [sx * 1.245, 1.35, 0] }); P.add('dark', rbox(0.06, 1.95, 0.95, 0.02, 1), { pos: [sx * 1.24, 1.55, 3.5] }); P.add('dark', rbox(0.1, 0.12, 0.35, 0.02, 1), { pos: [sx * 1.4, 2.7, L / 2 - 0.5] }); }
    P.add('glass', rbox(2.2, 0.8, 0.06, 0.03, 1), { pos: [0, 2.5, -L / 2 + 0.02] }); P.add('white', rbox(1.8, 0.3, 3, 0.1, 1), { pos: [0, 3.45, -1.5] }); P.add('white', rbox(1.8, 0.25, 2, 0.1, 1), { pos: [0, 3.4, 2.0] });
    P.add('sign', rbox(1.6, 0.26, 0.05, 0.02, 1), { pos: [0, 3.0, L / 2 + 0.0] }); P.add('dark', rbox(2.3, 0.5, 0.1, 0.04, 1), { pos: [0, 0.85, L / 2 + 0.02] }); P.add('dark', rbox(2.4, 0.18, 0.3, 0.05, 1), { pos: [0, 0.6, L / 2 + 0.1] }); P.add('dark', rbox(2.4, 0.18, 0.3, 0.05, 1), { pos: [0, 0.6, -L / 2 - 0.1] });
    P.add('stripe', rbox(2.46, 0.3, 0.05, 0.02, 1), { pos: [0, 1.5, L / 2 - 0.03] }); headTail(P, 1.25, L / 2 + 0.02, -L / 2 - 0.02, 1.05, 1.25);
    return P.geos();
  });
  chassis.add(assemble(geo, mats));
  const wheels = axles(root, mats, [{ z: 3.5, x: 1.05, r: 0.52, w: 0.3, rim: 0.3, steer: true }, { z: -2.9, x: 1.05, r: 0.52, w: 0.3, rim: 0.3, dual: true }]); wheels.forEach((w) => { if (w.steerNode) chassis.add(w.steerNode); });
  const seats = []; for (let r = 0; r < 9; r++) for (const sx of [-1, 1]) for (const dx of [0.4, 0.95]) if (!(r === 0)) seats.push(seatAnchor(sx * dx * (sx < 0 ? 1 : 1) + (sx > 0 ? 0.1 : -0.1), 0.55, 2.2 - r * 0.85, 0, 0.45));
  const api = makeVehicle({ kind: 'bus', root, chassis, wheels, lights: lightsOf(mats), glass: [mats.glass], anchors: { driverSeat: seatAnchor(-0.55, 0.85, 4.3, 0, 0.45), passengerSeats: seats.slice(0, 30), exitDoor: { pos: [1.3, 0.5, 3.5], yaw: Math.PI / 2 } }, seed: opts.seed ?? 4, bobAmp: 1.1, smokeAt: [0, 2.0, -3], bounds: { length: L, width: 2.5, height: 3.3 } });
  api.mats = mats; return finish(api, opts);
}

// ───────────────────────────── trucks ─────────────────────────────
export function createTruck(kind = 'box', opts = {}) {
  const rng = new RNG(opts.seed ?? 6); const color = pick(rng, opts.paint ?? (kind === 'fuel' ? 'red' : kind === 'flatbed' ? 'blue' : 'white')); const mats = civMats(color);
  const L = 9.4, root = new THREE.Group(); root.name = 'truck_' + kind; const chassis = new THREE.Group(); root.add(chassis);
  const geo = cached(`civ2:truck:${kind}:${Q.detail}`, () => {
    const P = new Parts();
    P.add('dark', rbox(1.0, 0.35, 8.8, 0.04, 1), { pos: [0, 0.95, -0.4] }); P.add('paint', rbox(2.4, 2.0, 2.1, 0.22, 2), { pos: [0, 2.05, 3.5] }); P.add('glass', rbox(2.2, 0.95, 0.08, 0.03, 1), { pos: [0, 2.5, 4.58], rot: [-0.12, 0, 0] });
    for (const sx of [1, -1]) { P.add('glass', rbox(0.06, 0.8, 1.3, 0.03, 1), { pos: [sx * 1.21, 2.45, 3.6] }); P.add('dark', rbox(0.1, 0.14, 0.35, 0.02, 1), { pos: [sx * 1.4, 2.6, 4.4] }); P.add('paint', rbox(0.5, 0.6, 1.4, 0.1, 1), { pos: [sx * 1.0, 0.7, 3.4] }); P.add('chrome', cyl(0.07, 0.07, 2.4, 8), { pos: [sx * 1.0, 3.0, 2.4] }); }
    P.add('dark', rbox(2.3, 0.4, 0.1, 0.03, 1), { pos: [0, 1.5, 4.57] }); P.add('dark', rbox(2.5, 0.3, 0.4, 0.06, 1), { pos: [0, 0.95, 4.65] }); P.add('white', rbox(2.2, 0.35, 1.2, 0.1, 1), { pos: [0, 3.2, 3.5] }); headTail(P, 1.25, 4.57, -4.8, 1.2, 1.0);
    if (kind === 'box') { P.add('white', rbox(2.5, 2.7, 6.3, 0.06, 1), { pos: [0, 2.6, -1.0] }); for (let i = 0; i < 9; i++) P.add('dark', rbox(2.52, 0.04, 0.03, 0.01, 1), { pos: [0, 1.5 + i * 0.28, -4.1] }); P.add('stripe', rbox(2.54, 0.35, 5.8, 0.02, 1), { pos: [0, 1.6, -1.0] }); }
    else if (kind === 'fuel') { P.add('silver', cylZ(1.1, 1.1, 6.8, 30), { pos: [0, 2.6, -1.2], scale: [1, 1.12, 1] }); P.add('silver', sph(1.1, 24, 12).scale(1, 1.12, 0.55), { pos: [0, 2.6, 2.2] }); P.add('silver', sph(1.1, 24, 12).scale(1, 1.12, 0.55), { pos: [0, 2.6, -4.6] }); P.add('dark', rbox(0.7, 0.1, 6.4, 0.03, 1), { pos: [0, 3.9, -1.2] }); for (const z of [-3.2, -1.2, 0.8]) P.add('steel', cyl(0.28, 0.3, 0.2, 14), { pos: [0, 4.0, z] }); P.add('red', rbox(2.2, 0.35, 5.8, 0.02, 1), { pos: [0, 2.2, -1.2] }); for (const sx of [1, -1]) P.add('dark', rbox(0.1, 0.9, 5, 0.03, 1), { pos: [sx * 1.0, 1.35, -1.2] }); }
    else { P.add('wood', rbox(2.5, 0.2, 6.6, 0.03, 1), { pos: [0, 1.4, -1.2] }); for (const sx of [1, -1]) P.add('wood', rbox(0.06, 0.6, 6.6, 0.02, 1), { pos: [sx * 1.22, 1.8, -1.2] }); P.add('wood', rbox(2.4, 0.6, 0.06, 0.02, 1), { pos: [0, 1.8, -4.47] }); P.add('dark', rbox(2.4, 1.0, 0.1, 0.02, 1), { pos: [0, 1.9, 2.0] });
      const r = new RNG(11); for (let i = 0; i < 6; i++) { const w = r.range(0.7, 1.1), h = r.range(0.5, 0.9); P.add(i % 3 === 0 ? 'orange' : 'wood', rbox(w, h, 0.9, 0.04, 1), { pos: [r.range(-0.7, 0.7), 1.5 + h / 2, -4.0 + Math.floor(i / 2) * 1.3] }); } for (let i = 0; i < 3; i++) P.add('stripe', cyl(0.3, 0.3, 0.9, 12), { pos: [-0.6 + i * 0.6, 2.0, 0.6] }); }
    return P.geos();
  });
  chassis.add(assemble(geo, mats));
  const wheels = axles(root, mats, [{ z: 3.3, x: 1.0, r: 0.55, w: 0.3, rim: 0.32, steer: true }, { z: -2.2, x: 1.0, r: 0.55, w: 0.3, rim: 0.32, dual: true }, { z: -3.6, x: 1.0, r: 0.55, w: 0.3, rim: 0.32, dual: true }]); wheels.forEach((w) => { if (w.steerNode) chassis.add(w.steerNode); });
  const api = makeVehicle({ kind: 'truck', root, chassis, wheels, lights: lightsOf(mats), glass: [mats.glass], anchors: { driverSeat: seatAnchor(-0.55, 1.35, 3.6, 0, 0.45), passengerSeats: [seatAnchor(0.45, 1.35, 3.6, 0, 0.45)], exitDoor: { pos: [1.3, 0.8, 3.4], yaw: Math.PI / 2 } }, seed: opts.seed ?? 6, bobAmp: 1.2, smokeAt: [0, 3.0, 3.5], bounds: { length: L, width: 2.5, height: 4.1 } });
  api.mats = mats; return finish(api, opts);
}

// ───────────────────────────── motorbike / tricycle ─────────────────────────────
function buildBike(tri, opts) {
  const rng = new RNG(opts.seed ?? 8); const color = pick(rng, opts.paint ?? (tri ? 'blue' : 'red')); const mats = civMats(color); mats.stripe2 = mk.flat(0xf2f2f2, { rough: 0.5 });
  const root = new THREE.Group(); root.name = tri ? 'tricycle' : 'motorbike'; const chassis = new THREE.Group(); root.add(chassis); const fork = new THREE.Group(); const HY = 1.08, HZ = 0.62; fork.position.set(0, HY, HZ); chassis.add(fork);
  const geo = cached(`civ2:bike:${tri ? 'tri' : 'bike'}:${Q.detail}`, () => {
    const P = new Parts();
    P.add('dark', between([0, 1.0, 0.55], [0, 0.55, -0.2], 0.04, 0.04, 6)); P.add('dark', between([0, 0.55, -0.2], [0, 0.33, -0.75], 0.035, 0.035, 6)); P.add('dark', between([0, 0.9, -0.1], [0, 0.72, -0.8], 0.03, 0.03, 6));
    P.add('dark', rbox(0.26, 0.32, 0.42, 0.05, 1), { pos: [0, 0.48, 0.0] }); P.add('chrome', cylZ(0.05, 0.06, 0.95, 10), { pos: [0.16, 0.34, -0.5], rot: [0.03, 0, 0] }); P.add('chrome', cylZ(0.07, 0.07, 0.3, 10), { pos: [0.16, 0.36, -1.0] });
    P.add('paint', ell(0.17, 0.15, 0.36), { pos: [0, 0.97, 0.2] }); P.add('seat', rbox(0.3, 0.1, 0.8, 0.05, 1), { pos: [0, 0.84, -0.4] }); P.add('paint', rbox(0.18, 0.04, 0.55, 0.02, 1), { pos: [0, 0.7, -0.88], rot: [-0.25, 0, 0] });
    P.add('dark', rbox(0.2, 0.22, 0.26, 0.04, 1), { pos: [0, 0.68, -0.68] }); P.add('lampTail', rbox(0.18, 0.08, 0.05, 0.02, 1), { pos: [0, 0.72, -1.18] }); P.add('steel', cyl(0.025, 0.025, 0.4, 6), { pos: [0.1, 0.6, -0.55], rot: [0.25, 0, 0] });
    if (tri) { // sidecar (right = -x): tub, roof on pillars, seat, wheel, tubular frame
      const sx = -0.98; P.add('paint', rbox(0.9, 0.5, 1.8, 0.2, 2), { pos: [sx, 0.62, -0.15] }); P.add('paint', ell(0.45, 0.3, 0.75), { pos: [sx, 0.55, 0.85] }); P.add('seat', rbox(0.7, 0.16, 0.8, 0.06, 1), { pos: [sx, 0.9, -0.35] }); P.add('seat', rbox(0.7, 0.45, 0.12, 0.05, 1), { pos: [sx, 1.15, -0.72] });
      for (const [px, pz] of [[-0.5, 0.55], [0.5, 0.55], [-0.5, -0.8], [0.5, -0.8]]) P.add('chrome', cyl(0.025, 0.025, 0.8, 6), { pos: [sx + px, 1.3, pz] }); P.add('paint', rbox(1.2, 0.07, 1.9, 0.03, 1), { pos: [sx, 1.72, -0.12] }); P.add('stripe2', rbox(1.22, 0.04, 0.4, 0.02, 1), { pos: [sx, 1.77, -0.12] }); P.add('stripe2', rbox(0.04, 0.3, 1.7, 0.02, 1), { pos: [sx - 0.46, 0.65, -0.12] });
      P.add('chrome', between([-0.1, 0.55, 0.2], [sx + 0.2, 0.5, 0.2], 0.03, 0.03, 6)); P.add('chrome', between([-0.1, 0.5, -0.5], [sx + 0.2, 0.45, -0.5], 0.03, 0.03, 6)); P.add('paint', rbox(0.34, 0.04, 0.6, 0.02, 1), { pos: [sx - 0.1, 0.46, -1.4] });
    }
    return P.geos();
  });
  chassis.add(assemble(geo, mats));
  const fg = cached(`civ2:fork:${Q.detail}`, () => { const P = new Parts(); for (const sx of [1, -1]) { P.add('chrome', cyl(0.025, 0.025, 0.85, 8), { pos: [sx * 0.09, -0.4, 0.14], rot: [-0.35, 0, 0] }); P.add('steel', cyl(0.032, 0.032, 0.3, 8), { pos: [sx * 0.09, -0.2, 0.07], rot: [-0.35, 0, 0] }); P.add('chrome', cylX(0.03, 0.03, 0.07, 8), { pos: [sx * 0.09, -0.78, 0.29] }); P.add('dark', cyl(0.018, 0.018, 0.1, 6), { pos: [sx * 0.37, 0.17, 0.0] }); P.add('steel', between([sx * 0.05, 0.06, 0], [sx * 0.2, 0.3, -0.12], 0.012, 0.012, 5)); P.add('chrome', rbox(0.1, 0.07, 0.01, 0.01, 1), { pos: [sx * 0.2, 0.36, -0.12] }); }
    P.add('dark', cylX(0.015, 0.015, 0.74, 8), { pos: [0, 0.14, 0.0] }); P.add('dark', rbox(0.2, 0.12, 0.16, 0.03, 1), { pos: [0, 0.08, 0.04] }); P.add('chrome', sph(0.11, 14, 10), { pos: [0, 0.0, 0.2] }); P.add('lampHead', sph(0.085, 14, 10), { pos: [0, -0.02, 0.28] }); P.add('paint', rbox(0.12, 0.02, 0.4, 0.01, 1), { pos: [0, -0.52, 0.28], rot: [0.2, 0, 0] }); return P.geos(); });
  fork.add(assemble(fg, mats));
  const r = 0.32, wg = wheelGeos({ r, w: 0.12, rim: 0.2, style: 'bike', detail: 1 }); const wheels = [];
  const fw = addWheel(fork, wg, mats, { x: 0, y: r - HY, z: 0.88 - HZ, r, side: 1, steerable: false }); fw.front = true; wheels.push(fw);
  wheels.push(addWheel(chassis, wg, mats, { x: 0, y: r, z: -0.86, r, side: 1 }));
  if (tri) { const sg = wheelGeos({ r: 0.3, w: 0.12, rim: 0.2, style: 'bike', detail: 1 }); wheels.push(addWheel(chassis, sg, mats, { x: -1.48, y: 0.3, z: -0.25, r: 0.3, side: -1 })); }
  const api = makeVehicle({ kind: tri ? 'tricycle' : 'motorbike', root, chassis, wheels, lights: [{ mat: mats.lampHead, role: 'head' }, { mat: mats.lampTail, role: 'tail' }], glass: [mats.glass], seed: opts.seed ?? 8, bobAmp: 0.8, rollK: tri ? 0.5 : 5, pitchK: 1.5, smokeAt: [0, 0.8, -0.5], bounds: { length: tri ? 2.4 : 1.95, width: tri ? 1.9 : 0.75, height: tri ? 1.8 : 1.2 },
    anchors: { driverSeat: seatAnchor(0, 0.84, -0.3, 0, 0.0), passengerSeats: tri ? [seatAnchor(-0.98, 0.95, -0.4, 0, 0.0), seatAnchor(-0.98, 0.95, -0.1, 0, 0.0)] : [seatAnchor(0, 0.86, -0.75, 0, 0.0)] },
    onUpdate(dt, t, S) { fork.rotation.y = S.steerSm * 1.1; } });
  api.mats = mats; return finish(api, opts);
}
export const createMotorbike = (opts = {}) => buildBike(false, opts);
export const createTricycle = (opts = {}) => buildBike(true, opts);

// ───────────────────────────── car park ─────────────────────────────
/** createCarPark({rows:2, cols:7, seed, fill:0.8, kinds:[...], infection}) -> {root, cars, update, setInfection, setLights, dispose}; cars face +-Z, row axis = X */
export function createCarPark(opts = {}) {
  const rng = new RNG(opts.seed ?? 12); const cols = opts.cols ?? 7, rows = opts.rows ?? 2, fill = opts.fill ?? 0.8; const kinds = opts.kinds || ['sedan', 'hatch', 'suv', 'sedan', 'pickup', 'van', 'taxi'];
  const root = new THREE.Group(); root.name = 'carpark'; const cars = []; const sx = 2.8, sz = 5.2, aisle = 6.4;
  const lines = new Parts(); const W = cols * sx;
  for (let r = 0; r < rows; r++) {
    for (let side = 0; side < 2; side++) {
      const zc = (side ? 1 : -1) * (aisle / 2 + sz / 2) + (r - (rows - 1) / 2) * (2 * sz + aisle + 1.0);
      for (let i = 0; i <= cols; i++) lines.add('line', plane(0.1, sz).rotateX(-Math.PI / 2), { pos: [(i - cols / 2) * sx, 0.012, zc] });
      for (let i = 0; i < cols; i++) { if (rng.next() > fill) continue; const kind = rng.pick(kinds); const car = createCar(kind, { seed: rng.int(1, 9999), damage: opts.damage }); car.root.position.set((i - (cols - 1) / 2) * sx + rng.range(-0.15, 0.15), 0, zc + rng.range(-0.15, 0.15)); car.root.rotation.y = (side ? Math.PI : 0) + rng.range(-0.04, 0.04); root.add(car.root); cars.push(car); }
    }
  }
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, rows * (2 * sz + aisle) + 6).rotateX(-Math.PI / 2), mk.flat(0x3c3f43, { rough: 0.95, metal: 0, normalMap: TX.hammered(), normalScale: 0.4 })); asphalt.receiveShadow = true; root.add(asphalt);
  const lm = assemble(lines.geos(), { line: mk.flat(0xe0e0d0, { rough: 0.8, metal: 0 }) }, { cast: false }); root.add(lm);
  const api = { root, cars, update(dt, t) { for (const c of cars) c.update(dt, t); }, setInfection(a) { for (const c of cars) c.setInfection(a); }, setLights(on) { for (const c of cars) c.setLights(on); }, dispose() { for (const c of cars) c.dispose(); asphalt.geometry.dispose(); asphalt.material.dispose(); lm.traverse((o) => { if (o.material) o.material.dispose(); }); }, bounds: { width: W + 6, depth: rows * (2 * sz + aisle) + 6 } };
  api.update(0, 0); return api;
}
