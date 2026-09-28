// Valley grid dimensions, tile types and the river's course.
export const GW=28,GH=20,HX=GW/2,HZ=GH/2;
export const WATER_Y=-0.15,BED_Y=-1.35,LAND_Y=0.08;
export const WILD=0,LAND=1,WATER=2;
export const idx=(i,j)=>j*GW+i;
export const tileC=(i,j)=>({x:i-HX+.5,z:j-HZ+.5});
export const inGrid=(i,j)=>i>=0&&j>=0&&i<GW&&j<GH;
export function riverZ(x){return Math.sin(x*.21+.6)*3.1+Math.sin(x*.07+2.0)*1.8;}
// Things built on tiles (a second layer over the tile type).
export const NONE=0,HUT=1,ROAD=2,BRIDGE=3;
export const WAY_I=14;          // column where the Pilgrim Way enters the valley from the north edge
export const DECK_Y=0.02;       // bridge deck height
export const HOUSING=3;         // fishers per hut
// rows of the grid's west and east edge where the river enters and leaves
export const mouthRows=i=>{const r=[];for(let j=0;j<GH;j++){const c=tileC(i,j);if(Math.abs(c.z-riverZ(c.x))<1.6)r.push(j);}return r;};
