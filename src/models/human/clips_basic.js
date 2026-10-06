// Procedural clips, part 1: idles, locomotion (IK gait), talking, social/emotion, seated.
// Sign conventions (see PoseBuilder): arm raise + = forward/up, abd + = outward, elbow + = flex, pron + = palm down, spine pitch + = lean forward, head pitch + = look down, yaw + = to character's left.
import * as THREE from 'three';
import { sn, wave, ease, lerpn, fkPos, fkQuat } from './anim_core.js';
import { clamp, smoothstep } from '../../engine/common.js';

const sm = (a, b, x) => smoothstep(a, b, x);
export const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const seedOf = (h) => (h.profile.seed % 997) * 0.173;
const TAU = Math.PI * 2;
const mixo = (a, b, t) => { const o = {}; for (const k in a) o[k] = (a[k] ?? 0) + ((b[k] ?? a[k] ?? 0) - (a[k] ?? 0)) * t; for (const k in b) if (!(k in a)) o[k] = (b[k]) * t; return o; };
const fract = (x) => x - Math.floor(x);

export function relaxedArm(B, t, sd, amt = 1) {
  const sway = sn(t * 0.5, sd);
  const abd = -B.D.armAbd * 0.5;
  return { raise: 0.05 + 0.02 * sway, abd: abd + 0.02 * sn(t * 0.3, sd + 2), rot: 0.12, elbow: 0.2 + 0.03 * sway, pron: 0.25, wflex: 0.05 };
}
export function stand(B, { gap = 0, yaw = 0.07, zL = 0, zR = 0, lim = 0.997, drop = 0 } = {}) {
  B.hipsMode = 'plant'; B.hipsLimit = lim; B.hipsDrop = drop;
  B.footIK('L', gap, 0, zL, yaw, 0, 0, true); B.footIK('R', -gap, 0, zR, -yaw, 0, 0, true);
}

// ----------------------------------------------------------------------------------------------- idle family
function idleCore(B, t, p, h, o = {}) {
  const sd = seedOf(h), E = h.energy || 0;
  const shift = sn(t * 0.23, sd) * 0.6 + wave(t, 0.11, sd) * 0.4;           // slow weight shift
  const sx = shift * 0.018 * (o.shift ?? 1);
  stand(B, { gap: 0.005 * (h.profile.build.belly > 0.3 ? 4 : 0) + (h.profile.build.muscle > 0.6 ? 0.012 : 0), yaw: 0.08 + (h.profile.isFemale ? -0.03 : 0), lim: 0.996 - 0.01 * Math.abs(shift) });
  B.hips(sx, 0, 0);
  B.hipsRot(0.0 + 0.01 * sn(t * 0.3, sd + 1), 0.025 * sn(t * 0.2, sd + 4), -sx * 1.3);
  const lean = (o.lean ?? 0.02) + 0.01 * sn(t * 0.25, sd + 8);
  B.spine(lean, -0.02 * sn(t * 0.2, sd + 4), sx * 0.9);
  B.head(-0.015 + 0.012 * sn(t * 0.3, sd + 6) + (o.headPitch || 0), 0.03 * sn(t * 0.17, sd + 9) + (o.headYaw || 0), -sx * 0.5);
  B.shoulder('L', 0.0, 0); B.shoulder('R', 0.0, 0);
  const ra = relaxedArm(B, t, sd);
  return ra;
}
const idle = (B, t, p, h) => {
  const ra = idleCore(B, t, p, h);
  const belly = h.profile.build.belly > 0.3 || h.profile.build.muscle > 0.7;
  const a2 = belly ? { ...ra, abd: ra.abd + 0.1 } : ra;
  B.arm('L', a2); B.arm('R', { ...a2, raise: a2.raise + 0.01 * sn(t, 1) });
};
const idle_arms_crossed = (B, t, p, h) => {
  idleCore(B, t, p, h, { lean: 0.03 });
  const b = Math.sin(t * 1.4) * 0.01;
  B.arm('L', { raise: 0.55, abd: -0.45, rot: 0.4, elbow: 2.25, pron: 0.7, wflex: 0.1 });
  B.arm('R', { raise: 0.62, abd: -0.5, rot: 0.4, elbow: 2.3, pron: 0.6, wflex: 0.1 });
  B.fingers('L', 'relaxed'); B.fingers('R', 'relaxed');
  B.add('chest', b);
};
const idle_hands_hips = (B, t, p, h) => {
  idleCore(B, t, p, h, { lean: 0.0, shift: 1.4 });
  const sd = seedOf(h);
  B.arm('L', { raise: -0.2, abd: 0.55, rot: 0.6, elbow: 1.5, pron: 0.9, wflex: -0.2, wdev: 0.0 });
  B.arm('R', { raise: -0.2, abd: 0.55, rot: 0.6, elbow: 1.5, pron: 0.9, wflex: -0.2, wdev: 0.0 });
  B.fingers('L', 'relaxed'); B.fingers('R', 'relaxed');
  B.head(0.0, 0.1 * sn(t * 0.3, sd), 0.03 * sn(t * 0.2, sd + 1));
};
const idle_phone = (B, t, p, h) => {
  const ra = idleCore(B, t, p, h, { lean: 0.07, headPitch: 0.42 });
  const sd = seedOf(h);
  B.arm('L', ra);
  B.arm('R', { raise: 0.7, abd: -0.2, rot: 0.2, elbow: 1.85, pron: 0.5, wflex: 0.1 });
  B.fingers('R', 'hold_phone');
  B.spine(0.1, 0, 0);
  const th = 1.3 * t; B.add('handR', 0, 0, 0); // typing thumb micro-motion
  B.add('thumbR3', 0, 0, -0.1 * Math.abs(Math.sin(th * 2.7)));
};
const listen = (B, t, p, h) => {
  const sd = seedOf(h);
  const ra = idleCore(B, t, p, h, { lean: 0.035, headPitch: 0.02 });
  // nods and head tilt
  const nod = Math.max(0, Math.sin(t * 1.9 + sd) * Math.sin(t * 0.37 + sd * 2)) * 0.09;
  B.head(0.02 + nod, 0.02 * sn(t * 0.2, sd), -0.08 + 0.03 * sn(t * 0.2, sd + 2));
  B.arm('L', ra); B.arm('R', { ...ra, raise: ra.raise + 0.05 });
};

