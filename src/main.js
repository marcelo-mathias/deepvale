import { version as VERSION } from '../package.json';
import { emblem, EMBLEMS } from './ui/emblems.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp, smooth, rand, hash2, fbm, ridged, fmt, store } from './core/utils.js';
import { GW, GH, HX, HZ, WATER_Y, BED_Y, LAND_Y, WILD, LAND, WATER, EDGE as RIM, idx, tileC, inGrid, riverZ, setRiver, randomRiver,
  NONE, HUT, ROAD, BRIDGE, WAY_I, DECK_Y, HOUSING, mouthRows, LEGACY_GRIDS, GROW } from './world/constants.js';
import { B, DEFS, DEF_BY_CODE, CATS, GOODS, GOOD_IDS, RESERVE, STYLES, STYLE_IDS, PAVES, PAVE_IDS, STATUE_FX, BLUEPRINTS,
  KEEPERS, KEEPER, BOONS, BOON, SETS, SET } from './data/builds.js';
import { makeSecrets, makeChannels, SECRET_TYPES } from './world/secrets.js';
import { makeRoads } from './render/roads.js';
import { makeProps } from './render/props.js';
import { makeTrade } from './game/trade.js';
import { makeTally } from './ui/tally.js';
import { icon } from './ui/icons.js';
import { makeBuildingIcons } from './ui/bldgicons.js';
import { portrait } from './ui/portraits.js';
import { SPECIES, SP } from './data/species.js';
import { LORE, TALE_AT, VILLAGE_NAMES } from './data/lore.js';
import { NOISE_GLSL, RIM_FRAG, BEND_VERT, BEND_DECL } from './render/shaders.js';
import { setSound as setAudio, sfx, isSoundOn, setView as setAudioView, playTheme, worldSound, setWeatherSound, reelTension } from './audio/audio.js';
import { makeFlow, solveFlow } from './world/flow.js';
import { makeWisps } from './render/wisps.js';
import { makeVillage } from './render/village.js';
import { initMap } from './ui/map.js';
import { makeBloom } from './render/bloom.js';
import { makeLamps, LAMP_GLSL } from './render/lamps.js';
import { makeMenu } from './ui/menu.js';
import { cardHTML, animateCard, chooseCard, CARD_COL } from './ui/cards.js';
import { makeReel } from './ui/reel.js';
import { makeTour } from './ui/tour.js';
import { makeWeather } from './render/weather.js';
import { makeWildlife } from './render/wildlife.js';
import { makeGiants, GIANTS } from './render/giants.js';

function setSound(on){ setAudio(on); const b=document.getElementById('btnSound'); b.textContent = on ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed',on); }

/* ================= state ================= */
// scales: shed by released fish, pay for river and building work. silver: pilgrims leave it at the Tale House and spend it at markets; trade brings more. It pays fishers and upgrades.
// goods: timber, reeds, clay (raw) and carvings, lanterns (crafted). meta: per-tile extras {style, pave, sp}. counts: how many of each build (for costs).
const S={scales:20,silver:10,tiles:null,builds:null,fishers:[],hires:0,clears:0,digs:0,huts:0,bridges:0,lineLv:0,baitLv:0,codex:{},hutVillage:{},earned:0,income:[],t:Date.now(),first:true,
  goods:{timber:10,reeds:0,clay:0,carvings:0,lanterns:0},reserve:{...RESERVE},meta:{},counts:{},keepers:[],boons:{},unlocked:{},seed:0,found:[],deposits:[],
  orders:[],ordersDone:0,shipments:0,wish:null,wishesDone:0,wishBase:null,tide:{n:0,t:0},sets:{},small:0,sIncome:[],hutStyle:'thatch',pave:'gravel',statueSp:null,crates:0,ship:{},drops:[],dropT:0,v:3};
let booted=false,timeScale=1;const debugSpeed={reel:1,spawn:1,trade:1,prod:1},debugFlags={frenzy:false,allHints:false};
const tiles=new Uint8Array(GW*GH);
const builds=new Uint8Array(GW*GH);
let INLET=mouthRows(0),OUTLET=mouthRows(GW-1);
// mountains around the valley: [x, z, height, spread]; new games shift them about
let MTS=[[-31,-52,40,14],[-82,-14,19,11],[20,-80,24,14],[-74,-70,16,12]];
const wildH=new Float32Array(GW*GH);
for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){wildH[idx(i,j)]=.2+fbm(i*.41+3,j*.41+9,3)*.42;}
// the valley's own outline: a rounded, lumpy shape inside the grid, different for every rolled valley.
// shapeF < 1 inside. Near the river (where it enters and leaves) and the Pilgrim Way it keeps to the grid's edge.
let SHAPE=null;
function setShape(map){const seed=map?.seed;if(!seed){SHAPE=null;return;}let s=(seed^0x51ed270b)>>>0;const R=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  SHAPE={p:2.3+R()*1.1,ox:R()*90,oz:R()*90,amp:.1+R()*.08,lobes:[0,1,2].map(()=>({k:2+Math.floor(R()*4),ph:R()*6.28,a:.025+R()*.04}))};}
function shapeF(x,z){if(!SHAPE)return Math.max(Math.abs(x)/HX,Math.abs(z)/HZ);
  const u=Math.abs(x)/HX,v=Math.abs(z)/HZ,P=SHAPE.p,rs=Math.pow(Math.pow(u,P)+Math.pow(v,P),1/P),rm=Math.max(u,v);
  const nearRiver=smooth(7,2.5,Math.abs(z-riverZ(x))),nearWay=z<0?smooth(7,3,Math.abs(x-tileC(WAY_I,0).x)):0,keep=Math.max(nearRiver,nearWay);
  const th=Math.atan2(z/HZ,x/HX);let n=(fbm(x*.06+SHAPE.ox,z*.06+SHAPE.oz,3)-.5)*2*SHAPE.amp;for(const l of SHAPE.lobes)n+=Math.sin(th*l.k+l.ph)*l.a;
  return lerp(rs+.04+n,rm,keep);}
// how far outside the valley floor a point is, in world units (0 inside)
const dOut=(x,z)=>Math.max(Math.hypot(Math.max(0,Math.abs(x)-HX),Math.max(0,Math.abs(z)-HZ)),Math.max(0,shapeF(x,z)-1)*(HX+HZ)*.5);
const inPlay=(x,z)=>{const i=Math.floor(x+HX),j=Math.floor(z+HZ);return inGrid(i,j)&&tiles[idx(i,j)]!==RIM;};
function initTiles(T=tiles){
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const c=tileC(i,j);const d=Math.abs(c.z-riverZ(c.x));T[idx(i,j)]=d<1.6?WATER:WILD;}
  // a little clearing on the north bank, mid-valley
  for(let i=WAY_I-2;i<=WAY_I+2;i++){for(let j=0;j<GH;j++){const c=tileC(i,j);const d=c.z-riverZ(c.x);if(d<0&&d>-2.8&&T[idx(i,j)]===WILD)T[idx(i,j)]=LAND;}}
  // every rolled valley also has a few natural meadows and forest ponds of its own
  const seed=S.map?.seed;if(!seed)return;let s=(seed^0x9e3779b9)>>>0;const R=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  const blob=(n,minRiver,rmin,rmax,type)=>{for(let q=0;q<n;q++)for(let t=0;t<40;t++){const i=3+Math.floor(R()*(GW-6)),j=2+Math.floor(R()*(GH-4)),c=tileC(i,j);
      if(Math.abs(c.z-riverZ(c.x))<minRiver||Math.abs(i-WAY_I)<4)continue;const rx=rmin+R()*(rmax-rmin),rz=rmin+R()*(rmax-rmin);
      for(let b=-3;b<=3;b++)for(let a=-3;a<=3;a++){if((a/rx)**2+(b/rz)**2>1||!inGrid(i+a,j+b))continue;const k=idx(i+a,j+b);if(T[k]===WILD)T[k]=type;}break;}};
  blob(2+Math.floor(R()*3),4,1.3,2.6,LAND);blob(1+Math.floor(R()*2),5,.9,1.6,WATER);
  carveEdge(T);
}
// everything past the valley's outline becomes unreachable forest (the river keeps running through it)
function carveEdge(T=tiles,saved=false){if(!SHAPE)return;for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=idx(i,j),c=tileC(i,j);if(shapeF(c.x,c.z)<1)continue;
    if(Math.abs(c.z-riverZ(c.x))<1.6&&T[k]===WATER)continue;if(saved&&(T[k]!==WILD||builds[k]!==NONE||Object.values(S.lm||{}).some(q=>Math.abs(q%GW-i)<=3&&Math.abs(((q/GW)|0)-j)<=3)))continue;T[k]=RIM;}}
// the Pilgrim Way comes down from the north edge to a first hut near the clearing
function initBuilds(){
  builds.fill(NONE);placeWeir();let end=0;
  for(let j=0;j<GH-2;j++){const k=idx(WAY_I,j);if(tiles[k]===WATER)break;tiles[k]=LAND;builds[k]=ROAD;end=j;
    if(tiles[idx(WAY_I,j+2)]===WATER||tiles[idx(WAY_I,j+1)]===WATER)break;}
  let hutI=-1;for(const di of [-1,1]){const i=WAY_I+di,k=idx(i,end);if(tiles[k]!==WATER){tiles[k]=LAND;builds[k]=HUT;hutI=i;break;}}
  // and a trading post across the road from it, with its wagon, so goods can leave the valley from the start
  for(const [di,dj] of [[WAY_I-hutI,0],[WAY_I-hutI,-1],[hutI-WAY_I,-1]]){const i=WAY_I+di,j=end+dj,k=idx(i,j);
    if(inGrid(i,j)&&tiles[k]!==WATER&&builds[k]===NONE&&nbLinkStrict(i,j)){tiles[k]=LAND;builds[k]=B.POST;break;}}
  placeTaleHouse();
}
// every village starts with a Tale House on the Way, near the first hut
function placeTaleHouse(){
  if(builds.includes(B.TALEHALL))return false;
  const h=builds.indexOf(HUT),hi=h>=0?h%GW:WAY_I,hj=h>=0?(h/GW)|0:6;let best=-1,bd=1e9;
  for(let k=0;k<GW*GH;k++){const i=k%GW,j=(k/GW)|0;if(tiles[k]===WATER||builds[k]!==NONE||!nbLinkStrict(i,j)||oldCh[k])continue;
    const d=Math.hypot(i-hi,j-hj)+(j<2?3:0);if(d<bd){bd=d;best=k;}}
  if(best<0)return false;tiles[best]=LAND;builds[best]=B.TALEHALL;S.counts.talehall=Math.max(1,S.counts.talehall||0);return true;}
function placeWeir(){if(S.weirGone)return;const i=6;for(let j=0;j<GH;j++){const k=idx(i,j);if(tiles[k]===WATER&&builds[k]===NONE)builds[k]=B.WEIR;}}
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
Object.assign(sun.shadow.camera,{left:-62,right:62,top:62,bottom:-62,near:1,far:360});
sun.shadow.mapSize.set(3072,3072);
sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
scene.add(sun,sun.target);
const hemi=new THREE.HemisphereLight(new THREE.Color('#a6c8d6'),new THREE.Color('#3b3122'),1.15);scene.add(hemi);
// the giants carry their own light; at dusk it is most of the light there is
const giantLight=new THREE.PointLight(new THREE.Color('#ffc861'),0,10,1.4);giantLight.position.set(0,-50,0);scene.add(giantLight);
const FOG0=new THREE.Color('#d9b995'),NIGHT_FOG=new THREE.Color('#2a3446');
const DUSK_OF={sturgeon:.45,eel:.7,moon:1,warden:1};let dusk=0,giantDusk=0,duskLvl=0,duskT=0;
/* ---- the day: dawn, morning, midday, golden hour, dusk, night. One day is 16 minutes of play ---- */
const DAY_LEN=960;
const PHASES=[[0,'Dawn'],[.08,'Morning'],[.3,'Midday'],[.5,'Golden hour'],[.68,'Dusk'],[.78,'Night'],[.97,'Dawn']];
const SEASONS=['Spring','Summer','Autumn','Winter'];
const phaseName=t=>{let n='Dawn';for(const [a,b] of PHASES)if(t>=a)n=b;return n;};
// keyframes: time, sun colour, sun strength, fog colour
const SKY=[[0,'#ffb49a',2.4,'#d9a898'],[.08,'#ffe2c0',3.3,'#dcc2a4'],[.3,'#fff2de',3.7,'#d8cdb4'],[.5,'#ffd2a1',3.4,'#d9b995'],[.68,'#ff9f6a',2.8,'#c98f78'],[.78,'#9fb2ff',1.2,'#2a3446'],[.95,'#9fb2ff',1.2,'#2a3446'],[1,'#ffb49a',2.4,'#d9a898']].map(([t,c,i,f])=>[t,new THREE.Color(c),i,new THREE.Color(f)]);
function skyAt(t){for(let n=0;n<SKY.length-1;n++){const a=SKY[n],b=SKY[n+1];if(t>=a[0]&&t<=b[0]){const k=(t-a[0])/(b[0]-a[0]||1);return {col:a[1].clone().lerp(b[1],k),i:lerp(a[2],b[2],k),fog:a[3].clone().lerp(b[3],k)};}}return {col:SKY[0][1].clone(),i:SKY[0][2],fog:SKY[0][3].clone()};}
const nightOf=t=>t<.68?0:t<.78?smooth(.68,.78,t)*.7:t<.95?.7:(1-smooth(.95,1,t))*.7;
let night=0;
function clockTick(dt){S.clock=S.clock||{t:.12,day:1};S.clock.t+=dt/DAY_LEN;if(S.clock.t>=1){S.clock.t-=1;S.clock.day++;if(booted)log(`${calendar().season} day ${calendar().dom} begins.`);}}
function calendar(){const d=(S.clock?.day||1)-1;return {year:Math.floor(d/28)+1,season:SEASONS[Math.floor(d/7)%4],dom:d%7+1,phase:phaseName(S.clock?.t||0)};}
function updateDusk(dt){duskT-=dt;const target=duskT>0?duskLvl:0;giantDusk+=(target-giantDusk)*Math.min(1,dt*(target>giantDusk?.45:.25));
  const ct=S.clock?.t??.12,sk=skyAt(ct);night=nightOf(ct);dusk=Math.max(giantDusk,night);
  sun.color.copy(sk.col);sun.intensity=sk.i*(1-.6*giantDusk);hemi.intensity=1.15*(1-.62*dusk);FOG.copy(sk.fog).lerp(NIGHT_FOG,giantDusk*.75);U.dusk.value=dusk;
  village.setNight(night);props.setGlow(1+night*1.6);
  // the brightest glowing giant lights the water and banks around it
  let g=null;for(const f of fishes){if(!f.sp.glow||!f.sp.awe||f.state==='leave')continue;if(!g||f.sp.len>g.sp.len)g=f;}
  if(g){const vis=clamp((g.emerge-.3)/.7,0,1)*(g.state==='release'?1-Math.min(1,g.out):1);giantLight.color.set(g.sp.glow);giantLight.position.set(g.x,WATER_Y+.35,g.z);
    giantLight.distance=4+g.sp.len*.7;giantLight.intensity=(1.5+9*dusk)*vis*(1+.25*Math.sin(U.time.value*1.7));
    if(started&&vis>.5&&Math.random()<dt*(4+14*dusk)){const t=rand(-.5,.5);sparkle(g.x+Math.sin(g.h)*t*g.sp.len+rand(-.8,.8),WATER_Y+rand(.1,.9),g.z+Math.cos(g.h)*t*g.sp.len+rand(-.8,.8),g.sp.glow);}}
  else giantLight.intensity=0;
}

const U={time:{value:0},sunView:{value:new THREE.Vector3()},dusk:{value:0}};
const SEASON_U={value:new THREE.Vector4(0,0,0,0)}; // spring, autumn, snow, -


/* rim light shared by objects: bright edge on the sun-facing silhouette */
function rimMat(params,rimColor='#ffd9a8',rimStr=.9){
  const m=new THREE.MeshStandardMaterial(Object.assign({flatShading:true,roughness:.85,metalness:0},params));
  const rc={value:new THREE.Color(rimColor)},rs={value:rimStr};
  m.onBeforeCompile=sh=>{sh.uniforms.uRimColor=rc;sh.uniforms.uRimStr=rs;sh.uniforms.uSunView=U.sunView;
    sh.fragmentShader='uniform vec3 uRimColor;uniform float uRimStr;uniform vec3 uSunView;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',RIM_FRAG);};
  return m;
}

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
function updateTrees(){
  trees.forEach((t,k)=>{const show=(t.tile<0||tiles[t.tile]===WILD)&&!t.gone;
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
    case 'moss':band('#303c2c','#a4a488');for(let n=0;n<140;n++){const x=3+R()*56,y=8+(R()-.5)*14;px(g,x,y,R()<.5?'#6f8f45':'#8aa653');if(R()<.22)px(ge,x,y,R()<.5?'#6fd04a':'#b6f07a');}
      for(let x=6;x<58;x+=5){px(g,x,8,'#d9cfaa');px(g,x+1,8,'#d9cfaa');px(g,x+2,3,'#bfb593');px(g,x+2,13,'#bfb593');}break;
    case 'lantern':band('#131732','#3a3e66');for(let x=5;x<60;x+=4){for(const y of [3,13,21,27]){px(g,x,y,'#bff7ff');px(ge,x,y,'#8ff0ff');}}px(ge,4,8,'#8ff0ff');break;
    case 'moon':band('#dfe6f0','#f7f9fc');for(let y=0;y<H;y+=2)for(let x=4+(y%4?1:0);x<60;x+=3)px(g,x,y,'#b2c0d6');
      for(let x=6;x<58;x+=2)if(R()<.5)px(ge,x,8+(R()-.5)*8,'#6f86b8');for(let n=0;n<34;n++)px(ge,6+R()*50,8+(R()-.5)*14,'#dbe6ff');for(let x=5;x<60;x+=3)px(ge,x,8,'#9fb4ff');break;
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
    // on the line it mostly tires, but every so often it surges away from the crew
    if(f.state==='hooked'){f.surgeT=(f.surgeT??rand(5,9))-dt;if(f.surgeT<0){if(reel.fish===f&&reel.busy&&!(f.surgeHold>1.5)){f.surgeT=.05;f.surgeHold=(f.surgeHold||0)+dt;}else{f.surge=2.4;f.surgeT=rand(7,13);f.surgeHold=0;}}if(f.surge>0)f.surge-=dt;} // a surge waits for the light to pass the arc
    let want=f.state==='hooked'?base*(f.surge>0?.45:.1):base*(0.8+0.2*Math.sin(f.age*.3+f.id*10));
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
    }else{f.turn=Math.sin(f.age*2.3)*.25;if(f.surge>0&&f.hookers.length){let cx=0,cz=0;f.hookers.forEach(fs=>{cx+=fs.x;cz+=fs.z;});cx/=f.hookers.length;cz/=f.hookers.length;f.h+=angDiff(Math.atan2(f.x-cx,f.z-cz),f.h)*dt*.8;}}
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
  if(sp.glow)f.mat.emissiveIntensity=(1.6+Math.sin(f.age*(sp.pattern==='warden'?.9:1.7))*.8)*(1+dusk*(sp.awe?1.6:.6));
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
  const line=new THREE.Line(lineGeo,lineM.clone());line.frustumCulled=false;
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
function removeFisherMeshes(fs){scene.remove(fs.g,fs.line,fs.bobMesh);fs.line.geometry.dispose();fs.line.material.dispose();}
// how far a line reaches from the rod before it strains and snaps
const maxLine=fs=>{const b=builds[idx(fs.i,fs.j)];return 3.2+(b===BRIDGE||b===B.PIER?.6:0);};
const LINE_OK=new THREE.Color('#eaf3ee'),LINE_TAUT=new THREE.Color('#ff7a4a');

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
// dithered building icons for the toolbar and Build drawer: rendered from these models, or the painted set (Settings)
const bicons=makeBuildingIcons({renderer,props,rimMat,camDir:CAM_DIR,sunDir:SUN_DIR,onPainted:()=>{clearTimeout(paintT);paintT=setTimeout(()=>{setToolArt();renderDrawer();},50);}});let paintT=0;let iconSet='models';
const statueMats={stone:rimMat({color:'#a39d92'},'#ffe6c0',1),bronze:rimMat({color:'#9a7440',metalness:.3,roughness:.5},'#ffd9a0',1.2),gold:rimMat({color:'#d9a94a',metalness:.55,roughness:.35,emissive:new THREE.Color('#5a3a10'),emissiveIntensity:.35},'#fff0c0',1.5)};
// the carving for a statue: the fish's own shape, centred so it sits on the plinth
// carved in stone, recast in bronze at the second level, gilded at the third
function statueFish(id,lvl=1){const sp=SP[id]||SP.koi,geo=fishGeoCache[sp.id]||(fishGeoCache[sp.id]=fishGeometry(sp));const m=new THREE.Mesh(geo,lvl>=3?statueMats.gold:lvl>=2||sp.awe?statueMats.bronze:statueMats.stone);
  geo.boundingBox||geo.computeBoundingBox();const c=geo.boundingBox.getCenter(new THREE.Vector3()),sc=.78/sp.len*(sp.eel?1.2:1);
  m.scale.setScalar(sc);m.position.copy(c).multiplyScalar(-sc);m.castShadow=true;const g=new THREE.Group();g.add(m);return g;}
const roads=makeRoads({scene,heightAt,isRoad:(i,j)=>builds[idx(i,j)]===ROAD,paveAt:(i,j)=>S.meta[idx(i,j)]?.pave||'dirt',linkAt,tileC,GW,GH});
const village=makeVillage({scene,rimMat,heightAt,tiles,builds,wayPts:()=>wayPath(),deco:()=>({corners:S.corners||{},edges:S.edges||{}}),meta:()=>S.meta,emit:wisps.emit,wayX,props,isLive:k=>isLive(k),statueFish,lore:()=>({tales:allTales(),met:SPECIES.filter(s=>S.codex[s.id]).map(s=>s.id)})});

/* ================= seasons, weather, wildlife and the giants ================= */
// the season as weights [spring, summer, autumn, winter]; each season blends into the next over its last day
function seasonW(){const d=((S.clock?.day||1)-1)+(S.clock?.t||0),p=(d/7)%4,i=Math.floor(p),f=smooth(6/7,1,p-i),w=[0,0,0,0];w[i]+=1-f;w[(i+1)%4]+=f;return w;}
const LEAF=['#c8662e','#d8963a','#b84a2a','#c9a83a'].map(C),BLOSSOM=C('#e8a6bc'),BARE=C('#7a6a5c'),SNOWC=C('#e8eef2');
let seasonKey='',seasonCT=0;const _sc=new THREE.Color(),_sa=new THREE.Color();
function seasonTick(dt){seasonCT-=dt;if(seasonCT>0)return;seasonCT=2;
  const w=seasonW(),key=w.map(v=>v.toFixed(2)).join();SEASON_U.value.set(w[0],w[2],w[3]*.95,0);if(key===seasonKey)return;seasonKey=key;
  // trees: a third of them are broadleaf, and turn; everything else darkens and catches snow
  trees.forEach((t,k)=>{const b=t.col,dec=t.sea<.36;_sc.setRGB(0,0,0);
    _sa.copy(t.sea<.07?BLOSSOM:b).multiplyScalar(t.sea<.07?1:1.12);_sc.r+=_sa.r*w[0];_sc.g+=_sa.g*w[0];_sc.b+=_sa.b*w[0];
    _sc.r+=b.r*w[1];_sc.g+=b.g*w[1];_sc.b+=b.b*w[1];
    _sa.copy(dec?LEAF[Math.floor(t.sea*97)%4]:b).multiplyScalar(dec?1:.9);_sc.r+=_sa.r*w[2];_sc.g+=_sa.g*w[2];_sc.b+=_sa.b*w[2];
    _sa.copy(dec?BARE:b).lerp(SNOWC,dec?.25:.42);_sc.r+=_sa.r*w[3];_sc.g+=_sa.g*w[3];_sc.b+=_sa.b*w[3];
    foliage.setColorAt(k,_sc);});
  if(foliage.instanceColor)foliage.instanceColor.needsUpdate=true;}
const seasonNow=()=>calendar().season;

// weather: a little state machine that rolls something new every few minutes, by season
const WEATHER={clear:'clear skies',rain:'rain',storm:'a storm',fog:'fog',snow:'snow'};
const W_ODDS={Spring:{clear:.5,rain:.3,storm:.04,fog:.16},Summer:{clear:.62,rain:.14,storm:.1,fog:.14},Autumn:{clear:.38,rain:.3,storm:.06,fog:.26},Winter:{clear:.35,fog:.2,snow:.45}};
const weather=makeWeather(scene);let wMist=0,wGloom=0,wSnow=0,flash=0,boltT=10;
function rollWeather(){const o=W_ODDS[seasonNow()];let r=Math.random(),k='clear';for(const [kk,p] of Object.entries(o)){r-=p;if(r<=0){k=kk;break;}}
  const prev=S.weather?.k;S.weather={k,left:rand(240,540)};if(booted&&k!==prev&&k!=='clear')log({rain:'Rain moves in over the valley. Fish rise to it.',storm:'A storm is coming down the valley. The fish are restless: they rise more often while it lasts.',fog:'Fog settles in the low ground.',snow:'Snow begins to fall. The backwaters freeze at the edges.'}[k]);}
const weatherFish=()=>({rain:1.25,storm:1.5,fog:1.1}[S.weather?.k]||1);
function weatherTick(dt,t){
  if(!S.weather||(S.weather.left-=dt)<=0||(S.weather.k==='snow'&&seasonNow()!=='Winter'))rollWeather();
  const k=S.weather.k,sw=seasonW();
  const tm={fog:.3,rain:.04,storm:.07,snow:.05}[k]||0,tg={rain:.3,storm:.55,snow:.15,fog:.12}[k]||0; // kept light: the valley must stay readable
  wMist+=(tm-wMist)*Math.min(1,dt*.15);wGloom+=(tg-wGloom)*Math.min(1,dt*.15);wSnow+=((k==='snow'?1:0)-wSnow)*Math.min(1,dt*.15);
  postMat.uniforms.uMist.value=wMist;postMat.uniforms.uGloom.value=wGloom;postMat.uniforms.uSnowSky.value=wSnow;
  // lightning: a flash, then the thunder a moment later
  if(k==='storm'){boltT-=dt;if(boltT<0){boltT=rand(7,20);flash=1;const d=rand(.6,2.4);setTimeout(()=>worldSound('thunder',rand(-.6,.6),.9),d*1000);}}
  flash=Math.max(0,flash-dt*3.5);postMat.uniforms.uFlash.value=flash*flash*.3*(Math.random()<.85?1:0);
  // what falls: weather first, else petals in spring and leaves in autumn
  if(k==='rain'||k==='storm'||k==='snow')weather.set(k,1);else if(sw[0]>.5)weather.set('petals',sw[0]*.8);else if(sw[2]>.5)weather.set('leaves',sw[2]);else weather.set('none',0);
  weather.update(dt,t,view,(x,z)=>Math.max(heightAt(x,z),WATER_Y));
  setWeatherSound(k,started?1:0);
}

// wildlife: on the backwaters and at the forest's edge, more of it as the valley heals
const wildlife=makeWildlife({scene,rimMat,heightAt,WATER_Y});let wildT=3;
const stillK=k=>tiles[k]===WATER&&!FLOW.live[k];
function wildSpot(kind){
  const pick=f=>{for(let n=0;n<400;n++){const k=Math.floor(Math.random()*GW*GH);if(f(k))return k;}return -1;};
  const at=(k,j=.3)=>{const c=tileC(k%GW,(k/GW)|0);return {x:c.x+rand(-j,j),z:c.z+rand(-j,j),k};};
  if(kind==='duck'||kind==='fly'){const k=pick(stillK);return k<0?null:at(k);}
  if(kind==='heron'){const k=pick(q=>stillK(q)&&nb4(q%GW,(q/GW)|0,LAND));if(k<0)return null;const i=k%GW,j=(k/GW)|0;
    for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]])if(inGrid(i+a,j+b)&&tiles[idx(i+a,j+b)]===LAND){const c=tileC(i,j);return {x:c.x+a*.42,z:c.z+b*.42,k};}return null;}
  if(kind==='deer'){const edge=q=>{const i=q%GW,j=(q/GW)|0;return [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>inGrid(i+a,j+b)&&tiles[idx(i+a,j+b)]!==WILD&&tiles[idx(i+a,j+b)]!==RIM);};const k=pick(q=>tiles[q]===WILD&&edge(q));return k<0?null:at(k,.35);}
}
function wildTick(dt,t){
  wildT-=dt;if(wildT<0){wildT=6;const h=health/100,sw=seasonW(),day=night<.2,warm=sw[0]+sw[1]>.5;
    wildlife.sync({heron:Math.min(3,Math.floor(stillCount/9*(.4+h))),duck:Math.min(6,Math.floor(stillCount/5*(.3+h))),fly:warm&&day&&!['rain','storm'].includes(S.weather?.k)?Math.min(8,Math.floor(stillCount/4)):0,deer:Math.min(6,1+Math.floor(h*5))},
      {heron:()=>wildSpot('heron'),duck:()=>wildSpot('duck'),fly:()=>wildSpot('fly'),deer:()=>wildSpot('deer')});}
  wildlife.update(dt,t,{night:night>.45,flies:true,frozen:SEASON_U.value.z>.6,stillAt:(x,z)=>{const i=Math.floor(x+HX),j=Math.floor(z+HZ);return inGrid(i,j)&&stillK(idx(i,j));},
    busyNear:(x,z)=>workers.some(w=>w.g.visible&&Math.hypot(w.x-x,w.z-z)<1.2),spot:()=>wildSpot('deer')});
  // frogs at dusk on the backwaters
  if(started&&stillCount&&dusk>.2&&dusk<.85&&SEASON_U.value.z<.5&&Math.random()<dt*.35){const p=wildSpot('duck');if(p)soundAt('frog',p.x,p.z);}
}

