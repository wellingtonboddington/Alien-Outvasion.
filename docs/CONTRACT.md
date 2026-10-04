# ALIEN OUTVASION — engineering contract (read fully before writing code)

A 30‑minute real‑time 3D animated film rendered with **three.js (r186)** in the browser, shipped as ONE self‑contained HTML file
(`node tools/build.mjs` → `alien-outvasion.html`). **Everything is procedural**: no image/model/audio files, no network, no `fetch`.
Models are built from code (geometry helpers + canvas‑generated textures). Quality of *modelling, textures and animation* is the top priority
(then fluidity); lighting/post is secondary. Characters must read as real, well‑proportioned beings with working faces — never "bunched‑up noodles".

## 0. How we work (parallel agents)
* You own ONLY the files listed in your assignment. **Never edit files you don't own** (especially `src/engine/*`, other agents' modules, `docs/CONTRACT.md`). If you need a change in a shared file, work around it in your own module and mention it in your final report.
* You may import from: `three`, `three/examples/jsm/*`, and the shared libs in `src/engine/`: `common.js` (math/RNG/quality/GLOBAL time/disposeTree), `proc.js` (noise + canvas texture painting + normal‑map from height + text textures + `cached`), `geo.js` (limb/loft/tube/lathe/roundedBox/displace/boxUV/merge/colorize…), `infect.js` (infection shader patch), `lipsync.js` (text→visemes→mouth params), `stage.js` (renderer/scene/camera + `addStudioLights` for demos). Read those files first — they are small. Do **not** import from other agents' modules unless this contract says so.
* **Verify visually.** Write demo(s) in `src/demos/<yourprefix>_*.js` and render with `node tools/render.mjs --demo <name> --out out/<prefix>` (see header of `tools/render.mjs`). Then **look at the PNGs** (Read tool) and iterate until they look genuinely good. Check from several cameras (full body, close‑up, side, back) and several times `t` (animation poses). The harness prints draw‑calls/triangles. Software GL is slow but fine at 960×540.
* Keep going until it looks good — the first thing you make will not be good enough. Spend your effort on silhouette, proportion, surface detail (normal maps, trim, panel lines, wear), colour variation, and animation quality.
* Final report (your last message) must contain: the exported API (names + signatures + semantics, concise), any known limitations, triangle/draw‑call cost of each hero/instanced asset, and the demo names. Also write the same API summary to `docs/api/<yourprefix>.md`.

## 1. Conventions (MUST follow)
* **Units = metres. +Y up. Models face +Z** (front of a character/vehicle points to +Z; `rotation.y = yaw` where `yaw = Math.atan2(dx, dz)` faces direction (dx,dz)). Origin at ground contact (centre between feet / vehicle centre on the ground plane; wheels touch y=0).
* **Determinism / seekability**: never use `Math.random()` — use `RNG` from `common.js` with fixed seeds. Animation must be a function of the time passed in (plus small internal springs). The film can seek to any time: an asset created and then updated from t=0 for ~0.5 s must look right.
* **Hero object contract** (single detailed models): factory returns an object with at least
  `{ root: THREE.Object3D, update(dt, t), dispose() }` (+ model‑specific methods). `root` is added to the scene by the caller; you never touch the scene yourself.
