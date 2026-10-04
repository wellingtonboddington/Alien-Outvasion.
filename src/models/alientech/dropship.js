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
function wingSurface(top, side, span = 13.5) {
  const nu = seg(16, 8), nv = seg(14, 7);
  const fn = (u, v, o) => {
    const x0 = 2.6, x = x0 + u * span;
    const zle = 7.5 - 14.5 * Math.pow(u, 1.25), zte = -9.5 - 3.5 * u;
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

export function createDropship(seed = 1, opts = {}) {
  const rng = new RNG(seed * 61 + 5);
  const root = new THREE.Group(); root.name = 'Dropship';
  const body = new THREE.Group(); root.add(body);
  const mShell = shellMat(), mFlesh = fleshMat(), mGlow = glowMat(3.4), mGlowDim = glowMat(1.6);
  const mFlame = flameMat({ power: 1.0, fall: 1.9, rim: 0.9, seed }), mCore = flameMat({ power: 1.4, fall: 2.6, rim: 0.5, seed: seed + 1 });
  const add = (g, m, parent = body, shadow = true) => { const me = new THREE.Mesh(g, m); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me; };
  // fuselage: flesh underside + bone plates on top
  add(fuselageGeo(), mFlesh);
  { // dorsal carapace plates (surface over the top of the fuselage)
    const prof = (z) => { const s = (z + 14) / 14 - 1; const w = s > 0 ? Math.pow(Math.max(0, 1 - Math.pow(s, 2.0)), 0.62) : 0.28 + 0.72 * Math.pow(Math.max(0, 1 - Math.pow(-s, 2.2)), 0.55); return 4.6 * w * (1 + 0.1 * gauss(s + 0.15, 0.3)); };
    const g = surface(seg(26, 12), 22, (u, v, o) => {
      const z = lerp(10.8, -9.5, v), R = prof(z), th = lerp(-1.2, 1.2, u);
      const hump = 1 + 0.12 * gauss(th, 0.35) * ((z + 14) / 14 - 1 > -0.6 ? 1 : 0.2);
      const edge = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.35) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, v))), 0.4);
      const lift = 0.05 + 0.22 * edge + 0.07 * Math.pow(Math.abs(Math.sin(v * 24)), 4) * edge;
      const r = R * hump + lift; o.set(Math.sin(th) * r, Math.cos(th) * r * 0.62, z);
    }, { uvScale: [3, 5] });
    add(orient(g, 0, 0, 0), mShell);
  }
  for (const side of [-1, 1]) { add(wingSurface(true, side), mShell); add(wingSurface(false, side), mFlesh); }
  // wing-edge bone ribs / spurs along the leading edge
  for (const side of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; const x = 2.6 + u * 13.5; const z = 7.5 - 14.5 * Math.pow(u, 1.25); pts.push(new V3(side * x, -0.032 * Math.pow(x - 2.6, 1.8) - 0.2, z)); }
    add(tube(pts, [0.45, 0.42, 0.38, 0.34, 0.3, 0.26, 0.22, 0.18, 0.14, 0.1, 0.04], { radial: 7, segsPerPoint: 3 }), mShell);
    for (let i = 2; i <= 9; i += 2) { const p = pts[i]; const sp = spike(1.2 + (9 - i) * 0.05, 0.18, 5); place(sp, [p.x, p.y, p.z], new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(side * 0.35, -0.2, 1).normalize())); add(sp, mShell); }
    // wing-tip glow lights
    const tp = pts[10]; const tl = new THREE.SphereGeometry(0.28, 10, 8); tl.translate(tp.x, tp.y, tp.z + 0.2); add(tl, mGlow, body, false);
  }
  // visor, brow and mandibles at the nose
  { const vis = blob(2.5, 0.42, 1.5, { w: 18, h: 8, tile: 4 }); vis.translate(0, 1.15, 9.4); add(vis, mGlow, body, false);
    const rim = torus(1.0, 0.16, 20, 6, { tile: 1 }); rim.scale(2.6, 1, 1.2); rim.translate(0, 1.18, 9.5); add(rim, mShell);
    for (const sx of [-1, 1]) { const pts = [new V3(sx * 1.4, -0.6, 11), new V3(sx * 1.9, -1.0, 13.2), new V3(sx * 1.2, -0.9, 15.5), new V3(sx * 0.35, -0.5, 16.2)]; add(tube(pts, [0.45, 0.36, 0.22, 0.03], { radial: 7, segsPerPoint: 5 }), mShell); }
    for (let i = 0; i < 5; i++) { const sp = spike(1.0 + 0.15 * (i % 3), 0.18, 5); sp.scale(0.7, 1, 1); place(sp, [0, 1.8 + 0.1 * (i % 2), 7.4 - i * 2.4], new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(0, 1, -0.5).normalize())); add(sp, mShell); } }
  // abdomen bay (open at the rear) with ramp door
  const bayLen = 11, bay = new THREE.Group(); bay.position.set(0, -0.8, -3.0); body.add(bay);
  { const outer = revolve(bayLen, (t) => 2.6 * (t < 0.18 ? Math.sqrt(Math.max(0, 1 - Math.pow(1 - t / 0.18, 2))) : 1) * (1 - 0.1 * Math.pow(t, 3)), { rings: 14, radial: seg(28, 12), tile: 4, ratio: 0.74 }); outer.rotateX(-Math.PI / 2); add(outer, mFlesh, bay);
    const inner = revolve(bayLen - 0.1, (t) => 2.42 * (1 - 0.1 * Math.pow(t, 3)), { rings: 6, radial: seg(28, 12), tile: 4, ratio: 0.74 }); inner.rotateX(-Math.PI / 2); inner.translate(0, 0, -0.05);
    { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } inner.index.needsUpdate = true; smoothNormals(inner); }
    const mInner = fleshMat({ tint: 0x303840 }); add(inner, mInner, bay, false);
    // interior glow strips and floor
    for (const a of [-0.8, 0.8]) { const pts = []; for (let i = 0; i <= 8; i++) { const z = -1.5 - i * 1.15; const r = 2.38 * (1 - 0.1 * Math.pow(-z / bayLen, 3)); pts.push(new V3(Math.sin(a) * r, 0.0 - Math.cos(a) * r * 0.74 + 0.0 + 1.0 * 0, z)); } add(tube(pts, 0.07, { radial: 4, segsPerPoint: 2 }), mGlowDim, bay, false); }
    const floor = new THREE.PlaneGeometry(3.6, bayLen - 1.5); floor.rotateX(-Math.PI / 2); floor.translate(0, -1.55, -bayLen / 2 - 0.3); add(floor, mInner, bay, false);
    const mg = new THREE.CircleGeometry(0.5, 12); mg.translate(0, 0.3, -1.0); add(mg, mGlowDim, bay, false);
  }
  // ramp door hinged at the lower rear edge
  const HY = 1.98; const hinge = new THREE.Group(); hinge.position.set(0, -HY, -bayLen); bay.add(hinge);
  { const d = new THREE.CircleGeometry(1, seg(28, 12)); d.scale(2.68, HY, 1); d.rotateY(Math.PI); d.translate(0, HY, 0.08);
    const mDoor = mShell.clone(); mDoor.side = THREE.DoubleSide; const dm = new THREE.Mesh(d, mDoor); dm.castShadow = true; hinge.add(dm);
    const rim = new THREE.TorusGeometry(1, 0.05, 6, seg(32, 14)); rim.scale(2.68, HY, 1); rim.translate(0, HY, 0.06); scaleUV(rim, 6, 1); add(rim, mShell, hinge);
    const strip = new THREE.PlaneGeometry(2.6, 0.18); strip.rotateY(Math.PI); strip.translate(0, 1.0, -0.02); add(strip, mGlowDim, hinge, false); }
  // crawler silhouettes in the bay
  const crawlers = [];
  if (opts.crawlers !== false) {
    const cg = crawlerSil(rng); const mc = fleshMat({ tint: 0x10161c });
    const eg = new THREE.SphereGeometry(0.05, 6, 4);
    for (let i = 0; i < 8; i++) { const c = new THREE.Group(); const m = new THREE.Mesh(cg, mc); c.add(m); for (const sx of [-1, 1]) { const e = new THREE.Mesh(eg, mGlow); e.position.set(sx * 0.14, 0.7, 0.45); c.add(e); }
      const row = i % 4, col = Math.floor(i / 4); c.position.set((col ? 1 : -1) * 0.95, -1.5, -2.2 - row * 2.1); c.rotation.y = Math.PI + (rng.next() - 0.5) * 0.5; c.scale.setScalar(rng.range(0.9, 1.2)); bay.add(c); crawlers.push(c); }
  }
  // nacelles with flames (VTOL tilt)
  const nacs = [];
  for (const [x, y, z, r, len] of [[4.7, 0.55, -8.5, 1.5, 5.5], [-4.7, 0.55, -8.5, 1.5, 5.5], [8.4, -0.9, -9.0, 0.95, 3.8], [-8.4, -0.9, -9.0, 0.95, 3.8]]) {
    const grp = new THREE.Group(); grp.position.set(x, y, z); body.add(grp);
    add(nacelle(r, len), mShell, grp); const ring = torus(r * 1.02, r * 0.1, 18, 5, { tile: 1 }); ring.rotateX(Math.PI / 2); ring.rotateX(-Math.PI / 2); ring.translate(0, 0, -len * 0.9); add(ring, mFlesh, grp);
    const disc = new THREE.CircleGeometry(r * 0.88, 16); disc.rotateY(Math.PI); disc.translate(0, 0, -len * 0.85); add(disc, mGlow, grp, false);
    const fl = len * 3.2; const g1 = new THREE.CylinderGeometry(r * 0.25, r * 0.9, fl, 16, 1, true); g1.rotateX(-Math.PI / 2); g1.translate(0, 0, -fl / 2);
    const c1 = add(g1, mFlame, grp, false); c1.position.z = -len * 0.85;
    const g2 = new THREE.ConeGeometry(r * 0.5, fl * 0.55, 12, 1, true); g2.rotateX(-Math.PI / 2); g2.translate(0, 0, -fl * 0.275);
    const c2 = add(g2, mCore, grp, false); c2.position.z = -len * 0.85;
    const halo = new THREE.Sprite(haloMat({ color: CYAN, opacity: 0.5 })); halo.position.set(0, 0, -len * 0.9 - 0.4); halo.scale.setScalar(r * 4.0); grp.add(halo);
    nacs.push({ grp, c1, c2, halo, r });
  }
  root.traverse((o) => { if (o.isMesh && (o.material === mFlame || o.material === mCore)) o.frustumCulled = false; });
  const st = { thrust: 0.5, hatch: 0, tilt: 0, infect: 0, hatchS: 0 };
  const ds = {
    root, size: 26, update(dt, t) {
      st.hatchS = damp(st.hatchS, st.hatch, 4, dt || 0.016);
      hinge.rotation.x = -st.hatchS * 1.5;
      const fl = 0.93 + 0.07 * Math.sin(t * 31) * Math.sin(t * 11);
      mFlame.uniforms.uPower.value = (0.1 + st.thrust * 0.9) * fl; mCore.uniforms.uPower.value = st.thrust * 1.3 * fl;
      for (const n of nacs) { n.c1.scale.set(1, 1, 0.45 + st.thrust * 0.9); n.c2.scale.set(1, 1, 0.4 + st.thrust * 1.0); n.halo.material.opacity = 0.1 + st.thrust * 0.35; n.grp.rotation.x = 0.0 - st.tilt * 0.5 * (n.r > 1.2 ? 1 : 0.6); }
      body.rotation.z = Math.sin(t * 1.1 + seed) * 0.02; body.position.y = Math.sin(t * 1.6 + seed * 3) * 0.12;
      const vis = clamp((st.hatchS - 0.15) * 3, 0, 1);
      for (let i = 0; i < crawlers.length; i++) { crawlers[i].visible = vis > 0.01; crawlers[i].position.y = -1.5 + Math.abs(Math.sin(t * 3 + i * 1.7)) * 0.04 * vis; }
      mGlow.emissiveIntensity = 3.2 + 0.4 * Math.sin(t * 2.3);
    },
    setThrust(v) { st.thrust = clamp(v, 0, 1); }, openHatch(v) { st.hatch = clamp(v, 0, 1); }, setTilt(v) { st.tilt = clamp(v, -1, 1); },
    setInfection(a) { st.infect = a; infectAll(root, a); }, dispose() { disposeTree(root); },
  };
  ds.update(0.016, 0);
  return ds;
}
