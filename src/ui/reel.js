// "Lend a hand": a small reeling game that rides beside a hooked fish.
// A light runs round a ring. Press (Space or click) while it crosses the mint arc to give the crew a pull;
// the gold heart of the arc is a perfect pull. Each hit moves the arc, and a run of hits narrows it.
// Before a fish surges the ring warns (amber, pulsing) for a moment; then it turns ember: let it run.
// A pull in the first half-second of a surge is forgiven, and a late one only costs one step of the run.
// Nothing here can lose a fish on its own: ignoring the ring is always fine, the crew reels anyway.
// A run of hits heats the ring up, Balatro-style: the pull multiplier pops over the ring and grows, sparks fly,
// and the colour climbs mint → gold → ember → rose (--heat 0…1 and a tier class t1–t4).
const TAU = Math.PI * 2, R = 38;
const arc = (a0, a1, r = R) => { const x0 = 50 + Math.cos(a0) * r, y0 = 50 + Math.sin(a0) * r, x1 = 50 + Math.cos(a1) * r, y1 = 50 + Math.sin(a1) * r;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
const wrap = a => ((a % TAU) + TAU) % TAU;
const angDist = (a, b) => { const d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, TAU - d); };

let reelN = 0;
export function makeReel(layer){
  const q = 'rl' + (++reelN) + Math.random().toString(36).slice(2, 6); // pattern ids, unique to this ring
  const el = document.createElement('div'); el.className = 'reel'; el.hidden = true;
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <pattern id="${q}T" class="pt" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1"/><rect x="1" y="1" width="1" height="1"/></pattern>
        <pattern id="${q}H" class="ph" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1"/><rect x="2" y="2" width="1" height="1"/></pattern>
        <pattern id="${q}Z" class="pz" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1"/><rect x="1" y="1" width="1" height="1"/></pattern>
      </defs>
      <circle class="disc" cx="50" cy="50" r="${R - 4}"/>
      <circle class="track" cx="50" cy="50" r="${R}" stroke="url(#${q}T)"/>
      <circle class="track2" cx="50" cy="50" r="${R + 5}" stroke="url(#${q}H)"/>
      <path class="zone"/><path class="zonedth" stroke="url(#${q}Z)"/><path class="perfect"/>
      <circle class="dot" r="4.2"/>
    </svg>
    <div class="mid"><b class="combo"></b><span class="hint">Space</span></div>
    <div class="say"></div><div class="mult"></div><div class="sparks"></div>`;
  layer.appendChild(el);
  const zone = el.querySelector('.zone'), perf = el.querySelector('.perfect'), dot = el.querySelector('.dot'),
    combo = el.querySelector('.combo'), hint = el.querySelector('.hint'), say = el.querySelector('.say'),
    mult = el.querySelector('.mult'), sparks = el.querySelector('.sparks');
  let broke = 0, fish = null, a = 0, speed = 3.4, zc = 0, zw = 1.2, n = 0, cool = 0, engaged = false, surging = false, warning = false, surgeAge = 0;

  function placeZone(){ // somewhere well ahead of the light
    zc = wrap(a + 1.6 + Math.random() * 3); zw = Math.max(.55, 1.25 - n * .09);
    zone.setAttribute('d', arc(zc - zw / 2, zc + zw / 2)); el.querySelector('.zonedth').setAttribute('d', arc(zc - zw / 2 - .12, zc + zw / 2 + .12, R + 5)); const pw = zw * .3; perf.setAttribute('d', arc(zc - pw / 2, zc + pw / 2));
    el.classList.remove('zin'); void el.offsetWidth; el.classList.add('zin');
  }
  function flash(text, cls){ say.textContent = text; say.className = 'say ' + cls; void say.offsetWidth; say.classList.add('on'); }
  // the run's heat: the tier sets the colour, --heat drives glow, shake and spark count
  const MAX = 6; // the pull bonus stops growing here (see reelPress in main.js)
  const multOf = k => 1 + .08 * Math.min(k, MAX);
  function heat(){ const h = Math.min(1, n / 8), tier = n >= 8 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
    el.style.setProperty('--heat', h.toFixed(3)); for (let k = 1; k <= 4; k++) el.classList.toggle('t' + k, tier === k); }
  function popMult(perfect){
    mult.textContent = n >= MAX ? `×${multOf(n).toFixed(2)} max` : `×${multOf(n).toFixed(2)}`;
    mult.style.setProperty('--rot', ((Math.random() - .5) * (6 + n * 2)).toFixed(1) + 'deg');
    mult.style.setProperty('--sz', (1 + Math.min(n, 10) * .07).toFixed(2));
    mult.className = 'mult' + (perfect ? ' pf' : ''); void mult.offsetWidth; mult.classList.add('on');
    const count = Math.min(16, (perfect ? 6 : 3) + n);
    for (let k = 0; k < count; k++){ const sp = document.createElement('i'); const ang = Math.random() * TAU, dist = 34 + Math.random() * (22 + n * 4);
      sp.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px'); sp.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      sp.style.setProperty('--d', (Math.random() * .08).toFixed(3) + 's'); sparks.appendChild(sp); setTimeout(() => sp.remove(), 800); }
  }
  function cool_(){ heat(); mult.className = 'mult'; }

  return {
    get fish(){ return fish; },
    get engaged(){ return engaged; },
    // speed: radians a second, grows with the size of the fish
    attach(f, base){ if (fish === f) return; fish = f; n = 0; cool = 0; engaged = false; speed = base; a = Math.random() * TAU; el.hidden = false; el.className = 'reel'; heat(); placeZone(); combo.textContent = ''; hint.textContent = 'Space'; },
    detach(){ fish = null; el.hidden = true; },
    update(dt, x, y, surge, warn){
      if (!fish) return;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      if (surge !== surging){ surging = surge; surgeAge = 0; el.classList.toggle('surge', surge); if (surge && engaged) flash('Let it run', 'slack'); hint.textContent = surge ? 'Let it run' : engaged ? '' : 'Space'; }
      warn = !!warn && !surge; if (warn !== warning){ warning = warn; el.classList.toggle('warn', warn); if (warn) hint.textContent = 'It\u2019s gathering\u2026'; else if (!surging) hint.textContent = engaged ? '' : 'Space'; }
      if (surging) surgeAge += dt;
      cool = Math.max(0, cool - dt);
      a = wrap(a + dt * speed * (1 + n * .05) * (surging ? .6 : 1));
      dot.setAttribute('cx', (50 + Math.cos(a) * R).toFixed(2)); dot.setAttribute('cy', (50 + Math.sin(a) * R).toFixed(2));
      el.classList.toggle('over', !surging && angDist(a, zc) < zw / 2);
    },
    // returns 'perfect' | 'good' | 'miss' | 'slack' | null (cooling down)
    press(){
      if (!fish || cool > 0) return null;
      engaged = true; hint.textContent = '';
      if (surging && surgeAge < .5){ flash('Easy\u2026', 'slack'); return null; } // too close to call: no harm done
      if (surging){ n = Math.max(0, n - 1); cool_(); combo.textContent = n > 1 ? n : ''; cool = .6; flash('Too tight!', 'slack'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return 'slack'; }
      const d = angDist(a, zc);
      if (d < zw * .15){ n++; heat(); popMult(true); flash('Perfect', 'perfect'); combo.textContent = n > 1 ? n : ''; placeZone(); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); return 'perfect'; }
      if (d < zw / 2){ n++; heat(); popMult(false); flash('Pull', 'good'); combo.textContent = n > 1 ? n : ''; placeZone(); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); return 'good'; }
      broke = n; n = 0; cool_(); combo.textContent = ''; cool = .45; flash('Missed', 'miss'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return 'miss';
    },
    get combo(){ return n; },
    // how long the run was before the last miss broke it (for the tumble-down sound), then cleared
    takeBroken(){ const b = broke; broke = 0; return b; },
    get heat(){ return Math.min(1, n / 8); },
    // true while the light is in the arc or about to reach it: a surge waits until it has passed
    get busy(){ if (!fish) return false; const ahead = wrap(zc - a); return angDist(a, zc) < zw / 2 + .15 || ahead < zw / 2 + .9; },
  };
}
