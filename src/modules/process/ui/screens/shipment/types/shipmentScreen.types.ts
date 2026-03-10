export type RefreshRetryState = { readonly current: number; readonly total: number }

export const REFRESH_SYNC_MAX_RETRIES = 5
export const REFRESH_SYNC_INITIAL_DELAY_MS = 5000
export const REFRESH_SOFT_BLOCK_WINDOW_MS = 60_000
