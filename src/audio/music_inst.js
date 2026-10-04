// Music instruments (all synthesised).  Pitched: fn(L, t, dur, midi, vel, o)   Percussion/FX: fn(L, t, vel, o)
// `L` is a music layer: { A, ctx, in (note input, runs through the layer's fx chain), vib (shared vibrato LFO gain or null), rng, syn(t) }.
import { mtof, adsr, pluckEnv, sweep, line, noiseBuffer, ksBuffer, cl, lin, pos, VOWELS } from './dsp.js';
import { nb, th, ring, grains, formants, vox, click, brassWave } from './sfx_recipes.js';

const mkR = (L, S, t) => ({ A: L.A, ctx: L.ctx, S, rng: L.rng, F: (f) => f, D: (d) => d, out: L.in, t0: t, pitch: 1, h: {}, sustain: false });
const vmul = (v) => 0.25 + 0.75 * cl(v, 0, 1.2);

/* ================================================================== PITCHED */
export const INST = {
  /** lush string ensemble: detuned saws + octave triangle; the layer adds filter + chorus */
  strings(L, t, dur, m, v, o = {}) {
    const S = L.syn(t), f = mtof(m), rel = o.rel ?? 1.4, att = o.att ?? 0.9; const g = S.g(0);
    const end = adsr(g.gain, t, 0.2 * vmul(v), att, 0.5, 0.88, dur, rel); const d = end - t + 0.05;
    for (const dc of [-9, 8]) { const os = S.o('sawtooth', f, t, d); os.detune.value = dc; if (L.vib) S.mod(L.vib, os.detune); os.connect(g); }
    const o2 = S.o('triangle', f * 2, t, d), g2 = S.g(0.28); o2.connect(g2); g2.connect(g); g.connect(L.in);
  },
  warm(L, t, dur, m, v, o = {}) { // soft pad: triangle+saw with a low cutoff (layer)
    const S = L.syn(t), f = mtof(m); const g = S.g(0); const end = adsr(g.gain, t, 0.26 * vmul(v), o.att ?? 1.2, 0.5, 0.9, dur, o.rel ?? 1.8); const d = end - t + 0.05;
    for (const [ty, dc, a] of [['triangle', -5, 1], ['sawtooth', 6, 0.45], ['sine', 0, 0.5]]) { const os = S.o(ty, ty === 'sine' ? f * 0.5 : f, t, d); os.detune.value = dc; const ga = S.g(a); os.connect(ga); ga.connect(g); if (L.vib && ty !== 'sine') S.mod(L.vib, os.detune); }
    g.connect(L.in);
  },
  glass(L, t, dur, m, v, o = {}) { // airy high pad, slightly detuned sines with shimmer
    const S = L.syn(t), f = mtof(m); const g = S.g(0); const end = adsr(g.gain, t, 0.12 * vmul(v), o.att ?? 1.6, 0.6, 0.8, dur, o.rel ?? 2.2); const d = end - t + 0.05;
    for (const [mul, dc, a] of [[1, -4, 1], [1, 5, 0.9], [2, 0, 0.35], [3.01, 3, 0.12]]) { const os = S.o('sine', f * mul, t, d); os.detune.value = dc; const ga = S.g(a); os.connect(ga); ga.connect(g); }
    const tr = S.o('sine', 4.8 + L.rng.next() * 1.2, t, d), tg = S.g(0.22); tr.connect(tg); S.mod(tg, g.gain); g.connect(L.in);
  },
  organ(L, t, dur, m, v, o = {}) { // drawbar-ish additive tone
    const S = L.syn(t), f = mtof(m); const g = S.g(0); const end = adsr(g.gain, t, 0.16 * vmul(v), o.att ?? 0.5, 0.3, 0.95, dur, o.rel ?? 0.9); const d = end - t + 0.05;
    [[1, 1], [2, 0.7], [3, 0.4], [4, 0.35], [6, 0.18], [8, 0.1]].forEach(([k, a], i) => { const os = S.o('sine', f * k, t, d); if (i === 1) os.detune.value = 3; const ga = S.g(a * 0.6); os.connect(ga); ga.connect(g); });
    g.connect(L.in);
  },
  brass(L, t, dur, m, v, o = {}) { // swelling brass: two saws, filter opens with the swell, slow vibrato
    const S = L.syn(t), f = mtof(m); const att = o.att ?? 0.22, rel = o.rel ?? 0.6, vv = vmul(v);
    const g = S.g(0); const end = adsr(g.gain, t, 0.3 * vv, att, 0.35, 0.85, dur, rel); const d = end - t + 0.05;
    const lp = S.f('lowpass', 300, 1.6); const top = 900 + 3800 * vv * (o.bright ?? 1); line(lp.frequency, t, [[0, 260], [att * 1.1, top], [att * 1.1 + 0.5, top * 0.62]]);
    const vb = S.o('sine', 5.1, t, d), vg = S.g(0); line(vg.gain, t, [[0, 0], [0.4, 0], [1.0, 7]]); vb.connect(vg);
    for (const dc of [-6, 6]) { const os = S.o('sawtooth', f, t, d); os.detune.value = dc; S.mod(vg, os.detune); os.connect(lp); }
    const sb = S.o('square', f * 0.5, t, d), sg = S.g(0.4); sb.connect(sg); sg.connect(lp); lp.connect(g); g.connect(L.in);
  },
  horn(L, t, dur, m, v, o = {}) { // rounder, darker brass (French horn-ish)
    const S = L.syn(t), f = mtof(m); const att = o.att ?? 0.3, vv = vmul(v); const g = S.g(0); const end = adsr(g.gain, t, 0.34 * vv, att, 0.4, 0.88, dur, o.rel ?? 0.8); const d = end - t + 0.05;
    const lp = S.f('lowpass', 500, 1.2); line(lp.frequency, t, [[0, 360], [att, 1200 + 900 * vv], [att + 0.6, 1000]]);
    const vb = S.o('sine', 5.0, t, d), vg = S.g(0); line(vg.gain, t, [[0, 0], [0.5, 0], [1.2, 6]]); vb.connect(vg);
    for (const [ty, dc, a] of [['sawtooth', -4, 1], ['sawtooth', 5, 0.8], ['triangle', 0, 0.7]]) { const os = S.o(ty, f, t, d); os.detune.value = dc; S.mod(vg, os.detune); const ga = S.g(a); os.connect(ga); ga.connect(lp); }
    lp.connect(g); g.connect(L.in);
  },
  stab(L, t, dur, m, v, o = {}) { // short brass/string stab
    return INST.brass(L, t, Math.min(dur, 0.32), m, v, { att: 0.02, rel: 0.2, bright: 1.3, ...o });
  },
  choir(L, t, dur, m, v, o = {}) { // raw voices: the layer's formant bank turns saws into "ahh"
    const S = L.syn(t), f = mtof(m); const g = S.g(0); const end = adsr(g.gain, t, 0.3 * vmul(v), o.att ?? 0.8, 0.5, 0.9, dur, o.rel ?? 1.4); const d = end - t + 0.05;
    for (const dc of [-7, 5]) { const os = S.o('sawtooth', f, t, d); os.detune.value = dc; if (L.vib) S.mod(L.vib, os.detune); os.connect(g); }
    const br = S.n('white', t, d), bg = S.g(0.05); br.connect(bg); bg.connect(g); g.connect(L.in);
  },
  cello(L, t, dur, m, v, o = {}) { // bowed low string: saw+square, bite on the attack
    const S = L.syn(t), f = mtof(m); const vv = vmul(v); const g = S.g(0); const end = adsr(g.gain, t, 0.36 * vv, o.att ?? 0.03, 0.2, 0.75, dur, o.rel ?? 0.18); const d = end - t + 0.05;
    const lp = S.f('lowpass', 500, 1.1); line(lp.frequency, t, [[0, 420], [0.05, 1500 + 1200 * vv], [0.35, 800 + 400 * vv]]);
    const vb = S.o('sine', 5.2, t, d), vg = S.g(0); line(vg.gain, t, [[0, 0], [0.25, 0], [0.7, 8]]); vb.connect(vg);
    for (const [ty, dc, a] of [['sawtooth', -4, 1], ['sawtooth', 5, 0.8], ['square', 0, 0.35]]) { const os = S.o(ty, f, t, d); os.detune.value = dc; S.mod(vg, os.detune); const ga = S.g(a); os.connect(ga); ga.connect(lp); }
    lp.connect(g); g.connect(L.in);
  },
  spicc(L, t, dur, m, v, o = {}) { // detached strings (ostinato)
    const S = L.syn(t), f = mtof(m); const vv = vmul(v); const g = S.g(0); pluckEnv(g.gain, t, 0.38 * vv, o.tc ?? 0.075, 0.006);
    const lp = S.f('lowpass', 2600, 0.9); line(lp.frequency, t, [[0, 2400 + 1500 * vv], [0.18, 700]]);
    for (const dc of [-6, 6]) { const os = S.o('sawtooth', f, t, 0.5); os.detune.value = dc; os.connect(lp); }
    lp.connect(g); g.connect(L.in);
  },
  pluck(L, t, dur, m, v, o = {}) { // Karplus-Strong string (pre-rendered buffer per pitch, retuned by playbackRate)
    const f = mtof(m); const buf = ksBuffer(L.ctx, f, { decay: o.decay ?? 0.997, bright: o.bright ?? 0.45, secs: o.secs ?? 1.9 }); const rate = f / buf._f; const S = L.syn(t);
    const ring = Math.min(o.ring ?? 1.7, buf.duration / rate - 0.1); const src = S.buf(buf, t, ring + 0.1, rate); const g = S.g(0.75 * vmul(v));
    g.gain.setValueAtTime(0.75 * vmul(v), t); g.gain.setTargetAtTime(0, t + ring - 0.35, 0.1); src.connect(g); g.connect(L.in);
  },
  harp(L, t, dur, m, v, o = {}) { return INST.pluck(L, t, dur, m, v, { decay: 0.9985, bright: 0.65, secs: 2.2, ring: 2.0, ...o }); },
  piano(L, t, dur, m, v, o = {}) { // additive with inharmonic stretch, faster-decaying upper partials, felt-hammer noise
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const tc = cl(2.4 - m / 42, 0.3, 2.4) * (o.sustain ?? 1); const g = S.g(0.9); g.connect(L.in);
    const amps = [1, 0.55, 0.34, 0.2, 0.12, 0.07]; const br = 0.5 + vv * 0.8; const life = Math.min(tc * 6 + 0.2, Math.max(dur, 0.2) + (o.ring ?? 1.2) + 1.8);
    amps.forEach((a, i) => {
      const k = i + 1; const fk = f * k * Math.sqrt(1 + 0.00035 * k * k); if (fk > 11000) return;
      const os = S.o('sine', fk, t, life); const ge = S.g(0); pluckEnv(ge.gain, t, 0.3 * vv * a * (i ? Math.pow(br, i * 0.5) : 1), tc / (1 + 0.9 * i), 0.003); os.connect(ge); ge.connect(g);
      if (i < 2) { const o2 = S.o('sine', fk * 1.0009, t, life); const g2 = S.g(0); pluckEnv(g2.gain, t, 0.2 * vv * a, tc / (1 + 0.9 * i), 0.003); o2.connect(g2); g2.connect(g); }
    });
    nb(mkR(L, S, t), t, { type: 'bandpass', f0: 1800, q: 0.9, dur: 0.05, peak: 0.1 * vv, tc: 0.01 });
    g.gain.setValueAtTime(0.9, t); g.gain.setTargetAtTime(0, t + Math.max(dur, 0.2) + (o.ring ?? 1.2), 0.25);
  },
  epiano(L, t, dur, m, v, o = {}) { // tine electric piano via FM
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const car = S.o('sine', f, t, 4); const mod = S.o('sine', f, t, 4), md = S.g(0); pluckEnv(md.gain, t, f * 1.8 * vv, 0.5, 0.002); mod.connect(md); S.mod(md, car.frequency);
    const m2 = S.o('sine', f * 14, t, 1), m2g = S.g(0); pluckEnv(m2g.gain, t, f * 0.9 * vv, 0.035, 0.001); m2.connect(m2g); S.mod(m2g, car.frequency);
    const g = S.g(0); pluckEnv(g.gain, t, 0.38 * vv, o.tc ?? 1.0, 0.003); g.gain.setTargetAtTime(0, t + Math.max(0.3, dur), 0.18); car.connect(g); g.connect(L.in);
  },
  bell(L, t, dur, m, v, o = {}) { // inharmonic FM bell / glockenspiel
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const tc = (o.tc ?? 1.5) * cl(1.6 - (m - 60) / 60, 0.5, 1.4); const car = S.o('sine', f, t, tc * 7 + 0.2);
    const mod = S.o('sine', f * 3.5, t, tc * 5), md = S.g(0); pluckEnv(md.gain, t, f * 2.2 * vv, tc * 0.6, 0.001); mod.connect(md); S.mod(md, car.frequency);
    const g = S.g(0); pluckEnv(g.gain, t, 0.3 * vv, tc, 0.001); car.connect(g); g.connect(L.in);
    for (const [r, a, k] of [[2.756, 0.35, 0.6], [5.404, 0.18, 0.35], [8.93, 0.08, 0.2]]) { if (f * r > 12000) continue; const p = S.o('sine', f * r, t, tc * 4 + 0.1), pg = S.g(0); pluckEnv(pg.gain, t, 0.3 * vv * a, tc * k, 0.001); p.connect(pg); pg.connect(L.in); }
  },
  sub(L, t, dur, m, v, o = {}) { // sub bass: sine + saturated triangle so small speakers still hear it
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const g = S.g(0); const end = adsr(g.gain, t, 0.5 * vv, o.att ?? 0.5, 0.4, 0.92, dur, o.rel ?? 1.0); const d = end - t + 0.05;
    const a = S.o('sine', f, t, d), b = S.o('triangle', f * 2, t, d), bg = S.g(0.4), sh = S.shaper('tanh', 2.5), c = S.o('sawtooth', f, t, d), cf = S.f('lowpass', 170, 0.7), cg = S.g(0.3);
    a.connect(g); b.connect(bg); bg.connect(sh); sh.connect(g); c.connect(cf); cf.connect(cg); cg.connect(g); g.connect(L.in);
  },
  dronesaw(L, t, dur, m, v, o = {}) { // dark saw drone, filter breathing
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const g = S.g(0); const end = adsr(g.gain, t, 0.3 * vv, o.att ?? 2.5, 0.5, 0.9, dur, o.rel ?? 3); const d = end - t + 0.05;
    const lp = S.f('lowpass', 220, 1.5), lf = S.o('sine', 0.09 + L.rng.next() * 0.07, t, d), lg = S.g(110); lf.connect(lg); S.mod(lg, lp.frequency);
    for (const dc of [-10, 0, 9]) { const os = S.o('sawtooth', f, t, d); os.detune.value = dc; os.connect(lp); }
    const sb = S.o('sine', f * 0.5, t, d), sg = S.g(0.7); sb.connect(sg); sg.connect(lp); lp.connect(g); g.connect(L.in);
  },
  synbass(L, t, dur, m, v, o = {}) { // punchy saw bass with filter pluck
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const g = S.g(0); const d = Math.max(0.08, dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * vv, t + 0.006); g.gain.setValueAtTime(0.5 * vv, t + d); g.gain.setTargetAtTime(0, t + d, 0.05);
    const lp = S.f('lowpass', 900, 3); line(lp.frequency, t, [[0, 160 + 1300 * vv * (o.bright ?? 1)], [0.2, 140 + 160 * vv]]); const sh = S.shaper('tanh', 2.2);
    for (const [ty, mul, a] of [['sawtooth', 1, 1], ['square', 0.5, 0.6]]) { const os = S.o(ty, f * mul, t, d + 0.4); const ga = S.g(a); os.connect(ga); ga.connect(sh); }
    sh.connect(lp); lp.connect(g); g.connect(L.in);
  },
  arpsyn(L, t, dur, m, v, o = {}) { // bright saw pluck for arpeggios
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const g = S.g(0); pluckEnv(g.gain, t, 0.32 * vv, o.tc ?? 0.12, 0.003);
    const lp = S.f('lowpass', 3000, 3.5); line(lp.frequency, t, [[0, 600 + 4200 * vv], [0.16, 420]]);
    for (const dc of [-8, 8]) { const os = S.o(o.wave || 'sawtooth', f, t, 0.9); os.detune.value = dc; os.connect(lp); }
    lp.connect(g); g.connect(L.in);
  },
  solo(L, t, dur, m, v, o = {}) { // solo violin/cello lead with delayed vibrato and body resonances
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const att = o.att ?? 0.14; const g = S.g(0); const end = adsr(g.gain, t, 0.3 * vv, att, 0.3, 0.85, dur, o.rel ?? 0.5); const d = end - t + 0.05;
    const vb = S.o('sine', 5.4, t, d), vg = S.g(0); line(vg.gain, t, [[0, 0], [Math.min(0.5, dur * 0.5), 0], [Math.min(1.2, dur), o.vib ?? 15]]); vb.connect(vg);
    const lp = S.f('lowpass', 3400, 0.8); const body1 = S.f('peaking', 320, 1.2, 5), body2 = S.f('peaking', 1450, 1.5, 4);
    for (const dc of [-3, 4]) { const os = S.o('sawtooth', f, t, d); os.detune.value = dc; S.mod(vg, os.detune); os.connect(lp); }
    lp.connect(body1); body1.connect(body2); body2.connect(g); g.connect(L.in);
  },
  vox(L, t, dur, m, v, o = {}) { // wordless solo voice: saw -> vowel formants, breathy, vibrato
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const vow = VOWELS[o.vowel || 'a'] || VOWELS.a; const sc = m > 66 ? 1.18 : m > 58 ? 1.08 : 1;
    const g = S.g(0); const end = adsr(g.gain, t, 0.36 * vv, o.att ?? 0.18, 0.3, 0.9, dur, o.rel ?? 0.6); const d = end - t + 0.05;
    const vb = S.o('sine', 5.6, t, d), vg = S.g(0); line(vg.gain, t, [[0, 0], [Math.min(0.4, dur * 0.4), 0], [Math.min(1, dur), 13]]); vb.connect(vg);
    const src = S.g(1); for (const dc of [-3, 3]) { const os = S.o('sawtooth', f, t, d); os.detune.value = dc; S.mod(vg, os.detune); os.connect(src); }
    const bn = S.n('white', t, d), bg = S.g(0.07); bn.connect(bg); bg.connect(src);
    const sum = S.g(1); sum.connect(g); vow.forEach((fc, i) => { const b = S.f('bandpass', fc * sc, i === 0 ? 7 : 9), bgn = S.g([1, 0.7, 0.3][i]); src.connect(b); b.connect(bgn); bgn.connect(sum); }); g.connect(L.in);
  },
  theremin(L, t, dur, m, v, o = {}) { // sine with wide vibrato and portamento
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const g = S.g(0); const end = adsr(g.gain, t, 0.3 * vv, 0.12, 0.3, 0.9, dur, 0.5); const d = end - t + 0.05;
    const os = S.o('sine', f, t, d); if (o.from) { os.frequency.setValueAtTime(mtof(o.from), t); os.frequency.exponentialRampToValueAtTime(f, t + 0.14); }
    const vb = S.o('sine', 5.8, t, d), vg = S.g(f * 0.012); vb.connect(vg); S.mod(vg, os.frequency); const h = S.o('sine', f * 2, t, d), hg = S.g(0.1); h.connect(hg); hg.connect(g); os.connect(g); g.connect(L.in);
  },
  braam(L, t, dur, m, v, o = {}) { // THE cinematic BRAAAM: thick detuned saws + octaves into saturation, filter falling from bright to dark
    const S = L.syn(t), f = mtof(m), vv = vmul(v); const g = S.g(0); const pk = 0.55 * vv;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.05); g.gain.setTargetAtTime(pk * 0.7, t + 0.05, 0.35); g.gain.setTargetAtTime(0, t + dur * 0.45, dur * 0.28); const d = dur * 1.6 + 0.3;
    const mix = S.g(0.4), sh = S.shaper('tube', 4, '2x'), lp = S.f('lowpass', 5000, 2.4); line(lp.frequency, t, [[0, 5200], [0.3, 1800], [dur * 0.6, 340]]);
    [[1, -26, 1], [1, -12, 1], [1, 0, 1], [1, 11, 1], [1, 24, 1], [2, -8, 0.5], [2, 9, 0.5], [0.5, 0, 0.7]].forEach(([r, dc, a]) => { const os = S.o(r === 0.5 ? 'square' : 'sawtooth', f * r, t, d); os.detune.value = dc; os.frequency.setValueAtTime(f * r, t); os.frequency.exponentialRampToValueAtTime(f * r * 0.93, t + dur); const ga = S.g(a); os.connect(ga); ga.connect(mix); });
    mix.connect(sh); sh.connect(lp); lp.connect(g); const sb = S.o('sine', f, t, d), sg = S.g(0.55); sb.connect(sg); sg.connect(g); g.connect(L.in);
  },
};

