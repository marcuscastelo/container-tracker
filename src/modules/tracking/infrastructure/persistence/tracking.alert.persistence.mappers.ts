import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertDerivationState,
  TrackingAlertLifecycleState,
  TrackingAlertMessageContract,
  TrackingAlertMessageKey,
  TrackingAlertResolvedReason,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import { normalizeNoMovementThresholdDays } from '~/modules/tracking/features/alerts/domain/policy/no-movement-alert-policy'
import { stringsToJson, toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import {
  isRecord,
  normalizeAlertIso,
  optionalFiniteNumber,
  optionalProvider,
  requireFiniteNumber,
  requireString,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mapper-primitives'
import type {
  InsertTrackingAlertRow,
  TrackingAlertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.row'

type AlertCategory = TrackingAlert['category']
type AlertType = TrackingAlert['type']
type AlertSeverity = TrackingAlert['severity']
type AlertAckSource = NonNullable<TrackingAlert['acked_source']>

const ALERT_CATEGORY_MAP: Record<string, AlertCategory> = {
  fact: 'fact',
  monitoring: 'monitoring',
}

const ALERT_TYPE_MAP: Record<string, AlertType> = {
  TRANSSHIPMENT: 'TRANSSHIPMENT',
  CUSTOMS_HOLD: 'CUSTOMS_HOLD',
  PORT_CHANGE: 'PORT_CHANGE',
  NO_MOVEMENT: 'NO_MOVEMENT',
  ETA_PASSED: 'ETA_PASSED',
  ETA_MISSING: 'ETA_MISSING',
  DATA_INCONSISTENT: 'DATA_INCONSISTENT',
}

const ALERT_SEVERITY_MAP: Record<string, AlertSeverity> = {
  info: 'info',
  warning: 'warning',
  danger: 'danger',
}

const ALERT_MESSAGE_KEY_MAP: Record<string, TrackingAlertMessageKey> = {
  'alerts.transshipmentDetected': 'alerts.transshipmentDetected',
  'alerts.customsHoldDetected': 'alerts.customsHoldDetected',
  'alerts.noMovementDetected': 'alerts.noMovementDetected',
  'alerts.etaMissing': 'alerts.etaMissing',
  'alerts.etaPassed': 'alerts.etaPassed',
  'alerts.portChange': 'alerts.portChange',
  'alerts.dataInconsistent': 'alerts.dataInconsistent',
}

const ALERT_ACK_SOURCE_MAP: Record<string, AlertAckSource> = {
  dashboard: 'dashboard',
  process_view: 'process_view',
  api: 'api',
}

const ALERT_LIFECYCLE_STATE_MAP: Record<string, TrackingAlertLifecycleState> = {
  ACTIVE: 'ACTIVE',
  ACKED: 'ACKED',
  AUTO_RESOLVED: 'AUTO_RESOLVED',
}

const ALERT_RESOLVED_REASON_MAP: Record<string, TrackingAlertResolvedReason> = {
  condition_cleared: 'condition_cleared',
  terminal_state: 'terminal_state',
}

function requireAlertCategory(value: unknown, field: string): AlertCategory {
  const s = requireString(value, field)
  const mapped = ALERT_CATEGORY_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid alert category: ${s}`)
  }
  return mapped
}

function requireAlertType(value: unknown, field: string): AlertType {
  const s = requireString(value, field)
  const mapped = ALERT_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid alert type: ${s}`)
  }
  return mapped
}

function requireAlertSeverity(value: unknown, field: string): AlertSeverity {
  const s = requireString(value, field)
  const mapped = ALERT_SEVERITY_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid alert severity: ${s}`)
  }
  return mapped
}

function requireAlertMessageKey(value: unknown, field: string): TrackingAlertMessageKey {
  const s = requireString(value, field)
  const mapped = ALERT_MESSAGE_KEY_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid message key: ${s}`)
  }
  return mapped
}

