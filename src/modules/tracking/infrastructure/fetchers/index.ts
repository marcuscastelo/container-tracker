/**
 * Provider fetcher registry.
 *
 * Maps Provider identifiers to their HTTP fetch functions.
 * Maersk is NOT included here because it uses Puppeteer (handled in its own API route).
 */

import type { Provider } from '~/modules/tracking/domain/provider'
import { fetchCmaCgmStatus } from '~/modules/tracking/infrastructure/fetchers/cmacgmFetcher'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'
import { fetchMscStatus } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'

export type CarrierFetcher = (containerNumber: string) => Promise<FetchResult>

/**
 * Carriers that can be fetched with simple REST calls (no Puppeteer).
 */
export type RestCarrier = 'msc' | 'cmacgm'

const REST_FETCHERS: Record<RestCarrier, CarrierFetcher> = {
  msc: fetchMscStatus,
  cmacgm: fetchCmaCgmStatus,
}

/**
 * Returns the fetcher for a given provider, or null if not a REST carrier
 * (e.g. Maersk which requires Puppeteer).
 */
export function getRestFetcher(provider: Provider): CarrierFetcher | null {
  if (isRestCarrier(provider)) {
    return REST_FETCHERS[provider]
  }
  return null
}

/**
 * Check if a provider is handled via REST (vs Puppeteer/other).
 */
export function isRestCarrier(provider: string): provider is RestCarrier {
  return provider === 'msc' || provider === 'cmacgm'
}
