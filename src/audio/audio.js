// Procedural soundscape (Web Audio, no asset files): a babbling river, wind in the pines, birdsong,
// and a sparse kalimba that plays a few notes now and then. Sound effects are wood, water and small bells.
let AC = null, master = null, dry = null, wet = null, soundOn = false;
let noiseBuf = null, brownBuf = null;
const amb = { water: null, wind: null, birds: null, music: null };
let view = { zoom: 26 };
export const isSoundOn = () => soundOn;

const PENTA = [293.66, 329.63, 369.99, 440.0, 493.88]; // D major pentatonic
const note = (n) => PENTA[((n % 5) + 5) % 5] * Math.pow(2, Math.floor(n / 5));
const R = (a, b) => a + Math.random() * (b - a);

function makeImpulse(sec, decay){
  const len = AC.sampleRate * sec, buf = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++){ const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}
function initAudio(){
  if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e){ return; }
  master = AC.createGain(); master.gain.value = 0;
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp).connect(AC.destination);
  dry = AC.createGain(); dry.connect(master);
  const verb = AC.createConvolver(); verb.buffer = makeImpulse(2.8, 3.2);
  wet = AC.createGain(); wet.gain.value = .5; wet.connect(verb).connect(master);
  // noise sources
  const len = AC.sampleRate * 3;
  noiseBuf = AC.createBuffer(1, len, AC.sampleRate); { const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
  brownBuf = AC.createBuffer(1, len, AC.sampleRate); { const d = brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < len; i++){ l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
  startWater(); startWind(); scheduleBirds(); scheduleMusic();
}
const loop = (buf) => { const s = AC.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2); return s; };
const out = (node, wetAmt = .25) => { node.connect(dry); if (wetAmt > 0){ const g = AC.createGain(); g.gain.value = wetAmt; node.connect(g).connect(wet); } };

/* ---------- the river: a noise bed plus hundreds of tiny bubbles ---------- */
function startWater(){
  const bus = AC.createGain(); bus.gain.value = .0; out(bus, .15); amb.water = bus;
  const bed = loop(brownBuf), bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = .6;
  const bg = AC.createGain(); bg.gain.value = .5; bed.connect(bp).connect(bg).connect(bus);
  const hiss = loop(noiseBuf), hp = AC.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = .8;
  const hg = AC.createGain(); hg.gain.value = .025; hiss.connect(hp).connect(hg).connect(bus);
  // slow wander so it never sounds like a loop
  const lfo = AC.createOscillator(); lfo.frequency.value = .07; const lg = AC.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(bp.frequency); lfo.start();
  const bubble = () => {
    if (soundOn && AC.state === 'running'){
      const t = AC.currentTime, n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++){
        const t0 = t + k * R(.02, .07), f = R(420, 1300), d = R(.03, .09);
        const o = AC.createOscillator(), g = AC.createGain(), p = AC.createStereoPanner(); p.pan.value = R(-.7, .7);
        o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * R(1.5, 2.4), t0 + d);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(R(.006, .02), t0 + .004); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
        o.connect(g).connect(p).connect(bus); o.start(t0); o.stop(t0 + d + .02);
      }
    }
    setTimeout(bubble, R(40, 190));
  };
  bubble();
}
/* ---------- wind in the pines: slow swells ---------- */
function startWind(){
  const src = loop(brownBuf), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = .4;
  const g = AC.createGain(); g.gain.value = .0; src.connect(lp).connect(g); out(g, .3); amb.wind = g;
  const hs = loop(noiseBuf), hb = AC.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 1800; hb.Q.value = .5;
  const hg = AC.createGain(); hg.gain.value = .0; hs.connect(hb).connect(hg); out(hg, .3);
  const swell = () => {
    const t = AC.currentTime, dur = R(5, 11), peak = R(.35, 1);
    lp.frequency.cancelScheduledValues(t); lp.frequency.setTargetAtTime(300 + peak * 500, t, dur / 3);
    hg.gain.cancelScheduledValues(t); hg.gain.setTargetAtTime(.006 * peak * windLevel(), t, dur / 3); hg.gain.setTargetAtTime(.001, t + dur * .6, dur / 3);
    g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(.14 * peak * windLevel(), t, dur / 3); g.gain.setTargetAtTime(.05 * windLevel(), t + dur * .6, dur / 3);
    setTimeout(swell, dur * 1000);
  };
  swell();
}
const windLevel = () => 0.6 + Math.min(1, view.zoom / 80) * .8;
const waterLevel = () => Math.max(.25, 1.1 - view.zoom / 90);

