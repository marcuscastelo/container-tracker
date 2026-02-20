// src/modules/search/interface/http/search.schemas.ts
//
// Zod schemas for the search HTTP boundary.
// Input validation + response shape definition.

import z from 'zod/v4'

/**
 * Query parameter schema for GET /api/search?q=...&limit=...
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().min(1).max(20).optional(),
})

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>

/**
 * Shape of a single search result item in the API response.
 */
export const SearchResultItemSchema = z.object({
  id: z.string(),
  type: z.enum(['process', 'container', 'importer', 'exporter', 'carrier']),
  title: z.string(),
  subtitle: z.string().nullable(),
  processId: z.string().nullable(),
  status: z.string().nullable(),
  carrier: z.string().nullable(),
})

/**
 * Full search response shape.
 */
export const SearchResponseSchema = z.object({
  items: z.array(SearchResultItemSchema),
  query: z.string(),
})

export type SearchResponseDto = z.infer<typeof SearchResponseSchema>
