import type { SyncQueuePort } from '~/capabilities/sync/application/ports/sync-queue.port'
import type { SyncStatusReadPort } from '~/capabilities/sync/application/ports/sync-status-read.port'
import type { SyncTargetReadPort } from '~/capabilities/sync/application/ports/sync-target-read.port'
import { createSyncEnqueuePolicyService } from '~/capabilities/sync/application/services/sync-enqueue-policy.service'
import { createSyncTargetResolverService } from '~/capabilities/sync/application/services/sync-target-resolver.service'
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
  createSyncProcessUseCase,
  type SyncProcessDeps,
} from '~/capabilities/sync/application/usecases/sync-process.usecase'

export type CreateSyncUseCasesDeps = {
  readonly targetReadPort: SyncTargetReadPort
  readonly queuePort: SyncQueuePort
  readonly statusReadPort: SyncStatusReadPort
  readonly refreshProcessDeps: RefreshProcessDeps
  readonly syncDashboardDeps?: Partial<
    Omit<SyncDashboardDeps, 'targetResolverService' | 'enqueuePolicyService' | 'queuePort'>
  >
  readonly syncProcessDeps?: Partial<
    Omit<SyncProcessDeps, 'targetResolverService' | 'enqueuePolicyService' | 'queuePort'>
  >
  readonly syncContainerDeps?: Partial<
    Omit<SyncContainerDeps, 'targetResolverService' | 'enqueuePolicyService' | 'queuePort'>
  >
  readonly getSyncStatusDeps?: Partial<Omit<GetSyncStatusDeps, 'statusReadPort'>>
}

export function createSyncUseCases(deps: CreateSyncUseCasesDeps) {
  const targetResolverService = createSyncTargetResolverService({
    targetReadPort: deps.targetReadPort,
  })
  const enqueuePolicyService = createSyncEnqueuePolicyService({
    queuePort: deps.queuePort,
  })

  const syncDashboard = createSyncDashboardUseCase({
    targetResolverService,
    enqueuePolicyService,
    queuePort: deps.queuePort,
    ...deps.syncDashboardDeps,
  })

  const syncProcess = createSyncProcessUseCase({
    targetResolverService,
    enqueuePolicyService,
    queuePort: deps.queuePort,
    ...deps.syncProcessDeps,
  })

  const syncContainer = createSyncContainerUseCase({
    targetResolverService,
    enqueuePolicyService,
    queuePort: deps.queuePort,
    ...deps.syncContainerDeps,
  })

  const getSyncStatus = createGetSyncStatusUseCase({
    statusReadPort: deps.statusReadPort,
    ...deps.getSyncStatusDeps,
  })

  const refreshProcess = createRefreshProcessUseCase(deps.refreshProcessDeps)

  return {
    syncDashboard,
    syncProcess,
    syncContainer,
    getSyncStatus,
    refreshProcess,
  }
}

export type SyncUseCases = ReturnType<typeof createSyncUseCases>
