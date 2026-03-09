import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { TypedFetchError, typedFetch } from '~/shared/api/typedFetch'
import { ProcessDetailResponseSchema } from '~/shared/api-schemas/processes.schemas'

const PROCESS_PREFETCH_TTL_MS = 15_000

type ProcessCacheRecord = {
  readonly expiresAtMs: number
  readonly value: ShipmentDetailVM | null
}

const processCache = new Map<string, ProcessCacheRecord>()
const inFlightProcessRequests = new Map<string, Promise<ShipmentDetailVM | null>>()

function toProcessCacheKey(id: string, locale: string): string {
  return `${id}::${locale}`
}

function readFreshCachedProcess(key: string): ShipmentDetailVM | null | undefined {
  const cached = processCache.get(key)
  if (!cached) return undefined
  if (cached.expiresAtMs <= Date.now()) {
    processCache.delete(key)
    return undefined
  }
  return cached.value
}

function writeCachedProcess(key: string, value: ShipmentDetailVM | null): void {
  processCache.set(key, {
    value,
    expiresAtMs: Date.now() + PROCESS_PREFETCH_TTL_MS,
  })
}

async function fetchProcessFromApi(id: string, locale: string): Promise<ShipmentDetailVM | null> {
  try {
    const data = await typedFetch(`/api/processes/${id}`, undefined, ProcessDetailResponseSchema)
    return toShipmentDetailVM(data, locale)
  } catch (err: unknown) {
    if (err instanceof TypedFetchError && err.status === 404) return null

    if (err instanceof Error && err.message?.includes('Not Found')) return null

    // Fallback for non-typed HTTP failures that may still represent 404.
    const response = await fetch(`/api/processes/${id}`)
    if (!response.ok && response.status === 404) return null
    throw err
  }
}

async function loadProcessWithCache(id: string, locale: string): Promise<ShipmentDetailVM | null> {
  const key = toProcessCacheKey(id, locale)
  const cached = readFreshCachedProcess(key)
  if (cached !== undefined) return cached

  const inFlight = inFlightProcessRequests.get(key)
  if (inFlight) return inFlight

  const request = fetchProcessFromApi(id, locale)
    .then((value) => {
      writeCachedProcess(key, value)
      return value
    })
    .finally(() => {
      inFlightProcessRequests.delete(key)
    })

  inFlightProcessRequests.set(key, request)
  return request
}

export async function fetchProcess(
  id: string,
  locale: string = 'en-US',
): Promise<ShipmentDetailVM | null> {
  return loadProcessWithCache(id, locale)
}

export async function prefetchProcessDetail(id: string, locale: string = 'en-US'): Promise<void> {
  try {
    await loadProcessWithCache(id, locale)
  } catch {
    // Prefetch is best-effort and must not disrupt interaction.
  }
}

export function clearPrefetchedProcessDetails(): void {
  processCache.clear()
  inFlightProcessRequests.clear()
}
