# alientech — Vessari "living" war machines + lasers (`src/models/alientech/index.js`)

All factories are plain functions. Units = metres, +Y up, models face +Z, origin on the ground (tripod/pod swarm: ground contact / hover centre).
Everything is procedural (canvas textures, cached via `cached()`), deterministic (seeded) and seek-safe. Hero materials are per-model clones and
`infectable`; swarms use a per-instance `aInfect` attribute. `setInfection(a)` (0..1) turns cyan lights green and grows glowing veins.
Add `.root` to the scene yourself; the director calls `update(dt, t)` every frame (t = film seconds).

```js
import { createBeams, createPod, createPodSwarm, createTripod, createTripodHorde,
         createDropship, createCapitalShip, createFleet, createMothership, assetStats } from 'src/models/alientech/index.js';
```

## Beams (pooled additive lasers, ONE draw call, 768 slots by default)
`createBeams({capacity=768, color}) -> Beams { root, capacity, fire(o), sweep(o), update(dt,t), setInfection(a), setMinPixel(k), active, clear(), dispose() }`
* `fire({from:V3, to:V3, color?=0x46e6ff, width?=0.18 (core+glow half-scale, m), life?=0.35 s, delay?=0 s, travel?=0, muzzle?, impact?})` — white-hot core + coloured glow, muzzle flare at `from`, impact flare at `to`, flicker, soft fade. `travel>0` makes a travelling bolt whose length is `travel` x beam length (0 = whole beam at once). Pass `color:0x3cff1a` for infected shots. Returns the slot index.
* `sweep({from, to, toEnd, ...})` — impact point sweeps from `to` to `toEnd` over `life` (ground sweep).
* Positions are WORLD space (put `beams.root` at the scene origin). Beam time = the `t` given to `update`; `delay` is relative to the last `update`. `clear()` kills all beams (use after seeking). `setInfection(a)` greens every beam. Minimum on-screen thickness is enforced (`setMinPixel`, default ~2.2 px).

## Pods
`createPod(seed) -> Pod { root, body, height, radius, update, setThrust(0..1), aimAt(V3|null), setCharge(0..1), fire() -> [V3 x3] world prong tips, muzzles(), setInfection(a), dispose }`
Egg/lens hull ~2.6 m wide (flesh + bone ribs/carapace, 3 cyan ports, spinning laser prongs with charge glow, shimmering thruster ring, bob/tilt). `fire()` flashes the prongs and returns the 3 muzzle positions for `beams.fire`.

`createPodSwarm(capacity=800) -> { root, capacity, count, setCount(n), set(i,{x,y,z,yaw,pitch,roll,scale,infect,phase,state:'hover'|'dive'|'dead'}), get(i,out), commit(), update(dt,t), muzzle(i,out), setInfectionAll(a), dispose }`
One instanced draw call, 360 tris each. Hover bob / prong spin / port pulse done in the vertex shader (`phase` 0..1 desyncs). `pitch>0` = nose up, `roll>0` = bank right. `dive` auto-pitches nose-down + brighter ports; `dead` = ports dark, tumbling tilt. Call `commit()` after a batch of `set()`.

## Tripod (hero) and horde
`createTripod(seed, {size=30, autoMove=true}) -> Tripod { root, rig, height, update(dt,t), setGait({speed,heading}), aimAt(V3|null), setCannon(0..1), setTentacle(mode, target?), setInfection(a), footWorldPositions(), muzzleWorld(out), eyeWorld(out), onStep(cb(legIndex, worldPos)), setGround(fn(x,z)->y), autoMove, dispose }`
* 30 m (set `size` for scouts, everything scales), 3 segmented IK legs with claw feet, bone-tan shell head with scanning cyan eye-slit, heavy brow, crest, frill, bristles, ribbed flesh torso with bone plates, belly lamprey-mouth cannon, 15-joint tentacle with 3-finger pincer.
* **Gait**: world-space foot planting. `setGait({speed (m/s world), heading (world yaw rad)})`; the tripod turns to `heading` (0.45 rad/s) and (autoMove) moves its own `root` along its facing. Natural speed 2–5 m/s (stride 8.5 m x scale; foot lift 3.4 m). With `autoMove=false` move `root` yourself — feet still plant (a teleport re-plants the feet at home). `onStep` fires at every footfall (dust/audio). Planted feet never slide; the body height/sway follows the support polygon.
* `aimAt(v)` turns head + cannon toward a world point (`null` = idle scanning). `setCannon(p)` charges the mouth (glow, halos). `setTentacle('idle'|'reach'|'sweep', worldTarget?)` — idle sway, reach to a world point (pincers open as it nears), lateral sweep; transitions are smoothed. `muzzleWorld()` = cannon mouth, `eyeWorld()` = eye lens (beam origins).
* Seek-safe: constructor pre-settles 0.5 s; large `dt` is sub-stepped.

