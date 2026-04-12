import type { DashboardProcessUseCases } from '~/capabilities/dashboard/application/dashboard.processes.projection'
import { Instant } from '~/shared/time/instant'
import { parseInstantFromIso } from '~/shared/time/parsing'

export type DashboardKpisReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
}

export type DashboardKpisReadModel = {
  readonly activeProcesses: number
  readonly trackedContainers: number
  readonly activeIncidents: number
  readonly affectedContainers: number
  readonly lastSyncAt: string | null
}

function toValidTimestampMs(value: string | null): number | null {
  if (value === null) return null
  return parseInstantFromIso(value)?.toEpochMs() ?? null
}

export function createDashboardKpisReadModelUseCase(deps: DashboardKpisReadModelDeps) {
  return async function execute(): Promise<DashboardKpisReadModel> {
    const { processes } = await deps.processUseCases.listProcessesWithOperationalSummary()

    let activeProcesses = 0
    let trackedContainers = 0
    let activeIncidents = 0
    let affectedContainers = 0
    let latestSyncTimestampMs: number | null = null

    for (const process of processes) {
      trackedContainers += process.pwc.containers.length

      if (process.summary.full_logistics_complete === false) {
        activeProcesses += 1
      }

      activeIncidents += process.summary.operational_incidents?.summary.active_incidents_count ?? 0
      affectedContainers +=
        process.summary.operational_incidents?.summary.affected_containers_count ?? 0

      const currentSyncTimestampMs = toValidTimestampMs(process.sync?.lastSyncAt ?? null)
      if (currentSyncTimestampMs === null) {
        continue
      }

      if (latestSyncTimestampMs === null || currentSyncTimestampMs > latestSyncTimestampMs) {
        latestSyncTimestampMs = currentSyncTimestampMs
      }
    }

    return {
      activeProcesses,
      trackedContainers,
      activeIncidents,
      affectedContainers,
      lastSyncAt:
        latestSyncTimestampMs === null
          ? null
          : Instant.fromEpochMs(latestSyncTimestampMs).toIsoString(),
    }
  }
}
