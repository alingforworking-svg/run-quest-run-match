export type ObjectiveKind="distance"|"pace"|"checkpoint"|"social"|"party"|"time"|"streak"|"exploration"|"boss"|"community";
export type ProgressionSource="main"|"season"|"daily"|"weekly"|"event";
export interface RunObjective {id:string;source:ProgressionSource;sourceId:string;kind:ObjectiveKind;target:number;paceMinSecKm?:number;paceMaxSecKm?:number;xpReward:number;required?:boolean}
export interface ObjectiveRun {distanceKm:number;elapsedSeconds:number;paceSecKm:number|null;checkpoints:number;partySize:number;exploredNewRoute:boolean;verified:boolean;completedAt:string}
export interface ObjectiveResult {objectiveId:string;source:ProgressionSource;sourceId:string;completed:boolean;progress:number;xpAwarded:number}
export interface MainQuestDefinition {id:string;worldId:string;order:number;name:string;description:string;boss:boolean;objectives:Omit<RunObjective,"source"|"sourceId">[];xpReward:number;badge?:string;routeQuestId:string}
export interface JourneyWorld {id:string;number:number;name:string;theme:string;color:string;badge:string;quests:MainQuestDefinition[]}
export interface MainJourneyProgress {completedQuestIds:string[];currentQuestId:string;bossesCompleted:number;startedAt:string;completedAt:null|string;totalJourneySeconds?:number;mainJourneyCompleted:boolean;endGameUnlocked:boolean;finalLevel?:number;finalDistanceKm?:number;finalBadge?:string}
export interface WeeklyChallenge {id:string;weekKey:string;title:string;targetKm:number;progressKm:number;xpReward:number;completed:boolean;claimed:boolean}
export interface SpecialEvent {id:string;title:string;distanceKm:number;joinedRunners:number;endsAt:string;xpReward:number;badge:string;active:boolean}
export interface ProgressionEvaluation {results:ObjectiveResult[];completedMainQuestIds:string[];completedSeasonQuestIds:string[];dailyCompleted:boolean;weeklyCompleted:boolean;eventCompletedIds:string[];totalXp:number}
