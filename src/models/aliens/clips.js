// Procedural animation clips for the Vessari hero. Each clip is fn(P, t, c) writing pose channels (see rig.js CH).
// c = context {held, kind, E (talk energy), style, inf}. Poses are pure functions of clip time (seekable).
// Arm targets are in the chest frame (origin = spine2 joint); the arm() helper takes LEFT-arm values and mirrors them for the right arm.
import { CH, DIM, DEG, restPose } from './rig.js';

const PI = Math.PI, TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
const sin = Math.sin, cos = Math.cos;
/** deterministic smooth noise-ish signal in [-1,1] */
export const wob = (t, s = 0) => (sin(t * 1.0 + s * 12.9) * 0.5 + sin(t * 2.3 + s * 4.1) * 0.3 + sin(t * 4.7 + s * 7.7) * 0.2);
const ease = (v) => v * v * (3 - 2 * v);
/** smooth bump train: 0..1 pulses, f per second, phase offset ph (cycles) */
const bump = (t, f, ph = 0, w = 7) => { const x = ((t * f - ph) % 1 + 1) % 1 - 0.5; return Math.exp(-w * x * x * 4); };
/** envelope: rises over [a,b], falls over [c,d] */
const env = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));

export function arm(P, i, out, y, z, rx = 0, ry = 0, rz = 0, el = 0, gr = 0.35, sp = 0) {
  const s = i % 2 === 1 ? 1 : -1; const k = 'a' + i;
  P[CH[k + 'x']] = out * s; P[CH[k + 'y']] = y; P[CH[k + 'z']] = z; P[CH[k + 'rx']] = rx; P[CH[k + 'ry']] = ry * s; P[CH[k + 'rz']] = rz * s; P[CH[k + 'el']] = el * s; P[CH[k + 'gr']] = gr; P[CH[k + 'sp']] = sp;
}
const addArm = (P, i, dx, dy, dz) => { const k = 'a' + i; P[CH[k + 'x']] += dx; P[CH[k + 'y']] += dy; P[CH[k + 'z']] += dz; };

/** weapon carried in the right hand: low-ready (a=0) .. shouldered (a=1); left hand follows the foregrip */
export function holdWeapon(P, a, sway = 0, yaw = 0, pitch = 0) {
  const k = 'a0';
  P[CH[k + 'x']] = lerp(-0.22, -0.19, a); P[CH[k + 'y']] = lerp(-0.50, -0.14, a) + sway * 0.01; P[CH[k + 'z']] = lerp(0.30, 0.38, a);
  P[CH[k + 'rx']] = lerp(-1.05, -1.5, a) + pitch + sway * 0.02; P[CH[k + 'ry']] = lerp(0.08, 0.0, a) + yaw; P[CH[k + 'rz']] = 0; P[CH[k + 'el']] = 0.1;
  P[CH[k + 'gr']] = 0.85; P[CH[k + 'sp']] = 0.0; P[CH.wlh] = 1;
}

function base(P, t, c) {
  restPose(P, c.kind === 'hierarch');
  const br = sin(t * TAU / 3.4); P[CH.s1p] += 0.012 * br; P[CH.s2p] += 0.014 * br; P[CH.n0p] -= 0.008 * br;
  if (c.kind === 'drone') { P[CH.s0p] += 0.22; P[CH.s1p] += 0.16; P[CH.s2p] += 0.08; P[CH.n0p] -= 0.12; P[CH.n1p] -= 0.12; P[CH.hp] -= 0.15; P[CH.rY] -= 0.06; }
  if (c.kind === 'hierarch') { P[CH.s2p] -= 0.06; P[CH.n0p] -= 0.03; P[CH.hp] -= 0.05; P[CH.frill] = 0.5; }
  if (c.kind === 'officer') { P[CH.s2p] -= 0.03; }
  P[CH.eye] = 1; P[CH.rY] += 0.05;
}
/** hierarch lower pair: hands clasped / mudra in front of the belly */
function lowerPair(P, t, amp = 1, open = 0) {
  const w = sin(t * 1.3) * 0.015;
  arm(P, 3, 0.07 + open * 0.22, -0.52 + w, 0.30 + open * 0.08, -1.25, 0.25, 0.3 + open * 0.6, 0, 0.5 - open * 0.3, 0.1 + open * 0.3);
  arm(P, 2, 0.07 + open * 0.22, -0.52 - w, 0.30 + open * 0.08, -1.25, 0.25, 0.3 + open * 0.6, 0, 0.5 - open * 0.3, 0.1 + open * 0.3);
  P[CH.a2z] += 0.01 * amp * sin(t * 2.1); P[CH.a3z] += 0.01 * amp * sin(t * 2.1 + 1);
}
const relaxedArms = (P, t, c, w = 0) => {
  if (c.kind === 'hierarch') { arm(P, 1, 0.38, -0.46, 0.14 + 0.01 * sin(w), -0.12, 0, 0.0, 0, 0.4, 0.25); arm(P, 0, 0.38, -0.46, 0.14 + 0.01 * sin(w + 1), -0.12, 0, 0.0, 0, 0.4, 0.25); lowerPair(P, t); }
  else { P[CH.a0gr] = 0.35 + 0.1 * sin(w * 2); P[CH.a1gr] = 0.35 + 0.1 * sin(w * 2 + 1); addArm(P, 0, 0.01 * sin(w), 0.01 * sin(w * 1.5), 0); addArm(P, 1, -0.01 * sin(w), 0.01 * sin(w * 1.2), 0); }
};

