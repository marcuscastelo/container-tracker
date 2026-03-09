export type SyncMode = 'manual' | 'live' | 'backfill'

export type SyncScope =
  | { readonly kind: 'container'; readonly containerNumber: string }
  | { readonly kind: 'process'; readonly processId: string }
  | { readonly kind: 'dashboard' }

export type EnqueueSyncCommand = {
  readonly tenantId: string
  readonly scope: SyncScope
  readonly mode: SyncMode
}
