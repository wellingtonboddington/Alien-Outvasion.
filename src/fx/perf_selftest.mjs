// node src/fx/perf_selftest.mjs [-v] — simulates GPUs of different speed (vsync-capped frame times, noise, random hitches)
// and checks that createPerf converges and never flaps.
import { createPerf } from './perf.js';

function sim(name, costFn, seconds = 180, hz = 60, noise = 0.08) {
  const perf = createPerf({ targetFps: hz, minPixelRatio: 0.5, maxPixelRatio: 2 });
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const log = []; let t = 0;
  perf.onChange = (p, dir, why) => log.push(`${t.toFixed(1)}s ${dir} -> L${p.level} pr${p.recommendedPixelRatio} (${why})`);
  const vsync = 1000 / hz;
  while (t < seconds) {
    let ms = costFn(perf.level, perf.recommendedPixelRatio, t) * (1 + (rnd() - 0.5) * 2 * noise);
    ms = Math.ceil(ms / vsync - 0.02) * vsync; // frames land on vsync multiples
    if (rnd() < 0.004) ms += 120; // occasional hitch
    t += ms / 1000; perf.sample(ms);
  }
  const lastChange = log.length ? parseFloat(log[log.length - 1]) : 0;
  const s = perf.stats();
  console.log(`${name}: ${log.length} changes, final L${s.level} pr${s.pixelRatio} med ${s.medMs.toFixed(1)}ms, last change at ${lastChange}s`);
  if (process.argv.includes('-v')) console.log('   ' + log.join('\n   '));
  return { log, perf, lastChange };
}
const cost = (base) => (L, pr) => base * pr * pr * (0.55 + 0.25 * L + 0.2 * (L >= 2 ? 1 : 0));
let ok = true; const check = (c, m) => { if (!c) { ok = false; console.error('FAIL', m); } };
let r = sim('fast GPU (1.2ms-class)', cost(1.2)); check(r.log.length === 0, 'fast GPU must not change');
r = sim('mid GPU', cost(3.4)); check(r.log.length <= 8, 'mid GPU settles: ' + r.log.length);
r = sim('slow GPU', cost(8)); check(r.log.length <= 12 && r.perf.medMs <= 18, 'slow GPU settles at budget');
r = sim('very slow GPU', cost(30)); check(r.perf.level === 0, 'very slow GPU reaches level 0');
r = sim('varying load', (L, pr, t) => cost(t > 50 && t < 110 ? 7 : 2.6)(L, pr), 240); check(r.log.length <= 16, 'varying load must not flap: ' + r.log.length);
r = sim('borderline (probe backoff)', cost(4.6), 600); check(r.log.length <= 18, 'borderline must not oscillate: ' + r.log.length);
r = sim('30fps phone', (L, pr) => cost(9)(L, pr), 180, 30); check(r.log.length <= 12, '30 fps target settles');
// a lone hitch must never change anything
{ const p = createPerf({ targetFps: 60 }); let ch = 0; p.onChange = () => ch++; for (let i = 0; i < 600; i++) p.sample(i === 300 ? 200 : 16.7); check(ch === 0, 'a single hitch changed quality'); }
console.log(ok ? 'PERF OK' : 'PERF FAILED'); process.exit(ok ? 0 : 1);
