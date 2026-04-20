import type { Provider } from '~/modules/tracking/domain/model/provider'
import { fetchCmaCgmStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher'
import type { FetchResult } from '~/modules/tracking/infrastructure/carriers/fetchers/fetch-result'
import {
  isRestCarrier,
  type RestCarrier,
} from '~/modules/tracking/infrastructure/carriers/fetchers/is-rest-carrier'
import { fetchMscStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/msc.fetcher'
import { fetchOneStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/one.fetcher'
import { fetchPilStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/pil.fetcher'

type CarrierFetcher = (containerNumber: string) => Promise<FetchResult>

const REST_FETCHERS: Record<RestCarrier, CarrierFetcher> = {
  msc: fetchMscStatus,
  cmacgm: fetchCmaCgmStatus,
  pil: fetchPilStatus,
  one: fetchOneStatus,
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
