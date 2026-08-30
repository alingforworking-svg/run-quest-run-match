import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{return{name:"RUN QUEST",short_name:"RUN QUEST",description:"Every run is a quest.",start_url:"/home",display:"standalone",background_color:"#171720",theme_color:"#171720",orientation:"portrait",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"maskable"}]}}
