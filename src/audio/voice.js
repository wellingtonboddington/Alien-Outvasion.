// Voices.  style 'human' uses the browser's speechSynthesis (voice picked per character/gender/lang, rate fitted to the line's duration, cancelled on overrun)
// and falls back to a procedural FORMANT VOICE.  'alien' | 'robot' | 'radio' | 'ai' (and 'babble' mode) are always procedural: a glottal source -> vowel
// formant filters, consonant noise bursts, sentence prosody, timed by buildVisemeTrack() so the audio is locked to the mouth animation.
import { RNG, Syn, hashStr, pluckEnv, line, cl, lin, cache } from './dsp.js';
import { buildVisemeTrack, estimateDuration } from '../engine/lipsync.js';

/* ------------------------------------------------------------------ character voice profiles */
const CAST = { // f0 Hz, fs formant scale, breath, rough
  mirrah: { g: 'F', f0: 238, fs: 1.22, breath: 0.09, rough: 0 }, bead: { g: 'M', f0: 116, fs: 1.0, breath: 0.05, rough: 0.05 }, jez: { g: 'F', f0: 206, fs: 1.17, breath: 0.1, rough: 0 },
  stephen: { g: 'M', f0: 98, fs: 0.96, breath: 0.06, rough: 0.05 }, ezra: { g: 'M', f0: 138, fs: 1.04, breath: 0.07, rough: 0 }, sam: { g: 'M', f0: 90, fs: 0.93, breath: 0.12, rough: 0.12 },
  jhaz: { g: 'F', f0: 184, fs: 1.1, breath: 0.07, rough: 0.1 }, leon: { g: 'M', f0: 126, fs: 1.0, breath: 0.05, rough: 0.35 }, epiphany: { g: 'F', f0: 246, fs: 1.25, breath: 0.08, rough: 0 },
};
export function voiceProfile(character, gender = 'M') {
  const c = character && CAST[String(character).toLowerCase()]; if (c) return { ...c };
  const h = hashStr(String(character || gender)); const u = (k) => ((h >>> (k * 5)) & 31) / 31;
  return gender === 'F' ? { g: 'F', f0: 176 + u(0) * 70, fs: 1.1 + u(1) * 0.14, breath: 0.05 + u(2) * 0.08, rough: u(3) * 0.15 } : { g: 'M', f0: 90 + u(0) * 48, fs: 0.94 + u(1) * 0.12, breath: 0.04 + u(2) * 0.08, rough: u(3) * 0.25 };
}

/* ------------------------------------------------------------------ formant tables (male adult Hz: F1 F2 F3) */
const VF = { A: [730, 1090, 2440], E: [530, 1840, 2480], I: [270, 2290, 3010], O: [570, 840, 2410], U: [300, 870, 2240] };
const CF = { L: [360, 1300, 2500], W: [300, 700, 2200], M: [250, 1100, 2200], H: [420, 1450, 1800], K: [480, 1500, 2500], F: [400, 1300, 2400], S: [400, 1300, 2400] };
const ALIEN_V = [[330, 780, 2100], [820, 1500, 2900], [450, 2100, 3300], [620, 640, 2000], [250, 1500, 2700], [900, 1900, 2500], [380, 1100, 3100], [700, 2400, 3300]];
const Q = [6, 8, 10];

function glottalWave(ctx, kind) { // band-limited glottal-like spectra
  const c = cache(ctx); const key = 'glot:' + kind; if (c[key]) return c[key]; const N = 64, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  const slope = kind === 'ai' ? 2.1 : kind === 'robot' ? 0.7 : 1.35;
  for (let k = 1; k <= N; k++) im[k] = 1 / Math.pow(k, slope) * (kind === 'robot' && k % 2 === 0 ? 0.3 : 1);
  c[key] = ctx.createPeriodicWave(re, im); return c[key];
}

/* ------------------------------------------------------------------ procedural formant voice */
/**
 * Builds the whole line on the audio clock.  Returns {S, end, stop(fade)}.
 */
