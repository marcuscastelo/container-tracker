import { isKnownProvider, type Provider } from '~/modules/tracking/domain/model/provider'
import type { TrackingAlert } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type { Observation } from '~/modules/tracking/features/observation/domain/model/observation'
import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import type {
  ReplayActiveLock,
  ReplayLockAcquireResult,
  TrackingReplayLockRepository,
} from '~/modules/tracking/features/replay/application/ports/tracking-replay-lock.repository'
import type { ReplayDiffSummary } from '~/modules/tracking/features/replay/domain/replay-diff'
import { toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import {
  alertToInsertRow,
  observationToInsertRow,
  snapshotRowToDomain,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import {
  replayAlertRowToDomain,
  replayGenerationRowToDomain,
  replayLookupRowToDomain,
  replayObservationRowToDomain,
  replayRunRowToDomain,
  replayRunTargetRowToRecord,
  replayRunView,
} from '~/modules/tracking/infrastructure/persistence/tracking-replay.persistence.mappers'
import { InfrastructureError } from '~/shared/errors/httpErrors'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const CONTAINERS_TABLE = 'containers' as const
const PROCESS_TABLE = 'processes' as const
const SNAPSHOTS_TABLE = 'container_snapshots' as const
const OBSERVATIONS_TABLE = 'container_observations' as const
const ALERTS_TABLE = 'tracking_alerts' as const
const RUNS_TABLE = 'tracking_replay_runs' as const
const RUN_TARGETS_TABLE = 'tracking_replay_run_targets' as const
const GENERATIONS_TABLE = 'tracking_derivation_generations' as const
const POINTERS_TABLE = 'tracking_generation_pointers' as const
const LOCKS_TABLE = 'tracking_replay_locks' as const

const OBSERVATION_DOMAIN_SELECT =
  'id,fingerprint,container_id,container_number,type,temporal_kind,event_time_instant,event_date,event_time_local,event_time_zone,event_time,event_time_type,location_code,location_display,vessel_name,voyage,is_empty,confidence,provider,created_from_snapshot_id,carrier_label,raw_event_time,event_time_source,created_at,retroactive,derivation_generation_id'

const ALERT_DOMAIN_SELECT =
  'id,container_id,category,type,severity,message_key,message_params,created_at,detected_at,triggered_at,source_observation_fingerprints,alert_fingerprint,retroactive,provider,acked_at,acked_by,acked_source,resolved_at,resolved_reason,lifecycle_state,derivation_generation_id'

function throwWhenSupabaseError(command: {
  readonly result: { readonly error: { readonly message?: string } | null }
  readonly operation: string
  readonly table: string
}): void {
  if (command.result.error === null) {
    return
  }

  throw new InfrastructureError(
    `Database error on ${command.table} during ${command.operation}`,
    command.result.error,
  )
}

function toReplayDiffJson(diffSummary: ReplayDiffSummary) {
  return toJson({
    snapshotCount: diffSummary.snapshotCount,
    currentGenerationId: diffSummary.currentGenerationId,
    candidateGenerationId: diffSummary.candidateGenerationId,
    observationsCurrentCount: diffSummary.observationsCurrentCount,
    observationsCandidateCount: diffSummary.observationsCandidateCount,
    alertsCurrentCount: diffSummary.alertsCurrentCount,
    alertsCandidateCount: diffSummary.alertsCandidateCount,
    addedObservationFingerprints: diffSummary.addedObservationFingerprints,
    removedObservationFingerprints: diffSummary.removedObservationFingerprints,
    statusChanged: diffSummary.statusChanged,
    statusBefore: diffSummary.statusBefore,
    statusAfter: diffSummary.statusAfter,
    alertsChanged: diffSummary.alertsChanged,
    potentialTemporalConflicts: diffSummary.potentialTemporalConflicts,
  })
}

function toReplayObservationProvider(provider: Observation['provider']): Provider {
  if (isKnownProvider(provider)) {
    return provider
  }

  return 'msc'
}

function toReplayAlertProvider(provider: TrackingAlert['provider']): Provider | null {
  if (provider === null) {
    return null
  }

  if (isKnownProvider(provider)) {
    return provider
  }

  return null
}

function toReplayLockMode(mode: string): 'DRY_RUN' | 'APPLY' | 'ROLLBACK' {
  if (mode === 'APPLY' || mode === 'ROLLBACK') {
    return mode
  }

  return 'DRY_RUN'
}

async function findProcessReference(processId: string): Promise<string | null> {
  const processResult = await supabase
    .from(PROCESS_TABLE)
    .select('reference')
    .eq('id', processId)
    .maybeSingle()

  const processRow = unwrapSupabaseSingleOrNull(processResult, {
    operation: 'findProcessReference',
    table: PROCESS_TABLE,
  })

  return processRow?.reference ?? null
}

async function findSnapshotCount(containerId: string): Promise<number> {
  const countResult = await supabase
    .from(SNAPSHOTS_TABLE)
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('container_id', containerId)

  throwWhenSupabaseError({
    result: countResult,
    operation: 'findSnapshotCount',
    table: SNAPSHOTS_TABLE,
  })

  return countResult.count ?? 0
}

async function findGenerationPointers(containerId: string): Promise<{
  readonly activeGenerationId: string | null
  readonly previousGenerationId: string | null
}> {
  const pointerResult = await supabase
    .from(POINTERS_TABLE)
    .select('active_generation_id,previous_generation_id')
    .eq('container_id', containerId)
    .maybeSingle()

  const pointerRow = unwrapSupabaseSingleOrNull(pointerResult, {
    operation: 'findGenerationPointers',
    table: POINTERS_TABLE,
  })

  return {
    activeGenerationId: pointerRow?.active_generation_id ?? null,
    previousGenerationId: pointerRow?.previous_generation_id ?? null,
  }
}

async function findLastReplayRun(containerId: string): Promise<{
  readonly id: string
  readonly mode: string
  readonly status: string
  readonly created_at: string
} | null> {
  const result = await supabase
    .from(RUN_TARGETS_TABLE)
    .select('run_id, created_at')
    .eq('container_id', containerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = unwrapSupabaseSingleOrNull(result, {
    operation: 'findLastReplayRun.target',
    table: RUN_TARGETS_TABLE,
  })

  if (row === null) {
    return null
  }

  const runResult = await supabase
    .from(RUNS_TABLE)
    .select('id,mode,status,created_at')
    .eq('id', row.run_id)
    .maybeSingle()

  const runRow = unwrapSupabaseSingleOrNull(runResult, {
    operation: 'findLastReplayRun.run',
    table: RUNS_TABLE,
  })

  return runRow
}

async function buildLookupForContainer(command: {
  readonly containerRow: {
    readonly id: string
    readonly container_number: string
    readonly carrier_code: string
    readonly process_id: string
  }
}): Promise<ReturnType<typeof replayLookupRowToDomain>> {
  const processReference = await findProcessReference(command.containerRow.process_id)
  const snapshotCount = await findSnapshotCount(command.containerRow.id)
  const pointers = await findGenerationPointers(command.containerRow.id)
  const lastRun = await findLastReplayRun(command.containerRow.id)

  return replayLookupRowToDomain({
    container_id: command.containerRow.id,
    container_number: command.containerRow.container_number,
    provider: command.containerRow.carrier_code,
    process_id: command.containerRow.process_id,
    process_reference: processReference,
    snapshot_count: snapshotCount,
    active_generation_id: pointers.activeGenerationId,
    previous_generation_id: pointers.previousGenerationId,
    last_run_id: lastRun?.id ?? null,
    last_run_mode: lastRun?.mode ?? null,
    last_run_status: lastRun?.status ?? null,
    last_run_created_at: lastRun?.created_at ?? null,
  })
}

export const supabaseTrackingReplayAdminRepository: TrackingReplayAdminRepository = {
  async findTargetByContainerNumber(containerNumber) {
    const normalizedContainerNumber = containerNumber.trim().toUpperCase()
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('id,container_number,carrier_code,process_id')
      .eq('container_number', normalizedContainerNumber)
      .is('removed_at', null)
      .maybeSingle()

    const containerRow = unwrapSupabaseSingleOrNull(result, {
      operation: 'findTargetByContainerNumber',
      table: CONTAINERS_TABLE,
    })

    if (containerRow === null) {
      return null
    }

    return buildLookupForContainer({ containerRow })
  },

  async findTargetByContainerId(containerId) {
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('id,container_number,carrier_code,process_id')
      .eq('id', containerId)
      .is('removed_at', null)
      .maybeSingle()

    const containerRow = unwrapSupabaseSingleOrNull(result, {
      operation: 'findTargetByContainerId',
      table: CONTAINERS_TABLE,
    })

    if (containerRow === null) {
      return null
    }

    return buildLookupForContainer({ containerRow })
  },

  async listSnapshotsForReplay(containerId) {
    const result = await supabase
      .from(SNAPSHOTS_TABLE)
      .select('id,container_id,provider,fetched_at,payload,parse_error')
      .eq('container_id', containerId)
      .order('fetched_at', { ascending: true })
      .order('id', { ascending: true })

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'listSnapshotsForReplay',
      table: SNAPSHOTS_TABLE,
    })

    return rows.map(snapshotRowToDomain)
  },

  async createRun(command) {
    const insertResult = await supabase
      .from(RUNS_TABLE)
      .insert({
        mode: command.mode,
        status: command.status,
        requested_by: command.requestedBy,
        reason: command.reason,
        code_version: command.codeVersion,
        summary_json: toJson({}),
        started_at: new Date().toISOString(),
        finished_at: null,
        error_message: null,
      })
      .select('*')
      .single()

    const row = unwrapSupabaseResultOrThrow(insertResult, {
      operation: 'createRun',
      table: RUNS_TABLE,
    })

    return replayRunRowToDomain(row)
  },

  async updateRun(command) {
    const updateResult = await supabase
      .from(RUNS_TABLE)
      .update({
        status: command.status,
        error_message: command.errorMessage,
        summary_json: toJson(command.summary),
        finished_at: command.finishedAt,
      })
      .eq('id', command.runId)

    throwWhenSupabaseError({
      result: updateResult,
      operation: 'updateRun',
      table: RUNS_TABLE,
    })
  },

  async createRunTarget(command) {
    const insertResult = await supabase
      .from(RUN_TARGETS_TABLE)
      .insert({
        run_id: command.runId,
        container_id: command.containerId,
        container_number: command.containerNumber,
        provider: command.provider,
        snapshot_count: command.snapshotCount,
        status: command.status,
        error_message: null,
        diff_summary_json: toReplayDiffJson({
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
        }),
      })
      .select('*')
      .single()

    const row = unwrapSupabaseResultOrThrow(insertResult, {
      operation: 'createRunTarget',
      table: RUN_TARGETS_TABLE,
    })

    return replayRunTargetRowToRecord(row)
  },

  async updateRunTarget(command) {
    const payload: Record<string, unknown> = {
      status: command.status,
      error_message: command.errorMessage,
    }

    if (command.diffSummary !== undefined) {
      payload.diff_summary_json = toReplayDiffJson(command.diffSummary)
    }
    if (command.createdGenerationId !== undefined) {
      payload.created_generation_id = command.createdGenerationId
    }
    if (command.lockHeartbeatAt !== undefined) {
      payload.lock_heartbeat_at = command.lockHeartbeatAt
    }
    if (command.lockExpiresAt !== undefined) {
      payload.lock_expires_at = command.lockExpiresAt
    }

    const updateResult = await supabase
      .from(RUN_TARGETS_TABLE)
      .update(payload)
      .eq('id', command.runTargetId)

    throwWhenSupabaseError({
      result: updateResult,
      operation: 'updateRunTarget',
      table: RUN_TARGETS_TABLE,
    })
  },

  async findGenerationPointer(containerId) {
    const result = await supabase
      .from(POINTERS_TABLE)
      .select('container_id,active_generation_id,previous_generation_id')
      .eq('container_id', containerId)
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'findGenerationPointer',
      table: POINTERS_TABLE,
    })

    if (row === null) {
      return null
    }

    return {
      containerId: row.container_id,
      activeGenerationId: row.active_generation_id,
      previousGenerationId: row.previous_generation_id,
    }
  },

  async createGeneration(command) {
    const insertResult = await supabase
      .from(GENERATIONS_TABLE)
      .insert({
        container_id: command.containerId,
        source_kind: command.sourceKind,
        source_run_id: command.sourceRunId,
        metadata_json: toJson(command.metadata),
      })
      .select('*')
      .single()

    const row = unwrapSupabaseResultOrThrow(insertResult, {
      operation: 'createGeneration',
      table: GENERATIONS_TABLE,
    })

    return replayGenerationRowToDomain(row)
  },

  async persistGenerationDerivations(command) {
    const observationRows = command.observations.map((observation) => {
      const row = observationToInsertRow({
        fingerprint: observation.fingerprint,
        container_id: observation.container_id,
        container_number: observation.container_number,
        type: observation.type,
        event_time: observation.event_time,
        event_time_type: observation.event_time_type,
        location_code: observation.location_code,
        location_display: observation.location_display,
        vessel_name: observation.vessel_name,
        voyage: observation.voyage,
        is_empty: observation.is_empty,
        confidence: observation.confidence,
        provider: toReplayObservationProvider(observation.provider),
        created_from_snapshot_id: observation.created_from_snapshot_id,
        carrier_label: observation.carrier_label ?? null,
        raw_event_time: observation.raw_event_time ?? null,
        event_time_source: observation.event_time_source ?? null,
        retroactive: observation.retroactive ?? false,
      })

      return {
        ...row,
        derivation_generation_id: command.generationId,
        created_at: observation.created_at,
      }
    })

    if (observationRows.length > 0) {
      const insertObservationResult = await supabase
        .from(OBSERVATIONS_TABLE)
        .insert(observationRows)
      throwWhenSupabaseError({
        result: insertObservationResult,
        operation: 'persistGenerationDerivations.observations',
        table: OBSERVATIONS_TABLE,
      })
    }

    const alertRows = command.alerts.map((alert) => {
      const row = alertToInsertRow({
        ...alert,
        source_observation_fingerprints: [...alert.source_observation_fingerprints],
        provider: toReplayAlertProvider(alert.provider),
        resolved_at: alert.resolved_at ?? null,
        resolved_reason: alert.resolved_reason ?? null,
      })

      return {
        ...row,
        derivation_generation_id: command.generationId,
      }
    })

    if (alertRows.length > 0) {
      const insertAlertResult = await supabase.from(ALERTS_TABLE).insert(alertRows)
      throwWhenSupabaseError({
        result: insertAlertResult,
        operation: 'persistGenerationDerivations.alerts',
        table: ALERTS_TABLE,
      })
    }
  },

  async listObservationsByGeneration(command) {
    const result = await supabase
      .from(OBSERVATIONS_TABLE)
      .select(OBSERVATION_DOMAIN_SELECT)
      .eq('container_id', command.containerId)
      .eq('derivation_generation_id', command.generationId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'listObservationsByGeneration',
      table: OBSERVATIONS_TABLE,
    })

    return rows.map(replayObservationRowToDomain)
  },

  async listAlertsByGeneration(command) {
    const result = await supabase
      .from(ALERTS_TABLE)
      .select(ALERT_DOMAIN_SELECT)
      .eq('container_id', command.containerId)
      .eq('derivation_generation_id', command.generationId)
      .order('triggered_at', { ascending: false })
      .order('id', { ascending: false })

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'listAlertsByGeneration',
      table: ALERTS_TABLE,
    })

    return rows.map(replayAlertRowToDomain)
  },

  async activateGenerationPointer(command) {
    const currentPointer = await findGenerationPointers(command.containerId)

    if (currentPointer.activeGenerationId === null) {
      const insertResult = await supabase
        .from(POINTERS_TABLE)
        .insert({
          container_id: command.containerId,
          active_generation_id: command.nextActiveGenerationId,
          previous_generation_id: null,
          updated_by_run_id: command.runId,
        })
        .select('container_id,active_generation_id,previous_generation_id')
        .single()

      const inserted = unwrapSupabaseResultOrThrow(insertResult, {
        operation: 'activateGenerationPointer.insert',
        table: POINTERS_TABLE,
      })

      await supabase
        .from(GENERATIONS_TABLE)
        .update({
          activated_at: command.activatedAt,
          superseded_at: null,
        })
        .eq('id', command.nextActiveGenerationId)

      return {
        containerId: inserted.container_id,
        activeGenerationId: inserted.active_generation_id,
        previousGenerationId: inserted.previous_generation_id,
      }
    }

    const updateResult = await supabase
      .from(POINTERS_TABLE)
      .update({
        active_generation_id: command.nextActiveGenerationId,
        previous_generation_id: currentPointer.activeGenerationId,
        updated_by_run_id: command.runId,
      })
      .eq('container_id', command.containerId)
      .select('container_id,active_generation_id,previous_generation_id')
      .single()

    const updated = unwrapSupabaseResultOrThrow(updateResult, {
      operation: 'activateGenerationPointer.update',
      table: POINTERS_TABLE,
    })

    const generationUpdateResult = await supabase
      .from(GENERATIONS_TABLE)
      .update({ superseded_at: command.activatedAt })
      .eq('id', currentPointer.activeGenerationId)

    throwWhenSupabaseError({
      result: generationUpdateResult,
      operation: 'activateGenerationPointer.supersedeOld',
      table: GENERATIONS_TABLE,
    })

    const activateGenerationResult = await supabase
      .from(GENERATIONS_TABLE)
      .update({
        activated_at: command.activatedAt,
        superseded_at: null,
      })
      .eq('id', command.nextActiveGenerationId)

    throwWhenSupabaseError({
      result: activateGenerationResult,
      operation: 'activateGenerationPointer.activateNew',
      table: GENERATIONS_TABLE,
    })

    return {
      containerId: updated.container_id,
      activeGenerationId: updated.active_generation_id,
      previousGenerationId: updated.previous_generation_id,
    }
  },

  async rollbackGenerationPointer(command) {
    const pointerResult = await supabase
      .from(POINTERS_TABLE)
      .select('container_id,active_generation_id,previous_generation_id')
      .eq('container_id', command.containerId)
      .maybeSingle()

    const pointer = unwrapSupabaseSingleOrNull(pointerResult, {
      operation: 'rollbackGenerationPointer.findPointer',
      table: POINTERS_TABLE,
    })

    if (
      pointer === null ||
      pointer.previous_generation_id === null ||
      pointer.active_generation_id === null
    ) {
      return null
    }

    const updateResult = await supabase
      .from(POINTERS_TABLE)
      .update({
        active_generation_id: pointer.previous_generation_id,
        previous_generation_id: pointer.active_generation_id,
        updated_by_run_id: command.runId,
      })
      .eq('container_id', command.containerId)
      .select('container_id,active_generation_id,previous_generation_id')
      .single()

    const updated = unwrapSupabaseResultOrThrow(updateResult, {
      operation: 'rollbackGenerationPointer.updatePointer',
      table: POINTERS_TABLE,
    })

    const activateResult = await supabase
      .from(GENERATIONS_TABLE)
      .update({
        activated_at: command.rolledBackAt,
        superseded_at: null,
      })
      .eq('id', pointer.previous_generation_id)

    throwWhenSupabaseError({
      result: activateResult,
      operation: 'rollbackGenerationPointer.activatePrevious',
      table: GENERATIONS_TABLE,
    })

    const supersedeResult = await supabase
      .from(GENERATIONS_TABLE)
      .update({
        superseded_at: command.rolledBackAt,
      })
      .eq('id', pointer.active_generation_id)

    throwWhenSupabaseError({
      result: supersedeResult,
      operation: 'rollbackGenerationPointer.supersedeCurrent',
      table: GENERATIONS_TABLE,
    })

    return {
      containerId: updated.container_id,
      activeGenerationId: updated.active_generation_id,
      previousGenerationId: updated.previous_generation_id,
    }
  },

  async getRun(runId) {
    const runResult = await supabase.from(RUNS_TABLE).select('*').eq('id', runId).maybeSingle()
    const runRow = unwrapSupabaseSingleOrNull(runResult, {
      operation: 'getRun.run',
      table: RUNS_TABLE,
    })

    if (runRow === null) {
      return null
    }

    const runTargetResult = await supabase
      .from(RUN_TARGETS_TABLE)
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const runTargetRow = unwrapSupabaseSingleOrNull(runTargetResult, {
      operation: 'getRun.target',
      table: RUN_TARGETS_TABLE,
    })

    return replayRunView({
      run: runRow,
      target: runTargetRow,
    })
  },
}

