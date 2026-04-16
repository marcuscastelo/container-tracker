import { supabase } from '~/shared/supabase/supabase'
import {
  type SyncRequestRealtimeEvent,
  type SyncRequestsRealtimeStatusUpdate,
  subscribeSyncRequestsByContainerRefs,
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
    ...(command.onStatus ? { onStatus: command.onStatus } : {}),
  })
}

export function subscribeToSyncRequestsRealtimeByContainerRefs(command: {
  readonly containerNumbers: readonly string[]
  readonly onEvent: (event: SyncRequestRealtimeEvent) => void
  readonly onStatus?: (status: SyncRequestsRealtimeStatusUpdate) => void
}): { readonly unsubscribe: () => void } {
  return subscribeSyncRequestsByContainerRefs({
    client: supabase,
    containerNumbers: command.containerNumbers,
    onEvent: command.onEvent,
    ...(command.onStatus ? { onStatus: command.onStatus } : {}),
  })
}
