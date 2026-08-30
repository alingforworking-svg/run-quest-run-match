import Link from "next/link";
import { ArrowLeft,ArrowRight,LogIn,UserPlus } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function JoinPage(){return <main className="game-bg min-h-screen p-4 sm:p-5">
  <Logo href="/"/>
  <div className="mx-auto grid min-h-[calc(100vh-70px)] w-full max-w-md place-items-center py-8">
    <section className="w-full text-center">
      <p className="eyebrow">JOIN RUN QUEST</p>
      <h1 className="game-title mt-3 text-4xl sm:text-5xl">CHOOSE YOUR <span className="text-[#b6ff22]">PATH.</span></h1>
      <p className="muted mx-auto mt-4 max-w-sm text-xs leading-5">Create a new runner or continue with your existing account.</p>
      <div className="mt-8 grid gap-3">
        <Link href="/signup" className="game-shape flex min-h-28 items-center gap-4 rounded-[1.8rem_1.8rem_.8rem_1.8rem] bg-[#b6ff22] p-5 text-left text-[#171720] shadow-[0_16px_40px_rgba(183,255,34,.16)] transition hover:-translate-y-1">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#171720] text-[#b6ff22]"><UserPlus size={25}/></span>
          <span className="min-w-0 flex-1"><small className="block text-[.5rem] font-black tracking-[.14em]">NEW RUNNER</small><b className="mt-1 block text-lg">CREATE ACCOUNT</b><small className="mt-1 block text-[.55rem] font-bold opacity-70">Register a new runner profile</small></span>
          <ArrowRight size={20}/>
        </Link>
        <Link href="/login" className="panel flex min-h-24 items-center gap-4 p-5 text-left transition hover:border-[#7c42ff] hover:bg-[#292936]">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#7439ee] text-white"><LogIn size={24}/></span>
          <span className="min-w-0 flex-1"><small className="block text-[.5rem] font-black tracking-[.14em] text-[#9a9eaf]">EXISTING RUNNER</small><b className="mt-1 block text-lg">LOGIN</b><small className="mt-1 block text-[.55rem] font-bold text-[#8f93a5]">Continue your saved quest</small></span>
          <ArrowRight size={20} className="text-[#b6ff22]"/>
        </Link>
      </div>
      <Link href="/" className="mt-7 inline-flex items-center gap-2 text-[.58rem] font-black text-[#9296a8]"><ArrowLeft size={13}/>BACK</Link>
    </section>
  </div>
</main>}
