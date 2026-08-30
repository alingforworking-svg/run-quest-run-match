export const XP_RULES={perKm:100,checkpoint:50,questComplete:300,friendRun:150,daily:200,boss:2000} as const;
export const LEVEL_TITLES=[{level:1,title:"ROOKIE"},{level:5,title:"RUNNER"},{level:10,title:"EXPLORER"},{level:15,title:"CHALLENGER"},{level:20,title:"PACER"},{level:30,title:"CITY RUNNER"},{level:40,title:"ELITE"},{level:50,title:"LEGEND"}];
export const levelThreshold=(level:number)=>Math.round(500*Math.pow(level,1.42));
export const titleForLevel=(level:number)=>[...LEVEL_TITLES].reverse().find(t=>level>=t.level)?.title??"ROOKIE";
export function calculateXP(km:number,checkpoints:number,{friend=false,daily=false,boss=false}={}){return Math.round(km)*XP_RULES.perKm+checkpoints*XP_RULES.checkpoint+XP_RULES.questComplete+(friend?XP_RULES.friendRun:0)+(daily?XP_RULES.daily:0)+(boss?XP_RULES.boss:0)}
