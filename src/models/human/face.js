// Face parts: eyes (iris textures), teeth/gums/tongue, brows, lashes, follower morph helper, and the FaceRig runtime (expressions, lipsync, blinks, saccades).
import * as THREE from 'three';
import { RNG, GLOBAL } from '../../engine/common.js';
import { makeCanvas, texFromCanvas, noise2, fbm2, cached, texRes } from '../../engine/proc.js';
import { smooth, mixn, applySkin, mergeAll, tint, rigid, rseg } from './kit.js';
import { baseXZ, FEAT } from './head.js';

const N2M = (head, x, y, z, out) => out.set(head.pivot.x + x * head.sh, head.pivot.y + y * head.sh, head.pivot.z + z * head.sh);

// ------------------------------------------------------------------------------------------------ eyes
export function irisTexture(color, { holo = false, rim = 0.5 } = {}) {
  return cached('human.iris.' + color + holo, () => {
    const W = texRes(512), Hh = W / 2; const c = makeCanvas(W, Hh), ctx = c.getContext('2d'); const img = ctx.createImageData(W, Hh); const d = img.data;
    const base = new THREE.Color(color); const hsl = {}; base.getHSL(hsl);
    const outer = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.05), hsl.l * 0.55);
    const inner = new THREE.Color().setHSL(hsl.h + 0.02, Math.min(1, hsl.s * 0.9), Math.min(0.75, hsl.l * 1.55 + 0.04));
    const collar = new THREE.Color().setHSL(hsl.h - 0.03, 0.6, Math.min(0.6, hsl.l + 0.18));
    const sc = new THREE.Color('#eae5de'), scDark = new THREE.Color('#bfb8b2'), vein = new THREE.Color('#c25a56');
    const THI = 0.575, THP = 0.21;
    for (let y = 0; y < Hh; y++) {
      const th = (y + 0.5) / Hh * Math.PI;
      for (let x = 0; x < W; x++) {
        const u = x / W; const i = (y * W + x) * 4; let r, g, b;
        if (th < THI + 0.02) {
          const rr = (th - THP) / (THI - THP);   // 0 at pupil edge .. 1 at iris edge
          const fib = 0.78 + 0.42 * noise2(u * 90, th * 7) * 0.7 + 0.25 * noise2(u * 200 + 3, th * 20) * 0.5;
          let col = new THREE.Color().copy(inner).lerp(base, smooth(0.0, 0.55, rr)).lerp(outer, smooth(0.55, 1.0, rr));
          const col2 = collar.clone(); col.lerp(col2, Math.exp(-(((rr - 0.22) / 0.10) ** 2)) * 0.45);
          // limbal ring
          col.multiplyScalar(1 - 0.75 * smooth(0.82, 1.05, rr)); col.multiplyScalar(fib);
          // crypts (darker blotches)
          col.multiplyScalar(1 - 0.28 * Math.max(0, noise2(u * 40 + 9, th * 9 + 4)) * smooth(0.1, 0.5, rr));
          const pu = smooth(THP - 0.012, THP + 0.012, th);
          r = col.r * pu + 0.01 * (1 - pu); g = col.g * pu + 0.01 * (1 - pu); b = col.b * pu + 0.012 * (1 - pu);
          const edge = smooth(THI + 0.015, THI - 0.015, th); // blend to sclera
          const sclera = scleraColor(u, th, sc, scDark, vein); r = r * edge + sclera[0] * (1 - edge); g = g * edge + sclera[1] * (1 - edge); b = b * edge + sclera[2] * (1 - edge);
        } else { const s2 = scleraColor(u, th, sc, scDark, vein); r = s2[0]; g = s2[1]; b = s2[2]; }
        d[i] = lin2s(r); d[i + 1] = lin2s(g); d[i + 2] = lin2s(b); d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = texFromCanvas(c, { aniso: 8 }); t.userData.shared = true;
    return t;
  });
}
const lin2s = (v) => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
function scleraColor(u, th, sc, scDark, vein) {
  const c = sc.clone();
  // darker toward back, upper lid shadow (u≈.75 up)
  const upShade = Math.exp(-(((u - 0.75) / 0.2) ** 2)) * smooth(0.55, 1.0, th) * 0.22;
  c.lerp(scDark, smooth(0.9, 1.7, th) * 0.8 + upShade);
  // fine veins: ridged noise
  const v1 = 1 - Math.abs(noise2(u * 50 + th * 3, th * 10)) * 3.2; const vm = Math.max(0, v1) * smooth(0.65, 1.3, th) * 0.35;
  c.lerp(vein, vm);
  // caruncle corners at u≈0 (nasal for left) and 0.5
  const cn = Math.max(Math.exp(-(((u - 0.0) / 0.05) ** 2), Math.exp(-(((u - 1.0) / 0.05) ** 2))), Math.exp(-(((u - 0.5) / 0.05) ** 2)) * 0.55) * smooth(0.85, 1.25, th) * (1 - smooth(1.45, 1.8, th));
  c.lerp(new THREE.Color('#d98580'), cn * 0.55);
  return [c.r, c.g, c.b];
}
export function holoEmissiveTexture() {
  return cached('human.iris.holo', () => {
    const W = texRes(512), Hh = W / 2; const c = makeCanvas(W, Hh), ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Hh);
    const y0 = (0.33 / Math.PI) * Hh, y1 = (0.50 / Math.PI) * Hh;
    const g = ctx.createLinearGradient(0, y0 - 6, 0, y1 + 6); g.addColorStop(0, 'rgba(70,230,255,0)'); g.addColorStop(0.2, 'rgba(70,230,255,0.75)'); g.addColorStop(0.55, 'rgba(120,245,255,1)'); g.addColorStop(0.85, 'rgba(70,230,255,0.4)'); g.addColorStop(1, 'rgba(70,230,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y0 - 6, W, y1 - y0 + 12);
    // tick marks / circuitry
    ctx.fillStyle = 'rgba(200,255,255,0.8)'; for (let k = 0; k < 72; k++) ctx.fillRect(k * W / 72, (0.375 / Math.PI) * Hh, 1.5, ((k % 3 === 0) ? 10 : 5) * (W / 512));
    ctx.strokeStyle = 'rgba(160,250,255,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, (0.31 / Math.PI) * Hh); ctx.lineTo(W, (0.31 / Math.PI) * Hh); ctx.stroke();
    const t = texFromCanvas(c, { aniso: 4 }); t.userData.shared = true; return t;
  });
}
export function buildEyeGeometry(head, bi) {
  const H = head.H, list = [];
  for (const side of [1, -1]) {
    const R = H.re * head.sh;
    const g = new THREE.SphereGeometry(R, rseg(36, 20), rseg(26, 14));
    g.rotateX(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const l = Math.hypot(x, y, z); const th = Math.acos(Math.max(-1, Math.min(1, z / l)));
      const k = 1 + 0.115 * (1 - smooth(0.05, 0.55, th)) * (1 - smooth(0.3, 0.55, th) * 0.0);
      p.setXYZ(i, x * k * 1.09, y * k, z * k);
    }
    g.computeVertexNormals();
    const c = N2M(head, side * H.eyeX, H.ey, H.ez, new THREE.Vector3());
    g.translate(c.x, c.y, c.z);
    applySkin(g, rigid(bi, side > 0 ? 'eyeL' : 'eyeR'));
    list.push(g);
  }
  return mergeAll(list);
}

