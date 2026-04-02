import type { ObservationDraft } from '~/modules/tracking/features/observation/domain/model/observationDraft'
import {
  buildAbsoluteTrackingTemporal,
  buildDateOnlyTrackingTemporal,
  composeTrackingRawEventTime,
  resolveTrackingEventTimezone,
} from '~/modules/tracking/infrastructure/carriers/normalizers/tracking-temporal-resolution'
import {
  parseCalendarDateFromIso,
  parseInstantFromIso,
  parseLocalDateTimeFromIso,
} from '~/shared/time/parsing'
import { localDateTimeValue } from '~/shared/time/temporal-value'

type OneTemporalResolution = Pick<
  ObservationDraft,
  'event_time' | 'raw_event_time' | 'event_time_source'
>

function toTrimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function stripOneSerializedLocalZuluSuffix(value: string | null | undefined): string | null {
  const trimmed = toTrimmedOrNull(value)
  if (trimmed === null) return null
  return trimmed.endsWith('Z') ? trimmed.slice(0, -1) : trimmed
}

function tryBuildLocalTemporal(args: {
  readonly serializedLocalDateTime: string | null
  readonly rawEventTime: string | null
  readonly locationCode: string | null
  readonly locationDisplay: string | null
}): OneTemporalResolution | null {
  if (args.serializedLocalDateTime === null) return null

  const timezone = resolveTrackingEventTimezone({
    locationCode: args.locationCode,
    locationDisplay: args.locationDisplay,
  })

  if (timezone === null) return null

  const parsedLocalDateTime = parseLocalDateTimeFromIso(args.serializedLocalDateTime, timezone)
  if (parsedLocalDateTime === null) return null

  return {
    event_time: localDateTimeValue(parsedLocalDateTime),
    raw_event_time: args.rawEventTime,
    event_time_source: 'carrier_local_port_time',
  }
}

export function resolveOneEventTemporal(args: {
  readonly eventLocalPortDate: string | null | undefined
  readonly eventDate: string | null | undefined
  readonly locationCode: string | null
  readonly locationDisplay: string | null
}): OneTemporalResolution {
  const serializedLocalDateTime = stripOneSerializedLocalZuluSuffix(args.eventLocalPortDate)
  const absoluteEventDate = toTrimmedOrNull(args.eventDate)
  const rawEventTime = composeTrackingRawEventTime(args.eventLocalPortDate, args.eventDate)

  const localTemporal = tryBuildLocalTemporal({
    serializedLocalDateTime,
    rawEventTime,
    locationCode: args.locationCode,
    locationDisplay: args.locationDisplay,
  })
  if (localTemporal !== null) {
    return localTemporal
  }

  const absoluteTemporal = buildAbsoluteTrackingTemporal({
    instant: absoluteEventDate === null ? null : parseInstantFromIso(absoluteEventDate),
    rawEventTime,
  })
  if (absoluteTemporal.event_time !== null) {
    return absoluteTemporal
  }

  const fallbackDateText =
    serializedLocalDateTime?.slice(0, 10) ?? absoluteEventDate?.slice(0, 10) ?? null
  const fallbackDate = fallbackDateText === null ? null : parseCalendarDateFromIso(fallbackDateText)

  return buildDateOnlyTrackingTemporal({
    date: fallbackDate,
    rawEventTime,
    locationCode: args.locationCode,
    locationDisplay: args.locationDisplay,
    source: 'derived_fallback',
  })
}
