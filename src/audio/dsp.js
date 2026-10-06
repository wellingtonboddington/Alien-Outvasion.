// Low-level DSP helpers shared by the audio modules: pitch maths, cached noise/curve/IR buffers, envelope helpers, and `Syn`,
// a tiny node-tracking voice builder that stops + disconnects everything when its last source ends (so nothing leaks).
// Pure WebAudio, no samples.  Everything random goes through the seeded RNG from engine/common.js.
import { RNG, hashStr } from '../engine/common.js';

export { RNG, hashStr };
export const TAU = Math.PI * 2;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const ftom = (f) => 69 + 12 * Math.log2(f / 440);
export const dbg = (db) => Math.pow(10, db / 20);
export const lin = (a, b, t) => a + (b - a) * t;
export const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const sstep = (a, b, v) => { if (a === b) return v >= b ? 1 : 0; const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };
/** never hand NaN/Infinity/<=0 to an AudioParam ramp */
export const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
export const pos = (v, floor = 1e-4) => (Number.isFinite(v) && v > floor ? v : floor);

const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C#3' -> midi (C4 = 60) ; plain pitch class names ('F#') return the pc 0..11 */
export function noteNum(s) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)?$/.exec(s); if (!m) return 0;
  const pc = NOTE_PC[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return m[3] === undefined ? ((pc % 12) + 12) % 12 : (parseInt(m[3], 10) + 1) * 12 + pc;
}

/* ------------------------------------------------------------------ per-context caches */
const store = new WeakMap();
export function cache(ctx) { let c = store.get(ctx); if (!c) store.set(ctx, (c = {})); return c; }

/**
 * Looping noise buffer (mono, seamless). kind: white | pink | brown | velvet (sparse impulses) | crackle.
 * Cached per context; one 3 s buffer per colour is plenty because every user starts it at a random offset.
 */
export function noiseBuffer(ctx, kind = 'white', secs = 3) {
  const c = cache(ctx); const key = 'noise:' + kind + ':' + secs; if (c[key]) return c[key];
  const sr = ctx.sampleRate, N = Math.floor(secs * sr), F = Math.floor(0.2 * sr), tot = N + F;
  const rng = new RNG(hashStr('noise-' + kind));
  const g = new Float32Array(tot);
  if (kind === 'white') { for (let i = 0; i < tot; i++) g[i] = rng.next() * 2 - 1; }
  else if (kind === 'pink') { // Paul Kellet's economy pink filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < tot; i++) {
      const w = rng.next() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      g[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.18; b6 = w * 0.115926;
    }
  } else if (kind === 'brown') {
    let y = 0; for (let i = 0; i < tot; i++) { y = y * 0.985 + (rng.next() * 2 - 1) * 0.12; g[i] = y; }
  } else if (kind === 'velvet') { // sparse +-1 impulses, ~ 2000 / s — raw material for crackle/rain/fire
    for (let i = 0; i < tot; i++) g[i] = rng.next() < 2000 / sr ? (rng.next() < 0.5 ? -1 : 1) * (0.3 + 0.7 * rng.next()) : 0;
  } else if (kind === 'crackle') { // clustered pops with random amplitude: ~60 pops / s
    for (let i = 0; i < tot; i++) { const r = rng.next(); g[i] = r < 60 / sr ? (rng.next() * 2 - 1) * (0.2 + rng.next() * 0.8) : 0; }
    // soften each pop into a few samples of ring
    let a = 0; for (let i = 0; i < tot; i++) { a = a * 0.5 + g[i]; g[i] = a; }
  }
  const buf = ctx.createBuffer(1, N, sr); const d = buf.getChannelData(0);
  for (let i = 0; i < N; i++) d[i] = g[i];
  for (let i = 0; i < F; i++) { const w = i / F; d[i] = g[i] * Math.sqrt(w) + g[N + i] * Math.sqrt(1 - w); } // equal-power seam
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(d[i])); const s = (kind === 'velvet' || kind === 'crackle' ? 0.95 : 0.9) / (pk || 1);
  for (let i = 0; i < N; i++) d[i] *= s;
  c[key] = buf; return buf;
}

