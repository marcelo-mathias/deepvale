// Deepvale · fish/fish.js
// Fish (swimming, looks), fishers on the banks, sparkles, wisps and warm water.
// Part of the game's one shared scope: see src/main.js for the order. Names from other parts are in scope here.
/* ================= fish ================= */
function mixHex(a,b,t){const A=new THREE.Color(a),B=new THREE.Color(b);return '#'+A.lerp(B,t).getHexString();}
function fishCanvases(sp){
  const W=64,H=32;const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const e=document.createElement('canvas');e.width=W;e.height=H;const ge=e.getContext('2d');ge.fillStyle='#000';ge.fillRect(0,0,W,H);
  const px=(ctx,x,y,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.floor(x),Math.floor(((y%H)+H)%H),1,1);};
  const band=(top,belly)=>{for(let y=0;y<H;y++){const d=Math.abs(y-8);const dd=Math.min(d,H-d)/16;g.fillStyle=mixHex(top,belly,smooth(.25,.9,dd));g.fillRect(0,y,W,1);}};
  const blob=(cx,cy,rx,ry,col,ctx=g)=>{for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
    const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<1-hash2(x*1.7,y*2.3)*.35&&x>=1&&x<60)px(ctx,x,y,col);}};
  const R=Math.random;
  switch(sp.pattern){
    case 'reed':band('#4a5a3a','#d2d8c2');for(let x=4;x<60;x++){px(g,x,1,'#39452e');px(g,x,15,'#39452e');if(x%3===0)px(g,x,8,'#3e4a31');}break;
    case 'kohaku':band('#f3eee4','#fbf8f1');for(let n=0,N=3+Math.floor(R()*3);n<N;n++)blob(8+R()*42,8+(R()-.5)*4,4+R()*7,3+R()*3.5,'#c9331d');if(R()<.4)blob(5,8,3,2.5,'#c9331d');break;
    case 'bronze':band('#6e4a22','#d9bb82');for(let y=0;y<H;y++)for(let x=2;x<60;x++){if((x+(y%2)*2)%4===0&&Math.abs(y-8)<10)px(g,x,y,'rgba(40,22,8,.35)');}break;
    case 'showa':band('#1c1a1b','#e9e2d6');for(let n=0;n<5;n++)blob(6+R()*46,8+(R()-.5)*6,3+R()*6,2+R()*3.5,'#c8361f');for(let n=0;n<2;n++)blob(10+R()*40,8+(R()-.5)*8,3+R()*4,2+R()*2,'#efe9df');
      // live coals: a few glowing specks along the back and flanks
      for(let n=0;n<26;n++){const x=5+R()*52,y=8+(R()-.5)*12;px(g,x,y,'#ff9a4a');px(ge,x,y,R()<.5?'#ff7a2a':'#ffb45a');}break;
    case 'moss':band('#303c2c','#a4a488');for(let n=0;n<140;n++){const x=3+R()*56,y=8+(R()-.5)*14;px(g,x,y,R()<.5?'#6f8f45':'#8aa653');if(R()<.22)px(ge,x,y,R()<.5?'#6fd04a':'#b6f07a');}
      for(let x=6;x<58;x+=5){px(g,x,8,'#d9cfaa');px(g,x+1,8,'#d9cfaa');px(g,x+2,3,'#bfb593');px(g,x+2,13,'#bfb593');}break;
    case 'lantern':band('#131732','#3a3e66');for(let x=5;x<60;x+=4){for(const y of [3,13,21,27]){px(g,x,y,'#bff7ff');px(ge,x,y,'#8ff0ff');}}px(ge,4,8,'#8ff0ff');break;
    case 'moon':band('#dfe6f0','#f7f9fc');for(let y=0;y<H;y+=2)for(let x=4+(y%4?1:0);x<60;x+=3)px(g,x,y,'#b2c0d6');
      for(let x=6;x<58;x+=2)if(R()<.5)px(ge,x,8+(R()-.5)*8,'#6f86b8');for(let n=0;n<34;n++)px(ge,6+R()*50,8+(R()-.5)*14,'#dbe6ff');for(let x=5;x<60;x+=3)px(ge,x,8,'#9fb4ff');break;
    case 'warden':{band('#0c2424','#6d8c82');let lx=6,ly=8;for(let n=0;n<16;n++){const nx=clamp(lx+3+R()*5,4,58),ny=clamp(ly+(R()-.5)*8,1,15);
        const st=Math.max(Math.abs(nx-lx),Math.abs(ny-ly));for(let s=0;s<=st;s++){const x=lerp(lx,nx,s/st),y=lerp(ly,ny,s/st);px(g,x,y,'#8a6a33');px(ge,x,y,'#6b4d1a');}
        px(g,nx,ny,'#ffd27a');px(ge,nx,ny,'#ffd27a');lx=nx;ly=ny;if(lx>55){lx=6;ly=8+(R()-.5)*8;}}
      for(let x=4;x<60;x+=3){px(g,x,20,'#8fb0a2');px(g,x,28,'#8fb0a2');}break;}
    // the Salt Mouth
    case 'smelt':band('#6f8c94','#eef4f2');for(let x=4;x<60;x++){px(g,x,4,'#e6f6ff');px(g,x,12,'#e6f6ff');if(x%4===0)px(g,x,8,'#4d666d');}break;
    case 'flounder':band('#6e5f42','#efe6d4');for(let n=0;n<70;n++)px(g,3+R()*56,8+(R()-.5)*14,R()<.5?'#4a3e2a':'#a8916a');for(let n=0;n<7;n++)blob(8+R()*44,8+(R()-.5)*8,1.6,1.4,'#d9823a');break;
    case 'mullet':band('#4f5a60','#dfe3e2');for(let x=4;x<60;x++)for(const y of [3,5,11,13])if((x+y)%5)px(g,x,y,'#3c464c');break;
    case 'bass':band('#3d4f58','#e8eef0');for(let x=8;x<56;x+=6)for(let y=1;y<16;y++)if(Math.abs(y-8)<6+(x%12?0:1))px(g,x+(y%2),y,'#25323a');
      for(let x=6;x<58;x+=3){px(g,x,4,'#cfefff');px(ge,x,4,'#7fd8ff');px(g,x,12,'#cfefff');px(ge,x,12,'#7fd8ff');}break;
    case 'silverking':band('#8ea3b2','#f4f8fb');for(let y=0;y<H;y+=3)for(let x=4+(y%6?2:0);x<60;x+=4){px(g,x,y,'#c4d2dc');if(R()<.18)px(ge,x,y,'#ffffff');}
      for(let x=4;x<60;x++)px(g,x,8,'#6f8494');break;
    case 'mother':band('#123036','#5f8f88');for(let n=0;n<9;n++)blob(6+R()*50,8+(R()-.5)*10,2+R()*3,1.5+R()*2,'#2c5a58');
      for(let n=0;n<60;n++){const x=4+R()*54,y=8+(R()-.5)*14;px(g,x,y,'#cfe9df');if(R()<.5)px(ge,x,y,'#7fffe0');}
      for(let x=5;x<59;x+=2){px(g,x,20,'#9cc8bc');px(g,x,28,'#9cc8bc');}break;
  }
  const eye=sp.pattern==='warden'?'#ffd27a':'#141414';
  px(g,3,4,eye);px(g,3,12,eye);if(sp.glow){const ec=sp.pattern==='warden'?'#ffd27a':sp.pattern==='showa'?'#ff7a2a':'#556';px(ge,3,4,ec);px(ge,3,12,ec);}
  g.fillStyle=sp.fin;g.fillRect(62,0,2,H);
  return {c,e};
}
function profile(sp,t){
  if(sp.eel)return (.45+.55*Math.sin(Math.PI*Math.min(1,t*4)*.5))*(1-.75*t);
  return .1+.9*Math.pow(Math.sin(Math.PI*Math.pow(t,.55)*.93),.9);
}
function fishGeometry(sp){
  const L=sp.len,W=L*sp.wid,Hh=L*sp.hgt,N=22,M=10;const pos=[],uv=[],ind=[];
  for(let s=0;s<=N;s++){const t=s/N,z=L/2-t*L,r=profile(sp,t);
    for(let k=0;k<=M;k++){const th=k/M*Math.PI*2;let y=Math.sin(th)*Hh/2*r;if(y<0)y*=.7;pos.push(Math.cos(th)*W/2*r,y,z);uv.push(t,k/M);}}
  for(let s=0;s<N;s++)for(let k=0;k<M;k++){const a=s*(M+1)+k,b=a+1,c=a+M+1,d=c+1;ind.push(a,c,b,b,c,d);}
  const add=(x,y,z)=>{pos.push(x,y,z);uv.push(.985,.5);return pos.length/3-1;};
  const tri=(a,b,c)=>{ind.push(add(...a),add(...b),add(...c));};
  // nose + tail caps
  const nose=add(0,0,L/2+L*.012);for(let k=0;k<M;k++)ind.push(nose,k,k+1);
  // tail fin (spread flat so it reads from above)
  const tz=-L/2,T=L*sp.tail;
  if(sp.eel){tri([0,.02,tz+L*.25],[W*.25,0,tz-T],[-W*.25,0,tz-T]);}
  else{tri([0,0,tz+L*.03],[T*.62,Hh*.05,tz-T],[0,0,tz-T*.45]);tri([0,0,tz+L*.03],[0,0,tz-T*.45],[-T*.62,Hh*.05,tz-T]);}
  // pectoral + pelvic fins
  if(sp.fins>0){for(const side of [1,-1]){
      const t1=.2,z1=L/2-t1*L,r1=profile(sp,t1)*W/2,f=L*sp.fins*.26;
      tri([side*r1*.8,-Hh*.12,z1],[side*(r1+f),-Hh*.2,z1-f*.55],[side*(r1*.6+f*.55),-Hh*.2,z1-f*1.05]);
      tri([side*r1*.8,-Hh*.12,z1],[side*(r1*.6+f*.55),-Hh*.2,z1-f*1.05],[side*r1*.7,-Hh*.12,z1-f*.7]);
      const t2=.55,z2=L/2-t2*L,r2=profile(sp,t2)*W/2,f2=f*.5;
      tri([side*r2*.8,-Hh*.15,z2],[side*(r2+f2),-Hh*.2,z2-f2*.8],[side*r2*.7,-Hh*.15,z2-f2*1.1]);}}
  // dorsal ridge
  const d0=sp.eel?.1:.3,d1=sp.eel?.92:.62,dh=Hh*(sp.eel?.5:.42);
  for(let s=0;s<6;s++){const ta=lerp(d0,d1,s/6),tb=lerp(d0,d1,(s+1)/6);const za=L/2-ta*L,zb=L/2-tb*L;
    const ha=Hh/2*profile(sp,ta)*.95,hb=Hh/2*profile(sp,tb)*.95;const env=Math.sin(Math.PI*(s+.5)/6);
    tri([0,ha,za],[0,hb,zb],[0,hb+dh*env,zb+L*.03]);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();return geo;
}
const fishGeoCache={};
function makeFishMesh(sp){
  const geo=fishGeoCache[sp.id]||(fishGeoCache[sp.id]=fishGeometry(sp));
  const cv=fishCanvases(sp);const tex=new THREE.CanvasTexture(cv.c);
  for(const t of [tex]){t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;}
  const u={uPhase:{value:Math.random()*6},uAmp:{value:sp.eel?.05:.035},uLen:{value:sp.len},uHead:{value:sp.len/2},uCurve:{value:0},uEel:{value:sp.eel?1:0},uWaves:{value:sp.eel?1.6:.8}};
  const mp={map:tex,side:THREE.DoubleSide,roughness:.55,flatShading:true};
  if(sp.glow){const et=new THREE.CanvasTexture(cv.e);et.magFilter=et.minFilter=THREE.NearestFilter;et.generateMipmaps=false;et.flipY=false;et.colorSpace=THREE.SRGBColorSpace;
    Object.assign(mp,{emissiveMap:et,emissive:new THREE.Color('#ffffff'),emissiveIntensity:2.2});}
  const mat=new THREE.MeshStandardMaterial(mp);
  const rc={value:new THREE.Color(sp.glow||'#ffe2b8')},rs={value:sp.glow?1.4:1.0};
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u,{uRimColor:rc,uRimStr:rs,uSunView:U.sunView});
    sh.vertexShader=BEND_DECL+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+BEND_VERT);
    sh.fragmentShader='uniform vec3 uRimColor;uniform float uRimStr;uniform vec3 uSunView;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',RIM_FRAG);};
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  depth.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);sh.vertexShader=BEND_DECL+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+BEND_VERT);};
  const mesh=new THREE.Mesh(geo,mat);mesh.customDepthMaterial=depth;mesh.castShadow=true;
  return {mesh,mat,u,canvas:cv.c,rim:rs,rimCol:rc};
}
const fishes=[];
function swimY(sp){return -.6-Math.min(.42,sp.len*.03);}
function randomTileIn(comp,needD){const ok=comp.tiles.filter(k=>D[k]>=needD);const arr=ok.length?ok:comp.tiles;const k=arr[Math.floor(Math.random()*arr.length)];const c=tileC(k%GW,(k/GW)|0);return {x:c.x+rand(-.3,.3),z:c.z+rand(-.3,.3)};}
function spawnFish(sp,comp,{emerge=true}={}){
  const f=makeFishMesh(sp);const p=randomTileIn(comp,sp.needD);
  const fish={sp,...f,x:p.x,z:p.z,h:Math.random()*6.28,turn:0,speed:sp.speed*.35*Math.sqrt(sp.len),state:'swim',y:emerge?-3.4-sp.len*.08:swimY(sp),
    emerge:emerge?0:1,life:rand(240,520)*(sp.awe?1.4:1),age:0,tgt:null,hookers:[],progress:0,nextHint:0,out:0,id:Math.random()};
  dressFish(fish); // its own size, and sometimes the colours of the hour (fish/variety.js)
  fish.mesh.position.set(fish.x,fish.y,fish.z);scene.add(fish.mesh);fishes.push(fish);pickTarget(fish);
  return fish;
}
function pickTarget(f){
  const cid=compAt(f.x,f.z);const comp=comps[cid];if(!comp){f.tgt={x:f.x,z:f.z};return;}
  // fish are curious about bait: often wander toward the banks where fishers wait
  const near=fishersState.filter(fs=>fs.state==='idle'&&compAt(fs.bob.x,fs.bob.z)===cid);
  if(near.length&&Math.random()<.45){const fs=near[Math.floor(Math.random()*near.length)];f.tgt={x:fs.bob.x+rand(-1,1),z:fs.bob.z+rand(-1,1)};return;}
  f.tgt=randomTileIn(comp,f.sp.needD);
}
function angDiff(a,b){let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}
// a fish on the line tires as it is reeled in: near the end it can barely turn away from the crew,
// so a big one's last surge pulls the lines instead of swinging round and snapping them (1 when hooked, .25 when nearly in)
const fightTire=f=>1-.75*clamp(f.progress||0,0,1);
function updateFish(f,dt){
  const sp=f.sp;f.age+=dt;
  if(f.emerge<1){f.emerge=Math.min(1,f.emerge+dt/9);}
  // in the Salt Mouth's shallows a fish keeps off the mud, and just under the tide
  const targetY=SALT?Math.min(Math.max(swimY(sp),heightAt(f.x,f.z)+.07),waterLv-.035):swimY(sp);
  if(f.state==='swim'||f.state==='hooked'){
    const base=sp.speed*.35*Math.sqrt(sp.len);
    // on the line it mostly tires, but every so often it surges away from the crew
    if(f.state==='hooked'){f.surgeT=(f.surgeT??rand(5,9))-dt;if(f.surgeT<0){if(reel.fish===f&&reel.busy&&!(f.surgeHold>1.5)){f.surgeT=.05;f.surgeHold=(f.surgeHold||0)+dt;}else{f.surge=2.4;f.surgeT=rand(7,13);f.surgeHold=0;}}if(f.surge>0)f.surge-=dt;} // a surge waits for the light to pass the arc
    let want=f.state==='hooked'?base*(f.surge>0?.45:.1):base*(0.8+0.2*Math.sin(f.age*.3+f.id*10));
    if(f.state==='swim'){
      if(!f.tgt||Math.hypot(f.tgt.x-f.x,f.tgt.z-f.z)<Math.max(1.2,sp.len*.35))pickTarget(f);
      const desired=Math.atan2(f.tgt.x-f.x,f.tgt.z-f.z);
      let steer=angDiff(desired,f.h);
      const la=sp.len*.5+.9,need=sp.needD;
      const sample=a=>dAt(f.x+Math.sin(a)*la,f.z+Math.cos(a)*la);
      const dC=sample(f.h),dL=sample(f.h-.6),dR=sample(f.h+.6);
      if(dC<need)steer+=(dR>=dL?1:-1)*2.2;
      if(dAt(f.x,f.z)<1){let best=f.h,bd=-1;for(let a=0;a<8;a++){const an=a/8*Math.PI*2,d=dAt(f.x+Math.sin(an)*1.2,f.z+Math.cos(an)*1.2);if(d>bd){bd=d;best=an;}}steer=angDiff(best,f.h)*3;}
      const maxTurn=.55/Math.sqrt(sp.len)+.12;
      const tr=clamp(steer,-1,1)*maxTurn;f.turn=lerp(f.turn,tr,1-Math.exp(-dt*2));
      want*=1-Math.min(.6,Math.abs(steer)*.25);
    }else{const tire=fightTire(f);f.turn=Math.sin(f.age*2.3)*.25*(.5+.5*tire);if(f.surge>0&&f.hookers.length){let cx=0,cz=0;f.hookers.forEach(fs=>{cx+=fs.x;cz+=fs.z;});cx/=f.hookers.length;cz/=f.hookers.length;f.h+=angDiff(Math.atan2(f.x-cx,f.z-cz),f.h)*dt*.8*tire;}}
    f.speed=lerp(f.speed,want,1-Math.exp(-dt*.8));
    f.h+=f.turn*dt;
    const nx=f.x+Math.sin(f.h)*f.speed*dt,nz=f.z+Math.cos(f.h)*f.speed*dt;
    if(dAt(nx,nz)>0||dAt(f.x,f.z)===0){f.x=nx;f.z=nz;}else{f.h+=Math.PI*dt;}
    f.y=lerp(-3.4-sp.len*.08,targetY,easeInOut(f.emerge));
    if(f.state==='swim'&&f.age>f.life&&!cine.fish){f.state='leave';f.out=0;}
    f.u.uAmp.value=lerp(f.u.uAmp.value,f.state==='hooked'?.09:(sp.eel?.05:.035),dt);
    f.u.uPhase.value+=dt*(f.state==='hooked'?7:(1.2+f.speed*3/Math.sqrt(sp.len)));
    f.u.uCurve.value=clamp(f.turn/Math.max(f.speed,.15),-.5,.5)/sp.len*.9;
  }else if(f.state==='leave'){
    f.out+=dt/10;f.y=lerp(targetY,-3.6-sp.len*.08,easeInOut(Math.min(1,f.out)));
    f.x+=Math.sin(f.h)*f.speed*dt*.6;f.z+=Math.cos(f.h)*f.speed*dt*.6;f.u.uPhase.value+=dt*1.2;
    if(f.out>=1)removeFish(f);
  }else if(f.state==='held'){
    // brought up beside the crew, just under the surface, for a moment
    f.out+=dt/3.4;const k=Math.min(1,f.out);
    f.y=lerp(f.y,waterLv-.1-sp.hgt*sp.len*.25,1-Math.exp(-dt*2));
    f.u.uPhase.value+=dt*1.6;f.u.uAmp.value=lerp(f.u.uAmp.value,.025,dt*2);f.u.uCurve.value*=1-dt;
    if(Math.random()<dt*10)sparkle(f.x+rand(-.4,.4)*sp.len*.5*Math.abs(Math.sin(f.h)),waterLv+.05,f.z+rand(-.4,.4)*sp.len*.5*Math.abs(Math.cos(f.h)),sp.glow||'#fff3d6');
    if(k>=1){f.state='release';f.out=0;f.speed=0;}
  }else if(f.state==='release'){
    // turned loose: it heads back out to open water and sinks out of sight
    f.out+=dt/8;const k=Math.min(1,f.out);
    f.h+=angDiff(f.relH,f.h)*Math.min(1,dt*1.2);
    f.speed=lerp(f.speed,sp.speed*.35*Math.sqrt(sp.len)*1.1,1-Math.exp(-dt*.7));
    const nx=f.x+Math.sin(f.h)*f.speed*dt,nz=f.z+Math.cos(f.h)*f.speed*dt;
    if(dAt(nx,nz)>0){f.x=nx;f.z=nz;}else f.relH+=dt*1.5;
    f.y=lerp(WATER_Y-.1,-3.4-sp.len*.08,easeInOut(k));
    f.u.uPhase.value+=dt*(1.4+f.speed*3/Math.sqrt(sp.len));f.u.uAmp.value=lerp(f.u.uAmp.value,sp.eel?.05:.035,dt);
    if(k>.6){if(!f.mat.transparent){f.mat.transparent=true;f.mat.needsUpdate=true;}f.mat.opacity=1-(k-.6)/.4;}
    if(k>=1)removeFish(f);
  }
  f.mesh.position.set(f.x,f.y,f.z);f.mesh.rotation.y=f.h;
  if(sp.glow)f.mat.emissiveIntensity=(1.6+Math.sin(f.age*(sp.pattern==='warden'?.9:1.7))*.8)*(1+dusk*(sp.awe?1.6:.6));
}
function removeFish(f){scene.remove(f.mesh);f.mat.map.dispose();if(f.mat.emissiveMap)f.mat.emissiveMap.dispose();f.mat.dispose();const i=fishes.indexOf(f);if(i>=0)fishes.splice(i,1);}
const easeInOut=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function fishHead(f){const r=f.sp.len*.46;return {x:f.x+Math.sin(f.h)*r,z:f.z+Math.cos(f.h)*r};}
function distToFish(f,x,z){const r=f.sp.len*.5;const ax=f.x-Math.sin(f.h)*r,az=f.z-Math.cos(f.h)*r,bx=f.x+Math.sin(f.h)*r,bz=f.z+Math.cos(f.h)*r;
  const vx=bx-ax,vz=bz-az;const t=clamp(((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz),0,1);return Math.hypot(x-(ax+vx*t),z-(az+vz*t));}

/* ================= fishers ================= */
const fishersState=[];
const coatCols=['#b5523b','#3e6d8a','#c29a3a','#6b7d3a','#8a4f7a','#d7cfbf','#44504f'];
const bodyG=new THREE.CylinderGeometry(.045,.06,.16,5).translate(0,.08,0);
const headG=new THREE.IcosahedronGeometry(.042,0).translate(0,.2,0);
const hatG=new THREE.ConeGeometry(.095,.05,7).translate(0,.25,0);
const rodG=new THREE.CylinderGeometry(.004,.007,.55,3).translate(0,.275,0);
const bobG=new THREE.IcosahedronGeometry(.028,0);
const skinM=rimMat({color:'#e2b58c'},'#ffd9a8',.8),hatM=rimMat({color:'#d8bd78'},'#ffe3b0',1),rodM=rimMat({color:'#3b2a1c'}),bobM=rimMat({color:'#e8432f',emissive:new THREE.Color('#5a0d05')},'#ffd9a8',.6);
const lineM=new THREE.LineBasicMaterial({color:new THREE.Color('#eaf3ee'),transparent:true,opacity:.75,fog:false});
const coatMs=coatCols.map(c=>rimMat({color:c},'#ffd9a8',1));
const ROD_ANG=1.0;
function slotPos(i,j,slot){
  const c=tileC(i,j);let vx=0,vz=0;
  if(builds[idx(i,j)]===BRIDGE){// along the deck, alternating sides of the rail
    const alongX=village.axis(i,j)==='x';
    const ax=alongX?1:0,az=alongX?0:1,side=slot===1?1:-1,px=-az*side,pz=ax*side;
    return {x:c.x+ax*(slot-1)*.3+px*.1,z:c.z+az*(slot-1)*.3+pz*.1,face:Math.atan2(px,pz),deck:true};}
  for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){if(!a&&!b)continue;if(inGrid(i+a,j+b)&&tiles[idx(i+a,j+b)]===WATER){const w=(a&&b)?.5:1;vx+=a*w;vz+=b*w;}}
  const L=Math.hypot(vx,vz)||1;vx/=L;vz/=L;const px=-vz,pz=vx;
  const x=c.x+vx*.32+px*(slot-1)*.26,z=c.z+vz*.32+pz*(slot-1)*.26;
  return {x,z,face:Math.atan2(vx,vz)};
}
function makeFisher(i,j,slot,colorIdx){
  const g=new THREE.Group();
  const coat=coatMs[colorIdx%coatMs.length];
  const body=new THREE.Mesh(bodyG,coat),head=new THREE.Mesh(headG,skinM),hat=new THREE.Mesh(hatG,hatM);
  const rodPivot=new THREE.Group();rodPivot.position.set(.03,.14,.04);rodPivot.rotation.x=ROD_ANG;
  const rod=new THREE.Mesh(rodG,rodM);rodPivot.add(rod);
  g.add(body,head,hat,rodPivot);g.traverse(o=>{if(o.isMesh){o.castShadow=true;}});
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(13*3),3));
  const line=new THREE.Line(lineGeo,lineM.clone());line.frustumCulled=false;
  const bob=new THREE.Mesh(bobG,bobM);
  scene.add(g,line,bob);
  const fs={i,j,slot,g,rodPivot,line,bobMesh:bob,state:'idle',fish:null,ph:Math.random()*6,color:colorIdx,bobOff:{a:rand(-.5,.5),d:rand(1.1,1.7)},bobPos:{x:0,z:0}};
  placeFisher(fs);
  fishersState.push(fs);return fs;
}
function placeFisher(fs){
  const p=slotPos(fs.i,fs.j,fs.slot);fs.x=p.x;fs.z=p.z;fs.face=p.face;
  fs.g.position.set(p.x,p.deck?DECK_Y+.022:Math.max(heightAt(p.x,p.z),WATER_Y)-.01,p.z);fs.g.rotation.set(0,p.face,0);
  const a=p.face+fs.bobOff.a;fs.bob={x:p.x+Math.sin(a)*fs.bobOff.d,z:p.z+Math.cos(a)*fs.bobOff.d};
  if(dAt(fs.bob.x,fs.bob.z)===0){fs.bob={x:p.x+Math.sin(p.face)*.9,z:p.z+Math.cos(p.face)*.9};}
}
function fishersOn(i,j){return fishersState.filter(f=>f.i===i&&f.j===j);}
function freeSlot(i,j){const used=fishersOn(i,j).map(f=>f.slot);for(const s of [1,0,2])if(!used.includes(s))return s;return -1;}
const tipV=new THREE.Vector3();
function updateFisher(fs,dt,t){
  let endX,endY,endZ,sag;
  if(fs.state==='fight'&&fs.fish){const h=fishHead(fs.fish);endX=h.x;endZ=h.z;endY=waterLv;sag=.03;
    fs.g.rotation.x=-.28+Math.sin(t*7+fs.ph)*.07;fs.rodPivot.rotation.x=ROD_ANG-.5+Math.sin(t*9+fs.ph)*.12;fs.bobMesh.visible=false;}
  else{fs.g.rotation.x=0;fs.rodPivot.rotation.x=ROD_ANG+Math.sin(t*.7+fs.ph)*.04;
    endX=fs.bob.x;endZ=fs.bob.z;endY=waterLv+.012+Math.sin(t*2.1+fs.ph)*.01;sag=.18;
    fs.bobMesh.visible=true;fs.bobMesh.position.set(endX,endY,endZ);}
  fs.bobPos.x=endX;fs.bobPos.z=endZ;
  fs.g.updateMatrixWorld();tipV.set(0,.55,0);fs.rodPivot.children[0].localToWorld(tipV);
  const arr=fs.line.geometry.attributes.position.array;
  for(let k=0;k<=12;k++){const u=k/12;arr[k*3]=lerp(tipV.x,endX,u);arr[k*3+1]=lerp(tipV.y,endY,u)-Math.sin(Math.PI*u)*sag;arr[k*3+2]=lerp(tipV.z,endZ,u);}
  fs.line.geometry.attributes.position.needsUpdate=true;
}
function removeFisherMeshes(fs){scene.remove(fs.g,fs.line,fs.bobMesh);fs.line.geometry.dispose();fs.line.material.dispose();}
// how far a line reaches from the rod before it strains and snaps
const maxLine=fs=>{const b=builds[idx(fs.i,fs.j)];return 3.2+(b===BRIDGE||b===B.PIER?.6:0);};
const LINE_OK=new THREE.Color('#eaf3ee'),LINE_TAUT=new THREE.Color('#ff7a4a');

