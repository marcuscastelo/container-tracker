import {
  parseCalendarDateFromDdMmYyyy,
  parseInstantFromMsDate,
  parseInstantFromNumber,
  parseInstantFromText,
} from '~/shared/time/parsing'

export function parseDateDDMMYYYYString(input: string) {
  return parseCalendarDateFromDdMmYyyy(input)
}

export function parseMsDateString(input: string) {
  return parseInstantFromMsDate(input)
}

export function parseIsoOrRfcString(input: string) {
  return parseInstantFromText(input)
}

export function parseDateFromNumber(input: number) {
  return parseInstantFromNumber(input)
}
