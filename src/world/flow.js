// River current. Water enters at the west edge (inlet) and leaves at the east edge (outlet).
// We solve a potential field over the water tiles (Laplace, Dirichlet at the river mouths, closed at the banks);
// the current is the negative gradient. Pockets the current does not pass through end up with almost no speed:
// those are backwaters, and nothing lives in still water.
import { GW, GH, WATER, idx } from './constants.js';

export const STILL_BELOW = 0.16; // speed relative to a 3-wide channel under which water counts as still

export function makeFlow(){
  return {
    phi: new Float32Array(GW*GH),
    vx: new Float32Array(GW*GH),
    vz: new Float32Array(GW*GH),
    speed: new Float32Array(GW*GH),   // relative to a 3-tile-wide channel (≈1 in the starting river)
    live: new Uint8Array(GW*GH),      // 1 = flowing water
    flux: 0,
  };
}

// inlet / outlet: arrays of j rows (on column 0 / GW-1) that count as the river mouths
export function solveFlow(F, tiles, inlet, outlet, iters = 900){
  const { phi, vx, vz, speed, live } = F;
  const isW = k => tiles[k] === WATER;
  const fixed = new Uint8Array(GW*GH);
  phi.fill(0.5);
  for (const j of inlet){ const k = idx(0, j); if (isW(k)){ fixed[k] = 1; phi[k] = 1; } }
  for (const j of outlet){ const k = idx(GW-1, j); if (isW(k)){ fixed[k] = 1; phi[k] = 0; } }
  // only tiles connected to both mouths can carry current; everything else is still by definition
  const reach = (seed) => { const seen = new Uint8Array(GW*GH); const st = [];
    for (const j of seed.js){ const k = idx(seed.i, j); if (isW(k) && !seen[k]){ seen[k] = 1; st.push(k); } }
    while (st.length){ const k = st.pop(), i = k % GW, j = (k / GW) | 0;
      for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const ni = i+a, nj = j+b; if (ni<0||nj<0||ni>=GW||nj>=GH) continue;
        const nk = idx(ni, nj); if (isW(nk) && !seen[nk]){ seen[nk] = 1; st.push(nk); } } }
    return seen; };
  const fromIn = reach({ i: 0, js: inlet }), fromOut = reach({ i: GW-1, js: outlet });
  const act = []; for (let k = 0; k < GW*GH; k++) if (isW(k) && fromIn[k] && fromOut[k] && !fixed[k]) act.push(k);
  const w = 1.85; // over-relaxation
  for (let it = 0; it < iters; it++){
    for (const k of act){ const i = k % GW, j = (k / GW) | 0; let s = 0, n = 0;
      if (i > 0 && isW(k-1)){ s += phi[k-1]; n++; }
      if (i < GW-1 && isW(k+1)){ s += phi[k+1]; n++; }
      if (j > 0 && isW(k-GW)){ s += phi[k-GW]; n++; }
      if (j < GH-1 && isW(k+GW)){ s += phi[k+GW]; n++; }
      if (n) phi[k] += w * (s / n - phi[k]); }
  }
  // flux through the outlet column
  let Q = 0; for (let j = 0; j < GH; j++){ const a = idx(GW-2, j), b = idx(GW-1, j); if (isW(a) && isW(b)) Q += phi[a] - phi[b]; }
  F.flux = Q;
  const ref = Math.max(1e-6, Q / 3);
  for (let k = 0; k < GW*GH; k++){
    vx[k] = vz[k] = speed[k] = 0; live[k] = 0;
    if (!isW(k) || !(fromIn[k] && fromOut[k])) continue;
    const i = k % GW, j = (k / GW) | 0, p = phi[k];
    const g = (nk, ok) => ok && isW(nk) ? phi[nk] : p;
    // at the mouths the current keeps its heading out of the grid
    const pl = i > 0 ? g(k-1, true) : p + (p - g(k+1, i < GW-1));
    const pr = i < GW-1 ? g(k+1, true) : p - (g(k-1, i > 0) - p);
    const pu = g(k-GW, j > 0), pd = g(k+GW, j < GH-1);
    vx[k] = -(pr - pl) / 2 / ref; vz[k] = -(pd - pu) / 2 / ref;
    speed[k] = Math.hypot(vx[k], vz[k]);
    if (fixed[k] && speed[k] < 0.5){ vx[k] = 0.5; speed[k] = 0.5; } // mouths always run
    live[k] = speed[k] >= STILL_BELOW ? 1 : 0;
  }
  return F;
}
