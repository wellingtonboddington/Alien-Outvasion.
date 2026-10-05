// Aircraft (jets, helicopters) and missiles. Spacecraft -> space.js, ships -> naval.js (re-exported here).
// Conventions: front = +Z, +Y up, metres. Jets/helis: origin on the ground under the CG (gear down). Missiles: origin at the TAIL, nose along +Y
// ('icbm','interceptor','sam','rocket' stand upright like on a pad) or along +Z for 'cruise' (centre origin). opts.axis:'y'|'z' overrides.
import { THREE, clamp, lerp, damp, smoothstep, TAU, cached, mk, Parts, assemble, rbox, cyl, cylX, cylZ, ell, lath, loftZ, pw, plane, canvasTex, Q } from './kit.js';
import { planSlab, sideSlab2 } from './common2.js';
import { airMats, scaleUV, makeExhaust, makeCraft, panelTex, seatAnchor } from './craft.js';
export { createSatellite, createSpaceStation } from './space.js';
export { createWarship } from './naval.js';

const GROUND = 2.4; // CG height above the ground (gear down) for jets
const sm = (cur, tgt, rate, dt, first) => (first ? tgt : damp(cur, tgt, rate, dt));

/** small air-to-air missile merged into Parts (axis Z, centred at pos) */
function msl(P, { len = 3.6, r = 0.09, pos = [0, 0, 0], body = 'white', tip = 'dark' } = {}) {
  const [x, y, z] = pos;
  P.add(body, cylZ(r, r, len * 0.68, 10), { pos: [x, y, z - len * 0.16] });
  P.add(tip, cylZ(0.012, r, len * 0.32, 10), { pos: [x, y, z + len * 0.34] });
  P.add('dark', cylZ(r * 1.01, r * 1.01, 0.12, 10), { pos: [x, y, z + len * 0.12] });
  for (let k = 0; k < 4; k++) { P.add(body, rbox(0.012, r * 2.3, 0.4, 0.004, 1), { pos: [x, y, z - len * 0.44], rot: [0, 0, k * TAU / 4 + 0.0] }); P.add('dark', rbox(0.01, r * 1.8, 0.22, 0.003, 1), { pos: [x, y, z + len * 0.1], rot: [0, 0, k * TAU / 4 + Math.PI / 4] }); }
}
function gearLeg(mats, { len, wr, ww = 0.22, twin = false }) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(cyl(0.045, 0.06, len, 8), mats.steel); s.position.y = -len / 2; g.add(s);
  const wheel = (dx) => { const t = new THREE.Mesh(cylX(wr, wr, ww, 18), mats.rubber); t.position.set(dx, -len, 0); t.castShadow = true; const h = new THREE.Mesh(cylX(wr * 0.55, wr * 0.55, ww * 1.04, 12), mats.steel); h.position.copy(t.position); g.add(t, h); };
  if (twin) { wheel(-ww * 0.6); wheel(ww * 0.6); } else wheel(0);
  return g;
}

// ───────────────────────────── fighters ─────────────────────────────
const FIGHTERS = {
  f15: {
    base: 0x7e8791, base2: 0x59616b,
    fus: { z0: -9, z1: 9.7, hw: [[-9, 0.45], [-6, 0.75], [-2, 0.95], [2.5, 0.9], [5.5, 0.62], [8, 0.3], [9.7, 0.03]], yb: [[-9, -0.3], [-5, -0.62], [0, -0.78], [4, -0.75], [7, -0.45], [9.7, 0]], yt: [[-9, 0.55], [-5, 0.85], [-1, 0.95], [3, 0.82], [6, 0.52], [9.7, 0.08]] },
    aft: { z0: -9, z1: 1.5, hw: [[-9, 1.45], [-6, 1.5], [-3, 1.45], [0, 1.2], [1.5, 0.9]], yb: [[-9, -0.55], [0, -0.7], [1.5, -0.65]], yt: [[-9, 0.45], [-3, 0.55], [1.5, 0.6]] },
    wing: { x0: 1.0, x1: 6.5, le0: 1.4, le1: -2.3, te0: -4.6, ax0: 3.8, hz: -3.2, te1: -4.0, y: -0.2 },
    stab: { pivot: [1.55, 0.0, -7.2], poly: [[0, 0.9], [2.5, -0.9], [2.5, -1.7], [0, -1.7]] },
    tail: { x: 1.45, y: 0.5, prof: [[-5.0, 0], [-6.9, 3.1], [-8.2, 3.1], [-8.7, 0]], cant: 0 },
    intake: { x: 1.35, y: -0.25, z: 2.6, w: 0.9, h: 1.1, len: 3.4 },
    canopy: { z: 5.0, y: 0.95, rx: 0.52, ry: 0.42, rz: 1.9 },
    nozzles: [[0.78, -0.05, -9.0, 0.6], [-0.78, -0.05, -9.0, 0.6]], gear: { nose: [0, -0.6, 6.0], main: [1.3, -0.6, -1.8] }, hard: true, tipX: 6.5, tipZ: -2.8,
  },
  f35: {
    base: 0x6d747c, base2: 0x4b5159,
    fus: { z0: -7.4, z1: 8.3, hw: [[-7.4, 0.6], [-4, 0.95], [-1, 1.15], [2.5, 1.1], [5, 0.7], [7, 0.3], [8.3, 0.03]], yb: [[-7.4, -0.5], [-3, -0.78], [1, -0.85], [4, -0.7], [6.5, -0.35], [8.3, 0]], yt: [[-7.4, 0.55], [-4, 0.95], [0, 1.02], [3, 0.9], [5.5, 0.6], [8.3, 0.1]] },
    aft: null,
    wing: { x0: 0.9, x1: 5.35, le0: 1.0, le1: -2.1, te0: -4.7, ax0: 3.2, hz: -3.0, te1: -3.9, y: -0.3 },
    stab: { pivot: [1.25, 0.0, -6.0], poly: [[0, 0.8], [2.0, -0.6], [2.0, -1.3], [0, -1.4]] },
    tail: { x: 1.0, y: 0.7, prof: [[-4.4, 0], [-5.7, 2.4], [-6.7, 2.4], [-7.0, 0]], cant: 0.5 },
    intake: { x: 0.95, y: -0.45, z: 3.4, w: 0.8, h: 0.95, len: 2.2 },
    canopy: { z: 4.4, y: 0.95, rx: 0.5, ry: 0.45, rz: 1.6 },
    nozzles: [[0, 0.0, -7.4, 0.62]], gear: { nose: [0, -0.7, 5.2], main: [1.2, -0.7, -1.2] }, hard: false, tipX: 5.35, tipZ: -2.6,
  },
};

