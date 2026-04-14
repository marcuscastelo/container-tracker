import { CalendarDate, resolveCalendarDateTimeToInstant } from '~/shared/time/calendar-date';
export const ISO_LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;
const LOCAL_DATE_TIME_CANONICAL_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\[(.+)\]$/;
function pad(value, size = 2) {
    return String(value).padStart(size, '0');
}
function normalizeMilliseconds(input) {
    if (input === undefined)
        return 0;
    const parsed = Number(`${input}000`.slice(0, 3));
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
        throw new Error(`Invalid local datetime milliseconds: ${input}`);
    }
    return parsed;
}
function validateTimePart(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Invalid local datetime ${label}: ${String(value)}`);
    }
}
export class LocalDateTime {
    date;
    hour;
    minute;
    second;
    millisecond;
    timezone;
    constructor(date, hour, minute, second, millisecond, timezone) {
        this.date = date;
        this.hour = hour;
        this.minute = minute;
        this.second = second;
        this.millisecond = millisecond;
        this.timezone = timezone;
    }
    static fromParts(args) {
        validateTimePart(args.hour, 0, 23, 'hour');
        validateTimePart(args.minute, 0, 59, 'minute');
        validateTimePart(args.second, 0, 59, 'second');
        validateTimePart(args.millisecond ?? 0, 0, 999, 'millisecond');
        return new LocalDateTime(args.date, args.hour, args.minute, args.second, args.millisecond ?? 0, args.timezone);
    }
    static fromIsoLocal(value, timezone) {
        const match = value.match(ISO_LOCAL_DATE_TIME_PATTERN);
        if (!match ||
            match[1] === undefined ||
            match[2] === undefined ||
            match[3] === undefined ||
            match[4] === undefined) {
            throw new Error(`Invalid ISO local datetime: ${value}`);
        }
        return LocalDateTime.fromParts({
            date: CalendarDate.fromIsoDate(match[1]),
            hour: Number(match[2]),
            minute: Number(match[3]),
            second: Number(match[4]),
            millisecond: normalizeMilliseconds(match[5]),
            timezone,
        });
    }
    static fromCanonicalString(value) {
        const match = value.match(LOCAL_DATE_TIME_CANONICAL_PATTERN);
        if (!match || match[1] === undefined || match[2] === undefined) {
            throw new Error(`Invalid canonical local datetime: ${value}`);
        }
        return LocalDateTime.fromIsoLocal(match[1], match[2]);
    }
    toIsoLocalString() {
        return `${this.date.toIsoDate()}T${pad(this.hour)}:${pad(this.minute)}:${pad(this.second)}.${pad(this.millisecond, 3)}`;
    }
    toCanonicalString() {
        return `${this.toIsoLocalString()}[${this.timezone}]`;
    }
    toInstant() {
        return resolveCalendarDateTimeToInstant({
            date: this.date,
            hour: this.hour,
            minute: this.minute,
            second: this.second,
            millisecond: this.millisecond,
            timezone: this.timezone,
        });
    }
    compare(other) {
        return this.toInstant().compare(other.toInstant());
    }
}
export function isLocalDateTime(value) {
    return value instanceof LocalDateTime;
}
