// Orbital scene builder: Earth + stars + sun (+moon, fleet, beams). Units: KILOMETRES (Earth radius 6371). Ships are authored in metres -> scale 0.001.
import * as THREE from 'three';
import { RNG, clamp, Q } from '../engine/common.js';
import { createEarth, createMoon, createStarfield, createSun, planetCameraRange } from '../world/space.js';
import { createCapitalShip, createFleet, createMothership, createBeams, createDropship } from '../models/alientech/index.js';
import { safe } from './kit.js';
const V3 = THREE.Vector3; export const R_E = 6371;

/** o: {sun:[x,y,z] dir toward sun, lat, lon (facing point), lightsOn, clouds, moon:{pos}, near, far} */
export function space(S, o = {}) {
  S.scene.background = new THREE.Color(0x000004); const ctx = { R: R_E };
  const stars = createStarfield({ milkyWay: true, nebula: true, count: Q.level === 0 ? 3000 : 9000 }); S.add(stars);
  const earth = createEarth({ radius: R_E, seed: 3, cityLights: o.cityLights ?? 1, clouds: o.clouds ?? 1, aurora: false }); S.add(earth); ctx.earth = earth;
  // sun direction defined relative to the face we look at: front/side mix (0.5/0.85 = lit crescent-to-gibbous), or an explicit o.sun vector
  const face = earth.latLonToWorld(o.lat ?? 12, o.lon ?? 123, 0, new V3()).normalize(); const side = new V3().crossVectors(face, new V3(0, 1, 0)).normalize();
  const sd = o.sun ? new V3(...o.sun).normalize() : face.clone().multiplyScalar(o.sunFront ?? 0.62).addScaledVector(side, o.sunSide ?? 0.78).addScaledVector(new V3(0, 1, 0), 0.12).normalize();
  const sun = createSun({ direction: sd }); S.add(sun); ctx.sun = sun; if (sun.light) S.scene.add(sun.light); earth.setSun && earth.setSun(sun);
  if (o.moon) { const m = createMoon({ radius: 1737 }); m.root.position.set(...o.moon); S.add(m); ctx.moon = m; }
  S.camNear = o.near ?? 0.05; S.camFar = o.far ?? 220000; S.scene.add(new THREE.AmbientLight(0x101830, 0.35));
  ctx.beams = createBeams({ capacity: 192 }); S.add(ctx.beams);
  /** world position over (lat,lon) at altitude km */
  ctx.at = (lat, lon, alt = 0, out = new V3()) => earth.latLonToWorld(lat, lon, alt, out);
  /** camera position at distance d (km from centre) above lat/lon, with sideways/up offsets in km */
  ctx.cam = (lat, lon, d, side = 0, up = 0) => { const p = earth.latLonToWorld(lat, lon, 0, new V3()).normalize(); const s = new V3().crossVectors(p, new V3(0, 1, 0)).normalize(); const u = new V3().crossVectors(s, p).normalize(); return p.multiplyScalar(d).addScaledVector(s, side).addScaledVector(u, up).toArray(); };
  /** a hero capital ship (metres->km), placed over lat/lon at altitude */
  ctx.ship = (seed, lat, lon, alt = 420, length = 700, yaw = 0) => { const sh = createCapitalShip(seed, { length }); sh.root.scale.setScalar(0.001); const p = ctx.at(lat, lon, alt); sh.root.position.copy(p); sh.root.lookAt(p.clone().multiplyScalar(1.2)); sh.root.rotateY(yaw); S.add(sh); return sh; };
  /** instanced distant fleet: list of [lat, lon, alt, lengthMeters] */
  ctx.fleet = (list, seed = 1) => { const f = createFleet(list.length); const r = new RNG(seed); const p = new V3(); list.forEach((s, i) => { ctx.at(s[0], s[1], s[2], p); f.set(i, { x: p.x, y: p.y, z: p.z, yaw: r.next() * 6.28, scale: (s[3] || 600) / 1000 }); }); f.commit && f.commit(); S.add(f); return f; };
  return ctx;
}
export { planetCameraRange };
