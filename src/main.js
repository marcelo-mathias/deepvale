import * as THREE from 'three';
import { clamp, lerp, smooth, rand, hash2, fbm, ridged, fmt, store } from './core/utils.js';
import { GW, GH, HX, HZ, WATER_Y, BED_Y, LAND_Y, WILD, LAND, WATER, idx, tileC, inGrid, riverZ,
  NONE, HUT, ROAD, BRIDGE, WAY_I, DECK_Y, HOUSING, mouthRows, OLD_GW, OLD_GH, OLD_OFF_I, OLD_OFF_J } from './world/constants.js';
import { B, DEFS, DEF_BY_CODE, CATS, GOODS, GOOD_IDS, RESERVE, STYLES, STYLE_IDS, PAVES, PAVE_IDS, STATUE_FX, BLUEPRINTS,
  KEEPERS, KEEPER, BOONS, BOON, SETS, SET } from './data/builds.js';
import { makeSecrets, SECRET_TYPES } from './world/secrets.js';
import { makeProps } from './render/props.js';
import { makeTrade } from './game/trade.js';
import { makeTally } from './ui/tally.js';
import { SPECIES, SP } from './data/species.js';
import { LORE, TALE_AT, VILLAGE_NAMES } from './data/lore.js';
import { NOISE_GLSL, RIM_FRAG, BEND_VERT, BEND_DECL } from './render/shaders.js';
import { setSound as setAudio, sfx, isSoundOn, setView as setAudioView } from './audio/audio.js';
import { makeFlow, solveFlow } from './world/flow.js';
import { makeWisps } from './render/wisps.js';
import { makeVillage } from './render/village.js';
import { initMap } from './ui/map.js';

function setSound(on){ setAudio(on); document.getElementById('btnSound').textContent = on ? 'Sound on' : 'Sound off'; }

/* ================= state ================= */
// scales: shed by released fish, pay for river and building work. silver: left by pilgrims, pays fishers and upgrades.
// goods: timber, reeds, clay (raw) and carvings, lanterns (crafted). meta: per-tile extras {style, pave, sp}. counts: how many of each build (for costs).
const S={scales:20,silver:10,tiles:null,builds:null,fishers:[],hires:0,clears:0,digs:0,huts:0,bridges:0,lineLv:0,baitLv:0,codex:{},hutVillage:{},earned:0,income:[],t:Date.now(),first:true,
  goods:{timber:10,reeds:0,clay:0,carvings:0,lanterns:0},reserve:{...RESERVE},meta:{},counts:{},keepers:[],boons:{},unlocked:{},seed:0,found:[],deposits:[],
  orders:[],ordersDone:0,shipments:0,wish:null,wishesDone:0,wishBase:null,tide:{n:0,t:0},sets:{},small:0,sIncome:[],hutStyle:'thatch',pave:'gravel',statueSp:null,crates:0,v:3};
let booted=false,timeScale=1;const debugSpeed={reel:1,spawn:1,trade:1,prod:1},debugFlags={frenzy:false,allHints:false};
const tiles=new Uint8Array(GW*GH);
const builds=new Uint8Array(GW*GH);
const INLET=mouthRows(0),OUTLET=mouthRows(GW-1);
const wildH=new Float32Array(GW*GH);
for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){wildH[idx(i,j)]=.2+fbm(i*.41+3,j*.41+9,3)*.42;}
function initTiles(T=tiles){
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const c=tileC(i,j);const d=Math.abs(c.z-riverZ(c.x));T[idx(i,j)]=d<1.6?WATER:WILD;}
  // a little clearing on the north bank, mid-valley
  for(let i=WAY_I-2;i<=WAY_I+2;i++){for(let j=0;j<GH;j++){const c=tileC(i,j);const d=c.z-riverZ(c.x);if(d<0&&d>-2.8&&T[idx(i,j)]===WILD)T[idx(i,j)]=LAND;}}
}
// the Pilgrim Way comes down from the north edge to a first hut near the clearing
function initBuilds(){
  builds.fill(NONE);let end=0;
  for(let j=0;j<GH-2;j++){const k=idx(WAY_I,j);if(tiles[k]===WATER)break;tiles[k]=LAND;builds[k]=ROAD;end=j;
    if(tiles[idx(WAY_I,j+2)]===WATER||tiles[idx(WAY_I,j+1)]===WATER)break;}
  let hutI=-1;for(const di of [-1,1]){const i=WAY_I+di,k=idx(i,end);if(tiles[k]!==WATER){tiles[k]=LAND;builds[k]=HUT;hutI=i;break;}}
  // and a trading post across the road from it, with its wagon, so goods can leave the valley from the start
  for(const [di,dj] of [[WAY_I-hutI,0],[WAY_I-hutI,-1],[hutI-WAY_I,-1]]){const i=WAY_I+di,j=end+dj,k=idx(i,j);
    if(inGrid(i,j)&&tiles[k]!==WATER&&builds[k]===NONE&&nbLinkStrict(i,j)){tiles[k]=LAND;builds[k]=B.POST;break;}}
}
function nbLinkStrict(i,j){return [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>inGrid(i+a,j+b)&&(builds[idx(i+a,j+b)]===ROAD||builds[idx(i+a,j+b)]===BRIDGE));}

/* ================= renderer / scene ================= */
const canvas=document.getElementById('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
const FOG=new THREE.Color('#d9b995');
scene.fog=new THREE.Fog(FOG,210,400);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,1,900);
const AZ=Math.PI/4,EL=THREE.MathUtils.degToRad(34);
const CAM_DIR=new THREE.Vector3(Math.sin(AZ)*Math.cos(EL),Math.sin(EL),Math.cos(AZ)*Math.cos(EL));
const view={t:new THREE.Vector3(-13,9,-24),z:120};
const ZMIN=8,ZMAX=200;
let PIX=3;let rt=null;

const SUN_DIR=new THREE.Vector3(-1,.62,.2).normalize();
const sun=new THREE.DirectionalLight(new THREE.Color('#ffd2a1'),3.4);
sun.position.copy(SUN_DIR).multiplyScalar(110);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-44,right:44,top:44,bottom:-44,near:1,far:320});
sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
scene.add(sun,sun.target);
scene.add(new THREE.HemisphereLight(new THREE.Color('#a6c8d6'),new THREE.Color('#3b3122'),1.15));

const U={time:{value:0},sunView:{value:new THREE.Vector3()}};


/* rim light shared by objects: bright edge on the sun-facing silhouette */
function rimMat(params,rimColor='#ffd9a8',rimStr=.9){
  const m=new THREE.MeshStandardMaterial(Object.assign({flatShading:true,roughness:.85,metalness:0},params));
  const rc={value:new THREE.Color(rimColor)},rs={value:rimStr};
  m.onBeforeCompile=sh=>{sh.uniforms.uRimColor=rc;sh.uniforms.uRimStr=rs;sh.uniforms.uSunView=U.sunView;
    sh.fragmentShader='uniform vec3 uRimColor;uniform float uRimStr;uniform vec3 uSunView;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',RIM_FRAG);};
  return m;
}

/* ================= terrain ================= */
function tileH(i,j){i=clamp(i,0,GW-1);j=clamp(j,0,GH-1);const t=tiles[idx(i,j)];return t===WATER?BED_Y:t===LAND?LAND_Y:wildH[idx(i,j)];}
function innerH(x,z){
  const u=x+HX-.5,v=z+HZ-.5,i0=Math.floor(u),j0=Math.floor(v);
  const fu=smooth(.18,.82,u-i0),fv=smooth(.18,.82,v-j0);
  const h=lerp(lerp(tileH(i0,j0),tileH(i0+1,j0),fu),lerp(tileH(i0,j0+1),tileH(i0+1,j0+1),fu),fv);
  return h+(fbm(x*1.3,z*1.3,2)-.5)*.05;
}
function outerH(x,z){
  const dx=Math.max(0,Math.abs(x)-HX),dz=Math.max(0,Math.abs(z)-HZ),d=Math.hypot(dx,dz);
  let h=.25+(fbm(x*.12+3,z*.12-7)-.5)*.7;
  const rise=((1-Math.exp(-d*.11))*11+d*.2)*(.65+.7*fbm(x*.05,z*.05));
  h+=rise;
  // the mountain and its shoulders
  const md=Math.hypot(x+20,(z+40)*1.1);h+=40*Math.exp(-(md*md)/(2*12.5*12.5))*(.72+.55*ridged(x*.06,z*.06));
  const m2=Math.hypot(x+58,z+10);h+=19*Math.exp(-(m2*m2)/(2*10*10))*(.7+.6*ridged(x*.07+5,z*.07));
  const m3=Math.hypot(x-14,z+60);h+=24*Math.exp(-(m3*m3)/(2*13*13))*(.7+.6*ridged(x*.07+9,z*.07+2));
  const m4=Math.hypot(x+52,z+52);h+=16*Math.exp(-(m4*m4)/(2*11*11))*(.7+.6*ridged(x*.08+1,z*.08+4));
  // soft terracing gives the slopes a surveyed, topographic feel
  const tq=Math.floor(h/.9)*.9;h=lerp(h,tq+smooth(0,.9,h-tq)*.9,.35);
  // the river gorge continues beyond the valley
  const rd=Math.abs(z-riverZ(x));
  const gorge=Math.pow(smooth(15,2.2,rd),1.4);
  h=lerp(h,.35+rise*.12,gorge*.85);
  h=lerp(h,BED_Y,smooth(2.9,1.4,rd)*(d>0?1:0));
  return h;
}
function heightAt(x,z){
  const dx=Math.max(0,Math.abs(x)-HX),dz=Math.max(0,Math.abs(z)-HZ),d=Math.hypot(dx,dz);
  if(d<=0)return innerH(x,z);
  if(d<1.6)return lerp(innerH(clamp(x,-HX,HX),clamp(z,-HZ,HZ)),outerH(x,z),smooth(0,1.6,d));
  return outerH(x,z);
}
function axisArr(inner){const L=[];for(let v=-118;v<-inner-.6;v+=1.3)L.push(v);const M=[];for(let v=-inner;v<=inner+1e-6;v+=.25)M.push(+v.toFixed(3));return L.concat(M,L.map(v=>-v).reverse());}
const XS=axisArr(HX+2),ZS=axisArr(HZ+2),NX=XS.length,NZ=ZS.length;
const tGeo=new THREE.BufferGeometry();
const tPos=new Float32Array(NX*NZ*3),tCol=new Float32Array(NX*NZ*3);
{const ind=new Uint32Array((NX-1)*(NZ-1)*6);let k=0;
 for(let j=0;j<NZ-1;j++)for(let i=0;i<NX-1;i++){const a=j*NX+i,b=a+1,c=a+NX,d=c+1;
   if((i+j)%2){ind[k++]=a;ind[k++]=c;ind[k++]=b;ind[k++]=b;ind[k++]=c;ind[k++]=d;}else{ind[k++]=a;ind[k++]=c;ind[k++]=d;ind[k++]=a;ind[k++]=d;ind[k++]=b;}}
 tGeo.setIndex(new THREE.BufferAttribute(ind,1));}
tGeo.setAttribute('position',new THREE.BufferAttribute(tPos,3));
tGeo.setAttribute('color',new THREE.BufferAttribute(tCol,3));
const C=h=>new THREE.Color(h);
const PAL={bedLo:C('#2f3b2c'),bedHi:C('#8c8a62'),sand:C('#b9a676'),meadow:C('#a4b86a'),meadow2:C('#8fa75b'),wild:C('#4d7a3a'),wild2:C('#3a6331'),
  hill:C('#6f8a45'),dry:C('#9a9b5d'),rock:C('#8a8274'),rock2:C('#6a6660'),snow:C('#eef2f2'),path:C('#b8a47a')};
const tmpC=new THREE.Color(),tmpC2=new THREE.Color();
// buildings a road draws a path up to
const LINKERS=new Set([ROAD,BRIDGE,HUT,B.POST,B.MARKET,B.SHOP,B.SHRINE]);
function linkAt(i,j){if(j<0)return i===WAY_I;if(!inGrid(i,j))return false;return LINKERS.has(builds[idx(i,j)]);}
const PAVE_COL=Object.fromEntries(PAVE_IDS.map(p=>[p,C(PAVES[p].col)]));
const deposit=new Uint8Array(GW*GH); // red clay seams found in the forest
const PATCH=C('#a89468'),CLAYC=C('#a0583a'),REDC=C('#9a5a3a');
function onRoad(i,j,fx,fz){const w=.27,cx=Math.abs(fx-.5)<w,cz=Math.abs(fz-.5)<w;if(cx&&cz)return true;
  return (cx&&fz<.5&&linkAt(i,j-1))||(cx&&fz>.5&&linkAt(i,j+1))||(cz&&fx<.5&&linkAt(i-1,j))||(cz&&fx>.5&&linkAt(i+1,j));}
