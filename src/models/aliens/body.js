// Vessari body geometry: builds every mesh in rest-pose rig space, skins it to the rig and merges per material.
import * as THREE from 'three';
import { seg, RNG } from '../../engine/common.js';
import { V3, loft, sweep, seg2, blob, spike, place, mirrorX, surfacePlate, makeProbe, conformStrip, rayHit, bindRigid, bindAlong, bindFn, mergeSkinned, sstep } from './util.js';
import { buildRig, DIM, SPINE, DEG, HEAD_SCALE } from './rig.js';

const J = (a) => (Array.isArray(a) ? new V3(a[0], a[1], a[2]) : a.clone());
const H0 = SPINE.head;
const hv = (x, y, z) => new V3(H0[0] + x, H0[1] + y, H0[2] + z); // head-local -> rig space
const SIDES = [['L', 1], ['R', -1]];

/** densify a joint chain into a smooth centreline with per-point radius. */
function chainPath(joints, radii, { sub = 4, bulge = [] } = {}) {
  const pts = [], r = [];
  for (let i = 0; i < joints.length - 1; i++) {
    const n = sub; for (let k = 0; k < (i === joints.length - 2 ? n + 1 : n); k++) {
      const t = k / n; pts.push(joints[i].clone().lerp(joints[i + 1], t)); const bl = bulge[i] || 0; r.push((radii[i] + (radii[i + 1] - radii[i]) * t) * (1 + bl * Math.sin(Math.PI * t)));
    }
  }
  return { pts, r };
}

/** torso cross-section profile (rig space) */
const TORSO = [
  { y: 1.22, rx: 0.17, rz: 0.12, cz: -0.01 }, { y: 1.32, rx: 0.20, rz: 0.14, cz: -0.01 }, { y: 1.42, rx: 0.165, rz: 0.125, cz: 0.0 }, { y: 1.54, rx: 0.19, rz: 0.15, cz: 0.02 },
  { y: 1.66, rx: 0.23, rz: 0.185, cz: 0.035 }, { y: 1.78, rx: 0.27, rz: 0.20, cz: 0.05 }, { y: 1.88, rx: 0.235, rz: 0.17, cz: 0.06 }, { y: 1.96, rx: 0.14, rz: 0.12, cz: 0.08 }, { y: 2.04, rx: 0.085, rz: 0.085, cz: 0.105 },
];
function torsoAt(y) {
  let i = 0; while (i < TORSO.length - 2 && y > TORSO[i + 1].y) i++; const a = TORSO[i], b = TORSO[i + 1]; const t = Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y)));
  return { rx: a.rx + (b.rx - a.rx) * t, rz: a.rz + (b.rz - a.rz) * t, cz: a.cz + (b.cz - a.cz) * t, dr: (b.rx - a.rx) / (b.y - a.y) };
}
/** surface of torso at height y, angle aF from the front (rad, + toward +x) */
function torsoSurf(y, aF, out) {
  const T = torsoAt(y); const s = Math.sin(aF), c = Math.cos(aF); out.p.set(s * T.rx, y, T.cz + c * T.rz); out.n.set(s / T.rx, -T.dr * 0.6, c / T.rz).normalize(); return out;
}

/** plate that wraps part of a conical limb */
function wrapPlate(a, b, r0, r1, { center = 0, span = 2.0, out = new V3(1, 0, 0), thick = 0.015, lift = 0.0, nu = 8, nv = 6, tile = 0.4, taperEnds = 1.6, belly = 0.5, start = 0, end = 1 } = {}) {
  const ax = b.clone().sub(a); const L = ax.length(); ax.normalize(); const e1 = out.clone().addScaledVector(ax, -out.dot(ax)).normalize(); const e2 = new V3().crossVectors(ax, e1);
  const fn = (u, v) => { const t = start + (end - start) * (u * 0.5 + 0.5); const phi = center + v * span / 2; const r = r0 + (r1 - r0) * t + lift; const dir = e1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(e2, Math.sin(phi)); return { p: a.clone().addScaledVector(ax, t * L).addScaledVector(dir, r), n: dir }; };
  const th = (u, v) => thick * (Math.pow(1 - Math.pow(Math.abs(u), taperEnds * 2), 0.8)) * Math.pow(Math.max(0, 1 - v * v), 0.55) * (1 - belly * 0.3 + belly * 0.3 * (1 - Math.abs(u))) + 0.002;
  return surfacePlate(fn, th, { nu, nv, tile });
}

