// Deepvale · ui/view.js
// Camera, night lights, and the post/pixel pipeline.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= camera ================= */
let tween=null;
function tweenTo(p,z,dur){tween={from:{x:view.t.x,y:view.t.y,z:view.t.z,zoom:view.z},to:{x:p.x,y:p.y??0,z:p.z,zoom:z},t:0,dur};}
function updateCamera(dt){
  if(tween){tween.t+=dt/tween.dur;const k=easeInOut(Math.min(1,tween.t));
    view.t.set(lerp(tween.from.x,tween.to.x,k),lerp(tween.from.y,tween.to.y,k),lerp(tween.from.z,tween.to.z,k));view.z=Math.exp(lerp(Math.log(tween.from.zoom),Math.log(tween.to.zoom),k));
    if(tween.t>=1)tween=null;}
  view.t.x=clamp(view.t.x,-HX-26,HX+26);view.t.z=clamp(view.t.z,-HZ-45,HZ+24);
  const w=innerWidth,h=innerHeight,a=w/h,zz=view.z;
  camera.left=-zz*a/2;camera.right=zz*a/2;camera.top=zz/2;camera.bottom=-zz/2;camera.updateProjectionMatrix();
  camera.position.copy(view.t).addScaledVector(CAM_DIR,200);camera.lookAt(view.t);camera.updateMatrixWorld();
  U.sunView.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
  // the shadow box follows the view and grows as you zoom out
  const ext=clamp(view.z*.62*Math.max(1,a*.8),22,120);sun.target.position.set(view.t.x,0,view.t.z);sun.position.copy(sun.target.position).addScaledVector(SUN_DIR,140);
  const sc=sun.shadow.camera;if(Math.abs(sc.right-ext)>.5){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.updateProjectionMatrix();}
  sun.target.updateMatrixWorld();
  if(Math.abs(view.z-lastAudioZ)>2){lastAudioZ=view.z;setAudioView(view.z);}
}
let lastAudioZ=0;
let loreKey='';const TALE_STAGES=[6,12,18,24];
/* ---- night lights: gather every light source, hand the nearest to the post pass ---- */
let lampOn=0,lampT=0;
function gatherLamps(){const L=[];const at=(kind,x,z,scale)=>L.push({kind,x,y:heightAt(x,z),z,scale});
  for(let k=0;k<GW*GH;k++){const b=builds[k];if(b===NONE||b===ROAD&&!S.meta[k]?.slots?.lamp)continue;const c=tileC(k%GW,(k/GW)|0);
    if(b===HUT)at('window',c.x,c.z,(S.meta[k]?.style==='lacquer'?1.4:1)*(1+.25*(LVL(k)-1)));
    else if(b===B.LANTERN)at('lantern',c.x,c.z);
    else if(b===B.SHOP||b===B.MARKET||b===B.POST)at('shop',c.x,c.z,1+.2*(LVL(k)-1));
    else if(b===B.SHRINE)at('shrine',c.x,c.z);
    else if(b===B.TALEHALL)at('shop',c.x,c.z+.2,1.5+allTales()/24);
    else if(b===B.TOWER)at('lantern',c.x,c.z,2.4);else if(b===B.TEMPLE)at('shrine',c.x,c.z+.6,1.6);else if(b===B.GATE)at('shrine',c.x,c.z,.7);
    else if(b===B.STATUE&&LVL(k)>=2)at('lantern',c.x,c.z+.3,LVL(k)>=3?.8:.55);
    if(S.meta[k]?.slots?.lamp)at('lamp',c.x+.3,c.z+.3);}
  for(const key of Object.keys(S.corners||{})){const [ci,cj]=key.split(',').map(Number);at(S.corners[key]==='lamp'?'lamp':'lantern',ci-HX,cj-HZ);}
  for(const f of fishersState){const p=f.g.position;L.push({kind:'fisher',x:p.x+.12,y:p.y,z:p.z+.08});}
  lamps.set(L);}
function lightsTick(dt){
  lampOn+=(clamp(dusk/.62,0,1)-lampOn)*Math.min(1,dt*1.5);lamps.uniforms.uLampOn.value=lampOn;postMat.uniforms.uBloom.value=.28+.9*lampOn;
  lampT-=dt;if(lampT>0)return;lampT=.5;
  if(lampOn>.001){gatherLamps();lamps.update(view.t.x,view.t.z);}}

