# Everyday-life sets — `src/world/sets/life.js`
All factories: `createX(opts?) -> { root, update(dt,t), dispose(), bounds:{w,d,h}, anchors:{name:{pos:[x,y,z], yaw, look?}}, screens?:[{mesh,setTexture(t),setCanvas(fn)}], lights, stats() }`.
Set space: origin = floor centre, +Y up, 1 unit = 1 m. `anchors`: actor spots (feet on the floor, `yaw` = facing, `rotation.y = yaw`) and cameras (`cam*`, with `look` target; use `[...pos, ...look]`). Every set has `camWide` and `camMid`.
Interiors carry their own hemisphere + <=2 point lights + emissive fixtures (add `root` only; no scene lights needed). Exteriors (McDCalifornia, Terminal, Sanctuary exterior) expect the scene sun/hemisphere (terminal has a weak hemisphere).
TV/monitor screens that animate by themselves stop when you call `setTexture`/`setCanvas` (then the director owns them). Seekable: all motion is a function of `t` passed to `update`.
Demos: `sets_life_mall` `sets_life_morgue` (older) · `sets_life_bar` (`--params '{"which":"bar|apartment|hospital|pharmacy|courtroom|office|terminal|sanct|all"}'`) · `sets_life_terminal` · `sets_life_sanctuary` (exterior aerial/gate + interior) · `sets_life_dump` (prints anchors/stats).

| set | bounds w×d×h | tris / draws |
|---|---|---|
| createMorgue | 9.2×8.4×3.1 | 30k / 82 |
| createMallInterior | 48×34×16 | 131k / 55 |
| createFoodCourtMcD | 14×11×4.2 | 71k / 89 |
| createMcDCalifornia | 120×95×12 | 86k / 107 |
| createBar | 5.6×11.6×3.2 | 79k / 81 |
| createJeepneyTerminal | 44×34×8 | 29k / 39 |
| createSanctuary | 104×104×40 (+interior r30) | 277k / 370 (ext ≈ 160k, int ≈ 115k) |
| createApartment | 7.2×8.6×2.8 | 9k / 43 |
| createHospital | 16×12×3 | 15k / 52 |
| createPharmacy | 9×7×3.2 | 26k / 36 |
| createCourtroom | 14×12×5.2 | 12k / 38 |
| createLawOffice | 6.4×5.6×2.9 | 13k / 41 |

