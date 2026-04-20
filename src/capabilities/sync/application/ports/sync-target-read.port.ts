export type SyncTargetContainerRecord = {
  readonly processId: string
  readonly containerNumber: string
  readonly carrierCode: string | null
}

export type SyncTargetReadPort = {
  readonly fetchProcessById: (command: {
    readonly processId: string
  }) => Promise<{ readonly id: string } | null>
  readonly listActiveProcessesForDashboardSync: () => Promise<
    readonly {
      readonly processId: string
      readonly processReference: string | null
    }[]
  >
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
