// Procedural ambience and sound effects (Web Audio, no asset files).
let AC=null,master=null,soundOn=false;
export const isSoundOn=()=>soundOn;
function initAudio(){
  if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  master=AC.createGain();master.gain.value=0;master.connect(AC.destination);
  const len=AC.sampleRate*4,buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=last*3.2;}
  const src=AC.createBufferSource();src.buffer=buf;src.loop=true;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=520;
  const rg=AC.createGain();rg.gain.value=.22;src.connect(lp).connect(rg).connect(master);src.start();
  const padG=AC.createGain();padG.gain.value=.02;const pl=AC.createBiquadFilter();pl.type='lowpass';pl.frequency.value=700;pl.connect(padG).connect(master);
  [110,164.8,220.6,329.6].forEach((f,i)=>{const o=AC.createOscillator();o.type='triangle';o.frequency.value=f;o.detune.value=(i-1.5)*6;o.connect(pl);o.start();});
  const lfo=AC.createOscillator();lfo.frequency.value=.05;const lg=AC.createGain();lg.gain.value=.012;lfo.connect(lg).connect(padG.gain);lfo.start();
}
export function setSound(on){soundOn=on;if(on)initAudio();if(AC){if(AC.state==='suspended')AC.resume();master.gain.setTargetAtTime(on?.9:0,AC.currentTime,.4);}}
function tone(f,t0,dur,type='sine',g=.08){const o=AC.createOscillator(),gn=AC.createGain();o.type=type;o.frequency.value=f;gn.gain.setValueAtTime(0,t0);
  gn.gain.linearRampToValueAtTime(g,t0+Math.min(.02,dur*.2));gn.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(gn).connect(master);o.start(t0);o.stop(t0+dur+.05);}
export function sfx(kind){if(!AC||!soundOn)return;const t=AC.currentTime;
  if(kind==='pluck'||kind==='land'){[392,523.3,659.3].forEach((f,i)=>tone(f,t+i*.09,1.2,'triangle',.05));}
  else if(kind==='hook'){tone(196,t,.6,'triangle',.06);tone(293.7,t+.08,.8,'triangle',.04);}
  else if(kind==='dig'){tone(98,t,.25,'triangle',.08);}
  else if(kind==='land-big'){[261.6,329.6,392,523.3,659.3,784].forEach((f,i)=>tone(f,t+i*.14,2.4,'triangle',.05));}
  else if(kind==='awe'){[41.2,61.7,82.4].forEach(f=>{const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.22,t+3.5);g.gain.linearRampToValueAtTime(0,t+10);o.connect(g).connect(master);o.start(t);o.stop(t+10.5);});
    [659.3,987.8,1318.5].forEach((f,i)=>tone(f,t+2+i*.6,4,'sine',.015));}
}
