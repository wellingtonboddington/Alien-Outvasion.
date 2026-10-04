// Actor / Entity: time-keyed tracks that drive hero models (humans, aliens, robots) and arbitrary objects (vehicles, ships, jets).
// Every evaluate(t) is a pure function of scene time t (plus light smoothing), so the director can seek anywhere.
import * as THREE from 'three';
import { lerp, damp, lerpAngle, clamp, yawTo, angDiff, RNG } from './common.js';
import { resolvePoint } from './camera.js';
import { MOUTH_KEYS } from './lipsync.js';

const V3 = THREE.Vector3;
const _a = new V3(), _b = new V3();

/** world position + yaw of a named anchor on an entity (vehicle seats, sets) */
export function anchorWorld(entity, name, outPos, idx = 0) {
  const obj = entity.root || entity; obj.updateMatrixWorld(true);
  let a = entity.anchors ? entity.anchors[name] : (entity.obj && entity.obj.anchors ? entity.obj.anchors[name] : null);
  if (Array.isArray(a)) a = a[idx % a.length];
  if (!a) { obj.getWorldPosition(outPos); return obj.rotation.y; }
  const p = a.pos || a; outPos.set(p[0], p[1], p[2]); obj.localToWorld(outPos);
  const q = new THREE.Quaternion(); obj.getWorldQuaternion(q); const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  return e.y + (a.yaw || 0);
}

const EMOTIONS = {
  neutral: {}, happy: { smile: 0.7 }, smirk: { smile: 0.4 }, worried: { frown: 0.45, fear: 0.3 }, afraid: { fear: 0.85 }, angry: { anger: 0.85 },
  sad: { sad: 0.75 }, shocked: { surprise: 0.9 }, serious: { frown: 0.3, anger: 0.15 }, urgent: { fear: 0.3, anger: 0.25 }, awe: { surprise: 0.5, smile: 0.2 }, tired: { sad: 0.3 }, cold: { frown: 0.2, anger: 0.2 },
};
const EXPR_KEYS = ['smile', 'frown', 'surprise', 'fear', 'anger', 'sad'];
const TALK_CLIPS = { idle: ['talk_a', 'talk_b', 'talk_c'], listen: ['talk_a', 'talk_b'], idle_arms_crossed: ['talk_b'], idle_hands_hips: ['talk_c'], sit: ['sit_talk'], idle_phone: ['phone_call'], idle_alert: ['talk_a'], infected_idle: ['infected_idle'] };
const talkStyleFor = (emo) => ({ angry: 'angry', urgent: 'excited', happy: 'excited', afraid: 'afraid', worried: 'afraid', sad: 'sad', tired: 'sad', shocked: 'excited' }[emo] || 'calm');

