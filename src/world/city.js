// ALIEN OUTVASION — cities, landmarks, streets & destruction (CONTRACT §3.7). Full API documented in docs/api/city.md
// Everything is procedural (canvas textures + merged geometry); a district is ~25-40 draw calls.
export { createCityBlock } from './city/block.js';
export { createStreet, createBuilding, createLampPost, createUtilityPole, createTrafficLight, createBench, createBollard, createSign, createBarricade, createSandbagWall, createTent, createCheckpoint, createKiosk, createBusShelter, createTree, createParkedCars } from './city/objects.js';
export { createSkyline } from './city/skyline.js';
export { createLandmark, LANDMARK_NAMES } from './city/landmarks.js';
export { damageCity, createRuins, createRubble, createBurningBuilding, createCrater, createWreck, createCollapsedOverpass, createToppledBridge } from './city/destruction.js';
export { STYLE_NAMES } from './city/styles.js';
