import type { TrackingAlertRepository } from '~/modules/tracking/application/ports/tracking.alert.repository'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertAckSource,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
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
const NO_MOVEMENT_BREAKPOINTS_DAYS = [5, 10, 20, 30] as const

type NoMovementRow = {
  readonly container_id: string
  readonly category: string
  readonly type: string
  readonly message_key: string
  readonly message_params: unknown
  readonly source_observation_fingerprints: unknown
}

// NOTE: enum validation and normalization for alert rows is implemented in
// `alertRowToDomain` (tracking.persistence.mappers). We prefer reusing that
// centralized mapper to avoid duplication of enum logic here.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function normalizeNoMovementThresholdDays(rawThresholdDays: number): number {
  const normalizedCandidate = Math.floor(rawThresholdDays)
  const eligible = NO_MOVEMENT_BREAKPOINTS_DAYS.filter(
    (thresholdDays) => normalizedCandidate >= thresholdDays,
  )
  if (eligible.length === 0) return normalizedCandidate
  return eligible[eligible.length - 1] ?? normalizedCandidate
}

function toNoMovementThresholdDaysFromParams(messageParams: unknown): number | null {
  if (!isRecord(messageParams)) return null

  const days = toFiniteNumberOrNull(messageParams.days)
  const rawThresholdDays = toFiniteNumberOrNull(messageParams.threshold_days) ?? days
  if (rawThresholdDays === null) return null

  return normalizeNoMovementThresholdDays(rawThresholdDays)
}

function toNoMovementDateDedupKeyFromParams(
  containerId: string,
  messageParams: unknown,
  normalizedThresholdDays: number,
): string | null {
  if (!isRecord(messageParams)) return null

  const lastEventDateValue = messageParams.lastEventDate
  if (typeof lastEventDateValue !== 'string') return null
  const lastEventDate = lastEventDateValue.trim()
  if (lastEventDate.length === 0) return null

  return `${containerId}|date:${lastEventDate}|threshold:${normalizedThresholdDays}`
}

function toNoMovementSourceDedupKeys(
  containerId: string,
  normalizedThresholdDays: number,
  sourceObservationFingerprints: unknown,
): readonly string[] {
  if (!Array.isArray(sourceObservationFingerprints)) return []

  const keys: string[] = []
  for (const value of sourceObservationFingerprints) {
    if (typeof value !== 'string') continue
    const fingerprint = value.trim()
    if (fingerprint.length === 0) continue
    keys.push(`${containerId}|source:${fingerprint}|threshold:${normalizedThresholdDays}`)
  }

  return Array.from(new Set(keys))
}

function toNoMovementDedupKeysFromAlert(alert: NewTrackingAlert): readonly string[] {
  if (alert.category !== 'monitoring') return []
  if (alert.type !== 'NO_MOVEMENT') return []
  if (alert.message_key !== 'alerts.noMovementDetected') return []

  const normalizedThresholdDays = toNoMovementThresholdDaysFromParams(alert.message_params)
  if (normalizedThresholdDays === null) return []

  const dedupKeys: string[] = []
  const byDate = toNoMovementDateDedupKeyFromParams(
    alert.container_id,
    alert.message_params,
    normalizedThresholdDays,
  )
  if (byDate !== null) dedupKeys.push(byDate)

  dedupKeys.push(
    ...toNoMovementSourceDedupKeys(
      alert.container_id,
      normalizedThresholdDays,
      alert.source_observation_fingerprints,
    ),
  )

  return dedupKeys
}

function toNoMovementDedupKeysFromRow(row: NoMovementRow): readonly string[] {
  if (row.category !== 'monitoring') return []
  if (row.type !== 'NO_MOVEMENT') return []
  if (row.message_key !== 'alerts.noMovementDetected') return []

  const normalizedThresholdDays = toNoMovementThresholdDaysFromParams(row.message_params)
  if (normalizedThresholdDays === null) return []

  const dedupKeys: string[] = []
  const byDate = toNoMovementDateDedupKeyFromParams(
    row.container_id,
    row.message_params,
    normalizedThresholdDays,
  )
  if (byDate !== null) dedupKeys.push(byDate)

  dedupKeys.push(
    ...toNoMovementSourceDedupKeys(
      row.container_id,
      normalizedThresholdDays,
      row.source_observation_fingerprints,
    ),
  )

  return dedupKeys
}

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
    const fingerprints = Array.from(
      new Set(
        dedupedAlerts
          .map((alert) => alert.alert_fingerprint)
          .filter((fingerprint): fingerprint is string => fingerprint !== null),
      ),
    )
    if (containerIds.length > 0 && fingerprints.length > 0) {
      const existingFingerprintRowsResult = await supabase
        .from(TABLE)
        .select('container_id, alert_fingerprint')
        .in('container_id', containerIds)
        .in('alert_fingerprint', fingerprints)

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
      const existingNoMovementRowsResult = await supabase
        .from(TABLE)
        .select(
          'container_id, category, type, message_key, message_params, source_observation_fingerprints',
        )
        .in('container_id', containerIds)
        .eq('category', 'monitoring')
        .eq('type', 'NO_MOVEMENT')
        .eq('message_key', 'alerts.noMovementDetected')

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
      if (alert.alert_fingerprint !== null) {
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

  async findContainerNumbersByIds(
    containerIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (containerIds.length === 0) {
      return new Map()
    }

    const uniqueContainerIds = Array.from(new Set(containerIds))
    const result = await supabase
      .from(CONTAINERS_TABLE)
      .select('id, container_number')
      .in('id', uniqueContainerIds)

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
