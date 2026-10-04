// Prop emitters for the city module: street furniture, trees, low-poly cars, roof & facade details.
// Every function writes into a Builder (see builder.js) in the *current local frame*. +Z = front.
import * as THREE from 'three';
import { RNG } from '../../engine/common.js';
import { rgb, mul, mix, jitter } from './builder.js';
import { signRect } from './surfaces.js';

const PI = Math.PI;
export const PALETTE = {
  carBody: [0xe8e8e8, 0xc8cacc, 0x2a2c30, 0x8a8e94, 0xb02a2a, 0x2a4a8a, 0x3a5a3a, 0xd8d0b8, 0x6a2a2a, 0x1a1a1e, 0xf2f2f2, 0x5a6a7a],
  pastel: [0xf4c7d0, 0xbfe3d4, 0xf7e0a3, 0x9ed3e6, 0xf2b38e, 0xcdb8e6, 0xe9e4d8, 0x7fc4b8, 0xe8d27a, 0xd98c7a, 0xf4f1ea, 0xa8d8a0, 0xe8a0b8],
};

/** loft a box-ish shape along Z. stations: [z, yBottom, yTop, halfWidth] ascending z. o:{side, top, glassSides:[i0,i1] indices of segments whose sides are glass, glass, bucket} */
export function loftBox(B, name, st, o = {}) {
  const sc = rgb(o.side ?? 0xcccccc), tc = rgb(o.top ?? o.side ?? 0xcccccc), gc = rgb(o.glass ?? 0x101820);
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1]; const g = o.glassSides && i >= o.glassSides[0] && i <= o.glassSides[1]; const side = g ? gc : sc; const top = (o.glassTop && i >= o.glassTop[0] && i <= o.glassTop[1]) ? gc : tc;
    B.quad(name, [a[3], a[2], a[0]], [-a[3], a[2], a[0]], [-b[3], b[2], b[0]], [b[3], b[2], b[0]], [0, 0, 1, 1], top);
    B.quad(name, [b[3], b[1], b[0]], [a[3], a[1], a[0]], [a[3], a[2], a[0]], [b[3], b[2], b[0]], [0, 0, 1, 1], side);
    B.quad(name, [-a[3], a[1], a[0]], [-b[3], b[1], b[0]], [-b[3], b[2], b[0]], [-a[3], a[2], a[0]], [0, 0, 1, 1], side);
    if (o.bottom) B.quad(name, [-a[3], a[1], a[0]], [a[3], a[1], a[0]], [b[3], b[1], b[0]], [-b[3], b[1], b[0]], [0, 0, 1, 1], 0x111111);
  }
  const f = st[st.length - 1], r = st[0];
  B.quad(name, [-f[3], f[1], f[0]], [f[3], f[1], f[0]], [f[3], f[2], f[0]], [-f[3], f[2], f[0]], [0, 0, 1, 1], o.front ?? sc);
  B.quad(name, [r[3], r[1], r[0]], [-r[3], r[1], r[0]], [-r[3], r[2], r[0]], [r[3], r[2], r[0]], [0, 0, 1, 1], o.rear ?? sc);
}
const wheel = (B, x, y, z, r = 0.33, w = 0.22, col = 0x151515) => { B.push(x, y, z, 0, 1, 1, 1, 0, PI / 2); B.cyl('car', 0, -w / 2, 0, r, r, w, 10, { col, capBottom: true, colTop: 0x2a2a2a }); B.cyl('car', 0, w / 2 - 0.02, 0, r * 0.55, r * 0.55, 0.04, 8, { col: 0x9a9a9a, cap: true }); B.pop(); };

