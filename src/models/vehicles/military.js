// Military ground vehicles: tank, APC, Humvee, launchers (HIMARS / Patriot / TEL), self-propelled howitzer, SPAAG.
import {
  THREE, RNG, clamp, lerp, damp, smoothstep, TAU, Q, GLOBAL, cached, mk, TX, Parts, assemble, box, rbox, cyl, cylX, cylZ, sph, ell, tor, plane, between, boxBetween, lath, pw, loftZ,
  wheelGeos, addWheel, makeVehicle, norm, xf, infectable, plateTex,
} from './kit.js';
import { planSlab, sideSlab2, milMats, trackBelt, trackTex, muzzleFlash, glowSprite } from './common2.js';
import { createMissile } from './air.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lightsOf = (m) => [{ mat: m.lampHead, role: 'head', flick: 1 }, { mat: m.lampTail, role: 'tail' }, { mat: m.lampAmber, role: 'signal' }];
const seatAnch = (x, y, z, yaw = 0, h = 0.45) => ({ pos: [x, y, z], hip: [x, y + h, z], yaw, seatH: h });

// ───────────────────────────── tracked chassis ─────────────────────────────
function trackedGeo(kind) {
  return cached(`mil:tracked:${kind}:${Q.detail}`, () => {
    const P = new Parts(); const L = kind === 'spaag' ? 7.2 : kind === 'sph' ? 7.0 : 7.8; const hw = kind === 'tank' ? 1.28 : 1.3; const top = kind === 'tank' ? 1.45 : 1.6;
    const hull = loftZ({ z0: -L / 2, z1: L / 2, n: 30, w: pw([[-L / 2, hw * 0.88], [-L / 2 + 0.5, hw * 0.94], [L / 2 - 1.5, hw * 0.94], [L / 2, hw * 0.7]]), wt: pw([[-L / 2, hw * 0.9], [-L / 2 + 0.5, hw], [L / 2 - 1.5, hw], [L / 2, hw * 0.74]]), yb: 0.55, yt: pw([[-L / 2, top - 0.2], [-L / 2 + 0.7, top], [L / 2 - 1.8, top], [L / 2 - 0.6, top - 0.25], [L / 2, 0.98]]), p: 5, round: [0.3, 0.55], roundQ: 3, roundY: 0.05, radial: 28 });
    P.add('paint', hull); const tx = 1.42, tw = 0.66;
    // skirts (segmented), fenders, glacis details
    for (let i = 0; i < 4; i++) { const z = -L / 2 + 0.9 + i * ((L - 2.3) / 3.0); P.add('paint', rbox(0.14, 0.78, (L - 2.3) / 3.0 - 0.06, 0.04, 1), { pos: [tx + tw / 2 + 0.1, 0.92, z], mirror: true }); P.add('dark', rbox(0.06, 0.1, 0.1, 0.01, 1), { pos: [tx + tw / 2 + 0.2, 1.08, z - 0.1], mirror: true }); }
    P.add('paint', rbox(0.9, 0.08, L - 1.4, 0.03, 1), { pos: [tx + 0.0, 1.38, -0.2], mirror: true });
    P.add('paint', rbox(0.7, 0.07, 1.1, 0.03, 1), { pos: [tx, 1.34, L / 2 - 0.35], rot: [-0.15, 0, 0], mirror: true });
    P.add('dark', rbox(1.5, 0.12, 1.2, 0.04, 1), { pos: [0, top + 0.02, -L / 2 + 1.0] }); for (let i = -5; i <= 5; i++) P.add('steel', rbox(0.04, 0.03, 1.0, 0.01, 1), { pos: [i * 0.13, top + 0.09, -L / 2 + 1.0] });
    P.add('dark', rbox(1.2, 0.35, 0.1, 0.03, 1), { pos: [0, 0.95, -L / 2 - 0.02] }); for (let i = -4; i <= 4; i++) P.add('steel', rbox(0.03, 0.3, 0.03, 0.005, 1), { pos: [i * 0.12, 0.95, -L / 2 - 0.07] });
    P.add('dark', cyl(0.28, 0.28, 0.12, 14), { pos: [-0.62, top + 0.14, L / 2 - 1.5] }); P.add('steel', cyl(0.24, 0.24, 0.04, 14), { pos: [-0.62, top + 0.21, L / 2 - 1.5] }); // driver hatch
    P.add('glass', rbox(0.4, 0.05, 0.1, 0.01, 1), { pos: [-0.62, top + 0.17, L / 2 - 1.2] });
    for (const sx of [1, -1]) { P.add('lampHead', rbox(0.18, 0.12, 0.08, 0.03, 1), { pos: [sx * 1.05, top - 0.38, L / 2 - 0.12], rot: [0, 0, 0] }); P.add('black', rbox(0.24, 0.17, 0.05, 0.02, 1), { pos: [sx * 1.05, top - 0.38, L / 2 - 0.18] }); P.add('lampTail', rbox(0.14, 0.1, 0.05, 0.02, 1), { pos: [sx * 1.1, 1.15, -L / 2 - 0.03] }); }
    for (const sx of [1, -1]) { P.add('steel', between([sx * 0.7, 1.2, L / 2 - 0.05], [sx * 0.7, 1.15, L / 2 - 0.5], 0.03, 0.03, 6)); P.add('steel', tor(0.06, 0.012, 5, 12), { pos: [sx * 0.7, 1.2, L / 2 - 0.02] }); }
    // tow cables / spare track links / fuel drums
    P.add('dark', rbox(0.08, 0.08, 3.2, 0.02, 1), { pos: [hw * 0.72, top - 0.05, 0.4], mirror: true });
    return { geos: P.geos(), L, hw, top, tx, tw };
  });
}
function wheelAssembly(parent, mats, { L, tx, tw, wr = 0.4, n = 7, y = 0.5, zF, zR }) {
  const zs = []; const z0 = zR + 0.3, z1 = zF - 1.1; for (let i = 0; i < n; i++) zs.push(lerp(z1, z0, i / (n - 1)));
  const rubber = cyl(wr, wr, 0.3, 20).rotateZ(Math.PI / 2), hub = cyl(wr * 0.62, wr * 0.62, 0.36, 12).rotateZ(Math.PI / 2); const bolts = cyl(0.05, 0.05, 0.4, 6).rotateZ(Math.PI / 2);
  const geoR = norm(rubber), geoH = norm(hub);
  const slots = []; for (const sx of [1, -1]) for (const z of zs) slots.push({ x: sx * tx, y, z, r: wr });
  slots.push({ x: tx, y: 0.7, z: zF - 0.35, r: 0.5, spr: true }, { x: -tx, y: 0.7, z: zF - 0.35, r: 0.5, spr: true }, { x: tx, y: 0.78, z: zR + 0.25, r: 0.42 }, { x: -tx, y: 0.78, z: zR + 0.25, r: 0.42 });
  const mR = new THREE.InstancedMesh(geoR, mats.rubber, slots.length), mH = new THREE.InstancedMesh(geoH, mats.rim, slots.length); mR.castShadow = true; mR.frustumCulled = false; mH.frustumCulled = false; mR.name = 'roadwheels'; mH.name = 'roadwheels_hub';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const set = (travelL, travelR) => { slots.forEach((s, i) => { const spin = (s.x > 0 ? travelR : travelL) / s.r; q.setFromEuler(e.set(spin, 0, 0)); sc.set(1, s.r / wr, s.r / wr); m4.compose(v.set(s.x, s.y, s.z), q, sc); mR.setMatrixAt(i, m4); sc.set(1, 1, 1).multiplyScalar(s.r / wr); sc.x = 1; m4.compose(v, q, sc); mH.setMatrixAt(i, m4); }); mR.instanceMatrix.needsUpdate = true; mH.instanceMatrix.needsUpdate = true; };
  set(0, 0); parent.add(mR, mH); return { set, mR, mH };
}
function buildTracked(kind, o, turretBuilder) {
  const rng = new RNG((o.seed ?? 1) * 31 + 7); const mats = milMats(o.color || 'olive', { camo: o.camo !== false, dirt: o.dirt ?? 0.3 });
  const G = trackedGeo(kind); const root = new THREE.Group(); root.name = kind; const chassis = new THREE.Group(); root.add(chassis);
  chassis.add(assemble(G.geos, mats));
  const tt = trackTex(); const beltMats = []; const belts = [];
  for (const sx of [1, -1]) {
    const tex = tt.clone(); tex.needsUpdate = true; tex.userData.shared = false; const bm = mk.flat(0xffffff, { map: tex, rough: 0.8, metal: 0.4, normalMap: TX.hammered(), normalScale: 0.6 }); beltMats.push(bm);
    const belt = new THREE.Mesh(trackBelt({ zF: G.L / 2 - 0.35, zR: -G.L / 2 + 0.3, y: 0.62, r: 0.62, width: G.tw, padLen: 0.2 }), bm); belt.position.x = sx * G.tx; belt.castShadow = true; chassis.add(belt); belts.push(belt);
  }
  const wa = wheelAssembly(chassis, mats, { L: G.L, tx: G.tx, tw: G.tw, zF: G.L / 2, zR: -G.L / 2, n: kind === 'tank' ? 7 : 6 });
  const T = turretBuilder(mats, G, o, chassis); // returns { turret, gun, barrel, muzzle:Object3D, flash, update(dt,t,S) , anchors }
  const st = { yaw: 0, elev: 0.02, yawT: 0, elevT: 0.02, fireT: -9, travelL: 0, travelR: 0, turn: 0 };
  const anchors = { driver: seatAnch(-0.62, 1.0, G.L / 2 - 1.5, 0), ...T.anchors, muzzle: { pos: [0, G.top + 0.9, G.L / 2 + 2.2], dir: [0, 0, 1] }, hull: { pos: [0, G.top, 0], yaw: 0 }, exitDoor: { pos: [2.2, 0, -0.5], yaw: -Math.PI / 2 } };
  const lights = lightsOf(mats);
  const api = makeVehicle({
    kind, root, chassis, wheels: [], lights, glass: [mats.glass], anchors, seed: o.seed ?? 1, bobAmp: 0.35, pitchK: 0.5, rollK: 0.3, smokeAt: [0, G.top + 0.6, -G.L / 2 + 1.0],
    bounds: { length: G.L + 2.6, width: 3.6, height: G.top + 1.0 },
    onUpdate(dt, t, S) {
      const dP = S.v * dt * (1 - S.steerSm * 0.9), dN = S.v * dt * (1 + S.steerSm * 0.9); st.travelR += dP; st.travelL += dN; // +x side (R) is the inner track when turning toward +x
      wa.set(st.travelL, st.travelR); beltMats[0].map.offset.x = -st.travelR / 0.8; beltMats[1].map.offset.x = -st.travelL / 0.8;
      st.yaw = damp(st.yaw, st.yawT, 3.5, dt); st.elev = damp(st.elev, st.elevT, 4, dt);
      T.update(dt, t, S, st);
    },
  });
  api.mats = mats; api.setTurret = (yaw) => { st.yawT = yaw; }; api.setGun = (e) => { st.elevT = clamp(e, -0.12, 0.6); };
  api.turret = T.turret; api.gun = T.gun; api.state.t = st;
  api.getMuzzle = (outPos = V3(), outDir = V3()) => { T.muzzle.getWorldPosition(outPos); T.muzzle.getWorldDirection(outDir); return { pos: outPos, dir: outDir }; };
  const tmpP = V3(), tmpD = V3(), tmpL = V3();
  api.aimAt = (target) => { // world point -> turret yaw (relative to hull) + gun elevation
    root.updateMatrixWorld(true); tmpL.copy(target); root.worldToLocal(tmpL); const dx = tmpL.x, dz = tmpL.z; st.yawT = Math.atan2(dx, dz); const d = Math.hypot(dx, dz); st.elevT = clamp(Math.atan2(tmpL.y - (G.top + 0.9), d), -0.12, 0.6); };
  api.fire = () => { st.fireT = api.state.t ?? 0; st.fireT = T.now(); };
  api.crewSeats = anchors; api.isTracked = true; api.setInfection(0);
  return api;
}

