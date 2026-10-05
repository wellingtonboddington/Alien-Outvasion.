# Crowds & zombie hordes — `src/models/crowd.js`

One draw call per kind (+1 optional blob-shadow call, +shadow-pass when `castShadow`). All animation runs in the vertex shader from a baked
pose table (half-float texture, quaternion per joint/state/cycle-frame), FK over a 17-joint rig. Per-instance data lives in instanced attributes.

```js
import { createCrowd, createCrowdSim, STATE, KIND_NAMES, crowdCount } from './models/crowd.js';
import { MODE } from './models/crowd/sim.js';
```

## createCrowd(kind, capacity, opts) -> Crowd
* `kind`: `soldier | civilian | scientist | robot | zombie_us | zombie_giant | zombie_india | zombie_russia | zombie_germany | zombie_cebu`
* `opts`: `{ seed=1, castShadow (default Q.level>=2), receiveShadow=true, blob=true (soft ground disc, 1 extra call), blobOpacity, frustumCulled=true }`
* `Crowd = { root, mesh, blobMesh, capacity, count, time, update(dt,t), dispose(), ... }` — add `crowd.root` to the scene.
* `update(dt, t)` — `t` = film time (seconds, absolute; animation is a pure function of it). If never called, the global `GLOBAL.time` is used.
* `set(i, o)` — any subset of: `x,y,z,yaw, state, speed, phase, scale, infect, tint, seed, variant, age, sex, color, colorAmount, t0`
  * `state`: `'idle'|'walk'|'run'|'sprint'|'aim'|'fire'|'crouch'|'cower'|'crawl'|'lunge'|'panic'|'cough'|'fall'|'dead'|'cheer'` (or `STATE.x` number).
    State changes cross-fade (0.1–0.3 s) from the previous pose. `fall` is a one-shot (~0.85 s) from the moment of the state change (or `t0`), ends in
    `dead`; lying direction (face-up / face-down) comes from the instance seed. Call `update(dt,t)` before `set()` so the change time is right.
  * `speed` = animation rate multiplier (1 = nominal); changing it keeps the cycle phase continuous. `phase` = animation offset in seconds.
  * `infect` 0..1 per instance (patchInfect/`aInfect`: green creeping veins + glow). `tint` 0..1 shifts the palette picks (clothes). `color` hex/[r,g,b] +
    `colorAmount` overrides the kind's "team" slot (soldier: vest/pack, others: top). `seed` fixes hair/skin/clothes/variant rolls.
  * `age`: `'adult'|'kid'|'elder'` (kids get big heads, elders stoop), `sex` 0/1 (body-shape morph), `variant`: int or `{head, weapon, pack, bag, outer, hair, extra, coat, item}` (kind specific gear groups; hidden gear is collapsed in the shader).
* `get(i, out)`, `setCount(n)`, `commit()` (uploads instance data + refreshes the culling sphere; call once after a batch of `set()`).
* `spawnGroup({ n, center:[x,z], radius, width, depth, shape:'disc'|'rect'|'ring', yawMean, spread, state, seed, speed, y, heightAt(x,z), scale, infect, tint, color, speedVar, phaseSpan }) -> firstIndex`
  appends n varied agents (random seeds -> different faces/skin/hair/clothes/gear/age/sex), seeded & deterministic.
* Fast paths (allocation-free): `setTransform(i,x,y,z,yaw)`, `setAnim(i, STATE.x, speed)`, `stateOf(i)`.
* Helpers: `lookAt(v3|null, weight)` (all heads turn toward a world point; zombie_russia does it by default), `setInfectAll(a)`,
  `nominalSpeed(state)` / `speedFor(state, metresPerSecond)` (walk/run/sprint/lunge/panic ground speed so feet do not slide), `setMaxDistance(m)`,
  `crowdCount(n)` (n × Q.crowd).
* Costs (triangles per agent, whole geometry / visible variant): soldier 885/≈600, civilian 775/≈560, scientist 691/≈580, robot 464/≈440,
  zombie_us 663/≈620, zombie_giant 719/≈680, india 567/≈500, russia 631/≈555, germany 567/≈525, cebu 543/≈500. 1 draw call each (+1 blob).

## createCrowdSim(crowd, opts) -> sim
`opts: { seed, separation=0.9, laneSpread=3, sepEvery=2, cell, autoCommit=true, ground(x,z)->y, bounds:[minX,minZ,maxX,maxZ] }`
* `sim.add({ first, count, mode, target:[x,z], speed (m/s), speedVar, state ('auto' picks walk/run/sprint by speed), idleState, lane, delay, delaySpread, radius, fireRange })`
* `MODE.ADVANCE | FLEE | HOLD | WANDER`; `sim.setTarget(x,z,first,count)`, `sim.setMode(...)`, `sim.flee(px,pz,{radius,speed,state,first,count})`, `sim.hold()`.
* `sim.update(dt)` moves agents (lane spread, soft separation via spatial hash), sets yaw, picks the anim state and matches anim speed to ground speed, then commits.
  `sim.agents[i]` are preallocated records (x,z,yaw,mode,tx,tz,speed,state ...). Held agents (`HOLD`) take `idleState`; re-assert special states with `crowd.setAnim` after `sim.update` if needed.

## Kinds (identity)
soldier (multicam, helmets/caps, plate carrier, carbine/MG/launcher/marksman variants, packs, muzzle flashes in `fire`), civilian (kids/adults/elders, hats,
bags, skirts/coats), scientist (white coat halves that follow the legs, goggles/hood+mask, clipboards), robot (EENBOT-like white/graphite, blue visor + chest ring, stiff
mechanical gait), zombie_us (hulking veined grey-green, shirtless/torn, heavy lunges), zombie_giant (2.45 m), zombie_india (thin yellow-green sprinters, hunched,
bloody open mouth, `cough` state emits a puff), zombie_russia (ushanka, coats, frosty blue skin, rigid arms, coordinated head turn), zombie_germany (pale, dark vein web, twitch pulses),
zombie_cebu (circuit veins + glowing eyes, emissive > 1 for bloom).

## Demos
`crowd_army`, `crowd_horde`, `crowd_strains`, `crowd_refugees`, plus dev sheets `crowd_debug` (`--params '{"kind":"soldier","states":[...]}'`) and `crowd_debug2`.

## Notes / limitations
Hand-less low-poly bodies (no fingers); faces are textures (eyes/brows/mouth) readable to ~3 m. `fall`/`dead` pick face-up/down from the seed. Needs WebGL2
(sampler2DArray, float-ish half textures). `--q 0`: 128 px texture layers, no real shadows, blob shadows only.
