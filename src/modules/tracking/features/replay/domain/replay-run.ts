import type { ReplayDiffSummary } from '~/modules/tracking/features/replay/domain/replay-diff'
import type {
  ReplayMode,
  ReplayRunStatus,
} from '~/modules/tracking/features/replay/domain/replay-status'

export type ReplayTargetLookup = {
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: string | null
  readonly processId: string | null
  readonly processReference: string | null
  readonly snapshotCount: number
  readonly activeGenerationId: string | null
  readonly previousGenerationId: string | null
  readonly lastReplayRun: {
    readonly runId: string
    readonly mode: ReplayMode
    readonly status: ReplayRunStatus
    readonly createdAt: string
  } | null
}

export type ReplayRunTarget = {
  readonly targetId: string
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: string | null
  readonly snapshotCount: number
  readonly status: ReplayRunStatus
  readonly errorMessage: string | null
  readonly diffSummary: ReplayDiffSummary
  readonly createdGenerationId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type ReplayGeneration = {
  readonly id: string
  readonly containerId: string
  readonly sourceKind: 'LIVE' | 'REPLAY'
  readonly sourceRunId: string | null
  readonly createdAt: string
  readonly activatedAt: string | null
  readonly supersededAt: string | null
  readonly metadata: Record<string, unknown>
}

export type ReplayRunRecord = {
  readonly id: string
  readonly mode: ReplayMode
  readonly status: ReplayRunStatus
  readonly requestedBy: string
  readonly reason: string | null
  readonly createdAt: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly errorMessage: string | null
}

export type ReplayRunTargetRecord = {
  readonly id: string
  readonly runId: string
  readonly containerId: string
  readonly containerNumber: string
  readonly provider: string | null
  readonly snapshotCount: number
  readonly status: ReplayRunStatus
  readonly errorMessage: string | null
  readonly diffSummary: ReplayDiffSummary
  readonly createdGenerationId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type ReplayRunView = {
  readonly runId: string
  readonly mode: ReplayMode
  readonly status: ReplayRunStatus
  readonly requestedBy: string
  readonly reason: string | null
  readonly createdAt: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly codeVersion: string | null
  readonly errorMessage: string | null
  readonly summary: Record<string, unknown>
  readonly target: ReplayRunTarget | null
}

export type ReplayRunExecutionResult = {
  readonly run: ReplayRunView
}

export type ReplayRollbackResult = {
  readonly runId: string
  readonly status: ReplayRunStatus
  readonly activeGenerationId: string
  readonly previousGenerationId: string | null
}