// the giants of the high country
// spots in the live river for the whale to leap from: every bridge, and a handful of open water
function whaleSpots(){const out=[];const dirAt=(i,j)=>{const W=(a,b)=>inGrid(a,b)&&tiles[idx(a,b)]===WATER;const wx=W(i-1,j)&&W(i+1,j),wz=W(i,j-1)&&W(i,j+1);
    if(wx&&!wz)return [1,0];if(wz&&!wx)return [0,1];const c=tileC(i,j),d=riverZ(c.x+.5)-riverZ(c.x-.5),l=Math.hypot(1,d);return [1/l,d/l];};
  for(let k=0;k<GW*GH;k++){const i=k%GW,j=(k/GW)|0;if(builds[k]===BRIDGE&&tiles[k]===WATER){const c=tileC(i,j),[dx,dz]=dirAt(i,j);out.push({x:c.x,z:c.z,dx,dz,bridge:true});}}
  for(let n=0;n<400&&out.length<40;n++){const k=Math.floor(Math.random()*GW*GH);if(!isLive(k))continue;const i=k%GW,j=(k/GW)|0;if(D[k]<2)continue;const c=tileC(i,j),[dx,dz]=dirAt(i,j);out.push({x:c.x,z:c.z,dx,dz,bridge:false});}
  return out;}
const giants=makeGiants({scene,heightAt,bird:()=>props.bird(),HX,HZ,river:whaleSpots,waterY:WATER_Y,forest:(x,z)=>{const i=Math.floor(x+HX),j=Math.floor(z+HZ);return !inGrid(i,j)||tiles[idx(i,j)]===RIM||(tiles[idx(i,j)]===WILD&&builds[idx(i,j)]===NONE);}});
function giantOK(k){const ct=S.clock?.t||0,day=ct>.04&&ct<.66,dsk=ct>.55||ct<.06,wk=S.weather?.k;
  return {stag:day&&wk!=='storm',whale:wk!=='storm'&&!(SEASON_U.value.z>.6),owl:dsk}[k];}
function giantTick(dt){if(!started)return;
  S.giantT=(S.giantT??150)-dt*(builds.includes(B.GATE)?2:1);if(S.giantT>0||giants.list.length)return;
  const ok=Object.keys(GIANTS).filter(giantOK);if(!ok.length){S.giantT=30;return;}
  const seen=S.giantsSeen||(S.giantsSeen={});const fresh=ok.filter(k=>!seen[k]);const k=(fresh.length&&Math.random()<.7?fresh:ok)[Math.floor(Math.random()*(fresh.length&&Math.random()<.7?fresh:ok).length)];
  S.giantT=rand(420,720);giants.spawn(k);log(GIANTS[k].line+' Click it to greet it.','gold');sfx('discover');
}
// a chip at the edge of the screen points to a giant you can't see; click it to look
const giantChip=document.createElement('button');giantChip.type='button';giantChip.className='gchip';giantChip.hidden=true;document.getElementById('dv').appendChild(giantChip);
let chipFor=null;
// frame a giant: aim at its middle, not its feet
function lookAtGiant(gi){const p=gi.focus;tweenTo({x:p.x,y:Math.max(0,p.y*.6),z:p.z},34,2.5);}
// debug: call a giant now, at full presence, and look at it; 'Parade all' walks through every kind
const GIANT_KEYS=Object.keys(GIANTS);let gTour=null;
function previewGiant(k){giants.list.slice().forEach(g=>giants.drop(g));
  const gi=giants.spawn(k);if(!gi)return;gi.fade=Math.max(gi.fade||0,.6);lookAtGiant(gi);log(`Debug: ${GIANTS[k].name}.`,'dim');}
function giantTourTick(dt){if(!gTour)return;gTour.t+=dt;if(gTour.t<9)return;gTour.t=0;gTour.n++;if(gTour.n>=GIANT_KEYS.length){gTour=null;giants.list.forEach(g=>giants.depart(g));if(!$('debug').hidden)renderDebug();return;}previewGiant(GIANT_KEYS[gTour.n]);}
giantChip.addEventListener('click',()=>{if(chipFor)lookAtGiant(chipFor);});
function updateGiantChip(){const gi=giants.list.find(g=>!g.gifted&&g.fade>.3);chipFor=gi||null;if(!gi||!started||cine.fish){giantChip.hidden=true;return;}
  const p=gi.focus,s=toScreen(p.x,p.y,p.z),m=70;const on=s.x>m&&s.x<innerWidth-m&&s.y>m&&s.y<innerHeight-m;
  if(on){giantChip.hidden=true;return;}giantChip.hidden=false;const cx=innerWidth/2,cy=innerHeight/2,dx=s.x-cx,dy=s.y-cy,k=Math.min((cx-m-40)/Math.abs(dx||1e-3),(cy-m)/Math.abs(dy||1e-3));
  const x=cx+dx*k,y=cy+dy*k;giantChip.style.left=x+'px';giantChip.style.top=y+'px';giantChip.style.setProperty('--a',Math.atan2(dy,dx)+'rad');
  const h=`<i class="ga"></i><span>${GIANTS[gi.kind].name}</span>`;if(giantChip.dataset.k!==gi.kind){giantChip.innerHTML=h;giantChip.dataset.k=gi.kind;}}
function giantGift(gi){if(gi.gifted)return;gi.gifted=true;gi.life=Math.min(gi.life,gi.t+25);const k=gi.kind,nm=GIANTS[k].name;
  const seen=S.giantsSeen||(S.giantsSeen={});const first=!seen[k];seen[k]=(seen[k]||0)+1;
  const sc=1+allTales()*.08+S.found.length*.04,p=gi.focus;let body='';
  if(k==='stag'){const tb=Math.round(40*sc);S.goods.timber+=tb;body=`It lowers its head to look at the valley, and an antler it has shed lies glowing among the trees. The woodcutters bring back <b>${tb} timber</b>.`;}
  if(k==='owl'){S.owlUntil=(S.clock.day||1)+(S.clock.t||0)+1;updateHintVis();queueCrate({source:nm,kind:'mixed'});body='It watches the valley for a long time without blinking. For a day, every secret in the forest shows itself. It leaves something on the rim, too.';}
  if(k==='whale'){S.tide={n:Math.max(S.tide.n,8),t:Date.now()};const v=Math.round(120*sc);earn(v,p.x*.3,p.z*.3);const main=comps.reduce((a,c)=>c.size>a.size?c:a,comps[0]);if(main)for(let n=0;n<3;n++)spawnFish(n?SP.koi:SP.reed,main);
    body=`It sings, very low, under the bridge, and the river answers: fish rise all along it, and a <b>good tide</b> builds. Scales fall like rain: <b>${fmt(v)}</b>.`;}
  toast(nm+(first?' · first sighting':''),body);$('toast').querySelector('.k').textContent='A spirit of the forest';sfx('awe');for(let n=0;n<10;n++)sparkle(p.x+rand(-4,4),p.y+rand(-2,4),p.z+rand(-4,4),'#fff3cf');refreshUI();save();}
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
const COST={scout:'silver',clear:'scales',dig:'scales',hut:'scales',road:'scales',bridge:'scales',hire:'silver',line:'silver',bait:'silver'};
const cost={clear:()=>Math.round(4*Math.pow(1.025,S.clears)),dig:()=>Math.round(12*Math.pow(1.028,S.digs)),hire:()=>Math.round(15*Math.pow(1.3,S.hires)),
  hut:()=>Math.round(25*Math.pow(1.3,S.huts)),road:()=>3,bridge:()=>Math.round(30*Math.pow(1.2,S.bridges)),
  line:()=>Math.round(60*Math.pow(2.3,S.lineLv)),bait:()=>Math.round(90*Math.pow(2.5,S.baitLv))};
const has=id=>S.keepers.includes(id);
const boon=id=>S.boons[id]||0;
const lineMult=()=>(1+.3*S.lineLv)*(1+.15*boon('hands')),baitMult=()=>(1+.25*S.baitLv)*(1+.15*boon('sweet'))*(activeSets.walk?1.1:1)*(builds.includes(B.TEMPLE)?1.15:1);
const hutCount=()=>{let n=0;for(let k=0;k<GW*GH;k++)if(builds[k]===HUT)n++;return n;};
const LVL=k=>S.meta[k]?.lvl||1;
const HUT_BONUS=[0,2,5];
const housing=()=>{let n=0;for(let k=0;k<GW*GH;k++)if(builds[k]===HUT)n+=HOUSING+HUT_BONUS[LVL(k)-1];return n;};
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
  if(!inGrid(i,j)||tiles[idx(i,j)]===RIM)return {ok:false,why:'Outside the valley floor'};
  const k=idx(i,j),t=tiles[k],b=builds[k];
  if(busy.has(k)){if(tool==='remove')return {ok:true,cancel:true,refund:busy.get(k).cost||{}};return {ok:false,why:'Workers are already on it'};}
  if(tool.startsWith('b:')){const id=tool.slice(2);const why=placeRule(id,i,j);return why?{ok:false,why}:{ok:true,cost:buildCost(id)};}
  if(tool==='clear'){if(t!==WILD)return {ok:false,why:t===LAND?'Already cleared':'That is water'};
    if(!nb4(i,j,LAND)&&!nb4(i,j,WATER)&&!nbPending(i,j,'clear'))return {ok:false,why:'Must touch cleared land or water'};return {ok:true,c:cost.clear()};}
  if(tool==='dig'){if(t===WATER)return {ok:false,why:'Already water'};if(!nb4(i,j,WATER)&&!nbPending(i,j,'dig'))return {ok:false,why:'Must connect to existing water'};
    if(b===ROAD)return {ok:false,why:'Lift the road first (click it with the road tool)'};if(b===HUT)return {ok:false,why:'A family lives here'};if(b!==NONE)return {ok:false,why:'Remove what is built here first'};
    if(fishersOn(i,j).length)return {ok:false,why:'Move the fishers off first'};return {ok:true,c:oldCh[k]?Math.max(4,Math.round(cost.dig()*.4)):cost.dig(),restore:!!oldCh[k]};}
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
  if(tool==='scout'){if(t!==WILD||!hintVis.has(k))return {ok:false,why:'Send the crow to a spot with a sign above the trees'};if(crows.some(c=>c.k===k))return {ok:false,why:'A crow is already on its way'};return {ok:true,c:10};}
  if(tool==='remove'){if(b===NONE)return {ok:false,why:'Nothing built here'};if(b===ROAD)return {ok:false,why:'Lift roads with the road tool'};
    if(b===B.WEIR)return {ok:false,why:'Click the weir to take it down properly'};if(b===B.SHRINE||b===B.STONES||b===B.BONES||(b>=B.TEMPLE&&b<=B.GATE))return {ok:false,why:'That was here long before the village'};
    if(fishersOn(i,j).length)return {ok:false,why:'Move the fishers off first'};
    if(b===HUT&&fishersState.length>housing()-HOUSING-HUT_BONUS[LVL(k)-1])return {ok:false,why:'Every bed in this hut is taken'};
    if(b===BRIDGE)return {ok:true,refund:{scales:Math.round(cost.bridge()/1.2*.4)}};
    if(b===HUT)return {ok:true,refund:{scales:Math.round(cost.hut()/1.3*.4)}};
    const d=DEF_BY_CODE[b];const rf={};for(const [g,v] of Object.entries(d.cost||{}))rf[g]=Math.floor(v*.5);return {ok:true,refund:rf};}
  return {ok:false};
}
const PAINT_TOOLS=new Set(['road','pave','b:fence','b:flowers','remove','e:fence','e:hedge','e:wall']);
// work that takes a crew: clearing, digging, and anything built bigger than decor
const JOB_TOOLS=t=>t==='clear'||t==='dig'||t==='bridge'||t==='hut'||t==='upgrade'||(t.startsWith('b:')&&!['b:fence','b:flowers'].includes(t));
function act(tool,i,j,quiet=false){
  const r=canDo(tool,i,j);if(!r.ok){if(r.why&&!quiet)log(r.why+'.','warn');if(!quiet)sfx('no');return false;}
  const k=idx(i,j),cur=COST[tool];
  if(r.cancel){cancelJob(k);refreshUI();return true;}
  const job=JOB_TOOLS(tool)&&!r.restyle;
  if(job){const c=r.cost||(r.c?{[cur]:r.c}:{});if(!pay(c))return false;queueJob({tool,i,j,sp:S.statueSp,style:S.hutStyle,cost:c,quiet});sfx('pluck');refreshUI();if(!quiet)save();return true;}
  if(tool==='scout'){if(!spend(r.c,'silver'))return false;sendCrow(k);sfx('pluck');log('A crow lifts off from the village and heads for the trees.');}
  else if(tool==='hire'){if(!spend(r.c,cur))return false;makeFisher(i,j,freeSlot(i,j),S.hires+1);S.hires++;log(`A new fisher joins the bank. You have ${fishersState.length} of ${housing()} housed.`);sfx('pluck');wishEvent('hire');}
  else if(tool==='hut'){if(!pay(r.cost))return false;S.meta[k]={...(S.meta[k]||{}),style:S.hutStyle};buildsChanged();sfx('build');}
  else if(tool.startsWith('b:')){if(!pay(r.cost))return false;applyJob({tool,i,j,sp:S.statueSp,style:S.hutStyle,quiet});}
  else if(tool==='road'){if(r.lift){builds[k]=NONE;delete S.meta[k];buildsChanged();sfx('dig');}
    else{if(!spend(r.c,cur))return false;if(r.wild){tiles[k]=LAND;S.clears++;forestYield(k);fellLater.push(k);}builds[k]=ROAD;
      buildsChanged(r.wild);sfx('dig');if(r.wild){fellTrees(fellLater.pop());revealAt(k);}}}
  else if(tool==='pave'){if(!pay(r.cost))return false;S.meta[k]={...(S.meta[k]||{}),pave:S.pave};buildsChanged();sfx('dig');}
  else if(tool==='remove'){const d=DEF_BY_CODE[b0(k)];for(const [g,v] of Object.entries(r.refund)){if(g==='scales')S.scales+=v;else S.goods[g]=(S.goods[g]||0)+v;}
    if(builds[k]===HUT)S.huts=Math.max(0,S.huts-1);else if(builds[k]===BRIDGE)S.bridges=Math.max(0,S.bridges-1);else if(d)S.counts[d.id]=Math.max(0,(S.counts[d.id]||1)-1);
    builds[k]=NONE;delete S.meta[k];if(plotK===k)closePlot();buildsChanged();sfx('dig');}
  refreshUI();if(!quiet)save();return true;
}
// what finishing a job does to the valley
function applyJob(jb){
  const {tool,i,j}=jb,k=idx(i,j),c=tileC(i,j);
  if(tool==='clear'){tiles[k]=LAND;S.clears++;forestYield(k);worldChanged();fellTrees(k);sfx('clear');wishEvent('clear');revealAt(k);return;}
  if(tool==='dig'){tiles[k]=WATER;S.digs++;worldChanged();digSplash(k);sfx('dig');if(oldCh[k]&&!jb.quiet&&!S.restoredOnce){S.restoredOnce=true;log('Water finds its old bed again. The valley remembers.','gold');}return;}
  if(tool==='weir'){for(let q=0;q<GW*GH;q++)if(builds[q]===B.WEIR){builds[q]=NONE;digSplash(q);}S.weirGone=true;buildsChanged();sfx('set');
    toast('The old weir is down','The river runs free from the west edge again. Fish come up it more often, and the valley can heal.');$('toast').querySelector('.k').textContent='The valley heals';closePlot();refreshUI();return;}
  if(tool==='bridge'){builds[k]=BRIDGE;S.bridges++;buildsChanged();sfx('build');if(!jb.quiet)log('A bridge spans the water. Fishers can stand on it and reach the middle of the river.');}
  else if(tool==='hut'){builds[k]=HUT;S.huts++;S.meta[k]={style:jb.style||'thatch'};buildsChanged();sfx('build');
    if(!jb.quiet)log(`A family settles in. Room for ${HOUSING} more fishers.`);wishEvent('build',{id:'hut'});}
  else if(tool==='upgrade'){S.meta[k]={...(S.meta[k]||{}),lvl:LVL(k)+1};buildsChanged();sfx('set');if(!jb.quiet)log(`${plotName(k)} is finished.`,'gold');if(plotK===k)renderPlot();}
  else if(tool.startsWith('b:')){const id=tool.slice(2),d=DEFS[id];lastK=k;builds[k]=d.code;S.counts[id]=(S.counts[id]||0)+1;if(d.code===B.STATUE)S.meta[k]={sp:jb.sp||'koi'};
    buildsChanged();sfx('build');if(!jb.quiet)log(buildLog(id));wishEvent('build',{id});}
  for(let n=0;n<8;n++)sparkle(c.x+rand(-.35,.35),.3,c.z+rand(-.35,.35),'#ffe9bf');
  refreshUI();
}
const b0=k=>builds[k];
function buildLog(id){
  const L={woodcutter:'A woodcutter sets up at the forest’s edge. The more trees around, the more timber.',reedbed:'Reeds take root in the still water.',
    claypit:deposit[lastK]?'A clay pit on a red seam. It digs three times as fast.':'A clay pit is dug into the bank.',workshop:'A workshop opens. It turns reeds and clay into lanterns, or timber into carvings.',
    post:'A trading post, with a wagon of its own. It leaves up the Pilgrim Way when it is full.',jetty:'A jetty, with a barge. It rides the current east when it is loaded.',
    market:'A market stall. Pilgrims buy lanterns and carvings here.',talehall:'A new Tale House. Pilgrims will stop here too, once it is joined to the Way.',pier:'A pier over the water. Fishers can stand on it.',statue:`A statue of the ${SP[S.statueSp]?.name||'fish'}. ${STATUE_FX[S.statueSp]?.txt?('Nearby, '+STATUE_FX[S.statueSp].txt+'.'):''}`};
  return L[id]||`${DEFS[id].name} placed.`;
}
let lastK=-1;
function forestYield(k){let t=3+(has('garrow')?3:0);const s=secretAt[k];if(s&&s.type==='grove'&&!S.found.includes(k))t+=20;S.goods.timber+=t;const c=tileC(k%GW,(k/GW)|0);popAt(c.x,c.z,'+'+t+' timber','tm');}
/* ---- backwaters: lily pads, and dragonflies now and then ---- */
const lilies=new THREE.InstancedMesh(new THREE.CircleGeometry(.09,7).rotateX(-Math.PI/2),rimMat({color:'#4f7a36'},'#fff0b0',.4),GW*GH*3);lilies.count=0;lilies.receiveShadow=true;scene.add(lilies);
let stillTiles=[];
function updateLilies(){let n=0;stillTiles=[];for(let k=0;k<GW*GH;k++){if(tiles[k]!==WATER||FLOW.live[k]||builds[k]!==NONE)continue;stillTiles.push(k);const c=tileC(k%GW,(k/GW)|0);
  for(let q=0;q<3;q++){p4.set(c.x+(hash2(k,q)-.5)*.8,WATER_Y+.012,c.z+(hash2(q,k)-.5)*.8);q4.setFromAxisAngle(yAxis,hash2(k*3,q)*6);s4.setScalar(.7+hash2(q*7,k)*.6);m4.compose(p4,q4,s4);lilies.setMatrixAt(n++,m4);}}
  lilies.count=n;lilies.instanceMatrix.needsUpdate=true;}
/* ---- trees fall when forest is cleared; dug tiles splash ---- */
const fellLater=[],fallers=[];
// a sound placed where it happens: panned by screen position, quieter when zoomed out or off to the side
let lastFall=0;
function soundAt(kind,x,z){if(!started)return;const p=toScreen(x,.2,z);if(p.x<-80||p.x>innerWidth+80||p.y<-80||p.y>innerHeight+80)return;
  const off=Math.hypot(p.x/innerWidth-.5,p.y/innerHeight-.5);worldSound(kind,clamp(p.x/innerWidth*2-1,-1,1)*.8,clamp(30/view.z,.18,1)*(1-off*.8));}
function fellOne(n){const t=trees[n];if(t.gone)return;t.gone=true;fallers.push({n,t:0,dir:rand(0,6.28)});sparkle(t.x,.4,t.z,'#7fae4a');
  const now=performance.now();if(now-lastFall>900){lastFall=now;soundAt('fall',t.x,t.z);}}
function fellTrees(k){trees.forEach((t,n)=>{if(t.tile===k&&!t.gone){t.gone=true;fallers.push({n,t:rand(0,.25),dir:rand(0,6.28)});}});
  const c=tileC(k%GW,(k/GW)|0);for(let n=0;n<10;n++)sparkle(c.x+rand(-.4,.4),rand(.2,.7),c.z+rand(-.4,.4),Math.random()<.6?'#7fae4a':'#b98552');}
const fq=new THREE.Quaternion(),fax=new THREE.Vector3();
function updateFallers(dt){
  for(const f of fallers.slice()){const tr=trees[f.n];f.t+=dt;const k=clamp(f.t/.8,0,1);const tilt=k*k*1.45;
    fax.set(Math.cos(f.dir),0,Math.sin(f.dir));fq.setFromAxisAngle(fax,tilt);q4.setFromAxisAngle(yAxis,tr.r);fq.multiply(q4);
    const sc=f.t<1?tr.s:tr.s*Math.max(0,1-(f.t-1)/.35);p4.set(tr.x,heightAt(tr.x,tr.z)-.03,tr.z);treeScale(tr,sc);m4.compose(p4,fq,s4);foliage.setMatrixAt(f.n,m4);trunks.setMatrixAt(f.n,m4);
    if(f.t>=.8&&!f.thud){f.thud=true;for(let n=0;n<3;n++)wisps.emit(tr.x+Math.sin(f.dir)*.3+rand(-.1,.1),.08,tr.z-Math.cos(f.dir)*.3+rand(-.1,.1),'smoke');}
    if(f.t>1.35){fallers.splice(fallers.indexOf(f),1);s4.setScalar(0);m4.compose(p4,fq,s4);foliage.setMatrixAt(f.n,m4);trunks.setMatrixAt(f.n,m4);}}
  if(fallers.length||dt<0){foliage.instanceMatrix.needsUpdate=trunks.instanceMatrix.needsUpdate=true;}
}
function digSplash(k){const c=tileC(k%GW,(k/GW)|0);for(let n=0;n<14;n++)sparkle(c.x+rand(-.4,.4),WATER_Y+rand(0,.3),c.z+rand(-.4,.4),'#dff8ee');for(let n=0;n<4;n++)wisps.emit(c.x+rand(-.3,.3),WATER_Y+.05,c.z+rand(-.3,.3),'mist');}
/* ---- crows: scout a hint without cutting the forest ---- */
const crows=[];
function sendCrow(k){const c=tileC(k%GW,(k/GW)|0);const home=villages[0]?{x:villages[0].cx,z:villages[0].cz}:tileC(WAY_I,Math.min(GH-1,5));
  const g=props.bird();g.scale.setScalar(1.6);scene.add(g);crows.push({k,g,x0:home.x,z0:home.z,x1:c.x,z1:c.z,t:0,a:0});}
function updateCrows(dt,time){
  for(const c of crows.slice()){c.t+=dt;let x,z,y;
    if(c.t<5){const k=c.t/5,e=k*k*(3-2*k);x=lerp(c.x0,c.x1,e);z=lerp(c.z0,c.z1,e);y=1+Math.sin(Math.PI*k)*1.6+k*.8;c.g.rotation.y=Math.atan2(c.x1-c.x0,c.z1-c.z0)+Math.PI/2;}
    else{c.a+=dt*1.6;x=c.x1+Math.cos(c.a)*.8;z=c.z1+Math.sin(c.a)*.8;y=1.8;c.g.rotation.y=-c.a;}
    c.g.position.set(x,y,z);const fl=Math.sin(time*10+c.k)*.6;c.g.userData.l.rotation.z=fl;c.g.userData.r.rotation.z=-fl;
    if(c.t>9){scene.remove(c.g);crows.splice(crows.indexOf(c),1);const s=secretAt[c.k];
      if(s&&!S.found.includes(c.k)){if(['bones','stones','shrine'].includes(s.type)){tiles[c.k]=LAND;worldChanged();}if(s.type==='grove')S.goods.timber+=20;revealAt(c.k);refreshUI();}}}
}
function worldChanged(){wildlife.clear();wildT=0;roads.sync();buildTerrain(true);updateTrees();analyzeWater();fishersState.forEach(placeFisher);updateMarks();computeVillages();computeEconomy();village.sync();trade.sync();updateHintVis();updateLilies();}
function buildsChanged(){roads.sync();buildTerrain(true);if(arguments[0])updateTrees();computeVillages();computeEconomy();village.sync();trade.sync();fishersState.forEach(placeFisher);updateMarks();}

