// Deepvale · world/sea.js
// The journey down the river. Deepvale is the first valley; once its river runs clear (health 50), the Salt Mouth
// is charted, where the river meets the sea. Each valley keeps its own save and carries on while you're in the
// other one; the tapestry belongs to the journey and is shared. In the Salt Mouth the tide comes in and goes out.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= the journey: two valleys, one tapestry ================= */
const JOURNEY_KEY='deepvale-journey',VALLEY_KEY='deepvale-valley';
const SALT_OPEN_AT=50;
let J=(()=>{try{return JSON.parse(store.get(JOURNEY_KEY)||'null')||{open:{}};}catch(e){return {open:{}};}})();
J.open||={};
// the tapestry's threads and panels live with the journey. The first time, they come from the valley you're in.
function syncJourney(){
  if(J.threads===undefined){if(S.threads===undefined)return;J.threads=S.threads||0;J.threadsEver=S.threadsEver||0;J.weave={...(S.weave||{})};}
  S.threads=J.threads;S.threadsEver=J.threadsEver;S.weave=J.weave;saveJourney();}
function saveJourney(){if(noSave||store.get(WIPE_KEY))return;
  if(S.threads!==undefined){J.threads=S.threads;J.threadsEver=S.threadsEver;J.weave=S.weave;}
  (J.seen||={})[VALLEY]=Date.now();store.set(JOURNEY_KEY,JSON.stringify(J));}
const valleyOpen=id=>id==='deepvale'||!!J.open[id];
// going down (or back up) the river: this valley is saved and keeps going on its own; the other one opens
function travelTo(id){if(id===VALLEY||!valleyOpen(id))return;save();saveJourney();store.set(VALLEY_KEY,id);
  $('dv').classList.add('leaving');sfx('discover');setTimeout(()=>location.reload(),900);}
// the Salt Mouth is charted once Deepvale's river runs clear
function checkCharted(){if(SALT||J.open.salt||health<SALT_OPEN_AT||!started)return;
  J.open.salt=Date.now();saveJourney();sfx('discover');
  toast('The Salt Mouth','The river runs clear all the way to the sea now. Far downstream, where it meets the tide, the map has a new valley on it. Open the <b>Map</b> to travel there. Deepvale keeps going while you’re away.');
  $('toast').querySelector('.k').textContent='Charted';
  log('The Salt Mouth is charted: the river runs clear to the sea. Open the Map to travel there.','gold');}

/* ================= the tide ================= */
// two tides a day. 0 = high water, .5 = low water. The clock keeps turning while you're away, so the tide does too.
const TIDE_PER_DAY=2;
const tidePhase=()=>{const c=S.clock||{day:1,t:0};return ((c.day+c.t)*TIDE_PER_DAY)%1;};
const tideLevel=()=>.5+.5*Math.cos(tidePhase()*Math.PI*2); // 1 high, 0 low
const tideIs=w=>!w||!SALT||(w==='low'?tideLevel()<.3:tideLevel()>.7);
// minutes (of real time) until a given phase comes round
const tideMins=to=>{const p=tidePhase();return Math.max(1,Math.round(((to-p+1)%1)*DAY_LEN/TIDE_PER_DAY/60));};
const tideWord=()=>{const l=tideLevel();return l>.7?'High water':l<.3?'Low water':tidePhase()<.5?'Ebbing':'Flooding';};
let tideState=null,chartT=3;
function tideTick(dt){
  chartT-=dt;if(chartT<=0){chartT=5;checkCharted();}
  if(!SALT)return;
  waterLv=WATER_Y+(tideLevel()-.5)*2*TIDE_AMP;water.position.y=waterLv;UWATER.value=waterLv;lilies.position.y=waterLv-WATER_Y;
  // the tide turning is news in the village
  const st=tideIs('low')?'low':tideIs('high')?'high':'mid';
  if(st!==tideState){const was=tideState;tideState=st;if(!was||!started)return;
    if(st==='low')log(`Low water. The mudflats are bare: flounder lie in the shallows${S.finds?.some(f=>FINDS[f.type].tide==='low')?', and the gatherers can reach the mussel beds':''}.`);
    if(st==='high'){const k=SP.silverking,known=S.codex[k.id];log(`High water. ${known?'The Silver King':'Something bright and large'} may come in with the flood.`,'gold');}}
}
function tideHUD(){const el=$('sea');if(!el)return;el.hidden=!SALT;if(!SALT)return;
  const l=tideLevel(),toLow=tideMins(.5),toHigh=tideMins(0);
  el.innerHTML=barRow('tide','Tide',tideWord(),l,'#7fc4d8');
  const low=tideIs('low')?'Low water now':`Low water in ${toLow} min`,high=tideIs('high')?'High water now':`High water in ${toHigh} min`;
  el.title=`The tide turns twice a day. ${low}: the mudflats are bare, flounder come up, gatherers reach the mussel beds. ${high}: the Silver King and the Salt Mother only come in on the flood.`;}

/* ================= arriving in the Salt Mouth ================= */
// a new valley at the sea: a little to start with, no tour (you've done it), and a few lines to say what's different
function saltStart(){S.scales=90;S.goods.timber=24;S.goods.reeds=6;S.first=false;S.tourDone=true;}
function saltWelcome(){
  log('The river comes out of the hills here and opens to the sea. Everything you have woven into the tapestry came with you.','gold');
  setTimeout(()=>log('The tide comes in and goes out twice a day. Some fish only come at low water, some only at high (Tide, at the top).'),4000);
  setTimeout(()=>log('Deepvale keeps going while you’re here. The Map takes you back up the river whenever you like.'),8000);
}
// the map: which valley you're in, which ones are open, and the way between them
function mapState(){return {here:VALLEY,open:{deepvale:true,...J.open},onTravel:travelTo,lockText:{salt:`Not yet charted. When Deepvale’s health reaches ${SALT_OPEN_AT}, the river runs clear to the sea.`}};}
