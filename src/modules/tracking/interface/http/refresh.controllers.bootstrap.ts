import { z } from 'zod/v4'

import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import {
  createRefreshRestContainerUseCase,
  type RefreshRestContainerDeps,
} from '~/modules/tracking/application/usecases/refresh-rest-container.usecase'
import {
  createRefreshControllers,
  type RefreshControllers,
} from '~/modules/tracking/interface/http/refresh.controllers'
import { serverEnv } from '~/shared/config/server-env'
import { HttpError } from '~/shared/errors/httpErrors'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const EnqueueSyncRequestRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'LEASED']),
  is_new: z.boolean(),
})

const EnqueueSyncRequestRowsSchema = z.array(EnqueueSyncRequestRowSchema).min(1)

const RefreshStatusOpenSchema = z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED'])

const RefreshStatusRowSchema = z.object({
  id: z.string().uuid(),
  status: RefreshStatusOpenSchema,
  last_error: z.string().nullable(),
  updated_at: z.string(),
  ref_value: z.string(),
})

const RefreshStatusRowsSchema = z.array(RefreshStatusRowSchema)
const ReplayLockActiveResponseSchema = z.boolean()

async function assertContainerReplayLockIsFree(containerNumber: string): Promise<void> {
  const normalizedContainerNumber = containerNumber.toUpperCase().trim()
  const replayLockResult = await supabaseServer.rpc(
    'has_active_tracking_replay_lock_for_container_number',
    {
      p_container_number: normalizedContainerNumber,
    },
  )

  const replayLockActive = ReplayLockActiveResponseSchema.parse(
    unwrapSupabaseResultOrThrow(replayLockResult, {
      operation: 'has_active_tracking_replay_lock_for_container_number',
      table: 'tracking_replay_locks',
    }),
  )

  if (replayLockActive) {
    throw new HttpError(
      `tracking_replay_lock_active_for_container:${normalizedContainerNumber}`,
      409,
    )
  }
}

type RefreshControllersBootstrapOverrides = Partial<{
  readonly refreshRestDeps: RefreshRestContainerDeps
}>

export function bootstrapRefreshControllers(
  overrides: RefreshControllersBootstrapOverrides = {},
): RefreshControllers {
  const refreshRestDeps: RefreshRestContainerDeps = overrides.refreshRestDeps ?? {
    containerLookup: containerUseCases,
    processLookup: processUseCases,
    containerCarrierMutation: containerUseCases,
    enqueueSyncRequest: {
      async enqueueSyncRequest(command) {
        await assertContainerReplayLockIsFree(command.refValue)

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
        if (row === undefined) {
          throw new Error('enqueue_sync_request returned no rows')
        }

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
    async getSyncRequestStatuses({ syncRequestIds }) {
      const uniqueSyncRequestIds = Array.from(new Set(syncRequestIds))

      const result = await supabaseServer
        .from('sync_requests')
        .select('id,status,last_error,updated_at,ref_value')
        .eq('tenant_id', serverEnv.SYNC_DEFAULT_TENANT_ID)
        .in('id', uniqueSyncRequestIds)

      const data = unwrapSupabaseResultOrThrow(result, {
        operation: 'get_sync_request_statuses',
        table: 'sync_requests',
      })

      const rows = RefreshStatusRowsSchema.parse(data)
      const byId = new Map(rows.map((row) => [row.id, row]))

      const requests = syncRequestIds.map((syncRequestId) => {
        const row = byId.get(syncRequestId)
        if (!row) {
          return {
            syncRequestId,
            status: 'NOT_FOUND' as const,
            lastError: 'sync_request_not_found',
            updatedAt: null,
            refValue: null,
          }
        }

        return {
          syncRequestId: row.id,
          status: row.status,
          lastError: row.last_error,
          updatedAt: row.updated_at,
          refValue: row.ref_value,
        }
      })

      const allTerminal = requests.every((request) => {
        return (
          request.status === 'DONE' || request.status === 'FAILED' || request.status === 'NOT_FOUND'
        )
      })

      return {
        allTerminal,
        requests,
      }
    },
  })
}
