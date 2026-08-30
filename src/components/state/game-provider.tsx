"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BehaviorMetrics,QuestAssignment,QuestHistoryItem,RunnerDNA,RunnerQuestionnaire } from "@/types/personalization";
import { questionnaireToDNA,updateRunnerDNA } from "@/lib/personalization/runner-dna";
import { advanceJourney,createWeeklyChallenge,dailyObjectives,evaluateProgression,eventObjectives,initialJourneyProgress,personalizedMainObjectives } from "@/lib/progression/engine";
import type { MainJourneyProgress,SpecialEvent,WeeklyChallenge } from "@/types/progression";
import { rpRewards } from "@/data/season";
import { advanceSeasonPath,awardRp,initialSeasonState,personalizeSeasonQuest,seasonForDate,seasonQuestCompleted } from "@/lib/season/engine";
import type { SeasonHistoryRecord,UserSeasonState } from "@/types/season";
import type { Coordinates } from "@/types/game";
import { createClient } from "@/lib/supabase/client";
import { assignmentFromRow,dnaFromRow } from "@/lib/personalization/repository";

export type RunRecord = {
  id: string;
  questId: string;
  distanceKm: number;
  elapsedSeconds: number;
  movingSeconds?: number;
  pace: string;
  checkpoints: number;
  totalCheckpoints: number;
  trustScore: number;
  xp: number;
  claimed: boolean;
  completedAt: string;
  partySize?: number;
  partyId?: string;
  partyBonusXp?: number;
  exploredNewRoute?: boolean;
  objectivesCompleted?: { source: "main"|"season"|"daily"|"weekly"|"event"; sourceId: string; xp: number }[];
  rp?: number;
  rankBefore?: string;
  rankAfter?: string;
  route?: Coordinates[];
  publicSpotId?: string;
};

export type GameSettings = {
  privateProfile: boolean;
  approximateLocation: boolean;
  questNotifications: boolean;
  matchGroup: string;
  emergencyContact: string;
};

type Notice = { id: string; title: string; detail: string; read: boolean; createdAt: string };
type Report = { id: string; category: string; detail: string; createdAt: string };
type Signal = { active: boolean; distance: number; radius: number; pace: string; duration: number; partyType: "partner"|"group"; createdAt: string; expiresAt: string; latitude: number; longitude: number };

type GameState = {
  session: { email: string } | null;
  profile: { displayName: string; username: string; avatar: string; level: number; totalXp: number; streak: number; visitStreak: number; preferences: Record<string, string> };
  activeQuestId: string | null;
  completedQuestIds: string[];
  invitedRunnerIds: string[];
  followedRunnerIds: string[];
  blockedRunnerIds: string[];
  partyReady: boolean[];
  runSignal: Signal | null;
  runs: RunRecord[];
  achievements: string[];
  notices: Notice[];
  reports: Report[];
  settings: GameSettings;
  runnerDNA: RunnerDNA;
  behaviorMetrics: BehaviorMetrics;
  dailyQuests: QuestAssignment[];
  questHistory: QuestHistoryItem[];
  dailyQuestDate: string;
  dailySwapsUsed: number;
  mainJourney: MainJourneyProgress;
  weeklyChallenge: WeeklyChallenge;
  specialEvents: SpecialEvent[];
  completedEventIds: string[];
  seasonState: UserSeasonState;
  seasonHistory: SeasonHistoryRecord[];
};

type GameContextValue = {
  state: GameState;
  hydrated: boolean;
  onlineRunnerIds: string[];
  toast: string | null;
  notify: (message: string) => void;
  login: (email: string) => void;
  logout: () => void;
  saveOnboarding: (profile: Partial<GameState["profile"]>) => void;
  startQuest: (questId: string) => void;
  inviteRunner: (runnerId: string) => void;
  toggleFollow: (runnerId: string) => void;
  blockRunner: (runnerId: string) => void;
  setPartyReady: (ready: boolean[]) => void;
  setRunSignal: (signal: Omit<Signal, "createdAt"|"expiresAt"> | null) => Promise<boolean>;
  completeRun: (run: Omit<RunRecord, "claimed" | "completedAt">) => void;
  claimRun: (runId: string) => void;
  markRouteShared: (runId: string,spotId: string) => void;
  markNoticesRead: () => void;
  updateSettings: (changes: Partial<GameSettings>) => void;
  addReport: (category: string, detail: string) => void;
  clearRunHistory: () => void;
  saveRunnerDNA: (questionnaire: RunnerQuestionnaire) => RunnerDNA;
  ensureDailyQuests: () => void;
  swapDailyQuest: (reason: string) => void;
  acceptPersonalQuest: (assignmentId: string) => void;
};

