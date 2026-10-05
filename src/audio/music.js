// Procedural score engine.  A cue (see music_cues.js) = key/mode + chord progression + a list of LAYERS.  A look-ahead sequencer walks a 16th-note grid
// ahead of the audio clock; each layer kind (drone, pad, ostinato, arp, perc, melody, bells, heartbeat, textures, risers, hits) turns the current chord into notes
// on an instrument.  `setIntensity` fades layers in/out (each layer has an intensity window).  Everything random comes from seeded RNGs
// (cue name + layer + bar), so a cue always plays the same way.  Cross-fade = two cue instances with their own gain.
import { RNG, hashStr, Syn, mtof, cl, lin, sstep, noteNum } from './dsp.js';
import { INST, PERC, TEX } from './music_inst.js';
import { CUES, STINGERS, SCALES } from './music_cues.js';


export { CUES, STINGERS };

/* ------------------------------------------------------------------ harmony */
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const NUM = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
const QUAL = {
  M: [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], mM7: [0, 3, 7, 11],
  m9: [0, 3, 7, 10, 14], M9: [0, 4, 7, 11, 14], '9': [0, 4, 7, 10, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], '5': [0, 7, 12], m6: [0, 3, 7, 9], '6': [0, 4, 7, 9], dim7: [0, 3, 6, 9], hdim: [0, 3, 6, 10],
  cl: [0, 1, 3, 7], cl2: [0, 1, 6, 7], M7s11: [0, 4, 7, 11, 18], mb9: [0, 3, 7, 10, 13], wt: [0, 2, 4, 6], quartal: [0, 5, 10, 15],
};
/** 'i:2 bVI bIII7 V:1' -> [{root, tones, bars}] */
export function parseProg(str) {
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)([^:]*)(?::(\d+))?$/.exec(tok);
    if (!m) continue; const up = m[2] === m[2].toUpperCase(); let root = MAJ[NUM[m[2].toUpperCase()]] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0); root = ((root % 12) + 12) % 12;
    const sfx = m[3] || ''; let q = up ? 'M' : 'm';
    if (sfx === '7') q = up ? '7' : 'm7'; else if (sfx === 'M7') q = up ? 'M7' : 'mM7'; else if (sfx === '9') q = up ? '9' : 'm9'; else if (sfx === 'M9') q = 'M9'; else if (sfx === 'add9') q = up ? 'add9' : 'madd9';
    else if (sfx === '6') q = up ? '6' : 'm6'; else if (sfx === 'dim' || sfx === '°') q = 'dim'; else if (sfx && QUAL[sfx]) q = sfx;
    out.push({ root, tones: QUAL[q] || QUAL.M, q, bars: m[4] ? +m[4] : 1 });
  }
  return out;
}
const clampOct = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };
/** closest-motion voicing: keep common tones, move the rest by the smallest step */
function voiceLead(prev, pcs, lo, hi, n) {
  const cands = []; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) cands.push(m);
  if (!cands.length) return prev || [lo];
  if (!prev || !prev.length) {
    const out = []; let m = lo; for (let i = 0; i < n; i++) { const pc = pcs[i % pcs.length]; while (m % 12 !== pc) m++; if (m > hi) break; out.push(m); m += 3; } return out.length ? out : [cands[0]];
  }
  const used = new Set(), out = [];
  for (const p of prev) { let best = null, bd = 99; for (const c of cands) { if (used.has(c)) continue; const d = Math.abs(c - p); if (d < bd) { bd = d; best = c; } } if (best !== null) { used.add(best); out.push(best); } }
  const mid = lin(lo, hi, 0.5);
  for (const need of pcs.slice(0, 2)) {
    if (out.some((m) => m % 12 === need)) continue;
    const c = cands.filter((x) => x % 12 === need && !used.has(x)).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]; if (c === undefined) continue;
    let wi = 0, wd = -1; out.forEach((m, i) => { const d = Math.abs(m - c); if (d > wd && !pcs.slice(0, 2).includes(m % 12)) { wd = d; wi = i; } }); out[wi] = c; used.add(c);
  }
  return out.sort((a, b) => a - b).slice(0, Math.max(n, 1));
}

