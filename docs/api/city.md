# City module API  (`src/world/city.js`, helpers in `src/world/city/**`)

Everything is procedural: canvas facade/ground/roof/stone textures (cached, shared), merged geometry built by a `Builder`
(one bucket == one material == one draw call). Units metres, +Y up, local +Z = "front". Seeds are fixed (`RNG`), so every
factory is deterministic. Materials are cloned per object (textures shared) so `setNight()` is per object.

```js
import { createCityBlock, createStreet, createSkyline, createBuilding, createLandmark, damageCity, createRuins, createRubble,
         createBurningBuilding, createCrater, createWreck, createCollapsedOverpass, createToppledBridge, ... } from '../world/city.js';
```
All factories return `{ root, update(dt,t), dispose(), setNight(0..1), ... }` (landmarks return a Group with those attached as properties).
Add `root` to the scene yourself. Real sun/hemisphere lighting is assumed (sun ~3, hemi ~0.5, env ~0.5); night = `setNight(1)` lights windows, signs, lamps, shop pools.

## Districts
`createCityBlock(style, {seed=1, w, d, density=0.8, damage=0, night=0, snow, cars=true, trees=true, props=true, wires=true, wet=false, shadows=true, reserve:[cellIdx]})`
* styles: `dumaguete` (default 170x170: pastel painted concrete, GI roofs, tangled power lines, bunting, sari-sari kiosks, jeepneys/tricycles, covered basketball courts, palms/rain trees), `cebu`, `manhattan` (canyon, setbacks, deco, fire escapes, wood water towers, steam vents, taxis), `berlin` (Altbau + Plattenbau, tram tracks, plane trees), `moscow` (Stalin blocks, panel blocks, snow default 0.75, birch/spruce), `delhi`, `generic`, `suburb`, `industrial`.
* returns `{root, layout, update, dispose, setNight(n), setDamage(level, seed), bounds:{minX,maxX,minZ,maxZ,w,d,h}, streetAnchors:[{pos:[x,y,z],yaw,kind:'junction'|'lamp'}], fireAnchors:[Vector3], damage, stats:{tris,buckets,byBucket}}`.
  `layout.roadsX / roadsZ` = road centre-lines, `layout.cells[]` (kerb rectangles, `.inner`, `.courtyard`), `layout.lots[]`.
* **Damage**: `damageCity(blockOrRoot, level01, seed)` (or `block.setDamage(level)`) *rebuilds the geometry* deterministically (~100-300 ms: call at cuts, not per frame).
  Clustered hot zones: broken windows + soot decals, flickering window glow + flame quads, collapsed corners, leaning towers, hanging slabs, rebar, rubble spilling onto streets, burnt cars, dead trees, toppled lamps. level 0.5 = patchy, 1 = mostly rubble. `fireAnchors` lists world points (block-local) for FX smoke/fire columns (max ~60-70).
* Budget: a 170 m block ~ 35 draw calls (incl. shadow pass), 110k-230k tris undamaged (Q.detail trims props).

## Single objects
* `createBuilding(kind, {style, seed, floors, w, d, damage, fireBoost, night, snow})` kinds `tower glass_tower midrise lowrise house shophouse warehouse tenement altbau stalin plattenbau deco` -> `{root, setDamage(0..1), setNight, bounds, top, fireAnchors, spec}`.
* `createStreet(len, {style, width, sidewalk, buildings=true, trees, cars, lamps, damage, barricades 0..1, checkpoint, tents, sandbags, wet, snow, seed})` straight street along **Z** centred on origin (road width `width`, sidewalks, markings, manholes, puddle/crack decals, building rows, parked cars, lamps, trees, benches, signs) -> `{root, setDamage, setNight, streetAnchors:[{pos,yaw,kind:'lane'|'sidewalk'|'lamp'}], bounds, fireAnchors}`.
* `createSkyline(style, {kind:'ring'|'row', radius=1400, length, depth, count=150, seed, haze, hazeAmount, minH, maxH})` far-field silhouettes with lit windows (1-3 draw calls, ~3k tris).
* Furniture: `createLampPost, createUtilityPole, createTrafficLight, createBench, createBollard, createSign(kind), createBarricade('jersey'|'hbar'|'hedgehog'|'wire'), createSandbagWall(len,rows), createTent, createCheckpoint, createKiosk, createBusShelter, createTree(kind), createParkedCars(listOrCount,{shapes,wreck})`
  (car shapes: sedan hatch suv van pickup taxi police jeepney tricycle bus truck; trees: raintree palm coconut banana plane linden birch spruce bare neem mango bush).

## Landmarks
`createLandmark(name, {seed, snow, night})` -> Group (`.update .dispose .setNight .fireAnchors .anchors .stats`, `userData.bounds`)
`dumaguete_blvd` (seafront: sea wall + balustrade, benches, palms, pier, bangkas, Apo Island silhouette far across the water, `userData.info.waterLevel`), `dumaguete_belltower` (coral-stone belfry), `cathedral` (twin-tower baroque, alias `dumaguete_cathedral`), `berlin_tv_tower` (368 m), `berlin_gate` (columns + quadriga), `moscow_kremlin` (Red Square: red brick crenellated wall, tent-roof towers + clock tower, gold-domed cathedrals, St-Basil-style spiral domes, GUM-like arcade; pass `{snow:0.8}`), `newyork_towers` (manhattan block + deco/setback/glass hero towers + skyline ring + river), `delhi_gate` (India-Gate-like arch, avenue, canals, domed building), `cebu_skyline`, `pentagon` (aerial: 5 rings, courtyard, parking lots with ~1000 cars, highways, overpass), `un_building` (slab + General Assembly + flags + river), `georgia_mountains` (Caucasus ring with snow caps, valley village/towers; `group.heightAt(x,z)`; use a low fog density), `whitehouse_like`.

## Destruction props
* `createRuins({style, w, d, count, level, seed, fires})` cluster of collapsed buildings + rubble fields.
* `createRubble({radius, count, height, kind, rebar, area:[w,d], fire, seed})` -> 3 InstancedMesh draw calls (concrete chunks, slabs, rebar), no per-frame cost.
* `createCrater({radius, depth, glow, fire, seed})` -> `{heightAt(x,z), fireAnchors}` displaced scorched disc + rim rocks + decals.
* `createBurningBuilding({kind, floors, w, d, damage=0.58, fireBoost=3})` -> building with glowing/flaming windows; `fireAnchors` + `smokeAnchor` (Vector3 near the top).
* `createWreck('car'|'bus'|'jet'|'tank'|'alien_pod'|'tripod_leg', {seed, burning})` -> `{root, fireAnchors, setNight}`.
* `createCollapsedOverpass({len,width})`, `createToppledBridge({len})`.
* Flames are an additive shader (`fire` bucket, animated by `GLOBAL.time`); `ember` bucket = flickering interior glow. FX agent adds smoke/fire columns at `fireAnchors`.

## Dev demos (`node tools/render.mjs --demo <name> --out out/x`)
`city_dumaguete` (street / across / aerial / drone; `--params '{"preset":"night"}'`), `city_manhattan`, `city_ruins` (damage 0/.5/1 + props), `city_landmarks` (`--params '{"only":["pentagon"]}'`), `city_bldg`, `city_textures`, `city_matsheet`, `city_stats`.
