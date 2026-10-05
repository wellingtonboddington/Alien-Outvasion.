// Vessari DROPSHIP: wasp/manta-shaped troop lander ~26 m long. Swept manta wings with bone plates, glowing visor, VTOL nacelles with thruster flames,
// abdomen bay with a rear ramp (openHatch 0..1) and a small crowd of crawler silhouettes inside.
import * as THREE from 'three';
import { RNG, seg, clamp, lerp, damp, TAU, disposeTree } from '../../engine/common.js';
import { tube } from '../../engine/geo.js';
import { shellMat, fleshMat, glowMat, flameMat, haloMat, infectAll, CYAN } from './mats.js';
import { revolve, surface, blob, spike, place, mergeAll, scaleUV, torus, orient, smoothNormals, sstep } from './kit.js';

const V3 = THREE.Vector3;
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));

function fuselageGeo() {
  const Lh = 28; // length: z in [-14, 14]
  const g = revolve(Lh, (t, y, a) => {
    const s = t * 2 - 1;                                   // -1 tail .. +1 nose
    let w = s > 0 ? Math.pow(Math.max(0, 1 - Math.pow(s, 2.0)), 0.62) : 0.28 + 0.72 * Math.pow(Math.max(0, 1 - Math.pow(-s, 2.2)), 0.55);
    let r = 4.6 * w * (1 + 0.1 * gauss(s + 0.15, 0.3));
    r *= 1 + 0.12 * gauss(a - 1.5 * Math.PI, 0.35) * (s > -0.6 ? 1 : 0.2);                 // dorsal hump
    return Math.max(0.05, r);
  }, { rings: seg(40, 18), radial: seg(36, 16), tile: 6, ratio: 0.62 });
  g.rotateX(Math.PI / 2); g.translate(0, 0, -Lh / 2); return g;
}
function wingSurface(top, side, span = 14.5) {
  const nu = seg(16, 8), nv = seg(14, 7);
  const fn = (u, v, o) => {
    const x0 = 2.6, x = x0 + u * span;
    const zle = 8.0 - 15.5 * Math.pow(u, 1.25), zte = -9.5 - 3.5 * u - 1.9 * Math.pow(Math.abs(Math.sin(u * Math.PI * 4.5)), 0.8) * u;
    const z = lerp(zle, zte, v);
    const th = 0.95 * (1 - 0.75 * u) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, v))), 0.7) * (1 - Math.pow(u, 3));
    const droop = -0.032 * Math.pow(x - x0, 1.8) - 0.35 * Math.sin(Math.PI * v) * 0.3;
    // plate ridges on the upper surface
    const ridge = top ? 0.1 * Math.pow(Math.abs(Math.sin(Math.PI * (v * 6.0 + u * 1.3))), 3) * (1 - u * 0.5) * Math.sin(Math.PI * v) : 0;
    o.set(side * x, droop + (top ? th + ridge : -th * 0.7) - 0.2, z);
  };
  const g = surface(nu, nv, fn, { uvScale: [3, 3] });
  return orient(g, side * 6, -0.5, -1);
}
function nacelle(rOut, len) {
  const g = revolve(len, (t) => rOut * (t < 0.2 ? 0.8 + t : 1.0 + 0.1 * Math.sin(t * 9)) * (t > 0.85 ? 1 + (t - 0.85) * 1.2 : 1), { rings: 10, radial: seg(20, 10), tile: 3 });
  g.rotateX(-Math.PI / 2); return g; // axis along -Z (opening at -z)
}
function crawlerSil(rng) {
  const parts = []; const body = new THREE.SphereGeometry(0.42, 8, 5); body.scale(1, 0.5, 1.2); body.translate(0, 0.55, 0); parts.push(body);
  for (let k = 0; k < 6; k++) { const side = k < 3 ? 1 : -1, zz = ((k % 3) - 1) * 0.28; const pts = [new V3(side * 0.3, 0.55, zz), new V3(side * 0.8, 0.9, zz + 0.05), new V3(side * 1.0, 0.0, zz + 0.1)]; parts.push(tube(pts, [0.06, 0.045, 0.012], { radial: 4, segsPerPoint: 2 })); }
  return mergeAll(parts);
}