/* ---------- birdsong ---------- */
function chirp(t, f0, f1, d, g, pan){
  const o = AC.createOscillator(), gn = AC.createGain(), p = AC.createStereoPanner(); p.pan.value = pan;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + .008); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(gn).connect(p); out(p, .35); o.start(t); o.stop(t + d + .03);
}
const SONGS = [
  // a little run of rising chirps
  (t, pan, g) => { const n = 3 + Math.floor(Math.random() * 4), f = R(2800, 3600); for (let k = 0; k < n; k++) chirp(t + k * .13, f, f * 1.35, .07, g, pan); },
  // a two-note call, falling
  (t, pan, g) => { const f = R(1500, 1900); chirp(t, f, f * .98, .22, g * .9, pan); chirp(t + .3, f * .8, f * .78, .3, g * .9, pan); },
  // a warbler: wobbling pitch
  (t, pan, g) => { const o = AC.createOscillator(), m = AC.createOscillator(), mg = AC.createGain(), gn = AC.createGain(), p = AC.createStereoPanner(); p.pan.value = pan;
    const f = R(2300, 3100); o.frequency.value = f; m.frequency.value = R(18, 30); mg.gain.value = f * .08; m.connect(mg).connect(o.frequency);
    const d = R(.5, .9); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g * .7, t + .05); gn.gain.setValueAtTime(g * .7, t + d * .7); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(gn).connect(p); out(p, .35); o.start(t); m.start(t); o.stop(t + d + .05); m.stop(t + d + .05); },
  // a distant trill
  (t, pan, g) => { const f = R(3800, 4600); for (let k = 0; k < 10; k++) chirp(t + k * .055, f, f * .85, .04, g * .55, pan); },
  // the slow three-note whistle of something in the reeds
  (t, pan, g) => { const f = R(1200, 1500); chirp(t, f, f * 1.12, .35, g * .7, pan); chirp(t + .45, f * 1.12, f * 1.12, .3, g * .6, pan); chirp(t + .85, f * 1.25, f * 1.05, .5, g * .6, pan); },
];
function scheduleBirds(){
  const go = () => {
    if (soundOn && AC.state === 'running' && !document.hidden){
      const s = SONGS[Math.floor(Math.random() * SONGS.length)], pan = R(-.9, .9), g = R(.02, .045) * (view.zoom > 90 ? .6 : 1);
      s(AC.currentTime + .05, pan, g);
      if (Math.random() < .3) setTimeout(() => soundOn && s(AC.currentTime + .05, pan * .8, g * .7), R(700, 1600)); // it answers itself
    }
    setTimeout(go, R(2500, 9000));
  };
  setTimeout(go, 1500);
}