function fighterGeos(kind, sp) {
  return cached(`air:jet:${kind}:${Q.detail}`, () => {
    const P = new Parts(); const f = sp.fus; const hw = pw(f.hw); const L = f.z1 - f.z0;
    P.add('paint', loftZ({ z0: f.z0, z1: f.z1, n: 36, w: hw, wt: (z) => hw(z) * 0.88, yb: pw(f.yb), yt: pw(f.yt), p: 3.3, round: [0.25, 0], radial: 26 }), { uv: scaleUV(L / 2, 1) });
    if (sp.aft) { const a = sp.aft, ah = pw(a.hw); P.add('paint', loftZ({ z0: a.z0, z1: a.z1, n: 20, w: ah, wt: (z) => ah(z) * 0.92, yb: pw(a.yb), yt: pw(a.yt), p: 3.8, round: [0.25, 0.3], radial: 22 }), { uv: scaleUV((a.z1 - a.z0) / 2, 1) }); }
    const w = sp.wing; const poly = [[w.x0, w.le0], [w.x1, w.le1], [w.x1, w.hz], [w.ax0, w.hz], [w.x0, w.te0]];
    P.add('paint', planSlab(poly, 0.14, 0.03), { pos: [0, w.y, 0], mirror: true, uv: scaleUV(0.5) });
    const t = sp.tail; P.add('paint2', sideSlab2(t.prof, 0.09, 0.02), { pos: [t.x, t.y, 0], rot: [0, 0, -t.cant], mirror: true, uv: scaleUV(0.5) });
    P.add('red', sideSlab2([[t.prof[1][0] + 0.2, t.prof[1][1] - 0.5], [t.prof[1][0], t.prof[1][1] - 0.02], [t.prof[2][0], t.prof[2][1] - 0.02], [t.prof[2][0] - 0.1, t.prof[2][1] - 0.5]], 0.1, 0.005), { pos: [t.x, t.y, 0], rot: [0, 0, -t.cant], mirror: true });
    const it = sp.intake; P.add('paint2', rbox(it.w, it.h, it.len, 0.12, 2), { pos: [it.x, it.y, it.z], mirror: true }); P.add('dark', plane(it.w * 0.8, it.h * 0.8), { pos: [it.x, it.y, it.z + it.len / 2 + 0.01], mirror: true });
    const c = sp.canopy; P.add('glass', ell(c.rx, c.ry, c.rz), { pos: [0, c.y, c.z] }); P.add('dark', ell(c.rx * 0.7, c.ry * 0.7, c.rz * 0.75), { pos: [0, c.y - 0.05, c.z] });
    P.add('paint2', ell(c.rx * 1.04, c.ry * 0.3, c.rz * 1.04), { pos: [0, c.y - c.ry * 0.5, c.z] }); P.add('paint2', rbox(c.rx * 1.8, 0.07, 0.09, 0.02, 1), { pos: [0, c.y + c.ry * 0.55, c.z - c.rz * 0.25] });
    P.add('paint2', ell(0.2, 0.18, 1.0), { pos: [0, 0.04, f.z1 - 0.6] }); P.add('steel', cylZ(0.012, 0.02, 1.0, 6), { pos: [0, 0.04, f.z1 + 0.35] });
    for (const [nx, ny, nz, nr] of sp.nozzles) { P.add('steel', cylZ(nr * 1.1, nr * 0.9, 1.1, 22, true), { pos: [nx, ny, nz + 0.2] }); P.add('dark', cylZ(nr * 0.85, nr * 0.75, 1.0, 18, true), { pos: [nx, ny, nz + 0.15] }); }
    if (sp.hard) {
      P.add('paint2', rbox(0.1, 0.34, 1.5, 0.03, 1), { pos: [3.3, -0.4, -0.2], mirror: true });
      for (const sx of [1, -1]) { msl(P, { len: 2.9, r: 0.065, pos: [sx * 3.3, -0.66, -0.2] }); for (const z of [0.3, -3.6]) msl(P, { len: 3.7, r: 0.09, pos: [sx * 1.15, -0.95, z] }); }
    }
    return P.geos();
  });
}
function fighterCtrl(kind, sp) {
  return cached(`air:jet:${kind}:ctrl:${Q.detail}`, () => {
    const w = sp.wing; const mkP = (poly, th) => { const g = planSlab(poly, th, 0.02); g.userData.shared = true; return g; };
    const mir = (poly) => poly.map(([x, z]) => [-x, z]).reverse();
    const ail = [[0, 0], [w.x1 - w.ax0, 0], [w.x1 - w.ax0, w.te1 - w.hz], [0, w.te1 - w.hz - 0.2]];
    return { ailA: mkP(ail, 0.1), ailB: mkP(mir(ail), 0.1), stabA: mkP(sp.stab.poly, 0.12), stabB: mkP(mir(sp.stab.poly), 0.12) };
  });
}

