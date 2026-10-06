// ACT I — NORMAL LIFE → THE SIGNAL (0:00–5:00). Introduces the nine friends, the "comets", the reveal and the arrival.
import * as THREE from 'three';
import * as K from './kit.js';
import * as SC from './screens.js';
import { space, R_E } from './space.js';
import { mover, cnt } from './battle.js';
import { createOcean } from '../world/ocean.js';
import { createCrowd } from '../models/crowd.js';
import { createFleet } from '../models/alientech/index.js';
import * as Veh from '../models/vehicles.js';
const { person, extra, at, A, cover, indoors, place, nameCard, mood, COL, Life, Inst, City, safe, V3 } = K;

/** near an anchor: world [x,y,z] offset */
const nr = (set, name, dx = 0, dz = 0) => { const a = A(set, name); return [a.p[0] + dx, a.p[1], a.p[2] + dz]; };
const wide = (S, set, t0, t1, anchor = 'camWide', look = [0, 1.2, 0]) => { const a = A(set, anchor); S.shot(t0, t1, { pos: a.p, look: [look[0] + (set.root ? set.root.position.x : 0), look[1], look[2] + (set.root ? set.root.position.z : 0)], fov: 40, handheld: 0.3 }); };
/** one cut per spoken line, framed on the speaker facing +Z (used for phone/holo-call montage rooms) */
const frontShots = (S, t0, t1, o = {}) => { const lines = S.lines.filter((l) => l.actor && l.t0 >= t0 && l.t0 < t1); lines.forEach((L, i) => { const start = i === 0 ? t0 : L.t0 - 0.05, end = lines[i + 1] ? lines[i + 1].t0 - 0.05 : t1; const a = L.actor; S.shot(start, end, { pos: () => { const h = a.headPos(new V3()); return [h.x + (o.side ?? 0.22), h.y - 0.04, h.z + (o.dist ?? 2.0)]; }, look: () => { const h = a.headPos(new V3()); return [h.x, h.y - 0.05, h.z]; }, fov: o.fov || 30, handheld: 0.4, push: 0.18, seed: i }); }); };

