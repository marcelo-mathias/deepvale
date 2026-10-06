// Everything that can be built on a tile, the goods the valley makes, keepers, boons and named sets.
// Codes 0–3 are the originals (see world/constants.js); the rest arrived with 0.3's trade and building update.
export const B = {
  NONE:0, HUT:1, ROAD:2, BRIDGE:3,
  WOOD:4, REED:5, CLAY:6, SHOP:7, POST:8, JETTY:9, MARKET:10,
  NETS:11, RACK:12, LANTERN:13, STATUE:14, FLOWERS:15, FENCE:16, CHERRY:17, PIER:18,
  SHRINE:19, STONES:20, BONES:21, WEIR:22, TALEHALL:23,
  TEMPLE:24, ELDER:25, TOWER:26, GATE:27,
};

/* ---------- goods ---------- */
export const GOODS = {
  timber:   { name:'Timber',    price:2,  col:'#b98552', raw:true },
  reeds:    { name:'Reeds',     price:2,  col:'#c9c071', raw:true },
  clay:     { name:'Clay',      price:3,  col:'#c8744a', raw:true },
  carvings: { name:'Carvings',  price:9,  col:'#e0b070' },
  lanterns: { name:'Lanterns',  price:14, col:'#ffb35a' },
};
export const GOOD_IDS = Object.keys(GOODS);
// raw goods the village keeps back for building; wagons and barges only take what is above this
export const RESERVE = { timber:8, reeds:4, clay:4, carvings:0, lanterns:0 };