function wayX(z){return tileC(WAY_I,0).x+Math.sin(z*.45+1)*.9*smooth(-HZ,-HZ-4,z);}
const fract=v=>v-Math.floor(v);
function colorAt(x,z,h,ny,out){
  const n=fbm(x*.7,z*.7,2);
  const i=Math.floor(x+HX),j=Math.floor(z+HZ);const inside=inGrid(i,j);
  if(h<WATER_Y-.02){out.copy(PAL.bedHi).lerp(PAL.bedLo,smooth(-.3,-1.2,h));out.multiplyScalar(.85+n*.3);return;}
  if(h<WATER_Y+.13){out.copy(PAL.sand).multiplyScalar(.85+n*.3);return;}
  if(inside&&tiles[idx(i,j)]===LAND){out.copy(PAL.meadow).lerp(PAL.meadow2,n);
    const fx=x+HX-i,fz=z+HZ-j;if(Math.min(fx,fz,1-fx,1-fz)<.04)out.multiplyScalar(.86);
    const k=idx(i,j),b=builds[k];
    if(deposit[k])out.lerp(REDC,.45);
    if(b===ROAD&&onRoad(i,j,fx,fz)){const pv=S.meta[k]?.pave||'dirt';out.copy(PAVE_COL[pv]||PAL.path);
      if(pv==='cobble'){const cx=Math.floor(fx*7+(Math.floor(fz*7)%2)*.5),cz=Math.floor(fz*7);out.multiplyScalar(.82+hash2(cx+i*9,cz+j*9)*.3);if(fract(fx*7+(Math.floor(fz*7)%2)*.5)<.14||fract(fz*7)<.14)out.multiplyScalar(.7);}
      else if(pv==='plank'){out.multiplyScalar(.85+hash2(Math.floor(fz*6)+j*7,i)*.25);if(fract(fz*6)<.12)out.multiplyScalar(.62);}
      else if(pv==='gravel')out.multiplyScalar(.82+hash2(Math.floor(fx*14)+i*31,Math.floor(fz*14)+j*17)*.3);
      else out.multiplyScalar(.9+n*.2);}
    else if(b===HUT&&Math.max(Math.abs(fx-.5),Math.abs(fz-.5))<.4)out.lerp(PAL.path,.55);
    else if(b===B.CLAY&&Math.max(Math.abs(fx-.5),Math.abs(fz-.5))<.42)out.lerp(CLAYC,.8);
    else if((b===B.POST||b===B.MARKET||b===B.SHOP||b===B.WOOD||b===B.NETS||b===B.RACK||b===B.SHRINE||b===B.STONES||b===B.STATUE)&&Math.max(Math.abs(fx-.5),Math.abs(fz-.5))<.42)out.lerp(PATCH,.6);
    return;}
  if(inside&&deposit[idx(i,j)]&&tiles[idx(i,j)]===WILD&&h>WATER_Y+.13){out.copy(PAL.wild).lerp(REDC,.55);out.multiplyScalar(.9+n*.2);return;}
  // the Pilgrim Way continues north out of the valley
  if(!inside&&z<-HZ&&z>-HZ-14&&Math.abs(x-wayX(z))<.3&&h<6){out.copy(PAL.path).multiplyScalar(.85+n*.2);return;}
  if(inside||h<1.2){out.copy(PAL.wild).lerp(PAL.wild2,smooth(.3,.7,n));out.multiplyScalar(.9+n*.2);}
  else{out.copy(PAL.hill).lerp(PAL.dry,smooth(3,12,h+n*3));}
  const strata=.86+.14*Math.sin(h*4.2+fbm(x*.3,z*.3,2)*3);
  if(ny<.8)out.lerp(tmpC2.copy(PAL.rock).multiplyScalar(strata),smooth(.8,.66,ny));
  if(ny<.6)out.lerp(tmpC2.copy(PAL.rock2).multiplyScalar(strata),smooth(.6,.45,ny));
  if(h>21+n*5&&ny>.5)out.lerp(PAL.snow,smooth(21,25,h+n*5));
}
function buildTerrain(fineOnly){
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const x=XS[i],z=ZS[j];
    if(fineOnly&&(Math.abs(x)>HX+2.01||Math.abs(z)>HZ+2.01))continue;
    const k=(j*NX+i)*3;tPos[k]=x;tPos[k+1]=heightAt(x,z);tPos[k+2]=z;}
  tGeo.attributes.position.needsUpdate=true;tGeo.computeVertexNormals();
  const nrm=tGeo.attributes.normal.array;
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const x=XS[i],z=ZS[j];
    if(fineOnly&&(Math.abs(x)>HX+2.3||Math.abs(z)>HZ+2.3))continue;
    const k=(j*NX+i)*3;colorAt(x,z,tPos[k+1],nrm[k+1],tmpC);tCol[k]=tmpC.r;tCol[k+1]=tmpC.g;tCol[k+2]=tmpC.b;}
  tGeo.attributes.color.needsUpdate=true;
  tGeo.computeBoundingSphere();
}
/* current, as a texture the water and riverbed shaders read: rg = direction, b = speed, a = 1 flowing / 0 still / .5 land */
const FLOW=makeFlow();
const flowData=new Uint8Array(GW*GH*4);
const flowTex=new THREE.DataTexture(flowData,GW,GH,THREE.RGBAFormat);
flowTex.magFilter=flowTex.minFilter=THREE.LinearFilter;flowTex.wrapS=flowTex.wrapT=THREE.ClampToEdgeWrapping;
const FLOW_GLSL=`uniform sampler2D uFlow;
vec4 flowAt(vec2 p){vec2 uv=(p+vec2(${HX.toFixed(1)},${HZ.toFixed(1)}))/vec2(${GW.toFixed(1)},${GH.toFixed(1)});
  vec4 f=texture2D(uFlow,clamp(uv,vec2(0.5/${GW.toFixed(1)},0.5/${GH.toFixed(1)}),vec2(1.0-0.5/${GW.toFixed(1)},1.0-0.5/${GH.toFixed(1)})));
  float out_=step(0.001,max(max(-uv.x,uv.x-1.0),max(-uv.y,uv.y-1.0)));
  return mix(f,vec4(0.75,0.5,0.25,1.0),out_);}
`;
function updateFlowTex(){
  for(let k=0;k<GW*GH;k++){const w=tiles[k]===WATER;const vx=FLOW.vx[k],vz=FLOW.vz[k];
    flowData[k*4]=Math.round(clamp(vx/2*.5+.5,0,1)*255);flowData[k*4+1]=Math.round(clamp(vz/2*.5+.5,0,1)*255);
    flowData[k*4+2]=Math.round(clamp(FLOW.speed[k]/2,0,1)*255);flowData[k*4+3]=!w?128:FLOW.live[k]?255:0;}
  flowTex.needsUpdate=true;
}
const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95,metalness:0});
terrainMat.onBeforeCompile=sh=>{
  sh.uniforms.uTime=U.time;sh.uniforms.uWaterY={value:WATER_Y};sh.uniforms.uFlow={value:flowTex};
  sh.vertexShader='varying vec3 vWPos;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n vWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='varying vec3 vWPos;\nuniform float uTime;\nuniform float uWaterY;\n'+NOISE_GLSL+FLOW_GLSL+sh.fragmentShader
   .replace('#include <color_fragment>',`#include <color_fragment>
    float depthW=uWaterY-vWPos.y;
    float cloud=clouds(vWPos.xz,uTime);
    diffuseColor.rgb*=1.0-cloud*0.34;
    float stillB=0.0;
    if(depthW>0.0){stillB=1.0-smoothstep(0.1,0.4,flowAt(vWPos.xz).a);
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(0.012,0.085,0.075),vec3(0.05,0.075,0.02),stillB),clamp(depthW*0.55,0.0,0.82));}
    float ch=vWPos.y/0.75; float fw=max(fwidth(ch),1e-4); float cd=abs(fract(ch+0.5)-0.5);
    float cl=1.0-smoothstep(fw*0.6,fw*1.7,cd);
    float major=1.0-step(0.5,abs(mod(floor(ch+0.5),5.0)));
    diffuseColor.rgb*=1.0-cl*smoothstep(0.5,2.0,vWPos.y)*(0.09+0.16*major);`)
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    if(depthW>0.0){float cz=caustic(vWPos.xz*0.085,uTime*0.3);totalEmissiveRadiance+=vec3(0.45,1.0,0.8)*cz*0.55*exp(-depthW*0.6)*(1.0-cloud*0.8)*(1.0-stillB*0.85);}
    float shore=1.0-smoothstep(0.0,0.05,abs(vWPos.y-uWaterY-0.02));
    totalEmissiveRadiance+=vec3(1.0,0.84,0.6)*shore*0.6*(1.0-cloud*0.6);`);
};
const terrain=new THREE.Mesh(tGeo,terrainMat);terrain.receiveShadow=true;terrain.castShadow=true;scene.add(terrain);

/* ================= water surface ================= */
const HEATN=6;
const heatU=Array.from({length:HEATN},()=>new THREE.Vector4(0,0,1,0)); // x,z,radius,strength: warm water around the Ember Showa
const waterMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
  uniforms:{uTime:U.time,uSun:{value:SUN_DIR},uView:{value:CAM_DIR},uFog:{value:FOG},uFogNear:{value:210},uFogFar:{value:400},uFlow:{value:flowTex},uHeat:{value:heatU}},
  vertexShader:`varying vec3 vW;varying float vFogD;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vec4 mv=viewMatrix*w;vFogD=-mv.z;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float uTime;uniform vec3 uSun;uniform vec3 uView;uniform vec3 uFog;uniform float uFogNear;uniform float uFogFar;uniform vec4 uHeat[${HEATN}];varying vec3 vW;varying float vFogD;
  ${NOISE_GLSL}
  ${FLOW_GLSL}
  float wh(vec2 p,float drift){return vns(p*0.8+uTime*vec2(0.10,0.06)*drift)*0.55+vns(p*2.1-uTime*vec2(0.08,0.13)*drift)*0.3+vns(p*5.3+uTime*vec2(0.2,-0.1)*drift)*0.15;}
  // flow-map advection: two phases half a cycle apart, cross-faded so the pattern never stretches too far
  float fh(vec2 p,vec2 v,float drift){
    float T=uTime*0.22;float a=fract(T),b=fract(T+0.5);float wb=abs(a-0.5)*2.0;
    return mix(wh(p-v*a*2.2,drift),wh(p-v*b*2.2+vec2(3.7,1.3),drift),1.0-wb);}
  void main(){
    vec2 p=vW.xz;float e=0.08;
    vec4 fl=flowAt(p);
    float live=smoothstep(0.1,0.4,fl.a);float still=1.0-live;
    vec2 v=(fl.rg*2.0-1.0)*2.0*live;float spd=length(v);
    float drift=mix(0.35,1.0,live);
    float h0=fh(p,v,drift);float hx=fh(p+vec2(e,0.0),v,drift);float hz=fh(p+vec2(0.0,e),v,drift);
    vec3 N=normalize(vec3((h0-hx)*mix(0.5,1.6,live),1.0,(h0-hz)*mix(0.5,1.6,live)));
    float fres=pow(1.0-clamp(dot(N,uView),0.0,1.0),2.5);
    float spec=pow(max(dot(reflect(-uSun,N),uView),0.0),mix(160.0,70.0,live));
    float cloud=clouds(p,uTime);
    float band=vns(p*0.05+vec2(uTime*0.004,0.0))*2.0;
    float shaft=smoothstep(0.62,1.0,sin(dot(p,normalize(vec2(1.0,0.45)))*0.2+band+uTime*0.02))*(1.0-cloud);
    vec3 col=vec3(0.02,0.13,0.12);
    col+=vec3(0.5,0.72,0.78)*fres*0.45;
    col+=vec3(0.45,0.95,0.78)*shaft*0.22*live;
    // streaks drawn along the current
    vec2 dir=spd>1e-3?v/spd:vec2(1.0,0.0);vec2 q=vec2(dot(p,dir),dot(p,vec2(-dir.y,dir.x)));
    float str=smoothstep(0.72,0.9,vns(vec2(q.x*0.7-uTime*(0.5+spd*0.9),q.y*4.5)))*smoothstep(0.15,0.6,spd);
    col+=vec3(0.8,0.95,0.9)*str*0.16*(1.0-cloud*0.5);
    // still water goes murky and green, with specks of duckweed
    vec3 murk=vec3(0.05,0.09,0.03)+vec3(0.1,0.13,0.04)*vns(p*1.7);
    float weed=step(0.8,vns(p*7.0+vec2(0.0,uTime*0.01)))*0.6;
    col=mix(col,murk+vec3(0.14,0.2,0.06)*weed,still*0.85);
    col+=vec3(1.0,0.82,0.58)*spec*3.0*(1.0-cloud*0.8);
    // warmth
    float heat=0.0;for(int i=0;i<${HEATN};i++){vec4 H=uHeat[i];float d=length(p-H.xy)/H.z;heat+=H.w*exp(-d*d*2.2);}
    heat=min(heat,1.2);
    float shim=vns(p*3.0+vec2(0.0,uTime*1.4));
    col+=vec3(1.0,0.42,0.14)*heat*(0.22+0.2*shim);
    col*=1.0-cloud*0.25;
    float a=clamp(0.2+fres*0.35+shaft*0.1*live+spec*0.6+still*0.42+str*0.1+heat*0.12,0.0,0.94);
    float f=smoothstep(uFogNear,uFogFar,vFogD);col=mix(col,uFog,f);a=mix(a,1.0,f);
    gl_FragColor=vec4(col,a);
  }`
});
const water=new THREE.Mesh(new THREE.PlaneGeometry(250,250).rotateX(-Math.PI/2),waterMat);
water.position.y=WATER_Y;water.renderOrder=2;scene.add(water);

/* ================= trees & rocks ================= */
const coneG=new THREE.ConeGeometry(.17,.5,6).translate(0,.42,0);
const trunkG=new THREE.CylinderGeometry(.025,.035,.2,4).translate(0,.1,0);
const MAXT=12000;
const foliage=new THREE.InstancedMesh(coneG,rimMat({color:'#ffffff'},'#ffc98a',.7),MAXT);
const trunks=new THREE.InstancedMesh(trunkG,rimMat({color:'#5a4330'},'#ffc98a',.3),MAXT);
foliage.castShadow=trunks.castShadow=true;foliage.receiveShadow=true;
scene.add(foliage,trunks);
const trees=[];// {x,z,s,tile,col}
const treeCols=['#2f5a2b','#3c6b30','#27502a','#4a7a36','#6d7f33','#8a7a2e'].map(C);
function addTree(x,z,s,tile){trees.push({x,z,s,tile,col:treeCols[Math.random()<.9?Math.floor(Math.random()*4):4+Math.floor(Math.random()*2)],r:Math.random()*6});}
for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const c=tileC(i,j);const n=2+Math.floor(hash2(i*3.1,j*7.7)*3);
  for(let k=0;k<n;k++)addTree(c.x+rand(-.38,.38),c.z+rand(-.38,.38),rand(.9,1.5),idx(i,j));}
function scatterOuter(){let tries=0;
  while(trees.length<MAXT-40&&tries<90000){tries++;const x=rand(-100,100),z=rand(-100,72);
    if(Math.abs(x)<HX+.8&&Math.abs(z)<HZ+.8)continue;
    if(z<-HZ&&z>-HZ-15&&Math.abs(x-wayX(z))<.7)continue;
    if(Math.abs(z-riverZ(x))<3.2&&Math.abs(x)>HX)continue;
    const h=heightAt(x,z);if(h<.3||h>15)continue;
    const e=.4,nx=heightAt(x+e,z)-heightAt(x-e,z),nz=heightAt(x,z+e)-heightAt(x,z-e);if(Math.hypot(nx,nz)>.9)continue;
    if(fbm(x*.09+11,z*.09-3,3)<.46)continue;
    addTree(x,z,rand(1.1,2.1)*(1-h/30),-1);}
}
const m4=new THREE.Matrix4(),q4=new THREE.Quaternion(),s4=new THREE.Vector3(),p4=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0);
function updateTrees(){
  trees.forEach((t,k)=>{const show=t.tile<0||tiles[t.tile]===WILD;
    p4.set(t.x,heightAt(t.x,t.z)-.03,t.z);q4.setFromAxisAngle(yAxis,t.r);s4.setScalar(show?t.s:0);
    m4.compose(p4,q4,s4);foliage.setMatrixAt(k,m4);trunks.setMatrixAt(k,m4);foliage.setColorAt(k,t.col);});
  foliage.count=trunks.count=trees.length;
  foliage.instanceMatrix.needsUpdate=trunks.instanceMatrix.needsUpdate=true;if(foliage.instanceColor)foliage.instanceColor.needsUpdate=true;
}
const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),rimMat({color:'#8a8176'},'#ffd6a0',.6),420);
rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks);
{let n=0,tries=0;while(n<420&&tries<30000){tries++;const x=rand(-100,100),z=rand(-100,70);if(Math.abs(x)<HX+1&&Math.abs(z)<HZ+1)continue;
  const h=heightAt(x,z);if(h<.5)continue;const s=rand(.12,.5)*(h>8?1.8:1);
  p4.set(x,h-s*.45,z);q4.setFromEuler(new THREE.Euler(rand(0,3),rand(0,3),rand(0,3)));s4.set(s,s*rand(.5,.9),s*rand(.7,1.1));
  m4.compose(p4,q4,s4);rocks.setMatrixAt(n++,m4);}rocks.count=n;}

/* ================= water analysis ================= */
const D=new Int16Array(GW*GH),COMP=new Int32Array(GW*GH);let comps=[];
// live = water the current runs through. Still water counts as bank for the fish: they will not go there.
const isLive=k=>tiles[k]===WATER&&FLOW.live[k]===1;
let stillCount=0;
function analyzeWater(){
  solveFlow(FLOW,tiles,INLET,OUTLET);updateFlowTex();
  stillCount=0;for(let k=0;k<GW*GH;k++)if(tiles[k]===WATER&&!FLOW.live[k])stillCount++;
  D.fill(-1);const q=[];
  for(let k=0;k<GW*GH;k++)if(!isLive(k)){D[k]=0;q.push(k);}
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=idx(i,j);if(isLive(k)&&(j===0||j===GH-1)&&D[k]<0){D[k]=1;q.push(k);}}
  for(let h=0;h<q.length;h++){const k=q[h],i=k%GW,j=(k/GW)|0;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ni=i+di,nj=j+dj;if(!inGrid(ni,nj))continue;const nk=idx(ni,nj);if(D[nk]<0){D[nk]=D[k]+1;q.push(nk);}}}
  COMP.fill(-1);comps=[];
  for(let k=0;k<GW*GH;k++){if(!isLive(k)||COMP[k]>=0)continue;
    const c={id:comps.length,size:0,maxD:0,tiles:[]};const st=[k];COMP[k]=c.id;
    while(st.length){const t=st.pop();c.size++;c.tiles.push(t);c.maxD=Math.max(c.maxD,D[t]);const i=t%GW,j=(t/GW)|0;
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj;if(!inGrid(ni,nj))continue;const nk=idx(ni,nj);if(isLive(nk)&&COMP[nk]<0){COMP[nk]=c.id;st.push(nk);}}}
    comps.push(c);}
}
function dAt(x,z){const i=Math.floor(x+HX),j=Math.floor(z+HZ);return inGrid(i,j)?Math.max(0,D[idx(i,j)]):0;}
function compAt(x,z){const i=Math.floor(x+HX),j=Math.floor(z+HZ);return inGrid(i,j)?COMP[idx(i,j)]:-1;}
const nb4=(i,j,type)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>inGrid(i+a,j+b)&&tiles[idx(i+a,j+b)]===type);
const nb8=(i,j,type)=>{for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){if(!a&&!b)continue;if(inGrid(i+a,j+b)&&tiles[idx(i+a,j+b)]===type)return true;}return false;};

/* ================= fish ================= */
function mixHex(a,b,t){const A=new THREE.Color(a),B=new THREE.Color(b);return '#'+A.lerp(B,t).getHexString();}
function fishCanvases(sp){
  const W=64,H=32;const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const e=document.createElement('canvas');e.width=W;e.height=H;const ge=e.getContext('2d');ge.fillStyle='#000';ge.fillRect(0,0,W,H);
  const px=(ctx,x,y,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.floor(x),Math.floor(((y%H)+H)%H),1,1);};
  const band=(top,belly)=>{for(let y=0;y<H;y++){const d=Math.abs(y-8);const dd=Math.min(d,H-d)/16;g.fillStyle=mixHex(top,belly,smooth(.25,.9,dd));g.fillRect(0,y,W,1);}};
  const blob=(cx,cy,rx,ry,col,ctx=g)=>{for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
    const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<1-hash2(x*1.7,y*2.3)*.35&&x>=1&&x<60)px(ctx,x,y,col);}};
  const R=Math.random;
  switch(sp.pattern){
    case 'reed':band('#4a5a3a','#d2d8c2');for(let x=4;x<60;x++){px(g,x,1,'#39452e');px(g,x,15,'#39452e');if(x%3===0)px(g,x,8,'#3e4a31');}break;
    case 'kohaku':band('#f3eee4','#fbf8f1');for(let n=0,N=3+Math.floor(R()*3);n<N;n++)blob(8+R()*42,8+(R()-.5)*4,4+R()*7,3+R()*3.5,'#c9331d');if(R()<.4)blob(5,8,3,2.5,'#c9331d');break;
    case 'bronze':band('#6e4a22','#d9bb82');for(let y=0;y<H;y++)for(let x=2;x<60;x++){if((x+(y%2)*2)%4===0&&Math.abs(y-8)<10)px(g,x,y,'rgba(40,22,8,.35)');}break;
    case 'showa':band('#1c1a1b','#e9e2d6');for(let n=0;n<5;n++)blob(6+R()*46,8+(R()-.5)*6,3+R()*6,2+R()*3.5,'#c8361f');for(let n=0;n<2;n++)blob(10+R()*40,8+(R()-.5)*8,3+R()*4,2+R()*2,'#efe9df');
      // live coals: a few glowing specks along the back and flanks
      for(let n=0;n<26;n++){const x=5+R()*52,y=8+(R()-.5)*12;px(g,x,y,'#ff9a4a');px(ge,x,y,R()<.5?'#ff7a2a':'#ffb45a');}break;
    case 'moss':band('#303c2c','#a4a488');for(let n=0;n<140;n++)px(g,3+R()*56,8+(R()-.5)*14,R()<.5?'#6f8f45':'#8aa653');
      for(let x=6;x<58;x+=5){px(g,x,8,'#d9cfaa');px(g,x+1,8,'#d9cfaa');px(g,x+2,3,'#bfb593');px(g,x+2,13,'#bfb593');}break;
    case 'lantern':band('#131732','#3a3e66');for(let x=5;x<60;x+=4){for(const y of [3,13,21,27]){px(g,x,y,'#bff7ff');px(ge,x,y,'#8ff0ff');}}px(ge,4,8,'#8ff0ff');break;
    case 'moon':band('#dfe6f0','#f7f9fc');for(let y=0;y<H;y+=2)for(let x=4+(y%4?1:0);x<60;x+=3)px(g,x,y,'#b2c0d6');
      for(let x=6;x<58;x+=2)if(R()<.5)px(ge,x,8+(R()-.5)*8,'#6f86b8');for(let n=0;n<10;n++)px(ge,6+R()*50,8+(R()-.5)*10,'#dbe6ff');break;
    case 'warden':{band('#0c2424','#6d8c82');let lx=6,ly=8;for(let n=0;n<16;n++){const nx=clamp(lx+3+R()*5,4,58),ny=clamp(ly+(R()-.5)*8,1,15);
        const st=Math.max(Math.abs(nx-lx),Math.abs(ny-ly));for(let s=0;s<=st;s++){const x=lerp(lx,nx,s/st),y=lerp(ly,ny,s/st);px(g,x,y,'#8a6a33');px(ge,x,y,'#6b4d1a');}
        px(g,nx,ny,'#ffd27a');px(ge,nx,ny,'#ffd27a');lx=nx;ly=ny;if(lx>55){lx=6;ly=8+(R()-.5)*8;}}
      for(let x=4;x<60;x+=3){px(g,x,20,'#8fb0a2');px(g,x,28,'#8fb0a2');}break;}
  }
  const eye=sp.pattern==='warden'?'#ffd27a':'#141414';
  px(g,3,4,eye);px(g,3,12,eye);if(sp.glow){const ec=sp.pattern==='warden'?'#ffd27a':sp.pattern==='showa'?'#ff7a2a':'#556';px(ge,3,4,ec);px(ge,3,12,ec);}
  g.fillStyle=sp.fin;g.fillRect(62,0,2,H);
  return {c,e};
}
function profile(sp,t){
  if(sp.eel)return (.45+.55*Math.sin(Math.PI*Math.min(1,t*4)*.5))*(1-.75*t);
  return .1+.9*Math.pow(Math.sin(Math.PI*Math.pow(t,.55)*.93),.9);
}
function fishGeometry(sp){
  const L=sp.len,W=L*sp.wid,Hh=L*sp.hgt,N=22,M=10;const pos=[],uv=[],ind=[];
  for(let s=0;s<=N;s++){const t=s/N,z=L/2-t*L,r=profile(sp,t);
    for(let k=0;k<=M;k++){const th=k/M*Math.PI*2;let y=Math.sin(th)*Hh/2*r;if(y<0)y*=.7;pos.push(Math.cos(th)*W/2*r,y,z);uv.push(t,k/M);}}
  for(let s=0;s<N;s++)for(let k=0;k<M;k++){const a=s*(M+1)+k,b=a+1,c=a+M+1,d=c+1;ind.push(a,c,b,b,c,d);}
  const add=(x,y,z)=>{pos.push(x,y,z);uv.push(.985,.5);return pos.length/3-1;};
  const tri=(a,b,c)=>{ind.push(add(...a),add(...b),add(...c));};
  // nose + tail caps
  const nose=add(0,0,L/2+L*.012);for(let k=0;k<M;k++)ind.push(nose,k,k+1);
  // tail fin (spread flat so it reads from above)
  const tz=-L/2,T=L*sp.tail;
  if(sp.eel){tri([0,.02,tz+L*.25],[W*.25,0,tz-T],[-W*.25,0,tz-T]);}
  else{tri([0,0,tz+L*.03],[T*.62,Hh*.05,tz-T],[0,0,tz-T*.45]);tri([0,0,tz+L*.03],[0,0,tz-T*.45],[-T*.62,Hh*.05,tz-T]);}
  // pectoral + pelvic fins
  if(sp.fins>0){for(const side of [1,-1]){
      const t1=.2,z1=L/2-t1*L,r1=profile(sp,t1)*W/2,f=L*sp.fins*.26;
      tri([side*r1*.8,-Hh*.12,z1],[side*(r1+f),-Hh*.2,z1-f*.55],[side*(r1*.6+f*.55),-Hh*.2,z1-f*1.05]);
      tri([side*r1*.8,-Hh*.12,z1],[side*(r1*.6+f*.55),-Hh*.2,z1-f*1.05],[side*r1*.7,-Hh*.12,z1-f*.7]);
      const t2=.55,z2=L/2-t2*L,r2=profile(sp,t2)*W/2,f2=f*.5;
      tri([side*r2*.8,-Hh*.15,z2],[side*(r2+f2),-Hh*.2,z2-f2*.8],[side*r2*.7,-Hh*.15,z2-f2*1.1]);}}
  // dorsal ridge
  const d0=sp.eel?.1:.3,d1=sp.eel?.92:.62,dh=Hh*(sp.eel?.5:.42);
  for(let s=0;s<6;s++){const ta=lerp(d0,d1,s/6),tb=lerp(d0,d1,(s+1)/6);const za=L/2-ta*L,zb=L/2-tb*L;
    const ha=Hh/2*profile(sp,ta)*.95,hb=Hh/2*profile(sp,tb)*.95;const env=Math.sin(Math.PI*(s+.5)/6);
    tri([0,ha,za],[0,hb,zb],[0,hb+dh*env,zb+L*.03]);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();return geo;
}
const fishGeoCache={};
function makeFishMesh(sp){
  const geo=fishGeoCache[sp.id]||(fishGeoCache[sp.id]=fishGeometry(sp));
  const cv=fishCanvases(sp);const tex=new THREE.CanvasTexture(cv.c);
  for(const t of [tex]){t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;}
  const u={uPhase:{value:Math.random()*6},uAmp:{value:sp.eel?.05:.035},uLen:{value:sp.len},uHead:{value:sp.len/2},uCurve:{value:0},uEel:{value:sp.eel?1:0},uWaves:{value:sp.eel?1.6:.8}};
  const mp={map:tex,side:THREE.DoubleSide,roughness:.55,flatShading:true};
  if(sp.glow){const et=new THREE.CanvasTexture(cv.e);et.magFilter=et.minFilter=THREE.NearestFilter;et.generateMipmaps=false;et.flipY=false;et.colorSpace=THREE.SRGBColorSpace;
    Object.assign(mp,{emissiveMap:et,emissive:new THREE.Color('#ffffff'),emissiveIntensity:2.2});}
  const mat=new THREE.MeshStandardMaterial(mp);
  const rc={value:new THREE.Color(sp.glow||'#ffe2b8')},rs={value:sp.glow?1.4:1.0};
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u,{uRimColor:rc,uRimStr:rs,uSunView:U.sunView});
    sh.vertexShader=BEND_DECL+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+BEND_VERT);
    sh.fragmentShader='uniform vec3 uRimColor;uniform float uRimStr;uniform vec3 uSunView;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',RIM_FRAG);};
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  depth.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);sh.vertexShader=BEND_DECL+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+BEND_VERT);};
  const mesh=new THREE.Mesh(geo,mat);mesh.customDepthMaterial=depth;mesh.castShadow=true;
  return {mesh,mat,u,canvas:cv.c,rim:rs};
}
const fishes=[];
function swimY(sp){return -.6-Math.min(.42,sp.len*.03);}
function randomTileIn(comp,needD){const ok=comp.tiles.filter(k=>D[k]>=needD);const arr=ok.length?ok:comp.tiles;const k=arr[Math.floor(Math.random()*arr.length)];const c=tileC(k%GW,(k/GW)|0);return {x:c.x+rand(-.3,.3),z:c.z+rand(-.3,.3)};}
function spawnFish(sp,comp,{emerge=true}={}){
  const f=makeFishMesh(sp);const p=randomTileIn(comp,sp.needD);
  const fish={sp,...f,x:p.x,z:p.z,h:Math.random()*6.28,turn:0,speed:sp.speed*.35*Math.sqrt(sp.len),state:'swim',y:emerge?-3.4-sp.len*.08:swimY(sp),
    emerge:emerge?0:1,life:rand(240,520)*(sp.awe?1.4:1),age:0,tgt:null,hookers:[],progress:0,nextHint:0,out:0,id:Math.random()};
  fish.mesh.position.set(fish.x,fish.y,fish.z);scene.add(fish.mesh);fishes.push(fish);pickTarget(fish);
  return fish;
}
function pickTarget(f){
  const cid=compAt(f.x,f.z);const comp=comps[cid];if(!comp){f.tgt={x:f.x,z:f.z};return;}
  // fish are curious about bait: often wander toward the banks where fishers wait
  const near=fishersState.filter(fs=>fs.state==='idle'&&compAt(fs.bob.x,fs.bob.z)===cid);
  if(near.length&&Math.random()<.45){const fs=near[Math.floor(Math.random()*near.length)];f.tgt={x:fs.bob.x+rand(-1,1),z:fs.bob.z+rand(-1,1)};return;}
  f.tgt=randomTileIn(comp,f.sp.needD);
}
function angDiff(a,b){let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}
function updateFish(f,dt){
  const sp=f.sp;f.age+=dt;
  if(f.emerge<1){f.emerge=Math.min(1,f.emerge+dt/9);}
  const targetY=swimY(sp);
  if(f.state==='swim'||f.state==='hooked'){
    const base=sp.speed*.35*Math.sqrt(sp.len);
    let want=f.state==='hooked'?base*.12:base*(0.8+0.2*Math.sin(f.age*.3+f.id*10));
    if(f.state==='swim'){
      if(!f.tgt||Math.hypot(f.tgt.x-f.x,f.tgt.z-f.z)<Math.max(1.2,sp.len*.35))pickTarget(f);
      const desired=Math.atan2(f.tgt.x-f.x,f.tgt.z-f.z);
      let steer=angDiff(desired,f.h);
      const la=sp.len*.5+.9,need=sp.needD;
      const sample=a=>dAt(f.x+Math.sin(a)*la,f.z+Math.cos(a)*la);
      const dC=sample(f.h),dL=sample(f.h-.6),dR=sample(f.h+.6);
      if(dC<need)steer+=(dR>=dL?1:-1)*2.2;
      if(dAt(f.x,f.z)<1){let best=f.h,bd=-1;for(let a=0;a<8;a++){const an=a/8*Math.PI*2,d=dAt(f.x+Math.sin(an)*1.2,f.z+Math.cos(an)*1.2);if(d>bd){bd=d;best=an;}}steer=angDiff(best,f.h)*3;}
      const maxTurn=.55/Math.sqrt(sp.len)+.12;
      const tr=clamp(steer,-1,1)*maxTurn;f.turn=lerp(f.turn,tr,1-Math.exp(-dt*2));
      want*=1-Math.min(.6,Math.abs(steer)*.25);
    }else{f.turn=Math.sin(f.age*2.3)*.25;}
    f.speed=lerp(f.speed,want,1-Math.exp(-dt*.8));
    f.h+=f.turn*dt;
    const nx=f.x+Math.sin(f.h)*f.speed*dt,nz=f.z+Math.cos(f.h)*f.speed*dt;
    if(dAt(nx,nz)>0||dAt(f.x,f.z)===0){f.x=nx;f.z=nz;}else{f.h+=Math.PI*dt;}
    f.y=lerp(-3.4-sp.len*.08,targetY,easeInOut(f.emerge));
    if(f.state==='swim'&&f.age>f.life&&!cine.fish){f.state='leave';f.out=0;}
    f.u.uAmp.value=lerp(f.u.uAmp.value,f.state==='hooked'?.09:(sp.eel?.05:.035),dt);
    f.u.uPhase.value+=dt*(f.state==='hooked'?7:(1.2+f.speed*3/Math.sqrt(sp.len)));
    f.u.uCurve.value=clamp(f.turn/Math.max(f.speed,.15),-.5,.5)/sp.len*.9;
  }else if(f.state==='leave'){
    f.out+=dt/10;f.y=lerp(targetY,-3.6-sp.len*.08,easeInOut(Math.min(1,f.out)));
    f.x+=Math.sin(f.h)*f.speed*dt*.6;f.z+=Math.cos(f.h)*f.speed*dt*.6;f.u.uPhase.value+=dt*1.2;
    if(f.out>=1)removeFish(f);
  }else if(f.state==='held'){
    // brought up beside the crew, just under the surface, for a moment
    f.out+=dt/3.4;const k=Math.min(1,f.out);
    f.y=lerp(f.y,WATER_Y-.1-sp.hgt*sp.len*.25,1-Math.exp(-dt*2));
    f.u.uPhase.value+=dt*1.6;f.u.uAmp.value=lerp(f.u.uAmp.value,.025,dt*2);f.u.uCurve.value*=1-dt;
    if(Math.random()<dt*10)sparkle(f.x+rand(-.4,.4)*sp.len*.5*Math.abs(Math.sin(f.h)),WATER_Y+.05,f.z+rand(-.4,.4)*sp.len*.5*Math.abs(Math.cos(f.h)),sp.glow||'#fff3d6');
    if(k>=1){f.state='release';f.out=0;f.speed=0;}
  }else if(f.state==='release'){
    // turned loose: it heads back out to open water and sinks out of sight
    f.out+=dt/8;const k=Math.min(1,f.out);
    f.h+=angDiff(f.relH,f.h)*Math.min(1,dt*1.2);
    f.speed=lerp(f.speed,sp.speed*.35*Math.sqrt(sp.len)*1.1,1-Math.exp(-dt*.7));
    const nx=f.x+Math.sin(f.h)*f.speed*dt,nz=f.z+Math.cos(f.h)*f.speed*dt;
    if(dAt(nx,nz)>0){f.x=nx;f.z=nz;}else f.relH+=dt*1.5;
    f.y=lerp(WATER_Y-.1,-3.4-sp.len*.08,easeInOut(k));
    f.u.uPhase.value+=dt*(1.4+f.speed*3/Math.sqrt(sp.len));f.u.uAmp.value=lerp(f.u.uAmp.value,sp.eel?.05:.035,dt);
    if(k>.6){if(!f.mat.transparent){f.mat.transparent=true;f.mat.needsUpdate=true;}f.mat.opacity=1-(k-.6)/.4;}
    if(k>=1)removeFish(f);
  }
  f.mesh.position.set(f.x,f.y,f.z);f.mesh.rotation.y=f.h;
  if(sp.glow)f.mat.emissiveIntensity=1.6+Math.sin(f.age*1.7)*.8;
}
function removeFish(f){scene.remove(f.mesh);f.mat.map.dispose();if(f.mat.emissiveMap)f.mat.emissiveMap.dispose();f.mat.dispose();const i=fishes.indexOf(f);if(i>=0)fishes.splice(i,1);}
const easeInOut=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function fishHead(f){const r=f.sp.len*.46;return {x:f.x+Math.sin(f.h)*r,z:f.z+Math.cos(f.h)*r};}
function distToFish(f,x,z){const r=f.sp.len*.5;const ax=f.x-Math.sin(f.h)*r,az=f.z-Math.cos(f.h)*r,bx=f.x+Math.sin(f.h)*r,bz=f.z+Math.cos(f.h)*r;
  const vx=bx-ax,vz=bz-az;const t=clamp(((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz),0,1);return Math.hypot(x-(ax+vx*t),z-(az+vz*t));}

/* ================= fishers ================= */
const fishersState=[];
const coatCols=['#b5523b','#3e6d8a','#c29a3a','#6b7d3a','#8a4f7a','#d7cfbf','#44504f'];
const bodyG=new THREE.CylinderGeometry(.045,.06,.16,5).translate(0,.08,0);
const headG=new THREE.IcosahedronGeometry(.042,0).translate(0,.2,0);
const hatG=new THREE.ConeGeometry(.095,.05,7).translate(0,.25,0);
const rodG=new THREE.CylinderGeometry(.004,.007,.55,3).translate(0,.275,0);
const bobG=new THREE.IcosahedronGeometry(.028,0);
const skinM=rimMat({color:'#e2b58c'},'#ffd9a8',.8),hatM=rimMat({color:'#d8bd78'},'#ffe3b0',1),rodM=rimMat({color:'#3b2a1c'}),bobM=rimMat({color:'#e8432f',emissive:new THREE.Color('#5a0d05')},'#ffd9a8',.6);
const lineM=new THREE.LineBasicMaterial({color:new THREE.Color('#eaf3ee'),transparent:true,opacity:.75,fog:false});
const coatMs=coatCols.map(c=>rimMat({color:c},'#ffd9a8',1));
const ROD_ANG=1.0;
function slotPos(i,j,slot){
  const c=tileC(i,j);let vx=0,vz=0;
  if(builds[idx(i,j)]===BRIDGE){// along the deck, alternating sides of the rail
    const alongX=village.axis(i,j)==='x';
    const ax=alongX?1:0,az=alongX?0:1,side=slot===1?1:-1,px=-az*side,pz=ax*side;
    return {x:c.x+ax*(slot-1)*.3+px*.1,z:c.z+az*(slot-1)*.3+pz*.1,face:Math.atan2(px,pz),deck:true};}
  for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){if(!a&&!b)continue;if(inGrid(i+a,j+b)&&tiles[idx(i+a,j+b)]===WATER){const w=(a&&b)?.5:1;vx+=a*w;vz+=b*w;}}
  const L=Math.hypot(vx,vz)||1;vx/=L;vz/=L;const px=-vz,pz=vx;
  const x=c.x+vx*.32+px*(slot-1)*.26,z=c.z+vz*.32+pz*(slot-1)*.26;
  return {x,z,face:Math.atan2(vx,vz)};
}
function makeFisher(i,j,slot,colorIdx){
  const g=new THREE.Group();
  const coat=coatMs[colorIdx%coatMs.length];
  const body=new THREE.Mesh(bodyG,coat),head=new THREE.Mesh(headG,skinM),hat=new THREE.Mesh(hatG,hatM);
  const rodPivot=new THREE.Group();rodPivot.position.set(.03,.14,.04);rodPivot.rotation.x=ROD_ANG;
  const rod=new THREE.Mesh(rodG,rodM);rodPivot.add(rod);
  g.add(body,head,hat,rodPivot);g.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(13*3),3));
  const line=new THREE.Line(lineGeo,lineM);line.frustumCulled=false;
  const bob=new THREE.Mesh(bobG,bobM);
  scene.add(g,line,bob);
  const fs={i,j,slot,g,rodPivot,line,bobMesh:bob,state:'idle',fish:null,ph:Math.random()*6,color:colorIdx,bobOff:{a:rand(-.5,.5),d:rand(1.1,1.7)},bobPos:{x:0,z:0}};
  placeFisher(fs);
  fishersState.push(fs);return fs;
}
function placeFisher(fs){
  const p=slotPos(fs.i,fs.j,fs.slot);fs.x=p.x;fs.z=p.z;fs.face=p.face;
  fs.g.position.set(p.x,p.deck?DECK_Y+.022:Math.max(heightAt(p.x,p.z),WATER_Y)-.01,p.z);fs.g.rotation.set(0,p.face,0);
  const a=p.face+fs.bobOff.a;fs.bob={x:p.x+Math.sin(a)*fs.bobOff.d,z:p.z+Math.cos(a)*fs.bobOff.d};
  if(dAt(fs.bob.x,fs.bob.z)===0){fs.bob={x:p.x+Math.sin(p.face)*.9,z:p.z+Math.cos(p.face)*.9};}
}
function fishersOn(i,j){return fishersState.filter(f=>f.i===i&&f.j===j);}
function freeSlot(i,j){const used=fishersOn(i,j).map(f=>f.slot);for(const s of [1,0,2])if(!used.includes(s))return s;return -1;}
const tipV=new THREE.Vector3();
function updateFisher(fs,dt,t){
  let endX,endY,endZ,sag;
  if(fs.state==='fight'&&fs.fish){const h=fishHead(fs.fish);endX=h.x;endZ=h.z;endY=WATER_Y;sag=.03;
    fs.g.rotation.x=-.28+Math.sin(t*7+fs.ph)*.07;fs.rodPivot.rotation.x=ROD_ANG-.5+Math.sin(t*9+fs.ph)*.12;fs.bobMesh.visible=false;}
  else{fs.g.rotation.x=0;fs.rodPivot.rotation.x=ROD_ANG+Math.sin(t*.7+fs.ph)*.04;
    endX=fs.bob.x;endZ=fs.bob.z;endY=WATER_Y+.012+Math.sin(t*2.1+fs.ph)*.01;sag=.18;
    fs.bobMesh.visible=true;fs.bobMesh.position.set(endX,endY,endZ);}
  fs.bobPos.x=endX;fs.bobPos.z=endZ;
  fs.g.updateMatrixWorld();tipV.set(0,.55,0);fs.rodPivot.children[0].localToWorld(tipV);
  const arr=fs.line.geometry.attributes.position.array;
  for(let k=0;k<=12;k++){const u=k/12;arr[k*3]=lerp(tipV.x,endX,u);arr[k*3+1]=lerp(tipV.y,endY,u)-Math.sin(Math.PI*u)*sag;arr[k*3+2]=lerp(tipV.z,endZ,u);}
  fs.line.geometry.attributes.position.needsUpdate=true;
}
function removeFisherMeshes(fs){scene.remove(fs.g,fs.line,fs.bobMesh);fs.line.geometry.dispose();}

/* ================= sparkles ================= */
const SPK=260;const spkGeo=new THREE.BufferGeometry();const spkPos=new Float32Array(SPK*3),spkCol=new Float32Array(SPK*3);
spkGeo.setAttribute('position',new THREE.BufferAttribute(spkPos,3));spkGeo.setAttribute('color',new THREE.BufferAttribute(spkCol,3));
const spkData=Array.from({length:SPK},()=>({life:0,vx:0,vy:0,vz:0}));let spkI=0;
const spk=new THREE.Points(spkGeo,new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
spk.frustumCulled=false;spk.renderOrder=5;scene.add(spk);
function sparkle(x,y,z,col){const k=spkI++%SPK;const d=spkData[k];d.life=1;d.vx=rand(-.3,.3);d.vy=rand(.3,.9);d.vz=rand(-.3,.3);
  spkPos[k*3]=x;spkPos[k*3+1]=y;spkPos[k*3+2]=z;tmpC.set(col);d.c=[tmpC.r*3,tmpC.g*3,tmpC.b*3];}
function updateSparkles(dt){for(let k=0;k<SPK;k++){const d=spkData[k];if(d.life<=0){spkCol[k*3]=spkCol[k*3+1]=spkCol[k*3+2]=0;continue;}
  d.life-=dt*.6;spkPos[k*3]+=d.vx*dt;spkPos[k*3+1]+=d.vy*dt;spkPos[k*3+2]+=d.vz*dt;const a=Math.max(0,d.life);spkCol[k*3]=d.c[0]*a;spkCol[k*3+1]=d.c[1]*a;spkCol[k*3+2]=d.c[2]*a;}
  spkGeo.attributes.position.needsUpdate=spkGeo.attributes.color.needsUpdate=true;}

/* ================= wisps, warm water & the village ================= */
const wisps=makeWisps(scene);
const props=makeProps({rimMat});
const statueMats={stone:rimMat({color:'#a39d92'},'#ffe6c0',1),bronze:rimMat({color:'#9a7440',metalness:.3,roughness:.5},'#ffd9a0',1.2)};
function statueFish(id){const sp=SP[id]||SP.koi;const m=new THREE.Mesh(fishGeoCache[sp.id]||(fishGeoCache[sp.id]=fishGeometry(sp)),sp.awe?statueMats.bronze:statueMats.stone);
  m.scale.setScalar(.55/sp.len*(sp.eel?1.2:1));m.castShadow=true;return m;}
const village=makeVillage({scene,rimMat,heightAt,tiles,builds,meta:()=>S.meta,emit:wisps.emit,wayX,props,isLive:k=>isLive(k),statueFish});
// the Ember Showa warms the water it passes through: heat spots along its body and a short fading trail, plus rising steam
const heatTrail=[];let heatT=0;
function updateHeat(dt){
  const hot=fishes.filter(f=>f.sp.steam);
  let n=0;
  heatT-=dt;
  for(const f of hot){const vis=clamp((f.emerge-.3)/.7,0,1)*(f.state==='release'||f.state==='leave'?1-Math.min(1,f.out):1);if(vis<=0)continue;
    for(const t of [-.35,0,.35]){if(n>=3)break;heatU[n++].set(f.x+Math.sin(f.h)*t*f.sp.len,f.z+Math.cos(f.h)*t*f.sp.len,1.1+f.sp.len*.18,.75*vis);}
    if(heatT<=0){heatTrail.push({x:f.x,z:f.z,a:.55*vis});if(heatTrail.length>3)heatTrail.shift();}
    // steam: denser over the body, thin along the trail
    const rate=26*vis;for(let e=0;e<rate*dt*3;e++){if(Math.random()>1/3)continue;const t=rand(-.5,.5);
      wisps.emit(f.x+Math.sin(f.h)*t*f.sp.len+rand(-.35,.35),WATER_Y+.03,f.z+Math.cos(f.h)*t*f.sp.len+rand(-.35,.35),'steam');}
  }
  if(heatT<=0)heatT=.9;
  for(const tr of heatTrail){tr.a*=Math.exp(-dt*.35);if(n<HEATN)heatU[n++].set(tr.x,tr.z,1.6,tr.a);if(Math.random()<dt*4*tr.a)wisps.emit(tr.x+rand(-.6,.6),WATER_Y+.03,tr.z+rand(-.6,.6),'steam');}
  for(;n<HEATN;n++)heatU[n].w=0;
}

/* ================= tile overlay & hover ================= */
const hoverLoop=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,0,-.5),new THREE.Vector3(.5,0,.5),new THREE.Vector3(-.5,0,.5)]),
  new THREE.LineBasicMaterial({color:'#ffe6b0',depthTest:false,transparent:true,fog:false}));
hoverLoop.renderOrder=10;hoverLoop.visible=false;scene.add(hoverLoop);
const markG=new THREE.PlaneGeometry(.16,.16).rotateX(-Math.PI/2);
const marks=new THREE.InstancedMesh(markG,new THREE.MeshBasicMaterial({color:'#ffe9bf',transparent:true,opacity:.55,depthTest:false,fog:false}),GW*GH);
marks.renderOrder=9;marks.count=0;scene.add(marks);
const selRing=new THREE.Mesh(new THREE.RingGeometry(.12,.16,12).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#eac98d',depthTest:false,transparent:true,fog:false}));
selRing.renderOrder=11;selRing.visible=false;scene.add(selRing);

/* ================= economy & rules ================= */
// scales pay for work on the land and river; silver (from trade) pays fishers and upgrades; goods pay for buildings and leave on wagons and barges
const COST={clear:'scales',dig:'scales',hut:'scales',road:'scales',bridge:'scales',hire:'silver',line:'silver',bait:'silver'};
const cost={clear:()=>Math.round(4*Math.pow(1.025,S.clears)),dig:()=>Math.round(12*Math.pow(1.028,S.digs)),hire:()=>Math.round(15*Math.pow(1.3,S.hires)),
  hut:()=>Math.round(25*Math.pow(1.3,S.huts)),road:()=>3,bridge:()=>Math.round(30*Math.pow(1.2,S.bridges)),
  line:()=>Math.round(60*Math.pow(2.3,S.lineLv)),bait:()=>Math.round(90*Math.pow(2.5,S.baitLv))};
const has=id=>S.keepers.includes(id);
const boon=id=>S.boons[id]||0;
const lineMult=()=>(1+.3*S.lineLv)*(1+.15*boon('hands')),baitMult=()=>(1+.25*S.baitLv)*(1+.15*boon('sweet'))*(activeSets.walk?1.1:1);
const hutCount=()=>{let n=0;for(let k=0;k<GW*GH;k++)if(builds[k]===HUT)n++;return n;};
const housing=()=>hutCount()*HOUSING;
const bAt=(i,j)=>inGrid(i,j)?builds[idx(i,j)]:NONE;
const nbLink=(i,j)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>{const t=bAt(i+a,j+b);return t===ROAD||t===BRIDGE;})||(j===0&&i===WAY_I);
// a fisher can stand on cleared land at the water's edge (if nothing is built there), on a bridge or on a pier
function standable(i,j){const k=idx(i,j),b=builds[k];if(b===BRIDGE||b===B.PIER)return true;return tiles[k]===LAND&&(b===NONE||b===ROAD||b===B.JETTY)&&nb8(i,j,WATER);}
const have=g=>g==='scales'||g==='silver'?S[g]:(S.goods[g]||0);
const label=g=>g==='scales'||g==='silver'?g:GOODS[g].name.toLowerCase();
const afford=c=>Object.entries(c).every(([g,v])=>have(g)>=v);
function pay(c){const miss=Object.entries(c).find(([g,v])=>have(g)<v);
  if(miss){log(`Not enough ${label(miss[0])}. That needs ${fmt(miss[1])}.`,'warn');sfx('no');return false;}
  for(const [g,v] of Object.entries(c)){if(g==='scales'||g==='silver')S[g]-=v;else S.goods[g]-=v;}return true;}
const costHTML=c=>Object.entries(c).map(([g,v])=>`<span class="c ${g} ${have(g)<v?'short':''}">${fmt(v)} ${label(g)}</span>`).join(' ');
function buildCost(id){const d=DEFS[id],n=S.counts[id]||0,o={};for(const [g,v] of Object.entries(d.cost||{}))o[g]=Math.max(1,Math.round(v*Math.pow(d.grow||1,n)));return o;}
const unlocked=id=>!!S.unlocked[id];
const defLocked=id=>DEFS[id].lock&&!unlocked(id);
function spend(c,cur='scales'){if(S[cur]<c){log(`Not enough ${cur}. That costs ${fmt(c)}.`,'warn');sfx('no');return false;}S[cur]-=c;return true;}
function earn(v,x,z,popIt=true){S.scales+=v;S.earned+=v;S.income.push([Date.now(),v]);if(x!==undefined&&popIt)popAt(x,z,'+'+fmt(v)+' scales');}
function earnSilver(v,x,z){v=Math.round(v);if(v<=0)return;S.silver+=v;S.sIncome.push([Date.now(),v]);if(x!==undefined)popAt(x,z,'+'+fmt(v)+' silver','sv');}
const isLiveK=k=>tiles[k]===WATER&&FLOW.live[k]===1;
function placeRule(id,i,j){
  const d=DEFS[id],k=idx(i,j),t=tiles[k],b=builds[k];
  if(defLocked(id))return 'Needs a blueprint. Crates and forest finds bring them';
  if(b!==NONE)return 'Something is already built here';
  if(fishersOn(i,j).length)return 'Move the fishers off first';
  const land=()=>t===LAND?null:t===WILD?'Clear this land first':'Needs dry land';
  switch(d.on){
    case 'land':{const w=land();if(w)return w;break;}
    case 'bank':{const w=land();if(w)return w;if(!nb4(i,j,WATER))return 'Must touch the water';break;}
    case 'flowbank':{const w=land();if(w)return w;if(![[1,0],[-1,0],[0,1],[0,-1]].some(([a,c])=>inGrid(i+a,j+c)&&isLiveK(idx(i+a,j+c))))return 'Must touch flowing water';
      if(!trade.canBarge(k))return 'No flowing water from here out to the east edge';break;}
    case 'edge':{const w=land();if(w)return w;if(!nb8(i,j,WILD))return 'Must stand at the forest’s edge';break;}
    case 'still':if(t!==WATER)return 'Reeds grow in still water';if(FLOW.live[k])return 'The current runs here. Reeds need still water, where it doesn’t reach';break;
    case 'shore':if(t!==WATER)return 'Piers go over water';
      if(![[1,0],[-1,0],[0,1],[0,-1]].some(([a,c])=>{if(!inGrid(i+a,j+c))return false;const nk=idx(i+a,j+c);return tiles[nk]===LAND||builds[nk]===B.PIER||builds[nk]===BRIDGE;}))return 'A pier must start from the bank, a bridge or another pier';break;
  }
  if(d.road&&!nbLink(i,j))return 'Must touch a road';
  if(d.code===B.STATUE&&!S.statueSp)return 'Meet a fish first: statues are carved after fish you have met';
  return null;
}
function canDo(tool,i,j){
  if(!inGrid(i,j))return {ok:false,why:'Outside the valley floor'};
  const k=idx(i,j),t=tiles[k],b=builds[k];
  if(tool.startsWith('b:')){const id=tool.slice(2);const why=placeRule(id,i,j);return why?{ok:false,why}:{ok:true,cost:buildCost(id)};}
  if(tool==='clear'){if(t!==WILD)return {ok:false,why:t===LAND?'Already cleared':'That is water'};
    if(!nb4(i,j,LAND)&&!nb4(i,j,WATER))return {ok:false,why:'Must touch cleared land or water'};return {ok:true,c:cost.clear()};}
  if(tool==='dig'){if(t===WATER)return {ok:false,why:'Already water'};if(!nb4(i,j,WATER))return {ok:false,why:'Must connect to existing water'};
    if(b===ROAD)return {ok:false,why:'Lift the road first (click it with the road tool)'};if(b===HUT)return {ok:false,why:'A family lives here'};if(b!==NONE)return {ok:false,why:'Remove what is built here first'};
    if(fishersOn(i,j).length)return {ok:false,why:'Move the fishers off first'};return {ok:true,c:cost.dig()};}
  if(tool==='hire'){if(!standable(i,j))return {ok:false,why:b===HUT?'That is a home':t===WILD?'Clear this land first':t===WATER?'Fishers need solid ground, a pier or a bridge':b!==NONE&&b!==ROAD?'Something is built here':'Must stand at the water’s edge'};
    if(fishersState.length>=housing())return {ok:false,why:`Every hut is full (${HOUSING} fishers each). Build another hut`};
    if(freeSlot(i,j)<0)return {ok:false,why:'Three fishers per tile'};return {ok:true,c:cost.hire()};}
  if(tool==='move'){if(!standable(i,j))return {ok:false,why:'Needs cleared land at the water’s edge, a pier or a bridge'};if(freeSlot(i,j)<0)return {ok:false,why:'Tile is full'};return {ok:true,c:0};}
  if(tool==='hut'){const st=S.hutStyle;
    if(b===HUT){const cur=S.meta[k]?.style||'thatch';if(cur===st)return {ok:false,why:`Already a ${STYLES[st].name.toLowerCase()} hut. Pick another style in Build`};return {ok:true,restyle:true,cost:{timber:3}};}
    if(STYLES[st].lock&&!unlocked('style:'+st))return {ok:false,why:'That hut style needs a blueprint'};
    if(t!==LAND)return {ok:false,why:t===WILD?'Clear this land first':'Huts need dry land'};if(b!==NONE)return {ok:false,why:'Something is already built here'};
    if(fishersOn(i,j).length)return {ok:false,why:'Move the fishers off first'};return {ok:true,c:cost.hut()};}
  if(tool==='road'){if(b===ROAD){if(i===WAY_I&&j===0)return {ok:false,why:'The Pilgrim Way stays'};return {ok:true,c:0,lift:true};}
    if(t===WATER)return {ok:false,why:'Use a bridge to cross water'};if(b!==NONE)return {ok:false,why:'Something is already built here'};
    if(!nbLink(i,j))return {ok:false,why:'Roads must join a road or bridge'};
    return {ok:true,c:cost.road()+(t===WILD?cost.clear():0),wild:t===WILD};}
  if(tool==='pave'){const pv=S.pave;if(b!==ROAD)return {ok:false,why:'Pave a road tile'};
    if(PAVES[pv].lock&&!unlocked('pave:'+pv))return {ok:false,why:'That surface needs a blueprint'};
    if((S.meta[k]?.pave||'dirt')===pv)return {ok:false,why:`Already ${PAVES[pv].name.toLowerCase()}`};return {ok:true,cost:{...PAVES[pv].cost}};}
  if(tool==='bridge'){if(t!==WATER)return {ok:false,why:'Bridges go over water'};if(b===BRIDGE)return {ok:false,why:'Already bridged'};if(b!==NONE)return {ok:false,why:'Something is built here'};
    if(!nbLink(i,j))return {ok:false,why:'Bridges must join a road or bridge'};return {ok:true,c:cost.bridge()};}
  if(tool==='remove'){if(b===NONE)return {ok:false,why:'Nothing built here'};if(b===ROAD)return {ok:false,why:'Lift roads with the road tool'};
    if(b===B.SHRINE||b===B.STONES||b===B.BONES)return {ok:false,why:'That was here long before the village'};
    if(fishersOn(i,j).length)return {ok:false,why:'Move the fishers off first'};
    if(b===HUT&&fishersState.length>housing()-HOUSING)return {ok:false,why:'Every bed in this hut is taken'};
    if(b===BRIDGE)return {ok:true,refund:{scales:Math.round(cost.bridge()/1.2*.4)}};
    if(b===HUT)return {ok:true,refund:{scales:Math.round(cost.hut()/1.3*.4)}};
    const d=DEF_BY_CODE[b];const rf={};for(const [g,v] of Object.entries(d.cost||{}))rf[g]=Math.floor(v*.5);return {ok:true,refund:rf};}
  return {ok:false};
}
const PAINT_TOOLS=new Set(['road','pave','b:fence','b:flowers','remove']);
function act(tool,i,j,quiet=false){
  const r=canDo(tool,i,j);if(!r.ok){if(r.why&&!quiet)log(r.why+'.','warn');if(!quiet)sfx('no');return false;}
  const k=idx(i,j),cur=COST[tool];
  if(tool.startsWith('b:')){const id=tool.slice(2),d=DEFS[id];if(!pay(r.cost))return false;
    lastK=k;builds[k]=d.code;S.counts[id]=(S.counts[id]||0)+1;if(d.code===B.STATUE)S.meta[k]={sp:S.statueSp};
    buildsChanged();sfx('build');for(let n=0;n<6;n++){const c=tileC(i,j);sparkle(c.x+rand(-.3,.3),.25,c.z+rand(-.3,.3),'#ffe9bf');}
    if(!quiet)log(buildLog(id));wishEvent('build',{id});}
  else if(tool==='clear'){if(!spend(r.c,cur))return false;tiles[k]=LAND;S.clears++;forestYield(k);worldChanged();sfx('clear');wishEvent('clear');revealAt(k);}
  else if(tool==='dig'){if(!spend(r.c,cur))return false;tiles[k]=WATER;S.digs++;worldChanged();sfx('dig');}
  else if(tool==='hire'){if(!spend(r.c,cur))return false;makeFisher(i,j,freeSlot(i,j),S.hires+1);S.hires++;log(`A new fisher joins the bank. You have ${fishersState.length} of ${housing()} housed.`);sfx('pluck');wishEvent('hire');}
  else if(tool==='hut'){
    if(r.restyle){if(!pay(r.cost))return false;S.meta[k]={...(S.meta[k]||{}),style:S.hutStyle};buildsChanged();sfx('build');}
    else{if(!spend(r.c,cur))return false;builds[k]=HUT;S.huts++;S.meta[k]={style:S.hutStyle};buildsChanged();sfx('build');
      log(linkedHuts().some(h=>h.i===i&&h.j===j)?`A family settles in. Room for ${HOUSING} more fishers.`:`A family settles in. Join the hut to the Pilgrim Way by road so pilgrims can visit.`);wishEvent('build',{id:'hut'});}}
  else if(tool==='road'){if(r.lift){builds[k]=NONE;delete S.meta[k];buildsChanged();sfx('dig');}
    else{if(!spend(r.c,cur))return false;if(r.wild){tiles[k]=LAND;S.clears++;forestYield(k);}builds[k]=ROAD;if(S.pave!=='dirt'&&afford(PAVES[S.pave].cost)&&!(PAVES[S.pave].lock&&!unlocked('pave:'+S.pave))&&tool==='road'&&S.autoPave){pay(PAVES[S.pave].cost);S.meta[k]={pave:S.pave};}
      buildsChanged(r.wild);sfx('dig');if(r.wild){revealAt(k);}}}
  else if(tool==='pave'){if(!pay(r.cost))return false;S.meta[k]={...(S.meta[k]||{}),pave:S.pave};buildsChanged();sfx('dig');}
  else if(tool==='bridge'){if(!spend(r.c,cur))return false;builds[k]=BRIDGE;S.bridges++;buildsChanged();sfx('build');log('A bridge spans the water. Fishers can stand on it and reach the middle of the river.');}
  else if(tool==='remove'){const d=DEF_BY_CODE[b0(k)];for(const [g,v] of Object.entries(r.refund)){if(g==='scales')S.scales+=v;else S.goods[g]=(S.goods[g]||0)+v;}
    if(builds[k]===HUT)S.huts=Math.max(0,S.huts-1);else if(builds[k]===BRIDGE)S.bridges=Math.max(0,S.bridges-1);else if(d)S.counts[d.id]=Math.max(0,(S.counts[d.id]||1)-1);
    builds[k]=NONE;delete S.meta[k];buildsChanged();sfx('dig');}
  refreshUI();if(!quiet)save();return true;
}
const b0=k=>builds[k];
function buildLog(id){
  const L={woodcutter:'A woodcutter sets up at the forest’s edge. The more trees around, the more timber.',reedbed:'Reeds take root in the still water.',
    claypit:deposit[lastK]?'A clay pit on a red seam. It digs three times as fast.':'A clay pit is dug into the bank.',workshop:'A workshop opens. It turns reeds and clay into lanterns, or timber into carvings.',
    post:'A trading post, with a wagon of its own. It leaves up the Pilgrim Way when it is full.',jetty:'A jetty, with a barge. It rides the current east when it is loaded.',
    market:'A market stall. Pilgrims buy lanterns and carvings here.',pier:'A pier over the water. Fishers can stand on it.',statue:`A statue of the ${SP[S.statueSp]?.name||'fish'}. ${STATUE_FX[S.statueSp]?.txt?('Nearby, '+STATUE_FX[S.statueSp].txt+'.'):''}`};
  return L[id]||`${DEFS[id].name} placed.`;
}
let lastK=-1;
function forestYield(k){let t=3+(has('garrow')?3:0);const s=secretAt[k];if(s&&s.type==='grove'&&!S.found.includes(k))t+=20;S.goods.timber+=t;const c=tileC(k%GW,(k/GW)|0);popAt(c.x,c.z,'+'+t+' timber','tm');}
function worldChanged(){buildTerrain(true);updateTrees();analyzeWater();fishersState.forEach(placeFisher);updateMarks();computeVillages();computeEconomy();village.sync();trade.sync();updateHintVis();}
function buildsChanged(){buildTerrain(true);if(arguments[0])updateTrees();computeVillages();computeEconomy();village.sync();trade.sync();fishersState.forEach(placeFisher);updateMarks();}

/* ================= auras, charm, production ================= */
const charm=new Float32Array(GW*GH);
const aura={bite:new Float32Array(GW*GH),reel:new Float32Array(GW*GH),rack:new Float32Array(GW*GH),statue:new Float32Array(GW*GH)};
const prodBoost={};[B.WOOD,B.REED,B.CLAY,B.SHOP,B.MARKET].forEach(c=>prodBoost[c]=new Float32Array(GW*GH));
function spread(k,r,fn){const i=k%GW,j=(k/GW)|0;for(let b=-r;b<=r;b++)for(let a=-r;a<=r;a++){const ni=i+a,nj=j+b;if(inGrid(ni,nj))fn(idx(ni,nj));}}
let producers=[];// {k,code,good,rate}
let activeSets={};
function computeEconomy(){
  charm.fill(0);for(const a of Object.values(aura))a.fill(0);for(const a of Object.values(prodBoost))a.fill(0);
  const ex=boon('reach');
  for(let k=0;k<GW*GH;k++){const b=builds[k];if(b===NONE)continue;const d=DEF_BY_CODE[b];
    if(d?.charm)spread(k,d.charm[1]+ex,q=>charm[q]+=d.charm[0]);
    if(b===ROAD){const pv=PAVES[S.meta[k]?.pave];if(pv?.charm)spread(k,pv.charm[1],q=>charm[q]+=pv.charm[0]);}
    if(b===B.NETS)spread(k,2+ex,q=>aura.reel[q]+=.25);
    if(b===B.RACK)spread(k,2+ex,q=>aura.rack[q]+=.2);
    if(b===B.SHRINE)spread(k,3+ex,q=>aura.bite[q]+=.2);
    if(b===B.STATUE){const fx=STATUE_FX[S.meta[k]?.sp]||{};const r=(fx.r||2)+ex;
      spread(k,r,q=>{if(fx.bite)aura.bite[q]+=fx.bite;if(fx.reel)aura.reel[q]+=fx.reel;if(fx.scale)aura.statue[q]+=fx.scale;if(fx.charm)charm[q]+=fx.charm;
        if(fx.prod)for(const [c,v] of Object.entries(fx.prod))prodBoost[c][q]+=v;});}
  }
  computeSets();
  producers=[];
  for(let k=0;k<GW*GH;k++){const b=builds[k],i=k%GW,j=(k/GW)|0;let good=null,rate=0;
    if(b===B.WOOD){let n=0;for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){if((x||y)&&inGrid(i+x,j+y)&&tiles[idx(i+x,j+y)]===WILD)n++;}
      good='timber';rate=.9*n*(1+.25*boon('wood'))*(has('garrow')?1.6:1);}
    else if(b===B.REED){let n=0;for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){const nk=idx(i+x,j+y);if(inGrid(i+x,j+y)&&tiles[nk]===WATER&&!FLOW.live[nk])n++;}
      good='reeds';rate=(2.5+.7*n)*(1+.25*boon('reed'))*(has('wren')?2:1);}
    else if(b===B.CLAY){good='clay';rate=2*(deposit[k]?3:1)*(1+.25*boon('clay'))*(has('kiln')?1.25:1);}
    else if(b===B.SHOP){good='craft';rate=4*(has('kiln')?1.5:1);}
    else continue;
    rate*=1+(prodBoost[b][k]||0);producers.push({k,code:b,good,rate,prog:shopProg.get(k)||0});}
}
const shopProg=new Map();
function productionTick(dt){
  for(const p of producers){
    if(p.good!=='craft'){S.goods[p.good]+=p.rate*dt/60;continue;}
    let g=(shopProg.get(p.k)||0)+p.rate*dt/60;
    if(g>=1){const G=S.goods;
      if(G.reeds>=2&&G.clay>=1){G.reeds-=2;G.clay-=1;G.lanterns+=1;g-=1;craftPuff(p.k,'#ffb35a');}
      else if(G.timber>=3+S.reserve.timber*0){G.timber-=3;G.carvings+=1;g-=1;craftPuff(p.k,'#e0b070');}
      else g=1;}
    shopProg.set(p.k,g);
  }
}
function craftPuff(k,col){if(!started)return;const c=tileC(k%GW,(k/GW)|0);for(let n=0;n<3;n++)sparkle(c.x+rand(-.15,.15),.3,c.z+rand(-.15,.15),col);}
function goodRate(g){let r=0;for(const p of producers)if(p.good===g)r+=p.rate;return r;}
// silver a unit of a good fetches: kind is 'wagon', 'barge' or 'market'
function price(g,kind){let p=GOODS[g].price;
  if(!GOODS[g].raw)p*=(1+.15*boon('craft'))*(activeSets.craft?1.2:1);
  if(g==='lanterns'&&has('ysolde'))p*=2;
  if(kind==='barge')p*=1.25*(has('ferry')?1.3:1)*(activeSets.harbor?1.25:1);
  return p;}
const capacity=kind=>Math.round(((kind==='wagon'?16:30)+8*boon('pockets'))*(kind==='wagon'&&has('carter')?1.5:1));
const vSpeed=kind=>(1+.15*boon('wheels'))*(kind==='wagon'&&has('carter')?1.25:1);

/* ================= villages & pilgrims ================= */
// huts that pilgrims can reach: next to a road or bridge connected to the Pilgrim Way
function wayReach(){
  const seen=new Uint8Array(GW*GH),st=[];const s0=idx(WAY_I,0);if(builds[s0]===ROAD){seen[s0]=1;st.push(s0);}
  while(st.length){const k=st.pop(),i=k%GW,j=(k/GW)|0;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+a,nj=j+b;if(!inGrid(ni,nj))continue;const nk=idx(ni,nj);
    if(!seen[nk]&&(builds[nk]===ROAD||builds[nk]===BRIDGE)){seen[nk]=1;st.push(nk);}}}
  return seen;
}
function linkedOf(code){const seen=wayReach();const out=[];for(let k=0;k<GW*GH;k++){if(builds[k]!==code)continue;const i=k%GW,j=(k/GW)|0;
    if([[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>inGrid(i+a,j+b)&&seen[idx(i+a,j+b)]))out.push({i,j,k});}return out;}
const linkedHuts=()=>linkedOf(HUT);
let villages=[];// {name,huts:[k],cx,cz,style,harmony,charm}
function computeVillages(){
  const hs=[];for(let k=0;k<GW*GH;k++)if(builds[k]===HUT)hs.push(k);
  const grp=new Map();const par=hs.map((_,n)=>n);const find=n=>par[n]===n?n:(par[n]=find(par[n]));
  for(let a=0;a<hs.length;a++)for(let b=a+1;b<hs.length;b++){const ia=hs[a]%GW,ja=(hs[a]/GW)|0,ib=hs[b]%GW,jb=(hs[b]/GW)|0;if(Math.max(Math.abs(ia-ib),Math.abs(ja-jb))<=2)par[find(a)]=find(b);}
  hs.forEach((k,n)=>{const r=find(n);if(!grp.has(r))grp.set(r,[]);grp.get(r).push(k);});
  const before=villages.length;villages=[];const used=new Set(Object.values(S.hutVillage));
  for(const ks of grp.values()){
    if(ks.length<3){ks.forEach(k=>{delete S.hutVillage[k];});continue;}
    const cnt={};ks.forEach(k=>{const n=S.hutVillage[k];if(n)cnt[n]=(cnt[n]||0)+1;});
    let name=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];
    if(!name){name=VILLAGE_NAMES.find(n=>!used.has(n))||'New Hamlet';used.add(name);if(booted){log(`Three huts stand together now. The village is called ${name}.`,'gold');wishEvent('village');sfx('discover');}}
    ks.forEach(k=>{S.hutVillage[k]=name;});
    const sc={};ks.forEach(k=>{const s=S.meta[k]?.style||'thatch';sc[s]=(sc[s]||0)+1;});const top=Object.keys(sc).sort((a,b)=>sc[b]-sc[a])[0];
    let cx=0,cz=0;ks.forEach(k=>{const c=tileC(k%GW,(k/GW)|0);cx+=c.x;cz+=c.z;});
    villages.push({name,huts:ks,cx:cx/ks.length,cz:cz/ks.length,style:top,harmony:sc[top]>=3&&sc[top]===ks.length,charm:0});
  }
}
function villageCharm(v){let c=0;for(const k of v.huts)c+=charm[k];return c/v.huts.length;}
const talesKnown=id=>{const n=S.codex[id]||0;return TALE_AT.filter(t=>n>=t).length;};
const allTales=()=>SPECIES.reduce((s,sp)=>s+talesKnown(sp.id),0);
function avgCharm(){if(!villages.length){const lh=linkedHuts();if(!lh.length)return 0;return lh.reduce((s,h)=>s+charm[h.k],0)/lh.length;}return villages.reduce((s,v)=>s+villageCharm(v),0)/villages.length;}
// pilgrims come to hear the tales. They visit huts, and buy at market stalls
function pilgrimMult(){return (1+.15*allTales()*(has('pell')?2:1))*(1+avgCharm()/25)*(1+.2*boon('hosts'))*(activeSets.garden?1.15:1);}
let pilgrimT=4;
function pilgrimTick(dt){
  pilgrimT-=dt;if(pilgrimT>0)return;
  const lh=linkedHuts(),mk=linkedOf(B.MARKET);const n=lh.length+mk.length;
  pilgrimT=n?rand(9,16)/Math.sqrt(n)/pilgrimMult():5;
  if(!started||!n)return;
  const toMarket=mk.length&&(Math.random()<.65||!lh.length);
  village.spawnPilgrim(toMarket?mk.map(m=>({...m,market:true})):lh,pilgrimArrive);
}
function marketMult(k){const v=villages.find(v=>v.huts.some(h=>Math.max(Math.abs(h%GW-k%GW),Math.abs(((h/GW)|0)-((k/GW)|0)))<=3));
  return 1.5*(1+charm[k]/30)*(1+(prodBoost[B.MARKET][k]||0))*(v?.harmony?1.2:1)*(activeSets.harmony?1.2:1);}
function pilgrimArrive(t,pos){
  if(!t.market||builds[t.k]!==B.MARKET)return;
  const order=['lanterns','carvings','reeds','timber','clay'];
  const g=order.find(g=>S.goods[g]-(S.reserve[g]||0)>=1);if(!g)return;
  const q=Math.min(Math.floor(S.goods[g]-(S.reserve[g]||0)),GOODS[g].raw?3:1+(Math.random()<.3?1:0));
  S.goods[g]-=q;const v=q*price(g,'market')*marketMult(t.k);
  const c=tileC(t.i,t.j);earnSilver(v,c.x,c.z);sfx('coins');wishEvent('ship',{n:q});
}

/* ================= hooking & fighting ================= */
let hookTimer=0;
function hookCheck(){
  for(const f of fishes){
    if(f.state!=='swim'||f.emerge<.85)continue;
    const reach=1.5+f.sp.len*f.sp.wid*.5;
    const near=fishersState.filter(fs=>fs.state==='idle'&&(distToFish(f,fs.bob.x,fs.bob.z)<reach||distToFish(f,fs.x,fs.z)<reach+.6));
    if(!near.length)continue;
    if(near.length>=f.sp.crew){
      const ab=near.reduce((a,fs)=>a+aura.bite[idx(fs.i,fs.j)],0)/near.length;
      if(Math.random()<.07*baitMult()*(1+ab)){
        const crew=near.slice(0,f.sp.crew*2);f.state='hooked';f.hookers=crew;f.progress=0;
        crew.forEach(fs=>{fs.state='fight';fs.fish=f;});
        log(`${crew.length>1?crew.length+' fishers have':'A fisher has'} ${S.codex[f.sp.id]?'a '+f.sp.name:'something unfamiliar'} on a barbless line.`,f.sp.crew>1?'gold':'');
        sfx('hook');
      }
    }else if(performance.now()>f.nextHint){f.nextHint=performance.now()+25000;
      const nm=S.codex[f.sp.id]?`The ${f.sp.name}`:'Something large';
      log(`${nm} circles the bait but won’t bite. It needs ${f.sp.crew} fishers waiting together, you have ${near.length} there.`,'warn');}
  }
}
function updateFight(f,dt){
  if(f.state!=='hooked')return;
  const hands=f.hookers.length;
  // blessings on the crew's tiles: net sheds and statues nearby, and the Net-Mender for anyone on a deck
  let rm=0;for(const fs of f.hookers){const k=idx(fs.i,fs.j),deck=builds[k]===BRIDGE||builds[k]===B.PIER;rm+=aura.reel[k]+(deck&&has('netmender')?.5:0)+(builds[k]===BRIDGE&&activeSets.lbridge?.2:0);}
  const rate=(hands/f.sp.crew)*lineMult()*(1+rm/hands)/f.sp.fight*debugSpeed.reel;
  f.progress+=dt*rate;
  // drag the fish gently toward the crew
  let cx=0,cz=0;f.hookers.forEach(fs=>{cx+=fs.x;cz+=fs.z;});cx/=hands;cz/=hands;
  const d=Math.hypot(cx-f.x,cz-f.z);if(d>f.sp.len*.5+.6){const nx=f.x+(cx-f.x)/d*dt*.05,nz=f.z+(cz-f.z)/d*dt*.05;if(dAt(nx,nz)>0){f.x=nx;f.z=nz;}}
  f.h+=angDiff(Math.atan2(f.x-cx,f.z-cz),f.h)*dt*.15;
  if(Math.random()<dt*2)sparkle(fishHead(f).x,WATER_Y+.02,fishHead(f).z,'#dff8ee');
  if(f.progress>=1){
    f.state='held';f.out=0;f.relH=Math.atan2(f.x-cx,f.z-cz);f.hookers.forEach(fs=>{fs.state='idle';fs.fish=null;});
    const before=talesKnown(f.sp.id);const first=!S.codex[f.sp.id];S.codex[f.sp.id]=(S.codex[f.sp.id]||0)+1;
    const tl=releaseTally(f,cx,cz);earn(tl.total,f.x,f.z,false);
    log(`${first?'Met':'Released'} ${first?'a '+f.sp.name+' for the first time':'a '+f.sp.name}, and let it go. It shed ${fmt(tl.total)} scales.`,'gold');
    if(first){S.statueSp=S.statueSp||f.sp.id;if(booted)log(`You can carve a statue of the ${f.sp.name} now (Build → Decor).`);}
    wishEvent('meet',{sp:f.sp.id});
    if(talesKnown(f.sp.id)>before){const n=talesKnown(f.sp.id);log(`A new tale of the ${f.sp.name} is told in the village (${n} of 3). Pilgrims will come to hear it.`,'gold');}
    sfx(f.sp.awe?'land-big':'land');renderCodex();refreshUI();save();if(first)renderDrawer();
  }
}

/* ================= the release tally ================= */
const tally=makeTally(document.getElementById('labels'),sfx);
function tideWindow(){return (50+15*boon('tide'))*1000;}
const TIDE_STEP=.05;
function tideMult(){return Date.now()-S.tide.t<tideWindow()?1+TIDE_STEP*S.tide.n:1;}
function releaseTally(f,cx,cz){
  const sp=f.sp,rows=[{t:sp.name,v:sp.value,k:'base'}];const x=v=>v;
  const hk=f.hookers.map(fs=>idx(fs.i,fs.j));const avg=a=>hk.reduce((s,k)=>s+a[k],0)/Math.max(1,hk.length);
  const extra=f.hookers.length-sp.crew;if(extra>0)rows.push({t:`${extra} extra hand${extra>1?'s':''}`,v:1+.1*extra,k:'x'});
  const rk=avg(aura.rack);if(rk>0)rows.push({t:'Drying racks',v:1+rk,k:'x'});
  const st=avg(aura.statue);if(st>0)rows.push({t:'Statue blessing',v:1+st,k:'x'});
  if(sp.crew<=1&&has('ottoline')){S.small++;if(S.small%3===0)rows.push({t:'Old Ottoline',v:3,k:'x'});}
  if(sp.crew>=5&&has('maud'))rows.push({t:'Maud of the Deep',v:2,k:'x'});
  if(has('tamsin')&&villages.length)rows.push({t:'Tamsin Two-Hats',v:Math.pow(1.1,villages.length),k:'x'});
  const nst=builds.reduce((s,b)=>s+(b===B.STATUE?1:0),0);if(has('moss')&&nst)rows.push({t:'Brother Moss',v:Math.pow(1.05,nst),k:'x'});
  const met=SPECIES.filter(s=>S.codex[s.id]).length;if(has('fen')&&met)rows.push({t:'Little Fen',v:Math.pow(1.08,met),k:'x'});
  if(boon('shine'))rows.push({t:'Scale Shine',v:1+.1*boon('shine'),k:'x'});
  if(activeSets.row)rows.push({t:'Fisher’s Row',v:1.1,k:'x'});
  if(activeSets.statues)rows.push({t:'Statue Garden',v:1.15,k:'x'});
  // the good tide: fish met one after another build a streak
  const now=Date.now();if(now-S.tide.t<tideWindow())S.tide.n=Math.min(10+3*boon('tide'),S.tide.n+1);else S.tide.n=0;S.tide.t=now;
  if(S.tide.n>0)rows.push({t:`Good tide`,v:1+TIDE_STEP*S.tide.n,k:'x'});
  if(S.tide.n>0)wishEvent('tide',{n:S.tide.n});
  let total=sp.value;for(const r of rows)if(r.k==='x')total*=r.v;total=Math.round(total);
  if(started){const hd=fishHead(f);const p=toScreen(hd.x,.4,hd.z);
    tally.show({x:sp.awe?innerWidth/2:p.x,y:sp.awe?innerHeight*.34:p.y-30,big:!!sp.awe,title:sp.awe?`${sp.name} · released`:'',rows,total,col:sp.glow});}
  return {total,rows};
}

/* ================= spawning & giant sightings ================= */
let spawnTimer=6;
function spawnTick(dt){
  spawnTimer-=dt*baitMult()*debugSpeed.spawn;if(spawnTimer>0)return;spawnTimer=rand(20,36);
  const cap=Math.min(20,comps.reduce((s,c)=>s+Math.max(1,Math.floor(c.size/7)),0));
  if(fishes.filter(f=>f.state!=='leave').length>=cap)return;
  const counts={};fishes.forEach(f=>{const c=compAt(f.x,f.z);counts[c]=(counts[c]||0)+1;});
  const open=comps.filter(c=>(counts[c.id]||0)<Math.max(1,Math.floor(c.size/7)));if(!open.length)return;
  let tot=open.reduce((s,c)=>s+c.size,0),r=Math.random()*tot,comp=open[0];for(const c of open){r-=c.size;if(r<=0){comp=c;break;}}
  const present=new Set(fishes.map(f=>f.sp.id));
  const elig=SPECIES.filter(s=>s.minWater<=comp.size&&comp.maxD>=s.needD&&!(s.awe&&present.has(s.id)));if(!elig.length)return;
  const wt=s=>s.w*(S.codex[s.id]?1:1.6)*(s.crew<=fishersState.length?1:.35);
  let W=elig.reduce((a,s)=>a+wt(s),0),rr=Math.random()*W,sp=elig[0];for(const s of elig){rr-=wt(s);if(rr<=0){sp=s;break;}}
  const f=spawnFish(sp,comp);
  if(sp.awe&&started&&!cine.fish)startCine(f);
}
const cine={fish:null,t:0,saved:null,phase:0};
function startCine(f){
  cine.fish=f;cine.t=0;cine.saved={t:view.t.clone(),z:view.z};
  const known=!!S.codex[f.sp.id];
  document.getElementById('bannerKick').textContent=known?'It returns':'Something vast stirs below';
  document.getElementById('bannerName').textContent=f.sp.name;
  document.getElementById('bannerEp').textContent=f.sp.ep;
  document.getElementById('bannerReq').textContent=`Needs ${f.sp.crew} fishers on one bank · sheds ${fmt(f.sp.value)} scales when released`;
  dv.classList.add('cine');setTimeout(()=>banner.classList.add('on'),900);
  tweenTo({x:f.x,z:f.z},Math.max(14,f.sp.len*2.6),4);
  log(`${f.sp.name} has surfaced in the river.`,'gold');sfx('awe');
}
function endCine(returnView=true){
  if(!cine.fish)return;banner.classList.remove('on');dv.classList.remove('cine');
  if(returnView&&cine.saved)tweenTo({x:cine.saved.t.x,z:cine.saved.t.z},cine.saved.z,3.5);
  cine.fish=null;
}
function updateCine(dt){
  if(!cine.fish)return;cine.t+=dt;const f=cine.fish;
  if(!tween&&cine.t>4){view.t.x=lerp(view.t.x,f.x,1-Math.exp(-dt*.6));view.t.z=lerp(view.t.z,f.z,1-Math.exp(-dt*.6));}
  if(cine.t>12||!fishes.includes(f))endCine(true);
}

/* ================= trade ================= */
const trade=makeTrade({scene,props,village,tiles,builds,isLive:k=>isLiveK(k),S,
  capacity:k=>capacity(k),speed:k=>vSpeed(k)*debugSpeed.trade,price:(g,k)=>price(g,k),paveSpeed:k=>PAVES[S.meta[k]?.pave||'dirt'].speed,
  onDepart(v,n){if(!started)return;sfx('cart');S.shipments++;wishEvent('ship',{n});},
  onReturn(v,rep){
    const total=rep.silver+rep.bonus;const p=v.mesh.position;
    if(total>0){earnSilver(total,p.x,p.z);sfx('coins');}
    const where=v.kind==='wagon'?'The wagon is back from up the Way':'The barge is back from downriver';
    log(`${where}: ${rep.lines.map(l=>`${l.q} ${GOODS[l.g].name.toLowerCase()}`).join(', ')} sold for ${fmt(rep.silver)} silver.`,'gold');
    for(const o of rep.done){log(`${o.regionName} got its ${GOODS[o.good].name.toLowerCase()}. +${fmt(o.reward)} silver, and a crate.`,'gold');queueCrate({source:o.regionName,kind:'mixed'});}
    if(S.shipments===1&&!rep.done.length)queueCrate({source:'your first shipment',kind:'mixed'});
    trade.topUpOrders();refreshUI();save();}});

/* ================= forest secrets ================= */
let secrets=[];const secretAt={};
function pristineTiles(){const t=new Uint8Array(GW*GH);initTiles(t);return t;}
function initSecrets(){
  if(!S.seed)S.seed=1+Math.floor(Math.random()*2**30);
  secrets=makeSecrets(S.seed,pristineTiles()).filter(s=>tiles[s.k]===WILD||S.found.includes(s.k));
  for(const s of secrets){secretAt[s.k]=s;if(s.type==='clay')deposit[s.k]=1;}
}
const hintVis=new Set();
function updateHintVis(){
  hintVis.clear();const R=has('quill')?11:7;
  for(const s of secrets){if(S.found.includes(s.k)||tiles[s.k]!==WILD)continue;let near=false;
    for(let b=-R;b<=R&&!near;b++)for(let a=-R;a<=R;a++){const ni=s.i+a,nj=s.j+b;if(inGrid(ni,nj)&&tiles[idx(ni,nj)]!==WILD){near=true;break;}}
    if(near||debugFlags.allHints)hintVis.add(s.k);}
  syncBirds();
}
const birds=[];
function syncBirds(){
  for(const b of birds)scene.remove(b.g);birds.length=0;
  for(const s of secrets){if(!hintVis.has(s.k)||SECRET_TYPES[s.type].hint!=='birds')continue;const c=tileC(s.i,s.j);
    for(let n=0;n<3;n++){const g=props.bird();scene.add(g);birds.push({g,cx:c.x,cz:c.z,r:rand(.5,1.1),a:rand(0,6.28),w:rand(.5,.9)*(Math.random()<.5?1:-1),y:rand(1.7,2.3),ph:rand(0,6)});}}
}
let hintT=0;
function updateHints(dt,t){
  for(const b of birds){b.a+=b.w*dt;b.g.position.set(b.cx+Math.cos(b.a)*b.r,b.y+Math.sin(t*.7+b.ph)*.1,b.cz+Math.sin(b.a)*b.r);b.g.rotation.y=-b.a+(b.w>0?0:Math.PI);
    const fl=Math.sin(t*9+b.ph)*.5;b.g.userData.l.rotation.z=fl;b.g.userData.r.rotation.z=-fl;}
  hintT-=dt;if(hintT>0)return;hintT=.35;
  for(const k of hintVis){const s=secretAt[k],c=tileC(s.i,s.j),h=SECRET_TYPES[s.type].hint;
    if(h==='smoke'&&Math.random()<.8)wisps.emit(c.x+rand(-.1,.1),.9,c.z+rand(-.1,.1),'smoke');
    else if(h==='glint'&&Math.random()<.25)sparkle(c.x+rand(-.3,.3),rand(.6,1.1),c.z+rand(-.3,.3),'#fff0c0');
    else if(h==='light'){if(Math.random()<.5)sparkle(c.x+rand(-.4,.4),rand(.8,1.4),c.z+rand(-.4,.4),'#ffe9a0');if(Math.random()<.3)wisps.emit(c.x,.9,c.z,'mist');}}
}
function revealAt(k){
  const s=secretAt[k];if(!s||S.found.includes(k))return;S.found.push(k);hintVis.delete(k);syncBirds();
  const c=tileC(s.i,s.j);for(let n=0;n<14;n++)sparkle(c.x+rand(-.4,.4),rand(.2,.8),c.z+rand(-.4,.4),'#ffe9bf');sfx('discover');
  const T={
    hermit:()=>{toast('A hermit’s camp','Someone has lived out here for years. They would come down to the village, if you asked the right one.');queueCrate({source:'a hermit’s camp',kind:'keeper'});},
    cache:()=>{toast('A forgotten cache','Oilcloth and rope around a wooden box. It has waited a long time.');queueCrate({source:'a forgotten cache',kind:'mixed'});},
    blueprint:()=>{const left=BLUEPRINTS.filter(b=>!unlocked(b.id));if(!left.length){queueCrate({source:'an old workshop',kind:'mixed'});return;}
      const b=left[Math.floor(Math.random()*left.length)];S.unlocked[b.id]=true;renderDrawer();toast('An old workshop',`Drawings pinned to the wall, still legible: <b>${b.name}</b>. You can build them now.`);},
    bones:()=>{builds[k]=B.BONES;const v=Math.round(90*(1+S.found.length*.25));earn(v,c.x,c.z);toast('Giant’s bones',`Ribs as tall as a hut, grown over with moss. Something swam here before the river had a name. The village gathers <b>${fmt(v)} scales</b> from the moss.`);},
    stones:()=>{builds[k]=B.STONES;toast('Standing stones',`A ring of old stones. Another keeper can live in the valley now (<b>${keeperSlots()}</b> in all).`);renderKeepers();},
    shrine:()=>{builds[k]=B.SHRINE;toast('An old shrine','Candles still burn in it. Nobody admits to lighting them. Fish take the line more often within 3 tiles.');},
    clay:()=>{toast('A seam of red clay','A clay pit dug here would give three times as much.');},
    grove:()=>{toast('An old cedar grove','Tall straight trunks. The woodcutters take <b>20 timber</b> from it.');},
  };
  T[s.type]();if(s.type==='bones'||s.type==='stones'||s.type==='shrine'){buildsChanged();}
  wishEvent('find');save();
}
function toast(title,body){const el=$('toast');el.innerHTML=`<div class="k">Found in the forest</div><h4>${title}</h4><p>${body}</p>`;el.classList.remove('on');void el.offsetWidth;el.classList.add('on');
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),7500);log(title+'.','gold');}

/* ================= keepers, boons, crates ================= */
const keeperSlots=()=>2+builds.reduce((s,b)=>s+(b===B.STONES?1:0),0);
const crateQ=[];let crateOpen=null;
function queueCrate(c){crateQ.push(c);S.crates++;if(!crateOpen)setTimeout(nextCrate,started?900:0);}
function crateCards(kind){
  const n=has('quill')?4:3;const out=[];const used=new Set();
  const pools={
    keeper:()=>KEEPERS.filter(k=>!S.keepers.includes(k.id)&&!used.has('k'+k.id)).map(k=>({type:'keeper',id:k.id,name:k.name,desc:k.desc,glyph:k.glyph})),
    boon:()=>BOONS.filter(b=>boon(b.id)<b.max&&!used.has('b'+b.id)).map(b=>({type:'boon',id:b.id,name:b.name,desc:b.desc+(boon(b.id)?` (you have ${boon(b.id)})`:'')})),
    blueprint:()=>BLUEPRINTS.filter(b=>!unlocked(b.id)&&!used.has('p'+b.id)).map(b=>({type:'blueprint',id:b.id,name:b.name,desc:bpDesc(b)})),
  };
  for(let t=0;t<n;t++){
    let kinds=kind==='keeper'?['keeper']:['keeper','boon','boon','blueprint'];
    kinds=kinds.filter(k=>pools[k]().length);if(!kinds.length)kinds=['boon','blueprint','keeper'].filter(k=>pools[k]().length);if(!kinds.length)break;
    const kk=kinds[Math.floor(Math.random()*kinds.length)],pool=pools[kk]();const c=pool[Math.floor(Math.random()*pool.length)];
    used.add(c.type[0]+c.id);out.push(c);}
  if(!out.length)out.push({type:'silver',id:'silver',name:'A purse of silver',desc:'+'+fmt(100+50*S.crates)+' silver.'});
  return out;
}
function bpDesc(b){if(b.kind==='build')return 'Blueprint. '+DEFS[b.id].desc;if(b.kind==='style')return `Blueprint. Build or restyle huts in ${STYLES[b.id.split(':')[1]].name.toLowerCase()}. A village all in one style is in harmony.`;
  return `Blueprint. Pave roads in ${PAVES[b.id.split(':')[1]].name.toLowerCase()}: wagons roll faster, and it adds charm.`;}
function nextCrate(){
  if(crateOpen||!crateQ.length)return;const c=crateQ.shift();crateOpen=c;c.cards=crateCards(c.kind);
  const el=$('crate');el.hidden=false;el.classList.remove('on');void el.offsetWidth;el.classList.add('on');
  $('crateK').textContent=c.kind==='keeper'?'Someone would like to join you':'A crate';$('crateH').textContent=`From ${c.source}`;
  $('crateR').innerHTML='';const cards=$('crateCards');cards.innerHTML='';
  c.cards.forEach((cd,n)=>{const b=document.createElement('button');b.type='button';b.className='card '+cd.type;b.style.animationDelay=(n*.12)+'s';
    b.innerHTML=`<div class="ct">${cd.type==='keeper'?'Keeper':cd.type==='boon'?'Blessing':cd.type==='blueprint'?'Blueprint':'Silver'}</div>${cd.glyph?`<div class="cg">${cd.glyph}</div>`:''}<div class="cn">${cd.name}</div><div class="cd">${cd.desc}</div>`;
    b.addEventListener('click',()=>pickCard(cd));cards.appendChild(b);});
  sfx('crate');
}
function closeCrate(){$('crate').hidden=true;crateOpen=null;refreshUI();save();setTimeout(nextCrate,500);}
function pickCard(cd){
  sfx('pick');
  if(cd.type==='keeper'){if(S.keepers.length<keeperSlots()){S.keepers.push(cd.id);log(`${cd.name} comes to live in the valley. ${cd.desc}`,'gold');afterKeepers();closeCrate();return;}
    // full: pick someone to let go
    const r=$('crateR');r.innerHTML=`<div class="rk">Every keeper’s cottage is taken. Who makes room for ${cd.name}?</div>`;
    for(const id of S.keepers){const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=`${KEEPER[id].name} leaves`;
      b.addEventListener('click',()=>{S.keepers[S.keepers.indexOf(id)]=cd.id;log(`${KEEPER[id].name} moves on. ${cd.name} takes their place.`,'gold');afterKeepers();closeCrate();});r.appendChild(b);}
    const no=document.createElement('button');no.type='button';no.className='chip';no.textContent=`Thank ${cd.name}, but no`;no.addEventListener('click',closeCrate);r.appendChild(no);return;}
  if(cd.type==='boon'){S.boons[cd.id]=boon(cd.id)+1;log(`${cd.name}: ${BOON[cd.id].desc}`,'gold');computeEconomy();}
  if(cd.type==='blueprint'){S.unlocked[cd.id]=true;log(`Blueprint: ${cd.name}. Find it in Build.`,'gold');renderDrawer();}
  if(cd.type==='silver'){earnSilver(100+50*S.crates);}
  closeCrate();
}
function afterKeepers(){computeEconomy();renderKeepers();updateHintVis();}
function renderKeepers(){
  const el=$('keepers');const n=keeperSlots();let h='';
  for(let s=0;s<n;s++){const id=S.keepers[s];h+=id?`<div class="kp" tabindex="0"><span class="kg">${KEEPER[id].glyph}</span><div class="kt"><b>${KEEPER[id].name}</b><br>${KEEPER[id].desc}</div></div>`:`<div class="kp empty" title="An empty keeper’s cottage. Hermits in the forest and crates bring keepers."></div>`;}
  el.innerHTML=h;
}

/* ================= village wishes ================= */
function newWish(){
  const opts=[];const met=SPECIES.filter(s=>S.codex[s.id]&&s.crew<=Math.max(1,fishersState.length));
  if(met.length){const sp=met[Math.floor(Math.random()*met.length)];const n=sp.crew<=1?4:sp.crew<=3?2:1;opts.push({kind:'meet',sp:sp.id,n,text:`Meet ${n>1?n+' '+sp.name+'s':'the '+sp.name}`});}
  const lvl=S.wishesDone;
  opts.push({kind:'ship',n:25+15*lvl,text:`Sell ${25+15*lvl} goods, by wagon, barge or market`});
  opts.push({kind:'clear',n:4+lvl,text:`Clear ${4+lvl} tiles of forest`});
  opts.push({kind:'build',id:'flowers',n:3,text:'Plant 3 flower beds'});
  if(!S.counts.woodcutter)opts.push({kind:'build',id:'woodcutter',n:1,text:'Set up a woodcutter at the forest’s edge'});
  if(!S.counts.market)opts.push({kind:'build',id:'market',n:1,text:'Open a market stall by a road'});
  if(!S.counts.workshop&&S.counts.market)opts.push({kind:'build',id:'workshop',n:1,text:'Open a workshop'});
  if(unlocked('lantern'))opts.push({kind:'build',id:'lantern',n:2,text:'Light 2 stone lanterns'});
  if(unlocked('cherry'))opts.push({kind:'build',id:'cherry',n:2,text:'Plant 2 cherry trees'});
  if(S.statueSp)opts.push({kind:'build',id:'statue',n:1,text:'Carve a fish statue'});
  opts.push({kind:'tide',n:4+Math.min(6,lvl),text:`Reach a good tide of ×${(1+TIDE_STEP*(4+Math.min(6,lvl))).toFixed(2)}`});
  opts.push({kind:'build',id:'hut',n:2,text:'Build 2 huts'});
  if(villages.length<2&&hutCount()>=3)opts.push({kind:'village',n:1,text:'Found a new village'});
  if(secrets.some(s=>hintVis.has(s.k)))opts.push({kind:'find',n:1,text:'Uncover something hidden in the forest'});
  const pool=opts.filter(o=>o.kind!==S.lastWish);const w=pool[Math.floor(Math.random()*pool.length)];w.have=0;S.wish=w;S.lastWish=w.kind;renderWish();
}
function wishEvent(kind,d={}){
  const w=S.wish;if(!w||w.kind!==kind)return;
  if(kind==='meet'&&d.sp!==w.sp)return;if(kind==='build'&&d.id!==w.id)return;
  if(kind==='ship')w.have+=d.n||0;else if(kind==='tide')w.have=Math.max(w.have,d.n);else w.have++;
  if(w.have>=w.n){log(`The village’s wish came true: ${w.text.toLowerCase()}.`,'gold');S.wishesDone++;S.wish=null;queueCrate({source:'the village, with thanks',kind:'mixed'});setTimeout(()=>{if(!S.wish)newWish();},12000);}
  renderWish();
}
function renderWish(){const w=S.wish;$('wish').innerHTML=w?`<span class="wk">Village wish</span> ${w.text} <span class="wn">${fmt(Math.min(w.have,w.n))}/${fmt(w.n)}</span>`:'';$('wish').hidden=!w;}

/* ================= named sets ================= */
function near(k,code,r,pred){const i=k%GW,j=(k/GW)|0;const out=[];for(let b=-r;b<=r;b++)for(let a=-r;a<=r;a++){const ni=i+a,nj=j+b;if(!inGrid(ni,nj)||(!a&&!b))continue;const q=idx(ni,nj);if(builds[q]===code&&(!pred||pred(q)))out.push(q);}return out;}
function computeSets(){
  const A={};
  for(let k=0;k<GW*GH;k++){const b=builds[k];if(b===NONE)continue;
    if(b===B.JETTY&&near(k,B.NETS,2).length&&near(k,B.RACK,2).length)A.harbor=true;
    if(b===B.SHOP&&near(k,B.MARKET,3).length&&near(k,B.CLAY,3).length)A.craft=true;
    if(b===B.LANTERN&&near(k,B.LANTERN,2).length&&near(k,B.FLOWERS,2).length&&near(k,B.CHERRY,2).length)A.garden=true;
    if(b===BRIDGE&&near(k,B.LANTERN,1).length>=2)A.lbridge=true;
    if(b===ROAD&&S.meta[k]?.pave==='cobble'&&near(k,B.SHRINE,1).length&&near(k,B.LANTERN,2).length)A.walk=true;
    if(b===B.PIER){const i=k%GW,j=(k/GW)|0;if((bAt(i+1,j)===B.PIER&&bAt(i+2,j)===B.PIER)||(bAt(i,j+1)===B.PIER&&bAt(i,j+2)===B.PIER))A.row=true;}
    if(b===B.STATUE){const sp=new Set([S.meta[k]?.sp]);near(k,B.STATUE,3).forEach(q=>sp.add(S.meta[q]?.sp));if(sp.size>=3)A.statues=true;}
  }
  if(villages.some(v=>v.huts.length>=5&&v.harmony))A.harmony=true;
  S.setsSeen||=[];
  for(const id of Object.keys(A))if(!S.setsSeen.includes(id)){S.setsSeen.push(id);if(booted){sfx('set');toast(`A named place: ${SET[id].name}`,`${SET[id].hint} <b>${SET[id].bonus}</b>`);$('toast').querySelector('.k').textContent='The village has a name for this';}}
  activeSets=A;
}

/* ================= camera ================= */
let tween=null;
function tweenTo(p,z,dur){tween={from:{x:view.t.x,y:view.t.y,z:view.t.z,zoom:view.z},to:{x:p.x,y:p.y??0,z:p.z,zoom:z},t:0,dur};}
function updateCamera(dt){
  if(tween){tween.t+=dt/tween.dur;const k=easeInOut(Math.min(1,tween.t));
    view.t.set(lerp(tween.from.x,tween.to.x,k),lerp(tween.from.y,tween.to.y,k),lerp(tween.from.z,tween.to.z,k));view.z=Math.exp(lerp(Math.log(tween.from.zoom),Math.log(tween.to.zoom),k));
    if(tween.t>=1)tween=null;}
  view.t.x=clamp(view.t.x,-60,60);view.t.z=clamp(view.t.z,-60,46);
  const w=innerWidth,h=innerHeight,a=w/h,zz=view.z;
  camera.left=-zz*a/2;camera.right=zz*a/2;camera.top=zz/2;camera.bottom=-zz/2;camera.updateProjectionMatrix();
  camera.position.copy(view.t).addScaledVector(CAM_DIR,200);camera.lookAt(view.t);camera.updateMatrixWorld();
  U.sunView.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
  // the shadow box follows the view and grows as you zoom out
  const ext=clamp(view.z*.62*Math.max(1,a*.8),22,120);sun.target.position.set(view.t.x,0,view.t.z);sun.position.copy(sun.target.position).addScaledVector(SUN_DIR,140);
  const sc=sun.shadow.camera;if(Math.abs(sc.right-ext)>.5){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.updateProjectionMatrix();}
  sun.target.updateMatrixWorld();
  if(Math.abs(view.z-lastAudioZ)>2){lastAudioZ=view.z;setAudioView(view.z);}
}
let lastAudioZ=0;

/* ================= post / pixel pipeline ================= */
const postMat=new THREE.ShaderMaterial({
  uniforms:{tScene:{value:null},uRes:{value:new THREE.Vector2(1,1)},uTime:U.time},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`uniform sampler2D tScene;uniform vec2 uRes;uniform float uTime;varying vec2 vUv;
  vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
  float bayer4(vec2 p){int x=int(mod(p.x,4.0)),y=int(mod(p.y,4.0));int i=x+y*4;
    float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return m[i]/16.0;}
  void main(){
    vec2 cell=floor(vUv*uRes)+0.5;vec2 uv=cell/uRes;
    vec4 s=texture2D(tScene,uv);float a=clamp(s.a,0.0,1.0);
    vec3 sky=mix(vec3(0.95,0.72,0.52),vec3(0.28,0.45,0.55),smoothstep(0.25,1.05,uv.y));
    sky+=vec3(1.0,0.75,0.5)*0.55*exp(-length((uv-vec2(0.0,0.92))*vec2(1.3,1.0))*2.6);
    vec3 col=mix(sky,s.rgb,a);
    vec3 g=vec3(0.0);vec2 px=1.0/uRes;
    for(int k=0;k<8;k++){float an=float(k)*0.785398;vec2 o=vec2(cos(an),sin(an));
      g+=max(texture2D(tScene,uv+o*px*1.5).rgb-0.9,0.0)+max(texture2D(tScene,uv+o*px*3.5).rgb-0.9,0.0)*0.6;}
    col+=g*0.16;
    col=aces(col*1.05);
    float sh=pow(max(0.0,sin((uv.x*0.8-uv.y)*7.0+uTime*0.025)),10.0);col+=vec3(1.0,0.86,0.62)*sh*0.045;
    col=pow(col,vec3(1.0/2.2));
    col=mix(col,col*vec3(1.03,1.0,0.95),smoothstep(0.4,1.0,dot(col,vec3(0.33))));
    col=mix(col,col*vec3(0.9,1.0,1.04),1.0-smoothstep(0.0,0.4,dot(col,vec3(0.33))));
    float v=smoothstep(1.15,0.35,length((vUv-0.5)*vec2(1.25,1.0)));col*=mix(0.7,1.0,v);
    col=floor(col*40.0+bayer4(cell))/40.0;
    gl_FragColor=vec4(col,1.0);
  }`,depthTest:false,depthWrite:false});
const postScene=new THREE.Scene();const postCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMat));
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);
  const rw=Math.max(160,Math.floor(w/PIX)),rh=Math.max(120,Math.floor(h/PIX));
  if(rt)rt.dispose();rt=new THREE.WebGLRenderTarget(rw,rh,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
  postMat.uniforms.tScene.value=rt.texture;postMat.uniforms.uRes.value.set(rw,rh);
  lineM.linewidth=1;
}
addEventListener('resize',resize);

/* ================= input ================= */
const dv=document.getElementById('dv'),banner=document.getElementById('banner'),tip=document.getElementById('tip');
let tool='look',selected=null,started=false;
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
function groundAt(cx,cy){ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(plane,hit)?hit.clone():null;}
let drag=null;const pointers=new Map();
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  drag={x:e.clientX,y:e.clientY,moved:0,btn:e.button,pinch:pointers.size===2?pinchDist():0,zoom:view.z,paint:started&&e.button===0&&PAINT_TOOLS.has(tool)&&e.pointerType!=='touch'&&!selected,painted:new Set()};
  if(drag.paint)paintAt(e.clientX,e.clientY);});
// paint tools (roads, paving, fences, flowers, remove) lay a line of tiles as you drag
function paintAt(cx,cy){const p=groundAt(cx,cy);if(!p)return;const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);if(!inGrid(i,j))return;const k=idx(i,j);
  if(drag.painted.has(k))return;drag.painted.add(k);
  if(tool==='road'&&builds[k]===ROAD&&drag.painted.size>1)return; // dragging over roads never lifts them
  act(tool,i,j,drag.painted.size>1);hover(cx,cy);}
function pinchDist(){const p=[...pointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
canvas.addEventListener('pointermove',e=>{
  const prev=pointers.get(e.pointerId);if(prev){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});}
  if(drag&&prev){
    if(pointers.size===2&&drag.pinch){const d=pinchDist();view.z=clamp(drag.zoom*drag.pinch/d,ZMIN,ZMAX);drag.moved=99;cancelAuto();}
    else if(drag.paint){drag.moved+=Math.abs(e.clientX-prev.x)+Math.abs(e.clientY-prev.y);paintAt(e.clientX,e.clientY);}
    else{const dx=e.clientX-prev.x,dy=e.clientY-prev.y;drag.moved+=Math.abs(dx)+Math.abs(dy);
      if(drag.moved>6){pan(dx,dy);cancelAuto();}}
  }
  hover(e.clientX,e.clientY);
});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);
  if(drag&&drag.paint&&drag.painted.size)save();
  else if(drag&&drag.moved<=6&&drag.btn===0&&started){click(e.clientX,e.clientY);}
  if(!pointers.size)drag=null;});
canvas.addEventListener('pointerleave',()=>{ptrIn=false;tip.style.display='none';hoverLoop.visible=false;hovered=null;setPreview([]);updateCard();});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.z=clamp(view.z*Math.exp(e.deltaY*.0012),ZMIN,ZMAX);cancelAuto();},{passive:false});
function cancelAuto(){tween=null;if(cine.fish)endCine(false);}
function pan(dx,dy){const upp=view.z/innerHeight;const right=new THREE.Vector3(1,0,-1).normalize(),fwd=new THREE.Vector3(-1,0,-1).normalize();
  view.t.addScaledVector(right,-dx*upp).addScaledVector(fwd,dy*upp/Math.sin(EL));}
const keys=new Set();
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('button')&&e.key===' ')return;
  const k=e.key.toLowerCase();keys.add(k);
  if(k==='q'||k==='escape'){setTool('look');pinned=null;updateCard();}
  if(e.target.closest&&e.target.closest('input'))return;
  const T={'1':'clear','2':'dig','3':'hire','4':'hut','5':'road','6':'bridge','x':'remove'};if(T[k])setTool(T[k]);
  if(k==='b')toggleDrawer();if(k==='t')toggleTrade();if(k==='`'||k==='f9')toggleDebug();
  if(k==='escape'){$('drawer').hidden=true;$('trade').hidden=true;}
  if(k==='c')toggleCodex();if(k==='m')regionMap.toggle();if(k==='='||k==='+')view.z=clamp(view.z/1.2,ZMIN,ZMAX);if(k==='-')view.z=clamp(view.z*1.2,ZMIN,ZMAX);});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function keyPan(dt){const s=520*dt;let dx=0,dy=0;if(keys.has('a')||keys.has('arrowleft'))dx+=s;if(keys.has('d')||keys.has('arrowright'))dx-=s;
  if(keys.has('w')||keys.has('arrowup'))dy+=s;if(keys.has('s')||keys.has('arrowdown'))dy-=s;if(dx||dy){pan(dx,dy);cancelAuto();}}
