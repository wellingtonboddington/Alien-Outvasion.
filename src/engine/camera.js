// Camera rigs: every shot is a pure function of local shot time -> {pos, target, fov, roll}. Fully seekable.
import * as THREE from 'three';
import { clamp, lerp, easeInOut, easeOutCubic, easeInCubic, smoothstep, lerpAngle, TAU } from './common.js';
import { noise2 } from './proc.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/** Resolve a point spec to a Vector3. Accepts Vector3, [x,y,z], fn(t)->spec, Object3D, Actor/entity (has .headPos / .pos / .root). */
export function resolvePoint(p, out, t = 0) {
  if (p == null) return out.set(0, 0, 0);
  if (p.isVector3) return out.copy(p);
  if (Array.isArray(p)) return out.set(p[0], p[1], p[2]);
  if (typeof p === 'function') return resolvePoint(p(t), out, t);
  if (p.headPos) return p.headPos(out);
  if (p.isObject3D) return p.getWorldPosition(out);
  if (p.root && p.root.isObject3D) return p.root.getWorldPosition(out);
  if (p.pos && p.pos.isVector3) return out.copy(p.pos);
  if (typeof p.x === 'number') return out.set(p.x, p.y || 0, p.z || 0);
  return out.set(0, 0, 0);
}
const EASE = { linear: (t) => t, inOut: easeInOut, in: easeInCubic, out: easeOutCubic, smooth: (t) => t * t * (3 - 2 * t), };
const pt = (spec, t) => resolvePoint(spec, new THREE.Vector3(), t);

export class CamState { constructor() { this.pos = new THREE.Vector3(0, 1.6, 5); this.target = new THREE.Vector3(); this.fov = 35; this.roll = 0; } }

/**
 * Evaluate a shot spec at u = time into the shot (seconds), d = shot duration.
 * Specs (combine freely, later keys win):
 *   {pos, look, fov}                                    static
 *   {from:{pos,look,fov}, to:{pos,look,fov}, ease}      move between two setups
 *   {orbit:{center, radius, height, a0, a1 (radians)}, lookY, fov}
 *   {follow: target, offset:[x,y,z], rel:true|false, look: target|[x,y,z] offset, lag}
 *   {path:[{t,pos,look,fov}...], ease}                  Catmull-Rom through setups (t = 0..1 or seconds)
 * Modifiers: push (metres dolly toward the look target over the shot), drift:[x,y,z] (world metres over the shot),
 *            handheld (0..1 amount), shake (0..1, decays by `shakeDecay`), roll (radians), rollTo, fovTo, dolly zoom: vertigo (bool)
 */
