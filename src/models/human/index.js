// Human module entry. createHuman(profile) -> fully rigged, skinned, talking human. See docs/api/human.md
import * as THREE from 'three';
import { disposeTree, damp, clamp, lerp } from '../../engine/common.js';
import { resolveProfile, MAIN_CAST, ETHNICITY } from './profiles.js';
import { computeLayout, createRig } from './rig.js';
import { buildBodySkin } from './body.js';
import { buildHead } from './head.js';
import { makeFX, makeSkinMaterials, patchMaterial, STRAINS } from './skin.js';
import { buildEyeGeometry, buildMouthGeometry, buildBrows, browMaterial, buildLashes, irisTexture, holoEmissiveTexture, FaceRig, glowEyeTexture } from './face.js';
import { Animator, fkPos, fkQuat } from './anim_core.js';
import { CLIPS } from './clips.js';
import { planHair, buildHair } from './hair.js';
import { buildClothing } from './clothing.js';
import { createProp } from './props.js';

export { MAIN_CAST };
export { createNPC, NPC_KINDS } from './npc.js';

const _v = new THREE.Vector3();

export class Human {
  constructor(profile, opts = {}) {
    const P = this.profile = resolveProfile(profile);
    this.opts = opts;
    const L = this.layout = computeLayout(P);
    const hairPlan = planHair(P, L);
    const rig = this.rig = createRig(L, hairPlan.bones);
    const fx = this.fx = makeFX(); fx.uSeed.value = (P.seed % 100) * 0.37;
    const root = this.root = new THREE.Group(); root.name = 'human_' + P.id;
    root.add(rig.root);
    this.meshes = []; this._mat = [];
    const add = (geo, mat, name, o = {}) => {
      const m = new THREE.SkinnedMesh(geo, mat); m.name = name; m.frustumCulled = false; m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
      if (o.order) m.renderOrder = o.order; root.add(m); this.meshes.push(m); return m;
    };
    // ---- skin
    const sk = this.skin = makeSkinMaterials(P, fx);
    const bodyGeo = buildBodySkin(P, L, rig);
    this.bodyData = bodyGeo;
    const head = this.head = buildHead(P, L, rig.index, { lod: opts.lod || 0 });
    this.headMesh = add(head.geometry, sk.head, 'head');
    this.bodyMesh = add(bodyGeo.geometry, sk.body, 'body');
    // ---- eyes, mouth, brows, lashes
    const irisTex = irisTexture(P.eyes.color);
    const eyeMat = this.eyeMat = new THREE.MeshPhysicalMaterial({ map: irisTex, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.035, metalness: 0, envMapIntensity: 1.2, emissive: 0x000000, emissiveIntensity: 1 });
    if (P.eyes.holo) { eyeMat.emissiveMap = holoEmissiveTexture(); eyeMat.emissive = new THREE.Color(0x46e6ff); eyeMat.emissiveIntensity = 1.6; }
    this.eyeBase = { holo: !!P.eyes.holo, map: irisTex };
    this.eyeMesh = add(buildEyeGeometry(head, rig.index), eyeMat, 'eyes', { cast: false });
    const mouthMat = this.mouthMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0 });
    this.mouthMesh = add(buildMouthGeometry(head, rig.index), mouthMat, 'mouth', { cast: false });
    const bg = buildBrows(P, head, rig.index);
    const browMat = this.browMat = browMaterial(P);
    this.browMesh = add(bg, browMat, 'brows', { cast: false });
    const lg = buildLashes(P, head, rig.index);
    const lashMat = this.lashMat = new THREE.MeshStandardMaterial({ color: 0x0a0605, roughness: 0.55, side: THREE.DoubleSide });
    this.lashMesh = lg ? add(lg, lashMat, 'lashes', { cast: false }) : null;
    // ---- clothing + hair
    this.clothing = buildClothing(P, L, rig, head, fx, bodyGeo);
    for (const c of this.clothing.meshes) { const m = add(c.geometry, c.material, c.name, { cast: c.cast, receive: true }); c.mesh = m; if (c.material.userData && c.material.userData.fxOwned === undefined) this._mat.push(c.material); }
    this.hair = buildHair(P, L, rig, head, fx, hairPlan);
    for (const hm of this.hair.meshes) { hm.mesh = add(hm.geometry, hm.material, hm.name, { cast: hm.cast !== false }); }
    // bind skeleton
    root.updateMatrixWorld(true);
    for (const m of this.meshes) m.bind(rig.skeleton, new THREE.Matrix4());
    // face rig
    this.face = new FaceRig({ head, headMesh: this.headMesh, followers: [this.browMesh, this.lashMesh].filter(Boolean), mouthMesh: this.mouthMesh, bones: rig.bones, profile: P });
    // animation
    this.joints = {};
    this._buildJoints();
    this.energy = 0.5; this.talkStyle = 'calm'; this.breathRate = P.isFemale ? 0.05 : 0; this.breathHeavy = P.build.belly > 0.5 ? 0.5 : 0; this.fingerCurl = 0;
    this.anim = new Animator(this, CLIPS);
    this.held = null; this.prop = null; this.propName = null;
    this.infection = { strain: null, amount: 0 };
    this.height = P.height; this.baseScale = 1;
    this._t = 0; this.clipExpr = null;
    this.update(1 / 60, 0);
  }
  _buildJoints() {
    const b = this.rig.bones, j = this.joints;
    Object.assign(j, b);
    const alias = { shoulderL: 'upperArmL', shoulderR: 'upperArmR', elbowL: 'foreArmL', elbowR: 'foreArmR', wristL: 'handL', wristR: 'handR', hipL: 'upperLegL', hipR: 'upperLegR', kneeL: 'lowerLegL', kneeR: 'lowerLegR', ankleL: 'footL', ankleR: 'footR', pelvis: 'hips' };
    for (const k in alias) j[k] = b[alias[k]];
    j.root = this.root;
    // anchors
    const mk = (name, parent, pos) => { const o = new THREE.Object3D(); o.name = name; o.position.copy(pos); b[parent].add(o); j[name] = o; return o; };
    const J = this.layout.J, sh = this.layout.dims.sh;
    mk('headTop', 'head', new THREE.Vector3(0, 0.115 * sh, 0));
    mk('eyes', 'head', new THREE.Vector3(0, 0.0045 * sh, 0.075 * sh));
    mk('mouth', 'head', new THREE.Vector3(0, -0.0665 * sh, 0.092 * sh));
    mk('chestFront', 'chest', new THREE.Vector3(0, 0.05, 0.14 * this.layout.dims.H / 1.75));
    mk('collar', 'chest', new THREE.Vector3(0, (J.neck.y - J.chest.y) - 0.025, 0.07));
    mk('chestL', 'chest', new THREE.Vector3(0.075, 0.07, 0.115));
    mk('pinAnchor', 'chest', new THREE.Vector3(-0.07 * this.layout.dims.H / 1.75, (J.neck.y - J.chest.y) - 0.045, 0.085 * this.layout.dims.H / 1.75));
  }
  getJointWorldPosition(name, out = new THREE.Vector3()) {
    const o = this.joints[name]; if (!o) return out.copy(this.root.position);
    this.root.updateWorldMatrix(true, false);
    o.updateWorldMatrix(true, false); return out.setFromMatrixPosition(o.matrixWorld);
  }
  setTransform(x, y, z, yaw) { this.root.position.set(x, y, z); if (yaw !== undefined) this.root.rotation.y = yaw; this.root.updateMatrixWorld(true); }
  play(clip, o = {}) { this.anim.play(clip, o); }
  setMouth(p) { this.face.setMouth(p); }
  setTalk(energy = 0.5, style = 'calm') { this.energy = clamp(energy, 0, 1); this.talkStyle = style || 'calm'; this.face.mouthAmp = (style === 'angry' || style === 'excited') ? 1.1 : style === 'sad' ? 0.8 : style === 'afraid' ? 0.95 : 1; }
  setExpression(e) { this.face.setExpression(e); }
  lookAt(v, w = 1) { this.anim.look = v ? (this.anim.look || new THREE.Vector3()).copy(v) : null; this.anim.lookW = w; if (!v) this.anim.lookW = 0; }
  hold(name, hand = 'R') {
    if (this.prop) { this.prop.obj.parent && this.prop.obj.parent.remove(this.prop.obj); this.prop.dispose && this.prop.dispose(); this.prop = null; this.held = null; this.propName = null; }
    if (!name) return;
    const S = hand === 'L' ? 'L' : 'R';
    const pr = createProp(name, this, S); if (!pr) return;
    this.rig.bones['hand' + S].add(pr.obj); this.prop = pr; this.propName = name;
    this.held = { handS: S, pose: pr.pose || 'grip_rifle', offPose: pr.offPose || null };
    pr.obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  }
  setBloody(a) { this.fx.uBlood.value = clamp(a, 0, 1); }
  setDirt(a) { this.fx.uDirt.value = clamp(a, 0, 1); }
  setInfection(a) { this.setInfected(a > 0 ? 'cebu' : null, a); }
  setInfected(strain, amount = 1) {
    const fx = this.fx, P = this.profile;
    this.infection = { strain, amount };
    if (!strain || amount <= 0) {
      fx.uInfect.value = 0; fx.uWet.value = 0; fx.uFrost.value = 0; this.root.scale.set(1, 1, 1);
      this.eyeMat.color.set(0xffffff); this.eyeMat.map = this.eyeBase.map; this.eyeMat.emissiveIntensity = this.eyeBase.holo ? 1.6 : 0; if (!this.eyeBase.holo) { this.eyeMat.emissive.set(0x000000); this.eyeMat.emissiveMap = null; } else { this.eyeMat.emissive.set(0x46e6ff); this.eyeMat.emissiveMap = holoEmissiveTexture(); }
      this.eyeMat.needsUpdate = true; this.fingerCurl = 0;
      if (this.hair.setFrost) this.hair.setFrost(0); this.hair.setInfectTint && this.hair.setInfectTint(null, 0);
      return;
    }
    const st = STRAINS[strain] || STRAINS.us; const a = clamp(amount, 0, 1);
    fx.uInfect.value = a; fx.uTint.value.set(st.tint[0], st.tint[1], st.tint[2]); fx.uTintAmt.value = st.tintAmt; fx.uVeinCol.value.set(st.vein[0], st.vein[1], st.vein[2]); fx.uVeinAmt.value = st.veinAmt; fx.uVeinScale.value = st.veinScale; fx.uVeinEmit.value = st.veinEmit;
    fx.uBruise.value.set(st.bruise[0], st.bruise[1], st.bruise[2]); fx.uBruiseAmt.value = st.bruiseAmt; fx.uWet.value = st.wet * a;
    fx.uFrost.value = strain === 'russia' ? a : 0;
    // eyes
    const em = this.eyeMat; em.needsUpdate = true;
    const ec = new THREE.Color(st.eye);
    if (strain === 'cebu') { em.map = glowEyeTexture(); em.emissiveMap = em.map; em.emissive.set(0x4dff22); em.emissiveIntensity = 1.8 * a; em.color.set(0xffffff); }
    else if (strain === 'india') { em.color.set(0xffd2c0).lerp(new THREE.Color(0xffffff), 1 - a); em.emissiveIntensity = 0; em.map = this.eyeBase.map; }
    else if (strain === 'russia') { em.color.set(0xcfe8ff); em.map = this.eyeBase.map; em.emissive.set(0x5fb8ff); em.emissiveMap = this.eyeBase.map; em.emissiveIntensity = 0.35 * a; }
    else if (strain === 'germany') { em.color.set(0xe8e4f0); em.map = this.eyeBase.map; em.emissiveIntensity = 0; }
    else { em.color.set(0xd8d490); em.map = this.eyeBase.map; em.emissiveIntensity = 0; }
    // bulk / size
    let sx = 1, sy = 1;
    if (strain === 'us') { sx = lerp(1, 1.13, a); sy = lerp(1, 1.03, a); }
    if (strain === 'us_giant') { const k = 2.45 / this.height; sy = lerp(1, k, a); sx = lerp(1, k * 1.2, a); }
    if (strain === 'russia') { sx = lerp(1, 1.04, a); }
    this.root.scale.set(sx, sy, sx);
    this.fingerCurl = strain === 'germany' ? 0.1 : 0;
    if (this.hair.setFrost) this.hair.setFrost(strain === 'russia' ? a : 0);
    this.hair.setInfectTint && this.hair.setInfectTint(strain, a);
  }
  update(dt, t) {
    this._t = t;
    const an = this.anim;
    an.update(dt, t);
    // clip-suggested expression merged with manual
    const ce = an.meta.expr || null;
    this.face.cexpr = ce;
    this.face.update(dt, t, an.gaze);
    if (this.hair.update) this.hair.update(dt, t, this);
    if (this.prop && this.prop.update) this.prop.update(dt, t, this);
    this.clothing.update && this.clothing.update(dt, t, this);
  }
  dispose() {
    if (this.prop) { this.prop.dispose && this.prop.dispose(); }
    this.hair.dispose && this.hair.dispose();
    disposeTree(this.root);
    for (const m of this.meshes) m.skeleton && m.skeleton.dispose && 0;
    this.rig.skeleton.dispose();
  }
}
export function createHuman(profile, opts) { return new Human(profile, opts); }
