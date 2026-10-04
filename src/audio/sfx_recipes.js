// Procedural SFX recipes.  Each recipe is  fn(R, o) -> duration(seconds)  and builds a short-lived node graph with R.S (a Syn).
//   R.t0  start time          R.out  destination gain          R.rng  seeded RNG         R.F(f)/R.D(d)  pitch/time scaling from opts.pitch
//   R.sustain  true when a `cont` recipe is looped (steady sources, no stop time)       R.wet  [shortReverbSend, longReverbSend]
// Layering is the trick: noise + filtered oscillators + pitch drops + tails.  Levels are tuned so every recipe peaks ~0.5-0.9.
import { pluckEnv, adsr, sweep, line, mtof, noiseBuffer, curve, cl, lin, pos, cache, TAU, VOWELS, fin } from './dsp.js';

export const RECIPES = {};
const reg = (names, def, fn) => { for (const n of [].concat(names)) RECIPES[n] = { ...def, fn }; };

/* ------------------------------------------------------------------ building blocks */
/** filtered noise burst with exponential decay */
function nb(R, t, p = {}) {
  const { kind = 'white', type = 'lowpass', f0 = 2000, f1 = 0, q = 0.7, dur = 0.2, peak = 1, atk = 0.002, sw = 0, dest = R.out, rate = 1, pan = null } = p;
  const tc = p.tc || dur / 4.5; const S = R.S; const n = S.n(kind, t, atk + tc * 8 + 0.02, rate);
  const f = S.f(type, R.F(f0), q);
  if (f1) sweep(f.frequency, t, R.F(f0), R.F(f1), sw || dur);
  const g = S.g(0); pluckEnv(g.gain, t, peak, tc, atk); n.connect(f); f.connect(g);
  if (pan !== null) { const pn = S.pan(pan); g.connect(pn); pn.connect(dest); } else g.connect(dest);
  return g;
}
/** pitch-dropping sine/triangle thump (kick, boom, footstep body), optional saturation */
function th(R, t, p = {}) {
  const { f0 = 100, f1 = 40, dur = 0.4, peak = 1, atk = 0.002, drive = 0, type = 'sine', dest = R.out } = p; const tc = p.tc || dur / 4; const fd = p.fd || dur * 0.4;
  const S = R.S; const o = S.o(type, R.F(f0), t, atk + tc * 8 + 0.02); sweep(o.frequency, t, R.F(f0), R.F(f1), fd);
  const g = S.g(0); pluckEnv(g.gain, t, peak, tc, atk);
  if (drive > 0) { const sh = S.shaper('tanh', 1 + drive * 2); o.connect(sh); sh.connect(g); } else o.connect(g);
  g.connect(dest); return g;
}
/** inharmonic partial bank (metal, bells, glass) */
function ring(R, t, p = {}) {
  const { fs = [440, 1100, 1730], type = 'sine', dur = 0.6, peak = 0.3, decay = 1.0, dest = R.out, atk = 0.001, damp = 0.55 } = p; const S = R.S;
  const g = S.g(1); g.connect(dest);
  fs.forEach((f, i) => {
    const tc = (dur / 4.5) * Math.pow(damp, i * 0.5) * decay; const o = S.o(type, R.F(f), t, atk + tc * 8 + 0.02); const e = S.g(0);
    pluckEnv(e.gain, t, (peak / Math.sqrt(fs.length)) * Math.pow(0.78, i), tc, atk); o.connect(e); e.connect(g);
  });
  return g;
}
/** scatter n short events over `span` seconds, density decaying exponentially (debris, glass, crackle) */
function grains(R, t, n, span, fn, decayK = 2.6) {
  for (let i = 0; i < n; i++) {
    const u = R.rng.next(); const tt = decayK > 0 ? -Math.log(1 - u * (1 - Math.exp(-decayK))) / decayK : u; fn(t + tt * span, i, tt);
  }
}
/** source -> parallel bandpass formants (each {f0,f1,q,g}) sweeping over d -> dest */
function formants(R, src, t, d, list, dest) {
  const S = R.S; const sum = S.g(1); sum.connect(dest);
  for (const f of list) {
    const b = S.f('bandpass', R.F(f.f0), f.q || 8); if (f.f1 && f.f1 !== f.f0) sweep(b.frequency, t, R.F(f.f0), R.F(f.f1), d, true);
    const gg = S.g(f.g === undefined ? 1 : f.g); src.connect(b); b.connect(gg); gg.connect(sum);
  }
  return sum;
}
/** vocal-fold style source: glide f0 -> f1, jitter, vibrato, creaky amplitude pulses */
function vox(R, t, d, p = {}) {
  const { f0 = 120, f1 = f0, fm = 0, tm = 0.4, jit = 0.015, vib = 0, vibRate = 5.5, fry = 0, fryRate = 30, type = 'sawtooth', sub = 0, atk = 0.02 } = p; const S = R.S;
  const o = S.o(type, R.F(f0), t, d); const fp = o.frequency;
  fp.setValueAtTime(R.F(f0), t); if (fm) fp.exponentialRampToValueAtTime(R.F(fm), t + d * tm); fp.exponentialRampToValueAtTime(R.F(f1), t + d);
  const amp = S.g(1); o.connect(amp);
  if (jit) { const l1 = S.o('sine', 6.3 + R.rng.next() * 2, t, d), g1 = S.g(R.F(f0) * jit); l1.connect(g1); g1.connect(fp); const l2 = S.o('sine', 23 + R.rng.next() * 9, t, d), g2 = S.g(R.F(f0) * jit * 0.9); l2.connect(g2); g2.connect(fp); }
  if (vib) { const l = S.o('sine', vibRate, t, d), g = S.g(R.F(f0) * vib); l.connect(g); g.connect(fp); }
  if (sub) { const so = S.o('square', R.F(f0) * 0.5, t, d); so.frequency.setValueAtTime(R.F(f0) * 0.5, t); so.frequency.exponentialRampToValueAtTime(R.F(f1) * 0.5, t + d); const sg = S.g(sub); so.connect(sg); sg.connect(amp); }
  if (fry) { amp.gain.value = 1 - fry * 0.5; const l = S.o('square', fryRate, t, d), g = S.g(fry * 0.5); l.connect(g); g.connect(amp.gain); }
  return amp;
}
/** a single mechanical click/clack */
function click(R, t, f = 2800, peak = 0.6, q = 4, dest = R.out) {
  nb(R, t, { type: 'bandpass', f0: f, q, dur: 0.02, peak, tc: 0.004, dest });
  th(R, t, { f0: f * 0.45, f1: f * 0.2, dur: 0.03, peak: peak * 0.45, tc: 0.008, dest });
}
/** gain envelope that works for both finite and sustained (looped continuous) recipes */
function swell(R, g, peak, atk, rel, life, t = R.t0) {
  g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + atk);
  if (!R.sustain) { g.setValueAtTime(peak, Math.max(t + atk, t + life - rel)); g.linearRampToValueAtTime(0, t + life); }
}

/* ------------------------------------------------------------------ WEAPONS / LASERS */
reg('laser_fire', { wet: [0.12, 0.2], g: 0.8 }, (R, o) => {
  const S = R.S, t = R.t0, j = 1 + (R.rng.next() - 0.5) * 0.18; const long = !!o.long;
  if (long) { // sustained beam: swept resonant saws + crackle
    const D = R.D(o.dur || 1.6); const f = S.f('lowpass', 1800, 9); const g = S.g(0);
    const a = S.o('sawtooth', R.F(900 * j), t, D + 0.1), b = S.o('square', R.F(450 * j), t, D + 0.1);
    a.frequency.setValueAtTime(R.F(2200), t); a.frequency.exponentialRampToValueAtTime(R.F(520 * j), t + 0.25);
    const l = S.o('sine', 7, t, D + 0.1), lg = S.g(R.F(60)); l.connect(lg); lg.connect(a.frequency);
    const fl = S.o('sine', 3.1, t, D + 0.1), fg = S.g(900); fl.connect(fg); fg.connect(f.frequency); f.frequency.value = 2400;
    const bg = S.g(0.6); a.connect(f); b.connect(bg); bg.connect(f); f.connect(g); g.connect(R.out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.04); g.gain.setValueAtTime(0.5, t + D - 0.15); g.gain.linearRampToValueAtTime(0, t + D + 0.05);
    nb(R, t, { kind: 'white', type: 'highpass', f0: 5000, dur: D, peak: 0.12, tc: D * 0.8, atk: 0.01 });
    return D + 0.2;
  }
  const a = S.o('sawtooth', R.F(2800 * j), t, 0.4); a.frequency.exponentialRampToValueAtTime(R.F(210 * j), t + 0.17);
  const f = S.f('lowpass', 6500, 10); sweep(f.frequency, t, 6500 * j, 480, 0.2); const g = S.g(0); pluckEnv(g.gain, t, 0.5, 0.06, 0.002);
  a.connect(f); f.connect(g); g.connect(R.out);
  const b = S.o('square', R.F(1400 * j), t, 0.35); b.frequency.exponentialRampToValueAtTime(R.F(115 * j), t + 0.2);
  const g2 = S.g(0); pluckEnv(g2.gain, t, 0.22, 0.05, 0.002); b.connect(g2); g2.connect(R.out);
  const c = S.o('sine', R.F(5400 * j), t, 0.2); c.frequency.exponentialRampToValueAtTime(R.F(1900), t + 0.1); const g3 = S.g(0); pluckEnv(g3.gain, t, 0.12, 0.03); c.connect(g3); g3.connect(R.out);
  nb(R, t, { type: 'highpass', f0: 3200, dur: 0.03, peak: 0.45, tc: 0.006 });
  return 0.45;
});
reg('laser_beam', { wet: [0.12, 0.25], g: 0.8 }, (R, o) => RECIPES.laser_fire.fn(R, { ...o, long: true }));
reg('laser_hit', { wet: [0.15, 0.25], g: 0.8 }, (R) => {
  const t = R.t0;
  nb(R, t, { type: 'bandpass', f0: 5200, f1: 900, q: 3, dur: 0.28, peak: 0.6, tc: 0.07 });
  grains(R, t, 7, 0.22, (tt) => nb(R, tt, { type: 'highpass', f0: 2500 + R.rng.next() * 3000, dur: 0.012, peak: 0.3 * R.rng.next() + 0.1, tc: 0.003 }));
  const p = R.S.o('sine', R.F(1900), t, 0.3); p.frequency.exponentialRampToValueAtTime(R.F(950), t + 0.2); const g = R.S.g(0); pluckEnv(g.gain, t, 0.22, 0.06); p.connect(g); g.connect(R.out);
  th(R, t, { f0: 150, f1: 55, dur: 0.12, peak: 0.35 });
  return 0.5;
});

