import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { TypedFetchError, typedFetch } from '~/shared/api/typedFetch'
import { ProcessDetailResponseSchema } from '~/shared/api-schemas/processes.schemas'

const PROCESS_PREFETCH_TTL_MS = 15_000

export type FetchProcessMode = 'cache-first' | 'network-only'

type FetchProcessOptions = {
  readonly mode?: FetchProcessMode
  readonly dedupeInFlight?: boolean
}

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
  // Opportunistically prune expired entries so TTL actually limits memory growth
  pruneExpiredCacheEntries()

  processCache.set(key, {
    value,
    expiresAtMs: Date.now() + PROCESS_PREFETCH_TTL_MS,
  })

  // Keep the cache bounded to avoid unbounded memory growth in long sessions.
  // If the cache grows too large, evict the oldest entries by expiresAtMs.
  const CACHE_MAX_ENTRIES = 1000
  if (processCache.size > CACHE_MAX_ENTRIES) {
    const entries = Array.from(processCache.entries())
    entries.sort((a, b) => a[1].expiresAtMs - b[1].expiresAtMs)
    for (let i = 0; processCache.size > CACHE_MAX_ENTRIES && i < entries.length; i++) {
      processCache.delete(entries[i][0])
    }
  }
}

function pruneExpiredCacheEntries(): void {
  const now = Date.now()
  for (const [key, record] of processCache.entries()) {
    if (record.expiresAtMs <= now) processCache.delete(key)
  }
}

async function fetchProcessFromApi(id: string, locale: string): Promise<ShipmentDetailVM | null> {
  try {
    const data = await typedFetch(`/api/processes/${id}`, undefined, ProcessDetailResponseSchema)
    return toShipmentDetailVM(data, locale)
  } catch (err: unknown) {
    // typedFetch throws TypedFetchError with status for non-2xx responses.
    // Return `null` only for 404; rethrow other HTTP errors and non-typed errors.
    if (err instanceof TypedFetchError) {
      if (err.status === 404) return null
      throw err
    }

    // Non-typed errors should be surfaced to the caller; do not issue a
    // secondary network request here as it can double-load the API and
    // mask the original failure.
    throw err
  }
}

async function loadProcessFromNetwork(
  id: string,
  locale: string,
  dedupeInFlight = true,
): Promise<ShipmentDetailVM | null> {
  const key = toProcessCacheKey(id, locale)

  // When dedupeInFlight is true we reuse any in-flight request for the same
  // process/locale key to avoid duplicating network traffic. Callers that
  // require a canonical post-mutation snapshot (for example after ACK/UNACK)
  // should request dedupeInFlight=false to force an independent network call.
  if (dedupeInFlight) {
    const inFlight = inFlightProcessRequests.get(key)
    if (inFlight) return inFlight
  }

  const request = fetchProcessFromApi(id, locale)
    .then((value) => {
      writeCachedProcess(key, value)
      return value
    })
    .finally(() => {
      inFlightProcessRequests.delete(key)
    })

  // Only register the in-flight promise when deduping is enabled so that
  // callers which forced a fresh network request don't join subsequent
  // in-flight requests that they intentionally avoided.
  if (dedupeInFlight) inFlightProcessRequests.set(key, request)
  return request
}

async function loadProcessWithCache(id: string, locale: string): Promise<ShipmentDetailVM | null> {
  const key = toProcessCacheKey(id, locale)
  const cached = readFreshCachedProcess(key)
  if (cached !== undefined) return cached

  return loadProcessFromNetwork(id, locale)
}

export async function fetchProcess(
  id: string,
  locale: string = 'en-US',
  options?: FetchProcessOptions,
): Promise<ShipmentDetailVM | null> {
  // Decide whether callers want in-flight deduplication. By default we keep
  // previous behaviour (dedupe enabled) for cache-first loads. For
  // `network-only` callers we default to forcing a fresh network request so
  // callers that need a canonical post-mutation snapshot don't join older
  // in-flight requests. Consumers can override this with `dedupeInFlight`.
  const explicitDedupe = options?.dedupeInFlight
  const dedupeInFlight = explicitDedupe ?? options?.mode !== 'network-only'

  if (options?.mode === 'network-only') {
    return loadProcessFromNetwork(id, locale, dedupeInFlight)
  }
  // cache-first path continues to dedupe by default
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