let hovered=null,pinned=null,lastPtr={x:0,y:0},ptrIn=false;
// screen-space fish picking: walk the (bent) spine in pixels and compare to the body's projected half-width at that point
const _pv=new THREE.Vector3();
function toScreen(x,y,z){_pv.set(x,y,z).project(camera);return {x:(_pv.x+1)/2*innerWidth,y:(1-_pv.y)/2*innerHeight};}
function spinePts(f,n=10){const L=f.sp.len,c=f.u.uCurve.value,ch=Math.cos(f.h),sh=Math.sin(f.h),pts=[];
  for(let s=0;s<=n;s++){const t=s/n,lz=L/2-t*L,xo=c*Math.pow(L*t,2)*.5;pts.push({t,x:f.x+lz*sh+xo*ch,z:f.z+lz*ch-xo*sh});}return pts;}
function pickFish(cx,cy){
  const ppu=innerHeight/view.z;let best=null,bd=Infinity;
  for(const f of fishes){if(f.emerge<.5||f.mat.opacity<.35)continue;
    const pts=spinePts(f).map(p=>({...toScreen(p.x,f.y,p.z),t:p.t}));
    for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1];const vx=b.x-a.x,vy=b.y-a.y,l2=vx*vx+vy*vy||1;
      const u=clamp(((cx-a.x)*vx+(cy-a.y)*vy)/l2,0,1);const d=Math.hypot(cx-a.x-vx*u,cy-a.y-vy*u);
      const t=lerp(a.t,b.t,u);const hw=Math.max(3,profile(f.sp,t)*f.sp.len*f.sp.wid*.5*ppu)+3;
      const nd=d/hw;if(nd<1&&nd<bd){bd=nd;best=f;}}}
  return best;
}
const card=document.getElementById('fishcard');
function stateLine(f){
  if(f.state==='hooked')return `On a barbless line · ${f.hookers.length} of ${f.sp.crew} hands`;
  if(f.state==='held')return 'Held gently at the surface';
  if(f.state==='release'||f.state==='leave')return 'Swimming back to deep water';
  if(f.emerge<1)return 'Rising from below';
  const near=fishersState.filter(fs=>fs.state==='idle'&&distToFish(f,fs.bob.x,fs.bob.z)<1.5+f.sp.len*f.sp.wid*.5).length;
  return near?`Circling the bait · ${near} of ${f.sp.crew} hands waiting`:'Swimming the current';
}
function fishCardHTML(f){
  const sp=f.sp,L=LORE[sp.id],met=S.codex[sp.id]||0,known=met>0,tk=talesKnown(sp.id);
  const row=(k,v)=>`<div class="k">${k}</div><div class="v">${v}</div>`;
  const tale=known?L.tales[tk-1]:L.rumor;
  return `<div class="fc-h"><div class="fc-n">${known?sp.name:'Unknown fish'}</div><div class="fc-s">${stateLine(f)}</div></div>
    ${known?`<div class="fc-ep">${sp.ep}</div>`:''}
    <div class="fc-g">${row('Length',`${Math.round(sp.len*4)} m`)}${row('Age',known?L.age:'?')}${row('Temper',known?L.temper:'?')}${row('Favors',known?L.favors:'?')}
      ${row('Crew',`${sp.crew} hand${sp.crew>1?'s':''}`)}${row('Met',known?`×${met}`:'never')}${row('Scales',fmt(sp.value))}${row('Tales',`${tk} / 3`)}</div>
    <div class="fc-t"><span class="fc-tk">${known?'Tale '+tk:'Rumor'}</span>${tale}</div>
    <div class="fc-f">${pinned===f?'Click anywhere to let go':'Click the fish to follow it'}</div>`;
}
function placeCard(x,y){const w=card.offsetWidth,h=card.offsetHeight;
  let l=x+18,t=y+18;if(l+w>innerWidth-12)l=x-w-18;if(t+h>innerHeight-12)t=innerHeight-h-12;card.style.left=Math.max(12,l)+'px';card.style.top=Math.max(12,t)+'px';}