## Anchors
* **Morgue**: mirrahTableA, tableA, tableAFoot, tableAHead, tableB, tableBHead, drawerWall, drawerOpen, sinks, desk, deskSeat, door, gurney · cams camWide camMid(=camTable) camTable camTableLow camDrawers camDrawerClose camDesk camDoor camOverhead. `screens`: 1.
* **MallInterior**: entrance, kiosk1-2, stage, bench1-2, escalatorA_bottom/top, escalatorB_top, balcony1-2, shop1-2 · cams camWide camMid(=camEscalator) camEntrance camAtriumUp camEscalator camBalcony camShops camKiosk camLevel1 camOverhead.
* **FoodCourtMcD**: customer1-2, pos1-3, fryer, grill, drinks, prep, pickup, door, booth1, table1-2, tv · cams camWide camMid(=camCounter) camCounter camCounterLow camKitchen camBehind camTV camWindow camBooth. `set.tv`.
* **McDCalifornia**: same as FoodCourtMcD + driveThruWindow, driveThruCar, orderBoard, parkingStall, entrance · cams + camLot camLotWide camDriveThru camPalms.
* **Bar** (Leon): leon, leonTaps, leonRegister, leonBottles, stool1-6, standAtBar, booth1-2, highTable, door, window, jukebox, dartboard, restroom, tv, **shotgun** (hidden spot under the bar, look = barrel rack) · cams camWide camMid(=camBar) camBar camBartender camTaps camBottles camNeon camShotgun camTV camBack camWindow camJukebox. `set.tv`.
* **JeepneyTerminal** (Cebu, open air; street/camera side +Z, shop buildings −Z): **bay1-bay4** (place a jeepney: `pos`, yaw 0 = nose to +Z; bays at x=-7.5,-2.5,2.5,7.5, z=-6, 5 m apart), driver1-4 (stand beside each bay, facing the bay), front1-4 (in front of each bay facing the jeepney), vendor1-3, customer1-2, bench1-3, shed, dispatcher, queue1-3, street, curb, entrance · cams camWide camMid camBays camBay1 camBay4 camVendors camShed camKiosk camHigh camStreet camCables. Contents: 6 route boards (overhead + per-bay + map), tarp shed + benches, dispatcher kiosk, 3 vendor carts, pole/cable tangle, shop buildings, banner.
* **Sanctuary** (Georgia): `{ root, exterior, interior, anchors, interiorAnchors, exteriorAnchors, screens, setMode('exterior'|'interior'|'both'), setGateOpen(0..1), getGateOpen, eenLogo, interiorOffsetY(-100) }`. Exterior is the world frame (origin = courtyard centre, 100×100 m = 10,000 m² walled compound, gate on the +Z wall, road leads out along +Z, lawn disc r=420 m); the interior is a round hall (r=30 m, big-top ceiling) placed 100 m BELOW the exterior (hidden under the lawn); interior anchors are already offset, so add `set.root` once and switch with `setMode` (or add `set.exterior`/`set.interior` separately; each group also has `.anchors`). Gate leaves are closed by default. The ferris wheel (R=14 m, 16 gondolas) turns, interior assembly-line arms/units, holo table and screens animate.
  * exterior: **gate** (outside, facing the gate), gate_courtyard, **wall_top** (+wall_top2, wall_top_in: on the south wall walkway y=9), helipad, fountain, courtyard, bigtop_door, wheel, road · cams **camWide**(aerial) **camMid** camAerial camAerial2 camGate camGateHigh camWallTop camWallInside camCourtyard camBigTop camWheel camHelipad camFountain camTower.
  * interior: **bead_desk** (behind the holo control table, facing visitors), visitor, visitor2, visitor3, **line** (+line2, line3: beside the robot assembly belt, facing it), gate_in (inside the entrance, facing in), door, balcony, balcony2, lab, glassroom, reception, arena, center · cams **camInWide camInMid** (also `interior.anchors.camWide/camMid`) camHolo camHoloSide camBead camVisitor camLine camLineLow camLineHigh camAtrium camCeiling camBalcony camLab camGate. (If a name exists in both lists the interior one is `in_<name>` in the top-level `anchors`.)
  * `screens`: holo/wall panels (EEN counter, node map, diagnostics); `eenLogo(ctx,w,h)` draws the EEN mark.
* **Apartment** (studio, dusk skyline): sofa1-2, tv, standLiving, kitchen, fridge, dining1-3, bed, bedside, window, window2, door, entry, wardrobe · cams camWide camMid camSofa camKitchen camBed camWindow camDoor camTV. `set.tv`, wall clock.
* **Hospital** (ward north, corridor south, 16 m long; animated ECG monitors, TV): bed1-3 (on the bed), doctor1-3 (bedside, facing bed), family1-2, nurse1-2 (foot of bed), nurseStation, wardDoor, wardEntry, corridorW, corridorE, corridor, gurney, exit, window, tv · cams camWide camMid camBed1 camBed2 camMonitor camWard camCorridor camCorridorRev camNurse camDoor. `set.ecg`, `set.tv`.
* **Pharmacy** (botika): pharmacist, pharmacist2, customer, customer2, customer3, queue, aisle1-3, register, door, window, bp, waiting, shelf · cams camWide camMid camCounter camPharmacist camCustomer camAisle camDoor camShelf.
* **Courtroom** (PH RTC): judge (on the bench dais), witness, counsel1 (left table), counsel2, counsel1b, counsel2b, podium, approach, clerk, stenographer, bailiff, gallery1-4 (seated, facing the bench), door, aisle, gate · cams camWide camMid camJudge camWitness camCounsel1 camCounsel2 camGallery camBench camRear.
* **LawOffice**: lawyer (behind desk, facing client chairs), lawyerStand, client1, client2, sofa, shelf, window, door, diplomas · cams camWide camMid camDesk camClient camWindow camShelf camDoor.

## Notes / limits
* Sets are backdrops: no people or vehicles (jeepneys use the bay anchors). Window views are lit skyline planes; time-of-day is fixed per set (day / dusk), wall clocks run.
* Sanctuary draws ~370 calls; use `setMode` to render only the half in shot. Shadows are not cast by the sanctuary exterior (`castShadow:false`).
* The kit materials need `K.cloth` only with sway materials (`defMat(..., {sway})`) — mixing sway geometry with non-sway materials breaks merging.
