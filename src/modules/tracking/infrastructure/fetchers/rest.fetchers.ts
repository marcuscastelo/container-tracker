import type { Provider } from '~/modules/tracking/domain/provider'
import { fetchCmaCgmStatus } from '~/modules/tracking/infrastructure/fetchers/cmacgm.fetcher'
import {
  isRestCarrier,
  type RestCarrier,
} from '~/modules/tracking/infrastructure/fetchers/is-rest-carrier'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/msc.fetcher'
import { fetchMscStatus } from '~/modules/tracking/infrastructure/fetchers/msc.fetcher'

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