function showCard(f,x,y){card.innerHTML=fishCardHTML(f);card.hidden=false;placeCard(x,y);}
function updateCard(){
  const f=pinned||hovered;fishes.forEach(o=>{o.rim.value=o===f?2.6:(o.sp.glow?1.4:1.0);});
  if(!f||!fishes.includes(f)){if(pinned&&!fishes.includes(pinned))pinned=null;if(!hovered||!fishes.includes(hovered))card.hidden=true;return;}
  if(pinned){const hd=fishHead(pinned),p=toScreen(hd.x,.3,hd.z);showCard(pinned,p.x,p.y);}
  else showCard(f,lastPtr.x,lastPtr.y);
}
/* ---- placement previews: floating numbers over every tile a placement would touch ---- */
let pvMarks=[];const pvPool=[];
function setPreview(marks){pvMarks=marks;}
function drawPreview(){
  const el=labelsEl;while(pvPool.length<pvMarks.length){const d=document.createElement('div');d.className='pv';el.appendChild(d);pvPool.push(d);}
  pvPool.forEach((d,n)=>{const m=pvMarks[n];if(!m){d.style.display='none';return;}const c=tileC(m.k%GW,(m.k/GW)|0);const p=toScreen(c.x,.35,c.z);
    d.style.display='block';d.style.left=p.x+'px';d.style.top=p.y+'px';if(d.textContent!==m.t)d.textContent=m.t;d.className='pv '+(m.c||'');});
}
function previewFor(tl,i,j){
  const k=idx(i,j),marks=[];let sum='';const ex=boon('reach');
  const fisherTiles=r=>{const out=new Set();for(const fs of fishersState){const q=idx(fs.i,fs.j);if(Math.max(Math.abs(fs.i-i),Math.abs(fs.j-j))<=r)out.add(q);}return [...out];};
  const around=(r,pred)=>{const o=[];for(let b=-r;b<=r;b++)for(let a=-r;a<=r;a++){const ni=i+a,nj=j+b;if(inGrid(ni,nj)&&(a||b)&&pred(idx(ni,nj),ni,nj))o.push(idx(ni,nj));}return o;};
  const charmMarks=(v,r)=>{const hs=around(r+ex,q=>builds[q]===HUT||builds[q]===B.MARKET);hs.forEach(q=>marks.push({k:q,t:`+${v} charm`,c:'ch'}));
    if(hs.length)sum=`+${v} charm on ${hs.length} home${hs.length>1?'s':''} and stall${hs.length>1?'s':''}`;else sum=`+${v} charm around it`;};
  if(!tl.startsWith('b:')){
    if(tl==='pave'){const pv=PAVES[S.pave];sum=`Wagons ×${pv.speed} on this tile`+(pv.charm?' · +1 charm':'');}
    return {marks,sum};}
  const id=tl.slice(2),d=DEFS[id];
  if(id==='woodcutter'){const w=around(1,q=>tiles[q]===WILD);const per=.9*(1+.25*boon('wood'))*(has('garrow')?1.6:1)*(1+(prodBoost[B.WOOD][k]||0));
    w.forEach(q=>marks.push({k:q,t:'+'+per.toFixed(1),c:'tm'}));sum=`+${(per*w.length).toFixed(1)} timber / min`;}
  else if(id==='reedbed'){const w=around(1,(q,ni,nj)=>(ni===i||nj===j)&&tiles[q]===WATER&&!FLOW.live[q]);const m=(1+.25*boon('reed'))*(has('wren')?2:1);
    w.forEach(q=>marks.push({k:q,t:'+'+(.7*m).toFixed(1),c:'rd'}));sum=`+${((2.5+.7*w.length)*m).toFixed(1)} reeds / min`;}
  else if(id==='claypit'){const r=2*(deposit[k]?3:1)*(1+.25*boon('clay'))*(has('kiln')?1.25:1)*(1+(prodBoost[B.CLAY][k]||0));marks.push({k,t:deposit[k]?'red seam ×3':'+'+r.toFixed(1),c:'cl'});sum=`+${r.toFixed(1)} clay / min`;}
  else if(id==='market'){sum=`Prices here ×${(1.5*(1+charm[k]/30)).toFixed(2)} (charm ${charm[k].toFixed(1)})`;}
  else if(id==='jetty'){sum=`Keeps a barge · pays ×${(price('timber','barge')/GOODS.timber.price).toFixed(2)} a wagon’s prices`;}
  else if(id==='nets'){fisherTiles(2+ex).forEach(q=>marks.push({k:q,t:'+25% reel',c:'fx'}));sum='Fishers within 2 reel 25% faster';}
  else if(id==='rack'){fisherTiles(2+ex).forEach(q=>marks.push({k:q,t:'+20% scales',c:'fx'}));sum='Fish met within 2 shed 20% more';}
  else if(id==='statue'){const fx=STATUE_FX[S.statueSp]||{},r=(fx.r||2)+ex;
    if(fx.bite||fx.reel||fx.scale)fisherTiles(r).forEach(q=>marks.push({k:q,t:fx.bite?`+${fx.bite*100}% bites`:fx.reel?`+${fx.reel*100}% reel`:`+${fx.scale*100}% scales`,c:'fx'}));
    if(fx.prod)for(const [c,v] of Object.entries(fx.prod))around(r,q=>builds[q]===+c).forEach(q=>marks.push({k:q,t:`+${v*100}%`,c:'fx'}));
    sum=`Nearby, ${fx.txt||''}`;}
  if(d.charm&&id!=='statue'){const keep=sum;charmMarks(d.charm[0],d.charm[1]);if(keep)sum=keep+` · +${d.charm[0]} charm`;}
  else if(id==='statue'){around(2+ex,q=>builds[q]===HUT||builds[q]===B.MARKET).forEach(q=>marks.push({k:q,t:'+4 charm',c:'ch'}));}
  return {marks,sum};
}
function vehicleLine(v){const nm=v.kind==='wagon'?'Wagon':'Barge';
  if(v.state==='stuck')return v.kind==='wagon'?`${nm}: no road to the Pilgrim Way`:`${nm}: no flowing water out to the east edge`;
  if(v.state==='load')return `${nm} loading · ${fmt(Math.min(v.ready||0,capacity(v.kind)))} / ${capacity(v.kind)} ready`;
  if(v.state==='out')return `${nm} on its way out · ${trade.load(v)} goods`;
  if(v.state==='away')return `${nm} away ${v.kind==='wagon'?'up the Way':'downriver'} · back in ${Math.ceil(v.t)}s`;
  return `${nm} coming home`;}