const clips = {};
const def = (name, dur, loop, fn, extra = {}) => { clips[name] = { name, dur, loop, fn, ...extra }; };

// ------------------------------------------------------------------ IDLE
def('idle', 6.0, true, (P, t, c) => {
  base(P, t, c);
  const w = t * TAU / 6.0; P[CH.rX] += 0.014 * sin(w); P[CH.rR] += 0.018 * sin(w); P[CH.rYaw] += 0.02 * sin(w * 0.5);
  P[CH.s1r] -= 0.015 * sin(w); P[CH.s1y] += 0.03 * sin(w * 0.5 + 1);
  P[CH.hy] += 0.14 * sin(w * 0.5 + 0.3) * (c.kind === 'hierarch' ? 0.4 : 1); P[CH.hp] += 0.03 * sin(w + 1);
  if (c.kind === 'hierarch') P[CH.frill] += 0.1 * sin(w * 1.3);
  if (c.held) holdWeapon(P, 0.25, sin(w * 1.5)); else relaxedArms(P, t, c, w);
});
def('idle_alert', 4.0, true, (P, t, c) => {
  base(P, t, c);
  const w = t * TAU / 4.0; const snap = Math.tanh(5 * sin(w * 0.75)) * 0.55, snap2 = Math.tanh(4 * sin(w * 1.5 + 1)) * 0.12;
  P[CH.rY] -= 0.06; P[CH.rP] += 0.07; P[CH.s1p] += 0.1; P[CH.s2p] += 0.05; P[CH.n0p] -= 0.1; P[CH.hp] += 0.02 + snap2;
  P[CH.hy] += snap; P[CH.s2y] += snap * 0.25; P[CH.brow] = 0.5; P[CH.frill] = 0.8; P[CH.jt] = 0.12 * (0.5 + 0.5 * sin(t * 18)); P[CH.eye] = 1.2;
  P[CH.lfx] += 0.04; P[CH.rfx] -= 0.04; P[CH.lfz] += 0.1; P[CH.rfz] -= 0.12; P[CH.lfth] += 0.1; P[CH.rfth] += 0.1;
  if (c.held) holdWeapon(P, 0.55, sin(w * 3), snap * 0.2); else { arm(P, 1, 0.34, -0.48, 0.30, -0.5, 0, 0, 0.1, 0.7, 0.4); arm(P, 0, 0.34, -0.48, 0.30, -0.5, 0, 0, 0.1, 0.7, 0.4); if (c.kind === 'hierarch') lowerPair(P, t); }
});

// ------------------------------------------------------------------ GAITS
function foot(P, f, p, g) {
  const side = f === 'l' ? 1 : -1; const d = g.duty; let z, y, th, toe;
  if (p < d) { const u = p / d; z = g.zc + g.stride * (1 - 2 * u); y = DIM.ballY; th = lerp(g.th0, g.th1, ease(u)); toe = g.toe * sstep(0.65, 1, u); }
  else { const v = (p - d) / (1 - d); const e = ease(v); z = g.zc - g.stride + 2 * g.stride * e; y = DIM.ballY + g.lift * Math.pow(sin(PI * v), 0.85); th = lerp(g.th1, g.th0, e) + g.thUp * sin(PI * v); toe = g.toe * (1 - sstep(0, 0.45, v)) * 0.8 + 0.25 * sin(PI * v); }
  P[CH[f + 'fx']] = side * (DIM.ballX + g.spread); P[CH[f + 'fy']] = y; P[CH[f + 'fz']] = z; P[CH[f + 'fth']] = th; P[CH[f + 'ftoe']] = toe; P[CH[f + 'fyaw']] = side * 0.1;
}
const WALK = { stride: 0.40, duty: 0.62, lift: 0.17, zc: 0.06, th0: 52 * DEG, th1: 80 * DEG, thUp: 9 * DEG, toe: 0.5, spread: 0.0 };
const RUN = { stride: 0.60, duty: 0.40, lift: 0.34, zc: 0.04, th0: 46 * DEG, th1: 84 * DEG, thUp: 14 * DEG, toe: 0.7, spread: -0.02 };
const STALK = { stride: 0.30, duty: 0.70, lift: 0.14, zc: 0.08, th0: 50 * DEG, th1: 78 * DEG, thUp: 8 * DEG, toe: 0.4, spread: 0.02 };
export const GAIT = { walk: { T: 0.90, v: 2 * WALK.stride / (WALK.duty * 0.90) }, run: { T: 0.62, v: 2 * RUN.stride / (RUN.duty * 0.62) }, stalk: { T: 0.95, v: 2 * STALK.stride / (STALK.duty * 0.95) } };
export const GAITS = { WALK, RUN, STALK };

