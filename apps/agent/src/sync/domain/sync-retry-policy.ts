import type { ProviderRunResult } from '@agent/core/contracts/provider.contract'

export type SyncRetryDecision = {
  readonly shouldRetryLocally: false
  readonly reason: 'backend_driven'
}

export function decideSyncRetryPolicy(_result: ProviderRunResult): SyncRetryDecision {
  return {
    shouldRetryLocally: false,
    reason: 'backend_driven',
  }
}
