import assert from "node:assert/strict";
import test from "node:test";
import { verifyRun } from "./verification";

test("a run without enough GPS samples is not verified",()=>{
  const result=verifyRun([]);
  assert.equal(result.verified,false);
  assert.equal(result.score,60);
  assert.deepEqual(result.flags,["Insufficient GPS samples"]);
});

test("plausible GPS movement is verified and measured",()=>{
  const result=verifyRun([
    {lat:17.9757,lng:102.6331,timestamp:0,accuracy:8},
    {lat:17.9762,lng:102.6331,timestamp:60_000,accuracy:8},
    {lat:17.9767,lng:102.6331,timestamp:120_000,accuracy:8},
  ]);
  assert.equal(result.verified,true);
  assert.ok(result.stats.distanceKm>0.1);
  assert.equal(result.stats.jumpCount,0);
});
