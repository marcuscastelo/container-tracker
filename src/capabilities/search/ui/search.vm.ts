import type { SearchResultItem } from '~/capabilities/search/application/search.usecase'

export type SearchResultItemVm = {
  readonly processId: string
  readonly processReference: string | null
  readonly importerName: string | null
  readonly containers: readonly string[]
  readonly carrier: string | null
  readonly vesselName: string | null
  readonly bl: string | null
  readonly derivedStatus: string | null
  readonly eta: string | null
  readonly matchSource: SearchResultItem['matchSource']
}

export function toSearchResultItemVm(item: SearchResultItem): SearchResultItemVm {
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