// ----------------------------------------------------------------------------------------------- locomotion
export function gait(B, t, h, G) {
  const D = B.D, sd = seedOf(h);
  const Lleg = D.thigh + D.shin, v = G.v;
  const sc = Math.sqrt(0.9 / Lleg);
  const steps = (G.cad0 + G.cad1 * v) * sc * (G.cadK || 1);
  const f = steps / 2, sf = G.sf, fl = D.footLen / 0.266;
  const L = v * sf / f;
  const ph0 = G.phase || 0;
  const legs = {};
  for (const S of ['L', 'R']) {
    const u = fract(f * t + ph0 + (S === 'R' ? 0.5 : 0)); legs[S] = u;
    let z, dy, pitch, plant = false, yaw = G.toeOut ?? 0.08, x = 0;
    const toeOff = G.toeOff ?? 0.55;
    if (u < sf) {
      const s = u / sf; plant = true;
      const zc = L / 2 * (1 - 2 * s);
      const off = lerpn(G.heel ?? 0.07, -(G.ball ?? 0.115), sm(0.08, 0.92, s)) * fl;
      z = zc + off;
      pitch = s < 0.14 ? lerpn(-(G.heelUp ?? 0.17), 0, s / 0.14) : s < 0.68 ? 0 : lerpn(0, toeOff, ease((s - 0.68) / 0.32));
      dy = (pitch > 0 ? 0.13 : 0.075) * Math.abs(Math.sin(pitch)) * fl;
      if (G.run && s > 0.1 && s < 0.9) { dy = 0.02 * fl; }
    } else {
      const sg = (u - sf) / (1 - sf);
      const z0 = -L / 2 - (G.ball ?? 0.115) * fl, z1 = L / 2 + (G.heel ?? 0.07) * fl;
      const e = G.run ? (0.5 - 0.5 * Math.cos(Math.PI * Math.pow(sg, 0.85))) : (0.5 - 0.5 * Math.cos(Math.PI * Math.pow(sg, 0.9)));
      z = lerpn(z0, z1, e);
      const dyTo = 0.13 * Math.sin(toeOff) * fl;
      dy = dyTo * Math.pow(1 - sg, 3) + (G.lift ?? 0.07) * Math.pow(Math.sin(Math.PI * Math.pow(sg, 0.8)), 1.1);
      if (G.run) dy += 0.05 * Math.sin(Math.PI * sg);
      pitch = lerpn(toeOff, -(G.heelUp ?? 0.17), sm(0.0, 0.85, sg));
      x = -(S === 'L' ? 1 : -1) * 0.012 * Math.sin(Math.PI * sg) * (G.run ? 0.5 : 1); // slight outward arc... (inward circumduction)
    }
    const knee = G.kneeFlex || 0;
    B.footIK(S, (S === 'L' ? 1 : -1) * ((G.gap || 0) + (G.crossover || 0) * 0) + x, dy, z, yaw * (S === 'L' ? 1 : -1) * 0 + (S === 'L' ? yaw : -yaw), pitch, plant ? -pitch * 0.9 : -0.2 * Math.max(0, pitch) , plant);
  }
  B.hipsMode = 'plant'; B.hipsLimit = G.limit ?? 0.975; B.hipsDrop = G.drop ?? 0.012; B.hipsMax = 0.02;
  if (G.run) { // flight: hips float higher when neither foot is planted
    const anyPlant = legs.L < sf || legs.R < sf;
    B.hipsLift = 0;
  }
  const ph = f * t + ph0;
  const amp = Math.min(1.3, 0.55 + 0.45 * v / 1.4) * (G.amp ?? 1);
  // pelvis / spine
  const stepPhase = TAU * ph;
  const swayX = Math.sin(stepPhase) * (G.sway ?? 0.018);
  B.hips(swayX, 0, 0);
  B.hipsRot(0.03 + (G.lean || 0) * 0.35, -Math.sin(stepPhase + 0.0) * (G.hipTwist ?? 0.12) * amp, Math.sin(stepPhase) * (G.hipRoll ?? 0.04));
  B.spine((G.lean ?? 0.04), Math.sin(stepPhase) * (G.shTwist ?? 0.16) * amp, -Math.sin(stepPhase) * 0.03);
  B.head(-(G.lean ?? 0.04) * 0.7 + (G.headPitch || 0), -Math.sin(stepPhase) * 0.05 + 0.04 * sn(t * 0.4, sd), 0.02 * Math.sin(stepPhase));
  // arms
  if (!G.noArms) {
    const aS = G.armSwing ?? 0.42, el = G.elbow ?? 0.25, el2 = G.elbowSwing ?? 0.3;
    for (const S of ['L', 'R']) {
      const opp = fract(f * t + ph0 + (S === 'R' ? 0 : 0.5)); // arm swings with the opposite leg
      const c = Math.cos(TAU * opp);
      const sgn = S === 'L' ? 1 : -1;
      B.arm(S, { raise: c * aS * amp + (G.armRaise || 0), abd: -B.D.armAbd * (G.armIn ?? 0.45) + (G.armOut || 0) - Math.abs(c) * 0.02, rot: 0.1, elbow: el + el2 * Math.max(0, c) * amp + (G.elbowAdd || 0), pron: 0.35, wflex: 0.05 });
    }
    B.fingers('L', G.hand || 'relaxed'); B.fingers('R', G.hand || 'relaxed');
  }
  return { f, L, u: legs };
}
const WALK = { cad0: 1.35, cad1: 0.42, sf: 0.62, lift: 0.07, lean: 0.035, armSwing: 0.4, elbow: 0.22, elbowSwing: 0.25, toeOff: 0.55, drop: 0.012, limit: 0.975 };
const walk = (B, t, p, h) => { gait(B, t, h, { ...WALK, v: p.speed ?? 1.35 }); };
const walk_tired = (B, t, p, h) => {
  const v = p.speed ?? 0.95;
  gait(B, t, h, { ...WALK, v, cad0: 1.1, cad1: 0.5, lift: 0.035, lean: 0.11, armSwing: 0.16, elbow: 0.2, elbowSwing: 0.1, toeOff: 0.35, drop: 0.02, limit: 0.96, headPitch: 0.3, sway: 0.028, hipTwist: 0.07, shTwist: 0.08, heelUp: 0.08, armIn: 0.3 });
  B.spine(0.14, 0, 0); B.head(0.34 + 0.04 * sn(t * 0.6, 1), 0.05 * sn(t * 0.3, 2), 0.06);
};
const JOG = { cad0: 2.15, cad1: 0.17, sf: 0.46, lift: 0.1, lean: 0.11, armSwing: 0.55, elbow: 1.15, elbowSwing: 0.25, toeOff: 0.6, drop: 0.03, limit: 0.95, heel: 0.03, ball: 0.1, heelUp: 0.08, hipTwist: 0.1, shTwist: 0.2, run: true };
const jog = (B, t, p, h) => { gait(B, t, h, { ...JOG, v: p.speed ?? 2.6 }); };
const RUN = { cad0: 2.4, cad1: 0.2, sf: 0.37, lift: 0.14, lean: 0.17, armSwing: 0.7, elbow: 1.3, elbowSwing: 0.3, toeOff: 0.75, drop: 0.045, limit: 0.93, heel: 0.0, ball: 0.09, heelUp: 0.02, hipTwist: 0.13, shTwist: 0.28, run: true, sway: 0.02, hand: 'fist' };
const run = (B, t, p, h) => { gait(B, t, h, { ...RUN, v: p.speed ?? 4.2 }); B.fingers('L', 'relaxed'); B.fingers('R', 'relaxed'); };
const SPR = { cad0: 3.0, cad1: 0.2, sf: 0.3, lift: 0.19, lean: 0.3, armSwing: 0.95, elbow: 1.45, elbowSwing: 0.2, toeOff: 0.9, drop: 0.06, limit: 0.9, heel: -0.02, ball: 0.08, heelUp: 0.0, hipTwist: 0.16, shTwist: 0.34, run: true, sway: 0.02, kneeFlex: 0.2 };
const sprint = (B, t, p, h) => { gait(B, t, h, { ...SPR, v: p.speed ?? 6.8 }); };
const crouch_walk = (B, t, p, h) => {
  const g = gait(B, t, h, { ...WALK, v: p.speed ?? 0.9, cad0: 1.2, cad1: 0.55, limit: 0.72, lean: 0.38, lift: 0.07, armSwing: 0.12, elbow: 0.7, elbowSwing: 0.1, hipTwist: 0.08, shTwist: 0.1, drop: 0.0, headPitch: -0.28, armIn: 0.2, armRaise: 0.15, toeOff: 0.4 });
  B.spine(0.42, 0, 0); B.head(-0.25, 0.1 * sn(t * 0.5, 3), 0);
};
const sneak = (B, t, p, h) => {
  gait(B, t, h, { ...WALK, v: p.speed ?? 0.55, cad0: 1.0, cad1: 0.45, limit: 0.84, lean: 0.14, lift: 0.1, armSwing: 0.08, elbow: 0.55, elbowSwing: 0.05, hipTwist: 0.06, shTwist: 0.08, drop: 0.0, headPitch: -0.1, armIn: 0.3, toeOff: 0.3, heel: 0.0, heelUp: 0.0 });
  B.head(-0.08, 0.35 * sn(t * 0.45, 4), 0.0);
};
const panic_run = (B, t, p, h) => {
  gait(B, t, h, { ...RUN, v: p.speed ?? 4.4, armSwing: 0.55, elbow: 0.5, elbowSwing: 0.5, lean: 0.12, shTwist: 0.32, sway: 0.03, armRaise: 0.5, armOut: 0.5, hand: 'claw', headPitch: -0.1, drop: 0.04 });
  B.head(-0.1, 0.5 * sn(t * 1.3, 5), 0.1 * sn(t * 2, 6));
};

