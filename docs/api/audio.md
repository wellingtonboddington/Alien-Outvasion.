# Audio engine (`src/audio/`) — CONTRACT §3.9

Fully procedural WebAudio: no samples, no network. Entry: `src/audio/engine.js` → `createAudio(opts?) -> Audio`.
Works in desktop/mobile browsers; accepts an injected `OfflineAudioContext` for tests/renders.

```js
import { createAudio } from './audio/engine.js';
const audio = createAudio();              // opts: { ctx, offline, quality 0|1|2, master, volumes:{music,sfx,voice,amb}, seed, mix }
audio.setListener(stage.camera);          // anything with .matrixWorld (three camera). null = origin, facing -Z
button.onclick = () => audio.resume();    // user gesture (iOS safe: silent-buffer unlock + auto re-resume on any later gesture)
audio.music.play('title', { fade: 3, intensity: 0.4 });
audio.amb.set('city_day', 0.8, 3);
audio.sfx.play('explosion_big', { pos: new THREE.Vector3(40, 3, -120) });
audio.voice.say({ text: 'Run!', gender: 'F', character: 'mirrah', duration: 1.2 });
```

## API
| call | semantics |
|---|---|
| `resume() -> Promise<state>` / `suspend()` | unlock / pause the context (also pauses speechSynthesis). Call `resume()` from a click/touch. |
| `setMaster(0..1)`, `setVolumes({music,sfx,voice,amb})` | master and stem volumes (stems 0..2). Voice volume also drives speechSynthesis volume. |
| `duck(amount01, seconds)` | dip music (and ambience ~75% as much) smoothly for `seconds`; overlapping calls merge. `setAutoDuck(0..0.95\|false)` = automatic dip while `voice.say` plays (default 0.5). |
| `setListener(camera\|null)` | listener for positional SFX. Read from `camera.matrixWorld` ~40×/s by the engine's own timer (calling `audio.update(dt)` per frame is optional). |
| `setMuffle(0..1, seconds)` | low-pass the whole mix (underwater / shell-shock / inside a vehicle). `setReverb(0..2)` global reverb return. `setQuality(0..2)` voice caps + reverb size. |
| `now()` | audio-clock seconds. `ctx`, `analyser` (AnalyserNode at the master), `live` (active voice counters), `timer` ('worker'\|'interval'), `dispose()`. |
| `music.play(cue,{fade=2,intensity=0.5,bar=0})` | cross-fades from the current cue (old cue fades over `fade`). Same cue again = just retarget intensity. `'silence'` = fade out. Deterministic (seeded) — a cue always plays the same notes. `bar` starts mid-loop (seek). |
| `music.setIntensity(0..1, seconds=2)` | smoothly adds/removes layers (percussion, brass, high strings, choir…). |
| `music.stop(fade)` / `music.stinger(name,{delay,duck})` / `music.cue` / `music.bar` | stingers: `hit sting_news sting_alien sting_loss sting_hope sting_horror sting_victory`. `music.cues()` lists names. |
| `amb.set(name, level01, fade=2)` / `amb.clear(fade)` | looping beds, crossfade by calling set on two names. Level 0 frees the bed after its fade. `'silence'` clears. |
| `sfx.play(name,{pos,to,gain,pitch,delay,loop,interval,...}) -> handle` | `pos` {x,y,z} (copied; `follow:true` tracks the object live), `to` = end point for a scripted fly-by over `dur`, `pitch` multiplies frequencies (and shortens time), `loop` repeats (steady sounds sustain, one-shots retrigger every `interval`/natural period). Handle: `stop(fade)`, `setGain(g,tc)`, `setPitch(p)`, `setPos(v)`. |
| `sfx.stopAll(fade)`, `sfx.names()`, `sfx.has(n)` | |
| `voice.say({text,lang,gender:'M'\|'F',pitch,rate,duration,style,pan,character,onend,duck,delay}) -> {stop(fade),dur,tts}` | see Voices. `voice.setMode('tts'\|'babble'\|'off')`, `voice.stopAll()`, `voice.mode`, `voice.hasTTS`. |

### Music cues (23)
title, calm, everyday, curious, unease, news, dread, arrival, invasion, battle, chase, horror, sorrow, nuclear, hope, finale, credits, silence, tension_low, tension_high, alien, wonder, resolve.
Each has its own key/mode, chord loop (4–8 bars), tempo, orchestration (pads/strings/brass/choir/piano/harp/bells/cello ostinati/arps/taiko/war drums/metal/risers/braams/heartbeat/textures) and a layer-intensity map. Shared leitmotifs: the *Outvasion theme* (title, arrival, battle, sorrow, resolve) and the *hope theme* (hope, finale, credits).
Scheduling: 16th-note grid scheduled **1.6 s ahead** of the audio clock (2 s on quality 0) by a Web-Worker timer (immune to tab throttling), so the main thread may stall ~1.5 s (scene swap) with no gap. A polyphony governor sheds bells/arps/textures first when the voice cap is reached.