function rifleShot(R, t, k = 1, p = {}) {
  const j = 1 + (R.rng.next() - 0.5) * 0.14; const bright = p.bright || 1;
  nb(R, t, { type: 'highpass', f0: 2200 * j * bright, dur: 0.02, peak: 0.95 * k, tc: 0.0045, atk: 0.0005 });           // muzzle crack
  nb(R, t, { type: 'bandpass', f0: 3600 * j, q: 1, dur: 0.03, peak: 0.45 * k, tc: 0.007 });                              // supersonic snap
  th(R, t, { f0: 240 * j, f1: 62, dur: 0.12, peak: 0.85 * k, tc: 0.03, drive: 1.5, type: 'triangle' });                // chest thump
  nb(R, t, { type: 'bandpass', f0: 1100 * j, q: 0.8, dur: 0.22, peak: 0.55 * k, tc: 0.05 });                            // body
  if (!p.noTail) nb(R, t + 0.012, { type: 'lowpass', f0: 1200, f1: 260, dur: 0.7, peak: 0.22 * k, tc: 0.17, sw: 0.6, kind: 'pink' }); // slap/echo
}
reg('rifle', { wet: [0.1, 0.38], g: 0.8 }, (R) => { rifleShot(R, R.t0); return 1.4; });
reg('pistol', { wet: [0.1, 0.3], g: 0.75 }, (R) => { rifleShot(R, R.t0, 0.9, { bright: 1.25 }); return 1.0; });
reg('burst', { wet: [0.1, 0.38], g: 0.75 }, (R) => { const iv = R.D(0.085); for (let i = 0; i < 3; i++) rifleShot(R, R.t0 + i * iv, 1 - i * 0.06, { noTail: i < 2 }); return 3 * iv + 1.2; });
reg('mg', { wet: [0.1, 0.3], g: 0.7 }, (R, o) => { const iv = R.D(0.066), n = o.shots || 10; for (let i = 0; i < n; i++) rifleShot(R, R.t0 + i * iv + (R.rng.next() - 0.5) * 0.004, 0.75 + R.rng.next() * 0.25, { noTail: i < n - 1, bright: 0.9 }); R.period = n * iv; return n * iv + 0.9; });
reg('shotgun', { wet: [0.12, 0.4], g: 0.85 }, (R, o) => {
  const t = R.t0;
  nb(R, t, { type: 'highpass', f0: 900, dur: 0.05, peak: 0.9, tc: 0.012, atk: 0.0005 });
  nb(R, t, { type: 'bandpass', f0: 700, q: 0.6, dur: 0.34, peak: 0.95, tc: 0.08 });
  th(R, t, { f0: 170, f1: 48, dur: 0.28, peak: 1, tc: 0.07, drive: 2.5, type: 'triangle' });
  nb(R, t + 0.01, { kind: 'pink', type: 'lowpass', f0: 1400, f1: 220, dur: 1.1, peak: 0.3, tc: 0.27, sw: 0.9 });
  if (o.pump !== false) { click(R, t + 0.62, 2200, 0.55, 3); click(R, t + 0.78, 1700, 0.6, 3); nb(R, t + 0.64, { type: 'bandpass', f0: 1500, q: 2, dur: 0.12, peak: 0.12, tc: 0.03 }); }
  return 1.6;
});
reg('cannon', { wet: [0.15, 0.5], g: 0.9, vip: true }, (R) => {
  const t = R.t0;
  nb(R, t, { type: 'highpass', f0: 1200, dur: 0.05, peak: 0.9, tc: 0.012, atk: 0.0005 });
  th(R, t, { f0: 95, f1: 30, dur: 0.9, peak: 1, tc: 0.22, drive: 2.5 });
  nb(R, t, { type: 'lowpass', f0: 3500, f1: 200, dur: 0.7, peak: 0.85, tc: 0.17, sw: 0.5 });
  ring(R, t + 0.005, { fs: [220, 331, 517, 749], type: 'triangle', dur: 0.9, peak: 0.14, damp: 0.6 });
  nb(R, t + 0.03, { kind: 'brown', type: 'lowpass', f0: 420, f1: 70, dur: 2.6, peak: 0.5, tc: 0.7, sw: 2.2 });
  grains(R, t + 0.2, 8, 1.4, (tt) => nb(R, tt, { type: 'bandpass', f0: 800 + R.rng.next() * 2200, q: 1, dur: 0.05, peak: 0.1 * R.rng.next() }));
  return 3.2;
});
reg('reload', { wet: [0.1, 0.12], g: 0.8 }, (R) => {
  const t = R.t0; click(R, t, 2600, 0.6, 4); nb(R, t + 0.38, { type: 'bandpass', f0: 2600, f1: 900, q: 1.5, dur: 0.13, peak: 0.3, tc: 0.045, kind: 'pink' }); click(R, t + 0.62, 2000, 0.8, 3); click(R, t + 0.7, 3100, 0.4, 5); return 1.0;
});
reg('bullet_whiz', { wet: [0.05, 0.1], g: 0.7, doppler: true }, (R) => {
  const t = R.t0, S = R.S; const o = S.o('sine', R.F(3400), t, 0.4); o.frequency.exponentialRampToValueAtTime(R.F(1100), t + 0.28);
  const g = S.g(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.33); o.connect(g); g.connect(R.out);
  nb(R, t, { type: 'bandpass', f0: 3000, f1: 1000, q: 2.5, dur: 0.3, peak: 0.28, tc: 0.07, atk: 0.04 }); return 0.5;
});
reg('ricochet', { wet: [0.15, 0.3], g: 0.7 }, (R) => {
  const t = R.t0; nb(R, t, { type: 'highpass', f0: 3000, dur: 0.02, peak: 0.6, tc: 0.004 });
  const o = R.S.o('sine', R.F(2600), t, 0.6); o.frequency.exponentialRampToValueAtTime(R.F(700), t + 0.5); const g = R.S.g(0); pluckEnv(g.gain, t + 0.003, 0.25, 0.14); o.connect(g); g.connect(R.out);
  const m = R.S.o('sine', R.F(35), t, 0.6), mg = R.S.g(R.F(500)); m.connect(mg); mg.connect(o.frequency); return 0.8;
});
reg('grenade', { wet: [0.2, 0.4], g: 0.8 }, (R) => { RECIPES.explosion_small.fn(R, {}); click(R, R.t0 - 0.0, 1800, 0.2, 2); return 2.2; });

/* ------------------------------------------------------------------ EXPLOSIONS */
reg('explosion_small', { wet: [0.18, 0.35], g: 0.85 }, (R) => {
  const t = R.t0;
  nb(R, t, { type: 'highpass', f0: 1100, dur: 0.05, peak: 0.85, tc: 0.012, atk: 0.0005 });
  nb(R, t, { type: 'lowpass', f0: 6500, f1: 240, dur: 1.1, peak: 0.95, tc: 0.27, sw: 0.9 });
  th(R, t, { f0: 115, f1: 36, dur: 0.7, peak: 1, tc: 0.15, drive: 2 });
  nb(R, t + 0.02, { kind: 'brown', type: 'lowpass', f0: 420, f1: 80, dur: 2.0, peak: 0.55, tc: 0.55, sw: 1.8 });
  grains(R, t + 0.15, 14, 1.5, (tt) => nb(R, tt, { type: 'bandpass', f0: 900 + R.rng.next() * 3500, q: 1.2, dur: 0.04, peak: 0.14 * (0.3 + R.rng.next()), tc: 0.01 }), 2.2);
  return 2.6;
});
reg('explosion_big', { wet: [0.2, 0.5], g: 0.95, vip: true }, (R) => {
  const t = R.t0;
  nb(R, t, { type: 'highpass', f0: 800, dur: 0.07, peak: 0.8, tc: 0.016, atk: 0.0005 });
  nb(R, t, { type: 'lowpass', f0: 5200, f1: 130, dur: 2.6, peak: 1, tc: 0.7, sw: 2.2 });
  th(R, t, { f0: 72, f1: 24, dur: 1.6, peak: 1, tc: 0.4, drive: 2.5, fd: 0.7 });
  th(R, t + 0.02, { f0: 52, f1: 20, dur: 2.4, peak: 0.7, tc: 0.7, drive: 0, fd: 1.2 });
  nb(R, t + 0.12, { kind: 'pink', type: 'bandpass', f0: 220, q: 0.7, dur: 0.6, peak: 0.6, tc: 0.15 });
  nb(R, t + 0.05, { kind: 'brown', type: 'lowpass', f0: 320, f1: 55, dur: 5.0, peak: 0.65, tc: 1.35, sw: 4.5 });
  grains(R, t + 0.3, 30, 4.0, (tt) => { nb(R, tt, { type: 'bandpass', f0: 500 + R.rng.next() * 3500, q: 1.1, dur: 0.06, peak: 0.12 * (0.2 + R.rng.next()), tc: 0.012 }); if (R.rng.next() < 0.3) th(R, tt, { f0: 90, f1: 45, dur: 0.15, peak: 0.18, tc: 0.04 }); }, 1.8);
  return 6.0;
});
reg('explosion_far', { wet: [0.25, 0.6], g: 0.9, travel: true }, (R) => {
  const t = R.t0, S = R.S;
  nb(R, t, { kind: 'brown', type: 'lowpass', f0: 300, f1: 60, dur: 4.5, peak: 0.9, tc: 1.2, sw: 4, atk: 0.06 });
  th(R, t, { f0: 62, f1: 28, dur: 1.5, peak: 0.95, tc: 0.35, atk: 0.04 });
  nb(R, t + 0.6, { kind: 'brown', type: 'lowpass', f0: 240, f1: 55, dur: 3.5, peak: 0.4, tc: 1.0, sw: 3, atk: 0.2 });
  nb(R, t, { kind: 'pink', type: 'lowpass', f0: 1100, f1: 250, dur: 1.2, peak: 0.28, tc: 0.3, atk: 0.04 });
  grains(R, t + 0.4, 9, 3.5, (tt) => nb(R, tt, { type: 'bandpass', f0: 380 + R.rng.next() * 700, q: 1.4, dur: 0.07, peak: 0.1 * (0.3 + R.rng.next()), tc: 0.02 }), 1.5);
  return 6.5;
});
reg('nuke', { wet: [0.25, 0.75], g: 1.0, vip: true }, (R) => {
  const t = R.t0, S = R.S;
  nb(R, t, { type: 'highpass', f0: 3000, dur: 0.03, peak: 0.45, tc: 0.006, atk: 0.0005 });                      // flash 'tick' then held breath
  const sw0 = t + 0.32;
  nb(R, sw0, { type: 'lowpass', f0: 700, f1: 4500, dur: 0.55, peak: 0.85, tc: 0.22, atk: 0.12, sw: 0.35 });    // shockwave front
  nb(R, sw0 + 0.35, { type: 'lowpass', f0: 4500, f1: 110, dur: 4.2, peak: 1.0, tc: 1.1, sw: 3.6, atk: 0.01 });   // blast
  th(R, sw0 + 0.3, { f0: 62, f1: 22, dur: 3.2, peak: 1, tc: 0.9, drive: 2.5, fd: 1.4 });
  th(R, sw0 + 0.4, { f0: 40, f1: 17, dur: 7, peak: 0.85, tc: 2.2, fd: 3 });
  // rolling rumble with slow lobes
  const rumble = S.n('brown', sw0, 13.5); const rf = S.f('lowpass', 500, 0.8); sweep(rf.frequency, sw0, 520, 48, 12);
  const rg = S.g(0); rg.gain.setValueAtTime(0, sw0); rg.gain.linearRampToValueAtTime(0.85, sw0 + 0.9); rg.gain.setTargetAtTime(0, sw0 + 1.4, 3.6);
  const trem = S.o('sine', 9, sw0, 13.5), tg = S.g(0.13); trem.connect(tg); tg.connect(rg.gain); rumble.connect(rf); rf.connect(rg); rg.connect(R.out);
  [1.4, 3.1, 4.9, 6.8, 8.7].forEach((d, i) => nb(R, sw0 + d, { kind: 'brown', type: 'bandpass', f0: 210 - i * 22, q: 0.9, dur: 3.5, peak: 0.55 - i * 0.07, tc: 0.9, atk: 0.9 }));
  grains(R, sw0 + 0.8, 55, 10, (tt) => { nb(R, tt, { type: 'bandpass', f0: 400 + R.rng.next() * 2800, q: 1, dur: 0.07, peak: 0.1 * (0.2 + R.rng.next()), tc: 0.014 }); if (R.rng.next() < 0.25) th(R, tt, { f0: 85, f1: 40, dur: 0.2, peak: 0.16, tc: 0.05 }); }, 1.4);
  // tinnitus
  for (const [f, pk] of [[6200, 0.05], [8100, 0.025]]) { const o = S.o('sine', f, sw0 + 0.5, 10); const g = S.g(0); g.gain.setValueAtTime(0, sw0 + 0.5); g.gain.linearRampToValueAtTime(pk, sw0 + 1.2); g.gain.setTargetAtTime(0, sw0 + 2.5, 2.2); o.connect(g); g.connect(R.out); }
  return 15.5;
});
reg('missile_launch', { wet: [0.15, 0.45], g: 0.85, doppler: true }, (R) => {
  const t = R.t0, S = R.S; const D = 6.5;
  th(R, t, { f0: 95, f1: 38, dur: 0.5, peak: 0.9, tc: 0.12, drive: 1.5 });
  nb(R, t, { type: 'lowpass', f0: 2500, f1: 300, dur: 0.6, peak: 0.6, tc: 0.15, sw: 0.5 });
  // sustained rocket roar
  const n = S.n('pink', t + 0.05, D), f = S.f('bandpass', 700, 0.6); line(f.frequency, t + 0.05, [[0, 500], [1.6, 2300], [D, 260]]);
  const sh = S.shaper('tube', 3), g = S.g(0); g.gain.setValueAtTime(0, t + 0.05); g.gain.linearRampToValueAtTime(0.7, t + 0.45); g.gain.setValueAtTime(0.7, t + 2.4); g.gain.setTargetAtTime(0, t + 2.6, 1.3);
  n.connect(f); f.connect(sh); sh.connect(g); g.connect(R.out);
  const n2 = S.n('brown', t + 0.05, D), f2 = S.f('lowpass', 420, 0.7), g2 = S.g(0); n2.connect(f2); f2.connect(g2); g2.connect(R.out);
  g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.9, t + 0.5); g2.gain.setValueAtTime(0.9, t + 2.2); g2.gain.setTargetAtTime(0, t + 2.6, 1.4);
  const n3 = S.n('white', t + 0.1, D), f3 = S.f('highpass', 4200, 0.6), g3 = S.g(0), am = S.o('square', 85, t, D), amg = S.g(0.25); am.connect(amg); amg.connect(g3.gain);
  g3.gain.setValueAtTime(0, t); g3.gain.linearRampToValueAtTime(0.14, t + 0.6); g3.gain.setTargetAtTime(0, t + 2.2, 1.2); n3.connect(f3); f3.connect(g3); g3.connect(R.out);
  return D + 0.3;
});
reg('jet_pass', { wet: [0.1, 0.35], g: 0.85, doppler: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 7); const pk = D * 0.46; const dir = o.dir === -1 ? -1 : 1;
  const out = o.noPan || R.h.sp ? R.out : (() => { const p = S.pan(-0.85 * dir); line(p.pan, t, [[0, -0.85 * dir], [pk - 0.5, -0.5 * dir], [pk + 0.3, 0.55 * dir], [D, 0.9 * dir]]); p.connect(R.out); return p; })();
  const env = S.g(0); env.gain.setValueAtTime(0.01, t); env.gain.exponentialRampToValueAtTime(0.06, t + pk * 0.55); env.gain.exponentialRampToValueAtTime(1, t + pk); env.gain.exponentialRampToValueAtTime(0.1, t + pk + 1.3); env.gain.exponentialRampToValueAtTime(0.004, t + D); env.connect(out);
  const n = S.n('pink', t, D + 0.1), f = S.f('bandpass', 900, 0.9); line(f.frequency, t, [[0, 700], [pk - 0.4, 1500], [pk, 2300], [pk + 0.6, 800], [D, 380]]);
  const f2 = S.f('lowpass', 3000, 0.7); line(f2.frequency, t, [[0, 900], [pk, 6500], [pk + 0.8, 1800], [D, 500]]);
  n.connect(f); f.connect(f2); f2.connect(env);
  const w = S.o('sawtooth', 1500, t, D + 0.1); line(w.frequency, t, [[0, 1500 * 1.17], [pk - 0.15, 1500 * 1.17], [pk + 0.35, 1500 * 0.84], [D, 1500 * 0.82]]); const wf = S.f('bandpass', 1600, 9), wg = S.g(0.22); line(wf.frequency, t, [[0, 1750], [pk - 0.15, 1750], [pk + 0.35, 1260], [D, 1230]]);
  w.connect(wf); wf.connect(wg); wg.connect(env);
  const w2 = S.o('square', 330, t, D + 0.1); line(w2.frequency, t, [[0, 330 * 1.17], [pk - 0.1, 330 * 1.17], [pk + 0.4, 330 * 0.84], [D, 330 * 0.82]]); const w2f = S.f('lowpass', 900, 1), w2g = S.g(0.16); w2.connect(w2f); w2f.connect(w2g); w2g.connect(env);
  const r = S.n('brown', t, D + 0.1), rf = S.f('lowpass', 260, 0.7), rg = S.g(0.9); r.connect(rf); rf.connect(rg); rg.connect(env);
  R.period = D; return D + 0.2;
});
reg('afterburner', { wet: [0.1, 0.3], g: 0.8, cont: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 4.5); const dd = R.sustain ? undefined : D + 0.1;
  const env = S.g(0); swell(R, env.gain, 0.8, 0.5, 1.0, D); env.connect(R.out);
  const n = S.n('pink', t, dd), f = S.f('lowpass', 1500, 0.7); line(f.frequency, t, [[0, 700], [0.7, 1700], [Math.max(1, D), 1500]]); n.connect(f); f.connect(env);
  const n2 = S.n('brown', t, dd), f2 = S.f('lowpass', 240, 0.8), g2 = S.g(1); n2.connect(f2); f2.connect(g2); g2.connect(env);
  const tr = S.o('square', 52, t, dd), tg = S.g(0.22); tr.connect(tg); tg.connect(env.gain);
  const n3 = S.n('white', t, dd), f3 = S.f('bandpass', 3800, 0.8), g3 = S.g(0.11); n3.connect(f3); f3.connect(g3); g3.connect(env);
  R.period = D; return D + 0.2;
});

