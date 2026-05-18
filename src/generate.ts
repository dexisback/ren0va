//without generate.ts - the worker would have to do all the grid inline math - calculate positions, stripping sg wrappers. to minimise the cloudfare worker file we do this 

const GAP = 6
const TILE = 48

export function generateSvg(icons: string[], perLine: number): string {
    const columns = Math.min(icons.length, perLine)
    const rows = Math.ceil(icons.length/perLine)
    const width = columns * TILE + (columns-1)* GAP
    const height = rows * TILE + (rows-1) * GAP

    const tiles = icons.map((svg, i)=>{
        const columns= i % perLine
        const rows = Math.floor(i/perLine)

        const x=columns * (TILE + GAP)
        const y=rows * (TILE + GAP)

        const inner = svg
          .replace(/<svg[^>]*>/, "")
          .replace(/<\/svg>/, "")
          .trim()

        // Determine original icon canvas width: prefer viewBox width, then width attr, fallback to 256
        let iconWidth = 256
        const vb = svg.match(/<svg[^>]*viewBox=["']([^"']+)["'][^>]*>/i)
        if (vb && vb[1]) {
          const parts = vb[1].trim().split(/\s+/)
          if (parts.length === 4 && !Number.isNaN(Number(parts[2]))) {
            iconWidth = Number(parts[2])
          }
        } else {
          const w = svg.match(/<svg[^>]*\bwidth=["']?(\d+)(?:px)?["']?[^>]*>/i)
          if (w) iconWidth = Number(w[1])
        }

        const scale = TILE / iconWidth

        // translate to tile position, then scale the icon down to TILE size
        return `<g transform="translate(${x}, ${y})"><g transform="scale(${scale})">${inner}</g></g>`

    })
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${tiles.join("\n  ")}
</svg>`

}