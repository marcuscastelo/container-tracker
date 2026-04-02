/**
 * Centralized persistence mappers for tracking entities.
 *
 * Rules (per architecture guide):
 *  - snake_case stays confined here and in Row types
 *  - No Zod in infrastructure
 *  - No spreads between domain and persistence
 *  - Inconsistencies throw (infra error)
 */

import type { NewSnapshot, Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  NewTrackingAlert,
  TrackingAlert,
} from '~/modules/tracking/features/alerts/domain/model/trackingAlert'
import type {
  NewObservation,
  Observation,
} from '~/modules/tracking/features/observation/domain/model/observation'
import type {
  Confidence,
  EventTimeSource,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toJson } from '~/modules/tracking/infrastructure/persistence/toJson'
import {
  alertRowToDerivationState as mapAlertRowToDerivationState,
  alertRowToDomain as mapAlertRowToDomain,
  alertToInsertRow as mapAlertToInsertRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.alert.persistence.mappers'
import {
  readProvider,
  requireString,
  requireTimestamp,
} from '~/modules/tracking/infrastructure/persistence/tracking.persistence.mapper-primitives'
import type {
  InsertTrackingAlertRow,
  InsertTrackingObservationRow,
  InsertTrackingSnapshotRow,
  TrackingAlertRow,
  TrackingObservationRow,
  TrackingSnapshotRow,
} from '~/modules/tracking/infrastructure/persistence/tracking.row'
import { CalendarDate } from '~/shared/time/calendar-date'
import { Instant } from '~/shared/time/instant'
import { LocalDateTime } from '~/shared/time/local-date-time'
import {
  calendarDateValue,
  instantValue,
  localDateTimeValue,
  type TemporalValue,
} from '~/shared/time/temporal-value'

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
  TRANSSHIPMENT_INTENDED: 'TRANSSHIPMENT_INTENDED',
  TRANSSHIPMENT_POSITIONED_IN: 'TRANSSHIPMENT_POSITIONED_IN',
  TRANSSHIPMENT_POSITIONED_OUT: 'TRANSSHIPMENT_POSITIONED_OUT',
  TERMINAL_MOVE: 'TERMINAL_MOVE',
  OTHER: 'OTHER',
}

const EVENT_TIME_TYPE_MAP: Record<string, 'ACTUAL' | 'EXPECTED'> = {
  ACTUAL: 'ACTUAL',
  EXPECTED: 'EXPECTED',
}

const CONFIDENCE_MAP: Record<string, Confidence> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
}

type ObservationTemporalColumns = {
  readonly temporal_kind: 'instant' | 'date' | 'local_datetime' | null
  readonly event_time_instant: string | null
  readonly event_date: string | null
  readonly event_time_local: string | null
  readonly event_time_zone: string | null
}

function encodeTemporalValueForPersistence(
  value: TemporalValue | null,
): ObservationTemporalColumns {
  if (value === null) {
    return {
      temporal_kind: null,
      event_time_instant: null,
      event_date: null,
      event_time_local: null,
      event_time_zone: null,
    }
  }

  if (value.kind === 'instant') {
    return {
      temporal_kind: 'instant',
      event_time_instant: value.value.toIsoString(),
      event_date: null,
      event_time_local: null,
      event_time_zone: null,
    }
  }

  if (value.kind === 'local-datetime') {
    return {
      temporal_kind: 'local_datetime',
      event_time_instant: null,
      event_date: null,
      event_time_local: value.value.toIsoLocalString(),
      event_time_zone: value.value.timezone,
    }
  }

  return {
    temporal_kind: 'date',
    event_time_instant: null,
    event_date: value.value.toIsoDate(),
    event_time_local: null,
    event_time_zone: value.timezone,
  }
}

function requireTemporalKind(value: unknown, field: string): 'instant' | 'date' | 'local_datetime' {
  const kind = requireString(value, field)
  if (kind === 'instant' || kind === 'date' || kind === 'local_datetime') {
    return kind
  }

  throw new Error(`tracking persistence mapper: ${field} is not a valid temporal kind: ${kind}`)
}

