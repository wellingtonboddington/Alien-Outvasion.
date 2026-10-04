// Offline audio test / "listening by measurement" harness.
//
//   node tools/audio-test.mjs [--kind sfx|music|stinger|amb|voice|all] [--filter regex] [--secs N] [--sr 44100] [--png] [--wav] [--out out/audio]
//                             [--intensity 0.5] [--loop] [--verbose]
//
// Every cue / sfx / ambience bed / voice style is rendered with an OfflineAudioContext (createAudio({ctx}); the engine's virtual clock is advanced
// with audio.advance(dt) so the sequencer schedules exactly as in real time).  Checks: no NaN, peak <= 1, not silent, plausible RMS.
// Prints a table (peak/rms dBFS, spectral centroid, active length, band split sub/low/mid/high/air %).  --png writes spectrograms (look at them
// with the Read tool), --wav writes 16-bit WAVs to out/audio/.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const kind = get('kind', 'all'), filter = get('filter', null), secsArg = get('secs', null), SR = +get('sr', 44100), wantPng = !!get('png', false), wantWav = !!get('wav', false);
const outDir = path.resolve(root, get('out', 'out/audio')); const intensity = +get('intensity', 0.6); const loopTest = !!get('loop', false); const raw = !!get('raw', false); const verbose = !!get('verbose', false);
fs.mkdirSync(outDir, { recursive: true });

