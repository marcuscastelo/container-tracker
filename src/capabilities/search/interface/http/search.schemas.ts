// src/modules/search/interface/http/search.schemas.ts
//
// Zod schemas for the search HTTP boundary.
// Input validation + response shape definition.

import z from 'zod/v4'

/**
 * Query parameter schema for GET /api/search?q=...
 *
 * Ctrl+K endpoint only maps `q` to `SearchCommand`.
 */
export const SearchHttpQuerySchema = z.object({
  q: z.string().optional().default(''),
})

export const SearchHttpMatchSourceSchema = z.enum([
  'container',
  'process',
  'importer',
  'bl',
  'vessel',
  'status',
  'carrier',
])

export const SearchHttpResultItemSchema = z.object({
  processId: z.string(),
  processReference: z.string().nullable(),
  importerName: z.string().nullable(),
  containers: z.array(z.string()),
  carrier: z.string().nullable(),
  vesselName: z.string().nullable(),
  bl: z.string().nullable(),
  derivedStatus: z.string().nullable(),
  eta: z.string().nullable(),
  matchSource: SearchHttpMatchSourceSchema,
})

export const SearchHttpResponseSchema = z.array(SearchHttpResultItemSchema)

export type SearchHttpQueryInput = z.infer<typeof SearchHttpQuerySchema>
export type SearchHttpResultItemDto = z.infer<typeof SearchHttpResultItemSchema>
export type SearchHttpResponseDto = z.infer<typeof SearchHttpResponseSchema>

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
