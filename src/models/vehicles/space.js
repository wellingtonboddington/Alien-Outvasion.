// Spacecraft: satellites and an ISS-like space station. Origin = centre, +Z = nadir/forward, arrays along +-X.
import { THREE, clamp, TAU, cached, mk, TX, Parts, assemble, rbox, cyl, cylX, cylZ, sph, ell, lath, between, canvasTex, speckle, Q } from './kit.js';
import { airMats, makeCraft, panelTex } from './craft.js';

function solarTex(cols = 16, rows = 6, key = 'sat:solar') {
  return cached(`${key}:${cols}:${rows}`, () => canvasTex(texRes2(256), texRes2(256), (ctx, w, h) => {
    ctx.fillStyle = '#0c1a38'; ctx.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const g = ctx.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch); g.addColorStop(0, '#1d3f86'); g.addColorStop(1, '#0f2a62'); ctx.fillStyle = g; ctx.fillRect(i * cw + 1.2, j * ch + 1.2, cw - 2.4, ch - 2.4); ctx.strokeStyle = 'rgba(190,200,220,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(i * cw + cw / 2, j * ch + 2); ctx.lineTo(i * cw + cw / 2, (j + 1) * ch - 2); ctx.stroke(); }
    speckle(ctx, w, h, { count: 300, colors: ['#8aa0d0'], alpha: [0.03, 0.12], size: [1, 2], seed: 4 });
  }));
}
const texRes2 = (n) => Math.min(n, Q.texSize);
function spaceMats() {
  const m = airMats({ base: 0xdfe3e6, base2: 0xb9bfc5, dark: 0x1a1d21, rough: 0.45 });
  m.gold = mk.metal(0xc8a040, { rough: 0.38, metal: 0.95, normal: TX.hammered(), ns: 1.4 });
  m.silver = mk.metal(0xd8dce0, { rough: 0.25, metal: 1.0, normal: TX.hammered(), ns: 0.3 });
  m.solar = mk.flat(0xffffff, { map: solarTex(), rough: 0.35, metal: 0.4 }); m.solar.map.anisotropy = 4;
  m.solar2 = mk.flat(0xffffff, { map: solarTex(24, 4, 'sat:solar2'), rough: 0.35, metal: 0.4 });
  return m;
}
/** parabolic dish (open shell along +Z, rim at z=0, vertex back) */
function dishGeo(r, depth) { const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([r * u, depth * u * u]); } const g = lath(pts, 28); g.rotateX(Math.PI / 2); g.translate(0, 0, -depth); return g; }

