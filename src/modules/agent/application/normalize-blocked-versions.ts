export function toUniqueNormalizedVersions(values: readonly string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0)
  return [...new Set(normalized)]
}
