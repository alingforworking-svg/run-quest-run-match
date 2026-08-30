import Link from "next/link";import { AuthForm } from "@/components/auth/auth-form";import { Logo } from "@/components/ui/logo";
export default function Login(){return <main className="game-bg min-h-screen p-5"><Logo href="/"/><div className="grid min-h-[calc(100vh-70px)] place-items-center py-8"><AuthForm mode="login"/></div></main>}
