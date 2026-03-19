import type { SupportedSyncProvider } from '~/capabilities/sync/application/ports/sync-queue.port'
import { bootstrapSyncControllers } from '~/capabilities/sync/interface/http/sync.controllers.bootstrap'
import { containerUseCases } from '~/modules/container/infrastructure/bootstrap/container.bootstrap'
import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import {
  createRefreshProcessDeps,
  createSyncQueuePort,
  createSyncStatusReadPort,
  createSyncTargetReadPort,
  resolveDefaultTenantId,
} from '~/shared/api/sync.bootstrap/sync.bootstrap.ports'
import type { Database } from '~/shared/supabase/database.types'
import { supabaseServer } from '~/shared/supabase/supabase.server'
import { unwrapSupabaseSingleOrNull } from '~/shared/supabase/unwrapSupabaseResult'

const defaultTenantId = resolveDefaultTenantId()

const targetReadPort = createSyncTargetReadPort({
  processUseCases,
  containerUseCases,
})

const queuePort = createSyncQueuePort({
  defaultTenantId,
})

const statusReadPort = createSyncStatusReadPort({
  targetReadPort,
  defaultTenantId,
})

const refreshProcessDeps = createRefreshProcessDeps({
  targetReadPort,
  queuePort,
  defaultTenantId,
})

type CarrierDetectionRunRow = Database['public']['Tables']['carrier_detection_runs']['Row']

type EffectiveCarrierSummary = 'UNKNOWN' | 'SINGLE' | 'MIXED'

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function toCarrierSummary(carrierCodes: readonly (string | null)[]): EffectiveCarrierSummary {
  const normalized = Array.from(
    new Set(
      carrierCodes
        .map((code) => (code ?? '').trim().toLowerCase())
        .filter((code) => code.length > 0 && code !== 'unknown'),
    ),
  )

  if (normalized.length === 0) return 'UNKNOWN'
  if (normalized.length === 1) return 'SINGLE'
  return 'MIXED'
}

function uniqueProviders(providers: readonly SupportedSyncProvider[]): readonly SupportedSyncProvider[] {
  return [...new Set(providers)]
}

async function getOrCreateRunningDetectionRun(command: {
  readonly processId: string
  readonly containerId: string
  readonly candidateProviders: readonly SupportedSyncProvider[]
}): Promise<CarrierDetectionRunRow> {
  const insertResult = await supabaseServer
    .from('carrier_detection_runs')
    .insert({
      process_id: command.processId,
      container_id: command.containerId,
      status: 'RUNNING',
      candidate_providers: [...command.candidateProviders],
      attempted_providers: [],
    })
    .select('*')
    .single()

  if (insertResult.error && insertResult.error.code !== '23505') {
    throw new Error(
      `create_carrier_detection_run_failed:${insertResult.error.code ?? 'unknown'}:${insertResult.error.message ?? 'unknown_error'}`,
    )
  }

  const inserted = insertResult.data ?? null

  if (inserted) {
    return inserted
  }

  const runningResult = await supabaseServer
    .from('carrier_detection_runs')
    .select('*')
    .eq('process_id', command.processId)
    .eq('container_id', command.containerId)
    .eq('status', 'RUNNING')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const running = unwrapSupabaseSingleOrNull(runningResult, {
    operation: 'find_running_carrier_detection_run',
    table: 'carrier_detection_runs',
  })

  if (running) {
    return running
  }

  throw new Error(
    `carrier_detection_run_not_available:${command.processId}:${command.containerId}`,
  )
}

async function resolveContainerIdForDetectionRun(command: {
  readonly processId: string
  readonly containerNumber: string
  readonly providedContainerId?: string
}): Promise<string> {
  if (command.providedContainerId && command.providedContainerId.trim().length > 0) {
    return command.providedContainerId
  }

  const result = await containerUseCases.findByNumbers({
    containerNumbers: [normalizeContainerNumber(command.containerNumber)],
  })
  const matching = result.containers.filter(
    (container) => String(container.processId) === command.processId,
  )

  const first = matching[0]
  if (!first) {
    throw new Error(
      `carrier_detection_container_not_found:${command.processId}:${normalizeContainerNumber(command.containerNumber)}`,
    )
  }

  return String(first.id)
}

