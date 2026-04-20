import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncTargetReadPort } from '~/capabilities/sync/application/ports/sync-target-read.port'
import {
  normalizeContainerNumber,
  toNormalizedProviderKey,
  toSupportedProvider,
} from '~/capabilities/sync/application/services/sync-provider-resolution.utils'
import type { SyncDashboardSkippedTarget } from '~/capabilities/sync/application/usecases/sync-dashboard-batch-result'

const MISSING_REQUIRED_DATA_MESSAGE =
  'Missing container number or provider required for dashboard manual sync.'
const UNSUPPORTED_PROVIDER_MESSAGE = 'Provider is not supported for dashboard manual sync.'

export type DashboardSyncEligibleTarget = {
  readonly processId: string
  readonly processReference: string | null
  readonly containerNumber: string
  readonly provider: SupportedSyncProvider
}

export type SyncDashboardTargetsResult = {
  readonly requestedProcesses: number
  readonly requestedContainers: number
  readonly eligibleTargets: readonly DashboardSyncEligibleTarget[]
  readonly skippedTargets: readonly SyncDashboardSkippedTarget[]
}

type SyncDashboardTargetsService = {
  readonly resolveTargets: () => Promise<SyncDashboardTargetsResult>
}

export function createSyncDashboardTargetsService(deps: {
  readonly targetReadPort: SyncTargetReadPort
}): SyncDashboardTargetsService {
  return {
    async resolveTargets() {
      const activeProcesses = await deps.targetReadPort.listActiveProcessesForDashboardSync()
      if (activeProcesses.length === 0) {
        return {
          requestedProcesses: 0,
          requestedContainers: 0,
          eligibleTargets: [],
          skippedTargets: [],
        }
      }

      const processIds = activeProcesses.map((process) => process.processId)
      const processReferenceById = new Map(
        activeProcesses.map((process) => [process.processId, process.processReference] as const),
      )

      const { containersByProcessId } = await deps.targetReadPort.listContainersByProcessIds({
        processIds,
      })

      const eligibleTargets: DashboardSyncEligibleTarget[] = []
      const skippedTargets: SyncDashboardSkippedTarget[] = []
      let requestedContainers = 0

      for (const process of activeProcesses) {
        const containers = containersByProcessId.get(process.processId) ?? []
        for (const container of containers) {
          requestedContainers += 1

          const containerNumber = normalizeContainerNumber(container.containerNumber)
          const provider = toSupportedProvider(container.carrierCode)
          const providerKey = toNormalizedProviderKey(container.carrierCode)
          const processReference = processReferenceById.get(process.processId) ?? null

          if (containerNumber.length === 0) {
            skippedTargets.push({
              processId: process.processId,
              processReference,
              containerNumber,
              provider: providerKey,
              reasonCode: 'MISSING_REQUIRED_DATA',
              reasonMessage: MISSING_REQUIRED_DATA_MESSAGE,
            })
            continue
          }

          if (provider === null) {
            skippedTargets.push({
              processId: process.processId,
              processReference,
              containerNumber,
              provider: providerKey,
              reasonCode: 'UNSUPPORTED_PROVIDER',
              reasonMessage: UNSUPPORTED_PROVIDER_MESSAGE,
            })
            continue
          }

          eligibleTargets.push({
            processId: process.processId,
            processReference,
            containerNumber,
            provider,
          })
        }
      }

      return {
        requestedProcesses: activeProcesses.length,
        requestedContainers,
        eligibleTargets,
        skippedTargets,
      }
    },
  }
}

export type { SyncDashboardTargetsService }