function gait(P, t, c, g, T, o) {
  const p = ((t / T) % 1 + 1) % 1; const pl = p, pr = (p + 0.5) % 1;
  foot(P, 'l', pl, g); foot(P, 'r', pr, g);
  const run = o.run || 0; const sp = sin(TAU * p), cp = cos(TAU * p);
  P[CH.rY] += run ? (-o.bob * cos(4 * PI * (p - 0.2)) - o.down) : (-o.bob * cos(4 * PI * p) - o.down);
  P[CH.rX] += o.sway * sp; P[CH.rR] += o.roll * sp; P[CH.rYaw] += -o.yaw * cp; P[CH.rP] += o.lean; P[CH.rZ] += o.rz || 0;
  P[CH.s0y] += 0.5 * o.yaw * cp; P[CH.s1y] += 0.9 * o.yaw * cp; P[CH.s2y] += 0.5 * o.yaw * cp;
  P[CH.s1p] += o.chest; P[CH.s2p] -= o.lean * 0.6; P[CH.n0p] -= o.lean * 0.5; P[CH.n1p] -= o.lean * 0.6; P[CH.hp] -= o.lean * 0.4;
  P[CH.s1r] -= o.roll * 0.8 * sp; P[CH.hr] += o.roll * 0.5 * sp; P[CH.hy] += 0.4 * o.yaw * cp;
  if (c.held) { holdWeapon(P, o.aim, sin(TAU * p * 2)); P[CH.a0y] += 0.012 * sin(TAU * p * 2 + 1); P[CH.a0z] += 0.02 * sin(TAU * p * 2 + 2); }
  else if (c.kind === 'hierarch') {
    const sw = o.arm * 0.5;
    arm(P, 1, 0.38, -0.46, 0.14 - sw * 0.3 * cp, -0.12, 0, 0, 0, 0.4, 0.25); arm(P, 0, 0.38, -0.46, 0.14 + sw * 0.3 * cp, -0.12, 0, 0, 0, 0.4, 0.25); lowerPair(P, t, 0.5);
  } else {
    for (const i of [0, 1]) {
      const ph = i === 1 ? -cp : cp; // left arm forward when the right leg is forward
      if (run) arm(P, i, 0.34, -0.36 + 0.07 * ph, 0.06 + 0.34 * ph, -0.4 - 0.5 * ph, 0, 0.4 * ph, 0.9, 0.9, 0.0);
      else arm(P, i, 0.40, -0.86 + 0.04 * Math.abs(ph) + o.armUp, 0.06 + o.arm * ph + o.armFwd, -0.1 * ph, 0, 0.05, 0.1 + 0.3 * Math.max(0, ph), 0.35 + 0.12 * ph, 0.1);
    }
  }
}
def('walk', GAIT.walk.T, true, (P, t, c) => { base(P, t, c); gait(P, t, c, WALK, GAIT.walk.T, { bob: 0.022, down: 0.0, sway: 0.016, roll: 0.02, yaw: 0.12, lean: 0.03, chest: 0.0, arm: 0.36, armUp: 0, armFwd: 0, aim: 0.12 }); }, { moveSpeed: GAIT.walk.v });
def('run', GAIT.run.T, true, (P, t, c) => { base(P, t, c); gait(P, t, c, RUN, GAIT.run.T, { run: 1, bob: 0.07, down: 0.13, sway: 0.02, roll: 0.03, yaw: 0.2, lean: 0.30, chest: 0.12, arm: 0.5, aim: 0.3, rz: 0.06 }); }, { moveSpeed: GAIT.run.v });
def('stalk', GAIT.stalk.T, true, (P, t, c) => { base(P, t, c); gait(P, t, c, STALK, GAIT.stalk.T, { bob: 0.02, down: 0.20, sway: 0.03, roll: 0.03, yaw: 0.14, lean: 0.34, chest: 0.12, arm: 0.2, armUp: 0.1, armFwd: 0.12, aim: 0.5, rz: 0.1 }); P[CH.hp] -= 0.2; P[CH.brow] = 0.6; P[CH.frill] = 0.9; P[CH.jt] = 0.1; }, { moveSpeed: GAIT.stalk.v });

// ------------------------------------------------------------------ AIM / FIRE
function aimBase(P, t, c, sw) {
  base(P, t, c);
  P[CH.lfx] += 0.07; P[CH.rfx] -= 0.07; P[CH.lfz] += 0.22; P[CH.rfz] -= 0.2; P[CH.lfth] += 0.08; P[CH.rfth] += 0.1; P[CH.rY] -= 0.1;
  P[CH.rYaw] = -0.25; P[CH.rP] = 0.06; P[CH.s1y] = 0.2; P[CH.s2y] = 0.08; P[CH.s2p] += 0.04; P[CH.hy] = 0.26; P[CH.hr] = -0.1; P[CH.hp] = -0.04; P[CH.n1p] -= 0.04;
  P[CH.rX] += 0.02 * sin(t * 1.7); P[CH.brow] = 0.7; P[CH.frill] = 0.7;
  if (c.held) holdWeapon(P, 1.0, sw, 0.0, 0.0); else { arm(P, 0, 0.18, -0.15, 0.38, -1.5, 0, 0, 0.1, 0.5, 0); arm(P, 1, 0.1, -0.2, 0.7, -1.5, 0, 0, 0, 0.5, 0); }
  if (c.kind === 'hierarch') lowerPair(P, t);
}
def('aim', 4.0, true, (P, t, c) => { aimBase(P, t, c, sin(t * 2.1) * 0.6); });
def('fire', 0.5, true, (P, t, c) => {
  aimBase(P, t, c, 0); const ph = (t / 0.5) % 1; const kick = Math.exp(-ph * 9) * (1 - Math.exp(-ph * 60));
  P[CH.rP] -= 0.05 * kick; P[CH.rZ] -= 0.03 * kick; P[CH.s2p] -= 0.08 * kick; P[CH.hp] -= 0.03 * kick; P[CH.a0z] -= 0.05 * kick; P[CH.a0rx] += 0.18 * kick; P[CH.eye] = 1 + 0.8 * Math.exp(-ph * 10);
  P[CH.weap] = Math.exp(-ph * 14); // muzzle flash hint (0..1) read by the hero
});

