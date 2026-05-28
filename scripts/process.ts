import fs from "fs"
import path from "path"

const RAW_DIR = "icons/raw-svg"
const OUT_DIR = "icons/processed-svg"

const THEMES = {
  dark: {
    bg: "#1e1e2e",
    fg: "#f8fafc",
  },
  light: {
    bg: "#ffffff",
    fg: "#0f172a",
  },
}

for (const file of fs.readdirSync(RAW_DIR)) {
  if (!file.endsWith(".svg")) continue

  const name = file.replace(".svg", "")
  const svg = fs.readFileSync(path.join(RAW_DIR, file), "utf8")

  // extract viewBox
  const match = svg.match(/viewBox="([^"]+)"/)
  const viewBoxValues = (match?.[1] ?? "0 0 24 24").trim().split(/\s+/).map(Number)
  const vbWidth = viewBoxValues[2] ?? 24
  const vbHeight = viewBoxValues[3] ?? 24

  // remove outer svg wrapper
  const inner = svg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .trim()

  // fit inside 32x32 area
  const scale = 32 / Math.max(vbWidth, vbHeight)
  const x = 8 + (32 - vbWidth * scale) / 2
  const y = 8 + (32 - vbHeight * scale) / 2

  for (const [theme, palette] of Object.entries(THEMES)) {
    const out = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
  <rect width="48" height="48" rx="6" fill="${palette.bg}"/>
  <g transform="translate(${x}, ${y}) scale(${scale})" fill="${palette.fg}">
    ${inner}
  </g>
</svg>
`

    fs.writeFileSync(
      path.join(OUT_DIR, `${name}-${theme}.svg`),
      out.trim()
    )
  }

  console.log(`done: ${name}`)
}


//> read svg
//> get viewbox
//> compute scale
//> wrap in tile
//> write output