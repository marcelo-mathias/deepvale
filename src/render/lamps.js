// Night lighting: every lantern, lamp, lit window and fisher's lantern casts a warm pool of light.
// Lights are applied in the post pass from the depth buffer (world position of each pixel), so terrain,
// roads, houses, trees and water are all lit the same way without touching their materials.
// Only the LAMPN lights nearest the middle of the view are used at once.
import * as THREE from 'three';

export const LAMPN = 40;
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
export const LAMP_KIND = {
  lantern: { c: lin('#ffb35a'), r: 2.8, i: 1.5,  y: .38 },  // stone lantern, corner lantern
  lamp:    { c: lin('#ffc46a'), r: 2.5, i: 1.3,  y: .32 },  // road lamp
  window:  { c: lin('#ffa04a'), r: 1.5, i: .55,  y: .14 },  // lit hut windows
  shop:    { c: lin('#ffb35a'), r: 1.9, i: .7,   y: .2 },   // workshop, market, trading post
  shrine:  { c: lin('#ffe6a0'), r: 2.6, i: .8,   y: .3 },
  fisher:  { c: lin('#ffc27a'), r: 1.1, i: .5,   y: .16 },  // the little lantern every fisher sets down at night
};

export function makeLamps(){
  const pos = Array.from({ length: LAMPN }, () => new THREE.Vector4(0, -999, 0, 1)); // x, y, z, radius
  const col = Array.from({ length: LAMPN }, () => new THREE.Vector4());             // rgb * intensity, flicker seed
  const uniforms = { uLampPos: { value: pos }, uLampCol: { value: col }, uLampOn: { value: 0 } };
  let src = [];
  // list: [{kind, x, y, z, scale?}] gathered from the world by main.js
  function set(list){ src = list.map((l, n) => ({ ...l, seed: (l.x * 12.9898 + l.z * 78.233 + n) % 6.283 })); }
  // pick the lights nearest the view centre
  function update(cx, cz){
    const L = src.slice().sort((a, b) => ((a.x - cx) ** 2 + (a.z - cz) ** 2) - ((b.x - cx) ** 2 + (b.z - cz) ** 2));
    for (let n = 0; n < LAMPN; n++){
      const l = L[n];
      if (!l){ pos[n].set(0, -999, 0, 1); col[n].set(0, 0, 0, 0); continue; }
      const K = LAMP_KIND[l.kind], s = l.scale || 1;
      pos[n].set(l.x, l.y + K.y, l.z, K.r * Math.sqrt(s));
      col[n].set(K.c.r * K.i * s, K.c.g * K.i * s, K.c.b * K.i * s, l.seed);
    }
  }
  return { uniforms, set, update, get count(){ return src.length; } };
}

// GLSL for the post shader: light at a world position, and a matching glow halo in screen space
export const LAMP_GLSL = `
uniform vec4 uLampPos[${LAMPN}];uniform vec4 uLampCol[${LAMPN}];uniform float uLampOn;
vec3 lampLight(vec3 w,float t){
  vec3 L=vec3(0.0);
  for(int n=0;n<${LAMPN};n++){
    vec4 P=uLampPos[n];vec3 d=w-P.xyz;d.y*=1.6;
    float f=clamp(1.0-length(d)/P.w,0.0,1.0);f*=f;
    float fl=0.9+0.1*sin(t*7.0+uLampCol[n].w*9.0)*sin(t*2.3+uLampCol[n].w*3.0);
    L+=uLampCol[n].rgb*f*fl;
  }
  return L*uLampOn;
}`;
