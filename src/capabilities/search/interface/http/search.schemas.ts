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

const SearchHttpMatchSourceSchema = z.enum([
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

export type SearchHttpResultItemDto = z.infer<typeof SearchHttpResultItemSchema>
export type SearchHttpResponseDto = z.infer<typeof SearchHttpResponseSchema>
