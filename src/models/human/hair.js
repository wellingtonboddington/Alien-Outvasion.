// Hair: scalp cap + layered strand cards (grown over the skull by a small strand walker), spring-chain sway bones, facial hair, headwear.
// planHair(P, L) -> { bones:[{name,parent,pos}], chains, style }      (extra rig bones for sway)
// buildHair(P, L, rig, head, fx, plan) -> { meshes:[{geometry,material,name,cast}], update(dt,t,human), dispose(), setFrost(a), setInfectTint(strain,a) }
// Styles: bald buzz crop fade sidepart slick messy pixie curls bob long_wavy long_straight ponytail low_ponytail bun balding   (+ headwear from outfit.cap / hair.hat)
import * as THREE from 'three';
import { RNG, Q } from '../../engine/common.js';
import { V, smooth, mixn, applySkin, rigid, mergeAll } from './kit.js';
import { HeadShape, hairline, capGeometry, growStrand, Cards, chainSkin, lateralSkin, strandTex, capTex, CROWN } from './hairlib.js';
import { buildHeadwear } from './hairlib_wear.js';
import { patchMaterial } from './skin.js';
import { clothMat } from './wear_tex.js';
import { headProfile, surfaceAt } from './head.js';

const ALIAS = { long: 'long_straight', long_wave: 'long_wavy', wavy: 'long_wavy', afro: 'curls', curly: 'curls', short: 'crop', short_wavy: 'crop', side_part: 'sidepart', comb_over: 'slick', cap: 'buzz', shaved: 'buzz', undercut: 'fade' };
const KNOWN = ['bald', 'buzz', 'crop', 'fade', 'sidepart', 'slick', 'messy', 'pixie', 'curls', 'bob', 'long_wavy', 'long_straight', 'ponytail', 'low_ponytail', 'bun', 'balding'];
export const HAIR_STYLES = KNOWN;
const styleOf = (P) => { let s = (P.hair && P.hair.style) || 'crop'; s = ALIAS[s] || s; return KNOWN.includes(s) ? s : 'crop'; };
const LONG = ['long_wavy', 'long_straight'];

export function planHair(P, L) {
  const st = styleOf(P), pivot = L.J.head, sh = L.dims.sh;
  const M = (x, y, z) => V(pivot.x + x * sh, pivot.y + y * sh, pivot.z + z * sh);
  const bones = [], chains = [];
  const add = (id, nodes, o = {}) => { const names = nodes.map((_, k) => `hair_${id}_${k}`); nodes.forEach((n, k) => bones.push({ name: names[k], parent: k ? names[k - 1] : 'head', pos: M(...n) })); chains.push({ id, names, nodes, ...o }); };
  if (LONG.includes(st)) for (const [id, x] of [['L', 0.055], ['C', 0], ['R', -0.055]]) add(id, [-0.06, -0.125, -0.19, -0.255].map((y) => [x, y, -0.088]), { stiff: [0, 0.2, 0.12, 0.07], x });
  else if (st === 'bob') for (const [id, x] of [['L', 0.055], ['C', 0], ['R', -0.055]]) add(id, [-0.035, -0.075, -0.112].map((y) => [x, y, -0.088]), { stiff: [0, 0.28, 0.2], x });
  else if (st === 'ponytail') add('P', [0, 1, 2, 3, 4].map((k) => [0, 0.03 - 0.062 * k, -0.108 - 0.02 * k]), { stiff: [0, 0.2, 0.12, 0.08, 0.05] });
  else if (st === 'low_ponytail') add('P', [0, 1, 2, 3].map((k) => [0, -0.062 - 0.07 * k, -0.098 - 0.012 * k]), { stiff: [0, 0.2, 0.12, 0.07] });
  return { bones, chains, style: st };
}

const hairColors = (P) => {
  const H = P.hair, g = Math.min(1, (H.gray || 0) + P.elder * 0.85), gray = new THREE.Color('#cfcfcf');
  const base = new THREE.Color(H.color || '#222').lerp(gray, g * 0.8), hi = new THREE.Color(H.hi || H.color || '#222').lerp(gray, g * 0.8);
  if (!H.hi) hi.multiplyScalar(1.5);
  return { base, hi };
};
const sgn = (v) => (v >= 0 ? 1 : -1);

