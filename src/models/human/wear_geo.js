// Geometry builders for clothing: skinned offset shells of the body (torso / limbs / skirts / shoes / gloves) + trims.
// Every builder returns a BufferGeometry with position/normal/uv/color/skinIndex/skinWeight (mergeable with kit.mergeAll).
import * as THREE from 'three';
import { V, ringLoft, rseg, smooth, mixn, makeChain, applySkin, mergeAll, rigid, tint } from './kit.js';
import { torsoStations, makeLimbs, makeBumps, applyBumps, buildHand } from './body.js';

const TAU = Math.PI * 2;
const sgnpow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const perim = (rx, rz) => Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)));

export function wearCtx(P, L, rig) {
  const bi = rig.index, { J, dims } = L;
  const c = { P, L, rig, bi, J, dims, H: dims.H, sc: dims.H / 1.75, F: P.isFemale, limbs: makeLimbs(P, L), bumps: makeBumps(P, L), radial: rseg(26, 12) };
  const midHS = (a, b) => V(0, (J[a].y + J[b].y) / 2, 0);
  c.torsoSkin = makeChain(bi, ['hips', 'spine', 'chest'], [midHS('hips', 'spine').setY(J.hips.y + (J.spine.y - J.hips.y) * 0.8), midHS('spine', 'chest')], [0.05, 0.07]);
  c.armSkin = (S) => makeChain(bi, ['clavicle' + S, 'upperArm' + S, 'foreArm' + S, 'hand' + S], [J['upperArm' + S], J['foreArm' + S], J['hand' + S]], [0.05, 0.035, 0.022]);
  c.legSkin = (S) => makeChain(bi, ['hips', 'upperLeg' + S, 'lowerLeg' + S, 'foot' + S], [J['upperLeg' + S], J['lowerLeg' + S], J['foot' + S]], [0.05, 0.04, 0.022]);
  c.neckSkin = makeChain(bi, ['chest', 'neck'], [V(0, J.neck.y - 0.01, 0)], [0.02]);
  return c;
}

/** make a geometry mergeable: uv + colour, no stray attributes */
export function fin(g, color = 0xffffff) {
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  if (color !== null && !g.attributes.color) tint(g, color);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
  return g;
}
export const combine = (list) => { const l = (list || []).filter(Boolean); return l.length ? mergeAll(l) : null; };

function uvFor(sts, tile) {
  let len = 0; for (let i = 1; i < sts.length; i++) len += V().copy(sts[i].c).distanceTo(sts[i - 1].c);
  const m = sts[sts.length >> 1];
  return { u0: 0, u1: Math.max(1, perim(m.rx, m.rz) / tile), v0: 0, v1: Math.max(0.5, len / tile) };
}
/** remove quads (row i, column k) for which pred(i, k, delta, rowIdx) is true; delta = angle from the front (-PI..PI) */
function cutQuads(g, radial, nRows, pred) {
  const ix = g.index.array, out = [], R1 = radial + 1, lim = nRows * R1;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t], b = ix[t + 1], c = ix[t + 2];
    if (a >= lim || b >= lim || c >= lim) { out.push(a, b, c); continue; }
    const row = Math.min(Math.floor(a / R1), Math.floor(b / R1), Math.floor(c / R1));
    const k = Math.min(a % R1, b % R1, c % R1);
    const delta = ((k + 0.5) / radial) * TAU - Math.PI;
    if (!pred(row, k, delta)) out.push(a, b, c);
  }
  g.setIndex(out); return g;
}

