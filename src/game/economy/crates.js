// Deepvale · economy/crates.js
// Keepers, blessings and crates, village wishes, named sets.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= keepers, boons, crates ================= */
const keeperSlots=()=>2+builds.reduce((s,b)=>s+(b===B.STONES?1:0),0);
const crateQ=[];let crateOpen=null;
// tackle: braided lines and offerings used to be bought on the toolbar; now they come in crates, a level at a time.
// The levels live where they always did (S.lineLv, S.baitLv), so a save keeps what it bought.
const TACKLE={
  line:{name:'Braided lines',max:6,per:30,chain:[['line','Lines'],['fish','Fish']],d:'Crews bring fish in faster.',lv:()=>S.lineLv||0,up:()=>{S.lineLv=(S.lineLv||0)+1;}},
  bait:{name:'Offerings',max:6,per:25,chain:[['bait','Offerings'],['fish','Fish']],d:'Rice and song left at the water: fish come to the banks and take the line more often.',lv:()=>S.baitLv||0,up:()=>{S.baitLv=(S.baitLv||0)+1;}},
};
function queueCrate(c){crateQ.push(c);S.crates++;if(!crateOpen)setTimeout(nextCrate,started?900:0);}
function crateCards(kind){
  if(kind==='showcase'){const pk=a=>a[Math.floor(Math.random()*a.length)];const k=pk(KEEPERS),b=pk(BOONS),p=pk(BLUEPRINTS),t=pk(Object.keys(TACKLE));
    return [{type:'boon',id:b.id,name:b.name,desc:b.desc},{type:'keeper',id:k.id,name:k.name,desc:k.desc,glyph:k.glyph},{type:'blueprint',id:p.id,name:p.name,desc:bpDesc(p)},
      {type:'tackle',id:t,name:TACKLE[t].name,desc:TACKLE[t].d},coinCard()];}
  if(kind==='treasure')return Object.keys(COINS).sort(()=>Math.random()-.5).slice(0,3).map(id=>coinCard(id));
  const n=has('quill')?4:3;const out=[];const used=new Set();
  const pools={
    keeper:()=>KEEPERS.filter(k=>!S.keepers.includes(k.id)&&!used.has('k'+k.id)).map(k=>({type:'keeper',id:k.id,name:k.name,desc:k.desc,glyph:k.glyph})),
    boon:()=>BOONS.filter(b=>boon(b.id)<b.max&&!used.has('b'+b.id)).map(b=>({type:'boon',id:b.id,name:b.name,desc:b.desc+(boon(b.id)?` (you have ${boon(b.id)})`:'')})),
    blueprint:()=>BLUEPRINTS.filter(b=>!unlocked(b.id)&&!used.has('p'+b.id)).map(b=>({type:'blueprint',id:b.id,name:b.name,desc:bpDesc(b)})),
    tackle:()=>Object.entries(TACKLE).filter(([id,t])=>t.lv()<t.max&&!used.has('t'+id)).map(([id,t])=>({type:'tackle',id,name:t.name,desc:t.d})),
  };
  for(let t=0;t<n;t++){
    let kinds=kind==='keeper'?['keeper']:['keeper','boon','boon','blueprint','tackle'];
    kinds=kinds.filter(k=>pools[k]().length);if(!kinds.length)kinds=['boon','blueprint','tackle','keeper'].filter(k=>pools[k]().length);if(!kinds.length)break;
    const kk=kinds[Math.floor(Math.random()*kinds.length)],pool=pools[kk]();const c=pool[Math.floor(Math.random()*pool.length)];
    used.add(c.type[0]+c.id);out.push(c);}
  // a mixed crate sometimes holds a treasure instead of one of its cards; an empty one always does
  if(kind!=='keeper'&&out.length>=3&&Math.random()<.4)out[out.length-1]=coinCard();
  if(!out.length)out.push(coinCard('scales'));
  return out;
}
// treasure: a heap of one currency, sized to how far along the valley is
// (sized up with PACING.treasure: crates come less often in the unhurried pace, so each one holds more)
const COINS={scales:{n:'A shoal’s worth of scales',a:c=>Math.round(120*(1+c*.25))},
  timber:{n:'A raft of timber',a:c=>20+6*c},reeds:{n:'A bundle of reeds',a:c=>20+6*c},clay:{n:'A cart of clay',a:c=>16+5*c},
  lanterns:{n:'A box of lanterns',a:c=>4+c},carvings:{n:'A chest of carvings',a:c=>4+c}};