/* ------------------------------------------------------------------ patterns */
function parseSteps(pat, unit = 2) { // 'x . 1 _ 5!' tokens -> events (step index, length in steps)
  const toks = pat.trim().split(/\s+/), ev = []; let s = 0;
  for (const tk of toks) {
    if (tk === '_') { if (ev.length) ev[ev.length - 1].len += unit; s += unit; continue; }
    if (tk !== '.') { const m = /^([0-9Rrx])([!',]*)$/.exec(tk); if (m) ev.push({ s, len: unit, tk: m[1], acc: m[2].includes('!'), up: (m[2].match(/'/g) || []).length - (m[2].match(/,/g) || []).length }); }
    s += unit;
  }
  return { ev, steps: s };
}
const patChars = (p) => p.replace(/\s+/g, '');

/* ------------------------------------------------------------------ layer fx chains */
function chorus(p, input, out, { rate = 0.3, depth = 0.0028, base = 0.017, mix = 0.5 } = {}) {
  const dry = p.g(1 - mix * 0.45); input.connect(dry); dry.connect(out);
  [[base, rate, -0.75], [base * 1.38, rate * 1.31, 0.75]].forEach(([b, r, pn]) => {
    const d = p.delay(b, 0.1), lf = p.o('sine', r, p.t0), lg = p.g(depth); lf.connect(lg); p.mod(lg, d.delayTime); const pa = p.pan(pn), wg = p.g(mix); input.connect(d); d.connect(pa); pa.connect(wg); wg.connect(out);
  });
}
function buildFx(L, def, bpm) {
  const p = L.p; const out = L.fxOut; const inn = L.in;
  switch (def.fx) {
    case 'str': {
      const cut = def.cut || 2800; const lp = p.f('lowpass', cut, 0.6); const lf = p.o('sine', 0.07 + (hashStr(def.id || 'x') % 7) * 0.01, p.t0), lg = p.g(cut * 0.3); lf.connect(lg); p.mod(lg, lp.frequency);
      inn.connect(lp); chorus(p, lp, out, { mix: def.cmix ?? 0.55 }); break;
    }
    case 'warm': { const lp = p.f('lowpass', def.cut || 1300, 0.5); inn.connect(lp); chorus(p, lp, out, { rate: 0.22, mix: 0.5 }); break; }
    case 'choir': {
      const vow = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530], e: [660, 1700, 2850], i: [330, 2000, 2800] }[def.vowel || 'a']; const fs = def.fs || 1; const sum = p.g(1.4);
      vow.forEach((f, i) => { const b = p.f('bandpass', f * fs, [6, 8, 8][i]), g = p.g([1, 0.8, 0.3][i]); const lf = p.o('sine', 0.05 + i * 0.023, p.t0), lg = p.g(f * fs * 0.1); lf.connect(lg); p.mod(lg, b.frequency); inn.connect(b); b.connect(g); g.connect(sum); });
      chorus(p, sum, out, { rate: 0.25, mix: 0.6 }); break;
    }
    case 'brass': { const sh = p.shaper('tanh', 1.5), lp = p.f('lowpass', 5200, 0.5); inn.connect(sh); sh.connect(lp); lp.connect(out); break; }
    case 'pluck': {
      const D = Math.max(0.05, (60 / bpm) * (def.dly ?? 0.75)); const dry = p.g(1); inn.connect(dry); dry.connect(out);
      const dl = p.delay(D, 2), dr = p.delay(D, 2), fb = p.g(def.fb ?? 0.34), lp = p.f('lowpass', 2600, 0.5), pl = p.pan(-0.6), pr = p.pan(0.6), wet = p.g(def.wet ?? 0.34);
      inn.connect(dl); dl.connect(pl); dl.connect(dr); dr.connect(pr); dr.connect(lp); lp.connect(fb); fb.connect(dl); pl.connect(wet); pr.connect(wet); wet.connect(out); break;
    }
    case 'sat': { const sh = p.shaper('tanh', def.drive ?? 2); const lp = p.f('lowpass', def.cut || 5000, 0.5); inn.connect(sh); sh.connect(lp); lp.connect(out); break; }
    case 'lp': { const lp = p.f('lowpass', def.cut || 3000, 0.6); inn.connect(lp); lp.connect(out); break; }
    case 'hp': { const hp = p.f('highpass', def.cut || 200, 0.6); inn.connect(hp); hp.connect(out); break; }
    default: inn.connect(out);
  }
  if (def.vib) { const lf = p.o('sine', def.vibRate || 5.2, p.t0), g = p.g(def.vib); lf.connect(g); L.vib = g; }
}