// ------------------------------------------------------------------------------------------------ mouth parts (teeth, gums, tongue)
export function buildMouthGeometry(head, bi) {
  const H = head.H, sh = head.sh, ym = H.ym;
  const parts = [];
  const col = (g, c) => tint(g, c);
  const toothSpec = [[0.0085, 0.0105, 0.0058], [0.0066, 0.0092, 0.0052], [0.0074, 0.0108, 0.0066]];
  const R = 0.030;
  const mk = (upper) => {
    const gs = [];
    const zf = upper ? 0.0888 : 0.0868;
    const edgeY = upper ? ym - 0.0016 : ym + 0.0012;
    let cum = 0;
    const wCent = toothSpec[0][0];
    for (const sgn of [1, -1]) {
      cum = 0;
      for (let k = 0; k < toothSpec.length; k++) {
        const [w, h, t] = toothSpec[k]; let xc;
        if (k === 0) xc = wCent / 2; else { cum = wCent; for (let q = 1; q < k; q++) cum += toothSpec[q][0]; xc = cum + w / 2; }
        const g = new THREE.SphereGeometry(1, 8, 6);
        // taper + shaping
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ny = y; const edge = upper ? -ny : ny; x *= 1 + 0.10 * edge; z *= 1 - 0.18 * Math.max(0, -edge); if (k === 2) { y *= 1 + 0.12 * Math.max(0, edge); } p.setXYZ(i, x * w / 2, y * h / 2, z * t / 2); }
        g.computeVertexNormals();
        const zc = zf - (xc * xc) / (2 * R) - t * 0.5;
        const ang = Math.atan2(xc, R) * 0.9;
        g.rotateY(sgn * ang);
        const yc = upper ? edgeY + h / 2 : edgeY - h / 2;
        g.translate(sgn * xc, yc, zc + 0.0 + t * 0.5);
        // nominal -> model
        g.scale(sh, sh, sh); g.translate(head.pivot.x, head.pivot.y, head.pivot.z);
        col(g, '#efe7d6'); applySkin(g, rigid(bi, upper ? 'head' : 'jaw')); gs.push(g);
      }
    }
    // gum arch
    const pts = [];
    for (let q = -9; q <= 9; q++) { const x = q / 9 * 0.0195; const z = zf - (x * x) / (2 * R) - 0.0015 - 0.002 * Math.abs(q) / 9; const y = upper ? ym + 0.0118 : ym - 0.0120; pts.push(new THREE.Vector3(x, y, z)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(curve, 28, 0.0046, 7, false);
    // flatten the tube a bit (taller than thick)
    { const pp = tg.attributes.position; for (let i = 0; i < pp.count; i++) { /* keep */ } }
    tg.scale(sh, sh, sh); tg.translate(head.pivot.x, head.pivot.y, head.pivot.z);
    col(tg, '#c9646f'); tg.deleteAttribute('uv'); tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tg.attributes.position.count * 2), 2));
    applySkin(tg, rigid(bi, upper ? 'head' : 'jaw'));
    gs.push(tg);
    return gs;
  };
  const up = mk(true), lo = mk(false);
  for (const g of up.concat(lo)) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); parts.push(g); }
  // tongue
  const tong = new THREE.SphereGeometry(1, 14, 10);
  const tp = tong.attributes.position; const L = 0.027, Wd = 0.0165, Ht = 0.0058;
  const raise = [];
  for (let i = 0; i < tp.count; i++) {
    let x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
    const t = (z + 1) / 2; // 0 root .. 1 tip
    x *= Wd * (1 - 0.38 * Math.pow(t, 1.5)); z *= L; y *= Ht * (1 - 0.35 * t);
    y += 0.0018 * Math.sin(t * Math.PI) * (y > 0 ? 1 : 0.4);
    tp.setXYZ(i, x, y, z); raise.push(t);
  }
  tong.computeVertexNormals();
  const tcz = 0.0585, tcy = ym - 0.0098;
  tong.translate(0, tcy, tcz);
  const rt = new Float32Array(tp.count * 3);
  for (let i = 0; i < tp.count; i++) { const t = raise[i]; rt[i * 3 + 1] = 0.0105 * Math.pow(t, 1.4) * sh; rt[i * 3 + 2] = 0.0035 * t * sh; }
  tong.scale(sh, sh, sh); tong.translate(head.pivot.x, head.pivot.y, head.pivot.z);
  const tcol = new Float32Array(tp.count * 3); const cA = new THREE.Color('#c25a63'), cB = new THREE.Color('#9c3f4a');
  for (let i = 0; i < tp.count; i++) { const k = 0.5 + 0.5 * noise2(tp.getX(i) * 400, tp.getZ(i) * 400); const c = cA.clone().lerp(cB, 0.35 * k + (tp.getY(i) < head.pivot.y + tcy * sh ? 0.3 : 0)); tcol[i * 3] = c.r; tcol[i * 3 + 1] = c.g; tcol[i * 3 + 2] = c.b; }
  tong.setAttribute('color', new THREE.BufferAttribute(tcol, 3)); tong.deleteAttribute('uv'); tong.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tp.count * 2), 2));
  applySkin(tong, rigid(bi, 'jaw'));
  // morph target raise: need other parts to have zeros -> done after merge using vertex ranges
  const geo = mergeAll(parts.concat([tong]));
  const total = geo.attributes.position.count; const tStart = total - tp.count;
  const full = new Float32Array(total * 3); full.set(rt, tStart * 3);
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(full, 3)]; geo.morphTargetsRelative = true;
  return geo;
}

