// Sky palette: time-of-day keyframes (by sun elevation), mood modifiers (overcast/storm/smoke/haze/cold) and preset descriptors.
// Everything here is a pure function of numbers, so sky blending is exactly seekable (blend(A,B,k) is just a lerp of descriptors).
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../../engine/common.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const lum = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const mixc = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const mulv = (a, v) => [a[0] * v[0], a[1] * v[1], a[2] * v[2]];
const grey = (c, k, tint = [0.97, 1, 1.04]) => { const l = lum(c); return mixc(c, [l * tint[0], l * tint[1], l * tint[2]], k); };

// elev(deg), zenith, mid, horizon, glow, sun colour, sun light intensity, hemisphere intensity
const KEYS = [
  [-20, '#020409', '#04070f', '#080d1a', '#141c36', '#000000', 0, 0.2],
  [-12, '#050a1e', '#0b1432', '#18214a', '#2b3866', '#000000', 0, 0.22],
  [-8, '#0b1740', '#1a2a58', '#40427a', '#7a5890', '#000000', 0, 0.28],
  [-4, '#16295e', '#33437f', '#a85f8a', '#ff7a7a', '#ff5a30', 0.0, 0.34],
  [-1, '#1f3b7e', '#5266a0', '#ec8a62', '#ff8a52', '#ff6430', 1.0, 0.36],
  [2, '#27498d', '#6b83b6', '#f5a169', '#ffa45c', '#ff8a3e', 2.5, 0.36],
  [6, '#2f5a9c', '#829ec8', '#f8c58c', '#ffbf72', '#ffb062', 3.4, 0.4],
  [12, '#3770b9', '#8ab2dc', '#f0dcbc', '#ffdca2', '#ffd8a0', 3.6, 0.46],
  [22, '#3377c6', '#7fb2e4', '#d6e4ee', '#fff0cc', '#fff0d8', 3.4, 0.52],
  [40, '#2a6ac4', '#73a9e2', '#c8dff0', '#fff6e0', '#fff6e6', 3.3, 0.55],
  [70, '#2563c0', '#6aa2e0', '#bed9ef', '#fff8e8', '#fffaf0', 3.3, 0.55],
].map((k) => ({ e: k[0], zenith: lin(k[1]), mid: lin(k[2]), horizon: lin(k[3]), glow: lin(k[4]), sun: lin(k[5]), sunInt: k[6], hemiInt: k[7] }));

/** Interpolated base palette for a sun elevation in degrees. */
export function palette(elev) {
  let i = 0; while (i < KEYS.length - 2 && elev > KEYS[i + 1].e) i++;
  const a = KEYS[i], b = KEYS[i + 1]; let k = clamp((elev - a.e) / (b.e - a.e)); k = k * k * (3 - 2 * k);
  return {
    zenith: mixc(a.zenith, b.zenith, k), mid: mixc(a.mid, b.mid, k), horizon: mixc(a.horizon, b.horizon, k), glow: mixc(a.glow, b.glow, k), sun: mixc(a.sun, b.sun, k),
    sunInt: lerp(a.sunInt, b.sunInt, k), hemiInt: lerp(a.hemiInt, b.hemiInt, k),
  };
}

const SMOKE = { zenith: lin('#34201a'), mid: lin('#7a4528'), horizon: lin('#c47030'), glow: lin('#ff7428'), sun: lin('#ff5c20') };
const HAZE_H = lin('#dbe5ee');

/**
 * Preset descriptors (all numeric so they can be lerped). Fields:
 *  elev/az sun angles (deg); moonElev/moonAz; cover 0..1 cloud coverage; sharp cloud edge softness; dens cloud opacity; cirrus 0..1; wind cloud speed mult;
 *  overcast/storm/smoke/haze/cold mood amounts 0..1; fog extra density multiplier; stars multiplier.
 */
