// Still-frame / contact-sheet harness. Renders a demo module in headless Chromium (SwiftShader WebGL2) and writes PNGs.
//
//   node tools/render.mjs --demo <name|path> [--spec '[{"name":"a","t":1.5,"cam":[x,y,z,tx,ty,tz],"fov":40}]'] [--out out/prefix] [--w 960 --h 540] [--q 1] [--params '{"k":1}']
//
// A demo is an ES module: src/demos/<name>.js
//   export default async function setup(stage, params) { ...add stuff to stage.scene...; return { update(t, dt){}, shots: [{name,t,cam,fov}], render?(stage) } }
// - stage = { renderer, scene, camera, width, height }  (see src/engine/stage.js)
// - The harness steps update(t, dt) at 30 fps from 0 to each shot's t (ascending), then renders and saves out/<prefix>_<name>.png
// - If setup() returns render(stage) it is used instead of renderer.render (e.g. when you use a post-processing composer).
// - cam = [x,y,z, tx,ty,tz] sets camera position + lookAt. Omit to keep whatever the demo set.
// Prints console errors/warnings from the page and renderer.info per shot so you can see draw calls / triangles.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const demoArg = get('demo'); if (!demoArg) { console.error('usage: node tools/render.mjs --demo <name> [--spec json] [--out out/x] [--w 960] [--h 540] [--q 1] [--params json]'); process.exit(1); }
const demoPath = fs.existsSync(demoArg) ? path.resolve(demoArg) : path.join(root, 'src/demos', demoArg.replace(/\.js$/, '') + '.js');
const outPrefix = path.resolve(root, get('out', 'out/' + path.basename(demoPath, '.js')));
const W = +get('w', 960), H = +get('h', 540), Qlevel = +get('q', 1);
const params = JSON.parse(get('params', '{}'));
const specArg = get('spec', null);
fs.mkdirSync(path.dirname(outPrefix), { recursive: true });

const entry = `
import { createStage } from ${JSON.stringify(path.join(root, 'src/engine/stage.js'))};
import { setQuality, GLOBAL } from ${JSON.stringify(path.join(root, 'src/engine/common.js'))};
import setup from ${JSON.stringify(demoPath)};
window.__run = async function (W, H, Qlevel, params, spec) {
  setQuality(Qlevel);
  const canvas = document.getElementById('c');
  const stage = createStage({ canvas, width: W, height: H, pixelRatio: 1, antialias: true, preserveDrawingBuffer: true });
  const demo = await setup(stage, params);
  const shots = spec || demo.shots || [{ name: 'default', t: 0 }];
  const sorted = shots.map((s, i) => ({ ...s, i })).sort((a, b) => a.t - b.t);
  let t = 0; const out = new Array(shots.length);
  for (const s of sorted) {
    while (t < s.t - 1e-6) { const dt = Math.min(1 / 30, s.t - t); t += dt; GLOBAL.time.value = t; demo.update && demo.update(t, dt); }
    if (s.cam) { stage.camera.position.set(s.cam[0], s.cam[1], s.cam[2]); stage.camera.lookAt(s.cam[3], s.cam[4], s.cam[5]); }
    if (s.fov) { stage.camera.fov = s.fov; }
    stage.camera.aspect = W / H; stage.camera.updateProjectionMatrix(); stage.camera.updateMatrixWorld(true);
    if (demo.onShot) demo.onShot(s, t);
    const t0 = performance.now();
    if (demo.render) demo.render(stage); else stage.render();
    stage.renderer.getContext().finish();
    const ms = performance.now() - t0; const info = stage.renderer.info;
    out[s.i] = { name: s.name || ('s' + s.i), png: canvas.toDataURL('image/png'), ms: Math.round(ms), calls: info.render.calls, tris: info.render.triangles, geos: info.memory.geometries, texs: info.memory.textures };
  }
  return out;
};`;

const res = await build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'harness-entry.js' }, bundle: true, format: 'iife', write: false, minify: false, target: ['es2020'], logLevel: 'error', charset: 'utf8', nodePaths: [path.join(root, 'node_modules')] });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html><body style="margin:0;background:#000"><canvas id="c" width="${W}" height="${H}"></canvas><script>${js}</script></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
let errors = 0;
page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') { if (/GPU stall|ReadPixels|swiftshader/i.test(m.text())) return; console.log(`[page ${t}]`, m.text().slice(0, 400)); if (t === 'error') errors++; } else if (get('verbose')) console.log('[page]', m.text()); });
page.on('pageerror', (e) => { errors++; console.log('[pageerror]', String(e.stack || e).slice(0, 800)); });
const htmlPath = path.join(root, 'out', `_harness_${process.pid}.html`); fs.writeFileSync(htmlPath, html);
await page.goto('file://' + htmlPath);
const t0 = Date.now();
try {
  const results = await page.evaluate(([W, H, Q, params, spec]) => window.__run(W, H, Q, params, spec), [W, H, Qlevel, params, specArg ? JSON.parse(specArg) : null]);
  for (const r of results) { const f = `${outPrefix}_${r.name}.png`; fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64')); console.log(`wrote ${path.relative(root, f)}  render ${r.ms}ms  calls ${r.calls}  tris ${r.tris}  geos ${r.geos}  texs ${r.texs}`); }
} catch (e) { console.log('[harness error]', String(e.message || e).slice(0, 1500)); errors++; }
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${errors} error(s)`);
await browser.close(); try { fs.unlinkSync(htmlPath); } catch {} process.exit(errors ? 2 : 0);
