export function findDuplicateStrings(values: readonly string[]): string[] {
  const normalized = values.map((value) => value.toUpperCase().trim())
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of normalized) {
    if (!value) continue
    if (seen.has(value)) {
      duplicates.add(value)
    } else {
      seen.add(value)
    }
  }

  return [...duplicates]
}