function speakProc(A, o, t0, bus) {
  const ctx = A.ctx; const style = o.style || 'human'; const dur = o.dur; const rng = new RNG(hashStr((o.text || '') + (o.character || '') + style));
  const prof = o.prof; const S = new Syn(A, null, t0, 'voice'); const end = t0 + dur + 0.35;
  const track = buildVisemeTrack(o.text, dur); const keys = track.keys;
  const isRobot = style === 'robot', isAlien = style === 'alien', isAI = style === 'ai', isRadio = style === 'radio';
  let f0 = prof.f0 * (o.pitch || 1); let fs = prof.fs * Math.pow(o.pitch || 1, 0.35);
  if (isAlien) { f0 = 74 * (o.pitch || 1) * (0.9 + rng.next() * 0.25); fs = 0.85 + rng.next() * 0.3; }
  if (isRobot) { f0 = (prof.g === 'F' ? 150 : 105) * (o.pitch || 1); fs = prof.g === 'F' ? 1.1 : 0.98; }
  if (isAI) { f0 = (prof.g === 'F' ? 196 : 124) * (o.pitch || 1); fs = prof.g === 'F' ? 1.14 : 1.02; }
  // --- graph
  const outG = S.g(0.0); outG.gain.setValueAtTime(0, t0); outG.gain.linearRampToValueAtTime(1, t0 + 0.02); outG.gain.setValueAtTime(1, end - 0.1); outG.gain.linearRampToValueAtTime(0, end);
  const wave = glottalWave(ctx, isAI ? 'ai' : isRobot ? 'robot' : 'human'); const osc = S.ow(wave, f0, t0, dur + 0.4); const fp = osc.frequency; fp.setValueAtTime(f0, t0);
  const vib = S.o('sine', 5.1 + rng.next() * 0.9, t0, dur + 0.4), vg = S.g(f0 * (isRobot ? 0.0 : isAI ? 0.004 : 0.007)); vib.connect(vg); S.mod(vg, fp);
  if (isAlien) { for (const [r, d] of [[8.3, 0.05], [26, 0.045], [3.1, 0.07]]) { const l = S.o('sine', r * (0.8 + rng.next() * 0.4), t0, dur + 0.4), lg = S.g(f0 * d); l.connect(lg); S.mod(lg, fp); } }
  const voiced = S.g(0); osc.connect(voiced);
  if (isAlien) { const sub = S.ow(wave, f0 * 0.5, t0, dur + 0.4); const sg = S.g(0.7); sub.connect(sg); sg.connect(voiced); S.mod(vg, sub.frequency); }
  if (prof.rough > 0.02 && !isRobot && !isAI) { const rl = S.o('square', 38 + rng.next() * 12, t0, dur + 0.4), rg = S.g(prof.rough * 0.35); rl.connect(rg); S.mod(rg, voiced.gain); }
  const asp = S.n('white', t0, dur + 0.4), aspG = S.g(prof.breath * (isRobot ? 0.2 : isAI ? 0.35 : 1)); asp.connect(aspG); aspG.connect(voiced);
  const mix = S.g(1); const fb = S.g(isAlien ? 1.1 : 1.4); fb.connect(mix);
  const fil = [0, 1, 2].map((i) => { const b = S.f('bandpass', fs * [500, 1500, 2500][i], Q[i] * (isAlien ? 1.2 : 1)); const g = S.g([1, 0.75, 0.4][i]); voiced.connect(b); b.connect(g); g.connect(fb); return b; });
  const f4 = S.f('bandpass', 3500 * fs, 8), f4g = S.g(0.15); voiced.connect(f4); f4.connect(f4g); f4g.connect(fb);
  // consonant noise (bypasses the formants)
  const cn = S.n('white', t0, dur + 0.4), cf = S.f('bandpass', 4000, 1), cg = S.g(0); cn.connect(cf); cf.connect(cg); cg.connect(mix);
  // --- style post-processing
  let tail = mix;
  if (isRobot || isAlien) { // ring modulation (voice * carrier), blended with the dry signal
    const rm = S.g(0), car = S.o('sine', isRobot ? 52 : 158 + rng.next() * 30, t0, dur + 0.4), cg2 = S.g(1); car.connect(cg2); S.mod(cg2, rm.gain); mix.connect(rm);
    const dry = S.g(isRobot ? 0.45 : 0.55), wet = S.g(isRobot ? 0.8 : 0.7); mix.connect(dry); rm.connect(wet); const sum = S.g(1); dry.connect(sum); wet.connect(sum); tail = sum;
    if (isRobot) { const crush = S.shaper('crush', 22); tail.connect(crush); const s2 = S.g(1); crush.connect(s2); const dl = S.delay(0.0068, 0.05), fbk = S.g(0.5); s2.connect(dl); dl.connect(fbk); fbk.connect(s2); tail = s2; }
    if (isAlien) { const sat = S.shaper('tube', 3); tail.connect(sat); tail = sat; }
  }
  if (isRadio) {
    const hp = S.f('highpass', 420, 0.8), lp = S.f('lowpass', 3100, 0.9), sat = S.shaper('tube', 3), pk = S.f('peaking', 1500, 1.2, 5); tail.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(sat); tail = sat;
    const st = S.n('white', t0, dur + 0.4), sf = S.f('bandpass', 1900, 0.5), sg = S.g(0); st.connect(sf); sf.connect(sg); sg.connect(tail); line(sg.gain, t0, [[0, 0], [0.04, 0.035], [dur, 0.03], [dur + 0.05, 0]]);
    // squelch open / close blips
    const sq = (tt, a) => { const n = S.n('white', tt, 0.1), f = S.f('bandpass', 2500, 0.8), g = S.g(0); pluckEnv(g.gain, tt, a, 0.02, 0.002); n.connect(f); f.connect(g); g.connect(outG); }; sq(t0, 0.18); sq(t0 + dur + 0.05, 0.14);
  }
  if (isAI) { // gentle chorus shimmer + octave sparkle
    const dly = [S.delay(0.013, 0.1), S.delay(0.019, 0.1)]; const sum = S.g(1); tail.connect(sum); dly.forEach((d, i) => { const l = S.o('sine', 0.31 + i * 0.12, t0, dur + 0.4), lg = S.g(0.0024); l.connect(lg); S.mod(lg, d.delayTime); const g = S.g(0.35); tail.connect(d); d.connect(g); g.connect(sum); }); tail = sum;
  }
  tail.connect(outG);
  const pn = S.pan(o.pan || 0); outG.connect(pn);
  const dry = S.g(1), wS = S.g(isAlien ? 0.25 : isRadio ? 0.04 : 0.12), wL = S.g(isAlien ? 0.7 : isAI ? 0.2 : 0.05); pn.connect(dry); pn.connect(wS); pn.connect(wL); dry.connect(bus.dry); wS.connect(bus.wetS); wL.connect(bus.wetL);
  // --- schedule the timeline
  const mono = isRobot; const pRange = isRobot ? 0 : isAI ? 0.5 : isAlien ? 1.2 : 1;
  const tcF = isAI ? 0.035 : 0.018; let cur = VF.A.map((x) => x * fs); const text = o.text.trim(); const lead = text.replace(/^[^\p{L}\p{N}]+/u, ''); const punc = lead.match(/[,;:—\-.!?…]/g) || []; const finalCh = text.slice(-1);
  // clause segmentation (rest keys with weight >= 1 are punctuation)
  const clauses = []; let cs = [], pi = 0; for (let i = 0; i < keys.length; i++) { const k = keys[i]; cs.push(i); if (k.v === 'rest' && k.w >= 1.0) { clauses.push({ keys: cs, end: punc[pi++] || '.' }); cs = []; } } clauses.push({ keys: cs, end: finalCh });
  const vowelOf = {}; let nAlien = 0; let lastClickT = -1;
  clauses.forEach((cl2) => {
    const vks = cl2.keys.filter((i) => VF[keys[i].v]); const nv = Math.max(1, vks.length); let vi = 0; const q = cl2.end === '?', ex = cl2.end === '!', cm = cl2.end === ',' || cl2.end === ';';
    for (const i of cl2.keys) {
      const k = keys[i]; const ts = t0 + k.t0, te = t0 + k.t1, kd = k.t1 - k.t0; const v = k.v;
      const isV = !!VF[v];
      if (isV) {
        const p = vi / Math.max(1, nv - 1 || 1); vi++; let mul = 1 + (0.09 - 0.17 * p) * pRange; if (ex) mul += 0.07 * pRange * (1 - p); if (q) mul += (p > 0.55 ? (p - 0.55) * 0.65 : 0) * pRange; if (cm && p > 0.7) mul += 0.03 * pRange; if (!q && !ex && !cm && p > 0.8) mul -= 0.06 * pRange;
        const prev = keys[i - 1]; if (prev && prev.v === 'rest' && prev.w < 1) mul += 0.045 * pRange * (rng.next() < 0.6 ? 1 : 0.4); // word-initial accent
        if (isAlien) mul *= 1 + (rng.next() - 0.5) * 0.18; const fv = f0 * mul;
        fp.setTargetAtTime(fv, ts, mono ? 0.01 : 0.045);
        let form = VF[v]; if (isAlien) { const key = v + (nAlien++ % 4); vowelOf[key] = vowelOf[key] ?? ALIEN_V[hashStr(key + o.text.length) % ALIEN_V.length]; form = vowelOf[key]; }
        const f3 = form.map((x) => x * fs); const tcc = Math.min(tcF, kd * 0.5);
        fil.forEach((b, j) => b.frequency.setTargetAtTime(f3[j], ts, tcc)); cur = f3;
        const amp = (isAI ? 0.9 : 1) * (0.85 + rng.next() * 0.3) * (ex ? 1.15 : 1);
        voiced.gain.setTargetAtTime(amp, ts, isAI ? 0.02 : 0.012); if (kd > 0.12) voiced.gain.setTargetAtTime(amp * 0.92, te - kd * 0.35, 0.05);
        cg.gain.setTargetAtTime(0, ts, 0.01);
      } else if (v === 'rest') {
        voiced.gain.setTargetAtTime(0, ts, 0.018); cg.gain.setTargetAtTime(0, ts, 0.01);
      } else { // consonant classes
        const form = CF[v] || CF.K; const f3 = form.map((x) => x * fs); const tcc = Math.min(tcF, kd * 0.5);
        if (v === 'L' || v === 'W' || v === 'M' || v === 'H') fil.forEach((b, j) => b.frequency.setTargetAtTime(f3[j], ts, tcc));
        const va = { L: 0.55, W: 0.55, M: 0.32, H: 0.4, K: 0.18, F: 0.12, S: 0.0 }[v]; voiced.gain.setTargetAtTime(va * (isAlien ? 0.7 : 1), ts, 0.01);
        if (v === 'S') { cf.frequency.setValueAtTime(5800, ts); cf.Q.setValueAtTime(0.9, ts); cg.gain.setTargetAtTime(isRobot ? 0.12 : 0.34, ts, 0.008); cg.gain.setTargetAtTime(0, te - 0.01, 0.01); }
        else if (v === 'F') { cf.frequency.setValueAtTime(3600, ts); cf.Q.setValueAtTime(0.6, ts); cg.gain.setTargetAtTime(0.17, ts, 0.01); cg.gain.setTargetAtTime(0, te - 0.01, 0.012); }
        else if (v === 'H') { cf.frequency.setValueAtTime(3000, ts); cf.Q.setValueAtTime(1.0, ts); cg.gain.setTargetAtTime(0.26, ts, 0.01); cg.gain.setTargetAtTime(0, te - 0.01, 0.012); }
        else if (v === 'K') { cf.frequency.setValueAtTime(1700, ts); cf.Q.setValueAtTime(1.0, ts); cg.gain.setValueAtTime(0, ts); cg.gain.setTargetAtTime(0.42, ts + kd * 0.45, 0.004); cg.gain.setTargetAtTime(0, ts + kd * 0.45 + 0.012, 0.01); voiced.gain.setTargetAtTime(0.04, ts, 0.006); voiced.gain.setTargetAtTime(0.6, ts + kd * 0.5, 0.01); }
        else if (v === 'L') { cf.frequency.setValueAtTime(3200, ts); cf.Q.setValueAtTime(1.2, ts); cg.gain.setTargetAtTime(0.16, ts, 0.004); cg.gain.setTargetAtTime(0, ts + 0.02, 0.008); }
        else if (v === 'M') { voiced.gain.setTargetAtTime(0.08, ts + kd * 0.45, 0.01); cf.frequency.setValueAtTime(900, ts); cf.Q.setValueAtTime(0.9, ts); cg.gain.setTargetAtTime(0.14, ts + kd * 0.8, 0.004); cg.gain.setTargetAtTime(0, ts + kd * 0.8 + 0.012, 0.01); }
        else cg.gain.setTargetAtTime(0, ts, 0.01);
        if (isAlien && ts - lastClickT > 0.055) { // mandible click timed with the consonant
          lastClickT = ts; const f = 1200 + rng.next() * 2200; const n = S.n('white', ts, 0.05), b = S.f('bandpass', f, 9), g = S.g(0); pluckEnv(g.gain, ts, 0.5, 0.005, 0.0008); n.connect(b); b.connect(g); g.connect(outG);
          const th2 = S.o('sine', 300 + rng.next() * 90, ts, 0.06); th2.frequency.exponentialRampToValueAtTime(130, ts + 0.04); const tg = S.g(0); pluckEnv(tg.gain, ts, 0.3, 0.01, 0.001); th2.connect(tg); tg.connect(outG);
        }
      }
    }
  });
  voiced.gain.setTargetAtTime(0, t0 + dur, 0.03); cg.gain.setTargetAtTime(0, t0 + dur, 0.02);
  S.tEnd = end; return { S, end, stop(fade = 0.04) { const now = A.now(); outG.gain.cancelScheduledValues(now); outG.gain.setTargetAtTime(0, now, fade / 3); S.stopAt(now + fade * 1.5 + 0.02); } };
}

