# Changelog

## 0.11.4 — a shape for every kind of card

Crate cards now have their own silhouettes and surfaces, as in the card shapes proposal:
- **Blessing:** an arched chapel window. Its head is leaded stained glass with a painted swirl, and a light shaft drifts across it. On hover, the panes light up one after another.
- **Keeper:** a woven banner with a wavy band of colour and a pointed foot holding a glowing gem. The keeper's portrait stands over the top edge.
- **Blueprint:** a drafting sheet pinned to the board, with clipped corners, a torn foot and a cyanotype grid. A building draws itself in pale ink once the card lands.
- **Treasure:** a tablet with faint engraved rings. The currency's painted medallion sits in a ribbed coin edge above it and spins in edge-first after the card lands.

The face of each card is clipped to its shape, and the outline stroke follows the shape. The stroke now fades in from the foot: it's full colour at the bottom and fades out toward the top, so the artwork at the top stays clean.

Cards in a crate line up along their bottom edge. The debug panel has a **One of each** crate.

## 0.11.3 — treasure cards, cards that rise into place, a dithered reel

- **Cards rise from below:** crate cards no longer show their mirrored backs before turning over. They rise from below the screen one after another, overshoot a little and settle.
- **Card edges:** each card's stroke is now a vertical gradient, full colour at the top and fading to nothing toward the foot. It brightens on hover.
- **Treasure cards:** a crate of blessings now sometimes offers a heap of one currency in place of one of its cards.
  - The currencies are scales, silver, timber, reeds, clay, lanterns and carvings.
  - Each one has its own painted medallion: a ring of wedges, a bold glyph, and a painted swirl over it all.
  - The medallion floats gently, a light runs round its rim, and it gives a little hop when you hover the card.
  - A crate whose pools are empty gives a silver treasure card instead of the old purse.
  - The debug panel has a **Treasure** button that deals a crate of them.
- **Reeling ring:** the ring is now pixel-dithered. It has a checker track, a sparse dithered halo outside it, and a dithered echo of the mint arc.
  - The amber warning and the ember surge recolour the dither.

## 0.11.2 — work marked on the ground, rings instead of labels

- **Queued work is marked on the ground:** every tile waiting for work gets a light dithered wash, and each patch of work gets a soft outline around its edge, so a big queue no longer hides the land. The colour shows its state:
  - **Cream:** waiting for hands.
  - **Mint:** being worked. The wash fills in as the work goes on.
  - **Ember:** nobody can get there.
- **One ring per patch:** the text labels are gone. Each patch of neighbouring jobs (same job, same state) shows a single small ring with the job's icon, the patch's progress, and a count when it covers more than one tile.
  - Hover a ring for the details, for example "Clearing · 40% (9 tiles)" or "No way there yet (14 tiles)".
  - This works the same for clearing, digging and building.
- **Workshop crafting:** shown as a compact gold ring with a dithered track instead of a bar. When the workshop runs out of materials, the ring turns ember.

## 0.11.1 — landmarks in view, quieter job labels

- **Landmark placement:** landmarks now keep at least six tiles inside the valley's outline, so none sits on the slope at the edge.
  - A landmark you haven't found yet that already sits too close to the edge moves to a clear spot the next time the save loads.
- **Landmark outline:** before a landmark is found, its silhouette has a soft white outline at 20% opacity, so it's easier to spot among the trees.
  - The outline only shows around the shape, never through the dithering.
- **Grouped job labels:** jobs next to each other that are stuck the same way ("No way there yet" or "Waiting for hands") share one label.
  - The tile in the middle of the patch shows the full message and the number of tiles, for example "No way there yet · 14 tiles".
  - The other tiles show only a small icon.

## 0.11.0 — an organic valley, spirit giants, landmarks in shadow

**The valley's outline**
- The playable valley no longer fills a rectangle. Every rolled valley gets its own rounded, uneven outline, the way it gets its own river.
- Past the edge, the forest carries on thick and thins out into glades on the hills, so there's no hard border.
- The river and the Pilgrim Way still reach the edges of the map.
- **Existing saves:** they take on the outline the next time they load. Only untouched forest is affected; anything built, cleared or dug stays playable.

**Spirit giants**
- There are now three giants instead of seven: the Pale Stag, the Lantern Owl and the River Whale. The moth, jellyfish, elk and wyrm are retired.
- They're drawn as light, after the pixel-art stag reference: bright and solid at the top, fading to transparent toward the ground in a pixel dither, with a teal glow pooled under them and motes rising through them.
- **The Pale Stag:** walks through the forest. It has a new slender build and tall branching antlers.
- **The Lantern Owl:** perches on the valley's rim at dusk.
- **The River Whale:** lives in the river. It leaps along it, mostly over your bridges, splashes back in and comes up again further along. With no bridges, it leaps from open water.

