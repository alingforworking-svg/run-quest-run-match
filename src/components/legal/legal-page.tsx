import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: React.ReactNode }) {
  return <main className="game-bg min-h-screen px-4 py-6 text-[#f8f8fc] md:px-8 md:py-10"><div className="mx-auto max-w-4xl">
    <header className="flex items-center justify-between border-b border-[#343647] pb-5"><Logo href="/"/><Link className="text-xs font-black text-[#b6ff22]" href="/">BACK HOME</Link></header>
    <article className="mt-8 rounded-[2rem] border border-[#3b3d50] bg-[#20212d] p-6 shadow-2xl md:p-10">
      <p className="text-xs font-black tracking-[.2em] text-[#b6ff22]">{eyebrow}</p><h1 className="game-title mt-3 text-4xl md:text-6xl">{title}</h1><p className="mt-3 text-xs text-[#a5a7b7]">Last updated: {updated}</p>
      <div className="mt-8 space-y-7 text-sm leading-7 text-[#d2d3dc]">{children}</div>
    </article>
    <footer className="flex flex-wrap justify-center gap-5 py-7 text-xs font-bold text-[#a5a7b7]"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><Link href="/safety">Safety</Link></footer>
  </div></main>;
}

export function LegalSection({title,children}:{title:string;children:React.ReactNode}){return <section><h2 className="mb-2 text-lg font-black text-white">{title}</h2>{children}</section>}
