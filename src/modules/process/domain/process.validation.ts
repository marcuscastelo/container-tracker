export function normalizeReference(reference: string): string {
  return reference.trim().toUpperCase()
}

export function validateReference(reference: string): void {
  if (!reference.trim()) {
    throw new Error('Reference cannot be empty')
  }
}

export function normalizeDepositary(value: string | null | undefined): string | null {
  if (value == null) return null

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}
