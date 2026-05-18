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

type Theme = "dark" | "light"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function parseTheme(raw: string | null): Theme {
  return raw === "light" ? "light" : "dark"
}

function parsePerLine(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "1", 10)
  if (!Number.isFinite(parsed)) return 1
  if (parsed < 1) return 1
  if (parsed > 50) return 50
  return parsed
}

function splitCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function sanitizeFilename(name: string): string {
  const allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
  let out = ""
  for (const ch of name) {
    out += allowed.includes(ch) ? ch : "-"
  }
  return out
}

function withoutPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function isFileLike(value: unknown): value is { name: string; type: string; text: () => Promise<string> } {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.text === "function"
  )
}

async function fetchCustomIconSvg(env: Env, customPath: string, theme: Theme): Promise<string | null> {
  const baseUrl = trimTrailingSlash(env.SUPABASE_URL)
  const themedUrl = `${baseUrl}/storage/v1/object/public/icons/${customPath}-${theme}.svg`
  const themed = await fetch(themedUrl)
  if (themed.ok) {
    return themed.text()
  }

  const baseIconUrl = `${baseUrl}/storage/v1/object/public/icons/${customPath}.svg`
  const base = await fetch(baseIconUrl)
  if (!base.ok) {
    return null
  }

  return base.text()
}

async function resolveSvg(name: string, env: Env, theme: Theme): Promise<string | null> {
  if (name.startsWith("custom:")) {
    const customPath = withoutPrefix(name, "custom:")
    return fetchCustomIconSvg(env, customPath, theme)
  }

  const matched = fuzzyMatch(name)
  const key = resolveIcon(matched, theme)
  if (icons[key]) {
    return icons[key]
  }

  const baseKey = matched.toLowerCase().trim()
  return icons[baseKey] ?? null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname === "/custom-icons/upload" && request.method === "POST") {
      try {
        const form = await request.formData()
        const file = form.get("file")
        if (!isFileLike(file)) {
          return jsonResponse({ error: "missing_file" }, 400)
        }

        if (file.type !== "image/svg+xml") {
          return jsonResponse({ error: "invalid_file_type" }, 400)
        }

        const svgText = await file.text()
        if (!svgText.includes("<svg")) {
          return jsonResponse({ error: "invalid_svg" }, 400)
        }

        const rawName = file.name || "custom"
        const dotIndex = rawName.lastIndexOf(".")
        const baseName = dotIndex > 0 ? rawName.slice(0, dotIndex) : rawName
        const desiredName = baseName.toLowerCase()
        const desired = sanitizeFilename(desiredName)
        const id = Date.now().toString(36)
        const objectPath = desired ? `custom/${desired}-${id}` : `custom/${id}`

        if (!env.SUPABASE_SERVICE_ROLE_KEY) {
          return jsonResponse({ error: "server misconfigured" }, 500)
        }

        const baseUrl = trimTrailingSlash(env.SUPABASE_URL)
        const uploadUrl = `${baseUrl}/storage/v1/object/icons/${encodeURIComponent(objectPath)}.svg`
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "image/svg+xml",
            "x-upsert": "true",
          },
          body: svgText,
        })

        if (!uploadRes.ok) {
          const detail = await uploadRes.text()
          return jsonResponse({ error: "upload_failed", detail }, 502)
        }

        return jsonResponse({ objectPath })
      } catch (error) {
        const message = error instanceof Error ? error.message : "bad request"
        return jsonResponse({ error: "bad_request", message }, 400)
      }
    }

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
      return textResponse("not found", 404)
    }

    const raw = url.searchParams.get("i") ?? ""
    if (!raw) {
      return textResponse("missing ?i=param", 400)
    }

    const theme = parseTheme(url.searchParams.get("theme"))
    const perLine = parsePerLine(url.searchParams.get("perline"))
    const names = splitCsv(raw)

    const svgs: string[] = []
    for (const name of names) {
      const svg = await resolveSvg(name, env, theme)
      if (svg) {
        svgs.push(svg)
      }
    }

    if (svgs.length === 0) {
      return textResponse("no valid icons found", 400)
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