export function buildBody(kind, seed, mats) {
  const rig = buildRig(kind);
  const rng = new RNG(seed * 7919 + 13); const B = rig.idx; const rest = rig.rest;
  const isH = kind === 'hierarch', isO = kind === 'officer', isD = kind === 'drone';
  const bk = { skin: [], shell: [], glow: [], mouth: [], dark: [], membrane: [] };
  const probes = {}; // for conform
  const add = (bucket, g) => { if (g) bk[bucket].push(g); return g; };
  const spine = [new V3(...SPINE.pelvis), new V3(...SPINE.spine0), new V3(...SPINE.spine1), new V3(...SPINE.spine2), new V3(...SPINE.neck0), new V3(...SPINE.neck1), new V3(...SPINE.head), new V3(H0[0], H0[1] + 0.2, H0[2] + 0.02)];
  const spineBones = [B.pelvis, B.spine0, B.spine1, B.spine2, B.neck0, B.neck1, B.head];
  const spineSkin = (g, blend = 0.07) => bindAlong(g, spine, spineBones, blend);

  // ======================= TORSO (skin) =======================
  {
    const secs = TORSO.map((s) => ({ t: s.y, rx: s.rx * (isH ? 1.04 : isD ? 0.96 : 1), ry: s.rz, cy: s.cz, power: 2.2 }));
    const g = loft(secs, { axis: 'y', radial: 28, tile: 0.3 }); add('skin', spineSkin(g, 0.08));
  }
  // neck
  {
    const joints = [new V3(0, 1.88, 0.07), new V3(0, 1.98, 0.10), new V3(0, 2.09, 0.145), new V3(0, 2.20, 0.19)];
    const g = sweep(joints, [0.092, 0.07, 0.058, 0.064], [0.08, 0.066, 0.056, 0.06], { radial: 12, samples: 14, round: 0, tile: 0.2 }); add('skin', spineSkin(g, 0.05));
  }
  // pelvis/hip blobs and groin
  for (const [S, s] of SIDES) { const g = blob([DIM.hipX * s, 1.32, -0.02], 0.14, 0.14, 0.14, { w: 14, h: 10 }); bindRigid(g, B['thigh_' + S]); add('skin', g); }

  // ======================= LEGS =======================
  for (const [S, s] of SIDES) {
    const L = rest.leg[S]; const joints = [L.hip, L.knee, L.hock, L.ball];
    const cp = chainPath(joints, [0.145, 0.082, 0.052, 0.040], { sub: 5, bulge: [0.14, 0.34, 0.0] });
    const g = sweep(cp.pts, cp.r, cp.r.map((r) => r * 0.95), { radial: 12, round: 2, tile: 0.25, up: new V3(1, 0, 0) });
    add('skin', bindAlong(g, joints.concat([L.ball.clone().add(new V3(0, -0.02, 0.1))]), [B['thigh_' + S], B['shin_' + S], B['meta_' + S]], 0.08));
    // knee cap + hock bulge (skin)
    const kb = blob(L.knee.clone().add(new V3(0, 0.0, 0.03)), 0.062, 0.07, 0.066, { w: 12, h: 8 }); bindAlong(kb, joints, [B['thigh_' + S], B['shin_' + S], B['meta_' + S]], 0.05); add('skin', kb);
    const hb = blob(L.hock.clone().add(new V3(0, 0, -0.015)), 0.05, 0.056, 0.055, { w: 12, h: 8 }); bindAlong(hb, joints, [B['thigh_' + S], B['shin_' + S], B['meta_' + S]], 0.05); add('skin', hb);
    // toes: three forward + a short rear spur
    const toeDirs = [[0, 0], [0.42, 0.17], [-0.42, 0.17]];
    for (const [ang, shortenBy] of toeDirs) {
      const d = new V3(Math.sin(ang * s * 0.9 + 0.0) * 1, 0, Math.cos(ang)); d.normalize(); const len = 0.175 - shortenBy * 0.7;
      const p0 = L.ball.clone().add(new V3(0, -0.005, -0.015)), p1 = p0.clone().addScaledVector(d, len * 0.5).add(new V3(0, -0.006, 0)), p2 = p0.clone().addScaledVector(d, len).add(new V3(0, -0.014, 0));
      const tg = sweep([p0, p1, p2], [0.036, 0.026, 0.016], [0.031, 0.021, 0.013], { radial: 7, samples: 6, round: 2, tile: 0.2, up: new V3(0, 1, 0) }); bindRigid(tg, B['toe_' + S]); add('skin', tg);
      const cl = spike(p2.clone().add(new V3(0, 0.002, -0.008)), p2.clone().addScaledVector(d, 0.045).add(new V3(0, -0.018, 0)), 0.015, { radial: 5 }); bindRigid(cl, B['toe_' + S]); add('shell', cl);
    }
    const pad = blob(L.ball.clone().add(new V3(0, -0.004, 0.01)), 0.038, 0.032, 0.045, { w: 10, h: 7 }); bindRigid(pad, B['toe_' + S]); add('skin', pad);
    // hock spur (bone) pointing back-up
    const spur = spike(L.hock.clone().add(new V3(0, 0.0, -0.04)), L.hock.clone().add(new V3(0, 0.07, -0.15)), 0.026, { radial: 6, curve: 0.5, bend: new V3(0, 0.6, 0) }); bindRigid(spur, B['meta_' + S]); add('shell', spur);
    // ---- leg armour ----
    if (!isD) {
      const tp = wrapPlate(L.hip.clone().add(new V3(0, -0.06, 0)), L.knee, 0.108, 0.066, { center: 0, span: 1.9, out: new V3(s, 0, 0.1), thick: 0.026, end: 0.92, nu: 8, nv: 6 }); bindRigid(tp, B['thigh_' + S]); add('shell', tp);
      const sp = wrapPlate(L.knee, L.hock, 0.062, 0.044, { center: 0, span: 1.5, out: new V3(0.2 * s, 0, 1), thick: 0.02, start: 0.05, end: 0.95, nu: 8, nv: 5 }); bindRigid(sp, B['shin_' + S]); add('shell', sp);
      const ks = spike(L.knee.clone().add(new V3(0, 0.0, 0.075)), L.knee.clone().add(new V3(0.0, 0.07, 0.19)), 0.032, { radial: 6, curve: 0.5, bend: new V3(0, 0.5, 0.3) }); bindRigid(ks, B['thigh_' + S]); add('shell', ks);
      const kd = new THREE.SphereGeometry(0.07, seg(14, 8), seg(8, 5), 0, Math.PI * 2, 0, 1.2); kd.scale(0.9, 0.95, 1.0); kd.rotateX(Math.PI / 2 * 0.9); kd.translate(L.knee.x, L.knee.y + 0.005, L.knee.z + 0.04); bindRigid(kd, B['shin_' + S]); add('shell', kd);
      const mp = wrapPlate(L.hock, L.ball, 0.044, 0.036, { center: 0, span: 1.3, out: new V3(0, 0.3, 1), thick: 0.014, start: 0.12, end: 0.88, nu: 6, nv: 4 }); bindRigid(mp, B['meta_' + S]); add('shell', mp);
    }
  }

  // ======================= ARMS + HANDS =======================
  const armSets = isH ? [['', 1.0], ['2', 0.74]] : [['', 1.0]];
  for (const [sfx, sc] of armSets) for (const [S, s] of SIDES) {
    const A = rest.arm[sfx + S]; const joints = [A.sh, A.elbow, A.wrist, A.wrist.clone().add(new V3(0, -0.11 * sc, 0.0))];
    const bonesA = [B['uarm' + sfx + '_' + S], B['farm' + sfx + '_' + S], B['hand' + sfx + '_' + S]];
    const cp = chainPath(joints, [0.084 * sc, 0.058 * sc, 0.044 * sc, 0.044 * sc], { sub: 5, bulge: [0.18, 0.22, 0.0] });
    const g = sweep(cp.pts, cp.r, cp.r.map((r) => r * 0.92), { radial: 11, round: 2, tile: 0.22, up: new V3(0, 0, 1) });
    // upper arm meets chest: pull clav bone in for first part
    add('skin', bindAlong(g, joints, bonesA, 0.07));
    const del = blob(A.sh.clone().add(new V3(0.01 * s, 0.0, 0)), 0.095 * sc, 0.095 * sc, 0.09 * sc, { w: 12, h: 8 }); bindRigid(del, B['clav' + sfx + '_' + S]); add('skin', del);
    const eb = blob(A.elbow, 0.05 * sc, 0.052 * sc, 0.05 * sc, { w: 10, h: 7 }); bindAlong(eb, joints, bonesA, 0.05); add('skin', eb);
    // palm
    const palm = blob(A.wrist.clone().add(new V3(0, -0.06 * sc, 0.0)), 0.034 * sc, 0.062 * sc, 0.05 * sc, { w: 10, h: 8 }); bindRigid(palm, B['hand' + sfx + '_' + S]); add('skin', palm);
    // fingers
    for (const d of A.digits) {
      const isT = d.n === 't'; const pts = [...d.rest, d.tip];
      const base = pts.map((p) => p.clone());
      const rr = isT ? [0.019, 0.016, 0.012, 0.0075] : [0.018, 0.015, 0.011, 0.007]; const rrr = rr.map((r) => r * sc);
      const cp2 = chainPath(base, rrr, { sub: 3 });
      const fg = sweep(cp2.pts, cp2.r, cp2.r.map((r) => r * 0.85), { radial: 7, round: 2, tile: 0.1, up: new V3(s, 0, 0) });
      const bn = [0, 1, 2].map((k) => B['f' + sfx + d.n + k + '_' + S]);
      add('skin', bindAlong(fg, base, bn, 0.02));
      const claw = spike(d.tip.clone().add(d.dirV.clone().multiplyScalar(-0.012 * sc)), d.tip.clone().addScaledVector(d.dirV, 0.05 * sc).add(new V3(-0.4 * s * 0.0, 0, 0.012)), 0.0075 * sc, { radial: 5, curve: 0.6, bend: new V3(-s * 0.2, 0, 0.4) });
      bindRigid(claw, bn[2]); add('shell', claw);
    }
    if (!isD) {
      // vambrace + upper arm band + elbow spike + pauldron lames
      const out = new V3(s, 0, -0.2);
      const vb = wrapPlate(A.elbow, A.wrist, 0.047 * sc, 0.036 * sc, { center: 0, span: 2.1, out, thick: 0.02 * sc, start: 0.08, end: 0.96, nu: 8, nv: 6 }); bindRigid(vb, B['farm' + sfx + '_' + S]); add('shell', vb);
      const ub = wrapPlate(A.sh.clone().addScaledVector(A.elbow.clone().sub(A.sh), 0.28), A.elbow.clone().addScaledVector(A.sh.clone().sub(A.elbow), 0.12), 0.064 * sc, 0.05 * sc, { center: 0.3, span: 2.6, out, thick: 0.014, nu: 6, nv: 5 }); bindRigid(ub, B['uarm' + sfx + '_' + S]); add('shell', ub);
      const es = spike(A.elbow.clone().add(new V3(0.03 * s, 0, -0.04)), A.elbow.clone().add(new V3(0.09 * s, 0.01, -0.14)), 0.026 * sc, { radial: 6, curve: 0.3, bend: new V3(0, 0.3, -0.3) }); bindRigid(es, B['farm' + sfx + '_' + S]); add('shell', es);
      if (sfx === '') {
        const nL = isO || isH ? 4 : 3;
        for (let i = 0; i < nL; i++) {
          const sg = new THREE.SphereGeometry(0.135 - i * 0.014, seg(18, 8), seg(8, 4), 0, Math.PI * 2, 0, 1.15 - i * 0.02); sg.scale(1.0, 0.72, 1.1);
          sg.rotateZ(-s * 0.55); sg.rotateX(-0.1); sg.translate(A.sh.x + s * (0.02 + i * 0.012), A.sh.y + 0.04 - i * 0.065, A.sh.z - 0.005 - i * 0.002);
          bindRigid(sg, B['clav' + sfx + '_' + S]); add('shell', sg);
        }
        const pt = spike(A.sh.clone().add(new V3(0.08 * s, 0.09, 0)), A.sh.clone().add(new V3(0.15 * s, 0.2, -0.03)), 0.03, { radial: 6, curve: 0.4, bend: new V3(0.2 * s, 0.4, -0.2) }); bindRigid(pt, B['clav' + sfx + '_' + S]); add('shell', pt);
      }
    }
  }

  // ======================= RIB ARMOUR / TORSO PLATES =======================
  const tmp = { p: new V3(), n: new V3() };
  if (!isD) {
    const ribYs = isH ? [1.52, 1.60, 1.68, 1.76] : [1.49, 1.57, 1.65, 1.73, 1.81];
    ribYs.forEach((y, ri) => {
      const hgt = 0.062 + ri * 0.003; const aMax = (112 - ri * 3) * DEG, aMin = (isH ? 16 : 10) * DEG; const th0 = 0.03 + ri * 0.002;
      for (const [S, s] of SIDES) {
        const fn = (u, v) => { torsoSurf(y + v * hgt / 2, s * (aMin + (u * 0.5 + 0.5) * (aMax - aMin)), tmp); return { p: tmp.p.clone(), n: tmp.n.clone() }; };
        const th = (u, v) => th0 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.6)), 0.7) * Math.pow(Math.max(0, 1 - v * v), 0.5) + 0.003;
        const g = surfacePlate(fn, th, { nu: 12, nv: 5, tile: 0.4 }); add('shell', bindAlong(g, spine, spineBones, 0.07));
      }
    });
    // sternum ridge
    { const fn = (u, v) => { torsoSurf(1.46 + (v * 0.5 + 0.5) * 0.46, u * 0.2, tmp); return { p: tmp.p.clone(), n: tmp.n.clone() }; };
      const th = (u, v) => 0.04 * Math.pow(Math.max(0, 1 - u * u), 0.6) * Math.pow(Math.max(0, Math.sin(Math.PI * (v * 0.5 + 0.5))), 0.5) + 0.004;
      add('shell', bindAlong(surfacePlate(fn, th, { nu: 5, nv: 12 }), spine, spineBones, 0.07)); }
    // collar gorget
    for (let i = 0; i < 2; i++) { const y = 1.95 + i * 0.045; const T = torsoAt(y); const g = loft([{ t: y - 0.03, rx: T.rx + 0.025 - i * 0.02, ry: T.rz + 0.025 - i * 0.02, cy: T.cz }, { t: y + 0.02, rx: T.rx + 0.034 - i * 0.02, ry: T.rz + 0.034 - i * 0.02, cy: T.cz, power: 2.2 }, { t: y + 0.06, rx: T.rx + 0.015 - i * 0.012, ry: T.rz + 0.015 - i * 0.012, cy: T.cz }], { axis: 'y', radial: 24, capStart: false, capEnd: false, tile: 0.4 }); add('shell', bindAlong(g, spine, spineBones, 0.06)); }
    // pelvic girdle plates (tassets)
    for (const [S, s] of SIDES) {
      for (let i = 0; i < 3; i++) {
        const y = 1.33 - i * 0.075; const fn = (u, v) => { const a = s * (0.15 + (u * 0.5 + 0.5) * 1.75); const rx = 0.178 + i * 0.012, rz = 0.126 + i * 0.012; return { p: new V3(Math.sin(a) * rx, y + v * 0.045, -0.01 + Math.cos(a) * rz), n: new V3(Math.sin(a) / rx, 0, Math.cos(a) / rz).normalize() }; };
        const th = (u, v) => 0.022 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.4)), 0.6) * Math.pow(Math.max(0, 1 - v * v), 0.5) + 0.003;
        const g = surfacePlate(fn, th, { nu: 10, nv: 4 }); bindRigid(g, B.pelvis); add('shell', g);
      }
    }
    // dorsal spines along the back
    const nS = isH ? 7 : 9;
    for (let i = 0; i < nS; i++) {
      const y = 1.36 + i * (0.62 / nS) + (i === nS - 1 ? 0 : 0); const T = torsoAt(Math.min(2.0, y)); const len = 0.05 + 0.05 * Math.sin((i / (nS - 1)) * Math.PI) * (isO ? 1.6 : 1) + (i > nS - 3 ? 0.03 : 0);
      const base = new V3(0, y, T.cz - T.rz + 0.005); const sp = spike(base, base.clone().add(new V3(0, 0.04 + len * 0.25, -len)), 0.017 + 0.004 * Math.sin((i / (nS - 1)) * Math.PI), { radial: 5, curve: 0.5, bend: new V3(0, 0.4, 0) });
      add('shell', bindAlong(sp, spine, spineBones, 0.07));
    }
  } else {
    // drone: fewer, cruder plates
    for (let i = 0; i < 3; i++) for (const [S, s] of SIDES) {
      const y = 1.5 + i * 0.1; const fn = (u, v) => { torsoSurf(y + v * 0.05, s * (0.2 + (u * 0.5 + 0.5) * 1.5), tmp); return { p: tmp.p.clone(), n: tmp.n.clone() }; };
      const th = (u, v) => 0.018 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.6)), 0.7) * Math.pow(Math.max(0, 1 - v * v), 0.5) + 0.002;
      add('shell', bindAlong(surfacePlate(fn, th, { nu: 8, nv: 4 }), spine, spineBones, 0.07));
    }
    for (let i = 0; i < 6; i++) { const y = 1.45 + i * 0.09; const T = torsoAt(y); const base = new V3(0, y, T.cz - T.rz); add('shell', bindAlong(spike(base, base.clone().add(new V3(0, 0.03, -0.07)), 0.014, { radial: 5 }), spine, spineBones, 0.07)); }
  }

  // ======================= RESPIRATOR ORGAN =======================
  {
    const c = new V3(0, 1.68, -0.15);
    const org = blob(c, 0.125, 0.19, 0.082, { w: 18, h: 12 }); bindRigid(org, B.resp); add('mouth', org);
    for (let i = 0; i < 5; i++) { const y = c.y - 0.13 + i * 0.065; const f = Math.sqrt(Math.max(0.02, 1 - Math.pow((y - c.y) / 0.19, 2))); const tg = new THREE.TorusGeometry(1, 0.1, 6, seg(20, 10)); tg.scale(0.125 * f * 1.02, 0.082 * f * 1.04, 0.05); tg.rotateX(Math.PI / 2); tg.translate(c.x, y, c.z); const uv = tg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 2, uv.getY(k)); bindRigid(tg, B.resp); add('shell', tg); }
    // vents
    for (const [S, s] of SIDES) { const v = blob([0.07 * s, 1.80, -0.19], 0.025, 0.04, 0.02, { w: 8, h: 6 }); bindRigid(v, B.resp); add('glow', v); const vv = blob([0.05 * s, 1.55, -0.2], 0.02, 0.03, 0.016, { w: 8, h: 6 }); bindRigid(vv, B.resp); add('glow', vv); }
    // nozzles + hoses to jaw corners
    for (const [S, s] of SIDES) {
      const noz = seg2(new V3(0.075 * s, 1.80, -0.17), new V3(0.09 * s, 1.88, -0.19), 0.034, 0.028, { radial: 8 }); bindRigid(noz, B.resp); add('shell', noz);
      const pts = [new V3(0.09 * s, 1.88, -0.19), new V3(0.15 * s, 1.97, -0.19), new V3(0.17 * s, 2.09, -0.09), new V3(0.145 * s, 2.15, -0.04), new V3(0.118 * s, 2.14, 0.05), hv(0.09 * s, -0.07 * HEAD_SCALE[kind], 0.16 * HEAD_SCALE[kind])];
      const hose = sweep(pts, 0.022, 0.022, { radial: 8, samples: 26, round: 2, tile: 0.1 });
      bindFn(hose, (x, y, z, i, o) => { // blend resp -> spine2 -> neck1 -> head by height
        if (y < 1.95) { o[0] = B.resp; o[1] = 1; } else if (y < 2.06) { const w = (y - 1.95) / 0.11; o[0] = B.spine2; o[1] = 1 - w; o[2] = B.neck1; o[3] = w; } else if (y < 2.12) { o[0] = B.neck1; o[1] = 1 - (y - 2.06) / 0.06; o[2] = B.head; o[3] = (y - 2.06) / 0.06; } else { o[0] = B.head; o[1] = 1; }
      });
      add('dark', hose);
      const ring = new THREE.TorusGeometry(0.026, 0.008, 5, 10); ring.rotateY(Math.PI / 2); ring.translate(0.17 * s, 2.06, -0.115); bindRigid(ring, B.neck1); add('shell', ring);
    }
  }

  // ======================= HEAD =======================
  buildHead(rig, kind, bk, add, probes, rng);

  // ======================= KIND EXTRAS =======================
  if (isO) buildOfficerExtras(rig, bk, add, probes, spine, spineBones, tmp);
  if (isH) buildHierarchExtras(rig, bk, add, probes, spine, spineBones, tmp);

  // ---- merge per material ----
  const geos = {};
  for (const k of Object.keys(bk)) geos[k] = mergeSkinned(bk[k]);
  return { rig, geos, probes };
}

