import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { ReplayDiffSummary } from '~/modules/tracking/features/replay/domain/replay-diff'
import type {
  ReplayGeneration,
  ReplayRunRecord,
  ReplayRunTargetRecord,
  ReplayRunView,
  ReplayTargetLookup,
} from '~/modules/tracking/features/replay/domain/replay-run'
import type {
  ReplayMode,
  ReplayRunStatus,
} from '~/modules/tracking/features/replay/domain/replay-status'

export type ReplayGenerationPointer = {
  readonly containerId: string
  readonly activeGenerationId: string | null
  readonly previousGenerationId: string | null
}

export type TrackingReplayAdminRepository = {
  findTargetByContainerNumber(containerNumber: string): Promise<ReplayTargetLookup | null>

  findTargetByContainerId(containerId: string): Promise<ReplayTargetLookup | null>

  listSnapshotsForReplay(containerId: string): Promise<readonly Snapshot[]>

  createRun(command: {
    readonly mode: ReplayMode
    readonly status: ReplayRunStatus
    readonly requestedBy: string
    readonly reason: string | null
    readonly codeVersion: string | null
  }): Promise<ReplayRunRecord>

  updateRun(command: {
    readonly runId: string
    readonly status: ReplayRunStatus
    readonly errorMessage: string | null
    readonly summary: Record<string, unknown>
    readonly finishedAt: string | null
  }): Promise<void>

  createRunTarget(command: {
    readonly runId: string
    readonly containerId: string
    readonly containerNumber: string
    readonly provider: string | null
    readonly snapshotCount: number
    readonly status: ReplayRunStatus
  }): Promise<ReplayRunTargetRecord>

  updateRunTarget(command: {
    readonly runTargetId: string
    readonly status: ReplayRunStatus
    readonly errorMessage: string | null
    readonly diffSummary?: ReplayDiffSummary
    readonly createdGenerationId?: string | null
    readonly lockHeartbeatAt?: string | null
    readonly lockExpiresAt?: string | null
  }): Promise<void>

  findGenerationPointer(containerId: string): Promise<ReplayGenerationPointer | null>

  createGeneration(command: {
    readonly containerId: string
    readonly sourceKind: 'LIVE' | 'REPLAY'
    readonly sourceRunId: string | null
    readonly metadata: Record<string, unknown>
  }): Promise<ReplayGeneration>

  persistGenerationDerivations(command: {
    readonly containerId: string
    readonly generationId: string
    readonly observations: readonly Observation[]
    readonly alerts: readonly TrackingAlert[]
  }): Promise<void>

  listObservationsByGeneration(command: {
    readonly containerId: string
    readonly generationId: string
  }): Promise<readonly Observation[]>

  listAlertsByGeneration(command: {
    readonly containerId: string
    readonly generationId: string
  }): Promise<readonly TrackingAlert[]>

  activateGenerationPointer(command: {
    readonly containerId: string
    readonly nextActiveGenerationId: string
    readonly runId: string
    readonly activatedAt: string
  }): Promise<ReplayGenerationPointer>

  rollbackGenerationPointer(command: {
    readonly containerId: string
    readonly runId: string
    readonly rolledBackAt: string
  }): Promise<ReplayGenerationPointer | null>

  getRun(runId: string): Promise<ReplayRunView | null>
}