/* ================= auras, charm, production ================= */
const charm=new Float32Array(GW*GH);
const aura={bite:new Float32Array(GW*GH),reel:new Float32Array(GW*GH),rack:new Float32Array(GW*GH),statue:new Float32Array(GW*GH)};
const prodBoost={};[B.WOOD,B.REED,B.CLAY,B.SHOP,B.MARKET].forEach(c=>prodBoost[c]=new Float32Array(GW*GH));
function spread(k,r,fn){const i=k%GW,j=(k/GW)|0;for(let b=-r;b<=r;b++)for(let a=-r;a<=r;a++){const ni=i+a,nj=j+b;if(inGrid(ni,nj))fn(idx(ni,nj));}}
let producers=[];// {k,code,good,rate}
let activeSets={};
/* ---- valley health: the river restored, forest kept, backwaters alive, the weir gone ---- */
let health=0,healthParts={};
function computeHealth(){let chT=0,chD=0,wild=0,still=0,reeds=0,weir=0;
  for(let k=0;k<GW*GH;k++){if(oldCh[k]){chT++;if(tiles[k]===WATER&&FLOW.live[k])chD++;}if(tiles[k]===WILD)wild++;if(tiles[k]===WATER&&!FLOW.live[k])still++;if(builds[k]===B.REED)reeds++;if(builds[k]===B.WEIR)weir++;}
  healthParts={river:35*(chT?chD/chT:0),forest:30*Math.min(1,wild/(.65*wild0)),wetland:20*Math.min(1,(still+reeds)/20),weir:weir?0:15};
  health=Math.round(Object.values(healthParts).reduce((a,b)=>a+b,0));}
const healthSpawn=()=>(.8+health/250)*(builds.includes(B.WEIR)?.85:1);
function computeEconomy(){computeHealth();
  charm.fill(0);for(const a of Object.values(aura))a.fill(0);for(const a of Object.values(prodBoost))a.fill(0);
  const ex=boon('reach');
  for(let k=0;k<GW*GH;k++){const b=builds[k];if(b===NONE)continue;const d=DEF_BY_CODE[b];
    if(d?.charm)spread(k,d.charm[1]+ex,q=>charm[q]+=d.charm[0]);
    if(b===ROAD){const pv=PAVES[S.meta[k]?.pave];if(pv?.charm)spread(k,pv.charm[1],q=>charm[q]+=pv.charm[0]);}
    if(b===B.NETS)spread(k,2+ex,q=>aura.reel[q]+=.25);
    if(b===B.RACK)spread(k,2+ex,q=>aura.rack[q]+=.2);
    if(b===B.SHRINE)spread(k,3+ex,q=>aura.bite[q]+=.2);
    if(b===B.STATUE){const fx=STATUE_FX[S.meta[k]?.sp]||{},L=LVL(k),m=[1,1.5,2][L-1];const r=(fx.r||2)+ex+(L>=3?1:0);
      spread(k,r,q=>{if(fx.bite)aura.bite[q]+=fx.bite*m;if(fx.reel)aura.reel[q]+=fx.reel*m;if(fx.scale)aura.statue[q]+=fx.scale*m;if(fx.charm)charm[q]+=fx.charm*m;
        if(fx.prod)for(const [c,v] of Object.entries(fx.prod))prodBoost[c][q]+=v*m;});}
  }
  slotCharm();computeSets();
  producers=[];
  for(let k=0;k<GW*GH;k++){const b=builds[k],i=k%GW,j=(k/GW)|0;let good=null,rate=0;
    if(b===B.WOOD){let n=0;for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){if((x||y)&&inGrid(i+x,j+y)&&tiles[idx(i+x,j+y)]===WILD)n++;}
      good='timber';rate=.9*n*(1+.25*boon('wood'))*(has('garrow')?1.6:1)*(builds.includes(B.ELDER)?1.3:1);}
    else if(b===B.REED){let n=0;for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){const nk=idx(i+x,j+y);if(inGrid(i+x,j+y)&&tiles[nk]===WATER&&!FLOW.live[nk])n++;}
      good='reeds';rate=(2.5+.7*n)*(1+.25*boon('reed'))*(has('wren')?2:1);}
    else if(b===B.CLAY){good='clay';rate=2*(deposit[k]?3:1)*(1+.25*boon('clay'))*(has('kiln')?1.25:1);}
    else if(b===B.SHOP){good='craft';rate=4*(has('kiln')?1.5:1);}
    else continue;
    rate*=(1+(prodBoost[b][k]||0))*[1,1.5,2][LVL(k)-1];producers.push({k,code:b,good,rate,prog:shopProg.get(k)||0});}
}
const shopProg=new Map();
// what a workshop turns into what
const RECIPE={lanterns:{reeds:2,clay:1},carvings:{timber:3}};
const canMake=g=>Object.entries(RECIPE[g]).every(([r,q])=>(S.goods[r]||0)>=q);
const recipeTxt=g=>Object.entries(RECIPE[g]).map(([r,q])=>q+' '+GOODS[r].name.toLowerCase()).join(' + ');
// a workshop set to "whatever is needed" makes what open orders are short of, else whichever is scarcer
function craftOrder(k){const m=S.meta[k]?.make;if(m==='lanterns'||m==='carvings')return [m];
  const w={...trade.wanted('north')};for(const [g,q] of Object.entries(trade.wanted('east')))w[g]=(w[g]||0)+q;
  const short=g=>(w[g]||0)-(S.goods[g]||0);
  const first=short('carvings')>0||short('lanterns')>0?(short('carvings')>=short('lanterns')?'carvings':'lanterns'):((S.goods.lanterns||0)<=(S.goods.carvings||0)?'lanterns':'carvings');
  return [first,first==='lanterns'?'carvings':'lanterns'];}