function observationTemporalColumnsToDomain(row: TrackingObservationRow): TemporalValue | null {
  const { temporal_kind, event_time_instant, event_date, event_time_local, event_time_zone } = row

  if (temporal_kind === null) {
    if (event_time_instant === null && event_date === null && event_time_local === null) {
      // TODO: just return null instead of using event_time. For now, we are using the deprecated event_time column
      // Issue URL: https://github.com/marcuscastelo/container-tracker/issues/242
      if (row.event_time !== null) {
        return instantValue(
          Instant.fromIso(requireTimestamp(row.event_time, 'observation.event_time')),
        )
      }
      return null
    }

    throw new Error(
      'tracking persistence mapper: observation temporal columns are inconsistent (missing temporal_kind)',
    )
  }

  const kind = requireTemporalKind(temporal_kind, 'observation.temporal_kind')

  if (kind === 'instant') {
    if (event_date !== null || event_time_local !== null || event_time_zone !== null) {
      throw new Error(
        'tracking persistence mapper: instant observation cannot persist date/local temporal columns together with event_time_instant',
      )
    }

    return instantValue(
      Instant.fromIso(requireTimestamp(event_time_instant, 'observation.event_time_instant')),
    )
  }

  if (kind === 'local_datetime') {
    if (event_time_instant !== null || event_date !== null) {
      throw new Error(
        'tracking persistence mapper: local_datetime observation cannot persist event_time_instant or event_date together with event_time_local',
      )
    }

    return localDateTimeValue(
      LocalDateTime.fromIsoLocal(
        requireString(event_time_local, 'observation.event_time_local'),
        requireString(event_time_zone, 'observation.event_time_zone'),
      ),
    )
  }

  if (event_time_instant !== null || event_time_local !== null) {
    throw new Error(
      'tracking persistence mapper: date observation cannot persist event_time_instant or event_time_local together with event_date',
    )
  }

  return calendarDateValue(
    CalendarDate.fromIsoDate(requireString(event_date, 'observation.event_date')),
    event_time_zone ?? null,
  )
}

function requireObservationType(value: unknown, field: string): ObservationType {
  const s = requireString(value, field)
  const mapped = OBSERVATION_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid observation type: ${s}`)
  }
  return mapped
}

function requireEventTimeType(value: unknown, field: string): 'ACTUAL' | 'EXPECTED' {
  const s = requireString(value, field)
  const mapped = EVENT_TIME_TYPE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid event_time_type: ${s}`)
  }
  return mapped
}

function requireConfidence(value: unknown, field: string): Confidence {
  const s = requireString(value, field)
  const mapped = CONFIDENCE_MAP[s]
  if (mapped === undefined) {
    throw new Error(`tracking persistence mapper: ${field} is not a valid confidence: ${s}`)
  }
  return mapped
}

function requireEventTimeSource(value: unknown, field: string): EventTimeSource | null {
  if (value === null || value === undefined) return null

  const source = requireString(value, field)
  if (
    source === 'carrier_explicit_timezone' ||
    source === 'carrier_local_port_time' ||
    source === 'carrier_date_only' ||
    source === 'derived_fallback' ||
    source === 'unknown'
  ) {
    return source
  }

  throw new Error(
    `tracking persistence mapper: ${field} is not a valid event_time_source: ${source}`,
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
    event_time: observationTemporalColumnsToDomain(row),
    location_code: row.location_code,
    location_display: row.location_display,
    vessel_name: row.vessel_name,
    voyage: row.voyage,
    is_empty: row.is_empty,
    confidence: requireConfidence(row.confidence, 'observation.confidence'),
    provider: readProvider(row.provider, 'observation.provider'),
    created_from_snapshot_id: requireString(
      row.created_from_snapshot_id,
      'observation.created_from_snapshot_id',
    ),
    carrier_label: row.carrier_label,
    raw_event_time: row.raw_event_time,
    event_time_source: requireEventTimeSource(
      row.event_time_source,
      'observation.event_time_source',
    ),
    created_at: requireTimestamp(row.created_at, 'observation.created_at'),
    retroactive: row.retroactive,
  }
}

export function observationToInsertRow(obs: NewObservation): InsertTrackingObservationRow {
  const temporalColumns = encodeTemporalValueForPersistence(obs.event_time)

  return {
    fingerprint: obs.fingerprint,
    container_id: obs.container_id,
    container_number: obs.container_number,
    type: obs.type,
    temporal_kind: temporalColumns.temporal_kind,
    event_time_instant: temporalColumns.event_time_instant,
    event_date: temporalColumns.event_date,
    event_time_local: temporalColumns.event_time_local,
    event_time_zone: temporalColumns.event_time_zone,
    event_time_source: obs.event_time_source ?? null,
    raw_event_time: obs.raw_event_time ?? null,
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
    provider: readProvider(row.provider, 'snapshot.provider'),
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

export function alertRowToDomain(row: TrackingAlertRow): TrackingAlert {
  return mapAlertRowToDomain(row)
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
) {
  return mapAlertRowToDerivationState(row)
}

export function alertToInsertRow(alert: NewTrackingAlert): InsertTrackingAlertRow {
  return mapAlertToInsertRow(alert)
}
