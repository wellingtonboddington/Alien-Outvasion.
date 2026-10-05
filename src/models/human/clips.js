// Clip registry: merges all clip libraries. Every name of CONTRACT §3.1 is present; unknown names fall back to idle in Animator.play.
import { BASIC } from './clips_basic.js';
import { ACTION } from './clips_action.js';
export const CLIPS = { ...BASIC, ...ACTION };
export const CLIP_NAMES = Object.keys(CLIPS);