function productionTick(dt){
  for(const p of producers){
    if(p.good!=='craft'){S.goods[p.good]+=p.rate*dt/60;continue;}
    let g=(shopProg.get(p.k)||0)+p.rate*dt/60;
    if(g>=1){const opts=craftOrder(p.k),mk=opts.find(canMake);
      if(mk){for(const [r,q] of Object.entries(RECIPE[mk]))S.goods[r]-=q;S.goods[mk]+=1;g-=1;p.stall=null;p.making=mk;craftPuff(p.k,GOODS[mk].col);}
      else{g=1;p.stall=opts.map(recipeTxt).join(', or ');}}
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
const capacity=(kind,home)=>Math.round(((kind==='wagon'?16:30)+8*boon('pockets'))*(kind==='wagon'&&has('carter')?1.5:1)*(home!==undefined?[1,1.5,2][LVL(home)-1]:1));
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
// pilgrims come to hear the tales at the Tale House, and buy at market stalls
function pilgrimMult(){return (1+.15*allTales()*(has('pell')?2:1))*(1+avgCharm()/25)*(1+.2*boon('hosts'))*(activeSets.garden?1.15:1)*(builds.includes(B.TOWER)?1.1:1);}
let pilgrimT=4;
function pilgrimTick(dt){
  pilgrimT-=dt;if(pilgrimT>0)return;
  const th=linkedOf(B.TALEHALL),mk=linkedOf(B.MARKET);const n=th.length*2+mk.length;
  pilgrimT=n?rand(9,16)/Math.sqrt(n)/pilgrimMult():5;
  if(!started||!n)return;
  const toMarket=mk.length&&(Math.random()<.55||!th.length);
  village.spawnPilgrim(toMarket?mk.map(m=>({...m,market:true})):th.map(m=>({...m,tales:true})),pilgrimArrive);
}
function marketMult(k){const v=villages.find(v=>v.huts.some(h=>Math.max(Math.abs(h%GW-k%GW),Math.abs(((h/GW)|0)-((k/GW)|0)))<=3));
  return 1.5*[1,1.25,1.5][LVL(k)-1]*(1+charm[k]/30)*(1+(prodBoost[B.MARKET][k]||0))*(v?.harmony?1.2:1)*(activeSets.harmony?1.2:1);}
// silver a pilgrim leaves in the tale box: more for every tale the house can tell
const taleGift=k=>(3+.9*allTales())*(1+charm[k]/30)*(1+.2*boon('hosts'));
function pilgrimArrive(t,pos){
  if(t.tales){if(builds[t.k]!==B.TALEHALL)return;const c=tileC(t.i,t.j);earnSilver(taleGift(t.k),c.x,c.z);sfx('coins');return;}
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
    if(f.noBite&&performance.now()<f.noBite)continue;
    const hd=fishHead(f);
    // the line ties to the fish's head: only fishers whose line can reach it count
    const near=fishersState.filter(fs=>fs.state==='idle'&&(distToFish(f,fs.bob.x,fs.bob.z)<reach||distToFish(f,fs.x,fs.z)<reach+.6)&&Math.hypot(hd.x-fs.x,hd.z-fs.z)<maxLine(fs)*.85);
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
  // lines that are pulled past their reach strain, then snap
  for(const fs of f.hookers.slice()){const hd=fishHead(f),d=Math.hypot(hd.x-fs.x,hd.z-fs.z),ml=maxLine(fs);
    fs.strain=clamp((fs.strain||0)+(d>ml?dt:-dt*.6),0,1.3);
    fs.line.material.color.copy(LINE_OK).lerp(LINE_TAUT,clamp(Math.max(fs.strain/1.2,(d/ml-.8)*2.5),0,1));
    if(fs.strain>=1.2){f.hookers.splice(f.hookers.indexOf(fs),1);fs.state='idle';fs.fish=null;fs.strain=0;fs.line.material.color.copy(LINE_OK);
      for(let n=0;n<8;n++)sparkle(fs.x+rand(-.2,.2),.4,fs.z+rand(-.2,.2),'#ffd0a0');popAt(fs.x,fs.z,'snap!','snap');sfx('snap');}}
  if(f.hookers.length<f.sp.crew){
    f.hookers.forEach(fs=>{fs.state='idle';fs.fish=null;fs.strain=0;fs.line.material.color.copy(LINE_OK);});f.hookers=[];f.state='swim';f.progress=0;f.noBite=performance.now()+20000;f.surge=0;
    log(`The ${S.codex[f.sp.id]?f.sp.name:'fish'} ran past the lines and slipped free. Stand the crew where it swims, closer to the water.`,'warn');sfx('hook');return;}
  if(f.hookers.length!==hands)return;
  // drag the fish gently toward the crew
  let cx=0,cz=0;f.hookers.forEach(fs=>{cx+=fs.x;cz+=fs.z;});cx/=hands;cz/=hands;
  const d=Math.hypot(cx-f.x,cz-f.z),pull=(f.surge>0?.02:.12)*Math.min(2,hands/f.sp.crew);if(Math.hypot(fishHead(f).x-cx,fishHead(f).z-cz)>1.1){const nx=f.x+(cx-f.x)/d*dt*pull,nz=f.z+(cz-f.z)/d*dt*pull;if(dAt(nx,nz)>0){f.x=nx;f.z=nz;}}
  if(!(f.surge>0))f.h+=angDiff(Math.atan2(cx-f.x,cz-f.z),f.h)*dt*.25; // reeled in: head toward the crew
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
  if(f.help)rows.push({t:'Your steady hands',v:1+Math.min(.5,.03*f.help),k:'x'});
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
  spawnTimer-=dt*baitMult()*healthSpawn()*weatherFish()*debugSpeed.spawn;if(spawnTimer>0)return;spawnTimer=rand(20,36);
  const cap=Math.min(20,comps.reduce((s,c)=>s+Math.max(1,Math.floor(c.size/7)),0));
  if(fishes.filter(f=>f.state!=='leave').length>=cap)return;
  const counts={};fishes.forEach(f=>{const c=compAt(f.x,f.z);counts[c]=(counts[c]||0)+1;});
  const open=comps.filter(c=>(counts[c.id]||0)<Math.max(1,Math.floor(c.size/7)));if(!open.length)return;
  let tot=open.reduce((s,c)=>s+c.size,0),r=Math.random()*tot,comp=open[0];for(const c of open){r-=c.size;if(r<=0){comp=c;break;}}
  const present=new Set(fishes.map(f=>f.sp.id));
  const elig=SPECIES.filter(s=>s.minWater<=comp.size&&comp.maxD>=s.needD&&health>=(s.minHealth||0)&&(!s.night||night>.3)&&!(s.awe&&present.has(s.id)));if(!elig.length)return;
  const wt=s=>s.w*(S.codex[s.id]?1:1.6)*(s.crew<=fishersState.length?1:.35)*(s.id==='eel'&&night>.3?2:1);
  let W=elig.reduce((a,s)=>a+wt(s),0),rr=Math.random()*W,sp=elig[0];for(const s of elig){rr-=wt(s);if(rr<=0){sp=s;break;}}
  const f=spawnFish(sp,comp);
  if(sp.awe&&started&&!cine.fish){const last=(S.lastCine||{})[sp.id]||0;
    if(Date.now()-last>2*3600e3)startCine(f);else{log(`The ${S.codex[sp.id]?sp.name:'something vast'} has surfaced again.`,'gold');sfx('discover');if(DUSK_OF[sp.id]){duskLvl=DUSK_OF[sp.id]*.6;duskT=14;}}}
}
const cine={fish:null,t:0,saved:null,phase:0};
function startCine(f){
  (S.lastCine||={})[f.sp.id]=Date.now();
  cine.fish=f;cine.t=0;cine.saved={t:view.t.clone(),z:view.z};
  const known=!!S.codex[f.sp.id];
  document.getElementById('bannerKick').textContent=known?'It returns':'Something vast stirs below';
  document.getElementById('bannerName').textContent=f.sp.name;
  document.getElementById('bannerEp').textContent=f.sp.ep;
  document.getElementById('bannerReq').textContent=`Needs ${f.sp.crew} fishers on one bank · sheds ${fmt(f.sp.value)} scales when released`;
  dv.classList.add('cine');setTimeout(()=>banner.classList.add('on'),900);
  tweenTo({x:f.x,z:f.z},Math.max(14,f.sp.len*2.6),4);
  log(`${f.sp.name} has surfaced in the river.`,'gold');playTheme(f.sp.id);
  if(DUSK_OF[f.sp.id]){duskLvl=DUSK_OF[f.sp.id];duskT=26;}
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
  capacity:(k,h)=>capacity(k,h),speed:k=>vSpeed(k)*debugSpeed.trade,price:(g,k)=>price(g,k),paveSpeed:k=>PAVES[S.meta[k]?.pave||'dirt'].speed,
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
// room round a landmark: wild, and well inside the valley's outline (no edge tile within 6)
function lmClear(k){const i=k%GW,j=(k/GW)|0;if(tiles[k]!==WILD)return false;for(let b=-6;b<=6;b++)for(let a=-6;a<=6;a++){const ni=i+a,nj=j+b;if(!inGrid(ni,nj)||tiles[idx(ni,nj)]===RIM)return false;}return true;}
function initSecrets(){
  if(!S.seed)S.seed=1+Math.floor(Math.random()*2**30);
  secrets=makeSecrets(S.seed,pristineTiles(),tiles);
  // landmarks stay where they were first placed, whatever happens to the forest later
  const LM=['temple','elder','tower','gate'];
  // a stored landmark that ended up at the valley's edge (an older save, before the outline) moves somewhere it can be seen
  if(S.lm)for(const [type,k] of Object.entries(S.lm)){if(S.found.includes(k))continue;if(!lmClear(k)){const fresh=secrets.find(x=>x.type===type);if(fresh)S.lm[type]=fresh.k;else delete S.lm[type];}}
  if(S.lm)secrets=secrets.filter(s=>!LM.includes(s.type)).concat(Object.entries(S.lm).map(([type,k])=>({type,k,i:k%GW,j:(k/GW)|0,r:.5})));
  else S.lm=Object.fromEntries(secrets.filter(s=>LM.includes(s.type)).map(s=>[s.type,s.k]));
  secrets=secrets.filter(s=>tiles[s.k]===WILD||S.found.includes(s.k)||(LM.includes(s.type)&&builds[s.k]!==NONE));
  S.drops=(S.drops||[]).filter(d=>tiles[d.k]===WILD&&!S.found.includes(d.k)&&!secrets.some(s=>s.k===d.k));secrets.push(...S.drops);
  for(const s of secrets){secretAt[s.k]=s;if(s.type==='clay')deposit[s.k]=1;}
  const pt=pristineTiles();oldCh.set(makeChannels(S.seed,pt,S.legacyCh));wild0=pt.reduce((a,t)=>a+(t===WILD?1:0),0);
  trees.forEach((t,n)=>{if(t.tile>=0&&oldCh[t.tile]&&hash2(n*.37,t.tile*.11)<.7)t.gone=true;}); // the dry beds are only scrub
  for(const s of secrets)if(oldCh[s.k])oldCh[s.k]=0;
  placeLandmarks();
}
let wild0=1;
/* ---- landmarks you can see before you find them: the Elder Cedar over the canopy, the Lantern Tower's top ---- */
const landmarkMeshes=new Map();
// before it's found, a landmark stands in the forest as a shadow of itself: dark, dithered, thinning toward the top like
// something half-seen through the trees. Its lights (runes, lanterns) show faintly through.
const SHADE_V=`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const SHADE_F=`uniform float uBot,uTop,uLum,uTime;uniform vec3 uEmi;varying vec3 vW;
  float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}float bayer(vec2 a){return b2(.5*a)*.25+b2(a);}
  void main(){float t=clamp((vW.y-uBot)/max(.01,uTop-uBot),0.,1.);
    float a=mix(.97,.4,smoothstep(.15,1.,t))*(.92+.08*sin(uTime*.7+vW.x*1.7+vW.z*1.3));
    if(bayer(gl_FragCoord.xy)>=a)discard;
    vec3 c=mix(vec3(.01,.018,.022),vec3(.035,.05,.05),uLum)+uEmi*.35; // linear: very dark
    gl_FragColor=vec4(c,1.);}`;
const shadeU={uTime:{value:0},uPx:{value:new THREE.Vector2(.004,.006)}};
// a soft white outline round the silhouette: an inflated back-face shell, pushed out a couple of screen pixels.
// A depth-only copy of the shape goes down first, so the shell only shows outside the silhouette, never through its dither.
const HULL_V=`uniform vec2 uPx;void main(){vec4 c=projectionMatrix*modelViewMatrix*vec4(position,1.0);vec3 n=normalize(normalMatrix*normal);
  vec2 d=length(n.xy)>1e-3?normalize(n.xy):vec2(0.);c.xy+=d*uPx*1.6*c.w;gl_Position=c;}`;
const hullMat=new THREE.ShaderMaterial({vertexShader:HULL_V,fragmentShader:`void main(){gl_FragColor=vec4(1.,1.,1.,.2);}`,uniforms:{uPx:shadeU.uPx},side:THREE.BackSide,transparent:true,depthWrite:false});
const maskMat=new THREE.MeshBasicMaterial({colorWrite:false,transparent:true});
function shadowize(m){m.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(m),bot={value:bb.min.y},top={value:bb.max.y};
  const parts=[];m.traverse(o=>{if(o.isMesh)parts.push(o);});parts.forEach(o=>{const src=o.material,col=src.color||new THREE.Color('#888'),emi=src.emissive&&src.emissiveIntensity>.5?src.emissive.clone().multiplyScalar(Math.min(1.5,src.emissiveIntensity)):new THREE.Color(0,0,0);
    o.material=new THREE.ShaderMaterial({vertexShader:SHADE_V,fragmentShader:SHADE_F,uniforms:{uBot:bot,uTop:top,uTime:shadeU.uTime,uLum:{value:Math.min(1,col.r*.3+col.g*.5+col.b*.2)},uEmi:{value:emi}},transparent:true});o.castShadow=false;o.receiveShadow=false;o.renderOrder=12;
    for(const [mt,ro] of [[maskMat,10],[hullMat,11]]){const c=new THREE.Mesh(o.geometry,mt);c.renderOrder=ro;o.add(c);}});}
function placeLandmarks(){for(const [,m] of landmarkMeshes)scene.remove(m);landmarkMeshes.clear();
  for(const s of secrets){if(S.found.includes(s.k)||tiles[s.k]!==WILD)continue;const m=props.landmark(s.type,s.k);if(!m)continue;const c=tileC(s.i,s.j);
    m.position.set(c.x,heightAt(c.x,c.z)-.02,c.z);scene.add(m);shadowize(m);landmarkMeshes.set(s.k,m);
    trees.forEach(t=>{if(Math.hypot(t.x-c.x,t.z-c.z)<({tower:.75,temple:.9,gate:.8}[s.type]||.45))t.gone=true;});}updateTrees();}
function hideLandmark(k){const m=landmarkMeshes.get(k);if(m){scene.remove(m);landmarkMeshes.delete(k);}}
// the tower's beam sweeps the valley at dusk and through the night, found or not
const beamMat=new THREE.MeshBasicMaterial({color:'#ffcf9a',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
const beam=new THREE.Mesh(new THREE.ConeGeometry(1.1,9,12,1,true).translate(0,-4.5,0).rotateZ(Math.PI/2),beamMat);beam.visible=false;scene.add(beam);
function updateBeam(dt,t){const tk=builds.indexOf(B.TOWER),s=tk>=0?null:secrets.find(x=>x.type==='tower'&&!S.found.includes(x.k));
  const k=tk>=0?tk:s?s.k:-1;if(k<0||dusk<.15){beam.visible=false;return;}const c=tileC(k%GW,(k/GW)|0);
  beam.visible=true;beam.position.set(c.x,heightAt(c.x,c.z)+2.1,c.z);beam.rotation.y=t*.45;beamMat.opacity=clamp((dusk-.15)*.5,0,.22)*(tk>=0?1.3:.8);}
let bellT=8;
function bellTick(dt){bellT-=dt;if(bellT>0)return;bellT=rand(26,48);const s=secrets.find(x=>x.type==='temple'&&!S.found.includes(x.k)&&hintVis.has(x.k));
  const tk=builds.indexOf(B.TEMPLE);const k=s?s.k:tk;if(k<0||!started)return;const c=tileC(k%GW,(k/GW)|0);soundAt('bell',c.x,c.z);
  for(let n=0;n<8;n++)sparkle(c.x+Math.cos(n/8*6.28)*.6,1.2,c.z+Math.sin(n/8*6.28)*.6,'#ffe9a0');}
const hintVis=new Set();
// old chests surface at the forest's edge every few minutes, so there is always something to look for
function dropChest(){
  if((S.drops||[]).length>=2)return false;
  const cand=[];for(let k=0;k<GW*GH;k++){if(tiles[k]!==WILD||secretAt[k]||busy.has(k))continue;const i=k%GW,j=(k/GW)|0;let dmin=9;
    for(let b=-5;b<=5;b++)for(let a=-5;a<=5;a++){const ni=i+a,nj=j+b;if(inGrid(ni,nj)&&tiles[idx(ni,nj)]!==WILD)dmin=Math.min(dmin,Math.max(Math.abs(a),Math.abs(b)));}
    if(dmin>=2&&dmin<=5)cand.push(k);}
  if(!cand.length)return false;const k=cand[Math.floor(Math.random()*cand.length)];
  const d={type:'chest',i:k%GW,j:(k/GW)|0,k,r:Math.random()};S.drops.push(d);secrets.push(d);secretAt[k]=d;updateHintVis();
  log('Something glints at the edge of the forest: an old chest, half sunk in the moss. Send a crow, or clear the tile.','gold');return true;}
function dropTick(dt){S.dropT=(S.dropT||0)+dt;if(S.dropT<(S.dropNext||150))return;S.dropT=0;S.dropNext=200+Math.random()*160;dropChest();}
function updateHintVis(){
  hintVis.clear();const R=has('quill')?11:7;const tw=builds.indexOf(B.TOWER);
  const owl=S.owlUntil&&((S.clock?.day||1)+(S.clock?.t||0))<S.owlUntil;
  for(const s of secrets){if(S.found.includes(s.k)||tiles[s.k]!==WILD)continue;let near=owl||SECRET_TYPES[s.type].big||(tw>=0&&Math.hypot(s.i-tw%GW,s.j-((tw/GW)|0))<=14);
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
  if(stillTiles.length&&Math.random()<dt*.8){const k=stillTiles[Math.floor(Math.random()*stillTiles.length)],c=tileC(k%GW,(k/GW)|0);sparkle(c.x+rand(-.4,.4),WATER_Y+rand(.15,.4),c.z+rand(-.4,.4),Math.random()<.5?'#6fe0d0':'#b0f070');}
  const ct=S.clock?.t||0;
  if((ct<.1||ct>.97)&&started&&Math.random()<dt*6){const c=comps[0];if(c){const k=c.tiles[Math.floor(Math.random()*c.tiles.length)],p=tileC(k%GW,(k/GW)|0);wisps.emit(p.x+rand(-.4,.4),WATER_Y+.05,p.z+rand(-.4,.4),'mist');}}
  if(night>.15&&started&&Math.random()<dt*10*night){const i=Math.floor(Math.random()*GW),j=Math.floor(Math.random()*GH),k=idx(i,j);
    if(tiles[k]!==WATER&&(nb8(i,j,WATER)||nb8(i,j,WILD))){const p=tileC(i,j);sparkle(p.x+rand(-.5,.5),rand(.25,.8),p.z+rand(-.5,.5),Math.random()<.7?'#d8ff7a':'#fff0a0');}}
  hintT-=dt;if(hintT>0)return;hintT=.35;
  for(const k of hintVis){const s=secretAt[k],c=tileC(s.i,s.j),h=SECRET_TYPES[s.type].hint;
    if(h==='smoke'&&Math.random()<.8)wisps.emit(c.x+rand(-.1,.1),.9,c.z+rand(-.1,.1),'smoke');
    else if(h==='glint'&&Math.random()<(s.type==='chest'?.7:.25))sparkle(c.x+rand(-.3,.3),rand(.6,1.1),c.z+rand(-.3,.3),'#fff0c0');
    else if(h==='mist'){if(Math.random()<.6)wisps.emit(c.x+rand(-.6,.6),.3+Math.random()*.5,c.z+rand(-.6,.6),'mist');if(Math.random()<.15)sparkle(c.x+rand(-.4,.4),rand(.4,1),c.z+rand(-.4,.4),'#9ff0d0');}
    else if(h==='bell'){if(Math.random()<.2)sparkle(c.x+rand(-.5,.5),rand(.9,1.5),c.z+rand(-.5,.5),'#ffe9a0');}
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
    chest:()=>{S.drops=(S.drops||[]).filter(d=>d.k!==k);const left=BLUEPRINTS.filter(b=>!unlocked(b.id));
      if(left.length&&Math.random()<.7){const b=left[Math.floor(Math.random()*left.length)];S.unlocked[b.id]=true;renderDrawer();toast('An old chest',`Under the lid, wrapped in oilcloth: drawings for <b>${b.name}</b>. You can build them now.`);}
      else{toast('An old chest','Rope, oilcloth and something heavy inside.');queueCrate({source:'an old chest',kind:'mixed'});}},
    temple:()=>{builds[k]=B.TEMPLE;hideLandmark(k);toast('The Drowned Temple','Steps worn by water that left long ago, and a bell that still rings when the wind is right. The village hears it, and so do the fish: they take the line <b>15% more often</b> everywhere.');queueCrate({source:'the Drowned Temple',kind:'mixed'});},
    elder:()=>{builds[k]=B.ELDER;hideLandmark(k);toast('The Elder Cedar','The first tree of the valley. The woodcutters stand under it a long while without speaking. While it stands they cut <b>30% more</b>, everywhere.');},
    tower:()=>{builds[k]=B.TOWER;hideLandmark(k);toast('The Lantern Tower','A keeper’s tower from the days of the barges. Someone lights it again. Its beam shows what hides in the forest <b>within 14 tiles</b>, and draws more pilgrims down the Way.');},
    gate:()=>{builds[k]=B.GATE;hideLandmark(k);const v=Math.round(150*(1+S.found.length*.15));earn(v,c.x,c.z);toast('The Sunken Gate',`Two pillars and a lintel, carved with a stag, an owl and a whale, each bigger than the mountains behind them. The giants of the high country will wander past <b>twice as often</b> now. Moss scraped from it sheds <b>${fmt(v)} scales</b>.`);},
    grove:()=>{toast('An old cedar grove','Tall straight trunks. The woodcutters take <b>20 timber</b> from it.');},
  };
  // the bigger landmarks clear a little ground around themselves
  if(['temple','tower','gate'].includes(s.type)){for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const ni=s.i+a,nj=s.j+b;if(!inGrid(ni,nj))continue;const q=idx(ni,nj);if(tiles[q]===WILD&&!secretAt[q]){tiles[q]=LAND;fellTrees(q);}}worldChanged();}
  T[s.type]();if(['bones','stones','shrine','temple','elder','tower','gate'].includes(s.type)){buildsChanged();updateHintVis();}
  wishEvent('find');save();
}
function toast(title,body){const el=$('toast');el.innerHTML=`<div class="k">Found in the forest</div><h4>${title}</h4><p>${body}</p>`;el.classList.remove('on');void el.offsetWidth;el.classList.add('on');
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),7500);log(title+'.','gold');}

/* ================= keepers, boons, crates ================= */
const keeperSlots=()=>2+builds.reduce((s,b)=>s+(b===B.STONES?1:0),0);
const crateQ=[];let crateOpen=null;
function queueCrate(c){crateQ.push(c);S.crates++;if(!crateOpen)setTimeout(nextCrate,started?900:0);}
function crateCards(kind){
  if(kind==='showcase'){const pk=a=>a[Math.floor(Math.random()*a.length)];const k=pk(KEEPERS),b=pk(BOONS),p=pk(BLUEPRINTS);
    return [{type:'boon',id:b.id,name:b.name,desc:b.desc},{type:'keeper',id:k.id,name:k.name,desc:k.desc,glyph:k.glyph},{type:'blueprint',id:p.id,name:p.name,desc:bpDesc(p)},coinCard()];}
  if(kind==='treasure')return Object.keys(COINS).sort(()=>Math.random()-.5).slice(0,3).map(id=>coinCard(id));
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
  // a mixed crate sometimes holds a treasure instead of one of its cards; an empty one always does
  if(kind!=='keeper'&&out.length>=3&&Math.random()<.4)out[out.length-1]=coinCard();
  if(!out.length)out.push(coinCard('silver'));
  return out;
}
// treasure: a heap of one currency, sized to how far along the valley is
const COINS={scales:{n:'A shoal’s worth of scales',a:c=>Math.round(120*(1+c*.25))},silver:{n:'A purse of silver',a:c=>100+50*c},
  timber:{n:'A raft of timber',a:c=>20+6*c},reeds:{n:'A bundle of reeds',a:c=>20+6*c},clay:{n:'A cart of clay',a:c=>16+5*c},
  lanterns:{n:'A box of lanterns',a:c=>4+c},carvings:{n:'A chest of carvings',a:c=>4+c}};
function coinCard(id){id=id||Object.keys(COINS)[Math.floor(Math.random()*7)];const amt=COINS[id].a(S.crates);
  return {type:'coin',id,name:COINS[id].n,amt,desc:`+${fmt(amt)} ${label(id)}.`};}
// what a card shows besides its name: the change it makes, what it touches, and a live line about your valley
const BOON_UI={
  hands:{per:15,u:'%',chain:[['hire','Fishers'],['scales','Scales']],d:'Fishers bring fish in faster.'},
  sweet:{per:15,u:'%',chain:[['bait','Offerings'],['fish','Fish']],d:'Fish take the line more often.'},
  shine:{per:10,u:'%',chain:[['fish','Fish'],['scales','Scales']],d:'More scales from every fish met.'},
  pockets:{per:8,u:' more',chain:[['trade','Wagons & barges'],['silver','Silver']],d:'Wagons and barges carry more goods.'},
  wheels:{per:15,u:'%',chain:[['trade','Wagons & barges'],['silver','Silver']],d:'Wagons and barges travel faster.'},
  wood:{per:25,u:'%',chain:[['timber','Timber']],d:'Woodcutters bring in more timber.',good:'timber'},
  reed:{per:25,u:'%',chain:[['reeds','Reeds']],d:'Reed beds grow more reeds.',good:'reeds'},
  clay:{per:25,u:'%',chain:[['clay','Clay']],d:'Clay pits dig more clay.',good:'clay'},
  craft:{per:15,u:'%',chain:[['lanterns','Crafts'],['silver','Silver']],d:'Lanterns and carvings sell for more.'},
  hosts:{per:20,u:'%',chain:[['keeper','Pilgrims'],['silver','Silver']],d:'More pilgrims come down the Way, and they leave more in the tale box.'},
  reach:{per:1,u:' tile',chain:[['carvings','Statues'],['health','Charm']],d:'Statues, sheds, racks and charm reach one tile farther.'},
  tide:{per:15,u:' s',chain:[['tide','Good tide'],['scales','Scales']],d:'A good tide lasts longer and climbs higher.'},
};
// the parts of the valley a keeper or blueprint touches, read from its description
const SIG_WORDS=[[/pilgrim/i,'keeper','Pilgrims'],[/wagon|barge|trade/i,'trade','Trade'],[/reed/i,'reeds','Reeds'],[/clay/i,'clay','Clay'],[/timber|woodcut/i,'timber','Timber'],
  [/lantern/i,'lanterns','Lanterns'],[/carving|workshop|craft/i,'carvings','Crafts'],[/fish|reel|line/i,'fish','Fish'],[/scale/i,'scales','Scales'],[/silver|market|sell/i,'silver','Silver'],
  [/charm|flower|cherry|garden/i,'health','Charm'],[/hut|house|village|road|pave/i,'hut','Village'],[/keeper/i,'keeper','Keepers']];
const sigsOf=t=>SIG_WORDS.filter(([re])=>re.test(t)).slice(0,3).map(([,ic,l])=>[ic,l]);
function cardInfo(cd){
  if(cd.type==='boon'){const U=BOON_UI[cd.id]||{per:0,u:''},l=boon(cd.id),mx=BOON[cd.id].max,step=(a,b)=>(1+a*U.per/100)/(1+b*U.per/100);let text='';
    if(U.good){const r=goodRate(U.good);text=r?`${GOODS[U.good].name}: ${r.toFixed(1)} → ${(r*step(l+1,l)).toFixed(1)} a minute`:`No ${GOODS[U.good].name.toLowerCase()} made yet`;}
    else if(cd.id==='hands'||cd.id==='sweet'||cd.id==='shine')text=`${fishersState.length} fisher${fishersState.length===1?'':'s'} on the banks`;
    else if(cd.id==='pockets'){const c=capacity('wagon');text=`A wagon carries ${c} → ${c+8}`;}
    else if(cd.id==='wheels'){const n=trade.vehicles.length;text=n?`${n} wagon${n===1?'':'s'} and barge${n===1?'':'s'} out there`:'No wagons or barges yet';}
    else if(cd.id==='craft'){const p=price('lanterns','wagon');text=`A lantern sells for ${p.toFixed(0)} → ${(p*step(l+1,l)).toFixed(0)} silver`;}
    else if(cd.id==='hosts'){const k=builds.indexOf(B.TALEHALL);text=k>=0?`Each pilgrim leaves ~${fmt(taleGift(k))} → ${fmt(taleGift(k)*step(l+1,l))} silver`:'Pilgrims come to the Tale House';}
    else if(cd.id==='tide')text=`A good tide lasts ${50+15*l} s → ${50+15*(l+1)} s`;
    else if(cd.id==='reach')text='Every statue, shed and rack';
    return {value:{from:l?`+${l*U.per}${U.u}`:null,to:`+${(l+1)*U.per}${U.u}`},chain:U.chain,desc:U.d||BOON[cd.id].desc,foot:{pips:[l,mx],text}};}
  if(cd.type==='keeper')return {desc:cd.desc,chain:sigsOf(cd.desc),foot:{text:`Cottages: ${S.keepers.length} of ${keeperSlots()} taken`}};
  if(cd.type==='blueprint'){const b=BLUEPRINTS.find(x=>x.id===cd.id);return {value:b?.kind==='build'?'A new building':b?.kind==='style'?'A new hut style':'A new paving',chain:[['build','Build'],...sigsOf(cd.desc).slice(0,2)],desc:cd.desc.replace(/^Blueprint\.\s*/,''),foot:{text:'Yours to build once chosen'}};}
  if(cd.type==='coin')return {value:`+${fmt(cd.amt)}`,emblem:emblem(cd.id),desc:{scales:'Scales for clearing, digging and building.',silver:'Silver for hiring, lines and offerings.',timber:'For building, and for the wagons north.',
      reeds:'For lanterns, and for the wagons north.',clay:'For lanterns and statues.',lanterns:'Ready for the wagons and barges.',carvings:'Ready for the wagons and barges.'}[cd.id],foot:{text:`You have ${fmt(have(cd.id))} ${label(cd.id)}`}};
  if(cd.type==='silver')return {emblem:emblem('silver'),value:cd.desc.replace(' silver.',''),chain:[['silver','Silver']],desc:'A purse left for the village.',foot:{text:'Straight into the purse'}};
  return {};
}
function bpDesc(b){if(b.kind==='build')return 'Blueprint. '+DEFS[b.id].desc;if(b.kind==='style')return `Blueprint. Build or restyle huts in ${STYLES[b.id.split(':')[1]].name.toLowerCase()}. A village all in one style is in harmony.`;
  return `Blueprint. Pave roads in ${PAVES[b.id.split(':')[1]].name.toLowerCase()}: wagons roll faster, and it adds charm.`;}
function nextCrate(){
  if(crateOpen||!crateQ.length)return;const c=crateQ.shift();crateOpen=c;c.cards=crateCards(c.kind);
  const el=$('crate');el.hidden=false;el.classList.remove('on','flash');void el.offsetWidth;el.classList.add('on');
  $('crateK').textContent=c.kind==='keeper'?'Someone would like to join you':'A crate';$('crateH').textContent=`From ${c.source}`;
  $('crateR').innerHTML='';const cards=$('crateCards');cards.innerHTML='';
  let picked=false;
  c.cards.forEach((cd,n)=>{const b=document.createElement('button');b.type='button';b.className='card '+cd.type;b.style.setProperty('--cc',cd.type==='coin'?EMBLEMS[cd.id].col:CARD_COL[cd.type]||'#86dcbc');
    b.innerHTML=cardHTML(cd,cardInfo(cd),cd.type==='keeper'?portrait(cd.id):null);
    b.addEventListener('pointerenter',()=>{if(!picked)sfx('tick',n);});
    b.addEventListener('click',()=>{if(picked)return;
      // a full row of cottages asks who makes room first: no flourish yet
      if(cd.type==='keeper'&&S.keepers.length>=keeperSlots()){pickCard(cd);return;}
      picked=true;chooseCard(b,[...cards.children]).then(()=>pickCard(cd));});
    cards.appendChild(b);animateCard(b,n,el);});
  sfx('crate');
}
// Every cottage is taken: the newcomer on the left, the keepers who live here now on the right.
// Each resident shows what they do; hovering one spells out the trade (what leaves, what arrives).
function keeperSwap(cd){
  const el=$('crate');el.classList.add('swapping');$('crateK').textContent='Every keeper’s cottage is taken';$('crateH').textContent=`Who makes room for ${cd.name}?`;
  const sigs=d=>sigsOf(d).map(([ic,l])=>`<span class="ksig">${icon(ic)}<em>${l}</em></span>`).join('');
  const r=$('crateR');
  r.innerHTML=`<div class="swap">
    <div class="sw-new"><span class="sw-tag">Would like to join</span><img class="sw-port" src="${portrait(cd.id)}" alt=""><b>${cd.name}</b><p>${cd.desc}</p><div class="sw-sigs">${sigs(cd.desc)}</div></div>
    <div class="sw-arrow" aria-hidden="true"><i></i></div>
    <div class="sw-list"><span class="sw-tag">Living in the valley · ${S.keepers.length} of ${keeperSlots()} cottages</span>
      ${S.keepers.map(id=>`<button type="button" class="sw-res" data-id="${id}"><img class="sw-port" src="${portrait(id)}" alt=""><span class="sw-t"><b>${KEEPER[id].name}</b><span>${KEEPER[id].desc}</span><span class="sw-sigs">${sigs(KEEPER[id].desc)}</span></span><span class="sw-go">Make room</span></button>`).join('')}
    </div></div>
    <div class="sw-trade" aria-live="polite">Hover a keeper to see the trade.</div>
    <button type="button" class="nav sw-keep">Thank ${cd.name}, but no</button>`;
  const tr=r.querySelector('.sw-trade');
  r.querySelectorAll('.sw-res').forEach(b=>{const id=b.dataset.id;
    const show=()=>{r.querySelectorAll('.sw-res').forEach(o=>o.classList.toggle('on',o===b));tr.innerHTML=`<span class="lose">${KEEPER[id].name} leaves: <i>${KEEPER[id].desc}</i></span><span class="gain">${cd.name} arrives: <i>${cd.desc}</i></span>`;r.querySelector('.swap').classList.add('trading');};
    b.addEventListener('pointerenter',show);b.addEventListener('focus',show);
    const hide=()=>{b.classList.remove('on');r.querySelector('.swap').classList.remove('trading');};b.addEventListener('pointerleave',hide);b.addEventListener('blur',hide);
    b.addEventListener('click',()=>{S.keepers[S.keepers.indexOf(id)]=cd.id;log(`${KEEPER[id].name} moves on. ${cd.name} takes their place.`,'gold');sfx('pick');afterKeepers();closeCrate();});});
  r.querySelector('.sw-keep').addEventListener('click',closeCrate);
}
function closeCrate(){$('crate').classList.remove('swapping');$('crate').hidden=true;crateOpen=null;refreshUI();save();setTimeout(nextCrate,500);}
function pickCard(cd){
  sfx('pick');
  if(cd.type==='keeper'){if(S.keepers.length<keeperSlots()){S.keepers.push(cd.id);log(`${cd.name} comes to live in the valley. ${cd.desc}`,'gold');afterKeepers();closeCrate();return;}
    // full: show the newcomer beside everyone who lives here now, with what each of them does, and let the player choose
    keeperSwap(cd);return;}
  if(cd.type==='boon'){S.boons[cd.id]=boon(cd.id)+1;log(`${cd.name}: ${BOON[cd.id].desc}`,'gold');computeEconomy();}
  if(cd.type==='blueprint'){S.unlocked[cd.id]=true;log(`Blueprint: ${cd.name}. Find it in Build.`,'gold');renderDrawer();}
  if(cd.type==='silver'){earnSilver(100+50*S.crates);}
  if(cd.type==='coin'){if(cd.id==='silver')earnSilver(cd.amt);else if(cd.id==='scales'){S.scales+=cd.amt;S.earned+=cd.amt;}else S.goods[cd.id]=(S.goods[cd.id]||0)+cd.amt;log(`${cd.name}: +${fmt(cd.amt)} ${label(cd.id)}.`,'gold');}
  closeCrate();
}
function afterKeepers(){computeEconomy();renderKeepers();updateHintVis();}
function renderKeepers(){
  const el=$('keepers');const n=keeperSlots();let h='';
  for(let s=0;s<n;s++){const id=S.keepers[s];h+=id?`<div class="kp" tabindex="0"><img class="kimg" src="${portrait(id)}" alt=""><div class="kt"><b>${KEEPER[id].name}</b><br>${KEEPER[id].desc}</div></div>`:`<div class="kp empty" title="An empty keeper’s cottage. Hermits in the forest and crates bring keepers."></div>`;}
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
  if(!S.counts.workshop&&(S.counts.market||(S.orders||[]).some(o=>!GOODS[o.good].raw)))opts.push({kind:'build',id:'workshop',n:1,text:'Open a workshop'});
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
function renderWish(){const w=S.wish;$('wish').innerHTML=w?`<div class="gl"><span class="gi">${icon('wish')}</span><div class="gt"><b>A village wish</b><span>${w.text}</span></div><span class="gn">${fmt(Math.min(w.have,w.n))}/${fmt(w.n)}</span></div>`:'';$('wish').hidden=!w;}

/* ================= named sets ================= */
function near(k,code,r,pred){const i=k%GW,j=(k/GW)|0;const out=[];for(let b=-r;b<=r;b++)for(let a=-r;a<=r;a++){const ni=i+a,nj=j+b;if(!inGrid(ni,nj)||(!a&&!b))continue;const q=idx(ni,nj);if(builds[q]===code&&(!pred||pred(q)))out.push(q);}return out;}
function computeSets(){
  const A={};
  for(let k=0;k<GW*GH;k++){const b=builds[k];if(b===NONE)continue;
    if(b===B.JETTY&&near(k,B.NETS,2).length&&near(k,B.RACK,2).length)A.harbor=true;
    if(b===B.SHOP&&near(k,B.MARKET,3).length&&near(k,B.CLAY,3).length)A.craft=true;
    if(b===B.FLOWERS&&lanternsNear(k,2)>=2&&near(k,B.CHERRY,2).length)A.garden=true;
    if(b===BRIDGE&&lanternsNear(k,1)>=2)A.lbridge=true;
    if(b===ROAD&&S.meta[k]?.pave==='cobble'&&near(k,B.SHRINE,1).length&&lanternsNear(k,2)>=1)A.walk=true;
    if(b===B.PIER){const i=k%GW,j=(k/GW)|0;if((bAt(i+1,j)===B.PIER&&bAt(i+2,j)===B.PIER)||(bAt(i,j+1)===B.PIER&&bAt(i,j+2)===B.PIER))A.row=true;}
    if(b===B.STATUE){const sp=new Set([S.meta[k]?.sp]);near(k,B.STATUE,3).forEach(q=>sp.add(S.meta[q]?.sp));if(sp.size>=3)A.statues=true;}
  }
  if(villages.some(v=>v.huts.length>=5&&v.harmony))A.harmony=true;
  S.setsSeen||=[];
  for(const id of Object.keys(A))if(!S.setsSeen.includes(id)){S.setsSeen.push(id);if(booted){sfx('set');toast(`A named place: ${SET[id].name}`,`${SET[id].hint} <b>${SET[id].bonus}</b>`);$('toast').querySelector('.k').textContent='The village has a name for this';}}
  activeSets=A;
}

/* ================= workers: every big job is walked to and built by hand ================= */
const busy=new Map();const jobs=[];const workers=[];
const builderCount=()=>Math.min(14,2+hutCount());
function nbPending(i,j,kind){return [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>{if(!inGrid(i+a,j+b))return false;const jb=busy.get(idx(i+a,j+b));return jb&&jb.tool===kind;});}
function jobDur(jb){const t=jb.tool;if(t==='weir')return 18;if(t==='clear')return 5;if(t==='dig')return 7;if(t==='bridge')return 8;if(t==='hut')return 9;if(t==='upgrade')return 10+LVL(jb.k)*3;
  const d=DEFS[t.slice(2)];return 4+Math.min(10,((d?.cost?.scales)||10)/8);}
function queueJob(jb){const k=idx(jb.i,jb.j);Object.assign(jb,{k,prog:0,crew:[]});jb.dur=jobDur(jb);busy.set(k,jb);jobs.push(jb);makeSite(jb);
  if(jb.tool==='clear')jb.treeIdx=trees.map((t,n)=>t.tile===k&&!t.gone?n:-1).filter(n=>n>=0);updateMarks();}
function cancelJob(k){const jb=busy.get(k);if(!jb)return;for(const [g,v] of Object.entries(jb.cost||{})){if(g==='scales'||g==='silver')S[g]+=v;else S.goods[g]=(S.goods[g]||0)+v;}
  endJob(jb);log('Work called off. Everything was given back.');sfx('dig');save();}
function endJob(jb){busy.delete(jb.k);const n=jobs.indexOf(jb);if(n>=0)jobs.splice(n,1);if(jb.site)scene.remove(jb.site);jb.crew.forEach(w=>{w.job=null;goHome(w);});jb.crew=[];updateMarks();}
function finishJob(jb){endJob(jb);applyJob(jb);save();}
const walkable=k=>tiles[k]!==RIM&&(tiles[k]!==WATER||builds[k]===BRIDGE||builds[k]===B.PIER);
function tilePath(from,goals){ // BFS over walkable tiles; goals: Set of tile indices
  const prev=new Int32Array(GW*GH).fill(-2);prev[from]=-1;const q=[from];let end=-1;
  for(let h=0;h<q.length;h++){const t=q[h];if(goals.has(t)){end=t;break;}const i=t%GW,j=(t/GW)|0;
    for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const ni=i+a,nj=j+b;if(!inGrid(ni,nj))continue;const nk=idx(ni,nj);if(prev[nk]!==-2||!walkable(nk))continue;
      if(a&&b&&(!walkable(idx(i+a,j))||!walkable(idx(i,j+b))))continue;prev[nk]=t;q.push(nk);}}
  if(end<0)return null;const out=[];for(let t=end;t>=0;t=prev[t])out.push(t);return out.reverse();}
function homeFor(k){let best=-1,bd=1e9;const i=k%GW,j=(k/GW)|0;for(let q=0;q<GW*GH;q++)if(builds[q]===HUT){const d=Math.hypot(q%GW-i,((q/GW)|0)-j);if(d<bd){bd=d;best=q;}}return best>=0?best:idx(WAY_I,0);}
const wCoats=['#7a5a3a','#5f6f3a','#8a4f3a','#4f5f6a'].map(c=>rimMat({color:c},'#ffd9a8',1));
const toolM=rimMat({color:'#8a8a8a'},'#ffffff',.8);
function makeWorker(){const g=new THREE.Group();const coat=wCoats[workers.length%4];
  g.add(new THREE.Mesh(bodyG,coat),new THREE.Mesh(headG,skinM),new THREE.Mesh(hatG,hatM));
  const arm=new THREE.Group();arm.position.set(.05,.15,0);const handle=new THREE.Mesh(rodG,rodM);handle.scale.set(1,.45,1);const head=new THREE.Mesh(new THREE.BoxGeometry(.05,.03,.02).translate(0,.25,0),toolM);arm.add(handle,head);g.add(arm);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});g.visible=false;scene.add(g);
  const w={g,arm,state:'home',job:null,path:null,seg:0,u:0,x:0,z:0,home:-1,ph:Math.random()*6};workers.push(w);return w;}
function pathPts(tilesArr,endPt){const pts=tilesArr.map(t=>{const c=tileC(t%GW,(t/GW)|0);return {x:c.x+rand(-.15,.15),z:c.z+rand(-.15,.15)};});if(endPt)pts.push(endPt);return pts;}
function jobGoals(k){const i=k%GW,j=(k/GW)|0,goals=new Set();if(walkable(k))goals.add(k);else for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){if(inGrid(i+a,j+b)&&walkable(idx(i+a,j+b)))goals.add(idx(i+a,j+b));}return goals;}
// homes a worker could set out from, nearest first (huts, then the Pilgrim Way)
function homesFor(k){const i=k%GW,j=(k/GW)|0,hs=[];for(let q=0;q<GW*GH;q++)if(builds[q]===HUT)hs.push(q);hs.sort((a,b)=>Math.hypot(a%GW-i,((a/GW)|0)-j)-Math.hypot(b%GW-i,((b/GW)|0)-j));hs.push(idx(WAY_I,0));return hs;}
// returns false when no one can walk there: nobody swims, so the job waits for a bridge or pier
function sendTo(w,jb){
  const k=jb.k,c=tileC(k%GW,(k/GW)|0),goals=jobGoals(k);let tp=null;
  if(w.state==='home'){for(const h of homesFor(k)){tp=tilePath(h,goals);if(tp){w.home=h;break;}}}
  else tp=tilePath(idx(clamp(Math.floor(w.x+HX),0,GW-1),clamp(Math.floor(w.z+HZ),0,GH-1)),goals);
  if(!tp)return false;
  if(w.state==='home'){const hc=tileC(w.home%GW,(w.home/GW)|0);w.x=hc.x;w.z=hc.z+.2;w.g.visible=true;}
  const slot=jb.crew.indexOf(w);
  let end;if(tp){const last=tp[tp.length-1];const lc=tileC(last%GW,(last/GW)|0);end=last===k?{x:c.x+(slot?.22:-.22),z:c.z+(slot?-.12:.12)}:{x:lerp(lc.x,c.x,.45)+rand(-.1,.1),z:lerp(lc.z,c.z,.45)+rand(-.1,.1)};}
  w.path=[{x:w.x,z:w.z},...(tp?pathPts(tp.slice(1,-1)):[]),end||{x:c.x,z:c.z}];w.seg=0;w.u=0;w.state='walk';w.job=jb;return true;
}
function goHome(w){if(w.state==='home')return;const h=w.home>=0&&builds[w.home]===HUT?w.home:homeFor(idx(clamp(Math.floor(w.x+HX),0,GW-1),clamp(Math.floor(w.z+HZ),0,GH-1)));w.home=h;
  const from=idx(clamp(Math.floor(w.x+HX),0,GW-1),clamp(Math.floor(w.z+HZ),0,GH-1));let tp=tilePath(from,new Set([h]));
  if(!tp){for(const h2 of homesFor(from)){tp=tilePath(from,new Set([h2]));if(tp){w.home=h2;break;}}}
  if(!tp){w.state='home';w.g.visible=false;w.job=null;return;} // no dry way back: they slip home out of sight
  const hc=tileC(w.home%GW,(w.home/GW)|0);
  w.path=[{x:w.x,z:w.z},...(tp?pathPts(tp.slice(1,-1)):[]),{x:hc.x,z:hc.z+.2}];w.seg=0;w.u=0;w.state='back';w.job=null;}
function workerY(x,z){return village.walkY(x,z)-.01;}
function workTick(dt,t){
  while(workers.length<builderCount())makeWorker();
  // hand out work: two hands per job at most, oldest job first
  for(const jb of jobs){if(jb.wait>0){jb.wait-=dt;continue;}
    while(jb.crew.length<2){const idle=workers.filter(w=>!w.job&&(w.state==='home'||w.state==='back'));if(!idle.length)break;
      const c=tileC(jb.i,jb.j);idle.sort((a,b)=>Math.hypot(a.x-c.x,a.z-c.z)-Math.hypot(b.x-c.x,b.z-c.z));const w=idle[0];jb.crew.push(w);
      if(!sendTo(w,jb)){jb.crew.pop();if(!jb.crew.length){jb.blocked=true;jb.wait=4;}break;}jb.blocked=false;}}
  for(const w of workers){
    if(w.state==='walk'||w.state==='back'){const a=w.path[w.seg],b=w.path[w.seg+1];
      if(!b){if(w.state==='back'){w.state='home';w.g.visible=false;}else w.state='work';continue;}
      const L=Math.hypot(b.x-a.x,b.z-a.z)||1e-3;w.u+=dt*.8/L;if(w.u>=1){w.u=0;w.seg++;continue;}
      w.x=lerp(a.x,b.x,w.u);w.z=lerp(a.z,b.z,w.u);w.g.position.set(w.x,workerY(w.x,w.z)+Math.abs(Math.sin(t*9+w.ph))*.012,w.z);w.g.rotation.set(0,Math.atan2(b.x-a.x,b.z-a.z),0);w.arm.rotation.x=Math.sin(t*9+w.ph)*.4;continue;}
    if(w.state==='work'&&w.job){const jb=w.job,c=tileC(jb.i,jb.j);w.g.rotation.y=Math.atan2(c.x-w.x,c.z-w.z);
      const sw=(t*4+w.ph)%1;w.arm.rotation.x=sw<.3?-1.6+sw/.3*2.2:.6-(sw-.3)/.7*2.2;w.g.position.y=workerY(w.x,w.z)+(sw<.3?.01:0);
      // the tool lands: now and then you hear it
      if((w.lastSw??0)<.3&&sw>=.3){const snd=jb.tool==='clear'?['chop',.5]:jb.tool==='dig'?['dig',.35]:['hammer',.4];if(Math.random()<snd[1])soundAt(snd[0],w.x,w.z);}
      w.lastSw=sw;
      jb.prog+=dt/jb.dur*.65;
      if(Math.random()<dt*3){const e=jb.tool==='clear'?['#7fae4a','#b98552']:jb.tool==='dig'?['#8a6a48','#dff8ee']:['#ffe9bf','#c9a36a'];sparkle(lerp(w.x,c.x,.5)+rand(-.15,.15),.2,lerp(w.z,c.z,.5)+rand(-.15,.15),e[Math.random()<.5?0:1]);}
      if(Math.random()<dt*1.2)wisps.emit(c.x+rand(-.3,.3),.06,c.z+rand(-.3,.3),'smoke',jb.tool==='dig'?[.5,.42,.32]:[.72,.66,.56]);}
  }
  for(const jb of jobs.slice()){updateSite(jb);
    if(jb.treeIdx){const due=Math.floor(jb.prog*(jb.treeIdx.length+1));for(let n=0;n<Math.min(due,jb.treeIdx.length);n++)fellOne(jb.treeIdx[n]);}
    if(jb.prog>=1){if(jb.treeIdx)jb.treeIdx.forEach(fellOne);finishJob(jb);}}
}
// construction sites: a scaffold that rises with the work, a muddy patch for digging, a log pile for clearing
const siteM={post:rimMat({color:'#8a6440'},'#ffd29a',.6),plank:rimMat({color:'#b08a5a'},'#ffd29a',.6),mud:rimMat({color:'#5a4330'},'#ffcf99',.2),log:rimMat({color:'#9a6b3f'},'#ffd29a',.6)};
const siteG={post:new THREE.CylinderGeometry(.015,.018,1,4).translate(0,.5,0),beam:new THREE.BoxGeometry(.6,.02,.02),plank:new THREE.BoxGeometry(.2,.02,.07),mud:new THREE.BoxGeometry(.9,.02,.9),log:new THREE.CylinderGeometry(.025,.025,.24,5).rotateZ(Math.PI/2)};
function makeSite(jb){const g=new THREE.Group(),c=tileC(jb.i,jb.j);const water=tiles[jb.k]===WATER;g.position.set(c.x,water?DECK_Y:heightAt(c.x,c.z),c.z);
  if(jb.tool==='dig'){const m=new THREE.Mesh(siteG.mud,siteM.mud);m.position.y=.012;g.add(m);g.userData.mud=m;}
  else if(jb.tool==='clear'){for(let n=0;n<6;n++){const l=new THREE.Mesh(siteG.log,siteM.log);l.position.set(.3+(n%3)*.055-.05,.03+Math.floor(n/3)*.045,-.3);l.visible=false;g.add(l);}g.userData.logs=true;}
  else{const posts=[];for(const [x,z] of [[-.28,-.28],[.28,-.28],[-.28,.28],[.28,.28]]){const p=new THREE.Mesh(siteG.post,siteM.post);p.position.set(x,water?-.6:0,z);p.scale.y=water?.62:.01;g.add(p);posts.push(p);}
    const beams=[];for(const [x,z,r] of [[0,-.28,0],[0,.28,0],[-.28,0,1],[.28,0,1]]){const b=new THREE.Mesh(siteG.beam,siteM.post);b.position.set(x,.2,z);b.rotation.y=r*Math.PI/2;b.visible=false;g.add(b);beams.push(b);}
    for(let n=0;n<3;n++){const p=new THREE.Mesh(siteG.plank,siteM.plank);p.position.set(-.3,.012+n*.022,.38);g.add(p);}
    g.userData.posts=posts;g.userData.beams=beams;g.userData.water=water;}
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(g);jb.site=g;}
function updateSite(jb){const u=jb.site?.userData;if(!u)return;const p=clamp(jb.prog,0,1);
  if(u.mud){u.mud.material=siteM.mud;u.mud.scale.set(.3+.7*p,1,.3+.7*p);}
  if(u.logs)jb.site.children.forEach((l,n)=>{l.visible=n<Math.floor(p*7);});
  if(u.posts){const h=.05+.33*Math.min(1,p*1.6);u.posts.forEach(po=>{po.scale.y=u.water?.62+h:h;});u.beams.forEach((b,n)=>{b.visible=p>.35+n*.08;b.position.y=h*.92;});}}
function saveJobs(){return jobs.map(j=>({tool:j.tool,i:j.i,j:j.j,sp:j.sp,style:j.style,cost:j.cost}));}

/* ================= corners and edges: lanterns and lamps where tiles meet, fences and walls between them ================= */
const CORNER={lantern:{name:'Stone lantern',cost:{scales:10,clay:2},charm:3,lock:'lantern'},lamp:{name:'Lamp post',cost:{scales:4,clay:1},charm:1.5}};
// edges: 'h i,j' runs along x between tiles (i,j-1) and (i,j); 'v i,j' runs along z between (i-1,j) and (i,j)
function edgeTiles(key){const h=key[0]==='h',[i,j]=key.slice(1).split(',').map(Number);const a=h?[i,j-1]:[i-1,j],b=[i,j];return [a,b].filter(([x,y])=>inGrid(x,y)).map(([x,y])=>idx(x,y));}
function lanternsNear(k,r){const i=k%GW,j=(k/GW)|0;let n=0;for(const [key,t] of Object.entries(S.corners||{})){if(t!=='lantern')continue;const [ci,cj]=key.split(',').map(Number);if(ci>=i-r&&ci<=i+r+1&&cj>=j-r&&cj<=j+r+1)n++;}return n;}
function snapAt(p,kind){const fx=p.x+HX,fz=p.z+HZ;
  if(kind==='c'){const ci=Math.round(fx),cj=Math.round(fz);return {kind,key:ci+','+cj,ci,cj,x:ci-HX,z:cj-HZ};}
  const i=Math.floor(fx),j=Math.floor(fz),ax=fx-i,az=fz-j;const d=[[az,'h',i,j],[1-az,'h',i,j+1],[ax,'v',i,j],[1-ax,'v',i+1,j]].sort((a,b)=>a[0]-b[0])[0];
  const [,o,ei,ej]=d;return {kind,key:o+ei+','+ej,x:o==='h'?ei-HX+.5:ei-HX,z:o==='h'?ej-HZ:ej-HZ+.5,dir:o};}
const landish=q=>tiles[q]===LAND;
function canDeco(tl,sn){const type=tl.slice(2);
  if(sn.kind==='c'){const tt=[[-1,-1],[0,-1],[-1,0],[0,0]].map(([a,b])=>[sn.ci+a,sn.cj+b]).filter(([x,y])=>inGrid(x,y)).map(([x,y])=>idx(x,y));
    if(!tt.some(landish))return {ok:false,why:'Needs cleared land beside it'};const cur=S.corners?.[sn.key];
    if(CORNER[type].lock&&!unlocked(CORNER[type].lock))return {ok:false,why:'Needs a blueprint'};
    if(cur===type)return {ok:true,remove:true};return {ok:true,cost:CORNER[type].cost,replace:!!cur};}
  const tt=edgeTiles(sn.key);if(!tt.some(landish))return {ok:false,why:'Needs cleared land on one side'};const cur=S.edges?.[sn.key];
  if(cur===type)return {ok:true,remove:true};return {ok:true,cost:EDGE[type].cost,replace:!!cur};}
function actDeco(tl,sn,quiet){const r=canDeco(tl,sn);if(!r.ok){if(!quiet){log(r.why+'.','warn');sfx('no');}return;}const type=tl.slice(2),store=sn.kind==='c'?(S.corners||={}):(S.edges||={});
  if(r.remove){if(quiet)return;delete store[sn.key];}else{if(!pay(r.cost))return;store[sn.key]=type;if(type==='lantern')wishEvent('build',{id:'lantern'});sparkle(sn.x,.3,sn.z,'#ffe9bf');}
  sfx('build');computeEconomy();village.sync();refreshUI();if(!quiet)save();}
const decoMark=new THREE.Group();{const m=new THREE.MeshBasicMaterial({color:'#ffe6b0',transparent:true,opacity:.85,depthTest:false,fog:false});
  const ring=new THREE.Mesh(new THREE.RingGeometry(.07,.11,12).rotateX(-Math.PI/2),m),bar=new THREE.Mesh(new THREE.BoxGeometry(1,.02,.06),m);decoMark.add(ring,bar);decoMark.userData={ring,bar,m};decoMark.renderOrder=11;decoMark.visible=false;scene.add(decoMark);}
function showDeco(sn,ok){decoMark.visible=true;const u=decoMark.userData;u.ring.visible=sn.kind==='c';u.bar.visible=sn.kind==='e';u.m.color.set(ok?'#ffe6b0':'#e98a5f');
  decoMark.position.set(sn.x,Math.max(heightAt(sn.x,sn.z),LAND_Y)+.04,sn.z);decoMark.rotation.y=sn.dir==='v'?Math.PI/2:0;}
// old saves: stone lantern tiles, plot lamps and plot edges move onto the shared corners and edges
function migrateDeco(){S.corners=S.corners||{};S.edges=S.edges||{};
  for(let k=0;k<GW*GH;k++){const i=k%GW,j=(k/GW)|0;
    if(builds[k]===B.LANTERN){builds[k]=NONE;S.corners[i+','+j]='lantern';}
    const sl=S.meta[k]?.slots;if(!sl)continue;if(sl.lamp){S.corners[(i+1)+','+(j+1)]=S.corners[(i+1)+','+(j+1)]||'lamp';delete sl.lamp;}
    for(const [sd,t] of Object.entries(sl.edges||{})){if(!t)continue;const key=sd==='n'?'h'+i+','+j:sd==='s'?'h'+i+','+(j+1):sd==='w'?'v'+i+','+j:'v'+(i+1)+','+j;S.edges[key]=t;}delete sl.edges;}}

/* ================= plots: click a building to upgrade it and dress its yard ================= */
const UPGRADABLE=new Set([B.STATUE,HUT,B.WOOD,B.REED,B.CLAY,B.SHOP,B.POST,B.JETTY,B.MARKET]);
const YARDS={logs:{name:'Log pile',cost:{timber:4},charm:.5},sawhorse:{name:'Sawhorse',cost:{timber:3},charm:.5},bricks:{name:'Brick racks',cost:{clay:4},charm:.5},display:{name:'Display bench',cost:{timber:3,clay:1},charm:1},
  crates:{name:'Crates',cost:{timber:3},charm:.5},hitch:{name:'Hitching post',cost:{timber:2},charm:.5},barrels:{name:'Barrels',cost:{timber:3},charm:.5},
  garden:{name:'Vegetable patch',cost:{scales:6,reeds:2},charm:1},woodpile:{name:'Woodpile',cost:{timber:4},charm:1},well:{name:'Well',cost:{scales:10,clay:3},charm:2},
  tree:{name:'Shade tree',cost:{scales:8},charm:2},bench:{name:'Bench',cost:{timber:2},charm:1},planter:{name:'Planter',cost:{clay:2},charm:1}};
const EDGE_TYPES=[null,'fence','hedge','wall'];const EDGE={fence:{name:'Fence',cost:{timber:1},charm:.5},hedge:{name:'Hedge',cost:{scales:3},charm:1},wall:{name:'Low wall',cost:{clay:1},charm:.5}};
const LAMP={cost:{scales:4,clay:1},charm:1};
const SIDES=[['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]];
// decor and things found in the forest have no plot: they are the decoration
const plottable=k=>{const b=builds[k];if(b===B.WEIR)return true;return !!YARDS_OF[b]||UPGRADABLE.has(b);};
function plotName(k){const b=builds[k],l=LVL(k);if(b===HUT)return ['Hut','House','Longhouse'][l-1];if(b===B.STATUE)return `${['Stone','Bronze','Gilded'][l-1]} ${SP[S.meta[k]?.sp]?.name||'fish'}`;if(b===ROAD)return (k===idx(WAY_I,0)?'The Pilgrim Way':PAVES[S.meta[k]?.pave||'dirt'].name+' road');
  const d=DEF_BY_CODE[b];return (l>1?['','Improved ','Grand '][l-1]:'')+(d?d.name:'Plot');}
function upgInfo(k){const b=builds[k],l=LVL(k);if(!UPGRADABLE.has(b)||l>=3)return null;
  // a statue is raised with the folklore of its own fish: the 2nd tale for the first raising, the 3rd for the second
  if(b===B.STATUE){const sp=S.meta[k]?.sp||'koi',need=l+1,have=talesKnown(sp),nm=SP[sp]?.name||'fish';
    const cost=l===1?{scales:120,clay:10}:{scales:320,clay:24,timber:20};
    return {cost,txt:l===1?`Recast in bronze · blessing ×1.5, stone lanterns`:`Gild it · blessing ×2 and 1 tile wider, a halo and banners`,
      locked:have<need?`Needs the ${need===2?'2nd':'3rd'} tale of the ${nm} (${have} of 3 known). Meet it more often.`:null};}
  const n=S.upgrades||0,f=Math.pow(1.12,n);const base=l===1?{scales:60,timber:10}:{scales:180,timber:25,clay:8};const cost={};for(const [g,v] of Object.entries(base))cost[g]=Math.round(v*f);
  const txt=b===HUT?(l===1?'House: +2 beds':'Longhouse: +3 more beds'):b===B.POST||b===B.JETTY?`carries ×${l===1?1.5:2}`:b===B.MARKET?`prices ×${l===1?1.25:1.5}`:`output ×${l===1?1.5:2}`;
  return {cost,txt};}
const YARDS_OF={[B.TALEHALL]:['bench','tree','planter'],[HUT]:['garden','woodpile','well','tree','bench'],[ROAD]:['bench','planter','tree'],[B.WOOD]:['logs','sawhorse','tree'],[B.CLAY]:['bricks','barrels'],[B.SHOP]:['display','crates','bench'],
  [B.POST]:['crates','hitch','barrels'],[B.JETTY]:['crates','barrels'],[B.MARKET]:['crates','barrels','bench'],[B.NETS]:['barrels','tree'],[B.RACK]:['barrels','tree']};
const yardsFor=k=>YARDS_OF[builds[k]]||[];
const edgeAllowed=(k,side)=>{if(builds[k]!==ROAD)return true;const [,a,b]=SIDES.find(s=>s[0]===side);const i=k%GW+a,j=((k/GW)|0)+b;if(!inGrid(i,j))return true;const nb=builds[idx(i,j)];return !(nb===ROAD||nb===BRIDGE||LINKERS.has(nb));};
let plotK=-1;
function openPlot(k){plotK=k;$('plot').hidden=false;renderPlot();sfx('pick');}
function closePlot(){plotK=-1;$('plot').hidden=true;}
function slotsOf(k){S.meta[k]=S.meta[k]||{};return (S.meta[k].slots||={edges:{}});}
function renderPlot(){
  const k=plotK;if(k<0)return;if(!plottable(k)&&!busy.has(k)){closePlot();return;}
  const el=$('plot'),jb=busy.get(k),sl=S.meta[k]?.slots||{edges:{}},up=upgInfo(k);const canRot=![NONE,ROAD,BRIDGE,B.PIER,B.JETTY,B.WEIR,B.REED,B.FENCE].includes(builds[k]);let h=`<div class="ph"><b>${plotName(k)}</b>${canRot?'<button type="button" class="rot" data-a="rotate" title="Rotate (R)">↻</button>':''}${UPGRADABLE.has(builds[k])?`<span class="lv">Lv ${LVL(k)}</span>`:''}<button type="button" class="x" data-a="close">×</button></div>`;
  if(builds[k]===B.WEIR){h+=`<p class="dim">${DEFS.weir.desc}</p>`;if(!jb)h+=`<button type="button" class="pu" data-a="weir"><span>Take down the weir · valley health +15, more fish come up</span><span class="ic">${costHTML(WEIR_COST)}</span></button>`;}
  if(jb)h+=`<div class="pj">${jb.tool==='upgrade'?'Upgrading':'Workers at it'} · ${Math.floor(jb.prog*100)}%<div class="ob"><i style="width:${(jb.prog*100).toFixed(0)}%"></i></div><button type="button" class="chip" data-a="cancel">Call it off (full refund)</button></div>`;
  if(!jb&&up)h+=up.locked?`<div class="pu locked"><span>Next: ${up.txt}</span><span class="dim">${up.locked}</span></div>`:`<button type="button" class="pu" data-a="upgrade"><span>Upgrade · ${up.txt}</span><span class="ic">${costHTML(up.cost)}</span></button>`;
  if(builds[k]===B.STATUE&&!jb){const bs=S.meta[k]?.base||'round';h+=`<div class="pr"><span class="pl">Base</span>${[['round','Round'],['square','Square'],['tri','Triangle']].map(([v,n])=>`<button type="button" data-base="${v}" aria-pressed="${bs===v}">${n}</button>`).join('')}</div>`;}
  if(builds[k]===B.SHOP&&!jb){const m=S.meta[k]?.make||'auto',p=producers.find(p=>p.k===k);
    h+=`<div class="pr"><span class="pl">Makes</span>${[['auto','What’s needed'],['lanterns','Lanterns'],['carvings','Carvings']].map(([v,n])=>`<button type="button" data-mk="${v}" aria-pressed="${m===v}">${n}</button>`).join('')}</div>`;
    h+=`<div class="dim small">Lantern: ${recipeTxt('lanterns')} · Carving: ${recipeTxt('carvings')}${p?` · ${p.rate.toFixed(1)} a minute`:''}</div>`;
    if(p?.stall)h+=`<div class="small" style="color:var(--ember)">Waiting for ${p.stall}.</div>`;}
  if((!jb||jb.tool==='upgrade')&&builds[k]!==B.WEIR){
    if(yardsFor(k).length)h+=`<div class="pr"><span class="pl">Yard</span>${yardsFor(k).map(y=>`<button type="button" data-y="${y}" aria-pressed="${sl.yard===y}" title="${YARDS[y].name}: +${YARDS[y].charm} charm around it">${YARDS[y].name}</button>`).join('')}${sl.yard?'<button type="button" data-y="">clear</button>':''}</div>`;
    h+=`<div class="dim small">Charm here ${charm[k].toFixed(1)} · lanterns and fences go on corners and edges (Build → Decor)</div>`;}
  el.innerHTML=h;
  el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>plotAct(b.dataset.a)));
  el.querySelectorAll('[data-y]').forEach(b=>b.addEventListener('click',()=>plotYard(b.dataset.y)));
  el.querySelectorAll('[data-base]').forEach(b=>b.addEventListener('click',()=>{S.meta[k]={...(S.meta[k]||{}),base:b.dataset.base};village.sync();sfx('set');renderPlot();save();}));
  el.querySelectorAll('[data-mk]').forEach(b=>b.addEventListener('click',()=>{S.meta[k]={...(S.meta[k]||{}),make:b.dataset.mk};sfx('pluck');renderPlot();save();}));
  el.querySelectorAll('[data-e]').forEach(b=>b.addEventListener('click',()=>plotEdge(b.dataset.e)));
}
const WEIR_COST={scales:150,timber:20};
function plotAct(a){const k=plotK;if(a==='close'){closePlot();return;}
  if(a==='rotate'){rotateAt(k);return;}
  if(a==='weir'){if(!pay(WEIR_COST))return;queueJob({tool:'weir',i:k%GW,j:(k/GW)|0,cost:WEIR_COST});renderPlot();refreshUI();save();return;}
  if(a==='cancel'){cancelJob(k);renderPlot();refreshUI();return;}
  if(a==='upgrade'){const up=upgInfo(k);if(!up||up.locked||!pay(up.cost))return;S.upgrades=(S.upgrades||0)+1;queueJob({tool:'upgrade',i:k%GW,j:(k/GW)|0,cost:up.cost});sfx('pluck');renderPlot();refreshUI();save();return;}
  if(a==='lamp'){const sl=slotsOf(k);if(sl.lamp){sl.lamp=false;}else{if(!pay(LAMP.cost))return;sl.lamp=true;}afterSlot();}}
function plotYard(y){const k=plotK,sl=slotsOf(k);if(!y){sl.yard=null;afterSlot();return;}if(sl.yard===y)return;if(!pay(YARDS[y].cost))return;sl.yard=y;afterSlot();}
function plotEdge(sd){const k=plotK,sl=slotsOf(k);sl.edges=sl.edges||{};const cur=EDGE_TYPES.indexOf(sl.edges[sd]||null);const nx=EDGE_TYPES[(cur+1)%EDGE_TYPES.length];
  if(nx&&!pay(EDGE[nx].cost))return;sl.edges[sd]=nx;afterSlot();}
function afterSlot(){sfx('build');buildsChanged();renderPlot();refreshUI();save();}
function positionPlot(){if(plotK<0)return;const c=tileC(plotK%GW,(plotK/GW)|0);const p=toScreen(c.x,.3,c.z);const el=$('plot');
  const w=el.offsetWidth,h=el.offsetHeight;let l=p.x+30,t=p.y-h/2;if(l+w>innerWidth-12)l=p.x-w-30;el.style.left=Math.max(12,l)+'px';el.style.top=clamp(t,70,innerHeight-h-90)+'px';}
function slotCharm(){for(let k=0;k<GW*GH;k++){const sl=S.meta[k]?.slots;if(!sl||builds[k]===NONE)continue;
  if(sl.yard&&YARDS[sl.yard])spread(k,1,q=>charm[q]+=YARDS[sl.yard].charm);}
  for(const [key,t] of Object.entries(S.corners||{})){const [ci,cj]=key.split(',').map(Number);for(const [a,b] of [[-1,-1],[0,-1],[-1,0],[0,0]])if(inGrid(ci+a,cj+b))charm[idx(ci+a,cj+b)]+=CORNER[t].charm;}
  for(const [key,t] of Object.entries(S.edges||{})){for(const q of edgeTiles(key))charm[q]+=EDGE[t].charm;}}

/* ================= camera ================= */
let tween=null;
function tweenTo(p,z,dur){tween={from:{x:view.t.x,y:view.t.y,z:view.t.z,zoom:view.z},to:{x:p.x,y:p.y??0,z:p.z,zoom:z},t:0,dur};}
function updateCamera(dt){
  if(tween){tween.t+=dt/tween.dur;const k=easeInOut(Math.min(1,tween.t));
    view.t.set(lerp(tween.from.x,tween.to.x,k),lerp(tween.from.y,tween.to.y,k),lerp(tween.from.z,tween.to.z,k));view.z=Math.exp(lerp(Math.log(tween.from.zoom),Math.log(tween.to.zoom),k));
    if(tween.t>=1)tween=null;}
  view.t.x=clamp(view.t.x,-HX-26,HX+26);view.t.z=clamp(view.t.z,-HZ-45,HZ+24);
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
let loreKey='';const TALE_STAGES=[6,12,18,24];
/* ---- night lights: gather every light source, hand the nearest to the post pass ---- */
let lampOn=0,lampT=0;
function gatherLamps(){const L=[];const at=(kind,x,z,scale)=>L.push({kind,x,y:heightAt(x,z),z,scale});
  for(let k=0;k<GW*GH;k++){const b=builds[k];if(b===NONE||b===ROAD&&!S.meta[k]?.slots?.lamp)continue;const c=tileC(k%GW,(k/GW)|0);
    if(b===HUT)at('window',c.x,c.z,(S.meta[k]?.style==='lacquer'?1.4:1)*(1+.25*(LVL(k)-1)));
    else if(b===B.LANTERN)at('lantern',c.x,c.z);
    else if(b===B.SHOP||b===B.MARKET||b===B.POST)at('shop',c.x,c.z,1+.2*(LVL(k)-1));
    else if(b===B.SHRINE)at('shrine',c.x,c.z);
    else if(b===B.TALEHALL)at('shop',c.x,c.z+.2,1.5+allTales()/24);
    else if(b===B.TOWER)at('lantern',c.x,c.z,2.4);else if(b===B.TEMPLE)at('shrine',c.x,c.z+.6,1.6);else if(b===B.GATE)at('shrine',c.x,c.z,.7);
    else if(b===B.STATUE&&LVL(k)>=2)at('lantern',c.x,c.z+.3,LVL(k)>=3?.8:.55);
    if(S.meta[k]?.slots?.lamp)at('lamp',c.x+.3,c.z+.3);}
  for(const key of Object.keys(S.corners||{})){const [ci,cj]=key.split(',').map(Number);at(S.corners[key]==='lamp'?'lamp':'lantern',ci-HX,cj-HZ);}
  for(const f of fishersState){const p=f.g.position;L.push({kind:'fisher',x:p.x+.12,y:p.y,z:p.z+.08});}
  lamps.set(L);}
function lightsTick(dt){
  lampOn+=(clamp(dusk/.62,0,1)-lampOn)*Math.min(1,dt*1.5);lamps.uniforms.uLampOn.value=lampOn;postMat.uniforms.uBloom.value=.28+.9*lampOn;
  lampT-=dt;if(lampT>0)return;lampT=.5;
  if(lampOn>.001){gatherLamps();lamps.update(view.t.x,view.t.z);}}

/* ================= post / pixel pipeline ================= */
const bloom=makeBloom(renderer),lamps=makeLamps();
const invPV=new THREE.Matrix4();
const postMat=new THREE.ShaderMaterial({
  uniforms:{tScene:{value:null},tDepth:{value:null},tBloomA:{value:null},tBloomB:{value:null},uBloom:{value:.3},uInvPV:{value:invPV},
    uRes:{value:new THREE.Vector2(1,1)},uTime:U.time,uDusk:U.dusk,uMist:{value:0},uGloom:{value:0},uFlash:{value:0},uSnowSky:{value:0},...lamps.uniforms},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`uniform sampler2D tScene;uniform sampler2D tDepth;uniform sampler2D tBloomA;uniform sampler2D tBloomB;uniform float uBloom;uniform mat4 uInvPV;
  uniform vec2 uRes;uniform float uTime;uniform float uDusk;uniform float uMist;uniform float uGloom;uniform float uFlash;uniform float uSnowSky;varying vec2 vUv;
  ${LAMP_GLSL}
  ${NOISE_GLSL}
  vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
  float bayer4(vec2 p){int x=int(mod(p.x,4.0)),y=int(mod(p.y,4.0));int i=x+y*4;
    float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return m[i]/16.0;}
  void main(){
    vec2 cell=floor(vUv*uRes)+0.5;vec2 uv=cell/uRes;
    vec4 s=texture2D(tScene,uv);float a=clamp(s.a,0.0,1.0);
    vec3 sky=mix(vec3(0.95,0.72,0.52),vec3(0.28,0.45,0.55),smoothstep(0.25,1.05,uv.y));
    sky+=vec3(1.0,0.75,0.5)*0.55*exp(-length((uv-vec2(0.0,0.92))*vec2(1.3,1.0))*2.6);
    sky=mix(sky,vec3(0.05,0.07,0.15)+vec3(0.35,0.3,0.45)*exp(-length((uv-vec2(0.0,0.92))*vec2(1.3,1.0))*2.6),uDusk*0.85);
    // lamp light: rebuild each pixel's world position from depth and light it from nearby lamps
    vec3 lit=s.rgb;
    float dep=texture2D(tDepth,uv).r;vec4 wp=uInvPV*vec4(uv*2.0-1.0,dep*2.0-1.0,1.0);wp/=wp.w;
    if(uLampOn>0.001&&a>0.0){
      vec3 L=lampLight(wp.xyz,uTime);
      lit=s.rgb*(1.0-0.15*uLampOn)*(1.0+L*2.6)+L*0.05;}
    // grey weather: a lower, flatter light
    sky=mix(sky,vec3(0.55,0.6,0.64)*(1.0-uDusk*0.7),uGloom*0.7);sky=mix(sky,vec3(0.86,0.88,0.92)*(1.0-uDusk*0.6),uSnowSky*0.4);
    lit=mix(lit,vec3(dot(lit,vec3(0.3,0.5,0.2)))*vec3(0.92,0.97,1.02),uGloom*0.25)*(1.0-uGloom*0.12);
    vec3 col=mix(sky,lit,a);
    // fog: thickest in the low ground and over the water, drifting
    if(uMist>0.001){float lowg=smoothstep(4.0,-0.6,wp.y)*a+(1.0-a);float drift=vns(wp.xz*0.08+vec2(uTime*0.03,uTime*0.012))*0.5+vns(wp.xz*0.21-uTime*0.02)*0.5;
      vec3 mc=mix(vec3(0.82,0.84,0.83),vec3(0.16,0.2,0.26),uDusk);col=mix(col,mc,clamp(uMist*(0.2+0.6*lowg)*(0.15+1.3*drift*drift),0.0,0.5));}
    col+=vec3(0.75,0.82,1.0)*uFlash;
    // bloom: glowing things bleed soft light around them
    col+=(texture2D(tBloomA,uv).rgb*0.7+texture2D(tBloomB,uv).rgb*1.1)*uBloom;
    col=aces(col*1.05);
    col=mix(col,col*vec3(0.78,0.86,1.12),uDusk*0.6);
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
  if(rt){rt.depthTexture?.dispose();rt.dispose();}
  rt=new THREE.WebGLRenderTarget(rw,rh,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
  rt.depthTexture=new THREE.DepthTexture(rw,rh);rt.depthTexture.type=THREE.UnsignedIntType;
  bloom.resize(rw,rh);
  postMat.uniforms.tScene.value=rt.texture;postMat.uniforms.tDepth.value=rt.depthTexture;
  postMat.uniforms.tBloomA.value=bloom.near;postMat.uniforms.tBloomB.value=bloom.far;postMat.uniforms.uRes.value.set(rw,rh);shadeU.uPx.value.set(2/rw,2/rh);
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
function paintAt(cx,cy){const p=groundAt(cx,cy);if(!p)return;
  if(tool.startsWith('e:')){const sn=snapAt(p,'e');if(drag.painted.has(sn.key))return;drag.painted.add(sn.key);actDeco(tool,sn,drag.painted.size>1);hover(cx,cy);return;}const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);if(!inGrid(i,j))return;const k=idx(i,j);
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
  else if(drag&&drag.moved<=6&&drag.btn===2&&started){setTool('look');$('drawer').hidden=true;closePlot();selected=null;selRing.visible=false;updateMarks();}
  if(!pointers.size)drag=null;});
canvas.addEventListener('pointerleave',()=>{ptrIn=false;tip.style.display='none';hoverLoop.visible=false;hovered=null;setPreview([]);updateCard();});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.z=clamp(view.z*Math.exp(e.deltaY*.0012),ZMIN,ZMAX);cancelAuto();},{passive:false});
function cancelAuto(){tween=null;if(cine.fish)endCine(false);}
function pan(dx,dy){const upp=view.z/innerHeight;const right=new THREE.Vector3(1,0,-1).normalize(),fwd=new THREE.Vector3(-1,0,-1).normalize();
  view.t.addScaledVector(right,-dx*upp).addScaledVector(fwd,dy*upp/Math.sin(EL));}
