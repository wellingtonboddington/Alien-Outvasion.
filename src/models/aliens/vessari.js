// createVessari(kind, seed) -> VessariHero : fully rigged alien infantry / officer / drone / hierarch with mandible lip-sync.
import * as THREE from 'three';
import { disposeTree, damp, clamp } from '../../engine/common.js';
import { setInfection as setInfectionTree } from '../../engine/infect.js';
import { makeVessariMaterials, makeGlowMaterial, setBloody as setBloodyTree } from './materials.js';
import { buildBody } from './body.js';
import { buildWeaponGeos, WEAPON } from './weapon.js';
import { CH, newPose, NCH, DEG } from './rig.js';
import { evalClip, CLIPS, wob } from './clips.js';
import { V3 } from './util.js';

const BODY_SCALE = { soldier: 1.0, officer: 1.05, drone: 0.84, hierarch: 1.13 };
const MOUTH0 = { jaw: 0, wide: 0, round: 0, press: 0, tuck: 0, teeth: 0, tongue: 0 };
const STYLE = { // talk layer parameters
  calm: { nod: 0.05, tempo: 1.0, hand: 0.6, flutter: 0.0, brow: 0, lean: 0, tremor: 0, eye: 1.0 },
  excited: { nod: 0.10, tempo: 1.35, hand: 1.0, flutter: 0.0, brow: -0.2, lean: -0.03, tremor: 0, eye: 1.25 },
  angry: { nod: 0.08, tempo: 1.2, hand: 0.9, flutter: 0.1, brow: 0.9, lean: 0.08, tremor: 0.2, eye: 1.5 },
  afraid: { nod: 0.04, tempo: 1.7, hand: 0.4, flutter: 0.4, brow: -0.6, lean: -0.06, tremor: 0.5, eye: 0.7 },
  sad: { nod: 0.03, tempo: 0.7, hand: 0.25, flutter: 0.0, brow: -0.9, lean: 0.07, tremor: 0.0, eye: 0.6 },
};

