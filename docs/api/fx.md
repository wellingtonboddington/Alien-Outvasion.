# FX, post-processing & performance — API (`src/fx/*`)

Entry points: `src/fx/particles.js` -> `createFX`, `src/fx/post.js` -> `createPost`, `src/fx/perf.js` -> `createPerf`.
Everything is procedural (canvas/DataTexture + shaders). All simulation is a **pure function of (spawn data, film time)**: seeded, deterministic,
seekable, zero per-frame allocation. Budgets scale with `Q.particles` (read at `createFX` for pool capacity, live for spawn counts).

## createFX(scene, opts) -> FX
`opts`: `{ seed=1, ground=0 /*world y of the ground plane (smoke is lifted off it, sparks bounce on it)*/, wind:[x,z], sunDir, sunColor, ambient, autoLight=true, attach=true }`.
`fx.root` is added to `scene` automatically (set `attach:false` to add it yourself). One pooled system per kind: ~10 draw calls total, only non-empty pools draw.

```
fx.update(dt, t)          // t = scene/film time (absolute). Seeking BACKWARDS auto-clears; spawning with a later t is fine.
fx.clear({weather=true})  // drop all transient effects (+ emitters/weather unless {weather:false})
fx.dispose()
fx.setLighting({sunDir:[x,y,z] /*toward the light*/, sunColor, ambient})  // smoke/dust/mist lighting (relative albedo lighting); disables auto sync
fx.syncLights()           // read the scene's DirectionalLight/HemisphereLight once (auto-called every 3 s when autoLight)
fx.setGround(y)  fx.setWind(x,z)  fx.setBudget(0.1..2)   // setBudget: runtime particle-count multiplier (e.g. perf.particleBudget)
fx.prewarm(renderer, camera)   // compile all FX shaders once (avoids first-use hitch)
fx.on(name, cb)           // events: 'explosion'(x,y,z,size,kind,t) 'nuke'(x,y,z,size,inSpace,t) 'reentry'(...) 'lightning'(x,y,z,t,len)  -> sync audio / camera shake
fx.state                  // per-frame values for the director: { lightIntensity, lightPos, lightColor /*biggest active flash -> drive a PointLight*/,
                          //   lightning /*0..1 multi-pulse flash for sky/ambient*/, nukeFlash /*0..1 -> post.params.flash*/, shake /*0..1 -> post.shake / camera*/ }
fx.stats()
```
Every effect takes positions as `Vector3 | [x,y,z]`; every one-shot accepts `{t, delay, seed}` (birth time defaults to the last `update` t; `delay` seconds into the future).

### One-shots
```
explosion(pos,{size=10, kind:'fireball'|'ground'|'air'|'big'|'laser'|'chain'})   // size ~ fireball diameter in m. fireball+smoke+cinders+dust ring+shock ring+sparks+embers+debris+scorch decal
nuke(pos,{size, inSpace=false})      // space: white-out flash, plasma core, fresnel shells, EMP rings, X-ray streaks, afterglow. atmosphere: flash, fireball, rolling-torus mushroom cap + stem, base surge, shock ring/shell
reentry(from,to,{life=3, size=8, color, flare=true, trailTime, explodeAtEnd, explodeSize, impact:'big'})   // incandescent comet/meteor/falling ship: ribbon trail, hot head, shed sparks + lingering smoke; optional explosion on arrival
sparks(pos,{count=24, dir, spread=0.6, color, speed=9})   dust(pos,{radius=3, amount=1, color})   debris(pos,{count=10, power=12, size=0.2})
muzzleFlash(pos,dir,{size=1,color})   tracer(from,to,{speed=380,color,length=5,impact:'ground'|'metal'|...})   // tracer = human bullets
impact(pos,normal,{kind:'ground'|'metal'|'flesh_green'|'energy', size=1})
shockwave(pos,{size=10,color,speed,normal,billboard,dust})   scorch(pos,{size=4})   // ground decal (up to 64)
coughPuff(pos,dir,{size})   infectPulse(pos,{radius=6,color})   // green infection language
lightning(from,to,{width,color,life=0.55,branches=7,flash=1})     // branching stepped-leader bolt (ribbons), cloud glow, ground flare, fx.state.lightning
```
### Handles (continuous; all return `{stop(), ...}`)
```
smokeColumn(pos,{height=40,width=6,puffLife,color,rate,life /*emitter lifetime*/}) -> {stop(), move(p)}
fire(pos,{size=2,color,smoke=true,embers=true}) -> {stop(), move(p), setSize(s)}
sporeCloud(pos,{radius=3,density=1,color}) -> {move(pos), setRadius(r), stop()}       // toxic green volumetric mist + glowing spores
smokeTrail(objectGetter,{rate,size,life,color,fire,heat}) -> {stop(), setRate(r)}     // getter: Object3D | ()=>Vector3 | Vector3 ; missiles / falling wrecks
engineGlow(posOrObject,{size,color,intensity,flicker,dir,length}) -> {move,setSize,setColor,setIntensity,setDir,stop}   // flickering halo (+ optional plume streak)
rain(centerFn | {center, area:{x,z,w,h,d}, size:[w,h,d], intensity, wind:[x,z], speed, splashes}) -> Field{setIntensity(v), setWind(x,z), stop(fadeSec)}
snow({...}) ashFall({...}) embersField({area:{center,size}, count})                    // same Field handle; no centre = follows the camera
storm({center, radius=250, height=260, rate=0.18 strikes/s, seed}) -> {stop()}       // deterministic random lightning
```
Weather fields are stateless GPU volumes that wrap around a centre (camera-following by default), so they cost nothing per frame.

