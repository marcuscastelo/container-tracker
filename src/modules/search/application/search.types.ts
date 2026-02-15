// src/modules/search/application/search.types.ts
//
// Canonical types for the search read-model.
// These are projections — never domain entities.

/** Categories a search result can belong to. */
export type SearchResultType = 'process' | 'container' | 'importer' | 'exporter' | 'carrier'

/**
 * Lightweight projection returned by the search use case.
 * This is NOT a domain entity — it is a read-model item
 * designed for fast rendering in the UI.
 */
export type SearchResultItemProjection = {
  readonly id: string
  readonly type: SearchResultType
  readonly title: string
  readonly subtitle: string | null
  readonly processId: string | null
  readonly status: string | null
  readonly carrier: string | null
}

/**
 * The command accepted by the search use case.
 */
export type SearchQueryCommand = {
  readonly query: string
  readonly limit?: number
}

/**
 * The result returned by the search use case.
 */
export type SearchResult = {
  readonly items: readonly SearchResultItemProjection[]
  readonly query: string
}
