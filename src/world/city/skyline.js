// Cheap far-field skylines: ring or row of silhouette buildings with lit windows, haze-tinted. ONE draw call (+1 for gold/roofs).
import * as THREE from 'three';
import { RNG, Q, clamp, smoothstep } from '../../engine/common.js';
import { cached, texRes, fbm2 } from '../../engine/proc.js';
import { Layers, dat, shade } from './paint.js';
import { Builder, rgb, mix, mul } from './builder.js';

const PI = Math.PI;

/** window tile for the far field: 8 columns x 10 rows of windows, 3.0 x 3.6 m modules. returns {map, emi, data} */
function skylineTex() {
  return cached(`city.skytile.${Q.texSize}`, () => {
    const cols = 8, rows = 10, bw = 3.0, fh = 3.6; const tw = cols * bw, th = rows * fh; const W = texRes(512); const L = new Layers(tw, th, W / tw); const R = L.rng;
    L.rect(0, 0, tw, th, '#d4d2cc', dat(150, 215, 0));
    const warm = ['#ffd58a', '#ffe3a8', '#ffc470', '#fff0cc', '#e8f2ff', '#ffdca0'];
    for (let r = 0; r < rows; r++) {
      const rowLit = R.next() < 0.5 ? 0.55 : 0.12; // some floors mostly lit
      for (let c = 0; c < cols; c++) {
        const x = c * bw + 0.5, y = r * fh + 0.7, w = bw - 1.0, h = fh - 1.5; const lit = R.next() < rowLit;
        L.rect(x - 0.1, y - 0.1, w + 0.2, h + 0.2, '#b8b6b0', dat(165, 215, 0));
        L.vgrad(x, y, w, h, [[0, R.pick(['#9ab8d0', '#7a9ab8', '#a8c0d4'])], [1, '#26343f']]); L.rect(x, y, w, h, null, dat(70, 60, 110));
        if (lit) L.rect(x, y, w, h, 'rgba(255,214,140,0.35)', null, R.pick(warm));
      }
      L.rect(0, r * fh + fh - 0.25, tw, 0.25, 'rgba(0,0,0,0.18)');
    }
    L.mottle(3, 5, 0.85, 1); L.grain(2500, [0.03, 0.1]);
    const t = L.textures(); t.userData = { shared: true }; t.tile = [tw, th]; return t;
  });
}

const PAL = {
  manhattan: [0x8a8f98, 0x9aa0a6, 0xb0a898, 0x7a828c, 0xa8a090, 0x6a7078, 0xb8b4a8, 0x98a4b0],
  moscow: [0xc8bc98, 0xb8b090, 0xa8a89c, 0xc8c0a8, 0x9c9e98, 0xb0a890],
  dumaguete: [0xe8c8c0, 0xd0e4d8, 0xe8dca8, 0xb0d4e4, 0xe8c0a0, 0xd8d0e0, 0xe0d8c8],
  cebu: [0x90b0c8, 0x8ab4bc, 0xa8b8c8, 0x98a8b8, 0xb8c0c4, 0x78a0b8],
  berlin: [0xe0d4b8, 0xd8c8a8, 0xc8c4b0, 0xd0d4c8, 0xe0c8b8, 0xc4c8d0],
  delhi: [0xe4d0b0, 0xdcb8a0, 0xcca8a0, 0xa8c4bc, 0xe8dcc0, 0xd4c488],
  generic: [0xa8a8a4, 0xb8b8b0, 0x98a0a8, 0xc0bcb0], suburb: [0xe8e0d0, 0xd0d8e0, 0xe0d0c0], industrial: [0xa8aca8, 0xb8b4a8, 0x989c9c, 0xb8aca0],
};
const HEIGHT = { // [min,max] metres, count multiplier
  manhattan: [40, 320], moscow: [30, 75], dumaguete: [7, 26], cebu: [25, 150], berlin: [18, 26], delhi: [8, 22], generic: [15, 90], suburb: [6, 12], industrial: [10, 30],
};

