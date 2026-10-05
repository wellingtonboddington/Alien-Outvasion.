# ENV — sky, space, ocean, terrain, vegetation (agent F1a)

Files: `src/world/{sky,space,ocean,terrain,vegetation}.js`, helpers `src/world/env/*` (noise, palette, skyShader, stars, earthData, vegAtlas, wind).
Demos: `env_sky`, `env_space`, `env_ocean`, `env_terrain`, `env_vegetation` (`node tools/render.mjs --demo env_xxx --out out/env_xxx [--q 0|1|2]`).
Everything is procedural (no files); all animation is a pure function of `t` (seek-safe); no `Math.random`. Tone-mapping/colour-space chunks are included in the custom shaders, so they match the renderer/post pipeline.

## Typical film setup (exterior scene)
```js
const sky = createSky('goldenHour'); const {sun, hemi} = sky.applyTo(scene);   // scene.fog (FogExp2 = horizon colour), background, environment(+intensity) set; sky.root added to scene
const terrain = createTerrain({style:'tropical', size:3000, layout:'coast', seaAngle:4.2, shoreDistance:200, flatRadius:60});
const ocean = createOcean({terrain});                  // auto-binds scene.userData.sky (set by applyTo) for colours/sun/clouds
scene.add(terrain.root, ocean.root);
scene.add(scatterVegetation(terrain,'coconut',120,{cx:0,cz:-80,radius:90},seed).root);
// every frame (t = film time):  sky.update(dt,t); ocean.update(dt,t); sky.setShadowFocus(focusPoint, radius);
```
Camera for ground scenes: near 0.3, far >= 6000 (the sky dome ignores far). The sun `DirectionalLight` (`sky.lights.sun`) also carries the shadow camera (only when `Q.shadows`).

## sky.js
`createSky(preset='day', opts) -> Sky`; presets: `day dawn goldenHour dusk night overcast storm smoke dayHaze coldMorning` (`SKY_PRESETS`).
* `root` (dome + stars + clouds + sun + hemi lights; `applyTo` adds it to the scene if it has no parent), `lights:{sun,hemi}`, `uniforms` (shared with ocean), `preset`, `P` (resolved palette), `flash` (0..1 lightning).
* `applyTo(scene) -> {sun, hemi}`; `setPreset(name,{elev,az})`; `blend(a,b,k)` (exact lerp between presets incl. sun angle: use for time-of-day shots); `setSunAngle(elevDeg, azDeg)` (az: 0=+Z, 90=+X; persists until setPreset/blend); `setMoonAngle(elev,az)`; `setStorm(0..1)` (dark rolling clouds, wind, lightning flashes driven by `update`), `setSmoke(0..1)` (orange-brown ash sky, sun dimmed, denser fog), `setCloudCover(0..1)`.
* `setShadowFocus(v3, radius=80, reach=0)` ortho shadow box follows the point, texel-snapped (no shimmer); `setShadows(bool)`. Key light = sun by day, moon at night (smooth hand-over).
* `update(dt,t)` must be called each frame (clouds drift, stars twinkle, lightning, env refresh <= 5 Hz only when the sky changed). `lightningFlash(t, seed, rate)` exported + `sky.lightningFlash(t)`; `sky.lightning={enabled,seed,rate}`.
* `sunDirection(out)`, `moonDirection(out)`, `lightDirection(out)`, `fogColor(out)`, `envScale/fogScale` multipliers, `dispose()`.
* Env map: 64x32 half-float equirect baked on the CPU from the same palette (three PMREMs it automatically); replaced (old one disposed) only when the sky changes.
* `createSkyUniforms()` exported for custom materials.

## space.js
* `createEarth({radius=6371, seed, atmosphere=.026, cityLights=1, clouds=1, spin, aurora=true, relief=1, rotation}) -> Earth` : `root, globe, radius, sunDir (Vector3), update(dt,t), setSun(sunObj), setSunDirection(v3), setCityLights(0..1), setClouds(0..1), setAurora(0..1), setSpin(rad/s), setRotation(rad), latLonToWorld(lat,lon,alt,out), surfaceNormal(lat,lon,out), cameraRange(dist), dispose()`.
  Continents are hand-outlined (recognisable Earth) + fractal coastlines, biomes, relief shading, ocean glint, animated cloud shell (shadows on the surface), ray-marched atmosphere (blue limb, orange terminator, transmittance), night-side city lights, optional aurora. Lighting is self-contained (uses `sunDir`, not scene lights); `earth.setSun(sun)` keeps it synced with `createSun()`.
