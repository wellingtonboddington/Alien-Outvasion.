// Hair toolkit: head-surface queries (nominal head space), scalp-cap shells, strand "growth" walker, ribbon (card) builder, strand textures,
// spring-chain skin weights.  Nominal head space = head bone local metres / head.sh (see head.js); model = pivot + sh * nominal.
import * as THREE from 'three';
import { baseXZ, headProfile } from './head.js';
import { V, smooth, mixn, makeChain, applySkin } from './kit.js';
import { torsoStations } from './body.js';
import { makeCanvas, texFromCanvas, cached, noise2, fbm2 } from '../../engine/proc.js';

export const CROWN = 0.115;
const sgnpow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const hsh = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class HeadShape {
  constructor(head, L, P) {
    this.head = head; this.H = head.H; this.sh = head.sh; this.pivot = head.pivot.clone(); this.P = P;
    this.rows = torsoStations(P, L, { n: 8, y0: 0.7, y1: 0.862 });
    this._t = {};
  }
  toModel(p, out = new THREE.Vector3()) { return out.set(this.pivot.x + p.x * this.sh, this.pivot.y + p.y * this.sh, this.pivot.z + p.z * this.sh); }
  gHead(p) {
    const yy = Math.min(p.y, CROWN - 0.0015); if (yy < -0.2) return 9;
    const t = headProfile(yy), H = this.H;
    const A = Math.max(1e-3, t[0] * H.f.width), zw = t[3], n = t[4];
    const dz = p.z - zw, D = Math.max(1e-3, dz >= 0 ? t[1] - zw : t[2] + zw);
    return Math.pow(Math.pow(Math.abs(p.x) / A, n) + Math.pow(Math.abs(dz) / D, n), 1 / n) + Math.max(0, p.y - (CROWN - 0.0015)) * 30;
  }
  gTorso(p) {
    const r = this.rows, my = this.pivot.y + p.y * this.sh;
    if (my > r[r.length - 1].y || my < r[0].y) return 9;
    let i = 0; while (i < r.length - 2 && r[i + 1].y < my) i++;
    const f = (my - r[i].y) / Math.max(1e-6, r[i + 1].y - r[i].y), rx = mixn(r[i].rx, r[i + 1].rx, f) + 0.012, rz = mixn(r[i].rz, r[i + 1].rz, f) + 0.012, cz = mixn(r[i].c.z, r[i + 1].c.z, f);
    const mx = this.pivot.x + p.x * this.sh, mz = this.pivot.z + p.z * this.sh;
    return Math.pow(Math.pow(Math.abs(mx) / rx, 2.4) + Math.pow(Math.abs(mz - cz) / rz, 2.4), 1 / 2.4);
  }
  /** push nominal point p outside head (margin nominal metres) and torso; returns true if moved. normal written to nOut */
  pushOut(p, margin = 0.004, nOut = null, torso = true) {
    let moved = false; const h = 0.0015;
    for (let it = 0; it < 3; it++) {
      for (let s = 0; s < 2; s++) {
        if (s === 1 && !torso) break;
        const f = s === 0 ? (q) => this.gHead(q) : (q) => this.gTorso(q);
        const g = f(p), tgt = s === 0 ? 1 + margin * 12.5 : 1 + 0.002 * 8;
        if (g >= tgt || g > 5) continue;
        _a.set(f(_b.copy(p).add(_c.set(h, 0, 0))) - f(_b.copy(p).add(_c.set(-h, 0, 0))), f(_b.copy(p).add(_c.set(0, h, 0))) - f(_b.copy(p).add(_c.set(0, -h, 0))), f(_b.copy(p).add(_c.set(0, 0, h))) - f(_b.copy(p).add(_c.set(0, 0, -h)))).multiplyScalar(1 / (2 * h));
        const l2 = _a.lengthSq(); if (l2 < 1e-6) continue;
        p.addScaledVector(_a, (tgt - g) / l2); moved = true;
        if (nOut) nOut.copy(_a).normalize();
      }
    }
    return moved;
  }
  /** surface point (nominal) at row y / ellipse param phi, offset along the true normal; out = {p, n} */
  point(y, phi, off = 0, out = { p: V(), n: V() }) {
    const H = this.H, t = this._t, e = 0.0025, ep = 0.02;
    const at = (yy, pp, o) => { baseXZ(Math.min(yy, CROWN - 0.0006), pp, H, t); return o.set(t.x, Math.min(yy, CROWN - 0.0006), t.z); };
    const p0 = at(y, phi, _a), p1 = at(y + e, phi, _b).clone(), p2 = at(y, phi + ep, _c).clone();
    const dy = p1.sub(p0), dp = p2.sub(p0);
    const n = out.n.crossVectors(dp, dy); if (n.lengthSq() < 1e-14) n.set(Math.sin(phi), 0.3, Math.cos(phi)); n.normalize();
    // orient outward (away from the head axis)
    if (n.x * p0.x + n.z * (p0.z - 0.0) + n.y * (p0.y > 0.05 ? 0.2 : 0) < 0) n.negate();
    out.p.copy(at(y, phi, _a)).addScaledVector(n, off);
    return out;
  }
  /** outward direction used for ribbon facing */
  outward(p, out) { return out.set(p.x, p.y > 0 ? p.y * 1.3 : 0, p.z).normalize(); }
}

