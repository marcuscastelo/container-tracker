import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'

const PROVIDER_BY_CARRIER: Readonly<Record<string, SupportedSyncProvider>> = {
  msc: 'msc',
  maersk: 'maersk',
  cmacgm: 'cmacgm',
  pil: 'pil',
  one: 'one',
}

export function normalizeCarrierCode(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]/g, '')
}

export function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

export function toNormalizedProviderKey(carrierCode: string | null): string {
  if (carrierCode === null) return 'unknown'

  const normalizedCarrierCode = normalizeCarrierCode(carrierCode)
  return normalizedCarrierCode.length > 0 ? normalizedCarrierCode : 'unknown'
}

export function toSupportedProvider(carrierCode: string | null): SupportedSyncProvider | null {
  if (carrierCode === null) return null

  const normalizedCarrierCode = normalizeCarrierCode(carrierCode)
  if (normalizedCarrierCode.length === 0) {
    return null
  }

  return PROVIDER_BY_CARRIER[normalizedCarrierCode] ?? null
}