// ------------------------------------------------------------------ ROAR / COMMAND / SALUTE
def('roar', 2.8, false, (P, t, c) => {
  base(P, t, c); const wind = env(t, 0.0, 0.55, 2.0, 2.7), peak = env(t, 0.5, 0.75, 1.9, 2.5), crouch = sstep(0, 0.45, t) * (1 - sstep(0.5, 0.8, t));
  const trem = sin(t * 38) * peak;
  P[CH.rY] -= 0.12 * crouch; P[CH.rP] -= 0.08 * peak; P[CH.s0p] -= 0.12 * peak; P[CH.s1p] -= 0.2 * peak; P[CH.s2p] -= 0.34 * wind; P[CH.n0p] -= 0.2 * wind; P[CH.n1p] -= 0.15 * wind; P[CH.hp] -= 0.35 * peak + 0.12 * wind + 0.05 * trem;
  P[CH.mjaw] = 1.0 * peak + 0.03 * trem; P[CH.mwide] = 0.9 * peak; P[CH.frill] = 1.0 * wind; P[CH.brow] = 0.9 * wind; P[CH.eye] = 1 + 1.0 * peak; P[CH.jt] = 0.3 * peak * (0.5 + 0.5 * sin(t * 30));
  P[CH.lfx] += 0.1 * peak; P[CH.rfx] -= 0.1 * peak; P[CH.lfz] += 0.1 * peak; P[CH.rfz] -= 0.15 * peak;
  if (c.held) { holdWeapon(P, 0.1, 0); P[CH.a0y] += 0.35 * peak; P[CH.a0z] += 0.1 * peak; P[CH.a0rx] -= 0.5 * peak; P[CH.wlh] = 0; arm(P, 1, 0.30 + 0.28 * peak, -0.30 + 0.25 * peak, 0.2 + 0.3 * peak, -0.9, 0.2, 1.0, 0.1, 0.1, 1.0); }
  else { for (const i of [0, 1]) arm(P, i, 0.34 + 0.34 * peak, -0.55 + 0.45 * peak, 0.1 + 0.28 * peak + 0.1 * wind, -0.5 - 0.5 * peak, 0.3, 0.3, 0.1, 0.1 + 0.2 * (1 - peak), 1.0 * peak); if (c.kind === 'hierarch') lowerPair(P, t, 1, peak); }
});
def('command', 4.0, true, (P, t, c) => {
  base(P, t, c); const w = t * TAU / 4.0; const g = 0.5 + 0.5 * sin(w - 1.2); const sweep = sin(w * 1.0);
  P[CH.s2p] -= 0.1; P[CH.n1p] -= 0.05; P[CH.hp] -= 0.1; P[CH.s1y] += 0.12 * sweep; P[CH.hy] += 0.14 * sweep; P[CH.frill] = 0.85 + 0.15 * g; P[CH.mjaw] = 0.12 * g; P[CH.mwide] = 0.2 * g; P[CH.brow] = 0.4; P[CH.eye] = 1.2;
  P[CH.rX] += 0.01 * sin(w); P[CH.rZ] += 0.04 * g;
  if (c.held) { holdWeapon(P, 0.0, 0); P[CH.a0y] += 0.12; P[CH.a0rx] -= 0.1; P[CH.wlh] = 0; }
  else arm(P, 0, 0.12 + 0.2 * g, -0.12 + 0.28 * g, 0.5 + 0.2 * g, -1.4 - 0.2 * g, 0.2 + 0.4 * sweep, 0.0, 0.0, 0.05, 0.6);
  arm(P, 1, 0.5, -0.35 + 0.1 * g, 0.3, -1.1, 0.3, 1.3, 0, 0.15, 0.8);
  if (c.kind === 'hierarch') lowerPair(P, t, 1, 0.5 * g);
});
def('salute', 3.0, true, (P, t, c) => {
  base(P, t, c); const w = t * TAU / 3.0;
  P[CH.rY] += 0.02; P[CH.s2p] -= 0.12; P[CH.n0p] -= 0.05; P[CH.hp] -= 0.04; P[CH.eye] = 1.1;
  P[CH.rYaw] = 0; P[CH.lfx] += 0.03; P[CH.rfx] -= 0.03;
  arm(P, 1, 0.14, 0.34 + 0.01 * sin(w), 0.34, -1.2, 0.0, -0.4, 0.0, 0.0, 0.0);
  if (c.held) { holdWeapon(P, 0.0, 0); P[CH.a0x] = -0.30; P[CH.a0y] = -0.72; P[CH.a0z] = 0.10; P[CH.a0rx] = -0.2; P[CH.a0ry] = 0; P[CH.wlh] = 0; P[CH.a0gr] = 0.9; } else arm(P, 0, 0.38, -0.88, 0.1, 0, 0, 0, 0, 0.5, 0);
  if (c.kind === 'hierarch') lowerPair(P, t);
});

