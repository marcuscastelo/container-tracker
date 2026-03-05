// src/modules/search/ui/search.viewmodel.ts
//
// ViewModel types for the search UI.
// Maps from SearchResponseDto to UI-friendly shapes.

export type SearchResultType = 'process' | 'container' | 'importer' | 'exporter' | 'carrier'

export type SearchResultViewModel = {
  readonly id: string
  readonly type: SearchResultType
  readonly title: string
  readonly subtitle: string | null
  readonly processId: string | null
  readonly status: string | null
  readonly carrier: string | null
}

export type SearchResultGroup = {
  readonly type: SearchResultType
  readonly label: string
  readonly items: readonly SearchResultViewModel[]
}

/**
 * Groups flat search results by type for grouped rendering.
 */
export function groupSearchResults(
  items: readonly SearchResultViewModel[],
  labelMap: Record<SearchResultType, string>,
): readonly SearchResultGroup[] {
  const order: readonly SearchResultType[] = [
    'container',
    'process',
    'importer',
    'exporter',
    'carrier',
  ]

  const groups = new Map<SearchResultType, SearchResultViewModel[]>()

  for (const item of items) {
    const existing = groups.get(item.type)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(item.type, [item])
    }
  }

  const result: SearchResultGroup[] = []
  for (const type of order) {
    const groupItems = groups.get(type)
    if (groupItems && groupItems.length > 0) {
      result.push({
        type,
        label: labelMap[type],
        items: groupItems,
      })
    }
  }

  return result
}
