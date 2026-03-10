import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import { deriveProcessStatusFromContainers } from '~/modules/process/features/operational-projection/application/deriveProcessStatus'
import {
  type OperationalStatus,
  toOperationalAlertSeverity,
  toOperationalStatus,
} from '~/modules/process/features/operational-projection/application/operationalSemantics'
import type { ProcessOperationalSummary } from '~/modules/process/features/operational-projection/application/processOperationalSummary'

/**
 * Minimal tracking summary needed for process-level aggregation.
 * Matches the subset of GetContainerSummaryResult we consume.
 */
type ContainerTrackingSummary = {
  readonly status: string
  readonly operational?: {
    readonly eta: {
      readonly eventTimeIso: string
    } | null
    readonly etaApplicable?: boolean
    readonly lifecycleBucket?: 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery'
  }
  readonly alerts: readonly {
    readonly severity: string
    readonly type: string
    readonly triggered_at: string
  }[]
  readonly timeline: {
    readonly observations: readonly { readonly event_time: string | null }[]
  }
}

type ContainerSyncMetadata = {
  readonly containerNumber: string
  readonly lastSuccessAt: string | null
  readonly lastAttemptAt: string | null
  readonly isSyncing: boolean
  readonly lastErrorAt: string | null
}

export type ProcessLastSyncStatus = 'DONE' | 'FAILED' | 'RUNNING' | 'UNKNOWN'

export type ProcessSyncSummaryReadModel = {
  readonly lastSyncStatus: ProcessLastSyncStatus
  readonly lastSyncAt: string | null
}

type TrackingFacade = {
  getContainerSummary(
    containerId: string,
    containerNumber: string,
  ): Promise<ContainerTrackingSummary>
  getContainersSyncMetadata(command: {
    readonly containerNumbers: readonly string[]
  }): Promise<readonly ContainerSyncMetadata[]>
}

export type ListProcessesWithOperationalSummaryDeps = {
  readonly repository: ProcessRepository
  readonly containerUseCases: Pick<ContainerUseCasesForProcess, 'listByProcessIds'>
  readonly trackingUseCases: TrackingFacade
}

type ProcessWithOperationalSummary = {
  readonly pwc: ProcessWithContainers
  readonly summary: ProcessOperationalSummary
  readonly sync: ProcessSyncSummaryReadModel
}

type ListProcessesWithOperationalSummaryResult = {
  readonly processes: readonly ProcessWithOperationalSummary[]
}

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function toTimestampOrNegativeInfinity(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function pickMostRecentTimestamp(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current
  if (!current) return candidate

  return toTimestampOrNegativeInfinity(candidate) > toTimestampOrNegativeInfinity(current)
    ? candidate
    : current
}

function toContainerSyncStatus(sync: ContainerSyncMetadata): ProcessLastSyncStatus {
  if (sync.isSyncing) return 'RUNNING'

  const lastSuccessAtMs = toTimestampOrNegativeInfinity(sync.lastSuccessAt)
  const lastErrorAtMs = toTimestampOrNegativeInfinity(sync.lastErrorAt)

  if (lastErrorAtMs > lastSuccessAtMs) return 'FAILED'
  if (lastSuccessAtMs !== Number.NEGATIVE_INFINITY) return 'DONE'
  return 'UNKNOWN'
}

function toContainerLastSyncAt(sync: ContainerSyncMetadata): string | null {
  let latest: string | null = null
  latest = pickMostRecentTimestamp(latest, sync.lastAttemptAt)
  latest = pickMostRecentTimestamp(latest, sync.lastSuccessAt)
  latest = pickMostRecentTimestamp(latest, sync.lastErrorAt)
  return latest
}

function createFallbackContainerSyncMetadata(containerNumber: string): ContainerSyncMetadata {
  return {
    containerNumber,
    lastSuccessAt: null,
    lastAttemptAt: null,
    isSyncing: false,
    lastErrorAt: null,
  }
}

function shouldPreferAlertByTriggeredAt(
  candidate: { readonly triggered_at: string },
  current: { readonly triggered_at: string },
): boolean {
  const candidateTimestamp = Date.parse(candidate.triggered_at)
  const currentTimestamp = Date.parse(current.triggered_at)

  if (!Number.isNaN(candidateTimestamp) && !Number.isNaN(currentTimestamp)) {
    if (candidateTimestamp !== currentTimestamp) {
      return candidateTimestamp > currentTimestamp
    }
  } else if (!Number.isNaN(candidateTimestamp) && Number.isNaN(currentTimestamp)) {
    return true
  } else if (Number.isNaN(candidateTimestamp) && !Number.isNaN(currentTimestamp)) {
    return false
  }

  return candidate.triggered_at > current.triggered_at
}

function toLifecycleBucketFromStatus(
  status: OperationalStatus,
): 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery' {
  if (status === 'DELIVERED' || status === 'EMPTY_RETURNED') return 'final_delivery'
  if (status === 'ARRIVED_AT_POD' || status === 'DISCHARGED' || status === 'AVAILABLE_FOR_PICKUP') {
    return 'post_arrival_pre_delivery'
  }
  return 'pre_arrival'
}

