// Shared helpers for aircraft / missiles / spacecraft / ships (non-wheeled machines).
import * as THREE from 'three';
import { clamp, RNG, disposeTree, seg } from '../../engine/common.js';
import { canvasTex, texRes, cached, speckle } from '../../engine/proc.js';
import { setInfection as setInfectionTree } from '../../engine/infect.js';
import { mk, TX } from './kit.js';
import { glowSprite } from './common2.js';

/** panel-line + rivet + stain map (near-white, used as `map` multiplied by the paint colour). 1 tile ~ 2 m when UV is scaled by scaleUV(). */
export function panelTex(key = 'air:panel', seed = 11) {
  return cached(key + seed, () => canvasTex(texRes(512), texRes(512), (ctx, w, h) => {
    const r = new RNG(seed);
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, w, h);
    const xs = [0, 0.27, 0.55, 0.78, 1], ys = [0, 0.33, 0.6, 1];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const v = 240 - r.int(0, 26); ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(xs[i] * w, ys[j] * h, (xs[i + 1] - xs[i]) * w, (ys[j + 1] - ys[j]) * h); }
    ctx.strokeStyle = 'rgba(30,34,40,0.55)'; ctx.lineWidth = Math.max(1, w / 380);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) ctx.strokeRect(xs[i] * w + 0.5, ys[j] * h + 0.5, (xs[i + 1] - xs[i]) * w, (ys[j + 1] - ys[j]) * h);
    ctx.fillStyle = 'rgba(40,44,50,0.4)'; for (const x of xs) for (let k = 0; k < 36; k++) ctx.fillRect(x * w + 5, k * h / 36, 1.6, 1.6);
    speckle(ctx, w, h, { count: 900, colors: ['#222', '#664'], alpha: [0.04, 0.18], size: [1, 3], seed: seed + 1 });
  }));
}
/** Parts.add({uv}) hook: scale UVs (so a 2 m tile maps onto big parts) */
export const scaleUV = (su, sv = su) => (g) => { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * su, a.getY(i) * sv); };
/** Parts.add({uv}) hook: planar top-down UV 0..1 over a rectangle in (x,z) (flight decks, ship decks) */
export const planarUV01 = (x0, x1, z0, z1) => (g) => { const p = g.attributes.position, a = g.attributes.uv; for (let i = 0; i < p.count; i++) a.setXY(i, (p.getX(i) - x0) / (x1 - x0), 1 - (p.getZ(i) - z0) / (z1 - z0)); };

/** standard grey-airframe material set (all infectable + damageable) */
export function airMats({ base = 0x7b838c, base2 = 0x555c64, dark = 0x1d2024, canopy = 0x3a2c14, rough = 0.5 } = {}) {
  const map = panelTex();
  const paint = (c) => mk.paint(c, { metal: 0.3, rough, clearcoat: 0.2, map, normalScale: 0.1 });
  const m = {
    paint: paint(base), paint2: paint(base2),
    dark: mk.metal(dark, { rough: 0.55, metal: 0.5, normal: TX.hammered(), ns: 0.4 }),
    steel: mk.metal(0x7c838b, { rough: 0.35, metal: 0.9, normal: TX.hammered(), ns: 0.3 }),
    rubber: mk.rubber({ tread: true }), glass: mk.glass({ tint: canopy, opacity: 0.5 }),
    red: mk.flat(0xb5141a, { rough: 0.5 }), white: mk.paint(0xe2e5e8, { metal: 0.15, rough: 0.4, clearcoat: 0.3, map, normalScale: 0.08 }),
    lampR: mk.light(0xff2020, { on: 5, off: 0.05, base: 0x501010 }), lampG: mk.light(0x20ff50, { on: 5, off: 0.05, base: 0x105020 }), lampW: mk.light(0xffffff, { on: 8, off: 0.05, base: 0x888888 }),
    burn: mk.light(0xff9a40, { on: 7, off: 0.3, base: 0x2a1408 }),
  };
  m.steel.side = THREE.DoubleSide;
  return m;
}

