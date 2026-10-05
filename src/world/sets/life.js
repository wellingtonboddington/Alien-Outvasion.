// Everyday-life sets. See docs/api/sets_life.md
// Every factory returns { root, update(dt,t), dispose(), bounds, anchors, screens?, lights? } (createSanctuary additionally { exterior, interior }).
// All sets expose the contract cameras 'camWide' and 'camMid' (aliases are added here for the older sets).
import { createMorgue as _morgue } from './life/morgue.js';
import { createMallInterior as _mall } from './life/mall.js';
import { createFoodCourtMcD as _mcd, createMcDCalifornia as _mcdCa } from './life/restaurant.js';
import { createBar as _bar } from './life/bar.js';
import { createJeepneyTerminal } from './life/terminal.js';
import { createSanctuary } from './life/sanctuary.js';
import { createApartment, createHospital, createPharmacy, createCourtroom, createLawOffice } from './life/rooms.js';
const withMid = (make, from) => (opts) => { const s = make(opts); const a = s.anchors; if (!a.camMid && a[from]) a.camMid = { ...a[from] }; if (!a.camWide) a.camWide = { ...Object.values(a).find((v) => v.look) }; return s; };
export const createMorgue = withMid(_morgue, 'camTable');
export const createMallInterior = withMid(_mall, 'camEscalator');
export const createFoodCourtMcD = withMid(_mcd, 'camCounter');
export const createMcDCalifornia = withMid(_mcdCa, 'camCounter');
export const createBar = withMid(_bar, 'camBar');
export { createJeepneyTerminal, createSanctuary, createApartment, createHospital, createPharmacy, createCourtroom, createLawOffice };
export { IN_Y as SANCTUARY_INTERIOR_Y, eenLogo } from './life/sanctuary.js';
