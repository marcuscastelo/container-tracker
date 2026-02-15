// src/modules/search/application/search.usecases.ts
//
// Search use case factory.
// Accepts a SearchRepository port and returns the search use case.

import type { SearchRepository } from '~/modules/search/application/search.repository'
import type { SearchQueryCommand, SearchResult } from '~/modules/search/application/search.types'

const DEFAULT_LIMIT = 20
const MIN_QUERY_LENGTH = 2

export type SearchUseCasesDeps = {
  readonly repository: SearchRepository
}

export function createSearchUseCases(deps: SearchUseCasesDeps) {
  const { repository } = deps

  /**
   * Execute a global search across processes, containers, importers, etc.
   *
   * Rules:
   * - Query must be at least 2 characters
   * - Limit capped at 20
   * - Returns grouped projections (no domain entities)
   */
  async function search(command: SearchQueryCommand): Promise<SearchResult> {
    const trimmed = command.query.trim()

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return { items: [], query: trimmed }
    }

    const limit = Math.min(command.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT)
    const items = await repository.search(trimmed, limit)

    return { items, query: trimmed }
  }

  return { search }
}

export type SearchUseCases = ReturnType<typeof createSearchUseCases>