/** low-poly car at (x,z) yaw; shape: sedan|hatch|suv|van|pickup|taxi|jeepney|tricycle|bus|truck|police. returns nothing. col = body colour. o.wreck: 0..1 burnt-out look, o.lights: glow on */
export function car(B, shape, x, z, yaw, col, o = {}) {
  const wreck = o.wreck || 0; const base = wreck > 0.4 ? 0x1c1612 : col; const body = wreck > 0 ? mix(col, 0x2a1c14, wreck) : col; const glass = wreck > 0.4 ? 0x0a0a0a : 0x0f1822;
  B.push(x, 0, z, yaw);
  const W = 1.8;
  if (shape === 'jeepney') {
    const L = 6.2, hw = 1.0; const c2 = o.col2 ?? 0xf2c230, c3 = o.col3 ?? 0xd8d8d0;
    wheel(B, hw - 0.1, 0.4, 1.9, 0.42, 0.28); wheel(B, -hw + 0.1, 0.4, 1.9, 0.42, 0.28); wheel(B, hw - 0.1, 0.4, -1.7, 0.42, 0.28); wheel(B, -hw + 0.1, 0.4, -1.7, 0.42, 0.28);
    loftBox(B, 'car', [[-L / 2, 0.45, 1.2, hw], [-0.9, 0.45, 1.25, hw], [0.4, 0.45, 1.25, hw], [L * 0.2, 0.45, 1.05, hw * 0.95]], { side: body, top: body, front: body }); // lower body
    // cabin box (open sides = dark with window band), roof
    loftBox(B, 'car', [[-L / 2, 1.2, 2.25, hw * 0.96], [0.0, 1.2, 2.3, hw * 0.96], [0.95, 1.2, 2.2, hw * 0.9]], { side: glass, top: c3, front: glass, rear: glass, glassSides: [0, 1] });
    loftBox(B, 'car', [[-L / 2 - 0.02, 2.25, 2.36, hw], [0.95, 2.2, 2.31, hw]], { side: c3, top: c3 }); // roof slab
    // hood
    loftBox(B, 'car', [[0.95, 0.5, 1.12, hw * 0.92], [L / 2, 0.5, 1.05, hw * 0.88]], { side: body, top: body, front: 0xc0c4c8 });
    // stripes (belt) + sign board over windshield
    B.box('car', 0, 1.18, 0, 2.06, 0.1, L * 0.7, { col: c2, top: false, sides: true });
    B.box('car', 0, 2.45, 1.0, 1.7, 0.28, 0.06, { col: mix(c2, 0xffffff, 0.2) });
    // roof rack + luggage
    B.box('car', 0, 2.5, -1.6, 1.7, 0.06, 1.4, { col: 0x303030 }); if (o.luggage !== false) B.box('car', 0.1, 2.68, -1.6, 1.0, 0.3, 0.8, { col: 0x6a5a3a });
    // chrome grille & bumper, headlights
    B.box('car', 0, 0.68, L / 2 + 0.02, 1.4, 0.45, 0.06, { col: 0xcfd2d6 }); B.box('car', 0, 0.35, L / 2 + 0.05, 1.9, 0.14, 0.12, { col: 0xd0d0d0 }); B.box('car', -hw + 0.35, 0.82, L / 2 + 0.02, 0.28, 0.2, 0.05, { col: 0xfff2c0 }); B.box('car', hw - 0.35, 0.82, L / 2 + 0.02, 0.28, 0.2, 0.05, { col: 0xfff2c0 });
    B.box('car', 0, 0.78, -L / 2 - 0.02, 1.9, 0.18, 0.05, { col: 0xa02020 }); B.box('car', 0, 0.38, -L / 2 - 0.05, 1.95, 0.14, 0.1, { col: 0xc8c8c8 });
    // hood ornament (horse-ish)
    B.cyl('car', 0, 1.1, L / 2 - 0.4, 0.04, 0.04, 0.22, 5, { col: 0xd8d8d8 }); B.box('car', 0, 1.36, L / 2 - 0.4, 0.05, 0.14, 0.22, { col: 0xd8d8d8 });
    // interior bench seats
    B.box('car', hw * 0.65, 0.95, -0.3, 0.3, 0.32, 3.8, { col: 0x3a2a20 }); B.box('car', -hw * 0.65, 0.95, -0.3, 0.3, 0.32, 3.8, { col: 0x3a2a20 });
  } else if (shape === 'tricycle') {
    wheel(B, 0.1, 0.32, 0.9, 0.3, 0.12); wheel(B, 0.1, 0.32, -0.6, 0.3, 0.12); wheel(B, -1.0, 0.28, -0.1, 0.26, 0.1);
    B.box('car', 0.1, 0.65, 0.1, 0.4, 0.4, 1.5, { col: body }); B.box('car', 0.1, 0.95, 0.5, 0.45, 0.25, 0.5, { col: 0x222222 }); B.box('car', 0.1, 1.12, 0.78, 0.7, 0.04, 0.05, { col: 0x888888 });
    // sidecar cab with canopy
    loftBox(B, 'car', [[-0.95, 0.3, 1.25, 0.45], [0.8, 0.3, 1.25, 0.42]], { side: o.col2 ?? 0x2a7ac8, top: o.col2 ?? 0x2a7ac8 }); B.box('car', -1.0, 1.4, -0.05, 1.0, 0.07, 1.9, { col: 0xe8e8e0 });
    for (const sx of [-0.52, -1.48]) for (const sz of [-0.95, 0.85]) B.box('car', sx, 0.85, sz, 0.04, 1.1, 0.04, { col: 0xdddddd });
  } else if (shape === 'bus' || shape === 'truck') {
    const L = shape === 'bus' ? 10.5 : 7.5, hw = 1.3, H = shape === 'bus' ? 3.1 : 2.6; const c3 = shape === 'bus' ? 0xf0f0ee : 0xd8d8d4;
    wheel(B, hw - 0.1, 0.5, L * 0.32, 0.5, 0.3); wheel(B, -hw + 0.1, 0.5, L * 0.32, 0.5, 0.3); wheel(B, hw - 0.1, 0.5, -L * 0.3, 0.5, 0.3); wheel(B, -hw + 0.1, 0.5, -L * 0.3, 0.5, 0.3);
    if (shape === 'bus') { loftBox(B, 'car', [[-L / 2, 0.35, H, hw], [L / 2, 0.35, H, hw]], { side: body, top: c3, front: glass, rear: body, glassSides: [] }); B.box('car', 0, 2.25, 0, hw * 2 + 0.03, 0.9, L - 0.8, { col: glass, top: false }); B.box('car', 0, 1.75, 0, hw * 2 + 0.03, 0.12, L - 0.8, { col: mix(body, 0xffffff, 0.3), top: false }); B.box('car', 0, 1.3, L / 2 + 0.02, 2.4, 1.4, 0.05, { col: glass }); }
    else { loftBox(B, 'car', [[-L / 2, 0.55, 1.1, hw], [L * 0.1, 0.55, 1.1, hw]], { side: 0x555a5e, top: 0x6a6e72 }); B.box('car', 0, 1.9, -L * 0.2, hw * 2 - 0.1, 1.5, L * 0.55, { col: body, top: true }); loftBox(B, 'car', [[L * 0.12, 0.55, 2.4, hw], [L * 0.5, 0.55, 1.6, hw * 0.96]], { side: body, top: body, front: 0xb0b4b8, glassSides: [0, 0], glass }); }
  } else {
    // generic passenger car family by params
    const P = { sedan: { L: 4.6, hh: 0.83, ch: 1.43, cs: -0.23, ce: 0.12, hw: 0.9, wb: 1.45 }, hatch: { L: 3.9, hh: 0.82, ch: 1.45, cs: -0.4, ce: 0.12, hw: 0.86, wb: 1.2 }, suv: { L: 4.7, hh: 1.0, ch: 1.72, cs: -0.4, ce: 0.1, hw: 0.95, wb: 1.5 }, van: { L: 5.2, hh: 1.15, ch: 2.0, cs: -0.45, ce: 0.22, hw: 0.98, wb: 1.7 }, pickup: { L: 5.4, hh: 0.95, ch: 1.7, cs: 0.0, ce: 0.2, hw: 0.97, wb: 1.7 }, taxi: { L: 4.6, hh: 0.83, ch: 1.43, cs: -0.23, ce: 0.12, hw: 0.9, wb: 1.45 }, police: { L: 4.7, hh: 0.84, ch: 1.45, cs: -0.23, ce: 0.12, hw: 0.92, wb: 1.5 } }[shape] || { L: 4.6, hh: 0.83, ch: 1.43, cs: -0.23, ce: 0.12, hw: 0.9, wb: 1.45 };
    const { L, hh, ch, hw } = P; const hl = L / 2; const cs = P.cs * L, ce = P.ce * L; const wr = 0.34 + (shape === 'suv' || shape === 'pickup' ? 0.06 : 0);
    const bodyCol = shape === 'taxi' ? (wreck > 0 ? mix(0xf2c230, 0x2a1c14, wreck) : 0xf2c230) : shape === 'police' ? (wreck > 0 ? mix(0x20242c, 0x1a1410, wreck) : 0x20242c) : body;
    wheel(B, hw - 0.08, wr, P.wb, wr); wheel(B, -hw + 0.08, wr, P.wb, wr); wheel(B, hw - 0.08, wr, -P.wb, wr); wheel(B, -hw + 0.08, wr, -P.wb, wr);
    // main body (hood + trunk + belt)
    const stn = shape === 'pickup' ? [[-hl, wr - 0.04, hh - 0.1, hw * 0.94], [-hl * 0.95, wr - 0.04, hh + 0.04, hw], [cs + 0.4, wr - 0.04, hh + 0.04, hw], [ce, wr - 0.04, hh + 0.08, hw], [hl * 0.7, wr - 0.04, hh + 0.03, hw * 0.98], [hl, wr - 0.04, hh - 0.18, hw * 0.92]] :
      [[-hl, wr - 0.04, hh - 0.08, hw * 0.94], [-hl * 0.88, wr - 0.04, hh + 0.02, hw], [cs, wr - 0.04, hh + 0.04, hw], [ce, wr - 0.04, hh + 0.04, hw], [hl * 0.62, wr - 0.04, hh - 0.02, hw * 0.98], [hl, wr - 0.04, hh - 0.2, hw * 0.92]];
    loftBox(B, 'car', stn, { side: bodyCol, top: bodyCol, front: bodyCol, rear: bodyCol, bottom: true });
    // cabin (greenhouse)
    if (shape === 'pickup') loftBox(B, 'car', [[0.0, hh + 0.02, hh + 0.05, hw * 0.94], [0.05, hh + 0.02, ch, hw * 0.86], [0.55, hh + 0.02, ch, hw * 0.86], [ce + 0.1, hh + 0.02, hh + 0.05, hw * 0.94]], { side: glass, top: bodyCol, glassSides: [0, 2], glass, glassTop: [0, 0] });
    else loftBox(B, 'car', [[cs - 0.1, hh + 0.02, hh + 0.05, hw * 0.96], [cs + 0.25 * L * 0.5, hh + 0.02, ch, hw * 0.86], [ce - 0.35 * L * 0.2, hh + 0.02, ch, hw * 0.86], [ce + 0.05, hh + 0.02, hh + 0.05, hw * 0.96]], { side: glass, top: bodyCol, glassSides: [0, 2], glass, glassTop: [0, 0] });
    if (shape === 'pickup') B.box('car', 0, hh + 0.1, -hl * 0.55, hw * 1.86, 0.06, hl * 0.7, { col: 0x222222 });
    if (shape === 'taxi') { B.box('car', 0, ch + 0.1, (cs + ce) / 2, 0.55, 0.16, 0.22, { col: 0xfff0b0 }); B.box('car', 0, hh + 0.25, 0.0, hw * 2 + 0.02, 0.08, 1.6, { col: 0x151515, top: false }); }
    if (shape === 'police') { B.box('car', 0.25, ch + 0.07, (cs + ce) / 2, 0.3, 0.1, 0.25, { col: 0xd02020 }); B.box('car', -0.25, ch + 0.07, (cs + ce) / 2, 0.3, 0.1, 0.25, { col: 0x2040e0 }); B.box('car', 0, hh - 0.18, 0, hw * 2 + 0.02, 0.2, L * 0.7, { col: 0xf0f0f0, top: false }); }
    // lights, grille, plates
    const lg = o.lights ? 0xfff4c8 : 0xe8e8e0;
    B.box('car', hw * 0.62, hh - 0.2, hl + 0.01, 0.4, 0.14, 0.05, { col: lg }); B.box('car', -hw * 0.62, hh - 0.2, hl + 0.01, 0.4, 0.14, 0.05, { col: lg }); B.box('car', 0, hh - 0.34, hl + 0.01, 0.8, 0.16, 0.05, { col: 0x16181a });
    B.box('car', hw * 0.66, hh - 0.08, -hl - 0.01, 0.38, 0.14, 0.05, { col: 0xa01818 }); B.box('car', -hw * 0.66, hh - 0.08, -hl - 0.01, 0.38, 0.14, 0.05, { col: 0xa01818 });
    B.box('car', 0, 0.3, hl + 0.03, hw * 2 - 0.1, 0.16, 0.1, { col: 0x222428 }); B.box('car', 0, 0.3, -hl - 0.03, hw * 2 - 0.1, 0.16, 0.1, { col: 0x222428 });
  }
  B.pop();
}

