// Deepvale · ui/tapestry.js
// The tapestry at the Tale House: the valley's lasting progress. Tales learned, landmarks found and contracts
// finished give threads; threads are woven into panels on a cloth, and what is woven stays for good.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= the tapestry ================= */
// Three rows. The first is open from the start; each later row opens once two panels of the row above are woven.
// Unwoven panels are a chalk pattern drawn on the cloth; woven ones are sewn in gold thread.
const WEAVE=[
  {id:'tide',     row:0,cost:1,ic:'tide',    name:'The Long Tide',        line:'A good tide lasts 15 seconds longer.'},
  {id:'plans',    row:0,cost:1,ic:'build',   name:'The Old Plans',        line:'A blueprint you don’t have yet, at once.'},
  {id:'wagons',   row:0,cost:2,ic:'trade',   name:'Deep Carts',           line:'Wagons and barges carry 8 more goods.'},
  {id:'pilgrims', row:0,cost:2,ic:'keeper',  name:'The Storyteller',      line:'15% more pilgrims come down the Way.'},
  {id:'cottage',  row:1,cost:3,ic:'hut',     name:'Another Cottage',      line:'Room for one more keeper.'},
  {id:'lofts',    row:1,cost:3,ic:'hire',    name:'Lofts in Every Hut',   line:'Every hut houses one more fisher.'},
  {id:'treasure', row:1,cost:3,ic:'order',   name:'Heavier Crates',       line:'Treasure cards hold a quarter more.'},
  {id:'watch',    row:1,cost:3,ic:'look',    name:'The Night Watch',      line:'While you’re away, the valley keeps 75% of its pace (not 60%).'},
  {id:'fourth',   row:2,cost:5,ic:'wish',    name:'A Fourth Card',        line:'Every crate offers one more card.'},
  {id:'night',    row:2,cost:4,ic:'moon',    name:'The Long Night',       line:'The valley keeps going for 12 hours while you’re away (not 8).'},
  {id:'builders', row:2,cost:4,ic:'builders',name:'The Builders’ Guild',  line:'One more builder, and room for one more.'},
  {id:'warden',   row:2,cost:6,ic:'fish',    name:'The Warden’s Thread',  line:'Every tale draws pilgrims twice as strongly.'},
];
const ROWS=['The first row','The second row','The third row'];
const woven=id=>!!(S.weave&&S.weave[id]);
const rowOpen=r=>r===0||WEAVE.filter(w=>w.row===r-1&&woven(w.id)).length>=2;
const awayPace=()=>woven('watch')?.75:.6;
const awayCap=()=>(woven('night')?12:8)*3600e3;

// threads come in from tales, landmarks and contracts
function gainThreads(n,why){if(n<=0)return;S.threads=(S.threads||0)+n;S.threadsEver=(S.threadsEver||0)+n;
  if(booted&&why)log(`${n===1?'A thread':n+' threads'} for the tapestry: ${why}.`,'gold');talesPulse();refreshTapestryHUD();if(!$('tapestry').hidden)renderTapestry();}
// a valley from before the tapestry starts with the threads it has already earned
function initThreads(){S.weave||={};if(S.threads!==undefined)return;
  const landmarks=[B.TEMPLE,B.ELDER,B.TOWER,B.GATE].filter(c=>builds.includes(c)).length;
  S.threads=allTales()+landmarks+(S.contractsDone||0);S.threadsEver=S.threads;
  if(S.threads>0)setTimeout(()=>log(`The Tale House has a tapestry now, and ${S.threads} thread${S.threads===1?'':'s'} waiting from the tales you already know. Click Tales at the top, or the Tale House.`,'gold'),3500);}
const cheapestOpen=()=>Math.min(...WEAVE.filter(w=>!woven(w.id)&&rowOpen(w.row)).map(w=>w.cost),Infinity);
function refreshTapestryHUD(){const d=$('talesDot');if(d)d.hidden=!((S.threads||0)>=cheapestOpen());}
function talesPulse(){const g=document.querySelector('.grp.lv');if(!g)return;g.classList.remove('pulse');void g.offsetWidth;g.classList.add('pulse');}

function weave(id){const w=WEAVE.find(x=>x.id===id);if(!w||woven(id)||!rowOpen(w.row))return;
  if((S.threads||0)<w.cost){sfx('no');return;}
  S.threads-=w.cost;S.weave[id]=true;
  if(id==='plans'){const left=BLUEPRINTS.filter(b=>!unlocked(b.id));if(left.length){const b=left[Math.floor(Math.random()*left.length)];S.unlocked[b.id]=true;log(`Woven into the cloth: the old plans for ${b.name}. Find it in Build.`,'gold');renderDrawer();}}
  log(`Woven into the tapestry: ${w.name}. ${w.line}`,'gold');
  computeEconomy();afterKeepers();refreshUI();save();
  // the panel stitches itself in, a stitch at a time
  const el=$('tpCloth').querySelector(`[data-w="${id}"]`);
  if(el){el.classList.add('stitching','woven');el.classList.remove('ready');for(let n=0;n<7;n++)setTimeout(()=>sfx('tick',n),n*140);setTimeout(()=>{sfx('set');renderTapestry();},1150);}
  else renderTapestry();
  $('tpThreads').textContent=S.threads;refreshTapestryHUD();
}

function renderTapestry(){
  $('tpThreads').textContent=S.threads||0;
  $('tpCloth').innerHTML=ROWS.map((nm,r)=>{const open=rowOpen(r),n=WEAVE.filter(w=>w.row===r-1&&woven(w.id)).length;
    return `<div class="tp-row${open?'':' shut'}"><div class="tp-rl"><span>${nm}</span><em>${open?'open':`weave ${2-n} more in the row above`}</em></div>`+
      WEAVE.filter(w=>w.row===r).map(w=>{const done=woven(w.id),ready=!done&&open&&(S.threads||0)>=w.cost;
        return `<button type="button" class="tp-p${done?' woven':''}${ready?' ready':''}${open||done?'':' shut'}" data-w="${w.id}"${done||!open?' aria-disabled="true"':''}>
          <span class="tp-m">${icon(w.ic)}</span><b>${w.name}</b><span class="tp-l">${w.line}</span>
          <span class="tp-c">${done?'Woven':`<i class="spool"></i>${w.cost} thread${w.cost===1?'':'s'}`}</span></button>`;}).join('')+'</div>';}).join('');
  $('tpCloth').querySelectorAll('.tp-p').forEach(b=>b.addEventListener('click',()=>{const w=WEAVE.find(x=>x.id===b.dataset.w);
    if(woven(w.id))return;if(!rowOpen(w.row)){sfx('no');return;}weave(w.id);}));
  $('tpEver').textContent=S.threadsEver||0;
}
function toggleTapestry(on){const el=$('tapestry');on=on??el.hidden;el.hidden=!on;if(on){renderTapestry();sfx('pick');}}
$('tpClose').addEventListener('click',()=>toggleTapestry(false));
$('tapestry').addEventListener('click',e=>{if(e.target===$('tapestry'))toggleTapestry(false);});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('tapestry').hidden){e.stopPropagation();toggleTapestry(false);}},true);
{const g=document.querySelector('.grp.lv');g.addEventListener('click',()=>toggleTapestry(true));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleTapestry(true);}});}