/* ================================================================== PERCUSSION & FX (fn(L,t,v,o)) */
export const PERC = {
  K(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); th(R, t, { f0: 108, f1: 46, dur: 1.0, peak: 0.9 * v, tc: 0.24, drive: 1, fd: 0.18 }); nb(R, t, { type: 'bandpass', f0: 820, q: 1.2, dur: 0.09, peak: 0.34 * v, tc: 0.02 }); nb(R, t, { kind: 'brown', type: 'lowpass', f0: 240, dur: 0.5, peak: 0.4 * v, tc: 0.1 }); },
  k(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); th(R, t, { f0: 150, f1: 78, dur: 0.5, peak: 0.55 * v, tc: 0.11, fd: 0.1 }); nb(R, t, { type: 'bandpass', f0: 1500, q: 1.2, dur: 0.05, peak: 0.2 * v, tc: 0.012 }); },
  x(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); th(R, t, { f0: 82, f1: 36, dur: 1.4, peak: 1.0 * v, tc: 0.35, drive: 1.6, fd: 0.25 }); nb(R, t, { kind: 'pink', type: 'bandpass', f0: 300, q: 0.8, dur: 0.4, peak: 0.4 * v, tc: 0.08 }); nb(R, t, { type: 'highpass', f0: 2200, dur: 0.03, peak: 0.25 * v, tc: 0.006 }); },
  T(L, t, v, o = {}) { const S = L.syn(t), R = mkR(L, S, t); const f = o.f || L.rng.pick([150, 125, 105, 88]); th(R, t, { f0: f, f1: f * 0.5, dur: 0.55, peak: 0.7 * v, tc: 0.14, drive: 0.8, fd: 0.12 }); nb(R, t, { type: 'bandpass', f0: 650, q: 1, dur: 0.07, peak: 0.28 * v, tc: 0.015 }); },
  t(L, t, v, o = {}) { const S = L.syn(t), R = mkR(L, S, t); const f = o.f || 80; th(R, t, { f0: f * 1.25, f1: f, dur: 1.5, peak: 0.8 * v, tc: 0.4, fd: 0.2 }); ring(R, t, { fs: [f, f * 1.5, f * 2.0], type: 'sine', dur: 1.3, peak: 0.25 * v, damp: 0.7 }); nb(R, t, { type: 'bandpass', f0: 500, q: 1, dur: 0.06, peak: 0.22 * v, tc: 0.012 }); },
  S(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); nb(R, t, { type: 'bandpass', f0: 2300, q: 0.8, dur: 0.24, peak: 0.55 * v, tc: 0.055 }); th(R, t, { f0: 200, f1: 115, dur: 0.14, peak: 0.45 * v, tc: 0.035, type: 'triangle' }); nb(R, t, { type: 'highpass', f0: 6000, dur: 0.1, peak: 0.16 * v, tc: 0.025 }); },
  s(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); nb(R, t, { type: 'bandpass', f0: 1900, q: 5, dur: 0.035, peak: 0.45 * v, tc: 0.008 }); th(R, t, { f0: 850, f1: 420, dur: 0.035, peak: 0.25 * v, tc: 0.008 }); },
  h(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); nb(R, t, { type: 'highpass', f0: 7500, dur: 0.04, peak: 0.22 * v, tc: 0.009 }); },
  H(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); nb(R, t, { type: 'highpass', f0: 6800, dur: 0.3, peak: 0.2 * v, tc: 0.07 }); },
  g(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); nb(R, t, { type: 'bandpass', f0: 5800, q: 1, dur: 0.07, peak: 0.16 * v, tc: 0.016, atk: 0.006 }); },
  c(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); nb(R, t, { type: 'highpass', f0: 3200, dur: 3.0, peak: 0.34 * v, tc: 0.75 }); nb(R, t, { type: 'bandpass', f0: 6500, q: 0.8, dur: 2.2, peak: 0.22 * v, tc: 0.5 }); ring(R, t, { fs: [410, 603, 1010, 1634, 2490], type: 'square', dur: 1.8, peak: 0.07 * v, damp: 0.7 }); },
  m(L, t, v, o = {}) { const S = L.syn(t), R = mkR(L, S, t); const f = o.f || L.rng.range(190, 430); ring(R, t, { fs: [f, f * 1.593, f * 2.136, f * 2.653, f * 3.84], type: 'sine', dur: 1.8, peak: 0.55 * v, damp: 0.65 }); nb(R, t, { type: 'highpass', f0: 3000, dur: 0.025, peak: 0.25 * v, tc: 0.006 }); },
  b(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); th(R, t, { f0: 64, f1: 28, dur: 2.4, peak: 1.0 * v, tc: 0.6, drive: 2, fd: 0.45 }); nb(R, t, { kind: 'brown', type: 'lowpass', f0: 220, f1: 60, dur: 2.0, peak: 0.45 * v, tc: 0.55, sw: 1.6 }); nb(R, t, { type: 'highpass', f0: 1800, dur: 0.04, peak: 0.28 * v, tc: 0.01 }); },
  heart(L, t, v, o = {}) { const S = L.syn(t), R = mkR(L, S, t); th(R, t, { f0: 66, f1: 40, dur: 0.24, peak: 0.95 * v, tc: 0.055, drive: 1, fd: 0.09 }); th(R, t + (o.gap ?? 0.3), { f0: 74, f1: 44, dur: 0.2, peak: 0.6 * v, tc: 0.045, drive: 1, fd: 0.08 }); },
  /** a short noise riser into the next bar / reverse swell. o.len seconds */
  riser(L, t, v, o = {}) {
    const S = L.syn(t), len = o.len || 3; const env = S.g(0); env.gain.setValueAtTime(0.004, t); env.gain.exponentialRampToValueAtTime(0.6 * v, t + len * 0.97); env.gain.linearRampToValueAtTime(0, t + len + 0.03); env.connect(L.in);
    const n = S.n('white', t, len + 0.1), f = S.f('bandpass', 400, 1.8); sweep(f.frequency, t, 300, 7500, len); n.connect(f); f.connect(env);
    if (o.tone) { const os = S.o('sawtooth', o.tone, t, len + 0.1); sweep(os.frequency, t, o.tone, o.tone * 4, len); const lp = S.f('lowpass', 500, 1.2); sweep(lp.frequency, t, 400, 5000, len); const tg = S.g(0.35); os.connect(lp); lp.connect(tg); tg.connect(env); }
  },
  /** reverse cymbal: noise with a rising filter and exponentially rising level, cut at the end */
  rev(L, t, v, o = {}) {
    const S = L.syn(t), len = o.len || 2.4; const env = S.g(0); env.gain.setValueAtTime(0.003, t); env.gain.exponentialRampToValueAtTime(0.5 * v, t + len); env.gain.setValueAtTime(0, t + len + 0.01); env.connect(L.in);
    const n = S.n('white', t, len + 0.05), hp = S.f('highpass', 600, 0.7), bp = S.f('bandpass', 5000, 0.5); sweep(hp.frequency, t, 300, 2500, len); n.connect(hp); hp.connect(bp); bp.connect(env);
  },
  stab(L, t, v, o = {}) { // percussive non-pitched hit used by news/chase
    const S = L.syn(t), R = mkR(L, S, t); nb(R, t, { type: 'bandpass', f0: o.f || 900, q: 1.5, dur: 0.12, peak: 0.4 * v, tc: 0.03 });
  },
};

