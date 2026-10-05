// The giants of the forest: spirit animals, a few trees tall, that pass through now and then.
// They are drawn as light rather than flesh: bright at the top, thinning to nothing toward the ground in a
// dithered fade, with a soft glow pooled under them and motes drifting up. Click one and it leaves a gift.
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
const L = (a, b, t) => a + (b - a) * t;

export const GIANTS = {
  stag:  { name: 'The Pale Stag',   when: 'day',  line: 'A stag made of pale light walks between the trees at the forest’s edge. The birds go quiet.' },
  owl:   { name: 'The Lantern Owl', when: 'dusk', line: 'Something settles on the valley’s rim and folds its wings. Two lamps open in the dusk.' },
  whale: { name: 'The River Whale', when: 'day',  line: 'A whale of light is in the river, leaping the bridges as if they were nothing.' },
};

/* ---------- the spirit look ---------- */
// Shared by every part of a giant. uBot/uTop: the world heights the fade runs between (top solid, bottom gone);
// uFade: the whole giant fading in or out; uShade: how bright this part is (antlers and eyes shine more).
const SPIRIT_V = `varying vec3 vW;varying vec3 vN;
  void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
const SPIRIT_F = `uniform float uBot,uTop,uFade,uShade,uTime;varying vec3 vW;varying vec3 vN;
  float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}float bayer(vec2 a){return b2(.5*a)*.25+b2(a);}
  void main(){
    float t=clamp((vW.y-uBot)/max(.01,uTop-uBot),0.,1.);
    // solid near the top, thinning out toward the feet; a slow shimmer runs through it
    float a=(.06+.94*smoothstep(.02,.8,t))*uFade*(.9+.1*sin(uTime*2.+vW.y*3.+vW.x));
    if(bayer(gl_FragCoord.xy)>=a)discard;
    vec3 lo=vec3(.08,.5,.5),hi=vec3(.72,1.,.9);
    vec3 c=mix(lo,hi,smoothstep(.05,.95,t))*uShade;
    float rim=pow(1.-abs(vN.z),2.);c+=vec3(.5,1.,.85)*rim*.55;
    gl_FragColor=vec4(c,1.);}`;
// the pool of light under a giant and the motes around it
const POOL_F = `uniform float uFade;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;float a=pow(max(0.,1.-d),2.)*uFade*.5;gl_FragColor=vec4(vec3(.25,1.,.8)*a,a);}`;
const POOL_V = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

export function makeGiants({ scene, heightAt, bird, HX, HZ, forest = () => true, river = () => [], waterY = -.15 }){
  const all = [];
  const sph = new THREE.IcosahedronGeometry(1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 6), cone = new THREE.ConeGeometry(1, 1, 6);
  // each giant gets its own uniforms; each part a material with its own brightness
  function spiritKit(){
    const U = { uBot: { value: 0 }, uTop: { value: 1 }, uFade: { value: 0 }, uTime: { value: 0 } };
    const mat = (shade = 1) => new THREE.ShaderMaterial({ vertexShader: SPIRIT_V, fragmentShader: SPIRIT_F, uniforms: { ...U, uShade: { value: shade } } });
    return { U, mat };
  }
  const add = (g, geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  const limb = (g, m, x0, y0, z0, x1, y1, z1, r) => { const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), o = new THREE.Mesh(cyl, m);
    o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(r, a.distanceTo(b), r); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(o); return o; };

  /* ---------- the creatures (model units; the scale brings them to a few trees tall) ---------- */
  const BUILD = {
    // slender, head held high, antlers like a crown of branches
    stag(k){ const g = new THREE.Group(), m = k.mat(1), pale = k.mat(1.2), bright = k.mat(1.5), legs = [];
      add(g, sph, m, 0, 0, 0, 1.25, 1.15, 2.9);                                   // body
      add(g, sph, m, 0, .35, 1.9, 1.05, 1.15, 1.2);                                // chest
      limb(g, m, 0, .6, 2.1, 0, 3.7, 3.0, .5);                                     // neck, nearly upright
      add(g, sph, pale, 0, 4.05, 3.35, .55, .62, 1.05, .25);                       // head
      add(g, cone, pale, 0, 3.75, 4.35, .3, .6, .3, Math.PI / 2 + .45);            // muzzle
      for (const s of [-1, 1]){
        add(g, cone, pale, s * .5, 4.55, 3.0, .16, .55, .08, 0, 0, s * -.9);        // ears
        // the beam rises and leans out; tines branch up from it
        const pts = [[s * .25, 4.5, 3.2], [s * 1.0, 6.0, 3.0], [s * 1.6, 7.6, 2.6], [s * 1.9, 9.2, 2.4]];
        for (let n = 0; n < pts.length - 1; n++) limb(g, bright, ...pts[n], ...pts[n + 1], .12 - n * .02);
        limb(g, bright, s * .7, 5.4, 3.1, s * .3, 6.6, 3.9, .07);                   // brow tine, forward
        limb(g, bright, s * 1.0, 6.0, 3.0, s * 2.2, 6.9, 3.2, .07);
        limb(g, bright, s * 1.3, 6.8, 2.8, s * .9, 8.3, 3.2, .07);
        limb(g, bright, s * 1.6, 7.6, 2.6, s * 2.7, 8.6, 2.5, .06);
        limb(g, bright, s * 1.75, 8.4, 2.5, s * 1.3, 9.6, 2.7, .05);
        limb(g, bright, s * 1.9, 9.2, 2.4, s * 2.5, 10.0, 2.2, .05);
      }
      for (const [x, z] of [[-.6, 1.8], [.6, 1.8], [-.6, -2.1], [.6, -2.1]]){ const p = new THREE.Group(); p.position.set(x, -.4, z); g.add(p);
        limb(p, m, 0, 0, 0, 0, -3.1, z > 0 ? .15 : -.25, .24); limb(p, m, 0, -3.1, z > 0 ? .15 : -.25, 0, -6.0, 0, .17); legs.push(p); }
      add(g, cone, pale, 0, .7, -2.95, .28, .7, .28, -2.2);                         // tail
      g.userData = { legs, h: 6.2, speed: 1.4, scale: .5, top: 10, bot: -6.2 }; return g; },
    owl(k){ const g = new THREE.Group(), m = k.mat(.78), pale = k.mat(1.1), eye = k.mat(2.6);
      add(g, sph, m, 0, 3.2, 0, 2.6, 3.6, 2.4); const head = new THREE.Group(); head.position.set(0, 7.2, 0); g.add(head);
      add(head, sph, m, 0, 0, 0, 2.3, 2, 2.2); add(head, sph, pale, 0, 0, 1.25, 1.9, 1.6, .7);
      for (const s of [-1, 1]){ add(head, sph, eye, s * .75, .15, 1.85, .34, .34, .2); add(head, cone, pale, s * 1.4, 1.7, 0, .5, .9, .4, 0, 0, s * -.3); }
      add(head, cone, m, 0, -.4, 2.1, .22, .5, .22, Math.PI / 2 + .4);
      for (const s of [-1, 1]) add(g, sph, pale, s * 2.2, 2.6, -.2, .9, 3.2, 2.2, .1, 0, s * .12);
      for (let n = 0; n < 5; n++) add(g, cone, m, (n - 2) * .5, -.4, -1.4, .35, 1.6, .2, Math.PI);
      g.userData = { head, h: 0, scale: .5, top: 9.4, bot: -.4 }; return g; },
    whale(k){ const g = new THREE.Group(), m = k.mat(1), pale = k.mat(1.25), eye = k.mat(2);
      const body = new THREE.Group(); g.add(body);
      add(body, sph, m, 0, 0, 0, 3.4, 3.0, 11.5); add(body, sph, pale, 0, 1.1, .5, 2.6, 1.6, 9);
      const fl = [], tail = new THREE.Group(); tail.position.set(0, .3, -11); body.add(tail);
      add(tail, sph, m, 0, 0, -2.5, 1.5, 1.2, 4); add(tail, sph, pale, -2.6, 0, -6, 3.2, .3, 1.4, 0, .5); add(tail, sph, pale, 2.6, 0, -6, 3.2, .3, 1.4, 0, -.5);
      for (const s of [-1, 1]){ const f = new THREE.Group(); f.position.set(s * 2.8, -1, 4); body.add(f); add(f, sph, pale, s * 3.6, 0, -1, 4.4, .35, 1.5, 0, s * .3); fl.push(f); }
      add(body, sph, eye, 2.5, .3, 7.2, .3, .3, .3); add(body, sph, eye, -2.5, .3, 7.2, .3, .3, .3);
      g.userData = { body, tail, fl, scale: .19, top: 3.2, bot: -3.2, swim: true }; return g; },
  };

  /* ---------- where they go ---------- */
  // the usual camera looks toward -x,-z: 'side' runs along the screen (right = +1), 'depth' into it
  const RT = { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, FW = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
  const at = (side, depth) => ({ x: RT.x * side + FW.x * depth, z: RT.z * side + FW.z * depth });
  // a stroll across the screen (so you see them side-on), through the forest around the valley, never over the village
  function stroll(){
    for (let n = 0; n < 300; n++){
      const side = R(-34, 34), d0 = R(-6, 30), len = R(10, 18) * (Math.random() < .5 ? 1 : -1), a = at(side, d0), b = at(side + len, d0 + R(-3, 3));
      if (Math.max(Math.abs(a.x), Math.abs(b.x)) > HX + 10 || Math.max(Math.abs(a.z), Math.abs(b.z)) > HZ + 10) continue;
      let ok = true; for (let k = 0; k <= 6 && ok; k++){ const x = L(a.x, b.x, k / 6), z = L(a.z, b.z, k / 6); if (!forest(x, z)) ok = false; const h = heightAt(x, z); if (h > 14 || h < .02) ok = false; }
      if (ok) return [a, b];
    }
    const a = at(-30, 20); return [a, at(-16, 20)];
  }
  function perch(){ // the highest ground on the valley's rim that isn't a peak
    let best = null;
    for (let n = 0; n < 120; n++){ const p = { x: R(-HX - 14, HX + 14), z: R(-HZ - 16, HZ + 10) }; if (Math.abs(p.x) < HX && Math.abs(p.z) < HZ) continue; const h = heightAt(p.x, p.z); if (h > 16) continue; if (!best || h > best.h) best = { ...p, h }; }
    return best;
  }

  /* ---------- light under them ---------- */
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  function pool(){ const m = new THREE.ShaderMaterial({ vertexShader: POOL_V, fragmentShader: POOL_F, uniforms: { uFade: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const o = new THREE.Mesh(poolGeo, m); o.renderOrder = 3; scene.add(o); return o; }
  const MOTES = 36;
  function motes(){ const pos = new Float32Array(MOTES * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: '#9effe0', size: .12, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const o = new THREE.Points(geo, m); o.frustumCulled = false; scene.add(o);
    return { o, m, p: Array.from({ length: MOTES }, () => ({ x: R(-1, 1), y: R(0, 1), z: R(-1, 1), v: R(.2, .6), ph: R(0, 6.28) })) }; }
  // splash ring where the whale breaks the water
  const ringGeo = new THREE.RingGeometry(.6, .8, 24).rotateX(-Math.PI / 2);
  const rings = [];
  function splash(x, z){ const m = new THREE.MeshBasicMaterial({ color: '#b8fff0', transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const o = new THREE.Mesh(ringGeo, m); o.position.set(x, waterY + .02, z); scene.add(o); rings.push({ o, m, t: 0 }); }

  function spawn(kind){
    const kit = spiritKit(), g = BUILD[kind](kit), u = g.userData; g.scale.setScalar(u.scale);
    g.traverse(o => { if (o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
    const gi = { kind, g, u, U: kit.U, t: 0, life: kind === 'owl' ? R(150, 220) : R(170, 240), fade: 0, alive: true, gifted: false, birds: [],
      pool: pool(), motes: motes(), focus: new THREE.Vector3() };
    if (kind === 'owl'){ const p = perch(); gi.p0 = gi.p1 = p; }
    else if (kind === 'whale'){ gi.leap = null; gi.wait = 0; }
    else [gi.p0, gi.p1] = stroll();
    scene.add(g); all.push(gi); place(gi, 0); return gi;
  }

  // the whale: under the river most of the time, then a leap along the river, over a bridge if there is one
  function nextLeap(gi){
    const spots = river(); if (!spots.length) return null;
    const bridges = spots.filter(s => s.bridge), pool = bridges.length && Math.random() < .85 ? bridges : spots;
    const s = pool[Math.floor(Math.random() * pool.length)], dir = Math.random() < .5 ? 1 : -1, len = R(2.6, 3.4);
    return { x: s.x, z: s.z, dx: s.dx * dir, dz: s.dz * dir, len, t: 0, dur: R(2.2, 2.8), peak: s.bridge ? R(2.2, 2.8) : R(1.6, 2.2) };
  }
  function placeWhale(gi, dt, time){
    const { g, u } = gi;
    u.tail.rotation.x = Math.sin(time * 3) * .3; u.fl.forEach((f, n) => f.rotation.z = (n ? -1 : 1) * Math.sin(time * 2) * .25);
    if (!gi.leap){ gi.wait -= dt; g.visible = false; if (gi.wait <= 0 && gi.t < gi.life){ gi.leap = nextLeap(gi); if (!gi.leap){ gi.wait = 2; return; } splash(gi.leap.x - gi.leap.dx * gi.leap.len, gi.leap.z - gi.leap.dz * gi.leap.len); }
      return; }
    const lp = gi.leap; lp.t += dt; const k = Math.min(1, lp.t / lp.dur), s = (k * 2 - 1) * lp.len;
    const y = waterY - 1 + (lp.peak + 1) * (1 - (k * 2 - 1) ** 2);
    g.visible = true; g.position.set(lp.x + lp.dx * s, y, lp.z + lp.dz * s);
    g.rotation.set(0, 0, 0); g.rotation.y = Math.atan2(lp.dx, lp.dz);
    g.rotateX(-Math.atan2((lp.peak + 1) * -4 * (k * 2 - 1), lp.len * 2 / 1)); // nose follows the arc
    gi.focus.set(lp.x, 1, lp.z);
    if (k >= 1){ splash(lp.x + lp.dx * lp.len, lp.z + lp.dz * lp.len); gi.leap = null; gi.wait = R(2.5, 5); }
  }
  function place(gi, time, dt = 0){
    const { u, g } = gi;
    if (gi.kind === 'whale'){ placeWhale(gi, dt, time); }
    else if (gi.kind === 'owl'){ g.position.set(gi.p0.x, gi.p0.h - .2, gi.p0.z); g.rotation.y = Math.atan2(-gi.p0.x, -gi.p0.z); u.head.rotation.y = Math.sin(time * .15) * .9; u.head.rotation.z = Math.sin(time * .11) * .12; gi.focus.copy(g.position); }
    else { // walkers: stride through the trees, legs swinging, body rising and falling
      const k = Math.min(1, gi.t / gi.life), x = L(gi.p0.x, gi.p1.x, k), z = L(gi.p0.z, gi.p1.z, k), hd = Math.atan2(gi.p1.x - gi.p0.x, gi.p1.z - gi.p0.z), ground = Math.max(heightAt(x, z), .05);
      g.position.set(x, ground + (u.h + .4) * u.scale + Math.abs(Math.sin(time * u.speed)) * .08 * u.scale, z); g.rotation.y = hd;
      u.legs.forEach((p, n) => { p.rotation.x = Math.sin(time * u.speed + (n % 2 ? Math.PI : 0) + (n > 1 ? Math.PI / 2 : 0)) * .3; });
      gi.focus.copy(g.position); }
    // the fade runs from the top of the model to its feet, in world height
    const sc = u.scale, base = g.position.y;
    gi.U.uTop.value = base + u.top * sc; gi.U.uBot.value = gi.kind === 'whale' ? waterY - .2 : base + u.bot * sc; gi.U.uTime.value = time;
    const gy = gi.kind === 'whale' ? waterY : heightAt(g.position.x, g.position.z);
    gi.pool.position.set(gi.kind === 'whale' && gi.leap ? gi.leap.x : g.position.x, gy + .05, gi.kind === 'whale' && gi.leap ? gi.leap.z : g.position.z);
    gi.pool.scale.setScalar(gi.kind === 'whale' ? 5 : gi.kind === 'owl' ? 4 : 5.5); gi.pool.visible = gi.kind !== 'whale' || !!gi.leap;
    // motes drift up through the giant
    const mo = gi.motes, pa = mo.o.geometry.attributes.position, hgt = (u.top - u.bot) * sc;
    mo.p.forEach((p, n) => { p.y += p.v * dt / Math.max(1, hgt) * 2; if (p.y > 1){ p.y = 0; p.x = R(-1, 1); p.z = R(-1, 1); }
      pa.setXYZ(n, g.position.x + p.x * hgt * .35 + Math.sin(time + p.ph) * .15, (gi.kind === 'whale' ? waterY : gy) + p.y * hgt * 1.2, g.position.z + p.z * hgt * .35); });
    pa.needsUpdate = true; mo.o.visible = gi.kind !== 'whale' || !!gi.leap;
  }
  function remove(gi){ scene.remove(gi.g, gi.pool, gi.motes.o); gi.birds.forEach(b => scene.remove(b.b)); all.splice(all.indexOf(gi), 1); }

  function update(dt, time){
    for (const gi of all.slice()){
      gi.t += dt; const leaving = gi.t > gi.life || !gi.alive;
      gi.fade = Math.max(0, Math.min(1, gi.fade + (leaving ? -dt / 5 : dt / 5)));
      if (leaving && gi.fade <= 0 && !(gi.kind === 'whale' && gi.leap)){ remove(gi); continue; }
      gi.U.uFade.value = gi.fade; gi.pool.material.uniforms.uFade.value = gi.fade; gi.motes.m.opacity = gi.fade * .9;
      place(gi, time, dt);
    }
    for (const r of rings.slice()){ r.t += dt; const k = r.t / 1.2; r.o.scale.setScalar(1 + k * 3); r.m.opacity = .8 * (1 - k); if (k >= 1){ scene.remove(r.o); rings.splice(rings.indexOf(r), 1); } }
  }
  // which giant (if any) is under a ray
  function pick(raycaster){ let best = null, bd = 1e9;
    for (const gi of all){ if (gi.fade < .3 || gi.gifted || !gi.g.visible) continue; const h = raycaster.intersectObject(gi.g, true)[0]; if (h && h.distance < bd){ bd = h.distance; best = gi; } }
    return best; }
  return { spawn, update, pick, get list(){ return all; }, depart(gi){ gi.alive = false; }, drop: remove };
}
