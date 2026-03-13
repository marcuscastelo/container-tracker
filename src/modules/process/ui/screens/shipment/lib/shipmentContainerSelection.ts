type ShipmentContainerSelectionItem = {
  readonly id: string
  readonly number: string
}

export function normalizeSelectedContainerNumber(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function findContainerIdByNumber(
  containers: readonly ShipmentContainerSelectionItem[],
  preferredContainerNumber: string | null,
): string | null {
  const normalizedPreferred = normalizeSelectedContainerNumber(preferredContainerNumber)
  if (normalizedPreferred === null) return null

  const matched = containers.find(
    (container) => normalizeSelectedContainerNumber(container.number) === normalizedPreferred,
  )
  return matched ? String(matched.id) : null
}