// ------------------------------------------------------------------------------------------------ followers (brows / lashes / beard shells)
const ROT_MORPHS = new Set(['blinkL', 'blinkR', 'lidWide', 'squint', 'browUp', 'browDown']);
/** morph attributes for a mesh whose vertices follow head-grid vertices. anchors[i] = {v, ox,oy,oz (nominal offset from the anchor), eye (+1/-1/0)} */
export function followerMorphs(head, anchors) {
  const M = head.geometry.userData.morphDeltas, names = head.morphNames, sh = head.sh, H = head.H, n = anchors.length;
  return names.map((name) => {
    const d = M[name]; const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = anchors[i], b = a.v * 3; let dx = d[b], dy = d[b + 1], dz = d[b + 2];
      if (a.eye && ROT_MORPHS.has(name) && (dy !== 0 || dz !== 0)) {
        const av = head.verts[a.v]; const py = av.y - H.ey, pz = av.z - H.ez;
        const a0 = Math.atan2(py, pz), a1 = Math.atan2(py + dy, pz + dz); const dl = a1 - a0; const ca = Math.cos(dl), sa = Math.sin(dl);
        const oy = a.oy || 0, oz = a.oz || 0;
        dy += oy * ca + oz * sa - oy; dz += oz * ca - oy * sa - oz;
      }
      arr[i * 3] = dx * sh; arr[i * 3 + 1] = dy * sh; arr[i * 3 + 2] = dz * sh;
    }
    return new THREE.Float32BufferAttribute(arr, 3);
  });
}

