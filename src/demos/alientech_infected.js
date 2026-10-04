// Infected variants: the same assets at setInfection(0) / (0.5) / (1) — tripods, pods + swarm, dropships, capital ship, horde.
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { createTripod, createPod, createPodSwarm, createDropship, createCapitalShip, createMothership, createTripodHorde, createFleet, createBeams } from '../models/alientech/index.js';
import { RNG } from '../engine/common.js';

export default async function setup(stage, params) {
  const scene = stage.scene;
  addStudioLights(stage, { intensity: 0.9, bg: 0x0b1018, shadows: false });
  const studio = scene.children.find((c) => c.getObjectByName && c.getObjectByName('studioFloor')); const floor = studio.getObjectByName('studioFloor');
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.4); sun.position.set(60, 90, 70); scene.add(sun);
  const groups = {}; const mk = (n) => { const g = new THREE.Group(); g.visible = false; scene.add(g); groups[n] = g; return g; };
  const A = [0, 0.5, 1];
  const gT = mk('tripod'), gP = mk('pod'), gD = mk('drop'), gC = mk('cap'), gS = mk('swarm');
  const tri = A.map((a, i) => { const t = createTripod(1); t.autoMove = false; t.root.position.set((i - 1) * 46, 0, 0); t.setInfection(a); gT.add(t.root); return t; });
  tri[1].setCannon(0.6); tri[2].setCannon(1); tri[2].setTentacle('sweep');
  const pods = A.map((a, i) => { const p = createPod(2 + i); p.root.position.set((i - 1) * 4.2, 2.2, 0); p.setInfection(a); p.setThrust(0.6); gP.add(p.root); return p; });
  const drops = A.map((a, i) => { const d = createDropship(1); d.root.position.set((i - 1) * 34, 6, 0); d.root.rotation.y = 0.5; d.setInfection(a); d.setThrust(0.5); d.openHatch(i === 2 ? 1 : 0.0); gD.add(d.root); return d; });
  const caps = A.map((a, i) => { const c = createCapitalShip(1); c.root.position.set((i - 1) * 520, 0, 0); c.root.rotation.y = 0.9; c.setInfection(a); gC.add(c.root); return c; });
  const sw = createPodSwarm(300); gS.add(sw.root); const rng = new RNG(4);
  for (let i = 0; i < 90; i++) { const row = i % 3; sw.set(i, { x: (Math.floor(i / 3) - 14.5) * 4.5, y: 2 + rng.range(-0.6, 0.6), z: (row - 1) * 6 + rng.range(-1, 1), yaw: 0.2, phase: rng.next(), state: i % 17 === 0 ? 'dead' : 'hover', infect: row === 0 ? 0 : (row === 1 ? 0.5 : 1) }); }
  sw.commit();
  stage.camera.far = 20000; stage.camera.updateProjectionMatrix();
  const horde = createTripodHorde(60); gS.add(horde.root);
  return {
    update(t, dt) { tri.forEach((x) => x.update(dt, t)); pods.forEach((x) => x.update(dt, t)); drops.forEach((x) => x.update(dt, t)); caps.forEach((x) => x.update(dt, t)); sw.update(dt, t); },
    onShot(s) { for (const k in groups) groups[k].visible = (s.group === k); floor.visible = (s.group === 'tripod' || s.group === 'pod' || s.group === 'drop'); },
    shots: [
      { name: 'tripods', group: 'tripod', t: 2, cam: [0, 14, 110, 0, 14, 0], fov: 42 },
      { name: 'tripod_heads', group: 'tripod', t: 2, cam: [0, 27, 60, 0, 25, 0], fov: 55 },
      { name: 'pods', group: 'pod', t: 2, cam: [0, 3.0, 11, 0, 2.2, 0], fov: 38 },
      { name: 'swarm', group: 'swarm', t: 2, cam: [-30, 4, 24, 0, 2.5, 0], fov: 48 },
      { name: 'drops', group: 'drop', t: 6, cam: [0, 12, 70, 0, 6, 0], fov: 42 },
      { name: 'caps', group: 'cap', t: 2, cam: [0, 220, 1400, 0, 40, 0], fov: 40 },
    ],
  };
}