const entry = `
import { createAudio } from ${JSON.stringify(path.join(root, 'src/audio/engine.js'))};
import { analyze, spectrogram, wavBytes } from ${JSON.stringify(path.join(root, 'src/audio/analyze.js'))};
import { RECIPES } from ${JSON.stringify(path.join(root, 'src/audio/sfx_recipes.js'))};
import { CUES, STINGERS } from ${JSON.stringify(path.join(root, 'src/audio/music.js'))};
import { BEDS } from ${JSON.stringify(path.join(root, 'src/audio/amb.js'))};
window.__lists = () => ({ sfx: Object.keys(RECIPES), cues: Object.keys(CUES || {}), stingers: Object.keys(STINGERS || {}), amb: Object.keys(BEDS || {}) });
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
window.__job = async (job) => {
  const sr = job.sr; const secs = job.secs;
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
  const a = createAudio({ ctx, offline: true, quality: job.quality === undefined ? 1 : job.quality, bypassDynamics: !!job.raw, mix: job.mix });
  const logs = []; const ow = console.warn; console.warn = (...x) => { logs.push(x.map(String).join(' ').slice(0, 200)); };
  let info = {};
  try {
    if (job.kind === 'sfx') { const h = a.sfx.play(job.name, job.opts || {}); info.dead = !!h.dead; a.advance(secs); }
    else if (job.kind === 'music') {
      a.music.play(job.name, { fade: 0.05, intensity: job.intensity }); const step = 0.5; let t = 0;
      while (t < secs) { const dt = Math.min(step, secs - t); if (job.ramp) a.music.setIntensity(job.ramp[0] + (job.ramp[1] - job.ramp[0]) * (t / secs), 0.5); a.advance(dt); t += dt; }
    }
    else if (job.kind === 'layer') {
      a.music.play(job.name, { fade: 0.05, intensity: job.intensity }); const L = a.music._layers(); info.layers = L; if (job.layer >= 0) a.music._solo(job.layer); a.advance(secs);
    }
    else if (job.kind === 'stinger') { a.music.stinger(job.name); a.advance(secs); }
    else if (job.kind === 'amb') { a.amb.set(job.name, 1, 0.2); a.advance(secs); }
    else if (job.kind === 'voice') { a.voice.setMode('babble'); const h = a.voice.say(job.opts); a.advance(secs); }
    else if (job.kind === 'custom') { await (new Function('a', 'return (async()=>{' + job.code + '})()'))(a); }
  } catch (e) { console.warn = ow; return { error: String(e && e.stack || e).slice(0, 600) }; }
  console.warn = ow;
  const buf = await ctx.startRendering();
  const m = analyze(buf); m.live = { ...a.live }; m.logs = logs; m.info = info;
  if (job.png) m.png = spectrogram(buf, { label: job.kind + ':' + job.name });
  if (job.wav) m.wav = b64(wavBytes(buf));
  a.dispose();
  return m;
};
`;
const res = await build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'audio-test-entry.js' }, bundle: true, format: 'iife', write: false, minify: false, target: ['es2020'], logLevel: 'error', charset: 'utf8', nodePaths: [path.join(root, 'node_modules')] });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html><body><script>${js}</script></body></html>`;
const htmlPath = path.join(root, 'out', `_audiotest_${process.pid}.html`); fs.mkdirSync(path.dirname(htmlPath), { recursive: true }); fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu'] });
const page = await browser.newPage();
page.on('console', (m) => { const t = m.type(); if (t === 'error' || (t === 'warning' && verbose) || verbose) console.log(`[page ${t}]`, m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e).slice(0, 600)));
await page.goto('file://' + htmlPath);
const lists = await page.evaluate(() => window.__lists());

const SFX_SECS = { nuke: 17, tripod_horn: 12, thunder: 9, explosion_big: 7, explosion_far: 7, jet_pass: 8, crowd_panic: 9, missile_launch: 7.5, phone_ring: 4.5, engine_rev: 5, siren: 7, helicopter: 6, pod_whine: 5, riser: 5, explosion_small: 3.5, cannon: 4, heartbeat: 2 };

/* ------------------------------------------------------------------ calibration: writes src/audio/mix.js */
const calArg = get('calibrate', null);
if (calArg) {
  const mixPath = path.join(root, 'src/audio/mix.js'); let MIXV = { music: {}, sfx: {} };
  try { const m = /export const MIX = (\{[\s\S]*\});/.exec(fs.readFileSync(mixPath, 'utf8')); if (m) MIXV = JSON.parse(m[1]); } catch { }
  MIXV.music = MIXV.music || {}; MIXV.sfx = MIXV.sfx || {};
  const run = (job) => page.evaluate((j) => window.__job(j), { sr: 32000, raw: true, ...job });
  const db2k = (d) => Math.pow(10, d / 20);
  const doSfx = calArg === true || calArg === 'all' || calArg === 'sfx';
  const doMusic = calArg === true || calArg === 'all' || calArg === 'music';
  const SFX_PEAK = { nuke: -1.5, explosion_big: -2, tripod_horn: -2.5, cannon: -3, explosion_small: -4.5, explosion_far: -5, grenade: -4.5, thunder: -3.5, missile_launch: -6, afterburner: -9, jet_pass: -7, rifle: -5, pistol: -6, burst: -5, mg: -6, shotgun: -4, laser_fire: -9, laser_beam: -11, laser_hit: -11, tripod_step: -4, pod_whine: -14, crawler_screech: -9, alien_growl: -7, alien_click: -12, zombie_moan: -10, zombie_roar: -7, zombie_cough: -11, infect_zap: -10, glitch: -12, static: -17, alarm: -13, siren: -13, door: -10, door_open: -13, footstep: -15, footsteps: -15, glass: -8, crash: -5, engine_idle: -14, engine_rev: -9, helicopter: -12, tank: -12, phone_ring: -13, phone_vibrate: -13, heartbeat: -8, impact: -5, riser: -9, whoosh: -12, shutter: -13, camera: -14, news_sting: -8, tick: -18, beep: -14, keyboard: -17, comm_open: -14, comm_close: -14, scream: -9, crowd_panic: -16, splash: -10, hiss: -13, power_up: -12, power_down: -12, scanner: -15, bio_squelch: -13, breath: -22, hit_flesh: -11, drone_hum: -14, radio_chatter: -17, wood_creak: -16, metal_groan: -14, bullet_whiz: -14, ricochet: -14, reload: -13 };
  if (doSfx) {
    for (const n of lists.sfx) {
      if (filter && !new RegExp(filter, 'i').test(n)) continue;
      const r = await run({ kind: 'sfx', name: n, secs: SFX_SECS[n] || 3.5, opts: {}, mix: { music: {}, sfx: {} } }); if (r.error) { console.log('sfx', n, 'ERR', r.error.split('\n')[0]); continue; }
      const target = SFX_PEAK[n] ?? -10; const k = Math.max(0.05, Math.min(8, db2k(target - r.peakDb))); MIXV.sfx[n] = +k.toFixed(3);
      console.log(`sfx ${n.padEnd(18)} peak ${r.peakDb.toFixed(1).padStart(6)} -> ${target}  k=${k.toFixed(3)}`);
    }
  }
  if (doMusic) {
    const CUE_RMS = -23;
    const tgtFor = (L) => { const k = L.kind, i = L.inst; if (k === 'mel') return { m: 'rms', v: -25 }; if (k === 'pad') return { m: 'rms', v: i === 'choir' ? -28 : i === 'glass' ? -29 : -27 }; if (k === 'drone') return { m: 'rms', v: i === 'sub' ? -32 : -31 }; if (k === 'ost') return { m: 'rms', v: -27 }; if (k === 'arp') return { m: 'rms', v: -29 }; if (k === 'bell') return { m: 'rms', v: -36 }; if (k === 'tex') return { m: 'rms', v: -38 }; if (k === 'heart') return { m: 'rms', v: -34 }; if (k === 'perc') return { m: 'peak', v: -11 }; if (k === 'hit') return { m: 'peak', v: -9 }; if (k === 'rise') return { m: 'peak', v: -14 }; return { m: 'rms', v: -28 }; };
    for (const cue of lists.cues) {
      if (filter && !new RegExp(filter, 'i').test(cue)) continue;
      const probe = await run({ kind: 'layer', name: cue, layer: -1, secs: 0.4, intensity: 0.5, mix: { music: {}, sfx: {} } }); const layers = probe.info.layers; const gains = [];
      for (const L of layers) {
        const inten = L.window ? Math.min(1, L.window[1]) : 0.5; const r = await run({ kind: 'layer', name: cue, layer: L.i, secs: 12, intensity: inten, mix: { music: {}, sfx: {} } });
        const t = tgtFor(L); const meas = t.m === 'rms' ? r.rmsDb : r.peakDb; let k = r.rmsDb < -100 ? 1 : db2k(t.v - meas); k = Math.max(0.03, Math.min(6, k)); gains.push(+k.toFixed(3));
        console.log(`  ${cue}#${L.i} ${L.kind}/${L.inst}  ${t.m} ${meas.toFixed(1)} -> ${t.v}  k=${k.toFixed(3)}`);
      }
      const r2 = await run({ kind: 'music', name: cue, secs: 24, intensity: 0.6, mix: { music: { [cue]: { vol: 1, layers: gains } }, sfx: {} } });
      const vol = Math.max(0.05, Math.min(3, db2k(CUE_RMS - r2.rmsDb))); MIXV.music[cue] = { vol: +vol.toFixed(3), layers: gains };
      console.log(`cue ${cue.padEnd(14)} rms ${r2.rmsDb.toFixed(1)} -> ${CUE_RMS}  vol=${vol.toFixed(3)}`);
    }
  }
  fs.writeFileSync(mixPath, `// GENERATED by \`node tools/audio-test.mjs --calibrate\` — level calibration (per-layer balance + cue volume for music, gain for sfx).\nexport const MIX = ${JSON.stringify(MIXV)};\n`);
  console.log('wrote src/audio/mix.js'); await browser.close(); try { fs.unlinkSync(htmlPath); } catch { } process.exit(0);
}

