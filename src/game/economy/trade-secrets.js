// Deepvale · economy/trade-secrets.js
// Trade hookup, forest secrets and landmarks.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= trade ================= */
const trade=makeTrade({scene,props,village,tiles,builds,isLive:k=>isLiveK(k),S,
  capacity:(k,h)=>capacity(k,h),speed:k=>vSpeed(k)*debugSpeed.trade,price:(g,k)=>price(g,k),paveSpeed:k=>PAVES[S.meta[k]?.pave||'dirt'].speed,
  onDepart(v,n){if(!started)return;sfx('cart');S.shipments++;wishEvent('ship',{n});},
  onReturn(v,rep){
    const total=rep.silver+rep.bonus;const p=v.mesh.position;
    if(total>0){earnSilver(total,p.x,p.z);sfx('coins');}
    const where=v.kind==='wagon'?'The wagon is back from up the Way':'The barge is back from downriver';
    log(`${where}: ${rep.lines.map(l=>`${l.q} ${GOODS[l.g].name.toLowerCase()}`).join(', ')} sold for ${fmt(rep.silver)} silver.`,'gold');
    for(const o of rep.done){log(`${o.regionName} got its ${GOODS[o.good].name.toLowerCase()}. +${fmt(o.reward)} silver, and a crate.`,'gold');queueCrate({source:o.regionName,kind:'mixed'});}
    if(S.shipments===1&&!rep.done.length)queueCrate({source:'your first shipment',kind:'mixed'});
    trade.topUpOrders();refreshUI();save();}});

