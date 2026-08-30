import type { ObjectiveKind } from "@/types/progression";
import type { RunnerDNA } from "@/types/personalization";

export type RankName="ROOKIE"|"BRONZE"|"SILVER"|"GOLD"|"PLATINUM"|"DIAMOND"|"MASTER"|"LEGEND";
export type RpSource="daily"|"bonus"|"weekly"|"season"|"social"|"checkpoint"|"boss"|"event"|"perfect_week"|"newcomer";
export interface RankTier {id:string;name:RankName;division:null|1|2|3;minRp:number;color:string;icon:string;softResetTo:string}
export interface SeasonDefinition {id:string;number:number;name:string;monthLabel:string;startsAt:string;endsAt:string;badge:string;active:boolean}
export interface SeasonQuest {id:string;order:number;name:string;kind:ObjectiveKind;boss:boolean;rpReward:number;xpReward:number}
export interface PersonalizedSeasonQuest extends SeasonQuest {distanceKm:number;checkpoints:number;partySize:number;paceMinSecKm?:number;paceMaxSecKm?:number}
export interface RpTransaction {id:string;seasonId:string;source:RpSource;sourceId:string;amount:number;createdAt:string;verificationStatus:"verified"|"pending"|"rejected"}
export interface SeasonHistoryRecord {seasonId:string;label:string;finalRankTierId:string;highestRankTierId:string;finalRp:number;leaderboardPosition:number;distanceKm:number;questCompletions:number;bossCompleted:boolean;activeDays:number;badge?:string;endedAt:string}
export interface UserSeasonState {season:SeasonDefinition;rp:number;rankTierId:string;highestRankTierId:string;completedQuestIds:string[];currentQuestId:string;bossCompleted:boolean;pathCompleted:boolean;activeDates:string[];questCompletions:number;distanceKm:number;leaderboardPosition:number;startedAt:string;newcomerBonusClaimed:boolean;transactions:RpTransaction[]}
export interface RpRewardConfig {daily:number;bonus:number;weekly:number;season:number;social:number;checkpoint:number;boss:number;event:number;perfectWeek:number;newcomer:number;dailyCap:number}
export interface RpAwardInput {source:RpSource;sourceId:string;baseAmount:number;createdAt:string;verified:boolean;capExempt?:boolean}
export interface RpAwardResult {transactions:RpTransaction[];awarded:number;capped:number}
export interface FairnessProfile {id:string;dna:RunnerDNA;dailyCompletionRate:number;weeklyCompletionRate:number;activeDays:number}
