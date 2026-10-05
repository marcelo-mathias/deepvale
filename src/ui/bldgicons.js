// Building icons for the toolbar and the Build drawer, in two sets you can switch between in Settings:
//  · models   each building's own low-poly model, rendered once from the game's isometric camera into a small
//             image and pixel-dithered (ordered 4×4 Bayer), so the icon is exactly what you'll build
//  · painted  art made in Figma Weave (or anywhere), dropped into public/icons/buildings/ as <key>.png with a
//             transparent background and listed in manifest.json there. It's dithered at load by the same code,
//             so any size of source art works. Keys without art (or before the art has loaded) use the model icon.
// Icons are made lazily (the first time something asks for one) and cached as data URLs.
import * as THREE from 'three';
import { DEFS, STYLES, PAVES } from '../data/builds.js';
import { makeHouses } from '../render/houses.js';

const PX = 36;          // icon size in pixels (drawn at 1:1 or 2:1, image-rendering: pixelated)
const SS = 4;           // supersampling before the downscale
const LEVELS = 7;       // shades per channel after dithering
const AMP = .7;         // how strongly the pattern pushes between shades
const LIFT = .85;       // gamma lift, so the small art reads on dark panels
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);
const OUTLINE = [20, 15, 11];

const BASE_URL = import.meta.env?.BASE_URL ?? './';
const paintedURL = key => `${BASE_URL}icons/buildings/${key.replace(/[^a-z0-9_-]/gi, '_')}.png`;

// shared dither: downscale an RGBA buffer, posterise with an ordered pattern, dither the alpha edge, outline it
export function ditherPixels(src, sw, sh, out = PX){
  const s = sw / out, px = new Float32Array(out * out * 4);
  for (let y = 0; y < out; y++) for (let x = 0; x < out; x++){ let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let v = 0; v < s; v++) for (let u = 0; u < s; u++){ const k = ((Math.floor(y * s + v)) * sw + Math.floor(x * s + u)) * 4, al = src[k + 3] / 255;
      r += src[k] * al; g += src[k + 1] * al; b += src[k + 2] * al; a += al; n++; }
    const o = (y * out + x) * 4; px[o] = a ? r / a : 0; px[o + 1] = a ? g / a : 0; px[o + 2] = a ? b / a : 0; px[o + 3] = a / n; }
  const img = new ImageData(out, out), d = img.data, solid = new Uint8Array(out * out);
  for (let y = 0; y < out; y++) for (let x = 0; x < out; x++){ const o = (y * out + x) * 4, t = BAYER[(y % 4) * 4 + (x % 4)];
    if (px[o + 3] < .5 + t * .9) continue; solid[y * out + x] = 1;
    for (let c = 0; c < 3; c++){ const v = Math.pow(px[o + c] / 255, LIFT) * (LEVELS - 1) + t * AMP; d[o + c] = Math.round(Math.min(LEVELS - 1, Math.max(0, Math.round(v))) / (LEVELS - 1) * 255); }
    d[o + 3] = 255; }
  // a 1-px dark outline around the silhouette keeps it readable on any panel
  for (let y = 0; y < out; y++) for (let x = 0; x < out; x++){ if (solid[y * out + x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = x + a, Y = y + b; return X >= 0 && Y >= 0 && X < out && Y < out && solid[Y * out + X]; });
    if (near){ const o = (y * out + x) * 4; d[o] = OUTLINE[0]; d[o + 1] = OUTLINE[1]; d[o + 2] = OUTLINE[2]; d[o + 3] = 235; } }
  const cv = document.createElement('canvas'); cv.width = cv.height = out; cv.getContext('2d').putImageData(img, 0, 0); return cv;
}

