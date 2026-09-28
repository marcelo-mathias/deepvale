// Things hidden under the forest canopy. Clearing a tile uncovers what is there.
// They are placed from a seed kept in the save, so the same valley keeps the same secrets.
import { GW, GH, WILD, idx, inGrid } from './constants.js';

export const SECRET_TYPES = {
  hermit:    { n:3, hint:'smoke', hintTxt:'A thread of campfire smoke rises from the trees.' },
  cache:     { n:3, hint:'glint', hintTxt:'Something glints between the trunks.' },
  blueprint: { n:3, hint:'glint', hintTxt:'Something glints between the trunks.' },
  bones:     { n:2, hint:'birds', hintTxt:'Crows circle above this part of the wood.' },
  stones:    { n:2, hint:'birds', hintTxt:'Crows circle above this part of the wood.' },
  shrine:    { n:2, hint:'light', hintTxt:'A soft light hangs over the treetops here.' },
  clay:      { n:4, hint:'soil',  hintTxt:'The soil under the ferns is red.' },
  grove:     { n:3, hint:'none',  hintTxt:'Old cedars, taller than the rest.' },
};

function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// tiles: current tile types. Secrets only go on forest at least `minGap` tiles from any cleared land, and apart from each other.
export function makeSecrets(seed, tiles){
  const R = mulberry(seed);
  const out = [];
  const far = (i, j) => { for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++){ const ni = i+a, nj = j+b; if (inGrid(ni, nj) && tiles[idx(ni, nj)] !== WILD && Math.max(Math.abs(a), Math.abs(b)) <= 3) return false; } return true; };
  const apart = (i, j) => out.every(s => Math.max(Math.abs(s.i - i), Math.abs(s.j - j)) >= 4);
  const order = Object.entries(SECRET_TYPES).flatMap(([t, d]) => Array.from({ length: d.n }, () => t));
  for (const type of order){
    for (let tries = 0; tries < 400; tries++){
      const i = 1 + Math.floor(R() * (GW - 2)), j = 1 + Math.floor(R() * (GH - 2));
      if (tiles[idx(i, j)] !== WILD || !far(i, j) || !apart(i, j)) continue;
      out.push({ type, i, j, k: idx(i, j), r: R() }); break;
    }
  }
  return out;
}