/* ------------------------------------------------------------------ TTS (speechSynthesis) */
const FEMALE = /\b(female|woman|girl)\b|samantha|victoria|karen|moira|tessa|fiona|zira|susan|hazel|aria|jenny|linda|catherine|heather|allison|ava\b|kathy|princess|veena|serena|joanna|salli|ivy|kendra|kimberly|nicole|amy|emma|olivia|sara|helen|eva\b|google us english|zoe|ellen|laura|paulina|monica|amelie|anna\b|yuna|ting-ting|mei-jia|kyoko|lekha/i;
const MALE = /(^|\b)(male|man|boy)\b|daniel|alex\b|fred\b|david|mark\b|george|ryan|guy\b|thomas|oliver|gordon|aaron|arthur|rishi|james|richard|paul\b|ralph|albert|bruce|junior|jorge|diego|lee\b|rocko|reed|eddy|evan|microsoft (mark|david|guy|ryan|george)/i;
function classifyVoice(v) { const n = v.name || ''; if (/female/i.test(n) || FEMALE.test(n)) return 'F'; if (MALE.test(n)) return 'M'; return '?'; }

function createTTS(A) {
  const synth = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null; const keep = []; const cal = {}; let voices = [], vv = 1;
  if (!synth) return null;
  const refresh = () => { try { voices = [...synth.getVoices()].sort((a, b) => (a.name + a.lang).localeCompare(b.name + b.lang)); } catch (e) { voices = []; } };
  refresh(); try { synth.addEventListener ? synth.addEventListener('voiceschanged', refresh) : (synth.onvoiceschanged = refresh); } catch (e) { /* */ }
  function pick(lang, gender, character) {
    if (!voices.length) refresh(); if (!voices.length) return null; const L = String(lang || 'en-US').replace('_', '-').toLowerCase(); const base = L.split('-')[0];
    let c = voices.filter((v) => (v.lang || '').replace('_', '-').toLowerCase() === L); if (!c.length) c = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(base)); if (!c.length) c = voices.filter((v) => /^en/i.test(v.lang || '')); if (!c.length) c = voices;
    const loc = c.filter((v) => v.localService); if (loc.length) c = loc;
    const g = c.filter((v) => classifyVoice(v) === gender); if (g.length) c = g; else { const nf = c.filter((v) => classifyVoice(v) === '?'); if (nf.length) c = nf; }
    return { voice: c[hashStr(String(character || gender + L)) % c.length], exact: g.length > 0 };
  }
  function say(o, dur, hnd) {
    const text = o.text; const gender = o.gender === 'F' ? 'F' : 'M'; const sel = pick(o.lang, gender, o.character); const v = sel && sel.voice;
    const u = new SpeechSynthesisUtterance(text); u.lang = o.lang || 'en-US'; if (v) u.voice = v;
    const est = estimateDuration(text); const key = v ? v.voiceURI || v.name : 'default'; const k = cal[key] ?? 0.92; // seconds-at-rate-1 per estimated second
    const rate = cl((est * k) / Math.max(0.3, dur) * (o.rate || 1), 0.7, 1.8); u.rate = rate;
    const h = hashStr(String(o.character || gender)); let p = (o.pitch || 1) * (sel && sel.exact ? 1 : gender === 'F' ? 1.18 : 0.82); p *= 1 + (((h % 100) / 100) - 0.5) * 0.28; u.pitch = cl(p, 0.1, 2);
    u.volume = cl(vv * Math.min(1, A.masterLevel ?? 0.9) , 0, 1);
    let t0 = 0; keep.push(u);
    u.onstart = () => { t0 = performance.now(); hnd.started = true; };
    u.onend = () => { const i = keep.indexOf(u); if (i >= 0) keep.splice(i, 1); if (t0 && !hnd.cancelled) { const real = (performance.now() - t0) / 1000; const ratio = real * rate / Math.max(0.2, est); cal[key] = lin(cal[key] ?? 0.92, cl(ratio, 0.5, 1.6), 0.6); } hnd._end(); };
    u.onerror = () => { const i = keep.indexOf(u); if (i >= 0) keep.splice(i, 1); hnd._end(); };
    try {
      try { synth.resume(); } catch (e) { /* */ }
      if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(() => { if (!hnd.cancelled) synth.speak(u); }, 45); } else synth.speak(u);
    } catch (e) { hnd._end(); return; }
    // overrun guard: generous, so a slightly slow voice finishes its sentence instead of being cut mid-word
    hnd.timer = setTimeout(() => { if (!hnd.ended) { hnd.cancelled = true; try { synth.cancel(); } catch (e) { /* */ } hnd._end(); } }, (dur * 1.4 + 0.8) * 1000);
    hnd.cancel = () => { hnd.cancelled = true; try { synth.cancel(); } catch (e) { /* */ } };
  }
  return { synth, say, setVol(v) { vv = v; }, unlock() { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch (e) { /* */ } }, pause() { try { synth.pause(); } catch (e) { /* */ } }, resume() { try { synth.resume(); } catch (e) { /* */ } }, cancel() { try { synth.cancel(); } catch (e) { /* */ } } };
}