// ------------------------------------------------------------------ TALK
function talkBase(P, t, c) {
  base(P, t, c); const w = t * TAU / 7.0;
  P[CH.rX] += 0.012 * sin(w); P[CH.rR] += 0.015 * sin(w + 1); P[CH.rYaw] += 0.03 * sin(w * 0.7); P[CH.s1y] += 0.04 * sin(w * 0.7 + 1);
  P[CH.hy] += 0.07 * sin(w * 0.7 + 2); P[CH.hp] += 0.02 * sin(w * 1.3);
  if (c.kind === 'hierarch') P[CH.frill] += 0.12 * sin(w * 1.1);
}
def('talk_a', 6.0, true, (P, t, c) => {
  talkBase(P, t, c); const E = 0.35 + 0.65 * (c.E || 0);
  const b1 = bump(t, 0.55, 0.0), b2 = bump(t, 0.43, 0.3), b3 = bump(t, 0.8, 0.6);
  if (c.held) { holdWeapon(P, 0.0, 0); P[CH.a0rx] -= 0.2; P[CH.a0x] -= 0.06; P[CH.a0y] -= 0.1; P[CH.a0z] -= 0.05; P[CH.wlh] = 0; arm(P, 1, 0.36, -0.62 + 0.3 * b2 * E, 0.2 + 0.14 * b2 * E, -0.9, 0.0, 1.2, 0, 0.2, 0.5); }
  else if (c.kind === 'hierarch') { arm(P, 0, 0.34 + 0.1 * b1 * E, -0.34 + 0.30 * b1 * E, 0.30 + 0.22 * b1 * E, -1.25, 0.15, 1.2, 0.0, 0.1, 0.8); arm(P, 1, 0.42, -0.5 + 0.28 * b2 * E, 0.2 + 0.14 * b2 * E, -1.0, 0.0, 1.1, 0, 0.1, 0.8); lowerPair(P, t, 1, 0.3 * b3 * E); }
  else {
    arm(P, 0, 0.30 + 0.06 * b1 * E, -0.50 + 0.30 * b1 * E, 0.26 + 0.20 * b1 * E, -1.2, 0.1, 1.15, 0.0, 0.2, 0.5);
    arm(P, 1, 0.36, -0.62 + 0.24 * b2 * E, 0.18 + 0.12 * b2 * E, -0.9, 0.0, 1.0, 0.0, 0.25, 0.5);
  }
  P[CH.s2p] += 0.04 * b1 * E; P[CH.hp] += 0.03 * b3 * E;
});
def('talk_b', 6.0, true, (P, t, c) => {
  talkBase(P, t, c); const E = 0.35 + 0.65 * (c.E || 0);
  const b1 = bump(t, 0.9, 0.0, 9), b2 = bump(t, 0.9, 0.5, 9), b3 = bump(t, 0.45, 0.2);
  P[CH.rY] -= 0.02 * b1 * E; P[CH.s1p] += 0.05 * b1 * E; P[CH.hp] += 0.07 * b1 * E; P[CH.brow] = 0.35 * E; P[CH.s2y] += 0.05 * sin(t * 1.1);
  if (c.held) { holdWeapon(P, 0.0, 0); P[CH.wlh] = 0; P[CH.a0rx] -= 0.3; P[CH.a0y] -= 0.1; arm(P, 1, 0.34 + 0.1 * b2 * E, -0.45 + 0.3 * b2 * E, 0.3 + 0.2 * b2 * E, -1.3, 0.1, 0.4, 0, 0.3, 0.7); }
  else if (c.kind === 'hierarch') { arm(P, 0, 0.36 + 0.12 * b1 * E, -0.30 + 0.34 * b1 * E, 0.34 + 0.22 * b1 * E, -1.35, 0.2, -0.6, 0, 0.1, 0.8); arm(P, 1, 0.36 + 0.12 * b2 * E, -0.30 + 0.34 * b2 * E, 0.34 + 0.22 * b2 * E, -1.35, 0.2, -0.6, 0, 0.1, 0.8); lowerPair(P, t, 1, 0.6 * b3 * E); }
  else {
    arm(P, 0, 0.30 + 0.1 * b1 * E, -0.45 + 0.34 * b1 * E, 0.32 + 0.2 * b1 * E, -1.3 - 0.2 * b1, 0.2, 0.2 * b1, 0.0, 0.5 - 0.3 * b1, 0.3);
    arm(P, 1, 0.30 + 0.1 * b2 * E, -0.45 + 0.34 * b2 * E, 0.32 + 0.2 * b2 * E, -1.3 - 0.2 * b2, 0.2, 0.2 * b2, 0.0, 0.5 - 0.3 * b2, 0.3);
  }
});

