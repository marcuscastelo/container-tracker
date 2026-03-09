type KeyedState<T> = Readonly<Record<string, T>>

export function toContainerFieldKey(containerId: string): string {
  return `container-${containerId}`
}

export function dropContainerScopedField<T>(
  state: KeyedState<T>,
  containerId: string,
): Record<string, T> {
  const fieldKey = toContainerFieldKey(containerId)
  if (!(fieldKey in state)) return { ...state }

  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(state)) {
    if (key === fieldKey) continue
    next[key] = value
  }
  return next
}

export function retainContainerScopedFields<T>(
  state: KeyedState<T>,
  containerIds: readonly string[],
): Record<string, T> {
  const visibleKeys = new Set(containerIds.map((containerId) => toContainerFieldKey(containerId)))
  const next: Record<string, T> = {}

  for (const [key, value] of Object.entries(state)) {
    if (!visibleKeys.has(key)) continue
    next[key] = value
  }

  return next
}

export function listContainerScopedEntries<T>(
  state: KeyedState<T>,
  containerIds: readonly string[],
): readonly (readonly [string, T])[] {
  const visibleKeys = new Set(containerIds.map((containerId) => toContainerFieldKey(containerId)))
  const entries: Array<readonly [string, T]> = []

  for (const [key, value] of Object.entries(state)) {
    if (!visibleKeys.has(key)) continue
    entries.push([key, value])
  }

  return entries
}
