// Soft rising puffs: steam off warm water, smoke from chimneys. One Points cloud, normal alpha blending.
import * as THREE from 'three';

const N = 420;
export function makeWisps(scene){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N*3), col = new Float32Array(N*4), size = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const data = Array.from({ length: N }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, r: 1, g: 1, b: 1, a: 0 }));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPPU: { value: 10 } }, // render-target pixels per world unit
    vertexShader: `attribute float size;attribute vec4 color;uniform float uPPU;varying vec4 vC;
      void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.0,size*uPPU);}`,
    fragmentShader: `varying vec4 vC;void main(){vec2 d=gl_PointCoord-0.5;float r=length(d)*2.0;if(r>1.0)discard;
      float a=vC.a*(r<0.45?1.0:r<0.75?0.6:0.3);gl_FragColor=vec4(vC.rgb,a);}`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts);
  let head = 0;
  const KIND = {
    steam: { c: [0.93, 0.92, 0.88], a: 0.3, life: [1.8, 3.2], vy: [0.2, 0.36], s: [0.08, 0.34], drift: 0.12 },
    smoke: { c: [0.62, 0.58, 0.54], a: 0.5, life: [3.0, 4.6], vy: [0.12, 0.22], s: [0.05, 0.26], drift: 0.08 },
    mist:  { c: [0.86, 0.9, 0.86], a: 0.16, life: [3.5, 5.5], vy: [0.02, 0.06], s: [0.3, 0.8], drift: 0.05 },
  };
  const R = (a, b) => a + Math.random() * (b - a);
  function emit(x, y, z, kind = 'steam', tint){
    const K = KIND[kind], k = head++ % N, d = data[k];
    d.life = d.max = R(...K.life); d.vy = R(...K.vy); d.vx = R(-K.drift, K.drift) + 0.06; d.vz = R(-K.drift, K.drift) - 0.03;
    d.s0 = K.s[0] * R(0.8, 1.2); d.s1 = K.s[1] * R(0.8, 1.3);
    const c = tint || K.c; d.r = c[0]; d.g = c[1]; d.b = c[2]; d.a = K.a;
    pos[k*3] = x; pos[k*3+1] = y; pos[k*3+2] = z;
  }
  function update(dt, ppu){
    mat.uniforms.uPPU.value = ppu;
    for (let k = 0; k < N; k++){ const d = data[k];
      if (d.life <= 0){ col[k*4+3] = 0; size[k] = 0; continue; }
      d.life -= dt; const t = 1 - Math.max(0, d.life) / d.max;
      pos[k*3] += d.vx*dt; pos[k*3+1] += d.vy*dt*(1 - t*0.5); pos[k*3+2] += d.vz*dt;
      size[k] = d.s0 + (d.s1 - d.s0) * Math.sqrt(t);
      col[k*4] = d.r; col[k*4+1] = d.g; col[k*4+2] = d.b;
      col[k*4+3] = d.a * Math.min(1, t*6) * (1 - t) * (1 - t*0.3);
    }
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
  }
  return { emit, update };
}
