// FX demo: the same scene through different post parameters (bloom, grade, chroma, glitch, fade/flash, blur/dof, letterbox, quality levels).
// Each shot checks numerically that its parameters really change the image (mean abs RGB difference vs the baseline shot); failures print errors.
//   node tools/render.mjs --demo fx_post --out out/fx/post --q 2
import * as THREE from 'three';
import { createFX } from '../fx/particles.js';
import { createPost } from '../fx/post.js';
import { createDemoWorld } from '../fx/demo_env.js';
import { RNG } from '../engine/common.js';

const VARIANTS = [
  { name: 'base', p: {}, min: 0 },
  { name: 'nobloom', p: { bloom: { strength: 0 } }, min: 0.4 },
  { name: 'bloom_strong', p: { bloom: { strength: 1.6, radius: 0.9, threshold: 0.5 } }, min: 1.0 },
  { name: 'grade_warm', p: { tint: [1.2, 1.0, 0.75], contrast: 1.25, saturation: 1.35 }, min: 3 },
  { name: 'grade_cold', p: { tint: [0.8, 0.95, 1.25], saturation: 0.55, contrast: 1.1, vignette: 0.75 }, min: 3 },
  { name: 'exposure_dark', p: { exposure: 0.5 }, min: 8 },
  { name: 'chroma', p: { chroma: 1.0 }, min: 0.15 },
  { name: 'glitch', p: { glitch: 0.75 }, min: 4 },
  { name: 'glitch_low', p: { glitch: 0.25 }, min: 0.8 },
  { name: 'fade_half', p: { fade: 0.5 }, min: 15 },
  { name: 'flash_half', p: { flash: 0.55 }, min: 15 },
  { name: 'blur', p: { blur: 0.9 }, min: 0.7 },
  { name: 'dof', p: { dof: 1.0 }, min: 0.5 },
  { name: 'letterbox', p: { letterbox: 0.12 }, min: 3 },
  { name: 'grain', p: { grain: 1.0 }, min: 1.0 },
  { name: 'lgg', p: { lift: [0.02, 0.0, 0.05], gamma: [1.0, 0.9, 1.1], gain: [1.1, 1.0, 0.9] }, min: 1.5 },
];

export default async function setup(stage, params = {}) {
  const world = createDemoWorld(stage, { preset: params.preset || 'dusk', radius: 120 });
  const scene = stage.scene;
  // emissive + colourful props so bloom/grade are visible
  const neon = [[0xff2a6a, -6], [0x2affd0, 0], [0xffd02a, 6]];
  for (const [c, x] of neon) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 9 })); m.position.set(x, 3, -8); scene.add(m); }
  const r = new RNG(7);
  for (let i = 0; i < 7; i++) { const col = new THREE.Color().setHSL(i / 7, 0.7, 0.5); const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })); m.position.set(-9 + i * 3, 0.9, -2 + r.range(-1, 1)); m.castShadow = true; scene.add(m); }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xfff2d0, emissiveIntensity: 40 })); lamp.position.set(10, 7, -10); scene.add(lamp);
  const fx = createFX(scene, { ground: 0 }); fx.syncLights();
  const post = createPost(stage); post.setQuality(params.quality ?? 2); post.params.grain = 0.3;
  const shots = VARIANTS.map((v) => ({ name: v.name, t: 1.6, cam: [2, 3.2, 17, 0, 3, -4], fov: 52 }));
  if (params.levels !== false) for (const lv of [0, 1]) shots.push({ name: 'quality' + lv, t: 1.6, cam: [2, 3.2, 17, 0, 3, -4], fov: 52 });
  let base = null; const gl = stage.renderer.getContext(); const W = stage.width, H = stage.height; const buf = new Uint8Array(W * H * 4);
  const defaults = JSON.parse(JSON.stringify(post.params));
  let cur = null;
  const apply = (p) => { const P = post.params; for (const k in defaults) P[k] = JSON.parse(JSON.stringify(defaults[k])); for (const k in p) { if (typeof p[k] === 'object' && !Array.isArray(p[k])) Object.assign(P[k], p[k]); else P[k] = p[k]; } };
  return {
    shots,
    onShot(s) { cur = VARIANTS.find((v) => v.name === s.name) || null; if (/^quality/.test(s.name)) { apply({}); post.setQuality(+s.name.slice(7)); } else { post.setQuality(params.quality ?? 2); apply(cur ? cur.p : {}); } },
    update(t, dt) { if (t < 0.05) fx.explosion([0, 0, -10], { size: 14, kind: 'fireball', seed: 5 }); fx.update(dt, t); },
    render() {
      post.render(1 / 30);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      if (cur && cur.name === 'base') base = buf.slice();
      else if (base) {
        let d = 0; for (let i = 0; i < buf.length; i += 4) d += Math.abs(buf[i] - base[i]) + Math.abs(buf[i + 1] - base[i + 1]) + Math.abs(buf[i + 2] - base[i + 2]);
        d /= (buf.length / 4) * 3;
        const name = cur ? cur.name : 'quality';
        const ok = !cur || d >= cur.min; (ok ? console.warn : console.error)(`[fx_post] ${name}: mean|diff| vs base = ${d.toFixed(2)}${cur ? ` (need >= ${cur.min})` : ''} passes=${post.stats.passes}`);
      }
    },
  };
}