export function evalShot(spec, u, d, out, S) {
  const k = d > 0 ? clamp(u / d) : 0; const t = (S ? S.t : 0);
  let ease = EASE[spec.ease || 'inOut'] || EASE.inOut;
  if (spec.from && spec.to) {
    const e = ease(k);
    const pa = pt(spec.from.pos, t), pb = pt(spec.to.pos, t), la = pt(spec.from.look, t), lb = pt(spec.to.look, t);
    out.pos.lerpVectors(pa, pb, e); out.target.lerpVectors(la, lb, e); out.fov = lerp(spec.from.fov ?? spec.fov ?? 35, spec.to.fov ?? spec.fov ?? 35, e);
  } else if (spec.orbit) {
    const o = spec.orbit; const a = lerp(o.a0 ?? 0, o.a1 ?? 1, ease(k)); const c = pt(o.center, t);
    out.pos.set(c.x + Math.sin(a) * o.radius, c.y + (o.height ?? 1.5), c.z + Math.cos(a) * o.radius);
    out.target.copy(c); out.target.y += spec.lookY ?? 0; out.fov = spec.fov ?? 35;
    if (o.radiusTo != null) { const r = lerp(o.radius, o.radiusTo, ease(k)); out.pos.set(c.x + Math.sin(a) * r, c.y + (o.height ?? 1.5), c.z + Math.cos(a) * r); }
  } else if (spec.follow) {
    const tg = pt(spec.follow, t); const off = spec.offset || [0, 1.5, 4];
    if (spec.rel && spec.follow.yaw !== undefined) { const y = spec.follow.yaw; const c = Math.cos(y), s = Math.sin(y); out.pos.set(tg.x + off[0] * c + off[2] * s, tg.y + off[1], tg.z - off[0] * s + off[2] * c); }
    else out.pos.set(tg.x + off[0], tg.y + off[1], tg.z + off[2]);
    if (spec.lag) { if (!spec._st) spec._st = { p: out.pos.clone() }; const a = 1 - Math.exp(-(spec.lag) * (S?.dt || 0.016)); spec._st.p.lerp(out.pos, a); out.pos.copy(spec._st.p); }
    if (spec.look) { if (Array.isArray(spec.look)) out.target.set(tg.x + spec.look[0], tg.y + spec.look[1], tg.z + spec.look[2]); else resolvePoint(spec.look, out.target, t); } else out.target.copy(tg);
    out.fov = spec.fov ?? 35;
  } else if (spec.path) {
    const P = spec.path; const n = P.length; const useSec = P[n - 1].t > 1.001; const tt = useSec ? u : k; let i = 0; while (i < n - 2 && tt > P[i + 1].t) i++;
    const a = P[i], b = P[i + 1]; const lk = clamp((tt - a.t) / Math.max(1e-6, b.t - a.t)); const e = spec.linear ? lk : lk * lk * (3 - 2 * lk);
    const p0 = P[Math.max(0, i - 1)], p3 = P[Math.min(n - 1, i + 2)];
    const cr = (k0, k1, k2, k3, s, key) => { const A = pt(k0[key], t), B = pt(k1[key], t), C = pt(k2[key], t), D = pt(k3[key], t); const s2 = s * s, s3 = s2 * s; return new THREE.Vector3().set(
      0.5 * ((2 * B.x) + (-A.x + C.x) * s + (2 * A.x - 5 * B.x + 4 * C.x - D.x) * s2 + (-A.x + 3 * B.x - 3 * C.x + D.x) * s3),
      0.5 * ((2 * B.y) + (-A.y + C.y) * s + (2 * A.y - 5 * B.y + 4 * C.y - D.y) * s2 + (-A.y + 3 * B.y - 3 * C.y + D.y) * s3),
      0.5 * ((2 * B.z) + (-A.z + C.z) * s + (2 * A.z - 5 * B.z + 4 * C.z - D.z) * s2 + (-A.z + 3 * B.z - 3 * C.z + D.z) * s3)); };
    out.pos.copy(cr(p0, a, b, p3, e, 'pos')); out.target.copy(cr(p0, a, b, p3, e, 'look')); out.fov = lerp(a.fov ?? spec.fov ?? 35, b.fov ?? spec.fov ?? 35, e);
  } else {
    resolvePoint(spec.pos, out.pos, t); resolvePoint(spec.look, out.target, t); out.fov = spec.fov ?? 35;
  }
  out.roll = (spec.roll || 0) + (spec.rollTo != null ? (spec.rollTo - (spec.roll || 0)) * ease(k) : 0);
  if (spec.fovTo != null) out.fov = lerp(spec.fov ?? out.fov, spec.fovTo, ease(k));
  // push-in / pull-out along the view direction
  if (spec.push) { _v.subVectors(out.target, out.pos); const L = _v.length() || 1; _v.multiplyScalar(spec.push * ease(k) / L); out.pos.add(_v); }
  if (spec.drift) { const e = ease(k); out.pos.x += spec.drift[0] * e; out.pos.y += spec.drift[1] * e; out.pos.z += spec.drift[2] * e; }
  if (spec.vertigo) { // dolly zoom: keep subject size constant while fov changes
    const dist0 = spec.vertigo.dist ?? out.pos.distanceTo(out.target); const f0 = spec.fov ?? 35, f1 = spec.fovTo ?? 70; const f = lerp(f0, f1, ease(k)); const dist = dist0 * Math.tan(f0 * Math.PI / 360) / Math.tan(f * Math.PI / 360);
    _v.subVectors(out.pos, out.target).normalize().multiplyScalar(dist); out.pos.copy(out.target).add(_v); out.fov = f;
  }
  // handheld + shake (noise in rotation/position, cheap & seekable)
  const hh = spec.handheld ?? 0, sh = spec.shake ?? 0;
  if (hh > 0 || sh > 0) {
    const tt = u + (spec.seed || 0) * 17.3; const decay = sh > 0 ? Math.exp(-(spec.shakeDecay ?? 0.0) * u) : 1;
    const amp = hh * 0.012 + sh * 0.06 * decay; const fr = hh > 0 && sh === 0 ? 0.9 : 7;
    _v.set(noise2(tt * fr, 1.3), noise2(tt * fr, 7.1), noise2(tt * fr, 13.7)).multiplyScalar(amp * 2.2);
    // shift in camera space approx: apply to pos and target slightly differently so the view rotates a bit
    out.pos.add(_v); out.target.addScaledVector(_v, -0.6); out.roll += noise2(tt * fr * 0.7, 21.1) * amp * 0.8;
  }
  return out;
}

