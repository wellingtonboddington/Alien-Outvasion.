// Ambience beds: looping synthesised noise textures + slow random modulation + Poisson-timed one-shot events (birds, horns, drips, distant guns...).
// A bed is only alive while its level > 0 (it is torn down after its fade-out, so idle beds cost nothing).  Events use the seeded RNG.
import { RNG, Syn, hashStr, mtof, pluckEnv, line, cl } from './dsp.js';
import { nb, th, ring, click } from './sfx_recipes.js';

/* ------------------------------------------------------------------ helpers */
const R0 = (S, d, rng) => ({ S, F: (x) => x, out: d, rng, pitch: 1 });
/** slowly wandering modulation: sum of three incommensurate sines added to `param` (depth in the param's own units) */
function wander(S, param, depth, rates = [0.071, 0.13, 0.29]) {
  rates.forEach((r, i) => { const o = S.o('sine', r * (0.8 + (hashStr('w' + param.value + i) % 40) / 100), S.t0); const g = S.g(depth / (1 + i * 0.6)); o.connect(g); g.connect(param); });
}
function bird(S, t, rng, dest, kind = -1) {
  const k = kind >= 0 ? kind : rng.int(0, 4); const f = rng.range(2300, 5200); const pan = S.pan(rng.range(-0.9, 0.9)); const hp = S.f('highpass', 1500, 0.5); const g0 = S.g(rng.range(0.35, 0.8)); pan.connect(hp); hp.connect(g0); g0.connect(dest);
  const note = (tt, f0, f1, d, a = 0.12, vib = 0) => {
    const o = S.o('sine', f0, tt, d + 0.05); o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(Math.max(200, f1), tt + d); const g = S.g(0); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(a, tt + 0.008); g.gain.setTargetAtTime(0, tt + d * 0.5, d * 0.25);
    if (vib) { const l = S.o('sine', vib, tt, d + 0.05), lg = S.g(f0 * 0.06); l.connect(lg); lg.connect(o.frequency); } o.connect(g); g.connect(pan);
  };
  if (k === 0) note(t, f, f * 1.45, 0.09);                                                                          // rising tweet
  else if (k === 1) { const n = rng.int(4, 8); for (let i = 0; i < n; i++) note(t + i * 0.065, f * (i % 2 ? 1.12 : 0.94), f * (i % 2 ? 0.94 : 1.12), 0.05, 0.09); } // trill
  else if (k === 2) { note(t, f * 1.2, f * 1.3, 0.12); note(t + 0.17, f * 0.95, f * 0.72, 0.2); }                   // tee-yoo
  else if (k === 3) note(t, f * 0.8, f * 1.0, 0.45, 0.1, 22);                                                      // warble
  else { for (let i = 0; i < 3; i++) note(t + i * 0.13, f * (1 + i * 0.12), f * (1.2 + i * 0.1), 0.08, 0.11); }      // three-note call
}
function frog(S, t, rng, dest, f = 420) {
  const n = rng.int(1, 4); const pan = S.pan(rng.range(-0.8, 0.8)); pan.connect(dest);
  for (let i = 0; i < n; i++) { const tt = t + i * 0.16; const o = S.o('sawtooth', f, tt, 0.16); const am = S.g(0.5), l = S.o('square', 38, tt, 0.16), lg = S.g(0.5); l.connect(lg); lg.connect(am.gain); const bp = S.f('bandpass', f * 1.6, 3), g = S.g(0); pluckEnv(g.gain, tt, 0.18, 0.06, 0.01); o.connect(am); am.connect(bp); bp.connect(g); g.connect(pan); }
}
function honk(S, t, rng, dest, dist = 1) {
  const f = rng.pick([380, 420, 470, 520]); const pan = S.pan(rng.range(-0.9, 0.9)); const lp = S.f('lowpass', 1800 / dist, 0.7); const g = S.g(0); const d = rng.range(0.18, 0.5);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18 / dist, t + 0.015); g.gain.setValueAtTime(0.18 / dist, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.03);
  for (const m of [1, 1.26]) { const o = S.o('square', f * m, t, d + 0.1); o.connect(lp); } lp.connect(g); g.connect(pan); pan.connect(dest);
}
function carPass(S, t, rng, dest, dur = 4) {
  const dir = rng.sign(); const pan = S.pan(-0.8 * dir); line(pan.pan, t, [[0, -0.8 * dir], [dur, 0.8 * dir]]); pan.connect(dest);
  const env = S.g(0); line(env.gain, t, [[0, 0.0], [dur * 0.5, rng.range(0.25, 0.45)], [dur, 0]]); env.connect(pan);
  const n = S.n('pink', t, dur + 0.1), f = S.f('bandpass', 500, 0.9); line(f.frequency, t, [[0, 700], [dur * 0.5, 1400], [dur * 0.55, 600], [dur, 350]]); n.connect(f); f.connect(env);
  const f0 = rng.range(70, 110); const e = S.o('sawtooth', f0, t, dur + 0.1), ef = S.f('lowpass', 500, 0.8), eg = S.g(0.2); line(e.frequency, t, [[0, f0 * 1.12], [dur * 0.5, f0 * 1.12], [dur * 0.56, f0 * 0.86], [dur, f0 * 0.85]]); e.connect(ef); ef.connect(eg); eg.connect(env);
}
function dogBark(S, t, rng, dest) {
  const n = rng.int(1, 4); const pan = S.pan(rng.range(-0.9, 0.9)); const lp = S.f('lowpass', 2200, 0.7); lp.connect(pan); pan.connect(dest); const f0 = rng.range(320, 520);
  for (let i = 0; i < n; i++) { const tt = t + i * rng.range(0.28, 0.42); const o = S.o('sawtooth', f0, tt, 0.2); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, tt + 0.18); const g = S.g(0); pluckEnv(g.gain, tt, 0.28, 0.07, 0.01); const b1 = S.f('bandpass', 700, 5), b2 = S.f('bandpass', 1400, 6); o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); g.connect(lp); }
}
function siren(S, t, rng, dest, dur = 5, vol = 0.1) {
  const pan = S.pan(rng.range(-0.8, 0.8)); const lp = S.f('lowpass', 1800, 0.7); const env = S.g(0); line(env.gain, t, [[0, 0], [dur * 0.4, vol], [dur, 0]]); lp.connect(env); env.connect(pan); pan.connect(dest);
  const o = S.o('sawtooth', 900, t, dur + 0.1); const l = S.o('triangle', 0.3 + rng.next() * 0.1, t, dur + 0.1), lg = S.g(280); l.connect(lg); lg.connect(o.frequency); o.connect(lp);
}
function murmurBands(S, out, bands, level = 1) { // crowd/voice murmur: formant-shaped noise with per-band slow AM
  const n = S.n('pink', S.t0); for (const [f, q, g] of bands) { const b = S.f('bandpass', f, q), gg = S.g(g * level); n.connect(b); b.connect(gg); gg.connect(out); const am = S.o('sine', 0.15 + (hashStr('m' + f) % 100) / 60, S.t0), ag = S.g(g * level * 0.5); am.connect(ag); ag.connect(gg.gain); }
}
function cricket(S, out, f, rate, depth = 0.5) { // AM'd sine "chirp trains"
  const o = S.o('sine', f, S.t0), g = S.g(0.0); const am = S.o('square', rate, S.t0), ag = S.g(0.5 * depth); const gate = S.o('sine', 0.17 + (f % 7) * 0.02, S.t0), gg = S.g(0.5 * depth); am.connect(ag); ag.connect(g.gain); gate.connect(gg); gg.connect(g.gain); g.gain.value = 0.5 * depth; o.connect(g); g.connect(out);
}
function cicada(S, out, f, rate) {
  const n = S.n('white', S.t0), b = S.f('bandpass', f, 8), g = S.g(0); n.connect(b); b.connect(g); g.connect(out);
  const am = S.o('sawtooth', rate, S.t0), ag = S.g(0.25); am.connect(ag); ag.connect(g.gain); const sw = S.o('sine', 0.09, S.t0), sg = S.g(0.25); sw.connect(sg); sg.connect(g.gain); g.gain.value = 0.35;
}
function laugh(S, t, rng, dest) {
  const pan = S.pan(rng.range(-0.8, 0.8)); const f0 = rng.range(200, 330); const n = rng.int(3, 6); pan.connect(dest);
  for (let i = 0; i < n; i++) { const tt = t + i * 0.16; const o = S.o('sawtooth', f0 * (1 - i * 0.03), tt, 0.14); const g = S.g(0); pluckEnv(g.gain, tt, 0.16 * (1 - i * 0.1), 0.045, 0.01); const b1 = S.f('bandpass', 700, 6), b2 = S.f('bandpass', 1300, 6); o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g); g.connect(pan); }
}
function shout(S, t, rng, dest) {
  const fem = rng.next() < 0.5; const f0 = (fem ? 260 : 130) * rng.range(0.9, 1.2); const d = rng.range(0.4, 1.0); const pan = S.pan(rng.range(-0.8, 0.8)); pan.connect(dest);
  const o = S.o('sawtooth', f0, t, d + 0.1); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * rng.range(1.1, 1.5), t + d * 0.4); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + d);
  const env = S.g(0); line(env.gain, t, [[0, 0], [0.05, 0.2], [d * 0.6, 0.15], [d, 0]]); env.connect(pan);
  for (const [fc, q, g] of [[750, 6, 1], [1250, 7, 0.7], [2600, 6, 0.3]]) { const b = S.f('bandpass', fc * (fem ? 1.15 : 1), q), gg = S.g(g); o.connect(b); b.connect(gg); gg.connect(env); }
}
const noiseBed = (S, out, kind, ftype, f, q, gain) => { const n = S.n(kind, S.t0), fl = S.f(ftype, f, q), g = S.g(gain); n.connect(fl); fl.connect(g); g.connect(out); return { n, f: fl, g }; };

