// The Vessari "bio-lance": an organic rifle (bone-tan receiver, slate stock + grips, tendon cables, glowing cyan cells + muzzle).
// Built in weapon-local space: +Z = barrel, +Y = up, origin ~ receiver centre.
import * as THREE from 'three';
import { seg } from '../../engine/common.js';
import { V3, loft, sweep, seg2, blob, spike, place, mergePlain, makeProbe, conformStrip } from './util.js';

export const WEAPON = {
  gripPt: new V3(0, -0.115, -0.085),   // where the right palm sits (weapon-local)
  fgPt: new V3(0, -0.085, 0.40),       // left-hand foregrip
  muzzle: new V3(0, 0.012, 1.24),
};

export function buildWeaponGeos() {
  const shell = [], skin = [], dark = [], glow = [];
  // receiver: swollen shell body
  const rec = loft([
    { t: -0.22, rx: 0.026, ry: 0.034, cy: 0.012 }, { t: -0.14, rx: 0.046, ry: 0.058, cy: 0.012 }, { t: 0.02, rx: 0.058, ry: 0.072, cy: 0.016, power: 2.4 },
    { t: 0.22, rx: 0.056, ry: 0.066, cy: 0.012, power: 2.4 }, { t: 0.38, rx: 0.044, ry: 0.052, cy: 0.008 }, { t: 0.48, rx: 0.03, ry: 0.034, cy: 0.006 },
  ], { axis: 'z', radial: 18, tile: 0.3 }); shell.push(rec);
  // barrel: long tapering horn made of 3 sleeves with rings
  const bar = sweep([new V3(0, 0.008, 0.40), new V3(0, 0.010, 0.72), new V3(0, 0.014, 1.02), new V3(0, 0.016, 1.16)], [0.026, 0.021, 0.0165, 0.013], [0.026, 0.021, 0.0165, 0.013], { radial: 12, samples: 16, round: 1, tile: 0.2, up: new V3(0, 1, 0) }); dark.push(bar);
  for (let i = 0; i < 5; i++) { const z = 0.50 + i * 0.13; const t = new THREE.TorusGeometry(1, 0.22, 6, seg(14, 8)); const r = 0.03 - i * 0.0024; t.scale(r, r, r * 0.7); t.rotateY(Math.PI / 2); t.rotateZ(Math.PI / 2); t.rotateX(0); t.translate(0, 0.008 + i * 0.0015, z); shell.push(t); }
  // twin side prongs along the barrel (the lance's "tines")
  for (const s of [1, -1]) {
    const pr = sweep([new V3(0.04 * s, 0.0, 0.34), new V3(0.075 * s, 0.01, 0.58), new V3(0.062 * s, 0.025, 0.86), new V3(0.026 * s, 0.022, 1.20)], [0.014, 0.012, 0.009, 0.0035], [0.01, 0.009, 0.007, 0.003], { radial: 7, samples: 14, round: 1, tile: 0.15, up: new V3(0, 1, 0) }); shell.push(pr);
    // glowing energy cells between tines
    for (let i = 0; i < 4; i++) { const z = 0.5 + i * 0.16; const c = blob([0.052 * s, 0.012, z], 0.011, 0.018, 0.06, { w: 8, h: 6 }); glow.push(c); }
  }
  // muzzle: glowing core + flare ring
  const mz = blob([0, 0.016, 1.17], 0.019, 0.019, 0.04, { w: 10, h: 8 }); glow.push(mz);
  const ring = new THREE.TorusGeometry(0.026, 0.006, 6, 14); ring.translate(0, 0.014, 1.12); glow.push(ring);
  // ribs / tendons running from receiver to barrel
  for (const s of [1, -1]) { const t = sweep([new V3(0.05 * s, 0.045, 0.1), new V3(0.04 * s, 0.062, 0.34), new V3(0.02 * s, 0.045, 0.62), new V3(0.012 * s, 0.03, 0.85)], 0.0085, 0.0085, { radial: 6, samples: 14, round: 1, tile: 0.1 }); dark.push(t); }
  // top rail / sensory organ
  const eye = blob([0, 0.075, 0.12], 0.016, 0.018, 0.03, { w: 8, h: 6 }); glow.push(eye);
  // stock: curved fin back to the shoulder
  const stock = sweep([new V3(0, 0.0, -0.15), new V3(0, 0.012, -0.30), new V3(0, -0.012, -0.44), new V3(0, -0.06, -0.52)], [0.016, 0.018, 0.020, 0.024], [0.045, 0.05, 0.058, 0.07], { radial: 10, samples: 14, round: 2, tile: 0.2, up: new V3(0, 1, 0) }); skin.push(stock);
  const pad = blob([0, -0.065, -0.525], 0.03, 0.085, 0.02, { w: 10, h: 8 }); dark.push(pad);
  // pistol grip (tilted) + guard
  const grip = sweep([new V3(0, -0.03, -0.065), new V3(0, -0.10, -0.085), new V3(0, -0.185, -0.115)], [0.030, 0.029, 0.026], [0.024, 0.024, 0.022], { radial: 10, samples: 8, round: 2, tile: 0.1, up: new V3(0, 0, 1) }); skin.push(grip);
  const guard = sweep([new V3(0, -0.04, 0.04), new V3(0, -0.098, 0.02), new V3(0, -0.092, -0.03)], 0.007, 0.007, { radial: 5, samples: 8, round: 1, tile: 0.1 }); shell.push(guard);
  // foregrip
  const fg = sweep([new V3(0, -0.03, 0.40), new V3(0, -0.085, 0.405), new V3(0, -0.155, 0.41)], [0.027, 0.025, 0.028], [0.023, 0.022, 0.025], { radial: 10, samples: 8, round: 2, tile: 0.1, up: new V3(0, 0, 1) }); skin.push(fg);
  // spines on the receiver
  for (let i = 0; i < 4; i++) { const z = -0.05 + i * 0.1; shell.push(spike([0, 0.075, z], [0, 0.11 + 0.01 * i, z - 0.07], 0.012, { radial: 5, curve: 0.3, bend: new V3(0, 0.3, 0) })); }
  return { shell: mergePlain(shell), skin: mergePlain(skin), dark: mergePlain(dark), glow: mergePlain(glow) };
}
