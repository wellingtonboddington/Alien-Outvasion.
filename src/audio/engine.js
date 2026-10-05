// ALIEN OUTVASION audio engine — CONTRACT §3.9.  Fully procedural WebAudio (no samples, no network).
//
//   const audio = createAudio();            // or createAudio({ ctx: offlineCtx }) for offline rendering/tests
//   await audio.resume();                    // from a user gesture (iOS-safe)
//   audio.music.play('title', { fade: 3, intensity: 0.4 });
//   audio.sfx.play('explosion_big', { pos: new THREE.Vector3(40, 5, -120) });
//   audio.voice.say({ text: 'Run!', gender: 'F', character: 'mirrah', duration: 1.2 });
//
// Signal flow:  sources -> stem buses (music / amb / sfx / voice, each with dry + short-reverb + long-reverb sends)
//               -> premaster -> muffle LPF -> glue compressor -> limiter -> master gain -> soft clipper (|y| < 1) -> destination
import { Q, RNG, hashStr } from '../engine/common.js';
import { makeIR, curve, silentBuffer, cl, sstep } from './dsp.js';
import { createMusic } from './music.js';
import { createSfx } from './sfx.js';
import { createAmb } from './amb.js';
import { createVoice } from './voice.js';
import { MIX } from './mix.js';

const DEFAULT_VOL = { music: 0.8, sfx: 0.9, voice: 1.0, amb: 0.75 };

function nullAudio() { // no WebAudio at all (very old browser / SSR): every call is a harmless no-op
  const h = { stop() {}, setGain() {}, setPitch() {}, setPos() {} };
  return {
    ctx: null, offline: false, resume: async () => {}, suspend: async () => {}, setMaster() {}, setVolumes() {}, duck() {}, setListener() {}, setMuffle() {}, setQuality() {}, update() {}, dispose() {}, now: () => 0,
    music: { play() {}, setIntensity() {}, stop() {}, stinger() {}, cue: null }, amb: { set() {}, clear() {} },
    sfx: { play: () => h, stopAll() {}, names: () => [] }, voice: { say: () => h, setMode() {}, stopAll() {}, mode: 'off' },
  };
}

