// ALIEN OUTVASION — human machines & robots (CONTRACT §3.5). Entry point; implementation lives in ./vehicles/*.
export { createJeepney, JEEPNEY_PALETTES, JEEPNEY_NAMES } from './vehicles/jeepney.js';
export { createEenbot } from './vehicles/eenbot.js';
export { createCar, CAR_PAINTS } from './vehicles/civil.js';
export { createBus, createTruck, createMotorbike, createTricycle, createCarPark } from './vehicles/civil2.js';
export { createTank, createAPC, createHumvee, createLauncher, createHowitzer, createAntiAir } from './vehicles/military.js';
export { createJet, createHelicopter, createMissile, createSatellite, createSpaceStation, createWarship } from './vehicles/air.js';
