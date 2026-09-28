# Deepvale

A cozy idle game about tiny crews, giant fish and river folklore. Far below a vast mountain, a valley river keeps creatures longer than villages. Keep the current running, build a village by the water, and gather enough gentle hands to meet something vast, and let it go.

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
  world/flow.js       river current solver (flowing vs still water)
  data/species.js     the eight fish and their unlock gates
  data/lore.js        rumors, tales, village names, map regions
  render/village.js   huts, bridges and pilgrims
  render/wisps.js     steam and chimney smoke
  ui/map.js           the river map overlay
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
| Q | Look (hover a fish for its card, click to follow it; click a fisher, then a bank tile or bridge, to move them) |
| 1 / 2 / 3 | Clear land / Dig water / Hire fisher |
| 4 / 5 / 6 | Hut / Road / Bridge |
| C | Codex |
| M | Map of the river |
