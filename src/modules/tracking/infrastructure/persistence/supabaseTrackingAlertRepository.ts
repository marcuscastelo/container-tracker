import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { resolveAlertLifecycleState } from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import {
  toNoMovementDedupKeysFromAlert,
  toNoMovementDedupKeysFromRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.alert-no-movement.dedup'
import {
  alertRowToDerivationState,
  alertRowToDomain,
  alertToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import { measureAuditedReadQuery } from '~/shared/observability/readRequestMetrics'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'tracking_alerts' as const
const CONTAINERS_TABLE = 'containers' as const
const TRACKING_ALERT_DOMAIN_SELECT =
  'id,container_id,category,type,severity,message_key,message_params,created_at,detected_at,triggered_at,source_observation_fingerprints,alert_fingerprint,retroactive,provider,acked_at,acked_by,acked_source,resolved_at,resolved_reason,lifecycle_state'

// NOTE: enum validation and normalization for alert rows is implemented in
// `alertRowToDomain` (tracking.persistence.mappers). We prefer reusing that
// centralized mapper to avoid duplication of enum logic here.

export const supabaseTrackingAlertRepository: TrackingAlertRepository = {
  async insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    if (alerts.length === 0) return []

    // Deduplicate inside the same batch before hitting the DB.
    const seenFingerprintKeysInBatch = new Set<string>()
    const seenNoMovementKeysInBatch = new Set<string>()
    const dedupedAlerts: NewTrackingAlert[] = []
    for (const alert of alerts) {
      const fingerprint = alert.alert_fingerprint
      if (fingerprint !== null) {
        const fingerprintKey = `${alert.container_id}|${fingerprint}`
        if (seenFingerprintKeysInBatch.has(fingerprintKey)) continue
        seenFingerprintKeysInBatch.add(fingerprintKey)
      }

      const noMovementKeys = toNoMovementDedupKeysFromAlert(alert)
      if (noMovementKeys.length > 0) {
        const alreadySeen = noMovementKeys.some((key) => seenNoMovementKeysInBatch.has(key))
        if (alreadySeen) continue
        for (const key of noMovementKeys) {
          seenNoMovementKeysInBatch.add(key)
        }
      }

      dedupedAlerts.push(alert)
    }

    if (dedupedAlerts.length === 0) return []

    const containerIds = Array.from(new Set(dedupedAlerts.map((alert) => alert.container_id)))
    const incomingFingerprintKeys = new Set<string>()
    const incomingNoMovementKeys = new Set<string>()

    for (const alert of dedupedAlerts) {
      if (alert.alert_fingerprint !== null) {
        incomingFingerprintKeys.add(`${alert.container_id}|${alert.alert_fingerprint}`)
      }
      const noMovementKeys = toNoMovementDedupKeysFromAlert(alert)
      for (const key of noMovementKeys) {
        incomingNoMovementKeys.add(key)
      }
    }

    const existingFingerprintKeys = new Set<string>()
    const factFingerprints = Array.from(
      new Set(
        dedupedAlerts
          .filter((alert) => alert.category !== 'monitoring')
          .map((alert) => alert.alert_fingerprint)
          .filter((fingerprint): fingerprint is string => fingerprint !== null),
      ),
    )
    if (containerIds.length > 0 && factFingerprints.length > 0) {
      const existingFingerprintRowsResult = await measureAuditedReadQuery({
        table: TABLE,
        operation: 'insertMany.findExistingFingerprints',
        query: () =>
          supabase
            .from(TABLE)
            .select('container_id, alert_fingerprint')
            .in('container_id', containerIds)
            .in('alert_fingerprint', factFingerprints),
        resultSelector: (queryResult) => queryResult.data ?? [],
      })

      const existingFingerprintRows =
        unwrapSupabaseResultOrThrow(existingFingerprintRowsResult, {
          operation: 'insertMany.findExistingFingerprints',
          table: TABLE,
        }) ?? []

      for (const row of existingFingerprintRows) {
        if (row.alert_fingerprint === null) continue
        existingFingerprintKeys.add(`${row.container_id}|${row.alert_fingerprint}`)
      }
    }

    const existingNoMovementKeys = new Set<string>()
    if (containerIds.length > 0 && incomingNoMovementKeys.size > 0) {
      const existingNoMovementRowsResult = await measureAuditedReadQuery({
        table: TABLE,
        operation: 'insertMany.findExistingNoMovement',
        query: () =>
          supabase
            .from(TABLE)
            .select(
              'container_id, category, type, message_key, message_params, source_observation_fingerprints',
            )
            .in('container_id', containerIds)
            .eq('category', 'monitoring')
            .eq('type', 'NO_MOVEMENT')
            .eq('message_key', 'alerts.noMovementDetected')
            .eq('lifecycle_state', 'ACTIVE'),
        resultSelector: (queryResult) => queryResult.data ?? [],
      })

      const existingNoMovementRows =
        unwrapSupabaseResultOrThrow(existingNoMovementRowsResult, {
          operation: 'insertMany.findExistingNoMovement',
          table: TABLE,
        }) ?? []

      for (const row of existingNoMovementRows) {
        const dedupKeys = toNoMovementDedupKeysFromRow(row)
        for (const key of dedupKeys) {
          existingNoMovementKeys.add(key)
        }
      }
    }

    const alertsToInsert = dedupedAlerts.filter((alert) => {
      if (alert.category !== 'monitoring' && alert.alert_fingerprint !== null) {
        const fingerprintKey = `${alert.container_id}|${alert.alert_fingerprint}`
        if (
          incomingFingerprintKeys.has(fingerprintKey) &&
          existingFingerprintKeys.has(fingerprintKey)
        ) {
          return false
        }
      }

      const noMovementKeys = toNoMovementDedupKeysFromAlert(alert)
      if (noMovementKeys.some((key) => existingNoMovementKeys.has(key))) {
        return false
      }

      return true
    })

    if (alertsToInsert.length === 0) return []

    const rows = alertsToInsert.map(alertToInsertRow)

    // NOTE: DB-level unique constraints (e.g. on (container_id, alert_fingerprint))
    // are strongly recommended to make idempotency robust under concurrent
    // pipeline runs. The client library's insert options for "on conflict"
    // are not consistently typed across versions; for now fall back to a
    // standard insert and rely on the pre-insert dedup checks. When the
    // project standardizes on a supabase client that supports an upsert/ignore
    // option with types, replace this call with an "on conflict do nothing"
    // insert (or `.upsert(..., { onConflict: [...] })`) to make the operation
    // atomic.
    const result = await supabase.from(TABLE).insert(rows).select(TRACKING_ALERT_DOMAIN_SELECT)
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertMany',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const result = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'findActiveByContainerId',
      query: () =>
        supabase
          .from(TABLE)
          .select(TRACKING_ALERT_DOMAIN_SELECT)
          .eq('container_id', containerId)
          .eq('lifecycle_state', 'ACTIVE')
          .order('triggered_at', { ascending: false })
          .order('id', { ascending: false }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findActiveByContainerId',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findActiveByContainerIds(
    containerIds: readonly string[],
  ): Promise<readonly TrackingAlert[]> {
    if (containerIds.length === 0) return []

    const uniqueContainerIds = Array.from(new Set(containerIds))
    const result = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'findActiveByContainerIds',
      query: () =>
        supabase
          .from(TABLE)
          .select(TRACKING_ALERT_DOMAIN_SELECT)
          .in('container_id', uniqueContainerIds)
          .eq('lifecycle_state', 'ACTIVE')
          .order('triggered_at', { ascending: false })
          .order('id', { ascending: false }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findActiveByContainerIds',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const result = await supabase
      .from(TABLE)
      .select('type')
      .eq('container_id', containerId)
      .eq('lifecycle_state', 'ACTIVE')

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findActiveTypesByContainerId',
      table: TABLE,
    })

    const types = new Set<string>()
    for (const row of data ?? []) {
      if (row && typeof row.type === 'string') types.add(row.type)
    }
    return types
  },

  async findByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const result = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'findByContainerId',
      query: () =>
        supabase
          .from(TABLE)
          .select(TRACKING_ALERT_DOMAIN_SELECT)
          .eq('container_id', containerId)
          .order('triggered_at', { ascending: false })
          .order('id', { ascending: false }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findByContainerId',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findByContainerIds(containerIds: readonly string[]): Promise<readonly TrackingAlert[]> {
    if (containerIds.length === 0) return []

    const uniqueContainerIds = Array.from(new Set(containerIds))
    const result = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'findByContainerIds',
      query: () =>
        supabase
          .from(TABLE)
          .select(TRACKING_ALERT_DOMAIN_SELECT)
          .in('container_id', uniqueContainerIds)
          .order('triggered_at', { ascending: false })
          .order('id', { ascending: false }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findByContainerIds',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findAlertDerivationStateByContainerId(containerId: string) {
    const result = await supabase
      .from(TABLE)
      .select(
        'id, category, type, message_key, message_params, source_observation_fingerprints, alert_fingerprint, acked_at, resolved_at',
      )
      .eq('container_id', containerId)
      .order('triggered_at', { ascending: false })
      .order('id', { ascending: false })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findAlertDerivationStateByContainerId',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDerivationState)
  },

  async findContainerNumbersByIds(
    containerIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (containerIds.length === 0) {
      return new Map()
    }

    const uniqueContainerIds = Array.from(new Set(containerIds))
    const result = await measureAuditedReadQuery({
      table: CONTAINERS_TABLE,
      operation: 'findContainerNumbersByIds',
      query: () =>
        supabase.from(CONTAINERS_TABLE).select('id, container_number').in('id', uniqueContainerIds),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const rows =
      unwrapSupabaseResultOrThrow(result, {
        operation: 'findContainerNumbersByIds',
        table: CONTAINERS_TABLE,
      }) ?? []

    const containerNumberByContainerId = new Map<string, string>()
    for (const row of rows) {
      containerNumberByContainerId.set(row.id, row.container_number)
    }

    return containerNumberByContainerId
  },

  async listActiveAlertReadModel(): Promise<readonly TrackingActiveAlertReadModel[]> {
    const alertsResult = await measureAuditedReadQuery({
      table: TABLE,
      operation: 'listActiveAlertReadModel.alerts',
      query: () =>
        supabase
          .from(TABLE)
          .select(TRACKING_ALERT_DOMAIN_SELECT)
          .eq('lifecycle_state', 'ACTIVE')
          .order('triggered_at', { ascending: false })
          .order('id', { ascending: false }),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const alertRows =
      unwrapSupabaseResultOrThrow(alertsResult, {
        operation: 'listActiveAlertReadModel.alerts',
        table: TABLE,
      }) ?? []

    if (alertRows.length === 0) {
      return []
    }

    const containerIds = Array.from(new Set(alertRows.map((row) => row.container_id)))

    const containersResult = await measureAuditedReadQuery({
      table: CONTAINERS_TABLE,
      operation: 'listActiveAlertReadModel.containers',
      query: () => supabase.from(CONTAINERS_TABLE).select('id, process_id').in('id', containerIds),
      resultSelector: (queryResult) => queryResult.data ?? [],
    })

    const containerRows =
      unwrapSupabaseResultOrThrow(containersResult, {
        operation: 'listActiveAlertReadModel.containers',
        table: CONTAINERS_TABLE,
      }) ?? []

    const processIdByContainerId = new Map<string, string>()
    for (const row of containerRows) {
      processIdByContainerId.set(row.id, row.process_id)
    }

    const readModel: TrackingActiveAlertReadModel[] = []
    for (const row of alertRows) {
      const processId = processIdByContainerId.get(row.container_id)
      if (!processId) {
        // Fail fast: missing container/process mapping indicates a data integrity
        // problem that would silently hide active alerts from consumers.
        throw new Error(
          `listActiveAlertReadModel: missing container->process mapping for container_id=${String(
            row.container_id,
          )} (alert_id=${String(row.id)})`,
        )
      }

      // Use the centralized persistence mapper to validate enum fields and
      // timestamp shapes. The mapper throws with a helpful message when rows
      // contain unexpected values; surface that error instead of silently
      // discarding rows.
      let domainAlert: TrackingAlert | null = null
      try {
        domainAlert = alertRowToDomain(row)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(
          `listActiveAlertReadModel: invalid alert row (id=${String(row.id)}): ${message}`,
        )
      }

      // domainAlert is assigned above or the function threw; TS knows it's non-null here
      readModel.push({
        alert_id: domainAlert.id,
        process_id: processId,
        container_id: domainAlert.container_id,
        category: domainAlert.category,
        severity: domainAlert.severity,
        type: domainAlert.type,
        message_key: domainAlert.message_key,
        message_params: domainAlert.message_params,
        generated_at: domainAlert.triggered_at,
        fingerprint: domainAlert.alert_fingerprint,
        is_active: resolveAlertLifecycleState(domainAlert) === 'ACTIVE',
        retroactive: domainAlert.retroactive,
      })
    }

    return readModel
  },

  async acknowledge(
    alertId: string,
    ackedAt: string,
    metadata: {
      readonly ackedBy: string | null
      readonly ackedSource: TrackingAlertAckSource | null
    },
  ): Promise<void> {
    const result = await supabase
      .from(TABLE)
      .update({
        lifecycle_state: 'ACKED',
        acked_at: ackedAt,
        acked_by: metadata.ackedBy,
        acked_source: metadata.ackedSource,
        resolved_at: null,
        resolved_reason: null,
      })
      .eq('id', alertId)
      .eq('lifecycle_state', 'ACTIVE')
    unwrapSupabaseSingleOrNull(result, { operation: 'acknowledge', table: TABLE })
  },

  async unacknowledge(alertId: string): Promise<void> {
    const result = await supabase
      .from(TABLE)
      .update({
        lifecycle_state: 'ACTIVE',
        acked_at: null,
        acked_by: null,
        acked_source: null,
        resolved_at: null,
        resolved_reason: null,
      })
      .eq('id', alertId)
      .eq('lifecycle_state', 'ACKED')
    unwrapSupabaseSingleOrNull(result, { operation: 'unacknowledge', table: TABLE })
  },

  async autoResolveMany(command): Promise<void> {
    if (command.alertIds.length === 0) return

    const uniqueAlertIds = Array.from(new Set(command.alertIds))

    const result = await supabase
      .from(TABLE)
      .update({
        lifecycle_state: 'AUTO_RESOLVED',
        resolved_at: command.resolvedAt,
        resolved_reason: command.reason,
        acked_at: null,
        acked_by: null,
        acked_source: null,
      })
      .in('id', uniqueAlertIds)
      .eq('category', 'monitoring')
      .eq('lifecycle_state', 'ACTIVE')

    unwrapSupabaseResultOrThrow(result, { operation: 'autoResolveMany', table: TABLE })
  },
}
