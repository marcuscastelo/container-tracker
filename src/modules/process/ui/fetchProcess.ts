import { toShipmentDetailVM } from '~/modules/process/ui/mappers/processDetail.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { TypedFetchError, typedFetch } from '~/shared/api/typedFetch'
import { ProcessDetailResponseSchema } from '~/shared/api-schemas/processes.schemas'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'
import { systemClock } from '~/shared/time/clock'

const PROCESS_PREFETCH_TTL_MS = 15_000

type FetchProcessMode = 'cache-first' | 'network-only'
export type FetchProcessTrigger =
  | 'shipment_initial_load'
  | 'shipment_refresh'
  | 'shipment_reconciliation'
  | 'shipment_intent_prefetch'
  | 'shipment_navigation_prefetch'

type FetchProcessOptions = {
  readonly mode?: FetchProcessMode
  readonly dedupeInFlight?: boolean
  readonly triggeredBy?: FetchProcessTrigger
}

type ProcessCacheRecord = {
  readonly expiresAtMs: number
  readonly value: ShipmentDetailVM | null
}

const processCache = new Map<string, ProcessCacheRecord>()
const inFlightProcessRequests = new Map<string, Promise<ShipmentDetailVM | null>>()
// Generation tokens used to prevent outdated in-flight responses from
// repopulating the cache after a targeted invalidation. When an invalidation
// occurs we bump the generation for affected keys; any in-flight request that
// captured an older generation will skip writing the cache when it resolves.
const processRequestGeneration = new Map<string, number>()

function nowMs(): number {
  return systemClock.now().toEpochMs()
}

function toProcessCacheKey(id: string, locale: string): string {
  return `${id}::${locale}`
}

function readFreshCachedProcess(key: string): ShipmentDetailVM | null | undefined {
  const cached = processCache.get(key)
  if (!cached) return undefined
  if (cached.expiresAtMs <= nowMs()) {
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
    expiresAtMs: nowMs() + PROCESS_PREFETCH_TTL_MS,
  })

  // Keep the cache bounded to avoid unbounded memory growth in long sessions.
  // If the cache grows too large, evict the oldest entries by expiresAtMs.
  const CACHE_MAX_ENTRIES = 1000
  if (processCache.size > CACHE_MAX_ENTRIES) {
    const entries = Array.from(processCache.entries())
    entries.sort((a, b) => a[1].expiresAtMs - b[1].expiresAtMs)
    for (let i = 0; processCache.size > CACHE_MAX_ENTRIES && i < entries.length; i++) {
      const entry = entries[i]
      if (!entry) continue
      processCache.delete(entry[0])
    }
  }
}

function pruneExpiredCacheEntries(): void {
  const now = nowMs()
  for (const [key, record] of processCache.entries()) {
    if (record.expiresAtMs <= now) processCache.delete(key)
  }
}

function toReadTriggerHeaders(
  triggeredBy: FetchProcessOptions['triggeredBy'],
): HeadersInit | undefined {
  if (triggeredBy === undefined) return undefined
  return {
    'x-process-read-trigger': triggeredBy,
  }
}

async function fetchProcessFromApi(
  id: string,
  locale: string,
  triggeredBy: FetchProcessOptions['triggeredBy'],
): Promise<ShipmentDetailVM | null> {
  try {
    const headers = toReadTriggerHeaders(triggeredBy)
    const data = await typedFetch(
      `/api/processes/${id}`,
      headers === undefined ? undefined : { headers },
      ProcessDetailResponseSchema,
    )
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
  triggeredBy?: FetchProcessOptions['triggeredBy'],
): Promise<ShipmentDetailVM | null> {
  const key = toProcessCacheKey(id, locale)

  // When dedupeInFlight is true we reuse any in-flight request for the same
  // process/locale key to avoid duplicating network traffic. Callers that
  // require a canonical post-mutation snapshot should request
  // dedupeInFlight=false to force an independent network call.
  if (dedupeInFlight) {
    const inFlight = inFlightProcessRequests.get(key)
    if (inFlight) return inFlight
  }

  // Capture the current generation for this key so we can detect whether the
  // request becomes outdated while in flight (for example, due to a cache
  // invalidation or a mutation). Only write the cache if the generation still
  // matches when the network response arrives.
  const generationAtRequest = processRequestGeneration.get(key) ?? 0

  const request = fetchProcessFromApi(id, locale, triggeredBy)
    .then((value) => {
      const currentGeneration = processRequestGeneration.get(key) ?? 0
      if (currentGeneration === generationAtRequest) {
        writeCachedProcess(key, value)
      }
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

async function loadProcessWithCache(
  id: string,
  locale: string,
  triggeredBy?: FetchProcessOptions['triggeredBy'],
): Promise<ShipmentDetailVM | null> {
  const key = toProcessCacheKey(id, locale)
  const cached = readFreshCachedProcess(key)
  if (cached !== undefined) return cached

  return loadProcessFromNetwork(id, locale, true, triggeredBy)
}

export async function fetchProcess(
  id: string,
  locale: string = DEFAULT_LOCALE,
  options?: FetchProcessOptions,
): Promise<ShipmentDetailVM | null> {
  // By default, network-only callers force a fresh request (no in-flight dedupe)
  // so post-mutation reads do not race with older in-flight requests.
  const explicitDedupe = options?.dedupeInFlight
  const dedupeInFlight = explicitDedupe ?? options?.mode !== 'network-only'

  if (options?.mode === 'network-only') {
    return loadProcessFromNetwork(id, locale, dedupeInFlight, options?.triggeredBy)
  }

  return loadProcessWithCache(id, locale, options?.triggeredBy)
}

export async function prefetchProcessDetail(
  id: string,
  locale: string = DEFAULT_LOCALE,
): Promise<void> {
  try {
    await loadProcessFromNetwork(id, locale, true, 'shipment_intent_prefetch')
  } catch {
    // Prefetch is best-effort and must not disrupt interaction.
  }
}

export function clearPrefetchedProcessDetails(): void {
  // Bump generation for all known keys so any in-flight requests don't write
  // back into cache after we cleared it.
  for (const key of processCache.keys()) {
    const prev = processRequestGeneration.get(key) ?? 0
    processRequestGeneration.set(key, prev + 1)
  }

  processCache.clear()
  inFlightProcessRequests.clear()
}

export function clearPrefetchedProcessDetailById(processId: string): void {
  const processCacheKeyPrefix = `${processId}::`

  for (const key of processCache.keys()) {
    if (!key.startsWith(processCacheKeyPrefix)) continue
    processCache.delete(key)
  }

  for (const key of inFlightProcessRequests.keys()) {
    if (!key.startsWith(processCacheKeyPrefix)) continue
    inFlightProcessRequests.delete(key)
  }

  // Bump generation for keys matching this process so any already-running
  // requests that were started before this invalidation will not write stale
  // values back into the cache.
  for (const [key] of processRequestGeneration.entries()) {
    if (!key.startsWith(processCacheKeyPrefix)) continue
    const prev = processRequestGeneration.get(key) ?? 0
    processRequestGeneration.set(key, prev + 1)
  }
}