function resolveSummaryLifecycleBucket(
  summary: ContainerTrackingSummary,
  status: OperationalStatus,
): 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery' {
  const bucket = summary.operational?.lifecycleBucket
  if (bucket === 'pre_arrival') return bucket
  if (bucket === 'post_arrival_pre_delivery') return bucket
  if (bucket === 'final_delivery') return bucket
  return toLifecycleBucketFromStatus(status)
}

function resolveEtaApplicable(
  summary: ContainerTrackingSummary,
  bucket: 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery',
): boolean {
  if (summary.operational?.etaApplicable !== undefined) {
    return summary.operational.etaApplicable
  }
  return bucket === 'pre_arrival'
}

function deriveProcessLifecycleBucket(
  lifecycleBuckets: readonly ('pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery')[],
): 'pre_arrival' | 'post_arrival_pre_delivery' | 'final_delivery' {
  if (lifecycleBuckets.length === 0) return 'pre_arrival'
  if (lifecycleBuckets.every((bucket) => bucket === 'final_delivery')) return 'final_delivery'
  if (lifecycleBuckets.some((bucket) => bucket === 'pre_arrival')) return 'pre_arrival'
  return 'post_arrival_pre_delivery'
}

function hasAnyTrackingObservation(summaries: readonly ContainerTrackingSummary[]): boolean {
  return summaries.some((summary) => summary.timeline.observations.length > 0)
}

function shouldUseNotSyncedStatus(command: {
  readonly containerCount: number
  readonly processStatus: ProcessOperationalSummary['process_status']
  readonly syncStatus: ProcessSyncSummaryReadModel['lastSyncStatus']
}): boolean {
  if (command.containerCount === 0) return false
  if (command.processStatus !== 'AWAITING_DATA') return false
  return command.syncStatus === 'UNKNOWN'
}

function deriveProcessSyncSummary(command: {
  readonly containers: ProcessWithContainers['containers']
  readonly syncByContainerNumber: ReadonlyMap<string, ContainerSyncMetadata>
}): ProcessSyncSummaryReadModel {
  if (command.containers.length === 0) {
    return {
      lastSyncStatus: 'UNKNOWN',
      lastSyncAt: null,
    }
  }

  const statuses: ProcessLastSyncStatus[] = []
  let lastSyncAt: string | null = null

  for (const container of command.containers) {
    const normalizedContainerNumber = normalizeContainerNumber(String(container.containerNumber))
    const sync =
      command.syncByContainerNumber.get(normalizedContainerNumber) ??
      createFallbackContainerSyncMetadata(normalizedContainerNumber)

    statuses.push(toContainerSyncStatus(sync))
    lastSyncAt = pickMostRecentTimestamp(lastSyncAt, toContainerLastSyncAt(sync))
  }

  if (statuses.some((status) => status === 'RUNNING')) {
    return {
      lastSyncStatus: 'RUNNING',
      lastSyncAt,
    }
  }

  if (statuses.some((status) => status === 'FAILED')) {
    return {
      lastSyncStatus: 'FAILED',
      lastSyncAt,
    }
  }

  if (statuses.some((status) => status === 'DONE')) {
    return {
      lastSyncStatus: 'DONE',
      lastSyncAt,
    }
  }

  return {
    lastSyncStatus: 'UNKNOWN',
    lastSyncAt,
  }
}

