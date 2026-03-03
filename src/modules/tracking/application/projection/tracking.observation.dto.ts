export type TrackingObservationDTO = {
  readonly id: string
  readonly type: string
  readonly carrierLabel?: string
  readonly event_time: string | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly created_at: string
}

export type TrackingObservationSource = {
  readonly id: string
  readonly type: string
  readonly carrier_label?: string | null
  readonly event_time: string | null
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly location_code: string | null
  readonly location_display: string | null
  readonly vessel_name: string | null
  readonly voyage: string | null
  readonly created_at: string
}

export function toTrackingObservationDTO(
  source: TrackingObservationSource,
): TrackingObservationDTO {
  const carrierLabel = source.carrier_label ?? undefined

  return {
    id: source.id,
    type: source.type,
    carrierLabel,
    event_time: source.event_time,
    event_time_type: source.event_time_type,
    location_code: source.location_code,
    location_display: source.location_display,
    vessel_name: source.vessel_name,
    voyage: source.voyage,
    created_at: source.created_at,
  }
}

export function toTrackingObservationDTOs(
  sources: readonly TrackingObservationSource[],
): TrackingObservationDTO[] {
  return sources.map(toTrackingObservationDTO)
}
