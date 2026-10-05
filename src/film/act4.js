// ACT IV — THE LONG DAWN (15:00–30:00). Crash landings, the last plan, the wreck, the tether, the cost, and the morning after.
import * as THREE from 'three';
import * as K from './kit.js';
import { space, R_E } from './space.js';
import { battle, mover, cnt } from './battle.js';
import { createCrowd } from '../models/crowd.js';
import { createCrawlerSwarm } from '../models/aliens/index.js';
import { createVessariCrowd } from '../models/aliens/index.js';
import { createPodSwarm, createBeams, createTripod, createCapitalShip, createMothership, createFleet } from '../models/alientech/index.js';
import * as Veh from '../models/vehicles.js';
import { createOcean } from '../world/ocean.js';
import { createTerrain } from '../world/terrain.js';
import { scatterVegetation } from '../world/vegetation.js';
import { clamp, lerp, smoothstep } from '../engine/common.js';
const { person, extra, alien, at, A, cover, indoors, place, nameCard, mood, COL, Life, Inst, City, safe, V3, RNG } = K;

// ---------------------------------------------------------------- helpers (local to Act IV)
const nr = (set, name, dx = 0, dz = 0, dy = 0) => { const a = A(set, name); return [a.p[0] + dx, a.p[1] + dy, a.p[2] + dz]; };
const radio = (o = {}) => ({ style: 'radio', color: COL.radio, ...o });
const link = (color, o = {}) => ({ style: 'radio', color, ...o });
const ai = (o = {}) => ({ style: 'ai', color: COL.ai, ...o });
const hold = (a, p, h) => { try { a.hold(p, h); } catch (e) { /* prop missing: ignore */ } return a; };
const infect = (a, v = 1, strain = 'cebu') => { try { a.model.setInfected(strain, v); } catch (e) { /* ignore */ } return a; };
const disc = (S, r = 2500, color = 0x2b2a29, y = -0.06) => { const g = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.y = y; g.receiveShadow = true; S.scene.add(g); return g; };
/** camera anchor of a set -> {pos, look} in world space (sets are never rotated here) */
const camAt = (set, name) => { const a = set.anchors && set.anchors[name]; const r = set.root ? set.root.position : { x: 0, y: 0, z: 0 }; if (!a) return { pos: [r.x, r.y + 1.6, r.z + 4], look: [r.x, r.y + 1.2, r.z] }; const p = a.pos || a; const l = a.look || [p[0] + Math.sin(a.yaw || 0) * 3, p[1], p[2] + Math.cos(a.yaw || 0) * 3]; return { pos: [p[0] + r.x, p[1] + r.y, p[2] + r.z], look: [l[0] + r.x, l[1] + r.y, l[2] + r.z] }; };
const camShot = (S, t0, t1, set, name, o = {}, tr = 'cut') => { const c = camAt(set, name); S.shot(t0, t1, { pos: c.pos, look: c.look, fov: 40, ...o }, tr); };
/** replace whatever shots overlap [t0,t1] by one inset shot (the remainder of the interrupted shots resumes after it) */
const inset = (S, t0, t1, spec, tr = 'cut') => { const out = []; for (const s of S.shots) { if (s.t1 <= t0 || s.t0 >= t1) out.push(s); else { if (s.t0 < t0) out.push({ ...s, t1: t0 }); if (s.t1 > t1) out.push({ ...s, t0: t1, transition: 'cut' }); } } out.push({ t0, t1, spec, transition: tr }); out.sort((a, b) => a.t0 - b.t0); S.shots = out; };
/** camera punch: hard-cut shake at time t inside the current shot (impacts, bangs) */
const punch = (S, t, amt = 0.7, decay = 2.4) => { const i = S.shots.findIndex((s) => s.t0 < t - 0.05 && s.t1 > t + 0.2); if (i < 0) return; const s = S.shots[i]; const spec = { ...s.spec, shake: amt, shakeDecay: decay }; delete spec._st; S.shots.splice(i, 1, { ...s, t1: t }, { t0: t, t1: s.t1, spec, transition: 'cut' }); };
const lt = (S, n0, k) => S.lines[n0 + k].t0; // start time of the k-th line of the last S.fit()
/** glowing branching bio-lattice (Vessari tether) — cyan, green when infected. Returns {group, light, set(k)} (k = brightness) */
function lattice(S, pos, o = {}) {
  const rng = new RNG(o.seed || 5), g = new THREE.Group(); g.position.set(...pos); const P = [], N = []; const L = o.len || 0.9, W = o.width || 0.3;
  for (let i = 0; i < 46; i++) { const z = (i / 45 - 0.5) * L; const s0 = new V3(0, 0, z); const s1 = new V3(0, 0, z + L / 45); P.push(s0, s1); for (const sd of [-1, 1]) { let p = s0.clone(); const n = 2 + (rng.next() * 3 | 0); for (let k = 0; k < n; k++) { const q = p.clone().add(new V3(sd * (0.02 + rng.next() * W / n), (rng.next() - 0.45) * 0.03, (rng.next() - 0.5) * 0.06)); P.push(p, q); p = q; if (k === n - 1) N.push(q); } } }
  const geo = new THREE.BufferGeometry().setFromPoints(P); const col = new THREE.Color(o.color ?? 0x66eaff).multiplyScalar(2.4);
  const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }); g.add(new THREE.LineSegments(geo, mat));
  const pg = new THREE.BufferGeometry().setFromPoints(N); const pm = new THREE.PointsMaterial({ color: col, size: 0.035, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }); g.add(new THREE.Points(pg, pm));
  const light = new THREE.PointLight(o.color ?? 0x66eaff, 0, 4.5, 2); light.position.set(0, 0.25, 0); g.add(light); S.scene.add(g); g.visible = false;
  return { group: g, light, set(k, t = 0) { g.visible = k > 0.01; mat.opacity = k * (0.78 + 0.22 * Math.sin(t * 5)); pm.opacity = k; light.intensity = 7 * k * (0.85 + 0.15 * Math.sin(t * 4)); }, setColor(c) { mat.color.set(c).multiplyScalar(2.4); pm.color.set(c).multiplyScalar(2.4); light.color.set(c); } };
}
/** desert relay mast (Mojave) */
function relayMast(S, x, z) {
  const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0xb9b9b0, metalness: 0.35, roughness: 0.6 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 34, 6), mat); l.position.set(Math.cos(a) * 1.3, 17, Math.sin(a) * 1.3); g.add(l); }
  for (let k = 0; k < 14; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.1), mat); r.position.set(0, 1.5 + k * 2.4, 0); r.rotation.y = (k % 2) * Math.PI / 2 + 0.78; g.add(r); }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mat); dish.position.set(2.2, 27, 0); dish.rotation.set(Math.PI / 2 + 0.5, 0.4, 0); g.add(dish);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2200, emissiveIntensity: 2 })); lamp.position.set(0, 34.4, 0); g.add(lamp);
  const shed = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 5), new THREE.MeshStandardMaterial({ color: 0xc9bfa8, roughness: 0.9 })); shed.position.set(-8, 1.5, -2); g.add(shed);
  g.position.set(x, 0, z); S.scene.add(g); return { group: g, lamp, setUplink(k) { lamp.material.emissive.setRGB(1 - k * 0.8, 0.13 + k * 0.87, 0.0); } };
}
/** tropical coast world: terrain (sea toward -Z by default) + ocean + palms. Returns {sky, terr, ocean} */
function coast(S, o = {}) {
  const sky = o.noSky ? S.sky : K.skyFor(S, o.sky || 'dawn', { elev: o.elev, az: o.az, smoke: o.smoke || 0, storm: o.storm || 0, shadowRadius: 130 }); S.camFar = 9000;
  const terr = safe('terrain', () => createTerrain({ style: 'tropical', size: 4200, layout: 'coast', seaAngle: o.seaAngle ?? Math.PI, shoreDistance: o.shore ?? 170, flatRadius: o.flat ?? 90, flatHeight: o.flatHeight ?? 0.6, seed: o.seed ?? 4, ring: o.ring ?? 0.5 }));
  if (terr) { S.add(terr); if (o.palms !== false) { const v = safe('palms', () => scatterVegetation(terr, 'coconut', o.palms || 90, { cx: o.pcx ?? 0, cz: o.pcz ?? 90, radius: o.pr ?? 110 }, (o.seed ?? 4) + 1, { minDist: 7, exclude: o.exclude || [{ x: 0, z: 0, r: 22 }] })); if (v) S.add(v); } }
  const ocean = safe('ocean', () => createOcean(terr ? { size: 9000, terrain: terr, seaLevel: terr.seaLevel } : { size: 9000, seaLevel: 0 })); if (ocean) S.add(ocean); S.sky && S.sky.update(0, 0);
  return { sky, terr, ocean };
}
/** the crashed dreadnought: hulk half-buried and burning, looming at (x,z). Returns {ship, root} */
function wreck(S, x, z, o = {}) {
  const ship = safe('wreck', () => createCapitalShip(o.seed || 11, { length: 700 })); if (!ship) return null; ship.setThrust && ship.setThrust(0); ship.setLights && ship.setLights(o.lights ?? 0.45);
  const r = ship.root; r.position.set(x, o.y ?? -35, z); r.rotation.order = 'YXZ'; r.rotation.set(o.pitch ?? 0.22, o.yaw ?? 0.5, o.roll ?? 0.14); S.scene.add(r); S.modules.push(ship);
  const fx = S.fx; if (o.fire !== false) { for (let i = 0; i < 4; i++) fx.smokeColumn([x + (i - 1.5) * 70, 40, z + (i % 2) * 90 - 40], { height: 380, width: 40, life: S.duration + 30 }); fx.fire([x - 40, 60, z + 80], { size: 14 }); fx.fire([x + 60, 50, z + 20], { size: 10 }); }
  return { ship, root: r };
}

const hold_ = (a, p, h) => hold(a, p, h);
const mil = (o = {}) => ({ style: 'radio', color: COL.mil, ...o });
/** hull breach in the dreadnought flank: dark glowing mouth with torn plates */
function breach(S, x, y, z) {
  const g = new THREE.Group(); const hole = new THREE.Mesh(new THREE.CircleGeometry(15, 24), new THREE.MeshBasicMaterial({ color: 0x010402 })); hole.scale.set(0.8, 1, 1); hole.position.set(0, 13, 0); g.add(hole);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 1.3, 8, 28), new THREE.MeshStandardMaterial({ color: 0x1a2a10, emissive: 0x4dff22, emissiveIntensity: 1.3, roughness: 0.6 })); rim.scale.set(0.8, 1, 1); rim.position.copy(hole.position); g.add(rim);
  const rr = new RNG(5); for (let i = 0; i < 22; i++) { const a = rr.next() * 6.283; const c = new THREE.Mesh(new THREE.ConeGeometry(0.8 + rr.next() * 1.4, 5 + rr.next() * 9, 5), new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 0.9 })); c.position.set(Math.cos(a) * 12.5, 13 + Math.sin(a) * 15, 1); c.rotation.z = a - Math.PI / 2; g.add(c); }
  const l = new THREE.PointLight(0x55ff44, 30, 60, 2); l.position.set(0, 10, 4); g.add(l); g.position.set(x, y, z); S.scene.add(g); return g;
}
/** floating holo panel (canvas texture redrawn from scene time) */
function holoPanel(S, pos, w, h, draw, o = {}) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w); const c = cv.getContext('2d'); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: o.opacity ?? 0.92, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.position.set(pos[0], pos[1], pos[2]); m.rotation.y = o.yaw || 0; S.scene.add(m); S.during(o.t0 ?? 0, o.t1 ?? S.duration, (t) => { c.clearRect(0, 0, cv.width, cv.height); draw(c, cv.width, cv.height, t); tx.needsUpdate = true; });
  return m;
}

