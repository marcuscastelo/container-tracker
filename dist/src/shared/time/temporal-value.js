export function instantValue(value) {
    return { kind: 'instant', value };
}
export function calendarDateValue(value, timezone = null) {
    return { kind: 'date', value, timezone };
}
export function localDateTimeValue(value) {
    return { kind: 'local-datetime', value };
}