/* ================= post / pixel pipeline ================= */
const bloom=makeBloom(renderer),lamps=makeLamps();
const invPV=new THREE.Matrix4();
const postMat=new THREE.ShaderMaterial({
  uniforms:{tScene:{value:null},tDepth:{value:null},tBloomA:{value:null},tBloomB:{value:null},uBloom:{value:.3},uInvPV:{value:invPV},
    uRes:{value:new THREE.Vector2(1,1)},uTime:U.time,uDusk:U.dusk,uMist:{value:0},uGloom:{value:0},uFlash:{value:0},uSnowSky:{value:0},...lamps.uniforms},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`uniform sampler2D tScene;uniform sampler2D tDepth;uniform sampler2D tBloomA;uniform sampler2D tBloomB;uniform float uBloom;uniform mat4 uInvPV;
  uniform vec2 uRes;uniform float uTime;uniform float uDusk;uniform float uMist;uniform float uGloom;uniform float uFlash;uniform float uSnowSky;varying vec2 vUv;
  ${LAMP_GLSL}
  ${NOISE_GLSL}
  vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
  float bayer4(vec2 p){int x=int(mod(p.x,4.0)),y=int(mod(p.y,4.0));int i=x+y*4;
    float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return m[i]/16.0;}
  void main(){
    vec2 cell=floor(vUv*uRes)+0.5;vec2 uv=cell/uRes;
    vec4 s=texture2D(tScene,uv);float a=clamp(s.a,0.0,1.0);
    vec3 sky=mix(vec3(0.95,0.72,0.52),vec3(0.28,0.45,0.55),smoothstep(0.25,1.05,uv.y));
    sky+=vec3(1.0,0.75,0.5)*0.55*exp(-length((uv-vec2(0.0,0.92))*vec2(1.3,1.0))*2.6);
    sky=mix(sky,vec3(0.05,0.07,0.15)+vec3(0.35,0.3,0.45)*exp(-length((uv-vec2(0.0,0.92))*vec2(1.3,1.0))*2.6),uDusk*0.85);
    // lamp light: rebuild each pixel's world position from depth and light it from nearby lamps
    vec3 lit=s.rgb;
    float dep=texture2D(tDepth,uv).r;vec4 wp=uInvPV*vec4(uv*2.0-1.0,dep*2.0-1.0,1.0);wp/=wp.w;
    if(uLampOn>0.001&&a>0.0){
      vec3 L=lampLight(wp.xyz,uTime);
      lit=s.rgb*(1.0-0.15*uLampOn)*(1.0+L*2.6)+L*0.05;}
    // grey weather: a lower, flatter light
    sky=mix(sky,vec3(0.55,0.6,0.64)*(1.0-uDusk*0.7),uGloom*0.7);sky=mix(sky,vec3(0.86,0.88,0.92)*(1.0-uDusk*0.6),uSnowSky*0.4);
    lit=mix(lit,vec3(dot(lit,vec3(0.3,0.5,0.2)))*vec3(0.92,0.97,1.02),uGloom*0.25)*(1.0-uGloom*0.12);
    vec3 col=mix(sky,lit,a);
    // fog: thickest in the low ground and over the water, drifting
    if(uMist>0.001){float lowg=smoothstep(4.0,-0.6,wp.y)*a+(1.0-a);float drift=vns(wp.xz*0.08+vec2(uTime*0.03,uTime*0.012))*0.5+vns(wp.xz*0.21-uTime*0.02)*0.5;
      vec3 mc=mix(vec3(0.82,0.84,0.83),vec3(0.16,0.2,0.26),uDusk);col=mix(col,mc,clamp(uMist*(0.2+0.6*lowg)*(0.15+1.3*drift*drift),0.0,0.5));}
    col+=vec3(0.75,0.82,1.0)*uFlash;
    // bloom: glowing things bleed soft light around them
    col+=(texture2D(tBloomA,uv).rgb*0.7+texture2D(tBloomB,uv).rgb*1.1)*uBloom;
    col=aces(col*1.05);
    col=mix(col,col*vec3(0.78,0.86,1.12),uDusk*0.6);
    float sh=pow(max(0.0,sin((uv.x*0.8-uv.y)*7.0+uTime*0.025)),10.0);col+=vec3(1.0,0.86,0.62)*sh*0.045;
    col=pow(col,vec3(1.0/2.2));
    col=mix(col,col*vec3(1.03,1.0,0.95),smoothstep(0.4,1.0,dot(col,vec3(0.33))));
    col=mix(col,col*vec3(0.9,1.0,1.04),1.0-smoothstep(0.0,0.4,dot(col,vec3(0.33))));
    float v=smoothstep(1.15,0.35,length((vUv-0.5)*vec2(1.25,1.0)));col*=mix(0.7,1.0,v);
    col=floor(col*40.0+bayer4(cell))/40.0;
    gl_FragColor=vec4(col,1.0);
  }`,depthTest:false,depthWrite:false});
const postScene=new THREE.Scene();const postCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMat));
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);
  const rw=Math.max(160,Math.floor(w/PIX)),rh=Math.max(120,Math.floor(h/PIX));
  if(rt){rt.depthTexture?.dispose();rt.dispose();}
  rt=new THREE.WebGLRenderTarget(rw,rh,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
  rt.depthTexture=new THREE.DepthTexture(rw,rh);rt.depthTexture.type=THREE.UnsignedIntType;
  bloom.resize(rw,rh);
  postMat.uniforms.tScene.value=rt.texture;postMat.uniforms.tDepth.value=rt.depthTexture;
  postMat.uniforms.tBloomA.value=bloom.near;postMat.uniforms.tBloomB.value=bloom.far;postMat.uniforms.uRes.value.set(rw,rh);shadeU.uPx.value.set(2/rw,2/rh);
  lineM.linewidth=1;
}
addEventListener('resize',resize);