/* ---------- a sparse kalimba ---------- */
function kalimba(f, t, g = .05, pan = 0){
  const p = AC.createStereoPanner(); p.pan.value = pan; out(p, .45);
  const o = AC.createOscillator(), gn = AC.createGain(); o.type = 'sine'; o.frequency.value = f;
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + .006); gn.gain.exponentialRampToValueAtTime(.0001, t + 1.8);
  o.connect(gn).connect(p); o.start(t); o.stop(t + 1.9);
  const o2 = AC.createOscillator(), g2 = AC.createGain(); o2.type = 'sine'; o2.frequency.value = f * 5.4;
  g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(g * .18, t + .003); g2.gain.exponentialRampToValueAtTime(.0001, t + .12);
  o2.connect(g2).connect(p); o2.start(t); o2.stop(t + .15);
}
function bell(f, t, g = .03, dur = 2.5, pan = 0){
  const p = AC.createStereoPanner(); p.pan.value = pan; out(p, .6);
  [[1, 1, 1], [2.0, .45, .6], [2.76, .35, .45], [5.4, .15, .25]].forEach(([m, a, dd]) => {
    const o = AC.createOscillator(), gn = AC.createGain(); o.frequency.value = f * m;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g * a, t + .004); gn.gain.exponentialRampToValueAtTime(.0001, t + dur * dd);
    o.connect(gn).connect(p); o.start(t); o.stop(t + dur * dd + .05); });
}
function scheduleMusic(){
  let phrase = 0;
  const go = () => {
    if (soundOn && AC.state === 'running' && !document.hidden){
      const t = AC.currentTime + .05, root = [0, 3, 2, 4][phrase++ % 4], n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++){ const step = root + [0, 2, 4, 5, 7][Math.floor(Math.random() * 5)]; kalimba(note(step + 5), t + k * R(.28, .5), .035, R(-.4, .4)); }
      if (Math.random() < .5) kalimba(note(root), t, .03, 0);
    }
    setTimeout(go, R(7000, 16000));
  };
  setTimeout(go, 4000);
}
function noiseHit(t, { f = 1000, q = 1, type = 'bandpass', dur = .2, g = .1, attack = .005, pan = 0, wetAmt = .2 } = {}){
  const s = AC.createBufferSource(); s.buffer = noiseBuf; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const gn = AC.createGain(), p = AC.createStereoPanner(); p.pan.value = pan;
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + attack); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl).connect(gn).connect(p); out(p, wetAmt); s.start(t, Math.random() * 2); s.stop(t + dur + .05);
  return fl;
}
function splash(t, size = 1){
  noiseHit(t, { f: 1800, q: .7, dur: .35 * size, g: .08 * Math.min(1.5, size) });
  noiseHit(t + .02, { f: 600, q: .9, dur: .5 * size, g: .06 * Math.min(1.5, size), type: 'lowpass' });
  for (let k = 0; k < 4; k++){ const f = R(500, 1100), t0 = t + .05 + k * R(.03, .1); chirp(t0, f, f * 2, .05, .02, R(-.5, .5)); }
}

export function setSound(on){ soundOn = on; if (on) initAudio(); if (AC){ if (AC.state === 'suspended') AC.resume(); master.gain.setTargetAtTime(on ? .9 : 0, AC.currentTime, .4); setView(view.zoom); } }
export function setView(zoom){ view.zoom = zoom; if (!AC || !amb.water) return; amb.water.gain.setTargetAtTime(.9 * waterLevel(), AC.currentTime, .6); }

