"use client";

import { useCallback,useEffect,useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Coordinates,RunSpot } from "@/types/game";

const ROUTE_STORAGE_KEY="runquest-public-routes-v1";
const SPOT_COLUMNS="id,user_id,owner_name,owner_avatar,title,note,latitude,longitude,distance_km,pace_label,starts_at,expires_at,join_count,has_route,created_at,party_id,max_members";
export const MAX_MAP_RUN_SPOTS=100;
const cap=(spots:RunSpot[])=>spots.slice(0,MAX_MAP_RUN_SPOTS);

type CreateRunSpot={ownerId:string;ownerName:string;ownerAvatar:string;title:string;note:string;distanceKm:number;pace:string;startsAt:string;maxMembers?:number;position:Coordinates;route?:Coordinates[]};
type DbSpot={id:string;user_id:string;owner_name:string;owner_avatar:string|null;title:string;note:string|null;latitude:number;longitude:number;distance_km:number|null;pace_label:string|null;starts_at:string;expires_at:string;join_count:number;has_route:boolean;created_at:string;party_id:string|null;max_members:number};
const fromDb=(spot:DbSpot):RunSpot=>({id:spot.id,ownerId:spot.user_id,ownerName:spot.owner_name,ownerAvatar:spot.owner_avatar||"🏃",title:spot.title,note:spot.note||"",lat:spot.latitude,lng:spot.longitude,distanceKm:Number(spot.distance_km||0),pace:spot.pace_label||"NO PRESSURE",startsAt:spot.starts_at,expiresAt:spot.expires_at,joinCount:spot.join_count||0,maxMembers:Number(spot.max_members||6),partyId:spot.party_id||null,joined:false,hasRoute:Boolean(spot.has_route),createdAt:spot.created_at,source:"supabase"});
function saveLocalRoute(id:string,route:Coordinates[]){if(!route.length)return;try{const routes=JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY)||"{}") as Record<string,Coordinates[]>;routes[id]=route;localStorage.setItem(ROUTE_STORAGE_KEY,JSON.stringify(routes))}catch{/* Ignore unavailable storage. */}}
function requestError(value:unknown,fallback:string){if(value instanceof Error)return value;if(value&&typeof value==="object"&&"message" in value&&typeof value.message==="string")return new Error(value.message);return new Error(fallback)}

export function useRunSpots(){
  const [spots,setSpots]=useState<RunSpot[]>([]),[viewerId,setViewerId]=useState("");
  const load=useCallback(async()=>{
    const client=createClient();if(!client)return;
    const [{data:spotRows},{data:{user}}]=await Promise.all([client.from("run_spots").select(SPOT_COLUMNS).eq("status","active").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(MAX_MAP_RUN_SPOTS),client.auth.getUser()]);
    setViewerId(user?.id||"");let joinedIds=new Set<string>();
    if(user){const {data:joins}=await client.from("run_spot_joins").select("run_spot_id").eq("user_id",user.id);joinedIds=new Set((joins||[]).map(join=>join.run_spot_id))}
    setSpots(cap((spotRows||[] as unknown as DbSpot[]).map(row=>{const spot=fromDb(row as unknown as DbSpot);return{...spot,joined:spot.ownerId===user?.id||joinedIds.has(spot.id)}})));
  },[]);

  useEffect(()=>{void load();const client=createClient();if(!client)return;const channel=client.channel("public-run-spots-live").on("postgres_changes",{event:"*",schema:"public",table:"run_spots"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"run_spot_joins"},()=>void load()).subscribe();return()=>{void client.removeChannel(channel)}},[load]);

  const createSpot=useCallback(async(input:CreateRunSpot)=>{const client=createClient();if(!client)throw new Error("Live database is not configured");const {data:{user}}=await client.auth.getUser();if(!user)throw new Error("Login required");const {data,error}=await client.rpc("create_public_run_spot",{p_title:input.title,p_note:input.note,p_latitude:input.position.lat,p_longitude:input.position.lng,p_distance_km:input.distanceKm,p_pace_label:input.pace,p_starts_at:input.startsAt,p_max_members:input.maxMembers||6,p_route_points:input.route||null});if(error||!data)throw requestError(error,"Run spot was not saved");const row=(Array.isArray(data)?data[0]:data) as unknown as DbSpot,saved={...fromDb(row),joined:true};setViewerId(user.id);setSpots(current=>cap([saved,...current.filter(spot=>spot.id!==saved.id)]));if(input.route)saveLocalRoute(saved.id,input.route);return saved},[]);
  const joinSpot=useCallback(async(id:string)=>{const client=createClient();if(!client)throw new Error("Live database is not configured");const {data:{user}}=await client.auth.getUser();if(!user)throw new Error("Login required");const target=spots.find(spot=>spot.id===id);if(target?.partyId&&(target.joined||target.ownerId===user.id))return target.partyId;const {data,error}=await client.rpc("join_public_run_spot",{p_spot_id:id});if(error||!data)throw requestError(error,"Could not join this run");await load();return String(data)},[load,spots]);
  const leaveSpot=useCallback(async(id:string)=>{const client=createClient();if(!client)throw new Error("Live database is not configured");const {error}=await client.rpc("leave_public_run_spot",{p_spot_id:id});if(error)throw requestError(error,"Could not leave this run");await load()},[load]);
  const cancelSpot=useCallback(async(id:string)=>{const client=createClient();if(!client)throw new Error("Live database is not configured");const {error}=await client.rpc("cancel_public_run_spot",{p_spot_id:id});if(error)throw requestError(error,"Could not cancel this run");setSpots(current=>current.filter(spot=>spot.id!==id))},[]);
  const loadRoute=useCallback(async(id:string)=>{try{const local=JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY)||"{}") as Record<string,Coordinates[]>;if(local[id]?.length)return local[id]}catch{/* Continue to database. */}const client=createClient();if(!client)return[];const {data}=await client.from("run_spots").select("route_points").eq("id",id).single();return Array.isArray(data?.route_points)?data.route_points as Coordinates[]:[]},[]);
  return{spots,viewerId,createSpot,joinSpot,leaveSpot,cancelSpot,loadRoute,reload:load};
}
