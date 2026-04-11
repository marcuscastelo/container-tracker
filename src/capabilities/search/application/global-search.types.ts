import type { TrackingOperationalAlertCategory } from '~/modules/tracking/features/alerts/application/projection/tracking.operational-alert-category.readmodel'
import type { TemporalValueDto } from '~/shared/time/dto'

export type GlobalSearchFilterKey =
  | 'process'
  | 'process_id'
  | 'container'
  | 'bl'
  | 'importer'
  | 'exporter'
  | 'carrier'
  | 'vessel'
  | 'voyage'
  | 'status'
  | 'origin'
  | 'origin_country'
  | 'destination'
  | 'destination_country'
  | 'terminal'
  | 'depot'
  | 'route'
  | 'eta'
  | 'eta_before'
  | 'eta_after'
  | 'eta_month'
  | 'eta_state'
  | 'eta_type'
  | 'current_location'
  | 'current_vessel'
  | 'current_voyage'
  | 'validation'
  | 'alert_category'
  | 'event_date'

export type SupportedGlobalSearchFilterKey = Exclude<GlobalSearchFilterKey, 'event_date'>

export type GlobalSearchFilterSource = 'draft' | 'chip'

export type GlobalSearchTermKind = 'text' | 'date-day-month' | 'date-full'

export type GlobalSearchFreeTextTerm = Readonly<{
  rawValue: string
  normalizedValue: string
  kind: GlobalSearchTermKind
}>

export type ParsedGlobalSearchFilter = Readonly<{
  key: GlobalSearchFilterKey
  rawKey: string
  rawValue: string
  normalizedValue: string
  source: GlobalSearchFilterSource
  supported: boolean
}>

export type ParsedGlobalSearchQuery = Readonly<{
  raw: string
  freeTextTerms: readonly GlobalSearchFreeTextTerm[]
  filters: readonly ParsedGlobalSearchFilter[]
  warnings: readonly string[]
}>

export type GlobalSearchDocumentResolvedValue = Readonly<{
  value: string | null
  multiple: boolean
}>

export type GlobalSearchDocument = Readonly<{
  processId: string
  processReference: string | null
  billOfLading: string | null
  importerName: string | null
  exporterName: string | null
  carrierName: string | null
  statusCode: string | null
  eta: TemporalValueDto | null
  etaStates: readonly string[]
  etaTypes: readonly string[]
  originLabel: string | null
  originCountryTokens: readonly string[]
  destinationLabel: string | null
  destinationCountryTokens: readonly string[]
  depotLabel: string | null
  routeLabel: string | null
  routeDisplays: readonly string[]
  containerNumbers: readonly string[]
  terminalLabels: readonly string[]
  terminalDisplay: GlobalSearchDocumentResolvedValue
  currentLocations: readonly string[]
  currentLocationDisplay: GlobalSearchDocumentResolvedValue
  currentVessels: readonly string[]
  currentVesselDisplay: GlobalSearchDocumentResolvedValue
  currentVoyages: readonly string[]
  currentVoyageDisplay: GlobalSearchDocumentResolvedValue
  hasValidationRequired: boolean
  activeAlertCategories: readonly TrackingOperationalAlertCategory[]
}>

export type GlobalSearchMatchBucket =
  | 'strong_identifier_exact'
  | 'strong_identifier_prefix'
  | 'date_exact'
  | 'structured_exact'
  | 'text_prefix'
  | 'text_contains'

export type GlobalSearchMatch = Readonly<{
  key: SupportedGlobalSearchFilterKey | 'free_text'
  source: 'filter' | 'free_text'
  matchedValue: string
  rawQueryValue: string
  bucket: GlobalSearchMatchBucket
}>

export type GlobalSearchResult = Readonly<{
  processId: string
  processReference: string | null
  billOfLading: string | null
  importerName: string | null
  exporterName: string | null
  carrierName: string | null
  statusCode: string | null
  eta: TemporalValueDto | null
  etaState: string | null
  etaType: string | null
  originLabel: string | null
  destinationLabel: string | null
  terminalLabel: string | null
  terminalMultiple: boolean
  depotLabel: string | null
  routeLabel: string | null
  containerNumbers: readonly string[]
  currentLocationLabel: string | null
  currentLocationMultiple: boolean
  currentVesselName: string | null
  currentVesselMultiple: boolean
  currentVoyageNumber: string | null
  currentVoyageMultiple: boolean
  hasValidationRequired: boolean
  activeAlertCategories: readonly TrackingOperationalAlertCategory[]
  matchedBy: readonly GlobalSearchMatch[]
}>

export type GlobalSearchEmptyState = Readonly<{
  titleKey: string
  descriptionKey: string
  examples: readonly string[]
}>

export type GlobalSearchResponse = Readonly<{
  query: ParsedGlobalSearchQuery
  results: readonly GlobalSearchResult[]
  emptyState: GlobalSearchEmptyState
}>

export type GlobalSearchSuggestion = Readonly<{
  kind: 'field' | 'value' | 'example'
  fieldKey: SupportedGlobalSearchFilterKey | null
  value: string | null
  labelKey: string | null
  fallbackLabel: string
  descriptionKey: string | null
  insertText: string
}>

export type GlobalSearchSuggestionsResponse = Readonly<{
  query: ParsedGlobalSearchQuery
  suggestions: readonly GlobalSearchSuggestion[]
}>
