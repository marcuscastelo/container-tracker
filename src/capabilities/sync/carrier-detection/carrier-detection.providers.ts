import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'

const SUPPORTED_CARRIER_DETECTION_PROVIDERS: readonly SupportedSyncProvider[] = [
  'msc',
  'maersk',
  'cmacgm',
]

const PROVIDER_BY_CARRIER: Readonly<Record<string, SupportedSyncProvider>> = {
  msc: 'msc',
  maersk: 'maersk',
  cmacgm: 'cmacgm',
}

function normalizeCarrierCode(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]/g, '')
}

export function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

export function toSupportedSyncProvider(carrierCode: string | null): SupportedSyncProvider | null {
  if (!carrierCode) return null
  return PROVIDER_BY_CARRIER[normalizeCarrierCode(carrierCode)] ?? null
}

export function toDisplayCarrierCode(provider: SupportedSyncProvider): string {
  return provider.toUpperCase()
}

export function toPersistedCarrierCode(provider: SupportedSyncProvider): string {
  return provider
}

export function listCarrierDetectionCandidates(command: {
  readonly excludeProviders?: readonly SupportedSyncProvider[]
}): readonly SupportedSyncProvider[] {
  const excluded = new Set(command.excludeProviders ?? [])
  return SUPPORTED_CARRIER_DETECTION_PROVIDERS.filter((provider) => !excluded.has(provider))
}