const WING_SPAN = 14.5;
export function createDropship(seed = 1, opts = {}) {
  const rng = new RNG(seed * 61 + 5);
  const root = new THREE.Group(); root.name = 'Dropship';
  const body = new THREE.Group(); root.add(body);
  const mShell = shellMat(), mFlesh = fleshMat(), mGlow = glowMat(3.4), mGlowDim = glowMat(1.6), mInner = fleshMat({ tint: 0x303840 });
  const mFlame = flameMat({ power: 1.0, fall: 1.9, rim: 0.9, seed }), mCore = flameMat({ power: 1.4, fall: 2.6, rim: 0.5, seed: seed + 1 });
  // static geometry is baked into one mesh per material (draw-call budget); animated bits stay separate
  const st = { shell: [], flesh: [], glow: [], dim: [], inner: [] }; const mats = { shell: mShell, flesh: mFlesh, glow: mGlow, dim: mGlowDim, inner: mInner };
  const S = (g, key, off = null) => { if (off) g.translate(off[0], off[1], off[2]); st[key].push(g); return g; };
  const add = (g, m, parent = body, shadow = true) => { const me = new THREE.Mesh(g, m); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me; };
  // fuselage (flesh) + dorsal carapace plates (shell)
  S(fuselageGeo(), 'flesh');
  { const prof = (z) => { const s = (z + 14) / 14 - 1; const w = s > 0 ? Math.pow(Math.max(0, 1 - Math.pow(s, 2.0)), 0.62) : 0.28 + 0.72 * Math.pow(Math.max(0, 1 - Math.pow(-s, 2.2)), 0.55); return 4.6 * w * (1 + 0.1 * gauss(s + 0.15, 0.3)); };
    const g = surface(seg(26, 12), 22, (u, v, o) => {
      const z = lerp(10.8, -9.5, v), R = prof(z), th = lerp(-1.2, 1.2, u);
      const hump = 1 + 0.12 * gauss(th, 0.35) * ((z + 14) / 14 - 1 > -0.6 ? 1 : 0.2);
      const edge = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.35) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, v))), 0.4);
      const lift = 0.05 + 0.22 * edge + 0.07 * Math.pow(Math.abs(Math.sin(v * 24)), 4) * edge;
      const r = R * hump + lift; o.set(Math.sin(th) * r, Math.cos(th) * r * 0.62, z);
    }, { uvScale: [3, 5] });
    S(orient(g, 0, 0, 0), 'shell'); }
  for (const side of [-1, 1]) { S(wingSurface(true, side), 'shell'); S(wingSurface(false, side), 'flesh'); }
  // leading-edge bone spars, spurs, wing-tip lights
  for (const side of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; const x = 2.6 + u * WING_SPAN; const z = 8.0 - 15.5 * Math.pow(u, 1.25); pts.push(new V3(side * x, -0.032 * Math.pow(x - 2.6, 1.8) - 0.2, z)); }
    S(tube(pts, [0.45, 0.42, 0.38, 0.34, 0.3, 0.26, 0.22, 0.18, 0.14, 0.1, 0.04], { radial: 6, segsPerPoint: 2 }), 'shell');
    for (let i = 2; i <= 9; i += 2) { const p = pts[i]; const sp = spike(1.2 + (9 - i) * 0.05, 0.18, 5); place(sp, [p.x, p.y, p.z], new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(side * 0.35, -0.2, 1).normalize())); S(sp, 'shell'); }
    const tp = pts[10]; const tl = new THREE.SphereGeometry(0.3, 8, 6); tl.translate(tp.x, tp.y, tp.z + 0.2); S(tl, 'glow');
    // radial rib lines (flesh tendons) on the underside of each wing
    for (let k = 1; k <= 4; k++) { const rp = []; for (let i = 0; i <= 6; i++) { const u = i / 6 * 0.9; const x = 2.6 + u * WING_SPAN; const zle = 8.0 - 15.5 * Math.pow(u, 1.25), zte = -9.5 - 3.5 * u; rp.push(new V3(side * x, -0.032 * Math.pow(x - 2.6, 1.8) - 0.75 - 0.1 * (1 - u), lerp(zle, zte, k / 5))); } S(tube(rp, 0.1, { radial: 4, segsPerPoint: 2 }), 'shell'); }
  }
  // glowing visor + brow ring + mandibles + dorsal spines at the nose
  { const vis = blob(2.5, 0.42, 1.5, { w: 16, h: 8, tile: 4 }); vis.translate(0, 1.15, 9.4); S(vis, 'glow');
    const rim = torus(1.0, 0.16, 18, 6, { tile: 1 }); rim.scale(2.6, 1, 1.2); rim.translate(0, 1.18, 9.5); S(rim, 'shell');
    for (const sx of [-1, 1]) { const pts = [new V3(sx * 1.4, -0.6, 11), new V3(sx * 1.9, -1.0, 13.2), new V3(sx * 1.2, -0.9, 15.5), new V3(sx * 0.35, -0.5, 16.2)]; S(tube(pts, [0.45, 0.36, 0.22, 0.03], { radial: 6, segsPerPoint: 4 }), 'shell'); }
    for (let i = 0; i < 5; i++) { const sp = spike(1.0 + 0.15 * (i % 3), 0.18, 5); sp.scale(0.7, 1, 1); place(sp, [0, 1.8 + 0.1 * (i % 2), 7.4 - i * 2.4], new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(0, 1, -0.5).normalize())); S(sp, 'shell'); } }
  // wasp stinger tail (segmented, glowing tip)
  { const pts = [new V3(0, 0.1, -12), new V3(0, 0.4, -16), new V3(0, 1.3, -20), new V3(0, 2.8, -23.5)]; const rr = [1.5, 1.1, 0.7, 0.05];
    S(tube(pts, rr, { radial: 8, segsPerPoint: 6 }), 'flesh');
    for (let k = 1; k <= 5; k++) { const t = k / 6; const c = new THREE.CatmullRomCurve3(pts).getPoint(t); const R = lerp(1.5, 0.15, Math.pow(t, 0.9)) * 1.18; const rg = torus(R, R * 0.13, 14, 5, { tile: 0.8 }); rg.rotateX(Math.PI / 2 - 0.2 * t); rg.translate(c.x, c.y, c.z); S(rg, 'shell'); }
    const tip = new THREE.SphereGeometry(0.28, 8, 6); tip.translate(0, 2.8, -23.6); S(tip, 'glow'); }
  // abdomen bay (open at the rear): baked into static meshes (offset = bay origin)
  const BAY = [0, -0.8, -3.0], bayLen = 11;
  { const outer = revolve(bayLen, (t) => 2.6 * (t < 0.18 ? Math.sqrt(Math.max(0, 1 - Math.pow(1 - t / 0.18, 2))) : 1) * (1 - 0.1 * Math.pow(t, 3)), { rings: 10, radial: seg(24, 12), tile: 4, ratio: 0.74 }); outer.rotateX(-Math.PI / 2); S(outer, 'flesh', BAY);
    const inner = revolve(bayLen - 0.1, (t) => 2.42 * (1 - 0.1 * Math.pow(t, 3)), { rings: 5, radial: seg(24, 12), tile: 4, ratio: 0.74 }); inner.rotateX(-Math.PI / 2); inner.translate(0, 0, -0.05);
    { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } inner.index.needsUpdate = true; smoothNormals(inner); }
    S(inner, 'inner', BAY);
    for (const a of [-0.8, 0.8]) { const pts = []; for (let i = 0; i <= 8; i++) { const z = -1.5 - i * 1.15; const r = 2.38 * (1 - 0.1 * Math.pow(-z / bayLen, 3)); pts.push(new V3(Math.sin(a) * r, -Math.cos(a) * r * 0.74, z)); } S(tube(pts, 0.07, { radial: 4, segsPerPoint: 2 }), 'dim', BAY); }
    const floor = new THREE.PlaneGeometry(3.6, bayLen - 1.5); floor.rotateX(-Math.PI / 2); floor.translate(0, -1.55, -bayLen / 2 - 0.3); S(floor, 'inner', BAY);
    const mg = new THREE.CircleGeometry(0.5, 10); mg.translate(0, 0.3, -1.0); S(mg, 'dim', BAY); }
  // nacelles: housings baked static, flames (+ halo) animated per nacelle
  const nacs = [];
  for (const [x, y, z, r, len] of [[4.7, 0.55, -8.5, 1.5, 5.5], [-4.7, 0.55, -8.5, 1.5, 5.5], [8.4, -0.9, -9.0, 0.95, 3.8], [-8.4, -0.9, -9.0, 0.95, 3.8]]) {
    S(nacelle(r, len), 'shell', [x, y, z]);
    const ring = torus(r * 1.02, r * 0.1, 16, 5, { tile: 1 }); ring.translate(x, y, z - len * 0.9); S(ring, 'flesh');
    const disc = new THREE.CircleGeometry(r * 0.88, 14); disc.rotateY(Math.PI); disc.translate(x, y, z - len * 0.85); S(disc, 'glow');
    const fl = len * 3.2; const grp = new THREE.Group(); grp.position.set(x, y, z - len * 0.85); body.add(grp);
    const g1 = new THREE.CylinderGeometry(r * 0.25, r * 0.9, fl, 14, 1, true); g1.rotateX(-Math.PI / 2); g1.translate(0, 0, -fl / 2);
    const g2 = new THREE.ConeGeometry(r * 0.5, fl * 0.55, 10, 1, true); g2.rotateX(-Math.PI / 2); g2.translate(0, 0, -fl * 0.275);
    const c1 = add(g1, mFlame, grp, false), c2 = add(g2, mCore, grp, false); c1.frustumCulled = c2.frustumCulled = false;
    const halo = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.5 })); halo.position.set(0, 0, -0.5); halo.scale.setScalar(r * 4.0); grp.add(halo);
    nacs.push({ grp, c1, c2, halo, r });
  }
  // ramp door hinged at the lower rear edge (animated)
  const HY = 1.98; const hinge = new THREE.Group(); hinge.position.set(BAY[0], BAY[1] - HY, BAY[2] - bayLen); body.add(hinge);
  { const d = new THREE.CircleGeometry(1, seg(24, 12)); d.scale(2.68, HY, 1); d.rotateY(Math.PI); d.translate(0, HY, 0.08);
    const mDoor = mShell.clone(); mDoor.side = THREE.DoubleSide; const dm = new THREE.Mesh(d, mDoor); dm.castShadow = true; hinge.add(dm);
    const rim = new THREE.TorusGeometry(1, 0.05, 6, seg(28, 14)); rim.scale(2.68, HY, 1); rim.translate(0, HY, 0.06); scaleUV(rim, 6, 1); add(rim, mShell, hinge);
    const strip = new THREE.PlaneGeometry(2.6, 0.18); strip.rotateY(Math.PI); strip.translate(0, 1.0, -0.02); add(strip, mGlowDim, hinge, false); }
  // crawler silhouettes in the bay: two merged meshes (bodies, eyes)
  const crawlers = new THREE.Group(); crawlers.position.set(BAY[0], BAY[1], BAY[2]); body.add(crawlers);
  if (opts.crawlers !== false) {
    const cg = crawlerSil(rng), cgs = [], egs = [];
    for (let i = 0; i < 8; i++) {
      const row = i % 4, col = Math.floor(i / 4); const sc = rng.range(0.9, 1.2), yaw = Math.PI + (rng.next() - 0.5) * 0.5;
      const m = new THREE.Matrix4().compose(new V3((col ? 1 : -1) * 0.95, -1.5, -2.2 - row * 2.1), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), yaw), new V3(sc, sc, sc));
      cgs.push(cg.clone().applyMatrix4(m)); for (const sx of [-1, 1]) { const e = new THREE.SphereGeometry(0.055, 5, 4); e.translate(sx * 0.14, 0.7, 0.45); e.applyMatrix4(m); egs.push(e); }
    }
    const cm = add(mergeAll(cgs), fleshMat({ tint: 0x10161c }), crawlers, false), em = add(mergeAll(egs), mGlow, crawlers, false); cm.castShadow = false;
  }
  for (const k in st) if (st[k].length) { const me = new THREE.Mesh(mergeAll(st[k]), mats[k]); me.castShadow = k !== 'glow' && k !== 'dim'; me.receiveShadow = true; me.name = 'ds_' + k; body.add(me); }
  const state = { thrust: 0.5, hatch: 0, tilt: 0, infect: 0, hatchS: 0 };
  const ds = {
    root, size: 26, update(dt, t) {
      state.hatchS = damp(state.hatchS, state.hatch, 4, dt || 0.016);
      hinge.rotation.x = -state.hatchS * 1.5;
      const fl = 0.93 + 0.07 * Math.sin(t * 31) * Math.sin(t * 11);
      mFlame.uniforms.uPower.value = (0.1 + state.thrust * 0.9) * fl; mCore.uniforms.uPower.value = state.thrust * 1.3 * fl;
      for (const n of nacs) { n.c1.scale.set(1, 1, 0.45 + state.thrust * 0.9); n.c2.scale.set(1, 1, 0.4 + state.thrust * 1.0); n.halo.material.opacity = 0.1 + state.thrust * 0.35; n.grp.rotation.x = -state.tilt * 0.5 * (n.r > 1.2 ? 1 : 0.6); }
      body.rotation.z = Math.sin(t * 1.1 + seed) * 0.02; body.position.y = Math.sin(t * 1.6 + seed * 3) * 0.12;
      crawlers.visible = state.hatchS > 0.2;
      mGlow.emissiveIntensity = 3.2 + 0.4 * Math.sin(t * 2.3);
    },
    setThrust(v) { state.thrust = clamp(v, 0, 1); }, openHatch(v) { state.hatch = clamp(v, 0, 1); }, setTilt(v) { state.tilt = clamp(v, -1, 1); },
    setInfection(a) { state.infect = a; infectAll(root, a); }, dispose() { disposeTree(root); },
  };
  ds.update(0.016, 0);
  return ds;
}