export function createVessari(kind = 'soldier', seed = 1, opts = {}) {
  if (!BODY_SCALE[kind]) kind = 'soldier';
  const root = new THREE.Group(); root.name = 'vessari_' + kind;
  const body = new THREE.Group(); body.name = 'body'; const bs = BODY_SCALE[kind] * (opts.scale || 1); body.scale.setScalar(bs); root.add(body);
  const mats = makeVessariMaterials(kind, opts.tint || {});
  const { rig, geos } = buildBody(kind, seed, mats);
  rig.bodyScale = 1;
  body.add(rig.group);
  // skinned meshes (one per material)
  const meshes = [];
  for (const k of Object.keys(geos)) {
    const g = geos[k]; if (!g) continue;
    const m = new THREE.SkinnedMesh(g, mats[k]); m.name = 'vessari_' + k; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    body.add(m); meshes.push(m);
  }
  root.updateMatrixWorld(true); const skel = rig.makeSkeleton();
  for (const m of meshes) m.bind(skel, m.matrixWorld);
  body.updateMatrixWorld(true);
  // ---------------- weapon ----------------
  const wg = new THREE.Group(); wg.name = 'bio-lance'; const wgeo = buildWeaponGeos();
  const wglowMat = makeGlowMaterial(3); // own glow so muzzle flash does not light the eye-band
  { const parts = { shell: mats.shell, skin: mats.skin, dark: mats.dark, glow: null }; for (const k in wgeo) { if (!wgeo[k]) continue; const mesh = new THREE.Mesh(wgeo[k], k === 'glow' ? wglowMat : parts[k]); mesh.castShadow = true; wg.add(mesh); } }
  const weaponMesh = new THREE.Group(); weaponMesh.add(wg); body.add(weaponMesh); weaponMesh.visible = false;
  const R90 = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  const CH_R = new V3(0.03, -0.08, 0);
  const wLocalPos = CH_R.clone().sub(WEAPON.gripPt.clone().applyQuaternion(R90));
  rig.fg.off.copy(new V3(0.06, 0, 0)).add(WEAPON.fgPt.clone().sub(WEAPON.gripPt).applyQuaternion(R90));
  // ---------------- infection tumours ----------------
  const tumorMat = new THREE.MeshStandardMaterial({ color: 0x1b3a10, emissive: new THREE.Color(0x58ff1a), emissiveIntensity: 1.6, roughness: 0.35 });
  const tumors = new THREE.Group(); body.add(tumors); tumors.visible = false;
  const tumorList = [];
  { const sites = [['spine2', [0.12, 1.72, -0.16], 0.055], ['spine2', [-0.1, 1.86, -0.12], 0.04], ['head', [0.12, 2.22, 0.02], 0.045], ['uarm_L', [0.33, 1.52, 0.04], 0.05], ['thigh_R', [-0.17, 1.02, -0.06], 0.055], ['spine1', [-0.16, 1.55, 0.0], 0.045], ['farm_R', [-0.43, 1.12, 0.0], 0.04], ['pelvis', [0.1, 1.28, -0.12], 0.05]];
    for (const [bn, p, r] of sites) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), tumorMat); const b = rig.B[bn]; const rp = rig.R[bn]; m.position.set(p[0] - rp.x, p[1] - rp.y, p[2] - rp.z); m.scale.setScalar(r); m.userData.r = r; b.add(m); m.visible = false; tumorList.push(m); } }
  // ---------------- state ----------------
  const P = newPose(), Pprev = newPose(), Pblend = newPose(), Pfinal = newPose(), Pcur = newPose();
  const ctx = { held: opts.hold === undefined ? kind === 'soldier' : !!opts.hold, kind, E: 0, style: 'calm', inf: 0, t: 0 };
  const cur = { name: 'idle', time: 0, speed: 1, loop: true, explicit: false };
  let blendT = 1, blendDur = 0.2; const mouthT = { ...MOUTH0 }, mouthS = { ...MOUTH0 };
  let infection = 0, bloody = 0, look = null, lookW = 0; const lookS = { yaw: 0, pitch: 0 }; const tmpV = new V3();
  let talkE = 0, talkTarget = 0, talkStyle = 'calm'; const ex = { breath: 0, crestLag: 0, capeLag: 0, tendLag: 0, tendSway: 0 };
  let lastX = 0, lastZ = 0, lastYaw = 0, velX = 0, velZ = 0, started = false, flash = 0;
  weaponMesh.visible = ctx.held;

  function applyAll(dt, t) {
    const cl = evalClip(cur.name, cur.time, ctx, Pcur);
    // blend
    if (blendT < 1 && dt >= 0) { /* advanced in update */ }
    const w = blendT >= 1 ? 1 : (() => { const x = blendT; return x * x * (3 - 2 * x); })();
    if (w < 1) for (let i = 0; i < NCH; i++) Pfinal[i] = Pprev[i] + (Pcur[i] - Pprev[i]) * w; else Pfinal.set(Pcur);
    // -------- talk layer --------
    const st = STYLE[talkStyle] || STYLE.calm; const E = talkE;
    if (E > 0.01) {
      const ph = t * 6.2832 * 0.85 * st.tempo;
      Pfinal[CH.hp] += E * (st.nod * Math.sin(ph) + 0.03 * Math.sin(ph * 2.3)) + st.lean * E * 0.5;
      Pfinal[CH.hy] += E * 0.06 * wob(t * 1.7 * st.tempo, 2);
      Pfinal[CH.hr] += E * 0.04 * wob(t * 1.3, 4);
      Pfinal[CH.n1p] += E * 0.02 * Math.sin(ph * 0.5);
      Pfinal[CH.s2p] += E * 0.02 * Math.sin(ph + 1); Pfinal[CH.brow] += st.brow * E;
      Pfinal[CH.jt] += st.flutter * E * (0.5 + 0.5 * Math.sin(t * 40));
    }
    Pfinal[CH.eye] *= (1 + (st.eye - 1) * E);
    // -------- infection tremor layer --------
    if (infection > 0.02) {
      const a = infection; const f = t * 9;
      Pfinal[CH.hy] += a * 0.09 * wob(f * 1.3, 1) + a * 0.04 * Math.sin(t * 31); Pfinal[CH.hp] += a * 0.07 * wob(f, 3); Pfinal[CH.hr] += a * 0.08 * wob(f * 0.9, 5);
      Pfinal[CH.jt] += a * (0.55 + 0.45 * Math.sin(t * 27 + 1.3 * Math.sin(t * 5)));
      Pfinal[CH.s1y] += a * 0.04 * wob(f * 1.1, 7); Pfinal[CH.s2r] += a * 0.04 * wob(f * 1.4, 8);
      for (const i of [0, 1]) { const k = 'a' + i; Pfinal[CH[k + 'sp']] += a * 0.6 * (0.5 + 0.5 * Math.sin(t * 22 + i * 2)); Pfinal[CH[k + 'gr']] = Math.max(Pfinal[CH[k + 'gr']], 0.3 + a * 0.4 * (0.5 + 0.5 * Math.sin(t * 17 + i))); }
      Pfinal[CH.eye] *= 1 + a * (0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3));
    }
    // -------- look-at layer --------
    if (look && lookW > 0.001) {
      tmpV.copy(look); root.worldToLocal(tmpV); // root space (unscaled by body)
      const hp = rig.R.head; const dx = tmpV.x - hp.x * bs, dy = tmpV.y - hp.y * bs, dz = tmpV.z - hp.z * bs;
      let yaw = Math.atan2(dx, dz) - (Pfinal[CH.rYaw] + Pfinal[CH.s0y] + Pfinal[CH.s1y] + Pfinal[CH.s2y]); yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      let pitch = -Math.atan2(dy, Math.hypot(dx, dz)) - (Pfinal[CH.rP] + Pfinal[CH.s0p] + Pfinal[CH.s1p] + Pfinal[CH.s2p]) * 0.5;
      yaw = clamp(yaw, -1.35, 1.35); pitch = clamp(pitch, -0.6, 0.7);
      lookS.yaw = damp(lookS.yaw, yaw * lookW, 7, dt); lookS.pitch = damp(lookS.pitch, pitch * lookW, 7, dt);
    } else { lookS.yaw = damp(lookS.yaw, 0, 5, dt); lookS.pitch = damp(lookS.pitch, 0, 5, dt); }
    Pfinal[CH.n0y] += lookS.yaw * 0.25; Pfinal[CH.n1y] += lookS.yaw * 0.30; Pfinal[CH.hy] += lookS.yaw * 0.45; Pfinal[CH.s2y] += lookS.yaw * 0.0;
    Pfinal[CH.n0p] += lookS.pitch * 0.25; Pfinal[CH.n1p] += lookS.pitch * 0.3; Pfinal[CH.hp] += lookS.pitch * 0.45;
    // -------- mouth smoothing --------
    for (const k in MOUTH0) mouthS[k] = dt > 0 ? damp(mouthS[k], mouthT[k], 38, dt) : mouthT[k];
    // secondary motion from root velocity
    const spd = Math.min(8, Math.hypot(velX, velZ)); ex.crestLag = damp(ex.crestLag, clamp(spd * 0.04, 0, 0.3), 6, dt); ex.capeLag = damp(ex.capeLag, clamp(spd * 0.09, 0, 0.7), 4, dt);
    ex.tendLag = 0.1 + ex.crestLag * 0.8 + 0.06 * Math.sin(t * 2.1); ex.tendSway = 0.08 * Math.sin(t * 1.7 + 1) + (infection > 0.1 ? 0.12 * Math.sin(t * 19) * infection : 0);
    ex.breath = Math.sin(t * 6.2832 / 3.4) * (cur.name.indexOf('run') >= 0 ? 2 : 1);
    rig.applyPose(Pfinal, mouthS, ex);
    // glow intensity (eye band)
    mats.glow.emissiveIntensity = 1.9 * Math.max(0.05, Pfinal[CH.eye]);
    // weapon follows the right hand
    if (ctx.held) {
      weaponMesh.position.copy(rig.rightWrist).add(tmpV.copy(wLocalPos).applyQuaternion(rig.rightHandQ));
      weaponMesh.quaternion.copy(rig.rightHandQ).multiply(R90);
    }
    // tumours
    if (infection > 0.3) { tumors.visible = true; const k = clamp((infection - 0.3) / 0.5); for (let i = 0; i < tumorList.length; i++) { const m = tumorList[i]; m.visible = k > i / tumorList.length; const pulse = 1 + 0.18 * Math.sin(t * 5 + i * 1.7) + 0.12 * Math.sin(t * 11 + i); m.scale.setScalar(m.userData.r * clamp(k * 1.4 - i * 0.08, 0, 1) * pulse); } tumorMat.emissiveIntensity = 1.2 + 0.8 * Math.sin(t * 4); } else tumors.visible = false;
    wglowMat.emissiveIntensity = 2 + Math.max(flash, Pfinal[CH.weap]) * 10;
    return cl;
  }

  const hero = {
    root, kind, rig, profile: { kind, seed }, meshes,
    update(dt, t = ctx.t + dt) {
      ctx.t = t; ctx.E = talkE; ctx.inf = infection;
      // root motion estimate (secondary motion only)
      root.getWorldPosition(tmpV); if (started) { velX = damp(velX, dt > 1e-5 ? (tmpV.x - lastX) / dt : 0, 8, dt); velZ = damp(velZ, dt > 1e-5 ? (tmpV.z - lastZ) / dt : 0, 8, dt); } lastX = tmpV.x; lastZ = tmpV.z; started = true;
      talkE = damp(talkE, talkTarget, 9, dt);
      if (blendT < 1) blendT = Math.min(1, blendT + dt / Math.max(1e-3, blendDur));
      if (cur.explicit) cur.explicit = false; else cur.time += dt * cur.speed;
      const cl = CLIPS[cur.name] || CLIPS.idle; if (!cur.loop && cl) cur.time = Math.min(cur.time, cl.dur);
      applyAll(dt, t);
    },
    /** play(clip, {time, speed=1, blend=0.2, loop, mirror}) — time = explicit local clip time (seek-exact). */
    play(clip, o = {}) {
      const name = CLIPS[clip] ? clip : 'idle'; const cl = CLIPS[name];
      if (name !== cur.name) { Pprev.set(Pfinal); blendT = 0; blendDur = o.blend ?? 0.2; cur.name = name; cur.time = 0; cur.loop = o.loop ?? cl.loop; if (o.time === undefined) cur.time = 0; }
      if (o.speed !== undefined) cur.speed = o.speed; else if (name !== cur.name) cur.speed = 1;
      if (o.loop !== undefined) cur.loop = o.loop;
      if (o.time !== undefined) { cur.time = o.time; cur.explicit = true; if (o.time === 0 && blendT >= 1) { /* restart */ } }
      return hero;
    },
    clipInfo(name) { const c = CLIPS[name]; return c ? { duration: c.dur, loop: c.loop, moveSpeed: c.moveSpeed || 0 } : null; },
    setMouth(p) { for (const k in MOUTH0) mouthT[k] = (p && p[k]) || 0; return hero; },
    setTalk(e = 0, style = 'calm') { talkTarget = clamp(e, 0, 1); if (STYLE[style]) talkStyle = style; return hero; },
    lookAt(v, w = 1) { if (!v) { look = null; lookW = 0; } else { look = (look || new V3()).copy(v); lookW = w; } return hero; },
    setInfection(a) { infection = clamp(a, 0, 1); setInfectionTree(root, infection); setInfectionTree(tumors, 0); return hero; },
    setBloody(a) { bloody = clamp(a, 0, 1); setBloodyTree(root, bloody); return hero; },
    hold(name) { ctx.held = !!name; weaponMesh.visible = ctx.held; return hero; },
    setTransform(x, y, z, yaw) { root.position.set(x, y, z); root.rotation.y = yaw; return hero; },
    /** weapon muzzle world position + direction (for beams). */
    getMuzzle(outPos, outDir) { weaponMesh.updateWorldMatrix(true, false); outPos.copy(WEAPON.muzzle).applyMatrix4(weaponMesh.matrixWorld); if (outDir) outDir.set(0, 0, 1).transformDirection(weaponMesh.matrixWorld); return outPos; },
    /** muzzle flash 0..1 (brightens the lance's cells) */
    setFlash(f) { flash = clamp(f, 0, 1); return hero; },
    getHeadWorld(out) { rig.B.head.getWorldPosition(out); return out; },
    dispose() { disposeTree(root); wglowMat.dispose(); tumorMat.dispose(); },
  };
  // initial pose
  applyAll(0, 0);
  return hero;
}