// ---------- street furniture ----------
export function lampPost(B, x, z, yaw, o = {}) {
  const h = o.h ?? 7.5, arm = o.arm ?? 1.6, col = o.col ?? 0x4a4e52;
  B.push(x, o.y ?? 0, z, yaw);
  if (o.style === 'ornate') { B.cyl('metal', 0, 0, 0, 0.17, 0.12, 0.5, 8, { col: 0x1a1c1e }); B.cyl('metal', 0, 0.5, 0, 0.09, 0.06, h - 0.9, 8, { col: 0x1a2a22 }); B.sphere('glow', 0, h, 0, 0.26, 0.3, 0.26, 8, 5, { col: o.glow ?? 0xfff0c0 }); B.cyl('metal', 0, h + 0.28, 0, 0.3, 0.0, 0.25, 8, { col: 0x1a1c1e }); }
  else {
    B.cyl('metal', 0, 0, 0, 0.14, 0.09, h, 8, { col });
    B.box('metal', 0, h - 0.05, arm / 2, 0.08, 0.08, arm, { col });
    B.box('metal', 0, h - 0.12, arm, 0.34, 0.1, 0.8, { col: 0x303438 }); B.box('glow', 0, h - 0.18, arm, 0.28, 0.02, 0.7, { col: o.glow ?? 0xfff0c8, top: false });
  }
  B.pop();
}
export function utilityPole(B, x, z, yaw, o = {}) {
  const h = o.h ?? 9, concrete = o.concrete !== false; B.push(x, 0, z, yaw);
  B.cyl('concrete', 0, 0, 0, 0.17, 0.11, h, 8, { col: concrete ? 0xa8a49c : 0x5a4a38 });
  const arms = o.arms ?? 2; for (let i = 0; i < arms; i++) { const y = h - 0.4 - i * 0.7; B.box('metal', 0, y, 0, 2.0, 0.09, 0.09, { col: 0x3a3228 }); for (const sx of [-0.85, 0, 0.85]) B.cyl('plain', sx, y + 0.05, 0, 0.04, 0.04, 0.14, 5, { col: 0xdedede }); }
  if (o.transformer) { B.cyl('metal', 0.5, h - 2.4, 0.22, 0.28, 0.28, 0.7, 8, { col: 0x6a7078 }); B.cyl('metal', -0.1, h - 2.3, 0.22, 0.22, 0.22, 0.55, 8, { col: 0x6a7078 }); }
  // clutter: boxes, tag lines
  if (o.clutter) { B.box('plain', 0.2, 3.2, 0.16, 0.3, 0.45, 0.15, { col: 0x3a3a3a }); B.box('plain', -0.1, 4.6, 0.14, 0.4, 0.3, 0.12, { col: 0x555555 }); }
  B.pop();
}
export function trafficLight(B, x, z, yaw, o = {}) {
  B.push(x, 0, z, yaw); B.cyl('metal', 0, 0, 0, 0.1, 0.08, 5.2, 8, { col: 0x3c4044 }); B.box('metal', 0, 5.1, 1.5, 0.1, 0.1, 3.0, { col: 0x3c4044 });
  for (const zz of [1.0, 2.6]) { B.box('metal', 0, 4.85, zz, 0.36, 1.0, 0.3, { col: 0x16181a }); const lit = o.state ?? 2; [0, 1, 2].forEach((k) => B.box('glow', 0, 5.15 - k * 0.3, zz + 0.16, 0.2, 0.2, 0.02, { col: k === lit ? [0xff2010, 0xffb010, 0x20ff60][k] : [0x300800, 0x302000, 0x003010][k] })); }
  B.pop();
}
export function bench(B, x, z, yaw, o = {}) {
  B.push(x, 0, z, yaw); const wood = o.wood ?? 0x6a4a2c, metal = 0x2a2d30;
  for (let i = 0; i < 4; i++) B.box('plain', 0, 0.45, -0.18 + i * 0.12, 1.6, 0.04, 0.1, { col: wood }); for (let i = 0; i < 3; i++) B.box('plain', 0, 0.62 + i * 0.12, -0.28, 1.6, 0.08, 0.03, { col: wood });
  for (const sx of [-0.7, 0.7]) { B.box('metal', sx, 0.22, 0, 0.06, 0.44, 0.5, { col: metal }); B.box('metal', sx, 0.55, -0.27, 0.06, 0.55, 0.05, { col: metal }); }
  B.pop();
}
export function concreteBench(B, x, z, yaw) { B.push(x, 0, z, yaw); B.box('concrete', 0, 0.22, 0, 1.8, 0.44, 0.45, { col: 0xb8b4aa }); B.box('concrete', 0, 0.48, -0.15, 1.8, 0.08, 0.2, { col: 0xc4c0b6 }); B.pop(); }
export function bollard(B, x, z, col = 0x3a3d40) { B.cyl('metal', x, 0, z, 0.08, 0.08, 0.8, 6, { col }); B.sphere('metal', x, 0.8, z, 0.08, 0.06, 0.08, 6, 3, { col, t1: Math.PI / 2 }); }
export function hydrant(B, x, z, col = 0xc82a1a) { B.cyl('painted', x, 0, z, 0.1, 0.09, 0.55, 8, { col }); B.sphere('painted', x, 0.58, z, 0.1, 0.07, 0.1, 8, 4, { col }); B.box('painted', x, 0.38, z, 0.3, 0.08, 0.08, { col }); }
export function trashBin(B, x, z, yaw, col = 0x2c5a3a) { B.push(x, 0, z, yaw); B.cyl('plain', 0, 0, 0, 0.26, 0.22, 0.85, 8, { col }); B.cyl('plain', 0, 0.85, 0, 0.27, 0.27, 0.06, 8, { col: 0x222222 }); B.pop(); }
export function signPost(B, x, z, yaw, kind = 'blue', o = {}) {
  B.push(x, 0, z, yaw); B.cyl('metal', 0, 0, 0, 0.04, 0.04, 2.9, 6, { col: 0x6a6e72 });
  const c = { blue: 0x1a4aa8, red: 0xc02020, yellow: 0xf2c230, green: 0x1a7a4a, white: 0xe8e8e8 }[kind] || 0x1a4aa8;
  if (kind === 'stop') { B.cyl('painted', 0, 2.55, 0.05, 0.3, 0.3, 0.03, 8, { col: 0xc01818, rot: PI / 8 }); } else { B.box('painted', 0, 2.65, 0.05, 0.6, 0.4, 0.03, { col: c }); B.box('painted', 0, 2.65, 0.07, 0.5, 0.3, 0.01, { col: 0xf2f2f2 }); B.box('painted', 0, 2.65, 0.08, 0.3, 0.06, 0.01, { col: c }); }
  B.pop();
}
export function busShelter(B, x, z, yaw, o = {}) {
  B.push(x, 0, z, yaw); B.box('metal', 0, 2.5, 0, 3.2, 0.08, 1.4, { col: 0x3a3e44 }); for (const sx of [-1.5, 1.5]) B.box('metal', sx, 1.25, -0.6, 0.06, 2.5, 0.06, { col: 0x3a3e44 });
  B.box('glass', 0, 1.3, -0.65, 3.0, 2.2, 0.03, { col: 0x6a8aa0 }); B.box('plain', 0, 0.5, -0.45, 2.4, 0.05, 0.4, { col: 0x555a60 }); B.box('glow', 1.2, 1.4, -0.58, 0.8, 1.4, 0.03, { col: o.ad ?? 0x60a0ff, top: false }); B.pop();
}
export function barricade(B, x, z, yaw, kind = 'jersey', o = {}) {
  B.push(x, 0, z, yaw);
  if (kind === 'jersey') { const L = o.len ?? 3; B.prism('concrete', [[-L / 2, -0.3], [L / 2, -0.3], [L / 2, 0.3], [-L / 2, 0.3]], 0, 0.05, { col: 0xb0aca4 }); loftBox(B, 'concrete', [[-0.3, 0, 0.25, L / 2], [-0.18, 0.25, 0.7, L / 2], [0.0, 0.7, 1.0, L / 2], [0.18, 0.25, 0.7, L / 2], [0.3, 0, 0.25, L / 2]].map((s) => [s[0], s[1], s[2], s[3]]).sort((a, b) => a[0] - b[0]), { side: 0xb4b0a8, top: 0xb8b4ac }); }
  else if (kind === 'hbar') { const L = o.len ?? 2.4; for (const sx of [-L / 2 + 0.1, L / 2 - 0.1]) B.box('plain', sx, 0.45, 0, 0.1, 0.9, 0.7, { col: 0xe8e8e8 }); for (let i = 0; i < 3; i++) B.box('plain', 0, 0.55 + i * 0.22, 0, L, 0.12, 0.06, { col: i % 2 ? 0xe8e8e8 : 0xe85a1a }); }
  else if (kind === 'hedgehog') { for (let k = 0; k < 3; k++) { B.push(0, 0.55, 0, 0, 1, 1, 1, k * 1.05, k * 0.7); B.box('metal', 0, 0, 0, 0.1, 1.5, 0.1, { col: 0x4a4e48 }); B.pop(); B.push(0, 0.55, 0, k * 1.0, 1, 1, 1, 0, PI / 2 + k * 0.5); B.box('metal', 0, 0, 0, 0.1, 1.5, 0.1, { col: 0x4a4e48 }); B.pop(); } }
  else if (kind === 'wire') { for (let i = 0; i < 6; i++) { B.cyl('metal', -1.2 + i * 0.5, 0, 0, 0.02, 0.02, 1.1, 4, { col: 0x3a3a3a }); } B.cyl('plain', 0, 0.3, 0, 0.0001, 0.0001, 0.0001, 3, {}); for (let i = 0; i < 3; i++) B.box('metal', 0, 0.25 + i * 0.35, 0, 2.6, 0.03, 0.03, { col: 0x2a2a2a }); }
  B.pop();
}
export function sandbags(B, x, z, yaw, len = 4, rows = 3, rng = new RNG(5)) {
  B.push(x, 0, z, yaw);
  for (let r = 0; r < rows; r++) { const n = Math.round(len / 0.55) - (r % 2 ? 1 : 0); for (let i = 0; i < n; i++) { const cx = -len / 2 + 0.28 + (i + (r % 2 ? 0.5 : 0)) * 0.55; B.push(cx, 0.1 + r * 0.19, rng.range(-0.04, 0.04), rng.range(-0.1, 0.1)); B.sphere('plain', 0, 0, 0, 0.32, 0.12, 0.2, 6, 3, { col: mix(0xa89a72, 0x7a6e50, rng.next()) }); B.pop(); } }
  B.pop();
}
export function tent(B, x, z, yaw, o = {}) {
  const w = o.w ?? 4, d = o.d ?? 6, h = o.h ?? 2.4, col = o.col ?? 0x6a7048; B.push(x, 0, z, yaw);
  loftBox(B, 'plain', [[-d / 2, 0, 1.8, w / 2], [d / 2, 0, 1.8, w / 2]], { side: col, top: col, front: mix(col, 0x000000, 0.5), rear: mix(col, 0x000000, 0.5) });
  // pitched roof
  B.quad('plain', [-w / 2 - 0.1, 1.8, d / 2 + 0.1], [0, h, d / 2 + 0.1], [0, h, -d / 2 - 0.1], [-w / 2 - 0.1, 1.8, -d / 2 - 0.1], [0, 0, 1, 1], mul(col, 1.1));
  B.quad('plain', [0, h, d / 2 + 0.1], [w / 2 + 0.1, 1.8, d / 2 + 0.1], [w / 2 + 0.1, 1.8, -d / 2 - 0.1], [0, h, -d / 2 - 0.1], [0, 0, 1, 1], mul(col, 1.1));
  B.tri('plain', [-w / 2 - 0.1, 1.8, d / 2 + 0.1], [w / 2 + 0.1, 1.8, d / 2 + 0.1], [0, h, d / 2 + 0.1], mul(col, 0.9)); B.tri('plain', [w / 2 + 0.1, 1.8, -d / 2 - 0.1], [-w / 2 - 0.1, 1.8, -d / 2 - 0.1], [0, h, -d / 2 - 0.1], mul(col, 0.9));
  B.box('plain', 0, 1.0, d / 2 + 0.02, 1.3, 1.6, 0.04, { col: 0x101410 });
  B.pop();
}
export function checkpoint(B, x, z, yaw, rng = new RNG(3)) {
  B.push(x, 0, z, yaw);
  B.box('plain', -3.3, 1.3, 0, 2.2, 2.6, 2.2, { col: 0x8a8a7a }); B.box('plain', -3.3, 2.65, 0, 2.6, 0.12, 2.6, { col: 0x555a50 }); B.box('glass', -2.18, 1.5, 0, 0.04, 0.9, 1.6, { col: 0x24323c });
  B.box('plain', 0, 0.6, 0, 0.18, 1.2, 0.18, { col: 0x3a3a3a }); // pivot post
  for (let i = 0; i < 8; i++) B.box('painted', 0.0 + 0.5 + i * 0.5, 1.2, 0.0, 0.5, 0.1, 0.1, { col: i % 2 ? 0xe8e8e8 : 0xd02a1a });
  barricade(B, 2.5, 3.2, 0.2, 'jersey', { len: 3 }); barricade(B, -1.5, -3.2, -0.15, 'jersey', { len: 3 }); sandbags(B, -5.5, 1.8, 0.4, 3, 3, rng);
  signPost(B, 1.6, 2.0, 0.5, 'stop'); B.pop();
}
export function kiosk(B, x, z, yaw, o = {}) { // sari-sari stand / street stall
  const col = o.col ?? 0x3aa0c8; B.push(x, 0, z, yaw); const sr = signRect('fascia', o.sign ?? 0);
  B.box('plain', 0, 0.55, 0, 1.8, 1.1, 1.2, { col }); B.box('plain', 0, 1.28, 0.08, 1.9, 0.04, 1.3, { col: 0x303030 });
  B.quad('r_gi', [-1.0, 2.3, -0.65], [1.0, 2.3, -0.65], [1.0, 2.0, 0.85], [-1.0, 2.0, 0.85], [0, 0, 1.2, 1.2], 0xc0c4c4);
  for (const sx of [-0.9, 0.9]) B.box('plain', sx, 1.2, 0.8, 0.06, 2.0, 0.06, { col: 0x555 });
  B.quad('signs', [-0.9, 1.85, 0.87], [0.9, 1.85, 0.87], [0.9, 2.2, 0.87], [-0.9, 2.2, 0.87], sr.rect, 0xffffff);
  B.box('plain', 0, 1.0, 0.58, 1.7, 0.05, 0.1, { col: 0xd8d8d8 }); for (let i = 0; i < 8; i++) B.box('plain', -0.7 + i * 0.2, 1.15, 0.5, 0.12, 0.2, 0.08, { col: [0xe03a3a, 0xf2c230, 0x2f6fd2, 0x3aa86f][i % 4] });
  B.pop();
}
export function umbrellaStall(B, x, z, col = 0xe84a4a, rng = new RNG(1)) {
  B.push(x, 0, z, rng.range(0, 6)); B.cyl('plain', 0, 0, 0, 0.025, 0.025, 2.1, 5, { col: 0x777777 }); B.cyl('plain', 0, 2.05, 0, 1.3, 0.04, 0.4, 8, { col, flat: true, cap: false }); B.box('plain', 0, 0.45, 0.2, 1.2, 0.06, 0.7, { col: 0xb0a080 }); B.box('plain', 0, 0.2, 0.2, 1.0, 0.4, 0.5, { col: 0x8a7a5a });
  for (let i = 0; i < 6; i++) B.sphere('plain', -0.45 + i * 0.18, 0.62, 0.2, 0.07, 0.07, 0.07, 5, 3, { col: rng.pick([0xe03a3a, 0xf2c230, 0x3aa86f, 0xff8a2a]) });
  B.pop();
}
export function steamVent(B, x, z) { B.cyl('painted', x, 0, z, 0.35, 0.18, 0.9, 10, { col: 0xe8620a, cap: false }); B.cyl('painted', x, 0.3, z, 0.31, 0.2, 0.18, 10, { col: 0xf4f4f0, cap: false }); B.cyl('painted', x, 0.58, z, 0.26, 0.2, 0.15, 10, { col: 0xf4f4f0, cap: false }); }
export function manhole(B, x, z, r = 0.45) { B.disc('plain', x, 0.012, z, r, 12, 0x25262a, true); B.disc('plain', x, 0.016, z, r * 0.8, 12, 0x303134, true); }
export function bunting(B, a, b, n = 18, sag = 1.0, rng = new RNG(8)) {
  // string of triangular fiesta flags between two points
  B.wire(a, b, sag, 12, 0x333333);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; const dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz) || 1; const ux = dx / l, uz = dz / l; const w = 0.17;
    const c = rng.pick([0xe03a3a, 0xf2c230, 0x2f6fd2, 0x3aa86f, 0xffffff, 0xe86aa0, 0xff8a2a]);
    B.tri('plain', [p[0] - ux * w, p[1], p[2] - uz * w], [p[0] + ux * w, p[1], p[2] + uz * w], [p[0], p[1] - 0.42, p[2]], c); B.tri('plain', [p[0] + ux * w, p[1], p[2] + uz * w], [p[0] - ux * w, p[1], p[2] - uz * w], [p[0], p[1] - 0.42, p[2]], c); }
}