/** torso-region shell. o: {y0,y1 (yf), off, offFn(yf,row), tile, color, capStart, closeEnd, bump, open(yf)->half angle, keep(yf)->half angle (keep only front sector), n} */
export function torsoShell(c, o = {}) {
  const { P, L } = c;
  const y0 = o.y0 ?? 0.5, y1 = o.y1 ?? 0.855, n = o.n || Math.max(7, Math.round((y1 - y0) / 0.016));
  const rows = torsoStations(P, L, { n, y0, y1 });
  for (const r of rows) { const e = (o.off ?? 0.008) + (o.offFn ? o.offFn(r.yf, r) : 0); r.rx += e; r.rz += e; }
  const g = ringLoft(rows, { radial: c.radial, uv: uvFor(rows, o.tile || 0.06), ref: [0, 0, 1], capStart: o.capStart || 0, closeEnd: !!o.closeEnd });
  if (o.bump !== 0) applyBumps(g, c.bumps, o.bump ?? 1);
  if (o.open || o.keep) cutQuads(g, c.radial, rows.length, (i, k, d) => (o.open && Math.abs(d) < o.open((rows[i].yf + rows[Math.min(rows.length - 1, i + 1)].yf) / 2)) || (o.keep && Math.abs(d) > o.keep(rows[i].yf)));
  applySkin(g, c.torsoSkin); g.userData.rows = rows;
  return fin(g, o.color);
}

/** arm / leg tube shell. kind 'arm'|'leg'; o: {u0,u1,off,offFn(u),tile,color,closeStart,n,pw} */
export function limbShell(c, kind, S, o = {}) {
  const limb = c.limbs[kind + S];
  const u0 = o.u0 ?? 0, u1 = o.u1 ?? 3, n = o.n || Math.max(5, Math.round((u1 - u0) * 6));
  const sts = limb.stations(u0, u1, n, { off: o.off ?? 0.008, pw: o.pw ?? 2, fn: (u, st) => { if (o.offFn) { const e = o.offFn(u); st.rx += e; st.rz += e; } } });
  const g = ringLoft(sts, { radial: rseg(kind === 'arm' ? 14 : 16, 8), uv: uvFor(sts, o.tile || 0.06), ref: [0, 0, 1], closeStart: !!o.closeStart, closeEnd: !!o.closeEnd });
  applySkin(g, kind === 'arm' ? c.armSkin(S) : c.legSkin(S));
  g.userData.sts = sts;
  return fin(g, o.color);
}