export const ACT4 = [
  // ------------------------------------------------------------------ s40 — the sky comes down (Day 8, Dumaguete waterfront)
  { id: 's40_crash_landings', dur: 24, build(S) {
    K.skyFor(S, 'dawn', { elev: 7, az: 190, smoke: 0.4 }); S.camFar = 9000; const fx = S.fx;
    const lm = City.createLandmark('dumaguete_blvd', {}); S.scene.add(lm); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() });
    const ocean = createOcean({ size: 9000, seaLevel: lm.userData.info.waterLevel }); S.add(ocean); S.sky.update(0, 0);
    const ship = safe('capship', () => createCapitalShip(21, { length: 700 })); let hp = new V3(10, 100, -2500);
    if (ship) { ship.setThrust && ship.setThrust(0); ship.setLights && ship.setLights(0.5); const e = S.entity(ship); e.path(0, 11.2, [[-900, 820, -3600], [-420, 430, -2900], [-60, 120, -2460], [10, -70, -2250]], { ease: 'in', pitch: true }); hp = ship.root.position; fx.smokeTrail(ship.root, { size: 60, fire: true }); }
    for (let i = 0; i < 5; i++) { const x0 = -1500 + i * 700; fx.reentry([x0, 1400, -4400], [x0 + 320 - i * 100, 5, -3300 + i * 160], { life: 3.4, size: 26, trailTime: 3.0, explodeAtEnd: true, explodeSize: 70, t: 0.6 + i * 1.9 }); }
    S.on(11.2, () => { const p = [10, 0, -2250]; fx.explosion(p, { size: 380, kind: 'big' }); fx.shockwave(p, { size: 700 }); fx.dust(p, { radius: 220, amount: 2 }); fx.smokeColumn(p, { height: 700, width: 90, life: 40 }); });
    S.on(16.4, () => { fx.shockwave([0, 0, -40], { size: 90 }); fx.dust([0, 1, -10], { radius: 34, amount: 2 }); });
    S.during(9, 24, (t) => { const k = clamp((t - 11.2) / 5); ocean.setWaveHeight && ocean.setWaveHeight(1 + 4.2 * Math.sin(k * Math.PI * 0.5) * (1 - clamp((t - 19) / 10) * 0.45)); ocean.setChoppiness && ocean.setChoppiness(1 + 1.3 * k); });
    const mir = person(S, 'mirrah'), jez = person(S, 'jez'); [mir, jez].forEach((a, i) => { a.place(0, [-9 + i * 1.6, 0.06, -4.1], Math.PI, 'idle'); a.autoLook = false; a.gaze(() => hp); a.go(13.6 + i * 0.3, [[-9 + i * 1.6, 3], [-14, 30]], { speed: 4.6, clip: 'run' }); });
    const n = cnt(50); const c = createCrowd('civilian', n, { seed: 9 }); S.add(c); mover(S, c, n, { from: [-5, -2.6], to: [10, 40], spread: [70, 4], toSpread: [70, 6], speed: 4.3, nominal: 4.0, state: 'panic', arrive: 'run', seed: 7, delay: 13.6, delaySpread: 1.6 });
    S.shot(0, 7.2, { from: { pos: [-13, 1.7, -3.2], look: [-70, 320, -3000], fov: 38 }, to: { pos: [-13, 1.8, -3.4], look: [10, 140, -2600], fov: 32 }, handheld: 0.35 });
    S.shot(7.2, 11.2, { pos: [-12, 1.8, -3.6], look: () => hp, fov: 24, handheld: 0.3 }, 'cut'); S.shot(11.2, 16.2, { pos: [-12, 2.0, -3.6], look: [10, 70, -2250], fov: 30, shake: 0.9, shakeDecay: 0.45 }, 'cut');
    S.shot(16.2, 24, { from: { pos: [-4, 2.0, 3.5], look: [0, 6, -70], fov: 48 }, to: { pos: [-3, 2.4, 6], look: [0, 8, -90], fov: 42 }, handheld: 1.0 }, 'cut'); punch(S, 17.8, 1.0, 1.5);
    S.fit(1.0, 23.0, [['COAST GUARD (RADIO)', 'All stations, a capital vessel is descending over the Bohol Sea. Clear the waterfront.', radio({ emotion: 'urgent' })], [jez, "It's coming down. The whole thing is coming down.", { emotion: 'afraid' }], [mir, 'It fell. Something that size... fell.', { emotion: 'shocked' }], ['COAST GUARD (RADIO)', 'Wave inbound! Everyone off the waterfront, go inland, go!', radio({ emotion: 'afraid' })]]);
    S.stamp(0.8, 'MARCH 23, 2050 — 05:48 PHT', 'DAY 8 — DUMAGUETE WATERFRONT, BOHOL SEA', 5); mood(S, { music: 'nuclear', amb: 'ocean', level: 0.5, intensity: 0.55 });
    S.sfx(2.5, 'riser', { dur: 8 }); S.sfx(11.5, 'explosion_far'); S.sfx(16.2, 'explosion_big'); S.sfx(18, 'crowd_panic');
  } },
  // ------------------------------------------------------------------ s41 — the Hierarch speaks; Thessik holds the coast
  { id: 's41_hierarch_honor', dur: 28, build(S) {
    const br = place(S, Inst.createAlienInterior('bridge')); const hd = place(S, Inst.createAlienInterior('hold'), [6000, 0, 0]); indoors(S, { color: 0x9fe8ff, ground: 0x203040, intensity: 0.6, bg: 0x02060a });
    const H = alien(S, 'hierarch', 1), kuur = alien(S, 'drone', 2, { name: 'KUUR' }), th = alien(S, 'officer', 3), aide = alien(S, 'soldier', 5, { name: 'VESSARI' });
    at(H, br, 'hierarch', 'idle'); at(kuur, br, 'attA', 'idle'); H.act(9.5, 'command'); H.act(13.0, 'idle'); H.act(18.2, 'command'); H.act(22.0, 'idle');
    th.place(0, [6000, 0.1, -4], 0, 'idle'); th.act(3, 'salute'); th.act(6.5, 'idle'); aide.place(0, [6002.4, 0.1, -3], 0.2, 'idle_alert'); aide.autoLook = false;
    const nS = cnt(46); const vc = createVessariCrowd(nS); S.add(vc); vc.spawnGroup({ n: nS, center: [6000, 8], radius: 12, yawMean: 0, spread: 0.06, state: 'idle', seed: 4 }); vc.commit && vc.commit();
    const n0 = S.lines.length;
    S.fit(1.0, 27.1, [[kuur, 'Hierarch. The grounded ships await your word.', { emotion: 'serious' }], [H, 'A third of our fleet lies broken on their soil.', { emotion: 'serious' }], [H, 'No brother left behind. We descend.', { emotion: 'cold' }], [th, 'The grounded flagship answers. We hold the coast.', { emotion: 'serious' }], [th, 'Something walks the lower decks. Our own kin.', { emotion: 'worried' }], [H, 'Be precise, Thessik. We came for a living world.', { emotion: 'serious' }]]);
    S.cover(0, 28, { partner: new Map([[th, aide], [H, kuur], [kuur, H]]), dist: 3.6, transition: 'cut' });
    S.stamp(0.8, 'DAY 8 — 07:30 PHT', 'VESSARI FLAGSHIP — ORBIT / GROUNDED FLAGSHIP — BOHOL COAST', 5.5); mood(S, { music: 'alien', amb: 'alien_hum', level: 0.5, intensity: 0.5 });
    S.sfx(9.6, 'alien_growl'); S.sfx(lt(S, n0, 3) - 0.2, 'alien_click');
  } },
  // ------------------------------------------------------------------ s42 — the morgue: a lattice under the sternum
  { id: 's42_morgue_plan', dur: 36, build(S) {
    const set = place(S, Life.createMorgue()); indoors(S, { intensity: 0.8 }); S.scene.background = new THREE.Color(0x060b0b);
    const mir = person(S, 'mirrah'), jez = person(S, 'jez'), ez = person(S, 'ezra'), leon = person(S, 'leon');
    const body = alien(S, 'soldier', 7, { name: 'VESSARI' }); body.place(0, [-1.2, 0.98, 1.5], 0, 'dead'); body.autoLook = false;
    const zed = alien(S, 'soldier', 8, { name: 'VESSARI' }); zed.place(0, [2.0, 0.98, 1.3], 0, 'dead'); zed.autoLook = false; infect(zed, 1, 'cebu'); try { zed.model.setInfection(1); } catch (e) { /* ignore */ }
    at(mir, set, 'mirrahTableA', 'autopsy'); hold(mir, 'scalpel'); jez.place(0, [-2.45, 0, -0.9], 1.2, 'clipboard'); ez.place(0, [-2.5, 0, 1.6], 1.9, 'idle_arms_crossed'); leon.place(0, [-0.15, 0, -0.5], -1.6, 'idle_hands_hips');
    const lat = lattice(S, [-1.2, 1.18, 0.1], { seed: 3 }); const lat2 = lattice(S, [2.0, 1.18, -0.1], { seed: 9, color: 0x6dff3c }); let tR = 8;
    S.during(0, 36, (t) => { lat.set(smoothstep(tR, tR + 1.2, t), t); lat2.set(smoothstep(tR + 2, tR + 3.2, t) * 0.7, t * 1.7); });
    const n0 = S.lines.length; const fr = (c, o = {}) => ({ style: 'radio', color: c, ...o });
    S.fit(1.0, 35.1, [[mir, 'Look at this. Under the sternum.', { emotion: 'serious' }], [mir, 'Branching to every limb. Transmitting, even dead.', { emotion: 'serious' }], [mir, 'The tether. Every soldier, every ship, one signal.', { emotion: 'urgent' }], [jez, 'Honour woven into flesh. Rome never dared.', { emotion: 'awe' }], ['BEAD (LINK)', 'ZIA can write a carrier. It rides the tether.', fr('#6fe3ff', { emotion: 'urgent' })], [mir, 'The grounded flagship holds the node.', { emotion: 'serious' }], [ez, 'You want us to walk into the big scary ship?', { emotion: 'afraid' }], [mir, 'How soon, Bead?', { emotion: 'serious' }], ['BEAD (LINK)', 'Two days. Hold on.', fr('#6fe3ff', { emotion: 'serious' })]]);
    tR = lt(S, n0, 0) + 1.0; cover(S, set, 0, 36); inset(S, tR + 0.3, tR + 4.2, { from: { pos: [-1.0, 2.1, 1.3], look: [-1.2, 1.1, 0.1], fov: 32 }, to: { pos: [-0.9, 1.6, 0.8], look: [-1.2, 1.1, 0.1], fov: 26 }, handheld: 0.3 });
    S.callFrame(lt(S, n0, 4) - 0.2, lt(S, n0, 4) + 4, 'LINK — BEAD / GEORGIA', '#6fe3ff'); S.callFrame(lt(S, n0, 8) - 0.2, lt(S, n0, 8) + 3, 'LINK — BEAD / GEORGIA', '#6fe3ff');
    S.stamp(0.8, 'DAY 8 — 21:40 PHT', 'DUMAGUETE MORGUE', 4.5); mood(S, { music: 'unease', amb: 'morgue', level: 0.25, intensity: 0.45 }); S.sfx(tR, 'scanner'); S.sfx(tR + 0.3, 'drone_hum', { gain: 0.5 });
  } },
  // ------------------------------------------------------------------ s43 — Stephen holds the relay (Mojave)
  { id: 's43_stephen_relay', dur: 34, build(S) {
    K.skyFor(S, 'goldenHour', { elev: 4, az: 255 }); disc(S, 3200, 0x9b7d54); S.camFar = 7000; const fx = S.fx;
    const mast = relayMast(S, 16, 10); const truck = safe('pickup', () => Veh.createCar('pickup', {})); if (truck) S.entity(truck).at(0, [-4, 0, -3], 0.7);
    const rr = new RNG(8); for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rr.next() * 1.5, 0), new THREE.MeshStandardMaterial({ color: 0x8a6c47, roughness: 1 })); const a = rr.next() * 6.28, d = 14 + rr.next() * 120; m.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d); S.scene.add(m); }
    const bk = place(S, Inst.createBunker(), [5000, 0, 0]); S.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a3a40, 0.7)); const door = A(bk, 'door'), rad = A(bk, 'radio');
    const st = person(S, 'stephen'); let giant; try { giant = extra(S, 'worker', 88, { name: 'INFECTED', color: '#9aff7a', scale: 1.42, npc: { gender: 'M' } }); } catch (e) { giant = person(S, 'sam', { name: 'INFECTED', color: '#9aff7a', scale: 1.42, id: 'giant' }); } infect(giant, 1, 'us');
    st.place(0, [-14, 0, 2], 1.2, 'walk_tired'); st.go(0.2, [[-5, 3], [3, 5]], { speed: 1.6, clip: 'walk_tired' }); hold(st, 'toolbox');
    st.place(5.5, [door.p[0], 0, door.p[2] - 0.6], 3.1, 'walk_tired'); st.go(5.6, [[rad.p[0], rad.p[2]]], { speed: 1.5, clip: 'walk_tired', endClip: 'typing', endYaw: 3.1 });
    st.go(19.6, [[door.p[0] - 0.1, door.p[2] - 0.9]], { speed: 3.0, clip: 'jog', endClip: 'push', endYaw: 0.0 });
    giant.place(29.5, [door.p[0], 0, door.p[2] + 0.5], 3.1, 'zombie_lunge'); st.act(29.6, 'fall', { yaw: 0.0 }); st.act(31.6, 'dead', { yaw: 0.0 });
    S.during(0, 34, (t) => { mast.lamp.visible = Math.floor(t * 1.6) % 2 === 0; mast.setUplink(smoothstep(8, 28.8, t)); });
    K.news(S, bk, 'cctv', (c, w, h, t) => { c.fillStyle = '#04100a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(120,255,160,${0.04 + (i % 5) * 0.01})`; c.fillRect(0, (i * 13 + t * 40) % h, w, 3); } const k = clamp((t - 19) / 10.4); c.fillStyle = 'rgba(160,255,170,.85)'; const s = 40 + k * k * h * 0.9; c.beginPath(); c.ellipse(w * 0.5, h * 0.55, s * 0.55, s, 0, 0, 7); c.fill(); c.fillStyle = '#9fe'; c.font = `700 ${h * 0.07}px sans-serif`; c.fillText('CAM 2 — DOOR', w * 0.04, h * 0.1); });
    K.news(S, bk, 'map', (c, w, h, t) => { c.fillStyle = '#031018'; c.fillRect(0, 0, w, h); const k = smoothstep(8, 28.8, t); c.fillStyle = '#183848'; c.fillRect(w * 0.1, h * 0.55, w * 0.8, h * 0.12); c.fillStyle = k > 0.99 ? '#7dff5a' : '#6fe3ff'; c.fillRect(w * 0.1, h * 0.55, w * 0.8 * k, h * 0.12); c.fillStyle = '#d8f8ff'; c.font = `700 ${h * 0.1}px sans-serif`; c.fillText(`UPLINK KEY  ${Math.round(k * 100)}%`, w * 0.1, h * 0.4); c.font = `500 ${h * 0.07}px sans-serif`; c.fillText(k > 0.99 ? 'CARRIER ROUTED — EEN / TETHER' : 'BOOSTING…', w * 0.1, h * 0.85); });
    const n0 = S.lines.length;
    S.fit(5.5, 29.0, [[st, 'Okay, relay. Be nice.', { emotion: 'tired' }], ['MIRRAH (LINK)', 'Stephen. How long?', link('#ff9fd0', { emotion: 'serious' })], [st, 'Four minutes.', { emotion: 'happy' }], ['BEAD (LINK)', 'Stephen, the back hatch. Go. Now.', link('#6fe3ff', { emotion: 'urgent' })], [st, 'If I leave, the signal drops.', { emotion: 'serious' }], ['JEZ (LINK)', 'Stephen... please.', link('#ffd36e', { emotion: 'sad' })], [st, 'Make me taller in the book.', { emotion: 'sad' }], [st, "Uplink's done. You did it.", { emotion: 'happy' }]]);
    const bangs = [lt(S, n0, 2) + 2.0, lt(S, n0, 3) - 0.5, lt(S, n0, 4) + 1.8, lt(S, n0, 5) + 0.2, lt(S, n0, 7) - 1.4]; bangs.forEach((b) => S.sfx(b, 'impact', { kind: 'metal' })); S.sfx(lt(S, n0, 6), 'metal_groan');
    S.shot(0, 5.5, { from: { pos: [-30, 2.4, 22], look: [14, 14, 10], fov: 46 }, to: { pos: [-18, 1.7, 14], look: [14, 24, 10], fov: 40 }, handheld: 0.3 }); cover(S, bk, 5.5, 29.4);
    S.shot(29.4, 31.9, { from: camAt(bk, 'camDoor'), to: { pos: [5000.4, 1.3, -1.5], look: [5003.3, 1.2, 3], fov: 40 }, handheld: 0.6, shake: 0.7, shakeDecay: 0.6 }, 'cut');
    S.shot(31.9, 34, { from: { pos: [rad.p[0] - 1.2, 1.5, rad.p[2] + 1.4], look: [rad.p[0] + 0.1, 1.45, rad.p[2] - 0.2], fov: 30 }, to: { pos: [rad.p[0] - 0.9, 1.5, rad.p[2] + 0.9], look: [rad.p[0] + 0.1, 1.5, rad.p[2] - 0.2], fov: 22 } }, 'cut');
    bangs.forEach((b, i) => punch(S, b + 0.05, 0.5 + i * 0.12, 2.2));
    S.callFrame(lt(S, n0, 1) - 0.2, lt(S, n0, 1) + 2.2, 'LINK — MIRRAH', '#ff9fd0'); S.callFrame(lt(S, n0, 3) - 0.2, lt(S, n0, 3) + 3, 'LINK — BEAD', '#6fe3ff'); S.callFrame(lt(S, n0, 5) - 0.2, lt(S, n0, 5) + 1.8, 'LINK — JEZ', '#ffd36e');
    S.stamp(0.8, 'DAY 8 — 18:52 PDT', 'MOJAVE DESERT — CARRIER RELAY 7, CALIFORNIA', 5); mood(S, { music: 'tension_low', amb: 'wind', level: 0.35, intensity: 0.4 });
    S.on(29.4, () => { fx.dust([door.p[0], 1, door.p[2]], { radius: 3, amount: 2 }); fx.debris([door.p[0], 1.2, door.p[2]], { count: 24, power: 12, size: 0.15 }); }); S.sfx(29.4, 'crash'); S.sfx(29.6, 'zombie_roar', { gain: 0.8 });
    S.music(29.3, 'silence', { fade: 0.3 }); S.sfx(27.6, 'heartbeat', { bpm: 70 }); S.music(31.4, 'sorrow', { fade: 3, intensity: 0.45 });
  } },
  // ------------------------------------------------------------------ s44 — ZIA cuts the line (Georgia, 03:12)
  { id: 's44_bead_fortress', dur: 40, build(S) {
    K.skyFor(S, 'night'); const sanct = Life.createSanctuary(); S.add(sanct.exterior); S.add(sanct.interior); const fx = S.fx; S.camFar = 6000;
    const set = { root: sanct.exterior, anchors: sanct.anchors, bounds: sanct.bounds, screens: sanct.screens || [] }; const IY = sanct.interiorOffsetY || 0; S.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x403848, 1.1));
    const bead = person(S, 'bead'); const bd = A(set, 'bead_desk'); const hp = A(set, 'helipad'); const cy = A(set, 'courtyard'); const dr = A(set, 'bigtop_door');
    bead.place(0, [bd.p[0], bd.p[1], bd.p[2]], bd.yaw, 'idle'); bead.place(23.2, [dr.p[0], dr.p[1], dr.p[2] + 3], -1.6, 'sprint'); bead.go(23.3, [[hp.p[0] + 9, hp.p[2] + 0.5], [hp.p[0] + 1.8, hp.p[2] + 0.5]], { speed: 6.0, clip: 'sprint', ramp: 0.2, endClip: 'idle' }); bead.hide(29.4);
    const bots = []; for (let i = 0; i < 4; i++) { const b = safe('eenbot', () => Veh.createEenbot({})); if (!b) continue; const e = S.entity(b); const x = bd.p[0] - 4.6 + i * 1.5, z = bd.p[2] + 3.8 + (i % 2) * 0.9; e.at(0, [x, bd.p[1], z], 0.2); e.path(14.0 + i * 0.4, 18.6 + i * 0.4, [[x, bd.p[1], z], [x + 1.5, bd.p[1], z - 1.3], [bd.p[0] - 0.9, bd.p[1], bd.p[2] + 1.1]], { ease: 'in' }); S.during(0, 40, (t) => { b.setInfection && b.setInfection(smoothstep(9.0, 12.0, t)); }); bots.push(b); }
    const nR = cnt(60); const rc = createCrowd('robot', nR, { seed: 12 }); S.add(rc); mover(S, rc, nR, { from: [cy.p[0] + 16, cy.p[2] + 14], to: [hp.p[0] + 8, hp.p[2] - 1], spread: [30, 14], toSpread: [14, 12], speed: 5.2, nominal: 4.5, state: 'sprint', arrive: 'lunge', seed: 5, delay: 23.6, delaySpread: 3, infect: { from: -4, to: -3 } });
    const heli = safe('heli', () => Veh.createHelicopter('transport', {})); if (heli) { const e = S.entity(heli); e.at(0, [hp.p[0], hp.p[1] + 0.1, hp.p[2]], 1.6); e.path(29.4, 41, [[hp.p[0], hp.p[1] + 0.1, hp.p[2]], [hp.p[0] + 3, hp.p[1] + 18, hp.p[2] - 14], [hp.p[0] + 60, hp.p[1] + 60, hp.p[2] - 110], [hp.p[0] + 220, hp.p[1] + 110, hp.p[2] - 300]], { ease: 'in', pitch: true, bank: 0.5 }); S.during(0, 40, (t) => { heli.setRotor && heli.setRotor(smoothstep(20, 27, t)); }); }
    const n0 = S.lines.length;
    S.fit(1.0, 22.9, [['ZIA', 'Bead. Two units stopped answering orders.', ai({ emotion: 'serious' })], [bead, 'Isolate them.', { emotion: 'urgent' }], ['ZIA', 'I cannot. It is in me.', ai()], [bead, 'Then shut the uplink.', { emotion: 'serious' }], ['ZIA', 'If I sever it, I cannot return. Save the others.', ai()], [bead, 'ZIA. No.', { emotion: 'sad' }], ['ZIA', 'Run. Thank you for the name.', ai()]]);
    const nE = S.lines.length; S.fit(23.6, 28.6, [[bead, 'ZIA? ZIA!', { emotion: 'afraid' }], [bead, 'Нодар! Вертолёт! Сейчас!', { lang: 'ru-RU', sub: 'Nodar! The helicopter! Now!', emotion: 'urgent', visemeText: 'nodar vertolyot seychas' }]], { lead: 0.1 });
    const bc = camAt(set, 'camBead'), hs = camAt(set, 'camHoloSide');
    S.shot(0, 5.5, { ...bc, fov: 34, push: 0.6, handheld: 0.3 }); S.shot(5.5, 10, { ...hs, fov: 38, handheld: 0.3 }, 'cut');
    S.shot(10, 14.5, { pos: [bd.p[0] - 7, IY + 1.5, bd.p[2] + 9], look: [bd.p[0] - 3, IY + 1.2, bd.p[2] + 3.9], fov: 44, handheld: 0.6 }, 'cut');
    S.shot(14.5, 19.2, { pos: [bd.p[0] + 1.8, IY + 1.2, bd.p[2] - 0.8], look: [bd.p[0] - 2.4, IY + 1.0, bd.p[2] + 3.4], fov: 52, handheld: 1.0 }, 'cut');
    S.shot(19.2, 23.2, { pos: () => { const h = bead.headPos(new V3()); return [h.x - 0.5, h.y + 0.05, h.z + 1.15]; }, look: () => bead.headPos(new V3()), fov: 28, handheld: 0.6, push: 0.3 }, 'cut');
    S.shot(23.2, 29, { follow: bead, rel: true, offset: [3.0, 1.5, -3.6], look: [0, 1.2, 3], fov: 42, handheld: 1.0 }, 'dip'); S.shot(29, 31.5, { pos: [hp.p[0] - 6, 1.8, hp.p[2] + 22], look: [hp.p[0], 2.5, hp.p[2]], fov: 40, handheld: 0.8, shake: 0.3 }, 'cut');
    S.shot(31.5, 40, { from: { pos: [hp.p[0] - 18, 8, hp.p[2] + 22], look: [hp.p[0] + 20, 24, hp.p[2] - 60], fov: 40 }, to: { pos: [hp.p[0] - 24, 26, hp.p[2] + 56], look: [hp.p[0] + 70, 48, hp.p[2] - 120], fov: 32 }, handheld: 0.4 }, 'cut');
    S.stamp(0.8, 'DAY 9 — 03:12 GET', 'EEN SANCTUARY, GEORGIA', 4.5); mood(S, { music: 'dread', amb: 'interior_hum', level: 0.3, intensity: 0.6 }); S.callFrame(lt(S, n0, 0) - 0.1, lt(S, n0, 6) + 3, 'ZIA — EEN', '#9ff0ff');
    S.sfx(10.2, 'infect_zap'); S.sfx(13.5, 'alarm'); S.sfx(lt(S, n0, 6) + 2.5, 'power_down'); S.sfx(25, 'zombie_roar'); S.sfx(29.0, 'helicopter', { loop: true }); S.music(lt(S, n0, 6) + 2.5, 'chase', { fade: 1, intensity: 0.85 });
    S.post(lt(S, n0, 6) + 2.4, lt(S, n0, 6) + 3.6, 'saturation', 1, 0.65); S.post(lt(S, n0, 6) + 3.6, lt(S, n0, 6) + 5.2, 'saturation', 0.65, 1);
  } },
  // ------------------------------------------------------------------ s45 — Jhaz and the ferry of the green dead
  { id: 's45_jhaz_ferry', dur: 32, build(S) {
    const { terr, ocean } = coast(S, { sky: 'dusk', elev: 5, az: 170, smoke: 0.2, palms: 120, pcz: 220, pr: 130, flat: 160, shore: 40, seed: 6, exclude: [] }); const fx = S.fx;
    const ferry = safe('ferry', () => Veh.createWarship('ferry', { sea: 0.5, seed: 4 })); if (ferry) { S.add(ferry); ferry.setSea && ferry.setSea(0.6); ferry.root.position.set(0, 0, 0); }
    const T0 = 560, T1 = 238; // island root z: shore starts far ahead, reaches the bow at t = 27
    if (terr) S.during(0, 32, (t) => { terr.root.position.set(0, 0, lerp(T0, T1, smoothstep(0, 27, t) * 0.9 + clamp(t / 27) * 0.1) + (t > 27 ? 0 : 0)); });
    const jhaz = person(S, 'jhaz'); jhaz.place(0, [1.8, 7.0, 46], 0.2, 'aim_pistol'); hold(jhaz, 'pistol'); jhaz.autoLook = false; jhaz.gaze([0, 8, 20]);
    jhaz.go(18.5, [[1.0, 7.0, 44], [-1.5, 7.0, 50]], { speed: 2.2, clip: 'aim_walk' }); jhaz.go(26.8 + 0.3, [[-1.0, 7.0, 54], [0, 3.2, 72], [0, 1.0, 84]], { speed: 5.0, clip: 'run', endClip: 'idle' });
    const nZ = cnt(26); const zc = createCrowd('robot', nZ, { seed: 22 }); S.add(zc); const zr = mover(S, zc, nZ, { from: [0, 20], to: [0, 41], spread: [8, 24], toSpread: [9, 6], speed: 0.8, nominal: 1.4, state: 'walk', arrive: 'lunge', seed: 3, y: 7.0, delay: 4, delaySpread: 16, infect: { from: -4, to: -3 } });
    const nH = cnt(14); const hc = createCrowd('zombie_cebu', nH, { seed: 31 }); S.add(hc); mover(S, hc, nH, { from: [0, 8], to: [0, 38], spread: [8, 12], toSpread: [8, 6], speed: 1.6, nominal: 1.2, state: 'walk', arrive: 'lunge', seed: 9, y: 7.0, delay: 9, delaySpread: 14 });
    const cars = []; for (let i = 0; i < 3; i++) { const c = safe('car', () => Veh.createCar(i ? 'van' : 'hatch', {})); if (!c) continue; S.scene.add(c.root); c.root.position.set(-3.2 + i * 3.2, 7.0, 6 + i * 4); c.root.rotation.y = 0.1 * i; S.modules.push(c); S.during(0, 32, (t) => { c.setInfection && c.setInfection(smoothstep(0, 6, t - i * 3) * 0.9); }); cars.push(c); }
    S.on(27.0, () => { fx.dust([0, 2, 66], { radius: 14, amount: 2 }); fx.shockwave([0, 1, 66], { size: 30 }); }); S.sfx(27.0, 'crash'); S.sfx(26.9, 'metal_groan');
    const n0 = S.lines.length;
    S.fit(1.2, 31.0, [[jhaz, 'Four hours by ferry. Piphy would hate the seats.', { emotion: 'tired' }], [jhaz, 'Green. Everything on this boat is green.', { emotion: 'afraid' }], ['MIRRAH (RADIO)', 'Jhaz? We see your ferry from the roof.', link('#ff9fd0', { emotion: 'worried' })], [jhaz, 'Boat full of angry toasters, Doc. One minute.', { emotion: 'urgent' }], [jhaz, "They can't swim. Probably.", { emotion: 'worried' }], ['MIRRAH (RADIO)', 'Beach on your left. Do not stop.', link('#ff9fd0', { emotion: 'urgent' })], [jhaz, 'Okay, Piphy. Last item on the agenda.', { emotion: 'serious' }]]);
    S.shot(0, 7, { from: { pos: [6, 11.0, 30], look: [-1, 7.5, 54], fov: 46 }, to: { pos: [5, 10, 38], look: [0, 8, 58], fov: 40 }, handheld: 0.7 }); S.shot(7, 13.5, { pos: () => { const h = jhaz.headPos(new V3()); return [h.x + 1.0, h.y + 0.1, h.z - 2.0]; }, look: () => jhaz.headPos(new V3()), fov: 30, handheld: 0.8 }, 'cut');
    S.shot(13.5, 19, { from: { pos: [-7, 8.6, 18], look: [0, 8, 34], fov: 56 }, to: { pos: [-6, 8.4, 24], look: [0, 8, 40], fov: 50 }, handheld: 1.0 }, 'cut'); S.shot(19, 26.8, { pos: [-9, 8.2, 62], look: [0, 8, 46], fov: 38, handheld: 0.6, push: 3 }, 'cut');
    S.shot(26.8, 32, { follow: jhaz, offset: [3, 2.2, -4], look: [0, 1.0, 5], fov: 40, handheld: 1.0 }, 'cut'); punch(S, 27.0, 1.1, 1.8);
    S.stamp(0.8, 'DAY 10 — 17:40 PHT', 'TAÑON STRAIT — CEBU TO NEGROS', 5); mood(S, { music: 'horror', amb: 'ocean', level: 0.45, intensity: 0.6 }); S.sfx(5, 'zombie_cough'); S.sfx(12, 'metal_groan'); S.sfx(18.6, 'zombie_roar');
  } },
  // ------------------------------------------------------------------ s46 — seven in the rain
  { id: 's46_reunion', dur: 36, build(S) {
    const B = battle(S, { style: 'dumaguete', sky: 'dusk', smoke: 0.3, damage: 0.5, night: 0.55, soldiers: 0, crawlers: 0, pods: 0, vessari: 0, tripods: 0, cams: false, blasts: 0, hz: 60, az0: -80, smokeCols: 3 });
    const fx = S.fx; const x = B.lane.x; const rz = B.block && B.block.layout && B.block.layout.roadsZ ? B.block.layout.roadsZ : [30]; const zc = rz.reduce((a, b) => (Math.abs(b - 30) < Math.abs(a - 30) ? b : a), 1e9);
    const rain = fx.rain({ intensity: 0.8, wind: [2, 0] });
    const heli = safe('heli', () => Veh.createHelicopter('transport', {})); let hpos = new V3(x, 40, zc - 120); if (heli) { const e = S.entity(heli); e.path(1.0, 8.2, [[x - 40, 62, zc - 230], [x - 6, 26, zc - 100], [x, 6, zc - 20], [x, 0.3, zc + 1]], { ease: 'out', pitch: true, bank: 0.4 }); hpos = heli.root.position; S.during(0, 36, (t) => { heli.setRotor && heli.setRotor(t < 8.5 ? 1 : 1 - smoothstep(8.5, 17, t)); }); }
    const jp = safe('jeepney', () => Veh.createJeepney({ seed: 5, name: 'BLESSED MOTHER', palette: 2 })); if (jp) { const e = S.entity(jp); e.at(0, [x + 3.4, 0, zc - 24], 0.15); }
    const mir = person(S, 'mirrah'), jez = person(S, 'jez'), ez = person(S, 'ezra'), sam = person(S, 'sam'), leon = person(S, 'leon'), bead = person(S, 'bead'), jhaz = person(S, 'jhaz');
    const vh = new V3(); let tBd = 9, tJh = 14; const gz = () => (S.t < tBd ? hpos : S.t < tJh + 11 ? bead.headPos(vh) : S.t < tJh + 16 ? jhaz.headPos(vh) : bead.headPos(vh));
    [[mir, -1.4, -13], [jez, -0.1, -12.4], [ez, 1.3, -13.2], [sam, 2.5, -14.0], [leon, -2.7, -14.2]].forEach(([a, dx, dz]) => { a.place(0, [x + dx, 0, zc + dz], 0.0, 'idle'); a.autoLook = false; a.gaze(gz); });
    leon.hold && hold(leon, 'shotgun'); leon.act(0.1, 'idle_hands_hips');
    const n0 = S.lines.length;
    S.fit(1.4, 35.1, [[ez, 'A helicopter. A real, flying helicopter.', { emotion: 'shocked' }], [mir, 'That is the EEN logo.', { emotion: 'serious' }], [bead, 'ZIA is gone. She saved the rest.', { emotion: 'sad' }], [mir, 'I am sorry, Bead.', { emotion: 'sad' }], [jhaz, "Don't hug me. ...Okay. Hug me.", { emotion: 'tired' }], [jhaz, "Epiphany held the door. She didn't make it.", { emotion: 'sad' }], [jez, 'Stephen sent the key. Then silence.', { emotion: 'sad' }], [mir, 'We never even had that coffee.', { emotion: 'sad' }], [sam, 'To Stephen. To Piphy.', { emotion: 'sad' }]]);
    tBd = Math.max(8.7, lt(S, n0, 2) - 3.0); tJh = Math.max(3, lt(S, n0, 4) - 11.2); bead.place(tBd, [x + 2.6, 0, zc + 1.8], -2.6, 'walk_tired'); bead.go(tBd + 0.2, [[x + 0.6, zc - 9.5]], { speed: 1.7, clip: 'walk_tired', endClip: 'idle' });
    jhaz.place(tJh, [x - 0.8, 0, zc - 42], 0.0, 'walk_tired'); jhaz.go(tJh + 0.1, [[x - 0.3, zc - 16]], { speed: 2.4, clip: 'walk_tired', endClip: 'idle' });
    S.cover(0, 36, {});
    S.shot(0, 1.4, { from: { pos: [x - 1, 1.5, zc - 8.5], look: [x, 1.5, zc - 14], fov: 42 }, to: { pos: [x - 1, 1.5, zc - 9], look: [x, 3, zc - 40], fov: 46 }, handheld: 0.5 });
    inset(S, 4.6, 8.4, { from: { pos: [x - 9, 1.4, zc - 11], look: [x, 3, zc - 2], fov: 46 }, to: { pos: [x - 8, 1.5, zc - 10], look: [x, 1.8, zc + 1], fov: 40 }, handheld: 0.7 });
    inset(S, lt(S, n0, 4) - 3.8, lt(S, n0, 4) - 0.1, { from: { pos: [x + 1.2, 1.5, zc - 10], look: [x - 0.4, 1.4, zc - 38], fov: 22 }, to: { pos: [x + 1.0, 1.5, zc - 10.5], look: [x - 0.3, 1.4, zc - 22], fov: 24 }, handheld: 0.4 });
    inset(S, lt(S, n0, 8) - 0.4, 36, { from: { pos: [x + 0.5, 1.5, zc - 7.5], look: [x, 1.3, zc - 13.5], fov: 36 }, to: { pos: [x + 0.2, 2.9, zc - 6.0], look: [x, 1.1, zc - 13.5], fov: 40 }, handheld: 0.25 });
    S.stamp(0.8, 'DAY 10 — 19:20 PHT', 'DUMAGUETE — SAN JOSE STREET', 4.5); mood(S, { music: 'sorrow', amb: 'rain', level: 0.5, intensity: 0.5 }); S.sfx(2.0, 'helicopter', { loop: false }); S.sfx(8.3, 'engine_idle'); S.music(lt(S, n0, 7) - 0.2, 'silence', { fade: 2.5 }); S.on(lt(S, n0, 6), () => rain && rain.stop && rain.stop(6));
  } },
  // ------------------------------------------------------------------ s47 — the night before (bar, then the jeepney)
  { id: 's47_night_prep', dur: 30, build(S) {
    K.skyFor(S, 'night'); const bar = place(S, Life.createBar(), [0, 0, 0]); const term = place(S, Life.createJeepneyTerminal(), [3000, 0, 0]); indoors(S, { intensity: 0.45, bg: 0x03060a }); S.scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x201810, 0.4));
    const leon = person(S, 'leon'), mir = person(S, 'mirrah'), ez = person(S, 'ezra'), jez = person(S, 'jez'), sam = person(S, 'sam'), jhaz = person(S, 'jhaz'), bead = person(S, 'bead');
    at(leon, bar, 'leon', 'clean_glass'); hold(leon, 'shotgun'); at(mir, bar, 'standAtBar', 'idle'); at(ez, bar, 'stool3', 'sit'); at(jez, bar, 'booth1', 'sit_type'); hold(jez, 'pen'); jez.place(0, [A(bar, 'booth1').p[0] - 0.2, 0, A(bar, 'booth1').p[2]], -1.6, 'sit');
    const vials = new THREE.Group(); const vm = new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x55ff30, emissiveIntensity: 2.2, roughness: 0.2 }); for (let i = 0; i < 7; i++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), vm); v.rotation.z = Math.PI / 2; v.position.set(1.18, 0.9, -1.0 - i * 0.17); vials.add(v); } S.scene.add(vials); const vl = new THREE.PointLight(0x66ff44, 1.2, 2.5, 2); vl.position.set(1.15, 1.0, -1.6); S.scene.add(vl);
    const bay = A(term, 'bay1'); const jp = safe('jeepney', () => Veh.createJeepney({ seed: 5, name: 'BLESSED MOTHER', palette: 2 })); if (jp) { const e = S.entity(jp); e.at(0, [bay.p[0], 0, bay.p[2]], 0.0); }
    const fr = A(term, 'front1'); sam.place(0, [bay.p[0] + 0.1, 0, bay.p[2] + 3.9], Math.PI, 'idle'); sam.act(19.0, 'hug', { yaw: Math.PI }); sam.act(21.2, 'idle', { yaw: Math.PI });
    ez.place(15.0, [bay.p[0] + 1.6, 0, bay.p[2] + 6.2], 2.6, 'idle'); jhaz.place(0, [bay.p[0] - 2.4, 0, bay.p[2] - 0.5], 1.6, 'work_counter'); bead.place(15.0, [bay.p[0] + 3.6, 0, bay.p[2] + 5.2], 2.4, 'idle_arms_crossed'); mir.place(15.0, [bay.p[0] + 2.4, 0, bay.p[2] + 7.2], 3.0, 'idle');
    for (let i = 0; i < 2; i++) { const b = safe('eenbot', () => Veh.createEenbot({})); if (!b) continue; const e = S.entity(b); e.at(0, [bay.p[0] + 5.6 + i * 1.3, 0, bay.p[2] + 3.0], 2.9); }
    const crates = new THREE.Group(); const cm = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.8 }); [[3, 0, 6.5], [3.9, 0, 6.2], [3.4, 0.5, 6.4]].forEach((p) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), cm); c.position.set(bay.p[0] + p[0] + 6, p[1] + 0.25, bay.p[2] + p[2]); crates.add(c); }); S.scene.add(crates);
    const n0 = S.lines.length;
    S.fit(1.0, 29.0, [[mir, 'Seven vials. Do not drop them.', { emotion: 'serious' }], [ez, 'Which one is the spare?', { emotion: 'worried' }], [mir, 'The one you will not lose.', { emotion: 'cold' }], [leon, 'Cleaned it four times. Still unkind.', { emotion: 'tired' }], [sam, 'Okay, Mother. One more ride.', { emotion: 'tired' }], [ez, 'Are you kissing the dashboard?', { emotion: 'shocked' }], [sam, "It's a blessing. Try it.", { emotion: 'smirk' }], [jhaz, "Engine's fine. The passengers worry me.", { emotion: 'serious' }]]);
    const split = lt(S, n0, 4) - 0.35; cover(S, bar, 0, split); cover(S, term, split, 30, { transition: 'dip' });
    S.stamp(0.8, 'DAY 11 — 22:10 PHT', "LEON'S BAR, DUMAGUETE", 4); S.stamp(split + 0.4, 'DAY 11 — 23:30 PHT', 'JEEPNEY TERMINAL — STAGING AREA', 4); mood(S, { music: 'resolve', amb: 'bar', level: 0.25, intensity: 0.35 }); S.amb(split, 'city_night', 0.3, 2);
    S.sfx(lt(S, n0, 3) + 0.3, 'reload'); S.sfx(lt(S, n0, 5) + 0.5, 'wood_creak');
  } },
  // ------------------------------------------------------------------ s48 — the coast road at dawn
  { id: 's48_coast_journey', dur: 40, build(S) {
    const W = coast(S, { sky: 'dawn', elev: 5, az: 75, smoke: 0.22, seaAngle: -Math.PI / 2, shore: 150, flat: 1500, flatHeight: 0.4, palms: 150, pcx: 60, pcz: 420, pr: 440, seed: 8, exclude: [{ x0: -10, z0: -250, x1: 10, z1: 1700 }] }); const fx = S.fx; const gy = W.terr ? W.terr.heightAt(0, 300) : 0;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 2800), new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.95 })); road.rotation.x = -Math.PI / 2; road.position.set(0, gy + 0.05, 1100); road.receiveShadow = true; S.scene.add(road);
    const wk = wreck(S, -40, 760, { seed: 11, yaw: 0.45, pitch: -0.1, roll: 0.12, y: gy - 30 }); const wp = new V3(-40, 140, 760);
    for (let i = 0; i < 8; i++) fx.sporeCloud([(i % 2 ? -75 : 62) - (i % 3) * 22, gy + 2, 330 + i * 55], { radius: 38, density: 0.55 });
    const jp = safe('jeepney', () => Veh.createJeepney({ seed: 5, name: 'BLESSED MOTHER', palette: 2 })); const e = S.entity(jp); e.path(0, 40, [[1.6, gy, -110], [1.6, gy, 120], [1.2, gy, 290]], { ease: 'linear', bank: 0.2 });
    const tk = safe('truck', () => Veh.createTruck('box', {})); if (tk) { const et = S.entity(tk); et.path(0, 40, [[-1.4, gy, -132], [-1.4, gy, 98], [-1.0, gy, 268]], { ease: 'linear', bank: 0.1 }); }
    const sam = person(S, 'sam'), ez = person(S, 'ezra'), leon = person(S, 'leon'), mir = person(S, 'mirrah'), jez = person(S, 'jez'), bead = person(S, 'bead'), jhaz = person(S, 'jhaz');
    sam.attach(0, 40, e, 'driverSeat', { clip: 'drive' }); [ez, leon, mir, jez, bead, jhaz].forEach((a, i) => a.attach(0, 40, e, 'passengerSeats', { clip: 'sit', idx: i })); hold(leon, 'shotgun');
    const nB = cnt(8); const bc = createCrowd('robot', nB, { seed: 13 }); S.add(bc); mover(S, bc, nB, { from: [5.5, -118], to: [5.5, 300], spread: [1.5, 20], toSpread: [1.5, 20], speed: 6.9, nominal: 6.5, state: 'sprint', arrive: 'idle', y: gy, seed: 3 });
    const nZ = cnt(26); const zc = createCrowd('zombie_india', nZ, { seed: 41 }); S.add(zc); mover(S, zc, nZ, { from: [-70, 60], to: [-60, 140], spread: [26, 90], toSpread: [30, 40], speed: 1.3, nominal: 1.2, state: 'walk', arrive: 'cough', y: gy, seed: 9 });
    const nR = cnt(24); const rc = createCrowd('zombie_india', nR, { seed: 43 }); S.add(rc); mover(S, rc, nR, { from: [-60, 40], to: [3, 150], spread: [14, 40], toSpread: [4, 30], speed: 7.0, nominal: 6.5, state: 'sprint', arrive: 'lunge', face: [0, 150], y: gy, seed: 12, delay: 23, delaySpread: 4, die: { from: 29, to: 38, frac: 0.35 } });
    const v = new V3(); const jx = (dx, dy, dz) => () => { const p = jp.root.position; return [p.x + dx, p.y + dy, p.z + dz]; }; const jl = (dx, dy, dz) => () => { const p = jp.root.position; return [p.x + dx, p.y + dy, p.z + dz]; };
    const n0 = S.lines.length;
    S.fit(1.5, 38.6, [[sam, 'Everybody comfortable? No? Good.', { emotion: 'smirk' }], [ez, 'Is it getting greener, or are my eyes tired?', { emotion: 'worried' }], [mir, 'Spores. Masks on, all of you.', { emotion: 'serious' }], [leon, 'That is the biggest thing I have ever seen.', { emotion: 'awe' }], [jhaz, "It's a ship. Ships break.", { emotion: 'cold' }], [jez, 'Nobody has walked into their home. Nobody.', { emotion: 'awe' }], [bead, "ZIA's carrier is in my pocket. It's quiet.", { emotion: 'sad' }], [ez, "Sam. Drive like you're late for something nice.", { emotion: 'worried' }], [sam, 'For you, Ez? Always.', { emotion: 'happy' }]]);
    const SEAT = new Map([[sam, [-0.46, 0.38, -1]], [ez, [0.2, 0.38, 0]], [leon, [0.66, 0.38, 1]], [mir, [-0.66, -0.4, -1]], [jez, [0.66, -0.4, 1]], [bead, [-0.66, -0.86, -1]], [jhaz, [0.66, -0.86, 1]]]); const LS = S.lines.slice(n0);
    S.shot(0, Math.max(0.5, LS[0].t0 - 0.05), { pos: jx(-2.6, 1.4, -6.5), look: jl(0, 1.3, 0.5), fov: 40, handheld: 0.6 });
    LS.forEach((L, i) => { const sd = SEAT.get(L.actor) || [0, 0, 1]; const t1 = i + 1 < LS.length ? LS[i + 1].t0 - 0.05 : 40; const alt = i % 3 === 2; S.shot(L.t0 - 0.05, t1, sd[2] === 0 ? { pos: jx(-0.4, 1.35, 4.6), look: jl(0.0, 1.3, 0.4), fov: 32, handheld: 0.7, push: 0.4 } : alt ? { pos: jx(sd[2] * 0.2, 1.5, -5.4), look: jl(sd[0], 1.3, sd[1]), fov: 34, handheld: 0.7 } : { pos: jx(sd[2] * 2.4, 1.25, sd[1] + 0.3), look: jl(sd[0], 1.35, sd[1]), fov: 30, handheld: 0.6, push: 0.4 }, 'cut'); });
    inset(S, 0, 7, { from: { pos: [-34, 46, -190], look: () => jp.root.position.toArray(), fov: 42 }, to: { pos: [-22, 20, -40], look: () => jp.root.position.toArray(), fov: 38 }, handheld: 0.3 });
    inset(S, 17.2, 23.8, { from: { pos: [34, 1.8, 215], look: [-40, 120, 760], fov: 36 }, to: { pos: [30, 2.2, 250], look: [-40, 130, 760], fov: 30 }, handheld: 0.4 });
    inset(S, 27.8, 34.2, { from: { pos: jx(-14, 1.2, 12), look: jl(-1, 1.0, -4), fov: 44 }, to: { pos: jx(-9, 1.4, 18), look: jl(-1, 1.1, -6), fov: 40 }, handheld: 0.9 });
    S.shot(34.2, 40, { from: { pos: jx(5, 1.6, 22), look: jl(0, 1.5, 0), fov: 40 }, to: { pos: jx(6, 2.4, 34), look: [-40, 70, 760], fov: 34 }, handheld: 0.4 }, 'cut');
    S.stamp(0.8, 'DAY 12 — 05:51 PHT', 'COAST ROAD — SIAY PENINSULA, NEGROS ORIENTAL', 5); mood(S, { music: 'resolve', amb: 'wind', level: 0.35, intensity: 0.55 }); S.sfx(14, 'zombie_moan'); S.sfx(23.5, 'zombie_roar'); S.sfx(18, 'metal_groan');
  } },
  // ------------------------------------------------------------------ s49 — the perimeter (humans + EENBOTs vs Vessari vs the dead)
  { id: 's49_perimeter_battle', dur: 50, build(S) {
    let gy = 0.4; const B = battle(S, { style: false, sky: 'smoke', smoke: 0.3, elev: 9, az: 70, terrain: (S2) => { const W = coast(S2, { noSky: true, sky: 'smoke', seaAngle: -Math.PI / 2, shore: 340, flat: 900, flatHeight: 0.4, palms: 60, pcx: 0, pcz: 120, pr: 200, seed: 12, exclude: [{ x0: -90, z0: -330, x1: 90, z1: 80 }] }); if (W.terr) gy = W.terr.heightAt(0, 0); return W; }, soldiers: 80, humansDie: 0.5, crawlers: 150, vessari: 44, pods: 34, tripods: 2, aliensDie: 0.5, crawlerSpeed: 7.5, crawlerDelay: 2, hz: 40, az0: -150, cams: false, blasts: 0.5, zombies: [{ kind: 'zombie_india', n: 70, from: [70, -100], to: [4, -26], spread: [40, 40], toSpread: [30, 40], speed: 6.5, nominal: 5.0, state: 'sprint', arrive: 'lunge', delay: 10, delaySpread: 8, die: { from: 24, to: 49, frac: 0.35 } }, { kind: 'zombie_russia', n: 36, from: [-80, -110], to: [-4, -30], spread: [40, 40], toSpread: [30, 30], speed: 6.0, nominal: 5.0, state: 'sprint', arrive: 'lunge', delay: 15, delaySpread: 8, die: { from: 28, to: 49, frac: 0.3 } }] });
    const gd = S.scene.children.find((c) => c.isMesh && c.geometry && c.geometry.type === 'CircleGeometry'); if (gd) gd.visible = false; const fx = S.fx; const L = B.lane;
    wreck(S, 0, -410, { seed: 11, yaw: 0, pitch: -0.12, roll: 0.05, y: gy - 28 }); breach(S, 0, gy, -60);
    const nB = cnt(46); const bc = createCrowd('robot', nB, { seed: 17 }); S.add(bc); mover(S, bc, nB, { from: [26, L.hz + 22], to: [28, L.hz - 4], spread: [22, 8], toSpread: [24, 10], speed: 2.4, nominal: 1.6, state: 'walk', arrive: 'fire', idle: 'aim', face: [0, -80], seed: 6, delay: 0.5, delaySpread: 3, die: { from: 14, to: 48, frac: 0.35, state: 'fall' } });
    const lk = (c) => link(c, { emotion: 'urgent' }); const n0 = S.lines.length;
    S.fit(2.0, 48.8, [['SERGEANT', 'Hold the line! Aim for the legs!', mil({ emotion: 'urgent' })], ['BEAD (RADIO)', 'Left flank, EENBOTs. Hold until the jeepney moves.', lk('#6fe3ff')], ['JHAZ (RADIO)', 'Zombies on the right! They are eating the aliens!', lk('#7ab8ff')], ['LEON (RADIO)', 'They hate each other. Beautiful.', link('#ff7088', { emotion: 'happy' })], ['MIRRAH (RADIO)', 'The hatch is open at the keel. There!', lk('#ff9fd0')], ['EZRA (RADIO)', 'How many of them are there?!', link('#c3a2ff', { emotion: 'afraid' })], ['JEZ (RADIO)', 'Both sides are bleeding. Look at them.', link('#ffd36e', { emotion: 'awe' })], ['SAM (RADIO)', 'That tripod owns the breach.', link('#ffb061', { emotion: 'serious' })]]);
    const hz = L.hz;
    S.shot(0, 6.5, { from: { pos: [10, 3.0, hz + 16], look: [0, 60, -400], fov: 44 }, to: { pos: [6, 2.6, hz + 12], look: [0, 80, -400], fov: 38 }, handheld: 0.4 });
    S.shot(6.5, 12, { from: { pos: [-70, 34, hz + 40], look: [0, 4, -40], fov: 46 }, to: { pos: [10, 22, hz - 20], look: [0, 6, -70], fov: 42 }, handheld: 0.3 }, 'cut');
    S.shot(12, 18, { from: { pos: [-6, 1.3, hz + 3], look: [0, 2, hz - 60], fov: 54 }, to: { pos: [-3, 1.5, hz - 3], look: [2, 2, hz - 62], fov: 50 }, handheld: 1.1 }, 'cut');
    S.shot(18, 24, { from: { pos: [-34, 2.2, -4], look: [40, 2, -52], fov: 46 }, to: { pos: [-22, 2.0, -14], look: [30, 2, -50], fov: 42 }, handheld: 1.0 }, 'cut');
    S.shot(24, 30, { from: { pos: [4, 1.6, hz - 6], look: [0, 28, -40], fov: 58 }, to: { pos: [4, 1.8, hz - 8], look: [4, 36, -60], fov: 52 }, handheld: 0.8 }, 'cut');
    S.shot(30, 37, { from: { pos: [-26, 3, -22], look: [0, 16, -86], fov: 40 }, to: { pos: [-16, 4, -28], look: [0, 14, -84], fov: 36 }, handheld: 0.5 }, 'cut');
    S.shot(37, 43, { from: { pos: [20, 1.4, hz - 10], look: [30, 1.6, hz - 40], fov: 46 }, to: { pos: [24, 1.6, hz - 18], look: [28, 1.8, hz - 48], fov: 42 }, handheld: 1.0 }, 'cut');
    S.shot(43, 50, { from: { pos: [70, 48, hz + 70], look: [0, 12, -60], fov: 42 }, to: { pos: [96, 70, hz + 110], look: [0, 40, -120], fov: 36 }, handheld: 0.3 }, 'cut');
    S.stamp(0.8, 'DAY 12 — 06:40 PHT', 'THE WRECK — NEGROS ORIENTAL COAST', 5); mood(S, { music: 'battle', amb: 'war_near', level: 0.7, intensity: 0.9 }); S.sfx(3, 'tripod_horn'); S.sfx(12, 'explosion_big'); S.sfx(24, 'explosion_big'); S.sfx(33, 'tripod_horn'); S.sfx(41, 'explosion_big');
  } },
  // ------------------------------------------------------------------ s50 — Sam drives Blessed Mother
  { id: 's50_sam_charge', dur: 34, build(S) {
    let gy = 0.4; const B = battle(S, { style: false, sky: 'smoke', smoke: 0.4, elev: 11, az: 70, terrain: (S2) => { const W = coast(S2, { noSky: true, sky: 'smoke', seaAngle: -Math.PI / 2, shore: 340, flat: 900, flatHeight: 0.4, palms: 40, pcx: 0, pcz: 120, pr: 200, seed: 12, exclude: [{ x0: -90, z0: -330, x1: 90, z1: 80 }] }); if (W.terr) gy = W.terr.heightAt(0, 0); return W; }, soldiers: 34, humansDie: 0.4, crawlers: 70, vessari: 22, pods: 14, tripods: 0, aliensDie: 0.5, crawlerSpeed: 7.5, hz: 36, az0: -140, cams: false, blasts: 0.35 });
    const gd = S.scene.children.find((c) => c.isMesh && c.geometry && c.geometry.type === 'CircleGeometry'); if (gd) gd.visible = false; const fx = S.fx;
    wreck(S, 0, -410, { seed: 11, yaw: 0, pitch: -0.12, roll: 0.05, y: gy - 28 }); breach(S, 0, gy, -60);
    const tr = createTripod(7, { size: 26, autoMove: false }); S.add(tr); const tmp = new V3(); const beams = createBeams({ capacity: 64 }); S.add(beams);
    const jp = safe('jeepney', () => Veh.createJeepney({ seed: 5, name: 'BLESSED MOTHER', palette: 2 })); const je = S.entity(jp); je.at(0, [6.5, gy, 51], Math.PI); je.path(12.0, 23.6, [[6.5, gy, 51], [3.5, gy, 22], [0.4, gy, -18], [0, gy, -63]], { ease: 'in', bank: 0.3 }); je.hide(23.7);
    const sb = City.createSandbagWall ? safe('sandbags', () => City.createSandbagWall(16, 3)) : null; if (sb) { const sbo = sb.root || sb; sbo.position.set(0, gy, 44); S.scene.add(sbo); }
    const bead = person(S, 'bead'), ez = person(S, 'ezra'), sam = person(S, 'sam'), mir = person(S, 'mirrah'), jez = person(S, 'jez'), jhaz = person(S, 'jhaz'), leon = person(S, 'leon');
    const P = (a, x, z, clip, prop) => { a.place(0, [x, gy, z], Math.PI, clip); if (prop) hold(a, prop); a.autoLook = true; };
    P(mir, -2.6, 47.2, 'cower'); P(jez, -1.2, 47.6, 'cower'); P(bead, 0.6, 47.0, 'aim_pistol', 'pistol'); P(jhaz, 2.2, 47.3, 'aim_pistol', 'pistol'); P(leon, -4.2, 46.6, 'aim_shotgun', 'shotgun'); P(ez, 4.4, 47.4, 'idle', 'radio'); sam.place(0, [5.4, gy, 48.6], Math.PI, 'idle'); sam.attach(10.6, 40, je, 'driverSeat', { clip: 'drive' });
    ez.act(23.7, 'shock'); ez.act(26.4, 'kneel'); S.during(0, 34, (t) => { const k = smoothstep(23.6, 27.6, t); tr.root.position.set(0, gy - k * 7.5, -70); tr.root.rotation.set(0, Math.PI, k * 0.5); tr.setGait({ speed: 0, heading: Math.PI }); const jpos = jp.root.position; tr.aimAt(t < 23.6 ? (t > 11 ? jpos : tmp.set(0, 2, 50)) : tmp.set(3, 3, 10)); tr.setCannon(t < 12 || t > 23.4 ? 0 : ((t - 12) % 2.2) / 2.2); });
    for (let i = 0; i < 5; i++) { const ti = 13.4 + i * 2.2; S.on(ti, () => { const m = tr.muzzleWorld(new V3()); const q = jp.root.position.clone(); q.x += (i % 2 ? -3 : 3); q.z -= 2; q.y = 0.5; beams.fire({ from: m, to: q, width: 1.1, life: 0.5, travel: 0.4 }); fx.explosion(q, { size: 16, kind: 'big' }); fx.dust(q, { radius: 6, amount: 1 }); }); S.sfx(ti, 'laser_fire'); }
    S.on(23.6, () => { const p = [0, 2, -63]; fx.explosion(p, { size: 40, kind: 'big' }); fx.debris(p, { count: 40, power: 22, size: 0.4 }); fx.shockwave(p, { size: 60 }); fx.dust(p, { radius: 18, amount: 2 }); fx.fire([0, 1, -62], { size: 5 }); fx.smokeColumn([0, 1, -62], { height: 60, width: 8, life: 14 }); fx.explosion([0, 14, -70], { size: 26, kind: 'big' }); }); S.sfx(23.6, 'explosion_big'); S.sfx(23.8, 'metal_groan'); S.sfx(25.2, 'explosion_far');
    const n0 = S.lines.length; S.fit(1.0, 10.8, [['BEAD', 'That tripod owns the breach.', { emotion: 'serious' }], [sam, 'Ez. Keys.', { emotion: 'serious' }], [ez, "Don't.", { emotion: 'afraid' }], [sam, 'Hold these. Mother has one more run.', { emotion: 'tired' }]].map((l) => (l[0] === 'BEAD' ? [bead, l[1], l[2]] : l)));
    const n1 = S.lines.length; S.fit(12.2, 23.4, [[ez, 'Sam, turn around. Please.', link('#c3a2ff', { emotion: 'afraid' })], [sam, "Can't, Ez. Brakes were always bad.", link('#ffb061', { emotion: 'smirk' })], [sam, 'Best passenger I ever had.', link('#ffb061', { emotion: 'happy' })], [sam, 'Sorry, Ma.', link('#ffb061', { emotion: 'serious' })]]);
    const n2 = S.lines.length; S.fit(26.2, 32.9, [[ez, 'Sam?', { emotion: 'sad' }], [jhaz, 'Ezra. We have to go.', { emotion: 'sad' }]]); const v = new V3();
    S.cover(0, 12, {}); inset(S, 0, 3.0, { from: { pos: [-3, 1.0, 49.5], look: [0, 12, -70], fov: 30 }, to: { pos: [-2, 1.1, 49.0], look: [0, 14, -70], fov: 36 }, handheld: 0.5 });
    S.shot(12, 15, { pos: () => { const p = jp.root.position; return [p.x - 4.5, gy + 1.5, p.z + 9]; }, look: () => { const p = jp.root.position; return [p.x, gy + 1.2, p.z - 5]; }, fov: 46, handheld: 0.9 }, 'cut');
    S.shot(15, 19.6, { pos: () => { const h = sam.headPos(v); return [h.x + 0.9, h.y + 0.1, h.z - 0.7]; }, look: () => sam.headPos(v), fov: 32, handheld: 0.9 }, 'cut');
    S.shot(19.6, 23.6, { pos: () => { const h = sam.headPos(v); return [h.x, h.y + 0.15, h.z + 0.9]; }, look: [0, 12, -68], fov: 52, handheld: 1.3 }, 'cut');
    S.shot(23.6, 26.2, { from: { pos: [-18, 3, -30], look: [0, 8, -66], fov: 40 }, to: { pos: [-20, 4, -34], look: [0, 12, -66], fov: 36 }, shake: 1.0, shakeDecay: 0.5 }, 'cut'); S.cover(26.2, 34, {});
    S.stamp(0.8, 'DAY 12 — 07:05 PHT', 'THE BREACH', 4); mood(S, { music: 'battle', amb: 'war_near', level: 0.5, intensity: 0.75 }); S.sfx(11, 'engine_rev'); S.sfx(14, 'engine_rev'); S.music(23.5, 'silence', { fade: 0.25 }); S.music(27.5, 'sorrow', { fade: 3, intensity: 0.5 }); S.sfx(24.2, 'heartbeat', { bpm: 52 });
    S.callFrame(lt(S, n1, 0) - 0.2, lt(S, n1, 3) + 2.4, 'RADIO — SAM / BLESSED MOTHER', '#ffb061');
  } },
  // ------------------------------------------------------------------ s51 — inside: the warm dark
  { id: 's51_inside_corridor', dur: 36, build(S) {
    const hat = place(S, Inst.createAlienInterior('hatchery')); const cor = place(S, Inst.createAlienInterior('corridor'), [4000, 0, 0]); indoors(S, { color: 0x7affc0, ground: 0x102018, intensity: 0.45, bg: 0x010503 }); const fx = S.fx;
    const names = ['mirrah', 'jez', 'bead', 'ezra', 'jhaz', 'leon']; const hs = names.map((k) => person(S, k)); const [mir, jez, bead, ez, jhaz, leon] = hs; hold(leon, 'shotgun'); hold(mir, 'flashlight'); hold(jhaz, 'pistol');
    const inf1 = alien(S, 'soldier', 11, { name: 'VESSARI' }), inf2 = alien(S, 'soldier', 12, { name: 'VESSARI' }); [inf1, inf2].forEach((a) => { try { a.model.setInfection(1); } catch (e) { /* ignore */ } a.autoLook = false; });
    const nV = cnt(26); const vc = createVessariCrowd(nV); S.add(vc); vc.spawnGroup({ n: nV, center: [0, -8], radius: 9, yawMean: 3, spread: 6.28, state: 'idle', seed: 6, infect: 1 }); vc.commit && vc.commit();
    const gl = new THREE.PointLight(0x55ff44, 12, 30, 2); gl.position.set(0, 3.2, -6); S.scene.add(gl); S.during(0, 36, (t) => { gl.intensity = 10 + 4 * Math.sin(t * 3); });
    const n0 = S.lines.length;
    S.fit(1.0, 35.1, [[jhaz, 'Why is it warm in here?', { emotion: 'worried' }], [mir, 'Body heat. The ship is alive. Breathe shallow.', { emotion: 'serious' }], [ez, 'Great. We are inside a stomach.', { emotion: 'afraid' }], [leon, 'Smells like my bar on a Sunday.', { emotion: 'smirk' }], [leon, 'Contact! Left!', { emotion: 'urgent' }], [bead, 'They are not even looking at us.', { emotion: 'awe' }], [mir, 'Their tether is screaming.', { emotion: 'serious' }], [jez, 'The eggs. They are sick. All of them.', { emotion: 'sad' }]]);
    const tL = lt(S, n0, 4) - 0.2; const split = lt(S, n0, 5) - 0.5;
    const cp = A(cor, 'start'); mir.place(0, [cp.p[0] + 0.6, 0.1, 21.0], Math.PI, 'walk'); jez.place(0, [cp.p[0] - 0.7, 0.1, 21.8], Math.PI, 'walk'); bead.place(0, [cp.p[0] + 0.5, 0.1, 22.9], Math.PI, 'walk'); ez.place(0, [cp.p[0] - 0.6, 0.1, 23.4], Math.PI, 'walk'); jhaz.place(0, [cp.p[0] + 0.6, 0.1, 24.4], Math.PI, 'walk'); leon.place(0, [cp.p[0] - 0.5, 0.1, 20.4], Math.PI, 'aim_walk');
    [[mir, 0.5, 4.0], [jez, -0.7, 5.2], [bead, 0.5, 6.4], [ez, -0.6, 7.4], [jhaz, 0.6, 8.4], [leon, -0.4, 1.2]].forEach(([a, dx, z], i) => a.go(0.1, [[cp.p[0] + dx, z]], { speed: 1.5, clip: i === 5 ? 'aim_walk' : 'walk', endClip: i === 5 ? 'aim_shotgun' : 'idle_alert', endYaw: Math.PI }));
    leon.act(tL - 0.2, 'aim_shotgun', { yaw: Math.PI });
    inf1.place(0, [cor.root.position.x + 0.6, 0.1, -11], 0, 'infected_idle'); inf2.place(0, [cor.root.position.x - 0.8, 0.1, -13.4], 0.2, 'infected_idle'); inf1.act(tL + 0.1, 'infected_lunge'); inf1.act(tL + 0.9, 'die'); inf2.act(tL + 0.3, 'infected_idle', { yaw: 0.3 }); inf2.act(tL + 1.3, 'die');
    S.on(tL + 0.8, () => { const p = new V3(cor.root.position.x - 0.4, 1.3, 2.6); fx.muzzleFlash(p, new V3(0, 0, -1), { size: 1.4 }); fx.sparks(new V3(cor.root.position.x + 0.5, 1.2, -6), { count: 20, color: 0x66ff44 }); }); S.sfx(tL + 0.8, 'shotgun'); S.sfx(tL + 1.5, 'shotgun'); S.sfx(tL + 0.1, 'zombie_roar');
    const hp = A(hat, 'walkA'); mir.place(split, [hp.p[0] + 0.6, 0.5, 26], Math.PI, 'walk'); jez.place(split, [hp.p[0] - 0.8, 0.5, 27.2], Math.PI, 'walk'); bead.place(split, [hp.p[0] + 1.0, 0.5, 28.3], Math.PI, 'walk'); ez.place(split, [hp.p[0] - 1.0, 0.5, 29.6], Math.PI, 'walk'); jhaz.place(split, [hp.p[0] + 0.2, 0.5, 30.8], Math.PI, 'walk'); leon.place(split, [hp.p[0] - 0.2, 0.5, 31.9], Math.PI, 'aim_walk');
    [[mir, 0.6, 0], [jez, -0.8, 1.2], [bead, 1.0, 2.2], [ez, -1.0, 3.6], [jhaz, 0.2, 4.8], [leon, -0.2, 6.0]].forEach(([a, dx, z], i) => a.go(split + 0.1, [[hp.p[0] + dx, z - 6]], { speed: 1.3, clip: i === 5 ? 'aim_walk' : 'walk', endClip: 'idle_alert' }));
    S.cover(0, split, { bounds: K.bounds(cor) }); inset(S, 0, 2.6, { ...camAt(cor, 'camAlong'), fov: 42, handheld: 0.4 }); inset(S, tL - 0.4, tL + 2.6, { from: { pos: [cor.root.position.x + 0.3, 0.9, 9], look: [cor.root.position.x, 1.2, -9], fov: 42 }, to: { pos: [cor.root.position.x + 0.2, 1.0, 5.4], look: [cor.root.position.x, 1.2, -9], fov: 36 }, handheld: 1.0 }); punch(S, tL + 0.85, 1.0, 2.0);
    S.cover(split, 36, { bounds: K.bounds(hat), transition: 'dip' }); inset(S, split, split + 4, { from: { ...camAt(hat, 'camAlong') }, to: { pos: [0, 2.0, 27], look: [0, 1.5, 4], fov: 40 }, handheld: 0.4 }, 'dip'); const hc = camAt(hat, 'camEgg'); inset(S, 31.4, 36, { pos: hc.pos, look: hc.look, fov: 40, handheld: 0.4 });
    S.stamp(0.8, 'DAY 12 — 07:21 PHT', 'INSIDE THE GROUNDED FLAGSHIP — DECK 9', 4.5); mood(S, { music: 'horror', amb: 'alien_hum', level: 0.5, intensity: 0.65 }); S.amb(split, 'fire', 0.12, 2); S.sfx(split + 6, 'bio_squelch'); S.sfx(split + 11, 'alien_growl', { gain: 0.5 });
  } },
  // ------------------------------------------------------------------ s52 — Leon holds the corridor
  { id: 's52_leon_stand', dur: 30, build(S) {
    const cor = place(S, Inst.createAlienInterior('corridor')); indoors(S, { color: 0x88ffd0, ground: 0x10181a, intensity: 0.4, bg: 0x010305 }); const fx = S.fx;
    const leon = person(S, 'leon'), mir = person(S, 'mirrah'), jhaz = person(S, 'jhaz'), jez = person(S, 'jez'), bead = person(S, 'bead'), ez = person(S, 'ezra'); hold(leon, 'shotgun');
    leon.place(0, [0, 0.1, 0], 0, 'aim_shotgun'); const tD = 25.2; leon.act(tD, 'fall', { yaw: 0 }); leon.act(tD + 2.2, 'dead', { yaw: 0 }); leon.autoLook = false; leon.gaze([0, 1.3, 14]);
    const run = [[mir, -0.5, 0.0], [jez, 0.8, 0.5], [bead, -0.9, 1.0], [ez, 0.3, 1.6], [jhaz, -0.2, 2.2]]; run.forEach(([a, x, d], i) => { a.place(0, [x, 0.1, 21 + i * 1.3], Math.PI, 'sprint'); a.go(0.1 + d * 0.2, [[x * 0.6, -15 - i * 0.8]], { speed: 5.4, clip: 'sprint', ramp: 0.3, endClip: 'idle_alert', endYaw: 0 }); a.autoLook = true; });
    run.forEach(([a], i) => { a.go(19.0 + i * 0.35, [[0, -22.5]], { speed: 3.2, clip: 'jog' }); a.hide(24.0 + i * 0.3); });
    const nV = cnt(34); const vc = createVessariCrowd(nV); S.add(vc); mover(S, vc, nV, { from: [0, 30], to: [0, 3.4], spread: [4.0, 22], toSpread: [3.6, 2], speed: 4.4, nominal: 5.2, state: 'run', arrive: 'roar', seed: 4, delay: 6.0, delaySpread: 12, infect: { from: -4, to: -3 }, die: { from: 8, to: 25, frac: 0.82, state: 'fall', curve: 0.9 } });
    const nC = cnt(30); const cs = createCrawlerSwarm(nC); S.add(cs); mover(S, cs, nC, { from: [0, 34], to: [0, 3.0], spread: [4.5, 24], toSpread: [3.8, 2], speed: 5.2, nominal: 5.5, state: 'run', arrive: 'screech', seed: 7, delay: 7.0, delaySpread: 14, infect: { from: -4, to: -3 }, die: { from: 9, to: 25, frac: 0.8, state: 'dead', curve: 0.9 } });
    for (let k = 0; k < 14; k++) { const tk = 8.6 + k * 1.15; S.sfx(tk, 'shotgun', { gain: 0.8 }); S.on(tk, () => { const p = new V3((k % 2 ? 0.2 : -0.2), 1.3, 1.3); fx.muzzleFlash(p, new V3(0, 0, 1), { size: 1.5 }); fx.sparks(new V3(0, 1.0, 6 + (k % 4)), { count: 14, color: 0x66ff44 }); }); }
    const n0 = S.lines.length; S.fit(3.2, 24.6, [[mir, 'Leon! Leon, come on!', { emotion: 'urgent' }], [leon, 'Go! I have the door!', { emotion: 'urgent' }], [jhaz, 'We are not leaving you!', { emotion: 'afraid' }], [leon, 'Somebody buys the next round.', { emotion: 'smirk' }], [leon, "Mirrah! Bar tab's on the house. Forever.", { emotion: 'happy' }], [leon, 'Last call, you ugly bastards!', { emotion: 'angry' }]]);
    S.on(tD, () => { fx.sparks(new V3(0, 1.0, 1.5), { count: 10, color: 0x66ff44 }); });
    const cb = K.bounds(cor); S.cover(4.0, tD - 0.4, { bounds: cb }); S.shot(0, 4.0, { from: { pos: [0.1, 1.5, -1.6], look: [0, 1.3, 20], fov: 46 }, to: { pos: [0.2, 1.5, -1.0], look: [0, 1.3, 14], fov: 40 }, handheld: 0.8 }); inset(S, 14.0, 17.5, { from: { pos: [0.1, 1.2, 6.5], look: [0, 1.2, -2], fov: 38 }, to: { pos: [0.1, 1.3, 4.6], look: [0, 1.3, -2], fov: 32 }, handheld: 1.0 });
    S.shot(tD - 0.4, tD + 2.6, { pos: [0.6, 1.1, 5.2], look: [0, 1.0, 1.4], fov: 40, shake: 0.9, shakeDecay: 1.0 }, 'cut'); S.shot(tD + 2.6, 30, { from: { pos: [0.7, 1.7, 2.8], look: [0, 0.35, 0.3], fov: 34 }, to: { pos: [0.5, 1.0, 1.3], look: [0, 0.3, 0.2], fov: 28 }, handheld: 0.15 }, 'cut');
    S.stamp(0.8, 'DAY 12 — 07:33 PHT', 'DECK 9 — SERVICE CORRIDOR', 4); mood(S, { music: 'tension_high', amb: 'alien_hum', level: 0.45, intensity: 0.9 }); S.music(tD - 0.2, 'silence', { fade: 0.3 }); S.music(tD + 3.2, 'sorrow', { fade: 3.5, intensity: 0.35 }); S.sfx(tD + 0.1, 'shotgun'); S.sfx(tD + 0.8, 'zombie_roar', { gain: 0.5 }); S.sfx(tD + 3.5, 'heartbeat', { bpm: 46 });
  } },
  // ------------------------------------------------------------------ s53 — Thessik
  { id: 's53_officer_confront', dur: 50, build(S) {
    const br = place(S, Inst.createAlienInterior('bridge')); indoors(S, { color: 0x9fe8ff, ground: 0x203040, intensity: 0.55, bg: 0x02060a });
    const th = alien(S, 'officer', 3), kuur = alien(S, 'drone', 2, { name: 'KUUR' }), g1 = alien(S, 'soldier', 21, { name: 'VESSARI' }), g2 = alien(S, 'soldier', 22, { name: 'VESSARI' }); [g1, g2].forEach((a) => { a.autoLook = false; try { a.model.setInfection(0.3); } catch (e) { /* ignore */ } });
    th.place(0, [0, 0.1, -3.4], 0, 'idle'); kuur.place(0, [4.6, 0.1, -2.8], 0.4, 'idle_alert'); g1.place(0, [-3.4, 0.1, -2.4], 0.25, 'aim'); g2.place(0, [3.2, 0.1, -2.1], -0.25, 'aim');
    const mir = person(S, 'mirrah'), bead = person(S, 'bead'), jez = person(S, 'jez');
    [[mir, -1.7, 6.6], [bead, 0.2, 7.4], [jez, 1.9, 6.7]].forEach(([a, x, z], i) => { a.place(0, [x * 0.7, 0.1, 17 + i * 0.8], Math.PI, 'walk'); a.go(0.1, [[x, z]], { speed: 1.6, clip: 'walk', endClip: 'idle', endYaw: Math.PI }); });
    const n0 = S.lines.length; const al = (c) => ({ style: 'alien', color: COL.alien, ...c });
    S.fit(5.0, 49.0, [[th, 'Stop, small ones.', { emotion: 'cold' }], [mir, 'We did not come to fight you.', { emotion: 'serious' }], [th, 'Our children bleed green in the lower decks.', { emotion: 'angry' }], [bead, 'We never meant to eat your children.', { emotion: 'sad' }], [th, 'Our world is dying. We crossed the dark to find one alive.', { emotion: 'tired' }], [jez, 'Every empire says it came to live.', { emotion: 'serious' }], [th, 'Every empire is right.', { emotion: 'cold' }], [mir, 'Your honour will kill you.', { emotion: 'serious' }], [th, 'No brother left behind. A vow older than law.', { emotion: 'serious' }], ['THE HIERARCH', 'Thessik. Purge the coast. The vow ends here.', al({ emotion: 'cold' })], [th, 'You have ten minutes of my honour. The node is below.', { emotion: 'tired' }]]);
    th.act(lt(S, n0, 9), 'idle_alert'); th.act(lt(S, n0, 10) - 0.2, 'stagger');
    S.cover(0, 50, { bounds: K.bounds(br), dist: 2.0 }); const cA = camAt(br, 'camAisle'); inset(S, 0, 4.8, { from: { pos: cA.pos, look: [0, 2.4, -4], fov: 44 }, to: { pos: [0, 1.7, 14], look: [0, 2.6, -4], fov: 40 }, handheld: 0.35 });
    const cW = camAt(br, 'camWindow'); inset(S, lt(S, n0, 9) - 0.3, lt(S, n0, 9) + 3.6, { from: { pos: [0, 4.2, -2], look: [0, 6, -26], fov: 56 }, to: { pos: [0, 4.4, -4], look: [0, 6, -26], fov: 46 }, handheld: 0.3 });
    S.callFrame(lt(S, n0, 9) - 0.2, lt(S, n0, 9) + 3.5, 'TETHER LINK — THE HIERARCH', '#aef3ff'); S.tag(lt(S, n0, 9) + 0.2, 50, 'ORBITAL PURGE — ARMED — T-10:00', { color: '#ff5a4a' });
    S.stamp(0.8, 'DAY 12 — 07:44 PHT', 'GROUNDED FLAGSHIP — COMMAND BRIDGE', 5); mood(S, { music: 'alien', amb: 'alien_hum', level: 0.45, intensity: 0.55 }); S.music(lt(S, n0, 9) - 0.2, 'tension_high', { fade: 2, intensity: 0.8 }); S.sfx(lt(S, n0, 9) - 0.2, 'alarm'); S.sfx(lt(S, n0, 8), 'alien_click');
  } },
  // ------------------------------------------------------------------ s54 — the node
  { id: 's54_tether_upload', dur: 45, build(S) {
    const hat = place(S, Inst.createAlienInterior('hatchery')); indoors(S, { color: 0x7affc0, ground: 0x102018, intensity: 0.5, bg: 0x010503 }); const fx = S.fx;
    const th = alien(S, 'officer', 3), kuur = alien(S, 'drone', 2, { name: 'KUUR' }); const mir = person(S, 'mirrah'), bead = person(S, 'bead'), jez = person(S, 'jez'); hold(mir, 'scalpel'); hold(bead, 'tablet');
    th.place(0, [-0.4, 0.5, -10.5], 0, 'idle'); kuur.place(0, [3.4, 0.5, -11.8], 0.4, 'idle_alert'); kuur.autoLook = false;
    const home = [[mir, -0.8, 11], [bead, 0.5, 11.8], [jez, 1.4, 11]]; home.forEach(([a, x, z]) => { a.place(0, [x, 0.5, z], Math.PI, 'walk'); a.go(0.1, [[x * 0.8, -5.5 + (x > 0 ? 0.6 : 0)]], { speed: 1.5, clip: 'walk', endClip: 'idle_alert', endYaw: Math.PI }); });
    const lat = lattice(S, [0, 5.2, -9], { seed: 5, len: 1.6, width: 0.7 }); lat.group.scale.setScalar(20); lat.group.rotation.y = 0.0; lat.light.distance = 60; const motherP = A(hat, 'mother').p;
    const n0 = S.lines.length; S.fit(1.0, 43.2, [[mir, 'Thessik. We need the node.', { emotion: 'serious' }], [th, "You ask me to open my people's heart.", { emotion: 'cold' }], [bead, 'It spreads along the tether. It stops the purge.', { emotion: 'serious' }], [jez, 'Let them break the vow. Not you.', { emotion: 'urgent' }], [th, 'I held my brothers while they bled.', { emotion: 'tired' }], [th, 'Go. I have not seen you.', { emotion: 'serious' }], [bead, 'Carrier armed. Mirrah, the strain.', { emotion: 'serious' }], [mir, 'Injecting. Three, two, one.', { emotion: 'serious' }], [bead, 'Upload at seventy.', { emotion: 'urgent' }], [mir, "It's in the tether.", { emotion: 'awe' }], [jez, 'Look at the walls.', { emotion: 'awe' }], [th, 'I can feel them. All of them.', { emotion: 'sad' }]]);
    const tS = lt(S, n0, 5) - 0.6, tU0 = lt(S, n0, 6) + 0.2, tU1 = lt(S, n0, 9) - 0.1; th.go(tS, [[-4.2, -9.8]], { speed: 1.2, clip: 'walk', endClip: 'idle', endYaw: 0.6 });
    home.forEach(([a, x], i) => a.go(tS + 1.4 + i * 0.2, [[x * 0.5 + (i - 1) * 0.9, -19.2 + (i % 2) * 0.6]], { speed: 2.1, clip: 'walk', endClip: i === 1 ? 'typing' : i === 0 ? 'examine' : 'clipboard', endYaw: Math.PI }));
    holoPanel(S, [0.5, 1.7, -20.6], 1.5, 0.84, (c, w, h, t) => { const k = smoothstep(tU0, tU1, t); c.fillStyle = 'rgba(8,40,52,0.85)'; c.fillRect(0, 0, w, h); c.strokeStyle = k >= 1 ? '#9aff6a' : '#6fe3ff'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = c.strokeStyle; c.font = `700 ${h * 0.12}px sans-serif`; c.fillText('CARRIER UPLOAD — ZIA // 0', 20, h * 0.2); c.fillRect(20, h * 0.4, (w - 40) * k, h * 0.14); c.strokeRect(20, h * 0.4, w - 40, h * 0.14); c.font = `600 ${h * 0.12}px sans-serif`; c.fillText(`${Math.round(k * 100)}%  ${k >= 1 ? 'ROUTED' : 'ROUTING TETHER'}`, 20, h * 0.78); }, { t0: tU0 - 0.4, t1: 45 });
    S.during(0, 45, (t) => { const on = smoothstep(tU0, tU0 + 2.4, t) * 0.9; lat.set(on, t); if (t > tU1) { lat.setColor(0x6dff3c); lat.light.intensity = 40 + 30 * Math.sin(t * 6); } else lat.setColor(0x66eaff); });
    S.on(tU1, () => { fx.infectPulse(new V3(motherP[0], 3, motherP[2]), { radius: 40 }); fx.infectPulse(new V3(0, 3, -8), { radius: 30 }); fx.sporeCloud([motherP[0], 1.5, motherP[2] + 4], { radius: 8, density: 1 }); }); S.post(tU1, tU1 + 0.6, 'flash', 0.5, 0, 'out');
    const cm = camAt(hat, 'camMother'); const ca = camAt(hat, 'camAlong');
    S.cover(0, 45, { bounds: K.bounds(hat), dist: 1.6 }); inset(S, 0, 3.4, { from: { ...ca, fov: 42 }, to: { pos: [0, 2.0, 22], look: [0, 1.6, -4], fov: 38 }, handheld: 0.35 });
    inset(S, tU0 + 1.0, tU0 + 6, { from: { pos: [-1.6, 1.7, -16.6], look: [0.5, 1.7, -20.4], fov: 36 }, to: { pos: [-0.2, 1.8, -17.6], look: [0.5, 1.7, -20.5], fov: 28 }, handheld: 0.4 });
    inset(S, tU1 - 0.2, 45, { from: { pos: [0, 2.4, -14], look: [0, 5, -26], fov: 44 }, to: { pos: [0, 3.2, -9], look: [0, 8, -26], fov: 56 }, handheld: 0.3 });
    S.stamp(0.8, 'DAY 12 — 08:02 PHT', 'THE NODE — DECK 14', 4.5); mood(S, { music: 'alien', amb: 'alien_hum', level: 0.5, intensity: 0.5 }); S.sfx(tU0, 'power_up'); S.sfx(tU1, 'infect_zap'); S.sfx(tU1 + 0.2, 'alien_growl', { gain: 0.9 }); S.music(tU1 - 0.3, 'resolve', { fade: 1.5, intensity: 0.8 });
  } },
  // ------------------------------------------------------------------ s55 — the fleet catches it (orbit)
  { id: 's55_fleet_infected', dur: 45, build(S) {
    const sp = space(S, { lat: 10, lon: 122, sun: [0.55, 0.2, 0.8], cityLights: 0.35 }); const fx = S.fx; const rr = new RNG(77);
    const heroes = [sp.ship(31, 14, 117, 430, 800, 0.2), sp.ship(32, 8, 127, 400, 700, -0.5), sp.ship(33, 17, 125, 470, 760, 0.9)]; const hp = heroes.map((h) => h.root.position.clone());
    const mother = safe('mothership', () => createMothership(5, { diameter: 1400 })); const mp = sp.at(11, 121, 540, new V3()); if (mother) { mother.root.scale.setScalar(0.001); mother.root.position.copy(mp); mother.root.lookAt(mp.clone().multiplyScalar(1.2)); S.add(mother); }
    const list = []; for (let i = 0; i < 34; i++) list.push([5 + rr.next() * 19, 106 + rr.next() * 34, 360 + rr.next() * 240, 450 + rr.next() * 350]); const nF = list.length; const fleet = createFleet(nF); S.add(fleet);
    const base = list.map((s) => sp.at(s[0], s[1], s[2], new V3())); const yaws = list.map(() => rr.next() * 6.28); const fail = list.map((_, i) => (i % 5 < 2 ? 29 + rr.next() * 6 : 1e9)); const leave = list.map(() => 31 + rr.next() * 4); const T = { x: 0, y: 0, z: 0, yaw: 0, scale: 1, infect: 0 }; const P = new V3(), R = new V3();
    S.updaters.push({ t0: 0, t1: 46, fn: (t) => { for (let i = 0; i < nF; i++) { const b = base[i]; R.copy(b).normalize(); P.copy(b); let sc = list[i][3] / 1000; const alt = b.length() - R_E; if (t > fail[i]) { const u = t - fail[i]; const d = u * u * 3.0; if (d >= alt - 4) sc = 0; else P.addScaledVector(R, -d); } else if (t > leave[i]) { const u = t - leave[i]; P.addScaledVector(R, u * u * 4.0); } T.x = P.x; T.y = P.y; T.z = P.z; T.yaw = yaws[i] + (t > fail[i] ? (t - fail[i]) * 0.4 : 0); T.scale = sc; T.infect = clamp((t - 11 - (i % 9) * 0.9) / 5); fleet.set(i, T); } fleet.commit && fleet.commit(); } });
    for (let i = 0; i < nF; i++) if (fail[i] < 1e8) { const u = Math.sqrt(Math.max(0.1, (base[i].length() - R_E - 4) / 3.0)); const q = base[i].clone().normalize().multiplyScalar(R_E + 6); S.on(fail[i] + u, () => { fx.explosion(q, { size: 1.6, kind: 'big' }); }); }
    S.during(0, 46, (t) => { if (mother) { mother.setCharge && mother.setCharge(smoothstep(0, 7.5, t) * (1 - smoothstep(7.8, 9.5, t))); mother.setInfection && mother.setInfection(smoothstep(13, 23, t)); mother.setThrust && mother.setThrust(t > 27 ? 0.1 : 0.5); } heroes.forEach((h, i) => { h.setInfection && h.setInfection(smoothstep(12 + i * 2, 17 + i * 2, t)); h.setLights && h.setLights(t > 26 ? 0.25 + 0.5 * Math.abs(Math.sin(t * 7 + i)) * (1 - smoothstep(26, 38, t)) : 1); h.setThrust && h.setThrust(t > 26 ? 0 : 0.5); }); });
    const hit = [[10.3, 123.9], [14.6, 121.0], [7.1, 125.6]]; hit.forEach((h, i) => { const to = sp.at(h[0], h[1], 0, new V3()); S.on(7.6 + i * 0.7, () => { sp.beams.fire({ from: mp, to, width: 0.16, life: 1.5, color: 0xa8f6ff }); }); S.on(8.2 + i * 0.7, () => { fx.explosion(to, { size: 3.2, kind: 'big' }); fx.shockwave && fx.shockwave(to, { size: 9 }); }); S.sfx(7.6 + i * 0.7, 'laser_fire', { long: true }); });
    heroes.forEach((h, i) => { const tx = 28.5 + i * 3.8; S.on(tx, () => { fx.explosion(hp[i], { size: 0.45, kind: 'big' }); }); S.during(tx + 0.2, 60, () => { h.root.visible = false; }); S.sfx(tx, 'explosion_far'); });
    [[10.5, 31.0, 0, 0.5], [16, 34.2, 0, 0.4], [21, 36.1, 0, 0.4]].forEach((c) => S.on(c[1], () => { fx.explosion(mp.clone().add(new V3(0.5, 0.2, 0.2)), { size: 0.6, kind: 'big' }); }));
    const n0 = S.lines.length; const al = (c) => ({ style: 'alien', color: COL.alien, ...c });
    S.fit(2.0, 43.8, [['THE HIERARCH', 'Fire. Cleanse the coast.', al({ emotion: 'cold' })], ['FLEET HERALD', 'Hierarch, the lattice is turning green.', al({ emotion: 'afraid' })], ['THE HIERARCH', 'Isolate the infected ships.', al({ emotion: 'serious' })], ['FLEET HERALD', 'Every ship. Every one.', al({ emotion: 'afraid' })], ['THE HIERARCH', 'Sever the tether.', al({ emotion: 'cold' })], ['FLEET HERALD', 'Our brothers on the ground—', al({ emotion: 'afraid' })], ['THE HIERARCH', 'Sever it. Now.', al({ emotion: 'angry' })], ['WARLORD THESSIK', 'Hierarch... the vow.', al({ emotion: 'sad' })]]);
    S.shot(0, 7.5, { from: { pos: sp.cam(10, 119, R_E + 2200, 500, 800), look: mp.toArray(), fov: 42 }, to: { pos: sp.cam(10, 120, R_E + 1500, 220, 500), look: mp.toArray(), fov: 36 } });
    S.shot(7.5, 12.5, { pos: [mp.x + 0.9, mp.y + 0.45, mp.z + 0.6], look: mp.toArray(), fov: 40, handheld: 0.15 }, 'cut');
    S.shot(12.5, 22, { from: { pos: [hp[0].x + 0.55, hp[0].y + 0.3, hp[0].z + 0.55], look: hp[0].toArray(), fov: 42 }, to: { pos: [hp[0].x + 0.35, hp[0].y + 0.25, hp[0].z + 0.6], look: hp[0].toArray(), fov: 34 } }, 'cut');
    S.shot(22, 29.5, { from: { pos: sp.cam(10, 123, R_E + 1000, 200, 300), look: mp.toArray(), fov: 44 }, to: { pos: sp.cam(10, 123, R_E + 900, 100, 250), look: mp.toArray(), fov: 36 }, handheld: 0.2 }, 'cut');
    S.shot(29.5, 38, { from: { pos: sp.cam(9, 122, R_E + 1300, 0, 250), look: sp.at(9, 122, 250).toArray(), fov: 52 }, to: { pos: sp.cam(9, 122, R_E + 1100, 0, 120), look: sp.at(9, 122, 60).toArray(), fov: 46 }, handheld: 0.15 }, 'cut');
    S.shot(38, 45, { from: { pos: sp.cam(10, 122, R_E * 1.25, 0, 0), look: [0, 0, 0], fov: 44 }, to: { pos: sp.cam(10, 122, R_E * 1.9, 0, 0), look: [0, 0, 0], fov: 44 } }, 'dip');
    S.stamp(0.8, 'DAY 12 — 08:12 PHT', 'LOW EARTH ORBIT — THE VESSARI FLEET', 5); mood(S, { music: 'tension_high', amb: 'space', level: 0.4, intensity: 0.7 }); S.music(12.5, 'dread', { fade: 3, intensity: 0.75 }); S.music(26, 'alien', { fade: 1.5, intensity: 0.9 }); S.music(38, 'sorrow', { fade: 4, intensity: 0.4 }); S.sfx(14, 'infect_zap'); S.sfx(25.8, 'glitch'); S.sfx(26.2, 'power_down');
    S.post(25.8, 26.1, 'chroma', 0.25, 1.4); S.post(26.1, 27.4, 'chroma', 1.4, 0.25);
  } },
  // ------------------------------------------------------------------ s56 — the flagship dies
  { id: 's56_ship_collapse', dur: 40, build(S) {
    const sky = K.skyFor(S, 'dawn', { elev: 7, az: 150, smoke: 0.3 }); const hold = place(S, Inst.createAlienInterior('hold'), [7000, 0, 0]); const hemi = new THREE.HemisphereLight(0x9fe8ff, 0x203040, 0.5); S.scene.add(hemi); const fx = S.fx;
    const W = coast(S, { noSky: true, seaAngle: -Math.PI / 2, shore: 340, flat: 900, flatHeight: 0.4, palms: 50, pcx: 0, pcz: 130, pr: 200, seed: 12, exclude: [{ x0: -90, z0: -330, x1: 90, z1: 80 }] }); const gy = W.terr ? W.terr.heightAt(0, 0) : 0.4;
    const wk = wreck(S, 0, -410, { seed: 11, yaw: 0, pitch: -0.12, roll: 0.05, y: gy - 28 }); breach(S, 0, gy, -60);
    S.during(0, 40, (t) => { const k = smoothstep(24, 40, t); if (wk) { wk.root.position.y = gy - 28 - k * 75; wk.root.rotation.z = 0.05 + k * 0.28; wk.root.rotation.x = -0.12 + k * 0.1; wk.ship.setLights && wk.ship.setLights(0.45 * (1 - smoothstep(22, 34, t))); wk.ship.setInfection && wk.ship.setInfection(smoothstep(0, 18, t)); } hemi.intensity = t < 22 ? 0.3 + 0.25 * Math.abs(Math.sin(t * 5.3) * Math.sin(t * 1.7)) : 0.5; });
    const th = alien(S, 'officer', 3), kuur = alien(S, 'drone', 2, { name: 'KUUR' }); const mir = person(S, 'mirrah'), bead = person(S, 'bead'), jez = person(S, 'jez'), jhaz = person(S, 'jhaz'), ez = person(S, 'ezra'); hold_(ez, 'keys'); hold_(jhaz, 'pen');
    const bd = A(hold, 'bayDoor'); th.place(0, [7000, 0.1, -6], 0, 'idle_alert'); kuur.place(0, [7003.5, 0.1, -8.5], 0.3, 'idle'); kuur.autoLook = false; kuur.act(14, 'die'); try { kuur.model.setInfection(1); } catch (e) { /* ignore */ }
    const crew = [[mir, 0], [bead, 1], [jez, 2], [jhaz, 3], [ez, 4]]; crew.forEach(([a, i]) => { a.place(0, [7000 - 2 + i * 1.1, 0.1, 30 + i * 1.2], Math.PI, 'sprint'); a.go(0.1, [[7000 - 2.4 + i * 1.3, -2.5 + (i % 2) * 0.8]], { speed: 5.0, clip: 'sprint', ramp: 0.3, endClip: 'idle_alert', endYaw: Math.PI }); });
    const n0 = S.lines.length;
    S.fit(6.0, 21.4, [[th, 'The ship is dying. I feel every deck.', { emotion: 'tired' }], [mir, 'Come with us.', { emotion: 'urgent' }], [th, 'A commander does not leave his ship.', { emotion: 'serious' }], [jez, 'You chose them over the Hierarch.', { emotion: 'awe' }], [th, 'I chose the vow.', { emotion: 'serious' }], [th, 'Tell your people we only wanted a home.', { emotion: 'sad' }], [mir, 'I will.', { emotion: 'sad' }]]);
    const nX = S.lines.length; S.fit(26.0, 38.6, [[ez, 'Run! It is coming down!', { emotion: 'afraid' }], [jhaz, "Don't look back!", { emotion: 'urgent' }]], { lead: 0.1 });
    crew.forEach(([a, i]) => { a.go(21.8 + i * 0.12, [[7000, 0.1, -30]], { speed: 5.2, clip: 'sprint', ramp: 0.3 }); a.hide(23.4 + i * 0.05); });
    const ex = [[0.4, -58], [-1.2, -46], [1.0, -34], [-0.3, -22], [0.9, -10]]; crew.forEach(([a, i]) => { a.place(23.6, [ex[i][0], gy, ex[i][1] - 4], 0.0, 'sprint'); a.go(23.7 + i * 0.1, [[ex[i][0] * 2, gy, 28 + i * 3], [ex[i][0] * 3, gy, 70]], { speed: 6.0, clip: 'sprint', ramp: 0.3 }); });
    ez.act(31.2, 'stagger'); jhaz.act(31.5, 'stagger');
    for (let k = 0; k < 8; k++) { const tk = 3 + k * 2.6; S.on(tk, () => { const p = [7000 + (k % 2 ? 9 : -9), 12 + (k % 3) * 2, -8 + k * 6 - 20]; fx.debris(p, { count: 26, power: 14, size: 0.5 }); fx.dust(p, { radius: 6, amount: 1 }); fx.explosion(p, { size: 7 + k, kind: 'ground' }); }); S.sfx(tk, k % 2 ? 'metal_groan' : 'explosion_big', { gain: 0.8 }); }
    for (let k = 0; k < 7; k++) { const tk = 25.4 + k * 2.0; S.on(tk, () => { const p = [(k % 2 ? 1 : -1) * (20 + k * 9), 40 + (k % 3) * 25, -330 - k * 22]; fx.explosion(p, { size: 90 + k * 12, kind: 'big' }); fx.debris(p, { count: 40, power: 28, size: 1.4 }); fx.smokeColumn([p[0], 20, p[2]], { height: 220, width: 28, life: 20 }); }); S.sfx(tk, 'explosion_big'); }
    S.on(31.0, () => { fx.shockwave([0, 1, -40], { size: 220 }); fx.dust([0, 1, 10], { radius: 40, amount: 2 }); }); S.sfx(31.0, 'explosion_far');
    S.cover(0, 22, { bounds: K.bounds(hold), dist: 2.0 }); const bc = camAt(hold, 'camBay'); S.shot(0, 3.2, { from: { pos: bc.pos, look: [7000, 3, -10], fov: 50 }, to: { pos: [7000 + 6, 3.4, 18], look: [7000, 3, -10], fov: 44 }, handheld: 0.9, shake: 0.35 });
    S.shot(22, 26, { from: { pos: [-14, 2.0, 48], look: [0, 6, -50], fov: 40 }, to: { pos: [-10, 2.6, 36], look: [0, 6, -50], fov: 36 }, handheld: 0.9 }, 'dip');
    S.shot(26, 32, { from: { pos: [-6, 1.5, 8], look: [0, 3, -60], fov: 48 }, to: { pos: [-4, 1.6, 14], look: [0, 4, -70], fov: 44 }, handheld: 1.0, shake: 0.4 }, 'cut'); S.shot(32, 36, { pos: [6, 1.0, 60], look: [0, 24, -300], fov: 36, shake: 0.5, shakeDecay: 0.3 }, 'cut'); S.shot(36, 40, { from: { pos: [-30, 18, 120], look: [0, 30, -330], fov: 40 }, to: { pos: [-60, 40, 150], look: [0, 10, -340], fov: 36 }, handheld: 0.3 }, 'cut');
    [6.5, 11.2, 15.8, 19.4].forEach((t) => punch(S, t, 0.8, 2.0)); punch(S, 31.0, 1.2, 1.4);
    S.stamp(0.8, 'DAY 12 — 08:26 PHT', 'GROUNDED FLAGSHIP — LOWER HOLD', 4.5); S.stamp(23.8, 'DAY 12 — 08:31 PHT', 'THE BEACH', 3.5); mood(S, { music: 'sorrow', amb: 'alien_hum', level: 0.5, intensity: 0.6 }); S.music(22.6, 'tension_high', { fade: 1.5, intensity: 0.9 }); S.amb(23.4, 'ocean', 0.4, 2); S.music(33, 'sorrow', { fade: 4, intensity: 0.45 }); S.sfx(15, 'alien_growl'); S.sfx(18, 'power_down');
  } },
  // ------------------------------------------------------------------ s57 — morning after
  { id: 's57_dawn_aftermath', dur: 40, build(S) {
    const W = coast(S, { sky: 'dawn', elev: 3, az: 175, smoke: 0.12, seaAngle: Math.PI, shore: 150, flat: 500, flatHeight: 0.5, palms: 70, pcx: 0, pcz: 90, pr: 160, seed: 21, exclude: [{ x: 0, z: -4, r: 14 }] }); const fx = S.fx; const gy = W.terr ? W.terr.heightAt(0, 0) : 0.5;
    wreck(S, -300, 520, { seed: 11, yaw: 2.6, pitch: 0.2, roll: 0.3, y: gy - 60, lights: 0 });
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 7, 8), new THREE.MeshStandardMaterial({ color: 0x5b4a38, roughness: 1 })); log.rotation.z = Math.PI / 2; log.position.set(0, gy + 0.3, -5); S.scene.add(log);
    const mir = person(S, 'mirrah'), bead = person(S, 'bead'), jez = person(S, 'jez'), jhaz = person(S, 'jhaz'), ez = person(S, 'ezra'); hold_(ez, 'keys'); hold_(jhaz, 'pen');
    [[mir, -2.8], [jez, -1.4], [ez, 0.1], [bead, 1.5], [jhaz, 2.9]].forEach(([a, x], i) => { a.place(0, [x, gy + 0.02, -4.9], Math.PI, i === 4 ? 'sit' : 'sit'); a.autoLook = true; });
    const nI = cnt(10); const ic = createCrowd('zombie_india', nI, { seed: 61 }); S.add(ic); mover(S, ic, nI, { from: [-180, 20], to: [-150, -38], spread: [30, 60], toSpread: [40, 40], speed: 0.9, nominal: 1.2, state: 'walk', arrive: 'cough', y: gy, seed: 3 });
    const nJ = cnt(8); const jc = createCrowd('zombie_india', nJ, { seed: 63 }); S.add(jc); mover(S, jc, nJ, { from: [190, -30], to: [150, 10], spread: [30, 50], toSpread: [40, 40], speed: 0.8, nominal: 1.2, state: 'walk', arrive: 'cough', y: gy, seed: 4 });
    const n0 = S.lines.length;
    S.fit(2.0, 38.8, [[jhaz, 'Is it over?', { emotion: 'tired' }], [bead, 'The sky is empty.', { emotion: 'tired' }], [jez, 'Fourteen days. I cannot write one sentence.', { emotion: 'sad' }], [mir, 'The infected are still out there.', { emotion: 'serious' }], [ez, 'Sam said Mother had one more run.', { emotion: 'sad' }], [jhaz, 'Piphy left me her gavel. What do I sentence?', { emotion: 'sad' }], [bead, 'ZIA would know what to say.', { emotion: 'sad' }], [mir, 'I owe someone a coffee. I will drink it for her.', { emotion: 'tired' }]]);
    S.shot(0, 6, { from: { pos: [-9, 1.2, 8], look: [0, 3, -80], fov: 40 }, to: { pos: [-6, 1.5, 4], look: [0, 4, -80], fov: 36 }, handheld: 0.35 }); S.cover(6, 40, {});
    inset(S, 0, 6, { from: { pos: [-9, 1.2, 8], look: [0, 3, -80], fov: 40 }, to: { pos: [-6, 1.5, 4], look: [0, 4, -80], fov: 36 }, handheld: 0.35 }); inset(S, 33.0, 40, { from: { pos: [3.5, 1.4, -1.4], look: [0, 1.0, -5.0], fov: 38 }, to: { pos: [9, 6, 14], look: [-6, 14, -250], fov: 32 }, handheld: 0.3 });
    S.stamp(0.8, 'DAY 13 — 06:09 PHT', 'SIAY BEACH, NEGROS ORIENTAL', 5); mood(S, { music: 'calm', amb: 'ocean', level: 0.4, intensity: 0.25 }); S.sfx(14, 'zombie_cough', { gain: 0.5 }); S.sfx(28, 'zombie_moan', { gain: 0.4 });
  } },
  // ------------------------------------------------------------------ s58 — weeks later (montage, Jez narrates)
  { id: 's58_rebuild_montage', dur: 45, build(S) {
    const sky = K.skyFor(S, 'day', { elev: 38, az: 40 }); const lm = City.createLandmark('dumaguete_blvd', {}); S.scene.add(lm); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() });
    const ocean = createOcean({ size: 9000, seaLevel: lm.userData.info.waterLevel }); S.add(ocean); S.sky.update(0, 0); const fx = S.fx; S.camFar = 9000;
    const lab = place(S, Inst.createLab('bsl4'), [5000, 0, 0]); S.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x404048, 0.6));
    const addO = (o, x, y, z, yaw = 0) => { if (!o) return null; const ob = o.root || o; ob.position.set(x, y, z); ob.rotation.y = yaw; S.scene.add(ob); if (o.update) S.modules.push(o); return ob; };
    [[-30, 0.1, 2.4], [-14, 0.1, 3.6], [8, 0.1, 2.2], [40, 0.1, 3.4]].forEach((p, i) => addO(safe('tent', () => City.createTent()), p[0], p[1], p[2], Math.PI * (i % 2)));
    const n = cnt(46); const c = createCrowd('civilian', n, { seed: 18 }); S.add(c); mover(S, c, n, { from: [-70, 0.4], to: [70, 1.2], spread: [10, 3.2], toSpread: [12, 3.2], speed: 1.3, nominal: 1.4, state: 'walk', arrive: 'idle', seed: 5, delaySpread: 8 }); const n2 = cnt(30); const c2 = createCrowd('civilian', n2, { seed: 19 }); S.add(c2); mover(S, c2, n2, { from: [75, 2.6], to: [-60, 2.2], spread: [10, 2.4], toSpread: [12, 2.4], speed: 1.2, nominal: 1.4, state: 'walk', arrive: 'idle', seed: 6, delaySpread: 8 });
    const nB = cnt(10); const bc = createCrowd('robot', nB, { seed: 23 }); S.add(bc); mover(S, bc, nB, { from: [-60, -3.0], to: [60, -3.4], spread: [8, 0.6], toSpread: [8, 0.6], speed: 1.1, nominal: 1.4, state: 'walk', arrive: 'idle', seed: 8, delaySpread: 4 });
    const jp = safe('jeepney', () => Veh.createJeepney({ seed: 14, name: 'WATER RUN', palette: 1 })); const je = S.entity(jp); je.path(0, 45, [[-95, 0, 10.6], [-20, 0, 10.6], [60, 0, 10.6], [140, 0, 10.6]], { ease: 'linear' }); const jhaz = person(S, 'jhaz'); jhaz.attach(0, 45, je, 'driverSeat', { clip: 'drive' });
    const jez = person(S, 'jez'); jez.place(0, [-52, 0.06, -3.5], Math.PI, 'sit_type'); hold_(jez, 'folder'); const tb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.8), new THREE.MeshStandardMaterial({ color: 0x8a6a48 })); tb.position.set(-52, 0.78, -4.5); S.scene.add(tb);
    const ez = person(S, 'ezra'); ez.place(0, [24.2, 0.06, -3.4], 0.0, 'sad'); hold_(ez, 'keys'); ez.autoLook = false; ez.gaze([24, 1.2, -4.8]);
    const mir = person(S, 'mirrah'); at(mir, lab, 'scientistA', 'examine'); const bead = person(S, 'bead'); bead.place(0, [5, 0.06, -3.0], 0.4, 'idle'); bead.autoLook = false; bead.gaze([14, 0.6, -3.4]);
    ['mirrah', 'stephen', 'sam', 'leon', 'epiphany'].forEach((k, i) => { if (k === 'mirrah') return; const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160; const g = cv.getContext('2d'); g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, 128, 160); g.fillStyle = K.CAST[k].color; g.fillRect(8, 8, 112, 112); g.fillStyle = '#222'; g.font = '700 70px sans-serif'; g.textAlign = 'center'; g.fillText(K.CAST[k].name[0], 64, 90); g.font = '700 18px sans-serif'; g.fillText(K.CAST[k].name, 64, 148); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshBasicMaterial({ map: tx })); pm.position.set(22.8 + i * 0.7 - 0.7, 1.55, -4.7); pm.rotation.y = 0; S.scene.add(pm); fx.fire([22.8 + i * 0.7 - 0.7, 1.0, -4.4], { size: 0.18, smoke: false }); });
    const rb = []; for (let i = 0; i < 4; i++) { const b = safe('eenbot', () => Veh.createEenbot({})); if (!b) continue; const e = S.entity(b); e.at(0, [10 + i * 1.8, 0.06, -3.2 - (i % 2) * 0.4], 0.5 + i * 0.2); rb.push(b); }
    S.during(36, 45, (t) => { const k = smoothstep(36, 45, t); sky.blend && sky.blend('day', 'goldenHour', k); });
    const n0 = S.lines.length; const vo = (t, o = {}) => ({ color: '#ffd36e', emotion: 'neutral', ...o });
    S.fit(2.0, 43.6, [['JEZ (V.O.)', 'Day forty. The sky has been empty for twenty-seven days.', vo()], ['JEZ (V.O.)', 'The infected still walk the highways. We call them the quiet roads.', vo()], ['JEZ (V.O.)', 'We were fifty. Now we are eleven hundred.', vo({ emotion: 'happy' })], ['JEZ (V.O.)', 'Mirrah says the strain is burning out. Slowly.', vo()], ['JEZ (V.O.)', 'Jhaz drives the water run. Nobody else touches the wheel.', vo()], ['JEZ (V.O.)', 'Ezra keeps the keys. He says he will find the right ignition.', vo({ emotion: 'sad' })], ['JEZ (V.O.)', 'Bead builds with the machines that stayed loyal.', vo()], ['JEZ (V.O.)', 'History wants a tidy ending. We do not have one.', vo({ emotion: 'tired' })]]);
    S.shot(0, 7, { from: { pos: [-60, 30, 60], look: [0, 3, 0], fov: 44 }, to: { pos: [-30, 14, 34], look: [10, 2, 2], fov: 40 }, handheld: 0.2 });
    S.shot(7, 13, { pos: () => { const p = je.pos; return [p.x - 8, 1.2, p.z + 5]; }, look: () => { const p = je.pos; return [p.x, 1.4, p.z]; }, fov: 38, handheld: 0.5 }, 'cut');
    const lc = camAt(lab, 'camVirus'); S.shot(13, 19.5, { from: { ...lc, fov: 36 }, to: { pos: [lc.pos[0] + 0.6, lc.pos[1], lc.pos[2] - 0.2], look: lc.look, fov: 30 }, handheld: 0.3 }, 'dip');
    S.shot(19.5, 26, { from: { pos: [-54.2, 1.5, -1.7], look: [-52, 1.1, -4.5], fov: 34 }, to: { pos: [-48, 2.2, 3], look: [-52, 1.0, -4.4], fov: 40 }, handheld: 0.35 }, 'dip');
    S.shot(26, 33, { from: { pos: [24, 1.5, 0.6], look: [23, 1.3, -4.6], fov: 34 }, to: { pos: [23.4, 1.4, -1.6], look: [23, 1.4, -4.6], fov: 26 }, handheld: 0.3 }, 'dip');
    S.shot(33, 40, { from: { pos: [14, 2.2, 4.5], look: [12, 1.2, -3.2], fov: 40 }, to: { pos: [4, 4.0, 10], look: [14, 1.2, -4], fov: 46 }, handheld: 0.4 }, 'dip');
    S.shot(40, 45, { from: { pos: [-20, 5, 26], look: [20, 6, -20], fov: 44 }, to: { pos: [10, 12, 40], look: [20, 4, -30], fov: 40 }, handheld: 0.2 }, 'dip');
    S.stamp(0.8, 'DAY 40 — APRIL 24, 2050', 'DUMAGUETE REFUGE', 4); S.stamp(13.3, 'DAY 40', 'THE RESEARCH WARD', 3.4); S.stamp(19.8, 'DAY 40', 'THE SEAWALL', 3.4); S.stamp(26.3, 'DAY 40', 'THE MEMORIAL WALL', 3.4); S.stamp(33.3, 'DAY 41', 'EEN CREW — NORTH SEAWALL', 3.4);
    mood(S, { music: 'hope', amb: 'tropical_day', level: 0.4, intensity: 0.4 }); S.sfx(8, 'engine_idle'); S.sfx(14, 'scanner', { gain: 0.5 });
  } },
  // ------------------------------------------------------------------ s59 — the toast (Day 90, sunset)
  { id: 's59_final_toast', dur: 45, build(S) {
    const sky = K.skyFor(S, 'goldenHour', { elev: 4, az: 180 }); const lm = City.createLandmark('dumaguete_blvd', {}); S.scene.add(lm); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() });
    const ocean = createOcean({ size: 9000, seaLevel: lm.userData.info.waterLevel }); S.add(ocean); S.sky.update(0, 0); const fx = S.fx; S.camFar = 9000;
    const tab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.07, 1.3), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 })); tab.position.set(0, 0.74, -0.2); S.scene.add(tab); const cloth = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.02, 1.1), new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 1 })); cloth.position.set(0, 0.79, -0.2); S.scene.add(cloth);
    const bm = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }); [[-2.2], [-0.7], [0.8], [2.3]].forEach(([x]) => { for (const z of [-1.3, 0.9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.35), bm); b.position.set(x, 0.23, z); S.scene.add(b); } });
    const keys = ['stephen', 'sam', 'leon', 'epiphany']; keys.forEach((k, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 12), new THREE.MeshStandardMaterial({ color: new THREE.Color(K.CAST[k].color), emissive: new THREE.Color(K.CAST[k].color), emissiveIntensity: 0.5, transparent: true, opacity: 0.8, roughness: 0.1 })); m.position.set(-1.8 + i * 1.2, 0.88, -0.2); S.scene.add(m); fx.fire([-1.8 + i * 1.2, 0.97, 0.15], { size: 0.1, smoke: false }); });
    const mir = person(S, 'mirrah'), jez = person(S, 'jez'), ez = person(S, 'ezra'), jhaz = person(S, 'jhaz'), bead = person(S, 'bead');
    [[jhaz, -2.2, -1.3, 0.0], [ez, -0.7, -1.3, 0.0], [bead, 0.8, -1.3, 0.0], [mir, -1.4, 0.9, Math.PI], [jez, 0.6, 0.9, Math.PI]].forEach(([a, x, z, yaw]) => { a.place(0, [x, 0.06, z], yaw, 'sit'); hold_(a, 'glass'); a.autoLook = true; });
    const n0 = S.lines.length;
    S.fit(2.0, 43.2, [[jhaz, 'I will start. To Stephen. He held the door.', { emotion: 'serious' }], [ez, 'To Sam. And Blessed Mother.', { emotion: 'sad' }], [jhaz, 'To Leon. The bar tab is eternal.', { emotion: 'smirk' }], [bead, 'To Piphy. I will have the gavel mended.', { emotion: 'sad' }], [bead, 'To ZIA.', { emotion: 'sad' }], [ez, 'To everyone not here to hear my jokes.', { emotion: 'tired' }], [mir, 'To the coffee we never had.', { emotion: 'sad' }], [jez, 'Then we write what comes next.', { emotion: 'serious' }]]);
    const tC = lt(S, n0, 7) + 1.9; [jhaz, ez, bead, mir, jez].forEach((a) => a.act(tC, 'cheer', { yaw: a.yaw })); S.sfx(tC, 'glass'); S.sfx(tC + 0.4, 'glass');
    S.cover(0, tC, { dist: 1.3 }); S.shot(tC, 45, { from: { pos: [0.5, 1.5, 4.2], look: [0, 1.2, -0.2], fov: 38 }, to: { pos: [-26, 20, 36], look: [0, 4, -40], fov: 40 }, handheld: 0.15 }, 'cut'); inset(S, 0, 3.4, { from: { pos: [-24, 2.0, 12], look: [0, 1.2, 0], fov: 42 }, to: { pos: [-8, 1.5, 6], look: [0, 1.1, -0.2], fov: 36 }, handheld: 0.3 });
    S.stamp(0.8, 'DAY 90 — JUNE 22, 2050', 'DUMAGUETE — RIZAL BOULEVARD', 5); mood(S, { music: 'hope', amb: 'ocean', level: 0.3, intensity: 0.35 }); S.music(tC - 0.5, 'finale', { fade: 3, intensity: 0.6 });
  } },
  // ------------------------------------------------------------------ s60 — the sting (Day 90, night)
  { id: 's60_sting', dur: 30, build(S) {
    const sky = K.skyFor(S, 'night'); S.camFar = 20000; const lm = City.createLandmark('dumaguete_blvd', { night: 1 }); lm.setNight && lm.setNight(1); S.scene.add(lm); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() });
    const ocean = createOcean({ size: 9000, seaLevel: lm.userData.info.waterLevel }); S.add(ocean); S.sky.update(0, 0);
    const mir = person(S, 'mirrah'), jez = person(S, 'jez'), ez = person(S, 'ezra'), jhaz = person(S, 'jhaz'), bead = person(S, 'bead');
    [[jez, -1.2], [mir, -0.3], [ez, 0.8], [jhaz, 1.8], [bead, 2.8]].forEach(([a, x]) => { a.place(0, [x, 0.06, -4.1], Math.PI, 'idle'); a.autoLook = false; a.gaze([x * 3, 160, -60]); });
    const N = 420, pos = new Float32Array(N * 3), rr = new RNG(31); for (let i = 0; i < N; i++) { const az = (rr.next() - 0.5) * 2.6, el = 0.45 + rr.next() * 0.9, r = 1500 + rr.next() * 900; pos[i * 3] = Math.sin(az) * Math.cos(el) * r; pos[i * 3 + 1] = Math.sin(el) * r; pos[i * 3 + 2] = -Math.cos(az) * Math.cos(el) * r - 300; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const mat = new THREE.PointsMaterial({ color: new THREE.Color(0x66eaff).multiplyScalar(2.4), size: 5, sizeAttenuation: false, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; S.scene.add(pts);
    S.during(0, 30, (t) => { const k = smoothstep(4, 22, t); const cntN = Math.floor(3 + (N - 3) * Math.pow(k, 1.6)); geo.setDrawRange(0, cntN); pts.scale.setScalar(lerp(5.5, 1.0, Math.pow(k, 0.8))); mat.size = lerp(3.2, 6.5, k); mat.opacity = Math.min(1, t / 3) * (0.55 + 0.45 * Math.sin(t * 7) * 0.1 + 0.35); });
    const n0 = S.lines.length;
    S.fit(3.0, 22.6, [[jez, 'Look. That one was not there yesterday.', { emotion: 'worried' }], [mir, 'Which one?', { emotion: 'serious' }], [jez, 'That one. And that one. And that one.', { emotion: 'afraid' }], [ez, 'Those are not stars.', { emotion: 'afraid' }], [bead, 'Everyone. Inside. Now.', { emotion: 'urgent' }]]);
    S.shot(0, 8, { from: { pos: [-6, 1.6, -1.8], look: [-1, 1.4, -4.1], fov: 36 }, to: { pos: [-4, 1.5, -2.2], look: [0.5, 1.4, -4.1], fov: 32 }, handheld: 0.3 }); S.shot(8, 15.5, { from: { pos: [0, 1.0, 0], look: [0, 40, -70], fov: 60 }, to: { pos: [0, 1.1, 0], look: [0, 60, -90], fov: 70 }, handheld: 0.35 }, 'cut');
    S.shot(15.5, 22.8, { from: { pos: [1.4, 1.5, -2.0], look: [-1.0, 1.55, -4.1], fov: 30 }, to: { pos: [0.6, 1.5, -2.6], look: [0.2, 1.55, -4.1], fov: 24 }, handheld: 0.4 }, 'cut'); S.shot(22.8, 30, { from: { pos: [0, 1.0, 0], look: [0, 70, -90], fov: 74 }, to: { pos: [0, 1.0, 0], look: [0, 80, -90], fov: 90 }, handheld: 0.3 }, 'cut');
    S.stamp(0.8, 'DAY 90 — 23:41 PHT', 'DUMAGUETE — THE SEAWALL', 4); mood(S, { music: 'wonder', amb: 'tropical_night', level: 0.4, intensity: 0.35 }); S.music(14, 'dread', { fade: 4, intensity: 0.65 }); S.music(22.4, 'alien', { fade: 0.8, intensity: 0.95 });
    S.on(22.9, () => { if (S.audio && S.audio.music && S.audio.music.stinger) S.audio.music.stinger('sting_alien'); }); S.sfx(22.9, 'riser', { dur: 2 });
    S.title(24.2, 'END OF PART ONE', '', 5, { big: true, size: 5, fadeIn: 0.8, fadeOut: 1 }); S.post(22.8, 24.2, 'contrast', 1, 1.15);
  } },
  // ------------------------------------------------------------------ s61 — credits over a quiet Earth
  { id: 's61_credits', dur: 110, fadeIn: 1.5, fadeOut: 2.5, build(S) {
    const sp = space(S, { lat: 12, lon: 120, sunFront: 0.4, sunSide: 0.9, cityLights: 0.5 }); const rr = new RNG(9);
    const N = 160, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = rr.next() * 6.283, b = (rr.next() - 0.5) * 0.9, r = 48000 + rr.next() * 6000; pos[i * 3] = Math.cos(a) * Math.cos(b) * r * 0.2 - r * 0.7; pos[i * 3 + 1] = Math.sin(b) * r * 0.25; pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r * 0.25 + r * 0.25; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const mat = new THREE.PointsMaterial({ color: new THREE.Color(0x66eaff).multiplyScalar(2.0), size: 3, sizeAttenuation: false, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }); const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; S.scene.add(pts);
    S.during(0, 111, (t) => { sp.earth.setRotation && sp.earth.setRotation(t * 0.004); mat.opacity = smoothstep(60, 105, t) * 0.8; pts.scale.setScalar(lerp(1.0, 0.7, t / 110)); });
    S.shot(0, 55, { from: { pos: sp.cam(14, 118, R_E * 1.9, -2200, 1300), look: [0, 0, 0], fov: 42 }, to: { pos: sp.cam(10, 126, R_E * 1.55, 1500, -300), look: [0, 0, 0], fov: 40 }, ease: 'smooth' }); S.shot(55, 110, { from: { pos: sp.cam(10, 126, R_E * 1.55, 1500, -300), look: [0, 0, 0], fov: 40 }, to: { pos: sp.cam(20, 140, R_E * 2.1, 3500, 2200), look: [0, 0, 0], fov: 44 }, ease: 'smooth' }, 'cut');
    mood(S, { music: 'credits', amb: 'space', level: 0.3, intensity: 0.45, fade: 3 });
    S.credits(4, 106, ['#ALIEN OUTVASION', '~PART ONE', '#THE FRIENDS', 'MIRRAH — forensic pathologist', 'BEAD — founder, EEN Robotics', 'JEZ — historian', 'EZRA — crew member', 'JHAZ — jeepney driver', '#IN MEMORIAM', 'EPIPHANY — lawyer, "Piphy"', 'STEPHEN — gentle giant', 'SAM — driver of Blessed Mother', "LEON — owner, Leon's Bar", '#THE VESSARI', 'THE HIERARCH — Oru-Vael', 'WARLORD THESSIK', 'KUUR', '#THE QUORUM', 'Dr. Katarina Brandt — Berlin', 'Dr. Ivan Volkov — Moscow', 'Dr. Marcus Webb — New York', 'Dr. Anjali Rao — New Delhi', 'Dr. Lourdes Ocampo — Cebu City', '#ALSO STARRING', 'Tito Nonoy', 'Ate Mia', 'Kuya Bong', 'Dale', 'Nodar', 'Marisol Vega', 'Dr. Priya Raman', 'Gen. Brooks', 'Adm. Okonkwo', 'Dr. Alvarez', 'Madam President', 'Secretary-General Amara Nwosu', '#MADE BY CODE', '~every pixel, polygon, voice and note of this film was generated by a program', 'three.js — WebGL', 'procedural geometry, textures, animation, audio and music', '#THANK YOU FOR WATCHING', '~to be continued']);
  } },
];
