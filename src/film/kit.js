// Film kit: thin helpers that turn asset modules into scene content. Scenes (src/film/act*.js) only talk to this file.
import * as THREE from 'three';
import { clamp, lerp, RNG, hashStr, Q } from '../engine/common.js';
import { createSky } from '../world/sky.js';
import { createHuman, MAIN_CAST, createNPC } from '../models/human/index.js';
import { createVessari } from '../models/aliens/index.js';
import * as City from '../world/city.js';
import * as Life from '../world/sets/life.js';
import * as Inst from '../world/sets/institutional.js';

const V3 = THREE.Vector3;
export const CAST = {
  mirrah: { name: 'MIRRAH', color: '#ff9fd0', role: 'Forensic pathologist', age: 19 },
  bead: { name: 'BEAD', color: '#6fe3ff', role: 'Founder, EEN Robotics', age: 20 },
  jez: { name: 'JEZ', color: '#ffd36e', role: 'Historian', age: 21 },
  stephen: { name: 'STEPHEN', color: '#ff8a6b', role: 'Crew member', age: 19 },
  ezra: { name: 'EZRA', color: '#c3a2ff', role: 'Crew member', age: 19 },
  sam: { name: 'SAM', color: '#ffb061', role: 'Jeepney driver', age: 19 },
  jhaz: { name: 'JHAZ', color: '#7ab8ff', role: 'Jeepney driver', age: 19 },
  leon: { name: 'LEON', color: '#ff7088', role: 'Bartender & owner', age: 19 },
  epiphany: { name: 'EPIPHANY', color: '#f2e3a0', role: 'Lawyer', age: 19 },
};
export const COL = { alien: '#aef3ff', radio: '#ffd9a0', ai: '#9ff0ff', news: '#ffffff', mil: '#c9d6a3', sci: '#d4e6ff', npc: '#e8ecf5' };

/** safe factory: returns null (and logs once) instead of breaking the scene */
const warned = new Set();
export function safe(label, fn) { try { return fn(); } catch (e) { if (!warned.has(label)) { warned.add(label); console.error('[kit]', label, e && e.message); } return null; } }

// ---------------- lighting / world ----------------
/** Sky + lights for an exterior scene. Returns sky. focusFn: () => Vector3 for shadows (default camera target). */
export function skyFor(S, preset = 'day', opts = {}) {
  const sky = createSky(preset, opts); sky.applyTo(S.scene); S.modules.push(sky); S.sky = sky;
  if (opts.elev !== undefined) sky.setSunAngle(opts.elev, opts.az ?? 40);
  if (opts.storm) sky.setStorm(opts.storm); if (opts.smoke) sky.setSmoke(opts.smoke);
  S.updaters.push({ t0: 0, t1: S.duration, fn: () => sky.setShadowFocus(S.cam.target, opts.shadowRadius || 70) });
  return sky;
}
/** soft ambient for interiors (sets carry their own practical lights) */
export function indoors(S, { color = 0xbfd0ff, ground = 0x303038, intensity = 0.9, bg = 0x05070a } = {}) {
  S.scene.background = new THREE.Color(bg); S.scene.add(new THREE.HemisphereLight(color, ground, intensity));
}
/** add a set / module (optionally positioned) and return helpers for anchors */
export function place(S, mod, pos = [0, 0, 0], yaw = 0) {
  const m = S.add(mod); const r = mod.root; r.position.set(pos[0], pos[1], pos[2]); r.rotation.y = yaw; return mod;
}
/** world-space anchor: {p:[x,y,z], yaw} */
export function A(set, name) {
  const a = set.anchors && set.anchors[name]; if (!a) { return { p: [0, 0, 0], yaw: 0 }; }
  const q = a.pos || a; const r = set.root || { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } }; const c = Math.cos(r.rotation.y), s = Math.sin(r.rotation.y);
  return { p: [r.position.x + q[0] * c + q[2] * s, r.position.y + q[1], r.position.z - q[0] * s + q[2] * c], yaw: (a.yaw || 0) + r.rotation.y };
}
export function bounds(set, pad = 0.45) {
  const b = set.bounds || { w: 10, d: 10, h: 3 }; const r = set.root ? set.root.position : { x: 0, y: 0, z: 0 };
  return { min: [r.x - b.w / 2 + pad, r.y + 0.3, r.z - b.d / 2 + pad], max: [r.x + b.w / 2 - pad, r.y + (b.h || 3) - 0.3, r.z + b.d / 2 - pad] };
}

// ---------------- actors ----------------
/** a main-cast hero as an Actor */
export function person(S, key, o = {}) {
  const c = CAST[key]; const h = createHuman(MAIN_CAST[key], o.model || {}); const a = S.actor(h, { name: c.name, id: key, color: c.color, height: MAIN_CAST[key].height / 100 || undefined, ...o }); return a;
}
/** a supporting character (NPC) as an Actor. name/color are for subtitles. */
export function extra(S, kind, seed, o = {}) {
  const h = createNPC(kind, seed, o.npc || {}); const a = S.actor(h, { name: (o.name || kind).toUpperCase(), id: o.id || ('npc' + seed), color: o.color || COL.npc, ...o }); return a;
}
/** an alien hero as an Actor: kind soldier|officer|drone|hierarch */
export function alien(S, kind = 'soldier', seed = 1, o = {}) {
  const h = createVessari(kind, seed, o.model || {}); const names = { hierarch: 'THE HIERARCH', officer: o.name || 'WARLORD THESSIK', soldier: o.name || 'VESSARI', drone: o.name || 'KUUR' };
  return S.actor(h, { name: names[kind] || 'VESSARI', id: o.id || ('alien_' + kind + seed), color: COL.alien, alien: true, height: { hierarch: 2.9, officer: 2.7, soldier: 2.6, drone: 2.2 }[kind], ...o });
}
/** place an actor on a set anchor (at time t0 default 0) */
export function at(actor, set, anchor, clip = 'idle', o = {}) { const a = A(set, anchor); actor.place(o.t ?? 0, a.p, o.yaw ?? a.yaw, clip, o); return actor; }
export function nameCard(S, t, key, dur = 4) { const c = CAST[key]; S.nameCard(t, c.name, c.role, c.age, c.color, dur); }

// ---------------- scene scaffolds ----------------
/** standard dialogue scene tail: coverage between t0..t1 with set bounds */
export function cover(S, set, t0, t1, o = {}) { S.setBounds && S.setBounds(...(() => { const b = bounds(set); return [b.min, b.max]; })()); return S.cover(t0, t1, { bounds: bounds(set), ...o }); }
/** ambient light + music + amb bed shorthands */
export function mood(S, { music, amb, level = 0.5, intensity = 0.5, fade = 2, t = 0 } = {}) { if (music) S.music(t, music, { intensity, fade }); if (amb) S.amb(t, amb, level, fade); }

/** screen drawing helper for set screens: set.screens find by name */
export function screen(set, name) { return (set.screens || []).find((s) => s.name === name); }
export function news(S, set, name, draw, fps = 12) { const sc = screen(set, name); if (sc && sc.setCanvas) sc.setCanvas(draw, { fps }); return sc; }

export { City, Life, Inst, createSky, createHuman, MAIN_CAST, createNPC, createVessari, V3, RNG, hashStr, clamp, lerp, Q };
