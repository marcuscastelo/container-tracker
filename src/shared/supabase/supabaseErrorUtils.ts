// filepath: src/shared/supabase/supabaseErrorUtils.ts

/**
 * Checks if a Supabase error is a unique constraint violation for a given unique key (e.g., foods_ean_key).
 * @param error - The error object returned by Supabase
 * @param uniqueKey - The unique constraint key to check for (e.g., 'foods_ean_key')
 * @param ean - The EAN value to check (optional, for stricter matching)
 * @returns True if the error is a duplicate unique constraint violation for the given key
 */
export function isSupabaseDuplicateKeyError(
  error: unknown,
  uniqueKey: string,
  ean?: string | null,
): ean is string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes(uniqueKey)
  ) {
    if (ean !== undefined && ean !== null && typeof ean === 'string' && ean !== '') {
      return true
    }
    // If no EAN provided, still consider it a duplicate key error
    return false
  }
  return false
}

/**
 * Checks if a Supabase error is a unique constraint violation for the foods_ean_key (duplicate EAN).
 * @param error - The error object returned by Supabase
 * @param ean - The EAN value to check (optional, for stricter matching)
 * @returns True if the error is a duplicate EAN unique constraint violation
 */
export function isSupabaseDuplicateEanError(error: unknown, ean?: string | null): ean is string {
  return isSupabaseDuplicateKeyError(error, 'foods_ean_key', ean)
}
