import { supabase } from '~/shared/supabase/supabase'
import {
  type SyncRequestRealtimeEvent,
  type SyncRequestsRealtimeStatusUpdate,
  subscribeSyncRequestsByIds,
} from '~/shared/supabase/sync-requests.realtime'

export type { SyncRequestRealtimeEvent }

export function subscribeToSyncRequestsRealtimeByIds(command: {
  readonly syncRequestIds: readonly string[]
  readonly onEvent: (event: SyncRequestRealtimeEvent) => void
  readonly onStatus?: (status: SyncRequestsRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  return subscribeSyncRequestsByIds({
    client: supabase,
    syncRequestIds: command.syncRequestIds,
    onEvent: command.onEvent,
    onStatus: command.onStatus,
  })
}
