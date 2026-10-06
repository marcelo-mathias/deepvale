// Deepvale · ui/hud.js
// The HUD: labels, work rings on the map, the reeling ring, the build drawer and the trade ledger.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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
  for(const v of villages){let el=villageLbl.get(v.name);if(!el){el=document.createElement('div');el.className='vlbl';el.textContent=v.name;el.title='Click to rename';el.addEventListener('click',()=>renameVillage(el,v.name));labelsEl.appendChild(el);villageLbl.set(v.name,el);}
    const p=toScreen(v.cx,.9,v.cz);el.style.left=p.x+'px';el.style.top=p.y+'px';}
  for(const [n,el] of villageLbl)if(!villages.some(v=>v.name===n)){el.remove();villageLbl.delete(n);}
}
const villageLbl=new Map();
// click a village's name to rename it: every hut that belongs to it takes the new name
function renameVillage(el,old){if(el.querySelector('input'))return;
  const inp=document.createElement('input');inp.type='text';inp.value=old;inp.maxLength=24;inp.setAttribute('aria-label','Village name');inp.spellcheck=false;
  el.textContent='';el.appendChild(inp);el.classList.add('edit');inp.focus();inp.select();
  let done=false;const finish=ok=>{if(done)return;done=true;const nw=inp.value.replace(/\s+/g,' ').trim();el.classList.remove('edit');
    if(ok&&nw&&nw!==old){if(villages.some(v=>v.name.toLowerCase()===nw.toLowerCase()&&v.name!==old)){el.textContent=old;log(`There is already a village called ${nw}.`,'warn');sfx('no');return;}
      for(const k of Object.keys(S.hutVillage))if(S.hutVillage[k]===old)S.hutVillage[k]=nw;
      villageLbl.delete(old);el.remove();computeVillages();log(`${old} is called ${nw} now.`,'gold');sfx('set');save();refreshUI();}
    else el.textContent=old;};
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')finish(true);if(e.key==='Escape')finish(false);});
  inp.addEventListener('keyup',e=>e.stopPropagation());
  inp.addEventListener('blur',()=>finish(true));}
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
  $('scales').textContent=fmt(S.scales);
  const r=incomeRate(),lh=linkedHuts().length;
  $('rate').textContent=r>0?`~${r<10?r.toFixed(1):fmt(r)} scales / min`:'No fish met yet';
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
  $('upLine').disabled=S.scales<cost.line();$('upBait').disabled=S.scales<cost.bait();
  {const met=SPECIES.filter(s=>S.codex[s.id]).length;$('codexCount').textContent=`${met}/${SPECIES.length}`;$('btnCodex').title=`Codex · ${met} of ${SPECIES.length} fish met`;$('codexDot').hidden=met<=(S.codexSeen||0);}
  const busy=trade.vehicles.filter(v=>v.state!=='load'&&v.state!=='stuck').length;$('tradeN').textContent=`${busy}/${trade.vehicles.length}`;{const hub=tradeHub()>=0,b=$('btnTrade');b.classList.toggle('locked',!hub);b.title=hub?'Open the ledger at the trading post (T)':'Trade is run from a trading post. Build one first';}
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
  {const v=trade.vehicles.find(v=>v.kind===(o.route==='north'?'wagon':'barge'));if(v&&v.state==='load'&&(S.goods[g]||0)>=1&&!trade.plan(v)[g])return `Load the ${nm} at the ${o.route==='north'?'trading post':'jetty'} and press Go.`;}
  return '';}
function renderOrdersGoal(){const os=[...(S.orders||[]).filter(o=>!o.contract).slice(0,2),...(S.orders||[]).filter(o=>o.contract).slice(0,1)];const h=os.map(o=>{const hint=orderHint(o);return `<div class="gl"><span class="gi">${icon('order')}</span><div class="gt"><b>${o.regionName}</b><span>${o.contract?'Contract: ':''}Send ${fmt(o.qty)} ${GOODS[o.good].name.toLowerCase()} by ${o.route==='north'?'wagon':'barge'}</span>${hint?`<span class="still">${hint}</span>`:''}</div><span class="gn">${fmt(o.got)}/${fmt(o.qty)}</span></div>`;}).join('');if($('goalOrders').innerHTML!==h)$('goalOrders').innerHTML=h;}

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
  if(drawerTab==='work')it.push({tool:'scout',key:'scout',name:'Send a crow',desc:'Scouts a spot with a sign above the trees and finds what is there, without cutting the forest.',cost:{scales:10}});
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
// trade is run from a trading post (or a jetty, for barges): the ledger opens there, and the top-bar button
// takes you to the post first. With neither built, there is nobody to send.
function tradeHub(){let j=-1;for(let k=0;k<GW*GH;k++){if(builds[k]===B.POST)return k;if(j<0&&builds[k]===B.JETTY)j=k;}return j;}
function toggleTrade(fromPost){const d=$('trade');
  if(d.hidden){const k=tradeHub();
    if(k<0){log('Trade is run from a trading post. Build one by a road (Build → Work & trade), then click it to send wagons.','warn');sfx('no');
      const b=$('btnTrade');b.classList.remove('nudge');void b.offsetWidth;b.classList.add('nudge');return;}
    if(fromPost!==true){const c=tileC(k%GW,(k/GW)|0);tweenTo({x:c.x,y:0,z:c.z},Math.min(view.z,34),1.1);}}
  d.hidden=!d.hidden;if(!d.hidden){$('drawer').hidden=true;closePlot();renderTrade();}}
