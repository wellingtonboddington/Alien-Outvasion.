// ACT III — THE WEEK (10:00–15:00). Days 2–7: collapse, five plagues, a failed strike, and the interceptors.
import * as THREE from 'three';
import * as K from './kit.js';
import * as SC from './screens.js';
import { space, R_E } from './space.js';
import { createStreaks, glowTex as streakGlow } from './streaks.js';
import { battle, mover, cnt } from './battle.js';
import { createCrowd } from '../models/crowd.js';
import { createCrawlerSwarm } from '../models/aliens/index.js';
import { createPodSwarm, createBeams, createTripod, createTripodHorde } from '../models/alientech/index.js';
import * as Veh from '../models/vehicles.js';
import { createOcean } from '../world/ocean.js';
const { person, extra, alien, at, A, cover, indoors, place, nameCard, mood, COL, Life, Inst, City, safe, V3, RNG, clamp } = K;
const nr = (set, name, dx = 0, dz = 0) => { const a = A(set, name); return [a.p[0] + dx, a.p[1], a.p[2] + dz]; };
const radio = (o = {}) => ({ style: 'radio', color: COL.radio, ...o });
const mil = (o = {}) => ({ style: 'radio', color: COL.mil, ...o });
const alienLine = (o = {}) => ({ style: 'alien', color: COL.alien, ...o });
const ground = (S, color = 0x2b2a29, r = 1500) => { const g = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.y = -0.06; g.receiveShadow = true; S.scene.add(g); return g; };
const glow = (c, w, h, t) => { c.fillStyle = '#020'; c.fillRect(0, 0, w, h); };

