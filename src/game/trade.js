// Trade: every trading post keeps a wagon that rolls up the Pilgrim Way, every jetty keeps a barge that rides the
// current east. They carry goods out of the valley and come back with silver. Orders from along the river pay extra.
import { GW, GH, WATER, WATER_Y, HX, idx, tileC, inGrid, riverZ } from '../world/constants.js';
import { B, GOODS, GOOD_IDS, ORDER_REGIONS } from '../data/builds.js';

const N4 = [[1,0],[-1,0],[0,1],[0,-1]];

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
  function available(){ const o = {}; for (const g of GOOD_IDS) o[g] = Math.max(0, Math.floor((S.goods[g] || 0) - (S.reserve[g] ?? 0))); return o; }
  function fill(v){
    const cap = ctx.capacity(v.kind); const av = available(); v.cargo = {}; let n = 0;
    // most valuable first
    for (const g of [...GOOD_IDS].sort((a, b) => GOODS[b].price - GOODS[a].price)){
      const take = Math.min(av[g], cap - n); if (take <= 0) continue; v.cargo[g] = take; S.goods[g] -= take; n += take; }
    return n;
  }
  function showCargo(v){
    const n = load(v), cap = ctx.capacity(v.kind), slots = v.kind === 'wagon' ? 6 : 8;
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
        v.t += dt;
        const av = available(), ready = GOOD_IDS.reduce((s, g) => s + av[g], 0), cap = ctx.capacity(v.kind);
        v.ready = ready;
        if (ready >= cap || (v.t > (v.kind === 'wagon' ? 30 : 45) && ready >= 3)){ if (depart(v)) v.t = 0; }
        if (v.kind === 'barge') v.mesh.position.y = WATER_Y - .03 + Math.sin(t * 1.3 + v.home) * .006;
        continue;
      }
      if (v.state === 'away'){ v.t -= dt; if (v.t <= 0){ v.state = 'back'; v.path = pathFor(v, false); v.seg = 0; v.u = 0; v.mesh.visible = true; showCargo(v); } continue; }
      // moving along v.path
      const a = v.path[v.seg], b = v.path[v.seg + 1];
      if (!b){
        if (v.state === 'out'){ v.state = 'away'; v.t = (v.kind === 'wagon' ? 18 : 26) / ctx.speed(v.kind); v.mesh.visible = false; }
        else { // home again
          const report = sell(v); v.cargo = {}; props.setCargo(v.mesh, []); v.state = 'load'; v.t = 0; placeAtHome(v); ctx.onReturn(v, report); }
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
    let bonus = 0; for (const o of done){ bonus += o.reward; S.ordersDone = (S.ordersDone || 0) + 1; }
    S.orders = S.orders.filter(o => o.got < o.qty);
    return { silver: Math.round(silver), bonus, lines, done, route };
  }
  function newOrder(route){
    const regions = ORDER_REGIONS.filter(r => !route || r.route === route);
    let reg, good;
    for (let tries = 0; tries < 20; tries++){
      reg = regions[Math.floor(Math.random() * regions.length)];
      // the very first order up the Way asks for timber, the one thing a new valley has
      good = !S.ordersDone && route === 'north' && !S.orders.length ? 'timber' : reg.wants[Math.floor(Math.random() * reg.wants.length)];
      if (!S.orders.some(o => o.region === reg.id || o.good === good)) break;
    }
    const lvl = S.ordersDone || 0, raw = GOODS[good].raw;
    const qty = Math.round((raw ? 18 : 6) * (1 + lvl * .22) / (raw ? 2 : 1)) * (raw ? 2 : 1);
    const reward = Math.round(qty * GOODS[good].price * (1.6 + lvl * .05) / 5) * 5;
    return { id: Math.random().toString(36).slice(2, 8), region: reg.id, regionName: reg.name, route: reg.route, good, qty, got: 0, reward };
  }
  function topUpOrders(){
    S.orders ||= [];
    while (S.orders.filter(o => o.route === 'north').length < 2) S.orders.push(newOrder('north'));
    while (S.orders.filter(o => o.route === 'east').length < 1) S.orders.push(newOrder('east'));
  }
  return { sync, update, vehicles, topUpOrders, available, load, canBarge: k => !!bargeRoute(k), hasWagonRoute: k => !!wagonRoute(k) };
}
