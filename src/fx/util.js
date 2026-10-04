// Small shared helpers for FX recipes (no allocation in hot paths).
import * as THREE from 'three';

export const px = (p) => (p.x !== undefined ? p.x : p[0]);
export const py = (p) => (p.y !== undefined ? p.y : p[1]);
export const pz = (p) => (p.z !== undefined ? p.z : p[2]);
export const TAU = Math.PI * 2;

/** resolve a point spec (Vector3 | [x,y,z] | Object3D | fn) into out {x,y,z}-like Vector3 */
export function resolve(p, out) {
  if (p == null) return out.set(0, 0, 0);
  if (typeof p === 'function') return resolve(p(), out);
  if (p.isVector3) return out.copy(p);
  if (p.isObject3D) { p.updateWorldMatrix(true, false); return out.setFromMatrixPosition(p.matrixWorld); }
  if (Array.isArray(p)) return out.set(p[0], p[1], p[2]);
  if (p.root && p.root.isObject3D) { p.root.updateWorldMatrix(true, false); return out.setFromMatrixPosition(p.root.matrixWorld); }
  return out.set(p.x || 0, p.y || 0, p.z || 0);
}
export function toColor(c, out, def = [1, 1, 1]) {
  if (c == null) return out.setRGB(def[0], def[1], def[2]);
  if (Array.isArray(c)) return out.setRGB(c[0], c[1], c[2]);
  if (c.isColor) return out.copy(c);
  return out.set(c);
}

/** reset P and set the common motion fields */
export function setP(P, x, y, z, vx, vy, vz, birth, life, s0, s1) {
  P.reset(); P.x = x; P.y = y; P.z = z; P.vx = vx; P.vy = vy; P.vz = vz; P.birth = birth; P.life = life; P.s0 = s0; P.s1 = s1; return P;
}

/** glow-atlas frames */
export const G_SOFT = 0, G_STAR = 1, G_RING = 2, G_STREAK = 3;

/** additive glow sprite (decay = alpha exponent: 0 constant, 2 fast fade) */
export function glowSprite(fx, x, y, z, birth, life, s0, s1, frame, r, g, b, decay, rot = 0, rotVel = 0, vx = 0, vy = 0, vz = 0) {
  const P = setP(fx.P, x, y, z, vx, vy, vz, birth, life, s0, s1);
  P.frame = frame; P.r = r; P.g = g; P.b = b; P.a = decay; P.rot = rot; P.rotVel = rotVel; P.extra = 0; P.drag = 0;
  fx.glow.add(P);
}

/** random unit vector in the upper hemisphere biased toward `up` (bias 0 = uniform sphere, 1 = straight up) written to out */
export function dirHemi(R, out, bias = 0, lowest = -0.05) {
  const z = R.range(-1, 1), a = R.range(0, TAU), r = Math.sqrt(1 - z * z);
  out.set(r * Math.cos(a), Math.abs(z) * (1 - bias) + bias * R.range(0.3, 1) , r * Math.sin(a));
  if (out.y < lowest) out.y = -out.y;
  return out.normalize();
}
export function dirSphere(R, out) { const z = R.range(-1, 1), a = R.range(0, TAU), r = Math.sqrt(1 - z * z); return out.set(r * Math.cos(a), z, r * Math.sin(a)); }
export const lerpc = (a, b, t) => a + (b - a) * t;
export const V = () => new THREE.Vector3();