// ------------------------------------------------------------------ HIT / DEATH
def('stagger', 1.2, false, (P, t, c) => {
  base(P, t, c); const hit = Math.exp(-t * 4.5) * sstep(0, 0.06, t), back = sstep(0, 0.2, t) * (1 - sstep(0.3, 1.1, t));
  P[CH.rP] -= 0.22 * hit; P[CH.rZ] -= 0.12 * back; P[CH.s1p] -= 0.25 * hit; P[CH.s2p] -= 0.2 * hit; P[CH.hp] -= 0.3 * hit; P[CH.hr] += 0.2 * hit; P[CH.s1y] += 0.25 * hit; P[CH.rYaw] += 0.2 * hit;
  P[CH.mjaw] = 0.7 * hit; P[CH.mwide] = 0.6 * hit; P[CH.eye] = 1 + 1.2 * hit; P[CH.rY] -= 0.1 * back;
  const step = sstep(0.1, 0.4, t) * (1 - sstep(0.6, 1.0, t)); P[CH.lfz] -= 0.28 * step; P[CH.lfy] += 0.12 * Math.sin(PI * clamp((t - 0.1) / 0.5)); P[CH.rfz] -= 0.12 * step;
  if (c.held) { holdWeapon(P, 0.1, 0); P[CH.a0y] += 0.18 * hit; P[CH.a0z] -= 0.1 * hit; P[CH.wlh] = 1 - hit; arm(P, 1, 0.34 + 0.3 * hit, -0.5 + 0.4 * hit, 0.1 - 0.1 * hit, -0.6, 0.3, 0.5, 0, 0.1, 1); }
  else for (const i of [0, 1]) arm(P, i, 0.4 + 0.3 * hit, -0.88 + 0.55 * hit, 0.06 - 0.12 * hit, -0.4 * hit, 0.3, 0.5, 0, 0.1, 0.8 * hit);
  if (c.kind === 'hierarch') lowerPair(P, t, 1, hit);
});
def('die', 2.8, false, (P, t, c) => {
  base(P, t, c);
  const hit = Math.exp(-t * 5) * sstep(0, 0.05, t); const buckle = sstep(0.25, 1.0, t); const fall = sstep(0.95, 2.1, t); const k = fall * fall * (3 - 2 * fall);
  P[CH.s1p] -= 0.25 * hit; P[CH.s2p] -= 0.25 * hit; P[CH.hp] -= 0.3 * hit; P[CH.s1y] += 0.25 * hit; P[CH.mjaw] = 0.8 * hit + 0.35 * k; P[CH.mwide] = 0.5 * hit; P[CH.eye] = (1 + 1.2 * hit) * (1 - 0.92 * sstep(0.8, 2.4, t));
  const drop = buckle * (1 - k);
  P[CH.rY] += -0.52 * drop; P[CH.rZ] += 0.04 * buckle - 0.1 * k; P[CH.rP] += 0.2 * buckle * (1 - k);
  if (k > 0) { P[CH.rP] = lerp(P[CH.rP], -1.5, k); P[CH.rY] = lerp(P[CH.rY], -1.07, k); P[CH.rZ] = lerp(P[CH.rZ], -1.0, k); P[CH.s2p] += 0.12 * k; P[CH.hp] += 0.35 * k; P[CH.hr] += 0.4 * k; }
  P[CH.lfz] += 0.1 * buckle - 0.3 * k; P[CH.rfz] += 0.0 - 0.3 * k; P[CH.lfx] += 0.1 * k; P[CH.rfx] -= 0.1 * k; P[CH.lfth] += 0.2 * k; P[CH.rfth] += 0.2 * k;
  if (c.held) { holdWeapon(P, 0.1, 0); P[CH.a0y] += 0.3 * k; P[CH.a0x] -= 0.2 * k; P[CH.a0z] -= 0.1 * k; P[CH.wlh] = 1 - sstep(0, 0.4, t); }
  const flail = sin(t * 9) * 0.1 * (1 - k) * buckle;
  for (const i of [0, 1]) { if (c.held && i === 0) continue; arm(P, i, 0.4 + 0.3 * hit + 0.2 * k, -0.88 + 0.5 * hit - 0.2 * k + flail, 0.06 - 0.15 * hit - 0.1 * k, -0.3 * hit, 0.3, 0.5, 0, 0.1, 0.5 + 0.4 * k); }
  if (c.kind === 'hierarch') lowerPair(P, t, 1, 0.5 * k);
});
def('dead', 4.0, true, (P, t, c) => {
  base(P, t, c);
  P[CH.rP] = -1.5; P[CH.rZ] = -1.0; P[CH.rY] = -1.07; P[CH.s2p] += 0.12; P[CH.hp] += 0.35; P[CH.hr] += 0.4; P[CH.mjaw] = 0.35; P[CH.eye] = 0.06 + 0.04 * sin(t * 0.7);
  P[CH.lfx] += 0.1; P[CH.rfx] -= 0.16; P[CH.lfz] -= 0.3; P[CH.rfz] -= 0.1; P[CH.lfth] += 0.2; P[CH.rfth] += 0.5; P[CH.lfy] = 0.03;
  P[CH.frill] = 0.1; P[CH.brow] = -0.6;
  if (c.held) { holdWeapon(P, 0.1, 0); P[CH.a0y] += 0.3; P[CH.a0x] -= 0.2; P[CH.a0z] -= 0.1; P[CH.wlh] = 0; arm(P, 1, 0.5, -0.7, 0.0, -0.3, 0.3, 0.5, 0, 0.2, 0.3); }
  else { arm(P, 0, 0.55, -0.7, -0.05, -0.3, 0.3, 0.5, 0, 0.2, 0.3); arm(P, 1, 0.45, -0.85, 0.1, -0.2, 0.3, 0.5, 0, 0.2, 0.3); }
  if (c.kind === 'hierarch') lowerPair(P, t, 0, 0.3);
});