/* ================= forest secrets ================= */
let secrets=[];const secretAt={};
function pristineTiles(){const t=new Uint8Array(GW*GH);initTiles(t);return t;}
// room round a landmark: wild, and well inside the valley's outline (no edge tile within 6)
function lmClear(k){const i=k%GW,j=(k/GW)|0;if(tiles[k]!==WILD)return false;for(let b=-6;b<=6;b++)for(let a=-6;a<=6;a++){const ni=i+a,nj=j+b;if(!inGrid(ni,nj)||tiles[idx(ni,nj)]===RIM)return false;}return true;}
function initSecrets(){
  if(!S.seed)S.seed=1+Math.floor(Math.random()*2**30);
  secrets=makeSecrets(S.seed,pristineTiles(),tiles);
  // landmarks stay where they were first placed, whatever happens to the forest later
  const LM=['temple','elder','tower','gate'];
  // a stored landmark that ended up at the valley's edge (an older save, before the outline) moves somewhere it can be seen
  if(S.lm)for(const [type,k] of Object.entries(S.lm)){if(S.found.includes(k))continue;if(!lmClear(k)){const fresh=secrets.find(x=>x.type===type);if(fresh)S.lm[type]=fresh.k;else delete S.lm[type];}}
  if(S.lm)secrets=secrets.filter(s=>!LM.includes(s.type)).concat(Object.entries(S.lm).map(([type,k])=>({type,k,i:k%GW,j:(k/GW)|0,r:.5})));
  else S.lm=Object.fromEntries(secrets.filter(s=>LM.includes(s.type)).map(s=>[s.type,s.k]));
  secrets=secrets.filter(s=>tiles[s.k]===WILD||S.found.includes(s.k)||(LM.includes(s.type)&&builds[s.k]!==NONE));
  S.drops=(S.drops||[]).filter(d=>tiles[d.k]===WILD&&!S.found.includes(d.k)&&!secrets.some(s=>s.k===d.k));secrets.push(...S.drops);
  for(const s of secrets){secretAt[s.k]=s;if(s.type==='clay')deposit[s.k]=1;}
  const pt=pristineTiles();oldCh.set(makeChannels(S.seed,pt,S.legacyCh));wild0=pt.reduce((a,t)=>a+(t===WILD?1:0),0);
  trees.forEach((t,n)=>{if(t.tile>=0&&oldCh[t.tile]&&hash2(n*.37,t.tile*.11)<.7)t.gone=true;}); // the dry beds are only scrub
  for(const s of secrets)if(oldCh[s.k])oldCh[s.k]=0;
  placeLandmarks();
}
let wild0=1;
/* ---- landmarks you can see before you find them: the Elder Cedar over the canopy, the Lantern Tower's top ---- */
const landmarkMeshes=new Map();
// before it's found, a landmark stands in the forest as a shadow of itself: dark, dithered, thinning toward the top like
// something half-seen through the trees. Its lights (runes, lanterns) show faintly through.
const SHADE_V=`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const SHADE_F=`uniform float uBot,uTop,uLum,uTime;uniform vec3 uEmi;varying vec3 vW;
  float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}float bayer(vec2 a){return b2(.5*a)*.25+b2(a);}
  void main(){float t=clamp((vW.y-uBot)/max(.01,uTop-uBot),0.,1.);
    float a=mix(.97,.4,smoothstep(.15,1.,t))*(.92+.08*sin(uTime*.7+vW.x*1.7+vW.z*1.3));
    if(bayer(gl_FragCoord.xy)>=a)discard;
    vec3 c=mix(vec3(.01,.018,.022),vec3(.035,.05,.05),uLum)+uEmi*.35; // linear: very dark
    gl_FragColor=vec4(c,1.);}`;
const shadeU={uTime:{value:0},uPx:{value:new THREE.Vector2(.004,.006)}};
// a soft white outline round the silhouette: an inflated back-face shell, pushed out a couple of screen pixels.
// A depth-only copy of the shape goes down first, so the shell only shows outside the silhouette, never through its dither.
const HULL_V=`uniform vec2 uPx;void main(){vec4 c=projectionMatrix*modelViewMatrix*vec4(position,1.0);vec3 n=normalize(normalMatrix*normal);
  vec2 d=length(n.xy)>1e-3?normalize(n.xy):vec2(0.);c.xy+=d*uPx*1.6*c.w;gl_Position=c;}`;
const hullMat=new THREE.ShaderMaterial({vertexShader:HULL_V,fragmentShader:`void main(){gl_FragColor=vec4(1.,1.,1.,.2);}`,uniforms:{uPx:shadeU.uPx},side:THREE.BackSide,transparent:true,depthWrite:false});
const maskMat=new THREE.MeshBasicMaterial({colorWrite:false,transparent:true});
function shadowize(m){m.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(m),bot={value:bb.min.y},top={value:bb.max.y};
  const parts=[];m.traverse(o=>{if(o.isMesh)parts.push(o);});parts.forEach(o=>{const src=o.material,col=src.color||new THREE.Color('#888'),emi=src.emissive&&src.emissiveIntensity>.5?src.emissive.clone().multiplyScalar(Math.min(1.5,src.emissiveIntensity)):new THREE.Color(0,0,0);
    o.material=new THREE.ShaderMaterial({vertexShader:SHADE_V,fragmentShader:SHADE_F,uniforms:{uBot:bot,uTop:top,uTime:shadeU.uTime,uLum:{value:Math.min(1,col.r*.3+col.g*.5+col.b*.2)},uEmi:{value:emi}},transparent:true});o.castShadow=false;o.receiveShadow=false;o.renderOrder=12;
    for(const [mt,ro] of [[maskMat,10],[hullMat,11]]){const c=new THREE.Mesh(o.geometry,mt);c.renderOrder=ro;o.add(c);}});}
function placeLandmarks(){for(const [,m] of landmarkMeshes)scene.remove(m);landmarkMeshes.clear();
  for(const s of secrets){if(S.found.includes(s.k)||tiles[s.k]!==WILD)continue;const m=props.landmark(s.type,s.k);if(!m)continue;const c=tileC(s.i,s.j);
    m.position.set(c.x,heightAt(c.x,c.z)-.02,c.z);scene.add(m);shadowize(m);landmarkMeshes.set(s.k,m);
    trees.forEach(t=>{if(Math.hypot(t.x-c.x,t.z-c.z)<({tower:.75,temple:.9,gate:.8}[s.type]||.45))t.gone=true;});}updateTrees();}
function hideLandmark(k){const m=landmarkMeshes.get(k);if(m){scene.remove(m);landmarkMeshes.delete(k);}}
// the tower's beam sweeps the valley at dusk and through the night, found or not
const beamMat=new THREE.MeshBasicMaterial({color:'#ffcf9a',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
const beam=new THREE.Mesh(new THREE.ConeGeometry(1.1,9,12,1,true).translate(0,-4.5,0).rotateZ(Math.PI/2),beamMat);beam.visible=false;scene.add(beam);
function updateBeam(dt,t){const tk=builds.indexOf(B.TOWER),s=tk>=0?null:secrets.find(x=>x.type==='tower'&&!S.found.includes(x.k));
  const k=tk>=0?tk:s?s.k:-1;if(k<0||dusk<.15){beam.visible=false;return;}const c=tileC(k%GW,(k/GW)|0);
  beam.visible=true;beam.position.set(c.x,heightAt(c.x,c.z)+2.1,c.z);beam.rotation.y=t*.45;beamMat.opacity=clamp((dusk-.15)*.5,0,.22)*(tk>=0?1.3:.8);}
let bellT=8;
function bellTick(dt){bellT-=dt;if(bellT>0)return;bellT=rand(26,48);const s=secrets.find(x=>x.type==='temple'&&!S.found.includes(x.k)&&hintVis.has(x.k));
  const tk=builds.indexOf(B.TEMPLE);const k=s?s.k:tk;if(k<0||!started)return;const c=tileC(k%GW,(k/GW)|0);soundAt('bell',c.x,c.z);
  for(let n=0;n<8;n++)sparkle(c.x+Math.cos(n/8*6.28)*.6,1.2,c.z+Math.sin(n/8*6.28)*.6,'#ffe9a0');}
const hintVis=new Set();
// old chests surface at the forest's edge every few minutes, so there is always something to look for
function dropChest(){
  if((S.drops||[]).length>=2)return false;
  const cand=[];for(let k=0;k<GW*GH;k++){if(tiles[k]!==WILD||secretAt[k]||busy.has(k))continue;const i=k%GW,j=(k/GW)|0;let dmin=9;
    for(let b=-5;b<=5;b++)for(let a=-5;a<=5;a++){const ni=i+a,nj=j+b;if(inGrid(ni,nj)&&tiles[idx(ni,nj)]!==WILD)dmin=Math.min(dmin,Math.max(Math.abs(a),Math.abs(b)));}
    if(dmin>=2&&dmin<=5)cand.push(k);}
  if(!cand.length)return false;const k=cand[Math.floor(Math.random()*cand.length)];
  const d={type:'chest',i:k%GW,j:(k/GW)|0,k,r:Math.random()};S.drops.push(d);secrets.push(d);secretAt[k]=d;updateHintVis();
  log('Something glints at the edge of the forest: an old chest, half sunk in the moss. Send a crow, or clear the tile.','gold');return true;}
function dropTick(dt){S.dropT=(S.dropT||0)+dt;if(S.dropT<(S.dropNext||150))return;S.dropT=0;S.dropNext=200+Math.random()*160;dropChest();}
function updateHintVis(){
  hintVis.clear();const R=has('quill')?11:7;const tw=builds.indexOf(B.TOWER);
  const owl=S.owlUntil&&((S.clock?.day||1)+(S.clock?.t||0))<S.owlUntil;
  for(const s of secrets){if(S.found.includes(s.k)||tiles[s.k]!==WILD)continue;let near=owl||SECRET_TYPES[s.type].big||(tw>=0&&Math.hypot(s.i-tw%GW,s.j-((tw/GW)|0))<=14);
    for(let b=-R;b<=R&&!near;b++)for(let a=-R;a<=R;a++){const ni=s.i+a,nj=s.j+b;if(inGrid(ni,nj)&&tiles[idx(ni,nj)]!==WILD){near=true;break;}}
    if(near||debugFlags.allHints)hintVis.add(s.k);}
  syncBirds();
}
const birds=[];
function syncBirds(){
  for(const b of birds)scene.remove(b.g);birds.length=0;
  for(const s of secrets){if(!hintVis.has(s.k)||SECRET_TYPES[s.type].hint!=='birds')continue;const c=tileC(s.i,s.j);
    for(let n=0;n<3;n++){const g=props.bird();scene.add(g);birds.push({g,cx:c.x,cz:c.z,r:rand(.5,1.1),a:rand(0,6.28),w:rand(.5,.9)*(Math.random()<.5?1:-1),y:rand(1.7,2.3),ph:rand(0,6)});}}
}
let hintT=0;
function updateHints(dt,t){
  for(const b of birds){b.a+=b.w*dt;b.g.position.set(b.cx+Math.cos(b.a)*b.r,b.y+Math.sin(t*.7+b.ph)*.1,b.cz+Math.sin(b.a)*b.r);b.g.rotation.y=-b.a+(b.w>0?0:Math.PI);
    const fl=Math.sin(t*9+b.ph)*.5;b.g.userData.l.rotation.z=fl;b.g.userData.r.rotation.z=-fl;}
  if(stillTiles.length&&Math.random()<dt*.8){const k=stillTiles[Math.floor(Math.random()*stillTiles.length)],c=tileC(k%GW,(k/GW)|0);sparkle(c.x+rand(-.4,.4),WATER_Y+rand(.15,.4),c.z+rand(-.4,.4),Math.random()<.5?'#6fe0d0':'#b0f070');}
  const ct=S.clock?.t||0;
  if((ct<.1||ct>.97)&&started&&Math.random()<dt*6){const c=comps[0];if(c){const k=c.tiles[Math.floor(Math.random()*c.tiles.length)],p=tileC(k%GW,(k/GW)|0);wisps.emit(p.x+rand(-.4,.4),WATER_Y+.05,p.z+rand(-.4,.4),'mist');}}
  if(night>.15&&started&&Math.random()<dt*10*night){const i=Math.floor(Math.random()*GW),j=Math.floor(Math.random()*GH),k=idx(i,j);
    if(tiles[k]!==WATER&&(nb8(i,j,WATER)||nb8(i,j,WILD))){const p=tileC(i,j);sparkle(p.x+rand(-.5,.5),rand(.25,.8),p.z+rand(-.5,.5),Math.random()<.7?'#d8ff7a':'#fff0a0');}}
  hintT-=dt;if(hintT>0)return;hintT=.35;
  for(const k of hintVis){const s=secretAt[k],c=tileC(s.i,s.j),h=SECRET_TYPES[s.type].hint;
    if(h==='smoke'&&Math.random()<.8)wisps.emit(c.x+rand(-.1,.1),.9,c.z+rand(-.1,.1),'smoke');
    else if(h==='glint'&&Math.random()<(s.type==='chest'?.7:.25))sparkle(c.x+rand(-.3,.3),rand(.6,1.1),c.z+rand(-.3,.3),'#fff0c0');
    else if(h==='mist'){if(Math.random()<.6)wisps.emit(c.x+rand(-.6,.6),.3+Math.random()*.5,c.z+rand(-.6,.6),'mist');if(Math.random()<.15)sparkle(c.x+rand(-.4,.4),rand(.4,1),c.z+rand(-.4,.4),'#9ff0d0');}
    else if(h==='bell'){if(Math.random()<.2)sparkle(c.x+rand(-.5,.5),rand(.9,1.5),c.z+rand(-.5,.5),'#ffe9a0');}
    else if(h==='light'){if(Math.random()<.5)sparkle(c.x+rand(-.4,.4),rand(.8,1.4),c.z+rand(-.4,.4),'#ffe9a0');if(Math.random()<.3)wisps.emit(c.x,.9,c.z,'mist');}}
}
function revealAt(k){
  const s=secretAt[k];if(!s||S.found.includes(k))return;S.found.push(k);hintVis.delete(k);syncBirds();
  const c=tileC(s.i,s.j);for(let n=0;n<14;n++)sparkle(c.x+rand(-.4,.4),rand(.2,.8),c.z+rand(-.4,.4),'#ffe9bf');sfx('discover');
  const T={
    hermit:()=>{toast('A hermit’s camp','Someone has lived out here for years. They would come down to the village, if you asked the right one.');queueCrate({source:'a hermit’s camp',kind:'keeper'});},
    cache:()=>{toast('A forgotten cache','Oilcloth and rope around a wooden box. It has waited a long time.');queueCrate({source:'a forgotten cache',kind:'mixed'});},
    blueprint:()=>{const left=BLUEPRINTS.filter(b=>!unlocked(b.id));if(!left.length){queueCrate({source:'an old workshop',kind:'mixed'});return;}
      const b=left[Math.floor(Math.random()*left.length)];S.unlocked[b.id]=true;renderDrawer();toast('An old workshop',`Drawings pinned to the wall, still legible: <b>${b.name}</b>. You can build them now.`);},
    bones:()=>{builds[k]=B.BONES;const v=Math.round(90*(1+S.found.length*.25));earn(v,c.x,c.z);toast('Giant’s bones',`Ribs as tall as a hut, grown over with moss. Something swam here before the river had a name. The village gathers <b>${fmt(v)} scales</b> from the moss.`);},
    stones:()=>{builds[k]=B.STONES;toast('Standing stones',`A ring of old stones. Another keeper can live in the valley now (<b>${keeperSlots()}</b> in all).`);renderKeepers();},
    shrine:()=>{builds[k]=B.SHRINE;toast('An old shrine','Candles still burn in it. Nobody admits to lighting them. Fish take the line more often within 3 tiles.');},
    clay:()=>{toast('A seam of red clay','A clay pit dug here would give three times as much.');},
    chest:()=>{S.drops=(S.drops||[]).filter(d=>d.k!==k);const left=BLUEPRINTS.filter(b=>!unlocked(b.id));
      if(left.length&&Math.random()<.7){const b=left[Math.floor(Math.random()*left.length)];S.unlocked[b.id]=true;renderDrawer();toast('An old chest',`Under the lid, wrapped in oilcloth: drawings for <b>${b.name}</b>. You can build them now.`);}
      else{toast('An old chest','Rope, oilcloth and something heavy inside.');queueCrate({source:'an old chest',kind:'mixed'});}},
    temple:()=>{builds[k]=B.TEMPLE;hideLandmark(k);toast('The Drowned Temple','Steps worn by water that left long ago, and a bell that still rings when the wind is right. The village hears it, and so do the fish: they take the line <b>15% more often</b> everywhere.');queueCrate({source:'the Drowned Temple',kind:'mixed'});},
    elder:()=>{builds[k]=B.ELDER;hideLandmark(k);toast('The Elder Cedar','The first tree of the valley. The woodcutters stand under it a long while without speaking. While it stands they cut <b>30% more</b>, everywhere.');},
    tower:()=>{builds[k]=B.TOWER;hideLandmark(k);toast('The Lantern Tower','A keeper’s tower from the days of the barges. Someone lights it again. Its beam shows what hides in the forest <b>within 14 tiles</b>, and draws more pilgrims down the Way.');},
    gate:()=>{builds[k]=B.GATE;hideLandmark(k);const v=Math.round(150*(1+S.found.length*.15));earn(v,c.x,c.z);toast('The Sunken Gate',`Two pillars and a lintel, carved with a stag, an owl and a whale, each bigger than the mountains behind them. The giants of the high country will wander past <b>twice as often</b> now. Moss scraped from it sheds <b>${fmt(v)} scales</b>.`);},
    grove:()=>{toast('An old cedar grove','Tall straight trunks. The woodcutters take <b>20 timber</b> from it.');},
  };
  // the bigger landmarks clear a little ground around themselves
  if(['temple','tower','gate'].includes(s.type)){for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const ni=s.i+a,nj=s.j+b;if(!inGrid(ni,nj))continue;const q=idx(ni,nj);if(tiles[q]===WILD&&!secretAt[q]){tiles[q]=LAND;fellTrees(q);}}worldChanged();}
  T[s.type]();if(['bones','stones','shrine','temple','elder','tower','gate'].includes(s.type)){buildsChanged();updateHintVis();}
  wishEvent('find');save();
}
function toast(title,body){const el=$('toast');el.innerHTML=`<div class="k">Found in the forest</div><h4>${title}</h4><p>${body}</p>`;el.classList.remove('on');void el.offsetWidth;el.classList.add('on');
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),7500);log(title+'.','gold');}

