export type ReplayMode = 'DRY_RUN' | 'APPLY' | 'ROLLBACK'

export type ReplayRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'APPLIED' | 'ROLLED_BACK'

export const REPLAY_TERMINAL_STATUSES: readonly ReplayRunStatus[] = [
  'SUCCEEDED',
  'FAILED',
  'APPLIED',
  'ROLLED_BACK',
]
