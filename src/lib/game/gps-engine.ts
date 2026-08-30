import type { GPSPoint } from "@/types/game";
import { haversine } from "./verification";

const LOCK_SAMPLES=3,LOCK_ACCURACY_METERS=30,MAX_ACCURACY_METERS=40,MAX_SPEED_MPS=12,MIN_MOVING_SPEED_MPS=.7;
export type GpsQuality="good"|"fair"|"poor";
export type GpsEngineSnapshot={locked:boolean;points:GPSPoint[];distanceKm:number;movingSeconds:number;isMoving:boolean;quality:GpsQuality;accuracy:number|null;accepted:number;rejected:number};
function qualityFor(accuracy:number):GpsQuality{return accuracy<=15?"good":accuracy<=30?"fair":"poor"}
function finiteSpeed(speed:number|null|undefined){return typeof speed==="number"&&Number.isFinite(speed)&&speed>=0?speed:null}
function smoothPoint(previous:GPSPoint,current:GPSPoint):GPSPoint{const accuracy=current.accuracy??99,dt=(current.timestamp-previous.timestamp)/1000;let alpha=accuracy<=10?.85:accuracy<=20?.65:accuracy<=30?.5:.35;if(dt>=3)alpha=Math.max(alpha,.75);return{...current,lat:previous.lat+(current.lat-previous.lat)*alpha,lng:previous.lng+(current.lng-previous.lng)*alpha}}

export class GpsEngine{
  private warmup:GPSPoint[]=[];private route:GPSPoint[]=[];private distance=0;private movingMs=0;private accepted=0;private rejected=0;private moving=false;private accuracy:number|null=null;private quality:GpsQuality="poor";private needsAnchor=false;
  ingest(raw:GPSPoint):GpsEngineSnapshot{
    const accuracy=Math.max(0,raw.accuracy??99);this.accuracy=accuracy;this.quality=qualityFor(accuracy);
    if(!Number.isFinite(raw.lat)||!Number.isFinite(raw.lng)||!Number.isFinite(raw.timestamp)){this.rejected++;return this.snapshot()}
    if(!this.route.length){if(accuracy>LOCK_ACCURACY_METERS){this.warmup=[];this.rejected++;return this.snapshot()}this.warmup.push({...raw,accuracy});if(this.warmup.length<LOCK_SAMPLES)return this.snapshot();const anchor=this.warmup.at(-1)!;this.route=[anchor];this.accepted=1;this.warmup=[];return this.snapshot()}
    if(accuracy>MAX_ACCURACY_METERS){this.rejected++;return this.snapshot()}
    const previous=this.route.at(-1)!;if(raw.timestamp<=previous.timestamp){this.rejected++;return this.snapshot()}
    if(this.needsAnchor){this.route.push({...raw,accuracy});this.needsAnchor=false;this.moving=false;this.accepted++;return this.snapshot()}
    const dt=(raw.timestamp-previous.timestamp)/1000;if(dt>30){this.route.push({...raw,accuracy});this.moving=false;this.accepted++;return this.snapshot()}
    const filtered=smoothPoint(previous,{...raw,accuracy}),segmentKm=haversine(previous,filtered),segmentMeters=segmentKm*1000,computedSpeed=segmentMeters/dt,deviceSpeed=finiteSpeed(raw.speed);
    if(computedSpeed>MAX_SPEED_MPS||(deviceSpeed!==null&&deviceSpeed>MAX_SPEED_MPS)){this.rejected++;this.moving=false;return this.snapshot()}
    const minMovement=Math.max(1.2,Math.min(previous.accuracy??accuracy,accuracy)*.08);if(segmentMeters<minMovement){this.rejected++;this.moving=false;return this.snapshot()}
    this.moving=deviceSpeed!==null?deviceSpeed>=MIN_MOVING_SPEED_MPS:computedSpeed>=MIN_MOVING_SPEED_MPS;if(!this.moving&&segmentMeters<Math.max(3,accuracy*.2)){this.rejected++;return this.snapshot()}
    this.route.push(filtered);this.distance+=segmentKm;if(this.moving)this.movingMs+=Math.min(dt,10)*1000;this.accepted++;return this.snapshot();
  }
  resume(){this.needsAnchor=true;this.moving=false}
  snapshot():GpsEngineSnapshot{return{locked:this.route.length>0,points:[...this.route],distanceKm:this.distance,movingSeconds:Math.round(this.movingMs/1000),isMoving:this.moving,quality:this.quality,accuracy:this.accuracy,accepted:this.accepted,rejected:this.rejected}}
}
export function compactGpsPoints(points:GPSPoint[],maxPoints=600){if(points.length<=2)return[...points];const kept=[points[0]];for(let i=1;i<points.length-1;i++){const last=kept.at(-1)!,point=points[i];if(point.timestamp-last.timestamp>=5000||haversine(last,point)>=.012)kept.push(point)}kept.push(points.at(-1)!);if(kept.length<=maxPoints)return kept;const result=[kept[0]],step=(kept.length-1)/(maxPoints-1);for(let i=1;i<maxPoints-1;i++)result.push(kept[Math.round(i*step)]);result.push(kept.at(-1)!);return result}
