// Procedural textures for the Vessari: bone-tan chitin shell, wet slate-blue scaled skin, living membrane, mouth flesh.
// All maps are seamlessly tileable (periodic noise / periodic voronoi) and cached (shared across models).
import * as THREE from 'three';
import { makeCanvas, texFromCanvas, heightToNormalCanvas, cached, texRes } from '../../engine/proc.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
function hash2(ix, iy, seed) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** periodic gradient noise, ~[-1,1], period P cells */
function pn(x, y, P, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const g = (ix, iy, dx, dy) => { const a = hash2(((ix % P) + P) % P, ((iy % P) + P) % P, seed) * 6.2831853; return Math.cos(a) * dx + Math.sin(a) * dy; };
  const u = fade(xf), v = fade(yf);
  return lerp(lerp(g(xi, yi, xf, yf), g(xi + 1, yi, xf - 1, yf), u), lerp(g(xi, yi + 1, xf, yf - 1), g(xi + 1, yi + 1, xf - 1, yf - 1), u), v) * 1.45;
}
/** tileable fbm field n*n in ~[0,1] */
export function field(n, scale, oct = 4, seed = 0) {
  const f = new Float32Array(n * n); let mn = 9, mx = -9;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n; let a = 0.5, s = 0, tot = 0, fr = scale;
    for (let o = 0; o < oct; o++) { s += a * pn(u * fr, v * fr, fr, seed * 7 + o); tot += a; a *= 0.5; fr *= 2; }
    s = s / tot; f[y * n + x] = s; if (s < mn) mn = s; if (s > mx) mx = s;
  }
  const k = 1 / (mx - mn || 1); for (let i = 0; i < f.length; i++) f[i] = (f[i] - mn) * k; return f;
}
const sampleF = (f, n, u, v) => { // bilinear, wrap
  u = (u - Math.floor(u)) * n; v = (v - Math.floor(v)) * n; const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0; const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
  return lerp(lerp(f[y0 * n + x0], f[y0 * n + x1], fx), lerp(f[y1 * n + x0], f[y1 * n + x1], fx), fy);
};
/** periodic voronoi; K cells per tile. returns d1,d2,id via out */
function pvor(u, v, K, seed, out) {
  const x = u * K, y = v * K, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % K) + K) % K, wy = ((cy % K) + K) % K;
    const rx = hash2(wx, wy, seed), ry = hash2(wx, wy, seed + 91);
    const dx = cx + rx - x, dy = cy + ry - y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < d1) { d2 = d1; d1 = d; id = hash2(wx, wy, seed + 17); } else if (d < d2) d2 = d;
  }
  out.d1 = d1; out.d2 = d2; out.id = id; return out;
}
const hexRGB = (h) => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
const mixc = (a, b, t, o) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
function share(t) { t.userData.shared = true; return t; }

/** Bone-tan chitin: faceted plates + fine lamination + hairline cracks + pits. returns {map, normalMap, roughnessMap} */
export function shellMaps() {
  return cached('alien.shell.' + texRes(512), () => {
    const N = texRes(512), FN = 160;
    const base = field(FN, 2, 4, 3), warp = field(FN, 3, 3, 5), crk = field(FN, 7, 4, 8), crk2 = field(FN, 13, 3, 9), pits = field(FN, 30, 2, 12), swirl = field(FN, 4, 3, 14);
    const col = makeCanvas(N), nh = makeCanvas(N), rg = makeCanvas(N);
    const cd = col.getContext('2d').createImageData(N, N), hd = nh.getContext('2d').createImageData(N, N), rd = rg.getContext('2d').createImageData(N, N);
    const dark = hexRGB('#9c8860'), mid = hexRGB('#cbb98f'), light = hexRGB('#e4d7b4'), pale = hexRGB('#f3ecd6'), tmp = [0, 0, 0], tmp2 = [0, 0, 0], o = { d1: 0, d2: 0, id: 0 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = (y * N + x) * 4;
      const b = sampleF(base, FN, u, v), w = sampleF(warp, FN, u, v), c1 = sampleF(crk, FN, u, v), c2 = sampleF(crk2, FN, u, v), pt = sampleF(pits, FN, u, v), sw = sampleF(swirl, FN, u, v);
      pvor(u + (w - 0.5) * 0.05, v + (w - 0.5) * 0.05, 7, 3, o);
      const edge = sstep(0.0, 0.07, o.d2 - o.d1); const cellTone = (o.id - 0.5) * 0.16;
      // fine lamination that follows the swirl field (subtle)
      const lam = 0.5 + 0.5 * Math.sin((v * 70 + (sw - 0.5) * 34) * 6.2831 * 0.5);
      const cr = Math.min(Math.abs(c1 - 0.5) / 0.004, Math.abs(c2 - 0.5) / 0.003); const crack = 1 - sstep(0.0, 1.0, cr); const stain = 1 - sstep(0.0, 8.0, cr);
      const pit = sstep(0.76, 0.82, pt);
      const t = clamp01(b * 0.95 + 0.02 + cellTone + (lam - 0.5) * 0.07 + (sw - 0.5) * 0.12);
      mixc(dark, mid, sstep(0.05, 0.55, t), tmp); mixc(tmp, light, sstep(0.55, 0.9, t), tmp2); mixc(tmp2, pale, sstep(0.9, 1.0, t) * 0.5, tmp);
      const k = 1 - (1 - edge) * 0.10 - stain * 0.07 - crack * 0.50 - pit * 0.35;
      cd.data[i] = tmp[0] * k; cd.data[i + 1] = tmp[1] * k * (1 - stain * 0.01); cd.data[i + 2] = tmp[2] * k * (1 - stain * 0.04); cd.data[i + 3] = 255;
      const h = clamp01(0.6 + (lam - 0.5) * 0.06 + (b - 0.5) * 0.30 + edge * 0.10 - crack * 0.5 - pit * 0.3);
      hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = h * 255; hd.data[i + 3] = 255;
      const rough = clamp01(0.26 + crack * 0.35 + pit * 0.25 + (1 - b) * 0.16 + (1 - edge) * 0.10);
      rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = rough * 255; rd.data[i + 3] = 255;
    }
    col.getContext('2d').putImageData(cd, 0, 0); nh.getContext('2d').putImageData(hd, 0, 0); rg.getContext('2d').putImageData(rd, 0, 0);
    return {
      map: share(texFromCanvas(col, { aniso: 8 })),
      normalMap: share(texFromCanvas(heightToNormalCanvas(nh, 2.0), { srgb: false, aniso: 8 })),
      roughnessMap: share(texFromCanvas(rg, { srgb: false })),
    };
  });
}

