/**
 * Supported carrier/provider identifiers.
 * Extensible — add new carriers here as they are integrated.
 */
export type Provider = 'msc' | 'maersk' | 'cmacgm' | 'pil' | 'one'

/**
 * Provider values that may appear in persisted legacy/external data.
 *
 * Read-side mappers should degrade unsupported providers to `unknown`
 * instead of taking hot endpoints down.
 */
export type PersistedProvider = Provider | 'unknown'

export function isKnownProvider(value: string): value is Provider {
  return (
    value === 'msc' ||
    value === 'maersk' ||
    value === 'cmacgm' ||
    value === 'pil' ||
    value === 'one'
  )
}
