/**
 * Safe vibration utility that handles browser compatibility and error cases.
 *
 * Provides a simple interface for triggering device vibration while gracefully
 * handling environments where the Vibration API is not available.
 */

import { logging } from '~/shared/utils/logging'

/**
 * Safely triggers device vibration with the specified pattern.
 *
 * Checks for window, navigator, and vibrate API availability before attempting
 * to vibrate. Silently fails if the API is not supported or throws an error.
 *
 * @param pattern - Vibration pattern (number for single vibration, array for pattern)
 * @returns True if vibration was attempted, false if not supported
 */
export function vibrate(pattern: number | number[]): boolean {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return false
    }

    // Check if navigator exists
    if (typeof navigator === 'undefined') {
      return false
    }

    // Check if vibrate API is available
    if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') {
      return false
    }

    // Attempt to vibrate
    navigator.vibrate(pattern)
    return true
  } catch (error) {
    // Silently handle any errors (e.g., security restrictions, API changes)
    logging.error('Vibration API error:', error)
    return false
  }
}
