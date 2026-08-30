"use client";

import Link from "next/link";
import {Clock3,MapPin,Radar,Users,Zap} from "lucide-react";
import {useEffect,useRef,useState} from "react";
import {useGame} from "@/components/state/game-provider";
import {useLiveRunners} from "@/hooks/use-live-runners";

const getPosition=()=>new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:20_000}));
const formatCountdown=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;

export function RunSignalForm(){
  const {state,setRunSignal,notify}=useGame(),saved=state.runSignal;
  const [distance,setDistance]=useState(saved?.distance??5),[radius,setRadius]=useState(saved?.radius??3),[pace,setPace]=useState(saved?.pace??"6:00–7:00 / KM"),[duration,setDuration]=useState(saved?.duration??60),[party,setParty]=useState(saved?.partyType==="group"?"GROUP":"1 PARTNER"),[now,setNow]=useState(Date.now()),[sending,setSending]=useState(false);
  const expirationHandled=useRef("");
  const remainingSeconds=saved?Math.max(0,Math.ceil((new Date(saved.expiresAt).getTime()-now)/1000)):0;
  const active=Boolean(saved&&remainingSeconds>0);
  const {runners,loading,error}=useLiveRunners(true,saved?{lat:saved.latitude,lng:saved.longitude}:null,saved?.radius??radius);

  useEffect(()=>{if(!saved)return;setDistance(saved.distance);setRadius(saved.radius);setPace(saved.pace);setDuration(saved.duration);setParty(saved.partyType==="group"?"GROUP":"1 PARTNER")},[saved]);
  useEffect(()=>{if(!saved)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[saved]);
  useEffect(()=>{if(saved&&remainingSeconds===0&&expirationHandled.current!==saved.createdAt){expirationHandled.current=saved.createdAt;void setRunSignal(null)}},[remainingSeconds,saved,setRunSignal]);

  async function send(){
    if(!navigator.geolocation){notify("อุปกรณ์นี้ไม่รองรับ GPS");return}
    setSending(true);
    try{
      const position=await getPosition();
      await setRunSignal({active:true,distance,radius,pace,duration,partyType:party==="GROUP"?"group":"partner",latitude:position.coords.latitude,longitude:position.coords.longitude});
    }catch(error){
      const message=error instanceof GeolocationPositionError&&error.code===error.PERMISSION_DENIED?"กรุณาอนุญาตตำแหน่งเพื่อส่ง Run Signal":"รับตำแหน่ง GPS ไม่สำเร็จ กรุณาออกไปในที่โล่งแล้วลองใหม่";
      notify(message);
    }finally{setSending(false)}
  }
  async function edit(){setSending(true);await setRunSignal(null);setSending(false)}

  if(active&&saved)return <div className="pop"><div className="relative mx-auto grid size-28 place-items-center rounded-full bg-[#b7ff22] text-[#111]"><Radar size={43}/><i className="absolute inset-0 animate-ping rounded-full border border-[#b7ff22]"/></div><p className="eyebrow mt-10 text-center">SIGNAL ACTIVE • {formatCountdown(remainingSeconds)} LEFT</p><h2 className="game-title mt-3 text-center text-4xl">{loading?"…":runners.length} REAL RUNNERS<br/><span className="text-[#b7ff22]">NEAR YOU NOW.</span></h2><p className="muted mt-3 text-center text-[.6rem]">ค้นหาภายใน {saved.radius} KM โดยใช้ตำแหน่งโดยประมาณ ไม่แสดงการเคลื่อนไหวสด</p>{runners.length?<div className="mt-8 grid gap-3 sm:grid-cols-2">{runners.slice(0,4).map(r=><Link href={`/profile/${r.username}`} key={r.id} className="panel lift flex items-center gap-3 p-3 text-left"><span className="grid size-12 place-items-center rounded-full bg-[#9677dc] text-3xl">{r.avatar}</span><span className="flex-1"><b className="block text-xs">{r.name.toUpperCase()}</b><small className="text-[.5rem] font-bold text-[#878b9e]">{r.distanceAwayKm.toFixed(1)} KM AWAY • PACE {paceLabel(r.paceMinKm)}</small></span><Zap size={16} className="text-[#b7ff22]"/></Link>)}</div>:!loading&&<p className="muted mt-5 text-center text-xs">{error||"ยังไม่มีนักวิ่งจริงที่เปิดสัญญาณอยู่ใกล้คุณ"}</p>}<div className="mt-5 flex justify-center"><button onClick={edit} disabled={sending} className="ghost-button disabled:opacity-50">{sending?"SAVING…":"STOP / EDIT RUN SIGNAL"}</button></div></div>;

  return <div><div className="grid gap-4 sm:grid-cols-2"><Choice title="WHEN" icon={<Clock3/>} options={["NOW"]} value="NOW" setValue={()=>undefined}/><Choice title="PARTY TYPE" icon={<Users/>} options={["1 PARTNER","GROUP"]} value={party} setValue={setParty}/></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Range label="DISTANCE" value={distance} setValue={setDistance} min={2} max={15}/><Range label="SEARCH RADIUS" value={radius} setValue={setRadius} min={1} max={10}/></div><div className="panel mt-4 grid gap-4 p-5 sm:grid-cols-2"><label><span className="text-[.55rem] font-black text-[#83879a]">PREFERRED PACE</span><select value={pace} onChange={e=>setPace(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#35384d] bg-[#1c1e31] px-3 text-xs font-black"><option>6:00–7:00 / KM</option><option>5:00–6:00 / KM</option><option>7:00–8:00 / KM</option></select></label><label><span className="text-[.55rem] font-black text-[#83879a]">AVAILABLE DURATION</span><select value={duration} onChange={e=>setDuration(Number(e.target.value))} className="mt-2 h-12 w-full rounded-xl border border-[#35384d] bg-[#1c1e31] px-3 text-xs font-black"><option value="60">60 MINUTES</option><option value="30">30 MINUTES</option><option value="90">90 MINUTES</option></select></label></div><button onClick={send} disabled={sending} className="lime-button mt-5 w-full disabled:opacity-50"><Radar size={18}/>{sending?"GETTING GPS…":"SEND REAL RUN SIGNAL"}</button><p className="mt-4 flex items-center justify-center gap-2 text-center text-[.52rem] text-[#777b8e]"><MapPin size={12}/>ระบบบันทึกเฉพาะพื้นที่โดยประมาณและค่าที่เลือก ไม่แชร์เส้นทางเคลื่อนไหวสด</p></div>
}

const paceLabel=(pace:number)=>`${Math.floor(pace)}:${String(Math.round((pace%1)*60)).padStart(2,"0")}`;
function Choice({title,icon,options,value,setValue}:{title:string;icon:React.ReactNode;options:string[];value:string;setValue:(v:string)=>void}){return <div className="panel p-5"><div className="flex items-center gap-2 text-[#b7ff22]">{icon}<span className="text-[.55rem] font-black text-[#898da0]">{title}</span></div><div className={`mt-4 grid gap-2 ${options.length>1?"grid-cols-2":"grid-cols-1"}`}>{options.map(o=><button onClick={()=>setValue(o)} key={o} className={`h-11 rounded-xl border text-[.58rem] font-black ${value===o?"border-[#b7ff22] bg-[#b7ff22] text-[#111]":"border-[#34374c] bg-[#1b1d2f]"}`}>{o}</button>)}</div></div>}
function Range({label,value,setValue,min,max}:{label:string;value:number;setValue:(n:number)=>void;min:number;max:number}){return <div className="panel p-5"><div className="flex justify-between"><span className="text-[.55rem] font-black text-[#898da0]">{label}</span><b className="text-[#b7ff22]">{value} KM</b></div><input aria-label={label} type="range" min={min} max={max} value={value} onChange={e=>setValue(Number(e.target.value))} className="mt-5 w-full accent-[#b7ff22]"/></div>}
