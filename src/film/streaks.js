// Glowing streaks: missile exhaust plumes, falling-ship reentry plumes. Curved paths (same curve + easing as Entity.path, so a model on
// that path stays on the streak head), screen-space ribbons with a minimum pixel width so they still read from thousands of km away,
// a non-attenuated head glare, and a "pop" when a streak is destroyed. Everything is a pure function of scene time (seek-safe).
import * as THREE from 'three';
import { clamp } from '../engine/common.js';
const V3 = THREE.Vector3;

const VERT = /* glsl */`
attribute vec3 aNext; attribute float aSide; attribute float aU;
uniform vec2 uRes; uniform float uWpx, uWw, uHead, uTail, uGrow;
varying float vU, vSide;
void main() {
  vU = aU; vSide = aSide;
  vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
  if (a.w <= 1e-4) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec2 sa = a.xy / a.w; vec2 sb = b.w > 1e-4 ? b.xy / b.w : sa + vec2(1e-3, 0.0);
  vec2 d = (sb - sa) * uRes; float L = length(d); d = L > 1e-5 ? d / L : vec2(1.0, 0.0);
  float k = clamp((uHead - aU) / max(uTail, 1e-5), 0.0, 1.0);
  float wpx = max(uWpx, uWw * projectionMatrix[1][1] * uRes.y * 0.5 / a.w) * (0.5 + uGrow * k);
  a.xy += vec2(-d.y, d.x) * aSide * wpx / uRes * a.w;
  gl_Position = a;
}`;
const FRAG = /* glsl */`
uniform float uHead, uTail, uAlpha; uniform vec3 uHot, uCool;
varying float vU, vSide;
void main() {
  float d = uHead - vU; if (d < 0.0 || d > uTail) discard;
  float k = d / max(uTail, 1e-5);
  float e = 1.0 - vSide * vSide; e *= e;
  vec3 c = mix(uHot, uCool, smoothstep(0.0, 0.3, k));
  gl_FragColor = vec4(c, e * pow(1.0 - k, 1.6) * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,0.85)'); g.addColorStop(0.35, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); _glow = new THREE.CanvasTexture(c); _glow.userData.shared = true; return _glow;
}
const EASE = { linear: (k) => k, in: (k) => k * k, out: (k) => 1 - (1 - k) * (1 - k), inOut: (k) => k * k * (3 - 2 * k) };
const col3 = (c) => (Array.isArray(c) ? new V3(...c) : new V3(c.r, c.g, c.b));

/** createStreaks(S) -> { add(pts, o) -> streak, glare(pos, o), update(t) }  (auto-updated every frame) */
export function createStreaks(S) {
  const root = new THREE.Group(); root.name = 'streaks'; S.scene.add(root);
  const res = new THREE.Vector2(1280, 720); const list = []; const glares = [];
  const spriteMat = (color, opacity = 1) => new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color[0], color[1], color[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, sizeAttenuation: false });
  /**
   * pts: [[x,y,z]...] path; o: {t0, t1, ease, tailLen (world units), hot:[r,g,b] HDR, cool, widthPx, worldW, grow, headPx, alpha(t)->0..1,
   *      dieAt (destroyed at), popPx, fade (s after arrival/death), N}
   */
  function add(pts, o = {}) {
    const P = pts.map((p) => (p.isVector3 ? p.clone() : new V3(p[0], p[1], p[2])));
    const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal'); curve.arcLengthDivisions = 100; const len = curve.getLength();
    const N = o.N || 72; const pos = new Float32Array(N * 2 * 3), nxt = new Float32Array(N * 2 * 3), side = new Float32Array(N * 2), uu = new Float32Array(N * 2); const idx = [];
    const pt = [];
    for (let i = 0; i < N; i++) pt.push(curve.getPointAt(i / (N - 1)));
    for (let i = 0; i < N; i++) {
      const p = pt[i], q = i < N - 1 ? pt[i + 1] : p.clone().multiplyScalar(2).sub(pt[i - 1]);
      for (let s = 0; s < 2; s++) { const j = i * 2 + s; pos.set([p.x, p.y, p.z], j * 3); nxt.set([q.x, q.y, q.z], j * 3); side[j] = s ? 1 : -1; uu[j] = i / (N - 1); }
      if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aNext', new THREE.BufferAttribute(nxt, 3)); g.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); g.setAttribute('aU', new THREE.BufferAttribute(uu, 1)); g.setIndex(idx);
    const U = {
      uRes: { value: res }, uWpx: { value: o.widthPx ?? 2.5 }, uWw: { value: o.worldW ?? 0 }, uHead: { value: 0 }, uTail: { value: clamp((o.tailLen ?? len * 0.4) / len, 0.001, 1) }, uGrow: { value: o.grow ?? 1.4 },
      uAlpha: { value: 0 }, uHot: { value: col3(o.hot || [7, 5.2, 3.4]) }, uCool: { value: col3(o.cool || [0.9, 0.55, 0.35]) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 18; root.add(mesh);
    const head = new THREE.Sprite(spriteMat(o.hot || [7, 5.2, 3.4])); head.scale.setScalar(o.headPx ?? 0.016); head.renderOrder = 19; root.add(head);
    let pop = null; if (o.dieAt !== undefined) { pop = new THREE.Sprite(spriteMat(o.popColor || [9, 6, 3])); pop.visible = false; pop.renderOrder = 19; root.add(pop); }
    const st = { curve, len, o, mesh, head, pop, U, ease: EASE[o.ease || 'linear'] || EASE.linear, t0: o.t0 ?? 0, t1: o.t1 ?? 10, dieAt: o.dieAt ?? Infinity, fade: o.fade ?? 2.2 };
    st.uAt = (t) => { const tt = Math.min(t, st.dieAt); return st.ease(clamp((tt - st.t0) / Math.max(1e-6, st.t1 - st.t0))); };
    /** world position of the streak head at scene time t */
    st.headAt = (t, out = new V3()) => curve.getPointAt(clamp(st.uAt(t)), out);
    st.tangentAt = (t, out = new V3()) => curve.getTangentAt(clamp(Math.min(0.999, st.uAt(t))), out);
    list.push(st); return st;
  }
  /** a free glare sprite (e.g. a ship's running light): o {color, px, t0, t1, flicker} */
  function glare(pos, o = {}) { const s = new THREE.Sprite(spriteMat(o.color || [0.6, 2.4, 3.2])); s.position.copy(pos.isVector3 ? pos : new V3(...pos)); s.scale.setScalar(o.px ?? 0.006); s.renderOrder = 17; root.add(s); const gl = { s, o, base: o.px ?? 0.006 }; glares.push(gl); return gl; }
  function update(t) {
    S.dir.stage.renderer.getDrawingBufferSize(res);
    for (const st of list) {
      const { o, U, head, pop } = st; const started = t >= st.t0; const dead = t >= st.dieAt; const arrived = t >= st.t1;
      const u = st.uAt(t); U.uHead.value = u;
      const tEnd = dead ? st.dieAt : arrived ? st.t1 : Infinity; const fade = tEnd < Infinity ? clamp(1 - (t - tEnd) / st.fade) : 1;
      const a = (o.alpha ? o.alpha(t) : 1) * fade * (started ? 1 : 0); U.uAlpha.value = a; st.mesh.visible = a > 0.002;
      head.visible = started && !dead && !arrived && (o.alpha ? o.alpha(t) : 1) > 0.01;
      if (head.visible) { curve(st, u, head.position); const fl = 0.9 + 0.1 * Math.sin(t * 47 + st.len) * Math.sin(t * 23.0); head.scale.setScalar((o.headPx ?? 0.016) * fl * (o.alpha ? 0.4 + 0.6 * o.alpha(t) : 1)); }
      if (pop) {
        const age = t - st.dieAt; pop.visible = age >= 0 && age < 1.1;
        if (pop.visible) { curve(st, u, pop.position); const k = age / 1.1; pop.scale.setScalar((o.popPx ?? 0.05) * (0.3 + 1.4 * Math.sqrt(k))); pop.material.opacity = Math.pow(1 - k, 2.2); }
      }
    }
    const cam = S.dir.stage.camera.position;
    for (const g of glares) { const on = (g.o.t0 === undefined || t >= g.o.t0) && (g.o.t1 === undefined || t < g.o.t1) && !(g.o.near && cam.distanceTo(g.s.position) < g.o.near); g.s.visible = on; if (on && g.o.flicker) g.s.scale.setScalar(g.base * (0.85 + 0.15 * Math.sin(t * g.o.flicker + g.base * 1e3))); }
  }
  function curve(st, u, out) { st.curve.getPointAt(clamp(u), out); return out; }
  S.during(-1, S.duration + 1, (t) => update(t));
  return { root, add, glare, update, list };
}