export function createAudio(opts = {}) {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : (typeof AudioContext !== 'undefined' ? AudioContext : null);
  const ctx = opts.ctx || (AC ? (() => { try { return new AC({ latencyHint: 'playback' }); } catch (e) { try { return new AC(); } catch (e2) { return null; } } })() : null);
  if (!ctx) return nullAudio();
  const injected = !!opts.ctx;
  const offline = opts.offline !== undefined ? !!opts.offline : (typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext);
  const q = opts.quality !== undefined ? opts.quality : (Q && Q.mobile ? 0 : Q ? Q.level : 1);

  /* ---------------------------------------------------------------- shared state handed to the modules */
  const A = {
    ctx, offline, q, vtime: 0, rng: new RNG(hashStr('alien-outvasion-audio') ^ (opts.seed || 0)),
    live: { sfx: 0, music: 0, amb: 0, voice: 0 },
    caps: offline ? { sfx: 1e9, music: 1e9, amb: 1e9, voice: 1e9 } : { sfx: [16, 28, 46][cl(q, 0, 2)], music: [70, 130, 200][cl(q, 0, 2)], amb: 40, voice: 12 }, // (offline: nothing ends before rendering, so counters would never drop)
    lookahead: q === 0 ? 2.0 : 1.6, // seconds scheduled ahead of the audio clock: survives ~1.5 s main-thread stalls (scene swaps)
    now() { return offline ? A.vtime : ctx.currentTime; },
    tickers: new Set(), bus: {}, listener: { x: 0, y: 0, z: 0, rx: 1, ry: 0, rz: 0, fx: 0, fy: 0, fz: -1, ux: 0, uy: 1, uz: 0, cam: null },
    sampleRate: ctx.sampleRate, mix: opts.mix || MIX,
  };

  /* ---------------------------------------------------------------- master chain */
  const pre = ctx.createGain();
  const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = Math.min(22000, ctx.sampleRate / 2 - 100); muffle.Q.value = 0.6;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 16; comp.ratio.value = 2.6; comp.attack.value = 0.015; comp.release.value = 0.28;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.knee.value = 1; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  if (opts.bypassDynamics) { comp.threshold.value = 0; comp.ratio.value = 1; comp.knee.value = 0; limiter.threshold.value = 0; limiter.ratio.value = 1; limiter.knee.value = 0; } // measurement only
  const master = ctx.createGain(); master.gain.value = opts.master !== undefined ? opts.master : 0.9;
  const clipIn = ctx.createGain(); clipIn.gain.value = 0.5; // domain scaling for the 'safe' curve
  const clip = ctx.createWaveShaper(); clip.curve = curve('safe', 0); clip.oversample = 'none';
  const analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.8;
  pre.connect(muffle); muffle.connect(comp); comp.connect(limiter); limiter.connect(master); master.connect(clipIn); clipIn.connect(clip); clip.connect(ctx.destination);
  master.connect(analyser);

  /* reverbs: procedural IRs (no samples).  short = rooms/voices, long = halls/cathedral/horn tails */
  function makeReverb(irOpts, retGain) {
    const input = ctx.createGain(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160; hp.Q.value = 0.5;
    const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = makeIR(ctx, irOpts);
    const ret = ctx.createGain(); ret.gain.value = retGain;
    input.connect(hp); hp.connect(conv); conv.connect(ret); ret.connect(pre);
    return { in: input, conv, ret, base: retGain };
  }
  const revS = makeReverb({ secs: [0.9, 1.3, 1.7][cl(q, 0, 2)], rt60: 1.1, pre: 0.006, bright: 0.85, dark: 0.12, early: 10, seed: 3 }, 0.9);
  const revL = makeReverb({ secs: [2.6, 3.8, 5.2][cl(q, 0, 2)], rt60: [2.4, 3.4, 4.6][cl(q, 0, 2)], pre: 0.022, bright: 0.7, dark: 0.04, early: 12, seed: 7, width: 1.6, curvePow: 1 }, 0.8);
  A.revS = revS.in; A.revL = revL.in;

  /* stem buses: dry + two reverb sends, all scaled by stem volume * duck factor */
  function makeBus(name, vol) {
    const dry = ctx.createGain(), wetS = ctx.createGain(), wetL = ctx.createGain();
    dry.connect(pre); wetS.connect(revS.in); wetL.connect(revL.in);
    const b = { name, dry, wetS, wetL, vol, duck: 1, wet: 1,
      apply(t, tc = 0.05) { const v = this.vol * this.duck; for (const n of [dry, wetS, wetL]) n.gain.setTargetAtTime(v * (n === dry ? 1 : this.wet), t, tc); } };
    dry.gain.value = vol; wetS.gain.value = vol; wetL.gain.value = vol;
    A.bus[name] = b; return b;
  }
  const vol0 = { ...DEFAULT_VOL, ...(opts.volumes || {}) };
  makeBus('music', vol0.music); makeBus('amb', vol0.amb); makeBus('sfx', vol0.sfx); makeBus('voice', vol0.voice);

  /* ---------------------------------------------------------------- listener + 3D positional helper */
  const L = A.listener;
  function refreshListener() {
    const cam = L.cam; if (!cam || !cam.matrixWorld) return; const e = cam.matrixWorld.elements;
    L.x = e[12]; L.y = e[13]; L.z = e[14]; L.rx = e[0]; L.ry = e[1]; L.rz = e[2]; L.ux = e[4]; L.uy = e[5]; L.uz = e[6]; L.fx = -e[8]; L.fy = -e[9]; L.fz = -e[10];
  }
  /**
   * Positional chain: in -> distance gain -> air-absorption lowpass -> stereo pan -> out.  Also returns send levels for
   * the reverbs (farther = wetter).  `p` is any {x,y,z}; update() may be called every tick as the camera/source moves.
   */
  A.spatial = function (p, { ref = 8, roll = 1.15, minLp = 700 } = {}) {
    const inn = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; const out = pan || lp; inn.connect(lp); if (pan) lp.connect(pan);
    const s = { in: inn, out, pos: p, ref, wetMul: 1, dist: 0, dryGain: 1,
      update(t, instant) {
        const dx = p.x - L.x, dy = p.y - L.y, dz = p.z - L.z; const d = Math.sqrt(dx * dx + dy * dy + dz * dz); this.dist = d;
        const gd = d <= ref ? 1 : ref / (ref + roll * (d - ref));
        const xr = dx * L.rx + dy * L.ry + dz * L.rz, zf = dx * L.fx + dy * L.fy + dz * L.fz;
        const pn = xr / Math.sqrt(xr * xr + zf * zf + 0.4); const front = d > 0.01 ? zf / d : 1;
        const fc = Math.max(minLp, 19000 / (1 + d / (ref * 2.2))) * (0.78 + 0.22 * (front * 0.5 + 0.5));
        const tc = instant ? 0.001 : 0.035; this.dryGain = gd;
        inn.gain.setTargetAtTime(gd, t, tc); lp.frequency.setTargetAtTime(Math.min(fc, ctx.sampleRate / 2 - 100), t, tc); if (pan) pan.pan.setTargetAtTime(cl(pn, -1, 1), t, tc);
        this.wetMul = 1 + 1.6 * sstep(ref, ref * 25, d);
      },
      dispose() { try { inn.disconnect(); lp.disconnect(); if (pan) pan.disconnect(); } catch (e) { /* */ } } };
    return s;
  };

  /* ---------------------------------------------------------------- ducking */
  const duckSt = { amount: 0, until: 0, cur: 1, auto: 0.5 };
  A.duck = function (amount, seconds) {
    const t = A.now(); amount = cl(amount, 0, 0.95);
    if (t < duckSt.until) { duckSt.amount = Math.max(duckSt.amount, amount); duckSt.until = Math.max(duckSt.until, t + seconds); } else { duckSt.amount = amount; duckSt.until = t + seconds; }
    applyDuck(t);
  };
  function applyDuck(t) {
    const target = t < duckSt.until ? 1 - duckSt.amount : 1;
    if (Math.abs(target - duckSt.cur) < 1e-4) return;
    const attack = target < duckSt.cur; duckSt.cur = target;
    A.bus.music.duck = target; A.bus.amb.duck = 1 - (1 - target) * 0.75;
    A.bus.music.apply(t, attack ? 0.09 : 0.5); A.bus.amb.apply(t, attack ? 0.09 : 0.6);
  }

  /* ---------------------------------------------------------------- scheduler: worker timer (immune to tab throttling) with setInterval fallback */
  let timer = null, worker = null, disposed = false, lastTick = 0, wantRunning = false, frameDt = 0;
  function pump(now) {
    refreshListener(); applyDuck(now);
    const until = now + A.lookahead;
    for (const fn of A.tickers) { try { fn(now, until); } catch (e) { if (!A._warned) { A._warned = true; console.warn('[audio] ticker error', e); } } }
  }
  function startTimer() {
    if (offline || timer || worker || disposed) return;
    const tick = () => { if (disposed) return; pump(A.now()); };
    try {
      if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const blob = new Blob(['let id=setInterval(()=>postMessage(0),25);onmessage=()=>{clearInterval(id)}'], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob); worker = new Worker(url); worker.onmessage = tick; worker.onerror = () => { try { worker.terminate(); } catch (e) { /* */ } worker = null; if (!timer) timer = setInterval(tick, 25); };
        A.workerTimer = true; return;
      }
    } catch (e) { worker = null; }
    timer = setInterval(tick, 25);
  }
  A.masterLevel = master.gain.value; A.getAutoDuck = () => duckSt.auto;
  A.addTicker = (fn) => { A.tickers.add(fn); return () => A.tickers.delete(fn); };

  /* ---------------------------------------------------------------- sub-systems */
  const music = createMusic(A), sfx = createSfx(A), amb = createAmb(A), voice = createVoice(A);

  /* ---------------------------------------------------------------- iOS/Safari unlock + auto-resume */
  const unlockEvents = ['pointerdown', 'touchend', 'click', 'keydown'];
  const unlocker = () => { if (wantRunning && ctx.state !== 'running' && ctx.state !== 'closed') { try { ctx.resume(); } catch (e) { /* */ } } };
  if (typeof document !== 'undefined' && !offline) for (const ev of unlockEvents) document.addEventListener(ev, unlocker, { passive: true, capture: true });
  const onVis = () => { if (typeof document !== 'undefined' && !document.hidden) unlocker(); };
  if (typeof document !== 'undefined' && !offline) document.addEventListener('visibilitychange', onVis);

  const api = {
    ctx, offline, analyser, quality: q, bus: A.bus,
    /** call from a user gesture. Resolves when the context is running. */
    async resume() {
      wantRunning = true;
      try {
        if (!offline) {
          // iOS: play a 1-sample silent buffer inside the gesture, then resume
          try { const s = ctx.createBufferSource(); s.buffer = silentBuffer(ctx); s.connect(ctx.destination); s.start(0); } catch (e) { /* */ }
          if (ctx.state !== 'running') await ctx.resume();
          startTimer();
          voice._unlock && voice._unlock();
        }
      } catch (e) { /* autoplay blocked: the unlock listeners will retry on the next gesture */ }
      return ctx.state;
    },
    async suspend() { wantRunning = false; try { if (!offline) await ctx.suspend(); } catch (e) { /* */ } voice._pause && voice._pause(); },
    get state() { return ctx.state; },
    get timer() { return offline ? 'manual' : A.workerTimer ? 'worker' : 'interval'; },
    setMaster(v) { A.masterLevel = cl(v, 0, 1.5); master.gain.setTargetAtTime(A.masterLevel, A.now(), 0.03); },
    setVolumes(v = {}) { for (const k of ['music', 'sfx', 'voice', 'amb']) if (v[k] !== undefined && A.bus[k]) { A.bus[k].vol = cl(v[k], 0, 2); A.bus[k].apply(A.now(), 0.05); } if (v.voice !== undefined) voice._setVol && voice._setVol(cl(v.voice, 0, 2)); return api; },
    /** duck music (and ambience, a little less) by `amount` (0..1) for `seconds`, smooth attack/release */
    duck(amount = 0.5, seconds = 2) { A.duck(amount, seconds); },
    /** how much music/amb dip automatically while a voice line plays (0 disables) */
    setAutoDuck(a) { duckSt.auto = cl(a === true ? 0.5 : a === false ? 0 : a, 0, 0.95); },
    /** camera (anything with matrixWorld) used for 3D positioned SFX; null = listener at origin facing -Z */
    setListener(camera) { L.cam = camera || null; if (!camera) { L.x = L.y = L.z = 0; L.rx = 1; L.ry = L.rz = 0; L.fx = 0; L.fy = 0; L.fz = -1; } refreshListener(); },
    /** 0..1: low-pass the whole mix (muffled / underwater / shell-shocked scenes) */
    setMuffle(amount = 0, seconds = 0.5) {
      const f = Math.min(ctx.sampleRate / 2 - 100, 22000 * Math.pow(0.022, cl(amount))); muffle.frequency.cancelScheduledValues(A.now()); muffle.frequency.setTargetAtTime(f, A.now(), Math.max(0.01, seconds / 3));
    },
    /** global reverb return level (0..2, 1 = default) */
    setReverb(v = 1) { revS.ret.gain.setTargetAtTime(revS.base * v, A.now(), 0.1); revL.ret.gain.setTargetAtTime(revL.base * v, A.now(), 0.1); },
    setQuality(l) { A.q = cl(l, 0, 2); if (!offline) { A.caps.sfx = [16, 28, 46][A.q]; A.caps.music = [70, 130, 200][A.q]; } A.lookahead = A.q === 0 ? 2.0 : 1.6; },
    /** optional per-frame call (the engine already runs its own 40 Hz timer); keeps positioned sounds tight to the camera */
    update(dt) { if (offline) return; frameDt = dt; pump(A.now()); },
    now: () => A.now(),
    live: A.live,
    /** OFFLINE only: move the virtual clock forward by dt seconds and schedule everything due (music steps, ambience events, loops). */
    advance(dt) { if (!offline) return; const target = A.vtime + dt; const step = 0.1; while (A.vtime < target - 1e-9) { A.vtime = Math.min(target, A.vtime + step); pump(A.vtime); } },
    /** OFFLINE only: jump the virtual clock (no scheduling) */
    setTime(t) { if (offline) A.vtime = t; },
    music, amb, sfx, voice,
    dispose() {
      if (disposed) return; disposed = true; wantRunning = false;
      try { sfx.stopAll(); voice.stopAll(); music.stop(0.05); amb.clear(0.05); } catch (e) { /* */ }
      if (timer) clearInterval(timer); timer = null; if (worker) { try { worker.postMessage(0); worker.terminate(); } catch (e) { /* */ } } worker = null;
      if (typeof document !== 'undefined') { for (const ev of unlockEvents) document.removeEventListener(ev, unlocker, { capture: true }); document.removeEventListener('visibilitychange', onVis); }
      A.tickers.clear();
      try { if (!injected && ctx.close) ctx.close(); } catch (e) { /* */ }
    },
  };
  if (!offline) startTimer();
  A.api = api;
  return api;
}

export default createAudio;
