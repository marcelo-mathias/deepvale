// Crate cards: markup and motion.
//  - cards rise into place from below the screen, one after another, each in its own shape (see below)
//  - idle: each card bobs out of step with the others, its edge breathes, motes drift up through its header
//  - hover: the card tilts toward the cursor with a sheen that follows it, the blessing "flows" along its
//    chain of sigils (what it touches → what it brings), and glints bloom from its corners
//  - choosing: the card rises and dissolves into light; the others sink away
import { icon } from './icons.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const CARD_COL = { boon: '#86dcbc', keeper: '#e2c48e', blueprint: '#9cc3ee', silver: '#d3dde3', coin: '#d3dde3' };
const TAG = { boon: 'Blessing', keeper: 'Keeper', blueprint: 'Blueprint', silver: 'Silver', coin: 'Treasure' };

// Each kind of card has its own silhouette and surface:
//   blessing  · an arched chapel window with a stained-glass head
//   keeper    · a hanging banner with a pointed foot; the portrait breaks out over the top
//   blueprint · a sheet pinned to the board: clipped corners, a torn foot, cyanotype grid, a building that draws itself
//   treasure  · a tablet with the currency's painted medallion set into a ribbed coin edge above it
// The face (.cf) is clipped to the shape, and a stroke traced over the same outline fades in from the foot.
const SHAPE = { boon: 'arch', keeper: 'banner', blueprint: 'sheet', coin: 'tablet', silver: 'tablet' };
let gid = 0;
// The painted swirl over the stained glass used to be a live feTurbulence filter, which the browser re-ran every
// time the card repainted (every frame while it moved). As an image it's rasterised once and cached.
const NOISE = [];
const noise = seed => NOISE[seed] ||= 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="250" height="150">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".02 .09" numOctaves="3" seed="${seed}"/>
  <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 2.2 0 0 0 -.9"/></filter><rect width="250" height="150" filter="url(#n)"/></svg>`);
const glass = () => { const cx = 125, cy = 150, n = 8, cols = ['#1f6b58', '#2c8a70', '#3fae8a', '#1a5a4b', '#57c7a0', '#2a7d66', '#3a9e7f', '#1d6352'];
  const pt = (a, r) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  let panes = '', lead = '';
  for (let k = 0; k < n; k++){ const a0 = Math.PI + k * Math.PI / n, a1 = a0 + Math.PI / n;
    panes += `<polygon points="${pt(a0, 58)} ${pt(a0, 190)} ${pt(a1, 190)} ${pt(a1, 58)}" fill="${cols[k]}"/>`;
    lead += `<line x1="${pt(a0, 105).split(',')[0]}" y1="${pt(a0, 105).split(',')[1]}" x2="${pt(a1, 105).split(',')[0]}" y2="${pt(a1, 105).split(',')[1]}"/>`; }
  for (let k = 0; k <= n; k++){ const a = Math.PI + k * Math.PI / n, [x1, y1] = pt(a, 58).split(','), [x2, y2] = pt(a, 190).split(','); lead += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
  ++gid;
  return `<svg class="glass" viewBox="0 0 250 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${panes}
    <path d="M${cx - 58} ${cy}A58 58 0 0 1 ${cx + 58} ${cy}Z" fill="#9ff0d0"/><path d="M${cx} ${cy - 44}L${cx + 14} ${cy - 20}L${cx} ${cy}L${cx - 14} ${cy - 20}Z" fill="#e8fff6"/>
    <g stroke="#0a1614" stroke-width="3">${lead}</g><path d="M${cx - 58} ${cy}A58 58 0 0 1 ${cx + 58} ${cy}" fill="none" stroke="#0a1614" stroke-width="3"/>
    <image href="${noise(gid % 6)}" width="250" height="150" opacity=".35" style="mix-blend-mode:soft-light"/></svg>`; };
const DRAW = `<svg class="cdraw" viewBox="0 0 214 110" aria-hidden="true"><circle class="cons" cx="107" cy="58" r="48"/><path class="cons" d="M10 58H204M107 6V110"/>
  <path class="ln" d="M57 58L107 22L157 58M65 52V98H149V52M97 98V74H117V98M75 64H89V78H75Z"/><path class="cons" d="M57 106H157M57 102V110M157 102V110"/></svg>`;

// info: { value:{from,to}|text, chain:[[icon,label],…], foot:{pips:[have,max]|null, text}, emblem }
export function cardHTML(cd, info = {}, portraitSrc){
  const v = info.value, shape = SHAPE[cd.type] || 'tablet';
  const val = !v ? '' : typeof v === 'string' ? `<div class="cv"><b>${v}</b></div>`
    : v.from ? `<div class="cv"><s>${v.from}</s><i class="arr">→</i><b>${v.to}</b></div>` : `<div class="cv"><b>${v.to}</b></div>`;
  const chain = (info.chain || []).map(([ic, label], n) => `${n ? '<i class="link"></i>' : ''}<span class="sig" style="--n:${n}" title="${label}">${icon(ic)}<em>${label}</em></span>`).join('');
  const f = info.foot || {};
  const pips = f.pips ? `<span class="pips">${Array.from({ length: f.pips[1] }, (_, n) => `<i class="${n < f.pips[0] ? 'on' : n === f.pips[0] ? 'next' : ''}"></i>`).join('')}</span>` : '';
  const motes = Array.from({ length: 6 }, (_, n) => `<i class="mote" style="--m:${n};--mx:${(n * 37 + 11) % 100}%"></i>`).join('');
  // things that stand proud of the face sit outside it, so the clip doesn't cut them
  const proud = shape === 'banner' && portraitSrc ? `<img class="cport" src="${portraitSrc}" alt="">`
    : shape === 'tablet' && info.emblem ? `<i class="cribs"></i><div class="cmedal">${info.emblem}</div>`
    : shape === 'sheet' ? '<i class="cpin"></i>' : '';
  const inner = shape === 'arch' ? glass() : shape === 'banner' ? '<i class="cband"></i><i class="cgem"></i>' : shape === 'sheet' ? DRAW : '';
  return `<div class="cin shape-${shape}">
    <span class="ctag">${TAG[cd.type] || 'Gift'}</span>${proud}
    <div class="cf">${inner}
      <div class="chead">${motes}<div class="cn">${cd.name}</div>${chain ? `<div class="chain">${chain}</div>` : ''}</div>
      <div class="cbody">${val}<div class="cd">${info.desc || cd.desc}</div></div>
      <div class="cfoot">${pips}<span class="ft">${f.text || ''}</span></div>
      <i class="sheen"></i>
    </div>
    <svg class="cshade" aria-hidden="true"><defs><filter id="sh${++gid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="13"/></filter>
      <filter id="gl${gid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter></defs>
      <path class="sh" transform="translate(0 16)" filter="url(#sh${gid})"/><path class="gl" filter="url(#gl${gid})"/></svg>
    <svg class="cstroke" aria-hidden="true"><defs><linearGradient id="cs${++gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset=".3" stop-color="currentColor" stop-opacity=".12"/>
      <stop offset=".68" stop-color="currentColor" stop-opacity=".55"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
      <path stroke="url(#cs${gid})"/></svg>
  </div>`;
}
// the outline of each shape at its laid-out size
function outline(shape, w, h){
  if (shape === 'arch'){ const r = w / 2; return `M0 ${h}V${r}A${r} ${r} 0 0 1 ${w} ${r}V${h}Z`; }
  if (shape === 'banner') return `M0 0H${w}V${h - 44}L${w / 2} ${h}L0 ${h - 44}Z`;
  if (shape === 'sheet'){ const n = 12, t = 14; let d = `M${t} 0H${w - t}L${w} ${t}V${h - 8}`;
    for (let k = 1; k <= n; k++) d += `L${(w - k * w / n).toFixed(1)} ${k % 2 ? h : h - 8}`; return d + `V${t}Z`; }
  const r = 14; return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}
function shapeCard(el){
  const cin = el.querySelector('.cin'), cf = el.querySelector('.cf'), sv = el.querySelector('.cstroke'); if (!cin || !cf) return;
  const shape = cin.className.match(/shape-(\w+)/)?.[1] || 'tablet', w = cf.offsetWidth, h = cf.offsetHeight; if (!w || !h) return;
  const d = outline(shape, w, h); cf.style.clipPath = `path('${d}')`;
  sv.setAttribute('viewBox', `-1 -1 ${w + 2} ${h + 2}`); sv.style.cssText = `left:${cf.offsetLeft - 1}px;top:${cf.offsetTop - 1}px;width:${w + 2}px;height:${h + 2}px`;
  sv.querySelector('path').setAttribute('d', d);
  // the card's shadow and hover glow: the same outline, blurred once in its own layer (see .cshade in style.css)
  const sh = el.querySelector('.cshade'); if (sh){ const m = 40;
    sh.setAttribute('viewBox', `${-m} ${-m} ${w + 2 * m} ${h + 2 * m}`); sh.style.cssText = `left:${cf.offsetLeft - m}px;top:${cf.offsetTop - m}px;width:${w + 2 * m}px;height:${h + 2 * m}px`;
    sh.querySelectorAll('path').forEach(p => p.setAttribute('d', d)); }
}

// wire up one dealt card: tilt, sheen, glints. layer: the element glints are placed in
export function animateCard(el, n, layer){
  el.style.setProperty('--deal', n);
  shapeCard(el); requestAnimationFrame(() => shapeCard(el)); if (window.ResizeObserver) new ResizeObserver(() => shapeCard(el)).observe(el.querySelector('.cf'));
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
