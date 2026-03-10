/**
 * Centralized persistence mappers for tracking entities.
 *
 * Rules (per architecture guide):
 *  - snake_case stays confined here and in Row types
 *  - No Zod in infrastructure
 *  - No spreads between domain and persistence
 *  - Inconsistencies throw (infra error)
 */

import type { Provider } from '~/modules/tracking/domain/model/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  NewTrackingAlert,
  TrackingAlert,
  TrackingAlertLifecycleState,
  TrackingAlertMessageContract,
  TrackingAlertMessageKey,
  TrackingAlertResolvedReason,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import type { Confidence } from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { stringsToJson, toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import type {
  InsertTrackingAlertRow,
  InsertTrackingObservationRow,
  InsertTrackingSnapshotRow,
  TrackingAlertRow,
  TrackingObservationRow,
  TrackingSnapshotRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.row'
import { normalizeTimestamptz } from '~/shared/utils/normalizeTimestamptz'

// ---------------------------------------------------------------------------
// Enum validation helpers (no Zod, no type assertions)
//
// Uses Record<string, T> lookup to avoid `as` while still narrowing to the
// correct union type. The record maps every valid string to its typed value.
// ---------------------------------------------------------------------------

const PROVIDER_MAP: Record<string, Provider> = {
  msc: 'msc',
  maersk: 'maersk',
  cmacgm: 'cmacgm',
}
function requireProvider(value: unknown, field: string): Provider {
  const s = requireString(value, field)
  const mapped = PROVIDER_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid provider: ${s}`)
  }
  return mapped
}

function optionalProvider(value: unknown, field: string): Provider | null {
  if (value === null || value === undefined) return null
  return requireProvider(value, field)
}

const OBSERVATION_TYPE_MAP: Record<string, ObservationType> = {
  GATE_IN: 'GATE_IN',
  GATE_OUT: 'GATE_OUT',
  LOAD: 'LOAD',
  DISCHARGE: 'DISCHARGE',
  DEPARTURE: 'DEPARTURE',
  ARRIVAL: 'ARRIVAL',
  CUSTOMS_HOLD: 'CUSTOMS_HOLD',
  CUSTOMS_RELEASE: 'CUSTOMS_RELEASE',
  DELIVERY: 'DELIVERY',
  EMPTY_RETURN: 'EMPTY_RETURN',
  OTHER: 'OTHER',
}
function requireObservationType(value: unknown, field: string): ObservationType {
  const s = requireString(value, field)
  const mapped = OBSERVATION_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid observation type: ${s}`)
  }
  return mapped
}

const EVENT_TIME_TYPE_MAP: Record<string, 'ACTUAL' | 'EXPECTED'> = {
  ACTUAL: 'ACTUAL',
  EXPECTED: 'EXPECTED',
}
function requireEventTimeType(value: unknown, field: string): 'ACTUAL' | 'EXPECTED' {
  const s = requireString(value, field)
  const mapped = EVENT_TIME_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid event_time_type: ${s}`)
  }
  return mapped
}

const CONFIDENCE_MAP: Record<string, Confidence> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
}
function requireConfidence(value: unknown, field: string): Confidence {
  const s = requireString(value, field)
  const mapped = CONFIDENCE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid confidence: ${s}`)
  }
  return mapped
}

type AlertCategory = TrackingAlert['category']
const ALERT_CATEGORY_MAP: Record<string, AlertCategory> = {
  fact: 'fact',
  monitoring: 'monitoring',
}
function requireAlertCategory(value: unknown, field: string): AlertCategory {
  const s = requireString(value, field)
  const mapped = ALERT_CATEGORY_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid alert category: ${s}`)
  }
  return mapped
}

type AlertType = TrackingAlert['type']
const ALERT_TYPE_MAP: Record<string, AlertType> = {
  TRANSSHIPMENT: 'TRANSSHIPMENT',
  CUSTOMS_HOLD: 'CUSTOMS_HOLD',
  PORT_CHANGE: 'PORT_CHANGE',
  NO_MOVEMENT: 'NO_MOVEMENT',
  ETA_PASSED: 'ETA_PASSED',
  ETA_MISSING: 'ETA_MISSING',
  DATA_INCONSISTENT: 'DATA_INCONSISTENT',
}
function requireAlertType(value: unknown, field: string): AlertType {
  const s = requireString(value, field)
  const mapped = ALERT_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid alert type: ${s}`)
  }
  return mapped
}

type AlertSeverity = TrackingAlert['severity']
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

function requireAlertMessageKey(value: unknown, field: string): TrackingAlertMessageKey {
  const s = requireString(value, field)
  const mapped = ALERT_MESSAGE_KEY_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid message key: ${s}`)
  }
  return mapped
}

type AlertAckSource = NonNullable<TrackingAlert['acked_source']>
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
function requireAlertLifecycleState(value: unknown, field: string): TrackingAlertLifecycleState {
  const s = requireString(value, field)
  const mapped = ALERT_LIFECYCLE_STATE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid lifecycle state: ${s}`)
  }
  return mapped
}

