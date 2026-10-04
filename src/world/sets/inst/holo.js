// Holographic projection helpers (additive shader sphere with wire grid + dot land)
import * as THREE from 'three';
/** additive holographic planet: wire grid + dot land (shader, infect-tinted). returns {mesh, m, setInfection} */
export function holoSphere(k, r, pos, color = 0x46e6ff, parent = null) {
  const m = new THREE.ShaderMaterial({ uniforms: { uT: k.uTime, uInf: { value: 0 }, uC: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uT; uniform float uInf; uniform vec3 uC; varying vec3 vN; varying vec3 vP; varying vec3 vV;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){ vec3 p = normalize(vP); float lon = atan(p.x, p.z) + uT * 0.25; float lat = asin(p.y);
        float f1 = fract(lon * 3.8197), f2 = fract(lat * 5.73); float gl = (1.0 - smoothstep(0.0, 0.03, min(f1, 1.0 - f1))) + (1.0 - smoothstep(0.0, 0.03, min(f2, 1.0 - f2)));
        vec2 q = vec2(lon * 9.0, lat * 9.0); vec2 f = fract(q) - 0.5; float dotm = (1.0 - smoothstep(0.1, 0.28, length(f))) * step(0.5, h(floor(q) + floor(uT * 0.3)));
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        vec3 col = mix(uC, vec3(0.3,1.0,0.1), uInf); float a = gl * 0.45 + dotm * 0.5 + fr * 0.8; gl_FragColor = vec4(col * a * 0.95, 1.0); }` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), m); mesh.position.set(...pos); mesh.renderOrder = 6; (parent || k.dyn).add(mesh);
  return { mesh, m, setInfection: (a) => { m.uniforms.uInf.value = a; } };
}
