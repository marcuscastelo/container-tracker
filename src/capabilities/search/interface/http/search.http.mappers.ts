// src/modules/search/interface/http/search.http.mappers.ts
//
// Mappers between search use case results and HTTP response DTOs.

import type { SearchResultItem } from '~/capabilities/search/application/search.usecase'
import type {
  SearchHttpResponseDto,
  SearchHttpResultItemDto,
} from '~/capabilities/search/interface/http/search.schemas'

function toSearchHttpResultItemDto(item: SearchResultItem): SearchHttpResultItemDto {
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