function hover(cx,cy){
  lastPtr={x:cx,y:cy};ptrIn=true;
  const p=groundAt(cx,cy);if(!p){hoverLoop.visible=false;tip.style.display='none';return;}
  const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);
  hovered=cine.fish?null:pickFish(cx,cy);canvas.style.cursor=hovered?'pointer':'crosshair';
  let html='';
  if(!inGrid(i,j)){hoverLoop.visible=false;setPreview([]);}
  else{const c=tileC(i,j),k=idx(i,j),t=tiles[k],b=builds[k];hoverLoop.visible=true;
    hoverLoop.position.set(c.x,(t===WATER?(b===BRIDGE?DECK_Y:WATER_Y):heightAt(c.x,c.z))+.03,c.z);
    const useTool=selected?'move':tool;
    if(useTool!=='look'){const r=canDo(useTool,i,j),cur=COST[useTool]||'scales';
      const cobj=r.cost||r.refund||(r.c?{[cur]:r.c}:null);
      hoverLoop.material.color.set(r.ok&&(!cobj||r.refund||afford(cobj))?(useTool==='remove'?'#e9a07a':'#ffe6b0'):'#e98a5f');
      const names={clear:'Clear land',dig:'Dig water',hire:'Hire fisher',move:'Move fisher here',hut:r.restyle?`Restyle as ${STYLES[S.hutStyle].name.toLowerCase()}`:`Build a ${STYLES[S.hutStyle].name.toLowerCase()} hut`,road:r.lift?'Lift this road':'Lay road',bridge:'Build a bridge',pave:`Pave with ${PAVES[S.pave].name.toLowerCase()}`,remove:'Remove'};
      const nm=useTool.startsWith('b:')?(useTool==='b:statue'?`Statue of the ${SP[S.statueSp]?.name||'…'}`:DEFS[useTool.slice(2)].name):names[useTool];
      html=`<div>${nm}${r.ok&&cobj&&Object.keys(cobj).length?` · ${r.refund?'<span class="dim">gives back</span> ':''}${costHTML(cobj)}`:''}</div>`+(r.ok?'':`<div class="bad">${r.why}</div>`);
      if(useTool==='dig'&&r.ok)html+=`<div class="dim">Water only lives if the current runs through it</div>`;
      if(useTool==='clear'&&r.ok)html+=`<div class="dim">+${3+(has('garrow')?3:0)} timber</div>`;
      const pv=r.ok?previewFor(useTool,i,j):null;setPreview(pv?pv.marks:[]);if(pv?.sum)html+=`<div class="pvs">${pv.sum}</div>`;}
    else{hoverLoop.material.color.set('#ffe6b0');setPreview([]);const d=DEF_BY_CODE[b];
      if(b===HUT){const lk=linkedHuts().some(h=>h.k===k),vn=S.hutVillage[k],v=villages.find(v=>v.name===vn),st=STYLES[S.meta[k]?.style||'thatch'].name;
        html=`<div>${vn?`A ${st.toLowerCase()} hut in ${vn}`:`A ${st.toLowerCase()} hut`} · houses ${HOUSING} fishers</div><div class="${lk?'dim':'bad'}">${lk?'Pilgrims visit by the Way':'Not joined to the Pilgrim Way'}</div>`+
        (v?`<div class="dim">Charm ${villageCharm(v).toFixed(1)}${v.harmony?' · in harmony':''}</div>`:'');}
      else if(d&&b!==BRIDGE&&b!==ROAD){html=`<div>${d.name}${b===B.STATUE?' · '+(SP[S.meta[k]?.sp]?.name||''):''}</div>`;
        const p=producers.find(p=>p.k===k);
        if(p)html+=`<div class="dim">${p.good==='craft'?`${p.rate.toFixed(1)} crafts / min`:`${p.rate.toFixed(1)} ${GOODS[p.good].name.toLowerCase()} / min`}</div>`;
        if(b===B.STATUE)html+=`<div class="dim">Nearby, ${STATUE_FX[S.meta[k]?.sp]?.txt||''}</div>`;
        else if(b===B.MARKET)html+=`<div class="dim">Prices ×${marketMult(k).toFixed(2)} · charm ${charm[k].toFixed(1)}</div>`;
        else if(b===B.POST||b===B.JETTY){const v=trade.vehicles.find(v=>v.home===k);if(v)html+=`<div class="${v.state==='stuck'?'bad':'dim'}">${vehicleLine(v)}</div>`;}
        else if(!p)html+=`<div class="dim">${d.desc}</div>`;}
      else if(t===WATER){const sp=FLOW.speed[k];
        if(!FLOW.live[k])html=`<div>Still water</div><div class="bad">The current doesn’t reach here. Nothing lives in it.</div><div class="dim">Reeds grow well here</div>`;
        else{const cp=comps[COMP[k]];html=`<div>${b===BRIDGE?'Bridge over ':''}Flowing water · <span class="c">${cp.size}</span> tiles</div><div class="dim">Current ${sp>1.1?'quick':sp>.5?'steady':'gentle'} · open water up to ${cp.maxD*2-1} wide</div>`;}
        if(fishersOn(i,j).length)html+=`<div class="dim">${fishersOn(i,j).length} fisher${fishersOn(i,j).length>1?'s':''} here · click to move one</div>`;}
      else if(fishersOn(i,j).length)html=`<div>${fishersOn(i,j).length} fisher${fishersOn(i,j).length>1?'s':''}</div><div class="dim">Click to move one</div>`;
      else if(b===ROAD)html=`<div>${i===WAY_I&&j===0?'The Pilgrim Way':PAVES[S.meta[k]?.pave||'dirt'].name+' road'}</div>`;
      else if(t===WILD&&hintVis.has(k))html=`<div>Forest</div><div class="gold">${SECRET_TYPES[secretAt[k].type].hintTxt}</div>`;
      else if(t===WILD&&deposit[k])html=`<div>Forest</div><div class="gold">${SECRET_TYPES.clay.hintTxt}</div>`;
      if(charm[k]>0&&t===LAND&&html)html+=`<div class="dim">Charm ${charm[k].toFixed(1)}</div>`;}
  }
  if(hovered||pinned){tip.style.display='none';updateCard();return;}
  card.hidden=true;
  if(html){tip.innerHTML=html;tip.style.display='block';tip.style.left=Math.min(cx,innerWidth-250)+'px';tip.style.top=Math.min(cy,innerHeight-80)+'px';}else tip.style.display='none';
}
function click(cx,cy){
  if(pinned){pinned=null;updateCard();if(tool==='look'&&!selected)return;}
  if(tool==='look'&&!selected){const f=pickFish(cx,cy);if(f){pinned=f;updateCard();return;}}
  const p=groundAt(cx,cy);if(!p)return;const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);
  if(selected){const r=canDo('move',i,j);
    if(r.ok&&!(selected.i===i&&selected.j===j)){selected.i=i;selected.j=j;selected.slot=freeSlot(i,j);placeFisher(selected);sparkle(selected.x,.3,selected.z,'#ffe9bf');save();}
    else if(!r.ok)log(r.why+'.','warn');
    selected=null;selRing.visible=false;updateMarks();return;}
  if(tool==='look'){if(!inGrid(i,j))return;const on=fishersOn(i,j).filter(f=>f.state==='idle');
    if(on.length){selected=on[on.length-1];selRing.visible=true;updateMarks();log('Pick a spot at the water’s edge, or a bridge, for this fisher.');}return;}
  act(tool,i,j);hover(cx,cy);
}
function setTool(t){tool=t;selected=null;selRing.visible=false;setPreview([]);tip.style.display='none';
  document.querySelectorAll('.tool').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t||(b.dataset.tool==='build'&&(t.startsWith('b:')||t==='pave')))));
  document.querySelectorAll('#drawer .item').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));updateMarks();}
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tool==='build'){toggleDrawer();return;}setTool(b.dataset.tool);}));
function updateMarks(){
  const useTool=selected?'move':tool;let n=0;
  if(useTool!=='look'){for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){{const r=canDo(useTool,i,j);if(!r.ok||r.lift)continue;}const c=tileC(i,j);const t=tiles[idx(i,j)];
    p4.set(c.x,(t===WATER?WATER_Y:heightAt(c.x,c.z))+.04,c.z);m4.makeTranslation(p4.x,p4.y,p4.z);marks.setMatrixAt(n++,m4);}}
  marks.count=n;marks.instanceMatrix.needsUpdate=true;
}

