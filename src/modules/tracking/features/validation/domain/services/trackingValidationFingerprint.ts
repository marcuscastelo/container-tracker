import { createHash } from 'node:crypto'

function normalizePart(part: string | null | undefined): string {
  return (
    part
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .toUpperCase() ?? ''
  )
}

export function digestTrackingValidationFingerprint(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex').slice(0, 32)
}

export function normalizeTrackingValidationFingerprintPart(
  part: string | null | undefined,
): string {
  return normalizePart(part)
}