/* ================================================================== TEXTURE EVENTS (fn(L,t,v,o)) */
export const TEX = {
  whisper(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); const p = S.pan(L.rng.range(-0.8, 0.8)); p.connect(L.in); const d = L.rng.range(1.4, 3); nb(R, t, { kind: 'pink', type: 'bandpass', f0: L.rng.range(2200, 3000), f1: L.rng.range(3000, 4200), q: 1.6, dur: d, peak: 0.13 * v, tc: d * 0.3, atk: d * 0.35, sw: d, dest: p }); nb(R, t + d * 0.1, { kind: 'pink', type: 'bandpass', f0: 1100, q: 3, dur: d * 0.7, peak: 0.05 * v, tc: d * 0.2, atk: d * 0.3, dest: p }); },
  scrape(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); const p = S.pan(L.rng.range(-0.7, 0.7)); p.connect(L.in); const d = L.rng.range(1.8, 3.2); const n = S.n('pink', t, d + 0.1), f = S.f('bandpass', 500, 9); line(f.frequency, t, [[0, L.rng.range(400, 700)], [d, L.rng.range(1400, 2600)]]); const g = S.g(0); line(g.gain, t, [[0, 0], [d * 0.3, 0.12 * v], [d * 0.8, 0.08 * v], [d, 0]]); const jl = S.o('sine', 11, t, d + 0.1), jg = S.g(0.04 * v); jl.connect(jg); S.mod(jg, g.gain); n.connect(f); f.connect(g); g.connect(p); },
  creak(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); const p = S.pan(L.rng.range(-0.6, 0.6)); p.connect(L.in); const d = L.rng.range(1.0, 2.0); const f0 = L.rng.range(70, 110); const o1 = S.o('sawtooth', f0, t, d + 0.1); line(o1.frequency, t, [[0, f0], [d * 0.5, f0 * 2.1], [d, f0 * 1.6]]); const f = S.f('bandpass', L.rng.range(420, 700), 9), g = S.g(0); line(g.gain, t, [[0, 0], [0.12, 0.11 * v], [d * 0.85, 0.07 * v], [d, 0]]); const vl = S.o('sine', 12, t, d + 0.1), vg = S.g(f0 * 0.05); vl.connect(vg); S.mod(vg, o1.frequency); o1.connect(f); f.connect(g); g.connect(p); },
  drip(L, t, v) { const S = L.syn(t); const p = S.pan(L.rng.range(-0.9, 0.9)); p.connect(L.in); const f = L.rng.range(800, 1700); const o1 = S.o('sine', f, t, 0.3); o1.frequency.setValueAtTime(f, t); o1.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.06); const g = S.g(0); pluckEnv(g.gain, t, 0.22 * v, 0.03, 0.001); o1.connect(g); g.connect(p); },
  ping(L, t, v, o = {}) { const S = L.syn(t); const p = S.pan(L.rng.range(-0.8, 0.8)); p.connect(L.in); const f = o.f || L.rng.range(700, 1500); const o1 = S.o('sine', f, t, 4); const g = S.g(0); pluckEnv(g.gain, t, 0.2 * v, 1.0, 0.004); o1.connect(g); g.connect(p); const o2 = S.o('sine', f * 2.01, t, 3), g2 = S.g(0); pluckEnv(g2.gain, t, 0.05 * v, 0.5, 0.004); o2.connect(g2); g2.connect(p); },
  rumble(L, t, v) { const S = L.syn(t); const d = L.rng.range(4, 7); const n = S.n('brown', t, d + 0.1), f = S.f('lowpass', 140, 0.8), g = S.g(0); line(g.gain, t, [[0, 0], [d * 0.45, 0.5 * v], [d, 0]]); n.connect(f); f.connect(g); g.connect(L.in); },
  metal(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); const p = S.pan(L.rng.range(-0.8, 0.8)); p.connect(L.in); const f = L.rng.range(250, 900); ring(R, t, { fs: [f, f * 1.47, f * 2.09, f * 2.56, f * 3.9], type: 'sine', dur: 2.6, peak: 0.28 * v, damp: 0.7, dest: p }); nb(R, t, { type: 'highpass', f0: 3500, dur: 0.02, peak: 0.12 * v, tc: 0.005, dest: p }); },
  tone(L, t, v) { const S = L.syn(t); const p = S.pan(L.rng.range(-0.8, 0.8)); p.connect(L.in); const d = L.rng.range(2.5, 4.5); const f = L.rng.range(300, 900); const car = S.o('sine', f, t, d + 0.1); line(car.frequency, t, [[0, f], [d * 0.5, f * L.rng.range(0.6, 1.7)], [d, f * L.rng.range(0.5, 1.4)]]); const md = S.o('sine', f * 1.51, t, d + 0.1), mg = S.g(f * 0.7); md.connect(mg); S.mod(mg, car.frequency); const g = S.g(0); line(g.gain, t, [[0, 0], [d * 0.4, 0.12 * v], [d, 0]]); car.connect(g); g.connect(p); },
  click(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); const p = S.pan(L.rng.range(-0.8, 0.8)); p.connect(L.in); let tt = t; const n = L.rng.int(4, 9); for (let i = 0; i < n; i++) { nb(R, tt, { type: 'bandpass', f0: L.rng.range(900, 3200), q: 11, dur: 0.02, peak: 0.34 * v, tc: 0.0045, dest: p }); tt += L.rng.pick([0.05, 0.08, 0.11, 0.17]); } },
  wind(L, t, v) { const S = L.syn(t); const p = S.pan(L.rng.range(-0.7, 0.7)); p.connect(L.in); const d = L.rng.range(3.5, 6); const n = S.n('pink', t, d + 0.1), f = S.f('bandpass', 350, 1.6); line(f.frequency, t, [[0, 300], [d * 0.5, L.rng.range(600, 1100)], [d, 280]]); const g = S.g(0); line(g.gain, t, [[0, 0], [d * 0.4, 0.2 * v], [d, 0]]); n.connect(f); f.connect(g); g.connect(p); },
  breath(L, t, v) { const S = L.syn(t), R = mkR(L, S, t); const p = S.pan(L.rng.range(-0.5, 0.5)); p.connect(L.in); nb(R, t, { kind: 'pink', type: 'bandpass', f0: 1300, f1: 700, q: 0.9, dur: 1.6, peak: 0.2 * v, tc: 0.4, atk: 0.5, sw: 1.6, dest: p }); },
  groan(L, t, v) { const S = L.syn(t); const d = L.rng.range(3, 5); const f = L.rng.range(55, 85); const p = S.pan(L.rng.range(-0.5, 0.5)); p.connect(L.in); const out = S.g(0); line(out.gain, t, [[0, 0], [d * 0.35, 0.3 * v], [d * 0.7, 0.2 * v], [d, 0]]); out.connect(p); for (const a of [1, 1.012, 1.5]) { const o1 = S.o('sawtooth', f * a, t, d + 0.1); line(o1.frequency, t, [[0, f * a], [d * 0.6, f * a * 0.84], [d, f * a * 0.9]]); const bp = S.f('bandpass', 240, 8); sweep(bp.frequency, t, 190, 480, d); const gg = S.g(0.5); o1.connect(bp); bp.connect(gg); gg.connect(out); } },
};