/** Shared waveshaper curves (context independent). */
const curves = new Map();
export function curve(kind = 'tanh', amt = 3) {
  const key = kind + amt; let c = curves.get(key); if (c) return c;
  const n = 2049; c = new Float32Array(n);
  const tn = Math.tanh(amt) || 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1; let y = x;
    switch (kind) {
      case 'tanh': y = Math.tanh(x * amt) / tn; break;
      case 'asym': y = x >= 0 ? Math.tanh(x * amt) / tn : Math.tanh(x * amt * 0.5) / Math.tanh(amt * 0.5) * 0.85; break;
      case 'hard': y = Math.max(-1, Math.min(1, x * amt)); break;
      case 'fold': y = Math.sin(x * amt * Math.PI * 0.5); break;
      case 'crush': y = Math.round(x * amt) / amt; break;
      case 'tube': y = Math.tanh(x * amt + 0.2 * x * x * amt) / tn - 0.0; break;
      case 'rect': y = Math.abs(x) * 2 - 1; break; // full-wave rectifier (octave-up buzz)
      case 'safe': { // final stage: transparent below 0.8, smooth knee, asymptotically <1 (domain +-2 via 0.5 pre-gain)
        const u = x * 2, a = Math.abs(u); y = Math.sign(u) * (a < 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); break;
      }
      default: y = x;
    }
    c[i] = y;
  }
  curves.set(key, c); return c;
}

/**
 * Procedural stereo impulse response for a ConvolverNode (no samples shipped).
 * Early reflections + diffuse tail whose brightness falls with time (air/wall absorption).
 */
export function makeIR(ctx, { secs = 2.5, rt60 = 2.2, pre = 0.012, bright = 0.8, dark = 0.05, early = 8, seed = 1, width = 1, fade = 0.02, curvePow = 1 } = {}) {
  const c = cache(ctx); const key = `ir:${secs}:${rt60}:${pre}:${bright}:${dark}:${early}:${seed}`; if (c[key]) return c[key];
  const sr = ctx.sampleRate, N = Math.max(256, Math.floor(secs * sr)); const buf = ctx.createBuffer(2, N, sr);
  for (let ch = 0; ch < 2; ch++) {
    const rng = new RNG(hashStr('ir') + seed * 977 + ch * 31); const d = buf.getChannelData(ch);
    let y = 0, y2 = 0; const p0 = Math.floor(pre * sr);
    for (let i = p0; i < N; i++) {
      const t = (i - p0) / sr;
      const env = Math.pow(10, (-3 * t) / rt60) * Math.min(1, t / fade) ;
      const k = dark + (bright - dark) * Math.exp(-t * (3.2 / Math.max(0.4, rt60 * 0.5)) * curvePow); // one-pole lowpass coef falls with time
      const x = rng.next() * 2 - 1;
      y += k * (x - y); y2 += Math.min(1, k * 1.6) * (y - y2);
      d[i] = y2 * env * 3.2;
    }
    // early reflections: sparse decorrelated taps
    for (let e = 0; e < early; e++) {
      const tt = pre + 0.006 + rng.next() * 0.06 + e * 0.004; const idx = Math.floor(tt * sr);
      if (idx < N) d[idx] += (rng.next() < 0.5 ? -1 : 1) * (0.5 - e * 0.04) * (0.6 + 0.4 * rng.next()) * (ch === 0 ? 1 + (width - 1) * 0.5 : 1 - (width - 1) * 0.5) * 0.9;
    }
    // gentle fade to 0 at the very end
    const tailN = Math.floor(0.08 * sr); for (let i = 0; i < tailN && N - 1 - i >= 0; i++) d[N - 1 - i] *= i / tailN;
  }
  c[key] = buf; return buf;
}

/** cached tiny helper buffers */
export function silentBuffer(ctx) { const c = cache(ctx); return c.silent || (c.silent = ctx.createBuffer(1, 1, ctx.sampleRate)); }

/**
 * Karplus-Strong plucked-string buffer rendered once per (pitch,decay,bright) and cached.
 * Used by harp/pizzicato/guitar-ish voices. ~1 ms of JS per note.
 */
