import { validateContainerNumber } from '~/modules/process/domain/processStuff'

export function normalizeContainerNumber(value: string): string {
  return value.toUpperCase().trim()
}

export function validateContainerWithWarnings(value: string): string[] {
  const warnings: string[] = []
  const validation = validateContainerNumber(value)
  if (validation.message) warnings.push(validation.message)
  return warnings
}
