# Changelog

## 0.5.0 — the river remembers

- Restoration: the valley was damaged, and the river used to be wider. Its old beds show as dry, sunken strips of scrub beside the river. Digging them out costs 40% of a new channel ("Restore the old channel"); one runs close beside the main river, so restoring it and the strip between opens a reach wide enough for the Warden.
- An old mill weir holds the river back at the west end. Click it to take it down (a long job): more fish come up, and the valley can heal.
- Valley health (0–100) in the purse: old channels restored (35), forest kept (30), backwaters and reed beds (20), weir gone (15). Fish arrive more often as it rises. The Moonscale Koi needs 50 and the Valley Warden 70.
- Backwaters are habitat now, not dead water: lily pads, dragonflies, and they count toward health
- Roads are their own textured meshes: straights, corners, T-junctions and crossings, with curbs on open sides, in dirt, gravel, cobble or plank
- Woodcutters tend the forest instead of clearing it; new intro and tutorial lines tell the restoration story

## 0.4.0 — plots and workers

- Workers: clearing, digging, huts, bridges, buildings and upgrades are now jobs. Builders (2, plus 1 per hut) walk out from the nearest hut, work the tile with axes, shovels and hammers, and walk home. Trees fall one by one, dug ground turns to mud, buildings rise inside a scaffold. You can queue as much as you like; clearing and digging can run on from tiles still being worked. Remove on a job calls it off with a full refund. Unfinished work completes while you're away.
- Plots: click any building or road to open its plot. Upgrade huts to houses (+2 beds) and longhouses (+3 more), and work buildings, trading posts, jetties and markets twice (more output, capacity or prices). Buildings grow and gain annexes as they level.
- Yards (vegetable patch, woodpile, well, shade tree, bench, planter), a corner lamp, and fences, hedges or low walls on each side, all adding charm. Roads take railings and hedges on their open sides.
- Buildings are drawn bigger so they fill their tile
- Debug: "Finish all work"

## 0.3.1 — lines, giants and crows

- Lines have a reach (about 3 tiles, a little more from a bridge or pier). Hooked fish surge away now and then; a line pulled too far goes orange, then snaps. If fewer hands than the fish needs are left, it slips free.
- Only fishers whose line can reach the fish's head join the fight, so crews have to stand where the giant swims.
- Giants glow: the Sturgeon's moss, more light on the Moonscale, a pulsing Warden. The Sturgeon, Eel, Moonscale and Warden bring an early dusk when they surface, and carry their own light over the water.
- Each giant has its own ~10 second tune when it surfaces (frame drum, cello and flute, glass bells, music box, warm choir)
- Trees fall when forest is cleared; dug tiles splash
- Send a crow (Build → Work & trade, 10 silver) to find what is under a forest hint without clearing it

## 0.3.0 — the valley trade

- A bigger valley: 44×30 tiles (was 28×20), and you can zoom out much further. Shadows follow the camera. 0.2 saves are laid into the middle of the new valley.
- Goods: timber (clearing and woodcutters), reeds (reed beds on still water), clay (clay pits), and lanterns and carvings (workshops)
- Trade you can watch: trading posts send ox wagons up the Pilgrim Way; jetties send barges down the current. Orders from Birchmere, the Tarn, the Ashfen and the Salt Mouth pay extra and bring crates.
- Silver now comes from trade. Pilgrims buy lanterns and carvings at market stalls instead of leaving silver at huts.
- Secrets in the forest (hermits, caches, old workshops, bones, standing stones, a shrine, clay seams, cedar groves), with hints above the canopy
- Build drawer (B): work buildings, piers, net sheds, drying racks, flower beds, fences, stone lanterns, cherry trees, fish statues, hut styles and road paving, with placement previews and drag-painting. Remove tool (X).
- Charm, blessings from statues and sheds, villages in harmony, and eight named places to discover
- Release tally: scales counted up line by line; a good tide streak multiplies consecutive meetings
- Keepers (14), blessings (12) and blueprints, picked from crates; village wishes
- New soundscape: a babbling river, wind in the pines, birdsong and a sparse kalimba. The low drones are gone; sighting a giant is now water and wind chimes.
- Debug panel (` or F9 in dev builds, or `?debug`)
- Fish water gates raised to fit the bigger river; clearing, digging and huts get more expensive more slowly


## 0.2.0 — the living river

- Catch and release: fish are met on barbless lines, held at the surface, then let go. Nothing is sold.
- Two currencies: scales shed by released fish, silver left by pilgrims
- Flowing water: a current solver runs on every dig. Backwaters go still and murky, hold no fish and don't count toward gates. Ripples follow the current.
- Huts (housing, 3 fishers each), roads, bridges (fishers can stand on them), named villages and walking pilgrims on the Pilgrim Way
- Folklore: every fish has a rumor, age, temper, favors and three tales learned over repeated meetings; tales raise pilgrim income
- Precise fish hover (screen-space, follows the bent body) with a stats-and-story card; click to follow a fish
- Ember Showa glows like coals, warms the water and sends up steam
- River map (M) with Deepvale and four uncharted regions
- 0.1 saves migrate: silver becomes scales, and the village is founded

## 0.1.0 — first prototype

- Isometric valley with a mountain, gorge and river; pixelated low-poly rendering with rim light, caustics and contour lines
- Tile building: clear land, dig water, hire and move fishers
- Eight species gated by crew size, water body size and open width
- Cinematic arrival for large fish, Codex, two upgrades, procedural audio
- Saves to localStorage with offline earnings