/* ------------------------------------------------------------------ ALIEN MACHINES & CREATURES */
function brassWave(ctx) { // band-limited brass-like spectrum (strong 3rd-8th harmonics)
  const c = cache(ctx); if (c.brass) return c.brass; const N = 48, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  for (let k = 1; k <= N; k++) im[k] = (1 / Math.pow(k, 0.85)) * (1 + 1.3 * Math.exp(-((k - 5) * (k - 5)) / 16));
  c.brass = ctx.createPeriodicWave(re, im, { disableNormalization: false }); return c.brass;
}
function hornTone(R, t, dur, f, peak, bend = 0) {
  const S = R.S; const out = S.g(0); const att = 0.14; const end = t + dur;
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(peak * 1.1, t + att); out.gain.setTargetAtTime(peak * 0.85, t + att, 0.2);
  out.gain.setTargetAtTime(0, end, 0.3);
  const trem = S.o('sine', 6.2, t, dur + 2), tremG = S.g(peak * 0.06); trem.connect(tremG); tremG.connect(out.gain);
  const gro = S.o('sine', 29, t, dur + 2), groG = S.g(peak * 0.1); gro.connect(groG); groG.connect(out.gain);
  const mix = S.g(0.5); const wave = brassWave(R.ctx);
  // main voice (3 slightly detuned copies) + a minor-second partner for the dissonant beating + a sine sub
  [[1, 0, 1], [1, 7, 0.8], [1, -7, 0.8], [1.0595, 0, 0.5], [1.0595, 6, 0.32], [0.5, 0, 0.55]].forEach(([r, dc, a], i) => {
    const o = i === 5 ? S.o('sine', f * r, t, dur + 2) : S.ow(wave, f * r, t, dur + 2); o.detune.value = dc; const fp = o.frequency, fr = f * r;
    fp.setValueAtTime(fr * 0.94, t); fp.exponentialRampToValueAtTime(fr, t + 0.3); fp.setValueAtTime(fr, end - 0.05); fp.exponentialRampToValueAtTime(fr * (0.82 - bend), end + 1.2);
    const gg = S.g(a); o.connect(gg); gg.connect(mix);
  });
  const sat = S.shaper('tanh', 1.7, '2x'); mix.connect(sat);
  const sum = S.g(1); sum.connect(out);
  const b1 = S.f('bandpass', 330, 3), b1g = S.g(1.0); line(b1.frequency, t, [[0, 360], [dur, 330], [dur + 1.2, 230]]); sat.connect(b1); b1.connect(b1g); b1g.connect(sum);
  const b2 = S.f('bandpass', 900, 3.5), b2g = S.g(0.8); line(b2.frequency, t, [[0, 1000], [dur, 880], [dur + 1.2, 560]]); sat.connect(b2); b2.connect(b2g); b2g.connect(sum);
  const b3 = S.f('bandpass', 1900, 3), b3g = S.g(0.3); sat.connect(b3); b3.connect(b3g); b3g.connect(sum);
  const lp = S.f('lowpass', 2800, 0.7), lg = S.g(0.5); sat.connect(lp); lp.connect(lg); lg.connect(sum);
  return out;
}
reg('tripod_horn', { wet: [0.25, 0.95], g: 0.85, vip: true }, (R, o) => {
  const t = R.t0, S = R.S; const pk = 0.9; const base = (o.freq || 65.4);
  const bus = S.g(1); // echo off the buildings: dark feedback delay
  const dry = S.g(1), wet = S.g(0.4); const dl = S.delay(0.43, 1), fb = S.g(0.42), flp = S.f('lowpass', 900, 0.6);
  bus.connect(dry); dry.connect(R.out); bus.connect(dl); dl.connect(flp); flp.connect(fb); fb.connect(dl); flp.connect(wet); wet.connect(R.out);
  const tone = (ts, d, f, p, bend) => { const g = hornTone(R, ts, d, f, p, bend); g.connect(bus); };
  tone(t, 2.6, base * 1.19, pk, 0.0);
  tone(t + 3.1, 3.5, base * 0.89, pk, 0.1); // second tone a minor third lower, longer, sinking
  // metallic reedy buzz on top for audibility on small speakers
  const nz = S.n('white', t, 7.2), nf = S.f('bandpass', 1900, 1.5), ng = S.g(0); line(ng.gain, t, [[0, 0], [0.3, 0.02], [2.7, 0.015], [2.9, 0], [3.2, 0], [3.5, 0.02], [6.6, 0.012], [7.0, 0]]); nz.connect(nf); nf.connect(ng); ng.connect(bus);
  R.period = 11; return 11.5;
});
reg('tripod_step', { wet: [0.2, 0.7], g: 0.9 }, (R) => {
  const t = R.t0;
  th(R, t, { f0: 80, f1: 25, dur: 0.9, peak: 1, tc: 0.22, drive: 2, fd: 0.35 });
  nb(R, t, { kind: 'brown', type: 'lowpass', f0: 260, f1: 60, dur: 1.4, peak: 0.7, tc: 0.35, sw: 1.2 });
  ring(R, t + 0.03, { fs: [138, 207, 331, 489], type: 'square', dur: 0.8, peak: 0.16, damp: 0.5 });
  const cr = R.S.o('sawtooth', R.F(190), t + 0.05, 0.9); cr.frequency.exponentialRampToValueAtTime(R.F(125), t + 0.8);
  const crf = R.S.f('bandpass', R.F(520), 7), crg = R.S.g(0); line(crg.gain, t + 0.05, [[0, 0], [0.12, 0.08], [0.6, 0.05], [0.85, 0]]); const vl = R.S.o('sine', 13, t, 1), vg = R.S.g(R.F(9)); vl.connect(vg); vg.connect(cr.frequency); cr.connect(crf); crf.connect(crg); crg.connect(R.out);
  grains(R, t + 0.05, 8, 0.9, (tt) => nb(R, tt, { type: 'bandpass', f0: 700 + R.rng.next() * 1800, q: 1.2, dur: 0.05, peak: 0.07 * R.rng.next(), tc: 0.01 }), 1.5);
  return 2.4;
});
reg('pod_whine', { wet: [0.15, 0.45], g: 0.55, cont: true, doppler: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 4); const dd = R.sustain ? undefined : D + 0.1; const env = S.g(0); swell(R, env.gain, 0.8, R.sustain ? 0.3 : 0.9, 0.9, D); env.connect(R.out);
  const a = S.o('sine', R.F(430), t, dd); if (!R.sustain) { a.frequency.setValueAtTime(R.F(300), t); a.frequency.exponentialRampToValueAtTime(R.F(520), t + 1.2); }
  const v = S.o('sine', 5.5, t, dd), vg = S.g(R.F(11)); v.connect(vg); vg.connect(a.frequency); const ag = S.g(0.5); a.connect(ag); ag.connect(env);
  const b = S.o('triangle', R.F(862), t, dd); const b2 = S.o('sine', R.F(861.2 * 1.5), t, dd); const bg = S.g(0.16), b2g = S.g(0.04); b.connect(bg); bg.connect(env); b2.connect(b2g); b2g.connect(env);
  const h = S.o('sawtooth', R.F(108), t, dd), hf = S.f('lowpass', 520, 1), hg = S.g(0.22); h.connect(hf); hf.connect(hg); hg.connect(env);
  const sh = S.o('sine', 9, t, dd), shg = S.g(0.08); sh.connect(shg); shg.connect(env.gain);
  const n = S.n('white', t, dd), nf = S.f('bandpass', 3100, 6), ng = S.g(0.035); n.connect(nf); nf.connect(ng); ng.connect(env);
  R.period = D; return D + 0.2;
});
reg('crawler_screech', { wet: [0.2, 0.35], g: 0.75 }, (R) => {
  const t = R.t0, S = R.S; const j = 1 + (R.rng.next() - 0.5) * 0.15; const D = 0.95;
  const out = S.g(0); line(out.gain, t, [[0, 0], [0.03, 0.8], [0.2, 0.7], [0.55, 0.5], [D, 0]]); out.connect(R.out);
  for (const [f, a] of [[2100, 1], [3150, 0.6]]) {
    const o = S.o('sawtooth', R.F(f * j), t, D); line(o.frequency, t, [[0, R.F(f * j * 0.75)], [0.18, R.F(f * j * 1.32)], [D, R.F(f * j * 0.62)]]);
    const am = S.g(0.5), l = S.o('sine', 68 + R.rng.next() * 10, t, D), lg = S.g(0.5); l.connect(lg); lg.connect(am.gain); o.connect(am);
    const bp = S.f('bandpass', R.F(f * 1.05), 3.5), ag = S.g(a * 0.5); am.connect(bp); bp.connect(ag); ag.connect(out);
  }
  nb(R, t, { type: 'highpass', f0: 3200, dur: D, peak: 0.18, tc: 0.3, dest: out });
  for (let i = 0; i < 5; i++) nb(R, t + i * 0.018, { type: 'bandpass', f0: 1500 + i * 130, q: 5, dur: 0.02, peak: 0.4, tc: 0.004 });
  return D + 0.2;
});
reg('alien_growl', { wet: [0.2, 0.55], g: 0.8 }, (R) => {
  const t = R.t0, S = R.S; const D = R.D(1.7);
  const out = S.g(0); line(out.gain, t, [[0, 0], [0.18, 0.9], [D * 0.65, 0.85], [D, 0]]); out.connect(R.out);
  const v = vox(R, t, D, { f0: 92, f1: 56, fm: 100, tm: 0.25, jit: 0.04, fry: 0.55, fryRate: 36, sub: 0.6 }); const sat = S.shaper('tube', 5); v.connect(sat);
  formants(R, sat, t, D, [{ f0: 450, f1: 880, q: 7 }, { f0: 1150, f1: 640, q: 8, g: 0.8 }, { f0: 2300, f1: 1800, q: 6, g: 0.35 }], out);
  const n = S.n('pink', t, D), nf = S.f('bandpass', 600, 1.2), ng = S.g(0.3); n.connect(nf); nf.connect(ng); ng.connect(out);
  const sub = S.o('sine', R.F(47), t, D), sg = S.g(0.35); sub.connect(sg); sg.connect(out);
  return D + 0.3;
});
reg('alien_click', { wet: [0.25, 0.45], g: 0.8 }, (R) => {
  const t = R.t0, S = R.S; const n = R.rng.int(7, 13); let tt = t; const p = S.pan(0); p.connect(R.out);
  for (let i = 0; i < n; i++) {
    const f = 900 + R.rng.next() * 2600; p.pan.setValueAtTime(R.rng.range(-0.6, 0.6), tt);
    nb(R, tt, { type: 'bandpass', f0: f, q: 11, dur: 0.02, peak: 0.85, tc: 0.0045, dest: p });
    th(R, tt, { f0: f * 0.5, f1: f * 0.28, dur: 0.03, peak: 0.3, tc: 0.009, dest: p });
    if (R.rng.next() < 0.22) { const o = S.o('sine', R.F(1100 + R.rng.next() * 700), tt + 0.02, 0.12); o.frequency.exponentialRampToValueAtTime(R.F(2300 + R.rng.next() * 900), tt + 0.1); const g = S.g(0); pluckEnv(g.gain, tt + 0.02, 0.12, 0.03); o.connect(g); g.connect(p); }
    tt += R.rng.pick([0.045, 0.06, 0.09, 0.09, 0.14, 0.2]);
  }
  return tt - t + 0.6;
});
reg('zombie_moan', { wet: [0.25, 0.3], g: 0.75 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(2.1); const j = 1 + (R.rng.next() - 0.5) * 0.2; const f0 = 105 * j;
  const out = S.g(0); line(out.gain, t, [[0, 0], [0.25, 0.8], [D * 0.6, 0.7], [D, 0]]); out.connect(R.out);
  const v = vox(R, t, D, { f0: f0 * 1.15, fm: f0 * 1.3, tm: 0.2, f1: f0 * 0.62, jit: 0.03, vib: 0.01, vibRate: 4.3, fry: 0.35, fryRate: 26 });
  formants(R, v, t, D, [{ f0: 560, f1: 480, q: 8 }, { f0: 980, f1: 820, q: 9, g: 0.8 }, { f0: 2400, f1: 2100, q: 6, g: 0.3 }], out);
  const n = S.n('white', t, D), g = S.g(0.5), fm = S.g(1); n.connect(g); formants(R, g, t, D, [{ f0: 600, q: 5 }, { f0: 1050, q: 5, g: 0.7 }], out);
  return D + 0.3;
});
reg('zombie_roar', { wet: [0.2, 0.4], g: 0.85 }, (R) => {
  const t = R.t0, S = R.S; const D = R.D(1.6); const j = 1 + (R.rng.next() - 0.5) * 0.18;
  const out = S.g(0); line(out.gain, t, [[0, 0], [0.04, 0.5], [0.12, 0.95], [D * 0.7, 0.8], [D, 0]]); out.connect(R.out);
  nb(R, t, { kind: 'pink', type: 'bandpass', f0: 1400, f1: 2400, q: 1, dur: 0.25, peak: 0.28, tc: 0.07, atk: 0.1, dest: out }); // inhale rasp
  const v = vox(R, t + 0.12, D - 0.12, { f0: 130 * j, fm: 175 * j, tm: 0.2, f1: 92 * j, jit: 0.05, fry: 0.5, fryRate: 52, sub: 0.7 }); const sat = S.shaper('tube', 7); v.connect(sat);
  formants(R, sat, t + 0.12, D - 0.12, [{ f0: 700, f1: 950, q: 5 }, { f0: 1250, f1: 1100, q: 6, g: 0.8 }, { f0: 2500, q: 5, g: 0.4 }], out);
  const n = S.n('white', t + 0.12, D - 0.12), g = S.g(0.55); n.connect(g); formants(R, g, t + 0.12, D - 0.12, [{ f0: 800, q: 3 }, { f0: 1500, q: 3, g: 0.8 }], out);
  return D + 0.3;
});
reg('zombie_cough', { wet: [0.2, 0.2], g: 0.8 }, (R) => {
  const t = R.t0; [[0, 1], [0.17, 0.8], [0.35, 0.6]].forEach(([d, k]) => {
    nb(R, t + d, { type: 'bandpass', f0: 700, q: 1.3, dur: 0.13, peak: 0.85 * k, tc: 0.03, atk: 0.004 });
    th(R, t + d, { f0: 125, f1: 78, dur: 0.12, peak: 0.45 * k, tc: 0.04 });
    const n = R.S.n('white', t + d, 0.2), f = R.S.f('bandpass', 2100, 3), g = R.S.g(0), am = R.S.o('square', 68, t + d, 0.2), ag = R.S.g(0.2); am.connect(ag); ag.connect(g.gain); pluckEnv(g.gain, t + d, 0.2 * k, 0.05); n.connect(f); f.connect(g); g.connect(R.out);
  });
  nb(R, t + 0.62, { kind: 'pink', type: 'bandpass', f0: 900, f1: 1800, q: 1.2, dur: 0.35, peak: 0.22, tc: 0.12, atk: 0.12 });
  return 1.1;
});
reg('infect_zap', { wet: [0.15, 0.3], g: 0.75 }, (R) => {
  const t = R.t0, S = R.S; const o = S.o('sawtooth', R.F(140), t, 0.9); o.frequency.exponentialRampToValueAtTime(R.F(900), t + 0.38); o.frequency.exponentialRampToValueAtTime(R.F(300), t + 0.85);
  const bp = S.f('bandpass', 700, 5), g = S.g(0), am = S.o('square', 120, t, 0.9), ag = S.g(0.4); am.connect(ag); ag.connect(g.gain); line(g.gain, t, [[0, 0], [0.04, 0.35], [0.4, 0.3], [0.85, 0]]); o.connect(bp); bp.connect(g); g.connect(R.out); sweep(bp.frequency, t, 500, 2600, 0.4);
  nb(R, t, { type: 'bandpass', f0: 800, f1: 6500, q: 1.4, dur: 0.55, peak: 0.3, tc: 0.14, atk: 0.04, sw: 0.45 });
  grains(R, t, 14, 0.7, (tt) => nb(R, tt, { type: 'highpass', f0: 2500 + R.rng.next() * 3000, dur: 0.01, peak: 0.35 * R.rng.next() + 0.1, tc: 0.0025 }), 1.2);
  th(R, t, { f0: 80, f1: 55, dur: 0.5, peak: 0.35, tc: 0.15, type: 'sine' });
  return 1.1;
});
reg('glitch', { wet: [0.05, 0.08], g: 0.7 }, (R) => {
  const t = R.t0, S = R.S; let tt = t; const out = S.g(0.6); const cr = S.shaper('crush', 6); cr.connect(out); out.connect(R.out);
  const slots = R.rng.int(8, 14);
  for (let i = 0; i < slots; i++) {
    const k = R.rng.next(), d = R.rng.pick([0.025, 0.04, 0.06, 0.09]);
    if (k < 0.35) { const o = S.o(R.rng.pick(['square', 'sawtooth']), R.rng.range(180, 4200), tt, d); const g = S.g(0); line(g.gain, tt, [[0, 0.5], [d, 0.5], [d + 0.002, 0]]); o.connect(g); g.connect(cr); }
    else if (k < 0.65) nb(R, tt, { type: 'highpass', f0: R.rng.range(800, 6000), dur: d, peak: 0.6, tc: d / 3, dest: cr });
    else if (k < 0.8) { const o = S.o('sawtooth', 3200, tt, d); o.frequency.exponentialRampToValueAtTime(700, tt + d); const g = S.g(0.35); o.connect(g); g.connect(cr); }
    tt += d + R.rng.pick([0, 0.01, 0.03, 0.06]);
  }
  return tt - t + 0.2;
});
reg('static', { wet: [0.05, 0.08], g: 0.5, cont: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 2.5); const dd = R.sustain ? undefined : D + 0.05; const env = S.g(0); swell(R, env.gain, 0.7, 0.03, 0.05, D); env.connect(R.out);
  const n = S.n('white', t, dd), f = S.f('bandpass', 1900, 0.35), hp = S.f('highpass', 400, 0.7); n.connect(f); f.connect(hp); hp.connect(env);
  const c = S.n('crackle', t, dd), cf = S.f('bandpass', 3200, 0.7), cg = S.g(0.9); c.connect(cf); cf.connect(cg); cg.connect(env);
  const am = S.o('sine', 0.9, t, dd), ag = S.g(0.22); am.connect(ag); ag.connect(env.gain);
  const am2 = S.o('sine', 7.7, t, dd), ag2 = S.g(0.1); am2.connect(ag2); ag2.connect(env.gain);
  R.period = D; return D + 0.1;
});
reg('alarm', { wet: [0.15, 0.3], g: 0.5 }, (R, o) => {
  const t = R.t0, S = R.S; const seg = R.D(0.34); const n = 6; const lo = o.low || 660, hi = o.high || 880;
  const lp = S.f('lowpass', 2600, 0.7); lp.connect(R.out);
  for (let i = 0; i < n; i++) {
    const ts = t + i * seg; const f = i % 2 ? lo : hi; const osc = S.o('square', R.F(f), ts, seg + 0.01);
    const g = S.g(0); g.gain.setValueAtTime(0, ts); g.gain.linearRampToValueAtTime(0.6, ts + 0.012); g.gain.setValueAtTime(0.6, ts + seg - 0.02); g.gain.linearRampToValueAtTime(0, ts + seg);
    const s2 = S.o('sine', R.F(f * 2.01), ts, seg + 0.01), g2 = S.g(0.18); s2.connect(g2); g2.connect(g); osc.connect(g); g.connect(lp);
  }
  R.period = n * seg; return n * seg + 0.3;
});
reg('siren', { wet: [0.2, 0.55], g: 0.5, cont: true, doppler: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 6.4); const dd = R.sustain ? undefined : D + 0.05; const yelp = o.kind === 'yelp';
  const env = S.g(0); swell(R, env.gain, 0.8, 0.15, 0.4, D); env.connect(R.out);
  const osc = S.o('sawtooth', R.F(930), t, dd); const lf = S.o('triangle', yelp ? 3.1 : 0.31, t, dd), lg = S.g(R.F(yelp ? 300 : 330)); lf.connect(lg); lg.connect(osc.frequency);
  const f = S.f('lowpass', 2800, 0.8), sh = S.shaper('tanh', 2); osc.connect(sh); sh.connect(f); f.connect(env);
  const o2 = S.o('sine', R.F(1860), t, dd), g2 = S.g(0.12); lg.connect(o2.frequency); o2.connect(g2); g2.connect(env);
  R.period = D; return D + 0.3;
});
reg('door', { wet: [0.2, 0.2], g: 0.8 }, (R, o) => {
  const t = R.t0;
  if (o.kind === 'creak') return RECIPES.door_open.fn(R, o);
  th(R, t, { f0: 105, f1: 50, dur: 0.18, peak: 0.9, tc: 0.045, drive: 1 });
  nb(R, t, { type: 'lowpass', f0: 900, f1: 300, dur: 0.22, peak: 0.6, tc: 0.05, kind: 'pink' });
  nb(R, t + 0.012, { type: 'bandpass', f0: 2200, q: 3, dur: 0.03, peak: 0.28, tc: 0.007 }); click(R, t + 0.06, 3000, 0.3, 6);
  ring(R, t + 0.003, { fs: [160, 290, 410], type: 'triangle', dur: 0.4, peak: 0.12, damp: 0.5 });
  return 0.9;
});
reg('door_open', { wet: [0.2, 0.2], g: 0.7 }, (R) => {
  const t = R.t0, S = R.S; click(R, t, 2400, 0.45, 5);
  const o = S.o('sawtooth', R.F(95), t + 0.08, 1.2); line(o.frequency, t + 0.08, [[0, R.F(95)], [0.4, R.F(180)], [0.9, R.F(150)]]);
  const f = S.f('bandpass', 520, 9), g = S.g(0); line(g.gain, t + 0.08, [[0, 0], [0.1, 0.16], [0.9, 0.12], [1.05, 0]]); const v = S.o('sine', 11, t, 1.4), vg = S.g(R.F(7)); v.connect(vg); vg.connect(o.frequency); o.connect(f); f.connect(g); g.connect(R.out);
  nb(R, t + 0.1, { kind: 'pink', type: 'bandpass', f0: 1200, q: 3, dur: 0.9, peak: 0.05, tc: 0.4, atk: 0.1 });
  return 1.5;
});
const FOOT = {
  concrete: (R, t, k) => { th(R, t, { f0: 120, f1: 62, dur: 0.1, peak: 0.8 * k, tc: 0.025 }); nb(R, t, { type: 'bandpass', f0: 950, q: 0.9, dur: 0.08, peak: 0.5 * k, tc: 0.016 }); nb(R, t, { type: 'highpass', f0: 3200, dur: 0.02, peak: 0.28 * k, tc: 0.005 }); },
  tile: (R, t, k) => { th(R, t, { f0: 140, f1: 80, dur: 0.08, peak: 0.6 * k, tc: 0.02 }); nb(R, t, { type: 'bandpass', f0: 1800, q: 1.3, dur: 0.06, peak: 0.5 * k, tc: 0.012 }); nb(R, t, { type: 'highpass', f0: 4000, dur: 0.025, peak: 0.3 * k, tc: 0.006 }); },
  grass: (R, t, k) => { th(R, t, { f0: 95, f1: 55, dur: 0.1, peak: 0.55 * k, tc: 0.03 }); nb(R, t, { kind: 'pink', type: 'lowpass', f0: 1500, f1: 600, dur: 0.14, peak: 0.45 * k, tc: 0.035, atk: 0.01 }); nb(R, t + 0.03, { type: 'bandpass', f0: 4000, q: 0.8, dur: 0.07, peak: 0.08 * k, tc: 0.02 }); },
  gravel: (R, t, k) => { th(R, t, { f0: 110, f1: 60, dur: 0.08, peak: 0.5 * k, tc: 0.02 }); for (let i = 0; i < 6; i++) nb(R, t + i * 0.022 + R.rng.next() * 0.01, { type: 'bandpass', f0: 2000 + R.rng.next() * 2800, q: 1.2, dur: 0.04, peak: 0.28 * k * R.rng.next() + 0.05, tc: 0.01 }); },
  wood: (R, t, k) => { th(R, t, { f0: 130, f1: 70, dur: 0.12, peak: 0.75 * k, tc: 0.03 }); th(R, t, { f0: 330, f1: 190, dur: 0.07, peak: 0.28 * k, tc: 0.02 }); nb(R, t, { type: 'bandpass', f0: 700, q: 1.2, dur: 0.07, peak: 0.4 * k, tc: 0.015 }); click(R, t + 0.004, 1500, 0.1 * k, 2); },
  metal: (R, t, k) => { th(R, t, { f0: 150, f1: 80, dur: 0.1, peak: 0.55 * k, tc: 0.025 }); ring(R, t, { fs: [420 * (1 + R.rng.next() * 0.1), 780, 1210, 1730], type: 'triangle', dur: 0.4, peak: 0.28 * k, damp: 0.6 }); nb(R, t, { type: 'highpass', f0: 3500, dur: 0.02, peak: 0.3 * k, tc: 0.005 }); },
  carpet: (R, t, k) => { th(R, t, { f0: 90, f1: 55, dur: 0.1, peak: 0.45 * k, tc: 0.03 }); nb(R, t, { kind: 'pink', type: 'lowpass', f0: 420, dur: 0.1, peak: 0.3 * k, tc: 0.03, atk: 0.008 }); },
  snow: (R, t, k) => { nb(R, t, { kind: 'pink', type: 'bandpass', f0: 2400, f1: 1200, q: 0.7, dur: 0.16, peak: 0.45 * k, tc: 0.04, atk: 0.012 }); nb(R, t + 0.045, { type: 'bandpass', f0: 3200, q: 1, dur: 0.07, peak: 0.2 * k, tc: 0.02 }); th(R, t, { f0: 80, f1: 50, dur: 0.1, peak: 0.3 * k, tc: 0.03 }); },
  sand: (R, t, k) => { th(R, t, { f0: 90, f1: 55, dur: 0.1, peak: 0.35 * k, tc: 0.03 }); nb(R, t, { kind: 'pink', type: 'bandpass', f0: 1800, q: 0.6, dur: 0.14, peak: 0.4 * k, tc: 0.04, atk: 0.01 }); },
  mud: (R, t, k) => { th(R, t, { f0: 85, f1: 45, dur: 0.14, peak: 0.55 * k, tc: 0.04 }); nb(R, t, { kind: 'brown', type: 'lowpass', f0: 700, dur: 0.18, peak: 0.55 * k, tc: 0.05 }); const o = R.S.o('sine', 240, t + 0.05, 0.12); o.frequency.exponentialRampToValueAtTime(110, t + 0.15); const g = R.S.g(0); pluckEnv(g.gain, t + 0.05, 0.14 * k, 0.04); o.connect(g); g.connect(R.out); },
  water: (R, t, k) => { nb(R, t, { kind: 'white', type: 'bandpass', f0: 1500, f1: 700, q: 0.6, dur: 0.32, peak: 0.5 * k, tc: 0.08, atk: 0.01 }); th(R, t, { f0: 140, f1: 70, dur: 0.1, peak: 0.3 * k, tc: 0.03 }); grains(R, t + 0.03, 4, 0.25, (tt) => { const o = R.S.o('sine', R.F(500 + R.rng.next() * 700), tt, 0.1); o.frequency.exponentialRampToValueAtTime(R.F(1400 + R.rng.next() * 600), tt + 0.06); const g = R.S.g(0); pluckEnv(g.gain, tt, 0.08, 0.025); o.connect(g); g.connect(R.out); }); },
};
reg(['footstep', 'footsteps'], { wet: [0.12, 0.1], g: 0.85 }, (R, o) => {
  const surf = FOOT[o.surface] || FOOT.concrete; const count = o.count || (R.h.name === 'footsteps' ? 4 : 1); const iv = o.interval || 0.52; const run = o.run ? 0.6 : 1;
  for (let i = 0; i < count; i++) { const tt = R.t0 + i * iv * run + (i ? (R.rng.next() - 0.5) * 0.03 : 0); surf(R, tt, (i % 2 ? 0.85 : 1) * (0.88 + R.rng.next() * 0.2)); }
  R.period = count * iv * run; return count * iv * run + 0.3;
});
reg('glass', { wet: [0.2, 0.4], g: 0.8 }, (R) => {
  const t = R.t0;
  nb(R, t, { type: 'highpass', f0: 2800, dur: 0.06, peak: 0.9, tc: 0.012, atk: 0.0005 });
  nb(R, t + 0.005, { type: 'bandpass', f0: 5200, q: 1.1, dur: 0.18, peak: 0.45, tc: 0.045 });
  grains(R, t, 22, 1.3, (tt, i) => { const f = 2200 + R.rng.next() * 7500; const o = R.S.o('sine', R.F(f), tt, 0.4); const g = R.S.g(0); pluckEnv(g.gain, tt, 0.045 + 0.1 * R.rng.next(), 0.03 + R.rng.next() * 0.12, 0.0008); o.connect(g); g.connect(R.out); }, 1.6);
  grains(R, t + 0.06, 18, 1.0, (tt) => nb(R, tt, { type: 'highpass', f0: 5000, dur: 0.012, peak: 0.15 * R.rng.next() + 0.04, tc: 0.003 }), 1.5);
  return 1.9;
});
reg('crash', { wet: [0.2, 0.35], g: 0.9 }, (R) => {
  const t = R.t0;
  th(R, t, { f0: 105, f1: 38, dur: 0.5, peak: 1, tc: 0.12, drive: 2 });
  [0, 0.045, 0.13, 0.22].forEach((d, i) => nb(R, t + d, { type: 'bandpass', f0: 300 + R.rng.next() * 2200, q: 1.2, dur: 0.14, peak: 0.8 - i * 0.12, tc: 0.03 }));
  nb(R, t, { type: 'highpass', f0: 1500, dur: 0.05, peak: 0.7, tc: 0.012, atk: 0.0005 });
  ring(R, t + 0.01, { fs: [380 * (0.9 + R.rng.next() * 0.2), 572, 913, 1491, 2280], type: 'square', dur: 0.9, peak: 0.2, damp: 0.55 });
  grains(R, t + 0.1, 14, 1.4, (tt) => { nb(R, tt, { type: 'bandpass', f0: 600 + R.rng.next() * 3500, q: 1.2, dur: 0.05, peak: 0.16 * R.rng.next() + 0.03, tc: 0.012 }); if (R.rng.next() < 0.3) ring(R, tt, { fs: [900 + R.rng.next() * 3000, 2500], dur: 0.2, peak: 0.1 }); }, 1.8);
  nb(R, t + 0.02, { kind: 'brown', type: 'lowpass', f0: 500, f1: 120, dur: 1.5, peak: 0.4, tc: 0.4, sw: 1.2 });
  return 2.6;
});

