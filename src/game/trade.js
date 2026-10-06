// Trade: every trading post keeps a wagon that rolls up the Pilgrim Way, every jetty keeps a barge that rides the
// current east. They carry goods out of the valley and come back with silver. Orders from along the river pay extra.
// Nothing leaves on its own: at the post you choose what goes on board (the manifest), check it against the orders,
// and say Go. The manifest is remembered, so the same run can be sent again.
import { GW, GH, WATER, WATER_Y, HX, idx, tileC, inGrid, riverZ } from '../world/constants.js';
import { B, GOODS, GOOD_IDS, ORDER_REGIONS } from '../data/builds.js';

const N4 = [[1,0],[-1,0],[0,1],[0,-1]];
// what a contract's goods are for, in the words of the place that asks
const CONTRACT_WHY = { timber: 'for a new mill and its waterwheel', reeds: 'to thatch every roof before winter', clay: 'for a kiln and a new quay',
  lanterns: 'to light the long road for the festival', carvings: 'for the shrine they are raising' };

export function makeTrade(ctx){
  const { scene, props, village, tiles, builds, isLive, S } = ctx;
  const vehicles = [];

  /* ---------- routes ---------- */
  function wagonRoute(k){
    const i = k % GW, j = (k / GW) | 0;
    const p = village.roadPath({ i, j }); if (!p) return null;
    const inPath = village.wayOut().concat(p.map(s => ({ x: s.x, z: s.z, k: s.k })));
    // park half a tile toward the post
    const last = inPath[inPath.length - 1], hc = tileC(i, j);
    inPath.push({ x: last.x + (hc.x - last.x) * .42, z: last.z + (hc.z - last.z) * .42, k: -1 });
    return inPath; // from far up the Way to the post
  }
  function bargeRoute(k){
    const i = k % GW, j = (k / GW) | 0;
    const blocked = t => builds[t] === B.PIER || builds[t] === B.REED;
    const ok = t => tiles[t] === WATER && isLive(t) && !blocked(t);
    const starts = []; for (const [a, b] of N4){ const ni = i+a, nj = j+b; if (inGrid(ni, nj) && ok(idx(ni, nj))) starts.push(idx(ni, nj)); }
    if (!starts.length) return null;
    const prev = new Int32Array(GW*GH).fill(-2); const q = [];
    for (const s of starts){ prev[s] = -1; q.push(s); }
    let end = -1;
    for (let h = 0; h < q.length; h++){ const t = q[h], ti = t % GW, tj = (t / GW) | 0;
      if (ti === GW - 1){ end = t; break; }
      for (const [a, b] of N4){ const ni = ti+a, nj = tj+b; if (!inGrid(ni, nj)) continue; const nk = idx(ni, nj); if (prev[nk] !== -2 || !ok(nk)) continue; prev[nk] = t; q.push(nk); } }
    if (end < 0) return null;
    const path = []; for (let t = end; t >= 0; t = prev[t]){ const c = tileC(t % GW, (t / GW) | 0); path.push({ x: c.x, z: c.z, k: t }); }
    path.reverse();
    // tuck in beside the jetty, then run out past the east edge along the river
    const hc = tileC(i, j), s0 = path[0];
    path.unshift({ x: s0.x + (hc.x - s0.x) * .15, z: s0.z + (hc.z - s0.z) * .15, k: -1 });
    for (let x = HX + 1; x <= HX + 16; x += 1.5) path.push({ x, z: riverZ(x), k: -1 });
    return path; // from the jetty out to the sea
  }

  /* ---------- vehicles ---------- */
  function sync(){
    for (const v of vehicles.slice()){ if (builds[v.home] !== (v.kind === 'wagon' ? B.POST : B.JETTY)){ scene.remove(v.mesh); vehicles.splice(vehicles.indexOf(v), 1); } }
    for (let k = 0; k < GW*GH; k++){
      const b = builds[k]; if (b !== B.POST && b !== B.JETTY) continue;
      let v = vehicles.find(v => v.home === k);
      if (!v){ const kind = b === B.POST ? 'wagon' : 'barge';
        v = { kind, home: k, mesh: kind === 'wagon' ? props.wagon() : props.barge(), state: 'load', t: 0, cargo: {}, path: null, seg: 0, u: 0, dir: 1 };
        scene.add(v.mesh); vehicles.push(v); }
      const route = v.kind === 'wagon' ? wagonRoute(k) : bargeRoute(k);
      v.route = route;
      if (v.state === 'load' || v.state === 'stuck') placeAtHome(v);
    }
  }
  function placeAtHome(v){
    if (!v.route){ v.state = 'stuck'; const c = tileC(v.home % GW, (v.home / GW) | 0); v.mesh.position.set(c.x + .3, -9, c.z); v.mesh.visible = false; return; }
    v.mesh.visible = true; if (v.state === 'stuck') v.state = 'load';
    const r = v.route, p = v.kind === 'wagon' ? r[r.length - 1] : r[0], q = v.kind === 'wagon' ? r[r.length - 2] : r[1];
    setPos(v, p.x, p.z, v.kind === 'wagon' ? Math.atan2(q.x - p.x, q.z - p.z) : Math.atan2(q.x - p.x, q.z - p.z));
  }
  function setPos(v, x, z, h){
    const y = v.kind === 'wagon' ? village.yAt(x, z) : WATER_Y - .03;
    v.mesh.position.set(x, y, z); if (h !== undefined) v.mesh.rotation.y = h;
  }
  const load = v => GOOD_IDS.reduce((s, g) => s + (v.cargo[g] || 0), 0);
  function available(){ const o = {}; for (const g of GOOD_IDS) o[g] = Math.max(0, Math.floor(S.goods[g] || 0)); return o; }
  /* ---------- the manifest: what the player has put on board, per vehicle (kept in the save by its post) ---------- */
  const plan = v => ((S.plans ||= {})[v.home] ||= {});
  const planned = v => GOOD_IDS.reduce((s, g) => s + (plan(v)[g] || 0), 0);
  // set how much of a good goes: never more than is in stock, never past what the vehicle carries
  function setPlan(v, g, q){ const p = plan(v), cap = ctx.capacity(v.kind, v.home), others = planned(v) - (p[g] || 0);
    q = Math.max(0, Math.min(Math.floor(q), Math.floor(S.goods[g] || 0), cap - others)); if (q) p[g] = q; else delete p[g]; showPlanned(v); return q; }
  // load what this route's orders are still waiting for, as far as stock and room allow
  function planForOrders(v){ const w = wanted(v.kind === 'wagon' ? 'north' : 'east'); S.plans[v.home] = {};
    for (const g of [...GOOD_IDS].sort((a, b) => (w[b] ? 1 : 0) - (w[a] ? 1 : 0))) if (w[g]) setPlan(v, g, w[g]); showPlanned(v); }
  function clearPlan(v){ S.plans[v.home] = {}; showPlanned(v); }
  // goods that ran out since the manifest was written come off it
  function trimPlan(v){ const p = plan(v); for (const g of Object.keys(p)) if (p[g] > Math.floor(S.goods[g] || 0)){ const q = Math.floor(S.goods[g] || 0); if (q > 0) p[g] = q; else delete p[g]; } }
  function showPlanned(v){ if (v.state !== 'load') return; const p = plan(v); v.cargo = {}; for (const g of GOOD_IDS) if (p[g]) v.cargo[g] = p[g]; showCargo(v); v.cargo = {}; }
  // what open orders on a route still need, per good
  function wanted(route){ const w = {}; for (const o of S.orders || []) if (o.route === route && o.got < o.qty) w[o.good] = (w[o.good] || 0) + o.qty - o.got; return w; }
  // Go: what is on the manifest (and still in stock) is loaded and leaves
  function fill(v){
    trimPlan(v); const cap = ctx.capacity(v.kind, v.home), p = plan(v); v.cargo = {}; let n = 0;
    for (const g of GOOD_IDS){ const q = Math.min(p[g] || 0, Math.floor(S.goods[g] || 0), cap - n); if (q <= 0) continue; v.cargo[g] = q; S.goods[g] -= q; n += q; }
    return n;
  }
  function showCargo(v){
    const n = load(v), cap = ctx.capacity(v.kind, v.home), slots = v.kind === 'wagon' ? 6 : 8;
    const list = []; const shown = Math.min(slots, Math.ceil(n / cap * slots));
    const goods = GOOD_IDS.filter(g => v.cargo[g]); let gi = 0;
    for (let s = 0; s < shown; s++){ list.push(GOODS[goods[gi % goods.length]].col); gi++; }
    props.setCargo(v.mesh, list);
  }
  // the path the vehicle is on right now, as a list, and which way it walks it
  function pathFor(v, out){
    const r = v.route; if (v.kind === 'wagon') return out ? r.slice().reverse() : r; return out ? r : r.slice().reverse();
  }
  function depart(v){
    const n = fill(v); if (!n) return false;
    showCargo(v); v.state = 'out'; v.path = pathFor(v, true); v.seg = 0; v.u = 0; ctx.onDepart(v, n); return true;
  }
  function update(dt, t){
    for (const v of vehicles){
      if (v.state === 'stuck'){ continue; }
      if (v.state === 'load'){
        // waits at the post until the player says Go; the load on show follows the manifest
        v.t += dt; if (v.t > .5){ v.t = 0; trimPlan(v); v.ready = planned(v); showPlanned(v); }
        if (v.kind === 'barge') v.mesh.position.y = WATER_Y - .03 + Math.sin(t * 1.3 + v.home) * .006;
        continue;
      }
      if (v.state === 'away'){ v.t -= dt; if (v.t <= 0){ v.state = 'back'; v.path = pathFor(v, false); v.seg = 0; v.u = 0; v.mesh.visible = true; showCargo(v); } continue; }
      // moving along v.path
      const a = v.path[v.seg], b = v.path[v.seg + 1];
      if (!b){
        if (v.state === 'out'){ v.state = 'away'; v.t = (v.kind === 'wagon' ? 18 : 26) / ctx.speed(v.kind); v.mesh.visible = false; }
        else { // home again
          const report = sell(v); v.cargo = {}; props.setCargo(v.mesh, []); v.state = 'load'; v.t = 0; placeAtHome(v); showPlanned(v); ctx.onReturn(v, report); }
        continue;
      }
      let sp = (v.kind === 'wagon' ? .62 : (v.state === 'out' ? .75 : .5)) * ctx.speed(v.kind);
      if (v.kind === 'wagon' && a.k >= 0) sp *= ctx.paveSpeed(a.k);
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1e-3; v.u += dt * sp / L;
      if (v.u >= 1){ v.u = 0; v.seg++; continue; }
      const x = a.x + (b.x - a.x) * v.u, z = a.z + (b.z - a.z) * v.u;
      const want = Math.atan2(b.x - a.x, b.z - a.z); let d = want - v.mesh.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      setPos(v, x, z, v.mesh.rotation.y + d * Math.min(1, dt * 6));
      if (v.kind === 'wagon') v.mesh.position.y += Math.abs(Math.sin(t * 9 + v.home)) * .006;
      else v.mesh.position.y += Math.sin(t * 1.3 + v.home) * .006;
    }
  }

  /* ---------- selling and orders ---------- */
  function sell(v){
    const route = v.kind === 'wagon' ? 'north' : 'east';
    const lines = []; let silver = 0;
    for (const g of GOOD_IDS){ const q = v.cargo[g] || 0; if (!q) continue; const p = ctx.price(g, v.kind); silver += q * p; lines.push({ g, q, p }); }
    const done = [];
    for (const o of S.orders){ if (o.route !== route || o.got >= o.qty) continue; const q = v.cargo[o.good] || 0; if (!q) continue;
      o.got = Math.min(o.qty, o.got + q); if (o.got >= o.qty) done.push(o); }
    let bonus = 0; for (const o of done){ bonus += o.reward; if (o.contract) S.contractsDone = (S.contractsDone || 0) + 1; else S.ordersDone = (S.ordersDone || 0) + 1; }
    S.orders = S.orders.filter(o => o.got < o.qty);
    return { silver: Math.round(silver), bonus, lines, done, route };
  }
  function newOrder(route, contract){
    const regions = ORDER_REGIONS.filter(r => !route || r.route === route);
    let reg, good;
    for (let tries = 0; tries < 20; tries++){
      reg = regions[Math.floor(Math.random() * regions.length)];
      // the very first order up the Way asks for timber, the one thing a new valley has
      good = !S.ordersDone && route === 'north' && !S.orders.length ? 'timber' : reg.wants[Math.floor(Math.random() * reg.wants.length)];
      if (!S.orders.some(o => o.region === reg.id || o.good === good)) break;
    }
    const lvl = S.ordersDone || 0, raw = GOODS[good].raw;
    // a contract is a big standing order, filled over many trips: "a thousand timber for the new mill"
    if (contract){ const c = S.contractsDone || 0;
      const qty = raw ? Math.min(1000, 200 + c * 100) : Math.min(200, 40 + c * 20);
      const reward = Math.round(qty * GOODS[good].price * 1.5 / 50) * 50;
      return { id: Math.random().toString(36).slice(2, 8), region: reg.id, regionName: reg.name, route: reg.route, good, qty, got: 0, reward, contract: true,
        why: CONTRACT_WHY[good] || 'for the season ahead' }; }
    const qty = Math.round((raw ? 18 : 6) * (1 + lvl * .22) / (raw ? 2 : 1)) * (raw ? 2 : 1);
    const reward = Math.round(qty * GOODS[good].price * (1.6 + lvl * .05) / 5) * 5;
    return { id: Math.random().toString(36).slice(2, 8), region: reg.id, regionName: reg.name, route: reg.route, good, qty, got: 0, reward };
  }
  function topUpOrders(){
    S.orders ||= [];
    const small = r => S.orders.filter(o => o.route === r && !o.contract).length, big = r => S.orders.some(o => o.route === r && o.contract);
    while (small('north') < 2) S.orders.push(newOrder('north'));
    while (small('east') < 1) S.orders.push(newOrder('east'));
    // contracts open up once a couple of ordinary orders are done: one per route at a time
    if ((S.ordersDone || 0) >= 2 && !big('north')) S.orders.push(newOrder('north', true));
    if ((S.ordersDone || 0) >= 4 && !big('east')) S.orders.push(newOrder('east', true));
  }
  const sendNow = v => v.state === 'load' && depart(v) && ((v.t = 0), true);
  return { sync, update, vehicles, topUpOrders, available, wanted, load, sendNow, canBarge: k => !!bargeRoute(k), hasWagonRoute: k => !!wagonRoute(k),
    plan, planned, setPlan, planForOrders, clearPlan };
}