export function createSatellite(kind = 'comms', opts = {}) {
  const mats = spaceMats(); const root = new THREE.Group(); root.name = 'satellite_' + kind; const body = new THREE.Group(); root.add(body);
  const wingA = new THREE.Group(), wingB = new THREE.Group();
  const geo = cached(`sat:${kind}:${Q.detail}`, () => {
    const P = new Parts();
    if (kind === 'recon') {
      P.add('silver', cylZ(2.1, 2.1, 10, 28, true), { pos: [0, 0, 0.5] }); P.add('white', cylZ(2.2, 2.2, 3.2, 28), { pos: [0, 0, -5.6] }); P.add('gold', cylZ(2.25, 2.25, 2.2, 28), { pos: [0, 0, -3.0] }); P.add('dark', cylZ(2.0, 2.0, 0.3, 28), { pos: [0, 0, 5.3] });
      P.add('dark', cylZ(1.95, 1.95, 7, 20, true), { pos: [0, 0, 1.8] }); P.add('white', rbox(4.3, 0.1, 3.0, 0.03, 1), { pos: [0, 2.7, 6.2], rot: [-0.9, 0, 0] });
      P.add('steel', between([0, 1.5, -6], [0, 3.8, -8], 0.06, 0.06, 6)); P.add('white', cylZ(0.9, 0.9, 0.2, 18), { pos: [0, 3.8, -8.1] });
    } else if (kind === 'gps') {
      P.add('gold', rbox(2.0, 1.7, 2.4, 0.06, 1)); P.add('white', rbox(1.9, 0.08, 2.2, 0.02, 1), { pos: [0, 0.9, 0] }); P.add('dark', rbox(1.5, 0.05, 1.5, 0.02, 1), { pos: [0, -0.9, 0.2] });
      P.add('gold', cylZ(0.9, 0.9, 0.2, 6), { pos: [0, 0, 1.3] }); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; P.add('dark', cylZ(0.07, 0.07, 0.25, 8), { pos: [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 1.4] }); }
      P.add('steel', cylZ(0.04, 0.04, 1.0, 6), { pos: [0.6, 0.6, -1.7] });
    } else {
      P.add('gold', rbox(3.2, 2.4, 3.4, 0.08, 1)); P.add('white', rbox(3.25, 0.1, 3.0, 0.02, 1), { pos: [0, 1.25, 0] }); P.add('white', rbox(3.25, 0.1, 3.0, 0.02, 1), { pos: [0, -1.25, 0] });
      P.add('dark', cyl(0.5, 0.9, 0.9, 16), { pos: [0, 0, -2.1], rot: [Math.PI / 2, 0, 0] }); P.add('steel', between([1.2, 0.8, 1.7], [1.7, 1.6, 3.4], 0.05, 0.05, 6));
      P.add('white', dishGeo(1.5, 0.55), { pos: [1.9, 0.7, 1.4], rot: [0.0, 0.5, 0] }); P.add('steel', cylZ(0.04, 0.04, 0.8, 6), { pos: [1.9, 0.7, 1.9] }); P.add('white', dishGeo(1.0, 0.35), { pos: [-1.9, 0.6, 1.5], rot: [0.0, -0.4, 0] });
      P.add('dark', rbox(0.3, 0.3, 0.4, 0.04, 1), { pos: [-1.0, 1.4, 1.5] }); P.add('steel', cyl(0.025, 0.025, 2.2, 6), { pos: [0.6, 2.2, -1.2] });
    }
    return P.geos();
  });
  body.add(assemble(geo, mats));
  // solar wings: yoke + n panels, along +-X (A: +X, B: -X)
  const wing = (sign, group, n, pw_, ph) => {
    const P = new Parts(); const y0 = kind === 'recon' ? 2.4 : kind === 'gps' ? 1.1 : 1.9;
    P.add('steel', cylX(0.07, 0.07, y0 * 0.6 + 0.4, 8), { pos: [0, 0, 0] });
    for (let i = 0; i < n; i++) { P.add('solar', rbox(pw_ - 0.06, 0.04, ph, 0.01, 1), { pos: [0.5 + (i + 0.5) * pw_ + 0.4, 0, 0] }); P.add('steel', rbox(pw_, 0.03, 0.05, 0.01, 1), { pos: [0.5 + (i + 0.5) * pw_ + 0.4, -0.03, ph / 2] }); P.add('steel', rbox(pw_, 0.03, 0.05, 0.01, 1), { pos: [0.5 + (i + 0.5) * pw_ + 0.4, -0.03, -ph / 2] }); }
    const g = assemble(P.geos(), mats); group.add(g); group.position.x = sign * (kind === 'recon' ? 2.2 : kind === 'gps' ? 1.0 : 1.6); if (sign < 0) g.rotation.y = Math.PI; body.add(group);
  };
  const spec = kind === 'recon' ? [2, 3.6, 3.2] : kind === 'gps' ? [2, 2.0, 1.8] : [3, 3.0, 3.0];
  wing(1, wingA, ...spec); wing(-1, wingB, ...spec);
  const S = { sun: opts.sun ?? 0.4, spin: opts.spin ?? 0.03, tumble: 0 };
  const api = makeCraft(root, { state: S, onUpdate(dt, t, s) { wingA.rotation.x = wingB.rotation.x = s.sun + 0.15 * Math.sin(t * 0.05); body.rotation.z = s.spin * t; body.rotation.x = s.tumble * t * 0.7; } });
  api.kind = 'satellite:' + kind; api.mats = mats; api.bounds = { span: kind === 'comms' ? 22 : kind === 'recon' ? 20 : 12 };
  Object.assign(api, { setSun(a) { S.sun = a; }, setSpin(r) { S.spin = r; }, setTumble(r) { S.tumble = r; }, setSpeed() {} });
  if (opts.scale) root.scale.setScalar(opts.scale); if (opts.infection) api.setInfection(opts.infection); api.update(0, 0); return api;
}

