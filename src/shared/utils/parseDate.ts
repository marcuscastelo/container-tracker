import {
  parseCalendarDateFromDdMmYyyy,
  parseInstantFromMsDate,
  parseInstantFromNumber,
  parseInstantFromTimestampText,
} from '~/shared/time/parsing'

export function parseDateDDMMYYYYString(input: string) {
  return parseCalendarDateFromDdMmYyyy(input)
}

export function parseMsDateString(input: string) {
  return parseInstantFromMsDate(input)
}

export function parseIsoOrRfcString(input: string) {
  return parseInstantFromTimestampText(input)
}

export function parseDateFromNumber(input: number) {
  return parseInstantFromNumber(input)
}
