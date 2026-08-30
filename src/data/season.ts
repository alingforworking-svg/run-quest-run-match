import type { RankTier,RpRewardConfig,SeasonQuest } from "@/types/season";

const ranks:[string,string,string,number,string,string,string][]=[
 ["rookie","ROOKIE","",0,"#9b9bad","👟","rookie"],
 ["bronze-3","BRONZE","3",200,"#c47a44","🥉","rookie"],["bronze-2","BRONZE","2",400,"#c47a44","🥉","bronze-3"],["bronze-1","BRONZE","1",600,"#c47a44","🥉","bronze-3"],
 ["silver-3","SILVER","3",800,"#cbd1dc","🥈","bronze-3"],["silver-2","SILVER","2",1000,"#cbd1dc","🥈","bronze-3"],["silver-1","SILVER","1",1200,"#cbd1dc","🥈","bronze-3"],
 ["gold-3","GOLD","3",1400,"#ffd43b","🥇","silver-3"],["gold-2","GOLD","2",1700,"#ffd43b","🥇","silver-3"],["gold-1","GOLD","1",2000,"#ffd43b","🥇","silver-3"],
 ["platinum-3","PLATINUM","3",2300,"#59e0dc","💠","silver-3"],["platinum-2","PLATINUM","2",2700,"#59e0dc","💠","silver-3"],["platinum-1","PLATINUM","1",3100,"#59e0dc","💠","silver-3"],
 ["diamond-3","DIAMOND","3",3500,"#8ad9ff","💎","gold-3"],["diamond-2","DIAMOND","2",4000,"#8ad9ff","💎","gold-3"],["diamond-1","DIAMOND","1",4500,"#8ad9ff","💎","gold-3"],
 ["master-3","MASTER","3",5000,"#b388ff","👑","platinum-3"],["master-2","MASTER","2",5600,"#b388ff","👑","platinum-3"],["master-1","MASTER","1",6200,"#b388ff","👑","platinum-3"],
 ["legend","LEGEND","",7000,"#b6ff22","🏆","platinum-3"]
];
export const rankTiers:RankTier[]=ranks.map(([id,name,division,minRp,color,icon,softResetTo])=>({id,name:name as RankTier["name"],division:division?Number(division) as 1|2|3:null,minRp:Number(minRp),color,icon,softResetTo}));
export const rpRewards:RpRewardConfig={daily:100,bonus:40,weekly:200,season:150,social:50,checkpoint:50,boss:300,event:100,perfectWeek:100,newcomer:100,dailyCap:250};
export const seasonQuestBlueprints:SeasonQuest[]=[
 {id:"season-q1",order:1,name:"STARTER RUN",kind:"distance",boss:false,rpReward:150,xpReward:180},
 {id:"season-q2",order:2,name:"CHECKPOINT HUNT",kind:"checkpoint",boss:false,rpReward:150,xpReward:250},
 {id:"season-q3",order:3,name:"RUN TOGETHER",kind:"social",boss:false,rpReward:150,xpReward:300},
 {id:"season-q4",order:4,name:"MYSTERY ROUTE",kind:"exploration",boss:false,rpReward:150,xpReward:350},
 {id:"season-q5",order:5,name:"PERSONAL CHALLENGE",kind:"pace",boss:false,rpReward:150,xpReward:450},
 {id:"season-boss",order:6,name:"MONTHLY BOSS",kind:"boss",boss:true,rpReward:300,xpReward:800}
];
