// src/modules/search/interface/http/search.http.mappers.ts
//
// Mappers between search use case results and HTTP response DTOs.

import type { SearchResult } from '~/capabilities/search/application/search.types'
import type { SearchResultItem } from '~/capabilities/search/application/search.usecase'
import type {
  SearchHttpResponseDto,
  SearchHttpResultItemDto,
  SearchResponseDto,
} from '~/capabilities/search/interface/http/search.schemas'

export function toSearchHttpResultItemDto(item: SearchResultItem): SearchHttpResultItemDto {
  return {
    processId: item.processId,
    processReference: item.processReference,
    importerName: item.importerName,
    containers: [...item.containers],
    carrier: item.carrier,
    vesselName: item.vesselName,
    bl: item.bl,
    derivedStatus: item.derivedStatus,
    eta: item.eta,
    matchSource: item.matchSource,
  }
}

export function toSearchHttpResponseDto(items: readonly SearchResultItem[]): SearchHttpResponseDto {
  return items.map(toSearchHttpResultItemDto)
}

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
