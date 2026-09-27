// Math, noise and storage helpers shared across the game.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const rand=(a,b)=>a+Math.random()*(b-a);
export function hash2(x,y){const h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h);}
export function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u),lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u),v);}
export function fbm(x,y,o=4){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vnoise(x*f,y*f);n+=a;f*=2.03;a*=.5;}return s/n;}
export function ridged(x,y,o=4){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){const r=1-Math.abs(vnoise(x*f,y*f)*2-1);s+=a*r*r;n+=a;f*=2.1;a*=.5;}return s/n;}
export const fmt=n=>n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e4?(n/1e3).toFixed(1)+'k':Math.floor(n).toLocaleString('en-US');
export const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