/* ------------------------------------------------------------------ ENGINES (buffer-based diesel pulse train, retuned by playbackRate) */
function engineBuffer(ctx) {
  const c = cache(ctx); if (c.engine) return c.engine;
  const sr = ctx.sampleRate; const per = 0.04; const firings = 4; const N = Math.floor(sr * per * firings); const buf = ctx.createBuffer(1, N, sr); const d = buf.getChannelData(0);
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < firings; k++) {
    const amp = 0.75 + rnd() * 0.25, i0 = Math.floor(k * per * sr + rnd() * 0.002 * sr), clat = 0.5 + rnd() * 0.6; let lp = 0;
    for (let i = 0; i < per * sr; i++) {
      const tt = i / sr; const idx = i0 + i; if (idx >= N) break;
      const body = Math.sin(TAU * 62 * tt * (1 - 0.3 * tt * 8)) * Math.exp(-tt / 0.012) + 0.5 * Math.sin(TAU * 124 * tt) * Math.exp(-tt / 0.008);
      const w = rnd() * 2 - 1; lp += 0.35 * (w - lp); const clatter = lp * Math.exp(-tt / 0.0045) * clat * 0.8; // combustion knock
      d[idx] += (body * 0.9 + clatter) * amp;
    }
  }
  let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < N; i++) d[i] *= 0.8 / (pk || 1);
  // seam: tiny crossfade between end and start
  const F = 24; for (let i = 0; i < F; i++) { const w = i / F; d[i] = d[i] * w + d[N - F + i] * (1 - w) * 0.0; }
  c.engine = buf; return buf;
}
function engineVoice(R, t, D, dd, rpmFn, p = {}) {
  const S = R.S; const src = S.buf(engineBuffer(R.ctx), t, dd); src.loop = true; const rate = src.playbackRate;
  rpmFn(rate); // caller schedules playbackRate
  const lp = S.f('lowpass', p.lp || 1100, 0.8); const body = S.f('peaking', 180, 1.2, 5); const sat = S.shaper('tanh', 1.8);
  const env = S.g(0); swell(R, env.gain, p.peak || 0.85, 0.35, 0.6, D); src.connect(sat); sat.connect(lp); lp.connect(body); body.connect(env); env.connect(R.out);
  const ex = S.n('brown', t, dd), exf = S.f('lowpass', 190, 0.8), exg = S.g(0.5); ex.connect(exf); exf.connect(exg); exg.connect(env);
  const hum = S.o('sawtooth', 48, t, dd), hf = S.f('lowpass', 260, 1), hg = S.g(0.07); hum.connect(hf); hf.connect(hg); hg.connect(env);
  return { lp, env, rate };
}
reg('engine_idle', { wet: [0.12, 0.2], g: 0.8, cont: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 6); const dd = R.sustain ? undefined : D + 0.1;
  engineVoice(R, t, D, dd, (rate) => { rate.setValueAtTime(1, t); const l = S.o('sine', 0.75, t, dd), lg = S.g(0.03); l.connect(lg); lg.connect(rate); const l2 = S.o('sine', 3.1, t, dd), lg2 = S.g(0.012); l2.connect(lg2); lg2.connect(rate); });
  R.period = D; return D + 0.2;
});
reg('engine_rev', { wet: [0.12, 0.25], g: 0.85, doppler: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 4.2); const dd = D + 0.1;
  const v = engineVoice(R, t, D, dd, (rate) => { line(rate, t, [[0, 1], [0.15, 1], [1.3, 2.7], [1.9, 2.6], [2.1, 3.0], [3.0, 2.2], [D, 1.2]]); }, { lp: 1000 });
  line(v.lp.frequency, t, [[0, 800], [1.3, 3200], [3, 2200], [D, 900]]);
  return D + 0.3;
});
reg('helicopter', { wet: [0.15, 0.4], g: 0.7, cont: true, doppler: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 6); const dd = R.sustain ? undefined : D + 0.1; const env = S.g(0); swell(R, env.gain, 0.85, 1.2, 1.2, D); env.connect(R.out);
  const n = S.n('pink', t, dd), f = S.f('lowpass', 520, 0.9), amp = S.g(0.25); n.connect(f); f.connect(amp); amp.connect(env);
  const rot = S.o('sawtooth', 21, t, dd), rf = S.f('lowpass', 140, 1.2), rg = S.g(0.55); rot.connect(rf); rf.connect(rg); rg.connect(env);
  const blade = S.o('square', 10.5, t, dd), bg = S.g(0.5); blade.connect(bg); bg.connect(amp.gain); // chop
  const am = S.o('sine', 10.5, t, dd), amg = S.g(0.3); am.connect(amg); amg.connect(env.gain);
  const w = S.o('sawtooth', 2600, t, dd), wf = S.f('bandpass', 2800, 14), wg = S.g(0.018); w.connect(wf); wf.connect(wg); wg.connect(env);
  R.period = D; return D + 0.2;
});
reg('tank', { wet: [0.1, 0.25], g: 0.8, cont: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 6); const dd = R.sustain ? undefined : D + 0.1; const env = S.g(0); swell(R, env.gain, 0.85, 0.8, 0.8, D); env.connect(R.out);
  const n = S.n('brown', t, dd), f = S.f('lowpass', 210, 0.8), g = S.g(1.2); n.connect(f); f.connect(g); g.connect(env);
  const d = S.o('sawtooth', 38, t, dd), df = S.f('lowpass', 150, 1.2), dg = S.g(0.5); const wob = S.o('sine', 0.6, t, dd), wg = S.g(1.6); wob.connect(wg); wg.connect(d.frequency); d.connect(df); df.connect(dg); dg.connect(env);
  const tr = S.n('white', t, dd), tf = S.f('bandpass', 1800, 2.5), tg = S.g(0), tam = S.o('square', 8.5, t, dd), tag = S.g(0.05); tam.connect(tag); tag.connect(tg.gain); tg.gain.value = 0.05; tr.connect(tf); tf.connect(tg); tg.connect(env); // track clatter
  R.period = D; return D + 0.2;
});