// ───────────────────────────── MBT ─────────────────────────────
function tankTurret(mats, G, o, chassis) {
  const geo = cached(`mil:tankturret:${Q.detail}`, () => {
    const P = new Parts();
    const tur = loftZ({ z0: -1.7, z1: 1.55, n: 24, w: pw([[-1.7, 1.0], [-1.0, 1.3], [0.3, 1.45], [1.55, 0.78]]), yb: 0.0, yt: pw([[-1.7, 0.72], [-1.0, 0.82], [0.8, 0.84], [1.55, 0.62]]), p: 4, round: [0.3, 0.3], roundQ: 3, radial: 24 });
    P.add('paint', tur); P.add('paint', rbox(0.55, 0.62, 1.4, 0.05, 1), { pos: [1.0, 0.36, 0.95], rot: [0, 0.38, 0], mirror: true });
    P.add('paint', rbox(2.7, 0.55, 1.0, 0.05, 1), { pos: [0, 0.4, -2.0] }); P.add('dark', rbox(2.5, 0.06, 0.9, 0.02, 1), { pos: [0, 0.7, -2.0] }); for (let i = -4; i <= 4; i++) P.add('steel', rbox(0.04, 0.5, 0.92, 0.01, 1), { pos: [i * 0.28, 0.4, -2.03] });
    P.add('dark', cyl(0.38, 0.4, 0.22, 18), { pos: [-0.55, 0.9, -0.5] }); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P.add('glass', rbox(0.1, 0.07, 0.04, 0.01, 1), { pos: [-0.55 + Math.cos(a) * 0.39, 1.0, -0.5 + Math.sin(a) * 0.39], rot: [0, -a + Math.PI / 2, 0] }); }
    P.add('steel', cylZ(0.04, 0.04, 0.7, 8), { pos: [-0.55, 1.1, -0.1] }); P.add('dark', rbox(0.12, 0.1, 0.18, 0.02, 1), { pos: [-0.55, 1.08, -0.45] });
    P.add('dark', cyl(0.3, 0.3, 0.1, 14), { pos: [0.6, 0.9, -0.55] }); P.add('steel', cyl(0.26, 0.26, 0.04, 14), { pos: [0.6, 0.97, -0.55] });
    P.add('dark', rbox(0.35, 0.28, 0.4, 0.04, 1), { pos: [0.55, 0.82, 0.9] }); P.add('glass', rbox(0.2, 0.12, 0.03, 0.01, 1), { pos: [0.55, 0.82, 1.11] });
    for (const sx of [1, -1]) for (let i = 0; i < 4; i++) P.add('dark', cylZ(0.05, 0.05, 0.16, 8), { pos: [sx * 1.42, 0.52 + (i % 2) * 0.1, 0.1 - i * 0.12], rot: [0, sx * 0.4, 0] });
    P.add('dark', cyl(0.007, 0.007, 3.0, 4), { pos: [1.1, 2.1, -2.3] }); P.add('dark', cyl(0.007, 0.007, 2.3, 4), { pos: [-1.1, 1.8, -2.3] });
    P.add('dark', rbox(1.0, 0.7, 0.3, 0.06, 1), { pos: [0, 0.36, 1.58] }); // mantlet
    P.add('paint', rbox(0.8, 0.5, 0.1, 0.03, 1), { pos: [0, 0.1, -2.6], rot: [0, 0, 0] });
    P.add('decal', plane(0.55, 0.55).rotateY(Math.PI / 2), { pos: [1.452, 0.45, -0.1], mirror: true });
    return P.geos();
  });
  const turret = new THREE.Group(); turret.position.set(0, G.top + 0.02, -0.25); chassis.add(turret); turret.add(assemble(geo, mats));
  const gun = new THREE.Group(); gun.position.set(0, 0.36, 1.7); turret.add(gun);
  const gp = cached(`mil:tankgun:${Q.detail}`, () => { const P = new Parts(); P.add('steel', cylZ(0.17, 0.17, 0.5, 14), { pos: [0, 0, 0.1] }); P.add('paint2', cylZ(0.115, 0.115, 2.7, 16), { pos: [0, 0, 1.45] }); P.add('dark', cylZ(0.065, 0.062, 5.2, 14), { pos: [0, 0, 2.2] }); P.add('steel', cylZ(0.1, 0.1, 0.5, 14), { pos: [0, 0, 3.55] }); P.add('dark', cylZ(0.085, 0.085, 0.16, 12), { pos: [0, 0, 4.7] }); return P.geos(); });
  const barrel = new THREE.Group(); gun.add(barrel); barrel.add(assemble(gp, mats));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 4.85); barrel.add(muzzle); const flash = muzzleFlash(3.0); flash.position.set(0, 0, 0.6); muzzle.add(flash);
  const mg = new THREE.Group(); mg.position.set(-0.55, 1.15, -0.1);
  let clock = 0;
  return {
    turret, gun, muzzle, now: () => clock, anchors: { commander: seatAnch(-0.55, 0.3 + G.top, -0.55, 0, 0.5), loader: seatAnch(0.6, 0.3 + G.top, -0.55, 0, 0.5) },
    update(dt, t, S, st) { clock = t; turret.rotation.y = st.yaw; gun.rotation.x = -st.elev; const k = t - st.fireT; const rec = k >= 0 && k < 1.5 ? Math.exp(-k * 7) * Math.cos(k * 14) * 0.5 + (Math.exp(-k * 3) * 0) : 0; barrel.position.z = -Math.max(0, rec) - Math.min(0, rec) * 0.0; flash.userData.set(k >= 0 && k < 0.12 ? 1 - k / 0.12 : 0); turret.position.z = -0.25 - Math.max(0, rec) * 0.04; },
  };
}
export function createTank(opts = {}) { return buildTracked('tank', opts, tankTurret); }