/* ------------------------------------------------------------------ layer */
class Layer {
  constructor(inst, def, idx) {
    const A = inst.A, ctx = A.ctx; this.inst = inst; this.A = A; this.ctx = ctx; this.def = def; this.idx = idx; this.kind = def.kind; this.rng = new RNG(hashStr(inst.name) + idx * 7919);
    def.id = def.id || (def.kind + idx);
    const mx = A.mix && A.mix.music && A.mix.music[inst.name]; this.gain = (def.g ?? 1) * ((mx && mx.layers && mx.layers[idx]) ?? 1);
    this.in = ctx.createGain(); this.fxOut = ctx.createGain(); this.out = ctx.createGain(); this.send = ctx.createGain(); this.send.gain.value = def.rev ?? 0.25;
    this.p = new Syn(A, null, A.now(), 'music'); this.vib = null; this.p.nodes.push(this.in, this.fxOut, this.out, this.send);
    buildFx(this, def, inst.bpm);
    this.fxOut.connect(this.out);
    if (def.pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = def.pan; this.out.connect(pn); pn.connect(inst.dryOut); this.p.nodes.push(pn); } else this.out.connect(inst.dryOut);
    this.out.connect(this.send); this.send.connect(inst.wetOut); // reverb send taps AFTER the layer gain so faded layers stop sending too
    this.level = 0; this.tgt = 0; this.tc = 0.5; this.prevVoicing = null; this.ev = null; this.phraseStart = -1; this.nextBeat = 0; this.texSteps = null; this.barRng = null; this.barRngN = -1;
    this.parsed = def.pat ? parseSteps(def.pat, def.unit || 2) : null; this.parsedList = def.pats && def.kind === 'ost' ? def.pats.map((p) => parseSteps(p, def.unit || 2)) : null;
    if (def.kind === 'perc') this.percPats = def.pats.map(patChars); if (def.fill) this.fillPat = patChars(def.fill);
    this.applyIntensity(inst.intensity, 0);
  }
  syn(t) { return new Syn(this.A, this.in, t, 'music'); }
  lvlFor(x) { const d = this.def; let l = 1; if (d.i) l = sstep(d.i[0], d.i[1], x); if (d.inv) l *= 1 - sstep(d.inv[0], d.inv[1], x); return l; }
  applyIntensity(x, secs) {
    const d = this.def; const l = this.lvlFor(x); const g = l * this.gain; this.tgt = l; const now = this.A.now(); this.tc = Math.max(0.02, secs / 3);
    if (secs <= 0) { this.out.gain.cancelScheduledValues(now); this.out.gain.setValueAtTime(g, now); this.level = l; } else this.out.gain.setTargetAtTime(g, now, this.tc);
  }
  rngFor(bar) { if (this.barRngN !== bar) { this.barRngN = bar; this.barRng = new RNG(hashStr(this.inst.name + this.def.id) + bar * 104729); } this.rng = this.barRng; return this.barRng; }
  dispose() { const now = this.A.now(); this.p.stopAt(now + 0.05); for (const n of [this.in, this.fxOut, this.out, this.send]) { try { n.disconnect(); } catch (e) { /* */ } } }
}

/* ------------------------------------------------------------------ layer kinds: (L, e)
   e = { si, bar, loopBar, loop, loopBars, t, sd (step seconds), chord, next, cstart, left, spb, spBar, barDur, rng } */
const chordMidi = (e, inst, lo, k = 0) => { // k-th chord tone upward from the root placed >= lo (k beyond the chord size continues into the next octave)
  const rootPc = (inst.keyPc + e.chord.root) % 12; const r = lo + (((rootPc - lo) % 12) + 12) % 12; const n = e.chord.tones.length; return r + e.chord.tones[((k % n) + n) % n] + 12 * Math.floor(k / n);
};
const vel = (base, rng, hum = 0.1) => cl(base * (1 + (rng.next() - 0.5) * 2 * hum), 0.05, 1.4);

