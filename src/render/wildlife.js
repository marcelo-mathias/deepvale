// The small life of the valley: herons and ducks on the backwaters, dragonflies over them on warm days,
// and deer grazing at the forest's edge. How many there are follows the valley's health.
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
export function makeWildlife({ scene, rimMat, heightAt, WATER_Y }){
  const M = {}, mat = (c, rim = '#ffd9a8', s = .7) => (M[c] ||= rimMat({ color: c }, rim, s));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), put = (g, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  const shadow = g => { g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; };

  const MAKE = {
    heron(){ const g = new THREE.Group();
      put(g, box(.05, .06, .13), mat('#9aa4ac'), 0, .16, 0, -.3); const neck = new THREE.Group(); neck.position.set(0, .19, .05); g.add(neck);
      put(neck, box(.018, .12, .018), mat('#b8c0c6'), 0, .06, .01, .25); put(neck, box(.03, .03, .05), mat('#c8ced2'), 0, .13, .04); put(neck, box(.008, .008, .07), mat('#e0b040'), 0, .13, .09);
      for (const x of [-.015, .015]) put(g, box(.006, .14, .006), mat('#5a5040'), x, .07, 0);
      g.userData.neck = neck; return shadow(g); },
    duck(){ const g = new THREE.Group(); const c = Math.random() < .5;
      put(g, box(.06, .035, .09), mat(c ? '#7a5a3a' : '#8a7a68'), 0, .02, 0); put(g, box(.035, .035, .035), mat(c ? '#2f6a4a' : '#7a6a58'), 0, .05, .045); put(g, box(.016, .008, .025), mat('#e0a040'), 0, .045, .07);
      return shadow(g); },
    deer(){ const g = new THREE.Group(), m = mat('#9a6a42'), legs = [];
      put(g, box(.07, .07, .17), m, 0, .15, 0); put(g, box(.035, .08, .035), m, 0, .21, .08, -.4); const head = new THREE.Group(); head.position.set(0, .25, .11); g.add(head);
      put(head, box(.035, .035, .065), m, 0, 0, .02); for (const s of [-1, 1]){ put(head, box(.006, .05, .006), mat('#5a4030'), s * .015, .04, 0, 0, 0, s * .3); }
      put(g, box(.02, .02, .03), mat('#e8dcc8'), 0, .17, -.09);
      for (const [x, z] of [[-.025, .06], [.025, .06], [-.025, -.06], [.025, -.06]]){ const l = new THREE.Group(); l.position.set(x, .12, z); g.add(l); put(l, box(.012, .12, .012), mat('#7a5232'), 0, -.06, 0); legs.push(l); }
      g.userData = { head, legs }; return shadow(g); },
    fly(){ const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#7ad8ff' });
      put(g, box(.008, .008, .05), m, 0, 0, 0); const w = new THREE.MeshBasicMaterial({ color: '#e0f4ff', transparent: true, opacity: .6, side: THREE.DoubleSide });
      const wl = put(g, new THREE.PlaneGeometry(.05, .012), w, .025, 0, .01, -Math.PI / 2), wr = put(g, new THREE.PlaneGeometry(.05, .012), w, -.025, 0, .01, -Math.PI / 2);
      g.userData = { wl, wr }; return g; },
  };
  const live = [];
  function spawn(kind, x, z, home){ const g = MAKE[kind](); if (kind === 'deer' || kind === 'heron') g.scale.setScalar(1.5); scene.add(g); const a = { kind, g, x, z, hx: x, hz: z, home, h: R(0, 6.28), t: R(0, 10), st: 'idle', tx: x, tz: z, wait: R(1, 5) }; live.push(a); return a; }
  function clear(){ for (const a of live) scene.remove(a.g); live.length = 0; }

  // want: {heron, duck, fly, deer} counts; spots: functions returning a random place for each kind
  function sync(want, spots){
    for (const kind of Object.keys(want)){
      const have = live.filter(a => a.kind === kind);
      for (let n = have.length; n < want[kind]; n++){ const p = spots[kind](); if (p) spawn(kind, p.x, p.z, p); }
      for (let n = want[kind]; n < have.length; n++){ scene.remove(have[n].g); live.splice(live.indexOf(have[n]), 1); }
    }
  }
  function update(dt, t, env){
    for (const a of live){
      a.t += dt; const g = a.g;
      if (a.kind === 'fly'){ // dart, hover, dart
        a.wait -= dt; if (a.wait < 0){ a.wait = R(.4, 1.6); a.tx = a.hx + R(-1.4, 1.4); a.tz = a.hz + R(-1.4, 1.4); }
        a.x += (a.tx - a.x) * Math.min(1, dt * 3); a.z += (a.tz - a.z) * Math.min(1, dt * 3);
        g.position.set(a.x, WATER_Y + .25 + Math.sin(a.t * 3) * .05, a.z); g.rotation.y = Math.atan2(a.tx - a.x, a.tz - a.z);
        const f = Math.sin(a.t * 60) * .5; g.userData.wl.rotation.y = f; g.userData.wr.rotation.y = -f; g.visible = env.flies; continue; }
      if (a.kind === 'duck'){ a.h += Math.sin(a.t * .3) * dt * .5; const nx = a.x + Math.sin(a.h) * dt * .12, nz = a.z + Math.cos(a.h) * dt * .12;
        if (env.stillAt(nx, nz) && Math.hypot(nx - a.hx, nz - a.hz) < 2){ a.x = nx; a.z = nz; } else a.h += Math.PI * .7;
        g.position.set(a.x, WATER_Y + .01 + Math.sin(a.t * 2) * .004, a.z); g.rotation.y = a.h; g.visible = !env.frozen; continue; }
      if (a.kind === 'heron'){ // stands very still, then strikes
        a.wait -= dt; const n = g.userData.neck;
        if (a.wait < 0){ a.wait = R(4, 12); a.strike = .5; }
        if (a.strike > 0){ a.strike -= dt; n.rotation.x = Math.sin((.5 - a.strike) / .5 * Math.PI) * 1.1; } else n.rotation.x = Math.sin(a.t * .4) * .05;
        g.position.set(a.x, Math.max(heightAt(a.x, a.z), WATER_Y - .06), a.z); g.rotation.y = a.h; g.visible = !env.night; continue; }
      if (a.kind === 'deer'){ // graze, look up, wander a few steps; bolt from workers
        const near = env.busyNear(a.x, a.z);
        if (near && a.st !== 'flee'){ a.st = 'flee'; const p = env.spot(); if (p){ a.tx = p.x; a.tz = p.z; } }
        if (a.st === 'idle'){ a.wait -= dt; if (a.wait < 0){ a.st = 'walk'; const r = R(.4, 1.4), an = R(0, 6.28); a.tx = a.hx + Math.cos(an) * r; a.tz = a.hz + Math.sin(an) * r; } }
        if (a.st === 'walk' || a.st === 'flee'){ const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), sp = a.st === 'flee' ? 1.8 : .25;
          if (d < .05){ if (a.st === 'flee'){ a.hx = a.x; a.hz = a.z; } a.st = 'idle'; a.wait = R(3, 9); }
          else { a.x += dx / d * dt * sp; a.z += dz / d * dt * sp; a.h = Math.atan2(dx, dz); } }
        const moving = a.st !== 'idle', u = g.userData;
        u.legs.forEach((l, n) => l.rotation.x = moving ? Math.sin(a.t * (a.st === 'flee' ? 18 : 8) + (n % 2 ? Math.PI : 0)) * .5 : 0);
        u.head.rotation.x = moving ? 0 : (Math.sin(a.t * .25) > .3 ? .9 : 0);
        g.position.set(a.x, heightAt(a.x, a.z) + (a.st === 'flee' ? Math.abs(Math.sin(a.t * 9)) * .04 : 0), a.z); g.rotation.y = a.h; g.visible = !env.night; }
    }
  }
  return { sync, update, clear, get list(){ return live; } };
}
