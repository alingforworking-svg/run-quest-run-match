import type { GPSPoint, VerificationResult } from "@/types/game";
const R=6371;
export function haversine(a:GPSPoint,b:GPSPoint){const dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;const q=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
export function verifyRun(points:GPSPoint[]):VerificationResult{
  let score=100,distanceKm=0,maxSpeedKmh=0,jumpCount=0;const flags:string[]=[];
  for(let i=1;i<points.length;i++){const d=haversine(points[i-1],points[i]);distanceKm+=d;const hours=(points[i].timestamp-points[i-1].timestamp)/3_600_000;const speed=hours>0?d/hours:999;maxSpeedKmh=Math.max(maxSpeedKmh,speed);if(speed>28){score-=12;jumpCount++}}
  if(jumpCount){flags.push(`${jumpCount} impossible GPS jump${jumpCount>1?"s":""}`)}
  if(points.length<3){score-=40;flags.push("Insufficient GPS samples")}
  const gaps=points.slice(1).filter((p,i)=>p.timestamp-points[i].timestamp>120_000).length;if(gaps){score-=Math.min(25,gaps*8);flags.push(`${gaps} missing GPS segment${gaps>1?"s":""}`)}
  score=Math.max(0,score);return{score,verified:score>=75,flags,stats:{distanceKm:Number(distanceKm.toFixed(2)),maxSpeedKmh:Number(maxSpeedKmh.toFixed(1)),jumpCount}};
}
