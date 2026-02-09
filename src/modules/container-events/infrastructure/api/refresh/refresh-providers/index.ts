import z4 from 'zod/v4'
import * as cmacgm from '~/modules/container-events/infrastructure/api/refresh/refresh-providers/cmacgm'
import * as msc from '~/modules/container-events/infrastructure/api/refresh/refresh-providers/msc'

export type ProviderHandler = {
  name: string
  fetchStatus: (
    container: string,
  ) => Promise<{ parsedStatus?: Record<string, unknown>; raw?: string }>
}

const PROVIDERS = {
  cmacgm: {
    name: 'CMA CGM',
    fetchStatus: cmacgm.fetchStatus,
  },
  msc: {
    name: 'MSC',
    fetchStatus: msc.fetchStatus,
  },
} as const

export type RestProvidedCarrier = keyof typeof PROVIDERS

// biome-ignore lint: Cast is safe here
const PROVIDER_KEYS: RestProvidedCarrier[] = Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]

export function getRestProvider(name: string): ProviderHandler {
  const key = z4.enum(PROVIDER_KEYS).parse(name)
  const provider = PROVIDERS[key]
  if (!provider) throw new Error(`no REST provider for carrier '${name}'`)
  return provider
}
