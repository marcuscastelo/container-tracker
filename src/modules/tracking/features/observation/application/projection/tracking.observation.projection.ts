import type { TemporalValue } from '~/shared/time/temporal-value'

export type TrackingObservationProjection = {
  readonly id: string
  readonly type: string
  // Projection mirrors canonical observation fields used by tracking read models.
  readonly carrier_label?: string | null
  readonly event_time: TemporalValue | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly created_at: string
}

type TrackingObservationSource = {
  readonly id: string
  readonly type: string
  readonly carrier_label?: string | null
  readonly event_time: TemporalValue | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly created_at: string
}

export function toTrackingObservationProjection(
  source: TrackingObservationSource,
): TrackingObservationProjection {
  const carrier_label = source.carrier_label ?? null

  return {
    id: source.id,
    type: source.type,
    carrier_label,
    event_time: source.event_time,
    event_time_type: source.event_time_type,
    location_code: source.location_code,
    location_display: source.location_display,
    vessel_name: source.vessel_name,
    voyage: source.voyage,
    created_at: source.created_at,
  }
}

export function toTrackingObservationProjections(
  sources: readonly TrackingObservationSource[],
): TrackingObservationProjection[] {
  return sources.map(toTrackingObservationProjection)
}
