import {
  getSupportedGlobalSearchFieldDefinition,
  listEnumOptionsForField,
  listSupportedGlobalSearchFields,
  normalizeSearchAlias,
} from '~/capabilities/search/application/global-search.fields'
import type {
  GlobalSearchDocument,
  GlobalSearchMatch,
  GlobalSearchMatchBucket,
  GlobalSearchResponse,
  GlobalSearchResult,
  GlobalSearchSuggestion,
  GlobalSearchSuggestionsResponse,
  ParsedGlobalSearchFilter,
  SupportedGlobalSearchFilterKey,
} from '~/capabilities/search/application/global-search.types'
import {
  buildGlobalSearchDocuments,
  type SearchProcessRecord,
} from '~/capabilities/search/application/global-search-documents'
import { parseGlobalSearchQuery } from '~/capabilities/search/application/parse-global-search-query'
import type { TrackingGlobalSearchProjection } from '~/modules/tracking/application/projection/tracking.global-search.readmodel'
import type { TrackingActiveAlertReadModel } from '~/modules/tracking/features/alerts/application/projection/tracking.active-alert.readmodel'
import { compareTemporal } from '~/shared/time/compare-temporal'
import type { TemporalValueDto } from '~/shared/time/dto'
import { parseCalendarDateFromDdMmYyyy, parseTemporalValue } from '~/shared/time/parsing'

const SEARCH_RESULTS_LIMIT = 30
const SEARCH_SUGGESTIONS_LIMIT = 8
const TEMPORAL_COMPARE_OPTIONS = {
  timezone: 'UTC',
  strategy: 'start-of-day',
} as const

const SEARCHABLE_FREE_TEXT_FIELDS: readonly SupportedGlobalSearchFilterKey[] = [
  'process',
  'process_id',
  'container',
  'bl',
  'importer',
  'exporter',
  'carrier',
  'vessel',
  'voyage',
  'status',
  'origin',
  'origin_country',
  'destination',
  'destination_country',
  'terminal',
  'depot',
  'route',
  'eta',
  'eta_state',
  'eta_type',
  'current_location',
  'current_vessel',
  'current_voyage',
  'validation',
  'alert_category',
]

type SearchProcessUseCases = {
  listProcessesWithOperationalSummary(): Promise<{
    readonly processes: readonly SearchProcessRecord[]
  }>
}

type SearchTrackingUseCases = {
  listGlobalSearchProjections(): Promise<readonly TrackingGlobalSearchProjection[]>
  listActiveAlertReadModel(): Promise<{
    readonly alerts: readonly TrackingActiveAlertReadModel[]
  }>
}

export type SearchCommand = Readonly<{
  query: string
  filters?: readonly string[]
}>

export type SearchSuggestionsCommand = Readonly<{
  query: string
  filters?: readonly string[]
}>

export type SearchUseCase = (command: SearchCommand) => Promise<GlobalSearchResponse>
export type SearchSuggestionsUseCase = (
  command: SearchSuggestionsCommand,
) => Promise<GlobalSearchSuggestionsResponse>

export type CreateSearchUseCaseDeps = Readonly<{
  processUseCases: SearchProcessUseCases
  trackingUseCases: SearchTrackingUseCases
}>

type RankedSearchResult = Readonly<{
  result: GlobalSearchResult
  matches: readonly GlobalSearchMatch[]
}>

function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const normalized = value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function dedupeMatches(matches: readonly GlobalSearchMatch[]): readonly GlobalSearchMatch[] {
  const byKey = new Map<string, GlobalSearchMatch>()

  for (const match of matches) {
    const signature = [
      match.key,
      match.source,
      match.bucket,
      normalizeText(match.matchedValue) ?? match.matchedValue,
    ].join(':')

    if (!byKey.has(signature)) {
      byKey.set(signature, match)
    }
  }

  return Array.from(byKey.values())
}

