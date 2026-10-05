import * as THREE from 'three';
import { buildEarthTextures, buildMoonTextures } from '../world/env/earthData.js';
export default async function setup(stage) {
  const { scene, camera } = stage; scene.background = new THREE.Color(0x202020);
  const tx = buildEarthTextures(1); console.log('tex ms', tx.ms, tx.W, tx.H);
  const mk = (frag, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.ShaderMaterial({ uniforms: { t: { value: tx.map }, c: { value: tx.clouds }, l: { value: tx.lights } }, vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `uniform sampler2D t; uniform sampler2D c; uniform sampler2D l; varying vec2 vUv; void main(){ vec4 m=texture2D(t,vUv); ${frag} }` })); m.position.set(x, y, 0); scene.add(m); };
  mk('gl_FragColor=vec4(vec3(m.r),1.);', -1.05, 0.55);
  mk('gl_FragColor=vec4(m.g,m.b,m.a,1.);', 1.05, 0.55);
  mk('gl_FragColor=vec4(vec3(texture2D(c,vUv).r),1.);', -1.05, -0.55);
  mk('gl_FragColor=vec4(vec3(texture2D(l,vUv).r),1.);', 1.05, -0.55);
  camera.position.set(0, 0, 2.6); camera.fov = 50; camera.lookAt(0, 0, 0);
  return { update() {}, shots: [{ name: 'tex', t: 0 }] };
}