/* ================= UI ================= */
const $=id=>document.getElementById(id);
const logEl=$('log');
function log(msg,cls=''){const li=document.createElement('li');li.textContent=msg;if(cls)li.className=cls;logEl.appendChild(li);
  while(logEl.children.length>5)logEl.firstChild.remove();setTimeout(()=>li.classList.add('old'),9000);setTimeout(()=>li.remove(),10600);}
const labelsEl=$('labels');
function popAt(x,z,text,cls=''){if(!started)return;const v=new THREE.Vector3(x,.2,z).project(camera);const el=document.createElement('div');el.className='pop '+cls;el.textContent=text;
  el.style.left=((v.x+1)/2*innerWidth)+'px';el.style.top=((1-v.y)/2*innerHeight)+'px';labelsEl.appendChild(el);setTimeout(()=>el.remove(),2700);}
const labelPool=new Map();
function updateLabels(){
  const want=new Set();
  for(const f of fishes){const show=f.state==='hooked'||f.state==='held'||(cine.fish===f&&cine.t>2);if(!show||f===pinned)continue;want.add(f);
    let el=labelPool.get(f);if(!el){el=document.createElement('div');el.className='lbl';el.innerHTML='<div class="nm"></div><div class="sub"></div><div class="pb"><i></i></div>';labelsEl.appendChild(el);labelPool.set(f,el);}
    const hd=fishHead(f);const v=new THREE.Vector3(hd.x,.4,hd.z).project(camera);
    el.style.left=((v.x+1)/2*innerWidth)+'px';el.style.top=((1-v.y)/2*innerHeight)+'px';
    el.querySelector('.nm').textContent=f.sp.name;
    el.querySelector('.sub').textContent=f.state==='hooked'?`${f.hookers.length} of ${f.sp.crew} hands on the line`:f.state==='held'?'Released with thanks':`About ${Math.round(f.sp.len*4)} m`;
    el.querySelector('.pb').style.display=f.state==='hooked'?'block':'none';el.querySelector('.pb i').style.width=(f.progress*100).toFixed(1)+'%';}
  for(const [f,el] of labelPool)if(!want.has(f)){el.remove();labelPool.delete(f);}
  // village names float over their huts
  for(const v of villages){let el=villageLbl.get(v.name);if(!el){el=document.createElement('div');el.className='vlbl';el.textContent=v.name;labelsEl.appendChild(el);villageLbl.set(v.name,el);}
    const p=toScreen(v.cx,.9,v.cz);el.style.left=p.x+'px';el.style.top=p.y+'px';}
  for(const [n,el] of villageLbl)if(!villages.some(v=>v.name===n)){el.remove();villageLbl.delete(n);}
}
const villageLbl=new Map();
function incomeRate(){const now=Date.now();S.income=S.income.filter(([t])=>now-t<15*60e3);if(!S.income.length)return 0;
  const span=Math.max(120e3,now-S.income[0][0]);return S.income.reduce((s,[,v])=>s+v,0)/(span/60e3);}