export function ksBuffer(ctx, freq, { decay = 0.996, bright = 0.5, secs = 2.2, seed = 1 } = {}) {
  const c = cache(ctx); const key = `ks:${Math.round(freq * 10)}:${decay}:${bright}:${secs}`; if (c[key]) return c[key];
  const sr = ctx.sampleRate; const N = Math.floor(secs * sr);
  const damp = 0.5 + 0.4 * bright; // weight on the current sample (0.5 = darkest/strongest averaging)
  const L = Math.max(2, Math.round(sr / freq - (1 - damp))); const buf = ctx.createBuffer(1, N, sr); const d = buf.getChannelData(0);
  buf._f = sr / (L + (1 - damp)); // true fundamental -> callers retune with playbackRate = wanted / buf._f
  const rng = new RNG(hashStr('ks') + Math.round(freq) + seed);
  const ring = new Float32Array(L); let lp = 0;
  for (let i = 0; i < L; i++) { const w = rng.next() * 2 - 1; lp += (0.25 + 0.75 * bright) * (w - lp); ring[i] = lp; } // excitation: pre-filtered noise burst
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const cur = ring[idx]; d[i] = cur;
    const nxt = ring[(idx + 1) % L]; ring[idx] = (cur * damp + nxt * (1 - damp)) * decay; idx = (idx + 1) % L;
  }
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(d[i])); const s = 0.9 / (pk || 1); for (let i = 0; i < N; i++) d[i] *= s;
  c[key] = buf; (c.ksKeys || (c.ksKeys = [])).push(key); if (c.ksKeys.length > 40) c[c.ksKeys.shift()] = undefined; // LRU cap: keep memory bounded on phones
  return buf;
}

/* ------------------------------------------------------------------ envelopes */
/** instant attack, exponential decay (time constant tc). Starts at `t`. */
export function pluckEnv(p, t, peak, tc, atk = 0.002) {
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + atk); p.setTargetAtTime(0, t + atk, Math.max(0.002, tc));
}
/** ADSR on a gain param. `hold` = note-on duration from t. Returns the time the note is fully silent. */
export function adsr(p, t, peak, a, d, s, hold, r) {
  a = Math.max(0.002, a); hold = Math.max(a + 0.004, hold);
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(peak * s, t + a, Math.max(0.005, d / 3));
  p.setTargetAtTime(0, t + hold, Math.max(0.005, r / 3));
  return t + hold + r * 1.5;
}
/** exponential sweep from→to over dur starting at t */
export function sweep(p, t, from, to, dur, exp = true) {
  if (exp) { p.setValueAtTime(pos(from), t); p.exponentialRampToValueAtTime(pos(to), t + Math.max(0.001, dur)); }
  else { p.setValueAtTime(from, t); p.linearRampToValueAtTime(to, t + Math.max(0.001, dur)); }
}
/** value curve helper: piecewise linear through [[dt,value],...] */
export function line(p, t, pts) { p.setValueAtTime(pts[0][1], t + pts[0][0]); for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i][1], t + pts[i][0]); }

/* ------------------------------------------------------------------ Syn: tracked voice builder */
/**
 * A short-lived collection of nodes.  Every source created through it is counted; when the last one ends all nodes are
 * disconnected and the live-voice counter for `cat` is decremented.  Sources must be given a stop time (or stopAt() later).
 */
