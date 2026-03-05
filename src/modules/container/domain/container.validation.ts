export function normalizeContainerNumber(value: string): string {
  return value.toUpperCase().trim()
}

export function validateContainerWithWarnings(value: string): string[] {
  const warnings: string[] = []
  const validation = validateContainerNumber(value)
  if (validation.message) warnings.push(validation.message)
  return warnings
}

/**
 * Container number validation (ISO 6346)
 * Format: 4 letters + 7 digits (soft validation, we allow creation but show warning)
 */
function validateContainerNumber(containerNumber: string): {
  valid: boolean
  message?: string
} {
  const normalized = containerNumber.toUpperCase().trim()

  if (normalized.length === 0) {
    return { valid: false, message: 'Container number is required' }
  }

  // ISO 6346: 4 letters + 7 digits = 11 characters
  const iso6346Regex = /^[A-Z]{4}[0-9]{7}$/
  if (!iso6346Regex.test(normalized)) {
    return {
      valid: true, // Still allow creation
      message: `Container number may be invalid. Expected format: 4 letters + 7 digits (e.g., MSCU1234567)`,
    }
  }

  return { valid: true }
}