/** hairline height (nominal y) for ellipse angle phi (rad, 0 = front); raise: lifts the sides/back (fades) */
export function hairline(phi, o = {}) {
  const a = Math.abs(phi) * 180 / Math.PI;
  const tab = [[0, 0.064], [30, 0.062], [55, 0.052], [72, 0.04], [88, 0.03], [100, 0.015], [118, -0.02], [145, -0.065], [180, -0.082]];
  let i = 0; while (i < tab.length - 2 && a > tab[i + 1][0]) i++;
  const f = Math.min(1, Math.max(0, (a - tab[i][0]) / (tab[i + 1][0] - tab[i][0])));
  let y = mixn(tab[i][1], tab[i + 1][1], f);
  if (o.side) y += o.side * smooth(60, 85, a) * (1 - smooth(120, 150, a));
  if (o.back) y += o.back * smooth(115, 150, a);
  if (o.front) y += o.front * (1 - smooth(20, 70, a));
  return y;
}

/** scalp-cap shell hugging the head. o:{nr,nc,off,offFn(y,phi,t),yBot(phi),yTop,color,uvRep,phi0,phi1} -> geometry (no skin yet) in MODEL space */
export function capGeometry(hs, o = {}) {
  const nr = o.nr || 18, nc = o.nc || 56, yTop = o.yTop ?? CROWN - 0.003, p0 = o.phi0 ?? -Math.PI, p1 = o.phi1 ?? Math.PI;
  const pos = [], nor = [], uv = [], col = [], idx = [], tmp = { p: V(), n: V() }, m = V();
  const c = new THREE.Color(o.color || 0x222222);
  for (let j = 0; j <= nr; j++) {
    const t = j / nr;
    for (let i = 0; i <= nc; i++) {
      const phi = mixn(p0, p1, i / nc), yb = typeof o.yBot === 'function' ? o.yBot(phi) : (o.yBot ?? 0.03);
      const y = mixn(yb, yTop, 1 - Math.pow(1 - t, 1.5));
      const off = (o.off ?? 0.003) + (o.offFn ? o.offFn(y, phi, t) : 0);
      hs.point(y, phi, off, tmp); hs.toModel(tmp.p, m);
      pos.push(m.x, m.y, m.z); nor.push(tmp.n.x, tmp.n.y, tmp.n.z);
      uv.push((i / nc) * (o.uvRep || 3), t);
      const k = 0.6 + 0.4 * smooth(0, 0.35, t); col.push(c.r * k, c.g * k, c.b * k);
    }
  }
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) { const a = j * (nc + 1) + i, b = a + 1, d = a + nc + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  // face the right way: check first triangle against its normal
  const ps = g.attributes.position; _a.fromBufferAttribute(ps, idx[0]); _b.fromBufferAttribute(ps, idx[1]); _c.fromBufferAttribute(ps, idx[2]);
  const fn = _b.sub(_a).cross(_c.sub(_a)); if (fn.x * nor[idx[0] * 3] + fn.y * nor[idx[0] * 3 + 1] + fn.z * nor[idx[0] * 3 + 2] < 0) { for (let k = 0; k < idx.length; k += 3) { const t2 = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t2; } g.setIndex(idx); }
  return g;
}

