// Valley grid dimensions, tile types and the river's course.
// 0.3 grew the valley from 28×20 to 44×30. The grid stays centred on the world origin, so an old save maps in by a fixed offset.
export const GW=44,GH=30,HX=GW/2,HZ=GH/2;
export const OLD_GW=28,OLD_GH=20,OLD_OFF_I=(GW-OLD_GW)/2,OLD_OFF_J=(GH-OLD_GH)/2;
export const WATER_Y=-0.15,BED_Y=-1.35,LAND_Y=0.08;
export const WILD=0,LAND=1,WATER=2;
export const idx=(i,j)=>j*GW+i;
export const tileC=(i,j)=>({x:i-HX+.5,z:j-HZ+.5});
export const inGrid=(i,j)=>i>=0&&j>=0&&i<GW&&j<GH;
// The river's course. The default is the original valley; new games roll their own (see randomRiver).
export const RIVER={a1:3.1,f1:.21,p1:.6,a2:1.8,f2:.07,p2:2.0,z0:0};
export const setRiver=r=>Object.assign(RIVER,r);
export function riverZ(x){const R=RIVER;return Math.sin(x*R.f1+R.p1)*R.a1+Math.sin(x*R.f2+R.p2)*R.a2+R.z0;}
// a random but friendly course: gentle bends, and the north bank by the Pilgrim Way always has room for a village
export function randomRiver(seed){let s=seed>>>0||1;const R=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  for(let t=0;t<50;t++){const r={a1:1.4+R()*3.6,f1:.12+R()*.2,p1:R()*6.28,a2:.6+R()*2.6,f2:.04+R()*.07,p2:R()*6.28,z0:(R()-.5)*5};
    const saved={...RIVER};setRiver(r);let ok=true;for(let x=-HX;x<=HX;x+=.5){const z=riverZ(x);if(z<-HZ+7||z>HZ-5)ok=false;}if(riverZ(.5)<-HZ+9)ok=false;setRiver(saved);if(ok)return r;}
  return {...RIVER};}
// Things built on tiles (a second layer over the tile type). The list lives in data/builds.js; these four are the originals.
export const NONE=0,HUT=1,ROAD=2,BRIDGE=3;
export const WAY_I=22;          // column where the Pilgrim Way enters the valley from the north edge
export const DECK_Y=0.02;       // bridge deck height
export const HOUSING=3;         // fishers per hut
// rows of the grid's west and east edge where the river enters and leaves
export const mouthRows=i=>{const r=[];for(let j=0;j<GH;j++){const c=tileC(i,j);if(Math.abs(c.z-riverZ(c.x))<1.6)r.push(j);}return r;};
