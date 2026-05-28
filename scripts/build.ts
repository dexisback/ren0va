import fs from "fs"
import path from "path"

const ICONS_DIR = path.join(process.cwd(), "icons", "processed-svg")
const OUTPUT_FILE = path.join(process.cwd(), "icons.json")
const DARK_FG = "#f8fafc"

type Rgb = { r: number; g: number; b: number }

function clampByte(value: number): number {
    if (!Number.isFinite(value)) return 0
    if (value < 0) return 0
    if (value > 255) return 255
    return Math.round(value)
}

function normalizeToken(value: string): string {
    return value.trim().toLowerCase()
}

function isIgnoredPaintValue(value: string): boolean {
    const token = normalizeToken(value)
    return (
        token === "" ||
        token === "none" ||
        token === "transparent" ||
        token === "inherit" ||
        token === "currentcolor" ||
        token.startsWith("url(") ||
        token.startsWith("var(")
    )
}

function parseHexColor(value: string): Rgb | null {
    const token = normalizeToken(value)
    if (!token.startsWith("#")) return null
    const hex = token.slice(1)

    if (hex.length === 3 || hex.length === 4) {
        const rHex = hex.charAt(0)
        const gHex = hex.charAt(1)
        const bHex = hex.charAt(2)
        const r = parseInt(rHex + rHex, 16)
        const g = parseInt(gHex + gHex, 16)
        const b = parseInt(bHex + bHex, 16)
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
        return { r, g, b }
    }

    if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
        return { r, g, b }
    }

    return null
}

function parseRgbFunction(value: string): Rgb | null {
    const token = normalizeToken(value)
    const match = token.match(/^rgba?\(([^)]+)\)$/)
    if (!match) return null
    const body = match[1]
    if (!body) return null

    const parts = body
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)

    if (parts.length < 3) return null

    const toByte = (part: string) => {
        if (part.endsWith("%")) {
            const asPercent = Number.parseFloat(part.slice(0, -1))
            if (!Number.isFinite(asPercent)) return NaN
            return clampByte((asPercent / 100) * 255)
        }
        const numeric = Number.parseFloat(part)
        return Number.isFinite(numeric) ? clampByte(numeric) : NaN
    }

    const first = parts[0]
    const second = parts[1]
    const third = parts[2]
    if (!first || !second || !third) return null

    const r = toByte(first)
    const g = toByte(second)
    const b = toByte(third)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null

    return { r, g, b }
}

function hue2rgb(p: number, q: number, t: number): number {
    let temp = t
    if (temp < 0) temp += 1
    if (temp > 1) temp -= 1
    if (temp < 1 / 6) return p + (q - p) * 6 * temp
    if (temp < 1 / 2) return q
    if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6
    return p
}

function parseHslFunction(value: string): Rgb | null {
    const token = normalizeToken(value)
    const match = token.match(/^hsla?\(([^)]+)\)$/)
    if (!match) return null
    const body = match[1]
    if (!body) return null

    const parts = body
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)

    if (parts.length < 3) return null

    const rawH = parts[0]
    const rawS = parts[1]
    const rawL = parts[2]
    if (!rawH || !rawS || !rawL) return null

    const h = Number.parseFloat(rawH)
    const sRaw = rawS.endsWith("%") ? Number.parseFloat(rawS.slice(0, -1)) : Number.parseFloat(rawS)
    const lRaw = rawL.endsWith("%") ? Number.parseFloat(rawL.slice(0, -1)) : Number.parseFloat(rawL)

    if (!Number.isFinite(h) || !Number.isFinite(sRaw) || !Number.isFinite(lRaw)) return null

    const s = Math.max(0, Math.min(1, sRaw / 100))
    const l = Math.max(0, Math.min(1, lRaw / 100))
    const hue = ((h % 360) + 360) % 360 / 360

    if (s === 0) {
        const gray = clampByte(l * 255)
        return { r: gray, g: gray, b: gray }
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    return {
        r: clampByte(hue2rgb(p, q, hue + 1 / 3) * 255),
        g: clampByte(hue2rgb(p, q, hue) * 255),
        b: clampByte(hue2rgb(p, q, hue - 1 / 3) * 255),
    }
}

function parseNamedColor(value: string): Rgb | null {
    const token = normalizeToken(value)
    if (token === "black") return { r: 0, g: 0, b: 0 }
    if (token === "white") return { r: 255, g: 255, b: 255 }
    if (token === "gray" || token === "grey") return { r: 128, g: 128, b: 128 }
    return null
}