const keys=new Set();
addEventListener('keydown',e=>{if(e.key===' '&&reel.fish&&!(e.target.closest&&e.target.closest('input'))){e.preventDefault();if(!e.repeat)reelPress();return;}
  if(e.target.closest&&e.target.closest('button')&&e.key===' ')return;
  const k=e.key.toLowerCase();keys.add(k);
  if(k==='q'||k==='escape'){setTool('look');pinned=null;updateCard();}
  if(e.target.closest&&e.target.closest('input'))return;
  const T={'1':'clear','2':'dig','3':'hire','4':'hut','5':'road','6':'bridge','x':'remove'};if(T[k])setTool(T[k]);
  if(k==='r')rotateAt(plotK>=0?plotK:hoverK);
  if(k==='b')toggleDrawer();if(k==='t')toggleTrade();if(k==='`'||k==='f9')toggleDebug();
  if(k==='escape'){$('drawer').hidden=true;$('trade').hidden=true;closePlot();}
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
let hoverK=-1;
function rotateAt(k){if(k<0||!inGrid(k%GW,(k/GW)|0))return;const b=builds[k];if(b===NONE||b===ROAD||b===BRIDGE||b===B.PIER||b===B.JETTY||b===B.WEIR||b===B.REED||b===B.FENCE)return;
  S.meta[k]={...(S.meta[k]||{})};S.meta[k].rot=((S.meta[k].rot??-1)+1)%4;village.sync();sfx('pluck');save();}
function hover(cx,cy){
  lastPtr={x:cx,y:cy};ptrIn=true;
  {ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);const gi=giants.pick(ray);
    if(gi){hoverLoop.visible=false;canvas.style.cursor='pointer';tip.innerHTML=`<div>${GIANTS[gi.kind].name}</div><div class="dim">Click to greet it</div>`;tip.style.display='block';tip.style.left=Math.min(cx,innerWidth-250)+'px';tip.style.top=Math.min(cy,innerHeight-80)+'px';return;}}
  const p=groundAt(cx,cy);if(!p){hoverLoop.visible=false;tip.style.display='none';return;}
  const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);
  hovered=cine.fish?null:pickFish(cx,cy);canvas.style.cursor=hovered?'pointer':'crosshair';
  let html='';
  if(!inGrid(i,j)||tiles[idx(i,j)]===RIM){hoverLoop.visible=false;setPreview([]);}
  else{const c=tileC(i,j),k=idx(i,j),t=tiles[k],b=builds[k];hoverLoop.visible=true;hoverK=k;
    hoverLoop.position.set(c.x,(t===WATER?(b===BRIDGE?DECK_Y:WATER_Y):heightAt(c.x,c.z))+.03,c.z);
    const useTool=selected?'move':tool;decoMark.visible=false;
    if(useTool.startsWith('c:')||useTool.startsWith('e:')){hoverLoop.visible=false;setPreview([]);const sn=snapAt(p,useTool[0]),r=canDeco(useTool,sn);showDeco(sn,r.ok&&(!r.cost||afford(r.cost)));
      const nm=useTool[0]==='c'?CORNER[useTool.slice(2)].name:EDGE[useTool.slice(2)].name;
      html=`<div>${r.remove?'Remove '+nm.toLowerCase():nm}${r.ok&&r.cost?' · '+costHTML(r.cost):''}</div>`+(r.ok?`<div class="dim">${useTool[0]==='c'?'Snaps to the corner where tiles meet':'Snaps to the edge between tiles · drag to draw a line'}</div>`:`<div class="bad">${r.why}</div>`);}
    else if(useTool!=='look'){const r=canDo(useTool,i,j),cur=COST[useTool]||'scales';
      const cobj=r.cost||r.refund||(r.c?{[cur]:r.c}:null);
      hoverLoop.material.color.set(r.ok&&(!cobj||r.refund||afford(cobj))?(useTool==='remove'?'#e9a07a':'#ffe6b0'):'#e98a5f');
      const names={clear:'Clear land',dig:r.restore?'Restore the old channel':'Dig a new channel',hire:'Hire fisher',move:'Move fisher here',hut:r.restyle?`Restyle as ${STYLES[S.hutStyle].name.toLowerCase()}`:`Build a ${STYLES[S.hutStyle].name.toLowerCase()} hut`,road:r.lift?'Lift this road':'Lay road',bridge:'Build a bridge',pave:`Pave with ${PAVES[S.pave].name.toLowerCase()}`,remove:'Remove',scout:'Send a crow'};
      const nm=useTool.startsWith('b:')?(useTool==='b:statue'?`Statue of the ${SP[S.statueSp]?.name||'…'}`:DEFS[useTool.slice(2)].name):names[useTool];
      html=`<div>${nm}${r.ok&&cobj&&Object.keys(cobj).length?` · ${r.refund?'<span class="dim">gives back</span> ':''}${costHTML(cobj)}`:''}</div>`+(r.ok?'':`<div class="bad">${r.why}</div>`);
      if(useTool==='dig'&&r.ok)html+=`<div class="dim">Water only lives if the current runs through it</div>`;
      if(useTool==='clear'&&r.ok)html+=`<div class="dim">+${3+(has('garrow')?3:0)} timber</div>`;
      const pv=r.ok?previewFor(useTool,i,j):null;setPreview(pv?pv.marks:[]);if(pv?.sum)html+=`<div class="pvs">${pv.sum}</div>`;}
    else if(busy.has(k)){const jb=busy.get(k);hoverLoop.material.color.set('#ffe6b0');setPreview([]);html=`<div>${jb.tool==='clear'?'Clearing':jb.tool==='dig'?'Digging':jb.tool==='upgrade'?'Upgrading':'Building'} · ${Math.floor(jb.prog*100)}%</div><div class="${jb.blocked?'bad':'dim'}">${jb.blocked?'No dry way there: needs a bridge or pier':jb.crew.length?jb.crew.length+' at work':'Waiting for free hands'} · click for details</div>`;}
    else{hoverLoop.material.color.set('#ffe6b0');setPreview([]);const d=DEF_BY_CODE[b];
      if(b===HUT){const lk=linkedHuts().some(h=>h.k===k),vn=S.hutVillage[k],v=villages.find(v=>v.name===vn),st=STYLES[S.meta[k]?.style||'thatch'].name;
        html=`<div>${vn?`A ${st.toLowerCase()} hut in ${vn}`:`A ${st.toLowerCase()} hut`} · houses ${HOUSING} fishers</div><div class="${lk?'dim':'bad'}">${lk?'On the Pilgrim Way':'Not joined to the Pilgrim Way by road'}</div>`+
        (v?`<div class="dim">Charm ${villageCharm(v).toFixed(1)}${v.harmony?' · in harmony':''}</div>`:'');}
      else if(d&&b!==BRIDGE&&b!==ROAD){html=`<div>${d.name}${b===B.STATUE?' · '+(SP[S.meta[k]?.sp]?.name||''):''}</div>`;
        const p=producers.find(p=>p.k===k);
        if(p)html+=`<div class="dim">${p.good==='craft'?`${p.rate.toFixed(1)} crafts / min`:`${p.rate.toFixed(1)} ${GOODS[p.good].name.toLowerCase()} / min`}</div>`;
        if(b===B.STATUE)html+=`<div class="dim">Nearby, ${STATUE_FX[S.meta[k]?.sp]?.txt||''}</div>`;
        else if(b===B.TALEHALL){const on=linkedOf(B.TALEHALL).some(h=>h.k===k),T=allTales(),nx=[6,12,18,24].find(n=>n>T);
          html+=`<div class="dim">${T} tale${T===1?'':'s'} told · each pilgrim leaves ~${fmt(taleGift(k))} silver</div>`+(nx?`<div class="dim">Grows again at ${nx} tales</div>`:'')+(on?'':'<div class="bad">Join it to the Pilgrim Way by road so pilgrims can find it</div>');}
        else if(b===B.MARKET)html+=`<div class="dim">Prices ×${marketMult(k).toFixed(2)} · charm ${charm[k].toFixed(1)}</div>`;
        else if(b===B.POST||b===B.JETTY){const v=trade.vehicles.find(v=>v.home===k);if(v)html+=`<div class="${v.state==='stuck'?'bad':'dim'}">${vehicleLine(v)}</div>`;}
        else if(!p)html+=`<div class="dim">${d.desc}</div>`;}
      else if(t===WATER){const sp=FLOW.speed[k];
        if(!FLOW.live[k])html=`<div>Backwater</div><div class="dim">The current doesn’t reach here, so no fish, but frogs, dragonflies and herons live in it. Reeds grow well. Counts toward valley health.</div>`;
        else{const cp=comps[COMP[k]];html=`<div>${b===BRIDGE?'Bridge over ':''}Flowing water · <span class="c">${cp.size}</span> tiles</div><div class="dim">Current ${sp>1.1?'quick':sp>.5?'steady':'gentle'} · open water up to ${cp.maxD*2-1} wide</div>`;}
        if(fishersOn(i,j).length)html+=`<div class="dim">${fishersOn(i,j).length} fisher${fishersOn(i,j).length>1?'s':''} here · click to move one</div>`;}
      else if(fishersOn(i,j).length)html=`<div>${fishersOn(i,j).length} fisher${fishersOn(i,j).length>1?'s':''}</div><div class="dim">Click to move one</div>`;
      else if(b===ROAD)html=`<div>${i===WAY_I&&j===0?'The Pilgrim Way':PAVES[S.meta[k]?.pave||'dirt'].name+' road'}</div>`;
      else if(t===WILD&&hintVis.has(k))html=`<div>Forest</div><div class="gold">${SECRET_TYPES[secretAt[k].type].hintTxt}</div><div class="dim">Send a crow to look (Build → Work & trade), or clear it</div>`;
      else if(oldCh[k]&&t!==WATER)html=`<div>The old river bed</div><div class="dim">The river ran here once. Dig it out to bring it back: cheaper than a new channel, and it heals the valley.</div>`;
      else if(t===WILD&&deposit[k])html=`<div>Forest</div><div class="gold">${SECRET_TYPES.clay.hintTxt}</div>`;
      if(charm[k]>0&&t===LAND&&html)html+=`<div class="dim">Charm ${charm[k].toFixed(1)}</div>`;
      if(plottable(k)&&html&&!fishersOn(i,j).length)html+=`<div class="dim">Click to upgrade or decorate</div>`;}
  }
  if(hovered||pinned){tip.style.display='none';updateCard();return;}
  card.hidden=true;
  if(html){tip.innerHTML=html;tip.style.display='block';tip.style.left=Math.min(cx,innerWidth-250)+'px';tip.style.top=Math.min(cy,innerHeight-80)+'px';}else tip.style.display='none';
}
function click(cx,cy){
  {ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);const gi=giants.pick(ray);if(gi){giantGift(gi);return;}}
  if(pinned){pinned=null;updateCard();if(tool==='look'&&!selected)return;}
  if(tool==='look'&&!selected){const f=pickFish(cx,cy);if(f){pinned=f;updateCard();return;}}
  const p=groundAt(cx,cy);if(!p)return;const i=Math.floor(p.x+HX),j=Math.floor(p.z+HZ);
  if(selected){const r=canDo('move',i,j);
    if(r.ok&&!(selected.i===i&&selected.j===j)){selected.i=i;selected.j=j;selected.slot=freeSlot(i,j);placeFisher(selected);sparkle(selected.x,.3,selected.z,'#ffe9bf');save();}
    else if(!r.ok)log(r.why+'.','warn');
    selected=null;selRing.visible=false;updateMarks();return;}
  if(tool==='look'){if(!inGrid(i,j)){closePlot();return;}const on=fishersOn(i,j).filter(f=>f.state==='idle');
    if(on.length){closePlot();selected=on[on.length-1];selRing.visible=true;updateMarks();log('Pick a spot at the water’s edge, or a bridge, for this fisher.');return;}
    const k=idx(i,j);if(plottable(k)||busy.has(k))openPlot(k);else closePlot();return;}
  if(tool.startsWith('c:')||tool.startsWith('e:')){actDeco(tool,snapAt(p,tool[0]));hover(cx,cy);return;}
  act(tool,i,j);hover(cx,cy);
}
function setTool(t){tool=t;decoMark.visible=false;selected=null;selRing.visible=false;setPreview([]);tip.style.display='none';
  document.querySelectorAll('.tool').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t||(b.dataset.tool==='build'&&(t.startsWith('b:')||t==='pave'||t==='scout')))));
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
  updateTileBars();
  // village names float over their huts
  for(const v of villages){let el=villageLbl.get(v.name);if(!el){el=document.createElement('div');el.className='vlbl';el.textContent=v.name;labelsEl.appendChild(el);villageLbl.set(v.name,el);}
    const p=toScreen(v.cx,.9,v.cz);el.style.left=p.x+'px';el.style.top=p.y+'px';}
  for(const [n,el] of villageLbl)if(!villages.some(v=>v.name===n)){el.remove();villageLbl.delete(n);}
}
const villageLbl=new Map();
/* ---- work on the map: queued tiles are marked on the ground, and each patch of work gets one small ring ---- */
// The ground mark: a dithered wash over every tile in the queue, with a soft stroke round the edge of each patch.
// Cream: waiting for hands. Mint: being worked (the wash thickens as the work goes on). Ember: nobody can get there.
const JD_MAX=4000,jdInfo=new Float32Array(JD_MAX*4);
const jdGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);jdGeo.setAttribute('aInfo',new THREE.InstancedBufferAttribute(jdInfo,4));
const jdMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{uTime:{value:0}},
  vertexShader:`attribute vec4 aInfo;varying vec4 vI;varying vec2 vUv;void main(){vI=aInfo;vUv=uv;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform float uTime;varying vec4 vI;varying vec2 vUv;
    float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}float bayer(vec2 a){return b2(.5*a)*.25+b2(a);}
    void main(){
      int st=int(vI.x+.5);float e=vI.y,pr=vI.z;
      vec3 col=st==1?vec3(.18,1.,.62):st==2?vec3(1.,.22,.08):vec3(1.,.72,.38);
      // distance to the sides of this tile that face outside the patch (bits: 1 -x, 2 +x, 4 -z, 8 +z)
      float d=9.;
      if(mod(e,2.)>=1.)d=min(d,vUv.x);if(mod(floor(e/2.),2.)>=1.)d=min(d,1.-vUv.x);
      if(mod(floor(e/4.),2.)>=1.)d=min(d,1.-vUv.y);if(mod(floor(e/8.),2.)>=1.)d=min(d,vUv.y);
      float line=1.-smoothstep(.05,.11,d);
      float dens=(st==1?.08+.3*pr:st==2?.14:.07)*(.85+.15*sin(uTime*2.2+vI.w));
      bool fill=bayer(gl_FragCoord.xy)<dens;
      if(line<.05&&!fill)discard;
      gl_FragColor=vec4(col,max(line*.95,fill?.45:0.));}`});