function toEmptyState() {
  return {
    titleKey: 'search.empty.title',
    descriptionKey: 'search.empty.description',
    examples: [
      'container:MSKU1234567',
      'status:DELIVERED importer:Flush',
      'eta:06/05/2026',
      'eta_state:ACTIVE_EXPECTED',
      'terminal:Movecta',
    ],
  } as const
}

function parseDayMonth(value: string): Readonly<{
  day: number
  month: number
}> | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/)
  if (match === null) return null

  const dayPart = match[1]
  const monthPart = match[2]
  if (dayPart === undefined || monthPart === undefined) return null

  const day = Number(dayPart)
  const month = Number(monthPart)
  if (!Number.isInteger(day) || !Number.isInteger(month)) return null
  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  return { day, month }
}

function parseMonth(value: string): Readonly<{
  month: number
  year: number
}> | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{4})$/)
  if (match === null) return null

  const monthPart = match[1]
  const yearPart = match[2]
  if (monthPart === undefined || yearPart === undefined) return null

  const month = Number(monthPart)
  const year = Number(yearPart)
  if (!Number.isInteger(month) || !Number.isInteger(year)) return null
  if (month < 1 || month > 12) return null

  return { month, year }
}

function toDateParts(value: TemporalValueDto | null): Readonly<{
  year: number
  month: number
  day: number
}> | null {
  if (value === null) return null

  const parsed = parseTemporalValue(value)
  if (parsed === null) return null

  if (parsed.kind === 'date') {
    const [yearPart, monthPart, dayPart] = parsed.value.toIsoDate().split('-')
    if (yearPart === undefined || monthPart === undefined || dayPart === undefined) return null
    return {
      year: Number(yearPart),
      month: Number(monthPart),
      day: Number(dayPart),
    }
  }

  if (parsed.kind === 'local-datetime') {
    const [yearPart, monthPart, dayPart] = parsed.value.date.toIsoDate().split('-')
    if (yearPart === undefined || monthPart === undefined || dayPart === undefined) return null
    return {
      year: Number(yearPart),
      month: Number(monthPart),
      day: Number(dayPart),
    }
  }

  const calendarDate = parsed.value.toCalendarDate('UTC')
  const [yearPart, monthPart, dayPart] = calendarDate.toIsoDate().split('-')
  if (yearPart === undefined || monthPart === undefined || dayPart === undefined) return null

  return {
    year: Number(yearPart),
    month: Number(monthPart),
    day: Number(dayPart),
  }
}

function toMatchedValue(value: string | null | undefined): string | null {
  return value === undefined ? null : value
}

function createMatch(command: {
  readonly key: SupportedGlobalSearchFilterKey | 'free_text'
  readonly source: 'filter' | 'free_text'
  readonly matchedValue: string
  readonly rawQueryValue: string
  readonly bucket: GlobalSearchMatchBucket
}): GlobalSearchMatch {
  return {
    key: command.key,
    source: command.source,
    matchedValue: command.matchedValue,
    rawQueryValue: command.rawQueryValue,
    bucket: command.bucket,
  }
}

function matchTextCandidate(command: {
  readonly key: SupportedGlobalSearchFilterKey
  readonly source: 'filter' | 'free_text'
  readonly rawQueryValue: string
  readonly normalizedQueryValue: string
  readonly candidate: string | null | undefined
  readonly exactBucket?: GlobalSearchMatchBucket
}): readonly GlobalSearchMatch[] {
  const matchedValue = toMatchedValue(command.candidate)
  const normalizedCandidate = normalizeText(matchedValue)
  if (matchedValue === null || normalizedCandidate === null) return []

  if (normalizedCandidate === command.normalizedQueryValue) {
    return [
      createMatch({
        key: command.key,
        source: command.source,
        matchedValue,
        rawQueryValue: command.rawQueryValue,
        bucket:
          command.source === 'filter'
            ? (command.exactBucket ?? 'structured_exact')
            : (command.exactBucket ?? 'text_prefix'),
      }),
    ]
  }

  if (normalizedCandidate.startsWith(command.normalizedQueryValue)) {
    return [
      createMatch({
        key: command.key,
        source: command.source,
        matchedValue,
        rawQueryValue: command.rawQueryValue,
        bucket: command.source === 'filter' ? 'text_prefix' : 'text_prefix',
      }),
    ]
  }

  if (normalizedCandidate.includes(command.normalizedQueryValue)) {
    return [
      createMatch({
        key: command.key,
        source: command.source,
        matchedValue,
        rawQueryValue: command.rawQueryValue,
        bucket: 'text_contains',
      }),
    ]
  }

  return []
}

