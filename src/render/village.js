// Huts, bridges, every other building, and the pilgrims who walk the roads between them.
import * as THREE from 'three';
import { GW, GH, WATER, HUT, ROAD, BRIDGE, WAY_I, DECK_Y, WATER_Y, BED_Y, HZ, idx, tileC, inGrid } from '../world/constants.js';
import { B, DEF_BY_CODE, STYLES } from '../data/builds.js';

export function makeVillage({ scene, rimMat, heightAt, tiles, builds, meta, emit, wayX, props, isLive, statueFish }){
  const root = new THREE.Group(); scene.add(root);
  // --- shared parts
  const wallG = new THREE.BoxGeometry(.34, .2, .28).translate(0, .1, 0);
  const roofG = new THREE.ConeGeometry(.3, .2, 4, 1).rotateY(Math.PI/4).scale(1, 1, .86).translate(0, .3, 0);
  const roofSteepG = new THREE.ConeGeometry(.29, .27, 4, 1).rotateY(Math.PI/4).scale(1, 1, .86).translate(0, .33, 0);
  const chimG = new THREE.BoxGeometry(.05, .12, .05).translate(.08, .36, -.05);
  const doorG = new THREE.PlaneGeometry(.07, .11).translate(0, .055, .1405);
  const winG = new THREE.PlaneGeometry(.05, .045).translate(.1, .12, .1405);
  const stiltG = new THREE.CylinderGeometry(.018, .022, .2, 5).translate(0, .1, 0);
  const matCache = {};
  const cm = (c, rim, s) => (matCache[c + rim + s] ||= rimMat({ color: c }, rim, s));
  const darkM = new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 1 });
  const winM = new THREE.MeshStandardMaterial({ color: '#3a2a18', emissive: new THREE.Color('#ffb35a'), emissiveIntensity: 1.4 });
  const plankM = rimMat({ color: '#8a6440' }, '#ffd29a', .8), postM = rimMat({ color: '#5a4028' }, '#ffd29a', .5);
  const deckG = new THREE.BoxGeometry(1.02, .045, .36);
  const railG = new THREE.BoxGeometry(1.02, .02, .02);
  const postG = new THREE.CylinderGeometry(.025, .03, 1, 5);
  const huts = []; // chimneys that smoke: {chim:{x,y,z},t}
  const hsh = (i, j) => (i * 73856093 ^ j * 19349663) >>> 0;

  const isLinkish = (i, j) => inGrid(i, j) && (builds[idx(i, j)] === ROAD || builds[idx(i, j)] === BRIDGE);
  function bridgeAxis(i, j){
    const solid = (a, b) => inGrid(a, b) && (builds[idx(a, b)] === ROAD || builds[idx(a, b)] === BRIDGE || tiles[idx(a, b)] !== WATER);
    const ex = (solid(i-1, j) ? 1 : 0) + (solid(i+1, j) ? 1 : 0), ez = (solid(i, j-1) ? 1 : 0) + (solid(i, j+1) ? 1 : 0);
    const bx = (isLinkish(i-1, j) ? 2 : 0) + (isLinkish(i+1, j) ? 2 : 0) + ex, bz = (isLinkish(i, j-1) ? 2 : 0) + (isLinkish(i, j+1) ? 2 : 0) + ez;
    return bx >= bz ? 'x' : 'z';
  }
  const N4 = [[1,0],[-1,0],[0,1],[0,-1]];
  // direction from a jetty to the water it serves (flowing water first)
  function waterDir(i, j){
    let best = null;
    for (const [a, b] of N4){ const ni = i+a, nj = j+b; if (!inGrid(ni, nj) || tiles[idx(ni, nj)] !== WATER) continue;
      const s = isLive(idx(ni, nj)) ? 2 : 1; if (!best || s > best.s) best = { a, b, s }; }
    return best || { a: 0, b: 1 };
  }
  function pierAxis(i, j){
    for (const [a, b] of N4){ const ni = i+a, nj = j+b; if (!inGrid(ni, nj)) continue; const k = idx(ni, nj);
      if (tiles[k] !== WATER || builds[k] === B.PIER || builds[k] === BRIDGE) return Math.atan2(a, b); }
    return 0;
  }
  function hutMesh(i, j, k){
    const r = hsh(i, j), st = STYLES[meta()[k]?.style] || STYLES.thatch, g = new THREE.Group();
    let face = 0; for (const [a, bb, f] of [[0, 1, 0], [1, 0, Math.PI/2], [0, -1, Math.PI], [-1, 0, -Math.PI/2]]) if (isLinkish(i+a, j+bb)){ face = f; break; }
    const body = new THREE.Group(); g.add(body);
    const wall = new THREE.Mesh(wallG, cm(st.wall[r % 3], '#ffd9a8', .8));
    const roof = new THREE.Mesh(meta()[k]?.style === 'cedar' ? roofSteepG : roofG, cm(st.roof[(r >> 3) % 3], '#ffcf99', .9));
    body.add(wall, roof, new THREE.Mesh(chimG, darkM), new THREE.Mesh(doorG, darkM), new THREE.Mesh(winG, winM));
    if (meta()[k]?.style === 'lacquer'){ const trim = new THREE.Mesh(new THREE.BoxGeometry(.36, .025, .3), cm('#2a1d14', '#ffd9a8', .5)); trim.position.y = .2; body.add(trim); }
    if (st.stilts){ body.position.y = .16; for (const [x, z] of [[-.15, -.12], [.15, -.12], [-.15, .12], [.15, .12]]){ const p = new THREE.Mesh(stiltG, postM); p.position.set(x, -.04, z); g.add(p); }
      const step = new THREE.Mesh(new THREE.BoxGeometry(.1, .02, .14), plankM); step.position.set(0, .08, .2); step.rotation.x = .5; g.add(step); }
    g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    const ox = ((r >> 5) % 5 - 2) * .02, oz = ((r >> 8) % 5 - 2) * .02; const c = tileC(i, j);
    g.position.set(c.x + ox, heightAt(c.x, c.z) - .01, c.z + oz); g.rotation.y = face; root.add(g);
    g.updateMatrixWorld(); const cp = new THREE.Vector3(.08, .43, -.05); body.localToWorld(cp);
    huts.push({ chim: cp, t: Math.random() * 2 });
  }
  function sync(){
    for (const c of [...root.children]){ root.remove(c); }
    huts.length = 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++){
      const k = idx(i, j), b = builds[k], c = tileC(i, j);
      if (b === HUT){ hutMesh(i, j, k); continue; }
      if (b === BRIDGE){
        const g = new THREE.Group(), ax = bridgeAxis(i, j);
        const deck = new THREE.Mesh(deckG, plankM); deck.position.y = DECK_Y; g.add(deck);
        for (const s of [-1, 1]){ const rail = new THREE.Mesh(railG, postM); rail.position.set(0, DECK_Y + .1, s * .17); g.add(rail);
          for (const e of [-.45, .45]){ const p = new THREE.Mesh(postG, postM); const top = DECK_Y + .11, bot = BED_Y + .2;
            p.scale.y = top - bot; p.position.set(e, (top + bot) / 2, s * .17); g.add(p); } }
        g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
        g.position.set(c.x, 0, c.z); g.rotation.y = ax === 'x' ? 0 : Math.PI/2; root.add(g);
        continue;
      }
      if (b === 0 || b === ROAD) continue;
      const d = DEF_BY_CODE[b]; if (!d || !props.B[d.id]) continue;
      const r = hsh(i, j);
      const opts = {};
      if (b === B.FENCE){ const f = (a, bb) => inGrid(a, bb) && builds[idx(a, bb)] === B.FENCE; opts.nb = { e: f(i+1, j), w: f(i-1, j), s: f(i, j+1), n: f(i, j-1) }; }
      if (b === B.STATUE) opts.fish = statueFish(meta()[k]?.sp || 'koi');
      const g = props.B[d.id](r, opts);
      let y = heightAt(c.x, c.z) - .01;
      if (b === B.REED) y = WATER_Y;
      if (b === B.PIER){ y = DECK_Y; g.rotation.y = pierAxis(i, j); }
      else if (b === B.JETTY){ const w = waterDir(i, j); g.rotation.y = Math.atan2(w.a, w.b); }
      else if (b !== B.FENCE && b !== B.REED) g.rotation.y = ((r >> 4) % 4) * Math.PI / 2 * (b === B.STONES || b === B.FLOWERS || b === B.CHERRY ? 1 : 0) + (b === B.BONES ? (r % 7) * .4 : 0);
      g.position.set(c.x, y, c.z); root.add(g);
      if (b === B.SHOP){ g.updateMatrixWorld(); const cp = new THREE.Vector3(-.15, .46, -.08); g.localToWorld(cp); huts.push({ chim: cp, t: Math.random() * 2 }); }
    }
  }

  // --- pilgrims
  const robeMs = ['#d9ccb0', '#a8b3a0', '#b7a07e', '#8f9aa6'].map(c => rimMat({ color: c }, '#ffd9a8', 1));
  const skinM = rimMat({ color: '#e2b58c' }, '#ffd9a8', .8), hatM = rimMat({ color: '#c9a560' }, '#ffe3b0', 1);
  const lampM = new THREE.MeshStandardMaterial({ color: '#2a1d14', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 2.5 });
  const pBody = new THREE.CylinderGeometry(.035, .06, .15, 5).translate(0, .075, 0);
  const pHead = new THREE.IcosahedronGeometry(.036, 0).translate(0, .18, 0);
  const pHat = new THREE.ConeGeometry(.07, .06, 6).translate(0, .225, 0);
  const pStaff = new THREE.CylinderGeometry(.006, .006, .26, 3).translate(.06, .13, .02);
  const pLamp = new THREE.BoxGeometry(.03, .03, .03).translate(.06, .25, .02);
  const pilgrims = [];
  const wayOut = () => { const o = []; for (let z = -HZ - 12; z < -HZ + .01; z += 1) o.push({ x: wayX(z), z }); return o; };
  // path over road and bridge tiles from the Way entrance to a tile next to the target
  function roadPath(target){
    const start = idx(WAY_I, 0); if (!isLinkish(WAY_I, 0)) return null;
    const prev = new Int32Array(GW*GH).fill(-2); prev[start] = -1; const q = [start];
    const goalNb = new Set(); for (const [a, b] of N4) if (inGrid(target.i+a, target.j+b)) goalNb.add(idx(target.i+a, target.j+b));
    let end = -1;
    for (let hq = 0; hq < q.length; hq++){ const k = q[hq]; if (goalNb.has(k)){ end = k; break; }
      const i = k % GW, j = (k / GW) | 0;
      for (const [a, b] of N4){ const ni = i+a, nj = j+b; if (!isLinkish(ni, nj)) continue; const nk = idx(ni, nj); if (prev[nk] !== -2) continue; prev[nk] = k; q.push(nk); } }
    if (end < 0) return null;
    const path = []; for (let k = end; k >= 0; k = prev[k]){ const c = tileC(k % GW, (k / GW) | 0); path.push({ x: c.x, z: c.z, k }); }
    return path.reverse();
  }
  function route(target){
    const p = roadPath(target); if (!p) return null;
    const path = p.map(s => ({ ...s, x: s.x + (Math.random() - .5) * .16, z: s.z + (Math.random() - .5) * .16 }));
    const hc = tileC(target.i, target.j); path.push({ x: hc.x, z: hc.z, k: -1, home: true });
    return wayOut().concat(path);
  }
  // targets: [{i,j,k,market?}]; onArrive(target) is called when the pilgrim reaches it
  function spawnPilgrim(targets, onArrive){
    if (!targets.length || pilgrims.length >= 12) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const path = route(target); if (!path) return;
    const g = new THREE.Group(); const r = Math.floor(Math.random() * 4);
    g.add(new THREE.Mesh(pBody, robeMs[r]), new THREE.Mesh(pHead, skinM), new THREE.Mesh(pHat, hatM), new THREE.Mesh(pStaff, postM), new THREE.Mesh(pLamp, lampM));
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.parent.add(g);
    pilgrims.push({ g, path, seg: 0, u: 0, speed: .3 + Math.random() * .12, ph: Math.random() * 6, fade: 1, target, onArrive, arrived: false });
  }
  function yAt(x, z){ const i = Math.floor(x + GW/2), j = Math.floor(z + HZ);
    if (inGrid(i, j) && (builds[idx(i, j)] === BRIDGE || builds[idx(i, j)] === B.PIER)) return DECK_Y + .022;
    return Math.max(heightAt(x, z), WATER_Y + .02); }
  function update(dt, t){
    for (const hu of huts){ hu.t -= dt; if (hu.t <= 0){ hu.t = .7 + Math.random() * .6; emit(hu.chim.x, hu.chim.y, hu.chim.z, 'smoke'); } }
    for (const p of pilgrims.slice()){
      const a = p.path[p.seg], b = p.path[p.seg + 1];
      if (!b){ if (!p.arrived){ p.arrived = true; p.onArrive && p.onArrive(p.target, p.g.position); }
        p.fade -= dt / 1.2; p.g.scale.setScalar(Math.max(0.001, p.fade)); if (p.fade <= 0){ root.parent.remove(p.g); pilgrims.splice(pilgrims.indexOf(p), 1); } continue; }
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1e-3; p.u += dt * p.speed / L;
      if (p.u >= 1){ p.u = 0; p.seg++; continue; }
      const x = a.x + (b.x - a.x) * p.u, z = a.z + (b.z - a.z) * p.u;
      p.g.position.set(x, yAt(x, z) + Math.abs(Math.sin(t * 7 + p.ph)) * .012, z);
      p.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    }
  }
  return { sync, update, spawnPilgrim, roadPath, wayOut, yAt, axis: bridgeAxis, waterDir, get pilgrimCount(){ return pilgrims.length; } };
}