export const ACT3 = [
  // ------------------------------------------------------------------ s28 — days of collapse
  { id: 's28_days_montage', dur: 20, build(S) {
    K.skyFor(S, 'smoke', { smoke: 0.7 }); S.camFar = 7000; const fx = S.fx;
    // A: refugee road + tripods on the horizon
    const road = City.createStreet(360, { style: 'generic', width: 20, damage: 0.7, buildings: false, cars: true, lamps: true, seed: 3 }); S.add(road); ground(S, 0x3a342b);
    const n = cnt(110); const c = createCrowd('civilian', n, { seed: 31 }); S.add(c); mover(S, c, n, { from: [0, -150], to: [2, 130], spread: [12, 150], toSpread: [12, 40], speed: 1.15, nominal: 1.3, state: 'walk', arrive: 'walk', seed: 7 });
    const h = createTripodHorde(cnt(14)); S.add(h); const tmp = { x: 0, y: 0, z: 0, yaw: 3.1, speed: 1, phase: 0, scale: 1, state: 'walk' }; S.updaters.push({ t0: 0, t1: 21, fn: (t) => { for (let i = 0; i < h.count; i++) { tmp.x = -260 + i * 42; tmp.z = 420 - t * 2.5 - (i % 3) * 30; tmp.phase = i * 0.3; h.set(i, tmp); } h.commit(); } });
    // B: skyline on fire
    const ox = 4000; const sk = safe('skyline', () => City.createSkyline('manhattan', { radius: 600, haze: 0.4 })); if (sk) { sk.position && sk.position.set(ox, 0, 0); S.add(sk); } const g2 = new THREE.Mesh(new THREE.CircleGeometry(800, 24), new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 1 })); g2.rotation.x = -Math.PI / 2; g2.position.set(ox, -0.05, 0); S.scene.add(g2);
    for (let i = 0; i < 6; i++) { fx.smokeColumn([ox + (i - 3) * 90, 0, -200 - (i % 3) * 60], { height: 160, width: 14, life: 60 }); fx.fire([ox + (i - 3) * 90, 3, -200 - (i % 3) * 60], { size: 5 }); }
    const tr = safe('tripod', () => createTripod(5, { size: 30, autoMove: false })); if (tr) { S.add(tr); S.updaters.push({ t0: 0, t1: 21, fn: (t) => { tr.root.position.set(ox - 30, 0, -130 + t * 3.2); tr.setGait({ speed: 3.2, heading: 0 }); } }); }
    // C: the war room map (interior, offset)
    const war = place(S, Inst.createWarRoom(), [9000, 0, 0]); K.news(S, war, 'wall', SC.worldMap(0.8), 10);
    S.shot(0, 6, { from: { pos: [-8, 1.7, -90], look: [0, 2, 40], fov: 36 }, to: { pos: [-6, 1.7, -60], look: [0, 2, 40], fov: 34 }, handheld: 0.5 }); S.shot(6, 12, { from: { pos: [ox - 6, 1.8, 70], look: [ox, 25, -150], fov: 48 }, to: { pos: [ox - 2, 1.9, 40], look: [ox, 25, -150], fov: 44 }, handheld: 0.4 }, 'dip');
    const ca = A(war, 'camScreens'); S.shot(12, 20, { from: { pos: ca.p, look: [9000, 2.2, -8], fov: 44 }, to: { pos: [9000, 2.0, 1], look: [9000, 2.4, -8], fov: 40 }, handheld: 0.2 }, 'dip');
    S.stamp(0.6, 'DAY 2 — MARCH 17, 2050', 'ROUTE 9 — EVACUATION COLUMN', 4); S.stamp(6.6, 'DAY 4 — MARCH 19, 2050', 'LOWER MANHATTAN — ABANDONED', 4); S.stamp(12.6, 'DAY 5 — MARCH 20, 2050', 'JOINT OPERATIONS CENTRE', 4);
    mood(S, { music: 'sorrow', amb: 'wind', level: 0.45, intensity: 0.5 }); S.sfx(7.5, 'tripod_horn', { gain: 0.5 });
    S.say(2.0, 'REFUGEE', 'My son is in the second bus. Please. Have you seen the second bus?', { color: COL.npc, dur: 4.2, emotion: 'sad' }); S.say(13.0, 'ANALYST', 'London has fallen. Madrid has fallen. Berlin is hours away.', radio({ dur: 3.8, emotion: 'tired' })); S.say(17.0, 'ANALYST', 'Sixty percent of the planet is red, General.', radio({ dur: 2.6, emotion: 'afraid' }));
  } },
  // ------------------------------------------------------------------ s29 — the General Assembly
  { id: 's29_un_session', dur: 36, build(S) {
    const set = place(S, Inst.createUNHall()); indoors(S, { intensity: 0.7 }); K.news(S, set, 'screenL', SC.worldMap(0.75), 8); K.news(S, set, 'screenR', SC.cometMap('FLEET POSITION', 412), 8);
    const sg = extra(S, 'politician', 71, { name: 'Sec.-Gen. Nwosu', color: COL.news, npc: { gender: 'F', ethnicity: 'black' } }); const ru = extra(S, 'politician', 72, { name: 'Amb. Sokolov', color: COL.news, npc: { gender: 'M', ethnicity: 'slavic' } }); const us = extra(S, 'politician', 73, { name: 'Amb. Hale', color: COL.news, npc: { gender: 'M', ethnicity: 'caucasian' } }); const ind = extra(S, 'politician', 74, { name: 'Amb. Mehra', color: COL.news, npc: { gender: 'F', ethnicity: 'south_asian' } }); const ph = extra(S, 'politician', 75, { name: 'Amb. Cruz', color: COL.news, npc: { gender: 'F', ethnicity: 'filipino' } });
    at(sg, set, 'podium', 'idle'); at(ru, set, 'delegate0', 'sit'); at(us, set, 'delegate1', 'sit'); at(ind, set, 'delegate2', 'sit'); at(ph, set, 'delegate3', 'sit');
    S.stamp(0.6, 'DAY 4 — MARCH 19, 2050', 'UNITED NATIONS — EMERGENCY SESSION', 5); mood(S, { music: 'tension_low', amb: 'interior_hum', level: 0.25, intensity: 0.45 });
    S.fit(1.0, 35.0, [[sg, 'Delegates. Day four. We have lost forty percent of our cities.', { emotion: 'tired' }], [us, 'Our forces are inflicting losses. It is not enough.', { emotion: 'serious' }], [ru, 'Moscow is encircled. The nuclear option must be on the table.', { emotion: 'angry' }], [ind, 'Delhi will not hand its people over to be harvested.', { emotion: 'angry' }], [us, 'Orbital interceptors, armed. Ready on day seven. Not one hour sooner.', { emotion: 'cold' }], [ru, 'Day seven. If the world lasts that long.', { emotion: 'cold' }], [ph, 'Ambassadors. Five of our biologists vanished from the registry today. Why?', { emotion: 'worried' }], [us, 'Reassigned.', { emotion: 'cold' }]]);
    cover(S, set, 0, 36, { dist: 1.1 });
  } },
  // ------------------------------------------------------------------ s30 — Berlin (the lab, then the street)
  { id: 's30_berlin', dur: 26, build(S) {
    const lab = place(S, Inst.createLab('bsl4'), [7000, 0, 0]); K.news(S, lab, 'status', SC.outbreak('STRAIN BRAVO', 0.6), 10); indoors(S, { intensity: 0.5 });
    const dr = extra(S, 'scientist', 81, { name: 'Dr. Brandt', color: COL.sci, npc: { gender: 'F', ethnicity: 'german' } }); at(dr, lab, 'scientistA', 'idle'); dr.faceTo(0, nr(lab, 'airlockIn'));
    const v1 = alien(S, 'soldier', 3, { name: 'VESSARI' }); const a1 = A(lab, 'airlockIn'); v1.place(0, [a1.p[0] - 3.5, 0, a1.p[2]], 1.57, 'stalk'); v1.go(2.5, [[a1.p[0] + 3.2, a1.p[2]]], { speed: 1.0, clip: 'stalk' }); S.during(7.2, 30, (t) => v1.model.setInfection && v1.model.setInfection(Math.min(1, (t - 7.2) / 1.6)));
    const b = battle(S, { style: 'berlin', sky: 'overcast', damage: 0.6, soldiers: 0, crawlers: 130, pods: 40, vessari: 70, tripods: 2, horde: 0, zombies: [{ kind: 'zombie_germany', n: 150, from: [0, 30], to: [0, -35], speed: 5.6, nominal: 5.0, state: 'sprint', arrive: 'lunge', face: [0, -80], delay: 1.5, delaySpread: 6, spread: [24, 10], toSpread: [30, 20] }], tOffset: 11, camFrom: 11.5, alienInfect: { from: 14, to: 22 }, aliensDie: 0.5 });
    const ca = A(lab, 'camWide'); S.shot(0, 5, { pos: ca.p, look: [7000 + 1, 1.2, 0], fov: 38, handheld: 0.4 }); S.shot(5, 9, { pos: () => { const h = dr.headPos(new V3()); return [h.x + 0.5, h.y, h.z + 1.2]; }, look: () => dr.headPos(new V3()), fov: 30, handheld: 0.5, push: 0.3 }, 'cut'); S.shot(9, 11.5, { pos: A(lab, 'camAirlock').p, look: [7000 - 3, 1.4, 0], fov: 40, handheld: 0.7 }, 'cut');
    S.stamp(0.5, 'DAY 5 — MARCH 20, 2050 — 23:10 CET', 'CHARITÉ BIOSECURITY LAB — BERLIN', 5); mood(S, { music: 'horror', amb: 'lab', level: 0.35, intensity: 0.7 }); S.sfx(7.0, 'infect_zap'); S.sfx(11.5, 'zombie_roar'); S.sfx(17, 'zombie_moan');
    S.fit(0.8, 10.8, [[dr, 'Das war es. Sie sind im Gebäude.', { lang: 'de-DE', sub: "That's it. They're in the building.", emotion: 'afraid', visemeText: 'das var es zi zint im gebowde' }], [dr, 'Für Berlin.', { lang: 'de-DE', sub: 'For Berlin.', emotion: 'serious', visemeText: 'fur berlin' }], [dr, 'Strain Bravo. Released.', { emotion: 'cold' }]]);
    S.say(13.4, 'GERMAN COMMAND', "They're opening doors. Dear God, the dead are opening the doors!", radio({ dur: 3.6, emotion: 'shocked' })); S.say(19.0, 'GERMAN COMMAND', "The aliens are turning. They're turning green!", radio({ dur: 2.8, emotion: 'shocked' }));
  } },
  // ------------------------------------------------------------------ s31 — Moscow: the pincer
  { id: 's31_moscow', dur: 24, exposure: 0.62, build(S) {
    K.skyFor(S, 'coldMorning', { elev: 14, az: 200 }); const lm = City.createLandmark('moscow_kremlin', { snow: true }); lm.position && lm.position.set(0, 0, -240); S.scene.add(lm); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() }); const fx = S.fx; fx.snow && fx.snow({ intensity: 1 }); S.camFar = 6000;
    const b = battle(S, { style: false, sky: false, groundColor: 0x9aa3ae, soldiers: 0, crawlers: 70, pods: 20, vessari: 90, tripods: 0, horde: 0, cams: false, zombies: [{ kind: 'zombie_russia', n: 90, from: [-110, 10], to: [-14, -6], speed: 5.4, nominal: 5.0, state: 'sprint', arrive: 'lunge', face: [0, -8], delay: 3, spread: [10, 40], toSpread: [6, 24] }, { kind: 'zombie_russia', n: 90, from: [110, 10], to: [14, -6], speed: 5.4, nominal: 5.0, state: 'sprint', arrive: 'lunge', face: [0, -8], delay: 3, spread: [10, 40], toSpread: [6, 24] }, { kind: 'zombie_russia', n: 50, from: [0, 130], to: [0, 12], speed: 5.2, nominal: 5.0, state: 'sprint', arrive: 'lunge', face: [0, -20], delay: 5, spread: [30, 10], toSpread: [20, 10] }], alienInfect: { from: 9, to: 20 }, aliensDie: 0.55, hz: 40, az0: -30, laneX: 0 });
    S.shot(0, 8, { from: { pos: [0, 150, 40], look: [0, 0, -5], fov: 40 }, to: { pos: [0, 95, 28], look: [0, 0, -5], fov: 40 }, handheld: 0.1 }); S.shot(8, 14, { from: { pos: [-60, 4, 14], look: [-14, 2, -6], fov: 44 }, to: { pos: [-34, 3, 8], look: [-8, 2, -6], fov: 40 }, handheld: 0.7 }, 'cut'); S.shot(14, 19, { pos: [0, 2.0, 62], look: [0, 2, -20], fov: 38, handheld: 0.6, push: 6 }, 'cut'); S.shot(19, 24, { from: { pos: [40, 30, 60], look: [0, 2, -10], fov: 44 }, to: { pos: [8, 14, 24], look: [0, 2, -10], fov: 40 }, handheld: 0.4 }, 'cut');
    S.stamp(0.5, 'DAY 5 — MARCH 20, 2050 — 06:40 MSK', 'MOSCOW — RED SQUARE', 5); mood(S, { music: 'dread', amb: 'snow_wind', level: 0.5, intensity: 0.7 }); S.sfx(9, 'zombie_roar'); S.sfx(15, 'zombie_roar');
    S.fit(1.0, 22.5, [['DR. VOLKOV', 'Они учатся. Они держат строй.', { style: 'radio', color: COL.radio, lang: 'ru-RU', sub: 'They are learning. They are holding formation.', visemeText: 'oni uchatsya oni derzhat stroy', emotion: 'shocked' }], ['DR. VOLKOV', 'Left flank. Right flank. And a third group behind them. They are coordinating. They are hunting.', radio({ emotion: 'afraid' })], ['RUSSIAN OFFICER', 'Our own strain... it is smarter than we dared to hope.', radio({ emotion: 'shocked' })]]);
  } },
  // ------------------------------------------------------------------ s32 — New York: the giants
  { id: 's32_newyork_giants', dur: 22, build(S) {
    const b = battle(S, { style: 'manhattan', sky: 'smoke', damage: 0.45, soldiers: 0, crawlers: 110, pods: 60, vessari: 45, tripods: 2, horde: 0, zombies: [{ kind: 'zombie_giant', n: 16, from: [0, 60], to: [0, -60], speed: 6.6, nominal: 5.0, state: 'sprint', arrive: 'lunge', face: [0, -90], delay: 1, spread: [10, 30], toSpread: [14, 20] }, { kind: 'zombie_us', n: 90, from: [0, 90], to: [0, -55], speed: 7.4, nominal: 5.0, state: 'sprint', arrive: 'lunge', face: [0, -90], delay: 2, spread: [14, 40], toSpread: [20, 20] }], alienInfect: { from: 12, to: 20 }, aliensDie: 0.6, humansDie: 0, hz: 60, az0: -90 });
    const tr = b.tripods[0]; if (tr) { S.during(11, 22, (t) => { const k = Math.min(1, (t - 11) / 3.2); tr.root.rotation.z = k * k * 1.45; tr.root.position.y = -k * 6; }); S.on(13.4, () => { S.fx.explosion(new V3(tr.root.position.x + 8, 3, tr.root.position.z), { size: 30, kind: 'big' }); S.fx.dust(new V3(tr.root.position.x + 8, 1, tr.root.position.z), { radius: 30, amount: 1.4 }); }); }
    S.stamp(0.5, 'DAY 6 — MARCH 21, 2050 — 02:20 EST', 'MANHATTAN — FIFTH AVENUE', 5); mood(S, { music: 'horror', amb: 'war_near', level: 0.6, intensity: 0.85 }); S.sfx(4, 'zombie_roar'); S.sfx(13, 'explosion_big');
    S.fit(1.0, 21.0, [['CITY MONITOR', "They're twice the size of a man. Eight feet. Maybe more.", mil({ emotion: 'shocked' })], ['CITY MONITOR', 'One just ripped a tripod leg clean off. With its hands.', mil({ emotion: 'shocked' })], ['DR. WEBB', 'Strain November works. God help us — it works.', radio({ emotion: 'afraid' })]]);
  } },
  // ------------------------------------------------------------------ s33 — Delhi: the air itself
  { id: 's33_delhi_air', dur: 20, build(S) {
    K.skyFor(S, 'dayHaze'); const lm = City.createLandmark('delhi_gate', {}); lm.position.set(0, 0, -110); S.scene.add(lm); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() }); const fx = S.fx;
    const b = battle(S, { style: false, sky: false, groundColor: 0x7d6e55, soldiers: 0, crawlers: 80, pods: 24, vessari: 80, tripods: 0, horde: 0, cams: false, zombies: [{ kind: 'zombie_india', n: 170, from: [0, 160], to: [0, -30], speed: 8.5, nominal: 7.0, state: 'sprint', arrive: 'cough', face: [0, -80], delay: 2, spread: [60, 40], toSpread: [50, 30] }], alienInfect: { from: 5, to: 11 }, aliensDie: 0.65, hz: 20, az0: -40, laneX: 0 });
    for (let i = 0; i < 5; i++) fx.sporeCloud([(i - 2) * 24, 6, -20 + (i % 2) * 28], { radius: 22, density: 1 }); S.during(0, 21, (t) => { if (S.silent) return; if (Math.floor(t * 3) !== Math.floor((t - 0.05) * 3)) { const r = new RNG(Math.floor(t * 3) + 5); fx.coughPuff([(r.next() - 0.5) * 50, 1.5, -10 + r.next() * 40], [0, 0.3, -1], { size: 1.4 }); } });
    S.shot(0, 5, { from: { pos: [6, 1.6, 90], look: [0, 3, -20], fov: 40 }, to: { pos: [4, 1.7, 60], look: [0, 3, -20], fov: 38 }, handheld: 0.9 }); S.shot(5, 11, { pos: [-14, 1.2, 40], look: [8, 2, -30], fov: 56, handheld: 1.0, push: 4 }, 'cut'); S.shot(11, 16, { from: { pos: [0, 40, 70], look: [0, 4, -20], fov: 44 }, to: { pos: [0, 24, 40], look: [0, 4, -20], fov: 40 }, handheld: 0.3 }, 'cut'); S.shot(16, 20, { pos: [3, 1.3, 14], look: [0, 1.8, -20], fov: 50, handheld: 1.0 }, 'cut');
    S.stamp(0.5, 'DAY 6 — MARCH 21, 2050 — 11:30 IST', 'NEW DELHI — INDIA GATE', 5); mood(S, { music: 'horror', amb: 'wind', level: 0.4, intensity: 0.9 }); S.sfx(4, 'zombie_cough'); S.sfx(7, 'zombie_cough'); S.sfx(11, 'zombie_roar');
    S.fit(0.8, 19.0, [['DR. RAO', "It's airborne. In the air, in the water. All of Delhi is breathing it.", radio({ emotion: 'afraid' })], ['DR. RAO', 'Two minutes from first breath to first scream. The aliens breathe too.', radio({ emotion: 'shocked' })], ['DR. RAO', 'We cannot stop it. We never could.', radio({ emotion: 'sad' })]]);
  } },
  // ------------------------------------------------------------------ s34 — Cebu: the signature, the door
  { id: 's34_cebu_release', dur: 34, build(S) {
    const lab = place(S, Inst.createLab('bsl4')); indoors(S, { intensity: 0.5 }); K.news(S, lab, 'monitorA', SC.outbreak('STRAIN CHARLIE', 0.8), 10); K.news(S, lab, 'status', SC.outbreak('MACHINE VECTOR', 0.6), 10);
    const jhaz = person(S, 'jhaz'); const epi = person(S, 'epiphany'); const oc = extra(S, 'scientist', 91, { name: 'Dr. Ocampo', color: COL.sci, npc: { gender: 'F', ethnicity: 'filipino' } });
    at(epi, lab, 'scientistB', 'idle'); epi.hold('folder'); at(oc, lab, 'scientistA', 'idle'); const ap = A(lab, 'airlockIn'); jhaz.place(0, [ap.p[0] + 2.2, 0, ap.p[2] + 0.5], 1.57, 'idle');
    const n = cnt(24); const robots = createCrowd('robot', n, { seed: 9 }); S.add(robots); mover(S, robots, n, { from: [ap.p[0] - 20, ap.p[2]], to: [ap.p[0] - 1.6, ap.p[2]], spread: [6, 3], toSpread: [1.5, 3], speed: 6, nominal: 4.0, state: 'sprint', arrive: 'lunge', face: [ap.p[0] + 6, ap.p[2]], delay: 21, delaySpread: 1.5, infect: { from: 18, to: 20 } });
    const door = A(lab, 'airlockInner'); epi.go(20.0, [[door.p[0] + 0.7, door.p[2]]], { speed: 1.4, clip: 'walk' }); jhaz.go(22.0, [[ap.p[0] + 9, ap.p[2]]], { speed: 4.2, clip: 'run' }); epi.act(25.2, 'sad', { yaw: -1.57 });
    const ox = 5000; const sk = safe('skyline', () => City.createSkyline('cebu', { radius: 600, haze: 0.4 })); if (sk) { sk.position && sk.position.set(ox, 0, 0); S.add(sk); }
    const pods = createPodSwarm(cnt(40)); S.add(pods); const tmp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, state: 'hover', phase: 0, infect: 0 }; S.updaters.push({ t0: 0, t1: 35, fn: (t) => { for (let i = 0; i < pods.count; i++) { const f = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1; const ti = 27 + f * 4; tmp.x = ox + (f - 0.5) * 240; tmp.z = -40 - (i % 5) * 18; tmp.y = 70 + (i % 4) * 6 - (t > ti + 1 ? Math.min(60, (t - ti - 1) * 30) : 0); tmp.infect = Math.max(0, Math.min(1, (t - ti) / 1.2)); tmp.state = t > ti + 1.5 ? 'dead' : 'hover'; tmp.phase = f; pods.set(i, tmp); } pods.commit(); } });
    S.stamp(0.5, 'DAY 6 — MARCH 21, 2050 — 09:12 PHT', 'VISAYAS BIOMEDICAL INSTITUTE — CEBU CITY', 5.5); mood(S, { music: 'dread', amb: 'lab', level: 0.3, intensity: 0.6 });
    S.fit(1.2, 20.4, [[oc, "Counsel. The trustee's authorisation, please.", { emotion: 'serious' }], [epi, 'By authority of the Institute trust, I authorise the release of Strain Charlie.', { emotion: 'cold' }], [jhaz, "Piphy... that virus eats machines. And whatever else it touches.", { emotion: 'worried' }], [epi, 'Including us. Eight billion people against a species that did not ask.', { emotion: 'sad' }], [oc, 'Releasing in three. Two. One.', { emotion: 'afraid' }]]);
    S.say(21.2, jhaz, 'Piphy! The machines — they are coming for the door!', { dur: 3.0, emotion: 'afraid' }); S.say(24.4, epi, "Go, Jhaz. The authority was mine. So is this.", { dur: 3.0, emotion: 'serious' }); S.say(27.2, epi, "Tell Mirrah I would like that coffee.", { dur: 2.6, emotion: 'sad' });
    const w = A(lab, 'camWide'); const ca = A(lab, 'camAirlock'); cover(S, lab, 0, 20);
    S.shot(20, 26, { pos: [ap.p[0] + 4.5, 1.5, ap.p[2] + 1.8], look: [ap.p[0] + 0.5, 1.3, ap.p[2]], fov: 42, handheld: 1.1 }, 'cut'); S.shot(26, 30, { pos: () => { const h = epi.headPos(new V3()); return [h.x + 1.1, h.y - 0.02, h.z - 0.9]; }, look: () => epi.headPos(new V3()), fov: 28, handheld: 0.3, push: 0.2 }, 'cut');
    S.shot(30, 34, { from: { pos: [ox - 30, 2, 120], look: [ox, 70, -40], fov: 54 }, to: { pos: [ox - 14, 2, 110], look: [ox, 52, -40], fov: 52 }, handheld: 0.5 }, 'dip'); S.music(20.5, 'sorrow', { intensity: 0.7 }); S.sfx(20.8, 'door'); S.sfx(24, 'impact');
  } },
  // ------------------------------------------------------------------ s35 — the Hierarch sees
  { id: 's35_alien_reaction', dur: 26, build(S) {
    const set = place(S, Inst.createAlienInterior('bridge')); indoors(S, { intensity: 0.4, color: 0x4488aa }); S.scene.background = new THREE.Color(0x02060a);
    const hi = K.alien(S, 'hierarch', 1, { name: 'THE HIERARCH' }); const th = K.alien(S, 'officer', 2, { name: 'WARLORD THESSIK' }); const ku = K.alien(S, 'drone', 3, { name: 'KUUR' });
    at(hi, set, 'hierarch', 'idle'); at(th, set, 'daisFront', 'idle_alert'); at(ku, set, 'attA', 'kneel'); th.faceTo(0, hi); ku.faceTo(0, hi);
    S.during(11, 30, (t) => ku.model.setInfection && ku.model.setInfection(Math.min(0.9, (t - 11) / 8)));
    mood(S, { music: 'alien', amb: 'alien_hum', level: 0.5, intensity: 0.5 }); S.stamp(0.5, 'DAY 6 — MARCH 21, 2050', 'VESSARI FLAGSHIP — ORBIT', 4);
    S.fit(0.8, 25.0, [[th, 'Hierarch. The tether is burning. Our brothers on the ground are dying from within.', alienLine({ sub: 'Hierarch. The tether is burning. Our brothers on the ground are dying from within.', emotion: 'worried' })], [hi, 'Dying of what? These creatures have no such weapon.', alienLine({ emotion: 'serious' })], [ku, 'It is in the blood, Hierarch. In the metal. In our own ships.', alienLine({ emotion: 'afraid' })], [hi, 'Seal the infected decks. Cut the dying from the living.', alienLine({ emotion: 'cold' })], [th, 'They are still our brothers.', alienLine({ emotion: 'sad' })], [hi, 'And the living are still our people. Seal them.', alienLine({ emotion: 'cold' })]]);
    cover(S, set, 0, 26, { dist: 1.2 });
  } },
  // ------------------------------------------------------------------ s36a — North Korea launches
  { id: 's36a_nk_launch', dur: 12, build(S) {
    K.skyFor(S, 'dusk', { elev: 3, az: 250 }); const set = place(S, Inst.createLaunchSite()); const fx = S.fx; S.camFar = 8000; const pad = A(set, 'telPad');
    const msl = safe('icbm', () => Veh.createMissile('icbm', { axis: 'z' })); if (msl) { const e = S.entity(msl); e.at(0, [pad.p[0], 4.2, pad.p[2]], 0, { pitch: Math.PI / 2 }); e.path(6.0, 12, [[pad.p[0], 4.2, pad.p[2]], [pad.p[0], 60, pad.p[2]], [pad.p[0] + 20, 380, pad.p[2] - 20], [pad.p[0] + 120, 2200, pad.p[2] - 150]], { ease: 'in', pitch: true }); S.during(0, 6.0, () => { msl.root.rotation.x = -Math.PI / 2; }); S.on(6.0, () => { fx.smokeColumn([pad.p[0], 0, pad.p[2]], { height: 80, width: 14, life: 12 }); fx.fire([pad.p[0], 1, pad.p[2]], { size: 7 }); fx.shockwave([pad.p[0], 0.5, pad.p[2]], { size: 60 }); fx.dust([pad.p[0], 0.5, pad.p[2]], { radius: 30, amount: 1.5 }); }); S.during(6, 12, () => msl.setBurn && msl.setBurn(1)); }
    const cw = A(set, 'camWide'); const cp = A(set, 'camLow'); S.shot(0, 5.5, { from: { pos: cw.p, look: [pad.p[0], 8, pad.p[2]], fov: 40 }, to: { pos: [cw.p[0] + 4, cw.p[1], cw.p[2] - 4], look: [pad.p[0], 9, pad.p[2]], fov: 34 }, handheld: 0.3 }); S.shot(5.5, 12, { from: { pos: cp.p, look: [pad.p[0], 6, pad.p[2]], fov: 46 }, to: { pos: cp.p, look: [pad.p[0] + 20, 220, pad.p[2]], fov: 52 }, handheld: 0.5 }, 'cut');
    S.stamp(0.5, 'DAY 6 — MARCH 21, 2050 — 22:50 KST', 'KOREAN PENINSULA — MISSILE FIELD', 4.5); mood(S, { music: 'tension_high', amb: 'wind', level: 0.3, intensity: 0.7 }); S.sfx(6.0, 'missile_launch');
    S.fit(0.6, 5.2, [['LAUNCH OFFICER', '오, 사, 삼, 이, 일.', { style: 'radio', color: COL.mil, lang: 'ko-KR', sub: 'Five, four, three, two, one.', visemeText: 'o sa sam i il', emotion: 'serious' }]]); S.say(5.3, 'LAUNCH OFFICER', '발사.', { style: 'radio', color: COL.mil, lang: 'ko-KR', sub: 'Fire.', visemeText: 'balsa', emotion: 'cold', dur: 1.0 });
  } },
  // ------------------------------------------------------------------ s36b — it fails
  { id: 's36b_nk_intercepted', dur: 12, cutIn: true, build(S) {
    const sp = space(S, { lat: 36, lon: 128, sunFront: 0.2, sunSide: 0.9 }); const hero = sp.ship(7, 34, 126, 420, 900); const hp = hero.root.position.clone(); const fx = S.fx;
    const msl = safe('icbm', () => Veh.createMissile('icbm', { axis: 'z' })); const start = sp.at(37.5, 127.6, 0), end = sp.at(35, 126.4, 380); if (msl) { msl.root.scale.setScalar(0.4); S.entity(msl).path(0, 6.5, [[start.x, start.y, start.z], [end.x * 0.999, end.y * 0.999, end.z * 0.999]], { pitch: true, ease: 'in' }); S.during(0, 12, () => msl.setBurn && msl.setBurn(1)); S.during(6.6, 20, () => { msl.root.visible = false; }); }
    S.on(5.8, () => sp.beams.fire({ from: hp, to: end, width: 0.03, life: 0.8 })); S.on(6.6, () => { fx.explosion(end, { size: 0.35, kind: 'fireball' }); }); S.post(6.5, 7.0, 'flash', 0.5, 0, 'out');
    S.shot(0, 6, { from: { pos: sp.cam(36, 127, R_E + 700, 20, 10), look: end.toArray(), fov: 36 }, to: { pos: sp.cam(36, 127, R_E + 500, 8, 3), look: end.toArray(), fov: 30 }, handheld: 0.1 }); S.shot(6, 12, { from: { pos: [hp.x + 2.4, hp.y + 0.5, hp.z + 1.4], look: hp.toArray(), fov: 36 }, to: { pos: [hp.x + 1.2, hp.y + 0.3, hp.z + 0.7], look: hp.toArray(), fov: 36 } }, 'cut');
    mood(S, { music: 'tension_high', amb: 'space', level: 0.5, intensity: 0.7 }); S.title(8.2, 'INTERCEPTED', '', 3, { size: 5 });
    S.fit(0.4, 5.6, [['NORAD', 'Launch detected. Korean peninsula.', mil({ emotion: 'serious' })], ['NORAD', 'Headed for the fleet.', mil({ emotion: 'afraid' })]]); S.say(8.0, 'NORAD', 'Missile destroyed. They did not even slow down.', mil({ dur: 3.2, emotion: 'tired' }));
  } },
  // ------------------------------------------------------------------ s37 — the decision (three rooms, one key)
  { id: 's37_decision', dur: 26, build(S) {
    const war = place(S, Inst.createWarRoom()); const bunker = place(S, Inst.createBunker(), [3000, 0, 0]); const silo = place(S, Inst.createSiloControl(), [6000, 0, 0]); indoors(S, { intensity: 0.5 });
    K.news(S, war, 'wall', SC.worldMap(0.9, 0.3), 10); K.news(S, silo, 'countdown', (c, w, h, t) => { c.fillStyle = '#100'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3b2a'; c.font = `700 ${h * 0.5}px monospace`; c.textAlign = 'center'; c.fillText(String(Math.max(0, 22 - Math.floor(t))).padStart(2, '0'), w / 2, h * 0.7); }, 6);
    const prs = extra(S, 'politician', 63, { name: 'Madam President', color: COL.news, npc: { gender: 'F', ethnicity: 'caucasian' } }); const gen = extra(S, 'general', 61, { name: 'Gen. Brooks', color: COL.mil, npc: { gender: 'M', ethnicity: 'black' } }); const rus = extra(S, 'general', 65, { name: 'Gen. Orlov', color: COL.mil, npc: { gender: 'M', ethnicity: 'slavic' } }); const opA = extra(S, 'officer', 66, { name: 'Officer', npc: { gender: 'M', ethnicity: 'caucasian' } }); const opB = extra(S, 'officer', 67, { name: 'Officer', npc: { gender: 'F', ethnicity: 'black' } });
    at(prs, war, 'mapTableL', 'idle'); at(gen, war, 'general', 'idle_arms_crossed'); at(rus, bunker, 'radio', 'idle'); at(opA, silo, 'operatorA', 'idle'); at(opB, silo, 'operatorB', 'idle'); opA.faceTo(0, [6000, 1.4, -2]); opB.faceTo(0, [6000, 1.4, -2]);
    S.stamp(0.6, 'DAY 7 — MARCH 22, 2050 — 00:10 UTC', 'JOINT COMMAND — THREE CONTINENTS', 5); mood(S, { music: 'nuclear', amb: 'interior_hum', level: 0.25, intensity: 0.6 });
    S.fit(1.0, 25.0, [[prs, 'The aliens are inside our laboratories. The infection has begun. We will not get a better moment.', { emotion: 'cold' }], [gen, 'Interceptor wing is ready, Madam President. Every missile, every silo.', { emotion: 'serious' }], [rus, 'Мы согласны. Москва готова.', { lang: 'ru-RU', sub: 'We agree. Moscow is ready.', emotion: 'cold', visemeText: 'mi soglasni moskva gotova' }], [prs, 'The Security Council has authorised joint command. Authenticate.', { emotion: 'serious' }], [opA, 'Key one, turned.', { emotion: 'serious' }], [opB, 'Key two, turned. Birds are hot.', { emotion: 'afraid' }], [prs, 'God forgive us. Launch.', { emotion: 'sad' }]]);
    const L = S.lines; const at1 = (a) => L.find((l) => l.actor === a); const sw = A(war, 'camTable'), sb = A(bunker, 'camWide'), ss = A(silo, 'camBoth');
    S.shot(0, 6, { pos: sw.p, look: [0, 1.4, 3], fov: 40, handheld: 0.3 }); S.shot(6, 11, { pos: A(war, 'camMapTable').p, look: () => prs.headPos(new V3()), fov: 32, handheld: 0.4, push: 0.2 }, 'cut'); S.shot(11, 14.5, { pos: sb.p, look: [3000 + 1.4, 1.3, -1], fov: 38, handheld: 0.4 }, 'cut'); S.shot(14.5, 18, { pos: () => { const h = prs.headPos(new V3()); return [h.x + 0.5, h.y, h.z + 1.2]; }, look: () => prs.headPos(new V3()), fov: 28, handheld: 0.3 }, 'cut');
    S.shot(18, 21, { pos: A(silo, 'camKeyA').p, look: [6000 - 3.5, 1.3, -0.5], fov: 34, handheld: 0.5 }, 'cut'); S.shot(21, 23.5, { pos: A(silo, 'camKeyB').p, look: [6000 + 3.5, 1.3, -0.5], fov: 34, handheld: 0.5 }, 'cut'); S.shot(23.5, 26, { pos: A(silo, 'camBoard').p, look: [6000, 2.0, -2.8], fov: 34, handheld: 0.2, push: 0.4 }, 'cut');
  } },
  // ------------------------------------------------------------------ s38 — day seven: the interceptors rise
  { id: 's38_interceptor_launch', dur: 14, build(S) {
    K.skyFor(S, 'dawn', { elev: 6, az: 90 }); S.camFar = 20000; const fx = S.fx; ground(S, 0x6a5a40, 3000); const SK = createStreaks(S);
    const pads = [[-60, -80], [0, -110], [70, -90], [30, -140]]; pads.forEach((p, i) => { const m = safe('interceptor', () => Veh.createMissile('interceptor', { axis: 'z' })); if (!m) return; const e = S.entity(m); const t0 = 2.2 + i * 1.4; e.at(0, [p[0], 6.2, p[1]], 0, { pitch: Math.PI / 2 }); const climb = [[p[0], 6.2, p[1]], [p[0], 30, p[1]], [p[0] + 6, 160, p[1] - 6], [p[0] + 30, 1400, p[1] - 80], [p[0] + 90, 9000, p[1] - 300]]; e.path(t0, 14, climb, { ease: 'in', pitch: true });
      SK.add(climb, { t0, t1: 14, ease: 'in', widthPx: 3.2, worldW: 16, tailLen: 5200, grow: 3.4, headPx: 0.014, hot: [9, 6.8, 4.6], cool: [1.1, 1.0, 0.92] }); S.during(0, t0, () => { m.root.rotation.x = -Math.PI / 2; }); S.during(t0, 40, () => m.setBurn && m.setBurn(1)); S.on(t0, () => { fx.smokeColumn([p[0], 0, p[1]], { height: 90, width: 12, life: 12 }); fx.fire([p[0], 1, p[1]], { size: 6 }); fx.shockwave([p[0], 0.5, p[1]], { size: 70 }); fx.dust([p[0], 0.5, p[1]], { radius: 36, amount: 1.6 }); }); S.sfx(t0, 'missile_launch', { pos: [p[0], 5, p[1]] }); });
    S.shot(0, 5, { from: { pos: [-20, 2.0, 30], look: [0, 8, -110], fov: 44 }, to: { pos: [-10, 2.2, 20], look: [0, 12, -110], fov: 40 }, handheld: 0.4 }); S.shot(5, 10, { pos: [20, 1.3, -40], look: [30, 60, -140], fov: 54, handheld: 0.6, push: 3 }, 'cut'); S.shot(10, 14, { from: { pos: [0, 2, -40], look: [30, 200, -200], fov: 58 }, to: { pos: [0, 2, -40], look: [40, 900, -300], fov: 58 }, handheld: 0.3 }, 'cut');
    S.stamp(0.5, 'DAY 7 — MARCH 22, 2050 — 00:41 UTC', 'WHITE SANDS INTERCEPTOR RANGE', 5); mood(S, { music: 'nuclear', amb: 'wind', level: 0.3, intensity: 0.85 });
    S.fit(0.6, 13.2, [['RANGE CONTROL', 'Interceptor wing, stand by.', mil({ emotion: 'serious' })], ['RANGE CONTROL', 'Wing Alpha, launch. Launch. Launch.', mil({ emotion: 'urgent' })], ['RANGE CONTROL', 'All birds away. Forty-one in flight.', mil({ emotion: 'afraid' })]]);
  } },
  // ------------------------------------------------------------------ s39a — the interceptors break out of the atmosphere and reach the fleet
  { id: 's39a_interceptors_orbit', dur: 24, cutIn: true, build(S) {
    const sp = space(S, { lat: 31, lon: -102, sunFront: 0.35, sunSide: 0.9 }); const fx = S.fx; const SK = createStreaks(S); const beams = sp.beams; const rng = new RNG(3939);
    // local frame over (lat, lon, alt): o(up, east, north) offsets in km
    const fr = (lat, lon, alt = 0) => { const p = sp.at(lat, lon, alt); const up = p.clone().normalize(); const east = new V3(0, 1, 0).cross(up).normalize(); const north = up.clone().cross(east).normalize(); return { p, up, east, north, o: (u, e, n) => p.clone().addScaledVector(up, u).addScaledVector(east, e).addScaledVector(north, n) }; };
    const arr = (v) => v.toArray(); const EXH = { hot: [7, 5.2, 3.4], cool: [0.8, 0.62, 0.5] }; const PLUME = { hot: [6, 2.3, 0.7], cool: [0.7, 0.28, 0.1] };
    // ---- hero capital ships lie level over the planet; the rest of the fleet is instanced, with running-light glares so it reads at any range
    const HS = [{ lat: 34, lon: -96, alt: 560, len: 880, hit: 10.3, nuke: 0.8 }, { lat: 28.6, lon: -103.2, alt: 545, len: 820, hit: 13.6, nuke: 6.5 }, { lat: 37.2, lon: -108.6, alt: 575, len: 760, hit: 14.7, nuke: 6.5 }];
    const heroes = HS.map((h, i) => { const sh = sp.ship(7 + i, h.lat, h.lon, h.alt, h.len); const F = fr(h.lat, h.lon, h.alt); sh.root.up.copy(F.up); sh.root.lookAt(F.p.clone().addScaledVector(F.east, i === 1 ? -1 : 1).addScaledVector(F.north, 0.3)); return { sh, F, h, q0: sh.root.quaternion.clone() }; });
    const list = []; for (let i = 0; i < 45; i++) list.push([22 + (i % 9) * 3.2, -125 + (i * 7) % 50, 500 + (i % 6) * 40, 500 + (i % 5) * 80]); const fleet = sp.fleet(list, 3);
    const FH = [[4, 15.3], [11, 16.0], [19, 16.7], [27, 17.3]]; const fhit = new Map(FH);
    list.forEach((s, i) => SK.glare(sp.at(s[0], s[1], s[2]), { color: [0.6, 2.6, 3.6], px: 0.0065, flicker: 2 + (i % 5), t1: fhit.get(i), near: 60 }));
    heroes.forEach(({ F, h }) => SK.glare(F.p, { color: [0.7, 2.8, 3.8], px: 0.008, flicker: 3, t1: h.hit, near: 60 }));
    const fState = new Map(); S.during(0, 24, (t) => { let dirty = false; for (const [i, th] of FH) { const hid = t >= th + 0.25; if (fState.get(i) !== hid) { fState.set(i, hid); const s = list[i]; const p = sp.at(s[0], s[1], s[2]); fleet.set(i, { x: p.x, y: p.y, z: p.z, yaw: fleet.get(i).yaw, scale: hid ? 0 : (s[3] || 600) / 1000 }); dirty = true; } } if (dirty) fleet.commit(); });
    // ---- interceptors: exhaust streaks with glaring heads; some are burned down by point defence before they arrive
    const icpt = (pts, o) => SK.add(pts, { ...EXH, widthPx: 2.2, worldW: 0.14, tailLen: 110, grow: 2.0, headPx: 0.013, popPx: 0.045, fade: 2.6, ...o });
    const kills = [], strikers = [];
    for (let j = 0; j < 12; j++) { const la = 31.7 + j * 0.12 + rng.range(-0.05, 0.05), lo = -106.6 + j * 0.09 + rng.range(-0.04, 0.04); icpt([sp.at(la, lo, 16), sp.at(la + 0.25, lo + 0.35, 90), sp.at(la + 0.8, lo + 1.4, 230), sp.at(la + 1.6, lo + 3.2, 400), sp.at(la + 2.0, lo + 5.5, 520)], { t0: -3.5 + j * 0.3 + rng.range(0, 0.2), t1: 12.5 + j * 0.2, ease: 'in', worldW: 0.35, tailLen: 170, headPx: 0.015, dieAt: j % 3 ? undefined : 10.6 + j * 0.3 }); }
    const attack = (F, t1s, killAt, dir = 1) => t1s.map((t1, j) => {
      const a = j - (t1s.length - 1) / 2; const k = killAt[j];
      const st = icpt([F.o(-330 - 25 * j, (-240 + 55 * a) * dir, -150 + 40 * a), F.o(-140 - 10 * j, (-90 + 22 * a) * dir, -60 + 15 * a), F.o(-30, (-14 + 3 * a) * dir, -8 + 2 * a), F.o(-0.06, a * 0.12, 0.04 * a)], { t0: t1 - 9.5, t1, ease: 'linear', dieAt: k });
      if (k !== undefined) kills.push({ st, t: k, F }); else strikers.push({ st, F }); return st;
    });
    attack(heroes[0].F, [10.3, 10.55, 10.45, 10.7, 10.6], [undefined, 7.0, undefined, 8.4, 9.4]);
    attack(heroes[1].F, [13.6, 13.8, 13.7, 13.9], [undefined, 11.9, 12.6, undefined], -1);
    attack(heroes[2].F, [14.7, 14.9, 15.0, 14.8], [12.9, undefined, 13.9, undefined]);
    FH.forEach(([i, t], k) => { const s = list[i]; attack(fr(s[0], s[1], s[2]), [t, t + 0.3], [undefined, t - 2.2 - k * 0.3], k % 2 ? 1 : -1); });
    // point-defence fire: killing shots plus misses at everything still closing
    const hullPt = (F) => F.o(rng.range(-0.06, 0.12), rng.range(-0.35, 0.35), rng.range(-0.12, 0.12));
    kills.forEach(({ st, t, F }) => { const to = st.headAt(t); beams.fire({ from: hullPt(F), to, color: 0x8ff8ff, width: 0.006, life: 0.28, delay: t - 0.22, muzzle: 0.05, impact: 0.5 }); beams.fire({ from: hullPt(F), to: to.clone().addScaledVector(F.east, rng.range(-4, 4)), color: 0x8ff8ff, width: 0.005, life: 0.24, delay: t - 0.7, muzzle: 0.04, impact: 0 }); S.sfx(t, 'explosion_far', { volume: 0.4 }); });
    strikers.forEach(({ st, F }) => { for (let b = 0; b < 3; b++) { const tb = st.t1 - 3.8 + b * 1.1 + rng.range(0, 0.4); if (tb < 0.3) continue; const to = st.headAt(tb).addScaledVector(F.north, rng.range(-6, 6)).addScaledVector(F.east, rng.range(-6, 6)); beams.fire({ from: hullPt(F), to, color: 0x8ff8ff, width: 0.005, life: 0.3, delay: tb, muzzle: 0.04, impact: 0 }); } });
    // ---- detonations
    heroes.forEach(({ F, h }, i) => { fx.nuke(F.o(i === 0 ? -0.55 : -0.08, i === 0 ? -0.2 : 0.05, i === 0 ? -0.15 : 0), { size: h.nuke, inSpace: true, t: h.hit }); S.flash(h.hit, i === 0 ? 1.0 : 0.55); S.sfx(h.hit, 'nuke'); });
    S.post(10.3, 11.6, 'exposure', 1.7, 1, 'out');
    FH.forEach(([i, t]) => { const s = list[i]; fx.nuke(sp.at(s[0], s[1], s[2]), { size: 5.5, inSpace: true, t }); S.sfx(t, 'explosion_far'); });
    // ---- crippled ships: lights die, hull fires, knocked nose-down, then falling toward the atmosphere with a growing reentry plume
    const glowMat = (c) => new THREE.SpriteMaterial({ map: streakGlow(), color: new THREE.Color(...c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    heroes.forEach((H, i) => {
      const { sh, F, h } = H; const d = i === 1 ? -1 : 1;
      const fall = SK.add([F.p, F.o(-22, 16 * d, -5), F.o(-130, 64 * d, -26), F.o(-420, 150 * d, -70)], { ...PLUME, t0: h.hit + 0.7, t1: h.hit + 19, ease: 'in', widthPx: 3.6, worldW: 0.6, tailLen: 110, grow: 2.8, headPx: 0.024, alpha: (t) => clamp((t - h.hit - 1.6) / 4.0) });
      H.fall = fall;
      const wounds = [[0.0, -0.5, 0.2, 1.0], [0.4, 0.2, -0.3, 0.7], [-0.3, 0.6, 0.55, 0.55]].map(([x, y, z, s]) => { const w = new THREE.Sprite(glowMat([6, 2.0, 0.5])); w.position.set(x * sh.radius, y * sh.radius, z * sh.length * 0.5); w.userData.s = s * sh.radius * 2.2; w.visible = false; sh.root.add(w); return w; });
      const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
      S.during(0, 24, (t) => {
        const dt_ = t - h.hit; const on = dt_ >= 0;
        sh.setLights(on ? (dt_ < 1.6 ? (Math.sin(dt_ * 37) > 0.2 ? 0.6 : 0.05) * (1 - dt_ / 1.6) + 0.04 : 0.04) : 1); sh.setThrust(on ? 0 : 0.7);
        wounds.forEach((w, k) => { w.visible = on; if (on) w.scale.setScalar(w.userData.s * Math.min(1, dt_ * 2.5) * (0.8 + 0.2 * Math.sin(t * (9 + k * 3) + k))); });
        if (!on) { sh.root.position.copy(F.p); sh.root.quaternion.copy(H.q0); return; }
        fall.headAt(t, sh.root.position).addScaledVector(F.up, -0.25 * Math.min(1, dt_ / 0.8));
        qa.setFromAxisAngle(F.north, (0.1 + 0.85 * Math.pow(Math.min(1, dt_ / 14), 0.8)) * -d); qb.setFromAxisAngle(F.east, 0.25 * Math.sin(dt_ * 0.35) + dt_ * 0.03);
        sh.root.quaternion.copy(qa).multiply(qb).multiply(H.q0);
      });
    });
    FH.forEach(([i, t], k) => { const s = list[i]; const F = fr(s[0], s[1], s[2]); const d = k % 2 ? 1 : -1; SK.add([F.p, F.o(-25, 15 * d, 4), F.o(-140, 60 * d, 20), F.o(-420, 140 * d, 50)], { ...PLUME, t0: t + 0.6, t1: t + 17, ease: 'in', widthPx: 3.4, worldW: 0.5, tailLen: 100, grow: 2.8, headPx: 0.022, alpha: (tt) => clamp((tt - t - 1.2) / 3.5) }); });
    // ---- camera: breakout over the limb -> fleet POV under fire -> the first hit up close -> the wide fleet -> pulling back as they fall
    const H0 = heroes[0].F; const ship0 = () => heroes[0].sh.root.position.toArray();
    S.shot(0, 5.4, { from: { pos: arr(fr(30.5, -104.2).o(58, 0, 0)), look: arr(sp.at(32.3, -105.9, 95)), fov: 50 }, to: { pos: arr(fr(30.6, -104.3).o(60, -6, 4)), look: arr(sp.at(32.9, -105.0, 230)), fov: 48 }, handheld: 0.15 });
    S.shot(5.4, 9.2, { from: { pos: arr(H0.o(0.9, 1.6, 1.2)), look: arr(H0.o(-0.6, -0.9, -0.8)), fov: 42 }, to: { pos: arr(H0.o(0.8, 1.45, 1.05)), look: arr(H0.o(-0.7, -0.95, -0.85)), fov: 40 }, handheld: 0.12 }, 'cut');
    S.shot(9.2, 13.0, { pos: arr(H0.o(1.6, 2.2, 9.5)), look: ship0, fov: 30, handheld: 0.3 }, 'cut');
    // wide shots are side-on at fleet altitude: falling ships cross the frame toward the limb instead of foreshortening away
    S.shot(13.0, 17.6, { from: { pos: arr(fr(31.5, -118.5).o(520, 0, 0)), look: arr(fr(32.5, -102.5).o(440, 0, 0)), fov: 44 }, to: { pos: arr(fr(31.5, -118.8).o(522, 0, 0)), look: arr(fr(32.5, -102.0).o(430, 0, 0)), fov: 43 }, handheld: 0.08 }, 'cut');
    S.shot(17.6, 24, { from: { pos: arr(fr(18.5, -98.5).o(500, 0, 0)), look: arr(fr(31, -99).o(420, 0, 0)), fov: 42 }, to: { pos: arr(fr(17.5, -98.5).o(520, 0, 0)), look: arr(fr(31, -99).o(380, 0, 0)), fov: 47 } }, 'cut');
    mood(S, { music: 'nuclear', amb: 'space', level: 0.35, intensity: 0.9 }); S.stamp(0.5, 'DAY 7 — MARCH 22, 2050 — 01:19 UTC', 'LOW EARTH ORBIT', 4.5);
    S.fit(0.6, 5.2, [['INTERCEPTOR WING', 'Alpha group is through the atmosphere. Terminal phase.', mil({ emotion: 'serious' })]]);
    S.say(5.5, 'INTERCEPTOR WING', 'Point defence! Losing birds!', mil({ dur: 2.2, emotion: 'urgent' }));
    S.say(7.8, 'INTERCEPTOR WING', 'Detonation in three. Two. One.', mil({ dur: 2.7, emotion: 'urgent' }));
    S.fit(10.9, 17.4, [['INTERCEPTOR WING', 'Direct hit! Direct hit!', mil({ emotion: 'excited' })], ['INTERCEPTOR WING', 'Multiple detonations. Capital ships venting.', mil({ emotion: 'shocked' })]]);
    S.fit(17.8, 23.5, [['INTERCEPTOR WING', "They're falling!", mil({ emotion: 'excited' })], ['INTERCEPTOR WING', 'Not all of them. The rest are holding.', mil({ emotion: 'afraid' })]]);
  } },
  // ------------------------------------------------------------------ s39b — the ground war notices
  { id: 's39b_ground_reaction', dur: 16, cutIn: true, build(S) {
    const b = battle(S, { style: 'dumaguete', sky: 'night', night: 0.9, damage: 0.5, soldiers: 60, crawlers: 160, pods: 60, vessari: 50, tripods: 2, horde: 14, cams: false, humansDie: 0.3, aliensDie: 0.5, hz: 55, az0: -80 }); const fx = S.fx; const x = b.lane.x;
    for (let i = 0; i < 5; i++) fx.reentry([x - 300 + i * 160, 900, -900], [x - 200 + i * 120, 120, -420], { life: 5, size: 22, trailTime: 3, t: 3 + i * 0.9 });
    S.flash(1.8, 1.2); S.post(1.8, 6, 'exposure', 2.2, 1, 'out'); S.during(2.0, 16, (t) => { b.tripods.forEach((tr, i) => { tr.setCannon && tr.setCannon(0); }); });
    S.shot(0, 5, { from: { pos: [x - 3, 1.7, b.lane.hz + 10], look: [x, 6, b.lane.hz - 60], fov: 30 }, to: { pos: [x - 2, 1.9, b.lane.hz + 8], look: [x, 14, b.lane.hz - 60], fov: 30 }, handheld: 0.8 }); S.shot(5, 11, { pos: [x + 2, 1.5, b.lane.hz - 20], look: [x - 10, 140, b.lane.hz - 300], fov: 62, handheld: 0.6, push: 2 }, 'cut'); S.shot(11, 16, { from: { pos: [x, 3, b.lane.hz + 6], look: [x, 3, b.lane.hz - 60], fov: 40 }, to: { pos: [x, 3, b.lane.hz + 2], look: [x, 30, b.lane.hz - 80], fov: 44 }, handheld: 0.7 }, 'cut');
    mood(S, { music: 'tension_high', amb: 'war_near', level: 0.5, intensity: 0.8 }); S.stamp(0.5, 'DAY 7 — MARCH 22, 2050 — 09:20 PHT', 'DUMAGUETE — THE FRONT', 4); S.sfx(2.2, 'explosion_far'); S.sfx(5, 'thunder');
    S.fit(0.8, 15.0, [['SERGEANT', 'Look at the sky!', mil({ emotion: 'shocked' })], ['SOLDIER', 'They hit them! They hit the ships!', mil({ emotion: 'excited' })], ['SERGEANT', "They're falling.", mil({ emotion: 'awe' })], ['SOLDIER', "...the rest aren't leaving.", mil({ emotion: 'afraid' })]]); S.title(13.0, 'ACT IV', 'WHAT THE DEAD LEFT US', 3.2, { size: 5 });
  } },
];
