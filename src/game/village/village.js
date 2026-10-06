// Deepvale · village/village.js
// Workers walking to jobs, corner and edge decor, and building plots.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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

