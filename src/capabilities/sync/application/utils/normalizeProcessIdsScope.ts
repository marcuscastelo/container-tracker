export function normalizeProcessIdsScope(
  processIds: readonly string[] | undefined,
): readonly string[] {
  if (!processIds) {
    return []
  }

  return Array.from(
    new Set(
      processIds.map((processId) => processId.trim()).filter((processId) => processId.length > 0),
    ),
  )
}