// ───────────────────────────── SPAAG ─────────────────────────────
function aaTurret(mats, G, o, chassis) {
  const geo = cached(`mil:aaturret:${Q.detail}`, () => {
    const P = new Parts(); const tur = loftZ({ z0: -1.5, z1: 1.3, n: 16, w: pw([[-1.5, 1.2], [0, 1.45], [1.3, 1.2]]), yb: 0, yt: pw([[-1.5, 0.9], [0, 1.05], [1.3, 0.85]]), p: 5, round: [0.2, 0.2], radial: 20 });
    P.add('paint', tur); for (const sx of [1, -1]) { P.add('paint', rbox(0.7, 0.8, 1.6, 0.05, 1), { pos: [sx * 1.0, 0.55, 0.0] }); P.add('dark', cylZ(0.14, 0.16, 0.7, 12), { pos: [sx * 1.0, 0.65, 1.1] }); }
    P.add('dark', cyl(0.45, 0.45, 0.3, 16), { pos: [0, 1.15, -0.2] }); P.add('steel', cyl(0.12, 0.12, 0.7, 10), { pos: [0, 1.6, -0.2] });
    P.add('dark', rbox(0.4, 0.4, 0.5, 0.05, 1), { pos: [0, 0.95, 1.05] }); P.add('glass', rbox(0.2, 0.18, 0.03, 0.01, 1), { pos: [0, 0.95, 1.32] });
    return P.geos();
  });
  const turret = new THREE.Group(); turret.position.set(0, G.top + 0.02, -0.3); chassis.add(turret); turret.add(assemble(geo, mats));
  const guns = new THREE.Group(); guns.position.set(0, 0.7, 1.2); turret.add(guns); const gp = cached('mil:aaguns', () => { const P = new Parts(); for (const sx of [1, -1]) { P.add('dark', cylZ(0.05, 0.05, 3.0, 10), { pos: [sx * 1.0, 0, 1.6] }); P.add('steel', cylZ(0.075, 0.075, 0.5, 10), { pos: [sx * 1.0, 0, 3.0] }); P.add('steel', cylZ(0.12, 0.12, 0.9, 10), { pos: [sx * 1.0, 0, 0.4] }); } return P.geos(); }); guns.add(assemble(gp, mats));
  // radars: rotating search dish (top-rear) + tracking dome (front)
  const dishG = new THREE.Group(); dishG.position.set(0, 2.1, -0.9); turret.add(dishG); const dishGeo = new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, 1.0); dishGeo.scale(1.0, 0.35, 0.6); dishGeo.rotateX(Math.PI / 2); const dish = new THREE.Mesh(dishGeo, mats.paint2); dish.material.side = THREE.DoubleSide; dish.position.set(0, 0.3, 0.0); dish.rotation.x = 0; dishG.add(dish); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8), mats.dark); mast.position.y = -0.1; dishG.add(mast);
  const feed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), mats.steel); feed.position.set(0, 0.55, 0.0); dishG.add(feed);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 3.3); guns.add(muzzle); const flash = muzzleFlash(1.8); muzzle.add(flash); let clock = 0;
  return { turret, gun: guns, muzzle, now: () => clock, anchors: { gunner: seatAnch(0, G.top + 0.2, -0.3, 0, 0.5) },
    update(dt, t, S, st) { clock = t; turret.rotation.y = st.yaw; guns.rotation.x = -st.elev; dishG.rotation.y = t * 3.2; const k = t - st.fireT; flash.userData.set(k >= 0 && k < 0.2 ? (Math.sin(k * 120) > 0 ? 1 : 0.4) * (1 - k / 0.2) : 0); } };
}
export function createAntiAir(opts = {}) { return buildTracked('spaag', opts, aaTurret); }

