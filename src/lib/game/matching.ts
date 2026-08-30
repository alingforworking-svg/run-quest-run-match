import type { QuestType, Runner } from "@/types/game";

export interface MatchInput { paceMinKm:number; distanceKm:number; time:string; experience:string; style:string; questType:QuestType; maxRadiusKm:number }
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function calculateMatch(input:MatchInput,runner:Runner){
  const pace=clamp(1-Math.abs(input.paceMinKm-runner.paceMinKm)/2);
  const distance=input.distanceKm>=runner.distanceRange[0]&&input.distanceKm<=runner.distanceRange[1]?1:.4;
  const availability=runner.availableTimes.includes(input.time)?1:.25;
  const location=clamp(1-runner.distanceAwayKm/input.maxRadiusKm);
  const experience=runner.experience===input.experience?1:.65;
  const style=runner.style===input.style?1:.55;
  const quest=runner.questTypes.includes(input.questType)?1:.6;
  const score=pace*.30+distance*.20+availability*.20+location*.15+experience*.10+(style*.5+quest*.5)*.05;
  return Math.round(score*100);
}