const SHED1 = { bell: 1, tex: 1, arp: 1 }, SHED2 = { ost: 1, mel: 0, rise: 1 }, SHED3 = { perc: 1, hit: 1, drone: 1 };
const KINDS = {
  drone(L, e) { // sustained low notes, re-struck every `every` bars (or on each chord change when follow)
    const d = L.def, every = d.every || 4; if (!(d.follow ? e.cstart && e.si === 0 : e.si === 0 && e.bar % every === 0)) return;
    const lo = d.lo ?? 24; const dur = (d.follow ? e.chord.left : every) * e.barDur + 0.6; const rootMidi = d.follow ? chordMidi(e, L.inst, lo, 0) : lo + (((L.inst.keyPc - lo) % 12) + 12) % 12;
    for (const off of d.notes || [0]) INST[d.inst || 'dronesaw'](L, e.t, dur, rootMidi + off, d.vel ?? 0.7, { att: d.att ?? 2.2, rel: d.rel ?? 2.5 });
  },
  pad(L, e) {
    const d = L.def; if (!(e.cstart && e.si === 0)) return; const rootPc = (L.inst.keyPc + e.chord.root) % 12; const pcs = [...new Set(e.chord.tones.map((i) => (rootPc + i) % 12))];
    const lo = d.reg ? d.reg[0] : 48, hi = d.reg ? d.reg[1] : 72; const v = voiceLead(L.prevVoicing, pcs, lo, hi, d.n || 4); L.prevVoicing = v;
    const dur = e.chord.left * e.barDur + (d.over ?? 0.3); const rng = e.rng;
    v.forEach((m, i) => INST[d.inst || 'strings'](L, e.t + (d.stagger ? i * d.stagger : 0) + rng.next() * 0.03, dur, m, vel(d.vel ?? 0.7, rng, 0.06), { att: d.att, rel: d.rel, vowel: d.vowel }));
  },
  ost(L, e) { // rhythmic ostinato over the chord tones: `pats` cycles per bar (or a single `pat`)
    const d = L.def; const P = L.parsedList ? L.parsedList[e.bar % L.parsedList.length] : L.parsed; if (!P) return; if (d.every && e.bar % d.every !== (d.at || 0)) return;
    const rng = e.rng; const lo = d.lo ?? 36;
    for (const ev of P.ev) {
      if (ev.s !== e.si) continue; if (d.skip && rng.next() < d.skip) continue;
      let m; if (ev.tk === 'R') m = chordMidi(e, L.inst, lo - 12, 0); else if (ev.tk === 'r') m = chordMidi(e, L.inst, lo - 24, 0); else if (ev.tk === 'x') m = chordMidi(e, L.inst, lo, 0); else m = chordMidi(e, L.inst, lo, +ev.tk - 1);
      m += 12 * ev.up; const sw = d.swing && (e.si / (d.unit || 2)) % 2 === 1 ? d.swing * e.sd : 0;
      INST[d.inst || 'spicc'](L, e.t + sw, ev.len * e.sd * (d.gate ?? 0.9), m, vel((d.vel ?? 0.7) * (ev.acc ? 1.25 : 1), rng, 0.08), d.o || {});
    }
  },
  arp(L, e) { // arpeggio through chord tones in [reg]
    const d = L.def; const rate = d.rate || 2; if (e.si % rate !== 0) return; if (d.every && e.bar % d.every !== (d.at || 0)) return; const rng = e.rng; if (d.rest && rng.next() < d.rest) return;
    const lo = d.reg ? d.reg[0] : 55, hi = d.reg ? d.reg[1] : 84; const rootPc = (L.inst.keyPc + e.chord.root) % 12; const pcs = e.chord.tones.map((i) => (rootPc + i) % 12); const pool = [];
    for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) pool.push(m); if (!pool.length) return;
    const n = Math.floor((e.bar * e.spBar + e.si) / rate); let idx; const mode = d.pattern || 'up';
    if (mode === 'up') idx = n % pool.length; else if (mode === 'down') idx = pool.length - 1 - (n % pool.length);
    else if (mode === 'updown') { const per = Math.max(1, pool.length * 2 - 2); const k = n % per; idx = k < pool.length ? k : per - k; } else if (mode === 'rand') idx = rng.int(0, pool.length - 1);
    else if (Array.isArray(mode)) idx = mode[n % mode.length] % pool.length; else idx = n % pool.length;
    INST[d.inst || 'arpsyn'](L, e.t, (d.len || rate) * e.sd, pool[idx], vel((d.vel ?? 0.6) * (e.si % (rate * 4) === 0 ? 1.15 : 1), rng, 0.1), d.o || {});
  },
  perc(L, e) {
    const d = L.def; let pat = L.percPats[e.bar % L.percPats.length]; const fb = d.fillEvery || 0; if (L.fillPat && fb && e.loopBar % fb === fb - 1) pat = L.fillPat;
    const ch = pat[e.si % pat.length]; if (!ch || ch === '.' || ch === '-') return; const f = PERC[ch]; if (!f) return; const rng = e.rng;
    let v = (d.vel ?? 0.8) * (1 + (rng.next() - 0.5) * 0.2); if (e.si % e.spb !== 0) v *= 0.85;
    const rootPc = (L.inst.keyPc + e.chord.root) % 12; f(L, e.t + (d.push ?? 0), cl(v, 0.1, 1.3), { f: mtof(clampOct(36 + rootPc, 38, 52)) });
  },
  mel(L, e) { // melody: hand-written phrases (def.phr + def.seq) or a seeded generator (def.gen)
    const d = L.def; const every = d.every || 4; const loopSlots = Math.max(1, Math.floor(e.loopBars / every)); const slot = Math.floor(e.loopBar / every); const barInPh = e.loopBar - slot * every;
    if (barInPh === 0 && e.si === 0 && L.phraseStart !== e.bar) { L.phraseStart = e.bar; L.ev = buildPhrase(L, e, e.loop * loopSlots + slot); }
    if (!L.ev) return; const k = barInPh * e.spBar + e.si; const list = L.ev.get(k); if (!list) return;
    for (const n of list) INST[d.inst || 'solo'](L, e.t + (d.lag ?? 0), n.len * e.sd * (d.gate ?? 0.97), n.m, vel((d.vel ?? 0.7) * n.acc, e.rng, 0.06), { vowel: d.vowel, att: d.att, rel: d.rel, from: n.from, vib: d.vibAmt, ...(d.o || {}) });
  },
  bell(L, e) { // sparse shimmering bells on chord/scale tones
    const d = L.def; const grid = d.grid || 2; if (e.si % grid !== 0) return; const rng = e.rng; if (rng.next() > (d.rate ?? 0.5) / (e.spBar / grid)) return;
    const lo = d.reg ? d.reg[0] : 72, hi = d.reg ? d.reg[1] : 96; const rootPc = (L.inst.keyPc + e.chord.root) % 12; const sc = d.scale ? L.inst.scale.map((x) => (L.inst.keyPc + x) % 12) : e.chord.tones.map((i) => (rootPc + i) % 12);
    const pool = []; for (let m = lo; m <= hi; m++) if (sc.includes(m % 12)) pool.push(m); if (!pool.length) return;
    INST[d.inst || 'bell'](L, e.t, 1, pool[rng.int(0, pool.length - 1)], vel(d.vel ?? 0.5, rng, 0.2), d.o || {});
  },
  heart(L, e) { // free-running heartbeat (independent of the grid)
    const d = L.def; const per = 60 / (d.bpm || 60); if (L.nextBeat < e.t) L.nextBeat = e.t; while (L.nextBeat < e.t + e.sd) { PERC.heart(L, L.nextBeat, d.vel ?? 0.7, { gap: Math.min(0.3, per * 0.38) }); L.nextBeat += per; }
  },
  tex(L, e) { // random sparse sound events (whispers, scrapes, creaks, drips, ...)
    const d = L.def; if (e.si === 0) { L.texSteps = []; const r = d.rate ?? 1; const n = Math.floor(r) + (e.rng.next() < r % 1 ? 1 : 0); for (let i = 0; i < n; i++) L.texSteps.push([e.rng.int(0, e.spBar - 1), d.kinds[e.rng.int(0, d.kinds.length - 1)]]); }
    if (!L.texSteps) return; for (const [s, k] of L.texSteps) if (s === e.si && TEX[k]) TEX[k](L, e.t, d.vel ?? 0.8, d.o || {});
  },
  rise(L, e) { // riser / reverse swell that peaks at bar d.bar (loop-relative); optional impact on arrival
    const d = L.def; const len = d.len || 2; const target = d.bar ?? 0; const lb = e.loopBars; const startBar = (((target - len) % lb) + lb) % lb; const ok = !d.every || e.loop % d.every === 0;
    if (e.si === 0 && e.loopBar === startBar && ok) (d.how === 'rev' ? PERC.rev : PERC.riser)(L, e.t, d.vel ?? 0.7, { len: len * e.barDur, tone: d.tone ? mtof(36 + L.inst.keyPc + 24) : 0 });
    if (e.si === 0 && e.loopBar === target && ok && e.bar > 0) {
      for (const h of [].concat(d.hit || [])) if (PERC[h]) PERC[h](L, e.t, (d.vel ?? 0.7) * 1.1, { f: mtof(36 + L.inst.keyPc) });
      if (d.braam) INST.braam(L, e.t, d.braamDur || 3.5, chordMidi(e, L.inst, d.braamLo ?? 28, 0), d.braamVel ?? 0.7);
    }
  },
  hit(L, e) { // accents on chosen bars/steps
    const d = L.def; if (!(d.bars || [0]).includes(e.loopBar) || e.si !== (d.step || 0)) return; if (d.every && e.loop % d.every !== (d.at || 0)) return;
    if (d.inst) INST[d.inst](L, e.t, d.dur || 3, chordMidi(e, L.inst, d.lo ?? 28, d.k || 0) + (d.off || 0), d.vel ?? 0.8, d.o || {});
    if (d.perc) for (const p of [].concat(d.perc)) if (PERC[p]) PERC[p](L, e.t, d.pvel ?? d.vel ?? 0.8, { f: mtof(36 + L.inst.keyPc) });
  },
};
/** build the {step -> [notes]} map of one phrase (called at the first bar of each phrase slot) */
function buildPhrase(L, e, slotIdx) {
  const d = L.def, inst = L.inst, spBar = e.spBar, every = d.every || 4; const map = new Map(); const add = (s, n) => { const a = map.get(s); if (a) a.push(n); else map.set(s, [n]); };
  const octBase = 12 * ((d.oct ?? 4) + 1) + inst.keyPc; const sc = inst.scale; const degMidi = (deg, sh = 0) => { const i = Math.floor(deg - 1), o = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return octBase + sc[k] + 12 * o + sh; };
  if (d.phr) {
    const seq = d.seq || 'A'; const ph = d.phr[seq[slotIdx % seq.length]]; if (!ph) return map; let beat = 0, prev = null;
    for (const n of ph) { const deg = n[0], b = n[1], sh = n[2] || 0; if (deg !== 0) { const m = degMidi(deg, sh); add(Math.round(beat * inst.spb), { m, len: b * inst.spb, acc: n[3] || 1, from: d.glide && prev ? prev : null }); prev = m; } beat += b; }
    return map;
  }
  const g = d.gen || {}; const rng = new RNG(hashStr(inst.name + d.id) + (g.vary === false ? 0 : (slotIdx % (g.period || 4))) * 977 + 11);
  const cells = g.cells || ['x...x...x...x...', 'x.....x...x.....', 'x...x.x...x.....', 'x.......x...x.x.'];
  const lo = g.lo ?? (octBase + 7), hi = g.hi ?? (octBase + 19); const idxs = sc[2] === 3 ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5]; const allowed = g.pent === false ? sc : idxs.map((i) => sc[i]); const pool = [];
  for (let m = lo; m <= hi; m++) if (allowed.includes(((m - inst.keyPc) % 12 + 12) % 12)) pool.push(m);
  if (!pool.length) return map; let ci = Math.floor(pool.length / 2); const contour = rng.pick([1, -1, 1]);
  for (let b = 0; b < every; b++) {
    const barIdx = (Math.floor(e.loopBar / every) * every + b) % e.loopBars; const ch = inst.bars[barIdx]; const rootPc = (inst.keyPc + ch.root) % 12; const cpcs = ch.tones.map((i) => (rootPc + i) % 12);
    const cell = patChars(cells[rng.int(0, cells.length - 1)]); const onsets = []; for (let s = 0; s < cell.length; s++) if (cell[s] === 'x') onsets.push(s);
    onsets.forEach((s, oi) => {
      if (oi > 0 && rng.next() < (g.rest ?? 0.18)) return;
      const strong = s % 4 === 0; let target = ci;
      if (strong && rng.next() < 0.75) { let bi = ci, bd = 99; for (let i = 0; i < pool.length; i++) if (cpcs.includes(pool[i] % 12)) { const dd = Math.abs(i - ci) + rng.next() * 0.6; if (dd < bd) { bd = dd; bi = i; } } target = bi; }
      else { const step = rng.next() < (g.leap ?? 0.18) ? rng.pick([2, 3, -2, -3]) : rng.pick([1, 1, -1, 0, contour, contour]); target = cl(ci + step, 0, pool.length - 1); }
      ci = target; const next = onsets[oi + 1] ?? cell.length; const k = spBar / cell.length;
      add(b * spBar + Math.round(s * k), { m: pool[ci], len: Math.max(1, (next - s) * k), acc: strong ? 1.05 : 0.9 });
    });
  }
  return map;
}

