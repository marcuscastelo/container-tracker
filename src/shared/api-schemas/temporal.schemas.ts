import { z } from 'zod'
import { ISO_INSTANT_PATTERN } from '~/shared/time/instant'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const InstantDtoSchema = z.object({
  kind: z.literal('instant'),
  value: z.string().regex(ISO_INSTANT_PATTERN),
})

export const CalendarDateDtoSchema = z.object({
  kind: z.literal('date'),
  value: z.string().regex(ISO_DATE_PATTERN),
})

export const TemporalValueDtoSchema = z.discriminatedUnion('kind', [
  InstantDtoSchema,
  CalendarDateDtoSchema,
])