function nextGoal(){
  const sp=SPECIES.find(s=>!S.codex[s.id]);if(!sp)return 'Every fish of the valley has been met. Keep listening: there are tales still untold.';
  const best=comps.reduce((a,c)=>c.size>a.size?c:a,{size:0,maxD:0});const parts=[];
  if(fishersState.length<sp.crew)parts.push(housing()<sp.crew?`<b>${sp.crew} fishers</b> (and huts to house them)`:`<b>${sp.crew} fishers</b>`);
  if(best.size<sp.minWater)parts.push(`<b>${sp.minWater} tiles</b> of flowing water`);
  if(best.maxD<sp.needD)parts.push(`open water <b>${sp.needD*2-1} tiles wide</b>`);
  const nm=sp.crew<=2?sp.name:'Something larger';
  let g=!parts.length?`${nm} can surface now. Keep <b>${sp.crew}</b> fisher${sp.crew>1?'s':''} together on one bank and wait.`:`${nm} needs ${parts.join(', ')}.`;
  if(stillCount>0)g+=`<div class="still">${stillCount} tile${stillCount>1?'s':''} of still water. The current doesn’t reach ${stillCount>1?'them':'it'}.</div>`;
  return g;
}
let lastGoal='';
function refreshUI(){
  $('scales').textContent=fmt(S.scales);$('silver').textContent=fmt(S.silver);
  const r=incomeRate(),sr=silverIncomeRate(),lh=linkedHuts().length;
  $('rate').textContent=`${r>0?`~${r<10?r.toFixed(1):fmt(r)} scales / min`:'No fish met yet'} · ${sr>0?`~${sr<10?sr.toFixed(1):fmt(sr)} silver / min from trade`:'no trade yet'}`;
  $('housing').textContent=`${fishersState.length} / ${housing()} fishers housed · ${hutCount()} hut${hutCount()>1?'s':''}${lh<hutCount()?` (${lh} on the Way)`:''} · ${allTales()} tale${allTales()===1?'':'s'} told`;
  $('goods').innerHTML=GOOD_IDS.map(g=>{const rt=goodRate(g);return `<span class="gd" title="${GOODS[g].name}${rt?` · +${rt.toFixed(1)} / min`:''}"><i style="background:${GOODS[g].col}"></i>${fmt(S.goods[g]||0)}<em>${GOODS[g].name.toLowerCase()}</em></span>`;}).join('');
  const tl=tideWindow()-(Date.now()-S.tide.t);$('tide').hidden=!(S.tide.n>0&&tl>0);if(S.tide.n>0&&tl>0)$('tide').innerHTML=`Good tide <b>×${(1+TIDE_STEP*S.tide.n).toFixed(2)}</b><span class="tb"><i style="width:${(tl/tideWindow()*100).toFixed(0)}%"></i></span>`;
  const g=nextGoal();if(g!==lastGoal){$('goal').innerHTML=g;lastGoal=g;}
  for(const t of ['clear','dig','hire','hut','road','bridge']){const c=cost[t]();$('c-'+t).textContent=fmt(c);$('tool-'+t).classList.toggle('poor',S[COST[t]]<c);}
  $('cLine').textContent=fmt(cost.line());$('cBait').textContent=fmt(cost.bait());$('lvLine').textContent='Lv '+S.lineLv;$('lvBait').textContent='Lv '+S.baitLv;
  $('upLine').disabled=S.silver<cost.line();$('upBait').disabled=S.silver<cost.bait();
  $('codexCount').textContent=`${SPECIES.filter(s=>S.codex[s.id]).length}/${SPECIES.length}`;
  const busy=trade.vehicles.filter(v=>v.state!=='load'&&v.state!=='stuck').length;$('tradeN').textContent=`${busy}/${trade.vehicles.length}`;
  if(!$('trade').hidden)renderTrade();
  if(!$('drawer').hidden)updateDrawerCosts();
}
function silverIncomeRate(){const now=Date.now();S.sIncome=S.sIncome.filter(([t])=>now-t<15*60e3);if(!S.sIncome.length)return 0;
  const span=Math.max(180e3,now-S.sIncome[0][0]);return S.sIncome.reduce((s,[,v])=>s+v,0)/(span/60e3);}

/* ---- the build drawer ---- */
let drawerTab='work';
function toggleDrawer(){const d=$('drawer');d.hidden=!d.hidden;if(!d.hidden){$('trade').hidden=true;renderDrawer();}}
function drawerItems(){
  if(drawerTab==='sets')return null;
  if(drawerTab==='style'){
    const it=[];
    for(const id of STYLE_IDS){const st=STYLES[id],lk=st.lock&&!unlocked('style:'+id);it.push({tool:'hut',key:'style:'+id,name:`${st.name} huts`,desc:lk?'Needs a blueprint.':'Build new huts in this style, or click a hut to restyle it (3 timber). Five or more alike make a village harmonious.',lock:lk,on:()=>{S.hutStyle=id;},sel:()=>tool==='hut'&&S.hutStyle===id,swatch:st.roof[0]});}
    for(const id of PAVE_IDS){if(id==='dirt')continue;const pv=PAVES[id],lk=pv.lock&&!unlocked('pave:'+id);
      it.push({tool:'pave',key:'pave:'+id,name:`${pv.name} paving`,desc:lk?'Needs a blueprint.':`Drag along roads. Wagons ×${pv.speed}${pv.charm?', +1 charm':''}.`,lock:lk,cost:pv.cost,on:()=>{S.pave=id;},sel:()=>tool==='pave'&&S.pave===id,swatch:pv.col});}
    return it;}
  const it=[];
  for(const [id,d] of Object.entries(DEFS)){if(d.cat!==drawerTab)continue;
    if(id==='statue'){const met=SPECIES.filter(s=>S.codex[s.id]);
      if(!met.length)it.push({tool:'b:statue',key:'statue',name:'Fish statue',desc:'Meet a fish first. Statues are carved after fish you have met.',lock:true});
      for(const sp of met)it.push({tool:'b:statue',key:'statue:'+sp.id,name:`${sp.name} statue`,desc:`Nearby, ${STATUE_FX[sp.id].txt}. +4 charm.`,cost:buildCost('statue'),on:()=>{S.statueSp=sp.id;},sel:()=>tool==='b:statue'&&S.statueSp===sp.id});
      continue;}
    it.push({tool:'b:'+id,key:id,name:d.name,desc:defLocked(id)?'Needs a blueprint. Crates and forest finds bring them.':d.desc,lock:defLocked(id),cost:buildCost(id),paint:d.paint});}
  return it;
}
function renderDrawer(){
  const d=$('drawer');if(d.hidden)return;
  $('drawerTabs').innerHTML=[...CATS,{id:'sets',name:`Named places ${(S.setsSeen||[]).length}/${SETS.length}`}].map(c=>`<button type="button" class="tab" data-tab="${c.id}" aria-pressed="${c.id===drawerTab}">${c.name}</button>`).join('');
  d.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{drawerTab=b.dataset.tab;renderDrawer();}));
  const box=$('drawerItems');const items=drawerItems();
  if(!items){box.innerHTML=SETS.map(s=>{const seen=(S.setsSeen||[]).includes(s.id);return `<div class="set ${seen?'seen':''} ${activeSets[s.id]?'on':''}"><div class="sn">${seen?s.name:'Unnamed place'}</div><div class="sd">${s.hint}</div><div class="sb">${s.bonus}${seen&&!activeSets[s.id]?' <span class="dim">(not standing right now)</span>':''}</div></div>`;}).join('');return;}
  box.innerHTML='';drawerItemsCache=items;
  items.forEach((x,n)=>{const b=document.createElement('button');b.type='button';b.className='item'+(x.lock?' locked':'');b.dataset.tool=x.tool;b.dataset.n=n;
    b.setAttribute('aria-pressed',String(x.sel?x.sel():tool===x.tool));
    b.innerHTML=`<div class="in">${x.swatch?`<i class="sw" style="background:${x.swatch}"></i>`:''}${x.name}${x.lock?' <span class="lk">locked</span>':''}${x.paint?' <span class="pt">drag</span>':''}</div><div class="ic">${x.cost?costHTML(x.cost):''}</div><div class="id">${x.desc}</div>`;
    b.addEventListener('click',()=>{if(x.lock){sfx('no');return;}x.on&&x.on();setTool(x.tool);renderDrawer();});box.appendChild(b);});
}
let drawerItemsCache=[];
function updateDrawerCosts(){$('drawerItems').querySelectorAll('.item').forEach(b=>{const x=drawerItemsCache[+b.dataset.n];if(x?.cost){const c=x.tool.startsWith('b:')?buildCost(x.tool.slice(2)):x.cost;const h=costHTML(c);const ic=b.querySelector('.ic');if(ic.innerHTML!==h)ic.innerHTML=h;}});}

