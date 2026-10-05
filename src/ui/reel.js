// "Lend a hand": a small reeling game that rides beside a hooked fish.
// A light runs round a ring. Press (Space or click) while it crosses the mint arc to give the crew a pull;
// the gold heart of the arc is a perfect pull. Each hit moves the arc, and a run of hits narrows it.
// Before a fish surges the ring warns (amber, pulsing) for a moment; then it turns ember: let it run.
// A pull in the first half-second of a surge is forgiven, and a late one only costs one step of the run.
// Nothing here can lose a fish on its own: ignoring the ring is always fine, the crew reels anyway.
const TAU = Math.PI * 2, R = 38;
const arc = (a0, a1, r = R) => { const x0 = 50 + Math.cos(a0) * r, y0 = 50 + Math.sin(a0) * r, x1 = 50 + Math.cos(a1) * r, y1 = 50 + Math.sin(a1) * r;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
const wrap = a => ((a % TAU) + TAU) % TAU;
const angDist = (a, b) => { const d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, TAU - d); };

export function makeReel(layer){
  const el = document.createElement('div'); el.className = 'reel'; el.hidden = true;
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="track" cx="50" cy="50" r="${R}"/>
      <path class="zone"/><path class="perfect"/>
      <circle class="dot" r="4.2"/>
    </svg>
    <div class="mid"><b class="combo"></b><span class="hint">Space</span></div>
    <div class="say"></div>`;
  layer.appendChild(el);
  const zone = el.querySelector('.zone'), perf = el.querySelector('.perfect'), dot = el.querySelector('.dot'),
    combo = el.querySelector('.combo'), hint = el.querySelector('.hint'), say = el.querySelector('.say');
  let fish = null, a = 0, speed = 3.4, zc = 0, zw = 1.2, n = 0, cool = 0, engaged = false, surging = false, warning = false, surgeAge = 0;

  function placeZone(){ // somewhere well ahead of the light
    zc = wrap(a + 1.6 + Math.random() * 3); zw = Math.max(.55, 1.25 - n * .09);
    zone.setAttribute('d', arc(zc - zw / 2, zc + zw / 2)); const pw = zw * .3; perf.setAttribute('d', arc(zc - pw / 2, zc + pw / 2));
    el.classList.remove('zin'); void el.offsetWidth; el.classList.add('zin');
  }
  function flash(text, cls){ say.textContent = text; say.className = 'say ' + cls; void say.offsetWidth; say.classList.add('on'); }

  return {
    get fish(){ return fish; },
    get engaged(){ return engaged; },
    // speed: radians a second, grows with the size of the fish
    attach(f, base){ if (fish === f) return; fish = f; n = 0; cool = 0; engaged = false; speed = base; a = Math.random() * TAU; el.hidden = false; el.className = 'reel'; placeZone(); combo.textContent = ''; hint.textContent = 'Space'; },
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
      if (surging){ n = Math.max(0, n - 1); combo.textContent = n > 1 ? n : ''; cool = .6; flash('Too tight!', 'slack'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return 'slack'; }
      const d = angDist(a, zc);
      if (d < zw * .15){ n++; flash(n > 2 ? `Perfect ×${n}` : 'Perfect', 'perfect'); combo.textContent = n > 1 ? n : ''; placeZone(); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); return 'perfect'; }
      if (d < zw / 2){ n++; flash('Pull', 'good'); combo.textContent = n > 1 ? n : ''; placeZone(); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); return 'good'; }
      n = 0; combo.textContent = ''; cool = .45; flash('Missed', 'miss'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return 'miss';
    },
    get combo(){ return n; },
    // true while the light is in the arc or about to reach it: a surge waits until it has passed
    get busy(){ if (!fish) return false; const ahead = wrap(zc - a); return angDist(a, zc) < zw / 2 + .15 || ahead < zw / 2 + .9; },
  };
}