function buildFighter(kind, opts) {
  const sp = FIGHTERS[kind]; const mats = airMats({ base: sp.base, base2: sp.base2 });
  const geo = fighterGeos(kind, sp); const ctrl = fighterCtrl(kind, sp);
  const root = new THREE.Group(); root.name = 'jet_' + kind; const af = new THREE.Group(); af.position.y = GROUND; af.rotation.order = 'XZY'; root.add(af);
  af.add(assemble(geo, mats));
  const part = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; af.add(o); return o; };
  const w = sp.wing;
  const ailA = part(ctrl.ailA, mats.paint2, w.ax0, w.y, w.hz), ailB = part(ctrl.ailB, mats.paint2, -w.ax0, w.y, w.hz);
  const [px, py, pz] = sp.stab.pivot; const stA = part(ctrl.stabA, mats.paint2, px, py, pz), stB = part(ctrl.stabB, mats.paint2, -px, py, pz);
  // lights
  const lamp = (m, x, y, z, s = 0.07) => { const o = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), m); o.position.set(x, y, z); af.add(o); };
  lamp(mats.lampR, w.x1, w.y, sp.tipZ); lamp(mats.lampG, -w.x1, w.y, sp.tipZ); lamp(mats.lampW, sp.tail.x, sp.tail.y + sp.tail.prof[2][1], sp.tail.prof[2][0] - 0.05); lamp(mats.lampW, 0, -0.85, 1.5, 0.06);
  // gear
  const gears = []; const gN = gearLeg(mats, { len: 1.5, wr: 0.3, ww: 0.2 }); gN.position.set(...sp.gear.nose); af.add(gN); gears.push([gN, 0, 1.6]);
  for (const s of [1, -1]) { const g = gearLeg(mats, { len: 1.35, wr: 0.45, ww: 0.3 }); g.position.set(sp.gear.main[0] * s, sp.gear.main[1], sp.gear.main[2]); af.add(g); gears.push([g, -s, 1.5]); }
  // engines
  const exhausts = [], burners = [];
  for (const [nx, ny, nz, nr] of sp.nozzles) {
    const ex = makeExhaust({ radius: nr * 0.85, length: 11, mid: 0xffa24a, edge: 0x3a62ff, diamonds: 16, seed: nx * 3 + 1, glow: nr * 5 }); ex.root.position.set(nx, ny, nz - 0.2); af.add(ex.root); exhausts.push(ex);
    const d = new THREE.Mesh(new THREE.CircleGeometry(nr * 0.78, 18).rotateY(Math.PI), mats.burn); d.position.set(nx, ny, nz + 0.1); af.add(d); burners.push(d);
  }
  const S = { thr: opts.throttle ?? 0.5, thrSet: opts.throttle !== undefined, bank: opts.bank ?? 0, bankS: 0, pitch: opts.pitch ?? 0, pitchS: 0, gear: opts.gear ?? 0, gearS: 0, lights: true, speed: 0 };
  const api = makeCraft(root, {
    state: S, exhausts, onUpdate(dt, t, s) {
      s.bankS = sm(s.bankS, s.bank, 6, dt, s.first); s.pitchS = sm(s.pitchS, s.pitch, 6, dt, s.first); s.gearS = sm(s.gearS, s.gear, 2.5, dt, s.first);
      af.rotation.z = s.bankS; af.rotation.x = -s.pitchS;
      const a = clamp(s.bank * 0.35 + (s.bank - s.bankS) * 2.5, -0.55, 0.55); ailA.rotation.x = -a; ailB.rotation.x = a;
      const e = clamp(s.pitch * 0.5 + (s.pitch - s.pitchS) * 2.5, -0.5, 0.5); stA.rotation.x = e; stB.rotation.x = e;
      const th = s.thr, ab = smoothstep(0.55, 1.0, th); const fk = th < 0.05 ? 0 : 0.2 + 0.8 * th;
      for (const ex of exhausts) ex.set(fk, lerp(0.12, 1, ab));
      mats.burn.emissiveIntensity = lerp(0.3, 7, th);
      for (const [g, sgn, k] of gears) { g.visible = s.gearS > 0.02; g.rotation.x = sgn === 0 ? (1 - s.gearS) * k : 0; g.rotation.z = sgn === 0 ? 0 : sgn * (1 - s.gearS) * k; }
      const L = s.lights ? 1 : 0; mats.lampR.emissiveIntensity = mats.lampG.emissiveIntensity = 0.1 + 5 * L; mats.lampW.emissiveIntensity = 0.1 + L * 12 * (Math.sin(t * 5.2) > 0.9 ? 1 : 0);
    },
  });
  api.kind = kind; api.mats = mats; api.groundY = 0; api.bounds = { length: sp.fus.z1 - sp.fus.z0 + 1, wingspan: sp.wing.x1 * 2, height: GROUND + 3.6 };
  api.anchors = { pilotSeat: seatAnchor(0, GROUND + sp.canopy.y - 0.2, sp.canopy.z, 0, 0.1) };
  Object.assign(api, {
    setThrottle(a) { S.thr = clamp(a); S.thrSet = true; }, setBank(r) { S.bank = r; }, setPitch(r) { S.pitch = r; },
    setSpeed(mps) { api.speed = mps; if (!S.thrSet) S.thr = clamp(0.2 + mps / 450); }, setGear(a) { S.gear = clamp(a); }, setLights(on) { S.lights = !!on; },
  });
  return api;
}

