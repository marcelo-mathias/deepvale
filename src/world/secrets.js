// Things hidden under the forest canopy. Clearing a tile uncovers what is there.
// They are placed from a seed kept in the save, so the same valley keeps the same secrets.
import { GW, GH, WILD, idx, inGrid, GROW } from './constants.js';

export const SECRET_TYPES = {
  hermit:    { n:4, fixed:true, hint:'smoke', hintTxt:'A thread of campfire smoke rises from the trees.' },
  cache:     { n:3, hint:'glint', hintTxt:'Something glints between the trunks.' },
  blueprint: { n:3, hint:'glint', hintTxt:'Something glints between the trunks.' },
  bones:     { n:2, hint:'birds', hintTxt:'Crows circle above this part of the wood.' },
  stones:    { n:3, fixed:true, hint:'birds', hintTxt:'Crows circle above this part of the wood.' },
  shrine:    { n:2, hint:'light', hintTxt:'A soft light hangs over the treetops here.' },
  clay:      { n:4, hint:'soil',  hintTxt:'The soil under the ferns is red.' },
  grove:     { n:3, hint:'none',  hintTxt:'Old cedars, taller than the rest.' },
  chest:     { n:0, hint:'glint', hintTxt:'The corner of an old chest pokes out of the moss.' }, // dropped over time, not placed at the start
  // landmarks: one of each, deep in the wood
  temple:    { n:1, hint:'bell',  hintTxt:'A bell rings somewhere under the canopy, slow and low.', big:true },
  elder:     { n:1, hint:'tall',  hintTxt:'One crown rises far above the rest of the forest.', big:true },
  tower:     { n:1, hint:'beam',  hintTxt:'A beam of light sweeps the treetops at dusk.', big:true },
  gate:      { n:1, hint:'mist',  hintTxt:'Mist pools here even at noon, around something carved.', big:true },
};
// the bigger valley has more to find: the small finds scale with its area, landmarks stay one each
const COUNT = (t, d) => d.big || d.fixed ? d.n : Math.round(d.n * Math.max(1, GROW * GROW * .8));

function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// tiles: current tile types. Secrets only go on forest at least `minGap` tiles from any cleared land, and apart from each other.
// cur: the valley as it is now. Landmarks also need it to be wild there (a grown save may have cleared the middle).
export function makeSecrets(seed, tiles, cur){
  const R = mulberry(seed);
  const out = [];
  const far = (i, j, T = tiles) => { for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++){ const ni = i+a, nj = j+b; if (inGrid(ni, nj) && T[idx(ni, nj)] !== WILD && Math.max(Math.abs(a), Math.abs(b)) <= 3) return false; } return true; };
  // landmarks keep well clear of the valley's edge (tile 3: past the outline) so they never sit on the slope behind it
  const roomy = (i, j, T) => { for (let b = -6; b <= 6; b++) for (let a = -6; a <= 6; a++){ const ni = i+a, nj = j+b; if (!inGrid(ni, nj) || T[idx(ni, nj)] === 3) return false; } return true; };
  const apart = (i, j, big) => out.every(s => Math.max(Math.abs(s.i - i), Math.abs(s.j - j)) >= (big || SECRET_TYPES[s.type].big ? 8 : 4));
  // landmarks first, so they get the deep forest
  const order = Object.entries(SECRET_TYPES).sort(([, a], [, b]) => (b.big ? 1 : 0) - (a.big ? 1 : 0)).flatMap(([t, d]) => Array.from({ length: COUNT(t, d) }, () => t));
  for (const type of order){
    const big = SECRET_TYPES[type].big;
    for (let tries = 0; tries < 600; tries++){
      const i = 1 + Math.floor(R() * (GW - 2)), j = 1 + Math.floor(R() * (GH - 2));
      if (tiles[idx(i, j)] !== WILD || !far(i, j) || !apart(i, j, big)) continue;
      if (big && Math.min(i, j, GW - 1 - i, GH - 1 - j) < 3) continue;
      if (big && cur && (cur[idx(i, j)] !== WILD || !far(i, j, cur))) continue;
      if (big && !roomy(i, j, cur || tiles)) continue;
      out.push({ type, i, j, k: idx(i, j), r: R() }); break;
    }
  }
  return out;
}

// Old channels: where the river used to run before the valley was damaged. Dry, sunken beds that leave
// the river and rejoin it. Restoring them is the gentle way to widen the river. One runs close beside the
// main channel so that, with the strip between dug out too, it opens a reach wide enough for the largest fish.
import { tileC, riverZ } from './constants.js';
// legacyOff: a save from the 44-wide valley keeps its channels where they were, shifted into the bigger grid
export function makeChannels(seed, tiles, legacyOff){
  const R = mulberry(seed ^ 0x5eed), out = new Uint8Array(GW * GH);
  const g = legacyOff !== undefined ? 1 : GROW, o = legacyOff || 0, at = v => Math.round(v * g) + o;
  const specs = [
    { i0: at(13), len: Math.round(18 * g), side: R() < .5 ? 1 : -1, d: 3.2, w: 3.2 },            // the braided reach, near the village
    { i0: at(2), len: Math.round((10 + Math.floor(R() * 4)) * g), side: 1, d: 4 + R() * 2, w: 3.2 },
    { i0: at(26 + Math.floor(R() * 3)), len: Math.round((12 + Math.floor(R() * 4)) * g), side: -1, d: 4 + R() * 2.5, w: 3.2 },
    { i0: at(5 + Math.floor(R() * 4)), len: Math.round(9 * g), side: -1, d: 3.5 + R() * 1.5, w: 2.8 },
    { i0: at(30), len: Math.round(11 * g), side: 1, d: 4 + R() * 1.5, w: 2.8 },
  ];
  // the wider valley has two more, far out where the river leaves and enters
  if (legacyOff === undefined){ specs.push({ i0: 1, len: 12, side: -1, d: 6 + R() * 2, w: 3 }, { i0: GW - 15, len: 13, side: 1, d: 6 + R() * 2, w: 3 }); }
  for (const s of specs){
    for (let i = s.i0; i < Math.min(GW, s.i0 + s.len); i++){
      const t = (i - s.i0 + .5) / s.len, x = tileC(i, 0).x;
      const zc = riverZ(x) + s.side * s.d * Math.pow(Math.sin(Math.PI * t), .6) + Math.sin(i * .9 + s.i0) * .35;
      for (let j = 0; j < GH; j++){ const z = tileC(i, j).z; if (Math.abs(z - zc) < s.w / 2 + (t < .15 || t > .85 ? .6 : 0) && tiles[idx(i, j)] !== 2 && tiles[idx(i, j)] !== 3) out[idx(i, j)] = 1; }
    }
  }
  return out;
}