// ---- eyebrows
function browTexture(color, seedStr) {
  return cached('human.brow.' + color + seedStr, () => {
    const W = 256, Hh = 64; const c = makeCanvas(W, Hh), ctx = c.getContext('2d'); ctx.clearRect(0, 0, W, Hh);
    const r = new RNG(77 + seedStr.length * 13); const base = new THREE.Color(color);
    // soft body so the brow reads as a continuous mass
    const g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.22, 'rgba(0,0,0,0.85)'); g.addColorStop(0.78, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = color; ctx.globalAlpha = 0.9; ctx.fillRect(0, Hh * 0.2, W, Hh * 0.6); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in'; const gx = ctx.createLinearGradient(0, 0, W, 0); gx.addColorStop(0, 'rgba(0,0,0,0.7)'); gx.addColorStop(0.05, 'rgba(0,0,0,1)'); gx.addColorStop(0.8, 'rgba(0,0,0,0.95)'); gx.addColorStop(1, 'rgba(0,0,0,0.2)'); ctx.fillStyle = gx; ctx.fillRect(0, 0, W, Hh);
    ctx.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 900; k++) {
      const t = r.next(); const x0 = 4 + t * (W - 14); const y0 = Hh * (0.5 + r.gauss() * 0.2);
      const ang = (-1.05 + t * 1.45) + r.gauss() * 0.16; const len = r.range(12, 30) * (0.75 + 0.5 * (1 - t));
      const c2 = base.clone().multiplyScalar(r.range(0.65, 1.3)).convertLinearToSRGB(); ctx.strokeStyle = `rgba(${Math.round(c2.r * 255)},${Math.round(c2.g * 255)},${Math.round(c2.b * 255)},${r.range(0.7, 1)})`; ctx.lineWidth = r.range(1.4, 2.6);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * 0.5, y0 + Math.sin(ang) * len * 0.5 - 1.5, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len); ctx.stroke();
    }
    const t = texFromCanvas(c, { aniso: 4, wrap: 'clamp' }); t.userData.shared = true; return t;
  });
}
export function browMaterial(P) {
  return new THREE.MeshStandardMaterial({ map: browTexture(P.brows.color, P.id), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, transparent: false });
}
export function buildBrows(P, head, bi) {
  const H = head.H, f = P.face, sh = head.sh, br = P.brows;
  const geos = [];
  const tex = browTexture(br.color, P.id);
  for (const side of [1, -1]) {
    const SEG = 16; const pos = [], uv = [], idx = [], anchors = [];
    const xi = 0.0105 * br.spacing * (H.eyeX / 0.0315) ** 0.6, xo = 0.054 * (H.eyeX / 0.0315) ** 0.8;
    const arch = br.arch, thick = br.thick * (P.isFemale ? 0.85 : 1.05);
    const yIn = 0.0262 + 0.0016 * (f.brow - 1);
    const rows = [];
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG; const x = side * (xi + (xo - xi) * t);
      const peak = 0.0042 + 0.0075 * arch;
      const yc = yIn + peak * Math.pow(Math.sin(Math.min(1, t / 0.62) * Math.PI / 2), 1.2) - (t > 0.62 ? (t - 0.62) / 0.38 * (peak - 0.0025 + 0.002 * (1 - arch)) : 0);
      const hgt = thick * (0.0050 + 0.0047 * Math.sin(Math.min(1, (t + 0.08) / 0.5) * Math.PI / 2)) * (1 - 0.72 * Math.pow(t, 2.2));
      rows.push({ x, yc, hgt, t });
    }
    for (let k = 0; k <= SEG; k++) {
      const r = rows[k];
      for (let q = 0; q < 2; q++) {
        const y = r.yc + (q === 0 ? -0.5 : 0.5) * r.hgt; const s = head.sample(r.x, y);
        const off = 0.0007; const p = [s.p[0] + s.n[0] * off, s.p[1] + s.n[1] * off, s.p[2] + s.n[2] * off];
        pos.push(head.pivot.x + p[0] * sh, head.pivot.y + p[1] * sh, head.pivot.z + p[2] * sh);
        uv.push(k / SEG, q === 0 ? 0 : 1);
        anchors.push({ v: s.v, eye: 0 });
      }
    }
    for (let k = 0; k < SEG; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // mirrored texture for the right brow (hair direction)
    if (side < 0) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setX(i, u.getX(i)); }
    applySkin(g, rigid(bi, 'head'));
    g.morphAttributes.position = followerMorphs(head, anchors); g.morphTargetsRelative = true;
    geos.push(g);
  }
  // merge keeping morphs
  return mergeMorph(geos);
}
export function mergeMorph(geos) {
  const merged = mergeAll(geos.map((g) => { const c = g.clone(); delete c.morphAttributes.position; return c; }));
  const n = geos[0].morphAttributes.position.length; const list = [];
  for (let m = 0; m < n; m++) { let tot = 0; for (const g of geos) tot += g.morphAttributes.position[m].count; const arr = new Float32Array(tot * 3); let o = 0; for (const g of geos) { arr.set(g.morphAttributes.position[m].array, o); o += g.morphAttributes.position[m].count * 3; } list.push(new THREE.Float32BufferAttribute(arr, 3)); }
  merged.morphAttributes.position = list; merged.morphTargetsRelative = true;
  return merged;
}

