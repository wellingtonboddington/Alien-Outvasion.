// Battle / horde template. All motion is ANALYTIC (pure function of scene time) so scenes are seekable and need no simulation state.
//   const B = battle(S, { style:'manhattan', sky:'smoke', soldiers:90, crawlers:400, pods:140, vessari:60, tripods:2, horde:30, ... });
import * as THREE from 'three';
import { RNG, clamp, lerp, smoothstep, Q, hashStr } from '../engine/common.js';
import { createCrowd } from '../models/crowd.js';
import { createVessariCrowd, createCrawlerSwarm } from '../models/aliens/index.js';
import { createPodSwarm, createBeams, createTripod, createTripodHorde } from '../models/alientech/index.js';
import * as Veh from '../models/vehicles.js';
import { skyFor, City, safe } from './kit.js';

const V3 = THREE.Vector3;
/** scale an agent count with quality (keeps "overwhelming" look on desktop, cheaper on phones) */
export const cnt = (n) => Math.max(3, Math.round(n * (0.5 + 0.5 * Q.crowd)));
const NOMINAL = { soldier: { walk: 1.4, run: 4.2 }, civilian: { walk: 1.3, run: 4.0, panic: 4.5 }, zombie: { run: 5.0, sprint: 7.5, walk: 1.2 }, vessari: { walk: 1.5, run: 5.2 }, crawler: { run: 5.5, scuttle: 2.4 } };

/**
 * A moving group inside a crowd/swarm. o: {from:[x,z], to:[x,z], spread:[w,d], toSpread:[w,d], speed (m/s), speedVar, delay, delaySpread, state:'run', arrive:'fire',
 *   nominal (m/s at anim speed 1), face:[x,z] (arrival facing), die:{from,to,frac,state}, infect:{from,to} (ramp window), seed, y, yaw, sway}
 */
export function mover(S, crowd, n, o) {
  const rng = new RNG(o.seed || hashStr(S.id) + n); const first = crowd.spawnGroup({ n, center: o.from, radius: 2, yawMean: 0, spread: 0.1, state: o.state || 'run', seed: (o.seed || 1) * 13 + n, infect: 0 });
  const sx = new Float32Array(n), sz = new Float32Array(n), tx = new Float32Array(n), tz = new Float32Array(n), sp = new Float32Array(n), t0 = new Float32Array(n), td = new Float32Array(n), ph = new Float32Array(n), ti = new Float32Array(n), fy = new Float32Array(n);
  const [w, d] = o.spread || [10, 10], [tw, td2] = o.toSpread || [w * 0.8, d * 0.6]; const die = o.die || null, inf = o.infect || null;
  for (let i = 0; i < n; i++) {
    sx[i] = o.from[0] + (rng.next() - 0.5) * w; sz[i] = o.from[1] + (rng.next() - 0.5) * d; tx[i] = o.to[0] + (rng.next() - 0.5) * tw; tz[i] = o.to[1] + (rng.next() - 0.5) * td2;
    sp[i] = (o.speed || 4) * (1 + (rng.next() - 0.5) * 2 * (o.speedVar ?? 0.18)); t0[i] = (o.delay || 0) + rng.next() * (o.delaySpread || 0); ph[i] = rng.next() * 3;
    td[i] = die && rng.next() < die.frac ? lerp(die.from, die.to, Math.pow(rng.next(), die.curve || 1)) : 1e9; ti[i] = inf ? lerp(inf.from, inf.to, rng.next()) : 1e9;
    const f = o.face || o.to; fy[i] = Math.atan2(f[0] - tx[i], f[1] - tz[i]);
  }
  const tmp = { x: 0, y: o.y || 0, z: 0, yaw: 0, state: 'run', speed: 1, phase: 0, infect: 0 }; const nominal = o.nominal || 4.5;
  const g = {
    first, n, crowd, sx, sz, tx, tz,
    pos(i, t, out) { const dx = tx[i] - sx[i], dz = tz[i] - sz[i]; const dist = Math.hypot(dx, dz) || 1; const tt = Math.min(t, td[i]); const dd = Math.min(dist, Math.max(0, sp[i] * (tt - t0[i]))); out.x = sx[i] + dx / dist * dd; out.z = sz[i] + dz / dist * dd; out.arrived = dd >= dist - 0.01; out.started = t >= t0[i]; out.yaw = Math.atan2(dx, dz); return out; },
    update(t) {
      const P = { x: 0, z: 0, arrived: false, started: false, yaw: 0 };
      for (let i = 0; i < n; i++) {
        g.pos(i, t, P); const dead = t >= td[i]; tmp.x = P.x; tmp.z = P.z; tmp.y = o.y || 0;
        if (dead) { tmp.state = die.state || 'fall'; tmp.speed = 1; tmp.yaw = P.arrived ? fy[i] : P.yaw; }
        else if (!P.started) { tmp.state = o.idle || o.arrive || 'idle'; tmp.speed = 1; tmp.yaw = P.yaw; }
        else if (P.arrived) { tmp.state = o.arrive || 'idle'; tmp.speed = 1; tmp.yaw = fy[i]; }
        else { tmp.state = o.state || 'run'; tmp.speed = sp[i] / nominal; tmp.yaw = P.yaw; }
        tmp.phase = ph[i]; tmp.infect = inf ? clamp((t - ti[i]) / 1.4) : 0;
        crowd.set(i, tmp);
      }
      crowd.commit();
    },
    /** centroid of living agents at t */
    center(t, out) { out.set(0, 0, 0); const P = { x: 0, z: 0 }; let c = 0; for (let i = 0; i < n; i += 2) { g.pos(i, t, P); out.x += P.x; out.z += P.z; c++; } return out.multiplyScalar(1 / Math.max(1, c)); },
  };
  S.updaters.push({ t0: 0, t1: S.duration + 1, fn: (t) => g.update(t) });
  return g;
}

