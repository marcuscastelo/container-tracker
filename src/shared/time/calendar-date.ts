import { Instant } from '~/shared/time/instant'

type TimeParts = {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly second: number
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  formatterCache.set(timezone, formatter)
  return formatter
}

function readPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const part = parts.find((candidate) => candidate.type === type)
  if (!part) {
    throw new Error(`Missing date part: ${type}`)
  }

  const value = Number(part.value)
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid date part: ${type}`)
  }

  return value
}

function formatEpochMsParts(epochMs: number, timezone: string): TimeParts {
  const parts = getFormatter(timezone).formatToParts(new Date(epochMs))

  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
    hour: readPart(parts, 'hour'),
    minute: readPart(parts, 'minute'),
    second: readPart(parts, 'second'),
  }
}

function compareTimeParts(a: TimeParts, b: TimeParts): number {
  const aUtc = Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute, a.second)
  const bUtc = Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute, b.second)

  if (aUtc < bUtc) return -1
  if (aUtc > bUtc) return 1
  return 0
}

function resolveEpochMsForTimezone(desired: TimeParts, timezone: string): number {
  let guess = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  )

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const actual = formatEpochMsParts(guess, timezone)
    const delta =
      Date.UTC(
        desired.year,
        desired.month - 1,
        desired.day,
        desired.hour,
        desired.minute,
        desired.second,
      ) -
      Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second)

    if (delta === 0) {
      return guess
    }

    guess += delta
  }

  const resolved = formatEpochMsParts(guess, timezone)
  if (compareTimeParts(resolved, desired) !== 0) {
    throw new Error(`Unable to resolve timezone boundary for ${timezone}`)
  }

  return guess
}

function validateDateParts(year: number, month: number, day: number): void {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('CalendarDate parts must be integers')
  }

  const candidate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${year}-${pad(month)}-${pad(day)}`)
  }
}

export class CalendarDate {
  private constructor(
    private readonly year: number,
    private readonly month: number,
    private readonly day: number,
  ) {}

  static fromIsoDate(iso: string): CalendarDate {
    if (!ISO_DATE_PATTERN.test(iso)) {
      throw new Error(`Invalid ISO calendar date: ${iso}`)
    }

    const [yearPart, monthPart, dayPart] = iso.split('-')
    const year = Number(yearPart)
    const month = Number(monthPart)
    const day = Number(dayPart)
    validateDateParts(year, month, day)

    return new CalendarDate(year, month, day)
  }

  toIsoDate(): string {
    return `${String(this.year).padStart(4, '0')}-${pad(this.month)}-${pad(this.day)}`
  }

  compare(other: CalendarDate): number {
    return this.toIsoDate().localeCompare(other.toIsoDate())
  }

  equals(other: CalendarDate): boolean {
    return this.compare(other) === 0
  }

  startOfDay(timezone: string): Instant {
    return Instant.fromEpochMs(
      resolveEpochMsForTimezone(
        {
          year: this.year,
          month: this.month,
          day: this.day,
          hour: 0,
          minute: 0,
          second: 0,
        },
        timezone,
      ),
    )
  }

  endOfDay(timezone: string): Instant {
    return Instant.fromEpochMs(this.addDays(1).startOfDay(timezone).toEpochMs() - 1)
  }

  private addDays(days: number): CalendarDate {
    const base = new Date(Date.UTC(this.year, this.month - 1, this.day + days, 0, 0, 0))
    return CalendarDate.fromIsoDate(
      `${String(base.getUTCFullYear()).padStart(4, '0')}-${pad(base.getUTCMonth() + 1)}-${pad(
        base.getUTCDate(),
      )}`,
    )
  }
}

export function calendarDateFromInstant(instant: Instant, timezone: string): CalendarDate {
  const parts = formatEpochMsParts(instant.toEpochMs(), timezone)
  return CalendarDate.fromIsoDate(
    `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`,
  )
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  return value instanceof CalendarDate
}