export class Actor {
  constructor(S, model, opts = {}) {
    this.S = S; this.model = model; this.name = opts.name || opts.id || 'actor'; this.id = opts.id || this.name; this.color = opts.color || '#ffffff';
    this.isAlien = !!opts.alien; this.height = opts.height || (model.profile && model.profile.height ? model.profile.height / 100 : (this.isAlien ? 2.6 : 1.7));
    this.headY = opts.headY ?? this.height * 0.93;
    this.segs = []; this.pos = new V3(); this.yaw = 0; this._init = false; this.speaking = null; this.lookTarget = null; this.autoLook = opts.autoLook !== false;
    this.expr = { smile: 0, frown: 0, surprise: 0, fear: 0, anger: 0, sad: 0 }; this.mouth = {}; for (const k of MOUTH_KEYS) this.mouth[k] = 0;
    this._wasSpeaking = false; this.talkIdx = 0; this.baseEmotion = 'neutral'; this.visible = true; this.root = model.root;
    this.holdProp = null; this._prevClip = null; this.rng = new RNG(opts.seed || 7);
    this.scale = opts.scale || 1;
  }
  headPos(out) {
    if (this.model.getJointWorldPosition && this.model.joints && this.model.joints.head) { this.model.getJointWorldPosition('head', out); return out; }
    return out.set(this.pos.x, this.pos.y + this.headY * this.scale, this.pos.z);
  }
  // ---- builders (return end time where it makes sense) ----
  _endState(t) { // position/yaw where the actor would be at time t given existing segs
    let st = { pos: this.pos.clone(), yaw: this.yaw };
    for (const s of this.segs) { if (s.t0 > t) break; if (s.type === 'hold') { st.pos.copy(s.pos); st.yaw = s.yaw; } else if (s.type === 'move') { st.pos.copy(s.pts[s.pts.length - 1]); st.yaw = s.endYaw; } else if (s.type === 'attach') { st.pos.copy(s.lastPos || st.pos); } }
    return st;
  }
  _push(seg) { this.segs = this.segs.filter((s) => s.t0 < seg.t0 - 1e-6 || s.type === 'hide'); this.segs.push(seg); this.segs.sort((a, b) => a.t0 - b.t0); return seg; }
  /** Teleport/place at time t, optional clip */
  place(t, pos, yaw = 0, clip = 'idle', opts = {}) {
    const p = Array.isArray(pos) ? new V3(pos[0], pos[1] || 0, pos[2] ?? pos[1]) : pos.clone();
    if (Array.isArray(pos) && pos.length === 2) { p.set(pos[0], 0, pos[1]); }
    this._push({ type: 'hold', t0: t, pos: p, yaw, clip, speed: opts.speed || 1, params: opts.params || {}, mirror: !!opts.mirror, offset: opts.offset || 0, face: opts.face || null, hide: false });
    return this;
  }
  /** Play a clip from time t (stays until next seg). pos/yaw default to current end state. Returns t+dur if dur given. */
  act(t, clip, opts = {}) {
    const st = this._endState(t - 1e-6); const pos = opts.pos ? (Array.isArray(opts.pos) ? (opts.pos.length === 2 ? new V3(opts.pos[0], 0, opts.pos[1]) : new V3(...opts.pos)) : opts.pos.clone()) : st.pos;
    this._push({ type: 'hold', t0: t, pos, yaw: opts.yaw ?? st.yaw, clip, speed: opts.speed || 1, params: opts.params || {}, mirror: !!opts.mirror, offset: opts.offset || 0, face: opts.face || null, loop: opts.loop !== false });
    if (opts.dur) { return t + opts.dur; } return t;
  }
  /** Walk/run along points at speed (m/s). pts: [x,z] | [[x,z],..] | Vector3[] . Returns end time. */
  go(t, pts, opts = {}) {
    const st = this._endState(t - 1e-6); const list = (Array.isArray(pts[0]) || (pts[0] && pts[0].isVector3)) ? pts : [pts];
    const P = [st.pos.clone()]; for (const q of list) { P.push(q.isVector3 ? q.clone() : (q.length === 2 ? new V3(q[0], 0, q[1]) : new V3(q[0], q[1], q[2]))); }
    let L = 0; const cum = [0]; for (let i = 1; i < P.length; i++) { L += P[i].distanceTo(P[i - 1]); cum.push(L); }
    const speed = opts.speed || 1.4; const clip = opts.clip || (speed <= 1.7 ? 'walk' : speed <= 3.4 ? 'jog' : speed <= 5.4 ? 'run' : 'sprint');
    const ramp = opts.ramp ?? 0.35; const T = L / speed + ramp; const last = P[P.length - 1], prev = P[P.length - 2];
    const endYaw = opts.endYaw ?? yawTo(last.x - prev.x, last.z - prev.z);
    this._push({ type: 'move', t0: t, t1: t + T, pts: P, cum, length: L, speed, clip, ramp, T, endYaw, params: opts.params || {}, mirror: !!opts.mirror, startYaw: st.yaw });
    // follow with idle hold at end
    this._push({ type: 'hold', t0: t + T, pos: last.clone(), yaw: endYaw, clip: opts.endClip || 'idle', speed: 1, params: {}, mirror: false, offset: 0, face: null });
    return t + T;
  }
  /** Attach to a vehicle/entity anchor (seated etc.) between t0 and t1; afterwards stays at the last position. */
  attach(t0, t1, entity, anchor = 'driverSeat', opts = {}) {
    this._push({ type: 'attach', t0, t1: t1 ?? Infinity, entity, anchor, idx: opts.idx || 0, clip: opts.clip || 'sit', speed: opts.speed || 1, params: opts.params || {}, yawOffset: opts.yawOffset || 0, dy: opts.dy || 0, offsetPos: opts.offset || null });
    return this;
  }
  /** Make the actor face a target (point/actor/fn) from time t until changed. */
  faceTo(t, target) { const idx = this.segs.filter((s) => s.t0 <= t + 1e-6).length - 1; if (idx >= 0) { const s = this.segs[idx]; if (s.type === 'hold') { /* split */ const ns = { ...s, t0: t, face: target }; this._push(ns); } } return this; }
  hide(t) { this.segs.push({ type: 'hide', t0: t }); this.segs.sort((a, b) => a.t0 - b.t0); return this; }
  show(t) { return this; }
  gaze(target) { this.lookTarget = target; return this; }
  hold(prop, hand = 'R') { if (this.model.hold) this.model.hold(prop, hand); this.holdProp = prop; return this; }
  mood(e) { this.baseEmotion = e; return this; }

