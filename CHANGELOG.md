# Changelog

## 0.6.3 — chests, clearer crafting, orders that ship

- Old chests now surface at the forest's edge every few minutes (up to two at a time). They glint brightly. Send a crow or clear the tile to open one: most hold drawings for something you can't build yet, and the rest hold a crate.
- Workshops are easier to find and control. Click one to choose what it makes: What's needed (the default), Lanterns or Carvings. What's needed makes whatever open orders are short of. Before, a workshop always made lanterns when it could, so carvings rarely appeared. The panel shows both recipes and says what the workshop is waiting for when it runs out.
- Wagons and barges now load whatever open orders on their route are waiting for first, then the most valuable goods. Before, cheap goods like reeds were loaded last and often never went out.
- The trade panel has a Send / Hold toggle for each good, and a "Send now" button on any wagon or barge that has something ready.
- Tracked orders show the next step when something is missing, for example "build a trading post", "lanterns are made in a workshop", "reed beds grow reeds on still water", or "the workshop needs 3 timber for each one".
- Workshop and market descriptions now say plainly that workshops make lanterns and carvings and markets sell them.
- Debug: a Chest button drops a chest right away.

## 0.6.2 — soft glass

- The HUD is lighter. The heavy engraved and parchment panels are gone; every surface is now a faint tint over a background blur, with rounded corners.
- The top of the screen is one slim row of separate pills across the full width: date and purse on the left, the three meters in the middle, and the menu buttons on the right. Goods sit in a small pill underneath.
- Tracked goals moved to the right side, narrower and quieter. Click the header to fold them away.
- The toolbar spans the bottom of the screen, with its groups spread apart.
- Sound is an icon toggle, and the pixel button just shows ×2, ×3 or ×4. On narrower windows, lower-priority details (tales, the subtitle, meter labels) fold away.
- Fixed: Reset save didn't always wipe the save. It now asks for confirmation inline (no timer), removes the save, and leaves a marker that the next boot honours even if something saves on the way out. Other open tabs of the game stop saving when one of them wipes. "Another valley" on the title screen uses the same path.
- Fixed: toggling Fish frenzy in the debug panel no longer resets the speed values on every other debug action.

## 0.6.1 — foothills and the stair

- The land no longer rises from the valley edge as a sheer wall: mountains fade out over the first ten tiles, so the valley is ringed by wooded foothills. A dense band of forest now covers those slopes.
- The Pilgrim Way leaves the valley as a stone staircase in switchbacks, with wooden posts and rails; pilgrims and wagons climb it.
- New valleys vary much more: wider range of river bends and positions, mountains placed anywhere around the north and west (sometimes a second peak), and a few natural meadows and forest ponds of their own.
- Resetting the save (debug) or choosing "Another valley" now really starts a new valley; closing the page no longer wrote the old save back. Resetting also rolls a new map.

## 0.6.0 — days, homes and a new face

- A new look for the interface: engraved dark panels with gold hairlines, and parchment for documents. A status cluster with the calendar (year, season, day, time of day), scales, silver, valley health, good tide and builders as bars, and tales told. Goods as chips. A tracked goals card (next fish, village wish, two orders) that folds away. Line icons on the toolbar, chips and goods.
- Pixel-art portraits for all fourteen keepers, in their slots and on crate cards
- Day and night: a 16-minute day (dawn, morning, midday, golden hour, dusk, night), 7-day seasons, 4 seasons a year. Morning mist on the river, fireflies at dusk, lit windows and lamps at night. The Moonscale Koi only surfaces at night; the Lantern Eel comes more often then.
- Houses have their own shapes and surfaces: thatch (plank walls, round straw roof, flower box), cedar (log walls, steep shingled A-frame, stone chimney), stilt (reed walls on posts, porch and ladder), lacquer (white plaster in a timber frame, red tiled roof with upturned eaves, door lanterns). Upgrades add a wing, then a second one.
- Trade and work buildings grow piece by piece: a market gets a second and third stall, crates, barrels and a string of lanterns; the trading post, jetty, workshop, woodcutter, clay pit and reed bed each gain their own additions
- Stone lanterns and lamp posts go on corners where tiles meet; fences, hedges and low walls go on the edges between tiles (drag to draw a line). Old lantern tiles and plot lamps and edges move onto them.
- Plot panels only offer what fits the building: homes get gardens and wells, a woodcutter a log pile and sawhorse, a clay pit brick racks, a market crates and barrels. Decor has no panel.
- Rotate buildings with R or the ↻ button
- Right-click cancels the current tool
- Giant sightings play the full cinematic the first time, then only if two hours have passed
- Workers never walk on water: a job across the river waits for a bridge or pier ("No dry way there")
- Ramps at the ends of bridges, and a smooth step onto decks, so walkers no longer drop and pop at the banks
- Random starting valleys: new games roll the river's course and the mountains from a seed ("Valley no. …", with "Another valley" on the intro screen). Saved games keep their valley.
- Debug: jump the clock to dawn, midday, golden hour, dusk or night

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