const jobs = []; const layersCue = get('layers', null);
const want = (k) => !get('layers', null) && (kind === 'all' || kind === k);
if (want('sfx')) for (const n of lists.sfx) jobs.push({ kind: 'sfx', name: n, secs: SFX_SECS[n] || 3.5, opts: loopTest ? { loop: true } : {} });
if (layersCue && layersCue !== true) { // per-layer solo renders of one cue (mix balancing)
  const probe = await page.evaluate(async (j) => { const ctx = new OfflineAudioContext(2, 44100, 44100); return 0; }, 0);
  for (let i = 0; i < 40; i++) jobs.push({ kind: 'layer', name: layersCue, layer: i, secs: 14, intensity });
}
if (want('music') && !layersCue) for (const n of lists.cues) jobs.push({ kind: 'music', name: n, secs: 24, intensity });
if (want('stinger')) for (const n of lists.stingers) jobs.push({ kind: 'stinger', name: n, secs: 6 });
if (want('amb')) for (const n of lists.amb) jobs.push({ kind: 'amb', name: n, secs: 12 });
if (want('voice')) {
  const L = 'The hour is late, and they are already here. Run, now!';
  for (const [style, gender] of [['human', 'M'], ['human', 'F'], ['alien', 'M'], ['robot', 'M'], ['radio', 'M'], ['ai', 'F']]) jobs.push({ kind: 'voice', name: `${style}_${gender}`, secs: 6, opts: { text: L, style, gender, duration: 4.2, character: style === 'human' ? (gender === 'F' ? 'mirrah' : 'bead') : style, mode: 'babble' } });
}
let sel = jobs.filter((j) => !filter || new RegExp(filter, 'i').test(j.name) || new RegExp(filter, 'i').test(j.kind + ':' + j.name));
const rows = []; let fails = 0, warns = 0; const t0 = Date.now(); let nLayers = 99;
for (const j of sel) {
  if (j.kind === 'layer' && j.layer >= nLayers) continue;
  if (secsArg) j.secs = +secsArg; j.sr = SR; j.raw = raw; j.png = wantPng; j.wav = wantWav;
  const ts = Date.now(); let r;
  try { r = await page.evaluate((job) => window.__job(job), j); } catch (e) { r = { error: String(e.message || e).slice(0, 300) }; }
  if (j.kind === 'layer' && r.info && r.info.layers) { nLayers = r.info.layers.length; if (j.layer >= nLayers) continue; }
  const name = `${j.kind}:${j.name}${j.kind === 'layer' ? '#' + j.layer + ' ' + (r.info && r.info.layers && r.info.layers[j.layer] ? r.info.layers[j.layer].kind + '/' + r.info.layers[j.layer].inst : '') : ''}`; let status = 'ok'; const notes = [];
  if (r.error) { status = 'FAIL'; notes.push(r.error.split('\n')[0]); } else {
    if (r.nan > 0) { status = 'FAIL'; notes.push('NaN'); }
    if (r.peak > 1.0001) { status = 'FAIL'; notes.push('clip>1'); }
    if (r.rmsDb < -62) { status = 'FAIL'; notes.push('silent'); }
    if (j.kind === 'layer') { status = 'ok'; notes.length = 0; }
    if (j.kind === 'sfx' && r.peakDb < -22 && status === 'ok') { status = 'warn'; notes.push('quiet'); }
    if (j.kind === 'sfx' && r.peakDb > -0.5 && status === 'ok') { status = 'warn'; notes.push('hot'); }
    if ((j.kind === 'music') && (r.rmsDb < -36 || r.rmsDb > -13) && status === 'ok') { status = 'warn'; notes.push('rms'); }
    if (j.kind === 'amb' && (r.rmsDb < -44 || r.rmsDb > -14) && status === 'ok') { status = 'warn'; notes.push('rms'); }
    if (r.logs && r.logs.length) notes.push('log:' + r.logs[0]);
    if (j.png && r.png) fs.writeFileSync(path.join(outDir, `${j.kind}_${j.name}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    if (j.wav && r.wav) fs.writeFileSync(path.join(outDir, `${j.kind}_${j.name}.wav`), Buffer.from(r.wav, 'base64'));
  }
  if (status === 'FAIL') fails++; if (status === 'warn') warns++;
  rows.push({ name, status, r, notes, ms: Date.now() - ts, secs: j.secs });
  const f = (x, d = 1) => (typeof x === 'number' ? x.toFixed(d) : '-');
  const b = r.bands || {};
  console.log(`${status.padEnd(4)} ${name.padEnd(26)} ${String(j.secs).padStart(4)}s  pk ${f(r.peakDb).padStart(6)}  rms ${f(r.rmsDb).padStart(6)}  cent ${f(r.centroid, 0).padStart(5)}Hz  act ${f(r.activeSec).padStart(5)}s  [${[b.sub, b.low, b.mid, b.high, b.air].join('/')}]  ${((Date.now() - ts) / 1000).toFixed(1)}s ${notes.join(' ')}`);
}
console.log(`\n${rows.length} items, ${fails} FAIL, ${warns} warn, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await browser.close(); try { fs.unlinkSync(htmlPath); } catch { }
process.exit(fails ? 2 : 0);
