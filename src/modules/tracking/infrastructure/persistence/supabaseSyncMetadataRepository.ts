import { z } from 'zod/v4'

import type {
  SyncMetadataRecord,
  SyncMetadataRepository,
} from '~/modules/tracking/application/ports/tracking.sync-metadata.repository'
import { normalizeContainerNumber } from '~/modules/tracking/application/usecases/get-containers-sync-metadata.usecase'
import { serverEnv } from '~/shared/config/server-env'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const SyncMetadataRowSchema = z.object({
  ref_value: z.string(),
  provider: z.string().nullable(),
  status: z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED']),
  created_at: z.string(),
  updated_at: z.string(),
  last_error: z.string().nullable(),
})

const SyncMetadataRowsSchema = z.array(SyncMetadataRowSchema)

export const supabaseSyncMetadataRepository: SyncMetadataRepository = {
  async listByContainerNumbers(command): Promise<readonly SyncMetadataRecord[]> {
    const normalizedContainerNumbers = Array.from(
      new Set(
        command.containerNumbers
          .map(normalizeContainerNumber)
          .filter((containerNumber) => containerNumber.length > 0),
      ),
    )

    if (normalizedContainerNumbers.length === 0) return []

    const result = await supabaseServer
      .from('sync_requests')
      .select('ref_value,provider,status,created_at,updated_at,last_error')
      .eq('tenant_id', serverEnv.SYNC_DEFAULT_TENANT_ID)
      .eq('ref_type', 'container')
      .in('ref_value', normalizedContainerNumbers)

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'list_sync_metadata_by_container_numbers',
      table: 'sync_requests',
    })

    const rows = SyncMetadataRowsSchema.parse(data)

    return rows.map((row) => ({
      containerNumber: normalizeContainerNumber(row.ref_value),
      provider: row.provider,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastError: row.last_error,
    }))
  },
}