// ----------------------------------------------------------------------------------------------- talk gestures
const GEST = {
  open: { a: { raise: 0.66, abd: 0.12, rot: -0.35, elbow: 1.25, pron: -0.6, wflex: -0.1 }, hand: 'open', osc: 0.12 },
  openWide: { a: { raise: 0.5, abd: 0.62, rot: -0.45, elbow: 1.0, pron: -0.8, wflex: -0.15 }, hand: 'open', osc: 0.1 },
  chop: { a: { raise: 0.7, abd: 0.0, rot: 0.05, elbow: 1.05, pron: 0.25, wflex: 0.1 }, hand: 'flat', osc: 0.3 },
  point: { a: { raise: 0.98, abd: 0.12, rot: 0.0, elbow: 0.4, pron: 0.5, wflex: 0 }, hand: 'point', osc: 0.12 },
  emph: { a: { raise: 0.42, abd: 0.02, rot: 0.3, elbow: 1.9, pron: 0.3, wflex: 0.25 }, hand: 'fist', osc: 0.1 },
  palmdown: { a: { raise: 0.55, abd: 0.22, rot: 0.2, elbow: 0.95, pron: 1.0, wflex: 0.1 }, hand: 'flat', osc: 0.18 },
  shrug: { a: { raise: 0.3, abd: 0.4, rot: -0.3, elbow: 1.4, pron: -0.5, wflex: -0.1 }, hand: 'open', osc: 0.04 },
};
function beatState(t, o) {
  const per = o.period, k = Math.floor(t / per), tau = t - k * per;
  const j = hash(k * 7.7 + o.seed) * per * 0.2;
  const pick = hash(k * 3.1 + o.seed * 2.3);
  if (hash(k * 5.3 + o.seed * 1.7) > o.prob) return { k, e: 0, x: 0, pick };
  const x = clamp((tau - j) / o.dur, 0, 1);
  const e = x <= 0 || x >= 1 ? 0 : Math.pow(Math.sin(Math.PI * x), 0.7) * (x < 0.5 ? 1 : 1);
  return { k, e: x >= 1 ? 0 : (x < 0.3 ? ease(x / 0.3) : x < 0.65 ? 1 : 1 - ease((x - 0.65) / 0.35)), x, pick };
}
function talkCore(B, t, p, h, cfg) {
  const sd = seedOf(h), E = clamp(h.energy ?? 0.5, 0, 1);
  const style = h.talkStyle || 'calm';
  const stK = { calm: 1, excited: 1.45, angry: 1.25, afraid: 0.8, sad: 0.5 }[style] || 1;
  const en = clamp(E * stK, 0, 1.4);
  const ra = idleCore(B, t, p, h, { lean: cfg.lean ?? 0.025, shift: 1.2 });
  // fixed beat period per style (a period that follows energy re-quantises the beat grid every frame -> flailing)
  const per = ({ calm: 1.45, excited: 1.15, angry: 1.2, afraid: 1.35, sad: 1.8 }[style] || 1.45) * (cfg.periodK || 1);
  const prob = clamp(0.3 + en * 0.45, 0, 0.85) * (cfg.probK || 1);
  // gesture per hand
  const sides = [['R', cfg.rightBias ?? 1], ['L', cfg.leftBias ?? 0.45]];
  for (const [S, bias] of sides) {
    const bs = beatState(t + (S === 'L' ? 0.37 : 0), { period: per * (S === 'L' ? 1.31 : 1), dur: per * 0.7, prob: prob * bias, seed: sd + (S === 'L' ? 11 : 0) });
    let base = cfg.rest?.[S] ? cfg.rest[S](B, t, ra) : ra;
    if (bs.e > 0.001) {
      const list = S === 'R' ? cfg.listR : cfg.listL; const g = GEST[list[Math.floor(bs.pick * list.length) % list.length]];
      const osc = Math.sin(bs.x * Math.PI * 2 * 1.4) * g.osc * (0.6 + en * 0.4) * 0.35;
      const a = { ...g.a, raise: g.a.raise + osc, elbow: g.a.elbow - osc * 0.6 };
      const amt = bs.e * clamp(0.45 + en * 0.4, 0.35, 0.85);
      B.arm(S, mixo(base, a, amt)); B.fingers(S, g.hand, bs.e > 0.2 ? 1 : 0);
      if (g.hand === 'point') B.fingers(S, 'point', 1);
      // body response: torso twist & shoulder lift on beat
      B.add('chest', 0, 0, 0); B.shoulder(S, 0.05 * bs.e, 0.0);
      B.extra['beat' + S] = bs.e;
    } else { B.arm(S, base); if (cfg.restHand?.[S]) B.fingers(S, cfg.restHand[S]); }
  }
  const be = Math.max(B.extra.beatR || 0, B.extra.beatL || 0);
  // head nods / sways with speech
  const nodPhase = Math.sin(t * (2.4 + en) + sd) * 0.5 + 0.5;
  B.head(0.0 + 0.045 * be * (1 + en) + 0.02 * en * nodPhase + (cfg.headPitch || 0), 0.06 * sn(t * 0.6, sd + 20) * (0.5 + en), -0.05 * sn(t * 0.5, sd + 30) * (0.5 + en));
  B.spine(0.025 + 0.02 * be, 0.04 * sn(t * 0.4, sd + 7) * (0.5 + en), 0);
  B.extra.energyBeat = be;
  if (cfg.post) cfg.post(B, t, p, h, en);
}
const talk_a = (B, t, p, h) => talkCore(B, t, p, h, { listR: ['open', 'chop', 'openWide', 'palmdown', 'open'], listL: ['open', 'palmdown', 'emph'], rightBias: 1, leftBias: 0.35 });
const talk_b = (B, t, p, h) => talkCore(B, t, p, h, { listR: ['point', 'emph', 'openWide', 'chop', 'shrug', 'palmdown'], listL: ['openWide', 'emph', 'point', 'chop'], rightBias: 1, leftBias: 0.9, periodK: 0.85, probK: 1.1, lean: 0.04 });
const talk_c = (B, t, p, h) => talkCore(B, t, p, h, {
  listR: ['open', 'palmdown', 'open'], listL: ['palmdown'], rightBias: 0.55, leftBias: 0.15, periodK: 1.2, probK: 0.9, lean: 0.015,
  rest: {
    R: (B, t, ra) => ({ raise: 0.62 + 0.01 * sn(t, 1), abd: -0.2, rot: 0.3, elbow: 1.55, pron: 0.55, wflex: 0.05 }),
    L: (B, t, ra) => ({ raise: 0.6 + 0.01 * sn(t, 2), abd: -0.2, rot: 0.3, elbow: 1.6, pron: 0.5, wflex: 0.05 }),
  }, restHand: { L: 'relaxed', R: 'relaxed' },
  post: (B, t, p, h, en) => {
    // clasped hands in front: pull both wrists together
    const k = 1 - Math.max(B.extra.beatR || 0, B.extra.beatL || 0);
    if (k > 0.5) { B.arm('L', { raise: 0.6, abd: -0.32, rot: 0.35, elbow: 1.7, pron: 0.5, wflex: 0.1 }); B.arm('R', { raise: 0.6, abd: -0.32, rot: 0.35, elbow: 1.7, pron: 0.5, wflex: 0.1 }); }
  },
});