export function sfx(kind, arg){
  if (!AC || !soundOn) return; const t = AC.currentTime + .01;
  switch (kind){
    case 'pluck': kalimba(note(7 + Math.floor(Math.random() * 3)), t, .05); noiseHit(t, { f: 900, q: 3, dur: .06, g: .05 }); break; // building or hiring: a wooden knock and a note
    case 'build': noiseHit(t, { f: 700, q: 4, dur: .07, g: .07 }); noiseHit(t + .12, { f: 850, q: 4, dur: .06, g: .05 }); kalimba(note(5 + Math.floor(Math.random() * 5)), t + .1, .04); break;
    case 'hook': splash(t, .6); kalimba(note(4), t + .05, .03); break;
    case 'dig': noiseHit(t, { f: 500, q: .8, dur: .18, g: .12, type: 'lowpass' }); noiseHit(t + .1, { f: 700, q: 1, dur: .12, g: .06 }); break;
    case 'clear': noiseHit(t, { f: 2400, q: .6, dur: .4, g: .05 }); noiseHit(t + .05, { f: 220, q: 2, dur: .15, g: .12 }); break; // rustle and a thump
    case 'land': splash(t, .8); kalimba(note(5), t + .15, .045); kalimba(note(7), t + .35, .045); break;
    case 'land-big': splash(t, 1.6); [5, 7, 9, 10, 12].forEach((n, i) => bell(note(n), t + .3 + i * .22, .03, 3, R(-.5, .5))); break;
    case 'awe': { // a slow swell of water and wind chimes: wonder, not dread
      const s = AC.createBufferSource(); s.buffer = brownBuf; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(200, t); lp.frequency.linearRampToValueAtTime(900, t + 4); lp.frequency.linearRampToValueAtTime(300, t + 9);
      const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + 3.5); g.gain.linearRampToValueAtTime(0, t + 9); s.connect(lp).connect(g); out(g, .5); s.start(t); s.stop(t + 9.5);
      for (let k = 0; k < 12; k++) bell(note(8 + Math.floor(Math.random() * 7)), t + 1.2 + k * R(.25, .55), .012, 3.5, R(-.8, .8));
      kalimba(note(0), t + 2, .05); kalimba(note(4), t + 2.6, .04); kalimba(note(7), t + 3.2, .04);
      break; }
    case 'coins': for (let k = 0; k < 5; k++) bell(R(2400, 3600), t + k * R(.04, .09), .012, .6, R(-.3, .3)); break;
    case 'cart': bell(note(10), t, .02, 1.2); bell(note(10), t + .35, .015, 1.2); noiseHit(t, { f: 300, q: 2, dur: .25, g: .04 }); break;
    case 'crate': [5, 7, 9, 12, 14].forEach((n, i) => bell(note(n), t + i * .08, .02, 1.6)); break;
    case 'discover': kalimba(note(3), t, .05); kalimba(note(5), t + .18, .05); kalimba(note(9), t + .36, .05); bell(note(12), t + .55, .02, 2.5); break;
    case 'set': [7, 9, 11, 12].forEach(n => bell(note(n), t, .016, 3)); break;
    case 'tick': kalimba(note(4 + (arg || 0)), t, .035); break;
    case 'tally-end': if (arg) { [7, 9, 12].forEach((n, i) => bell(note(n), t + i * .05, .02, 2)); } else kalimba(note(9), t, .03); break;
    case 'pick': kalimba(note(9), t, .04); kalimba(note(12), t + .1, .04); break;
    case 'no': noiseHit(t, { f: 300, q: 3, dur: .08, g: .05 }); break;
    case 'snap': { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(260, t + .18);
      g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22); o.connect(g); out(g, .2); o.start(t); o.stop(t + .25); noiseHit(t, { f: 3000, q: 1, dur: .05, g: .06 }); break; }
  }
}

/* ---------- themes: a ~10 second tune for each giant as it surfaces ---------- */
const m2f = m => 440 * Math.pow(2, (m - 69) / 12);
function voice(type, f, t, dur, g, { attack = .05, release = .6, cutoff = 2000, vib = 0, pan = 0, wetAmt = .5, detune = 0 } = {}){
  const p = AC.createStereoPanner(); p.pan.value = pan; out(p, wetAmt);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = .5;
  const gn = AC.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + attack);
  gn.gain.setValueAtTime(g, t + Math.max(attack, dur - release)); gn.gain.linearRampToValueAtTime(0, t + dur);
  gn.connect(lp).connect(p);
  const o = AC.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(gn); o.start(t); o.stop(t + dur + .05);
  if (vib){ const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * vib, t + .6); l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
  return lp;
}
const pad = (ms, t, dur, g, cutoff = 900) => ms.forEach((m, i) => { for (const d of [-7, 7]) voice('sawtooth', m2f(m), t, dur, g / ms.length, { attack: 1.4, release: 1.6, cutoff, detune: d, pan: (i / ms.length - .5) * .8, wetAmt: .7 }); });
const cello = (m, t, dur, g = .05) => voice('sawtooth', m2f(m), t, dur, g, { attack: .35, release: .5, cutoff: 1100, vib: .006, wetAmt: .5 });
function flute(m, t, dur, g = .035){ voice('sine', m2f(m), t, dur, g, { attack: .12, release: .35, vib: .008, wetAmt: .6 }); noiseHit(t, { f: m2f(m), q: 6, dur: Math.min(dur, .5), g: g * .3, attack: .08, wetAmt: .4 }); }
function drum(t, g = .12){ const o = AC.createOscillator(), gn = AC.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(52, t + .25);
  gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.0001, t + .5); o.connect(gn); out(gn, .3); o.start(t); o.stop(t + .55);
  noiseHit(t, { f: 400, q: .7, dur: .12, g: g * .4, type: 'lowpass' }); }
