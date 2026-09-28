// Low-poly meshes for everything built in 0.3: work buildings, fishing spots, decor, wagons, barges and birds.
// Each builder returns a Group centred on its tile, at ground height 0 (the caller positions it).
import * as THREE from 'three';

export function makeProps({ rimMat }){
  const M = {}, G = {};
  const mat = (c, rim = '#ffd9a8', s = .8) => (M[c + rim + s] ||= rimMat({ color: c }, rim, s));
  const glowM = (c, e = 2.2) => (M['glow' + c + e] ||= new THREE.MeshStandardMaterial({ color: '#2a1d14', emissive: new THREE.Color(c), emissiveIntensity: e }));
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
  B.statue = (r, o = {}) => { const g = new THREE.Group();
    put(g, box(.22, .08, .22), mat(stone2, '#ffe0b0', .7), 0, .04, 0);
    put(g, box(.16, .06, .16), mat(stone, '#ffe0b0', .7), 0, .11, 0);
    if (o.fish){ o.fish.position.set(0, .3, 0); o.fish.rotation.set(-.5, .6, .15); g.add(o.fish); }
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
  B.bones = (r) => { const g = new THREE.Group(); const bone = mat('#e8e0cc', '#ffffff', .9);
    for (let n = 0; n < 7; n++){ const s = 1 - Math.abs(n - 3) * .12; const t = put(g, new THREE.TorusGeometry(.16 * s, .012, 4, 10, Math.PI), bone, -.36 + n * .12, 0, 0, Math.PI / 2); }
    put(g, box(.86, .025, .025), bone, 0, .01, 0);
    put(g, ico(.08), bone, .5, .03, 0).scale.set(1.4, .7, 1);
    return finish(g); };

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
  return { B, wagon, barge, setCargo, bird, mat };
}
