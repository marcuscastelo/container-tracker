import type { Provider } from '~/modules/tracking/domain/model/provider'

export type FetchResult = {
  readonly provider: Provider
  readonly payload: unknown
  readonly fetchedAt: string
  readonly parseError?: string | null
}