/** Additive exhaust flame (cone along local -Z from the nozzle at z=0). set(k 0..1, lenScale) ; tick(t) ; tint(infection) */
export function makeExhaust({ radius = 0.5, length = 6, core = 0xffffff, mid = 0xffb050, edge = 0x4a6cff, diamonds = 14, seed = 0, glow = 0 } = {}) {
  const g = new THREE.CylinderGeometry(radius * 0.25, radius, 1, seg(20, 8), 10, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, -0.5);
  const u = { uT: { value: 0 }, uK: { value: 0 }, uLen: { value: length }, uSeed: { value: seed }, uDiam: { value: diamonds }, uTint: { value: 0 }, uCore: { value: new THREE.Color(core) }, uMid: { value: new THREE.Color(mid) }, uEdge: { value: new THREE.Color(edge) } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uT,uK,uLen; varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){ vAlong = uv.y; vec3 p = position; p.z *= uLen * (0.94 + 0.06 * sin(uT * 61.0 + position.z * 3.0)); p.xy *= (0.7 + 0.3 * uK) * (1.0 + 0.22 * sin(3.14159 * vAlong));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT,uK,uSeed,uDiam,uTint; uniform vec3 uCore,uMid,uEdge; varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){ float al = vAlong; float ndv = abs(dot(normalize(vN), normalize(vV)));
        float shock = uDiam > 0.5 ? 0.55 + 0.45 * pow(abs(sin(al * uDiam)), 0.6) : 1.0;
        float fl = 0.82 + 0.18 * sin(uT * 70.0 + al * 18.0 + uSeed) * sin(uT * 53.0 + uSeed * 3.0);
        float a = pow(ndv, 1.3) * pow(1.0 - al, 1.7) * smoothstep(0.0, 0.03, al) * shock * fl * uK;
        vec3 c = mix(uCore, uMid, smoothstep(0.0, 0.3, al)); c = mix(c, uEdge, smoothstep(0.5, 1.0, al) * 0.7 + (1.0 - ndv) * 0.2); c = mix(c, vec3(0.2, 1.0, 0.1), uTint);
        gl_FragColor = vec4(c * (0.8 + 1.4 * (1.0 - al)), a); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 6;
  const root = new THREE.Group(); root.add(mesh); let spr = null;
  if (glow > 0) { spr = glowSprite(mid, glow, 0.8); spr.position.z = -0.25; spr.renderOrder = 7; root.add(spr); }
  root.visible = false;
  return {
    root, uniforms: u,
    set(k, lenScale = 1) { u.uK.value = k; u.uLen.value = length * lenScale; root.visible = k > 0.02; if (spr) { spr.scale.setScalar(glow * (0.45 + k)); spr.material.opacity = 0.9 * Math.min(1, k * 1.4); } },
    tint(a) { u.uTint.value = a; if (spr) spr.material.color.setHex(mid).lerp(new THREE.Color(0x3cff1a), a); }, tick(t) { u.uT.value = t; },
  };
}

/** common hero-object controller for non-wheeled machines. cfg: {state, onUpdate(dt,t,S), exhausts:[...]} */
export function makeCraft(root, { state = {}, onUpdate, exhausts = [] } = {}) {
  const S = Object.assign({ t: 0, inf: 0, dmg: 0, first: true }, state);
  const api = {
    root, state: S,
    update(dt, t) { dt = clamp(dt, 0, 0.1); S.t = t; for (const e of exhausts) e.tick(t); if (onUpdate) onUpdate(dt, t, S); S.first = false; },
    setInfection(a) { S.inf = clamp(a); setInfectionTree(root, S.inf); for (const e of exhausts) e.tint(S.inf); },
    setDamage(d) { S.dmg = clamp(d); root.traverse((o) => { const m = o.material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) if (mm.userData?.uDamage) mm.userData.uDamage.value = S.dmg; }); },
    dispose() { disposeTree(root); },
  };
  return api;
}
export const seatAnchor = (x, y, z, yaw = 0, h = 0.45) => ({ pos: [x, y, z], hip: [x, y + h, z], yaw, seatH: h });
