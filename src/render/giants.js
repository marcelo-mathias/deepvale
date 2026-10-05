// The giants of the high country: animals the size of mountains that wander past the valley now and then.
// They never come down into it. Each is built from a handful of soft shapes in hazy, atmospheric colours,
// so it reads as something seen through miles of air. Click one and it leaves the valley a gift.
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
const L = (a, b, t) => a + (b - a) * t;

export const GIANTS = {
  stag:  { name: 'The Mountain Stag', when: 'day',   line: 'A stag taller than the peaks walks the ridge to the north. The forest goes very quiet.' },
  owl:   { name: 'The Grey Owl',      when: 'dusk',  line: 'Something settles on the highest peak and folds its wings. Two lamps open in the dusk.' },
  whale: { name: 'The Cloud Whale',   when: 'day',   line: 'A whale swims through the sky above the valley, slow as weather.' },
  moth:  { name: 'The Lamp Moth',     when: 'night', line: 'A moth as big as a barn has come to the light. Its wings open and close like breathing.' },
  jelly: { name: 'The Lantern Bell',  when: 'night', line: 'A bell of light drifts over the mountains, trailing its long threads through the stars.' },
  elk:   { name: 'The Bone Elk',      when: 'cold',  line: 'In the last light, the bones of an elk walk the far ridge. Birds follow it without landing.' },
  wyrm:  { name: 'The Fog Wyrm',      when: 'fog',   line: 'In the fog, something long moves between the trunks of the outer forest. One red eye.' },
};

