// Generic clip library for crowd figures: IK-planted gaits, stances, weapon holds, falls ... parameterised by a style object K.
// Every function writes a Pose for a normalised cycle c (0..1). Kinds tweak behaviour through K params and K.post[state] hooks.
import { J, NS, ST, POSE_FRAMES as F } from './rig.js';
import { rotE, Rx, Ry, Rz, mmul, mT, ik2, mv, add, sub } from './anim.js';

const TAU = Math.PI * 2;
export const S = (c, k = 1, ph = 0) => Math.sin(TAU * (k * c + ph));
export const C = (c, k = 1, ph = 0) => Math.cos(TAU * (k * c + ph));
const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const minjerk = (q) => q * q * q * (10 - 15 * q + 6 * q * q);

export const DEFAULT_GRIPS = { R: [-0.13, 1.335, 0.15], L: [-0.045, 1.372, 0.42] };

// ---------- primitives ----------
export function setLeg(P, L, side, ankle, pitch, yaw, root) {
  const hip = [side * L.hipX, L.hipY, 0];
  const T = [ankle[0] - root[0], ankle[1] - root[1], ankle[2] - root[2]];
  const r = ik2(hip, T, L.thigh, L.shin, [side * 0.12, 0, 1], -1);
  const jL = side > 0 ? J.LEG_L : J.LEG_R, jS = side > 0 ? J.SHIN_L : J.SHIN_R, jF = side > 0 ? J.FOOT_L : J.FOOT_R;
  const Rk = Rx(r.kappa);
  P.m(jL, r.R1); P.m(jS, Rk);
  P.m(jF, mmul(mT(mmul(r.R1, Rk)), mmul(Ry(yaw * side), Rx(pitch))));
}
/** both feet planted: feet = [[x,z,pitch?],[x,z]] relative to root, pelvisY absolute hip height */
export function stanceLegs(P, L, { pelvisY, rootX = 0, rootZ = 0, lz = 0, rz = 0, width = 0.04, ly = 0, ry = 0, lyaw = 0.08, ryaw = 0.08, lpitch = 0, rpitch = 0 }) {
  const root = [rootX, pelvisY - L.hipY, rootZ];
  P.pos(root[0], root[1], root[2]);
  setLeg(P, L, 1, [L.hipX + width, L.ankleY + ly, lz], lpitch, lyaw, root);
  setLeg(P, L, -1, [-(L.hipX + width), L.ankleY + ry, rz], rpitch, ryaw, root);
}
export function arm(P, side, swing, abd, flex, twist = 0) {
  P.e(side > 0 ? J.ARM_L : J.ARM_R, -swing, side * twist, side * abd);
  P.e(side > 0 ? J.FORE_L : J.FORE_R, -flex, 0, 0);
}
export function armIK(P, L, side, target, pole = [side * 0.5, -0.8, -0.5]) {
  const S0 = [side * L.shoulderX, L.shoulderY, 0]; const L2 = L.armF + L.handL * 0.5;
  const r = ik2(S0, target, L.armU, L2, pole, 1);
  P.m(side > 0 ? J.ARM_L : J.ARM_R, r.R1); P.m(side > 0 ? J.FORE_L : J.FORE_R, Rx(-r.kappa));
  return r;
}
/** weapon rotation about its pivot (pitch + = muzzle down), hands follow via IK */
export function holdWeapon(P, L, pitch = 0, yaw = 0, roll = 0, grips = DEFAULT_GRIPS) {
  const wm = rotE(pitch, yaw, roll); P.m(J.WEAPON, wm);
  const wp = L.weaponPivot; const g = (v) => add(wp, mv(wm, sub(v, wp)));
  armIK(P, L, -1, g(grips.R), [-0.45, -0.9, -0.5]);
  armIK(P, L, 1, g(grips.L), [0.55, -0.9, -0.35]);
}

