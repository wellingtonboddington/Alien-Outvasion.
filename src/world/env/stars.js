// Star dome: thousands of coloured, sized, twinkling points at infinity (+ optional milky-way dome). Shared by sky (night) and space.
import * as THREE from 'three';
import { RNG } from '../../engine/common.js';
import { skyNoiseTex } from './noise.js';
import { SKY_VERT, MILKY_GLSL } from './skyShader.js';

const STAR_VERT = /* glsl */`
attribute vec3 aColor; attribute vec2 aSP; uniform float uVis; uniform float uTime; uniform float uPx;
varying vec3 vCol; varying float vSize;
void main() {
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
  float tw = 0.82 + 0.18 * sin(uTime * (1.3 + aSP.y * 2.5) + aSP.y * 61.0);
  float s = aSP.x * uPx;
  vSize = s; gl_PointSize = max(s * 1.8, 2.0);
  vCol = aColor * tw * uVis * min(1.0, s * s * 0.9);
}`;
const STAR_FRAG = /* glsl */`
varying vec3 vCol; varying float vSize;
void main() {
  vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0;
  float a = exp(-r * r * 6.0) + exp(-r * 18.0) * 0.4;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const GN = new THREE.Vector3(0.3339, 0.8197, 0.465).normalize();

/** createStarDome({count, seed, brightness, milkyBias}) -> {root, setVisibility(0..1), update(t), dispose()} */
export function createStarDome({ count = 5000, seed = 7, brightness = 1, milkyBias = 0.4, maxSize = 2.6 } = {}) {
  const r = new RNG(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sp = new Float32Array(count * 2);
  const tmp = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  u.set(1, 0, 0).cross(GN).normalize(); v.crossVectors(GN, u);
  const C = new THREE.Color();
  for (let i = 0; i < count; i++) {
    if (r.next() < milkyBias) { // concentrate along galactic plane
      const lon = r.range(0, Math.PI * 2), b = r.gauss() * 0.16; const cb = Math.cos(b);
      tmp.set(0, 0, 0).addScaledVector(u, Math.cos(lon) * cb).addScaledVector(v, Math.sin(lon) * cb).addScaledVector(GN, Math.sin(b));
    } else tmp.copy(r.unit());
    tmp.normalize(); pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
    const mag = Math.pow(r.next(), 5.5); // few bright, many faint
    const temp = r.next(); // blue-white .. yellow .. orange
    if (temp < 0.25) C.setRGB(0.62, 0.74, 1.0); else if (temp < 0.7) C.setRGB(1, 0.96, 0.9); else if (temp < 0.9) C.setRGB(1, 0.84, 0.62); else C.setRGB(1, 0.62, 0.45);
    const b = (0.14 + mag * 3.2) * brightness;
    col[i * 3] = C.r * b; col[i * 3 + 1] = C.g * b; col[i * 3 + 2] = C.b * b;
    sp[i * 2] = 0.55 + mag * (maxSize - 0.55); sp[i * 2 + 1] = r.next();
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSP', new THREE.BufferAttribute(sp, 2));
  const uniforms = { uVis: { value: 1 }, uTime: { value: 0 }, uPx: { value: 1 } };
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -900; pts.name = 'stars';
  pts.onBeforeRender = (renderer) => { const s = renderer.getDrawingBufferSize(tmp2); uniforms.uPx.value = Math.max(0.6, s.y / 540); };
  const tmp2 = new THREE.Vector2();
  const root = new THREE.Group(); root.name = 'starDome'; root.add(pts);
  return {
    root, uniforms,
    setVisibility(k) { uniforms.uVis.value = k; pts.visible = k > 0.002; },
    update(t) { uniforms.uTime.value = t; },
    dispose() { g.dispose(); m.dispose(); },
  };
}

const MW_FRAG = /* glsl */`
${MILKY_GLSL}
uniform float uAmt; uniform vec3 uTint;
#include <common>
#include <dithering_pars_fragment>
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = milkyWay(d) * uAmt;
  // faint colourful nebula wash
  float n = tri(d, 1.1, 1) * 0.6 + tri(d, 2.9, 2) * 0.4;
  c += uTint * smoothstep(0.55, 0.85, n) * 0.012 * uAmt;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
}`;
/** Milky-way + faint nebula background dome (opaque, drawn first). */
export function createMilkyWayDome({ amount = 1.2, tint = [0.4, 0.25, 0.7] } = {}) {
  const uniforms = { uNoise: { value: skyNoiseTex() }, uAmt: { value: amount }, uTint: { value: new THREE.Vector3(...tint) } };
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: MW_FRAG, depthWrite: false, depthTest: false, fog: false, side: THREE.BackSide, dithering: true });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m); mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.name = 'milkyWay';
  return { mesh, uniforms, dispose() { mesh.geometry.dispose(); m.dispose(); } };
}
