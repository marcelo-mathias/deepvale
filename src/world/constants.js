// Valley grid dimensions, tile types and the river's course.
// The valley grew from 28×20 (0.2) to 44×30 (0.3) to 68×46 (0.10). The grid stays centred on the world origin,
// so an older save maps in by a fixed offset and every tile keeps its place in the world.
export const GW=68,GH=46,HX=GW/2,HZ=GH/2;
export const LEGACY_GRIDS=[[28,20],[44,30]].map(([w,h])=>({w,h,offI:(GW-w)/2,offJ:(GH-h)/2}));
// how much bigger than the 44-wide valley the old layouts (channels, mountains) were drawn for
export const GROW=GW/44;
export const WATER_Y=-0.15,BED_Y=-1.35,LAND_Y=0.08;
export const WILD=0,LAND=1,WATER=2,EDGE=3; // EDGE: inside the grid but beyond this valley's own (organic) edge: forest you can't reach
export const idx=(i,j)=>j*GW+i;
export const tileC=(i,j)=>({x:i-HX+.5,z:j-HZ+.5});
export const inGrid=(i,j)=>i>=0&&j>=0&&i<GW&&j<GH;
// The river's course. The default is the original valley; new games roll their own (see randomRiver).
export const RIVER={a1:3.1,f1:.21,p1:.6,a2:1.8,f2:.07,p2:2.0,z0:0};
export const setRiver=r=>Object.assign(RIVER,r);
export function riverZ(x){const R=RIVER;return Math.sin(x*R.f1+R.p1)*R.a1+Math.sin(x*R.f2+R.p2)*R.a2+R.z0;}
// a random but friendly course: gentle bends, and the north bank by the Pilgrim Way always has room for a village
export function randomRiver(seed){let s=seed>>>0||1;const R=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  for(let t=0;t<50;t++){const r={a1:2+R()*5,f1:.09+R()*.15,p1:R()*6.28,a2:1+R()*4,f2:.03+R()*.05,p2:R()*6.28,z0:(R()-.5)*8};
    const saved={...RIVER};setRiver(r);let ok=true;for(let x=-HX;x<=HX;x+=.5){const z=riverZ(x);if(z<-HZ+7||z>HZ-5)ok=false;}if(riverZ(.5)<-HZ+9)ok=false;setRiver(saved);if(ok)return r;}
  return {...RIVER};}
// Things built on tiles (a second layer over the tile type). The list lives in data/builds.js; these four are the originals.
export const NONE=0,HUT=1,ROAD=2,BRIDGE=3;
export const WAY_I=GW/2;          // column where the Pilgrim Way enters the valley from the north edge
export const DECK_Y=0.02;       // bridge deck height
export const HOUSING=3;         // fishers per hut
// rows of the grid's west and east edge where the river enters and leaves
export const mouthRows=i=>{const r=[];for(let j=0;j<GH;j++){const c=tileC(i,j);if(Math.abs(c.z-riverZ(c.x))<1.6)r.push(j);}return r;};
