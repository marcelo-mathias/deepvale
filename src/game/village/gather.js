// Deepvale · village/gather.js
// Finds in the forest: a fallen cedar, a red clay seam, a wild reed marsh, wild hives. They are part of the valley
// from the start and slowly fill up. Nothing happens until you clear a way to one and lay a road that joins it to
// your huts; then gatherers walk out, pick up a load and carry it home. The game never changes the land for you.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= finds and gatherers ================= */
// rate: what gathers in a minute · cap: the most a find holds · carry: one gatherer's load
const FINDS={
  cedar:{name:'A fallen cedar',good:'timber',rate:1.5,cap:30,carry:10,col:'#b98552',line:'An old cedar the wind brought down. Timber, for whoever comes for it.'},
  seam: {name:'A red clay seam',good:'clay',  rate:1,  cap:20,carry:8, col:'#c8744a',line:'Red clay showing through the roots, close to the water.',water:true},
  marsh:{name:'A wild reed marsh',good:'reeds',rate:1.5,cap:30,carry:10,col:'#c9c071',line:'Reeds that nobody planted, in a wet hollow of the forest.',water:true},
  hives:{name:'Wild hives',good:'scales',rate:8,cap:160,carry:50,col:'#e7b54a',line:'Wild bees in an old oak. Their honey sells to the pilgrims, for scales.'},
  // the Salt Mouth
  drift:{name:'A driftwood bank',good:'timber',rate:1.5,cap:30,carry:10,col:'#c9b597',line:'Whole trees the river carried down from the hills, bleached grey by the sun.',water:true},
  mussels:{name:'A mussel bed',good:'scales',rate:10,cap:180,carry:60,col:'#6f86b8',line:'Black shells on the rocks, only reachable at low water. The pilgrims pay well for them.',water:true,tide:'low'},
  saltmarsh:{name:'A salt marsh',good:'reeds',rate:1.5,cap:30,carry:10,col:'#b7b56c',line:'Sea lavender and tall grass where the tide spreads out. Reeds, for whoever comes.',water:true},
};
const FIND_ORDER=SALT?['drift','mussels','saltmarsh','seam','drift']:['cedar','hives','seam','marsh','cedar'];
const findMeshes=new Map();
const gatherSlots=()=>Math.min(4,1+Math.floor(linkedHuts().length/3));

// a valley gets its finds once: forest tiles a little way out from the cleared land, apart from each other
function placeFinds(){
  if(S.finds)return;S.finds=[];
  const nearLand=k=>{const i=k%GW,j=(k/GW)|0;let d=99;for(let b=-9;b<=9;b++)for(let a=-9;a<=9;a++){const ni=i+a,nj=j+b;if(inGrid(ni,nj)&&tiles[idx(ni,nj)]===LAND)d=Math.min(d,Math.max(Math.abs(a),Math.abs(b)));}return d;};
  const nearWater=k=>{const i=k%GW,j=(k/GW)|0;for(let b=-3;b<=3;b++)for(let a=-3;a<=3;a++)if(inGrid(i+a,j+b)&&tiles[idx(i+a,j+b)]===WATER)return true;return false;};
  const cand=[];for(let k=0;k<GW*GH;k++){if(tiles[k]!==WILD||secretAt[k])continue;const i=k%GW,j=(k/GW)|0;if(i<3||j<3||i>GW-4||j>GH-4)continue;const d=nearLand(k);if(d>=3&&d<=8)cand.push({k,d,w:nearWater(k)});}
  for(const type of FIND_ORDER){const ok=cand.filter(c=>(!FINDS[type].water||c.w)&&S.finds.every(f=>Math.hypot(f.k%GW-c.k%GW,((f.k/GW)|0)-((c.k/GW)|0))>=7));
    if(!ok.length)continue;const c=ok[Math.floor(Math.random()*ok.length)];S.finds.push({k:c.k,type,stock:FINDS[type].cap*.5,out:0});}
}
const findAt=k=>(S.finds||[]).find(f=>f.k===k);