### SFX names
laser_fire (opt `long:true` = sustained beam; alias laser_beam), laser_hit, explosion_small/big/far, nuke, missile_launch, jet_pass (opt `dir`, `dur`), afterburner, rifle, pistol, burst, mg, cannon, shotgun, reload, bullet_whiz, ricochet, grenade, tripod_horn, tripod_step, pod_whine, crawler_screech, alien_growl, alien_click, zombie_moan/roar/cough, infect_zap, glitch, static, alarm, siren (opt `kind:'yelp'`), door, door_open, footstep / footsteps (opt `surface`: concrete tile grass gravel wood metal carpet snow sand mud water; `count`, `interval`, `run`), glass, crash, engine_idle, engine_rev, helicopter, tank, phone_ring, phone_vibrate, heartbeat (opt `bpm`), thunder, impact (opt `kind:'metal'`), riser (opt `dur`), whoosh (opt `dur`,`dir`), shutter, camera, news_sting, tick (opt `tock`), beep (opt `freq`,`dur`), keyboard, comm_open, comm_close, scream (opt `male`), crowd_panic, splash, hiss, power_up, power_down, scanner, bio_squelch, breath, hit_flesh, drone_hum, radio_chatter, wood_creak, metal_groan.
Positional sounds get: distance gain (per-sound reference distance), air-absorption low-pass, pan, wetter reverb when far, speed-of-sound delay for far booms (explosion_far, thunder), half-strength doppler for moving sources.
Continuous sounds (`engine_idle`, `afterburner`, `pod_whine`, `siren`, `static`, `helicopter`, `tank`, `drone_hum`) sustain while `loop:true`.

### Ambience beds (21 + silence)
city_day, city_night, tropical_day, tropical_night, ocean, wind, interior_hum, lab, morgue, crowd, war_far, war_near (uses positioned distant explosions/gunfire), rain, space, alien_hum, fire, snow_wind, mall, bar, traffic, jungle, silence.

### Voices
* `style:'human'`: `speechSynthesis` when available and mode `'tts'` (default): voice picked by lang → gender (name heuristics) → `character` hash (stable per character), pitch varied per character, `rate` fitted so the line takes `duration` (0.7–1.8, self-calibrating per voice), cancelled if it overruns; never throws. TTS cannot be panned/ducked/recorded (browser limitation) — music/amb are ducked for you.
* `babble` mode and styles `alien | robot | radio | ai` always use the procedural formant voice: glottal source → F1–F3(+F4) vowel filters, consonant noise bursts, sentence prosody (declination, `?` rise, word accents), timed from `buildVisemeTrack(text, duration)` so sound = mouth. Per-character pitch/timbre (main cast has presets: mirrah, bead, jez, stephen, ezra, sam, jhaz, leon, epiphany). alien = low growl + sub + ring-mod + mandible clicks + long reverb; robot = monotone ring-mod + bit-crush + comb; radio = band-pass + saturation + static + squelch blips; ai = smooth shimmer chorus.

## Offline / tests
`createAudio({ ctx: new OfflineAudioContext(2, n, sr) })` → `audio.advance(dt)` moves the virtual clock and schedules (music steps, ambience events, loops); then `ctx.startRendering()`. `src/audio/offline.js: renderItem()` wraps this.
`node tools/audio-test.mjs [--kind sfx|music|stinger|amb|voice] [--filter re] [--png] [--wav] [--raw]` renders everything and checks NaN / peak ≤ 1 / silence / RMS; `--png` writes spectrograms to `out/audio/`; `--live` runs a real-time smoke test; `--notes cue --bpm N` prints the notes a cue plays; `--layers cue` solo-measures layers; `--calibrate sfx|cues` regenerates `src/audio/mix.js` (levels).
Demos (render harness): `node tools/render.mjs --demo audio_spectro --w 1600 --h 900`, `--demo audio_cues` (spectrogram sheets).

## Notes / limitations
* Master chain: stems → premaster → muffle LPF → glue compressor → limiter → master → soft clipper (|y|<1 guaranteed) → destination. Two procedural convolution reverbs (short room / long hall) with per-stem sends.
* Positional audio uses StereoPanner (no HRTF) to stay cheap on phones. SFX `pitch`/`gain`/`delay`/`loop` per call; polyphony caps drop low-priority new SFX when overloaded.
* Not listened to by a human during development: levels/timbres were designed by measurement (spectrograms, RMS targets in `mix.js`); expect to tweak `mix.js`/`vol` after listening.
