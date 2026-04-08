import type { TrackingContainmentRepository } from '~/modules/tracking/application/ports/tracking.containment.repository'
import {
  type ActivateTrackingContainmentCommand,
  isTrackingContainmentIssueCode,
  TRACKING_CONTAINMENT_ISSUE_CODES,
  TRACKING_CONTAINMENT_REASON_CODE,
  type TrackingContainmentState,
} from '~/modules/tracking/features/containment/domain/model/trackingContainment'
import { readProvider } from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mapper-primitives'
import type { TrackingValidationLifecycleRow } from '~/modules/tracking/infrastructure/persistence/tracking.row'
import { requireTrackingValidationTransitionType } from '~/modules/tracking/infrastructure/persistence/tracking.validation-lifecycle.persistence.mappers'
import { measureAuditedReadQuery } from '~/shared/observability/readRequestMetrics'
import { supabase } from '~/shared/supabase/supabase'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'tracking_validation_issue_transitions' as const
const CONTAINERS_TABLE = 'containers' as const
const SELECT_FIELDS =
  'id,process_id,container_id,issue_code,detector_id,detector_version,affected_scope,severity,transition_type,lifecycle_key,state_fingerprint,evidence_summary,provider,snapshot_id,occurred_at,created_at'

async function findProcessIdsByContainerIds(
  containerIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (containerIds.length === 0) return new Map()

  const result = await supabase
    .from(CONTAINERS_TABLE)
    .select('id, process_id')
    .in('id', [...containerIds])
  const rows = unwrapSupabaseResultOrThrow(result, {
    operation: 'findProcessIdsByContainerIds',
    table: CONTAINERS_TABLE,
  })

  const processIdByContainerId = new Map<string, string>()
  for (const row of rows) {
    processIdByContainerId.set(row.id, row.process_id)
  }

  return processIdByContainerId
}

function toTrackingContainmentState(row: TrackingValidationLifecycleRow): TrackingContainmentState {
  return {
    active: true,
    reasonCode: TRACKING_CONTAINMENT_REASON_CODE,
    activatedAt: row.occurred_at,
    provider: readProvider(row.provider, 'tracking_containment.provider'),
    snapshotId: row.snapshot_id,
    lifecycleKey: row.lifecycle_key,
    stateFingerprint: row.state_fingerprint,
    evidenceSummary: row.evidence_summary,
  }
}

function dedupeActiveContainmentRows(
  rows: readonly TrackingValidationLifecycleRow[],
): ReadonlyMap<string, TrackingContainmentState> {
  const latestRowByLifecycleKey = new Map<string, TrackingValidationLifecycleRow>()

  for (const row of rows) {
    const issueCode = row.issue_code
    if (!isTrackingContainmentIssueCode(issueCode)) {
      continue
    }

    const lifecycleMapKey = `${row.container_id}:${row.lifecycle_key}`
    if (!latestRowByLifecycleKey.has(lifecycleMapKey)) {
      latestRowByLifecycleKey.set(lifecycleMapKey, row)
    }
  }

  const activeByContainerId = new Map<string, TrackingContainmentState>()
  for (const row of latestRowByLifecycleKey.values()) {
    if (
      requireTrackingValidationTransitionType(
        row.transition_type,
        'tracking_containment.transition_type',
      ) === 'resolved'
    ) {
      continue
    }

    if (!activeByContainerId.has(row.container_id)) {
      activeByContainerId.set(row.container_id, toTrackingContainmentState(row))
    }
  }

  return activeByContainerId
}

async function findActiveContainmentByContainerIds(
  containerIds: readonly string[],
): Promise<ReadonlyMap<string, TrackingContainmentState>> {
  if (containerIds.length === 0) return new Map()

  const result = await measureAuditedReadQuery({
    table: TABLE,
    operation: 'findActiveContainmentByContainerIds',
    query: () =>
      supabase
        .from(TABLE)
        .select(SELECT_FIELDS)
        .in('container_id', [...containerIds])
        .in('issue_code', [...TRACKING_CONTAINMENT_ISSUE_CODES])
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
    resultSelector: (queryResult) => queryResult.data ?? [],
  })

  const rows = unwrapSupabaseResultOrThrow(result, {
    operation: 'findActiveContainmentByContainerIds',
    table: TABLE,
  })

  return dedupeActiveContainmentRows(rows)
}

export const supabaseTrackingContainmentRepository: TrackingContainmentRepository = {
  async findActiveByContainerId(containerId) {
    const statesByContainerId = await findActiveContainmentByContainerIds([containerId])
    return statesByContainerId.get(containerId) ?? null
  },

  async findActiveByContainerIds(containerIds) {
    return findActiveContainmentByContainerIds(containerIds)
  },

  async activate(command: ActivateTrackingContainmentCommand) {
    const processIdByContainerId = await findProcessIdsByContainerIds([command.containerId])
    const processId = processIdByContainerId.get(command.containerId)
    if (processId === undefined) {
      throw new Error(
        `tracking containment activate: missing process id for container ${command.containerId}`,
      )
    }

    const row = {
      process_id: processId,
      container_id: command.containerId,
      issue_code: TRACKING_CONTAINMENT_REASON_CODE,
      detector_id: TRACKING_CONTAINMENT_REASON_CODE,
      detector_version: '1',
      affected_scope: 'TIMELINE',
      severity: 'CRITICAL',
      transition_type: 'activated',
      lifecycle_key: `${TRACKING_CONTAINMENT_REASON_CODE}:${command.containerId}`,
      state_fingerprint: command.stateFingerprint,
      evidence_summary: command.evidenceSummary,
      provider: command.provider,
      snapshot_id: command.snapshotId,
      occurred_at: command.activatedAt,
    }

    const result = await supabase
      .from(TABLE)
      .upsert([row], {
        onConflict: 'container_id,lifecycle_key,transition_type,state_fingerprint,snapshot_id',
        ignoreDuplicates: true,
      })
      .select('id')
    unwrapSupabaseResultOrThrow(result, {
      operation: 'activate',
      table: TABLE,
    })
  },
}
