// Roads as their own textured meshes: a centre square per road tile plus an arm toward every joined neighbour,
// so straights, corners, T-junctions and crossings all fall out of the same rule. Each surface (dirt, gravel,
// cobble, plank) has a small pixel-art texture mapped in world space, and every open side gets a curb strip.
import * as THREE from 'three';

const TEX = 16; // texture pixels per tile
function hashN(x, y, s = 0){ const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
function paint(kind){
  const c = document.createElement('canvas'); c.width = c.height = TEX * 2; const g = c.getContext('2d'); const N = TEX * 2;
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, (n >> 16) * f) | 0, gg = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0; return `rgb(${r},${gg},${b})`; };
  if (kind === 'dirt'){ for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const h = hashN(x, y); px(x, y, shade('#b8a47a', .88 + h * .2)); if (h > .94) px(x, y, '#8f7d58'); if (h < .03) px(x, y, '#d4c49a'); } }
  else if (kind === 'gravel'){ for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const h = hashN(x, y, 3); px(x, y, h > .7 ? '#c9c3b2' : h > .35 ? '#a8a291' : h > .1 ? '#8e8878' : '#6f6a5e'); } }
  else if (kind === 'cobble'){
    g.fillStyle = '#5a564f'; g.fillRect(0, 0, N, N);
    const S = 8; // stone size in px
    for (let row = 0; row < N / S; row++) for (let col = -1; col < N / S; col++){
      const ox = (row % 2) * S / 2, x0 = col * S + ox, y0 = row * S, t = .82 + hashN(col, row, 5) * .3;
      for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++){ const cx = x - S / 2 + .5, cy = y - S / 2 + .5; if (cx * cx + cy * cy > (S / 2 - .6) ** 2 * 1.25) continue;
        const X = ((x0 + x) % N + N) % N; px(X, y0 + y, shade('#9a958b', t * (y < S / 2 ? 1.08 : .92))); } }
  }
  else if (kind === 'plank'){
    const H = 5; for (let y = 0; y < N; y++){ const b = Math.floor(y / H), t = .85 + hashN(b, 0, 9) * .25;
      for (let x = 0; x < N; x++){ let col = shade('#9a7048', t * (.94 + hashN(x >> 2, b, 2) * .1)); if (y % H === 0) col = '#4f3a26'; if ((x + b * 11) % 32 === 0) col = '#5a4330'; px(x, y, col); } }
  }
  const tx = new THREE.CanvasTexture(c); tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.generateMipmaps = false;
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
const CURB = { dirt: '#8a7650', gravel: '#7f7a6c', cobble: '#6f6a62', plank: '#5a4028' };

export function makeRoads({ scene, heightAt, isRoad, paveAt, linkAt, tileC, GW, GH }){
  const root = new THREE.Group(); scene.add(root);
  const mats = {}, curbMats = {};
  for (const k of ['dirt', 'gravel', 'cobble', 'plank']){
    mats[k] = new THREE.MeshStandardMaterial({ map: paint(k), roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    curbMats[k] = new THREE.MeshStandardMaterial({ color: CURB[k], roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  }
  const W = .28, LIFT = .018;
  // a flat rectangle laid over the terrain, subdivided so it follows gentle slopes
  function rect(buf, x0, z0, x1, z1, lift = LIFT, n = 2){
    const base = buf.pos.length / 3;
    for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++){ const x = x0 + (x1 - x0) * a / n, z = z0 + (z1 - z0) * b / n;
      buf.pos.push(x, heightAt(x, z) + lift, z); buf.uv.push(x * .5, -z * .5); }
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++){ const p = base + b * (n + 1) + a; buf.idx.push(p, p + n + 1, p + 1, p + 1, p + n + 1, p + n + 2); }
  }
  function sync(){
    for (const c of [...root.children]){ root.remove(c); c.geometry.dispose(); }
    const bufs = {}, curbs = {}; const B = k => (bufs[k] ||= { pos: [], uv: [], idx: [] }), Cb = k => (curbs[k] ||= { pos: [], uv: [], idx: [] });
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++){
      if (!isRoad(i, j)) continue;
      const pv = paveAt(i, j), c = tileC(i, j), buf = B(pv), cb = Cb(pv), e = .035;
      rect(buf, c.x - W, c.z - W, c.x + W, c.z + W);
      const arm = { e: linkAt(i + 1, j), w: linkAt(i - 1, j), s: linkAt(i, j + 1), n: linkAt(i, j - 1) };
      if (arm.e) rect(buf, c.x + W, c.z - W, c.x + .5, c.z + W, LIFT, 1);
      if (arm.w) rect(buf, c.x - .5, c.z - W, c.x - W, c.z + W, LIFT, 1);
      if (arm.s) rect(buf, c.x - W, c.z + W, c.x + W, c.z + .5, LIFT, 1);
      if (arm.n) rect(buf, c.x - W, c.z - .5, c.x + W, c.z - W, LIFT, 1);
      // curbs along every open edge
      const L = LIFT + .006;
      if (!arm.e) rect(cb, c.x + W - e, c.z - W, c.x + W, c.z + W, L, 1); if (!arm.w) rect(cb, c.x - W, c.z - W, c.x - W + e, c.z + W, L, 1);
      if (!arm.s) rect(cb, c.x - W, c.z + W - e, c.x + W, c.z + W, L, 1); if (!arm.n) rect(cb, c.x - W, c.z - W, c.x + W, c.z - W + e, L, 1);
      if (arm.e){ rect(cb, c.x + W, c.z - W, c.x + .5, c.z - W + e, L, 1); rect(cb, c.x + W, c.z + W - e, c.x + .5, c.z + W, L, 1); }
      if (arm.w){ rect(cb, c.x - .5, c.z - W, c.x - W, c.z - W + e, L, 1); rect(cb, c.x - .5, c.z + W - e, c.x - W, c.z + W, L, 1); }
      if (arm.s){ rect(cb, c.x - W, c.z + W, c.x - W + e, c.z + .5, L, 1); rect(cb, c.x + W - e, c.z + W, c.x + W, c.z + .5, L, 1); }
      if (arm.n){ rect(cb, c.x - W, c.z - .5, c.x - W + e, c.z - W, L, 1); rect(cb, c.x + W - e, c.z - .5, c.x + W, c.z - W, L, 1); }
    }
    const mk = (b, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.idx); g.computeVertexNormals(); const me = new THREE.Mesh(g, m); me.receiveShadow = true; root.add(me); };
    for (const [k, b] of Object.entries(bufs)) if (b.idx.length) mk(b, mats[k]);
    for (const [k, b] of Object.entries(curbs)) if (b.idx.length) mk(b, curbMats[k]);
  }
  return { sync };
}
