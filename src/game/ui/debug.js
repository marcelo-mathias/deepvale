// Deepvale · ui/debug.js
// The debug panel, the mountain staircase, toolbar icons.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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

