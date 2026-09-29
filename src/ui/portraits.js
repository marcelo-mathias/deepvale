// Keeper portraits: little animal folk in travelling clothes, drawn once per keeper on a 32×32 grid.
// Style: 3/4 view facing right, flat colour regions with one light and one shadow tone,
// a dark 1-px outline around everything, muted earthy palette with teal cloth accents.
const N = 32, OUT = '#2a1d17';
const cache = {};

// colour ramps: [light, base, shadow]
const C = {
  greyfur: ['#b9aebb', '#8c8090', '#655a6a'], brownfur: ['#c9955f', '#9a6a3e', '#6e4526'], redfur: ['#e0874a', '#c0612e', '#8a3f1c'],
  darkfur: ['#6a6070', '#4a4250', '#322b38'], cream: ['#f2e6cf', '#e0cfb2', '#bfa98a'], frog: ['#d9b64a', '#b8932e', '#86661c'],
  toad: ['#6f9a7a', '#4f7a5f', '#355845'], shell: ['#8a9a5a', '#6b7a3f', '#4a5a2c'], heron: ['#c9d2da', '#9aa6b2', '#6f7a86'],
  owl: ['#b08a5a', '#8a6a42', '#5f4628'], teal: ['#3f9488', '#2c7268', '#1d5049'], olive: ['#b8c050', '#94a038', '#6f7a26'],
  leather: ['#b0643a', '#8a4a2a', '#62321c'], straw: ['#e8cf82', '#caa85a', '#9a7c3a'], red: ['#c85a44', '#a03e2c', '#72281c'],
  plum: ['#9a6a8a', '#7a4a6a', '#5a3050'], moss: ['#8fb05a', '#6f9040', '#4f6a2c'], blue: ['#6a8ab8', '#4a6a98', '#324a70'],
  ink: ['#3a2a20', '#2a1d17', '#1a120e'], glow: ['#fff0b0', '#ffc46a', '#d88a2a'], brass: ['#e8c87a', '#c9a35a', '#8a6a30'],
};
function grid(){ return Array.from({ length: N }, () => new Array(N).fill(null)); }
// every drawing op writes a region id; each region has a ramp; shading is done per region afterwards
function makeCanvasFor(ops){
  const g = grid(), reg = []; let rid = 0;
  const region = ramp => { reg.push(ramp); return rid++; };
  const set = (x, y, r) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = r; };
  const api = {
    ell(cx, cy, rx, ry, ramp){ const r = region(ramp); for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++){ const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) set(x, y, r); } return r; },
    rect(x0, y0, w, h, ramp){ const r = region(ramp); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, r); return r; },
    poly(pts, ramp){ const r = region(ramp); const ys = pts.map(p => p[1]); for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = 0; x < N; x++){ let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (((yi > y + .5) !== (yj > y + .5)) && (x + .5 < (xj - xi) * (y + .5 - yi) / (yj - yi) + xi)) inside = !inside; }
        if (inside) set(x, y, r); } return r; },
    px(x, y, ramp){ const r = region(ramp); set(x, y, r); return r; },
    flat: ramp => [ramp[1], ramp[1], ramp[1]],
  };
  ops(api);
  const size = reg.map(() => 0); for (const row of g) for (const r of row) if (r !== null) size[r]++; const big = size.map(n => n > 14);
  // shade: the pixel below-right leaving the region goes dark, the pixel above-left leaving it goes light
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d');
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? null : g[y][x];
  // background: soft sunlit wash
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const d = Math.hypot(x - 12, y - 8) / 30; c.fillStyle = `rgb(${Math.round(222 - d * 50)},${Math.round(214 - d * 44)},${Math.round(182 - d * 40)})`; c.fillRect(x, y, 1, 1); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const r = g[y][x]; if (r === null) continue; const ramp = reg[r];
    const dark = at(x + 1, y) !== r && at(x, y + 1) !== r || at(x + 1, y + 1) !== r && at(x, y + 2) !== r;
    const light = at(x - 1, y) !== r && at(x, y - 1) !== r;
    c.fillStyle = light ? ramp[0] : dark ? ramp[2] : ramp[1]; c.fillRect(x, y, 1, 1);
  }
  // a dark seam where something drawn later sits on top of something drawn earlier (chin over cloak, hat over head)
  c.fillStyle = OUT;
  for (let y = 1; y < N; y++) for (let x = 0; x < N; x++){ const r = g[y][x], up = g[y - 1][x]; if (r !== null && up !== null && up > r + 1 && reg[up] !== reg[r] && big[up]) c.fillRect(x, y, 1, 1); }
  // outline: every empty pixel touching a filled one
  c.fillStyle = OUT;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === null && [[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => at(x + a, y + b) !== null)) c.fillRect(x, y, 1, 1);
  // inner detail lines drawn last (eyes, mouths, seams) via api.detail
  (ops.detail || (() => {}))(c);
  return cv;
}

