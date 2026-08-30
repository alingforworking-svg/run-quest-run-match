"use client";
import { AppShell } from "@/components/layout/app-shell";
import { QuestPath } from "@/components/game/quest-path";
import { PersonalizedQuestCard } from "@/components/game/personalized-quest-card";
import { TodayQuestCard,WeeklyAndEventCards } from "@/components/game/home-progression";
import { RankPreview,SeasonHeader } from "@/components/game/season-cards";
import { useGame } from "@/components/state/game-provider";
export default function HomePage(){
  const {state}=useGame();return <AppShell title="HOME"><main className="mobile-page mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8"><SeasonHeader/><div className="mt-6 flex items-end justify-between gap-3"><div><p className="eyebrow">WELCOME, {state.profile.displayName.toUpperCase()}</p><h1 className="game-title mt-2 text-3xl md:text-5xl">WHAT SHOULD I DO <span className="text-[#b6ff22]">TODAY?</span></h1></div><span aria-label={`${state.profile.visitStreak} day visit streak`} title={`${state.profile.visitStreak} day visit streak`} className="relative grid size-14 shrink-0 place-items-center rounded-full bg-[#59e0dc] text-2xl text-[#171720] shadow-[0_8px_24px_rgba(89,224,220,.22)]">🔥<b className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full border-2 border-[#171720] bg-[#b6ff22] px-1.5 py-0.5 text-[.62rem] font-black leading-4 text-[#171720]">{state.profile.visitStreak}</b></span></div><TodayQuestCard/><div className="mt-6"><QuestPath/></div><WeeklyAndEventCards/><RankPreview/><div className="mt-8 border-t border-[#343443] pt-7"><PersonalizedQuestCard/></div></main></AppShell>
}
