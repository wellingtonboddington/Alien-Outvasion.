# vehicles API (`src/models/vehicles.js`)

All factories return `{ root, update(dt,t), dispose(), setInfection(a), setDamage(d), anchors?, bounds, mats, ...setters }`. Front = +Z, +Y up, metres.
Origin: ground contact under the vehicle (jets/helis: gear-down ground contact, CG sits 2.4 m up; ships: waterline centre; missiles: TAIL (see below); satellites/station: centre).
`opts` common: `seed, scale, infection(0..1), damage(0..1)`. Everything is infectable (`setInfection`) and seekable (animation = f(t) + small springs).
Seat anchors: `{pos:[x,y,z], hip:[x,y,z], yaw, seatH}` (local space), e.g. `anchors.driverSeat`, `passengerSeats[]`, `exitDoor`, `gunner`.

## Wheeled / civil (Vehicle: `setSpeed(mps) steer(rad) setBrake(a) setLights(on) setTravel(m)`)
- `createJeepney({seed,palette,name})`, `createEenbot(opts)` (robot, `play(clip)`), `JEEPNEY_PALETTES`, `JEEPNEY_NAMES`
- `createCar(kind:'sedan'|'hatch'|'suv'|'taxi'|'police'|'ambulance'|'van'|'pickup', {paint,seed,...})` (+`setSiren(on)` police/ambulance), `CAR_PAINTS`
- `createBus({paint,stripe,seed})`, `createTruck(kind:'box'|'fuel'|'flatbed', opts)`, `createMotorbike(opts)`, `createTricycle(opts)` (PH sidecar)
- `createCarPark({rows=2, cols=7, fill=0.8, kinds[], seed, damage}) -> {root, cars[], update, setInfection(a), setLights(on), dispose}` — cars are full hero models (~30k tris each): keep cols*rows small.
## Military (tracked/wheeled Vehicle API + turret setters)
- `createTank({color:'olive'|'desert'|'dark'|'grey'|'arctic'|'green',camo})` `.setTurret(yaw) .setGun(elev) .aimAt(worldPt) .fire()`
- `createAPC(opts)` `.setTurret(yaw,pit) .fire()`; `createHumvee(opts)` `.setGun(yaw,pit) .fire()`
- `createLauncher('himars'|'patriot'|'tel', opts)` `.setElevation(a)`; tel: `.setRaise(0..1) .missile`; `createHowitzer(opts)`, `createAntiAir(opts)` `.setTurret(yaw,pit)`
## Air (`src/models/vehicles/air.js`)
- `createJet('f15'|'f35'|'bomber', {throttle, bank, pitch, gear})` -> `.setThrottle(0..1)` (afterburner flame >0.55, nozzle glow) `.setBank(rad)` (+ = right wing down; airframe rolls, ailerons move) `.setPitch(rad)` (+ = nose up; stabilators move) `.setSpeed(mps)` (auto-throttle unless setThrottle was called) `.setGear(0..1)` `.setLights(on)`. Real size (F-15 13 m span, B-2 style bomber 52 m). Banking rotates an inner airframe group: you only set root position + yaw.
- `createHelicopter('attack'|'transport', {rotor})` -> `.setRotor(0..1)`=`.setThrottle` (spin-up, blur disc at speed) `.setBank/.setPitch(rad) .setSpeed(mps)` (forward lean) `.rotorRadius`; anchors: pilotSeat, gunnerSeat / copilotSeat, passengerSeats, exitDoor.
- `createMissile('cruise'|'icbm'|'sam'|'rocket'|'interceptor', {burn, axis, scale})` -> `.setBurn(0..1)` (exhaust flame + glow) `.setStage(0..1)` (stage-1 separation, interceptor/others with stage groups) `.length`. Orientation: nose +Y, origin at tail for icbm/interceptor/sam/rocket (pad pose; `axis:'z'` for nose +Z, centred origin); cruise defaults to `axis:'z'`.
  `icbm` 17 m 3-stage; `interceptor` = nuclear interceptor (12.4 m, white/grey 2-stage, grid fins, red hazard bands, trefoil, warhead cone, bright white-blue exhaust).
- `createSatellite('comms'|'recon'|'gps', opts)` -> `.setSun(rad)` (array angle) `.setSpin(rad/s) .setTumble(rad/s)`; `createSpaceStation(opts)` ISS-like 109 m -> `.setArrays(rad) .setArrayRate(rad/s)`
- `createWarship('destroyer'|'carrier'|'ferry', {sea:0.5, seed})` -> `.setSea(amp)` (roll/pitch/heave), `.setSpeed(mps)`; spinning radar; anchors helipad/flightDeck/gangway; carrier 333 m with deck markings + parked jets.
## Cost (draw calls / tris, medium quality)
jet f15 ~30 / 14k, f35 ~25 / 11k, bomber ~20 / 7k; helicopter ~25 / 10k; missile ~8 / 2-6k; satellite ~12 / 4k; station ~14 / 30k; destroyer ~14 / 25k; carrier ~14 / 20k; ferry ~12 / 15k; bus/truck ~40 / 14k; bike ~15 / 5k.
## Demos
`vehicles_military` (`params.extra` adds APC/Patriot/SPAAG/TEL), `vehicles_air` (`params.set:'air'|'misc'`, `params.only:[shot names]`), plus existing vehicles_civil/jeepney/eenbot.
## Known gaps
No wheeled wake/trails (use FX module); missile smoke trails not included; jets have no weapon-release/canopy animation; ships have no wake or crew; carrier jets are static low-poly.
