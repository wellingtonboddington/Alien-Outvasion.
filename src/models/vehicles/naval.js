// Warships & ferry (wake-less hulls: origin at the waterline, hull continues ~draft below so it sits right on a displaced ocean).
// +Z = bow, starboard = -X. createWarship(kind:'destroyer'|'carrier'|'ferry', opts{seed}) -> {root, update, dispose, setSea(amp), setSpeed, setLights, setInfection, ...}
import { THREE, clamp, lerp, damp, smoothstep, TAU, RNG, cached, mk, TX, Parts, assemble, rbox, cyl, cylZ, sph, ell, loftZ, pw, plane, between, canvasTex, speckle, Q } from './kit.js';
import { planSlab, sideSlab2 } from './common2.js';
import { textTex } from '../../engine/proc.js';
import { airMats, scaleUV, planarUV01, makeCraft, panelTex } from './craft.js';

const prof = (L, beam, pts) => pw(pts.map(([s, f]) => [-L / 2 + s * L, (f * beam) / 2]));
const shipMats = ({ hull = 0x8a9199, hull2 = 0x5d636a, deck = 0x535860, low = 0x6a1b16 } = {}) => {
  const m = airMats({ base: hull, base2: hull2, dark: 0x1b1e22, rough: 0.62 });
  m.hull = m.paint;
  m.low = mk.flat(low, { rough: 0.75, metal: 0.1, normalMap: TX.hammered(), normalScale: 0.4 });
  m.deck = mk.flat(deck, { rough: 0.85, metal: 0.1, normalMap: TX.hammered(), normalScale: 0.6 });
  m.orange = mk.flat(0xe8590c, { rough: 0.5 }); m.blue = mk.flat(0x14306a, { rough: 0.5 }); m.yellow = mk.flat(0xe8b410, { rough: 0.5 });
  m.decal = mk.flat(0xffffff, { rough: 0.6, metal: 0 }); m.decal.transparent = true; m.decal.depthWrite = false; m.decal.polygonOffset = true; m.decal.polygonOffsetFactor = -2;
  return m;
};
/** common hull: lower (anti-fouling) + upper (haze grey) + deck skin following the sheer */
function hull(P, { L, beam, draft, free, shape, flare = 0.1, bowRise = 0.18, upKey = 'hull', hz = 12 }) {
  const hb = prof(L, beam, shape); const z0 = -L / 2, z1 = L / 2;
  const deckY = pw([[z0, free], [-L * 0.1, free * 0.94], [L * 0.3, free], [z1, free * (1 + bowRise)]]);
  const fl = (z) => 1 + flare * smoothstep(z0, z1, z) * 0.5 + flare * 0.5;
  P.add('low', loftZ({ z0, z1, n: 36, w: (z) => hb(z) * 0.5, wt: hb, yb: pw([[z0, -draft * 0.8], [z0 + L * 0.2, -draft], [z0 + L * 0.75, -draft], [z1, -draft * 0.12]]), yt: 0, p: 2.4, round: [0.6, 0], radial: 24 }));
  P.add(upKey, loftZ({ z0, z1, n: 40, w: hb, wt: (z) => hb(z) * fl(z), yb: 0, yt: (z) => deckY(z) - 0.06, p: 3.4, round: [0.6, 0], radial: 28 }), { uv: scaleUV(L / hz, free / 5) });
  P.add('deck', loftZ({ z0, z1, n: 40, w: (z) => hb(z) * fl(z) * 0.99, wt: (z) => hb(z) * fl(z) * 0.99, yb: (z) => deckY(z) - 0.07, yt: deckY, p: 6, round: [0.6, 0], radial: 28 }));
  return { hb, deckY, fl };
}
const B = (P, key, w, h, d, x, y, z, r = 0.05, rot) => P.add(key, rbox(w, h, d, r, 1), { pos: [x, y, z], rot });
const gridTex = (cols, rows, key) => cached(`ship:grid:${key}`, () => canvasTex(256, 256, (ctx, w, h) => { ctx.fillStyle = '#2b2f34'; ctx.fillRect(0, 0, w, h); const cw = w / cols, ch = h / rows; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { ctx.fillStyle = '#3a4047'; ctx.fillRect(i * cw + 3, j * ch + 3, cw - 6, ch - 6); ctx.strokeStyle = '#15181b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(i * cw + cw / 2, j * ch + ch / 2, Math.min(cw, ch) * 0.3, 0, TAU); ctx.stroke(); } speckle(ctx, w, h, { count: 400, colors: ['#111'], alpha: [0.1, 0.3], size: [1, 2], seed: 3 }); }));
const decalTex = (txt, w = 256, h = 128) => textTex(txt, { w, h, font: 'bold 84px "Liberation Sans", Arial, sans-serif', color: '#f2f2f2' });

// ───────────────────────────── destroyer ─────────────────────────────
function buildDestroyer(opts) {
  const mats = shipMats(); mats.vls = mk.flat(0xffffff, { map: gridTex(8, 14, 'vls'), rough: 0.6 }); mats.num = mk.flat(0xffffff, { map: decalTex('91'), rough: 0.6, metal: 0 }); mats.num.transparent = true; mats.num.polygonOffset = true; mats.num.polygonOffsetFactor = -2; mats.num.depthWrite = false;
  const L = 155, D = 8;
  const geo = cached(`ship:ddg:${Q.detail}`, () => {
    const P = new Parts();
    const H = hull(P, { L, beam: 20, draft: 6.3, free: D, shape: [[0, 0.42], [0.06, 0.62], [0.2, 0.88], [0.4, 1.0], [0.6, 1.0], [0.75, 0.93], [0.88, 0.65], [0.95, 0.35], [1.0, 0.0]], flare: 0.1 });
    P.add('hull', loftZ({ z0: -27, z1: 22, n: 14, w: 7.2, wt: 5.4, yb: D, yt: D + 7.5, p: 5, round: [2, 3], radial: 16 }), { uv: scaleUV(8, 2) });
    P.add('hull', loftZ({ z0: 6, z1: 21, n: 10, w: 5.8, wt: 4.4, yb: D + 7.5, yt: D + 11.5, p: 5, round: [1, 2.5], radial: 16 }), { uv: scaleUV(4, 2) });
    P.add('glass', rbox(9.0, 1.0, 0.1, 0.05, 1), { pos: [0, D + 9.8, 20.7], rot: [-0.25, 0, 0] }); for (const sx of [1, -1]) P.add('glass', rbox(0.1, 1.0, 5.5, 0.05, 1), { pos: [sx * 5.0, D + 9.8, 13.5] });
    P.add('hull', cyl(2.6, 2.8, 1.4, 20), { pos: [0, D + 0.7, 52] }); P.add('paint2', rbox(3.4, 1.8, 4.4, 0.55, 2), { pos: [0, D + 2.3, 52.4] }); P.add('dark', cylZ(0.15, 0.15, 5.5, 10), { pos: [0, D + 2.45, 57.3] });
    P.add('vls', plane(8, 18).rotateX(-Math.PI / 2), { pos: [0, D + 0.1, 36] }); P.add('vls', plane(8, 14).rotateX(-Math.PI / 2), { pos: [0, D + 0.1, -36] });
    for (const sx of [1, -1]) for (const z of [12, -12]) P.add('dark', rbox(0.25, 4.2, 4.2, 0.05, 1), { pos: [sx * 6.15, D + 4.2, z], rot: [0, 0, sx * 0.0] });
    for (const z of [-8, -20]) { P.add('paint2', cyl(1.9, 2.5, 6, 18), { pos: [0, D + 10.5, z], rot: [0.12, 0, 0] }); P.add('dark', cyl(1.6, 1.6, 0.25, 16), { pos: [0, D + 13.5, z - 0.4], rot: [0.12, 0, 0] }); }
    P.add('steel', between([0, D + 11.5, 15], [0, D + 24, 13.5], 0.5, 0.22, 8)); B(P, 'steel', 7, 0.2, 0.2, 0, D + 20, 14.3); P.add('dark', sph(0.9, 12, 8), { pos: [3.2, D + 20, 14.3] }); P.add('dark', sph(0.9, 12, 8), { pos: [-3.2, D + 20, 14.3] });
    P.add('steel', between([0, D + 7.5, -18], [0, D + 17, -20.5], 0.3, 0.12, 8)); B(P, 'steel', 4, 0.15, 0.15, 0, D + 14.5, -19.8);
    for (const sx of [1, -1]) { B(P, 'hull', 3.6, 4.5, 6.5, sx * 4.4, D + 2.25, -36, 0.25); B(P, 'dark', 3.0, 3.6, 0.1, sx * 4.4, D + 2.2, -32.7); B(P, 'white', 1.4, 0.7, 3.6, sx * 8.0, D + 7.0, -4 + sx * 0, 0.25); }
    P.add('deck', planSlab([[-8, -52], [8, -52], [8, -77], [-8, -77]], 0.12, 0.02), { pos: [0, D + 0.1, 0] }); P.add('white', plane(7, 7).rotateX(-Math.PI / 2), { pos: [0, D + 0.18, -64] });
    for (const [z, y] of [[-10, D + 7.5], [-44, D + 4.5]]) { P.add('dark', cyl(0.9, 1.1, 1.2, 12), { pos: [0, y + 0.6, z] }); P.add('white', cyl(0.8, 0.8, 1.6, 14), { pos: [0, y + 1.8, z] }); P.add('dark', cylZ(0.12, 0.12, 1.3, 8), { pos: [0, y + 1.9, z + 1.0] }); }
    B(P, 'dark', 2.4, 1.1, 6, 0, D + 0.6, -3.5, 0.1, [0, 0, 0]);
    for (const sx of [1, -1]) P.add('num', plane(7.5, 3.4), { pos: [sx * (H.hb(42) * 1.06 + 0.05), D * 0.6, 42], rot: [0, sx * Math.PI / 2, 0] });
    return P.geos();
  });
  const root = new THREE.Group(); root.name = 'warship_destroyer'; const sea = new THREE.Group(); root.add(sea); sea.add(assemble(geo, mats));
  const radar = new THREE.Group(); radar.position.set(0, D + 24.6, 13.5); sea.add(radar); const dish = new THREE.Mesh(rbox(5.0, 1.5, 0.15, 0.05, 1), mats.dark); dish.position.y = 0.8; radar.add(dish);
  return { root, sea, mats, radar, radarW: 2.2, len: L, anchors: { helipad: { pos: [0, D + 0.2, -64], yaw: 0 } }, bounds: { length: L, width: 20, height: D + 25 } };
}

// ───────────────────────────── carrier ─────────────────────────────
const DECK = [[-33, -165], [36, -165], [40, -110], [40, -60], [34, 10], [24, 90], [12, 150], [0, 166], [-12, 150], [-26, 90], [-33, 10]];
function deckTex() {
  return cached('ship:flightdeck', () => canvasTex(Math.min(512, Q.texSize), Math.min(1024, Q.texSize * 2), (ctx, w, h) => {
    const X = (x) => ((x + 34) / 76) * w, Z = (z) => (1 - (z + 166) / 332) * h; // canvas top = stern
    ctx.fillStyle = '#50555b'; ctx.fillRect(0, 0, w, h); speckle(ctx, w, h, { count: 5000, colors: ['#2a2d31', '#6a6f75', '#1e2124'], alpha: [0.1, 0.4], size: [1, 3], seed: 7 });
    ctx.fillStyle = 'rgba(25,28,30,0.35)'; for (let i = 0; i < 9; i++) ctx.fillRect(X(-30 + (i % 3) * 20), Z(-20 - i * 18), 6, 38); // tyre / oil streaks
    ctx.strokeStyle = '#d8d8d0'; ctx.lineWidth = Math.max(2, w / 120); const ang = Math.tan(0.157);
    const L1 = (x0, z0, x1, z1, dash) => { ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(X(x0), Z(z0)); ctx.lineTo(X(x1), Z(z1)); ctx.stroke(); };
    L1(-4, -160, -4 + ang * 190, 30, [18, 10]); L1(-12, -160, -12 + ang * 190, 30); L1(4, -160, 4 + ang * 190, 30); // angled landing area centre + edges
    ctx.setLineDash([]); ctx.strokeStyle = '#e8b020'; ctx.lineWidth = Math.max(2, w / 160); L1(-14 + ang * 60, -100, 6 + ang * 40, -80); // foul line
    ctx.strokeStyle = '#b8bcc0'; ctx.lineWidth = Math.max(1, w / 220); for (let k = 0; k < 4; k++) L1(-10 + ang * (-135 + k * 11), -135 + k * 11, 14 + ang * (-135 + k * 11), -135 + k * 11); // arresting wires
    ctx.strokeStyle = '#1d2023'; ctx.lineWidth = 3; for (const [x, z0, z1] of [[-24, 60, 160], [-14, 60, 160], [0, 70, 150], [8, 70, 150]]) L1(x, z0, x, z1); // catapult tracks
    ctx.fillStyle = '#3d4a3a'; for (const [x, z] of [[-27, 40], [-24, -62], [30, -55], [18, 80]]) ctx.fillRect(X(x - 8), Z(z + 11), X(x + 8) - X(x - 8), Z(z - 11) - Z(z + 11)); // elevators
    ctx.save(); ctx.translate(X(-8), Z(110)); ctx.rotate(Math.PI); ctx.fillStyle = '#e8e8e0'; ctx.font = `bold ${Math.round(w / 3.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('68', 0, 0); ctx.restore();
  }));
}
function deckJet() {
  const J = new Parts(); J.add('jet', ell(0.9, 0.7, 6.4), { pos: [0, 0.2, 0] }); J.add('dark', ell(0.55, 0.45, 1.5), { pos: [0, 0.7, 2.0] });
  J.add('jet', planSlab([[0.5, 1.8], [5.2, -1.4], [5.2, -2.4], [0.5, -3.2]], 0.12, 0.02), { pos: [0, 0.15, 0], mirror: true }); J.add('jet', planSlab([[0.4, -3.0], [2.4, -4.2], [2.4, -4.9], [0.4, -4.9]], 0.1, 0.02), { pos: [0, 0.2, 0], mirror: true });
  J.add('jet', sideSlab2([[-2.8, 0], [-4.6, 3.0], [-5.4, 3.0], [-5.2, 0]], 0.1, 0.02), { pos: [0.9, 0.7, 0], rot: [0, 0, -0.35], mirror: true }); J.add('dark', cylZ(0.5, 0.45, 0.8, 12), { pos: [0.5, 0.15, -3.5], mirror: true });
  return J.geos();
}
function buildCarrier(opts) {
  const mats = shipMats({ hull: 0x7b828a, deck: 0x50555b }); const rng = new RNG(opts.seed ?? 5);
  mats.flight = mk.flat(0xffffff, { map: deckTex(), rough: 0.9, metal: 0.05, normalMap: TX.hammered(), normalScale: 0.3 }); mats.jet = mk.paint(0x6c737b, { metal: 0.3, rough: 0.5, clearcoat: 0.2 });
  const L = 332, DY = 17.5, TOP = DY + 1.2 + 1.2;
  const geo = cached(`ship:cvn:${Q.detail}`, () => {
    const P = new Parts();
    hull(P, { L, beam: 41, draft: 11.8, free: DY, shape: [[0, 0.8], [0.05, 0.95], [0.2, 1.0], [0.7, 1.0], [0.85, 0.8], [0.95, 0.45], [1.0, 0.0]], flare: 0.35, bowRise: 0.0, hz: 40 });
    P.add('flight', planSlab(DECK, 2.4, 0.15), { pos: [0, DY + 1.2, 0], uv: planarUV01(-34, 42, -166, 166) });
    P.add('hull', planSlab(DECK.map(([x, z]) => [x * 0.93, z * 0.99]), 1.5, 0.1), { pos: [0, DY - 0.2, 0] });
    // island (starboard = -x)
    const ix = -24; B(P, 'hull', 11, 17, 44, ix, TOP + 8.5, 4, 0.5); B(P, 'hull', 10, 4.5, 18, ix, TOP + 19.2, 9, 0.4); B(P, 'glass', 9.2, 1.2, 0.1, ix, TOP + 19.6, 18.1, 0.05, [-0.2, 0, 0]);
    B(P, 'hull', 7, 6, 12, ix, TOP + 23.5, -2, 0.3); P.add('steel', between([ix, TOP + 26, -3], [ix, TOP + 45, -4], 0.9, 0.35, 8)); B(P, 'steel', 9, 0.3, 0.3, ix, TOP + 40, -3.8);
    for (const [dx, y, z, rz] of [[-5.7, 12, 6, 0], [5.7, 12, 6, 0], [-5.7, 16, -10, 0], [5.7, 16, -10, 0]]) B(P, 'dark', 0.3, 5, 5, ix + dx, TOP + y, z, 0.05);
    P.add('dark', sph(1.6, 14, 10), { pos: [ix, TOP + 30.5, 0] }); for (const z of [12, -12]) P.add('dark', rbox(0.3, 4.5, 4.5, 0.05, 1), { pos: [ix + 0, TOP + 16, z * 0.0 + (z > 0 ? 18.2 : -12)] });
    // sponson guns / CIWS, antennae, crane
    for (const [x, z] of [[-35, 20], [-35, -110], [43, -20], [43, -130]]) { P.add('dark', cyl(0.9, 1.1, 1.2, 12), { pos: [x * 0.97, DY, z] }); P.add('white', cyl(0.8, 0.8, 1.6, 14), { pos: [x * 0.97, DY + 1.4, z] }); }
    // parked aircraft
    const jg = deckJet(); const spots = [];
    for (let i = 0; i < 7; i++) spots.push([-27 + (i % 2) * 9.5, 42 + i * 15, 0.1 + rng.range(-0.15, 0.15)]);
    for (let i = 0; i < 5; i++) spots.push([-28 + (i % 2) * 7, -62 - i * 17, Math.PI - 0.1 + rng.range(-0.15, 0.15)]);
    for (let i = 0; i < 5; i++) spots.push([30 + (i % 2) * 4, -118 + i * 17, 0.6 + rng.range(-0.1, 0.1)]);
    spots.push([2, 138, 0.0], [-9, 128, 0.0]);
    for (const [x, z, yaw] of spots) { P.add('jet', jg.jet, { pos: [x, TOP + 1.0, z], rot: [0, yaw, 0] }); P.add('dark', jg.dark, { pos: [x, TOP + 1.0, z], rot: [0, yaw, 0] }); }
    return P.geos();
  });
  const root = new THREE.Group(); root.name = 'warship_carrier'; const sea = new THREE.Group(); root.add(sea); sea.add(assemble(geo, mats));
  const radar = new THREE.Group(); radar.position.set(-24, TOP + 46.5, -4); sea.add(radar); const dish = new THREE.Mesh(rbox(7, 1.8, 0.2, 0.05, 1), mats.dark); dish.position.y = 0.9; radar.add(dish);
  return { root, sea, mats, radar, radarW: 1.6, len: L, anchors: { flightDeck: { pos: [0, TOP, 0], yaw: 0 }, helipad: { pos: [-26, TOP, 120], yaw: 0 } }, bounds: { length: L, width: 78, height: TOP + 46 } };
}

// ───────────────────────────── ferry ─────────────────────────────
function windowsTex() {
  return cached('ship:windows', () => canvasTex(Math.min(1024, Q.texSize * 2), 128, (ctx, w, h) => {
    ctx.fillStyle = '#eef0f1'; ctx.fillRect(0, 0, w, h); const cols = 44, cw = w / cols;
    for (const [y0, y1] of [[0.14, 0.3], [0.4, 0.56], [0.66, 0.82]]) { ctx.fillStyle = '#1b2a3a'; for (let i = 0; i < cols; i++) ctx.fillRect(i * cw + cw * 0.12, y0 * h, cw * 0.76, (y1 - y0) * h); ctx.fillStyle = 'rgba(180,210,235,0.18)'; for (let i = 0; i < cols; i++) ctx.fillRect(i * cw + cw * 0.12, y0 * h, cw * 0.76, (y1 - y0) * h * 0.4); }
    ctx.fillStyle = '#14306a'; ctx.fillRect(0, h * 0.9, w, h * 0.04); speckle(ctx, w, h, { count: 600, colors: ['#8a8f94', '#c9ccce'], alpha: [0.05, 0.25], size: [1, 3], seed: 5 });
  }));
}
function buildFerry(opts) {
  const mats = shipMats({ hull: 0x16284d, low: 0x5a1a16 }); mats.hull = mk.paint(0x14264a, { metal: 0.2, rough: 0.55, clearcoat: 0.3, map: panelTex(), normalScale: 0.08 });
  mats.super = mk.flat(0xffffff, { map: windowsTex(), rough: 0.5, metal: 0.05 }); mats.name = mk.flat(0xffffff, { map: decalTex('SUPERFERRY', 512, 128), rough: 0.6, metal: 0 }); mats.name.transparent = true; mats.name.polygonOffset = true; mats.name.polygonOffsetFactor = -2; mats.name.depthWrite = false;
  const L = 118, D = 7;
  const geo = cached(`ship:ferry:${Q.detail}`, () => {
    const P = new Parts();
    const H = hull(P, { L, beam: 19, draft: 4.6, free: D, shape: [[0, 0.5], [0.1, 0.85], [0.3, 1.0], [0.7, 1.0], [0.85, 0.8], [0.95, 0.4], [1.0, 0.0]], flare: 0.08, bowRise: 0.25, upKey: 'hull', hz: 20 });
    P.add('super', loftZ({ z0: -38, z1: 30, n: 20, w: 8.4, wt: 7.8, yb: D, yt: D + 13, p: 4, round: [3, 11], radial: 20 }));
    P.add('super', loftZ({ z0: 12, z1: 26, n: 10, w: 7.0, wt: 6.4, yb: D + 13, yt: D + 17, p: 4, round: [2, 5], radial: 16 }), { uv: scaleUV(1, 0.0) });
    P.add('glass', rbox(11, 1.3, 0.1, 0.05, 1), { pos: [0, D + 15.5, 25.4], rot: [-0.2, 0, 0] });
    P.add('yellow', cyl(2.4, 2.6, 7, 20), { pos: [0, D + 17.5, -14], rot: [0.08, 0, 0] }); P.add('blue', cyl(2.5, 2.5, 1.8, 20), { pos: [0, D + 19.3, -14.3], rot: [0.08, 0, 0] }); P.add('dark', cyl(2.2, 2.2, 0.3, 18), { pos: [0, D + 21.1, -14.6], rot: [0.08, 0, 0] });
    P.add('steel', between([0, D + 17, 22], [0, D + 28, 21], 0.35, 0.15, 8)); B(P, 'steel', 5, 0.15, 0.15, 0, D + 25, 21.4);
    P.add('dark', rbox(14, 5, 0.3, 0.05, 1), { pos: [0, D - 3.2, -L / 2 + 0.2] }); P.add('dark', rbox(14, 0.4, 4, 0.05, 1), { pos: [0, D + 0.1, -L / 2 - 1.0] });
    for (const sx of [1, -1]) { for (const z of [-24, -14, 2, 12]) P.add('orange', ell(1.1, 0.8, 3.4), { pos: [sx * 9.0, D + 9.2, z] }); P.add('name', plane(24, 5.6), { pos: [sx * (H.hb(10) * 1.04 + 0.05), D * 0.62, 14], rot: [0, sx * Math.PI / 2, 0] }); }
    for (let i = 0; i < 8; i++) P.add('white', rbox(1.8, 1.2, 2.2, 0.1, 1), { pos: [(i % 2 ? 1 : -1) * 3.5, D + 17.6, -32 + Math.floor(i / 2) * 3.8] });
    return P.geos();
  });
  const root = new THREE.Group(); root.name = 'warship_ferry'; const sea = new THREE.Group(); root.add(sea); sea.add(assemble(geo, mats));
  const radar = new THREE.Group(); radar.position.set(0, D + 28.3, 21); sea.add(radar); const dish = new THREE.Mesh(rbox(3.2, 0.5, 0.1, 0.03, 1), mats.dark); dish.position.y = 0.3; radar.add(dish);
  return { root, sea, mats, radar, radarW: 3.0, len: L, anchors: { gangway: { pos: [9.5, D + 3, 0], yaw: Math.PI / 2 } }, bounds: { length: L, width: 19, height: D + 28 } };
}

export function createWarship(kind = 'destroyer', opts = {}) {
  const b = kind === 'carrier' ? buildCarrier(opts) : kind === 'ferry' ? buildFerry(opts) : buildDestroyer(opts);
  const S = { sea: opts.sea ?? 0.5, speed: 0, ph: new RNG(opts.seed ?? 3).range(0, 50) };
  const api = makeCraft(b.root, { state: S, onUpdate(dt, t, s) {
    b.radar.rotation.y = t * b.radarW; const k = s.sea * 600 / (b.len + 200); const ph = s.ph;
    b.sea.rotation.z = (Math.sin(t * 0.35 + ph) * 0.6 + Math.sin(t * 0.83 + ph * 2) * 0.25) * 0.02 * k * 2; b.sea.rotation.x = (Math.sin(t * 0.27 + ph * 1.3) * 0.5 + Math.sin(t * 0.61) * 0.2) * 0.012 * k * 2 - clamp(s.speed / 60, 0, 0.4) * 0.01;
    b.sea.position.y = Math.sin(t * 0.5 + ph) * 0.12 * k * 2;
  } });
  api.kind = 'warship:' + kind; api.mats = b.mats; api.bounds = b.bounds; api.anchors = b.anchors; api.length = b.len; api.draftY = 0;
  Object.assign(api, { setSea(a) { S.sea = a; }, setSpeed(mps) { S.speed = mps; api.speed = mps; }, setLights() {} });
  if (opts.infection) api.setInfection(opts.infection); api.update(0, 0); return api;
}
