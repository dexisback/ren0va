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
    SUPABASE_SERVICE_ROLE_KEY?: string
}
//worker fetch handler (checks url, routes) (all standard web apis)
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url)

        // CORS preflight for upload endpoints
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            })
        }

        // Upload URL generation for custom icons
        if (url.pathname === '/custom-icons/upload-url' && request.method === 'POST') {
            try {
                const body: any = await request.json()
                const desired = (body && body.filename) ? String(body.filename).replace(/[^a-z0-9_\-]/gi, '-') : ''
                const id = Date.now().toString(36)
                const objectPath = desired ? `custom/${desired}-${id}` : `custom/${id}`

                // call Supabase signed URL endpoint
                if (!env.SUPABASE_SERVICE_ROLE_KEY) {
                    return new Response(JSON.stringify({ error: 'server misconfigured' }), { status: 500 })
                }

                const signUrl = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/icons/${encodeURIComponent(objectPath)}`

                const signRes = await fetch(signUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ expiresIn: 60 })
                })

                if (!signRes.ok) {
                    const text = await signRes.text()
                    return new Response(JSON.stringify({ error: 'sign_failed', detail: text }), { status: 502 })
                }

                const signed: any = await signRes.json()

                return new Response(JSON.stringify({ uploadUrl: signed.signedURL ?? signed.signedUrl ?? signed.signed_url, objectPath }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    }
                })
            } catch (err: any) {
                return new Response(JSON.stringify({ error: 'bad_request', message: err.message }), { status: 400 })
            }
        }

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
                const supabaseUrlTheme = `${env.SUPABASE_URL}/storage/v1/object/public/icons/${customPath}-${theme}.svg`

                let response = await fetch(supabaseUrlTheme)
                if (!response.ok) {
                    // fallback to base customPath.svg
                    const supabaseUrlBase = `${env.SUPABASE_URL}/storage/v1/object/public/icons/${customPath}.svg`
                    response = await fetch(supabaseUrlBase)
                    if (!response.ok) {
                        continue
                    }
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