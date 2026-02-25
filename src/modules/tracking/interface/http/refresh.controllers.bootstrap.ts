import { z } from 'zod/v4'

import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import {
  createRefreshRestContainerUseCase,
  type RefreshRestContainerDeps,
} from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'
import {
  createRefreshControllers,
  type RefreshControllers,
} from '~/modules/tracking/interface/http/refresh.controllers'
import { serverEnv } from '~/shared/config/server-env'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const EnqueueSyncRequestRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'LEASED']),
  is_new: z.boolean(),
})

const EnqueueSyncRequestRowsSchema = z.array(EnqueueSyncRequestRowSchema).min(1)

export type RefreshControllersBootstrapOverrides = Partial<{
  readonly refreshRestDeps: RefreshRestContainerDeps
}>

export function bootstrapRefreshControllers(
  overrides: RefreshControllersBootstrapOverrides = {},
): RefreshControllers {
  const refreshRestDeps: RefreshRestContainerDeps = overrides.refreshRestDeps ?? {
    containerLookup: containerUseCases,
    enqueueSyncRequest: {
      async enqueueSyncRequest(command) {
        const result = await supabaseServer.rpc('enqueue_sync_request', {
          p_tenant_id: serverEnv.SYNC_DEFAULT_TENANT_ID,
          p_provider: command.provider,
          p_ref_type: command.refType,
          p_ref_value: command.refValue,
          p_priority: command.priority,
        })

        const data = unwrapSupabaseResultOrThrow(result, {
          operation: 'enqueue_sync_request',
          table: 'sync_requests',
        })

        const parsed = EnqueueSyncRequestRowsSchema.parse(data)
        const row = parsed[0]

        return {
          id: row.id,
          status: row.status,
          isNew: row.is_new,
        }
      },
    },
  }

  return createRefreshControllers({
    refreshRestUseCase: createRefreshRestContainerUseCase(refreshRestDeps),
  })
}