const ALERT_RESOLVED_REASON_MAP: Record<string, TrackingAlertResolvedReason> = {
  condition_cleared: 'condition_cleared',
  terminal_state: 'terminal_state',
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

const NO_MOVEMENT_BREAKPOINTS_DAYS = [5, 10, 20, 30] as const

function optionalAlertAckSource(value: unknown, field: string): AlertAckSource | null {
  if (value === null || value === undefined) return null
  const s = requireString(value, field)
  const mapped = ALERT_ACK_SOURCE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid ack source: ${s}`)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`tracking persistence mapper: ${field} is required but got ${String(value)}`)
  }
  return value
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`tracking persistence mapper: ${field} is required but got ${String(value)}`)
  }
  return value
}

function optionalFiniteNumber(value: unknown): number | null {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireTimestamp(value: unknown, field: string): string {
  const normalized = normalizeTimestamptz(value)
  if (normalized === null) {
    throw new Error(
      `tracking persistence mapper: ${field} is not a valid timestamp: ${String(value)}`,
    )
  }
  return normalized
}

function optionalTimestamp(value: unknown): string | null {
  return normalizeTimestamptz(value)
}

/**
 * Normalize ISO timestamps that may have offsets or space-separated formats
 * into canonical UTC ISO strings. Used for alert timestamps.
 */
function normalizeAlertIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const s = value.trim()
    if (s === '') return null
    const candidate = s.replace(/^(.+?) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)(.*)$/, '$1T$2$3')
    const d = new Date(candidate)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
    return null
  }
  return null
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

// ---------------------------------------------------------------------------
// Observation mappers
// ---------------------------------------------------------------------------

export function observationRowToDomain(row: TrackingObservationRow): Observation {
  return {
    id: requireString(row.id, 'observation.id'),
    fingerprint: requireString(row.fingerprint, 'observation.fingerprint'),
    container_id: requireString(row.container_id, 'observation.container_id'),
    container_number: requireString(row.container_number, 'observation.container_number'),
    event_time_type: requireEventTimeType(row.event_time_type, 'observation.event_time_type'),
    type: requireObservationType(row.type, 'observation.type'),
    event_time: optionalTimestamp(row.event_time),
    location_code: row.location_code,
    location_display: row.location_display,
    vessel_name: row.vessel_name,
    voyage: row.voyage,
    is_empty: row.is_empty,
    confidence: requireConfidence(row.confidence, 'observation.confidence'),
    provider: requireProvider(row.provider, 'observation.provider'),
    created_from_snapshot_id: requireString(
      row.created_from_snapshot_id,
      'observation.created_from_snapshot_id',
    ),
    carrier_label: row.carrier_label,
    created_at: requireTimestamp(row.created_at, 'observation.created_at'),
    retroactive: row.retroactive,
  }
}

export function observationToInsertRow(obs: NewObservation): InsertTrackingObservationRow {
  return {
    fingerprint: obs.fingerprint,
    container_id: obs.container_id,
    container_number: obs.container_number,
    type: obs.type,
    event_time: obs.event_time == null ? null : normalizeTimestamptz(obs.event_time),
    location_code: obs.location_code,
    location_display: obs.location_display,
    vessel_name: obs.vessel_name,
    voyage: obs.voyage,
    is_empty: obs.is_empty,
    confidence: obs.confidence,
    provider: obs.provider,
    created_from_snapshot_id: obs.created_from_snapshot_id,
    carrier_label: obs.carrier_label ?? null,
    retroactive: obs.retroactive ?? false,
    event_time_type: obs.event_time_type,
  }
}

// ---------------------------------------------------------------------------
// Snapshot mappers
// ---------------------------------------------------------------------------

export function snapshotRowToDomain(row: TrackingSnapshotRow): Snapshot {
  return {
    id: requireString(row.id, 'snapshot.id'),
    container_id: requireString(row.container_id, 'snapshot.container_id'),
    provider: requireProvider(row.provider, 'snapshot.provider'),
    fetched_at: requireTimestamp(row.fetched_at, 'snapshot.fetched_at'),
    payload: row.payload,
    parse_error: row.parse_error,
  }
}

export function snapshotToInsertRow(snapshot: NewSnapshot): InsertTrackingSnapshotRow {
  return {
    container_id: snapshot.container_id,
    provider: snapshot.provider,
    fetched_at: snapshot.fetched_at,
    payload: toJson(snapshot.payload),
    parse_error: snapshot.parse_error ?? null,
  }
}

// ---------------------------------------------------------------------------
// Alert mappers
// ---------------------------------------------------------------------------

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
