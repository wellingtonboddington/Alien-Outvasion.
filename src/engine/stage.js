// Stage = renderer + scene + camera with the film's colour pipeline. Used by the director AND by every demo/test harness.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createStage({ canvas, width = 1280, height = 720, pixelRatio = 1, antialias = true, preserveDrawingBuffer = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance', preserveDrawingBuffer, alpha: false, stencil: false });
  renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 6000);
  camera.position.set(0, 1.6, 4);
  const stage = {
    renderer, scene, camera, width, height,
    resize(w, h, pr) { this.width = w; this.height = h; if (pr) renderer.setPixelRatio(pr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    render() { renderer.render(scene, camera); },
  };
  return stage;
}

let _roomEnv = null;
/**
 * Neutral "photo studio" lighting for model demos: PMREM room environment + key/fill/rim lights. Returns the light group.
 * (Real scenes get their lighting from the sky/scene module; this is only for model development.)
 */
export function addStudioLights(stage, { shadows = true, intensity = 1, bg = 0x30343a } = {}) {
  const { scene, renderer } = stage;
  if (!_roomEnv) { const pm = new THREE.PMREMGenerator(renderer); _roomEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
  scene.environment = _roomEnv; scene.environmentIntensity = 0.55 * intensity; scene.background = new THREE.Color(bg);
  const g = new THREE.Group();
  const key = new THREE.DirectionalLight(0xfff1e0, 2.6 * intensity); key.position.set(4, 7, 5);
  if (shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const c = key.shadow.camera; c.left = -6; c.right = 6; c.top = 6; c.bottom = -6; c.near = 0.5; c.far = 30; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; }
  const rim = new THREE.DirectionalLight(0x9cc8ff, 1.6 * intensity); rim.position.set(-5, 4, -5);
  const fill = new THREE.HemisphereLight(0xbcd0ff, 0x302820, 0.5 * intensity);
  g.add(key, rim, fill); scene.add(g);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'studioFloor'; g.add(floor);
  return g;
}
