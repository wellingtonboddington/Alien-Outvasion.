// Animation review. Two modes:
//   sheet : one hero per (clip,time) pair in a grid.      params {set:'a'|'b'|'c', kind}
//   strip : one clip sampled at several times in a row.   params {clip, times:[..], kind, gap, side:true, hold:bool, loc:'x'}
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createVessari, createCrawler } from '../models/aliens/index.js';
const mkHero = (kind, seed, opts) => (kind === 'crawler' ? createCrawler(seed, opts) : createVessari(kind, seed, opts));

const SETS = {
  a: [['idle', 1.0], ['idle_alert', 1.0], ['walk', 0.1], ['walk', 0.5], ['run', 0.1], ['run', 0.4], ['stalk', 0.3], ['aim', 1.0], ['fire', 0.05]],
  b: [['roar', 1.4], ['talk_a', 1.3], ['talk_b', 1.0], ['stagger', 0.15], ['die', 0.5], ['die', 1.5], ['die', 2.8], ['climb', 0.4], ['kneel', 1.0]],
  c: [['command', 1.0], ['salute', 1.0], ['infected_idle', 1.0], ['infected_run', 0.15], ['infected_run', 0.45], ['infected_lunge', 0.3], ['infected_lunge', 0.8], ['infected_lunge', 1.3], ['dead', 1.0]],
};
export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: false });
  const kind = params.kind || 'soldier'; const heroes = [];
  if (params.clip) {
    const times = params.times || [0, 0.15, 0.3, 0.45, 0.6]; const gap = params.gap || 2.0; const n = times.length;
    times.forEach((tm, i) => {
      const h = mkHero(kind, 3, params.opts || {}); if (params.side) h.root.position.set(0, 0, (i - (n - 1) / 2) * gap); else h.root.position.set((i - (n - 1) / 2) * gap, 0, 0); if (params.hold !== undefined && h.hold) h.hold(params.hold ? 'rifle' : null);
      stage.scene.add(h.root); h.play(params.clip, { time: tm, blend: 0 }); if (params.inf) h.setInfection(params.inf); heroes.push({ h, clip: params.clip, time: tm });
    });
    const W = n * gap; const d = Math.max(7, W * 0.9);
    const cam = params.side ? [d, 1.4, 0, 0, 1.15, 0] : [W * 0.15, 1.8, d, 0, 1.2, 0];
    return { update(t, dt) { for (const o of heroes) { o.h.play(o.clip, { time: o.time, blend: 0 }); o.h.update(dt, t); } }, shots: [{ name: params.clip, t: 0.4, cam, fov: params.fov || 28 }] };
  }
  const list = SETS[params.set || 'a']; const cols = 5; const gx = 2.5, gz = 3.2;
  list.forEach(([clip, time], i) => {
    const h = createVessari(kind, 3 + (i % 3), params.opts || {}); const c = i % cols, r = Math.floor(i / cols);
    h.root.position.set((c - (cols - 1) / 2) * gx, 0, -r * gz); stage.scene.add(h.root); h.play(clip, { time, blend: 0 }); if (params.inf) h.setInfection(params.inf);
    heroes.push({ h, clip, time });
  });
  return { update(t, dt) { for (const o of heroes) { o.h.play(o.clip, { time: o.time, blend: 0 }); o.h.update(dt, t); } }, shots: [{ name: params.set || 'a', t: 0.4, cam: [0, 2.6, 13.5, 0, 1.0, -1.6], fov: 38 }] };
}
