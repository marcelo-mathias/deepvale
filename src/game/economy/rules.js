// Deepvale · economy/rules.js
// Costs and actions (clear, dig, build), falling trees, crows, auras and production, valley health, villages and pilgrims.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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
  if(tool==='relocate'){const why=relocRule(i,j);return why?{ok:false,why}:{ok:true,c:0};}
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
  if(tool==='relocate'){relocate(i,j);setTool('look');}
  else if(tool==='scout'){if(!spend(r.c,'silver'))return false;sendCrow(k);sfx('pluck');log('A crow lifts off from the village and heads for the trees.');}
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

