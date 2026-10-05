# Pass-2 notes (quality / error-check pass) — technical, spoiler-free

State: complete 1800 s film (64 scenes in `src/film/act1..act4.js`, built into `alien-outvasion.html`). `node tools/smoke.mjs` walks every scene (software GL, ~15 s/scene); last full run: 0 hard errors, all scenes build and render.

## How to iterate cheaply
* `node tools/build.mjs --dev` → `node tools/smoke.mjs --q 0 --w 480 --h 270 --points 0.5 --only s19,s34 --out out/x` → `node tools/sheet.mjs out/sheet.png 3 out/x/*.png` and look at the sheet. `node tools/shotfilm.mjs --times 120,300 --q 1` screenshots the real player (DOM HUD included). `tools/render.mjs --demo <name>` renders asset demos (`human_cast`, `_face`, `aliens_lineup`, `alientech_pods`, `vehicles_air`, `sets_life_*`, `env_*`, `fx_*` …).
* Scenes are authored with `SceneContext` (src/engine/scene.js) + the helpers in `src/film/{kit,battle,space,screens}.js`; every scene is a pure function of time (seek-safe). `S.fit(t0,t1,lines)` is the dialogue timer: it never clips a line, turns slack into pauses and warns (`dialogue overfull`) when a scene has more talk than time — remaining warnings: a handful of scenes by ≤ 5 s (trim lines or lengthen the scene, keep the 1800 s total).
* Dialogue timing: speech is scheduled from `estimateDuration` (170 wpm + pauses); the voice engine fits TTS rate to the scheduled duration (0.7–1.8×) and subtitles stay up until line end + 0.35 s. If a browser voice is slow, raise a line's `dur` or lower the scene's talk.

## Known issues / best next improvements
1. **Faces & hair** (src/models/human): faces are readable but a bit uncanny (lip/eye texture, wide head proportions); long/ponytail hair cards can stray across the face (Epiphany was switched to `pixie`; `low_ponytail`/`bob` fringe needs fixing in `hair.js`); Leon's goatee/stubble texture is blotchy; hands are simple.
2. **Cinematography in cramped sets**: auto-coverage (`coverageSpec` in camera.js) frames the speaker's face using the actor's facing, but small sets (BSL-4 lab, bunker, silo) put benches/walls in front of the lens; hand-tune a few shots using the sets' `cam*` anchors.
3. **Performance**: heavy exteriors reach ~1.3 M triangles at quality 1 (`s19`), sets build in 5–15 s in software GL (fast on a GPU, but check phones). Knobs: `Q` in src/engine/common.js, `cnt()` in battle.js (crowd counts), `Q.level` 0 for phones. The player auto-selects Low on mobile.
4. **Animation polish**: gestures are procedural; humans in vehicles/at counters mostly use generic clips; no hand-to-hand interactions (handshakes, hugs) beyond clip names that exist.
5. **Audio**: fully procedural (src/audio); mix levels were calibrated offline only. Music lookahead is 1.6 s so scene swaps (≈0.5 s stall) don't glitch.
6. **Vehicles**: military turrets (tank/howitzer) look blobby; exhaust flames read as white columns; car parks are expensive (30 k tris/car).
7. Asset agents' API docs: `docs/api/*.md`. Contract and conventions: `docs/CONTRACT.md`.
