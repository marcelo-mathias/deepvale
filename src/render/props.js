// Low-poly meshes for everything built in 0.3: work buildings, fishing spots, decor, wagons, barges and birds.
// Each builder returns a Group centred on its tile, at ground height 0 (the caller positions it).
import * as THREE from 'three';

export function makeProps({ rimMat }){
  const M = {}, G = {};
  const mat = (c, rim = '#ffd9a8', s = .8) => (M[c + rim + s] ||= rimMat({ color: c }, rim, s));
  const glows = [];
  const glowM = (c, e = 2.2) => (M['glow' + c + e] ||= (() => { const m = new THREE.MeshStandardMaterial({ color: '#2a1d14', emissive: new THREE.Color(c), emissiveIntensity: e }); m.userData.base = e; glows.push(m); return m; })());
  const setGlow = f => { for (const m of glows) m.emissiveIntensity = m.userData.base * f; };
  const box = (w, h, d) => (G['b' + w + h + d] ||= new THREE.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, s = 6) => (G['c' + rt + rb + h + s] ||= new THREE.CylinderGeometry(rt, rb, h, s));
  const ico = r => (G['i' + r] ||= new THREE.IcosahedronGeometry(r, 0));
  const cone = (r, h, s) => (G['k' + r + h + s] ||= new THREE.ConeGeometry(r, h, s));
  const put = (g, geo, m, x, y, z, ry = 0, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  const R = seed => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const finish = g => { g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } }); return g; };

  const wood = '#8a6440', dark = '#5a4028', stone = '#9a948a', stone2 = '#7d786f';
  // a small gable roof: a 4-sided cone squashed along one axis
  const roof = (g, w, d, h, y, col) => { const o = put(g, cone(.5, 1, 4), mat(col, '#ffcf99', .9), 0, y + h / 2, 0, Math.PI / 4); o.scale.set(w * 1.42, h, d * 1.42); return o; };

  const B = {};
  B.woodcutter = (r) => { const g = new THREE.Group();
    put(g, box(.26, .15, .2), mat('#7a5a3a'), -.12, .075, -.1);
    const rf = put(g, box(.32, .025, .28), mat('#5f4a30', '#ffcf99', .9), -.12, .17, -.08, 0, -.35);
    for (let n = 0; n < 6; n++){ const row = n < 3 ? 0 : 1, x = .1 + (n % 3) * .065 - row * .03 + .03 * row; put(g, cyl(.028, .028, .26, 6), mat('#9a6b3f'), x, .03 + row * .05, .12, 0, 0, Math.PI / 2).rotation.y = Math.PI / 2; }
    put(g, cyl(.05, .055, .06, 7), mat('#8a6440'), .15, .03, -.16);
    put(g, box(.012, .1, .012), mat(dark), .15, .1, -.16, 0, 0, .5);
    return finish(g); };
  B.reedbed = (r) => { const g = new THREE.Group(), rnd = R(r); const cols = ['#7f9a4a', '#98a857', '#b9ae62', '#6b8a3e'];
    for (let n = 0; n < 34; n++){ const h = .14 + rnd() * .22, x = (rnd() - .5) * .85, z = (rnd() - .5) * .85;
      const o = put(g, box(.012, h, .012), mat(cols[n % 4], '#fff0b0', .6), x, h / 2 - .02, z, 0, (rnd() - .5) * .25, (rnd() - .5) * .25);
      if (n % 5 === 0) put(g, box(.02, .045, .02), mat('#5a3a22'), x, h - .02, z); }
    return finish(g); };
  B.claypit = (r) => { const g = new THREE.Group();
    put(g, box(.62, .03, .5), mat('#a0583a', '#ffc79a', .4), -.04, -.005, .02);
    put(g, box(.5, .02, .38), mat('#7e4028', '#ffc79a', .2), -.04, .005, .02);
    for (const [x, z, s] of [[.25, -.22, 1], [.3, -.12, .8], [.2, -.3, .7]]){ const p = put(g, cyl(.035 * s, .045 * s, .08 * s, 7), mat('#c8744a'), x, .04 * s, z); }
    for (let n = 0; n < 4; n++) put(g, box(.07, .03, .04), mat('#b8683f'), -.28 + (n % 2) * .075, .015 + Math.floor(n / 2) * .03, -.26);
    put(g, box(.012, .16, .012), mat(dark), .02, .08, -.2, 0, 0, .3);
    return finish(g); };
  B.workshop = (r) => { const g = new THREE.Group();
    put(g, box(.44, .22, .3), mat('#b99a6c'), 0, .11, -.02);
    roof(g, .5, .36, .2, .22, '#6b4a2e');
    put(g, box(.12, .14, .01), mat('#2a1d14'), -.08, .07, .135);
    put(g, box(.2, .04, .08), mat(wood), .12, .08, .2); put(g, box(.02, .08, .02), mat(dark), .04, .04, .2); put(g, box(.02, .08, .02), mat(dark), .2, .04, .2);
    put(g, box(.035, .045, .035), glowM('#ffb35a', 2.6), .1, .19, .17);
    put(g, box(.05, .12, .05), mat('#2a1d14'), -.15, .38, -.08);
    return finish(g); };
  B.post = (r) => { const g = new THREE.Group();
    for (const [x, z] of [[-.2, -.14], [.2, -.14], [-.2, .14], [.2, .14]]) put(g, box(.025, .24, .025), mat(dark), x, .12, z);
    put(g, box(.5, .025, .38), mat('#6b4a2e', '#ffcf99', .9), 0, .245, 0, 0, .12);
    put(g, box(.44, .16, .02), mat('#8a6440'), 0, .08, -.15);
    const cc = ['#b98552', '#c9a36a', '#9a6b3f'];
    for (let n = 0; n < 5; n++) put(g, box(.08, .07, .08), mat(cc[n % 3]), -.12 + (n % 3) * .1, .035 + Math.floor(n / 3) * .07, -.04 + (n % 2) * .04);
    put(g, box(.02, .3, .02), mat(dark), .3, .15, .26); put(g, box(.16, .07, .015), mat('#c9a36a'), .3, .26, .26);
    return finish(g); };
  B.jetty = (r, o = {}) => { const g = new THREE.Group();
    // deck runs from the tile centre out over the water on the +z side (the caller turns it to face the water)
    put(g, box(.26, .03, 1.0), mat('#8a6440', '#ffd29a', .8), 0, .06, .45);
    for (const x of [-.12, .12]) for (const z of [.2, .6, .92]) put(g, cyl(.02, .025, .9, 5), mat(dark), x, -.36, z);
    put(g, cyl(.03, .03, .08, 6), mat(dark), .12, .11, .9);
    put(g, box(.2, .12, .16), mat('#9a6b3f'), -.2, .06, -.15);
    put(g, box(.24, .02, .2), mat('#6b4a2e'), -.2, .13, -.15);
    return finish(g); };
  B.market = (r) => { const g = new THREE.Group(), rnd = R(r);
    const cloth = [['#c8563a', '#efe3c8'], ['#3e6d8a', '#efe3c8'], ['#c29a3a', '#f3ead4'], ['#6b7d3a', '#efe3c8']][r % 4];
    for (const [x, z] of [[-.22, -.15], [.22, -.15], [-.22, .15], [.22, .15]]) put(g, box(.02, .28, .02), mat(dark), x, .14, z);
    for (let s = 0; s < 5; s++) put(g, box(.1, .02, .36), mat(cloth[s % 2], '#fff0d0', .9), -.2 + s * .1, .29 + Math.sin(s * 1.3) * .004, 0, 0, 0, .12);
    put(g, box(.44, .03, .2), mat(wood), 0, .1, .04); put(g, box(.44, .09, .02), mat(dark), 0, .05, .13);
    const gc = ['#ffb35a', '#e0b070', '#c9c071', '#c8744a', '#b98552'];
    for (let n = 0; n < 6; n++){ const c = gc[Math.floor(rnd() * 5)]; put(g, n % 3 ? box(.04, .04, .04) : box(.035, .05, .035), n % 3 ? mat(c) : glowM('#ffb35a', 1.8), -.16 + n * .065, .137, .04 + (rnd() - .5) * .08); }
    return finish(g); };
  B.nets = (r) => { const g = new THREE.Group();
    put(g, box(.24, .14, .2), mat('#7a5a3a'), -.12, .07, -.1);
    roof(g, .3, .26, .12, .14, '#55605c').position.x = -.12; g.children[g.children.length - 1].position.z = -.1;
    put(g, box(.02, .3, .02), mat(dark), .14, .15, -.1); put(g, box(.02, .3, .02), mat(dark), .14, .15, .22);
    const n = put(g, box(.01, .2, .3), new THREE.MeshStandardMaterial({ color: '#2f3a36', transparent: true, opacity: .6, roughness: 1 }), .14, .17, .06);
    for (let k = 0; k < 4; k++) put(g, ico(.018), mat('#e8432f'), .15, .08 + k * .05, -.04 + k * .08);
    return finish(g); };
  B.rack = (r) => { const g = new THREE.Group();
    for (const z of [-.2, .2]){ put(g, box(.015, .3, .015), mat(dark), 0, .14, z, 0, 0, .35); put(g, box(.015, .3, .015), mat(dark), 0, .14, z, 0, 0, -.35); }
    put(g, box(.015, .015, .5), mat(dark), 0, .26, 0);
    for (let k = 0; k < 6; k++){ const z = -.17 + k * .068; put(g, box(.03, .1, .02), mat(k % 2 ? '#c9c071' : '#9aa857', '#fff0b0', .6), 0, .2, z); }
    return finish(g); };
  B.lantern = (r) => { const g = new THREE.Group();
    put(g, box(.1, .04, .1), mat(stone2, '#ffe0b0', .6), 0, .02, 0);
    put(g, box(.04, .12, .04), mat(stone, '#ffe0b0', .6), 0, .1, 0);
    put(g, box(.09, .025, .09), mat(stone, '#ffe0b0', .6), 0, .17, 0);
    put(g, box(.055, .05, .055), glowM('#ffc46a', 3), 0, .205, 0);
    put(g, cone(.085, .06, 4), mat(stone2, '#ffe0b0', .6), 0, .26, 0, Math.PI / 4);
    return finish(g); };
  B.cherry = (r) => { const g = new THREE.Group(), rnd = R(r);
    put(g, cyl(.018, .028, .22, 5), mat('#5a3a28'), 0, .11, 0, 0, 0, .1);
    const pinks = ['#f2b8c6', '#e89aae', '#f7d0da'];
    for (let n = 0; n < 5; n++) put(g, ico(.07 + rnd() * .04), mat(pinks[n % 3], '#fff0f4', .9), (rnd() - .5) * .16, .24 + rnd() * .1, (rnd() - .5) * .16);
    return finish(g); };
  B.flowers = (r) => { const g = new THREE.Group(), rnd = R(r); const cols = ['#f2b8c6', '#ffe08a', '#f3f0e6', '#b59ad8', '#e8704a'];
    for (let n = 0; n < 7; n++) put(g, ico(.035 + rnd() * .02), mat(n % 2 ? '#4f7a36' : '#5f8a3e', '#fff0b0', .5), (rnd() - .5) * .6, .02, (rnd() - .5) * .6);
    for (let n = 0; n < 22; n++) put(g, ico(.014), mat(cols[Math.floor(rnd() * 5)], '#ffffff', .8), (rnd() - .5) * .62, .05 + rnd() * .02, (rnd() - .5) * .62);
    return finish(g); };
  B.fence = (r, o = {}) => { const g = new THREE.Group(); const nb = o.nb || {};
    const dirs = [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]];
    const any = dirs.some(([d]) => nb[d]);
    put(g, box(.03, .14, .03), mat(dark), 0, .07, 0);
    for (const [d, a, b] of dirs){ if (!(nb[d] || (!any && (d === 'e' || d === 'w')))) continue;
      put(g, box(.025, .12, .025), mat(dark), a * .45, .06, b * .45);
      for (const y of [.05, .11]){ const rail = put(g, box(a ? .5 : .018, .018, b ? .5 : .018), mat('#9a7048'), a * .23, y, b * .23); } }
    return finish(g); };
  /* ---------- fish statues: a carved fish on a stepped plinth, in a small garden terrace dressed for that fish ---------- */
  const FISH_COL = { reed: '#b8c2a4', koi: '#d8483a', carp: '#b07a3a', showa: '#ff8a4a', sturgeon: '#7a9a4a', eel: '#6fd8f0', moon: '#e4ebff', warden: '#e8b84a' };
  const disc = (r, h, seg = 14) => (G['d' + r + h + seg] ||= new THREE.CylinderGeometry(r, r, h, seg));
  const pondM = () => (M.pond ||= (() => { const m = new THREE.MeshStandardMaterial({ color: '#244f55', roughness: .15, metalness: .1 }); return m; })());
  const pebbles = (g, rnd, n, cols, x0, z0, spread) => { for (let q = 0; q < n; q++) put(g, ico(.018 + rnd() * .014), mat(cols[q % cols.length], '#ffffff', .5), x0 + (rnd() - .5) * spread, .025, z0 + (rnd() - .5) * spread).scale.y = .55; };
  const reedClump = (g, rnd, x, z, n = 7, cols = ['#7f9a4a', '#98a857', '#b9ae62']) => { for (let q = 0; q < n; q++){ const h = .1 + rnd() * .14; put(g, box(.01, h, .01), mat(cols[q % cols.length], '#fff0b0', .6), x + (rnd() - .5) * .08, h / 2, z + (rnd() - .5) * .08, 0, (rnd() - .5) * .3, (rnd() - .5) * .3); } };
  const pond = (g, x, z, rad) => { put(g, disc(rad + .025, .03), mat(stone2, '#ffe0b0', .5), x, .018, z); put(g, disc(rad, .012), pondM(), x, .034, z); };
  const pads = (g, rnd, x, z, rad, n = 3) => { for (let q = 0; q < n; q++){ const a = rnd() * 6.28, d = rnd() * rad * .7; put(g, disc(.028, .004, 7), mat('#4f7a36', '#fff0b0', .5), x + Math.cos(a) * d, .042, z + Math.sin(a) * d); } };
  const THEME = {
    reed: (g, rnd) => { pond(g, .22, .2, .14); pads(g, rnd, .22, .2, .14); for (const [x, z] of [[-.3, .22], [-.26, -.28], [.3, -.26], [.34, .02]]) reedClump(g, rnd, x, z); },
    koi: (g, rnd) => { pond(g, .2, .2, .17); pads(g, rnd, .2, .2, .17, 4);
      for (let q = 0; q < 2; q++){ const f = put(g, box(.05, .012, .018), mat(q ? '#f3efe6' : '#d8483a', '#ffffff', .8), .16 + q * .09, .045, .16 + q * .07, rnd() * 6); }
      pebbles(g, rnd, 9, ['#d8483a', '#f3efe6', '#9a948a'], -.22, -.24, .2); put(g, box(.03, .12, .03), mat('#b03a2c'), -.3, .06, .26); put(g, box(.03, .12, .03), mat('#b03a2c'), -.18, .06, .3); put(g, box(.16, .02, .03), mat('#b03a2c'), -.24, .125, .28, .35); },
    carp: (g, rnd) => { pebbles(g, rnd, 16, ['#9a948a', '#7d786f', '#b0a89a'], .0, .26, .6); for (const [x, z, s] of [[-.28, -.22, 1], [-.2, -.3, .8], [.3, -.24, .9]]){ put(g, cyl(.035 * s, .045 * s, .08 * s, 7), mat('#c8744a'), x, .04 * s + .015, z); } put(g, ico(.07), mat(stone2, '#ffe0b0', .5), .28, .05, .12).scale.set(1.3, .6, 1); },
    showa: (g, rnd) => { for (const [x, z] of [[-.28, .24], [.28, .24], [.28, -.26], [-.28, -.26]]){ put(g, box(.07, .06, .07), mat('#3a3232', '#ffb080', .5), x, .045, z); put(g, ico(.028), glowM('#ff8a4a', 2.6), x, .085, z); }
      pebbles(g, rnd, 12, ['#231d1d', '#3a3232', '#5a2a1a'], 0, .25, .5); },
    sturgeon: (g, rnd) => { for (let q = 0; q < 5; q++){ const a = q / 5 * 6.28 + rnd(); put(g, ico(.07 + rnd() * .04), mat(q % 2 ? '#5f7a3e' : '#6b8a45', '#e0ffb0', .5), Math.cos(a) * .32, .02, Math.sin(a) * .32).scale.y = .45; }
      const lg = put(g, cyl(.035, .04, .34, 6), mat('#6b4a2e'), -.22, .045, .26, .4, 0, Math.PI / 2); put(g, box(.2, .012, .05), mat('#6b8a45'), -.22, .085, .26, .4);
      for (const [x, z] of [[.3, .22], [.26, -.28], [-.32, -.18]]) for (let q = 0; q < 4; q++) put(g, cone(.02, .1, 4), mat('#4f7a36', '#e0ffb0', .6), x + (rnd() - .5) * .06, .05, z + (rnd() - .5) * .06, 0, (rnd() - .5) * .8, (rnd() - .5) * .8); },
    eel: (g, rnd) => { for (let q = 0; q < 7; q++){ const a = -1.2 + q * .45; put(g, box(.1, .012, .06), mat('#1d3a4a', '#8ff0ff', .5), Math.cos(a) * .32, .03, Math.sin(a) * .32, -a); }
      for (let q = 0; q < 4; q++){ const a = -1 + q * .8; put(g, ico(.022), glowM('#8ff0ff', 2.4), Math.cos(a) * .3, .05, Math.sin(a) * .3); } reedClump(g, rnd, -.3, -.24, 6, ['#3f5a4a', '#56705a']); },
    moon: (g, rnd) => { put(g, disc(.4, .012, 18), mat('#e8e6dc', '#ffffff', .6), 0, .025, 0);
      for (let q = 0; q < 4; q++) put(g, new THREE.TorusGeometry(.2 + q * .05, .004, 3, 24, Math.PI * 1.2), mat('#cfccc0'), 0, .033, 0, 0, Math.PI / 2);
      const arch = put(g, new THREE.TorusGeometry(.2, .018, 5, 18, Math.PI), mat('#f1f3fa', '#dfe6ff', 1.2), 0, .03, -.3); for (let q = 0; q < 3; q++) put(g, ico(.022), glowM('#b9ccff', 2.4), -.3 + q * .3, .05, .3); },
    warden: (g, rnd) => { for (let q = 0; q < 7; q++){ const a = q / 7 * 6.28, h = .22 + rnd() * .14; put(g, box(.06, h, .045), mat(q % 2 ? stone : stone2, '#ffe0b0', .7), Math.cos(a) * .36, h / 2, Math.sin(a) * .36, -a, (rnd() - .5) * .12, (rnd() - .5) * .12); }
      for (let q = 0; q < 4; q++){ const a = q * 1.57 + .4; put(g, ico(.02), glowM('#ffc861', 2.2), Math.cos(a) * .22, .04, Math.sin(a) * .22); } },
  };
  // o.sp: which fish, o.lvl: 1–3 (raised with its tales), o.base: 'round' | 'square' | 'tri'
  B.statue = (r, o = {}) => { const g = new THREE.Group(), rnd = R(r), sp = o.sp || 'koi', lvl = o.lvl || 1, base = o.base || 'round', fc = FISH_COL[sp] || '#c9a36a';
    const seg = base === 'tri' ? 3 : base === 'square' ? 4 : 16, rot = base === 'square' ? Math.PI / 4 : base === 'tri' ? Math.PI / 6 : 0;
    const slab = (rad, h, y, m) => put(g, new THREE.CylinderGeometry(rad, rad, h, seg), m, 0, y, 0, rot);
    // the terrace, edged with stones along its outline
    const tr = base === 'square' ? .64 : base === 'tri' ? .56 : .46;
    slab(tr, .03, .005, mat('#8e877c', '#ffe0b0', .5));
    const edgePts = []; const corners = Array.from({ length: seg }, (_, q) => { const a = rot + q / seg * 6.283 + Math.PI / 2 * 0; return [Math.sin(a) * tr, Math.cos(a) * tr]; });
    const perSide = base === 'round' ? 1 : base === 'square' ? 5 : 6;
    for (let q = 0; q < seg; q++){ const [x0, z0] = corners[q], [x1, z1] = corners[(q + 1) % seg];
      for (let t = 0; t < perSide; t++){ const u = t / perSide; edgePts.push([x0 + (x1 - x0) * u, z0 + (z1 - z0) * u, Math.atan2(x1 - x0, z1 - z0)]); } }
    edgePts.forEach(([x, z, a], q) => put(g, box(.05, .035, .07), mat(q % 2 ? stone : stone2, '#ffe0b0', .5), x * .98, .02, z * .98, a));
    (THEME[sp] || THEME.koi)(g, rnd);
    // stepped plinth in the same shape, banded in the fish's colour
    const pr = base === 'round' ? 1 : base === 'square' ? 1.4 : 1.25;
    slab(.13 * pr, .06, .05, mat(stone2, '#ffe0b0', .7));
    slab(.1 * pr, .07, .115, mat(stone, '#ffe0b0', .7));
    slab(.102 * pr, .012, .14, mat(lvl >= 3 ? '#e8b84a' : fc, '#ffffff', lvl >= 3 ? 1.2 : .8));
    slab(.075 * pr, .04, .17, mat(stone2, '#ffe0b0', .7));
    // raised once: a pair of stone lanterns and offerings in the fish's colour
    if (lvl >= 2){ for (const x of [-.24, .24]){ const l = B.lantern(r + (x > 0 ? 1 : 2)); l.scale.setScalar(.8); l.position.set(x, .02, .3); g.add(l); }
      for (let q = 0; q < 3; q++) put(g, ico(.018), mat(fc, '#ffffff', .8), -.05 + q * .05, .21, .06); }
    // raised twice: a halo of light behind the carving and banners on poles
    if (lvl >= 3){ put(g, new THREE.TorusGeometry(.2, .012, 5, 24), glowM(fc === '#e4ebff' ? '#b9ccff' : fc, 1.6), 0, .38, -.06);
      for (const x of [-.34, .34]){ put(g, cyl(.008, .008, .42, 4), mat(dark), x, .21, -.2); put(g, box(.06, .14, .006), mat(fc, '#ffffff', .9), x + .035, .34, -.2); } }
    // the carving rides a stone wave, as if leaping from it
    put(g, cyl(.018, .032, .13, 6), mat(stone, '#ffe0b0', .7), 0, .245, 0, 0, .15, .1);
    put(g, ico(.045), mat(stone, '#ffe0b0', .7), .015, .3, 0).scale.set(1.3, .6, 1);
    if (o.fish){ o.fish.position.set(0, .35, 0); o.fish.rotation.set(-.3, .5, .1); g.add(o.fish); }
    return finish(g); };

  /* ---------- the tale house: the valley's folklore museum. It grows as tales are learned ----------
     o.tales: tales known in all; o.met: ids of fish met (each gets a banner) */
  B.talehall = (r, o = {}) => { const g = new THREE.Group(), T = o.tales || 0, met = o.met || [];
    put(g, box(.62, .04, .44), mat(stone2, '#ffe0b0', .6), 0, .02, -.04);
    put(g, box(.5, .24, .32), mat('#a67c52'), 0, .16, -.07);
    for (const x of [-.24, -.08, .08, .24]) put(g, box(.022, .24, .02), mat(dark), x, .16, .092);
    put(g, box(.52, .022, .02), mat(dark), 0, .27, .092);
    roof(g, .6, .42, .24, .28, '#5a3a2a').position.z = -.07;
    put(g, box(.09, .15, .01), mat('#2a1d14'), 0, .115, .096);
    // porch with lanterns, a signboard and the tale box
    put(g, box(.34, .02, .15), mat(wood), 0, .05, .17);
    for (const x of [-.15, .15]){ put(g, box(.02, .2, .02), mat(dark), x, .14, .235); put(g, box(.032, .04, .032), glowM('#ffc46a', 2.6), x, .19, .255); }
    put(g, box(.36, .018, .17), mat('#6b4a2e', '#ffcf99', .9), 0, .25, .17, 0, .22);
    put(g, box(.16, .045, .012), mat('#c9a36a', '#fff0c0', .9), 0, .29, .258);
    put(g, box(.05, .055, .045), mat('#7a5236'), .22, .08, .25); put(g, box(.03, .005, .01), mat('#2a1d14'), .22, .109, .25);
    // a banner on the front for every fish met
    met.slice(0, 8).forEach((id, n) => { const x = -.21 + (n % 4) * .045 + (n >= 4 ? .27 : 0); put(g, box(.03, .08, .005), mat(FISH_COL[id] || '#c9a36a', '#ffffff', .9), x, .19, .1); put(g, box(.036, .006, .006), mat(dark), x, .232, .1); });
    // more tales, more house: an east wing with carved fish on plinths out front
    if (T >= 6){ put(g, box(.18, .18, .24), mat('#9a7048'), .34, .1, -.12); const rw = roof(g, .22, .28, .15, .19, '#5a3a2a'); rw.position.set(.34, .265, -.12);
      met.slice(0, 3).forEach((id, n) => { const x = .26 + n * .08; put(g, box(.045, .06, .045), mat(stone, '#ffe0b0', .6), x, .05, .12); put(g, box(.06, .02, .018), mat(FISH_COL[id] || '#c9a36a', '#ffffff', .9), x, .09, .12, .3, 0, .25); }); }
    // a lantern tower to call pilgrims down the Way
    if (T >= 12){ put(g, box(.11, .44, .11), mat('#8a6440'), -.33, .22, -.2); put(g, box(.07, .06, .012), glowM('#ffc46a', 2.6), -.33, .38, -.143);
      put(g, cone(.1, .12, 4), mat('#5a3a2a', '#ffcf99', .9), -.33, .5, -.2, Math.PI / 4); put(g, cyl(.006, .006, .1, 3), mat(dark), -.33, .6, -.2); put(g, box(.05, .03, .004), mat(FISH_COL[met[0]] || '#c9a36a'), -.305, .62, -.2); }
    // a west wing and a string of paper lanterns across the yard
    if (T >= 18){ put(g, box(.16, .16, .2), mat('#9a7048'), -.35, .08, .12); const rw = roof(g, .2, .24, .13, .16, '#5a3a2a'); rw.position.set(-.35, .225, .12);
      for (let q = 0; q < 6; q++) put(g, box(.022, .03, .022), glowM(['#ffc46a', '#ff9a5a', '#fff0b0'][q % 3], 2.2), -.25 + q * .1, .33 - Math.sin(q / 5 * Math.PI) * .04, .3); }
    // every tale known: a gilded ridge fish
    if (T >= 24){ put(g, box(.1, .03, .02), mat('#e8b84a', '#fff0c0', 1.2), 0, .42, -.07, 0, 0, .15); }
    return finish(g); };

  B.pier = (r, o = {}) => { const g = new THREE.Group();
    put(g, box(.34, .035, 1.02), mat('#8a6440', '#ffd29a', .8), 0, .02, 0);
    for (const x of [-.15, .15]) for (const z of [-.4, 0, .4]) put(g, cyl(.02, .025, 1.1, 5), mat(dark), x, -.5, z);
    return finish(g); };
  B.shrine = (r) => { const g = new THREE.Group();
    put(g, box(.34, .05, .34), mat(stone2, '#ffe0b0', .6), 0, .025, 0);
    put(g, box(.2, .16, .16), mat(stone, '#ffe0b0', .6), 0, .13, 0);
    roof(g, .3, .26, .1, .21, '#3f4a44');
    put(g, box(.04, .04, .02), glowM('#ffd27a', 3), 0, .12, .085);
    for (const x of [-.14, .14]) put(g, box(.03, .05, .03), glowM('#ffc46a', 2), x, .075, .19);
    return finish(g); };
  B.stones = (r) => { const g = new THREE.Group(), rnd = R(r);
    for (let n = 0; n < 7; n++){ const a = n / 7 * Math.PI * 2, h = .16 + rnd() * .14;
      put(g, box(.07, h, .05), mat(n % 2 ? stone : stone2, '#ffe0b0', .7), Math.cos(a) * .3, h / 2 - .01, Math.sin(a) * .3, -a, (rnd() - .5) * .15, (rnd() - .5) * .15); }
    put(g, box(.12, .04, .08), mat(stone2), 0, .02, 0);
    return finish(g); };
  B.weir = (r) => { const g = new THREE.Group(), rnd = R(r);
    for (let n = 0; n < 5; n++){ const h = .22 + rnd() * .08; put(g, box(.2, h, .22), mat(n % 2 ? stone : stone2, '#ffe0b0', .6), 0, h / 2 - .08, -.4 + n * .2, 0, (rnd() - .5) * .1, (rnd() - .5) * .08); }
    put(g, box(.06, .05, 1), mat('#5f7a4a', '#fff0b0', .4), .08, .15, 0);
    return finish(g); };
  B.bones = (r) => { const g = new THREE.Group(); const bone = mat('#e8e0cc', '#ffffff', .9);
    for (let n = 0; n < 7; n++){ const s = 1 - Math.abs(n - 3) * .12; const t = put(g, new THREE.TorusGeometry(.16 * s, .012, 4, 10, Math.PI), bone, -.36 + n * .12, 0, 0, Math.PI / 2); }
    put(g, box(.86, .025, .025), bone, 0, .01, 0);
    put(g, ico(.08), bone, .5, .03, 0).scale.set(1.4, .7, 1);
    return finish(g); };

  /* ---------- landmarks: bigger than a tile, they rise out of the forest ---------- */
  const moss = '#5f7a45', moss2 = '#6f8a4f', old = '#8e877c', old2 = '#6f6a62';
  B.temple = (r) => { const g = new THREE.Group(), rnd = R(r);
    put(g, box(1.5, .1, 1.5), mat(old2, '#ffe0b0', .5), 0, .05, 0);
    put(g, box(1.25, .1, 1.25), mat(old, '#ffe0b0', .5), 0, .15, 0);
    for (let q = 0; q < 5; q++) put(g, box(.5, .04, .12), mat(old, '#ffe0b0', .5), 0, .03 + q * .035, .78 + q * -.03).scale.z = 1;
    // hall: posts, walls, two curved roofs
    for (const [x, z] of [[-.45, -.45], [.45, -.45], [-.45, .45], [.45, .45], [-.15, .45], [.15, .45]]) put(g, cyl(.04, .045, .55, 6), mat('#6b3a2a', '#ffd0a0', .6), x, .47, z);
    put(g, box(.86, .5, .8), mat('#cfc4ad', '#fff0d0', .4), 0, .45, -.05);
    put(g, box(.14, .26, .02), mat('#2a1d14'), 0, .33, .36);
    const roof1 = put(g, cone(.82, .32, 4), mat('#3f4f48', '#cfe8d8', .8), 0, .9, 0, Math.PI / 4); roof1.scale.set(1.05, 1, 1.05);
    put(g, box(.5, .2, .5), mat('#cfc4ad', '#fff0d0', .4), 0, 1.12, 0);
    const roof2 = put(g, cone(.55, .3, 4), mat('#3f4f48', '#cfe8d8', .8), 0, 1.36, 0, Math.PI / 4);
    put(g, cyl(.012, .012, .22, 4), mat('#c9a36a'), 0, 1.6, 0); put(g, ico(.04), glowM('#ffd27a', 2.2), 0, 1.72, 0);
    // the bell, hung in a small frame beside the steps
    put(g, box(.03, .4, .03), mat(dark), .62, .4, .55); put(g, box(.03, .4, .03), mat(dark), .82, .4, .55); put(g, box(.26, .03, .04), mat(dark), .72, .6, .55);
    put(g, cyl(.05, .08, .13, 8), mat('#7a6a3a', '#ffe6a0', 1.1), .72, .5, .55);
    // moss creeping over the stone, and two lanterns
    for (let q = 0; q < 14; q++) put(g, ico(.06 + rnd() * .07), mat(q % 2 ? moss : moss2, '#e0ffb0', .4), (rnd() - .5) * 1.4, .12, (rnd() - .5) * 1.4).scale.y = .45;
    for (const x of [-.3, .3]){ const l = B.lantern(r + (x > 0 ? 3 : 4)); l.scale.setScalar(1.3); l.position.set(x, .2, .92); g.add(l); }
    return finish(g); };
  B.elder = (r) => { const g = new THREE.Group();
    put(g, cyl(.13, .26, 1.6, 7), mat('#5a3a28', '#ffd0a0', .5), 0, .8, 0);
    for (let q = 0; q < 5; q++){ const a = q / 5 * 6.28; const root = put(g, box(.07, .14, .5), mat('#5a3a28', '#ffd0a0', .4), Math.cos(a) * .3, .05, Math.sin(a) * .3, -a + Math.PI / 2, 0, .35); }
    const tiers = [[1.05, .9, 1.0], [.85, .8, 1.55], [.66, .72, 2.05], [.46, .62, 2.5], [.26, .5, 2.9]];
    tiers.forEach(([rad, h, y], n) => { put(g, cone(rad, h, 8), mat(['#24452a', '#2b502e', '#325a33', '#3a6437', '#44703c'][n], '#ffd59a', .7), 0, y + h / 2, 0, n * .4); });
    put(g, ico(.05), glowM('#fff0b0', 2), 0, 3.48, 0);
    return finish(g); };
  B.tower = (r) => { const g = new THREE.Group();
    put(g, cyl(.24, .32, 1.9, 10), mat('#d8d0bf', '#fff0d0', .5), 0, .95, 0);
    for (const y of [.5, 1.1, 1.6]) put(g, box(.07, .1, .02), mat('#2a1d14'), 0, y, .27 - y * .02);
    put(g, cyl(.32, .28, .07, 10), mat('#3a3436'), 0, 1.93, 0);
    put(g, cyl(.19, .19, .26, 10), glowM('#ff8a5a', 2.6), 0, 2.1, 0);
    for (let q = 0; q < 8; q++){ const a = q / 8 * 6.28; put(g, box(.012, .26, .012), mat('#2a1d14'), Math.cos(a) * .195, 2.1, Math.sin(a) * .195); }
    put(g, cone(.24, .2, 10), mat('#3a3436'), 0, 2.33, 0); put(g, ico(.035), mat('#3a3436'), 0, 2.46, 0);
    // the keeper's house at its foot, with a chimney
    put(g, box(.62, .32, .42), mat('#cfc6b4', '#fff0d0', .4), .3, .16, .22);
    roof(g, .7, .5, .2, .32, '#4a4044').position.set(.3, .42, .22);
    put(g, box(.05, .08, .01), glowM('#ffb35a', 1.8), .1, .17, .435); put(g, box(.05, .14, .05), mat('#4a4044'), .5, .52, .1);
    return finish(g); };
  B.gate = (r) => { const g = new THREE.Group(), rnd = R(r);
    for (const x of [-.55, .55]){ put(g, box(.22, 1.5, .22), mat(old, '#ffe0b0', .6), x, .72, 0, 0, 0, x * .04);
      for (let q = 0; q < 4; q++) put(g, box(.1, .1, .01), glowM('#9ff0d0', 1.6), x, .35 + q * .3, .115); }
    put(g, box(1.6, .18, .3), mat(old2, '#ffe0b0', .6), 0, 1.52, 0, 0, 0, -.06);
    put(g, box(1.3, .1, .24), mat(old, '#ffe0b0', .6), 0, 1.3, 0);
    // carved beasts on the lintel: a stag, an owl, a whale
    put(g, box(.18, .1, .02), mat('#9a948a'), -.4, 1.53, .16); put(g, box(.12, .12, .02), mat('#9a948a'), 0, 1.53, .16); put(g, box(.24, .08, .02), mat('#9a948a'), .4, 1.53, .16);
    for (let q = 0; q < 18; q++) put(g, ico(.06 + rnd() * .08), mat(q % 2 ? moss : moss2, '#e0ffb0', .4), (rnd() - .5) * 1.8, rnd() < .3 ? 1.55 : .05, (rnd() - .5) * .9).scale.y = .5;
    put(g, box(.9, .03, .5), mat('#4a6a5a', '#9ff0d0', .5), 0, .01, .1);
    return finish(g); };
  // the landmarks that can be seen before they are found
  function landmark(type, r){ return B[type] ? B[type](r) : null; }

  /* ---------- vehicles ---------- */
  function wagon(){
    const g = new THREE.Group();
    put(g, box(.2, .04, .3), mat('#8a6440'), 0, .09, -.02);
    for (const x of [-.11, .11]) for (const z of [-.11, .07]){ const w = put(g, cyl(.05, .05, .02, 8), mat(dark), x, .05, z, 0, 0, Math.PI / 2); }
    put(g, box(.02, .02, .22), mat(dark), -.04, .07, .22); put(g, box(.02, .02, .22), mat(dark), .04, .07, .22);
    // the ox
    put(g, box(.1, .08, .18), mat('#6b4e36'), 0, .1, .36); put(g, box(.07, .06, .07), mat('#5a3f2c'), 0, .12, .47);
    for (const x of [-.035, .035]) for (const z of [.3, .42]) put(g, box(.02, .07, .02), mat('#4a3424'), x, .035, z);
    put(g, box(.1, .012, .012), mat('#e8e0cc'), 0, .16, .48);
    const cargo = new THREE.Group(); g.add(cargo);
    for (let n = 0; n < 6; n++){ const c = put(cargo, box(.07, .06, .07), mat('#b98552'), -.05 + (n % 2) * .1, .14 + Math.floor(n / 4) * .06, -.1 + (Math.floor(n / 2) % 2) * .09); c.visible = false; }
    // driver
    put(g, cyl(.03, .05, .12, 5), mat('#b5523b'), 0, .17, .1); put(g, ico(.032), mat('#e2b58c'), 0, .25, .1); put(g, cone(.06, .04, 6), mat('#d8bd78'), 0, .29, .1);
    return finish(g);
  }
  function barge(){
    const g = new THREE.Group();
    put(g, box(.24, .06, .7), mat('#6b4a2e'), 0, .01, 0);
    put(g, box(.26, .02, .72), mat('#8a6440'), 0, .045, 0);
    const bow = put(g, cone(.12, .18, 4), mat('#6b4a2e'), 0, .01, .44, Math.PI / 4, Math.PI / 2); bow.scale.set(1, 1, .5);
    const cargo = new THREE.Group(); g.add(cargo);
    for (let n = 0; n < 8; n++){ const c = put(cargo, box(.08, .07, .08), mat('#b98552'), -.05 + (n % 2) * .1, .09 + Math.floor(n / 6) * .07, -.2 + (Math.floor(n / 2) % 3) * .1); c.visible = false; }
    put(g, cyl(.03, .05, .12, 5), mat('#3e6d8a'), 0, .11, -.28); put(g, ico(.032), mat('#e2b58c'), 0, .19, -.28); put(g, cone(.06, .04, 6), mat('#d8bd78'), 0, .23, -.28);
    put(g, cyl(.005, .005, .8, 3), mat(dark), .07, .2, -.24, 0, .5, 0);
    put(g, box(.03, .04, .03), glowM('#ffc46a', 2.4), 0, .09, .3);
    return finish(g);
  }
  function setCargo(v, list){ // list: array of good colours, one per crate shown
    const cargo = v.children.find(c => c.isGroup);
    cargo.children.forEach((c, n) => { c.visible = n < list.length; if (n < list.length) c.material = mat(list[n]); });
  }
  function bird(){
    const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: '#1d1a18', side: THREE.DoubleSide, fog: false });
    const wg = G.wing ||= new THREE.PlaneGeometry(.12, .045).translate(.06, 0, 0).rotateX(-Math.PI / 2);
    const l = new THREE.Mesh(wg, m), r = new THREE.Mesh(wg, m); r.scale.x = -1; g.add(l, r); g.userData = { l, r }; return g;
  }
  /* ---------- upgrades grow a building piece by piece instead of just scaling it ---------- */
  function grow(name, add){ const base = B[name]; B[name] = (r, o = {}) => { const g = base(r, o), l = o.lvl || 1; if (l > 1) add(g, l, r); return finish(g); }; }
  const kiln = (g, x, z) => { const k = put(g, new THREE.SphereGeometry(.09, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#a0583a', '#ffc79a', .6), x, 0, z); put(g, box(.04, .04, .02), glowM('#ff8a3a', 2.4), x, .03, z + .085); put(g, box(.03, .08, .03), mat(stone2), x, .11, z - .03); };
  const crates = (g, x, z, n) => { const cc = ['#b98552', '#c9a36a', '#9a6b3f']; for (let q = 0; q < n; q++) put(g, box(.07, .06, .07), mat(cc[q % 3]), x + (q % 2) * .08, .03 + Math.floor(q / 2) * .06, z + (q % 3) * .02); };
  const barrels = (g, x, z) => { for (const [a, b] of [[0, 0], [.07, .03], [.02, -.07]]){ put(g, cyl(.032, .032, .085, 8), mat('#7a5236'), x + a, .042, z + b); } };
  const shed = (g, x, z, w, d, col) => { put(g, box(w, .15, d), mat('#8a6440'), x, .075, z); roof(g, w + .06, d + .06, .1, .15, col).position.set(x, .2, z); };
  grow('market', (g, l, r) => { const s2 = B.market(r + 3); s2.scale.setScalar(.72); s2.position.set(-.3, 0, -.3); g.add(s2); crates(g, .26, .24, 3);
    if (l >= 3){ const s3 = B.market(r + 7); s3.scale.setScalar(.72); s3.position.set(.3, 0, -.3); g.add(s3); barrels(g, -.3, .26);
      for (let q = 0; q < 6; q++) put(g, box(.025, .03, .025), glowM('#ffc46a', 2.2), -.3 + q * .12, .36 - Math.sin(q / 5 * Math.PI) * .04, .02); } });
  grow('post', (g, l) => { crates(g, .3, -.3, 4); put(g, cyl(.05, .05, .015, 8), mat(dark), -.32, .05, .3, 0, 0, Math.PI / 2);
    if (l >= 3) shed(g, -.3, -.3, .26, .22, '#55605c'); });
  grow('jetty', (g, l) => { put(g, box(.02, .4, .02), mat(dark), .1, .2, .7); put(g, box(.02, .02, .26), mat(dark), .1, .39, .6); put(g, box(.004, .15, .004), mat('#d8c9a8'), .1, .31, .48); crates(g, -.08, .78, 2);
    if (l >= 3) shed(g, .25, -.25, .22, .2, '#6b4a2e'); });
  grow('workshop', (g, l) => { kiln(g, .3, -.25); if (l >= 3){ shed(g, -.3, -.3, .22, .18, '#55605c'); for (let q = 0; q < 3; q++) put(g, box(.03, .04, .03), glowM('#ffb35a', 2), .3, .08 + q * .05, .22 + q * .03); } });
  grow('woodcutter', (g, l) => { for (let q = 0; q < 6; q++){ const o = put(g, cyl(.028, .028, .3, 6), mat('#9a6b3f'), -.28 + (q % 3) * .065, .03 + Math.floor(q / 3) * .05, .3); o.rotation.set(0, 0, Math.PI / 2); }
    if (l >= 3){ put(g, box(.02, .2, .02), mat(dark), .28, .1, .2); put(g, box(.02, .2, .02), mat(dark), .28, .1, .36); put(g, box(.02, .02, .2), mat(dark), .28, .2, .28); put(g, cyl(.03, .03, .3, 6), mat('#b98552'), .28, .12, .28, 0, 0, Math.PI / 2); } });
  grow('claypit', (g, l) => { kiln(g, .3, .28); if (l >= 3){ for (let q = 0; q < 5; q++) put(g, cyl(.03, .04, .07, 7), mat('#c8744a'), -.3 + q * .06, .035, .32); } });
  grow('reedbed', (g, l, r) => { const more = B.reedbed(r + 11); more.scale.set(1, 1.2, 1); g.add(more); });

  /* ---------- plot add-ons: yards, lamps and edges ---------- */
  const Y = {};
  Y.garden = (r) => { const g = new THREE.Group(), rnd = R(r); put(g, box(.26, .02, .2), mat('#5a4330', '#ffcf99', .2), 0, .01, 0);
    for (let n = 0; n < 8; n++) put(g, ico(.022), mat(n % 3 ? '#6f9a3e' : '#c8563a', '#fff0b0', .6), -.1 + (n % 4) * .065, .035, -.06 + Math.floor(n / 4) * .12); return finish(g); };
  Y.woodpile = () => { const g = new THREE.Group(); for (let n = 0; n < 6; n++){ const o = put(g, cyl(.022, .022, .2, 5), mat('#9a6b3f'), 0, .022 + Math.floor(n / 3) * .04, -.045 + (n % 3) * .045, 0, 0, Math.PI / 2); o.rotation.y = Math.PI / 2; } return finish(g); };
  Y.well = () => { const g = new THREE.Group(); put(g, cyl(.08, .09, .08, 8), mat(stone, '#ffe0b0', .6), 0, .04, 0); put(g, cyl(.06, .06, .01, 8), mat('#23413c'), 0, .081, 0);
    for (const x of [-.07, .07]) put(g, box(.015, .18, .015), mat(dark), x, .15, 0); roof(g, .2, .14, .06, .23, '#6b4a2e'); return finish(g); };
  Y.tree = (r) => { const g = new THREE.Group(), rnd = R(r); put(g, cyl(.018, .026, .2, 5), mat('#5a3a28'), 0, .1, 0);
    for (let n = 0; n < 3; n++) put(g, ico(.08 + rnd() * .03), mat(['#4f7a36', '#5f8a3e', '#6d8a3a'][n], '#fff0b0', .7), (rnd() - .5) * .1, .24 + rnd() * .08, (rnd() - .5) * .1); return finish(g); };
  Y.bench = () => { const g = new THREE.Group(); put(g, box(.22, .015, .07), mat('#8a6440'), 0, .06, 0); put(g, box(.22, .05, .012), mat('#8a6440'), 0, .095, -.03);
    for (const x of [-.09, .09]) put(g, box(.015, .06, .06), mat(dark), x, .03, 0); return finish(g); };
  Y.planter = (r) => { const g = new THREE.Group(), rnd = R(r); put(g, box(.2, .07, .12), mat('#b8683f'), 0, .035, 0);
    for (let n = 0; n < 6; n++) put(g, ico(.022), mat(['#f2b8c6', '#ffe08a', '#5f8a3e'][n % 3], '#fff', .6), -.07 + n * .028, .08, (rnd() - .5) * .05); return finish(g); };
  Y.logs = () => { const g = new THREE.Group(); for (let n = 0; n < 7; n++){ const row = n < 4 ? 0 : 1; const o = put(g, cyl(.025, .025, .26, 5), mat(n % 2 ? '#9a6b3f' : '#8a5f36'), 0, .025 + row * .045, -.08 + (n % 4) * .052 + row * .025, 0, 0, Math.PI / 2); o.rotation.y = Math.PI / 2; } return finish(g); };
  Y.sawhorse = () => { const g = new THREE.Group(); for (const x of [-.08, .08]){ put(g, box(.015, .12, .015), mat(dark), x, .05, -.03, 0, .4); put(g, box(.015, .12, .015), mat(dark), x, .05, .03, 0, -.4); }
    put(g, box(.22, .02, .02), mat('#8a6440'), 0, .1, 0); put(g, cyl(.024, .024, .3, 5), mat('#b98552'), 0, .13, 0, 0, 0, Math.PI / 2); return finish(g); };
  Y.bricks = () => { const g = new THREE.Group(); for (let n = 0; n < 9; n++) put(g, box(.06, .025, .035), mat(n % 2 ? '#b8683f' : '#c8744a'), -.07 + (n % 3) * .07, .015 + Math.floor(n / 3) * .028, (Math.floor(n / 3) % 2) * .02); return finish(g); };
  Y.display = () => { const g = new THREE.Group(); put(g, box(.24, .02, .09), mat('#8a6440'), 0, .08, 0); for (const x of [-.1, .1]) put(g, box(.015, .08, .07), mat(dark), x, .04, 0);
    put(g, box(.04, .05, .04), glowM('#ffb35a', 1.8), -.06, .115, 0); put(g, box(.04, .04, .03), mat('#e0b070'), .02, .11, 0); put(g, box(.03, .06, .03), mat('#c8744a'), .08, .12, 0); return finish(g); };
  Y.crates = () => { const g = new THREE.Group(); const cc = ['#b98552', '#c9a36a', '#9a6b3f']; for (let n = 0; n < 4; n++) put(g, box(.08, .07, .08), mat(cc[n % 3]), -.05 + (n % 2) * .09, .035 + Math.floor(n / 3) * .07, -.04 + (n % 3) * .04); return finish(g); };
  Y.hitch = () => { const g = new THREE.Group(); for (const x of [-.1, .1]) put(g, box(.02, .12, .02), mat(dark), x, .06, 0); put(g, box(.24, .02, .02), mat('#8a6440'), 0, .1, 0); return finish(g); };
  Y.barrels = () => { const g = new THREE.Group(); for (const [x, z] of [[-.05, 0], [.05, .03], [0, -.07]]){ put(g, cyl(.035, .035, .09, 8), mat('#7a5236'), x, .045, z); put(g, cyl(.037, .037, .01, 8), mat('#3b2a1c'), x, .07, z); } return finish(g); };
  function lamp(){ const g = new THREE.Group(); put(g, cyl(.01, .014, .3, 5), mat('#3b2a1c'), 0, .15, 0); put(g, box(.05, .05, .05), glowM('#ffc46a', 3), 0, .31, 0);
    put(g, cone(.045, .04, 4), mat('#2a1d14'), 0, .355, 0, Math.PI / 4); return finish(g); }
  function edge(type){ const g = new THREE.Group();
    if (type === 'hedge'){ for (let n = 0; n < 5; n++) put(g, ico(.075), mat(n % 2 ? '#4f7a36' : '#5a8a3a', '#fff0b0', .6), -.38 + n * .19, .06, 0).scale.set(1.3, .8, .9); }
    else if (type === 'wall'){ put(g, box(.94, .07, .06), mat(stone2, '#ffe0b0', .6), 0, .035, 0); put(g, box(.94, .015, .075), mat(stone, '#ffe0b0', .6), 0, .075, 0); }
    else { for (const x of [-.45, -.15, .15, .45]) put(g, box(.022, .12, .022), mat(dark), x, .06, 0); for (const y of [.05, .1]) put(g, box(.94, .016, .014), mat('#9a7048'), 0, y, 0); }
    return finish(g); }
  return { setGlow, B, Y, lamp, edge, wagon, barge, setCargo, bird, mat, landmark };
}