/* ---------- buildable things ----------
 on: where it can go
   land      cleared, empty land
   bank      land touching water (4 sides)
   flowbank  land touching flowing water
   edge      land touching forest (8 around)
   still     still water
   shore     water touching land, a pier or a bridge
 road: must touch a road or bridge
 lock: needs a blueprint first (from crates, caches and old workshops in the forest)
 charm: [amount, radius] added to every tile around it
*/
export const DEFS = {
  // --- work
  woodcutter: { code:B.WOOD,   cat:'work', name:'Woodcutter', on:'edge',  cost:{scales:30},            grow:1.25, desc:'Tends the forest around it: thins, prunes and replants, and never clears it. More trees around, more timber.' },
  reedbed:    { code:B.REED,   cat:'work', name:'Reed bed',   on:'still', cost:{scales:20,timber:4},   grow:1.2,  desc:'Still water is no use to fish, but reeds love it. More still water around, more reeds.' },
  claypit:    { code:B.CLAY,   cat:'work', name:'Clay pit',   on:'bank',  cost:{scales:25,timber:4},   grow:1.25, desc:'Digs river clay from the bank. Three times as much on a red clay seam.' },
  workshop:   { code:B.SHOP,   cat:'work', name:'Workshop',   on:'land',  road:true, cost:{scales:60,timber:12}, grow:1.4, desc:'Where lanterns and carvings come from: 2 reeds + 1 clay make a paper lantern, 3 timber make a carving. Click it to choose what it makes.' },
  post:       { code:B.POST,   cat:'work', name:'Trading post', on:'land', road:true, cost:{scales:40,timber:6}, grow:1.6, desc:'Keeps a wagon. It carries goods up the Pilgrim Way to Birchmere and the Tarn, and comes back with scales.' },
  jetty:      { code:B.JETTY,  cat:'work', name:'Jetty',      on:'flowbank', cost:{scales:50,timber:10}, grow:1.6, desc:'Keeps a barge. It rides the current east to the Ashfen and the Salt Mouth, where goods fetch more.' },
  talehall:   { code:B.TALEHALL, cat:'work', name:'Tale House', on:'land', road:true, cost:{scales:80,timber:16}, grow:1.8, charm:[2,2], desc:'The village’s museum of folklore. Pilgrims come down the Way to hear the tales and leave scales in the tale box. It grows as you learn more tales: banners, a wing, a lantern tower.' },
  market:     { code:B.MARKET, cat:'work', name:'Market stall', on:'land', road:true, cost:{scales:45,timber:8}, grow:1.35, desc:'Pilgrims who come for the tales buy the lanterns and carvings your workshops make. Charm around it raises prices.' },
  // --- fishing
  pier:       { code:B.PIER,   cat:'fish', name:'Pier',       on:'shore', cost:{scales:15,timber:3},   grow:1.12, desc:'A short plank walk over the water. Fishers can stand on it, no road needed.' },
  nets:       { code:B.NETS,   cat:'fish', name:'Net shed',   on:'land',  cost:{scales:30,timber:6},   grow:1.3,  lock:true, charm:[1,1], desc:'Fishers within 2 tiles bring fish in 25% faster.' },
  rack:       { code:B.RACK,   cat:'fish', name:'Drying rack',on:'land',  cost:{scales:25,timber:4,reeds:2}, grow:1.3, lock:true, charm:[1,1], desc:'Fish met by fishers within 2 tiles shed 20% more scales.' },
  // --- decor
  flowers:    { code:B.FLOWERS,cat:'decor', name:'Flower bed', on:'land', cost:{scales:5},             grow:1.04, charm:[2,2], paint:true, desc:'+2 charm around it. Charm brings pilgrims and raises market prices.' },
  fence:      { code:B.FENCE,  cat:'decor', name:'Fence',      on:'land', cost:{timber:1},             grow:1,    charm:[1,1], paint:true, desc:'Joins up with fences next to it. +1 charm.' },
  lantern:    { code:B.LANTERN,cat:'decor', name:'Stone lantern', on:'land', cost:{scales:10,clay:2},   grow:1.06, lock:true, charm:[3,2], desc:'+3 charm around it, and it glows.' },
  cherry:     { code:B.CHERRY, cat:'decor', name:'Cherry tree', on:'land', cost:{scales:12,clay:1},    grow:1.06, lock:true, charm:[3,2], desc:'+3 charm around it.' },
  statue:     { code:B.STATUE, cat:'decor', name:'Fish statue', on:'land', cost:{scales:80,clay:6},    grow:1.3,  charm:[4,2], desc:'A carving of a fish you have met, on a garden terrace dressed for it: a lily pond for the koi, embers for the Showa, standing stones for the Warden. Each blesses the tiles around it in its own way.' },
  // found in the forest, never built
  shrine:     { code:B.SHRINE, cat:'found', name:'Old shrine',  charm:[5,3], desc:'Fish take the line 20% more often within 3 tiles.' },
  stones:     { code:B.STONES, cat:'found', name:'Standing stones', charm:[3,2], desc:'One more keeper can live in the valley.' },
  weir:       { code:B.WEIR,   cat:'found', name:'Old mill weir', desc:'A stone weir from the old mill. It holds the river back: fewer fish come up, and the valley can’t heal while it stands.' },
  bones:      { code:B.BONES,  cat:'found', name:'Giant’s bones', charm:[3,2], desc:'The ribs of something that swam here before the river had a name.' },
  // landmarks: one of each in every valley, deep in the forest
  temple:     { code:B.TEMPLE, cat:'found', name:'The Drowned Temple', charm:[4,3], desc:'Older than the weir, older than the Way. Its bell still calls the fish: they take the line 15% more often everywhere in the valley.' },
  elder:      { code:B.ELDER,  cat:'found', name:'The Elder Cedar', charm:[3,3], desc:'The first tree of the valley. While it stands, woodcutters everywhere cut 30% more, and no one would dream of felling it.' },
  tower:      { code:B.TOWER,  cat:'found', name:'The Lantern Tower', charm:[3,2], desc:'A keeper’s tower that once lit the river for barges. Lit again, its beam shows what hides in the forest within 14 tiles, and draws 10% more pilgrims. Something large likes to rest against it at night.' },
  gate:       { code:B.GATE,   cat:'found', name:'The Sunken Gate', charm:[3,2], desc:'A stone gate half swallowed by moss, carved with animals bigger than mountains. Since it was found, the giants of the high country wander past twice as often.' },
};
export const DEF_BY_CODE = Object.fromEntries(Object.entries(DEFS).map(([k,d])=>[d.code,{...d,id:k}]));
export const CATS = [
  { id:'work',  name:'Work & trade' },
  { id:'fish',  name:'Fishing' },
  { id:'decor', name:'Decor' },
  { id:'style', name:'Styles & paths' },
];