/* ------------------------------------------------------------------ bed definitions: (B) -> void.  B.S persistent Syn, B.out gain, B.ev(rate, fn(t,S,rng,dest)), B.sfxEv(rate,name,mk) */
const wetDefault = [0.1, 0.2];
export const BEDS = {
  city_day(B) {
    const { S, out } = B;
    const t1 = noiseBed(S, out, 'brown', 'lowpass', 380, 0.7, 0.55); wander(S, t1.f.frequency, 120); wander(S, t1.g.gain, 0.12);
    const m1 = noiseBed(S, out, 'pink', 'bandpass', 750, 0.6, 0.22); wander(S, m1.g.gain, 0.07);
    noiseBed(S, out, 'pink', 'highpass', 2600, 0.5, 0.035);
    B.ev(0.09, (t, S2, rng, d) => honk(S2, t, rng, d, 2)); B.ev(0.025, (t, S2, rng, d) => siren(S2, t, rng, d, 6, 0.06)); B.ev(0.16, (t, S2, rng, d) => carPass(S2, t, rng, d, rng.range(3, 6)));
    B.ev(0.035, (t, S2, rng, d) => { const n = rng.int(4, 9); for (let i = 0; i < n; i++) nb(R0(S2, d, rng), t + i * 0.28, { type: 'bandpass', f0: 1800, q: 3, dur: 0.05, peak: 0.1, dest: d }); }); // hammering
    B.ev(0.05, (t, S2, rng, d) => shout(S2, t, rng, d)); B.ev(0.12, (t, S2, rng, d) => bird(S2, t, rng, d));
    B.rev = [0.15, 0.25]; B.g = 0.8;
  },
  city_night(B) {
    const { S, out } = B;
    const t1 = noiseBed(S, out, 'brown', 'lowpass', 260, 0.7, 0.32); wander(S, t1.g.gain, 0.07);
    for (const [f, a] of [[100, 0.035], [200, 0.018], [300, 0.006]]) { const o = S.o('sine', f, S.t0), g = S.g(a); o.connect(g); g.connect(out); } // transformer / AC hum
    const air = noiseBed(S, out, 'pink', 'bandpass', 900, 0.5, 0.05); wander(S, air.g.gain, 0.025);
    cricket(S, out, 4400, 6.5, 0.035); cricket(S, out, 5100, 7.8, 0.03);
    B.ev(0.03, (t, S2, rng, d) => siren(S2, t, rng, d, 7, 0.05)); B.ev(0.04, (t, S2, rng, d) => dogBark(S2, t, rng, d)); B.ev(0.07, (t, S2, rng, d) => carPass(S2, t, rng, d, rng.range(3, 6))); B.ev(0.02, (t, S2, rng, d) => honk(S2, t, rng, d, 3));
    B.rev = [0.2, 0.35]; B.g = 0.8;
  },
  tropical_day(B) {
    const { S, out } = B;
    cicada(S, out, 5200, 31); cicada(S, out, 6400, 43); cicada(S, out, 4300, 27);
    const sea = noiseBed(S, out, 'pink', 'lowpass', 700, 0.6, 0.16); const sl = S.o('sine', 0.09, S.t0), slg = S.g(0.1); sl.connect(slg); slg.connect(sea.g.gain);
    const br = noiseBed(S, out, 'pink', 'bandpass', 500, 0.7, 0.09); wander(S, br.g.gain, 0.05); wander(S, br.f.frequency, 150);
    B.ev(0.55, (t, S2, rng, d) => bird(S2, t, rng, d));
    B.ev(0.012, (t, S2, rng, d) => { const f = rng.range(520, 700); for (let i = 0; i < 5; i++) { const tt = t + i * (i === 3 ? 0.42 : 0.2); const o = S2.o('sawtooth', f * (i === 3 ? 1.25 : 1), tt, 0.3); o.frequency.exponentialRampToValueAtTime(f * 0.6, tt + 0.28); const bp = S2.f('bandpass', 1100, 3), g = S2.g(0); pluckEnv(g.gain, tt, 0.07, 0.08, 0.02); o.connect(bp); bp.connect(g); g.connect(d); } }); // distant rooster
    B.rev = [0.08, 0.2]; B.g = 0.9;
  },
  tropical_night(B) {
    const { S, out } = B;
    [[4300, 6.2], [4650, 7.1], [5050, 5.6], [3900, 8.3], [4900, 6.8]].forEach(([f, r]) => cricket(S, out, f, r, 0.08));
    const sea = noiseBed(S, out, 'pink', 'lowpass', 500, 0.6, 0.1); const sl = S.o('sine', 0.08, S.t0), slg = S.g(0.06); sl.connect(slg); slg.connect(sea.g.gain);
    const br = noiseBed(S, out, 'pink', 'bandpass', 400, 0.7, 0.04); wander(S, br.g.gain, 0.02);
    B.ev(0.22, (t, S2, rng, d) => frog(S2, t, rng, d, rng.range(300, 520))); B.ev(0.02, (t, S2, rng, d) => dogBark(S2, t, rng, d));
    B.ev(0.03, (t, S2, rng, d) => { const f = rng.range(900, 1400); const o = S2.o('sine', f, t, 0.5); const g = S2.g(0); line(g.gain, t, [[0, 0], [0.05, 0.05], [0.45, 0]]); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.4); o.connect(g); g.connect(d); }); // night bird
    B.rev = [0.1, 0.3]; B.g = 0.85;
  },
  ocean(B) {
    const { S, out } = B;
    const waves = (period, f0, a) => {
      const n = S.n('pink', S.t0), lp = S.f('lowpass', f0, 0.6), g = S.g(a * 0.35); n.connect(lp); lp.connect(g); g.connect(out);
      const l = S.o('sine', 1 / period, S.t0), lg = S.g(a * 0.65); l.connect(lg); lg.connect(g.gain); const lf = S.g(f0 * 0.7); l.connect(lf); lf.connect(lp.frequency);
      const foam = S.n('white', S.t0), hp = S.f('highpass', 3500, 0.5), fg = S.g(0); foam.connect(hp); hp.connect(fg); fg.connect(out); const dl = S.delay(period * 0.12, 3); l.connect(dl); const fgg = S.g(a * 0.12); dl.connect(fgg); fgg.connect(fg.gain);
    };
    waves(9.3, 800, 0.5); waves(12.1, 600, 0.4); waves(7.7, 1100, 0.2);
    const deep = noiseBed(S, out, 'brown', 'lowpass', 160, 0.7, 0.4); wander(S, deep.g.gain, 0.15);
    B.ev(0.2, (t, S2, rng, d) => bird(S2, t, rng, d, 0)); B.rev = [0.1, 0.3]; B.g = 0.9;
  },
  wind(B) {
    const { S, out } = B;
    const n = noiseBed(S, out, 'pink', 'bandpass', 420, 0.7, 0.4); wander(S, n.f.frequency, 260, [0.05, 0.11, 0.23]); wander(S, n.g.gain, 0.2, [0.04, 0.09, 0.19]);
    const w = noiseBed(S, out, 'pink', 'bandpass', 1150, 14, 0.07); wander(S, w.f.frequency, 380, [0.06, 0.15, 0.31]); wander(S, w.g.gain, 0.05, [0.05, 0.1, 0.2]);
    const r = noiseBed(S, out, 'brown', 'lowpass', 120, 0.8, 0.3); wander(S, r.g.gain, 0.2, [0.04, 0.08, 0.17]);
    const hi = noiseBed(S, out, 'white', 'highpass', 4000, 0.5, 0.02); wander(S, hi.g.gain, 0.015);
    B.rev = [0.1, 0.25]; B.g = 0.9;
  },
  interior_hum(B) {
    const { S, out } = B;
    for (const [f, a] of [[60, 0.05], [120, 0.032], [180, 0.014], [240, 0.006]]) { const o = S.o('sine', f * 1.0004, S.t0), g = S.g(a); o.connect(g); g.connect(out); }
    const ac = noiseBed(S, out, 'pink', 'lowpass', 650, 0.6, 0.07); wander(S, ac.g.gain, 0.02); noiseBed(S, out, 'brown', 'lowpass', 90, 0.6, 0.22);
    B.ev(0.03, (t, S2, rng, d) => click(R0(S2, d, rng), t, 1800 + rng.next() * 1200, 0.15, 3, d));
    B.ev(0.02, (t, S2, rng, d) => { const f = rng.range(60, 90); const o = S2.o('sawtooth', f, t, 1.2); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 1); const b = S2.f('bandpass', 280, 8), g = S2.g(0); line(g.gain, t, [[0, 0], [0.15, 0.03], [1, 0]]); o.connect(b); b.connect(g); g.connect(d); });
    B.rev = [0.25, 0.1]; B.g = 0.9;
  },
  lab(B) {
    const { S, out } = B;
    const fan = noiseBed(S, out, 'pink', 'bandpass', 260, 0.6, 0.16); wander(S, fan.g.gain, 0.03); noiseBed(S, out, 'white', 'highpass', 5000, 0.5, 0.014);
    const fl = S.o('sawtooth', 120.2, S.t0), fl2 = S.f('lowpass', 700, 1), flg = S.g(0.018); fl.connect(fl2); fl2.connect(flg); flg.connect(out); const flam = S.o('sine', 0.7, S.t0), flag = S.g(0.008); flam.connect(flag); flag.connect(flg.gain);
    const cf = S.o('sine', 190, S.t0), cg = S.g(0.022); wander(S, cf.frequency, 18); cf.connect(cg); cg.connect(out);
    const hum = S.o('sine', 60, S.t0), hgn = S.g(0.04); hum.connect(hgn); hgn.connect(out);
    B.ev(0.09, (t, S2, rng, d) => { const f = rng.pick([1000, 1320, 1760, 880]); const n = rng.int(1, 3); for (let i = 0; i < n; i++) { const tt = t + i * 0.18; const o = S2.o('sine', f, tt, 0.1); const g = S2.g(0); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.06, tt + 0.006); g.gain.setValueAtTime(0.06, tt + 0.07); g.gain.linearRampToValueAtTime(0, tt + 0.09); o.connect(g); g.connect(d); } });
    B.ev(0.03, (t, S2, rng, d) => nb(R0(S2, d, rng), t, { type: 'highpass', f0: 3000, dur: 1.0, peak: 0.07, tc: 0.3, atk: 0.04, dest: d }));
    B.rev = [0.3, 0.12]; B.g = 0.9;
  },
  morgue(B) {
    const { S, out } = B;
    for (const [f, a] of [[55, 0.05], [55.9, 0.04], [110.4, 0.014]]) { const o = S.o('sine', f, S.t0), g = S.g(a); o.connect(g); g.connect(out); }
    const rm = noiseBed(S, out, 'brown', 'lowpass', 100, 0.6, 0.15); wander(S, rm.g.gain, 0.04); noiseBed(S, out, 'white', 'highpass', 4500, 0.5, 0.008);
    B.ev(0.12, (t, S2, rng, d) => { const f = rng.range(900, 1700); const o = S2.o('sine', f, t, 0.3); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.06); const g = S2.g(0); pluckEnv(g.gain, t, 0.1, 0.03, 0.001); o.connect(g); g.connect(d); });
    B.ev(0.04, (t, S2, rng, d) => click(R0(S2, d, rng), t, 1500 + rng.next() * 2500, 0.1, 5, d));
    B.ev(0.015, (t, S2, rng, d) => { const f = rng.range(48, 70); const o = S2.o('sawtooth', f, t, 3); const b = S2.f('bandpass', 200, 6), g = S2.g(0); line(g.gain, t, [[0, 0], [1, 0.03], [3, 0]]); o.connect(b); b.connect(g); g.connect(d); });
    B.rev = [0.35, 0.5]; B.g = 0.85;
  },
  crowd(B) {
    const { S, out } = B;
    murmurBands(S, out, [[320, 1.2, 0.2], [620, 1.4, 0.26], [980, 1.6, 0.22], [1500, 1.5, 0.16], [2300, 1.4, 0.1], [3300, 1.2, 0.05]], 1);
    noiseBed(S, out, 'brown', 'lowpass', 260, 0.7, 0.2);
    B.ev(0.25, (t, S2, rng, d) => shout(S2, t, rng, d)); B.ev(0.07, (t, S2, rng, d) => laugh(S2, t, rng, d));
    B.ev(0.05, (t, S2, rng, d) => { const n = rng.int(5, 12); for (let i = 0; i < n; i++) nb(R0(S2, d, rng), t + i * rng.range(0.06, 0.12), { type: 'bandpass', f0: 2500, q: 0.8, dur: 0.05, peak: 0.05, dest: d }); });
    B.rev = [0.3, 0.3]; B.g = 0.9;
  },
  war_far(B) {
    const { S, out } = B;
    const r = noiseBed(S, out, 'brown', 'lowpass', 110, 0.7, 0.5); wander(S, r.g.gain, 0.2, [0.05, 0.12, 0.27]); const m = noiseBed(S, out, 'pink', 'lowpass', 500, 0.6, 0.07); wander(S, m.g.gain, 0.04);
    B.sfxEv(0.28, 'explosion_far', (rng) => ({ r: rng.range(500, 1500), gain: rng.range(0.4, 1) }));
    B.sfxEv(0.12, 'burst', (rng) => ({ r: rng.range(500, 1200), gain: rng.range(0.2, 0.45) })); B.sfxEv(0.05, 'mg', (rng) => ({ r: rng.range(600, 1300), gain: rng.range(0.15, 0.35) }));
    B.rev = [0.1, 0.5]; B.g = 0.9;
  },
  war_near(B) {
    const { S, out } = B;
    const r = noiseBed(S, out, 'brown', 'lowpass', 130, 0.7, 0.5); wander(S, r.g.gain, 0.2, [0.06, 0.14, 0.31]); const m = noiseBed(S, out, 'pink', 'bandpass', 700, 0.6, 0.07); wander(S, m.g.gain, 0.04);
    const rg = S.o('sine', 5200, S.t0), rgg = S.g(0.0035); rg.connect(rgg); rgg.connect(out);
    B.sfxEv(0.3, 'explosion_small', (rng) => ({ r: rng.range(70, 260), gain: rng.range(0.5, 1) })); B.sfxEv(0.06, 'explosion_big', (rng) => ({ r: rng.range(150, 450), gain: rng.range(0.5, 0.9) }));
    B.sfxEv(0.35, 'burst', (rng) => ({ r: rng.range(40, 220), gain: rng.range(0.4, 0.8) })); B.sfxEv(0.12, 'mg', (rng) => ({ r: rng.range(60, 260), gain: rng.range(0.3, 0.6) })); B.sfxEv(0.18, 'rifle', (rng) => ({ r: rng.range(30, 160), gain: rng.range(0.4, 0.8) }));
    B.sfxEv(0.04, 'cannon', (rng) => ({ r: rng.range(150, 400), gain: rng.range(0.5, 0.9) })); B.sfxEv(0.05, 'scream', (rng) => ({ r: rng.range(50, 200), gain: rng.range(0.2, 0.4) }));
    B.ev(0.12, (t, S2, rng, d) => { const f = rng.range(1800, 2800); const o = S2.o('sine', f, t, 1.6); o.frequency.exponentialRampToValueAtTime(f * 0.3, t + 1.5); const g = S2.g(0); line(g.gain, t, [[0, 0], [0.2, 0.05], [1.5, 0.03], [1.6, 0]]); const pn = S2.pan(rng.range(-0.8, 0.8)); o.connect(g); g.connect(pn); pn.connect(d); }); // shell whistle
    B.ev(0.3, (t, S2, rng, d) => { const n = rng.int(3, 8); for (let i = 0; i < n; i++) nb(R0(S2, d, rng), t + rng.next() * 1.2, { type: 'bandpass', f0: 600 + rng.next() * 3000, q: 1.2, dur: 0.05, peak: 0.07 * rng.next(), dest: d }); }); // falling debris
    B.rev = [0.15, 0.45]; B.g = 0.95;
  },
  rain(B) {
    const { S, out } = B;
    const n = S.n('white', S.t0), hp = S.f('highpass', 900, 0.5), lp = S.f('lowpass', 9500, 0.5), g = S.g(0.16); n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); wander(S, g.gain, 0.025);
    const p = noiseBed(S, out, 'pink', 'lowpass', 1100, 0.6, 0.26); wander(S, p.g.gain, 0.04);
    const d = S.n('crackle', S.t0, undefined, 1.4), df = S.f('bandpass', 4500, 1.2), dg = S.g(0.5); d.connect(df); df.connect(dg); dg.connect(out);
    const d2 = S.n('velvet', S.t0, undefined, 0.9), d2f = S.f('bandpass', 2800, 1.4), d2g = S.g(0.4); d2.connect(d2f); d2f.connect(d2g); d2g.connect(out);
    noiseBed(S, out, 'brown', 'lowpass', 150, 0.6, 0.16);
    B.ev(0.5, (t, S2, rng, d3) => { const f = rng.range(900, 2200); const o = S2.o('sine', f, t, 0.2); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.05); const gg = S2.g(0); pluckEnv(gg.gain, t, 0.05, 0.025, 0.001); const pn = S2.pan(rng.range(-0.9, 0.9)); o.connect(gg); gg.connect(pn); pn.connect(d3); }); // gutter drips
    B.sfxEv(0.012, 'thunder', (rng) => ({ r: rng.range(700, 2000), gain: rng.range(0.5, 1) }));
    B.rev = [0.25, 0.2]; B.g = 0.9;
  },
  space(B) {
    const { S, out } = B;
    for (const [f, a] of [[40, 0.12], [40.7, 0.1], [80.3, 0.05], [121.1, 0.015]]) { const o = S.o('sine', f, S.t0), g = S.g(a); o.connect(g); g.connect(out); }
    const br = noiseBed(S, out, 'brown', 'lowpass', 85, 0.7, 0.28); wander(S, br.g.gain, 0.12, [0.03, 0.07, 0.13]);
    const sh1 = S.o('sine', 3200, S.t0), sh2 = S.o('sine', 3206.5, S.t0), shg = S.g(0.004); sh1.connect(shg); sh2.connect(shg); shg.connect(out); wander(S, shg.gain, 0.003, [0.04, 0.09, 0.2]);
    const rd = noiseBed(S, out, 'pink', 'bandpass', 2000, 12, 0.004); wander(S, rd.f.frequency, 600, [0.03, 0.07, 0.13]);
    B.ev(0.015, (t, S2, rng, d) => { const f = rng.range(400, 1100); const o = S2.o('sine', f, t, 5); const g = S2.g(0); pluckEnv(g.gain, t, 0.035, 1.2, 0.01); o.connect(g); g.connect(d); });
    B.rev = [0.2, 0.7]; B.g = 0.95;
  },
  alien_hum(B) {
    const { S, out } = B;
    const bank = S.g(0.7); bank.connect(out);
    [[55, 0.5], [55.45, 0.45], [82.4, 0.3], [110.8, 0.18]].forEach(([f, a]) => { const o = S.o('sawtooth', f, S.t0), g = S.g(a); o.connect(g); for (const [fc, q, gg] of [[260, 8, 1], [580, 9, 0.7], [1100, 10, 0.4]]) { const b = S.f('bandpass', fc, q), bg = S.g(gg * a * 0.5); g.connect(b); b.connect(bg); bg.connect(bank); wander(S, b.frequency, fc * 0.12, [0.04, 0.09, 0.17]); } });
    const br = S.o('sine', 0.12, S.t0), brg = S.g(0.3); br.connect(brg); brg.connect(bank.gain);
    const sub = S.o('sine', 41.2, S.t0), sg = S.g(0.1); sub.connect(sg); sg.connect(out);
    const n = noiseBed(S, out, 'pink', 'bandpass', 3000, 14, 0.012); wander(S, n.f.frequency, 900, [0.05, 0.11, 0.23]);
    B.ev(0.22, (t, S2, rng, d) => { const pn = S2.pan(rng.range(-0.8, 0.8)); pn.connect(d); const n2 = rng.int(3, 7); let tt = t; for (let i = 0; i < n2; i++) { nb(R0(S2, d, rng), tt, { type: 'bandpass', f0: rng.range(900, 3000), q: 11, dur: 0.02, peak: 0.12, tc: 0.0045, dest: pn }); tt += rng.pick([0.05, 0.08, 0.12]); } });
    B.ev(0.05, (t, S2, rng, d) => { const f = rng.range(180, 400); const o = S2.o('sawtooth', f, t, 1.5); o.frequency.exponentialRampToValueAtTime(f * rng.range(0.5, 1.8), t + 1.3); const b = S2.f('bandpass', 700, 6), g = S2.g(0); line(g.gain, t, [[0, 0], [0.3, 0.035], [1.4, 0]]); const fl = S2.o('sine', 31, t, 1.6), fg = S2.g(0.5); fl.connect(fg); fg.connect(g.gain); o.connect(b); b.connect(g); g.connect(d); });
    B.rev = [0.2, 0.6]; B.g = 0.9;
  },
  fire(B) {
    const { S, out } = B;
    const r = noiseBed(S, out, 'brown', 'lowpass', 420, 0.7, 0.4); wander(S, r.g.gain, 0.12, [0.09, 0.19, 0.41]); const m = noiseBed(S, out, 'pink', 'bandpass', 900, 0.6, 0.12); wander(S, m.g.gain, 0.06, [0.11, 0.23, 0.47]);
    const c = S.n('crackle', S.t0, undefined, 1.0), cf = S.f('highpass', 1500, 0.6), cg = S.g(0.5); c.connect(cf); cf.connect(cg); cg.connect(out);
    const c2 = S.n('crackle', S.t0, undefined, 0.7), c2f = S.f('bandpass', 3200, 1), c2g = S.g(0.4); c2.connect(c2f); c2f.connect(c2g); c2g.connect(out);
    B.ev(0.9, (t, S2, rng, d) => nb(R0(S2, d, rng), t, { type: 'bandpass', f0: rng.range(1200, 4200), q: 1.5, dur: 0.03, peak: 0.14 * (0.3 + rng.next()), tc: 0.007, dest: d }));
    B.ev(0.1, (t, S2, rng, d) => { th(R0(S2, d, rng), t, { f0: 160, f1: 70, dur: 0.1, peak: 0.12, tc: 0.025, dest: d }); nb(R0(S2, d, rng), t, { type: 'highpass', f0: 2500, dur: 0.02, peak: 0.2, tc: 0.004, dest: d }); });
    B.rev = [0.1, 0.15]; B.g = 0.95;
  },
  snow_wind(B) {
    const { S, out } = B;
    const n = noiseBed(S, out, 'pink', 'bandpass', 330, 0.5, 0.3); wander(S, n.f.frequency, 160, [0.04, 0.09, 0.19]); wander(S, n.g.gain, 0.12, [0.03, 0.08, 0.17]);
    const h = noiseBed(S, out, 'white', 'highpass', 3200, 0.5, 0.03); wander(S, h.g.gain, 0.02, [0.05, 0.11, 0.23]); noiseBed(S, out, 'brown', 'lowpass', 100, 0.8, 0.16);
    B.ev(0.05, (t, S2, rng, d) => { const f2 = rng.range(550, 900); const o = S2.n('pink', t, 5), b = S2.f('bandpass', f2, 18), g2 = S2.g(0); line(g2.gain, t, [[0, 0], [2, 0.07], [5, 0]]); line(b.frequency, t, [[0, f2], [2.5, f2 * 1.3], [5, f2 * 0.9]]); o.connect(b); b.connect(g2); g2.connect(d); });
    B.rev = [0.15, 0.4]; B.g = 0.9;
  },
  mall(B) {
    const { S, out } = B;
    murmurBands(S, out, [[300, 1.0, 0.16], [600, 1.2, 0.2], [950, 1.4, 0.16], [1500, 1.3, 0.1], [2400, 1.2, 0.05]], 1);
    const esc = S.o('sawtooth', 68, S.t0), ef = S.f('lowpass', 280, 1), eg = S.g(0.03); esc.connect(ef); ef.connect(eg); eg.connect(out); noiseBed(S, out, 'pink', 'bandpass', 1400, 0.8, 0.025); noiseBed(S, out, 'white', 'highpass', 4000, 0.5, 0.01);
    const prog = [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [55, 59, 62, 66]]; let k = 0; // muzak: slow soft e-piano arpeggio
    B.ev(1.6, (t, S2, rng, d) => { const ch = prog[Math.floor(k / 4) % prog.length]; const m = ch[rng.int(0, 3)] + (rng.next() < 0.3 ? 12 : 0); k++; const f = mtof(m); const car = S2.o('sine', f, t, 2.5), mod = S2.o('sine', f, t, 2.5), md = S2.g(0); pluckEnv(md.gain, t, f * 1.2, 0.3, 0.003); mod.connect(md); md.connect(car.frequency); const g = S2.g(0); pluckEnv(g.gain, t, 0.035, 0.6, 0.004); car.connect(g); g.connect(d); });
    B.ev(0.02, (t, S2, rng, d) => { for (const [dt, m] of [[0, 84], [0.42, 79]]) { const f = mtof(m); const o = S2.o('sine', f, t + dt, 2); const o2 = S2.o('sine', f * 2.756, t + dt, 1.2); const g = S2.g(0), g2 = S2.g(0); pluckEnv(g.gain, t + dt, 0.05, 0.5, 0.002); pluckEnv(g2.gain, t + dt, 0.015, 0.2, 0.002); o.connect(g); o2.connect(g2); g.connect(d); g2.connect(d); } }); // PA chime
    B.ev(0.12, (t, S2, rng, d) => shout(S2, t, rng, d)); B.ev(0.05, (t, S2, rng, d) => laugh(S2, t, rng, d));
    B.rev = [0.45, 0.5]; B.g = 0.85;
  },
  bar(B) {
    const { S, out } = B;
    murmurBands(S, out, [[300, 1.1, 0.16], [560, 1.3, 0.2], [900, 1.5, 0.16], [1400, 1.4, 0.1], [2200, 1.2, 0.05]], 0.9);
    const mus = S.g(0.5); const mf = S.f('lowpass', 330, 0.9); mf.connect(mus); mus.connect(out); // muffled music through the wall: pad + kick
    for (const [f, a] of [[110, 0.07], [138.6, 0.05], [164.8, 0.05], [207.7, 0.03]]) { const o = S.o('sawtooth', f, S.t0), g = S.g(a); o.connect(g); g.connect(mf); }
    const neon = S.o('sawtooth', 120, S.t0), nf = S.f('lowpass', 500, 1), ng = S.g(0.012); neon.connect(nf); nf.connect(ng); ng.connect(out);
    B.ev(2, (t, S2, rng, d) => { const o = S2.o('sine', 62, t, 0.4); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); const g = S2.g(0); pluckEnv(g.gain, t, 0.22, 0.09, 0.003); const lp = S2.f('lowpass', 160, 0.7); o.connect(g); g.connect(lp); lp.connect(d); }); // muffled kick
    B.ev(0.45, (t, S2, rng, d) => { const f = rng.range(2600, 4800); ring(R0(S2, d, rng), t, { fs: [f, f * 1.51, f * 2.3], dur: 0.35, peak: 0.07, dest: d }); }); // glass clinks
    B.ev(0.1, (t, S2, rng, d) => { th(R0(S2, d, rng), t, { f0: 330, f1: 190, dur: 0.1, peak: 0.1, tc: 0.025, dest: d }); nb(R0(S2, d, rng), t, { type: 'bandpass', f0: 1800, q: 2, dur: 0.04, peak: 0.07, dest: d }); }); // bottle on wood
    B.ev(0.1, (t, S2, rng, d) => laugh(S2, t, rng, d)); B.ev(0.12, (t, S2, rng, d) => shout(S2, t, rng, d));
    B.rev = [0.3, 0.2]; B.g = 0.9;
  },
  traffic(B) {
    const { S, out } = B;
    const rd = noiseBed(S, out, 'brown', 'lowpass', 320, 0.7, 0.5); wander(S, rd.g.gain, 0.12, [0.08, 0.17, 0.33]); const ty = noiseBed(S, out, 'pink', 'bandpass', 1800, 0.6, 0.12); wander(S, ty.g.gain, 0.06, [0.1, 0.23, 0.37]);
    B.ev(0.3, (t, S2, rng, d) => carPass(S2, t, rng, d, rng.range(2.5, 5))); B.ev(0.14, (t, S2, rng, d) => honk(S2, t, rng, d, 1.5));
    B.ev(0.08, (t, S2, rng, d) => { const dir = rng.sign(); const dur = rng.range(2, 3.5); const pan = S2.pan(-0.8 * dir); line(pan.pan, t, [[0, -0.8 * dir], [dur, 0.8 * dir]]); pan.connect(d); const f = rng.range(120, 180); const o = S2.o('sawtooth', f, t, dur + 0.1); line(o.frequency, t, [[0, f * 1.1], [dur * 0.5, f * 1.1], [dur * 0.56, f * 0.88], [dur, f * 0.86]]); const lp = S2.f('lowpass', 1800, 0.8), g = S2.g(0); line(g.gain, t, [[0, 0], [dur * 0.5, 0.1], [dur, 0]]); o.connect(lp); lp.connect(g); g.connect(pan); }); // motorbike
    B.rev = [0.15, 0.2]; B.g = 0.9;
  },
  jungle(B) {
    const { S, out } = B;
    cicada(S, out, 3700, 22); cicada(S, out, 5000, 36); cicada(S, out, 6800, 51); cicada(S, out, 2900, 17);
    noiseBed(S, out, 'pink', 'lowpass', 1300, 0.6, 0.06); const br = noiseBed(S, out, 'pink', 'bandpass', 450, 0.7, 0.06); wander(S, br.g.gain, 0.03);
    B.ev(0.9, (t, S2, rng, d) => bird(S2, t, rng, d)); B.ev(0.4, (t, S2, rng, d) => frog(S2, t, rng, d, rng.range(280, 620)));
    B.ev(0.5, (t, S2, rng, d) => { const f = rng.range(900, 1700); const o = S2.o('sine', f, t, 0.2); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.06); const g = S2.g(0); pluckEnv(g.gain, t, 0.07, 0.03, 0.001); const pn = S2.pan(rng.range(-0.9, 0.9)); o.connect(g); g.connect(pn); pn.connect(d); });
    B.ev(0.045, (t, S2, rng, d) => { const f = rng.range(380, 620); const d2 = rng.range(0.9, 1.6); const o = S2.o('sawtooth', f, t, d2 + 0.1); line(o.frequency, t, [[0, f], [d2 * 0.3, f * 1.5], [d2, f * 0.7]]); const e = S2.g(0); line(e.gain, t, [[0, 0], [0.1, 0.09], [d2 * 0.7, 0.06], [d2, 0]]); for (const [fc, q, g] of [[700, 6, 1], [1400, 7, 0.6]]) { const b = S2.f('bandpass', fc, q), gg = S2.g(g); o.connect(b); b.connect(gg); gg.connect(e); } const pn = S2.pan(rng.range(-0.8, 0.8)); e.connect(pn); pn.connect(d); }); // monkey-ish hoot
    B.rev = [0.15, 0.3]; B.g = 0.9;
  },
};

