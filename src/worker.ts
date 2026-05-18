import iconsData from "../icons.json"
import { resolveIcon } from "./icons"
import { fuzzyMatch } from "./fuzzy"
import { generateSvg } from "./generate"
import { LANDING_HTML } from "./landing"

const icons = Object.fromEntries(
    Object.entries(iconsData).map(([k, v]) => [k.toLowerCase(), v])
) as Record<string, string>

type Env = {
    SUPABASE_URL: string
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url)

        // Landing page
        if (url.pathname === "/") {
            return new Response(LANDING_HTML, {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*",
                },
            })
        }

        if (url.pathname !== "/icons") {
            return new Response("not found", { status: 404 })
        }

        const raw = url.searchParams.get("i") ?? ""
        const theme = url.searchParams.get("theme") === "light" ? "light" : "dark"
        const parsedPerLine = Number.parseInt(url.searchParams.get("perline") ?? "1", 10)
        const perLine = Number.isFinite(parsedPerLine)
            ? Math.min(Math.max(parsedPerLine, 1), 50)
            : 1

        if (!raw) {
            return new Response("missing ?i=param", { status: 400 })
        }

        const names = raw.split(",").map(name => name.trim()).filter(Boolean)
        const svgs: string[] = []

        for (const name of names) {
            if (name.startsWith("custom:")) {
                const customPath = name.replace("custom:", "")
                const supabaseUrl = `${env.SUPABASE_URL}/storage/v1/object/public/icons/${customPath}-${theme}.svg`

                const response = await fetch(supabaseUrl)
                if (!response.ok) {
                    continue
                }

                svgs.push(await response.text())
                continue
            }

            const matched = fuzzyMatch(name)
            const key = resolveIcon(matched, theme)
            let svg = icons[key]

            // Fallback: if theme-suffixed key doesn't exist, try base name without theme
            if (!svg && theme !== matched) {
                const baseKey = matched.toLowerCase().trim()
                svg = icons[baseKey]
            }

            if (svg) {
                svgs.push(svg)
            }
        }

        if (svgs.length === 0) {
            return new Response("no valid icons found", { status: 400 })
        }

        const output = generateSvg(svgs, perLine)

        return new Response(output, {
            headers: {
                "Content-Type": "image/svg+xml",
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
            },
        })
    },
}