* **Instanced/swarm contract** (many copies): factory(capacity, opts) returns `{ root, count, capacity, update(dt, t), dispose(), ... }`; per‑instance data set through documented setters; all animation done in a vertex shader / per‑instance matrices so thousands cost almost nothing. Swarm assets must look good at 5–60 m distance and must not allocate during `update`.
* **Materials**: `MeshStandardMaterial`/`MeshPhysicalMaterial` (+`onBeforeCompile` only when really needed). Lighting comes from the scene (sun/hemisphere/environment map): assume ACES tone‑mapping, sun `DirectionalLight` ≈ 3, hemisphere ≈ 0.5, `scene.environmentIntensity` ≈ 0.5. Emissive things (lights, screens, lasers, eyes, ports) should use emissive colours with intensity > 1 so bloom picks them up. Don't create lights inside models except where the contract says (use emissive + sprite glow instead; real lights are expensive).
* **Infection language**: anything that can be infected (alien beings/machines, human machines/vehicles/robots, screens…) uses `infectable(mat)` (per‑model materials, cloned) and exposes `setInfection(amount 0..1)` (hero) or a per‑instance `infect` value (swarm, via `aInfect` attribute). Infected = toxic green (#3cff1a family) emissive + veins. See `src/engine/infect.js`.
* **Quality scaling**: read `Q` from `common.js` (`Q.crowd`, `Q.particles`, `Q.texSize`, `Q.detail`, `Q.shadows`). Use `seg()` for radial segment counts, `texRes()` for texture sizes. Shared textures/materials should go through `cached(key, make)`. Provide `dispose()` that frees everything not shared (`disposeTree`).
* **Budgets** (desktop mid GPU target 60 fps, phones 30 fps; the director may show 3 hero models + a swarm + environment at once): hero human ≤ 40k tris & ≤ 20 draw calls; hero alien/vehicle ≤ 60k tris; each swarm agent ≤ 700 tris (humanoid) / ≤ 400 (crawler/pod) and **one draw call per swarm**; textures ≤ 1024² (use `texRes`), total new textures per module < ~40. Avoid per‑frame allocations (reuse vectors/matrices).
* **No DOM beyond canvases** inside models (canvas textures only). Code must run in headless Chromium *and* mobile Safari (WebGL2, no extensions assumed except those three.js falls back from).
* Code style: ES modules, no TypeScript, 2‑space indent, short comments for non‑obvious maths. Exported names exactly as documented below (extra exports welcome).

## 2. Art direction
* Look: high‑end stylised‑realistic CG film (think a lavish fan film in the spirit of *The 7 Hour War*, *War of the Worlds* tripods, *Half‑Life 2* strider‑ish machines — **inspired, not copied**: original shapes). Gritty near‑future Earth (2050): modern civilian + military gear, clean sleek tech for the rich, worn everyday Philippines streets, etc.
* **Aliens = the Vessari.** Biologically led invaders: the front line is living aliens; machines are *grown* ("living ships"): ribbed, fibrous, with tendon‑like cables, bone‑tan **shell plates** (#b89a62 family, glossy chitin with fine cracks), **dark slate‑blue armour/flesh** (#1d2a36 → #3a5368, wet, oily iridescent sheen), **bioluminescent cyan lights** (#46e6ff, emissive) in ports/slits/eye‑bands, sparse bristle‑like hairs/spines, tendrils. Lasers: white‑hot core with cyan glow. Everything alien is asymmetric‑elegant, not generic sci‑fi hard‑surface.
  * *Vessari infantry*: ~2.6 m tall, digitigrade legs, narrow torso with rib‑like armour, elongated shell helm with a glowing cyan eye‑band, lower face = split mandibles that can open/close and move when speaking (lip‑sync with `lipsync.js` params), long three‑fingered hands, a respirator organ on the back.
  * *Crawlers* ("creepy crawlers"): crab/spider‑like scuttlers ~1 m wide, six clawed legs, flat shell with cyan spots, mouth under the body, leap + screech.
  * *Pods*: floating egg/lens shells ~2.5 m wide, three glowing ports, laser prongs underneath, shimmering thrusters, gentle hover bob.
  * *Tripods*: 25–40 m tall, three long segmented legs with claw feet, bone‑tan shell hull with a cyan eye‑slit and a belly cannon, one snaking tentacle arm, bristles; walk with a believable alternating gait.
  * *Dropships* (manta/wasp shaped) and *capital ships* (kilometre‑long ribbed ovoids/cathedral spires covered in lights).
* **Infected** things turn green (see §1). Human zombies differ per strain (see assignment of the human/crowd agents).
* **Humans**: believable proportions, varied faces/bodies/skin tones, rich fabrics (normal maps + weave), hair with volume, working faces: eyes with iris/pupil/specular + eyelids that blink, eyebrows, nose, ears, **lips + jaw + teeth + tongue that animate with `lipsync.js` params**, expressions (smile, frown, surprise, fear, anger, sorrow).

## 3. Module list & minimum APIs
(Each agent implements their section; extra functionality is welcome. All factories are plain functions exported from the named file; heavy shared resources lazily created & `cached`.)

### 3.1 Humans — `src/models/human/*` (entry `src/models/human/index.js`)
```
createHuman(profile) -> Human        // hero quality, fully rigged (rigid hierarchical rig with joint spheres OR skinned — your call), face with lip‑sync
MAIN_CAST: { mirrah, bead, jez, stephen, ezra, sam, jhaz, leon, epiphany }  // profile objects (see §4)
createNPC(kind, seed=1, opts={}) -> Human  // kinds: civilian, elder, child, soldier, officer, general, pilot, scientist, doctor, nurse, anchor, reporter, politician, technician, police, worker, guard, monk
Human = {
  root, update(dt,t), dispose(),
  profile,                             // the resolved profile
  setTransform(x,y,z,yaw),             // convenience for root.position/rotation.y
  play(clip, {time, speed=1, blend=0.2, loop=true, mirror=false, params={}}),  // clip is a string name (list below); `time` = local clip time in seconds (director passes explicit time so seeking is exact); blends from previous pose over `blend` seconds
  setMouth(p),                         // p = lipsync mouth params {jaw,wide,round,press,tuck,teeth,tongue} 0..1 (missing keys = 0)
  setTalk(energy01, style='calm'),     // drives beat gestures/head nods/breathing while talking; style: calm|excited|angry|afraid|sad
  setExpression({smile,frown,surprise,fear,anger,sad,blink}) // 0..1 each; blink handled automatically unless blink given
  lookAt(worldVec3|null, weight=1),    // eyes + head + neck turn toward a world point
  hold(propName|null, hand='R'),       // attach a prop: phone, rifle, pistol, shotgun, tray, clipboard, glass, bottle, tablet, mic, radio, binoculars, flashlight, scalpel, pen, headset, burgerbag, toolbox, cup, mop, megaphone, briefcase, folder
  setInfected(strain|null, amount=1),  // strain: 'us'|'india'|'russia'|'germany'|'cebu' -> zombie look (pallor, veins, eyes, wounds, blood, tint per strain); 'us' can also be 'us_giant' (≈2.45 m, bulky)
  setBloody(amount01), setDirt(amount01),
  setInfection(a)                      // alias for setInfected('cebu', a) used for machine-strain look on e.g. the EEN implant; optional
}
```
Clip names that MUST exist (procedural pose/IK animation, loops unless noted; feet planted via leg IK where walking/running): `idle`, `idle_arms_crossed`, `idle_hands_hips`, `idle_phone`, `talk_a`, `talk_b`, `talk_c` (three different gesture sets), `listen`, `walk`, `walk_tired`, `jog`, `run`, `sprint`, `crouch_walk`, `sneak`, `sit`, `sit_talk`, `sit_type`, `drive` (seated, hands on wheel, looks forward), `phone_call`, `point`, `wave`, `shrug`, `nod`, `shake_head`, `shock`, `scared_idle`, `cower`, `panic_run`, `hands_up`, `kneel`, `salute`, `cheer`, `laugh`, `sad`, `hug`, `aim_rifle`, `aim_walk`, `shoot` (recoil), `reload`, `aim_pistol`, `aim_shotgun`, `carry`, `push`, `lift`, `stagger`, `fall` (once), `dead` (lying), `get_up`(once), `crawl`, `climb`, `work_counter` (serving customers), `pour_drink`, `clean_glass`, `autopsy` (leaning over a table with instrument), `examine` (peers at a specimen/screen), `typing` (standing), `clipboard`, `mop`, `zombie_idle`, `zombie_shamble`, `zombie_run`, `zombie_sprint`, `zombie_lunge`, `zombie_crawl`, `zombie_eat`, `zombie_cough`. Unknown clip → fallback `idle` (never throw).

### 3.2 Crowds — `src/models/crowd.js`
```
createCrowd(kind, capacity, opts) -> Crowd
 kind: 'soldier'|'civilian'|'scientist'|'zombie_us'|'zombie_giant'|'zombie_india'|'zombie_russia'|'zombie_germany'|'zombie_cebu'|'robot' (EENBOT‑like)
 Crowd = { root, capacity, count, update(dt,t), dispose(),
   set(i, {x,y,z,yaw,state,speed,phase,scale,infect,tint}) ,  // per instance; state: 'idle'|'walk'|'run'|'sprint'|'aim'|'fire'|'crouch'|'cower'|'crawl'|'lunge'|'panic'|'cough'|'fall'|'dead'|'cheer'; speed = anim rate multiplier; phase = anim offset seconds
   setCount(n), get(i, outObj) , commit()  // commit() uploads instance data (call once after a batch of set() calls)
   spawnGroup({n, center:[x,z], radius, yawMean, spread, state, seed}) -> first index  // convenience helper that fills n instances with varied looks
 }
createCrowdSim(crowd, opts) -> { agents, update(dt) }  // light steering helper: agents with target/speed/state, optional "advance toward point" and "flee from point" + lane spread; deterministic (seeded)
```
Visual identity: soldier = multicam/olive kit, helmets, vests, rifles; civilians = varied colours/skin/hair; zombies per strain (US: huge muscular/veiny grey‑green, giants ×1.35; India: runners, sickly yellow‑green, constant cough puffs animation state; Russia: ushanka/winter clothes, frosty, upright coordinated stance; Germany: pale with dark veins, twitchy; Cebu: neon‑green circuit‑vein glow). Distinguish silhouettes. Vertex‑shader animated limbs (walk/run cycle, arms, lunge, crawl, cower, dead).

### 3.3 Alien beings — `src/models/aliens/*` (entry `src/models/aliens/index.js`)
```
createVessari(kind='soldier'|'officer'|'hierarch'|'drone', seed) -> VessariHero  // hero quality, rigged, mouth/mandibles lip‑sync
  { root, update(dt,t), dispose(), play(clip,{time,speed,blend,loop}), setMouth(p), setTalk(e,style), lookAt(v3|null), setInfection(a), setBloody(a),
    hold('rifle'|null) }   // clips: idle, idle_alert, walk, run, aim, fire, roar, talk_a, talk_b, stagger, die(once), dead, climb, kneel, command (hierarch gesture), salute, infected_idle, infected_run, infected_lunge
createVessariCrowd(capacity, opts) -> Crowd (same instanced interface as §3.2 incl. set/commit/spawnGroup/states idle|walk|run|aim|fire|roar|fall|dead|lunge, infect per instance)
createCrawler(seed) -> hero {root, update, play('idle'|'scuttle'|'leap'|'screech'|'die'), setInfection}
createCrawlerSwarm(capacity, opts) -> Crowd interface (states: idle|run|leap|screech|dead|climb) — one draw call, vertex‑shader leg animation, hundreds visible
```
### 3.4 Alien machines — `src/models/alientech/*` (entry `index.js`)
```
createBeams(opts) -> Beams { root, fire({from:V3,to:V3,color?,width?,life?,delay?}), update(dt,t), clear(), dispose() }  // pooled additive laser beams: white core + cyan glow (green when infected), muzzle flare + impact flare, flicker; supports ~600 simultaneous beams in one/two draw calls
createPod(seed) -> hero { root, update, setInfection, setThrust, aimAt(v3), fire?() }   // hover + tilt animation, prong rotation
createPodSwarm(capacity, opts) -> Crowd-like { root, capacity, count, set(i,{x,y,z,yaw,pitch,roll,scale,infect,phase,state:'hover'|'dive'|'dead'}), commit(), update(dt,t), dispose() }
createTripod(seed, opts) -> hero { root, update(dt,t), dispose(), setGait({speed, heading}) /*foot placement with IK so feet plant*/, aimAt(v3), setCannon(power01), setTentacle(mode,'idle'|'reach'|'sweep'), setInfection(a), footWorldPositions() , height }
createTripodHorde(capacity, opts) -> Crowd-like instanced low‑poly tripods with shader gait (set(i,{x,z,yaw,speed,phase,scale,infect,state:'walk'|'stand'|'dead'}))
createDropship(seed) -> hero {root, update, setThrust, setInfection, openHatch(0..1)}
createCapitalShip(seed, opts) -> hero {root, update, setInfection, setLights(0..1), size} // dimensions in its own units; scale it with root.scale
createFleet(count, opts) -> instanced distant ships {root, set(i,{x,y,z,yaw,scale,infect}), commit()}
createMothership(seed) -> hero (the huge flagship; ~1 km scale in its own units)
```
### 3.5 Human machines & robots — `src/models/vehicles.js`
```
createJeepney(opts{seed,palette,name}) -> Vehicle  // iconic Philippine jeepney: long hood with chrome horse ornaments, colourful airbrushed flanks, rear bench seating, roof rack, sign boards, wheels that spin; hero quality
createCar(kind:'sedan'|'hatch'|'suv'|'taxi'|'police'|'ambulance'|'van'|'pickup', opts) , createBus(opts), createTruck(kind:'box'|'fuel'|'flatbed'), createMotorbike, createTricycle (Philippine sidecar tricycle)
createTank(opts), createAPC(opts), createHumvee(opts), createLauncher(kind:'himars'|'patriot'|'tel'), createHowitzer(opts), createAntiAir(opts)
createJet(kind:'f15'|'f35'|'bomber', opts)  // afterburner glow, control surfaces move with setBank/setPitch, missiles on pylons
createHelicopter(kind:'attack'|'transport'), createMissile(kind:'cruise'|'icbm'|'sam'|'rocket'), createWarship(kind:'destroyer'|'carrier'|'ferry'), createSatellite(kind), createSpaceStation()
createEenbot(opts) -> Robot  // EEN's EENBOT‑2: sleek white/graphite humanoid, glowing blue visor + chest ring; clips via same play(clip,{time}) naming as humans for: idle, walk, run, carry, aim, work, wave, stagger, dead; setInfection → rabid green with twitchy animation
Vehicle = { root, update(dt,t), dispose(), setSpeed(mps)  /*wheels roll, suspension bob*/, steer(rad), setLights(on), setInfection(a), setDamage(0..1), crew?: anchors }
Jet = { ..., setThrottle(0..1), setBank(rad), setPitch(rad) }, Missile = { ..., setBurn(0..1) }
All vehicles expose `anchors: { driverSeat:{pos,yaw}, passengerSeats:[...], exitDoor, muzzle... }` (local space) so humans can be seated (`drive` clip) inside.
```
### 3.6 Exterior worlds — sky/space/terrain/ocean/vegetation: `src/world/sky.js`, `space.js`, `terrain.js`, `ocean.js`, `vegetation.js`
```
createSky(preset) -> Sky { root, update(dt,t), dispose(), preset, lights:{sun, hemi}, applyTo(scene) /*sets background/fog/environment+intensity*/, setSunAngle(elevDeg, azDeg), setShadowFocus(v3, radius) /*sun shadow camera follows*/, setStorm(0..1), setSmoke(0..1) }
  presets: 'day','dawn','goldenHour','dusk','night','overcast','storm','smoke'(post‑attack orange/brown), 'dayHaze','coldMorning'; volumetric‑looking clouds (shader or layered sprites), sun disc + glow, stars at night, moon.
createEarth(opts{radius,seed}) -> {root, update, setCityLights(0..1), setClouds, sunDir}  // gorgeous planet seen from orbit: continents (procedural), oceans specular, cloud layer, atmosphere rim glow, night‑side city lights
createMoon(), createStarfield(), createSun(), createNebula? (optional), createAurora? (optional)
createOcean(opts{size,color,choppiness}) -> {root, update(dt,t)}   // animated water with sun glints, foam, usable from beach or aerial; cheap on mobile
createTerrain(opts{size,seed,style:'tropical'|'temperate'|'desert'|'snow'|'rocky'|'farmland', flatRadius}) -> {root, heightAt(x,z)}
createVegetation(kind:'palm'|'coconut'|'tree'|'pine'|'bush'|'grass'|'banana'|'acacia', opts) / scatterVegetation(terrain|fn, kind, count, area, seed) -> InstancedMesh group   // wind sway in shader
```
### 3.7 Cities & landmarks — `src/world/city.js`
```
createCityBlock(style, opts{seed,w,d,density,damage}) -> {root, update, dispose, bounds, streetAnchors}   // styles: 'manhattan','dumaguete' (tropical low/mid‑rise, jeepneys' world, signage, sari‑sari stores, cables), 'cebu','berlin','moscow','delhi','generic','suburb','industrial'
createStreet(len, opts) ; createSkyline(style, opts) -> far silhouette ring/row of buildings (cheap) ; createBuilding(kind, opts)
createLandmark(name) -> Group  // 'dumaguete_blvd' (seafront boulevard with benches, palm trees, sea wall, Apo Island silhouette hint), 'dumaguete_belltower', 'berlin_tv_tower', 'berlin_gate', 'moscow_kremlin' (red wall, towers, onion domes), 'newyork_towers', 'delhi_gate', 'cebu_skyline', 'pentagon' (aerial), 'whitehouse_like'(generic), 'un_building', 'georgia_mountains'
damageCity(root, level01, seed) / createRuins(opts) / createRubble(opts) / createBurningBuilding(opts) / createCrater(opts) / createWreck(kind)  // destruction props & damaged variants (collapsed floors, scorched, broken windows)
Street furniture: lamp posts, traffic lights, signs, benches, parked cars (cheap instanced), barricades, sandbag walls, tents, checkpoints
```
### 3.8 Interiors & sets — `src/world/sets/*.js` (everyday life: `sets/life.js`; institutional/sci‑fi: `sets/institutional.js`)
Every set factory returns `{ root, update(dt,t), dispose(), bounds:{w,d,h}, anchors:{ name: {pos:[x,y,z], yaw} }, lights?: [...] }` — `anchors` give natural positions for actors/cameras (documented list per set). Interiors include their own practical lighting (cheap emissive fixtures; at most 2–3 real lights) and are lit well even with no scene lights. Sets are 1:1 metres, with believable clutter & texture detail.
* `life.js`: `createMorgue()`, `createMallInterior()` (atrium + escalators + shops), `createFoodCourtMcD()` (fast‑food counter with yellow arches signage, menu boards, trays, fryer station), `createMcDCalifornia()` (drive‑thru window + kitchen + parking exterior), `createBar()` (Leon's bar: stools, bottles wall, neon, hidden shotgun spot), `createJeepneyTerminal()` (Cebu terminal with parked jeepneys area/benches/vendors), `createSanctuary()` (Bead's 10,000 m² colourful circus‑like fortress in Georgia: striped big‑top domes, towers, ferris wheel, gardens, walls & gates, plus interior atrium with EEN robot assembly line / control hall; return `{exterior, interior}` groups), `createApartment()`, `createHospital()`, `createPharmacy()`, `createCourtroom()` (Epiphany's lawyer world), `createLawOffice()`.
* `institutional.js`: `createNewsStudio()` (anchor desk, big video wall screen that can show a `CanvasTexture` via `set.screen.setTexture(tex)`, chyron strip), `createWarRoom()` (Pentagon situation room: huge wall screens/map table/consoles), `createUNHall()` (General Assembly: curved tiers, podium, flags), `createObservatory()` & `createMissionControl()`, `createLab(kind:'bsl4'|'virology'|'research')` (glove boxes, centrifuges, hazard signs, tanks, monitors), `createDataCenter()`, `createBunker()`, `createCommandPost()` (tent/field HQ), `createAlienInterior(kind:'corridor'|'bridge'|'hatchery'|'hold')` (organic mothership: ribbed walls, glowing cyan veins, membranes, hatchery pods, command dais), `createLaunchSite()` (TEL pad outdoors), `createSiloControl()`.
* Screens: sets with monitors expose `screens: [{mesh, setTexture(t), setCanvas(drawFn)}]` so the director can show live‑drawn UI/news/maps.

### 3.9 Audio — `src/audio/*` (entry `src/audio/engine.js`, fully procedural WebAudio)
```
createAudio() -> Audio {
  ctx, resume() /*call on user gesture*/, suspend(), setMaster(0..1), setVolumes({music,sfx,voice,amb}), duck(amount01, seconds), setListener(camera|null),
  music: { play(cue, {fade=2, intensity=0.5}), setIntensity(0..1, seconds), stop(fade), stinger(name) },
  amb: { set(name, level01, fade=2), clear(fade) },
  sfx: { play(name, {pos:V3|null, gain=1, pitch=1, delay=0, loop=false}) -> handle{stop(fade), setGain, setPitch, setPos}, stopAll() },
  voice: { say({text, lang='en-US', gender:'M'|'F', pitch=1, rate=1 /*optional*/, duration /*seconds the line must fit*/, style:'human'|'alien'|'robot'|'radio'|'ai', pan, character /*id for consistent voice choice*/}) -> handle{stop()}, setMode('tts'|'babble'|'off'), stopAll() },
  now()
}
Music cues (procedural, evolving, orchestral/synth hybrid, no samples): title, calm, everyday, curious, unease, news, dread, arrival, invasion, battle, chase, horror, sorrow, nuclear, hope, finale, credits, silence, tension_low, tension_high, alien, wonder, resolve.
SFX names: laser_fire, laser_hit, explosion_small, explosion_big, explosion_far, nuke, missile_launch, jet_pass, afterburner, rifle, burst, mg, cannon, tripod_horn, tripod_step, pod_whine, crawler_screech, alien_growl, alien_click, zombie_moan, zombie_roar, zombie_cough, infect_zap, glitch, static, alarm, siren, door, footstep, glass, crash, engine_idle, engine_rev, phone_ring, phone_vibrate, heartbeat, thunder, impact, riser, whoosh, shutter, news_sting, tick, beep, keyboard, camera, comm_open, comm_close, scream, crowd_panic, reload, shotgun, ... (add more freely).
Ambient beds: city_day, city_night, tropical_day, tropical_night, ocean, wind, interior_hum, lab, morgue, crowd, war_far, war_near, rain, space, alien_hum, fire, snow_wind, mall, bar, traffic, jungle, silence.
TTS: use `speechSynthesis` for style 'human' when available (pick voices by lang/gender/character, set rate so the line fits `duration`, cancel if overrun); 'alien'/'robot'/'radio'/'ai' are always procedural (formant synth/ring‑mod/bandpass) and syllable‑timed from `buildVisemeTrack` so audio and mouth agree. 'babble' mode = procedural formant voice for humans too. Never throw if speechSynthesis is missing.
```
### 3.10 FX & post — `src/fx/*`
```
createFX(scene, opts) -> FX { root, update(dt,t), clear(), dispose(),
  explosion(pos,{size=10, kind:'fireball'|'ground'|'air'|'big'|'laser'|'chain'}), smokeColumn(pos,{height,width,life,color,rate}) -> handle{stop()}, fire(pos,{size,life}) -> handle, sparks(pos,{count,dir,spread,color}), dust(pos,{radius,amount}), debris(pos,{count,power,size}), muzzleFlash(pos,dir,{size,color}),
  tracer(from,to,{speed,color}), impact(pos,normal,{kind:'ground'|'metal'|'flesh_green'|'energy'}), shockwave(pos,{size,color,speed}), scorch(pos,{size}) (ground decal),
  sporeCloud(pos,{radius,density,color}) -> handle{move(pos), stop()} (green infectious mist), coughPuff(pos,dir), infectPulse(pos,{radius}) (expanding green ring),
  rain(centerFn|{area}), snow({area}), embersField({area}), ashFall({area}), 
  reentry(from,to,{life,size,color}) (meteor/comet streak with glowing head + trail), nuke(pos,{size, inSpace:bool}) (cinematic detonation: white flash, expanding shell/ring, EMP‑ish rings; mushroom cloud when in atmosphere),
  engineGlow(pos,{size,color}) , smokeTrail(objectGetter,{...}) -> handle, ... }
createPost(stage) -> Post { render(dt), setSize(w,h,pixelRatio), setQuality(level), params:{ bloom:{strength,radius,threshold}, exposure, contrast, saturation, tint:[r,g,b], vignette, grain, chroma, fade /*0..1 to black*/, flash /*white*/, glitch, blur, letterbox }, shake(amount, seconds) (camera shake is applied by director, post only exposes value), dispose() }  // bloom + grade + film grain + vignette + chromatic aberration + glitch; MUST degrade gracefully on mobile (level 0: single cheap bloom or none)
createPerf(opts) -> { sample(dtMs), recommendedPixelRatio, level } // adaptive resolution / quality controller used by the director
```
Particles must be soft billboards or instanced meshes using procedural textures, additive/normal blended, depth‑tested; budgets scaled by `Q.particles`; one pooled system per kind; zero allocation per frame.

## 4. Main cast profiles (humans agent; these are fixed facts — pronouns & looks)
All are friends from the Philippines (Bead moved abroad). Heights are exact. Filipino unless stated. Make each instantly recognisable & distinct (silhouette, hair, clothes, accessories).
1. **Mirrah** — F, 4'11" (150 cm), 19, forensic pathologist. Petite, bright & precise; wears scrubs + lab coat; hair tied back (black, shoulder length bun), glasses optional.
2. **Bead** — M, 5'6" (168 cm), 20, billionaire founder of EEN (AI & robotics). Very athletic/buff, genetically stacked; sleek techwear; **contact lenses with holo glow (faint cyan ring in iris when active), small AI device on collar‑bone** (glowing pin), fluent in English & Russian. Confident, tuff.
3. **Jez** — F, 5'5" (165 cm), 21, historian. Fast & agile build; practical clothes (cargo jacket, satchel); shoulder‑length wavy hair; notebook.
4. **Stephen** — M, 6'2" (188 cm), 19, fast‑food worker (California). Tall, lanky‑strong; red/yellow uniform, visor cap; Filipino‑American.
5. **Ezra** — M, 5'5" (165 cm), 19, fast‑food worker (Dumaguete). Wiry; uniform; cheeky grin.
6. **Sam** — M, 5'9" (175 cm), 19, jeepney driver. **Heavyset/fat** (round belly, big hands, kind face), driver's shirt + towel on shoulder, cap.
7. **Jhaz** — F, 5'4" (163 cm), 19, jeepney driver (Cebu). Short boyish‑chic hair, driver's jacket/gloves, sturdy.
8. **Leon** — M, 5'1" (155 cm), 19, bartender & owner of his bar. Small, tough; tattoos, rolled sleeves, apron; has an (illegal) shotgun under the bar.
9. **Epiphany** — F, 4'11" (150 cm), 19, lawyer (Cebu, with Jhaz). Petite; sharp blazer, blouse, heels optional, hair in a neat low ponytail, tiny glasses optional; briefcase/folder.

## 5. Demo / test expectations
* Every module ships ≥ 2 demos in `src/demos/` (prefix = your module) covering: close‑ups, full body, animation sequences, swarms at scale (say 300–1500 instances), infected variants (`setInfection(1)`), and mobile quality `--q 0`.
* Render with the harness at `--q 2` for beauty shots and `--q 0` to make sure low quality still works.