/** Wet slate-blue scaled skin with iridescent mottling. */
export function skinMaps() {
  return cached('alien.skin.' + texRes(512), () => {
    const N = texRes(512), FN = 128, K = 56;
    const mot = field(FN, 3, 4, 21), mot2 = field(FN, 6, 3, 23), tint = field(FN, 2, 3, 27);
    const col = makeCanvas(N), nh = makeCanvas(N), rg = makeCanvas(N);
    const cd = col.getContext('2d').createImageData(N, N), hd = nh.getContext('2d').createImageData(N, N), rd = rg.getContext('2d').createImageData(N, N);
    const A = hexRGB('#28405a'), B = hexRGB('#45688a'), C = hexRGB('#6b95b3'), tealC = [30, 120, 130], violC = [96, 70, 140], tmp = [0, 0, 0], o = { d1: 0, d2: 0, id: 0 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = (y * N + x) * 4;
      // scale cells slightly stretched along v (like fish/lizard scales) via warp
      pvor(u + Math.sin(v * 6.2831 * 3) * 0.004, v, K, 4, o);
      const edge = sstep(0.0, 0.16, o.d2 - o.d1), dome = clamp01(1 - o.d1 / 0.62);
      const m = sampleF(mot, FN, u, v) * 0.7 + sampleF(mot2, FN, u, v) * 0.3, tn = sampleF(tint, FN, u, v);
      let t = clamp01(m * 1.2 - 0.1 + (o.id - 0.5) * 0.18);
      mixc(A, B, sstep(0.0, 0.6, t), tmp); const r = tmp[0], g = tmp[1], bb = tmp[2]; mixc([r, g, bb], C, sstep(0.55, 1.0, t) * 0.8, tmp);
      // subtle iridescent hue drift per scale
      const ir = sstep(0.45, 0.9, tn) * (0.25 + 0.5 * o.id); const to = tn > 0.5 ? tealC : violC; const irk = ir * 0.28;
      let k = 0.62 + 0.38 * edge + dome * 0.28;
      cd.data[i] = lerp(tmp[0], to[0], irk) * k; cd.data[i + 1] = lerp(tmp[1], to[1], irk) * k; cd.data[i + 2] = lerp(tmp[2], to[2], irk) * k; cd.data[i + 3] = 255;
      const h = clamp01(0.25 + edge * 0.5 + dome * 0.35); hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = h * 255; hd.data[i + 3] = 255;
      const rough = clamp01(0.22 + (1 - edge) * 0.35 + (1 - m) * 0.15); rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = rough * 255; rd.data[i + 3] = 255;
    }
    col.getContext('2d').putImageData(cd, 0, 0); nh.getContext('2d').putImageData(hd, 0, 0); rg.getContext('2d').putImageData(rd, 0, 0);
    return {
      map: share(texFromCanvas(col, { aniso: 8 })),
      normalMap: share(texFromCanvas(heightToNormalCanvas(nh, 1.6), { srgb: false, aniso: 8 })),
      roughnessMap: share(texFromCanvas(rg, { srgb: false })),
    };
  });
}