/** Apply camera state to a THREE.PerspectiveCamera. */
export function applyCam(cam, st, aspect) {
  cam.position.copy(st.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(st.target);
  if (st.roll) cam.rotateZ(st.roll);
  if (Math.abs(cam.fov - st.fov) > 1e-4 || cam.aspect !== aspect) { cam.fov = st.fov; cam.aspect = aspect; cam.updateProjectionMatrix(); }
}

/**
 * Cinematic dialogue coverage: build shot specs from live actor positions (so any arrangement works).
 * kind: 'wide' | 'two' | 'cu' (close-up of A looking toward B) | 'mcu' | 'ots' (over B's shoulder onto A) | 'react'
 * Returns a spec with function-valued pos/look evaluated per frame.
 */
export function coverageSpec(kind, A, B, opts = {}) {
  const side = opts.side ?? 1; const bounds = opts.bounds || null; const fov = opts.fov;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpM = new THREE.Vector3(), dir = new THREE.Vector3(), perp = new THREE.Vector3();
  const clampB = (p) => { if (!bounds) return p; p.x = clamp(p.x, bounds.min[0], bounds.max[0]); p.z = clamp(p.z, bounds.min[2], bounds.max[2]); p.y = clamp(p.y, bounds.min[1], bounds.max[1]); return p; };
  const geom = (t) => { A.headPos(tmpA); (B || A).headPos(tmpB); dir.subVectors(tmpB, tmpA); dir.y = 0; if (dir.lengthSq() < 1e-4) dir.set(Math.sin(A.model?.root?.rotation.y || 0), 0, Math.cos(A.model?.root?.rotation.y || 0)); dir.normalize(); perp.set(-dir.z, 0, dir.x).multiplyScalar(side); };
  const spec = { handheld: opts.handheld ?? 0.5, push: opts.push ?? 0.0, seed: opts.seed || 0 };
  const fovK = (f) => fov ?? f;
  if (kind === 'cu' || kind === 'mcu') {
    const dist = (kind === 'cu' ? 1.05 : 1.75) * (opts.dist || 1), lat = (kind === 'cu' ? 0.28 : 0.45) * (opts.lat || 1);
    spec.fov = fovK(kind === 'cu' ? 30 : 34);
    spec.pos = (t) => { geom(t); const p = tmpM.copy(tmpA).addScaledVector(dir, dist).addScaledVector(perp, lat); p.y = tmpA.y + 0.02 + (opts.up || 0); return clampB(p.clone()); };
    spec.look = (t) => { geom(t); const p = tmpM.copy(tmpA); p.y -= 0.04; p.addScaledVector(dir, -0.0); return p.clone(); };
  } else if (kind === 'ots') {
    spec.fov = fovK(32);
    spec.pos = (t) => { geom(t); const p = tmpM.copy(tmpB).addScaledVector(dir, -0.9 * (opts.dist || 1)).addScaledVector(perp, -0.42); p.y = tmpB.y + 0.12; return clampB(p.clone()); };
    spec.look = (t) => { geom(t); const p = tmpM.copy(tmpA); p.y -= 0.03; return p.clone(); };
  } else if (kind === 'two') {
    spec.fov = fovK(36);
    spec.pos = (t) => { geom(t); const mid = tmpM.addVectors(tmpA, tmpB).multiplyScalar(0.5); const sep = tmpA.distanceTo(tmpB); const p = mid.clone().addScaledVector(perp, Math.max(2.4, sep * 1.25 + 1.2) * (opts.dist || 1)); p.y = Math.min(tmpA.y, tmpB.y) + 0.1 + (opts.up || 0); return clampB(p); };
    spec.look = (t) => { geom(t); return tmpM.addVectors(tmpA, tmpB).multiplyScalar(0.5).clone(); };
  } else if (kind === 'react') {
    spec.fov = fovK(30);
    spec.pos = (t) => { geom(t); const p = tmpM.copy(tmpA).addScaledVector(dir, 1.2 * (opts.dist || 1)).addScaledVector(perp, -0.35); p.y = tmpA.y; return clampB(p.clone()); };
    spec.look = (t) => { geom(t); return tmpM.copy(tmpA).clone(); };
  } else { // wide master: from behind-side, includes both
    spec.fov = fovK(40);
    spec.pos = (t) => { geom(t); const mid = tmpM.addVectors(tmpA, tmpB).multiplyScalar(0.5); const sep = tmpA.distanceTo(tmpB); const p = mid.clone().addScaledVector(perp, (opts.dist || 1) * (4 + sep * 0.6)).addScaledVector(dir, -(opts.dist || 1) * 1.5); p.y = Math.min(tmpA.y, tmpB.y) + 0.4 + (opts.up || 0); return clampB(p); };
    spec.look = (t) => { geom(t); return tmpM.addVectors(tmpA, tmpB).multiplyScalar(0.5).clone(); };
  }
  return spec;
}