  _seg(t) { let s = null; for (let i = this.segs.length - 1; i >= 0; i--) { if (this.segs[i].t0 <= t + 1e-9) { s = this.segs[i]; break; } } return s; }
  /** evaluate at scene time t */
  evaluate(t, dt) {
    const S = this.S; const m = this.model; const seg = this._seg(t);
    if (!seg || seg.type === 'hide') { this.visible = false; this.root.visible = false; return; }
    this.visible = true; this.root.visible = true;
    let desiredYaw = this.yaw, clip = 'idle', ctime = 0, params = {}, speed = 1, mirror = false, loop = true;
    if (seg.type === 'hold') {
      this.pos.copy(seg.pos); desiredYaw = seg.yaw; clip = seg.clip; ctime = t - seg.t0 + (seg.offset || 0); params = seg.params; speed = seg.speed; mirror = seg.mirror; loop = seg.loop !== false;
      if (seg.face) { resolvePoint(seg.face, _a, t); const dx = _a.x - this.pos.x, dz = _a.z - this.pos.z; if (dx * dx + dz * dz > 1e-4) desiredYaw = yawTo(dx, dz); }
    } else if (seg.type === 'move') {
      const u = clamp(t - seg.t0, 0, seg.T), r = seg.ramp, V = seg.speed; let s;
      if (r < 1e-3) s = V * u; else if (u < r) s = V * u * u / (2 * r); else if (u < seg.T - r) s = V * (u - r / 2); else s = seg.length - V * (seg.T - u) * (seg.T - u) / (2 * r);
      s = clamp(s, 0, seg.length); let i = 1; while (i < seg.cum.length - 1 && seg.cum[i] < s) i++;
      const a = seg.pts[i - 1], b = seg.pts[i], segL = Math.max(1e-6, seg.cum[i] - seg.cum[i - 1]); const f = (s - seg.cum[i - 1]) / segL; this.pos.lerpVectors(a, b, f);
      desiredYaw = yawTo(b.x - a.x, b.z - a.z); clip = seg.clip; ctime = t - seg.t0; params = { ...seg.params, speed: V }; mirror = seg.mirror;
      if (u < 0.25 && !this._init) this.yaw = desiredYaw; // avoid initial spin
    } else if (seg.type === 'attach') {
      const y = anchorWorld(seg.entity, seg.anchor, _b, seg.idx); this.pos.copy(_b); this.pos.y += seg.dy; if (seg.offsetPos) this.pos.add(_a.set(seg.offsetPos[0], seg.offsetPos[1], seg.offsetPos[2])); desiredYaw = y + seg.yawOffset; clip = seg.clip; ctime = t - seg.t0; params = seg.params; speed = seg.speed; seg.lastPos = this.pos.clone();
      this.yaw = desiredYaw; this._init = true; // seated: no smoothing
    }
    // facing smoothing
    if (!this._init || seg.type === 'attach') { this.yaw = desiredYaw; this._init = true; } else { const d = angDiff(this.yaw, desiredYaw); const maxTurn = 7.5 * dt * (1 + Math.abs(d)); this.yaw += clamp(d, -maxTurn, maxTurn); }
    // ---- dialogue / mouth / expression ----
    const sp = this.speaking; let emotion = this.baseEmotion;
    if (sp) { emotion = sp.emotion || emotion; }
    if (sp) {
      const talkList = TALK_CLIPS[clip];
      if (talkList && !this.noTalkClip && !(this.isAlien && !talkList)) clip = talkList[(sp.idx || 0) % talkList.length];
      if (m.setMouth) m.setMouth(sp.mouth);
      if (m.setTalk) m.setTalk(sp.energy, talkStyleFor(emotion));
      this._wasSpeaking = true;
    } else if (this._wasSpeaking) { for (const k of MOUTH_KEYS) this.mouth[k] = 0; if (m.setMouth) m.setMouth(this.mouth); if (m.setTalk) m.setTalk(0, 'calm'); this._wasSpeaking = false; }
    const ex = EMOTIONS[emotion] || EMOTIONS.neutral;
    for (const k of EXPR_KEYS) this.expr[k] = damp(this.expr[k], ex[k] || 0, 7, dt);
    if (m.setExpression) m.setExpression(this.expr);
    // gaze
    let gz = this.lookTarget; if (!gz && this.autoLook && S._speakerActor && S._speakerActor !== this && S._speakerActor.visible) gz = S._speakerActor;
    if (!gz && sp && sp.to) gz = sp.to;
    if (m.lookAt) { if (gz) { const p = resolvePoint(gz, _a, t); m.lookAt(p.clone(), sp ? 0.7 : 0.85); } else m.lookAt(null); }
    // transform + clip
    m.setTransform ? m.setTransform(this.pos.x, this.pos.y, this.pos.z, this.yaw) : (this.root.position.copy(this.pos), this.root.rotation.y = this.yaw);
    if (this.scale !== 1) this.root.scale.setScalar(this.scale);
    if (m.play) m.play(clip, { time: ctime, speed, blend: this._prevClip === clip ? 0.2 : 0.28, loop, mirror, params });
    this._prevClip = clip;
    if (m.update) m.update(dt, t);
  }
}

