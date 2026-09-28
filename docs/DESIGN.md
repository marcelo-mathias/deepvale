# Deepvale design notes

## Pillars

1. **Scale.** Fishers are about 0.3 of a tile tall. Trees are twice that. The largest fish is 15 tiles long. Every screen should make people feel small.
2. **Slow and idle.** Fights last from 12 seconds to over three minutes, and fish arrive every 20 to 36 seconds. The game should reward leaving it open.
3. **Awe.** Big fish get a moment: they rise from below, letterbox bars slide in, the camera moves to them and a title card names them. Keep the most mystical fish for the end.
4. **A grand place.** An isometric topographic valley under a snowy mountain, golden-hour light, contour lines on the slopes.
5. **Respect for the river.** Nothing is killed or sold. Every fish is met on a barbless line and let go. The game is about keeping a river alive and learning what the valley says about its creatures, not about catching them.
6. **Folklore first.** Each fish has a rumor, fixed facts and three tales. Tales are the reward for meeting fish again, and they are what draws pilgrims (and silver) to the villages.

## Core loop

1. **Clear land** turns forest into ground a fisher can stand on. It must touch cleared land or water.
2. **Dig water** grows the river. It must connect to existing water, and it only helps if the current runs through it (see Flow).
3. **Build huts** on cleared land. Each hut houses 3 fishers; hiring stops when every hut is full.
4. **Lay roads** from the Pilgrim Way (the road that enters at the north edge). Roads over forest clear it as they go. Click a road again with the road tool to lift it.
5. **Build bridges** over water, joined to a road or bridge. Fishers can stand on bridges, which puts their lines over the middle of the river where the widest-water fish swim.
6. **Hire fishers** at the water's edge or on a bridge, up to three per tile.
7. Fish swim the flowing water they spawned in. A fish takes the line only when at least `crew` idle fishers are within reach at the same time.
8. More fishers on the line (up to twice the crew) and Braided Lines bring it in faster. The fish is held at the surface for a moment, then turned loose and swims back to deep water. It sheds scales, and counts as a meeting in the Codex.

Offline: returning after a minute or more grants 60% of the recent scale rate and 60% of the pilgrim silver rate, capped at 8 hours.

## Two currencies

- **Scales** are shed by released fish. They pay for work on the land and river: clearing, digging, huts, roads, bridges.
- **Silver** is left by pilgrims. It pays fishers and upgrades (Braided lines, Offerings).
- Pilgrims only visit huts that touch a road or bridge connected to the Pilgrim Way. Each such hut brings 5 silver / min, ×1.5 if the hut belongs to a named village, and the total is multiplied by `1 + 0.2 × tales told`.
- Three or more huts within two tiles of each other form a **village** and get a name (Reedmoor, Lowlantern, …) that floats over them.

## Flow

Water enters at the west edge and leaves at the east edge, along the river's original mouths. On every dig the game solves a potential field over the water tiles (Laplace, fixed at the mouths, closed at the banks) and takes the current as its gradient, relative to a 3-tile-wide channel.

- Tiles with current below 0.16 of that are **still**: murky green water with duckweed, no caustics, no fish. Fish treat still water as bank, and still tiles do not count toward a species' water gate or open width.
- Dead-end ponds go still a tile or two in. Very wide lakes slow down everywhere and eventually go still too. Side channels that rejoin the river keep flowing, so islands and braided channels work.
- The water shader advects its ripples along the current and draws faint streaks in the direction of flow.

Source: `src/world/flow.js`.

## Folklore

