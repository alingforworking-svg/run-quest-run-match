import test from "node:test";import assert from "node:assert/strict";import {createPublicRoute,simplifyRoute} from "./public-route";
const line=Array.from({length:101},(_,index)=>({lat:17.96,lng:102.6+index*.0001}));
test("public route removes private start and finish segments",()=>{const route=createPublicRoute(line,150);assert.ok(route.length>=2);assert.ok(route[0].lng>line[0].lng);assert.ok(route.at(-1)!.lng<line.at(-1)!.lng)});
test("short routes are not publishable after privacy trimming",()=>assert.deepEqual(createPublicRoute(line.slice(0,15),150),[]));
test("route simplification preserves endpoints",()=>{const route=simplifyRoute(line,30);assert.deepEqual(route[0],line[0]);assert.deepEqual(route.at(-1),line.at(-1));assert.ok(route.length<line.length)});
