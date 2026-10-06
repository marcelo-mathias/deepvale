// Deepvale · core/setup.js
// Imports, game state, renderer and scene, and the day/night clock.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
// The imports below are resolved from src/main.js, so their paths are relative to src/, not to this folder.
import { version as VERSION } from '../package.json';
import { emblem, emblemMini, EMBLEMS } from './ui/emblems.js';
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
import { setSound as setAudio, sfx, isSoundOn, setView as setAudioView, playTheme, themeNote, worldSound, setWeatherSound, reelTension } from './audio/audio.js';
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
// scales: the valley's one money. Released fish shed them; trade, market stalls and the tale box pay in them too. They pay for everything.
// goods: timber, reeds, clay (raw) and carvings, lanterns (crafted). meta: per-tile extras {style, pave, sp}. counts: how many of each build (for costs).
const S={scales:30,tiles:null,builds:null,fishers:[],hires:0,clears:0,digs:0,huts:0,bridges:0,lineLv:0,baitLv:0,codex:{},hutVillage:{},earned:0,income:[],t:Date.now(),first:true,
  goods:{timber:10,reeds:0,clay:0,carvings:0,lanterns:0},reserve:{...RESERVE},meta:{},counts:{},keepers:[],boons:{},unlocked:{},seed:0,found:[],deposits:[],
  orders:[],ordersDone:0,shipments:0,wish:null,wishesDone:0,wishBase:null,tide:{n:0,t:0},sets:{},small:0,hutStyle:'thatch',pave:'gravel',statueSp:null,crates:0,ship:{},drops:[],dropT:0,v:3};
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
/* ---- the pace ----
   Deepvale is meant to be left running while you do other things, so things come slowly and each one means more.
   Every timer that sets the rhythm of the valley is here; the crews' own speed is PACE in game/village/village.js. */
const PACING={
  day:2400,            // seconds from dawn to dawn: 40 minutes (was 16). A season is 7 days, about 4½ hours
  wishPause:[180,300], // seconds the village takes to think of its next wish (was 12)
  firstChest:420,      // seconds before the first chest turns up in the forest (was 150)
  chest:[600,1000],    // seconds between chests after that (was 200–360)
  giant:[900,1500],    // seconds between visits from the giants of the high country (was 420–720)
  orderCrateEvery:3,   // ordinary orders bring a crate every third time; contracts always do (was every order)
  treasure:1.5,        // treasure cards hold this much more, since crates come less often
  hireGrow:1.22,       // each fisher costs this much more than the last (was 1.3)
  hutGrow:1.22,        // each hut costs this much more than the last (was 1.3)
  wanderers:[20,40],   // seconds between pilgrims who only come to look, when no Tale House or market stall is on the Way
};
/* ---- the day: dawn, morning, midday, golden hour, dusk, night. One day is PACING.day seconds of play ---- */
const DAY_LEN=PACING.day;
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

