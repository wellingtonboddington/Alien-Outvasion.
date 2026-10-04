// EENBOT-2 showcase: clip lineup, close-ups, infected variants.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createEenbot } from '../models/vehicles.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { intensity: 1.0, bg: 0x59636e });
  const lineup = [['idle', 0], ['walk', 0], ['jog', 0], ['run', 0], ['carry', 0], ['aim', 0], ['work', 0], ['wave', 0], ['stagger', 0], ['fall', 0.0], ['dead', 0], ['talk_a', 0]];
  const bots = lineup.map(([clip, inf], i) => {
    const b = createEenbot({ seed: i }); b.setTransform((i - (lineup.length - 1) / 2) * 1.5, 0, 0, 0); b.play(clip, { time: 0 }); stage.scene.add(b.root);
    if (clip === 'carry') b.hold('crate'); if (clip === 'aim') b.hold('rifle'); if (clip === 'talk_a') b.setTalk(0.9);
    return { b, clip, i };
  });
  const inf = [['idle', 1], ['run', 1], ['zombie_shamble', 1], ['rabid_lunge', 1], ['walk', 0.5]].map(([clip, a], i) => { const b = createEenbot({ seed: 20 + i }); b.setTransform((i - 2) * 1.5, 0, -3.5, Math.PI); b.play(clip, { time: 0 }); b.setInfection(a); stage.scene.add(b.root); return { b, clip, a }; });
  const hero = createEenbot({ seed: 99 }); hero.setTransform(0, 0, 6.5, 0); hero.play('idle', { time: 0 }); stage.scene.add(hero.root);
  const heroInf = createEenbot({ seed: 98 }); heroInf.setTransform(1.2, 0, 6.5, -0.4); heroInf.play('rabid_idle', { time: 0 }); heroInf.setInfection(1); stage.scene.add(heroInf.root);
  const sp = (b, clip, t) => { const v = b.clipSpeed(clip); return v; };
  const shots = [
    { name: 'lineup_a', t: 0.5, cam: [-2.5, 1.35, 7.4, -2.5, 0.9, 0], fov: 50 },
    { name: 'lineup_b', t: 0.5, cam: [3.5, 1.35, 7.4, 3.5, 0.9, 0], fov: 50 },
    { name: 'hero_front', t: 0.5, cam: [0.6, 1.25, 8.9, 0, 1.0, 6.5], fov: 34 },
    { name: 'hero_face', t: 0.55, cam: [0.5, 1.7, 7.7, 0, 1.62, 6.5], fov: 28 },
    { name: 'hero_chest', t: 0.6, cam: [0.8, 1.45, 7.6, 0, 1.25, 6.5], fov: 34 },
    { name: 'hero_side', t: 0.65, cam: [3.5, 1.1, 6.5, 0, 0.9, 6.5], fov: 36 },
    { name: 'hero_back', t: 0.7, cam: [-0.7, 1.4, 4.4, 0, 1.1, 6.5], fov: 34 },
    { name: 'lineup_c', t: 1.1, cam: [-2.5, 1.35, 7.4, -2.5, 0.9, 0], fov: 50 },
    { name: 'lineup_d', t: 1.1, cam: [3.5, 1.35, 7.4, 3.5, 0.9, 0], fov: 50 },
    { name: 'infected', t: 1.3, cam: [0, 1.4, -8.6, 0, 0.95, -3.5], fov: 52 },
    { name: 'hero_inf', t: 1.4, cam: [0.5, 1.45, 9.0, 0.5, 1.0, 6.5], fov: 40 },
    { name: 'hero_inf_face', t: 1.4, cam: [1.4, 1.75, 7.9, 1.2, 1.62, 6.5], fov: 28 },
  ];
  return {
    shots,
    update(t, dt) {
      for (const { b, clip } of bots) { b.play(clip, { time: clip === 'fall' ? t * 0.8 : t }); if (clip === 'fall') b.play('fall', { time: t * 0.8, loop: false }); b.update(dt, t); }
      for (const { b, clip } of inf) { b.play(clip, { time: t }); b.update(dt, t); }
      hero.play('idle', { time: t }); hero.update(dt, t); hero.setTalk(0.6 + 0.4 * Math.sin(t * 6));
      heroInf.play('rabid_idle', { time: t }); heroInf.update(dt, t);
    },
  };
}
