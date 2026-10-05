// Contact sheet: node tools/sheet.mjs out/sheet.png 3 a.png b.png c.png ...   (cols, then images; uses headless Chromium)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [out, colsS, ...files] = process.argv.slice(2); const cols = +colsS || 3; const cw = 480;
const imgs = files.map((f) => `<div style="position:relative"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:${cw}px;display:block"><span style="position:absolute;left:4px;top:2px;color:#ff0;font:11px monospace;text-shadow:0 0 3px #000">${f.split('/').pop()}</span></div>`).join('');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: cw * cols, height: 100 } });
await p.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${cw}px)">${imgs}</body>`); await p.waitForTimeout(300); await p.screenshot({ path: out, fullPage: true }); await b.close(); console.log('wrote', out);