// ---------- gait (IK planted, pelvis height from reach) ----------
export function makeGait(L, g) {
  const f = g.f, v = g.v, duty = g.duty;
  const SL = Math.max(0.1, v * duty / f - (g.roll ?? 0.18)); // ankle travel (body frame) during stance
  const zc = g.zc ?? 0.02, width = g.width ?? 0.02;
  const foot = (s) => {
    let z, y, pitch;
    if (s < duty) {
      const u = s / duty; z = zc + SL / 2 - SL * u;
      pitch = -0.26 * (1 - sm(0, 0.22, u)) + (g.toe ?? 0.6) * sm(0.6, 1, u);
      y = L.ankleY + 0.065 * Math.sin(Math.max(0, -pitch)) + 0.13 * Math.sin(Math.max(0, pitch));
    } else {
      const q = (s - duty) / (1 - duty); const e = minjerk(q);
      z = zc - SL / 2 + SL * e;
      y = L.ankleY + 0.13 * Math.sin(Math.max(0, (g.toe ?? 0.6) * (1 - sm(0, 0.35, q)))) + g.lift * Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8)), 1.1);
      pitch = (g.toe ?? 0.6) * (1 - sm(0, 0.35, q)) - 0.26 * sm(0.5, 1, q) + (g.swingPitch ?? 0) * Math.sin(Math.PI * q);
    }
    return [z, y, pitch, s < duty];
  };
  const Lmax = (L.thigh + L.shin) * 0.985;
  const raw = new Float32Array(F), A = [], B = [];
  for (let i = 0; i < F; i++) {
    const c = i / F; const a = foot(((c) % 1 + 1) % 1), b = foot(((c + 0.5) % 1 + 1) % 1);
    A.push(a); B.push(b);
    let y = L.ankleY + Lmax; // flight: top
    for (const ft of [a, b]) if (ft[3]) y = Math.min(y, ft[1] + Math.sqrt(Math.max(0.01, Lmax * Lmax - ft[0] * ft[0] - width * width)));
    raw[i] = y;
  }
  const w = Math.max(1, Math.round(F * (g.smooth ?? 0.07))); const py = new Float32Array(F);
  for (let i = 0; i < F; i++) { let s = 0, n = 0; for (let k = -w; k <= w; k++) { const wt = w + 1 - Math.abs(k); s += raw[(i + k + F * 4) % F] * wt; n += wt; } py[i] = s / n - (g.drop ?? 0.02); }
  const api = {
    SL, v, f, duty,
    /** apply legs + root + spine/pelvis motion. returns root offset */
    apply(P, c, fr, o = {}) {
      const i = fr % F; const a = A[i], b = B[i];
      const rx = (g.sway ?? 0.012) * S(c, 1) + (o.rootX || 0), rz = o.rootZ || 0; const pelvisY = py[i] + (o.pelvisY || 0);
      const root = [rx, pelvisY - L.hipY, rz]; P.pos(root[0], root[1], root[2]);
      setLeg(P, L, 1, [L.hipX + width, a[1], a[0] + rz], a[2], g.toeOut ?? 0.1, root);
      setLeg(P, L, -1, [-(L.hipX + width), b[1], b[0] + rz], b[2], g.toeOut ?? 0.1, root);
      const tw = g.twist ?? 0.09;
      P.e(J.ROOT_ROT, (g.pelvisLean ?? 0) , -tw * C(c, 1) * 0.5, (g.roll2 ?? 0.03) * S(c, 1));
      P.e(J.SPINE, g.lean ?? 0.05, tw * C(c, 1) * 1.2, -(g.roll2 ?? 0.03) * 1.5 * S(c, 1));
      return root;
    },
  };
  return api;
}

/** arms swinging opposite to legs */
export function swingArms(P, c, { A = 0.45, e0 = 0.22, e1 = 0.35, abd = 0.1, twist = 0 } = {}) {
  const cl = C(c, 1); // left leg forward at c=0 -> left arm back
  arm(P, 1, -A * cl, abd, e0 + e1 * (0.5 - 0.5 * cl), twist);
  arm(P, -1, A * cl, abd, e0 + e1 * (0.5 + 0.5 * cl), twist);
}