export class Syn {
  constructor(A, out, t0, cat = 'sfx', pitchCtl = null) {
    this.A = A; this.ctx = A.ctx; this.out = out; this.t0 = t0 === undefined ? A.now() : t0; this.nodes = []; this.srcs = []; this.alive = 0;
    this.cat = cat; this.pitchCtl = pitchCtl; this.links = []; this.dead = false; this.tEnd = this.t0; this.onDone = null;
    if (A.live) A.live[cat] = (A.live[cat] || 0) + 1;
    this.counted = true; this.open = false;
    (A.syns || (A.syns = new Set())).add(this); // registry: the engine sweeps leaked voices and recounts A.live from it
  }
  _reg(n) { this.nodes.push(n); return n; }
  g(v = 1, dest) { const n = this._reg(this.ctx.createGain()); n.gain.value = v; if (dest) n.connect(dest); return n; }
  /** biquad: type, freq, Q, [gain dB] */
  f(type, freq, q = 1, gdb = 0) { const n = this._reg(this.ctx.createBiquadFilter()); n.type = type; n.frequency.value = pos(freq, 10); n.Q.value = q; n.gain.value = gdb; return n; }
  shaper(kind, amt, os = 'none') { const n = this._reg(this.ctx.createWaveShaper()); n.curve = curve(kind, amt); n.oversample = os; return n; }
  delay(secs, max = 1) { const n = this._reg(this.ctx.createDelay(Math.max(max, secs + 0.01))); n.delayTime.value = secs; return n; }
  pan(v) { if (!this.ctx.createStereoPanner) return this.g(1); const n = this._reg(this.ctx.createStereoPanner()); n.pan.value = cl(v, -1, 1); return n; }
  _src(s, t, d) {
    try { s.start(Number.isFinite(t) ? t : this.A.now()); } catch (e) { return s; } // a failed start would never fire onended (leaked voice)
    this.srcs.push(s); this.alive++; s.onended = () => { if (--this.alive <= 0) this.dispose(); };
    if (d !== undefined && d !== null && Number.isFinite(d)) { try { s.stop(t + d); } catch (e) { /* */ } this.tEnd = Math.max(this.tEnd, t + d); } else this.open = true;
    if (this.pitchCtl && s.detune) this.mod(this.pitchCtl, s.detune);
    return s;
  }
  /** connect a modulator node to an AudioParam of one of our nodes; the link is removed again on dispose (no leaks on long-lived LFOs) */
  mod(src, param) { try { src.connect(param); this.links.push([src, param]); } catch (e) { /* */ } }
  /** oscillator; d = duration (seconds) from t */
  o(type, freq, t, d) { const s = this.ctx.createOscillator(); s.type = type; s.frequency.value = pos(freq, 0.01); this.nodes.push(s); return this._src(s, t, d); }
  /** custom periodic wave oscillator */
  ow(wave, freq, t, d) { const s = this.ctx.createOscillator(); s.setPeriodicWave(wave); s.frequency.value = pos(freq, 0.01); this.nodes.push(s); return this._src(s, t, d); }
  /** looped noise source starting at a random offset */
  n(kind, t, d, rate = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = noiseBuffer(this.ctx, kind); s.loop = true; s.playbackRate.value = rate; this.nodes.push(s);
    const off = this.A.rng.next() * 2.5; try { s.start(Number.isFinite(t) ? t : this.A.now(), off); } catch (e) { return s; } this.srcs.push(s); this.alive++; s.onended = () => { if (--this.alive <= 0) this.dispose(); };
    if (d !== undefined && d !== null && Number.isFinite(d)) { try { s.stop(t + d); } catch (e) { /* */ } this.tEnd = Math.max(this.tEnd, t + d); } else this.open = true;
    if (this.pitchCtl && s.detune) this.mod(this.pitchCtl, s.detune);
    return s;
  }
  /** one-shot buffer (KS pluck etc.) */
  buf(buffer, t, d, rate = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.playbackRate.value = rate; this.nodes.push(s);
    try { s.start(Number.isFinite(t) ? t : this.A.now()); } catch (e) { return s; } this.srcs.push(s); this.alive++; s.onended = () => { if (--this.alive <= 0) this.dispose(); };
    if (d !== undefined && d !== null && Number.isFinite(d)) { try { s.stop(t + d); } catch (e) { /* */ } this.tEnd = Math.max(this.tEnd, t + d); } else this.open = true;
    return s;
  }
  /** constant source (control signal) */
  c(v, t, d) { const s = this.ctx.createConstantSource(); s.offset.value = v; this.nodes.push(s); return this._src(s, t, d); }
  /** wire a chain a->b->c ... returns the last node */
  chain(...ns) { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; }
  /** stop every source at absolute time t */
  stopAt(t) { for (const s of this.srcs) { try { s.stop(t); } catch (e) { /* already stopped */ } } this.tEnd = Math.max(this.tEnd, t); this.open = false; }
  dispose() {
    if (this.dead) return; this.dead = true; if (this.A.syns) this.A.syns.delete(this);
    for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* */ } }
    this.nodes.length = 0; this.srcs.length = 0;
    if (this.counted && this.A.live) { this.A.live[this.cat] = Math.max(0, (this.A.live[this.cat] || 1) - 1); this.counted = false; }
    if (this.onDone) { const f = this.onDone; this.onDone = null; f(); }
  }
}

/** LFO helper: oscillator -> gain(depth) -> param.  Returns {osc,gain}. Must be stopped via the Syn. */
export function lfo(S, param, rate, depth, t, d, type = 'sine') {
  const o = S.o(type, rate, t, d); const g = S.g(depth); o.connect(g); g.connect(param); return { o, g };
}

/** formant sets (male-ish, Hz): F1,F2,F3 */
export const VOWELS = {
  a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010], o: [570, 840, 2410], u: [300, 870, 2240],
  ae: [660, 1720, 2410], er: [490, 1350, 1690], uh: [640, 1190, 2390], aw: [600, 1000, 2400],
};
