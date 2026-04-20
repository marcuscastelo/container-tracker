import {
  type CreateSyncUseCasesDeps,
  createSyncUseCases,
  type SyncUseCases,
} from '~/capabilities/sync/application/sync.usecases'
import {
  createSyncControllers,
  type SyncControllers,
} from '~/capabilities/sync/interface/http/sync.controllers'
import {
  createSyncStatusControllers,
  type SyncStatusControllers,
} from '~/capabilities/sync/interface/http/sync-status.controllers'

type SyncControllersBootstrapOverrides = {
  readonly syncUseCases?: SyncUseCases
  readonly syncControllers?: SyncControllers
  readonly syncStatusControllers?: SyncStatusControllers
}

type SyncControllersBootstrapDeps = CreateSyncUseCasesDeps & {
  readonly defaultTenantId: string
}

export function bootstrapSyncControllers(
  deps: SyncControllersBootstrapDeps,
  overrides: SyncControllersBootstrapOverrides = {},
): {
  readonly syncUseCases: SyncUseCases
  readonly syncControllers: SyncControllers
  readonly syncStatusControllers: SyncStatusControllers
} {
  const syncUseCases = overrides.syncUseCases ?? createSyncUseCases(deps)

  const syncControllers =
    overrides.syncControllers ??
    createSyncControllers({
      syncUseCases,
      defaultTenantId: deps.defaultTenantId,
    })

  const syncStatusControllers =
    overrides.syncStatusControllers ??
    createSyncStatusControllers({
      syncUseCases,
    })

  return {
    syncUseCases,
    syncControllers,
    syncStatusControllers,
  }
}
