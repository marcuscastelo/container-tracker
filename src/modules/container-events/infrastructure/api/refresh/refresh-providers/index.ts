import * as cmacgm from '~/modules/container-events/infrastructure/api/refresh/refresh-providers/cmacgm'
import * as msc from '~/modules/container-events/infrastructure/api/refresh/refresh-providers/msc'

export type ProviderHandler = {
  name: string
  fetchStatus: (
    container: string,
  ) => Promise<{ parsedStatus?: Record<string, unknown>; raw?: string }>
}

const PROVIDERS: Record<string, ProviderHandler> = {
  cmacgm: {
    name: 'CMA CGM',
    fetchStatus: cmacgm.fetchStatus,
  },
  msc: {
    name: 'MSC',
    fetchStatus: msc.fetchStatus,
  },
}

export function getProvider(name: string): ProviderHandler | undefined {
  if (!name) return undefined
  const key = name.split('-')[0].toLowerCase()
  return PROVIDERS[key]
}
