// Shared math / RNG / quality / global-uniform utilities. Every module may import from here.
// DO NOT put domain code here. Keep tiny and dependency-free (except three).
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : clamp((v - a) / (b - a)));
export const remap = (v, a, b, c, d) => lerp(c, d, invLerp(a, b, v));
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * t * (t * (t * 6 - 15) + 10); };
/** Frame-rate independent exponential smoothing. rate ~ 1/seconds (e.g. 8 = fast, 2 = slow). */
export const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const pingpong = (t, len = 1) => { const m = ((t % (len * 2)) + len * 2) % (len * 2); return m > len ? len * 2 - m : m; };
/** shortest signed angle difference b - a, in (-PI, PI] */
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const lerpAngle = (a, b, t) => a + angDiff(a, b) * t;
/** yaw (rotation.y) so that a model facing +Z looks along (dx,dz) */
export const yawTo = (dx, dz) => Math.atan2(dx, dz);

/** Seeded RNG (mulberry32). Deterministic: use it everywhere instead of Math.random() so seeking is stable. */
export class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  range(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  gauss() { let u = 0, v = 0; while (u === 0) u = this.next(); while (v === 0) v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  /** random unit vector */
  unit() { const z = this.range(-1, 1), a = this.range(0, TAU), r = Math.sqrt(1 - z * z); return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a)); }
}
export const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * Global quality knobs. level: 0 = low (phones), 1 = medium, 2 = high (desktop GPU).
 * Modules MUST scale their expensive features from these (instance counts, texture sizes, shadow use, particle counts).
 */
export const Q = {
  level: 1,
  mobile: false,
  crowd: 0.6,      // multiply instanced-crowd counts by this (0.25..1)
  particles: 0.6,  // multiply particle budgets by this
  texSize: 512,    // preferred procedural texture resolution (256 / 512 / 1024)
  shadows: true,   // allow shadow-casting key light
  shadowMap: 2048,
  bloom: true,
  detail: 1,       // 0 / 1 / 2 : geometry segment multiplier hint (use segs = base * (0.6 + 0.4 * detail))
};
export function setQuality(level) {
  Q.level = level;
  const t = [
    { crowd: 0.3, particles: 0.35, texSize: 256, shadows: false, shadowMap: 1024, bloom: true, detail: 0 },
    { crowd: 0.65, particles: 0.7, texSize: 512, shadows: true, shadowMap: 2048, bloom: true, detail: 1 },
    { crowd: 1.0, particles: 1.0, texSize: 1024, shadows: true, shadowMap: 4096, bloom: true, detail: 2 },
  ][level];
  Object.assign(Q, t);
}
export const seg = (base, min = 4) => Math.max(min, Math.round(base * (0.6 + 0.4 * Q.detail)));

/** Global shared uniforms. The director updates GLOBAL.time every frame (seconds, film time). */
export const GLOBAL = {
  time: { value: 0 },
};

/** Dispose helper: frees geometries/materials/textures under root (skips anything flagged userData.shared). */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const m = o.material;
    if (m) {
      const list = Array.isArray(m) ? m : [m];
      for (const mm of list) {
        if (mm.userData?.shared) continue;
        for (const k in mm) { const v = mm[k]; if (v && v.isTexture && !v.userData?.shared) v.dispose(); }
        mm.dispose();
      }
    }
  });
}
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export { THREE };