* `createMoon({radius=1737, seed})` (craters/maria/normal map; lit by scene DirectionalLight, e.g. `createSun().light`), `createStarfield({count, milkyWay, nebula, brightness})`, `createNebula({colors,intensity})`, `createSun({size, intensity, direction}) -> {root, light, direction, setDirection(v), setIntensity, setGlare(k), occluders:[{center,radius}], update}` (depth-tested lens-flare glare: hidden by planets, visible past the limb).
* Scale: any radius works (6371 = km, or `radius:6` for a small stylised planet). Helpers: `planetCameraRange(radius, distFromCentre) -> {near,far}`, `frameEarth(camera, earth, {lat,lon,distance (in radii), fov})`. Advice: near = 4% of altitude (>= radius*5e-5), far = dist + 12 radii (no log-depth needed up to ~1e5:1). Stars/milky way/nebula render at infinity and ignore far. For a Moon at 384400 km set far ~ 5e5.
* Constants: `EARTH_RADIUS_KM, MOON_RADIUS_KM, MOON_DISTANCE_KM, SUN_DISTANCE_KM`.

## ocean.js
`createOcean({size=7000, color, deepColor, choppiness=1, waveHeight=1, waveDir(rad), seaLevel=0, terrain, shore:{extent,center,res}, depthScale=7}) -> {root, mesh, update(dt,t), setSky(sky), setShore(terrainOrFn,{center,extent,res}), setWaveDirection(rad), setChoppiness(c), setWaveHeight(h), setSeaLevel(y), setColors(shallow,deep), dispose()}`.
Camera-centred polar mesh (never ends), 6 Gerstner waves, scrolling procedural normals, fresnel reflection of the real sky (clouds/sun/horizon shared via `scene.userData.sky`), GGX sun glitter, crest foam, far edge fades into the horizon colour, scene fog supported. `setShore` (or `terrain` option) bakes a half-float depth map -> turquoise shallows, transparency, swash/surf foam lines at the beach. Storm: `setChoppiness(2); setWaveHeight(3.5)`. Camera below the surface is not handled.

## terrain.js
`createTerrain({size=3000, seed, style:'tropical'|'temperate'|'farmland'|'desert'|'snow'|'rocky', flatRadius=60, flatHeight, seaLevel=0, layout:'island'|'coast', islandRadius, seaAngle, shoreDistance, ring (0..1 mountain ring), ringRadius, relief, center, snow, segments}) -> {root, mesh, heightAt(x,z), normalAt(x,z,out), slopeAt, isLand, inlandAt, splatAt, shorePoint(angle|along,out)->{x,z,nx,nz}, density(kind,x,z), setSnow(a), setWetness(a), size, style, seaLevel, dispose()}`.
`heightAt` is analytic (exact, cheap). Flat disc of `flatRadius` (at `flatHeight`) around the origin for city sets. Tropical = beach strip + seabed (island or straight coast); rocky = Caucasus-style valley ringed by mountains (also `ring` option for other styles); farmland = staggered field patchwork with hedgerows/crop rows; snow/desert/temperate as named. Density-warped grid (fine at the centre, coarse at the rim), per-vertex splat + macro colour, shader detail layers + bump, wet-sand band, snow dusting. Border hills hide the terrain edge (non-island styles).

## vegetation.js
`createVegetation(kind, {capacity=1, variant, seed}) -> {root, mesh, kind, capacity, count, height, radius, tris, set(i,{x,y,z,yaw,scale,tilt,tiltDir,tint}), setCount(n), commit(), dispose()}`;
`scatterVegetation(heightFnOrTerrain, kind, count, area, seed, opts) -> same` (area: radius | {cx,cz,radius} | {x0,z0,x1,z1}; opts: variant, mask(x,z), minHeight/maxHeight/maxSlope, minDist, scale:[a,b], exclude:[{x,z,r}|{x0..}], tintVar, lean, yOffset, scaleCount=false to bypass the Q.crowd scaling (count*(.45+.55*Q.crowd)); with a terrain its `density(kind,x,z)` mask is used), `placeVegetation(kind, items)`, `setWind(strength 0..2, dirRad, gust)`, `getWind()`, `setSnow(0..1)` (global snow dusting on trees+terrain).
Kinds: `coconut` (curved ringed trunk, 3 frond layers, nuts), `palm` (royal), `fanpalm`, `tree` (variants tropical|deciduous|autumn|bare|birch; aliases `broadleaf deciduous autumn bare birch`), `pine` (variants spruce|scots), `bush` (variant flowering), `grass` (variant dry), `banana`, `acacia`.
One shared 1024^2 (q2) atlas + one material for all kinds (alpha-test + alpha-to-coverage cards, baked AO/spherical normals, wind sway + frond flutter in the shader, backlit leaf translucency using the sun's shadowed light, snow on upward faces); shadow pass uses a matching depth material (swaying, cut-out). 1 InstancedMesh (= 1 draw call, +1 shadow) per set.
