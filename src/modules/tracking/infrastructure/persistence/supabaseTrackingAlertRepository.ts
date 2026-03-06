import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/domain/model/trackingAlert'
import {
  alertRowToDomain,
  alertToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mappers'
import { supabase } from '~/shared/supabase/supabase'
import {
  unwrapSupabaseResultOrThrow,
  unwrapSupabaseSingleOrNull,
} from '~/shared/supabase/unwrapSupabaseResult'

const TABLE = 'tracking_alerts' as const
const CONTAINERS_TABLE = 'containers' as const

// NOTE: enum validation and normalization for alert rows is implemented in
// `alertRowToDomain` (tracking.persistence.mappers). We prefer reusing that
// centralized mapper to avoid duplication of enum logic here.

export const supabaseTrackingAlertRepository: TrackingAlertRepository = {
  async insertMany(alerts: readonly NewTrackingAlert[]): Promise<readonly TrackingAlert[]> {
    if (alerts.length === 0) return []

    const rows = alerts.map(alertToInsertRow)

    const result = await supabase.from(TABLE).insert(rows).select('*')
    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'insertMany',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findActiveByContainerId(containerId: string): Promise<readonly TrackingAlert[]> {
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .is('acked_at', null)
      .order('triggered_at', { ascending: false })
      .order('id', { ascending: false })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findActiveByContainerId',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async findActiveTypesByContainerId(containerId: string): Promise<ReadonlySet<string>> {
    const result = await supabase
      .from(TABLE)
      .select('type')
      .eq('container_id', containerId)
      .is('acked_at', null)

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
    const result = await supabase
      .from(TABLE)
      .select('*')
      .eq('container_id', containerId)
      .order('triggered_at', { ascending: false })
      .order('id', { ascending: false })

    const data = unwrapSupabaseResultOrThrow(result, {
      operation: 'findByContainerId',
      table: TABLE,
    })

    return (data ?? []).map(alertRowToDomain)
  },

  async listActiveAlertReadModel(): Promise<readonly TrackingActiveAlertReadModel[]> {
    const alertsResult = await supabase
      .from(TABLE)
      .select('*')
      .is('acked_at', null)
      .order('triggered_at', { ascending: false })
      .order('id', { ascending: false })

    const alertRows =
      unwrapSupabaseResultOrThrow(alertsResult, {
        operation: 'listActiveAlertReadModel.alerts',
        table: TABLE,
      }) ?? []

    if (alertRows.length === 0) {
      return []
    }

    const containerIds = Array.from(new Set(alertRows.map((row) => row.container_id)))

    const containersResult = await supabase
      .from(CONTAINERS_TABLE)
      .select('id, process_id')
      .in('id', containerIds)

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
        generated_at: domainAlert.triggered_at,
        fingerprint: domainAlert.alert_fingerprint,
        is_active: domainAlert.acked_at === null,
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
        acked_at: ackedAt,
        acked_by: metadata.ackedBy,
        acked_source: metadata.ackedSource,
      })
      .eq('id', alertId)
      .is('acked_at', null)
    unwrapSupabaseSingleOrNull(result, { operation: 'acknowledge', table: TABLE })
  },

  async unacknowledge(alertId: string): Promise<void> {
    const result = await supabase
      .from(TABLE)
      .update({ acked_at: null, acked_by: null, acked_source: null })
      .eq('id', alertId)
      .not('acked_at', 'is', 'null')
    unwrapSupabaseSingleOrNull(result, { operation: 'unacknowledge', table: TABLE })
  },
}
