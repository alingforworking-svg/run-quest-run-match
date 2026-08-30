import {AppShell} from "@/components/layout/app-shell";
import {GameMapLoader} from "@/components/map/game-map-loader";
import {PublicRunList} from "@/components/game/public-run-list";

export default function Explore(){return <AppShell title="QUESTS"><main className="mx-auto max-w-7xl px-4 py-7 md:px-8"><div><p className="eyebrow">VIENTIANE • PUBLIC RUN MAP</p><h1 className="game-title mt-2 text-4xl md:text-5xl">FIND YOUR NEXT <span className="text-[#b7ff22]">RUN.</span></h1></div><div className="mt-5 h-[430px] min-h-[400px] md:h-[58vh] md:min-h-[520px]"><GameMapLoader worldId="public-runs"/></div><PublicRunList/></main></AppShell>}
