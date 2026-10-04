// Shared wind + weather state for vegetation (and sky cloud drift). Plain module-level state so the director can call setWind() once.
import * as THREE from 'three';
import { GLOBAL } from '../../engine/common.js';

const WIND = { strength: 0.45, dir: 0.6, gust: 0.5 };
/** Uniforms consumed by vegetation / terrain shaders (shared object, never reallocated). */
export const envUniforms = {
  uTime: GLOBAL.time,
  uWindDir: { value: new THREE.Vector2(Math.cos(WIND.dir), Math.sin(WIND.dir)) },
  uWindStrength: { value: WIND.strength },
  uGust: { value: WIND.gust },
  uSnow: { value: 0 },
};
/** strength 0 (calm) .. 1 (strong) .. 2 (storm); dirRad = direction the wind blows toward in the XZ plane (x=cos, z=sin). */
export function setWind(strength, dirRad = WIND.dir, gust = WIND.gust) {
  WIND.strength = strength; WIND.dir = dirRad; WIND.gust = gust;
  envUniforms.uWindStrength.value = strength; envUniforms.uWindDir.value.set(Math.cos(dirRad), Math.sin(dirRad)); envUniforms.uGust.value = gust;
}
export const getWind = () => WIND;
/** Global snow dusting amount 0..1 for vegetation + terrain materials. */
export function setSnow(a) { envUniforms.uSnow.value = a; }