async function listSyncMetadataByContainerNumber(command: {
  readonly containerNumbers: readonly string[]
  readonly trackingUseCases: Pick<TrackingFacade, 'getContainersSyncMetadata'>
}): Promise<ReadonlyMap<string, ContainerSyncMetadata>> {
  const normalizedContainerNumbers = Array.from(
    new Set(
      command.containerNumbers
        .map(normalizeContainerNumber)
        .filter((containerNumber) => containerNumber.length > 0),
    ),
  )

  if (normalizedContainerNumbers.length === 0) {
    return new Map()
  }

  try {
    const rows = await command.trackingUseCases.getContainersSyncMetadata({
      containerNumbers: normalizedContainerNumbers,
    })

    return new Map(rows.map((row) => [normalizeContainerNumber(row.containerNumber), row] as const))
  } catch (error) {
    console.error('Failed to get process sync metadata for dashboard list:', error)
    return new Map()
  }
}

/**
 * Aggregate container-level tracking data into a process-level operational summary.
 *
 * Future optimization: cache ProcessOperationalSummary at snapshot ingestion time.
 */
export function aggregateOperationalSummary(
  processId: string,
  reference: string | null,
  carrier: string | null,
  containerCount: number,
  summaries: readonly ContainerTrackingSummary[],
  now?: string,
): ProcessOperationalSummary {
  // --- Process Status ---
  const statuses: OperationalStatus[] = summaries.map((summary) =>
    toOperationalStatus(summary.status),
  )
  const lifecycleBuckets = summaries.map((summary, index) => {
    const status = statuses[index] ?? 'UNKNOWN'
    return resolveSummaryLifecycleBucket(summary, status)
  })
  const hasTrackingData = hasAnyTrackingObservation(summaries)
  const allUnknownStatuses = statuses.length > 0 && statuses.every((status) => status === 'UNKNOWN')
  const processStatus =
    containerCount > 0 && !hasTrackingData && !allUnknownStatuses
      ? 'AWAITING_DATA'
      : deriveProcessStatusFromContainers(statuses)

  // --- ETA ---
  // Select earliest future ETA among ETA-eligible containers.
  const nowIso = now ?? new Date().toISOString()
  let eta: string | null = null
  let etaEligibleTotal = 0
  let etaWithValue = 0
  for (let index = 0; index < summaries.length; index += 1) {
    const summary = summaries[index]
    const bucket = lifecycleBuckets[index] ?? 'pre_arrival'
    const etaApplicable = resolveEtaApplicable(summary, bucket)
    if (!etaApplicable) continue

    etaEligibleTotal += 1
    const etaIso = summary.operational?.eta?.eventTimeIso ?? null
    if (etaIso === null) continue
    etaWithValue += 1

    if (etaIso > nowIso) {
      if (eta === null || etaIso < eta) {
        eta = etaIso
      }
    }
  }

  // --- Lifecycle bucket + completion ---
  const processLifecycleBucket = deriveProcessLifecycleBucket(lifecycleBuckets)

  const finalDeliveryComplete =
    statuses.length > 0 &&
    statuses.every((status) => status === 'DELIVERED' || status === 'EMPTY_RETURNED')
  const fullLogisticsComplete =
    statuses.length > 0 && statuses.every((status) => status === 'EMPTY_RETURNED')

  // --- Alerts ---
  const allActiveAlerts: Array<{
    readonly severity: string
    readonly type: string
    readonly triggered_at: string
  }> = []
  for (const s of summaries) {
    for (const a of s.alerts) {
      allActiveAlerts.push(a)
    }
  }

  const alertsCount = allActiveAlerts.length

  const severityOrder: Record<'info' | 'warning' | 'danger', number> = {
    info: 1,
    warning: 2,
    danger: 3,
  }
  let highestAlertSeverity: 'info' | 'warning' | 'danger' | null = null
  let highestSeverityIdx = 0
  let dominantAlertCreatedAt: string | null = null
  let dominantAlert: (typeof allActiveAlerts)[number] | null = null
  for (const a of allActiveAlerts) {
    const severity = toOperationalAlertSeverity(a.severity)
    if (!severity) continue
    const idx = severityOrder[severity]
    if (idx > highestSeverityIdx) {
      highestSeverityIdx = idx
      highestAlertSeverity = severity
      dominantAlert = a
      dominantAlertCreatedAt = a.triggered_at
      continue
    }

    if (idx === highestSeverityIdx && dominantAlert !== null) {
      if (shouldPreferAlertByTriggeredAt(a, dominantAlert)) {
        dominantAlert = a
        dominantAlertCreatedAt = a.triggered_at
      }
    }
  }

  // --- Transshipment ---
  const hasTransshipment = allActiveAlerts.some((a) => a.type === 'TRANSSHIPMENT')

  // --- Last Event ---
  let lastEventAt: string | null = null
  for (const s of summaries) {
    for (const obs of s.timeline.observations) {
      if (obs.event_time && (lastEventAt === null || obs.event_time > lastEventAt)) {
        lastEventAt = obs.event_time
      }
    }
  }

  return {
    process_id: processId,
    reference,
    carrier,
    container_count: containerCount,
    process_status: processStatus,
    lifecycle_bucket: processLifecycleBucket,
    final_delivery_complete: finalDeliveryComplete,
    full_logistics_complete: fullLogisticsComplete,
    eta,
    eta_coverage: {
      total: containerCount,
      eligible_total: etaEligibleTotal,
      with_eta: etaWithValue,
    },
    alerts_count: alertsCount,
    highest_alert_severity: highestAlertSeverity,
    dominant_alert_created_at: dominantAlertCreatedAt,
    has_transshipment: hasTransshipment,
    last_event_at: lastEventAt,
  }
}