// ---- lashes
export function buildLashes(P, head, bi) {
  const H = head.H, sh = head.sh, F = P.isFemale;
  const dens = F ? 2 : 1; const len = (F ? 0.0082 : 0.0050) * (1 + (P.skin.eyeliner || 0) * 0.15) * (P.youth ? 0.7 : 1);
  const geos = [];
  for (const side of [1, -1]) {
    const pos = [], idx = [], anchors = []; let nv = 0;
    const lids = head.verts.filter((v) => v.kind === 'lidUp' && Math.sign(v.x) === side).sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
    const lowers = head.verts.filter((v) => v.kind === 'lidLo' && Math.sign(v.x) === side).sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
    const E = { y: H.ey, z: H.ez };
    const emit = (v, up, scale, jitter) => {
      for (let q = 0; q < (up ? dens : 1); q++) {
        const xn = (Math.abs(v.x) - 0.0155) / 0.033; const L = len * scale * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, Math.max(0, xn))) + 0.25 * xn) * (up ? 1 : 0.55);
        const dyz = new THREE.Vector2(v.z - E.z, v.y - E.y).normalize(); // direction away from eye centre in (z,y)
        // lash direction: radial, tilted outward (x) towards the outer corner and curled up
        const jx = (q - (dens - 1) / 2) * 0.0007 + jitter * 0.0004;
        const dirx = side * (xn - 0.35) * 0.55 + jitter * 0.1;
        const pts = [];
        for (let k = 0; k <= 3; k++) {
          const t = k / 3; const curl = up ? 0.55 : -0.25;
          const dz = dyz.x * (t * L) + 0.35 * (t * t * L) * (up ? 1 : -0.2) , dy = dyz.y * (t * L) + curl * t * t * L * 0.6 * (up ? 1 : -1);
          pts.push([v.x + jx + dirx * t * L, v.y + dy, v.z + 0.0004 + dz]);
        }
        const w0 = 0.00062 * (up ? 1 : 0.7);
        for (let k = 0; k <= 3; k++) { const w = w0 * (1 - k / 3 * 0.85); const p = pts[k]; pos.push(head.pivot.x + (p[0] - w) * sh, head.pivot.y + p[1] * sh, head.pivot.z + p[2] * sh, head.pivot.x + (p[0] + w) * sh, head.pivot.y + p[1] * sh, head.pivot.z + p[2] * sh); anchors.push({ v: v.idx, eye: side, oy: p[1] - v.y, oz: p[2] - v.z }, { v: v.idx, eye: side, oy: p[1] - v.y, oz: p[2] - v.z }); }
        for (let k = 0; k < 3; k++) { const a = nv + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        nv += 8;
      }
    };
    lids.forEach((v, i) => emit(v, true, 1, ((i * 7919) % 5 - 2) / 2));
    if (F) lowers.forEach((v, i) => { if (i % 2 === 0) emit(v, false, 1, 0); });
    if (!pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    applySkin(g, rigid(bi, 'head'));
    g.morphAttributes.position = followerMorphs(head, anchors); g.morphTargetsRelative = true;
    geos.push(g);
  }
  return geos.length ? mergeMorph(geos) : null;
}