// ------------------------------------------------------------------ CLIMB / KNEEL
def('climb', 1.4, true, (P, t, c) => {
  base(P, t, c); const p = (t / 1.4) % 1; const a = sin(TAU * p);
  P[CH.rZ] += 0.14; P[CH.rY] -= 0.30; P[CH.rP] += 0.12; P[CH.s1p] += 0.1; P[CH.s2p] += 0.05; P[CH.rX] += 0.03 * a; P[CH.hp] -= 0.2; P[CH.n1p] -= 0.1; P[CH.rR] += 0.04 * a; P[CH.eye] = 1.1; P[CH.brow] = 0.3;
  for (const [f, s, ph] of [['l', 1, 0], ['r', -1, 0.5]]) {
    const q = (p + ph) % 1; const up = sin(TAU * q);
    P[CH[f + 'fx']] = s * 0.2; P[CH[f + 'fz']] = 0.32 + 0.03 * up; P[CH[f + 'fy']] = 0.12 + 0.34 * (0.5 - 0.5 * cos(TAU * q)) - 0.16; P[CH[f + 'fth']] = 60 * DEG + 0.4 * Math.max(0, up); P[CH[f + 'ftoe']] = 0.5 * Math.max(0, -up); P[CH[f + 'fyaw']] = s * 0.1;
  }
  for (const i of [0, 1]) { const q = (p + (i === 1 ? 0 : 0.5)) % 1; const reach = 0.5 - 0.5 * cos(TAU * q);
    arm(P, i, 0.26, 0.12 + 0.42 * reach, 0.42, -2.5 + 0.2 * reach, 0.0, 0.0, 0.2, 0.9 - 0.2 * Math.max(0, sin(TAU * q)), 0.1); }
  if (c.held) { P[CH.wlh] = 0; P[CH.a0gr] = 0.9; }
  if (c.kind === 'hierarch') lowerPair(P, t, 0.4);
}, { moveSpeed: 0.8 });
def('kneel', 5.0, true, (P, t, c) => {
  base(P, t, c); const w = t * TAU / 5.0; const br = sin(w);
  P[CH.rY] = -0.56; P[CH.rZ] = -0.02; P[CH.rP] += 0.12; P[CH.s0p] += 0.2; P[CH.s1p] += 0.22; P[CH.s2p] += 0.12; P[CH.n0p] += 0.2; P[CH.n1p] += 0.1; P[CH.hp] += 0.3 + 0.02 * br;
  P[CH.lfz] = 0.34; P[CH.lfx] = DIM.ballX + 0.04; P[CH.lfth] = 56 * DEG; P[CH.lfy] = DIM.ballY;
  P[CH.rfz] = -0.42; P[CH.rfx] = -DIM.ballX; P[CH.rfth] = 84 * DEG; P[CH.rfy] = DIM.ballY; P[CH.rftoe] = 0.5;
  P[CH.rYaw] = 0.0; P[CH.s1y] = 0.0; P[CH.hy] += 0.05 * sin(w * 0.5); P[CH.frill] = 0.1; P[CH.brow] = -0.3; P[CH.eye] = 0.8;
  if (c.held) { holdWeapon(P, 0.0, 0); P[CH.a0x] = -0.35; P[CH.a0y] = -0.78; P[CH.a0z] = 0.3; P[CH.a0rx] = -0.2; P[CH.wlh] = 0; arm(P, 1, 0.3, -0.62, 0.42, -0.2, 0.2, 0.2, 0, 0.9, 0); }
  else { arm(P, 0, 0.34, -0.82, 0.45, -0.1, 0.2, 0, 0, 0.9, 0); arm(P, 1, 0.34, -0.70, 0.25, -0.2, 0.0, 0, 0, 0.5, 0); }
  if (c.kind === 'hierarch') lowerPair(P, t);
});