/* ------------------------------------------------------------------ manager */
export function createAmb(A) {
  const ctx = A.ctx; const beds = new Map(); const warned = new Set();
  class Bed {
    constructor(name, def) {
      this.name = name; this.level = 0; this.g = 1; this.rev = wetDefault; this.events = []; this.sfxEvents = []; this.dead = false; this.stopAt = Infinity; this.fading = false; this.rng = new RNG(hashStr('amb-' + name));
      this.out = ctx.createGain(); this.out.gain.value = 0; this.wS = ctx.createGain(); this.wL = ctx.createGain(); const bus = A.bus.amb; this.out.connect(bus.dry); this.out.connect(this.wS); this.out.connect(this.wL); this.wS.connect(bus.wetS); this.wL.connect(bus.wetL);
      this.S = new Syn(A, null, A.now(), 'amb'); this.S.nodes.push(this.out, this.wS, this.wL);
      const B = { S: this.S, out: this.out, rev: wetDefault, g: 1,
        ev: (rate, fn) => this.events.push({ rate, fn, next: A.now() + this.rng.range(0.2, 1 / Math.max(rate, 0.01)) }),
        sfxEv: (rate, name2, mk) => this.sfxEvents.push({ rate, name: name2, mk, next: A.now() + this.rng.range(0.5, 1.5 / Math.max(rate, 0.01)) }) };
      def(B); this.g = B.g; this.rev = B.rev; this.wS.gain.value = this.rev[0]; this.wL.gain.value = this.rev[1];
    }
    pump(now, until) {
      if (this.level < 0.01 && this.fading) return;
      for (const ev of this.events) {
        let guard = 0;
        while (ev.next < until && guard++ < 8) {
          if (ev.next >= now - 0.05 && A.live.amb < A.caps.amb) { const S2 = new Syn(A, this.out, Math.max(ev.next, now), 'amb'); try { ev.fn(Math.max(ev.next, now), S2, this.rng, this.out); } catch (e) { if (!warned.has(this.name)) { warned.add(this.name); console.warn('[audio] amb event error', this.name, e); } } if (!S2.srcs.length) S2.dispose(); }
          ev.next += -Math.log(1 - this.rng.next() * 0.999) / ev.rate;
        }
      }
      if (A.api && A.api.sfx) {
        for (const ev of this.sfxEvents) {
          let guard = 0;
          while (ev.next < until && guard++ < 4) {
            if (ev.next >= now - 0.05 && A.live.sfx < A.caps.sfx - 6) {
              const p = ev.mk(this.rng); const ang = this.rng.range(0, Math.PI * 2); const L = A.listener;
              A.api.sfx.play(ev.name, { pos: { x: L.x + Math.cos(ang) * p.r, y: L.y + this.rng.range(0, 20), z: L.z + Math.sin(ang) * p.r }, gain: p.gain * this.level * Math.min(1.5, A.bus.amb.vol), delay: Math.max(0, ev.next - now) });
            }
            ev.next += -Math.log(1 - this.rng.next() * 0.999) / ev.rate;
          }
        }
      }
    }
    setLevel(l, fade) {
      const now = A.now(); this.level = l; this.fading = l <= 0.001; this.out.gain.cancelScheduledValues(now); this.out.gain.setValueAtTime(this.out.gain.value, now); this.out.gain.setTargetAtTime(l * this.g, now, Math.max(0.01, fade / 3));
      this.stopAt = l <= 0.001 ? now + fade * 1.4 + 0.3 : Infinity;
    }
    dispose() { if (this.dead) return; this.dead = true; this.S.stopAt(A.now() + 0.05); for (const n of [this.out, this.wS, this.wL]) { try { n.disconnect(); } catch (e) { /* */ } } }
  }
  A.addTicker((now, until) => { for (const [k, b] of beds) { if (b.dead) { beds.delete(k); continue; } if (b.stopAt < now) { b.dispose(); beds.delete(k); continue; } b.pump(now, until); } });
  const api = {
    /** set(name, level01, fade=2): crossfade-friendly; level 0 fades the bed out and frees it. 'silence' clears everything. */
    set(name, level = 1, fade = 2) {
      if (name === 'silence' || !name) { api.clear(fade); return; }
      const def = BEDS[name]; if (!def) { if (!warned.has(name)) { warned.add(name); console.warn('[audio] unknown ambience', name); } return; }
      let b = beds.get(name); if (!b || b.dead) { if (level <= 0.001) return; b = new Bed(name, def); beds.set(name, b); }
      b.setLevel(cl(level, 0, 1.5), fade);
    },
    /** fade out every bed */
    clear(fade = 2) { for (const b of beds.values()) b.setLevel(0, fade); },
    names: () => ['silence', ...Object.keys(BEDS)],
    get active() { return [...beds.values()].filter((b) => b.level > 0.001).map((b) => b.name); },
  };
  return api;
}
