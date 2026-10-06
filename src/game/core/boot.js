// Deepvale · core/boot.js
// Boot, settings and menus, the guided tour, and the main loop.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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