// the cloak or cloth that every traveller wears, with a strap and patches (drawn first, head sits on top)
function outfit(a, o){
  const cloth = o.cloth || C.teal;
  a.poly([[5, 32], [7, 23], [12, 20], [21, 20], [26, 24], [28, 32]], cloth);
  if (o.pack) a.ell(6, 22, 4.5, 5, C.leather);
  if (o.scarf !== false) a.poly([[12, 20], [22, 20], [19, 26], [16, 27]], o.scarf || C.olive);
  a.rect(9, 22, 2, 10, C.leather); // strap
}
// heads, 3/4 view facing right
const HEAD = {
  rabbit(a, o){ const f = o.fur || C.greyfur; a.poly([[12, 1], [15, 1], [15, 10], [12, 10]], f); a.poly([[16, 2], [19, 3], [18, 11], [16, 11]], f); a.px(13, 3, C.cream); a.px(13, 4, C.cream); a.px(13, 5, C.cream);
    a.ell(16, 14, 6, 6, f); a.ell(20, 16, 3.5, 3, C.cream); },
  frog(a, o){ const f = o.fur || C.frog; a.ell(16, 15, 8, 6, f); a.ell(19, 9, 3.4, 3.4, f); a.ell(12, 10, 2.6, 2.6, f); a.ell(18, 18, 6, 2.6, C.cream); },
  fox(a, o){ const f = o.fur || C.redfur; a.poly([[10, 3], [14, 8], [10, 10]], f); a.poly([[16, 3], [19, 9], [15, 9]], f); a.ell(15, 13, 6, 5.5, f); a.poly([[17, 12], [26, 16], [17, 19]], f); a.ell(19, 17, 4, 2.5, C.cream); a.px(25, 16, C.ink); },
  badger(a, o){ const f = o.fur || C.darkfur; a.ell(15, 14, 7, 6, f); a.poly([[15, 9], [26, 15], [18, 18]], C.cream); a.ell(11, 9, 2, 2, f); a.ell(18, 9, 2, 2, f); a.px(25, 15, C.ink); },
  owl(a, o){ const f = o.fur || C.owl; a.ell(16, 13, 8, 8, f); a.poly([[9, 4], [12, 8], [8, 9]], f); a.poly([[22, 4], [24, 9], [20, 8]], f); a.ell(13, 12, 3, 3, C.cream); a.ell(19, 12, 3, 3, C.cream); a.poly([[16, 14], [18, 14], [16, 18]], C.straw); },
  otter(a, o){ const f = o.fur || C.brownfur; a.ell(15, 14, 7, 6, f); a.ell(20, 16, 4, 3, C.cream); a.ell(10, 9, 1.6, 1.6, f); a.ell(19, 9, 1.6, 1.6, f); a.px(23, 15, C.ink); },
  mole(a, o){ const f = o.fur || C.darkfur; a.ell(15, 15, 7, 6.5, f); a.poly([[19, 14], [27, 16], [19, 18]], [ '#e8a0a0', '#d88a8a', '#b06a6a']); a.px(26, 16, C.red); },
  heron(a, o){ const f = o.fur || C.heron; a.ell(14, 12, 5.5, 6, f); a.poly([[17, 12], [29, 14], [17, 15]], C.straw); a.poly([[9, 7], [6, 4], [11, 8]], C.ink); a.rect(12, 17, 5, 5, f); },
  tortoise(a, o){ const f = o.fur || C.toad; a.ell(16, 15, 6, 5.5, f); a.ell(21, 16, 3, 2.5, f); },
  deer(a, o){ const f = o.fur || C.brownfur; a.poly([[10, 1], [11, 6], [9, 7], [8, 3]], C.cream); a.poly([[19, 1], [18, 6], [20, 7], [21, 3]], C.cream); a.poly([[9, 8], [12, 11], [8, 12]], f); a.ell(15, 13, 6, 6, f); a.ell(20, 16, 4, 3, C.cream); a.px(23, 15, C.ink); },
  bear(a, o){ const f = o.fur || C.brownfur; a.ell(10, 7, 2.6, 2.6, f); a.ell(20, 7, 2.6, 2.6, f); a.ell(15, 13, 7.5, 7, f); a.ell(20, 16, 4, 3, C.cream); a.px(23, 15, C.ink); },
  mouse(a, o){ const f = o.fur || C.greyfur; a.ell(10, 6, 4, 4, f); a.ell(19, 5, 4, 4, f); a.ell(10, 6, 2, 2, ['#f0c0c0', '#e0a0a0', '#c08080']); a.ell(19, 5, 2, 2, ['#f0c0c0', '#e0a0a0', '#c08080']); a.ell(15, 13, 6, 5.5, f); a.ell(20, 15, 3.5, 2.5, C.cream); a.px(23, 15, '#e0a0a0'); },
  cat(a, o){ const f = o.fur || C.greyfur; a.poly([[9, 3], [13, 8], [9, 10]], f); a.poly([[20, 3], [21, 10], [16, 8]], f); a.ell(15, 13, 7, 6, f); a.ell(19, 16, 3.5, 2.5, C.cream); a.px(21, 15, '#e0a0a0'); },
};
// eyes and small face details, drawn after outline so they stay crisp
const FACE = {
  default: (c, o) => { const [x, y] = o.eye || [18, 12]; c.fillStyle = '#f5ecd8'; c.fillRect(x - 1, y - 1, 3, 3); c.fillStyle = OUT; c.fillRect(x, y, 2, 2); if (o.eye2) { c.fillRect(o.eye2[0], o.eye2[1], 1, 2); } },
  owl: c => { for (const x of [13, 19]){ c.fillStyle = '#ffd24a'; c.fillRect(x - 1, 11, 3, 3); c.fillStyle = OUT; c.fillRect(x, 12, 1, 1); } },
  frog: c => { c.fillStyle = '#f5ecd8'; c.fillRect(18, 8, 3, 3); c.fillStyle = OUT; c.fillRect(19, 9, 2, 2); c.fillRect(12, 9, 1, 2); c.fillRect(17, 16, 7, 1); },
  mole: c => { c.fillStyle = '#f5ecd8'; c.fillRect(17, 12, 2, 2); c.fillStyle = OUT; c.fillRect(18, 13, 1, 1); },
};
// hats and props
const HAT = {
  straw(a){ a.poly([[5, 7], [25, 5], [26, 7], [6, 9]], C.straw); a.ell(15, 5, 5.5, 3, C.straw); a.rect(10, 6, 11, 1, C.red); },
  cap(a, o){ a.ell(14, 7, 6.5, 3.5, o.capc || C.blue); a.rect(17, 7, 7, 2, o.capc || C.blue); },
  hood(a, o){ a.poly([[6, 20], [7, 8], [13, 3], [20, 4], [24, 9], [24, 13], [19, 9], [12, 9], [10, 20]], o.hoodc || C.plum); },
  double(a){ a.ell(12, 6, 5, 2, C.leather); a.rect(9, 1, 6, 5, C.leather); a.ell(18, 4, 4, 1.6, C.teal); a.rect(16, 0, 4, 4, C.teal); },
  moss(a){ a.poly([[7, 14], [9, 7], [15, 3], [21, 5], [24, 10], [20, 9], [12, 9], [10, 15]], C.moss); a.px(12, 5, C.olive); a.px(18, 5, C.olive); a.px(9, 10, C.olive); },
  bun(a, o){ a.ell(11, 5, 3, 3, o.fur || C.greyfur); a.rect(9, 7, 5, 1, C.red); },
  reed(a){ a.rect(6, 4, 1, 16, C.olive); a.rect(8, 7, 1, 13, C.olive); a.ell(6, 5, 1, 2, C.leather); a.ell(8, 8, 1, 2, C.leather); },
  scarf(a){ a.poly([[8, 19], [24, 18], [23, 21], [9, 22]], C.red); a.rect(20, 21, 3, 5, C.red); },
  apron(a){ a.poly([[13, 21], [22, 21], [22, 32], [13, 32]], C.cream); },
  lantern(a){ a.rect(25, 18, 1, 3, C.ink); a.rect(24, 21, 4, 5, C.glow); a.rect(24, 21, 4, 1, C.ink); },
  staff(a){ a.rect(26, 6, 2, 26, C.leather); a.px(25, 7, C.leather); },
  net(a){ a.poly([[22, 20], [30, 22], [29, 32], [22, 32]], ['#5f7a78', '#4a6260', '#324644']); },
  glasses(c){ c.fillStyle = C.brass[1]; c.fillRect(16, 11, 5, 1); c.fillRect(16, 13, 5, 1); c.fillRect(16, 11, 1, 3); c.fillRect(20, 11, 1, 3); },
};
const KEEPER_LOOK = {
  netmender: { head: 'otter', hat: 'cap', props: ['net'], scarf: C.olive, cloth: C.teal },
  ottoline:  { head: 'rabbit', fur: C.greyfur, hat: 'bun', scarf: C.red, cloth: C.plum },
  carter:    { head: 'badger', hat: 'straw', props: ['staff'], pack: true, cloth: C.teal },
  wren:      { head: 'frog', props: ['reed'], scarf: C.teal, cloth: C.olive, face: 'frog' },
  kiln:      { head: 'mole', props: ['apron'], scarf: false, cloth: C.leather, face: 'mole' },
  ferry:     { head: 'heron', hat: 'hood', hoodc: C.teal, cloth: C.blue, scarf: false, eye: [15, 11] },
  tamsin:    { head: 'fox', hat: 'double', cloth: C.teal, scarf: C.straw },
  moss:      { head: 'tortoise', hat: 'moss', cloth: C.moss, scarf: C.leather, eye: [18, 13] },
  pell:      { head: 'owl', props: ['scarf'], scarf: false, cloth: C.plum, face: 'owl' },
  ysolde:    { head: 'deer', props: ['lantern'], cloth: C.teal, scarf: C.red },
  garrow:    { head: 'bear', hat: 'straw', props: ['staff'], pack: true, cloth: C.olive, scarf: C.teal },
  fen:       { head: 'mouse', cloth: C.teal, scarf: C.straw, pack: true },
  quill:     { head: 'cat', hat: 'cap', capc: C.leather, cloth: C.blue, scarf: C.cream, glasses: true },
  maud:      { head: 'frog', fur: C.toad, cloth: C.blue, scarf: C.teal, face: 'frog', props: ['net'] },
};
export function portrait(id){
  if (cache[id]) return cache[id];
  const o = KEEPER_LOOK[id] || { head: 'rabbit', pack: true };
  const draw = a => {
    if (o.hat === 'hood' || o.hat === 'moss') HAT[o.hat](a, o); // hoods sit behind the head
    if ((o.props || []).includes('reed')) HAT.reed(a, o);
    outfit(a, o); if ((o.props || []).includes('apron')) HAT.apron(a, o);
    HEAD[o.head](a, o);
    if (o.hat && o.hat !== 'hood' && o.hat !== 'moss') HAT[o.hat](a, o);
    for (const p of o.props || []) if (!['reed', 'apron'].includes(p)) HAT[p](a, o);
  };
  draw.detail = c => { (FACE[o.face] || FACE.default)(c, o); if (o.glasses) HAT.glasses(c); c.strokeStyle = OUT; c.lineWidth = 1; c.strokeRect(.5, .5, N - 1, N - 1); };
  return (cache[id] = makeCanvasFor(draw).toDataURL());
}