// what each find looks like, standing in the trees
function findMesh(f){const g=new THREE.Group(),m=c=>rimMat({color:c},'#ffd9a8',.8),put=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);g.add(o);return o;};
  if(f.type==='cedar'){put(new THREE.CylinderGeometry(.07,.09,.9,6),m('#6e4a2c'),0,.08,0,0,.6,Math.PI/2);put(new THREE.CylinderGeometry(.1,.12,.14,7),m('#7a5634'),.36,.07,.24);
    for(let n=0;n<4;n++)put(new THREE.ConeGeometry(.09,.22,5),m('#3f5a34'),-.38+n*.06,.12,-.22+n*.05,0,0,1.2);}
  else if(f.type==='seam'){put(new THREE.IcosahedronGeometry(.22,0),m('#b45f3b'),0,0,0).scale.set(1.4,.45,1);put(new THREE.IcosahedronGeometry(.12,0),m('#c8744a'),.2,.04,.1).scale.set(1,.6,1);}
  else if(f.type==='drift'){for(let n=0;n<3;n++)put(new THREE.CylinderGeometry(.05,.065,.75-n*.15,6),m(['#bfb3a0','#a99c88','#d2c8b6'][n]),(n-1)*.08,.05+n*.05,(n-1)*.1,0,.4+n*1.1,Math.PI/2);
    put(new THREE.ConeGeometry(.05,.18,4),m('#a99c88'),.3,.08,.1,0,0,-1.1);}
  else if(f.type==='mussels'){put(new THREE.IcosahedronGeometry(.2,0),m('#6b6a62'),0,0,0).scale.set(1.3,.5,1);
    for(let n=0;n<11;n++){const a=n*2.3,r=.06+(n%3)*.06;put(new THREE.SphereGeometry(.035,5,3),m(n%2?'#1f2638':'#2d3850'),Math.cos(a)*r,.08,Math.sin(a)*r).scale.set(1.5,.6,.8);}}
  else if(f.type==='marsh'||f.type==='saltmarsh'){const salt=f.type==='saltmarsh';put(new THREE.CylinderGeometry(.3,.32,.02,8),m('#3f6f6a'),0,.01,0);for(let n=0;n<14;n++){const a=n*2.4,r=.08+(n%4)*.05,h=.14+(n%3)*.06;put(new THREE.BoxGeometry(.012,h,.012),m(salt&&n%4===0?'#a98ac8':['#98a857','#b9ae62','#7f9a4a'][n%3]),Math.cos(a)*r,h/2,Math.sin(a)*r);}}
  else{put(new THREE.CylinderGeometry(.02,.025,.32,5),m('#5a4028'),0,.16,0);put(new THREE.SphereGeometry(.07,7,5),m('#e2b04a'),0,.34,0).scale.set(1,1.2,1);put(new THREE.SphereGeometry(.05,7,5),m('#d39a3a'),.09,.26,.03).scale.set(1,1.2,1);}
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;}
function syncFinds(){
  for(const [k,g] of findMeshes)if(!findAt(k)){scene.remove(g);findMeshes.delete(k);}
  for(const f of S.finds||[]){if(findMeshes.has(f.k))continue;const c=tileC(f.k%GW,(f.k/GW)|0),g=findMesh(f);g.position.set(c.x,heightAt(c.x,c.z),c.z);g.rotation.y=(f.k*1.7)%6.28;scene.add(g);findMeshes.set(f.k,g);
    updateTrees([c.x-1,c.x+1,c.z-1,c.z+1]);} // clear the trees off the find's own tile: it stands in a small glade
}