/* ------------------------------------------------------------------ PHONES, CLOCKS, UI, SMALL ELECTRONICS */
reg('phone_ring', { wet: [0.1, 0.15], g: 0.5, cont: false }, (R, o) => {
  const t = R.t0, S = R.S; const lp = S.f('lowpass', 4200, 0.7); lp.connect(R.out); const rings = [0, 1.5];
  rings.forEach((r0) => {
    const ts = t + r0, d = 1.0;
    for (const f of [1420, 1050]) {
      const osc = S.o('square', R.F(f), ts, d); const g = S.g(0); const am = S.o('square', 24, ts, d), ag = S.g(0.5); am.connect(ag); ag.connect(g.gain); g.gain.value = 0.5;
      const env = S.g(0); env.gain.setValueAtTime(0, ts); env.gain.linearRampToValueAtTime(0.28, ts + 0.01); env.gain.setValueAtTime(0.28, ts + d - 0.03); env.gain.linearRampToValueAtTime(0, ts + d); osc.connect(g); g.connect(env); env.connect(lp);
    }
  });
  R.period = 4.2; return 4.2;
});
reg('phone_vibrate', { wet: [0.05, 0.05], g: 0.65 }, (R) => {
  const t = R.t0, S = R.S;
  [0, 0.62].forEach((d) => {
    const ts = t + d, len = 0.48; const o = S.o('sawtooth', 168, ts, len + 0.02), f = S.f('lowpass', 780, 1.2), g = S.g(0), am = S.o('sine', 34, ts, len + 0.02), ag = S.g(0.25);
    g.gain.setValueAtTime(0, ts); g.gain.linearRampToValueAtTime(0.7, ts + 0.02); g.gain.setValueAtTime(0.7, ts + len - 0.03); g.gain.linearRampToValueAtTime(0, ts + len); am.connect(ag); ag.connect(g.gain); o.connect(f); f.connect(g); g.connect(R.out);
    const n = S.n('white', ts, len + 0.02), nf = S.f('bandpass', 1500, 2), ng = S.g(0), nam = S.o('square', 33, ts, len + 0.02), nag = S.g(0.07); ng.gain.value = 0.07; nam.connect(nag); nag.connect(ng.gain); n.connect(nf); nf.connect(ng); ng.connect(R.out);
    th(R, ts, { f0: 130, f1: 100, dur: 0.1, peak: 0.25, tc: 0.03 });
  });
  R.period = 1.5; return 1.5;
});
reg('heartbeat', { wet: [0.05, 0.1], g: 0.9 }, (R, o) => {
  const t = R.t0; const bpm = o.bpm || o.rate || 66; const per = 60 / bpm; const k = o.strength || 1;
  th(R, t, { f0: 64, f1: 38, dur: 0.22, peak: 1 * k, tc: 0.05, drive: 1.2, fd: 0.09 }); nb(R, t, { kind: 'brown', type: 'lowpass', f0: 180, dur: 0.1, peak: 0.45 * k, tc: 0.03 });
  const d2 = Math.min(0.32, per * 0.38); th(R, t + d2, { f0: 72, f1: 42, dur: 0.18, peak: 0.62 * k, tc: 0.042, drive: 1.2, fd: 0.07 }); nb(R, t + d2, { kind: 'brown', type: 'lowpass', f0: 200, dur: 0.08, peak: 0.28 * k, tc: 0.025 });
  R.period = per; return per + 0.2;
});
reg('thunder', { wet: [0.25, 0.7], g: 0.9, travel: true }, (R) => {
  const t = R.t0, S = R.S;
  nb(R, t, { type: 'highpass', f0: 700, dur: 0.12, peak: 0.55, tc: 0.03, atk: 0.001 });
  grains(R, t, 22, 0.8, (tt) => nb(R, tt, { type: 'bandpass', f0: 1200 + R.rng.next() * 2500, q: 1.2, dur: 0.06, peak: 0.28 * R.rng.next() + 0.05, tc: 0.012 }), 1.0);
  const n = S.n('brown', t + 0.05, 8), f = S.f('lowpass', 900, 0.8); sweep(f.frequency, t + 0.05, 950, 80, 6.5); const g = S.g(0); n.connect(f); f.connect(g); g.connect(R.out);
  g.gain.setValueAtTime(0, t); [[0.1, 0.9, 0.25], [0.9, 0.7, 0.5], [1.8, 0.55, 0.6], [3.1, 0.38, 0.8], [4.4, 0.2, 1.0]].forEach(([d, pk, tc]) => { g.gain.setTargetAtTime(pk, t + d, 0.12); g.gain.setTargetAtTime(0.03, t + d + 0.25, tc); });
  g.gain.setTargetAtTime(0, t + 5.2, 0.8);
  th(R, t + 0.15, { f0: 52, f1: 28, dur: 2.6, peak: 0.7, tc: 0.8, atk: 0.1 });
  nb(R, t + 0.25, { kind: 'pink', type: 'bandpass', f0: 180, q: 0.6, dur: 2.0, peak: 0.4, tc: 0.5, atk: 0.2 });
  return 8.5;
});
reg('impact', { wet: [0.2, 0.45], g: 0.9 }, (R, o) => {
  const t = R.t0;
  th(R, t, { f0: 68, f1: 30, dur: 0.9, peak: 1, tc: 0.2, drive: 2.5, fd: 0.4 });
  nb(R, t, { type: 'lowpass', f0: 1500, f1: 160, dur: 0.6, peak: 0.7, tc: 0.14, sw: 0.4 });
  nb(R, t, { type: 'highpass', f0: 2500, dur: 0.04, peak: 0.5, tc: 0.009, atk: 0.0005 });
  nb(R, t + 0.02, { kind: 'brown', type: 'lowpass', f0: 320, f1: 70, dur: 1.7, peak: 0.34, tc: 0.45, sw: 1.4 });
  if (o.kind === 'metal') ring(R, t + 0.004, { fs: [310, 470, 790, 1210, 1800], type: 'triangle', dur: 1.3, peak: 0.3, damp: 0.6 });
  return 2.1;
});
reg('riser', { wet: [0.12, 0.35], g: 0.75 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 4);
  const env = S.g(0); env.gain.setValueAtTime(0.005, t); env.gain.exponentialRampToValueAtTime(1, t + D * 0.97); env.gain.linearRampToValueAtTime(0, t + D + 0.04); env.connect(R.out);
  const n = S.n('white', t, D + 0.1), f = S.f('bandpass', 250, 2.2); sweep(f.frequency, t, 250, 7000, D); const ng = S.g(0.7); n.connect(f); f.connect(ng); ng.connect(env);
  const lo = S.n('pink', t, D + 0.1), lf = S.f('lowpass', 300, 0.8); sweep(lf.frequency, t, 300, 3500, D); const lg = S.g(0.55); lo.connect(lf); lf.connect(lg); lg.connect(env);
  for (const [f0, a, ty] of [[110, 0.3, 'sawtooth'], [110.8, 0.3, 'sawtooth'], [220, 0.12, 'triangle']]) { const o1 = S.o(ty, f0, t, D + 0.1); sweep(o1.frequency, t, f0, f0 * 4, D); const fl = S.f('lowpass', 500, 1); sweep(fl.frequency, t, 500, 5000, D); const gg = S.g(a); o1.connect(fl); fl.connect(gg); gg.connect(env); }
  return D + 0.3;
});
reg('whoosh', { wet: [0.1, 0.25], g: 0.8 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 0.9); const dir = o.dir === -1 ? -1 : 1;
  const out = R.h.sp ? R.out : (() => { const p = S.pan(-0.7 * dir); line(p.pan, t, [[0, -0.7 * dir], [D, 0.7 * dir]]); p.connect(R.out); return p; })();
  const env = S.g(0); line(env.gain, t, [[0, 0], [D * 0.42, 0.85], [D, 0]]); env.connect(out);
  const n = S.n('pink', t, D + 0.05), f = S.f('bandpass', 400, 1.1); line(f.frequency, t, [[0, 350], [D * 0.45, 2600], [D, 700]]); n.connect(f); f.connect(env);
  const b = S.n('brown', t, D + 0.05), bf = S.f('lowpass', 320, 0.8), bg = S.g(0.5); b.connect(bf); bf.connect(bg); bg.connect(env);
  return D + 0.1;
});
reg('shutter', { wet: [0.08, 0.1], g: 0.75 }, (R) => {
  const t = R.t0; click(R, t, 2300, 0.8, 3); th(R, t, { f0: 170, f1: 90, dur: 0.05, peak: 0.45, tc: 0.012 }); click(R, t + 0.075, 1600, 0.65, 3); nb(R, t + 0.02, { type: 'bandpass', f0: 4200, q: 1.5, dur: 0.05, peak: 0.1, tc: 0.015 }); return 0.3;
});
reg('camera', { wet: [0.08, 0.1], g: 0.7 }, (R, o) => {
  const t = R.t0, S = R.S; const o1 = S.o('sine', 2400, t, 0.04), g1 = S.g(0); pluckEnv(g1.gain, t, 0.3, 0.008); o1.connect(g1); g1.connect(R.out);
  const o2 = S.o('sine', 1600, t + 0.05, 0.08), g2 = S.g(0); pluckEnv(g2.gain, t + 0.05, 0.3, 0.015); o2.connect(g2); g2.connect(R.out);
  nb(R, t, { type: 'bandpass', f0: 3000, q: 2, dur: 0.035, peak: 0.4, tc: 0.007 }); nb(R, t + 0.05, { type: 'bandpass', f0: 2000, q: 2, dur: 0.06, peak: 0.3, tc: 0.012 });
  if (o.flash !== false) { const w = S.o('sine', 3500, t + 0.12, 0.35); w.frequency.exponentialRampToValueAtTime(5600, t + 0.4); const g = S.g(0); line(g.gain, t + 0.12, [[0, 0], [0.05, 0.05], [0.28, 0.04], [0.32, 0]]); w.connect(g); g.connect(R.out); }
  return 0.6;
});
reg('news_sting', { wet: [0.15, 0.5], g: 0.7 }, (R) => {
  const t = R.t0, S = R.S; const out = S.g(0.7); out.connect(R.out);
  [[0, 76, 0.2], [0.17, 79, 0.2], [0.34, 83, 0.2], [0.52, 88, 1.3]].forEach(([d, m, len]) => {
    const f = mtof(m); const ts = t + d; const g = S.g(0); adsr(g.gain, ts, 0.4, 0.012, 0.25, 0.6, len, 0.4);
    const lp = S.f('lowpass', 800, 3); line(lp.frequency, ts, [[0, 800], [0.06, 5200], [0.4, 2400]]);
    for (const dt of [-7, 7]) { const o = S.o('sawtooth', f, ts, len + 0.7); o.detune.value = dt; o.connect(lp); } lp.connect(g); g.connect(out);
    ring(R, ts, { fs: [f * 2, f * 3.01, f * 4.2], dur: 0.7, peak: 0.12, dest: out });
  });
  th(R, t, { f0: 90, f1: 45, dur: 0.5, peak: 0.55, tc: 0.12, dest: out }); th(R, t + 0.52, { f0: 70, f1: 38, dur: 0.9, peak: 0.7, tc: 0.25, dest: out });
  nb(R, t + 0.5, { type: 'highpass', f0: 4000, dur: 1.2, peak: 0.07, tc: 0.4, atk: 0.2, dest: out });
  return 2.4;
});
reg('tick', { wet: [0.05, 0.08], g: 0.7 }, (R, o) => {
  const t = R.t0, S = R.S; const lo = o.tock ? 0.7 : 1; const osc = S.o('sine', R.F(1800 * lo), t, 0.04); osc.frequency.exponentialRampToValueAtTime(R.F(1100 * lo), t + 0.015);
  const g = S.g(0); pluckEnv(g.gain, t, 0.45, 0.008); osc.connect(g); g.connect(R.out); nb(R, t, { type: 'highpass', f0: 3500, dur: 0.01, peak: 0.3, tc: 0.002 }); th(R, t, { f0: 400 * lo, f1: 250 * lo, dur: 0.02, peak: 0.2, tc: 0.006 });
  R.period = o.interval || 1; return 0.15;
});
reg('beep', { wet: [0.05, 0.1], g: 0.5 }, (R, o) => {
  const t = R.t0, S = R.S; const d = R.D(o.dur || 0.16); const osc = S.o(o.wave || 'sine', R.F(o.freq || 1000), t, d + 0.01); const g = S.g(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + 0.006); g.gain.setValueAtTime(0.7, t + d - 0.01); g.gain.linearRampToValueAtTime(0, t + d);
  osc.connect(g); g.connect(R.out); R.period = d + (o.gap || 0.4); return d + 0.1;
});
reg('keyboard', { wet: [0.06, 0.05], g: 0.65 }, (R, o) => {
  const t = R.t0; let tt = t; const n = o.keys || 14;
  for (let i = 0; i < n; i++) {
    const k = 0.5 + R.rng.next() * 0.5; const f = 2400 + R.rng.next() * 1400;
    nb(R, tt, { type: 'bandpass', f0: f, q: 2.2, dur: 0.018, peak: 0.5 * k, tc: 0.004 }); th(R, tt, { f0: 700 + R.rng.next() * 300, f1: 280, dur: 0.035, peak: 0.28 * k, tc: 0.009 });
    nb(R, tt + 0.045, { type: 'bandpass', f0: f * 0.75, q: 2, dur: 0.012, peak: 0.16 * k, tc: 0.003 });
    tt += R.rng.pick([0.07, 0.09, 0.12, 0.15, 0.2, 0.31]) * (R.rng.next() < 0.1 ? 2.2 : 1);
  }
  R.period = tt - t; return tt - t + 0.2;
});
reg('comm_open', { wet: [0.05, 0.05], g: 0.6 }, (R) => {
  const t = R.t0, S = R.S; nb(R, t, { type: 'bandpass', f0: 2600, q: 0.8, dur: 0.07, peak: 0.5, tc: 0.02 });
  [[0.05, 1200], [0.12, 1800]].forEach(([d, f]) => { const o = S.o('sine', f, t + d, 0.07), g = S.g(0); g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.28, t + d + 0.005); g.gain.setValueAtTime(0.28, t + d + 0.055); g.gain.linearRampToValueAtTime(0, t + d + 0.065); o.connect(g); g.connect(R.out); });
  nb(R, t + 0.2, { type: 'bandpass', f0: 1800, q: 0.5, dur: 0.12, peak: 0.1, tc: 0.04 }); return 0.5;
});
reg('comm_close', { wet: [0.05, 0.05], g: 0.6 }, (R) => {
  const t = R.t0, S = R.S; nb(R, t, { type: 'bandpass', f0: 2400, q: 0.6, dur: 0.06, peak: 0.35, tc: 0.02 });
  [[0.04, 1700], [0.1, 950]].forEach(([d, f]) => { const o = S.o('sine', f, t + d, 0.07), g = S.g(0); g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.25, t + d + 0.005); g.gain.setValueAtTime(0.25, t + d + 0.055); g.gain.linearRampToValueAtTime(0, t + d + 0.065); o.connect(g); g.connect(R.out); });
  nb(R, t + 0.17, { type: 'bandpass', f0: 2000, q: 0.5, dur: 0.14, peak: 0.28, tc: 0.045 }); click(R, t + 0.2, 1500, 0.2, 2); return 0.5;
});

