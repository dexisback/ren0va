import iconsData from "../icons.json"
import { resolveIcon } from "./icons"
import { fuzzyMatch } from "./fuzzy"
import { generateSvg } from "./generate"
import { LANDING_HTML } from "./landing"
import { LANDING_ASSETS } from "./landing-assets"

// ---------------------------------------------------------------------------
// Data and Types
// ---------------------------------------------------------------------------

const icons = Object.fromEntries(
  Object.entries(iconsData).map(([k, v]) => [k.toLowerCase(), v])
) as Record<string, string>

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type Theme = "dark" | "light"
const MAX_UPLOAD_BYTES = 512 * 1024

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// ---------------------------------------------------------------------------
// Generic Helpers
// ---------------------------------------------------------------------------

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

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function withoutPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
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

// ---------------------------------------------------------------------------
// Upload Validation and Sanitization
// ---------------------------------------------------------------------------

type FileLike = { name: string; type: string; size: number; text: () => Promise<string> }


function isFileLike(value: unknown): value is FileLike {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.text === "function"
  )
}

function sanitizeAndNormalizeSvg(svgText: string): { svg: string | null; reason?: string } {
  const normalized = svgText.trim()
  const lower = normalized.toLowerCase()

  const start = lower.indexOf("<svg")
  const end = lower.lastIndexOf("</svg>")
  if (start < 0 || end < 0 || end <= start) return { svg: null, reason: "missing_svg_root" }

  const bannedFragments = ["<script", "javascript:", "data:text/html"]

  for (const fragment of bannedFragments) {
    if (lower.includes(fragment)) return { svg: null, reason: `blocked_fragment:${fragment}` }
  }

  // Normalize by returning only the main <svg>...</svg> block.
  return { svg: normalized.slice(start, end + "</svg>".length) }
}

function validateUploadFile(file: FileLike): string | null {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return "invalid_file_size"
  }
  if (file.type !== "image/svg+xml") {
    return "invalid_file_type"
  }
  if (!file.name.toLowerCase().endsWith(".svg")) {
    return "invalid_file_name"
  }
  return null
}

// ---------------------------------------------------------------------------
// Icon Resolution
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

function handlePreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function handleLandingPage(): Response {
  return new Response(LANDING_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function contentTypeForAsset(pathname: string): string {
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8"
  if (pathname.endsWith(".js")) return "application/javascript; charset=utf-8"
  if (pathname.endsWith(".map")) return "application/json; charset=utf-8"
  if (pathname.endsWith(".woff2")) return "font/woff2"
  if (pathname.endsWith(".woff")) return "font/woff"
  if (pathname.endsWith(".ttf")) return "font/ttf"
  return "application/octet-stream"
}

function handleLandingAsset(pathname: string): Response {
  const content = LANDING_ASSETS[pathname]
  if (!content) return textResponse("not found", 404)

  const body =
    content.encoding === "base64" ? Uint8Array.from(atob(content.data), (c) => c.charCodeAt(0)) : content.data

  return new Response(body, {
    headers: {
      "Content-Type": contentTypeForAsset(pathname),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const startTotal = performance.now()
  const timings: string[] = []

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!isFileLike(file)) {
      return jsonResponse({ error: "missing_file" }, 400)
    }

    const validationError = validateUploadFile(file)
    if (validationError) {
      return jsonResponse({ error: validationError }, 400)
    }

    const startSanitize = performance.now()
    const rawSvg = await file.text()
    const sanitized = sanitizeAndNormalizeSvg(rawSvg)
    if (!sanitized.svg) {
      return jsonResponse({ error: "invalid_svg", reason: sanitized.reason ?? "unknown" }, 400)
    }
    timings.push(`sanitize;dur=${(performance.now() - startSanitize).toFixed(2)}`)

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

    const startUpload = performance.now()
    //NOTE: direct service trip from supabase to worker (No signed URL round-trip needed)
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
      body: sanitized.svg,
    })

    if (!uploadRes.ok) {
      const detail = await uploadRes.text()
      return jsonResponse({ error: "upload_failed", detail }, 502)
    }
    timings.push(`upload;dur=${(performance.now() - startUpload).toFixed(2)}`)

    timings.push(`total;dur=${(performance.now() - startTotal).toFixed(2)}`)

    return new Response(JSON.stringify({ objectPath }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Server-Timing": timings.join(", "),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "bad request"
    return jsonResponse({ error: "bad_request", message }, 400)
  }
}

async function handleIcons(url: URL, env: Env): Promise<Response> {
  const startTotal = performance.now()
  const timings: string[] = []

  const raw = url.searchParams.get("i") ?? ""
  if (!raw) {
    return textResponse("missing ?i=param", 400)
  }

  const theme = parseTheme(url.searchParams.get("theme"))
  const perLine = parsePerLine(url.searchParams.get("perline"))
  const names = splitCsv(raw)

  const startResolve = performance.now()
  const svgs: string[] = []
  for (const name of names) {
    const svg = await resolveSvg(name, env, theme)
    if (svg) {
      svgs.push(svg)
    }
  }
  timings.push(`resolve;dur=${(performance.now() - startResolve).toFixed(2)}`)

  if (svgs.length === 0) {
    return textResponse("no valid icons found", 400)
  }

  const startGenerate = performance.now()
  const output = generateSvg(svgs, perLine)
  timings.push(`generate;dur=${(performance.now() - startGenerate).toFixed(2)}`)

  timings.push(`total;dur=${(performance.now() - startTotal).toFixed(2)}`)

  return new Response(output, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Server-Timing": timings.join(", "),
    },
  })
}

// ---------------------------------------------------------------------------
// Worker Entry
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return handlePreflight()
    }

    if (url.pathname === "/custom-icons/upload" && request.method === "POST") {
      return handleUpload(request, env)
    }

    if (url.pathname === "/") {
      return handleLandingPage()
    }

    if (url.pathname.startsWith("/_astro/") && request.method === "GET") {
      return handleLandingAsset(url.pathname)
    }

    if (url.pathname === "/icons" && request.method === "GET") {
      return handleIcons(url, env)
    }

    return textResponse("not found", 404)
  },
}