function matchTextCandidates(command: {
  readonly key: SupportedGlobalSearchFilterKey
  readonly source: 'filter' | 'free_text'
  readonly rawQueryValue: string
  readonly normalizedQueryValue: string
  readonly candidates: readonly (string | null | undefined)[]
  readonly exactBucket?: GlobalSearchMatchBucket
}): readonly GlobalSearchMatch[] {
  return dedupeMatches(
    command.candidates.flatMap((candidate) =>
      matchTextCandidate({
        key: command.key,
        source: command.source,
        rawQueryValue: command.rawQueryValue,
        normalizedQueryValue: command.normalizedQueryValue,
        candidate,
        ...(command.exactBucket === undefined ? {} : { exactBucket: command.exactBucket }),
      }),
    ),
  )
}

function matchEnumValues(command: {
  readonly key: SupportedGlobalSearchFilterKey
  readonly source: 'filter' | 'free_text'
  readonly rawQueryValue: string
  readonly normalizedQueryValue: string
  readonly candidates: readonly string[]
}): readonly GlobalSearchMatch[] {
  const optionDefinitions = listEnumOptionsForField(command.key)
  const candidateSet = new Set(
    command.candidates.map((candidate) => normalizeSearchAlias(candidate)),
  )
  const matchingOptions = optionDefinitions.filter((option) =>
    candidateSet.has(normalizeSearchAlias(option.value)),
  )

  const matches: GlobalSearchMatch[] = []
  for (const option of matchingOptions) {
    const aliases = [option.value, option.fallbackLabel, ...option.aliases]

    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias)
      if (normalizedAlias === null) continue

      if (normalizedAlias === command.normalizedQueryValue) {
        matches.push(
          createMatch({
            key: command.key,
            source: command.source,
            matchedValue: option.value,
            rawQueryValue: command.rawQueryValue,
            bucket: command.source === 'filter' ? 'structured_exact' : 'text_prefix',
          }),
        )
        continue
      }

      if (normalizedAlias.startsWith(command.normalizedQueryValue)) {
        matches.push(
          createMatch({
            key: command.key,
            source: command.source,
            matchedValue: option.value,
            rawQueryValue: command.rawQueryValue,
            bucket: 'text_prefix',
          }),
        )
        continue
      }

      if (normalizedAlias.includes(command.normalizedQueryValue)) {
        matches.push(
          createMatch({
            key: command.key,
            source: command.source,
            matchedValue: option.value,
            rawQueryValue: command.rawQueryValue,
            bucket: 'text_contains',
          }),
        )
      }
    }
  }

  return dedupeMatches(matches)
}

function matchEtaExact(command: {
  readonly source: 'filter' | 'free_text'
  readonly rawQueryValue: string
  readonly eta: TemporalValueDto | null
}): readonly GlobalSearchMatch[] {
  const exactDate = parseCalendarDateFromDdMmYyyy(command.rawQueryValue)
  const etaParts = toDateParts(command.eta)
  if (etaParts === null) return []

  if (exactDate !== null) {
    const [yearPart, monthPart, dayPart] = exactDate.toIsoDate().split('-')
    if (yearPart === undefined || monthPart === undefined || dayPart === undefined) return []

    if (
      etaParts.year === Number(yearPart) &&
      etaParts.month === Number(monthPart) &&
      etaParts.day === Number(dayPart)
    ) {
      return [
        createMatch({
          key: 'eta',
          source: command.source,
          matchedValue: exactDate.toIsoDate(),
          rawQueryValue: command.rawQueryValue,
          bucket: 'date_exact',
        }),
      ]
    }
  }

  const dayMonth = parseDayMonth(command.rawQueryValue)
  if (dayMonth === null) return []

  if (etaParts.day === dayMonth.day && etaParts.month === dayMonth.month) {
    return [
      createMatch({
        key: 'eta',
        source: command.source,
        matchedValue: `${String(dayMonth.day).padStart(2, '0')}/${String(dayMonth.month).padStart(
          2,
          '0',
        )}`,
        rawQueryValue: command.rawQueryValue,
        bucket: 'date_exact',
      }),
    ]
  }

  return []
}

