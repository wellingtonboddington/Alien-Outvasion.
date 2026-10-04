// Light steering helper for crowds: agents advance toward a point / flee from a point / hold, with lane spread and soft separation.
// Deterministic (seeded), allocation-free in update(). Writes straight into the crowd's instance buffers (call crowd.commit() after sim.update, or let sim do it).
import { RNG } from '../../engine/common.js';
import { STATE } from './rig.js';

const TAU = Math.PI * 2;
export const MODE = { HOLD: 0, ADVANCE: 1, FLEE: 2, WANDER: 3, STOP: 4 };

/**
 * createCrowdSim(crowd, opts) -> { agents, update(dt), add(...), setTarget, flee, hold, ... }
 *  opts: { seed, laneSpread (m, lateral wander of the advance line), separation (m), cell (spatial hash cell), autoCommit=true, ground: fn(x,z)->y, bounds:[minX,minZ,maxX,maxZ] }
 *  agent: { i (crowd index), x, z, yaw, mode, tx, tz, speed (desired m/s), vx, vz, state (anim state while moving 'auto' picks walk/run/sprint),
 *           idleState, arriveState, lane, wobble, radius, delay, cooldown }
 */
export function createCrowdSim(crowd, opts = {}) {
  const rng = new RNG((opts.seed ?? 1) * 31 + 7);
  const sep = opts.separation ?? 0.9, cell = opts.cell ?? Math.max(1.2, sep * 1.5), laneSpread = opts.laneSpread ?? 3;
  const cap = crowd.capacity;
  const agents = new Array(cap); // preallocated agent records (index = crowd index)
  for (let i = 0; i < cap; i++) agents[i] = { i, active: false, x: 0, z: 0, y: 0, yaw: 0, mode: MODE.HOLD, tx: 0, tz: 0, speed: 1.4, vx: 0, vz: 0, state: 'auto', idleState: 'idle', arriveState: 'idle', lane: 0, wobble: 0, radius: 0.35, delay: 0, arriveDist: 1.2, panic: 0, fireRange: 0, fireState: 'fire', cooldown: 0, curState: -1, curSpeed: 0, turn: 8 };
  let n = 0;
  // spatial hash (preallocated)
  const hsize = 1024; const head = new Int32Array(hsize), next = new Int32Array(cap);
  const hashC = (cx, cz) => (((cx * 73856093) ^ (cz * 19349663)) >>> 0) & (hsize - 1);
  let time = 0;
  const ground = opts.ground || null;
  const sim = {
    agents, get count() { return n; }, crowd,
    /** register crowd instances [first, first+count) as agents */
    add({ first = 0, count = crowd.count - first, mode = MODE.ADVANCE, target, speed, speedVar = 0.15, state = 'auto', idleState = 'idle', lane, delay = 0, delaySpread = 0, radius, fireRange = 0 } = {}) {
      const o = {};
      for (let k = 0; k < count; k++) {
        const a = agents[first + k]; crowd.get(first + k, o);
        a.active = true; a.x = o.x; a.z = o.z; a.y = o.y; a.yaw = o.yaw; a.mode = mode; a.state = state; a.idleState = idleState;
        if (target) { a.tx = target[0]; a.tz = target[1]; }
        a.speed = (speed ?? 1.4) * (1 + rng.range(-speedVar, speedVar)); a.lane = lane ?? rng.range(-1, 1) * laneSpread; a.wobble = rng.range(0, TAU);
        a.delay = delay + rng.next() * delaySpread; a.radius = radius ?? 0.35; a.fireRange = fireRange; a.curState = -1; a.cooldown = rng.next() * 2;
      }
      n = Math.max(n, first + count);
      return sim;
    },
    setTarget(tx, tz, first = 0, count = n) { for (let k = first; k < first + count; k++) { agents[k].tx = tx; agents[k].tz = tz; } return sim; },
    setMode(mode, first = 0, count = n) { for (let k = first; k < first + count; k++) agents[k].mode = mode; return sim; },
    /** make agents in range flee from a point (they switch to run/sprint/panic and head away) */
    flee(px, pz, { radius = 30, first = 0, count = n, speed, state = 'auto' } = {}) {
      for (let k = first; k < first + count; k++) { const a = agents[k]; const dx = a.x - px, dz = a.z - pz; if (dx * dx + dz * dz < radius * radius) { a.mode = MODE.FLEE; a.tx = px; a.tz = pz; if (speed) a.speed = speed * (0.85 + 0.3 * ((k * 0.618) % 1)); a.state = state; } }
      return sim;
    },
    hold(first = 0, count = n) { return sim.setMode(MODE.HOLD, first, count); },
    update(dt) {
      time += dt; dt = Math.min(dt, 0.1);
      // build hash
      head.fill(-1);
      for (let k = 0; k < n; k++) { const a = agents[k]; if (!a.active) continue; const h = hashC(Math.floor(a.x / cell), Math.floor(a.z / cell)); next[k] = head[h]; head[h] = k; }
      for (let k = 0; k < n; k++) {
        const a = agents[k]; if (!a.active) continue;
        if (a.delay > 0) { a.delay -= dt; continue; }
        let dx = 0, dz = 0, moving = false, want = a.speed;
        if (a.mode === MODE.ADVANCE) {
          const ex = a.tx - a.x, ez = a.tz - a.z; const d = Math.hypot(ex, ez) || 1;
          if (d > a.arriveDist) { // lane spread: offset target laterally, fade out when close
            const lat = a.lane * Math.min(1, d / 25) + Math.sin(time * 0.4 + a.wobble) * 0.5 * Math.min(1, d / 10);
            dx = ex / d + (-ez / d) * lat / Math.max(d, 8); dz = ez / d + (ex / d) * lat / Math.max(d, 8); moving = true;
          }
        } else if (a.mode === MODE.FLEE) {
          const ex = a.x - a.tx, ez = a.z - a.tz; const d = Math.hypot(ex, ez) || 1; dx = ex / d + Math.sin(time * 0.7 + a.wobble) * 0.25; dz = ez / d + Math.cos(time * 0.6 + a.wobble) * 0.25; moving = true;
        } else if (a.mode === MODE.WANDER) {
          const ang = a.wobble + time * 0.15 + Math.sin(time * 0.3 + k) * 1.2; dx = Math.sin(ang); dz = Math.cos(ang); moving = true; want = a.speed * 0.5;
        }
        // separation (neighbours in 3x3 cells)
        let sx = 0, sz = 0; const cx = Math.floor(a.x / cell), cz = Math.floor(a.z / cell);
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
          for (let j = head[hashC(cx + ox, cz + oz)]; j >= 0; j = next[j]) {
            if (j === k) continue; const b = agents[j]; const rx = a.x - b.x, rz = a.z - b.z; const d2 = rx * rx + rz * rz; const R = sep + a.radius;
            if (d2 < R * R && d2 > 1e-6) { const d = Math.sqrt(d2); const w = (R - d) / R; sx += rx / d * w; sz += rz / d * w; }
          }
        }
        if (moving) {
          const dl = Math.hypot(dx, dz) || 1; dx = dx / dl + sx * 1.3; dz = dz / dl + sz * 1.3; const dl2 = Math.hypot(dx, dz) || 1; dx /= dl2; dz /= dl2;
          const tv = want; const k2 = Math.min(1, dt * 4);
          a.vx += (dx * tv - a.vx) * k2; a.vz += (dz * tv - a.vz) * k2;
          const ty = Math.atan2(a.vx, a.vz); let dy = ty - a.yaw; dy -= TAU * Math.floor((dy + Math.PI) / TAU); a.yaw += dy * Math.min(1, dt * a.turn);
        } else { a.vx *= Math.max(0, 1 - dt * 6); a.vz *= Math.max(0, 1 - dt * 6); a.x += sx * dt * 0.8; a.z += sz * dt * 0.8; }
        a.x += a.vx * dt; a.z += a.vz * dt;
        if (opts.bounds) { const b = opts.bounds; if (a.x < b[0]) a.x = b[0]; if (a.x > b[2]) a.x = b[2]; if (a.z < b[1]) a.z = b[1]; if (a.z > b[3]) a.z = b[3]; }
        a.y = ground ? ground(a.x, a.z) : a.y;
        // animation state + speed matching (no foot sliding)
        const spd = Math.hypot(a.vx, a.vz);
        let st; let animSpeed = 1;
        if (spd < 0.12 && !moving) { st = a.mode === MODE.ADVANCE ? a.arriveState || a.idleState : a.idleState; if (a.fireRange > 0 && a.mode === MODE.HOLD) st = a.fireState; }
        else {
          st = a.state;
          if (st === 'auto') st = spd < 2.3 ? 'walk' : spd < 4.6 ? 'run' : 'sprint';
          const nom = crowd.nominalSpeed(st); animSpeed = Math.max(0.3, Math.min(2.2, spd / nom));
        }
        const sid = STATE[st];
        crowd.setTransform(k, a.x, a.y, a.z, a.yaw);
        if (sid !== a.curState || Math.abs(animSpeed - a.curSpeed) > 0.04) { crowd.setAnim(k, sid, animSpeed); a.curState = sid; a.curSpeed = animSpeed; }
      }
      if (opts.autoCommit !== false) crowd.commit();
    },
  };
  return sim;
}
