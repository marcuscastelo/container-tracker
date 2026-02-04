import * as cmacgm from './cmacgm'
import * as msc from './msc'

export type ProviderHandler = {
  fetchStatus: (
    container: string,
  ) => Promise<{ parsedStatus?: Record<string, unknown>; raw?: string }>
}

const PROVIDERS: Record<string, ProviderHandler> = {
  cmacgm: cmacgm as unknown as ProviderHandler,
  msc: msc as unknown as ProviderHandler,
}

export function getProvider(name: string): ProviderHandler | undefined {
  if (!name) return undefined
  const key = name.split('-')[0].toLowerCase()
  return PROVIDERS[key]
}
