import type { ProcessSyncStatus } from '~/modules/process/ui/viewmodels/process-summary.vm'

type SyncStatus = ProcessSyncStatus

type LocalSyncFeedback = 'success' | 'error' | null

// TODO: `resolveProcessSyncVisualState` should ideally not be in a .tsx file
// Issue URL: https://github.com/marcuscastelo/container-tracker/issues/244
export function resolveProcessSyncVisualState(command: {
  readonly statusFromServer: SyncStatus
  readonly isSubmitting: boolean
  readonly localFeedback: LocalSyncFeedback
}): SyncStatus {
  // Priority:
  // 1. Local submitting -> syncing
  // 2. Server-reported syncing -> syncing
  // 3. Local ephemeral feedback (success / error) -> shown locally
  // 4. Otherwise idle
  if (command.isSubmitting) return 'syncing'
  // If server reports any non-idle state, prefer it over local ephemeral feedback.
  if (command.statusFromServer !== 'idle') return command.statusFromServer
  if (command.localFeedback === 'success') return 'success'
  if (command.localFeedback === 'error') return 'error'
  return 'idle'
}
