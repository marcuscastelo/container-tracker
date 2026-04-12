import { z } from 'zod/v4'

import { HttpError } from '~/shared/errors/httpErrors'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'
import { normalizeContainerNumber } from '~/shared/utils/normalizeContainerNumber'

const ReplayLockActiveResponseSchema = z.boolean()

export async function assertContainerReplayLockIsFree(containerNumber: string): Promise<void> {
  const normalizedContainerNumber = normalizeContainerNumber(containerNumber)
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
