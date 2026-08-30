import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { GameProvider } from "@/components/state/game-provider";

export const metadata:Metadata={title:{default:"RUN QUEST — Every Run Is A Quest",template:"%s | RUN QUEST"},description:"Turn your city into an adventure. Find quests, match with runners, run together and level up.",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"RUN QUEST"},icons:{icon:"/icon.svg",apple:"/icon.svg"}};
export const viewport:Viewport={themeColor:"#171720",width:"device-width",initialScale:1,maximumScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" style={{background:"#171720"}}><body style={{margin:0,background:"#171720",color:"#f8f8fc"}}><LanguageProvider><GameProvider><ServiceWorkerRegistration/><LanguageSwitcher/>{children}</GameProvider></LanguageProvider></body></html>}
