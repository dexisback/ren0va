notes: each file inside icons/ follow a standardized nomenclature -- {iconname}-{theme}.svg
. some icons might have only one variant 
scripts/build.ts - a node script you run with npx tsx scripts/build.ts . this reads every file in /icons and extracts the svg string, and write this to icons.json
src/generate.ts -- given an array of resolved icon svg strings from icons.json, produces on big svg grid. this is pure string manipulation -- just calculating x/y positions and wrapping icons in <g transform = "translate(x,y)" tags
src/worker.ts -- the entry point. parses the url params, calls icons.ts to resolve names, calls generate.ts to stitch, returns the response. 
wrangler.toml -- tells cloudfare the worker name, and configs