/** hanging skirt / coat tails from the waist (yf top) down to hem (metres). o: {top (yf), hem (m), off, flare(s 0..1 hem->hip), tile, color, open(yf|s)->half angle, keep(...)} */
export function skirtShell(c, o = {}) {
  const { P, L, H, J, dims } = c;
  const hipY = J.hips.y, yCr = 0.47 * H;
  const top = Math.max(o.top ?? 0.62, 0.56);
  const upper = torsoStations(P, L, { n: Math.max(4, Math.round((top - 0.52) / 0.015)), y0: 0.52, y1: top });
  const base = upper[0];
  const leg = c.limbs.legL;
  const sts = []; const nLow = o.nLow || 12;
  for (let i = 0; i < nLow; i++) {
    const s = i / (nLow - 1);                // 0 hem .. 1 at y=0.52H
    const y = mixn(o.hem, 0.52 * H, s);
    const u = 1 + clamp01((hipY - y) / (hipY - dims.kneeY)) * 1.0 + (y < dims.kneeY ? clamp01((dims.kneeY - y) / (dims.kneeY - dims.ankleY)) : 0);
    const st = leg.at(Math.min(2.8, u));
    const legOut = Math.abs(J.upperLegL.x) + st.rx, legZ = st.rz;
    const fl = (o.flare ? o.flare(1 - s) : 0);
    const rx = Math.max(base.rx * 0.98, legOut * 1.02) + fl, rz = Math.max(base.rz * 0.92, legZ * 1.1) + fl * 0.9;
    sts.push({ c: V(0, y, mixn(0.0, base.c.z, smooth(0, 1, s))), rx, rz, pw: mixn(2.2, base.pw, s), yf: y / H, low: true });
  }
  const rows = sts.concat(upper.slice(1).map((r) => ({ ...r })));
  const off = o.off ?? 0.012;
  for (const r of rows) { r.rx += off; r.rz += off; }
  const g = ringLoft(rows, { radial: c.radial, uv: uvFor(rows, o.tile || 0.06), ref: [0, 0, 1] });
  applyBumps(g, c.bumps, o.bump ?? 0.8);
  if (o.open || o.keep) cutQuads(g, c.radial, rows.length, (i, k, d) => { const yf = (rows[i].yf + rows[Math.min(rows.length - 1, i + 1)].yf) / 2; return (o.open && Math.abs(d) < o.open(yf)) || (o.keep && Math.abs(d) > o.keep(yf)); });
  const iL = c.bi['upperLegL'], iR = c.bi['upperLegR'];
  const tmp = { i: [0, 0, 0, 0], w: [0, 0, 0, 0] };
  applySkin(g, (x, y, z, out) => {
    c.torsoSkin(x, y, z, tmp);
    const k = (o.legK ?? 0.7) * smooth(0, 1, (hipY - y) / (hipY - dims.kneeY));
    if (k <= 0.001) { out.i = tmp.i.slice(); out.w = tmp.w.slice(); return; }
    // top-2 torso influences scaled by (1-k) + two leg influences
    const idx = [0, 1, 2, 3].filter((q) => tmp.w[q] > 0).sort((a, b) => tmp.w[b] - tmp.w[a]).slice(0, 2);
    const wl = clamp01(0.5 + x / 0.1);
    out.i = [0, 0, iL, iR]; out.w = [0, 0, k * wl, k * (1 - wl)];
    let s2 = 0; for (const q of idx) s2 += tmp.w[q];
    idx.forEach((q, j) => { out.i[j] = tmp.i[q]; out.w[j] = tmp.w[q] / s2 * (1 - k); });
  });
  g.userData.rows = rows;
  return fin(g, o.color);
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** short ring band around the neck (collar). o: {y (yf), h, off, flare, color, tile} */
export function collarBand(c, o = {}) {
  const { P, L } = c;
  const r = torsoStations(P, L, { n: 2, y0: o.y ?? 0.855, y1: o.y ?? 0.855 })[0];
  const e = o.off ?? 0.01, h = o.h ?? 0.03;
  const sts = [{ c: r.c.clone(), rx: r.rx + e, rz: r.rz + e, pw: r.pw }, { c: r.c.clone().add(V(0, h, 0.004)), rx: r.rx + e + (o.flare ?? 0.004), rz: r.rz + e + (o.flare ?? 0.004), pw: r.pw }];
  const g = ringLoft(sts, { radial: c.radial, uv: { u0: 0, u1: 6, v0: 0, v1: 0.5 }, ref: [0, 0, 1] });
  applySkin(g, c.neckSkin);
  return fin(g, o.color);
}

/** point on the torso shell: yf row, ang from the front (rad, + = character-left), extra offset -> {p, n} */
export function shellPoint(c, yf, ang, off = 0.008) {
  const r = torsoStations(c.P, c.L, { n: 2, y0: yf, y1: yf })[0];
  const pw = 2 / r.pw, ca = sgnpow(Math.cos(ang), pw), sa = sgnpow(Math.sin(ang), pw);
  const p = V(sa * (r.rx + off), r.y, r.c.z + ca * (r.rz + off));
  const n = V(sa / (r.rx + off), 0, ca / (r.rz + off)).normalize();
  return { p, n };
}

/** ribbon strip following points pts[] lying on a surface with normals nrm[], width w (number or fn(i)) */
export function strip(pts, nrm, w, skinFn, color = 0xffffff, uvScale = 1) {
  const pos = [], uv = [], idx = [], N = pts.length; let cum = 0;
  for (let i = 0; i < N; i++) {
    const t = pts[Math.min(N - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    const side = V().crossVectors(t, nrm[i]).normalize();
    const ww = (typeof w === 'function' ? w(i / (N - 1)) : w) / 2;
    if (i) cum += pts[i].distanceTo(pts[i - 1]);
    for (const s of [-1, 1]) { const q = pts[i].clone().addScaledVector(side, s * ww); pos.push(q.x, q.y, q.z); uv.push((s + 1) / 2, cum * uvScale); }
    if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // orient normals roughly along nrm
  const nn = g.attributes.normal; if (nn.getX(0) * nrm[0].x + nn.getY(0) * nrm[0].y + nn.getZ(0) * nrm[0].z < 0) { for (let i = 0; i < idx.length; i += 3) { const t2 = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t2; } g.setIndex(idx); g.computeVertexNormals(); }
  applySkin(g, skinFn); return fin(g, color);
}

/** a strip lying on the torso shell between two (yf, ang) endpoints (n samples) */
export function torsoStrip(c, a0, a1, w, off, color, bone = null) {
  const pts = [], nr = [], n = 10;
  for (let i = 0; i < n; i++) { const t = i / (n - 1); const sp = shellPoint(c, mixn(a0[0], a1[0], t), mixn(a0[1], a1[1], t), off); pts.push(sp.p); nr.push(sp.n); }
  return strip(pts, nr, w, bone ? rigid(c.bi, bone) : c.torsoSkin, color, 12);
}

const skinOf = (c, bone) => (bone === 'torso' ? c.torsoSkin : rigid(c.bi, bone));
/** box rigidly attached to a bone; pos/rot in rig space */
export function boxOn(c, bone, w, h, d, pos, color = 0xffffff, rot = null) {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); }
  g.translate(pos.x ?? pos[0], pos.y ?? pos[1], pos.z ?? pos[2]);
  applySkin(g, skinOf(c, bone)); return fin(g, color);
}
export function ellOn(c, bone, rx, ry, rz, pos, color = 0xffffff, seg = 10) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(4, seg >> 1)); g.scale(rx, ry, rz); g.translate(pos.x ?? pos[0], pos.y ?? pos[1], pos.z ?? pos[2]);
  applySkin(g, skinOf(c, bone)); return fin(g, color);
}
export function cylOn(c, bone, r0, r1, h, pos, color = 0xffffff, rot = null, seg = 12) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1);
  if (rot) { g.rotateX(rot[0] || 0); g.rotateY(rot[1] || 0); g.rotateZ(rot[2] || 0); }
  g.translate(pos.x ?? pos[0], pos.y ?? pos[1], pos.z ?? pos[2]);
  applySkin(g, skinOf(c, bone)); return fin(g, color);
}

