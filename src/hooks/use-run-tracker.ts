"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {GPSPoint} from "@/types/game";
import {compactGpsPoints,GpsEngine,type GpsQuality} from "@/lib/game/gps-engine";

export type GpsStatus="idle"|"requesting"|"locking"|"active"|"denied"|"unavailable"|"insecure"|"error";
export function useRunTracker(){
  const [status,setStatusState]=useState<"idle"|"running"|"paused"|"ended">("idle"),[gpsStatus,setGpsStatus]=useState<GpsStatus>("idle"),[points,setPoints]=useState<GPSPoint[]>([]),[elapsed,setElapsed]=useState(0),[movingElapsed,setMovingElapsed]=useState(0),[distanceKm,setDistanceKm]=useState(0),[gpsQuality,setGpsQuality]=useState<GpsQuality>("poor"),[accuracy,setAccuracy]=useState<number|null>(null),[isMoving,setIsMoving]=useState(false);
  const statusRef=useRef(status),watch=useRef<number|null>(null),engine=useRef(new GpsEngine());
  const setStatus=(next:typeof status)=>{statusRef.current=next;setStatusState(next)};
  const stopWatch=useCallback(()=>{if(watch.current!==null&&"geolocation" in navigator){navigator.geolocation.clearWatch(watch.current);watch.current=null}},[]);
  const watchGps=useCallback(()=>{stopWatch();if(!window.isSecureContext){setGpsStatus("insecure");return}if(!("geolocation" in navigator)){setGpsStatus("unavailable");return}setGpsStatus("requesting");watch.current=navigator.geolocation.watchPosition(position=>{
    if(statusRef.current!=="running")return;
    const snapshot=engine.current.ingest({lat:position.coords.latitude,lng:position.coords.longitude,timestamp:position.timestamp,accuracy:position.coords.accuracy,speed:position.coords.speed});
    setAccuracy(snapshot.accuracy);setGpsQuality(snapshot.quality);setGpsStatus(snapshot.locked?"active":"locking");setIsMoving(snapshot.isMoving);
    if(snapshot.locked){setPoints(snapshot.points);setDistanceKm(snapshot.distanceKm);setMovingElapsed(snapshot.movingSeconds)}
  },error=>setGpsStatus(error.code===error.PERMISSION_DENIED?"denied":error.code===error.POSITION_UNAVAILABLE?"unavailable":"error"),{enableHighAccuracy:true,maximumAge:0,timeout:20000})},[stopWatch]);
  const start=useCallback(()=>{engine.current=new GpsEngine();setPoints([]);setElapsed(0);setMovingElapsed(0);setDistanceKm(0);setAccuracy(null);setIsMoving(false);setStatus("running");watchGps()},[watchGps]);
  const pause=()=>{if(statusRef.current==="paused"){engine.current.resume();setStatus("running")}else{setIsMoving(false);setStatus("paused")}};
  const end=()=>{setStatus("ended");stopWatch()};const retryGps=()=>watchGps();
  useEffect(()=>{if(status!=="running"||gpsStatus!=="active")return;const timer=window.setInterval(()=>setElapsed(v=>v+1),1000);return()=>window.clearInterval(timer)},[status,gpsStatus]);
  useEffect(()=>stopWatch,[stopWatch]);
  const pace=distanceKm>.01&&movingElapsed>0?movingElapsed/60/distanceKm:0,storagePoints=compactGpsPoints(points);
  return{status,gpsStatus,gpsQuality,accuracy,isMoving,points,storagePoints,elapsed,movingElapsed,distanceKm,pace,start,pause,end,retryGps};
}
