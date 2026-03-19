import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'

export type CarrierDetectionConfidence = 'HIGH' | 'LOW' | 'UNKNOWN'
export type CarrierDetectionRunStatus = 'RESOLVED' | 'FAILED' | 'RATE_LIMITED'
export type CarrierDetectionAttemptStatus = 'FOUND' | 'NOT_FOUND' | 'ERROR' | 'SKIPPED'

export type CarrierDetectionWritePort = {
  readonly recordDetectionRun?: (command: {
    readonly processId: string
    readonly containerNumber: string
    readonly containerId?: string
    readonly candidateProviders: readonly SupportedSyncProvider[]
    readonly attempts: readonly {
      readonly provider: SupportedSyncProvider
      readonly status: CarrierDetectionAttemptStatus
      readonly errorCode: string | null
      readonly rawResultRef: string | null
    }[]
    readonly status: CarrierDetectionRunStatus
    readonly resolvedProvider: SupportedSyncProvider | null
    readonly confidence: CarrierDetectionConfidence
    readonly errorCode: string | null
  }) => Promise<{ readonly runId: string; readonly won: boolean }>
  readonly persistDetectedCarrier: (command: {
    readonly processId: string | null
    readonly runId: string
    readonly containerNumber: string
    readonly carrierCode: string
    readonly confidence: CarrierDetectionConfidence
    readonly detectionSource: 'auto-detect'
  }) => Promise<void>
}