/* ------------------------------------------------------------------ cue instance */
class CueInst {
  constructor(A, name, def, opts) {
    this.A = A; this.name = name; this.def = def; const ctx = A.ctx; const bus = A.bus.music;
    this.bpm = def.bpm || 80; this.beats = def.beats || 4; this.spb = def.spb || 4; this.spBar = this.beats * this.spb; this.sd = 60 / this.bpm / this.spb; this.barDur = this.sd * this.spBar;
    this.keyPc = noteNum(def.key || 'C'); this.scale = SCALES[def.mode || 'minor'] || SCALES.minor; this.bars = [];
    for (const ch of parseProg(def.prog || 'i')) for (let b = 0; b < ch.bars; b++) this.bars.push({ root: ch.root, tones: ch.tones, bars: ch.bars, cstart: b === 0, left: ch.bars - b });
    if (!this.bars.length) this.bars.push({ root: 0, tones: QUAL.m, bars: 1, cstart: true, left: 1 }); this.loopBars = this.bars.length;
    this.dryOut = ctx.createGain(); this.wetOut = ctx.createGain(); this.dryOut.gain.value = 0; this.wetOut.gain.value = 0; this.dryOut.connect(bus.dry); this.wetOut.connect(bus.wetL);
    this.intensity = opts.intensity ?? 0.5; this.layers = (def.layers || []).map((ld, i) => new Layer(this, { ...ld }, i));
    const now = A.now(); this.step = (opts.bar || 0) * this.spBar; this.nextT = now + 0.08; this.lastPump = now; this.fading = false; this.dead = false; this.fadeEnd = 0; this.fadeStart = 0; const mx = A.mix && A.mix.music && A.mix.music[name]; this.vol = (def.vol ?? 1) * ((mx && mx.vol) ?? 1);
    this.fadeTo(this.vol, opts.fade ?? 2);
  }
  fadeTo(v, secs) { const now = this.A.now(); const tc = Math.max(0.01, secs / 3.2); for (const g of [this.dryOut.gain, this.wetOut.gain]) { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(v, now, tc); } }
  solo(idx) { const now = this.A.now(); this.layers.forEach((L, i) => { L.out.gain.cancelScheduledValues(now); L.out.gain.setValueAtTime(idx === null || i === idx ? L.lvlFor(this.intensity) * L.gain : 0, now); }); }
  setIntensity(x, secs) { this.intensity = cl(x, 0, 1); for (const L of this.layers) L.applyIntensity(this.intensity, secs); }
  release(fade) { const now = this.A.now(); this.fading = true; this.fadeStart = now; this.fadeEnd = now + fade * 1.25 + 0.2; this.fadeTo(0, fade); }
  pump(now, until) {
    const dt = Math.max(0, now - this.lastPump); this.lastPump = now;
    for (const L of this.layers) L.level += (L.tgt - L.level) * (1 - Math.exp(-dt / L.tc));
    if (this.fading && now > this.fadeEnd) { this.dispose(); return; }
    if (this.fading && now > this.fadeStart + (this.fadeEnd - this.fadeStart) * 0.8) return; // nearly silent: stop creating notes
    if (this.nextT < now - 1.0) { const lost = Math.floor((now - this.nextT) / this.sd); this.step += lost; this.nextT += lost * this.sd; } // resync after a stall
    let guard = 0; const A = this.A;
    while (this.nextT < until && guard++ < 96) {
      const bar = Math.floor(this.step / this.spBar), si = this.step % this.spBar; const loopBar = bar % this.loopBars, loop = Math.floor(bar / this.loopBars); const chord = this.bars[loopBar];
      if (this.nextT >= now - 0.05) {
        const load = A.live.music / A.caps.music; // polyphony governor: shed the least important layers first

        const e = { si, bar, loopBar, loop, loopBars: this.loopBars, t: Math.max(this.nextT, now), sd: this.sd, chord, cstart: chord.cstart, left: chord.left, spb: this.spb, spBar: this.spBar, barDur: this.barDur, rng: null };
        for (const L of this.layers) {
          if (L.level < 0.02) continue; if (load >= 1 && SHED1[L.kind]) continue; if (load >= 1.25 && SHED2[L.kind]) continue; if (load >= 1.6 && !SHED3[L.kind]) continue; e.rng = L.rngFor(bar);
          try { KINDS[L.kind](L, e); } catch (err) { if (!this.warned) { this.warned = true; console.warn('[audio] music layer error', this.name, L.kind, err); } }
        }
      }
      this.nextT += this.sd; this.step++;
    }
  }
  dispose() {
    if (this.dead) return; this.dead = true; for (const L of this.layers) L.dispose();
    try { this.dryOut.disconnect(); this.wetOut.disconnect(); } catch (e) { /* */ }
  }
}

