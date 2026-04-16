import { z } from 'zod'
import { ISO_INSTANT_PATTERN } from '~/shared/time/instant'
import { ISO_LOCAL_DATE_TIME_PATTERN } from '~/shared/time/local-date-time'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const InstantDtoSchema = z.object({
  kind: z.literal('instant'),
  value: z.string().regex(ISO_INSTANT_PATTERN),
})

const CalendarDateDtoSchema = z.object({
  kind: z.literal('date'),
  value: z.string().regex(ISO_DATE_PATTERN),
  timezone: z.string().nullable().optional(),
})

const LocalDateTimeDtoSchema = z.object({
  kind: z.literal('local-datetime'),
  value: z.string().regex(ISO_LOCAL_DATE_TIME_PATTERN),
  timezone: z.string(),
})

export const TemporalValueDtoSchema = z.discriminatedUnion('kind', [
  InstantDtoSchema,
  CalendarDateDtoSchema,
  LocalDateTimeDtoSchema,
])
