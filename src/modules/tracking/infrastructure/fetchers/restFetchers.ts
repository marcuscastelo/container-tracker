import type { Provider } from '~/modules/tracking/domain/provider'
import { fetchCmaCgmStatus } from '~/modules/tracking/infrastructure/fetchers/cmacgmFetcher'
import {
  isRestCarrier,
  type RestCarrier,
} from '~/modules/tracking/infrastructure/fetchers/isRestCarrier'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'
import { fetchMscStatus } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'

type CarrierFetcher = (containerNumber: string) => Promise<FetchResult>

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