function requireAlertLifecycleState(value: unknown, field: string): TrackingAlertLifecycleState {
  const s = requireString(value, field)
  const mapped = ALERT_LIFECYCLE_STATE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid lifecycle state: ${s}`)
  }
  return mapped
}

function optionalAlertResolvedReason(
  value: unknown,
  field: string,
): TrackingAlertResolvedReason | null {
  if (value === null || value === undefined) return null
  const s = requireString(value, field)
  const mapped = ALERT_RESOLVED_REASON_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid resolved reason: ${s}`)
  }
  return mapped
}

function optionalAlertAckSource(value: unknown, field: string): AlertAckSource | null {
  if (value === null || value === undefined) return null
  const s = requireString(value, field)
  const mapped = ALERT_ACK_SOURCE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid ack source: ${s}`)
  }
  return mapped
}

function requireAlertMessageContract(
  keyValue: unknown,
  paramsValue: unknown,
  field: string,
): TrackingAlertMessageContract {
  const messageKey = requireAlertMessageKey(keyValue, `${field}.message_key`)
  const value = paramsValue
  const params = isRecord(value) ? value : null
  if (params === null) {
    throw new Error(
      `tracking persistence mapper: ${field} is not a valid message params object: ${String(value)}`,
    )
  }

  if (messageKey === 'alerts.transshipmentDetected') {
    return {
      message_key: messageKey,
      message_params: {
        port: requireString(params.port, `${field}.port`),
        fromVessel: requireString(params.fromVessel, `${field}.fromVessel`),
        toVessel: requireString(params.toVessel, `${field}.toVessel`),
      },
    }
  }

  if (messageKey === 'alerts.customsHoldDetected') {
    return {
      message_key: messageKey,
      message_params: {
        location: requireString(params.location, `${field}.location`),
      },
    }
  }

  if (messageKey === 'alerts.noMovementDetected') {
    const days = requireFiniteNumber(params.days, `${field}.days`)
    const thresholdCandidate = optionalFiniteNumber(params.threshold_days) ?? days
    const thresholdDays = normalizeNoMovementThresholdDays(thresholdCandidate)
    const daysWithoutMovement = optionalFiniteNumber(params.days_without_movement) ?? days

    return {
      message_key: messageKey,
      message_params: {
        threshold_days: thresholdDays,
        days_without_movement: daysWithoutMovement,
        days,
        lastEventDate: requireString(params.lastEventDate, `${field}.lastEventDate`),
      },
    }
  }

  if (
    messageKey === 'alerts.etaMissing' ||
    messageKey === 'alerts.etaPassed' ||
    messageKey === 'alerts.portChange' ||
    messageKey === 'alerts.dataInconsistent'
  ) {
    return {
      message_key: messageKey,
      message_params: {},
    }
  }

  const unsupportedMessageKey: never = messageKey
  throw new Error(
    `tracking persistence mapper: ${field} reached unsupported message key: ${String(unsupportedMessageKey)}`,
  )
}

function deriveAlertLifecycleStateFromTimestamps(command: {
  readonly lifecycleState: TrackingAlertRow['lifecycle_state'] | NewTrackingAlert['lifecycle_state']
  readonly ackedAtIso: string | null
  readonly resolvedAtIso: string | null
}): 'ACTIVE' | 'ACKED' | 'AUTO_RESOLVED' {
  if (command.lifecycleState === 'ACTIVE') return 'ACTIVE'
  if (command.lifecycleState === 'ACKED') return 'ACKED'
  if (command.lifecycleState === 'AUTO_RESOLVED') return 'AUTO_RESOLVED'
  if (command.ackedAtIso !== null) return 'ACKED'
  if (command.resolvedAtIso !== null) return 'AUTO_RESOLVED'
  return 'ACTIVE'
}

export function alertRowToDomain(row: TrackingAlertRow): TrackingAlert {
  let fingerprints: string[] = []
  if (Array.isArray(row.source_observation_fingerprints)) {
    fingerprints = row.source_observation_fingerprints.filter(
      (v): v is string => typeof v === 'string',
    )
  }
  const messageContract = requireAlertMessageContract(
    row.message_key,
    row.message_params,
    'alert.message',
  )
  const ackedAtIso = normalizeAlertIso(row.acked_at)
  const resolvedAtIso = normalizeAlertIso(row.resolved_at)
  const lifecycleState = deriveAlertLifecycleStateFromTimestamps({
    lifecycleState:
      row.lifecycle_state === null || row.lifecycle_state === undefined
        ? undefined
        : requireAlertLifecycleState(row.lifecycle_state, 'alert.lifecycle_state'),
    ackedAtIso,
    resolvedAtIso,
  })

  return {
    lifecycle_state: lifecycleState,
    id: requireString(row.id, 'alert.id'),
    container_id: requireString(row.container_id, 'alert.container_id'),
    category: requireAlertCategory(row.category, 'alert.category'),
    type: requireAlertType(row.type, 'alert.type'),
    severity: requireAlertSeverity(row.severity, 'alert.severity'),
    ...messageContract,
    detected_at: requireString(normalizeAlertIso(row.detected_at), 'alert.detected_at'),
    triggered_at: requireString(normalizeAlertIso(row.triggered_at), 'alert.triggered_at'),
    source_observation_fingerprints: fingerprints,
    alert_fingerprint: row.alert_fingerprint ?? null,
    retroactive: row.retroactive,
    provider: optionalProvider(row.provider, 'alert.provider'),
    acked_at: ackedAtIso,
    acked_by: row.acked_by ?? null,
    acked_source: optionalAlertAckSource(row.acked_source, 'alert.acked_source'),
    resolved_at: resolvedAtIso,
    resolved_reason: optionalAlertResolvedReason(row.resolved_reason, 'alert.resolved_reason'),
  }
}

export function alertRowToDerivationState(
  row: Pick<
    TrackingAlertRow,
    | 'id'
    | 'category'
    | 'type'
    | 'message_key'
    | 'message_params'
    | 'source_observation_fingerprints'
    | 'alert_fingerprint'
    | 'acked_at'
    | 'resolved_at'
  >,
): TrackingAlertDerivationState {
  let fingerprints: string[] = []
  if (Array.isArray(row.source_observation_fingerprints)) {
    fingerprints = row.source_observation_fingerprints.filter(
      (value): value is string => typeof value === 'string',
    )
  }

  const messageContract = requireAlertMessageContract(
    row.message_key,
    row.message_params,
    'alert.message',
  )

  return {
    id: requireString(row.id, 'alert.id'),
    category: requireAlertCategory(row.category, 'alert.category'),
    type: requireAlertType(row.type, 'alert.type'),
    message_params: messageContract.message_params,
    source_observation_fingerprints: fingerprints,
    alert_fingerprint: row.alert_fingerprint ?? null,
    acked_at: normalizeAlertIso(row.acked_at),
    resolved_at: normalizeAlertIso(row.resolved_at),
  }
}

export function alertToInsertRow(alert: NewTrackingAlert): InsertTrackingAlertRow {
  const lifecycleState = deriveAlertLifecycleStateFromTimestamps({
    lifecycleState: alert.lifecycle_state,
    ackedAtIso: alert.acked_at,
    resolvedAtIso: alert.resolved_at ?? null,
  })

  return {
    lifecycle_state: lifecycleState,
    container_id: alert.container_id,
    category: alert.category,
    type: alert.type,
    severity: alert.severity,
    message_key: alert.message_key,
    message_params: toJson(alert.message_params),
    detected_at: alert.detected_at,
    triggered_at: alert.triggered_at,
    source_observation_fingerprints: stringsToJson(alert.source_observation_fingerprints),
    alert_fingerprint: alert.alert_fingerprint,
    retroactive: alert.retroactive,
    provider: alert.provider,
    acked_at: alert.acked_at,
    acked_by: alert.acked_by,
    acked_source: alert.acked_source,
    resolved_at: alert.resolved_at ?? null,
    resolved_reason: alert.resolved_reason ?? null,
  }
}