/** Living membrane (robes, frills): indigo flesh with glowing cyan vein network. returns {map, emissiveMap, normalMap} */
export function membraneMaps() {
  return cached('alien.membrane.' + texRes(512), () => {
    const N = texRes(512), FN = 128, K = 9;
    const mot = field(FN, 3, 4, 41), mot2 = field(FN, 8, 3, 43), wob = field(FN, 4, 3, 45);
    const col = makeCanvas(N), em = makeCanvas(N), nh = makeCanvas(N);
    const cd = col.getContext('2d').createImageData(N, N), ed = em.getContext('2d').createImageData(N, N), hd = nh.getContext('2d').createImageData(N, N);
    const A = hexRGB('#1a2652'), B = hexRGB('#3a5896'), C = hexRGB('#6c8fc8'), tmp = [0, 0, 0], o = { d1: 0, d2: 0, id: 0 }, o2 = { d1: 0, d2: 0, id: 0 };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = (y * N + x) * 4;
      const w = sampleF(wob, FN, u, v) - 0.5; pvor(u + w * 0.07, v + w * 0.07, K, 6, o); pvor(u + w * 0.05, v + w * 0.05, K * 2, 8, o2);
      const e1 = 1 - sstep(0.0, 0.055, o.d2 - o.d1), e2 = (1 - sstep(0.0, 0.05, o2.d2 - o2.d1)) * 0.5;
      const m = sampleF(mot, FN, u, v) * 0.65 + sampleF(mot2, FN, u, v) * 0.35;
      mixc(A, B, sstep(0.1, 0.65, m), tmp); const r = tmp[0], g = tmp[1], b = tmp[2]; mixc([r, g, b], C, sstep(0.6, 1.0, m) * 0.6, tmp);
      const vein = Math.max(e1, e2); const k = 0.75 + 0.25 * sstep(0.0, 0.5, o.d1) ;
      cd.data[i] = tmp[0] * k * (1 - vein * 0.5); cd.data[i + 1] = tmp[1] * k * (1 - vein * 0.35); cd.data[i + 2] = tmp[2] * k; cd.data[i + 3] = 255;
      const pulse = vein * (0.55 + 0.45 * sampleF(mot2, FN, u * 1.0, v)); ed.data[i] = 70 * pulse; ed.data[i + 1] = 230 * pulse; ed.data[i + 2] = 255 * pulse; ed.data[i + 3] = 255;
      const h = clamp01(0.45 + vein * 0.25 + (m - 0.5) * 0.15); hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = h * 255; hd.data[i + 3] = 255;
    }
    col.getContext('2d').putImageData(cd, 0, 0); em.getContext('2d').putImageData(ed, 0, 0); nh.getContext('2d').putImageData(hd, 0, 0);
    return { map: share(texFromCanvas(col, { aniso: 4 })), emissiveMap: share(texFromCanvas(em, { aniso: 4 })), normalMap: share(texFromCanvas(heightToNormalCanvas(nh, 2.0), { srgb: false })) };
  });
}

/** Mouth / throat flesh: deep crimson-violet ridged tissue. */
export function mouthMaps() {
  return cached('alien.mouth.' + texRes(256), () => {
    const N = texRes(256), FN = 96; const f1 = field(FN, 4, 4, 51), f2 = field(FN, 9, 3, 53);
    const col = makeCanvas(N), nh = makeCanvas(N); const cd = col.getContext('2d').createImageData(N, N), hd = nh.getContext('2d').createImageData(N, N);
    const A = hexRGB('#2a0b1a'), B = hexRGB('#6a1e3c'), C = hexRGB('#a8486a'), tmp = [0, 0, 0];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = (y * N + x) * 4; const a = sampleF(f1, FN, u, v), b = sampleF(f2, FN, u, v);
      const ridge = 0.5 + 0.5 * Math.sin((u * 18 + (a - 0.5) * 5) * 6.2831); const t = clamp01(a * 0.8 + ridge * 0.35 - 0.1);
      mixc(A, B, sstep(0, 0.6, t), tmp); const r = tmp[0], g = tmp[1], bb = tmp[2]; mixc([r, g, bb], C, sstep(0.6, 1, t) * 0.7, tmp);
      const k = 0.7 + 0.3 * b; cd.data[i] = tmp[0] * k; cd.data[i + 1] = tmp[1] * k; cd.data[i + 2] = tmp[2] * k; cd.data[i + 3] = 255;
      const h = clamp01(0.4 + ridge * 0.45 + (b - 0.5) * 0.2); hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = h * 255; hd.data[i + 3] = 255;
    }
    col.getContext('2d').putImageData(cd, 0, 0); nh.getContext('2d').putImageData(hd, 0, 0);
    return { map: share(texFromCanvas(col, { aniso: 4 })), normalMap: share(texFromCanvas(heightToNormalCanvas(nh, 2.5), { srgb: false })) };
  });
}
