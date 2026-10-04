// Score data: scales, the 23 music cues and the stingers.  See music.js for the layer kinds / DSL.
//   prog   : roman numerals relative to the key ('i bVI bIII7 V:2' — ':n' = n bars; lowercase = minor; suffixes 7 M7 9 add9 sus2 sus4 dim 5 cl wt ...)
//   layers : { kind, inst, i:[lo,hi] intensity window, inv:[lo,hi] fades out, g gain, rev reverb send, fx, ... }  (patterns: tokens per 8th/16th)
import { INST, PERC, TEX } from './music_inst.js';
import { mtof } from './dsp.js';

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], locrian: [0, 1, 3, 5, 6, 8, 10], wholetone: [0, 2, 4, 6, 8, 10, 12],
};

/* ---- leitmotifs (scale degrees, beats).  [deg, beats, semitoneShift?]  deg 0 = rest, 8 = octave, 9 = 2nd above the octave ... */
const THEME_A = [[5, 2], [8, 1], [7, 1], [6, 2], [5, 1], [3, 1], [7, 2], [5, 1], [7, 1], [4, 3], [2, 1]];                  // over i bVI bIII bVII
const THEME_B = [[5, 2], [8, 1], [7, 1], [6, 2], [5, 1], [3, 1], [7, 2], [5, 1], [3, 1], [2, 2], [1, 2]];                  // answer, resolves home
const THEME_C = [[8, 2], [6, 1], [4, 1], [6, 2], [5, 1], [3, 1], [9, 2], [8, 1], [7, 1, 1], [8, 4]];                       // over iv bVI V(2)
const ARRIVE_C = [[6, 2], [8, 2], [7, 2], [9, 2], [8, 2], [10, 2], [12, 3], [11, 1]];                                       // over bVI bVII i V  (A minor)
const HOPE_A = [[5, 1.5], [8, 0.5], [7, 1], [5, 1], [7, 2], [5, 1], [4, 1], [3, 2], [4, 1], [3, 1], [4, 2], [2, 1], [1, 1],  // I V vi iii IV I IV V (8 bars)
  [7, 2], [5, 1], [3, 1], [6, 2], [5, 1], [4, 1], [5, 2], [3, 1], [5, 1], [6, 2], [8, 1], [6, 1], [7, 3], [5, 1]];
const WONDER = [[5, 2], [8, 2], [10, 2], [9, 1], [8, 1], [9, 2], [11, 2], [13, 2], [12, 2], [10, 2], [12, 2], [14, 2], [13, 2], [13, 2], [11, 2], [9, 2], [8, 2]];

/* ---- layer presets */
const L = {
  drone: (o) => ({ kind: 'drone', inst: 'dronesaw', notes: [0, 7, 12], lo: 26, every: 4, vel: 0.6, fx: 'lp', cut: 900, rev: 0.4, ...o }),
  sub: (o) => ({ kind: 'drone', inst: 'sub', notes: [0], lo: 26, follow: true, vel: 0.7, fx: 'sat', drive: 2, cut: 700, rev: 0.1, att: 0.6, rel: 1.5, ...o }),
  str: (o) => ({ kind: 'pad', inst: 'strings', fx: 'str', reg: [50, 74], n: 4, vel: 0.6, rev: 0.55, att: 1.2, vib: 6, ...o }),
  warm: (o) => ({ kind: 'pad', inst: 'warm', fx: 'warm', reg: [46, 68], n: 4, vel: 0.6, rev: 0.5, ...o }),
  glass: (o) => ({ kind: 'pad', inst: 'glass', fx: 'none', reg: [72, 96], n: 3, vel: 0.5, rev: 0.8, ...o }),
  choir: (o) => ({ kind: 'pad', inst: 'choir', fx: 'choir', vowel: 'a', fs: 1, reg: [57, 79], n: 4, vel: 0.55, rev: 0.7, vib: 9, att: 1.0, ...o }),
  brass: (o) => ({ kind: 'pad', inst: 'brass', fx: 'brass', reg: [43, 67], n: 4, vel: 0.6, rev: 0.5, att: 1.2, rel: 1.4, vib: 5, ...o }),
  ost: (o) => ({ kind: 'ost', inst: 'spicc', unit: 2, lo: 38, vel: 0.65, rev: 0.3, ...o }),
  arp: (o) => ({ kind: 'arp', inst: 'arpsyn', rate: 2, reg: [55, 84], vel: 0.55, rev: 0.45, ...o }),
  perc: (o) => ({ kind: 'perc', vel: 0.8, rev: 0.45, ...o }),
  mel: (o) => ({ kind: 'mel', inst: 'solo', every: 4, oct: 4, vel: 0.7, rev: 0.6, ...o }),
  bell: (o) => ({ kind: 'bell', inst: 'bell', reg: [74, 98], rate: 0.8, vel: 0.4, rev: 0.9, ...o }),
  heart: (o) => ({ kind: 'heart', bpm: 60, vel: 0.7, rev: 0.15, ...o }),
  tex: (o) => ({ kind: 'tex', rate: 1, vel: 0.8, rev: 0.8, ...o }),
  rise: (o) => ({ kind: 'rise', len: 2, bar: 0, vel: 0.6, rev: 0.5, ...o }),
  hit: (o) => ({ kind: 'hit', bars: [0], step: 0, vel: 0.8, rev: 0.6, ...o }),
};