function emitBox(B, bk, x, z, w, d, y0, h, yaw, col, tileRng, hazeAt, uvScale = [24, 36]) {
  B.push(x, y0, z, yaw); const hw = w / 2, hd = d / 2; const ao = (y, hz) => mix(col, hz.col, clamp(hz.f + (1 - y / (h + y0 + 1)) * 0.18, 0, 1));
  const faces = [[[-hw, hd], [hw, hd], w], [[hw, hd], [hw, -hd], d], [[hw, -hd], [-hw, -hd], w], [[-hw, -hd], [-hw, hd], d]]; const uo = tileRng.next(), vo = tileRng.next();
  const cb = ao(0, hazeAt), ct = ao(h, hazeAt);
  for (const [a, b, len] of faces) B.quad(bk, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]], [uo, vo, uo + len / uvScale[0], vo + h / uvScale[1]], [cb, cb, ct, ct]);
  B.quad('sky_roof', [-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd], [0, 0, 1, 1], mul(col, 0.7), [0, 1, 0]);
  B.pop();
}

/** createSkyline(style, {kind:'ring'|'row', radius, length, depth, count, seed, haze, hazeAmount, minH, maxH, rows}) */
export function createSkyline(style = 'generic', opts = {}) {
  const rng = new RNG((opts.seed || 1) * 4421 + 9); const tr = new RNG(77); const B = new Builder();
  const pal = PAL[style] || PAL.generic; const hr = HEIGHT[style] || HEIGHT.generic; const minH = opts.minH ?? hr[0], maxH = opts.maxH ?? hr[1];
  const kind = opts.kind || 'ring'; const radius = opts.radius || 1400; const count = opts.count || 150; const haze = rgb(opts.haze ?? 0xc8d8e8); const hazeAmount = opts.hazeAmount ?? 0.5; const length = opts.length || 2400; const depth = opts.depth || 350;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const t = skylineTex(); mat.map = t.map; mat.emissiveMap = t.emi; mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 0; mat.roughnessMap = t.data; mat.metalnessMap = t.data; mat.metalness = 1; mat.roughness = 1;
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }); const goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.8 });
  const cluster = (x, z) => fbm2(x * 0.0016 + (opts.seed || 1) * 3.1, z * 0.0016, 3);
  for (let i = 0; i < count; i++) {
    let x, z, yaw, distF;
    if (kind === 'ring') { const a = (i + rng.range(-0.4, 0.4)) / count * PI * 2; const r = radius * rng.range(0.92, 1.12); x = Math.cos(a) * r; z = Math.sin(a) * r; yaw = -a + PI / 2; distF = (r - radius * 0.9) / (radius * 0.3); }
    else { x = (i / count - 0.5) * length + rng.range(-length / count, length / count); z = -rng.range(0, depth) - (opts.z0 || 0); yaw = 0; distF = -z / depth; }
    const hz = { col: haze, f: clamp(hazeAmount * (0.5 + distF * 0.5), 0, 0.92) };
    const c = cluster(x, z); let h = minH + (maxH - minH) * Math.pow(clamp((c - 0.35) * 2.2, 0, 1) * rng.range(0.4, 1.0), style === 'manhattan' ? 1.4 : 1.8) + rng.range(0, (maxH - minH) * 0.08);
    let w = rng.range(14, 38) * (style === 'dumaguete' || style === 'delhi' ? 0.55 : 1) * (style === 'berlin' ? 1.4 : 1), d = rng.range(14, 34) * (style === 'dumaguete' || style === 'delhi' ? 0.55 : 1); const base = rng.pick(pal);
    const col = [rgb(base)[0] * rng.range(0.85, 1.05), rgb(base)[1] * rng.range(0.85, 1.05), rgb(base)[2] * rng.range(0.85, 1.05)];
    if (style === 'manhattan' && h > 100) { // stepped tower with crown
      const tiers = rng.int(2, 4); let cy = 0, cw = w, cd = d; for (let k = 0; k < tiers; k++) { const th = k === tiers - 1 ? h - cy : (h - cy) * rng.range(0.4, 0.65); emitBox(B, 'sky', x, z, cw, cd, cy, th, yaw, col, tr, hz); cy += th; cw *= 0.72; cd *= 0.72; }
      if (rng.chance(0.55)) { B.push(x, h, z, yaw); const sh = rng.range(20, 60); B.cyl('sky_roof', 0, 0, 0, Math.min(cw, cd) * 0.35, 0.3, sh, 6, { col: mix(0xc0c8d0, haze, hz.f), flat: true }); B.pop(); }
    } else if (style === 'moscow' && rng.chance(0.14)) { // seven-sisters style spired tower
      const th = h * rng.range(2.0, 2.6); const tiers = [[1, 0.55], [0.7, 0.25], [0.45, 0.14]]; let cy = 0; for (const [f, hf] of tiers) { emitBox(B, 'sky', x, z, w * f * 1.2, d * f * 1.2, cy, th * hf, yaw, col, tr, hz); cy += th * hf; } B.push(x, cy, z, yaw); B.cyl('gold', 0, 0, 0, w * 0.18, 0.2, th * 0.22, 8, { col: mix(0xb0c8b0, haze, hz.f), flat: true }); B.pop();
    } else if ((style === 'moscow' || style === 'delhi') && rng.chance(0.1)) { // domed church / mosque
      emitBox(B, 'sky', x, z, 14, 14, 0, h * 0.7, yaw, col, tr, hz); B.sphere('gold', x, h * 0.7 + 4, z, 6, 6.5, 6, 10, 6, { col: mix(0xe8c050, haze, hz.f), t1: PI * 0.62 }); B.cyl('gold', x, h * 0.7 + 10, z, 0.4, 0.2, 6, 5, { col: mix(0xe8c050, haze, hz.f) });
    } else if (style === 'berlin' && i === 0) { // TV tower silhouette
      B.cyl('sky_roof', x, 0, z, 9, 4, 200, 10, { col: mix(0xc0c4c8, haze, hz.f), flat: true }); B.sphere('gold', x, 205, z, 16, 16, 16, 12, 8, { col: mix(0xc8ccd0, haze, hz.f) }); B.cyl('sky_roof', x, 215, z, 1.6, 0.2, 150, 6, { col: mix(0xc04040, haze, hz.f) });
    } else if (style === 'industrial' && rng.chance(0.4)) { // stacks & tanks
      const hh = rng.range(20, 60); B.cyl('sky_roof', x, 0, z, rng.range(2, 4), 1.6, hh, 8, { col: mix(0xb0a898, haze, hz.f), flat: true }); if (rng.chance(0.6)) B.cyl('sky_roof', x + 12, 0, z, 9, 9, 12, 12, { col: mix(0xc8c8c0, haze, hz.f) });
    } else emitBox(B, 'sky', x, z, w, d, 0, h, yaw, col, tr, hz);
    if (style === 'dumaguete' && rng.chance(0.4)) B.cyl('sky_roof', x, 0, z + 14, 0.5, 0.3, rng.range(8, 14), 5, { col: mix(0x3a5a2a, haze, hz.f) }), B.sphere('sky_roof', x, rng.range(10, 14), z + 14, 3.2, 1.6, 3.2, 6, 4, { col: mix(0x3a6a2a, haze, hz.f) });
  }
  const root = new THREE.Group(); root.name = 'skyline_' + style;
  const geos = B.build();
  const map = { sky: mat, sky_roof: roofMat, gold: goldMat };
  for (const [name, g] of geos) { const m = new THREE.Mesh(g, map[name] || roofMat); m.name = name; m.castShadow = false; m.receiveShadow = false; root.add(m); }
  return { root, update() {}, setNight(n) { mat.emissiveIntensity = n * 1.8; }, dispose() { root.traverse((o) => o.geometry && o.geometry.dispose()); mat.dispose(); roofMat.dispose(); goldMat.dispose(); }, stats: { tris: B.tris() } };
}