/**
 * Grow one strand from nominal root point. S: {n, len, follow, droop, wave:[amp,freq], curl:[amp,freq], flow(p,s,d,out), margin, yEnd, torso, phase}
 * returns array of nominal points.
 */
export function growStrand(hs, root, d0, S) {
  const pts = [root.clone()], p = root.clone(), d = d0.clone().normalize(), n = S.n || 10, step = S.len / n;
  const tgt = V(), nrm = V(), side = V(), up = V(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const s = (i + 1) / n;
    if (S.flow) { S.flow(p, s, d, tgt); d.lerp(tgt, S.follow ?? 0.3).normalize(); }
    d.y -= (S.droop ?? 0.1) * (0.3 + s); d.normalize();
    if (S.wave) { side.crossVectors(d, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); d.addScaledVector(side, S.wave[0] * Math.cos((s * S.wave[1] + (S.phase || 0)) * Math.PI * 2)).normalize(); }
    if (S.curl) { side.crossVectors(d, up).normalize(); const w = (s * S.curl[1] + (S.phase || 0)) * Math.PI * 2; d.addScaledVector(side, S.curl[0] * Math.cos(w)).addScaledVector(up, S.curl[0] * 0.8 * Math.sin(w)).normalize(); }
    p.addScaledVector(d, step);
    if (hs.pushOut(p, S.margin ?? 0.004, nrm, S.torso !== false)) { d.addScaledVector(nrm, -d.dot(nrm) * 0.9); d.addScaledVector(nrm, 0.01); d.normalize(); }
    pts.push(p.clone());
    if (S.yEnd !== undefined && p.y < S.yEnd) break;
  }
  return pts;
}

