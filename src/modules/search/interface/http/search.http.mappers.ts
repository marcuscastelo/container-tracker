// src/modules/search/interface/http/search.http.mappers.ts
//
// Mappers between search use case results and HTTP response DTOs.

import type { SearchResult } from '~/modules/search/application/search.types'
import type { SearchResponseDto } from '~/modules/search/interface/http/search.schemas'

/**
 * Maps the use-case SearchResult to the HTTP response DTO.
 * The projection is already lightweight, so this is a thin pass-through.
 */
export function toSearchResponseDto(result: SearchResult): SearchResponseDto {
  return {
    items: result.items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle,
      processId: item.processId,
      status: item.status,
      carrier: item.carrier,
    })),
    query: result.query,
  }
}
