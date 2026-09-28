// Folklore of the valley. Each fish has a rumor (before you meet it), a few fixed facts, and three tales
// that the village learns as the fish is met again and again. Tales are also what draws pilgrims.
export const TALE_AT = [1, 4, 12]; // meetings needed to learn tale 1, 2 and 3

export const LORE = {
  reed: {
    rumor: 'Children say the reeds move even on still days. They are not wrong.',
    age: 'a few summers', temper: 'Restless', favors: 'Shallow reed beds',
    tales: [
      'Reedlings are the first thing a new fisher meets. The old ones say this is on purpose: the river sends something small to see if your hands are gentle.',
      'A Reedling released at dawn swims three circles before it leaves. Mothers in Deepvale count the circles aloud, one for each child in the house.',
      'When the valley flooded in the Year of Two Moons, the Reedlings swam into the village and waited in the streets. When the water fell, not one was left behind in a puddle. Nobody knows how they knew.',
    ],
  },
  koi: {
    rumor: 'A flash of red under the ferry rope. The ferrymen tip their hats to it.',
    age: 'thirty winters or more', temper: 'Patient', favors: 'Slow bends',
    tales: [
      'Each River Koi carries a different red map on its back. Weavers copy them into cloth, and no two blankets in the valley are the same.',
      'Koi remember faces. A fisher who was kind to one will find it waiting by the same stone the next spring.',
      'The first village was built where a koi stopped swimming. The settlers took it as a sign the water there was good. They were right: that spring still runs under the well.',
    ],
  },
  carp: {
    rumor: 'Something down there turns the gravel over at night. You can hear it from bed.',
    age: 'older than the mill', temper: 'Stubborn', favors: 'Gravel runs',
    tales: [
      'The Stonebelly Carp swallows river stones and keeps them for years. When one is released, it sometimes leaves a smooth stone on the bank as thanks.',
      'Millers used to curse the carp for shifting the riverbed. Then a dry summer came, and the only deep pools left were the ones the carp had dug.',
      'Lay a carp stone under your doorstep and your house will never flood. Every house in the valley has one. Most were given, never taken.',
    ],
  },
  showa: {
    rumor: 'On cold mornings a thread of steam walks up the river, against the wind.',
    age: 'unknown; it does not seem to age', temper: 'Proud', favors: 'Deep, dark runs',
    tales: [
      'The Ember Showa is said to have swum up from the Ashfen, far downstream, where the ground itself is warm. It carried a coal in its belly the whole way, and never let it go out.',
      'In the hard winter the river froze everywhere except behind the Showa. The village cut a channel to follow it, and fished beside it until spring. Nobody went hungry.',
      'Ember Showa do not die. When one grows old it swims back to the Ashfen and settles into the warm mud, and a new coal glows there. The fen is full of them, sleeping.',
    ],
  },
  sturgeon: {
    rumor: 'A mossy log in the deep channel. It moves upstream.',
    age: 'older than the first village', temper: 'Solemn', favors: 'Cold, wide channels',
    tales: [
      'Ferns grow on the Mossback Sturgeon, and small snails live in the ferns. It is its own little island, and it has never once hurried.',
      'The sturgeon is the valley’s rememberer. The elders believe that if every fisher left, the Mossback would still know every name that was ever called across the water.',
      'Once a century the Mossback rests in the shallows for a whole day. The village stops work and sits on the bank with it. It is the quietest day there is.',
    ],
  },
  eel: {
    rumor: 'Lanterns in the water where no one has lit any.',
    age: 'as old as the channels', temper: 'Curious', favors: 'Deep, narrow channels',
    tales: [
      'Lantern Eels light the way for fish that have lost the current. On nights they are about, stranded fry are always found back in the main river by morning.',
      'Lamplighters in the valley leave one window unlit so the eels will not feel outshone. It is considered bad manners to argue about this.',
      'When a fisher dies, the Lantern Eels gather under the bridge nearest their house and glow until dawn. The village calls it the long lamp.',
    ],
  },
  moon: {
    rumor: 'On clear nights the river runs silver, then something turns in it.',
    age: 'a generation between sightings', temper: 'Shy', favors: 'Open, quiet water',
    tales: [
      'The Moonscale Koi only rises where the water is wide enough to hold the moon. That is why the old fishers dug the pools so broad.',
      'Its scales are not white but full of tiny moons, each at a different phase. Children who find a shed one keep it for luck and check which moon it shows.',
      'The Moonscale is the Warden’s child, or its dream, or its promise. The stories disagree. They all agree it is not ours to keep.',
    ],
  },
  warden: {
    rumor: 'The river was cut to fit something. The old maps show it curling where no river should.',
    age: 'as old as the valley', temper: 'Watchful', favors: 'The whole river',
    tales: [
      'Long ago the mountain let go of a wide cold lake, and the Warden swam the flood down to the valley and carved the river with its body. Every bend is a place it turned.',
      'The gold lines on its back are roads. Fishers who have met it swear they are the valley’s roads, drawn before anyone walked them.',
      'Once in a hundred years the Warden swims downstream to the Salt Mouth, and the river runs backward for a night to let it pass. When it returns, the valley has a new name for everything.',
    ],
  },
};

export const VILLAGE_NAMES = ['Reedmoor','Lowlantern','Stillford','Carpsend','Mossbank','Emberhythe','Ferrywick','Silverbend','Brackenholm','Tallow Cross','Kettlewade','Duskmere'];

// The macro view: the river's course through regions. Only Deepvale is playable for now.
export const REGIONS = [
  { id:'tarn', name:'Hollow Tarn', biome:'Glacier lake', x:.14, y:.2,
    teaser:'Where the river is born under blue ice. The Warden came down from here in the first flood.', lock:'Not yet charted. The mountain pass is snowed in.' },
  { id:'deepvale', name:'Deepvale', biome:'Mountain valley', x:.36, y:.44, here:true,
    teaser:'A wooded valley at the mountain’s foot. The river keeps its giants here.' },
  { id:'birch', name:'Birchmere Heights', biome:'Birch highlands', x:.6, y:.2,
    teaser:'A cold tributary through white birch and heather. Pilgrims arrive from here with bells on their packs.', lock:'Not yet charted. Rumored to open once a village has been named.' },
  { id:'ashfen', name:'The Ashfen', biome:'Warm marsh', x:.66, y:.66,
    teaser:'Black mud that breathes steam. Ember Showa sleep in the warm pools, and the reeds never freeze.', lock:'Not yet charted. The Ember Showa knows the way.' },
  { id:'salt', name:'The Salt Mouth', biome:'Estuary', x:.9, y:.82,
    teaser:'Where the river meets the sea. The Warden swims here once a century, and the tide waits for it.', lock:'Not yet charted. Somewhere far downstream.' },
];