`createTripodHorde(capacity=400, {autoAdvance=true}) -> { root, capacity, count, setCount, set(i,{x,y,z,yaw,speed,phase,scale,infect,state:'walk'|'stand'|'dead'}), get, commit(), update(dt,t), walkSpeed(i), setInfectionAll(a), dispose }`
One draw call, ~400 tris each, gait IK in the vertex shader. `speed` = cadence multiplier (1 = 3 m/s x scale; `walkSpeed(i)` = world m/s matching the feet). With `autoAdvance` walking instances move along their yaw; set `x,z` yourself each frame to override. `dead` collapses over 1.6 s from the moment the state is set.

## Dropship, capital ship, fleet, mothership
* `createDropship(seed, {crawlers=true}) -> { root, size, update, setThrust(0..1), openHatch(0..1), setTilt(-1..1), setInfection(a), dispose }` ~26 m manta/wasp lander: swept bone-plated wings, glowing visor, four VTOL nacelles with flames, abdomen bay with ramp door and crawler silhouettes inside (visible once the hatch opens).
* `createCapitalShip(seed, {length=700}) -> { root, size, length, radius, update, setLights(0..1), setThrust(0..1), setInfection(a), dispose }` own units = metres; scale with `root.scale`. Ribbed ovoid, cathedral spires, flying buttresses, thousands of window lights (emissive texture), glowing veins, organs, bow maw, 7-nozzle engine array with flames.
* `createFleet(count, opts) -> { root, capacity, count, set(i,{x,y,z,yaw,scale,infect}), get, commit(), setLights(v), setInfectionAll(a) }` instanced distant ships (one draw call, ~3.3k tris each); `scale` = ship length in metres.
* `createMothership(seed, {diameter=1400}) -> { root, size, update, setLights, setThrust, setCharge(0..1) (belly maw glow), setInfection(a), dispose }` saucer-hive with a gothic crown of spires + great central spire, glowing equator band, belly maw, 24 rim thrusters, thousands of greebles; large panel/window tiling so it reads at 5–50 km.

`assetStats(root) -> { tris, meshes, drawCalls, perInstanceTris }` helper for budgets.

## Costs (software GL harness, see `node tools/render.mjs --demo alientech_stats --verbose 1`)
(filled in at the end of the run)

## Demos
`alientech_tripod` (walk / head / cannon / tentacle, scale humans), `alientech_pods` (hero + 500 pods + ~600 beams), `alientech_ships` (capital, mothership, fleet, dropship),
`alientech_infected` (0 / .5 / 1 for every asset), `alientech_horde` (360 tripods), `alientech_stats` (cost printout), `alientech_tex` (texture sheet).
Render e.g. `node tools/render.mjs --demo alientech_pods --out out/at/pods --q 1`.

## Limitations
* Hero tripod is rigid-segment IK (no cloth/soft-body); tentacle is a smoothed blended chain, not physics. Shadows from skinned parts work; horde has a custom depth material.
* Beams are straight lines (no refraction); they don't collide — the caller decides `to`.
* Ships are modelled for distance viewing (windows are 2–8 m cells); close-ups of hull panels are textured, not geometric.