const jobDecal=new THREE.InstancedMesh(jdGeo,jdMat,JD_MAX);jobDecal.count=0;jobDecal.renderOrder=6;jobDecal.frustumCulled=false;scene.add(jobDecal);
let jdKey='';
function updateJobDecals(groups){
  const st=new Map();for(const g of groups)for(const k of g.tiles)st.set(k,{s:g.state,p:g.prog});
  let n=0;const m=new THREE.Matrix4();
  for(const [k,v] of st){if(n>=JD_MAX)break;const i=k%GW,j=(k/GW)|0,c=tileC(i,j);
    let e=0;[[-1,0,1],[1,0,2],[0,-1,4],[0,1,8]].forEach(([a,b,bit])=>{const o=st.get(inGrid(i+a,j+b)?idx(i+a,j+b):-1);if(!o||o.s!==v.s)e|=bit;});
    m.makeTranslation(c.x,Math.max(heightAt(c.x,c.z),WATER_Y)+.04,c.z);jobDecal.setMatrixAt(n,m);
    jdInfo[n*4]=v.s;jdInfo[n*4+1]=e;jdInfo[n*4+2]=v.p;jdInfo[n*4+3]=(i*1.7+j*2.3)%6.28;n++;}
  jobDecal.count=n;jobDecal.instanceMatrix.needsUpdate=true;jdGeo.attributes.aInfo.needsUpdate=true;
}
// The ring: a small dithered progress circle with the job's icon in it, and a count when the patch is more than one tile.
const tileBars=new Map();let ringId=0;
const JOB_VERB={clear:'Clearing',dig:'Digging',upgrade:'Upgrading',weir:'Taking down the weir',bridge:'Building a bridge',hut:'Building a hut',road:'Laying road'};
const JOB_ICON={clear:'clear',dig:'dig',upgrade:'build',weir:'build',bridge:'bridge',hut:'hut',road:'road'};
function ringEl(key,ic){let el=tileBars.get(key);if(!el){el=document.createElement('div');el.className='tring';const pid='dth'+(++ringId);
    el.innerHTML=`<svg viewBox="0 0 26 26" shape-rendering="crispEdges"><defs><pattern id="${pid}" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="currentColor"/><rect x="1" y="1" width="1" height="1" fill="currentColor"/></pattern></defs><circle class="bg" cx="13" cy="13" r="12"/><circle class="rt" cx="13" cy="13" r="9.5" stroke="url(#${pid})"/><circle class="rp" cx="13" cy="13" r="9.5" pathLength="100" transform="rotate(-90 13 13)"/></svg><span class="ti"></span><b class="tn"></b>`;
    labelsEl.appendChild(el);tileBars.set(key,el);}
  if(el.dataset.ic!==ic){el.querySelector('.ti').innerHTML=icon(ic);el.dataset.ic=ic;}return el;}
function placeRing(el,k){const c=tileC(k%GW,(k/GW)|0),p=toScreen(c.x,Math.max(heightAt(c.x,c.z),0)+.55,c.z);el.style.left=p.x+'px';el.style.top=p.y+'px';}
function setRing(el,prog,cls,count,tip){el.querySelector('.rp').style.strokeDasharray=`${Math.max(0,Math.min(100,prog*100)).toFixed(1)} 100`;
  el.className='tring '+cls+(view.z>60?' far':'');const t=el.querySelector('.tn');t.textContent=count>1?count:'';t.hidden=count<2;el.title=tip;}
function updateTileBars(){
  const want=new Set();if(!started||cine.fish){for(const [,el] of tileBars)el.remove();tileBars.clear();jobDecal.count=0;return;}
  jdMat.uniforms.uTime.value=U.time.value;
  // patches: neighbouring jobs of the same kind in the same state
  const stOf=jb=>jb.blocked?2:jb.crew.length?1:0,byK=new Map(jobs.map(jb=>[jb.k,jb])),seen=new Set(),groups=[];
  for(const jb of jobs){if(seen.has(jb.k))continue;const s0=stOf(jb),grp=[],q=[jb.k];seen.add(jb.k);
    while(q.length){const k=q.pop();grp.push(k);const i=k%GW,j=(k/GW)|0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){if(!inGrid(i+a,j+b))continue;const nk=idx(i+a,j+b),o=byK.get(nk);if(o&&!seen.has(nk)&&o.tool===jb.tool&&stOf(o)===s0){seen.add(nk);q.push(nk);}}}
    let ci=0,cj=0,pr=0;grp.forEach(k=>{ci+=k%GW;cj+=(k/GW)|0;pr+=byK.get(k).prog;});ci/=grp.length;cj/=grp.length;
    const lead=grp.reduce((a,k)=>Math.hypot(k%GW-ci,((k/GW)|0)-cj)<Math.hypot(a%GW-ci,((a/GW)|0)-cj)?k:a,grp[0]);
    groups.push({tiles:grp,lead,state:s0,prog:pr/grp.length,tool:jb.tool});}
  updateJobDecals(groups);
  for(const g of groups){const key='j'+g.lead;want.add(key);const el=ringEl(key,JOB_ICON[g.tool]||'build');placeRing(el,g.lead);
    const nm=JOB_VERB[g.tool]||(g.tool.startsWith('b:')?`Building ${DEFS[g.tool.slice(2)]?.name.toLowerCase()||''}`:'Working'),n=g.tiles.length;
    setRing(el,g.state===1?g.prog:g.state===2?1:0,['wait','work','bad'][g.state],n,
      g.state===2?`No way there yet${n>1?` (${n} tiles)`:''}: workers can't reach ${n>1?'these tiles':'this tile'}`:g.state===0?`${nm}: waiting for hands${n>1?` (${n} tiles)`:''}`:`${nm} · ${Math.floor(g.prog*100)}%${n>1?` (${n} tiles)`:''}`);}
  // workshops, when you are close: a ring at the bench
  if(view.z<42)for(const p of producers){if(p.good!=='craft')continue;const key='w'+p.k;want.add(key);const el=ringEl(key,'carvings');placeRing(el,p.k);
    const g=shopProg.get(p.k)||0;setRing(el,p.stall?1:Math.min(1,g),p.stall?'bad soft':'craft soft',1,p.stall?`Needs ${p.stall}`:`Crafting ${p.making?GOODS[p.making].name.toLowerCase():''}`.trim());}
  for(const [key,el] of tileBars)if(!want.has(key)){el.remove();tileBars.delete(key);}
}

/* ---- lend a hand: the reeling ring beside a hooked fish ---- */
const reel=makeReel($('dv'));
function updateReel(dt){
  if(reel.fish&&(reel.fish.state!=='hooked'||!fishes.includes(reel.fish)))reel.detach();
  if(!started){reel.detach();return;}
  if(!reel.fish&&started){let best=null,bd=1e9;for(const f of fishes){if(f.state!=='hooked')continue;const h=fishHead(f),p=toScreen(h.x,.4,h.z);
      if(p.x<0||p.y<0||p.x>innerWidth||p.y>innerHeight)continue;const d=Math.hypot(p.x-innerWidth/2,p.y-innerHeight/2);if(d<bd){bd=d;best=f;}}
    if(best){reel.attach(best,2.4+best.sp.fight*.013);
      if(!S.reelSeen){S.reelSeen=true;log('A fish is on the line. Lend a hand: press Space, or click the ring, when the light crosses the mint arc. When the ring flashes amber the fish is about to surge: once it turns ember, let it run.','gold');}}}
  if(reel.fish){const h=fishHead(reel.fish),p=toScreen(h.x,.4,h.z);reel.update(dt,p.x,p.y+64,reel.fish.surge>0,!(reel.fish.surge>0)&&(reel.fish.surgeT??9)<1.1);}
  // the tension tone: only once you've lent a hand, rising as the fish tires and the run heats up
  if(reel.fish&&reel.engaged)reelTension(clamp(reel.fish.progress||0,0,1),reel.heat);else reelTension(null);
}
// a pull from the bank: the crew gains on the fish, perfect pulls count toward the release
function reelPress(){const f=reel.fish;if(!f)return;const q=reel.press();if(!q)return;const h=fishHead(f);
  if(q==='perfect'||q==='good'){const gain=(q==='perfect'?.075:.04)*(1+.08*Math.min(reel.combo,6));f.progress=Math.min(.995,f.progress+gain);f.help=(f.help||0)+(q==='perfect'?2:1);
    for(let n=0;n<(q==='perfect'?10:5);n++)sparkle(h.x+rand(-.3,.3),WATER_Y+rand(.05,.4),h.z+rand(-.3,.3),q==='perfect'?'#ffe9a0':'#bff5df');
    sfx(q==='perfect'?'combo-perfect':'combo',reel.combo);
    // a big perfect pull jolts the view a little, more the hotter the run
    if(q==='perfect'&&reel.combo>=4){const v=$('view');v.style.setProperty('--jolt',(1+Math.min(reel.combo,10)*.25).toFixed(2)+'px');v.classList.remove('jolt');void v.offsetWidth;v.classList.add('jolt');}}
  else if(q==='slack'){for(const fs of f.hookers)fs.strain=(fs.strain||0)+.28;sfx('no');}
  else{const b=reel.takeBroken();sfx(b>=3?'combo-break':'no',b);}}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.reel'))reelPress();});
