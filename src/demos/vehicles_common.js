// Shared helpers for the vehicles_* demos (mannequins for scale checks, ground, camera presets).
import * as THREE from 'three';

const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.7 });
const cloth = [0x3b5b8a, 0x8a3b3b, 0x4a7a4a, 0x7a6a3a, 0x555566].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
function cap(len, r, mat) { const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 8); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }
function limbBetween(a, b, r, mat) { const m = cap(a.distanceTo(b) + r * 2, r, mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m; }
/** crude mannequin for scale checks. origin = floor point under hips; seated: hip at +seatH. */
export function mannequin(pose = 'stand', { height = 1.75, color = 0, seatH = 0.42, arms = 'down', hands = null } = {}) {
  const g = new THREE.Group(); const s = height / 1.75; const mat = cloth[color % cloth.length];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (pose === 'sit') {
    const hip = V(0, seatH + 0.02, 0);
    g.add(limbBetween(hip.clone().add(V(0, 0, 0)), hip.clone().add(V(0, 0.5 * s, -0.03)), 0.16 * s, mat));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 12, 10), skin); head.position.set(0, hip.y + 0.74 * s, 0); head.castShadow = true; g.add(head);
    for (const sx of [-1, 1]) {
      const knee = V(0.1 * sx, hip.y + 0.0, 0.44 * s), ankle = V(0.1 * sx, 0.06, 0.52 * s);
      g.add(limbBetween(V(0.1 * sx, hip.y, 0), knee, 0.075 * s, mat)); g.add(limbBetween(knee, ankle, 0.055 * s, mat));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.24), mat); foot.position.set(0.1 * sx, 0.03, 0.6 * s); g.add(foot);
      const sh = V(0.2 * sx * s, hip.y + 0.48 * s, 0);
      let hand = arms === 'wheel' && hands ? V(hands[0] * sx, hands[1], hands[2]) : V(0.22 * sx, hip.y + 0.0, 0.28);
      const elbow = sh.clone().lerp(hand, 0.5).add(V(0.06 * sx, -0.12, -0.05));
      g.add(limbBetween(sh, elbow, 0.045 * s, mat)); g.add(limbBetween(elbow, hand, 0.04 * s, skin));
    }
  } else {
    const hip = V(0, 0.95 * s, 0);
    g.add(limbBetween(hip, V(0, 1.45 * s, 0), 0.17 * s, mat));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 12, 10), skin); head.position.set(0, 1.66 * s, 0); head.castShadow = true; g.add(head);
    for (const sx of [-1, 1]) { g.add(limbBetween(V(0.1 * sx, 0.95 * s, 0), V(0.1 * sx, 0.5 * s, 0), 0.075 * s, mat)); g.add(limbBetween(V(0.1 * sx, 0.5 * s, 0), V(0.1 * sx, 0.06, 0), 0.055 * s, mat)); g.add(limbBetween(V(0.22 * sx * s, 1.42 * s, 0), V(0.25 * sx * s, 0.95 * s, 0.05), 0.045 * s, mat)); }
  }
  return g;
}
export function seat(vehicle, anchor, parentGroup, o = {}) {
  const m = mannequin('sit', { seatH: anchor.seatH ?? 0.42, color: o.color ?? 0, arms: o.arms, hands: o.hands, height: o.height });
  m.position.set(...anchor.pos); m.rotation.y = anchor.yaw; (parentGroup || vehicle.chassis).add(m); return m;
}
export function ground(stage, { size = 200, color = 0x4a4d50 } = {}) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 0.95 })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; g.position.y = 0.001; stage.scene.add(g);
  const lines = new THREE.Group(); const lm = new THREE.MeshBasicMaterial({ color: 0xcfcfb0 }); for (let i = -10; i < 10; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3), lm); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.003, i * 6); lines.add(l); } stage.scene.add(lines);
  return g;
}