/* ------------------------------------------------------------------ public API */
export function createMusic(A) {
  const ctx = A.ctx; let cur = null; const old = new Set(); let stL = null, stCount = 0;
  A.addTicker((now, until) => { if (cur) cur.pump(now, until); for (const o of [...old]) { o.pump(now, until); if (o.dead) old.delete(o); } });
  function stingerLayer() {
    if (stL) return stL; const bus = A.bus.music; const inn = ctx.createGain(), send = ctx.createGain(); send.gain.value = 0.4; inn.connect(bus.dry); inn.connect(send); send.connect(bus.wetL);
    stL = { A, ctx, in: inn, vib: null, rng: new RNG(hashStr('stinger')), inst: { keyPc: 0, scale: SCALES.minor }, syn(t) { return new Syn(A, inn, t, 'music'); } }; return stL;
  }
  const api = {
    /** play(cue, {fade=2, intensity=0.5, bar=0}) — cross-fades from the current cue; the same cue just retargets intensity */
    play(name, o = {}) {
      const fade = o.fade ?? 2; const intensity = o.intensity ?? 0.5;
      if (name === 'silence' || !name) { api.stop(fade); return; }
      const def = CUES[name]; if (!def) { console.warn('[audio] unknown music cue', name); return; }
      if (cur && cur.name === name && !cur.fading) { cur.setIntensity(intensity, o.intensitySecs ?? Math.max(0.5, fade)); api.intensity = cur.intensity; return; }
      if (cur) { cur.release(fade); old.add(cur); }
      cur = new CueInst(A, name, def, { fade, intensity, bar: o.bar }); api.cue = name; api.intensity = cur.intensity;
    },
    setIntensity(v, seconds = 2) { if (cur) cur.setIntensity(v, seconds); api.intensity = cl(v, 0, 1); },
    stop(fade = 2) { if (cur) { cur.release(fade); old.add(cur); cur = null; } api.cue = null; },
    /** short one-shot hits: hit | sting_news | sting_alien | sting_loss | sting_hope | sting_horror | sting_victory */
    stinger(name = 'hit', o = {}) {
      const f = STINGERS[name]; if (!f) { console.warn('[audio] unknown stinger', name); return; }
      const L = stingerLayer(); L.rng = new RNG(hashStr('st-' + name) + (stCount++ % 4));
      const t = A.now() + 0.02 + (o.delay || 0); try { f(L, t, o); } catch (e) { console.warn('[audio] stinger failed', name, e); }
      if (o.duck !== false) A.duck(0.35, 1.6);
    },
    /** tuning helpers (tools/audio-test.mjs --layers): list layers / solo one layer */
    _layers: () => (cur ? cur.layers.map((L, i) => ({ i, kind: L.kind, inst: L.def.inst || '', window: L.def.i || null, g: L.def.g ?? 1 })) : []),
    _solo: (i) => { if (cur) cur.solo(i); },
    cue: null, intensity: 0.5,
    cues: () => ['silence', ...Object.keys(CUES)], stingers: () => Object.keys(STINGERS),
    /** bar number the current cue is at (for syncing visuals), -1 if none */
    get bar() { return cur ? Math.floor(cur.step / cur.spBar) : -1; },
  };
  return api;
}