export const PRESETS = {
  day: { elev: 52, az: 150, moonElev: 30, moonAz: 300, cover: 0.5, sharp: 0.11, dens: 0.96, cirrus: 0.35, wind: 1, overcast: 0, storm: 0, smoke: 0, haze: 0, cold: 0 },
  dawn: { elev: 5, az: 85, moonElev: 20, moonAz: 270, cover: 0.38, sharp: 0.12, dens: 0.92, cirrus: 0.55, wind: 0.8, overcast: 0, storm: 0, smoke: 0, haze: 0.15, cold: 0.1 },
  goldenHour: { elev: 9, az: 255, moonElev: 15, moonAz: 90, cover: 0.5, sharp: 0.12, dens: 0.95, cirrus: 0.5, wind: 0.8, overcast: 0, storm: 0, smoke: 0, haze: 0.1, cold: 0 },
  dusk: { elev: -2.5, az: 285, moonElev: 30, moonAz: 100, cover: 0.42, sharp: 0.13, dens: 0.92, cirrus: 0.5, wind: 0.8, overcast: 0, storm: 0, smoke: 0, haze: 0, cold: 0.1 },
  night: { elev: -35, az: 200, moonElev: 42, moonAz: 135, cover: 0.22, sharp: 0.14, dens: 0.85, cirrus: 0.3, wind: 0.7, overcast: 0, storm: 0, smoke: 0, haze: 0, cold: 0.2 },
  overcast: { elev: 42, az: 150, moonElev: 30, moonAz: 300, cover: 1, sharp: 0.32, dens: 1, cirrus: 0, wind: 0.8, overcast: 1, storm: 0, smoke: 0, haze: 0.2, cold: 0 },
  storm: { elev: 28, az: 150, moonElev: 30, moonAz: 300, cover: 1, sharp: 0.3, dens: 1, cirrus: 0, wind: 2.6, overcast: 0.6, storm: 1, smoke: 0, haze: 0.1, cold: 0.1 },
  smoke: { elev: 22, az: 210, moonElev: 30, moonAz: 300, cover: 0.85, sharp: 0.36, dens: 0.95, cirrus: 0, wind: 0.9, overcast: 0.2, storm: 0, smoke: 1, haze: 0, cold: 0 },
  dayHaze: { elev: 44, az: 140, moonElev: 30, moonAz: 300, cover: 0.3, sharp: 0.16, dens: 0.8, cirrus: 0.3, wind: 0.8, overcast: 0, storm: 0, smoke: 0, haze: 1, cold: 0 },
  coldMorning: { elev: 10, az: 100, moonElev: 22, moonAz: 280, cover: 0.32, sharp: 0.14, dens: 0.9, cirrus: 0.45, wind: 0.8, overcast: 0.1, storm: 0, smoke: 0, haze: 0.35, cold: 1 },
};
export const PRESET_NAMES = Object.keys(PRESETS);

export function blendDesc(a, b, k) { const o = {}; for (const key in a) o[key] = lerp(a[key], b[key] ?? a[key], k); return o; }

