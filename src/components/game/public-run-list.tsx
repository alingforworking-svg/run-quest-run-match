"use client";

import {MapPin,Users} from "lucide-react";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {useGame} from "@/components/state/game-provider";
import {useRunSpots} from "@/hooks/use-run-spots";

export function PublicRunList(){
  const [joining,setJoining]=useState("");
  const router=useRouter(),{notify}=useGame(),{spots,viewerId,joinSpot}=useRunSpots();
  async function openRun(id:string){setJoining(id);try{const partyId=await joinSpot(id);router.push(`/party/${partyId}`)}catch(runError){notify(runError instanceof Error?runError.message:"Could not join this run");setJoining("")}}
  if(!spots.length)return null;
  return <section className="mt-9"><div className="flex items-end justify-between"><span><p className="text-[.52rem] font-black tracking-[.16em] text-[#b7ff22]">PUBLIC MAP MEETUPS</p><h2 className="game-title mt-1 text-3xl">RUNS READY TO JOIN</h2></span><small className="text-[.5rem] font-black text-[#85899b]">{spots.length} LIVE</small></div><div className="scrollbar-none mt-3 flex snap-x gap-3 overflow-x-auto pb-2">{spots.map(spot=>{const own=spot.ownerId===viewerId,full=spot.joinCount>=spot.maxMembers;return <article key={spot.id} className="panel min-w-[84%] snap-start overflow-hidden p-4 sm:min-w-[320px] md:min-w-[360px]"><div className="flex gap-3"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#7c42ff] text-3xl">{spot.ownerAvatar}</span><span className="min-w-0 flex-1"><small className="block text-[.48rem] font-black tracking-wider text-[#b7ff22]">HOSTED BY {spot.ownerName.toUpperCase()}</small><b className="mt-1 block truncate text-sm">{spot.title}</b><span className="mt-1 flex items-center gap-1 text-[.52rem] text-[#8f93a5]"><MapPin size={11}/>{spot.distanceKm} KM MEETUP</span></span></div><div className="mt-4 flex items-center justify-between rounded-xl bg-[#1a1c2b] px-3 py-2"><span className="flex items-center gap-2 text-[.55rem] font-black"><Users size={14} color="#b7ff22"/>{spot.joinCount} / {spot.maxMembers} RUNNERS</span><span className="text-[.46rem] font-black text-[#59e0dc]">LIVE 24H</span></div><button disabled={joining===spot.id||(full&&!spot.joined)} onClick={()=>void openRun(spot.id)} className="lime-button mt-3 w-full !min-h-11 disabled:opacity-40">{joining===spot.id?"OPENING…":own?"MANAGE PARTY":spot.joined?"OPEN PARTY":full?"PARTY FULL":"JOIN THIS RUN"}</button></article>})}</div></section>
}
