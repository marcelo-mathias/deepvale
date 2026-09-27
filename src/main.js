import * as THREE from 'three';
import { clamp, lerp, smooth, rand, hash2, fbm, ridged, fmt, store } from './core/utils.js';
import { GW, GH, HX, HZ, WATER_Y, BED_Y, LAND_Y, WILD, LAND, WATER, idx, tileC, inGrid, riverZ } from './world/constants.js';
import { SPECIES, SP } from './data/species.js';
import { NOISE_GLSL, RIM_FRAG, BEND_VERT, BEND_DECL } from './render/shaders.js';
import { setSound as setAudio, sfx, isSoundOn } from './audio/audio.js';

function setSound(on){ setAudio(on); document.getElementById('btnSound').textContent = on ? 'Sound on' : 'Sound off'; }

/* ================= state ================= */
const S={coins:20,tiles:null,fishers:[],hires:0,clears:0,digs:0,lineLv:0,baitLv:0,codex:{},earned:0,income:[],t:Date.now(),first:true};
const tiles=new Uint8Array(GW*GH);
const wildH=new Float32Array(GW*GH);
for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){wildH[idx(i,j)]=.2+fbm(i*.41+3,j*.41+9,3)*.42;}
function initTiles(){
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const c=tileC(i,j);const d=Math.abs(c.z-riverZ(c.x));tiles[idx(i,j)]=d<1.6?WATER:WILD;}
  // a little clearing on the north bank, mid-valley
  for(let i=12;i<=16;i++){for(let j=0;j<GH;j++){const c=tileC(i,j);const d=c.z-riverZ(c.x);if(d<0&&d>-2.8&&tiles[idx(i,j)]===WILD)tiles[idx(i,j)]=LAND;}}
}

/* ================= renderer / scene ================= */
const canvas=document.getElementById('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
const FOG=new THREE.Color('#d9b995');
scene.fog=new THREE.Fog(FOG,190,330);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,1,700);
const AZ=Math.PI/4,EL=THREE.MathUtils.degToRad(34);
const CAM_DIR=new THREE.Vector3(Math.sin(AZ)*Math.cos(EL),Math.sin(EL),Math.cos(AZ)*Math.cos(EL));
const view={t:new THREE.Vector3(-13,9,-21),z:78};
let PIX=3;let rt=null;

