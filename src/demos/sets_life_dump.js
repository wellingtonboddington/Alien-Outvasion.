// utility: constructs every life set, warns (console.warn) anchor names + tri/draw stats. Used to build docs/api/sets_life.md.
import * as L from '../world/sets/life.js';
export default async function setup(stage) {
  const names = ['createMorgue', 'createMallInterior', 'createFoodCourtMcD', 'createMcDCalifornia', 'createBar', 'createJeepneyTerminal', 'createSanctuary', 'createApartment', 'createHospital', 'createPharmacy', 'createCourtroom', 'createLawOffice'];
  for (const n of names) { const s = L[n](); const st = s.stats ? s.stats() : {}; console.warn('DUMP ' + n + ' ' + JSON.stringify({ tris: st.tris, draws: st.draws, bounds: s.bounds, anchors: Object.keys(s.anchors).join(','), screens: (s.screens || []).length })); s.update(1 / 30, 0.5); s.dispose(); }
  return { update() { }, shots: [{ name: 'x', t: 0, cam: [0, 1, 5, 0, 1, 0] }] };
}
