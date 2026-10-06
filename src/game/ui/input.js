// Deepvale · ui/input.js
// Mouse, touch and keyboard input, and placement previews.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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
  if(v.state==='load')return `${nm} at home · ${trade.planned(v)} / ${capacity(v.kind,v.home)} on board, waiting for Go`;
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
      const names={clear:'Clear land',dig:r.restore?'Restore the old channel':'Dig a new channel',hire:'Hire fisher',move:'Move fisher here',hut:r.restyle?`Restyle as ${STYLES[S.hutStyle].name.toLowerCase()}`:`Build a ${STYLES[S.hutStyle].name.toLowerCase()} hut`,road:r.lift?'Lift this road':'Lay road',bridge:'Build a bridge',pave:`Pave with ${PAVES[S.pave].name.toLowerCase()}`,remove:'Remove',scout:'Send a crow',relocate:relocK>=0?`Move the ${plotName(relocK).toLowerCase()} here`:'Move'};
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
          html+=`<div class="dim">${T} tale${T===1?'':'s'} told · each pilgrim leaves ~${fmt(taleGift(k))} scales</div>`+(nx?`<div class="dim">Grows again at ${nx} tales</div>`:'')+(on?'':'<div class="bad">Join it to the Pilgrim Way by road so pilgrims can find it</div>');}
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
function setTool(t){if(t!=='relocate')relocK=-1;tool=t;decoMark.visible=false;selected=null;selRing.visible=false;setPreview([]);tip.style.display='none';
  document.querySelectorAll('.tool').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t||(b.dataset.tool==='build'&&(t.startsWith('b:')||t==='pave'||t==='scout')))));
  document.querySelectorAll('#drawer .item').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));updateMarks();}
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tool==='build'){toggleDrawer();return;}setTool(b.dataset.tool);}));
function updateMarks(){
  const useTool=selected?'move':tool;let n=0;
  if(useTool!=='look'){for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){{const r=canDo(useTool,i,j);if(!r.ok||r.lift)continue;}const c=tileC(i,j);const t=tiles[idx(i,j)];
    p4.set(c.x,(t===WATER?WATER_Y:heightAt(c.x,c.z))+.04,c.z);m4.makeTranslation(p4.x,p4.y,p4.z);marks.setMatrixAt(n++,m4);}}
  marks.count=n;marks.instanceMatrix.needsUpdate=true;
}