**Landmarks in shadow**
- Before they're found, all four landmarks stand in the forest as dark, dithered silhouettes that thin out toward the top. Their lights (lantern, runes) show faintly through.
  - The temple and the gate were invisible before; now they show like the cedar and the tower.
- Once found, each one appears in full.

**Reeling fix**
- A surge no longer starts while the light is crossing, or about to cross, the mint arc. It waits until the light has passed.
- **A warning first:** before a surge, the ring pulses amber and says "It’s gathering…".
- A pull in the first half-second of a surge is forgiven ("Easy…").
- A later pull during a surge costs one step of your run, not the whole run.

## 0.10.1 — smaller giants, lighter weather, debug previews

- **Giants:** they're now about six trees tall, and they roam the forest around the valley instead of standing past the mountains.
  - Walkers and the Fog Wyrm keep to the trees and never cross the village or the river.
  - The whale and the jellyfish drift low over the valley, and the owl perches on the valley's rim.
- **Weather is lighter:**
  - Fog comes in patches with clear gaps between them.
  - Rain and storms use fewer, fainter streaks, with less darkening and softer lightning.
  - Snow and falling petals are lighter too.
- **Landmarks:** they keep their spot once placed. In a save that grew from a smaller valley, they're placed in forest that is still standing.
- **Debug panel** (press ` in dev, or add ?debug to the address):
  - **Giants:** buttons to call each giant and look at it, plus Look at giant, Greet (gift), Send away, and Parade all, which shows each giant in turn for 9 seconds.
  - **Landmarks:** a button for each landmark that flies the camera to it, plus Uncover all 4.
  - The header shows the build version and grid size.
- The main menu shows the version under the valley number.

## 0.10.0 — a wider valley, the seasons, and the giants of the high country

**A wider valley**
- The playable valley is now 68 × 46 tiles, about 2.4× the area it was. There's more forest to clear, the river runs further, and there are two more old channels out at the far ends.
- Older saves grow in place. Everything you built stays where it was, in the middle of the new valley, and the Pilgrim Way is extended to the new north edge.
- The mountains stand further out, and the camera can roam the whole valley zoomed right out.

**Landmarks in the deep wood**
- There are four new secrets that are much bigger than the rest, each one far from the others:
  - **The Bell Temple:** you hear its bell before you find it. Offerings work 15% better.
  - **The Elder Cedar:** a tree as tall as a hill, visible from anywhere. Woodcutters work 30% faster.
  - **The Lantern Tower:** an old lighthouse whose beam sweeps the valley at dusk. Pilgrims +10%, and secret hints show within 14 tiles of it.
  - **The Mist Gate:** a stone gate with glowing runes, found by the mist that hangs around it. Giants come twice as often.
- Discovering the temple, the tower or the gate clears the ground around it. Landmarks can't be removed.

**Seasons**
- Each season lasts 7 days, and the valley changes as one turns into the next:
  - **spring:** blossom trees in pink and greener grass
  - **autumn:** a third of the forest turns gold, orange and red
  - **winter:** snow on the ground and on the trees, and the backwaters ice over at the edges

**Weather**
- Clear skies, rain, storms, fog and snow, rolled by season. Weather lasts a few minutes at a time.
- **Rain:** falling streaks and the sound of drops. Fish rise 25% more.
- **Storms:** darker skies, lightning flashes and thunder. Fish rise 50% more.
- **Fog:** lies in the low ground and drifts. Fish rise 10% more.
- **Snow:** falls in winter. Petals drift in spring and leaves in autumn.

**Wildlife**
- Herons stand in the backwaters and strike at fish. Ducks paddle on the backwaters, and dragonflies dart over them on warm days.
- Deer graze at the forest's edge and bolt when workers come near.
- How much wildlife you see follows the valley's health. Frogs croak on the backwaters at dusk.

**The giants of the high country**
- Every so often, something enormous passes beyond the valley. A chip at the screen's edge points to it, and clicking the chip brings it into view. Click the giant itself to greet it and receive its gift:

| Giant | When it appears | Gift |
|---|---|---|
| The Mountain Stag | by day | timber from a shed antler |
| The Grey Owl | at dusk | every secret hint shows for a day, plus a crate |
| The Cloud Whale | by day, but not in storms | a good tide, scales, and a shoal of fish |
| The Lamp Moth | at night, and it perches on the Lantern Tower once that is found | lanterns |
| The Lantern Bell, a jellyfish of light | on summer and autumn nights | silver |
| The Bone Elk | at dusk in autumn and winter | a new tale about a fish you've met |
| The Fog Wyrm | in fog or rain | scales and a keeper crate |

- Gifts grow with the tales you know and the secrets you've found.

## 0.9.0 — a guided tour, progress over tiles, and a hand on the line

**Guided tour**
- A new valley now opens with a 13-step tour. A soft spotlight picks out one thing at a time and a card explains it: the first fisher, scales and silver, clearing land, job progress, restoring the old channels, huts and fishers, Build, the Tale House, tracked goals and the menus.
- The spotlight never blocks the game. Some steps wait for you to do the thing ("pick Clear land", "click a patch of forest") and move on by themselves; the camera glides to whatever is being shown.
- Skip it at any time, or take it again from **Settings → Guided tour**.

**Progress over tiles**
- Every job shows a small bar over its tile: an icon, what is happening ("Clearing · 42%", "Building a bridge", "Upgrading") and the progress.
- Jobs waiting for workers say "Waiting for hands"; jobs workers can't reach say "No way there yet" in ember.
- Zoomed in, workshops show their crafting too ("Crafting lanterns", or "Needs 3 timber" when they run dry). Zoomed far out, only the bars remain.

**Lend a hand (reeling)**
- When a fish is hooked, a ring appears beside it. A light runs round the ring: press **Space**, or click the ring, as it crosses the mint arc to give the crew a pull. The gold heart of the arc is a perfect pull.
- Each hit moves the arc. A run of hits narrows it and speeds the light, and the combo shows in the middle. Bigger fish run the light faster.
- When the fish surges, the ring turns ember: let it run. Pulling then strains the lines.
- Pulls bring the fish in faster, and every good pull adds to a new **Your steady hands** row in the release tally, up to ×1.5 scales.
- It's entirely optional: the crew still reels on their own, and missing costs nothing but the combo. The first time a fish bites, a note in the log explains it.

## 0.8.1 — crate cards

- Crate cards follow the new design: a tag on the top edge (Blessing, Keeper, Blueprint, Silver), a header glowing from below in the card's colour (mint, gold or pale blue), the name in Milonga, and the change in large type (`+20% → +40%`).
- The tags are now a **sigil chain**: small medallions linked by arrows, showing what a card touches and what it brings (Pilgrims → Silver, Offerings → Fish, Crafts → Silver). Keepers and blueprints get theirs from their descriptions.
- The bottom of each card now tells you about your own valley:
  - blessings show how many you hold as diamonds (filled, the next one pulsing, empty), plus a live line such as "Timber: 4.5 → 5.6 a minute" or "Each pilgrim leaves ~3 → 4 silver"
  - keepers show how many cottages are taken
- **Dealing:** cards arrive face down and flip over one after another.
- **Idle:** each card bobs out of step with the others. Its edge breathes with light, motes drift up through the header over a slow aurora, and a shine runs along the tag now and then. Keeper portraits sway.
- **Hover:** the card tilts toward the cursor and a soft light follows it across the face. The blessing flows along the sigil chain, one medallion lighting after another, and the next diamond lights up. Motes rise faster, glints bloom from the corners, and there's a soft note on hover.
- **Choosing:** the card rises and dissolves into light while the others sink away, and a ring of light spreads across the screen. When every cottage is taken, you are asked who makes room first.

## 0.8.0 — a new face

**Type and menus**
- The interface is set in Milonga (titles, menu labels, headings) and Karma (reading text), both from Google Fonts. Mint (`--accent`) is the one interface colour; gold stays for scales and costs.
- The top bar follows the new design: a dark fade across the top of the screen with flat menu items (icon and Milonga label), a count badge on Trade, and a dot on Codex when there is a fish you haven't looked up yet. Sound and pixel size moved into a new Settings menu.
- The same menu-item style is used everywhere a choice is made: the top bar, the tools along the bottom (now on a matching dark fade), the build drawer's tabs, the settings options and the close buttons.
  - Hover: a mint line draws out from the middle under the label.
  - Active (the open menu, the chosen tool or tab): the label turns mint and a small glowing diamond, like a pin on the map, pops in beneath it.
- The Trade and Codex sheets now sit between the top and bottom bars, so the menus stay reachable while they are open.

**Settings**
- A new Settings dialog, reachable from the top bar and the title screen: valley name, sound, pixel size (×2 / ×3 / ×4), a controls reminder, and starting a new valley (with an inline confirmation).

**Name your valley**
- Name your valley in Settings, or click its name at the top left. The name replaces "Deepvale" on the title screen, at the top of the screen and in the browser tab, and the title screen offers to "Return to" it.

**The title screen**
- The title is alive. Its letters rise in one by one, then bob gently like something on water. A band of light sweeps across it every few seconds, faster while you hover. Letters near the cursor lift, tilt and glow mint, and throw off glints.
- Four-pointed glints, the same sparkle as treasure in the forest, bloom around the title. They burst from the edges of the buttons on hover, while a shine passes over "Enter the valley".
- Slow motes and fireflies drift up over the valley, leaning away from the cursor, and the camera drifts slowly over the valley behind.
- The HUD stays hidden until you enter. All of this respects "reduce motion" in the system settings.

## 0.7.2 — layered pines

- Trees are now built in four tiers, each narrower than the one below and turned against it. Every tier is darker underneath and catches light toward its tip, so the forest reads as layered boughs instead of single cones. The cones are open underneath, where they are never seen, which keeps the triangle count down.
- Heights vary: stout pines, tall thin spruces (about 30%), and now and then an old giant (about 6%) standing above the canopy.
- Dev builds expose `THREE`, `makeFishMesh` and `U` on `window.__dv`, for rendering marketing art.

## 0.7.1 — statues raised by folklore

- Statues can be raised twice, but only with the folklore of their own fish. The first raising needs the fish's 2nd tale: the carving is recast in bronze, the blessing grows ×1.5, and a pair of stone lanterns and small offerings appear. The second needs its 3rd tale: the carving is gilded, the blessing doubles and reaches one tile further, and a ring of light and two banners in the fish's colour go up. Until the tale is known, the statue's panel shows the next step and which tale it's waiting for.
- Choose each statue's base in its panel: round, square or triangle. The terrace, its edging stones and the stepped plinth all follow the shape. Changing it is free.
- Statue names follow their level: Stone, Bronze or Gilded River Koi, and so on. Raised statues also cast lamplight at night.

## 0.7.0 — the Tale House, statue gardens, a quieter river

**The Tale House**
- Every village now starts with a Tale House on the Way: the valley's museum of folklore. Pilgrims come down to hear the tales and leave silver in the tale box, more for every tale you know. They no longer wander to huts; they go to the Tale House or to market stalls.
- It grows as you learn tales. A banner goes up on the front for every fish you meet. At 6 tales it gains an east wing with carved fish on plinths, at 12 a lantern tower, at 18 a west wing and a string of paper lanterns, and with every tale known a gilded fish on the ridge. The tooltip shows the tales told, the silver per pilgrim, and when it grows next.
- Older saves get one built next to the Way on load, with a note in the log. You can build more for new villages (Build → Work & trade).

**Statues**
- A statue now fills its tile: a paved terrace edged with stones, a stepped plinth banded in the fish's colour, and the carving leaping from a stone wave, much bigger than before.
- Each fish gets its own garden. The Reedling has a lily pond and reeds, the River Koi a koi pond with a red gate. The Stonebelly Carp has river stones and clay pots, the Ember Showa glowing braziers, and the Mossback Sturgeon moss mounds, ferns and a fallen log. The Lantern Eel has a dark channel with glowing stones, the Moonscale Koi a raked white garden under a moon arch, and the Valley Warden a ring of standing stones.

**Sound**
- The river no longer hisses. The old noise bed is replaced by what running water mostly is: small bubbles ringing and rising in pitch as they close (Minnaert resonance), in little gurgling clusters. Under them sits a soft low murmur, with the odd plop and a slow lap at the bank. In a side-by-side recording the high-frequency hiss is about 12 dB lower and the whole mix about 6 dB quieter.
- The wind is gentler, with more quiet between gusts. Strong gusts make the old trunks creak.
- Workers can be heard: axes in green wood while clearing, spades while digging, mallets while building. Falling trees creak and come down in the leaves. Sounds are panned to where they happen on screen and fade as you zoom out.

## 0.6.5 — lamplight and bloom

- Lamps now cast real light at night. Stone lanterns, corner lanterns and road lamps each throw a warm pool of light. So do lit hut windows, workshops, markets, trading posts and shrines, and every fisher sets down a small lantern. The light falls on the ground, roads, houses, trees and the riverbed alike, flickers gently, and is a little stronger around bigger huts.
- Bloom: lamps, windows and glowing fish bleed a soft glow into their surroundings. It is barely there by day, grows with dusk and night, and also rises when a giant darkens the sky.
- Night is a little deeper away from the lights, so the lit village stands out.
- Toned down slightly after a first look: softer pools, gentler bloom, and a little less darkening away from the lights.
- How it works: the lights are added in the post pass, using each pixel's world position rebuilt from the depth buffer. No building materials had to change. The 40 lights nearest the centre of the view are used at a time; the light types and their colour, radius and strength are in `src/render/lamps.js`. Bloom is in `src/render/bloom.js`.

## 0.6.4 — one clean stylesheet

- `src/style.css` has been rewritten as a single, ordered stylesheet with no `!important` overrides (only `[hidden]` keeps one). It has eight sections: tokens, base, HUD, toolbar, world overlays, panels, screens and responsive. Checked against screenshots of every panel: the look is unchanged.
- Every colour, surface, font and radius is a variable in the `:root` block at the top. Change `--glass`, `--edge`, `--txt` or `--gold2` there and every panel follows.
- All panels share one glass surface rule. Old rules from 0.1–0.6 that no longer matched anything have been removed.

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
