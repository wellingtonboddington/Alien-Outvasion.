// Procedural clips, part 2: combat, work, floor poses, zombies.
import * as THREE from 'three';
import { sn, wave, ease, lerpn, fkPos, fkQuat } from './anim_core.js';
import { clamp, smoothstep } from '../../engine/common.js';
import { stand, gait, relaxedArm, idleCore, mixo, seedOf, hash, fract, beatState } from './clips_basic.js';

const TAU = Math.PI * 2;
const sm = (a, b, x) => smoothstep(a, b, x);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RX = (a) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);
const RY = (a) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3();
const Rfwd = RX(-Math.PI / 2);   // hand frame with fingers pointing forward, thumb up

/** rig-space position of a prop anchor held in hand S (falls back to fallback fn) */
function anchor(h, S, name, fb) {
  return (out) => {
    const pr = h.prop; const hb = h.rig.bones['hand' + S];
    if (pr && pr.anchors && pr.anchors[name]) {
      const a = pr.anchors[name]; const ob = pr.obj;
      out.copy(a).applyQuaternion(ob.quaternion).add(ob.position);
      fkQuat(hb, _q); out.applyQuaternion(_q); fkPos(hb, _p); return out.add(_p);
    }
    return fb(out);
  };
}
const chestFrame = (h, off, out, side) => { // point relative to a shoulder in chest-oriented frame
  const b = h.rig.bones; fkPos(b['upperArm' + side], out); fkQuat(b.chest, _q2); return out.add(_p2.copy(off).applyQuaternion(_q2));
};
function aimBase(B, t, p, h, o = {}) {
  const sd = seedOf(h);
  const s = h.profile.height / 1.75;
  stand(B, { gap: 0.1 * 0 + 0.02, yaw: 0.1, zL: 0.17 * s, zR: -0.2 * s, lim: o.lim ?? 0.96 });
  // blade the body: turn pelvis to the right a bit, shoulders squared
  B.hipsRot(0.0, -0.35, 0); B.spine(o.lean ?? 0.06, 0.38, 0); B.shoulder('R', 0.0, 0.2);
  const pitch = (p.pitch ?? 0) + 0.012 * sn(t * 0.7, sd);
  const yawJit = 0.01 * sn(t * 0.9, sd + 2);
  B.head(0.06 + pitch * 0.3, yawJit - 0.04, -0.08);
  // right hand: pistol grip near right shoulder in chest frame
  const aim = RX(pitch);
  B.handIK('R', (out) => chestFrame(h, V(0.0, -0.095, 0.255), out, 'R'), { pole: V(-0.5, -1, -0.2), rot: undefined });
  B.handIK('L', anchor(h, 'R', 'foregrip', (out) => chestFrame(h, V(0.07, -0.07, 0.5), out, 'R')), { pole: V(0.6, -1, -0.1) });
  B.fingers('R', 'grip_rifle'); B.fingers('L', 'support');
  B.extra.aimBlend = 1;
  B.extra.rifleQuat = (out) => { fkQuat(h.rig.bones.chest, out); return out; };
}
const aim_rifle = (B, t, p, h) => { aimBase(B, t, p, h); };
const aim_walk = (B, t, p, h) => {
  const g = gait(B, t, h, { cad0: 1.2, cad1: 0.5, sf: 0.64, lift: 0.05, lean: 0.06, noArms: true, v: p.speed ?? 1.1, limit: 0.9, hipTwist: 0.04, shTwist: 0.04, drop: 0.015, toeOut: 0.05 });
  // upper body from aim pose but keep gait legs/hips
  const sd = seedOf(h);
  B.spine(0.08, 0.2, 0); B.head(0.04, -0.05, 0);
  B.handIK('R', (out) => chestFrame(h, V(0.0, -0.095, 0.255), out, 'R'), { pole: V(-0.5, -1, -0.2) });
  B.handIK('L', anchor(h, 'R', 'foregrip', (out) => chestFrame(h, V(0.07, -0.07, 0.5), out, 'R')), { pole: V(0.6, -1, -0.1) });
  B.fingers('R', 'grip_rifle'); B.fingers('L', 'support');
};
const shoot = (B, t, p, h) => {
  aimBase(B, t, p, h);
  const rate = p.rate ?? 2.2; const ph = fract(t * rate); const k = Math.exp(-ph * 14) * (p.recoil ?? 1);
  B.add('spine', -0.025 * k, 0, 0); B.add('chest', -0.03 * k, 0.01 * k, 0); B.head(0.05 + 0.04 * k, -0.04, -0.08);
  B.hips(0, 0, -0.012 * k);
  B.extra.recoil = k;
};
const aim_pistol = (B, t, p, h) => {
  const sd = seedOf(h);
  stand(B, { gap: 0.03, yaw: 0.12, zL: 0.12, zR: -0.1, lim: 0.96 }); B.hipsRot(0, -0.2, 0); B.spine(0.04, 0.2, 0); B.head(0.05, -0.1, 0);
  B.handIK('R', (out) => chestFrame(h, V(0.03, -0.09, 0.42), out, 'R'), { pole: V(-0.4, -1, -0.3) });
  B.handIK('L', (out) => chestFrame(h, V(0.0, -0.1, 0.4), out, 'L'), { pole: V(0.4, -1, -0.3) });
  B.fingers('R', 'grip_rifle'); B.fingers('L', 'support');
  B.add('spine', 0.01 * sn(t, sd), 0, 0);
};
const aim_shotgun = (B, t, p, h) => { aimBase(B, t, p, h, { lean: 0.09 }); B.handIK('L', anchor(h, 'R', 'foregrip', (out) => chestFrame(h, V(0.05, -0.1, 0.52), out, 'R')), { pole: V(0.6, -1, -0.1) }); };
const reload = (B, t, p, h) => {
  const T = 3.0, u = fract(t / T);
  aimBase(B, t, { ...p, pitch: 0.0 }, h, { lean: 0.1 });
  // phases: 0-.2 lower, .2-.45 mag out & pouch, .45-.75 insert, .75-1 raise
  const low = sm(0, 0.2, u) * (1 - sm(0.78, 0.98, u));
  const pouch = sm(0.2, 0.4, u) * (1 - sm(0.4, 0.5, u));
  B.spine(0.1 + 0.12 * low, 0.38 - 0.1 * low, 0); B.head(0.1 + 0.2 * low, -0.04, -0.05);
  B.handIK('R', (out) => chestFrame(h, V(0.0, -0.17 * low - 0.095, 0.24), out, 'R'), { pole: V(-0.5, -1, -0.2) });
  // left hand goes to pouch (chest front-low) then to magwell
  B.handIK('L', (out) => {
    const mag = anchor(h, 'R', 'magwell', (o) => chestFrame(h, V(0.03, -0.2, 0.32), o, 'R'))(out);
    chestFrame(h, V(0.08, -0.32, 0.12), _p2, 'L');
    const toPouch = sm(0.18, 0.4, u) * (1 - sm(0.42, 0.52, u)); const near = sm(0.45, 0.62, u) * (1 - sm(0.72, 0.9, u));
    const fore = anchor(h, 'R', 'foregrip', (o) => chestFrame(h, V(0.07, -0.07, 0.5), o, 'R'))(_p);
    out.copy(fore); out.lerp(_p2, toPouch); out.lerp(mag, near); return out;
  }, { pole: V(0.6, -1, -0.1) });
  B.extra.reloadPhase = u;
};
const carry = (B, t, p, h) => {
  idleCore(B, t, p, h, { lean: -0.03 }); const sd = seedOf(h);
  B.arm('L', { raise: 1.05, abd: 0.1, rot: 0.3, elbow: 1.5, pron: -0.8, wflex: -0.1 }); B.arm('R', { raise: 1.05, abd: 0.1, rot: 0.3, elbow: 1.5, pron: -0.8, wflex: -0.1 });
  B.fingers('L', 'carry'); B.fingers('R', 'carry'); B.spine(-0.08, 0, 0); B.head(0.1, 0.05 * sn(t * 0.4, sd), 0);
};
const push = (B, t, p, h) => {
  const sd = seedOf(h); const s = Math.sin(t * TAU * 0.9) * 0.5 + 0.5;
  stand(B, { gap: 0.05, yaw: 0.1, zL: 0.28, zR: -0.3, lim: 0.9 }); B.hips(0, 0, 0.08 + 0.03 * s);
  B.hipsRot(0.1, 0, 0); B.spine(0.45 + 0.04 * s, 0, 0); B.head(-0.3, 0, 0);
  B.arm('L', { raise: 1.45, abd: 0.12, rot: 0.2, elbow: 0.25 + 0.2 * (1 - s), pron: 0.9, wflex: -0.4 }); B.arm('R', { raise: 1.45, abd: 0.12, rot: 0.2, elbow: 0.25 + 0.2 * (1 - s), pron: 0.9, wflex: -0.4 });
  B.fingers('L', 'flat'); B.fingers('R', 'flat');
};
const lift = (B, t, p, h) => {
  const T = 2.8, u = fract(t / T); const down = Math.sin(Math.PI * Math.min(1, u * 1.1)); const c = Math.pow(down, 0.9);
  stand(B, { gap: 0.08, yaw: 0.16, zL: 0.04, zR: -0.04, lim: 0.78 + 0.2 * (1 - c) }); B.hipsRot(0.1 * c, 0, 0);
  B.spine(0.8 * c - 0.05, 0, 0); B.head(-0.5 * c, 0, 0);
  B.arm('L', { raise: 0.35 + 0.9 * (1 - c) * 0.5 + 0.5 * c, abd: 0.15, rot: 0.2, elbow: 0.2 + 1.2 * (1 - c), pron: 0.4, wflex: 0 }); B.arm('R', { raise: 0.35 + 0.9 * (1 - c) * 0.5 + 0.5 * c, abd: 0.15, rot: 0.2, elbow: 0.2 + 1.2 * (1 - c), pron: 0.4, wflex: 0 });
  B.fingers('L', 'carry'); B.fingers('R', 'carry');
};
const stagger = (B, t, p, h) => {
  const T = 1.1, u = clamp(t / T, 0, 1); const hit = Math.exp(-u * 4) * Math.sin(Math.min(1, u * 6) * Math.PI / 2);
  const dirK = p.dir ?? 1;
  stand(B, { gap: 0.04, yaw: 0.12, zL: 0.2 * u * (1 - u) * 3, zR: -0.2 * hit - 0.1, lim: 0.93 });
  B.hips(0.03 * dirK * hit, 0, -0.12 * hit); B.hipsRot(-0.2 * hit, 0.3 * hit * dirK, 0.12 * hit * dirK); B.spine(-0.25 * hit + 0.1 * u * (1 - u), 0.25 * hit * dirK, 0); B.head(-0.3 * hit, -0.2 * hit * dirK, 0);
  B.arm('L', { raise: 0.9 * hit, abd: 0.7 * hit, rot: -0.3, elbow: 0.5 * hit + 0.2, pron: 0.3, wflex: 0 }); B.arm('R', { raise: 0.3 * hit, abd: 0.5 * hit, rot: -0.2, elbow: 0.7 * hit + 0.2, pron: 0.3, wflex: 0 });
  B.fingers('L', 'claw', hit); B.fingers('R', 'claw', hit);
};
// ---- floor poses
function lying(B, p, o = {}) {
  const side = p.side ?? 0;
  B.hips(0, 0.13 - B.J.hips.y + (o.hy || 0), 0.18); B.hipsRot(-Math.PI / 2 + 0.03, 0, side * 0.5);
}
const dead = (B, t, p, h) => {
  const sd = seedOf(h); const side = p.side ?? 0;
  lying(B, p);
  B.spine(0.0, 0.15 * side, 0); B.head(0.05, 0.5 * (side || 1) * 0.5, 0.2 * (side || 1));
  B.arm('L', { raise: -0.2, abd: 0.5 + 0.2 * (sd % 1), rot: -0.2, elbow: 0.25, pron: -0.3, wflex: 0.1 }); B.arm('R', { raise: -0.3, abd: 0.9, rot: -0.1, elbow: 0.3, pron: -0.4, wflex: 0.1 });
  B.leg('L', { hip: 0.0, abd: 0.12, rot: -0.2, knee: 0.0, ankle: 0.2 }); B.leg('R', { hip: -0.2 * (sd % 1), abd: 0.3, rot: -0.4, knee: 0.1, ankle: 0.2 });
  B.fingers('L', 'relaxed'); B.fingers('R', 'relaxed');
};
const fall = (B, t, p, h) => {
  const T = 1.4, u = clamp(t / T, 0, 1); const c = ease(Math.min(1, u * 1.15)); const c2 = Math.pow(c, 1.6);
  const dirK = p.dir ?? 1;
  // buckle then topple backwards
  const bucket = Math.sin(Math.min(1, u * 2.2) * Math.PI) * 0.5;
  B.hips(0, lerpn(0, 0.13 - B.J.hips.y, c2) - 0.2 * bucket * (1 - c2), lerpn(0, 0.18, c2) - 0.1 * (1 - c2) * c);
  B.hipsRot(-(Math.PI / 2 - 0.03) * c2 + 0.2 * bucket, 0.2 * c * dirK, 0);
  B.spine(-0.3 * (1 - c2) + 0.1 * bucket, 0, 0); B.head(-0.3 * (1 - c2) * c, 0.3 * c * dirK, 0);
  B.leg('L', { hip: 0.9 * bucket * (1 - c2), knee: 1.2 * bucket * (1 - c2), abd: 0.12 * c2 }); B.leg('R', { hip: 0.5 * bucket * (1 - c2), knee: 0.9 * bucket * (1 - c2), abd: 0.3 * c2 });
  B.arm('L', { raise: 1.2 * (1 - c2) + -0.2 * c2, abd: 0.9 * (1 - c2) + 0.5 * c2, rot: -0.3, elbow: 0.4, pron: 0.3, wflex: 0 }); B.arm('R', { raise: 0.8 * (1 - c2), abd: 1.0, rot: -0.3, elbow: 0.4, pron: 0.3, wflex: 0 });
  B.fingers('L', 'claw', 1 - c2); B.fingers('R', 'claw', 1 - c2);
};
const get_up = (B, t, p, h) => {
  const T = 2.6, u = clamp(t / T, 0, 1);
  const roll = sm(0.0, 0.3, u), kneel = sm(0.25, 0.6, u), stand_ = sm(0.55, 1.0, u);
  const hipsPitch = lerpn(lerpn(-(Math.PI / 2 - 0.03), 0.9, roll), 0.0, stand_ * 0 + kneel * 0.0) ;
  // stage 1: lying -> sit/prone-on-hands-knees ; stage 2: hands-knees -> kneel upright ; stage 3 : stand
  const pitch = u < 0.3 ? lerpn(-(Math.PI / 2 - 0.03), 0.95, ease(u / 0.3)) : u < 0.6 ? lerpn(0.95, 0.25, ease((u - 0.3) / 0.3)) : lerpn(0.25, 0, ease((u - 0.6) / 0.4));
  const hipsY = u < 0.3 ? lerpn(0.13, B.D.thigh + 0.05, ease(u / 0.3)) : u < 0.6 ? lerpn(B.D.thigh + 0.05, B.D.thigh * 1.05 + 0.18, ease((u - 0.3) / 0.3)) : lerpn(B.D.thigh * 1.05 + 0.18, B.J.hips.y, ease((u - 0.6) / 0.4));
  B.hips(0, hipsY - B.J.hips.y, lerpn(0.18, 0.0, ease(u / 0.5)));
  B.hipsRot(pitch, 0, 0);
  const kn = u < 0.6 ? 1.5 : lerpn(1.5, 0.0, ease((u - 0.6) / 0.4));
  const th = u < 0.3 ? lerpn(0, pitch, 1) : (u < 0.6 ? 0.9 : lerpn(0.9, 0, ease((u - 0.6) / 0.4)));
  B.leg('L', { hip: th - pitch * 0 + (u < 0.6 ? -pitch + 0.2 : 0) * (u < 0.3 ? 1 : 0.6), knee: kn, ankle: 0.6 * (u < 0.6 ? 1 : 0.2) }); B.leg('R', { hip: th - pitch * 0 + (u < 0.6 ? -pitch + 0.2 : 0) * (u < 0.3 ? 1 : 0.6), knee: kn, ankle: 0.6 * (u < 0.6 ? 1 : 0.2) });
  const arm = { raise: lerpn(-0.2, pitch + 0.2, ease(Math.min(1, u / 0.3))) * (1 - stand_) + 0.05 * stand_, abd: 0.15, rot: 0.2, elbow: 0.15 + 0.2 * (1 - stand_), pron: 0.5, wflex: -0.3 * (1 - stand_) };
  B.arm('L', arm); B.arm('R', arm);
  B.spine(0.1 * (1 - stand_), 0, 0); B.head(-0.3 * (1 - stand_) - pitch * 0.3, 0, 0);
  B.fingers('L', 'open', 1 - stand_); B.fingers('R', 'open', 1 - stand_);
};
const kneel = (B, t, p, h) => {
  const sd = seedOf(h); const th = B.D.thigh;
  B.hips(0, (th * 1.05 + 0.1) - B.J.hips.y, -0.05);
  B.hipsRot(0.05, 0, 0); B.spine(0.05, 0.02 * sn(t * 0.3, sd), 0); B.head(0.1, 0.1 * sn(t * 0.3, sd + 1), 0);
  B.leg('L', { hip: 0.0 - 0.0, abd: 0.08, knee: 1.55, ankle: 0.8 }); B.leg('R', { hip: 0.0, abd: 0.08, knee: 1.55, ankle: 0.8 });
  B.arm('L', { raise: 0.45, abd: -0.15, rot: 0.2, elbow: 0.7, pron: 0.7, wflex: 0.0 }); B.arm('R', { raise: 0.45, abd: -0.15, rot: 0.2, elbow: 0.7, pron: 0.7, wflex: 0.0 });
  B.fingers('L', 'relaxed'); B.fingers('R', 'relaxed');
};
const cower = (B, t, p, h) => {
  const sd = seedOf(h); const tr = sn(t * 16, sd) * 0.015;
  B.hips(0, (B.D.thigh * 0.8 + 0.12) - B.J.hips.y, -0.12); B.hipsRot(0.35, 0.2, 0);
  B.spine(0.8 + tr, 0.15, 0); B.head(0.25, -0.2, 0.2);
  B.leg('L', { hip: 1.5, abd: 0.15, knee: 2.0, ankle: 0.3 }); B.leg('R', { hip: 1.4, abd: 0.2, knee: 2.1, ankle: 0.3 });
  B.arm('L', { raise: 2.1, abd: -0.1, rot: 0.6, elbow: 2.3 + tr, pron: 0.6, wflex: 0.3 }); B.arm('R', { raise: 2.2, abd: -0.1, rot: 0.6, elbow: 2.4, pron: 0.6, wflex: 0.3 });
  B.fingers('L', 'claw', 0.8); B.fingers('R', 'claw', 0.8); B.shoulder('L', 0.3); B.shoulder('R', 0.3);
};
function crawlPose(B, t, h, o = {}) {
  const sd = seedOf(h), th = B.D.thigh, sh = B.D.shin;
  const f = o.f ?? 0.9, ph = t * f; const cL = Math.sin(TAU * ph), cR = -cL;
  const hy = th * 0.98 + 0.07;
  B.hips(0.015 * cL, hy - B.J.hips.y, -0.1); const pitch = o.pitch ?? 1.15;
  B.hipsRot(pitch, 0.07 * cL, 0.03 * cL); B.spine(0.0 + (o.arch || 0), 0.1 * cL, 0); B.head(-0.3 - (o.headUp || 0), 0.1 * sn(t * 0.5, sd), 0);
  for (const [S, c] of [['L', cL], ['R', cR]]) {
    B.leg(S, { hip: pitch - 0.1 + 0.35 * Math.max(0, c), abd: 0.1, knee: 1.55 + 0.4 * Math.max(0, c), ankle: 0.7 });
    B.arm(S, { raise: pitch + 0.25 - 0.45 * c + (o.armUp || 0), abd: 0.12, rot: 0.15, elbow: 0.12 + 0.35 * Math.max(0, c), pron: 0.9, wflex: -0.5 });
  }
  B.fingers('L', 'flat'); B.fingers('R', 'flat');
}
const crawl = (B, t, p, h) => crawlPose(B, t, h, { f: 0.75 + 0.2 * (p.speed ?? 0.5) });
const climb = (B, t, p, h) => {
  const sd = seedOf(h); const f = 0.7 * (p.rate ?? 1); const ph = t * f; const c = Math.sin(TAU * ph), c2 = -c;
  B.hipsMode = 'free'; B.hips(0, 0.02 * Math.abs(c) - 0.0, 0.12); B.hipsRot(0.0, 0, 0.03 * c); B.spine(0.1, 0.0, 0.04 * c); B.head(-0.35, 0.05 * c, 0);
  for (const [S, cc] of [['L', c], ['R', c2]]) {
    const lift = Math.max(0, cc);
    B.leg(S, { hip: 0.35 + 0.9 * lift, abd: 0.1, knee: 0.5 + 1.0 * lift, ankle: 0.3 });
    B.arm(S, { raise: 2.2 + 0.4 * (cc * 0.5 + 0.5) - 0.2, abd: 0.1, rot: -0.2, elbow: 0.7 - 0.5 * cc * 0.5 + 0.3, pron: 0.0, wflex: -0.3 });
  }
  B.fingers('L', 'grip_rifle', 0.9); B.fingers('R', 'grip_rifle', 0.9);
};
// ---- work
const work_counter = (B, t, p, h) => {
  const sd = seedOf(h); const per = 3.2, k = Math.floor(t / per), u = fract(t / per);
  const ra = idleCore(B, t, p, h, { lean: 0.07 });
  const g = Math.sin(Math.PI * clamp(u * 1.2, 0, 1));
  const kind = Math.floor(hash(k + sd) * 3);
  B.spine(0.1 + 0.05 * g, 0.12 * Math.sin(t * 0.8), 0); B.head(0.05 * g, 0.1 * sn(t * 0.5, sd), 0);
  const counter = [0.0, 0.98 * h.profile.height / 1.75, 0.38];
  const hand = (S, dx, dz, lift) => V((S === 'L' ? 1 : -1) * 0.14 + dx, counter[1] + 0.04 + lift, counter[2] + dz);
  B.handIK('R', hand('R', -0.04 * Math.sin(t * 1.1), 0.16 * g, 0.05 * g * kind), { pole: V(-0.6, -1, -0.5) });
  B.handIK('L', hand('L', 0.03, 0.04 + (kind === 0 ? 0.15 * g : 0), 0.0), { pole: V(0.6, -1, -0.5) });
  B.fingers('R', g > 0.4 ? 'hold_cup' : 'relaxed'); B.fingers('L', 'relaxed');
  B.extra.smileBoost = 0.3;
};
const pour_drink = (B, t, p, h) => {
  const sd = seedOf(h); const T = 3.6, u = fract(t / T); const tilt = sm(0.15, 0.4, u) * (1 - sm(0.75, 0.92, u));
  idleCore(B, t, p, h, { lean: 0.07 }); B.head(0.2, 0.05, 0); B.spine(0.1, 0.1, 0);
  B.handIK('L', V(0.07, B.J.hips.y + 0.34, 0.37), { pole: V(0.6, -1, -0.5) }); B.fingers('L', 'hold_cup');
  B.handIK('R', V(-0.04, B.J.hips.y + 0.5 - 0.0 * tilt, 0.32), { pole: V(-0.6, -1, -0.4), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.4 * 0, 0, 1.3 * tilt, 'YXZ')) }); B.fingers('R', 'hold_cup');
  B.extra.pour = tilt;
};
const clean_glass = (B, t, p, h) => {
  const sd = seedOf(h); idleCore(B, t, p, h, { lean: 0.06 }); B.head(0.2, 0.06 * sn(t * 0.4, sd), 0);
  const w = Math.sin(t * TAU * 1.5);
  B.handIK('L', V(0.08, B.J.hips.y + 0.32, 0.32), { pole: V(0.6, -1, -0.5) }); B.fingers('L', 'hold_cup');
  B.handIK('R', V(-0.01 + 0.015 * w, B.J.hips.y + 0.33 + 0.01 * Math.cos(t * TAU * 1.5), 0.32), { pole: V(-0.6, -1, -0.5) }); B.fingers('R', 'hold_cup');
  B.add('handR', 0, 0, 0.12 * w);
};
const autopsy = (B, t, p, h) => {
  const sd = seedOf(h); const s = h.profile.height / 1.75;
  stand(B, { gap: 0.07, yaw: 0.1, zL: 0.0, zR: 0.0, lim: 0.93 }); B.hips(0, 0, 0.06);
  B.spine(0.6, 0.04 * sn(t * 0.3, sd), 0); B.head(0.0, 0.05 * sn(t * 0.4, sd), 0); B.hipsRot(0.08, 0, 0);
  const cut = Math.sin(t * TAU * 0.8) * 0.05, tw = Math.sin(t * TAU * 2.4) * 0.006;
  const table = 0.92 * s;
  B.handIK('R', V(-0.1 + cut * 0.5, table + 0.1, 0.5 + cut), { pole: V(-0.5, -1, -0.3) }); B.handIK('L', V(0.14, table + 0.07, 0.44 + tw), { pole: V(0.5, -1, -0.4) });
  B.fingers('R', 'pinch'); B.fingers('L', 'open', 0.7);
};
const examine = (B, t, p, h) => {
  const sd = seedOf(h);
  stand(B, { gap: 0.03, yaw: 0.1, zL: 0.04, zR: -0.03, lim: 0.96 }); B.hipsRot(0.05, 0.1, 0); B.spine(0.28 + 0.03 * sn(t * 0.3, sd), 0.1 * sn(t * 0.2, sd + 1), 0); B.head(0.12 + 0.05 * sn(t * 0.5, sd), 0.2 * sn(t * 0.3, sd + 2), -0.12);
  B.arm('L', { raise: 0.55, abd: 0.05, rot: 0.2, elbow: 1.6, pron: 0.5, wflex: 0.1 });
  B.handIK('R', (out) => { const hb = h.rig.bones.head; fkPos(hb, out); fkQuat(hb, _q); return out.add(_p.set(-0.1, -0.2, 0.12).multiplyScalar(B.D.sh * 1.0).applyQuaternion(_q)); }, { pole: V(-0.5, -1, -0.5) });
  B.fingers('R', 'pinch'); B.fingers('L', 'relaxed');
};
const typing = (B, t, p, h) => {
  const sd = seedOf(h); const tp = Math.sin(t * 17) * 0.5 + 0.5, tp2 = Math.sin(t * 13 + 1) * 0.5 + 0.5; const s = h.profile.height / 1.75;
  stand(B, { gap: 0.03, yaw: 0.1, zL: 0.0, zR: 0.0, lim: 0.97 }); B.hipsRot(0.03, 0, 0); B.spine(0.1, 0.03 * sn(t * 0.3, sd), 0); B.head(0.2, 0.05 * sn(t * 0.4, sd), 0);
  const kb = p.keyboard || [0, 1.0 * s, 0.42];
  B.handIK('L', V(kb[0] + 0.1, kb[1] + 0.01 * tp, kb[2]), { pole: V(0.6, -1, -0.5) }); B.handIK('R', V(kb[0] - 0.1, kb[1] + 0.01 * tp2, kb[2]), { pole: V(-0.6, -1, -0.5) });
  B.fingers('L', 'type'); B.fingers('R', 'type');
};
const clipboard = (B, t, p, h) => {
  const sd = seedOf(h); idleCore(B, t, p, h, { lean: 0.03 }); const w = Math.sin(t * TAU * 2.2) * 0.5 + 0.5;
  B.arm('L', { raise: 1.15, abd: -0.3, rot: 0.4, elbow: 1.95, pron: 0.7, wflex: 0.1 });
  B.handIK('R', V(-0.1 + 0.015 * w, B.J.hips.y + 0.5 - 0.0, 0.34 + 0.0), { pole: V(-0.6, -1, -0.4) });
  B.fingers('L', 'carry'); B.fingers('R', 'pinch'); B.head(0.22, 0.2 * sn(t * 0.3, sd), 0.0); B.spine(0.05, 0, 0);
};
const mop = (B, t, p, h) => {
  const sd = seedOf(h); const w = Math.sin(t * TAU * 0.6), w2 = Math.cos(t * TAU * 0.6); const s = h.profile.height / 1.75;
  stand(B, { gap: 0.05, yaw: 0.1, zL: 0.06, zR: -0.08, lim: 0.95 }); B.hips(0.03 * w, 0, 0); B.hipsRot(0.02, 0.15 * w, 0); B.spine(0.3, 0.2 * w, 0); B.head(0.2, -0.1 * w, 0);
  const hx = 0.2 * w;
  B.handIK('L', V(0.1 + hx * 0.5, B.J.hips.y + 0.15 * s, 0.38 + 0.05 * w2), { pole: V(0.6, -1, -0.4) }); B.handIK('R', V(-0.08 + hx * 0.5, B.J.hips.y + 0.35 * s, 0.34 + 0.05 * w2), { pole: V(-0.6, -1, -0.4) });
  B.fingers('L', 'grip_rifle', 0.9); B.fingers('R', 'grip_rifle', 0.9);
};

