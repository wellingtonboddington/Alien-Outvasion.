// Text -> viseme track -> mouth parameters. Used by human faces AND alien faces so every talker moves its mouth in time with its line.
// Mouth parameter set (all 0..1 unless noted):
//   jaw    : jaw opening
//   wide   : lip corners pulled sideways (EE / smile-ish)
//   round  : lips pursed / rounded (OO / OH)
//   press  : lips pressed together (M / B / P)
//   tuck   : lower lip tucked under upper teeth (F / V)
//   teeth  : amount of teeth visible
//   tongue : tongue raised (L / T / D / N / TH)
export const MOUTH_KEYS = ['jaw', 'wide', 'round', 'press', 'tuck', 'teeth', 'tongue'];
const V = {
  rest: { jaw: 0, wide: 0, round: 0, press: 0.15, tuck: 0, teeth: 0, tongue: 0 },
  A: { jaw: 0.95, wide: 0.30, round: 0, press: 0, tuck: 0, teeth: 0.6, tongue: 0.1 },
  E: { jaw: 0.50, wide: 0.75, round: 0, press: 0, tuck: 0, teeth: 0.8, tongue: 0.3 },
  I: { jaw: 0.28, wide: 1.0, round: 0, press: 0, tuck: 0, teeth: 1.0, tongue: 0.5 },
  O: { jaw: 0.65, wide: 0, round: 0.85, press: 0, tuck: 0, teeth: 0.2, tongue: 0 },
  U: { jaw: 0.25, wide: 0, round: 1.0, press: 0, tuck: 0, teeth: 0, tongue: 0 },
  M: { jaw: 0, wide: 0.05, round: 0, press: 1.0, tuck: 0, teeth: 0, tongue: 0 },
  F: { jaw: 0.14, wide: 0.3, round: 0, press: 0, tuck: 1.0, teeth: 1.0, tongue: 0 },
  L: { jaw: 0.35, wide: 0.4, round: 0, press: 0, tuck: 0, teeth: 0.6, tongue: 1.0 },
  S: { jaw: 0.10, wide: 0.7, round: 0, press: 0, tuck: 0, teeth: 1.0, tongue: 0.2 },
  H: { jaw: 0.40, wide: 0.1, round: 0.4, press: 0, tuck: 0, teeth: 0.3, tongue: 0 },   // sh / ch / j
  K: { jaw: 0.38, wide: 0.2, round: 0.1, press: 0, tuck: 0, teeth: 0.3, tongue: 0.2 },
  W: { jaw: 0.22, wide: 0, round: 0.95, press: 0, tuck: 0, teeth: 0, tongue: 0 },
};
export const VISEMES = V;
const VOWELS = { a: 'A', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I',
  а: 'A', я: 'A', э: 'E', е: 'E', и: 'I', ы: 'I', о: 'O', ё: 'O', у: 'U', ю: 'U' };
const CONS = { b: 'M', p: 'M', m: 'M', f: 'F', v: 'F', l: 'L', t: 'L', d: 'L', n: 'L', r: 'H', s: 'S', z: 'S', c: 'S', x: 'S', j: 'H', k: 'K', g: 'K', q: 'K', h: 'K', w: 'W',
  б: 'M', п: 'M', м: 'M', ф: 'F', в: 'F', л: 'L', т: 'L', д: 'L', н: 'L', р: 'H', с: 'S', з: 'S', ц: 'S', ж: 'H', ш: 'H', щ: 'H', ч: 'H', к: 'K', г: 'K', х: 'K', й: 'I' };

/**
 * Build a viseme track for `text` spoken over `duration` seconds.
 * Returns {duration, keys:[{t0,t1,v,w}]}. Vowels get more time than consonants; punctuation inserts pauses.
 */
