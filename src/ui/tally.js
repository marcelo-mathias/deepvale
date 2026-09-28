// The release tally: when a fish is let go, its scales are counted up line by line —
// base, then every blessing that multiplies it — and the total lands with a little bump.
import { fmt } from '../core/utils.js';

export function makeTally(host, sfx){
  const live = [];
  function show({ x, y, big = false, title = '', rows, total, col }){
    const el = document.createElement('div');
    el.className = 'tally' + (big ? ' big' : '');
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (col) el.style.setProperty('--tc', col);
    el.innerHTML = (title ? `<div class="tt">${title}</div>` : '') + '<div class="tr-rows"></div><div class="tsum"><span class="eq">=</span><span class="tv">0</span><span class="tu">scales</span></div>';
    host.appendChild(el); live.push(el);
    // keep small tallies from stacking on top of each other
    const others = live.filter(o => o !== el && !o.classList.contains('big'));
    if (!big && others.length) el.style.marginTop = (-18 * Math.min(3, others.length)) + 'px';
    const rowsEl = el.querySelector('.tr-rows'), tv = el.querySelector('.tv');
    let run = 0, i = 0; const step = big ? 420 : 170;
    const next = () => {
      if (i >= rows.length){
        countTo(tv, run, total, big ? 500 : 250, () => { el.classList.add('done'); sfx && sfx('tally-end', big ? 1 : 0); });
        setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); live.splice(live.indexOf(el), 1); }, 900); }, big ? 3800 : 1700);
        return;
      }
      const r = rows[i++]; const row = document.createElement('div'); row.className = 'trow ' + r.k;
      row.innerHTML = `<span class="tl">${r.t}</span><span class="tvv">${r.k === 'x' ? '×' + (+r.v).toFixed(2).replace(/\.?0+$/, '') : r.k === 'add' ? '+' + fmt(r.v) : fmt(r.v)}</span>`;
      rowsEl.appendChild(row);
      const before = run; run = r.k === 'x' ? run * r.v : r.k === 'add' ? run + r.v : r.v;
      countTo(tv, before, run, step * .8);
      sfx && sfx('tick', i);
      setTimeout(next, step);
    };
    setTimeout(next, big ? 300 : 60);
  }
  function countTo(el, a, b, ms, done){
    const t0 = performance.now();
    const f = () => { const k = Math.min(1, (performance.now() - t0) / ms); el.textContent = fmt(Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(f); else { el.textContent = fmt(Math.round(b)); done && done(); } };
    f();
  }
  return { show };
}
