import { NextResponse } from "next/server";

const TILE_TTL_SECONDS=60*60*24*7;

function tileNumber(value:string){
  if(!/^\d+$/.test(value))return null;
  const number=Number(value);
  return Number.isSafeInteger(number)?number:null;
}

export async function GET(_request:Request,{params}:{params:Promise<{z:string;x:string;y:string}>}){
  const raw=await params,z=tileNumber(raw.z),x=tileNumber(raw.x),y=tileNumber(raw.y);
  if(z===null||x===null||y===null||z<0||z>19||x<0||y<0||x>=2**z||y>=2**z)return NextResponse.json({error:"Invalid map tile"},{status:400});

  try{
    const upstream=await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`,{
      headers:{"User-Agent":"RUN-QUEST/1.0 (interactive running quest map)"},
      next:{revalidate:TILE_TTL_SECONDS},
    });
    if(!upstream.ok)throw new Error(`Tile upstream returned ${upstream.status}`);
    return new Response(await upstream.arrayBuffer(),{headers:{
      "Content-Type":"image/png",
      "Cache-Control":`public, max-age=${TILE_TTL_SECONDS}, s-maxage=${TILE_TTL_SECONDS}, stale-while-revalidate=86400`,
      "X-Content-Type-Options":"nosniff",
    }});
  }catch{
    return NextResponse.json({error:"Map tile temporarily unavailable"},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