function buildBomber(opts) {
  const mats = airMats({ base: 0x383c42, base2: 0x24272b, dark: 0x101214, canopy: 0x10161a, rough: 0.55 });
  const geo = cached(`air:jet:bomber:${Q.detail}`, () => {
    const P = new Parts();
    const R = [[0, 10.5], [26, -6], [25.2, -7.6], [17.5, -4.6], [13.5, -7.8], [6, -5.0], [3.5, -9.6], [0, -10.4]];
    const poly = R.concat(R.slice(1, -1).reverse().map(([x, z]) => [-x, z]));
    P.add('paint', planSlab(poly, 0.5, 0.12), { uv: scaleUV(0.25) });
    const hw = pw([[-8, 1.5], [-3, 3.2], [2, 3.6], [6, 2.2], [9.5, 0.2]]);
    P.add('paint', loftZ({ z0: -8, z1: 9.5, n: 32, w: hw, wt: (z) => hw(z) * 0.8, yb: -0.25, yt: pw([[-8, 0.3], [-2, 1.5], [3, 1.65], [7, 0.9], [9.5, 0.3]]), p: 2.8, round: [0.5, 0.3], radial: 24 }), { uv: scaleUV(8, 1) });
    for (const [x, z, y] of [[0.45, 6.9, 0.95], [1.25, 6.4, 1.05]]) P.add('glass', rbox(0.7, 0.05, 0.36, 0.015, 1), { pos: [x, y, z], rot: [0.22, 0, 0], mirror: true });
    P.add('dark', rbox(1.5, 0.2, 0.5, 0.05, 1), { pos: [2.6, 1.38, 2.4], mirror: true });
    P.add('dark', rbox(5, 0.04, 0.2, 0.02, 1), { pos: [0, 0.31, -2.0], mirror: true });
    return P.geos();
  });
  const root = new THREE.Group(); root.name = 'jet_bomber'; const af = new THREE.Group(); af.position.y = GROUND; af.rotation.order = 'XZY'; root.add(af); af.add(assemble(geo, mats));
  const gears = []; const mk1 = (len, wr, x, y, z, twin, sgn, k) => { const g = gearLeg(mats, { len, wr, ww: 0.3, twin }); g.position.set(x, y, z); af.add(g); gears.push([g, sgn, k]); };
  mk1(1.7, 0.4, 0, -0.2, 7.0, false, 0, 1.6); for (const s of [1, -1]) mk1(1.6, 0.5, s * 4.5, -0.3, -1.0, true, -s, 1.5);
  const exhausts = []; for (const s of [1, -1]) { const ex = makeExhaust({ radius: 0.45, length: 5, mid: 0xff9a50, edge: 0x4a62ff, diamonds: 0, seed: s + 2, glow: 2 }); ex.root.position.set(s * 3.0, 0.2, -9.2); af.add(ex.root); exhausts.push(ex); }
  const S = { thr: opts.throttle ?? 0.5, thrSet: opts.throttle !== undefined, bank: opts.bank ?? 0, bankS: 0, pitch: opts.pitch ?? 0, pitchS: 0, gear: opts.gear ?? 0, gearS: 0 };
  const api = makeCraft(root, { state: S, exhausts, onUpdate(dt, t, s) {
    s.bankS = sm(s.bankS, s.bank, 3, dt, s.first); s.pitchS = sm(s.pitchS, s.pitch, 3, dt, s.first); s.gearS = sm(s.gearS, s.gear, 2, dt, s.first);
    af.rotation.z = s.bankS; af.rotation.x = -s.pitchS; for (const ex of exhausts) ex.set(s.thr < 0.05 ? 0 : s.thr * 0.45, 0.4 + 0.6 * s.thr);
    for (const [g, sgn, k] of gears) { g.visible = s.gearS > 0.02; g.rotation.x = sgn === 0 ? (1 - s.gearS) * k : 0; g.rotation.z = sgn === 0 ? 0 : sgn * (1 - s.gearS) * k; }
  } });
  api.kind = 'bomber'; api.mats = mats; api.groundY = 0; api.bounds = { length: 21, wingspan: 52, height: GROUND + 1.8 };
  api.anchors = { pilotSeat: seatAnchor(-0.6, GROUND + 0.6, 6.6, 0, 0.1), copilotSeat: seatAnchor(0.6, GROUND + 0.6, 6.6, 0, 0.1) };
  Object.assign(api, { setThrottle(a) { S.thr = clamp(a); S.thrSet = true; }, setBank(r) { S.bank = r; }, setPitch(r) { S.pitch = r; }, setSpeed(mps) { api.speed = mps; if (!S.thrSet) S.thr = clamp(0.2 + mps / 450); }, setGear(a) { S.gear = clamp(a); }, setLights() {} });
  return api;
}

export function createJet(kind = 'f15', opts = {}) {
  const api = kind === 'bomber' ? buildBomber(opts) : buildFighter(kind === 'f35' ? 'f35' : 'f15', opts);
  if (opts.scale) api.root.scale.setScalar(opts.scale); if (opts.infection) api.setInfection(opts.infection); if (opts.damage) api.setDamage(opts.damage);
  api.update(0, 0); return api;
}

