// Every fish in the valley. Gates: crew (fishers together), minWater (connected tiles), needD (distance from bank; width = needD*2-1). minWater counts flowing tiles only.
export const SPECIES=[
 {id:'reed',name:'Reedling',ep:'The smallest thing in the river. Still longer than a rowboat.',len:1.15,wid:.2,hgt:.12,crew:1,minWater:0,needD:1,value:4,fight:12,w:10,speed:1.1,pattern:'reed',fin:'#b8c2a4',fins:.45,tail:.32},
 {id:'koi',name:'River Koi',ep:'Red on white, patient as the current.',len:2.1,wid:.23,hgt:.14,crew:1,minWater:0,needD:1,value:10,fight:20,w:7,speed:.9,pattern:'kohaku',fin:'#efe8dc',fins:.7,tail:.42},
 {id:'carp',name:'Stonebelly Carp',ep:'It drags the gravel as it feeds. You can hear it from the bank.',len:3.3,wid:.25,hgt:.16,crew:2,minWater:60,needD:1,value:34,fight:32,w:5,speed:.75,pattern:'bronze',fin:'#8a5f33',fins:.55,tail:.38},
 {id:'showa',name:'Ember Showa',ep:'Black lacquer and live coals. The water warms where it passes.',len:4.8,wid:.23,hgt:.14,crew:3,minWater:170,needD:1,value:100,fight:48,w:3.2,speed:.7,pattern:'showa',fin:'#231d1d',fins:.75,tail:.44,glow:'#ff8a4a',steam:true,awe:true},
 {id:'sturgeon',name:'Mossback Sturgeon',ep:'Older than the first village. Moss grows on its back like a hillside.',len:6.6,wid:.15,hgt:.1,crew:5,minWater:220,needD:1,value:340,fight:75,w:2.1,speed:.55,pattern:'moss',fin:'#4b5a3c',fins:.4,tail:.34,glow:'#8fe06a',awe:true},
 {id:'eel',name:'Lantern Eel',ep:'It carries its own light down into the deep channels.',len:7.8,wid:.07,hgt:.06,crew:6,minWater:270,needD:1,value:950,fight:95,w:1.3,speed:.6,pattern:'lantern',fin:'#2f4d8f',fins:0,tail:.12,eel:true,glow:'#8ff0ff',awe:true},
 {id:'moon',name:'Moonscale Koi',ep:'Seen once a generation, on nights the river runs silver.',len:9.6,wid:.23,hgt:.13,crew:8,minWater:330,needD:3,value:2800,fight:130,w:.8,speed:.5,pattern:'moon',fin:'#f3f6ff',fins:.8,tail:.46,glow:'#b9ccff',awe:true,minHealth:50,night:true},
 {id:'warden',name:'The Valley Warden',ep:'The river was cut to fit it.',len:15,wid:.19,hgt:.1,crew:12,minWater:420,needD:4,value:13000,fight:200,w:.35,speed:.38,pattern:'warden',fin:'#173634',fins:.6,tail:.4,glow:'#ffc861',awe:true,minHealth:70},
];
// The Salt Mouth, where the river meets the sea. tide: 'low' or 'high' — it only surfaces at that water.
// The Lantern Eel follows the river all the way down, so it is met in both valleys.
export const SALT_SPECIES=[
 {id:'smelt',name:'Silver Smelt',ep:'A sliver of light in the brackish water. It smells, faintly, of cucumber.',len:1.05,wid:.17,hgt:.11,crew:1,minWater:0,needD:1,value:5,fight:12,w:10,speed:1.25,pattern:'smelt',fin:'#c9d6d8',fins:.45,tail:.34},
 {id:'flounder',name:'Mudflat Flounder',ep:'It lies on the bottom with both eyes on top, and waits for the water to go out.',len:2,wid:.46,hgt:.05,crew:1,minWater:0,needD:1,value:14,fight:22,w:7,speed:.6,pattern:'flounder',fin:'#8a7a5a',fins:.2,tail:.3,tide:'low'},
 {id:'mullet',name:'Grey Mullet',ep:'It leaps for no reason anyone has found. Three times, then gone.',len:3.1,wid:.2,hgt:.14,crew:2,minWater:120,needD:1,value:36,fight:30,w:5,speed:.85,pattern:'mullet',fin:'#5f6b70',fins:.5,tail:.4},
 {id:'bass',name:'Tidewater Bass',ep:'Barred like the light through a jetty. It rides the turn of the tide upriver.',len:4.5,wid:.22,hgt:.15,crew:3,minWater:300,needD:1,value:110,fight:46,w:3,speed:.75,pattern:'bass',fin:'#3c4a52',fins:.6,tail:.42,glow:'#9fe8ff',awe:true},
 SPECIES.find(s=>s.id==='eel'),
 {id:'silverking',name:'The Silver King',ep:'Scales like a mirror the size of a hand. It comes in with the high water and leaves with it.',len:8.6,wid:.2,hgt:.13,crew:7,minWater:420,needD:2,value:2400,fight:120,w:.9,speed:.6,pattern:'silverking',fin:'#d5dde4',fins:.6,tail:.48,glow:'#e8f4ff',awe:true,tide:'high'},
 {id:'mother',name:'The Salt Mother',ep:'Every fish in the river was hatched within a day’s swim of her.',len:16,wid:.24,hgt:.1,crew:12,minWater:540,needD:4,value:15000,fight:210,w:.3,speed:.36,pattern:'mother',fin:'#1d3a40',fins:.7,tail:.42,glow:'#7fffe0',awe:true,minHealth:60,tide:'high'},
];
export const SP=Object.fromEntries([...SPECIES,...SALT_SPECIES].map(s=>[s.id,s]));
