export type GlobalSearchUiState = 'loading' | 'empty' | 'error' | 'ready'

export type GlobalSearchFilterChipVM = Readonly<{
  key: string
  value: string
  label: string
}>

export type GlobalSearchSuggestionVM = Readonly<{
  kind: 'field' | 'value' | 'example'
  fieldKey: string | null
  value: string | null
  label: string
  description: string | null
  insertText: string
}>

export type GlobalSearchMetaItemVM = Readonly<{
  label: string
  value: string
}>

export type GlobalSearchResultItemVM = Readonly<{
  processId: string
  title: string
  supportingId: string
  matchSummary: readonly string[]
  badges: readonly string[]
  meta: readonly GlobalSearchMetaItemVM[]
}>

export type GlobalSearchResponseVM = Readonly<{
  items: readonly GlobalSearchResultItemVM[]
  emptyTitle: string
  emptyDescription: string
  emptyExamples: readonly string[]
}>
