import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/application/projection/tracking.active-alert.readmodel'
import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/model/trackingAlert'
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

function toAlertCategory(value: string): TrackingActiveAlertReadModel['category'] | null {
  if (value === 'fact' || value === 'monitoring') {
    return value
  }
  return null
}

function toAlertSeverity(value: string): TrackingActiveAlertReadModel['severity'] | null {
  if (value === 'danger' || value === 'warning' || value === 'info') {
    return value
  }
  return null
}

function toAlertType(value: string): TrackingActiveAlertReadModel['type'] | null {
  if (
    value === 'TRANSSHIPMENT' ||
    value === 'CUSTOMS_HOLD' ||
    value === 'PORT_CHANGE' ||
    value === 'NO_MOVEMENT' ||
    value === 'ETA_PASSED' ||
    value === 'ETA_MISSING' ||
    value === 'DATA_INCONSISTENT'
  ) {
    return value
  }
  return null
}

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
      .is('dismissed_at', null)
      .order('triggered_at', { ascending: false })

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
      .is('dismissed_at', null)

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

  async listActiveAlertReadModel(): Promise<readonly TrackingActiveAlertReadModel[]> {
    const alertsResult = await supabase
      .from(TABLE)
      .select('*')
      .is('acked_at', null)
      .is('dismissed_at', null)
      .order('triggered_at', { ascending: false })

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
      if (!processId) continue

      const category = toAlertCategory(row.category)
      const severity = toAlertSeverity(row.severity)
      const type = toAlertType(row.type)
      if (category === null || severity === null || type === null) continue

      readModel.push({
        alert_id: row.id,
        process_id: processId,
        container_id: row.container_id,
        category,
        severity,
        type,
        generated_at: row.triggered_at,
        fingerprint: row.alert_fingerprint,
        is_active: row.acked_at === null && row.dismissed_at === null,
        retroactive: row.retroactive,
      })
    }

    return readModel
  },

  async acknowledge(alertId: string, ackedAt: string): Promise<void> {
    const result = await supabase.from(TABLE).update({ acked_at: ackedAt }).eq('id', alertId)
    unwrapSupabaseSingleOrNull(result, { operation: 'acknowledge', table: TABLE })
  },

  async dismiss(alertId: string, dismissedAt: string): Promise<void> {
    const result = await supabase
      .from(TABLE)
      .update({ dismissed_at: dismissedAt })
      .eq('id', alertId)
    unwrapSupabaseSingleOrNull(result, { operation: 'dismiss', table: TABLE })
  },
}
