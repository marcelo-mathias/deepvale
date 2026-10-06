// River current. Water enters at the west edge (inlet) and leaves at the east edge (outlet).
// We solve a potential field over the water tiles (Laplace, Dirichlet at the river mouths, closed at the banks);
// the current is the negative gradient. Pockets the current does not pass through end up with almost no speed:
// those are backwaters, and nothing lives in still water.
//
// The solve is warm-started: a dug or filled tile changes the field only a little, so we start from the last
// answer and stop as soon as it has settled, instead of starting flat and always running the full count.
import { GW, GH, WATER, idx } from './constants.js';

export const STILL_BELOW = 0.16; // speed relative to a 3-wide channel under which water counts as still
const SETTLED = 3e-7;            // largest change per pass at which the field counts as solved

export function makeFlow(){
  return {
    phi: new Float32Array(GW*GH),
    vx: new Float32Array(GW*GH),
    vz: new Float32Array(GW*GH),
    speed: new Float32Array(GW*GH),   // relative to a 3-tile-wide channel (≈1 in the starting river)
    live: new Uint8Array(GW*GH),      // 1 = flowing water
    flux: 0,
    solved: new Uint8Array(GW*GH),    // tiles whose phi came out of the last solve (the warm start)
    iters: 0,                         // passes the last solve took
  };
}

// inlet / outlet: arrays of j rows (on column 0 / GW-1) that count as the river mouths
export function solveFlow(F, tiles, inlet, outlet, iters = 900){
  const { phi, vx, vz, speed, live } = F;
  const N = GW*GH;
  const solved = F.solved || (F.solved = new Uint8Array(N));
  const isW = k => tiles[k] === WATER;
  const fixed = new Uint8Array(N);
  for (const j of inlet){ const k = idx(0, j); if (isW(k)){ fixed[k] = 1; phi[k] = 1; } }
  for (const j of outlet){ const k = idx(GW-1, j); if (isW(k)){ fixed[k] = 1; phi[k] = 0; } }
  // only tiles connected to both mouths can carry current; everything else is still by definition
  const reach = (seed) => { const seen = new Uint8Array(N); const st = [];
    for (const j of seed.js){ const k = idx(seed.i, j); if (isW(k) && !seen[k]){ seen[k] = 1; st.push(k); } }
    while (st.length){ const k = st.pop(), i = k % GW, j = (k / GW) | 0;
      if (i > 0 && isW(k-1) && !seen[k-1]){ seen[k-1] = 1; st.push(k-1); }
      if (i < GW-1 && isW(k+1) && !seen[k+1]){ seen[k+1] = 1; st.push(k+1); }
      if (j > 0 && isW(k-GW) && !seen[k-GW]){ seen[k-GW] = 1; st.push(k-GW); }
      if (j < GH-1 && isW(k+GW) && !seen[k+GW]){ seen[k+GW] = 1; st.push(k+GW); } }
    return seen; };
  const fromIn = reach({ i: 0, js: inlet }), fromOut = reach({ i: GW-1, js: outlet });
  // the active tiles and their water neighbours, flattened so the inner loop does no lookups
  const act = []; for (let k = 0; k < N; k++) if (isW(k) && fromIn[k] && fromOut[k] && !fixed[k]) act.push(k);
  const A = act.length, nbr = new Int32Array(A*4), cnt = new Uint8Array(A);
  for (let a = 0; a < A; a++){ const k = act[a], i = k % GW, j = (k / GW) | 0; let n = 0;
    if (i > 0 && isW(k-1)) nbr[a*4 + n++] = k-1;
    if (i < GW-1 && isW(k+1)) nbr[a*4 + n++] = k+1;
    if (j > 0 && isW(k-GW)) nbr[a*4 + n++] = k-GW;
    if (j < GH-1 && isW(k+GW)) nbr[a*4 + n++] = k+GW;
    cnt[a] = n; }
  // warm start: keep the last answer where there is one; new water takes its neighbours' mean, or the middle
  for (let k = 0; k < N; k++) if (!fixed[k] && !solved[k]) phi[k] = 0.5;
  for (let a = 0; a < A; a++){ const k = act[a]; if (solved[k]) continue; let s = 0, n = 0;
    for (let q = 0; q < cnt[a]; q++){ const nk = nbr[a*4+q]; if (solved[nk] || fixed[nk]){ s += phi[nk]; n++; } }
    if (n) phi[k] = s / n; }
  const w = 1.85; // over-relaxation
  let it = 0;
  for (; it < iters; it++){
    let big = 0;
    for (let a = 0; a < A; a++){ const n = cnt[a]; if (!n) continue; const k = act[a], b = a*4; let s = 0;
      for (let q = 0; q < n; q++) s += phi[nbr[b+q]];
      const d = w * (s / n - phi[k]); phi[k] += d; if (d > big) big = d; else if (-d > big) big = -d; }
    if (big < SETTLED) break;
  }
  F.iters = it;
  solved.fill(0); for (let a = 0; a < A; a++) solved[act[a]] = 1;
  // flux through the outlet column
  let Q = 0; for (let j = 0; j < GH; j++){ const a = idx(GW-2, j), b = idx(GW-1, j); if (isW(a) && isW(b)) Q += phi[a] - phi[b]; }
  F.flux = Q;
  const ref = Math.max(1e-6, Q / 3);
  for (let k = 0; k < N; k++){
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
