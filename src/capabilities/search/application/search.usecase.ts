export type SearchMatchSource =
  | 'container'
  | 'process'
  | 'importer'
  | 'bl'
  | 'vessel'
  | 'status'
  | 'carrier'

export type SearchCommand = {
  readonly query: string
}

export type SearchResultItem = {
  readonly processId: string
  readonly processReference: string | null
  readonly importerName: string | null
  readonly containers: readonly string[]
  readonly carrier: string | null
  readonly vesselName: string | null
  readonly bl: string | null
  readonly derivedStatus: string | null
  readonly eta: string | null
  readonly matchSource: SearchMatchSource
}

export type SearchUseCase = (command: SearchCommand) => Promise<readonly SearchResultItem[]>

export function createSearchUseCase(): SearchUseCase {
  return async function search(): Promise<readonly SearchResultItem[]> {
    return []
  }
}