// ===========================================================================================
function buildHead(rig, kind, bk, add, probes, rng) {
  const B = rig.idx; const isH = kind === 'hierarch', isO = kind === 'officer', isD = kind === 'drone';
  const hs = HEAD_SCALE[kind] || 0.8;
  const hl = (x, y, z) => hv(x * hs, y * hs, z * hs);
  const head = (g) => { bindRigid(g, B.head); return g; };
  const sc = (arr) => arr.map((s) => ({ ...s, t: s.t * hs, rx: s.rx * hs, ry: s.ry * hs, cy: s.cy * hs }));
  // --- helm: swept-back bone-shell dome with a blunt visor prow, flat underside ---
  const helmSecs = sc(isD ? [
    { t: -0.30, rx: 0.010, ry: 0.014, cy: 0.12 }, { t: -0.25, rx: 0.05, ry: 0.07, cy: 0.13, bot: 0.6 }, { t: -0.14, rx: 0.115, ry: 0.14, cy: 0.135, bot: 0.55 }, { t: 0.0, rx: 0.135, ry: 0.155, cy: 0.125, bot: 0.5 },
    { t: 0.12, rx: 0.13, ry: 0.145, cy: 0.105, bot: 0.5 }, { t: 0.22, rx: 0.105, ry: 0.115, cy: 0.085, bot: 0.5 }, { t: 0.29, rx: 0.07, ry: 0.075, cy: 0.07, bot: 0.5 }, { t: 0.335, rx: 0.03, ry: 0.035, cy: 0.062 }, { t: 0.35, rx: 0.008, ry: 0.01, cy: 0.06 },
  ] : [
    { t: -0.38, rx: 0.010, ry: 0.014, cy: 0.12 }, { t: -0.32, rx: 0.042, ry: 0.052, cy: 0.14 }, { t: -0.23, rx: 0.092, ry: 0.108, cy: 0.15, bot: 0.6 }, { t: -0.12, rx: 0.13, ry: 0.15, cy: 0.15, bot: 0.55 },
    { t: 0.0, rx: 0.142, ry: 0.165, cy: 0.14, bot: 0.5, power: 2.2 }, { t: 0.10, rx: 0.14, ry: 0.162, cy: 0.122, bot: 0.48, power: 2.2 }, { t: 0.19, rx: 0.127, ry: 0.142, cy: 0.100, bot: 0.48 },
    { t: 0.26, rx: 0.102, ry: 0.11, cy: 0.082, bot: 0.5 }, { t: 0.31, rx: 0.068, ry: 0.074, cy: 0.07, bot: 0.5 }, { t: 0.345, rx: 0.032, ry: 0.036, cy: 0.062 }, { t: 0.36, rx: 0.008, ry: 0.01, cy: 0.06 },
  ]);
  const helm = loft(helmSecs, { axis: 'z', radial: 40, tile: 0.35 }); helm.translate(H0[0], H0[1], H0[2]); head(helm); add('shell', helm);
  probes.cran = makeProbe(helm.clone());
  // panel seams: thin dark grooves running along the dome (meridians) + a transverse seam
  {
    const cyAt = (z) => { let i = 0; while (i < helmSecs.length - 2 && z > helmSecs[i + 1].t) i++; const a = helmSecs[i], c = helmSecs[i + 1]; const t = Math.min(1, Math.max(0, (z - a.t) / (c.t - a.t))); return a.cy + (c.cy - a.cy) * t; };
    for (const th of [0.55, 1.0, 1.45]) for (const s of [1, -1]) {
      const path = []; for (let i = 0; i <= 18; i++) { const z = (0.23 - i * 0.0285) * hs; if (z < -0.3 * hs) break; path.push({ o: new V3(H0[0], H0[1] + cyAt(z), H0[2] + z), d: new V3(Math.sin(th) * s, Math.cos(th), 0) }); }
      const g = conformStrip([probes.cran], path, 0.0045 * hs, 0.0009, { tile: 0.3 }); if (g) { head(g); add('dark', g); }
    }
    const ring = []; for (let i = 0; i <= 26; i++) { const a = -0.5 + (i / 26) * (Math.PI + 1.0); const z = -0.1 * hs; ring.push({ o: new V3(H0[0], H0[1] + cyAt(z), H0[2] + z), d: new V3(Math.cos(a), Math.sin(a), 0) }); }
    const rg = conformStrip([probes.cran], ring, 0.005 * hs, 0.0009, { tile: 0.3 }); if (rg) { head(rg); add('dark', rg); }
  }
  // --- lower face: dark wet jaw/muzzle under the helm ---
  const faceSecs = sc([
    { t: -0.08, rx: 0.088, ry: 0.08, cy: -0.035 }, { t: 0.05, rx: 0.112, ry: 0.105, cy: -0.05 }, { t: 0.16, rx: 0.104, ry: 0.118, cy: -0.062 }, { t: 0.25, rx: 0.084, ry: 0.113, cy: -0.062, power: 2.3 },
    { t: 0.31, rx: 0.06, ry: 0.098, cy: -0.058 }, { t: 0.348, rx: 0.036, ry: 0.068, cy: -0.05 }, { t: 0.365, rx: 0.012, ry: 0.025, cy: -0.046 },
  ]);
  const face = loft(faceSecs, { axis: 'z', radial: 28, tile: 0.25 }); face.translate(H0[0], H0[1], H0[2]); head(face); add('skin', face);
  probes.face = makeProbe(face.clone());
  // mouth: dark wet recess with a lip ring
  { const cav = blob(hl(0, -0.09, 0.328), 0.04 * hs, 0.068 * hs, 0.026 * hs, { w: 12, h: 10 }); head(cav); add('mouth', cav);
    const lip = new THREE.TorusGeometry(1, 0.16, 6, seg(20, 10)); lip.scale(0.047 * hs, 0.076 * hs, 0.05 * hs); lip.translate(H0[0], H0[1] - 0.09 * hs, H0[2] + 0.325 * hs); head(lip); add('skin', lip); }
  // --- eye band: glowing slit wrapped around the visor prow + dark bezel ---
  {
    const yb = isD ? 0.06 : 0.07; const centre = hl(0, yb, 0.02); const path = []; const N = 32; const amax = 84 * DEG;
    for (let i = 0; i <= N; i++) { const a = (i / N * 2 - 1) * amax; path.push({ o: centre.clone(), d: new V3(Math.sin(a), 0.0, Math.cos(a)) }); }
    const widths = Array.from({ length: N + 1 }, (_, i) => { const e = Math.abs(i / N * 2 - 1); return (0.018 * (1 - Math.pow(e, 2.6)) + 0.003) * hs; });
    const bez = conformStrip([probes.cran], path, widths.map((w) => w * 2.2 + 0.006 * hs), 0.0014, { tile: 0.3 }); if (bez) { head(bez); add('dark', bez); }
    const glow = conformStrip([probes.cran], path, widths, 0.0035, { tile: 0.3 }); if (glow) { head(glow); add('glow', glow); }
    // brow plates above the band (tilt with expression)
    for (const [S, s] of [['L', 1], ['R', -1]]) {
      const bp = []; const n = 9; for (let i = 0; i <= n; i++) { const a = (0.03 + i / n * 1.25) * s; bp.push({ o: hl(0, 0.112, 0.02), d: new V3(Math.sin(a), 0.0, Math.cos(a)) }); }
      const g = conformStrip([probes.cran], bp, [0.012, 0.016, 0.017, 0.016, 0.014, 0.012, 0.009, 0.006, 0.003, 0.001].map((v) => v * hs), 0.0055, { tile: 0.3 }); if (g) { bindRigid(g, B['brow_' + S]); add('shell', g); }
    }
  }
  // respiratory slits (glow) on the lower face + chin feelers
  {
    for (const s of [1, -1]) {
      const path = []; for (let i = 0; i <= 5; i++) { const y = -0.01 - i * 0.012; path.push({ o: hl(0.0, y, 0.10), d: new V3(Math.sin((0.30 + i * 0.01) * s), 0, Math.cos((0.30 + i * 0.01) * s)) }); }
      const g = conformStrip([probes.face], path, [0.002, 0.005, 0.006, 0.005, 0.004, 0.0015].map((v) => v * hs), 0.003, { tile: 0.1 }); if (g) { head(g); add('glow', g); }
    }
    for (const [S, s] of [['L', 1], ['R', -1]]) {
      const o = rig.R['tendril_' + S]; const g = sweep([o.clone().add(new V3(0, 0.0, -0.02)), o.clone().add(new V3(0.012 * s, -0.07, 0.01)), o.clone().add(new V3(0.02 * s, -0.15, 0.03)), o.clone().add(new V3(0.02 * s, -0.24, 0.06))], [0.012 * hs, 0.009 * hs, 0.0065 * hs, 0.002], [0.012 * hs, 0.009 * hs, 0.0065 * hs, 0.002], { radial: 6, samples: 12, round: 1, tile: 0.1 });
      bindFn(g, (x, y, z, i, w) => { w[0] = B['tendril_' + S]; w[1] = 1; }); add('dark', g);
    }
  }
  // --- mandibles: four-part cross. upper pair hangs & curls inward; lower pair rises from the jaw corners and crosses in front of the mouth ---
  const mand = (S, s, pts, rx, ry, bone) => { const g = sweep(pts, rx, ry, { radial: 8, samples: 14, round: 2, tile: 0.2, up: new V3(s, 0, 0) }); bindRigid(g, B[bone + '_' + S]); add('shell', g); return g; };
  for (const [S, s] of [['L', 1], ['R', -1]]) {
    const o = rig.R['mandU_' + S]; const p = (x, y, z) => o.clone().add(new V3(x * s * hs, y * hs, z * hs));
    mand(S, s, [p(0, 0.0, 0.0), p(0.014, -0.032, 0.038), p(0.006, -0.078, 0.088), p(-0.02, -0.118, 0.12), p(-0.052, -0.138, 0.135)], [0.026, 0.028, 0.023, 0.014, 0.005].map((v) => v * hs), [0.014, 0.015, 0.0125, 0.008, 0.003].map((v) => v * hs), 'mandU');
    for (let i = 0; i < 3; i++) { const t0 = p(-0.004, -0.06 - i * 0.026, 0.07 + i * 0.022); const tt = spike(t0, t0.clone().add(new V3(-0.026 * s * hs, -0.004, 0.01)), 0.006 * hs, { radial: 4 }); bindRigid(tt, B['mandU_' + S]); add('shell', tt); }
    const q = rig.R['mandL_' + S]; const pl = (x, y, z) => q.clone().add(new V3(x * s * hs, y * hs, z * hs));
    mand(S, s, [pl(0, 0.0, 0.0), pl(0.0, 0.022, 0.045), pl(-0.014, 0.05, 0.09), pl(-0.038, 0.07, 0.13), pl(-0.058, 0.078, 0.158)], [0.022, 0.024, 0.02, 0.013, 0.005].map((v) => v * hs), [0.012, 0.013, 0.011, 0.007, 0.0026].map((v) => v * hs), 'mandL');
    for (let i = 0; i < 2; i++) { const t0 = pl(-0.014 - i * 0.02, 0.046 + i * 0.016, 0.085 + i * 0.04); const tt = spike(t0, t0.clone().add(new V3(-0.004 * s * hs, -0.026, 0.006)), 0.0055 * hs, { radial: 4 }); bindRigid(tt, B['mandL_' + S]); add('shell', tt); }
  }
  // tongue / inner feeler
  {
    const t0 = rig.R.tongue0, t1 = rig.R.tongue1; const g = sweep([t0.clone().add(new V3(0, 0, -0.04)), t0.clone(), t1.clone(), t1.clone().add(new V3(0, 0.003, 0.05))], [0.02 * hs / 0.8, 0.018 * hs / 0.8, 0.012 * hs / 0.8, 0.005], [0.009, 0.010, 0.007, 0.0035], { radial: 7, samples: 10, round: 2, tile: 0.1, up: new V3(0, 1, 0) });
    bindFn(g, (x, y, z, i, o) => { const w = Math.min(1, Math.max(0, (z - t0.z) / (t1.z - t0.z))); o[0] = B.tongue0; o[1] = 1 - w; o[2] = B.tongue1; o[3] = w; }); add('mouth', g);
  }
  // crest fin along the dome (bone crest0)
  if (!isD) {
    const c = isO ? 0.12 : isH ? 0.05 : 0.05;
    const top = [[-0.38, 0.18], [-0.32, 0.26 + c * 0.4], [-0.23, 0.33 + c * 0.9], [-0.12, 0.375 + c], [0.0, 0.37 + c * 0.8], [0.10, 0.33 + c * 0.5], [0.19, 0.27 + c * 0.2], [0.24, 0.20]];
    const under = [[0.19, 0.2], [0.1, 0.26], [0.0, 0.28], [-0.12, 0.28], [-0.23, 0.22], [-0.33, 0.15]];
    const shp = new THREE.Shape([...top, ...under].map((q) => new THREE.Vector2(q[0] * hs, q[1] * hs)));
    const g = new THREE.ExtrudeGeometry(shp, { depth: 0.020 * hs, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -0.010 * hs); g.rotateY(-Math.PI / 2); g.translate(H0[0], H0[1], H0[2]);
    bindFn(g, (x, y, z, i, o) => { const lz = (z - H0[2]) / hs; const w = Math.min(1, Math.max(0, (-0.06 - lz) / 0.3)); o[0] = B.head; o[1] = 1 - w; o[2] = B.crest0; o[3] = w; });
    add('shell', g);
  }
}

function buildOfficerExtras(rig, bk, add, probes, spine, spineBones, tmp) {
  const B = rig.idx;
  // tendon sash: strands running from the right shoulder across the chest to the left hip, plus a back strand
  for (let k = 0; k < 4; k++) {
    const pts = []; const N = 9;
    for (let i = 0; i <= N; i++) { const t = i / N; const y = 1.90 - t * 0.5 - k * 0.012; const a = (-1.15 + t * 2.2 + k * 0.025); torsoSurf(y, a, tmp); pts.push(tmp.p.clone().addScaledVector(tmp.n, 0.032 + k * 0.004 + Math.sin(t * Math.PI) * 0.006)); }
    const g = sweep(pts, 0.011 + 0.002 * (k % 2), 0.011, { radial: 6, samples: 28, round: 2, tile: 0.1 }); add('dark', bindAlong(g, spine, spineBones, 0.07));
  }
  // glowing rank markings on chest plate and shoulders (chevrons)
  for (let c = 0; c < 3; c++) {
    for (const s of [1, -1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8 * 2 - 1; const y = 1.80 - c * 0.04 + Math.abs(t) * 0.035; torsoSurf(y, s * (0.30 + (t * 0.5 + 0.5) * 0.0) + t * 0.18, tmp); pts.push({ o: new V3(tmp.p.x * 0.2, tmp.p.y, tmp.p.z - 0.1), d: new V3(tmp.p.x - tmp.p.x * 0.2, 0, tmp.p.z - (tmp.p.z - 0.1)).normalize() }); }
      void pts;
    }
  }
  // chest glyph strips conformed onto sternum shell: rely on torso probe
  const torsoProbe = (() => { const secs = TORSO.map((s) => ({ t: s.y, rx: s.rx + 0.03, ry: s.rz + 0.03, cy: s.cz, power: 2 })); const g = loft(secs, { axis: 'y', radial: 40, capStart: false, capEnd: false }); return makeProbe(g); })();
  for (let c = 0; c < 3; c++) for (const s of [1, -1]) {
    const path = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1; const y = 1.86 - c * 0.05 + Math.abs(t) * 0.04; const T = torsoAt(y); const a = s * (0.12 + (i / 10) * 0.55); path.push({ o: new V3(0, y, T.cz), d: new V3(Math.sin(a), 0, Math.cos(a)) }); }
    const g = conformStrip(torsoProbe, path, 0.011, 0.002); if (g) add('glow', bindAlong(g, spine, spineBones, 0.07));
  }
}

