import fs from "fs"
import path from "path"



const ICONS_DIR = path.join(process.cwd(), "icons", "processed-svg") //reutrns /home/amaan/renova/icons/processed
const OUTPUT_FILE = path.join(process.cwd(), "icons.json") // output file is /home/amaan/renova/icons.json ofcourse



function buildFile(){
    const result: Record<string, string> = {}  //empty object of keys and vaules (string, string )
    const files = fs.readdirSync(ICONS_DIR)
    for(const file of files){
        if(!file.endsWith(".svg")) continue

        const fileName = file.replace(".svg", "")
        const filePath = path.join(ICONS_DIR, fileName)
        const fileContent = fs.readFileSync(filePath, "utf-8").trim()

        result[fileName] =fileContent  //looped up
    }

    const output = JSON.stringify(result, null, 2)
    fs.writeFileSync(OUTPUT_FILE, output, "utf-8")
    console.log(`build complete. ${Object.keys(result).length} icons transferred to  -> icons.json`)
}



buildFile()



//asset pipeline -- converts raw source files inot an optimised format for runtime 
//example:
// {
//     "react-dark": "<svg code here>"
//     "react-light": "<svg code here>"
//     "typescript": "<svg code here>"
// }