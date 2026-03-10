import {
  DASHBOARD_DEFAULT_FILTER_SELECTION,
  type DashboardFilterSelection,
  type DashboardSeverityFilterValue,
  hasActiveDashboardFilters,
} from '~/modules/process/ui/viewmodels/dashboard-filter.service'
import {
  parseProcessStatusCode,
  type ProcessStatusCode,
} from '~/modules/process/ui/process-status-color'

const FILTER_PROVIDER_QUERY_KEY = 'provider'
const FILTER_STATUS_QUERY_KEY = 'status'
const FILTER_IMPORTER_ID_QUERY_KEY = 'importerId'
const FILTER_IMPORTER_NAME_QUERY_KEY = 'importerName'
const FILTER_SEVERITY_QUERY_KEY = 'severity'

function toOptionalNonBlankString(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed
}

function toUniqueNonBlankValues(values: readonly string[]): readonly string[] {
  const uniqueValues = new Set<string>()

  for (const value of values) {
    const nonBlankValue = toOptionalNonBlankString(value)
    if (nonBlankValue === null) continue
    uniqueValues.add(nonBlankValue)
  }

  return [...uniqueValues]
}

function parseDashboardFilterStatuses(values: readonly string[]): readonly ProcessStatusCode[] {
  const uniqueStatuses = new Set<ProcessStatusCode>()

  for (const value of values) {
    const nonBlankValue = toOptionalNonBlankString(value)
    if (nonBlankValue === null) continue

    const statusCode = parseProcessStatusCode(nonBlankValue)
    if (statusCode === null) continue

    uniqueStatuses.add(statusCode)
  }

  return [...uniqueStatuses]
}

function parseDashboardSeverityFilter(value: string | null): DashboardSeverityFilterValue | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed === 'danger' || trimmed === 'warning' || trimmed === 'none') {
    return trimmed
  }
  return null
}

export function parseDashboardFiltersFromSearchParams(
  searchParams: URLSearchParams,
): DashboardFilterSelection {
  const providers = toUniqueNonBlankValues(searchParams.getAll(FILTER_PROVIDER_QUERY_KEY))
  const statuses = parseDashboardFilterStatuses(searchParams.getAll(FILTER_STATUS_QUERY_KEY))
  const importerId = toOptionalNonBlankString(searchParams.get(FILTER_IMPORTER_ID_QUERY_KEY))
  const importerName = toOptionalNonBlankString(searchParams.get(FILTER_IMPORTER_NAME_QUERY_KEY))
  const severity = parseDashboardSeverityFilter(searchParams.get(FILTER_SEVERITY_QUERY_KEY))

  if (
    providers.length === 0 &&
    statuses.length === 0 &&
    importerId === null &&
    importerName === null &&
    severity === null
  ) {
    return DASHBOARD_DEFAULT_FILTER_SELECTION
  }

  return {
    providers,
    statuses,
    importerId,
    importerName,
    severity,
  }
}

export function hasDashboardFilterQueryParams(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has(FILTER_PROVIDER_QUERY_KEY) ||
    searchParams.has(FILTER_STATUS_QUERY_KEY) ||
    searchParams.has(FILTER_IMPORTER_ID_QUERY_KEY) ||
    searchParams.has(FILTER_IMPORTER_NAME_QUERY_KEY) ||
    searchParams.has(FILTER_SEVERITY_QUERY_KEY)
  )
}

export function resolveDashboardFilterSelectionWithStorageFallback(
  searchParams: URLSearchParams,
  storageFilterSelection: DashboardFilterSelection,
): DashboardFilterSelection {
  if (hasDashboardFilterQueryParams(searchParams)) {
    return parseDashboardFiltersFromSearchParams(searchParams)
  }

  if (!hasActiveDashboardFilters(storageFilterSelection)) {
    return DASHBOARD_DEFAULT_FILTER_SELECTION
  }

  return storageFilterSelection
}

type DashboardFilterHydrationResult = {
  readonly filterSelection: DashboardFilterSelection
  readonly searchParams: URLSearchParams
}

export function hydrateDashboardFiltersFromQueryAndStorage(
  searchParams: URLSearchParams,
  storageFilterSelection: DashboardFilterSelection,
): DashboardFilterHydrationResult {
  const filterSelection = resolveDashboardFilterSelectionWithStorageFallback(
    searchParams,
    storageFilterSelection,
  )

  return {
    filterSelection,
    searchParams: applyDashboardFiltersToSearchParams(searchParams, filterSelection),
  }
}

function appendQueryValues(
  searchParams: URLSearchParams,
  key: string,
  values: readonly string[],
): void {
  for (const value of values) {
    searchParams.append(key, value)
  }
}

function appendOptionalQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: string | null,
): void {
  if (value === null) return
  searchParams.set(key, value)
}

export function serializeDashboardFiltersToSearchParams(
  filterSelection: DashboardFilterSelection,
): URLSearchParams {
  const searchParams = new URLSearchParams()
  const providers = toUniqueNonBlankValues(filterSelection.providers)
  const statuses = parseDashboardFilterStatuses(filterSelection.statuses)
  const importerId = toOptionalNonBlankString(filterSelection.importerId)
  const importerName = toOptionalNonBlankString(filterSelection.importerName)
  const severity = filterSelection.severity

  appendQueryValues(searchParams, FILTER_PROVIDER_QUERY_KEY, providers)
  appendQueryValues(searchParams, FILTER_STATUS_QUERY_KEY, statuses)
  appendOptionalQueryValue(searchParams, FILTER_IMPORTER_ID_QUERY_KEY, importerId)
  appendOptionalQueryValue(searchParams, FILTER_IMPORTER_NAME_QUERY_KEY, importerName)
  appendOptionalQueryValue(searchParams, FILTER_SEVERITY_QUERY_KEY, severity)

  return searchParams
}

export function applyDashboardFiltersToSearchParams(
  currentSearchParams: URLSearchParams,
  filterSelection: DashboardFilterSelection,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(currentSearchParams)

  nextSearchParams.delete(FILTER_PROVIDER_QUERY_KEY)
  nextSearchParams.delete(FILTER_STATUS_QUERY_KEY)
  nextSearchParams.delete(FILTER_IMPORTER_ID_QUERY_KEY)
  nextSearchParams.delete(FILTER_IMPORTER_NAME_QUERY_KEY)
  nextSearchParams.delete(FILTER_SEVERITY_QUERY_KEY)

  const serializedFilters = serializeDashboardFiltersToSearchParams(filterSelection)

  appendQueryValues(
    nextSearchParams,
    FILTER_PROVIDER_QUERY_KEY,
    serializedFilters.getAll(FILTER_PROVIDER_QUERY_KEY),
  )
  appendQueryValues(
    nextSearchParams,
    FILTER_STATUS_QUERY_KEY,
    serializedFilters.getAll(FILTER_STATUS_QUERY_KEY),
  )
  appendOptionalQueryValue(
    nextSearchParams,
    FILTER_IMPORTER_ID_QUERY_KEY,
    serializedFilters.get(FILTER_IMPORTER_ID_QUERY_KEY),
  )
  appendOptionalQueryValue(
    nextSearchParams,
    FILTER_IMPORTER_NAME_QUERY_KEY,
    serializedFilters.get(FILTER_IMPORTER_NAME_QUERY_KEY),
  )
  appendOptionalQueryValue(
    nextSearchParams,
    FILTER_SEVERITY_QUERY_KEY,
    serializedFilters.get(FILTER_SEVERITY_QUERY_KEY),
  )

  return nextSearchParams
}
