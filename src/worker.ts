import iconsData from "../icons.json"
import { resolveIcon } from "./icons"
import { fuzzyMatch } from "./fuzzy"
import { generateSvg } from "./generate"


const icons = iconsData as Record<string, string>

type Env = {
    SUPABASE_URL: string
}


export default {
    async fetch(request: Request, env: Env): Promise<Response>{
        const url = new URL(request.url)
        if(url.pathname === "/"){
            return new Response("renova landing page")
        }
        if
    }
}