// ───────────────────────────── self-propelled howitzer ─────────────────────────────
function sphTurret(mats, G, o, chassis) {
  const geo = cached(`mil:sphturret:${Q.detail}`, () => {
    const P = new Parts(); const tur = loftZ({ z0: -2.0, z1: 1.9, n: 20, w: pw([[-2.0, 1.45], [-1.0, 1.65], [1.0, 1.65], [1.9, 1.3]]), yb: 0, yt: pw([[-2.0, 1.15], [0, 1.25], [1.9, 1.0]]), p: 5, round: [0.3, 0.3], radial: 24 });
    P.add('paint', tur); P.add('dark', cyl(0.4, 0.42, 0.25, 16), { pos: [0.8, 1.3, -0.6] }); P.add('dark', rbox(2.4, 0.5, 0.5, 0.06, 1), { pos: [0, 0.5, -2.2] });
    P.add('dark', rbox(1.1, 0.8, 0.4, 0.06, 1), { pos: [0, 0.5, 1.95] }); return P.geos();
  });
  const turret = new THREE.Group(); turret.position.set(0, G.top + 0.02, 0.0); chassis.add(turret); turret.add(assemble(geo, mats));
  const gun = new THREE.Group(); gun.position.set(0, 0.55, 2.0); turret.add(gun);
  const gp = cached('mil:sphgun', () => { const P = new Parts(); P.add('steel', cylZ(0.22, 0.22, 0.7, 14), { pos: [0, 0, 0.2] }); P.add('paint2', cylZ(0.13, 0.13, 3.0, 14), { pos: [0, 0, 1.8] }); P.add('dark', cylZ(0.075, 0.075, 4.2, 12), { pos: [0, 0, 3.4] }); P.add('steel', cylZ(0.13, 0.13, 0.7, 12), { pos: [0, 0, 5.3] }); P.add('dark', cylZ(0.1, 0.1, 0.2, 12), { pos: [0, 0, 5.6] }); return P.geos(); });
  const barrel = new THREE.Group(); gun.add(barrel); barrel.add(assemble(gp, mats)); const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 5.75); barrel.add(muzzle); const flash = muzzleFlash(3.4); muzzle.add(flash); let clock = 0;
  return { turret, gun, muzzle, now: () => clock, anchors: { commander: seatAnch(0.8, G.top + 0.45, -0.6, 0, 0.5) },
    update(dt, t, S, st) { clock = t; turret.rotation.y = st.yaw; gun.rotation.x = -st.elev; const k = t - st.fireT; const rec = k >= 0 && k < 2 ? Math.exp(-k * 6) * Math.cos(k * 12) * 0.6 : 0; barrel.position.z = -Math.max(0, rec); flash.userData.set(k >= 0 && k < 0.15 ? 1 - k / 0.15 : 0); } };
}
export function createHowitzer(opts = {}) { return buildTracked('sph', { elev: 0.5, ...opts }, sphTurret); }

