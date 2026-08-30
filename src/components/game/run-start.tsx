"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle,Check,ChevronRight,LocateFixed,MapPin,Play,Route,ShieldCheck } from "lucide-react";
import { useGame } from "@/components/state/game-provider";
import { quests } from "@/data/game-content";
import { mainQuests } from "@/data/journey";
import { personalizeSeasonQuest } from "@/lib/season/engine";

export function RunStart(){
  const router=useRouter(),{state,startQuest}=useGame(),[gpsCheck,setGpsCheck]=useState<"idle"|"checking"|"insecure"|"denied"|"unavailable">("idle");
  const assignment=state.dailyQuests.find(q=>q.id===state.activeQuestId);
  const mainQuest=mainQuests.find(q=>q.id===state.activeQuestId)??mainQuests.find(q=>q.id===state.mainJourney.currentQuestId);
  const seasonQuest=state.activeQuestId?.startsWith("season-")?personalizeSeasonQuest(state.activeQuestId,state.runnerDNA):null;
  const selected=quests.find(q=>q.id===state.activeQuestId)??quests.find(q=>q.status==="active")??quests[6];
  const useMain=Boolean(!assignment&&!seasonQuest&&(!state.activeQuestId||mainQuests.some(q=>q.id===state.activeQuestId)));
  const distanceObjective=mainQuest?.objectives.find(o=>o.kind==="distance"),checkpointObjective=mainQuest?.objectives.find(o=>o.kind==="checkpoint");
  const routeId=assignment?.id??seasonQuest?.id??(useMain?mainQuest?.id:selected.id)??selected.id,title=assignment?.generatedTitle??seasonQuest?.name??(useMain?mainQuest?.name:selected.name)??selected.name,distance=assignment?.targetDistanceKm??seasonQuest?.distanceKm??(useMain?distanceObjective?.target:selected.distanceKm)??selected.distanceKm,checkpoints=assignment?.checkpointCount??seasonQuest?.checkpoints??(useMain?checkpointObjective?.target:selected.checkpoints.length)??selected.checkpoints.length,xp=assignment?.rewardXp??seasonQuest?.xpReward??(useMain?mainQuest?.xpReward:selected.xp)??selected.xp;
  function enterRun(){startQuest(routeId);router.push(`/run/${routeId}`)}
  function begin(){
    if(!window.isSecureContext){setGpsCheck("insecure");return}
    if(!navigator.geolocation){setGpsCheck("unavailable");return}
    setGpsCheck("checking");
    navigator.geolocation.getCurrentPosition(enterRun,error=>setGpsCheck(error.code===error.PERMISSION_DENIED?"denied":"unavailable"),{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  }
  const runStats=[[`${distance} KM`,"DISTANCE"],[checkpoints,"CHECKPOINTS"],[`+${xp}`,"XP"]];
  const problem=gpsCheck==="insecure"?"GPS REQUIRES HTTPS — this mobile Network URL uses HTTP.":gpsCheck==="denied"?"LOCATION IS BLOCKED — allow location in your browser settings.":gpsCheck==="unavailable"?"GPS SIGNAL IS UNAVAILABLE — move outdoors and try again.":null;
  return <div className="mobile-page mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-9"><div className="text-center"><span className="status-chip"><ShieldCheck size={14} className="text-[#59e0dc]"/>PRE-RUN CHECK</span><h1 className="game-title mt-4 text-4xl md:text-5xl">READY TO <span className="text-[#b6ff22]">RUN?</span></h1><p className="muted mx-auto mt-3 max-w-md text-xs leading-5">Your distance starts at 0.00 KM. It only increases from reliable GPS movement after you press Start.</p></div><section className="game-shape mt-6 overflow-hidden rounded-[2.2rem_2.2rem_1rem_2.2rem] border border-[#3b3b4b] bg-[#22222e]"><div className="border-b border-[#383847] p-5"><small className="text-[.52rem] font-black tracking-[.14em] text-[#a1a1b1]">SELECTED QUEST</small><h2 className="mt-2 text-xl font-black">{title}</h2><div className="mt-4 grid grid-cols-3 gap-2">{runStats.map(([value,label],index)=><span key={label} className={`rounded-2xl p-3 text-center ${index===0?"bg-[#b6ff22] text-[#171720]":index===1?"bg-[#7439ee] text-white":"bg-[#59e0dc] text-[#171720]"}`}><b className="block text-sm">{value}</b><small className="mt-1 block text-[.45rem] font-black opacity-65">{label}</small></span>)}</div></div><div className="grid gap-1 p-5">{[[LocateFixed,"ALLOW LOCATION","Required to measure real distance"],[MapPin,"WAIT FOR GPS","Start moving after GPS connects"],[Route,"RUN OUTDOORS","Open sky gives more accurate tracking"]].map(([Icon,title,detail],index)=>{const ItemIcon=Icon as typeof LocateFixed;return <div key={String(title)} className="flex items-center gap-3 py-2"><span className={`grid size-10 shrink-0 place-items-center rounded-full ${index===0?"bg-[#59e0dc] text-[#171720]":index===1?"bg-[#7439ee] text-white":"bg-[#b6ff22] text-[#171720]"}`}><ItemIcon size={18}/></span><span className="flex-1"><b className="block text-xs">{String(title)}</b><small className="mt-1 block text-[.55rem] text-[#a1a1b1]">{String(detail)}</small></span><Check size={17} className="text-[#59e0dc]"/></div>})}</div></section>{problem&&<div role="alert" className="mt-4 rounded-2xl border border-[#ff8157]/50 bg-[#2b1e24] p-4 text-center text-xs font-black leading-5 text-[#ff9b83]"><AlertTriangle className="mr-2 inline" size={16}/>{problem}</div>}<button onClick={begin} disabled={gpsCheck==="checking"} className="lime-button mt-4 w-full !min-h-16 !rounded-[1.7rem_1.7rem_.7rem_1.7rem] !text-sm disabled:opacity-60"><Play size={20} fill="currentColor"/>{gpsCheck==="checking"?"CHECKING GPS…":"START GPS TRACKING"}</button><Link href="/explore" className="ghost-button mt-3 w-full">CHOOSE ANOTHER QUEST <ChevronRight size={16}/></Link><p className="mt-4 text-center text-[.52rem] leading-4 text-[#a1a1b1]">For safety, prepare your route before starting. Location data is used only for run tracking and verification.</p></div>
}
