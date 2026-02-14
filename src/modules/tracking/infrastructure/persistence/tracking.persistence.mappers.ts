/**
 * Centralized persistence mappers for tracking entities.
 *
 * Rules (per architecture guide):
 *  - snake_case stays confined here and in Row types
 *  - No Zod in infrastructure
 *  - No spreads between domain and persistence
 *  - Inconsistencies throw (infra error)
 */

import type { NewObservation, Observation } from '~/modules/tracking/domain/observation'
import type { Confidence } from '~/modules/tracking/domain/observationDraft'
import type { ObservationType } from '~/modules/tracking/domain/observationType'
import type { Provider } from '~/modules/tracking/domain/provider'
import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/snapshot'
import type { NewTrackingAlert, TrackingAlert } from '~/modules/tracking/domain/trackingAlert'
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

export function alertRowToDomain(row: TrackingAlertRow): TrackingAlert {
  let fingerprints: string[] = []
  if (Array.isArray(row.source_observation_fingerprints)) {
    fingerprints = row.source_observation_fingerprints.filter(
      (v): v is string => typeof v === 'string',
    )
  }

  return {
    id: requireString(row.id, 'alert.id'),
    container_id: requireString(row.container_id, 'alert.container_id'),
    category: requireAlertCategory(row.category, 'alert.category'),
    type: requireAlertType(row.type, 'alert.type'),
    severity: requireAlertSeverity(row.severity, 'alert.severity'),
    message: requireString(row.message, 'alert.message'),
    detected_at: requireString(normalizeAlertIso(row.detected_at), 'alert.detected_at'),
    triggered_at: requireString(normalizeAlertIso(row.triggered_at), 'alert.triggered_at'),
    source_observation_fingerprints: fingerprints,
    alert_fingerprint: row.alert_fingerprint ?? null,
    retroactive: row.retroactive,
    provider: optionalProvider(row.provider, 'alert.provider'),
    acked_at: normalizeAlertIso(row.acked_at),
    dismissed_at: normalizeAlertIso(row.dismissed_at),
  }
}

export function alertToInsertRow(alert: NewTrackingAlert): InsertTrackingAlertRow {
  return {
    container_id: alert.container_id,
    category: alert.category,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    detected_at: alert.detected_at,
    triggered_at: alert.triggered_at,
    source_observation_fingerprints: stringsToJson(alert.source_observation_fingerprints),
    alert_fingerprint: alert.alert_fingerprint,
    retroactive: alert.retroactive,
    provider: alert.provider,
    acked_at: alert.acked_at,
    dismissed_at: alert.dismissed_at,
  }
}