async function appendDetectionAttempts(command: {
  readonly runId: string
  readonly attempts: readonly {
    readonly provider: SupportedSyncProvider
    readonly status: 'FOUND' | 'NOT_FOUND' | 'ERROR' | 'SKIPPED'
    readonly errorCode: string | null
    readonly rawResultRef: string | null
  }[]
}): Promise<void> {
  if (command.attempts.length === 0) return

  const rows: Database['public']['Tables']['carrier_detection_attempts']['Insert'][] =
    command.attempts.map((attempt) => ({
      run_id: command.runId,
      provider: attempt.provider,
      status: attempt.status,
      error_code: attempt.errorCode,
      raw_result_ref: attempt.rawResultRef,
      attempted_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    }))

  const insertResult = await supabaseServer.from('carrier_detection_attempts').insert(rows)
  unwrapSupabaseSingleOrNull(insertResult, {
    operation: 'insert_carrier_detection_attempts',
    table: 'carrier_detection_attempts',
  })

  const attemptedProviders = uniqueProviders(command.attempts.map((attempt) => attempt.provider))

  const updateResult = await supabaseServer
    .from('carrier_detection_runs')
    .update({
      attempted_providers: [...attemptedProviders],
    })
    .eq('id', command.runId)
    .eq('status', 'RUNNING')

  unwrapSupabaseSingleOrNull(updateResult, {
    operation: 'update_carrier_detection_run_attempted_providers',
    table: 'carrier_detection_runs',
  })
}