function incomeRate(){const now=Date.now();S.income=S.income.filter(([t])=>now-t<15*60e3);if(!S.income.length)return 0;
  const span=Math.max(120e3,now-S.income[0][0]);return S.income.reduce((s,[,v])=>s+v,0)/(span/60e3);}
function nextGoalTitle(){const sp=SPECIES.find(s=>!S.codex[s.id]);return !sp?'The whole river':sp.crew<=2?'Meet the '+sp.name:'Something larger';}
function nextGoal(){
  const sp=SPECIES.find(s=>!S.codex[s.id]);if(!sp)return 'Every fish of the valley has been met. Keep listening: there are tales still untold.';
  const best=comps.reduce((a,c)=>c.size>a.size?c:a,{size:0,maxD:0});const parts=[];
  if(fishersState.length<sp.crew)parts.push(housing()<sp.crew?`<b>${sp.crew} fishers</b> (and huts to house them)`:`<b>${sp.crew} fishers</b>`);
  if(best.size<sp.minWater)parts.push(`<b>${sp.minWater} tiles</b> of flowing water`);
  if(best.maxD<sp.needD)parts.push(`open water <b>${sp.needD*2-1} tiles wide</b>`);
  if(health<(sp.minHealth||0))parts.push(`a valley health of <b>${sp.minHealth}</b>`);
  const nm=sp.crew<=2?sp.name:'Something larger';
  let g=!parts.length?`${nm} can surface now. Keep <b>${sp.crew}</b> fisher${sp.crew>1?'s':''} together on one bank and wait.`:`${nm} needs ${parts.join(', ')}.`;
  if(stillCount>0)g+=`<div class="still">${stillCount} tile${stillCount>1?'s':''} of backwater: no fish, but frogs, herons and reeds.</div>`;
  return g;
}
let lastGoal='';
function refreshUI(){
  $('scales').textContent=fmt(S.scales);$('silver').textContent=fmt(S.silver);
  const r=incomeRate(),sr=silverIncomeRate(),lh=linkedHuts().length;
  $('rate').textContent=`${r>0?`~${r<10?r.toFixed(1):fmt(r)} scales / min`:'No fish met yet'} · ${sr>0?`~${sr<10?sr.toFixed(1):fmt(sr)} silver / min from trade`:'no trade yet'}`;
  $('housing').textContent=`${fishersState.length} / ${housing()} fishers housed · ${hutCount()} hut${hutCount()>1?'s':''}${lh<hutCount()?` (${lh} on the Way)`:''}`;
  const cal=calendar();$('calY').textContent='Year '+cal.year;$('calS').textContent=cal.season;$('calD').textContent=cal.dom;$('calP').textContent=cal.phase;
  $('stSub').textContent=(villages[0]?villages[0].name:'A valley on the Pilgrim Way')+' · '+(night>.3?'night':cal.phase.toLowerCase())+(S.weather&&S.weather.k!=='clear'?' · '+WEATHER[S.weather.k]:'');
  $('talesN').textContent=String(allTales()).padStart(2,'0');
  {const lk=allTales()+'|'+SPECIES.filter(s=>S.codex[s.id]).length;if(lk!==loreKey){const grew=loreKey&&TALE_STAGES.some(n=>allTales()>=n&&+loreKey.split('|')[0]<n);loreKey=lk;village.sync();
    if(grew&&booted)log('The Tale House grows: there are more tales to tell than it had room for.','gold');}}
  const busyW=workers.filter(w=>w.job).length,waiting=jobs.filter(j=>!j.crew.length).length;
  $('builders').innerHTML=barRow('builders','Builders',`${busyW}/${builderCount()}${waiting?` · ${waiting} waiting`:''}`,builderCount()?busyW/builderCount():0,'#c9a36a');
  $('health').innerHTML=barRow('health','Valley health',health+' / 100',health/100,'#9fd68a');$('health').title=`River restored ${healthParts.river.toFixed(0)}/35 · forest kept ${healthParts.forest.toFixed(0)}/30 · backwaters ${healthParts.wetland.toFixed(0)}/20 · weir ${healthParts.weir}/15. The Moonscale needs 50, the Warden 70.`;
  $('goods').innerHTML=GOOD_IDS.map(g=>{const rt=goodRate(g);return `<span class="gd" title="${GOODS[g].name}${rt?` · +${rt.toFixed(1)} / min`:''}" style="--gc:${GOODS[g].col}">${icon(g)}<b>${fmt(S.goods[g]||0)}</b><em>${GOODS[g].name.toLowerCase()}</em></span>`;}).join('');
  const tl=tideWindow()-(Date.now()-S.tide.t),tOn=S.tide.n>0&&tl>0;$('tide').innerHTML=barRow('tide','Good tide',tOn?'×'+(1+TIDE_STEP*S.tide.n).toFixed(2):'—',tOn?tl/tideWindow():0,'#8fdcc0');
  renderOrdersGoal();
  const g=nextGoal();if(g!==lastGoal){$('goal').innerHTML=`<div class="gl"><span class="gi">${icon('fish')}</span><div class="gt"><b>${nextGoalTitle()}</b><span>${g}</span></div></div>`;lastGoal=g;}
  for(const t of ['clear','dig','hire','hut','road','bridge']){const c=cost[t]();$('c-'+t).textContent=fmt(c);$('tool-'+t).classList.toggle('poor',S[COST[t]]<c);}
  $('cLine').textContent=fmt(cost.line());$('cBait').textContent=fmt(cost.bait());$('lvLine').textContent='Lv '+S.lineLv;$('lvBait').textContent='Lv '+S.baitLv;
  $('upLine').disabled=S.silver<cost.line();$('upBait').disabled=S.silver<cost.bait();
  {const met=SPECIES.filter(s=>S.codex[s.id]).length;$('codexCount').textContent=`${met}/${SPECIES.length}`;$('btnCodex').title=`Codex · ${met} of ${SPECIES.length} fish met`;$('codexDot').hidden=met<=(S.codexSeen||0);}
  const busy=trade.vehicles.filter(v=>v.state!=='load'&&v.state!=='stuck').length;$('tradeN').textContent=`${busy}/${trade.vehicles.length}`;
  if(!$('trade').hidden)renderTrade();
  if(!$('drawer').hidden)updateDrawerCosts();
}
function barRow(ic,label,val,frac,col){return `<span class="bi" style="color:${col}">${icon(ic)}</span><span class="bl">${label}</span><span class="bv">${val}</span><span class="bt"><i style="width:${(clamp(frac,0,1)*100).toFixed(0)}%;background:${col}"></i></span>`;}
// the one next step that stands between the player and an order
function orderHint(o){const g=o.good,nm=GOODS[g].name.toLowerCase();
  if(o.route==='north'&&!builds.includes(B.POST))return 'Build a trading post beside a road: it keeps the wagon (Build → Work & trade).';
  if(o.route==='east'&&!builds.includes(B.JETTY))return 'Build a jetty on flowing water: it keeps the barge (Build → Work & trade).';
  if(!GOODS[g].raw){if(!builds.includes(B.SHOP))return `${GOODS[g].name} are made in a workshop by a road (Build → Work & trade).`;
    if((S.goods[g]||0)<1&&!canMake(g))return `The workshop needs ${recipeTxt(g)} for each one.`;}
  else{const code={timber:B.WOOD,reeds:B.REED,clay:B.CLAY}[g];
    if(!builds.includes(code)&&(S.goods[g]||0)<o.qty-o.got)return {timber:'A woodcutter at the forest’s edge makes timber.',reeds:'Reed beds grow reeds. Build one on still water (a pond or a dead-end channel).',clay:'A clay pit on the riverbank digs clay.'}[g];}
  if(S.ship?.[g]===false)return `Sending ${nm} is switched off in Trade.`;
  return '';}
function renderOrdersGoal(){const os=(S.orders||[]).slice(0,2);const h=os.map(o=>{const hint=orderHint(o);return `<div class="gl"><span class="gi">${icon('order')}</span><div class="gt"><b>${o.regionName}</b><span>Send ${o.qty} ${GOODS[o.good].name.toLowerCase()} by ${o.route==='north'?'wagon':'barge'}</span>${hint?`<span class="still">${hint}</span>`:''}</div><span class="gn">${o.got}/${o.qty}</span></div>`;}).join('');if($('goalOrders').innerHTML!==h)$('goalOrders').innerHTML=h;}
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
  if(drawerTab==='work')it.push({tool:'scout',key:'scout',name:'Send a crow',desc:'Scouts a spot with a sign above the trees and finds what is there, without cutting the forest.',cost:{silver:10}});
  if(drawerTab==='decor'){for(const [id,c] of Object.entries(CORNER))it.push({tool:'c:'+id,key:'c'+id,name:c.name,desc:c.lock&&!unlocked(c.lock)?'Needs a blueprint.':`Goes on a corner where tiles meet. +${c.charm} charm to the tiles around it.`,lock:!!(c.lock&&!unlocked(c.lock)),cost:c.cost});
    for(const [id,e] of Object.entries(EDGE))it.push({tool:'e:'+id,key:'e'+id,name:e.name,desc:`Goes on the edge between two tiles. Drag to draw a line. +${e.charm} charm to both tiles.`,cost:e.cost,paint:true});}
  for(const [id,d] of Object.entries(DEFS)){if(d.cat!==drawerTab||id==='lantern'||id==='fence')continue;
    if(id==='statue'){const met=SPECIES.filter(s=>S.codex[s.id]);
      if(!met.length)it.push({tool:'b:statue',key:'statue',name:'Fish statue',desc:'Meet a fish first. Statues are carved after fish you have met.',lock:true});
      for(const sp of met)it.push({tool:'b:statue',key:'statue:'+sp.id,name:`${sp.name} statue`,desc:`Nearby, ${STATUE_FX[sp.id].txt}. +4 charm.`,cost:buildCost('statue'),on:()=>{S.statueSp=sp.id;},sel:()=>tool==='b:statue'&&S.statueSp===sp.id});
      continue;}
    it.push({tool:'b:'+id,key:id,name:d.name,desc:defLocked(id)?'Needs a blueprint. Crates and forest finds bring them.':d.desc,lock:defLocked(id),cost:buildCost(id),paint:d.paint});}
  return it;
}
function renderDrawer(){
  const d=$('drawer');if(d.hidden)return;
  $('drawerTabs').innerHTML=[...CATS,{id:'sets',name:`Named places ${(S.setsSeen||[]).length}/${SETS.length}`}].map(c=>`<button type="button" class="nav tab" data-tab="${c.id}" aria-pressed="${c.id===drawerTab}">${c.name}</button>`).join('');
  d.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{drawerTab=b.dataset.tab;renderDrawer();}));
  const box=$('drawerItems');const items=drawerItems();
  if(!items){box.innerHTML=SETS.map(s=>{const seen=(S.setsSeen||[]).includes(s.id);return `<div class="set ${seen?'seen':''} ${activeSets[s.id]?'on':''}"><div class="sn">${seen?s.name:'Unnamed place'}</div><div class="sd">${s.hint}</div><div class="sb">${s.bonus}${seen&&!activeSets[s.id]?' <span class="dim">(not standing right now)</span>':''}</div></div>`;}).join('');return;}
  box.innerHTML='';drawerItemsCache=items;
  items.forEach((x,n)=>{const b=document.createElement('button');b.type='button';b.className='item'+(x.lock?' locked':'');b.dataset.tool=x.tool;b.dataset.n=n;
    b.setAttribute('aria-pressed',String(x.sel?x.sel():tool===x.tool));
    const art=bicons.html(x.key,iconSet);if(art)b.classList.add('has-art');
    b.innerHTML=`${art}<div class="in">${x.swatch&&!art?`<i class="sw" style="background:${x.swatch}"></i>`:''}${x.name}${x.lock?' <span class="lk">locked</span>':''}${x.paint?' <span class="pt">drag</span>':''}</div><div class="ic">${x.cost?costHTML(x.cost):''}</div><div class="id">${x.desc}</div>`;
    b.addEventListener('click',()=>{if(x.lock){sfx('no');return;}x.on&&x.on();setTool(x.tool);renderDrawer();});box.appendChild(b);});
}
let drawerItemsCache=[];
function updateDrawerCosts(){$('drawerItems').querySelectorAll('.item').forEach(b=>{const x=drawerItemsCache[+b.dataset.n];if(x?.cost){const c=x.tool.startsWith('b:')?buildCost(x.tool.slice(2)):x.cost;const h=costHTML(c);const ic=b.querySelector('.ic');if(ic.innerHTML!==h)ic.innerHTML=h;}});}

/* ---- the trade ledger ---- */
function toggleTrade(){const d=$('trade');d.hidden=!d.hidden;if(!d.hidden){$('drawer').hidden=true;renderTrade();}}
function renderTrade(){
  const g=GOOD_IDS.map(id=>`<tr><td><i class="sw" style="background:${GOODS[id].col}"></i>${GOODS[id].name}</td><td class="n">${fmt(S.goods[id]||0)}</td><td class="n dim">${goodRate(id)?'+'+goodRate(id).toFixed(1)+'/min':''}</td>
    <td class="n dim">${price(id,'wagon').toFixed(0)} · ${price(id,'barge').toFixed(0)}</td><td class="rs">${GOODS[id].raw?`<button type="button" data-g="${id}" data-d="-2">−</button><span>${S.reserve[id]}</span><button type="button" data-g="${id}" data-d="2">+</button>`:''}</td>
    <td><button type="button" class="snd" data-s="${id}" aria-pressed="${S.ship[id]!==false}">${S.ship[id]!==false?'Send':'Hold'}</button></td></tr>`).join('');
  const vs=trade.vehicles.length?trade.vehicles.map((v,n)=>`<li class="${v.state==='stuck'?'bad':''}">${vehicleLine(v)}${v.state==='load'&&(v.ready||0)>0?` <button type="button" class="chip snow" data-v="${n}">Send now</button>`:''}</li>`).join(''):'<li class="dim">No trading posts or jetties yet. Build them from Build → Work & trade.</li>';
  const os=(S.orders||[]).map(o=>`<li><div><b>${o.regionName}</b> wants <b>${o.qty} ${GOODS[o.good].name.toLowerCase()}</b> <span class="dim">by ${o.route==='north'?'wagon':'barge'}</span></div><div class="ob"><i style="width:${(o.got/o.qty*100).toFixed(0)}%"></i></div><div class="dim">${o.got}/${o.qty} · pays +${fmt(o.reward)} silver and a crate</div></li>`).join('');
  $('tradeBody').innerHTML=`<table><thead><tr><th>Goods</th><th class="n">Stock</th><th class="n">Made</th><th class="n">Wagon · barge</th><th>Keep back</th><th></th></tr></thead><tbody>${g}</tbody></table>
    <p class="dim small">Wagons and barges load what open orders on their route are waiting for first, then the most valuable goods. They take only what is above the keep-back amount, and nothing that is on Hold. Workshops can use the kept-back goods.</p>
    <h4>Wagons &amp; barges</h4><ul class="vs">${vs}</ul><h4>Orders from along the river</h4><ul class="os">${os}</ul>`;
  $('tradeBody').querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.s;S.ship[g]=S.ship[g]===false;renderTrade();renderOrdersGoal();save();}));
  $('tradeBody').querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click',()=>{const v=trade.vehicles[+b.dataset.v];if(v&&trade.sendNow(v)){sfx('pluck');refreshUI();}renderTrade();}));
  $('tradeBody').querySelectorAll('.rs button').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.g;S.reserve[g]=clamp(S.reserve[g]+ +b.dataset.d,0,200);renderTrade();save();}));
}
$('upLine').title='Crews bring fish in 30% faster per level';$('upBait').title='Rice and song left at the water: fish arrive and take the line 25% more often per level';
$('upLine').addEventListener('click',()=>{if(spend(cost.line(),'silver')){S.lineLv++;log(`Braided lines, level ${S.lineLv}. Crews bring fish in faster.`);refreshUI();save();}});
$('upBait').addEventListener('click',()=>{if(spend(cost.bait(),'silver')){S.baitLv++;log(`Offerings, level ${S.baitLv}. Fish come to the banks more often.`);refreshUI();save();}});
function toggleCodex(){const c=$('codex');c.hidden=!c.hidden;if(!c.hidden){renderCodex();S.codexSeen=SPECIES.filter(s=>S.codex[s.id]).length;refreshUI();}}
$('btnCodex').addEventListener('click',toggleCodex);$('codexClose').addEventListener('click',toggleCodex);
const regionMap=initMap($('map'));
$('btnMap').addEventListener('click',()=>regionMap.toggle());
$('btnTrade').addEventListener('click',toggleTrade);$('tradeClose').addEventListener('click',toggleTrade);$('mapClose').addEventListener('click',()=>regionMap.toggle());
$('btnIn').addEventListener('click',()=>{view.z=clamp(view.z/1.3,ZMIN,ZMAX);cancelAuto();});
$('btnOut').addEventListener('click',()=>{view.z=clamp(view.z*1.3,ZMIN,ZMAX);cancelAuto();});
function setPix(p){PIX=p;resize();store.set('deepvale-pix',String(PIX));$('pixSeg').querySelectorAll('[data-pix]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.pix===PIX)));}
$('pixSeg').querySelectorAll('[data-pix]').forEach(b=>b.addEventListener('click',()=>setPix(+b.dataset.pix)));
const thumbCache={};
function renderCodex(){
  const L=$('codexList');L.innerHTML='';const best=comps.reduce((a,c)=>c.size>a.size?c:a,{size:0,maxD:0});
  for(const sp of SPECIES){const met=S.codex[sp.id]||0,known=met>0,lo=LORE[sp.id],tk=talesKnown(sp.id);const e=document.createElement('div');e.className='entry'+(known?'':' unknown');
    const cv=document.createElement('canvas');cv.width=72;cv.height=24;drawThumb(cv,sp,known);
    const ok=(c)=>c?'ok':'';
    const tales=lo.tales.map((t,n)=>n<tk?`<li>${t}</li>`:`<li class="locked">${known?`Meet it ${TALE_AT[n]-met} more time${TALE_AT[n]-met>1?'s':''} to hear this tale.`:'Untold.'}</li>`).join('');
    e.innerHTML=`<div></div><div><div class="en">${known?sp.name:'Unknown'}</div><div class="ee">${known?sp.ep:`Something about ${Math.round(sp.len*4)} m long has been seen in the river. ${lo.rumor}`}</div>
      ${known?`<div class="es">${lo.temper} · ${lo.age} · favors ${lo.favors.toLowerCase()}</div>`:''}
      <div class="er"><span class="${ok(fishersState.length>=sp.crew)}">Crew ${sp.crew}</span><span class="${ok(best.size>=sp.minWater)}">Flowing ${sp.minWater}+</span><span class="${ok(best.maxD>=sp.needD)}">Width ${sp.needD*2-1}+</span>${sp.minHealth?`<span class="${ok(health>=sp.minHealth)}">Health ${sp.minHealth}+</span>`:''}${known?`<span>Met ×${met}</span>`:''}</div>
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
let noSave=false;const WIPE_KEY='deepvale-wipe';
// wiping: drop the save, leave a marker that boot honours even if something saves on the way out, and roll a new valley
function wipeSave(){noSave=true;try{localStorage.removeItem(SAVE_KEY);}catch(e){}store.set(WIPE_KEY,'1');store.set('deepvale-nextmap',String(1+Math.floor(Math.random()*999999)));location.replace(location.pathname+location.search);}
function save(){if(noSave||store.get(WIPE_KEY))return;S.jobs=saveJobs();S.t=Date.now();S.tiles=Array.from(tiles);S.builds=Array.from(builds);S.fishers=fishersState.map(f=>({i:f.i,j:f.j,slot:f.slot,c:f.color}));store.set(SAVE_KEY,JSON.stringify(S));}
let migrated='';
function load(){
  if(store.get(WIPE_KEY)){try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(WIPE_KEY);}catch(e){}return false;}
  const raw=store.get(SAVE_KEY);if(!raw)return false;
  try{const d=JSON.parse(raw);if(!d.tiles)return false;
    // 0.1 saves had one currency (silver from selling fish): it becomes scales
    if(d.scales===undefined){d.scales=d.coins||0;d.silver=10;delete d.coins;migrated='0.1';}
    const old=LEGACY_GRIDS.find(g=>d.tiles.length===g.w*g.h);
    if(!old&&d.tiles.length!==GW*GH)return false;
    const rawTiles=d.tiles,rawBuilds=d.builds,rawFishers=d.fishers||[];
    delete d.tiles;delete d.builds;
    if(old){
      // an older, smaller valley: re-key everything stored by tile so it lands in the middle of the bigger one
      const {w,offI,offJ}=old,rk=k=>idx(k%w+offI,((k/w)|0)+offJ),reKey=o=>Object.fromEntries(Object.entries(o||{}).map(([k,v])=>[rk(+k),v]));
      d.meta=reKey(d.meta);d.hutVillage=reKey(d.hutVillage);d.found=(d.found||[]).map(rk);
      d.drops=(d.drops||[]).map(x=>({...x,i:x.i+offI,j:x.j+offJ,k:rk(x.k)}));
      d.jobs=(d.jobs||[]).map(x=>({...x,i:x.i+offI,j:x.j+offJ}));
      const sh=(key,f)=>Object.fromEntries(Object.entries(d[key]||{}).map(([k,v])=>[f(k),v]));
      d.corners=sh('corners',k=>{const [ci,cj]=k.split(',').map(Number);return `${ci+offI},${cj+offJ}`;});
      d.edges=sh('edges',k=>{const [i,j]=k.slice(2).split(',').map(Number);return `${k.slice(0,2)}${i+offI},${j+offJ}`;});
      d.legacyCh=w===44?offI:(LEGACY_GRIDS[1].offI); // channels keep the 44-wide layout they were dug against
    }
    for(const key of ['goods','reserve','boons','unlocked','counts','meta','tide'])if(d[key])d[key]={...S[key],...d[key]};
    Object.assign(S,d);
    if(old){const {w,h,offI,offJ}=old;
      applyMap(S.map);initTiles();builds.fill(NONE); // the new edges follow this valley's own river
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=idx(i+offI,j+offJ),o=j*w+i;tiles[k]=rawTiles[o];builds[k]=rawBuilds&&rawBuilds.length===rawTiles.length?rawBuilds[o]:NONE;}
      S.fishers=rawFishers.map(f=>({...f,i:f.i+offI,j:f.j+offJ}));
      if(!rawBuilds||rawBuilds.length!==rawTiles.length){initBuilds();}
      else{ // the Pilgrim Way now comes down further from the north edge
        for(let j=0;j<offJ;j++){const k=idx(WAY_I,j);tiles[k]=LAND;builds[k]=ROAD;}
        if(w===28){let best=-1,bd=1e9;for(let k=0;k<GW*GH;k++){const i=k%GW,j=(k/GW)|0;if(tiles[k]===LAND&&builds[k]===NONE&&nbLinkStrict(i,j)){const dd=Math.hypot(i-WAY_I,j-offJ-2);if(dd<bd){bd=dd;best=k;}}}
          if(best>=0)builds[best]=B.POST;}}
      if(w===28){for(let k=0;k<GW*GH;k++)if(builds[k]===HUT)S.meta[k]={style:'thatch'};S.goods.timber+=20;}
      migrated=migrated||(w===28?'0.2':'grow');
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
// another open tab wiped the valley: stop this one from writing its old save back
addEventListener('storage',e=>{if(e.key===WIPE_KEY&&e.newValue)noSave=true;});

/* ================= debug tools ================= */
// ` or F9 opens it in dev builds, or in any build with ?debug in the address
const DEBUG_OK=import.meta.env.DEV||/[?&]debug\b/.test(location.search);
function toggleDebug(){if(!DEBUG_OK)return;const d=$('debug');d.hidden=!d.hidden;if(!d.hidden)renderDebug();}
function renderDebug(){
  const d=$('debug');const spOpts=SPECIES.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  d.innerHTML=`<div class="dh">Debug · v${VERSION} · ${GW}×${GH} <span class="dim">(\` to close)</span></div>
  <div class="dg"><span>Clock</span>${[["Dawn",.01],["Midday",.35],["Golden",.55],["Dusk",.7],["Night",.82]].map(([n,v])=>`<button type="button" data-clock="${v}">${n}</button>`).join("")}</div>
  <div class="dg"><span>Time</span>${[1,2,4,8,16].map(n=>`<button type="button" data-ts="${n}" aria-pressed="${timeScale===n}">×${n}</button>`).join('')}</div>
  <div class="dg"><button type="button" data-a="frenzy" aria-pressed="${debugFlags.frenzy}">Fish frenzy</button><button type="button" data-a="hints" aria-pressed="${debugFlags.allHints}">Show all hints</button></div>
  <div class="dg"><span>Give</span><button type="button" data-a="scales">+1k scales</button><button type="button" data-a="silver">+1k silver</button><button type="button" data-a="goods">+100 goods</button><button type="button" data-a="rich">+100k all</button></div>
  <div class="dg"><span>Fish</span><select id="dbgSp">${spOpts}</select><button type="button" data-a="spawn">Spawn</button><button type="button" data-a="meet">Meet all ×12</button></div>
  <div class="dg"><span>Crates</span><button type="button" data-a="crate">Crate</button><button type="button" data-a="hermit">Keeper</button><button type="button" data-a="unlock">Unlock all</button><button type="button" data-a="slot">+1 keeper slot</button><button type="button" data-a="chest">Chest</button><button type="button" data-a="treasure">Treasure</button><button type="button" data-a="showcase">One of each</button></div>
  <div class="dg"><span>Weather</span>${['clear','rain','storm','fog','snow'].map(k=>`<button type="button" data-w="${k}" aria-pressed="${S.weather?.k===k}">${k}</button>`).join('')}</div>
  <div class="dg"><span>Season</span>${['Spring','Summer','Autumn','Winter'].map((k,n)=>`<button type="button" data-se="${n}">${k}</button>`).join('')}</div>
  <div class="dg"><span>Giant</span>${Object.keys(GIANTS).map(k=>`<button type="button" data-g="${k}" title="${GIANTS[k].name}">${k}</button>`).join('')}</div>
  <div class="dg"><span></span><button type="button" data-a="gLook">Look at giant</button><button type="button" data-a="gGift">Greet (gift)</button><button type="button" data-a="gAway">Send away</button><button type="button" data-a="gTour" aria-pressed="${!!gTour}">Parade all</button></div>
  <div class="dg"><span>Landmark</span>${['temple','elder','tower','gate'].map(k=>{const sc=secrets.find(x=>x.type===k);return `<button type="button" data-lm="${k}"${sc?'':' disabled'}>${k}${sc&&S.found.includes(sc.k)?' ✓':''}</button>`;}).join('')}<button type="button" data-a="lmFind">Uncover all 4</button></div>
  <div class="dg"><span>World</span><button type="button" data-a="clear">Clear 9×9 at view</button><button type="button" data-a="find">Find all secrets</button><button type="button" data-a="fishers">+6 fishers</button></div>
  <div class="dg"><span>Trade</span><button type="button" data-a="ship">Send vehicles now</button><button type="button" data-a="back">Bring them home</button><button type="button" data-a="wish">Grant wish</button><button type="button" data-a="tide">Tide ×1.5</button><button type="button" data-a="work">Finish all work</button></div>
  <div class="dg">${resetArm?'<span>Wipe this valley?</span><button type="button" data-a="wipe" class="warn">Yes, start over</button><button type="button" data-a="keep">Keep it</button>':'<button type="button" data-a="reset" class="warn">Reset save</button>'}</div>`;
  d.querySelectorAll('[data-clock]').forEach(b=>b.addEventListener('click',()=>{S.clock.t=+b.dataset.clock;}));
  d.querySelectorAll('[data-ts]').forEach(b=>b.addEventListener('click',()=>{timeScale=+b.dataset.ts;renderDebug();}));
  d.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>debugAct(b.dataset.a)));
  d.querySelectorAll('[data-w]').forEach(b=>b.addEventListener('click',()=>{S.weather={k:b.dataset.w,left:600};renderDebug();}));
  d.querySelectorAll('[data-se]').forEach(b=>b.addEventListener('click',()=>{const day=S.clock.day||1,y=Math.floor((day-1)/28);S.clock.day=y*28+(+b.dataset.se)*7+3;seasonCT=0;if(S.weather?.k==='snow'&&b.dataset.se!=='3')S.weather.left=0;renderDebug();}));
  d.querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>{gTour=null;previewGiant(b.dataset.g);}));
  d.querySelectorAll('[data-lm]').forEach(b=>b.addEventListener('click',()=>{const sc=secrets.find(x=>x.type===b.dataset.lm);if(!sc)return;const c=tileC(sc.k%GW,(sc.k/GW)|0);tweenTo({x:c.x,y:heightAt(c.x,c.z),z:c.z},30,1.6);}));
}
let resetArm=false;
function debugAct(a){
  const main=()=>comps.reduce((x,c)=>c.size>x.size?c:x,comps[0]);
  if(a==='frenzy'){debugFlags.frenzy=!debugFlags.frenzy;debugSpeed.spawn=debugFlags.frenzy?6:1;debugSpeed.reel=debugFlags.frenzy?4:1;}
  if(a==='hints'){debugFlags.allHints=!debugFlags.allHints;updateHintVis();}
  if(a==='scales')S.scales+=1000;if(a==='silver')S.silver+=1000;
  if(a==='goods')for(const g of GOOD_IDS)S.goods[g]+=100;
  if(a==='rich'){S.scales+=1e5;S.silver+=1e5;for(const g of GOOD_IDS)S.goods[g]+=1e5/10;}
  if(a==='spawn'){const sp=SP[$('dbgSp').value];const c=comps.filter(c=>c.maxD>=sp.needD).sort((x,y)=>y.size-x.size)[0]||main();if(c){const f=spawnFish(sp,c);if(sp.awe)startCine(f);}}
  if(a==='meet'){for(const sp of SPECIES)S.codex[sp.id]=Math.max(12,S.codex[sp.id]||0);S.statueSp=S.statueSp||'koi';renderCodex();}
  if(a==='chest'&&!dropChest())log('No room for a chest (two are already out, or no forest edge).','warn');
  if(a==='crate')queueCrate({source:'the debug fairy',kind:'mixed'});
  if(a==='treasure')queueCrate({source:'the debug fairy',kind:'treasure'});
  if(a==='showcase')queueCrate({source:'the debug fairy',kind:'showcase'});
  if(a==='hermit')queueCrate({source:'the debug fairy',kind:'keeper'});
  if(a==='unlock')for(const b of BLUEPRINTS)S.unlocked[b.id]=true;
  if(a==='slot'){for(let k=0;k<GW*GH;k++){if(tiles[k]===LAND&&builds[k]===NONE&&!fishersState.some(f=>idx(f.i,f.j)===k)&&!nb8(k%GW,(k/GW)|0,WATER)){builds[k]=B.STONES;break;}}buildsChanged();renderKeepers();}
  if(a==='clear'){const ci=Math.floor(view.t.x+HX),cj=Math.floor(view.t.z+HZ);for(let b=-4;b<=4;b++)for(let x=-4;x<=4;x++){const i=ci+x,j=cj+b;if(!inGrid(i,j))continue;const k=idx(i,j);if(tiles[k]===WILD){tiles[k]=LAND;revealAt(k);}}worldChanged();}
  if(a==='gLook'){const gi=giants.list.find(g=>g.alive);if(gi)lookAtGiant(gi);else log('No giant out right now. Pick one above.','warn');}
  if(a==='gGift'){const gi=giants.list.find(g=>!g.gifted);if(gi)giantGift(gi);}
  if(a==='gAway'){gTour=null;giants.list.forEach(g=>giants.depart(g));}
  if(a==='gTour'){gTour=gTour?null:{n:0,t:0};if(gTour)previewGiant(GIANT_KEYS[0]);renderDebug();}
  if(a==='lmFind'){for(const s of secrets)if(['temple','elder','tower','gate'].includes(s.type)&&!S.found.includes(s.k)){tiles[s.k]=LAND;revealAt(s.k);}worldChanged();renderDebug();}
  if(a==='find'){for(const s of secrets)if(!S.found.includes(s.k)){tiles[s.k]=LAND;revealAt(s.k);}worldChanged();}
  if(a==='fishers'){let n=0;for(let j=0;j<GH&&n<6;j++)for(let i=0;i<GW&&n<6;i++){if(standable(i,j)&&freeSlot(i,j)>=0&&builds[idx(i,j)]!==BRIDGE){while(n<6&&freeSlot(i,j)>=0){makeFisher(i,j,freeSlot(i,j),S.hires+n);n++;}}}
    for(let q=0;q<2;q++){for(let k=0;k<GW*GH;k++){if(tiles[k]===LAND&&builds[k]===NONE&&!fishersState.some(f=>idx(f.i,f.j)===k)){builds[k]=HUT;S.meta[k]={style:S.hutStyle};break;}}}buildsChanged();}
  if(a==='ship')for(const v of trade.vehicles)if(v.state==='load'){v.t=999;S.goods.timber+=capacity(v.kind);}
  if(a==='back')for(const v of trade.vehicles)if(v.state==='away')v.t=0;
  if(a==='wish'&&S.wish){S.wish.have=S.wish.n-1;wishEvent(S.wish.kind,{sp:S.wish.sp,id:S.wish.id,n:S.wish.n});}
  if(a==='tide'){S.tide.n=10;S.tide.t=Date.now();}
  if(a==='work')for(const jb of jobs.slice())finishJob(jb);
  if(a==='reset'||a==='keep'){resetArm=a==='reset';renderDebug();return;}
  if(a==='wipe'){wipeSave();return;}
  computeEconomy();renderDrawer();refreshUI();renderDebug();save();
}

