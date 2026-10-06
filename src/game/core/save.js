// Deepvale · core/save.js
// Saving, loading (and old-save migration), and offline progress.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= save / load / offline ================= */
const SAVE_KEY='deepvale-save-v1';
let noSave=false;const WIPE_KEY='deepvale-wipe';
// wiping: drop the save, leave a marker that boot honours even if something saves on the way out, and roll a new valley
function wipeSave(){noSave=true;try{localStorage.removeItem(SAVE_KEY);}catch(e){}store.set(WIPE_KEY,'1');store.set('deepvale-nextmap',String(1+Math.floor(Math.random()*999999)));location.replace(location.pathname+location.search);}
function save(){if(noSave||store.get(WIPE_KEY))return;S.jobs=saveJobs();S.t=Date.now();S.tiles=Array.from(tiles);S.builds=Array.from(builds);S.fishers=fishersState.map(f=>({i:f.i,j:f.j,slot:f.slot,c:f.color}));store.set(SAVE_KEY,JSON.stringify(S));}
let migrated='',silverMerged=-1;
function load(){
  if(store.get(WIPE_KEY)){try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(WIPE_KEY);}catch(e){}return false;}
  const raw=store.get(SAVE_KEY);if(!raw)return false;
  try{const d=JSON.parse(raw);if(!d.tiles)return false;
    // 0.1 saves had one currency (silver from selling fish): it becomes scales
    if(d.scales===undefined){d.scales=d.coins||0;d.silver=10;delete d.coins;migrated='0.1';}
    // before 0.13 there were two moneys: silver (trade, tale box, markets) joins the scales, one for one
    if(d.silver!==undefined){silverMerged=Math.round(d.silver||0);d.scales=(d.scales||0)+silverMerged;d.income=[...(d.income||[]),...(d.sIncome||[])].sort((a,b)=>a[0]-b[0]);delete d.silver;delete d.sIncome;}
    const old=LEGACY_GRIDS.find(g=>d.tiles.length===g.w*g.h);
    if(!old&&d.tiles.length!==GW*GH)return false;
    const rawTiles=d.tiles,rawBuilds=d.builds,rawFishers=d.fishers||[];
    delete d.tiles;delete d.builds;
    if(old){
      // an older, smaller valley: re-key everything stored by tile so it lands in the middle of the bigger one
      const {w,offI,offJ}=old,rk=k=>idx(k%w+offI,((k/w)|0)+offJ),reKey=o=>Object.fromEntries(Object.entries(o||{}).map(([k,v])=>[rk(+k),v]));
      d.meta=reKey(d.meta);d.hutVillage=reKey(d.hutVillage);d.found=(d.found||[]).map(rk);
      d.drops=(d.drops||[]).map(x=>({...x,i:x.i+offI,j:x.j+offJ,k:rk(x.k)}));
      d.jobs=(d.jobs||[]).map(x=>({...x,i:x.i+offI,j:x.j+offJ}));
      const sh=(key,f)=>Object.fromEntries(Object.entries(d[key]||{}).map(([k,v])=>[f(k),v]));
      d.corners=sh('corners',k=>{const [ci,cj]=k.split(',').map(Number);return `${ci+offI},${cj+offJ}`;});
      d.edges=sh('edges',k=>{const [i,j]=k.slice(2).split(',').map(Number);return `${k.slice(0,2)}${i+offI},${j+offJ}`;});
      d.legacyCh=w===44?offI:(LEGACY_GRIDS[1].offI); // channels keep the 44-wide layout they were dug against
    }
    for(const key of ['goods','reserve','boons','unlocked','counts','meta','tide'])if(d[key])d[key]={...S[key],...d[key]};
    Object.assign(S,d);
    if(old){const {w,h,offI,offJ}=old;
      applyMap(S.map);initTiles();builds.fill(NONE); // the new edges follow this valley's own river
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=idx(i+offI,j+offJ),o=j*w+i;tiles[k]=rawTiles[o];builds[k]=rawBuilds&&rawBuilds.length===rawTiles.length?rawBuilds[o]:NONE;}
      S.fishers=rawFishers.map(f=>({...f,i:f.i+offI,j:f.j+offJ}));
      if(!rawBuilds||rawBuilds.length!==rawTiles.length){initBuilds();}
      else{ // the Pilgrim Way now comes down further from the north edge
        for(let j=0;j<offJ;j++){const k=idx(WAY_I,j);tiles[k]=LAND;builds[k]=ROAD;}
        if(w===28){let best=-1,bd=1e9;for(let k=0;k<GW*GH;k++){const i=k%GW,j=(k/GW)|0;if(tiles[k]===LAND&&builds[k]===NONE&&nbLinkStrict(i,j)){const dd=Math.hypot(i-WAY_I,j-offJ-2);if(dd<bd){bd=dd;best=k;}}}
          if(best>=0)builds[best]=B.POST;}}
      if(w===28){for(let k=0;k<GW*GH;k++)if(builds[k]===HUT)S.meta[k]={style:'thatch'};S.goods.timber+=20;}
      migrated=migrated||(w===28?'0.2':'grow');
    }else{tiles.set(rawTiles);if(rawBuilds&&rawBuilds.length===GW*GH)builds.set(rawBuilds);else initBuilds();S.fishers=rawFishers;}
    return true;}catch(e){console.error(e);return false;}
}
// while you were away (up to 8 hours): the clock turned, crews and producers kept working at 60% of their pace,
// and the village met fish it already knew. It all goes into a letter (game/ui/letter.js).
function offlineGain(ms,jobs=0){
  const capped=Math.min(Math.max(0,ms),awayCap()),cal0=calendar(),day0=S.clock?.day||1;
  if(S.clock&&capped>0){S.clock.t+=capped/1000/DAY_LEN;S.clock.day+=Math.floor(S.clock.t);S.clock.t%=1;}
  if(ms<60e3)return;const m=capped/60e3,left=Date.now()-ms;
  const g=Math.floor(incomeRate(left)*m*awayPace());
  const made={};for(const id of ['timber','reeds','clay']){const q=Math.floor(goodRate(id)*m*awayPace());if(q>0){S.goods[id]+=q;made[id]=q;}}
  const met=offlineMeets(ms,m);
  if(g<=0&&!Object.keys(made).length&&!met.n&&!jobs)return;
  S.scales+=g;S.earned+=g;if(met.n)renderCodex();
  writeLetter({ms,g,made,met,jobs,cal0,cal1:calendar(),days:(S.clock?.day||1)-day0});
}
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();save();}else if(hiddenAt){offlineGain(Date.now()-hiddenAt);hiddenAt=0;refreshUI();}});
addEventListener('pagehide',save);
// another open tab wiped the valley: stop this one from writing its old save back
addEventListener('storage',e=>{if(e.key===WIPE_KEY&&e.newValue)noSave=true;});

