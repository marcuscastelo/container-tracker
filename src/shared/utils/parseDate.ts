/**
 * Detailed parsed-date result so callers know exactly what form was parsed.
 */
export type ParsedDateResult =
  | { kind: 'null' }
  | { kind: 'invalid' }
  | { kind: 'date'; value: Date } // input was already a Date
  | { kind: 'number'; value: Date } // input was a numeric epoch
  | { kind: 'msString'; value: Date } // /Date(XXXXX)/ style
  | { kind: 'ddmmyyyy'; value: Date } // explicit dd/mm/yyyy (noon UTC)
  | { kind: 'isoString'; value: Date } // ISO / RFC parsable string

/**
 * Parse a string of the form dd/mm/yyyy and return a Date at noon UTC.
 * Returns null if the input doesn't match or creates an invalid date.
 */
export function parseDateDDMMYYYYString(input: string): Date | null {
  const dm = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!dm) return null
  const day = Number(dm[1])
  const month = Number(dm[2]) - 1
  const year = Number(dm[3])
  // Use noon UTC to avoid timezone rollbacks when converting to local time
  const d = new Date(Date.UTC(year, month, day, 12))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Parse MS /Date(1234567890)/ strings (common in some SOAP responses). */
export function parseMsDateString(input: string): Date | null {
  const msMatch = input.match(/\/Date\((-?\d+)\)\//)
  if (!msMatch) return null
  const ms = Number(msMatch[1])
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Parse ISO / RFC date strings using built-in Date parsing. */
export function parseIsoOrRfcString(input: string): Date | null {
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Parse numeric epoch (milliseconds) into Date. */
export function parseDateFromNumber(input: number): Date | null {
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}