// ───────────────────────────── wheeled vehicles ─────────────────────────────
function wheeled({ kind, mats, root, chassis, axles, wr, tw, rim, style = 'truck', track, steerAxles = [0], dual = 0 }) {
  const wg = wheelGeos({ r: wr, w: tw, rim, style, detail: 1 }); const wheels = [];
  axles.forEach((z, ai) => { for (const sx of [-1, 1]) { const st = steerAxles.includes(ai); wheels.push(addWheel(root, wg, mats, { x: sx * track, y: wr, z, r: wr, side: sx, steerable: st })); if (dual) wheels.push(addWheel(root, wg, mats, { x: sx * (track - dual), y: wr, z, r: wr, side: sx })); } });
  return wheels;
}
export function createHumvee(opts = {}) {
  const mats = milMats(opts.color || 'desert', { camo: opts.camo === true, dirt: opts.dirt ?? 0.3 }); const root = new THREE.Group(); root.name = 'humvee'; const chassis = new THREE.Group(); root.add(chassis);
  const geo = cached(`mil:humvee:${Q.detail}`, () => {
    const P = new Parts(); const L = 4.6;
    P.add('paint', loftZ({ z0: -L / 2, z1: L / 2, n: 24, w: 0.92, wt: 1.0, yb: 0.55, yt: pw([[-L / 2, 1.25], [-0.5, 1.25], [0.5, 1.22], [1.2, 1.15], [L / 2, 1.05]]), p: 6, round: [0.15, 0.3], radial: 20 }));
    P.add('paint', rbox(1.95, 0.8, 2.3, 0.08, 1), { pos: [0, 1.65, -0.7] }); // cab / troop shell
    P.add('paint', rbox(1.9, 0.12, 1.2, 0.05, 1), { pos: [0, 1.28, 1.35], rot: [0.06, 0, 0] }); // hood
    P.add('glass', rbox(1.7, 0.5, 0.06, 0.02, 1), { pos: [0, 1.62, 0.52], rot: [-0.25, 0, 0] }); for (const sx of [1, -1]) P.add('glass', rbox(0.06, 0.45, 1.0, 0.02, 1), { pos: [sx * 0.99, 1.62, 0.0] }), P.add('glass', rbox(0.06, 0.4, 0.9, 0.02, 1), { pos: [sx * 0.99, 1.65, -1.0] });
    for (const sx of [1, -1]) { P.add('paint', rbox(0.5, 0.3, 1.3, 0.05, 1), { pos: [sx * 0.95, 0.95, 1.5] }); P.add('lampHead', rbox(0.18, 0.13, 0.06, 0.02, 1), { pos: [sx * 0.7, 1.05, 2.3] }); P.add('lampTail', rbox(0.1, 0.18, 0.05, 0.02, 1), { pos: [sx * 0.9, 1.15, -2.32] }); P.add('steel', rbox(0.1, 0.3, 0.05, 0.02, 1), { pos: [sx * 1.04, 1.5, 0.55] }); }
    P.add('dark', rbox(1.5, 0.12, 0.2, 0.04, 1), { pos: [0, 0.62, 2.3] }); P.add('dark', rbox(1.2, 0.2, 0.08, 0.03, 1), { pos: [0, 1.0, 2.3] }); for (let i = -3; i <= 3; i++) P.add('steel', rbox(0.025, 0.18, 0.04, 0.005, 1), { pos: [i * 0.13, 1.0, 2.34] });
    P.add('dark', rbox(0.9, 0.5, 0.5, 0.06, 1), { pos: [0, 1.5, -2.0] }); P.add('dark', cyl(0.46, 0.46, 0.08, 18), { pos: [0, 2.05, -0.8] }); // roof ring
    P.add('dark', rbox(0.5, 0.25, 0.35, 0.04, 1), { pos: [0.5, 0.65, -2.2] });
    P.add('plate', plane(0.4, 0.2).rotateY(Math.PI), { pos: [0, 0.9, -2.33] });
    return P.geos();
  });
  mats.plate = mk.flat(0xffffff, { map: plateTex('13-5524', 'mil'), rough: 0.6 }); chassis.add(assemble(geo, mats));
  const wheels = wheeled({ kind: 'humvee', mats, root, chassis, axles: [1.45, -1.45], wr: 0.4, tw: 0.3, rim: 0.24, track: 0.98, steerAxles: [0] });
  // roof gun
  const ring = new THREE.Group(); ring.position.set(0, 2.1, -0.8); chassis.add(ring); const mgp = new THREE.Group(); mgp.position.y = 0.2; ring.add(mgp);
  const gm = [[0.12, 0.2, 0.9, 0, 0.0, 0.1, 'dark'], [0.05, 0.05, 1.1, 0, 0.0, 0.9, 'steel'], [0.4, 0.34, 0.3, 0, -0.05, -0.1, 'dark']]; for (const [w, h, d, x, y, z, k] of gm) { const m = new THREE.Mesh(rbox(w, h, d, 0.02, 1), mats[k]); m.position.set(x, y, z); mgp.add(m); } const shield = new THREE.Mesh(rbox(1.0, 0.7, 0.05, 0.02, 1), mats.paint2); shield.position.set(0, 0.2, 0.5); ring.add(shield);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.5); mgp.add(muzzle); const flash = muzzleFlash(0.9); muzzle.add(flash);
  const S2 = { yaw: 0, pit: 0, fireT: -9 };
  const anchors = { driverSeat: seatAnch(-0.45, 0.72, 0.15, 0, 0.45), passengerSeats: [seatAnch(0.45, 0.72, 0.15), seatAnch(-0.45, 0.72, -0.9), seatAnch(0.45, 0.72, -0.9)], gunner: seatAnch(0, 1.35, -0.8, 0, 0.5), exitDoor: { pos: [-1.6, 0, 0.1], yaw: Math.PI / 2 }, muzzle: { pos: [0, 2.4, 0.7], dir: [0, 0, 1] } };
  const api = makeVehicle({ kind: 'humvee', root, chassis, wheels, lights: lightsOf(mats), glass: [mats.glass], anchors, seed: opts.seed ?? 1, bobAmp: 1.2, smokeAt: [0, 1.4, 1.5], bounds: { length: 4.6, width: 2.15, height: 2.5 }, onUpdate(dt, t) { ring.rotation.y = S2.yaw; mgp.rotation.x = -S2.pit; const k = t - S2.fireT; flash.userData.set(k >= 0 && k < 0.1 ? (Math.sin(k * 150) > 0 ? 1 : 0.3) : 0); } });
  api.mats = mats; api.setGun = (yaw, pit = 0) => { S2.yaw = yaw; S2.pit = pit; }; api.fire = () => { S2.fireT = api.state.t ?? 0; }; api.aimGun = api.setGun; api.update(0, 0); return api;
}
export function createAPC(opts = {}) {
  const mats = milMats(opts.color || 'olive', { camo: opts.camo !== false, dirt: opts.dirt ?? 0.3 }); const root = new THREE.Group(); root.name = 'apc'; const chassis = new THREE.Group(); root.add(chassis);
  const L = 7.0;
  const geo = cached(`mil:apc:${Q.detail}`, () => {
    const P = new Parts();
    P.add('paint', loftZ({ z0: -L / 2, z1: L / 2, n: 30, w: 1.25, wt: 1.4, yb: 0.62, yt: pw([[-L / 2, 2.35], [-L / 2 + 0.3, 2.45], [1.0, 2.45], [2.4, 2.05], [L / 2, 1.3]]), p: 6, round: [0.15, 0.4], roundY: 0.05, radial: 24 }));
    for (const sx of [1, -1]) { for (let i = 0; i < 14; i++) P.add('dark', rbox(0.04, 1.0, 0.07, 0.01, 1), { pos: [sx * 1.52, 1.25, -3.1 + i * 0.4] }); P.add('dark', rbox(0.06, 0.05, 5.6, 0.01, 1), { pos: [sx * 1.52, 1.78, -0.3] }); P.add('dark', rbox(0.06, 0.05, 5.6, 0.01, 1), { pos: [sx * 1.52, 0.78, -0.3] }); }
    P.add('glass', rbox(0.8, 0.28, 0.05, 0.02, 1), { pos: [-0.4, 1.95, 3.0], rot: [-0.55, 0, 0] }); P.add('dark', rbox(0.9, 0.5, 0.1, 0.02, 1), { pos: [-0.4, 1.85, 3.02], rot: [-0.55, 0, 0] });
    P.add('dark', rbox(1.4, 0.7, 0.1, 0.04, 1), { pos: [0, 1.4, -L / 2 - 0.02] }); P.add('steel', rbox(0.05, 0.6, 0.04, 0.01, 1), { pos: [0, 1.4, -L / 2 - 0.08] });
    for (const sx of [1, -1]) { P.add('lampHead', rbox(0.2, 0.14, 0.06, 0.02, 1), { pos: [sx * 1.0, 1.25, L / 2 + 0.0] }); P.add('lampTail', rbox(0.14, 0.2, 0.05, 0.02, 1), { pos: [sx * 1.3, 1.2, -L / 2 - 0.03] }); P.add('steel', cyl(0.05, 0.05, 0.9, 8), { pos: [sx * 1.5, 2.35, -1.0], rot: [Math.PI / 2, 0, 0] }); }
    P.add('dark', rbox(2.4, 0.15, 0.3, 0.05, 1), { pos: [0, 0.75, L / 2 + 0.1] }); P.add('decal', plane(0.7, 0.7).rotateY(Math.PI / 2), { pos: [1.405, 1.6, 0.4], mirror: true });
    return P.geos();
  });
  chassis.add(assemble(geo, mats));
  const wheels = wheeled({ kind: 'apc', mats, root, chassis, axles: [2.5, 1.2, -1.2, -2.5], wr: 0.52, tw: 0.35, rim: 0.3, track: 1.15, steerAxles: [0, 1] });
  const tur = new THREE.Group(); tur.position.set(0.3, 2.45, -0.2); chassis.add(tur); const tgeo = cached('mil:apcturret', () => { const P = new Parts(); P.add('paint', rbox(1.2, 0.5, 1.5, 0.12, 2), { pos: [0, 0.25, 0] }); P.add('dark', rbox(0.5, 0.35, 0.8, 0.06, 1), { pos: [0.55, 0.4, 0.3] }); P.add('glass', rbox(0.2, 0.15, 0.04, 0.01, 1), { pos: [-0.2, 0.45, 0.76] }); P.add('dark', rbox(0.4, 0.4, 0.4, 0.05, 1), { pos: [-0.5, 0.2, -0.8] }); return P.geos(); }); tur.add(assemble(tgeo, mats));
  const gun = new THREE.Group(); gun.position.set(-0.1, 0.35, 0.75); tur.add(gun); const gm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 10).rotateX(Math.PI / 2), mats.dark); gm.position.z = 1.0; gun.add(gm); const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10).rotateX(Math.PI / 2), mats.steel); bore.position.z = 0.35; gun.add(bore);
  const muzzle = new THREE.Object3D(); muzzle.position.z = 2.05; gun.add(muzzle); const flash = muzzleFlash(1.4); muzzle.add(flash); const S2 = { yaw: 0, pit: 0, fireT: -9 };
  const anchors = { driverSeat: seatAnch(-0.6, 1.0, 2.6, 0, 0.45), passengerSeats: Array.from({ length: 8 }, (_, i) => seatAnch((i % 2 ? 1 : -1) * 0.9, 0.95, 1.0 - Math.floor(i / 2) * 0.9, i % 2 ? -Math.PI / 2 : Math.PI / 2, 0.45)), gunner: seatAnch(0.3, 1.9, -0.2, 0, 0.5), exitDoor: { pos: [0, 0, -L / 2 - 1.2], yaw: Math.PI }, muzzle: { pos: [0.2, 2.9, 2.0], dir: [0, 0, 1] } };
  const api = makeVehicle({ kind: 'apc', root, chassis, wheels, lights: lightsOf(mats), glass: [mats.glass], anchors, seed: opts.seed ?? 1, bobAmp: 0.9, smokeAt: [0, 2.5, 1.5], bounds: { length: 7.6, width: 3.0, height: 3.0 }, onUpdate(dt, t) { tur.rotation.y = S2.yaw; gun.rotation.x = -S2.pit; const k = t - S2.fireT; flash.userData.set(k >= 0 && k < 0.1 ? (Math.sin(k * 150) > 0 ? 1 : 0.3) : 0); } });
  api.mats = mats; api.setTurret = (yaw, pit = 0) => { S2.yaw = yaw; S2.pit = pit; }; api.fire = () => { S2.fireT = api.state.t ?? 0; }; api.update(0, 0); return api;
}

