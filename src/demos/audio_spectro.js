// Audio "visual QA" demo: renders sounds offline (OfflineAudioContext), draws their spectrograms and shows them as panels in the scene.
//   node tools/render.mjs --demo audio_spectro --out out/audio_spectro --w 1600 --h 900
//   --params '{"items":["sfx:tripod_horn","music:title:16","amb:rain","voice:alien"]}'   (item = kind:name[:seconds];  voice name = style)
import * as THREE from 'three';
import { renderItem } from '../audio/offline.js';
import { analyze, spectrogram } from '../audio/analyze.js';

const DEFAULTS = ['sfx:tripod_horn:12', 'sfx:explosion_big:7', 'sfx:laser_fire:2', 'sfx:jet_pass:8', 'music:title:20', 'music:battle:12', 'amb:rain:8', 'voice:alien:5'];

export default async function setup(stage, params = {}) {
  const items = params.items || DEFAULTS; const cols = params.cols || 2; const rows = Math.ceil(items.length / cols);
  stage.scene.background = new THREE.Color(0x05060a); const group = new THREE.Group(); stage.scene.add(group);
  const W = 3.2, H = 1.15;
  for (let i = 0; i < items.length; i++) {
    const [kind, name, secs] = items[i].split(':'); let buf;
    try {
      if (kind === 'voice') buf = await renderItem({ kind, name: 'The hour is late, and they are already here. Run, now!', secs: +secs || 6, opts: { style: name, gender: name === 'ai' ? 'F' : 'M', duration: 4.2, character: name } });
      else buf = await renderItem({ kind, name, secs: +secs || 8 });
    } catch (e) { console.warn('render failed', items[i], e); continue; }
    const m = analyze(buf); const url = spectrogram(buf, { w: 800, h: 290, label: `${kind}:${name}  pk ${m.peakDb.toFixed(1)}  rms ${m.rmsDb.toFixed(1)}  cent ${m.centroid.toFixed(0)}Hz` });
    const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = url; });
    const tex = new THREE.CanvasTexture(img); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const c = i % cols, r = Math.floor(i / cols); mesh.position.set((c - (cols - 1) / 2) * (W + 0.1), ((rows - 1) / 2 - r) * (H + 0.1), 0); group.add(mesh);
  }
  const span = Math.max(cols * (W + 0.1), rows * (H + 0.1) * 16 / 9);
  stage.camera.position.set(0, 0, span * 0.95 / 1.15 * 0.78 + 1); stage.camera.lookAt(0, 0, 0);
  return { update() {}, shots: [{ name: 'sheet', t: 0 }] };
}
