// Crate cards: markup and motion.
//  - cards are dealt face down and flip over one after another
//  - idle: each card bobs out of step with the others, its edge breathes, motes drift up through its header
//  - hover: the card tilts toward the cursor with a sheen that follows it, the blessing "flows" along its
//    chain of sigils (what it touches → what it brings), and glints bloom from its corners
//  - choosing: the card rises and dissolves into light; the others sink away
import { icon } from './icons.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const CARD_COL = { boon: '#86dcbc', keeper: '#e2c48e', blueprint: '#9cc3ee', silver: '#d3dde3' };
const TAG = { boon: 'Blessing', keeper: 'Keeper', blueprint: 'Blueprint', silver: 'Silver' };

// info: { value:{from,to}|text, chain:[[icon,label],…], foot:{pips:[have,max]|null, text} }
export function cardHTML(cd, info = {}, portraitSrc){
  const v = info.value;
  const val = !v ? '' : typeof v === 'string' ? `<div class="cv"><b>${v}</b></div>`
    : v.from ? `<div class="cv"><s>${v.from}</s><i class="arr">→</i><b>${v.to}</b></div>` : `<div class="cv"><b>${v.to}</b></div>`;
  const chain = (info.chain || []).map(([ic, label], n) => `${n ? '<i class="link"></i>' : ''}<span class="sig" style="--n:${n}" title="${label}">${icon(ic)}<em>${label}</em></span>`).join('');
  const f = info.foot || {};
  const pips = f.pips ? `<span class="pips">${Array.from({ length: f.pips[1] }, (_, n) => `<i class="${n < f.pips[0] ? 'on' : n === f.pips[0] ? 'next' : ''}"></i>`).join('')}</span>` : '';
  const motes = Array.from({ length: 6 }, (_, n) => `<i class="mote" style="--m:${n};--mx:${(n * 37 + 11) % 100}%"></i>`).join('');
  return `<div class="cin">
    <div class="cf">
      <span class="ctag">${TAG[cd.type] || 'Gift'}</span>
      <div class="chead">${motes}${portraitSrc ? `<img class="cport" src="${portraitSrc}" alt="">` : ''}<div class="cn">${cd.name}</div>${chain ? `<div class="chain">${chain}</div>` : ''}</div>
      <div class="cbody">${val}<div class="cd">${info.desc || cd.desc}</div></div>
      <div class="cfoot">${pips}<span class="ft">${f.text || ''}</span></div>
      <i class="sheen"></i>
    </div>
    <div class="cbk"><i class="seal">${icon(cd.type === 'keeper' ? 'keeper' : cd.type === 'blueprint' ? 'build' : 'wish')}</i></div>
  </div>`;
}

// wire up one dealt card: tilt, sheen, glints. layer: the element glints are placed in
export function animateCard(el, n, layer){
  el.style.setProperty('--deal', n);
  el.style.setProperty('--bob', (n * 1.3) % 4 + 's');
  if (REDUCED) return;
  const glint = (x, y, s = 1) => { const g = document.createElement('i'); g.className = 'glint';
    const lr = layer.getBoundingClientRect(); g.style.left = (x - lr.left) + 'px'; g.style.top = (y - lr.top) + 'px'; g.style.setProperty('--s', s);
    g.style.setProperty('--c', getComputedStyle(el).getPropertyValue('--cc').trim() || '#fff3cf'); g.style.setProperty('--r', (Math.random() * 90 - 45) + 'deg');
    layer.appendChild(g); setTimeout(() => g.remove(), 1100); };
  let t = null;
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', ((.5 - y) * 12).toFixed(2) + 'deg'); el.style.setProperty('--ry', ((x - .5) * 14).toFixed(2) + 'deg');
    el.style.setProperty('--px', (x * 100).toFixed(1) + '%'); el.style.setProperty('--py', (y * 100).toFixed(1) + '%'); });
  el.addEventListener('pointerenter', () => { const burst = () => { const r = el.getBoundingClientRect(); const c = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]][Math.floor(Math.random() * 4)];
      glint(c[0] + (Math.random() - .5) * 20, c[1] + (Math.random() - .5) * 20, .6 + Math.random() * .6); };
    burst(); t = setInterval(burst, 340); });
  el.addEventListener('pointerleave', () => { clearInterval(t); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
}

// the chosen card rises into light, the others sink; resolves when it is safe to close
export function chooseCard(chosen, all){
  if (REDUCED) return Promise.resolve();
  chosen.classList.add('chosen'); all.forEach(c => { if (c !== chosen) c.classList.add('dismissed'); });
  chosen.closest('#crate')?.classList.add('flash');
  return new Promise(r => setTimeout(r, 820));
}