function matchEtaComparison(command: {
  readonly key: 'eta_before' | 'eta_after'
  readonly rawQueryValue: string
  readonly eta: TemporalValueDto | null
}): readonly GlobalSearchMatch[] {
  const filterDate = parseCalendarDateFromDdMmYyyy(command.rawQueryValue)
  if (filterDate === null || command.eta === null) return []

  const filterTemporal = parseTemporalValue({
    kind: 'date',
    value: filterDate.toIsoDate(),
    timezone: 'UTC',
  })
  const etaTemporal = parseTemporalValue(command.eta)
  if (filterTemporal === null || etaTemporal === null) return []

  const comparison = compareTemporal(etaTemporal, filterTemporal, TEMPORAL_COMPARE_OPTIONS)
  const matched = command.key === 'eta_before' ? comparison < 0 : comparison > 0

  if (!matched) return []

  return [
    createMatch({
      key: command.key,
      source: 'filter',
      matchedValue: command.rawQueryValue,
      rawQueryValue: command.rawQueryValue,
      bucket: 'structured_exact',
    }),
  ]
}

function matchEtaMonth(command: {
  readonly rawQueryValue: string
  readonly eta: TemporalValueDto | null
}): readonly GlobalSearchMatch[] {
  const monthValue = parseMonth(command.rawQueryValue)
  const etaParts = toDateParts(command.eta)
  if (monthValue === null || etaParts === null) return []

  if (etaParts.month === monthValue.month && etaParts.year === monthValue.year) {
    return [
      createMatch({
        key: 'eta_month',
        source: 'filter',
        matchedValue: command.rawQueryValue,
        rawQueryValue: command.rawQueryValue,
        bucket: 'structured_exact',
      }),
    ]
  }

  return []
}

function getDocumentFieldCandidates(
  document: GlobalSearchDocument,
  key: SupportedGlobalSearchFilterKey,
): readonly string[] {
  switch (key) {
    case 'process':
      return document.processReference === null ? [] : [document.processReference]
    case 'process_id':
      return [document.processId]
    case 'container':
      return document.containerNumbers
    case 'bl':
      return document.billOfLading === null ? [] : [document.billOfLading]
    case 'importer':
      return document.importerName === null ? [] : [document.importerName]
    case 'exporter':
      return document.exporterName === null ? [] : [document.exporterName]
    case 'carrier':
      return document.carrierName === null ? [] : [document.carrierName]
    case 'vessel':
      return document.currentVessels
    case 'voyage':
      return document.currentVoyages
    case 'status':
      return document.statusCode === null ? [] : [document.statusCode]
    case 'origin':
      return document.originLabel === null ? [] : [document.originLabel]
    case 'origin_country':
      return document.originCountryTokens
    case 'destination':
      return document.destinationLabel === null ? [] : [document.destinationLabel]
    case 'destination_country':
      return document.destinationCountryTokens
    case 'terminal':
      return document.terminalLabels
    case 'depot':
      return document.depotLabel === null ? [] : [document.depotLabel]
    case 'route':
      return document.routeLabel === null
        ? document.routeDisplays
        : [document.routeLabel, ...document.routeDisplays]
    case 'eta':
      return []
    case 'eta_before':
      return []
    case 'eta_after':
      return []
    case 'eta_month':
      return []
    case 'eta_state':
      return document.etaStates
    case 'eta_type':
      return document.etaTypes
    case 'current_location':
      return document.currentLocations
    case 'current_vessel':
      return document.currentVessels
    case 'current_voyage':
      return document.currentVoyages
    case 'validation':
      return [document.hasValidationRequired ? 'required' : 'clean']
    case 'alert_category':
      return document.activeAlertCategories
  }
}