function swell(t, peak = .16, dur = 9){ const s = AC.createBufferSource(); s.buffer = brownBuf; const lp = AC.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(220, t); lp.frequency.linearRampToValueAtTime(800, t + dur * .4); lp.frequency.linearRampToValueAtTime(280, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * .35); g.gain.linearRampToValueAtTime(0, t + dur); s.connect(lp).connect(g); out(g, .5); s.start(t); s.stop(t + dur + .1); }
const THEMES = {
  // Ember Showa: a frame drum and a warm pentatonic figure
  showa(t){ swell(t, .1, 8); [0, .8, 1.6, 3.2, 4, 4.8, 6.4, 7.2, 8].forEach((d, i) => drum(t + d, i % 3 ? .07 : .12));
    pad([50, 57, 62], t, 10, .05, 700);
    [[1.6, 69], [2, 71], [2.4, 74], [3.2, 71], [4.8, 69], [5.2, 66], [5.6, 64], [6.4, 62], [8, 69], [8.6, 74]].forEach(([d, m]) => kalimba(m2f(m), t + d, .05, R(-.3, .3))); },
  // Mossback Sturgeon: an old cello line and a wooden flute
  sturgeon(t){ swell(t, .08, 10); [[0, 50, 2.2], [2.2, 57, 2], [4.2, 54, 2], [6.2, 52, 1.8], [8, 50, 2.4]].forEach(([d, m, l]) => cello(m, t + d, l, .045));
    [[3, 81, .9], [3.9, 78, .6], [4.5, 76, 1.2], [6, 78, .6], [6.6, 74, 2]].forEach(([d, m, l]) => flute(m, t + d, l)); },
  // Lantern Eel: glass bells climbing a bright, lifted scale
  eel(t){ swell(t, .07, 10); pad([62, 69, 76], t, 10, .03, 1400);
    const sc = [74, 76, 78, 80, 81, 83, 86, 88]; for (let k = 0; k < 16; k++) bell(m2f(sc[(k * 3) % 8] + (k > 9 ? 12 : 0)), t + .6 + k * .5, .018, 2.8, R(-.7, .7)); },
  // Moonscale Koi: a music-box lullaby over a soft chord
  moon(t){ swell(t, .07, 10); pad([59, 62, 66], t, 5, .035, 1100); pad([55, 62, 67], t + 5, 5, .035, 1100);
    [[.5, 83], [1, 86], [1.5, 90], [2.5, 88], [3, 86], [3.5, 83], [5, 83], [5.5, 86], [6, 91], [7, 90], [7.5, 86], [8.5, 83]].forEach(([d, m]) => { kalimba(m2f(m), t + d, .04, R(-.4, .4)); bell(m2f(m + 12), t + d, .006, 1.5); }); },
  // The Valley Warden: a warm choir, one brass swell at the reveal, and bells as it settles
  warden(t){ swell(t, .14, 11);
    [[0, [50, 57, 62, 64]], [2.4, [55, 59, 62, 67]], [4.8, [47, 54, 59, 62]], [7.2, [45, 57, 62, 64]], [9, [50, 57, 62, 66]]].forEach(([d, ch]) => pad(ch, t + d, 3.2, .07, 1200));
    for (const m of [62, 69]){ const f = voice('sawtooth', m2f(m), t + 2.2, 4, .04, { attack: 1.6, release: 1.8, cutoff: 400, wetAmt: .6 }); f.frequency.setValueAtTime(400, t + 2.2); f.frequency.linearRampToValueAtTime(2200, t + 3.8); f.frequency.linearRampToValueAtTime(600, t + 6.2); }
    [74, 78, 81, 86].forEach((m, i) => bell(m2f(m), t + 7.6 + i * .35, .02, 3.5, R(-.5, .5))); },
};
// called when a giant surfaces (with the cinematic zoom)
export function playTheme(id){ if (!AC || !soundOn) return; const th = THEMES[id]; if (th) th(AC.currentTime + .05); else sfx('awe'); }