export function makeGiants({ scene, heightAt, rimMat, bird, HX, HZ, MTS, forest = () => true }){
  const all = [];
  // hazy materials: tinted toward the sky, a little see-through so the air shows
  const haze = (col, op = .9, emi = .12) => { const m = new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true, transparent: op < 1, opacity: op, emissive: new THREE.Color(col), emissiveIntensity: emi });
    m.userData.op = op; return m; };
  const glow = (col, e = 3) => { const m = new THREE.MeshStandardMaterial({ color: '#111', emissive: new THREE.Color(col), emissiveIntensity: e }); m.userData.op = 1; return m; };
  const add = (g, geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  const sph = new THREE.IcosahedronGeometry(1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 6), cone = new THREE.ConeGeometry(1, 1, 6);
  const limb = (g, m, x0, y0, z0, x1, y1, z1, r) => { const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), o = new THREE.Mesh(cyl, m);
    o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(r, a.distanceTo(b), r); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(o); return o; };

  /* ---------- the creatures ---------- */
  const BUILD = {
    stag(){ const g = new THREE.Group(), m = haze('#9aa6bd', .88), dark = haze('#7c879e', .9), legs = [];
      add(g, sph, m, 0, 0, 0, 1.6, 1.05, 3.2);
      limb(g, m, 0, .5, 2.4, 0, 2.6, 3.6, .55); add(g, sph, m, 0, 3, 4.1, .7, .7, 1.4, .4);
      add(g, cone, dark, 0, 2.75, 5.25, .28, .7, .28, Math.PI / 2 + .35);
      for (const s of [-1, 1]){ // antlers: a beam with tines, wide as a hillside
        const a = limb(g, dark, s * .3, 3.6, 3.8, s * 2.2, 7.2, 2.8, .14); limb(g, dark, s * 1.1, 5.0, 3.4, s * 2.6, 5.9, 4.4, .1); limb(g, dark, s * 1.7, 6.2, 3.1, s * 1.3, 8.4, 3.6, .1); limb(g, dark, s * 2.2, 7.2, 2.8, s * 3.4, 8.2, 2.2, .09);
        add(g, cone, m, s * .55, 3.35, 3.7, .2, .6, .1, 0, 0, s * -.8); }
      for (const [x, z] of [[-.9, 2], [.9, 2], [-.9, -2.2], [.9, -2.2]]){ const p = new THREE.Group(); p.position.set(x, -.3, z); g.add(p); limb(p, m, 0, 0, 0, 0, -6.5, 0, .3); add(p, cone, dark, 0, -6.6, 0, .35, .4, .35); legs.push(p); }
      add(g, cone, m, 0, .5, -3.3, .4, 1, .4, -2.4);
      g.userData = { legs, h: 6.8, speed: 1.6, scale: .46 }; return g; },
    owl(){ const g = new THREE.Group(), m = haze('#8d8fb8', .92), wing = haze('#b9a3c8', .9, .2), face = haze('#c8c6dc', .95, .2);
      add(g, sph, m, 0, 3.2, 0, 2.6, 3.6, 2.4); const head = new THREE.Group(); head.position.set(0, 7.2, 0); g.add(head);
      add(head, sph, m, 0, 0, 0, 2.3, 2, 2.2); add(head, sph, face, 0, 0, 1.25, 1.9, 1.6, .7);
      for (const s of [-1, 1]){ add(head, sph, glow('#fff3b0', 4), s * .75, .15, 1.85, .32, .32, .2); add(head, cone, m, s * 1.4, 1.7, 0, .5, .9, .4, 0, 0, s * -.3); }
      add(head, cone, haze('#6d6a8a', .95), 0, -.4, 2.1, .22, .5, .22, Math.PI / 2 + .4);
      for (const s of [-1, 1]) add(g, sph, wing, s * 2.2, 2.6, -.2, .9, 3.2, 2.2, .1, 0, s * .12);
      for (let n = 0; n < 5; n++) add(g, cone, wing, (n - 2) * .5, -.4, -1.4, .35, 1.6, .2, Math.PI);
      g.userData = { head, h: 0, scale: .42 }; return g; },
    whale(){ const g = new THREE.Group(), m = haze('#c9a49a', .86, .18), belly = haze('#e8c9b8', .86, .2), fin = haze('#b8a0a8', .8, .18);
      const body = new THREE.Group(); g.add(body);
      add(body, sph, m, 0, 0, 0, 3.6, 3.1, 12); add(body, sph, belly, 0, -1.1, 1.5, 3, 2.2, 9.5);
      for (let n = 0; n < 7; n++) add(body, cyl, haze('#d8b8a8', .8), 0, -2.6, -2 + n * 1.3, .05, .1, 2.2, 0, 0, Math.PI / 2);
      const fl = [], tail = new THREE.Group(); tail.position.set(0, .3, -11.5); body.add(tail);
      add(tail, sph, m, 0, 0, -2.5, 1.6, 1.2, 4); add(tail, sph, fin, -2.6, 0, -6, 3.2, .3, 1.4, 0, .5); add(tail, sph, fin, 2.6, 0, -6, 3.2, .3, 1.4, 0, -.5);
      for (const s of [-1, 1]){ const f = new THREE.Group(); f.position.set(s * 3, -1, 4); body.add(f); add(f, sph, fin, s * 4.5, 0, -1, 5.5, .35, 1.6, 0, s * .3); fl.push(f); }
      add(body, sph, glow('#3a2a2a', .2), 2.6, .2, 7.5, .3, .3, .3); add(body, sph, glow('#3a2a2a', .2), -2.6, .2, 7.5, .3, .3, .3);
      g.userData = { body, tail, fl, scale: .33, fly: true }; return g; },
    moth(){ const g = new THREE.Group(), fur = haze('#c8bfd0', .95, .15), wing = haze('#b8aac8', .82, .18), spot = haze('#6e4a6a', .9);
      add(g, sph, fur, 0, 4, 0, 2.2, 2.6, 2.2); add(g, sph, haze('#9a8aa8', .95), 0, 0, 0, 1.5, 4.2, 1.5);
      for (let n = 0; n < 4; n++) add(g, cyl, haze('#7a6a88', .95), 0, -1 - n * 1.1, 0, 1.55 - n * .2, .25, 1.55 - n * .2);
      add(g, sph, glow('#2a1520', .3), .9, 5, 1.5, .4, .4, .3); add(g, sph, glow('#2a1520', .3), -.9, 5, 1.5, .4, .4, .3);
      for (const s of [-1, 1]){ limb(g, haze('#c9a88a', .95), s * .5, 6, 1, s * 2, 9.5, 2.4, .12); }
      const wings = [];
      for (const s of [-1, 1]){ const w = new THREE.Group(); w.position.set(s * 1.2, 3.5, -.6); g.add(w);
        const shape = new THREE.Shape(); shape.moveTo(0, 2); shape.quadraticCurveTo(s * 7, 3, s * 6.5, -3); shape.quadraticCurveTo(s * 4, -9, s * 1, -7); shape.lineTo(0, -1); shape.lineTo(0, 2);
        add(w, new THREE.ShapeGeometry(shape), wing).material.side = THREE.DoubleSide;
        for (const [x, y, r] of [[3.6, -3.6, .8], [4.8, -1, .6], [2.4, -5.6, .7], [5.4, -3.2, .5]]){ const c = add(w, new THREE.CircleGeometry(1, 10), spot, s * x, y, .02, r, r, 1); c.material.side = THREE.DoubleSide; }
        wings.push(w); }
      g.userData = { wings, scale: .3 }; return g; },
    jelly(){ const g = new THREE.Group(), bell = new THREE.MeshStandardMaterial({ color: '#e8a0c0', emissive: new THREE.Color('#ff6a7a'), emissiveIntensity: .55, transparent: true, opacity: .62, roughness: .3, side: THREE.DoubleSide });
      bell.userData.op = .62;
      add(g, new THREE.SphereGeometry(6, 18, 10, 0, Math.PI * 2, 0, Math.PI * .55), bell, 0, 0, 0, 1, .8, 1);
      add(g, sph, glow('#ffb07a', 1.1), 0, 1, 0, 2.2, 1.6, 2.2);
      const strands = [], sm = haze('#b06a9a', .6, .5);
      for (let n = 0; n < 12; n++){ const a = n / 12 * 6.28, r = n % 3 ? 4.6 : 2.2, s = new THREE.Group(); s.position.set(Math.cos(a) * r, -1, Math.sin(a) * r); g.add(s);
        let prev = s; const segs = []; for (let k = 0; k < 7; k++){ const q = new THREE.Group(); q.position.y = k ? -3.2 : 0; prev.add(q); add(q, cyl, sm, 0, -1.6, 0, n % 3 ? .12 : .45, 3.2, n % 3 ? .12 : .45); segs.push(q); prev = q; }
        strands.push({ segs, ph: a * 2 }); }
      g.userData = { strands, fly: true, scale: .27 }; return g; },
    elk(){ const g = new THREE.Group(), m = haze('#7d6e94', .93, .08), legs = [];
      for (let n = 0; n < 12; n++) add(g, sph, m, 0, 1.4 + Math.sin(n / 11 * Math.PI) * .6, 3 - n * .62, .28, .34, .32);
      for (let n = 0; n < 9; n++){ const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 - Math.abs(n - 4) * .1, .1, 4, 10, Math.PI), m); r.position.set(0, .2, 2.2 - n * .5); r.rotation.set(0, Math.PI / 2, Math.PI); r.scale.set(1, 1.15, 1); g.add(r); }
      for (let n = 0; n < 8; n++) limb(g, m, 0, 1.6, 3.2 + n * .3, 0, 1.6 + (n + 1) * .35, 3.4 + (n + 1) * .3, .16);
      const skull = new THREE.Group(); skull.position.set(0, 4.6, 6); g.add(skull);
      add(skull, sph, m, 0, 0, .6, .55, .55, 1.5, .5); add(skull, sph, glow('#ffd0a0', 1.2), .3, .25, .3, .1, .1, .1); add(skull, sph, glow('#ffd0a0', 1.2), -.3, .25, .3, .1, .1, .1);
      for (const s of [-1, 1]){ limb(skull, m, s * .3, .4, 0, s * 1.6, 3.4, -.8, .1); limb(skull, m, s * 1.6, 3.4, -.8, s * 1.1, 5.4, -.4, .08); limb(skull, m, s * .9, 1.8, -.3, s * 2, 2.6, .5, .07); }
      add(g, sph, m, 0, .8, -3.2, 1.2, .6, .8);
      for (const [x, z] of [[-.9, 2.2], [.9, 2.2], [-.9, -3.2], [.9, -3.2]]){ const p = new THREE.Group(); p.position.set(x, .6, z); g.add(p); limb(p, m, 0, 0, 0, 0, -3.2, z < 0 ? -.6 : .3, .2); limb(p, m, 0, -3.2, z < 0 ? -.6 : .3, 0, -7.2, 0, .14); legs.push(p); }
      g.userData = { legs, h: 7.2, speed: 1.2, scale: .46, birds: true }; return g; },
    wyrm(){ const g = new THREE.Group(), m = haze('#6d6658', .9, .06), fin = haze('#8a8070', .85), segs = [];
      for (let n = 0; n < 16; n++){ const s = new THREE.Group(); g.add(s); const r = n < 2 ? 1.5 : 1.8 - n * .09;
        add(s, sph, m, 0, 0, 0, r, r * .8, 2.4); if (n > 1) add(s, cone, fin, 0, r * 1.1, 0, .35, 1.6 - n * .05, .9, -.3);
        segs.push(s); }
      const head = segs[0]; add(head, cone, m, 0, -.2, 2.2, .9, 2.4, .9, Math.PI / 2); add(head, sph, glow('#ff4a3a', 4), .9, .4, 1.2, .22, .18, .22); add(head, cone, fin, 0, 1.8, -.2, .3, 1.8, .6, -.6);
      g.userData = { segs, scale: .32, fly: true, low: true }; return g; },
  };

  /* ---------- where they go ---------- */
  // a point on the far side of the valley, seen past it from the usual camera, at distance d beyond the edge
  // the usual camera looks toward -x,-z: 'side' runs along the screen (right = +1), 'depth' into it
  const RT = { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, FW = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
  const at = (side, depth) => ({ x: RT.x * side + FW.x * depth, z: RT.z * side + FW.z * depth });
  // beside the valley on the far left (west) or far right (north), where a giant frames the view instead of hiding it
  // a stroll across the screen (so you see them side-on), through the forest around the valley, never over the village
  function stroll(needForest){
    for (let n = 0; n < 300; n++){
      const side = R(-34, 34), d0 = R(-6, 30), len = R(10, 18) * (Math.random() < .5 ? 1 : -1), a = at(side, d0), b = at(side + len, d0 + R(-3, 3));
      if (Math.max(Math.abs(a.x), Math.abs(b.x)) > HX + 10 || Math.max(Math.abs(a.z), Math.abs(b.z)) > HZ + 10) continue;
      let ok = true; for (let k = 0; k <= 6 && ok; k++){ const x = L(a.x, b.x, k / 6), z = L(a.z, b.z, k / 6); if (needForest && !forest(x, z)) ok = false; const h = heightAt(x, z); if (h > 14 || h < .02) ok = false; }
      if (ok) return [a, b];
    }
    const a = at(-30, 20); return [a, at(-16, 20)];
  }
  function route(kind){
    if (kind === 'owl' || (kind === 'moth' && !ctxT.tower)){ // perched: the highest ground on the valley's rim
      let best = null;
      for (let n = 0; n < 120; n++){ const p = { x: R(-HX - 14, HX + 14), z: R(-HZ - 16, HZ + 10) }; if (Math.abs(p.x) < HX && Math.abs(p.z) < HZ) continue; const h = heightAt(p.x, p.z); if (h > 16) continue; if (!best || h > best.h) best = { ...p, h }; } return [best, best]; }
    if (kind === 'moth'){ const t = ctxT.tower; return [{ x: t.x + .9, z: t.z - .3 }, { x: t.x + .9, z: t.z - .3 }]; }
    return stroll(kind !== 'whale' && kind !== 'jelly');
  }
  let ctxT = {};

  function spawn(kind, opts = {}){
    ctxT = opts; const g = BUILD[kind](), u = g.userData; const [p0, p1] = route(kind);
    const sc = u.scale * (kind === 'moth' && opts.tower ? .75 : 1); g.scale.setScalar(sc);
    const gi = { kind, g, u, p0, p1, tower: kind === 'moth' ? opts.tower : null, t: 0, life: kind === 'owl' || kind === 'moth' ? R(150, 220) : R(170, 240), fade: 0, alive: true, gifted: false, birds: [] };
    if (u.birds && bird) for (let n = 0; n < 14; n++){ const b = bird(); b.scale.setScalar(.7); scene.add(b); gi.birds.push({ b, a: R(0, 6.28), r: R(1.5, 3.5), y: R(4, 9), w: R(.3, .7) }); }
    g.traverse(o => { if (o.isMesh){ o.material = o.material.clone(); o.material.transparent = true; o.material.userData.op = o.material.userData.op ?? 1; o.material.opacity = 0; } });
    scene.add(g); all.push(gi); place(gi, 0); return gi;
  }
  function setOpacity(gi, f){ gi.g.traverse(o => { if (o.isMesh) o.material.opacity = o.material.userData.op * f; }); }
  function place(gi, time){
    const { u, g } = gi, k = Math.min(1, gi.t / gi.life), x = L(gi.p0.x, gi.p1.x, k), z = L(gi.p0.z, gi.p1.z, k), hd = Math.atan2(gi.p1.x - gi.p0.x, gi.p1.z - gi.p0.z);
    const ground = Math.max(heightAt(x, z), .5);
    if (gi.kind === 'owl'){ g.position.set(gi.p0.x, gi.p0.h - .5, gi.p0.z); g.rotation.y = Math.atan2(-gi.p0.x, -gi.p0.z); u.head.rotation.y = Math.sin(time * .15) * .9; u.head.rotation.z = Math.sin(time * .11) * .12; }
    else if (gi.kind === 'moth'){ const tw = gi.tower; g.position.set(gi.p0.x, (tw ? tw.y + .9 : gi.p0.h + 1.6), gi.p0.z); g.rotation.y = tw ? -Math.PI / 2 : Math.atan2(-gi.p0.x, -gi.p0.z);
      const f = .5 + .5 * Math.sin(time * .5); u.wings.forEach((w, n) => { w.rotation.y = (n ? -1 : 1) * (.25 + f * .9); }); }
    else if (u.fly){ const y = u.low ? ground + 1.9 + Math.sin(time * .4) * .35 : Math.max(ground + 7, 12) + Math.sin(time * .2) * .8;
      g.position.set(x, y, z); g.rotation.y = hd + Math.sin(time * .3) * .1;
      if (u.body){ u.body.rotation.z = Math.sin(time * .25) * .08; u.tail.rotation.x = Math.sin(time * .7) * .25; u.fl.forEach((f, n) => f.rotation.z = (n ? -1 : 1) * Math.sin(time * .5) * .2); }
      if (u.strands) u.strands.forEach(s => s.segs.forEach((q, k) => { q.rotation.x = Math.sin(time * .8 + s.ph + k * .6) * .18; q.rotation.z = Math.cos(time * .6 + s.ph + k * .5) * .12; }));
      if (u.segs){ u.segs.forEach((s, n) => { const back = n * 3.2; s.position.set(Math.sin(time * 1.1 - n * .5) * 2.2, Math.sin(time * .5 - n * .3) * .8, -back); }); } }
    else { // walkers: stride along the ridge, legs swinging, body rising and falling
      g.position.set(x, ground + (u.h - .25) * u.scale + Math.abs(Math.sin(time * u.speed)) * .1 * u.scale, z); g.rotation.y = hd;
      u.legs.forEach((p, n) => { p.rotation.x = Math.sin(time * u.speed + (n % 2 ? Math.PI : 0) + (n > 1 ? Math.PI / 2 : 0)) * .32; }); }
    for (const b of gi.birds){ b.a += .006 * b.w * 60 / 60; b.b.position.set(g.position.x + Math.cos(b.a + time * b.w) * b.r, g.position.y + b.y * .4, g.position.z + Math.sin(b.a + time * b.w) * b.r);
      b.b.rotation.y = -(b.a + time * b.w); const fl = Math.sin(time * 9 + b.r) * .5; b.b.userData.l.rotation.z = fl; b.b.userData.r.rotation.z = -fl; }
  }
  function remove(gi){ scene.remove(gi.g); gi.birds.forEach(b => scene.remove(b.b)); all.splice(all.indexOf(gi), 1); }

  function update(dt, time){
    for (const gi of all.slice()){
      gi.t += dt; const leaving = gi.t > gi.life || !gi.alive;
      gi.fade = Math.max(0, Math.min(1, gi.fade + (leaving ? -dt / 6 : dt / 8)));
      if (leaving && gi.fade <= 0){ remove(gi); continue; }
      setOpacity(gi, gi.fade); place(gi, time);
    }
  }
  // which giant (if any) is under a ray
  const ray = new THREE.Raycaster();
  function pick(raycaster){ let best = null, bd = 1e9;
    for (const gi of all){ if (gi.fade < .3 || gi.gifted) continue; const h = raycaster.intersectObject(gi.g, true)[0]; if (h && h.distance < bd){ bd = h.distance; best = gi; } }
    return best; }
  return { spawn, update, pick, get list(){ return all; }, depart(gi){ gi.alive = false; }, drop: remove };
}