export function createListProcessesWithOperationalSummaryUseCase(
  deps: ListProcessesWithOperationalSummaryDeps,
) {
  return async function execute(): Promise<ListProcessesWithOperationalSummaryResult> {
    const allProcesses = await deps.repository.fetchAll()
    const processIds = allProcesses.map((p) => p.id)

    const { containersByProcessId } = await deps.containerUseCases.listByProcessIds({
      processIds,
    })

    const allContainerNumbers = Array.from(containersByProcessId.values()).flatMap((containers) =>
      containers.map((container) => String(container.containerNumber)),
    )
    const syncByContainerNumber = await listSyncMetadataByContainerNumber({
      containerNumbers: allContainerNumbers,
      trackingUseCases: deps.trackingUseCases,
    })

    // Calculate 'now' once for consistent ETA comparison across all processes
    const now = new Date().toISOString()

    const processes: ProcessWithOperationalSummary[] = await Promise.all(
      allProcesses.map(async (process) => {
        const containers = containersByProcessId.get(process.id) ?? []
        const pwc: ProcessWithContainers = { process, containers }

        // For each container, get tracking summary
        const summaries = await Promise.all(
          containers.map(async (c) => {
            try {
              return await deps.trackingUseCases.getContainerSummary(
                String(c.id),
                String(c.containerNumber),
              )
            } catch (err) {
              console.error(
                `Failed to get tracking summary for container ${String(c.containerNumber)} (${String(c.id)}):`,
                err,
              )
              // Return a minimal fallback summary
              const fallback: ContainerTrackingSummary = {
                status: 'UNKNOWN',
                operational: {
                  eta: null,
                  etaApplicable: true,
                  lifecycleBucket: 'pre_arrival',
                },
                alerts: [],
                timeline: { observations: [] },
              }
              return fallback
            }
          }),
        )

        const summary = aggregateOperationalSummary(
          process.id,
          process.reference ?? null,
          process.carrier ?? null,
          containers.length,
          summaries,
          now,
        )
        const sync = deriveProcessSyncSummary({
          containers,
          syncByContainerNumber,
        })

        const normalizedSummary = shouldUseNotSyncedStatus({
          containerCount: containers.length,
          processStatus: summary.process_status,
          syncStatus: sync.lastSyncStatus,
        })
          ? { ...summary, process_status: 'NOT_SYNCED' as const }
          : summary

        return { pwc, summary: normalizedSummary, sync }
      }),
    )

    return { processes }
  }
}