// ---- zombies
function zstrain(h) { return (h.infection && h.infection.strain) || 'us'; }
function zmods(h) {
  const s = zstrain(h);
  return { s, upright: s === 'russia' ? 1 : 0, twitch: s === 'germany' ? 1 : s === 'cebu' ? 1.6 : 0, heavy: s === 'us' || s === 'us_giant' ? 1 : 0, giant: s === 'us_giant' ? 1 : 0 };
}
const zidle = (B, t, p, h) => {
  const sd = seedOf(h), m = zmods(h);
  stand(B, { gap: 0.05, yaw: 0.14, lim: 0.96 }); const sw = sn(t * 0.5, sd);
  const tw = m.twitch ? (hash(Math.floor(t * 9) + sd) > 0.82 ? sn(t * 40, sd) * 0.05 * m.twitch : 0) : 0;
  B.hips(0.02 * sw, 0, 0); B.hipsRot(0.02, 0.1 * sn(t * 0.3, sd), 0.03 * sw);
  B.spine(m.upright ? 0.0 : 0.22 + 0.05 * sn(t * 0.35, sd), 0.1 * sn(t * 0.4, sd + 1) + tw, 0.05 * sw);
  B.head(m.upright ? -0.02 : 0.25 + 0.15 * sn(t * 0.3, sd + 2), 0.4 * sn(t * 0.25, sd + 3) * (m.upright ? 0.3 : 1) + tw, -0.25 * sn(t * 0.2, sd + 4) * (m.upright ? 0.2 : 1));
  const a = m.upright ? { raise: 0.05, abd: -0.1, rot: 0.2, elbow: 0.15, pron: 0.4, wflex: 0 } : { raise: 0.5 + 0.2 * sn(t * 0.4, sd + 5), abd: 0.18, rot: 0.3, elbow: 0.55, pron: 0.9, wflex: 0.25 };
  B.arm('L', { ...a, raise: a.raise + 0.1 * sn(t * 0.6, sd + 6) + tw * 2 }); B.arm('R', { ...a, raise: a.raise + 0.1 * sn(t * 0.55, sd + 7) - tw });
  B.fingers('L', 'zombie'); B.fingers('R', 'zombie');
};
const zshamble = (B, t, p, h) => {
  const sd = seedOf(h), m = zmods(h); const v = p.speed ?? 0.65 + 0.1 * m.upright;
  gait(B, t, h, { cad0: 0.9, cad1: 0.55, sf: 0.66, lift: 0.04 + 0.03 * m.upright, lean: m.upright ? 0.03 : 0.2, v, limit: 0.94, hipTwist: 0.07, shTwist: 0.12, drop: 0.02, toeOff: 0.2, heelUp: 0.05, noArms: true, toeOut: 0.18, sway: 0.03 });
  B.spine(m.upright ? 0.03 : 0.2, 0.15 * Math.sin(t * 2.1), 0.06 * Math.sin(t * 2.1 + 1));
  B.head(m.upright ? 0 : 0.35 + 0.1 * sn(t, sd), 0.5 * sn(t * 0.3, sd + 3) * (m.upright ? 0.2 : 1), -0.3 * sn(t * 0.4, sd + 4) * (m.upright ? 0.2 : 1));
  const sw = Math.sin(t * 2.1);
  const a = m.upright ? { raise: 0.25, abd: -0.05, rot: 0.2, elbow: 0.4, pron: 0.6, wflex: 0 } : { raise: 1.0, abd: 0.15, rot: 0.3, elbow: 0.45, pron: 1.0, wflex: 0.3 };
  B.arm('L', { ...a, raise: a.raise + 0.12 * sw }); B.arm('R', { ...a, raise: a.raise - 0.12 * sw + (m.upright ? 0 : 0.05) });
  B.fingers('L', 'zombie'); B.fingers('R', 'zombie');
};
const zrun = (B, t, p, h) => {
  const sd = seedOf(h), m = zmods(h);
  gait(B, t, h, { cad0: 2.2, cad1: 0.2, sf: 0.4, lift: 0.14, lean: m.upright ? 0.15 : 0.3, armSwing: 0.9, elbow: 0.8, elbowSwing: 0.4, toeOff: 0.7, drop: 0.045, limit: 0.93, heel: 0.0, ball: 0.09, heelUp: 0.0, run: true, v: p.speed ?? 3.8, armOut: 0.35, armRaise: m.upright ? 0.0 : 0.5, hand: 'claw', hipTwist: 0.16, shTwist: 0.3, sway: 0.04 });
  const w = Math.sin(t * 10);
  B.head(m.upright ? 0.0 : 0.15, (m.upright ? 0.1 : 0.45) * sn(t * 2.2, sd + 3), -0.35 * w * (m.upright ? 0.3 : 1));
  B.fingers('L', 'claw'); B.fingers('R', 'claw');
};
const zsprint = (B, t, p, h) => {
  const sd = seedOf(h), m = zmods(h);
  gait(B, t, h, { cad0: 3.0, cad1: 0.2, sf: 0.3, lift: 0.19, lean: m.upright ? 0.25 : 0.45, armSwing: 0.7, elbow: 0.7, elbowSwing: 0.3, toeOff: 0.9, drop: 0.06, limit: 0.9, heel: -0.02, ball: 0.08, heelUp: 0.0, run: true, v: p.speed ?? 6.2, armRaise: m.upright ? 0.2 : 0.9, armOut: 0.3, hand: 'claw', hipTwist: 0.18, shTwist: 0.28, sway: 0.03 });
  B.head(-0.25, 0.3 * sn(t * 2.5, sd), -0.3 * Math.sin(t * 13) * (m.upright ? 0.2 : 1));
};
const zlunge = (B, t, p, h) => {
  const sd = seedOf(h); const T = 1.6, u = fract(t / T);
  const wind = sm(0, 0.35, u) * (1 - sm(0.35, 0.45, u)), leap = sm(0.35, 0.6, u) * (1 - sm(0.82, 1.0, u));
  B.hipsMode = 'free'; const air = Math.sin(Math.PI * sm(0.38, 0.85, u));
  B.hips(0, -0.28 * wind + 0.25 * air - 0.05 * sm(0.85, 1, u), -0.05 * wind + 0.9 * sm(0.38, 0.85, u) - 0.9 * sm(0.9, 1.0, u));
  B.hipsRot(0.35 * wind - 0.4 * leap, 0, 0); B.spine(0.45 * wind - 0.2 * leap + 0.2, 0, 0); B.head(0.0 - 0.3 * leap, 0.2 * sn(t * 7, sd), -0.2 * wind);
  B.leg('L', { hip: 0.9 * wind - 0.4 * leap + 0.3, abd: 0.15, knee: 1.5 * wind + 0.5 * leap, ankle: 0.3 }); B.leg('R', { hip: 0.8 * wind - 0.7 * leap, abd: 0.15, knee: 1.4 * wind + 0.9 * leap, ankle: 0.3 });
  B.arm('L', { raise: 0.6 * wind + 1.9 * leap, abd: 0.3, rot: 0.1, elbow: 1.6 * wind + 0.2, pron: 1.0, wflex: -0.2 }); B.arm('R', { raise: 0.6 * wind + 1.8 * leap, abd: 0.3, rot: 0.1, elbow: 1.6 * wind + 0.3, pron: 1.0, wflex: -0.2 });
  B.fingers('L', 'claw'); B.fingers('R', 'claw');
};
const zcrawl = (B, t, p, h) => { crawlPose(B, t, h, { f: 0.55, arch: 0.0, headUp: 0.35, pitch: 1.2 }); const sd = seedOf(h); B.add('head', 0, 0.25 * sn(t * 3, sd), 0.2 * sn(t * 2, sd + 1)); B.leg('L', { hip: 1.1, abd: 0.35, knee: 1.1 + 0.4 * Math.sin(t * 3), ankle: 0.2 }); B.fingers('L', 'claw'); B.fingers('R', 'claw'); };
const zeat = (B, t, p, h) => {
  const sd = seedOf(h); const th = B.D.thigh; const c = Math.sin(t * TAU * 1.3) * 0.5 + 0.5, c2 = Math.sin(t * TAU * 2.6 + 1);
  B.hips(0, th * 1.05 + 0.12 - B.J.hips.y, -0.25); B.hipsRot(0.5 + 0.1 * c, 0.1 * sn(t * 0.4, sd), 0); B.spine(0.7 + 0.25 * c, 0.1 * c2, 0); B.head(0.3 * c + 0.1, 0.3 * c2 * 0.3, -0.1 * c2);
  B.leg('L', { hip: 0.5, abd: 0.25, knee: 1.6, ankle: 0.7 }); B.leg('R', { hip: 0.5, abd: 0.25, knee: 1.6, ankle: 0.7 });
  B.arm('L', { raise: 1.2 + 0.2 * c, abd: 0.15, rot: 0.2, elbow: 0.9 - 0.4 * c, pron: 1.0, wflex: 0.3 }); B.arm('R', { raise: 1.0 + 0.3 * (1 - c), abd: 0.15, rot: 0.2, elbow: 1.2 - 0.5 * (1 - c), pron: 1.0, wflex: 0.3 });
  B.fingers('L', 'claw'); B.fingers('R', 'claw');
};
const zcough = (B, t, p, h) => {
  const sd = seedOf(h); const T = 2.2, u = fract(t / T); const burst = sm(0.45, 0.55, u) * (1 - sm(0.8, 0.95, u)); const sp = Math.sin(t * 38) * burst;
  stand(B, { gap: 0.05, yaw: 0.12, lim: 0.93 });
  B.hips(0, -0.03 * burst, 0.0); B.hipsRot(0.1 * burst, 0, 0); B.spine(0.25 + 0.45 * burst + 0.05 * sp, 0, 0); B.head(0.3 + 0.35 * burst + 0.1 * sp, 0.2 * sn(t * 0.3, sd), 0);
  B.arm('L', { raise: 0.7 + 0.5 * burst, abd: 0.1, rot: 0.3, elbow: 1.3 + 0.4 * burst, pron: 0.7, wflex: 0.2 }); B.arm('R', { raise: 0.4 + 0.2 * burst, abd: 0.15, rot: 0.3, elbow: 0.6, pron: 0.7, wflex: 0.2 });
  B.fingers('L', 'zombie'); B.fingers('R', 'zombie'); B.extra.cough = burst;
};
const stunned_alias = null;