// ───────────────────────────── launchers ─────────────────────────────
function truckBase(mats, root, chassis, { len = 9, cabZ = 3.0, wr = 0.55, axles, steer = [0], color }) {
  const geo = cached(`mil:truckcab:${Q.detail}`, () => {
    const P = new Parts();
    P.add('paint', rbox(2.5, 1.6, 2.1, 0.12, 2), { pos: [0, 1.9, 0] }); P.add('paint', rbox(2.4, 0.9, 1.3, 0.1, 2), { pos: [0, 1.25, 1.55] }); // cab + hood
    P.add('glass', rbox(2.2, 0.75, 0.06, 0.02, 1), { pos: [0, 2.15, 1.05], rot: [-0.12, 0, 0] }); for (const sx of [1, -1]) { P.add('glass', rbox(0.06, 0.65, 1.0, 0.02, 1), { pos: [sx * 1.255, 2.1, 0.2] }); P.add('steel', rbox(0.12, 0.45, 0.06, 0.02, 1), { pos: [sx * 1.4, 2.3, 1.1] }); P.add('lampHead', rbox(0.34, 0.2, 0.06, 0.04, 1), { pos: [sx * 0.85, 1.2, 2.2] }); }
    P.add('dark', rbox(1.4, 0.55, 0.08, 0.03, 1), { pos: [0, 1.25, 2.22] }); for (let i = -5; i <= 5; i++) P.add('steel', rbox(0.03, 0.5, 0.03, 0.005, 1), { pos: [i * 0.12, 1.25, 2.26] }); P.add('dark', rbox(2.6, 0.22, 0.3, 0.06, 1), { pos: [0, 0.55, 2.2] });
    P.add('dark', rbox(0.9, 0.2, 7.0, 0.03, 1), { pos: [0.55, 0.78, -3.0], mirror: true }); P.add('dark', rbox(2.4, 0.2, 0.2, 0.03, 1), { pos: [0, 0.8, -6.7] });
    P.add('dark', cylZ(0.06, 0.06, 2.2, 8), { pos: [1.35, 2.4, -1.35], rot: [0, 0, 0] });
    P.add('dark', rbox(2.5, 0.12, 5.8, 0.04, 1), { pos: [0, 1.1, -3.6] });
    return P.geos();
  });
  chassis.add(assemble(geo, mats));
  return wheeled({ kind: 'truck', mats, root, chassis, axles, wr, tw: 0.4, rim: 0.34, track: 1.05, steerAxles: steer });
}
function launcherCommon(kind, opts, build) {
  const mats = milMats(opts.color || 'olive', { camo: opts.camo !== false, dirt: opts.dirt ?? 0.3 }); const root = new THREE.Group(); root.name = kind; const chassis = new THREE.Group(); root.add(chassis);
  const ext = build(mats, root, chassis, opts);
  const anchors = { driverSeat: seatAnch(-0.6, 1.2, 2.6 + (ext.cabShift || 0), 0, 0.45), passengerSeats: [seatAnch(0.6, 1.2, 2.6 + (ext.cabShift || 0))], exitDoor: { pos: [-2.0, 0, 2.6 + (ext.cabShift || 0)], yaw: Math.PI / 2 }, muzzle: ext.muzzle || null, ...ext.anchors };
  const api = makeVehicle({ kind, root, chassis, wheels: ext.wheels, lights: lightsOf(mats), glass: [mats.glass], anchors, seed: opts.seed ?? 1, bobAmp: 0.8, smokeAt: [0, 2.6, 3.6], bounds: ext.bounds, onUpdate: ext.update });
  api.mats = mats; Object.assign(api, ext.api(api)); api.update(0, 0); return api;
}
function launchBox(mats, tubes, w, h, d) { const g = new THREE.Group(); const body = new THREE.Mesh(rbox(w, h, d, 0.06, 1), mats.paint); g.add(body); body.castShadow = true; const cols = tubes.cols, rows = tubes.rows; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = (c - (cols - 1) / 2) * (w * 0.8 / cols), y = (r - (rows - 1) / 2) * (h * 0.8 / rows); const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.4 / cols, w * 0.4 / cols, 0.06, 14).rotateX(Math.PI / 2), mats.dark); cap.position.set(x, y, d / 2 + 0.01); g.add(cap); const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.4 / cols, 0.02, 5, 14), mats.steel); ring.position.set(x, y, d / 2 + 0.03); g.add(ring); } return g; }
export function createLauncher(kind = 'himars', opts = {}) {
  if (kind === 'tel') return createTEL(opts);
  if (kind === 'patriot') return launcherCommon('patriot', opts, (mats, root, chassis, o) => {
    const wheels = truckBase(mats, root, chassis, { axles: [3.5, -0.4, -1.8, -3.2], wr: 0.55, steer: [0, 1] });
    const pivot = new THREE.Group(); pivot.position.set(0, 1.5, -5.6); chassis.add(pivot); // rear hinge
    const box = new THREE.Group(); pivot.add(box); box.position.set(0, 0.65, 3.3); const pods = new THREE.Mesh(rbox(2.6, 1.5, 6.6, 0.08, 1), mats.paint); box.add(pods); const cans = cached('mil:patcans', () => { const P = new Parts(); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) P.add('paint2', rbox(1.1, 0.6, 6.4, 0.05, 1), { pos: [(i - 0.5) * 1.2, (j - 0.5) * 0.7, 0] }); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) P.add('dark', rbox(1.0, 0.5, 0.1, 0.04, 1), { pos: [(i - 0.5) * 1.2, (j - 0.5) * 0.7, 3.2] }); return P.geos(); }); const cm = assemble(cans, mats); cm.position.y = 0.0; box.add(cm); for (const sx of [1, -1]) { const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), mats.steel); jack.position.set(sx * 1.4, 0.5, -6.6); chassis.add(jack); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), mats.dark); pad.position.set(sx * 1.4, 0.03, -6.6); chassis.add(pad); }
    const S2 = { el: 0, tgt: 0 }; return { wheels, cabShift: 0, bounds: { length: 12, width: 2.9, height: 3.4 }, muzzle: null, update(dt) { S2.el = damp(S2.el, S2.tgt, 2.2, dt); pivot.rotation.x = -S2.el; }, api: () => ({ setElevation(a) { S2.tgt = clamp(a, 0, 1.25); S2.el = S2.tgt; pivot.rotation.x = -S2.el; }, raise(a) { S2.tgt = clamp(a, 0, 1) * 0.67; }, launch() { } }) };
  });
  return launcherCommon('himars', opts, (mats, root, chassis, o) => {
    const wheels = truckBase(mats, root, chassis, { axles: [3.4, -0.5, -2.1], wr: 0.55, steer: [0] });
    const pivot = new THREE.Group(); pivot.position.set(0, 1.9, -5.0); chassis.add(pivot); const bx = launchBox(mats, { cols: 3, rows: 2 }, 2.2, 1.1, 3.6); bx.position.set(0, 0.5, 1.6); pivot.add(bx);
    const S2 = { el: 0, tgt: 0, fireT: -9 }; const flash = muzzleFlash(2.5); flash.position.set(0, 0.3, 3.6); pivot.add(flash); const base = new THREE.Mesh(rbox(2.4, 0.5, 3.2, 0.06, 1), mats.dark); base.position.set(0, 1.2, -3.8); chassis.add(base);
    const pivRot = new THREE.Group(); // allow azimuth
    return { wheels, bounds: { length: 10.5, width: 2.5, height: 3.2 }, muzzle: { pos: [0, 3.6, -4.0], dir: [0, 0.7, 0.7] }, update(dt, t) { S2.el = damp(S2.el, S2.tgt, 2.5, dt); pivot.rotation.x = -S2.el; const k = t - S2.fireT; flash.userData.set(k >= 0 && k < 0.5 ? Math.exp(-k * 8) : 0); }, api: (a) => ({ setElevation(e) { S2.tgt = clamp(e, 0, 1.3); S2.el = S2.tgt; pivot.rotation.x = -S2.el; }, raise(x) { S2.tgt = clamp(x, 0, 1) * 1.1; }, fire() { S2.fireT = a.state.t ?? 0; } }) };
  });
}
function createTEL(opts) {
  return launcherCommon('tel', opts, (mats, root, chassis, o) => {
    const wheels = truckBase(mats, root, chassis, { axles: [3.8, 1.8, -2.4, -4.4], wr: 0.7, steer: [0, 1], color: o.color });
    const frame = new THREE.Mesh(rbox(2.4, 0.4, 13, 0.06, 1), mats.dark); frame.position.set(0, 1.5, -2.3); chassis.add(frame);
    const pivot = new THREE.Group(); pivot.position.set(0, 2.0, -7.6); chassis.add(pivot);
    const can = new THREE.Group(); pivot.add(can); const missile = createMissile('icbm', { scale: 1 }); missile.root.rotation.x = 0; missile.root.position.set(0, 0.0, 1.0); missile.root.rotation.set(Math.PI / 2, 0, 0); can.add(missile.root);
    const canGeo = new THREE.CylinderGeometry(1.15, 1.15, 17.5, 28, 1, true).rotateX(Math.PI / 2); const canMesh = new THREE.Mesh(canGeo, mats.paint); canMesh.material.side = THREE.DoubleSide; canMesh.position.z = 9.4; can.add(canMesh);
    const rear = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), mats.dark); rear.position.z = 0.65; rear.rotation.y = Math.PI; can.add(rear);
    const cap = new THREE.Group(); cap.position.set(0, 0, 18.15); can.add(cap); const capMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 10, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), mats.paint2); cap.add(capMesh); cap.position.set(0, 0, 18.15);
    for (const sx of [1, -1]) for (let i = 0; i < 3; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.04, 5, 24), mats.steel); band.position.z = 4 + i * 5.5; can.add(band); }
    const jacks = []; for (const sx of [1, -1]) for (const z of [-8.6, -1.5]) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 8), mats.steel); j.position.set(sx * 1.45, 1.2, z); chassis.add(j); const pd = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), mats.dark); pd.position.y = -0.75; j.add(pd); jacks.push(j); }
    const S2 = { raise: 0, ej: 0, cap: 0 };
    const apply = () => { pivot.rotation.x = -S2.raise * Math.PI / 2 * 0.985; cap.rotation.x = -S2.cap * 1.7; cap.position.y = S2.cap * 0.0; const ext = S2.raise; for (const j of jacks) j.scale.y = 1 + ext * 0.2; missile.root.position.z = 1.0 + S2.ej * 20; };
    return { wheels, cabShift: 0, bounds: { length: 20, width: 3.0, height: 4.2 }, muzzle: null, missile, update(dt) { apply(); missile.update(dt, 0); }, anchors: {}, api: (a) => ({ missile, setRaise(x) { S2.raise = clamp(x, 0, 1); apply(); }, raise(x) { S2.raise = clamp(x, 0, 1); apply(); }, setCap(x) { S2.cap = clamp(x, 0, 1); apply(); }, eject(x) { S2.ej = clamp(x, 0, 1); apply(); }, hideMissile(v) { missile.root.visible = !v; } }) };
  });
}
