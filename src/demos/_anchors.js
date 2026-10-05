// Dev probe: instantiate every set factory and log bounds/anchors/screens (read with --verbose 1).
import * as L from '../world/sets/life.js';
import * as I from '../world/sets/institutional.js';
export default async function setup(stage) {
  const list = [['morgue', () => L.createMorgue()], ['mall', () => L.createMallInterior()], ['mcd', () => L.createFoodCourtMcD()], ['mcdCal', () => L.createMcDCalifornia()],
    ['news', () => I.createNewsStudio()], ['war', () => I.createWarRoom()], ['un', () => I.createUNHall()], ['obs', () => I.createObservatory()], ['mission', () => I.createMissionControl()],
    ['lab_bsl4', () => I.createLab('bsl4')], ['dc', () => I.createDataCenter()], ['bunker', () => I.createBunker()], ['cmd', () => I.createCommandPost()], ['launch', () => I.createLaunchSite()], ['silo', () => I.createSiloControl()],
    ['alien_corridor', () => I.createAlienInterior('corridor')], ['alien_bridge', () => I.createAlienInterior('bridge')], ['alien_hatchery', () => I.createAlienInterior('hatchery')], ['alien_hold', () => I.createAlienInterior('hold')]];
  for (const [n, f] of list) {
    try { const s = f(); const a = s.anchors ? Object.keys(s.anchors).map((k) => { const v = s.anchors[k]; const p = v.pos || v; return `${k}(${p.map((x) => +x.toFixed(1)).join(',')};${(v.yaw || 0).toFixed(1)})`; }).join(' ') : 'NO ANCHORS'; console.log(`SET ${n} bounds=${JSON.stringify(s.bounds)} screens=${(s.screens || []).map((x) => x.name).join(',')}\n   ${a}`); }
    catch (e) { console.log(`SET ${n} FAILED: ${e.message}`); }
  }
  return { update() {}, shots: [{ name: 'x', t: 0 }] };
}