/* ---------- hut styles and road surfaces ---------- */
export const STYLES = {
  thatch:  { name:'Thatch',  wall:['#cdb48a','#b99a6c','#d8c9a8'], roof:['#8a6a3c','#7a5a34','#6b4a2e'] },
  cedar:   { name:'Cedar',   wall:['#7a5236','#6b4630','#845a3b'], roof:['#4d5a58','#55605c','#46514f'], lock:true },
  stilt:   { name:'Stilt',   wall:['#b99a6c','#c4a77a','#a88a5e'], roof:['#a08650','#b09458','#94794a'], lock:true, stilts:true },
  lacquer: { name:'Lacquer', wall:['#e8e0cc','#efe7d4','#ddd3bc'], roof:['#a8342a','#9a2e25','#b53b2f'], lock:true },
};
export const PAVES = {
  dirt:   { name:'Dirt',   col:'#b8a47a', cost:{}, speed:1 },
  gravel: { name:'Gravel', col:'#aca694', cost:{scales:1}, speed:1.2 },
  cobble: { name:'Cobble', col:'#8e8a82', cost:{clay:1}, speed:1.4, charm:[1,1], lock:true },
  plank:  { name:'Plank',  col:'#9a7048', cost:{timber:1}, speed:1.4, charm:[1,1], lock:true },
};
export const PAVE_IDS = ['dirt','gravel','cobble','plank'];
export const STYLE_IDS = ['thatch','cedar','stilt','lacquer'];

/* ---------- fish statues: each species blesses its surroundings differently ---------- */
export const STATUE_FX = {
  reed:     { txt:'fish take the line 15% more often', bite:.15 },
  koi:      { txt:'fish met here shed 25% more scales', scale:.25 },
  carp:     { txt:'clay pits dig 50% more', prod:{ [B.CLAY]:.5 } },
  showa:    { txt:'workshops craft 50% faster', prod:{ [B.SHOP]:.5 } },
  sturgeon: { txt:'woodcutters cut 50% more', prod:{ [B.WOOD]:.5 } },
  eel:      { txt:'fishers reel 25% faster', reel:.25 },
  moon:     { txt:'market prices +50%', prod:{ [B.MARKET]:.5 }, charm:4 },
  warden:   { txt:'fish met within 4 tiles shed 50% more', scale:.5, r:4 },
};

/* ---------- blueprints: locked things a crate or a forest find can unlock ---------- */
export const BLUEPRINTS = [
  { id:'nets',          name:'Net shed',           kind:'build' },
  { id:'rack',          name:'Drying rack',        kind:'build' },
  { id:'lantern',       name:'Stone lantern',      kind:'build' },
  { id:'cherry',        name:'Cherry tree',        kind:'build' },
  { id:'style:cedar',   name:'Cedar huts',         kind:'style' },
  { id:'style:stilt',   name:'Stilt huts',         kind:'style' },
  { id:'style:lacquer', name:'Lacquer huts',       kind:'style' },
  { id:'pave:cobble',   name:'Cobbled roads',      kind:'pave' },
  { id:'pave:plank',    name:'Plank roads',        kind:'pave' },
];

/* ---------- keepers: named villagers with a quirk. Only a few can live in the valley at once ---------- */
export const KEEPERS = [
  { id:'netmender', name:'The Net-Mender',   glyph:'N', desc:'Fishers on bridges and piers reel 50% faster.' },
  { id:'ottoline',  name:'Old Ottoline',      glyph:'O', desc:'Every third small fish met sheds triple scales.' },
  { id:'carter',    name:'Brannoch the Carter', glyph:'B', desc:'Wagons carry 50% more and travel 25% faster.' },
  { id:'wren',      name:'Wren of the Reeds', glyph:'W', desc:'Reed beds grow twice as fast.' },
  { id:'kiln',      name:'Hollis Kiln',       glyph:'H', desc:'Workshops craft 50% faster, and clay pits dig 25% more.' },
  { id:'ferry',     name:'The Ferrywoman',    glyph:'F', desc:'Barges are paid 30% more.' },
  { id:'tamsin',    name:'Tamsin Two-Hats',   glyph:'T', desc:'Every named village adds ×1.1 to scales from fish.' },
  { id:'moss',      name:'Brother Moss',      glyph:'M', desc:'Every fish statue in the valley adds ×1.05 to scales from fish.' },
  { id:'pell',      name:'Pell the Storyteller', glyph:'P', desc:'Every tale told brings twice as many pilgrims.' },
  { id:'ysolde',    name:'Ysolde Lantern',    glyph:'Y', desc:'Lanterns sell for double.' },
  { id:'garrow',    name:'Garrow the Woodward', glyph:'G', desc:'Woodcutters cut 60% more; clearing forest gives 3 extra timber.' },
  { id:'fen',       name:'Little Fen',        glyph:'L', desc:'Scales from fish ×1.08 for each kind of fish you have met.' },
  { id:'quill',     name:'Quill the Cartographer', glyph:'Q', desc:'Crates offer 4 choices. Forest hints show from farther away.' },
  { id:'maud',      name:'Maud of the Deep',  glyph:'D', desc:'Fish that need 5 or more hands shed double.' },
];
export const KEEPER = Object.fromEntries(KEEPERS.map(k=>[k.id,k]));

