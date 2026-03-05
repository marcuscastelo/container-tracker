/**
 * @module locationDisplayResolver
 *
 * Centralizes resolution of location display text for presentation layer.
 *
 * This module provides a single point of truth for determining how to display
 * a location to end users, eliminating scattered fallback logic across the codebase.
 *
 * **Architectural Context:**
 * - Domain layer uses `location_code` for semantic identity and derivation rules
 * - Presentation/Application layer uses this resolver for user-facing text
 * - No external lookups, no enrichment — pure presentation logic only
 *
 * **Design Principles:**
 * - Pure function (no side effects)
 * - No external dependencies
 * - No UN/LOCODE lookup or semantic enrichment
 * - Preserves casing from source data
 * - Defensive against null/whitespace-only inputs
 *
 * @example
 * ```ts
 * resolveLocationDisplay({
 *   location_code: 'USNYC',
 *   location_display: 'New York, NY'
 * })
 * // => 'New York, NY'
 *
 * resolveLocationDisplay({
 *   location_code: 'USNYC',
 *   location_display: null
 * })
 * // => 'USNYC'
 *
 * resolveLocationDisplay({
 *   location_code: null,
 *   location_display: null
 * })
 * // => 'Unknown location'
 * ```
 */

/**
 * Input for location display resolution.
 */
type LocationDisplayInput = {
  /**
   * UN/LOCODE or carrier-specific location code.
   * Used for semantic identity in domain layer.
   * Falls back as display text when location_display is unavailable.
   */
  readonly location_code: string | null

  /**
   * Human-readable location text from carrier API.
   * Preferred for display when available.
   */
  readonly location_display: string | null
}

/**
 * Resolves the display text for a location based on available data.
 *
 * **Resolution Strategy (priority order):**
 * 1. Use `location_display` if non-empty after trimming
 * 2. Fall back to `location_code` if non-empty after trimming
 * 3. Return 'Unknown location' if neither is available
 *
 * **Defensive Handling:**
 * - Treats whitespace-only strings as empty
 * - Preserves original casing from input
 * - Never returns empty string
 *
 * @param input - Location data from observation or snapshot
 * @returns Human-readable location text, never empty
 *
 * @pure This function has no side effects and is deterministic
 */
export function resolveLocationDisplay(input: LocationDisplayInput): string {
  // Priority 1: Use location_display if available
  const displayText = input.location_display?.trim()
  if (displayText && displayText.length > 0) {
    return displayText
  }

  // Priority 2: Fall back to location_code
  const codeText = input.location_code?.trim()
  if (codeText && codeText.length > 0) {
    return codeText
  }

  // Priority 3: Explicit unknown state
  return 'Unknown location'
}
