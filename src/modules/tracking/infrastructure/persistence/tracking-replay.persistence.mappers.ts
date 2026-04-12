import type { ReplayDiffSummary } from '~/modules/tracking/features/replay/domain/replay-diff'
import type {
  ReplayGeneration,
  ReplayRunRecord,
  ReplayRunTarget,
  ReplayRunTargetRecord,
  ReplayRunView,
  ReplayTargetLookup,
} from '~/modules/tracking/features/replay/domain/replay-run'
import type {
  ReplayMode,
  ReplayRunStatus,
} from '~/modules/tracking/features/replay/domain/replay-status'
import {
  alertRowToDomain,
  observationRowToDomain,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import type {
  TrackingDerivationGenerationRow,
  TrackingReplayRunRow,
  TrackingReplayRunTargetRow,
} from '~/modules/tracking/infrastructure/persistence/tracking-replay.row'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeReplayMode(value: string): ReplayMode {
  if (value === 'DRY_RUN' || value === 'APPLY' || value === 'ROLLBACK') {
    return value
  }

  throw new Error(`Invalid replay mode: ${value}`)
}

function normalizeReplayStatus(value: string): ReplayRunStatus {
  if (
    value === 'RUNNING' ||
    value === 'SUCCEEDED' ||
    value === 'FAILED' ||
    value === 'APPLIED' ||
    value === 'ROLLED_BACK'
  ) {
    return value
  }

  throw new Error(`Invalid replay run status: ${value}`)
}

function toDiffSummary(value: unknown): ReplayDiffSummary {
  if (!isRecord(value)) {
    return {
      snapshotCount: 0,
      currentGenerationId: null,
      candidateGenerationId: null,
      observationsCurrentCount: 0,
      observationsCandidateCount: 0,
      alertsCurrentCount: 0,
      alertsCandidateCount: 0,
      addedObservationFingerprints: [],
      removedObservationFingerprints: [],
      statusChanged: false,
      statusBefore: null,
      statusAfter: null,
      alertsChanged: false,
      potentialTemporalConflicts: [],
    }
  }

  const added = Array.isArray(value.addedObservationFingerprints)
    ? value.addedObservationFingerprints.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : []
  const removed = Array.isArray(value.removedObservationFingerprints)
    ? value.removedObservationFingerprints.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : []
  const conflicts = Array.isArray(value.potentialTemporalConflicts)
    ? value.potentialTemporalConflicts
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => ({
          fingerprintKey:
            typeof entry.fingerprintKey === 'string' ? entry.fingerprintKey : 'unknown-conflict',
          rawEventTime: typeof entry.rawEventTime === 'string' ? entry.rawEventTime : null,
          beforeInstant: typeof entry.beforeInstant === 'string' ? entry.beforeInstant : null,
          afterInstant: typeof entry.afterInstant === 'string' ? entry.afterInstant : null,
        }))
    : []

  return {
    snapshotCount: typeof value.snapshotCount === 'number' ? value.snapshotCount : 0,
    currentGenerationId:
      typeof value.currentGenerationId === 'string' ? value.currentGenerationId : null,
    candidateGenerationId:
      typeof value.candidateGenerationId === 'string' ? value.candidateGenerationId : null,
    observationsCurrentCount:
      typeof value.observationsCurrentCount === 'number' ? value.observationsCurrentCount : 0,
    observationsCandidateCount:
      typeof value.observationsCandidateCount === 'number' ? value.observationsCandidateCount : 0,
    alertsCurrentCount: typeof value.alertsCurrentCount === 'number' ? value.alertsCurrentCount : 0,
    alertsCandidateCount:
      typeof value.alertsCandidateCount === 'number' ? value.alertsCandidateCount : 0,
    addedObservationFingerprints: added,
    removedObservationFingerprints: removed,
    statusChanged: value.statusChanged === true,
    statusBefore: typeof value.statusBefore === 'string' ? value.statusBefore : null,
    statusAfter: typeof value.statusAfter === 'string' ? value.statusAfter : null,
    alertsChanged: value.alertsChanged === true,
    potentialTemporalConflicts: conflicts,
  }
}