`src/data/lore.js` holds, per fish: a **rumor** (shown before you've met it), **age / temper / favors**, and **three tales**, learned at 1, 4 and 12 meetings. Hovering a fish opens a card with its stats, current state and latest tale (or rumor). Clicking pins the card and follows the fish.

The Ember Showa warms the water around it: the water shader tints and shimmers around its body and a short trail, and steam rises off the surface.

## Species

| Fish | Length (tiles) | Crew | Flowing tiles | Open width | Scales | Fight (s) |
| --- | --- | --- | --- | --- | --- | --- |
| Reedling | 1.15 | 1 | 0 | 1 | 4 | 12 |
| River Koi | 2.1 | 1 | 0 | 1 | 10 | 20 |
| Stonebelly Carp | 3.3 | 2 | 40 | 1 | 34 | 32 |
| Ember Showa | 4.8 | 3 | 90 | 1 | 100 | 48 |
| Mossback Sturgeon | 6.6 | 5 | 130 | 1 | 340 | 75 |
| Lantern Eel | 7.8 | 6 | 170 | 1 | 950 | 95 |
| Moonscale Koi | 9.6 | 8 | 230 | 5 | 2,800 | 130 |
| The Valley Warden | 15 | 12 | 320 | 7 | 13,000 | 200 |

Source of truth: `src/data/species.js`. "Open width" comes from `needD`: the fish needs water at least `needD` tiles from any bank, so width = `needD × 2 − 1`.

## Costs

| Action | Currency | Formula |
| --- | --- | --- |
| Clear land | scales | 4 × 1.09ⁿ |
| Dig water | scales | 12 × 1.075ⁿ |
| Hut | scales | 25 × 1.45ⁿ (the first hut is free) |
| Road | scales | 3 (+ clearing cost over forest) |
| Bridge | scales | 30 × 1.25ⁿ |
| Hire fisher | silver | 15 × 1.3ⁿ |
| Braided lines (+30% reel speed) | silver | 60 × 2.3ⁿ |
| Offerings (+25% arrivals and bites) | silver | 90 × 2.5ⁿ |

## Rendering

- Scene renders to a half-float target at 1/2, 1/3 or 1/4 resolution, then a post pass upscales with nearest filtering, adds sky, a small glow, light shafts, ACES tone mapping, grading, vignette and 4×4 ordered dithering.
- Terrain is one heightfield: fine resolution over the playable grid, coarse outside. Its material adds underwater tint, caustics, a glowing shoreline, cloud shadows and contour lines.
- Fish are procedural low-poly bodies with pixel-art canvas textures. A vertex shader bends them to swim and curve. The glowing fish use an emissive map.

## The wider river (macro vision)

Deepvale is one region on a longer river. The Map (M) shows its whole course; only Deepvale is playable for now. Each future region would reuse the same loop with its own fish, folklore and one twist:

| Region | Biome | Twist idea |
| --- | --- | --- |
| Hollow Tarn | Glacier lake (source) | Ice covers still water; the current keeps channels open |
| Deepvale | Mountain valley | The current: widen the river without letting it go still |
| Birchmere Heights | Birch highlands (tributary) | Pilgrim routes: the tributary is where pilgrims arrive from |
| The Ashfen | Warm marsh | Heat instead of current: steam vents keep water alive; Ember Showa home |
| The Salt Mouth | Estuary | Tides: flow reverses on a cycle; where the Warden goes once a century |

Unlock hooks are written into the map as hints only; nothing gates on them yet.

## Roadmap

- [ ] Split `src/main.js` into terrain, fish, fishers, economy, input and UI modules
- [ ] Balance pass after a real idle session (spawn rate, fight length, costs)
- [x] Giants are held at the surface and released instead of dissolving into sparkles
- [ ] Day and night cycle, with the Moonscale Koi only surfacing at night
- [ ] Ripples and wakes where large fish break the surface
- [x] Huts, roads, bridges, villages and pilgrims
- [ ] Fisher walking animation (pilgrims walk; fishers still teleport when moved)
- [ ] A second playable region (the Ashfen is the natural next one)
- [ ] Tales shown as a short illustrated card when first learned
- [ ] Settings panel: volume, reduced motion, reset save
- [ ] Self-host the fonts so the itch.io build works fully offline

## Visual references

- `reference-koi-pond.png`: top-down pixel pond, caustic light lines, fish shadows on the bed
- `reference-harbor.png`: tiny figure against a huge ship, for the sense of scale