// ---------- trees ----------
function canopyCluster(B, cx, cy, cz, r, rng, col, thick = 0.6) {
  // an umbrella of alpha cards: one tilted horizontal disc + two vertical crossing quads
  const t = mix(col, 0xffffff, 0.0); const c = jitter(t, rng, 0.1);
  const a = rng.range(0, PI);
  const hx = Math.cos(a), hz = Math.sin(a);
  B.quad('foliage_canopy', [cx - r, cy, cz - r], [cx + r, cy, cz - r], [cx + r, cy + 0.12 * r, cz + r], [cx - r, cy + 0.12 * r, cz + r], [0, 0, 1, 1], mul(c, 1.05), [0, 1, 0]); // top disc (normal up for stable lighting)
  B.quad('foliage_canopy', [cx - r * hx - 0, cy - r * thick * 0.7, cz - r * hz], [cx + r * hx, cy - r * thick * 0.7, cz + r * hz], [cx + r * hx, cy + r * thick, cz + r * hz], [cx - r * hx, cy + r * thick, cz - r * hz], [0, 0, 1, 1], mul(c, 0.85), [0, 1, 0]);
  B.quad('foliage_canopy', [cx + r * hz, cy - r * thick * 0.7, cz - r * hx], [cx - r * hz, cy - r * thick * 0.7, cz + r * hx], [cx - r * hz, cy + r * thick, cz + r * hx], [cx + r * hz, cy + r * thick, cz - r * hx], [0, 0, 1, 1], mul(c, 0.9), [0, 1, 0]);
}
function trunk(B, pts, r0, r1, col, bands = false) {
  const n = pts.length; const radii = pts.map((_, i) => r0 + (r1 - r0) * (i / (n - 1)));
  const cols = bands ? pts.map((_, i) => (i % 2 ? mul(col, 0.7) : col)) : null; B.tube('plain', pts, radii, 6, cols ? { cols } : { col });
}
/** kinds: raintree|palm|coconut|banana|plane|bare|spruce|birch|neem|mango|bush|hedge */
export function tree(B, kind, x, z, scale = 1, seed = 1, o = {}) {
  const rng = new RNG(seed * 7919 + 13); B.push(x, o.y ?? 0, z, rng.range(0, PI * 2), scale);
  const snow = o.snow || 0;
  if (kind === 'raintree' || kind === 'acacia' || kind === 'mango' || kind === 'neem') {
    const H = rng.range(4.0, 5.2), R = (kind === 'raintree' ? rng.range(6.5, 8.5) : rng.range(4.5, 6)) * (kind === 'neem' ? 0.8 : 1); const bark = 0x4a3a2c;
    trunk(B, [[0, 0, 0], [0.1, H * 0.4, 0.05], [0, H * 0.8, -0.05], [0, H, 0]], 0.5, 0.28, bark);
    const nb = 4; for (let i = 0; i < nb; i++) { const a = (i / nb) * PI * 2 + rng.range(0, 1); trunk(B, [[0, H * 0.8, 0], [Math.cos(a) * R * 0.25, H + R * 0.12, Math.sin(a) * R * 0.25], [Math.cos(a) * R * 0.55, H + R * 0.2, Math.sin(a) * R * 0.55]], 0.22, 0.1, bark); }
    const gcol = kind === 'mango' ? 0xc8e0c0 : kind === 'neem' ? 0xe8f0b8 : 0xf0fff0; const tint = snow ? 0xe8f0f8 : gcol;
    const nc = kind === 'raintree' ? 9 : 6; for (let i = 0; i < nc; i++) { const a = (i / nc) * PI * 2 + rng.range(-0.3, 0.3); const d = i === 0 ? 0 : R * rng.range(0.4, 0.62); canopyCluster(B, Math.cos(a) * d, H + R * rng.range(0.12, 0.34), Math.sin(a) * d, R * rng.range(0.42, 0.58), rng, tint); }
    canopyCluster(B, 0, H + R * 0.42, 0, R * 0.5, rng, tint);
  } else if (kind === 'plane' || kind === 'linden') {
    const H = rng.range(7, 10), R = rng.range(3.8, 5);
    trunk(B, [[0, 0, 0], [0.05, H * 0.45, 0], [0, H * 0.75, 0.05]], 0.32, 0.2, 0xb8aa94, true);
    if (o.bare) { for (let i = 0; i < 7; i++) { const a = rng.range(0, PI * 2), el = rng.range(0.7, 1.2); const p1 = [Math.cos(a) * 1.2, H * 0.75 + 1.6, Math.sin(a) * 1.2], p2 = [Math.cos(a) * 2.8, H * 0.75 + 3.2 * el, Math.sin(a) * 2.8]; trunk(B, [[0, H * 0.72, 0], p1, p2], 0.13, 0.03, 0x5a4e44); const p3 = [p2[0] + Math.cos(a + 0.6) * 1.4, p2[1] + 1.2, p2[2] + Math.sin(a + 0.6) * 1.4]; trunk(B, [p2, p3], 0.04, 0.012, 0x5a4e44); } }
    else for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2 + rng.range(-0.3, 0.3); const d = i === 0 ? 0 : R * rng.range(0.25, 0.5); canopyCluster(B, Math.cos(a) * d, H * 0.95 + rng.range(-0.4, 1.8), Math.sin(a) * d, R * rng.range(0.4, 0.55), rng, 0xf4ffe0, 0.8); }
  } else if (kind === 'palm' || kind === 'coconut') {
    const H = rng.range(7, 11) * (kind === 'coconut' ? 1 : 0.8), lean = rng.range(0.4, 1.6), la = rng.range(0, PI * 2); const n = 9; const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([Math.cos(la) * lean * t * t, H * t, Math.sin(la) * lean * t * t]); }
    trunk(B, pts, 0.24, 0.14, 0x8a7a64, true); const top = pts[n]; const nf = 11;
    for (let k = 0; k < nf; k++) { const a = (k / nf) * PI * 2 + rng.range(-0.15, 0.15); const L = rng.range(3.4, 4.4), up = rng.range(0.2, 1.0) ; const seg = 7; const P = [], Sd = []; const dx = Math.cos(a), dz = Math.sin(a);
      for (let i = 0; i <= seg; i++) { const t = i / seg; const out = L * t; const y = top[1] + (up * 2.0) * Math.sin(t * PI * 0.55) - (L * 0.55) * t * t * (0.5 + 0.7 * (1 - up)); P.push([top[0] + dx * out, y, top[2] + dz * out]); const w = 0.62 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)); Sd.push([-dz * w, 0, dx * w]); }
      B.ribbon('foliage_frond', P, Sd, [0.0, 0, 1, 1], jitter(0xf0ffe8, rng, 0.1), null, [0, 0.9, 0.2]); }
    for (let k = 0; k < 4; k++) B.sphere('plain', top[0] + rng.range(-0.2, 0.2), top[1] - 0.3, top[2] + rng.range(-0.2, 0.2), 0.15, 0.2, 0.15, 5, 3, { col: 0x4a6a2a });
  } else if (kind === 'banana') {
    B.cyl('plain', 0, 0, 0, 0.14, 0.1, 2.0, 6, { col: 0x7a8a4a });
    for (let k = 0; k < 7; k++) { const a = (k / 7) * PI * 2 + rng.range(-0.2, 0.2); const dx = Math.cos(a), dz = Math.sin(a); const L = rng.range(2.0, 2.8); const P = [], Sd = []; for (let i = 0; i <= 5; i++) { const t = i / 5; P.push([dx * L * t, 2.0 + 1.0 * Math.sin(t * 1.9) - 0.9 * t * t, dz * L * t]); const w = 0.52 * Math.sin(Math.PI * (0.1 + 0.8 * t)); Sd.push([-dz * w, 0, dx * w]); } B.ribbon('foliage_banana', P, Sd, [0, 0, 1, 1], jitter(0xf0ffe8, rng, 0.1), null, [0, 0.9, 0.2]); }
  } else if (kind === 'spruce') {
    const H = rng.range(7, 11); B.cyl('plain', 0, 0, 0, 0.25, 0.15, 2.0, 6, { col: 0x3a2a20 }); const lv = 5;
    for (let i = 0; i < lv; i++) { const t = i / lv; const r = (1 - t) * 2.0 + 0.5, h = H * 0.3, y = 1.4 + t * H * 0.75; B.cyl('plain', 0, y, 0, r, 0.05, h, 8, { col: mix(0x24402c, 0x2e5238, rng.next()), flat: true }); if (snow) { B.cyl('plain', 0, y + h * 0.35, 0, r * 0.62, 0.04, h * 0.65, 8, { col: 0xf0f4f8, flat: true }); } }
  } else if (kind === 'birch') {
    const H = rng.range(7, 10); const pts = [[0, 0, 0], [0.12, H * 0.3, 0.05], [0, H * 0.6, 0], [-0.1, H, 0.05]]; trunk(B, pts, 0.17, 0.05, 0xe4e0d8, true);
    for (let i = 0; i < 8; i++) { const a = rng.range(0, PI * 2), y0 = H * rng.range(0.4, 0.9); const p1 = [Math.cos(a) * 0.8, y0 + 0.9, Math.sin(a) * 0.8], p2 = [Math.cos(a) * 1.7, y0 + 1.7, Math.sin(a) * 1.7]; trunk(B, [[0, y0, 0], p1, p2], 0.06, 0.015, 0x6a5a4a); if (!o.bare) canopyCluster(B, p2[0], p2[1], p2[2], 1.4, rng, 0xe0f4c0, 0.5); }
  } else if (kind === 'bare') {
    const H = rng.range(6, 9); trunk(B, [[0, 0, 0], [0.05, H * 0.5, 0], [0, H * 0.7, 0]], 0.28, 0.16, 0x4a4036);
    for (let i = 0; i < 8; i++) { const a = rng.range(0, PI * 2), y0 = H * rng.range(0.5, 0.8); const p1 = [Math.cos(a) * 1.0, y0 + 1.2, Math.sin(a) * 1.0], p2 = [Math.cos(a) * 2.4, y0 + 2.8, Math.sin(a) * 2.4]; trunk(B, [[0, y0, 0], p1, p2], 0.1, 0.02, 0x4a4036); const p3 = [p2[0] + Math.cos(a + 0.8) * 1.3, p2[1] + 1.1, p2[2] + Math.sin(a + 0.8) * 1.3]; trunk(B, [p2, p3], 0.03, 0.01, 0x4a4036); }
  } else if (kind === 'hedge' || kind === 'bush') {
    const r = rng.range(0.6, 1.1); for (let i = 0; i < 3; i++) B.sphere('plain', rng.range(-0.5, 0.5), r * 0.6, rng.range(-0.5, 0.5), r, r * 0.8, r, 7, 4, { col: mix(0x2c5a24, 0x4a8a34, rng.next()), colBottom: 0x1c3a18 });
  }
  B.pop();
}

