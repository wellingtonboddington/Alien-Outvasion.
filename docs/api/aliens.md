# Alien beings — `src/models/aliens/index.js` (CONTRACT §3.3)

```js
import { createVessari, createVessariCrowd, createCrawler, createCrawlerSwarm } from '../models/aliens/index.js';
```
Units m, +Y up, models face +Z, origin between the feet (crawler: centre on the ground). Everything is procedural; heavy textures/geometry are cached/shared.
Extra exports: `CROWD_STATES, SWARM_STATES, CRAWLER_CLIPS, CRAWLER_SPEED, crowdTriCount(), swarmTriCount()`.

## createVessari(kind='soldier'|'officer'|'drone'|'hierarch', seed=1, opts={hold, scale, tint:{shell,skin}}) -> VessariHero
Rigged (skinned, ~60-85 bones, IK digitigrade legs + IK arms, 3-finger hands). soldier ~2.6 m, officer 2.7 m (tall crest, tendon sash, glowing rank chevrons), drone 2.2 m (stooped worker, less armour), hierarch ~2.9 m (crown spires, two membrane frills that flare with emotion, living-membrane robes, **4 arms**).
```
hero.root                       Object3D (add to scene); hero.rig / hero.meshes for debugging
hero.update(dt, t)              advance clip time (unless an explicit `time` was given this frame), blend, solve rig
hero.play(clip, {time, speed=1, blend=0.2, loop, mirror})
                                time = explicit local clip time (seek-exact; may be passed every frame). Same clip + no time = keeps running.
hero.clipInfo(name) -> {duration, loop, moveSpeed}   moveSpeed (m/s at speed=1) for locomotion clips so root motion can be matched (walk 1.5, run 5.2, stalk 0.8, infected_run 5.3, climb 0.8)
hero.setMouth({jaw,wide,round,press,tuck,teeth,tongue})  lipsync.js params -> four mandibles + tongue (jaw drops lower pair, wide/round flare/purse all four)
hero.setTalk(energy01, style='calm'|'excited'|'angry'|'afraid'|'sad')   head nods, brow, eye-band brightness, mandible flutter, beat gestures in talk_* clips
hero.lookAt(worldVec3|null, weight=1)   neck+head track a world point (clamped)
hero.setInfection(a)            0..1: eye-band/cyan -> toxic green, glowing green veins, tremor layer (twitching jaw, head, fingers), pulsing tumours
hero.setBloody(a)               0..1 dark ichor splatter (shader layer)
hero.hold('rifle'|null)         attach/detach the bio-lance (soldier holds it by default). Clips adapt (left hand follows the foregrip)
hero.getMuzzle(outPos, outDir)  world muzzle position/direction (feed alientech Beams); hero.setFlash(0..1) muzzle-cell flash ('fire' clip also pulses it)
hero.setTransform(x,y,z,yaw), hero.getHeadWorld(out), hero.dispose()
```
Clips (all exist for all kinds, unknown -> idle): `idle, idle_alert, walk, run, stalk, aim, fire, roar, talk_a, talk_b, stagger, die(once), dead, climb, kneel, command, salute, infected_idle, infected_run, infected_lunge(once)`.
* `die` ends lying on its back and flows into `dead`; `roar/stagger/die/lunge` are once-clips (clamp at the end).
* `infected_lunge` and `die` contain their own root displacement (lunge travels ~2.6 m forward; die topples backwards) — do not also move the root.
* `climb` = ladder/hull-climb in place facing a wall at +Z (director moves root up at `moveSpeed`).
* Gaits are IK planted: move the root at `clipInfo(clip).moveSpeed * speed` to avoid foot sliding.

## createVessariCrowd(capacity, opts={shadows}) -> Crowd  (instanced infantry)
646 tris / agent, ONE draw call (+1 shadow pass), vertex-shader skeleton (19 parts) driven by a pose texture **baked from the hero rig** (identical IK gaits/clips). No allocation in update.
```
crowd.set(i,{x,y,z,yaw,state,speed,phase,scale,infect,tint})  state: idle|walk|run|aim|fire|roar|fall|dead|lunge ; speed = anim rate x ; phase = anim offset s ;
                                                               infect 0..1 (>0.5 also switches idle/walk/run to the jittery infected poses and drops the rifle); tint = [r,g,b] shell multiplier
crowd.setCount(n) / crowd.get(i,out) / crowd.commit() / crowd.update(dt,t) / crowd.dispose()
crowd.spawnGroup({n, center:[x,z], radius, yawMean, spread, state, seed, speed:[a,b], scale:[a,b], infect, phase, tint:false}) -> first index (appends)
```
`fall` plays the death topple from the moment the state was set (then holds `dead`); `lunge` plays the infected leap once. set() records the state-start time automatically.
Locomotion speeds at speed=1: walk 1.5 m/s, run 5.2 m/s (infected run ~5.5).

