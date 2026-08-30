import type { Quest, RunningVenue, World } from "@/types/game";

export const runningVenues:RunningVenue[]=[
  {id:"that-luang-lake",name:"THAT LUANG LAKE",laoName:"ບຶງທາດຫຼວງ",lat:17.9518416,lng:102.6580458,radiusMeters:850},
  {id:"pha-that-luang",name:"PHA THAT LUANG",laoName:"ພະທາດຫຼວງ",lat:17.9766636,lng:102.6364902,radiusMeters:550},
  {id:"patuxai",name:"PATUXAI",laoName:"ປະຕູໄຊ",lat:17.9700251,lng:102.6179938,radiusMeters:500},
];

export const worlds: World[] = [
  { id:"world-1",number:1,name:"FIRST STEPS",subtitle:"Find your rhythm",color:"#aaf000",progress:0 },
  { id:"world-2",number:2,name:"CITY EXPLORER",subtitle:"Play the streets",color:"#6c2cff",progress:0 },
  { id:"world-3",number:3,name:"RUN TOGETHER",subtitle:"Build your party",color:"#31b7ff",progress:0 },
  { id:"world-4",number:4,name:"NIGHT RUNNER",subtitle:"Own the night",color:"#9b6cff",progress:0 },
  { id:"world-5",number:5,name:"SPEED ZONE",subtitle:"Break your limits",color:"#ff8656",progress:0 },
  { id:"world-6",number:6,name:"TEAM QUEST",subtitle:"Win together",color:"#ffd43b",progress:0 },
];

const questNames = [
  ["First Step","easy",1,100],["Park Loop","easy",2,200],["3K Challenge","medium",3,350],["First Steps Boss","boss",5,1000],
  ["Checkpoint Hop","easy",3.2,300],["Five K Flow","medium",5,500],["Mekong Night Quest","night",6.2,650],["Mystery Drop","mystery",4,700],["City Boss Run","boss",10,2000],
  ["Find Your Pace","team",3,450],["Social Sprint","team",5,600],["Three Runner Relay","team",6,850],["Party Builder","reward",4,700],
  ["Moonlight Mile","night",1.6,250],["Lantern Run","night",5,650],["Midnight Checkpoints","hard",8,1000],["Night Boss","boss",10,2000],
  ["Tempo Spark","medium",4,500],["Fast Five","hard",5,800],["Negative Split","hard",8,1200],["PR Hunter","reward",10,1500],
  ["Squad 5K","team",5,800],["City Relay","team",12,1400],["Checkpoint Crew","team",8,1100],["Team Boss","boss",15,2500],
] as const;

export const quests: Quest[] = questNames.map((q,index) => {
  const worldIndex = index < 4 ? 0 : index < 9 ? 1 : index < 13 ? 2 : index < 17 ? 3 : index < 21 ? 4 : 5;
  const venue = runningVenues[index%runningVenues.length],center=[venue.lat,venue.lng],loopRadius=venue.id==="that-luang-lake"?.0032:.0022;
  const count = Math.max(2, Math.min(8, Math.round(Number(q[2]) / 1.4)));
  return {
    id:`quest-${index+1}`,worldId:`world-${worldIndex+1}`,name:String(q[0]).toUpperCase(),type:q[1] as Quest["type"],
    status:"available",
    description:index===6?"Chase the city lights along the Mekong. Unlock every checkpoint before midnight.":"Turn a real city route into your next playable adventure.",
    distanceKm:Number(q[2]),durationMinutes:Math.round(Number(q[2])*7),pace:index>16?"5:00–6:00":"6:00–7:00",difficulty:Math.min(5,1+worldIndex),xp:Number(q[3]),
    badge:q[1]==="boss"?`${worlds[worldIndex].name} CHAMPION`:index===6?"NIGHT EXPLORER":undefined,
    requirements:q[1]==="boss"?`Complete 80% of ${worlds[worldIndex].name}`:undefined,venue,allowAnywhere:true,
    checkpoints:Array.from({length:count},(_,i)=>{const angle=2*Math.PI*i/count;return{id:`q${index+1}-cp${i+1}`,name:i===0?`${venue.name} START`:i===count-1?"FINISH GATE":`CHECKPOINT ${String(i+1).padStart(2,"0")}`,order:i+1,radiusMeters:65,revealed:q[1]!=="mystery"||i===0,lat:center[0]+Math.cos(angle)*loopRadius,lng:center[1]+Math.sin(angle)*loopRadius}}),
  };
});

export const achievements = ["FIRST RUN","5K FINISHER","10K FINISHER","NIGHT EXPLORER","TEAM PLAYER","CITY EXPLORER","EARLY BIRD","50 KM CLUB","100 KM CLUB","BOSS HUNTER","CITY LEGEND"];
export const activeQuest = quests[6];