/**
 * Whole battle scene. Lane runs along Z at x = laneX; humans hold around z = +hz, aliens come from -Z.
 * Returns ctx {block, sky, fx, beams, lane:{x, hz}, groups:{}, pods, tripods:[...]} and registers camera shots covering [0, dur] (unless o.cams === false).
 */
export function battle(S, o = {}) {
  const dur = o.dur || S.duration, seed = o.seed || hashStr(S.id); const rng = new RNG(seed); const ctx = { groups: {}, tripods: [] }; const D = o.tOffset || 0; // D = battle start time inside the scene
  ctx.sky = skyFor(S, o.sky || 'smoke', { smoke: o.smoke ?? (o.sky === 'smoke' || !o.sky ? 0.9 : 0), storm: o.storm || 0, elev: o.elev, az: o.az, shadowRadius: 90 });
  const fx = ctx.fx = S.fx;
  // ---- world
  if (o.terrain) { const T = safe('terrain', () => o.terrain(S)); ctx.terrain = T; }
  if (o.style !== false) {
    ctx.block = City.createCityBlock(o.style || 'manhattan', { seed, damage: o.damage ?? 0.45, night: o.night || 0, cars: true, ...(o.snow ? { snow: o.snow } : {}), ...(o.size ? { w: o.size, d: o.size } : {}) }); S.add(ctx.block);
    const sk = safe('skyline', () => City.createSkyline(o.style || 'manhattan', { radius: 900, haze: 0.5 })); if (sk) S.add(sk);
  }
  const rx = ctx.block && ctx.block.layout && ctx.block.layout.roadsX ? ctx.block.layout.roadsX.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a), 1e9) : 0;
  const L = ctx.lane = { x: o.laneX ?? (Number.isFinite(rx) ? rx : 0), hz: o.hz ?? 52, az: o.az0 ?? -78 };
  { const g = new THREE.Mesh(new THREE.CircleGeometry(1500, 24), new THREE.MeshStandardMaterial({ color: o.groundColor ?? 0x2b2a29, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.y = -0.06; g.receiveShadow = true; S.scene.add(g); }
  if (ctx.block && ctx.block.fireAnchors) { const fa = ctx.block.fireAnchors; const k = Math.min(fa.length, o.smokeCols ?? 5); for (let i = 0; i < k; i++) { const p = fa[Math.floor(i * fa.length / k)]; fx.smokeColumn(p, { height: 90, width: 9, life: dur + 30 }); if (i % 2 === 0) fx.fire(p, { size: 3 }); } }
  const beams = ctx.beams = createBeams({ capacity: Q.level === 0 ? 256 : 640 }); S.add(beams);
  // ---- human side
  const hum = o.humanKind || 'soldier'; const dieH = o.humansDie ?? 0.6;
  if (o.soldiers) { const n = cnt(o.soldiers); const c = createCrowd(hum, n, { seed }); S.add(c);
    ctx.groups.soldiers = mover(S, c, n, { from: [L.x, L.hz + 10], to: [L.x, L.hz], spread: [26, 12], toSpread: [28, 14], speed: 2.4, nominal: 4.2, state: 'run', arrive: o.humansArrive || 'fire', idle: 'aim', face: [L.x, L.az], seed: seed + 1, delay: D, delaySpread: 2, die: { from: D + (dur - D) * 0.18, to: dur * 0.96, frac: dieH, state: 'fall', curve: 1.5 } }); }
  if (o.civilians) { const n = cnt(o.civilians); const c = createCrowd('civilian', n, { seed: seed + 3 }); S.add(c);
    ctx.groups.civilians = mover(S, c, n, { from: [L.x, L.hz - 25], to: [L.x + (rng.next() - 0.5) * 30, L.hz + 140], spread: [24, 30], toSpread: [30, 30], speed: 4.4, nominal: 4.0, state: 'panic', arrive: 'run', seed: seed + 4, delay: 0, delaySpread: 3, die: { from: dur * 0.2, to: dur, frac: 0.12 } }); }
  // ---- alien side
  const aTo = (z) => [L.x, z];
  if (o.crawlers) { const n = cnt(o.crawlers); const c = createCrawlerSwarm(n); S.add(c);
    ctx.groups.crawlers = mover(S, c, n, { from: [L.x, L.az - 20], to: aTo(L.hz - 6), spread: [34, 40], toSpread: [30, 14], speed: o.crawlerSpeed || 5.2, nominal: 5.5, state: 'run', arrive: 'screech', idle: 'idle', face: [L.x, L.hz], seed: seed + 5, delay: D + (o.crawlerDelay ?? 1), delaySpread: 5, die: { from: dur * 0.25, to: dur * 0.98, frac: o.aliensDie ?? 0.4, state: 'dead', curve: 1.2 }, infect: o.alienInfect }); }
  if (o.vessari) { const n = cnt(o.vessari); const c = createVessariCrowd(n); S.add(c);
    ctx.groups.vessari = mover(S, c, n, { from: [L.x, L.az + 10], to: aTo(L.hz - 22), spread: [28, 18], toSpread: [30, 12], speed: 2.2, nominal: 5.2 * 0.7, state: 'walk', arrive: 'fire', idle: 'aim', face: [L.x, L.hz], seed: seed + 6, delay: D + 2, delaySpread: 4, nominal: 1.5, die: { from: dur * 0.3, to: dur * 0.98, frac: o.aliensDie ?? 0.3, state: 'fall', curve: 1.3 }, infect: o.alienInfect }); }
  for (const [zi, z] of (o.zombies || []).entries()) { const n = cnt(z.n); const c = createCrowd(z.kind, n, { seed: seed + 20 + zi }); S.add(c);
    ctx.groups['z' + zi] = mover(S, c, n, { from: z.from || [L.x, L.az + 60], to: z.to || [L.x, L.hz - 30], spread: z.spread || [34, 30], toSpread: z.toSpread || [30, 18], speed: z.speed || 6.2, nominal: z.nominal || 5.0, state: z.state || 'sprint', arrive: z.arrive || 'lunge', face: z.face || [L.x, L.az], seed: seed + 30 + zi, delay: D + (z.delay ?? 3), delaySpread: z.delaySpread ?? 5, die: z.die, infect: z.infect }); }
  if (o.pods) { const n = cnt(o.pods); const pods = ctx.pods = createPodSwarm(n); S.add(pods); const pr = new RNG(seed + 7);
    const pd = Array.from({ length: n }, () => ({ x: L.x + (pr.next() - 0.5) * 120, y: 16 + pr.next() * 40, z0: L.az + pr.next() * 260, v: 5 + pr.next() * 8, ph: pr.next(), dive: pr.next() < 0.12, dead: pr.next() < (o.podsDie ?? 0.15) ? lerp(dur * 0.3, dur, pr.next()) : 1e9, rollK: (pr.next() - 0.5) }));
    const tmp = { x: 0, y: 0, z: 0, yaw: Math.PI, pitch: 0, roll: 0, state: 'hover', phase: 0, infect: 0 }; ctx.podPos = (i, t, out) => { const p = pd[i]; const span = 340; const z = L.az - 40 + ((p.z0 - L.az + 40 + p.v * t) % span + span) % span; return out.set(p.x + Math.sin(t * 0.2 + p.ph * 6) * 6, p.y + Math.sin(t * 0.9 + p.ph * 9) * 1.2, z); };
    const tv = new V3(); S.updaters.push({ t0: 0, t1: dur + 1, fn: (t) => { for (let i = 0; i < n; i++) { ctx.podPos(i, t, tv); const p = pd[i]; tmp.x = tv.x; tmp.y = tv.y; tmp.z = tv.z; tmp.yaw = 0; tmp.pitch = -0.1; tmp.roll = p.rollK * 0.3; tmp.state = t > p.dead ? 'dead' : (p.dive && Math.sin(t * 0.5 + p.ph * 20) > 0.6 ? 'dive' : 'hover'); tmp.phase = p.ph; pods.set(i, tmp); } pods.commit(); } }); }
  const big = o.tripods || 0; for (let i = 0; i < big; i++) { const tr = safe('tripod', () => createTripod(seed + i, { size: o.tripodSize || 26, autoMove: false })); if (!tr) continue; S.add(tr); const sx = L.x + (i - (big - 1) / 2) * 42 + (rng.next() - 0.5) * 10, sz = L.az + 20 + i * 18; const spd = 2.6 + rng.next(); ctx.tripods.push(tr);
    S.updaters.push({ t0: 0, t1: dur + 1, fn: (t, u, dt) => { const z = Math.min(L.hz - 55, sz + spd * t); tr.root.position.set(sx, 0, z); tr.setGait({ speed: z >= L.hz - 55 ? 0 : spd, heading: 0 }); const ph = ((t + i * 2.1) % 7) / 7; tr.setCannon(ph < 0.7 ? ph / 0.7 : 0); const tgt = new V3(L.x + Math.sin(t * 0.3 + i) * 20, 2, L.hz + Math.sin(t + i) * 8); tr.aimAt(tgt); if (!S.silent && ph > 0.7 && ph < 0.7 + dt / 7 + 0.001) { const m = tr.muzzleWorld(new V3()); beams.fire({ from: m, to: tgt, width: 1.4, life: 0.5, travel: 0.4 }); fx.explosion(tgt, { size: 22, kind: 'big' }); fx.shockwave && fx.shockwave(tgt, { size: 30 }); } tr.setTentacle('sweep'); } }); }
  if (o.horde) { const n = cnt(o.horde); const h = safe('horde', () => createTripodHorde(n)); if (h) { S.add(h); const hr = new RNG(seed + 8); const hd = Array.from({ length: n }, () => ({ x: L.x + (hr.next() - 0.5) * 520, z: L.az - 180 - hr.next() * 260, s: 2.4 + hr.next() * 0.8 })); const tmp = { x: 0, y: 0, z: 0, yaw: 0, speed: 1, phase: 0, scale: 1, state: 'walk' }; S.updaters.push({ t0: 0, t1: dur + 1, fn: (t) => { for (let i = 0; i < n; i++) { const p = hd[i]; tmp.x = p.x; tmp.z = Math.min(L.az + 60, p.z + p.s * t); tmp.yaw = 0; tmp.phase = i * 0.37; tmp.scale = 1; h.set(i, tmp); } h.commit(); } }); } }
  // ---- continuous fire: pods rain beams, soldiers shoot tracers, random blasts
  let lastB = -1; const tv2 = new V3(), tg = new V3(), tg2 = new V3();
  S.updaters.push({ t0: 0, t1: dur + 1, fn: (t) => {
    if (S.silent) return; const b = Math.floor(t * 8); if (b === lastB) return; lastB = b; const r = new RNG(seed * 31 + b);
    if (ctx.pods) { const k = Math.round(2 + 5 * Q.particles); for (let j = 0; j < k; j++) { const i = r.int(0, ctx.pods.count - 1); ctx.podPos(i, t, tv2); tg.set(L.x + (r.next() - 0.5) * 50, 0, L.hz + (r.next() - 0.5) * 40 - 8); beams.fire({ from: tv2, to: tg, width: 0.28 + r.next() * 0.2, life: 0.22 + r.next() * 0.2 }); if (r.next() < 0.45) fx.explosion(tg, { size: 5 + r.next() * 6, kind: r.next() < 0.5 ? 'laser' : 'ground' }); } }
    if (ctx.groups.soldiers && b % 2 === 0) { for (let j = 0; j < 3; j++) { tg.set(L.x + (r.next() - 0.5) * 24, 1.3, L.hz + (r.next() - 0.5) * 8); tg2.set(L.x + (r.next() - 0.5) * 40, 1.0, L.az + 60 + r.next() * 60); fx.tracer(tg, tg2, { speed: 300 }); } }
    if (r.next() < (o.blasts ?? 0.55)) { tg.set(L.x + (r.next() - 0.5) * 70, 0, L.hz - 70 + r.next() * 90); fx.explosion(tg, { size: 8 + r.next() * 14, kind: r.next() < 0.3 ? 'air' : 'ground' }); }
  } });
  // ---- jets
  if (o.jets && Veh.createJet) for (let i = 0; i < o.jets; i++) { const j = safe('jet', () => Veh.createJet('f15')); if (!j) continue; const e = S.entity(j); const t0 = (o.jetT || dur * 0.35) + i * 0.7; e.path(t0, t0 + 6, [[L.x - 120 + i * 18, 60 + i * 6, L.hz + 260], [L.x - 60 + i * 12, 45 + i * 4, L.hz], [L.x + 20 + i * 6, 50, L.az + 40], [L.x + 60, 80, L.az - 200]], { bank: 1, pitch: true }); S.sfx(t0 + 1.5, 'jet_pass', { pos: [L.x, 40, L.hz] }); }
  if (o.cams !== false) battleCams(S, ctx, o, dur, o.camFrom ?? D);
  return ctx;
}

/** automatic cinematography for battle(): varied angles, cuts every ~4–7 s */
function battleCams(S, ctx, o, dur, from = 0) {
  const L = ctx.lane, x = L.x, hz = L.hz, az = L.az; const rng = new RNG(hashStr(S.id) + 99);
  const c = o.canyon ?? 4; // keep ground cameras inside the street canyon (|dx| <= c) so they never end up inside buildings
  const lib = [
    () => ({ from: { pos: [x - c * 0.8, 2.1, hz + 16], look: [x, 6, hz - 70], fov: 26 }, to: { pos: [x - c * 0.5, 2.5, hz + 12], look: [x, 7, hz - 70], fov: 24 }, handheld: 0.7 }),
    () => ({ from: { pos: [x + c, 1.1, hz - 28], look: [x - 2, 16, hz - 80], fov: 52 }, to: { pos: [x + c * 0.7, 1.3, hz - 30], look: [x - 2, 20, hz - 80], fov: 50 }, handheld: 0.5 }),
    () => ({ from: { pos: [x, 34, az + 20], look: [x, 8, hz - 20], fov: 46 }, to: { pos: [x, 26, hz - 60], look: [x, 4, hz + 10], fov: 42 } }),
    () => ({ from: { pos: [x - c, 2.4, hz + 4], look: [x + 1, 2, hz - 30], fov: 40 }, to: { pos: [x + c, 2.6, hz - 4], look: [x, 2, hz - 40], fov: 40 }, handheld: 0.8 }),
    () => ({ pos: [x + 2, 1.4, hz - 14], look: [x - 3, 30, hz - 60], fov: 55, push: 4, handheld: 0.5 }),
    () => ({ from: { pos: [x + 1, 15, hz - 100], look: [x, 14, hz - 150], fov: 36 }, to: { pos: [x, 18, hz - 60], look: [x - 1, 10, hz - 130], fov: 34 }, handheld: 0.3 }),
    () => ({ from: { pos: [x - 2, 1.7, hz + 7], look: [x + 1, 1.5, hz - 4], fov: 34 }, to: { pos: [x + 2, 1.7, hz + 2], look: [x, 1.4, hz - 8], fov: 34 }, handheld: 1.0 }),
    () => ({ from: { pos: [x, 3, az + 30], look: [x, 22, az + 90], fov: 60 }, to: { pos: [x, 4, az + 50], look: [x, 26, az + 100], fov: 56 }, handheld: 0.4 }),
  ];
  const order = lib.map((_, i) => i).sort(() => rng.next() - 0.5); let t = from, k = 0;
  while (t < dur - 0.5) { const len = Math.min(dur - t, 4 + rng.next() * 3); const spec = lib[order[k % lib.length]](); spec.seed = k; S.shot(t, t + len, spec, k === 0 ? 'cut' : 'cut'); t += len; k++; }
}
