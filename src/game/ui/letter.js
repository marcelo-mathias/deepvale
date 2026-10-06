// Deepvale · ui/letter.js
// "While you were away": coming back opens a letter from the village, telling what happened in a few lines,
// each with a small picture, then counting up what was earned. Written by offlineGain (core/save.js).
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= the letter from the village ================= */
let pendingLetter=null,letterTimers=[];
const plural=(n,one,many)=>n===1?one:(many||one+'s');
const awayWords=ms=>{const m=Math.round(ms/60e3);if(m<60)return `${m} ${plural(m,'minute')}`;const h=Math.round(m/6)/10;return h>=8?'the whole night':`${h%1?h.toFixed(1):h} ${plural(h,'hour')}`;};
const listAnd=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
// fish counted the way anglers say it: "two carp", "three koi", but "two reedlings"
const fishCount=(id,c)=>{const n=SP[id].name;return c===1?`a ${n}`:`${fmt(c)} ${/(koi|carp|sturgeon|showa)$/i.test(n)?n:n+'s'}`;};

// fish met while you were away: as often as they were met in the half hour before you left, at the same rate the
// scales use (60%). Only kinds already met: a first meeting is for you to see. Each counts in the codex, so tales grow.
function offlineMeets(ms,m){
  const left=Date.now()-ms,recent=(S.meets||[]).filter(([t,id])=>left-t<30*60e3&&S.codex[id]);
  const out={n:0,by:{},tales:[]};if(!recent.length)return out;
  const span=Math.max(5*60e3,left-recent[0][0]),rate=recent.length/(span/60e3);
  out.n=Math.min(300,Math.floor(rate*m*awayPace()));
  for(let q=0;q<out.n;q++){const id=recent[Math.floor(Math.random()*recent.length)][1];out.by[id]=(out.by[id]||0)+1;}
  for(const [id,c] of Object.entries(out.by)){const before=talesKnown(id);S.codex[id]=(S.codex[id]||0)+c;const after=talesKnown(id);if(after>before){out.tales.push({id,from:before,n:after});gainThreads(after-before);}}
  return out;
}
// a small picture for a fish: the codex thumbnail
const fishPic=id=>{const cv=document.createElement('canvas');cv.width=72;cv.height=24;drawThumb(cv,SP[id],true);return `<img class="lt-fish" src="${cv.toDataURL()}" alt="">`;};
const GOOD_LINE={timber:q=>`The woodcutters brought in ${fmt(q)} timber.`,reeds:q=>`The reed beds grew ${fmt(q)} reeds.`,clay:q=>`The clay pits gave up ${fmt(q)} clay.`};

// put the story together; it opens now if you're in the valley, or as soon as you step back in
function writeLetter(d){
  const lines=[];
  if(d.cal1.season!==d.cal0.season)lines.push({ic:icon('sun'),t:`${d.cal1.season} came to the valley while you were gone.`});
  else if(d.days>0)lines.push({ic:icon('sun'),t:`${d.days===1?'A day':d.days+' days'} went by, ${d.cal1.season.toLowerCase()} days, quiet and long.`});
  if(d.jobs)lines.push({ic:icon('builders'),t:`The crews finished the ${d.jobs===1?'job':d.jobs+' jobs'} you left them.`});
  if(d.met.n){const sp=Object.entries(d.met.by).sort((a,b)=>SP[b[0]].len-SP[a[0]].len);
    lines.push({ic:sp.slice(0,3).map(([id])=>fishPic(id)).join(''),wide:true,t:`We met ${listAnd(sp.map(([id,c])=>fishCount(id,c)))} at the banks, and let every one go.`});}
  {const T=d.met.tales;if(T.length===1&&T[0].n-T[0].from===1)lines.push({ic:icon('tales'),t:`A new tale of the ${SP[T[0].id].name} is told in the village now (${T[0].n} of 3).`});
   else if(T.length)lines.push({ic:icon('tales'),t:`New tales are told in the village now, of the ${listAnd(T.map(t=>SP[t.id].name))}. Pilgrims will come to hear them.`});}
  for(const [g,q] of Object.entries(d.made))lines.push({ic:emblemMini(g),t:GOOD_LINE[g]?GOOD_LINE[g](q):`${fmt(q)} ${GOODS[g].name.toLowerCase()} were made.`});
  if(linkedOf(B.TALEHALL).length)lines.push({ic:icon('keeper'),t:'Pilgrims came down the Way to hear the tales, and left scales in the box.'});
  if(!lines.length)lines.push({ic:icon('tide'),t:'The river ran on, and the village kept watch.'});
  const k=S.keepers.length?KEEPER[S.keepers[Math.floor(Math.random()*S.keepers.length)]]:null,v=villages[0]?.name||S.valleyName||'the village';
  pendingLetter={from:v,seal:(villages[0]?.name||S.valleyName||'Deepvale')[0],when:`${d.cal1.season}, day ${d.cal1.dom} · you were away ${awayWords(d.ms)}`,lines,sign:k?`${k.name}, for everyone in ${v}`:`Everyone in ${v}`,
    sums:[...(d.g>0?[['scales',d.g]]:[]),...Object.entries(d.made)]};
  if(started)setTimeout(showLetter,600);
}