export function buildHair(P, L, rig, head, fx, plan) {
  const hs = new HeadShape(head, L, P), rng = new RNG((P.seed ^ 0x51ed27) >>> 0), bi = rig.index, sh = hs.sh;
  const st = plan.style, vol = P.hair.volume ?? 1, lenK = P.hair.length ?? 1;
  const { base, hi } = hairColors(P);
  const qk = 0.75 + 0.125 * Q.detail;
  const meshes = [], fh = P.facialHair || { type: 'none' }, cap = (P.outfit && P.outfit.cap) || P.hair.hat || null;
  const hw = cap ? buildHeadwear(P, hs, bi, typeof cap === 'string' ? { type: cap } : cap) : null;
  const cover = hw ? hw.cover : 'none';
  const isLong = LONG.includes(st) || st === 'ponytail' || st === 'low_ponytail' || st === 'bob';
  const hlOpt = { fade: { side: 0.03, back: 0.045 }, buzz: { side: 0.012, back: 0.02 }, pixie: { back: 0.02 }, sidepart: { side: 0.02, back: 0.03 }, slick: { side: 0.015, back: 0.03 }, balding: { front: 0.05 } }[st] || {};
  const capKind = ['buzz', 'crop', 'fade', 'sidepart', 'slick', 'pixie', 'balding', 'messy'].includes(st) ? 'fade' : st === 'curls' ? 'curly' : 'fadeS';
  const groups = []; let bun = null;
  const D0 = V(0, -1, 0);
  const dirTo = (a, b, out) => out.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
  const scatter = (n, o) => {
    const out = []; let guard = 0; const y0 = o.y0 ?? 0, y1 = o.y1 ?? 0.108, pa = o.phiA ?? -Math.PI, pb = o.phiB ?? Math.PI;
    while (out.length < n && guard++ < n * 60) {
      const y = mixn(y0, y1, rng.next()), phi = mixn(pa, pb, rng.next());
      if (y < hairline(phi, hlOpt) + 0.006) continue;
      const A = headProfile(Math.min(y, CROWN - 0.002))[0] / 0.0772; if (rng.next() > A * A + 0.05) continue;
      out.push({ y, phi });
    }
    return out;
  };
  const frontFlow = (fz, sdx, dn) => (p, s, d, out) => out.set(sdx * sgn(p.x) * Math.min(1, Math.abs(p.x) * 14), -dn - s * 0.5, p.z > 0.03 ? fz : (p.z < -0.04 ? -0.45 : 0)).normalize();
  const colorOf = () => (rng.chance(0.3) ? hi : base).clone().multiplyScalar(0.88 + 0.24 * rng.next());
  const longGroup = (amp, freq) => ({ n: 380, y0: -0.03, y1: 0.108, len: [0.3, 0.36], w: [0.02, 0.01], off: 0.003, mk: (r) => { const yE = -0.255 + rng.range(-0.02, 0.01), sx = sgn(r.x || rng.next() - 0.5); return { n: 15, yEnd: yE, follow: 0.28, droop: 0.22, margin: 0.005, wave: [amp * rng.range(0.7, 1.2), freq], phase: rng.next(), flow: (p, s, d, o) => o.set(sx * (p.y > 0 ? 0.55 * (1 - smooth(0, 1, s * 2)) : 0), -1, p.y < -0.05 ? -0.12 : -0.05).normalize(), d0: V(sx * 0.5, -0.1, r.z > 0.04 ? 0.3 : -0.2) }; } });
  const ponytail = (tie, hang) => groups.push({ n: 230, y0: tie.y < 0 ? -0.04 : 0, y1: 0.108, len: [0.2, 0.2], w: [0.016, 0.01], off: 0.003, mk: (r) => {
    const t = tie.clone().add(V(rng.range(-0.012, 0.012), rng.range(-0.01, 0.01), rng.range(-0.008, 0.008))), stt = { reached: false }, dx = rng.range(-0.18, 0.18), dz = rng.range(-0.08, 0.08), hl = hang * rng.range(0.85, 1.05);
    const dist = Math.hypot(t.x - r.x, t.y - r.y, t.z - r.z) * 1.3 + hl;
    return { n: Math.max(10, Math.min(30, Math.ceil(dist / 0.011))), lenOverride: dist, follow: 0.5, droop: 0, margin: 0.0045, wave: [0.006, 2.5], phase: rng.next(),
      flow: (p, s, d, o) => { const dd = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z); if (!stt.reached && dd > 0.018) dirTo(p, t, o); else { stt.reached = true; o.set(dx, -1, -0.16 + dz).normalize(); } }, d0: dirTo(r, t, V()) };
  } });
  const defs = {
    bald() { }, buzz() { },
    crop: () => groups.push({ n: 190, y0: 0.03, y1: 0.108, len: [0.026, 0.044], w: [0.016, 0.005], off: 0.0025, mk: (r) => ({ follow: 0.35, droop: 0.06, margin: 0.003, flow: frontFlow(0.75, 0.5, 0.5), d0: V(r.x * 2, 0.5, r.z > 0.03 ? 0.7 : -0.1) }) }),
    fade: () => groups.push({ n: 150, y0: 0.045, y1: 0.108, phiA: -2.3, phiB: 2.3, len: [0.03, 0.052], w: [0.016, 0.005], off: 0.003, mk: () => ({ follow: 0.35, droop: 0.05, margin: 0.003, flow: (p, s, d, o) => o.set(sgn(p.x) * 0.15, -0.25, -0.6).normalize(), d0: V(0, 0.8, 0.2) }) }),
    sidepart: () => {
      groups.push({ n: 240, y0: 0.035, y1: 0.108, phiA: -2.6, phiB: 2.6, len: [0.05, 0.078], w: [0.017, 0.005], off: 0.004, mk: (r) => { const s0 = r.x > 0.026 ? 1 : -1; return { follow: 0.3, droop: 0.1, margin: 0.004 + 0.003 * vol, wave: [0.004, 1.2], flow: (p, s, d, o) => o.set(s0 * 0.85, -0.4 - s * 0.5, -0.08).normalize(), d0: V(s0 * 0.5, 0.45, 0.35) }; } });
      groups.push({ n: 70, y0: 0, y1: 0.06, phiA: 0.9, phiB: 2.4, len: [0.025, 0.04], w: [0.011, 0.004], off: 0.003, mirror: true, mk: () => ({ follow: 0.4, droop: 0.15, margin: 0.003, flow: (p, s, d, o) => o.set(0, -1, -0.3).normalize(), d0: V(0, -0.4, -0.2) }) });
    },
    slick: () => groups.push({ n: 230, y0: 0.03, y1: 0.108, phiA: -2.7, phiB: 2.7, len: [0.05, 0.075], w: [0.017, 0.005], off: 0.003, mk: (r) => { const s0 = r.x > 0.022 ? 1 : -1; return { follow: 0.4, droop: 0.08, margin: 0.003, flow: (p, s, d, o) => o.set(s0 * 0.45, -0.35, -0.75).normalize(), d0: V(s0 * 0.3, 0.2, -0.4) }; } }),
    messy: () => groups.push({ n: 280, y0: 0.02, y1: 0.112, len: [0.045, 0.08], w: [0.017, 0.005], off: 0.006, mk: () => { const h = V(rng.range(-1, 1), rng.range(0.1, 1), rng.range(-0.7, 1)).normalize(), sc = rng.range(0.5, 1); return { follow: 0.25, droop: 0.12, margin: 0.005 + 0.004 * vol, curl: [0.012, 1.5], wave: [0.01, 2], phase: rng.next(), flow: (p, s, d, o) => o.copy(h).multiplyScalar(1 - s * sc).addScaledVector(D0, s * sc * 1.1).normalize(), d0: h.clone() }; } }),
    pixie: () => groups.push({ n: 230, y0: 0.01, y1: 0.108, len: [0.032, 0.062], w: [0.016, 0.005], off: 0.003, mk: () => ({ follow: 0.35, droop: 0.07, margin: 0.003, flow: (p, s, d, o) => { if (p.z > 0.02 && p.y > 0.03) o.set(0.75, -0.3 - s * 0.3, 0.5); else o.set(sgn(p.x) * 0.3, -0.7, p.z < -0.04 ? -0.5 : 0); o.normalize(); }, d0: V(0.6, 0.4, 0.5) }) }),
    curls: () => groups.push({ n: 130, y0: 0.01, y1: 0.112, len: [0.035, 0.06], w: [0.013, 0.007], off: 0.01, mk: (r) => ({ follow: 0.6, droop: 0.03, margin: 0.014, curl: [0.018, 3.5], wave: [0.01, 2.5], phase: rng.next(), flow: (p, s, d, o) => hs.outward(p, o), d0: hs.outward(r, V()) }) }),
    bob: () => groups.push({ n: 320, y0: 0, y1: 0.108, len: [0.15, 0.2], w: [0.019, 0.01], off: 0.003, mk: (r) => ({ n: 14, yEnd: rng.range(-0.1, -0.075), follow: 0.28, droop: 0.2, margin: 0.005, wave: [0.004, 2], phase: rng.next(), flow: (p, s, d, o) => o.set(sgn(p.x) * (p.y > 0.03 ? 0.4 : 0) * Math.min(1, Math.abs(p.x) * 12), -1, -0.1 + (p.y < -0.02 ? 0.12 : 0)).normalize(), d0: V(sgn(r.x) * 0.4, -0.2, r.z > 0.03 ? 0.4 : -0.1) }) }),
    long_straight: () => groups.push(longGroup(0.002, 3)),
    long_wavy: () => groups.push(longGroup(0.011, 2.2)),
    ponytail: () => ponytail(V(0, 0.03, -0.108), 0.19),
    low_ponytail: () => ponytail(V(0, -0.062, -0.098), 0.2),
    bun: () => { const c = V(0, 0.048, -0.106), R = 0.036; bun = { c, R }; groups.push({ n: 200, y0: 0, y1: 0.108, len: [0.12, 0.2], w: [0.016, 0.009], off: 0.003, mk: () => ({ n: 16, follow: 0.5, droop: 0, margin: 0.004, flow: (p, s, d, o) => dirTo(p, c, o), stop: (p) => Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) < R + 0.008, d0: V(0, 0.3, -0.7) }) }); },
    balding: () => groups.push({ n: 70, y0: -0.04, y1: 0.03, len: [0.02, 0.035], w: [0.011, 0.004], off: 0.003, mk: () => ({ follow: 0.4, droop: 0.2, margin: 0.003, flow: (p, s, d, o) => o.set(sgn(p.x) * 0.1, -1, -0.2).normalize(), d0: V(0, -0.3, -0.2) }) }),
  };
  (defs[st] || defs.crop)();

  // ------------------------------------------------------------ scalp cap + bun
  let capGeo = null, bunGeo = null;
  if (st !== 'bald') {
    capGeo = capGeometry(hs, { nr: 16, nc: Math.round(52 * (0.8 + 0.1 * Q.detail)), yBot: (phi) => hairline(phi, hlOpt), yTop: st === 'balding' ? 0.03 : CROWN - 0.003, off: 0.0028 + (st === 'curls' ? 0.013 : 0), offFn: st === 'curls' ? (y, phi) => 0.006 * Math.sin(phi * 9 + y * 90) : (st === 'messy' ? (y) => 0.002 * smooth(0.03, 0.1, y) * vol : null), color: base, uvRep: st === 'curls' ? 5 : 3 });
    applySkin(capGeo, rigid(bi, 'head'));
  }
  if (bun) {
    const g = new THREE.SphereGeometry(1, 22, 14); g.scale(bun.R * sh, bun.R * 0.9 * sh, bun.R * sh);
    const m = hs.toModel(bun.c); g.translate(m.x, m.y, m.z);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i));
    const n = g.attributes.position.count, ca = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const k = 0.9 + 0.1 * Math.sin(i * 0.37); ca[i * 3] = base.r * k; ca[i * 3 + 1] = base.g * k; ca[i * 3 + 2] = base.b * k; } g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    applySkin(g, rigid(bi, 'head')); bunGeo = g;
  }

  // ------------------------------------------------------------ strand cards
  const cards = new Cards(hs), tmp = { p: V(), n: V() };
  for (const g of groups) {
    const n = Math.round(g.n * qk * (cover === 'full' && !isLong ? 0 : 1));
    for (const r of scatter(n, g)) {
      if (cover === 'full' && r.y > -0.03) continue;
      if (cover === 'cap' && r.y > 0.036) continue;
      if (cover === 'band' && r.y < 0.066) continue;
      const rootV = hs.point(r.y, r.phi, g.off + (hw ? 0 : 0.001 * vol), tmp).p.clone();
      const S = g.mk(rootV); if (S.hug === undefined && !isLong && st !== 'messy' && st !== 'curls') S.hug = 0.6; S.len = (S.lenOverride || rng.range(g.len[0], g.len[1])) * (S.lenOverride ? 1 : lenK); S.n = S.n || 10;
      if (hw) S.margin = Math.min(S.margin ?? 0.004, 0.004);
      const pts = growStrand(hs, rootV, S.d0 || D0, S);
      if (pts.length < 3) continue;
      const c = colorOf(), rc = c.clone().multiplyScalar(0.5), tc = c.clone().multiplyScalar(1.12), u0 = rng.range(0, 0.45), w0 = g.w[0] * rng.range(0.85, 1.2);
      cards.add(pts, w0, g.w[1], [rc, c, tc], u0, u0 + 0.55);
      if (g.mirror) cards.add(pts.map((p) => p.clone().setX(-p.x)), w0, g.w[1], [rc, c, tc], u0, u0 + 0.55);
    }
  }
  // facial hair (short 3D cards on top of the painted stipple)
  const faceGeos = [], dens = fh.density ?? 0.8, fcol = new THREE.Color(fh.color || P.hair.color);
  const faceHair = (n, x0, x1, y0, y1, len, down, bone, mirror = false) => {
    const fc = new Cards(hs);
    for (let i = 0; i < n; i++) {
      const x = mixn(x0, x1, rng.next()) * (mirror && rng.chance(0.5) ? -1 : 1), y = mixn(y0, y1, rng.next()), sf = surfaceAt(head, x, y);
      const root = V(x, y, sf.z + 0.0025), d0 = V(sf.nx * 0.4, -down, sf.nz * 0.6 + 0.15).normalize(), q = root.clone(), pts = [root.clone()];
      for (let k = 1; k <= 4; k++) { q.addScaledVector(d0, len / 4); q.y -= 0.0015 * k; pts.push(q.clone()); }
      const c = fcol.clone().multiplyScalar(0.5 + 0.3 * rng.next()); fc.add(pts, 0.0026, 0.0009, [c, c, c], rng.next() * 0.4, 0.6);
    }
    if (fc.n) { const g = fc.geometry(); applySkin(g, rigid(bi, bone)); faceGeos.push(g); }
  };
  if (['goatee', 'beard', 'chin'].includes(fh.type)) { faceHair(Math.round(70 * dens), -0.02, 0.02, -0.112, -0.088, 0.016, 0.9, 'jaw'); faceHair(Math.round(24 * dens), -0.008, 0.008, -0.083, -0.076, 0.009, 0.9, 'jaw'); }
  if (fh.type === 'beard') faceHair(Math.round(110 * dens), 0.025, 0.066, -0.115, -0.05, 0.016, 0.8, 'jaw', true);
  if (['moustache', 'goatee', 'beard'].includes(fh.type)) faceHair(Math.round(60 * dens), -0.026, 0.026, -0.058, -0.049, 0.011, 0.8, 'head');

  // spring-chain skinning for the hanging part
  let skinFn = rigid(bi, 'head');
  if (plan.chains.length) {
    const pv = hs.pivot, order = plan.chains.slice().sort((a, b) => (a.x || 0) - (b.x || 0)), fns = [], xs = [];
    for (const ch of order) {
      const joints = ch.nodes.map((n) => V(pv.x + n[0] * sh, pv.y + n[1] * sh, pv.z + n[2] * sh));
      const dirs = ch.nodes.map((n, k) => (k < ch.nodes.length - 1 ? V(ch.nodes[k + 1][0] - n[0], ch.nodes[k + 1][1] - n[1], ch.nodes[k + 1][2] - n[2]).normalize() : V(0, -1, 0)));
      fns.push(chainSkin(bi, ['head', ...ch.names], joints, dirs, joints[0].distanceTo(joints[1]) * 0.45)); xs.push(pv.x + (ch.x || 0) * sh);
    }
    skinFn = fns.length === 1 ? fns[0] : lateralSkin(fns, xs);
  }
  const cardList = [];
  if (cards.n) { const g = cards.geometry(); applySkin(g, skinFn); cardList.push(g); }
  cardList.push(...faceGeos);
  const allCards = cardList.length ? (cardList.length === 1 ? cardList[0] : mergeAll(cardList)) : null;

  // ------------------------------------------------------------ materials / meshes
  const mkMat = (tex, alpha) => patchMaterial(new THREE.MeshPhysicalMaterial({ map: tex, alphaTest: alpha, alphaToCoverage: alpha > 0, vertexColors: true, side: THREE.DoubleSide, roughness: 0.46, metalness: 0, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.2, 0.18, 0.16).lerp(hi, 0.4), envMapIntensity: 0.25, specularIntensity: 0.4 }), fx, { tag: 'hair' });
  const capMat = mkMat(capTex(capKind), 0.5), cardMat = mkMat(strandTex(), 0.42);
  if (capGeo) meshes.push({ geometry: capGeo, material: capMat, name: 'hair_cap', cast: true });
  if (bunGeo) meshes.push({ geometry: bunGeo, material: mkMat(capTex('solid'), 0), name: 'hair_bun', cast: true });
  if (allCards) meshes.push({ geometry: allCards, material: cardMat, name: 'hair_cards', cast: true });
  if (hw) {
    meshes.push({ geometry: hw.geo, material: clothMat(hw.fab, 0xffffff, fx, { vertexColors: true, double: true, rough: hw.rough }), name: 'hair_wear', cast: true });
    if (hw.glass) meshes.push({ geometry: hw.glass, material: new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), name: 'hair_glass', cast: false });
  }

  // ------------------------------------------------------------ spring sway
  const springs = [];
  for (const ch of plan.chains) {
    const bones = ch.names.map((n) => rig.bones[n]), rl = ch.nodes.map((n) => V(n[0] * sh, n[1] * sh, n[2] * sh));
    springs.push({ bones, rl, len: rl.map((r, k) => (k ? r.distanceTo(rl[k - 1]) : 0)), rest: bones.map((b, k) => (k < bones.length - 1 ? bones[k + 1].position.clone().normalize() : null)), stiff: ch.stiff || [0, 0.2, 0.12, 0.08], x: rl.map(() => V()), xp: rl.map(() => V()), tg: rl.map(() => V()), init: false });
  }
  const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _s = V(), _p = V(), _d = V(), _lh = V(), grav = V(0, -9.8 * 0.25, 0); let lastHead = null;
  function update(dt, t, human) {
    if (!springs.length) return;
    const hb = human.rig.bones.head; hb.updateWorldMatrix(true, false);
    hb.matrixWorld.decompose(_p, _q, _s); const scl = _s.x;
    const tele = lastHead && lastHead.distanceTo(_p) > 0.7; lastHead = (lastHead || V()).copy(_p);
    const n = Math.max(1, Math.min(4, Math.ceil(dt * 60))), h = Math.max(1e-4, Math.min(dt, 0.1)) / n;
    for (const sp of springs) {
      for (let k = 0; k < sp.rl.length; k++) sp.tg[k].copy(sp.rl[k]).applyMatrix4(hb.matrixWorld);
      if (!sp.init || tele || dt > 0.3 || dt <= 0) { for (let k = 0; k < sp.rl.length; k++) { sp.x[k].copy(sp.tg[k]); sp.xp[k].copy(sp.tg[k]); } sp.init = true; }
      else for (let s = 0; s < n; s++) {
        sp.x[0].copy(sp.tg[0]);
        for (let k = 1; k < sp.rl.length; k++) { _d.copy(sp.x[k]).sub(sp.xp[k]).multiplyScalar(0.9); sp.xp[k].copy(sp.x[k]); sp.x[k].add(_d).addScaledVector(grav, h * h); sp.x[k].lerp(sp.tg[k], 1 - Math.pow(1 - sp.stiff[k], h * 60)); }
        for (let it = 0; it < 2; it++) for (let k = 1; k < sp.rl.length; k++) { _d.copy(sp.x[k]).sub(sp.x[k - 1]); const l = _d.length() || 1; sp.x[k].copy(sp.x[k - 1]).addScaledVector(_d, sp.len[k] * scl / l); }
      }
      for (let k = 0; k < sp.bones.length - 1; k++) {
        const b = sp.bones[k]; b.parent.matrixWorld.decompose(_lh, _pq, _s);
        _lh.copy(b.position).applyMatrix4(b.parent.matrixWorld);
        _d.copy(sp.x[k + 1]).sub(_lh).normalize().applyQuaternion(_pq.invert());
        b.quaternion.setFromUnitVectors(sp.rest[k], _d); b.updateWorldMatrix(false, false);
      }
      sp.bones[sp.bones.length - 1].quaternion.identity();
    }
  }
  return {
    meshes, update, dispose() { },
    setFrost(a) { for (const m of [capMat, cardMat]) { m.roughness = mixn(0.46, 0.8, a); m.sheen = mixn(0.35, 0.1, a); } },
    setInfectTint(strain, a) { const k = strain ? 1 - 0.35 * a : 1; for (const m of [capMat, cardMat]) m.color.setRGB(k, k, k); },
  };
}