/* ---- the mountain staircase on the Pilgrim Way ---- */
function buildStairs(){
  const g=new THREE.Group(),P=wayPath(),stepM=rimMat({color:'#9a948a'},'#ffe0b0',.7),stepM2=rimMat({color:'#8a847a'},'#ffe0b0',.7),woodM=rimMat({color:'#6b4a2e'},'#ffd29a',.6),railM=rimMat({color:'#8a6440'},'#ffd29a',.6);
  const stepG=new THREE.BoxGeometry(1,1,1),postG=new THREE.CylinderGeometry(.018,.022,1,5),up=new THREE.Vector3(0,1,0),v=new THREE.Vector3();
  const beam=(a,b,m,r=.014)=>{const L=a.distanceTo(b);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,4),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(up,v.copy(b).sub(a).normalize());g.add(o);};
  let prevPosts=null;
  for(let n=0;n<P.length-1;n++){const a=P[n],b=P[n+1],ha=heightAt(a.x,a.z),hb=heightAt(b.x,b.z),dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),ang=Math.atan2(dx,dz);
    if(a.z>-HZ-.3)continue;
    const top=Math.max(ha,hb)+.03,s=new THREE.Mesh(stepG,n%2?stepM:stepM2);s.scale.set(.52,.08+Math.abs(hb-ha)+.25,L+.02);s.position.set((a.x+b.x)/2,top-s.scale.y/2,(a.z+b.z)/2);s.rotation.y=ang;g.add(s);
    if(n%3===0){const px=Math.cos(ang)*.3,pz=-Math.sin(ang)*.3,posts=[];
      for(const sd of [-1,1]){const x=a.x+px*sd,z=a.z+pz*sd,y=Math.max(heightAt(x,z),top-.05),p=new THREE.Mesh(postG,woodM);p.scale.y=.26;p.position.set(x,y+.13,z);g.add(p);posts.push(new THREE.Vector3(x,y+.24,z));}
      if(prevPosts)for(let q=0;q<2;q++)beam(prevPosts[q],posts[q],railM);prevPosts=posts;}}
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(g);
}

/* ---- icons on the toolbar and chips ---- */
// the building tools carry a dithered picture of what they build; the others keep their line icons
const ART_TOOLS=['hut','road','bridge','build'];
function setToolArt(){for(const t of ART_TOOLS){const ti=document.querySelector(`.tool[data-tool="${t}"] .ti`);if(!ti)continue;const h=bicons.html(t,iconSet,'bicon tool-art');if(h){ti.innerHTML=h;ti.classList.add('art');}}}
function setIconSet(s){iconSet=s==='painted'?'painted':'models';store.set('deepvale-icons',iconSet);setToolArt();renderDrawer();
  $('iconSeg').querySelectorAll('[data-icons]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.icons===iconSet)));}
$('iconSeg').querySelectorAll('[data-icons]').forEach(b=>b.addEventListener('click',()=>setIconSet(b.dataset.icons)));
iconSet=store.get('deepvale-icons')==='painted'?'painted':'models';
$('iconSeg').querySelectorAll('[data-icons]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.icons===iconSet)));
{const T={look:'look',clear:'clear',dig:'dig',hire:'hire',hut:'hut',road:'road',bridge:'bridge',build:'build',remove:'remove'};
  document.querySelectorAll('.tool').forEach(b=>{const n=T[b.dataset.tool];if(n)b.insertAdjacentHTML('afterbegin',`<span class="ti">${icon(n)}</span>`);});
  setToolArt();
  $('upLine').insertAdjacentHTML('afterbegin',`<span class="ti">${icon('line')}</span>`);$('upBait').insertAdjacentHTML('afterbegin',`<span class="ti">${icon('bait')}</span>`);
  for(const [id,n] of [['btnTrade','trade'],['btnCodex','codex'],['btnMap','map'],['btnSettings','settings']])$(id).insertAdjacentHTML('afterbegin',icon(n));
  $('coinSc').insertAdjacentHTML('afterbegin',icon('scales'));$('coinSv').insertAdjacentHTML('afterbegin',icon('silver'));
  $('emb').innerHTML=icon('fish','big');$('goalsIc').innerHTML=icon('wish');
  document.querySelectorAll('.tool').forEach(b=>{const k=b.querySelector('kbd');if(k)b.title=`${b.querySelector('.tn').textContent} (${k.textContent})`;});
  $('goals').querySelector('h3').addEventListener('click',()=>{$('goals').classList.toggle('collapsed');store.set('deepvale-goals',$('goals').classList.contains('collapsed')?'1':'');});
  if(store.get('deepvale-goals'))$('goals').classList.add('collapsed');}

/* ================= boot ================= */
const loaded=load();
// the valley's shape: saved games keep theirs (old saves the original valley); new games roll one from a seed
function applyMap(map){if(!map)return;setRiver(map.river);setShape(map);MTS=map.mts;INLET=mouthRows(0);OUTLET=mouthRows(GW-1);}
function rollMap(seed){let s=seed>>>0||1;const R=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  const G=GROW*.95,mts=[[-44+R()*54,-44+R()*10,28+R()*22,10+R()*5],[-64+R()*14,-24+R()*26,12+R()*12,8+R()*4],[-8+R()*36,-66+R()*12,18+R()*14,11+R()*4],[-60+R()*14,-58+R()*12,12+R()*10,9+R()*3]].map(([x,z,h,s])=>[x*G,z*G,h,s*1.15]);
  if(R()<.6)mts.push([10+R()*24,-40+R()*8,20+R()*14,9+R()*3]); // sometimes a second peak to the north-east
  return {seed,river:randomRiver(seed),mts};}
if(loaded){applyMap(S.map);if(!S.shaped){carveEdge(tiles,true);S.shaped=1;}}
else{const pend=+store.get('deepvale-nextmap')||0;S.map=rollMap(pend||1+Math.floor(Math.random()*999999));store.set('deepvale-nextmap','');applyMap(S.map);S.seed=S.map.seed;S.shaped=1;initTiles();initBuilds();}
$('valleyNo').textContent=(S.map?`Valley no. ${S.map.seed}`:'The first valley')+` · v${VERSION}`;$('reroll').hidden=loaded;
{const p=parseInt(store.get('deepvale-pix'));if([2,3,4].includes(p))PIX=p;$('pixSeg').querySelectorAll('[data-pix]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.pix===PIX)));}
initSecrets();
buildTerrain(false);buildStairs();scatterOuter();updateTrees();analyzeWater();computeVillages();computeEconomy();village.sync();trade.sync();trade.topUpOrders();updateHintVis();
if(loaded&&S.fishers.length){S.fishers.forEach(f=>{if(inGrid(f.i,f.j))makeFisher(f.i,f.j,f.slot,f.c??0);});}
else{const spot=[];for(let j=0;j<GH;j++)for(let i=0;i<GW;i++)if(standable(i,j)&&builds[idx(i,j)]!==BRIDGE)spot.push([i,j]);
  const hut=builds.indexOf(HUT),hj=hut>=0?(hut/GW)|0:GH/2;spot.sort((a,b)=>Math.hypot(a[0]-WAY_I,a[1]-hj-2)-Math.hypot(b[0]-WAY_I,b[1]-hj-2));
  const s=spot[0]||[WAY_I,GH/2];makeFisher(s[0],s[1],1,0);}
// a few fish already in the river
{const main=comps.reduce((a,c)=>c.size>a.size?c:a,comps[0]);if(main){for(let n=0;n<4;n++)spawnFish(n<3?SP.reed:SP.koi,main,{emerge:false});}}
if(!S.weirGone&&!builds.includes(B.WEIR))placeWeir();
const taleHouseAdded=loaded&&placeTaleHouse();if(taleHouseAdded)buildsChanged();
migrateDeco();
computeEconomy();roads.sync();updateLilies();
booted=true;
// work that was still going when the valley was closed gets finished while you were away
if(loaded&&Array.isArray(S.jobs)){const js=S.jobs;S.jobs=[];for(const jb of js){if(inGrid(jb.i,jb.j))applyJob({...jb,quiet:true});}}
if(loaded){const away=Math.min(8*3600e3,Date.now()-S.t)/1000;if(away>0&&S.clock){S.clock.t+=away/DAY_LEN;S.clock.day+=Math.floor(S.clock.t);S.clock.t%=1;}offlineGain(Date.now()-S.t);}
resize();renderCodex();refreshUI();updateMarks();renderKeepers();renderWish();
if(!S.wish)setTimeout(()=>{if(!S.wish)newWish();},loaded?4000:30000);
$('reroll').addEventListener('click',wipeSave);

/* ---- settings, the valley's name, which menu is open ---- */
function toggleSettings(force){const d=$('settings');d.hidden=force!==undefined?!force:!d.hidden;if(!d.hidden){$('valleyName').value=S.valleyName||'';renderWipe(false);}}
$('btnSettings').addEventListener('click',()=>toggleSettings());$('menuSettings').addEventListener('click',()=>toggleSettings(true));$('settingsClose').addEventListener('click',()=>toggleSettings(false));
$('valleyTitle').addEventListener('click',()=>{toggleSettings(true);setTimeout(()=>{$('valleyName').focus();$('valleyName').select();},30);});
function setValleyName(n,quiet){n=(n||'').replace(/\s+/g,' ').trim().slice(0,24);S.valleyName=n||null;const nm=n||'Deepvale';
  $('valleyTitle').textContent=nm;document.title=n?`${n} · Deepvale`:'Deepvale';menu.setTitle(nm);if(!quiet)save();}
$('valleyName').addEventListener('change',e=>setValleyName(e.target.value));
$('valleyName').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){setValleyName(e.target.value);e.target.blur();}});
function renderWipe(ask){$('wipeSeg').innerHTML=ask?'<button class="nav warn" id="wipeYes" type="button">Yes, wipe this valley</button><button class="nav" id="wipeNo" type="button">Keep it</button>':'<button class="nav" id="wipeAsk" type="button">Start a new valley…</button>';
  if(ask){$('wipeYes').addEventListener('click',wipeSave);$('wipeNo').addEventListener('click',()=>renderWipe(false));}else $('wipeAsk').addEventListener('click',()=>renderWipe(true));}
renderWipe(false);
// the open menu is marked in the top bar
{const pairs=[['trade','btnTrade'],['codex','btnCodex'],['map','btnMap'],['settings','btnSettings']];
  const mark=()=>pairs.forEach(([p,b])=>$(b).classList.toggle('on',!$(p).hidden));
  const mo=new MutationObserver(mark);pairs.forEach(([p])=>mo.observe($(p),{attributes:true,attributeFilter:['hidden']}));mark();}
/* ---- the guided tour ---- */
const tour=makeTour($('dv'),{sfx,onEnd:done=>{S.tourDone=true;save();
  if(!done)log('Tour skipped. You can take it again from Settings.');
  else log('Released fish shed scales. The old dry riverbeds still show through the trees: dig them out to bring the river back.');}});
// screen rect around a world spot, and around a whole tile
const spotAt=(x,z,r=34)=>{const p=toScreen(x,Math.max(heightAt(x,z),0)+.1,z);return {x:p.x-r,y:p.y-r,w:r*2,h:r*2};};
function tileRect(k){const i=k%GW,j=(k/GW)|0,c=tileC(i,j),y=Math.max(heightAt(c.x,c.z),0);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const [a,b] of [[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){const p=toScreen(c.x+a,y,c.z+b);x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);}
  return {x:x0,y:y0-10,w:x1-x0,h:y1-y0+10};}
const unionRect=(...els)=>{const r=els.map(e=>e.getBoundingClientRect()).filter(b=>b.width);if(!r.length)return null;const x=Math.min(...r.map(b=>b.left)),y=Math.min(...r.map(b=>b.top));
  return {x,y,w:Math.max(...r.map(b=>b.right))-x,h:Math.max(...r.map(b=>b.bottom))-y};};
function TOUR(){
  const nm=S.valleyName||'Deepvale';let clearK=-1,jobsAt=0,theJob=null;
  const fisher=()=>fishersState[0]?.g.position;
  // a patch of forest beside the village, for the first clearing
  const pickClear=()=>{const h=builds.indexOf(HUT);const hi=h%GW,hj=(h/GW)|0;let best=-1,bd=1e9;
    for(let k=0;k<GW*GH;k++){if(tiles[k]!==WILD||busy.has(k)||secretAt[k])continue;const i=k%GW,j=(k/GW)|0;if(!nb4(i,j,LAND))continue;const d=Math.hypot(i-hi,j-hj);if(d<bd){bd=d;best=k;}}return best;};
  const lookAt=(x,z,zoom=16)=>tweenTo({x,z},zoom,1.4);
  return [
    {title:`Welcome to ${nm}`,text:'Far below the mountain, a river once ran wide enough for giants. Here every fish is met on a barbless line, and let go. This short tour shows how the valley works.',next:'Show me'},
    {title:'Your first fisher',text:'They wait at the bank and reel in whatever bites, all on their own. You can <b>lend a hand</b>: when a fish is on the line, a ring appears beside it. Press <b>Space</b> or click it as the light crosses the mint arc. If the fish surges and the ring turns ember, let it run.',
      enter(){const f=fisher();if(f)lookAt(f.x,f.z,13);},target(){const f=fisher();return f?spotAt(f.x,f.z,38):null;},round:true},
    {title:'Scales and silver',text:'Released fish shed <b>scales</b>, which pay for work on the river and the village. <b>Silver</b> comes from pilgrims, market stalls and trade, and pays for fishers and upgrades.',target:()=>document.querySelector('.grp.coins')},
    {title:'Clear some land',text:'The valley is overgrown. Pick <b>Clear land</b> from the bar below, or press <b>1</b>.',target:()=>$('tool-clear'),next:false,wait:()=>tool==='clear'},
    {title:'Pick a patch of forest',text:'Click the glowing patch of forest beside the village, or any other one. Workers walk over with their axes.',next:false,
      enter(){clearK=pickClear();jobsAt=jobs.length;if(clearK>=0){const c=tileC(clearK%GW,(clearK/GW)|0);lookAt(c.x,c.z,12);}},
      target:()=>clearK>=0?tileRect(clearK):null,wait:()=>{if(jobs.length>jobsAt){theJob=jobs[jobs.length-1];return true;}return false;}},
    {title:'Work takes a little while',text:'Queued tiles are marked on the ground, and a small ring over each patch fills as the work goes on (hover it for details). Cleared land gives timber, and makes room to build. You can queue several at once.',
      enter(){setTool('look');},target:()=>theJob&&(tileBars.get('j'+theJob.k)||[...tileBars.entries()].find(([q])=>q[0]==='j')?.[1])||null,pad:6,round:true},
    {title:'Bring the river back',text:'The river used to be wider, and its old dry beds still show through the trees. <b>Dig water</b> to restore them. Bigger fish only come where wide water flows.',target:()=>$('tool-dig')},
    {title:'More hands on the bank',text:'Larger fish only bite when several fishers wait together. Build <b>huts</b> to house them, then <b>Hire fisher</b> and click a bank tile.',target:()=>unionRect($('tool-hire'),$('tool-hut'))},
    {title:'Everything else',text:'Woodcutters, reed beds, workshops, market stalls, statues and more are in <b>Build</b> (or press <b>B</b>).',target:()=>$('tool-build')},
    {title:'The Tale House',text:'Pilgrims come down the Way to hear the valley’s tales here, and leave silver in the tale box. Every tale you learn from the fish brings more of them, and the house grows.',
      enter(){const k=builds.indexOf(B.TALEHALL);if(k>=0){const c=tileC(k%GW,(k/GW)|0);lookAt(c.x,c.z,12);}},target(){const k=builds.indexOf(B.TALEHALL);return k>=0?tileRect(k):null;}},
    {title:'What to do next',text:'Your next steps are tracked here: the next fish to meet, a wish from the village, and orders from along the river.',enter(){tweenTo({x:0,z:-2},innerWidth<700?24:32,1.6);},target:()=>$('goals')},
    {title:'Menus',text:'<b>Trade</b> sends goods away by wagon and barge, the <b>Codex</b> keeps every fish and its tales, and <b>Settings</b> can replay this tour.',target:()=>document.querySelector('.topnav')},
    {title:'The valley is yours',text:'Clear, dig, build, and wait by the water. Something vast is waiting further down the river.'},
  ];
}
$('tourBtn').addEventListener('click',()=>{toggleSettings(false);if(!started){S.tourPending=true;$('enter').click();}else tour.start(TOUR());});
const menu=makeMenu($('intro'));$('dv').classList.add('menu');
setValleyName(S.valleyName||'',true);
if(loaded)$('enter').querySelector('span').textContent=`Return to ${S.valleyName||'the valley'}`;
$('enter').addEventListener('click',()=>{started=true;$('intro').classList.add('gone');$('dv').classList.remove('menu');toggleSettings(false);setSound(true);
  tweenTo({x:0,y:0,z:-2},innerWidth<700?24:32,5.5);
  // a new valley starts with the guided tour; the old opening notes stay for anyone who skips it
  if(!loaded||S.first||S.tourPending){S.first=false;S.tourPending=false;setTimeout(()=>{if(!tour.active)tour.start(TOUR());},5600);}
  else if(migrated==='grow'){log('The valley has grown on every side. More forest to clear, old landmarks deep in the wood, and the river runs further. Everything you built is where you left it.','gold');}
  else if(migrated==='0.2'){log('The valley has grown. There is more forest to clear, and a trading post by the Pilgrim Way. Pilgrims buy at market stalls now.','gold');}
  else if(migrated)log('The valley has changed: fish are released now, and a village has grown by the Pilgrim Way.','gold');
  else log('Welcome back to the valley.');
  if(taleHouseAdded)setTimeout(()=>log('The village has built a Tale House by the Way. Pilgrims come to hear the tales there now, and leave silver in the tale box. It grows as you learn more tales.','gold'),1500);
});

const clock=new THREE.Clock();let saveT=0,uiT=0,crateSkip=0;
// the simulation: run several times a frame when the debug time scale is up
function simStep(dt,t){
  for(const f of fishes.slice()){updateFish(f,dt);updateFight(f,dt);}
  hookTimer+=dt;if(hookTimer>.5){hookTimer=0;hookCheck();}
  clockTick(dt);spawnTick(dt);giantTick(dt);if(started)dropTick(dt);pilgrimTick(dt);productionTick(dt);trade.update(dt,t);village.update(dt,t);workTick(dt,t);
}
// before the valley is entered, the camera drifts slowly over it
function menuDrift(){if(started||tween)return;const tt=performance.now()/1000;view.t.x=-13+Math.sin(tt*.045)*5;view.t.z=-24+Math.sin(tt*.031)*2.5;}
function frame(){
  const dt=Math.min(.1,clock.getDelta());U.time.value+=dt;const t=U.time.value;
  keyPan(dt);menuDrift();updateCamera(dt);
  for(let n=0;n<timeScale;n++)simStep(dt,t+n*dt);
  fishersState.forEach(fs=>updateFisher(fs,dt,t));
  updateBeam(dt,t);shadeU.uTime.value=t;if(started)bellTick(dt);seasonTick(dt);weatherTick(dt,t);wildTick(dt,t);giants.update(dt,t);giantTourTick(dt);updateGiantChip();
  updateCine(dt);updateSparkles(dt);updateHeat(dt);updateHints(dt,t);updateDusk(dt);updateFallers(dt);updateCrows(dt,t);
  wisps.update(dt,(innerHeight/PIX)/view.z);
  updateLabels();updateReel(dt);tour.tick();drawPreview();positionPlot();
  if(started&&ptrIn&&!drag)hovered=cine.fish?null:pickFish(lastPtr.x,lastPtr.y);
  updateCard();
  if(selected){selRing.position.set(selected.x,selected.g.position.y+.02,selected.z);selRing.scale.setScalar(1+Math.sin(t*5)*.12);}
  uiT+=dt;if(uiT>.5){uiT=0;refreshUI();}
  saveT+=dt;if(saveT>10){saveT=0;save();}
  // while a crate is open the valley sits blurred and dimmed behind the cards: draw it every third frame, so the
  // full-screen backdrop blur is redone a third as often and the cards get the frame time. The simulation keeps running.
  lightsTick(dt);
  if(!crateOpen||++crateSkip%3===0){
    renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.render(scene,camera);
    bloom.render(rt,lerp(1.15,.7,lampOn));
    invPV.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).invert();
    renderer.setRenderTarget(null);renderer.render(postScene,postCam);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (import.meta.env.DEV) window.__dv={wxSnap:()=>{for(let n=0;n<120;n++)weatherTick(.1,U.time.value);},save,wildFx:()=>{wildT=0;},seasonFx:()=>{seasonCT=0;seasonTick(0);},THREE,seasonW,SEASON_U,foliage,makeFishMesh,U,groundAt,camera,giants,wildlife,giantGift,S,fishes,fishersState,spawnFish,SP,comps:()=>comps,view,tweenTo,startCine,tiles,builds,FLOW,act,worldChanged,buildsChanged,refreshUI,pickFish,toScreen,setTool,hookCheck,trade,secrets:()=>secrets,queueCrate,debugAct,canDo,villages:()=>villages,producers:()=>producers,activeSets:()=>activeSets,setTimeScale:n=>{timeScale=n;},hintVis,newWish,linkedOf,tally,sfx,simStep,jobs,workers,openPlot,snapAt:(p,k)=>snapAt(p,k),actDeco:(t,s)=>actDeco(t,s),corners:()=>S.corners,edges:()=>S.edges};