/** Resolve a numeric descriptor into everything the shader/lights/fog need. */
export function resolve(d) {
  const e = d.elev; const base = palette(e);
  const day = smoothstep(-7, 12, e);
  let zenith = base.zenith, mid = base.mid, horizon = base.horizon, glow = base.glow, sun = base.sun;
  let sunInt = base.sunInt, hemiInt = base.hemiInt, glowAmt = 1, sunDisc = 1, fogDensity = 0.00016, sharp = d.sharp, cover = d.cover, dens = d.dens, cirrus = d.cirrus, wind = d.wind, ash = 0, stars = 1, cloudDark = 1;
  const o = clamp(d.overcast), s = clamp(d.storm), m = clamp(d.smoke), h = clamp(d.haze), c = clamp(d.cold);
  if (o > 0) {
    zenith = mulc(grey(zenith, 0.85 * o), lerp(1, 0.8, o)); mid = mulc(grey(mid, 0.9 * o), lerp(1, 0.92, o)); horizon = mulc(grey(horizon, 0.9 * o), lerp(1, 1.0, o)); glow = grey(glow, 0.9 * o);
    sunInt *= lerp(1, 0.2, o); glowAmt *= 1 - o * 0.8; sunDisc *= 1 - o; hemiInt *= lerp(1, 1.4, o); fogDensity += 0.00015 * o; stars *= 1 - o * 0.9; cloudDark *= lerp(1, 0.8, o);
  }
  if (s > 0) {
    const t = [0.88, 1, 1.0];
    zenith = mulc(mulv(grey(zenith, 0.7 * s), mixc([1, 1, 1], t, s)), lerp(1, 0.36, s)); mid = mulc(grey(mid, 0.7 * s), lerp(1, 0.42, s));
    horizon = mulc(mulv(grey(horizon, 0.65 * s), mixc([1, 1, 1], [0.86, 0.96, 0.9], s)), lerp(1, 0.55, s));
    sunInt *= lerp(1, 0.07, s); glowAmt *= 1 - s * 0.95; sunDisc *= 1 - s; hemiInt *= lerp(1, 0.85, s); fogDensity += 0.0004 * s; stars *= 1 - s; cloudDark *= lerp(1, 0.45, s);
  }
  if (h > 0) {
    horizon = mixc(horizon, mulc(HAZE_H, 0.35 + 0.65 * day), 0.6 * h); mid = mixc(mid, mixc(mid, horizon, 0.5), 0.5 * h); zenith = mixc(zenith, grey(zenith, 1), 0.3 * h);
    fogDensity += 0.0005 * h; glowAmt *= 1 + 0.6 * h; stars *= 1 - 0.5 * h;
  }
  if (c > 0) {
    zenith = mulv(zenith, mixc([1, 1, 1], [0.9, 1, 1.12], c)); mid = mulv(mid, mixc([1, 1, 1], [0.94, 1, 1.08], c)); horizon = mixc(horizon, mulc(lin('#d8e0f2'), lerp(0.2, 1, day)), 0.35 * c);
    sun = mulv(sun, mixc([1, 1, 1], [0.94, 0.98, 1.06], c)); fogDensity += 0.0003 * c;
  }
  if (m > 0) {
    const k = 0.22 + 0.78 * day;
    zenith = mixc(zenith, mulc(SMOKE.zenith, k), m); mid = mixc(mid, mulc(SMOKE.mid, k), m); horizon = mixc(horizon, mulc(SMOKE.horizon, k), m); glow = mixc(glow, SMOKE.glow, m); sun = mixc(sun, SMOKE.sun, m);
    sunInt *= lerp(1, 0.38, m); sunDisc *= lerp(1, 0.22, m); glowAmt *= lerp(1, 0.7, m); hemiInt *= lerp(1, 1.1, m); fogDensity += 0.0009 * m; ash = m; stars *= 1 - m; cloudDark *= lerp(1, 0.62, m);
  }
  const ground = mixc(mulc(horizon, 0.42), [0.07 * day + 0.006, 0.055 * day + 0.006, 0.04 * day + 0.008], 0.55);
  // cloud colours: sunlit side, shadow side, silver rim
  const sunK = clamp(sunInt / 3.1);
  const moonTint = [0.55, 0.65, 0.95];
  let cloudLit = mixc(mulc(moonTint, 0.07), mulc(mixc(sun, [1, 1, 1], 0.3), 1.12 * cloudDark), smoothstep(0, 0.35, sunK));
  const ambLit = mulc(mixc(horizon, mid, 0.5), 0.7 * cloudDark * smoothstep(-6, 8, e)); cloudLit = [Math.max(cloudLit[0], ambLit[0]), Math.max(cloudLit[1], ambLit[1]), Math.max(cloudLit[2], ambLit[2])];
  const cloudShade = mixc(mulc(mixc(mid, horizon, 0.35), 0.62 * cloudDark), mulc(moonTint, 0.025), 1 - smoothstep(-8, 4, e));
  const cloudRim = mulc(mixc(glow, sun, 0.5), 1.1 * smoothstep(-4, 6, e) * smoothstep(0.05, 0.5, sunK));
  // lights
  const hemiSky = mulc(mixc(mixc(zenith, mid, 0.55), horizon, 0.4 * (1 - smoothstep(8, 40, e))), 1.5); const hemiGround = mixc(mulc(horizon, 0.35), [0.2, 0.15, 0.1], 0.5);
  const moonUp = smoothstep(-2, 12, d.moonElev);
  const moonLightK = (1 - smoothstep(-8, 0, e)) * moonUp;
  // dim the whole sky by "night factor" only through palette; stars visibility from sun elevation
  const starVis = (1 - smoothstep(-15, -3, e)) * stars;
  return {
    zenith, mid, horizon, glow, ground, sun, sunInt, sunDisc, glowAmt, hemiInt, hemiSky: mulc(hemiSky, 1), hemiGround, fogDensity, fogColor: horizon,
    cloudLit, cloudShade, cloudRim, cover, sharp, dens, cirrus, wind, ash, starVis, milky: starVis, day,
    moonLightK, moonColor: [0.62, 0.74, 1.0], moonInt: 0.55,
    envInt: lerp(0.28, 0.5, day) * lerp(1, 1.1, o),
  };
}