/* ------------------------------------------------------------------ public API */
export function createVoice(A) {
  const tts = A.offline ? null : createTTS(A); let mode = tts ? 'tts' : 'babble'; const active = new Set(); let idN = 0;
  const api = {
    /** say({text, lang='en-US', gender:'M'|'F', pitch=1, rate, duration, style:'human'|'alien'|'robot'|'radio'|'ai', pan, character, onend, duck=true}) -> {stop(), dur, tts} */
    say(o = {}) {
      const text = String(o.text || '').trim(); const dead = { stop() {}, dur: 0, tts: false, ended: true, id: -1 }; if (!text || mode === 'off') return dead;
      const style = o.style || 'human'; const rate = o.rate > 0 ? o.rate : 1; const dur = Math.max(0.25, o.duration > 0 ? o.duration : estimateDuration(text) / rate);
      const gender = o.gender === 'F' ? 'F' : 'M'; const hnd = { id: ++idN, dur, style, tts: false, ended: false, cancelled: false, started: false, S: null, timer: null, cancel: null,
        _end() { if (this.ended) return; this.ended = true; if (this.timer) clearTimeout(this.timer); active.delete(this); if (o.onend) { try { o.onend(); } catch (e) { /* */ } } },
        stop(fade = 0.05) { if (this.ended) return; this.cancelled = true; if (this.cancel) this.cancel(); if (this.proc) this.proc.stop(fade); this._end(); } };
      const ad = A.getAutoDuck ? A.getAutoDuck() : 0; if (o.duck !== false && ad > 0) A.duck(ad, dur + 0.35);
      const useTTS = style === 'human' && mode === 'tts' && tts;
      if (useTTS) { for (const h of [...active]) if (h.tts) h.stop(0.02); hnd.tts = true; active.add(hnd); tts.say({ ...o, text, gender }, dur, hnd); return hnd; }
      if (A.live.voice >= A.caps.voice) return dead;
      const prof = voiceProfile(o.character, gender); const t0 = A.now() + 0.03 + Math.max(0, o.delay || 0);
      const p = speakProc(A, { text, style, dur, pitch: o.pitch, pan: o.pan, character: o.character, prof }, t0, A.bus.voice); hnd.proc = p; p.S.onDone = () => hnd._end(); active.add(hnd);
      if (!A.offline) hnd.timer = setTimeout(() => hnd._end(), (dur + 0.6 + Math.max(0, o.delay || 0)) * 1000);
      return hnd;
    },
    setMode(m) { mode = m === 'tts' && !tts ? 'babble' : (m === 'tts' || m === 'babble' || m === 'off') ? m : mode; api.mode = mode; if (mode === 'off') api.stopAll(); return mode; },
    stopAll() { for (const h of [...active]) h.stop(0.03); if (tts) tts.cancel(); },
    mode, hasTTS: !!tts, profile: voiceProfile,
    _setVol(v) { if (tts) tts.setVol(Math.min(1, v)); }, _unlock() { if (tts) tts.unlock(); }, _pause() { if (tts) tts.pause(); },
  };
  return api;
}