// ---------- clip set ----------
export function makeClips(L, K) {
  const clips = new Array(NS);
  const post = K.post || {};
  const G = {};
  for (const k of ['walk', 'run', 'sprint', 'lunge', 'panic']) if (K.gait[k]) G[k] = makeGait(L, K.gait[k]);
  const grips = K.grips || DEFAULT_GRIPS;
  const wp = K.weapon;
  const gaitClip = (name, stateIdx, armDefault) => {
    const gg = K.gait[name]; const gait = G[name]; const armMode = (K.arms && K.arms[name]) || armDefault;
    return { f: gg.f, blend: 0.22, fn: (P, c, fr) => {
      gait.apply(P, c, fr, {});
      const head = gg.head ?? 0;
      P.e(J.HEAD, -(gg.lean ?? 0.05) * 0.6 + head, -0.1 * C(c, 1) * (gg.twist ?? 0.09) * 3, 0.02 * S(c, 1));
      if (armMode === 'rifle' && wp) {
        const wpP = gg.weaponPitch ?? 0.5; holdWeapon(P, L, wpP + 0.03 * S(c, 2), (wp.yaw ?? 0) + 0.04 * S(c, 1), 0, grips);
      } else if (armMode === 'swing') swingArms(P, c, gg.arm || {});
      else if (armMode === 'hang') swingArms(P, c, { A: 0.18, e0: 0.12, e1: 0.15, abd: 0.12 });
      post[name] && post[name](P, c, { L, fr, gait, gg });
    } };
  };
  if (K.gait.walk) clips[ST.walk] = gaitClip('walk', ST.walk, wp ? 'rifle' : 'swing');
  if (K.gait.run) clips[ST.run] = gaitClip('run', ST.run, wp ? 'rifle' : 'swing');
  if (K.gait.sprint) clips[ST.sprint] = gaitClip('sprint', ST.sprint, wp ? 'rifle' : 'swing');
  if (K.gait.lunge) clips[ST.lunge] = gaitClip('lunge', ST.lunge, 'swing');
  if (K.gait.panic) clips[ST.panic] = gaitClip('panic', ST.panic, 'swing');

  // idle ---------------------------------------------------------------------------------------------------------
  clips[ST.idle] = { f: 0.2, blend: 0.3, fn: (P, c) => {
    stanceLegs(P, L, { pelvisY: L.hipY - 0.012 + 0.004 * S(c, 2), rootX: 0.012 * S(c, 1), lz: 0.02, rz: -0.02, width: 0.035, lyaw: 0.12, ryaw: 0.12 });
    P.e(J.ROOT_ROT, 0, 0.03 * S(c, 1, 0.1), 0.02 * S(c, 1));
    P.e(J.SPINE, 0.02 + 0.012 * S(c, 2), 0.05 * S(c, 1, 0.25), -0.02 * S(c, 1));
    P.e(J.HEAD, 0.03 * S(c, 2, 0.3), 0.18 * S(c, 1, 0.1) * 0.7 + 0.1 * S(c, 3, 0.4), 0.025 * S(c, 1, 0.3));
    if (wp) holdWeapon(P, L, K.idleWeaponPitch ?? 0.75, wp.yaw ?? 0, 0, grips);
    else { arm(P, 1, 0.05 * S(c, 1), 0.1, 0.18 + 0.03 * S(c, 2)); arm(P, -1, -0.04 * S(c, 1), 0.1, 0.2 + 0.03 * S(c, 2, 0.3)); }
    post.idle && post.idle(P, c, { L });
  } };

  // aim / fire -----------------------------------------------------------------------------------------------------
  const aimFn = (fire) => (P, c) => {
    const breathe = 0.012 * S(c, 1);
    const rec = fire ? ((cc) => { let a = 0; for (let k = 0; k < 3; k++) { const d = (((cc - k / 3) % 1) + 1) % 1; a += Math.exp(-d * 18); } return a; })(c) : 0;
    stanceLegs(P, L, { pelvisY: L.hipY - 0.04 + 0.006 * S(c, 1), rootZ: -0.01 - 0.02 * rec, lz: 0.2, rz: -0.18, width: 0.06, lyaw: -0.3, ryaw: 0.45 });
    P.e(J.ROOT_ROT, 0, -0.1, 0);
    P.e(J.SPINE, 0.1 + 0.05 * rec, -0.12, 0);
    P.e(J.HEAD, -0.04 - 0.02 * rec, 0.06, 0.05);
    if (wp) holdWeapon(P, L, -breathe * 0.5 + 0.1 * rec - 0.0, (wp.yaw ?? 0) + 0.12 + 0.01 * S(c, 2), 0, grips);
    else if (K.aimArms) K.aimArms(P, c, fire, { L, rec });
    else { arm(P, -1, 1.5, 0.05, 0.1); arm(P, 1, 0.1, 0.1, 0.2); }
    post[fire ? 'fire' : 'aim'] && post[fire ? 'fire' : 'aim'](P, c, { L, rec });
  };
  clips[ST.aim] = { f: 0.3, blend: 0.25, fn: aimFn(false) };
  clips[ST.fire] = { f: K.fireRate ?? 1.3, blend: 0.12, fn: aimFn(true) };

  // crouch / cower --------------------------------------------------------------------------------------------------
  clips[ST.crouch] = { f: 0.25, blend: 0.3, fn: (P, c) => {
    stanceLegs(P, L, { pelvisY: 0.60 + 0.006 * S(c, 2), rootZ: -0.08, lz: 0.22, rz: -0.06, width: 0.08, lyaw: 0.2, ryaw: 0.3 });
    P.e(J.ROOT_ROT, 0.28, -0.05, 0);
    P.e(J.SPINE, 0.28 + 0.015 * S(c, 2), -0.1, 0);
    P.e(J.HEAD, -0.3, 0.15 * S(c, 1, 0.2), 0);
    if (wp) holdWeapon(P, L, -0.08 + 0.01 * S(c, 1), (wp.yaw ?? 0) + 0.12, 0, grips);
    else { arm(P, 1, 0.5, 0.15, 1.0); arm(P, -1, 0.45, 0.15, 1.0); }
    post.crouch && post.crouch(P, c, { L });
  } };
  clips[ST.cower] = { f: 0.5, blend: 0.3, fn: (P, c) => {
    const sh = 0.025 * S(c, 7) + 0.015 * S(c, 11);
    stanceLegs(P, L, { pelvisY: 0.50 + 0.01 * S(c, 2), rootZ: -0.12, lz: 0.18, rz: 0.02, width: 0.1, lyaw: 0.3, ryaw: 0.3 });
    P.e(J.ROOT_ROT, 0.45, 0, 0.03 * S(c, 7, 0.3));
    P.e(J.SPINE, 0.65 + 0.03 * S(c, 2) + sh, 0.05 * S(c, 3), 0);
    P.e(J.HEAD, 0.55 + sh, 0.2 * S(c, 1, 0.1), 0.05 * S(c, 5));
    arm(P, 1, 2.3 + 0.1 * S(c, 5), 0.45, 1.85, 0.2); arm(P, -1, 2.3 + 0.1 * S(c, 5, 0.3), 0.45, 1.85, 0.2);
    if (wp) { P.e(J.WEAPON, 1.2, 0, 0.3); }
    post.cower && post.cower(P, c, { L });
  } };

  // cough ---------------------------------------------------------------------------------------------------------------
  clips[ST.cough] = { f: 0.55, blend: 0.2, fn: (P, c) => {
    const pulse = (cc) => { let a = 0; for (let k = 0; k < 2; k++) { const d = ((cc - 0.1 - k * 0.2) % 1 + 1) % 1; a += Math.exp(-d * 9) * (d < 0.5 ? 1 : 0); } return Math.min(1, a); };
    const p = pulse(c), tw = 0.5 + 0.5 * S(c, 1, -0.2);
    stanceLegs(P, L, { pelvisY: L.hipY - 0.1 - 0.02 * p, rootZ: -0.04, lz: 0.08, rz: -0.08, width: 0.08, lyaw: 0.2, ryaw: 0.2 });
    P.e(J.ROOT_ROT, 0.15 + 0.1 * p, 0, 0);
    P.e(J.SPINE, 0.45 + 0.28 * p, 0.05 * S(c, 3), 0.04 * S(c, 5) * p);
    P.e(J.HEAD, 0.15 + 0.3 * p, 0.0, 0);
    // right hand to mouth, left arm hangs/clutches
    armIK(P, L, -1, [-0.06, L.neckY - 0.03 + 0.0, 0.2 + 0.03 * p], [-0.5, -0.6, -0.8]);
    arm(P, 1, 0.5 + 0.4 * p, 0.15, 0.9, 0.0);
    post.cough && post.cough(P, c, { L, p });
  } };

  // cheer ------------------------------------------------------------------------------------------------------------------
  clips[ST.cheer] = { f: 1.1, blend: 0.25, fn: (P, c) => {
    const b = Math.abs(S(c, 1));
    stanceLegs(P, L, { pelvisY: L.hipY - 0.05 + 0.04 * b - 0.02, lz: 0.03, rz: -0.03, width: 0.07, ly: 0.06 * Math.max(0, S(c, 1, 0.25)) * (S(c, 0.5) > 0 ? 1 : 0), ry: 0.06 * Math.max(0, S(c, 1, 0.25)) * (S(c, 0.5) > 0 ? 0 : 1), lyaw: 0.2, ryaw: 0.2 });
    P.e(J.ROOT_ROT, 0, 0.05 * S(c, 0.5), 0.04 * S(c, 1));
    P.e(J.SPINE, -0.08, 0.06 * S(c, 0.5, 0.25), 0.03 * S(c, 1, 0.25));
    P.e(J.HEAD, -0.2 + 0.08 * S(c, 2), 0.1 * S(c, 0.5), 0);
    arm(P, 1, 2.75 + 0.35 * S(c, 1), 0.28, 0.35 + 0.3 * (0.5 + 0.5 * S(c, 1)));
    arm(P, -1, 2.75 + 0.35 * S(c, 1, 0.5), 0.28, 0.35 + 0.3 * (0.5 + 0.5 * S(c, 1, 0.5)));
    if (wp) { P.e(J.WEAPON, -1.2, 0, 0); armIK(P, L, -1, [-0.1, 1.95, 0.1], [-0.5, -0.5, -0.5]); }
    post.cheer && post.cheer(P, c, { L });
  } };

  // crawl (prone) ------------------------------------------------------------------------------------------------------------
  clips[ST.crawl] = { f: 0.7, blend: 0.3, lying: false, fn: (P, c) => {
    const a = S(c, 1), b = S(c, 1, 0.5);
    P.pos(0, -(L.hipY - 0.2) + 0.012 * Math.abs(a), 0.1 * 0);
    P.e(J.ROOT_ROT, Math.PI / 2 - 0.12, 0, 0.0);
    P.e(J.SPINE, -0.12 + 0.03 * a, 0.15 * a, 0);
    P.e(J.HEAD, -0.55, 0.2 * -a, 0.0);
    // arms reach overhead (in prone body frame: swing > pi/2 = forward on the ground), alternating
    arm(P, 1, 2.6 + 0.55 * a, 0.35, 0.5 + 0.7 * Math.max(0, -a), 0.0); arm(P, -1, 2.6 + 0.55 * b, 0.35, 0.5 + 0.7 * Math.max(0, -b), 0.0);
    // legs trail, knees drag alternately
    P.e(J.LEG_L, -0.1 + 0.35 * a, 0, 0.15); P.e(J.SHIN_L, 0.25 + 0.7 * Math.max(0, a), 0, 0); P.e(J.FOOT_L, 0.4, 0, 0);
    P.e(J.LEG_R, -0.1 + 0.35 * b, 0, -0.15); P.e(J.SHIN_R, 0.25 + 0.7 * Math.max(0, b), 0, 0); P.e(J.FOOT_R, 0.4, 0, 0);
    if (wp) P.e(J.WEAPON, 1.4, 0, 0);
    post.crawl && post.crawl(P, c, { L });
  } };

  // falls & dead -------------------------------------------------------------------------------------------------------------------
  const dead = (P, dir) => { // dir -1 = on back (supine), +1 = on face
    const drop = L.hipY - (dir < 0 ? 0.135 : 0.14);
    P.pos(0, -drop, 0); P.e(J.ROOT_ROT, dir * Math.PI / 2, 0, 0); P.r(J.ROOT_ROT, 1);
    if (dir < 0) {
      P.e(J.SPINE, 0.0, 0.1, 0.04); P.e(J.HEAD, -0.2, 0.35, 0.3); P.r(J.HEAD, 0.35); P.r(J.SPINE, 0.12);
      arm(P, 1, 0.05, 0.55, 0.35, 0.0); arm(P, -1, -0.15, 0.7, 0.55, 0.0); P.r(J.ARM_L, 0.45); P.r(J.ARM_R, 0.45); P.r(J.FORE_L, 0.5); P.r(J.FORE_R, 0.5);
      P.e(J.LEG_L, 0.0, 0.0, 0.14); P.e(J.LEG_R, -0.05, 0.0, -0.18); P.e(J.SHIN_L, 0.05, 0, 0); P.e(J.SHIN_R, 0.35, 0, 0); P.e(J.FOOT_L, 0.1, 0.3, 0); P.e(J.FOOT_R, 0.25, -0.2, 0);
      P.r(J.LEG_L, 0.25); P.r(J.LEG_R, 0.3); P.r(J.SHIN_R, 0.3); P.r(J.FOOT_L, 0.3); P.r(J.FOOT_R, 0.3);
    } else {
      P.e(J.SPINE, -0.05, 0.05, 0.0); P.e(J.HEAD, -0.35, 1.0, 0.0); P.r(J.HEAD, 0.35); P.r(J.SPINE, 0.12);
      arm(P, 1, 2.5, 0.5, 0.9, 0.0); arm(P, -1, 0.3, 0.55, 0.3, 0.0); P.r(J.ARM_L, 0.5); P.r(J.ARM_R, 0.5); P.r(J.FORE_L, 0.5); P.r(J.FORE_R, 0.5);
      P.e(J.LEG_L, -0.05, 0, 0.18); P.e(J.LEG_R, 0.0, 0, -0.14); P.e(J.SHIN_L, 0.5, 0, 0); P.e(J.SHIN_R, 0.1, 0, 0); P.e(J.FOOT_L, 0.5, 0, 0); P.e(J.FOOT_R, 0.3, 0, 0);
      P.r(J.LEG_L, 0.25); P.r(J.LEG_R, 0.3); P.r(J.SHIN_L, 0.3); P.r(J.FOOT_L, 0.3);
    }
    if (wp) P.e(J.WEAPON, 0.9, 0.6, 0.2);
  };
  clips[ST.dead_b] = { f: 0.1, blend: 0.2, lying: true, fn: (P) => dead(P, -1) };
  clips[ST.dead_f] = { f: 0.1, blend: 0.2, lying: true, fn: (P) => dead(P, 1) };
  const fall = (dir) => (P, t) => {
    const e = Math.pow(t, 2.1), e2 = sm(0.25, 0.95, t);
    const bounce = t > 0.82 ? 0.035 * Math.sin(Math.PI * (t - 0.82) / 0.18) : 0;
    const drop = (L.hipY - 0.137) * Math.pow(e2, 1.8) - bounce;
    P.pos(0, -drop, 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.2)) * -dir * 0 + 0);
    P.e(J.ROOT_ROT, dir * (Math.PI / 2 * Math.min(1.0, e * 1.0) + 0.06 * Math.sin(Math.PI * Math.max(0, (t - 0.7) / 0.3))), 0, 0); P.r(J.ROOT_ROT, 1 * sm(0.3, 1, t));
    const fl = Math.sin(Math.PI * Math.min(1, t * 1.15));
    const k = sm(0.2, 1, t); // blend toward dead pose
    const D = new (P.constructor)(); dead(D, dir);
    // arms: fling up then flop to dead pose
    const lerpQ = (j, extra) => { P.q[j] = D.q[j]; };
    for (let j = J.SPINE; j <= J.SKIRT_R; j++) { P.q[j] = D.q[j]; P.rnd[j] = D.rnd[j] * k; }
    arm(P, 1, lerp(1.9 * fl + 0.1, 0.05, k) * (dir < 0 ? 1 : 1), 0.7 * fl + 0.3 * k, lerp(0.4, 0.35, k)); arm(P, -1, lerp(1.6 * fl, -0.15, k), 0.7 * fl + 0.45 * k, lerp(0.3, 0.55, k));
    P.e(J.SPINE, dir * -0.35 * fl * (1 - k), 0.1, 0); P.e(J.HEAD, -dir * 0.5 * fl * (1 - k) - 0.2 * k, 0.35 * k, 0.3 * k);
    P.e(J.LEG_L, -0.5 * fl * (1 - k), 0, 0.14 * k); P.e(J.LEG_R, 0.3 * fl * (1 - k) - 0.05 * k, 0, -0.18 * k);
    P.e(J.SHIN_L, 0.9 * fl * (1 - k) + 0.05 * k, 0, 0); P.e(J.SHIN_R, 1.2 * fl * (1 - k) + 0.35 * k, 0, 0);
    if (dir > 0) { arm(P, 1, lerp(1.9 * fl, 2.5, k), 0.7 * fl + 0.5 * k, lerp(0.4, 0.9, k)); arm(P, -1, lerp(1.6 * fl, 0.3, k), 0.7 * fl + 0.55 * k, lerp(0.3, 0.3, k)); P.e(J.HEAD, -0.5 * fl * (1 - k) - 0.35 * k, 1.0 * k, 0); P.e(J.LEG_L, -0.05 * k - 0.4 * fl * (1 - k), 0, 0.18 * k); P.e(J.SHIN_L, 0.5 * k + 0.9 * fl * (1 - k), 0, 0); P.e(J.SHIN_R, 0.1 * k + 1.0 * fl * (1 - k), 0, 0); }
    if (wp) P.e(J.WEAPON, 0.9 * k + 0.4 * (1 - k), 0.6 * k, 0.2 * k);
  };
  clips[ST.fall_b] = { dur: 0.85, blend: 0.1, lying: true, fn: fall(-1) };
  clips[ST.fall_f] = { dur: 0.85, blend: 0.1, lying: true, fn: fall(1) };

  // post-process per-state hooks for non-locomotion states handled inside K (zombies etc.)
  for (let s = 0; s < NS; s++) if (!clips[s]) clips[s] = clips[ST.idle];
  if (K.skirt) { // coat/skirt halves follow the thighs at a fraction of their rotation
    const k = K.skirt; const seen = new Set();
    const follow = (P, j, from) => { const q = P.q[from]; const x = q[0] * k, y = q[1] * k, z = q[2] * k, w = (1 - k) + k * q[3]; const l = Math.hypot(x, y, z, w) || 1; P.q[j] = [x / l, y / l, z / l, w / l]; };
    for (const cl of clips) { if (seen.has(cl)) continue; seen.add(cl); const f0 = cl.fn; cl.fn = (P, c, fr) => { f0(P, c, fr); follow(P, J.SKIRT_L, J.LEG_L); follow(P, J.SKIRT_R, J.LEG_R); }; }
  }
  // nominal speeds (m/s at anim speed 1)
  const nominal = {};
  for (const k of Object.keys(G)) nominal[k] = G[k].v;
  nominal.crawl = K.crawlSpeed ?? 0.3;
  return { clips, nominal };
}
