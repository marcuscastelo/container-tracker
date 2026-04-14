import { calendarDateFromInstant } from '~/shared/time/calendar-date';
export const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_INSTANT_CAPTURE_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;
function compareNumbers(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function normalizeIsoInstant(iso) {
    const match = iso.match(ISO_INSTANT_CAPTURE_PATTERN);
    if (!match || match[1] === undefined || match[3] === undefined) {
        throw new Error(`Invalid ISO instant: ${iso}`);
    }
    const fraction = match[2] ?? '';
    const normalizedFraction = `${fraction}000`.slice(0, 3);
    return `${match[1]}.${normalizedFraction}${match[3]}`;
}
export class Instant {
    epochMs;
    constructor(epochMs) {
        this.epochMs = epochMs;
    }
    static fromEpochMs(ms) {
        if (!Number.isFinite(ms)) {
            throw new Error('Invalid epoch milliseconds');
        }
        return new Instant(ms);
    }
    static fromIso(iso) {
        if (!ISO_INSTANT_PATTERN.test(iso)) {
            throw new Error(`Invalid ISO instant: ${iso}`);
        }
        const parsedMs = Date.parse(normalizeIsoInstant(iso));
        if (!Number.isFinite(parsedMs)) {
            throw new Error(`Invalid ISO instant: ${iso}`);
        }
        return Instant.fromEpochMs(parsedMs);
    }
    static now(clock) {
        if (clock)
            return clock.now();
        return Instant.fromEpochMs(Date.now());
    }
    toEpochMs() {
        return this.epochMs;
    }
    toIsoString() {
        return new Date(this.epochMs).toISOString();
    }
    compare(other) {
        return compareNumbers(this.epochMs, other.epochMs);
    }
    isBefore(other) {
        return this.compare(other) < 0;
    }
    isAfter(other) {
        return this.compare(other) > 0;
    }
    equals(other) {
        return this.compare(other) === 0;
    }
    diffMs(other) {
        return this.epochMs - other.epochMs;
    }
    toCalendarDate(timezone) {
        return calendarDateFromInstant(this, timezone);
    }
}
export function isInstant(value) {
    return value instanceof Instant;
}
