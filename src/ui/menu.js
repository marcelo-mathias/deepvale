// The title screen: a living title, forest glints, drifting motes.
//  - the title is split into letters that rise in one by one, then bob gently like something on water
//  - a band of light sweeps across it now and then; letters near the cursor lift and catch the light
//  - four-pointed glints (the same sparkle as treasure in the forest) bloom around the title and the buttons
//  - a canvas of slow motes and fireflies drifts over the valley, leaning away from the cursor
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function makeMenu(root){
  const title = root.querySelector('#menuTitle'), fx = root.querySelector('#menuFx');
  let letters = [], mouse = { x: -1e4, y: -1e4 }, alive = true;

  /* ---------- the title ---------- */
  function setTitle(text){
    title.setAttribute('aria-label', text); title.innerHTML = '';
    // long names get a smaller size so they stay on one or two lines
    title.style.setProperty('--len', String(Math.max(8, text.length)));
    letters = [...text].map((ch, n) => {
      const outer = document.createElement('span'); outer.className = 'ch'; outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span'); inner.className = 'cb'; inner.textContent = ch === ' ' ? ' ' : ch;
      outer.style.setProperty('--i', n); outer.appendChild(inner); title.appendChild(outer);
      return { outer, inner, lift: 0 };
    });
    requestAnimationFrame(measure);
  }
  // each letter gets its offset in the word, so one band of light can sweep across all of them
  function measure(){
    const tr = title.getBoundingClientRect();
    title.style.setProperty('--ww', tr.width + 'px');
    for (const l of letters){ const r = l.outer.getBoundingClientRect(); l.cx = r.left + r.width / 2; l.cy = r.top + r.height / 2; l.outer.style.setProperty('--x', (r.left - tr.left) + 'px'); }
  }
  addEventListener('resize', () => requestAnimationFrame(measure));

  /* ---------- glints ---------- */
  const COLS = ['#fff3cf', '#ffe29a', '#bff5df', '#ffffff'];
  function glint(x, y, size = 1, col){
    if (REDUCED) return;
    const s = document.createElement('i'); s.className = 'glint';
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--s', size); s.style.setProperty('--c', col || COLS[Math.floor(Math.random() * COLS.length)]);
    s.style.setProperty('--r', (Math.random() * 90 - 45) + 'deg');
    root.appendChild(s); setTimeout(() => s.remove(), 1100);
  }
  const rootXY = (x, y) => { const r = root.getBoundingClientRect(); return [x - r.left, y - r.top]; };
  // idle glints around the title
  setInterval(() => { if (!alive || document.hidden || root.classList.contains('gone')) return;
    const r = title.getBoundingClientRect(); const [x, y] = rootXY(r.left + Math.random() * r.width, r.top + r.height * (.2 + Math.random() * .7)); glint(x, y, .5 + Math.random() * .9); }, 420);
  // buttons shine and throw glints from their edges on hover
  root.querySelectorAll('.enter, .mlink').forEach(b => {
    let t = null;
    b.addEventListener('pointerenter', () => { const burst = () => { const r = b.getBoundingClientRect(); for (let n = 0; n < 2; n++){ const side = Math.random() < .5, [x, y] = rootXY(side ? r.left + Math.random() * r.width : (Math.random() < .5 ? r.left : r.right), side ? (Math.random() < .5 ? r.top : r.bottom) : r.top + Math.random() * r.height); glint(x, y, .5 + Math.random() * .5); } };
      burst(); t = setInterval(burst, 260); });
    b.addEventListener('pointerleave', () => { clearInterval(t); t = null; });
  });

  /* ---------- letters follow the cursor ---------- */
  root.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  root.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  title.addEventListener('pointerenter', () => title.classList.add('hot'));
  title.addEventListener('pointerleave', () => title.classList.remove('hot'));

  /* ---------- motes and fireflies ---------- */
  const g = fx.getContext('2d'); let W = 0, H = 0, dpr = 1;
  const motes = Array.from({ length: 70 }, () => spawnMote(true));
  function spawnMote(any){ return { x: Math.random(), y: any ? Math.random() : 1.05, r: .6 + Math.random() * 1.8, s: .006 + Math.random() * .018, ph: Math.random() * 6.28, fly: Math.random() < .28 }; }
  function resize(){ dpr = Math.min(2, devicePixelRatio || 1); W = fx.clientWidth; H = fx.clientHeight; fx.width = W * dpr; fx.height = H * dpr; }
  addEventListener('resize', resize); resize();

  let last = performance.now();
  function tick(now){
    if (!alive) return; const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!root.classList.contains('gone')){
      // letters: lift toward the cursor, fall back gently
      for (const l of letters){
        if (l.cx === undefined) continue; const d = Math.hypot(mouse.x - l.cx, (mouse.y - l.cy) * 1.4), want = Math.max(0, 1 - d / 170);
        l.lift += (want - l.lift) * Math.min(1, dt * 9);
        l.outer.style.setProperty('--lift', l.lift.toFixed(3));
        if (want > .6 && Math.random() < dt * 4){ const [x, y] = rootXY(l.cx + (Math.random() - .5) * 30, l.cy - 20 - Math.random() * 30); glint(x, y, .7 + Math.random() * .6); }
      }
      // motes
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const mx = mouse.x / W - .5, t = now / 1000;
      for (let n = 0; n < motes.length; n++){
        const m = motes[n]; m.y -= m.s * dt * (m.fly ? .6 : 1); m.x += Math.sin(t * .4 + m.ph) * .00025 - mx * .0004 * m.r;
        if (m.y < -.05){ motes[n] = spawnMote(false); continue; }
        const x = m.x * W, y = m.y * H;
        if (m.fly){ const a = .35 + .65 * Math.max(0, Math.sin(t * 1.3 + m.ph)); g.fillStyle = `rgba(214,255,150,${a * .9})`; g.shadowColor = 'rgba(214,255,150,.9)'; g.shadowBlur = 10; g.beginPath(); g.arc(x, y, m.r * .9, 0, 6.283); g.fill(); g.shadowBlur = 0; }
        else { g.fillStyle = `rgba(255,240,210,${.18 + .22 * Math.sin(t + m.ph) ** 2})`; g.fillRect(x, y, m.r, m.r); }
      }
    }
    requestAnimationFrame(tick);
  }
  if (!REDUCED) requestAnimationFrame(tick);

  return { setTitle, stop(){ alive = false; } };
}