function matchDocumentField(command: {
  readonly document: GlobalSearchDocument
  readonly key: SupportedGlobalSearchFilterKey
  readonly rawQueryValue: string
  readonly normalizedQueryValue: string
  readonly source: 'filter' | 'free_text'
}): readonly GlobalSearchMatch[] {
  const definition = getSupportedGlobalSearchFieldDefinition(command.key)

  if (command.key === 'eta') {
    return matchEtaExact({
      source: command.source,
      rawQueryValue: command.rawQueryValue,
      eta: command.document.eta,
    })
  }

  if (command.key === 'eta_before' || command.key === 'eta_after') {
    if (command.source !== 'filter') return []
    return matchEtaComparison({
      key: command.key,
      rawQueryValue: command.rawQueryValue,
      eta: command.document.eta,
    })
  }

  if (command.key === 'eta_month') {
    if (command.source !== 'filter') return []
    return matchEtaMonth({
      rawQueryValue: command.rawQueryValue,
      eta: command.document.eta,
    })
  }

  if (definition.kind === 'enum') {
    return matchEnumValues({
      key: command.key,
      source: command.source,
      rawQueryValue: command.rawQueryValue,
      normalizedQueryValue: command.normalizedQueryValue,
      candidates: getDocumentFieldCandidates(command.document, command.key),
    })
  }

  if (
    command.key === 'process' ||
    command.key === 'process_id' ||
    command.key === 'container' ||
    command.key === 'bl'
  ) {
    return matchTextCandidates({
      key: command.key,
      source: command.source,
      rawQueryValue: command.rawQueryValue,
      normalizedQueryValue: command.normalizedQueryValue,
      candidates: getDocumentFieldCandidates(command.document, command.key),
      exactBucket:
        command.key === 'process' ||
        command.key === 'process_id' ||
        command.key === 'container' ||
        command.key === 'bl'
          ? 'strong_identifier_exact'
          : 'structured_exact',
    }).map((match) =>
      match.bucket === 'text_prefix'
        ? {
            ...match,
            bucket: 'strong_identifier_prefix',
          }
        : match,
    )
  }

  if (command.key === 'origin_country') {
    const tokenMatches = matchTextCandidates({
      key: command.key,
      source: command.source,
      rawQueryValue: command.rawQueryValue,
      normalizedQueryValue: command.normalizedQueryValue,
      candidates: command.document.originCountryTokens,
    })

    return tokenMatches.length > 0
      ? tokenMatches
      : matchTextCandidate({
          key: command.key,
          source: command.source,
          rawQueryValue: command.rawQueryValue,
          normalizedQueryValue: command.normalizedQueryValue,
          candidate: command.document.originLabel,
        })
  }

  if (command.key === 'destination_country') {
    const tokenMatches = matchTextCandidates({
      key: command.key,
      source: command.source,
      rawQueryValue: command.rawQueryValue,
      normalizedQueryValue: command.normalizedQueryValue,
      candidates: command.document.destinationCountryTokens,
    })

    return tokenMatches.length > 0
      ? tokenMatches
      : matchTextCandidate({
          key: command.key,
          source: command.source,
          rawQueryValue: command.rawQueryValue,
          normalizedQueryValue: command.normalizedQueryValue,
          candidate: command.document.destinationLabel,
        })
  }

  return matchTextCandidates({
    key: command.key,
    source: command.source,
    rawQueryValue: command.rawQueryValue,
    normalizedQueryValue: command.normalizedQueryValue,
    candidates: getDocumentFieldCandidates(command.document, command.key),
  })
}

