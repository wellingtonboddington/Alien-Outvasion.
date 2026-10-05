// FX stress test: every system at max budget at once. Run at each quality and compare the harness' calls/tris/render ms:
//   for q in 0 1 2; do node tools/render.mjs --demo fx_stress --out out/fx/stress_q$q --q $q; done
// Also logs the CPU cost of fx.update (ms avg/max per frame) and live particle counts.
import * as THREE from 'three';
import { createFX } from '../fx/particles.js';
import { createDemoWorld } from '../fx/demo_env.js';
import { RNG } from '../engine/common.js';

export default async function setup(stage, params = {}) {
  const world = createDemoWorld(stage, { preset: 'dusk', radius: 140, seed: 2 });
  const scene = stage.scene; const fx = createFX(scene, { ground: 0, wind: [3, 1] }); fx.syncLights();
  const r = new RNG(99);
  for (let i = 0; i < 6; i++) fx.explosion([Math.cos(i * 1.05) * 45, 0, Math.sin(i * 1.05) * 45 - 50], { size: 16 + (i % 3) * 5, kind: ['fireball', 'ground', 'air', 'big', 'chain', 'laser'][i], delay: 0.2 + i * 0.35 });
  fx.nuke([0, 0, -260], { size: 120, delay: 1.0 });
  for (let i = 0; i < 6; i++) { fx.fire([-30 + i * 12, 0, -30 - (i % 2) * 12], { size: 2.5 + (i % 3) }); fx.sporeCloud([-22 + i * 9, 0.3, -12 - (i % 3) * 6], { radius: 3.5, density: 1.2 }); }
  for (let i = 0; i < 4; i++) fx.smokeColumn([-50 + i * 33, 0, -75], { height: 120, width: 14, puffLife: 20 });
  fx.rain({ intensity: 1 }); fx.snow({}); fx.ashFall({}); fx.embersField({ area: { center: [0, 14, -40], size: [120, 30, 100] } });
  fx.storm({ center: [0, 0, -100], radius: 80, rate: 1.5, seed: 3, height: 180 });
  const movers = []; for (let i = 0; i < 4; i++) { const o = new THREE.Object3D(); scene.add(o); movers.push(o); fx.smokeTrail(o, { fire: i % 2 === 0, size: 1.1 }); fx.engineGlow(o, { size: 1.5, length: 5, dir: [-1, 0, 0] }); }
  let cpu = 0, cpuMax = 0, n = 0, k = 0;
  const shots = [3, 6, 10].map((t) => ({ name: 't' + t, t, cam: [Math.sin(t * 0.3) * 14, 4, 24, 0, 14, -70], fov: 55 }));
  return {
    shots,
    update(t, dt) {
      movers.forEach((m, i) => m.position.set(-40 + t * 14 + i * 8, 30 + i * 6 + Math.sin(t + i) * 3, -40 - i * 10));
      for (let i = 0; i < 6; i++) fx.tracer([r.range(-20, 20), 1.5, 12], [r.range(-40, 40), r.range(0, 12), -60], { speed: 250, length: 6, impact: i % 2 ? 'metal' : 'ground' });
      fx.muzzleFlash([r.range(-3, 3), 1.5, 12], [0, 0, -1], { size: 1 }); fx.muzzleFlash([r.range(-3, 3), 1.5, 12], [0, 0, -1], { size: 1.2 });
      if ((k++ & 3) === 0) { fx.impact([r.range(-20, 20), 0, r.range(-30, -5)], [0, 1, 0], { kind: ['ground', 'metal', 'flesh_green', 'energy'][k & 3] }); fx.sparks([r.range(-20, 20), 1, -8], { count: 18 }); fx.debris([r.range(-10, 10), 0, -10], { count: 8 }); }
      const t0 = performance.now(); fx.update(dt, t); const c = performance.now() - t0; cpu += c; n++; if (c > cpuMax) cpuMax = c;
    },
    onShot(s) { const st = fx.stats(); console.warn(`[fx_stress] ${s.name}: fx.update cpu avg ${(cpu / n).toFixed(3)} ms max ${cpuMax.toFixed(2)} ms, alive pool slots ${st.particles}, pools ${st.pools}, emitters ${st.emitters}, fields ${st.fields}`); },
  };
}
