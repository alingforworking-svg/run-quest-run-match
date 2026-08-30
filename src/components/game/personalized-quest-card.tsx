"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight,ChevronDown,Dna,HelpCircle,RefreshCw,Target,Users,X,Zap } from "lucide-react";
import { useGame } from "@/components/state/game-provider";
const reasons=["Too hard","Too easy","Not enough time","Want social quest","Want solo quest","Different activity"];
const pace=(seconds:number|null)=>seconds?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")} / KM`:"NO PACE PRESSURE";
export function PersonalizedQuestCard(){
  const {state,ensureDailyQuests,swapDailyQuest,acceptPersonalQuest}=useGame(),router=useRouter();
  const [expanded,setExpanded]=useState(false),[why,setWhy]=useState(false),[swap,setSwap]=useState(false);
  useEffect(()=>ensureDailyQuests(),[]);
  const quest=state.dailyQuests.find(q=>q.assignmentType==="primary");
  if(!quest)return <div className="panel h-24 animate-pulse"/>;
  function start(){if(!quest)return;acceptPersonalQuest(quest.id);router.push("/run")}
  const stats=[["DISTANCE",`${quest.targetDistanceKm} KM`],["CHECKPOINTS",String(quest.checkpointCount)],["PACE",pace(quest.targetPaceSecPerKm)],["REWARD",`+${quest.rewardXp} XP`]];
  return <section className="game-shape relative overflow-hidden rounded-[1.6rem_1.6rem_.8rem_1.6rem] border border-[#8454ef] bg-[#7439ee] p-3 md:p-4">
    <Zap className="pointer-events-none absolute -bottom-10 -right-7 size-40 text-[#b6ff22] opacity-[.1]"/>
    <button type="button" aria-expanded={expanded} aria-controls="personalized-quest-details" onClick={()=>setExpanded(value=>!value)} className="relative flex min-h-16 w-full items-center gap-3 rounded-[1.15rem] px-2 py-2 text-left transition hover:bg-white/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b6ff22]">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#b6ff22] text-[#171720]"><Zap size={19} fill="currentColor"/></span>
      <span className="min-w-0 flex-1"><small className="block text-[.48rem] font-black tracking-[.13em] text-[#d9caff]">TODAY&apos;S RECOMMENDED QUEST</small><b className="mt-1 block truncate text-sm text-white md:text-base">{quest.generatedTitle}</b><small className="mt-1 block text-[.5rem] font-black text-[#d9caff]">{quest.targetDistanceKm} KM • +{quest.rewardXp} XP</small></span>
      <span className="shrink-0 text-center"><b className="block rounded-full bg-[#b6ff22] px-2.5 py-1.5 text-[.65rem] text-[#171720]">{quest.personalizationScore}%</b><ChevronDown size={18} className={`mx-auto mt-1 text-white transition-transform duration-300 ${expanded?"rotate-180":""}`}/></span>
    </button>
    <div id="personalized-quest-details" className={`relative grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded?"grid-rows-[1fr] opacity-100":"grid-rows-[0fr] opacity-0"}`}>
      <div className="min-h-0 overflow-hidden">
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{stats.map((x,index)=><span key={x[0]} className={`rounded-2xl p-3 ${index===0?"bg-[#b6ff22] text-[#171720]":index===1?"bg-[#59e0dc] text-[#171720]":"bg-[#262532] text-white"}`}><small className="block text-[.45rem] font-black opacity-65">{x[0]}</small><b className="mt-1.5 block text-[.68rem]">{x[1]}</b></span>)}</div>
        {quest.partySize&&<p className="mt-4 flex items-center gap-2 text-[.58rem] font-black text-[#e0d6fa]"><Users size={14} className="text-[#b6ff22]"/>SOCIAL QUEST • PARTY {quest.partySize[0]}–{quest.partySize[1]}</p>}
        <button onClick={start} className="lime-button mt-5 w-full">REVIEW &amp; START RUN <ArrowRight size={15}/></button>
        <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setWhy(true)} className="ghost-button !min-h-11 !border-white/15 !bg-black/15"><HelpCircle size={15}/>WHY THIS?</button><button disabled={state.dailySwapsUsed>=3} onClick={()=>setSwap(true)} className="ghost-button !min-h-11 !border-white/15 !bg-black/15 disabled:opacity-40"><RefreshCw size={15}/>CHANGE {state.dailySwapsUsed}/3</button></div>
      </div>
    </div>
    {why&&<Modal title="WHY THIS QUEST?" close={()=>setWhy(false)}><div className="grid gap-3">{quest.why.map(x=><p key={x} className="flex gap-2 text-xs text-[#c7c7d2]"><span className="text-[#b6ff22]">✓</span>{x}</p>)}</div></Modal>}
    {swap&&<Modal title="CHANGE QUEST" close={()=>setSwap(false)}><p className="muted mb-4 text-xs">Tell us what should change.</p><div className="grid gap-2">{reasons.map(r=><button key={r} onClick={()=>{swapDailyQuest(r);setSwap(false)}} className="light-field flex h-11 items-center rounded-xl border px-4 text-left text-xs font-black hover:border-[#7439ee]">{r}</button>)}</div></Modal>}
  </section>
}
export function RunnerDnaSummary(){const {state}=useGame(),d=state.runnerDNA;return <div className="panel flex items-center gap-3 p-4"><span className="grid size-12 place-items-center rounded-xl bg-[#7c42ff] text-[#b7ff22]"><Dna/></span><span className="flex-1"><small className="block text-[.48rem] font-black text-[#7f8396]">YOUR RUNNER DNA</small><b className="mt-1 block text-sm">{d.archetype}</b><small className="mt-1 block text-[.52rem] text-[#8e92a5]">{d.preferredDistanceKm} KM • {d.preferredTime.toUpperCase()} • TIER {d.difficultyTier}</small></span><Target className="text-[#b7ff22]"/></div>}
export function PersonalBonusQuests(){const {state,acceptPersonalQuest}=useGame(),items=state.dailyQuests.filter(q=>q.assignmentType!=="primary");return <div className="grid gap-3">{items.map(q=><article key={q.id} className={`panel p-4 ${q.assignmentType==="recovery"?"border-[#55df6a]":""}`}><div className="flex items-center justify-between"><span><small className="block text-[.48rem] font-black text-[#7f8396]">{q.assignmentType.toUpperCase()} QUEST</small><b className="mt-1 block text-xs">{q.generatedTitle}</b></span><b className="text-xs text-[#b7ff22]">+{q.rewardXp} XP</b></div><p className="mt-2 text-[.55rem] text-[#9296a8]">{q.targetDistanceKm} KM • {q.checkpointCount} CHECKPOINTS • {q.personalizationScore}% MATCH</p><button onClick={()=>acceptPersonalQuest(q.id)} className="ghost-button mt-3 w-full !min-h-10">ACCEPT QUEST</button></article>)}</div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4"><div className="panel w-full max-w-md p-5"><div className="mb-5 flex items-center justify-between"><h3 className="game-title text-3xl">{title}</h3><button onClick={close} className="icon-button"><X size={17}/></button></div>{children}</div></div>}