export function createSpaceStation(opts = {}) {
  const mats = spaceMats(); const root = new THREE.Group(); root.name = 'space_station';
  const arrays = new THREE.Group(); arrays.name = 'arrays';
  const geo = cached(`station:${Q.detail}`, () => {
    const P = new Parts(); const N = 14, bay = 5;
    // integrated truss along X (73 m): 4 longerons + frames + diagonals
    for (const [y, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.add('steel', cylX(0.1, 0.1, N * bay, 6), { pos: [0, y, z] });
    for (let i = 0; i <= N; i++) { const x = -N * bay / 2 + i * bay; P.add('steel', cyl(0.07, 0.07, 2, 5), { pos: [x, 0, 1], rot: [0, 0, 0] }); P.add('steel', cyl(0.07, 0.07, 2, 5), { pos: [x, 0, -1] }); P.add('steel', cylZ(0.07, 0.07, 2, 5), { pos: [x, 1, 0] }); P.add('steel', cylZ(0.07, 0.07, 2, 5), { pos: [x, -1, 0] });
      if (i < N) { for (const z of [1, -1]) P.add('steel', between([x, -1, z], [x + bay, 1, z], 0.05, 0.05, 5)); for (const y of [1, -1]) P.add('steel', between([x, y, -1], [x + bay, y, 1], 0.05, 0.05, 5)); } }
    // pressurised modules along Z
    P.add('white', cylZ(2.2, 2.2, 9, 28), { pos: [0, -2.6, 2.5] }); P.add('white', cylZ(2.2, 2.2, 8, 28), { pos: [0, -2.6, 11.5] }); P.add('gold', cylZ(2.25, 2.25, 0.6, 28), { pos: [0, -2.6, 6.9] });
    P.add('white', cylZ(2.0, 2.0, 8, 28), { pos: [0, -2.6, -6.0] }); P.add('white', cylZ(2.2, 1.6, 4, 28), { pos: [0, -2.6, -12.0] }); P.add('white', cylZ(1.6, 1.6, 8, 28), { pos: [0, -2.6, -18.0] }); P.add('gold', cylZ(1.7, 1.7, 0.5, 24), { pos: [0, -2.6, -22.2] });
    P.add('white', cylX(2.0, 2.0, 7, 24), { pos: [-6.5, -2.6, 2.5] }); P.add('white', cylX(2.0, 2.0, 7, 24), { pos: [6.5, -2.6, 2.5] }); P.add('white', cylX(2.0, 2.0, 5, 24), { pos: [-5.5, -2.6, 11.5] });
    P.add('white', sph(1.5, 20, 12), { pos: [0, -4.6, 2.5] }); P.add('glass', sph(0.9, 14, 8), { pos: [0, -5.8, 2.5] }); P.add('steel', cylZ(0.3, 0.3, 2, 8), { pos: [0, -2.6, 16.5] });
    // soyuz / progress + antennas
    P.add('gold', ell(1.1, 1.1, 1.3), { pos: [0, -2.6, 17.8] }); P.add('white', cylZ(1.1, 1.1, 3, 14), { pos: [0, -2.6, -24.2] }); P.add('dark', cylZ(0.4, 0.4, 0.3, 10), { pos: [0, -2.6, -26.0] });
    P.add('steel', between([0, 1, 0], [0, -2.0, 0], 0.5, 0.5, 8)); P.add('white', between([0, 1.5, 6], [0, 4.5, 8], 0.04, 0.04, 5)); P.add('white', cyl(0.8, 0.1, 0.4, 14), { pos: [0, 4.6, 8] });
    // radiators (white panels either side of the truss root)
    for (const x of [-9, -5, 5, 9]) P.add('white', rbox(2.8, 0.08, 12, 0.02, 1), { pos: [x, 0.0, 8 + 0], rot: [0.0, 0, 0] });
    // array mast + joint at each of 4 stations
    for (const x of [-36, -20, 20, 36]) P.add('gold', cylX(0.9, 0.9, 1.6, 14), { pos: [x, 0, 0] });
    return P.geos();
  });
  root.add(assemble(geo, mats));
  const aP = new Parts();
  aP.add('steel', cylZ(0.1, 0.1, 68, 6)); // mast through both blankets
  for (const s of [1, -1]) for (const dx of [-3.3, 3.3]) aP.add('solar2', rbox(6.5, 0.05, 33, 0.01, 1), { pos: [dx, 0, s * 17.2] });
  const ag = assemble(aP.geos(), mats); const stations = [-36, -20, 20, 36];
  for (const x of stations) { const g = ag.clone(); g.position.x = x; arrays.add(g); }
  // clones share geometry/material (shared geo flagged) – clone materials per station is unnecessary for infection since uniform is per material instance, shared deliberately
  root.add(arrays);
  const S = { alpha: opts.alpha ?? 0.5, rate: opts.rate ?? 0.03 };
  const api = makeCraft(root, { state: S, onUpdate(dt, t, s) { arrays.rotation.x = s.alpha + t * s.rate; } });
  api.kind = 'space_station'; api.mats = mats; api.bounds = { span: 109, length: 73 };
  Object.assign(api, { setArrays(a) { S.alpha = a; }, setArrayRate(r) { S.rate = r; }, setSpeed() {} });
  if (opts.scale) root.scale.setScalar(opts.scale); if (opts.infection) api.setInfection(opts.infection); api.update(0, 0); return api;
}
