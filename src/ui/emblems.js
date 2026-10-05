// Currency emblems: round medallions in the manner of painted faction seals. A ring of alternating wedges,
// a bold central glyph, and a painterly swirl laid over everything (an SVG turbulence filter, soft-light blended).
// Each call gets its own ids, so several emblems can share a page.
let uid = 0;
const P = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
const star = (n, ro, ri, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, k) => P(50, 50, k % 2 ? ri : ro, rot + k * Math.PI / n).map(v => v.toFixed(1)).join(',')).join(' ');
const wedges = (n, a, b, rot = 0) => Array.from({ length: n }, (_, k) => {
  const a0 = rot + k * 2 * Math.PI / n, a1 = rot + (k + 1) * 2 * Math.PI / n, [x0, y0] = P(50, 50, 49, a0), [x1, y1] = P(50, 50, 49, a1);
  return `<path d="M50 50L${x0.toFixed(1)} ${y0.toFixed(1)}A49 49 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z" fill="${k % 2 ? b : a}"/>`; }).join('');

// palette: base wedges (a, b), inner disc, glyph light, glyph shade, rim
export const EMBLEMS = {
  scales:   { name: 'Scales',   col: '#7fe0c0', a: '#1f5f55', b: '#2b7a69', disc: '#173f39', g: '#bff5dc', s: '#5cc4a0', rim: '#0f2c27',
    glyph: (g, s) => `<path d="M50 14C70 30 78 52 50 86C22 52 30 30 50 14Z" fill="${g}"/><path d="M50 34C62 44 64 58 50 76C36 58 38 44 50 34Z" fill="${s}"/>
      <path d="M36 50Q50 40 64 50M38 62Q50 52 62 62" stroke="${g}" stroke-width="3" fill="none" opacity=".8"/>` },
  silver:   { name: 'Silver',   col: '#d8e4ea', a: '#5d7583', b: '#7f97a4', disc: '#4a5f6b', g: '#f3d06a', s: '#ffffff', rim: '#2e3d45',
    glyph: (g, s) => `<polygon points="${star(8, 40, 17)}" fill="#eef4f6"/><polygon points="${star(8, 33, 14, -Math.PI / 2 + Math.PI / 8)}" fill="${g}"/><polygon points="${star(4, 26, 5)}" fill="${s}"/>` },
  timber:   { name: 'Timber',   col: '#c8b27a', a: '#34452c', b: '#475c38', disc: '#26331f', g: '#e3cf92', s: '#9fb36a', rim: '#1a2415',
    glyph: (g, s) => `<path d="M50 12L70 40H61L76 60H58V84H42V60H24L39 40H30Z" fill="${g}"/><path d="M50 24L62 40H38Z M50 44L64 58H36Z" fill="${s}" opacity=".85"/>` },
  reeds:    { name: 'Reeds',    col: '#d6df88', a: '#3f5e36', b: '#557a42', disc: '#2d4627', g: '#e9ee9e', s: '#a6c46a', rim: '#1d2e19',
    glyph: (g, s) => `<path d="M50 86C46 60 44 36 50 12C56 36 54 60 50 86Z" fill="${g}"/><path d="M47 86C36 66 26 48 22 28C34 44 42 62 52 84Z" fill="${s}"/>
      <path d="M53 86C64 66 74 48 78 28C66 44 58 62 48 84Z" fill="${s}"/><ellipse cx="50" cy="20" rx="4" ry="9" fill="#7a5a32"/>` },
  clay:     { name: 'Clay',     col: '#eab08a', a: '#8c3f27', b: '#a9553a', disc: '#6e301e', g: '#f6d5b8', s: '#d98a62', rim: '#4a1f12',
    glyph: (g, s) => `<path d="M38 18H62V26C57 28 57 33 62 35C76 44 78 68 64 82H36C22 68 24 44 38 35C43 33 43 28 38 26Z" fill="${g}"/>
      <path d="M30 52H70M28 62H72" stroke="${s}" stroke-width="4"/><path d="M41 72H59" stroke="${s}" stroke-width="3" opacity=".7"/>` },
  lanterns: { name: 'Lanterns', col: '#ffc56a', a: '#c4631f', b: '#e08a2e', disc: '#9b4416', g: '#fff1d6', s: '#ffb54a', rim: '#5e2a0c',
    glyph: (g, s) => `<circle cx="50" cy="40" r="17" fill="none" stroke="${g}" stroke-width="10"/><circle cx="50" cy="40" r="7" fill="${s}"/><path d="M45 56H55V86H45Z" fill="${g}"/>` },
  carvings: { name: 'Carvings', col: '#e2a8ff', a: '#4a3478', b: '#6a4aa3', disc: '#352458', g: '#f2c8ff', s: '#d06ae8', rim: '#21153a',
    glyph: (g, s) => `<path d="M22 22C30 40 36 46 50 48C64 46 70 40 78 22C80 44 70 62 50 84C30 62 20 44 22 22Z" fill="${s}" opacity=".85"/>
      <path d="M50 32L66 52L50 72L34 52Z" fill="${g}"/><path d="M50 42L58 52L50 62L42 52Z" fill="${s}"/>` },
};

export function emblem(kind, cls = 'emb'){
  const e = EMBLEMS[kind] || EMBLEMS.silver, u = 'em' + (++uid), seed = (uid * 13) % 97;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><clipPath id="c${u}"><circle cx="50" cy="50" r="49"/></clipPath>
      <filter id="t${u}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".014 .075" numOctaves="3" seed="${seed}"/>
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.2 0 0 0 -.85"/></filter></defs>
    <g clip-path="url(#c${u})">
      ${wedges(10, e.a, e.b, seed / 30)}
      <circle cx="50" cy="50" r="37" fill="${e.disc}" opacity=".55"/>
      ${e.glyph(e.g, e.s)}
      <rect x="-20" y="-20" width="140" height="140" filter="url(#t${u})" opacity=".42" style="mix-blend-mode:soft-light" transform="rotate(${seed * 3} 50 50)"/>
    </g>
    <circle cx="50" cy="50" r="48.5" fill="none" stroke="${e.rim}" stroke-width="2"/>
  </svg>`;
}