export const supabaseTrackingReplayLockRepository: TrackingReplayLockRepository = {
  async acquire(command): Promise<ReplayLockAcquireResult> {
    const result = await supabase.rpc('acquire_tracking_replay_lock', {
      p_container_id: command.containerId,
      p_run_id: command.runId,
      p_run_target_id: command.runTargetId,
      p_mode: command.mode,
      p_owner_token: command.ownerToken,
      p_ttl_seconds: command.ttlSeconds,
    })

    const rows = unwrapSupabaseResultOrThrow(result, {
      operation: 'acquire_tracking_replay_lock',
      table: LOCKS_TABLE,
    })

    const row = rows[0]
    if (!row) {
      return {
        acquired: false,
        lockOwnerRunTargetId: null,
        expiresAt: null,
      }
    }

    return {
      acquired: row.acquired,
      lockOwnerRunTargetId: row.lock_owner_run_target_id,
      expiresAt: row.expires_at,
    }
  },

  async heartbeat(command): Promise<boolean> {
    const result = await supabase.rpc('heartbeat_tracking_replay_lock', {
      p_container_id: command.containerId,
      p_run_target_id: command.runTargetId,
      p_owner_token: command.ownerToken,
      p_ttl_seconds: command.ttlSeconds,
    })

    const value = unwrapSupabaseResultOrThrow(result, {
      operation: 'heartbeat_tracking_replay_lock',
      table: LOCKS_TABLE,
    })

    return value === true
  },

  async release(command): Promise<boolean> {
    const result = await supabase.rpc('release_tracking_replay_lock', {
      p_container_id: command.containerId,
      p_run_target_id: command.runTargetId,
      p_owner_token: command.ownerToken,
    })

    const value = unwrapSupabaseResultOrThrow(result, {
      operation: 'release_tracking_replay_lock',
      table: LOCKS_TABLE,
    })

    return value === true
  },

  async findActiveLockByContainerId(containerId): Promise<ReplayActiveLock | null> {
    const result = await supabase
      .from(LOCKS_TABLE)
      .select(
        'container_id,run_id,run_target_id,owner_token,mode,acquired_at,heartbeat_at,expires_at',
      )
      .eq('container_id', containerId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    const row = unwrapSupabaseSingleOrNull(result, {
      operation: 'findActiveLockByContainerId',
      table: LOCKS_TABLE,
    })

    if (row === null) {
      return null
    }

    return {
      containerId: row.container_id,
      runId: row.run_id,
      runTargetId: row.run_target_id,
      ownerToken: row.owner_token,
      mode: toReplayLockMode(row.mode),
      acquiredAt: row.acquired_at,
      heartbeatAt: row.heartbeat_at,
      expiresAt: row.expires_at,
    }
  },

  async hasActiveLockForContainerNumber(containerNumber): Promise<boolean> {
    const result = await supabase.rpc('has_active_tracking_replay_lock_for_container_number', {
      p_container_number: containerNumber,
    })

    const value = unwrapSupabaseResultOrThrow(result, {
      operation: 'has_active_tracking_replay_lock_for_container_number',
      table: LOCKS_TABLE,
    })

    return value === true
  },
}
