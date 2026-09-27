// Every fish in the valley. Gates: crew (fishers together), minWater (connected tiles), needD (distance from bank; width = needD*2-1).
export const SPECIES=[
 {id:'reed',name:'Reedling',ep:'The smallest thing in the river. Still longer than a rowboat.',len:1.15,wid:.2,hgt:.12,crew:1,minWater:0,needD:1,value:4,fight:12,w:10,speed:1.1,pattern:'reed',fin:'#b8c2a4',fins:.45,tail:.32},
 {id:'koi',name:'River Koi',ep:'Red on white, patient as the current.',len:2.1,wid:.23,hgt:.14,crew:1,minWater:0,needD:1,value:10,fight:20,w:7,speed:.9,pattern:'kohaku',fin:'#efe8dc',fins:.7,tail:.42},
 {id:'carp',name:'Stonebelly Carp',ep:'It drags the gravel as it feeds. You can hear it from the bank.',len:3.3,wid:.25,hgt:.16,crew:2,minWater:40,needD:1,value:34,fight:32,w:5,speed:.75,pattern:'bronze',fin:'#8a5f33',fins:.55,tail:.38},
 {id:'showa',name:'Ember Showa',ep:'Black lacquer and live coals. The water warms where it passes.',len:4.8,wid:.23,hgt:.14,crew:3,minWater:90,needD:1,value:100,fight:48,w:3.2,speed:.7,pattern:'showa',fin:'#231d1d',fins:.75,tail:.44,awe:true},
 {id:'sturgeon',name:'Mossback Sturgeon',ep:'Older than the first village. Moss grows on its back like a hillside.',len:6.6,wid:.15,hgt:.1,crew:5,minWater:130,needD:1,value:340,fight:75,w:2.1,speed:.55,pattern:'moss',fin:'#4b5a3c',fins:.4,tail:.34,awe:true},
 {id:'eel',name:'Lantern Eel',ep:'It carries its own light down into the deep channels.',len:7.8,wid:.07,hgt:.06,crew:6,minWater:170,needD:1,value:950,fight:95,w:1.3,speed:.6,pattern:'lantern',fin:'#2f4d8f',fins:0,tail:.12,eel:true,glow:'#8ff0ff',awe:true},
 {id:'moon',name:'Moonscale Koi',ep:'Seen once a generation, on nights the river runs silver.',len:9.6,wid:.23,hgt:.13,crew:8,minWater:230,needD:3,value:2800,fight:130,w:.8,speed:.5,pattern:'moon',fin:'#f3f6ff',fins:.8,tail:.46,glow:'#b9ccff',awe:true},
 {id:'warden',name:'The Valley Warden',ep:'The river was cut to fit it.',len:15,wid:.19,hgt:.1,crew:12,minWater:320,needD:4,value:13000,fight:200,w:.35,speed:.38,pattern:'warden',fin:'#173634',fins:.6,tail:.4,glow:'#ffc861',awe:true},
];
export const SP=Object.fromEntries(SPECIES.map(s=>[s.id,s]));
