// ALIEN OUTVASION — player: start screen, controls (PC + mobile), adaptive quality, wiring of director + modules.
import * as THREE from 'three';
import { createStage } from './engine/stage.js';
import { Director } from './engine/director.js';
import { HUD } from './engine/hud.js';
import { setQuality, Q, clamp } from './engine/common.js';
import * as PostMod from './fx/post.js';
import * as PerfMod from './fx/perf.js';
import * as FxMod from './fx/particles.js';
import * as AudioMod from './audio/engine.js';
import { FILM } from './film/index.js';

const params = new URLSearchParams(location.search);
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
const canvas = document.getElementById('c');
// integrated / mobile / software GPUs start at Low when quality is Auto
function weakGPU() {
  try {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info'); const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return /swiftshader|llvmpipe|software|basic render|intel|uhd|hd graphics|iris|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics|vega \d/i.test(r);
  } catch (e) { return false; }
}
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const CSS = `
#ui{position:fixed;inset:0;font-family:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#e8f2ff;pointer-events:none}
#ui *{box-sizing:border-box}
#start{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,#0b1a2a 0%,#02050a 70%);pointer-events:auto;text-align:center;padding:4vmin;transition:opacity .8s}
#start h1{margin:0;font-weight:200;letter-spacing:.42em;font-size:clamp(26px,6.4vw,76px);padding-left:.42em;text-shadow:0 0 40px rgba(110,220,255,.35)}
#start h1 b{font-weight:800;color:#8fe9ff}
#start .tag{margin:1.2em 0 2.4em;letter-spacing:.36em;font-size:clamp(10px,1.5vw,16px);text-transform:uppercase;color:#8aa6bd}
#start button.go{pointer-events:auto;background:transparent;color:#e8f2ff;border:1px solid #8fe9ff;padding:.9em 3.2em;font-size:clamp(13px,1.8vw,18px);letter-spacing:.4em;cursor:pointer;text-transform:uppercase;transition:all .25s;border-radius:2px}
#start button.go:hover{background:#8fe9ff;color:#02101a;box-shadow:0 0 30px rgba(143,233,255,.6)}
#start .opts{margin-top:2.2em;display:flex;gap:1.4em;flex-wrap:wrap;justify-content:center;font-size:clamp(10px,1.3vw,13px);letter-spacing:.12em;color:#9bb4c8;text-transform:uppercase}
#start select{background:#0a1520;color:#cfe6f7;border:1px solid #2a4258;padding:.35em .6em;font-size:inherit;letter-spacing:.08em;border-radius:3px}
#start .note{margin-top:2.2em;max-width:60ch;font-size:clamp(9px,1.2vw,12px);line-height:1.6;color:#6d8497;letter-spacing:.08em}
#load{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#000;color:#8fe9ff;letter-spacing:.5em;font-size:13px;pointer-events:none}
#bar{position:absolute;left:0;right:0;bottom:0;padding:18px 3vw 14px;background:linear-gradient(transparent,rgba(0,0,0,.72));display:flex;align-items:center;gap:12px;opacity:0;transition:opacity .35s;pointer-events:auto}
#bar.show{opacity:1}
#bar button{background:none;border:0;color:#e8f2ff;font-size:20px;cursor:pointer;padding:6px 8px;min-width:36px;min-height:36px;border-radius:6px}
#bar button:hover{background:rgba(255,255,255,.12)}
#bar button.off{opacity:.45}
#bar .t{font-variant-numeric:tabular-nums;font-size:13px;letter-spacing:.06em;min-width:92px;text-align:center;color:#cfe6f7}
#bar input[type=range]{flex:1;accent-color:#8fe9ff;height:4px;min-width:60px}
#bar input.vol{flex:0 0 78px}
#hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:clamp(13px,2.2vw,22px);letter-spacing:.2em;text-align:center;color:#cfe6f7;background:rgba(0,0,0,.6);padding:1em 1.6em;border-radius:8px;display:none;pointer-events:none}
#dbg{position:absolute;left:6px;top:6px;font:11px ui-monospace,Menlo,monospace;color:#9f9;background:rgba(0,0,0,.55);padding:3px 6px;display:none;white-space:pre;pointer-events:none}
#end{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,.85);pointer-events:auto;gap:1.2em}
#end button{pointer-events:auto;background:transparent;color:#e8f2ff;border:1px solid #8fe9ff;padding:.8em 2.4em;letter-spacing:.3em;cursor:pointer;text-transform:uppercase}
@media (max-width:700px){#bar .vol{display:none}#bar .t{min-width:78px;font-size:12px}}
`;