export const CUES = {
  /* ------------------------------------------------------------------ TITLE: grand, ominous, slow-burn (D minor) */
  title: { key: 'D', mode: 'minor', bpm: 60, prog: 'i bVI bIII bVII iv bVI bVII i', vol: 1, layers: [
    L.drone({ notes: [0, 7, 12], every: 8, vel: 0.65 }),
    L.sub({ vel: 0.55 }),
    L.str({ i: [0.0, 0.3], vel: 0.55, att: 1.8, g: 0.9 }),
    L.str({ i: [0.3, 0.6], vel: 0.7, reg: [52, 78], att: 1.4 }),
    L.choir({ i: [0.4, 0.75], vel: 0.55, fs: 1.15, reg: [62, 81], n: 3 }),
    L.ost({ inst: 'cello', pat: '1 3 2 3 1 3 2 3', lo: 38, vel: 0.7, i: [0.28, 0.6], fx: 'lp', cut: 2600, gate: 0.85 }),
    L.mel({ inst: 'horn', phr: { A: THEME_A, B: THEME_B, C: THEME_C }, seq: 'ABAC', every: 4, oct: 4, vel: 0.78, i: [0.4, 0.75], glide: false, rev: 0.7 }),
    L.mel({ inst: 'strings', phr: { A: THEME_A, B: THEME_B, C: THEME_C }, seq: 'ABAC', every: 4, oct: 5, vel: 0.5, i: [0.65, 0.95], att: 0.25, fx: 'str', vib: 6 }),
    L.perc({ pats: ['K...............', '................', '....K...........', '................'], fill: '....k.k.T.T.TTTT', fillEvery: 4, vel: 0.75, i: [0.5, 0.8] }),
    L.hit({ inst: 'braam', dur: 4.5, lo: 26, vel: 0.85, every: 99, at: 0, perc: ['b'], i: [0.3, 0.55] }),
    L.rise({ bar: 0, len: 2, how: 'rev', hit: ['b'], vel: 0.55, i: [0.45, 0.8] }),
    L.bell({ rate: 0.6, i: [0.2, 0.6], scale: true }),
  ] },

  /* ------------------------------------------------------------------ CALM: warm, spacious (F major) */
  calm: { key: 'F', mode: 'major', bpm: 66, prog: 'Iadd9:2 vi7:2 IVM7:2 V Isus4', layers: [
    L.warm({ vel: 0.6, att: 1.8 }),
    L.sub({ vel: 0.4, lo: 29, i: [0, 1] }),
    L.arp({ inst: 'piano', rate: 2, pattern: 'updown', reg: [58, 82], vel: 0.42, rest: 0.18, i: [0.0, 0.4], rev: 0.7, fx: 'none' }),
    L.arp({ inst: 'harp', rate: 4, pattern: 'up', reg: [65, 90], vel: 0.36, rest: 0.45, i: [0.45, 0.85], rev: 0.8, fx: 'pluck', wet: 0.3 }),
    L.str({ i: [0.3, 0.75], vel: 0.5, att: 2.4, rel: 2.2, reg: [53, 77] }),
    L.mel({ inst: 'piano', gen: { cells: ['x.......x.......', 'x.....x.........', 'x...x.......x...', 'x.......x...x...'], rest: 0.3 }, every: 4, oct: 4, vel: 0.5, i: [0.2, 0.7] }),
    L.bell({ rate: 0.5, i: [0.5, 1], reg: [77, 100] }),
  ] },

  /* ------------------------------------------------------------------ EVERYDAY: light, plucky, human (G major) */
  everyday: { key: 'G', mode: 'major', bpm: 96, prog: 'I V vi IV', layers: [
    L.warm({ vel: 0.45, i: [0, 1], cut: 1700 }),
    L.ost({ inst: 'pluck', pat: '1 3 2 3 1 3 2 3', lo: 55, vel: 0.55, fx: 'pluck', dly: 0.75, wet: 0.28, i: [0, 1], o: { bright: 0.55 } }),
    L.ost({ inst: 'pluck', pat: 'R . . R . . R .', lo: 43, vel: 0.65, fx: 'sat', drive: 1.2, o: { bright: 0.3, decay: 0.996 }, rev: 0.15 }),
    L.perc({ pats: ['g.g.g.g.g.g.g.g.'], vel: 0.55, i: [0.2, 0.6], rev: 0.15 }),
    L.perc({ pats: ['k.......k.....k.', 'k.......k.......'], vel: 0.55, i: [0.4, 0.8], rev: 0.2 }),
    L.perc({ pats: ['....s.......s...'], vel: 0.55, i: [0.5, 0.9], rev: 0.25 }),
    L.mel({ inst: 'epiano', gen: { cells: ['x...x.x...x.....', 'x.....x.x.......', 'x.x...x...x.x...', 'x...x.......x...'], rest: 0.2, period: 4 }, every: 4, oct: 4, vel: 0.5, i: [0.15, 0.7], rev: 0.5 }),
    L.bell({ rate: 0.6, i: [0.5, 1], reg: [79, 100], vel: 0.3 }),
  ] },

  /* ------------------------------------------------------------------ CURIOUS: playful pizzicato, question-mark melodies (A dorian) */
  curious: { key: 'A', mode: 'dorian', bpm: 84, prog: 'i:2 IV:2 i:2 bVII:2', layers: [
    L.warm({ vel: 0.4, att: 1.6, cut: 1800 }),
    L.sub({ vel: 0.35, lo: 33 }),
    L.ost({ inst: 'spicc', pat: '1 . 3 . 2 . 5 . 1 . 3 . 5 . 3 .', unit: 1, lo: 57, vel: 0.45, gate: 0.5, o: { tc: 0.05 }, fx: 'pluck', dly: 0.5, wet: 0.2 }),
    L.arp({ inst: 'bell', rate: 4, pattern: 'rand', reg: [72, 93], vel: 0.32, rest: 0.4, i: [0.2, 0.8], rev: 0.8 }),
    L.mel({ inst: 'vox', vowel: 'o', gen: { cells: ['x...x...x.......', 'x.x.....x.......', '..x...x...x.....', 'x.......x...x...'], rest: 0.25, period: 3 }, every: 4, oct: 4, vel: 0.5, i: [0.15, 0.7] }),
    L.perc({ pats: ['k.......k.......', 'k.......k...k...'], vel: 0.45, i: [0.5, 1] }),
    L.perc({ pats: ['..h...h...h...h.'], vel: 0.4, i: [0.55, 1] }),
    L.str({ i: [0.4, 0.9], vel: 0.4 }),
  ] },

  /* ------------------------------------------------------------------ UNEASE: clusters, whispers, heartbeat (C# phrygian) */
  unease: { key: 'C#', mode: 'phrygian', bpm: 54, prog: 'icl:2 bIIcl:2 icl:2 bviicl:2', layers: [
    L.drone({ notes: [0, 1], every: 4, vel: 0.55, lo: 25 }),
    L.sub({ vel: 0.45, lo: 25 }),
    L.glass({ i: [0, 1], vel: 0.55, att: 3, rel: 3, reg: [70, 92], n: 4 }),
    L.str({ i: [0.25, 0.8], vel: 0.35, reg: [52, 70], att: 3 }),
    L.tex({ kinds: ['whisper', 'creak', 'scrape', 'drip'], rate: 1.0, vel: 0.7 }),
    L.heart({ bpm: 54, vel: 0.5, i: [0.3, 0.7] }),
    L.arp({ inst: 'piano', rate: 8, pattern: 'rand', reg: [40, 62], vel: 0.35, rest: 0.82, i: [0.1, 0.6], rev: 0.9, o: { sustain: 1.4 } }),
    L.tex({ kinds: ['metal', 'groan'], rate: 0.4, vel: 0.7, i: [0.5, 1] }),
    L.rise({ bar: 0, len: 2, how: 'rev', vel: 0.35, i: [0.6, 1], every: 2 }),
  ] },

  /* ------------------------------------------------------------------ NEWS: urgent broadcast pulse (E dorian) */
  news: { key: 'E', mode: 'dorian', bpm: 112, prog: 'i:2 bVI bVII', layers: [
    L.ost({ inst: 'spicc', pat: 'x! x x x x! x x x', lo: 40, vel: 0.6, o: { tc: 0.09 }, i: [0, 1], fx: 'lp', cut: 3200 }),
    L.ost({ inst: 'spicc', pat: '3! . 3 . 5! . 3 . 3! . 3 . 5! . 6 3', unit: 1, lo: 52, vel: 0.5, i: [0.3, 0.8], o: { tc: 0.06 }, gate: 0.6, rev: 0.2 }),
    L.ost({ inst: 'stab', pat: '3! . . . . . 5 . . . . . 3! . . .', unit: 1, lo: 52, vel: 0.8, i: [0.45, 1], fx: 'brass', rev: 0.4 }),
    L.arp({ inst: 'arpsyn', rate: 1, pattern: 'updown', reg: [64, 88], vel: 0.35, i: [0.55, 1], fx: 'pluck', dly: 0.75, wet: 0.25, rest: 0.1 }),
    L.sub({ vel: 0.5, lo: 28 }),
    L.perc({ pats: ['k...S...k...S...', 'k...S...k..kS...'], vel: 0.7, i: [0.3, 0.8], rev: 0.25 }),
    L.perc({ pats: ['h.h.h.h.h.h.h.hh'], vel: 0.5, i: [0.4, 1] }),
    L.str({ i: [0.35, 0.9], vel: 0.5, att: 0.9, reg: [55, 76] }),
    L.rise({ bar: 0, len: 1, vel: 0.45, i: [0.6, 1], every: 2, hit: ['K'] }),
  ] },

  /* ------------------------------------------------------------------ DREAD: low, slow, crushing (D phrygian) */
  dread: { key: 'D', mode: 'phrygian', bpm: 48, prog: 'i:4 bII:2 i:2', layers: [
    L.drone({ notes: [0, 7], every: 8, vel: 0.7, lo: 26, cut: 600 }),
    L.sub({ vel: 0.6, lo: 26 }),
    L.brass({ i: [0.15, 0.6], vel: 0.55, reg: [38, 58], n: 3, att: 3.2, rel: 3, g: 0.8 }),
    L.glass({ i: [0.0, 0.5], vel: 0.35, reg: [74, 92], n: 3, att: 3.5, rel: 3.5 }),
    L.choir({ i: [0.45, 0.9], vowel: 'o', fs: 0.88, reg: [48, 67], n: 3, vel: 0.5, att: 2.5 }),
    L.heart({ bpm: 48, vel: 0.55, i: [0.1, 0.5] }),
    L.tex({ kinds: ['scrape', 'groan', 'metal', 'whisper', 'rumble'], rate: 0.8, vel: 0.8 }),
    L.perc({ pats: ['x...............', '................', '........x.......', '................'], vel: 0.8, i: [0.45, 0.8], rev: 0.7 }),
    L.hit({ inst: 'braam', dur: 5, lo: 26, vel: 0.85, every: 2, at: 0, perc: ['b'], i: [0.5, 0.85] }),
    L.rise({ bar: 0, len: 3, how: 'rev', vel: 0.45, i: [0.55, 1], every: 1 }),
  ] },

  /* ------------------------------------------------------------------ ARRIVAL: awe and menace — the theme in slow brass over choir (A minor) */
  arrival: { key: 'A', mode: 'minor', bpm: 54, prog: 'i bVI bIII bVII bVI bVII i V', layers: [
    L.drone({ notes: [0, 7, 12], every: 8, vel: 0.65, lo: 21 }),
    L.sub({ vel: 0.6, lo: 21 }),
    L.choir({ i: [0, 0.55], vel: 0.55, vowel: 'o', att: 2.2, reg: [55, 76] }),
    L.choir({ i: [0.5, 1], vel: 0.55, vowel: 'a', fs: 1.12, att: 1.6, reg: [60, 81], n: 4 }),
    L.str({ i: [0.15, 0.7], vel: 0.55, att: 2.2, reg: [48, 72] }),
    L.brass({ i: [0.4, 0.9], vel: 0.65, reg: [43, 67], att: 1.8, rel: 2.0 }),
    L.glass({ i: [0.25, 0.8], vel: 0.45, reg: [76, 98] }),
    L.mel({ inst: 'horn', phr: { A: THEME_A, B: THEME_B, C: ARRIVE_C }, seq: 'AC', every: 4, oct: 4, vel: 0.8, i: [0.45, 0.85], rev: 0.8 }),
    L.perc({ pats: ['t.......t.......', 't...............', 't.......t...T.T.', 't...............'], vel: 0.65, i: [0.35, 0.8], rev: 0.8 }),
    L.hit({ inst: 'braam', dur: 5, lo: 21, vel: 0.9, every: 99, at: 0, perc: ['b', 'c'], i: [0.3, 0.6] }),
    L.rise({ bar: 0, len: 2, how: 'rev', hit: ['b'], vel: 0.5, i: [0.5, 1], every: 2 }),
    L.bell({ rate: 0.5, i: [0.4, 1], vel: 0.35, scale: true }),
  ] },

  /* ------------------------------------------------------------------ INVASION: aggressive low chugs, brass stabs, war drums (C minor) */
  invasion: { key: 'C', mode: 'minor', bpm: 100, prog: 'i:2 bVI bVII i:2 bII bVII', layers: [
    L.drone({ notes: [0, 7], every: 8, vel: 0.6, lo: 24 }),
    L.sub({ vel: 0.6, lo: 24, drive: 3 }),
    L.ost({ inst: 'cello', pat: '1 . 1 1 . 1 1 . 1 . 1 1 . 1 1 .', unit: 1, lo: 36, vel: 0.75, gate: 0.6, i: [0, 1], fx: 'sat', drive: 1.4, cut: 2400, rev: 0.2 }),
    L.ost({ inst: 'stab', pat: '1! . . . . . 3 . . . 1! . . . . .', unit: 1, lo: 48, vel: 0.85, i: [0.3, 0.8], fx: 'brass', rev: 0.45 }),
    L.ost({ inst: 'spicc', pat: '1 3 5 3 1 3 5 3', lo: 60, vel: 0.5, i: [0.55, 1], fx: 'str', rev: 0.3, o: { tc: 0.06 } }),
    L.str({ i: [0.2, 0.7], vel: 0.55, att: 0.8 }),
    L.brass({ i: [0.5, 1], vel: 0.65, att: 0.5, rel: 0.8 }),
    L.choir({ i: [0.55, 1], vowel: 'o', fs: 0.9, reg: [50, 70], n: 3, att: 0.5, vel: 0.5 }),
    L.perc({ pats: ['K..KK.K.K..KK.K.', 'K..KK.K.K..K..K.'], fill: 'K.K.K.K.TTTTTTTT', fillEvery: 4, vel: 0.85, i: [0.25, 0.7] }),
    L.perc({ pats: ['....S.......S...'], vel: 0.7, i: [0.55, 1] }),
    L.perc({ pats: ['m...............', '.......m........', '................', '..........m.....'], vel: 0.6, i: [0.4, 1] }),
    L.rise({ bar: 0, len: 2, vel: 0.55, hit: ['b', 'c'], braam: true, braamDur: 3, braamLo: 24, i: [0.35, 1], every: 1 }),
  ] },

  /* ------------------------------------------------------------------ BATTLE: driving, heroic (D minor) */
  battle: { key: 'D', mode: 'minor', bpm: 138, prog: 'i bVI bIII bVII', layers: [
    L.sub({ vel: 0.65, lo: 26, drive: 3 }),
    L.ost({ inst: 'spicc', pat: '1 1 3 1 1 3 1 3 1 1 3 1 1 3 5 3', unit: 1, lo: 50, vel: 0.62, i: [0, 1], fx: 'str', rev: 0.25, gate: 0.55, o: { tc: 0.07 } }),
    L.ost({ inst: 'synbass', pat: 'R R R R R R R R', lo: 38, vel: 0.6, i: [0.2, 0.7], fx: 'sat', drive: 1.5, rev: 0.1, gate: 0.7 }),
    L.ost({ inst: 'stab', pat: '1! . 1 . . 1 . . 1! . 1 . . 3 . .', unit: 1, lo: 50, vel: 0.8, i: [0.35, 0.9], fx: 'brass', rev: 0.4 }),
    L.str({ i: [0.1, 0.6], vel: 0.55, att: 0.6, reg: [50, 74] }),
    L.brass({ i: [0.5, 1], vel: 0.7, att: 0.35, rel: 0.6 }),
    L.choir({ i: [0.6, 1], vowel: 'a', fs: 1.05, att: 0.4, n: 4, vel: 0.5 }),
    L.mel({ inst: 'brass', phr: { A: THEME_A, B: THEME_B }, seq: 'AB', every: 4, oct: 4, vel: 0.85, att: 0.04, i: [0.45, 0.9], rev: 0.5 }),
    L.perc({ pats: ['K..KK.K.K..KK.K.', 'K..KK.K.K.K.KKKK'], vel: 0.85, i: [0.0, 0.5], fill: 'TTTTTTTTKKKKKKKK', fillEvery: 4 }),
    L.perc({ pats: ['....S.......S...', '....S.......S.S.'], vel: 0.75, i: [0.3, 0.8] }),
    L.perc({ pats: ['h.hhh.hhh.hhh.hh'], vel: 0.5, i: [0.5, 1] }),
    L.perc({ pats: ['m...............', '..........m.....'], vel: 0.55, i: [0.6, 1] }),
    L.rise({ bar: 0, len: 1, vel: 0.5, hit: ['c', 'K'], i: [0.5, 1], every: 2 }),
  ] },

  /* ------------------------------------------------------------------ CHASE: relentless synth/strings pulse (E minor) */
  chase: { key: 'E', mode: 'minor', bpm: 150, prog: 'i bVI bVII V', layers: [
    L.sub({ vel: 0.6, lo: 28, drive: 3 }),
    L.arp({ inst: 'arpsyn', rate: 1, pattern: 'updown', reg: [52, 76], vel: 0.45, fx: 'pluck', dly: 0.75, wet: 0.28, i: [0, 1], rev: 0.35, o: { tc: 0.09 } }),
    L.ost({ inst: 'synbass', pat: 'R R . R R . R R', lo: 40, vel: 0.6, fx: 'sat', rev: 0.1, gate: 0.6, i: [0, 1] }),
    L.ost({ inst: 'spicc', pat: '1 1 5 1 1 5 1 5 1 1 5 1 1 3 5 3', unit: 1, lo: 52, vel: 0.5, i: [0.3, 1], fx: 'str', o: { tc: 0.06 }, gate: 0.5 }),
    L.ost({ inst: 'stab', pat: '3! . . 3 . . 5 . . . 3! . . . . .', unit: 1, lo: 52, vel: 0.75, i: [0.5, 1], fx: 'brass' }),
    L.str({ i: [0.4, 1], vel: 0.55, att: 0.4, reg: [57, 79] }),
    L.perc({ pats: ['k..kS..k.k..S..k', 'k..kS..k.k.kS.Sk'], vel: 0.8, i: [0.1, 0.5] }),
    L.perc({ pats: ['hhhhhhhhhhhhhhhh'], vel: 0.4, i: [0.35, 1] }),
    L.perc({ pats: ['K...K...K...K...'], vel: 0.8, i: [0.55, 1] }),
    L.rise({ bar: 0, len: 1, vel: 0.5, hit: ['c'], i: [0.4, 1], every: 4 }),
  ] },

  /* ------------------------------------------------------------------ HORROR: music-box lullaby, clusters, scrapes (F# phrygian) */
  horror: { key: 'F#', mode: 'phrygian', bpm: 64, prog: 'i:2 bII:2 i:2 bV:2', layers: [
    L.drone({ notes: [0, 1], every: 4, vel: 0.5, lo: 30 }),
    L.sub({ vel: 0.4, lo: 30 }),
    L.glass({ i: [0, 1], vel: 0.5, reg: [72, 94], n: 4, att: 2.5 }),
    L.str({ i: [0.3, 0.9], vel: 0.35, reg: [62, 84], att: 0.3, n: 3 }),
    L.mel({ inst: 'bell', gen: { cells: ['x...x...x...x...', 'x...x.x.x.......', 'x.......x.x.....', 'x...x...........'], rest: 0.15, pent: true, lo: 76, hi: 94, period: 2 }, every: 4, oct: 5, vel: 0.5, rev: 0.9, o: { tc: 1.1 }, i: [0, 1] }),
    L.heart({ bpm: 88, vel: 0.5, i: [0.35, 1] }),
    L.tex({ kinds: ['whisper', 'scrape', 'creak', 'drip', 'groan', 'breath'], rate: 1.6, vel: 0.8 }),
    L.hit({ inst: 'braam', dur: 2.2, lo: 30, vel: 0.6, bars: [3], every: 2, at: 1, i: [0.5, 1] }),
    L.rise({ bar: 0, len: 2, how: 'rev', vel: 0.4, i: [0.4, 1], every: 1 }),
  ] },

  /* ------------------------------------------------------------------ SORROW: solo cello/violin, piano, soft strings (D minor) */
  sorrow: { key: 'D', mode: 'minor', bpm: 56, prog: 'i bVI bIII bVII iv bVI V:2', layers: [
    L.warm({ vel: 0.6, att: 2.2, cut: 1500 }),
    L.sub({ vel: 0.35, lo: 26 }),
    L.mel({ inst: 'solo', phr: { A: THEME_A, B: THEME_B, C: THEME_C }, seq: 'ACBC', every: 4, oct: 4, vel: 0.7, i: [0, 1], rev: 0.75, vib: 4 }),
    L.mel({ inst: 'solo', phr: { A: THEME_A, B: THEME_B, C: THEME_C }, seq: 'ACBC', every: 4, oct: 3, vel: 0.5, i: [0.5, 1], rev: 0.75, att: 0.3 }),
    L.arp({ inst: 'piano', rate: 4, pattern: 'up', reg: [55, 79], vel: 0.38, rest: 0.4, i: [0.1, 0.6], rev: 0.75 }),
    L.str({ i: [0.3, 0.9], vel: 0.55, att: 2.4, rel: 2.5, reg: [50, 74] }),
    L.choir({ i: [0.55, 1], vowel: 'o', fs: 1.12, reg: [62, 79], n: 3, att: 2.5, vel: 0.45 }),
    L.bell({ rate: 0.3, i: [0.5, 1], vel: 0.3, reg: [79, 100] }),
  ] },

  /* ------------------------------------------------------------------ NUCLEAR: ringing silence, sub swells, choir clusters (C phrygian) */
  nuclear: { key: 'C', mode: 'phrygian', bpm: 42, prog: 'icl:4 bIIcl:2 bviicl:2', layers: [
    L.drone({ notes: [0, 7, 12], every: 8, vel: 0.7, lo: 24, cut: 500 }),
    L.sub({ vel: 0.65, lo: 24, att: 2 }),
    L.tex({ kinds: ['tone', 'ping'], rate: 0.7, vel: 0.7, o: {} }),
    L.glass({ i: [0, 1], vel: 0.5, reg: [74, 98], n: 4, att: 4, rel: 4 }),
    L.choir({ i: [0.1, 0.7], vowel: 'o', fs: 0.92, reg: [48, 70], n: 4, att: 3.5, rel: 3, vel: 0.5 }),
    L.brass({ i: [0.45, 1], vel: 0.55, reg: [36, 55], n: 3, att: 3.5, rel: 3, g: 0.8 }),
    L.tex({ kinds: ['rumble', 'groan', 'wind', 'metal'], rate: 0.7, vel: 0.9 }),
    L.perc({ pats: ['t...............', '................', '................', '........t.......'], vel: 0.7, i: [0.4, 1], rev: 0.9 }),
    L.hit({ inst: 'braam', dur: 6, lo: 24, vel: 0.8, every: 99, at: 0, perc: ['b'], i: [0, 1] }),
    L.heart({ bpm: 42, vel: 0.45, i: [0.5, 1] }),
  ] },

  /* ------------------------------------------------------------------ HOPE: rising, warm, major (C major, canon progression) */
  hope: { key: 'C', mode: 'major', bpm: 72, prog: 'I V vi iii IV I IV V', layers: [
    L.warm({ vel: 0.55, att: 1.6 }),
    L.sub({ vel: 0.4, lo: 24 }),
    L.arp({ inst: 'piano', rate: 2, pattern: 'updown', reg: [55, 79], vel: 0.45, i: [0, 0.6], rev: 0.65, rest: 0.05 }),
    L.str({ i: [0.25, 0.7], vel: 0.55, att: 1.8, rel: 2, reg: [52, 76] }),
    L.mel({ inst: 'horn', phr: { A: HOPE_A }, seq: 'A', every: 8, oct: 4, vel: 0.65, i: [0.3, 0.75], rev: 0.75 }),
    L.mel({ inst: 'solo', phr: { A: HOPE_A }, seq: 'A', every: 8, oct: 5, vel: 0.5, i: [0.6, 1], att: 0.2, rev: 0.75 }),
    L.arp({ inst: 'harp', rate: 4, pattern: 'up', reg: [64, 91], vel: 0.35, rest: 0.4, i: [0.5, 1], rev: 0.8, fx: 'pluck', wet: 0.28 }),
    L.choir({ i: [0.6, 1], vowel: 'a', fs: 1.12, n: 4, vel: 0.5, att: 1.8, reg: [60, 81] }),
    L.bell({ rate: 0.6, i: [0.5, 1], vel: 0.33 }),
    L.perc({ pats: ['k...............', '................', 'k.......k.......', '................'], vel: 0.55, i: [0.5, 1], rev: 0.6 }),
    L.perc({ pats: ['t...............'], vel: 0.55, i: [0.75, 1], rev: 0.8 }),
    L.rise({ bar: 0, len: 2, how: 'rev', hit: ['c'], vel: 0.4, i: [0.7, 1], every: 2 }),
  ] },

  /* ------------------------------------------------------------------ FINALE: the full orchestra, theme in major (E major) */
  finale: { key: 'E', mode: 'major', bpm: 78, prog: 'I V vi iii IV I IV V', layers: [
    L.sub({ vel: 0.6, lo: 28, drive: 2.5 }),
    L.warm({ vel: 0.5 }),
    L.str({ i: [0, 0.6], vel: 0.6, att: 1.2, reg: [52, 78], g: 0.9 }),
    L.str({ i: [0.4, 1], vel: 0.7, att: 0.9, reg: [55, 82] }),
    L.brass({ i: [0.3, 0.8], vel: 0.7, reg: [48, 72], att: 0.8, rel: 1.4 }),
    L.choir({ i: [0.4, 0.9], vowel: 'a', fs: 1.1, n: 4, vel: 0.6, att: 1.2, reg: [60, 84] }),
    L.mel({ inst: 'brass', phr: { A: HOPE_A }, seq: 'A', every: 8, oct: 4, vel: 0.8, att: 0.1, i: [0.3, 0.8], rev: 0.7 }),
    L.mel({ inst: 'strings', phr: { A: HOPE_A }, seq: 'A', every: 8, oct: 5, vel: 0.55, att: 0.2, fx: 'str', vib: 6, i: [0.55, 1], rev: 0.7 }),
    L.arp({ inst: 'harp', rate: 2, pattern: 'updown', reg: [58, 91], vel: 0.38, rest: 0.1, i: [0.2, 0.9], rev: 0.8, fx: 'pluck', wet: 0.25 }),
    L.arp({ inst: 'piano', rate: 4, pattern: 'up', reg: [60, 84], vel: 0.4, i: [0.1, 0.6], rev: 0.7, rest: 0.2 }),
    L.bell({ rate: 0.9, i: [0.3, 1], vel: 0.36 }),
    L.perc({ pats: ['K...............', '........K.......', 'K.......K...k.k.', '........K.......'], fill: 'K.K.K.K.TTTTTTTT', fillEvery: 8, vel: 0.8, i: [0.3, 0.9] }),
    L.perc({ pats: ['c...............', '................', '................', '................', 'c...............', '................', '................', '................'], vel: 0.55, i: [0.4, 1] }),
    L.rise({ bar: 0, len: 2, how: 'rev', hit: ['c', 'b'], vel: 0.55, i: [0.3, 1], every: 1 }),
  ] },

  /* ------------------------------------------------------------------ CREDITS: bittersweet roll (D major) */
  credits: { key: 'D', mode: 'major', bpm: 92, prog: 'I V vi IV IV I V:2', layers: [
    L.warm({ vel: 0.5, att: 1.5 }),
    L.sub({ vel: 0.4, lo: 26 }),
    L.ost({ inst: 'piano', pat: '1 3 2 3 4 3 2 3', lo: 50, vel: 0.5, gate: 0.9, i: [0, 1], fx: 'none', rev: 0.6 }),
    L.ost({ inst: 'pluck', pat: 'R . . R . . R .', lo: 38, vel: 0.6, fx: 'sat', drive: 1.2, i: [0.2, 1], o: { bright: 0.3 }, rev: 0.15 }),
    L.str({ i: [0.25, 0.8], vel: 0.55, att: 1.4, reg: [52, 76] }),
    L.mel({ inst: 'solo', phr: { A: [[5, 1.5], [8, 0.5], [7, 1], [5, 1], [7, 2], [5, 1], [4, 1], [3, 2], [2, 1], [3, 1], [4, 2], [2, 1], [1, 1], [3, 2], [5, 2], [4, 2], [2, 2], [1, 4]] }, seq: 'A', every: 8, oct: 4, vel: 0.62, i: [0.2, 0.8], rev: 0.75 }),
    L.perc({ pats: ['k.......k.......'], vel: 0.55, i: [0.4, 1], rev: 0.3 }),
    L.perc({ pats: ['....s.......s...'], vel: 0.5, i: [0.5, 1] }),
    L.perc({ pats: ['g.g.g.g.g.g.g.g.'], vel: 0.45, i: [0.45, 1], rev: 0.15 }),
    L.bell({ rate: 0.5, i: [0.5, 1], vel: 0.3 }),
    L.choir({ i: [0.65, 1], vowel: 'o', fs: 1.1, vel: 0.4, att: 1.4 }),
  ] },

  /* ------------------------------------------------------------------ TENSION LOW: held breath (E phrygian) */
  tension_low: { key: 'E', mode: 'phrygian', bpm: 60, prog: 'i:4 bII:4', layers: [
    L.drone({ notes: [0, 7], every: 8, vel: 0.55, lo: 28 }),
    L.sub({ vel: 0.5, lo: 28 }),
    L.glass({ i: [0, 0.8], vel: 0.35, reg: [70, 90], n: 3, att: 3 }),
    L.ost({ inst: 'sub', pat: 'R . . . . . . . . . . . . . . .', unit: 1, lo: 40, vel: 0.7, fx: 'sat', rev: 0.4, o: { att: 0.05, rel: 0.7 } }),
    L.perc({ pats: ['m...............', '................', '............m...', '................'], vel: 0.35, rev: 0.9 }),
    L.tex({ kinds: ['whisper', 'wind', 'drip', 'creak'], rate: 0.6, vel: 0.6 }),
    L.heart({ bpm: 60, vel: 0.45, i: [0.35, 1] }),
    L.str({ i: [0.5, 1], vel: 0.35, att: 3, reg: [52, 70] }),
  ] },

  /* ------------------------------------------------------------------ TENSION HIGH: racing pulse, rising (B minor) */
  tension_high: { key: 'B', mode: 'minor', bpm: 120, prog: 'i:2 bII:2', layers: [
    L.sub({ vel: 0.6, lo: 23, drive: 3 }),
    L.ost({ inst: 'spicc', pat: '1! . 1 1 1! . 1 . 1! . 1 1 1! 3 5 3', unit: 1, lo: 47, vel: 0.55, fx: 'lp', cut: 3000, gate: 0.5, o: { tc: 0.06 } }),
    L.heart({ bpm: 120, vel: 0.5 }),
    L.perc({ pats: ['K...K...K...K...'], vel: 0.7, i: [0.4, 1] }),
    L.brass({ i: [0.5, 1], vel: 0.55, att: 1.5, rel: 1.2 }),
    L.glass({ i: [0.2, 1], vel: 0.4, reg: [72, 96], att: 1 }),
    L.perc({ pats: ['m...............', '................', '........m.......', '................'], vel: 0.5, i: [0.45, 1] }),
    L.perc({ pats: ['h.h.h.h.h.h.h.h.'], vel: 0.35, i: [0.3, 1] }),
    L.rise({ bar: 0, len: 2, vel: 0.5, hit: ['K'], i: [0.3, 1], every: 1 }),
  ] },

  /* ------------------------------------------------------------------ ALIEN: whole-tone drift, theremin, inharmonic bells (C whole-tone) */
  alien: { key: 'C', mode: 'wholetone', bpm: 70, prog: 'Iwt:2 IIwt:2 bIIIwt:2 IIwt:2', layers: [
    L.drone({ notes: [0, 6], every: 8, vel: 0.5, lo: 24, cut: 700 }),
    L.sub({ vel: 0.4, lo: 24 }),
    L.glass({ i: [0, 1], vel: 0.55, reg: [60, 88], n: 4, att: 3 }),
    L.choir({ i: [0.25, 1], vowel: 'o', fs: 1.0, vib: 14, n: 3, att: 2.5, reg: [55, 76], vel: 0.45 }),
    L.mel({ inst: 'theremin', gen: { pent: false, cells: ['x.......x.......', 'x.....x.........', 'x...x...........'], rest: 0.2, lo: 64, hi: 88 }, glide: true, every: 4, oct: 5, vel: 0.5, i: [0.1, 0.8], rev: 0.9 }),
    L.bell({ rate: 0.9, reg: [64, 100], scale: true, i: [0.2, 1], vel: 0.4 }),
    L.tex({ kinds: ['tone', 'click', 'ping', 'whisper'], rate: 1.3, vel: 0.7 }),
    L.tex({ kinds: ['groan', 'rumble'], rate: 0.35, vel: 0.7, i: [0.4, 1] }),
    L.perc({ pats: ['m...............', '................'], vel: 0.35, i: [0.55, 1], rev: 0.95 }),
  ] },

  /* ------------------------------------------------------------------ WONDER: harp, glass, soaring horn (D lydian) */
  wonder: { key: 'D', mode: 'lydian', bpm: 76, prog: 'I:2 II:2 IM7:2 II:2', layers: [
    L.glass({ i: [0, 1], vel: 0.55, reg: [66, 90], n: 4, att: 2.5 }),
    L.warm({ vel: 0.45, att: 2 }),
    L.sub({ vel: 0.35, lo: 26 }),
    L.arp({ inst: 'harp', rate: 2, pattern: 'up', reg: [62, 90], vel: 0.42, rest: 0.12, i: [0, 1], rev: 0.85, fx: 'pluck', wet: 0.3 }),
    L.str({ i: [0.2, 0.8], vel: 0.55, att: 2.2, rel: 2.4, reg: [52, 78] }),
    L.mel({ inst: 'horn', phr: { A: WONDER }, seq: 'A', every: 8, oct: 4, vel: 0.65, i: [0.35, 0.85], rev: 0.8 }),
    L.mel({ inst: 'vox', vowel: 'a', phr: { A: WONDER }, seq: 'A', every: 8, oct: 5, vel: 0.5, i: [0.6, 1], rev: 0.85 }),
    L.bell({ rate: 1.0, i: [0.1, 1], vel: 0.38, scale: true, reg: [74, 100] }),
    L.choir({ i: [0.55, 1], vowel: 'a', fs: 1.15, n: 4, vel: 0.45, att: 2, reg: [62, 84] }),
    L.perc({ pats: ['t...............', '................', '................', '........t.......'], vel: 0.5, i: [0.65, 1], rev: 0.85 }),
  ] },

  /* ------------------------------------------------------------------ RESOLVE: determination, march, theme in minor (C minor) */
  resolve: { key: 'C', mode: 'minor', bpm: 84, prog: 'i bVI bIII bVII i bVI bVII V', layers: [
    L.sub({ vel: 0.6, lo: 24, drive: 2.5 }),
    L.ost({ inst: 'spicc', pat: '1 1 1 1 1 1 1 1', lo: 48, vel: 0.6, fx: 'str', i: [0, 1], gate: 0.55, o: { tc: 0.08 } }),
    L.ost({ inst: 'cello', pat: '1 . 3 . 5 . 3 .', lo: 36, vel: 0.6, i: [0.2, 0.8], fx: 'lp', cut: 2200 }),
    L.str({ i: [0.1, 0.6], vel: 0.55, att: 1.2 }),
    L.brass({ i: [0.4, 0.95], vel: 0.65, att: 0.8, rel: 1.2 }),
    L.mel({ inst: 'horn', phr: { A: THEME_A, B: THEME_B }, seq: 'AB', every: 4, oct: 4, vel: 0.75, i: [0.35, 0.85], rev: 0.65 }),
    L.mel({ inst: 'brass', phr: { A: THEME_A, B: THEME_B }, seq: 'AB', every: 4, oct: 3, vel: 0.55, att: 0.1, i: [0.7, 1], rev: 0.6 }),
    L.choir({ i: [0.6, 1], vowel: 'a', fs: 1.0, vel: 0.5, n: 4, att: 1.0 }),
    L.perc({ pats: ['S.S.SS..S.S.S.SS', 'S.S.SS..S.S.SSSS'], vel: 0.6, i: [0.2, 0.7], rev: 0.35 }),
    L.perc({ pats: ['K.......K.......', 'K.......K...K.K.'], vel: 0.8, i: [0.35, 0.9] }),
    L.rise({ bar: 0, len: 2, how: 'rev', hit: ['K', 'c'], vel: 0.55, i: [0.4, 1], every: 1 }),
  ] },
};

