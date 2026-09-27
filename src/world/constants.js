// Valley grid dimensions, tile types and the river's course.
export const GW=28,GH=20,HX=GW/2,HZ=GH/2;
export const WATER_Y=-0.15,BED_Y=-1.35,LAND_Y=0.08;
export const WILD=0,LAND=1,WATER=2;
export const idx=(i,j)=>j*GW+i;
export const tileC=(i,j)=>({x:i-HX+.5,z:j-HZ+.5});
export const inGrid=(i,j)=>i>=0&&j>=0&&i<GW&&j<GH;
export function riverZ(x){return Math.sin(x*.21+.6)*3.1+Math.sin(x*.07+2.0)*1.8;}
