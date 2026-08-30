import type { Checkpoint, Coordinates } from "@/types/game";
export interface RouteResult { coordinates:Coordinates[];distanceKm:number;durationMinutes:number }
export interface RoutingProvider { getWalkingRoute(points:Coordinates[]):Promise<RouteResult>;getRouteDistance(points:Coordinates[]):Promise<number>;getRouteDuration(points:Coordinates[]):Promise<number>;validateCheckpoint(position:Coordinates,checkpoint:Checkpoint):boolean }
const distance=(a:Coordinates,b:Coordinates)=>Math.hypot((a.lat-b.lat)*111,(a.lng-b.lng)*105);
export class LocalRouteCalculator implements RoutingProvider{
 async getWalkingRoute(points:Coordinates[]){const distanceKm=await this.getRouteDistance(points);return{coordinates:points,distanceKm,durationMinutes:Math.round(distanceKm*8)}}
 async getRouteDistance(points:Coordinates[]){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0)}
 async getRouteDuration(points:Coordinates[]){return Math.round((await this.getRouteDistance(points))*8)}
 validateCheckpoint(position:Coordinates,checkpoint:Checkpoint){return distance(position,checkpoint)*1000<=checkpoint.radiusMeters}
}
export const routingProvider:RoutingProvider=new LocalRouteCalculator();
