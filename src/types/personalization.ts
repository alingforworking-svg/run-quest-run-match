export type RunnerArchetype = "SOCIAL RUNNER"|"CITY EXPLORER"|"SPEED HUNTER"|"CONSISTENCY BUILDER"|"NIGHT RUNNER"|"ENDURANCE RUNNER"|"ALL-ROUNDER";
export type DailyPlayerState = "NORMAL"|"RECOVERY"|"RETURNING"|"ACTIVE"|"HIGH_ACTIVITY"|"READY_FOR_CHALLENGE";
export type QuestAssignmentType = "primary"|"bonus"|"recovery"|"community";
export type QuestAssignmentStatus = "assigned"|"accepted"|"completed"|"failed"|"skipped"|"expired";

export interface RunnerDNA {
  experience: "beginner"|"intermediate"|"advanced";
  avgPaceSecPerKm: number;
  preferredDistanceKm: number;
  difficultyTier: number;
  goal: "health"|"consistency"|"speed"|"exploration"|"social"|"competition"|"fun";
  preferredTime: "morning"|"afternoon"|"evening"|"night";
  preferredQuestTypes: string[];
  socialScore: number;
  competitiveScore: number;
  explorationScore: number;
  consistencyScore: number;
  weeklyTargetRuns: number;
  typicalRunDurationMinutes: number;
  recentActivityLevel: number;
  recoveryNeed: number;
  streakBehavior: number;
  questCompletionRate: number;
  confidence: Record<string,number>;
  archetype: RunnerArchetype;
  updatedAt: string;
}

export interface RunnerQuestionnaire {
  frequency: "starting"|"1-2"|"3-4"|"5+";
  comfortableDistance: "1-3"|"3-5"|"5-10"|"10+";
  pace: "unknown"|"8+"|"7-8"|"6-7"|"5-6"|"under-5";
  goal: RunnerDNA["goal"];
  preferredTime: RunnerDNA["preferredTime"];
  social: "solo"|"sometimes"|"often"|"meet";
  style: "casual"|"fitness"|"social"|"competitive"|"adventure";
  availabilityMinutes: number;
}

export interface BehaviorMetrics {
  runsLast7Days:number; runsLast30Days:number; distanceLast7Days:number; distanceLast30Days:number;
  avgPaceLast30Days:number|null; avgDistanceLast30Days:number|null; questCompletionRate:number;
  failedQuestRate:number; abandonedRuns:number; socialRunRatio:number; hardRunsLast7Days:number;
  daysSinceLastRun:number|null; mostUsedQuestType:string; streakDays:number;
}

export interface QuestTemplate {
  templateId:string; titleVariants:string[]; type:string; difficulty:number; minLevel:number;
  distanceRangeKm:[number,number]; xpBase:number; social:boolean; community?:boolean;
  checkpointRange:[number,number]; durationRangeMinutes:[number,number]; goals:RunnerDNA["goal"][];
  preferredTimes?:RunnerDNA["preferredTime"][]; cooldownDays:number; pacePressure:"none"|"light"|"target";
}

export interface QuestAssignment {
  id:string; templateId:string; generatedTitle:string; questType:string; difficulty:number; difficultyScore:number;
  targetDistanceKm:number; targetPaceSecPerKm:number|null; checkpointCount:number; rewardXp:number;
  partySize:[number,number]|null; assignmentType:QuestAssignmentType; assignedAt:string; expiresAt:string;
  status:QuestAssignmentStatus; personalizationScore:number; why:string[]; generationMetadata:Record<string,unknown>;
}

export interface QuestHistoryItem {templateId:string;status:QuestAssignmentStatus;assignedAt:string;completedAt?:string;questType:string;difficulty:number}
export interface PersonalizationContext {userId:string;level:number;now:string;dna:RunnerDNA;metrics:BehaviorMetrics;history:QuestHistoryItem[];availabilityMinutes:number;currentWorld:string;excludedTemplateIds?:string[]}
