// Clothing: outfits assembled from skinned body-offset shells (wear_geo.js) + fabric materials (wear_tex.js).
// buildClothing(P, L, rig, head, fx, bodyGeo) -> { meshes:[{geometry, material, name, cast}], update(dt,t,human), outfit }
// profile.outfit = { top:{type,color,trim,accent,rolled,camo}, outer:{type,color,open,accent}, bottom:{type,color}, shoes:{type,color,sole},
//                    gloves:{color,fingerless}, apron:{color}, tie:{color}, lanyard:{color}, stethoscope:true, aipin:true }  (cap/helmet live in hair.js)
import * as THREE from 'three';
import { V, smooth, mixn, rigid, applySkin } from './kit.js';
import { wearCtx, fin, combine, torsoShell, limbShell, skirtShell, collarBand, shellPoint, strip, torsoStrip, boxOn, ellOn, cylOn, shoeParts, gloveParts } from './wear_geo.js';
import { clothMat, camoTex, decalTex } from './wear_tex.js';
import { nomToModel, surfaceAt } from './head.js';

const SLV = { none: 0, short: 1.72, mid: 2.5, long: 2.93, rolled: 2.3 };
export const TOPS = {
  tshirt: { fab: 'weave', sl: 'short', hem: 0.525, fit: 0.009, neck: 'crew', flare: 0.006 },
  tank: { fab: 'weave', sl: 'none', hem: 0.53, fit: 0.007, neck: 'scoop', flare: 0.003 },
  techtee: { fab: 'tech', sl: 'short', hem: 0.535, fit: 0.006, neck: 'crew', flare: 0.0 },
  scrubs: { fab: 'scrubs', sl: 'short', hem: 0.50, fit: 0.014, neck: 'vneck', pockets: true, flare: 0.012 },
  shirt: { fab: 'twill', sl: 'long', hem: 0.50, fit: 0.011, neck: 'collar', buttons: true, flare: 0.008 },
  blouse: { fab: 'weave', sl: 'long', hem: 0.58, fit: 0.007, neck: 'collar', buttons: true, tuck: true, cuff: true, flare: 0.002 },
  uniform_polo: { fab: 'pique', sl: 'short', hem: 0.52, fit: 0.011, neck: 'polo', trim: true, logo: true, flare: 0.008 },
  driver_shirt: { fab: 'twill', sl: 'short', hem: 0.50, fit: 0.011, neck: 'collar', buttons: true, pockets: true, epaulet: true, flare: 0.008, noHipPockets: true },
  sweater: { fab: 'knit', sl: 'long', hem: 0.50, fit: 0.015, neck: 'roll', flare: 0.004 },
  hoodie: { fab: 'knit', sl: 'long', hem: 0.50, fit: 0.016, neck: 'roll', flare: 0.006, kanga: true },
  uniform: { fab: 'twill', sl: 'long', hem: 0.58, fit: 0.010, neck: 'collar', buttons: true, pockets: true, epaulet: true, tuck: true, cuff: true },
  jumpsuit: { fab: 'canvas', sl: 'long', hem: 0.62, fit: 0.014, neck: 'collar', pockets: true, suit: true, cuff: true, noHipPockets: true },
  robe: { fab: 'weave', sl: 'long', hem: 0.50, fit: 0.016, neck: 'roll', robe: true },
  dress: { fab: 'weave', sl: 'short', hem: 0.6, fit: 0.008, neck: 'scoop', dress: true },
};
const BOTTOMS = {
  slacks: { fab: 'blazer', fit: 0.010, bell: 0.008 }, jeans: { fab: 'denim', fit: 0.010, bell: 0.006 }, techpants: { fab: 'tech', fit: 0.004, bell: 0.0, jog: true },
  scrubs: { fab: 'scrubs', fit: 0.017, bell: 0.004 }, cargo: { fab: 'canvas', fit: 0.014, bell: 0.002, cargo: true }, shorts: { fab: 'twill', fit: 0.012, u1: 1.62 },
  skirt: { fab: 'weave', skirt: true, flare: 0.07, hemK: 0.02 }, pencil: { fab: 'blazer', skirt: true, flare: 0.0, hemK: 0.1 }, camo: { fab: 'twill', fit: 0.014, bell: 0.002, cargo: true },
  uniform: { fab: 'twill', fit: 0.010, bell: 0.006 }, trousers: { fab: 'blazer', fit: 0.010, bell: 0.008 },
};
const OUTERS = {
  labcoat: { fab: 'labcoat', fit: 0.024, hem: 'knee', open: 0.42, collar: 'flap', pockets: true },
  techjacket: { fab: 'tech', fit: 0.017, hem: 0.50, closed: true, collar: 'stand', lines: true },
  cargo_jacket: { fab: 'canvas', fit: 0.022, hem: 0.49, open: 0.34, collar: 'flap', pockets: true, chestPockets: true },
  driver_jacket: { fab: 'twill', fit: 0.021, hem: 0.50, open: 0.28, collar: 'flap', pockets: true, trimCol: true },
  jacket: { fab: 'twill', fit: 0.021, hem: 0.50, open: 0.3, collar: 'flap', pockets: true },
  blazer: { fab: 'blazer', fit: 0.018, hem: 0.52, vopen: true, collar: 'lapel', buttons: true, flare: 0.006 },
  coat: { fab: 'blazer', fit: 0.024, hem: 'knee', open: 0.3, collar: 'flap' },
  vest: { fab: 'canvas', fit: 0.020, hem: 0.52, sleeveless: true, closed: true, pouches: true },
  hivis: { fab: 'weave', fit: 0.020, hem: 0.52, sleeveless: true, open: 0.12, strips: true },
  armor: { fab: 'canvas', fit: 0.022, hem: 0.56, sleeveless: true, closed: true, pouches: true, plate: true },
};
const DEFAULT_OUTFIT = {
  M: { top: { type: 'tshirt', color: '#8c9aa6' }, bottom: { type: 'jeans', color: '#3a4c66' }, shoes: { type: 'sneakers', color: '#e8e8e8' } },
  F: { top: { type: 'tshirt', color: '#c9a2a8' }, bottom: { type: 'jeans', color: '#3a4c66' }, shoes: { type: 'sneakers', color: '#e8e8e8' } },
};
/** profile.outfit with gaps filled (suit-type tops get matching legs; robes/dresses none) */
export function resolveOutfit(P) {
  const o = P.outfit || {}, d = DEFAULT_OUTFIT[P.isFemale ? 'F' : 'M'];
  const out = { ...o };
  if (!out.top) out.top = d.top;
  const ts = TOPS[out.top.type] || TOPS.tshirt;
  if (ts.suit && !out.bottom) out.bottom = { type: 'cargo', color: out.top.color, camo: out.top.camo };
  else if (!out.bottom && !ts.robe && !ts.dress) out.bottom = d.bottom;
  if (!out.shoes) out.shoes = d.shoes;
  return out;
}
const yfOf = (c, y) => { const H = c.H, yTop = c.dims.neckY + 0.012; return y <= 0.76 * H ? y / H : 0.76 + (y - 0.76 * H) / (yTop - 0.76 * H) * 0.102; };
const dark = (col, k) => new THREE.Color(col).multiplyScalar(k);

