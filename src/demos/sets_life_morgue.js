import * as THREE from 'three';
import { createMorgue } from '../world/sets/life.js';
export default async function setup(stage, params) {
  const set = createMorgue({ flicker: 0 });
  stage.scene.add(set.root); stage.scene.background = new THREE.Color(0x05080a);
  const a = set.anchors; const shot = (name, key, t = 0.5, fov = 60) => { const c = a[key]; return { name, t, cam: [...c.pos, ...c.look], fov }; };
  return {
    update(t, dt) { set.update(dt, t); },
    shots: [shot('wide', 'camWide', 0.5, 62), shot('table', 'camTable', 0.5, 55), shot('drawers', 'camDrawers', 0.5, 60), shot('desk', 'camDesk', 0.5, 58), shot('drawerClose', 'camDrawerClose', 0.5, 50), shot('top', 'camOverhead', 0.5, 70)],
    onShot() { }, set,
  };
}