function coinCard(id){if(id==='silver')id='scales';const ids=Object.keys(COINS);id=id||ids[Math.floor(Math.random()*ids.length)];const amt=Math.round(COINS[id].a(S.crates)*PACING.treasure);
  return {type:'coin',id,name:COINS[id].n,amt,desc:`+${fmt(amt)} ${label(id)}.`};}
// what a card shows besides its name: the change it makes, what it touches, and a live line about your valley
const BOON_UI={
  hands:{per:15,u:'%',chain:[['hire','Fishers'],['scales','Scales']],d:'Fishers bring fish in faster.'},
  sweet:{per:15,u:'%',chain:[['bait','Offerings'],['fish','Fish']],d:'Fish take the line more often.'},
  shine:{per:10,u:'%',chain:[['fish','Fish'],['scales','Scales']],d:'More scales from every fish met.'},
  pockets:{per:8,u:' more',chain:[['trade','Wagons & barges'],['scales','Scales']],d:'Wagons and barges carry more goods.'},
  wheels:{per:15,u:'%',chain:[['trade','Wagons & barges'],['scales','Scales']],d:'Wagons and barges travel faster.'},
  wood:{per:25,u:'%',chain:[['timber','Timber']],d:'Woodcutters bring in more timber.',good:'timber'},
  reed:{per:25,u:'%',chain:[['reeds','Reeds']],d:'Reed beds grow more reeds.',good:'reeds'},
  clay:{per:25,u:'%',chain:[['clay','Clay']],d:'Clay pits dig more clay.',good:'clay'},
  craft:{per:15,u:'%',chain:[['lanterns','Crafts'],['scales','Scales']],d:'Lanterns and carvings sell for more.'},
  hosts:{per:20,u:'%',chain:[['keeper','Pilgrims'],['scales','Scales']],d:'More pilgrims come down the Way, and they leave more in the tale box.'},
  reach:{per:1,u:' tile',chain:[['carvings','Statues'],['health','Charm']],d:'Statues, sheds, racks and charm reach one tile farther.'},
  tide:{per:15,u:' s',chain:[['tide','Good tide'],['scales','Scales']],d:'A good tide lasts longer and climbs higher.'},
};
// the parts of the valley a keeper or blueprint touches, read from its description
const SIG_WORDS=[[/pilgrim/i,'keeper','Pilgrims'],[/wagon|barge|trade/i,'trade','Trade'],[/reed/i,'reeds','Reeds'],[/clay/i,'clay','Clay'],[/timber|woodcut/i,'timber','Timber'],
  [/lantern/i,'lanterns','Lanterns'],[/carving|workshop|craft/i,'carvings','Crafts'],[/fish|reel|line/i,'fish','Fish'],[/scale/i,'scales','Scales'],[/silver|market|sell/i,'scales','Scales'],
  [/charm|flower|cherry|garden/i,'health','Charm'],[/hut|house|village|road|pave/i,'hut','Village'],[/keeper/i,'keeper','Keepers']];
