import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessWithContainers } from '~/modules/process/application/process.readmodels'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import { deriveProcessStatusFromContainers } from '~/modules/process/application/projections/deriveProcessStatus'
import type { ProcessOperationalSummary } from '~/modules/process/application/projections/processOperationalSummary'
import type { ContainerStatus } from '~/modules/tracking/domain/containerStatus'
import type { TrackingAlert } from '~/modules/tracking/domain/trackingAlert'

/**
 * Minimal tracking summary needed for process-level aggregation.
 * Matches the subset of GetContainerSummaryResult we consume.
 */
type ContainerTrackingSummary = {
  readonly status: ContainerStatus
  readonly alerts: readonly TrackingAlert[]
  readonly timeline: {
    readonly observations: readonly { readonly event_time: string | null }[]
  }
}

type TrackingFacade = {
  getContainerSummary(
    containerId: string,
    containerNumber: string,
  ): Promise<ContainerTrackingSummary>
}

export type ListProcessesWithOperationalSummaryDeps = {
  readonly repository: ProcessRepository
  readonly containerUseCases: Pick<ContainerUseCasesForProcess, 'listByProcessIds'>
  readonly trackingUseCases: TrackingFacade
}

export type ProcessWithOperationalSummary = {
  readonly pwc: ProcessWithContainers
  readonly summary: ProcessOperationalSummary
}

export type ListProcessesWithOperationalSummaryResult = {
  readonly processes: readonly ProcessWithOperationalSummary[]
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
): ProcessOperationalSummary {
  // --- Process Status ---
  const statuses: ContainerStatus[] = summaries.map((s) => s.status)
  const processStatus = deriveProcessStatusFromContainers(statuses)

  // --- ETA ---
  // Select earliest future ETA among containers
  // ETA is the latest EXPECTED event_time for observations that represent future events
  const now = new Date().toISOString()
  let eta: string | null = null
  for (const s of summaries) {
    for (const obs of s.timeline.observations) {
      if (obs.event_time && obs.event_time > now) {
        if (eta === null || obs.event_time < eta) {
          eta = obs.event_time
        }
      }
    }
  }

  // --- Alerts ---
  const allActiveAlerts: TrackingAlert[] = []
  for (const s of summaries) {
    for (const a of s.alerts) {
      allActiveAlerts.push(a)
    }
  }

  const alertsCount = allActiveAlerts.length

  const severityOrder: Record<string, number> = { info: 1, warning: 2, danger: 3 }
  let highestAlertSeverity: 'info' | 'warning' | 'danger' | null = null
  let highestSeverityIdx = 0
  for (const a of allActiveAlerts) {
    const idx = severityOrder[a.severity] ?? 0
    if (idx > highestSeverityIdx) {
      highestSeverityIdx = idx
      highestAlertSeverity = a.severity
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
    eta,
    alerts_count: alertsCount,
    highest_alert_severity: highestAlertSeverity,
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
              console.error(`Failed to get tracking summary for container ${String(c.id)}:`, err)
              // Return a minimal fallback summary
              const fallback: ContainerTrackingSummary = {
                status: 'UNKNOWN',
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
        )

        return { pwc, summary }
      }),
    )

    return { processes }
  }
}