function evaluateDocumentAgainstQuery(command: {
  readonly document: GlobalSearchDocument
  readonly filters: readonly ParsedGlobalSearchFilter[]
  readonly freeTextTerms: readonly {
    rawValue: string
    normalizedValue: string
  }[]
}): readonly GlobalSearchMatch[] {
  const matches: GlobalSearchMatch[] = []

  for (const filter of command.filters) {
    if (!filter.supported || filter.key === 'event_date') {
      continue
    }

    const filterMatches = matchDocumentField({
      document: command.document,
      key: filter.key,
      rawQueryValue: filter.rawValue,
      normalizedQueryValue: filter.normalizedValue,
      source: 'filter',
    })
    if (filterMatches.length === 0) {
      return []
    }

    const firstFilterMatch = filterMatches[0]
    if (firstFilterMatch === undefined) {
      return []
    }

    matches.push(firstFilterMatch)
  }

  for (const term of command.freeTextTerms) {
    const termMatches = dedupeMatches(
      SEARCHABLE_FREE_TEXT_FIELDS.flatMap((key) =>
        matchDocumentField({
          document: command.document,
          key,
          rawQueryValue: term.rawValue,
          normalizedQueryValue: term.normalizedValue,
          source: 'free_text',
        }),
      ),
    )

    if (termMatches.length === 0) {
      return []
    }

    const firstTermMatch = termMatches[0]
    if (firstTermMatch === undefined) {
      return []
    }

    matches.push(firstTermMatch)
  }

  return dedupeMatches(matches)
}

function bucketCount(
  matches: readonly GlobalSearchMatch[],
  bucket: GlobalSearchMatchBucket,
): number {
  return matches.filter((match) => match.bucket === bucket).length
}

function compareNullableText(left: string | null, right: string | null): number {
  const normalizedLeft = normalizeText(left) ?? '\uffff'
  const normalizedRight = normalizeText(right) ?? '\uffff'
  return normalizedLeft.localeCompare(normalizedRight)
}

function compareRankedResults(left: RankedSearchResult, right: RankedSearchResult): number {
  const orderedBuckets: readonly GlobalSearchMatchBucket[] = [
    'strong_identifier_exact',
    'strong_identifier_prefix',
    'date_exact',
    'structured_exact',
    'text_prefix',
    'text_contains',
  ]

  for (const bucket of orderedBuckets) {
    const difference = bucketCount(right.matches, bucket) - bucketCount(left.matches, bucket)
    if (difference !== 0) return difference
  }

  const totalDifference = right.matches.length - left.matches.length
  if (totalDifference !== 0) return totalDifference

  const referenceCompare = compareNullableText(
    left.result.processReference,
    right.result.processReference,
  )
  if (referenceCompare !== 0) return referenceCompare

  return left.result.processId.localeCompare(right.result.processId)
}

function toResult(
  document: GlobalSearchDocument,
  matches: readonly GlobalSearchMatch[],
): GlobalSearchResult {
  return {
    processId: document.processId,
    processReference: document.processReference,
    billOfLading: document.billOfLading,
    importerName: document.importerName,
    exporterName: document.exporterName,
    carrierName: document.carrierName,
    statusCode: document.statusCode,
    eta: document.eta,
    etaState: document.etaStates[0] ?? null,
    etaType: document.etaTypes[0] ?? null,
    originLabel: document.originLabel,
    destinationLabel: document.destinationLabel,
    terminalLabel: document.terminalDisplay.value,
    terminalMultiple: document.terminalDisplay.multiple,
    depotLabel: document.depotLabel,
    routeLabel: document.routeLabel,
    containerNumbers: document.containerNumbers,
    currentLocationLabel: document.currentLocationDisplay.value,
    currentLocationMultiple: document.currentLocationDisplay.multiple,
    currentVesselName: document.currentVesselDisplay.value,
    currentVesselMultiple: document.currentVesselDisplay.multiple,
    currentVoyageNumber: document.currentVoyageDisplay.value,
    currentVoyageMultiple: document.currentVoyageDisplay.multiple,
    hasValidationRequired: document.hasValidationRequired,
    activeAlertCategories: document.activeAlertCategories,
    matchedBy: matches.slice(0, 4),
  }
}

