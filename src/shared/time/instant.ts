import type { CalendarDate } from '~/shared/time/calendar-date'
import { calendarDateFromInstant } from '~/shared/time/calendar-date'
import type { Clock } from '~/shared/time/clock'

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function compareNumbers(a: number, b: number): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export class Instant {
  private constructor(private readonly epochMs: number) {}

  static fromEpochMs(ms: number): Instant {
    if (!Number.isFinite(ms)) {
      throw new Error('Invalid epoch milliseconds')
    }

    return new Instant(ms)
  }

  static fromIso(iso: string): Instant {
    if (!ISO_INSTANT_PATTERN.test(iso)) {
      throw new Error(`Invalid ISO instant: ${iso}`)
    }

    const parsedMs = Date.parse(iso)
    if (!Number.isFinite(parsedMs)) {
      throw new Error(`Invalid ISO instant: ${iso}`)
    }

    return Instant.fromEpochMs(parsedMs)
  }

  static now(clock?: Clock): Instant {
    if (clock) return clock.now()
    return Instant.fromEpochMs(Date.now())
  }

  toEpochMs(): number {
    return this.epochMs
  }

  toIsoString(): string {
    return new Date(this.epochMs).toISOString()
  }

  compare(other: Instant): number {
    return compareNumbers(this.epochMs, other.epochMs)
  }

  isBefore(other: Instant): boolean {
    return this.compare(other) < 0
  }

  isAfter(other: Instant): boolean {
    return this.compare(other) > 0
  }

  equals(other: Instant): boolean {
    return this.compare(other) === 0
  }

  diffMs(other: Instant): number {
    return this.epochMs - other.epochMs
  }

  toCalendarDate(timezone: string): CalendarDate {
    return calendarDateFromInstant(this, timezone)
  }
}

export function isInstant(value: unknown): value is Instant {
  return value instanceof Instant
}
