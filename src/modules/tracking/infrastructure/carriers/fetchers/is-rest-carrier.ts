/**
 * Utility to check whether a provider is handled via REST fetchers.
 *
 * The RestCarrier type is kept here so other modules can import the
 * predicate and the exact carrier union without relying on a barrel file.
 */

export type RestCarrier = 'msc' | 'cmacgm' | 'pil' | 'one'

export function isRestCarrier(provider: string): provider is RestCarrier {
  return provider === 'msc' || provider === 'cmacgm' || provider === 'pil' || provider === 'one'
}
