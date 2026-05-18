import fs from "fs"
import path from "path"

const ICONS_DIR = path.join(process.cwd(), "icons", "processed-svg")
const OUTPUT_FILE = path.join(process.cwd(), "icons.json")

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

        result[fileName] = fileContent
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