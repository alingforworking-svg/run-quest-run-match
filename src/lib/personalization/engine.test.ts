import test from "node:test";
import assert from "node:assert/strict";
import { determineDailyPlayerState,generateDailyQuests,scoreQuestTemplate } from "./engine";
import { questTemplates } from "./templates";
import { seededRunnerDNA } from "./test-fixtures";
import { updateRunnerDNA } from "./runner-dna";
import type { BehaviorMetrics,PersonalizationContext } from "@/types/personalization";
const metrics:BehaviorMetrics={runsLast7Days:3,runsLast30Days:10,distanceLast7Days:14,distanceLast30Days:48,avgPaceLast30Days:390,avgDistanceLast30Days:4.8,questCompletionRate:.85,failedQuestRate:.05,abandonedRuns:0,socialRunRatio:.4,hardRunsLast7Days:0,daysSinceLastRun:1,mostUsedQuestType:"exploration",streakDays:5};
function context(dna=seededRunnerDNA.beginnerSocial,overrides:Partial<BehaviorMetrics>={}):PersonalizationContext{return{userId:"test-user",level:dna.experience==="advanced"?20:4,now:"2026-08-15T08:00:00.000Z",dna,metrics:{...metrics,...overrides},history:[],availabilityMinutes:dna.typicalRunDurationMinutes,currentWorld:"world-2"}}
test("same engine personalizes beginner and advanced users differently",()=>{const beginner=generateDailyQuests(context(seededRunnerDNA.beginnerSocial))[0],advanced=generateDailyQuests(context(seededRunnerDNA.advancedSpeed))[0];assert.notEqual(beginner.generatedTitle,advanced.generatedTitle);assert.ok(advanced.targetDistanceKm>beginner.targetDistanceKm);assert.ok(advanced.difficultyScore>=beginner.difficultyScore)});
test("returning players receive a gentle return quest",()=>{const c=context(seededRunnerDNA.returningExplorer,{daysSinceLastRun:21});assert.equal(determineDailyPlayerState(c),"RETURNING");assert.equal(generateDailyQuests(c)[0].questType,"returning")});
test("recovery state avoids hard quest stacking",()=>{const c=context(seededRunnerDNA.advancedSpeed,{hardRunsLast7Days:3});assert.equal(determineDailyPlayerState(c),"RECOVERY");assert.ok(generateDailyQuests(c).every(q=>q.difficulty<=3))});
test("daily generation is deterministic for the same user and day",()=>{const c=context();assert.deepEqual(generateDailyQuests(c),generateDailyQuests(c))});
test("cooldown prevents immediate template repetition",()=>{const c=context();const first=generateDailyQuests(c)[0];const next=generateDailyQuests({...c,history:[{templateId:first.templateId,status:"skipped",assignedAt:c.now,questType:first.questType,difficulty:first.difficulty}]})[0];assert.notEqual(first.templateId,next.templateId)});
test("actual behavior gradually outweighs onboarding distance",()=>{const dna=seededRunnerDNA.advancedSpeed,updated=updateRunnerDNA(dna,{...metrics,runsLast30Days:10,avgDistanceLast30Days:3.5,avgPaceLast30Days:420});assert.ok(updated.preferredDistanceKm<dna.preferredDistanceKm);assert.ok(updated.confidence.preferredDistanceKm>=.9)});
test("compatibility scoring returns a bounded percentage",()=>{const score=scoreQuestTemplate(questTemplates[0],context());assert.ok(score>=0&&score<=100)});
test("daily engine has at least thirty reusable templates",()=>assert.ok(questTemplates.length>=30));
