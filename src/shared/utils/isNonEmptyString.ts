/**
 * Checks if a value is a non-empty string.
 *
 * @param val - Value to check.
 * @returns {boolean} True if value is a non-empty string.
 */
export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0
}