/* ================================================================== STINGERS: fn(L, t, o) — L is the stinger layer {syn, rng, in, ...} */
const note = (name, t, dur, m, v = 0.8, o = {}) => INST[name](ST, t, dur, m, v, o);
let ST = null;
const run = (L, f) => { ST = L; f(); ST = null; };
export const STINGERS = {
  hit: (L, t) => run(L, () => {
    PERC.b(L, t, 1.0); PERC.K(L, t, 0.9); INST.braam(L, t, 2.4, 28, 0.85); PERC.c(L, t + 0.01, 0.6); PERC.m(L, t, 0.5, { f: 260 });
  }),
  sting_news: (L, t) => run(L, () => {
    [[0, 76, 0.2], [0.17, 79, 0.2], [0.34, 83, 0.2], [0.52, 88, 1.3]].forEach(([d, m, len]) => { note('stab', t + d, len, m, 0.85, { att: 0.012, rel: 0.5 }); note('bell', t + d, 1, m + 12, 0.45); });
    PERC.K(L, t, 0.8); PERC.K(L, t + 0.52, 0.9); PERC.c(L, t + 0.52, 0.5); note('strings', t + 0.5, 1.4, 64, 0.5, { att: 0.05, rel: 1 }); note('strings', t + 0.5, 1.4, 71, 0.5, { att: 0.05, rel: 1 });
  }),
  sting_alien: (L, t) => run(L, () => {
    note('theremin', t, 1.6, 76, 0.7, { from: 88 }); note('theremin', t + 1.1, 1.8, 70, 0.6, { from: 82 });
    for (const [d, m] of [[0, 77], [0.4, 80], [0.9, 83], [1.5, 71]]) note('bell', t + d, 1, m, 0.45, { tc: 2.2 });
    INST.dronesaw(L, t, 3.0, 36, 0.7, { att: 1.0, rel: 2.0 }); TEX.click(L, t + 0.2, 0.9); TEX.tone(L, t + 0.4, 0.6); PERC.m(L, t + 1.6, 0.4, { f: 233 });
  }),
  sting_loss: (L, t) => run(L, () => {
    [[0, 69, 1.2], [1.2, 65, 1.2], [2.4, 62, 3.0]].forEach(([d, m, len]) => note('solo', t + d, len, m, 0.7, { att: 0.2, rel: 1.4 }));
    for (const m of [50, 57, 62, 65]) note('strings', t, 4, m, 0.5, { att: 0.8, rel: 2.5 }); note('piano', t + 0.1, 3, 50, 0.6); note('piano', t + 2.4, 3, 38, 0.6); PERC.k(L, t, 0.5);
  }),
  sting_hope: (L, t) => run(L, () => {
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => note('harp', t + i * 0.12, 2, m, 0.65, { ring: 2.2 }));
    for (const m of [48, 55, 64, 67]) note('strings', t + 0.3, 3.5, m, 0.55, { att: 1.0, rel: 2 }); note('horn', t + 0.9, 2.6, 72, 0.6, { att: 0.4 }); note('bell', t + 0.9, 1, 96, 0.4); note('bell', t + 1.1, 1, 91, 0.35);
  }),
  sting_horror: (L, t) => run(L, () => {
    INST.braam(L, t, 1.6, 30, 0.8); PERC.m(L, t, 0.7, { f: 330 }); for (const m of [90, 91, 96]) note('glass', t, 2.2, m, 0.7, { att: 0.02, rel: 1.5 });
    const S = L.syn(t); const o = S.o('sawtooth', 1600, t, 1.2); o.frequency.exponentialRampToValueAtTime(3600, t + 1.0); const f = S.f('bandpass', 2400, 4), g = S.g(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.05); g.gain.setTargetAtTime(0, t + 0.5, 0.2); o.connect(f); f.connect(g); g.connect(L.in);
  }),
  sting_victory: (L, t) => run(L, () => {
    [[0, 60, 0.3], [0.3, 64, 0.3], [0.6, 67, 0.3], [0.9, 72, 1.8]].forEach(([d, m, len]) => { note('brass', t + d, len, m, 0.8, { att: 0.03, rel: 0.7, bright: 1.2 }); note('brass', t + d, len, m - 12, 0.7, { att: 0.03, rel: 0.7 }); });
    PERC.K(L, t + 0.9, 0.9); PERC.c(L, t + 0.9, 0.6); note('choir', t + 0.9, 2.2, 72, 0.6, { att: 0.2 }); note('choir', t + 0.9, 2.2, 79, 0.5, { att: 0.2 });
  }),
};