// the ledger redraws only when something in it changed, never in the middle of a press, and its controls
// are wired once on the panel (so a redraw can't swallow a click)
let lastTradeHTML='',tradeHold=false;
{const body=$('tradeBody'),veh=n=>trade.vehicles[+n],after=()=>{lastTradeHTML='';renderTrade();save();};
  body.addEventListener('pointerdown',()=>{tradeHold=true;});addEventListener('pointerup',()=>{if(tradeHold)setTimeout(()=>{tradeHold=false;},0);});
  body.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.m!==undefined&&b.dataset.q!==undefined){const v=veh(b.dataset.m);if(v){trade.setPlan(v,b.dataset.g,+b.dataset.q);sfx('tick',2);}tradeHold=false;after();return;}
    if(b.dataset.fill!==undefined){const v=veh(b.dataset.fill);if(v){trade.planForOrders(v);sfx('pluck');}tradeHold=false;after();return;}
    if(b.dataset.clear!==undefined){const v=veh(b.dataset.clear);if(v)trade.clearPlan(v);tradeHold=false;after();return;}
    if(b.dataset.go!==undefined){const v=veh(b.dataset.go);tradeHold=false;if(v&&trade.sendNow(v))refreshUI();after();return;}
    if(b.closest('.rs')){const g=b.dataset.g;S.reserve[g]=clamp(S.reserve[g]+ +b.dataset.d,0,200);tradeHold=false;after();}});
  body.addEventListener('keydown',e=>{if(e.target.tagName!=='INPUT')return;e.stopPropagation();if(e.key==='Enter')e.target.blur();});
  body.addEventListener('keyup',e=>{if(e.target.tagName==='INPUT')e.stopPropagation();});
  body.addEventListener('change',e=>{const inp=e.target;if(inp.tagName!=='INPUT'||inp.dataset.m===undefined)return;const v=veh(inp.dataset.m);if(v)trade.setPlan(v,inp.dataset.g,+inp.value||0);inp.blur();after();});}
