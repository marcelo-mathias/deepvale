// Houses: each style has its own silhouette and pixel-art surfaces.
//   thatch  – warm plank walls, a round, chunky straw roof, a flower box
//   cedar   – log walls, a steep shingled A-frame with deep overhangs, a stone chimney
//   stilt   – reed-and-plank walls raised on posts, with a porch and a ladder
//   lacquer – white plaster in a dark timber frame, red tiled roof with upturned eaves, door lanterns
import * as THREE from 'three';

function canvasTex(draw, w = 32, h = 32, rep = [1, 1]){
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hsh = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 17.3) * 43758.5453; return v - Math.floor(v); };
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, (n >> 16) * f) | 0},${Math.min(255, ((n >> 8) & 255) * f) | 0},${Math.min(255, (n & 255) * f) | 0})`; };
const TEX = {
  planks: base => canvasTex((g, w, h) => { for (let y = 0; y < h; y++){ const b = Math.floor(y / 4); for (let x = 0; x < w; x++){ let f = .86 + hsh(b, x >> 3) * .2; if (y % 4 === 0) f = .6; if ((x + b * 7) % 16 === 0) f = .7; g.fillStyle = shade(base, f); g.fillRect(x, y, 1, 1); } } }),
  logs: base => canvasTex((g, w, h) => { for (let y = 0; y < h; y++){ const t = (y % 6) / 5, f = .7 + Math.sin(t * Math.PI) * .38; for (let x = 0; x < w; x++){ g.fillStyle = shade(base, f * (.94 + hsh(x, y) * .1)); g.fillRect(x, y, 1, 1); } } }),
  plaster: () => canvasTex((g, w, h) => { g.fillStyle = '#ece4d2'; g.fillRect(0, 0, w, h); for (let n = 0; n < 60; n++){ g.fillStyle = hsh(n, 1) > .5 ? '#ded4bf' : '#f4eee0'; g.fillRect(hsh(n, 2) * w | 0, hsh(n, 3) * h | 0, 1, 1); }
    g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h); g.fillRect(w / 2 - 1, 0, 2, h); }),
  reedwall: () => canvasTex((g, w, h) => { for (let x = 0; x < w; x++){ const f = .8 + hsh(x, 0) * .3; for (let y = 0; y < h; y++){ g.fillStyle = shade('#c4a77a', f * (x % 3 === 0 ? .8 : 1)); g.fillRect(x, y, 1, 1); } } g.fillStyle = '#6b4a2e'; g.fillRect(0, h / 2, w, 2); }),
  thatch: () => canvasTex((g, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const f = .75 + hsh(x, y >> 1) * .35 - ((y % 8) < 1 ? .2 : 0); g.fillStyle = shade('#b8924f', f); g.fillRect(x, y, 1, 1); } }, 32, 32, [5, 5]),
  shingles: () => canvasTex((g, w, h) => { for (let y = 0; y < h; y++){ const row = y >> 2; for (let x = 0; x < w; x++){ const col = (x + (row % 2) * 3) / 6 | 0; let f = .82 + hsh(col, row) * .25; if (y % 4 === 3 || (x + (row % 2) * 3) % 6 === 0) f = .55; g.fillStyle = shade('#5f6b66', f); g.fillRect(x, y, 1, 1); } } }, 32, 32, [6, 6]),
  tiles: () => canvasTex((g, w, h) => { for (let y = 0; y < h; y++){ const row = y >> 2; for (let x = 0; x < w; x++){ const f = (x % 4 < 2 ? 1.05 : .8) * (y % 4 === 3 ? .7 : 1); g.fillStyle = shade('#b03a2c', f * (.95 + hsh(x >> 2, row) * .1)); g.fillRect(x, y, 1, 1); } } }, 32, 32, [6, 6]),
  reedroof: () => canvasTex((g, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ g.fillStyle = shade('#c9b070', .78 + hsh(x, y >> 2) * .3); g.fillRect(x, y, 1, 1); } }, 32, 32, [5, 5]),
};

export function makeHouses({ rimMat }){
  const cache = {};
  const texMat = (key, make, rim = '#ffd9a8', s = .8, extra = {}) => (cache[key] ||= (() => { const m = rimMat({ color: '#ffffff', map: make(), ...extra }, rim, s); return m; })());
  const col = c => (cache['c' + c] ||= rimMat({ color: c }, '#ffd9a8', .8));
  const dark = new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 1 });
  const win = new THREE.MeshStandardMaterial({ color: '#3a2a18', emissive: new THREE.Color('#ffb35a'), emissiveIntensity: 1.4 });
  const glow = new THREE.MeshStandardMaterial({ color: '#2a1d14', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 2.4 });
  const G = {};
  const box = (w, h, d) => (G['b' + w + h + d] ||= new THREE.BoxGeometry(w, h, d));
  // a roof from a 2D profile, extruded along z; w = width (x), d = depth (z)
  function roofGeo(kind, w, d, h){
    const key = kind + w + d + h; if (G[key]) return G[key];
    const s = new THREE.Shape(), o = .07, hw = w / 2 + o;
    if (kind === 'round'){ s.moveTo(-hw - .02, -.02); s.quadraticCurveTo(-hw * .95, h * 1.05, 0, h); s.quadraticCurveTo(hw * .95, h * 1.05, hw + .02, -.02); s.lineTo(hw - .04, -.02); s.quadraticCurveTo(0, h * .7, -hw + .04, -.02); }
    else if (kind === 'curved'){ s.moveTo(-hw - .05, .04); s.quadraticCurveTo(-hw * .35, h * .2, 0, h); s.quadraticCurveTo(hw * .35, h * .2, hw + .05, .04); s.lineTo(hw - .02, -.01); s.quadraticCurveTo(0, h * .45, -hw + .02, -.01); }
    else { s.moveTo(-hw, 0); s.lineTo(0, h); s.lineTo(hw, 0); s.lineTo(hw - .045, -.01); s.lineTo(0, h - .06); s.lineTo(-hw + .045, -.01); }
    const g = new THREE.ExtrudeGeometry(s, { depth: d + o * 2, bevelEnabled: kind === 'round', bevelSize: .012, bevelThickness: .012, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -(d + o * 2) / 2); return (G[key] = g);
  }
  function gableEnd(w, h, mat){ const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h * .92); s.lineTo(w / 2, 0); const g = new THREE.ShapeGeometry(s); const m = new THREE.Group();
    for (const z of [-1, 1]){ const me = new THREE.Mesh(g, mat); me.position.z = z * .141; if (z < 0) me.rotation.y = Math.PI; m.add(me); } return m; }
  const put = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };

  const STY = {
    thatch: { wall: () => texMat('planks', () => TEX.planks('#c9a276')), roof: () => texMat('thatch', TEX.thatch, '#ffe0a8', 1), kind: 'round', h: .2 },
    cedar: { wall: () => texMat('logs', () => TEX.logs('#8a5a38')), roof: () => texMat('shingles', TEX.shingles, '#ffcf99', .9), kind: 'gable', h: .3 },
    stilt: { wall: () => texMat('reedwall', TEX.reedwall), roof: () => texMat('reedroof', TEX.reedroof, '#ffe0a8', 1), kind: 'gable', h: .19 },
    lacquer: { wall: () => texMat('plaster', TEX.plaster, '#ffffff', .6), roof: () => texMat('tiles', TEX.tiles, '#ffc0a0', 1), kind: 'curved', h: .22 },
  };
  // one house body: walls, roof, door, windows and the style's extras. Returns {group, chimney}
  function body(style, r, scale = 1){
    const st = STY[style] || STY.thatch, b = new THREE.Group(), W = .34, H = .2, D = .28;
    put(b, box(W, H, D), st.wall(), 0, H / 2, 0);
    const roof = new THREE.Mesh(roofGeo(st.kind, W, D, st.h), st.roof()); roof.position.y = H; b.add(roof);
    if (st.kind !== 'round'){ const ge = gableEnd(W, st.h, st.wall()); ge.position.y = H; b.add(ge); }
    put(b, box(.075, .12, .01), style === 'lacquer' ? col('#6b2a22') : dark, 0, .06, D / 2 + .004);
    for (const x of [-.1, .1]) put(b, box(.05, .045, .01), win, x, .12, D / 2 + .004);
    let chim = new THREE.Vector3(.08, H + st.h * .75, -.05);
    if (style === 'thatch'){ put(b, box(.08, .02, .03), col('#6b4a2e'), .1, .09, D / 2 + .02); for (let n = 0; n < 4; n++) put(b, box(.014, .014, .014), col(['#f2b8c6', '#ffe08a', '#e8704a', '#f3f0e6'][n]), .07 + n * .02, .105, D / 2 + .02);
      put(b, box(.045, .1, .045), col('#8a7a6a'), .09, H + .12, -.06); chim = new THREE.Vector3(.09, H + .19, -.06); }
    if (style === 'cedar'){ put(b, box(.06, .22, .06), col('#8e8a82'), -.12, H + .08, -.07); chim = new THREE.Vector3(-.12, H + .22, -.07);
      put(b, box(.36, .02, .07), col('#6b4630'), 0, .005, D / 2 + .03); }
    if (style === 'lacquer'){ for (const x of [-.06, .06]) put(b, box(.025, .035, .025), glow, x, .14, D / 2 + .03); put(b, box(.4, .02, .34), col('#2a1d14'), 0, H + .005, 0); chim = null; }
    if (style === 'stilt'){ put(b, box(.34, .015, .12), col('#8a6440'), 0, -.005, D / 2 + .06); for (const x of [-.16, .16]) put(b, box(.012, .08, .012), col('#5a4028'), x, .035, D / 2 + .115);
      put(b, box(.34, .012, .012), col('#5a4028'), 0, .075, D / 2 + .115); }
    b.scale.setScalar(scale); b.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    return { group: b, chim };
  }
  return { body, stilts: STY.stilt };
}
