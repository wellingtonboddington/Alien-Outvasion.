// FX demo: burning city skyline — smoke columns, street fires, rising embers, ash fall, missile smoke trail.
//   node tools/render.mjs --demo fx_smoke_fire --out out/fx/fire --q 2
import * as THREE from 'three';
import { createFX } from '../fx/particles.js';
import { createDemoWorld } from '../fx/demo_env.js';

export default async function setup(stage, params = {}) {
  const world = createDemoWorld(stage, { preset: params.preset || 'dusk', radius: 150, seed: 11 });
  const fx = createFX(stage.scene, { ground: 0, wind: [2.2, 1.0] }); fx.syncLights();
  // three big plumes, a few street fires, embers & ash
  fx.smokeColumn([-30, 0, -70], { height: 160, width: 16, puffLife: 26, heat: 0.35 });
  fx.smokeColumn([22, 0, -95], { height: 190, width: 22, puffLife: 30, heat: 0.3 });
  fx.smokeColumn([70, 0, -60], { height: 120, width: 12, puffLife: 22, color: [0.2, 0.19, 0.18] });
  fx.fire([-30, 0, -70], { size: 5 }); fx.fire([22, 0, -95], { size: 7 }); fx.fire([70, 0, -60], { size: 3.5 });
  fx.fire([-6, 0, -22], { size: 1.6 }); fx.fire([8, 0, -30], { size: 2.2 }); fx.fire([-14, 0, -40], { size: 2.6 });
  fx.embersField({ area: { center: [0, 14, -50], size: [140, 36, 120] }, count: 900 });
  fx.ashFall({});
  // a stricken missile arcing over with a smoke trail
  const missile = new THREE.Object3D(); stage.scene.add(missile);
  fx.smokeTrail(missile, { size: 0.9, life: 5, fire: true, rate: 50 });
  fx.engineGlow(missile, { size: 1.4, color: [1, 0.6, 0.2], flicker: 0.3 });
  const cams = { street: [0, 2.2, 22, 0, 22, -80], wide: [-30, 6, 30, 10, 28, -80], low: [12, 1.2, -4, -6, 5, -60], close: [-6, 1.8, -8, -10, 2.5, -30] };
  const T = [5, 12, 22];
  const shots = []; for (const t of T) for (const c of ['street', 'wide', 'close']) shots.push({ name: `${c}_${t}`, t, cam: cams[c], fov: c === 'close' ? 55 : 42 });
  return {
    shots,
    update(t, dt) { const u = t * 0.12; missile.position.set(-70 + t * 12, 55 - t * 1.2 + Math.sin(t * 0.6) * 2, -40 - t * 4); fx.update(dt, t); },
  };
}