function renderTrade(){
  if(tradeHub()<0){$('trade').hidden=true;return;}
  const body=$('tradeBody');if(tradeHold||(body.contains(document.activeElement)&&document.activeElement.tagName==='INPUT'))return; // don't redraw under a press or someone typing
  const g=GOOD_IDS.map(id=>`<tr><td><i class="sw" style="background:${GOODS[id].col}"></i>${GOODS[id].name}</td><td class="n">${fmt(S.goods[id]||0)}</td><td class="n dim">${goodRate(id)?'+'+goodRate(id).toFixed(1)+'/min':''}</td>
    <td class="n dim">${price(id,'wagon').toFixed(0)} · ${price(id,'barge').toFixed(0)}</td><td class="rs" title="Markets won’t sell below this">${GOODS[id].raw?`<button type="button" data-g="${id}" data-d="-2">−</button><span>${S.reserve[id]}</span><button type="button" data-g="${id}" data-d="2">+</button>`:''}</td></tr>`).join('');
  // one manifest per wagon and barge: what goes on board, checked against the orders on its route
  const man=trade.vehicles.map((v,n)=>{const nm=v.kind==='wagon'?'Wagon':'Barge',route=v.kind==='wagon'?'north':'east',cap=capacity(v.kind,v.home);
    if(v.state!=='load')return `<div class="man away"><div class="mh"><b>${nm}</b><span class="dim">${vehicleLine(v)}</span></div></div>`;
    const p=trade.plan(v),on=trade.planned(v),w=trade.wanted(route);
    const rows=GOOD_IDS.filter(id=>(S.goods[id]||0)>=1||p[id]).map(id=>{const q=p[id]||0,need=w[id]||0;
      return `<div class="mr${q?' on':''}"><span class="mg"><i class="sw" style="background:${GOODS[id].col}"></i>${GOODS[id].name}${need?` <em class="need" title="Orders on this route still want ${need}">wanted ${fmt(need)}</em>`:''}</span>
        <span class="mq"><button type="button" data-m="${n}" data-g="${id}" data-q="${q-10}" aria-label="10 fewer">−10</button><button type="button" data-m="${n}" data-g="${id}" data-q="${q-1}" aria-label="One fewer">−</button>
        <input type="number" min="0" inputmode="numeric" value="${q}" data-m="${n}" data-g="${id}" aria-label="${GOODS[id].name} on board">
        <button type="button" data-m="${n}" data-g="${id}" data-q="${q+1}" aria-label="One more">+</button><button type="button" data-m="${n}" data-g="${id}" data-q="${q+10}" aria-label="10 more">+10</button></span>
        <span class="ms dim">of ${fmt(Math.floor(S.goods[id]||0))}</span></div>`;}).join('')||'<div class="dim small">Nothing in stock to send yet.</div>';
    const value=GOOD_IDS.reduce((s,id)=>s+(p[id]||0)*price(id,v.kind),0);
    return `<div class="man${v.state==='stuck'?' bad':''}"><div class="mh"><b>${nm}</b><span class="cap"><i style="width:${(on/cap*100).toFixed(0)}%"></i></span><span class="dim">${on} / ${cap} on board</span></div>
      ${v.state==='stuck'?`<div class="small" style="color:var(--ember)">${vehicleLine(v)}</div>`:''}${rows}
      <div class="mf"><button type="button" class="chip" data-fill="${n}">Load what orders want</button><button type="button" class="chip" data-clear="${n}"${on?'':' disabled'}>Clear</button>
      <span class="dim small">${on?`worth ~${fmt(value)} scales`:''}</span><button type="button" class="go" data-go="${n}"${on&&v.state!=='stuck'?'':' disabled'}>Go ›</button></div></div>`;}).join('')||'<p class="dim">No trading posts or jetties yet. Build them from Build → Work &amp; trade.</p>';
  const ord=o=>`<li class="${o.contract?'contract':''}"><div>${o.contract?'<span class="ct">Contract</span> ':''}<b>${o.regionName}</b> wants <b>${fmt(o.qty)} ${GOODS[o.good].name.toLowerCase()}</b> <span class="dim">by ${o.route==='north'?'wagon':'barge'}${o.contract?`, ${o.why}`:''}</span></div><div class="ob"><i style="width:${(o.got/o.qty*100).toFixed(0)}%"></i></div><div class="dim">${fmt(o.got)}/${fmt(o.qty)} · pays +${fmt(o.reward)} scales${o.contract?' and a crate · filled over many trips':''}</div></li>`;
  const os=(S.orders||[]).filter(o=>!o.contract).map(ord).join(''),cs=(S.orders||[]).filter(o=>o.contract).map(ord).join('');
  const html=`<h4>Orders from along the river</h4><ul class="os">${os}</ul>${cs?`<h4>Contracts</h4><ul class="os">${cs}</ul>`:''}
    <h4>Load and send</h4><p class="dim small">Nothing leaves until you say Go. Put on board what the orders need (or anything else to sell), then send it off. The load is remembered for next time.</p>${man}
    <h4>Your goods</h4><table><thead><tr><th>Goods</th><th class="n">Stock</th><th class="n">Made</th><th class="n">Wagon · barge</th><th title="Markets won’t sell below this">Keep back</th></tr></thead><tbody>${g}</tbody></table>`;
  if(html!==lastTradeHTML){lastTradeHTML=html;body.innerHTML=html;}
}
$('upLine').title='Crews bring fish in 30% faster per level';$('upBait').title='Rice and song left at the water: fish arrive and take the line 25% more often per level';
$('upLine').addEventListener('click',()=>{if(spend(cost.line())){S.lineLv++;log(`Braided lines, level ${S.lineLv}. Crews bring fish in faster.`);refreshUI();save();}});
$('upBait').addEventListener('click',()=>{if(spend(cost.bait())){S.baitLv++;log(`Offerings, level ${S.baitLv}. Fish come to the banks more often.`);refreshUI();save();}});
function toggleCodex(){const c=$('codex');c.hidden=!c.hidden;if(!c.hidden){renderCodex();S.codexSeen=SPECIES.filter(s=>S.codex[s.id]).length;refreshUI();}}
$('btnCodex').addEventListener('click',toggleCodex);$('codexClose').addEventListener('click',toggleCodex);
const regionMap=initMap($('map'));
$('btnMap').addEventListener('click',()=>regionMap.toggle());
$('btnTrade').addEventListener('click',()=>toggleTrade());$('tradeClose').addEventListener('click',()=>toggleTrade());$('mapClose').addEventListener('click',()=>regionMap.toggle());
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

