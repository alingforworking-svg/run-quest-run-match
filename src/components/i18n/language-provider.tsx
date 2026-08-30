"use client";
import { createContext,useCallback,useContext,useEffect,useMemo,useState } from "react";
import { translate,type Language } from "@/lib/i18n/translations";

interface LanguageValue{language:Language;setLanguage:(language:Language)=>void}
const LanguageContext=createContext<LanguageValue>({language:"en",setLanguage:()=>undefined});
const originalText=new WeakMap<Text,string>();const lastRendered=new WeakMap<Text,string>();

function translateTree(root:Node,language:Language){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
  while((node=walker.nextNode())){
    const text=node as Text;const parent=text.parentElement;if(!parent||parent.closest("[data-no-translate]")||["SCRIPT","STYLE","NOSCRIPT","TEXTAREA","CODE"].includes(parent.tagName))continue;
    const previous=lastRendered.get(text);if(!originalText.has(text)||(previous!==undefined&&text.data!==previous))originalText.set(text,text.data);
    const source=originalText.get(text)??text.data;const leading=source.match(/^\s*/)?.[0]??"";const trailing=source.match(/\s*$/)?.[0]??"";const core=source.trim();
    const next=core?leading+translate(core,language)+trailing:source;lastRendered.set(text,next);if(text.data!==next)text.data=next;
  }
}

export function LanguageProvider({children}:{children:React.ReactNode}){
  const [language,setLanguageState]=useState<Language>("en");
  const setLanguage=useCallback((next:Language)=>{setLanguageState(next);localStorage.setItem("runquest-language",next);document.cookie=`runquest-language=${next};path=/;max-age=31536000;samesite=lax`},[]);
  useEffect(()=>{const saved=localStorage.getItem("runquest-language") as Language|null;if(saved&&["en","th","lo"].includes(saved))setLanguageState(saved)},[]);
  useEffect(()=>{document.documentElement.lang=language;translateTree(document.body,language);const observer=new MutationObserver(records=>{for(const record of records){if(record.type==="characterData")translateTree(record.target.parentNode??record.target,language);record.addedNodes.forEach(node=>translateTree(node,language))}});observer.observe(document.body,{subtree:true,childList:true,characterData:true});return()=>observer.disconnect()},[language]);
  const value=useMemo(()=>({language,setLanguage}),[language,setLanguage]);return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
export const useLanguage=()=>useContext(LanguageContext);
