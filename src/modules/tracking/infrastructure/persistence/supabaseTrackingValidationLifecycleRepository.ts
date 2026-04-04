import type { TrackingValidationLifecycleRepository } from '~/modules/tracking/application/ports/tracking.validation-lifecycle.repository'
import type { TrackingValidationLifecycleTransition } from '~/modules/tracking/features/validation/domain/model/trackingValidationLifecycle'
import {
  requireTrackingValidationTransitionType,
  trackingValidationLifecycleRowToState,
  trackingValidationLifecycleTransitionToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.validation-lifecycle.persistence.mappers'
import { measureAuditedReadQuery } from '~/shared/observability/readRequestMetrics'
import { supabase } from '~/shared/supabase/supabase'
import { unwrapSupabaseResultOrThrow } from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'tracking_validation_issue_transitions' as const
const CONTAINERS_TABLE = 'containers' as const
const TRACKING_VALIDATION_LIFECYCLE_SELECT =
  'id,process_id,container_id,issue_code,detector_id,detector_version,affected_scope,severity,transition_type,lifecycle_key,state_fingerprint,evidence_summary,provider,snapshot_id,occurred_at,created_at'

function dedupeTransitions(
  transitions: readonly TrackingValidationLifecycleTransition[],
): readonly TrackingValidationLifecycleTransition[] {
  const seenKeys = new Set<string>()
  const deduped: TrackingValidationLifecycleTransition[] = []

  for (const transition of transitions) {
    const dedupeKey = [
      transition.containerId,
      transition.transitionType,
      transition.lifecycleKey,
      transition.stateFingerprint,
      transition.snapshotId,
    ].join('|')
    if (seenKeys.has(dedupeKey)) continue
    seenKeys.add(dedupeKey)
    deduped.push(transition)
  }

  return deduped
}

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

export const supabaseTrackingValidationLifecycleRepository: TrackingValidationLifecycleRepository =
  {
    async findActiveStatesByContainerId(containerId) {
      const result = await measureAuditedReadQuery({
        table: TABLE,
        operation: 'findActiveStatesByContainerId',
        query: () =>
          supabase
            .from(TABLE)
            .select(TRACKING_VALIDATION_LIFECYCLE_SELECT)
            .eq('container_id', containerId)
            .order('occurred_at', { ascending: false })
            .order('id', { ascending: false }),
        resultSelector: (queryResult) => queryResult.data ?? [],
      })

      const rows = unwrapSupabaseResultOrThrow(result, {
        operation: 'findActiveStatesByContainerId',
        table: TABLE,
      })
      const latestRowByLifecycleKey = new Map<string, (typeof rows)[number]>()

      for (const row of rows) {
        if (!latestRowByLifecycleKey.has(row.lifecycle_key)) {
          latestRowByLifecycleKey.set(row.lifecycle_key, row)
        }
      }

      const activeStates = [...latestRowByLifecycleKey.values()]
        .filter(
          (row) =>
            requireTrackingValidationTransitionType(
              row.transition_type,
              'tracking_validation.transition_type',
            ) !== 'resolved',
        )
        .map(trackingValidationLifecycleRowToState)
        .sort((left, right) => left.lifecycleKey.localeCompare(right.lifecycleKey))

      return activeStates
    },

    async insertMany(transitions) {
      const dedupedTransitions = dedupeTransitions(transitions)
      if (dedupedTransitions.length === 0) return

      const uniqueContainerIds = Array.from(
        new Set(dedupedTransitions.map((transition) => transition.containerId)),
      )
      const processIdByContainerId = await findProcessIdsByContainerIds(uniqueContainerIds)

      const rows = dedupedTransitions.map((transition) => {
        const processId = processIdByContainerId.get(transition.containerId)
        if (processId === undefined) {
          throw new Error(
            `tracking validation lifecycle insertMany: missing process id for container ${transition.containerId}`,
          )
        }

        return trackingValidationLifecycleTransitionToInsertRow({
          transition,
          processId,
        })
      })

      const result = await supabase.from(TABLE).insert(rows).select('id')
      unwrapSupabaseResultOrThrow(result, {
        operation: 'insertMany',
        table: TABLE,
      })
    },
  }