// ───────────────────────────── helicopters ─────────────────────────────
function discTex() { return cached('air:rotordisc', () => canvasTex(128, 128, (ctx, w, h) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.22, 'rgba(255,255,255,0.05)'); g.addColorStop(0.55, 'rgba(255,255,255,0.4)'); g.addColorStop(0.96, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }, { wrap: 'clamp' })); }
function rotorAssembly(mats, { R, chord, n, hub = 0.35, sag = 0.0 }) {
  const grp = new THREE.Group(); const P = new Parts();
  for (let k = 0; k < n; k++) { P.add('blade', rbox(R - hub, 0.03, chord, 0.012, 1).translate((R + hub) / 2, 0, 0), { rot: [0, k * TAU / n, 0] }); }
  P.add('hub', cyl(0.2, 0.26, 0.28, 14), { pos: [0, 0.05, 0] });
  const geos = P.geos(); const bm = new THREE.Mesh(geos.blade, mats.blade); bm.castShadow = true; const hm = new THREE.Mesh(geos.hub, mats.dark); grp.add(bm, hm);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 56).rotateX(-Math.PI / 2), mats.disc); disc.renderOrder = 4; disc.position.y = 0.02; grp.add(disc);
  return grp;
}
export function createHelicopter(kind = 'attack', opts = {}) {
  const attack = kind !== 'transport';
  const mats = airMats(attack ? { base: 0x3d433a, base2: 0x2d322c, dark: 0x181a1b, rough: 0.7, canopy: 0x1c2a30 } : { base: 0x4c5438, base2: 0x3a402b, dark: 0x1a1c1a, rough: 0.7, canopy: 0x1d2c30 });
  mats.blade = mk.flat(0x1d1f20, { rough: 0.5, metal: 0.3 }); mats.blade.transparent = true; mats.disc = new THREE.MeshBasicMaterial({ map: discTex(), color: 0x2a2e30, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const geo = cached(`air:heli:${kind}:${Q.detail}`, () => {
    const P = new Parts();
    if (attack) {
      const hw = pw([[-3, 0.3], [-1, 0.62], [1.5, 0.65], [3, 0.5], [4, 0.15]]);
      P.add('paint', loftZ({ z0: -3, z1: 4, n: 24, w: hw, wt: (z) => hw(z) * 0.85, yb: pw([[-3, 1.2], [0, 0.8], [2, 0.8], [3.2, 0.95], [4, 1.3]]), yt: pw([[-3, 1.9], [-1, 2.3], [1, 2.45], [2.6, 1.9], [4, 1.55]]), p: 2.9, round: [0.3, 0.2], radial: 22 }), { uv: scaleUV(3.5, 1) });
      P.add('glass', ell(0.5, 0.4, 1.2), { pos: [0, 2.15, 2.5] }); P.add('glass', ell(0.54, 0.46, 1.3), { pos: [0, 2.5, 0.65] }); P.add('dark', ell(0.38, 0.3, 1.0), { pos: [0, 2.1, 2.5] }); P.add('dark', ell(0.4, 0.3, 1.0), { pos: [0, 2.45, 0.65] });
      P.add('paint2', rbox(0.3, 0.75, 1.5, 0.08, 1), { pos: [0.62, 1.95, 1.6], mirror: true });
      P.add('dark', ell(0.34, 0.3, 0.55), { pos: [0, 1.15, 4.0] }); P.add('steel', cylZ(0.04, 0.04, 1.0, 8), { pos: [0, 0.85, 3.4] }); P.add('dark', rbox(0.35, 0.3, 0.5, 0.05, 1), { pos: [0, 0.95, 3.1] });
      P.add('paint', ell(0.5, 0.55, 1.7), { pos: [0.75, 2.4, -0.9], mirror: true }); P.add('dark', cylZ(0.3, 0.32, 0.5, 14), { pos: [0.75, 2.4, -2.55], mirror: true });
      P.add('paint2', cyl(0.14, 0.2, 0.6, 14), { pos: [0, 2.85, -0.05] });
      const bh = pw([[-9.6, 0.14], [-6, 0.26], [-2.5, 0.4]]);
      P.add('paint', loftZ({ z0: -9.6, z1: -2.2, n: 14, w: bh, wt: bh, yb: pw([[-9.6, 1.95], [-2.5, 1.5]]), yt: pw([[-9.6, 2.3], [-2.5, 2.4]]), p: 2.4, round: [0.1, 0], radial: 14 }), { uv: scaleUV(3, 1) });
      P.add('paint2', sideSlab2([[-8.6, 2.1], [-9.5, 3.9], [-10.05, 3.9], [-9.8, 2.1]], 0.08, 0.015)); P.add('paint2', planSlab([[0, -8.3], [1.8, -8.6], [1.8, -9.3], [0, -9.4]], 0.07, 0.01), { pos: [0, 2.15, 0], mirror: true });
      P.add('paint2', planSlab([[0.55, 0.7], [2.5, 0.3], [2.5, -0.5], [0.55, -1.0]], 0.09, 0.015), { pos: [0, 1.55, 0], mirror: true });
      for (const sx of [1, -1]) { P.add('paint2', cylZ(0.13, 0.13, 1.8, 14), { pos: [sx * 2.3, 1.22, 0.0] }); P.add('dark', plane(0.24, 0.24), { pos: [sx * 2.3, 1.22, 0.91] }); P.add('paint2', rbox(0.08, 0.3, 0.6, 0.02, 1), { pos: [sx * 2.3, 1.42, 0.0] }); for (const [dx, dy] of [[0, 0], [0.22, 0], [0, 0.22], [0.22, 0.22]]) { const mx = sx * (1.25 + dx), my = 1.25 + dy * 0.0 - dy * 0.0; if (dy === 0) P.add('white', cylZ(0.07, 0.07, 1.5, 8), { pos: [mx, 1.25, 0.2] }), P.add('dark', cylZ(0.01, 0.07, 0.3, 8), { pos: [mx, 1.25, 1.1] }); } }
      for (const sx of [1, -1]) { P.add('steel', rbox(0.05, 0.9, 0.05, 0.01, 1), { pos: [sx * 0.8, 1.05, 0.3], rot: [0, 0, sx * 0.4] }); P.add('rubber', cylX(0.3, 0.3, 0.2, 16), { pos: [sx * 1.15, 0.3, 0.3] }); }
      P.add('rubber', cylX(0.18, 0.18, 0.12, 12), { pos: [0, 0.18, -8.2] }); P.add('steel', rbox(0.04, 1.8, 0.04, 0.01, 1), { pos: [0, 1.08, -8.3] });
    } else {
      const hw = pw([[-3.2, 0.35], [-1, 1.0], [1.5, 1.1], [3, 0.95], [4.3, 0.5]]);
      P.add('paint', loftZ({ z0: -3.2, z1: 4.3, n: 26, w: hw, wt: (z) => hw(z) * 0.92, yb: pw([[-3.2, 1.6], [0, 0.75], [2, 0.75], [4.3, 1.0]]), yt: pw([[-3.2, 2.2], [-1, 2.9], [2.2, 2.9], [3.4, 2.3], [4.3, 1.6]]), p: 3.4, round: [0.3, 0.3], radial: 24 }), { uv: scaleUV(3.75, 1) });
      P.add('glass', rbox(1.7, 0.75, 0.07, 0.02, 1), { pos: [0, 2.35, 3.6], rot: [-0.7, 0, 0] }); for (const sx of [1, -1]) { P.add('glass', rbox(0.05, 0.55, 1.0, 0.02, 1), { pos: [sx * 0.97, 2.35, 2.9] }); for (const z of [-0.2, -1.0, -1.8]) P.add('glass', rbox(0.04, 0.42, 0.55, 0.02, 1), { pos: [sx * 1.08, 2.3, z] }); P.add('dark', rbox(0.03, 1.5, 1.5, 0.01, 1), { pos: [sx * 1.1, 1.85, 1.0] }); }
      P.add('paint2', ell(0.55, 0.5, 1.5), { pos: [0.65, 3.1, 0.2], mirror: true }); P.add('dark', cylZ(0.3, 0.32, 0.4, 14), { pos: [0.65, 3.05, -1.4], mirror: true }); P.add('paint2', cyl(0.14, 0.2, 0.5, 14), { pos: [0, 3.3, -0.1] });
      const bh = pw([[-9.4, 0.18], [-6, 0.3], [-3, 0.5]]);
      P.add('paint', loftZ({ z0: -9.4, z1: -2.8, n: 14, w: bh, wt: bh, yb: pw([[-9.4, 2.0], [-3, 1.6]]), yt: pw([[-9.4, 2.6], [-3, 2.9]]), p: 2.6, round: [0.1, 0], radial: 14 }), { uv: scaleUV(3, 1) });
      P.add('paint2', sideSlab2([[-7.4, 2.2], [-9.0, 4.1], [-9.7, 4.1], [-9.5, 2.2]], 0.1, 0.02)); P.add('paint2', planSlab([[0, -8.3], [2.0, -8.7], [2.0, -9.4], [0, -9.5]], 0.07, 0.01), { pos: [0, 2.35, 0], mirror: true });
      P.add('paint2', planSlab([[0.9, 0.8], [2.2, 0.6], [2.2, -0.2], [0.9, -0.5]], 0.08, 0.015), { pos: [0, 1.5, 0], mirror: true }); P.add('white', ell(0.3, 0.3, 0.9), { pos: [1.5, 1.2, 0.2], mirror: true });
      for (const sx of [1, -1]) { P.add('steel', rbox(0.05, 0.8, 0.05, 0.01, 1), { pos: [sx * 1.0, 0.95, 0.3], rot: [0, 0, sx * 0.5] }); P.add('rubber', cylX(0.4, 0.4, 0.22, 16), { pos: [sx * 1.4, 0.4, 0.3] }); }
      P.add('rubber', cylX(0.2, 0.2, 0.12, 12), { pos: [0, 0.2, -6.9] }); P.add('steel', rbox(0.04, 1.9, 0.04, 0.01, 1), { pos: [0, 1.15, -7.0] });
    }
    return P.geos();
  });
  const root = new THREE.Group(); root.name = 'heli_' + kind; const af = new THREE.Group(); af.rotation.order = 'XZY'; af.position.y = 0; root.add(af); af.add(assemble(geo, mats));
  const mastY = attack ? 3.5 : 3.8, mastZ = attack ? -0.05 : -0.1, R = attack ? 7.3 : 8.2;
  const main = rotorAssembly(mats, { R, chord: attack ? 0.5 : 0.55, n: 4 }); main.position.set(0, mastY, mastZ); af.add(main);
  const tailR = rotorAssembly(mats, { R: 1.35, chord: 0.2, n: 4, hub: 0.15 }); tailR.rotation.z = Math.PI / 2; tailR.position.set(attack ? 0.28 : 0.34, attack ? 3.0 : 3.4, attack ? -9.8 : -9.5); af.add(tailR);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mats.lampR); beacon.position.set(0, attack ? 3.95 : 4.2, attack ? -9.9 : -9.6); af.add(beacon);
  const S = { rotor: opts.rotor ?? 1, w: 0, ang: 0, bank: opts.bank ?? 0, pitch: opts.pitch ?? 0, bankS: 0, pitchS: 0, speed: 0 };
  const WMAX = attack ? 29 : 27;
  const api = makeCraft(root, { state: S, onUpdate(dt, t, s) {
    s.w = sm(s.w, s.rotor * WMAX, 1.2, dt, s.first); s.ang += s.w * dt; main.rotation.y = -s.ang; tailR.rotation.x = s.ang * 4.6;
    const blur = smoothstep(3, 18, s.w); mats.blade.opacity = lerp(1, 0.18, blur); mats.disc.opacity = blur * 0.55;
    const fwd = clamp(s.speed / 70, 0, 1) * 0.16; s.bankS = sm(s.bankS, s.bank, 3, dt, s.first); s.pitchS = sm(s.pitchS, s.pitch + fwd, 3, dt, s.first);
    af.rotation.z = s.bankS; af.rotation.x = s.pitchS + Math.sin(t * 1.7) * 0.004 * s.rotor; af.position.y = Math.sin(t * 2.3) * 0.015 * s.rotor;
    mats.lampR.emissiveIntensity = 0.1 + (Math.sin(t * 6) > 0.6 ? 10 : 0);
  } });
  api.kind = 'helicopter:' + kind; api.mats = mats; api.groundY = 0; api.rotorRadius = R; api.bounds = { length: attack ? 15.5 : 17, width: R * 2, height: attack ? 4.0 : 5.1 };
  api.anchors = attack ? { pilotSeat: seatAnchor(0, 1.3, 0.65, 0, 0.45), gunnerSeat: seatAnchor(0, 1.0, 2.5, 0, 0.45) }
    : { pilotSeat: seatAnchor(-0.5, 1.0, 2.7, 0, 0.45), copilotSeat: seatAnchor(0.5, 1.0, 2.7, 0, 0.45), passengerSeats: [-1, 1].flatMap((s) => [0.4, -0.4, -1.2].map((z) => seatAnchor(s * 0.75, 0.95, z, s * Math.PI / 2, 0.45))), exitDoor: { pos: [1.2, 0.8, 1.0], yaw: Math.PI / 2 } };
  Object.assign(api, { setRotor(a) { S.rotor = clamp(a); }, setThrottle(a) { S.rotor = clamp(a); }, setBank(r) { S.bank = r; }, setPitch(r) { S.pitch = r; }, setSpeed(mps) { S.speed = mps; api.speed = mps; }, setLights() {} });
  if (opts.scale) root.scale.setScalar(opts.scale); if (opts.infection) api.setInfection(opts.infection); api.update(0, 0); return api;
}

// ───────────────────────────── missiles ─────────────────────────────
const fin = (prof, w = 0.02) => sideSlab2(prof, w, w * 0.2); // fin lying in the +z (radial) / y (axial) plane
const ogive = (r, y0, h, n = 10, pw_ = 0.8) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([Math.max(0.004, r * Math.pow(Math.cos(t * Math.PI / 2), pw_)), y0 + h * t]); } return pts; };
const ring = (P, key, r, y0, y1, grow = 0.01) => P.add(key, lath([[r + grow, y0], [r + grow, y1]], 24));
const MISSILES = {
  icbm: { len: 17, axis: 'y', flame: { radius: 1.1, length: 22, mid: 0xffa040, edge: 0xff5a20, diamonds: 8, glow: 7 },
    build() {
      const P = new Parts();
      P.add('white', lath([[0.0, 0.0], [0.86, 0.0], [0.92, 0.2], [0.92, 8.5]], 28)); P.add('dark', lath([[0.0, -0.05], [0.7, -0.05], [0.9, 0.5]], 20));
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; P.add('dark', cyl(0.18, 0.3, 0.8, 12), { pos: [Math.cos(a) * 0.45, -0.2, Math.sin(a) * 0.45] }); }
      P.add('dark', lath([[0.92, 8.45], [0.92, 8.9], [0.8, 9.3]], 28)); P.add('white', lath([[0.8, 9.2], [0.8, 12.6]], 28)); P.add('dark', lath([[0.8, 12.55], [0.8, 12.9], [0.58, 13.3]], 28)); P.add('white', lath([[0.58, 13.2], [0.55, 14.8]], 24));
      P.add('nose', lath(ogive(0.55, 14.8, 2.2, 12, 0.75), 28)); ring(P, 'red', 0.92, 4.0, 4.35); ring(P, 'red', 0.8, 10.8, 11.1); ring(P, 'dark', 0.55, 14.55, 14.8);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; P.add('steel', rbox(0.06, 8.0, 0.05, 0.01, 1), { pos: [Math.cos(a) * 0.93, 4.6, Math.sin(a) * 0.93], rot: [0, -a + Math.PI / 2, 0] }); }
      P.add('dark', rbox(0.5, 1.2, 0.02, 0.005, 1), { pos: [0, 6.3, 0.925] });
      return P.geos();
    } },
  interceptor: { len: 12.4, axis: 'y', flame: { radius: 0.62, length: 17, core: 0xffffff, mid: 0xb8dcff, edge: 0x5c7cff, diamonds: 10, glow: 6 }, flame2: { y: 7.1, radius: 0.42, length: 10 },
    build() {
      const P = new Parts(); const S1 = (k) => 's1:' + k;
      P.add(S1('white'), lath([[0, 0], [0.46, 0], [0.5, 0.15], [0.5, 6.5]], 24)); P.add(S1('dark'), lath([[0, -0.05], [0.38, -0.05], [0.48, 0.45]], 18)); P.add(S1('dark'), cyl(0.2, 0.3, 0.7, 14), { pos: [0, -0.15, 0] });
      P.add(S1('red'), lath([[0.512, 4.2], [0.512, 5.0]], 24)); P.add(S1('dark'), lath([[0.5, 6.4], [0.5, 6.7], [0.36, 7.15]], 24)); ring(P, S1('steel'), 0.5, 1.0, 1.06); ring(P, S1('steel'), 0.5, 3.0, 3.06);
      const gf = new Parts(); gf.add('dark', rbox(0.5, 0.04, 0.34, 0.005, 1), { pos: [0, 0.18, 0] }); gf.add('dark', rbox(0.5, 0.04, 0.34, 0.005, 1), { pos: [0, -0.18, 0] }); gf.add('dark', rbox(0.04, 0.4, 0.34, 0.005, 1), { pos: [0.23, 0, 0] }); gf.add('dark', rbox(0.04, 0.4, 0.34, 0.005, 1), { pos: [-0.23, 0, 0] });
      for (let j = -2; j <= 2; j++) gf.add('dark', rbox(0.015, 0.4, 0.34, 0.003, 1), { pos: [j * 0.1, 0, 0] });
      for (let j = -1; j <= 1; j++) gf.add('dark', rbox(0.5, 0.015, 0.34, 0.003, 1), { pos: [0, j * 0.1, 0] });
      const gfg = gf.geos().dark;
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4; P.add(S1('dark'), gfg, { pos: [Math.sin(a) * 0.75, 6.2, Math.cos(a) * 0.75], rot: [0, a - Math.PI / 2, 0] }); P.add(S1('dark'), rbox(0.05, 0.05, 0.3, 0.01, 1), { pos: [Math.sin(a) * 0.55, 6.2, Math.cos(a) * 0.55], rot: [0, a, 0] }); }
      P.add('grey', lath([[0.36, 7.0], [0.34, 10.3]], 24)); P.add('dark', lath([[0.34, 10.25], [0.34, 10.4]], 20)); P.add('white', lath(ogive(0.34, 10.4, 2.0, 12, 0.7), 24)); ring(P, 'red', 0.34, 9.0, 9.45, 0.008); ring(P, 'red', 0.2, 11.6, 11.85, 0.01); ring(P, 'steel', 0.34, 7.6, 7.65);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4; P.add('decal', plane(0.26, 0.26), { pos: [Math.sin(a) * 0.347, 9.75, Math.cos(a) * 0.347], rot: [0, a, 0] }); }
      return P.geos();
    } },
  sam: { len: 5.2, axis: 'y', flame: { radius: 0.32, length: 6, mid: 0xffc060, edge: 0xff7030, diamonds: 6, glow: 3 },
    build() {
      const P = new Parts();
      P.add('white', lath([[0, 0], [0.19, 0], [0.205, 0.1], [0.205, 3.7]], 18)); P.add('nose', lath(ogive(0.205, 3.7, 1.5, 10, 0.7), 18)); P.add('dark', lath([[0.0, -0.02], [0.17, -0.02], [0.2, 0.25]], 14)); ring(P, 'olive', 0.205, 2.6, 2.9); ring(P, 'dark', 0.205, 3.55, 3.7);
      for (let i = 0; i < 4; i++) { P.add('white', fin([[0.18, 0.1], [0.78, 0.1], [0.78, 0.5], [0.18, 1.2]], 0.025), { rot: [0, i * TAU / 4, 0] }); P.add('dark', fin([[0.18, 3.0], [0.46, 3.1], [0.46, 3.3], [0.18, 3.5]], 0.02), { rot: [0, i * TAU / 4 + Math.PI / 4, 0] }); }
      return P.geos();
    } },
  rocket: { len: 3.9, axis: 'y', flame: { radius: 0.2, length: 4, mid: 0xffc060, edge: 0xff7a30, diamonds: 6, glow: 2 },
    build() {
      const P = new Parts();
      P.add('olive', lath([[0, 0], [0.105, 0], [0.115, 0.1], [0.115, 2.8]], 14)); P.add('nose', lath(ogive(0.115, 2.8, 1.1, 8, 0.9), 14)); P.add('dark', lath([[0, -0.02], [0.09, -0.02], [0.11, 0.2]], 12)); ring(P, 'yellow', 0.115, 1.2, 1.35); ring(P, 'yellow', 0.115, 2.5, 2.6);
      for (let i = 0; i < 4; i++) P.add('dark', fin([[0.1, 0.05], [0.4, 0.05], [0.4, 0.3], [0.1, 0.5]], 0.012), { rot: [0, i * TAU / 4, 0] });
      return P.geos();
    } },
  cruise: { len: 5.6, axis: 'z', flame: { radius: 0.2, length: 3.5, mid: 0xffd080, edge: 0xff9a40, diamonds: 4, glow: 1.5 },
    build() {
      const P = new Parts();
      P.add('white', lath([[0, 0], [0.24, 0], [0.26, 0.15], [0.26, 4.2]], 18)); P.add('white', lath(ogive(0.26, 4.2, 1.4, 10, 0.6), 18)); P.add('dark', lath([[0.0, -0.02], [0.2, -0.02], [0.25, 0.2]], 14)); ring(P, 'dark', 0.26, 1.9, 2.0); ring(P, 'dark', 0.26, 3.3, 3.34);
      P.add('white', rbox(0.18, 0.9, 0.2, 0.05, 1), { pos: [0, 1.0, 0.27] }); P.add('dark', rbox(0.14, 0.06, 0.16, 0.02, 1), { pos: [0, 1.48, 0.27] });
      for (const [sx, rt] of [[1, Math.PI / 2], [-1, -Math.PI / 2]]) P.add('white', fin([[0.2, 2.0], [1.4, 2.35], [1.4, 2.7], [0.2, 3.1]], 0.025), { rot: [0, rt, 0] });
      for (let i = 0; i < 4; i++) P.add('white', fin([[0.2, 0.05], [0.65, 0.05], [0.65, 0.3], [0.2, 0.6]], 0.02), { rot: [0, i * TAU / 4 + Math.PI / 4, 0] });
      return P.geos();
    } },
};
function trefoilTex() { return cached('air:trefoil', () => canvasTex(128, 128, (ctx, w, h) => { ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#e8c010'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; for (let k = 0; k < 3; k++) { const a = k * TAU / 3 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(64, 64); ctx.arc(64, 64, 46, a - 0.52, a + 0.52); ctx.closePath(); ctx.fill(); } ctx.beginPath(); ctx.arc(64, 64, 9, 0, TAU); ctx.fill(); }, { wrap: 'clamp' })); }

export function createMissile(kind = 'cruise', opts = {}) {
  const sp = MISSILES[kind] || MISSILES.cruise; const axis = opts.axis || sp.axis;
  const pm = (c, o = {}) => mk.paint(c, { metal: 0.15, rough: 0.42, clearcoat: 0.3, map: panelTex('air:mpanel'), normalScale: 0.08, ...o });
  const mats = { white: pm(kind === 'interceptor' ? 0xeceff1 : 0xe2e5e8), grey: pm(0xaeb5bb), olive: pm(0x4a5238, { rough: 0.6 }), dark: mk.flat(0x24272b, { rough: 0.5, metal: 0.35 }), nose: mk.flat(kind === 'cruise' ? 0xcfd3d6 : 0x1a1c1f, { rough: 0.35, metal: 0.2 }), red: mk.flat(0xc2151b, { rough: 0.45 }), steel: mk.metal(0x80868d, { rough: 0.35, metal: 0.9 }), yellow: mk.flat(0xd8b020, { rough: 0.5 }), decal: mk.flat(0xffffff, { map: trefoilTex(), rough: 0.5, metal: 0 }) };
  mats.decal.transparent = true; mats.decal.polygonOffset = true; mats.decal.polygonOffsetFactor = -2; mats.decal.depthWrite = false;
  const geo = cached(`air:msl:${kind}:${Q.detail}`, () => sp.build());
  const root = new THREE.Group(); root.name = 'missile_' + kind; const orient = new THREE.Group(); root.add(orient);
  if (axis === 'z') { orient.rotation.x = Math.PI / 2; orient.position.z = -sp.len / 2; }
  const body = new THREE.Group(); orient.add(body); const stage1 = new THREE.Group(); body.add(stage1);
  const up = {}, s1 = {}; for (const k in geo) { if (k.startsWith('s1:')) s1[k.slice(3)] = geo[k]; else up[k] = geo[k]; }
  body.add(assemble(up, mats)); if (Object.keys(s1).length) stage1.add(assemble(s1, mats));
  const fl = sp.flame; const ex = makeExhaust({ radius: fl.radius, length: fl.length, core: fl.core ?? 0xffffff, mid: fl.mid, edge: fl.edge, diamonds: fl.diamonds, seed: 3, glow: fl.glow });
  ex.root.rotation.x = -Math.PI / 2; stage1.add(ex.root); const exhausts = [ex]; let ex2 = null;
  if (sp.flame2) { ex2 = makeExhaust({ radius: sp.flame2.radius, length: sp.flame2.length, core: 0xffffff, mid: fl.mid, edge: fl.edge, diamonds: 8, seed: 5, glow: 3.5 }); ex2.root.rotation.x = -Math.PI / 2; ex2.root.position.y = sp.flame2.y; body.add(ex2.root); exhausts.push(ex2); }
  const S = { burn: opts.burn ?? 0, stage: opts.stage ?? 0 };
  const api = makeCraft(root, { state: S, exhausts, onUpdate(dt, t, s) {
    const f = 0.8 + 0.2 * Math.sin(t * 47) * Math.sin(t * 31); const sep = s.stage;
    ex.set(sep > 0.02 ? 0 : s.burn * f, 0.3 + 0.7 * s.burn); if (ex2) ex2.set(sep > 0.02 ? s.burn * f : 0, 0.3 + 0.7 * s.burn);
    stage1.position.y = -sep * sep * 60; stage1.rotation.set(sep * 0.9, 0, sep * 0.5); stage1.visible = sep < 1;
  } });
  api.kind = 'missile:' + kind; api.length = sp.len; api.mats = mats; api.bounds = { length: sp.len };
  Object.assign(api, { setBurn(a) { S.burn = clamp(a); }, setStage(a) { S.stage = clamp(a); }, setSpeed(mps) { api.speed = mps; } });
  if (opts.scale) root.scale.setScalar(opts.scale); if (opts.infection) api.setInfection(opts.infection); api.update(0, 0); return api;
}
