import type { Coordinates } from "@/types/game";

const EARTH_RADIUS_M=6_371_000;
export function routeDistanceMeters(a:Coordinates,b:Coordinates){const dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180,q=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;return 2*EARTH_RADIUS_M*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}

export function simplifyRoute(points:Coordinates[],minimumSpacingMeters=12){if(points.length<3)return points;const kept=[points[0]];for(let index=1;index<points.length-1;index++)if(routeDistanceMeters(kept.at(-1)!,points[index])>=minimumSpacingMeters)kept.push(points[index]);if(routeDistanceMeters(kept.at(-1)!,points.at(-1)!)>1)kept.push(points.at(-1)!);return kept}

export function createPublicRoute(points:Coordinates[],privacyMeters=150){if(points.length<3)return[];let start=0,startDistance=0;while(start<points.length-2&&startDistance<privacyMeters){startDistance+=routeDistanceMeters(points[start],points[start+1]);start++}let end=points.length-1,endDistance=0;while(end>start+1&&endDistance<privacyMeters){endDistance+=routeDistanceMeters(points[end],points[end-1]);end--}if(start>=end||startDistance<privacyMeters||endDistance<privacyMeters)return[];const publicPoints=simplifyRoute(points.slice(start,end+1),15);return publicPoints.length>=2?publicPoints:[]}
