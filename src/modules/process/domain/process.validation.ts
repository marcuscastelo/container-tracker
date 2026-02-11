export function normalizeReference(reference: string): string {
  return reference.trim().toUpperCase()
}

export function validateReference(reference: string): void {
  if (!reference.trim()) {
    throw new Error('Reference cannot be empty')
  }
}