/** ribbon on a limb (arm/leg) along u0..u1 at ring angle ang (0 = front, +pi/2 = character-left side) */
function limbStrip(c, kind, S, u0, u1, ang, off, w, color) {
  const limb = c.limbs[kind + S], pts = [], nr = [], n = 8;
  for (let i = 0; i < n; i++) {
    const u = mixn(u0, u1, i / (n - 1)), st = limb.at(u), t = limb.tan(u);
    const b = V(0, 0, 1).addScaledVector(t, -t.z).normalize(), a = V().crossVectors(t, b).normalize();
    const ca = Math.cos(ang), sa = Math.sin(ang);
    nr.push(a.clone().multiplyScalar(sa / (st.rx + off)).addScaledVector(b, ca / (st.rz + off)).normalize());
    pts.push(st.c.clone().addScaledVector(a, sa * (st.rx + off)).addScaledVector(b, ca * (st.rz + off)));
  }
  return strip(pts, nr, w, kind === 'arm' ? c.armSkin(S) : c.legSkin(S), color, 10);
}
const torsoPatch = (c, yf, ang, w, h, d, color, off = 0.01) => { const sp = shellPoint(c, yf, ang, off); return boxOn(c, 'torso', w, h, d, sp.p.addScaledVector(sp.n, d / 2), color, [0, ang, 0]); };

