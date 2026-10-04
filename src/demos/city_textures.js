// Dev sheet: all facade tiles (day colour, then emissive).  node tools/render.mjs --demo city_textures
import * as THREE from 'three';
import { FACADE, getFacade } from '../world/city/facades.js';

export default async function setup(stage, params) {
  const keys = (params.keys || Object.keys(FACADE));
  const scene = stage.scene; scene.background = new THREE.Color(0x202020);
  const cols = Math.min(4, keys.length); const rows = Math.ceil(keys.length / cols);
  const meshes = [];
  keys.forEach((k, i) => {
    const f = getFacade(k); const tw = f.spec.bays * f.spec.bw, th = f.spec.floors * f.spec.fh;
    const g = new THREE.PlaneGeometry(tw, th);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: f.map })); m.position.set((i % cols) * 14, -Math.floor(i / cols) * 9, 0); scene.add(m); meshes.push(m);
  });
  const w = cols * 14, h = rows * 9; stage.camera.fov = 30;
  const dist = Math.max(w / (2 * Math.tan(15 * Math.PI / 180) * stage.camera.aspect), h / (2 * Math.tan(15 * Math.PI / 180)));
  return {
    shots: [{ name: 'day', t: 0, cam: [w / 2 - 7, -h / 2 + 4.5, dist, w / 2 - 7, -h / 2 + 4.5, 0] }],
    onShot(s) {},
    update() {},
  };
}