export const ACT1 = [
  // ------------------------------------------------------------------ s01 — cold open from orbit
  { id: 's01_space_open', dur: 18, cutIn: true, fadeIn: 1.6, build(S) {
    const sp = space(S, { lat: 12, lon: 123, sunFront: 0.7, sunSide: 0.7 }); const p0 = sp.at(12, 123, 0).toArray();
    S.shot(0, 18, { from: { pos: sp.cam(6, 118, R_E * 2.7, 700, 2400), look: [0, 0, 0], fov: 34 }, to: { pos: sp.cam(13, 122, R_E * 1.5, 900, 700), look: [p0[0] * 0.5, p0[1] * 0.5, p0[2] * 0.5], fov: 32 }, ease: 'inOut', handheld: 0.05 });
    mood(S, { music: 'title', amb: 'space', level: 0.5, intensity: 0.35, fade: 3 });
    S.title(4.6, 'ALIEN OUTVASION', '', 8, { big: true, size: 7.5, fadeIn: 2, fadeOut: 2 });
    S.fit(9.5, 17.0, [['ISS COMMANDER', 'Station to Houston. All systems green. Beautiful morning down there.', { style: 'radio', color: COL.radio, dur: 4.2 }], ['HOUSTON', 'Copy, Station. Enjoy the view.', { style: 'radio', color: COL.radio, dur: 2.2 }]]);
  } },
  // ------------------------------------------------------------------ s02 — dawn over Dumaguete
  { id: 's02_dgt_dawn', dur: 14, cutIn: true, build(S) {
    K.skyFor(S, 'dawn', { elev: 7, az: 100 }); const lm = City.createLandmark('dumaguete_blvd', {}); S.scene.add(lm); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() });
    S.add(createOcean({ size: 6000, seaLevel: lm.userData.info.waterLevel })); S.sky.update(0, 0);
    for (let i = 0; i < 2; i++) { const j = safe('jeepney', () => Veh.createJeepney({ seed: 3 + i, name: i ? 'DUMAGUETE-BACOLOD' : 'BLESSED MOTHER' })); if (j) { const e = S.entity(j); e.path(0, 16, [[-110 + i * 70, 0, 1.4 + i * 2.6], [100 + i * 70, 0, 1.4 + i * 2.6]], { ease: 'linear' }); } }
    const n = cnt(26); const c = createCrowd('civilian', n, { seed: 2 }); S.add(c); mover(S, c, n, { from: [-70, -4.6], to: [70, -4.2], spread: [30, 1.4], toSpread: [30, 1.4], speed: 1.3, nominal: 1.4, state: 'walk', arrive: 'idle', seed: 4, delaySpread: 3 });
    S.shot(0, 7, { from: { pos: [-98, 24, -36], look: [10, 4, 0], fov: 46 }, to: { pos: [-42, 12, -15], look: [24, 3, 0], fov: 42 } });
    S.shot(7, 14, { from: { pos: [-42, 2.5, -2.2], look: [40, 3, 2], fov: 42 }, to: { pos: [-12, 2.3, -1.7], look: [40, 3, 2], fov: 42 }, handheld: 0.3 });
    S.stamp(0.8, 'MARCH 14, 2050 — 06:12 PHT', 'DUMAGUETE CITY, NEGROS ORIENTAL, PHILIPPINES', 5.5);
    mood(S, { music: 'calm', amb: 'tropical_day', level: 0.55, intensity: 0.4 });
    S.fit(3.2, 13.0, [['RADIO DJ', 'Good morning, Negros Oriental! Six-twelve, twenty-nine degrees, and the jeepneys are already honking!', { style: 'radio', color: COL.radio }]]);
  } },
  // ------------------------------------------------------------------ s03 — Mirrah, the morgue
  { id: 's03_morgue', dur: 22, build(S) {
    const set = place(S, Life.createMorgue()); indoors(S); S.scene.background = new THREE.Color(0x070c0c);
    const mir = person(S, 'mirrah'); at(mir, set, 'mirrahTableA', 'autopsy');
    const tito = extra(S, 'technician', 3, { name: 'Tito', color: COL.npc }); at(tito, set, 'sinks', 'clean_glass'); tito.faceTo(0, mir);
    nameCard(S, 1.2, 'mirrah', 4); mood(S, { music: 'calm', amb: 'morgue', level: 0.45, intensity: 0.3 });
    S.sfx(10.3, 'phone_vibrate');
    S.fit(1.0, 21.0, [[tito, 'Doc Mirrah! Six a.m. and already elbow-deep? Even the dead are still sleeping.', { emotion: 'happy' }], [mir, "The dead don't have meetings, Tito. I do.", { emotion: 'smirk' }], [tito, 'Ay, so serious. Did you even eat breakfast?'], [mir, "Jez texted. 'Lunch is coming. Do not skip again.'", { emotion: 'neutral' }], [mir, "She wouldn't dare tell Mama.", { emotion: 'smirk' }], [tito, 'She would.', { emotion: 'happy' }]]);
    cover(S, set, 0, 22);
  } },
  // ------------------------------------------------------------------ s04 — Jez, the bookstore
  { id: 's04_mall_jez', dur: 17, build(S) {
    const set = place(S, Life.createMallInterior()); indoors(S, { intensity: 1.1 });
    const jez = person(S, 'jez'); const mia = extra(S, 'civilian', 8, { name: 'Ate Mia', npc: { gender: 'F', ethnicity: 'filipino' } });
    const pj = nr(set, 'shop1', -0.6, 1.5), pm = nr(set, 'shop1', 0.9, 0.5); jez.place(0, pj, 0.5, 'idle'); mia.place(0, pm, -2.2, 'idle');
    nameCard(S, 1.2, 'jez', 4); mood(S, { music: 'everyday', amb: 'mall', level: 0.4, intensity: 0.35 });
    S.fit(1.0, 11.8, [[mia, "Ma'am Jez! Your Magellan book came!", { emotion: 'happy' }], [jez, 'First edition?', { emotion: 'happy' }], [mia, 'First edition. A little loved.'], [jez, 'Loved books are the honest ones.', { emotion: 'smirk' }]]);
    S.fit(11.9, 16.4, [[jez, 'Gotta run. Mirrah forgets to eat on body days.', { emotion: 'worried' }]]);
    jez.go(12.0, [nr(set, 'entrance', 3, 0)], { speed: 2.9 }); mia.act(12.0, 'wave');
    cover(S, set, 0, 12); S.shot(12, 17, { follow: jez, offset: [-2.2, 1.7, 3.6], look: [0, 1.2, 0], fov: 38, handheld: 0.6 });
  } },
  // ------------------------------------------------------------------ s05 — Ezra & Sam, Robinsons
  { id: 's05_robinsons', dur: 24, build(S) {
    const set = place(S, Life.createFoodCourtMcD()); indoors(S, { intensity: 1.0 });
    const ez = person(S, 'ezra'); const sam = person(S, 'sam'); at(ez, set, 'pos1', 'work_counter'); at(sam, set, 'customer1', 'idle');
    nameCard(S, 1.0, 'ezra', 3.2); nameCard(S, 4.6, 'sam', 3.4); mood(S, { music: 'everyday', amb: 'mall', level: 0.35, intensity: 0.35 });
    S.fit(0.8, 23.0, [[ez, "Welcome to McDonald's, may I take your—oh. It's just you.", { emotion: 'smirk' }], [sam, "Kuya Ezra, don't be rude to a paying customer.", { emotion: 'happy' }], [ez, 'Paying? You paid once. In twenty forty-eight.', { emotion: 'happy' }], [sam, 'Big Mac, large fries, and a McFlurry.'], ['NEWS TV', 'Astronomers report a comet cluster approaching Earth.', { style: 'radio', color: COL.news }], [ez, 'Comets? I hope they hit Monday.', { emotion: 'happy' }], [sam, 'Eat first. Panic later.', { emotion: 'smirk' }]]);
    cover(S, set, 0, 24);
  } },
  // ------------------------------------------------------------------ s06 — Leon's bar
  { id: 's06_bar_leon', dur: 15, build(S) {
    const set = place(S, Life.createBar()); indoors(S, { intensity: 0.7 });
    const leon = person(S, 'leon'); const bong = extra(S, 'elder', 12, { name: 'Kuya Bong', npc: { gender: 'M', ethnicity: 'filipino' } });
    at(leon, set, 'leon', 'clean_glass'); at(bong, set, 'stool1', 'sit'); leon.faceTo(0, bong);
    nameCard(S, 0.9, 'leon', 3.6); mood(S, { music: 'everyday', amb: 'bar', level: 0.35, intensity: 0.3 });
    S.fit(0.8, 14.1, [[bong, "Leon, you're early. Your bar isn't even awake.", { emotion: 'happy' }], [leon, 'Neither am I, Kuya Bong.', { emotion: 'tired' }], [bong, 'Is that a shotgun under the counter?', { emotion: 'worried' }], [leon, 'Decor. Illegal decor. Drink your coffee.', { emotion: 'smirk' }]]);
    cover(S, set, 0, 15);
  } },
  // ------------------------------------------------------------------ s07 — Jhaz & Epiphany, Cebu terminal
  { id: 's07_cebu_terminal', dur: 19, build(S) {
    K.skyFor(S, 'day', { elev: 38, az: 60 }); const set = place(S, Life.createJeepneyTerminal());
    const jhaz = person(S, 'jhaz'); const epi = person(S, 'epiphany'); const jp = nr(set, 'bay1', 2.2, 1.2);
    jhaz.place(0, jp, -1.5, 'idle'); epi.place(0, [jp[0] - 2.8, jp[1], jp[2] + 0.4], 1.57, 'idle'); epi.hold('folder'); epi.go(0.4, [[jp[0] - 0.9, jp[2] + 0.4]], { speed: 1.3 });
    const j = safe('jeepney', () => Veh.createJeepney({ seed: 11, name: 'CEBU-LAPU-LAPU' })); if (j) { const e = S.entity(j); const a = A(set, 'bay1'); e.at(0, [a.p[0], a.p[1], a.p[2]], a.yaw); }
    nameCard(S, 0.9, 'jhaz', 3.2); nameCard(S, 4.4, 'epiphany', 3.6); mood(S, { music: 'everyday', amb: 'city_day', level: 0.4, intensity: 0.35 });
    S.fit(1.0, 18.2, [[jhaz, "You're late, counselor. Breakfast is waiting.", { emotion: 'smirk' }], [epi, 'I object. Traffic.', { emotion: 'smirk' }], [jhaz, 'Overruled.'], [epi, 'I just beat a landlord twice my height.', { emotion: 'happy' }], [jhaz, 'Everyone is twice your height, Piphy.', { emotion: 'happy' }], [epi, 'Also, Bead texted. Group call tonight.']]);
    cover(S, set, 0, 19);
  } },
  // ------------------------------------------------------------------ s08 — Stephen, California
  { id: 's08_cali_mcd', dur: 15, build(S) {
    K.skyFor(S, 'day', { elev: 45, az: 200 }); const set = place(S, Life.createMcDCalifornia()); indoors(S, { intensity: 0.8 });
    const st = person(S, 'stephen'); const karen = extra(S, 'civilian', 21, { name: 'Karen', npc: { gender: 'F', ethnicity: 'caucasian' } }); const dale = extra(S, 'worker', 22, { name: 'Dale', npc: { gender: 'M', ethnicity: 'caucasian' } });
    at(st, set, 'pos1', 'work_counter'); at(karen, set, 'customer1', 'idle_hands_hips'); at(dale, set, 'prep', 'idle_arms_crossed');
    nameCard(S, 0.9, 'stephen', 3.4); mood(S, { music: 'everyday', amb: 'mall', level: 0.3, intensity: 0.3 }); S.sfx(10.2, 'phone_vibrate');
    S.fit(0.8, 14.1, [[karen, 'I asked for no pickles.', { emotion: 'angry' }], [st, "Ma'am, I'm holding the pickle bin and I'm sorry.", { emotion: 'worried' }], [dale, 'Stephen! Drive-thru!', { emotion: 'urgent' }], [st, 'Six more hours.', { emotion: 'tired' }], [st, 'Group call. I have a reason to live.', { emotion: 'happy' }]]);
    cover(S, set, 0, 15);
  } },
  // ------------------------------------------------------------------ s09 — Bead's sanctuary
  { id: 's09_georgia_bead', dur: 22, build(S) {
    const set = place(S, Life.createSanctuary()); set.setMode && set.setMode('interior'); indoors(S, { intensity: 0.9 });
    const bead = person(S, 'bead'); const nodar = extra(S, 'technician', 31, { name: 'Nodar', npc: { gender: 'M', ethnicity: 'caucasian' } });
    at(bead, set, 'bead_desk', 'idle'); const bp = A(set, 'bead_desk').p; nodar.place(0, [bp[0] + 2.2, bp[1], bp[2] + 1.0], -2.2, 'idle_arms_crossed');
    const bots = []; for (let i = 0; i < 3; i++) { const b = safe('eenbot', () => Veh.createEenbot({})); if (b) { const e = S.entity(b); e.at(0, [bp[0] - 4 + i * 1.1, bp[1], bp[2] + 4], 0.2); bots.push(b); } }
    nameCard(S, 0.9, 'bead', 4); mood(S, { music: 'curious', amb: 'interior_hum', level: 0.3, intensity: 0.35 });
    S.fit(1.0, 21.0, [[bead, 'Нодар, подготовь вертолёт к двадцатому. Летим на Филиппины.', { lang: 'ru-RU', sub: 'Nodar, prepare the helicopter for the twentieth. We fly to the Philippines.', emotion: 'neutral', visemeText: 'nodar podgotov vertolyot k dvadtsatomu letim na filippiny' }], [nodar, 'Да, сэр. Все готово.', { lang: 'ru-RU', sub: 'Yes, sir. Everything is ready.', visemeText: 'da ser vse gotovo' }], ['ZIA', 'The group call starts in four minutes. Also, your heart rate says you skipped lunch.', { style: 'ai', color: COL.ai }], [bead, 'Everyone has a mother living in my ear.', { emotion: 'happy' }], ['ZIA', 'Surprise scheduled. I will pretend I do not know.', { style: 'ai', color: COL.ai }]]);
    S.cover(0, 22, { bounds: { min: [-26, -99.4, -26], max: [26, -86, 26] } });
  } },
  // ------------------------------------------------------------------ s10 — the group call (nine friends, nine rooms)
  { id: 's10_group_call', dur: 42, build(S) {
    S.scene.background = new THREE.Color(0x05070c); S.scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x202030, 1.2)); const key = new THREE.DirectionalLight(0xfff0e0, 2.4); key.position.set(0, 4, 6); S.scene.add(key);
    const order = ['ezra', 'bead', 'jez', 'mirrah', 'stephen', 'jhaz', 'epiphany', 'leon', 'sam']; const backs = { ezra: ['#7a1020', 'ROBINSONS · DUMAGUETE'], bead: ['#2a0f55', 'GEORGIA · SANCTUARY'], jez: ['#12485a', 'CITY MALL · DUMAGUETE'], mirrah: ['#0f4c47', 'MORGUE · DUMAGUETE'], stephen: ['#7a5a10', 'CALIFORNIA, USA'], jhaz: ['#123d78', 'CEBU TERMINAL'], epiphany: ['#4a3d12', 'CEBU CITY'], leon: ['#5a2a0a', "LEON'S BAR"], sam: ['#6a2a12', 'ROBINSONS · DUMAGUETE'] };
    const A9 = {}; order.forEach((k, i) => { const a = person(S, k); const x = i * 7; a.place(0, [x, 0, 0], 0, k === 'bead' ? 'idle_phone' : 'idle'); a.hold('phone'); A9[k] = a; a.autoLook = false; a.gaze(new V3(x, 1.5, 6));
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288; const c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 288); g.addColorStop(0, backs[k][0]); g.addColorStop(1, '#05070c'); c.fillStyle = g; c.fillRect(0, 0, 512, 288); c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '700 22px sans-serif'; c.fillText(backs[k][1], 24, 262); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.15), new THREE.MeshBasicMaterial({ map: tx })); p.position.set(x, 1.5, -1.8); S.scene.add(p); const fl = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.position.set(x, -0.01, 0); S.scene.add(fl); });
    S.callFrame(0.5, 41, 'GROUP CALL — 9 CONNECTED', '#7fe9ff'); mood(S, { music: 'curious', amb: 'silence', intensity: 0.3 }); S.sfx(0.3, 'comm_open');
    S.fit(0.6, 41.0, [[A9.ezra, "Is everyone here? Bead, your eye's doing the glowy thing again.", { emotion: 'happy' }], [A9.bead, "It's a holographic interface.", { emotion: 'smirk' }], [A9.ezra, "It's showing off.", { emotion: 'happy' }], [A9.jez, 'Mirrah. Are you eating?', { emotion: 'worried' }], [A9.mirrah, '...Yes.', { emotion: 'tired' }], [A9.jez, "She's lying.", { emotion: 'smirk' }], [A9.epiphany, "Agenda item one: Leon's bar, the twentieth.", { emotion: 'serious' }], [A9.mirrah, "Hi, Epiphany. We've met. Twice.", { emotion: 'neutral' }], [A9.epiphany, 'At Jez\'s birthday. You corrected my grammar.', { emotion: 'smirk' }], [A9.leon, "First round's free. Second round's Bead's.", { emotion: 'happy' }], [A9.bead, "I'm paying for everything. Flights too. Don't argue.", { emotion: 'happy' }], [A9.sam, "Even mine? I don't fit in those seats.", { emotion: 'worried' }], [A9.bead, 'I bought two.', { emotion: 'smirk' }], [A9.ezra, 'Guys... turn on the news.', { emotion: 'worried' }]]);
    frontShots(S, 0, 42, { dist: 2.1 });
  } },
  // ------------------------------------------------------------------ s11 — news: the comets
  { id: 's11_news_comets', dur: 24, build(S) {
    const set = place(S, Inst.createNewsStudio()); indoors(S, { intensity: 0.8 }); K.news(S, set, 'wall', SC.cometMap('COMET CLUSTER — UNRESOLVED', 412), 12);
    const an = extra(S, 'anchor', 41, { name: 'Marisol Vega', color: COL.news, npc: { gender: 'F', ethnicity: 'caucasian' } }); const dr = extra(S, 'scientist', 42, { name: 'Dr. Priya Raman', color: COL.sci, npc: { gender: 'F', ethnicity: 'south_asian' } });
    at(an, set, 'anchorL', 'idle'); at(dr, set, 'guest', 'idle'); S.tag(0.5, 23, 'LIVE', { color: 'live' }); mood(S, { music: 'news', amb: 'interior_hum', level: 0.2, intensity: 0.4 }); S.sfx(0.3, 'news_sting');
    S.fit(0.8, 23.0, [[an, 'Breaking: observatories worldwide are tracking hundreds of comets approaching Earth — in formation.', { emotion: 'serious' }], [dr, "We've never seen comets travel together. Their trajectories are strangely synchronised.", { emotion: 'worried' }], [an, 'Is there any danger to Earth?', { emotion: 'serious' }], [dr, "We can't resolve them. Our satellites keep losing focus. And they're slowing down.", { emotion: 'worried' }], [an, "Slowing down? Comets don't—", { emotion: 'shocked' }], [dr, 'No. They do not.', { emotion: 'afraid' }]]);
    cover(S, set, 0, 24);
  } },
  // ------------------------------------------------------------------ s12 — the world prepares (montage of four places)
  { id: 's12_prepare_montage', dur: 24, build(S) {
    const mall = place(S, Life.createMallInterior(), [0, 0, 0]); const bar = place(S, Life.createBar(), [1000, 0, 0]); const morgue = place(S, Life.createMorgue(), [2000, 0, 0]); indoors(S, { intensity: 1.0 });
    const n = cnt(70); const crowd = createCrowd('civilian', n, { seed: 6 }); S.add(crowd); mover(S, crowd, n, { from: [-8, 6], to: [10, -4], spread: [26, 14], toSpread: [20, 16], speed: 2.8, nominal: 1.4, state: 'walk', arrive: 'run', seed: 9, delaySpread: 2 });
    const leon = person(S, 'leon'); at(leon, bar, 'leon', 'pour_drink'); const mir = person(S, 'mirrah'); at(mir, morgue, 'mirrahTableA', 'examine'); const tito = extra(S, 'technician', 3, { name: 'Tito' }); at(tito, morgue, 'desk', 'idle_arms_crossed');
    const ez = person(S, 'ezra'); const sam = person(S, 'sam'); const jp = nr(mall, 'kiosk1', 0, 3); ez.place(0, jp, 0.4, 'idle'); sam.place(0, [jp[0] + 1.3, jp[1], jp[2]], -0.4, 'idle'); ez.hold('burgerbag');
    mood(S, { music: 'unease', amb: 'crowd', level: 0.35, intensity: 0.45 });
    S.shot(0, 6, { from: { pos: [-20, 4.5, 12], look: [0, 1.2, 0], fov: 42 }, to: { pos: [-14, 3.4, 8], look: [2, 1.2, 0], fov: 38 }, handheld: 0.6 }); S.shot(6, 12, { pos: [jp[0] - 1.2, 1.5, jp[2] + 2.8], look: [jp[0] + 0.5, 1.4, jp[2]], fov: 34, handheld: 0.4, push: 0.4 }, 'dip');
    S.shot(12, 18, { pos: [A(bar, 'camWide').p[0], A(bar, 'camWide').p[1], A(bar, 'camWide').p[2]], look: [1000, 1.2, 0], fov: 40, handheld: 0.3 }, 'dip'); S.shot(18, 24, { pos: A(morgue, 'camWide').p, look: [2000, 1.2, 0], fov: 40, handheld: 0.3 }, 'dip');
    S.say(1.0, 'SHOPPER', "That's the last of the sardines!", { color: COL.npc, dur: 2.2 }); S.say(3.6, 'LOUDSPEAKER', 'Residents are advised to prepare for a possible meteor shower event.', { style: 'radio', color: COL.radio, dur: 4.2 });
    S.say(7.0, ez, "If it's the end of the world, I want my fries hot.", { dur: 3.4, emotion: 'worried' }); S.say(10.6, sam, 'Eat first. Panic later.', { dur: 1.8, emotion: 'smirk' });
    S.say(12.8, leon, 'Free drinks if the world ends! With proof!', { dur: 3.4, emotion: 'happy' }); S.say(19.0, mir, "Statistically, it's a meteor shower.", { dur: 2.6, emotion: 'serious' }); S.say(21.8, tito, 'Statistically, I still want to go home.', { dur: 2.4, emotion: 'worried' });
    S.stamp(0.6, 'MARCH 14, 2050 — 19:40 PHT', 'T-MINUS UNKNOWN', 4);
  } },
  // ------------------------------------------------------------------ s13 — the reveal
  { id: 's13_reveal', dur: 22, build(S) {
    const set = place(S, Inst.createMissionControl()); indoors(S, { intensity: 0.8 }); K.news(S, set, 'main', SC.hullImage, 15); K.news(S, set, 'left', SC.cometMap('TRACKING', 412), 10); K.news(S, set, 'right', SC.radar, 15);
    const raman = extra(S, 'scientist', 42, { name: 'Dr. Raman', color: COL.sci, npc: { gender: 'F', ethnicity: 'south_asian' } }); const t1 = extra(S, 'technician', 51, { name: 'Technician' }); const t2 = extra(S, 'technician', 52, { name: 'Controller' });
    at(raman, set, 'flightDirector', 'idle'); at(t1, set, 'console3', 'typing'); at(t2, set, 'console5', 'typing'); mood(S, { music: 'dread', amb: 'interior_hum', level: 0.25, intensity: 0.5 });
    S.fit(0.6, 17.8, [[t1, 'EEN-Sat Seven. High-resolution pass in ten seconds.', { emotion: 'serious' }], [raman, 'Resolving... that cannot be right.', { emotion: 'afraid' }], [t2, 'Those are structures. Those are hulls.', { emotion: 'afraid' }], [raman, 'They are not comets. They are ships.', { emotion: 'shocked' }], ['ZIA', 'Bead. Four hundred and twelve vessels. Decelerating in formation.', { style: 'ai', color: COL.ai }]]);
    S.say(17.9, 'NEWS ANCHOR', 'We interrupt this broadcast. The objects approaching Earth are not comets.', { style: 'radio', color: COL.news, dur: 3.6 });
    S.title(17.4, 'THESE ARE NOT COMETS', '', 4, { big: true, size: 5, fadeIn: 0.3 }); S.sfx(17.3, 'impact'); S.music(17.3, 'dread', { intensity: 0.9 }); cover(S, set, 0, 22);
  } },
  // ------------------------------------------------------------------ s14a — the fleet arrives (orbit)
  { id: 's14a_fleet_arrival', dur: 18, build(S) {
    const sp = space(S, { lat: 14, lon: 121, sunFront: 0.8, sunSide: 0.5, moon: [-120000, 20000, 260000] }); const hero = sp.ship(7, 14, 121, 520, 900); sp.ship(8, 22, 140, 540, 760); sp.ship(9, 6, 100, 560, 820);
    const list = []; for (let i = 0; i < 70; i++) list.push([5 + (i % 10) * 3.2, 95 + (i * 7) % 60, 430 + (i % 7) * 40, 500 + (i % 5) * 80]); sp.fleet(list, 5);
    const hp = hero.root.position.clone(); const n = hp.clone().normalize();
    S.shot(0, 7, { from: { pos: sp.cam(14, 121, R_E * 1.5 + 60, 12, 6), look: hp.toArray(), fov: 30 }, to: { pos: sp.cam(14, 121, R_E + 700, 3, 1), look: hp.toArray(), fov: 30 }, handheld: 0.1 }); S.shot(7, 13, { from: { pos: [hp.x + 3, hp.y + 0.6, hp.z + 1.2], look: hp.toArray(), fov: 36 }, to: { pos: [hp.x + 1.1, hp.y + 0.3, hp.z + 0.6], look: hp.toArray(), fov: 36 } }, 'dip');
    S.shot(13, 18, { from: { pos: sp.cam(12, 118, R_E * 1.2, 0, 0), look: [0, 0, 0], fov: 48 }, to: { pos: sp.cam(12, 118, R_E * 2.1, 0, 0), look: [0, 0, 0], fov: 48 } }, 'dip');
    mood(S, { music: 'arrival', amb: 'space', level: 0.6, intensity: 0.7 }); S.on(2, () => S.audio && S.audio.sfx.play('tripod_horn', { gain: 0.5 })); S.fit(8, 17, [['ISS COMMANDER', "They're stopping. All of them. They're all stopping.", { style: 'radio', color: COL.radio, emotion: 'afraid' }], ['HOUSTON', 'Station, say again. Station?', { style: 'radio', color: COL.radio }]]);
    S.stamp(0.8, 'MARCH 15, 2050 — 03:07 UTC', 'LOW EARTH ORBIT', 4);
  } },
  // ------------------------------------------------------------------ s14b — ground: the sky fills with lights
  { id: 's14b_sky_lights', dur: 18, build(S) {
    K.skyFor(S, 'night'); const lm = City.createLandmark('dumaguete_blvd', { night: 1 }); S.scene.add(lm); lm.setNight && lm.setNight(1); S.modules.push({ update: (dt, t) => lm.update && lm.update(dt, t), dispose: () => lm.dispose && lm.dispose() }); S.add(createOcean({ size: 6000, seaLevel: lm.userData.info.waterLevel }));
    const f = createFleet(26); const list = []; for (let i = 0; i < 26; i++) { const a = i * 2.4; f.set(i, { x: -4000 + (i % 9) * 900 + Math.sin(a) * 400, y: 5200 + (i % 4) * 500, z: -4200 - (i % 5) * 700, yaw: a, scale: 760 }); } f.commit(); S.add(f); S.camFar = 30000;
    const n = cnt(40); const c = createCrowd('civilian', n, { seed: 3 }); S.add(c); mover(S, c, n, { from: [-10, -4.5], to: [8, -4], spread: [30, 2], toSpread: [18, 2], speed: 0.4, nominal: 1.4, state: 'walk', arrive: 'idle', seed: 2 }); c.lookAt && c.lookAt(new V3(0, 3000, -3000), 1);
    const jez = person(S, 'jez'); jez.place(0, [4, 0, -3.2], 3.1, 'idle'); jez.gaze(new V3(0, 3000, -4000)); const fx = S.fx; for (let i = 0; i < 6; i++) fx.reentry([-2000 + i * 700, 6000, -7000], [-1500 + i * 600, 3000, -4200], { life: 5, size: 14, trailTime: 3 });
    S.shot(0, 6, { from: { pos: [-20, 1.7, 3], look: [10, 80, -300], fov: 55 }, to: { pos: [-12, 1.7, 2], look: [10, 110, -300], fov: 55 }, handheld: 0.6 }); S.shot(6, 12, { pos: () => { const h = jez.headPos(new V3()); return [h.x + 0.6, h.y - 0.05, h.z + 1.4]; }, look: () => { const h = jez.headPos(new V3()); return [h.x, h.y, h.z]; }, fov: 30, handheld: 0.5, push: 0.2 }, 'cut');
    S.shot(12, 18, { from: { pos: [0, 1.5, 0], look: [0, 200, -900], fov: 60 }, to: { pos: [0, 1.5, 0], look: [0, 600, -900], fov: 60 }, handheld: 0.3 }, 'cut');
    mood(S, { music: 'arrival', amb: 'wind', level: 0.4, intensity: 0.9 }); S.sfx(3, 'tripod_horn', { gain: 0.6 }); S.say(2.0, 'CHILD', 'Mama... what are those lights?', { color: COL.npc, dur: 2.4 }); S.say(8.0, jez, 'Oh no. Mirrah.', { dur: 1.8, emotion: 'afraid' });
    S.title(13.5, 'ACT II', 'TOUCHDOWN', 4, { size: 5 });
  } },
];