/* ================= sparkles ================= */
const SPK=260;const spkGeo=new THREE.BufferGeometry();const spkPos=new Float32Array(SPK*3),spkCol=new Float32Array(SPK*3);
spkGeo.setAttribute('position',new THREE.BufferAttribute(spkPos,3));spkGeo.setAttribute('color',new THREE.BufferAttribute(spkCol,3));
const spkData=Array.from({length:SPK},()=>({life:0,vx:0,vy:0,vz:0}));let spkI=0;
const spk=new THREE.Points(spkGeo,new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
spk.frustumCulled=false;spk.renderOrder=5;scene.add(spk);
function sparkle(x,y,z,col){const k=spkI++%SPK;const d=spkData[k];d.life=1;d.vx=rand(-.3,.3);d.vy=rand(.3,.9);d.vz=rand(-.3,.3);
  spkPos[k*3]=x;spkPos[k*3+1]=y;spkPos[k*3+2]=z;tmpC.set(col);d.c=[tmpC.r*3,tmpC.g*3,tmpC.b*3];}
function updateSparkles(dt){for(let k=0;k<SPK;k++){const d=spkData[k];if(d.life<=0){spkCol[k*3]=spkCol[k*3+1]=spkCol[k*3+2]=0;continue;}
  d.life-=dt*.6;spkPos[k*3]+=d.vx*dt;spkPos[k*3+1]+=d.vy*dt;spkPos[k*3+2]+=d.vz*dt;const a=Math.max(0,d.life);spkCol[k*3]=d.c[0]*a;spkCol[k*3+1]=d.c[1]*a;spkCol[k*3+2]=d.c[2]*a;}
  spkGeo.attributes.position.needsUpdate=spkGeo.attributes.color.needsUpdate=true;}

/* ================= wisps, warm water & the village ================= */
const wisps=makeWisps(scene);
const props=makeProps({rimMat});
// dithered building icons for the toolbar and Build drawer: rendered from these models, or the painted set (Settings)
const bicons=makeBuildingIcons({renderer,props,rimMat,camDir:CAM_DIR,sunDir:SUN_DIR,onPainted:()=>{clearTimeout(paintT);paintT=setTimeout(()=>{setToolArt();renderDrawer();},50);}});let paintT=0;let iconSet='models';
const statueMats={stone:rimMat({color:'#a39d92'},'#ffe6c0',1),bronze:rimMat({color:'#9a7440',metalness:.3,roughness:.5},'#ffd9a0',1.2),gold:rimMat({color:'#d9a94a',metalness:.55,roughness:.35,emissive:new THREE.Color('#5a3a10'),emissiveIntensity:.35},'#fff0c0',1.5)};
// the carving for a statue: the fish's own shape, centred so it sits on the plinth
// carved in stone, recast in bronze at the second level, gilded at the third
function statueFish(id,lvl=1){const sp=SP[id]||SP.koi,geo=fishGeoCache[sp.id]||(fishGeoCache[sp.id]=fishGeometry(sp));const m=new THREE.Mesh(geo,lvl>=3?statueMats.gold:lvl>=2||sp.awe?statueMats.bronze:statueMats.stone);
  geo.boundingBox||geo.computeBoundingBox();const c=geo.boundingBox.getCenter(new THREE.Vector3()),sc=.78/sp.len*(sp.eel?1.2:1);
  m.scale.setScalar(sc);m.position.copy(c).multiplyScalar(-sc);m.castShadow=true;const g=new THREE.Group();g.add(m);return g;}
const roads=makeRoads({scene,heightAt,isRoad:(i,j)=>builds[idx(i,j)]===ROAD,paveAt:(i,j)=>S.meta[idx(i,j)]?.pave||'dirt',linkAt,tileC,GW,GH});
const village=makeVillage({scene,rimMat,heightAt,tiles,builds,wayPts:()=>wayPath(),deco:()=>({corners:S.corners||{},edges:S.edges||{}}),meta:()=>S.meta,emit:wisps.emit,wayX,props,isLive:k=>isLive(k),statueFish,lore:()=>({tales:allTales(),met:SPECIES.filter(s=>S.codex[s.id]).map(s=>s.id)})});

