// ACT II — TOUCHDOWN (5:00–10:00). The strike, the landings, the front lines, and the friends trying to reach each other.
import * as THREE from 'three';
import * as K from './kit.js';
import * as SC from './screens.js';
import { space, R_E } from './space.js';
import { battle, mover, cnt } from './battle.js';
import { createCrowd } from '../models/crowd.js';
import { createCrawlerSwarm, createCrawler } from '../models/aliens/index.js';
import { createPodSwarm, createBeams, createDropship, createTripod } from '../models/alientech/index.js';
import * as Veh from '../models/vehicles.js';
import { createOcean } from '../world/ocean.js';
const { person, extra, alien, at, A, cover, indoors, place, nameCard, mood, COL, Life, Inst, City, safe, V3, RNG } = K;
const nr = (set, name, dx = 0, dz = 0) => { const a = A(set, name); return [a.p[0] + dx, a.p[1], a.p[2] + dz]; };
const radio = (extra = {}) => ({ style: 'radio', color: COL.radio, ...extra });
const mil = (extra = {}) => ({ style: 'radio', color: COL.mil, ...extra });

export const ACT2 = [
  // ------------------------------------------------------------------ s15 — the first hour: orbital strike
  { id: 's15_orbital_strike', dur: 22, fadeIn: 0.3, build(S) {
    const sp = space(S, { lat: 20, lon: 100, sunFront: 0.3, sunSide: 0.9, cityLights: 1 }); const hero = sp.ship(7, 22, 104, 520, 900);
    const hp = hero.root.position.clone(); const sats = []; const spots = [[18, 96], [20, 99], [21, 102], [17, 100]];
    spots.forEach((s, i) => { const sat = safe('sat', () => Veh.createSatellite(i % 2 ? 'comms' : 'recon')); if (!sat) return; sat.root.scale.setScalar(0.001); const p = sp.at(s[0], s[1], 480 + i * 25); sat.root.position.copy(p); S.add(sat); sats.push({ p, sat }); });
    const stn = safe('station', () => Veh.createSpaceStation()); let sp0 = sp.at(19, 98, 410); if (stn) { stn.root.scale.setScalar(0.001); stn.root.position.copy(sp0); stn.root.rotation.set(0.3, 0.8, 0); S.add(stn); }
    const toKm = (v) => v.toArray(); const fx = S.fx;
    sats.forEach((s, i) => { const t0 = 4.0 + i * 1.3; S.on(t0, () => { sp.beams.fire({ from: hp, to: s.p, width: 0.012, life: 0.9 }); fx.explosion(s.p, { size: 0.06, kind: 'fireball' }); }); S.during(t0 + 0.3, 40, () => { s.sat.root.visible = false; }); });
    S.on(11.6, () => { sp.beams.fire({ from: hp, to: sp0, width: 0.02, life: 1.2 }); fx.explosion(sp0, { size: 0.16, kind: 'big' }); }); S.during(11.9, 40, () => { if (stn) stn.root.visible = false; });
    S.during(0, 22, (t) => { sp.earth.setCityLights && sp.earth.setCityLights(t < 12 ? 1 : Math.max(0.15, 1 - (t - 12) * 0.12)); });
    S.shot(0, 5, { from: { pos: sp.cam(20, 98, R_E + 3000, 400, 900), look: [0, 0, 0], fov: 36 }, to: { pos: sp.cam(20, 98, R_E + 1800, 300, 500), look: sats[0] ? sats[0].p.toArray() : [0, 0, 0], fov: 32 } });
    S.shot(5, 11, { pos: sp.cam(19, 97, R_E + 520, 0.9, 0.35), look: sats[2] ? sats[2].p.toArray() : [0, 0, 0], fov: 34, handheld: 0.2 }, 'cut'); S.shot(11, 15, { pos: [sp0.x + 0.25, sp0.y + 0.08, sp0.z + 0.12], look: sp0.toArray(), fov: 34 }, 'cut');
    S.shot(15, 22, { from: { pos: sp.cam(22, 110, R_E * 1.35, 0, 0), look: [0, 0, 0], fov: 44 }, to: { pos: sp.cam(22, 110, R_E * 1.8, 0, 0), look: [0, 0, 0], fov: 44 } }, 'dip');
    mood(S, { music: 'invasion', amb: 'space', level: 0.5, intensity: 0.7 }); S.sfx(4.0, 'laser_fire', { long: true }); S.sfx(11.6, 'explosion_far');
    S.fit(0.6, 14.5, [['HOUSTON', 'Station, we are seeing weapons fire from the fleet.', radio({ emotion: 'afraid' })], ['ISS COMMANDER', "Houston, they're targeting the satellites. All of them. They're—", radio({ emotion: 'afraid' })]]);
    S.title(16.5, 'NO SIGNAL', '', 4, { big: true, size: 5 }); S.stamp(0.8, 'MARCH 15, 2050 — 04:02 UTC', 'ORBIT — DAY ZERO', 4);
  } },
  // ------------------------------------------------------------------ s16 — the Pentagon
  { id: 's16_war_room', dur: 30, build(S) {
    const set = place(S, Inst.createWarRoom()); indoors(S, { intensity: 0.7 }); K.news(S, set, 'wall', SC.worldMap(0.35), 10);
    const gen = extra(S, 'general', 61, { name: 'Gen. Brooks', color: COL.mil, npc: { gender: 'M', ethnicity: 'black' } }); const adm = extra(S, 'officer', 62, { name: 'Adm. Okonkwo', color: COL.mil, npc: { gender: 'F', ethnicity: 'black' } });
    const prs = extra(S, 'politician', 63, { name: 'Madam President', color: COL.news, npc: { gender: 'F', ethnicity: 'caucasian' } }); const adv = extra(S, 'scientist', 64, { name: 'Dr. Alvarez', color: COL.sci, npc: { gender: 'M', ethnicity: 'middle_eastern' } });
    at(gen, set, 'briefer', 'idle_hands_hips'); gen.faceTo(0, nr(set, 'mapTable')); at(adm, set, 'seat14', 'idle_arms_crossed'); at(prs, set, 'mapTableL', 'idle'); prs.faceTo(0, gen); at(adv, set, 'seat15', 'clipboard');
    S.stamp(0.6, 'MARCH 15, 2050 — 00:15 EST', 'THE PENTAGON — SITUATION ROOM', 5); mood(S, { music: 'tension_high', amb: 'interior_hum', level: 0.25, intensity: 0.6 });
    S.fit(1.0, 29.0, [[gen, 'We lost every satellite in ninety seconds.', { emotion: 'serious' }], [adm, 'Landing pods inbound. Four hundred cities.', { emotion: 'urgent' }], [prs, 'Can we hurt them?', { emotion: 'serious' }], [adv, 'Their ground forces can bleed. Kinetic weapons work.', { emotion: 'urgent' }], [gen, "The ships don't care. Our missiles bounce off.", { emotion: 'angry' }], [prs, 'Then we fight them on the ground. Everything.', { emotion: 'serious' }], [adm, 'And the interceptors, ma\'am?', { emotion: 'worried' }], [prs, 'Ready them.', { emotion: 'cold' }], [gen, 'A week. It takes a week.', { emotion: 'tired' }]]);
    cover(S, set, 0, 30);
  } },
  // ------------------------------------------------------------------ s17 — touchdown montage (five cities)
  { id: 's17_touchdown_montage', dur: 20, build(S) {
    K.skyFor(S, 'dusk'); const fx = S.fx; S.camFar = 9000; const cities = [['manhattan', 'NEW YORK, USA', 'MARCH 15 — 07:40 EST'], ['moscow', 'MOSCOW, RUSSIA', 'MARCH 15 — 14:40 MSK'], ['berlin', 'BERLIN, GERMANY', 'MARCH 15 — 12:40 CET'], ['delhi', 'NEW DELHI, INDIA', 'MARCH 15 — 17:10 IST'], ['dumaguete', 'MANILA & THE VISAYAS, PHILIPPINES', 'MARCH 15 — 20:40 PHT']];
    cities.forEach((c, i) => { const ox = i * 5000; const sk = safe('skyline', () => City.createSkyline(c[0], { radius: 650, haze: 0.45 })); if (sk) { sk.position && sk.position.set(ox, 0, 0); S.add(sk); } const g = new THREE.Mesh(new THREE.CircleGeometry(900, 24), new THREE.MeshStandardMaterial({ color: 0x25201e, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.set(ox, -0.05, 0); S.scene.add(g);
      const t0 = i * 4; for (let k = 0; k < 5; k++) { const a = k * 1.3 + i; fx.reentry([ox + Math.cos(a) * 260, 900, Math.sin(a) * 260 - 500], [ox + Math.cos(a) * 160 + 20, 4, Math.sin(a) * 160 - 180], { life: 2.6, size: 12, trailTime: 2.2, explodeAtEnd: true, explodeSize: 18, t: t0 + 0.2 + k * 0.5 }); }
      const pods = createPodSwarm(cnt(36)); S.add(pods); const pr = new RNG(i + 4); const tmp = { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.1, roll: 0, state: 'hover', phase: 0 }; const n = pods.capacity; S.updaters.push({ t0: 0, t1: 21, fn: (t) => { const up = Math.max(0, t - t0 - 2.2); for (let j = 0; j < pods.count; j++) { const r = Math.sin(j * 12.9898) * 43758.5453; const f = r - Math.floor(r); tmp.x = ox + (f - 0.5) * 320; tmp.z = -220 + ((j * 53) % 100) * 2 - 100; tmp.y = 140 - Math.min(1, up / 2.5) * (115 - (j % 7) * 5) + Math.sin(t + j) * 1.5; tmp.phase = f; pods.set(j, tmp); } pods.commit(); } });
      S.shot(t0, t0 + 4, { from: { pos: [ox - 40, 2.2, 80], look: [ox, 38, -250], fov: 62 }, to: { pos: [ox - 20, 2.4, 70], look: [ox + 10, 24, -250], fov: 58 }, handheld: 0.6 }, 'cut'); S.stamp(t0 + 0.3, c[2], c[1], 3.4); S.sfx(t0 + 1.2, 'explosion_far'); });
    mood(S, { music: 'invasion', amb: 'war_far', level: 0.5, intensity: 0.8 }); S.sfx(0.5, 'tripod_horn', { gain: 0.5 });
  } },
  // ------------------------------------------------------------------ s18 — Dumaguete: the sky comes down
  { id: 's18_dumaguete_landing', dur: 28, build(S) {
    K.skyFor(S, 'dusk', { smoke: 0.3 }); const block = City.createCityBlock('dumaguete', { seed: 2, damage: 0.1, night: 0.5 }); S.add(block); const fx = S.fx; S.camFar = 6000;
    const ships = [0, 1, 2].map((i) => { const d = createDropship(40 + i); S.add(d); const e = S.entity(d); e.path(0, 14 + i, [[-60 + i * 55, 190, -230], [-40 + i * 45, 110, -140], [-30 + i * 40, 12 + i * 3, -70 - i * 14]], { ease: 'out', pitch: true }); S.during(11 + i, 40, () => d.openHatch && d.openHatch(Math.min(1, (S.t - 11 - i) / 2))); S.on(10 + i, () => fx.dust([-30 + i * 40, 1, -70 - i * 14], { radius: 25, amount: 1 })); return d; });
    const n = cnt(70); const civ = createCrowd('civilian', n, { seed: 8 }); S.add(civ); mover(S, civ, n, { from: [-4, -30], to: [0, 78], spread: [14, 20], toSpread: [16, 20], speed: 4.2, nominal: 4.0, state: 'panic', arrive: 'run', seed: 5, delay: 3, delaySpread: 6 });
    const nc = cnt(60); const cr = createCrawlerSwarm(nc); S.add(cr); mover(S, cr, nc, { from: [-30, -76], to: [0, 40], spread: [30, 12], toSpread: [14, 14], speed: 5.2, nominal: 5.5, state: 'run', arrive: 'screech', seed: 3, delay: 14, delaySpread: 4 });
    const beams = createBeams({ capacity: 256 }); S.add(beams); S.during(16, 28, (t) => { if (S.silent) return; if (Math.floor(t * 5) !== Math.floor((t - 0.05) * 5)) { const r = new RNG(Math.floor(t * 5) + 7); const from = new V3(-30 + r.next() * 40, 14, -75); const to = new V3((r.next() - 0.5) * 20, 1, 30 + r.next() * 25); beams.fire({ from, to, width: 0.35, life: 0.3 }); fx.explosion(to, { size: 7, kind: 'laser' }); } });
    const morgue = place(S, Life.createMorgue(), [3000, 0, 0]); const mir = person(S, 'mirrah'); at(mir, morgue, 'mirrahTableA', 'listen'); const tito = extra(S, 'technician', 3, { name: 'Tito' }); at(tito, morgue, 'desk', 'cower'); const mc = A(morgue, 'camWide');
    S.shot(0, 6, { from: { pos: [-8, 2.2, 60], look: [-20, 90, -180], fov: 50 }, to: { pos: [-6, 2.4, 58], look: [-20, 50, -170], fov: 46 }, handheld: 0.6 });
    S.shot(6, 11, { pos: [0, 1.7, 20], look: [-30, 20, -80], fov: 42, push: 3, handheld: 0.5 }, 'cut'); S.shot(11, 17, { pos: [mc.p[0], mc.p[1], mc.p[2]], look: [3000, 1.3, 0], fov: 40, handheld: 0.7 }, 'dip');
    S.shot(17, 28, { from: { pos: [-3, 1.5, 60], look: [-10, 3, -30], fov: 40 }, to: { pos: [-2, 1.7, 34], look: [-6, 4, -20], fov: 36 }, handheld: 0.9 }, 'dip');
    S.say(11.6, mir, 'Tito. What was that?', { dur: 1.8, emotion: 'worried' }); S.say(13.8, tito, 'The windows. Doc, get away from the windows!', { dur: 2.8, emotion: 'afraid' }); S.say(16.8, mir, 'Everyone down. Stay away from the glass.', { dur: 2.6, emotion: 'serious' });
    S.say(20.0, 'CROWD', 'Run! They are coming out of the ships!', { color: COL.npc, dur: 2.6 }); S.stamp(0.5, 'MARCH 15, 2050 — 20:40 PHT', 'DUMAGUETE CITY, PHILIPPINES', 4);
    mood(S, { music: 'invasion', amb: 'crowd', level: 0.5, intensity: 0.8 }); S.sfx(3.0, 'tripod_horn', { gain: 0.7 }); S.sfx(9.5, 'pod_whine'); S.sfx(16.5, 'laser_fire'); S.sfx(19, 'crawler_screech');
  } },
  // ------------------------------------------------------------------ s19 — New York: the line
  { id: 's19_ny_battle', dur: 30, build(S) {
    battle(S, { style: 'manhattan', sky: 'smoke', soldiers: 95, crawlers: 380, pods: 140, vessari: 55, tripods: 3, horde: 36, humansDie: 0.7, aliensDie: 0.38 });
    S.stamp(0.6, 'MARCH 15, 2050 — 08:12 EST', 'NEW YORK CITY — 5TH AVENUE LINE', 4.5); mood(S, { music: 'battle', amb: 'war_near', level: 0.7, intensity: 0.85 });
    S.say(1.5, 'SERGEANT', 'Contact front! Hundreds of them!', mil({ dur: 2.4 })); S.say(5.5, 'SERGEANT', 'Hold the line! Aim for the legs, the legs!', mil({ dur: 3 })); S.say(11.5, 'LIEUTENANT', 'Kinetics are working! Keep firing!', mil({ dur: 2.5 })); S.say(17.5, 'RADIOMAN', 'Tripods on Fifth! I repeat, tripods on Fifth!', mil({ dur: 3.2, emotion: 'afraid' })); S.say(24.5, 'SERGEANT', "We can't hold! Fall back! Fall back!", mil({ dur: 2.8, emotion: 'afraid' }));
    S.sfx(2, 'tripod_horn'); S.sfx(10, 'rifle'); S.sfx(18, 'explosion_big');
  } },
  // ------------------------------------------------------------------ s20 — the air battle above the storm
  { id: 's20_air_battle', dur: 22, build(S) {
    const sky = K.skyFor(S, 'storm', { storm: 0.8, elev: 20, az: 220 }); S.camFar = 12000; const fx = S.fx; const beams = createBeams({ capacity: 320 }); S.add(beams);
    const pods = createPodSwarm(cnt(70)); S.add(pods); const pr = new RNG(21); const pd = Array.from({ length: pods.capacity }, () => ({ x: (pr.next() - 0.5) * 520, y: 20 + pr.next() * 130, z: -80 - pr.next() * 360, ph: pr.next() })); const tmp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, state: 'hover', phase: 0 };
    S.updaters.push({ t0: 0, t1: 23, fn: (t) => { for (let i = 0; i < pods.count; i++) { const p = pd[i]; tmp.x = p.x + Math.sin(t * 0.3 + p.ph * 7) * 18; tmp.y = p.y + Math.sin(t * 0.7 + p.ph * 5) * 4; tmp.z = p.z + t * 6; tmp.phase = p.ph; tmp.state = i % 9 === 0 ? 'dive' : 'hover'; pods.set(i, tmp); } pods.commit(); } });
    const jets = []; const hits = [7.5, 12.0, 16.8];
    for (let i = 0; i < 4; i++) { const j = safe('jet', () => Veh.createJet('f15')); if (!j) continue; const e = S.entity(j); const off = i * 22; const a = i % 2 ? -1 : 1; e.path(0, 22, [[-160 + off * a, 52 + i * 8, 260], [-60 + off, 58 + i * 6, 60], [30 - off * a * 0.6, 62 + i * 9, -120], [90 + off, 70, -380]], { bank: 1.2, pitch: true }); if (i > 0) e.hide(hits[i - 1]); jets.push({ j, e }); S.sfx(2 + i * 0.7, 'jet_pass', { pos: [0, 60, 0] }); }
    for (let i = 0; i < 3; i++) { const jp = new V3(-60 + i * 30, 60, 60 - i * 90); S.on(hits[i] - 0.5, () => { beams.fire({ from: [jp.x + 30, 80, jp.z - 140], to: jp, width: 0.5, life: 0.35 }); }); S.on(hits[i], () => { fx.explosion(jp, { size: 24, kind: 'air' }); fx.debris(jp, { count: 14, power: 18 }); }); }
    S.on(3, () => { const m = safe('sam', () => Veh.createMissile('sam', { axis: 'z' })); if (m) { const e = S.entity(m); e.path(3, 7, [[-30, 55, 60], [-10, 80, -20], [20, 100, -110]], { pitch: true, ease: 'in' }); } });
    for (let k = 0; k < 8; k++) S.on(1 + k * 2.4, () => { const r = new RNG(k + 3); beams.fire({ from: [(r.next() - 0.5) * 300, 60 + r.next() * 80, -200 - r.next() * 100], to: [-40 + r.next() * 120, 50 + r.next() * 20, 80 - r.next() * 120], width: 0.4, life: 0.4 }); });
    S.shot(0, 5, { from: { pos: [-40, 40, 200], look: [-50, 55, 60], fov: 40 }, to: { pos: [-20, 44, 120], look: [-30, 58, 20], fov: 36 }, handheld: 0.4 }); S.shot(5, 9, { pos: [10, 70, 20], look: () => (jets[1] ? jets[1].j.root.getWorldPosition(new V3()) : new V3(0, 60, 0)), fov: 34, handheld: 0.5 }, 'cut'); S.shot(9, 14, { follow: jets[0] ? jets[0].e : [0, 60, 0], offset: [6, 2, -16], look: [0, 0, 8], fov: 36, handheld: 0.6 }, 'cut'); S.shot(14, 22, { from: { pos: [0, 30, 120], look: [20, 70, -100], fov: 54 }, to: { pos: [10, 50, 60], look: [30, 80, -140], fov: 46 }, handheld: 0.7 }, 'cut');
    mood(S, { music: 'battle', amb: 'wind', level: 0.5, intensity: 0.9 }); S.sfx(0.5, 'thunder'); S.stamp(0.5, 'MARCH 15 — 06:55 EST', 'ATLANTIC — 40,000 FT', 4);
    S.say(1.0, 'RAPTOR LEAD', 'Raptor flight, weapons free. Light them up.', mil({ dur: 3, emotion: 'serious' })); S.say(7.6, 'RAPTOR TWO', "I'm hit! I'm hit—", mil({ dur: 1.8, emotion: 'afraid' })); S.say(12.2, 'RAPTOR LEAD', 'Two is down. Break right! Break right!', mil({ dur: 2.6, emotion: 'urgent' })); S.say(17.0, 'RAPTOR LEAD', "There's too many. We just can't — ", mil({ dur: 2.6, emotion: 'afraid' }));
  } },
  // ------------------------------------------------------------------ s21 — Jez runs
  { id: 's21_jez_run', dur: 22, build(S) {
    const B = battle(S, { style: 'dumaguete', sky: 'dusk', smoke: 0.25, damage: 0.35, night: 0.6, soldiers: 0, crawlers: 90, pods: 36, vessari: 0, tripods: 0, crawlerSpeed: 6.9, crawlerDelay: 2, cams: false, blasts: 0.3, hz: 70, az0: -80 });
    const jez = person(S, 'jez'); const x = B.lane.x; jez.place(0, [x + 1.2, 0, -55], 0, 'sprint'); jez.go(0, [[x - 1.5, -30], [x + 2, 0], [x - 2, 28], [x, 62]], { speed: 6.3, clip: 'sprint', ramp: 0.2 }); jez.hold('phone');
    S.shot(0, 6, { follow: jez, rel: true, offset: [1.1, 1.5, -4.2], look: [0, 1.2, 4], fov: 40, handheld: 1.0 }); S.shot(6, 11, { follow: jez, rel: true, offset: [-0.5, 1.2, 4.5], look: [0, 1.3, -6], fov: 36, handheld: 0.9 }, 'cut'); S.shot(11, 17, { follow: jez, rel: true, offset: [3.0, 0.9, -1.0], look: [0, 1.2, 1.5], fov: 44, handheld: 1.0 }, 'cut'); S.shot(17, 22, { follow: jez, rel: true, offset: [0.4, 1.7, -3.2], look: [0, 1.1, 3], fov: 34, handheld: 1.0, push: 1 }, 'cut');
    mood(S, { music: 'chase', amb: 'war_near', level: 0.4, intensity: 0.9 }); S.sfx(3, 'crawler_screech'); S.sfx(10, 'crawler_screech');
    S.say(1.6, jez, 'Mirrah! Pick up! Please pick up!', { dur: 2.6, emotion: 'afraid' }); S.say(5.0, 'MIRRAH (PHONE)', 'Jez? Where are you?', radio({ color: '#ff9fd0', dur: 1.8 })); S.say(7.2, jez, "Running! Keep the door locked! I'm coming!", { dur: 2.8, emotion: 'urgent' }); S.say(14.0, jez, 'Not today. Not today. Not today.', { dur: 2.6, emotion: 'angry' });
    S.stamp(0.5, 'MARCH 15 — 20:58 PHT', 'DUMAGUETE — RIZAL AVENUE', 4);
  } },
  // ------------------------------------------------------------------ s22 — the jeepney
  { id: 's22_jeepney_chase', dur: 28, build(S) {
    const B = battle(S, { style: 'dumaguete', sky: 'smoke', smoke: 0.5, damage: 0.4, soldiers: 0, crawlers: 70, pods: 42, vessari: 0, tripods: 0, crawlerSpeed: 8, crawlerDelay: 1, cams: false, blasts: 0.5, hz: 90, az0: -90 });
    const x = B.lane.x; const jp = safe('jeepney', () => Veh.createJeepney({ seed: 5, name: 'BLESSED MOTHER', palette: 2 })); const e = S.entity(jp); e.path(0, 24, [[x, 0, -70], [x + 1, 0, -20], [x - 1.5, 0, 20], [x, 0, 55], [x + 0.5, 0, 110]], { ease: 'linear', bank: 0.4 });
    const sam = person(S, 'sam'); const ez = person(S, 'ezra'); sam.attach(0, 40, e, 'driverSeat', { clip: 'drive' }); ez.attach(0, 40, e, 'passengerSeats', { clip: 'sit', idx: 0 });
    const barM = safe('barrier', () => City.createBarricade('hbar')); const bar = barM && (barM.root || barM); if (bar && bar.position) { bar.position.set(x, 0, 56); S.scene.add(bar); S.during(13.8, 40, () => { bar.visible = false; }); S.on(13.6, () => { S.fx.debris([x, 1, 56], { count: 22, power: 16, size: 0.3 }); S.fx.dust([x, 0.5, 56], { radius: 6 }); }); }
    S.shot(0, 6, { pos: () => { const p = jp.root.position; return [p.x - 4.5, 2.2, p.z - 9]; }, look: () => { const p = jp.root.position; return [p.x, 1.3, p.z + 2]; }, fov: 46, handheld: 0.8 }); S.shot(6, 11, { pos: () => { const p = jp.root.position; return [p.x - 1.1, 1.55, p.z + 1.4]; }, look: () => { const p = jp.root.position; return [p.x - 0.1, 1.3, p.z + 4.2]; }, fov: 62, handheld: 0.9 }, 'cut');
    S.shot(11, 17, { pos: () => { const p = jp.root.position; return [p.x + 3.2, 1.0, p.z + 11]; }, look: () => { const p = jp.root.position; return [p.x, 1.3, p.z]; }, fov: 40, handheld: 0.7 }, 'cut'); S.shot(17, 28, { follow: e, rel: true, offset: [4.5, 3.0, -8], look: [0, 1.3, 2], fov: 44, handheld: 0.8 }, 'cut');
    mood(S, { music: 'chase', amb: 'war_near', level: 0.5, intensity: 0.95 }); S.sfx(0.3, 'engine_rev', { loop: false });
    S.fit(1.0, 26.0, [[sam, 'Hold on, Ezra!', { emotion: 'urgent' }], [ez, "I am holding! Why is everything purple?!", { emotion: 'afraid' }], [sam, "It's cyan, you idiot! Cyan means they're shooting!", { emotion: 'angry' }], [ez, 'SAM! BARRIER!', { emotion: 'afraid' }], [sam, 'This is my mother-in-law\'s jeepney. Sorry, Ma!', { emotion: 'urgent' }], [ez, 'You are not married!', { emotion: 'shocked' }], [sam, 'She still hates me!', { emotion: 'happy' }]]);
  } },
  // ------------------------------------------------------------------ s23 — Leon holds the bar
  { id: 's23_leon_bar', dur: 18, build(S) {
    const set = place(S, Life.createBar()); indoors(S, { intensity: 0.5 }); const leon = person(S, 'leon'); const bong = extra(S, 'elder', 12, { name: 'Kuya Bong' });
    at(leon, set, 'leon', 'aim_shotgun'); leon.hold('shotgun'); at(bong, set, 'stool1', 'cower'); const door = A(set, 'door'); const fx = S.fx;
    const cr = []; for (let i = 0; i < 3; i++) { const c = safe('crawler', () => createCrawler(i + 1)); if (!c) continue; const e = S.entity(c); const d = door.p; e.path(2.4 + i * 1.5, 5.2 + i * 1.5, [[d[0], 0, d[2] + 6], [d[0] + (i - 1) * 0.8, 0, d[2] + 1.5], [d[0] + (i - 1) * 1.4, 0, d[2] - 3]], { ease: 'in' }); S.during(0, 40, (t) => { c.play(t < 2.4 + i * 1.5 ? 'idle' : t < 5.2 + i * 1.5 ? 'run' : 'die', { time: Math.max(0, t - (t < 5.2 + i * 1.5 ? 2.4 + i * 1.5 : 5.2 + i * 1.5)) + (t < 2.4 + i * 1.5 ? t : 0) }); }); S.on(5.2 + i * 1.5, () => { const p = new V3(door.p[0], 1.1, door.p[2] - 2); fx.muzzleFlash(p, new V3(0, 0, 1), { size: 1.3 }); fx.sparks(p, { count: 20 }); }); S.sfx(5.1 + i * 1.5, 'shotgun'); cr.push(c); }
    mood(S, { music: 'horror', amb: 'bar', level: 0.3, intensity: 0.8 }); S.fit(0.8, 17.2, [[bong, 'Leon! They are at the door!', { emotion: 'afraid' }], [leon, 'Get down, Kuya Bong. Stay down.', { emotion: 'urgent' }], [leon, 'Not in my bar.', { emotion: 'angry' }], [leon, "Okay. Okay. That's... new.", { emotion: 'shocked' }], [leon, 'Mirrah. I have to find Mirrah.', { emotion: 'serious' }]]);
    leon.go(15.0, [nr(set, 'door', 0, 0.2)], { speed: 2.8, clip: 'aim_walk' }); cover(S, set, 0, 18);
  } },
  // ------------------------------------------------------------------ s24 — Cebu evacuates
  { id: 's24_cebu_escape', dur: 23, build(S) {
    K.skyFor(S, 'smoke', { smoke: 0.5 }); const set = place(S, Life.createJeepneyTerminal()); const fx = S.fx; const jhaz = person(S, 'jhaz'); const epi = person(S, 'epiphany'); const a = A(set, 'bay1');
    const jp = safe('jeepney', () => Veh.createJeepney({ seed: 11, name: 'CEBU-LAPU-LAPU' })); const e = S.entity(jp); e.at(0, [a.p[0], 0, a.p[2]], a.yaw); e.path(12.5, 20, [[a.p[0], 0, a.p[2]], [a.p[0] + 6, 0, a.p[2] + 18], [a.p[0] + 4, 0, a.p[2] + 70]], { ease: 'in' });
    jhaz.place(0, [a.p[0] + 3, 0, a.p[2] + 1], 3.1, 'idle'); epi.place(0, [a.p[0] + 5, 0, a.p[2] + 3], 2.6, 'cower'); epi.hold('folder'); jhaz.attach(11.5, 40, e, 'driverSeat', { clip: 'drive' }); epi.attach(11.8, 40, e, 'passengerSeats', { clip: 'sit', idx: 0 });
    jhaz.go(8.0, [[a.p[0] + 1.6, a.p[2] + 0.9]], { speed: 2.4 }); epi.go(8.2, [[a.p[0] + 2.2, a.p[2] + 1.8]], { speed: 3.0 });
    const n = cnt(60); const c = createCrowd('civilian', n, { seed: 14 }); S.add(c); mover(S, c, n, { from: [a.p[0] - 6, a.p[2] - 10], to: [a.p[0] + 40, a.p[2] + 70], spread: [24, 20], toSpread: [30, 20], speed: 4.0, nominal: 4.0, state: 'panic', arrive: 'run', seed: 15, delaySpread: 4, die: { from: 4, to: 18, frac: 0.12 } });
    const pods = createPodSwarm(14); S.add(pods); const tmp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, state: 'hover', phase: 0 }; S.updaters.push({ t0: 0, t1: 21, fn: (t) => { for (let i = 0; i < pods.count; i++) { tmp.x = a.p[0] - 30 + i * 8 + Math.sin(t * 0.4 + i) * 6; tmp.y = 24 + (i % 4) * 7; tmp.z = a.p[2] + 30 - t * 3 - i * 6; tmp.phase = i * 0.17; pods.set(i, tmp); } pods.commit(); } });
    S.shot(0, 6, { from: { pos: [a.p[0] - 12, 2.0, a.p[2] - 14], look: [a.p[0] + 10, 6, a.p[2] + 30], fov: 50 }, to: { pos: [a.p[0] - 8, 2.2, a.p[2] - 10], look: [a.p[0] + 12, 7, a.p[2] + 34], fov: 46 }, handheld: 0.9 }); S.shot(6, 12, { pos: () => { const h = epi.headPos(new V3()); return [h.x + 0.8, h.y, h.z + 1.3]; }, look: () => epi.headPos(new V3()), fov: 30, handheld: 0.8, push: 0.3 }, 'cut'); S.shot(12, 23, { follow: e, rel: true, offset: [5, 2.4, -9], look: [0, 1.3, 3], fov: 44, handheld: 0.8 }, 'cut');
    mood(S, { music: 'chase', amb: 'crowd', level: 0.55, intensity: 0.85 }); S.stamp(0.5, 'MARCH 15 — 20:44 PHT', 'CEBU CITY, PHILIPPINES', 4);
    S.fit(6.0, 21.8, [[epi, 'Jhaz. The Institute has the only research labs in the Visayas. If anyone can help, they can.', { emotion: 'urgent' }], [jhaz, "You're a lawyer, not a scientist.", { emotion: 'serious' }], [epi, "I'm the trustee. I have the keys and the authority.", { emotion: 'serious' }], [jhaz, 'Then get in. Seatbelts. Whatever works.', { emotion: 'urgent' }]]);
  } },
  // ------------------------------------------------------------------ s25 — Stephen on the freeway
  { id: 's25_cali_run', dur: 16, build(S) {
    const sky = K.skyFor(S, 'smoke', { smoke: 0.4, elev: 25, az: 200 }); const road = City.createStreet(420, { style: 'suburb', width: 22, cars: true, lamps: true, damage: 0.55, buildings: false, trees: true, seed: 5 }); S.add(road); const fx = S.fx; S.camFar = 5000;
    const g = new THREE.Mesh(new THREE.CircleGeometry(1200, 24), new THREE.MeshStandardMaterial({ color: 0x4a4130, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.y = -0.08; S.scene.add(g);
    const st = person(S, 'stephen'); st.place(0, [1.5, 0, -70], 0, 'run'); st.go(0, [[-1, -20], [2, 25], [0, 90]], { speed: 5.4, clip: 'sprint', ramp: 0.2 }); const kid = extra(S, 'child', 77, { name: 'Little Girl' }); kid.place(0, [-1.5, 0, -18], 0, 'cower'); kid.go(6.2, [[0, 40], [0, 100]], { speed: 4.2, clip: 'run' });
    const n = cnt(50); const c = createCrowd('civilian', n, { seed: 19 }); S.add(c); mover(S, c, n, { from: [0, -60], to: [4, 150], spread: [14, 40], toSpread: [14, 20], speed: 4.0, nominal: 4.0, state: 'panic', arrive: 'run', seed: 3, delaySpread: 4, die: { from: 3, to: 14, frac: 0.2 } });
    const pods = createPodSwarm(12); S.add(pods); const beams = createBeams({ capacity: 128 }); S.add(beams); const tmp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, state: 'hover', phase: 0 }; S.updaters.push({ t0: 0, t1: 17, fn: (t) => { for (let i = 0; i < pods.count; i++) { tmp.x = -60 + i * 11; tmp.y = 30 + (i % 3) * 9; tmp.z = -40 + t * 11 + i * 4; tmp.phase = i * 0.13; pods.set(i, tmp); } pods.commit(); if (!S.silent && Math.floor(t * 4) !== Math.floor((t - 0.05) * 4)) { const r = new RNG(Math.floor(t * 4) + 1); const i = r.int(0, pods.count - 1); const from = new V3(-60 + i * 11, 30 + (i % 3) * 9, -40 + t * 11 + i * 4); const to = new V3((r.next() - 0.5) * 14, 0, from.z + 25 + r.next() * 30); beams.fire({ from, to, width: 0.3, life: 0.25 }); fx.explosion(to, { size: 8, kind: 'laser' }); } } });
    S.shot(0, 5, { from: { pos: [8, 1.5, -88], look: [0, 1.3, -50], fov: 42 }, to: { pos: [6, 1.6, -60], look: [0, 1.3, -30], fov: 40 }, handheld: 0.9 }); S.shot(5, 11, { pos: () => { const h = st.headPos(new V3()); return [h.x + 1.8, h.y - 0.2, h.z + 6.5]; }, look: () => st.headPos(new V3()), fov: 38, handheld: 0.8 }, 'cut'); S.shot(11, 16, { follow: st, rel: true, offset: [2.6, 1.0, -3.2], look: [0, 1.3, 3], fov: 44, handheld: 1.0 }, 'cut');
    mood(S, { music: 'chase', amb: 'wind', level: 0.4, intensity: 0.85 }); S.stamp(0.5, 'MARCH 15 — 05:12 PDT', 'HIGHWAY 101, CALIFORNIA', 4); S.sfx(2, 'crowd_panic');
    S.say(3.0, st, "Keep going! Don't look back! Come on!", { dur: 3, emotion: 'urgent' }); S.say(7.0, st, "I've got you. I've got you, little one.", { dur: 2.8, emotion: 'serious' }); S.say(12, st, "Of all days to work a double shift.", { dur: 2.4, emotion: 'tired' });
  } },
  // ------------------------------------------------------------------ s26 — Georgia: the fortress holds
  { id: 's26_georgia_defense', dur: 24, build(S) {
    K.skyFor(S, 'dusk', { elev: 8, az: 230 }); const sanct = place(S, Life.createSanctuary()); sanct.setMode && sanct.setMode('exterior'); const fx = S.fx; S.camFar = 6000;
    const wall = A(sanct, 'wall_top'); const wx = wall.p[0], wz = wall.p[2];
    const nr0 = cnt(60); const robots = createCrowd('robot', nr0, { seed: 4 }); S.add(robots); mover(S, robots, nr0, { from: [wx, wz + 6], to: [wx, wz + 1], spread: [34, 3], toSpread: [36, 2], speed: 1, nominal: 1.4, state: 'walk', arrive: 'fire', idle: 'aim', face: [wx, wz - 80], seed: 6, delaySpread: 1 });
    const nc = cnt(220); const cr = createCrawlerSwarm(nc); S.add(cr); mover(S, cr, nc, { from: [wx, wz - 140], to: [wx, wz - 6], spread: [60, 30], toSpread: [60, 6], speed: 6.2, nominal: 5.5, state: 'run', arrive: 'climb', face: [wx, wz], seed: 9, delay: 1, delaySpread: 6, die: { from: 4, to: 19, frac: 0.8, state: 'dead' } });
    const beams = createBeams({ capacity: 320 }); S.add(beams); S.during(0, 20, (t) => { if (S.silent) return; if (Math.floor(t * 8) !== Math.floor((t - 0.04) * 8)) { const r = new RNG(Math.floor(t * 8) + 31); const from = new V3(wx + (r.next() - 0.5) * 36, 5.2, wz + 2); const to = new V3(wx + (r.next() - 0.5) * 50, 0.5, wz - 30 - r.next() * 60); beams.fire({ from, to, color: 0x6fb8ff, width: 0.14, life: 0.18 }); if (r.next() < 0.5) fx.explosion(to, { size: 4, kind: 'ground' }); } });
    const bead = person(S, 'bead'); bead.place(0, [wx + 3, wall.p[1], wz + 1], 3.1, 'aim_pistol'); bead.hold('pistol'); bead.autoLook = false; bead.gaze([wx, 2, wz - 40]);
    S.shot(0, 6, { from: { pos: [wx - 40, 6, wz + 24], look: [wx, 3, wz - 60], fov: 46 }, to: { pos: [wx - 24, 7, wz + 14], look: [wx + 10, 3, wz - 50], fov: 42 }, handheld: 0.4 }); S.shot(6, 11, { pos: () => { const h = bead.headPos(new V3()); return [h.x - 1.2, h.y + 0.1, h.z + 2.2]; }, look: () => bead.headPos(new V3()), fov: 32, handheld: 0.6, push: 0.3 }, 'cut'); S.shot(11, 24, { from: { pos: [wx + 4, 4, wz - 4], look: [wx, 2, wz - 70], fov: 56 }, to: { pos: [wx + 10, 12, wz + 8], look: [wx - 4, 2, wz - 40], fov: 48 }, handheld: 0.6 }, 'cut');
    mood(S, { music: 'resolve', amb: 'war_near', level: 0.5, intensity: 0.8 }); S.stamp(0.5, 'MARCH 15 — 17:30 GET', "EEN SANCTUARY, GEORGIA", 4);
    S.fit(6.0, 23.0, [[bead, 'ZIA. Status.', { emotion: 'serious' }], ['ZIA', 'Walls holding. Crawlers climb faster than we drop them.', { style: 'ai', color: COL.ai }], [bead, 'Then give them a reason to stop. Full defence.', { emotion: 'angry' }], ['ZIA', 'Executing. Bead, your friends are in the dark.', { style: 'ai', color: COL.ai }], [bead, 'I know. When the walls are safe, I go to them.', { emotion: 'serious' }]]);
  } },
  // ------------------------------------------------------------------ s27 — the morgue: five of nine in one room
  { id: 's27_morgue_meet', dur: 37, build(S) {
    const set = place(S, Life.createMorgue()); indoors(S, { intensity: 0.8 }); S.scene.background = new THREE.Color(0x070c0c); const door = A(set, 'door');
    const mir = person(S, 'mirrah'); at(mir, set, 'tableAFoot', 'idle'); const jez = person(S, 'jez'); const ez = person(S, 'ezra'); const sam = person(S, 'sam'); const leon = person(S, 'leon'); leon.hold('shotgun');
    jez.place(0, [door.p[0], 0, door.p[2] + 4], 3.1, 'sprint'); jez.go(0.2, [[door.p[0] - 0.4, door.p[2] - 1.4]], { speed: 3.4, endClip: 'idle', ramp: 0.2 }); ez.place(0, [door.p[0] + 1.2, 0, door.p[2] + 5], 3.1, 'run'); ez.go(2.4, [[door.p[0] + 1.1, door.p[2] - 1.2]], { speed: 3.3 }); sam.place(0, [door.p[0] + 0.2, 0, door.p[2] + 6], 3.1, 'jog'); sam.go(3.4, [[door.p[0] - 0.9, door.p[2] - 0.9]], { speed: 2.4, clip: 'walk_tired' });
    leon.place(0, [door.p[0] + 0.5, 0, door.p[2] + 6], 3.1, 'aim_walk'); leon.go(5.4, [[door.p[0] + 0.6, door.p[2] - 1.0]], { speed: 2.2, clip: 'aim_walk' }); [jez, ez, sam, leon].forEach((a) => a.faceTo(11, mir));
    mood(S, { music: 'sorrow', amb: 'morgue', level: 0.25, intensity: 0.4 }); S.callFrame(17.5, 36.5, 'GROUP LINK — RELAYED', '#7fe9ff'); S.sfx(0.8, 'door'); S.sfx(3.2, 'door');
    S.fit(2.0, 36.0, [[jez, 'Mirrah! You are alive! You are alive.', { emotion: 'happy' }], [mir, 'Jez. Sit down, you are shaking.', { emotion: 'worried' }], [ez, 'Sam drove through a barrier, Mirrah. A barrier!', { emotion: 'excited' }], [leon, 'Nobody move! ...oh. It is you.', { emotion: 'shocked' }], ['BEAD (LINK)', 'Mirrah? Jez? Anyone alive?', { style: 'radio', color: '#6fe3ff', emotion: 'urgent' }], [jez, 'Bead! Five of us. At the morgue.', { emotion: 'happy' }], ['STEPHEN (LINK)', 'California. Alive. Hungry. Hi, everybody.', { style: 'radio', color: '#ff8a6b' }], ['JHAZ (LINK)', "Cebu. Alive. Epiphany's with me.", { style: 'radio', color: '#7ab8ff' }], ['EPIPHANY (LINK)', "Dr. Mirrah. I'm glad you're alive.", { style: 'radio', color: '#f2e3a0', emotion: 'sad' }], [mir, 'Counselor. Likewise. Stay together.', { emotion: 'neutral' }]]);
    cover(S, set, 1, 37);
  } },
];