function showLetter(){
  const L=pendingLetter;if(!L)return;pendingLetter=null;letterTimers.forEach(clearTimeout);letterTimers=[];
  const el=$('letter');el.hidden=false;el.classList.remove('done');
  $('ltSeal').textContent=(L.seal||'D').toUpperCase();$('ltWhen').textContent=L.when;$('ltFrom').textContent=`A letter from ${L.from}`;$('ltSign').textContent=`— ${L.sign}`;
  $('ltLines').innerHTML=L.lines.map((l,n)=>`<li style="--n:${n}"${l.wide?' class="wide"':''}><span class="lt-ic">${l.ic}</span><span class="lt-tx">${l.t}</span></li>`).join('');
  $('ltSum').innerHTML=L.sums.map(([g,q])=>`<span class="lt-s">${emblemMini(g)}<b data-to="${q}">0</b><em>${label(g)}</em></span>`).join('');
  // the lines write themselves in, one by one; then the totals count up
  const step=420,t0=900;
  L.lines.forEach((_,n)=>letterTimers.push(setTimeout(()=>{el.querySelectorAll('.lt-lines li')[n]?.classList.add('on');sfx('tick',n);},t0+n*step)));
  letterTimers.push(setTimeout(()=>{el.querySelectorAll('.lt-s b').forEach(b=>countUp(b,+b.dataset.to,900));el.classList.add('sums');
    letterTimers.push(setTimeout(()=>{el.classList.add('done');sfx('tally-end',1);},950));},t0+L.lines.length*step+200));
}
function countUp(b,to,ms){const s=performance.now();const f=()=>{const k=Math.min(1,(performance.now()-s)/ms);b.textContent=fmt(Math.round(to*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(f);};f();}
function closeLetter(){const el=$('letter');if(el.hidden)return;
  // a click before it has finished writing shows it all at once; the next one closes it
  if(!el.classList.contains('done')){letterTimers.forEach(clearTimeout);letterTimers=[];el.querySelectorAll('.lt-lines li').forEach(li=>li.classList.add('on'));
    el.querySelectorAll('.lt-s b').forEach(b=>{b.textContent=fmt(+b.dataset.to);});el.classList.add('sums','done');return;}
  el.classList.add('out');setTimeout(()=>{el.hidden=true;el.classList.remove('out');},420);sfx('pick');}
$('ltGo').addEventListener('click',e=>{e.stopPropagation();const el=$('letter');el.classList.add('done');closeLetter();});
$('letter').addEventListener('click',e=>{if(e.target===$('letter')||!$('letter').classList.contains('done'))closeLetter();});
addEventListener('keydown',e=>{if(!$('letter').hidden&&(e.key==='Escape'||e.key==='Enter')){e.preventDefault();e.stopPropagation();closeLetter();}},true);