### Performance notes
Pools (capacity at Q.particles=1): smoke 3200, mushroom cloud 720, fire 1500, mist 1600, glow 900, spark 2800, rings 120, shells 24, decals 64, trails 32, bolts 1100, debris 280.
`Q.particles` 0.35/0.7/1.0 at q0/q1/q2. Spawns are skipped (not clipped) when the budget is lower. Draw calls: <= ~16 with everything active. Triangles: 2 per particle.
Smoke ordering = spawn order within the pool (older first), pools have fixed renderOrder (decals < rings < shells < smoke < mist < fire < glow < sparks < bolts < weather). Soft-depth fade is not used (no depth texture); smoke quads are lifted off the ground plane and fade near the camera instead.

## createPost(stage) -> Post
Chain: scene -> HDR target (HalfFloat, falls back to sRGB 8-bit when float targets are unavailable; MSAA x4 at level 2) -> custom dual-filter bloom -> final pass on the canvas.
Tone mapping (the renderer's own `toneMapping` + `toneMappingExposure`) and the sRGB conversion are applied **once**, in the final pass. Reads `stage.scene` / `stage.camera` at render time; `post.setScene(scene)` overrides the scene.
```
post.render(dt[, t])                       // t defaults to GLOBAL.time.value (grain/glitch animate from it)
post.setSize(w, h, pixelRatio)             // also calls stage.resize
post.setQuality(0|1|2)                     // 0: no MSAA, tiny quarter-res bloom (3 mips), 1: half-res bloom 5 mips + FXAA, 2: MSAA x4 + half-res bloom 6 mips
post.setScene(scene)  post.enabled=false (plain renderer.render)  post.letterboxFor(aspect) -> params.letterbox value  post.dispose()
post.shake(amount, seconds); post.shakeState = {amount,x,y,roll}   // post only exposes the decaying value; the director applies it to the camera
post.stats.passes                          // number of render passes in the last frame (info.render.* counts include them)
post.params (set every frame, all optional):
  bloom:{strength=0.55, radius=0.65, threshold=1.0 /*linear HDR*/, knee=0.5}
  exposure=1  contrast=1  saturation=1  tint=[r,g,b]  lift=[r,g,b]=0  gamma=[r,g,b]=1  gain=[r,g,b]=1   // linear-space grade (before tone mapping): exposure*tint, lift/gamma/gain; contrast/saturation after
  vignette=0.35  grain=0.3 (animated 24 fps)  chroma=0.25 (edge-weighted)  glitch=0..1 (block displacement + RGB split + scanlines + tears), glitchTint=[g..]
  fade=0..1 (to black)  flash=0..1 (to white, flashColor=[r,g,b])  letterbox=0..0.5 (bar height per side as screen fraction)
  blur=0..1 (global half-res gaussian-ish blur)  dof=0..1 (radial defocus; dofFocus=0.28 sharp radius, dofCenter=[0.5,0.5])  fxaa=undefined (auto: on for level<2)
```
Blur chain passes only run while `blur`/`dof` > 0; bloom passes are skipped when `bloom.strength` ~ 0.

## createPerf(opts) -> Perf
`opts`: `{ targetFps=60, minPixelRatio=0.5, maxPixelRatio=min(devicePixelRatio,2), startLevel, startPixelRatio, maxLevel=2, minLevel=0 }`.
```
perf.sample(dtMs[, gpuMs]) -> true when the recommendation changed      // call every frame
perf.level (0..2)  perf.recommendedPixelRatio  perf.particleBudget (0.4/0.7/1.0)  perf.onChange = (perf, 'up'|'down', reason)=>{}
perf.stats()  perf.reset()  perf.setTarget(fps)  perf.force(level, pr)
```
A ladder of (level, pixelRatio) tiers. Down: after ~0.5 s of median-above-budget (instantly 2-3 tiers when frames are 2x+ over); a lone hitch never changes anything (median + miss fraction + spike filter).
Up: only after seconds of real headroom, or a *probe* after 14 s of perfectly on-budget frames (vsync hides headroom); a failed probe blocks that tier with exponential backoff (40 s, 80 s, ...) plus a 10 s global cooldown.
`node src/fx/perf_selftest.mjs` simulates slow/fast/borderline/30 fps GPUs.

## Demos (`node tools/render.mjs --demo <name> --out out/fx/<x> [--q 0|1|2]`)
`fx_explosions` (each kind at several times; `--params '{"kinds":["big"],"preset":"dusk"}'`), `fx_smoke_fire`, `fx_infection`, `fx_weather` (`{"mode":"rain|storm|snow|ash"}`), `fx_space` (`{"mode":"space|atmo|comets"}`), `fx_post` (every post param, numerically asserts each changes the image), `fx_stress` (everything at max budget; reports counts).