/* ---------- boons: small blessings that stack ---------- */
export const BOONS = [
  { id:'hands',  name:'Steady Hands',   desc:'Fishers reel 15% faster.', max:5 },
  { id:'sweet',  name:'Sweet Water',    desc:'Fish take the line 15% more often.', max:5 },
  { id:'shine',  name:'Scale Shine',    desc:'+10% scales from every fish met.', max:6 },
  { id:'pockets',name:'Deep Pockets',   desc:'Wagons and barges carry 8 more.', max:5 },
  { id:'wheels', name:'Quick Wheels',   desc:'Wagons and barges travel 15% faster.', max:4 },
  { id:'wood',   name:'Woodward’s Blessing', desc:'+25% timber.', max:4 },
  { id:'reed',   name:'Reed Song',      desc:'+25% reeds.', max:4 },
  { id:'clay',   name:'Potter’s Hands', desc:'+25% clay.', max:4 },
  { id:'craft',  name:'Fine Craft',     desc:'Lanterns and carvings sell for 15% more.', max:5 },
  { id:'hosts',  name:'Kind Hosts',     desc:'+20% pilgrims.', max:4 },
  { id:'reach',  name:'Wide Blessings', desc:'Statues, sheds, racks and charm reach 1 tile farther.', max:1 },
  { id:'tide',   name:'Long Tides',     desc:'A good tide lasts 15 seconds longer and climbs higher.', max:3 },
];
export const BOON = Object.fromEntries(BOONS.map(b=>[b.id,b]));

/* ---------- named sets: arrangements the village recognises ---------- */
export const SETS = [
  { id:'harbor',   name:'Harbor',            hint:'A jetty with a net shed and a drying rack close by.',        bonus:'Barges are paid 25% more.' },
  { id:'craft',    name:'Craft Quarter',     hint:'A workshop, a market stall and a clay pit within 3 tiles.',  bonus:'Lanterns and carvings sell for 20% more.' },
  { id:'garden',   name:'Lantern Garden',    hint:'Two stone lanterns, a flower bed and a cherry tree together.', bonus:'+15% pilgrims.' },
  { id:'lbridge',  name:'Lantern Bridge',    hint:'A bridge with two stone lanterns beside it.',                bonus:'Fishers on bridges reel 20% faster.' },
  { id:'walk',     name:'Shrine Walk',       hint:'A cobbled road beside the old shrine, lit by a stone lantern.', bonus:'Fish take the line 10% more often.' },
  { id:'row',      name:'Fisher’s Row',      hint:'Three piers side by side.',                                  bonus:'+10% scales from every fish met.' },
  { id:'harmony',  name:'Harmonious Village',hint:'A village of five or more huts, all in one style.',          bonus:'Market prices +20%.' },
  { id:'statues',  name:'Statue Garden',     hint:'Three different fish statues within 3 tiles of each other.', bonus:'+15% scales from every fish met.' },
];
export const SET = Object.fromEntries(SETS.map(s=>[s.id,s]));

/* ---------- orders from along the river ---------- */
export const ORDER_REGIONS = [
  { id:'birch',  name:'Birchmere Heights', route:'north', wants:['reeds','lanterns','timber'] },
  { id:'tarn',   name:'Hollow Tarn',       route:'north', wants:['timber','carvings','clay'] },
  { id:'ashfen', name:'The Ashfen',        route:'east',  wants:['timber','lanterns','carvings'] },
  { id:'salt',   name:'The Salt Mouth',    route:'east',  wants:['carvings','clay','lanterns'] },
];
