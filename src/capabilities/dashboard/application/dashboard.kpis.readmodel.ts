import type { DashboardProcessUseCases } from '~/capabilities/dashboard/application/dashboard.processes.projection'
import { Instant } from '~/shared/time/instant'
import { parseInstantFromIso } from '~/shared/time/parsing'

export type DashboardKpisReadModelDeps = {
  readonly processUseCases: DashboardProcessUseCases
}

export type DashboardKpisReadModel = {
  readonly activeProcesses: number
  readonly trackedContainers: number
  readonly processesWithAlerts: number
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
    let processesWithAlerts = 0
    let latestSyncTimestampMs: number | null = null

    for (const process of processes) {
      trackedContainers += process.pwc.containers.length

      if (process.summary.full_logistics_complete === false) {
        activeProcesses += 1
      }

      if ((process.summary.alerts_count ?? 0) > 0) {
        processesWithAlerts += 1
      }

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
      processesWithAlerts,
      lastSyncAt:
        latestSyncTimestampMs === null
          ? null
          : Instant.fromEpochMs(latestSyncTimestampMs).toIsoString(),
    }
  }
}