/** Generic time-keyed object (vehicles, jets, ships, tripods, props). */
export class Entity {
  constructor(S, obj, opts = {}) { this.S = S; this.obj = obj; this.root = obj.root || obj; this.segs = []; this.pos = new V3(); this.yaw = 0; this.opts = opts; this.visible = true; this._last = new V3(); this._first = true; this._speed = 0; this.root.rotation.order = 'YXZ'; }
  _push(seg) { this.segs = this.segs.filter((s) => s.t0 < seg.t0 - 1e-6); this.segs.push(seg); this.segs.sort((a, b) => a.t0 - b.t0); return seg; }
  at(t, pos, yaw = 0, opts = {}) { this._push({ type: 'at', t0: t, pos: new V3(pos[0], pos[1] || 0, pos[2] || 0), yaw, scale: opts.scale, pitch: opts.pitch || 0, roll: opts.roll || 0, speed: opts.speed || 0 }); return this; }
  /** Move along a smooth curve through pts ([x,y,z]) between t0..t1. opts: ease 'linear'|'inOut'|'in'|'out', bank (0..1), pitch (bool), yawOffset, tension */
  path(t0, t1, pts, opts = {}) {
    const P = pts.map((p) => new V3(p[0], p[1] ?? 0, p[2] ?? 0)); const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal'); curve.arcLengthDivisions = 100;
    this._push({ type: 'path', t0, t1, curve, length: curve.getLength(), ease: opts.ease || 'linear', bank: opts.bank ?? 0, pitch: !!opts.pitch, yawOffset: opts.yawOffset || 0, scaleFrom: opts.scaleFrom, scaleTo: opts.scaleTo, tiltK: opts.tilt ?? 0 });
    return this;
  }
  hide(t) { this._push({ type: 'hide', t0: t }); return this; }
  _seg(t) { let s = null; for (let i = this.segs.length - 1; i >= 0; i--) if (this.segs[i].t0 <= t + 1e-9) { s = this.segs[i]; break; } return s; }
  evaluate(t, dt) {
    const seg = this._seg(t); const r = this.root;
    if (!seg || seg.type === 'hide') { r.visible = false; this.visible = false; return; }
    r.visible = true; this.visible = true;
    if (seg.type === 'at') { r.position.copy(seg.pos); r.rotation.set(-seg.pitch, seg.yaw, -seg.roll, 'YXZ'); if (seg.scale) r.scale.setScalar(seg.scale); this.pos.copy(seg.pos); this._speed = seg.speed; if (this.obj.setSpeed) this.obj.setSpeed(seg.speed); }
    else if (seg.type === 'path') {
      const k = clamp((t - seg.t0) / (seg.t1 - seg.t0)); const e = seg.ease === 'inOut' ? k * k * (3 - 2 * k) : seg.ease === 'in' ? k * k : seg.ease === 'out' ? 1 - (1 - k) * (1 - k) : k;
      seg.curve.getPointAt(clamp(e), _a); const tan = seg.curve.getTangentAt(clamp(Math.min(0.999, e)), _b);
      r.position.copy(_a); const yaw = Math.atan2(tan.x, tan.z) + seg.yawOffset; const hz = Math.hypot(tan.x, tan.z); const pitch = seg.pitch ? Math.atan2(tan.y, hz) : 0;
      // bank from yaw rate
      let bank = 0; if (seg.bank) { const e2 = clamp(e + 0.01); const t2 = seg.curve.getTangentAt(Math.min(0.999, e2), new V3()); const dy = angDiff(Math.atan2(tan.x, tan.z), Math.atan2(t2.x, t2.z)); bank = clamp(dy * 18 * seg.bank, -0.9, 0.9); }
      if (this._lb === undefined) this._lb = bank; this._lb = damp(this._lb, bank, 6, dt || 0.016);
      r.rotation.set(-pitch, yaw, -this._lb, 'YXZ'); this.pos.copy(_a);
      const dur = Math.max(1e-3, seg.t1 - seg.t0); const dEdT = seg.ease === 'inOut' ? 6 * k * (1 - k) : seg.ease === 'in' ? 2 * k : seg.ease === 'out' ? 2 * (1 - k) : 1; this._speed = seg.length * dEdT / dur; if (this.obj.setSpeed) this.obj.setSpeed(this._speed);
      if (seg.scaleFrom != null) r.scale.setScalar(lerp(seg.scaleFrom, seg.scaleTo ?? seg.scaleFrom, e));
      if (this.obj.setBank) this.obj.setBank(-this._lb); if (this.obj.setPitch) this.obj.setPitch(pitch);
    }
    if (this.obj.update) this.obj.update(dt, t);
  }
}