export function buildClothing(P, L, rig, head, fx, bodyGeo) {
  const c = wearCtx(P, L, rig), O = resolveOutfit(P), acc = P.accessories || [];
  const G = {}; const push = (slot, g) => { if (g) (G[slot] || (G[slot] = [])).push(g); };
  const T = O.top, TS = TOPS[T.type] || TOPS.tshirt;
  const outer = O.outer, OS = outer ? (OUTERS[outer.type] || OUTERS.jacket) : null;
  const B = O.bottom, BS = B ? (BOTTOMS[B.type] || BOTTOMS.slacks) : null;
  const bel = P.build.belly, H = c.H, sc = c.sc;
  const camo = { top: T.camo, outer: outer && outer.camo, bottom: B && B.camo };
  const colOf = (spec, slot) => (camo[slot] ? new THREE.Color(0xffffff) : new THREE.Color(spec.color || '#777'));
  const topC = colOf(T, 'top');
  const sleeveKey = T.rolled ? 'rolled' : TS.sl, sleeveU = SLV[sleeveKey] || 0;
  const tfit = TS.fit + (bel > 0.3 ? 0.006 * bel : 0);
  const tTrim = T.trim ? new THREE.Color(T.trim) : (T.accent ? new THREE.Color(T.accent) : dark(topC, 0.88));
  const R0 = outer ? OS.fit : tfit; // surface offset of the outermost torso layer

  // ---------------------------------------------------------------- bottoms
  if (B && BS.skirt) {
    const hemY = c.dims.kneeY + BS.hemK, bc = colOf(B, 'bottom');
    push('bottom', torsoShell(c, { y0: 0.5, y1: 0.66, off: 0.012, color: bc, tile: 0.05, capStart: 0.045 }));
    push('bottom', skirtShell(c, { top: 0.6, hem: hemY, off: 0.012, flare: (s) => BS.flare * Math.pow(s, 1.3), color: bc, tile: 0.05, legK: BS.flare > 0.03 ? 0.4 : 0.6 }));
  } else if (B) {
    const fit = BS.fit, u1 = BS.u1 || 2.97, bc = colOf(B, 'bottom'), wOff = Math.max(0.004, fit * 0.55) + (TS.tuck ? 0.012 : 0);
    push('bottom', torsoShell(c, { y0: 0.47, y1: 0.655, off: wOff, color: bc, tile: 0.05, capStart: 0.045 }));
    for (const S of ['L', 'R']) {
      const bell = BS.bell || 0, cargo = BS.cargo ? 0.008 : 0;
      push('bottom', limbShell(c, 'leg', S, { u0: 0, u1, off: fit, tile: 0.05, color: bc, closeStart: true, offFn: (u) => bell * smooth(2.3, 2.95, u) + cargo * smooth(1.1, 1.5, u) * (1 - smooth(2.1, 2.5, u)) }));
      if (!BS.u1) push('bottom', limbShell(c, 'leg', S, { u0: u1 - 0.09, u1, off: fit + (BS.jog ? 0.006 : 0.004) + bell, n: 3, color: BS.jog ? dark(B.color, 0.8) : bc, tile: 0.05 }));
      if (BS.cargo) push('bottom', limbStrip(c, 'leg', S, 1.35, 1.75, S === 'L' ? Math.PI / 2 : -Math.PI / 2, fit + 0.003, 0.085, dark(B.color, 0.85)));
    }
    if (TS.tuck) {
      push('misc', torsoShell(c, { y0: 0.597, y1: 0.628, off: wOff + 0.006, color: 0x1d1612, tile: 0.03, n: 3 }));
      const sp = shellPoint(c, 0.612, 0, wOff + 0.008);
      push('misc', boxOn(c, 'torso', 0.032, 0.026, 0.006, sp.p.clone().setZ(sp.p.z + 0.003), 0xb9b6ae));
    }
  }

  // ---------------------------------------------------------------- top
  if (!TS.robe && !TS.dress) {
    const hemY = TS.hem, flare = TS.flare || 0;
    const vopen = TS.neck === 'vneck' ? (yf) => 0.42 * smooth(0.80, 0.857, yf) : (TS.neck === 'collar' || TS.neck === 'polo') ? (yf) => (TS.neck === 'polo' ? 0.2 : 0.26) * smooth(0.815, 0.857, yf) : null;
    const y1 = TS.neck === 'scoop' ? 0.835 : 0.855;
    push('top', torsoShell(c, { y0: hemY, y1, off: tfit, offFn: (yf) => flare * (1 - smooth(hemY, hemY + 0.12, yf)) + bel * 0.008 * smooth(0.5, 0.58, yf) * (1 - smooth(0.62, 0.7, yf)), color: topC, tile: 0.05, open: vopen }));
    if (TS.neck === 'crew' || TS.neck === 'roll') push('top', collarBand(c, { y: 0.855, h: TS.neck === 'roll' ? 0.045 : 0.012, off: tfit + (TS.neck === 'roll' ? 0.006 : 0.002), flare: TS.neck === 'roll' ? 0.012 : 0.001, color: T.trim ? tTrim : dark(topC, 0.9) }));
    if (TS.neck === 'collar' || TS.neck === 'polo' || TS.neck === 'vneck') {
      push('top', collarBand(c, { y: 0.852, h: 0.03, off: tfit + 0.004, flare: 0.006, color: TS.neck === 'polo' ? tTrim : topC }));
      if (TS.neck !== 'vneck') for (const s of [1, -1]) {
        const pts = [], nr = [], N = 9, a1 = s * (TS.neck === 'polo' ? 0.16 : 0.2);
        for (let i = 0; i < N; i++) { const t = i / (N - 1); const sp = shellPoint(c, mixn(0.858, 0.815, smooth(0, 1, t)), mixn(s * 2.3, a1, Math.pow(t, 0.8)), tfit + 0.007); pts.push(sp.p); nr.push(sp.n); }
        push('top', strip(pts, nr, (t) => 0.036 * (1 - 0.3 * t) + 0.006, c.torsoSkin, TS.neck === 'polo' ? tTrim : topC, 10));
      }
    }
    if (TS.buttons) for (let i = 0; i < 6; i++) { const yf = mixn(0.80, hemY + 0.05, i / 5); if (yf < hemY + 0.04) continue; const sp = shellPoint(c, yf, 0, tfit + 0.005); push('misc', ellOn(c, 'torso', 0.0065, 0.0065, 0.003, sp.p, outer ? dark(topC, 0.7) : 0xe8e4da, 6)); }
    if (TS.pockets) { for (const s of [1, -1]) push('top', torsoPatch(c, 0.735, s * 0.62, 0.06, 0.066, 0.004, dark(topC, 0.93), tfit)); if (!TS.noHipPockets) for (const s of [1, -1]) push('top', torsoPatch(c, 0.545, s * 0.95, 0.085, 0.09, 0.004, dark(topC, 0.93), tfit + flare * 0.7)); }
    if (TS.kanga) push('top', torsoPatch(c, 0.57, 0, 0.17, 0.08, 0.005, dark(topC, 0.92), tfit + 0.004));
    for (const S of ['L', 'R']) {
      if (sleeveU <= 0) break;
      const rolled = sleeveKey === 'rolled', sg = S === 'L' ? 1 : -1;
      push('top', limbShell(c, 'arm', S, { u0: 0, u1: sleeveU, off: tfit + 0.003, tile: 0.05, color: topC, closeStart: true, offFn: (u) => (rolled ? 0.004 * smooth(1.0, 2.0, u) : 0) }));
      if (rolled) push('top', limbShell(c, 'arm', S, { u0: sleeveU - 0.2, u1: sleeveU, off: tfit + 0.0155, n: 3, tile: 0.05, color: dark(topC, 0.93) }));
      else if (TS.trim || (TS.cuff && sleeveU > 2.8) || (T.accent && T.type !== 'techtee')) push('top', limbShell(c, 'arm', S, { u0: sleeveU - 0.09, u1: sleeveU, off: tfit + 0.007, n: 3, tile: 0.05, color: TS.cuff && !T.trim ? dark(topC, 0.92) : tTrim }));
      else if (sleeveU < 2.0) push('top', limbShell(c, 'arm', S, { u0: sleeveU - 0.05, u1: sleeveU, off: tfit + 0.0065, n: 2, tile: 0.05, color: dark(topC, 0.9) }));
      if (TS.epaulet && !outer) { const a = c.J['upperArm' + S]; push('top', boxOn(c, 'clavicle' + S, 0.052, 0.008, 0.075, V(a.x - sg * 0.012, a.y + 0.062 * Math.max(0.9, sc) + 0.002, 0), tTrim, [0, 0, -sg * 0.1])); }
    }
    G.decals = G.decals || [];
    if (TS.logo) { const sp = shellPoint(c, 0.735, -0.5, tfit + 0.002), g = new THREE.PlaneGeometry(0.058, 0.058); g.rotateY(-0.5); g.translate(sp.p.x + sp.n.x * 0.001, sp.p.y, sp.p.z + sp.n.z * 0.001); applySkin(g, c.torsoSkin); fin(g, 0xffffff); G.decals.push({ geo: g, tex: decalTex('burger', 'BURGIE', T.trim || '#f2c21b', T.color || '#c8202a') }); }
    if (acc.includes('nametag') && !outer) { const sp = shellPoint(c, 0.735, 0.55, tfit + 0.003), g = new THREE.PlaneGeometry(0.052, 0.026); g.rotateY(0.55); g.translate(sp.p.x + sp.n.x * 0.001, sp.p.y, sp.p.z + sp.n.z * 0.001); applySkin(g, c.torsoSkin); fin(g, 0xffffff); G.decals.push({ geo: g, tex: decalTex('name', P.name.toUpperCase().slice(0, 7), '#f4f1e8', '#222') }); }
  } else {
    const y1 = TS.dress ? 0.835 : 0.855;
    push('top', torsoShell(c, { y0: 0.62, y1, off: tfit, color: topC, tile: 0.06 }));
    push('top', skirtShell(c, { top: 0.62, hem: TS.robe ? 0.07 : c.dims.kneeY + 0.04, off: tfit, flare: (s) => (TS.robe ? 0.07 : 0.05) * Math.pow(s, 1.2), color: topC, tile: 0.06, legK: TS.robe ? 0.35 : 0.5 }));
    push('top', collarBand(c, { y: 0.855, h: 0.03, off: tfit + 0.004, flare: 0.01, color: dark(topC, 0.9) }));
    for (const S of ['L', 'R']) push('top', limbShell(c, 'arm', S, { u0: 0, u1: TS.robe ? 2.97 : 1.4, off: tfit + 0.004, color: topC, tile: 0.06, closeStart: true, offFn: (u) => (TS.robe ? 0.075 * smooth(1.8, 3, u) : 0) }));
    if (TS.robe) push('misc', torsoShell(c, { y0: 0.6, y1: 0.64, off: tfit + 0.008, color: new THREE.Color(T.accent || '#a0522d'), n: 3, tile: 0.03 }));
  }

  // ---------------------------------------------------------------- outer layer
  if (outer) {
    const ocol = colOf(outer, 'outer'), of = OS.fit, trimC = OS.trimCol && outer.accent ? new THREE.Color(outer.accent) : dark(ocol, 0.9);
    const knee = OS.hem === 'knee', hemYf = knee ? 0.62 : OS.hem;
    const openA = outer.open === false ? 0 : (OS.open || 0);
    const openFn = openA ? () => openA : (OS.vopen ? (yf) => 0.62 * smooth(0.665, 0.84, yf) : null);
    const flare = OS.flare || 0.01, lap = OS.collar === 'lapel';
    push('outer', torsoShell(c, { y0: hemYf, y1: 0.858, off: of, offFn: (yf) => (knee ? 0 : flare * (1 - smooth(hemYf, hemYf + 0.1, yf))) - of * 0.6 * smooth(0.8, 0.858, yf), color: ocol, tile: 0.06, open: openFn }));
    if (knee) push('outer', skirtShell(c, { top: 0.62, hem: c.dims.kneeY + (OS.fab === 'labcoat' ? 0.04 : 0.0), off: of, flare: (s) => 0.04 * Math.pow(s, 1.1), color: ocol, tile: 0.06, open: () => openA, legK: 0.45 }));
    if (OS.collar === 'stand') push('outer', collarBand(c, { y: 0.858, h: 0.05, off: 0.012, flare: 0.006, color: dark(ocol, 0.9) }));
    else if (!OS.sleeveless) {
      push('outer', collarBand(c, { y: 0.858, h: 0.032, off: 0.013, flare: 0.012, color: ocol }));
      for (const s of [1, -1]) {
        const pts = [], nr = [], N = 10, yEnd = lap ? 0.70 : 0.775;
        for (let i = 0; i < N; i++) { const t = i / (N - 1), yf = mixn(0.858, yEnd, Math.pow(t, 0.9)), aOpen = openFn ? openFn(yf) : 0; const sp = shellPoint(c, yf, s * (i === 0 ? 2.3 : mixn(2.2, aOpen + 0.12, Math.pow(t, 0.7))), of * (1 - 0.6 * smooth(0.8, 0.858, yf)) + 0.008); pts.push(sp.p); nr.push(sp.n); }
        push('outer', strip(pts, nr, (t) => (lap ? 0.05 : 0.04) * (1 - 0.35 * t) + 0.01, c.torsoSkin, lap ? dark(ocol, 0.92) : ocol, 10));
      }
    }
    if (OS.buttons) for (let i = 0; i < 4; i++) { const yf = mixn(0.78, 0.58, i / 3), sp = shellPoint(c, yf, 0, of + 0.006); if (!openFn || openFn(yf) < 0.05) push('misc', ellOn(c, 'torso', 0.008, 0.008, 0.004, sp.p, dark(ocol, 0.5), 6)); }
    if (OS.lines) push('misc', torsoStrip(c, [0.85, 0], [0.5, 0], 0.01, of + 0.003, 0x0c0e11));
    if (OS.pockets) { for (const s of [1, -1]) push('outer', torsoPatch(c, knee ? 0.62 : 0.545, s * 0.95, 0.09, 0.1, 0.006, dark(ocol, 0.94), of + (knee ? 0.0 : 0.006))); if (OS.fab === 'labcoat') push('outer', torsoPatch(c, 0.745, -0.62, 0.062, 0.07, 0.005, dark(ocol, 0.96), of)); }
    if (OS.chestPockets) for (const s of [1, -1]) { push('outer', torsoPatch(c, 0.735, s * 0.68, 0.068, 0.075, 0.008, dark(ocol, 0.9), of)); push('misc', torsoPatch(c, 0.757, s * 0.68, 0.066, 0.012, 0.01, dark(ocol, 0.75), of)); }
    if (OS.pouches) for (let i = -2; i <= 2; i++) { if (i) push('misc', torsoPatch(c, 0.62, i * 0.34, 0.05, 0.07, 0.016, dark(ocol, 0.8), of)); }
    if (OS.plate) push('misc', torsoPatch(c, 0.72, 0, 0.17, 0.2, 0.012, dark(ocol, 0.7), of));
    if (OS.strips) { for (const yf of [0.64, 0.74]) push('misc', torsoStrip(c, [yf, -2.6], [yf, 2.6], 0.034, of + 0.003, 0xdfe6e8)); for (const s of [1, -1]) push('misc', torsoStrip(c, [0.85, s * 0.45], [0.55, s * 0.5], 0.034, of + 0.003, 0xdfe6e8)); }
    if (!OS.sleeveless) for (const S of ['L', 'R']) {
      const u1 = 2.96, ac = outer.accent ? new THREE.Color(outer.accent) : null, sd = S === 'L' ? 1 : -1;
      push('outer', limbShell(c, 'arm', S, { u0: 0, u1, off: of + 0.003, tile: 0.06, color: ocol, closeStart: true, offFn: (u) => 0.003 * smooth(1, 2.5, u) }));
      push('outer', limbShell(c, 'arm', S, { u0: u1 - 0.08, u1, off: of + 0.009, n: 3, tile: 0.06, color: OS.trimCol ? trimC : dark(ocol, 0.92) }));
      if (ac && OS.trimCol) push('glow0', limbStrip(c, 'arm', S, 1.2, 2.1, sd * Math.PI / 2, of + 0.008, 0.012, ac));
      if (ac && OS.lines) push('glow', limbStrip(c, 'arm', S, 1.15, 2.85, sd * Math.PI * 0.55, of + 0.0065, 0.007, ac));
    }
    if (OS.lines && outer.accent) { const ac = new THREE.Color(outer.accent); for (const s of [1, -1]) { push('glow', torsoStrip(c, [0.84, s * 0.55], [0.66, s * 0.3], 0.007, of + 0.0035, ac)); push('glow', torsoStrip(c, [0.66, s * 0.3], [0.52, s * 0.62], 0.007, of + 0.0035, ac)); } }
  }
  if (B && !BS.skirt && B.accent && BS.jog) for (const S of ['L', 'R']) push('glow', limbStrip(c, 'leg', S, 1.1, 2.8, S === 'L' ? Math.PI * 0.55 : -Math.PI * 0.55, BS.fit + 0.0035, 0.007, new THREE.Color(B.accent)));

  // ---------------------------------------------------------------- apron / towel / tie / accessories
  if (O.apron) {
    const ac = new THREE.Color(O.apron.color || '#4a3524'), ao = 0.022 + bel * 0.006;
    push('apron', torsoShell(c, { y0: 0.5, y1: 0.76, off: ao, color: ac, tile: 0.06, keep: (yf) => mixn(1.5, 0.75, smooth(0.6, 0.76, yf)), n: 10 }));
    push('apron', skirtShell(c, { top: 0.5, hem: c.dims.kneeY + 0.12, off: 0.02, flare: (s) => 0.01 * s, color: ac, tile: 0.06, keep: () => 1.45, legK: 0.5 }));
    for (const s of [1, -1]) push('apron', torsoStrip(c, [0.76, s * 0.7], [0.855, s * 1.9], 0.018, 0.016, ac));
    push('apron', torsoShell(c, { y0: 0.585, y1: 0.605, off: ao + 0.003, color: dark(ac, 0.8), tile: 0.03, n: 3 }));
  }
  if (acc.includes('towel') || acc.includes('bar_towel')) {
    const bar = acc.includes('bar_towel'), col = bar ? 0xe9e4d6 : 0xf0efe9;
    if (bar) { const sp = shellPoint(c, 0.55, 1.05, 0.04); push('terry', strip([sp.p.clone(), sp.p.clone().add(V(0, -0.22 * sc, 0))], [sp.n, sp.n], 0.11, c.torsoSkin, col, 8)); }
    else {
      const pts = [], nr = [];
      for (const [yf, a] of [[0.66, 0.95], [0.75, 1.15], [0.815, 1.45], [0.822, 1.75], [0.79, 2.1], [0.72, 2.4], [0.64, 2.6]]) { const sp = shellPoint(c, yf, a, R0 + 0.02); pts.push(sp.p); nr.push(sp.n); }
      push('terry', strip(pts, nr, 0.11, c.torsoSkin, col, 8));
    }
  }
  if (acc.includes('tie') || O.tie) {
    const tc = new THREE.Color(O.tie ? O.tie.color : '#7a1f2b');
    push('misc', torsoStrip(c, [0.845, 0], [0.62, 0], 0.036, tfit + 0.0065, tc));
    push('misc', ellOn(c, 'torso', 0.017, 0.014, 0.01, shellPoint(c, 0.842, 0, tfit + 0.008).p, tc, 8));
  }
  if (acc.includes('lanyard') || O.lanyard) {
    const lc = new THREE.Color(O.lanyard ? O.lanyard.color : '#2a6fb0');
    for (const s of [1, -1]) push('misc', torsoStrip(c, [0.85, s * 1.9], [0.69, s * 0.12], 0.012, R0 + 0.007, lc));
    const sp = shellPoint(c, 0.675, 0, R0 + 0.008); push('misc', boxOn(c, 'torso', 0.045, 0.062, 0.004, sp.p.clone().setZ(sp.p.z + 0.002), 0xf1f1ef));
  }
  if (acc.includes('stethoscope') || O.stethoscope) {
    for (const s of [1, -1]) push('misc', torsoStrip(c, [0.85, s * 2.1], [0.70, s * 0.3], 0.008, R0 + 0.009, 0x16181b));
    const sp = shellPoint(c, 0.695, 0, R0 + 0.01); push('misc', cylOn(c, 'torso', 0.014, 0.014, 0.008, sp.p.clone().setZ(sp.p.z + 0.004), 0xb8bcc2, [Math.PI / 2, 0, 0]));
  }
  if (acc.includes('pen_pocket')) { const sp = shellPoint(c, 0.75, -0.6, R0 + 0.005); push('misc', cylOn(c, 'torso', 0.0045, 0.0045, 0.075, sp.p.clone().add(V(0, 0.012, 0.004)), 0x1b3f7a)); push('misc', cylOn(c, 'torso', 0.003, 0.003, 0.03, sp.p.clone().add(V(0, 0.03, 0.008)), 0xd9d9d9)); }
  if (acc.includes('notebook_pocket')) { const sp = shellPoint(c, 0.55, 1.0, R0 + 0.006); push('misc', boxOn(c, 'torso', 0.05, 0.075, 0.012, sp.p.clone().add(V(0.002, 0.02, 0)), 0x7a2f2a, [0, 1.0, 0])); }
  if (acc.includes('satchel')) {
    const R = R0 + 0.012;
    push('misc', torsoStrip(c, [0.835, 1.35], [0.5, -1.3], 0.045, R, 0x5a3d25));
    push('misc', torsoStrip(c, [0.835, 1.35], [0.84, 2.4], 0.045, R, 0x5a3d25));
    push('misc', torsoStrip(c, [0.84, 2.4], [0.5, 4.5], 0.045, R, 0x5a3d25));
    const sp = shellPoint(c, 0.5, -1.55, R + 0.02);
    push('misc', boxOn(c, 'hips', 0.09, 0.2, 0.28, sp.p.clone().add(V(-0.045, -0.075, -0.02)), 0x6a4a2e));
    push('misc', boxOn(c, 'hips', 0.094, 0.07, 0.285, sp.p.clone().add(V(-0.045, 0.0, -0.02)), 0x573b24));
  }
  if (acc.includes('watch')) { push('misc', limbShell(c, 'arm', 'L', { u0: 2.86, u1: 2.93, off: R0 + 0.012, n: 2, color: 0x1a1d22, tile: 0.03 })); const w = c.J.handL; push('glow', boxOn(c, 'handL', 0.006, 0.026, 0.026, V(w.x + 0.034, w.y + 0.03, w.z), 0xc8f4ff)); }
  if (acc.includes('glasses_round') || acc.includes('glasses_tiny')) {
    const tiny = acc.includes('glasses_tiny'), k = head.sh, r = (tiny ? 0.0165 : 0.0215), pe = new THREE.Color(tiny ? 0xb08d57 : 0x1a1a1d), geoms = [];
    const ex = 0.0315 * P.face.eyeSpacing * Math.sqrt(P.face.width);
    for (const s of [1, -1]) {
      const sf = surfaceAt(head, s * ex, 0.0045).z + 0.017;
      const ring = new THREE.TorusGeometry(r * k, 0.0014, 6, 20); ring.scale(1, tiny ? 0.78 : 0.95, 1);
      const cen = nomToModel(head, [s * ex, 0.0045 + (tiny ? 0 : 0.001), sf]);
      ring.translate(cen.x, cen.y, cen.z); geoms.push(ring);
      const lens = new THREE.CircleGeometry(r * k * 0.97, 14); lens.scale(1, tiny ? 0.78 : 0.95, 1); lens.translate(cen.x, cen.y, cen.z); applySkin(lens, rigid(c.bi, 'head')); push('glass', fin(lens, 0xffffff));
      const a = nomToModel(head, [s * (ex + r), 0.0075, sf]), b = nomToModel(head, [s * 0.0775, 0.012, -0.012]);
      const len = a.distanceTo(b), tg = new THREE.CylinderGeometry(0.0012, 0.0012, len, 5); tg.rotateX(Math.PI / 2);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(a, b, V(0, 1, 0)));
      const mid = a.clone().add(b).multiplyScalar(0.5); tg.applyQuaternion(q); tg.translate(mid.x, mid.y, mid.z); geoms.push(tg);
    }
    const brg = nomToModel(head, [0, 0.0085, surfaceAt(head, 0, 0.0085).z + 0.018]); const bridge = new THREE.CylinderGeometry(0.0013, 0.0013, 0.012 * k, 5); bridge.rotateZ(Math.PI / 2); bridge.translate(brg.x, brg.y, brg.z); geoms.push(bridge);
    for (const g of geoms) { applySkin(g, rigid(c.bi, 'head')); push('misc', fin(g, pe)); }
  }
  if (acc.includes('aipin') || O.aipin) {
    const J = c.J, y = J.chest.y + (J.neck.y - J.chest.y) - 0.045, hp = shellPoint(c, yfOf(c, y), -0.52, R0 + 0.006);
    push('misc', cylOn(c, 'chest', 0.016, 0.016, 0.005, hp.p, 0x15181c, [Math.PI / 2, -0.52, 0]));
    const q = hp.p.clone().addScaledVector(hp.n, 0.0035), disc = new THREE.CylinderGeometry(0.0115, 0.0115, 0.003, 14); disc.rotateX(Math.PI / 2); disc.rotateY(-0.52); disc.translate(q.x, q.y, q.z); applySkin(disc, rigid(c.bi, 'chest')); push('glow', fin(disc, 0x8ff3ff));
    G.pin = true;
  }

  // ---------------------------------------------------------------- shoes + gloves
  const sh = O.shoes || {}, shType = sh.type || 'sneakers';
  const shCol = new THREE.Color(sh.color || '#222'), soleCol = new THREE.Color(sh.sole || ({ sneakers: '#f0efe9', techsneaker: '#0b0d10', clog: '#e8e8e8', sandals: '#2a241f' })[shType] || '#17120f');
  for (const S of ['L', 'R']) { const p = shoeParts(c, S, shType, shCol, soleCol); push('shoes', p.upper); push('shoes', p.sole); for (const e of p.extra) push('shoes', e); }
  if (O.gloves || acc.includes('fingerless_gloves')) {
    const gc = new THREE.Color((O.gloves && O.gloves.color) || '#1a1a1a'), fl = acc.includes('fingerless_gloves') || (O.gloves && O.gloves.fingerless);
    for (const S of ['L', 'R']) for (const g of gloveParts(c, S, { thick: 0.0035, fingerless: fl })) { const a = g.attributes.color; for (let i = 0; i < a.count; i++) a.setXYZ(i, gc.r, gc.g, gc.b); push('glove', g); }
  }

  // ---------------------------------------------------------------- materials & meshes
  const meshes = [], mats = {};
  const mk = (slot, fab, o = {}) => { const g = combine(G[slot]); if (!g) return null; const m = mats[slot] = clothMat(fab, 0xffffff, fx, { vertexColors: true, ...o }); meshes.push({ geometry: g, material: m, name: 'cl_' + slot, cast: true }); return m; };
  const camoMap = (slot, spec) => (camo[slot] ? { map: camoTex(spec.camo === true ? 'woodland' : spec.camo) } : {});
  mk('top', TS.fab, { double: TS.sl === 'none' || !!TS.robe, ...camoMap('top', T) });
  mk('outer', OS ? OS.fab : 'twill', { double: true, ...(outer ? camoMap('outer', outer) : {}) });
  mk('bottom', B ? BS.fab : TS.fab, { double: !!(BS && BS.skirt), ...(B ? camoMap('bottom', B) : {}) });
  mk('shoes', ['boots', 'work', 'heels', 'clog'].includes(shType) ? 'leather' : 'canvas', { rough: shType === 'heels' ? 0.32 : 0.6 });
  mk('misc', 'leather', { rough: 0.5, double: true, metal: 0.12 });
  mk('apron', 'canvas', { double: true }); mk('terry', 'terry', { double: true }); mk('glove', 'leather', { rough: 0.55 });
  const gm = mk('glow', 'plain', { emissive: 0x55e6ff, emissiveIntensity: 2.6, rough: 0.4, double: true });
  mk('glow0', 'plain', { emissive: 0xffa040, emissiveIntensity: 1.6, rough: 0.5, double: true });
  const glassG = combine(G.glass);
  if (glassG) meshes.push({ geometry: glassG, material: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }), name: 'cl_glass', cast: false });
  for (const d of (G.decals || [])) meshes.push({ geometry: d.geo, material: new THREE.MeshStandardMaterial({ map: d.tex, transparent: true, alphaTest: 0.4, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }), name: 'cl_decal', cast: false });
  return { meshes, outfit: O, update(dt, t) { if (gm && G.pin) gm.emissiveIntensity = 2.4 + 0.5 * Math.sin(t * 2.1); } };
}