export function makeBuildingIcons({ renderer, props, rimMat, camDir, sunDir, onPainted }){
  const cache = {}, painted = {}, houses = makeHouses({ rimMat });
  // which keys have painted art: read once from the manifest (missing manifest → none)
  let paintedKeys = new Set(), asked = false;
  const loadManifest = () => { if (asked) return; asked = true;
    fetch(`${BASE_URL}icons/buildings/manifest.json`).then(r => r.ok ? r.json() : []).then(k => { paintedKeys = new Set(k); if (paintedKeys.size) onPainted?.(); }).catch(() => {}); };
  // load one painted image and dither it like the model icons; calls onPainted when it's ready to swap in
  const loadPainted = key => { if (key in painted) return; painted[key] = null;
    const im = new Image(); im.onload = () => { const n = PX * SS, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
      const k = Math.min(n / im.width, n / im.height) * .94, w = im.width * k, h = im.height * k; g.drawImage(im, (n - w) / 2, (n - h) / 2, w, h);
      painted[key] = ditherPixels(g.getImageData(0, 0, n, n).data, n, n).toDataURL(); onPainted?.(); };
    im.src = paintedURL(key); };
  let scene, cam; const rts = {};
  const setup = () => {
    scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(new THREE.Color('#ffe2c0'), 4.4); sun.position.copy(sunDir).multiplyScalar(10); scene.add(sun);
    scene.add(new THREE.HemisphereLight(new THREE.Color('#bcd6e0'), new THREE.Color('#5a4a34'), 2.1));
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
  };
  const target = n => rts[n] ||= (() => { const rt = new THREE.WebGLRenderTarget(n, n, { samples: 0 }); rt.texture.colorSpace = THREE.SRGBColorSpace; return { rt, buf: new Uint8Array(n * n * 4) }; })();
  const box = (w, h, d, col, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rimMat({ color: col }, '#ffd9a8', .6)); m.position.set(x, y, z); return m; };
  // things without a builder of their own
  const extra = {
    hut: () => houses.body('thatch', 7).group,
    road: () => { const g = new THREE.Group(); g.add(box(1, .04, 1, '#5d7a3c', 0, -.02, 0)); g.add(box(.42, .045, 1, '#b8a47a', 0, 0, 0));
      for (let n = 0; n < 7; n++) g.add(box(.05, .02, .05, '#8e8a82', (n % 3 - 1) * .12, .03, -.4 + n * .13)); return g; },
    bridge: () => { const g = new THREE.Group(); g.add(box(1, .04, .7, '#3f7f8f', 0, -.06, 0)); g.add(box(.36, .045, 1.02, '#8a6440', 0, .06, 0));
      for (const x of [-.17, .17]){ g.add(box(.02, .02, 1.02, '#5a4028', x, .16, 0)); for (const z of [-.45, 0, .45]) g.add(box(.025, .12, .025, '#5a4028', x, .11, z)); } return g; },
    build: () => props.B.workshop(3),
  };
  const groupFor = key => {
    const [id, sub] = key.split(':');
    if (id === 'style') return houses.body(sub, 7).group;
    if (id === 'pave'){ const g = new THREE.Group(); g.add(box(1, .04, 1, '#5d7a3c', 0, -.02, 0)); g.add(box(.46, .05, 1, PAVES[sub]?.col || '#aca694')); return g; }
    if (id === 'statue') return props.B.statue(5, { sp: sub || 'koi' });
    if (id === 'clantern') return props.B.lantern(5);
    if (id === 'clamp') return props.lamp();
    // edges turn a corner (two runs meeting at a post), so the icon reads as a boundary and not a stick
    if (['efence', 'ehedge', 'ewall'].includes(id)){ const g = new THREE.Group();
      const a = props.edge(id.slice(1)); a.position.set(0, 0, -.5); g.add(a); const b = props.edge(id.slice(1)); b.position.set(-.5, 0, 0); b.rotation.y = Math.PI / 2; g.add(b); return g; }
    if (extra[id]) return extra[id]();
    if (props.B[id] && DEFS[id]) return props.B[id](5);
    return null;
  };
  // fit the group in the isometric view, render, read back, dither. raw: the plain render at `n` px (reference art)
  function render(key, raw = false, n = PX * SS){
    const g = groupFor(key); if (!g) return null; if (!scene) setup();
    scene.add(g); g.updateMatrixWorld(true);
    // frame the real silhouette: project every vertex into the view and fit a square around it
    const bb = new THREE.Box3().setFromObject(g, true), c = bb.getCenter(new THREE.Vector3());
    cam.position.copy(c).addScaledVector(camDir, 20); cam.up.set(0, 1, 0); cam.lookAt(c); cam.updateMatrixWorld();
    const inv = cam.matrixWorldInverse, v = new THREE.Vector3(); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    g.traverse(o => { if (!o.isMesh || !o.visible) return; const pos = o.geometry.attributes.position;
      for (let q = 0; q < pos.count; q++){ v.fromBufferAttribute(pos, q).applyMatrix4(o.matrixWorld).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } });
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, ex = Math.max(x1 - x0, y1 - y0) / 2 * 1.1;
    cam.position.addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), mx).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), my); cam.updateMatrixWorld(); Object.assign(cam, { left: -ex, right: ex, top: ex, bottom: -ex }); cam.updateProjectionMatrix();
    const prevRT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevShadow = renderer.shadowMap.autoUpdate;
    const { rt, buf } = target(n);
    renderer.shadowMap.autoUpdate = false; renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, n, n, buf);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA); renderer.shadowMap.autoUpdate = prevShadow; scene.remove(g);
    // WebGL reads bottom-up
    const flip = new Uint8ClampedArray(buf.length); for (let y = 0; y < n; y++) flip.set(buf.subarray((n - 1 - y) * n * 4, (n - y) * n * 4), y * n * 4);
    if (raw){ const cv = document.createElement('canvas'); cv.width = cv.height = n; cv.getContext('2d').putImageData(new ImageData(flip, n, n), 0, 0); return cv; }
    return ditherPixels(flip, n, n).toDataURL();
  }
  const model = key => (key in cache ? cache[key] : (cache[key] = render(key)));
  // <img> for a key, from the chosen set; '' when there is nothing to draw
  function html(key, set = 'models', cls = 'bicon'){
    let src = null;
    if (set === 'painted'){ loadManifest(); if (paintedKeys.has(key)){ loadPainted(key); src = painted[key]; } }
    src ||= model(key); return src ? `<img class="${cls}" src="${src}" alt="" draggable="false">` : '';
  }
  return { html, model, render };
}
