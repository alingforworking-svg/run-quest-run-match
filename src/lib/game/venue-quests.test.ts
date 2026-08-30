import test from "node:test";import assert from "node:assert/strict";import {quests,runningVenues} from "@/data/game-content";
test("official quests use only the three Vientiane running venues",()=>{assert.equal(runningVenues.length,3);assert.deepEqual(new Set(quests.map(quest=>quest.venue?.id)),new Set(runningVenues.map(venue=>venue.id)))});
test("every official quest also offers an anywhere distance mode",()=>assert.ok(quests.every(quest=>quest.allowAnywhere&&quest.distanceKm>0)));