// (several words can point at the same thing, e.g. "scales" and "market": each label shows once)
const sigsOf=t=>SIG_WORDS.filter(([re])=>re.test(t)).filter(([,,l],n,a)=>a.findIndex(x=>x[2]===l)===n).slice(0,3).map(([,ic,l])=>[ic,l]);
function cardInfo(cd){
  if(cd.type==='boon'){const U=BOON_UI[cd.id]||{per:0,u:''},l=boon(cd.id),mx=BOON[cd.id].max,step=(a,b)=>(1+a*U.per/100)/(1+b*U.per/100);let text='';
    if(U.good){const r=goodRate(U.good);text=r?`${GOODS[U.good].name}: ${r.toFixed(1)} → ${(r*step(l+1,l)).toFixed(1)} a minute`:`No ${GOODS[U.good].name.toLowerCase()} made yet`;}
    else if(cd.id==='hands'||cd.id==='sweet'||cd.id==='shine')text=`${fishersState.length} fisher${fishersState.length===1?'':'s'} on the banks`;
    else if(cd.id==='pockets'){const c=capacity('wagon');text=`A wagon carries ${c} → ${c+8}`;}
    else if(cd.id==='wheels'){const n=trade.vehicles.length;text=n?`${n} wagon${n===1?'':'s'} and barge${n===1?'':'s'} out there`:'No wagons or barges yet';}
    else if(cd.id==='craft'){const p=price('lanterns','wagon');text=`A lantern sells for ${p.toFixed(0)} → ${(p*step(l+1,l)).toFixed(0)} scales`;}
    else if(cd.id==='hosts'){const k=builds.indexOf(B.TALEHALL);text=k>=0?`Each pilgrim leaves ~${fmt(taleGift(k))} → ${fmt(taleGift(k)*step(l+1,l))} scales`:'Pilgrims come to the Tale House';}
    else if(cd.id==='tide')text=`A good tide lasts ${50+15*l} s → ${50+15*(l+1)} s`;
    else if(cd.id==='reach')text='Every statue, shed and rack';
    return {value:{from:l?`+${l*U.per}${U.u}`:null,to:`+${(l+1)*U.per}${U.u}`},chain:U.chain,desc:U.d||BOON[cd.id].desc,foot:{pips:[l,mx],text}};}
  if(cd.type==='tackle'){const T=TACKLE[cd.id],l=T.lv(),n=fishersState.length;
    return {value:{from:l?`+${l*T.per}%`:null,to:`+${(l+1)*T.per}%`},chain:T.chain,desc:T.d,
      foot:{pips:[Math.min(l,T.max),T.max],text:cd.id==='line'?`${n} fisher${n===1?'':'s'} on the banks`:'Every bank in the valley'}};}
  if(cd.type==='keeper')return {desc:cd.desc,chain:sigsOf(cd.desc),foot:{text:`Cottages: ${S.keepers.length} of ${keeperSlots()} taken`}};
  if(cd.type==='blueprint'){const b=BLUEPRINTS.find(x=>x.id===cd.id);return {value:b?.kind==='build'?'A new building':b?.kind==='style'?'A new hut style':'A new paving',chain:[['build','Build'],...sigsOf(cd.desc).slice(0,2)],desc:cd.desc.replace(/^Blueprint\.\s*/,''),foot:{text:'Yours to build once chosen'}};}
  if(cd.type==='coin')return {value:`+${fmt(cd.amt)}`,emblem:emblem(cd.id),desc:{scales:'The valley’s one money: for building, hiring and everything else.',timber:'For building, and for the wagons north.',
      reeds:'For lanterns, and for the wagons north.',clay:'For lanterns and statues.',lanterns:'Ready for the wagons and barges.',carvings:'Ready for the wagons and barges.'}[cd.id],foot:{text:`You have ${fmt(have(cd.id))} ${label(cd.id)}`}};
  if(cd.type==='silver')return {emblem:emblem('scales'),value:cd.desc.replace(/ (silver|scales)\.$/,''),chain:[['scales','Scales']],desc:'A purse left for the village.',foot:{text:'Straight into the purse'}};
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
  if(cd.type==='tackle'){const T=TACKLE[cd.id];T.up();log(`${T.name}, level ${T.lv()}. ${T.d}`,'gold');}
  if(cd.type==='blueprint'){S.unlocked[cd.id]=true;log(`Blueprint: ${cd.name}. Find it in Build.`,'gold');renderDrawer();}
  if(cd.type==='silver'){earn(100+50*S.crates);}
  if(cd.type==='coin'){if(cd.id==='silver'||cd.id==='scales'){S.scales+=cd.amt;S.earned+=cd.amt;}else S.goods[cd.id]=(S.goods[cd.id]||0)+cd.amt;log(`${cd.name}: +${fmt(cd.amt)} ${label(cd.id)}.`,'gold');}
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
  if(w.have>=w.n){log(`The village’s wish came true: ${w.text.toLowerCase()}.`,'gold');S.wishesDone++;S.wish=null;queueCrate({source:'the village, with thanks',kind:'mixed'});setTimeout(()=>{if(!S.wish)newWish();},rand(...PACING.wishPause)*1000);}
  renderWish();
}
// the wish shows in the Requests list with the orders (renderRequests in ui/hud.js)
function renderWish(){renderRequests();if(!$('trade').hidden)renderTrade();}

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

