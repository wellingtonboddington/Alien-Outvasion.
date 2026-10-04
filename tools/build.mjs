// Bundles src/main.js (+ three.js) into ONE self-contained HTML file: ./alien-outvasion.html (also copied to ./index.html).
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const dev = process.argv.includes('--dev') || watch;

// Modules that other agents are still writing resolve to empty stubs (with a warning) so the player always builds.
const optionalModules = { name: 'optional', setup(b) {
  b.onResolve({ filter: /^\.\/(fx\/post|fx\/perf|fx\/particles|audio\/engine)\.js$/ }, (args) => { const p = path.join(args.resolveDir, args.path); if (fs.existsSync(p)) return null; console.warn('  (stub) missing optional module', args.path); return { path: p, namespace: 'stub' }; });
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export {}', loader: 'js' }));
} };

async function bundle() {
  const t0 = Date.now();
  const opts = { entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', write: false, minify: !dev, sourcemap: false, target: ['es2020'], legalComments: 'none', logLevel: 'warning', charset: 'utf8', treeShaking: true, plugins: [optionalModules] };
  const res = await build(opts);
  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8').replace('/*__BUNDLE__*/', () => js);
  fs.writeFileSync(path.join(root, 'alien-outvasion.html'), html);
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log(`built alien-outvasion.html  ${(html.length / 1024).toFixed(0)} KB  in ${Date.now() - t0} ms${dev ? ' (dev)' : ''}`);
}
if (watch) { const ctx = await context({ entryPoints: [path.join(root, 'src/main.js')], bundle: true, write: false, plugins: [{ name: 'rebuild', setup(b) { b.onEnd(() => bundle().catch(console.error)); } }] }); await ctx.watch(); console.log('watching…'); } else { await bundle(); }
