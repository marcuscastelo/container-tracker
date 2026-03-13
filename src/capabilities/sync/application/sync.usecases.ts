import type { CarrierDetectionWritePort } from '~/capabilities/sync/application/ports/carrier-detection-write.port'
import type { SyncQueuePort } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncStatusReadPort } from '~/capabilities/sync/application/ports/sync-status-read.port'
import type { SyncTargetReadPort } from '~/capabilities/sync/application/ports/sync-target-read.port'
import { createSyncEnqueuePolicyService } from '~/capabilities/sync/application/services/sync-enqueue-policy.service'
import { createSyncTargetResolverService } from '~/capabilities/sync/application/services/sync-target-resolver.service'
import {
  createDetectProcessCarrierUseCase,
  type DetectProcessCarrierDeps,
} from '~/capabilities/sync/application/usecases/detect-process-carrier.usecase'
import {
  createGetSyncStatusUseCase,
  type GetSyncStatusDeps,
} from '~/capabilities/sync/application/usecases/get-sync-status.usecase'
import {
  createRefreshProcessUseCase,
  type RefreshProcessDeps,
} from '~/capabilities/sync/application/usecases/refresh-process.usecase'
import {
  createSyncContainerUseCase,
  type SyncContainerDeps,
} from '~/capabilities/sync/application/usecases/sync-container.usecase'
import {
  createSyncDashboardUseCase,
  type SyncDashboardDeps,
} from '~/capabilities/sync/application/usecases/sync-dashboard.usecase'
import {
  isContainerNotFoundLikeStatus,
  waitForTerminalStatuses,
} from '~/capabilities/sync/application/usecases/sync-execution'
import {
  createSyncProcessUseCase,
  type SyncProcessDeps,
} from '~/capabilities/sync/application/usecases/sync-process.usecase'
import { createCarrierDetectionEngine } from '~/capabilities/sync/carrier-detection/carrier-detection.engine'
import { createCarrierDetectionPolicy } from '~/capabilities/sync/carrier-detection/carrier-detection.policy'

export type CreateSyncUseCasesDeps = {
  readonly targetReadPort: SyncTargetReadPort
  readonly queuePort: SyncQueuePort
  readonly statusReadPort: SyncStatusReadPort
  readonly refreshProcessDeps: RefreshProcessDeps
  readonly carrierDetectionWritePort: CarrierDetectionWritePort
  readonly syncDashboardDeps?: Partial<
    Omit<SyncDashboardDeps, 'targetResolverService' | 'enqueuePolicyService' | 'queuePort'>
  >
  readonly syncProcessDeps?: Partial<
    Omit<
      SyncProcessDeps,
      | 'targetReadPort'
      | 'enqueuePolicyService'
      | 'queuePort'
      | 'carrierDetectionEngine'
      | 'carrierDetectionWritePort'
    >
  >
  readonly syncContainerDeps?: Partial<
    Omit<
      SyncContainerDeps,
      | 'targetReadPort'
      | 'enqueuePolicyService'
      | 'queuePort'
      | 'carrierDetectionEngine'
      | 'carrierDetectionWritePort'
    >
  >
  readonly getSyncStatusDeps?: Partial<Omit<GetSyncStatusDeps, 'statusReadPort'>>
  readonly detectProcessCarrierDeps?: Partial<
    Omit<
      DetectProcessCarrierDeps,
      'targetReadPort' | 'carrierDetectionEngine' | 'carrierDetectionWritePort'
    >
  >
}

export function createSyncUseCases(deps: CreateSyncUseCasesDeps) {
  const targetResolverService = createSyncTargetResolverService({
    targetReadPort: deps.targetReadPort,
  })
  const enqueuePolicyService = createSyncEnqueuePolicyService({
    queuePort: deps.queuePort,
  })
  const carrierDetectionPolicy = createCarrierDetectionPolicy()
  const carrierDetectionEngine = createCarrierDetectionEngine({
    policy: carrierDetectionPolicy,
    async probeProvider(command) {
      const enqueueResult = await deps.queuePort.enqueueContainerSyncRequest({
        tenantId: command.tenantId,
        provider: command.provider,
        containerNumber: command.containerNumber,
        mode: 'manual',
      })

      const statuses = await waitForTerminalStatuses({
        syncRequestIds: [enqueueResult.id],
        timeoutMs: 180_000,
        pollIntervalMs: 5_000,
        getSyncRequestStatuses: deps.queuePort.getSyncRequestStatuses,
        nowMs: Date.now,
        sleep: async (delayMs: number) =>
          new Promise<void>((resolve) => {
            globalThis.setTimeout(resolve, delayMs)
          }),
        timeoutErrorMessage: 'carrier_detection_timeout',
      })
      const status = statuses[0]
      if (!status) {
        return {
          kind: 'not_found',
        }
      }

      if (status.status === 'DONE') {
        return {
          kind: 'found',
        }
      }

      if (isContainerNotFoundLikeStatus(status)) {
        return {
          kind: 'not_found',
        }
      }

      return {
        kind: 'error',
        error: status.lastError ?? `carrier_probe_${status.status.toLowerCase()}`,
      }
    },
  })

  const syncDashboard = createSyncDashboardUseCase({
    targetResolverService,
    enqueuePolicyService,
    queuePort: deps.queuePort,
    ...deps.syncDashboardDeps,
  })

  const syncProcess = createSyncProcessUseCase({
    targetReadPort: deps.targetReadPort,
    enqueuePolicyService,
    queuePort: deps.queuePort,
    carrierDetectionEngine,
    carrierDetectionWritePort: deps.carrierDetectionWritePort,
    ...deps.syncProcessDeps,
  })

  const syncContainer = createSyncContainerUseCase({
    targetReadPort: deps.targetReadPort,
    enqueuePolicyService,
    queuePort: deps.queuePort,
    carrierDetectionEngine,
    carrierDetectionWritePort: deps.carrierDetectionWritePort,
    ...deps.syncContainerDeps,
  })

  const getSyncStatus = createGetSyncStatusUseCase({
    statusReadPort: deps.statusReadPort,
    ...deps.getSyncStatusDeps,
  })

  const refreshProcess = createRefreshProcessUseCase(deps.refreshProcessDeps)
  const detectProcessCarrier = createDetectProcessCarrierUseCase({
    targetReadPort: deps.targetReadPort,
    carrierDetectionEngine,
    carrierDetectionWritePort: deps.carrierDetectionWritePort,
    ...deps.detectProcessCarrierDeps,
  })

  return {
    syncDashboard,
    syncProcess,
    syncContainer,
    getSyncStatus,
    refreshProcess,
    detectProcessCarrier,
  }
}

export type SyncUseCases = ReturnType<typeof createSyncUseCases>