const SUN_DIR=new THREE.Vector3(-1,.62,.2).normalize();
const sun=new THREE.DirectionalLight(new THREE.Color('#ffd2a1'),3.4);
sun.position.copy(SUN_DIR).multiplyScalar(110);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-44,right:44,top:44,bottom:-44,near:1,far:260});
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
  const md=Math.hypot(x+20,(z+33)*1.1);h+=40*Math.exp(-(md*md)/(2*12.5*12.5))*(.72+.55*ridged(x*.06,z*.06));
  const m2=Math.hypot(x+50,z+8);h+=19*Math.exp(-(m2*m2)/(2*10*10))*(.7+.6*ridged(x*.07+5,z*.07));
  const m3=Math.hypot(x-12,z+52);h+=24*Math.exp(-(m3*m3)/(2*13*13))*(.7+.6*ridged(x*.07+9,z*.07+2));
  const m4=Math.hypot(x+44,z+44);h+=16*Math.exp(-(m4*m4)/(2*11*11))*(.7+.6*ridged(x*.08+1,z*.08+4));
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
function axisArr(inner){const L=[];for(let v=-86;v<-inner-.6;v+=1.2)L.push(v);const M=[];for(let v=-inner;v<=inner+1e-6;v+=.25)M.push(+v.toFixed(3));return L.concat(M,L.map(v=>-v).reverse());}
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
function colorAt(x,z,h,ny,out){
  const n=fbm(x*.7,z*.7,2);
  const i=Math.floor(x+HX),j=Math.floor(z+HZ);const inside=inGrid(i,j);
  if(h<WATER_Y-.02){out.copy(PAL.bedHi).lerp(PAL.bedLo,smooth(-.3,-1.2,h));out.multiplyScalar(.85+n*.3);return;}
  if(h<WATER_Y+.13){out.copy(PAL.sand).multiplyScalar(.85+n*.3);return;}
  if(inside&&tiles[idx(i,j)]===LAND){out.copy(PAL.meadow).lerp(PAL.meadow2,n);
    const fx=x+HX-i,fz=z+HZ-j;if(Math.min(fx,fz,1-fx,1-fz)<.04)out.multiplyScalar(.86);return;}
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
const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95,metalness:0});
terrainMat.onBeforeCompile=sh=>{
  sh.uniforms.uTime=U.time;sh.uniforms.uWaterY={value:WATER_Y};
  sh.vertexShader='varying vec3 vWPos;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n vWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='varying vec3 vWPos;\nuniform float uTime;\nuniform float uWaterY;\n'+NOISE_GLSL+sh.fragmentShader
   .replace('#include <color_fragment>',`#include <color_fragment>
    float depthW=uWaterY-vWPos.y;
    float cloud=clouds(vWPos.xz,uTime);
    diffuseColor.rgb*=1.0-cloud*0.34;
    if(depthW>0.0) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.012,0.085,0.075),clamp(depthW*0.55,0.0,0.82));
    float ch=vWPos.y/0.75; float fw=max(fwidth(ch),1e-4); float cd=abs(fract(ch+0.5)-0.5);
    float cl=1.0-smoothstep(fw*0.6,fw*1.7,cd);
    float major=1.0-step(0.5,abs(mod(floor(ch+0.5),5.0)));
    diffuseColor.rgb*=1.0-cl*smoothstep(0.5,2.0,vWPos.y)*(0.09+0.16*major);`)
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    if(depthW>0.0){float cz=caustic(vWPos.xz*0.085,uTime*0.3);totalEmissiveRadiance+=vec3(0.45,1.0,0.8)*cz*0.55*exp(-depthW*0.6)*(1.0-cloud*0.8);}
    float shore=1.0-smoothstep(0.0,0.05,abs(vWPos.y-uWaterY-0.02));
    totalEmissiveRadiance+=vec3(1.0,0.84,0.6)*shore*0.6*(1.0-cloud*0.6);`);
};
const terrain=new THREE.Mesh(tGeo,terrainMat);terrain.receiveShadow=true;terrain.castShadow=true;scene.add(terrain);

/* ================= water surface ================= */
const waterMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
  uniforms:{uTime:U.time,uSun:{value:SUN_DIR},uView:{value:CAM_DIR},uFog:{value:FOG},uFogNear:{value:190},uFogFar:{value:330}},
  vertexShader:`varying vec3 vW;varying float vFogD;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vec4 mv=viewMatrix*w;vFogD=-mv.z;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float uTime;uniform vec3 uSun;uniform vec3 uView;uniform vec3 uFog;uniform float uFogNear;uniform float uFogFar;varying vec3 vW;varying float vFogD;
  ${NOISE_GLSL}
  float wh(vec2 p){return vns(p*0.8+uTime*vec2(0.10,0.06))*0.55+vns(p*2.1-uTime*vec2(0.08,0.13))*0.3+vns(p*5.3+uTime*vec2(0.2,-0.1))*0.15;}
  void main(){
    vec2 p=vW.xz;float e=0.08;
    float h0=wh(p);float hx=wh(p+vec2(e,0.0));float hz=wh(p+vec2(0.0,e));
    vec3 N=normalize(vec3((h0-hx)*1.6,1.0,(h0-hz)*1.6));
    float fres=pow(1.0-clamp(dot(N,uView),0.0,1.0),2.5);
    float spec=pow(max(dot(reflect(-uSun,N),uView),0.0),70.0);
    float cloud=clouds(p,uTime);
    float band=vns(p*0.05+vec2(uTime*0.004,0.0))*2.0;
    float shaft=smoothstep(0.62,1.0,sin(dot(p,normalize(vec2(1.0,0.45)))*0.2+band+uTime*0.02))*(1.0-cloud);
    vec3 col=vec3(0.02,0.13,0.12);
    col+=vec3(0.5,0.72,0.78)*fres*0.45;
    col+=vec3(0.45,0.95,0.78)*shaft*0.22;
    col+=vec3(1.0,0.82,0.58)*spec*3.0*(1.0-cloud*0.8);
    col*=1.0-cloud*0.25;
    float a=clamp(0.2+fres*0.35+shaft*0.1+spec*0.6,0.0,0.94);
    float f=smoothstep(uFogNear,uFogFar,vFogD);col=mix(col,uFog,f);a=mix(a,1.0,f);
    gl_FragColor=vec4(col,a);
  }`
});
const water=new THREE.Mesh(new THREE.PlaneGeometry(190,190).rotateX(-Math.PI/2),waterMat);
water.position.y=WATER_Y;water.renderOrder=2;scene.add(water);

/* ================= trees & rocks ================= */
const coneG=new THREE.ConeGeometry(.17,.5,6).translate(0,.42,0);
const trunkG=new THREE.CylinderGeometry(.025,.035,.2,4).translate(0,.1,0);
const MAXT=6400;
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
  while(trees.length<MAXT-40&&tries<60000){tries++;const x=rand(-70,70),z=rand(-70,50);
    if(Math.abs(x)<HX+.8&&Math.abs(z)<HZ+.8)continue;
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
const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),rimMat({color:'#8a8176'},'#ffd6a0',.6),260);
rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks);
{let n=0,tries=0;while(n<260&&tries<20000){tries++;const x=rand(-75,75),z=rand(-75,50);if(Math.abs(x)<HX+1&&Math.abs(z)<HZ+1)continue;
  const h=heightAt(x,z);if(h<.5)continue;const s=rand(.12,.5)*(h>8?1.8:1);
  p4.set(x,h-s*.45,z);q4.setFromEuler(new THREE.Euler(rand(0,3),rand(0,3),rand(0,3)));s4.set(s,s*rand(.5,.9),s*rand(.7,1.1));
  m4.compose(p4,q4,s4);rocks.setMatrixAt(n++,m4);}rocks.count=n;}

/* ================= water analysis ================= */
const D=new Int16Array(GW*GH),COMP=new Int32Array(GW*GH);let comps=[];
function analyzeWater(){
  D.fill(-1);const q=[];
  for(let k=0;k<GW*GH;k++)if(tiles[k]!==WATER){D[k]=0;q.push(k);}
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=idx(i,j);if(tiles[k]===WATER&&(i===0||j===0||i===GW-1||j===GH-1)&&D[k]<0){D[k]=1;q.push(k);}}
  for(let h=0;h<q.length;h++){const k=q[h],i=k%GW,j=(k/GW)|0;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ni=i+di,nj=j+dj;if(!inGrid(ni,nj))continue;const nk=idx(ni,nj);if(D[nk]<0){D[nk]=D[k]+1;q.push(nk);}}}
  COMP.fill(-1);comps=[];
  for(let k=0;k<GW*GH;k++){if(tiles[k]!==WATER||COMP[k]>=0)continue;
    const c={id:comps.length,size:0,maxD:0,tiles:[]};const st=[k];COMP[k]=c.id;
    while(st.length){const t=st.pop();c.size++;c.tiles.push(t);c.maxD=Math.max(c.maxD,D[t]);const i=t%GW,j=(t/GW)|0;
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj;if(!inGrid(ni,nj))continue;const nk=idx(ni,nj);if(tiles[nk]===WATER&&COMP[nk]<0){COMP[nk]=c.id;st.push(nk);}}}
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
    case 'showa':band('#1c1a1b','#e9e2d6');for(let n=0;n<5;n++)blob(6+R()*46,8+(R()-.5)*6,3+R()*6,2+R()*3.5,'#c8361f');for(let n=0;n<2;n++)blob(10+R()*40,8+(R()-.5)*8,3+R()*4,2+R()*2,'#efe9df');break;
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
  px(g,3,4,eye);px(g,3,12,eye);if(sp.glow){px(ge,3,4,sp.pattern==='warden'?'#ffd27a':'#556');px(ge,3,12,sp.pattern==='warden'?'#ffd27a':'#556');}
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
  return {mesh,mat,u,canvas:cv.c};
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
  }else if(f.state==='landed'){
    f.out+=dt/3.2;const k=Math.min(1,f.out);
    f.y=lerp(targetY,WATER_Y+.05,easeInOut(Math.min(1,k*1.6)));f.mesh.rotation.z=easeInOut(k)*1.3;
    f.u.uPhase.value+=dt*9;f.u.uAmp.value=.1*(1-k);
    if(k>.55){if(!f.mat.transparent){f.mat.transparent=true;f.mat.needsUpdate=true;}f.mat.opacity=1-(k-.55)/.45;}
    if(Math.random()<dt*18*(1-k))sparkle(f.x+rand(-.3,.3)*sp.len*.5,WATER_Y+.1,f.z+rand(-.3,.3)*sp.len*.5,sp.glow||'#fff3d6');
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
  fs.g.position.set(p.x,Math.max(heightAt(p.x,p.z),WATER_Y)-.01,p.z);fs.g.rotation.set(0,p.face,0);
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
const cost={clear:()=>Math.round(4*Math.pow(1.09,S.clears)),dig:()=>Math.round(12*Math.pow(1.075,S.digs)),hire:()=>Math.round(15*Math.pow(1.3,S.hires)),
  line:()=>Math.round(60*Math.pow(2.3,S.lineLv)),bait:()=>Math.round(90*Math.pow(2.5,S.baitLv))};
const lineMult=()=>1+.3*S.lineLv,baitMult=()=>1+.25*S.baitLv;
function canDo(tool,i,j){
  if(!inGrid(i,j))return {ok:false,why:'Outside the valley floor'};
  const t=tiles[idx(i,j)];
  if(tool==='clear'){if(t!==WILD)return {ok:false,why:t===LAND?'Already cleared':'That is water'};
    if(!nb4(i,j,LAND)&&!nb4(i,j,WATER))return {ok:false,why:'Must touch cleared land or water'};return {ok:true,c:cost.clear()};}
  if(tool==='dig'){if(t===WATER)return {ok:false,why:'Already water'};if(!nb4(i,j,WATER))return {ok:false,why:'Must connect to existing water'};
    if(fishersOn(i,j).length)return {ok:false,why:'Move the fishers off first'};return {ok:true,c:cost.dig()};}
  if(tool==='hire'){if(t!==LAND)return {ok:false,why:t===WILD?'Clear this land first':'Fishers need solid ground'};
    if(!nb8(i,j,WATER))return {ok:false,why:'Must stand at the water’s edge'};if(freeSlot(i,j)<0)return {ok:false,why:'Three fishers per tile'};return {ok:true,c:cost.hire()};}
  if(tool==='move'){if(t!==LAND||!nb8(i,j,WATER))return {ok:false,why:'Needs cleared land at the water’s edge'};if(freeSlot(i,j)<0)return {ok:false,why:'Tile is full'};return {ok:true,c:0};}
  return {ok:false};
}
function spend(c){if(S.coins<c){log(`Not enough silver. That costs ${fmt(c)}.`,'warn');return false;}S.coins-=c;return true;}
function earn(v,x,z){S.coins+=v;S.earned+=v;S.income.push([Date.now(),v]);if(x!==undefined)popAt(x,z,'+'+fmt(v));}
function act(tool,i,j){
  const r=canDo(tool,i,j);if(!r.ok){if(r.why)log(r.why+'.','warn');return;}
  if(tool==='clear'){if(!spend(r.c))return;tiles[idx(i,j)]=LAND;S.clears++;worldChanged();sfx('dig');}
  else if(tool==='dig'){if(!spend(r.c))return;tiles[idx(i,j)]=WATER;S.digs++;worldChanged();sfx('dig');}
  else if(tool==='hire'){if(!spend(r.c))return;makeFisher(i,j,freeSlot(i,j),S.hires+1);S.hires++;log(`A new fisher joins the bank. You have ${fishersState.length}.`);sfx('pluck');}
  refreshUI();save();
}
function worldChanged(){buildTerrain(true);updateTrees();analyzeWater();fishersState.forEach(placeFisher);updateMarks();}

/* ================= hooking & fighting ================= */
let hookTimer=0;
function hookCheck(){
  for(const f of fishes){
    if(f.state!=='swim'||f.emerge<.85)continue;
    const reach=1.5+f.sp.len*f.sp.wid*.5;
    const near=fishersState.filter(fs=>fs.state==='idle'&&(distToFish(f,fs.bob.x,fs.bob.z)<reach||distToFish(f,fs.x,fs.z)<reach+.6));
    if(!near.length)continue;
    if(near.length>=f.sp.crew){
      if(Math.random()<.07*baitMult()){
        const crew=near.slice(0,f.sp.crew*2);f.state='hooked';f.hookers=crew;f.progress=0;
        crew.forEach(fs=>{fs.state='fight';fs.fish=f;});
        log(`${crew.length>1?crew.length+' fishers have':'A fisher has'} hooked ${S.codex[f.sp.id]?'a '+f.sp.name:'something unfamiliar'}.`,f.sp.crew>1?'gold':'');
        sfx('hook');
      }
    }else if(performance.now()>f.nextHint){f.nextHint=performance.now()+25000;
      const nm=S.codex[f.sp.id]?`The ${f.sp.name}`:'Something large';
      log(`${nm} circles the bait but won’t bite. It needs ${f.sp.crew} fishers waiting together, you have ${near.length} there.`,'warn');}
  }
}
function updateFight(f,dt){
  if(f.state!=='hooked')return;
  const hands=f.hookers.length;const rate=(hands/f.sp.crew)*lineMult()/f.sp.fight;
  f.progress+=dt*rate;
  // drag the fish gently toward the crew
  let cx=0,cz=0;f.hookers.forEach(fs=>{cx+=fs.x;cz+=fs.z;});cx/=hands;cz/=hands;
  const d=Math.hypot(cx-f.x,cz-f.z);if(d>f.sp.len*.5+.6){const nx=f.x+(cx-f.x)/d*dt*.05,nz=f.z+(cz-f.z)/d*dt*.05;if(dAt(nx,nz)>0){f.x=nx;f.z=nz;}}
  f.h+=angDiff(Math.atan2(f.x-cx,f.z-cz),f.h)*dt*.15;
  if(Math.random()<dt*2)sparkle(fishHead(f).x,WATER_Y+.02,fishHead(f).z,'#dff8ee');
  if(f.progress>=1){
    f.state='landed';f.out=0;f.hookers.forEach(fs=>{fs.state='idle';fs.fish=null;});
    const first=!S.codex[f.sp.id];S.codex[f.sp.id]=(S.codex[f.sp.id]||0)+1;
    earn(f.sp.value,f.x,f.z);
    log(`Landed ${first?'your first ':'a '}${f.sp.name}. +${fmt(f.sp.value)} silver.`,'gold');
    if(first&&f.sp.crew>1)log(`New in the codex: ${f.sp.name}.`,'gold');
    sfx(f.sp.awe?'land-big':'land');renderCodex();refreshUI();save();
  }
}

/* ================= spawning & giant sightings ================= */
let spawnTimer=6;
function spawnTick(dt){
  spawnTimer-=dt*baitMult();if(spawnTimer>0)return;spawnTimer=rand(20,36);
  const cap=Math.min(14,comps.reduce((s,c)=>s+Math.max(1,Math.floor(c.size/7)),0));
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
  document.getElementById('bannerReq').textContent=`Needs ${f.sp.crew} fishers on one bank · worth ${fmt(f.sp.value)} silver`;
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

/* ================= camera ================= */
let tween=null;
function tweenTo(p,z,dur){tween={from:{x:view.t.x,y:view.t.y,z:view.t.z,zoom:view.z},to:{x:p.x,y:p.y??0,z:p.z,zoom:z},t:0,dur};}
function updateCamera(dt){
  if(tween){tween.t+=dt/tween.dur;const k=easeInOut(Math.min(1,tween.t));
    view.t.set(lerp(tween.from.x,tween.to.x,k),lerp(tween.from.y,tween.to.y,k),lerp(tween.from.z,tween.to.z,k));view.z=Math.exp(lerp(Math.log(tween.from.zoom),Math.log(tween.to.zoom),k));
    if(tween.t>=1)tween=null;}
  view.t.x=clamp(view.t.x,-40,40);view.t.z=clamp(view.t.z,-44,34);
  const w=innerWidth,h=innerHeight,a=w/h,zz=view.z;
  camera.left=-zz*a/2;camera.right=zz*a/2;camera.top=zz/2;camera.bottom=-zz/2;camera.updateProjectionMatrix();
  camera.position.copy(view.t).addScaledVector(CAM_DIR,200);camera.lookAt(view.t);camera.updateMatrixWorld();
  U.sunView.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
}

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
  drag={x:e.clientX,y:e.clientY,moved:0,btn:e.button,pinch:pointers.size===2?pinchDist():0,zoom:view.z};});
function pinchDist(){const p=[...pointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
canvas.addEventListener('pointermove',e=>{
  const prev=pointers.get(e.pointerId);if(prev){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});}
  if(drag&&prev){
    if(pointers.size===2&&drag.pinch){const d=pinchDist();view.z=clamp(drag.zoom*drag.pinch/d,8,110);drag.moved=99;cancelAuto();}
    else{const dx=e.clientX-prev.x,dy=e.clientY-prev.y;drag.moved+=Math.abs(dx)+Math.abs(dy);
      if(drag.moved>6){pan(dx,dy);cancelAuto();}}
  }
  hover(e.clientX,e.clientY);
});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);
  if(drag&&drag.moved<=6&&drag.btn===0&&started){click(e.clientX,e.clientY);}
  if(!pointers.size)drag=null;});
canvas.addEventListener('pointerleave',()=>{tip.style.display='none';hoverLoop.visible=false;hovered=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.z=clamp(view.z*Math.exp(e.deltaY*.0012),8,110);cancelAuto();},{passive:false});
function cancelAuto(){tween=null;if(cine.fish)endCine(false);}
function pan(dx,dy){const upp=view.z/innerHeight;const right=new THREE.Vector3(1,0,-1).normalize(),fwd=new THREE.Vector3(-1,0,-1).normalize();
  view.t.addScaledVector(right,-dx*upp).addScaledVector(fwd,dy*upp/Math.sin(EL));}
const keys=new Set();
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('button')&&e.key===' ')return;
  const k=e.key.toLowerCase();keys.add(k);
  if(k==='q'||k==='escape'){setTool('look');}if(k==='1')setTool('clear');if(k==='2')setTool('dig');if(k==='3')setTool('hire');
  if(k==='c')toggleCodex();if(k==='='||k==='+')view.z=clamp(view.z/1.2,8,110);if(k==='-')view.z=clamp(view.z*1.2,8,110);});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function keyPan(dt){const s=520*dt;let dx=0,dy=0;if(keys.has('a')||keys.has('arrowleft'))dx+=s;if(keys.has('d')||keys.has('arrowright'))dx-=s;
  if(keys.has('w')||keys.has('arrowup'))dy+=s;if(keys.has('s')||keys.has('arrowdown'))dy-=s;if(dx||dy){pan(dx,dy);cancelAuto();}}
let hovered=null;
function hover(cx,cy){
  const p=groundAt(cx,cy);if(!p){hoverLoop.visible=false;tip.style.display='none';return;}
  const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);
  hovered=null;for(const f of fishes){if(f.state==='landed'||f.emerge<.6)continue;if(distToFish(f,p.x,p.z)<f.sp.len*f.sp.wid*.5+.25){hovered=f;break;}}
  let html='';
  if(!inGrid(i,j)){hoverLoop.visible=false;}
  else{const c=tileC(i,j);const t=tiles[idx(i,j)];hoverLoop.visible=true;
    hoverLoop.position.set(c.x,(t===WATER?WATER_Y:heightAt(c.x,c.z))+.03,c.z);
    const useTool=selected?'move':tool;
    if(useTool!=='look'){const r=canDo(useTool,i,j);hoverLoop.material.color.set(r.ok?(S.coins>=(r.c||0)?'#ffe6b0':'#e98a5f'):'#e98a5f');
      const names={clear:'Clear land',dig:'Dig water',hire:'Hire fisher',move:'Move fisher here'};
      html=`<div>${names[useTool]}${r.ok&&r.c?` · <span class="c">${fmt(r.c)} silver</span>`:''}</div>`+(r.ok?'':`<div class="bad">${r.why}</div>`);}
    else{hoverLoop.material.color.set('#ffe6b0');
      if(t===WATER){const cp=comps[COMP[idx(i,j)]];html=`<div>Water body · <span class="c">${cp.size}</span> tiles</div><div class="dim">Open water up to ${cp.maxD*2-1} wide</div>`;}
      else if(fishersOn(i,j).length)html=`<div>${fishersOn(i,j).length} fisher${fishersOn(i,j).length>1?'s':''}</div><div class="dim">Click to move one</div>`;}
  }
  if(hovered){const f=hovered,k=!!S.codex[f.sp.id];html=`<div style="font-family:var(--display);letter-spacing:.05em">${k?f.sp.name:'Unknown fish'}</div><div class="dim">About ${Math.round(f.sp.len*4)} m long · needs ${f.sp.crew} fisher${f.sp.crew>1?'s':''}</div>`+html;}
  if(html){tip.innerHTML=html;tip.style.display='block';tip.style.left=Math.min(cx,innerWidth-250)+'px';tip.style.top=Math.min(cy,innerHeight-80)+'px';}else tip.style.display='none';
}
function click(cx,cy){
  const p=groundAt(cx,cy);if(!p)return;const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);
  if(selected){const r=canDo('move',i,j);
    if(r.ok&&!(selected.i===i&&selected.j===j)){selected.i=i;selected.j=j;selected.slot=freeSlot(i,j);placeFisher(selected);sparkle(selected.x,.3,selected.z,'#ffe9bf');save();}
    else if(!r.ok)log(r.why+'.','warn');
    selected=null;selRing.visible=false;updateMarks();return;}
  if(tool==='look'){if(!inGrid(i,j))return;const on=fishersOn(i,j).filter(f=>f.state==='idle');
    if(on.length){selected=on[on.length-1];selRing.visible=true;updateMarks();log('Pick a spot at the water’s edge for this fisher.');}return;}
  act(tool,i,j);hover(cx,cy);
}
function setTool(t){tool=t;selected=null;selRing.visible=false;document.querySelectorAll('.tool').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));updateMarks();}
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
function updateMarks(){
  const useTool=selected?'move':tool;let n=0;
  if(useTool!=='look'){for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){if(!canDo(useTool,i,j).ok)continue;const c=tileC(i,j);const t=tiles[idx(i,j)];
    p4.set(c.x,(t===WATER?WATER_Y:heightAt(c.x,c.z))+.04,c.z);m4.makeTranslation(p4.x,p4.y,p4.z);marks.setMatrixAt(n++,m4);}}
  marks.count=n;marks.instanceMatrix.needsUpdate=true;
}

/* ================= UI ================= */
const $=id=>document.getElementById(id);
const logEl=$('log');
function log(msg,cls=''){const li=document.createElement('li');li.textContent=msg;if(cls)li.className=cls;logEl.appendChild(li);
  while(logEl.children.length>5)logEl.firstChild.remove();setTimeout(()=>li.classList.add('old'),9000);setTimeout(()=>li.remove(),10600);}
const labelsEl=$('labels');
function popAt(x,z,text){const v=new THREE.Vector3(x,.2,z).project(camera);const el=document.createElement('div');el.className='pop';el.textContent=text;
  el.style.left=((v.x+1)/2*innerWidth)+'px';el.style.top=((1-v.y)/2*innerHeight)+'px';labelsEl.appendChild(el);setTimeout(()=>el.remove(),2700);}
const labelPool=new Map();
function updateLabels(){
  const want=new Set();
  for(const f of fishes){const show=f.state==='hooked'||(cine.fish===f&&cine.t>2);if(!show)continue;want.add(f);
    let el=labelPool.get(f);if(!el){el=document.createElement('div');el.className='lbl';el.innerHTML='<div class="nm"></div><div class="sub"></div><div class="pb"><i></i></div>';labelsEl.appendChild(el);labelPool.set(f,el);}
    const hd=fishHead(f);const v=new THREE.Vector3(hd.x,.4,hd.z).project(camera);
    el.style.left=((v.x+1)/2*innerWidth)+'px';el.style.top=((1-v.y)/2*innerHeight)+'px';
    el.querySelector('.nm').textContent=S.codex[f.sp.id]||f.state==='hooked'||cine.fish===f?f.sp.name:'???';
    el.querySelector('.sub').textContent=f.state==='hooked'?`${f.hookers.length} of ${f.sp.crew} hands on the line`:`About ${Math.round(f.sp.len*4)} m`;
    el.querySelector('.pb').style.display=f.state==='hooked'?'block':'none';el.querySelector('.pb i').style.width=(f.progress*100).toFixed(1)+'%';}
  for(const [f,el] of labelPool)if(!want.has(f)){el.remove();labelPool.delete(f);}
}
function incomeRate(){const now=Date.now();S.income=S.income.filter(([t])=>now-t<15*60e3);if(!S.income.length)return 0;
  const span=Math.max(120e3,now-S.income[0][0]);return S.income.reduce((s,[,v])=>s+v,0)/(span/60e3);}
function nextGoal(){
  const sp=SPECIES.find(s=>!S.codex[s.id]);if(!sp)return 'Every giant in the codex has been landed. The valley is yours.';
  const best=comps.reduce((a,c)=>c.size>a.size?c:a,{size:0,maxD:0});const parts=[];
  if(fishersState.length<sp.crew)parts.push(`<b>${sp.crew} fishers</b>`);
  if(best.size<sp.minWater)parts.push(`<b>${sp.minWater} tiles</b> of connected water`);
  if(best.maxD<sp.needD)parts.push(`open water <b>${sp.needD*2-1} tiles wide</b>`);
  const nm=sp.crew<=2?sp.name:'Something larger';
  if(!parts.length)return `${nm} can surface now. Keep <b>${sp.crew}</b> fisher${sp.crew>1?'s':''} together on one bank and wait.`;
  return `${nm} needs ${parts.join(', ')}.`;
}
let lastGoal='';
function refreshUI(){
  $('coins').textContent=fmt(S.coins);
  const r=incomeRate();$('rate').textContent=r>0?`about ${r<10?r.toFixed(1):fmt(r)} silver / min`:'No catches yet';
  const g=nextGoal();if(g!==lastGoal){$('goal').innerHTML=g;lastGoal=g;}
  $('cClear').textContent=fmt(cost.clear());$('cDig').textContent=fmt(cost.dig());$('cHire').textContent=fmt(cost.hire());
  $('cLine').textContent=fmt(cost.line());$('cBait').textContent=fmt(cost.bait());$('lvLine').textContent='Lv '+S.lineLv;$('lvBait').textContent='Lv '+S.baitLv;
  $('tool-clear').classList.toggle('poor',S.coins<cost.clear());$('tool-dig').classList.toggle('poor',S.coins<cost.dig());$('tool-hire').classList.toggle('poor',S.coins<cost.hire());
  $('upLine').disabled=S.coins<cost.line();$('upBait').disabled=S.coins<cost.bait();
  $('codexCount').textContent=`${SPECIES.filter(s=>S.codex[s.id]).length}/${SPECIES.length}`;
}
$('upLine').title='Crews reel 30% faster per level';$('upBait').title='Fish arrive and bite 25% more often per level';
$('upLine').addEventListener('click',()=>{if(spend(cost.line())){S.lineLv++;log(`Braided lines, level ${S.lineLv}. Crews reel faster.`);refreshUI();save();}});
$('upBait').addEventListener('click',()=>{if(spend(cost.bait())){S.baitLv++;log(`River bait, level ${S.baitLv}. Fish arrive and bite more often.`);refreshUI();save();}});
function toggleCodex(){const c=$('codex');c.hidden=!c.hidden;if(!c.hidden)renderCodex();}
$('btnCodex').addEventListener('click',toggleCodex);$('codexClose').addEventListener('click',toggleCodex);
$('btnIn').addEventListener('click',()=>{view.z=clamp(view.z/1.3,8,110);cancelAuto();});
$('btnOut').addEventListener('click',()=>{view.z=clamp(view.z*1.3,8,110);cancelAuto();});
$('btnPix').addEventListener('click',()=>{PIX=PIX===3?2:PIX===2?4:3;$('btnPix').textContent='Pixels ×'+PIX;resize();store.set('deepvale-pix',String(PIX));});
const thumbCache={};
function renderCodex(){
  const L=$('codexList');L.innerHTML='';const best=comps.reduce((a,c)=>c.size>a.size?c:a,{size:0,maxD:0});
  for(const sp of SPECIES){const known=!!S.codex[sp.id];const e=document.createElement('div');e.className='entry'+(known?'':' unknown');
    const cv=document.createElement('canvas');cv.width=72;cv.height=24;drawThumb(cv,sp,known);
    const ok=(c)=>c?'ok':'';
    e.innerHTML=`<div></div><div><div class="en">${known?sp.name:'Unknown'}</div><div class="ee">${known?sp.ep:`Something about ${Math.round(sp.len*4)} m long has been seen in the river.`}</div>
      <div class="er"><span class="${ok(fishersState.length>=sp.crew)}">Crew ${sp.crew}</span><span class="${ok(best.size>=sp.minWater)}">Water ${sp.minWater}+</span><span class="${ok(best.maxD>=sp.needD)}">Width ${sp.needD*2-1}+</span>${known?`<span>Landed ×${S.codex[sp.id]}</span>`:''}</div></div>`;
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
function save(){S.t=Date.now();S.tiles=Array.from(tiles);S.fishers=fishersState.map(f=>({i:f.i,j:f.j,slot:f.slot,c:f.color}));store.set(SAVE_KEY,JSON.stringify(S));}
function load(){
  const raw=store.get(SAVE_KEY);if(!raw)return false;
  try{const d=JSON.parse(raw);if(!d.tiles||d.tiles.length!==GW*GH)return false;Object.assign(S,d);tiles.set(d.tiles);return true;}catch(e){return false;}
}
function offlineGain(ms){
  if(ms<60e3)return;const hrs=Math.min(ms,8*3600e3);const r=incomeRate();if(r<=0)return;
  const g=Math.floor(r*(hrs/60e3)*.6);if(g<=0)return;S.coins+=g;S.earned+=g;
  $('awayV').textContent='+'+fmt(g)+' silver';const m=Math.round(hrs/60e3);$('awayD').textContent=`Your crews kept fishing for ${m>=120?Math.round(m/60)+' hours':m+' minutes'}.`;
  $('away').hidden=false;setTimeout(()=>{$('away').hidden=true;},7000);
}
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();save();}else if(hiddenAt){offlineGain(Date.now()-hiddenAt);hiddenAt=0;refreshUI();}});
addEventListener('pagehide',save);

/* ================= boot ================= */
const loaded=load();
if(!loaded)initTiles();
{const p=parseInt(store.get('deepvale-pix'));if([2,3,4].includes(p)){PIX=p;$('btnPix').textContent='Pixels ×'+PIX;}}
buildTerrain(false);scatterOuter();updateTrees();analyzeWater();
if(loaded&&S.fishers.length){S.fishers.forEach(f=>{if(inGrid(f.i,f.j))makeFisher(f.i,f.j,f.slot,f.c??0);});}
else{const spot=[];for(let j=0;j<GH;j++)for(let i=0;i<GW;i++)if(tiles[idx(i,j)]===LAND&&nb8(i,j,WATER))spot.push([i,j]);
  const s=spot[Math.floor(spot.length/2)]||[14,8];makeFisher(s[0],s[1],1,0);}
// a few fish already in the river
{const main=comps.reduce((a,c)=>c.size>a.size?c:a,comps[0]);if(main){for(let n=0;n<3;n++)spawnFish(n<2?SP.reed:SP.koi,main,{emerge:false});}}
if(loaded)offlineGain(Date.now()-S.t);
resize();renderCodex();refreshUI();updateMarks();
$('enter').addEventListener('click',()=>{started=true;$('intro').classList.add('gone');setSound(true);
  tweenTo({x:0,y:0,z:0},innerWidth<700?20:26,5.5);
  if(!loaded||S.first){S.first=false;setTimeout(()=>log('Your fisher waits at the bank. Reedlings and koi bite for a single line.'),5200);
    setTimeout(()=>log('Clear land along the river, dig it wider, and hire more hands for bigger fish.'),9000);}
  else log('Welcome back to the valley.');
});

const clock=new THREE.Clock();let saveT=0,uiT=0;
function frame(){
  const dt=Math.min(.1,clock.getDelta());U.time.value+=dt;const t=U.time.value;
  keyPan(dt);updateCamera(dt);
  for(const f of fishes.slice()){updateFish(f,dt);updateFight(f,dt);}
  fishersState.forEach(fs=>updateFisher(fs,dt,t));
  hookTimer+=dt;if(hookTimer>.5){hookTimer=0;hookCheck();}
  spawnTick(dt);updateCine(dt);updateSparkles(dt);updateLabels();
  if(selected){selRing.position.set(selected.x,selected.g.position.y+.02,selected.z);selRing.scale.setScalar(1+Math.sin(t*5)*.12);}
  uiT+=dt;if(uiT>.5){uiT=0;refreshUI();}
  saveT+=dt;if(saveT>10){saveT=0;save();}
  renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.render(scene,camera);
  renderer.setRenderTarget(null);renderer.render(postScene,postCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (import.meta.env.DEV) window.__dv={S,fishes,fishersState,spawnFish,SP,comps:()=>comps,view,tweenTo,startCine};