const STORAGE_KEY = "runquest-live-game-state-v2";
const paceFromDecimal=(value:number)=>`${Math.floor(value)}:${String(Math.round((value%1)*60)).padStart(2,"0")}`;
const runnerPreferencesFrom=(preferences:Record<string,string>)=>{const distanceMap:Record<string,[number,number]>={"1-3":[1,3],"3-5":[3,5],"5-10":[5,10],"10+":[10,20]},paceMap:Record<string,number>={unknown:7.25,"8+":8.5,"7-8":7.5,"6-7":6.5,"5-6":5.5,"under-5":4.75},range=distanceMap[preferences.comfortableDistance]||[3,5];return{preferred_distance_min_km:range[0],preferred_distance_max_km:range[1],average_pace_min_km:paceMap[preferences.pace]||7,experience_level:preferences.frequency==="starting"?"beginner":preferences.frequency==="5+"?"advanced":"intermediate",preferred_times:preferences.preferredTime?[preferences.preferredTime]:[],running_styles:preferences.style?[preferences.style]:[]}};
const defaultDNA=questionnaireToDNA({frequency:"3-4",comfortableDistance:"3-5",pace:"6-7",goal:"exploration",preferredTime:"evening",social:"often",style:"adventure",availabilityMinutes:60},new Date(0).toISOString());
const defaultMetrics:BehaviorMetrics={runsLast7Days:0,runsLast30Days:0,distanceLast7Days:0,distanceLast30Days:0,avgPaceLast30Days:null,avgDistanceLast30Days:null,questCompletionRate:0,failedQuestRate:0,abandonedRuns:0,socialRunRatio:0,hardRunsLast7Days:0,daysSinceLastRun:null,mostUsedQuestType:"distance",streakDays:0};
const defaultJourney:MainJourneyProgress=initialJourneyProgress(new Date().toISOString());
const initialState: GameState = {
  session: null,
  profile: { displayName: "Runner", username: "runner", avatar: "🏃", level: 1, totalXp: 0, streak: 0, visitStreak: 0, preferences: {} },
  activeQuestId: null,
  completedQuestIds: [],
  invitedRunnerIds: [],
  followedRunnerIds: [],
  blockedRunnerIds: [],
  partyReady: [false],
  runSignal: null,
  runs: [],
  achievements: [],
  notices: [],
  reports: [],
  settings: { privateProfile: false, approximateLocation: true, questNotifications: true, matchGroup: "Everyone • 8 KM", emergencyContact: "" },
  runnerDNA:defaultDNA,behaviorMetrics:defaultMetrics,dailyQuests:[],questHistory:[],dailyQuestDate:"",dailySwapsUsed:0,
  mainJourney:defaultJourney,weeklyChallenge:createWeeklyChallenge(defaultDNA),specialEvents:[],completedEventIds:[],seasonState:initialSeasonState(new Date(),0),seasonHistory:[],
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [onlineRunnerIds, setOnlineRunnerIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [storageKey,setStorageKey]=useState("");

  useEffect(() => {
    const client=createClient();
    if(!client){setStorageKey(`${STORAGE_KEY}:guest`);setHydrated(true);return}
    void client.auth.getUser().then(async({data:{user}})=>{
      const scopedKey=`${STORAGE_KEY}:${user?.id??"guest"}`;setStorageKey(scopedKey);
      try{const saved=localStorage.getItem(scopedKey);if(saved){const parsed=JSON.parse(saved);setState(current=>({...current,...parsed,profile:{...current.profile,...parsed.profile},settings:{...current.settings,...parsed.settings}}))}}catch{/* Ignore corrupt account-scoped cache. */}
      if(!user){setHydrated(true);return}
      const today=new Date().toISOString().slice(0,10);
      const {data:seasonId,error:seasonError}=await client.rpc("ensure_monthly_season");
      if(seasonError||!seasonId)throw seasonError||new Error("Current monthly season is unavailable");
      const {data:visitStreak,error:visitError}=await client.rpc("record_daily_visit");
      if(visitError)throw visitError;
      const liveSeason=seasonForDate(new Date());
      const [{data:profile},{data:runs},{data:xpRows},{data:notices},{data:earned},{data:seasonStats},{data:activeDays},{data:seasonHistoryRows},{data:friendships},{data:dnaRow},{data:questRows},{data:questHistoryRows},{data:activeSignal}]=await Promise.all([
        client.from("profiles").select("display_name,username,avatar_url,level,total_xp,streak_days,visit_streak_days,is_private,location_visibility,profile_preferences,quest_notifications,match_group,emergency_contact").eq("id",user.id).maybeSingle(),
        client.from("runs").select("id,quest_id,party_id,distance_km,elapsed_seconds,average_pace,checkpoint_count,ended_at,status,run_verification(trust_score,status)").eq("user_id",user.id).not("ended_at","is",null).order("ended_at",{ascending:false}).limit(100),
        client.from("xp_transactions").select("run_id,amount,reason").eq("user_id",user.id),
        client.from("notifications").select("id,title,body,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
        client.from("user_achievements").select("achievements(name)").eq("user_id",user.id),
        client.from("user_season_stats").select("current_rp,current_rank_id,highest_rank_id,distance_km,quest_completions,active_days,leaderboard_position,newcomer_bonus_claimed,started_at").eq("user_id",user.id).eq("season_id",String(seasonId)).maybeSingle(),
        client.from("user_season_active_days").select("active_date").eq("user_id",user.id).eq("season_id",String(seasonId)).order("active_date",{ascending:false}).limit(31),
        client.from("season_history").select("season_id,final_rank_id,highest_rank_id,final_rp,leaderboard_position,distance_km,quest_completions,boss_completed,active_days,badge_reward,finalized_at,seasons(name)").eq("user_id",user.id).order("finalized_at",{ascending:false}).limit(24),
        client.from("friendships").select("requester_id,addressee_id,status").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
        client.from("runner_dna").select("*").eq("user_id",user.id).maybeSingle(),
        client.from("user_quest_assignments").select("*").eq("user_id",user.id).gte("assigned_at",`${today}T00:00:00.000Z`).order("assigned_at"),
        client.from("user_quest_assignments").select("quest_template_id,status,assigned_at,completed_at,quest_type,difficulty").eq("user_id",user.id).order("assigned_at",{ascending:false}).limit(50),
        client.from("run_signals").select("distance_km,radius_km,pace_min,pace_max,duration_minutes,party_type,created_at,expires_at,approx_latitude,approx_longitude").eq("user_id",user.id).eq("status","active").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      ]);
      const xpByRun=new Map<string,number>(),partyBonusByRun=new Map<string,number>();for(const row of xpRows||[])if(row.run_id){xpByRun.set(row.run_id,(xpByRun.get(row.run_id)||0)+Number(row.amount||0));if(row.reason==="party_run_bonus")partyBonusByRun.set(row.run_id,(partyBonusByRun.get(row.run_id)||0)+Number(row.amount||0))}
      const liveRuns:RunRecord[]=(runs||[]).map(row=>{const raw=row.run_verification as unknown as {trust_score?:number;status?:string}|{trust_score?:number;status?:string}[]|null,verification=Array.isArray(raw)?raw[0]:raw;return{id:row.id,questId:row.quest_id||"free-run",partyId:row.party_id||undefined,partyBonusXp:partyBonusByRun.get(row.id)||0,distanceKm:Number(row.distance_km||0),elapsedSeconds:Number(row.elapsed_seconds||0),pace:row.average_pace?`${Math.floor(Number(row.average_pace))}:${String(Math.round(Number(row.average_pace)%1*60)).padStart(2,"0")}`:"--:--",checkpoints:Number(row.checkpoint_count||0),totalCheckpoints:Number(row.checkpoint_count||0),trustScore:Number(verification?.trust_score||0),xp:xpByRun.get(row.id)||0,claimed:true,completedAt:row.ended_at||new Date().toISOString()}});
      const last30=liveRuns.filter(run=>Date.now()-new Date(run.completedAt).getTime()<=30*86_400_000),last7=last30.filter(run=>Date.now()-new Date(run.completedAt).getTime()<=7*86_400_000),paceValues=last30.map(run=>{const [m,s]=run.pace.split(":").map(Number);return m*60+s}).filter(Number.isFinite);
      const followedRunnerIds=(friendships||[]).filter(row=>row.status==="accepted"&&row.requester_id===user.id).map(row=>row.addressee_id);
      const blockedRunnerIds=(friendships||[]).filter(row=>row.status==="blocked"&&row.requester_id===user.id).map(row=>row.addressee_id);
      const dailyQuests=(questRows||[]).map(row=>assignmentFromRow(row));
      const questHistory:QuestHistoryItem[]=(questHistoryRows||[]).map(row=>({templateId:row.quest_template_id,status:row.status,assignedAt:row.assigned_at,completedAt:row.completed_at||undefined,questType:row.quest_type,difficulty:row.difficulty}));
      const seasonHistory:SeasonHistoryRecord[]=(seasonHistoryRows||[]).map(row=>{const relation=row.seasons as unknown as {name?:string}|{name?:string}[]|null,season=Array.isArray(relation)?relation[0]:relation;return{seasonId:row.season_id,label:season?.name||"PAST SEASON",finalRankTierId:row.final_rank_id,highestRankTierId:row.highest_rank_id,finalRp:Number(row.final_rp||0),leaderboardPosition:Number(row.leaderboard_position||0),distanceKm:Number(row.distance_km||0),questCompletions:Number(row.quest_completions||0),bossCompleted:Boolean(row.boss_completed),activeDays:Number(row.active_days||0),badge:row.badge_reward||undefined,endedAt:row.finalized_at}});
      setState(current=>({...current,session:{email:user.email||""},profile:{...current.profile,displayName:profile?.display_name||user.user_metadata?.full_name||"Runner",username:profile?.username||`runner_${user.id.slice(0,8)}`,avatar:profile?.avatar_url||user.user_metadata?.avatar_url||"🏃",level:Number(profile?.level||1),totalXp:Number(profile?.total_xp||0),streak:Number(profile?.streak_days||0),visitStreak:Number(visitStreak||profile?.visit_streak_days||1),preferences:(profile?.profile_preferences as Record<string,string>|null)||{}},runSignal:activeSignal&&activeSignal.approx_latitude!==null&&activeSignal.approx_longitude!==null?{active:true,distance:Number(activeSignal.distance_km||5),radius:Number(activeSignal.radius_km||3),pace:`${paceFromDecimal(Number(activeSignal.pace_min||6))}–${paceFromDecimal(Number(activeSignal.pace_max||7))} / KM`,duration:Number(activeSignal.duration_minutes||60),partyType:activeSignal.party_type==="group"?"group":"partner",createdAt:activeSignal.created_at,expiresAt:activeSignal.expires_at,latitude:Number(activeSignal.approx_latitude),longitude:Number(activeSignal.approx_longitude)}:null,runs:liveRuns,followedRunnerIds,blockedRunnerIds,runnerDNA:dnaRow?dnaFromRow(dnaRow):current.runnerDNA,dailyQuests,questHistory,dailyQuestDate:dailyQuests.length?today:"",notices:(notices||[]).map(row=>({id:row.id,title:row.title,detail:row.body,read:Boolean(row.read_at),createdAt:row.created_at})),achievements:(earned||[]).flatMap(row=>{const value=row.achievements as unknown as {name?:string}|{name?:string}[]|null;return Array.isArray(value)?value.map(item=>item.name).filter(Boolean) as string[]:value?.name?[value.name]:[]}),settings:{...current.settings,privateProfile:Boolean(profile?.is_private),approximateLocation:profile?.location_visibility!=="hidden",questNotifications:profile?.quest_notifications!==false,matchGroup:profile?.match_group||"Everyone • 8 KM",emergencyContact:profile?.emergency_contact||""},behaviorMetrics:{...current.behaviorMetrics,runsLast7Days:last7.length,runsLast30Days:last30.length,distanceLast7Days:last7.reduce((sum,run)=>sum+run.distanceKm,0),distanceLast30Days:last30.reduce((sum,run)=>sum+run.distanceKm,0),avgPaceLast30Days:paceValues.length?Math.round(paceValues.reduce((a,b)=>a+b,0)/paceValues.length):null,avgDistanceLast30Days:last30.length?last30.reduce((sum,run)=>sum+run.distanceKm,0)/last30.length:null,streakDays:Number(profile?.streak_days||0)},seasonState:seasonStats?{...(current.seasonState.season.id===liveSeason.id?current.seasonState:initialSeasonState(new Date())),season:liveSeason,rp:Number(seasonStats.current_rp||0),rankTierId:seasonStats.current_rank_id,highestRankTierId:seasonStats.highest_rank_id,distanceKm:Number(seasonStats.distance_km||0),questCompletions:Number(seasonStats.quest_completions||0),activeDates:(activeDays||[]).map(row=>row.active_date),leaderboardPosition:Number(seasonStats.leaderboard_position||0),newcomerBonusClaimed:Boolean(seasonStats.newcomer_bonus_claimed),startedAt:seasonStats.started_at}:initialSeasonState(new Date()),seasonHistory}));
      setHydrated(true);
    }).catch(()=>setHydrated(true));
  }, []);
  useEffect(() => {
    const client=createClient();
    if(!client)return;
    let channel:ReturnType<typeof client.channel>|null=null,activeUserId="",cancelled=false,generation=0;
    const stop=()=>{generation+=1;activeUserId="";setOnlineRunnerIds([]);if(channel){const previous=channel;channel=null;void client.removeChannel(previous)}};
    const start=(userId:string)=>{
      if(cancelled||activeUserId===userId)return;
      stop();activeUserId=userId;const currentGeneration=generation;
      const next=client.channel("runquest-online-runners",{config:{presence:{key:userId}}});channel=next;
      next.on("presence",{event:"sync"},()=>{if(!cancelled&&channel===next&&currentGeneration===generation)setOnlineRunnerIds(Object.keys(next.presenceState()).sort())}).subscribe(status=>{if(status==="SUBSCRIBED"&&!cancelled&&channel===next&&currentGeneration===generation)void next.track({userId,onlineAt:new Date().toISOString()})});
    };
    void client.auth.getSession().then(({data:{session}})=>{if(session?.user)start(session.user.id)});
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(session?.user)start(session.user.id);else stop()});
    return()=>{cancelled=true;subscription.unsubscribe();stop()};
  }, []);
  useEffect(() => { if (hydrated&&storageKey) localStorage.setItem(storageKey, JSON.stringify(state)); }, [state, hydrated,storageKey]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(current => current === message ? null : current), 2600);
  }, []);
  const addNotice = (title: string, detail: string) => ({ id: `${Date.now()}-${title}`, title, detail, read: false, createdAt: new Date().toISOString() });
  const login = (email: string) => setState(s => ({ ...s, session: { email } }));
  const logout = () => { setState(initialState);setStorageKey(`${STORAGE_KEY}:guest`);notify("Logged out successfully"); };
  const saveOnboarding = (profile: Partial<GameState["profile"]>) => {setState(s=>({...s,profile:{...s.profile,...profile}}));const client=createClient();if(!client){notify("Live database is unavailable");return}void(async()=>{const {data:{user}}=await client.auth.getUser();if(!user){notify("Login required");return}const {error}=await client.from("profiles").update({...(profile.displayName?{display_name:profile.displayName}:{}),...(profile.username?{username:profile.username.toLowerCase().replace(/[^a-z0-9_.]/g,"").slice(0,24)}:{}),...(profile.avatar?{avatar_url:profile.avatar}:{}),...(profile.preferences?{profile_preferences:profile.preferences}:{}),...(profile.preferences?.gender?{gender:profile.preferences.gender}:{})}).eq("id",user.id);if(error){notify(`Profile sync failed: ${error.message}`);return}if(profile.preferences){const {error:preferenceError}=await client.from("runner_preferences").upsert({user_id:user.id,...runnerPreferencesFrom(profile.preferences)});if(preferenceError){notify(`Running preferences failed: ${preferenceError.message}`);return}}notify("Player profile saved")})()};
  const startQuest = (questId: string) => { setState(s => ({ ...s, activeQuestId: questId, notices: [addNotice("QUEST STARTED", "GPS tracking is ready. Head to the public start point."), ...s.notices] })); notify("Quest started — tracking is ready"); };
  const inviteRunner = (runnerId: string) => { setState(s => ({ ...s, invitedRunnerIds: [...new Set([...s.invitedRunnerIds, runnerId])], notices: [addNotice("PARTY INVITE SENT", "Your runner match has been invited."), ...s.notices] })); notify("Runner invited to your party"); };
  const toggleFollow = (runnerId: string) => {const following=state.followedRunnerIds.includes(runnerId);setState(s => ({ ...s, followedRunnerIds: following?s.followedRunnerIds.filter(id => id !== runnerId):[...s.followedRunnerIds, runnerId] }));const client=createClient();if(client)void client.auth.getUser().then(async({data:{user}})=>{if(!user)return;const result=following?await client.from("friendships").delete().eq("requester_id",user.id).eq("addressee_id",runnerId):await client.from("friendships").upsert({requester_id:user.id,addressee_id:runnerId,status:"accepted"});if(result.error)notify(`Follow sync failed: ${result.error.message}`)})};
  const blockRunner = (runnerId: string) => { setState(s => ({ ...s, blockedRunnerIds: [...new Set([...s.blockedRunnerIds, runnerId])], followedRunnerIds: s.followedRunnerIds.filter(id => id !== runnerId) }));const client=createClient();if(client)void client.auth.getUser().then(async({data:{user}})=>{if(user)await client.from("friendships").upsert({requester_id:user.id,addressee_id:runnerId,status:"blocked"})});notify("Runner blocked"); };
  const setPartyReady = (partyReady: boolean[]) => setState(s => ({ ...s, partyReady }));
  const setRunSignal = async(signal: Omit<Signal,"createdAt"|"expiresAt">|null)=>{const client=createClient();if(!client){notify("Live database is unavailable");return false}const {data:{user}}=await client.auth.getUser();if(!user){notify("Login required");return false}if(!signal){const {error}=await client.from("run_signals").update({status:"cancelled"}).eq("user_id",user.id).eq("status","active");if(error){notify(`Run Signal failed: ${error.message}`);return false}setState(s=>({...s,runSignal:null}));notify("Run Signal cancelled");return true}const numbers=signal.pace.match(/[0-9]+/g)?.map(Number)||[6,0,7,0],paceMin=(numbers[0]||6)+(numbers[1]||0)/60,paceMax=(numbers[2]||paceMin+1)+(numbers[3]||0)/60,createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+signal.duration*60_000).toISOString(),latitude=Math.round(signal.latitude*1000)/1000,longitude=Math.round(signal.longitude*1000)/1000;await client.from("run_signals").update({status:"expired"}).eq("user_id",user.id).eq("status","active");const {data,error}=await client.from("run_signals").insert({user_id:user.id,status:"active",available_from:createdAt,expires_at:expiresAt,distance_km:signal.distance,pace_min:paceMin,pace_max:paceMax,duration_minutes:signal.duration,radius_km:signal.radius,party_type:signal.partyType,approx_latitude:latitude,approx_longitude:longitude}).select("created_at,expires_at").single();if(error){notify(`Run Signal failed: ${error.message}`);return false}setState(s=>({...s,runSignal:{...signal,latitude,longitude,createdAt:data.created_at,expiresAt:data.expires_at}}));notify("Run Signal is live");return true};
  const completeRun = (run: Omit<RunRecord, "claimed" | "completedAt">) => {const client=createClient();if(client)void client.rpc("save_completed_gps_run_v2",{p_run_id:run.id,p_quest_key:run.questId,p_elapsed_seconds:run.elapsedSeconds,p_moving_seconds:run.movingSeconds??run.elapsedSeconds,p_reported_distance_km:run.distanceKm,p_checkpoint_count:run.checkpoints,p_points:run.route||[],p_xp:run.xp,p_party_id:run.partyId||null}).then(async({data,error})=>{if(error){notify(`Run sync failed: ${error.message}`);return}const result=data as {verified?:boolean;partyBonusXp?:number}|null;if(result?.partyBonusXp){setState(current=>{const totalXp=current.profile.totalXp+result.partyBonusXp!;return{...current,profile:{...current.profile,totalXp,level:Math.min(100,Math.floor(totalXp/500)+1)},runs:current.runs.map(item=>item.id===run.id?{...item,xp:item.xp+result.partyBonusXp!,partyBonusXp:result.partyBonusXp}:item)}});notify(`Party run verified • +${result.partyBonusXp} XP`)}if(result?.verified&&run.xp>0){const {error:rpError}=await client.rpc("award_verified_rp",{p_run_id:run.id,p_source_type:"daily",p_source_id:run.questId});if(rpError)notify(`Rank sync failed: ${rpError.message}`)}});setState(s => {
    if (s.runs.some(r => r.id === run.id)) return s;
    const completedAt=new Date().toISOString(),verified=run.trustScore>=75,[paceMinute,paceSecond]=run.pace.split(":").map(Number),paceSecKm=Number.isFinite(paceMinute*60+paceSecond)?paceMinute*60+paceSecond:null;
    const assignment=s.dailyQuests.find(q=>q.status==="accepted")??s.dailyQuests.find(q=>q.assignmentType==="primary"&&q.status==="assigned");
    const weeklyRemaining=Math.max(0,s.weeklyChallenge.targetKm-s.weeklyChallenge.progressKm),objectives=[...(assignment?dailyObjectives(assignment):[]),...(weeklyRemaining>0?[{id:`${s.weeklyChallenge.id}-distance`,source:"weekly" as const,sourceId:s.weeklyChallenge.id,kind:"distance" as const,target:weeklyRemaining,xpReward:s.weeklyChallenge.xpReward,required:true}]:[]),...s.specialEvents.filter(e=>!s.completedEventIds.includes(e.id)).flatMap(eventObjectives)];
    const evaluation=evaluateProgression(objectives,{distanceKm:run.distanceKm,elapsedSeconds:run.elapsedSeconds,paceSecKm,checkpoints:run.checkpoints,partySize:run.partySize??1,exploredNewRoute:run.exploredNewRoute??false,verified,completedAt});
    const seasonQuest=personalizeSeasonQuest(s.seasonState.currentQuestId,s.runnerDNA),seasonCompleted=seasonQuestCompleted(seasonQuest,{distanceKm:run.distanceKm,paceSecKm,checkpoints:run.checkpoints,partySize:run.partySize??1,exploredNewRoute:run.exploredNewRoute??false,verified});
    const objectivesCompleted=[...evaluation.results.filter(r=>r.completed&&r.xpAwarded>0).map(r=>({source:r.source,sourceId:r.sourceId,xp:r.xpAwarded})),...(seasonCompleted?[{source:"season" as const,sourceId:seasonQuest.id,xp:seasonQuest.xpReward}]:[])],earnedXp=evaluation.totalXp+(seasonCompleted?seasonQuest.xpReward:0);
    const dailyCompleted=Boolean(assignment&&evaluation.dailyCompleted),completedCount=s.questHistory.filter(h=>h.status==="completed").length+(dailyCompleted?1:0),historyCount=s.questHistory.length+(dailyCompleted?1:0),historyStatus="completed" as const;
    const questHistory=assignment&&dailyCompleted?[{templateId:assignment.templateId,status:historyStatus,assignedAt:assignment.assignedAt,completedAt,questType:assignment.questType,difficulty:assignment.difficulty},...s.questHistory]:s.questHistory;
    const weeklyProgress=verified?Math.min(s.weeklyChallenge.targetKm,s.weeklyChallenge.progressKm+run.distanceKm):s.weeklyChallenge.progressKm,weeklyCompleted=weeklyProgress>=s.weeklyChallenge.targetKm,weeklyJustCompleted=weeklyCompleted&&!s.weeklyChallenge.completed;
    const rpInputs=[...(dailyCompleted?[{source:(assignment?.assignmentType==="bonus"?"bonus":"daily") as "bonus"|"daily",sourceId:assignment!.id,baseAmount:assignment?.assignmentType==="bonus"?rpRewards.bonus:rpRewards.daily,createdAt:completedAt,verified}]:[]),...(seasonCompleted?[{source:(seasonQuest.boss?"boss":"season") as "boss"|"season",sourceId:seasonQuest.id,baseAmount:seasonQuest.boss?rpRewards.boss:rpRewards.season,createdAt:completedAt,verified,capExempt:seasonQuest.boss}]:[]),...(weeklyJustCompleted?[{source:"weekly" as const,sourceId:s.weeklyChallenge.id,baseAmount:rpRewards.weekly,createdAt:completedAt,verified,capExempt:true}]:[]),...evaluation.eventCompletedIds.map(id=>({source:"event" as const,sourceId:id,baseAmount:rpRewards.event,createdAt:completedAt,verified,capExempt:true})),...(dailyCompleted&&assignment?.questType==="social"?[{source:"social" as const,sourceId:assignment.id,baseAmount:rpRewards.social,createdAt:completedAt,verified}]:[]),...(dailyCompleted&&run.checkpoints>0?[{source:"checkpoint" as const,sourceId:assignment!.id,baseAmount:rpRewards.checkpoint,createdAt:completedAt,verified}]:[])],rpAward=awardRp(s.seasonState.transactions,rpInputs),rankBefore=s.seasonState.rankTierId,advancedSeason=advanceSeasonPath(s.seasonState,seasonCompleted,verified?run.distanceKm:0,completedAt,rpAward.awarded),seasonState={...advancedSeason,transactions:[...s.seasonState.transactions,...rpAward.transactions]},rankAfter=seasonState.rankTierId;
    const savedRun:RunRecord={...run,xp:earnedXp,rp:rpAward.awarded,rankBefore,rankAfter,claimed:false,completedAt,objectivesCompleted},runs=[savedRun,...s.runs],paceSeconds=runs.map(r=>{const [m,sec]=r.pace.split(":").map(Number);return m*60+sec}).filter(Number.isFinite);
    const metrics:BehaviorMetrics={...s.behaviorMetrics,runsLast7Days:runs.length,runsLast30Days:runs.length,distanceLast7Days:runs.reduce((n,r)=>n+r.distanceKm,0),distanceLast30Days:runs.reduce((n,r)=>n+r.distanceKm,0),avgPaceLast30Days:paceSeconds.length?Math.round(paceSeconds.reduce((a,b)=>a+b,0)/paceSeconds.length):s.behaviorMetrics.avgPaceLast30Days,avgDistanceLast30Days:runs.reduce((n,r)=>n+r.distanceKm,0)/runs.length,questCompletionRate:historyCount?completedCount/historyCount:s.behaviorMetrics.questCompletionRate,daysSinceLastRun:0,streakDays:s.profile.streak};
    const weeklyChallenge={...s.weeklyChallenge,progressKm:Number(weeklyProgress.toFixed(2)),completed:weeklyCompleted},completedEventIds=[...new Set([...s.completedEventIds,...evaluation.eventCompletedIds])],achievements=[...new Set([...s.achievements,...(seasonState.pathCompleted?[seasonState.season.badge]:[])])];
    const completedGroups=[...new Set(objectivesCompleted.map(o=>o.source))],notice=!verified?addNotice("GPS VERIFICATION NEEDED","Run saved without competitive RP."):completedGroups.length?addNotice("OBJECTIVES COMPLETE",`${completedGroups.map(x=>x.toUpperCase()).join(" + ")} • ${earnedXp} XP • ${rpAward.awarded} RP`):addNotice("RUN SAVED","Verified activity saved. Keep going toward your active objectives.");
    return{...s,activeQuestId:null,completedQuestIds:[...new Set([...s.completedQuestIds,...(seasonCompleted?[seasonQuest.id]:[])])],runs,behaviorMetrics:metrics,runnerDNA:updateRunnerDNA(s.runnerDNA,metrics),questHistory,dailyQuests:s.dailyQuests.map(q=>q.id===assignment?.id&&dailyCompleted?{...q,status:historyStatus}:q),weeklyChallenge,completedEventIds,achievements,seasonState,notices:[notice,...s.notices]};
  })};
  const claimRun = (runId: string) => setState(s => {
    const run = s.runs.find(r => r.id === runId);
    if (!run || run.claimed) return s;
    const totalXp = s.profile.totalXp + run.xp;
    return { ...s, profile: { ...s.profile, totalXp, level: Math.max(s.profile.level, Math.floor(totalXp / 500) + 1) }, runs: s.runs.map(r => r.id === runId ? { ...r, claimed: true } : r) };
  });
  const markRouteShared=(runId:string,spotId:string)=>setState(s=>({...s,runs:s.runs.map(run=>run.id===runId?{...run,publicSpotId:spotId}:run)}));
  const markNoticesRead = () => {setState(s => ({ ...s, notices: s.notices.map(n => ({ ...n, read: true })) }));const client=createClient();if(client)void client.auth.getUser().then(async({data:{user}})=>{if(user)await client.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",user.id).is("read_at",null)})};
  const updateSettings = (changes: Partial<GameSettings>) => { setState(s => ({ ...s, settings: { ...s.settings, ...changes } }));const client=createClient();if(client)void client.auth.getUser().then(async({data:{user}})=>{if(!user)return;const values={...(changes.privateProfile!==undefined?{is_private:changes.privateProfile}:{}),...(changes.approximateLocation!==undefined?{location_visibility:changes.approximateLocation?"approximate":"hidden"}:{}),...(changes.questNotifications!==undefined?{quest_notifications:changes.questNotifications}:{}),...(changes.matchGroup!==undefined?{match_group:changes.matchGroup}:{}),...(changes.emergencyContact!==undefined?{emergency_contact:changes.emergencyContact}:{})};if(Object.keys(values).length){const {error}=await client.from("profiles").update(values).eq("id",user.id);if(error)notify(`Settings sync failed: ${error.message}`)}});notify("Settings saved"); };
  const addReport = (category: string, detail: string) => {const createdAt=new Date().toISOString();setState(s => ({ ...s, reports: [{ id: crypto.randomUUID(), category, detail, createdAt }, ...s.reports], notices: [addNotice("SAFETY REPORT RECEIVED", "Your report was saved for review."), ...s.notices] }));const client=createClient();if(client)void client.auth.getUser().then(async({data:{user}})=>{if(!user)return;const {error}=await client.from("reports").insert({reporter_id:user.id,category,details:detail});if(error)notify(`Report sync failed: ${error.message}`)});notify("Safety report submitted"); };
  const clearRunHistory = () => { setState(s => ({ ...s, runs: [] })); notify("Run history deleted"); };
  const saveRunnerDNA=(questionnaire:RunnerQuestionnaire)=>{const dna=questionnaireToDNA(questionnaire);setState(s=>({...s,runnerDNA:dna,dailyQuestDate:"",dailyQuests:[]}));void fetch("/api/runner-dna",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(questionnaire)}).catch(()=>undefined);notify(`Runner DNA created: ${dna.archetype}`);return dna};
  const ensureDailyQuests=()=>{const today=new Date().toISOString().slice(0,10);if(state.dailyQuestDate===today&&state.dailyQuests.length)return;void fetch("/api/personalized-quests",{cache:"no-store"}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"Quest loading failed");setState(s=>({...s,dailyQuestDate:today,dailySwapsUsed:0,dailyQuests:body.quests||[],weeklyChallenge:createWeeklyChallenge(s.runnerDNA)}))}).catch(error=>notify(error instanceof Error?error.message:"Quest loading failed"))};
  const swapDailyQuest=(reason:string)=>{const old=state.dailyQuests.find(q=>q.assignmentType==="primary");if(!old)return;if(state.dailySwapsUsed>=3){notify("Daily swap limit reached");return}void fetch("/api/personalized-quests",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({assignmentId:old.id,reason})}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"Quest swap failed");setState(s=>({...s,dailySwapsUsed:body.swapsUsed,dailyQuests:s.dailyQuests.map(q=>q.id===old.id?body.quest:q),questHistory:[{templateId:old.templateId,status:"skipped" as const,assignedAt:old.assignedAt,questType:old.questType,difficulty:old.difficulty},...s.questHistory]}));notify("A new live quest was saved")}).catch(error=>notify(error instanceof Error?error.message:"Quest swap failed"))};
  const acceptPersonalQuest=(assignmentId:string)=>{const selected=state.dailyQuests.find(q=>q.id===assignmentId);if(!selected)return;const client=createClient();if(client)void client.from("user_quest_assignments").update({status:"accepted"}).eq("id",assignmentId).then(({error})=>{if(error)notify(`Quest sync failed: ${error.message}`)});setState(s=>({...s,activeQuestId:assignmentId,dailyQuests:s.dailyQuests.map(q=>q.id===assignmentId?{...q,status:"accepted"}:q),notices:[addNotice("PERSONAL QUEST STARTED",`${selected.generatedTitle} is ready.`),...s.notices]}));notify("Personal quest accepted")};

  const value = useMemo<GameContextValue>(() => ({ state, hydrated, onlineRunnerIds, toast, notify, login, logout, saveOnboarding, startQuest, inviteRunner, toggleFollow, blockRunner, setPartyReady, setRunSignal, completeRun, claimRun,markRouteShared, markNoticesRead, updateSettings, addReport, clearRunHistory,saveRunnerDNA,ensureDailyQuests,swapDailyQuest,acceptPersonalQuest }), [state, hydrated, onlineRunnerIds, toast, notify]);
  return <GameContext.Provider value={value}>{children}{toast && <div role="status" className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 rounded-2xl border border-[#b7ff22]/40 bg-[#171a29] px-5 py-3 text-center text-xs font-black text-white shadow-2xl md:bottom-7"><span className="mr-2 text-[#b7ff22]">✓</span>{toast}</div>}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside GameProvider");
  return context;
}
