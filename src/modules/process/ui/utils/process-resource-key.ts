export function toProcessResourceKey(
  processId: string,
  locale: string,
): readonly [string, string] | null {
  const normalizedProcessId = processId.trim()
  if (normalizedProcessId.length === 0) return null
  if (normalizedProcessId === 'undefined') return null
  return [normalizedProcessId, locale]
}