// ----------------------------------------------------------------------------------------------- reactions & emotion
const nod = (B, t, p, h) => { idleCore(B, t, p, h, {}); B.arm('L', relaxedArm(B, t, 1)); B.arm('R', relaxedArm(B, t, 2)); const c = Math.sin(t * TAU * 1.8) * 0.5 + 0.5; B.head(0.02 + 0.2 * c, 0, 0); B.spine(0.03 + 0.02 * c, 0, 0); };
const shake_head = (B, t, p, h) => { idleCore(B, t, p, h, {}); B.arm('L', relaxedArm(B, t, 1)); B.arm('R', relaxedArm(B, t, 2)); B.head(0.03, Math.sin(t * TAU * 2.1) * 0.36 * Math.exp(-0.0 * t), 0.03 * Math.sin(t * TAU * 2.1)); B.spine(0.02, Math.sin(t * TAU * 2.1) * 0.05, 0); };
const wave_clip = (B, t, p, h) => {
  idleCore(B, t, p, h, { lean: 0.0 });
  B.arm('L', relaxedArm(B, t, 3));
  const w = Math.sin(t * TAU * 1.9);
  B.arm('R', { raise: 2.5 + 0.0, abd: 0.55, rot: -0.2, elbow: 1.05 + 0.0, pron: -0.2, wflex: 0, wdev: 0.15 * w });
  B.add('foreArmR', 0, 0, -0.5 * w * -1);
  B.fingers('R', 'open'); B.head(0, 0.12, 0.08); B.spine(0, 0.03, 0.04);
};
const shrug = (B, t, p, h) => {
  idleCore(B, t, p, h, {});
  const c = Math.pow(Math.max(0, Math.sin((t % 2.6) / 2.6 * Math.PI)), 0.8);
  const a = GEST.shrug.a; const ra = relaxedArm(B, t, 4);
  B.arm('L', mixo(ra, a, c)); B.arm('R', mixo(ra, a, c)); B.fingers('L', 'open', c); B.fingers('R', 'open', c);
  B.shoulder('L', 0.32 * c); B.shoulder('R', 0.32 * c); B.head(0.0, 0, -0.14 * c); B.spine(-0.02 * c, 0, 0);
};
const shock = (B, t, p, h) => {
  const sd = seedOf(h); const c = ease(t / 0.18); const tr = Math.sin(t * 38) * 0.004;
  stand(B, { gap: 0.02, yaw: 0.1, zL: 0.1 * c, zR: -0.12 * c, lim: 0.98 });
  B.hips(0, 0.0, -0.05 * c); B.hipsRot(-0.1 * c, 0, 0); B.spine(-0.12 * c, 0, 0); B.head(-0.18 * c + tr * 3, 0, 0);
  B.arm('L', { raise: 1.1 * c, abd: 0.25 * c, rot: -0.2, elbow: 1.7 * c + 0.12, pron: 0.5, wflex: 0 }); B.arm('R', { raise: 1.15 * c, abd: 0.2 * c, rot: -0.2, elbow: 1.75 * c + 0.12, pron: 0.5, wflex: 0 });
  B.fingers('L', 'claw', c); B.fingers('R', 'claw', c); B.shoulder('L', 0.25 * c); B.shoulder('R', 0.25 * c);
};
const scared_idle = (B, t, p, h) => {
  const sd = seedOf(h); const tr = sn(t * 14, sd) * 0.012, tr2 = sn(t * 11, sd + 2) * 0.01;
  stand(B, { gap: 0.04, yaw: 0.14, lim: 0.93 });
  B.hips(0.01 * sn(t * 0.7, sd), 0, 0.02); B.hipsRot(0.0, 0.05 * sn(t * 0.5, sd), 0); B.spine(0.1 + tr, 0.06 * sn(t * 0.9, sd + 1), 0);
  B.head(-0.05 + tr2, 0.45 * sn(t * 0.9, sd + 3), 0.05 * sn(t * 0.7, sd + 4));
  B.arm('L', { raise: 0.75, abd: -0.2, rot: 0.2, elbow: 1.9 + tr, pron: 0.4, wflex: 0.1 }); B.arm('R', { raise: 0.8, abd: -0.2, rot: 0.2, elbow: 1.85 + tr2, pron: 0.4, wflex: 0.1 });
  B.fingers('L', 'claw', 0.7); B.fingers('R', 'claw', 0.7); B.shoulder('L', 0.3); B.shoulder('R', 0.3);
};
const hands_up = (B, t, p, h) => {
  stand(B, { gap: 0.03, yaw: 0.1, lim: 0.99 });
  const tr = sn(t * 10, 1) * 0.01;
  B.spine(-0.02, 0, 0); B.head(0.0 + 0.05, 0.1 * sn(t * 0.4, 1), 0); B.shoulder('L', 0.1); B.shoulder('R', 0.1);
  B.arm('L', { raise: 2.6 + tr, abd: 0.3, rot: -0.5, elbow: 0.65, pron: -0.2, wflex: -0.1 }); B.arm('R', { raise: 2.6 - tr, abd: 0.3, rot: -0.5, elbow: 0.65, pron: -0.2, wflex: -0.1 });
  B.fingers('L', 'open'); B.fingers('R', 'open');
};
const salute = (B, t, p, h) => {
  stand(B, { gap: 0.025, yaw: 0.2, lim: 0.998 }); B.spine(-0.03, 0, 0); B.head(-0.03, 0, 0);
  B.arm('L', { raise: 0.0, abd: -B.D.armAbd * 0.8, rot: 0.2, elbow: 0.12, pron: 0.5, wflex: 0 }); B.fingers('L', 'flat');
  B.arm('R', { raise: 1.35, abd: 0.95, rot: -0.2, elbow: 2.15, pron: 0.9, wflex: 0.0 }); B.fingers('R', 'flat');
};
const cheer = (B, t, p, h) => {
  const c = Math.sin(t * TAU * 1.4); const j = Math.max(0, Math.sin(t * TAU * 1.4));
  stand(B, { gap: 0.05, yaw: 0.14, lim: 0.9 - 0.1 * j }); B.hips(0, 0.0, 0); B.hipsLift = 0.0;
  B.hipsRot(0, 0, 0.05 * c); B.spine(-0.05 + 0.04 * j, 0.07 * c, 0.05 * c); B.head(-0.12, 0.2 * c, -0.07 * c);
  B.arm('L', { raise: 2.7 + 0.3 * j, abd: 0.3, rot: -0.3, elbow: 0.6 - 0.2 * j, pron: -0.3, wflex: 0 }); B.arm('R', { raise: 2.7 + 0.3 * (1 - j), abd: 0.3, rot: -0.3, elbow: 0.6, pron: -0.3, wflex: 0 });
  B.fingers('L', 'fist'); B.fingers('R', 'fist'); B.shoulder('L', 0.2); B.shoulder('R', 0.2);
};
const laugh = (B, t, p, h) => {
  const sd = seedOf(h); const sh = Math.sin(t * TAU * 4.3) * 0.5 + 0.5; const sw = Math.sin(t * TAU * 0.7);
  idleCore(B, t, p, h, {});
  B.hips(0.005 * sw, 0, 0); B.spine(-0.05 + 0.04 * sh, 0, 0.03 * sw); B.head(-0.2 + 0.1 * sh, 0.1 * sw, 0.06 * sw);
  B.arm('L', { raise: 0.5, abd: -0.2, rot: 0.3, elbow: 1.5 + 0.1 * sh, pron: 0.5, wflex: 0.1 }); B.arm('R', relaxedArm(B, t, 5));
  B.shoulder('L', 0.12 * sh); B.shoulder('R', 0.12 * sh);
  B.extra.laughShake = sh;
};
const sad = (B, t, p, h) => {
  const sd = seedOf(h);
  stand(B, { gap: 0.0, yaw: 0.06, lim: 0.985 }); B.hips(0.0, 0, 0);
  B.spine(0.16, 0.0, 0); B.head(0.34 + 0.02 * sn(t * 0.4, sd), 0.1 * sn(t * 0.2, sd + 1), 0.04);
  B.arm('L', { raise: 0.0, abd: -B.D.armAbd * 0.35, rot: 0.3, elbow: 0.3, pron: 0.4, wflex: 0.15 }); B.arm('R', { raise: 0.05, abd: -B.D.armAbd * 0.35, rot: 0.3, elbow: 0.32, pron: 0.4, wflex: 0.15 });
  B.shoulder('L', -0.06, 0.1); B.shoulder('R', -0.06, 0.1);
};
const hug = (B, t, p, h) => {
  idleCore(B, t, p, h, { lean: 0.07 });
  const c = ease(t / 0.5);
  const a = { raise: 1.15, abd: 0.35, rot: 0.1, elbow: 1.2, pron: 0.7, wflex: 0.1 };
  B.arm('L', mixo(relaxedArm(B, t, 1), a, c)); B.arm('R', mixo(relaxedArm(B, t, 2), { ...a, raise: 1.05, elbow: 1.35 }, c));
  B.fingers('L', 'relaxed'); B.fingers('R', 'relaxed'); B.spine(0.1 * c, 0, 0); B.head(0.1 * c, 0, 0.1 * c);
};

