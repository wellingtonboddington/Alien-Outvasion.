// Engine-only player entry (no audio/post/fx) used to test director/HUD/camera while other modules are in development.
import * as THREE from 'three';
import { createStage } from '../engine/stage.js';
import { Director } from '../engine/director.js';
import { HUD } from '../engine/hud.js';
import { setQuality, Q } from '../engine/common.js';
import { FILM } from '../film/index.js';
const canvas = document.getElementById('c');
window.__film = {
  async startHeadless(q = 1) { setQuality(q); const W = window.innerWidth, H = window.innerHeight; Object.assign(canvas.style, { left: '0px', top: '0px', width: W + 'px', height: H + 'px' });
    const stage = createStage({ canvas, width: W, height: H, pixelRatio: 1, preserveDrawingBuffer: true }); const hud = new HUD(document.body); hud.layout(0, 0, W, H);
    this.director = new Director({ stage, hud, film: FILM, quality: q }); this.director.resize(W, H, 1); this.director.seek(0, { play: false }); },
  seek(t) { this.director.seek(t, { play: false }); }, step(dt, n = 1) { for (let i = 0; i < n; i++) { this.director.time += dt; this.director._applyFrame(dt); } },
  info() { const d = this.director; const ri = d.stage.renderer.info; return { t: d.time, scene: d.cur && d.cur.id, calls: ri.render.calls, tris: ri.render.triangles, errors: d.errorCount, errs: [...d.errors.keys()].slice(0, 10) }; },
};
