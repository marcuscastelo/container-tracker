/**
 * Error utility functions for error handling and wrapping.
 */

export const ORIGINAL_ERROR_SYMBOL = Symbol('originalError')

/**
 * Wraps an error with proper stack trace and original error information.
 * @param error - The error to wrap
 * @returns A wrapped Error object with stack trace
 */
export function wrapErrorWithStack(error: unknown): Error {
  let message = 'Unknown error'
  if (typeof error === 'object' && error !== null) {
    const keys = Object.keys(error)
    if ('message' in error && typeof error.message === 'string') {
      if (keys.length > 1) {
        message = `${error.message}: ${JSON.stringify(error)}`
      } else {
        message = error.message
      }
    } else {
      message = JSON.stringify(error)
    }
  }
  const wrapped: Error = new Error(message)
  if (error instanceof Error) {
    wrapped.stack = error.stack
  }
  Object.defineProperty(wrapped, ORIGINAL_ERROR_SYMBOL, {
    value: error,
    enumerable: false,
    configurable: true,
    writable: true,
  })
  return wrapped
}

/**
 * Checks if an error is a backend outage error (network/connection related).
 * @param error - The error to check
 * @returns True if the error indicates a backend outage
 */
export function isBackendOutageError(error: unknown): boolean {
  if (typeof error === 'string') {
    return (
      error.includes('Failed to fetch') ||
      error.includes('NetworkError') ||
      error.includes('CORS') ||
      error.includes('net::ERR') ||
      error.includes('Network request failed')
    )
  }
  if (typeof error === 'object' && error !== null) {
    const msg =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : ''
    const details =
      'details' in error && typeof error.details === 'string'
        ? error.details
        : ''
    return (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('CORS') ||
      msg.includes('net::ERR') ||
      msg.includes('Network request failed') ||
      details.includes('Failed to fetch') ||
      details.includes('NetworkError') ||
      details.includes('CORS') ||
      details.includes('net::ERR') ||
      details.includes('Network request failed')
    )
  }
  return false
}