// ------------------------------------------------------------------ shoes
const STX = [[-0.058, 0.022, 0.027, 0.034], [-0.040, 0.029, 0.034, 0.039], [-0.012, 0.031, 0.036, 0.045], [0.02, 0.031, 0.0355, 0.040], [0.06, 0.036, 0.029, 0.032], [0.10, 0.043, 0.024, 0.025], [0.14, 0.047, 0.0205, 0.0205], [0.18, 0.043, 0.0165, 0.0165], [0.205, 0.032, 0.0125, 0.0125]];
/** shoe parts for foot S. type: sneaker|boots|work|clog|heels|sandals|techsneaker. Returns {upper, sole, extra[]} geometries (colour attr: upper/sole colours given) */
export function shoeParts(c, S, type, colUpper, colSole) {
  const { J, dims, F } = c, s = S === 'L' ? 1 : -1;
  const an = J['foot' + S], toes = J['toes' + S], fl = dims.footLen, sc = fl / 0.266;
  const skinFt = makeChain(c.bi, ['foot' + S, 'toes' + S], [toes], [0.018], [V(0, 0, 1)]);
  const kind = { sneaker: 'sn', techsneaker: 'sn', sneakers: 'sn', boots: 'bt', work: 'wk', clog: 'cl', heels: 'hl', sandals: 'sd' }[type] || 'sn';
  const e = { sn: 0.006, bt: 0.007, wk: 0.007, cl: 0.007, hl: 0.003, sd: 0.002 }[kind];
  const soleT = { sn: 0.014, bt: 0.012, wk: 0.013, cl: 0.014, hl: 0.006, sd: 0.007 }[kind];
  const parts = {};
  const mk = (fnTop, fnBot, rxK, pwK = 2.5) => STX.map(([z, rx, rz, cy]) => {
    const top = cy + rz + fnTop(z), bot = Math.max(0, cy - rz - fnBot(z));
    return { c: V(an.x, (top + bot) / 2 * sc, an.z + z * sc), rx: (rx * (F ? 0.93 : 1) + rxK(z)) * sc, rz: (top - bot) / 2 * sc, pw: pwK };
  });
  let topF = (z) => e, botF = () => soleT * 0.0 + 0.0, rxK = () => e;
  if (kind === 'hl') { topF = (z) => (z > -0.03 && z < 0.1 ? -0.012 - 0.01 * smooth(0, 0.1, z) : e); }
  if (kind === 'sd') { topF = () => -0.016; }
  if (kind === 'cl') { topF = (z) => e + 0.006 * smooth(0.04, 0.16, z); rxK = (z) => e + 0.004; }
  let up = mk(topF, botF, rxK, kind === 'hl' ? 2.2 : 2.6);
  if (kind === 'hl') { // pointed toe
    up = up.map((st, i) => (i >= 6 ? { ...st, rx: st.rx * (1 - 0.35 * (i - 5) / 3) } : st));
  }
  const upper = ringLoft(up, { radial: rseg(14, 8), capStart: 0.018 * sc, capEnd: 0.016 * sc, ref: [0, 1, 0], uv: { u0: 0, u1: 3, v0: 0, v1: 2 } });
  applySkin(upper, skinFt); parts.upper = fin(upper, colUpper);
  // sole band
  const sl = STX.map(([z, rx, rz, cy]) => ({ c: V(an.x, (soleT * 0.5 - 0.0005) * sc + (z < 0 ? 0.0035 * sc : 0), an.z + z * sc), rx: (rx * (F ? 0.93 : 1) + e + 0.0035) * sc, rz: (soleT * 0.5 + (z < 0 ? 0.0035 : 0.0)) * sc, pw: 2.8 }));
  const sole = ringLoft(sl, { radial: rseg(14, 8), capStart: 0.016 * sc, capEnd: 0.014 * sc, ref: [0, 1, 0], uv: { u0: 0, u1: 3, v0: 0, v1: 2 } });
  applySkin(sole, skinFt); parts.sole = fin(sole, colSole);
  parts.extra = [];
  if (kind === 'bt' || kind === 'wk') { // shaft up the shin
    const limb = c.limbs['leg' + S];
    const u0 = kind === 'bt' ? 2.5 : 2.72;
    const sts = limb.stations(u0, 3, 6, { off: 0.0085, fn: (u, st) => { st.rx += 0.0; } });
    const sh = ringLoft(sts, { radial: rseg(16, 8), uv: { u0: 0, u1: 3, v0: 0, v1: 1 }, ref: [0, 0, 1] });
    applySkin(sh, c.legSkin(S)); parts.extra.push(fin(sh, colUpper));
  }
  if (kind === 'sd') { for (const z of [0.0, 0.07, 0.15]) { const k = STX.findIndex((r) => r[0] >= z); const [zz, rx, rz, cy] = STX[Math.max(0, k)]; const w = 0.012 * sc; const st = [{ c: V(an.x, cy * sc, an.z + (zz - 0.005) * sc), rx: (rx + 0.004) * sc, rz: (rz + 0.005) * sc, pw: 2.4 }, { c: V(an.x, cy * sc, an.z + (zz + 0.01) * sc), rx: (rx + 0.004) * sc, rz: (rz + 0.005) * sc, pw: 2.4 }]; const bg = ringLoft(st, { radial: rseg(12, 8), ref: [0, 1, 0] }); applySkin(bg, skinFt); parts.extra.push(fin(bg, colUpper)); } }
  if (kind === 'hl') { const g = new THREE.CylinderGeometry(0.014 * sc, 0.009 * sc, 0.04 * sc, 8); g.translate(an.x, 0.02 * sc, an.z - 0.042 * sc); applySkin(g, skinFt); parts.extra.push(fin(g, colSole)); }
  return parts;
}

/** glove geometry for hand S (glove = thickness offset). fingerless: palm + thumb only */
export function gloveParts(c, S, { thick = 0.0035, fingerless = false } = {}) {
  const ps = buildHand(c.P, c.L, S, c.bi, { glove: thick });
  const use = fingerless ? ps.slice(0, 2) : ps;
  for (const g of use) { const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 14; uv[i * 2 + 1] = p.getY(i) * 14; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); fin(g, 0xffffff); }
  return use;
}
