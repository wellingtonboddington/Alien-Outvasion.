// The film: ordered list of scene definitions {id, dur, build(S)}. Total runtime = sum of durations (target ~1800 s).
import * as THREE from 'three';

const test = { id: 'test', dur: 12, build(S) {
  S.scene.background = new THREE.Color(0x0a1220);
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x66aaff, roughness: 0.4 })); m.position.y = 0.5; S.scene.add(m);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x223344 })); g.rotation.x = -Math.PI / 2; S.scene.add(g);
  S.scene.add(new THREE.DirectionalLight(0xffffff, 3).translateX(3).translateY(5)); S.scene.add(new THREE.HemisphereLight(0x99bbff, 0x223344, 0.8));
  S.during(0, 12, (t) => { m.rotation.y = t; });
  S.shot(0, 6, { from: { pos: [4, 2, 6], look: [0, 0.5, 0], fov: 40 }, to: { pos: [-3, 1.4, 5], look: [0, 0.6, 0], fov: 32 } });
  S.shot(6, 12, { orbit: { center: [0, 0.5, 0], radius: 5, height: 1.5, a0: 0, a1: 2 }, fov: 36 }, 'dip');
  S.stamp(0.5, 'MARCH 14, 2050 — 06:12 PHT', 'DUMAGUETE CITY, PHILIPPINES', 4);
  S.nameCard(2, 'MIRRAH', 'Forensic pathologist', 19, '#ff9fd0', 4);
  S.say(3, 'Mirrah', 'This is a test line of dialogue to check the subtitles.', { color: '#ff9fd0' });
  S.title(8, 'ALIEN OUTVASION', 'test card', 3, { big: true });
} };

export const FILM = [test];
