// Deepvale · world/nature.js
// Seasons, weather, wildlife, the forest giants, and the tile overlay.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
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

