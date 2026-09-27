// GLSL chunks injected into three.js materials.
export const NOISE_GLSL=`
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vns(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hsh(i),hsh(i+vec2(1.0,0.0)),u.x),mix(hsh(i+vec2(0.0,1.0)),hsh(i+vec2(1.0,1.0)),u.x),u.y);}
float caustic(vec2 uv,float time){vec2 p=mod(uv*6.28318,6.28318)-250.0;vec2 i=p;float c=1.0;float inten=0.005;
  for(int n=0;n<4;n++){float t=time*(1.0-(3.5/float(n+1)));i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));
  c+=1.0/length(vec2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten)));}
  c/=4.0;c=1.17-pow(c,1.4);return pow(abs(c),8.0);}
float clouds(vec2 p,float t){return smoothstep(0.52,0.8,vns(p*0.045+t*vec2(0.012,0.007))*0.65+vns(p*0.11+t*vec2(0.02,0.01))*0.35);}
`;

export const RIM_FRAG=`
  vec3 rimV = isOrthographic ? vec3(0.0,0.0,1.0) : normalize(vViewPosition);
  float rimF = 1.0 - clamp(abs(dot(rimV, normal)), 0.0, 1.0);
  float rimS = 0.25 + 0.75*clamp(dot(normal, uSunView)*0.5+0.5, 0.0, 1.0);
  outgoingLight += uRimColor * pow(rimF, 2.4) * uRimStr * rimS;
  #include <opaque_fragment>`;

export const BEND_VERT=`
  float tt=clamp((uHead-transformed.z)/uLen,0.0,1.0);
  float wv=uEel>0.5?(0.3+tt):pow(tt,1.5);
  transformed.x+=sin(uPhase-tt*uWaves*6.2831)*uAmp*uLen*wv;
  transformed.x+=uCurve*pow(uHead-transformed.z,2.0)*0.5;`;

export const BEND_DECL='uniform float uPhase;uniform float uAmp;uniform float uLen;uniform float uHead;uniform float uCurve;uniform float uEel;uniform float uWaves;\n';
