// The film: ordered list of scene definitions {id, dur, build(S)}. Total runtime = sum of durations (target ~1800 s).
import { ACT1 } from './act1.js';
import { ACT2 } from './act2.js';
import { ACT3 } from './act3.js';
import { ACT4 } from './act4.js';
export const FILM = [...ACT1, ...ACT2, ...ACT3, ...ACT4];