function toSummary(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {}
  }

  return value
}

export function replayRunRowToDomain(row: TrackingReplayRunRow): ReplayRunRecord {
  return {
    id: row.id,
    mode: normalizeReplayMode(row.mode),
    status: normalizeReplayStatus(row.status),
    requestedBy: row.requested_by,
    reason: row.reason,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message,
  }
}

export function replayRunTargetRowToRecord(row: TrackingReplayRunTargetRow): ReplayRunTargetRecord {
  return {
    id: row.id,
    runId: row.run_id,
    containerId: row.container_id,
    containerNumber: row.container_number,
    provider: row.provider,
    snapshotCount: row.snapshot_count,
    status: normalizeReplayStatus(row.status),
    errorMessage: row.error_message,
    diffSummary: toDiffSummary(row.diff_summary_json),
    createdGenerationId: row.created_generation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function replayRunTargetRecordToDomainTarget(
  record: ReplayRunTargetRecord,
): ReplayRunTarget {
  return {
    targetId: record.id,
    containerId: record.containerId,
    containerNumber: record.containerNumber,
    provider: record.provider,
    snapshotCount: record.snapshotCount,
    status: record.status,
    errorMessage: record.errorMessage,
    diffSummary: record.diffSummary,
    createdGenerationId: record.createdGenerationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function replayGenerationRowToDomain(
  row: TrackingDerivationGenerationRow,
): ReplayGeneration {
  const metadata = isRecord(row.metadata_json) ? row.metadata_json : {}

  return {
    id: row.id,
    containerId: row.container_id,
    sourceKind: row.source_kind === 'LIVE' ? 'LIVE' : 'REPLAY',
    sourceRunId: row.source_run_id,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    supersededAt: row.superseded_at,
    metadata,
  }
}

export function replayLookupRowToDomain(row: {
  readonly container_id: string
  readonly container_number: string
  readonly provider: string | null
  readonly process_id: string | null
  readonly process_reference: string | null
  readonly snapshot_count: number
  readonly active_generation_id: string | null
  readonly previous_generation_id: string | null
  readonly last_run_id: string | null
  readonly last_run_mode: string | null
  readonly last_run_status: string | null
  readonly last_run_created_at: string | null
}): ReplayTargetLookup {
  const hasLastRun =
    row.last_run_id !== null &&
    row.last_run_mode !== null &&
    row.last_run_status !== null &&
    row.last_run_created_at !== null

  return {
    containerId: row.container_id,
    containerNumber: row.container_number,
    provider: row.provider,
    processId: row.process_id,
    processReference: row.process_reference,
    snapshotCount: row.snapshot_count,
    activeGenerationId: row.active_generation_id,
    previousGenerationId: row.previous_generation_id,
    lastReplayRun: hasLastRun
      ? {
          runId: row.last_run_id,
          mode: normalizeReplayMode(row.last_run_mode),
          status: normalizeReplayStatus(row.last_run_status),
          createdAt: row.last_run_created_at,
        }
      : null,
  }
}

export function replayRunView(command: {
  readonly run: TrackingReplayRunRow
  readonly target: TrackingReplayRunTargetRow | null
}): ReplayRunView {
  return {
    runId: command.run.id,
    mode: normalizeReplayMode(command.run.mode),
    status: normalizeReplayStatus(command.run.status),
    requestedBy: command.run.requested_by,
    reason: command.run.reason,
    createdAt: command.run.created_at,
    startedAt: command.run.started_at,
    finishedAt: command.run.finished_at,
    codeVersion: command.run.code_version,
    errorMessage: command.run.error_message,
    summary: toSummary(command.run.summary_json),
    target:
      command.target === null
        ? null
        : replayRunTargetRecordToDomainTarget(replayRunTargetRowToRecord(command.target)),
  }
}

export const replayObservationRowToDomain = observationRowToDomain
export const replayAlertRowToDomain = alertRowToDomain