// a find a road reaches, and the nearest hut on that road network to send someone from
function findRoute(f){const t={i:f.k%GW,j:(f.k/GW)|0};let best=null,bd=1e9;
  for(const h of linkedHuts()){const d=Math.hypot(h.i-t.i,h.j-t.j);if(d<bd&&village.roadBetween(h,t)){bd=d;best=h;}}return best?{home:best,t}:null;}
let gatherT=2,findRouteT=0;const findHome=new Map();
function gatherTick(dt){
  if(!S.finds)return;
  for(const f of S.finds){const F=FINDS[f.type];f.stock=Math.min(F.cap,f.stock+F.rate*dt/60*debugSpeed.prod);}
  // you cleared a find's tile: that was your choice, and what was there comes home with the crew
  for(const f of S.finds.slice())if(tiles[f.k]!==WILD){const F=FINDS[f.type],q=Math.floor(f.stock);if(q>0){if(F.good==='scales')earn(q);else S.goods[F.good]=(S.goods[F.good]||0)+q;}
    log(`${F.name} is gone: the crew cleared it${q>0?` and brought home ${fmt(q)} ${label(F.good)}`:''}.`,'gold');S.finds.splice(S.finds.indexOf(f),1);syncFinds();}
  findRouteT-=dt;if(findRouteT<=0){findRouteT=3;findHome.clear();for(const f of S.finds){const r=findRoute(f);if(r)findHome.set(f.k,r);}}
  gatherT-=dt;if(gatherT>0||!started)return;gatherT=2.5;
  if(village.gathererCount>=gatherSlots())return;
  const ready=S.finds.filter(f=>!f.out&&findHome.has(f.k)&&tideIs(FINDS[f.type].tide)&&f.stock>=Math.min(FINDS[f.type].carry,FINDS[f.type].cap*.5)).sort((a,b)=>b.stock/FINDS[b.type].cap-a.stock/FINDS[a.type].cap);
  const f=ready[0];if(!f)return;const F=FINDS[f.type],r=findHome.get(f.k);
  const ok=village.spawnGatherer(r.home,r.t,F.col,()=>{const q=Math.min(F.carry,Math.floor(f.stock));f.stock-=q;return q;},q=>{f.out=0;if(q<=0)return;
    const c=tileC(r.home.i,r.home.j);if(F.good==='scales')earn(q,c.x,c.z);else{S.goods[F.good]=(S.goods[F.good]||0)+q;popAt(c.x,c.z,`+${fmt(q)} ${label(F.good)}`);}});
  if(ok)f.out=1;
}
// while you were away: finds a road reaches were emptied as fast as they filled; the others filled up
function gatherAway(m){const got={};for(const f of S.finds||[]){const F=FINDS[f.type],add=F.rate*m;
  if(findRoute(f)){const q=Math.floor(Math.min(f.stock+add*awayPace(),F.cap+add*awayPace()));f.stock=0;if(q>0){if(F.good==='scales'){S.scales+=q;S.earned+=q;}else S.goods[F.good]=(S.goods[F.good]||0)+q;got[f.type]=(got[f.type]||0)+q;}}
  else f.stock=Math.min(F.cap,f.stock+add);}
  return got;}
// rings over the finds: how full they are, and whether a road reaches them yet
function findRings(want){if(!S.finds||view.z>70)return;
  for(const f of S.finds){const F=FINDS[f.type],key='f'+f.k;want.add(key);const el=ringEl(key,F.good);placeRing(el,f.k);const on=findHome.has(f.k),full=f.stock>=F.cap-.01;
    setRing(el,f.stock/F.cap,on?'find':'find off',1,`${F.name} · ${fmt(Math.floor(f.stock))} of ${F.cap} ${label(F.good)}${full?' (full)':''}. ${F.line} `+
      (on?`Gatherers come for it along the road${F.tide?`, at ${F.tide} water (${tideIs(F.tide)?'now':`in ${tideMins(F.tide==='low'?.5:0)} min`})`:''}.`:`Clear a way and lay a road from your huts to it, and gatherers will fetch it.`));}}
