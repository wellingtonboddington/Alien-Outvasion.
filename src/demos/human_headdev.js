// dev demo: head sculpt inspection (not part of the deliverable list)
import * as THREE from 'three';
import { addStudioLights } from '../engine/stage.js';
import { resolveProfile, MAIN_CAST } from '../models/human/profiles.js';
import { computeLayout, createRig } from '../models/human/rig.js';
import { buildHead } from '../models/human/head.js';
import { buildBodySkin } from '../models/human/body.js';
import { makeFX, makeSkinMaterials } from '../models/human/skin.js';
import { buildEyeGeometry, buildMouthGeometry, buildBrows, browMaterial, buildLashes, irisTexture, FaceRig } from '../models/human/face.js';

export default async function setup(stage, params) {
  addStudioLights(stage, { shadows: false, intensity: 0.8 });
  const k2 = new THREE.DirectionalLight(0xffe6cc, 1.2); k2.position.set(-3, 2.5, 3); stage.scene.add(k2);
  const P = resolveProfile(MAIN_CAST[params.who || 'mirrah']);
  const L = computeLayout(P);
  const rig = createRig(L);
  const t0 = performance.now();
  const head = buildHead(P, L, rig.index);
  const tH = performance.now() - t0;
  const body = buildBodySkin(P, L, rig);
  const fx = makeFX();
  const t1 = performance.now();
  const sk = makeSkinMaterials(P, fx);
  const tT = performance.now() - t1;
  const root = new THREE.Group(); root.add(rig.root);
  const meshes = [];
  const add = (g, m) => { const s = new THREE.SkinnedMesh(g, m); s.frustumCulled = false; root.add(s); meshes.push(s); return s; };
  const mh = add(head.geometry, sk.head); const mb = add(body.geometry, sk.body);
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: irisTexture(P.eyes.color), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0 });
  add(buildEyeGeometry(head, rig.index), eyeMat);
  const mouth = add(buildMouthGeometry(head, rig.index), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }));
  const bg = buildBrows(P, head, rig.index);
  const browMesh = add(bg, browMaterial(P));
  const lg = buildLashes(P, head, rig.index);
  const lashMesh = lg ? add(lg, new THREE.MeshStandardMaterial({ color: 0x050303, roughness: 0.5, side: THREE.DoubleSide })) : null;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: sk.headMap })); plane.position.set(5, 1, 0); stage.scene.add(plane);
  const plane2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sk.bodyMap })); plane2.position.set(5, 1, -2); stage.scene.add(plane2);
  root.updateMatrixWorld(true);
  for (const m of meshes) m.bind(rig.skeleton);
  stage.scene.add(root);
  const face = new FaceRig({ head, headMesh: mh, followers: [browMesh, lashMesh].filter(Boolean), mouthMesh: mouth, bones: rig.bones, profile: P });
  console.log('head ms', Math.round(tH), 'tex ms', Math.round(tT), 'headTris', head.geometry.index.count / 3, 'bodyTris', body.geometry.index.count / 3);
  const hp = L.J.head; const H = L.dims.H;
  const cam = (a, d, h = 0.02, fov = 30) => ({ cam: [hp.x + Math.sin(a) * d, hp.y + h, hp.z + Math.cos(a) * d, hp.x, hp.y - 0.02, hp.z], fov });
  const shots = [
    { name: 'front', t: 0, ...cam(0, 0.55) },
    { name: 'side', t: 0, ...cam(Math.PI / 2, 0.6) },
    { name: 'q34', t: 0, ...cam(0.7, 0.55) },
    { name: 'open', t: 0.1, ...cam(0.3, 0.45), m: { jaw: 0.8, wide: 0.2 } },
    { name: 'blink', t: 0.2, ...cam(0.3, 0.45), e: { blink: 1 } },
    { name: 'smile', t: 0.3, ...cam(0.3, 0.45), e: { smile: 1 } },
    { name: 'tex', t: 0.4, cam: [5, 1, 2.4, 5, 1, 0], fov: 40 },
    { name: 'btex', t: 0.4, cam: [5, 1, 0.6, 5, 1, -2], fov: 40 },
    { name: 'body', t: 0.4, cam: [0, H * 0.55, 4.2, 0, H * 0.5, 0], fov: 32 },
  ];
  return { update(t, dt) { face.update(dt, t, null); }, shots, onShot(s) { face.setMouth(s.m || {}); face.setExpression(s.e || {}); face.update(1 / 30, s.t, null); } };
}
