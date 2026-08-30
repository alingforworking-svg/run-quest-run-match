"use client";import dynamic from "next/dynamic";
const GameMap=dynamic(()=>import("./game-map").then(m=>m.GameMap),{ssr:false,loading:()=> <div className="skeleton min-h-[520px] rounded-[1.5rem]"/>});
export function GameMapLoader({worldId}:{worldId:string}){return <GameMap worldId={worldId}/>}
