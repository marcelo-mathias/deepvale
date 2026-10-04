// The guided tour: a soft spotlight on one thing at a time, and a card that explains it.
// Steps are plain objects (see the tour in main.js):
//   title, text          what the card says (text may hold simple HTML)
//   target()             an element, or a screen rect {x, y, w, h}, or null for a centred card
//   wait()               optional: the step moves on by itself once this returns true
//   next                 label for the button, or false to hide it (when the step waits for the player)
//   enter() / leave()    optional hooks
// The spotlight never blocks the game: everything under it stays clickable.
export function makeTour(root, { onEnd, sfx } = {}){
  const el = document.createElement('div'); el.id = 'tour'; el.hidden = true;
  el.innerHTML = `<div class="hole"></div>
    <div class="tcard" role="dialog" aria-live="polite">
      <div class="tk"><span class="tstep"></span><button type="button" class="tskip">Skip tour</button></div>
      <h4></h4><div class="tt"></div>
      <div class="trow"><span class="tdots"></span><button type="button" class="tnext enter"><span>Next</span></button></div>
    </div>`;
  root.appendChild(el);
  const hole = el.querySelector('.hole'), card = el.querySelector('.tcard'), h4 = card.querySelector('h4'), tt = card.querySelector('.tt'),
    stepEl = card.querySelector('.tstep'), dots = card.querySelector('.tdots'), next = card.querySelector('.tnext');
  let steps = [], i = -1, cur = null;

  function show(n){
    if (cur?.leave) cur.leave();
    i = n; cur = steps[i]; if (!cur){ stop(true); return; }
    if (cur.enter) cur.enter();
    h4.innerHTML = cur.title; tt.innerHTML = cur.text;
    stepEl.textContent = `${i + 1} of ${steps.length}`;
    dots.innerHTML = steps.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('');
    next.hidden = cur.next === false; next.querySelector('span').textContent = cur.next || (i === steps.length - 1 ? 'Begin' : 'Next');
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    sfx && sfx('tick', i % 5);
    place();
  }
  // move the spotlight and keep the card beside it, on screen
  function place(){
    if (!cur) return;
    let r = null; const t = cur.target ? cur.target() : null;
    if (t instanceof Element){ const b = t.getBoundingClientRect(); if (b.width) r = { x: b.left, y: b.top, w: b.width, h: b.height }; }
    else if (t) r = t;
    if (r){ const pad = cur.pad ?? 8; hole.style.cssText = `left:${r.x - pad}px;top:${r.y - pad}px;width:${r.w + pad * 2}px;height:${r.h + pad * 2}px;border-radius:${cur.round ? '50%' : '10px'}`; hole.classList.remove('none'); }
    else { hole.classList.add('none'); hole.style.cssText = `left:50%;top:50%;width:0;height:0`; }
    const cw = card.offsetWidth, ch = card.offsetHeight, W = innerWidth, H = innerHeight, m = 16;
    let x, y;
    if (!r){ x = (W - cw) / 2; y = H * .3; }
    else {
      const below = r.y + r.h + 18, above = r.y - ch - 18;
      if (below + ch < H - 90) y = below; else if (above > 70) y = above; else y = Math.min(H - ch - 90, Math.max(70, r.y));
      x = r.x + r.w / 2 - cw / 2;
      if (y === Math.min(H - ch - 90, Math.max(70, r.y))){ x = r.x + r.w + 18 + cw < W ? r.x + r.w + 18 : r.x - cw - 18; }
    }
    card.style.left = Math.max(m, Math.min(W - cw - m, x)) + 'px'; card.style.top = Math.max(m, Math.min(H - ch - m, y)) + 'px';
  }
  function tick(){ if (!cur) return; place(); if (cur.wait && cur.wait()) show(i + 1); }
  function stop(finished){ if (cur?.leave) cur.leave(); cur = null; i = -1; el.hidden = true; onEnd && onEnd(!!finished); }

  next.addEventListener('click', () => show(i + 1));
  card.querySelector('.tskip').addEventListener('click', () => stop(false));
  addEventListener('resize', place);

  return {
    start(list){ steps = list; el.hidden = false; show(0); },
    stop, tick,
    get active(){ return !!cur; },
  };
}