// ----------------------------------------------------------------------------------------------- seated
const seatH = (B, p) => (p.seatHeight ?? 0.46) * Math.pow(B.D.H / 1.75, 0.9);
function sitBase(B, t, p, h, o = {}) {
  const sd = seedOf(h);
  const sh = seatH(B, p) + (o.seatAdd || 0);
  const hipY = sh + 0.085 * (B.D.H / 1.75);
  const reachX = (o.footForward ?? 0.97) * B.D.thigh;
  B.hips(0, hipY - B.J.hips.y, (o.hipsZ || 0));
  B.hipsMode = 'free';
  const spread = o.legSpread ?? 0.1;
  B.footIK('L', spread, 0, reachX + 0.02, 0.15, 0, 0, false); B.footIK('R', -spread, 0, reachX - 0.0 + (o.rFootZ || 0), -0.15, 0, 0, false);
  B.hipsRot(o.hipPitch ?? -0.06, 0, 0);
  const sway = sn(t * 0.3, sd) * 0.01;
  B.spine((o.lean ?? 0.05) + 0.005 * sn(t * 0.4, sd), 0.02 * sn(t * 0.2, sd + 1), sway);
  B.head(o.headPitch ?? -0.05, 0.04 * sn(t * 0.2, sd + 2), 0);
}
const sit = (B, t, p, h) => {
  sitBase(B, t, p, h);
  const sd = seedOf(h); const ra = relaxedArm(B, t, sd);
  // forearms resting on thighs
  B.arm('L', { raise: 0.55, abd: -0.18, rot: 0.2, elbow: 1.2, pron: 0.7, wflex: 0.05 }); B.arm('R', { raise: 0.5, abd: -0.18, rot: 0.2, elbow: 1.25, pron: 0.7, wflex: 0.05 });
  B.fingers('L', 'relaxed'); B.fingers('R', 'relaxed');
};
const sit_talk = (B, t, p, h) => {
  sitBase(B, t, p, h, { lean: 0.06 });
  const sd = seedOf(h), E = clamp(h.energy ?? 0.5, 0, 1);
  const per = 1.4; // fixed beat grid (see talkCore)
  const base = { raise: 0.5, abd: -0.18, rot: 0.2, elbow: 1.25, pron: 0.7, wflex: 0.05 };
  for (const S of ['R', 'L']) {
    const bs = beatState(t + (S === 'L' ? 0.4 : 0), { period: per * (S === 'L' ? 1.3 : 1), dur: per * 0.7, prob: S === 'R' ? 0.8 : 0.45, seed: sd + (S === 'L' ? 5 : 0) });
    const list = ['open', 'chop', 'openWide', 'palmdown']; const g = GEST[list[Math.floor(bs.pick * list.length)]];
    if (bs.e > 0.001) { B.arm(S, mixo(base, g.a, bs.e * 0.8)); B.fingers(S, g.hand, 1); B.extra['beat' + S] = bs.e; } else B.arm(S, base);
  }
  const be = Math.max(B.extra.beatR || 0, B.extra.beatL || 0);
  B.head(-0.02 + 0.05 * be, 0.07 * sn(t * 0.6, sd), -0.05 * sn(t * 0.5, sd + 1));
};
const sit_type = (B, t, p, h) => {
  sitBase(B, t, p, h, { lean: 0.14, headPitch: 0.25, footForward: 0.9 });
  const sd = seedOf(h); const tp = Math.sin(t * 17) * 0.5 + 0.5, tp2 = Math.sin(t * 13 + 1) * 0.5 + 0.5;
  const kb = p.keyboard || [0, B.J.hips.y + 0.06 + 0.0, 0.45];
  const hp = (S, dx, k) => new THREE.Vector3(kb[0] + (S === 'L' ? 0.1 : -0.1) + dx, kb[1] + 0.005 * k, kb[2]);
  B.handIK('L', hp('L', 0.01 * Math.sin(t * 1.3), tp), { pole: new THREE.Vector3(0.6, -0.6, -0.5) }); B.handIK('R', hp('R', 0.01 * Math.sin(t * 1.1 + 2), tp2), { pole: new THREE.Vector3(-0.6, -0.6, -0.5) });
  B.fingers('L', 'type'); B.fingers('R', 'type');
  B.add('indexL2', 0, 0, 0);
  B.add('handL', 0, 0, 0.0);
};
const drive = (B, t, p, h) => {
  const sd = seedOf(h);
  sitBase(B, t, p, h, { seatAdd: -0.04 * 0, lean: -0.02, headPitch: 0.0, legSpread: 0.11, footForward: 1.02, rFootZ: 0.04 });
  // wheel centre in front of the chest
  const wh = p.wheel || [0, B.hipsOff.y + B.J.hips.y + 0.34, 0.5]; const tilt = p.wheelTilt ?? 0.55;
  const turn = (p.steer ?? 0) + 0.04 * sn(t * 0.5, sd) + 0.02 * sn(t * 1.7, sd + 4);
  const r = 0.17;
  const lp = new THREE.Vector3(wh[0] + r * Math.cos(Math.PI + turn + 0.0) * -1, wh[1] + r * Math.sin(turn) * Math.cos(tilt), wh[2] - 0.0); // left hand (+x)
  const a = turn + 0.35, b2 = turn + Math.PI - 0.35;
  const pL = new THREE.Vector3(wh[0] + r * Math.cos(a), wh[1] + r * Math.sin(a) * Math.cos(tilt), wh[2] - r * Math.sin(a) * Math.sin(tilt));
  const pR = new THREE.Vector3(wh[0] + r * Math.cos(b2), wh[1] + r * Math.sin(b2) * Math.cos(tilt), wh[2] - r * Math.sin(b2) * Math.sin(tilt));
  B.handIK('L', pL, { pole: new THREE.Vector3(0.7, -0.5, -0.4) }); B.handIK('R', pR, { pole: new THREE.Vector3(-0.7, -0.5, -0.4) });
  B.fingers('L', 'grip_rifle', 0.8); B.fingers('R', 'grip_rifle', 0.8);
  B.head(0.0, 0.08 * sn(t * 0.35, sd + 1) + (p.look || 0), 0);
  B.spine(-0.03, 0, 0);
};
const phone_call = (B, t, p, h) => {
  const sd = seedOf(h);
  const ra = idleCore(B, t, p, h, { lean: 0.02, headPitch: 0.0 });
  const hp = new THREE.Vector3();
  B.arm('L', ra);
  B.handIK('R', (out) => { // wrist target beside the ear
    const hb = h.rig.bones.head; fkPos(hb, out); const q = fkQuat(hb, new THREE.Quaternion());
    const off = new THREE.Vector3(-0.115, -0.065, 0.03).multiplyScalar(B.D.sh); off.applyQuaternion(q); return out.add(off);
  }, { pole: new THREE.Vector3(-0.35, -1, -0.15) });
  B.fingers('R', 'hold_phone'); B.head(0.0, 0.05, 0.16 + 0.03 * sn(t * 0.3, sd)); B.spine(0.02, 0, 0);
  B.extra.phoneRaised = 1;
};
const point = (B, t, p, h) => {
  idleCore(B, t, p, h, { lean: 0.03 }); const jab = Math.max(0, Math.sin(t * TAU * 1.1)) * 0.05;
  B.arm('L', relaxedArm(B, t, 1));
  B.arm('R', { raise: 1.45 + jab, abd: 0.12, rot: 0.0, elbow: 0.12, pron: 0.5, wflex: 0.0 }); B.fingers('R', 'point'); B.spine(0.03, 0.12, 0); B.head(0.0, 0.1, 0);
};

