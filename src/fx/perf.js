// Adaptive resolution / quality controller used by the director.
//   const perf = createPerf({ targetFps: 60, minPixelRatio: 0.5, maxPixelRatio: Math.min(devicePixelRatio, 2) });
//   each frame:  if (perf.sample(dtMs)) { post.setQuality(perf.level); resize(w, h, perf.recommendedPixelRatio); fx.setBudget(perf.particleBudget) }
//
// A ladder of (quality level, pixel ratio) tiers runs from best to worst.
//  * Overload (median frame time above budget, or many missed frames) steps DOWN after ~0.5 s of consistent misses, at once and by
//    2-3 tiers when frames take 2x+ the budget. A single GC hitch / shader compile never triggers anything (median + miss-fraction + spike filter).
//  * Under vsync the frame time can never drop below the budget, so "headroom" is detected two ways: truly short frames (high refresh
//    display or an optional gpuMs argument) upgrade after seconds; frames that are all on budget for a long stable period make a *probe* upgrade.
//  * A failed probe (downgrade within `probeWindow` seconds of an upgrade) blocks that tier with exponential backoff, plus a global cooldown,
//    so the controller can never oscillate quickly; at most a handful of probes happen in a long session.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createPerf(opts = {}) {
  const o = {
    targetFps: 60, minPixelRatio: 0.5, maxPixelRatio: (typeof devicePixelRatio !== 'undefined' ? Math.min(devicePixelRatio || 1, 2) : 1.5), startPixelRatio: undefined,
    maxLevel: 2, minLevel: 0, startLevel: undefined, window: 48, evalEvery: 12, downHold: 2, upHold: 4.5, probeHold: 14, cooldownUp: 10, cooldownDown: 0.9, probeWindow: 22, blockBase: 40, maxBlock: 600,
    spikeMs: 250, overload: 1.12, headroom: 0.78, stepFactor: 0.88, ...opts,
  };
  const maxPR = Math.max(o.minPixelRatio, o.maxPixelRatio), minPR = Math.min(o.minPixelRatio, maxPR);
  // ---- ladder (best -> worst): pixel ratio shrinks first within each quality band
  const tiers = [];
  const add = (level, pr) => { pr = clamp(pr, minPR, maxPR); const last = tiers[tiers.length - 1]; if (last && last.level === level && Math.abs(last.pr - pr) < 0.02) return; tiers.push({ level, pr: Math.round(pr * 100) / 100 }); };
  const hi = o.maxLevel, lo = o.minLevel;
  for (let L = hi; L >= lo; L--) {
    const k = hi - L; const from = maxPR * Math.pow(0.78, k), to = L === lo ? minPR : maxPR * Math.pow(0.78, k + 1);
    let pr = Math.max(from, minPR); for (let g = 0; g < 40 && pr > to + 0.01; g++) { add(L, pr); pr *= o.stepFactor; }
    if (L === lo) add(L, minPR);
  }
  if (!tiers.length) add(hi, maxPR);
  const nearest = (level, pr) => { let bi = 0, bd = 1e9; for (let i = 0; i < tiers.length; i++) { const d = Math.abs(tiers[i].level - level) * 10 + Math.abs(tiers[i].pr - pr); if (d < bd) { bd = d; bi = i; } } return bi; };

  const perf = { tiers, index: -1, level: hi, recommendedPixelRatio: maxPR, particleBudget: 1, onChange: null, changes: 0, avgMs: 0, medMs: 0, fps: 0, slowFrac: 0, frames: 0, hitches: 0, time: 0, lastChangeTime: -1e9, lastReason: '', options: o };
  const buf = new Float32Array(o.window), scratch = new Float32Array(o.window), fails = new Int16Array(tiers.length + 1), blocked = new Float64Array(tiers.length + 1);
  let n = 0, head = 0, sinceEval = 0, over = 0, stableTime = 0, headTime = 0, warm = 0, lastUpTime = -1e9, lastUpIdx = -1;
  const budgetMs = () => 1000 / o.targetFps;

  const apply = (idx, reason) => {
    idx = clamp(idx, 0, tiers.length - 1); if (idx === perf.index) return false;
    const going = idx > perf.index ? 'down' : 'up'; const prev = perf.index; perf.index = idx; const t = tiers[idx]; perf.level = t.level; perf.recommendedPixelRatio = t.pr;
    perf.particleBudget = [0.4, 0.7, 1.0][clamp(t.level, 0, 2)];
    perf.lastChangeTime = perf.time; perf.changes++; perf.lastReason = reason;
    if (going === 'up') { lastUpTime = perf.time; lastUpIdx = idx; }
    else if (prev >= 0 && lastUpIdx >= 0 && perf.time - lastUpTime < o.probeWindow && prev === lastUpIdx) { // the probe failed: block that tier with backoff
      fails[prev]++; blocked[prev] = perf.time + Math.min(o.maxBlock, o.blockBase * Math.pow(2, fails[prev] - 1)); lastUpIdx = -1;
    }
    n = 0; head = 0; sinceEval = 0; over = 0; stableTime = 0; headTime = 0; warm = 10; // refill the window after any change
    if (perf.onChange) perf.onChange(perf, going, reason);
    return true;
  };
  const start = (o.startLevel !== undefined || o.startPixelRatio !== undefined) ? nearest(o.startLevel ?? hi, o.startPixelRatio ?? maxPR) : 0;
  apply(start, 'start'); perf.changes = 0; perf.lastChangeTime = -1e9;

  /** feed one frame time (ms). optional gpuMs = measured GPU time of the frame (EXT_disjoint_timer_query) enables precise headroom detection. Returns true if the recommendation changed. */
  perf.sample = (dtMs, gpuMs) => {
    if (!(dtMs > 0)) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    perf.time += dtMs / 1000; perf.frames++;
    if (dtMs > o.spikeMs) { perf.hitches++; return false; } // tab switch / long GC / shader compile: not representative of steady state
    if (warm > 0) { warm--; return false; }
    const b = budgetMs();
    buf[head] = Math.min(dtMs, b * 4); head = (head + 1) % o.window; if (n < o.window) n++;
    if (n < Math.min(o.window, 24)) return false;
    if (++sinceEval < o.evalEvery) return false; sinceEval = 0;
    // robust statistics over the window
    let sum = 0, slow = 0; for (let i = 0; i < n; i++) { const v = buf[i]; scratch[i] = v; sum += v; if (v > b * 1.5) slow++; }
    for (let i = 1; i < n; i++) { const v = scratch[i]; let j = i - 1; while (j >= 0 && scratch[j] > v) { scratch[j + 1] = scratch[j]; j--; } scratch[j + 1] = v; }
    perf.medMs = scratch[n >> 1]; perf.avgMs = sum / n; perf.fps = 1000 / perf.avgMs; perf.slowFrac = slow / n;
    const sinceChange = perf.time - perf.lastChangeTime; const dur = o.evalEvery * perf.avgMs / 1000;
    const overloaded = perf.medMs > b * o.overload || perf.slowFrac > 0.22;
    if (overloaded) {
      stableTime = 0; headTime = 0; over++;
      const severe = perf.medMs > b * 2.0;
      if ((severe && sinceChange > 0.25) || (over >= o.downHold && sinceChange > o.cooldownDown)) { const steps = perf.medMs > b * 3.2 ? 3 : severe ? 2 : 1; return apply(perf.index + steps, 'overload ' + perf.medMs.toFixed(1) + 'ms'); }
      return false;
    }
    over = 0;
    const gpu = gpuMs !== undefined ? gpuMs : perf.medMs;
    const hasSlack = gpu < b * o.headroom;                     // genuinely short frames (or measured GPU time)
    const onBudget = perf.slowFrac < 0.05 && perf.medMs <= b * 1.06; // vsync-capped but never missing
    if (hasSlack) headTime += dur; else headTime = 0;
    if (onBudget) stableTime += dur; else stableTime = 0;
    const idx = perf.index - 1;
    if (idx >= 0 && sinceChange >= o.cooldownUp && perf.time >= blocked[idx]) {
      if (hasSlack && headTime >= o.upHold) return apply(idx, 'headroom ' + gpu.toFixed(1) + 'ms');
      if (!hasSlack && onBudget && stableTime >= o.probeHold && perf.index > 0) return apply(idx, 'probe');
    }
    return false;
  };
  perf.reset = () => { n = 0; head = 0; sinceEval = 0; over = 0; stableTime = 0; headTime = 0; warm = 10; return perf; };
  perf.setTarget = (fps) => { o.targetFps = fps; return perf.reset(); };
  perf.force = (level, pr) => apply(nearest(level, pr ?? tiers[perf.index].pr), 'forced');
  perf.stats = () => ({ avgMs: perf.avgMs, medMs: perf.medMs, fps: perf.fps, slowFrac: perf.slowFrac, level: perf.level, pixelRatio: perf.recommendedPixelRatio, tier: perf.index, tiers: tiers.length, changes: perf.changes, hitches: perf.hitches });
  return perf;
}