function buildHierarchExtras(rig, bk, add, probes, spine, spineBones, tmp) {
  const B = rig.idx; const H = SPINE.head;
  // crown spires: tall shell horns sweeping back from the cranium
  for (const s of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const base = hv(0.05 * s + k * 0.018 * s, 0.38 - k * 0.012, -0.25 + k * 0.1); const tip = base.clone().add(new V3(0.12 * s * (1 + k * 0.4), 0.28 - k * 0.05, -0.32 + k * 0.05));
      const g = sweep([base.clone().add(new V3(0, -0.03, 0)), base.clone().lerp(tip, 0.4).add(new V3(0.02 * s, 0.05, 0)), tip], [0.022, 0.016, 0.003], [0.016, 0.011, 0.002], { radial: 7, samples: 10, round: 1, tile: 0.2, up: new V3(0, 0, 1) });
      bindRigid(g, B.head); add('shell', g);
    }
    // frill fan: translucent membrane wing on each side behind the head, ribs in shell
    const bone = B['frill' + (s > 0 ? 'L' : 'R')]; const root = rig.R['frill' + (s > 0 ? 'L' : 'R')];
    const ribs = 5; const ribTips = [];
    for (let i = 0; i < ribs; i++) { const a = (i / (ribs - 1) - 0.5) * 1.5; const len = 0.40 + 0.18 * Math.cos(a * 1.1); const dir = new V3(0.55 * s, Math.sin(a + 0.5) * 0.9, -Math.cos(a) * 0.9).normalize(); ribTips.push(root.clone().addScaledVector(dir, len)); }
    for (const tip of ribTips) { const g = sweep([root.clone(), root.clone().lerp(tip, 0.5), tip], [0.015, 0.011, 0.004], [0.011, 0.009, 0.003], { radial: 6, samples: 8, round: 1, tile: 0.2 }); bindRigid(g, bone); add('shell', g); }
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < ribs; i++) { pos.push(root.x, root.y, root.z, ribTips[i].x, ribTips[i].y, ribTips[i].z); uv.push(0.5, i / (ribs - 1), 0.5, i / (ribs - 1) + 0.0); }
    // build membrane with 3 rows between ribs
    const rows = 4; const P = []; for (let r = 0; r <= rows; r++) { const f = r / rows; for (let i = 0; i < ribs; i++) P.push(root.clone().lerp(ribTips[i], 0.12 + 0.88 * f)); }
    const mp = [], mu = [], mi = []; for (const p of P) mp.push(p.x, p.y, p.z); for (let r = 0; r <= rows; r++) for (let i = 0; i < ribs; i++) mu.push(i / (ribs - 1) * 1.4, r / rows * 1.4);
    for (let r = 0; r < rows; r++) for (let i = 0; i < ribs - 1; i++) { const a = r * ribs + i, b = a + 1, c = a + ribs, d = c + 1; mi.push(a, b, c, b, d, c, a, c, b, b, c, d); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); mg.setAttribute('uv', new THREE.Float32BufferAttribute(mu, 2)); mg.setIndex(mi); mg.computeVertexNormals(); bindRigid(mg, bone); add('membrane', mg);
  }
  // robes: mantle draping from the shoulders down the back + front tabard flaps + hip drapes
  const cape = (w0, w1, y0, y1, z0, z1, rows, cols, curve) => {
    const pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) { const t = r / rows; const y = y0 + (y1 - y0) * t; const w = w0 + (w1 - w0) * t; const z = z0 + (z1 - z0) * Math.pow(t, 1.3); for (let c = 0; c <= cols; c++) { const u = c / cols * 2 - 1; pos.push(u * w, y + Math.abs(u) * (0.1 - 0.1 * t) * -curve, z - (1 - u * u) * 0.05 * curve * (0.3 + t)); uv.push((u * 0.5 + 0.5) * w * 2 / 0.5, t * Math.abs(y1 - y0) / 0.5); } }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + 1, cc = a + cols + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d, a, b, cc, b, d, cc); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  { const g = cape(0.26, 0.40, 1.94, 0.18, -0.10, -0.42, 18, 14, 1); bindFn(g, (x, y, z, i, o) => { // upper->spine2, mid->cape0/1/2 chain
      if (y > 1.80) { o[0] = B.spine2; o[1] = 1; } else if (y > 1.30) { const w = (1.80 - y) / 0.5; o[0] = B.cape0; o[1] = 1 - w * 0.3; o[2] = B.cape1; o[3] = w * 0.3 + 0.0; if (w > 0.7) { o[0] = B.cape0; } } else { const w = Math.min(1, (1.30 - y) / 0.6); o[0] = B.cape1; o[1] = 1 - w; o[2] = B.cape2; o[3] = w; } });
    add('membrane', g); }
  // front tabard (two narrow flaps from the waist to mid-shin), attached to pelvis/thigh
  for (const s of [1, -1]) {
    const g = cape(0.075, 0.07, 1.26, 0.42, 0.17, 0.22, 10, 4, 0.5); g.translate(0.07 * s, 0, 0); bindFn(g, (x, y, z, i, o) => { o[0] = B.pelvis; o[1] = 1; }); add('membrane', g);
  }
  // hip drapes
  for (const s of [1, -1]) { const g = cape(0.11, 0.13, 1.30, 0.62, -0.02, -0.02, 10, 5, 0.6); g.rotateY(Math.PI / 2 * s); g.translate(0.2 * s, 0, 0); bindFn(g, (x, y, z, i, o) => { o[0] = B.pelvis; o[1] = 1; }); add('membrane', g); }
  // chest medallion + glowing rank sigils
  const mg2 = blob([0, 1.74, 0.235], 0.045, 0.05, 0.02, { w: 12, h: 8 }); bindAlong(mg2, spine, spineBones, 0.07); add('glow', mg2);
}