export function dirFromAngles(elevDeg, azDeg, out) {
  const e = elevDeg * Math.PI / 180, a = azDeg * Math.PI / 180; const ce = Math.cos(e);
  // azimuth: 0 = +Z (north in scene), 90 = +X (east)
  return out.set(Math.sin(a) * ce, Math.sin(e), Math.cos(a) * ce);
}

/** CPU mirror of the shader's base gradient (used to bake the environment map). */
export function skyRadianceJS(dx, dy, dz, P, sd, out) {
  const y = dy, up = Math.max(y, 0); const w1 = Math.pow(1 - up, 2.6), w2 = Math.pow(1 - up, 10);
  let r = lerp(P.zenith[0], P.mid[0], w1), g = lerp(P.zenith[1], P.mid[1], w1), b = lerp(P.zenith[2], P.mid[2], w1);
  r = lerp(r, P.horizon[0], w2); g = lerp(g, P.horizon[1], w2); b = lerp(b, P.horizon[2], w2);
  const below = smoothstep(0, -0.18, y); r = lerp(r, P.ground[0], below); g = lerp(g, P.ground[1], below); b = lerp(b, P.ground[2], below);
  const s = Math.max(sd, 0); const lobe = (Math.pow(s, 3) * 0.12 + Math.pow(s, 14) * 0.35 + Math.pow(s, 90) * 0.9) * P.glowAmt * (y > -0.1 ? 1 : 0.3);
  r += P.glow[0] * lobe; g += P.glow[1] * lobe; b += P.glow[2] * lobe;
  if (y > 0) { const k = P.cover * 0.4 * smoothstep(0.02, 0.35, y) * P.dens; r = lerp(r, P.cloudShade[0] * 1.6 + P.cloudLit[0] * 0.25, k); g = lerp(g, P.cloudShade[1] * 1.6 + P.cloudLit[1] * 0.25, k); b = lerp(b, P.cloudShade[2] * 1.6 + P.cloudLit[2] * 0.25, k); }
  out[0] = r; out[1] = g; out[2] = b; return out;
}

/** Deterministic lightning: returns flash intensity 0..1 for time t (seconds). Multi-flicker strikes every few seconds. */
export function lightningFlash(t, seed = 1, rate = 1) {
  // strikes at pseudo-random times inside 6 s windows
  const w = Math.floor(t / 6 * rate), f = t / 6 * rate - w; let best = 0;
  for (let k = -1; k <= 0; k++) {
    const ww = w + k; let h = (ww * 374761393 + seed * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; const r1 = ((h >>> 0) % 1000) / 1000, r2 = (((h >>> 10) >>> 0) % 1000) / 1000;
    if (r1 < 0.35) continue; // not every window has a strike
    const start = 0.15 + r2 * 0.7 + (k === -1 ? -1 : 0); const tt = (f - start) * 6 / rate; // seconds since strike start
    if (tt < 0 || tt > 1.3) continue;
    const pulse = (a, d) => Math.exp(-Math.pow((tt - a) / d, 2));
    best = Math.max(best, Math.min(1, pulse(0.0, 0.035) * 1.0 + pulse(0.14, 0.03) * 0.75 + pulse(0.3, 0.07) * 0.55 + pulse(0.55, 0.12) * 0.25));
  }
  return best;
}
export function lightningDir(t, seed = 1, rate = 1, out) {
  const w = Math.floor((t - 1.3) / 6 * rate); // good enough: direction changes per window
  let h = (w * 2246822519 + seed * 3266489917) | 0; h = (h ^ (h >>> 15)) * 2246822519 | 0;
  const a = ((h >>> 0) % 6283) / 1000, e = 0.25 + (((h >>> 12) >>> 0) % 1000) / 1000 * 0.5; return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}