export const ACTION = {
  aim_rifle: { fn: aim_rifle, expr: { anger: 0.25 } }, aim_walk: { fn: aim_walk, expr: { anger: 0.2 } }, shoot: { fn: shoot, expr: { anger: 0.5 } }, reload: { fn: reload }, aim_pistol: { fn: aim_pistol, expr: { anger: 0.25 } }, aim_shotgun: { fn: aim_shotgun, expr: { anger: 0.3 } },
  carry: { fn: carry }, push: { fn: push, expr: { anger: 0.3 } }, lift: { fn: lift, expr: { anger: 0.2 } }, stagger: { fn: stagger, once: true, dur: 1.1, expr: { fear: 0.4, surprise: 0.5 } },
  fall: { fn: fall, once: true, dur: 1.4, expr: { surprise: 0.7, fear: 0.5 } }, dead: { fn: dead, noBreath: true, noSway: true }, get_up: { fn: get_up, once: true, dur: 2.6, expr: { anger: 0.1, fear: 0.2 } },
  crawl: { fn: crawl, expr: { fear: 0.3 } }, climb: { fn: climb, expr: { anger: 0.15 } }, kneel: { fn: kneel }, cower: { fn: cower, expr: { fear: 1 } },
  work_counter: { fn: work_counter, expr: { smile: 0.4 } }, pour_drink: { fn: pour_drink }, clean_glass: { fn: clean_glass }, autopsy: { fn: autopsy }, examine: { fn: examine, expr: { frown: 0.1 } }, typing: { fn: typing }, clipboard: { fn: clipboard }, mop: { fn: mop },
  zombie_idle: { fn: zidle, expr: { anger: 0.2 } }, zombie_shamble: { fn: zshamble, expr: { anger: 0.2 } }, zombie_run: { fn: zrun, expr: { anger: 0.8 } }, zombie_sprint: { fn: zsprint, expr: { anger: 1 } },
  zombie_lunge: { fn: zlunge, expr: { anger: 1, surprise: 0.2 } }, zombie_crawl: { fn: zcrawl, expr: { anger: 0.6 } }, zombie_eat: { fn: zeat, expr: { anger: 0.3 } }, zombie_cough: { fn: zcough, expr: { frown: 0.4 } },
};