function el(tag, props = {}, html = '') { const e = document.createElement(tag); Object.assign(e, props); if (html) e.innerHTML = html; return e; }

async function boot() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ui = el('div', { id: 'ui' }); document.body.appendChild(ui);
  const start = el('div', { id: 'start' }, `
    <h1>ALIEN <b>OUTVASION</b></h1>
    <div class="tag">A real-time 3D animated film</div>
    <button class="go" id="go">Begin</button>
    <div class="opts">
      <label>Quality <select id="oq"><option value="auto">Auto</option><option value="0">Low (laptops, phones)</option><option value="1">Medium</option><option value="2">High</option></select></label>
      <label>Voices <select id="ov"><option value="tts">Speech</option><option value="babble">Cinematic babble</option><option value="off">Off (subtitles)</option></select></label>
      <label>Subtitles <select id="os"><option value="1">On</option><option value="0">Off</option></select></label>
    </div>
    <div class="note">≈ 30 minutes · best with headphones, in landscape, full-screen · contains sci-fi violence, flashing lights and infection horror<br>Space: play/pause · ←/→: ±10 s · F: full-screen · C: subtitles</div>`);
  const load = el('div', { id: 'load' }, 'LOADING');
  const bar = el('div', { id: 'bar' });
  bar.innerHTML = `<button id="bp" title="Play / pause (space)">❚❚</button><span class="t" id="bt">0:00 / 30:00</span><input type="range" id="bs" min="0" max="1800" step="1" value="0"><button id="bc" title="Subtitles (C)">CC</button><button id="bm" title="Mute (M)">🔊</button><input class="vol" type="range" id="bv" min="0" max="100" value="85"><button id="bf" title="Full-screen (F)">⛶</button>`;
  const hint = el('div', { id: 'hint' }, 'Rotate your device to landscape<br>for the full cinematic frame');
  const dbg = el('div', { id: 'dbg' });
  const endScr = el('div', { id: 'end' }, '<div style="letter-spacing:.4em;font-size:14px;color:#8aa6bd">END</div><button id="rp">Watch again</button>');
  ui.append(start, load, bar, hint, dbg, endScr);
  if (isMobile) document.getElementById('oq').value = '0';

  let director = null, hud = null, audio = null, perf = null, post = null, stage = null; let started = false, userPaused = false, hideT = 0;
  let userQuality = 'auto'; let qStart = 1; let perfPR = 0; let last = performance.now();
  // render-resolution ceiling per quality level (device pixels per CSS pixel); the perf controller adapts below it
  const prCap = () => Math.min(window.devicePixelRatio || 1, [1.0, 1.5, 2][qStart], isMobile ? 1.5 : 2);
  const $ = (id) => document.getElementById(id);

  function layout() {
    const W = window.innerWidth, H = window.innerHeight; const wa = W / H; const A = clamp(wa, 1.78, 2.35);
    let w = W, h = W / A; if (h > H) { h = H; w = H * A; } w = Math.floor(w); h = Math.floor(h); const x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
    Object.assign(canvas.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', position: 'fixed', inset: 'auto' });
    const cap = prCap(); const pr = clamp(perfPR > 0 ? Math.min(perfPR, cap) : cap, 0.5, Math.max(0.5, cap));
    if (director) director.resize(w, h, pr); else if (stage) stage.resize(w, h, pr);
    if (hud) hud.layout(x, y, w, h);
    hint.style.display = (H > W * 1.05 && started) ? 'block' : 'none';
  }

  async function begin() {
    if (started) return; started = true;
    start.style.opacity = '0'; load.style.display = 'flex';
    await new Promise((r) => setTimeout(r, 60));
    userQuality = $('oq').value; const q = userQuality === 'auto' ? (isMobile || weakGPU() ? 0 : 1) : +userQuality; qStart = q; setQuality(q); Q.mobile = isMobile;
    stage = createStage({ canvas, width: 1280, height: 720, pixelRatio: 1, antialias: q > 1 && !isMobile, preserveDrawingBuffer: params.has('capture') });
    stage.renderer.shadowMap.enabled = !!Q.shadows;
    try { post = PostMod.createPost ? PostMod.createPost(stage) : null; if (post && post.setQuality) post.setQuality(q); } catch (e) { console.error('post failed', e); post = null; }
    // the controller never goes above the chosen level; Auto may step the level down, an explicit choice only adapts resolution
    try { perf = PerfMod.createPerf ? PerfMod.createPerf({ targetFps: isMobile ? 30 : q === 0 ? 45 : 60, minPixelRatio: 0.5, maxPixelRatio: prCap(), maxLevel: q, minLevel: userQuality === 'auto' ? 0 : q, startPixelRatio: q === 0 ? Math.min(prCap(), 0.85) : prCap() }) : null; if (perf) perfPR = perf.recommendedPixelRatio; } catch (e) { perf = null; }
    try { audio = AudioMod.createAudio ? AudioMod.createAudio() : null; if (audio) { audio.resume && audio.resume(); audio.voice.setMode($('ov').value); audio.setMaster(0.85); } } catch (e) { console.error('audio failed', e); audio = null; }
    hud = new HUD(document.body); hud.subsOn = $('os').value === '1';
    director = new Director({ stage, post, audio, hud, createFX: FxMod.createFX ? (scene, o) => FxMod.createFX(scene, o) : null, film: FILM, quality: q, perf });
    director.onEnd = () => { endScr.style.display = 'flex'; }; if (isMobile) director.pinCap = 600;
    layout();
    const t0 = params.has('t') ? parseFloat(params.get('t')) : 0;
    await new Promise((r) => setTimeout(r, 30));
    director.seek(t0, { play: !params.has('paused') }); load.style.display = 'none'; start.style.display = 'none'; showBar();
    last = performance.now(); requestAnimationFrame(frame);
  }
  $('go').addEventListener('click', begin);
  if (params.has('autostart')) { setTimeout(begin, 50); }

  // ---- controls ----
  function showBar() { bar.classList.add('show'); hideT = performance.now() + 3200; }
  ['pointermove', 'pointerdown', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { if (started) showBar(); }, { passive: true }));
  const setPlay = (p) => { if (!director) return; userPaused = !p; director.setPlaying(p); $('bp').textContent = p ? '❚❚' : '▶'; };
  $('bp').addEventListener('click', () => setPlay(!director.playing));
  $('bc').addEventListener('click', () => { hud.subsOn = !hud.subsOn; $('bc').classList.toggle('off', !hud.subsOn); });
  let muted = false; $('bm').addEventListener('click', () => { muted = !muted; if (audio) audio.setMaster(muted ? 0 : $('bv').value / 100); $('bm').textContent = muted ? '🔇' : '🔊'; });
  $('bv').addEventListener('input', () => { if (audio && !muted) audio.setMaster($('bv').value / 100); });
  $('bf').addEventListener('click', toggleFS);
  function toggleFS() { const d = document; if (!d.fullscreenElement && !d.webkitFullscreenElement) { const r = d.documentElement; (r.requestFullscreen || r.webkitRequestFullscreen || (() => {})).call(r); try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } } else { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } }
  const bs = $('bs'); bs.max = Math.floor(FILM.reduce((a, s) => a + s.dur, 0)); let dragging = false;
  bs.addEventListener('input', () => { dragging = true; $('bt').textContent = `${fmt(bs.value)} / ${fmt(bs.max)}`; });
  bs.addEventListener('change', () => { dragging = false; const was = director.playing; load.style.display = 'flex'; setTimeout(() => { director.seek(+bs.value, { play: was }); load.style.display = 'none'; }, 30); });
  $('rp').addEventListener('click', () => { endScr.style.display = 'none'; director.seek(0, { play: true }); $('bp').textContent = '❚❚'; });
  window.addEventListener('keydown', (e) => {
    if (!started || !director) return; if (e.code === 'Space') { e.preventDefault(); setPlay(!director.playing); }
    else if (e.code === 'ArrowRight') director.seek(director.time + 10, { play: director.playing }); else if (e.code === 'ArrowLeft') director.seek(director.time - 10, { play: director.playing });
    else if (e.key === 'f' || e.key === 'F') toggleFS(); else if (e.key === 'c' || e.key === 'C') $('bc').click(); else if (e.key === 'm' || e.key === 'M') $('bm').click(); else if (e.key === 'd' || e.key === 'D') { dbg.style.display = dbg.style.display === 'block' ? 'none' : 'block'; }
  });
  window.addEventListener('resize', layout); window.addEventListener('orientationchange', () => setTimeout(layout, 200));
  document.addEventListener('visibilitychange', () => { if (!director) return; if (document.hidden) { director._wasPlaying = director.playing; director.setPlaying(false); } else if (director._wasPlaying && !userPaused) { director.setPlaying(true); last = performance.now(); } });

  // ---- main loop ----
  let fpsAcc = 0, fpsN = 0, fps = 0, lastPR = 0;
  function frame(now) {
    requestAnimationFrame(frame); const dtms = Math.max(0, now - last); last = Math.max(last, now); if (document.hidden) return;
    if (perf && director.playing && !director.busy) {
      perf.sample(dtms);
      if (now - lastPR > 1500) {
        lastPR = now; const rec = perf.recommendedPixelRatio; if (rec && Math.abs(rec - perfPR) > 0.04) { perfPR = rec; layout(); }
        // quality level only ever steps DOWN from the start level (affects the next scenes built)
        if (userQuality === 'auto' && perf.level !== undefined && perf.level < Q.level) { setQuality(perf.level); if (post && post.setQuality) post.setQuality(perf.level); if (audio && audio.setQuality) audio.setQuality(perf.level); stage.renderer.shadowMap.enabled = !!Q.shadows; }
      }
    }
    director.update(dtms / 1000);
    fpsAcc += dtms; fpsN++; if (fpsAcc > 500) { fps = Math.round(1000 / (fpsAcc / fpsN)); fpsAcc = 0; fpsN = 0; }
    if (!dragging) { bs.value = Math.floor(director.time); $('bt').textContent = `${fmt(director.time)} / ${fmt(director.total)}`; }
    if (bar.classList.contains('show') && performance.now() > hideT && director.playing) bar.classList.remove('show');
    if (dbg.style.display === 'block') { const ri = stage.renderer.info; dbg.textContent = `${fps} fps  PR ${stage.renderer.getPixelRatio().toFixed(2)}  Q${Q.level}\nscene ${director.cur.id}  t=${director.time.toFixed(1)}\ncalls ${ri.render.calls} tris ${ri.render.triangles}\nerrors ${director.errorCount}`; }
  }

  // test / debug hooks (used by tools/smoke.mjs)
  window.__film = {
    get director() { return director; }, params, THREE,
    async startHeadless(q = 1) { $('oq').value = String(q); await begin(); director.setPlaying(false); },
    seek(t) { director.seek(t, { play: false }); },
    step(dt, n = 1) { for (let i = 0; i < n; i++) { director.time += dt; director._applyFrame(dt); } },
    info() { const d = director; const ri = d.stage.renderer.info; return { t: d.time, scene: d.cur && d.cur.id, idx: d.curIndex, calls: ri.render.calls, tris: ri.render.triangles, geos: ri.memory.geometries, texs: ri.memory.textures, errors: d.errorCount, errs: [...d.errors.keys()].slice(0, 20) }; },
    film: FILM,
  };
}
boot();
