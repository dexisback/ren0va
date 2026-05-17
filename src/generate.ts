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

          return `<g transform="translate(${x}, ${y})">${inner}</g>`

    })
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${tiles.join("\n  ")}
</svg>`

}