// ------------------------------------------------------------------ INFECTED
const infBase = (P, t, c) => {
  base(P, t, c); const f = t * 6;
  P[CH.s0p] += 0.22; P[CH.s1p] += 0.25; P[CH.s2p] += 0.12; P[CH.n0p] -= 0.15; P[CH.n1p] -= 0.1; P[CH.hp] += 0.1; P[CH.rY] -= 0.08; P[CH.rP] += 0.1;
  P[CH.hr] += 0.25 + 0.1 * wob(f, 1); P[CH.hy] += 0.25 * wob(f * 0.7, 2); P[CH.brow] = 0.9; P[CH.frill] = 1.0; P[CH.eye] = 1.4 + 0.5 * wob(t * 12, 4);
  P[CH.mjaw] = 0.3 + 0.2 * wob(t * 9, 5); P[CH.mwide] = 0.4;
};
def('infected_idle', 3.2, true, (P, t, c) => {
  infBase(P, t, c); const w = t * TAU / 3.2;
  P[CH.rX] += 0.04 * wob(w * 2, 1); P[CH.rYaw] += 0.12 * wob(w * 1.5, 2); P[CH.rR] += 0.07 * wob(w * 1.7, 3); P[CH.s1r] += 0.1 * wob(w * 2.2, 4); P[CH.s1y] += 0.15 * wob(w * 1.3, 5);
  P[CH.lfx] += 0.06; P[CH.rfx] -= 0.06; P[CH.lfz] += 0.1 * wob(w, 6); P[CH.rfz] -= 0.05 * wob(w, 7); P[CH.lfy] += Math.max(0, 0.06 * wob(w * 2.1, 8));
  const jerk = Math.max(0, sin(t * 3.1)) ** 8;
  for (const i of [0, 1]) arm(P, i, 0.42 + 0.06 * wob(w, i + 10), -0.9 + 0.1 * wob(w * 1.4, i + 11) + 0.25 * jerk, 0.12 + 0.12 * wob(w * 1.8, i + 12), -0.3 + 0.3 * wob(w, i + 13), 0.2, 0.3, 0.3, 0.7, 0.8);
  if (c.held) { P[CH.wlh] = 0; }
  if (c.kind === 'hierarch') lowerPair(P, t, 2, 0.6 * Math.max(0, wob(w, 3)));
});
const INF_T = GAIT.run.T * 1.05;
def('infected_run', INF_T, true, (P, t, c) => {
  infBase(P, t, c); gait(P, t, { ...c, held: false }, RUN, INF_T, { run: 1, bob: 0.09, down: 0.2, sway: 0.05, roll: 0.07, yaw: 0.28, lean: 0.42, chest: 0.2, arm: 0.5, aim: 0.3, rz: 0.12 });
  const f = t * 9; P[CH.s1r] += 0.18 * wob(f, 1); P[CH.s2y] += 0.2 * wob(f * 1.3, 2); P[CH.hy] += 0.5 * wob(f * 1.1, 3); P[CH.hr] += 0.3 * wob(f, 4); P[CH.hp] -= 0.3 + 0.2 * wob(f * 1.7, 5);
  P[CH.mjaw] = 0.7 + 0.3 * sin(t * 22); P[CH.mwide] = 0.6;
  for (const i of [0, 1]) { const p = ((t / INF_T) % 1 + 1) % 1; const ph = i === 1 ? -cos(TAU * p) : cos(TAU * p); arm(P, i, 0.4 + 0.1 * ph, -0.2 + 0.15 * ph + 0.1 * wob(f, i), 0.3 + 0.4 * ph, -1.0 - 0.6 * ph, 0.3, 0.6 * ph, 0.2, 0.2, 1.0); }
  if (c.kind === 'hierarch') lowerPair(P, t, 2, 1);
}, { moveSpeed: 2 * RUN.stride / (RUN.duty * INF_T) });
def('infected_lunge', 1.6, false, (P, t, c) => {
  infBase(P, t, { ...c, held: false });
  const coil = sstep(0.0, 0.45, t) * (1 - sstep(0.45, 0.6, t)), fl = sstep(0.45, 0.65, t) * (1 - sstep(1.05, 1.35, t)), land = sstep(1.0, 1.15, t) * (1 - sstep(1.3, 1.6, t));
  const travel = sstep(0.45, 1.1, t); const D = 2.6; const arc = Math.sin(PI * clamp((t - 0.45) / 0.65)); const rZ = D * travel;
  P[CH.rZ] = rZ - 0.15 * coil; P[CH.rY] = -0.36 * coil + 0.55 * arc - 0.25 * land; P[CH.rP] = -0.2 * coil + 0.5 * fl + 0.1 * land; P[CH.s1p] += 0.2 * coil; P[CH.s2p] -= 0.3 * fl; P[CH.n1p] -= 0.2 * fl; P[CH.hp] -= 0.3 * fl;
  P[CH.mjaw] = 0.5 + 0.5 * fl; P[CH.mwide] = 0.6 + 0.4 * fl; P[CH.eye] = 2.0;
  for (const [f, s] of [['l', 1], ['r', -1]]) {
    const inAir = t > 0.5 && t < 1.08; const base0 = DIM.ballZ - 0.12 * coil;
    const fz = t < 0.5 ? base0 : inAir ? rZ - 0.25 + (f === 'l' ? 0.12 : 0) : rZ + DIM.ballZ + (f === 'l' ? 0.1 : -0.05);
    P[CH[f + 'fz']] = fz; P[CH[f + 'fy']] = DIM.ballY + (inAir ? 0.55 * arc + 0.12 : 0); P[CH[f + 'fth']] = 70 * DEG + 0.5 * fl; P[CH[f + 'ftoe']] = 0.7 * fl; P[CH[f + 'fx']] = s * (DIM.ballX + 0.04 * fl);
  }
  for (const i of [0, 1]) arm(P, i, 0.32 + 0.12 * fl, -0.5 + 0.55 * fl - 0.2 * coil, 0.2 + 0.7 * fl - 0.1 * coil, -1.2 - 0.3 * fl, 0.3 * fl, 0.4, 0.1, 0.1, 1.0);
  if (c.kind === 'hierarch') lowerPair(P, t, 2, fl);
});

export const CLIPS = clips;
export function clipNames() { return Object.keys(clips); }
export function evalClip(name, t, c, P) {
  const cl = clips[name] || clips.idle; cl.fn(P, cl.loop ? t : Math.min(t, cl.dur), c); return cl;
}
