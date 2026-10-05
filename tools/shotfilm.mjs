// Screenshot the REAL player (DOM HUD + canvas) at given film times, using the built bundle or a custom entry.
//   node tools/shotfilm.mjs --times 3,8 [--entry src/main.js] [--q 1] [--w 1280 --h 720] [--out out/film] [--scene id --local 4]
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const entry = path.resolve(root, get('entry', 'src/main.js')); const W = +get('w', 1280), H = +get('h', 720), Q = +get('q', 1);
const times = get('times', '0').split(',').map(Number); const out = path.resolve(root, get('out', 'out/film'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const optional = { name: 'optional', setup(b) {
  b.onResolve({ filter: /^\.\/(fx\/post|fx\/perf|fx\/particles|audio\/engine|act4)\.js$/ }, (a) => { const p = path.join(a.resolveDir, a.path); if (fs.existsSync(p)) return null; return { path: p, namespace: 'stub' }; });
  b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: /act4/.test(a.path) ? 'export const ACT4 = [];' : 'export {}', loader: 'js' })); } };
const res = await build({ entryPoints: [entry], bundle: true, format: 'iife', write: false, minify: false, target: ['es2020'], logLevel: 'error', charset: 'utf8', plugins: [optional] });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8').replace('/*__BUNDLE__*/', () => js);
const htmlPath = path.join(root, 'out', `_film_${process.pid}.html`); fs.writeFileSync(htmlPath, tpl);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
let errs = 0; page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') { if (/GPU stall|ReadPixels|swiftshader|AudioContext/i.test(m.text())) return; console.log(`[page ${t}]`, m.text().slice(0, 500)); if (t === 'error') errs++; } });
page.on('pageerror', (e) => { errs++; console.log('[pageerror]', String(e.stack || e).slice(0, 900)); });
await page.goto('file://' + htmlPath + '?capture=1'); await page.waitForFunction(() => window.__film, null, { timeout: 20000 });
await page.evaluate((q) => window.__film.startHeadless(q), Q);
const evalSrc = get('eval', null);
for (const t of times) {
  const t0 = Date.now(); await page.evaluate((t) => { window.__film.seek(t); window.__film.step(1 / 30, 3); }, t); await page.waitForTimeout(60);
  const f = `${out}_${String(t).replace('.', '_')}.png`; await page.screenshot({ path: f }); const info = await page.evaluate(() => window.__film.info());
  if (evalSrc) { const r = await page.evaluate(new Function('return (' + evalSrc + ')')()); console.log('EVAL', JSON.stringify(r).slice(0, 1500)); }
  console.log(`t=${t}  ${f.replace(root + '/', '')}  scene=${info.scene} calls=${info.calls} tris=${info.tris} errors=${info.errors} ${Date.now() - t0}ms${info.errs.length ? ' ' + JSON.stringify(info.errs) : ''}`);
}
await browser.close(); try { fs.unlinkSync(htmlPath); } catch {} process.exit(errs ? 2 : 0);
