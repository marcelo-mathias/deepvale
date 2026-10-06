// Deepvale · world/terrain.js
// Terrain, the water surface, trees and rocks, and water analysis (flow, backwaters, depth).
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= terrain ================= */
const oldCh=new Uint8Array(GW*GH); // where the river used to run
function tileH(i,j){i=clamp(i,0,GW-1);j=clamp(j,0,GH-1);const k=idx(i,j),t=tiles[k];return t===WATER?BED_Y:(t===LAND?LAND_Y:t===RIM?wildH[k]+.15:wildH[k])-(oldCh[k]?.16:0);}
function innerH(x,z){
  const u=x+HX-.5,v=z+HZ-.5,i0=Math.floor(u),j0=Math.floor(v);
  const fu=smooth(.18,.82,u-i0),fv=smooth(.18,.82,v-j0);
  const h=lerp(lerp(tileH(i0,j0),tileH(i0+1,j0),fu),lerp(tileH(i0,j0+1),tileH(i0+1,j0+1),fu),fv);
  return h+(fbm(x*1.3,z*1.3,2)-.5)*.05;
}
function outerH(x,z){
  const d=dOut(x,z);
  let h=.25+(fbm(x*.12+3,z*.12-7)-.5)*.7;
  const rise=((1-Math.exp(-d*.11))*11+d*.2)*(.65+.7*fbm(x*.05,z*.05));
  h+=rise;
  // the mountain and its shoulders
  // mountains fade out toward the valley edge, so the slope rises over foothills instead of a sheer wall
  const foot=smooth(0,10,d);MTS.forEach(([mx,mz,mh,ms],n)=>{const q=Math.hypot(x-mx,(z-mz)*(n?1:1.1));h+=foot*mh*Math.exp(-(q*q)/(2*ms*ms))*(.7+.58*ridged(x*.06+n*4,z*.06+n*2));});
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
  const d=dOut(x,z);
  if(d<=0)return innerH(x,z);
  if(d<2.4)return lerp(innerH(clamp(x,-HX,HX),clamp(z,-HZ,HZ)),outerH(x,z),smooth(0,2.4,d));
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
const LINKERS=new Set([ROAD,BRIDGE,HUT,B.POST,B.MARKET,B.SHOP,B.SHRINE,B.TALEHALL]);
function linkAt(i,j){if(j<0)return i===WAY_I;if(!inGrid(i,j))return false;return LINKERS.has(builds[idx(i,j)]);}
const PAVE_COL=Object.fromEntries(PAVE_IDS.map(p=>[p,C(PAVES[p].col)]));
const deposit=new Uint8Array(GW*GH); // red clay seams found in the forest
const OLDBED=C('#a39a7a'),PATCH=C('#a89468'),CLAYC=C('#a0583a'),REDC=C('#9a5a3a');
function onRoad(i,j,fx,fz){const w=.27,cx=Math.abs(fx-.5)<w,cz=Math.abs(fz-.5)<w;if(cx&&cz)return true;
  return (cx&&fz<.5&&linkAt(i,j-1))||(cx&&fz>.5&&linkAt(i,j+1))||(cz&&fx<.5&&linkAt(i-1,j))||(cz&&fx>.5&&linkAt(i+1,j));}
function wayX(z){return tileC(WAY_I,0).x+Math.sin(z*.45+1)*.9*smooth(-HZ,-HZ-4,z);}
// the Pilgrim Way leaves the valley and climbs the slope in switchbacks, as a staircase
function wayCtrl(){const x0=tileC(WAY_I,0).x;return [[x0,-HZ],[x0,-HZ-1.4],[x0+2.3,-HZ-3.8],[x0-2.0,-HZ-6.8],[x0+2.2,-HZ-9.8],[x0-1.6,-HZ-12.8],[x0+.6,-HZ-15.6],[x0+.6,-HZ-19]];}
let WAYP=null;
function wayPath(){if(WAYP)return WAYP;const c=wayCtrl(),pts=[];
  for(let n=0;n<c.length-1;n++){const [ax,az]=c[n],[bx,bz]=c[n+1],L=Math.hypot(bx-ax,bz-az),m=Math.max(1,Math.round(L/.3));for(let s=0;s<m;s++)pts.push({x:lerp(ax,bx,s/m),z:lerp(az,bz,s/m)});}
  const e=c[c.length-1];pts.push({x:e[0],z:e[1]});return (WAYP=pts);}
function wayDist(x,z){const c=wayCtrl();let best=9;for(let n=0;n<c.length-1;n++){const [ax,az]=c[n],[bx,bz]=c[n+1],vx=bx-ax,vz=bz-az,t=clamp(((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz),0,1);best=Math.min(best,Math.hypot(x-ax-vx*t,z-az-vz*t));}return best;}
const fract=v=>v-Math.floor(v);
function colorAt(x,z,h,ny,out){
  const n=fbm(x*.7,z*.7,2);
  const i=Math.floor(x+HX),j=Math.floor(z+HZ);const inside=inGrid(i,j)&&tiles[idx(i,j)]!==RIM;
  if(h<WATER_Y-.02){out.copy(PAL.bedHi).lerp(PAL.bedLo,smooth(-.3,-1.2,h));out.multiplyScalar(.85+n*.3);return;}
  if(h<WATER_Y+.13){out.copy(PAL.sand).multiplyScalar(.85+n*.3);return;}
  if(inside&&oldCh[idx(i,j)]&&tiles[idx(i,j)]!==WATER&&builds[idx(i,j)]===NONE){out.copy(OLDBED).multiplyScalar(.82+n*.3);if(tiles[idx(i,j)]===WILD)out.lerp(PAL.wild2,.35);return;}
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
    else if((b===B.POST||b===B.MARKET||b===B.SHOP||b===B.TALEHALL||b===B.WOOD||b===B.NETS||b===B.RACK||b===B.SHRINE||b===B.STONES||b===B.STATUE)&&Math.max(Math.abs(fx-.5),Math.abs(fz-.5))<.42)out.lerp(PATCH,.6);
    return;}
  if(inside&&deposit[idx(i,j)]&&tiles[idx(i,j)]===WILD&&h>WATER_Y+.13){out.copy(PAL.wild).lerp(REDC,.55);out.multiplyScalar(.9+n*.2);return;}
  // the Pilgrim Way continues north out of the valley
  if(!inside&&z<-HZ&&z>-HZ-20&&wayDist(x,z)<.42){out.copy(PAL.rock2).lerp(PAL.path,.4).multiplyScalar(.85+n*.2);return;}
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
  for(const a of ['position','normal','color'])tGeo.attributes[a].clearUpdateRanges?.(); // a full upload, not a leftover patch
}
/* One tile changed: rebuild only the terrain around it. A vertex's height blends the four nearest tile centres, so a
   tile reaches half a tile past its own edges; colours also read the tile's neighbours (road links), so we take a full
   tile of margin. Normals reach one vertex further. Only the rows touched are sent to the GPU. */
function axisSpan(A,lo,hi){let a=-1,b=-1;for(let n=0;n<A.length;n++){if(a<0&&A[n]>=lo)a=n;if(A[n]<=hi)b=n;}return [a,b];}
function tileBox(i,j){const x0=i-HX,z0=j-HZ;
  // tiles on the valley's rim also shape the slope just outside it
  return [x0-1.5-(i<=1?3:0),x0+2.5+(i>=GW-2?3:0),z0-1.5-(j<=1?3:0),z0+2.5+(j>=GH-2?3:0)];}
function terrainNormals(a,b,c,d){ // vertex columns a..b, rows c..d; the same sums three.js computeVertexNormals makes
  const P=tPos,nr=tGeo.attributes.normal.array;
  for(let j=c;j<=d;j++)for(let i=a;i<=b;i++){const k=(j*NX+i)*3;nr[k]=nr[k+1]=nr[k+2]=0;}
  const add=(v,x,y,z)=>{const vi=v%NX,vj=(v/NX)|0;if(vi<a||vi>b||vj<c||vj>d)return;const k=v*3;nr[k]+=x;nr[k+1]+=y;nr[k+2]+=z;};
  const tri=(A,Bv,Cv)=>{const a3=A*3,b3=Bv*3,c3=Cv*3;
    const cbx=P[c3]-P[b3],cby=P[c3+1]-P[b3+1],cbz=P[c3+2]-P[b3+2],abx=P[a3]-P[b3],aby=P[a3+1]-P[b3+1],abz=P[a3+2]-P[b3+2];
    const x=cby*abz-cbz*aby,y=cbz*abx-cbx*abz,z=cbx*aby-cby*abx;add(A,x,y,z);add(Bv,x,y,z);add(Cv,x,y,z);};
  for(let cj=Math.max(0,c-1);cj<=Math.min(NZ-2,d);cj++)for(let ci=Math.max(0,a-1);ci<=Math.min(NX-2,b);ci++){
    const A=cj*NX+ci,Bv=A+1,Cv=A+NX,Dv=Cv+1;
    if((ci+cj)%2){tri(A,Cv,Bv);tri(Bv,Cv,Dv);}else{tri(A,Cv,Dv);tri(A,Dv,Bv);}}
  for(let j=c;j<=d;j++)for(let i=a;i<=b;i++){const k=(j*NX+i)*3,l=Math.hypot(nr[k],nr[k+1],nr[k+2])||1;nr[k]/=l;nr[k+1]/=l;nr[k+2]/=l;}
}
function dirtyRows(attr,r0,r1){const s=r0*NX*attr.itemSize,n=(r1-r0+1)*NX*attr.itemSize;
  if(attr.addUpdateRange)attr.addUpdateRange(s,n);else attr.updateRange={offset:s,count:n};attr.needsUpdate=true;}
function buildTerrainAt(i,j){
  const [x0,x1,z0,z1]=tileBox(i,j),[ia,ib]=axisSpan(XS,x0,x1),[ja,jb]=axisSpan(ZS,z0,z1);
  if(ia<0||ja<0||ib<ia||jb<ja){buildTerrain(true);return;}
  for(let r=ja;r<=jb;r++)for(let c=ia;c<=ib;c++){const k=(r*NX+c)*3;tPos[k+1]=heightAt(XS[c],ZS[r]);}
  const a=Math.max(0,ia-1),b=Math.min(NX-1,ib+1),c=Math.max(0,ja-1),d=Math.min(NZ-1,jb+1);
  terrainNormals(a,b,c,d);
  const nrm=tGeo.attributes.normal.array;
  for(let r=c;r<=d;r++)for(let q=a;q<=b;q++){const k=(r*NX+q)*3;colorAt(XS[q],ZS[r],tPos[k+1],nrm[k+1],tmpC);tCol[k]=tmpC.r;tCol[k+1]=tmpC.g;tCol[k+2]=tmpC.b;}
  for(const at of ['position','normal','color'])dirtyRows(tGeo.attributes[at],c,d);
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
  sh.uniforms.uTime=U.time;sh.uniforms.uWaterY={value:WATER_Y};sh.uniforms.uFlow={value:flowTex};sh.uniforms.uSeason=SEASON_U;
  sh.vertexShader='varying vec3 vWPos;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n vWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='varying vec3 vWPos;\nuniform float uTime;\nuniform float uWaterY;\nuniform vec4 uSeason;\n'+NOISE_GLSL+FLOW_GLSL+sh.fragmentShader
   .replace('#include <color_fragment>',`#include <color_fragment>
    float depthW=uWaterY-vWPos.y;
    float cloud=clouds(vWPos.xz,uTime);
    diffuseColor.rgb*=1.0-cloud*0.34;
    float stillB=0.0;
    // seasons: x = spring, y = autumn, z = snow cover
    if(depthW<-0.02){vec3 dc=diffuseColor.rgb;float green=clamp((dc.g-max(dc.r,dc.b))*6.0,0.0,1.0);
      diffuseColor.rgb=mix(dc,dc*vec3(0.95,1.12,0.9),uSeason.x*green*0.6);
      float leaf=vns(vWPos.xz*0.9)*0.6+0.4;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.62,0.46,0.2)*(0.8+0.3*leaf),uSeason.y*green*0.45);
      float cover=smoothstep(0.25,0.6,vns(vWPos.xz*0.35+3.1)*0.7+0.5*uSeason.z)*uSeason.z;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.9,0.93,0.96),cover*0.92);}
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
  uniforms:{uTime:U.time,uDusk:U.dusk,uSeason:SEASON_U,uSun:{value:SUN_DIR},uView:{value:CAM_DIR},uFog:{value:FOG},uFogNear:{value:210},uFogFar:{value:400},uFlow:{value:flowTex},uHeat:{value:heatU}},
  vertexShader:`varying vec3 vW;varying float vFogD;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vec4 mv=viewMatrix*w;vFogD=-mv.z;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float uTime;uniform float uDusk;uniform vec4 uSeason;uniform vec3 uSun;uniform vec3 uView;uniform vec3 uFog;uniform float uFogNear;uniform float uFogFar;uniform vec4 uHeat[${HEATN}];varying vec3 vW;varying float vFogD;
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
    col=mix(col,col*vec3(0.45,0.55,0.75),uDusk*0.7);
    // winter: still water and the shallow edges freeze over
    float ice=uSeason.z*clamp(still+(1.0-live)*0.3,0.0,1.0)*smoothstep(0.2,0.5,vns(p*1.3)+0.3);col=mix(col,vec3(0.72,0.82,0.88)*(1.0-uDusk*0.6)+vec3(1.0)*spec*0.4,ice*0.9);
    float a=clamp(0.2+fres*0.35+shaft*0.1*live+spec*0.6+still*0.42+str*0.1+heat*0.12+ice*0.6,0.0,0.96);
    float f=smoothstep(uFogNear,uFogFar,vFogD);col=mix(col,uFog,f);a=mix(a,1.0,f);
    gl_FragColor=vec4(col,a);
  }`
});
const water=new THREE.Mesh(new THREE.PlaneGeometry(250,250).rotateX(-Math.PI/2),waterMat);
water.position.y=WATER_Y;water.renderOrder=2;scene.add(water);

/* ================= trees & rocks ================= */
// a pine in three tiers, each a little narrower, turned against the one below, and lighter toward the tip
const coneG=(()=>{const tiers=[[.22,.3,.18,.82],[.17,.27,.36,.94],[.12,.24,.52,1.04],[.065,.15,.7,1.12]];
  const parts=tiers.map(([r,h,y,shade],n)=>{const g=new THREE.ConeGeometry(r,h,6,1,true).rotateY(n*.52).translate(0,y+h/2,0); // open underneath: never seen from above, and half the triangles
    const cnt=g.attributes.position.count,col=new Float32Array(cnt*3);for(let q=0;q<cnt;q++){const yy=g.attributes.position.getY(q),f=shade*(.68+.32*(yy-y)/h);col[q*3]=col[q*3+1]=col[q*3+2]=f;}
    g.setAttribute('color',new THREE.BufferAttribute(col,3));return g;});
  return mergeGeometries(parts);})();
const trunkG=new THREE.CylinderGeometry(.025,.035,.2,4).translate(0,.1,0);
const MAXT=24000;
const foliage=new THREE.InstancedMesh(coneG,rimMat({color:'#ffffff',vertexColors:true},'#ffc98a',.7),MAXT);
const trunks=new THREE.InstancedMesh(trunkG,rimMat({color:'#5a4330'},'#ffc98a',.3),MAXT);
foliage.castShadow=trunks.castShadow=true;foliage.receiveShadow=true;
scene.add(foliage,trunks);
const trees=[];// {x,z,s,tile,col}
const treeCols=['#2f5a2b','#3c6b30','#27502a','#4a7a36','#6d7f33','#8a7a2e'].map(C);
// h stretches a tree up, w narrows it: stout pines, tall thin spruces, and now and then an old giant
function addTree(x,z,s,tile){const tall=Math.random()<.3,giant=Math.random()<.06;
  trees.push({x,z,s:s*(giant?1.15:1),tile,sea:Math.random(),h:giant?rand(1.55,1.9):tall?rand(1.2,1.5):rand(.75,1.15),w:tall?rand(.72,.88):rand(.9,1.12),
    col:treeCols[Math.random()<.9?Math.floor(Math.random()*4):4+Math.floor(Math.random()*2)],r:Math.random()*6});}
const treeScale=(t,sc)=>s4.set(sc*t.w,sc*t.h,sc*t.w);
for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const c=tileC(i,j);const n=2+Math.floor(hash2(i*3.1,j*7.7)*2.4);
  for(let k=0;k<n;k++)addTree(c.x+rand(-.38,.38),c.z+rand(-.38,.38),rand(.9,1.5),idx(i,j));}
// a thick band of forest on the foothills first, so the slopes rising from the valley are wooded, not bare
function scatterFoothills(){let tries=0,n=0;
  while(n<5200&&trees.length<MAXT-40&&tries<60000){tries++;const x=rand(-HX-14,HX+14),z=rand(-HZ-16,HZ+10);
    const dd=dOut(x,z);if(inPlay(x,z)||dd>14)continue;
    if(z<-HZ&&z>-HZ-21&&wayDist(x,z)<.75)continue;if(Math.abs(z-riverZ(x))<3.2)continue;
    const h=heightAt(x,z);if(h<.3||h>18)continue;const e=.4,sl=Math.hypot(heightAt(x+e,z)-heightAt(x-e,z),heightAt(x,z+e)-heightAt(x,z-e));if(sl>2.2)continue;
    if(fbm(x*.11+5,z*.11-9,3)<.34*smooth(1.5,7,dd)+(dd>4?.06:0))continue;addTree(x,z,rand(1,1.8)*(1-h/40),-1);n++;} // thick right at the valley's edge, thinning into glades
}
function scatterOuter(){scatterFoothills();let tries=0;
  while(trees.length<MAXT-40&&tries<90000){tries++;const x=rand(-100,100),z=rand(-100,72);
    if(inPlay(x,z))continue;
    if(z<-HZ&&z>-HZ-21&&wayDist(x,z)<.75)continue;
    if(Math.abs(z-riverZ(x))<3.2&&Math.abs(x)>HX)continue;
    const h=heightAt(x,z);if(h<.3||h>21)continue;
    const e=.4,nx=heightAt(x+e,z)-heightAt(x-e,z),nz=heightAt(x,z+e)-heightAt(x,z-e),sl=Math.hypot(nx,nz);if(sl>1.7)continue;
    const dd=dOut(x,z);
    if(fbm(x*.09+11,z*.09-3,3)<(dd<9?.3:.46)+sl*.08)continue;
    addTree(x,z,rand(1.1,2.1)*(1-h/30),-1);}
}
const m4=new THREE.Matrix4(),q4=new THREE.Quaternion(),s4=new THREE.Vector3(),p4=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0);
function updateTrees(box){ // box: [x0,x1,z0,z1] to touch only the trees inside it
  trees.forEach((t,k)=>{if(box&&(t.x<box[0]||t.x>box[1]||t.z<box[2]||t.z>box[3]))return;const show=(t.tile<0||tiles[t.tile]===WILD)&&!t.gone;
    p4.set(t.x,heightAt(t.x,t.z)-.03,t.z);q4.setFromAxisAngle(yAxis,t.r);treeScale(t,show?t.s:0);
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