/* ---- the trade ledger ---- */
function toggleTrade(){const d=$('trade');d.hidden=!d.hidden;if(!d.hidden){$('drawer').hidden=true;renderTrade();}}
function renderTrade(){
  const g=GOOD_IDS.map(id=>`<tr><td><i class="sw" style="background:${GOODS[id].col}"></i>${GOODS[id].name}</td><td class="n">${fmt(S.goods[id]||0)}</td><td class="n dim">${goodRate(id)?'+'+goodRate(id).toFixed(1)+'/min':''}</td>
    <td class="n dim">${price(id,'wagon').toFixed(0)} · ${price(id,'barge').toFixed(0)}</td><td class="rs">${GOODS[id].raw?`<button type="button" data-g="${id}" data-d="-2">−</button><span>${S.reserve[id]}</span><button type="button" data-g="${id}" data-d="2">+</button>`:''}</td></tr>`).join('');
  const vs=trade.vehicles.length?trade.vehicles.map(v=>`<li class="${v.state==='stuck'?'bad':''}">${vehicleLine(v)}</li>`).join(''):'<li class="dim">No trading posts or jetties yet. Build them from Build → Work & trade.</li>';
  const os=(S.orders||[]).map(o=>`<li><div><b>${o.regionName}</b> wants <b>${o.qty} ${GOODS[o.good].name.toLowerCase()}</b> <span class="dim">by ${o.route==='north'?'wagon':'barge'}</span></div><div class="ob"><i style="width:${(o.got/o.qty*100).toFixed(0)}%"></i></div><div class="dim">${o.got}/${o.qty} · pays +${fmt(o.reward)} silver and a crate</div></li>`).join('');
  $('tradeBody').innerHTML=`<table><thead><tr><th>Goods</th><th class="n">Stock</th><th class="n">Made</th><th class="n">Wagon · barge</th><th>Keep back</th></tr></thead><tbody>${g}</tbody></table>
    <p class="dim small">Workshops use reeds, clay and timber first; wagons and barges take what is above the keep-back amount.</p>
    <h4>Wagons &amp; barges</h4><ul class="vs">${vs}</ul><h4>Orders from along the river</h4><ul class="os">${os}</ul>`;
  $('tradeBody').querySelectorAll('.rs button').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.g;S.reserve[g]=clamp(S.reserve[g]+ +b.dataset.d,0,200);renderTrade();save();}));
}
$('upLine').title='Crews bring fish in 30% faster per level';$('upBait').title='Rice and song left at the water: fish arrive and take the line 25% more often per level';
$('upLine').addEventListener('click',()=>{if(spend(cost.line(),'silver')){S.lineLv++;log(`Braided lines, level ${S.lineLv}. Crews bring fish in faster.`);refreshUI();save();}});
$('upBait').addEventListener('click',()=>{if(spend(cost.bait(),'silver')){S.baitLv++;log(`Offerings, level ${S.baitLv}. Fish come to the banks more often.`);refreshUI();save();}});
function toggleCodex(){const c=$('codex');c.hidden=!c.hidden;if(!c.hidden)renderCodex();}
$('btnCodex').addEventListener('click',toggleCodex);$('codexClose').addEventListener('click',toggleCodex);
const regionMap=initMap($('map'));
$('btnMap').addEventListener('click',()=>regionMap.toggle());
$('btnTrade').addEventListener('click',toggleTrade);$('tradeClose').addEventListener('click',toggleTrade);$('mapClose').addEventListener('click',()=>regionMap.toggle());
$('btnIn').addEventListener('click',()=>{view.z=clamp(view.z/1.3,ZMIN,ZMAX);cancelAuto();});
$('btnOut').addEventListener('click',()=>{view.z=clamp(view.z*1.3,ZMIN,ZMAX);cancelAuto();});
$('btnPix').addEventListener('click',()=>{PIX=PIX===3?2:PIX===2?4:3;$('btnPix').textContent='Pixels ×'+PIX;resize();store.set('deepvale-pix',String(PIX));});
const thumbCache={};
function renderCodex(){
  const L=$('codexList');L.innerHTML='';const best=comps.reduce((a,c)=>c.size>a.size?c:a,{size:0,maxD:0});
  for(const sp of SPECIES){const met=S.codex[sp.id]||0,known=met>0,lo=LORE[sp.id],tk=talesKnown(sp.id);const e=document.createElement('div');e.className='entry'+(known?'':' unknown');
    const cv=document.createElement('canvas');cv.width=72;cv.height=24;drawThumb(cv,sp,known);
    const ok=(c)=>c?'ok':'';
    const tales=lo.tales.map((t,n)=>n<tk?`<li>${t}</li>`:`<li class="locked">${known?`Meet it ${TALE_AT[n]-met} more time${TALE_AT[n]-met>1?'s':''} to hear this tale.`:'Untold.'}</li>`).join('');
    e.innerHTML=`<div></div><div><div class="en">${known?sp.name:'Unknown'}</div><div class="ee">${known?sp.ep:`Something about ${Math.round(sp.len*4)} m long has been seen in the river. ${lo.rumor}`}</div>
      ${known?`<div class="es">${lo.temper} · ${lo.age} · favors ${lo.favors.toLowerCase()}</div>`:''}
      <div class="er"><span class="${ok(fishersState.length>=sp.crew)}">Crew ${sp.crew}</span><span class="${ok(best.size>=sp.minWater)}">Flowing ${sp.minWater}+</span><span class="${ok(best.maxD>=sp.needD)}">Width ${sp.needD*2-1}+</span>${known?`<span>Met ×${met}</span>`:''}</div>
      ${known?`<ol class="tales">${tales}</ol>`:''}</div>`;
    e.firstChild.appendChild(cv);L.appendChild(e);}
}
function drawThumb(cv,sp,known){
  const g=cv.getContext('2d');const src=thumbCache[sp.id]||(thumbCache[sp.id]=fishCanvases(sp).c);const sg=src.getContext('2d');const data=sg.getImageData(0,0,64,32).data;
  const bodyL=58,tailL=12,cy=12,maxW=Math.min(11,sp.wid*bodyL*.9);
  for(let x=0;x<bodyL;x++){const t=x/bodyL;const w=Math.max(1,profile(sp,t)*maxW);
    for(let y=Math.round(cy-w);y<=Math.round(cy+w);y++){const sx=Math.floor(t*60),sy=Math.round(8+(y-cy)/w*6);const k=(sy*64+sx)*4;
      g.fillStyle=known?`rgb(${data[k]},${data[k+1]},${data[k+2]})`:'#24332e';g.fillRect(bodyL+tailL-1-x,y,1,1);}}
  for(let x=0;x<tailL;x++){const w=x/tailL*maxW*1.1*(sp.eel?.3:1);g.fillStyle=known?sp.fin:'#24332e';g.fillRect(tailL-1-x,Math.round(cy-w),1,Math.max(1,Math.round(w*2)));}
}

document.getElementById('btnSound').addEventListener('click',()=>setSound(!isSoundOn()));

/* ================= save / load / offline ================= */
const SAVE_KEY='deepvale-save-v1';
function save(){S.t=Date.now();S.tiles=Array.from(tiles);S.builds=Array.from(builds);S.fishers=fishersState.map(f=>({i:f.i,j:f.j,slot:f.slot,c:f.color}));store.set(SAVE_KEY,JSON.stringify(S));}
let migrated='';
function load(){
  const raw=store.get(SAVE_KEY);if(!raw)return false;
  try{const d=JSON.parse(raw);if(!d.tiles)return false;
    // 0.1 saves had one currency (silver from selling fish): it becomes scales
    if(d.scales===undefined){d.scales=d.coins||0;d.silver=10;delete d.coins;migrated='0.1';}
    const oldGrid=d.tiles.length===OLD_GW*OLD_GH;
    if(!oldGrid&&d.tiles.length!==GW*GH)return false;
    const rawTiles=d.tiles,rawBuilds=d.builds,rawHV=d.hutVillage||{},rawFishers=d.fishers||[];
    delete d.tiles;delete d.builds;
    for(const key of ['goods','reserve','boons','unlocked','counts','meta','tide'])if(d[key])d[key]={...S[key],...d[key]};
    Object.assign(S,d);
    if(oldGrid){
      // 0.2 valley (28×20): lay it into the middle of the bigger valley. Tile centres keep their world position.
      initTiles();builds.fill(NONE);const hv={};
      for(let j=0;j<OLD_GH;j++)for(let i=0;i<OLD_GW;i++){const k=idx(i+OLD_OFF_I,j+OLD_OFF_J),o=j*OLD_GW+i;tiles[k]=rawTiles[o];builds[k]=rawBuilds&&rawBuilds.length===rawTiles.length?rawBuilds[o]:NONE;
        if(rawHV[o])hv[k]=rawHV[o];}
      S.hutVillage=hv;S.fishers=rawFishers.map(f=>({...f,i:f.i+OLD_OFF_I,j:f.j+OLD_OFF_J}));
      if(!rawBuilds||rawBuilds.length!==rawTiles.length){initBuilds();}
      else{ // the Pilgrim Way now starts further north
        for(let j=0;j<OLD_OFF_J;j++){const k=idx(WAY_I,j);tiles[k]=LAND;builds[k]=ROAD;}
        let best=-1,bd=1e9;for(let k=0;k<GW*GH;k++){const i=k%GW,j=(k/GW)|0;if(tiles[k]===LAND&&builds[k]===NONE&&nbLinkStrict(i,j)){const dd=Math.hypot(i-WAY_I,j-OLD_OFF_J-2);if(dd<bd){bd=dd;best=k;}}}
        if(best>=0)builds[best]=B.POST;}
      for(let k=0;k<GW*GH;k++)if(builds[k]===HUT)S.meta[k]={style:'thatch'};
      S.goods.timber+=20;migrated=migrated||'0.2';
    }else{tiles.set(rawTiles);if(rawBuilds&&rawBuilds.length===GW*GH)builds.set(rawBuilds);else initBuilds();S.fishers=rawFishers;}
    return true;}catch(e){console.error(e);return false;}
}
function offlineGain(ms){
  if(ms<60e3)return;const hrs=Math.min(ms,8*3600e3),m=hrs/60e3;
  const g=Math.floor(incomeRate()*m*.6),sv=Math.floor(silverIncomeRate()*m*.6);
  const made={};for(const id of ['timber','reeds','clay']){const q=Math.floor(goodRate(id)*m*.6);if(q>0){S.goods[id]+=q;made[id]=q;}}
  if(g<=0&&sv<=0&&!Object.keys(made).length)return;
  S.scales+=g;S.earned+=g;S.silver+=sv;
  $('awayV').textContent=[g>0?'+'+fmt(g)+' scales':'',sv>0?'+'+fmt(sv)+' silver':'',...Object.entries(made).map(([id,q])=>'+'+fmt(q)+' '+GOODS[id].name.toLowerCase())].filter(Boolean).join('  ·  ');
  const mm=Math.round(m);$('awayD').textContent=`Your crews kept watch for ${mm>=120?Math.round(mm/60)+' hours':mm+' minutes'}, and the wagons kept rolling.`;
  $('away').hidden=false;setTimeout(()=>{$('away').hidden=true;},7000);
}
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();save();}else if(hiddenAt){offlineGain(Date.now()-hiddenAt);hiddenAt=0;refreshUI();}});
addEventListener('pagehide',save);

/* ================= debug tools ================= */
// ` or F9 opens it in dev builds, or in any build with ?debug in the address
const DEBUG_OK=import.meta.env.DEV||/[?&]debug\b/.test(location.search);
function toggleDebug(){if(!DEBUG_OK)return;const d=$('debug');d.hidden=!d.hidden;if(!d.hidden)renderDebug();}
function renderDebug(){
  const d=$('debug');const spOpts=SPECIES.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  d.innerHTML=`<div class="dh">Debug <span class="dim">(\` to close)</span></div>
  <div class="dg"><span>Time</span>${[1,2,4,8,16].map(n=>`<button type="button" data-ts="${n}" aria-pressed="${timeScale===n}">×${n}</button>`).join('')}</div>
  <div class="dg"><button type="button" data-a="frenzy" aria-pressed="${debugFlags.frenzy}">Fish frenzy</button><button type="button" data-a="hints" aria-pressed="${debugFlags.allHints}">Show all hints</button></div>
  <div class="dg"><span>Give</span><button type="button" data-a="scales">+1k scales</button><button type="button" data-a="silver">+1k silver</button><button type="button" data-a="goods">+100 goods</button><button type="button" data-a="rich">+100k all</button></div>
  <div class="dg"><span>Fish</span><select id="dbgSp">${spOpts}</select><button type="button" data-a="spawn">Spawn</button><button type="button" data-a="meet">Meet all ×12</button></div>
  <div class="dg"><span>Crates</span><button type="button" data-a="crate">Crate</button><button type="button" data-a="hermit">Keeper</button><button type="button" data-a="unlock">Unlock all</button><button type="button" data-a="slot">+1 keeper slot</button></div>
  <div class="dg"><span>World</span><button type="button" data-a="clear">Clear 9×9 at view</button><button type="button" data-a="find">Find all secrets</button><button type="button" data-a="fishers">+6 fishers</button></div>
  <div class="dg"><span>Trade</span><button type="button" data-a="ship">Send vehicles now</button><button type="button" data-a="back">Bring them home</button><button type="button" data-a="wish">Grant wish</button><button type="button" data-a="tide">Tide ×1.5</button></div>
  <div class="dg"><button type="button" data-a="reset" class="warn">${resetArm?'Click again: wipe save':'Reset save'}</button></div>`;
  d.querySelectorAll('[data-ts]').forEach(b=>b.addEventListener('click',()=>{timeScale=+b.dataset.ts;renderDebug();}));
  d.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>debugAct(b.dataset.a)));
}
let resetArm=false;
function debugAct(a){
  const main=()=>comps.reduce((x,c)=>c.size>x.size?c:x,comps[0]);
  if(a==='frenzy')debugFlags.frenzy=!debugFlags.frenzy,debugSpeed.spawn=debugFlags.frenzy?6:1,debugSpeed.reel=debugFlags.frenzy?4:1;
  if(a==='hints'){debugFlags.allHints=!debugFlags.allHints;updateHintVis();}
  if(a==='scales')S.scales+=1000;if(a==='silver')S.silver+=1000;
  if(a==='goods')for(const g of GOOD_IDS)S.goods[g]+=100;
  if(a==='rich'){S.scales+=1e5;S.silver+=1e5;for(const g of GOOD_IDS)S.goods[g]+=1e5/10;}
  if(a==='spawn'){const sp=SP[$('dbgSp').value];const c=comps.filter(c=>c.maxD>=sp.needD).sort((x,y)=>y.size-x.size)[0]||main();if(c){const f=spawnFish(sp,c);if(sp.awe)startCine(f);}}
  if(a==='meet'){for(const sp of SPECIES)S.codex[sp.id]=Math.max(12,S.codex[sp.id]||0);S.statueSp=S.statueSp||'koi';renderCodex();}
  if(a==='crate')queueCrate({source:'the debug fairy',kind:'mixed'});
  if(a==='hermit')queueCrate({source:'the debug fairy',kind:'keeper'});
  if(a==='unlock')for(const b of BLUEPRINTS)S.unlocked[b.id]=true;
  if(a==='slot'){for(let k=0;k<GW*GH;k++){if(tiles[k]===LAND&&builds[k]===NONE&&!fishersState.some(f=>idx(f.i,f.j)===k)&&!nb8(k%GW,(k/GW)|0,WATER)){builds[k]=B.STONES;break;}}buildsChanged();renderKeepers();}
  if(a==='clear'){const ci=Math.floor(view.t.x+HX),cj=Math.floor(view.t.z+HZ);for(let b=-4;b<=4;b++)for(let x=-4;x<=4;x++){const i=ci+x,j=cj+b;if(!inGrid(i,j))continue;const k=idx(i,j);if(tiles[k]===WILD){tiles[k]=LAND;revealAt(k);}}worldChanged();}
  if(a==='find'){for(const s of secrets)if(!S.found.includes(s.k)){tiles[s.k]=LAND;revealAt(s.k);}worldChanged();}
  if(a==='fishers'){let n=0;for(let j=0;j<GH&&n<6;j++)for(let i=0;i<GW&&n<6;i++){if(standable(i,j)&&freeSlot(i,j)>=0&&builds[idx(i,j)]!==BRIDGE){while(n<6&&freeSlot(i,j)>=0){makeFisher(i,j,freeSlot(i,j),S.hires+n);n++;}}}
    for(let q=0;q<2;q++){for(let k=0;k<GW*GH;k++){if(tiles[k]===LAND&&builds[k]===NONE&&!fishersState.some(f=>idx(f.i,f.j)===k)){builds[k]=HUT;S.meta[k]={style:S.hutStyle};break;}}}buildsChanged();}
  if(a==='ship')for(const v of trade.vehicles)if(v.state==='load'){v.t=999;S.goods.timber+=capacity(v.kind);}
  if(a==='back')for(const v of trade.vehicles)if(v.state==='away')v.t=0;
  if(a==='wish'&&S.wish){S.wish.have=S.wish.n-1;wishEvent(S.wish.kind,{sp:S.wish.sp,id:S.wish.id,n:S.wish.n});}
  if(a==='tide'){S.tide.n=10;S.tide.t=Date.now();}
  if(a==='reset'){if(!resetArm){resetArm=true;renderDebug();setTimeout(()=>{resetArm=false;if(!$('debug').hidden)renderDebug();},3000);return;}
    store.set(SAVE_KEY,'');removeEventListener('pagehide',save);location.reload();return;}
  computeEconomy();renderDrawer();refreshUI();renderDebug();save();
}

/* ================= boot ================= */
const loaded=load();
if(!loaded){initTiles();initBuilds();}
{const p=parseInt(store.get('deepvale-pix'));if([2,3,4].includes(p)){PIX=p;$('btnPix').textContent='Pixels ×'+PIX;}}
initSecrets();
buildTerrain(false);scatterOuter();updateTrees();analyzeWater();computeVillages();computeEconomy();village.sync();trade.sync();trade.topUpOrders();updateHintVis();
if(loaded&&S.fishers.length){S.fishers.forEach(f=>{if(inGrid(f.i,f.j))makeFisher(f.i,f.j,f.slot,f.c??0);});}
else{const spot=[];for(let j=0;j<GH;j++)for(let i=0;i<GW;i++)if(standable(i,j)&&builds[idx(i,j)]!==BRIDGE)spot.push([i,j]);
  spot.sort((a,b)=>Math.hypot(a[0]-WAY_I,a[1]-15)-Math.hypot(b[0]-WAY_I,b[1]-15));
  const s=spot[0]||[WAY_I,12];makeFisher(s[0],s[1],1,0);}
// a few fish already in the river
{const main=comps.reduce((a,c)=>c.size>a.size?c:a,comps[0]);if(main){for(let n=0;n<4;n++)spawnFish(n<3?SP.reed:SP.koi,main,{emerge:false});}}
booted=true;
if(loaded)offlineGain(Date.now()-S.t);
resize();renderCodex();refreshUI();updateMarks();renderKeepers();renderWish();
if(!S.wish)setTimeout(()=>{if(!S.wish)newWish();},loaded?4000:30000);
$('enter').addEventListener('click',()=>{started=true;$('intro').classList.add('gone');setSound(true);
  tweenTo({x:0,y:0,z:-2},innerWidth<700?24:32,5.5);
  if(!loaded||S.first){S.first=false;setTimeout(()=>log('Your fisher waits at the bank with a barbless line. Every fish met here is let go again.'),5200);
    setTimeout(()=>log('Released fish shed scales. Clearing the forest gives timber, and the wagon by the Way carries goods out for silver.'),10000);
    setTimeout(()=>log('Open Build (B) for woodcutters, reed beds, markets and more. Something is hidden in the forest, too.'),15500);}
  else if(migrated==='0.2'){log('The valley has grown. There is more forest to clear, and a trading post by the Pilgrim Way. Pilgrims buy at market stalls now.','gold');}
  else if(migrated)log('The valley has changed: fish are released now, and a village has grown by the Pilgrim Way.','gold');
  else log('Welcome back to the valley.');
});

const clock=new THREE.Clock();let saveT=0,uiT=0;
// the simulation: run several times a frame when the debug time scale is up
function simStep(dt,t){
  for(const f of fishes.slice()){updateFish(f,dt);updateFight(f,dt);}
  hookTimer+=dt;if(hookTimer>.5){hookTimer=0;hookCheck();}
  spawnTick(dt);pilgrimTick(dt);productionTick(dt);trade.update(dt,t);village.update(dt,t);
}
function frame(){
  const dt=Math.min(.1,clock.getDelta());U.time.value+=dt;const t=U.time.value;
  keyPan(dt);updateCamera(dt);
  for(let n=0;n<timeScale;n++)simStep(dt,t+n*dt);
  fishersState.forEach(fs=>updateFisher(fs,dt,t));
  updateCine(dt);updateSparkles(dt);updateHeat(dt);updateHints(dt,t);
  wisps.update(dt,(innerHeight/PIX)/view.z);
  updateLabels();drawPreview();
  if(started&&ptrIn&&!drag)hovered=cine.fish?null:pickFish(lastPtr.x,lastPtr.y);
  updateCard();
  if(selected){selRing.position.set(selected.x,selected.g.position.y+.02,selected.z);selRing.scale.setScalar(1+Math.sin(t*5)*.12);}
  uiT+=dt;if(uiT>.5){uiT=0;refreshUI();}
  saveT+=dt;if(saveT>10){saveT=0;save();}
  renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.render(scene,camera);
  renderer.setRenderTarget(null);renderer.render(postScene,postCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (import.meta.env.DEV) window.__dv={S,fishes,fishersState,spawnFish,SP,comps:()=>comps,view,tweenTo,startCine,tiles,builds,FLOW,act,worldChanged,buildsChanged,refreshUI,pickFish,toScreen,setTool,hookCheck,trade,secrets:()=>secrets,queueCrate,debugAct,canDo,villages:()=>villages,producers:()=>producers,activeSets:()=>activeSets,setTimeScale:n=>{timeScale=n;},hintVis,newWish,linkedOf,tally,sfx,simStep};