/** ribbon/card accumulator (model space output) */
export class Cards {
  constructor(hs) { this.hs = hs; this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  /** pts nominal polyline; width0/width1 nominal half-widths root/tip; colors: [root, mid, tip] THREE.Color; u0/u1 texture u range */
  add(pts, w0, w1, colors, u0 = 0, u1 = 1) {
    const hs = this.hs, N = pts.length; if (N < 2) return;
    const tan = V(), out = V(), side = V(), m = V(), nn = V();
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      tan.copy(pts[Math.min(N - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
      hs.outward(pts[i], out); side.crossVectors(tan, out); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
      nn.crossVectors(side, tan).normalize(); if (nn.dot(out) < 0) nn.negate();
      const w = mixn(w0, w1, Math.pow(s, 1.4)) * hs.sh;
      const col = s < 0.5 ? colors[0].clone().lerp(colors[1], s * 2) : colors[1].clone().lerp(colors[2], (s - 0.5) * 2);
      for (const k of [-1, 1]) {
        hs.toModel(pts[i], m); m.addScaledVector(side, k * w);
        this.pos.push(m.x, m.y, m.z); this.nor.push(nn.x, nn.y, nn.z); this.uv.push(k < 0 ? u0 : u1, s); this.col.push(col.r, col.g, col.b);
      }
      if (i < N - 1) { const a = this.n + i * 2; this.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    this.n += N * 2;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.setIndex(this.idx);
    return g;
  }
}

/** skin weights for a spring chain: bones ['head', c0, c1..] with joints (model space) */
export function chainSkin(bi, names, joints, dirs, blend) { return makeChain(bi, names, joints, blend, dirs); }
/** weights = lateral blend of several chain skin functions by x; chains sorted by x ascending (model space), xs = chain x positions */
export function lateralSkin(fns, xs) {
  const ta = { i: [0, 0, 0, 0], w: [0, 0, 0, 0] }, tb = { i: [0, 0, 0, 0], w: [0, 0, 0, 0] };
  return (x, y, z, out) => {
    let k = 0; while (k < xs.length - 2 && x > xs[k + 1]) k++;
    const f = Math.min(1, Math.max(0, (x - xs[k]) / (xs[k + 1] - xs[k]))), ff = f * f * (3 - 2 * f);
    fns[k](x, y, z, ta); fns[k + 1](x, y, z, tb);
    const map = new Map();
    for (let j = 0; j < 4; j++) { if (ta.w[j] > 0) map.set(ta.i[j], (map.get(ta.i[j]) || 0) + ta.w[j] * (1 - ff)); if (tb.w[j] > 0) map.set(tb.i[j], (map.get(tb.i[j]) || 0) + tb.w[j] * ff); }
    const ent = [...map.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4); let s = 0; for (const e of ent) s += e[1];
    for (let j = 0; j < 4; j++) { if (ent[j]) { out.i[j] = ent[j][0]; out.w[j] = ent[j][1] / s; } else { out.i[j] = 0; out.w[j] = 0; } }
  };
}

// ---------------------------------------------------------------- textures
/** strand-card texture: grey strands with alpha cut-out, tapering to the tip (v=1) */
export function strandTex() {
  return cached('hair.strand', () => {
    const W = 128, Hh = 256, c = makeCanvas(W, Hh), x = c.getContext('2d');
    x.clearRect(0, 0, W, Hh);
    for (let i = 0; i < 46; i++) {
      const cx = hsh(i, 1) * W, w = 1.4 + hsh(i, 2) * 2.4, len = Hh * (0.72 + 0.28 * hsh(i, 3)), g = Math.floor(150 + 105 * hsh(i, 4)), ph = hsh(i, 5) * 6, amp = 1 + 2.5 * hsh(i, 6);
      x.strokeStyle = `rgb(${g},${g},${g})`; x.lineWidth = w; x.lineCap = 'round'; x.beginPath();
      for (let y = Hh; y >= Hh - len; y -= 8) { const px = cx + Math.sin(y * 0.03 + ph) * amp; (y === Hh ? x.moveTo(px, y) : x.lineTo(px, y)); }
      x.stroke();
    }
    // canvas bottom = root (v=0), top = tip (v=1)
    const t = texFromCanvas(c, { aniso: 4, wrap: 'clamp' }); t.wrapS = THREE.ClampToEdgeWrapping; return t;
  });
}
/** scalp cap texture: kind 'solid' | 'fade' (stippled hairline) | 'curly' (clumped alpha) */
export function capTex(kind) {
  return cached('hair.cap.' + kind, () => {
    const S = 128, c = makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const v = 1 - py / S, u = px / S;
      const streak = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(px * 2.1 + hsh(px >> 1, 3) * 6)) * (0.6 + 0.4 * hsh(px, py >> 3));
      let a = 255, l = streak;
      if (kind === 'fade') a = hsh(px, py) < smooth(0.0, 0.3, v) * 1.05 ? 255 : 0;
      else if (kind === 'curly') { const n = fbm2(u * 14, v * 14, 3) + 0.25 * noise2(u * 40, v * 40); a = n > 0.43 ? 255 : 0; l = 0.55 + 0.5 * n * (0.7 + 0.3 * hsh(px, py)); }
      const i = (py * S + px) * 4, g = Math.min(255, l * 255); d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = a;
    }
    x.putImageData(img, 0, 0);
    return texFromCanvas(c, { aniso: 2 });
  });
}