async function loadDocuments(
  deps: CreateSearchUseCaseDeps,
): Promise<readonly GlobalSearchDocument[]> {
  const [processesResult, tracking, activeAlertsResult] = await Promise.all([
    deps.processUseCases.listProcessesWithOperationalSummary(),
    deps.trackingUseCases.listGlobalSearchProjections(),
    deps.trackingUseCases.listActiveAlertReadModel(),
  ])

  return buildGlobalSearchDocuments({
    processes: processesResult.processes,
    tracking,
    alerts: activeAlertsResult.alerts,
  })
}

function buildFieldSuggestions(input: string): readonly GlobalSearchSuggestion[] {
  const normalizedInput = normalizeText(input) ?? ''

  return listSupportedGlobalSearchFields()
    .filter((field) => {
      if (normalizedInput.length === 0) return true

      const searchableValues = [field.key, field.fallbackLabel, ...field.aliases]
      return searchableValues.some((value) => {
        const normalizedValue = normalizeText(value)
        return normalizedValue?.includes(normalizedInput) === true
      })
    })
    .slice(0, SEARCH_SUGGESTIONS_LIMIT)
    .map((field) => ({
      kind: 'field' as const,
      fieldKey: field.key === 'event_date' ? null : field.key,
      value: null,
      labelKey: field.labelKey,
      fallbackLabel: field.fallbackLabel,
      descriptionKey: null,
      insertText: `${field.key}:`,
    }))
}

function getSuggestionValues(
  documents: readonly GlobalSearchDocument[],
  key: SupportedGlobalSearchFilterKey,
): readonly string[] {
  if (key === 'eta') {
    return ['06/05/2026', '06/05']
  }

  if (key === 'eta_before' || key === 'eta_after') {
    return ['10/05/2026', '01/05/2026']
  }

  if (key === 'eta_month') {
    return ['05/2026']
  }

  const fieldDefinition = getSupportedGlobalSearchFieldDefinition(key)
  if (fieldDefinition.enumOptions !== undefined) {
    return fieldDefinition.enumOptions.map((option) => option.value)
  }

  const values = documents.flatMap((document) => getDocumentFieldCandidates(document, key))
  const unique = new Map<string, string>()

  for (const value of values) {
    const normalizedValue = normalizeText(value)
    if (normalizedValue === null || unique.has(normalizedValue)) continue
    unique.set(normalizedValue, value)
  }

  return Array.from(unique.values()).slice(0, SEARCH_SUGGESTIONS_LIMIT)
}

function buildValueSuggestions(command: {
  readonly fieldKey: SupportedGlobalSearchFilterKey
  readonly input: string
  readonly documents: readonly GlobalSearchDocument[]
}): readonly GlobalSearchSuggestion[] {
  const normalizedInput = normalizeText(command.input) ?? ''
  const enumOptions = listEnumOptionsForField(command.fieldKey)

  if (enumOptions.length > 0) {
    return enumOptions
      .filter((option) => {
        if (normalizedInput.length === 0) return true

        const values = [option.value, option.fallbackLabel, ...option.aliases]
        return values.some((value) => {
          const normalizedValue = normalizeText(value)
          return normalizedValue?.includes(normalizedInput) === true
        })
      })
      .slice(0, SEARCH_SUGGESTIONS_LIMIT)
      .map((option) => ({
        kind: 'value' as const,
        fieldKey: command.fieldKey,
        value: option.value,
        labelKey: option.labelKey,
        fallbackLabel: option.fallbackLabel,
        descriptionKey: null,
        insertText: option.value,
      }))
  }

  return getSuggestionValues(command.documents, command.fieldKey)
    .filter((value) => {
      if (normalizedInput.length === 0) return true
      const normalizedValue = normalizeText(value)
      return normalizedValue?.includes(normalizedInput) === true
    })
    .slice(0, SEARCH_SUGGESTIONS_LIMIT)
    .map((value) => ({
      kind: 'value' as const,
      fieldKey: command.fieldKey,
      value,
      labelKey: null,
      fallbackLabel: value,
      descriptionKey: null,
      insertText: value,
    }))
}

