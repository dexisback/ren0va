export const aliases: Record<string, string> = {
    ts: "typescript",
  js: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "golang",
  cs: "csharp",
  cpp: "cplusplus",
  md: "markdown",
  pg: "postgres",
  psql: "postgres",
  node: "nodejs",
  next: "nextjs",
  nuxt: "nuxtjs",
  vue: "vuejs",
  react: "react",
  svelte: "svelte",
  tailwind: "tailwindcss",
  prisma: "prisma",
  docker: "docker",
  git: "git",
  github: "github",
  vscode: "vscode",
  linux: "linux",
}

export const themeless = new Set(["bash", "git", "markdown", "regex"])


export function resolveIcon(name: string, theme: string): string {
    const normalised = name.toLowerCase().trim()
    const resolved = aliases[normalised] ?? normalised

    if (themeless.has(resolved)) {
        return resolved
    }

    return `${resolved}-${theme}`
}