function parseColor(value: string): Rgb | null {
    if (isIgnoredPaintValue(value)) return null
    return parseHexColor(value) ?? parseRgbFunction(value) ?? parseHslFunction(value) ?? parseNamedColor(value)
}

function collectPaintValues(svg: string): string[] {
    const paints: string[] = []

    const attrRegex = /\b(?:fill|stroke|color|stop-color)\s*=\s*["']([^"']+)["']/gi
    for (const match of svg.matchAll(attrRegex)) {
        if (match[1]) paints.push(match[1])
    }

    const styleRegex = /\bstyle\s*=\s*["']([^"']*)["']/gi
    for (const match of svg.matchAll(styleRegex)) {
        const style = match[1] ?? ""
        const declarations = style.split(";")
        for (const declaration of declarations) {
            const [rawKey, rawValue] = declaration.split(":")
            if (!rawKey || !rawValue) continue
            const key = normalizeToken(rawKey)
            if (key === "fill" || key === "stroke" || key === "color" || key === "stop-color") {
                paints.push(rawValue)
            }
        }
    }

    return paints
}

function isGrayscale(color: Rgb): boolean {
    return Math.abs(color.r - color.g) < 14 && Math.abs(color.g - color.b) < 14 && Math.abs(color.r - color.b) < 14
}

function luminance(color: Rgb): number {
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
}

function shouldRecolorToken(value: string): boolean {
    const color = parseColor(value)
    if (!color) return false
    return isGrayscale(color) && luminance(color) < 96
}

function isChromaticToken(value: string): boolean {
    const color = parseColor(value)
    if (!color) return false
    return !isGrayscale(color)
}

function rewriteStyleValue(styleValue: string): string {
    const declarations = styleValue.split(";")
    const updated = declarations.map((declaration) => {
        const idx = declaration.indexOf(":")
        if (idx < 0) return declaration

        const key = declaration.slice(0, idx)
        const value = declaration.slice(idx + 1)
        const normalizedKey = normalizeToken(key)
        if (normalizedKey === "fill" || normalizedKey === "stroke" || normalizedKey === "color" || normalizedKey === "stop-color") {
            return shouldRecolorToken(value) ? `${key}:${DARK_FG}` : declaration
        }

        return declaration
    })

    return updated.join(";")
}

function normalizeDarkMonochromeSvg(fileName: string, svg: string): string {
    if (!/-dark$/i.test(fileName)) return svg

    const paints = collectPaintValues(svg)
    if (paints.length === 0) return svg

    const hasDarkMonochrome = paints.some(shouldRecolorToken)
    if (!hasDarkMonochrome) return svg

    const attrsRewritten = svg.replace(
        /(\b(?:fill|stroke|color|stop-color)\s*=\s*["'])([^"']+)(["'])/gi,
        (_full, prefix: string, value: string, suffix: string) => {
            if (!shouldRecolorToken(value)) return `${prefix}${value}${suffix}`
            return `${prefix}${DARK_FG}${suffix}`
        }
    )

    return attrsRewritten.replace(
        /(\bstyle\s*=\s*["'])([^"']*)(["'])/gi,
        (_full, prefix: string, style: string, suffix: string) => {
            return `${prefix}${rewriteStyleValue(style)}${suffix}`
        }
    )
}

function buildFile() {
    if (!fs.existsSync(ICONS_DIR)) {
        throw new Error(`Missing icon directory: ${ICONS_DIR}`)
    }

    const result: Record<string, string> = {}
    const files = fs.readdirSync(ICONS_DIR)

    for (const file of files) {
        if (!file.endsWith(".svg")) continue

        const fileName = file.replace(/\.svg$/, "")
        const filePath = path.join(ICONS_DIR, file)
        const fileContent = fs.readFileSync(filePath, "utf-8").trim()
        const normalizedForTheme = normalizeDarkMonochromeSvg(fileName, fileContent)

        result[fileName] = normalizedForTheme
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf-8")
    console.log(`build complete. ${Object.keys(result).length} icons written to icons.json`)
}

buildFile()



//asset pipeline -- converts raw source files inot an optimised format for runtime 
//example:
// {
//     "react-dark": "<svg code here>"
//     "react-light": "<svg code here>"
//     "typescript": "<svg code here>"
// }