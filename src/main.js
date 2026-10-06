// Deepvale's game code lives in src/game/, split by topic into the parts listed below.
// The parts are not separate modules: they share one scope, as if they were still one file.
// vite.config.js stitches them back together here, in exactly this order, before anything runs.
// So a name defined in one part can be used in any other, and the order below only matters for
// code that runs straight away at load (the part that defines a value must come before code that reads it).
// Imports stay at the top of game/core/setup.js, with paths relative to this file (src/).
//
// To add a part: create the file under src/game/ and add its line below.
//#parts
// game/core/setup.js
// game/world/terrain.js
// game/fish/fish.js
// game/world/nature.js
// game/economy/rules.js
// game/fish/hooking.js
// game/economy/trade-secrets.js
// game/economy/crates.js
// game/village/village.js
// game/village/gather.js
// game/ui/view.js
// game/ui/input.js
// game/ui/hud.js
// game/ui/letter.js
// game/ui/tapestry.js
// game/core/save.js
// game/ui/debug.js
// game/core/boot.js
