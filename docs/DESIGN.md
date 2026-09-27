# Deepvale design notes

## Pillars

1. **Scale.** Fishers are about 0.3 of a tile tall. Trees are twice that. The largest fish is 15 tiles long. Every screen should make people feel small.
2. **Slow and idle.** Fights last from 12 seconds to over three minutes, and fish arrive every 20 to 36 seconds. The game should reward leaving it open.
3. **Awe.** Big fish get a moment: they rise from below, letterbox bars slide in, the camera moves to them and a title card names them. Keep the most mystical fish for the end.
4. **A grand place.** An isometric topographic valley under a snowy mountain, golden-hour light, contour lines on the slopes.

## Core loop

1. **Clear land** turns forest into ground a fisher can stand on. It must touch cleared land or water.
2. **Dig water** grows the river. It must connect to existing water.
3. **Hire fishers** on cleared land at the water's edge, up to three per tile.
4. Fish swim the connected water they spawned in. A fish bites only when at least `crew` idle fishers are within reach at the same time.
5. More fishers on the line (up to twice the crew) and Braided Lines reel faster. Landing a fish pays silver and adds it to the Codex.

Offline: returning after a minute or more grants 60% of the recent income rate, capped at 8 hours.

## Species

| Fish | Length (tiles) | Crew | Water tiles | Open width | Silver | Fight (s) |
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

| Action | Formula |
| --- | --- |
| Clear land | 4 × 1.09ⁿ |
| Dig water | 12 × 1.075ⁿ |
| Hire fisher | 15 × 1.3ⁿ |
| Braided lines (+30% reel speed) | 60 × 2.3ⁿ |
| River bait (+25% arrivals and bites) | 90 × 2.5ⁿ |

## Rendering

- Scene renders to a half-float target at 1/2, 1/3 or 1/4 resolution, then a post pass upscales with nearest filtering, adds sky, a small glow, light shafts, ACES tone mapping, grading, vignette and 4×4 ordered dithering.
- Terrain is one heightfield: fine resolution over the playable grid, coarse outside. Its material adds underwater tint, caustics, a glowing shoreline, cloud shadows and contour lines.
- Fish are procedural low-poly bodies with pixel-art canvas textures. A vertex shader bends them to swim and curve. The glowing fish use an emissive map.

## Roadmap

- [ ] Split `src/main.js` into terrain, fish, fishers, economy, input and UI modules
- [ ] Balance pass after a real idle session (spawn rate, fight length, costs)
- [ ] Show giant catches being hauled up the bank instead of dissolving into sparkles
- [ ] Day and night cycle, with the Moonscale Koi only surfacing at night
- [ ] Ripples and wakes where large fish break the surface
- [ ] Fisher walking animation and small huts or camps on cleared land
- [ ] Settings panel: volume, reduced motion, reset save
- [ ] Self-host the fonts so the itch.io build works fully offline

## Visual references

- `reference-koi-pond.png`: top-down pixel pond, caustic light lines, fish shadows on the bed
- `reference-harbor.png`: tiny figure against a huge ship, for the sense of scale
