// The Reach map: a small pixel map of the river's whole course. Charted valleys can be travelled to from here.
import { fbm, clamp, smooth } from '../core/utils.js';
import { REGIONS } from '../data/lore.js';

const W = 192, H = 120;
// river course in map space (0..1)
const RIVER = [[.06,.12],[.14,.2],[.22,.3],[.3,.4],[.36,.44],[.44,.47],[.52,.52],[.6,.6],[.66,.66],[.74,.7],[.82,.76],[.9,.82],[1.02,.9]];
const TRIB = [[.6,.2],[.58,.32],[.55,.42],[.52,.52]];
const BIOME = { tarn:[196,214,220], deepvale:[92,124,64], birch:[196,190,160], ashfen:[74,58,48], salt:[150,170,160] };

function distSeg(px, py, pts){ let best = 9;
  for (let i = 0; i < pts.length - 1; i++){ const [ax, ay] = pts[i], [bx, by] = pts[i+1]; const vx = bx-ax, vy = by-ay;
    const t = clamp(((px-ax)*vx + (py-ay)*vy) / (vx*vx + vy*vy), 0, 1); best = Math.min(best, Math.hypot(px-ax-vx*t, py-ay-vy*t)); }
  return best; }

function paint(cv){
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const u = x / W, v = y / H;
    // height: mountains to the north-west, sea to the south-east
    let h = fbm(u*6+2, v*6+5, 4) * .7 + (1 - u*.7 - v*.6) * .9 + Math.exp(-((u-.18)**2 + (v-.12)**2) / .02) * .9;
    const rd = distSeg(u, v*H/W, RIVER.map(([a, b]) => [a, b*H/W])), td = distSeg(u, v*H/W, TRIB.map(([a, b]) => [a, b*H/W]));
    h -= smooth(.05, 0, Math.min(rd, td)) * .35;
    // biome tint by nearest region
    let bc = [110, 128, 80], bw = 0;
    for (const r of REGIONS){ const dd = Math.hypot(u - r.x, (v - r.y)*H/W); const w = Math.exp(-dd*dd / .012); if (w > bw){ bw = w; bc = BIOME[r.id]; } }
    let c = [96 + h*50, 112 + h*40, 72 + h*24];
    c = c.map((cc, i) => cc + (bc[i] - cc) * clamp(bw*1.3, 0, .75));
    if (h > 1.35) c = c.map((cc) => cc + (236 - cc) * smooth(1.35, 1.6, h)); // snow
    const sea = u + v*.8 > 1.72 + fbm(u*9, v*9, 2)*.12;
    if (sea) c = [34, 64, 72];
    // contour lines
    const band = h * 9, fr = band - Math.floor(band);
    if (!sea && (fr < .09)) c = c.map(cc => cc * .78);
    if (rd < .012 || td < .008) c = [120, 200, 190];
    else if (rd < .02 || td < .014) c = [58, 110, 106];
    // parchment darkening toward the edges
    const vig = smooth(.75, .3, Math.hypot(u-.5, (v-.5)*.9));
    c = c.map(cc => cc * (.55 + .45*vig));
    const dither = ((x & 1) ^ (y & 1)) * 4;
    const k = (y*W + x) * 4; d[k] = c[0] + dither; d[k+1] = c[1] + dither; d[k+2] = c[2] + dither; d[k+3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// state(): { here: the valley you're in, open: {id: true} for charted ones, onTravel(id), lockText: {id: why it's shut} }
export function initMap(root, { onOpen, state = () => ({ here: 'deepvale', open: { deepvale: true } }) } = {}){
  const cv = root.querySelector('canvas'); cv.width = W; cv.height = H; paint(cv);
  const pins = root.querySelector('.pins'), card = root.querySelector('.region'), intro = root.querySelector('#mapIntro');
  const show = r => { const st = state(), here = r.id === st.here, open = !!st.open[r.id];
    const foot = here ? `<div class="rl here">You are here</div>`
      : open ? `<div class="rl open">Charted · your village there keeps going while you’re away</div><button type="button" class="nav go" data-go="${r.id}">Travel to ${r.name}</button>`
      : `<div class="rl">${st.lockText?.[r.id] || r.lock}</div>`;
    card.innerHTML = `<div class="rb">${r.biome}</div><div class="rn">${r.name}</div><p>${r.teaser}</p>${foot}`;
    card.querySelector('[data-go]')?.addEventListener('click', () => st.onTravel?.(r.id));
    pins.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === r.id)));
  };
  const draw = () => { const st = state(); pins.innerHTML = '';
    for (const r of REGIONS){ const here = r.id === st.here, open = !!st.open[r.id];
      const b = document.createElement('button'); b.type = 'button'; b.dataset.id = r.id; b.className = 'pin' + (here ? ' here' : open ? ' open' : ' locked') + (r.x > .75 ? ' flip' : '');
      b.style.left = (r.x * 100) + '%'; b.style.top = (r.y * 100) + '%';
      b.innerHTML = `<i></i><span>${r.name}</span>`; b.addEventListener('click', () => show(r)); b.addEventListener('mouseenter', () => show(r));
      pins.appendChild(b); }
    const charted = REGIONS.filter(r => st.open[r.id]).map(r => r.name);
    if (intro) intro.textContent = `From the Hollow Tarn to the sea. ${charted.length > 1 ? `Charted: ${charted.join(' and ')}.` : 'Only Deepvale has been charted.'}`;
    show(REGIONS.find(r => r.id === st.here) || REGIONS[1]); };
  draw();
  return { toggle(){ root.hidden = !root.hidden; if (!root.hidden){ draw(); onOpen?.(); } } };
}
