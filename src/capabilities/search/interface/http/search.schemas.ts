import z from 'zod/v4'
import { TemporalValueDtoSchema } from '~/shared/api-schemas/temporal.schemas'

export const SearchHttpQuerySchema = z.object({
  q: z.string().optional().default(''),
  filter: z.array(z.string()).optional().default([]),
})

const SearchHttpParsedFreeTextTermSchema = z.object({
  rawValue: z.string(),
  normalizedValue: z.string(),
  kind: z.enum(['text', 'date-day-month', 'date-full']),
})

const SearchHttpParsedFilterSchema = z.object({
  key: z.string(),
  rawKey: z.string(),
  rawValue: z.string(),
  normalizedValue: z.string(),
  source: z.enum(['draft', 'chip']),
  supported: z.boolean(),
})

const SearchHttpParsedQuerySchema = z.object({
  raw: z.string(),
  freeTextTerms: z.array(SearchHttpParsedFreeTextTermSchema),
  filters: z.array(SearchHttpParsedFilterSchema),
  warnings: z.array(z.string()),
})

const SearchHttpMatchSchema = z.object({
  key: z.string(),
  source: z.enum(['filter', 'free_text']),
  matchedValue: z.string(),
  rawQueryValue: z.string(),
  bucket: z.enum([
    'strong_identifier_exact',
    'strong_identifier_prefix',
    'date_exact',
    'structured_exact',
    'text_prefix',
    'text_contains',
  ]),
})

export const SearchHttpResultItemSchema = z.object({
  processId: z.string(),
  processReference: z.string().nullable(),
  billOfLading: z.string().nullable(),
  importerName: z.string().nullable(),
  exporterName: z.string().nullable(),
  carrierName: z.string().nullable(),
  statusCode: z.string().nullable(),
  eta: TemporalValueDtoSchema.nullable(),
  etaState: z.string().nullable(),
  etaType: z.string().nullable(),
  originLabel: z.string().nullable(),
  destinationLabel: z.string().nullable(),
  terminalLabel: z.string().nullable(),
  terminalMultiple: z.boolean(),
  depotLabel: z.string().nullable(),
  routeLabel: z.string().nullable(),
  containerNumbers: z.array(z.string()),
  currentLocationLabel: z.string().nullable(),
  currentLocationMultiple: z.boolean(),
  currentVesselName: z.string().nullable(),
  currentVesselMultiple: z.boolean(),
  currentVoyageNumber: z.string().nullable(),
  currentVoyageMultiple: z.boolean(),
  hasValidationRequired: z.boolean(),
  activeAlertCategories: z.array(z.enum(['eta', 'movement', 'customs', 'status', 'data'])),
  matchedBy: z.array(SearchHttpMatchSchema),
})

const SearchHttpEmptyStateSchema = z.object({
  titleKey: z.string(),
  descriptionKey: z.string(),
  examples: z.array(z.string()),
})

export const SearchHttpResponseSchema = z.object({
  query: SearchHttpParsedQuerySchema,
  results: z.array(SearchHttpResultItemSchema),
  emptyState: SearchHttpEmptyStateSchema,
})

export const SearchSuggestionHttpItemSchema = z.object({
  kind: z.enum(['field', 'value', 'example']),
  fieldKey: z.string().nullable(),
  value: z.string().nullable(),
  labelKey: z.string().nullable(),
  fallbackLabel: z.string(),
  descriptionKey: z.string().nullable(),
  insertText: z.string(),
})

export const SearchSuggestionsHttpResponseSchema = z.object({
  query: SearchHttpParsedQuerySchema,
  suggestions: z.array(SearchSuggestionHttpItemSchema),
})

export type SearchHttpResponseDto = z.infer<typeof SearchHttpResponseSchema>
export type SearchHttpResultItemDto = z.infer<typeof SearchHttpResultItemSchema>
export type SearchSuggestionsHttpResponseDto = z.infer<typeof SearchSuggestionsHttpResponseSchema>
export type SearchSuggestionHttpItemDto = z.infer<typeof SearchSuggestionHttpItemSchema>
