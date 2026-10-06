// Deepvale · fish/hooking.js
// Hooking and fighting fish, the release tally, and spawning.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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

