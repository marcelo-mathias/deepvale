# Deepvale

An idle fishing game about tiny crews and giant fish. Far below a vast mountain, a valley river keeps creatures longer than villages. Clear the banks, dig the water wider, and hire enough hands to bring something vast to the surface.

![Deepvale river view](docs/screenshot-river.png)

Built for the browser with [three.js](https://threejs.org): low-poly 3D rendered at low resolution for a pixel-art look, with golden-hour lighting, rim light and caustics on the riverbed.

## Run it

```bash
npm install
npm run dev        # local dev server with hot reload
npm run build      # production build in dist/
npm run preview    # serve the production build
```

In dev builds, `window.__dv` exposes game state for debugging (for example `__dv.spawnFish(__dv.SP.warden, __dv.comps()[0])`).

## Publish

- **itch.io:** `npm run package:itch` writes `release/deepvale-itch-v<version>.zip`. Upload it as an HTML project and tick "This file will be played in the browser".
- **GitHub Pages:** every push to `main` builds and deploys through `.github/workflows/deploy.yml`. Enable it once under Settings → Pages → Source: GitHub Actions.

## Project layout

```
index.html            HUD markup and page shell
src/
  main.js             scene, terrain, fish, fishers, economy, input, UI, save/load
  style.css           HUD styling
  core/utils.js       math, noise and localStorage helpers
  world/constants.js  valley grid, tile types, river course
  data/species.js     the eight fish and their unlock gates
  render/shaders.js   GLSL chunks (noise, caustics, rim light, fish swim bend)
  audio/audio.js      procedural ambience and sound effects
scripts/              release helpers
docs/DESIGN.md        game design notes, economy and roadmap
```

`src/main.js` is still one large file carried over from the prototype. Splitting it into terrain, fish, fishers, economy and UI modules is the first item on the roadmap.

## Controls

| Input | Action |
| --- | --- |
| Drag / WASD | Pan |
| Scroll / pinch / + − | Zoom |
| Q | Look (click a fisher, then a bank tile, to move them) |
| 1 / 2 / 3 | Clear land / Dig water / Hire fisher |
| C | Codex |
