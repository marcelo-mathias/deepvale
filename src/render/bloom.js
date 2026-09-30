// Bloom: bright parts of the scene (lamps, windows, glowing fish) bleed soft light into their surroundings.
// Runs on the low-res scene target: a bright pass at half size, blurred, then again at quarter size.
// The post shader adds both levels back in before tone mapping.
import * as THREE from 'three';

const VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const BRIGHT = `uniform sampler2D tSrc;uniform vec2 uTexel;uniform float uThr;varying vec2 vUv;
  void main(){
    vec3 c=texture2D(tSrc,vUv+uTexel*vec2(-.5,-.5)).rgb+texture2D(tSrc,vUv+uTexel*vec2(.5,-.5)).rgb
          +texture2D(tSrc,vUv+uTexel*vec2(-.5,.5)).rgb+texture2D(tSrc,vUv+uTexel*vec2(.5,.5)).rgb;
    c*=0.25;float l=max(c.r,max(c.g,c.b));
    // soft knee: fades in above the threshold instead of switching on
    float k=clamp((l-uThr)/(uThr*0.6+1e-4),0.0,1.0);
    gl_FragColor=vec4(c*k*k,1.0);}`;
const BLUR = `uniform sampler2D tSrc;uniform vec2 uDir;varying vec2 vUv;
  void main(){
    vec3 c=texture2D(tSrc,vUv).rgb*0.2270270270;
    c+=(texture2D(tSrc,vUv+uDir*1.3846153846).rgb+texture2D(tSrc,vUv-uDir*1.3846153846).rgb)*0.3162162162;
    c+=(texture2D(tSrc,vUv+uDir*3.2307692308).rgb+texture2D(tSrc,vUv-uDir*3.2307692308).rgb)*0.0702702703;
    gl_FragColor=vec4(c,1.0);}`;

export function makeBloom(renderer){
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), scn = new THREE.Scene(); scn.add(quad);
  const mk = frag => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 1 }, uDir: { value: new THREE.Vector2() } } });
  const brightM = mk(BRIGHT), blurM = mk(BLUR);
  const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let a1, b1, a2, b2;
  function resize(w, h){
    for (const r of [a1, b1, a2, b2]) r && r.dispose();
    const w1 = Math.max(8, w >> 1), h1 = Math.max(8, h >> 1), w2 = Math.max(4, w >> 2), h2 = Math.max(4, h >> 2);
    a1 = new THREE.WebGLRenderTarget(w1, h1, opts); b1 = new THREE.WebGLRenderTarget(w1, h1, opts);
    a2 = new THREE.WebGLRenderTarget(w2, h2, opts); b2 = new THREE.WebGLRenderTarget(w2, h2, opts);
  }
  function pass(m, src, dst){ quad.material = m; m.uniforms.tSrc.value = src.texture || src; renderer.setRenderTarget(dst); renderer.render(scn, cam); }
  function blur(a, b, spread){
    blurM.uniforms.uDir.value.set(spread / a.width, 0); pass(blurM, a, b);
    blurM.uniforms.uDir.value.set(0, spread / a.height); pass(blurM, b, a);
  }
  // src: the scene target. thr: brightness where bloom starts (lower at night)
  function render(src, thr){
    brightM.uniforms.uThr.value = thr; brightM.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    pass(brightM, src, a1); blur(a1, b1, 1); blur(a1, b1, 1.6);
    blurM.uniforms.uDir.value.set(0, 0); pass(blurM, a1, a2); blur(a2, b2, 1); blur(a2, b2, 1.8);
  }
  return { resize, render, get near(){ return a1.texture; }, get far(){ return a2.texture; } };
}