// ------------------------------------------------------------------------------------------------ deterministic schedules (seekable)
class Events {
  constructor(seed) { this.rng = new RNG(seed); this.t = []; this.v = []; this.last = 0; }
  extend(until, gen) { while (!this.t.length || this.t[this.t.length - 1] < until) gen(this); }
}
export class FaceRig {
  constructor({ head, headMesh, followers = [], mouthMesh = null, bones, profile }) {
    this.head = head; this.headMesh = headMesh; this.followers = followers; this.mouthMesh = mouthMesh; this.bones = bones; this.P = profile;
    this.names = head.morphNames; this.inf = headMesh.morphTargetInfluences; for (const f of followers) f.morphTargetInfluences = this.inf;
    this.idx = {}; this.names.forEach((n, i) => { this.idx[n] = i; });
    this.mouth = { jaw: 0, wide: 0, round: 0, press: 0, tuck: 0, teeth: 0, tongue: 0 };
    this.mouthS = { jaw: 0, wide: 0, round: 0, press: 0, tuck: 0, teeth: 0, tongue: 0 };
    this.expr = { smile: 0, frown: 0, surprise: 0, fear: 0, anger: 0, sad: 0 }; this.exprS = { ...this.expr };
    this.blinkOverride = undefined; this.baseSmile = profile.baseSmile || 0;
    this.blinks = []; this.sacc = []; this.rngB = new RNG(profile.seed ^ 0xb11c); this.rngS = new RNG(profile.seed ^ 0x5acc);
    this.bt = 0; this.st = 0; this.gazeYaw = 0; this.gazePitch = 0; this.gazeW = 0; this.talk = 0;
    this.maxJaw = 0.34; this.mouthAmp = 1; this.tmp = new THREE.Euler(); this.eyeYaw = 0; this.eyePitch = 0;
    this._ensure(0);
  }
  _ensure(t) {
    while (this.bt < t + 5) { this.bt += this.rngB.range(2.0, 5.2) * (this.rngB.chance(0.18) ? 0.35 : 1); this.blinks.push(this.bt); if (this.rngB.chance(0.15)) { this.bt += 0.3; this.blinks.push(this.bt); } }
    while (this.st < t + 5) { this.st += this.rngS.range(0.35, 1.7); const big = this.rngS.chance(0.2) ? 2.6 : 1; this.sacc.push({ t: this.st, y: this.rngS.range(-0.05, 0.05) * big, p: this.rngS.range(-0.03, 0.025) * big }); }
  }
  blinkAt(t) {
    this._ensure(t);
    // find last blink start <= t (linear scan from cached index)
    let i = Math.min(this._bi || 0, this.blinks.length - 1); while (i > 0 && this.blinks[i] > t) i--; while (i + 1 < this.blinks.length && this.blinks[i + 1] <= t) i++; this._bi = i;
    const d = t - this.blinks[i]; if (d < 0 || d > 0.2) return 0;
    return d < 0.075 ? smooth(0, 0.075, d) : 1 - smooth(0.075, 0.2, d);
  }
  saccadeAt(t, out) {
    this._ensure(t); const s = this.sacc; let i = Math.min(this._si || 0, s.length - 1); while (i > 0 && s[i].t > t) i--; while (i + 1 < s.length && s[i + 1].t <= t) i++; this._si = i;
    const a = i > 0 ? s[i - 1] : { y: 0, p: 0 }, b = s[i]; const f = smooth(0, 0.07, t - b.t); out.y = mixn(a.y, b.y, f); out.p = mixn(a.p, b.p, f); return out;
  }
  setMouth(p) { for (const k in this.mouth) this.mouth[k] = p && p[k] !== undefined ? p[k] : 0; }
  setExpression(e) { for (const k in this.expr) this.expr[k] = e && e[k] !== undefined ? e[k] : 0; this.blinkOverride = e && e.blink !== undefined ? e.blink : undefined; }
  /** apply: dt, film time t, extra gaze offsets (yaw,pitch radians in head frame) already limited by caller */
  update(dt, t, gaze) {
    const k = 1 - Math.exp(-14 * dt);
    for (const n in this.exprS) this.exprS[n] += (this.expr[n] - this.exprS[n]) * k;
    for (const n in this.mouthS) this.mouthS[n] += (this.mouth[n] - this.mouthS[n]) * (1 - Math.exp(-40 * dt));
    const e = this.exprS, m = this.mouthS; const o = this.o || (this.o = {});
    for (const n of this.names) o[n] = 0;
    const sm = Math.max(0, e.smile + this.baseSmile);
    o.smileL = sm; o.smileR = sm; o.squint = 0.4 * sm; o.browUp = 0.1 * sm;
    o.frown = e.frown; o.browDown = 0.15 * e.frown;
    o.browUp += e.surprise; o.lidWide = e.surprise; o.jaw = 0.5 * e.surprise;
    o.browInnerUp = 0.9 * e.fear; o.browUp += 0.35 * e.fear; o.lidWide += 0.85 * e.fear; o.wide = 0.45 * e.fear; o.jaw += 0.22 * e.fear;
    o.browAngry = e.anger; o.browDown += 0.55 * e.anger; o.squint += 0.35 * e.anger; o.sneer = 0.35 * e.anger; o.press = 0.45 * e.anger; o.frown += 0.3 * e.anger;
    o.browInnerUp += 0.95 * e.sad; o.frown += 0.75 * e.sad; o.squint += 0.1 * e.sad; o.round = 0.15 * e.sad;
    // lipsync
    const amp = this.mouthAmp;
    o.jaw += m.jaw * 0.92 * amp; o.wide += m.wide * 0.9; o.round += m.round * 0.95; o.press += m.press; o.tuck = m.tuck;
    o.sneer += m.teeth * 0.0;
    // blink
    let b = this.blinkOverride !== undefined ? this.blinkOverride : this.blinkAt(t);
    b = Math.min(1, b * (1 - 0.8 * Math.min(1, e.surprise + e.fear * 0.8)) + 0.12 * e.sad);
    // lids follow vertical gaze
    const gp = gaze ? gaze.p : 0; const lidDrop = Math.max(0, gp) * 0.9; // gaze down (positive pitch in our eye convention) drops lids
    const bl = Math.min(1, b + lidDrop * 0.45);
    o.blinkL = bl; o.blinkR = bl;
    const inf = this.inf;
    for (let i = 0; i < this.names.length; i++) { const v = o[this.names[i]]; inf[i] = v < 0 ? 0 : v > 1.25 ? 1.25 : v; }
    // jaw bone (teeth/tongue) follows the jaw morph
    const jw = Math.min(1.1, o.jaw);
    this.bones.jaw.rotation.set(this.maxJaw * jw, 0, 0);
    if (this.mouthMesh && this.mouthMesh.morphTargetInfluences) this.mouthMesh.morphTargetInfluences[0] = m.tongue;
    // eyes
    const sc = this.saccadeAt(t, this._sc || (this._sc = { y: 0, p: 0 }));
    const yaw = (gaze ? gaze.y : 0) + sc.y * (1 - this.gazeW * 0.6), pitch = (gaze ? gaze.p : 0) + sc.p * (1 - this.gazeW * 0.6);
    this.bones.eyeL.rotation.set(pitch, yaw + 0.01, 0); this.bones.eyeR.rotation.set(pitch, yaw - 0.01, 0);
    this.eyeYaw = yaw; this.eyePitch = pitch;
  }
}