export function buildVisemeTrack(text, duration) {
  const s = text.toLowerCase().replace(/[‘’]/g, "'");
  const raw = []; let i = 0;
  while (i < s.length) {
    const c = s[i], two = s.substr(i, 2);
    if (two === 'th') { raw.push({ v: 'L', w: 0.55 }); i += 2; continue; }
    if (two === 'sh' || two === 'ch' || two === 'zh') { raw.push({ v: 'H', w: 0.65 }); i += 2; continue; }
    if (two === 'oo' || two === 'ou' || two === 'ew') { raw.push({ v: 'U', w: 1.25 }); i += 2; continue; }
    if (two === 'ee' || two === 'ea' || two === 'ie') { raw.push({ v: 'I', w: 1.2 }); i += 2; continue; }
    if (two === 'ng') { raw.push({ v: 'K', w: 0.5 }); i += 2; continue; }
    if (two === 'ph') { raw.push({ v: 'F', w: 0.6 }); i += 2; continue; }
    if (VOWELS[c]) { raw.push({ v: VOWELS[c], w: 1.0 }); i++; continue; }
    if (CONS[c]) { if (i > 0 && s[i - 1] === c) { i++; continue; } raw.push({ v: CONS[c], w: 0.5 }); i++; continue; }
    if (c === ' ') { raw.push({ v: 'rest', w: 0.35 }); i++; continue; }
    if (c === ',' || c === ';' || c === ':' || c === '—' || c === '-') { raw.push({ v: 'rest', w: 1.0 }); i++; continue; }
    if (c === '.' || c === '!' || c === '?' || c === '…') { raw.push({ v: 'rest', w: 1.6 }); i++; continue; }
    i++;
  }
  while (raw.length && raw[0].v === 'rest') raw.shift(); while (raw.length && raw[raw.length - 1].v === 'rest') raw.pop();
  const total = raw.reduce((a, k) => a + k.w, 0) || 1; let t = 0; const keys = [];
  for (const k of raw) { const d = (k.w / total) * duration; keys.push({ t0: t, t1: t + d, v: k.v, w: k.w }); t += d; }
  return { duration, keys, text };
}

const _tmp = {}; for (const k of MOUTH_KEYS) _tmp[k] = 0;
/**
 * Sample mouth parameters at time t (seconds from line start) into `out` (created if omitted). Includes co-articulation blending.
 * Outside the line the mouth returns to rest. `amp` (0..1) scales opening for shouting/whispering.
 */
export function sampleMouth(track, t, out = {}, amp = 1) {
  const keys = track?.keys; let a = V.rest, b = V.rest, f = 0;
  if (keys && t >= 0 && t <= track.duration) {
    // binary search
    let lo = 0, hi = keys.length - 1, idx = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid].t1 < t) lo = mid + 1; else if (keys[mid].t0 > t) hi = mid - 1; else { idx = mid; break; } idx = Math.min(lo, keys.length - 1); }
    const k = keys[idx]; const next = keys[idx + 1];
    a = V[k.v] || V.rest; const p = (t - k.t0) / Math.max(1e-4, k.t1 - k.t0);
    if (next && p > 0.55) { b = V[next.v] || V.rest; f = (p - 0.55) / 0.45 * 0.6; } else if (p < 0.3 && idx > 0) { b = V[keys[idx - 1].v] || V.rest; f = (0.3 - p) / 0.3 * 0.35; }
    // fast consonants should not fully dominate: keep a minimum articulation
  }
  for (const key of MOUTH_KEYS) { let v = a[key] + (b[key] - a[key]) * f; if (key === 'jaw' || key === 'wide' || key === 'round') v *= amp; out[key] = v; }
  return out;
}
/** 0..1 speech energy at time t (smoothed jaw activity) — drives beat gestures, head nods, breathing. */
export function speechEnergy(track, t) { if (!track || t < 0 || t > track.duration) return 0; sampleMouth(track, t, _tmp); return Math.min(1, _tmp.jaw * 0.8 + _tmp.round * 0.2 + _tmp.wide * 0.1) ; }
/** Estimated natural speaking duration (seconds) for text at a normal pace. Use to time dialogue. */
export function estimateDuration(text, wpm = 160) { const words = text.trim().split(/\s+/).length; const pauses = (text.match(/[.!?…]/g) || []).length * 0.35 + (text.match(/[,;:—]/g) || []).length * 0.18; return words * 60 / wpm + pauses + 0.15; }