/* ------------------------------------------------------------------ SCREAMS, CROWDS, VOCALISATIONS */
function screamGrain(R, t, d, f0, p = {}) {
  const S = R.S; const out = S.g(0); line(out.gain, t, [[0, 0], [0.04, p.peak || 0.5], [d * 0.6, (p.peak || 0.5) * 0.8], [d, 0]]);
  const hp = S.f('highpass', 280, 0.7); out.connect(hp); const dest = p.dest || R.out; if (p.pan !== undefined) { const pn = S.pan(p.pan); hp.connect(pn); pn.connect(dest); } else hp.connect(dest);
  const v = vox(R, t, d, { f0, fm: f0 * (p.rise || 1.9), tm: 0.28, f1: f0 * 1.25, jit: 0.02, vib: 0.03, vibRate: 6.5 + R.rng.next() * 1.5, type: 'sawtooth' }); const sat = S.shaper('tube', 3); v.connect(sat);
  const lo = p.lo || 1;
  formants(R, sat, t, d, [{ f0: 800 * lo, f1: 950 * lo, q: 5 }, { f0: 1500 * lo, f1: 1300 * lo, q: 6, g: 0.8 }, { f0: 2900, q: 5, g: 0.35 }], out);
  const n = S.n('white', t, d), ng = S.g(0.25); n.connect(ng); formants(R, ng, t, d, [{ f0: 1100 * lo, q: 2 }, { f0: 2400, q: 2, g: 0.6 }], out);
  return out;
}
reg('scream', { wet: [0.35, 0.65], g: 0.6 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 1.5); const male = !!o.male; const lp = S.f('lowpass', 3600, 0.7); lp.connect(R.out);
  screamGrain(R, t, D, (male ? 300 : 520) * (0.9 + R.rng.next() * 0.2), { peak: 0.7, dest: lp, lo: male ? 0.85 : 1 }); return D + 0.3;
});
reg('crowd_panic', { wet: [0.3, 0.5], g: 0.6, cont: false }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 8); const env = S.g(0); line(env.gain, t, [[0, 0], [1.2, 1], [D - 1, 1], [D, 0]]); env.connect(R.out);
  const n = S.n('pink', t, D + 0.1), f = S.f('bandpass', 850, 0.6), g = S.g(0.5); n.connect(f); f.connect(g); g.connect(env);
  const f2 = S.f('lowpass', 260, 0.7), g2 = S.g(0.28); const nn = S.n('brown', t, D + 0.1); nn.connect(f2); f2.connect(g2); g2.connect(env);
  const count = Math.round(34 * D / 8 * (R.A.q === 0 ? 0.5 : 1));
  for (let i = 0; i < count; i++) {
    const tt = t + R.rng.next() * (D - 0.5); const fem = R.rng.next() < 0.6; screamGrain(R, tt, R.rng.range(0.25, 0.9), (fem ? 480 : 270) * R.rng.range(0.85, 1.3), { peak: R.rng.range(0.04, 0.16), pan: R.rng.range(-0.9, 0.9), dest: env, rise: R.rng.range(1.2, 2.2), lo: fem ? 1 : 0.85 });
  }
  R.period = D; return D + 0.3;
});

