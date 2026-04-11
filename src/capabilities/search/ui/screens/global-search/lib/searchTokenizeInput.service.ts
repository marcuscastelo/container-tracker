import { resolveGlobalSearchFieldAlias } from '~/capabilities/search/application/global-search.fields'
import type { SupportedGlobalSearchFilterKey } from '~/capabilities/search/application/global-search.types'

export type SearchComposerChip = Readonly<{
  key: SupportedGlobalSearchFilterKey
  value: string
}>

export function formatSearchComposerChip(chip: SearchComposerChip): string {
  return `${chip.key}:${chip.value}`
}

export function tryParseDraftFilterToken(draft: string): SearchComposerChip | null {
  const separatorIndex = draft.indexOf(':')
  if (separatorIndex <= 0) return null

  const rawKey = draft.slice(0, separatorIndex).trim()
  const rawValue = draft.slice(separatorIndex + 1).trim()
  if (rawKey.length === 0 || rawValue.length === 0) return null

  const resolvedKey = resolveGlobalSearchFieldAlias(rawKey)
  if (resolvedKey === null || resolvedKey === 'event_date') return null

  return {
    key: resolvedKey,
    value: rawValue,
  }
}