// ---------- building details ----------
export function acBox(B, x, y, z, yaw = 0) { B.push(x, y, z, yaw); B.box('plain', 0, 0, 0, 0.8, 0.5, 0.35, { col: 0xdcdcd6 }); B.box('plain', 0, 0, 0.18, 0.7, 0.4, 0.02, { col: 0x555a5a }); B.pop(); }
export function balcony(B, w, d, h, slabCol, railCol, iron = false, y = 0) {
  // local origin at wall centre, floor level; extends +Z
  B.box('concrete', 0, y - 0.07, d / 2, w, 0.14, d, { col: slabCol, bottom: true });
  if (!iron) { B.box('concrete', 0, y + h / 2, d - 0.05, w, h, 0.1, { col: railCol }); B.box('concrete', -w / 2 + 0.05, y + h / 2, d / 2, 0.1, h, d, { col: railCol }); B.box('concrete', w / 2 - 0.05, y + h / 2, d / 2, 0.1, h, d, { col: railCol }); }
  else { B.box('metal', 0, y + h, d - 0.03, w, 0.04, 0.04, { col: 0x202226 }); B.box('metal', 0, y + 0.1, d - 0.03, w, 0.04, 0.04, { col: 0x202226 }); const n = Math.round(w / 0.14); for (let i = 0; i <= n; i++) B.box('metal', -w / 2 + (i / n) * w, y + h / 2, d - 0.03, 0.02, h, 0.02, { col: 0x202226, top: false }); for (const sx of [-w / 2, w / 2]) { B.box('metal', sx, y + h, d / 2, 0.04, 0.04, d, { col: 0x202226 }); B.box('metal', sx, y + h / 2, d / 2, 0.02, h, 0.02, { col: 0x202226 }); } }
}
export function awning(B, w, d, h, c1, c2, y = 3.0) { // sloped striped awning; origin wall centre, extends +Z, top edge at y
  const n = Math.max(2, Math.round(w / 0.3)); for (let i = 0; i < n; i++) { const x0 = -w / 2 + (i / n) * w, x1 = -w / 2 + ((i + 1) / n) * w; const c = i % 2 ? c1 : c2; B.quad('plain', [x0, y - h, d], [x1, y - h, d], [x1, y, 0], [x0, y, 0], [0, 0, 1, 1], c); B.quad('plain', [x0, y - h - 0.2, d], [x1, y - h - 0.2, d], [x1, y - h, d], [x0, y - h, d], [0, 0, 1, 1], mul(c, 0.9)); }
}
export function waterTank(B, x, y, z, kind = 'blue', rng = new RNG(1)) {
  B.push(x, y, z, rng.range(0, PI));
  if (kind === 'blue') { for (const [sx, sz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) B.box('metal', sx, 0.6, sz, 0.08, 1.2, 0.08, { col: 0x5a6068 }); B.box('metal', 0, 1.2, 0, 1.5, 0.08, 1.5, { col: 0x5a6068 }); B.cyl('plain', 0, 1.24, 0, 0.75, 0.7, 1.35, 12, { col: 0x2a6ac8, cap: true }); B.cyl('plain', 0, 2.59, 0, 0.4, 0.4, 0.06, 8, { col: 0xe8e8e8 }); B.box('plain', 0, 1.9, 0, 1.52, 0.05, 1.52, { col: 0x1a4a98, top: false }); }
  else if (kind === 'black') { B.cyl('plain', 0, 0, 0, 0.62, 0.55, 1.5, 12, { col: 0x1a1a1c, cap: true }); B.cyl('plain', 0, 1.5, 0, 0.25, 0.25, 0.08, 8, { col: 0x303030 }); }
  else if (kind === 'barrel') { for (let i = 0; i < 3; i++) B.cyl('plain', -0.55 + i * 0.55, 0, rng.range(-0.1, 0.1), 0.26, 0.26, 0.85, 8, { col: [0x2a6ac8, 0x2a6ac8, 0xe8e8e8][i], cap: true }); }
  B.pop();
}
export function woodWaterTower(B, x, y, z) { // NYC rooftop tank on stilts
  B.push(x, y, z); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; B.box('metal', Math.cos(a) * 1.7, 1.4, Math.sin(a) * 1.7, 0.12, 2.8, 0.12, { col: 0x4a3a2c }); }
  B.cyl('plain', 0, 0, 0, 1.9, 1.9, 0.12, 14, { col: 0x3a3028, cap: true }); B.cyl('plain', 0, 2.8, 0, 1.95, 1.95, 3.2, 14, { col: 0x6a4a30, cap: false }); for (let k = 0; k < 4; k++) B.cyl('metal', 0, 3.0 + k * 0.85, 0, 1.99, 1.99, 0.06, 14, { col: 0x2a2a2a, cap: false });
  B.cyl('plain', 0, 6.0, 0, 2.15, 0.0, 1.5, 14, { col: 0x4a3626 }); B.pop();
}
export function antenna(B, x, y, z, h = 6, rng = new RNG(2)) {
  B.push(x, y, z, rng.range(0, PI)); B.cyl('metal', 0, 0, 0, 0.03, 0.025, h, 5, { col: 0x777c80 });
  for (let i = 0; i < 4; i++) { const yy = h * (0.55 + i * 0.11); B.box('metal', 0, yy, 0, 0.9 - i * 0.12, 0.02, 0.02, { col: 0x888c90 }); }
  B.pop();
}
export function dish(B, x, y, z, yaw, r = 0.5) { B.push(x, y, z, yaw); B.cyl('metal', 0, 0, 0, 0.03, 0.03, 0.5, 5, { col: 0x666a6e }); B.push(0, 0.55, 0.05, 0, 1, 1, 1, -0.9); B.lathe('metal', 0, 0, 0, [[0, 0], [r * 0.5, 0.04], [r * 0.9, 0.14], [r, 0.22]], 10, { col: 0xe4e4e0 }); B.pop(); B.pop(); }
export function hvac(B, x, y, z, yaw, rng = new RNG(1)) { B.push(x, y, z, yaw); const w = rng.range(1.2, 2.2); B.box('metal', 0, 0.45, 0, w, 0.9, 1.0, { col: 0xb4b8b8 }); B.cyl('metal', -w / 4, 0.9, 0, 0.35, 0.35, 0.06, 10, { col: 0x303436 }); B.cyl('metal', w / 4, 0.9, 0, 0.35, 0.35, 0.06, 10, { col: 0x303436 }); B.pop(); }
export function chimney(B, x, y, z, h = 2.2, col = 0x8a4a36) { B.box('concrete', x, y + h / 2, z, 0.7, h, 0.7, { col }); B.box('concrete', x, y + h + 0.05, z, 0.85, 0.1, 0.85, { col: mix(col, 0x000000, 0.4) }); B.box('plain', x, y + h + 0.11, z, 0.5, 0.02, 0.5, { col: 0x050505 }); }
export function stairBulkhead(B, x, y, z, w, d, h, col) { B.box('concrete', x, y + h / 2, z, w, h, d, { col }); B.box('concrete', x, y + h + 0.06, z, w + 0.3, 0.12, d + 0.3, { col: mul(col, 0.85) }); B.box('plain', x + w / 2 + 0.01, y + 1.0, z, 0.02, 1.9, 0.9, { col: 0x303030 }); }
export function billboardFrame(B, x, y, z, yaw, w = 10, h = 4, adIndex = 0) { // rooftop billboard on legs, double faced
  B.push(x, y, z, yaw); const sr = signRect('billboard', adIndex);
  for (const sx of [-w * 0.38, w * 0.38]) B.box('metal', sx, 1.5, 0, 0.18, 3.0, 0.18, { col: 0x5a5e62 }); B.box('metal', 0, 3.0, 0, w + 0.3, 0.2, 0.3, { col: 0x4a4e52 });
  B.box('metal', 0, 3.0 + h / 2 + 0.1, 0, w + 0.3, h + 0.3, 0.2, { col: 0x3a3e42, top: true });
  B.quad('signs', [-w / 2, 3.1, 0.12], [w / 2, 3.1, 0.12], [w / 2, 3.1 + h, 0.12], [-w / 2, 3.1 + h, 0.12], sr.rect, 0xffffff); B.quad('signs', [w / 2, 3.1, -0.12], [-w / 2, 3.1, -0.12], [-w / 2, 3.1 + h, -0.12], [w / 2, 3.1 + h, -0.12], sr.rect, 0xdddddd);
  B.pop();
}
export function fireEscape(B, w, floors, fh, y0 = 0) { // local origin at wall centre, extends +Z (0.9m)
  const col = 0x1a1c1e;
  for (let f = 1; f < floors; f++) { const y = y0 + f * fh - 0.6; B.box('metal', 0, y, 0.55, w * 0.7, 0.06, 1.1, { col }); B.box('metal', 0, y + 0.5, 1.08, w * 0.7, 0.04, 0.04, { col }); B.box('metal', 0, y + 0.25, 1.08, w * 0.7, 0.03, 0.03, { col });
    for (let i = 0; i <= 6; i++) B.box('metal', -w * 0.35 + i * (w * 0.7) / 6, y + 0.25, 1.08, 0.02, 0.5, 0.02, { col, top: false });
    if (f < floors) { const sx = (f % 2 ? 1 : -1) * w * 0.2; B.quad('metal', [sx - 0.3, y - fh + 0.06, 0.2], [sx + 0.3, y - fh + 0.06, 0.2], [sx + 0.3, y + 0.0, 1.05], [sx - 0.3, y + 0.0, 1.05], [0, 0, 1, 1], 0x25282b); } }
  B.box('metal', 0, y0 + 2.5, 0.35, 0.5, 0.05, 0.6, { col }); B.box('metal', 0.0, y0 + 1.2, 0.6, 0.4, 2.4, 0.04, { col });
}
export function signFascia(B, x, y, z, w, cls, idx, o = {}) {
  const sr = signRect(cls, idx); const h = w / sr.aspect;
  B.box('plain', x, y, z - 0.03, w + 0.12, h + 0.12, 0.08, { col: 0x303030, top: false, bottom: false }); B.quad('signs', [x - w / 2, y - h / 2, z + 0.02], [x + w / 2, y - h / 2, z + 0.02], [x + w / 2, y + h / 2, z + 0.02], [x - w / 2, y + h / 2, z + 0.02], sr.rect, 0xffffff);
}
export function banner(B, x, y, z, w, idx, yaw = 0) { // tarpaulin hung flat on wall / between poles
  B.push(x, y, z, yaw); const sr = signRect('banner', idx); const h = w / sr.aspect;
  B.quad('signs', [-w / 2, -h / 2, 0.03], [w / 2, -h / 2, 0.03], [w / 2, h / 2, 0.03], [-w / 2, h / 2, 0.03], sr.rect, 0xffffff); B.pop();
}
export function bladeSign(B, x, y, z, idx, size = 0.6, yaw = 0) { B.push(x, y, z, yaw); const sr = signRect('blade', idx); B.box('plain', 0, 0, 0.0, 0.05, 0.05, 0.4, { col: 0x303030 }); B.quad('signs', [-0.03, -size / 2, 0.5], [-0.03, -size / 2, 0.5 + size], [-0.03, size / 2, 0.5 + size], [-0.03, size / 2, 0.5], sr.rect, 0xffffff); B.quad('signs', [0.03, -size / 2, 0.5 + size], [0.03, -size / 2, 0.5], [0.03, size / 2, 0.5], [0.03, size / 2, 0.5 + size], sr.rect, 0xffffff); B.pop(); }
export function laundryLine(B, x, y, z, w, yaw, rng = new RNG(4)) { B.push(x, y, z, yaw); B.wire([-w / 2, 0, 0], [w / 2, 0, 0], 0.12, 6, 0x555555); const n = Math.round(w / 0.45); for (let i = 0; i < n; i++) { const cx = -w / 2 + (i + 0.5) * w / n; const c = rng.pick([0xd8453a, 0x3a7bd5, 0xf2c230, 0xf4f4f0, 0x3aa86f, 0xe86a9a, 0x7a52c8, 0x2a2a30]); const h = rng.range(0.5, 0.95); B.quad('plain', [cx - 0.18, -h, 0], [cx + 0.18, -h, 0], [cx + 0.18, -0.05, 0], [cx - 0.18, -0.05, 0], [0, 0, 1, 1], c); B.quad('plain', [cx + 0.18, -h, 0.001], [cx - 0.18, -h, 0.001], [cx - 0.18, -0.05, 0.001], [cx + 0.18, -0.05, 0.001], [0, 0, 1, 1], mul(c, 0.8)); } B.pop(); }
/** corrugated shanty room with GI roof and tyres on top (Philippine rooftop extension) */
export function shanty(B, x, y, z, w, d, yaw, rng = new RNG(7)) {
  B.push(x, y, z, yaw); const wall = rng.pick([0xc8c0b0, 0x9ab0a0, 0xb8a888, 0xa8b8c8]); B.box('concrete', 0, 1.15, 0, w, 2.3, d, { col: wall }); B.box('plain', 0, 1.0, d / 2 + 0.01, 0.9, 1.8, 0.02, { col: 0x303a40 }); B.box('plain', w * 0.3, 1.4, d / 2 + 0.01, 0.9, 0.7, 0.02, { col: 0x24323c });
  const r = rng.pick([0xc0c4c4, 0xa86a4a, 0x7a9a7a, 0xb04a3a]); B.quad('r_gi', [-w / 2 - 0.25, 2.5, d / 2 + 0.3], [w / 2 + 0.25, 2.5, d / 2 + 0.3], [w / 2 + 0.25, 2.8, -d / 2 - 0.2], [-w / 2 - 0.25, 2.8, -d / 2 - 0.2], [0, 0, 0.8, 1], r);
  for (let i = 0; i < 4; i++) B.cyl('plain', rng.range(-w / 2, w / 2), 2.7, rng.range(-d / 2, d / 2), 0.35, 0.35, 0.18, 8, { col: 0x1c1c1e, cap: true }); B.pop();
}
