import type { EventTimeSource } from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { CalendarDate } from '~/shared/time/calendar-date'
import type { Instant } from '~/shared/time/instant'
import { parseCalendarDateFromIso, parseLocalDateTimeFromIso } from '~/shared/time/parsing'
import {
  calendarDateValue,
  instantValue,
  localDateTimeValue,
  type TemporalValue,
} from '~/shared/time/temporal-value'

type TrackingTemporalResolution = {
  readonly event_time: TemporalValue | null
  readonly raw_event_time: string | null
  readonly event_time_source: EventTimeSource | null
}

type TrackingTemporalLocationContext = {
  readonly locationCode?: string | null | undefined
  readonly locationDisplay?: string | null | undefined
}

const LOCATION_CODE_TIMEZONES: Readonly<Record<string, string>> = {
  BRIGI: 'America/Sao_Paulo',
  BRIOA: 'America/Sao_Paulo',
  BRSSZ: 'America/Sao_Paulo',
  CNTAO: 'Asia/Shanghai',
  EGPSD: 'Africa/Cairo',
  ESBCN: 'Europe/Madrid',
  ESZAZ: 'Europe/Madrid',
  ESTUD: 'Europe/Madrid',
  ITNAP: 'Europe/Rome',
  MAPTM: 'Africa/Casablanca',
  PKKHI: 'Asia/Karachi',
  PKLHE: 'Asia/Karachi',
  SGSIN: 'Asia/Singapore',
}

const LOCATION_DISPLAY_TIMEZONES: Readonly<Record<string, string>> = {
  BARCELONA: 'Europe/Madrid',
  BEIRUT: 'Asia/Beirut',
  'ITAGUAI RJ': 'America/Sao_Paulo',
  'NAPLES IT': 'Europe/Rome',
  'PORT SAID EAST EG': 'Africa/Cairo',
  'PORT TANGIER MEDITERRANEE MA': 'Africa/Casablanca',
  QINGDAO: 'Asia/Shanghai',
  'QINGDAO CNTAO': 'Asia/Shanghai',
  KARACHI: 'Asia/Karachi',
  'KARACHI PAKISTAN': 'Asia/Karachi',
  LAHORE: 'Asia/Karachi',
  'LAHORE PAKISTAN': 'Asia/Karachi',
  SANTOS: 'America/Sao_Paulo',
  'SANTOS BR': 'America/Sao_Paulo',
  SINGAPORE: 'Asia/Singapore',
  'SINGAPORE SINGAPORE': 'Asia/Singapore',
  'TANGER MED': 'Africa/Casablanca',
  TUDELA: 'Europe/Madrid',
  ZARAGOZA: 'Europe/Madrid',
}

function normalizeLocationCode(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (normalized.length === 0) return null
  if (normalized.length >= 5) return normalized.slice(0, 5)
  return normalized
}

function normalizeLocationDisplay(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toUpperCase()

  return normalized.length === 0 ? null : normalized
}

function toRawEventTime(parts: readonly (string | null | undefined)[]): string | null {
  const normalized = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0)
    .join(' ')
    .trim()

  return normalized.length === 0 ? null : normalized
}

export function resolveTrackingEventTimezone(
  context: TrackingTemporalLocationContext,
): string | null {
  const normalizedCode = normalizeLocationCode(context.locationCode)
  if (normalizedCode) {
    const codeTimezone = LOCATION_CODE_TIMEZONES[normalizedCode]
    if (codeTimezone !== undefined) return codeTimezone
  }

  const normalizedDisplay = normalizeLocationDisplay(context.locationDisplay)
  if (normalizedDisplay) {
    const displayTimezone = LOCATION_DISPLAY_TIMEZONES[normalizedDisplay]
    if (displayTimezone !== undefined) return displayTimezone
  }

  return null
}

export function buildAbsoluteTrackingTemporal(args: {
  readonly instant: Instant | null
  readonly rawEventTime: string | null
}): TrackingTemporalResolution {
  return {
    event_time: args.instant === null ? null : instantValue(args.instant),
    raw_event_time: args.rawEventTime,
    event_time_source: args.instant === null ? null : 'carrier_explicit_timezone',
  }
}

export function buildDateOnlyTrackingTemporal(args: {
  readonly date: CalendarDate | null
  readonly rawEventTime: string | null
  readonly locationCode?: string | null | undefined
  readonly locationDisplay?: string | null | undefined
  readonly source?: EventTimeSource
}): TrackingTemporalResolution {
  if (args.date === null) {
    return {
      event_time: null,
      raw_event_time: args.rawEventTime,
      event_time_source: null,
    }
  }

  return {
    event_time: calendarDateValue(
      args.date,
      resolveTrackingEventTimezone({
        locationCode: args.locationCode,
        locationDisplay: args.locationDisplay,
      }),
    ),
    raw_event_time: args.rawEventTime,
    event_time_source: args.source ?? 'carrier_date_only',
  }
}

export function buildLocalDateTimeTrackingTemporal(args: {
  readonly localDateTime: string | null
  readonly rawEventTime: string | null
  readonly locationCode?: string | null | undefined
  readonly locationDisplay?: string | null | undefined
}): TrackingTemporalResolution {
  if (args.localDateTime === null) {
    return {
      event_time: null,
      raw_event_time: args.rawEventTime,
      event_time_source: null,
    }
  }

  const timezone = resolveTrackingEventTimezone({
    locationCode: args.locationCode,
    locationDisplay: args.locationDisplay,
  })

  if (timezone === null) {
    return buildDateOnlyTrackingTemporal({
      date: parseCalendarDateFromIso(args.localDateTime.slice(0, 10)),
      rawEventTime: args.rawEventTime,
      locationCode: args.locationCode,
      locationDisplay: args.locationDisplay,
      source: 'derived_fallback',
    })
  }

  const localDateTime = parseLocalDateTimeFromIso(args.localDateTime, timezone)
  if (localDateTime === null) {
    return {
      event_time: null,
      raw_event_time: args.rawEventTime,
      event_time_source: null,
    }
  }

  return {
    event_time: localDateTimeValue(localDateTime),
    raw_event_time: args.rawEventTime,
    event_time_source: 'carrier_local_port_time',
  }
}

export function composeTrackingRawEventTime(
  ...parts: readonly (string | null | undefined)[]
): string | null {
  return toRawEventTime(parts)
}