async function resolveDetectionRun(command: {
  readonly runId: string
  readonly status: 'RESOLVED' | 'FAILED' | 'RATE_LIMITED'
  readonly resolvedProvider: SupportedSyncProvider | null
  readonly confidence: 'HIGH' | 'LOW' | 'UNKNOWN'
  readonly errorCode: string | null
}): Promise<boolean> {
  const result = await supabaseServer
    .from('carrier_detection_runs')
    .update({
      status: command.status,
      resolved_provider: command.resolvedProvider,
      confidence: command.confidence,
      error_code: command.errorCode,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', command.runId)
    .eq('status', 'RUNNING')
    .select('id')
    .maybeSingle()

  const row = unwrapSupabaseSingleOrNull(result, {
    operation: 'resolve_carrier_detection_run',
    table: 'carrier_detection_runs',
  })

  return row !== null
}

const carrierDetectionWritePort = {
  async recordDetectionRun(command: {
    readonly processId: string
    readonly containerNumber: string
    readonly containerId?: string
    readonly candidateProviders: readonly SupportedSyncProvider[]
    readonly attempts: readonly {
      readonly provider: SupportedSyncProvider
      readonly status: 'FOUND' | 'NOT_FOUND' | 'ERROR' | 'SKIPPED'
      readonly errorCode: string | null
      readonly rawResultRef: string | null
    }[]
    readonly status: 'RESOLVED' | 'FAILED' | 'RATE_LIMITED'
    readonly resolvedProvider: SupportedSyncProvider | null
    readonly confidence: 'HIGH' | 'LOW' | 'UNKNOWN'
    readonly errorCode: string | null
  }) {
    const containerId = await resolveContainerIdForDetectionRun({
      processId: command.processId,
      containerNumber: command.containerNumber,
      providedContainerId: command.containerId,
    })

    const run = await getOrCreateRunningDetectionRun({
      processId: command.processId,
      containerId,
      candidateProviders: command.candidateProviders,
    })

    await appendDetectionAttempts({
      runId: run.id,
      attempts: command.attempts,
    })

    const won = await resolveDetectionRun({
      runId: run.id,
      status: command.status,
      resolvedProvider: command.resolvedProvider,
      confidence: command.confidence,
      errorCode: command.errorCode,
    })

    return {
      runId: run.id,
      won,
    }
  },

  async persistDetectedCarrier(command: {
    readonly processId: string | null
    readonly runId: string
    readonly containerNumber: string
    readonly carrierCode: string
    readonly confidence: 'HIGH' | 'LOW' | 'UNKNOWN'
    readonly detectionSource: 'auto-detect'
  }) {
    const runResult = await supabaseServer
      .from('carrier_detection_runs')
      .select('*')
      .eq('id', command.runId)
      .limit(1)
      .maybeSingle()

    const run = unwrapSupabaseSingleOrNull(runResult, {
      operation: 'fetch_carrier_detection_run_for_persist',
      table: 'carrier_detection_runs',
    })

    if (!run || run.status !== 'RESOLVED') {
      return
    }

    if (run.resolved_provider !== command.carrierCode) {
      return
    }

    const normalizedContainerNumber = normalizeContainerNumber(command.containerNumber)
    const containersResult = await containerUseCases.findByNumbers({
      containerNumbers: [normalizedContainerNumber],
    })

    const matchingContainers = containersResult.containers.filter((container) => {
      if (command.processId === null) {
        return true
      }
      return String(container.processId) === command.processId
    })

    if (command.processId === null && matchingContainers.length > 1) {
      throw new Error(
        `multiple_processes_found_for_container:${normalizedContainerNumber}:process_id_required`,
      )
    }

    const nowIso = new Date().toISOString()

    for (const container of matchingContainers) {
      if (container.carrierAssignmentMode === 'MANUAL') {
        continue
      }

      await containerUseCases.updateCarrier({
        containerId: String(container.id),
        carrierCode: command.carrierCode,
        carrierAssignmentMode: 'AUTO',
        carrierDetectedAt: nowIso,
        carrierDetectionSource: command.detectionSource,
      })
    }

    if (!command.processId) {
      return
    }

    const processResult = await processUseCases.findProcessById({
      processId: command.processId,
    })

    if (!processResult.process) {
      return
    }

    const process = processResult.process

    const processContainersBeforeSeed = await containerUseCases.listByProcessId({
      processId: command.processId,
    })

    const summaryBeforeSeed = toCarrierSummary(
      processContainersBeforeSeed.containers.map((container) => container.carrierCode),
    )

    const shouldPromoteProcess =
      process.carrierMode === 'AUTO' &&
      command.confidence === 'HIGH' &&
      summaryBeforeSeed !== 'MIXED'

    if (shouldPromoteProcess) {
      await processUseCases.updateProcess({
        processId: command.processId,
        record: {
          carrier_mode: 'AUTO',
          default_carrier_code: command.carrierCode,
          last_resolved_carrier_code: command.carrierCode,
          carrier_resolved_at: nowIso,
          carrier: command.carrierCode,
        },
      })
    }

    const shouldSeedPendingAutoContainers =
      shouldPromoteProcess && summaryBeforeSeed === 'SINGLE'

    if (!shouldSeedPendingAutoContainers) {
      return
    }

    const processContainersAfterUpdate = await containerUseCases.listByProcessId({
      processId: command.processId,
    })

    for (const container of processContainersAfterUpdate.containers) {
      if (container.carrierAssignmentMode !== 'AUTO') continue
      if (container.carrierCode) continue

      await containerUseCases.updateCarrier({
        containerId: String(container.id),
        carrierCode: command.carrierCode,
        carrierAssignmentMode: 'AUTO',
        carrierDetectedAt: nowIso,
        carrierDetectionSource: command.detectionSource,
      })
    }
  },
}

const bootstrappedSyncControllers = bootstrapSyncControllers({
  targetReadPort,
  queuePort,
  statusReadPort,
  refreshProcessDeps,
  carrierDetectionWritePort,
  defaultTenantId,
})

export const syncControllers = bootstrappedSyncControllers.syncControllers
export const syncStatusControllers = bootstrappedSyncControllers.syncStatusControllers
