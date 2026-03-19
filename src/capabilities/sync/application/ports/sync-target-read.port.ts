export type SyncTargetContainerRecord = {
  readonly id?: string
  readonly processId: string
  readonly containerNumber: string
  readonly carrierCode: string | null
  readonly carrierAssignmentMode?: 'AUTO' | 'MANUAL'
  readonly carrierDetectedAt?: string | null
  readonly carrierDetectionSource?:
    | 'process-seed'
    | 'auto-detect'
    | 'manual-user'
    | 'legacy-backfill'
    | null
}

export type SyncTargetProcessRecord = {
  readonly id: string
  readonly carrierMode?: 'AUTO' | 'MANUAL'
  readonly defaultCarrierCode?: string | null
  readonly lastResolvedCarrierCode?: string | null
  readonly carrierResolvedAt?: string | null
}

export type SyncTargetReadPort = {
  readonly fetchProcessById: (command: {
    readonly processId: string
  }) => Promise<SyncTargetProcessRecord | null>
  readonly listActiveProcessIds: () => Promise<readonly string[]>
  readonly listContainersByProcessId: (command: { readonly processId: string }) => Promise<{
    readonly containers: readonly SyncTargetContainerRecord[]
  }>
  readonly listContainersByProcessIds: (command: {
    readonly processIds: readonly string[]
  }) => Promise<{
    readonly containersByProcessId: ReadonlyMap<string, readonly SyncTargetContainerRecord[]>
  }>
  readonly findContainersByNumber: (command: { readonly containerNumber: string }) => Promise<{
    readonly containers: readonly SyncTargetContainerRecord[]
  }>
}
