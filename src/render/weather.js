// Weather you can see: rain streaks, snowflakes, spring petals and autumn leaves, falling in a box that
// follows the camera's target. One particle pool, restyled for whatever is falling.
import * as THREE from 'three';

const N = 2600;
export function makeWeather(scene){
  // rain is drawn as short streaks (line segments); the rest as soft square points
  const rainPos = new Float32Array(N * 6), rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#cfe2ee', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
  const ptPos = new Float32Array(N * 3), ptCol = new Float32Array(N * 3), ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3)); ptGeo.setAttribute('color', new THREE.BufferAttribute(ptCol, 3));
  const ptMat = new THREE.PointsMaterial({ size: .09, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(ptGeo, ptMat); pts.frustumCulled = false; scene.add(pts);
  const P = Array.from({ length: N }, () => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, ph: Math.random() * 6.28, c: 0 }));
  let kind = 'none', amt = 0, want = 0, W = 30, H = 22;
  const COLS = { petals: ['#f7c6d6', '#f2a8c0', '#fff0f4'], leaves: ['#e0883a', '#c8572e', '#e8b84a', '#a8642a'], snow: ['#ffffff', '#eef4ff'] };
  const tmp = new THREE.Color();

  function reset(p, cx, cz, any){
    p.x = cx + (Math.random() - .5) * W * 2; p.z = cz + (Math.random() - .5) * W * 2; p.y = any ? Math.random() * H : H * (.8 + Math.random() * .3);
    if (kind === 'rain' || kind === 'storm'){ p.vy = -(16 + Math.random() * 6); p.vx = kind === 'storm' ? -5 : -1.5; p.vz = kind === 'storm' ? 2 : .5; }
    else if (kind === 'snow'){ p.vy = -(.7 + Math.random() * .5); p.vx = .2; p.vz = .1; }
    else { p.vy = -(.9 + Math.random() * .6); p.vx = 1.1 + Math.random(); p.vz = .3; }
    const cs = COLS[kind] || COLS.snow; tmp.set(cs[Math.floor(Math.random() * cs.length)]); p.c = [tmp.r, tmp.g, tmp.b];
  }
  // count: how many of the pool are used for each kind at full strength
  const COUNT = { rain: 700, storm: 1100, snow: 800, petals: 160, leaves: 200, none: 0 };
  return {
    set(k, strength = 1){ if (k !== kind){ kind = k; for (const p of P) p.y = -99; } want = strength; },
    get kind(){ return kind; },
    // view: the camera's target and zoom, so the box covers what you see
    update(dt, t, view, groundAt){
      amt += (want - amt) * Math.min(1, dt * .5);
      W = Math.min(70, Math.max(14, view.z * .45)); H = Math.min(40, Math.max(10, view.z * .3));
      const n = Math.floor((COUNT[kind] || 0) * amt), cx = view.t.x, cz = view.t.z, isRain = kind === 'rain' || kind === 'storm';
      for (let i = 0; i < N; i++){
        const p = P[i];
        if (i >= n){ if (isRain){ rainPos[i * 6 + 1] = rainPos[i * 6 + 4] = -99; } else ptPos[i * 3 + 1] = -99; continue; }
        if (p.y < groundAt(p.x, p.z) || Math.abs(p.x - cx) > W * 1.2 || Math.abs(p.z - cz) > W * 1.2 || p.y < -50) reset(p, cx, cz, p.y < -50);
        if (kind === 'snow' || kind === 'petals' || kind === 'leaves'){ p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * .6) * dt; p.z += (p.vz + Math.cos(t * 1.1 + p.ph) * .4) * dt; p.y += p.vy * dt * (kind === 'leaves' ? .8 + .4 * Math.sin(t * 3 + p.ph) : 1); }
        else { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
        if (isRain){ const o = i * 6; rainPos[o] = p.x; rainPos[o + 1] = p.y; rainPos[o + 2] = p.z; rainPos[o + 3] = p.x - p.vx * .035; rainPos[o + 4] = p.y - p.vy * .035; rainPos[o + 5] = p.z - p.vz * .035; }
        else { const o = i * 3; ptPos[o] = p.x; ptPos[o + 1] = p.y; ptPos[o + 2] = p.z; ptCol[o] = p.c[0]; ptCol[o + 1] = p.c[1]; ptCol[o + 2] = p.c[2]; }
      }
      rain.visible = isRain; pts.visible = !isRain && n > 0;
      rainMat.opacity = .08 * amt * (kind === 'storm' ? 1.2 : 1); ptMat.opacity = .7 * amt;
      ptMat.size = kind === 'snow' ? .075 : .11;
      if (isRain) rainGeo.attributes.position.needsUpdate = true; else { ptGeo.attributes.position.needsUpdate = true; ptGeo.attributes.color.needsUpdate = true; }
    },
  };
}