/* ------------------------------------------------------------------ MISC EXTRAS */
reg('splash', { wet: [0.2, 0.3], g: 0.8 }, (R) => {
  const t = R.t0; nb(R, t, { type: 'bandpass', f0: 1400, f1: 500, q: 0.6, dur: 0.6, peak: 0.8, tc: 0.14, atk: 0.006 }); th(R, t, { f0: 160, f1: 60, dur: 0.25, peak: 0.6, tc: 0.07 });
  grains(R, t + 0.04, 12, 0.7, (tt) => { const o = R.S.o('sine', 500 + R.rng.next() * 700, tt, 0.12); o.frequency.exponentialRampToValueAtTime(1500 + R.rng.next() * 900, tt + 0.07); const g = R.S.g(0); pluckEnv(g.gain, tt, 0.07 + 0.05 * R.rng.next(), 0.03); o.connect(g); g.connect(R.out); }, 1.2);
  return 1.1;
});
reg('hiss', { wet: [0.2, 0.2], g: 0.7 }, (R, o) => { // airlock / pneumatic / hydraulic release
  const t = R.t0; const D = R.D(o.dur || 1.3); nb(R, t, { type: 'highpass', f0: 2500, f1: 1200, q: 0.7, dur: D, peak: 0.55, tc: D * 0.33, atk: 0.015, sw: D });
  nb(R, t, { kind: 'pink', type: 'bandpass', f0: 5200, q: 0.8, dur: D * 0.8, peak: 0.25, tc: D * 0.25 }); th(R, t, { f0: 110, f1: 70, dur: 0.15, peak: 0.28, tc: 0.04 }); return D + 0.2;
});
reg('power_up', { wet: [0.15, 0.3], g: 0.65 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 1.6); const out = S.g(0); line(out.gain, t, [[0, 0], [D * 0.9, 0.7], [D, 0]]); out.connect(R.out);
  const a = S.o('sawtooth', 70, t, D), f = S.f('lowpass', 400, 4); a.frequency.exponentialRampToValueAtTime(R.F(700), t + D * 0.95); sweep(f.frequency, t, 300, 6000, D); a.connect(f); f.connect(out);
  const b = S.o('sine', 140, t, D); b.frequency.exponentialRampToValueAtTime(R.F(1400), t + D * 0.95); const bg = S.g(0.3); b.connect(bg); bg.connect(out); return D + 0.2;
});
reg('power_down', { wet: [0.15, 0.3], g: 0.65 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 2); const out = S.g(0); line(out.gain, t, [[0, 0.7], [D * 0.6, 0.5], [D, 0]]); out.connect(R.out);
  const a = S.o('sawtooth', 600, t, D), f = S.f('lowpass', 5000, 3); a.frequency.exponentialRampToValueAtTime(R.F(38), t + D * 0.98); sweep(f.frequency, t, 5000, 120, D); a.connect(f); f.connect(out);
  const b = S.o('sine', 1200, t, D); b.frequency.exponentialRampToValueAtTime(R.F(76), t + D * 0.98); const bg = S.g(0.3); b.connect(bg); bg.connect(out); return D + 0.2;
});
reg('scanner', { wet: [0.2, 0.4], g: 0.5 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 2.4); const out = S.g(0.7); out.connect(R.out);
  const a = S.o('sine', 500, t, D), lf = S.o('triangle', 1.7, t, D), lg = S.g(380); lf.connect(lg); lg.connect(a.frequency); const g = S.g(0); line(g.gain, t, [[0, 0], [0.1, 0.4], [D - 0.2, 0.4], [D, 0]]); a.connect(g); g.connect(out);
  const b = S.o('sine', 1004, t, D), bg = S.g(0.12); lg.connect(b.frequency); b.connect(bg); bg.connect(g); return D + 0.2;
});
reg('bio_squelch', { wet: [0.2, 0.25], g: 0.75 }, (R) => {
  const t = R.t0, S = R.S; const D = 0.6; const v = vox(R, t, D, { f0: 160, f1: 70, fm: 220, tm: 0.3, jit: 0.07, fry: 0.8, fryRate: 44, type: 'square' });
  const out = S.g(0); line(out.gain, t, [[0, 0], [0.03, 0.7], [D, 0]]); out.connect(R.out); const bp = S.f('bandpass', 420, 6); sweep(bp.frequency, t, 260, 1500, D); v.connect(bp); bp.connect(out);
  nb(R, t, { kind: 'pink', type: 'bandpass', f0: 1100, f1: 300, q: 2, dur: 0.5, peak: 0.28, tc: 0.12, dest: out }); return D + 0.3;
});
reg('breath', { wet: [0.12, 0.08], g: 0.6 }, (R, o) => {
  const t = R.t0; const D = R.D(o.dur || 1.5); const exh = !!o.exhale; const f0 = exh ? 1300 : 1700, f1 = exh ? 700 : 2400;
  nb(R, t, { kind: 'pink', type: 'bandpass', f0, f1, q: 0.9, dur: D, peak: 0.42, tc: D * 0.25, atk: D * 0.35, sw: D }); return D + 0.2;
});
reg('hit_flesh', { wet: [0.08, 0.1], g: 0.8 }, (R) => { const t = R.t0; th(R, t, { f0: 160, f1: 70, dur: 0.12, peak: 0.8, tc: 0.03 }); nb(R, t, { kind: 'pink', type: 'lowpass', f0: 1200, dur: 0.1, peak: 0.6, tc: 0.025 }); nb(R, t, { type: 'bandpass', f0: 2200, q: 1.5, dur: 0.03, peak: 0.2, tc: 0.008 }); return 0.4; });
reg('drone_hum', { wet: [0.15, 0.4], g: 0.5, cont: true, doppler: true }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.life(o.dur || 5); const dd = R.sustain ? undefined : D + 0.1; const env = S.g(0); swell(R, env.gain, 0.8, 0.8, 0.8, D); env.connect(R.out);
  [[240, 'sawtooth', 0.25], [241.7, 'sawtooth', 0.25], [480.3, 'sine', 0.1], [120, 'square', 0.15]].forEach(([f, ty, a]) => { const o1 = S.o(ty, R.F(f), t, dd), fl = S.f('lowpass', 1300, 1), g = S.g(a); o1.connect(fl); fl.connect(g); g.connect(env); });
  const n = S.n('pink', t, dd), nf = S.f('bandpass', 2500, 5), ng = S.g(0.06); n.connect(nf); nf.connect(ng); ng.connect(env); R.period = D; return D + 0.2;
});
reg('radio_chatter', { wet: [0.05, 0.1], g: 0.5 }, (R, o) => { // squelch + garbled nonsense (voice lines proper go through audio.voice with style 'radio')
  const t = R.t0, S = R.S; RECIPES.comm_open.fn(R, o);
  let tt = t + 0.3; const bp = S.f('bandpass', 1700, 0.8), g = S.g(0.5); bp.connect(g); g.connect(R.out);
  for (let i = 0; i < 6; i++) { const d = R.rng.range(0.1, 0.28); const v = S.o('sawtooth', R.rng.range(100, 190), tt, d); const e = S.g(0); line(e.gain, tt, [[0, 0], [0.02, 0.5], [d, 0]]); v.connect(e); e.connect(bp); tt += d + R.rng.range(0.02, 0.12); }
  nb(R, tt, { type: 'bandpass', f0: 1800, q: 0.5, dur: 0.14, peak: 0.3, tc: 0.045 }); return tt - t + 0.3;
});
reg('wood_creak', { wet: [0.2, 0.2], g: 0.6 }, (R) => RECIPES.door_open.fn(R, {}));
reg('metal_groan', { wet: [0.25, 0.55], g: 0.6 }, (R, o) => {
  const t = R.t0, S = R.S; const D = R.D(o.dur || 3); const out = S.g(0); line(out.gain, t, [[0, 0], [D * 0.35, 0.8], [D * 0.7, 0.6], [D, 0]]); out.connect(R.out);
  [[78, 0.7], [79.4, 0.5], [117.5, 0.3]].forEach(([f, a]) => { const o1 = S.o('sawtooth', R.F(f), t, D); line(o1.frequency, t, [[0, R.F(f)], [D * 0.5, R.F(f * 0.82)], [D, R.F(f * 0.9)]]); const bp = S.f('bandpass', 260, 9), g = S.g(a); sweep(bp.frequency, t, 200, 520, D); o1.connect(bp); bp.connect(g); g.connect(out); });
  nb(R, t, { kind: 'pink', type: 'bandpass', f0: 900, q: 6, dur: D, peak: 0.1, tc: D / 3, atk: D * 0.3, dest: out }); return D + 0.3;
});

export { nb, th, ring, grains, formants, vox, click, swell, brassWave };