## createCrawler(seed, {scale, shell, skin}) -> hero
~1 m wide flat bone-tan carapace, 8 glowing cyan back spots, eyes, six IK-planted clawed legs (armoured, spiny), mouth with 4 mandibles/palps underneath, no tail.
`play('idle'|'scuttle'|'run'|'leap'|'screech'|'die'|'dead'|'climb', {time,speed,blend,loop,dist,height})`, `update(dt,t)`, `setInfection(a)`, `setBloody(a)`, `setTransform`, `clipInfo`, `dispose`.
* scuttle 2.4 m/s, run 5.5 m/s (tripod gait, `CRAWLER_SPEED`). `leap` includes its own parabola (default 2.8 m, 1 m apex; `play('leap',{dist,height})`), legs splay in flight. `screech` rears up (nose -50 deg) with mandibles wide and spots flashing. `die` flips onto its back, legs curl up (`dead` = final). `climb` is self-contained: crawler pitched nose-up, belly towards a wall at +Z.
* ~38k tris per render at q1 incl. shadows (~19k scene); hero crawler <= 15k.

## createCrawlerSwarm(capacity, opts={shadows}) -> Crowd
390 tris / crawler, ONE draw call, same baked-pose technique (23 parts). States: `idle|run|scuttle|leap|screech|dead|climb`. Extra per-instance field `leapDist` (metres, default 2.8). `dead` plays the death flip from the state start. Same set/get/commit/spawnGroup interface as above (spawnGroup default scale [0.94,1.08], pass scale:[0.9,1.15] for variety). Up to 1500 visible is fine (1200 + 400 infantry rendered in software GL at 1.1 M tris/frame incl. shadow).

## Costs (triangles per model, scene pass only; shadow pass doubles it)
| asset | q0 | q1 | q2 |
|---|---|---|---|
| soldier | 18k | 32k | 49k |
| officer | 19k | 34k | 52k |
| drone | 16k | 27k | 40k |
| hierarch | 28k | 47k | ~60k (see report) |
| crawler hero | ~7k | 19k | 28k |
Draw calls: hero 5-7 skinned meshes (+3 for the rifle); crowd/swarm 1 each. Textures: 4 sets (shell, skin, membrane, mouth: colour+normal(+roughness)) = 11 textures, shared by all aliens, `texRes(512)` (256 at q0).

## Demos (`node tools/render.mjs --demo <name> --out out/x [--q 0|1|2]`)
`aliens_lineup` (4 kinds + talking close-ups via buildVisemeTrack/sampleMouth), `aliens_anim` (params: `{set:'a'|'b'|'c'}` contact sheets or `{clip,times:[..],kind,side,gap}` strips; `kind:'crawler'` works), `aliens_crowd` (400 infantry + 800 crawlers charging, leaping, screeching), `aliens_infected` (healthy vs infected hero/crawler/crowd/swarm), `aliens_view` (single model, any camera: `--params '{"kind":"hierarch","clip":"talk_a","mouth":{...},"inf":0.5}'`), `aliens_tex` (texture preview).

## Notes / limitations
* tools/render.mjs writes its HTML without `<meta charset="utf-8">`, so any demo that imports `engine/lipsync.js` (Cyrillic table) fails to parse in the harness (`SyntaxError: Invalid or unexpected token`). Fix: add `<head><meta charset="utf-8"></head>` in render.mjs.
* Crowd gaits are FK from baked IK poses (feet match the hero only if root speed matches `moveSpeed`); crowd instances do not have fingers/mandible lip-sync.
* Infection on crowd/swarm instances uses the standard `aInfect` shader patch (veins + green emissive); clip switching to infected poses happens at infect > 0.5.
