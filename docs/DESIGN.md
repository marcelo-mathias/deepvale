# Deepvale design notes

## Pillars

1. **Scale.** Fishers are about 0.3 of a tile tall. Trees are twice that. The largest fish is 15 tiles long. Every screen should make people feel small.
2. **Slow and idle.** Fights last from 12 seconds to over three minutes, and fish arrive every 20 to 36 seconds. The game should reward leaving it open.
3. **Awe.** Big fish get a moment: they rise from below, letterbox bars slide in, the camera moves to them and a title card names them. Keep the most mystical fish for the end.
4. **A grand place.** An isometric topographic valley under a snowy mountain, golden-hour light, contour lines on the slopes.
5. **Respect for the river.** Nothing is killed or sold. Every fish is met on a barbless line and let go. The game is about keeping a river alive and learning what the valley says about its creatures, not about catching them.
6. **Folklore first.** Each fish has a rumor, fixed facts and three tales. Tales are the reward for meeting fish again, and they are what draws pilgrims (and silver) to the villages.

## Restoration (0.5)

The valley was damaged: an old mill weir, a drought, years of logging. The river used to run wide and braided, and the giants left when it shrank. The player is **restoring** it, not carving a new one.

- **Old channels** (`makeChannels` in `src/world/secrets.js`, from the save's seed): five dry beds, about 170 tiles, that leave the river and rejoin it. Sunken, pebbled, sparse scrub. Digging one costs 40% of normal. Digging elsewhere is still allowed at full price ("Dig a new channel").
- **The weir**: stone blocks across the river at column 6. Taking it down is an 18 s job (150 scales, 20 timber). While it stands, fish arrive 15% less often.
- **Valley health** = 35 × old-channel tiles flowing / all old-channel tiles + 30 × min(1, forest tiles / 65% of the starting forest) + 20 × min(1, (backwater tiles + reed beds) / 20) + 15 if the weir is gone. Fish arrival × (0.8 + health / 250). Gates: Moonscale Koi 50, Valley Warden 70.
- **Backwaters** get lily pads and dragonflies and count toward health.

## Core loop

Two loops feed each other. The **river loop** is the one Deepvale started with. The **valley loop** (0.3) gives the land a purpose and makes silver come from something you can watch.

River loop:

1. **Dig water** grows the river. It must connect to existing water, and it only helps if the current runs through it (see Flow).
2. **Hire fishers** at the water's edge, on a bridge or on a pier, up to three per tile. Huts house 3 each.
3. Fish swim the flowing water they spawned in. A fish takes the line only when at least `crew` idle fishers are within reach at the same time.
4. When a fish is released, its scales are counted up in a **tally**: the base value, then every multiplier that applies (extra hands, drying racks, statues, keepers, blessings, named places, the good tide), line by line.

Valley loop:

1. **Clear land** turns forest into ground, gives 3 timber, and may uncover a **secret** (see The forest).
2. **Make goods.** Woodcutters (forest edge), reed beds (still water), clay pits (bank) and workshops (reeds + clay → lanterns, timber → carvings).
3. **Ship them.** Each trading post keeps a wagon that rolls up the Pilgrim Way; each jetty keeps a barge that rides the current out of the east edge. Both leave when full (or after a wait with a few goods), are away for a while, and come back with silver. Pilgrims also buy lanterns and carvings at **market stalls**.
4. **Orders** from along the river (two up the Way, one downriver) pay extra silver and a **crate** when a shipment by the right route completes them.
5. **Crates** offer a pick of three: a **keeper**, a **blessing** or a **blueprint**.
6. **Build for charm and blessings.** Decor adds charm; fish statues, net sheds, racks and shrines bless nearby tiles; some arrangements become **named places** with a lasting bonus.

A **village wish** is always open (meet 4 Reedlings, plant 3 flower beds, sell 40 goods, find something in the forest…) and pays a crate.

Offline: returning after a minute or more grants 60% of the recent scale and silver rates and 60% of raw-goods production, capped at 8 hours.

## Currencies and goods

- **Scales** are shed by released fish. They pay for work on the land and river, and for most buildings.
- **Silver** comes from trade: wagons, barges and market stalls. It pays fishers and the two upgrades (Braided lines, Offerings).
- **Goods**: timber, reeds, clay (raw, and also building materials) and carvings, lanterns (crafted). Wagons and barges only take what is above the **keep-back** amount set in the Trade panel (T).

| Good | Wagon | Barge (×1.25) |
| --- | --- | --- |
| Timber | 2 | 2.5 |
| Reeds | 2 | 2.5 |
| Clay | 3 | 3.75 |
| Carvings | 9 | 11.25 |
| Lanterns | 14 | 17.5 |

Market stalls pay ×1.5, raised further by charm around the stall and by a village in harmony.

Pilgrims walk the Way to hear the tales. They come more often with more tales told, more charm and the Kind Hosts blessing. They visit huts and buy at market stalls; they no longer leave silver at huts.

## Building

Everything beyond huts, roads and bridges is in the **Build** drawer (B). Source of truth: `src/data/builds.js`.

| Category | Things |
| --- | --- |
| Work & trade | Woodcutter, Reed bed, Clay pit, Workshop, Trading post, Jetty, Market stall |
| Fishing | Pier, Net shed*, Drying rack* |
| Decor | Flower bed, Fence, Stone lantern*, Cherry tree*, Fish statue (one kind per fish met) |
| Styles & paths | Hut styles: thatch, cedar*, stilt*, lacquer*. Road surfaces: gravel, cobble*, plank* |

\* needs a blueprint first.

- **Placement preview.** With a build tool active, hovering shows floating numbers over every tile the placement would touch (timber per tree, charm per home, +25% reel per fisher…) and a summary line.
- **Painting.** Roads, paving, fences, flower beds and Remove can be dragged along a line.
- **Remove** (X) gives half the cost back.
- **Harmony.** A village whose huts all share one style is in harmony: its market pays 20% more.

### Named places

| Place | Arrangement | Bonus |
| --- | --- | --- |
| Harbor | Jetty + net shed + drying rack within 2 | Barges +25% |
| Craft Quarter | Workshop + market + clay pit within 3 | Crafts +20% |
| Lantern Garden | 2 stone lanterns + flowers + cherry together | Pilgrims +15% |
| Lantern Bridge | A bridge with 2 stone lanterns beside it | Bridge fishers reel +20% |
| Shrine Walk | Cobbled road by the old shrine, with a stone lantern | Bites +10% |
| Fisher's Row | 3 piers side by side | Scales +10% |
| Harmonious Village | 5+ huts, all one style | Market +20% |
| Statue Garden | 3 different fish statues within 3 | Scales +15% |

### Fish statues

| Statue | Blessing (radius 2) |
| --- | --- |
| Reedling | Bites +15% |
| River Koi | Scales +25% |
| Stonebelly Carp | Clay pits +50% |
| Ember Showa | Workshops +50% |
| Mossback Sturgeon | Woodcutters +50% |
| Lantern Eel | Reel +25% |
| Moonscale Koi | Market +50%, +4 charm |
| Valley Warden | Scales +50% (radius 4) |

## Workers and plots (0.4)

- **Jobs.** Clear, dig, hut, bridge, every building and every upgrade is paid up front and queued. Builders (2 + 1 per hut, up to 14) walk from the nearest hut (BFS over land, bridges and piers), two to a job at most. Durations: clear 5 s, dig 7 s, bridge 8 s, hut 9 s, buildings 4–14 s, upgrades 13–16 s, for one pair of hands at 0.65 speed each. Roads, paving, fences, flower beds and plot add-ons stay instant.
- A tile with a job is busy. Remove on it cancels with a full refund. Clearing and digging may start next to a tile that is still being cleared or dug. Jobs are saved and completed on load.
- **Plots.** Click a building or road. Upgrades (two levels): huts +2 and +3 beds; woodcutter, reed bed, clay pit, workshop output ×1.5 / ×2; trading post and jetty capacity ×1.5 / ×2; market prices ×1.25 / ×1.5. Cost 60 scales + 10 timber, then 180 + 25 timber + 8 clay, ×1.12 per upgrade bought.
- **Add-ons**: one yard (vegetable patch, woodpile, well, shade tree, bench; roads: bench, planter, tree) +1–2 charm around it; a lamp +1 charm around it; an edge per side (fence, hedge, low wall; roads only on open sides) +0.5–1 charm on the plot.

## The forest

About 22 secrets are placed from a seed kept in the save (`src/world/secrets.js`), always away from cleared land. A hint shows above the canopy once cleared land is within 7 tiles (11 with Quill):

| Secret | Hint | Found |
| --- | --- | --- |
| Hermit's camp | campfire smoke | a crate of keepers |
| Forgotten cache | a glint | a crate |
| Old workshop | a glint | a random blueprint |
| Giant's bones | crows circling | scales, and the bones stay as decor |
| Standing stones | crows circling | +1 keeper slot |
| Old shrine | soft light | bites +20% within 3 |
| Red clay seam | red soil | clay pits ×3 there |
| Old cedar grove | none | +20 timber |

## Keepers and blessings

Keepers are named villagers with a quirk (14 of them). Two can live in the valley at once, plus one per standing stones found. Blessings stack up to a cap. Both come from crates; see `KEEPERS` and `BOONS` in `src/data/builds.js`.

The **good tide**: each fish met within 50 seconds of the last adds ×0.05 to the next release, up to ×1.5 (more with Long Tides). A busy river keeps it up.

## Debug tools

In dev builds (or any build with `?debug` in the address), press `` ` `` or F9: time ×1–16, fish frenzy, resources, spawn or meet fish, crates, unlock all blueprints, clear around the view, find all secrets, send wagons now, grant the wish, reset the save.

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
| Stonebelly Carp | 3.3 | 2 | 60 | 1 | 34 | 32 |
| Ember Showa | 4.8 | 3 | 170 | 1 | 100 | 48 |
| Mossback Sturgeon | 6.6 | 5 | 220 | 1 | 340 | 75 |
| Lantern Eel | 7.8 | 6 | 270 | 1 | 950 | 95 |
| Moonscale Koi | 9.6 | 8 | 330 | 5 | 2,800 | 130 |
| The Valley Warden | 15 | 12 | 420 | 7 | 13,000 | 200 |

Source of truth: `src/data/species.js`. "Open width" comes from `needD`: the fish needs water at least `needD` tiles from any bank, so width = `needD × 2 − 1`.

## Costs

| Action | Currency | Formula |
| --- | --- | --- |
| Clear land | scales | 4 × 1.025ⁿ (+3 timber) |
| Dig water | scales | 12 × 1.028ⁿ |
| Hut | scales | 25 × 1.3ⁿ (the first hut is free) |
| Road | scales | 3 (+ clearing cost over forest) |
| Bridge | scales | 30 × 1.2ⁿ |
| Hire fisher | silver | 15 × 1.3ⁿ |
| Braided lines (+30% reel speed) | silver | 60 × 2.3ⁿ |
| Offerings (+25% arrivals and bites) | silver | 90 × 2.5ⁿ |
| Everything in Build | scales + goods | see `DEFS` in `src/data/builds.js`; each has its own growth per one built |

The valley grew from 28×20 to 44×30 tiles in 0.3, so the starting river is about 143 flowing tiles. The water gates in the species table were raised to match.

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
- [x] Trade (wagons, barges, markets, orders), forest secrets, decor and named places, keepers and crates (0.3)
- [x] Natural soundscape: river, wind, birds, sparse kalimba (0.3)
- [ ] Balance pass on 0.3's economy after a real session (prices, trip times, keeper strength)
- [ ] Fisher walking animation (pilgrims walk; fishers still teleport when moved)
- [ ] A second playable region (the Ashfen is the natural next one)
- [ ] Tales shown as a short illustrated card when first learned
- [ ] Settings panel: volume, reduced motion, reset save (reset is in the debug panel for now)
- [ ] Self-host the fonts so the itch.io build works fully offline

## Visual references

- `reference-koi-pond.png`: top-down pixel pond, caustic light lines, fish shadows on the bed
- `reference-harbor.png`: tiny figure against a huge ship, for the sense of scale
