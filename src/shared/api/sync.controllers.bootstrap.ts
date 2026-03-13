import { bootstrapSyncControllers } from '~/capabilities/sync/interface/http/sync.controllers.bootstrap'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import {
  createRefreshProcessDeps,
  createSyncQueuePort,
  createSyncStatusReadPort,
  createSyncTargetReadPort,
  resolveDefaultTenantId,
} from '~/shared/api/sync.bootstrap/sync.bootstrap.ports'

const defaultTenantId = resolveDefaultTenantId()

const targetReadPort = createSyncTargetReadPort({
  processUseCases,
  containerUseCases,
})

const queuePort = createSyncQueuePort({
  defaultTenantId,
})

const statusReadPort = createSyncStatusReadPort({
  targetReadPort,
  defaultTenantId,
})

const refreshProcessDeps = createRefreshProcessDeps({
  targetReadPort,
  queuePort,
  defaultTenantId,
})

const bootstrappedSyncControllers = bootstrapSyncControllers({
  targetReadPort,
  queuePort,
  statusReadPort,
  refreshProcessDeps,
  defaultTenantId,
})

export const syncControllers = bootstrappedSyncControllers.syncControllers
export const syncStatusControllers = bootstrappedSyncControllers.syncStatusControllers
