// Smoke test of the BUILT player: seeks to several times in every scene, screenshots, reports errors / draw calls / tris / build+frame time.
//   node tools/build.mjs --dev && node tools/smoke.mjs [--q 1] [--w 640 --h 360] [--only s03,s04] [--points 0.1,0.5,0.9] [--out out/smoke] [--from 0 --to 99]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +get('w', 640), H = +get('h', 360), Q = +get('q', 1); const only = get('only', '') ? get('only', '').split(',') : null; const pts = get('points', '0.12,0.5,0.9').split(',').map(Number);
const outDir = path.resolve(root, get('out', 'out/smoke')); fs.mkdirSync(outDir, { recursive: true }); const from = +get('from', 0), to = +get('to', 9999);
const html = path.join(root, get('html', 'alien-outvasion.html'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = []; page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && !/GPU stall|ReadPixels|swiftshader|AudioContext|autoplay/i.test(m.text())) logs.push(`[${t}] ${m.text().slice(0, 400)}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + String(e.stack || e).slice(0, 800)));
await page.goto('file://' + html + '?capture=1'); await page.waitForFunction(() => window.__film, null, { timeout: 30000 });
await page.evaluate((q) => window.__film.startHeadless(q), Q);
const film = await page.evaluate(() => { const d = window.__film.director; return d.film.map((s, i) => ({ id: s.id, dur: s.dur, start: d.starts[i] })); });
console.log(`film: ${film.length} scenes, total ${film.reduce((a, s) => a + s.dur, 0)} s`);
const rows = []; let bad = 0;
for (let i = 0; i < film.length; i++) {
  const s = film[i]; if (i < from || i > to) continue; if (only && !only.some((o) => s.id.startsWith(o))) continue;
  for (const p of pts) {
    const t = s.start + Math.min(s.dur - 0.2, Math.max(0.1, s.dur * p)); logs.length = 0; const t0 = Date.now();
    let info; try { info = await page.evaluate((t) => { const t0 = performance.now(); window.__film.seek(t); const tb = performance.now() - t0; const t1 = performance.now(); window.__film.step(1 / 30, 4); const tf = performance.now() - t1; return { ...window.__film.info(), buildMs: Math.round(tb), frameMs: Math.round(tf / 4) }; }, t); } catch (e) { info = { scene: s.id, error: String(e.message).slice(0, 200), errors: 99, calls: 0, tris: 0 }; }
    const f = path.join(outDir, `${String(i).padStart(2, '0')}_${s.id}_${Math.round(p * 100)}.png`); try { await page.screenshot({ path: f }); } catch (e) { /* ignore */ }
    const err = (info.errors || 0) + logs.length; if (err) bad++;
    rows.push({ id: s.id, p, t: +t.toFixed(1), calls: info.calls, tris: info.tris, build: info.buildMs, frame: info.frameMs, err, log: logs.slice(0, 3).concat(info.errs || []) });
    console.log(`${s.id.padEnd(22)} p=${p}  t=${t.toFixed(1).padStart(7)}  calls=${String(info.calls).padStart(4)}  tris=${String(info.tris).padStart(8)}  build=${String(info.buildMs).padStart(5)}ms frame=${String(info.frameMs).padStart(5)}ms  err=${err}${err ? '  ' + JSON.stringify(rows[rows.length - 1].log).slice(0, 300) : ''}`);
  }
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(rows, null, 1));
console.log(`done. ${bad} scene-samples with errors. screenshots in ${path.relative(root, outDir)}`);
await browser.close(); process.exit(bad ? 2 : 0);
