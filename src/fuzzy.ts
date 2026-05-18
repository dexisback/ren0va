import iconsData from "../icons.json"


const names = [...new Set(Object.keys(iconsData)
  .map(name => name.replace(/-(dark|light)$/, ""))
  .map(n => n.toLowerCase())
)]


function levenshteinAlgo(a: string, b: string) {

    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    )

    // initialize base cases
    for (let i = 0; i <= a.length; i++) dp[i]![0] = i
    for (let j = 0; j <= b.length; j++) dp[0]![j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!
      } else {
        dp[i]![j] = 1 + Math.min(
          dp[i - 1]![j]!,     // delete
          dp[i]![j - 1]!,     // insert
          dp[i - 1]![j - 1]!  // replace
        )
      }
    }
  }

  return dp[a.length]![b.length]!
}

export function fuzzyMatch(input: string): string {
  const clean = input.toLowerCase().trim()
  if (names.includes(clean)) {
    return clean
  }

  let bestMatch = clean
  let bestScore = Infinity

  for (const name of names) {
    const score = levenshteinAlgo(clean, name)
    if (score < bestScore) {
      bestScore = score
      bestMatch = name
    }
  }

  return bestScore <= 2 ? bestMatch : clean
}