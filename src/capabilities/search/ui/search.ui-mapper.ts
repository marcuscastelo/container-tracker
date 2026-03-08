import type { SearchHttpResultItemDto } from '~/capabilities/search/interface/http/search.schemas'
import type { SearchResultItemVm } from '~/capabilities/search/ui/search.vm'

function toSearchResultItemVm(item: SearchHttpResultItemDto): SearchResultItemVm {
  return {
    processId: item.processId,
    processReference: item.processReference,
    importerName: item.importerName,
    containers: item.containers,
    carrier: item.carrier,
    vesselName: item.vesselName,
    bl: item.bl,
    derivedStatus: item.derivedStatus,
    eta: item.eta,
    matchSource: item.matchSource,
  }
}

export function toSearchResultItemsVm(
  items: readonly SearchHttpResultItemDto[],
): readonly SearchResultItemVm[] {
  return items.map(toSearchResultItemVm)
}
