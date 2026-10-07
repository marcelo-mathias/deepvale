// Deepvale · fish/variety.js
// No two fish are quite alike: each one has its own size, the smallest and largest wear crowns, and some come in
// the colours of the hour they surface in (night, storm, winter). The codex keeps the records.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= sizes, crowns and variants ================= */
// size: a spread around 1 (the species' usual length). Crowns go to the few at each end, as in Monster Hunter.
const SIZE_SD=.1,SMALL_CROWN=.84,BIG_CROWN=1.18;
// colours of the hour: when they can turn up, how often, and how they look
const VARIANTS={
  night:{name:'Night',  when:()=>night>.3,                              p:.3, col:'#8790c8',em:'#24306a',ei:.55,rim:'#a9b8ff',line:'surfaces in the dark, blue as the river at midnight'},
  storm:{name:'Storm',  when:()=>['storm','rain'].includes(S.weather?.k),   p:.4, col:'#aab3b8',rim:'#f1f8ff',line:'comes up in the rain, grey and silver as the sky'},
  frost:{name:'Frost',  when:()=>calendar().season==='Winter',            p:.35,col:'#d9ecff',em:'#1c2c3c',ei:.25,rim:'#c7ecff',line:'wears a pale winter coat'},
};
const VARIANT_IDS=Object.keys(VARIANTS);
function rollSize(){let u=0;while(!u)u=Math.random();const n=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*Math.random());return clamp(1+n*SIZE_SD,.7,1.34);}
function rollVariant(){const ok=VARIANT_IDS.filter(v=>VARIANTS[v].when());for(const v of ok)if(Math.random()<VARIANTS[v].p)return v;return null;}
const crownOf=s=>s<=SMALL_CROWN?'small':s>=BIG_CROWN?'big':null;
const metres=(sp,size)=>(sp.len*4*size).toFixed(1);
// called once a fish exists: give it its size and, sometimes, the colours of the hour
function dressFish(f){
  f.size=rollSize();f.mesh.scale.setScalar(f.size);f.crown=crownOf(f.size);
  f.variant=rollVariant();const V=f.variant&&VARIANTS[f.variant];
  if(V){f.mat.color.set(V.col);if(V.em&&!f.sp.glow){f.mat.emissive=new THREE.Color(V.em);f.mat.emissiveIntensity=V.ei;}if(f.rimCol)f.rimCol.value.set(V.rim);}
}
const fishTitle=f=>`${f.variant?VARIANTS[f.variant].name+' ':''}${f.sp.name}`;
// at release: the tally rows it earns, and the records it sets. First crowns and first colours each spin a thread
function recordCatch(f){
  const sp=f.sp,R=(S.records||={})[sp.id]||={min:null,max:null,small:false,big:false,seen:{}},rows=[],notes=[];
  const size=f.size||1,m=+metres(sp,size);
  if(size!==1)rows.push({t:`Length ${metres(sp,size)} m`,v:+size.toFixed(2),k:'x'});
  if(f.crown==='big')rows.push({t:'Big crown',v:1.5,k:'x'});
  if(f.crown==='small')rows.push({t:'Small crown',v:1.25,k:'x'});
  if(f.variant)rows.push({t:`${VARIANTS[f.variant].name} colours`,v:1.2,k:'x'});
  if(R.max===null||m>R.max){if(R.max!==null)notes.push(`the largest yet, ${m} m`);R.max=m;}
  if(R.min===null||m<R.min){if(R.min!==null)notes.push(`the smallest yet, ${m} m`);R.min=m;}
  if(f.crown&&!R[f.crown]){R[f.crown]=true;gainThreads(1,`a ${f.crown} crown on a ${sp.name}`);}
  if(f.variant){const first=!R.seen[f.variant];R.seen[f.variant]=(R.seen[f.variant]||0)+1;if(first)gainThreads(1,`the first ${fishTitle(f)}`);}
  return {rows,notes,title:f.crown?`${f.crown==='big'?'Big':'Small'} crown!`:f.variant?fishTitle(f):''};
}
// the codex: records, crowns and colours seen, for a species you've met
const CROWN_SVG=`<svg class="crown" viewBox="0 0 16 12" aria-hidden="true"><path d="M1 10L2 3L5.5 6.5L8 1L10.5 6.5L14 3L15 10Z"/></svg>`;
function recordHTML(id){const R=S.records?.[id];if(!R||R.max===null)return '';
  return `<div class="erec"><span>Smallest <b>${R.min} m</b></span><span>Largest <b>${R.max} m</b></span>
    <span class="cr${R.small?' on':''}" title="${R.small?'A small crown, won':'Small crown: meet one of the very smallest'}">${CROWN_SVG}small</span>
    <span class="cr big${R.big?' on':''}" title="${R.big?'A big crown, won':'Big crown: meet one of the very largest'}">${CROWN_SVG}big</span>
    ${VARIANT_IDS.map(v=>`<span class="vr ${v}${R.seen[v]?' on':''}" title="${R.seen[v]?`Seen ${R.seen[v]} time${R.seen[v]>1?'s':''}: it ${VARIANTS[v].line}`:`Not yet seen: one that ${VARIANTS[v].line}`}">${VARIANTS[v].name}</span>`).join('')}</div>`;}