export const BASIC = {
  idle: { fn: idle }, idle_arms_crossed: { fn: idle_arms_crossed }, idle_hands_hips: { fn: idle_hands_hips }, idle_phone: { fn: idle_phone }, listen: { fn: listen, expr: {} },
  talk_a: { fn: talk_a }, talk_b: { fn: talk_b }, talk_c: { fn: talk_c },
  walk: { fn: walk }, walk_tired: { fn: walk_tired, expr: { sad: 0.15 } }, jog: { fn: jog }, run: { fn: run, expr: { anger: 0.1 } }, sprint: { fn: sprint, expr: { anger: 0.2 } },
  crouch_walk: { fn: crouch_walk }, sneak: { fn: sneak }, panic_run: { fn: panic_run, expr: { fear: 0.8 } },
  sit: { fn: sit }, sit_talk: { fn: sit_talk }, sit_type: { fn: sit_type }, drive: { fn: drive }, phone_call: { fn: phone_call }, point: { fn: point, expr: { anger: 0.15 } }, wave: { fn: wave_clip, expr: { smile: 0.6 } },
  shrug: { fn: shrug }, nod: { fn: nod }, shake_head: { fn: shake_head, expr: { frown: 0.2 } }, shock: { fn: shock, expr: { surprise: 0.9, fear: 0.3 } }, scared_idle: { fn: scared_idle, expr: { fear: 0.7 } },
  hands_up: { fn: hands_up, expr: { fear: 0.6 } }, salute: { fn: salute }, cheer: { fn: cheer, expr: { smile: 1 } }, laugh: { fn: laugh, expr: { smile: 1 } }, sad: { fn: sad, expr: { sad: 0.8 } }, hug: { fn: hug, expr: { smile: 0.3, sad: 0.1 } },
};
export { idleCore, beatState, GEST, mixo, seedOf, fract };