function buildExampleSuggestions(): readonly GlobalSearchSuggestion[] {
  return [
    {
      kind: 'example',
      fieldKey: null,
      value: null,
      labelKey: 'search.examples.container',
      fallbackLabel: 'container:MSKU1234567',
      descriptionKey: null,
      insertText: 'container:MSKU1234567',
    },
    {
      kind: 'example',
      fieldKey: null,
      value: null,
      labelKey: 'search.examples.multifilter',
      fallbackLabel: 'carrier:MSC importer:Flush status:DELIVERED',
      descriptionKey: null,
      insertText: 'carrier:MSC importer:Flush status:DELIVERED',
    },
    {
      kind: 'example',
      fieldKey: null,
      value: null,
      labelKey: 'search.examples.eta',
      fallbackLabel: 'eta:06/05/2026',
      descriptionKey: null,
      insertText: 'eta:06/05/2026',
    },
  ]
}

export function createSearchUseCase(deps: CreateSearchUseCaseDeps): SearchUseCase {
  return async function search(command: SearchCommand): Promise<GlobalSearchResponse> {
    const parsedQuery = parseGlobalSearchQuery({
      query: command.query,
      filters: command.filters ?? [],
    })

    const documents = await loadDocuments(deps)
    const rankedResults = documents
      .map((document) => {
        const matches = evaluateDocumentAgainstQuery({
          document,
          filters: parsedQuery.filters,
          freeTextTerms: parsedQuery.freeTextTerms,
        })

        return matches.length === 0
          ? null
          : {
              result: toResult(document, matches),
              matches,
            }
      })
      .filter((entry): entry is RankedSearchResult => entry !== null)
      .sort(compareRankedResults)
      .slice(0, SEARCH_RESULTS_LIMIT)
      .map((entry) => entry.result)

    return {
      query: parsedQuery,
      results: rankedResults,
      emptyState: toEmptyState(),
    }
  }
}

export function createSearchSuggestionsUseCase(
  deps: CreateSearchUseCaseDeps,
): SearchSuggestionsUseCase {
  return async function suggest(
    command: SearchSuggestionsCommand,
  ): Promise<GlobalSearchSuggestionsResponse> {
    const parsedQuery = parseGlobalSearchQuery({
      query: command.query,
      filters: command.filters ?? [],
    })
    const documents = await loadDocuments(deps)
    const draft = command.query.trim()

    if (draft.length === 0) {
      return {
        query: parsedQuery,
        suggestions: [...buildFieldSuggestions(''), ...buildExampleSuggestions()].slice(
          0,
          SEARCH_SUGGESTIONS_LIMIT,
        ),
      }
    }

    const separatorIndex = draft.indexOf(':')
    if (separatorIndex > 0) {
      const rawField = draft.slice(0, separatorIndex)
      const rawValue = draft.slice(separatorIndex + 1)
      const resolvedField = getSupportedFieldFromDraft(rawField)

      if (resolvedField !== null) {
        return {
          query: parsedQuery,
          suggestions: buildValueSuggestions({
            fieldKey: resolvedField,
            input: rawValue,
            documents,
          }),
        }
      }
    }

    return {
      query: parsedQuery,
      suggestions: buildFieldSuggestions(draft),
    }
  }
}

function getSupportedFieldFromDraft(rawField: string): SupportedGlobalSearchFilterKey | null {
  const normalizedField = normalizeSearchAlias(rawField)

  for (const field of listSupportedGlobalSearchFields()) {
    if (field.key !== 'event_date' && normalizeSearchAlias(field.key) === normalizedField) {
      return field.key
    }

    if (
      field.key !== 'event_date' &&
      field.aliases.some((alias) => normalizeSearchAlias(alias) === normalizedField)
    ) {
      return field.key
    }
  }

  return null
}
